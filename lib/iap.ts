import { supabase } from "./supabase";
import { isExpoGo } from "./nativeModules";

export const LIFETIME_PRODUCT_ID = "com.friyo.app.lifetime";
export const MONTHLY_PRODUCT_ID = "com.friyo.app.pro_monthly";
export const YEARLY_PRODUCT_ID = "com.friyo.app.pro_yearly";

// Chargement paresseux : react-native-iap est absent d'Expo Go
function iap(): typeof import("react-native-iap") | null {
  if (isExpoGo) return null;
  return require("react-native-iap");
}

/**
 * Abonnement mensuel (4,99 $/mois) ou annuel (39,99 $/an).
 * Après succès, is_purchased est mis à jour dans Supabase.
 */
export async function purchaseSubscription(plan: "monthly" | "yearly"): Promise<boolean> {
  const mod = iap();
  if (!mod) throw new Error("iap_unavailable_in_expo_go");
  await mod.initConnection();
  const sku = plan === "monthly" ? MONTHLY_PRODUCT_ID : YEARLY_PRODUCT_ID;
  const purchase = await mod.requestSubscription({ sku });
  const single = Array.isArray(purchase) ? purchase[0] : purchase;
  if (!single) return false;
  await mod.finishTransaction({ purchase: single, isConsumable: false });
  await markPurchased();
  return true;
}

/** Restaure un abonnement ou l'achat unique depuis l'historique App Store. */
export async function restoreSubscription(): Promise<boolean> {
  const mod = iap();
  if (!mod) throw new Error("iap_unavailable_in_expo_go");
  await mod.initConnection();
  const purchases = await mod.getAvailablePurchases();
  const owned = purchases.some((p) =>
    [LIFETIME_PRODUCT_ID, MONTHLY_PRODUCT_ID, YEARLY_PRODUCT_ID].includes(p.productId),
  );
  if (owned) await markPurchased();
  return owned;
}

/** @deprecated Utiliser purchaseSubscription à la place. */
export async function purchaseLifetime(): Promise<boolean> {
  const mod = iap();
  if (!mod) throw new Error("iap_unavailable_in_expo_go");
  await mod.initConnection();
  const purchase = await mod.requestPurchase({ sku: LIFETIME_PRODUCT_ID });
  const single = Array.isArray(purchase) ? purchase[0] : purchase;
  if (!single) return false;
  await mod.finishTransaction({ purchase: single, isConsumable: false });
  await markPurchased();
  return true;
}

export async function markPurchased() {
  const { data: household } = await supabase
    .from("households")
    .select("id")
    .single();
  await supabase
    .from("households")
    .update({ is_purchased: true })
    .eq("id", household!.id);
}

export async function closeIap() {
  await iap()?.endConnection().catch(() => {});
}
