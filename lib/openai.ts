import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { GroceryItem, MealPlanItem } from "../types/database";

/** Lancée quand l'Edge Function répond 402 — premier menu gratuit épuisé. */
export class PurchaseRequiredError extends Error {
  constructor() {
    super("purchase_required");
  }
}

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      if (error.context.status === 402) throw new PurchaseRequiredError();
      const text = await error.context.text().catch(() => "");
      throw new Error(`[${error.context.status}] ${name}: ${text}`);
    }
    throw error;
  }
  return data as T;
}

export interface GenerateMealPlanResponse {
  meal_plan_id: string;
  items: MealPlanItem[];
  grocery_list_id: string;
  grocery_items: GroceryItem[];
}

export function generateMealPlan(weekStartDate: string) {
  return invoke<GenerateMealPlanResponse>("generate-meal-plan", {
    week_start_date: weekStartDate,
  });
}

export interface RegenerateSingleMealResponse {
  item: MealPlanItem;
  grocery_list_id: string;
  grocery_items: GroceryItem[];
}

export function regenerateSingleMeal(itemId: string) {
  return invoke<RegenerateSingleMealResponse>("regenerate-single-meal", {
    item_id: itemId,
  });
}

export interface GenerateGroceryListResponse {
  grocery_list_id: string;
  grocery_items: GroceryItem[];
}

export function generateGroceryList(weekStartDate: string) {
  return invoke<GenerateGroceryListResponse>("generate-grocery-list", {
    week_start_date: weekStartDate,
  });
}
