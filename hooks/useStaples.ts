import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { GroceryCategory, StapleItem } from "../types/database";

export function useStaples() {
  return useQuery({
    queryKey: ["staples"],
    queryFn: async (): Promise<StapleItem[]> => {
      const { data, error } = await supabase
        .from("staple_items")
        .select("*")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAddStaple() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      frequencyWeeks: number;
      category?: GroceryCategory;
    }) => {
      const { data: household } = await supabase
        .from("households")
        .select("id")
        .single();
      const { error } = await supabase.from("staple_items").insert({
        household_id: household!.id,
        name: input.name,
        frequency_weeks: input.frequencyWeeks,
        category: input.category ?? "pantry",
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staples"] }),
  });
}

export function useUpdateStapleFrequency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; frequencyWeeks: number }) => {
      const { error } = await supabase
        .from("staple_items")
        .update({ frequency_weeks: input.frequencyWeeks })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staples"] }),
  });
}

export function useDeleteStaple() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("staple_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staples"] }),
  });
}
