import type { SupabaseClient } from "@supabase/supabase-js";
import type { TodayPriority } from "@lifepulse/domain";
import { loadPrioritiesResult, savePriorities } from "@/lib/priorities";

export type LegacyPriority = { text: string; done: boolean; taskId?: string };

/** Non-destructive read of legacy localStorage priorities — does NOT delete. */
export function readLegacyPriorities(
  storage: Storage,
  localDate: string,
): LegacyPriority[] {
  try {
    const saved = storage.getItem("lifepulse_priorities");
    if (saved) {
      const data = JSON.parse(saved) as { date?: string; items?: { text: string; done: boolean; taskId?: string }[] };
      if (data.date === localDate && Array.isArray(data.items)) {
        return data.items.slice(0, 3);
      }
    }

    const oldFocus = storage.getItem("lifepulse_focus");
    if (oldFocus) {
      const { text, date } = JSON.parse(oldFocus) as { text?: string; date?: string };
      if (date === localDate && text) {
        return [{ text, done: false }];
      }
    }
  } catch {}
  return [];
}

/** Clear legacy localStorage priorities — only after successful backend persistence. */
export function clearLegacyPriorities(
  storage: Storage,
  localDate: string,
): void {
  try {
    const saved = storage.getItem("lifepulse_priorities");
    if (saved) {
      const data = JSON.parse(saved) as { date?: string };
      if (data.date === localDate) {
        storage.removeItem("lifepulse_priorities");
      }
    }

    const oldFocus = storage.getItem("lifepulse_focus");
    if (oldFocus) {
      const { date } = JSON.parse(oldFocus) as { date?: string };
      if (date === localDate) {
        storage.removeItem("lifepulse_focus");
      }
    }
  } catch {}
}

export interface MigrationResult {
  priorities: TodayPriority[];
  localStorageCleared: boolean;
  uploadAttempted: boolean;
  uploadSucceeded: boolean;
}

/**
 * Backend-first migration. Backend is authoritative once it contains data.
 * - Reading localStorage never deletes.
 * - Clearing only after confirmed backend success.
 * - Network/DB failure never destroys valid same-day localStorage.
 */
export async function executePriorityMigration(opts: {
  supabase: SupabaseClient;
  userId: string;
  localDate: string;
  localStorage: Storage;
}): Promise<MigrationResult> {
  const { supabase, userId, localDate, localStorage } = opts;

  // 1. Load backend FIRST
  const backend = await loadPrioritiesResult(supabase, userId, localDate);

  // 6. If backend load fails -> do NOT overwrite, do NOT clear
  if (backend.error) {
    return {
      priorities: [],
      localStorageCleared: false,
      uploadAttempted: false,
      uploadSucceeded: false,
    };
  }

  if (backend.data.length > 0) {
    // 2. Backend non-empty -> backend wins, retire legacy same-day key
    clearLegacyPriorities(localStorage, localDate);
    return {
      priorities: backend.data,
      localStorageCleared: true,
      uploadAttempted: false,
      uploadSucceeded: false,
    };
  }

  // 3. Backend empty -> inspect legacy
  const legacyItems = readLegacyPriorities(localStorage, localDate);
  if (legacyItems.length === 0) {
    // 5. No legacy or stale -> nothing to upload
    return {
      priorities: [],
      localStorageCleared: false,
      uploadAttempted: false,
      uploadSucceeded: false,
    };
  }

  // 4. Backend empty + valid same-day legacy -> attempt upload
  const uploadOk = await savePriorities(supabase, userId, localDate, legacyItems);

  if (uploadOk) {
    // Only after confirmed persistence -> clear
    clearLegacyPriorities(localStorage, localDate);
    const reloaded = await loadPrioritiesResult(supabase, userId, localDate);
    // If reload fails after successful save, still cleared (backend has data); return empty but cleared
    if (reloaded.error) {
      return {
        priorities: [],
        localStorageCleared: true,
        uploadAttempted: true,
        uploadSucceeded: true,
      };
    }
    return {
      priorities: reloaded.data,
      localStorageCleared: true,
      uploadAttempted: true,
      uploadSucceeded: true,
    };
  }

  // 6. Upload failed -> preserve localStorage, do not pretend success
  return {
    priorities: [],
    localStorageCleared: false,
    uploadAttempted: true,
    uploadSucceeded: false,
  };
}
