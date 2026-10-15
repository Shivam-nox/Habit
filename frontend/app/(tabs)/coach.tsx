// components/coach.tsx — full rewrite with:
// Issue #8: Handle action/snapshot from chat response
// Issue #17: Load chat history on mount
// Issue #18: Show suggestion chips persistently after AI replies
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  ScrollView, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { MotiView, MotiText, AnimatePresence } from 'moti';
import { Easing } from 'react-native-reanimated';
import { useApi } from '../../services/api';
import { useFocusEffect } from 'expo-router';

// --- Minimal palette: one accent, everything else neutral ---
const C = {
  bg: '#FAFAFA',
  surface: '#FFFFFF',
  text: '#111827',
  muted: '#9CA3AF',
  border: '#EEEEEE',
  accent: '#111827',
  accentSoft: '#F0F4F3',
  brand: '#2E7D6E',
  success: '#16A34A',
};

const fmt = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
}

// --- Typing indicator: three dots, gentle pulse ---
const TypingIndicator = () => (
  <MotiView
    from={{ opacity: 0, translateY: 6, scale: 0.95 }}
    animate={{ opacity: 1, translateY: 0, scale: 1 }}
    exit={{ opacity: 0, scale: 0.9 }}
    transition={{ type: 'timing', duration: 220 }}
    style={styles.typingBubble}
  >
    {[0, 1, 2].map((i) => (
      <MotiView
        key={i}
        from={{ opacity: 0.3, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          loop: true,
          type: 'timing',
          duration: 600,
          delay: i * 160,
          easing: Easing.inOut(Easing.ease),
        }}
        style={styles.typingDot}
      />
    ))}
  </MotiView>
);

const Bubble = ({ item, isUser }: { item: Message; isUser: boolean }) => {
  const [pressed, setPressed] = useState(false);
  return (
    <MotiView
      from={{ opacity: 0, translateY: 10, scale: 0.96 }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      transition={{ type: 'spring', damping: 16, stiffness: 180 }}
      style={[styles.row, isUser ? styles.rowUser : styles.rowAi]}
    >
      <Pressable
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
      >
        <MotiView
          animate={{ scale: pressed ? 0.98 : 1 }}
          transition={{ type: 'timing', duration: 120 }}
          style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}
        >
          <FormattedText text={item.text} isUser={isUser} />
        </MotiView>
      </Pressable>
    </MotiView>
  );
};

const Suggestion = ({ title, icon, onPress, delay }: any) => {
  const [pressed, setPressed] = useState(false);
  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 300, delay }}
    >
      <Pressable
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        onPress={() => onPress(title)}
      >
        <MotiView
          animate={{ scale: pressed ? 0.94 : 1 }}
          transition={{ type: 'timing', duration: 100 }}
          style={styles.chip}
        >
          <MaterialCommunityIcons name={icon} size={15} color={C.brand} />
          <Text style={styles.chipText}>{title}</Text>
        </MotiView>
      </Pressable>
    </MotiView>
  );
};

const FormattedText = ({ text, isUser }: { text: string; isUser: boolean }) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  const color = isUser ? C.surface : C.text;
  return (
    <Text style={[styles.msgText, { color }]}>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <Text key={i} style={{ fontWeight: '700', color }}>
            {part.slice(2, -2)}
          </Text>
        ) : (
          <Text key={i}>{part}</Text>
        )
      )}
    </Text>
  );
};

// Issue #8: Mini snapshot banner after AI replies with action
const SnapshotBanner = ({ snapshot }: { snapshot: any }) => {
  if (!snapshot) return null;
  return (
    <MotiView
      from={{ opacity: 0, translateY: -4 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 300 }}
      style={styles.snapshotBanner}
    >
      <View style={styles.snapshotItem}>
        <Text style={styles.snapshotLabel}>Spent</Text>
        <Text style={styles.snapshotValue}>{fmt(snapshot.totalExpense || 0)}</Text>
      </View>
      <View style={styles.snapshotDivider} />
      <View style={styles.snapshotItem}>
        <Text style={styles.snapshotLabel}>Discipline</Text>
        <Text style={[styles.snapshotValue, { color: (snapshot.disciplineScore || 0) >= 70 ? C.success : C.brand }]}>
          {snapshot.disciplineScore || 0}%
        </Text>
      </View>
      <View style={styles.snapshotDivider} />
      <View style={styles.snapshotItem}>
        <Text style={styles.snapshotLabel}>Savings rate</Text>
        <Text style={styles.snapshotValue}>{Math.round(snapshot.savingsRate || 0)}%</Text>
      </View>
    </MotiView>
  );
};

const SUGGESTION_CHIPS = [
  { title: 'Analyze week', icon: 'chart-line' },
  { title: 'Add lunch ₹200', icon: 'plus' },
  { title: 'Saving tips', icon: 'lightbulb-outline' },
  { title: 'Budget check', icon: 'wallet-outline' },
];

