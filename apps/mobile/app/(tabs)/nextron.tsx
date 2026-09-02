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

const STARTERS = ["What should I focus on today?", "Summarize my progress", "Help me plan tomorrow"];

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
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <NextronIcon size={28} variant="brand" />
          <View>
            <Text style={styles.headerTitle}>NEXTRON</Text>
            <Text style={styles.headerSub}>Life Pulse Intelligence</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.newButton} onPress={startNew} accessibilityLabel="Start new conversation">
            <Plus size={16} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Recents strip - compact */}
      {conversations.length > 1 && (
        <View style={styles.recentStrip}>
          <View style={styles.recentContent}>
            {conversations.slice(0, 8).map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.recentChip, conversationId === c.id && styles.recentChipActive]}
                onPress={async () => {
                  setConversationId(c.id);
                  await refreshConversation(c.id);
                }}
              >
                <Text style={styles.recentChipText} numberOfLines={1}>
                  {c.title || "Conversation"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Messages area */}
      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
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
            <NextronIcon size={40} variant="brand" />
            <Text style={styles.emptyTitle}>What do you want to figure out?</Text>
            <Text style={styles.emptyText}>
              Same memory and conversations as web. Ask anything about your tasks, habits, and goals.
            </Text>
            <View style={styles.starters}>
              {STARTERS.map((s) => (
                <TouchableOpacity key={s} style={styles.starter} onPress={() => void handleSend(s)}>
                  <Text style={styles.starterText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        ) : (
          messages.map((m) => {
            const isUser = m.role === "user";
            const text = isUser ? m.content : extractAssistantText(m);
            const hasProposal = !isUser && !!(m.response as Record<string, unknown>)?.richResponse;
            return (
              <View key={m.id} style={[styles.bubbleWrap, isUser ? styles.bubbleWrapUser : styles.bubbleWrapAssistant]}>
                <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
                  <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant]}>{text}</Text>
                  {hasProposal && (
                    <View style={styles.proposalCard}>
                      <Text style={styles.proposalLabel}>Action proposed</Text>
                      <Text style={styles.proposalHint}>Review on web for details</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}
        {sending && (
          <View style={[styles.bubbleWrap, styles.bubbleWrapAssistant]}>
            <View style={[styles.bubble, styles.bubbleAssistant]}>
              <Text style={styles.bubbleTextAssistant}>NEXTRON is thinking…</Text>
            </View>
          </View>
        )}
        {error && messages.length > 0 ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>

      {/* Composer */}
      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) + 10 }]}>
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingTop: 56,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  headerMark: {
    width: 30,
    height: 30,
    borderRadius: radii.sm,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: colors.accentStrong, fontSize: 13, fontWeight: "700", letterSpacing: 1.5 },
  headerSub: { color: colors.textMuted, fontSize: 10, marginTop: 1 },
  headerActions: { flexDirection: "row", alignItems: "center" },
  newButton: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  recentStrip: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  recentContent: { flexDirection: "row", gap: spacing.sm },
  recentChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minWidth: 100,
  },
  recentChipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder },
  recentChipText: { color: colors.textPrimary, fontSize: 11, fontWeight: "500" },

  messages: { flex: 1 },
  messagesContent: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, gap: spacing.md },
  bubbleWrap: { flexDirection: "row", maxWidth: "85%" },
  bubbleWrapUser: { alignSelf: "flex-end" },
  bubbleWrapAssistant: { alignSelf: "flex-start" },
  bubble: { borderRadius: radii.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1 },
  bubbleUser: { backgroundColor: colors.accent, borderColor: colors.accent, borderTopRightRadius: 4 },
  bubbleAssistant: { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderTopLeftRadius: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20, flexShrink: 1 },
  bubbleTextUser: { color: colors.onAccent },
  bubbleTextAssistant: { color: colors.textPrimary },
  proposalCard: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
    borderRadius: radii.sm,
  },
  proposalLabel: { ...type.caption, color: colors.warning, fontWeight: "700", letterSpacing: 0.5 },
  proposalHint: { ...type.meta, color: colors.warning, marginTop: spacing.xs },

  center: { padding: 24, alignItems: "center", gap: spacing.md },
  loadingText: { color: colors.textMuted, fontSize: 12 },
  emptyState: { padding: spacing.xl, gap: spacing.lg, alignItems: "center" },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { ...type.screen, color: colors.textPrimary, textAlign: "center" },
  emptyText: { ...type.body, color: colors.textSecondary, textAlign: "center", lineHeight: 22 },
  starters: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm, justifyContent: "center" },
  starter: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  starterText: { color: colors.accentStrong, fontSize: 12, fontWeight: "600" },
  errorText: { color: colors.danger, fontSize: 12, marginTop: spacing.sm, textAlign: "center" },

  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontSize: 14,
    maxHeight: 100,
    minHeight: 44,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sendButtonDisabled: { opacity: 0.45 },
});