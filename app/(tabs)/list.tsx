import { useMemo, useState } from "react";
import { Pressable, Share, Text, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { SafeAreaView } from "react-native-safe-area-context";
import { GroceryItemRow } from "../../components/grocery/GroceryItemRow";
import { CategoryHeader } from "../../components/grocery/CategoryHeader";
import { AddGroceryItemModal } from "../../components/grocery/AddGroceryItemModal";
import {
  buildShareText,
  useAddGroceryItem,
  useDeleteGroceryItem,
  useGroceryList,
  useToggleGroceryItem,
} from "../../hooks/useGroceryList";
import { formatWeekLabel, getWeekStartISO } from "../../lib/dates";
import { i18n, t } from "../../lib/i18n";
import { useHousehold, getEffectiveTier } from "../../hooks/useHousehold";
import { useAppStore } from "../../stores/useAppStore";
import type { GroceryCategory, GroceryItem } from "../../types/database";

type Row =
  | { type: "listHeader" }
  | { type: "empty" }
  | { type: "categoryHeader"; category: GroceryCategory }
  | { type: "groceryItem"; item: GroceryItem }
  | { type: "checkedItem"; item: GroceryItem }
  | { type: "addItemBottom" };

export default function ListScreen() {
  useAppStore((s) => s.locale); // re-render on language change
  const showPaywall = useAppStore((s) => s.showPaywall);
  const { data: household } = useHousehold();
  const tier = household ? getEffectiveTier(household) : "free";
  const groceryList = useGroceryList();
  const toggleItem = useToggleGroceryItem();
  const deleteItem = useDeleteGroceryItem();
  const addGroceryItem = useAddGroceryItem();
  const [addItemCategory, setAddItemCategory] = useState<GroceryCategory | null>(null);

  const groceryItems = groceryList.data?.items ?? [];

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [{ type: "listHeader" }];

    if (groceryItems.length === 0) {
      out.push({ type: "empty" });
      out.push({ type: "addItemBottom" });
      return out;
    }

    const CATEGORY_ORDER: GroceryCategory[] = ["produce", "bakery", "meat_fish", "dairy", "pantry", "frozen", "other", "staples"];
    const presentCategories = new Set(groceryItems.map((i) => i.category));
    const categoriesInOrder = CATEGORY_ORDER.filter((c) => presentCategories.has(c));

    for (const category of categoriesInOrder) {
      const inCategory = groceryItems.filter((i) => i.category === category);
      const unchecked = inCategory.filter((i) => !i.is_checked);
      const checked = inCategory.filter((i) => i.is_checked);

      out.push({ type: "categoryHeader", category });
      for (const item of unchecked) out.push({ type: "groceryItem", item });
      // Checked items go to the bottom of their own category
      for (const item of checked) out.push({ type: "checkedItem", item });
    }

    out.push({ type: "addItemBottom" });
    return out;
  }, [groceryItems]);

  const shareList = () => {
    const weekLabel = formatWeekLabel(getWeekStartISO(), i18n.locale);
    Share.share({ message: buildShareText(groceryItems, weekLabel) });
  };

  const renderRow = ({ item: row }: { item: Row }) => {
    switch (row.type) {
      case "listHeader":
        return (
          <View className="flex-row items-center justify-between px-5 pt-6 pb-4">
            <Text className="text-2xl text-txt dark:text-txt-d font-brand">
              {t("home.grocerySection")}
            </Text>
            {groceryItems.length > 0 && (
              <Pressable
                onPress={shareList}
                className="py-1.5 px-4 active:opacity-60 bg-surface dark:bg-surface-d rounded-full border border-black/8 dark:border-white/9"
                accessibilityRole="button"
              >
                <Text className="text-sm text-mint dark:text-mint-d font-medium">{t("home.share")} ↗</Text>
              </Pressable>
            )}
          </View>
        );
      case "empty":
        return (
          <View className="px-5 py-12 items-center">
            <Text className="text-base text-muted dark:text-muted-d text-center">
              Génère ton menu pour créer la liste automatiquement.
            </Text>
          </View>
        );
      case "categoryHeader":
        return (
          <CategoryHeader
            category={row.category}
            onAddItem={(c) => setAddItemCategory(c)}
          />
        );
      case "groceryItem":
        return (
          <GroceryItemRow
            item={row.item}
            onToggle={(i) => toggleItem.mutate(i)}
            onDelete={(id) => deleteItem.mutate(id)}
          />
        );
      case "checkedItem":
        return (
          <GroceryItemRow
            item={row.item}
            onToggle={(i) => toggleItem.mutate(i)}
            onDelete={(id) => deleteItem.mutate(id)}
          />
        );
      case "addItemBottom":
        return (
          <Pressable
            onPress={() => (tier === "free" ? showPaywall() : setAddItemCategory("other"))}
            className="px-5 py-4 mb-8 active:opacity-60"
            accessibilityRole="button"
          >
            <Text className="text-base text-mint dark:text-mint-d font-medium">{t("home.addItem")}</Text>
          </Pressable>
        );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-d" edges={["top"]}>
      <FlashList
        data={rows}
        renderItem={renderRow}
        getItemType={(row) => row.type}
        keyExtractor={(row, index) =>
          "item" in row ? `${row.type}-${row.item.id}` : `${row.type}-${index}`
        }
      />
      <AddGroceryItemModal
        visible={addItemCategory !== null}
        initialCategory={addItemCategory ?? "other"}
        adding={addGroceryItem.isPending}
        onClose={() => setAddItemCategory(null)}
        onAdd={(input) => {
          const listId = groceryList.data?.list.id;
          if (!listId) return;
          addGroceryItem.mutate(
            { ...input, listId },
            { onSuccess: () => setAddItemCategory(null) },
          );
        }}
      />
    </SafeAreaView>
  );
}
