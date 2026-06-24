export interface KnowledgeItem {
  id: string;
  user_id: string;
  title: string;
  type: string;
  category: string | null;
  source_url: string | null;
  summary: string | null;
  content: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeItemFormData {
  title: string;
  type: string;
  category: string;
  source_url: string;
  summary: string;
  content: string;
}

export interface KnowledgeCollection {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeCollectionFormData {
  name: string;
  description: string;
}

export const KNOWLEDGE_TYPES = [
  "note", "article", "book", "video", "course", "idea", "resource", "lesson", "other",
] as const;

export const KNOWLEDGE_CATEGORIES = [
  "Mind & Learning", "Health & Fitness", "Career & Work",
  "Finance & Money", "Relationships", "Spirituality & Faith",
  "Creativity", "Technology", "Philosophy", "Other",
] as const;
