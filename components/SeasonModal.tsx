import { useState } from "react";
import { Modal, Text, View } from "react-native";
import { Button } from "./ui/Button";
import { Chip } from "./ui/Chip";
import { t } from "../lib/i18n";
import { useSeasonPrompt } from "../hooks/useSeasonPrompt";
import type { CuisineStyle } from "../types/database";

const ALL_STYLES: CuisineStyle[] = [
  "quebecois",
  "italian",
  "mexican",
  "asian",
  "mediterranean",
  "comfort",
  "light_healthy",
  "bbq",
  "stews_soups",
];

export function SeasonModal() {
  const { shouldShow, season, suggestions, currentStyles, dismiss } =
    useSeasonPrompt();
  const [styles, setStyles] = useState<CuisineStyle[]>(currentStyles);
  const [touched, setTouched] = useState(false);

  if (!shouldShow) return null;
  const selected = touched ? styles : currentStyles;

  const toggle = (style: CuisineStyle) => {
    setTouched(true);
    const base = touched ? styles : currentStyles;
    if (base.includes(style)) {
      setStyles(base.filter((s) => s !== style));
    } else if (base.length < 3) {
      setStyles([...base, style]);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => dismiss()}>
      <View className="flex-1 bg-canvas dark:bg-canvas-d px-5 pt-8">
        <Text className="text-2xl font-semibold text-txt dark:text-txt-d">
          {t("season.title", {
            season: t(`season.names.${season}`),
            emoji: t(`season.emojis.${season}`),
          })}
        </Text>
        <Text className="text-base text-txt dark:text-txt-d mt-2">{t("season.subtitle")}</Text>
        <Text className="text-sm text-muted dark:text-muted-d mt-5 mb-2">
          {t("season.suggested")}
        </Text>
        <View className="flex-row flex-wrap">
          {ALL_STYLES.map((style) => (
            <Chip
              key={style}
              label={t(`cuisineStyles.${style}`)}
              selected={selected.includes(style)}
              highlighted={suggestions.includes(style)}
              onPress={() => toggle(style)}
            />
          ))}
        </View>
        <View className="mt-auto pb-8 gap-3">
          <Button
            label={t("season.update")}
            onPress={() => dismiss(selected)}
            disabled={!touched}
          />
          <Button
            label={t("season.keep")}
            variant="ghost"
            onPress={() => dismiss()}
          />
        </View>
      </View>
    </Modal>
  );
}
