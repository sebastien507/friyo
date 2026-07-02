import { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { chatJSON, LANGUAGE_NAMES } from "./anthropic.ts";
import { Household } from "./context.ts";

interface MealForList {
  name: string;
  ingredients: { name: string; quantity?: string; unit?: string }[];
}

interface StapleRow {
  id: string;
  name: string;
  frequency_weeks: number;
  last_added_date: string | null;
  category: string;
}

interface GeneratedItem {
  name: string;
  quantity: string;
  category: string;
}

const VALID_CATEGORIES = [
  "produce",
  "meat_fish",
  "dairy",
  "bakery",
  "pantry",
  "frozen",
  "other",
];

/** Un staple est « dû » si jamais acheté ou si sa fréquence est écoulée. */
export function isStapleDue(staple: StapleRow, weekStartISO: string): boolean {
  if (!staple.last_added_date) return true;
  const elapsed =
    (new Date(weekStartISO).getTime() -
      new Date(staple.last_added_date).getTime()) /
    86_400_000;
  return elapsed >= staple.frequency_weeks * 7;
}

/**
 * (Re)génère la liste d'épicerie d'un plan : agrège les ingrédients via
 * OpenAI, exclut les staples non dus, ajoute les staples dus en section
 * « Produits de base ». Les items manuels existants sont préservés.
 */
export async function rebuildGroceryList(
  admin: SupabaseClient,
  household: Household,
  mealPlanId: string,
  weekStartISO: string,
) {
  const { data: items } = await admin
    .from("meal_plan_items")
    .select("name, ingredients")
    .eq("meal_plan_id", mealPlanId)
    .eq("is_archived", false);
  const meals = (items ?? []) as MealForList[];

  const { data: stapleRows } = await admin
    .from("staple_items")
    .select("*")
    .eq("household_id", household.id);
  const staples = (stapleRows ?? []) as StapleRow[];
  const dueStaples = staples.filter((s) => isStapleDue(s, weekStartISO));
  const availableStaples = staples.filter((s) => !isStapleDue(s, weekStartISO));

  const mealsWithIngredients = meals.filter(
    (m) => (m.ingredients ?? []).length > 0,
  );

  let generated: GeneratedItem[] = [];
  if (mealsWithIngredients.length > 0) {
    const isEn = household.language === "en";
    const categoryDesc = isEn
      ? `produce (fruits, vegetables, fresh herbs), meat_fish (meat, poultry, fish, seafood), dairy (milk, cheese, eggs, yogurt, cream, butter), bakery (bread, tortilla, naan, breadcrumbs, panko, croissant, pita, crackers), pantry (dry goods, canned goods, oils, vinegars, spices, nuts, pasta, rice, sauces, broths), frozen (frozen foods, ice cream), other (anything that doesn't fit the above)`
      : `produce (fruits, légumes, herbes fraîches), meat_fish (viandes, volailles, poissons, fruits de mer), dairy (lait, fromages, oeufs, yogourt, crème, beurre), bakery (pain, baguette, tortilla, naan, chapelure, panko, croissant, pita), pantry (épicerie sèche, conserves, huiles, vinaigres, épices, noix, pâtes, riz, sauces, bouillons), frozen (surgelés, glaces), other (tout ce qui ne rentre dans aucune catégorie ci-dessus)`;

    const system = isEn
      ? `You are a family grocery assistant.
From the dinners provided for a family of ${household.adults} adults and ${household.children} children:
- Aggregate all ingredients from all recipes
- Deduplicate (combine "2 tomatoes" + "3 tomatoes" into "5 tomatoes")
- Adjust quantities for the family size
- Exclude these staples always available at home: ${availableStaples.map((s) => s.name).join(", ") || "(none)"}
- Classify each item into exactly one of these categories (use the key as-is):
  ${categoryDesc}
Reply in JSON: {"items":[{"name":"...","quantity":"...","category":"produce"}]}
Item names and quantities are in ${LANGUAGE_NAMES[household.language]}.`
      : `Tu es un assistant d'épicerie familial.
À partir des soupers fournis pour une famille de ${household.adults} adultes et ${household.children} enfants :
- Agrège tous les ingrédients de toutes les recettes
- Déduplique (combine « 2 tomates » + « 3 tomates » en « 5 tomates »)
- Ajuste les quantités à la taille de la famille
- Exclus ces ingrédients de base toujours disponibles à la maison : ${availableStaples.map((s) => s.name).join(", ") || "(aucun)"}
- Classe chaque item dans exactement une de ces catégories (utilise la clé telle quelle) :
  ${categoryDesc}
Réponds en JSON : {"items":[{"name":"...","quantity":"...","category":"produce"}]}
Les noms d'items et quantités sont en ${LANGUAGE_NAMES[household.language]}.`;

    const user = JSON.stringify(
      mealsWithIngredients.map((m) => ({
        souper: m.name,
        ingredients: m.ingredients,
      })),
    );

    const result = await chatJSON<{ items: GeneratedItem[] }>(system, user);
    generated = (result.items ?? []).filter((i) =>
      VALID_CATEGORIES.includes(i.category)
    );
  }

  // Liste existante : préserver les items manuels, remplacer le reste
  let { data: list } = await admin
    .from("grocery_lists")
    .select("id")
    .eq("meal_plan_id", mealPlanId)
    .maybeSingle();

  if (!list) {
    const { data: created, error } = await admin
      .from("grocery_lists")
      .insert({ meal_plan_id: mealPlanId, household_id: household.id })
      .select("id")
      .single();
    if (error) throw error;
    list = created;
  } else {
    await admin
      .from("grocery_items")
      .delete()
      .eq("grocery_list_id", list.id)
      .eq("is_manual", false);
  }

  const rows = [
    ...generated.map((i) => ({
      grocery_list_id: list!.id,
      name: i.name,
      quantity: i.quantity || null,
      category: i.category,
      is_staple: false,
    })),
    ...dueStaples.map((s) => ({
      grocery_list_id: list!.id,
      name: s.name,
      quantity: null,
      category: "staples",
      is_staple: true,
    })),
  ];
  if (rows.length > 0) {
    const { error } = await admin.from("grocery_items").insert(rows);
    if (error) throw error;
  }

  if (dueStaples.length > 0) {
    await admin
      .from("staple_items")
      .update({ last_added_date: weekStartISO })
      .in("id", dueStaples.map((s) => s.id));
  }

  const { data: finalItems } = await admin
    .from("grocery_items")
    .select("*")
    .eq("grocery_list_id", list!.id);

  return { list_id: list!.id, items: finalItems ?? [] };
}
