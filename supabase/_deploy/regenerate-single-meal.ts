import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

// ── CORS ──────────────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── CONTEXT ───────────────────────────────────────────────────────────────────
interface Household {
  id: string;
  user_id: string;
  adults: number;
  children: number;
  preferences: string[];
  favorite_dishes: string[];
  cuisine_styles: string[];
  chef_styles: string[];
  meals_per_week: number;
  grocery_day: number;
  reminder_time: string;
  language: "fr" | "en";
  unit_system: "metric" | "imperial";
  is_purchased: boolean;
  generation_count: number;
}
class HttpError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
function adminClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}
async function getHousehold(req: Request, admin: SupabaseClient): Promise<Household> {
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "unauthorized");
  const { data: household, error: hhError } = await admin.from("households").select("*").eq("user_id", data.user.id).single();
  if (hhError || !household) throw new HttpError(404, "household_not_found");
  return household as Household;
}

// ── ANTHROPIC ─────────────────────────────────────────────────────────────────
const LANGUAGE_NAMES: Record<string, string> = {
  fr: "français canadien (québécois : « souper », « épicerie »)",
  en: "Canadian English",
};
async function chatJSON<T>(system: string, user: string): Promise<T> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) { const body = await res.text(); throw new Error(`Claude ${res.status}: ${body}`); }
  const data = await res.json();
  const rawText: string = data.content?.[0]?.text ?? "";
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`No JSON in Claude response: ${rawText.slice(0, 300)}`);
  return JSON.parse(jsonMatch[0]) as T;
}

// ── GROCERY ───────────────────────────────────────────────────────────────────
interface StapleRow { id: string; name: string; frequency_weeks: number; last_added_date: string | null; category: string; }
interface GeneratedItem { name: string; quantity: string; category: string; }
interface MealForList { name: string; ingredients: { name: string; quantity?: string; unit?: string }[]; }

const VALID_CATEGORIES = ["produce", "meat_fish", "dairy", "bakery", "pantry", "frozen", "other"];

function isStapleDue(staple: StapleRow, weekStartISO: string): boolean {
  if (!staple.last_added_date) return true;
  const elapsed = (new Date(weekStartISO).getTime() - new Date(staple.last_added_date).getTime()) / 86_400_000;
  return elapsed >= staple.frequency_weeks * 7;
}

