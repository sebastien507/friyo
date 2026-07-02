import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Button } from "../ui/Button";
import { t } from "../../lib/i18n";
import type { Ingredient } from "../../types/database";

interface AddMealModalProps {
  visible: boolean;
  takenDays: number[];
  onClose: () => void;
  onAdd: (input: { dayIndex: number; name: string; ingredients: Ingredient[] }) => void;
  adding: boolean;
}

/** Modal « Ajouter un souper manuellement » — is_manual = true. */
export function AddMealModal({ visible, takenDays, onClose, onAdd, adding }: AddMealModalProps) {
  const [name, setName] = useState("");
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [ingName, setIngName] = useState("");
  const [ingQty, setIngQty] = useState("");
  const qtyRef = useRef<TextInput>(null);

  const firstFree = [0, 1, 2, 3, 4, 5, 6].find((d) => !takenDays.includes(d)) ?? 0;

  const addIngredient = () => {
    if (!ingName.trim()) return;
    setIngredients((prev) => [...prev, { name: ingName.trim(), quantity: ingQty.trim() }]);
    setIngName("");
    setIngQty("");
  };

  const reset = () => {
    setName("");
    setIngredients([]);
    setIngName("");
    setIngQty("");
  };

  const submit = () => {
    if (!name.trim()) return;
    const finalIngredients = [...ingredients];
    if (ingName.trim()) finalIngredients.push({ name: ingName.trim(), quantity: ingQty.trim() });
    onAdd({ dayIndex: firstFree, name: name.trim(), ingredients: finalIngredients });
    reset();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 bg-cream"
      >
        <View className="flex-row items-center justify-between px-4 pt-4">
          <Text className="text-lg font-semibold text-ink">{t("meal.addTitle")}</Text>
          <Pressable onPress={handleClose} className="p-2" accessibilityRole="button">
            <Text className="text-2xl text-ink">×</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-4 mt-4" keyboardShouldPersistTaps="handled">
          {/* Nom du plat */}
          <TextInput
            className="bg-white rounded-xl px-4 h-[52px] text-base text-ink border border-softgray"
            placeholder={t("meal.namePlaceholder")}
            placeholderTextColor="#9B9B9B"
            value={name}
            onChangeText={setName}
            returnKeyType="next"
          />

          {/* Section ingrédients */}
          <Text className="text-base font-medium text-ink mt-5 mb-3">
            {t("meal.ingredientSection")}
          </Text>

          {/* Liste des ingrédients ajoutés */}
          {ingredients.map((ing, i) => (
            <View
              key={i}
              style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 14, height: 48, borderWidth: 1, borderColor: "#E5E7EB", marginBottom: 8 }}
            >
              <Text style={{ flex: 1, fontSize: 15, color: "#1A2420" }}>{ing.name}</Text>
              {ing.quantity ? (
                <Text style={{ fontSize: 14, color: "#9B9B9B", marginRight: 10 }}>{ing.quantity}</Text>
              ) : null}
              <Pressable onPress={() => setIngredients((p) => p.filter((_, j) => j !== i))} hitSlop={10}>
                <Text style={{ fontSize: 20, color: "#9B9B9B", lineHeight: 24 }}>×</Text>
              </Pressable>
            </View>
          ))}

          {/* Ligne d'ajout d'ingrédient */}
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 24 }}>
            <TextInput
              style={{ flex: 1, backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 14, height: 48, fontSize: 15, color: "#1A2420", borderWidth: 1, borderColor: "#E5E7EB" }}
              placeholder={t("meal.ingredientNamePlaceholder")}
              placeholderTextColor="#9B9B9B"
              value={ingName}
              onChangeText={setIngName}
              returnKeyType="next"
              onSubmitEditing={() => qtyRef.current?.focus()}
              blurOnSubmit={false}
            />
            <TextInput
              ref={qtyRef}
              style={{ width: 96, backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 14, height: 48, fontSize: 15, color: "#1A2420", borderWidth: 1, borderColor: "#E5E7EB" }}
              placeholder={t("meal.ingredientQtyPlaceholder")}
              placeholderTextColor="#9B9B9B"
              value={ingQty}
              onChangeText={setIngQty}
              returnKeyType="done"
              onSubmitEditing={addIngredient}
            />
            <Pressable
              onPress={addIngredient}
              style={{ width: 48, height: 48, backgroundColor: "#10B488", borderRadius: 12, alignItems: "center", justifyContent: "center" }}
              accessibilityRole="button"
              accessibilityLabel="Ajouter l'ingrédient"
            >
              <Text style={{ color: "#fff", fontSize: 24, fontWeight: "700", lineHeight: 28 }}>+</Text>
            </Pressable>
          </View>
        </ScrollView>

        <View className="px-4 pb-8">
          <Button
            label={t("meal.addButton")}
            onPress={submit}
            disabled={!name.trim()}
            loading={adding}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
