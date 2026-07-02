import { Pressable, Text, useColorScheme, View } from "react-native";
import type { GroceryItem } from "../../types/database";

function formatQty(qty: string | null): string {
  if (!qty || qty.trim() === "") return "x1";
  const pieceMatch = qty.match(/^(\d+)\s*(pièce|pièces|piece|pieces|pc|pcs|unité|unités|unit|units)$/i);
  if (pieceMatch) return `x${pieceMatch[1]}`;
  const numOnly = qty.match(/^(\d+)$/);
  if (numOnly) return `x${numOnly[1]}`;
  return `(${qty})`;
}

interface GroceryItemRowProps {
  item: GroceryItem;
  onToggle: (item: GroceryItem) => void;
  onDelete: (id: string) => void;
}

export function GroceryItemRow({ item, onToggle, onDelete }: GroceryItemRowProps) {
  const isDark = useColorScheme() === "dark";
  const uncheckedBorder = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)";

  return (
    <View className="flex-row items-center px-5 min-h-[52px]">
      <Pressable
        onPress={() => onToggle(item)}
        className="flex-row items-center flex-1 py-2"
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.is_checked }}
      >
        <View
          className={`w-6 h-6 rounded-lg items-center justify-center mr-3.5 ${
            item.is_checked ? "bg-mint dark:bg-mint-d" : "bg-surface2 dark:bg-surface2-d"
          }`}
          style={item.is_checked ? {} : { borderWidth: 1, borderColor: uncheckedBorder }}
        >
          {item.is_checked && (
            <Text className="text-canvas dark:text-canvas-d text-xs font-bold">✓</Text>
          )}
        </View>
        <Text
          className={`flex-1 text-base ${
            item.is_checked ? "text-muted dark:text-muted-d line-through" : "text-txt dark:text-txt-d"
          }`}
          numberOfLines={1}
        >
          {item.name}
          {" "}{formatQty(item.quantity)}{item.is_manual ? "  ✏️" : ""}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => onDelete(item.id)}
        className="p-2 ml-1"
        accessibilityRole="button"
        accessibilityLabel={`Supprimer ${item.name}`}
      >
        <Text className="text-lg text-muted dark:text-muted-d">×</Text>
      </Pressable>
    </View>
  );
}
