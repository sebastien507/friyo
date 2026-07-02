import { supabase } from "./supabase";

export const LIFETIME_PRODUCT_ID = "com.sebastienbire.friyo.lifetime";
export const MONTHLY_PRODUCT_ID = "com.sebastienbire.friyo.pro_monthly";
export const YEARLY_PRODUCT_ID = "com.sebastienbire.friyo.pro_yearly";

export async function purchaseSubscription(_plan: "monthly" | "yearly"): Promise<boolean> {
  throw new Error("iap_coming_soon");
}

export async function restoreSubscription(): Promise<boolean> {
  throw new Error("iap_coming_soon");
}

export async function purchaseLifetime(): Promise<boolean> {
  throw new Error("iap_coming_soon");
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

export async function closeIap() {}
