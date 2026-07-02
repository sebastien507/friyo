import { ActivityIndicator, Pressable, Text, useColorScheme } from "react-native";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  loading?: boolean;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
}: ButtonProps) {
  const isDark = useColorScheme() === "dark";
  const base = "h-[52px] rounded-[14px] items-center justify-center px-6";
  const styles = {
    primary: `${base} bg-mint dark:bg-mint-d ${disabled || loading ? "opacity-50" : "active:opacity-80"}`,
    secondary: `${base} bg-surface2 dark:bg-surface2-d ${disabled || loading ? "opacity-50" : "active:opacity-70"}`,
    ghost: `${base} ${disabled || loading ? "opacity-50" : "active:opacity-60"}`,
  };
  const textStyles = {
    primary: "text-canvas dark:text-canvas-d text-base font-semibold",
    secondary: "text-txt dark:text-txt-d text-base font-semibold",
    ghost: "text-mint dark:text-mint-d text-base font-medium",
  };
  return (
    <Pressable
      className={styles[variant]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === "primary"
              ? isDark ? "#14181E" : "#F4F7F5"
              : isDark ? "#3FE0B6" : "#10B488"
          }
        />
      ) : (
        <Text className={textStyles[variant]}>{label}</Text>
      )}
    </Pressable>
  );
}
