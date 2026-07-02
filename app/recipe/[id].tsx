import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { t } from "../../lib/i18n";
import { useHousehold } from "../../hooks/useHousehold";
import { useSavePersonalNote, useToggleFavorite } from "../../hooks/useMealPlan";
import type { MealPlanItem } from "../../types/database";

export default function RecipeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: household } = useHousehold();
  const toggleFavorite = useToggleFavorite();
  const saveNote = useSavePersonalNote();
  const [note, setNote] = useState("");
  const isDark = useColorScheme() === "dark";

  const { width } = useWindowDimensions();

  const { data: item, isLoading } = useQuery({
    queryKey: ["mealItem", id],
    queryFn: async (): Promise<MealPlanItem | null> => {
      const { data, error } = await supabase
        .from("meal_plan_items")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    // Polling toutes les 4s jusqu'à ce que l'image soit prête (max 30 essais = 2 min)
    // Filet de sécurité — le cache est normalement mis à jour par fireImageGeneration.
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d || d.image_url) return false;
      return (query.state.dataUpdateCount ?? 0) < 30 ? 4000 : false;
    },
  });

  useEffect(() => {
    if (item?.personal_note) setNote(item.personal_note);
  }, [item]);


  if (isLoading || !item) {
    return (
      <View className="flex-1 bg-canvas dark:bg-canvas-d items-center justify-center">
        <ActivityIndicator color={isDark ? "#3FE0B6" : "#10B488"} />
      </View>
    );
  }

  const servings = (household?.adults ?? 2) + (household?.children ?? 0);

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-d" edges={["top"]}>
      <View className="flex-row items-center px-4 pt-2">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2" accessibilityRole="button">
          <Text className="text-base text-mint dark:text-mint-d font-medium">‹ {t("common.back")}</Text>
        </Pressable>
      </View>
      <ScrollView className="flex-1 px-4" keyboardShouldPersistTaps="handled">
        <View className="flex-row items-start justify-between mt-2">
          <Text className="text-2xl font-semibold text-txt dark:text-txt-d flex-1 pr-3">
            {item.name}
          </Text>
          <Pressable
            onPress={() => toggleFavorite.mutate(item)}
            className="p-2"
            accessibilityRole="button"
            accessibilityLabel="Favori"
          >
            <Text className="text-2xl">{item.is_favorited ? "❤️" : "🤍"}</Text>
          </Pressable>
        </View>
        <Text className="text-sm text-muted dark:text-muted-d mt-1">
          {item.prep_minutes != null
            ? `${t("common.minutes", { count: item.prep_minutes })} · `
            : ""}
          {t("meal.servings", { count: servings })}
        </Text>

        {/* Image de la recette */}
        {item.image_url ? (
          <Image
            source={{ uri: item.image_url }}
            style={{ width: width - 32, height: Math.round((width - 32) * 0.75), borderRadius: 16, marginTop: 16 }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={{
              width: width - 32,
              height: Math.round((width - 32) * 0.75),
              borderRadius: 16,
              marginTop: 16,
              backgroundColor: isDark ? "#1C2128" : "#F0F2F1",
            }}
          />
        )}

        <Text className="text-lg font-semibold text-txt dark:text-txt-d mt-6 mb-2">
          {t("meal.ingredients")}
        </Text>
        {item.ingredients.map((ing, i) => (
          <Text key={i} className="text-base text-txt dark:text-txt-d py-1">
            • {ing.name}
            {ing.quantity ? ` — ${ing.quantity}${ing.unit ? ` ${ing.unit}` : ""}` : ""}
          </Text>
        ))}

        {item.steps.length > 0 && (
          <>
            <Text className="text-lg font-semibold text-txt dark:text-txt-d mt-6 mb-2">
              {t("meal.steps")}
            </Text>
            {item.steps.map((step, i) => (
              <Text key={i} className="text-base text-txt dark:text-txt-d py-1.5 leading-6">
                {i + 1}. {step}
              </Text>
            ))}
          </>
        )}

        <Text className="text-lg font-semibold text-txt dark:text-txt-d mt-6 mb-2">
          {t("meal.personalNote")}
        </Text>
        <TextInput
          style={{
            backgroundColor: isDark ? "#1E242C" : "#FFFFFF",
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            fontSize: 16,
            color: isDark ? "#EEF1F4" : "#16201C",
            borderWidth: 1,
            borderColor: isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.08)",
            minHeight: 80,
            marginBottom: 48,
            textAlignVertical: "top",
          }}
          placeholder={t("meal.notePlaceholder")}
          placeholderTextColor={isDark ? "#8A95A2" : "#73827B"}
          value={note}
          onChangeText={setNote}
          onEndEditing={() => saveNote.mutate({ itemId: item.id, note })}
          multiline
          textAlignVertical="top"
        />
      </ScrollView>
    </SafeAreaView>
  );
}
