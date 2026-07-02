import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { t } from "./i18n";
import { isExpoGo } from "./nativeModules";

const ONESIGNAL_APP_ID = process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID ?? "";

// Chargement paresseux : react-native-onesignal est absent d'Expo Go
function oneSignal(): typeof import("react-native-onesignal").OneSignal | null {
  if (isExpoGo || !ONESIGNAL_APP_ID) return null;
  return require("react-native-onesignal").OneSignal;
}

export type NotificationKind =
  | "fridge"
  | "menu_ready"
  | "list_reminder"
  | "season";

const PREF_KEY = "friyo.notification_prefs";

export async function getNotificationPrefs(): Promise<
  Record<NotificationKind, boolean>
> {
  const raw = await AsyncStorage.getItem(PREF_KEY);
  const defaults = {
    fridge: true,
    menu_ready: true,
    list_reminder: true,
    season: true,
  };
  return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
}

export async function setNotificationPref(kind: NotificationKind, on: boolean) {
  const prefs = await getNotificationPrefs();
  prefs[kind] = on;
  await AsyncStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  // Tags OneSignal pour le ciblage des campagnes côté serveur
  oneSignal()?.User.addTag(`notif_${kind}`, on ? "on" : "off");
  if (kind === "fridge" && !on) {
    await Notifications.cancelScheduledNotificationAsync(FRIDGE_NOTIF_ID).catch(
      () => {},
    );
  }
}

export function initOneSignal(userId: string) {
  const os = oneSignal();
  if (!os) return;
  const { LogLevel } = require("react-native-onesignal");
  os.Debug.setLogLevel(LogLevel.None);
  os.initialize(ONESIGNAL_APP_ID);
  os.login(userId);
  os.Notifications.requestPermission(false);
}

/** Tags utilisés par les campagnes OneSignal (recalcul côté serveur). */
export function syncReminderTags(groceryDay: number, reminderTime: string) {
  oneSignal()?.User.addTags({
    grocery_day: String(groceryDay),
    reminder_time: reminderTime,
  });
}

const FRIDGE_NOTIF_ID = "fridge-weekly";

/**
 * Rappel frigo local hebdomadaire : la veille du jour d'épicerie, à
 * l'heure choisie. Fonctionne hors-ligne ; OneSignal prend le relais
 * pour les campagnes serveur.
 */
export async function scheduleFridgeReminder(
  groceryDay: number, // 0=lundi … 6=dimanche
  reminderTime: string, // "18:00" ou "18:00:00"
) {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") return;

  const prefs = await getNotificationPrefs();
  if (!prefs.fridge) return;

  await Notifications.cancelScheduledNotificationAsync(FRIDGE_NOTIF_ID).catch(
    () => {},
  );

  const dayBefore = (groceryDay + 6) % 7; // veille, 0=lundi
  // expo-notifications : weekday 1=dimanche … 7=samedi
  const weekday = dayBefore === 6 ? 1 : dayBefore + 2;
  const [hour, minute] = reminderTime.split(":").map(Number);

  await Notifications.scheduleNotificationAsync({
    identifier: FRIDGE_NOTIF_ID,
    content: {
      title: t("notifications.fridgeTitle"),
      body: t("notifications.fridgeBody"),
      data: { url: "/fridge-check" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday,
      hour,
      minute,
    },
  });
}
