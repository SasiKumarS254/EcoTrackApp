import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  ActivityIndicator, StatusBar, RefreshControl, TextInput, Alert
} from "react-native";
import { useTheme } from "../context/ThemeContext";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Radius, Shadow, FontSize, Spacing } from "@/constants/theme";
import { router, useFocusEffect } from "expo-router";
import { fetchMessages, deleteConversation } from "../services/api";

type Conversation = {
  id: string;
  other_user_id: string;
  other_user_name: string;
  other_user_avatar: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
};

export default function MessagesScreen() {
  const { colors, isDark } = useTheme();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const loadConversations = useCallback(async (refreshing = false) => {
    if (!refreshing) setIsLoading(true);
    try {
      const raw = await AsyncStorage.getItem("@ecotrack_user_session");
      if (!raw) {
        router.replace("/auth/login");
        return;
      }
      const sess = JSON.parse(raw);
      const userId = sess.user_id;

      const data = await fetchMessages(userId);
      if (data && data.conversations) {
        setConversations(data.conversations);
      }
    } catch (e) {
      console.warn("Failed to load conversations", e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations])
  );

  const handleDeleteConversation = (partnerId: string, partnerName: string) => {
    Alert.alert(
      "Delete Conversation",
      `Are you sure you want to permanently delete the chat history with ${partnerName}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setConversations(prev => prev.filter(c => (c.other_user_id || (c as any).partner_id || c.id) !== partnerId));
            await deleteConversation(partnerId);
            await loadConversations(true);
          }
        }
      ]
    );
  };

  const filteredConversations = conversations.filter(c =>
    c.other_user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.last_message.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (timeStr: string) => {
    const date = new Date(timeStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 86400000) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgLight }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Messages</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={[styles.searchBar, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={20} color={colors.textMuted} style={{ marginLeft: 12 }} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search conversations..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="chatbubbles-outline" size={64} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No conversations yet</Text>
          <TouchableOpacity style={[styles.startBtn, { backgroundColor: colors.primary }]} onPress={() => router.push("/(tabs)/community")}>
            <Text style={styles.startBtnText}>Find people to chat with</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); loadConversations(true); }} tintColor={colors.primary} />
          }
        >
          {filteredConversations.map((item: any) => {
            const partnerId = item.other_user_id || item.partner_id || item.id;
            const partnerName = item.other_user_name || item.partner_name || "Eco Member";
            const partnerAvatar = item.other_user_avatar || item.partner_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(partnerName)}&background=10b981&color=fff`;
            const lastMsg = item.last_message || item.text || "No message yet";
            const timeStr = item.last_message_time || item.last_time || new Date().toISOString();
            const unread = item.unread_count || 0;

            return (
              <TouchableOpacity
                key={item.listing_id ? `${partnerId}_${item.listing_id}` : (item.id || partnerId)}
                style={[styles.convItem, { borderBottomColor: colors.border }]}
                activeOpacity={0.7}
                delayLongPress={300}
                onLongPress={() => handleDeleteConversation(partnerId, partnerName)}
                onPress={() => router.push({ 
                  pathname: "/chat/[id]", 
                  params: { 
                    id: partnerId, 
                    name: partnerName, 
                    ...(item.listing_id ? { listingId: String(item.listing_id) } : {}) 
                  } 
                })}
              >
                <Image
                  source={{ uri: partnerAvatar }}
                  style={styles.avatar}
                />
                <View style={styles.convInfo}>
                  <View style={styles.topRow}>
                    <Text style={[styles.userName, { color: colors.textPrimary }]}>{partnerName}</Text>
                    <Text style={[styles.time, { color: colors.textMuted }]}>{formatTime(timeStr)}</Text>
                  </View>
                  {item.listing_title ? (
                    <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '700', marginBottom: 2 }} numberOfLines={1}>
                      📦 {item.listing_title}
                    </Text>
                  ) : null}
                  <View style={styles.bottomRow}>
                    <Text style={[styles.lastMsg, { color: unread > 0 ? colors.textPrimary : colors.textMuted, fontWeight: unread > 0 ? "800" : "400" }]} numberOfLines={1}>
                      {lastMsg}
                    </Text>
                    {unread > 0 && (
                      <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.unreadText}>{unread}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 60,
    paddingBottom: 15,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 20, fontWeight: "800" },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  searchSection: { padding: 16 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    height: 46,
    borderRadius: Radius.lg,
    borderWidth: 1,
    ...Shadow.sm,
  },
  searchInput: { flex: 1, paddingHorizontal: 12, fontSize: 14 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
  emptyText: { fontSize: 16, fontWeight: "600", marginTop: 16, textAlign: "center" },
  startBtn: { marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, borderRadius: Radius.md },
  startBtnText: { color: "#fff", fontWeight: "800" },
  convItem: {
    flexDirection: "row",
    padding: 16,
    borderBottomWidth: 1,
  },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  convInfo: { flex: 1, marginLeft: 16, justifyContent: "center" },
  topRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  userName: { fontSize: 16, fontWeight: "800" },
  time: { fontSize: 12 },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  lastMsg: { fontSize: 14, flex: 1, marginRight: 8 },
  unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, justifyContent: "center", alignItems: "center", paddingHorizontal: 6 },
  unreadText: { color: "#fff", fontSize: 10, fontWeight: "900" },
});
