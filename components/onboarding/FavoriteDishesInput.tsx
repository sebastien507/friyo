import { TextInput, useColorScheme } from "react-native";
import { t } from "../../lib/i18n";

interface FavoriteDishesInputProps {
  value: string;
  onChange: (text: string) => void;
}

export function FavoriteDishesInput({ value, onChange }: FavoriteDishesInputProps) {
  const isDark = useColorScheme() === "dark";
  return (
    <TextInput
      style={{
        backgroundColor: isDark ? "#1E242C" : "#FFFFFF",
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginTop: 16,
        fontSize: 16,
        color: isDark ? "#EEF1F4" : "#16201C",
        borderWidth: 1,
        borderColor: isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.08)",
        minHeight: 120,
        textAlignVertical: "top",
      }}
      placeholder={t("onboarding.favorites.placeholder")}
      placeholderTextColor={isDark ? "#8A95A2" : "#9B9B9B"}
      value={value}
      onChangeText={onChange}
      multiline
      textAlignVertical="top"
    />
  );
}

export function parseFavoriteDishes(text: string): string[] {
  return text
    .split(/[,\n;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
