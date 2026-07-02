import { Pressable, Text, useColorScheme, View } from "react-native";

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

export function Stepper({ label, value, min, max, onChange }: StepperProps) {
  const isDark = useColorScheme() === "dark";
  const textColor = isDark ? "#EEF1F4" : "#16201C";
  const btnBg = isDark ? "#28313B" : "#EEF3F0";

  return (
    <View className="flex-row items-center justify-between py-4">
      <Text style={{ fontSize: 16, fontWeight: "500", color: textColor }}>{label}</Text>
      <View className="flex-row items-center">
        <Pressable
          onPress={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: btnBg,
            alignItems: "center", justifyContent: "center",
            opacity: value <= min ? 0.4 : 1,
          }}
          accessibilityRole="button"
          accessibilityLabel={`${label} -`}
        >
          <Text style={{ fontSize: 20, color: textColor }}>−</Text>
        </Pressable>
        <Text style={{ width: 48, textAlign: "center", fontSize: 18, fontWeight: "600", color: textColor }}>
          {value}
        </Text>
        <Pressable
          onPress={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: btnBg,
            alignItems: "center", justifyContent: "center",
            opacity: value >= max ? 0.4 : 1,
          }}
          accessibilityRole="button"
          accessibilityLabel={`${label} +`}
        >
          <Text style={{ fontSize: 20, color: textColor }}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}
