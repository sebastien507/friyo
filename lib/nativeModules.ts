import Constants from "expo-constants";

/**
 * Expo Go n'embarque pas les modules natifs tiers (react-native-iap,
 * react-native-onesignal). On les charge paresseusement et uniquement
 * dans un dev client / build natif pour ne pas planter au démarrage.
 */
export const isExpoGo = Constants.executionEnvironment === "storeClient";
