import { Platform, ScrollView, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Chip } from "../ui/Chip";
import { t } from "../../lib/i18n";

interface GroceryDayPickerProps {
  day: number; // 0=lundi … 6=dimanche
  time: string; // "18:00"
  onChangeDay: (day: number) => void;
  onChangeTime: (time: string) => void;
}

/** Jour d'épicerie + heure du rappel (roue iOS). */
export function GroceryDayPicker({
  day,
  time,
  onChangeDay,
  onChangeTime,
}: GroceryDayPickerProps) {
  const daysShort = t("days.short") as unknown as string[];
  const daysLong = t("days.long") as unknown as string[];

  const [hour, minute] = time.split(":").map(Number);
  const timeDate = new Date();
  timeDate.setHours(hour, minute, 0, 0);
  const dayBefore = daysLong[(day + 6) % 7];
  const timeLabel = `${hour}h${String(minute).padStart(2, "0")}`;

  return (
    <View className="mt-4">
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {daysShort.map((label, i) => (
          <Chip
            key={label}
            label={label}
            selected={day === i}
            onPress={() => onChangeDay(i)}
          />
        ))}
      </ScrollView>
      <Text className="text-base font-medium text-txt dark:text-txt-d mt-6 mb-1">
        {t("onboarding.reminders.timeLabel")}
      </Text>
      <DateTimePicker
        value={timeDate}
        mode="time"
        display={Platform.OS === "ios" ? "spinner" : "default"}
        minuteInterval={15}
        onChange={(_, date) => {
          if (!date) return;
          onChangeTime(
            `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
          );
        }}
      />
      <Text className="text-sm text-muted dark:text-muted-d mt-4 leading-5">
        {t("onboarding.reminders.context", { day: dayBefore, time: timeLabel })}
      </Text>
    </View>
  );
}
