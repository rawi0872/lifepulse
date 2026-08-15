"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardNav } from "@/components/DashboardNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconPicker } from "@/components/IconPicker";
import { ColorPicker } from "@/components/ColorPicker";
import { InfoTip } from "@/components/InfoTip";
import { HelpPopover } from "@/components/HelpPopover";
import { FeedbackButton } from "@/components/feedback/FeedbackButton";
import { useToast } from "@/hooks/use-toast";
import { INTENDED_USE_OPTIONS, resolveIntendedUse, type IntendedUse } from "@/lib/intendedUse";
import {
  getModulesByCategory,
  getModuleCategoryLabel,
  getModuleStatusLabel,
  getRecommendedModules,
  type ModuleCategory,
  type ModuleStatus,
} from "@/lib/modules";

interface NextronMemoryItem {
  id: string;
  type: "PREFERENCE";
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface GoogleCalendarStatus {
  connected: boolean;
  status: "connected" | "error" | "revoked" | "not_connected";
  accountHint: string | null;
  lastErrorCode: string | null;
  allowNextronCalendar: boolean;
  readOnly: true;
  missingEnv: string[];
}

interface GoogleDriveStatus {
  connected: boolean;
  status: "connected" | "error" | "revoked" | "not_connected";
  accountHint: string | null;
  lastErrorCode: string | null;
  allowNextronDrive: boolean;
  readOnly: true;
  scope: "drive.file";
  imports: Array<{ id: string; display_title: string; status: string }>;
  missingEnv: string[];
}

const moduleStatusStyles: Record<ModuleStatus, string> = {
  available: "border-[var(--success)]/30 bg-[var(--success-soft)] text-[var(--success)]",
  preview: "border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[var(--accent)]",
  planned: "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]",
};

const moduleCategoryOrder: readonly ModuleCategory[] = ["core", "personal", "business", "team", "devices", "ai"];

export default function SettingsPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [intendedUse, setIntendedUse] = useState<IntendedUse>("personal");
  const [allowProductLearning, setAllowProductLearning] = useState(false);
  const [savingProductLearning, setSavingProductLearning] = useState(false);
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingSetup, setSavingSetup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [memories, setMemories] = useState<NextronMemoryItem[]>([]);
  const [memoryLoading, setMemoryLoading] = useState(true);
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [editingMemoryContent, setEditingMemoryContent] = useState("");
  const [savingMemory, setSavingMemory] = useState(false);
  const [calendarStatus, setCalendarStatus] = useState<GoogleCalendarStatus | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarSaving, setCalendarSaving] = useState(false);
  const [driveStatus, setDriveStatus] = useState<GoogleDriveStatus | null>(null);
  const [driveLoading, setDriveLoading] = useState(true);
  const [driveSaving, setDriveSaving] = useState(false);
  const { toast } = useToast();

  const calendarReconnectRequired = calendarStatus?.status === "revoked" || calendarStatus?.lastErrorCode === "RECONNECT_REQUIRED";
  const driveReconnectRequired = driveStatus?.status === "revoked" || driveStatus?.lastErrorCode === "RECONNECT_REQUIRED";

  interface Realm { id: string; name: string; color: string; icon: string }
  const [realms, setRealms] = useState<Realm[]>([]);
  const [showAddRealm, setShowAddRealm] = useState(false);
  const [newRealmName, setNewRealmName] = useState("");
  const [newRealmIcon, setNewRealmIcon] = useState("🌟");
  const [newRealmColor, setNewRealmColor] = useState("#6366f1");
  const [savingRealm, setSavingRealm] = useState(false);
  const [realmError, setRealmError] = useState<string | null>(null);
  const [editingRealmId, setEditingRealmId] = useState<string | null>(null);
  const [editRealmName, setEditRealmName] = useState("");
  const [editRealmIcon, setEditRealmIcon] = useState("");
  const [editRealmColor, setEditRealmColor] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      setEmail(user.email ?? "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, birth_date, display_name, intended_use, allow_product_improvement_events")
        .eq("user_id", user.id)
        .single();

      if (cancelled) return;
      if (profile) {
        setFirstName(profile.first_name ?? "");
        setLastName(profile.last_name ?? "");
        setBirthDate(profile.birth_date ?? "");
        setDisplayName(profile.display_name ?? "");
        setIntendedUse(resolveIntendedUse(profile.intended_use));
        setAllowProductLearning(Boolean(profile.allow_product_improvement_events));
      }

      const { data: realmData } = await supabase
        .from("realms")
        .select("id, name, color, icon")
        .eq("user_id", user.id)
        .order("sort_order");
      if (realmData) setRealms(realmData);

      try {
        const memoryResponse = await fetch("/api/nextron/memory", { cache: "no-store" });
        if (memoryResponse.ok) {
          const memoryPayload: { memories?: NextronMemoryItem[] } = await memoryResponse.json();
          setMemories(memoryPayload.memories ?? []);
        }
      } catch {}
      setMemoryLoading(false);

      try {
        const calendarResponse = await fetch("/api/integrations/google/calendar", { cache: "no-store" });
        if (calendarResponse.ok) {
          const calendarPayload: GoogleCalendarStatus = await calendarResponse.json();
          setCalendarStatus(calendarPayload);
        }
      } catch {}
      setCalendarLoading(false);

      try {
        const driveResponse = await fetch("/api/integrations/google/drive", { cache: "no-store" });
        if (driveResponse.ok) {
          const drivePayload: GoogleDriveStatus = await driveResponse.json();
          setDriveStatus(drivePayload);
        }
      } catch {}
      setDriveLoading(false);

      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveProfile() {
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        first_name: firstName || null,
        last_name: lastName || null,
        birth_date: birthDate || null,
        display_name: displayName || null,
      })
      .eq("user_id", user.id);

    setSaving(false);

    if (updateError) {
      toast({ type: "error", title: "Failed to save profile. Please try again." });
      return;
    }

    toast({ type: "success", title: "Profile saved." });
  }

  async function saveSetupPreference() {
    setSavingSetup(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSavingSetup(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ intended_use: intendedUse })
      .eq("user_id", user.id);

    setSavingSetup(false);

    if (updateError) {
      toast({ type: "error", title: "Failed to save setup preference. Please try again." });
      return;
    }

    toast({ type: "success", title: "Setup preference saved." });
  }

  async function saveProductLearningPreference(allow: boolean) {
    setSavingProductLearning(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSavingProductLearning(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ allow_product_improvement_events: allow })
      .eq("user_id", user.id);
    setSavingProductLearning(false);
    if (error) {
      toast({ type: "error", title: "Could not save product improvement setting." });
      return;
    }
    setAllowProductLearning(allow);
    toast({ type: "success", title: allow ? "Product improvement sharing enabled." : "Product improvement sharing disabled." });
  }

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } catch {}
    router.push("/login");
  }

  async function addRealm() {
    const name = newRealmName.trim();
    if (!name) return;

    const duplicate = realms.some((r) => r.name.toLowerCase() === name.toLowerCase());
    if (duplicate) {
      setRealmError("You already have a life area with this name.");
      return;
    }

    setSavingRealm(true);
    setRealmError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingRealm(false); return; }

    const { data, error } = await supabase
      .from("realms")
      .insert({
        user_id: user.id,
        name,
        icon: newRealmIcon,
        color: newRealmColor,
        sort_order: realms.length,
      })
      .select()
      .single();

    if (error) {
      setRealmError("Failed to add life area. Name may already exist.");
      setSavingRealm(false);
      return;
    }

    if (data) setRealms([...realms, data]);
    setNewRealmName("");
    setNewRealmIcon("🌟");
    setNewRealmColor("#6366f1");
    setShowAddRealm(false);
    setSavingRealm(false);
  }

  async function updateRealm(realmId: string) {
    const name = editRealmName.trim();
    if (!name) return;

    const duplicate = realms.some(
      (r) => r.id !== realmId && r.name.toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      setEditError("You already have a life area with this name.");
      return;
    }

    setSavingEdit(true);
    setEditError(null);

    const { error } = await supabase
      .from("realms")
      .update({ name, icon: editRealmIcon || "🌟", color: editRealmColor })
      .eq("id", realmId);

    if (error) {
      setEditError("Failed to save life area. Name may already exist.");
      setSavingEdit(false);
      return;
    }

    setRealms(
      realms.map((r) =>
        r.id === realmId ? { ...r, name, icon: editRealmIcon || "🌟", color: editRealmColor } : r
      )
    );
    setEditingRealmId(null);
    setSavingEdit(false);
  }

  function startEditing(realm: Realm) {
    setEditRealmName(realm.name);
    setEditRealmIcon(realm.icon);
    setEditRealmColor(realm.color);
    setEditingRealmId(realm.id);
    setEditError(null);
    setShowAddRealm(false);
  }

  async function renameFunToFaith() {
    const funRealm = realms.find((r) => r.name === "Fun");
    if (!funRealm) return;

    setSavingEdit(true);
    const { error } = await supabase
      .from("realms")
      .update({ name: "Faith", icon: "🙏", color: "#a855f7" })
      .eq("id", funRealm.id);

    if (!error) {
      setRealms(
        realms.map((r) =>
          r.id === funRealm.id ? { ...r, name: "Faith", icon: "🙏", color: "#a855f7" } : r
        )
      );
    }
    setSavingEdit(false);
  }

  function startEditingMemory(memory: NextronMemoryItem) {
    setEditingMemoryId(memory.id);
    setEditingMemoryContent(memory.content.replace(/^You\s+/i, "I "));
  }

  async function saveMemoryEdit() {
    const content = editingMemoryContent.trim();
    if (!editingMemoryId || !content) return;
    setSavingMemory(true);
    const response = await fetch("/api/nextron/memory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingMemoryId, content }),
    });
    setSavingMemory(false);
    if (!response.ok) {
      const payload: { error?: string } = await response.json().catch(() => ({}));
      toast({ type: "error", title: payload.error ?? "Failed to update memory." });
      return;
    }
    const payload: { memory: NextronMemoryItem } = await response.json();
    setMemories((current) => [payload.memory, ...current.filter((memory) => memory.id !== editingMemoryId)]);
    setEditingMemoryId(null);
    setEditingMemoryContent("");
    toast({ type: "success", title: "NEXTRON memory updated." });
  }

  async function forgetMemory(memory: NextronMemoryItem) {
    setSavingMemory(true);
    const response = await fetch("/api/nextron/memory", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: memory.id }),
    });
    setSavingMemory(false);
    if (!response.ok) {
      const payload: { error?: string } = await response.json().catch(() => ({}));
      toast({ type: "error", title: payload.error ?? "Failed to forget memory." });
      return;
    }
    setMemories((current) => current.filter((item) => item.id !== memory.id));
    if (editingMemoryId === memory.id) setEditingMemoryId(null);
    toast({ type: "success", title: "NEXTRON memory forgotten." });
  }

  async function connectCalendar() {
    setCalendarSaving(true);
    const response = await fetch("/api/integrations/google/calendar/connect", { method: "POST" });
    setCalendarSaving(false);
    const payload: { authUrl?: string; error?: string; missingEnv?: string[] } = await response.json().catch(() => ({}));
    if (!response.ok || !payload.authUrl) {
      toast({ type: "error", title: payload.error ?? "Google Calendar connection is not ready yet." });
      return;
    }
    window.location.assign(payload.authUrl);
  }

  async function saveCalendarPermission(allow: boolean) {
    setCalendarSaving(true);
    const response = await fetch("/api/integrations/google/calendar", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowNextronCalendar: allow }),
    });
    setCalendarSaving(false);
    if (!response.ok) {
      const payload: { error?: string } = await response.json().catch(() => ({}));
      toast({ type: "error", title: payload.error ?? "Failed to update Calendar permission." });
      return;
    }
    setCalendarStatus((current) => current ? { ...current, allowNextronCalendar: allow } : current);
    toast({ type: "success", title: allow ? "NEXTRON Calendar reads enabled." : "NEXTRON Calendar reads disabled." });
  }

  async function disconnectCalendar() {
    setCalendarSaving(true);
    const response = await fetch("/api/integrations/google/calendar", { method: "DELETE" });
    setCalendarSaving(false);
    if (!response.ok) {
      const payload: { error?: string } = await response.json().catch(() => ({}));
      toast({ type: "error", title: payload.error ?? "Failed to disconnect Calendar." });
      return;
    }
    setCalendarStatus((current) => current ? { ...current, connected: false, status: "not_connected", allowNextronCalendar: false } : current);
    toast({ type: "success", title: "Google Calendar disconnected." });
  }

  async function connectDrive() {
    setDriveSaving(true);
    const response = await fetch("/api/integrations/google/drive/connect", { method: "POST" });
    setDriveSaving(false);
    const payload: { authUrl?: string; error?: string; missingEnv?: string[] } = await response.json().catch(() => ({}));
    if (!response.ok || !payload.authUrl) {
      toast({ type: "error", title: payload.error ?? "Google Drive connection is not ready yet." });
      return;
    }
    window.location.assign(payload.authUrl);
  }

  async function saveDrivePermission(allow: boolean) {
    setDriveSaving(true);
    const response = await fetch("/api/integrations/google/drive", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowNextronDrive: allow }),
    });
    setDriveSaving(false);
    if (!response.ok) {
      const payload: { error?: string } = await response.json().catch(() => ({}));
      toast({ type: "error", title: payload.error ?? "Failed to update Drive permission." });
      return;
    }
    setDriveStatus((current) => current ? { ...current, allowNextronDrive: allow } : current);
    toast({ type: "success", title: allow ? "NEXTRON Drive reads enabled." : "NEXTRON Drive reads disabled." });
  }

  async function disconnectDrive() {
    setDriveSaving(true);
    const response = await fetch("/api/integrations/google/drive", { method: "DELETE" });
    setDriveSaving(false);
    if (!response.ok) {
      const payload: { error?: string } = await response.json().catch(() => ({}));
      toast({ type: "error", title: payload.error ?? "Failed to disconnect Drive." });
      return;
    }
    setDriveStatus((current) => current ? { ...current, connected: false, status: "not_connected", allowNextronDrive: false, imports: [] } : current);
    toast({ type: "success", title: "Google Drive disconnected and imported Drive copies removed." });
  }

  const initials = (firstName?.[0] ?? "") + (lastName?.[0] ?? "");
  const recommendedModules = getRecommendedModules(intendedUse);
  const modulesByCategory = getModulesByCategory();

  if (loading) {
    return (
      <DashboardNav>
        <div className="mx-auto max-w-2xl px-5 py-8">
          <div className="mb-8">
            <div className="h-8 w-36 animate-pulse rounded-lg bg-[var(--surface)]" />
            <div className="mt-2 h-4 w-48 animate-pulse rounded-lg bg-[var(--surface-soft)]" />
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-5">
            <div className="mb-4 h-4 w-16 animate-pulse rounded bg-[var(--surface)]" />
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="h-10 animate-pulse rounded-lg bg-[var(--surface)]" />
                <div className="h-10 animate-pulse rounded-lg bg-[var(--surface)]" />
              </div>
              <div className="h-10 animate-pulse rounded-lg bg-[var(--surface)]" />
              <div className="h-10 animate-pulse rounded-lg bg-[var(--surface)]" />
              <div className="h-10 animate-pulse rounded-lg bg-[var(--surface)]" />
            </div>
          </div>
        </div>
      </DashboardNav>
    );
  }

  return (
    <DashboardNav>
      <div className="mx-auto max-w-2xl px-4 py-6 animate-fade-in sm:px-5 sm:py-8">
        <div className="mb-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-4 shadow-sm shadow-black/10 sm:px-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">Account</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text)]">Settings</h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)]">Manage your profile, NEXTRON access, connections, and Life Pulse preferences.</p>
        </div>

        <nav aria-label="Settings sections" className="mb-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <a href="#settings-account" className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/25 hover:text-[var(--accent)]">Account</a>
          <a href="#settings-personalization" className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/25 hover:text-[var(--accent)]">Personalization</a>
          <a href="#settings-nextron" className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/25 hover:text-[var(--accent)]">NEXTRON</a>
          <a href="#settings-connections" className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)]/25 hover:text-[var(--accent)]">Connections</a>
        </nav>

        {/* Profile card */}
        <Card id="settings-account" className="mb-4 scroll-mt-24 border-[var(--border-strong)]">
          <div className="p-5">
            <div className="mb-5 flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-sm font-bold text-[var(--accent)] ring-1 ring-[var(--accent-soft)]">
                {initials ? (
                  initials
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">
                  {displayName || firstName || "Unnamed"}
                </p>
                <p className="text-xs text-[var(--text-muted)]">{email}</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">First name</label>
                    <input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      maxLength={100}
                      className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
                    />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Last name</label>
                    <input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      maxLength={100}
                      className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
                    />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Birth date</label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none [color-scheme:dark]"
                />
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-muted)]">
                  Used to personalize your Life Pulse setup. It is not shown publicly.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Display name</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={100}
                  className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end">
                <Button size="sm" onClick={saveProfile} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Life Pulse setup */}
        <Card id="settings-personalization" className="mb-4 scroll-mt-24 border-[var(--border-strong)]">
          <div className="p-5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Preferences</p>
            <h3 className="mb-1 text-sm font-semibold text-[var(--text)]">Life Pulse setup</h3>
            <p className="mb-4 text-xs leading-relaxed text-[var(--text-muted)]">
              You can change this anytime. It adjusts Life Pulse&apos;s emphasis without deleting your data.
            </p>

            <label className="mb-1.5 block text-xs font-medium text-[var(--text-muted)]">Starting mode</label>
            <select
              value={intendedUse}
              onChange={(e) => setIntendedUse(resolveIntendedUse(e.target.value))}
              className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
            >
              {INTENDED_USE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-[var(--text-muted)]">This changes emphasis only. It does not delete your data.</p>

            <div className="mt-4 flex justify-end">
              <Button size="sm" onClick={saveSetupPreference} disabled={savingSetup}>
                {savingSetup ? "Saving..." : "Save setup"}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="mb-4 border-[var(--border-strong)]">
          <div className="p-5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Privacy</p>
            <h3 className="mb-1 text-sm font-semibold text-[var(--text)]">Help improve Life Pulse</h3>
            <p className="mb-4 text-xs leading-relaxed text-[var(--text-muted)]">
              Share basic usage events so we can improve Life Pulse. This never includes your NEXTRON conversations, journal entries, task names, or other private content.
            </p>
            <label className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <input
                type="checkbox"
                checked={allowProductLearning}
                disabled={savingProductLearning}
                onChange={(event) => void saveProductLearningPreference(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-[var(--border-strong)] bg-[var(--surface-soft)]"
              />
              <span>
                <span className="block text-xs font-semibold text-[var(--text)]">Share product improvement events</span>
                <span className="mt-1 block text-xs leading-relaxed text-[var(--text-muted)]">Optional. Declining does not limit Life Pulse.</span>
              </span>
            </label>
          </div>
        </Card>

        {/* Google Calendar */}
        <Card id="settings-connections" className="mb-4 scroll-mt-24 border-[var(--border-strong)]">
          <div className="p-5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Integrations</p>
            <h3 className="mb-1 text-sm font-semibold text-[var(--text)]">Google Calendar</h3>
            <p className="mb-4 text-xs leading-relaxed text-[var(--text-muted)]">
              Let NEXTRON answer calendar questions. Calendar access is read-only.
            </p>

            {calendarLoading ? (
              <p className="text-xs text-[var(--text-muted)]">Checking Calendar connection...</p>
            ) : (
              <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text)]">
                      {calendarReconnectRequired ? "Reconnect required" : calendarStatus?.connected ? "Connected" : calendarStatus?.status === "error" ? "Connection error" : "Not connected"}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                      {calendarReconnectRequired
                        ? "Your Google authorization expired or was revoked. Reconnect Google Calendar to continue."
                        : calendarStatus?.connected
                        ? "Calendar is connected. NEXTRON reads it only when relevant."
                        : "Connect with read-only access."}
                    </p>
                    {calendarStatus?.missingEnv?.length ? (
                      <p className="mt-1 text-xs text-[var(--danger)]">Server configuration is still missing.</p>
                    ) : null}
                  </div>
                  {calendarStatus?.connected && !calendarReconnectRequired ? (
                    <Button size="sm" variant="ghost" onClick={disconnectCalendar} disabled={calendarSaving}>Disconnect</Button>
                  ) : (
                    <Button size="sm" onClick={connectCalendar} disabled={calendarSaving || Boolean(calendarStatus?.missingEnv?.length)}>
                      {calendarSaving ? "Starting..." : calendarReconnectRequired ? "Reconnect Google Calendar" : "Connect"}
                    </Button>
                  )}
                </div>

                <label className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                  <input
                    type="checkbox"
                    checked={Boolean(calendarStatus?.allowNextronCalendar)}
                    disabled={calendarSaving || !calendarStatus?.connected || calendarReconnectRequired}
                    onChange={(event) => saveCalendarPermission(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-[var(--border-strong)] bg-[var(--surface-soft)]"
                  />
                  <span>
                    <span className="block text-xs font-semibold text-[var(--text)]">Allow NEXTRON to use Calendar</span>
                    <span className="mt-1 block text-xs leading-relaxed text-[var(--text-muted)]">
                      This is separate from connecting your Google account. It does not allow creating, editing, deleting, or responding to events.
                    </span>
                  </span>
                </label>
              </div>
            )}
          </div>
        </Card>

        {/* Google Drive */}
        <Card className="mb-4 border-[var(--border-strong)]">
          <div className="p-5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Integrations</p>
            <h3 className="mb-1 text-sm font-semibold text-[var(--text)]">Google Drive</h3>
            <p className="mb-4 text-xs leading-relaxed text-[var(--text-muted)]">
              Import selected files into Knowledge. Drive access is read-only.
            </p>

            {driveLoading ? (
              <p className="text-xs text-[var(--text-muted)]">Checking Drive connection...</p>
            ) : (
              <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text)]">
                      {driveReconnectRequired ? "Reconnect required" : driveStatus?.connected ? "Connected" : driveStatus?.status === "error" ? "Connection error" : "Not connected"}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                      {driveReconnectRequired
                        ? "Your Google authorization expired or was revoked. Reconnect Google Drive to continue."
                        : driveStatus?.connected
                        ? `${driveStatus.imports.length} selected Drive file${driveStatus.imports.length === 1 ? "" : "s"} imported. Life Pulse cannot browse your whole Drive.`
                        : "Connect selected-file access, then import from Knowledge."}
                    </p>
                    {driveStatus?.missingEnv?.length ? (
                      <p className="mt-1 text-xs text-[var(--danger)]">Server configuration is still missing.</p>
                    ) : null}
                  </div>
                  {driveStatus?.connected && !driveReconnectRequired ? (
                    <Button size="sm" variant="ghost" onClick={disconnectDrive} disabled={driveSaving}>Disconnect</Button>
                  ) : (
                    <Button size="sm" onClick={connectDrive} disabled={driveSaving || Boolean(driveStatus?.missingEnv?.length)}>
                      {driveSaving ? "Starting..." : driveReconnectRequired ? "Reconnect Google Drive" : "Connect"}
                    </Button>
                  )}
                </div>

                <label className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                  <input
                    type="checkbox"
                    checked={Boolean(driveStatus?.allowNextronDrive)}
                    disabled={driveSaving || !driveStatus?.connected || driveReconnectRequired}
                    onChange={(event) => saveDrivePermission(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-[var(--border-strong)] bg-[var(--surface-soft)]"
                  />
                  <span>
                    <span className="block text-xs font-semibold text-[var(--text)]">Allow NEXTRON to use imported Drive files</span>
                    <span className="mt-1 block text-xs leading-relaxed text-[var(--text-muted)]">
                      This only exposes files you imported into Knowledge. It does not allow Drive browsing, search, edits, sharing, or deletion.
                    </span>
                  </span>
                </label>
              </div>
            )}
          </div>
        </Card>

        {/* NEXTRON Memory */}
        <Card id="settings-nextron" className="mb-4 scroll-mt-24 border-[var(--border-strong)]">
          <div className="p-5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">NEXTRON</p>
            <h3 className="mb-1 text-sm font-semibold text-[var(--text)]">NEXTRON Memory</h3>
            <p className="mb-4 text-xs leading-relaxed text-[var(--text-muted)]">
              Memory stores only preferences you explicitly ask NEXTRON to remember.
            </p>

            {memoryLoading ? (
              <p className="text-xs text-[var(--text-muted)]">Loading saved preferences...</p>
            ) : memories.length === 0 ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                <p className="text-sm font-medium text-[var(--text)]">No active preference memories</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                  Ask NEXTRON something like: Remember that I prefer short daily plans.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {memories.map((memory) => (
                  <div key={memory.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                    {editingMemoryId === memory.id ? (
                      <div className="space-y-3">
                        <label className="block text-xs font-medium text-[var(--text-muted)]">Preference</label>
                        <textarea
                          value={editingMemoryContent}
                          onChange={(event) => setEditingMemoryContent(event.target.value)}
                          maxLength={240}
                          rows={3}
                          className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={saveMemoryEdit} disabled={savingMemory || !editingMemoryContent.trim()}>
                            {savingMemory ? "Saving..." : "Save memory"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingMemoryId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <span className="inline-flex rounded-full border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
                            Preference
                          </span>
                          <p className="mt-2 text-sm leading-relaxed text-[var(--text)]">{memory.content}</p>
                          <p className="mt-1 text-xs text-[var(--text-muted)]">Saved {new Date(memory.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => startEditingMemory(memory)} disabled={savingMemory}>
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => forgetMemory(memory)} disabled={savingMemory}>
                            Forget
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <p className="mt-4 text-xs leading-relaxed text-[var(--text-muted)]">
              Memory can shape style, not override your current Life Pulse data.
            </p>
          </div>
        </Card>

        {/* Progression */}
        <details className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)]/60 p-4">
          <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--text)] [&::-webkit-details-marker]:hidden">Progress and modules</summary>
          <div className="mt-4 space-y-4">
        <Card variant="subtle" className="overflow-hidden border-[var(--border)]">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Progression</p>
            <h3 className="text-sm font-semibold text-[var(--text)]">How XP works</h3>
          </div>
          <div className="p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-3">
                <p className="text-xs font-semibold text-[var(--text)]">Private momentum</p>
                <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-muted)]">XP helps you see progress from actions you complete.</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-3">
                <p className="text-xs font-semibold text-[var(--text)]">Active now</p>
                <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-muted)]">Tasks, habits, and reflections can add visible progress.</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-3">
                <p className="text-xs font-semibold text-[var(--text)]">Not a score</p>
                <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-muted)]">It is not a score of your life, health, money, or worth.</p>
              </div>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-[var(--text-muted)]">
              Deeper progression may come later, but this beta keeps XP simple, private, and based on what you log or complete.
            </p>
          </div>
        </Card>

        {/* Module configuration foundation */}
        <Card className="border-[var(--border-strong)]">
          <div className="p-5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Modules / system</p>
            <h3 className="mb-1 text-sm font-semibold text-[var(--text)]">Life Pulse modules</h3>
            <p className="mb-4 text-xs leading-relaxed text-[var(--text-muted)]">
              See what is active now and what is intentionally secondary.
            </p>

            <div className="mb-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border border-[var(--success)]/30 bg-[var(--success-soft)] px-2 py-1 text-[10px] font-medium text-[var(--success)]">
                Available
              </span>
              <span className="inline-flex items-center rounded-full border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-2 py-1 text-[10px] font-medium text-[var(--accent)]">
                Preview
              </span>
              <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[10px] font-medium text-[var(--text-muted)]">
                Planned
              </span>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <h4 className="text-xs font-semibold text-[var(--text)]">Recommended for your starting mode</h4>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                These are the areas Life Pulse emphasizes based on your current setup. Nothing is locked or hidden.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {recommendedModules.map((module) => (
                  <span
                    key={module.key}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--text)]"
                  >
                    {module.label}
                    <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${moduleStatusStyles[module.status]}`}>
                      {getModuleStatusLabel(module.status)}
                    </span>
                  </span>
                ))}
              </div>
            </div>

            <details className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)]/70 p-4">
              <summary className="cursor-pointer list-none text-xs font-semibold text-[var(--text)] [&::-webkit-details-marker]:hidden">Advanced areas</summary>

              <div className="mt-4 space-y-4">
                {moduleCategoryOrder.map((category) => (
                  <section key={category}>
                    <h5 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      {getModuleCategoryLabel(category)}
                    </h5>
                    <div className="space-y-2">
                      {modulesByCategory[category].map((module) => (
                        <div
                          key={module.key}
                          className={`rounded-lg border px-3 py-2.5 transition-colors ${
                            module.status === "planned"
                              ? "border-[var(--border)] bg-[var(--surface)]/35 opacity-75"
                              : "border-[var(--border)] bg-[var(--surface)]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-[var(--text)]">{module.label}</p>
                              <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{module.description}</p>
                            </div>
                            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-medium ${moduleStatusStyles[module.status]}`}>
                              {getModuleStatusLabel(module.status)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </details>

            <p className="mt-4 text-xs leading-relaxed text-[var(--text-muted)]">
              Planned areas are not active yet.
            </p>
          </div>
        </Card>
          </div>
        </details>

        {/* Realms */}
        <Card className="mb-4 border-[var(--border-strong)]">
          <div className="p-5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Connected areas</p>
            <h3 className="mb-1 text-sm font-semibold text-[var(--text)]">
              Life areas
              <HelpPopover title="What are life areas?">
                <p>Life areas are the main parts of your life that you want to grow. Habits, tasks, projects, and XP can connect to them.</p>
                <p className="mt-1.5 text-[var(--text-muted)]">Examples: Mind, Body, Career, Relationships, Finance, Faith, Music</p>
              </HelpPopover>
            </h3>
            <p className="mb-4 text-xs text-[var(--text-muted)]">
              Create and customize the areas that organize your tasks, habits, projects, and progress.
            </p>

            <InfoTip id="settings-life-areas" title="What are life areas?" className="mb-4">
              <p>Life areas are the main parts of your life that you want to grow. Habits, tasks, projects, and XP can be connected to them.</p>
              <p className="mt-1.5 text-[var(--text-muted)]">Examples: Mind, Body, Career, Relationships, Finance, Faith, Music</p>
            </InfoTip>

            {/* Fun → Faith suggestion */}
            {realms.some((r) => r.name === "Fun") && !realms.some((r) => r.name === "Faith") && (
              <div className="mb-4 flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3">
                <p className="text-xs text-[var(--text-muted)]">
                  Want to replace <span className="text-[var(--text)]">Fun</span> with{" "}
                  <span className="text-[var(--text)]">Faith</span>?
                </p>
                <Button size="sm" onClick={renameFunToFaith} disabled={savingEdit}>
                  {savingEdit ? "..." : "Rename Fun to Faith"}
                </Button>
              </div>
            )}

            {/* Realm list */}
            {realms.length > 0 ? (
              <div className="mb-4 space-y-2">
                {realms.map((r) =>
                  editingRealmId === r.id ? (
                    <div key={r.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                      <div className="space-y-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Name</label>
                          <input
                            value={editRealmName}
                            onChange={(e) => setEditRealmName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && updateRealm(r.id)}
                            maxLength={50}
                            className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
                            placeholder="Realm name"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Icon</label>
                          <IconPicker value={editRealmIcon} onChange={setEditRealmIcon} />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Color</label>
                          <ColorPicker value={editRealmColor} onChange={setEditRealmColor} />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => updateRealm(r.id)} disabled={savingEdit || !editRealmName.trim()}>
                            {savingEdit ? "Saving..." : "Save"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingRealmId(null)}>
                            Cancel
                          </Button>
                        </div>
                        {editError && <p className="text-xs text-[var(--danger)]">{editError}</p>}
                      </div>
                    </div>
                  ) : (
                    <div
                      key={r.id}
                      className="flex items-center gap-3 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-4 py-3"
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm"
                        style={{ backgroundColor: r.color + "20", color: r.color }}
                      >
                        {r.icon}
                      </span>
                      <span className="flex-1 text-sm font-medium text-[var(--text)]">{r.name}</span>
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />
                      <button
                        onClick={() => startEditing(r)}
                        className="min-h-10 rounded-md px-2 text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)] sm:min-h-0 sm:px-0"
                      >
                        Edit
                      </button>
                    </div>
                  )
                )}
              </div>
            ) : (
              <p className="mb-4 text-xs text-[var(--text-muted)]">No life areas yet.</p>
            )}

            {/* Add form or button */}
            {showAddRealm ? (
              <div className="mb-4 space-y-3 border-t border-[var(--border-strong)] pt-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Name</label>
                    <input
                      value={newRealmName}
                      onChange={(e) => setNewRealmName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addRealm()}
                      maxLength={50}
                      className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] transition-all duration-150 focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
                      placeholder="e.g. Fitness"
                    />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Icon</label>
                  <IconPicker value={newRealmIcon} onChange={setNewRealmIcon} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Color</label>
                  <ColorPicker value={newRealmColor} onChange={setNewRealmColor} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addRealm} disabled={savingRealm || !newRealmName.trim()}>
                    {savingRealm ? "Adding..." : "Add"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowAddRealm(false)}>
                    Cancel
                  </Button>
                </div>
                {realmError && <p className="text-xs text-[var(--danger)]">{realmError}</p>}
              </div>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                className="mb-4"
                onClick={() => { setShowAddRealm(true); setEditingRealmId(null); }}
              >
                + Add life area
              </Button>
            )}

            <p className="text-xs text-[var(--text-muted)]">
              Life areas appear in habits, tasks, and Insights.
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Archive controls are not active in this beta.
            </p>
          </div>
        </Card>

        {/* Feedback / Beta */}
        <Card className="border-[var(--border-strong)]">
          <div className="p-5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Feedback / support</p>
            <h3 className="mb-3 text-sm font-semibold text-[var(--text)]">Private Beta</h3>
            <p className="mb-3 text-xs leading-relaxed text-[var(--text-muted)]">
              Life Pulse is in private beta. Your feedback shapes what comes next.
              Share what feels confusing, broken, useful, or missing.
            </p>
            <FeedbackButton
              variant="cta"
              label="Send feedback"
              description="Report a bug or confusing moment"
            />
          </div>
        </Card>

        {/* Account */}
        <Card className="border-[var(--border-strong)]">
          <div className="p-5">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Account / security</p>
            <h3 className="mb-1 text-sm font-semibold text-[var(--text)]">Sign out</h3>
            <p className="mb-3 text-xs text-[var(--text-muted)]">End this session on the current device.</p>
            <Button
              variant="danger"
              className="w-full"
              onClick={handleLogout}
            >
              Sign out
            </Button>
          </div>
        </Card>
      </div>
    </DashboardNav>
  );
}
