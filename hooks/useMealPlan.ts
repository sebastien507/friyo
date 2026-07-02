import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";
import { supabase } from "../lib/supabase";
import { DEV_FAST_WEEKS, getWeekStartISO } from "../lib/dates";
import {
  generateMealPlan,
  PurchaseRequiredError,
  regenerateSingleMeal,
} from "../lib/openai";
import { useAppStore } from "../stores/useAppStore";
import type { GroceryCategory, Ingredient, MealPlan, MealPlanItem } from "../types/database";


export interface WeekPlan {
  plan: MealPlan;
  items: MealPlanItem[];
}

export function useMealPlan() {
  const weekStart = getWeekStartISO();
  const sessionReady = useAppStore((s) => s.sessionReady);
  return useQuery({
    queryKey: ["mealPlan", weekStart],
    enabled: sessionReady,
    queryFn: async (): Promise<WeekPlan | null> => {
      const { data: plan, error } = await supabase
        .from("meal_plans")
        .select("*")
        .eq("week_start_date", weekStart)
        .maybeSingle();
      if (error) throw error;
      if (!plan) return null;
      const { data: items, error: itemsError } = await supabase
        .from("meal_plan_items")
        .select("*")
        .eq("meal_plan_id", plan.id)
        .eq("is_archived", false)
        .order("day_index");
      if (itemsError) throw itemsError;
      return { plan, items: items ?? [] };
    },
  });
}

function usePaywallAware() {
  const showPaywall = useAppStore((s) => s.showPaywall);
  return (err: unknown) => {
    if (err instanceof PurchaseRequiredError) {
      showPaywall();
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert("Erreur de génération", msg);
    }
  };
}

function useInvalidateWeek() {
  const queryClient = useQueryClient();
  const weekStart = getWeekStartISO();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["mealPlan", weekStart] });
    queryClient.invalidateQueries({ queryKey: ["groceryList", weekStart] });
  };
}

type ImageResult = { id: string; image_url?: string; error?: string };

function fireImageGeneration(
  itemIds: string[],
  queryClient: QueryClient,
  weekStart: string,
) {
  void (async () => {
    try {
      console.log("[images] invoking generate-all-recipe-images for", itemIds.length, "items");
      const { data, error } = await supabase.functions.invoke<{ results: ImageResult[] }>(
        "generate-all-recipe-images",
        { body: { item_ids: itemIds } },
      );
      if (error) {
        console.error("[images] invoke error:", error);
        return;
      }
      console.log("[images] results:", JSON.stringify(data?.results));
      for (const result of data?.results ?? []) {
        if (!result.image_url) {
          console.warn("[images] no url for", result.id, "→", result.error);
          continue;
        }
        const url = result.image_url;
        queryClient.setQueryData<MealPlanItem | null>(["mealItem", result.id], (old) =>
          old ? { ...old, image_url: url } : old,
        );
        queryClient.setQueryData<WeekPlan | null>(["mealPlan", weekStart], (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((item) =>
              item.id === result.id ? { ...item, image_url: url } : item,
            ),
          };
        });
      }
    } catch (e) {
      console.error("[images] unexpected error:", e);
    }
  })();
}

/** « Régénérer tout » — remplace tous les soupers de la semaine. */
export function useGenerateMealPlan() {
  const invalidate = useInvalidateWeek();
  const onPaywall = usePaywallAware();
  const weekStart = getWeekStartISO();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => generateMealPlan(weekStart),
    onSuccess: (data) => {
      invalidate();
      // Le serveur a effacé le snapshot frigo — on vide le cache local aussi
      queryClient.setQueryData(["fridge", weekStart], null);
      fireImageGeneration((data.items ?? []).map((i) => i.id), queryClient, weekStart);
    },
    onError: onPaywall,
  });
}

/** « Régénérer ce souper » — remplace un seul jour. */
export function useRegenerateSingleMeal() {
  const invalidate = useInvalidateWeek();
  const onPaywall = usePaywallAware();
  const weekStart = getWeekStartISO();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => regenerateSingleMeal(itemId),
    onSuccess: (data) => {
      invalidate();
      if (data?.item?.id) fireImageGeneration([data.item.id], queryClient, weekStart);
    },
    onError: onPaywall,
  });
}

