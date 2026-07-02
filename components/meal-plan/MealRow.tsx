import { Pressable, Text, useColorScheme, View } from "react-native";
import { t } from "../../lib/i18n";
import type { MealPlanItem } from "../../types/database";

interface MealRowProps {
  item: MealPlanItem;
  isChecked: boolean;
  onPress: () => void;
  onCheck: () => void;
}

export function MealRow({ item, isChecked, onPress, onCheck }: MealRowProps) {
  const isDark = useColorScheme() === "dark";
  const borderColor = isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.08)";
  const coralBg = isDark ? "rgba(255,138,107,0.12)" : "rgba(255,138,107,0.10)";
  const mintColor = isDark ? "#3FE0B6" : "#10B488";
  const mutedColor = isDark ? "#8A95A2" : "#73827B";
  const canvasColor = isDark ? "#14181E" : "#F4F7F5";

  return (
    <View
      className="bg-surface dark:bg-surface-d rounded-[22px] p-4 flex-row items-center gap-3"
      style={{ borderWidth: 1, borderColor, opacity: isChecked ? 0.55 : 1 }}
    >
      <Pressable
        onPress={onCheck}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isChecked }}
      >
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            borderWidth: isChecked ? 0 : 2,
            borderColor: isChecked ? "transparent" : mutedColor,
            backgroundColor: isChecked ? mintColor : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isChecked && (
            <Text
              style={{
                color: canvasColor,
                fontSize: 13,
                fontWeight: "700",
                lineHeight: 16,
              }}
            >
              ✓
            </Text>
          )}
        </View>
      </Pressable>

      <Pressable className="flex-1 active:opacity-80" onPress={onPress} accessibilityRole="button">
        <Text
          className="text-base font-semibold text-txt dark:text-txt-d font-brand"
          numberOfLines={1}
          style={isChecked ? { textDecorationLine: "line-through" } : undefined}
        >
          {item.name}
        </Text>
        <View className="flex-row items-center gap-2 mt-0.5">
          {item.prep_minutes != null && (
            <Text className="text-xs text-muted dark:text-muted-d">
              {t("common.minutes", { count: item.prep_minutes })}
            </Text>
          )}
          {item.is_manual && (
            <View className="rounded-md px-1.5 py-0.5" style={{ backgroundColor: coralBg }}>
              <Text className="text-[10px] text-coral font-semibold uppercase">Manuel</Text>
            </View>
          )}
          {item.is_favorited && <Text className="text-xs">❤️</Text>}
        </View>
      </Pressable>

      <Text className="text-muted dark:text-muted-d text-lg">›</Text>
    </View>
  );
}
