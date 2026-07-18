import type { SupabaseClient } from "@supabase/supabase-js";

interface XpTotalsResult {
  totalXp: number;
  todayXp: number;
}

interface XpTotalsRow {
  total_xp: number | string | null;
  today_xp: number | string | null;
}

function toSafeInteger(value: number | string | null | undefined): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
}

export async function loadExactXpTotals(
  supabase: SupabaseClient,
  userId: string,
  todayStartIso: string,
): Promise<XpTotalsResult> {
  const { data, error } = await supabase.rpc("get_xp_totals", { p_today_start: todayStartIso });

  if (!error) {
    const rows = Array.isArray(data) ? data : data ? [data] : [];
    const row = rows[0] as XpTotalsRow | undefined;
    if (row) {
      return {
        totalXp: toSafeInteger(row.total_xp),
        todayXp: toSafeInteger(row.today_xp),
      };
    }
    return { totalXp: 0, todayXp: 0 };
  }

  // Safe fallback while the hosted Supabase migration is being applied.
  const [todayRes, totalRes] = await Promise.all([
    supabase
      .from("xp_events")
      .select("amount")
      .eq("user_id", userId)
      .gte("created_at", todayStartIso),
    supabase
      .from("xp_events")
      .select("amount")
      .eq("user_id", userId),
  ]);

  return {
    totalXp: (totalRes.data ?? []).reduce((sum: number, event: { amount: number | string | null }) => sum + toSafeInteger(event.amount), 0),
    todayXp: (todayRes.data ?? []).reduce((sum: number, event: { amount: number | string | null }) => sum + toSafeInteger(event.amount), 0),
  };
}
