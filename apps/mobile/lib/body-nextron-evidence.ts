/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { supabase } from "./supabase";
import { loadNextronHealthPermissions, effectiveNextronMetrics } from "./nextron-health-permissions";
import { loadBodyOverview } from "./body-service";
import { buildBodyNextronEvidence, type BodyNextronEvidence } from "@lifepulse/domain";

export async function loadBodyNextronEvidence(): Promise<BodyNextronEvidence | null> {
  const perms = await loadNextronHealthPermissions();
  const effective = effectiveNextronMetrics(perms.allowed, perms.nextronAllowed);
  if (effective.length === 0) return null;
  const overview = await loadBodyOverview(7);
  if (!overview?.today) return null;
  return buildBodyNextronEvidence({
    overview: {
      today: overview.today,
      trends: overview.trends as any,
      goals: overview.goals,
      goalProgress: overview.goalProgress,
      habits: overview.habits,
      dueCount: overview.habits.length,
      tasks: overview.tasks,
    },
    allowedMetrics: perms.allowed as any,
    nextronAllowed: effective as any,
    period: 7,
  });
}
