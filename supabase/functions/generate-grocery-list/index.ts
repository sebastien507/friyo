import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { adminClient, getHousehold, HttpError } from "../_shared/context.ts";
import { rebuildGroceryList } from "../_shared/grocery.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const admin = adminClient();
    const household = await getHousehold(req, admin);

    const body = await req.json().catch(() => ({}));
    const weekStart: string = body.week_start_date;
    if (!weekStart) return jsonResponse({ error: "missing_week_start" }, 400);

    const { data: plan } = await admin
      .from("meal_plans")
      .select("id")
      .eq("household_id", household.id)
      .eq("week_start_date", weekStart)
      .maybeSingle();
    if (!plan) throw new HttpError(404, "meal_plan_not_found");

    const grocery = await rebuildGroceryList(admin, household, plan.id, weekStart);

    return jsonResponse({
      grocery_list_id: grocery.list_id,
      grocery_items: grocery.items,
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return jsonResponse({ error: err.code }, err.status);
    }
    console.error(err);
    return jsonResponse({ error: "internal_error" }, 500);
  }
});
