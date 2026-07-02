import { useEffect, useRef } from "react";
import { Text, useColorScheme, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAppStore } from "../../stores/useAppStore";
import { t } from "../../lib/i18n";

export default function HomeScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const fgColor = isDark ? "#14181E" : "#F4F7F5";
  const bgColor = isDark ? "#3FE0B6" : "#10B488";
  const sessionReady = useAppStore((s) => s.sessionReady);
  useAppStore((s) => s.locale); // re-render on language change
  const navigated = useRef(false);

  useEffect(() => {
    if (!sessionReady || navigated.current) return;

    let timer: ReturnType<typeof setTimeout>;

    AsyncStorage.getItem("friyo.onboarded").then((onboarded) => {
      if (navigated.current) return;
      navigated.current = true;
      if (!onboarded) {
        router.replace("/(auth)/onboarding");
      } else {
        timer = setTimeout(() => router.navigate("/(tabs)/menu"), 3000);
      }
    });

    return () => clearTimeout(timer);
  }, [sessionReady, router]);

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-d items-center justify-center">
      <View style={{ alignItems: "center", gap: 16 }}>
        {/* Inner column — width = text "friyo" width, logo stretches to match */}
        <View style={{ gap: 12 }}>
          <FridgeMark fgColor={fgColor} bgColor={bgColor} />
          <Text
            className="text-txt dark:text-txt-d font-brand"
            style={{ fontSize: 38, lineHeight: 44 }}
          >
            friyo
          </Text>
        </View>
        <Text style={{ fontSize: 19, fontWeight: "600", color: "#FF8A6B", textAlign: "center" }}>
          {t("splash.tagline1")}{"\n"}{t("splash.tagline2")}
        </Text>
      </View>
    </SafeAreaView>
  );
}

function FridgeMark({ fgColor, bgColor }: { fgColor: string; bgColor: string }) {
  return (
    <View style={{ height: 120, marginHorizontal: 2.5 }}>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: bgColor, borderRadius: 17 }} />
      <View style={{ position: "absolute", top: 34, left: 0, right: 0, height: 4, backgroundColor: fgColor }} />
      <View style={{ position: "absolute", top: 12, right: 6, width: 4, height: 16, borderRadius: 2, backgroundColor: fgColor }} />
      <View style={{ position: "absolute", top: 47, right: 6, width: 4, height: 27, borderRadius: 2, backgroundColor: fgColor }} />
    </View>
  );
}
