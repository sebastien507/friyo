import { useState } from "react";
import { Alert, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "../../components/ui/Button";
import { supabase } from "../../lib/supabase";
import { t } from "../../lib/i18n";

/** Lier un email au compte anonyme (optionnel, depuis les paramètres). */
export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  const linkEmail = async () => {
    setSending(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: email.trim() });
      if (error) throw error;
      Alert.alert("✉️", t("settings.linkAccountHint"));
      router.back();
    } catch {
      Alert.alert(t("common.error"));
    } finally {
      setSending(false);
    }
  };

  return (
    <View className="flex-1 bg-cream px-5 pt-16">
      <Text className="text-2xl font-semibold text-ink">
        {t("settings.linkAccount")}
      </Text>
      <Text className="text-base text-[#6B6B6B] mt-2">
        {t("settings.linkAccountHint")}
      </Text>
      <TextInput
        className="bg-white rounded-xl px-4 h-[52px] mt-6 text-base text-ink border border-softgray"
        placeholder={t("settings.emailPlaceholder")}
        placeholderTextColor="#9B9B9B"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoFocus
      />
      <View className="mt-4">
        <Button
          label={t("settings.sendMagicLink")}
          onPress={linkEmail}
          disabled={!email.includes("@")}
          loading={sending}
        />
      </View>
    </View>
  );
}