/** « Supprimer » — archive l'item et reconstruit la liste d'épicerie depuis les repas restants. */
export function useRemoveMeal() {
  const invalidate = useInvalidateWeek();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { data: item, error: fetchErr } = await supabase
        .from("meal_plan_items")
        .select("meal_plan_id")
        .eq("id", itemId)
        .single();
      if (fetchErr) throw fetchErr;

      const { error } = await supabase
        .from("meal_plan_items")
        .update({ is_archived: true })
        .eq("id", itemId);
      if (error) throw error;

      const { data: grocery } = await supabase
        .from("grocery_lists")
        .select("id")
        .eq("meal_plan_id", item.meal_plan_id)
        .maybeSingle();
      if (!grocery) return;

      // Mémorise les catégories assignées par Claude avant de vider la liste
      const { data: existing } = await supabase
        .from("grocery_items")
        .select("name, category")
        .eq("grocery_list_id", grocery.id)
        .eq("is_manual", false)
        .eq("is_staple", false);

      const categoryCache = new Map(
        (existing ?? []).map((i) => [i.name.toLowerCase().trim(), i.category])
      );

      // Vide les items auto-générés
      await supabase
        .from("grocery_items")
        .delete()
        .eq("grocery_list_id", grocery.id)
        .eq("is_manual", false)
        .eq("is_staple", false);

      // Repas encore actifs
      const { data: remaining } = await supabase
        .from("meal_plan_items")
        .select("ingredients")
        .eq("meal_plan_id", item.meal_plan_id)
        .eq("is_archived", false);

      type Ing = { name: string; quantity?: string; unit?: string };
      const allIngredients = (remaining ?? []).flatMap(
        (m) => (m.ingredients as Ing[]) ?? []
      );

      // Déduplique par nom (insensible à la casse)
      const deduped = new Map<string, { name: string; quantity: string | null; category: string }>();
      for (const i of allIngredients) {
        const key = i.name.toLowerCase().trim();
        if (!deduped.has(key)) {
          const qty = [i.quantity, i.unit].filter(Boolean).join(" ") || null;
          deduped.set(key, {
            name: i.name,
            quantity: qty,
            category: categoryCache.get(key) ?? "other",
          });
        }
      }

      if (deduped.size > 0) {
        await supabase.from("grocery_items").insert(
          Array.from(deduped.values()).map(({ name, quantity, category }) => ({
            grocery_list_id: grocery.id,
            name,
            quantity,
            category,
            is_manual: false,
            is_staple: false,
          }))
        );
      }
    },
    onSuccess: invalidate,
  });
}

/** Ajout manuel d'un souper (is_manual = true). */
export function useAddManualMeal() {
  const invalidate = useInvalidateWeek();
  const weekStart = getWeekStartISO();
  return useMutation({
    mutationFn: async (input: {
      mealPlanId: string | null;
      dayIndex: number;
      name: string;
      ingredients: Ingredient[];
    }) => {
      let planId = input.mealPlanId;
      if (!planId) {
        const { data: household } = await supabase
          .from("households")
          .select("id")
          .single();
        const { data: plan, error } = await supabase
          .from("meal_plans")
          .upsert(
            { household_id: household!.id, week_start_date: weekStart },
            { onConflict: "household_id,week_start_date" },
          )
          .select("id")
          .single();
        if (error) throw error;
        planId = plan.id as string;
      }
      const { error } = await supabase.from("meal_plan_items").insert({
        meal_plan_id: planId,
        day_index: input.dayIndex,
        name: input.name,
        ingredients: input.ingredients,
        steps: [],
        is_manual: true,
      });
      if (error) throw error;

      // Ajout des ingrédients à l'épicerie côté client (pas de Claude — évite d'échouer)
      if (input.ingredients.length > 0 && planId) {
        const { data: grocery } = await supabase
          .from("grocery_lists")
          .select("id")
          .eq("meal_plan_id", planId)
          .maybeSingle();

        if (grocery) {
          const { data: existing } = await supabase
            .from("grocery_items")
            .select("name")
            .eq("grocery_list_id", grocery.id);

          const existingNames = new Set(
            (existing ?? []).map((i) => i.name.toLowerCase().trim())
          );

          const newRows = input.ingredients
            .filter((i) => i.name.trim() && !existingNames.has(i.name.toLowerCase().trim()))
            .map((i) => ({
              grocery_list_id: grocery.id,
              name: i.name.trim(),
              quantity: [i.quantity, i.unit].filter(Boolean).join(" ") || null,
              category: guessGroceryCategory(i.name),
              is_manual: false,
              is_staple: false,
            }));

          if (newRows.length > 0) {
            await supabase.from("grocery_items").insert(newRows);
          }
        }
      }
    },
    onSuccess: invalidate,
  });
}

