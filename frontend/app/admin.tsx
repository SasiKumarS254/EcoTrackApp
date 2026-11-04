import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  StatusBar,
  Image,
  RefreshControl,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_BASE_URL } from "@/services/api";
import { useTheme } from "@/context/ThemeContext";
import { Shadow, Radius, FontSize } from "@/constants/theme";

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [activeTab, setActiveTab] = useState<"users" | "listings" | "posts" | "telemetry">("users");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);

  // Search & Filters
  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");

  useEffect(() => {
    verifyAdminAuth();
  }, []);

  const verifyAdminAuth = async () => {
    try {
      const sessionRaw = await AsyncStorage.getItem("@ecotrack_user_session");
      if (sessionRaw) {
        const session = JSON.parse(sessionRaw);
        if (session.role !== "admin") {
          Alert.alert("Permission Denied", "You must be an administrator to access the Control Center.", [
            { text: "OK", onPress: () => router.back() }
          ]);
          return;
        }
      }
    } catch (e) {}
    loadAllData();
  };

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchStats(),
      fetchUsers(),
      fetchListings(),
      fetchPosts(),
    ]);
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/stats`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.stats) {
          setStats(data.stats);
        }
      }
    } catch (err) {
      console.warn("fetchStats error:", err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.warn("fetchUsers error:", err);
    }
  };

  const fetchListings = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/listings`);
      if (res.ok) {
        const data = await res.json();
        setListings(data.listings || []);
      }
    } catch (err) {
      console.warn("fetchListings error:", err);
    }
  };

  const fetchPosts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/posts`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch (err) {
      console.warn("fetchPosts error:", err);
    }
  };

  const handleRoleChange = async (userId: string, currentRole: string) => {
    const roles = ["user", "seller", "admin"];
    const nextRoleIndex = (roles.indexOf((currentRole || "user").toLowerCase()) + 1) % roles.length;
    const nextRole = roles[nextRoleIndex];

    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert("Success", `User role changed to ${nextRole.toUpperCase()}`);
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: nextRole } : u));
        fetchStats();
      } else {
        Alert.alert("Error", data.error || "Failed to update role");
      }
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const handleDeleteUser = (userId: string, userName: string) => {
    if (userId === "usr1" || userId === "usr_admin") {
      Alert.alert("Protected", "Root administrator accounts cannot be deleted.");
      return;
    }

    Alert.alert(
      "Confirm Deletion",
      `Are you sure you want to delete ${userName}? This will remove all their data permanently.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await fetch(`${API_BASE_URL}/admin/users/${userId}`, { method: "DELETE" });
              if (res.ok) {
                Alert.alert("Deleted", "User has been removed.");
                setUsers(prev => prev.filter(u => u.id !== userId));
                fetchStats();
              } else {
                const data = await res.json();
                Alert.alert("Error", data.error || "Failed to delete user");
              }
            } catch (e: any) {
              Alert.alert("Error", e.message);
            }
          }
        }
      ]
    );
  };

  const handleDeleteListing = (listingId: number, title: string) => {
    Alert.alert(
      "Remove Listing",
      `Delete "${title}" from marketplace?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await fetch(`${API_BASE_URL}/admin/listings/${listingId}`, { method: "DELETE" });
              if (res.ok) {
                Alert.alert("Removed", "Listing removed from marketplace.");
                setListings(prev => prev.filter(l => l.id !== listingId));
                fetchStats();
              }
            } catch (e: any) {
              Alert.alert("Error", e.message);
            }
          }
        }
      ]
    );
  };

  const handleDeletePost = (postId: number) => {
    Alert.alert(
      "Remove Post",
      "Delete this community post?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await fetch(`${API_BASE_URL}/admin/posts/${postId}`, { method: "DELETE" });
              if (res.ok) {
                Alert.alert("Removed", "Post deleted from community feed.");
                setPosts(prev => prev.filter(p => p.id !== postId));
                fetchStats();
              }
            } catch (e: any) {
              Alert.alert("Error", e.message);
            }
          }
        }
      ]
    );
  };

  const filteredUsers = users.filter(u => {
    const roleMatch = roleFilter === "ALL" || (u.role || "user").toUpperCase() === roleFilter;
    const query = userSearch.toLowerCase();
    const searchMatch = !query ||
      (u.name && u.name.toLowerCase().includes(query)) ||
      (u.email && u.email.toLowerCase().includes(query)) ||
      (u.ecotrack_id && u.ecotrack_id.toLowerCase().includes(query));
    return roleMatch && searchMatch;
  });

  return (
    <View style={[styles.container, { backgroundColor: isDark ? "#06130d" : "#f8fafc" }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Header Bar */}
      <View style={[styles.header, {
        paddingTop: insets.top > 0 ? insets.top + 8 : 24,
        backgroundColor: isDark ? "#0d2318" : "#ffffff",
        borderBottomColor: isDark ? "rgba(255,255,255,0.08)" : colors.border,
      }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#f1f5f9" }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Admin Control Center</Text>
              <View style={styles.adminBadge}>
                <Ionicons name="shield-checkmark" size={12} color="#ffffff" />
                <Text style={styles.adminBadgeText}>SUPER ADMIN</Text>
              </View>
            </View>
            <Text style={[styles.headerSub, { color: colors.textMuted }]}>Governance, telemetry & moderation</Text>
          </View>

          <TouchableOpacity
            style={[styles.refreshBtn, { backgroundColor: isDark ? "rgba(16,185,129,0.15)" : "rgba(16,185,129,0.1)" }]}
            onPress={onRefresh}
          >
            <Ionicons name="refresh" size={18} color="#10b981" />
          </TouchableOpacity>
        </View>

        {/* Tab Switcher */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabScrollContent}>
          {[
            { key: "users", label: "Users & Roles", icon: "people" },
            { key: "listings", label: "Listings", icon: "storefront" },
            { key: "posts", label: "Feed Posts", icon: "chatbubbles" },
            { key: "telemetry", label: "Telemetry", icon: "hardware-chip" },
          ].map((tab: any) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tabPill,
                  isActive && {
                    backgroundColor: "#10b981",
                    borderColor: "#059669"
                  },
                  !isActive && {
                    backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#f1f5f9",
                    borderColor: "transparent"
                  }
                ]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Ionicons name={tab.icon} size={15} color={isActive ? "#ffffff" : colors.textMuted} />
                <Text style={[styles.tabPillText, { color: isActive ? "#ffffff" : colors.textPrimary }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />}
        showsVerticalScrollIndicator={false}
      >
        {/* KPI Summary Cards */}
        <View style={styles.kpiGrid}>
          <View style={[styles.kpiCard, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#ffffff", borderColor: isDark ? "rgba(255,255,255,0.08)" : colors.border }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={styles.kpiLabel}>TOTAL USERS</Text>
              <Ionicons name="people-outline" size={18} color="#10b981" />
            </View>
            <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>{stats?.total_users ?? "--"}</Text>
            <Text style={styles.kpiSub}>
              {stats?.total_members || 0} Mem • {stats?.total_sellers || 0} Sel • {stats?.total_admins || 0} Adm
            </Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#ffffff", borderColor: isDark ? "rgba(255,255,255,0.08)" : colors.border }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={styles.kpiLabel}>LISTINGS</Text>
              <Ionicons name="storefront-outline" size={18} color="#0284c7" />
            </View>
            <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>{stats?.total_listings ?? "--"}</Text>
            <Text style={styles.kpiSub}>Active Products & Rescues</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#ffffff", borderColor: isDark ? "rgba(255,255,255,0.08)" : colors.border }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={styles.kpiLabel}>COMMUNITY</Text>
              <Ionicons name="chatbubbles-outline" size={18} color="#8b5cf6" />
            </View>
            <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>{stats?.total_posts ?? "--"}</Text>
            <Text style={styles.kpiSub}>{stats?.total_comments || 0} Comments</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#ffffff", borderColor: isDark ? "rgba(255,255,255,0.08)" : colors.border }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={styles.kpiLabel}>AI SCANS</Text>
              <Ionicons name="scan-outline" size={18} color="#f59e0b" />
            </View>
            <Text style={[styles.kpiValue, { color: colors.textPrimary }]}>{stats?.total_scans ?? "--"}</Text>
            <Text style={styles.kpiSub}>Species Keypoint Tests</Text>
          </View>
        </View>

        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={{ marginTop: 12, color: colors.textMuted, fontSize: 13 }}>Loading administrative data...</Text>
          </View>
        ) : (
          <>
            {/* 1. USERS & ROLES TAB */}
            {activeTab === "users" && (
              <View style={styles.sectionWrap}>
                {/* Search & Filter Bar */}
                <View style={[styles.searchBox, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#ffffff", borderColor: colors.border }]}>
                  <Ionicons name="search" size={17} color={colors.textMuted} />
                  <TextInput
                    style={[styles.searchInput, { color: colors.textPrimary }]}
                    placeholder="Search by name, email or ID..."
                    placeholderTextColor={colors.textMuted}
                    value={userSearch}
                    onChangeText={setUserSearch}
                  />
                  {userSearch ? (
                    <TouchableOpacity onPress={() => setUserSearch("")}>
                      <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Role Filter Pills */}
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
                  {["ALL", "ADMIN", "SELLER", "USER"].map(r => (
                    <TouchableOpacity
                      key={r}
                      style={[
                        styles.filterPill,
                        roleFilter === r && { backgroundColor: "#10b981" },
                        roleFilter !== r && { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#e2e8f0" }
                      ]}
                      onPress={() => setRoleFilter(r)}
                    >
                      <Text style={[styles.filterPillText, { color: roleFilter === r ? "#ffffff" : colors.textPrimary }]}>
                        {r}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Users List */}
                <View style={{ gap: 10 }}>
                  {filteredUsers.length === 0 ? (
                    <Text style={{ textAlign: "center", color: colors.textMuted, paddingVertical: 20 }}>
                      No users match the search filter.
                    </Text>
                  ) : (
                    filteredUsers.map(u => {
                      const role = (u.role || "user").toLowerCase();
                      const isRoot = u.id === "usr1" || u.id === "usr_admin";
                      const roleColor = role === "admin" ? "#059669" : role === "seller" ? "#0284c7" : "#64748b";

                      return (
                        <View
                          key={u.id}
                          style={[styles.userCard, {
                            backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#ffffff",
                            borderColor: isDark ? "rgba(255,255,255,0.08)" : colors.border
                          }]}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                            <View style={[styles.userAvatar, { backgroundColor: isDark ? "rgba(16,185,129,0.15)" : "#e2e8f0" }]}>
                              {u.avatar_url ? (
                                <Image source={{ uri: u.avatar_url }} style={styles.userAvatarImg} />
                              ) : (
                                <Text style={{ fontWeight: "700", color: "#10b981" }}>
                                  {(u.name || "U").charAt(0).toUpperCase()}
                                </Text>
                              )}
                            </View>

                            <View style={{ flex: 1, marginLeft: 12 }}>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                <Text style={[styles.userName, { color: colors.textPrimary }]}>{u.name || "Member"}</Text>
                                <View style={[styles.roleBadge, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#f1f5f9" }]}>
                                  <Text style={[styles.roleBadgeText, { color: roleColor }]}>{role.toUpperCase()}</Text>
                                </View>
                              </View>
                              <Text style={[styles.userEmail, { color: colors.textMuted }]}>{u.email}</Text>
                              <Text style={[styles.userMeta, { color: colors.textMuted }]}>
                                {u.ecotrack_id || u.id} • {u.post_count || 0} posts • {u.listing_count || 0} listings
                              </Text>
                            </View>
                          </View>

                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, justifyContent: "flex-end" }}>
                            <TouchableOpacity
                              style={[styles.roleActionBtn, { borderColor: roleColor }]}
                              onPress={() => handleRoleChange(u.id, u.role)}
                            >
                              <Ionicons name="swap-vertical" size={13} color={roleColor} />
                              <Text style={[styles.roleActionText, { color: roleColor }]}>Toggle Role</Text>
                            </TouchableOpacity>

                            {!isRoot && (
                              <TouchableOpacity
                                style={styles.deleteActionBtn}
                                onPress={() => handleDeleteUser(u.id, u.name || u.email)}
                              >
                                <Ionicons name="trash-outline" size={13} color="#ef4444" />
                                <Text style={styles.deleteActionText}>Delete</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              </View>
            )}

            {/* 2. MARKETPLACE MODERATION TAB */}
            {activeTab === "listings" && (
              <View style={styles.sectionWrap}>
                <Text style={[styles.sectionDesc, { color: colors.textMuted }]}>
                  Inspect and delete spam or unverified marketplace listings.
                </Text>
                <View style={{ gap: 10, marginTop: 10 }}>
                  {listings.length === 0 ? (
                    <Text style={{ textAlign: "center", color: colors.textMuted, paddingVertical: 20 }}>
                      No marketplace listings found.
                    </Text>
                  ) : (
                    listings.map(item => (
                      <View
                        key={item.id}
                        style={[styles.itemCard, {
                          backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#ffffff",
                          borderColor: isDark ? "rgba(255,255,255,0.08)" : colors.border
                        }]}
                      >
                        <View style={{ flexDirection: "row", gap: 12 }}>
                          {item.image ? (
                            <Image source={{ uri: item.image }} style={styles.itemThumb} />
                          ) : (
                            <View style={[styles.itemThumb, { backgroundColor: isDark ? "#1f2937" : "#e2e8f0", justifyContent: "center", alignItems: "center" }]}>
                              <Ionicons name="pricetag" size={24} color="#94a3b8" />
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.itemTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                              {item.title || item.name}
                            </Text>
                            <Text style={styles.itemPrice}>₹{item.price}</Text>
                            <Text style={[styles.itemSeller, { color: colors.textMuted }]}>
                              Category: {item.category || "General"} • Seller: {item.seller_name || item.user_id}
                            </Text>
                          </View>
                        </View>

                        <View style={{ marginTop: 10, alignItems: "flex-end" }}>
                          <TouchableOpacity
                            style={styles.deleteActionBtn}
                            onPress={() => handleDeleteListing(item.id, item.title || item.name)}
                          >
                            <Ionicons name="trash-outline" size={13} color="#ef4444" />
                            <Text style={styles.deleteActionText}>Remove Listing</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </View>
            )}

            {/* 3. POSTS MODERATION TAB */}
            {activeTab === "posts" && (
              <View style={styles.sectionWrap}>
                <Text style={[styles.sectionDesc, { color: colors.textMuted }]}>
                  Review community feed posts and remove flagged messages.
                </Text>
                <View style={{ gap: 10, marginTop: 10 }}>
                  {posts.length === 0 ? (
                    <Text style={{ textAlign: "center", color: colors.textMuted, paddingVertical: 20 }}>
                      No community posts found.
                    </Text>
                  ) : (
                    posts.map(p => (
                      <View
                        key={p.id}
                        style={[styles.postCard, {
                          backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#ffffff",
                          borderColor: isDark ? "rgba(255,255,255,0.08)" : colors.border
                        }]}
                      >
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <Text style={[styles.postAuthor, { color: colors.textPrimary }]}>
                            {p.author_name || "Community Member"}
                          </Text>
                          <Text style={[styles.postDate, { color: colors.textMuted }]}>
                            {p.created_at ? new Date(p.created_at).toLocaleDateString() : ""}
                          </Text>
                        </View>

                        <Text style={[styles.postContent, { color: colors.textSecondary }]}>
                          {p.content || p.text || "No text"}
                        </Text>

                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                          <Text style={[styles.postStats, { color: colors.textMuted }]}>
                            ❤️ {p.likes_count || 0} • 💬 {p.comments_count || 0}
                          </Text>
                          <TouchableOpacity
                            style={styles.deleteActionBtn}
                            onPress={() => handleDeletePost(p.id)}
                          >
                            <Ionicons name="trash-outline" size={13} color="#ef4444" />
                            <Text style={styles.deleteActionText}>Remove Post</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </View>
            )}

            {/* 4. TELEMETRY & SYSTEM TAB */}
            {activeTab === "telemetry" && (
              <View style={styles.sectionWrap}>
                <View style={[styles.telemetryCard, {
                  backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#ffffff",
                  borderColor: isDark ? "rgba(255,255,255,0.08)" : colors.border
                }]}>
                  <Text style={[styles.telemetryTitle, { color: colors.textPrimary }]}>
                    EcoTrack Dual-Engine Telemetry
                  </Text>

                  <View style={styles.telemetryRow}>
                    <Text style={[styles.telemetryLabel, { color: colors.textMuted }]}>Database Architecture:</Text>
                    <Text style={[styles.telemetryVal, { color: "#10b981" }]}>
                      {stats?.database_engine || "Supabase Cloud HTTPS & SQLite WAL Engine"}
                    </Text>
                  </View>

                  <View style={styles.telemetryRow}>
                    <Text style={[styles.telemetryLabel, { color: colors.textMuted }]}>Server Uptime:</Text>
                    <Text style={[styles.telemetryVal, { color: colors.textPrimary }]}>
                      {stats?.system_uptime ? `${Math.floor(stats.system_uptime / 60)} min (${stats.system_uptime}s)` : "--"}
                    </Text>
                  </View>

                  <View style={styles.telemetryRow}>
                    <Text style={[styles.telemetryLabel, { color: colors.textMuted }]}>Active Admin Accounts:</Text>
                    <Text style={[styles.telemetryVal, { color: "#0284c7" }]}>
                      admin@ecotrack.org, user@ecotrack.org
                    </Text>
                  </View>

                  <View style={styles.telemetryRow}>
                    <Text style={[styles.telemetryLabel, { color: colors.textMuted }]}>Root Accounts:</Text>
                    <Text style={[styles.telemetryVal, { color: "#ef4444" }]}>
                      usr_admin, usr1 (Protected from deletion)
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.diagRefreshBtn}
                    onPress={onRefresh}
                  >
                    <Ionicons name="refresh" size={16} color="#ffffff" />
                    <Text style={styles.diagRefreshBtnText}>Re-verify Telemetry</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: FontSize.md,
    fontWeight: "800",
  },
  headerSub: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  adminBadge: {
    backgroundColor: "#059669",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  adminBadgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "800",
  },
  tabScroll: { marginTop: 4 },
  tabScrollContent: { gap: 8, paddingBottom: 4 },
  tabPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  tabPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    width: "48%",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94a3b8",
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: "900",
    marginVertical: 4,
  },
  kpiSub: {
    fontSize: 10,
    color: "#64748b",
  },
  sectionWrap: { marginTop: 6 },
  sectionDesc: {
    fontSize: 12,
    marginBottom: 10,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  userCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  userAvatarImg: {
    width: 40,
    height: 40,
  },
  userName: {
    fontSize: 13,
    fontWeight: "700",
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: "800",
  },
  userEmail: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginTop: 2,
  },
  userMeta: {
    fontSize: 10,
    marginTop: 2,
  },
  roleActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  roleActionText: {
    fontSize: 11,
    fontWeight: "700",
  },
  deleteActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    backgroundColor: "rgba(239,68,68,0.08)",
  },
  deleteActionText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ef4444",
  },
  itemCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  itemThumb: {
    width: 65,
    height: 65,
    borderRadius: 8,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: "800",
    color: "#059669",
    marginTop: 2,
  },
  itemSeller: {
    fontSize: 11,
    marginTop: 2,
  },
  postCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  postAuthor: {
    fontSize: 13,
    fontWeight: "700",
  },
  postDate: {
    fontSize: 10,
  },
  postContent: {
    fontSize: 12,
    lineHeight: 17,
  },
  postStats: {
    fontSize: 11,
  },
  telemetryCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  telemetryTitle: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 14,
  },
  telemetryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  telemetryLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  telemetryVal: {
    fontSize: 12,
    fontWeight: "700",
    maxWidth: "55%",
    textAlign: "right",
  },
  diagRefreshBtn: {
    backgroundColor: "#10b981",
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 18,
  },
  diagRefreshBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13,
  },
});

