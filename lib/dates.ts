/** Helpers de dates — semaine commence le lundi (day_index 0). */
import { useEffect, useState } from "react";

/**
 * DEV ONLY — met à true pour tester 3 mois rapidement.
 * Chaque minute réelle = 1 semaine simulée depuis le lancement de l'app.
 * Remet à false avant de shipper.
 */
export const DEV_FAST_WEEKS = false;
const DEV_START_MS = Date.now();

export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=dimanche … 6=samedi
  const diff = day === 0 ? -6 : 1 - day; // ramener au lundi
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getWeekStartISO(date: Date = new Date()): string {
  const base = getWeekStart(date);
  if (DEV_FAST_WEEKS) {
    const minuteOffset = Math.floor((Date.now() - DEV_START_MS) / 60_000);
    return toISODate(new Date(base.getTime() + minuteOffset * 7 * 86_400_000));
  }
  return toISODate(base);
}

/** Parse "AAAA-MM-JJ" en date locale (évite le décalage UTC de new Date(iso)). */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "9 juin" / "June 9" selon la locale. */
export function formatWeekLabel(weekStartISO: string, locale: string): string {
  return parseISODate(weekStartISO).toLocaleDateString(
    locale === "fr" ? "fr-CA" : "en-CA",
    { day: "numeric", month: "long" },
  );
}

/** Hook réactif — en mode DEV_FAST_WEEKS, se met à jour toutes les 5 s. */
export function useWeekStartISO(): string {
  const [weekStart, setWeekStart] = useState(() => getWeekStartISO());
  useEffect(() => {
    if (!DEV_FAST_WEEKS) return;
    const id = setInterval(() => setWeekStart(getWeekStartISO()), 5_000);
    return () => clearInterval(id);
  }, []);
  return weekStart;
}

export type Season = "spring" | "summer" | "fall" | "winter";

/** Dates de début de saison : 20 mars, 21 juin, 22 sept., 21 déc. */
export function getCurrentSeason(date: Date = new Date()): Season {
  const md = (date.getMonth() + 1) * 100 + date.getDate();
  if (md >= 320 && md < 621) return "spring";
  if (md >= 621 && md < 922) return "summer";
  if (md >= 922 && md < 1221) return "fall";
  return "winter";
}

export function getSeasonStart(date: Date = new Date()): Date {
  const y = date.getFullYear();
  const season = getCurrentSeason(date);
  switch (season) {
    case "spring":
      return new Date(y, 2, 20);
    case "summer":
      return new Date(y, 5, 21);
    case "fall":
      return new Date(y, 8, 22);
    case "winter": {
      // l'hiver peut avoir commencé le 21 déc. de l'année précédente
      const start = new Date(y, 11, 21);
      return date >= start ? start : new Date(y - 1, 11, 21);
    }
  }
}

/** Vrai si on est dans les 7 premiers jours de la saison courante. */
export function isWithinSeasonPromptWindow(date: Date = new Date()): boolean {
  const start = getSeasonStart(date);
  const diffDays = (date.getTime() - start.getTime()) / 86_400_000;
  return diffDays >= 0 && diffDays < 7;
}
