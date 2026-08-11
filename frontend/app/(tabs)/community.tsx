import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useTheme } from "../../context/ThemeContext";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Image, Alert, StatusBar, Modal,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Radius, Shadow, FontSize } from "@/constants/theme";
import { router, useFocusEffect } from "expo-router";
import {
  fetchCommunityPosts, createCommunityPost, likeCommunityPost, commentCommunityPost
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
              setPosts([]); // clear state of previous user immediately to avoid stale data flash
            }
            setUserId(sess.user_id);
            setUserName(sess.name || "You");
            setUserAvatar(sess.avatar || null);
            uId = sess.user_id;
          } else {
            setUserId(null);
            setUserName("You");
            setUserAvatar(null);
          }

          const backendPosts = await fetchCommunityPosts(uId || undefined);
          if (isMounted) {
            if (backendPosts && backendPosts.length > 0) {
              const mapped = backendPosts.map((p: any) => ({
                id: p.id,
                userId: p.user_id || p.userId, // Save post author user_id
                user: p.user || "EcoTracker",
                avatar: p.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.user || "EcoTracker")}&background=10b981&color=fff`,
                image: p.media || p.image || "",
                caption: p.content || p.caption || "",
                likes: p.likes || 0,
                time: p.timestamp ? new Date(p.timestamp).toLocaleDateString() : "Just now",
                category: p.category || "General",
                liked: p.liked || false,
                scannerReport: p.scanner_report ? (typeof p.scanner_report === 'string' ? JSON.parse(p.scanner_report) : p.scanner_report) : undefined,
                comments: (p.comments || []).map((c: any) => ({
                  id: c.id,
                  userId: c.user_id || c.userId, // Save comment author user_id
                  user: c.user || "User",
                  text: c.text,
                  time: c.timestamp ? new Date(c.timestamp).toLocaleDateString() : "Just now"
                }))
              }));
              setPosts(mapped);
            } else {
              const key = uId ? `@ecotrack_community_posts_${uId}` : "@ecotrack_community_posts";
              const stored = await AsyncStorage.getItem(key);
              if (stored && isMounted) setPosts(JSON.parse(stored));
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

  // Persistence: Save posts on change
  useEffect(() => {
    const key = userId ? `@ecotrack_community_posts_${userId}` : "@ecotrack_community_posts";
    AsyncStorage.setItem(key, JSON.stringify(posts)).catch(() => {});
  }, [posts, userId]);

  // Create post state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [postImage, setPostImage] = useState<string | null>(null);
  const [postCaption, setPostCaption] = useState("");
  const [postCategory, setPostCategory] = useState("General");

  // Comment modal state
  const [activeCommentPost, setActiveCommentPost] = useState<Post | null>(null);
  const [newCommentInput, setNewCommentInput] = useState("");

  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      const matchCat = activeCategory === "All" || p.category === activeCategory;
      const matchSearch = !search || p.caption.toLowerCase().includes(search.toLowerCase()) || p.user.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [posts, activeCategory, search]);

  const toggleLike = async (id: number) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 }
          : p
      )
    );
    if (userId) {
      await likeCommunityPost(id, userId);
    }
  };

  const pickImage = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!r.canceled) setPostImage(r.assets[0].uri);
  };

  const handleCreatePost = async () => {
    if (!postCaption.trim()) {
      Alert.alert("Required", "Please write a caption or update for the community.");
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
      await createCommunityPost(postData);
      const backendPosts = await fetchCommunityPosts(userId || undefined);
      if (backendPosts && backendPosts.length > 0) {
        const mapped = backendPosts.map((p: any) => ({
          id: p.id,
          user: p.user || "EcoTracker",
          avatar: p.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.user || "EcoTracker")}&background=10b981&color=fff`,
          image: p.media || p.image || "",
          caption: p.content || p.caption || "",
          likes: p.likes || 0,
          time: p.timestamp ? new Date(p.timestamp).toLocaleDateString() : "Just now",
          category: p.category || "General",
          liked: p.liked || false,
          comments: (p.comments || []).map((c: any) => ({
            id: c.id,
            user: c.user || "User",
            text: c.text,
            time: c.timestamp ? new Date(c.timestamp).toLocaleDateString() : "Just now"
          }))
        }));
        setPosts(mapped);
      }
    } catch {
      const newPost: Post = {
        id: Date.now(),
        user: userName || "You (EcoTracker)",
        avatar: userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=10b981&color=fff`,
        image: postImage || "",
        caption: postCaption,
        likes: 1,
        time: "Just now",
        category: postCategory,
        liked: true,
        comments: [],
      };
      setPosts((prev) => [newPost, ...prev]);
    }

    setPostCaption("");
    setPostImage(null);
    setShowCreateModal(false);
    Alert.alert("🎉 Published!", "Your post is now live in the EcoTrack community feed.");
  };

  const handleAddComment = async () => {
    if (!newCommentInput.trim() || !activeCommentPost) return;

    const commentData = {
      user_id: userId || "local",
      user_name: userName,
      text: newCommentInput.trim(),
      avatar: userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=10b981&color=fff`
    };

    try {
      await commentCommunityPost(activeCommentPost.id, commentData);
      const backendPosts = await fetchCommunityPosts(userId || undefined);
      if (backendPosts && backendPosts.length > 0) {
        const mapped = backendPosts.map((p: any) => ({
          id: p.id,
          user: p.user || "EcoTracker",
          avatar: p.avatar || "https://randomuser.me/api/portraits/women/22.jpg",
          image: p.media || p.image || "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=600",
          caption: p.content || p.caption || "",
          likes: p.likes || 0,
          time: p.timestamp ? new Date(p.timestamp).toLocaleDateString() : "Just now",
          category: p.category || "General",
          liked: p.liked || false,
          comments: (p.comments || []).map((c: any) => ({
            id: c.id,
            user: c.user || "User",
            text: c.text,
            time: c.timestamp ? new Date(c.timestamp).toLocaleDateString() : "Just now"
          }))
        }));
        setPosts(mapped);
        
        const updatedPost = mapped.find((p: any) => p.id === activeCommentPost.id);
        if (updatedPost) setActiveCommentPost(updatedPost);
      }
    } catch {
      const newComment: CommentItem = {
        id: Date.now(),
        user: "You",
        text: newCommentInput.trim(),
        time: "Just now",
      };
      setPosts((prev) =>
        prev.map((p) =>
          p.id === activeCommentPost.id
            ? { ...p, comments: [...p.comments, newComment] }
            : p
        )
      );
      setActiveCommentPost((prev) =>
        prev ? { ...prev, comments: [...prev.comments, newComment] } : null
      );
    }

    setNewCommentInput("");
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.bgLight} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>💬 Community Feed</Text>
          <Text style={styles.headerSub}>Share training tips, health advice & updates</Text>
        </View>

        <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateModal(true)}>
          <Ionicons name="add-circle" size={20} color="#fff" />
          <Text style={styles.createBtnText}>New Post</Text>
        </TouchableOpacity>
      </View>

      {/* Search & Categories */}
      <View style={{ paddingHorizontal: 16 }}>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search feed, topics, hashtags..."
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

      {/* Feed List */}
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {filteredPosts.map((post) => (
          <View key={post.id} style={styles.postCard}>
            {/* User Row */}
            <TouchableOpacity 
              style={styles.userRow}
              onPress={() => {
                const id = post.userId || post.user_id;
                if (id) {
                  router.push(`/profile/${id}` as any);
                }
              }}
            >
              <Image source={{ uri: post.avatar }} style={styles.avatar} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.userName}>{post.user}</Text>
                <Text style={styles.postTime}>{post.time} • {post.category}</Text>
              </View>
              <View style={styles.catBadge}>
                <Text style={styles.catBadgeText}>{post.category}</Text>
              </View>
            </TouchableOpacity>

            {/* Image */}
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
                    <Text style={styles.reportTitle}>AI Analysis: {post.scannerReport.exercise}</Text>
                    <Text style={styles.reportSubtitle}>{post.scannerReport.species.toUpperCase()} · Grade {post.scannerReport.grade}</Text>
                  </View>
                  <Ionicons name="ribbon" size={32} color="#f59e0b" />
                </View>
                <View style={styles.reportStats}>
                  <View style={styles.reportStat}>
                    <Text style={styles.statVal}>{post.scannerReport.repCount}</Text>
                    <Text style={styles.statLabel}>Reps</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.reportStat}>
                    <Text style={styles.statVal}>{post.scannerReport.duration}s</Text>
                    <Text style={styles.statLabel}>Time</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <TouchableOpacity
                    style={styles.viewFullBtn}
                    onPress={() => Alert.alert("Scan Details", `Scan ID: ${post.scannerReport?.scanId}\nThis is a verified AI scan from the EcoTrack CV Engine.`)}
                  >
                    <Text style={styles.viewFullText}>Verified</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {/* Caption */}
            <View style={styles.postContent}>
              <Text style={styles.captionText}>{post.caption}</Text>

              {/* Action Row */}
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => toggleLike(post.id)}>
                  <Ionicons name={post.liked ? "heart" : "heart-outline"} size={20} color={post.liked ? colors.danger : colors.textSecondary} />
                  <Text style={[styles.actionText, post.liked && { color: colors.danger }]}>{post.likes} Likes</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtn} onPress={() => setActiveCommentPost(post)}>
                  <Ionicons name="chatbubble-outline" size={19} color={colors.textSecondary} />
                  <Text style={styles.actionText}>{post.comments.length} Comments</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtn} onPress={() => Alert.alert("📤 Share", "Post link copied to clipboard.")}>
                  <Ionicons name="share-social-outline" size={19} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* CREATE POST MODAL */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>✍️ Create Post</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close-circle" size={26} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {postImage ? (
              <View style={styles.previewBox}>
                <Image source={{ uri: postImage }} style={{ width: "100%", height: "100%", borderRadius: Radius.md }} />
                <TouchableOpacity style={styles.removeImg} onPress={() => setPostImage(null)}>
                  <Ionicons name="close" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.uploadBox} onPress={pickImage}>
                <Ionicons name="camera" size={32} color={colors.primary} />
                <Text style={styles.uploadText}>Attach Photo</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.label}>Select Topic Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              {["Health & Care", "Training Tips", "Sightings", "General"].map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, postCategory === c && styles.chipActive]}
                  onPress={() => setPostCategory(c)}
                >
                  <Text style={[styles.chipText, postCategory === c && styles.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Write Caption / Update *</Text>
            <TextInput
              style={[styles.input, { height: 90 }]}
              value={postCaption}
              onChangeText={setPostCaption}
              placeholder="Share advice, training progress, or ask about animal health..."
              placeholderTextColor={colors.textMuted}
              multiline
            />

            <TouchableOpacity style={styles.publishBtn} onPress={handleCreatePost}>
              <Ionicons name="send" size={18} color="#fff" />
              <Text style={styles.publishText}>Publish Post</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* COMMENTS THREAD MODAL */}
      <Modal visible={!!activeCommentPost} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { maxHeight: "80%" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>💬 Discussion Thread</Text>
              <TouchableOpacity onPress={() => setActiveCommentPost(null)}>
                <Ionicons name="close-circle" size={26} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {activeCommentPost && (
              <>
                <ScrollView style={{ flex: 1, marginBottom: 10 }}>
                  {activeCommentPost.comments.length === 0 ? (
                    <Text style={styles.emptyText}>No comments yet. Start the conversation!</Text>
                  ) : (
                    activeCommentPost.comments.map((c) => (
                      <View key={c.id} style={styles.commentRow}>
                        <Text style={styles.commentUser}>{c.user}:</Text>
                        <Text style={styles.commentText}>{c.text}</Text>
                        <Text style={styles.commentTime}>{c.time}</Text>
                      </View>
                    ))
                  )}
                </ScrollView>

                <View style={styles.commentInputRow}>
                  <TextInput
                    style={styles.commentInput}
                    value={newCommentInput}
                    onChangeText={setNewCommentInput}
                    placeholder="Write a comment..."
                    placeholderTextColor={colors.textMuted}
                  />
                  <TouchableOpacity style={styles.sendCommentBtn} onPress={handleAddComment}>
                    <Ionicons name="send" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              </>
            )}
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
    createBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.primary, borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 8 },
    createBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.xs },

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
