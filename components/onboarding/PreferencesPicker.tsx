import { View } from "react-native";
import { Chip } from "../ui/Chip";
import { t } from "../../lib/i18n";
import type { DietaryPreference } from "../../types/database";

const ALL_PREFERENCES: DietaryPreference[] = [
  "vegetarian",
  "flexitarian",
  "pescatarian",
  "vegan",
  "gluten_free",
  "lactose_free",
];

interface PreferencesPickerProps {
  selected: DietaryPreference[];
  onChange: (prefs: DietaryPreference[]) => void;
  freeOptions?: DietaryPreference[];
  onLockedPress?: () => void;
}

export function PreferencesPicker({ selected, onChange, freeOptions, onLockedPress }: PreferencesPickerProps) {
  const toggle = (pref: DietaryPreference) => {
    if (selected.includes(pref)) {
      onChange(selected.filter((p) => p !== pref));
    } else if (selected.length < 3) {
      onChange([...selected, pref]);
    }
  };

  return (
    <View className="flex-row flex-wrap mt-4">
      {ALL_PREFERENCES.map((pref) => {
        const locked = freeOptions !== undefined && !freeOptions.includes(pref);
        return (
          <Chip
            key={pref}
            label={t(`onboarding.preferences.options.${pref}`)}
            selected={selected.includes(pref)}
            locked={locked}
            onPress={() => (locked ? onLockedPress?.() : toggle(pref))}
          />
        );
      })}
    </View>
  );
}
