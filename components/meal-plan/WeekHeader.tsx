import { Pressable, Text, useColorScheme, View } from "react-native";
import { formatWeekLabel, getWeekStartISO } from "../../lib/dates";
import { i18n, t } from "../../lib/i18n";

interface WeekHeaderProps {
  onRegenerateAll: () => void;
  regenerating: boolean;
}

export function WeekHeader({ onRegenerateAll, regenerating }: WeekHeaderProps) {
  const isDark = useColorScheme() === "dark";
  const weekLabel = formatWeekLabel(getWeekStartISO(), i18n.locale);
  return (
    <View className="flex-row items-center justify-between px-5 pt-6 pb-4">
      <View>
        <Text className="text-2xl text-txt dark:text-txt-d font-brand">Menu</Text>
        <Text className="text-sm text-muted dark:text-muted-d mt-0.5">
          {t("home.weekOf", { date: weekLabel })}
        </Text>
      </View>
      <Pressable
        onPress={onRegenerateAll}
        disabled={regenerating}
        className={`px-4 py-2 rounded-full bg-surface2 dark:bg-surface2-d border border-black/8 dark:border-white/9 ${regenerating ? "opacity-50" : "active:opacity-80"}`}
        accessibilityRole="button"
      >
        <Text className="text-mint dark:text-mint-d text-sm font-semibold">
          {regenerating ? t("common.loading") : t("home.regenerateAll")}
        </Text>
      </Pressable>
    </View>
  );
}
