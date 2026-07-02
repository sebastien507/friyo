import { create } from "zustand";

export type ThemePreference = "dark" | "light" | "auto";
export type AppLocale = "en" | "fr";

type PaywallPlan = "free" | "pro";
type PaywallCycle = "monthly" | "yearly";

interface AppState {
  sessionReady: boolean;
  setSessionReady: (ready: boolean) => void;
  paywallVisible: boolean;
  paywallPlan: PaywallPlan;
  paywallCycle: PaywallCycle;
  showPaywall: () => void;
  hidePaywall: () => void;
  setPaywallPlan: (plan: PaywallPlan) => void;
  setPaywallCycle: (cycle: PaywallCycle) => void;
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sessionReady: false,
  setSessionReady: (ready) => set({ sessionReady: ready }),
  paywallVisible: false,
  paywallPlan: "pro",
  paywallCycle: "yearly",
  showPaywall: () => set({ paywallVisible: true, paywallPlan: "pro" }),
  hidePaywall: () => set({ paywallVisible: false }),
  setPaywallPlan: (plan) => set({ paywallPlan: plan }),
  setPaywallCycle: (cycle) => set({ paywallCycle: cycle }),
  theme: "dark",
  setTheme: (theme) => set({ theme }),
  locale: "fr",
  setLocale: (locale) => set({ locale }),
}));
