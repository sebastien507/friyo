import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { adminClient, getHousehold, HttpError } from "../_shared/context.ts";
import { chatJSON, LANGUAGE_NAMES } from "../_shared/anthropic.ts";
import { rebuildGroceryList } from "../_shared/grocery.ts";

interface GeneratedMeal {
  day_index: number;
  day_label: string;
  name: string;
  prep_minutes: number;
  ingredients: { name: string; quantity: string; unit?: string }[];
  steps: string[];
}

const CUISINE_INFLUENCES: Record<string, { label: string; chefs: string[] }> = {
  quebecois:    { label: "Québécois traditionnel", chefs: ["Ricardo Larrivée", "Martin Picard", "Louis-François Marcotte"] },
  italian:      { label: "Italien",                chefs: ["Giada De Laurentiis", "Stanley Tucci", "Nadia Caterina Munno"] },
  mexican:      { label: "Mexicain",               chefs: ["Pati Jinich", "Rick Martínez", "Gabriela Cámara"] },
  comfort:      { label: "Américain / Comfort food", chefs: ["Joshua Weissman", "Samin Nosrat", "Alison Roman"] },
  mediterranean:{ label: "Méditerranéen",          chefs: ["Yotam Ottolenghi", "Suzy Karadsheh", "Michael Solomonov"] },
  asian:        { label: "Asiatique",              chefs: ["Hetty Lui McKinnon", "Eric Kim", "Maangchi"] },
  maghrebin:    { label: "Maghrébin",              chefs: ["Nargisse Benkabbou", "Mourad Lahlou", "Yotam Ottolenghi"] },
  light_healthy:{ label: "Léger & Santé",          chefs: ["Samin Nosrat", "Kylie Sakaida", "Ella Mills"] },
  bbq:          { label: "BBQ & Grillades",        chefs: ["Steven Raichlen", "Aaron Franklin", "Meathead Goldwyn"] },
  stews_soups:  { label: "Mijotés & Soupes",       chefs: ["Ricardo Larrivée", "Melissa Clark", "Jamie Oliver"] },
};

function buildDietaryRules(preferences: string[]): string {
  if (!preferences || preferences.length === 0) return "";
  const rules: string[] = [];
  if (preferences.includes("vegan")) {
    rules.push(`VÉGAN — INTERDIT (absolu) : toute substance d'origine animale — viande, poisson, fruits de mer, œufs, lait, fromage, beurre, crème, yogourt, miel, gélatine, whey, caséine.
  SUBSTITUTIONS OBLIGATOIRES : lait→lait végétal, beurre→huile de coco/margarine végétale, œufs→aquafaba/lin moulu+eau, fromage→levure nutritionnelle, miel→sirop d'érable/agave, gélatine→agar-agar.`);
  } else if (preferences.includes("vegetarian")) {
    rules.push(`VÉGÉTARIEN — INTERDIT : toute chair animale (viande rouge, volaille, porc, poisson, fruits de mer, crustacés), bouillons de viande, sauces à base de viande.
  AUTORISÉ : œufs, produits laitiers, miel. PROTÉINES : légumineuses, tofu, tempeh, seitan, œufs, fromage.
  ATTENTION : vérifier bouillons et sauces pour viande cachée.`);
  } else if (preferences.includes("flexitarian")) {
    rules.push(`FLEXITARIEN — BASE végétarienne. Maximum 1–2 repas avec viande ou poisson sur la semaine.
  RÈGLE : la viande/poisson = accompagnement ou exhausteur, jamais ingrédient central.
  PROTÉINES PRIVILÉGIÉES : légumineuses, tofu, tempeh, œufs, fromage.`);
  } else if (preferences.includes("pescatarian")) {
    rules.push(`PESCÉTARIEN — INTERDIT : toute chair de mammifère et volaille (bœuf, porc, agneau, veau, poulet, dinde, canard, gibier), bouillon de poulet ou de bœuf.
  AUTORISÉ : poisson, fruits de mer, crevettes, moules, pétoncles, calmars, œufs, produits laitiers.
  PROTÉINES : poisson, fruits de mer, légumineuses, tofu, œufs, fromage.`);
  }
  if (preferences.includes("gluten_free")) {
    rules.push(`SANS GLUTEN — INTERDIT : blé (épeautre, kamut, farro), orge, seigle, avoine non certifiée, couscous, chapelure, pâtes classiques, bière, sauces soja classiques, Worcestershire, vinaigrettes industrielles.
  AUTORISÉ : riz, maïs, sarrasin, tapioca, pomme de terre, farine d'amande, farine de pois chiche, quinoa, tamari certifié sans gluten.`);
  }
  if (preferences.includes("lactose_free")) {
    rules.push(`SANS LACTOSE — INTERDIT : lait de vache/chèvre/brebis, beurre, crème, fromage frais, yogourt ordinaire, crème glacée, lait en poudre, caséine, whey.
  TOLÉRÉ : fromages affinés à pâte dure (parmesan, cheddar vieux, emmental, gruyère).
  SUBSTITUTIONS : lait→boisson végétale, beurre→huile d'olive/margarine sans lactose, crème→crème de coco, yogourt→yogourt végétal.`);
  }
  if (rules.length === 0) return "";
  return `RESTRICTIONS ALIMENTAIRES — règles ABSOLUES PRIORITAIRES (toute violation invalide la réponse entière) :\n${rules.map((r) => `• ${r}`).join("\n")}\n`;
}

