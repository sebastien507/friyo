import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { FridgeInput } from "../components/fridge/FridgeInput";
import { Button } from "../components/ui/Button";
import { useFridgeSnapshot, useSaveFridgeSnapshot } from "../hooks/useFridgeSnapshot";
import { useGenerateMealPlan } from "../hooks/useMealPlan";
import { t } from "../lib/i18n";

export default function FridgeCheck() {
  const router = useRouter();
  const { data: snapshot } = useFridgeSnapshot();
  const saveSnapshot = useSaveFridgeSnapshot();
  const generate = useGenerateMealPlan();
  const [contents, setContents] = useState("");

  useEffect(() => {
    if (snapshot?.contents) setContents(snapshot.contents);
  }, [snapshot]);

  const generateWithFridge = async () => {
    if (contents.trim()) {
      await saveSnapshot.mutateAsync(contents.trim());
    }
    generate.mutate(undefined, {
      onSuccess: () => router.replace("/(tabs)"),
      onError: () => router.replace("/(tabs)"),
    });
  };

  const generateWithout = () => {
    generate.mutate(undefined, {
      onSuccess: () => router.replace("/(tabs)"),
      onError: () => router.replace("/(tabs)"),
    });
  };

  const busy = saveSnapshot.isPending || generate.isPending;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-canvas dark:bg-canvas-d"
    >
      <View className="flex-1 px-5 pt-8">
        <Text className="text-2xl font-semibold text-txt dark:text-txt-d font-brand mb-4">
          {t("fridge.title")}
        </Text>
        <FridgeInput value={contents} onChange={setContents} />
        <View className="mt-6 gap-3">
          <Button
            label={t("fridge.generate")}
            onPress={generateWithFridge}
            loading={busy}
            disabled={!contents.trim()}
          />
          <Pressable onPress={generateWithout} disabled={busy} className="py-2" accessibilityRole="button">
            <Text className="text-center text-base text-muted dark:text-muted-d">
              {t("fridge.skip")}
            </Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