async function rebuildGroceryList(admin: SupabaseClient, household: Household, mealPlanId: string, weekStartISO: string) {
  const { data: items } = await admin.from("meal_plan_items").select("name, ingredients").eq("meal_plan_id", mealPlanId).eq("is_archived", false);
  const meals = (items ?? []) as MealForList[];
  const { data: stapleRows } = await admin.from("staple_items").select("*").eq("household_id", household.id);
  const staples = (stapleRows ?? []) as StapleRow[];
  const dueStaples = staples.filter((s) => isStapleDue(s, weekStartISO));
  const availableStaples = staples.filter((s) => !isStapleDue(s, weekStartISO));
  const mealsWithIngredients = meals.filter((m) => (m.ingredients ?? []).length > 0);

  let generated: GeneratedItem[] = [];
  if (mealsWithIngredients.length > 0) {
    const isEn = household.language === "en";
    const categoryDesc = isEn
      ? `produce (fruits, vegetables, fresh herbs), meat_fish (meat, poultry, fish, seafood), dairy (milk, cheese, eggs, yogurt, cream, butter), bakery (bread, tortilla, naan, breadcrumbs, panko, croissant, pita, crackers), pantry (dry goods, canned goods, oils, vinegars, spices, nuts, pasta, rice, sauces, broths), frozen (frozen foods, ice cream), other (anything that doesn't fit the above)`
      : `produce (fruits, légumes, herbes fraîches), meat_fish (viandes, volailles, poissons, fruits de mer), dairy (lait, fromages, oeufs, yogourt, crème, beurre), bakery (pain, baguette, tortilla, naan, chapelure, panko, croissant, pita), pantry (épicerie sèche, conserves, huiles, vinaigres, épices, noix, pâtes, riz, sauces, bouillons), frozen (surgelés, glaces), other (tout ce qui ne rentre dans aucune catégorie ci-dessus)`;
    const system = isEn
      ? `You are a family grocery assistant.\nFrom the dinners provided for a family of ${household.adults} adults and ${household.children} children:\n- Aggregate all ingredients from all recipes\n- Deduplicate (combine "2 tomatoes" + "3 tomatoes" into "5 tomatoes")\n- Adjust quantities for the family size\n- Exclude these staples always available at home: ${availableStaples.map((s) => s.name).join(", ") || "(none)"}\n- Classify each item into exactly one of these categories (use the key as-is):\n  ${categoryDesc}\nReply in JSON: {"items":[{"name":"...","quantity":"...","category":"produce"}]}\nItem names and quantities are in ${LANGUAGE_NAMES[household.language]}.`
      : `Tu es un assistant d'épicerie familial.\nÀ partir des soupers fournis pour une famille de ${household.adults} adultes et ${household.children} enfants :\n- Agrège tous les ingrédients de toutes les recettes\n- Déduplique (combine « 2 tomates » + « 3 tomates » en « 5 tomates »)\n- Ajuste les quantités à la taille de la famille\n- Exclus ces ingrédients de base toujours disponibles à la maison : ${availableStaples.map((s) => s.name).join(", ") || "(aucun)"}\n- Classe chaque item dans exactement une de ces catégories (utilise la clé telle quelle) :\n  ${categoryDesc}\nRéponds en JSON : {"items":[{"name":"...","quantity":"...","category":"produce"}]}\nLes noms d'items et quantités sont en ${LANGUAGE_NAMES[household.language]}.`;
    const user = JSON.stringify(mealsWithIngredients.map((m) => ({ souper: m.name, ingredients: m.ingredients })));
    const result = await chatJSON<{ items: GeneratedItem[] }>(system, user);
    generated = (result.items ?? []).filter((i) => VALID_CATEGORIES.includes(i.category));
  }

  let { data: list } = await admin.from("grocery_lists").select("id").eq("meal_plan_id", mealPlanId).maybeSingle();
  if (!list) {
    const { data: created, error } = await admin.from("grocery_lists").insert({ meal_plan_id: mealPlanId, household_id: household.id }).select("id").single();
    if (error) throw error;
    list = created;
  } else {
    await admin.from("grocery_items").delete().eq("grocery_list_id", list.id).eq("is_manual", false);
  }

  const rows = [
    ...generated.map((i) => ({ grocery_list_id: list!.id, name: i.name, quantity: i.quantity || null, category: i.category, is_staple: false })),
    ...dueStaples.map((s) => ({ grocery_list_id: list!.id, name: s.name, quantity: null, category: "staples", is_staple: true })),
  ];
  if (rows.length > 0) { const { error } = await admin.from("grocery_items").insert(rows); if (error) throw error; }
  if (dueStaples.length > 0) await admin.from("staple_items").update({ last_added_date: weekStartISO }).in("id", dueStaples.map((s) => s.id));
  const { data: finalItems } = await admin.from("grocery_items").select("*").eq("grocery_list_id", list!.id);
  return { list_id: list!.id, items: finalItems ?? [] };
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
interface GeneratedMeal {
  name: string;
  prep_minutes: number;
  ingredients: { name: string; quantity: string; unit?: string }[];
  steps: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = adminClient();
    const household = await getHousehold(req, admin);

    if (household.generation_count > 1 && !household.is_purchased) {
      return jsonResponse({ error: "purchase_required" }, 402);
    }

    const body = await req.json().catch(() => ({}));
    const itemId: string = body.item_id;
    if (!itemId) return jsonResponse({ error: "missing_item_id" }, 400);

    const { data: item } = await admin.from("meal_plan_items").select("*, meal_plans!inner(id, household_id, week_start_date)").eq("id", itemId).maybeSingle();
    const plan = item?.meal_plans as unknown as { id: string; household_id: string; week_start_date: string };
    if (!item || plan.household_id !== household.id) throw new HttpError(404, "item_not_found");

    const { data: weekItems } = await admin.from("meal_plan_items").select("name").eq("meal_plan_id", plan.id).eq("is_archived", false);
    const currentNames = (weekItems ?? []).map((i) => i.name);

    const { data: fridge } = await admin.from("fridge_snapshots").select("contents").eq("household_id", household.id).eq("week_start_date", plan.week_start_date).maybeSingle();

    const chefStyles: string[] = (household as unknown as { chef_styles?: string[] }).chef_styles ?? [];
    const chefSection = chefStyles.length > 0
      ? `Style inspiré par : ${chefStyles.join(", ")}.`
      : "Style générique — cuisine moderne et accessible.";

    const system = `Tu es un assistant culinaire familial. Génère 1 seul souper pour une famille de ${household.adults} adultes et ${household.children} enfants.\n${chefSection}\nContraintes :\n- Temps de préparation : 25 à 50 minutes\n- Titre évocateur ("Saumon laqué au miso" plutôt que "Saumon")\n- Respecter les restrictions alimentaires : ${household.preferences.join(", ") || "(aucune)"}\n- Inspire-toi de ces recettes que la famille aime déjà : ${household.favorite_dishes.join(", ") || "(aucune fournie)"}\n- Style de cuisine souhaité : ${household.cuisine_styles.join(", ") || "(aucun)"}\n- Utilise en priorité ce qui est déjà dans le frigo : ${fridge?.contents || "(inconnu)"}\n- Le souper doit être DIFFÉRENT de ceux déjà au menu cette semaine : ${currentNames.join(", ")}\n- Il remplace « ${item.name} » que la famille a refusé — propose quelque chose de clairement différent.\nRéponds UNIQUEMENT en JSON : {"name":"...","prep_minutes":35,"ingredients":[{"name":"...","quantity":"...","unit":"..."}],"steps":["..."]}\nRéponds en ${LANGUAGE_NAMES[household.language]}.`;

    const meal = await chatJSON<GeneratedMeal>(system, "Génère le souper de remplacement.");

    await admin.from("meal_plan_items").update({ was_regenerated: true, is_archived: true }).eq("id", item.id);

    const { data: newItem, error: insertError } = await admin.from("meal_plan_items").insert({
      meal_plan_id: plan.id,
      day_index: item.day_index,
      name: meal.name,
      prep_minutes: meal.prep_minutes,
      ingredients: meal.ingredients ?? [],
      steps: meal.steps ?? [],
    }).select("*").single();
    if (insertError) throw insertError;

    const grocery = await rebuildGroceryList(admin, household, plan.id, plan.week_start_date);

    return jsonResponse({ item: newItem, grocery_list_id: grocery.list_id, grocery_items: grocery.items });
  } catch (err) {
    if (err instanceof HttpError) return jsonResponse({ error: err.code }, err.status);
    console.error(err);
    return jsonResponse({ error: "internal_error" }, 500);
  }
});
