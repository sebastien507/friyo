import { View } from "react-native";
import { Chip } from "../ui/Chip";

interface MealsPerWeekPickerProps {
  value: number;
  onChange: (n: number) => void;
}

export function MealsPerWeekPicker({ value, onChange }: MealsPerWeekPickerProps) {
  return (
    <View className="flex-row flex-wrap mt-4">
      {[3, 4, 5, 6, 7].map((n) => (
        <Chip
          key={n}
          label={String(n)}
          selected={value === n}
          onPress={() => onChange(n)}
        />
      ))}
    </View>
  );
}
