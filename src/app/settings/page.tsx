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
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingSetup, setSavingSetup] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

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
        .select("first_name, last_name, birth_date, display_name, intended_use")
        .eq("user_id", user.id)
        .single();

      if (cancelled) return;
      if (profile) {
        setFirstName(profile.first_name ?? "");
        setLastName(profile.last_name ?? "");
        setBirthDate(profile.birth_date ?? "");
        setDisplayName(profile.display_name ?? "");
        setIntendedUse(resolveIntendedUse(profile.intended_use));
      }

      const { data: realmData } = await supabase
        .from("realms")
        .select("id, name, color, icon")
        .eq("user_id", user.id)
        .order("sort_order");
      if (realmData) setRealms(realmData);

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
      <div className="mx-auto max-w-2xl px-5 py-8 animate-fade-in">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--text)]">Settings</h1>
          <p className="text-sm text-[var(--text-muted)]">Manage your account and preferences.</p>
        </div>

        {/* Profile card */}
        <Card className="mb-4 border-[var(--border-strong)]">
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
        <Card className="mb-4 border-[var(--border-strong)]">
          <div className="p-5">
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
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              This does not create or delete workspaces, permissions, CRM data, or modules.
            </p>

            <div className="mt-4 flex justify-end">
              <Button size="sm" onClick={saveSetupPreference} disabled={savingSetup}>
                {savingSetup ? "Saving..." : "Save setup"}
              </Button>
            </div>
          </div>
        </Card>

        {/* Module configuration foundation */}
        <Card className="mb-4 border-[var(--border-strong)]">
          <div className="p-5">
            <h3 className="mb-1 text-sm font-semibold text-[var(--text)]">Life Pulse modules</h3>
            <p className="mb-4 text-xs leading-relaxed text-[var(--text-muted)]">
              Your starting mode recommends modules, but nothing is locked. Available modules work today. Preview modules are early or lightweight. Planned modules show where the ecosystem is heading.
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
                These are the areas Life Pulse emphasizes based on your current setup. Nothing is locked.
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

            <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <h4 className="text-xs font-semibold text-[var(--text)]">Full ecosystem roadmap</h4>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                This shows where Life Pulse is heading. Planned modules are not active yet.
              </p>

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
                          className={`rounded-lg border px-3 py-2.5 ${
                            module.status === "planned"
                              ? "border-[var(--border)] bg-[var(--surface)]/60"
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
            </div>

            <p className="mt-4 text-xs leading-relaxed text-[var(--text-muted)]">
              Planned modules are not active yet. This does not create workspaces, team permissions, CRM tools, device sync, AI memory, or database module preferences.
            </p>
          </div>
        </Card>

        {/* Progression customization placeholder */}
        <Card variant="subtle" className="mb-4 border-dashed border-[var(--border)]">
          <div className="p-5">
            <h3 className="mb-1 text-sm font-semibold text-[var(--text)]">Progression</h3>
            <p className="text-xs text-[var(--text-muted)]">
              Custom level titles, XP thresholds, and progression speed &mdash; coming soon.
            </p>
          </div>
        </Card>

        {/* Realms */}
        <Card className="mb-4 border-[var(--border-strong)]">
          <div className="p-5">
            <h3 className="mb-1 text-sm font-semibold text-[var(--text)]">
              Life areas
              <HelpPopover title="What are life areas?">
                <p>Life areas are the main parts of your life that you want to grow. Habits, tasks, projects, and XP can connect to them.</p>
                <p className="mt-1.5 text-[var(--text-muted)]">Examples: Mind, Body, Career, Relationships, Finance, Faith, Music</p>
              </HelpPopover>
            </h3>
            <p className="mb-4 text-xs text-[var(--text-muted)]">
              Create and customize the areas you want to grow in.
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
                        className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
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
              Deleting or archiving life areas is coming later.
            </p>
          </div>
        </Card>

        {/* Feedback / Beta */}
        <Card className="border-[var(--border-strong)]">
          <div className="p-5">
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
            <h3 className="mb-3 text-sm font-semibold text-[var(--text)]">Account</h3>
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
