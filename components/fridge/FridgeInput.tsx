import { TextInput, useColorScheme } from "react-native";
import { t } from "../../lib/i18n";

interface FridgeInputProps {
  value: string;
  onChange: (text: string) => void;
}

export function FridgeInput({ value, onChange }: FridgeInputProps) {
  const isDark = useColorScheme() === "dark";
  return (
    <TextInput
      style={{
        backgroundColor: isDark ? "#1E242C" : "#FFFFFF",
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: isDark ? "#EEF1F4" : "#16201C",
        borderWidth: 1,
        borderColor: isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.08)",
        minHeight: 160,
        textAlignVertical: "top",
      }}
      placeholder={t("fridge.placeholder")}
      placeholderTextColor={isDark ? "#8A95A2" : "#73827B"}
      value={value}
      onChangeText={onChange}
      multiline
      autoFocus
    />
  );
}
