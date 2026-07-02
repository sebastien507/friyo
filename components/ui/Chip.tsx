import { Pressable, Text } from "react-native";

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  highlighted?: boolean;
  locked?: boolean;
}

export function Chip({ label, selected, onPress, highlighted, locked }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={{ opacity: locked ? 0.45 : 1 }}
      className={`px-4 py-2.5 rounded-full border mr-2 mb-2 ${
        selected
          ? "bg-mint/20 border-mint dark:bg-mint-d/20 dark:border-mint-d"
          : highlighted
            ? "bg-coral/10 border-coral"
            : "bg-surface border-black/8 dark:bg-surface-d dark:border-white/9"
      }`}
    >
      <Text
        className={`text-sm font-medium ${
          selected ? "text-mint dark:text-mint-d" : "text-txt dark:text-txt-d"
        }`}
      >
        {label}{locked ? " Pro" : ""}
      </Text>
    </Pressable>
  );
}
