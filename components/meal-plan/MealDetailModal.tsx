import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "../ui/Button";
import { t } from "../../lib/i18n";
import type { MealPlanItem } from "../../types/database";

interface MealDetailModalProps {
  item: MealPlanItem | null;
  onClose: () => void;
  onRegenerate: (item: MealPlanItem) => void;
  regenerating: boolean;
}

export function MealDetailModal({
  item,
  onClose,
  onRegenerate,
  regenerating,
}: MealDetailModalProps) {
  const router = useRouter();
  if (!item) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-canvas">
        <View className="px-5 pt-5">
          <View className="w-10 h-1 bg-surface2 rounded-full self-center mb-4" />
          <View className="flex-row items-start justify-between">
            <Text className="text-xl font-semibold text-txt font-brand flex-1 mr-2" numberOfLines={2}>
              {item.name}
            </Text>
            <Pressable onPress={onClose} className="p-1 mt-0.5" accessibilityRole="button">
              <Text className="text-2xl text-muted leading-none">×</Text>
            </Pressable>
          </View>
          {item.prep_minutes != null && (
            <Text className="text-sm text-muted mt-1">
              {t("meal.prepTime")} : {t("common.minutes", { count: item.prep_minutes })}
            </Text>
          )}
        </View>
        <ScrollView className="flex-1 px-5 mt-5">
          <Text className="text-xs font-semibold text-muted uppercase tracking-widest mb-3">
            {t("meal.ingredients")}
          </Text>
          {item.ingredients.slice(0, 8).map((ing, i) => (
            <View
              key={i}
              className="flex-row items-center py-2.5"
              style={{ borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" }}
            >
              <View className="w-1.5 h-1.5 rounded-full bg-mint mr-3" />
              <Text className="flex-1 text-base text-txt">
                {ing.name}
                {ing.quantity ? ` — ${ing.quantity}${ing.unit ? ` ${ing.unit}` : ""}` : ""}
              </Text>
            </View>
          ))}
          {!item.is_manual && item.steps.length > 0 && (
            <>
              <Text className="text-xs font-semibold text-muted uppercase tracking-widest mt-6 mb-3">
                {t("meal.steps")}
              </Text>
              {item.steps.slice(0, 3).map((step, i) => (
                <Text key={i} className="text-base text-txt py-1.5" numberOfLines={2}>
                  {i + 1}. {step}
                </Text>
              ))}
            </>
          )}
        </ScrollView>
        <View className="px-5 pb-8 pt-4 gap-3">
          {!item.is_manual && (
            <Button
              label={t("meal.regenerateThis")}
              variant="secondary"
              loading={regenerating}
              onPress={() => onRegenerate(item)}
            />
          )}
          <Button
            label={t("meal.viewFull")}
            onPress={() => {
              onClose();
              router.push(`/recipe/${item.id}`);
            }}
          />
        </View>
      </View>
    </Modal>
  );
}
