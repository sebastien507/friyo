import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

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

async function generateOneImage(
  admin: SupabaseClient,
  household: Household,
  itemId: string,
): Promise<string> {
  const { data: item } = await admin
    .from("meal_plan_items")
    .select("id, name, ingredients, image_url, meal_plans!inner(household_id)")
    .eq("id", itemId)
    .maybeSingle();

  const plan = item?.meal_plans as unknown as { household_id: string };
  if (!item || plan.household_id !== household.id) throw new Error("item_not_found");

  // Déjà générée
  if (item.image_url) return item.image_url;

  // FLUX est entraîné principalement sur du texte anglais → toujours en anglais
  const ingredients = (item.ingredients as { name: string }[] ?? [])
    .slice(0, 8).map((i) => i.name).join(", ");

  const prompt = `Close-up professional food photography of a finished dish: "${item.name}". `
    + `Key ingredients visible in the dish: ${ingredients}. `
    + `Beautifully plated on a white ceramic plate, soft natural side lighting, `
    + `shallow depth of field, food stylist arrangement, gourmet magazine editorial style, `
    + `hyperrealistic, 4K, no text, no watermark`;

  const replicateBody = JSON.stringify({
    input: { prompt, aspect_ratio: "4:3", output_format: "webp", output_quality: 85, num_outputs: 1 },
  });

  let prediction: Record<string, unknown> | null = null;
  for (let attempt = 0; attempt < 8; attempt++) {
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
      },
    );

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after") ?? 10);
      console.log(`[gen-all] 429 for ${itemId}, retry in ${retryAfter}s`);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      continue;
    }

    if (!res.ok) throw new Error(`Replicate ${res.status}: ${await res.text()}`);
    prediction = await res.json();
    break;
  }

  if (!prediction) throw new Error("rate_limit_exceeded");

  // Si Replicate n'a pas terminé dans le délai wait=60, sonder la prédiction
  if (prediction.status === "processing" || prediction.status === "starting") {
    const predId = prediction.id as string;
    console.log(`[gen-all] prediction ${predId} still processing, polling...`);
    for (let poll = 0; poll < 12; poll++) {
      await new Promise((r) => setTimeout(r, 8_000));
      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${predId}`, {
        headers: { "Authorization": `Bearer ${Deno.env.get("REPLICATE_API_KEY") ?? ""}` },
      });
      prediction = await pollRes.json();
      if (prediction.status === "succeeded" || prediction.status === "failed" || prediction.status === "canceled") break;
    }
  }

  if (prediction.status !== "succeeded" || !prediction.output?.[0]) {
    throw new Error(`generation_failed: status=${prediction.status}`);
  }

  const imgRes = await fetch(prediction.output[0] as string);
  if (!imgRes.ok) throw new Error("download_failed");
  const imgBytes = await imgRes.arrayBuffer();

  const filename = `${itemId}.webp`;
  const { error: uploadError } = await admin.storage
    .from("recipe-images")
    .upload(filename, imgBytes, { contentType: "image/webp", upsert: true });
  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = admin.storage.from("recipe-images").getPublicUrl(filename);
  await admin.from("meal_plan_items").update({ image_url: publicUrl }).eq("id", itemId);

  return publicUrl;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = adminClient();
    const household = await getHousehold(req, admin);

    const body = await req.json().catch(() => ({}));
    const itemIds: string[] = body.item_ids ?? [];
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return jsonResponse({ error: "missing_item_ids" }, 400);
    }

    // Parallèle — avec $20 de crédit Replicate le burst limit est >>1
    console.log(`[gen-all] starting ${itemIds.length} images in parallel`);
    const settled = await Promise.allSettled(
      itemIds.map((id) => generateOneImage(admin, household, id)),
    );

    const results = settled.map((r, i) => {
      if (r.status === "fulfilled") {
        console.log(`[gen-all] done ${itemIds[i]}`);
        return { id: itemIds[i], image_url: r.value };
      }
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
      console.error(`[gen-all] failed ${itemIds[i]}:`, msg);
      return { id: itemIds[i], error: msg };
    });

    return jsonResponse({ results });
  } catch (err) {
    if (err instanceof HttpError) return jsonResponse({ error: err.code }, err.status);
    console.error(err);
    const detail = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: "internal_error", detail }, 500);
  }
});
