import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Button } from "../../components/ui/Button";
import { HouseholdSetup } from "../../components/onboarding/HouseholdSetup";
import { MealsPerWeekPicker } from "../../components/onboarding/MealsPerWeekPicker";
import { PreferencesPicker } from "../../components/onboarding/PreferencesPicker";
import { useUpdateHousehold } from "../../hooks/useHousehold";
import { i18n, t } from "../../lib/i18n";
import type { DietaryPreference } from "../../types/database";

const TOTAL_STEPS = 3;

export default function Onboarding() {
  const router = useRouter();
  const updateHousehold = useUpdateHousehold();

  const [step, setStep] = useState(0);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [mealsPerWeek, setMealsPerWeek] = useState(5);
  const [preferences, setPreferences] = useState<DietaryPreference[]>([]);

  const finish = async () => {
    await updateHousehold.mutateAsync({
      adults,
      children,
      meals_per_week: mealsPerWeek,
      preferences,
      grocery_day: 6,
      reminder_time: "18:00",
      language: i18n.locale === "en" ? "en" : "fr",
    });
    await Notifications.requestPermissionsAsync().catch(() => {});
    await AsyncStorage.setItem("friyo.onboarded", "1");
    router.replace("/(tabs)");
  };

  const next = () => {
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
    else finish();
  };

  const skip = () => {
    if (step === 2) setPreferences([]);
    next();
  };

  const titles = [
    t("onboarding.household.title"),
    t("onboarding.meals.title"),
    t("onboarding.preferences.title"),
  ];
  const subtitles = [
    null,
    t("onboarding.meals.subtitle"),
    t("onboarding.preferences.subtitle"),
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-canvas dark:bg-canvas-d"
    >
      <View className="flex-1 px-5 pt-16">
        <View className="flex-row gap-1.5 mb-8">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View
              key={i}
              className={`flex-1 h-1 rounded-full ${i <= step ? "bg-mint dark:bg-mint-d" : "bg-surface2 dark:bg-surface2-d"}`}
            />
          ))}
        </View>

        <Text className="text-2xl font-semibold text-txt dark:text-txt-d">{titles[step]}</Text>
        {subtitles[step] && (
          <Text className="text-base text-muted dark:text-muted-d mt-2">{subtitles[step]}</Text>
        )}

        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
          {step === 0 && (
            <HouseholdSetup
              adults={adults}
              children={children}
              onChangeAdults={setAdults}
              onChangeChildren={setChildren}
            />
          )}
          {step === 1 && <MealsPerWeekPicker value={mealsPerWeek} onChange={setMealsPerWeek} />}
          {step === 2 && <PreferencesPicker selected={preferences} onChange={setPreferences} />}
        </ScrollView>

        <View className="pb-10 gap-3">
          <Button
            label={step === TOTAL_STEPS - 1 ? t("onboarding.finish") : t("common.next")}
            onPress={next}
            loading={updateHousehold.isPending}
          />
          {step === 2 && (
            <Pressable onPress={skip} className="py-2" accessibilityRole="button">
              <Text className="text-center text-base text-muted dark:text-muted-d">
                {t("common.skip")}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
