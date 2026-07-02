import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { setLanguage } from "../lib/i18n";
import { useAppStore } from "../stores/useAppStore";
import type { Household } from "../types/database";

export function getEffectiveTier(household: Household): "pro" | "free" {
  if (household.is_purchased) return "pro";
  if (household.trial_ends_at && household.trial_ends_at > new Date().toISOString()) return "pro";
  return "free";
}

/** Retourne le nombre de jours restants dans l'essai, ou null si pas en essai. */
export function getTrialDaysLeft(household: Household): number | null {
  if (household.is_purchased || !household.trial_ends_at) return null;
  const ms = new Date(household.trial_ends_at).getTime() - Date.now();
  if (ms <= 0) return null;
  return Math.ceil(ms / 86_400_000);
}

export function useHousehold() {
  const sessionReady = useAppStore((s) => s.sessionReady);
  return useQuery({
    queryKey: ["household"],
    enabled: sessionReady,
    queryFn: async (): Promise<Household | null> => {
      const { data, error } = await supabase
        .from("households")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (data?.language) setLanguage(data.language);
      return data;
    },
  });
}

export function useUpdateHousehold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<Household>) => {
      const { data: existing } = await supabase
        .from("households")
        .select("id")
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from("households")
          .update(updates)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { data: user } = await supabase.auth.getUser();
        const { error } = await supabase
          .from("households")
          .insert({ ...updates, user_id: user.user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["household"] }),
  });
}
