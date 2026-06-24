-- Life Pulse Knowledge / Information System Migration
-- Stores important information, ideas, resources, and knowledge areas

-- 1. KNOWLEDGE ITEMS
create table if not exists public.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  type text default 'note',
  category text,
  source_url text,
  summary text,
  content text,
  status text default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. KNOWLEDGE COLLECTIONS
create table if not exists public.knowledge_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. KNOWLEDGE COLLECTION ITEMS (junction table)
create table if not exists public.knowledge_collection_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  collection_id uuid not null references public.knowledge_collections(id) on delete cascade,
  item_id uuid not null references public.knowledge_items(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 4. ROW LEVEL SECURITY
alter table public.knowledge_items enable row level security;
alter table public.knowledge_collections enable row level security;
alter table public.knowledge_collection_items enable row level security;

-- 5. POLICIES: KNOWLEDGE ITEMS
drop policy if exists "knowledge_items_select_own" on public.knowledge_items;
create policy "knowledge_items_select_own" on public.knowledge_items
  for select using (auth.uid() = user_id);

drop policy if exists "knowledge_items_insert_own" on public.knowledge_items;
create policy "knowledge_items_insert_own" on public.knowledge_items
  for insert with check (auth.uid() = user_id);

drop policy if exists "knowledge_items_update_own" on public.knowledge_items;
create policy "knowledge_items_update_own" on public.knowledge_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "knowledge_items_delete_own" on public.knowledge_items;
create policy "knowledge_items_delete_own" on public.knowledge_items
  for delete using (auth.uid() = user_id);

-- 6. POLICIES: KNOWLEDGE COLLECTIONS
drop policy if exists "knowledge_collections_select_own" on public.knowledge_collections;
create policy "knowledge_collections_select_own" on public.knowledge_collections
  for select using (auth.uid() = user_id);

drop policy if exists "knowledge_collections_insert_own" on public.knowledge_collections;
create policy "knowledge_collections_insert_own" on public.knowledge_collections
  for insert with check (auth.uid() = user_id);

drop policy if exists "knowledge_collections_update_own" on public.knowledge_collections;
create policy "knowledge_collections_update_own" on public.knowledge_collections
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "knowledge_collections_delete_own" on public.knowledge_collections;
create policy "knowledge_collections_delete_own" on public.knowledge_collections
  for delete using (auth.uid() = user_id);

-- 7. POLICIES: KNOWLEDGE COLLECTION ITEMS
drop policy if exists "knowledge_collection_items_select_own" on public.knowledge_collection_items;
create policy "knowledge_collection_items_select_own" on public.knowledge_collection_items
  for select using (auth.uid() = user_id);

drop policy if exists "knowledge_collection_items_insert_own" on public.knowledge_collection_items;
create policy "knowledge_collection_items_insert_own" on public.knowledge_collection_items
  for insert with check (auth.uid() = user_id);

drop policy if exists "knowledge_collection_items_update_own" on public.knowledge_collection_items;
create policy "knowledge_collection_items_update_own" on public.knowledge_collection_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "knowledge_collection_items_delete_own" on public.knowledge_collection_items;
create policy "knowledge_collection_items_delete_own" on public.knowledge_collection_items
  for delete using (auth.uid() = user_id);

-- 8. INDEXES
create index if not exists idx_knowledge_items_user on public.knowledge_items(user_id);
create index if not exists idx_knowledge_items_type on public.knowledge_items(user_id, type);
create index if not exists idx_knowledge_items_category on public.knowledge_items(user_id, category);
create index if not exists idx_knowledge_collections_user on public.knowledge_collections(user_id);
create index if not exists idx_knowledge_collection_items_collection on public.knowledge_collection_items(collection_id);
create index if not exists idx_knowledge_collection_items_item on public.knowledge_collection_items(item_id);

-- 9. UPDATED_AT TRIGGERS
drop trigger if exists on_knowledge_items_updated on public.knowledge_items;
create trigger on_knowledge_items_updated
  before update on public.knowledge_items
  for each row execute function public.handle_updated_at();

drop trigger if exists on_knowledge_collections_updated on public.knowledge_collections;
create trigger on_knowledge_collections_updated
  before update on public.knowledge_collections
  for each row execute function public.handle_updated_at();