export default function ChatScreen() {
  const api = useApi();
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', text: "Hi! I'm **Duo**, your habit coach. Want to log a spend or get a read on your week?", sender: 'ai' },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [sendPop, setSendPop] = useState(false);
  const [snapshot, setSnapshot] = useState<any>(null);  // Issue #8
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Issue #17 FIX: Load chat history on mount
  const loadHistory = useCallback(async () => {
    if (historyLoaded) return;
    try {
      const res = await (api as any).getChatHistory?.();
      const history: any[] = Array.isArray(res) ? res : res?.data || [];
      if (history.length > 0) {
        const hydrated: Message[] = history.map((h: any, i: number) => ({
          id: `history_${i}`,
          text: h.message || h.content || '',
          sender: h.role === 'user' ? 'user' : 'ai',
        }));
        setMessages(hydrated);
        setHistoryLoaded(true);
      }
    } catch {
      // Silently ignore — fresh chat is fine
    }
  }, [api, historyLoaded]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), text, sender: 'user' };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setSendPop(true);
    setTimeout(() => setSendPop(false), 180);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const response = await api.chatWithCoach(text);

      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), text: response.text, sender: 'ai' },
      ]);

      // Issue #8 FIX: Handle action + snapshot from chat response
      if (response.snapshot) {
        setSnapshot(response.snapshot);
      }
      if (response.action === 'ADD_TX' && response.transaction) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), text: "Couldn't connect. Try again in a moment.", sender: 'ai' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Issue #18 FIX: Show chips after every AI reply, not just the opening message
  const lastMessage = messages[messages.length - 1];
  const showChips = !isLoading && lastMessage?.sender === 'ai';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          {/* Header */}
          <MotiView
            from={{ opacity: 0, translateY: -6 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 260 }}
            style={styles.header}
          >
            <View style={styles.headerLeft}>
              <MotiView
                from={{ opacity: 0.5, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1.15 }}
                transition={{
                  loop: true,
                  type: 'timing',
                  duration: 1100,
                  easing: Easing.inOut(Easing.ease),
                }}
                style={styles.dot}
              />
              <Text style={styles.headerTitle}>Coach</Text>
            </View>
            <Text style={styles.headerSub}>Duo</Text>
          </MotiView>

          {/* Issue #8: Snapshot banner (shown after AI transaction actions) */}
          {snapshot && <SnapshotBanner snapshot={snapshot} />}

          {/* Messages */}
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <Bubble item={item} isUser={item.sender === 'user'} />}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListFooterComponent={
              <AnimatePresence>{isLoading && <TypingIndicator />}</AnimatePresence>
            }
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
          />

          {/* Issue #18: Chips after every AI reply */}
          {showChips && (
            <View style={styles.suggestionsWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
              >
                {SUGGESTION_CHIPS.map((chip, i) => (
                  <Suggestion
                    key={chip.title}
                    title={chip.title}
                    icon={chip.icon}
                    onPress={sendMessage}
                    delay={i * 60}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Input */}
          <View style={styles.inputOuter}>
            <MotiView
              animate={{
                borderColor: inputFocused ? C.brand : C.border,
                scale: inputFocused ? 1.01 : 1,
              }}
              transition={{ type: 'timing', duration: 200 }}
              style={styles.inputWrap}
            >
              <TextInput
                style={styles.input}
                placeholder="Message Duo…"
                placeholderTextColor={C.muted}
                value={input}
                onChangeText={setInput}
                multiline
                editable={!isLoading}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
              />
              <Pressable
                onPress={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
              >
                <MotiView
                  animate={{
                    scale: sendPop ? 0.85 : 1,
                    opacity: !input.trim() || isLoading ? 0.3 : 1,
                  }}
                  transition={{ type: 'spring', damping: 10, stiffness: 300 }}
                  style={styles.sendBtn}
                >
                  <Feather name="arrow-up" size={18} color={C.surface} />
                </MotiView>
              </Pressable>
            </MotiView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  headerTitle: { fontSize: 14, fontWeight: '600', color: C.text },
  headerSub: { fontSize: 11, fontWeight: '500', color: C.muted },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.brand },

  // Issue #8: Snapshot banner
  snapshotBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  snapshotItem: { alignItems: 'center' },
  snapshotLabel: { fontSize: 10, color: C.muted, fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  snapshotValue: { fontSize: 14, fontWeight: '700', color: C.text },
  snapshotDivider: { width: 1, height: 28, backgroundColor: C.border },

  suggestionsWrap: { paddingVertical: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
  },
  chipText: { fontSize: 13, fontWeight: '500', color: C.text },

  list: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, flexGrow: 1 },

  row: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12, maxWidth: '85%' },
  rowUser: { alignSelf: 'flex-end' },
  rowAi: { alignSelf: 'flex-start' },

  bubble: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 18 },
  bubbleUser: { backgroundColor: C.accent, borderBottomRightRadius: 4 },
  bubbleAi: {
    backgroundColor: C.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  msgText: { fontSize: 15, lineHeight: 21 },

  typingBubble: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: C.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: C.border,
    gap: 5,
  },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.muted },

  inputOuter: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 10 : 24,
    backgroundColor: C.bg,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 24,
    borderWidth: 1.5,
    paddingLeft: 16,
    paddingRight: 5,
    paddingVertical: 5,
  },
  input: {
    flex: 1,
    fontSize: 15,
    maxHeight: 100,
    color: C.text,
    paddingTop: Platform.OS === 'ios' ? 10 : 6,
    paddingBottom: Platform.OS === 'ios' ? 10 : 6,
  },
  sendBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 8,
  },
});