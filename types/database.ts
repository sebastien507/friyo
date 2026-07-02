export type GroceryCategory =
  | "produce"
  | "meat_fish"
  | "dairy"
  | "bakery"
  | "pantry"
  | "frozen"
  | "other"
  | "staples";

export const GROCERY_CATEGORIES: GroceryCategory[] = [
  "produce",
  "meat_fish",
  "dairy",
  "bakery",
  "pantry",
  "frozen",
  "other",
];

export type DietaryPreference =
  | "vegetarian"
  | "flexitarian"
  | "pescatarian"
  | "vegan"
  | "gluten_free"
  | "lactose_free";

export type CuisineStyle =
  | "quebecois"
  | "italian"
  | "mexican"
  | "asian"
  | "mediterranean"
  | "maghrebin"
  | "comfort"
  | "light_healthy"
  | "bbq"
  | "stews_soups";

export type ChefStyle =
  | "ottolenghi"
  | "ricardo"
  | "jamie_oliver"
  | "ina_garten"
  | "jennifer_segal"
  | "kathryne_taylor";

export interface Household {
  id: string;
  user_id: string;
  adults: number;
  children: number;
  preferences: DietaryPreference[];
  favorite_dishes: string[];
  cuisine_styles: CuisineStyle[];
  chef_styles: ChefStyle[];
  meals_per_week: number;
  grocery_day: number; // 0=lundi … 6=dimanche
  reminder_time: string; // "18:00:00"
  last_season_prompt: string | null;
  language: "fr" | "en";
  unit_system: "metric" | "imperial";
  is_simple_quick: boolean;
  is_purchased: boolean;
  generation_count: number;
  trial_ends_at: string | null;
  created_at: string;
}

export interface Ingredient {
  name: string;
  quantity: string;
  unit?: string;
}

export interface MealPlan {
  id: string;
  household_id: string;
  week_start_date: string;
  created_at: string;
}

export interface MealPlanItem {
  id: string;
  meal_plan_id: string;
  day_index: number; // 0=lundi … 6=dimanche
  name: string;
  prep_minutes: number | null;
  ingredients: Ingredient[];
  steps: string[];
  is_locked: boolean;
  is_manual: boolean;
  was_regenerated: boolean;
  is_favorited: boolean;
  is_archived: boolean;
  personal_note: string | null;
  image_url: string | null;
}

export interface GroceryList {
  id: string;
  meal_plan_id: string;
  household_id: string;
  created_at: string;
}

export interface GroceryItem {
  id: string;
  grocery_list_id: string;
  name: string;
  quantity: string | null;
  category: GroceryCategory;
  is_checked: boolean;
  is_manual: boolean;
  is_staple: boolean;
}

export interface StapleItem {
  id: string;
  household_id: string;
  name: string;
  frequency_weeks: number;
  last_added_date: string | null;
  category: GroceryCategory;
}

export interface FridgeSnapshot {
  id: string;
  household_id: string;
  week_start_date: string;
  contents: string;
  created_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  meal_name: string;
  meal_data: GeneratedMeal;
  created_at: string;
}

/** Forme renvoyée par les Edge Functions OpenAI */
export interface GeneratedMeal {
  day_index: number;
  name: string;
  prep_minutes: number;
  ingredients: Ingredient[];
  steps: string[];
}

export interface GeneratedGroceryItem {
  name: string;
  quantity: string;
  category: GroceryCategory;
}

export interface PopularRecipe {
  name: string;
  popularity_score: number;
}
