import { View } from "react-native";
import { Stepper } from "../ui/Stepper";
import { t } from "../../lib/i18n";

interface HouseholdSetupProps {
  adults: number;
  children: number;
  onChangeAdults: (n: number) => void;
  onChangeChildren: (n: number) => void;
}

export function HouseholdSetup({
  adults,
  children,
  onChangeAdults,
  onChangeChildren,
}: HouseholdSetupProps) {
  return (
    <View className="mt-4">
      <Stepper
        label={t("onboarding.household.adults")}
        value={adults}
        min={1}
        max={4}
        onChange={onChangeAdults}
      />
      <Stepper
        label={t("onboarding.household.children")}
        value={children}
        min={0}
        max={5}
        onChange={onChangeChildren}
      />
    </View>
  );
}
