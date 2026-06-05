import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Missing Supabase environment variables." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let periodStart: string | undefined;
  let periodEnd: string | undefined;

  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (body?.period_start && body?.period_end) {
        periodStart = String(body.period_start);
        periodEnd = String(body.period_end);
      }
    } catch {
      // use defaults in RPC
    }
  }

  const { data, error } = await supabase.rpc(
    "calculate_performance_scores_for_period",
    {
      p_period_start: periodStart ?? null,
      p_period_end: periodEnd ?? null,
    }
  );

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({ inserted: data, ok: true }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
