import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { getWeekStartISO } from "../lib/dates";
import type { FridgeSnapshot } from "../types/database";

export function useFridgeSnapshot() {
  const weekStart = getWeekStartISO();
  return useQuery({
    queryKey: ["fridge", weekStart],
    queryFn: async (): Promise<FridgeSnapshot | null> => {
      const { data, error } = await supabase
        .from("fridge_snapshots")
        .select("*")
        .eq("week_start_date", weekStart)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** 1 snapshot par semaine — upsert sur (household, semaine). */
export function useSaveFridgeSnapshot() {
  const queryClient = useQueryClient();
  const weekStart = getWeekStartISO();
  return useMutation({
    mutationFn: async (contents: string) => {
      const { data: household } = await supabase
        .from("households")
        .select("id")
        .single();
      const { error } = await supabase.from("fridge_snapshots").upsert(
        {
          household_id: household!.id,
          week_start_date: weekStart,
          contents,
        },
        { onConflict: "household_id,week_start_date" },
      );
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["fridge", weekStart] }),
  });
}
