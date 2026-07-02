import { Pressable, Text, View } from "react-native";
import { t } from "../../lib/i18n";
import type { GroceryCategory } from "../../types/database";

interface CategoryHeaderProps {
  category: GroceryCategory;
  onAddItem: (category: GroceryCategory) => void;
}

export function CategoryHeader({ category, onAddItem }: CategoryHeaderProps) {
  return (
    <View className="flex-row items-center justify-between px-5 pt-6 pb-2">
      <Text className="text-xs font-semibold text-muted dark:text-muted-d uppercase tracking-widest">
        {t(`grocery.categories.${category}`)}
      </Text>
      {category !== "staples" && (
        <Pressable
          onPress={() => onAddItem(category)}
          className="py-1 px-2 active:opacity-60"
          accessibilityRole="button"
        >
          <Text className="text-sm text-mint dark:text-mint-d font-medium">{t("home.addItem")}</Text>
        </Pressable>
      )}
    </View>
  );
}
