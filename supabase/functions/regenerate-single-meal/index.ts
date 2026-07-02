import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { adminClient, getHousehold, HttpError } from "../_shared/context.ts";
import { chatJSON, LANGUAGE_NAMES } from "../_shared/anthropic.ts";
import { rebuildGroceryList } from "../_shared/grocery.ts";

interface GeneratedMeal {
  name: string;
  prep_minutes: number;
  ingredients: { name: string; quantity: string; unit?: string }[];
  steps: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const admin = adminClient();
    const household = await getHousehold(req, admin);

    // Le swap reste gratuit sur le premier menu (généré gratuitement)
    if (household.generation_count > 1 && !household.is_purchased) {
      return jsonResponse({ error: "purchase_required" }, 402);
    }

    const body = await req.json().catch(() => ({}));
    const itemId: string = body.item_id;
    if (!itemId) return jsonResponse({ error: "missing_item_id" }, 400);

    const { data: item } = await admin
      .from("meal_plan_items")
      .select("*, meal_plans!inner(id, household_id, week_start_date)")
      .eq("id", itemId)
      .maybeSingle();
    const plan = item?.meal_plans as unknown as {
      id: string;
      household_id: string;
      week_start_date: string;
    };
    if (!item || plan.household_id !== household.id) {
      throw new HttpError(404, "item_not_found");
    }

    const { data: weekItems } = await admin
      .from("meal_plan_items")
      .select("name")
      .eq("meal_plan_id", plan.id)
      .eq("is_archived", false);
    const currentNames = (weekItems ?? []).map((i) => i.name);

    const { data: fridge } = await admin
      .from("fridge_snapshots")
      .select("contents")
      .eq("household_id", household.id)
      .eq("week_start_date", plan.week_start_date)
      .maybeSingle();

    const chefStyles: string[] = (household as unknown as { chef_styles?: string[] }).chef_styles ?? [];
    const chefSection = chefStyles.length > 0
      ? `Style inspiré par : ${chefStyles.join(", ")}.`
      : "Style générique — cuisine moderne et accessible.";

    const system = `Tu es un assistant culinaire familial. Génère 1 seul souper pour une famille de ${household.adults} adultes et ${household.children} enfants.
${chefSection}
Contraintes :
- Temps de préparation : 25 à 50 minutes
- Titre évocateur ("Saumon laqué au miso" plutôt que "Saumon")
- Respecter les restrictions alimentaires : ${household.preferences.join(", ") || "(aucune)"}
- Inspire-toi de ces recettes que la famille aime déjà : ${household.favorite_dishes.join(", ") || "(aucune fournie)"}
- Style de cuisine souhaité : ${household.cuisine_styles.join(", ") || "(aucun)"}
- Utilise en priorité ce qui est déjà dans le frigo : ${fridge?.contents || "(inconnu)"}
- Le souper doit être DIFFÉRENT de ceux déjà au menu cette semaine : ${currentNames.join(", ")}
- Il remplace « ${item.name} » que la famille a refusé — propose quelque chose de clairement différent.
Réponds UNIQUEMENT en JSON : {"name":"...","prep_minutes":35,"ingredients":[{"name":"...","quantity":"...","unit":"..."}],"steps":["..."]}
Réponds en ${LANGUAGE_NAMES[household.language]}.`;

    const meal = await chatJSON<GeneratedMeal>(
      system,
      "Génère le souper de remplacement.",
    );

    // L'ancien item est archivé (caché du menu) mais conservé :
    // was_regenerated = true alimente le score de popularité
    await admin
      .from("meal_plan_items")
      .update({ was_regenerated: true, is_archived: true })
      .eq("id", item.id);

    const { data: newItem, error: insertError } = await admin
      .from("meal_plan_items")
      .insert({
        meal_plan_id: plan.id,
        day_index: item.day_index,
        name: meal.name,
        prep_minutes: meal.prep_minutes,
        ingredients: meal.ingredients ?? [],
        steps: meal.steps ?? [],
      })
      .select("*")
      .single();
    if (insertError) throw insertError;

    // La liste d'épicerie suit le changement de repas
    const grocery = await rebuildGroceryList(
      admin,
      household,
      plan.id,
      plan.week_start_date,
    );

    return jsonResponse({
      item: newItem,
      grocery_list_id: grocery.list_id,
      grocery_items: grocery.items,
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return jsonResponse({ error: err.code }, err.status);
    }
    console.error(err);
    return jsonResponse({ error: "internal_error" }, 500);
  }
});
