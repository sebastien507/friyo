import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { supabase } from "../lib/supabase";
import { getWeekStartISO } from "../lib/dates";
import { t } from "../lib/i18n";
import { useAppStore } from "../stores/useAppStore";
import type {
  GroceryCategory,
  GroceryItem,
  GroceryList,
} from "../types/database";

export interface WeekGroceryList {
  list: GroceryList;
  items: GroceryItem[];
}

const CATEGORY_ORDER: GroceryCategory[] = [
  "produce",
  "meat_fish",
  "dairy",
  "pantry",
  "frozen",
  "other",
  "staples",
];

export function useGroceryList() {
  const weekStart = getWeekStartISO();
  const sessionReady = useAppStore((s) => s.sessionReady);
  return useQuery({
    queryKey: ["groceryList", weekStart],
    enabled: sessionReady,
    queryFn: async (): Promise<WeekGroceryList | null> => {
      const { data: plan } = await supabase
        .from("meal_plans")
        .select("id")
        .eq("week_start_date", weekStart)
        .maybeSingle();
      if (!plan) return null;
      const { data: list } = await supabase
        .from("grocery_lists")
        .select("*")
        .eq("meal_plan_id", plan.id)
        .maybeSingle();
      if (!list) return null;
      const { data: items, error } = await supabase
        .from("grocery_items")
        .select("*")
        .eq("grocery_list_id", list.id)
        .order("name");
      if (error) throw error;
      const sorted = (items ?? []).sort(
        (a, b) =>
          CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
      );
      return { list, items: sorted };
    },
  });
}

function useInvalidateGrocery() {
  const queryClient = useQueryClient();
  const weekStart = getWeekStartISO();
  return () =>
    queryClient.invalidateQueries({ queryKey: ["groceryList", weekStart] });
}

/** Check optimiste + haptic — l'item barré reste visible. */
export function useToggleGroceryItem() {
  const queryClient = useQueryClient();
  const weekStart = getWeekStartISO();
  return useMutation({
    mutationFn: async (item: GroceryItem) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const { error } = await supabase
        .from("grocery_items")
        .update({ is_checked: !item.is_checked })
        .eq("id", item.id);
      if (error) throw error;
    },
    onMutate: async (item) => {
      const key = ["groceryList", weekStart];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<WeekGroceryList | null>(key);
      queryClient.setQueryData<WeekGroceryList | null>(key, (old) =>
        old
          ? {
              ...old,
              items: old.items.map((i) =>
                i.id === item.id ? { ...i, is_checked: !i.is_checked } : i,
              ),
            }
          : old,
      );
      return { previous };
    },
    onError: (_err, _item, ctx) => {
      queryClient.setQueryData(["groceryList", weekStart], ctx?.previous);
    },
  });
}

export function useDeleteGroceryItem() {
  const invalidate = useInvalidateGrocery();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from("grocery_items")
        .delete()
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/** Ajout manuel (is_manual = true, icône crayon dans l'UI). */
export function useAddGroceryItem() {
  const invalidate = useInvalidateGrocery();
  return useMutation({
    mutationFn: async (input: {
      listId: string;
      name: string;
      quantity: string;
      category: GroceryCategory;
    }) => {
      const { error } = await supabase.from("grocery_items").insert({
        grocery_list_id: input.listId,
        name: input.name,
        quantity: input.quantity || null,
        category: input.category,
        is_manual: true,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/** Format texte partageable (Copier · iMessage · autres apps). */
export function buildShareText(items: GroceryItem[], weekLabel: string): string {
  const lines: string[] = [t("grocery.shareHeader", { date: weekLabel }), ""];
  for (const category of CATEGORY_ORDER) {
    const inCategory = items.filter((i) => i.category === category);
    if (inCategory.length === 0) continue;
    lines.push(t(`grocery.categories.${category}`));
    for (const item of inCategory) {
      const box = item.is_checked ? "☑" : "☐";
      const qty = item.quantity ? ` (${item.quantity})` : "";
      lines.push(`${box} ${item.name}${qty}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}
