import { View } from "react-native";
import { Chip } from "../ui/Chip";
import { t } from "../../lib/i18n";
import type { CuisineStyle } from "../../types/database";

export const ALL_CUISINE_STYLES: CuisineStyle[] = [
  "quebecois",
  "italian",
  "mexican",
  "asian",
  "mediterranean",
  "maghrebin",
  "comfort",
  "light_healthy",
  "bbq",
  "stews_soups",
];

interface CuisineStylePickerProps {
  selected: CuisineStyle[];
  onChange: (styles: CuisineStyle[]) => void;
  locked?: boolean;
  onLockedPress?: () => void;
}

export function CuisineStylePicker({ selected, onChange, locked, onLockedPress }: CuisineStylePickerProps) {
  const toggle = (style: CuisineStyle) => {
    if (selected.includes(style)) {
      onChange(selected.filter((s) => s !== style));
    } else if (selected.length < 3) {
      onChange([...selected, style]);
    }
  };

  return (
    <View className="flex-row flex-wrap mt-4">
      {ALL_CUISINE_STYLES.map((style) => (
        <Chip
          key={style}
          label={t(`cuisineStyles.${style}`)}
          selected={selected.includes(style)}
          locked={locked}
          onPress={() => (locked ? onLockedPress?.() : toggle(style))}
        />
      ))}
    </View>
  );
}
