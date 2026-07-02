// @refresh reset
import "../global.css";
import { useEffect, useState } from "react";
import { ActivityIndicator, Appearance, useColorScheme, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts, Fredoka_600SemiBold } from "@expo-google-fonts/fredoka";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ensureSession, supabase } from "../lib/supabase";
import { initOneSignal } from "../lib/notifications";
import { setLanguage } from "../lib/i18n";
import { useAppStore, type AppLocale, type ThemePreference } from "../stores/useAppStore";
import { PaywallModal } from "../components/PaywallModal";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Efface toutes les données du foyer en mode développement pour des tests propres. */
async function devReset() {
  try {
    await Promise.all([
      supabase.from("meal_plan_items").delete().not("id", "is", null),
      supabase.from("grocery_items").delete().not("id", "is", null),
      supabase.from("fridge_snapshots").delete().not("id", "is", null),
    ]);
    await Promise.all([
      supabase.from("meal_plans").delete().not("id", "is", null),
      supabase.from("grocery_lists").delete().not("id", "is", null),
    ]);
    await supabase
      .from("households")
      .update({ generation_count: 0 })
      .not("id", "is", null);
  } catch {
    // Non-bloquant — on ignore les erreurs de reset dev
  }
}

export default function RootLayout() {
  const router = useRouter();
  const setSessionReady = useAppStore((s) => s.setSessionReady);
  const setTheme = useAppStore((s) => s.setTheme);
  const setLocale = useAppStore((s) => s.setLocale);
  const [ready, setReady] = useState(false);
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [fontsLoaded] = useFonts({ Fredoka_600SemiBold });
  const isDark = useColorScheme() === "dark";

  // Fresh instance on every remount — clears TanStack cache on dev reload
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, staleTime: 60_000 } },
      }),
  );

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem("friyo.theme"),
      AsyncStorage.getItem("friyo.locale"),
    ]).then(([savedTheme, savedLocale]) => {
      const pref = (savedTheme ?? "dark") as ThemePreference;
      setTheme(pref);
      Appearance.setColorScheme(pref === "auto" ? null : pref);

      if (savedLocale === "en" || savedLocale === "fr") {
        setLocale(savedLocale as AppLocale);
        setLanguage(savedLocale as AppLocale);
      }

      setThemeLoaded(true);
    });
  }, [setTheme, setLocale]);

  useEffect(() => {
    // Reset sessionReady so queries wait for confirmed session after reload
    setSessionReady(false);
    ensureSession()
      .then(async (session) => {
        if (session?.user) initOneSignal(session.user.id);
        // if (__DEV__) await devReset();
        setSessionReady(true);
        queryClient.invalidateQueries();
      })
      .finally(() => setReady(true));
  }, [setSessionReady, queryClient]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const url = resp.notification.request.content.data?.url as string | undefined;
      if (url) router.push(url as never);
    });
    return () => sub.remove();
  }, [router]);

  if (!ready || !fontsLoaded || !themeLoaded) {
    return (
      <View className="flex-1 bg-canvas dark:bg-canvas-d items-center justify-center">
        <ActivityIndicator color="#3FE0B6" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: isDark ? "#14181E" : "#F4F7F5" },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="fridge-check" options={{ presentation: "modal" }} />
        <Stack.Screen name="recipe/[id]" options={{ presentation: "card" }} />
      </Stack>
      <PaywallModal />
    </QueryClientProvider>
  );
}
