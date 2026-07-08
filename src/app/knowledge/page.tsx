"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardNav } from "@/components/DashboardNav";
import { useToast } from "@/hooks/use-toast";
import { PulseCard } from "@/components/ui/pulse-card";
import { MetricCard } from "@/components/ui/metric-card";
import { EmptyState } from "@/components/ui/empty-state";
import type {
  KnowledgeItem, KnowledgeItemFormData,
  KnowledgeCollection, KnowledgeCollectionFormData,
} from "@/lib/knowledge";
import { KNOWLEDGE_TYPES, KNOWLEDGE_CATEGORIES } from "@/lib/knowledge";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "add", label: "Add Knowledge" },
  { id: "collections", label: "Collections" },
  { id: "recent", label: "Recent Items" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function KnowledgeContent() {
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);

  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [collections, setCollections] = useState<KnowledgeCollection[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  const [itemForm, setItemForm] = useState<KnowledgeItemFormData>({
    title: "", type: "note", category: "", source_url: "", summary: "", content: "",
  });
  const [collectionForm, setCollectionForm] = useState<KnowledgeCollectionFormData>({
    name: "", description: "",
  });

  const loadAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }
    setCurrentUser(user);

    const [iRes, cRes] = await Promise.all([
      supabase.from("knowledge_items").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("knowledge_collections").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);

    setItems((iRes.data ?? []) as KnowledgeItem[]);
    setCollections((cRes.data ?? []) as KnowledgeCollection[]);
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      await loadAll();
      if (cancelled) return;
    };
    init();
    return () => { cancelled = true; };
  }, [loadAll]);

  const handleSaveItem = async () => {
    if (!itemForm.title.trim() || !currentUser) return;
    setSaving(true);
    const { error } = await supabase.from("knowledge_items").insert({
      user_id: currentUser.id,
      title: itemForm.title.trim(),
      type: itemForm.type,
      category: itemForm.category || null,
      source_url: itemForm.source_url || null,
      summary: itemForm.summary || null,
      content: itemForm.content || null,
    });
    if (error) { console.error("Failed to save knowledge item", error); toast({ type: "error", title: "Failed to save" }); setSaving(false); return; }
    toast({ type: "success", title: "Knowledge saved!" });
    setItemForm({ title: "", type: "note", category: "", source_url: "", summary: "", content: "" });
    loadAll();
    setSaving(false);
  };

  const handleSaveCollection = async () => {
    if (!collectionForm.name.trim() || !currentUser) return;
    setSaving(true);
    const { error } = await supabase.from("knowledge_collections").insert({
      user_id: currentUser.id,
      name: collectionForm.name.trim(),
      description: collectionForm.description || null,
    });
    if (error) { console.error("Failed to save collection", error); toast({ type: "error", title: "Failed to save collection" }); setSaving(false); return; }
    toast({ type: "success", title: "Collection created!" });
    setCollectionForm({ name: "", description: "" });
    loadAll();
    setSaving(false);
  };

  const handleDeleteItem = async (id: string) => {
    const { error } = await supabase.from("knowledge_items").delete().eq("id", id);
    if (error) { console.error("Failed to delete item", error); toast({ type: "error", title: "Failed to delete" }); return; }
    toast({ type: "success", title: "Item deleted" });
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleDeleteCollection = async (id: string) => {
    const { error } = await supabase.from("knowledge_collections").delete().eq("id", id);
    if (error) { console.error("Failed to delete collection", error); toast({ type: "error", title: "Failed to delete" }); return; }
    toast({ type: "success", title: "Collection deleted" });
    setCollections((prev) => prev.filter((c) => c.id !== id));
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    const matchesType = !selectedType || item.type === selectedType;
    const matchesCategory = !selectedCategory || item.category === selectedCategory;
    const searchableText = [item.title, item.type, item.category, item.summary, item.content]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesSearch = !normalizedSearch || searchableText.includes(normalizedSearch);
    return matchesType && matchesCategory && matchesSearch;
  });

  if (loading) return null;

  return (
    <div className="animate-fade-in p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--text)]">Knowledge</h1>
          <p className="text-sm text-[var(--text-muted)]">Your information system for ideas, resources, lessons, and notes.</p>
        </div>

        <div className="mb-6 flex gap-1 rounded-xl bg-[var(--surface-soft)] p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 rounded-lg px-3 py-2 text-center text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ════════════════ OVERVIEW ════════════════ */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard label="Total Items" value={items.length} icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              } trend={items.length > 0 ? "up" : "neutral"} active={items.length > 0} />
              <MetricCard label="Collections" value={collections.length} icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                </svg>
              } trend={collections.length > 0 ? "up" : "neutral"} active={collections.length > 0} />
              <MetricCard label="Notes" value={items.filter((i) => i.type === "note").length} icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
              } trend="neutral" active={items.filter((i) => i.type === "note").length > 0} />
              <MetricCard label="Resources" value={items.filter((i) => i.type === "resource" || i.type === "article" || i.type === "book").length} icon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              } trend="neutral" active={items.filter((i) => ["resource", "article", "book"].includes(i.type)).length > 0} />
            </div>

            <PulseCard title="Your Knowledge Library" accent="accent" description="Store and organize what matters">
              <div className="px-4 py-4 space-y-3">
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  The Information System is where Life Pulse stores important knowledge, useful resources, ideas, lessons, and notes that should not disappear into random apps.
                  Save articles, book notes, course takeaways, life lessons, and any reference material you want to keep.
                </p>
                {items.length === 0 && collections.length === 0 && (
                  <EmptyState title="Overview" message="No knowledge items yet. Save notes, articles, ideas, and reference materials to organize what matters." action={<Link href="/knowledge" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">Add your first item &rarr;</Link>} />
                )}
              </div>
            </PulseCard>
          </div>
        )}

        {/* ════════════════ ADD KNOWLEDGE ════════════════ */}
        {activeTab === "add" && (
          <div className="space-y-6">
            <PulseCard title="Add Knowledge Item" accent="accent">
              <div className="grid grid-cols-2 gap-3 p-4">
                <input type="text" placeholder="Title" value={itemForm.title}
                  onChange={(e) => setItemForm((f) => ({ ...f, title: e.target.value }))}
                  data-testid="knowledge-item-title-input"
                  className="col-span-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)]" />
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-medium text-[var(--text-muted)]">Type</label>
                  <select value={itemForm.type} onChange={(e) => setItemForm((f) => ({ ...f, type: e.target.value }))}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text)] outline-none">
                    {KNOWLEDGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-medium text-[var(--text-muted)]">Category</label>
                  <select value={itemForm.category} onChange={(e) => setItemForm((f) => ({ ...f, category: e.target.value }))}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text)] outline-none">
                    <option value="">None</option>
                    {KNOWLEDGE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <input type="url" placeholder="Source URL (optional)" value={itemForm.source_url}
                  onChange={(e) => setItemForm((f) => ({ ...f, source_url: e.target.value }))}
                  className="col-span-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none" />
                <textarea placeholder="Summary (optional)" value={itemForm.summary}
                  onChange={(e) => setItemForm((f) => ({ ...f, summary: e.target.value }))}
                  className="col-span-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none resize-none" rows={2} />
                <textarea placeholder="Content / Notes" value={itemForm.content}
                  onChange={(e) => setItemForm((f) => ({ ...f, content: e.target.value }))}
                  className="col-span-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none resize-none" rows={4} />
                <div className="col-span-2 flex justify-end">
                  <button onClick={handleSaveItem} disabled={saving || !itemForm.title.trim()}
                    data-testid="knowledge-item-save-button"
                    className="rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-medium text-[var(--text-on-accent)] transition-all hover:opacity-90 disabled:opacity-40">
                    {saving ? "Saving..." : "Save Knowledge"}
                  </button>
                </div>
              </div>
            </PulseCard>
          </div>
        )}

        {/* ════════════════ COLLECTIONS ════════════════ */}
        {activeTab === "collections" && (
          <div className="space-y-6">
            <PulseCard title="Create Collection" accent="accent">
              <div className="grid grid-cols-2 gap-3 p-4">
                <input type="text" placeholder="Collection name" value={collectionForm.name}
                  onChange={(e) => setCollectionForm((f) => ({ ...f, name: e.target.value }))}
                  data-testid="knowledge-collection-name-input"
                  className="col-span-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)]" />
                <textarea placeholder="Description (optional)" value={collectionForm.description}
                  onChange={(e) => setCollectionForm((f) => ({ ...f, description: e.target.value }))}
                  className="col-span-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none resize-none" rows={2} />
                <div className="col-span-2 flex justify-end">
                  <button onClick={handleSaveCollection} disabled={saving || !collectionForm.name.trim()}
                    data-testid="knowledge-collection-save-button"
                    className="rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-medium text-[var(--text-on-accent)] transition-all hover:opacity-90 disabled:opacity-40">
                    {saving ? "Saving..." : "Create Collection"}
                  </button>
                </div>
              </div>
            </PulseCard>

            {collections.length === 0 ? (
              <PulseCard title="Your Collections" accent="accent">
                <EmptyState title="Your Collections" message="No collections yet. Collections group related knowledge items together — like a folder for a topic or project." action={<Link href="/knowledge" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">Create a collection &rarr;</Link>} />
              </PulseCard>
            ) : (
              <PulseCard title="Your Collections" accent="accent" description={`${collections.length} total`}>
                <div className="divide-y divide-[var(--border)]">
                  {collections.map((c) => (
                    <div key={c.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium text-[var(--text)]">{c.name}</span>
                        {c.description && <span className="text-[10px] text-[var(--text-muted)]">{c.description}</span>}
                      </div>
                      <button onClick={() => handleDeleteCollection(c.id)}
                        className="text-[10px] text-[var(--danger)] hover:underline">Delete</button>
                    </div>
                  ))}
                </div>
              </PulseCard>
            )}
          </div>
        )}

        {/* ════════════════ RECENT ITEMS ════════════════ */}
        {activeTab === "recent" && (
          <div>
            {items.length === 0 ? (
              <PulseCard title="Recent Items" accent="accent">
                <EmptyState title="Recent Items" message="No knowledge items yet. Add notes, links, articles, and reference material to build your personal library." action={<Link href="/knowledge" className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-strong)] transition-colors">Add your first item &rarr;</Link>} />
              </PulseCard>
            ) : (
              <PulseCard title="Recent Items" accent="accent" description={`${items.length} total`}>
                <div className="border-b border-[var(--border)] px-4 py-4">
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                    <input
                      type="search"
                      placeholder="Search knowledge..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)]"
                    />
                    <select
                      value={selectedType}
                      onChange={(e) => setSelectedType(e.target.value)}
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
                    >
                      <option value="">All types</option>
                      {KNOWLEDGE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                    </select>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]"
                    >
                      <option value="">All categories</option>
                      {KNOWLEDGE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                    </select>
                  </div>
                  <div className="mt-3 flex flex-col gap-1 text-[10px] text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
                    <span>Showing {filteredItems.length} of {items.length} items</span>
                    <span>Private manual knowledge library. No AI summaries or external processing.</span>
                  </div>
                </div>

                {filteredItems.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm font-medium text-[var(--text)]">No matching knowledge found.</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">Try changing the search or filters.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--border)]">
                    {filteredItems.map((item) => (
                      <div key={item.id} className="group flex items-center justify-between px-4 py-3">
                        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-[var(--text)] truncate">{item.title}</span>
                            <span className="shrink-0 rounded-full bg-[var(--surface-soft)] px-2 py-0.5 text-[9px] font-medium text-[var(--text-muted)]">{item.type}</span>
                            {item.category && <span className="shrink-0 text-[9px] text-[var(--text-muted)]">{item.category}</span>}
                          </div>
                          {item.summary && <span className="text-[10px] text-[var(--text-muted)] truncate">{item.summary}</span>}
                          <span className="text-[9px] text-[var(--text-muted)]">{new Date(item.created_at).toLocaleDateString()}</span>
                        </div>
                        <button onClick={() => handleDeleteItem(item.id)}
                          className="shrink-0 text-[10px] text-[var(--danger)] opacity-0 group-hover:opacity-100 transition-opacity">Delete</button>
                      </div>
                    ))}
                  </div>
                )}
              </PulseCard>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function KnowledgePage() {
  return (
    <DashboardNav>
      <KnowledgeContent />
    </DashboardNav>
  );
}
