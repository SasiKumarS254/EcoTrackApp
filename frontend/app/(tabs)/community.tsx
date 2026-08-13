import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useTheme } from "../../context/ThemeContext";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Image, Alert, StatusBar, Modal, Share,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Radius, Shadow, FontSize } from "@/constants/theme";
import { router, useFocusEffect } from "expo-router";
import {
  fetchCommunityPosts, createCommunityPost, likeCommunityPost, commentCommunityPost, toggleBookmark
} from "../../services/api";

type CommentItem = { id: number; userId?: string; user: string; text: string; time: string };

type Post = {
  id: number;
  userId?: string;
  user_id?: string;
  user: string;
  avatar: string;
  image: string;
  caption: string;
  likes: number;
  time: string;
  category: string;
  liked?: boolean;
  isSaved?: boolean;
  comments: CommentItem[];
  scannerReport?: {
    scanId: string;
    score: number;
    grade: string;
    species: string;
    exercise: string;
    repCount: number;
    duration: number;
  };
};
const CATEGORIES = ["All", "Health & Care", "Training Tips", "Sightings", "General"];

export default function CommunityScreen() {
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const [posts, setPosts] = useState<Post[]>([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");

  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("You");
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  // Persistence: Load posts on focus/mount
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      const loadPosts = async () => {
        try {
          const raw = await AsyncStorage.getItem("@ecotrack_user_session");
          let uId = "";
          if (raw) {
            const sess = JSON.parse(raw);
            if (userId !== sess.user_id) {
              setPosts([]);
            }
            setUserId(sess.user_id);
            setUserName(sess.name || "You");
            setUserAvatar(sess.avatar || null);
            uId = sess.user_id;
          }

          const backendPosts = await fetchCommunityPosts();
          if (isMounted) {
            if (backendPosts && backendPosts.length > 0) {
              const mapped = backendPosts.map((p: any) => ({
                id: p.id,
                userId: p.user_id || p.userId,
                user: p.user || "EcoTracker",
                avatar: p.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.user || "EcoTracker")}&background=10b981&color=fff`,
                image: p.media || p.image || "",
                caption: p.content || p.caption || "",
                likes: p.likes || 0,
                time: p.timestamp ? new Date(p.timestamp).toLocaleDateString() : "Just now",
                category: p.category || "General",
                liked: p.liked || false,
                isSaved: p.is_saved || false,
                scannerReport: p.scanner_report ? (typeof p.scanner_report === 'string' ? JSON.parse(p.scanner_report) : p.scanner_report) : undefined,
                comments: (p.comments || []).map((c: any) => ({
                  id: c.id,
                  userId: c.user_id || c.userId,
                  user: c.user || "User",
                  text: c.text,
                  time: c.timestamp ? new Date(c.timestamp).toLocaleDateString() : "Just now"
                }))
              }));
              setPosts(mapped);
            }
          }
        } catch (e) {
          console.warn("Error loading community posts", e);
        }
      };
      loadPosts();
      return () => { isMounted = false; };
    }, [userId])
  );

  const toggleLike = async (id: number) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 }
          : p
      )
    );
    if (userId) await likeCommunityPost(id, userId);
  };

  const toggleSave = async (id: number) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, isSaved: !p.isSaved } : p
      )
    );
    await toggleBookmark(id);
    Alert.alert("Success", "Post saved to your bookmarks.");
  };

  const handleShare = async (post: Post) => {
    try {
      await Share.share({
        message: `${post.user} shared on EcoTrack: "${post.caption}" Join the conservation network!`,
        url: 'https://ecotrack.app',
        title: 'EcoTrack Community'
      });
    } catch (e) {
      console.warn("Share failed", e);
    }
  };

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [postImage, setPostImage] = useState<string | null>(null);
  const [postCaption, setPostCaption] = useState("");
  const [postCategory, setPostCategory] = useState("General");

  const [activeCommentPost, setActiveCommentPost] = useState<Post | null>(null);
  const [newCommentInput, setNewCommentInput] = useState("");

  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      const matchCat = activeCategory === "All" || p.category === activeCategory;
      const matchSearch = !search || p.caption.toLowerCase().includes(search.toLowerCase()) || p.user.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [posts, activeCategory, search]);

  const handleCreatePost = async () => {
    if (!postCaption.trim()) {
      Alert.alert("Required", "Please write a caption or update.");
      return;
    }
    const postData = {
      user: userName,
      user_id: userId,
      avatar: userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=10b981&color=fff`,
      media: postImage || "",
      content: postCaption,
      category: postCategory
    };
    try {
      const res = await createCommunityPost(postData);
      if (res) {
        setShowCreateModal(false);
        setPostCaption("");
        setPostImage(null);
        Alert.alert("Published!", "Your post is now live.");
        // Reload posts
        const backendPosts = await fetchCommunityPosts();
        if (backendPosts) setPosts(backendPosts);
      }
    } catch { Alert.alert("Error", "Could not publish post."); }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bgLight} />

      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>💬 Community Feed</Text>
          <Text style={styles.headerSub}>Connect with other Eco Trackers</Text>
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push("/messages")}>
            <Ionicons name="chatbubbles-outline" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateModal(true)}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search posts..."
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.chip, activeCategory === cat && styles.chipActive]}
              onPress={() => setActiveCategory(cat)}
            >
              <Text style={[styles.chipText, activeCategory === cat && styles.chipTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {filteredPosts.map((post) => (
          <View key={post.id} style={styles.postCard}>
            <TouchableOpacity
              style={styles.userRow}
              onPress={() => {
                const id = post.userId || post.user_id;
                if (id) router.push(`/profile/${id}` as any);
              }}
            >
              <Image source={{ uri: post.avatar }} style={styles.avatar} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.userName}>{post.user}</Text>
                <Text style={styles.postTime}>{post.time} • {post.category}</Text>
              </View>
              <TouchableOpacity onPress={() => toggleSave(post.id)}>
                <Ionicons name={post.isSaved ? "bookmark" : "bookmark-outline"} size={20} color={post.isSaved ? colors.primary : colors.textMuted} />
              </TouchableOpacity>
            </TouchableOpacity>

            {post.image ? (
              <Image source={{ uri: post.image }} style={styles.postImg} />
            ) : post.scannerReport ? (
              <View style={styles.reportBox}>
                <View style={styles.reportHeader}>
                  <View style={styles.scoreCircle}>
                    <Text style={styles.scoreNum}>{post.scannerReport.score}</Text>
                    <Text style={styles.scoreLabel}>/100</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reportTitle}>AI Scan: {post.scannerReport.exercise}</Text>
                    <Text style={styles.reportSubtitle}>{post.scannerReport.species.toUpperCase()} · Grade {post.scannerReport.grade}</Text>
                  </View>
                  <Ionicons name="ribbon" size={28} color="#f59e0b" />
                </View>
                <View style={styles.reportStats}>
                  <View style={styles.reportStat}><Text style={styles.statVal}>{post.scannerReport.repCount}</Text><Text style={styles.statLabel}>Reps</Text></View>
                  <View style={styles.statDivider} />
                  <View style={styles.reportStat}><Text style={styles.statVal}>{post.scannerReport.duration}s</Text><Text style={styles.statLabel}>Time</Text></View>
                  <TouchableOpacity style={styles.viewFullBtn} onPress={() => router.push({ pathname: "/scanReport", params: { data: JSON.stringify(post.scannerReport) } })}>
                    <Text style={styles.viewFullText}>View Details</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            <View style={styles.postContent}>
              <Text style={styles.captionText}>{post.caption}</Text>

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => toggleLike(post.id)}>
                  <Ionicons name={post.liked ? "heart" : "heart-outline"} size={20} color={post.liked ? colors.danger : colors.textSecondary} />
                  <Text style={[styles.actionText, post.liked && { color: colors.danger }]}>{post.likes}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtn} onPress={() => setActiveCommentPost(post)}>
                  <Ionicons name="chatbubble-outline" size={19} color={colors.textSecondary} />
                  <Text style={styles.actionText}>{post.comments.length}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtn} onPress={() => router.push(`/chat/${post.userId || post.user_id}`)}>
                  <Ionicons name="paper-plane-outline" size={19} color={colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtn} onPress={() => handleShare(post)}>
                  <Ionicons name="share-social-outline" size={19} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* CREATE MODAL */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Post</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}><Ionicons name="close" size={24} color={colors.textPrimary} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {postImage ? (
                <View style={styles.previewBox}>
                  <Image source={{ uri: postImage }} style={{ width: "100%", height: "100%", borderRadius: Radius.md }} />
                  <TouchableOpacity style={styles.removeImg} onPress={() => setPostImage(null)}><Ionicons name="close" size={16} color="#fff" /></TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.uploadBox} onPress={async () => {
                  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
                  if (!r.canceled) setPostImage(r.assets[0].uri);
                }}>
                  <Ionicons name="camera" size={32} color={colors.primary} />
                  <Text style={styles.uploadText}>Attach Photo</Text>
                </TouchableOpacity>
              )}
              <TextInput
                style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
                value={postCaption}
                onChangeText={setPostCaption}
                placeholder="Share with the community..."
                placeholderTextColor={colors.textMuted}
                multiline
              />
              <TouchableOpacity style={styles.publishBtn} onPress={handleCreatePost}>
                <Text style={styles.publishText}>Publish Post</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* COMMENTS MODAL */}
      <Modal visible={!!activeCommentPost} animationType="fade" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { height: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Comments</Text>
              <TouchableOpacity onPress={() => setActiveCommentPost(null)}><Ionicons name="close" size={24} color={colors.textPrimary} /></TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1 }}>
              {activeCommentPost?.comments.map(c => (
                <View key={c.id} style={styles.commentRow}>
                  <Text style={styles.commentUser}>{c.user}</Text>
                  <Text style={styles.commentText}>{c.text}</Text>
                  <Text style={styles.commentTime}>{c.time}</Text>
                </View>
              ))}
            </ScrollView>
            <View style={styles.commentInputRow}>
              <TextInput style={styles.commentInput} value={newCommentInput} onChangeText={setNewCommentInput} placeholder="Add a comment..." />
              <TouchableOpacity style={styles.sendCommentBtn} onPress={async () => {
                if (!newCommentInput.trim() || !activeCommentPost) return;
                await commentCommunityPost(activeCommentPost.id, { text: newCommentInput });
                setNewCommentInput("");
                // Refresh logic here
              }}><Ionicons name="send" size={20} color="#fff" /></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgLight },
    scroll: { flex: 1 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 54, paddingBottom: 12 },
    headerTitle: { fontSize: FontSize.xxl, fontWeight: "800", color: colors.textPrimary },
    headerSub: { fontSize: FontSize.sm, color: colors.textSecondary, marginTop: 2 },
    createBtn: { width: 44, height: 44, backgroundColor: colors.primary, borderRadius: 22, justifyContent: "center", alignItems: "center", ...Shadow.sm },
    iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: isDark ? colors.bgCard : "#f3f4f6", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: colors.border },
    searchRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.bgCard, borderRadius: Radius.lg, paddingHorizontal: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border, height: 46, ...Shadow.sm },
    searchInput: { flex: 1, marginLeft: 8, fontSize: FontSize.sm, color: colors.textPrimary },
    chip: { backgroundColor: isDark ? colors.bgCard : "#f3f4f6", borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 8, marginRight: 8, borderWidth: 1, borderColor: colors.border },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: 13, color: colors.textSecondary, fontWeight: "700" },
    chipTextActive: { color: "#fff" },
    postCard: { backgroundColor: colors.bgCard, borderRadius: 20, marginBottom: 16, marginHorizontal: 16, borderWidth: 1, borderColor: colors.border, ...Shadow.sm },
    userRow: { flexDirection: "row", alignItems: "center", padding: 14 },
    avatar: { width: 42, height: 42, borderRadius: 21 },
    userName: { fontSize: 15, fontWeight: "800", color: colors.textPrimary },
    postTime: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
    postImg: { width: "100%", height: 250 },
    reportBox: { backgroundColor: isDark ? "#1e293b" : "#f8fafc", margin: 12, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
    reportHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
    scoreCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
    scoreNum: { color: "#fff", fontSize: 15, fontWeight: "900" },
    scoreLabel: { color: "rgba(255,255,255,0.7)", fontSize: 8, fontWeight: "700" },
    reportTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: "800" },
    reportSubtitle: { color: colors.textMuted, fontSize: 10, fontWeight: "700", marginTop: 1 },
    reportStats: { flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
    reportStat: { alignItems: "center" },
    statVal: { color: colors.textPrimary, fontSize: 13, fontWeight: "800" },
    statLabel: { color: colors.textMuted, fontSize: 9, fontWeight: "600" },
    statDivider: { width: 1, height: 16, backgroundColor: colors.border },
    viewFullBtn: { marginLeft: "auto", backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    viewFullText: { color: "#fff", fontSize: 11, fontWeight: "800" },
    postContent: { padding: 14 },
    captionText: { fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
    actionRow: { flexDirection: "row", alignItems: "center", gap: 20, marginTop: 14 },
    actionBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
    actionText: { fontSize: 13, color: colors.textSecondary, fontWeight: "700" },
    modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalCard: { backgroundColor: colors.bgCard, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24 },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
    modalTitle: { fontSize: 20, fontWeight: "900", color: colors.textPrimary },
    uploadBox: { height: 120, borderRadius: 16, borderWidth: 2, borderStyle: "dashed", borderColor: colors.primary, justifyContent: "center", alignItems: "center", backgroundColor: isDark ? colors.bgLight : "#f0fdf4", marginBottom: 20 },
    uploadText: { fontSize: 13, fontWeight: "800", color: colors.primary, marginTop: 8 },
    previewBox: { height: 180, borderRadius: 16, overflow: "hidden", marginBottom: 20, position: "relative" },
    removeImg: { position: "absolute", top: 10, right: 10, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 15, padding: 6 },
    input: { backgroundColor: isDark ? colors.bgLight : "#f9fafb", borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, fontSize: 15, color: colors.textPrimary, marginBottom: 20 },
    publishBtn: { backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: "center", ...Shadow.md },
    publishText: { color: "#fff", fontWeight: "900", fontSize: 16 },
    commentRow: { padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
    commentUser: { fontSize: 12, fontWeight: "900", color: colors.primary },
    commentText: { fontSize: 13, color: colors.textPrimary, marginTop: 4 },
    commentTime: { fontSize: 10, color: colors.textMuted, marginTop: 4 },
    commentInputRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
    commentInput: { flex: 1, height: 44, backgroundColor: isDark ? colors.bgLight : "#f3f4f6", borderRadius: 22, paddingHorizontal: 16 },
    sendCommentBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center" },
  });
}

function getStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgLight },
    scroll: { flex: 1 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 54, paddingBottom: 12 },
    headerTitle: { fontSize: FontSize.xxl, fontWeight: "800", color: colors.textPrimary },
    headerSub: { fontSize: FontSize.sm, color: colors.textSecondary, marginTop: 2 },
    createBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.primary, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 8 },
    createBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.xs },
    iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? colors.bgCard : "#f3f4f6", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: colors.border },

    searchRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.bgCard, borderRadius: Radius.lg, paddingHorizontal: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border, height: 44, ...Shadow.sm },
    searchInput: { flex: 1, marginLeft: 8, fontSize: FontSize.sm, color: colors.textPrimary },

    chip: {
      backgroundColor: isDark ? colors.bgCard : "#f3f4f6",
      borderRadius: Radius.full,
      paddingHorizontal: 18,
      paddingVertical: 8,
      marginRight: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: FontSize.sm, color: colors.textSecondary, fontWeight: "600" },
    chipTextActive: { color: "#fff", fontWeight: "700" },

    postCard: { backgroundColor: colors.bgCard, borderRadius: Radius.xl, marginBottom: 16, marginHorizontal: 16, borderWidth: 1, borderColor: colors.border, overflow: "hidden", ...Shadow.sm },
    userRow: { flexDirection: "row", alignItems: "center", padding: 12 },
    avatar: { width: 40, height: 40, borderRadius: 20 },
    userName: { fontSize: FontSize.sm, fontWeight: "800", color: colors.textPrimary },
    postTime: { fontSize: FontSize.xs, color: colors.textMuted, marginTop: 1 },
    catBadge: { backgroundColor: isDark ? colors.bgLight : "#dcfce7", borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: colors.border },
    catBadgeText: { color: colors.primary, fontSize: 10, fontWeight: "700" },

    postImg: { width: "100%", height: 220 },
    reportBox: { backgroundColor: isDark ? "#1e293b" : "#f8fafc", margin: 12, borderRadius: Radius.lg, padding: 16, borderWidth: 1, borderColor: colors.border },
    reportHeader: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 },
    scoreCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
    scoreNum: { color: "#fff", fontSize: 16, fontWeight: "900" },
    scoreLabel: { color: "rgba(255,255,255,0.7)", fontSize: 8, fontWeight: "700" },
    reportTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "800" },
    reportSubtitle: { color: colors.textMuted, fontSize: 11, fontWeight: "700", marginTop: 2 },
    reportStats: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
    reportStat: { alignItems: "center" },
    statVal: { color: colors.textPrimary, fontSize: 13, fontWeight: "800" },
    statLabel: { color: colors.textMuted, fontSize: 9, fontWeight: "600" },
    statDivider: { width: 1, height: 20, backgroundColor: colors.border },
    viewFullBtn: { marginLeft: "auto", backgroundColor: "rgba(16,185,129,0.1)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
    viewFullText: { color: colors.primary, fontSize: 10, fontWeight: "800" },
    postContent: { padding: 14 },
    captionText: { fontSize: FontSize.sm, color: colors.textPrimary, lineHeight: 20 },

    actionRow: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
    actionBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
    actionText: { fontSize: FontSize.xs, color: colors.textSecondary, fontWeight: "600" },

    modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalCard: { backgroundColor: colors.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: 20 },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
    modalTitle: { fontSize: FontSize.lg, fontWeight: "800", color: colors.textPrimary },

    uploadBox: { height: 100, borderRadius: Radius.md, borderWidth: 2, borderStyle: "dashed", borderColor: colors.primary, justifyContent: "center", alignItems: "center", backgroundColor: isDark ? colors.bgLight : "#f0fdf4", marginBottom: 12 },
    uploadText: { fontSize: FontSize.xs, fontWeight: "700", color: colors.primary, marginTop: 4 },
    previewBox: { height: 110, borderRadius: Radius.md, overflow: "hidden", marginBottom: 12, position: "relative" },
    removeImg: { position: "absolute", top: 6, right: 6, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 12, padding: 4 },

    label: { fontSize: FontSize.xs, fontWeight: "700", color: colors.textSecondary, marginBottom: 4, marginTop: 4 },
    input: { backgroundColor: isDark ? colors.bgLight : "#f9fafb", borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8, fontSize: FontSize.sm, color: colors.textPrimary },

    publishBtn: { backgroundColor: colors.primary, borderRadius: Radius.lg, paddingVertical: 12, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 14 },
    publishText: { color: "#fff", fontWeight: "800", fontSize: FontSize.sm },

    emptyText: { fontSize: FontSize.xs, color: colors.textMuted, fontStyle: "italic", textAlign: "center", marginVertical: 20 },
    commentRow: { backgroundColor: isDark ? colors.bgLight : "#f9fafb", borderRadius: Radius.md, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
    commentUser: { fontSize: FontSize.xs, fontWeight: "800", color: colors.primary },
    commentText: { fontSize: FontSize.xs, color: colors.textPrimary, marginTop: 2 },
    commentTime: { fontSize: 10, color: colors.textMuted, marginTop: 4 },

    commentInputRow: { flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
    commentInput: { flex: 1, backgroundColor: isDark ? colors.bgLight : "#f9fafb", borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8, fontSize: FontSize.sm, color: colors.textPrimary },
    sendCommentBtn: { width: 40, height: 40, borderRadius: Radius.md, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center" },
  });
}
