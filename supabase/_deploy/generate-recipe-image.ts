import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

// ── CORS ──────────────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
class HttpError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
function adminClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
interface Household { id: string; user_id: string; language: "fr" | "en"; }

async function getHousehold(req: Request, admin: SupabaseClient): Promise<Household> {
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "unauthorized");
  const { data: hh, error: hhErr } = await admin
    .from("households").select("id, user_id, language").eq("user_id", data.user.id).single();
  if (hhErr || !hh) throw new HttpError(404, "household_not_found");
  return hh as Household;
}

// ── HANDLER ───────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = adminClient();
    const household = await getHousehold(req, admin);

    const body = await req.json().catch(() => ({}));
    const itemId: string = body.item_id;
    if (!itemId) return jsonResponse({ error: "missing_item_id" }, 400);

    // Récupère l'item et vérifie que l'utilisateur en est propriétaire
    const { data: item } = await admin
      .from("meal_plan_items")
      .select("id, name, ingredients, image_url, meal_plans!inner(household_id)")
      .eq("id", itemId)
      .maybeSingle();

    const plan = item?.meal_plans as unknown as { household_id: string };
    if (!item || plan.household_id !== household.id) throw new HttpError(404, "item_not_found");

    // Déjà générée — retourne directement
    if (item.image_url) return jsonResponse({ image_url: item.image_url });

    // FLUX est entraîné principalement sur du texte anglais → toujours en anglais
    const ingredients = (item.ingredients as { name: string }[] ?? [])
      .slice(0, 8).map((i) => i.name).join(", ");

    const prompt = `Close-up professional food photography of a finished dish: "${item.name}". `
      + `Key ingredients visible in the dish: ${ingredients}. `
      + `Beautifully plated on a white ceramic plate, soft natural side lighting, `
      + `shallow depth of field, food stylist arrangement, gourmet magazine editorial style, `
      + `hyperrealistic, 4K, no text, no watermark`;

    // Appel Replicate FLUX-schnell — retry automatique si 429
    const replicateBody = JSON.stringify({
      input: { prompt, aspect_ratio: "4:3", output_format: "webp", output_quality: 85, num_outputs: 1 },
    });

    let prediction: Record<string, unknown> | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch(
        "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${Deno.env.get("REPLICATE_API_KEY") ?? ""}`,
            "Content-Type": "application/json",
            "Prefer": "wait=60",
          },
          body: replicateBody,
        }
      );

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after") ?? 12);
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }

      if (!res.ok) throw new Error(`Replicate ${res.status}: ${await res.text()}`);
      prediction = await res.json();
      break;
    }

    if (!prediction) throw new Error("Replicate rate limit exceeded after retries");
    if (prediction.status !== "succeeded" || !prediction.output?.[0]) {
      throw new Error(`Image generation failed: status=${prediction.status}`);
    }

    // Télécharge l'image depuis le CDN temporaire de Replicate
    const imgRes = await fetch(prediction.output[0] as string);
    if (!imgRes.ok) throw new Error("Failed to download generated image");
    const imgBytes = await imgRes.arrayBuffer();

    // Upload dans Supabase Storage (bucket public "recipe-images")
    const filename = `${itemId}.webp`;
    const { error: uploadError } = await admin.storage
      .from("recipe-images")
      .upload(filename, imgBytes, { contentType: "image/webp", upsert: true });
    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = admin.storage.from("recipe-images").getPublicUrl(filename);

    // Sauvegarde l'URL dans la DB (permanente via Storage)
    await admin.from("meal_plan_items").update({ image_url: publicUrl }).eq("id", itemId);

    return jsonResponse({ image_url: publicUrl });

  } catch (err) {
    if (err instanceof HttpError) return jsonResponse({ error: err.code }, err.status);
    console.error(err);
    const detail = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: "internal_error", detail }, 500);
  }
});
