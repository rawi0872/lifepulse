import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useAuth } from "../../lib/auth";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getNextronConversation, listNextronConversations, nextronAsk } from "../../lib/nextron";
import { colors, spacing, radii, type } from "../../lib/theme";
import { NextronIcon, Plus, ChevronRight } from "../../src/icons";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
  response?: unknown;
};

function extractAssistantText(msg: Message): string {
  if (msg.content) return msg.content;
  const r = msg.response as Record<string, unknown> | null;
  if (r && typeof r.interpretation === "string") return r.interpretation as string;
  if (r && typeof r.response === "string") return r.response as string;
  return "";
}

function formatTime(iso?: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

const STARTERS = ["What should I focus on today?", "Summarize my progress", "Help me plan tomorrow"];

function ContextStrip({ compact = false }: { compact?: boolean }) {
  // Truthful, privacy-safe context visibility — derived from real evidence categories, no raw data.
  // Body and Wealth are private by default; Today/Tasks/Habits are core.
  return (
    <View style={[styles.contextStrip, compact && styles.contextStripCompact]}>
      <View style={styles.contextPill}>
        <View style={[styles.contextDot, styles.contextDotActive]} />
        <Text style={styles.contextText}>Today</Text>
      </View>
      <Text style={styles.contextSep}>·</Text>
      <View style={styles.contextPill}>
        <View style={[styles.contextDot, styles.contextDotActive]} />
        <Text style={styles.contextText}>Tasks</Text>
      </View>
      <Text style={styles.contextSep}>·</Text>
      <View style={styles.contextPill}>
        <View style={[styles.contextDot, styles.contextDotActive]} />
        <Text style={styles.contextText}>Habits</Text>
      </View>
      <Text style={styles.contextSep}>·</Text>
      <View style={[styles.contextPill, styles.contextPillMuted]}>
        <View style={[styles.contextDot, styles.contextDotMuted]} />
        <Text style={[styles.contextText, styles.contextTextMuted]}>Body</Text>
      </View>
      <Text style={styles.contextSep}>·</Text>
      <View style={[styles.contextPill, styles.contextPillMuted]}>
        <View style={[styles.contextDot, styles.contextDotMuted]} />
        <Text style={[styles.contextText, styles.contextTextMuted]}>Wealth</Text>
      </View>
      <Text style={styles.contextHint}>{compact ? "" : "  private by default"}</Text>
    </View>
  );
}

export default function NextronScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Array<{ id: string; title: string }>>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const res = await listNextronConversations();
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setConversations(res.conversations as Array<{ id: string; title: string }>);
    if (res.conversations.length > 0 && !conversationId) {
      const first = res.conversations[0] as { id: string };
      setConversationId(first.id);
      const conv = await getNextronConversation(first.id);
      if (conv.ok) {
        setMessages((conv.messages as Message[]) ?? []);
      }
    }
    setLoading(false);
  }, [user, conversationId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadConversations();
  }, [loadConversations]);

  const refreshConversation = useCallback(
    async (id: string) => {
      const conv = await getNextronConversation(id);
      if (conv.ok) setMessages((conv.messages as Message[]) ?? []);
    },
    [],
  );

  const handleSend = useCallback(
    async (overridePrompt?: string) => {
      const text = (overridePrompt ?? prompt).trim();
      if (!text || sending) return;
      if (!user) {
        setError("Sign in to talk to NEXTRON.");
        return;
      }
      setSending(true);
      setError(null);
      const clientMessageId = `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimistic: Message = { id: clientMessageId, role: "user", content: text };
      setMessages((prev) => [...prev, optimistic]);
      setPrompt("");

      const res = await nextronAsk({
        prompt: text,
        conversationId,
        clientMessageId,
      });

      if (!res.ok) {
        setError(res.code === "AUTH_REQUIRED" ? "Sign in again to continue." : res.error);
        setSending(false);
        return;
      }

      const conv = res.conversation as { id: string } | null;
      if (conv?.id) setConversationId(conv.id);
      if (Array.isArray(res.messages)) {
        setMessages(res.messages as Message[]);
      } else {
        const assistantText =
          typeof (res.response as Record<string, unknown>)?.interpretation === "string"
            ? ((res.response as Record<string, unknown>).interpretation as string)
            : "NEXTRON replied.";
        setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", content: assistantText, response: res.response }]);
      }
      const list = await listNextronConversations();
      if (list.ok) setConversations(list.conversations as Array<{ id: string; title: string }>);
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    },
    [prompt, sending, user, conversationId],
  );

  const startNew = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setError(null);
  }, []);

  if (!user) {
    return (
      <View style={styles.center}>
        <NextronIcon size={28} variant="brand" />
        <Text style={styles.emptyTitle}>Sign in to talk to NEXTRON.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 8 : 0}
    >
      {/* Premium header — Orbital N preserved, restrained hierarchy */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerLeft}>
          <View style={styles.headerMark}>
            <NextronIcon size={28} variant="brand" />
          </View>
          <View>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>NEXTRON</Text>
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>PREMIUM</Text>
              </View>
            </View>
            <Text style={styles.headerSub}>Life Pulse Intelligence  •  interprets, verifies, you authorize</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.newButton} onPress={startNew} accessibilityLabel="Start new conversation">
          <Plus size={16} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Context visibility — compact, truthful, permission-aware */}
      {messages.length > 0 && (
        <View style={styles.contextHeaderWrap}>
          <ContextStrip compact />
        </View>
      )}

      {/* Recents — only when useful, premium pill */}
      {conversations.length > 1 && (
        <View style={styles.recentStrip}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentContent}>
            {conversations.slice(0, 6).map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.recentChip, conversationId === c.id && styles.recentChipActive]}
                onPress={async () => {
                  setConversationId(c.id);
                  await refreshConversation(c.id);
                }}
              >
                <Text style={[styles.recentChipText, conversationId === c.id && styles.recentChipTextActive]} numberOfLines={1}>
                  {c.title || "Conversation"}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void loadConversations()} tintColor={colors.accent} />}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {loading && messages.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.loadingText}>Loading conversations…</Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyOrbit}>
              <NextronIcon size={44} variant="brand" />
            </View>
            <Text style={styles.emptyTitle}>What do you want to figure out?</Text>
            <Text style={styles.emptyText}>Same memory and conversations as web. NEXTRON reads only what you allow — Today is always visible, Body and Wealth stay private until you enable them.</Text>
            <ContextStrip />
            <View style={styles.starters}>
              {STARTERS.map((s) => (
                <TouchableOpacity key={s} style={styles.starter} onPress={() => void handleSend(s)}>
                  <Text style={styles.starterText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.emptyMeta}>
              <Text style={styles.emptyMetaText}>AI interprets · Life Pulse verifies · you authorize</Text>
              <Text style={styles.emptyMetaText}>No autonomy · no background actions · web has full details</Text>
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        ) : (
          messages.map((m) => {
            const isUser = m.role === "user";
            const text = isUser ? m.content : extractAssistantText(m);
            const hasProposal = !isUser && !!(m.response as Record<string, unknown>)?.richResponse;
            const ts = formatTime(m.created_at);
            return (
              <View key={m.id} style={[styles.bubbleWrap, isUser ? styles.bubbleWrapUser : styles.bubbleWrapAssistant]}>
                <View style={styles.bubbleMeta}>
                  <Text style={styles.bubbleRole}>{isUser ? "You" : "NEXTRON"}</Text>
                  {ts ? <Text style={styles.bubbleTime}>{ts}</Text> : null}
                </View>
                <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
                  <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant]} selectable>
                    {text}
                  </Text>
                  {hasProposal && (
                    <View style={styles.proposalCard}>
                      <View style={styles.proposalHeader}>
                        <View style={styles.proposalDot} />
                        <Text style={styles.proposalLabel}>Suggested action</Text>
                        <Text style={styles.proposalSep}>·</Text>
                        <Text style={styles.proposalStatus}>requires your approval</Text>
                      </View>
                      <Text style={styles.proposalHint}>Not yet executed. Review and authorize on web for full details.</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}
        {sending && (
          <View style={[styles.bubbleWrap, styles.bubbleWrapAssistant]}>
            <View style={styles.bubbleMeta}>
              <Text style={styles.bubbleRole}>NEXTRON</Text>
            </View>
            <View style={[styles.bubble, styles.bubbleAssistant, styles.bubbleThinking]}>
              <View style={styles.thinkingRow}>
                <ActivityIndicator size="small" color={colors.textMuted} />
                <Text style={styles.thinkingText}>Reviewing permitted context…</Text>
              </View>
              <Text style={styles.thinkingSub}>Preparing a response</Text>
            </View>
          </View>
        )}
        {error && messages.length > 0 ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>

      {/* Composer — premium, keyboard-aware, scroll-safe */}
      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) + 10 }]}>
        <View style={styles.composerInner}>
          <TextInput
            style={styles.input}
            value={prompt}
            onChangeText={setPrompt}
            placeholder="Ask NEXTRON…"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={2000}
            returnKeyType="send"
            onSubmitEditing={() => void handleSend()}
            editable={!sending}
            textAlignVertical="center"
          />
          <TouchableOpacity
            style={[styles.sendButton, (!prompt.trim() || sending) && styles.sendButtonDisabled]}
            onPress={() => void handleSend()}
            disabled={!prompt.trim() || sending}
            accessibilityLabel="Send to NEXTRON"
          >
            <ChevronRight size={18} color={colors.onAccent} />
          </TouchableOpacity>
        </View>
        <Text style={styles.composerHint}>Today → NEXTRON: high-priority tasks and habits are summarized, never raw records.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1, flexShrink: 1 },
  headerMark: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  headerTitle: { color: colors.accentStrong, fontSize: 13, fontWeight: "700", letterSpacing: 1.6 },
  headerBadge: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: radii.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  headerBadgeText: { color: colors.accentStrong, fontSize: 8, fontWeight: "700", letterSpacing: 0.8 },
  headerSub: { color: colors.textMuted, fontSize: 10, marginTop: 2, lineHeight: 13 },
  newButton: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  contextHeaderWrap: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: 2 },
  contextStrip: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
  },
  contextStripCompact: { paddingVertical: 6, paddingHorizontal: spacing.sm, gap: 4 },
  contextPill: { flexDirection: "row", alignItems: "center", gap: 5 },
  contextPillMuted: { opacity: 0.55 },
  contextDot: { width: 6, height: 6, borderRadius: 3 },
  contextDotActive: { backgroundColor: colors.accent },
  contextDotMuted: { backgroundColor: colors.textMuted },
  contextText: { color: colors.textSecondary, fontSize: 11, fontWeight: "600", letterSpacing: 0.2 },
  contextTextMuted: { color: colors.textMuted },
  contextSep: { color: colors.textFaint, fontSize: 11 },
  contextHint: { color: colors.textFaint, fontSize: 10, marginLeft: 2 },

  recentStrip: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  recentContent: { flexDirection: "row", gap: spacing.sm, paddingRight: spacing.xl },
  recentChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    minWidth: 110,
    maxWidth: 160,
  },
  recentChipActive: { backgroundColor: colors.surfaceElevated, borderColor: colors.accentBorder },
  recentChipText: { color: colors.textMuted, fontSize: 11, fontWeight: "500" },
  recentChipTextActive: { color: colors.textPrimary },

  messages: { flex: 1 },
  messagesContent: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, gap: spacing.lg },
  bubbleWrap: { maxWidth: "86%", gap: 4 },
  bubbleWrapUser: { alignSelf: "flex-end", alignItems: "flex-end" },
  bubbleWrapAssistant: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubbleMeta: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: 2 },
  bubbleRole: { color: colors.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  bubbleTime: { color: colors.textFaint, fontSize: 10 },
  bubble: { borderRadius: radii.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderWidth: 1 },
  bubbleUser: { backgroundColor: colors.accent, borderColor: colors.accent, borderTopRightRadius: 4 },
  bubbleAssistant: { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderTopLeftRadius: 4 },
  bubbleThinking: { borderStyle: "dashed" },
  bubbleText: { fontSize: 14, lineHeight: 20, flexShrink: 1 },
  bubbleTextUser: { color: colors.onAccent },
  bubbleTextAssistant: { color: colors.textPrimary },
  thinkingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  thinkingText: { color: colors.textSecondary, fontSize: 12, fontWeight: "600" },
  thinkingSub: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  proposalCard: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  proposalHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  proposalDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  proposalLabel: { color: colors.textPrimary, fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
  proposalSep: { color: colors.textFaint, fontSize: 11 },
  proposalStatus: { color: colors.textMuted, fontSize: 11 },
  proposalHint: { color: colors.textMuted, fontSize: 11, lineHeight: 14, marginTop: 4 },

  center: { padding: 24, alignItems: "center", gap: spacing.md, flex: 1, justifyContent: "center" },
  loadingText: { color: colors.textMuted, fontSize: 12 },
  emptyState: { paddingHorizontal: spacing.xl, paddingVertical: spacing.xl, gap: spacing.md, alignItems: "center" },
  emptyOrbit: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { ...type.screen, color: colors.textPrimary, textAlign: "center", fontSize: 20 },
  emptyText: { ...type.body, color: colors.textSecondary, textAlign: "center", lineHeight: 22, maxWidth: 320 },
  starters: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm, justifyContent: "center" },
  starter: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  starterText: { color: colors.textPrimary, fontSize: 12, fontWeight: "600" },
  emptyMeta: { alignItems: "center", gap: 2, marginTop: spacing.md },
  emptyMetaText: { color: colors.textFaint, fontSize: 10, textAlign: "center", letterSpacing: 0.2 },
  errorText: { color: colors.danger, fontSize: 12, marginTop: spacing.sm, textAlign: "center" },

  composer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  composerInner: { flexDirection: "row", alignItems: "flex-end", gap: spacing.md },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 14,
    maxHeight: 110,
    minHeight: 44,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sendButtonDisabled: { opacity: 0.45 },
  composerHint: { color: colors.textFaint, fontSize: 9, textAlign: "center", letterSpacing: 0.2 },
});
