import { useEffect, useMemo, useReducer, useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, View, useColorScheme } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { WeekHeader } from "../../components/meal-plan/WeekHeader";
import { MealRow } from "../../components/meal-plan/MealRow";
import { SwipeableRow } from "../../components/meal-plan/SwipeableRow";
import { AddMealModal } from "../../components/meal-plan/AddMealModal";
import { SkeletonRows } from "../../components/ui/Skeleton";
import { Button } from "../../components/ui/Button";
import {
  useAddManualMeal,
  useGenerateMealPlan,
  useMealPlan,
  useRegenerateSingleMeal,
  useRemoveMeal,
} from "../../hooks/useMealPlan";
import { t } from "../../lib/i18n";
import { DEV_FAST_WEEKS } from "../../lib/dates";
import { useHousehold, getEffectiveTier } from "../../hooks/useHousehold";
import { useAppStore } from "../../stores/useAppStore";
import type { MealPlanItem } from "../../types/database";

type Row =
  | { type: "weekHeader" }
  | { type: "skeleton" }
  | { type: "fridgeCta" }
  | { type: "empty" }
  | { type: "meal"; item: MealPlanItem }
  | { type: "addMeal" };

export default function MenuScreen() {
  const router = useRouter();
  // DEV: force re-render toutes les 5s pour que getWeekStartISO() soit réévalué
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!DEV_FAST_WEEKS) return;
    const id = setInterval(tick, 5_000);
    return () => clearInterval(id);
  }, []);

  const mealPlan = useMealPlan();
  const generateAll = useGenerateMealPlan();
  const addMeal = useAddManualMeal();
  const regenerate = useRegenerateSingleMeal();
  const removeMeal = useRemoveMeal();
  const [addMealVisible, setAddMealVisible] = useState(false);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  useAppStore((s) => s.locale); // re-render on language change
  const showPaywall = useAppStore((s) => s.showPaywall);
  const { data: household } = useHousehold();
  const tier = household ? getEffectiveTier(household) : "free";
  const isDark = useColorScheme() === "dark";
  const generating = generateAll.isPending;
  const items = mealPlan.data?.items ?? [];

  const sortedItems = useMemo(() => {
    const unchecked = items.filter((i) => !doneIds.has(i.id));
    const checked = items.filter((i) => doneIds.has(i.id));
    return [...unchecked, ...checked];
  }, [items, doneIds]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [{ type: "weekHeader" }];
    if (generating) {
      out.push({ type: "skeleton" });
      return out;
    }
    out.push({ type: "fridgeCta" });
    if (!mealPlan.data || sortedItems.length === 0) {
      out.push({ type: "empty" });
      return out;
    }
    for (const item of sortedItems) out.push({ type: "meal", item });
    out.push({ type: "addMeal" });
    return out;
  }, [generating, mealPlan.data, sortedItems]);

  const toggleDone = (id: string) =>
    setDoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const renderRow = ({ item: row }: { item: Row }) => {
    switch (row.type) {
      case "weekHeader":
        return (
          <WeekHeader
            onRegenerateAll={() => generateAll.mutate()}
            regenerating={generating}
          />
        );
      case "skeleton":
        return (
          <View className="py-2">
            <SkeletonRows count={6} />
            <Text className="text-center text-sm text-muted dark:text-muted-d mt-3">
              {t("home.generating")}
            </Text>
          </View>
        );
      case "fridgeCta":
        return (
          <Pressable
            onPress={() => router.push("/fridge-check")}
            className="mx-5 mb-4 bg-mint dark:bg-mint-d rounded-[14px] h-[52px] items-center justify-center active:opacity-80"
            accessibilityRole="button"
          >
            <Text className="text-canvas dark:text-canvas-d text-base font-semibold">
              {t("fridge.ctaButton")}
            </Text>
          </Pressable>
        );
      case "empty":
        return (
          <View className="px-5 py-8 items-center">
            <Text className="text-base text-muted dark:text-muted-d mb-6 text-center">
              {t("home.emptyTitle")}
            </Text>
            <View className="self-stretch">
              <Button label={t("home.emptyCta")} onPress={() => generateAll.mutate()} />
            </View>
          </View>
        );
      case "meal":
        return (
          <SwipeableRow
            onRegenerate={() => regenerate.mutate(row.item.id)}
            onRemove={() => removeMeal.mutate(row.item.id)}
          >
            <MealRow
              item={row.item}
              isChecked={doneIds.has(row.item.id)}
              onPress={() => router.push(`/recipe/${row.item.id}`)}
              onCheck={() => toggleDone(row.item.id)}
            />
          </SwipeableRow>
        );
      case "addMeal":
        return (
          <Pressable
            onPress={() => (tier === "free" ? showPaywall() : setAddMealVisible(true))}
            className="px-5 py-3 active:opacity-60"
            accessibilityRole="button"
          >
            <Text className="text-base text-mint dark:text-mint-d font-medium">
              {t("home.addMeal")}
            </Text>
          </Pressable>
        );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-d" edges={["top"]}>
      {/* Modal de chargement pendant la régénération d'une recette */}
      <Modal visible={regenerate.isPending} transparent animationType="fade" statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" }}>
          <View
            style={{
              backgroundColor: isDark ? "#1C2128" : "#FFFFFF",
              borderRadius: 18,
              padding: 28,
              alignItems: "center",
              gap: 14,
              minWidth: 220,
              shadowColor: "#000",
              shadowOpacity: 0.25,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
            }}
          >
            <ActivityIndicator size="large" color={isDark ? "#3FE0B6" : "#10B488"} />
            <Text style={{ color: isDark ? "#E8EDF2" : "#1A2420", fontSize: 15, fontWeight: "600", textAlign: "center" }}>
              {t("meal.regenerating")}
            </Text>
          </View>
        </View>
      </Modal>
      <FlashList
        data={rows}
        renderItem={renderRow}
        estimatedItemSize={80}
        getItemType={(row) => row.type}
        keyExtractor={(row, index) =>
          "item" in row ? `${row.type}-${row.item.id}` : `${row.type}-${index}`
        }
      />
      <AddMealModal
        visible={addMealVisible}
        takenDays={items.map((i) => i.day_index)}
        adding={addMeal.isPending}
        onClose={() => setAddMealVisible(false)}
        onAdd={(input) =>
          addMeal.mutate(
            { ...input, mealPlanId: mealPlan.data?.plan.id ?? null },
            { onSuccess: () => setAddMealVisible(false) },
          )
        }
      />
    </SafeAreaView>
  );
}