function guessGroceryCategory(name: string): GroceryCategory {
  const n = name.toLowerCase();

  // Surgelés en premier — « petits pois surgelés » doit battre produce
  if (/surgelé|congelé|\bfrozen\b|crème glacée|glace (à|au|de)/.test(n)) return "frozen";

  // Boulangerie
  if (/\bpain\b|pain de mie|baguette|brioche|croissant|\bpita\b|\bnaan\b|tortilla|\bwrap\b|chapelure|panko|\bmuffin\b|focaccia|ciabatta|bagel|biscottes|craquelin|galette de riz/.test(n)) return "bakery";

  // Viandes & poissons
  if (/\bpoulet\b|boeuf|porc\b|agneau|dinde|\bveau\b|canard|lapin|lardons|bacon|jambon|saucisse|merguez|chorizo|prosciutto|salami|pepperoni|viande hachée|steak|côtelette|côte de|rôti|saumon|thon\b|tilapia|morue|pangasius|flétan|dorade|truite|sardine|anchois|crevettes|gambas|pétoncles|homard|crabe|moules|calmar|poulpe|fruits de mer|\bpoisson\b|filet de poisson|volaille/.test(n)) return "meat_fish";

  // Produits laitiers
  if (/\blait\b|fromage|yogourt|yaourt|\bcrème\b|crème fraîche|crème sure|crème aigre|\bbeurre\b|\boeufs?\b|ricotta|mozzarella|cheddar|\bfeta\b|parmesan|gruyère|emmental|camembert|\bbrie\b|gorgonzola|gouda|cottage|mascarpone|burrata|halloumi|kéfir|labneh/.test(n)) return "dairy";

  // Fruits & légumes (herbes fraîches incluses)
  if (/tomates?|oignons?|échalote|gousses? d.ail|\bail\b|poivrons?|courgettes?|carottes?|laitue|épinards?|brocoli|choux?(?!-fleur)|choux?-fleur|concombre|avocats?|citrons?|\blime\b|pommes?(?! de terre)|bananes?|oranges?|raisins?|poires?|pêches?|mangues?|ananas|fraises?|framboises?|bleuets?|cerises?|myrtilles?|champignons?|poireaux?|céleris?|fenouil|asperges?|artichauts?|betteraves?|pommes? de terre|patates?|courges?|potirons?|butternut|maïs(?! en)|\bpetits pois\b|haricots? verts?|persil|coriandre|basilic|\bthym\b|romarin|menthe|ciboulette|aneth|roquette|cresson|endives?|aubergines?|navets?|radis|panais|gingembre frais|herbes? fraîches?|légumes? frais|fruits? frais/.test(n)) return "produce";

  // Épicerie sèche
  if (/farine|sucre|cassonade|sel\b|huile d.|huile de|vinaigre|riz\b|quinoa|couscous|boulgour|spaghetti|pâtes\b|penne|fusilli|linguine|tagliatelle|rigatoni|farfalle|\borzo\b|lentilles|pois chiches|haricots? (blancs|noirs|rouges|de Lima)|edamame|bouillon|fond de|conserve|sauce soja|tamari|worcestershire|moutarde|ketchup|mayonnaise|sauce piquante|tabasco|sriracha|\bmiel\b|sirop d.érable|confiture|chocolat|\bcacao\b|café|thé\b|cumin|curcuma|paprika|cannelle|curry|poivre|piment|origan|muscade|cardamome|herbes de provence|noix\b|amandes?|noix de cajou|pistaches?|pacanes?|arachides?|graines? de sésame|graines? de tournesol|graines? de chia|graines? de lin|pignons|levure|bicarbonate|extrait de vanille|concentré de tomate|pesto|tapenade|câpres|olives|raisins? secs|abricots? secs|fécule|amidon|bouillon cube|fond de veau|fond de poulet/.test(n)) return "pantry";

  return "other";
}

/** Cœur sur une recette : signal positif fort + sauvegarde dans favorites. */
export function useToggleFavorite() {
  const invalidate = useInvalidateWeek();
  return useMutation({
    mutationFn: async (item: MealPlanItem) => {
      const next = !item.is_favorited;
      const { error } = await supabase
        .from("meal_plan_items")
        .update({ is_favorited: next })
        .eq("id", item.id);
      if (error) throw error;
      if (next) {
        const { data: user } = await supabase.auth.getUser();
        await supabase.from("favorites").insert({
          user_id: user.user!.id,
          meal_name: item.name,
          meal_data: {
            day_index: item.day_index,
            name: item.name,
            prep_minutes: item.prep_minutes ?? 0,
            ingredients: item.ingredients,
            steps: item.steps,
          },
        });
      } else {
        await supabase.from("favorites").delete().eq("meal_name", item.name);
      }
    },
    onSuccess: invalidate,
  });
}

export function useSavePersonalNote() {
  const invalidate = useInvalidateWeek();
  return useMutation({
    mutationFn: async (input: { itemId: string; note: string }) => {
      const { error } = await supabase
        .from("meal_plan_items")
        .update({ personal_note: input.note || null })
        .eq("id", input.itemId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
