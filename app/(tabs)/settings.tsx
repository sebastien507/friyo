import { useEffect, useReducer, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Chip } from "../../components/ui/Chip";
import { Stepper } from "../../components/ui/Stepper";
import { SectionTitle } from "../../components/ui/SectionTitle";
import { PreferencesPicker } from "../../components/onboarding/PreferencesPicker";
import { CuisineStylePicker } from "../../components/onboarding/CuisineStylePicker";
import { parseFavoriteDishes } from "../../components/onboarding/FavoriteDishesInput";
import { useHousehold, useUpdateHousehold } from "../../hooks/useHousehold";
import {
  useAddStaple,
  useDeleteStaple,
  useStaples,
  useUpdateStapleFrequency,
} from "../../hooks/useStaples";
import {
  getNotificationPrefs,
  type NotificationKind,
  scheduleFridgeReminder,
  setNotificationPref,
  syncReminderTags,
} from "../../lib/notifications";
import { setLanguage, t } from "../../lib/i18n";
import { supabase } from "../../lib/supabase";

const FREQUENCIES = [1, 2, 4];

export default function Settings() {
  const router = useRouter();
  const { data: household } = useHousehold();
  const update = useUpdateHousehold();
  const staples = useStaples();
  const addStaple = useAddStaple();
  const updateFrequency = useUpdateStapleFrequency();
  const deleteStaple = useDeleteStaple();

  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [favoritesText, setFavoritesText] = useState("");
  const [newStaple, setNewStaple] = useState("");
  const [notifPrefs, setNotifPrefs] = useState<Record<NotificationKind, boolean>>();

  useEffect(() => {
    if (household) setFavoritesText(household.favorite_dishes.join(", "));
  }, [household?.id]);

  useEffect(() => {
    getNotificationPrefs().then(setNotifPrefs);
  }, []);

  if (!household) return <View className="flex-1 bg-cream" />;

  const daysShort = t("days.short") as unknown as string[];
  const [hour, minute] = household.reminder_time.split(":").map(Number);
  const timeDate = new Date();
  timeDate.setHours(hour, minute, 0, 0);

  const saveReminder = (day: number, time: string) => {
    update.mutate({ grocery_day: day, reminder_time: time });
    syncReminderTags(day, time);
    scheduleFridgeReminder(day, time).catch(() => {});
  };

  const toggleNotif = async (kind: NotificationKind, on: boolean) => {
    setNotifPrefs((p) => (p ? { ...p, [kind]: on } : p));
    await setNotificationPref(kind, on);
    if (kind === "fridge" && on) {
      scheduleFridgeReminder(household.grocery_day, household.reminder_time).catch(() => {});
    }
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
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text className="text-2xl font-semibold text-ink px-4 pt-4">
          {t("settings.title")}
        </Text>

        <SectionTitle>{t("settings.household")}</SectionTitle>
        <View className="px-4">
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

        <SectionTitle>{t("settings.mealsPerWeek")}</SectionTitle>
        <View className="flex-row flex-wrap px-4">
          {[3, 4, 5, 6, 7].map((n) => (
            <Chip
              key={n}
              label={String(n)}
              selected={household.meals_per_week === n}
              onPress={() => update.mutate({ meals_per_week: n })}
            />
          ))}
        </View>

        <SectionTitle>{t("settings.preferences")}</SectionTitle>
        <View className="px-4">
          <PreferencesPicker
            selected={household.preferences}
            onChange={(preferences) => update.mutate({ preferences })}
          />
        </View>

        <SectionTitle>{t("settings.favoriteDishes")}</SectionTitle>
        <View className="px-4">
          <TextInput
            className="bg-white rounded-xl px-4 py-3 text-base text-ink border border-softgray min-h-[80px]"
            placeholder={t("onboarding.favorites.placeholder")}
            placeholderTextColor="#9B9B9B"
            value={favoritesText}
            onChangeText={setFavoritesText}
            onEndEditing={() =>
              update.mutate({ favorite_dishes: parseFavoriteDishes(favoritesText) })
            }
            multiline
            textAlignVertical="top"
          />
        </View>

        <SectionTitle>{t("settings.cuisineStyles")}</SectionTitle>
        <View className="px-4">
          <CuisineStylePicker
            selected={household.cuisine_styles}
            onChange={(cuisine_styles) => update.mutate({ cuisine_styles })}
          />
        </View>

        <SectionTitle>{t("settings.groceryDay")}</SectionTitle>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4">
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
        <View className="px-4">
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

        <SectionTitle>{t("settings.staples")}</SectionTitle>
        <View className="px-4">
          <Text className="text-sm text-[#6B6B6B] mb-2">{t("settings.staplesHint")}</Text>
          {(staples.data ?? []).map((staple) => (
            <View key={staple.id} className="flex-row items-center min-h-[52px]">
              <Text className="flex-1 text-base text-ink" numberOfLines={1}>
                {staple.name}
              </Text>
              <Pressable
                onPress={() => {
                  const next =
                    FREQUENCIES[(FREQUENCIES.indexOf(staple.frequency_weeks) + 1) % FREQUENCIES.length];
                  updateFrequency.mutate({ id: staple.id, frequencyWeeks: next });
                }}
                className="px-3 py-1.5 rounded-full bg-softgray mr-2 active:opacity-70"
                accessibilityRole="button"
              >
                <Text className="text-xs text-ink">
                  {t(`settings.stapleFrequency.${staple.frequency_weeks}`)}
                </Text>
              </Pressable>
              <Pressable onPress={() => deleteStaple.mutate(staple.id)} className="p-2" accessibilityRole="button">
                <Text className="text-lg text-[#9B9B9B]">×</Text>
              </Pressable>
            </View>
          ))}
          <View className="flex-row items-center mt-2">
            <TextInput
              className="flex-1 bg-white rounded-xl px-4 h-[44px] text-base text-ink border border-softgray"
              placeholder={t("grocery.itemNamePlaceholder")}
              placeholderTextColor="#9B9B9B"
              value={newStaple}
              onChangeText={setNewStaple}
            />
            <Pressable
              onPress={() => {
                if (!newStaple.trim()) return;
                addStaple.mutate({ name: newStaple.trim(), frequencyWeeks: 1 });
                setNewStaple("");
              }}
              className="ml-2 px-4 h-[44px] rounded-xl bg-primary items-center justify-center active:opacity-80"
              accessibilityRole="button"
            >
              <Text className="text-white font-semibold">{t("common.add")}</Text>
            </Pressable>
          </View>
        </View>

        <SectionTitle>{t("settings.language")}</SectionTitle>
        <View className="flex-row px-4">
          {(["fr", "en"] as const).map((lang) => (
            <Chip
              key={lang}
              label={lang === "fr" ? "Français" : "English"}
              selected={household.language === lang}
              onPress={() => {
                setLanguage(lang);
                update.mutate({ language: lang });
                rerender();
              }}
            />
          ))}
        </View>

        <SectionTitle>{t("settings.notifications")}</SectionTitle>
        <View className="px-4">
          {(
            [
              ["fridge", t("settings.notifFridge")],
              ["menu_ready", t("settings.notifMenuReady")],
              ["list_reminder", t("settings.notifListReminder")],
              ["season", t("settings.notifSeason")],
            ] as [NotificationKind, string][]
          ).map(([kind, label]) => (
            <View key={kind} className="flex-row items-center justify-between min-h-[52px]">
              <Text className="text-base text-ink">{label}</Text>
              <Switch
                value={notifPrefs?.[kind] ?? true}
                onValueChange={(on) => toggleNotif(kind, on)}
                trackColor={{ true: "#1F3A3D" }}
              />
            </View>
          ))}
        </View>

        <View className="px-4 mt-8 mb-16 gap-4">
          <Pressable onPress={() => router.push("/(auth)/login")} className="py-2" accessibilityRole="button">
            <Text className="text-base text-primary font-medium">
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
    </SafeAreaView>
  );
}
