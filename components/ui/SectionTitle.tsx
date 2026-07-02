import { Text } from "react-native";

export function SectionTitle({ children }: { children: string }) {
  return (
    <Text className="text-xs font-semibold text-muted dark:text-muted-d uppercase tracking-widest px-5 pt-6 pb-2">
      {children}
    </Text>
  );
}
