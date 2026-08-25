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
import { getNextronConversation, listNextronConversations, nextronAsk } from "../../lib/nextron";

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
      // optimistic user message
      const optimistic: Message = { id: clientMessageId, role: "user", content: text };
      setMessages((prev) => [...prev, optimistic]);
      setPrompt("");

      const res = await nextronAsk({
        prompt: text,
        conversationId,
        clientMessageId,
      });

      if (!res.ok) {
        // remove optimistic on auth/network failure? keep and show error
        setError(res.code === "AUTH_REQUIRED" ? "Sign in again to continue." : res.error);
        setSending(false);
        return;
      }

      // res contains conversation + messages authoritative
      const conv = res.conversation as { id: string } | null;
      if (conv?.id) setConversationId(conv.id);
      if (Array.isArray(res.messages)) {
        setMessages(res.messages as Message[]);
      } else {
        // fallback: append assistant
        const assistantText =
          typeof (res.response as Record<string, unknown>)?.interpretation === "string"
            ? ((res.response as Record<string, unknown>).interpretation as string)
            : "NEXTRON replied.";
        setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", content: assistantText, response: res.response }]);
      }
      // refresh conversation list
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
        <Text style={styles.emptyText}>Sign in to talk to NEXTRON.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>NEXTRON</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.newButton} onPress={startNew} accessibilityLabel="Start new conversation">
            <Text style={styles.newButtonText}>New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {conversations.length > 1 ? (
        <View style={styles.recentStrip}>
          <Text style={styles.recentLabel}>Recent</Text>
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
                <Text style={styles.recentChipText} numberOfLines={1}>
                  {c.title || "Conversation"}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void loadConversations()} tintColor="#7aa2c4" />}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {loading && messages.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color="#7aa2c4" />
            <Text style={styles.loadingText}>Loading conversations…</Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Talk to NEXTRON.</Text>
            <Text style={styles.emptyText}>Same memory and conversations as web. Ask anything about your tasks, habits, and goals.</Text>
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
                  {hasProposal ? <Text style={styles.proposalHint}>Action proposed — review on web.</Text> : null}
                </View>
              </View>
            );
          })
        )}
        {sending ? (
          <View style={[styles.bubbleWrap, styles.bubbleWrapAssistant]}>
            <View style={[styles.bubble, styles.bubbleAssistant]}>
              <Text style={styles.bubbleTextAssistant}>NEXTRON is thinking…</Text>
            </View>
          </View>
        ) : null}
        {error && messages.length > 0 ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={prompt}
          onChangeText={setPrompt}
          placeholder="Ask NEXTRON..."
          placeholderTextColor="rgba(255,255,255,0.35)"
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
          <Text style={styles.sendButtonText}>{sending ? "…" : "Send"}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080c12" },
  header: {
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    backgroundColor: "#080c12",
  },
  headerTitle: { color: "#7aa2c4", fontSize: 12, fontWeight: "700", letterSpacing: 1.5 },
  headerActions: { flexDirection: "row", alignItems: "center" },
  newButton: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: "center",
  },
  newButtonText: { color: "#f0f4f8", fontSize: 12, fontWeight: "600" },
  recentStrip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)" },
  recentLabel: { color: "#6b7280", fontSize: 10, fontWeight: "700", letterSpacing: 1, marginRight: 8 },
  recentContent: { flexDirection: "row", gap: 8, alignItems: "center" },
  recentChip: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 160,
  },
  recentChipActive: { backgroundColor: "rgba(122,162,196,0.15)", borderColor: "rgba(122,162,196,0.25)" },
  recentChipText: { color: "#f0f4f8", fontSize: 11 },
  messages: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 12, gap: 10 },
  bubbleWrap: { flexDirection: "row", maxWidth: "86%" },
  bubbleWrapUser: { alignSelf: "flex-end" },
  bubbleWrapAssistant: { alignSelf: "flex-start" },
  bubble: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1 },
  bubbleUser: { backgroundColor: "#7aa2c4", borderColor: "#7aa2c4", borderTopRightRadius: 4 },
  bubbleAssistant: { backgroundColor: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.08)", borderTopLeftRadius: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20, flexShrink: 1 },
  bubbleTextUser: { color: "#071018" },
  bubbleTextAssistant: { color: "#f0f4f8" },
  proposalHint: { marginTop: 6, color: "#7aa2c4", fontSize: 11, fontStyle: "italic" },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    backgroundColor: "#0d1117",
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#f0f4f8",
    fontSize: 14,
    maxHeight: 110,
    minHeight: 44,
  },
  sendButton: {
    backgroundColor: "#7aa2c4",
    borderRadius: 10,
    paddingHorizontal: 16,
    minHeight: 44,
    minWidth: 64,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: { opacity: 0.45 },
  sendButtonText: { color: "#071018", fontSize: 13, fontWeight: "700", textAlign: "center" },
  center: { padding: 24, alignItems: "center", gap: 12 },
  loadingText: { color: "#6b7280", fontSize: 12 },
  empty: { padding: 16, gap: 12 },
  emptyTitle: { color: "#f0f4f8", fontSize: 18, fontWeight: "700" },
  emptyText: { color: "#6b7280", fontSize: 13, lineHeight: 18 },
  starters: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  starter: {
    backgroundColor: "rgba(122,162,196,0.12)",
    borderWidth: 1,
    borderColor: "rgba(122,162,196,0.2)",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  starterText: { color: "#7aa2c4", fontSize: 12, fontWeight: "600" },
  errorText: { color: "#f87171", fontSize: 12, marginTop: 8, textAlign: "center" },
});
