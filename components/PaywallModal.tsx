import { useState } from "react";
import { Alert, Modal, ScrollView, Text, TouchableOpacity, useColorScheme, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { t } from "../lib/i18n";
import { purchaseSubscription, restoreSubscription } from "../lib/iap";
import { useHousehold, useUpdateHousehold } from "../hooks/useHousehold";
import { useAppStore } from "../stores/useAppStore";

export function PaywallModal() {
  const visible = useAppStore((s) => s.paywallVisible);
  const hidePaywall = useAppStore((s) => s.hidePaywall);
  const selectedPlan = useAppStore((s) => s.paywallPlan);
  const setSelectedPlan = useAppStore((s) => s.setPaywallPlan);
  const billingCycle = useAppStore((s) => s.paywallCycle);
  const setBillingCycle = useAppStore((s) => s.setPaywallCycle);
  const queryClient = useQueryClient();
  const { data: household } = useHousehold();
  const updateHousehold = useUpdateHousehold();
  const [buying, setBuying] = useState(false);
  const isDark = useColorScheme() === "dark";

  const MINT = isDark ? "#3FE0B6" : "#10B488";
  const BORDER_DEFAULT = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)";
  const SURFACE = isDark ? "#1E242C" : "#FFFFFF";
  const CANVAS = isDark ? "#14181E" : "#F4F7F5";
  const TXT = isDark ? "#EEF1F4" : "#16201C";
  const MUTED = isDark ? "rgba(238,241,244,0.45)" : "rgba(22,32,28,0.45)";

  const buy = async () => {
    setBuying(true);
    try {
      const ok = await purchaseSubscription(billingCycle);
      if (ok) {
        queryClient.invalidateQueries({ queryKey: ["household"] });
        hidePaywall();
      }
    } catch {
      Alert.alert(t("common.error"));
    } finally {
      setBuying(false);
    }
  };

  const restore = async () => {
    setBuying(true);
    try {
      const ok = await restoreSubscription();
      if (ok) {
        queryClient.invalidateQueries({ queryKey: ["household"] });
        hidePaywall();
      } else {
        Alert.alert(t("common.error"));
      }
    } catch {
      Alert.alert(t("common.error"));
    } finally {
      setBuying(false);
    }
  };

  const handleContinueFree = async () => {
    const now = new Date().toISOString();
    const isPro =
      household?.is_purchased ||
      (household?.trial_ends_at != null && household.trial_ends_at > now);
    if (isPro) {
      // Fin de l'essai ou reset du statut Pro (restore possible via "Restaurer mon abonnement")
      await updateHousehold.mutateAsync({
        trial_ends_at: now,
        is_purchased: false,
      });
    }
    hidePaywall();
  };

  const freeIncluded = t("paywall.freeIncluded") as unknown as string[];
  const freeLocked = t("paywall.freeLocked") as unknown as string[];
  const proFeatures = t("paywall.proFeatures") as unknown as string[];
  const proPrice = billingCycle === "yearly" ? t("paywall.yearlyPrice") : t("paywall.monthlyPrice");

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={hidePaywall}
      statusBarTranslucent
    >
      {/*
        Structure colonne simple : zone sombre en haut (flex:1) + sheet en bas.
        Aucun chevauchement absolu → aucun conflit de touch.
      */}
      <View style={{ flex: 1 }}>
        {/* Zone sombre au-dessus du sheet — tap pour fermer */}
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", minHeight: 60 }}
          activeOpacity={1}
          onPress={hidePaywall}
        />

        {/* Sheet */}
        <View style={{ backgroundColor: CANVAS, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 48 }}
          >
            {/* Drag handle */}
            <View style={{ width: 40, height: 4, backgroundColor: SURFACE, borderRadius: 2, alignSelf: "center", marginBottom: 24 }} />

            <Text style={{ fontSize: 22, fontWeight: "600", color: TXT, textAlign: "center", marginBottom: 24 }}>
              {t("paywall.planTitle")}
            </Text>

            {/* ── Sélecteur de plan ────────────────────────────────────────────── */}
            <View style={{ flexDirection: "row", marginBottom: 20 }}>
              <TouchableOpacity
                onPress={() => setSelectedPlan("free")}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  marginRight: 6,
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 2,
                  borderColor: selectedPlan === "free" ? MINT : BORDER_DEFAULT,
                  backgroundColor: selectedPlan === "free" ? `${MINT}18` : "transparent",
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: TXT }}>{t("paywall.planFree")}</Text>
                <Text style={{ fontSize: 20, fontWeight: "700", color: TXT, marginTop: 4 }}>{t("paywall.planFreePrice")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setSelectedPlan("pro")}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  marginLeft: 6,
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 2,
                  borderColor: selectedPlan === "pro" ? MINT : BORDER_DEFAULT,
                  backgroundColor: selectedPlan === "pro" ? `${MINT}18` : "transparent",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: TXT }}>{t("paywall.planPro")}</Text>
                  <View style={{ backgroundColor: MINT, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: CANVAS }}>{t("paywall.planProBadge")}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 20, fontWeight: "700", color: MINT, marginTop: 4 }}>{proPrice}</Text>
                {billingCycle === "yearly" && (
                  <Text style={{ fontSize: 11, color: MINT }}>{t("paywall.yearlySave")}</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* ── Toggle mensuel / annuel (Pro seulement) ──────────────────────── */}
            {selectedPlan === "pro" && (
              <View style={{ flexDirection: "row", backgroundColor: SURFACE, borderRadius: 12, padding: 4, marginBottom: 20 }}>
                {(["monthly", "yearly"] as const).map((cycle) => (
                  <TouchableOpacity
                    key={cycle}
                    onPress={() => setBillingCycle(cycle)}
                    activeOpacity={0.7}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      borderRadius: 10,
                      alignItems: "center",
                      backgroundColor: billingCycle === cycle ? `${MINT}30` : "transparent",
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "500", color: billingCycle === cycle ? MINT : MUTED }}>
                      {t(`paywall.${cycle}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* ── Liste de fonctionnalités ──────────────────────────────────────── */}
            <View style={{ gap: 10, marginBottom: 24 }}>
              {selectedPlan === "free" ? (
                <>
                  {freeIncluded.map((f, i) => (
                    <Text key={`inc-${i}`} style={{ fontSize: 14, color: TXT }}>✓ {f}</Text>
                  ))}
                  {freeLocked.map((f, i) => (
                    <Text key={`loc-${i}`} style={{ fontSize: 14, color: MUTED }}>✗ {f}</Text>
                  ))}
                </>
              ) : (
                proFeatures.map((f, i) => (
                  <Text key={i} style={{ fontSize: 14, color: TXT }}>✓ {f}</Text>
                ))
              )}
            </View>

            {/* ── CTA ──────────────────────────────────────────────────────────── */}
            <TouchableOpacity
              onPress={selectedPlan === "free" ? handleContinueFree : buy}
              disabled={buying}
              activeOpacity={0.8}
              style={{
                paddingVertical: 16,
                borderRadius: 16,
                alignItems: "center",
                backgroundColor: selectedPlan === "pro" ? MINT : SURFACE,
                borderWidth: selectedPlan === "free" ? 1 : 0,
                borderColor: BORDER_DEFAULT,
                marginBottom: 4,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "600", color: selectedPlan === "pro" ? CANVAS : TXT }}>
                {selectedPlan === "free" ? t("paywall.ctaFree") : t("paywall.ctaPro")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={restore} disabled={buying} style={{ paddingVertical: 14, alignItems: "center" }}>
              <Text style={{ fontSize: 13, color: MINT, fontWeight: "500" }}>{t("paywall.restore")}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={hidePaywall} style={{ paddingVertical: 10, alignItems: "center" }}>
              <Text style={{ fontSize: 13, color: MUTED }}>{t("common.cancel")}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
