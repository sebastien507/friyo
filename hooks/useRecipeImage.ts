import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { MealPlanItem } from "../types/database";

export function useGenerateRecipeImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string): Promise<string> => {
      const { data, error } = await supabase.functions.invoke("generate-recipe-image", {
        body: { item_id: itemId },
      });
      if (error) throw error;
      if (!data?.image_url) throw new Error("No image_url in response");
      return data.image_url as string;
    },
    onSuccess: (imageUrl, itemId) => {
      queryClient.setQueryData<MealPlanItem | null>(["mealItem", itemId], (old) => {
        if (!old) return old;
        return { ...old, image_url: imageUrl };
      });
    },
  });
}
