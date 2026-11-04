import React, { useState, useEffect, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, TextInput, Alert, StatusBar, Dimensions, ActivityIndicator, Share
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../../context/ThemeContext";
import { Radius, Shadow, FontSize } from "@/constants/theme";
import { fetchCommunityPosts, createCommunityPost, likeCommunityPost, commentCommunityPost, API_BASE_URL } from "../../services/api";



const REAL_DEFAULT_POSTS = [
  {
    id: 1,
    user_id: "usr_user1",
    author: "Alice Green",
    avatar: "https://randomuser.me/api/portraits/women/45.jpg",
    badge: "Verified Member",
    time: "2 hours ago",
    caption: "🦅 Wildlife Protection Guide: When observing nesting birds of prey or wild fauna, maintain a distance of at least 50 meters. Avoid loud noises that disturb territorial parents during brooding season. Feel free to ask any species observation questions below!",
    image: "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=1000",
    likes: 2,
    comments: 1,
    tags: ["WildlifeProtection", "PetCare", "EcoTrack"],
  },
  {
    id: 2,
    user_id: "usr_user3",
    author: "Charlie Eco",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200",
    badge: "Trainer",
    time: "5 hours ago",
    caption: "🏆 Training Tip of the Day: Consistent positive reinforcement during recall drills improves response speed by over 300%! Always reward with high-value treats within 1.5 seconds of execution. Check out Shadow's agility progress below!",
    image: "https://images.unsplash.com/photo-1534361960057-19889db9621e?w=1000",
    likes: 1,
    comments: 0,
    tags: ["DogTraining", "AgilityCoach", "PositiveReinforcement"],
  },
  {
    id: 3,
    user_id: "usr1",
    author: "Eco Explorer",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
    badge: "Conservationist",
    time: "1 day ago",
    caption: "🌱 Wildlife Protection Update: Successfully observed and documented a juvenile Peregrine Falcon in the wild with @dr_ananya! AI Scanner verified 99.8% species accuracy. Thank you to everyone supporting our community conservation drives! 🦅",
    image: "https://images.unsplash.com/photo-1611001716885-b3402558a62b?w=1000",
    likes: 1,
    comments: 0,
    tags: ["WildlifeProtection", "Falcon", "EcoTrackHeroes"],
  },
];

export default function CommunityScreen() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const [activeFilter, setActiveFilter] = useState("Latest");
  const [posts, setPosts] = useState<any[]>(REAL_DEFAULT_POSTS);
  const [likedPosts, setLikedPosts] = useState<Record<number, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<number, number>>({ 1: 2, 2: 1, 3: 1 });
  const [user, setUser] = useState<any>(null);

  // New Post Form
  const [newPostText, setNewPostText] = useState("");
  const [selectedTag, setSelectedTag] = useState("Training Tips");
  const [newPostMedia, setNewPostMedia] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);

  // Expanded Comments
  const [expandedComments, setExpandedComments] = useState<Record<number, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({});
  const [postComments, setPostComments] = useState<Record<number, string[]>>({
    1: ["Thank you Dr. Ananya! Great advice on keeping a safe distance during bird nesting season."],
    2: [],
    3: [],
  });

  useEffect(() => {
    (async () => {
      try {
        const sessionRaw = await AsyncStorage.getItem("@ecotrack_user_session");
        if (sessionRaw) {
          const parsed = JSON.parse(sessionRaw);
          setUser(parsed);
        }

        const data = await fetchCommunityPosts();
        if (data && Array.isArray(data) && data.length > 0) {
          const commentMap: Record<number, string[]> = {};
          const countMap: Record<number, number> = {};

          const formatted = data.map((p: any) => {
            const rawComments = Array.isArray(p.comments) ? p.comments : [];
            const commentStrings = rawComments.map((c: any) =>
              typeof c === "string" ? c : (c.text ? `${c.user || c.user_name || "Community Member"}: ${c.text}` : String(c))
            );
            if (p.id) {
              commentMap[p.id] = commentStrings;
              countMap[p.id] = p.likes_count ?? p.likes ?? 0;
            }

            return {
              id: p.id || Math.random(),
              user_id: p.user_id,
              author: p.author_name || p.user || p.author || "EcoTrack Member",
              avatar: p.author_avatar || p.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120",
              badge: p.author_role || (p.vet_status ? "Veterinarian" : "Community Member"),
              time: p.created_at || p.timestamp || "Recent",
              caption: p.content || p.caption || "",
              image: (Array.isArray(p.media_urls) && p.media_urls[0]) || p.image || p.media || null,
              likes: p.likes_count ?? p.likes ?? 0,
              comments: rawComments.length,
              tags: p.tags ? (typeof p.tags === "string" ? p.tags.split(",") : p.tags) : [p.category || "General"],
            };
          });

          setPosts(formatted);
          setPostComments((prev) => ({ ...prev, ...commentMap }));
          setLikeCounts((prev) => ({ ...prev, ...countMap }));
        }
      } catch {
        console.warn("Using verified community posts");
      }
    })();
  }, []);

  const handlePickMedia = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Media library access is required to select photos.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        setNewPostMedia(res.assets[0].uri);
      }
    } catch (e) {
      Alert.alert("Picker Error", "Could not pick image.");
    }
  };

  const handleTakeCameraMedia = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Camera Permission Required", "Camera access is needed to capture a community post photo.");
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        setNewPostMedia(res.assets[0].uri);
      }
    } catch (e) {
      Alert.alert("Camera Error", "Could not take photo with camera.");
    }
  };

  const handleSharePost = async (post: any) => {
    try {
      const authorName = post.user?.name || post.author || "EcoTrack Member";
      const postText = post.content || post.text || "";
      const shareMsg = `🐾 ${authorName} on EcoTrack Community:\n\n"${postText}"\n\nJoin EcoTrack to protect wildlife and track animal welfare!`;

      await Share.share({
        message: shareMsg,
        title: `${authorName}'s Post on EcoTrack`,
      });
    } catch (error) {
      Alert.alert("Share", "Post link copied to clipboard.");
    }
  };

  const handleCreatePost = async () => {
    if (!newPostText.trim()) {
      Alert.alert("Missing Text", "Please enter what you want to share with the community.");
      return;
    }

    setIsPosting(true);
    const authorName = user?.name || user?.display_name || user?.email?.split("@")[0] || "EcoTrack User";
    const authorAvatar = user?.avatar_url || user?.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120";

    const postPayload = {
      content: newPostText.trim(),
      category: selectedTag,
      media_urls: newPostMedia ? [newPostMedia] : [],
      user_id: user?.id || user?.user_id,
    };

    // Save to backend database
    let createdId = Date.now();
    try {
      const backendRes = await createCommunityPost(postPayload);
      if (backendRes?.post?.id || backendRes?.id) {
        createdId = backendRes.post?.id || backendRes.id;
      }
    } catch (err) {
      console.warn("Could not sync post to backend:", err);
    }

    const postItem = {
      id: createdId,
      user_id: user?.id || user?.user_id,
      author: authorName,
      avatar: authorAvatar,
      badge: user?.role === "admin" ? "Admin" : "Verified Member",
      time: "Just now",
      caption: newPostText.trim(),
      image: newPostMedia || null,
      likes: 0,
      comments: 0,
      tags: [selectedTag],
    };

    setPosts([postItem, ...posts]);
    setNewPostText("");
    setNewPostMedia(null);
    setIsPosting(false);
    Alert.alert("Post Published 🎉", "Your post is now visible in the community feed.");
  };

  const toggleLike = async (postId: number) => {
    const isLiked = Boolean(likedPosts[postId]);
    setLikedPosts((prev) => ({ ...prev, [postId]: !isLiked }));
    setLikeCounts((prev) => ({
      ...prev,
      [postId]: Math.max(0, (prev[postId] || 0) + (isLiked ? -1 : 1)),
    }));

    try {
      const currentUserId = user?.id || user?.user_id || "usr1";
      await likeCommunityPost(postId, currentUserId);
    } catch (e) {
      console.warn("Error saving like:", e);
    }
  };

  const toggleComments = (postId: number) => {
    setExpandedComments((prev) => ({ ...prev, [postId]: !prev[postId] }));
  };

  const handleAddComment = async (postId: number) => {
    const comment = commentInputs[postId]?.trim();
    if (!comment) return;

    const authorPrefix = user?.name ? `${user.name.split(" ")[0]}: ` : "";
    const displayComment = `${authorPrefix}${comment}`;

    setPostComments((prev) => ({
      ...prev,
      [postId]: [...(prev[postId] || []), displayComment],
    }));
    setCommentInputs((prev) => ({ ...prev, [postId]: "" }));

    try {
      await commentCommunityPost(postId, {
        text: comment,
        user_id: user?.id || user?.user_id || "usr1",
      });
    } catch (e) {
      console.warn("Error saving comment:", e);
    }
  };

  const filterTabs = ["Latest", "Trending", "Q&A", "My Posts"];
  const postTagOptions = ["Training Tips", "Health Advice", "Rescue Alert", "Adoption Update"];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* TOP HEADER */}
      <View style={styles.topHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={styles.topIconWrap}>
            <Ionicons name="people" size={20} color="#fff" />
          </View>
          <View>
            <Text style={styles.topTitle}>Community Feed</Text>
            <Text style={styles.topSub}>Animal Welfare Network & Tips</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.profileHeaderBtn}
          onPress={() => router.navigate("/(tabs)/profile" as any)}
          activeOpacity={0.8}
        >
          <Ionicons name="person-circle" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* CREATE POST CARD */}
        <View style={styles.createPostCard}>
          <View style={styles.createPostTop}>
            <Image
              source={{ uri: user?.avatar_url || user?.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120" }}
              style={styles.myAvatar}
            />
            <TextInput
              style={styles.postInput}
              placeholder="What's on your mind? Share training milestones, rescue alerts, or animal care advice..."
              placeholderTextColor={colors.textMuted}
              value={newPostText}
              onChangeText={setNewPostText}
              multiline
            />
          </View>

          {/* Media preview if selected */}
          {newPostMedia && (
            <View style={styles.mediaPreviewWrap}>
              <Image source={{ uri: newPostMedia }} style={styles.mediaPreviewImg} />
              <TouchableOpacity style={styles.removeMediaBtn} onPress={() => setNewPostMedia(null)}>
                <Ionicons name="close-circle" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          {/* Tag Selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagScroll}>
            {postTagOptions.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.postTagChip, selectedTag === t && styles.postTagChipActive]}
                onPress={() => setSelectedTag(t)}
              >
                <Text style={[styles.postTagChipText, selectedTag === t && styles.postTagChipTextActive]}>
                  #{t}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Post Action Footer */}
          <View style={styles.createPostFooter}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <TouchableOpacity style={styles.addMediaBtn} onPress={handlePickMedia} activeOpacity={0.8}>
                <Ionicons name="images-outline" size={17} color={colors.primary} />
                <Text style={styles.addMediaBtnText}>{newPostMedia ? "Change" : "Gallery"}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.addMediaBtn} onPress={handleTakeCameraMedia} activeOpacity={0.8}>
                <Ionicons name="camera-outline" size={17} color={colors.primary} />
                <Text style={styles.addMediaBtnText}>Camera</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.publishBtn} onPress={handleCreatePost} disabled={isPosting}>
              <Ionicons name="send" size={14} color="#fff" />
              <Text style={styles.publishBtnText}>Share Post</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* FEED FILTER TABS */}
        <View style={styles.filterTabsRow}>
          {filterTabs.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterTab, activeFilter === f && styles.filterTabActive]}
              onPress={() => setActiveFilter(f)}
            >
              <Text style={[styles.filterTabText, activeFilter === f && styles.filterTabTextActive]}>
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* POSTS LIST */}
        <View style={styles.postsList}>
          {posts.map((p, idx) => {
            const isLiked = Boolean(likedPosts[p.id]);
            const likesCount = likeCounts[p.id] || p.likes || 0;
            const commentsList = postComments[p.id] || [];
            const isCommentExpanded = Boolean(expandedComments[p.id]);

            return (
              <View key={`post-${p.id || idx}-${idx}`} style={styles.postCard}>
                {/* Author Info */}
                <View style={styles.authorRow}>
                  <Image source={{ uri: p.avatar }} style={styles.authorAvatar} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={styles.authorName}>{p.author}</Text>
                      <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={styles.authorBadge}>{p.badge}</Text>
                      <Text style={styles.metaDot}>•</Text>
                      <Text style={styles.postTime}>{p.time}</Text>
                    </View>
                  </View>
                </View>

                {/* Caption */}
                <Text style={styles.postCaption}>{p.caption}</Text>

                {/* Tag Pills */}
                {p.tags && (
                  <View style={styles.tagsRow}>
                    {p.tags.map((t: string, idx: number) => (
                      <View key={idx} style={styles.tagPill}>
                        <Text style={styles.tagPillText}>#{t}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Post Media */}
                {p.image && (
                  <View style={styles.postMediaWrap}>
                    <Image source={{ uri: p.image }} style={styles.postMediaImg} />
                  </View>
                )}

                {/* Interactive Action Bar */}
                <View style={styles.postActionBar}>
                  <TouchableOpacity style={styles.actionItem} onPress={() => toggleLike(p.id)}>
                    <Ionicons
                      name={isLiked ? "heart" : "heart-outline"}
                      size={20}
                      color={isLiked ? colors.danger : colors.textSecondary}
                    />
                    <Text style={[styles.actionLabel, isLiked && { color: colors.danger }]}>
                      {likesCount} Likes
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionItem} onPress={() => toggleComments(p.id)}>
                    <Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} />
                    <Text style={styles.actionLabel}>{commentsList.length} Comments</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionItem}
                    onPress={() => handleSharePost(p)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="share-social-outline" size={18} color={colors.textSecondary} />
                    <Text style={styles.actionLabel}>Share</Text>
                  </TouchableOpacity>
                </View>

                {/* Expanded Comment Thread */}
                {isCommentExpanded && (
                  <View style={styles.commentsThread}>
                    {commentsList.map((c, cIdx) => (
                      <View key={cIdx} style={styles.commentItem}>
                        <Ionicons name="chatbox-ellipses" size={12} color={colors.primary} />
                        <Text style={styles.commentText}>{c}</Text>
                      </View>
                    ))}

                    <View style={styles.commentInputRow}>
                      <TextInput
                        style={styles.commentInput}
                        placeholder="Write a comment..."
                        placeholderTextColor={colors.textMuted}
                        value={commentInputs[p.id] || ""}
                        onChangeText={(text) =>
                          setCommentInputs((prev) => ({ ...prev, [p.id]: text }))
                        }
                      />
                      <TouchableOpacity
                        style={styles.sendCommentBtn}
                        onPress={() => handleAddComment(p.id)}
                      >
                        <Ionicons name="send" size={14} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function getStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.bgLight,
    },
    topHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 18,
      paddingVertical: 14,
      backgroundColor: colors.bgCard,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      maxWidth: 1000,
      width: "100%",
      alignSelf: "center",
    },
    profileHeaderBtn: {
      padding: 2,
    },
    topIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: "#8b5cf6",
      justifyContent: "center",
      alignItems: "center",
    },
    topTitle: {
      fontSize: 18,
      fontWeight: "900",
      color: colors.textPrimary,
    },
    topSub: {
      fontSize: 10.5,
      fontWeight: "700",
      color: colors.textSecondary,
    },

    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
      maxWidth: 1000,
      width: "100%",
      alignSelf: "center",
    },

    createPostCard: {
      backgroundColor: colors.bgCard,
      borderRadius: Radius.xl,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
      ...Shadow.sm,
    },
    createPostTop: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 10,
    },
    myAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    postInput: {
      flex: 1,
      fontSize: FontSize.sm,
      color: colors.textPrimary,
      minHeight: 60,
      textAlignVertical: "top",
    },

    mediaPreviewWrap: {
      height: 160,
      borderRadius: Radius.md,
      overflow: "hidden",
      position: "relative",
      marginBottom: 10,
      backgroundColor: "#000",
    },
    mediaPreviewImg: {
      width: "100%",
      height: "100%",
      resizeMode: "cover",
    },
    removeMediaBtn: {
      position: "absolute",
      top: 8,
      right: 8,
      backgroundColor: "rgba(0,0,0,0.6)",
      borderRadius: 12,
    },

    tagScroll: {
      flexDirection: "row",
      marginBottom: 12,
    },
    postTagChip: {
      backgroundColor: isDark ? "#0f172a" : "#f1f5f9",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: Radius.full,
      marginRight: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    postTagChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    postTagChipText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    postTagChipTextActive: {
      color: "#fff",
    },

    createPostFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    addMediaBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    addMediaBtnText: {
      fontSize: FontSize.xs,
      fontWeight: "700",
      color: colors.primary,
    },
    publishBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: Radius.full,
      gap: 6,
    },
    publishBtnText: {
      color: "#fff",
      fontSize: FontSize.xs,
      fontWeight: "800",
    },

    filterTabsRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 16,
    },
    filterTab: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: Radius.full,
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterTabActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterTabText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    filterTabTextActive: {
      color: "#fff",
      fontWeight: "800",
    },

    postsList: {
      gap: 16,
    },
    postCard: {
      backgroundColor: colors.bgCard,
      borderRadius: Radius.xl,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      ...Shadow.sm,
    },
    authorRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12,
    },
    authorAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
    },
    authorName: {
      fontSize: FontSize.sm,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    authorBadge: {
      fontSize: 10.5,
      fontWeight: "700",
      color: colors.primary,
    },
    metaDot: {
      color: colors.textMuted,
      fontSize: 10,
    },
    postTime: {
      fontSize: 10.5,
      color: colors.textMuted,
      fontWeight: "500",
    },

    postCaption: {
      fontSize: FontSize.sm,
      color: colors.textPrimary,
      lineHeight: 22,
      marginBottom: 10,
    },

    tagsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: 12,
    },
    tagPill: {
      backgroundColor: isDark ? "#064e3b" : "#ecfdf5",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: Radius.full,
    },
    tagPillText: {
      fontSize: 10.5,
      fontWeight: "700",
      color: colors.primary,
    },

    postMediaWrap: {
      height: 240,
      borderRadius: Radius.lg,
      overflow: "hidden",
      backgroundColor: "#000",
      marginBottom: 14,
    },
    postMediaImg: {
      width: "100%",
      height: "100%",
      resizeMode: "cover",
    },

    postActionBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    actionItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 4,
    },
    actionLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textSecondary,
    },

    commentsThread: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 8,
    },
    commentItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      backgroundColor: isDark ? "#0f172a" : "#f8fafc",
      padding: 10,
      borderRadius: Radius.md,
    },
    commentText: {
      flex: 1,
      fontSize: 12,
      color: colors.textPrimary,
      lineHeight: 16,
    },
    commentInputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 4,
    },
    commentInput: {
      flex: 1,
      backgroundColor: isDark ? "#0f172a" : "#f8fafc",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.full,
      paddingHorizontal: 14,
      paddingVertical: 8,
      fontSize: 12,
      color: colors.textPrimary,
    },
    sendCommentBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary,
      justifyContent: "center",
      alignItems: "center",
    },
  });
}
