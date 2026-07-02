import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useHousehold } from "../hooks/useHousehold";

export default function Index() {
  const { data: household, isLoading } = useHousehold();

  if (isLoading) {
    return (
      <View className="flex-1 bg-canvas dark:bg-canvas-d items-center justify-center">
        <ActivityIndicator color="#3FE0B6" />
      </View>
    );
  }

  return household ? (
    <Redirect href="/(tabs)" />
  ) : (
    <Redirect href="/(auth)/onboarding" />
  );
}
