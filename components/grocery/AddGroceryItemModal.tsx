import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Button } from "../ui/Button";
import { Chip } from "../ui/Chip";
import { t } from "../../lib/i18n";
import { GROCERY_CATEGORIES, type GroceryCategory } from "../../types/database";

interface AddGroceryItemModalProps {
  visible: boolean;
  initialCategory: GroceryCategory;
  onClose: () => void;
  onAdd: (input: { name: string; quantity: string; category: GroceryCategory }) => void;
  adding: boolean;
}

export function AddGroceryItemModal({
  visible,
  initialCategory,
  onClose,
  onAdd,
  adding,
}: AddGroceryItemModalProps) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [category, setCategory] = useState<GroceryCategory>(initialCategory);

  useEffect(() => setCategory(initialCategory), [initialCategory]);

  const submit = () => {
    if (!name.trim()) return;
    onAdd({ name: name.trim(), quantity: quantity.trim(), category });
    setName("");
    setQuantity("");
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 bg-cream"
      >
        <View className="flex-row items-center justify-between px-4 pt-4">
          <Text className="text-lg font-semibold text-ink">
            {t("grocery.addItemTitle")}
          </Text>
          <Pressable onPress={onClose} className="p-2" accessibilityRole="button">
            <Text className="text-2xl text-ink">×</Text>
          </Pressable>
        </View>
        <View className="px-4 mt-4 flex-1">
          <TextInput
            className="bg-white rounded-xl px-4 h-[52px] text-base text-ink border border-softgray"
            placeholder={t("grocery.itemNamePlaceholder")}
            placeholderTextColor="#9B9B9B"
            value={name}
            onChangeText={setName}
            autoFocus
          />
          <TextInput
            className="bg-white rounded-xl px-4 h-[52px] mt-3 text-base text-ink border border-softgray"
            placeholder={t("grocery.itemQtyPlaceholder")}
            placeholderTextColor="#9B9B9B"
            value={quantity}
            onChangeText={setQuantity}
          />
          <Text className="text-base font-medium text-ink mt-5 mb-2">
            {t("grocery.categoryLabel")}
          </Text>
          <View className="flex-row flex-wrap">
            {GROCERY_CATEGORIES.map((c) => (
              <Chip
                key={c}
                label={t(`grocery.categories.${c}`)}
                selected={category === c}
                onPress={() => setCategory(c)}
              />
            ))}
          </View>
        </View>
        <View className="px-4 pb-8">
          <Button
            label={t("grocery.addToList")}
            onPress={submit}
            disabled={!name.trim()}
            loading={adding}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
