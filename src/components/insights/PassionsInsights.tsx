"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";

export function PassionsInsights() {
  const supabase = createClient();
  const [data, setData] = useState<{
    activePassions: number;
    weeklySessions: number;
    weeklyMinutes: number;
    completedMilestones: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date();
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      const weekStart = new Date(today.setDate(diff)).toISOString().slice(0, 10);

      const [passionsRes, sessionsRes, milestonesRes] = await Promise.all([
        supabase.from("passions").select("id").eq("user_id", user.id).eq("status", "active"),
        supabase.from("passion_sessions").select("duration_minutes").eq("user_id", user.id).gte("session_date", weekStart),
        supabase.from("passion_milestones").select("id").eq("user_id", user.id).not("completed_at", "is", null),
      ]);

      if (cancelled) return;

      const sessions = (sessionsRes.data ?? []) as { duration_minutes?: number | null }[];

      setData({
        activePassions: (passionsRes.data ?? []).length,
        weeklySessions: sessions.length,
        weeklyMinutes: sessions.reduce((s, se) => s + (se.duration_minutes ?? 0), 0),
        completedMilestones: (milestonesRes.data ?? []).length,
      });
    }

    load();
    return () => { cancelled = true; };
  }, [supabase]);

  if (!data) return null;

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <svg className="h-4 w-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.385a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
        <p className="text-[10px] font-medium tracking-wider text-[var(--text-muted)]">Passions &amp; Hobbies</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <p className="text-lg font-bold text-[var(--text)]">{data.activePassions}</p>
          <p className="text-[10px] text-[var(--text-muted)]">Active</p>
          <p className="text-[9px] text-[var(--text-muted)]">{data.completedMilestones} milestones</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-[var(--text)]">{data.weeklySessions}</p>
          <p className="text-[10px] text-[var(--text-muted)]">Sessions / wk</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-[var(--text)]">{data.weeklyMinutes}</p>
          <p className="text-[10px] text-[var(--text-muted)]">Min / wk</p>
        </div>
      </div>
    </Card>
  );
}
