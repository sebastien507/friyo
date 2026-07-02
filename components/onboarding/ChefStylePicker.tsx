import { Text, View } from "react-native";
import { Chip } from "../ui/Chip";
import { t } from "../../lib/i18n";
import type { ChefStyle } from "../../types/database";

export const ALL_CHEF_STYLES: ChefStyle[] = [
  "ottolenghi",
  "ricardo",
  "jamie_oliver",
  "ina_garten",
  "jennifer_segal",
  "kathryne_taylor",
];

interface ChefStylePickerProps {
  selected: ChefStyle[];
  onChange: (styles: ChefStyle[]) => void;
}

export function ChefStylePicker({ selected, onChange }: ChefStylePickerProps) {
  const toggle = (style: ChefStyle) => {
    if (selected.includes(style)) {
      onChange(selected.filter((s) => s !== style));
    } else {
      onChange([...selected, style]);
    }
  };

  return (
    <View className="mt-4">
      <Text className="text-sm text-muted dark:text-muted-d mb-3">
        {t("onboarding.chefs.hint")}
      </Text>
      <View className="flex-row flex-wrap">
        {ALL_CHEF_STYLES.map((style) => (
          <Chip
            key={style}
            label={t(`chefStyles.${style}`)}
            selected={selected.includes(style)}
            onPress={() => toggle(style)}
          />
        ))}
      </View>
      {selected.length === 0 && (
        <Text className="text-xs text-muted dark:text-muted-d mt-3">
          {t("onboarding.chefs.generic")}
        </Text>
      )}
    </View>
  );
}
