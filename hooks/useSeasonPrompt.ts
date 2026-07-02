import { useMemo } from "react";
import { useHousehold, useUpdateHousehold } from "./useHousehold";
import {
  getCurrentSeason,
  getSeasonStart,
  isWithinSeasonPromptWindow,
  toISODate,
} from "../lib/dates";
import type { CuisineStyle } from "../types/database";

export const SEASON_SUGGESTIONS: Record<string, CuisineStyle[]> = {
  winter: ["stews_soups", "comfort"],
  spring: ["light_healthy", "mediterranean"],
  summer: ["bbq", "light_healthy"],
  fall: ["stews_soups", "quebecois"],
};

/**
 * Modal saisonnier : affiché si on est dans les 7 premiers jours de la
 * saison ET que la question n'a pas déjà été posée cette saison.
 */
export function useSeasonPrompt() {
  const { data: household } = useHousehold();
  const updateHousehold = useUpdateHousehold();

  const season = getCurrentSeason();
  const shouldShow = useMemo(() => {
    if (!household) return false;
    if (!isWithinSeasonPromptWindow()) return false;
    if (!household.last_season_prompt) return true;
    return new Date(household.last_season_prompt) < getSeasonStart();
  }, [household]);

  const dismiss = (newStyles?: CuisineStyle[]) => {
    updateHousehold.mutate({
      last_season_prompt: toISODate(new Date()),
      ...(newStyles ? { cuisine_styles: newStyles } : {}),
    });
  };

  return {
    shouldShow,
    season,
    suggestions: SEASON_SUGGESTIONS[season],
    currentStyles: household?.cuisine_styles ?? [],
    dismiss,
  };
}
