import { useEffect, useReducer, useState } from "react";
import {
  Alert,
  Appearance,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  useColorScheme,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Chip } from "../../components/ui/Chip";
import { Stepper } from "../../components/ui/Stepper";
import { SectionTitle } from "../../components/ui/SectionTitle";
import { PreferencesPicker } from "../../components/onboarding/PreferencesPicker";
import { CuisineStylePicker } from "../../components/onboarding/CuisineStylePicker";
import { useHousehold, useUpdateHousehold, getEffectiveTier, getTrialDaysLeft } from "../../hooks/useHousehold";
import { setLanguage, t } from "../../lib/i18n";
import { scheduleFridgeReminder, syncReminderTags } from "../../lib/notifications";
import { supabase } from "../../lib/supabase";
import { useAppStore, type ThemePreference } from "../../stores/useAppStore";
import type { AppLocale } from "../../stores/useAppStore";

const FREE_PREFERENCES = ["gluten_free", "lactose_free"] as const;

export default function ProfileScreen() {
  const router = useRouter();
  const { data: household } = useHousehold();
  const update = useUpdateHousehold();
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const setLocale = useAppStore((s) => s.setLocale);
  const showPaywall = useAppStore((s) => s.showPaywall);

  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [simpleQuick, setSimpleQuick] = useState(false);

  useEffect(() => {
    if (household) setSimpleQuick(household.is_simple_quick ?? false);
  }, [household?.is_simple_quick]);

  const isDark = useColorScheme() === "dark";

  if (!household) return <View className="flex-1 bg-canvas dark:bg-canvas-d" />;

  const tier = getEffectiveTier(household);
  const trialDays = getTrialDaysLeft(household);

  const daysShort = t("days.short") as unknown as string[];
  const [hour, minute] = household.reminder_time.split(":").map(Number);
  const timeDate = new Date();
  timeDate.setHours(hour, minute, 0, 0);

  const saveReminder = (day: number, time: string) => {
    update.mutate({ grocery_day: day, reminder_time: time });
    syncReminderTags(day, time);
    scheduleFridgeReminder(day, time).catch(() => {});
  };

  const applyTheme = (pref: ThemePreference) => {
    setTheme(pref);
    AsyncStorage.setItem("friyo.theme", pref);
    Appearance.setColorScheme(pref === "auto" ? null : pref);
  };

  const confirmDelete = () => {
    Alert.alert(t("settings.deleteConfirmTitle"), t("settings.deleteConfirmBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          await supabase.rpc("delete_my_account");
          await supabase.auth.signOut();
          router.replace("/");
        },
      },
    ]);
  };

  return (
    <ScrollView
      className="flex-1 bg-canvas dark:bg-canvas-d"
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text className="text-2xl font-semibold text-txt dark:text-txt-d px-5 pt-6 font-brand">
        {t("settings.title")}
      </Text>

      {/* ── Bannière tier ─────────────────────────────────────────────────────── */}
      {tier === "pro" && trialDays !== null && (
        <View className="mx-5 mt-4 bg-mint/10 border border-mint dark:border-mint-d rounded-2xl px-4 py-3 flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-mint dark:text-mint-d">
            {t("tier.trialActive").replace("{{days}}", String(trialDays))}
          </Text>
          <Pressable onPress={showPaywall} accessibilityRole="button">
            <Text className="text-xs font-medium text-mint dark:text-mint-d">{t("tier.trialUpgrade")}</Text>
          </Pressable>
        </View>
      )}
      {tier === "pro" && trialDays === null && (
        <Pressable
          onPress={showPaywall}
          className="mx-5 mt-4 bg-mint/10 border border-mint dark:border-mint-d rounded-2xl px-4 py-3 flex-row items-center justify-between"
          accessibilityRole="button"
        >
          <Text className="text-sm font-semibold text-mint dark:text-mint-d">{t("tier.proActive")}</Text>
          <Text className="text-xs text-mint dark:text-mint-d">{t("tier.managePlan")}</Text>
        </Pressable>
      )}
      {tier === "free" && (
        <Pressable
          onPress={showPaywall}
          className="mx-5 mt-4 bg-mint/10 border border-mint dark:border-mint-d rounded-2xl px-4 py-3"
          accessibilityRole="button"
        >
          <Text className="text-sm font-semibold text-mint dark:text-mint-d">{t("tier.freeUpgradeTitle")}</Text>
          <Text className="text-xs text-muted dark:text-muted-d mt-0.5">{t("tier.freeUpgradeSubtitle")}</Text>
        </Pressable>
      )}

      {/* ── Foyer ─────────────────────────────────────────────────────────── */}
      <SectionTitle>{t("settings.household")}</SectionTitle>
      <View className="px-5">
        <Stepper
          label={t("onboarding.household.adults")}
          value={household.adults}
          min={1}
          max={4}
          onChange={(adults) => update.mutate({ adults })}
        />
        <Stepper
          label={t("onboarding.household.children")}
          value={household.children}
          min={0}
          max={5}
          onChange={(children) => update.mutate({ children })}
        />
      </View>

      {/* ── Soupers / semaine ─────────────────────────────────────────────── */}
      <SectionTitle>{t("settings.mealsPerWeek")}</SectionTitle>
      <View className="flex-row flex-wrap px-5">
        {[3, 4, 5, 6, 7].map((n) => {
          const locked = tier === "free" && n > 3;
          return (
            <Chip
              key={n}
              label={String(n)}
              selected={household.meals_per_week === n}
              locked={locked}
              onPress={() => (locked ? showPaywall() : update.mutate({ meals_per_week: n }))}
            />
          );
        })}
      </View>

      {/* ── Préférences alimentaires ──────────────────────────────────────── */}
      <SectionTitle>{t("settings.preferences")}</SectionTitle>
      <View className="px-5">
        <PreferencesPicker
          selected={household.preferences}
          onChange={(preferences) => update.mutate({ preferences })}
          freeOptions={tier === "free" ? (FREE_PREFERENCES as unknown as typeof household.preferences) : undefined}
          onLockedPress={showPaywall}
        />
      </View>

      {/* ── Style de cuisine ──────────────────────────────────────────────── */}
      <SectionTitle>{t("settings.cuisineStyles")}</SectionTitle>
      <View className="px-5">
        <CuisineStylePicker
          selected={household.cuisine_styles}
          onChange={(cuisine_styles) => update.mutate({ cuisine_styles })}
          locked={tier === "free"}
          onLockedPress={showPaywall}
        />
      </View>

      {/* ── Recettes simples et rapides ───────────────────────────────────── */}
      <SectionTitle>{t("settings.simpleQuick")}</SectionTitle>
      <View className="flex-row items-center justify-between px-5 py-1">
        <Text className="text-base text-txt dark:text-txt-d flex-1 pr-6">
          {t("settings.simpleQuickDesc")}
        </Text>
        <Switch
          value={simpleQuick}
          onValueChange={(v) => {
            setSimpleQuick(v);
            update.mutate({ is_simple_quick: v });
          }}
          trackColor={{ false: "rgba(115,130,123,0.3)", true: "#10B488" }}
          thumbColor="#fff"
        />
      </View>

      {/* ── Apparence ─────────────────────────────────────────────────────── */}
      <SectionTitle>{t("settings.appearance")}</SectionTitle>
      <View className="flex-row px-5">
        {(["dark", "light"] as ThemePreference[]).map((val) => (
          <Chip
            key={val}
            label={t(val === "dark" ? "settings.themeDark" : "settings.themeLight")}
            selected={theme === val}
            onPress={() => applyTheme(val)}
          />
        ))}
      </View>

      {/* ── Unités de mesure ──────────────────────────────────────────────── */}
      <SectionTitle>{t("settings.unitSystem")}</SectionTitle>
      <View className="flex-row px-5">
        {(["metric", "imperial"] as const).map((unit) => (
          <Chip
            key={unit}
            label={t(unit === "metric" ? "settings.unitMetric" : "settings.unitImperial")}
            selected={(household.unit_system ?? "metric") === unit}
            onPress={() => update.mutate({ unit_system: unit })}
          />
        ))}
      </View>

      {/* ── Langue ────────────────────────────────────────────────────────── */}
      <SectionTitle>{t("settings.language")}</SectionTitle>
      <View className="flex-row px-5">
        {(["fr", "en"] as const).map((lang) => (
          <Chip
            key={lang}
            label={lang === "fr" ? "Français" : "English"}
            selected={household.language === lang}
            onPress={() => {
              setLanguage(lang);
              setLocale(lang as AppLocale);
              AsyncStorage.setItem("friyo.locale", lang);
              update.mutate({ language: lang });
            }}
          />
        ))}
      </View>

      {/* ── Jour & heure d'épicerie ───────────────────────────────────────── */}
      <SectionTitle>{t("settings.groceryDay")}</SectionTitle>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-5">
        {daysShort.map((label, i) => (
          <Chip
            key={label}
            label={label}
            selected={household.grocery_day === i}
            onPress={() => saveReminder(i, household.reminder_time)}
          />
        ))}
      </ScrollView>

      <SectionTitle>{t("settings.reminderTime")}</SectionTitle>
      <View className="px-5">
        <DateTimePicker
          value={timeDate}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          minuteInterval={15}
          onChange={(_, date) => {
            if (!date) return;
            const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
            saveReminder(household.grocery_day, time);
          }}
        />
      </View>

      {/* ── Compte ────────────────────────────────────────────────────────── */}
      <View className="px-5 mt-8 mb-16 gap-4">
        <Pressable
          onPress={() => router.push("/(auth)/login")}
          className="py-2"
          accessibilityRole="button"
        >
          <Text className="text-base text-mint dark:text-mint-d font-medium">
            {t("settings.linkAccount")}
          </Text>
        </Pressable>
        <Pressable onPress={confirmDelete} className="py-2" accessibilityRole="button">
          <Text className="text-base text-error font-medium">
            {t("settings.deleteAccount")}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