function buildVarietyRule4(preferences: string[], n: number): string {
  const isVegan = preferences.includes("vegan");
  const isVeg = preferences.includes("vegetarian");
  const isFlex = preferences.includes("flexitarian");
  const isPesc = preferences.includes("pescatarian");
  if (isVegan || isVeg) {
    return `4. Diversifie les sources de protéines végétales : légumineuses (lentilles, pois chiches, haricots), tofu, tempeh, seitan${isVegan ? "" : ", œufs, fromage"}.`;
  }
  if (isPesc) {
    return `4. OBLIGATOIRE sur ${n} repas : ZÉRO viande/volaille, au moins 2 repas avec poisson ou fruits de mer, reste légumineuses/végétarien.`;
  }
  if (isFlex) {
    return `4. OBLIGATOIRE sur ${n} repas : maximum 1–2 avec viande ou volaille, au moins 1 poisson ou fruits de mer, au moins 2 repas végétariens ou légumineuses.`;
  }
  return `4. OBLIGATOIRE sur ${n} repas : au moins 1 volaille, 1 viande rouge ou porc, 1 poisson ou fruits de mer, 1 plat végétarien ou légumineuses.`;
}

function buildCuisineSection(cuisineStyles: string[]): string {
  const allKeys = Object.keys(CUISINE_INFLUENCES);
  const active = cuisineStyles.length > 0
    ? cuisineStyles
    : [...allKeys].sort(() => Math.random() - 0.5).slice(0, 3);
  const isRandom = cuisineStyles.length === 0;
  const lines = active
    .filter((s) => CUISINE_INFLUENCES[s])
    .map((s) => `• ${CUISINE_INFLUENCES[s].label} — inspiré par : ${CUISINE_INFLUENCES[s].chefs.join(", ")}`)
    .join("\n");

  const mixNote = active.length > 1
    ? `\nMÉLANGE OBLIGATOIRE : les recettes doivent fusionner ces styles — une recette peut combiner les techniques et saveurs de plusieurs styles choisis. Ne génère pas ${active.length} groupes séparés, mélange les influences dans chaque repas.`
    : "";

  return isRandom
    ? `STYLE DE CUISINE — sélection variée aléatoire pour cette semaine (règle absolue) :\n${lines}${mixNote}`
    : `STYLE DE CUISINE — règle absolue, toutes les recettes doivent respecter ces styles :\n${lines}${mixNote}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const admin = adminClient();
    const household = await getHousehold(req, admin);

    // Paywall : 4 premières générations gratuites
    if (household.generation_count >= 4 && !household.is_purchased) {
      return jsonResponse({ error: "purchase_required" }, 402);
    }

    const body = await req.json().catch(() => ({}));
    const weekStart: string = body.week_start_date;
    if (!weekStart) return jsonResponse({ error: "missing_week_start" }, 400);

    // Frigo de la semaine (optionnel)
    const { data: fridge } = await admin
      .from("fridge_snapshots")
      .select("contents")
      .eq("household_id", household.id)
      .eq("week_start_date", weekStart)
      .maybeSingle();

    // Staples disponibles
    const { data: staples } = await admin
      .from("staple_items")
      .select("name")
      .eq("household_id", household.id);

    // Historique 18 semaines
    const eighteenWeeksAgo = new Date(
      new Date(weekStart).getTime() - 18 * 7 * 86_400_000,
    ).toISOString().slice(0, 10);
    const sixWeeksAgo = new Date(
      new Date(weekStart).getTime() - 6 * 7 * 86_400_000,
    ).toISOString().slice(0, 10);
    const twoWeeksAgo = new Date(
      new Date(weekStart).getTime() - 2 * 7 * 86_400_000,
    ).toISOString().slice(0, 10);

    const { data: history } = await admin
      .from("meal_plan_items")
      .select(
        "name, was_regenerated, is_favorited, is_manual, meal_plans!inner(household_id, week_start_date)",
      )
      .eq("meal_plans.household_id", household.id)
      .gte("meal_plans.week_start_date", eighteenWeeksAgo)
      .lt("meal_plans.week_start_date", weekStart);

    const scores = new Map<string, number>();
    // Hard exclusion 6 semaines (recettes normales)
    const recentNames = new Set<string>();
    // Favoris : cooldown réduit à 2 semaines
    const favoritesExcluded = new Set<string>();
    // Soft context semaines 7-18
    const olderNames = new Set<string>();

    for (const row of history ?? []) {
      if (row.is_manual) continue;
      const weekDate = (
        row.meal_plans as unknown as { week_start_date: string }
      ).week_start_date;

      let score = scores.get(row.name) ?? 0;
      if (!row.was_regenerated) score += 1;
      if (row.is_favorited) score += 2;
      scores.set(row.name, score);

      if (weekDate >= sixWeeksAgo) {
        if (row.is_favorited) {
          // Favori exclu seulement si dans les 2 dernières semaines
          if (weekDate >= twoWeeksAgo) favoritesExcluded.add(row.name);
        } else {
          recentNames.add(row.name);
        }
      } else {
        olderNames.add(row.name);
      }
    }

    // Max 2 suggestions de favoris appréciés (respectant le cooldown)
    const popularRecipes = [...scores.entries()]
      .filter(
        ([name, score]) =>
          score > 0 &&
          !recentNames.has(name) &&
          !favoritesExcluded.has(name),
      )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([name]) => name);

    const n = household.meals_per_week;

    const system = `Tu es un assistant culinaire expert générant ${n} soupers savoureux pour une famille de ${household.adults} adultes et ${household.children} enfants.

${buildDietaryRules(household.preferences)}
VARIÉTÉ — règles ABSOLUES (violations = réponse invalide) :
1. INTERDIT : répéter une recette de cette liste (exclues 6 semaines) : ${[...recentNames].join(", ") || "(aucune)"}
2. INTERDIT (favoris, cooldown 2 semaines) : ${[...favoritesExcluded].join(", ") || "(aucun)"}
3. INTERDIT : utiliser la même protéine principale plus d'une fois dans la semaine.
${buildVarietyRule4(household.preferences, n)}
5. INTERDIT : deux recettes avec la même technique principale (deux gratins, deux woks, deux pâtes, etc.).
6. Diversifie les origines culinaires : vise au moins 3 cuisines différentes sur la semaine.
7. INTERDIT : recettes génériques sans identité (poulet rôti au thym, spaghetti bolognaise classique, saumon citron-ail). Chaque recette doit avoir une signature distinctive — une sauce inhabituelle, une épice caractéristique, une technique précise, une combinaison surprenante.
8. INTERDIT : utiliser la même base aromatique plus d'une fois (ail+thym, tomate+basilic, gingembre+sésame, etc.).
9. INTERDIT : le même légume d'accompagnement principal plus de 2 fois dans la semaine.
10. Varie la forme de cuisson : four, poêle, mijoteuse, wok, vapeur, grill — pas deux fois la même méthode dominante.

Contexte semaines 7-18 (évite de trop répéter ces styles) : ${[...olderNames].slice(0, 15).join(", ") || "(aucun)"}

${buildCuisineSection(household.cuisine_styles)}

Contraintes :
- Temps de préparation active : 25 à 50 min
- Titres évocateurs ("Saumon laqué au miso et sésame" plutôt que "Saumon")
- Maximum 5 étapes par recette, concises (1-2 phrases chacune)
- Maximum 10 ingrédients par recette avec quantité précise et unité (g, ml, c. à soupe, pièces…)
- Unités de mesure : ${household.unit_system === "imperial" ? "impériales (oz, lbs, tasses, c. à thé, c. à soupe)" : "métriques (g, ml, L, kg, c. à soupe, c. à thé)"}
- Plats favoris de la famille (inspire-toi, sans copier exactement) : ${household.favorite_dishes.join(", ") || "(aucun)"}
- Frigo disponible : ${fridge?.contents || "(inconnu)"}
- Ingrédients de base disponibles : ${(staples ?? []).map((s) => s.name).join(", ") || "(aucun)"}
- Tu peux inclure au maximum 1 de ces recettes appréciées si elle respecte toutes les règles ci-dessus : ${popularRecipes.join(", ") || "(aucune)"}

Réponds UNIQUEMENT avec un objet JSON valide, sans markdown ni texte autour :
{"meals":[{ "day_index": 0, "day_label": "Lundi", "name": "Poulet rôti au citron et thym", "prep_minutes": 35, "ingredients": [{"name":"cuisses de poulet","quantity":"4","unit":"pièces"}], "steps": ["Préchauffer le four à 200°C."] }]}
day_index : 0=lundi … 6=dimanche. Génère exactement ${n} soupers sur des jours différents. Réponds en ${LANGUAGE_NAMES[household.language]}.`;

    const result = await chatJSON<{ meals: GeneratedMeal[] }>(
      system,
      `Génère le menu de la semaine du ${weekStart}.`,
    );
    const meals = (result.meals ?? []).slice(0, n);
    if (meals.length === 0) throw new Error("claude_empty_response");

    // Upsert du plan de semaine
    const { data: plan, error: planError } = await admin
      .from("meal_plans")
      .upsert(
        { household_id: household.id, week_start_date: weekStart },
        { onConflict: "household_id,week_start_date" },
      )
      .select("id")
      .single();
    if (planError) throw planError;

    await admin.from("meal_plan_items").delete().eq("meal_plan_id", plan.id);

    const { data: insertedItems, error: itemsError } = await admin
      .from("meal_plan_items")
      .insert(
        meals.map((m) => ({
          meal_plan_id: plan.id,
          day_index: Math.min(Math.max(m.day_index, 0), 6),
          name: m.name,
          prep_minutes: m.prep_minutes,
          ingredients: m.ingredients ?? [],
          steps: m.steps ?? [],
        })),
      )
      .select("*");
    if (itemsError) throw itemsError;

    const grocery = await rebuildGroceryList(
      admin,
      household,
      plan.id,
      weekStart,
    );

    await admin
      .from("households")
      .update({ generation_count: household.generation_count + 1 })
      .eq("id", household.id);

    return jsonResponse({
      meal_plan_id: plan.id,
      items: insertedItems,
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
