import React, { useState, useRef, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ScrollView,
  Image,
  Alert,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { Radius, Shadow, FontSize } from "@/constants/theme";
import { useTheme } from "../../context/ThemeContext";
import { fetchThread, sendMessage, fetchUserProfile } from "../../services/api";

interface MessageItem {
  id: string;
  text: string;
  sender: "me" | "seller";
  time: string;
  media_url?: string | null;
  media_type?: string | null;
}

const QUICK_PROMPTS = [
  "Hi! Is this available?",
  "Can you share vaccination records?",
  "What is the pickup location?",
  "Is the price negotiable?"
];

export default function ChatScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const targetUserId = id ? (id.startsWith("user_") || id.startsWith("seller_") || id.startsWith("usr_") || id.startsWith("usr") ? id : `user_${id}`) : "user_101";
  const sellerName = name || `Eco Member (${targetUserId})`;
  const storageKey = `@ecotrack_chat_${targetUserId}`;

  const [input, setInput] = useState("");
  const [userId, setUserId] = useState<string>("user_guest");
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [attachedMedia, setAttachedMedia] = useState<{ uri: string; isVideo: boolean } | null>(null);
  const [partnerProfile, setPartnerProfile] = useState<any>(null);

  // Load partner profile details
  useEffect(() => {
    if (targetUserId) {
      (async () => {
        const profile = await fetchUserProfile(targetUserId);
        if (profile) setPartnerProfile(profile);
      })();
    }
  }, [targetUserId]);

  // Load user & chat thread
  useEffect(() => {
    (async () => {
      let currentUid = "user_guest";
      try {
        const raw = await AsyncStorage.getItem("@ecotrack_user_session");
        if (raw) {
          const sess = JSON.parse(raw);
          currentUid = sess.user_id || sess.id || "user_guest";
        }
      } catch (e) {}
      setUserId(currentUid);

      const thread = await fetchThread(currentUid, targetUserId);
      if (thread && Array.isArray(thread) && thread.length > 0) {
        const mapped = thread.map((m: any) => ({
          id: m.id || Date.now().toString(),
          text: m.text,
          sender: m.from_user_id === currentUid ? ("me" as const) : ("seller" as const),
          time: new Date(m.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          media_url: m.media_url,
          media_type: m.media_type
        }));
        setMessages(mapped);
      } else {
        const stored = await AsyncStorage.getItem(`${storageKey}_${currentUid}`);
        if (stored) setMessages(JSON.parse(stored));
      }
    })();
  }, [targetUserId, storageKey]);

  // Save local copy
  useEffect(() => {
    if (messages.length > 0) {
      AsyncStorage.setItem(`${storageKey}_${userId}`, JSON.stringify(messages)).catch(() => {});
    }
  }, [messages, storageKey, userId]);

  const flatListRef = useRef<FlatList>(null);

  const pickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Permission Required", "Gallery permission is required to attach photos or videos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setAttachedMedia({ uri: asset.uri, isVideo: asset.type === 'video' });
    }
  };

  const sendMessageText = async (textToSend: string) => {
    if (!textToSend.trim() && !attachedMedia) return;

    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: MessageItem = {
      id: Date.now().toString(),
      text: textToSend,
      sender: "me",
      time: currentTime,
      media_url: attachedMedia?.uri || null,
      media_type: attachedMedia ? (attachedMedia.isVideo ? "video" : "image") : null,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    const mediaToSend = attachedMedia;
    setAttachedMedia(null);

    try {
      await sendMessage(userId, targetUserId, textToSend, mediaToSend?.uri, mediaToSend ? (mediaToSend.isVideo ? "video" : "image") : undefined);
    } catch (e) {
      console.warn("Failed to send message to backend", e);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bgCard} />

      {/* CHAT HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>

        {partnerProfile?.avatar ? (
          <Image source={{ uri: partnerProfile.avatar }} style={styles.headerAvatar} />
        ) : (
          <View style={styles.avatarBox}>
            <Ionicons name="person" size={20} color={colors.primary} />
          </View>
        )}

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.sellerName} numberOfLines={1}>{partnerProfile?.name || sellerName}</Text>
          <View style={styles.statusRow}>
            <View style={styles.greenDot} />
            <Text style={styles.statusText}>Direct Member Message</Text>
          </View>
        </View>
      </View>

      {/* MESSAGES LIST */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={{ alignItems: "center", justifyContent: "center", padding: 40 }}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} />
            <Text style={{ marginTop: 12, color: colors.textMuted, fontSize: 14, textAlign: "center" }}>
              Start a direct conversation with {partnerProfile?.name || sellerName}.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isMe = item.sender === "me";
          return (
            <View style={[styles.bubbleWrapper, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
              <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleSeller]}>
                {!!item.text && (
                  <Text style={[styles.bubbleText, isMe ? styles.textMe : styles.textSeller]}>
                    {item.text}
                  </Text>
                )}
                {!!item.media_url && (
                  <Image source={{ uri: item.media_url }} style={{ width: 180, height: 140, borderRadius: 8, marginTop: 6 }} />
                )}
                <Text style={[styles.timeText, isMe ? styles.timeMe : styles.timeSeller]}>
                  {item.time}
                </Text>
              </View>
            </View>
          );
        }}
      />

      {/* ATTACHED MEDIA PREVIEW BADGE */}
      {attachedMedia && (
        <View style={{ paddingHorizontal: 16, paddingVertical: 6, backgroundColor: colors.bgCard, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 12, color: colors.primary }}>
            📎 Attached {attachedMedia.isVideo ? "Video" : "Photo"}
          </Text>
          <TouchableOpacity onPress={() => setAttachedMedia(null)}>
            <Ionicons name="close-circle" size={18} color={colors.danger} />
          </TouchableOpacity>
        </View>
      )}

      {/* QUICK CHIP PROMPTS */}
      <View style={styles.quickPromptsRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
          {QUICK_PROMPTS.map((prompt, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.promptChip}
              onPress={() => sendMessageText(prompt)}
            >
              <Text style={styles.promptText}>{prompt}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* INPUT BAR */}
      <View style={styles.inputBar}>
        <TouchableOpacity style={{ padding: 8 }} onPress={pickMedia}>
          <Ionicons name="attach-outline" size={24} color={colors.textSecondary} />
        </TouchableOpacity>

        <TextInput
          style={styles.textInput}
          value={input}
          onChangeText={setInput}
          placeholder="Type message to member..."
          placeholderTextColor={colors.textMuted}
          multiline
        />

        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() && !attachedMedia) && { opacity: 0.5 }]}
          onPress={() => sendMessageText(input)}
          disabled={!input.trim() && !attachedMedia}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function getStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgLight },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingTop: 54,
      paddingBottom: 14,
      paddingHorizontal: 16,
      backgroundColor: colors.bgCard,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      ...Shadow.sm,
    },
    backBtn: { padding: 4, marginRight: 8 },
    avatarBox: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.primary + "20",
      justifyContent: "center",
      alignItems: "center",
    },
    headerAvatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
    },
    sellerName: { fontSize: FontSize.md, fontWeight: "800", color: colors.textPrimary },
    statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
    greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
    statusText: { fontSize: FontSize.xs, color: colors.textSecondary },

    messageList: { padding: 16, paddingBottom: 24 },
    bubbleWrapper: { marginBottom: 12, width: "100%", flexDirection: "row" },
    bubbleRight: { justifyContent: "flex-end" },
    bubbleLeft: { justifyContent: "flex-start" },

    bubble: {
      maxWidth: "80%",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: Radius.lg,
      ...Shadow.sm,
    },
    bubbleMe: {
      backgroundColor: colors.primary,
      borderBottomRightRadius: 2,
    },
    bubbleSeller: {
      backgroundColor: colors.bgCard,
      borderBottomLeftRadius: 2,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bubbleText: { fontSize: FontSize.sm, lineHeight: 20 },
    textMe: { color: "#fff", fontWeight: "600" },
    textSeller: { color: colors.textPrimary },
    timeText: { fontSize: 10, marginTop: 4, textAlign: "right" },
    timeMe: { color: "rgba(255,255,255,0.7)" },
    timeSeller: { color: colors.textMuted },

    quickPromptsRow: { paddingVertical: 10, backgroundColor: colors.bgCard, borderTopWidth: 1, borderTopColor: colors.border },
    promptChip: {
      backgroundColor: isDark ? colors.bgLight : "#f3f4f6",
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: colors.border,
    },
    promptText: { fontSize: FontSize.xs, color: colors.textPrimary, fontWeight: "600" },

    inputBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.bgCard,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 10,
    },
    textInput: {
      flex: 1,
      backgroundColor: isDark ? colors.bgLight : "#f9fafb",
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontSize: FontSize.sm,
      color: colors.textPrimary,
      maxHeight: 100,
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: Radius.md,
      backgroundColor: colors.primary,
      justifyContent: "center",
      alignItems: "center",
    },
  });
}