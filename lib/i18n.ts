import { I18n } from "i18n-js";
import { getLocales } from "expo-localization";

import en from "../locales/en.json";
import fr from "../locales/fr.json";

export const i18n = new I18n({ en, fr });

i18n.enableFallback = true;
i18n.defaultLocale = "fr";

const deviceLanguage = getLocales()[0]?.languageCode ?? "fr";
i18n.locale = deviceLanguage === "en" ? "en" : "fr";

export function setLanguage(lang: "en" | "fr") {
  i18n.locale = lang;
}

export const t = i18n.t.bind(i18n);
