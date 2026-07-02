import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface Household {
  id: string;
  user_id: string;
  adults: number;
  children: number;
  preferences: string[];
  favorite_dishes: string[];
  cuisine_styles: string[];
  chef_styles: string[];
  meals_per_week: number;
  grocery_day: number;
  reminder_time: string;
  language: "fr" | "en";
  unit_system: "metric" | "imperial";
  is_purchased: boolean;
  generation_count: number;
}

/** Client admin (service role) — uniquement côté Edge Function. */
export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/** Authentifie la requête et charge le foyer de l'utilisateur. */
export async function getHousehold(
  req: Request,
  admin: SupabaseClient,
): Promise<Household> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "unauthorized");

  const { data: household, error: hhError } = await admin
    .from("households")
    .select("*")
    .eq("user_id", data.user.id)
    .single();
  if (hhError || !household) throw new HttpError(404, "household_not_found");
  return household as Household;
}

export class HttpError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}
