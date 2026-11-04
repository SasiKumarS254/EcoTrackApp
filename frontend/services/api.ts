// ============================================================
// EcoTrack Frontend API & Offline Data Service Layer
// ============================================================

import AsyncStorage from "@react-native-async-storage/async-storage";

import { Platform } from "react-native";
import Constants from "expo-constants";

// Dynamically resolve backend URL across Physical Mobile devices (Expo Go), Android Emulator, and Web
const resolveBackendUrl = () => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      return `http://${window.location.hostname}:5000/api`;
    }
    return "http://127.0.0.1:5000/api";
  }

  // Detect Expo host URI across all Expo SDK versions & platforms (Expo Go, custom client, dev builds)
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).expoGoConfig?.debuggerHost ||
    (Constants as any).__expoHostUri ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).experienceUrl;

  if (hostUri && typeof hostUri === 'string') {
    const cleanHost = hostUri.replace(/^[a-zA-Z]+:\/\//, '');
    const ip = cleanHost.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:5000/api`;
    }
  }

  // Fallback to Development Machine LAN IP (accessible by physical Android/iOS devices on Wi-Fi)
  return "http://172.25.16.172:5000/api";
};

export const API_BASE_URL = resolveBackendUrl();
export const STORAGE_KEYS = {
  ANALYTICS: "@ecotrack_training_analytics",
  SCANS: "@ecotrack_scans_history",
  MARKETPLACE: "@ecotrack_marketplace_items",
  EVENTS: "@ecotrack_events_list",
  COMMUNITY: "@ecotrack_community_posts",
  AUTH: "@ecotrack_auth_token",
  USER_ID: "@ecotrack_user_id",
  SESSION: "@ecotrack_user_session"
};

// Authenticated fetch wrapper to automatically inject Authorization token
const customFetch = async (url: string | Request | URL, options: any = {}) => {
  try {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH);
    const userId = await AsyncStorage.getItem(STORAGE_KEYS.USER_ID);
    options.headers = options.headers || {};
    if (options.headers instanceof Headers) {
      if (token) options.headers.set('Authorization', `Bearer ${token}`);
      if (userId) options.headers.set('x-user-id', userId);
    } else if (Array.isArray(options.headers)) {
      if (token) options.headers.push(['Authorization', `Bearer ${token}`]);
      if (userId) options.headers.push(['x-user-id', userId]);
    } else {
      if (token) options.headers['Authorization'] = `Bearer ${token}`;
      if (userId) options.headers['x-user-id'] = userId;
    }
  } catch (e) {
    console.warn("Error injecting mobile authorization token:", e);
  }
  return fetch(url, options);
};

export async function login(credentials: any) {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials)
  });
  const data = await res.json();
  if (res.ok) {
    await AsyncStorage.setItem(STORAGE_KEYS.AUTH, data.token);
    await AsyncStorage.setItem(STORAGE_KEYS.USER_ID, data.user.id);
    await AsyncStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify({
      ...data.user,
      id: data.user.id,
      user_id: data.user.id,  // ensure user_id is always set
      token: data.token
    }));
  }
  return { ok: res.ok, data };
}

export async function signup(userData: any) {
  const res = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userData)
  });
  const data = await res.json();
  if (res.ok) {
    await AsyncStorage.setItem(STORAGE_KEYS.AUTH, data.token);
    await AsyncStorage.setItem(STORAGE_KEYS.USER_ID, data.user.id);
    await AsyncStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify({
      ...data.user,
      id: data.user.id,
      user_id: data.user.id,  // ensure user_id is always set
      token: data.token
    }));
  }
  return { ok: res.ok, data };
}

export async function forgotPassword(email: string) {
  const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });
  return { ok: res.ok, data: await res.json() };
}

export async function verifyOtp(email: string, otp: string) {
  const res = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp })
  });
  return { ok: res.ok, data: await res.json() };
}

export async function resetPassword(resetData: any) {
  const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(resetData)
  });
  return { ok: res.ok, data: await res.json() };
}

export async function fetchTaxonomySpecies(query: string = "", className: string = "All") {
  try {
    const url = `${API_BASE_URL}/taxonomy/search?query=${encodeURIComponent(query)}&class_name=${encodeURIComponent(className)}`;
    const response = await customFetch(url);
    if (response.ok) {
      const data = await response.json();
      return data.results;
    }
  } catch (e) {
    console.warn("Backend API offline, using local memory taxonomy fallback");
  }
  return null;
}
const getUserKey = async (baseKey: string) => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.USER_ID);
    return raw ? `${baseKey}_${raw}` : baseKey;
  } catch {
    return baseKey;
  }
};

export async function syncAnalyticsData(record?: any) {
  const analyticsKey = await getUserKey(STORAGE_KEYS.ANALYTICS);
  if (record) {
    try {
      await customFetch(`${API_BASE_URL}/analytics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      });
    } catch (e) {
      console.warn("Offline: saving analytics to local device storage");
    }
    const local = await AsyncStorage.getItem(analyticsKey);
    const history = local ? JSON.parse(local) : [];
    history.unshift(record);
    await AsyncStorage.setItem(analyticsKey, JSON.stringify(history));
    return history;
  }
  try {
    const res = await customFetch(`${API_BASE_URL}/analytics`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn("Using offline analytics store");
  }
  const local = await AsyncStorage.getItem(analyticsKey);
  return local ? JSON.parse(local) : { obedience: 85, focus: 90, level: 1, history: [] };
}

export async function saveScanRecord(scanData: any) {
  const scansKey = await getUserKey(STORAGE_KEYS.SCANS);
  try {
    await customFetch(`${API_BASE_URL}/scans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scanData),
    });
  } catch (e) {
    console.warn("Offline: saving scan record to local device storage");
  }
  const local = await AsyncStorage.getItem(scansKey);
  const scans = local ? JSON.parse(local) : [];
  scans.unshift({ id: Date.now(), ...scanData, created_at: new Date().toISOString() });
  await AsyncStorage.setItem(scansKey, JSON.stringify(scans));
}

/**
 * SAVE FULL SCAN REPORT
 * Strictly used by the AI Scanner pipeline to store real inference data.
 */
export async function saveScanFull(report: any) {
  try {
    const res = await customFetch(`${API_BASE_URL}/ai/scan-save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
    });
    return res.ok;
  } catch (e) {
    console.warn("Offline: Full scan report saved locally only.");
    return false;
  }
}

/**
 * GET USER PROGRESSION
 * Retrieves unlocked exercises and completion percentages from actual scanner history.
 */
export async function getUserProgress(userId: string) {
  try {
    const res = await customFetch(`${API_BASE_URL}/user/progress/${userId}`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn("Offline: using cached user progress");
  }
  return null;
}

// ── CART SYNC ──
export async function fetchCart(userId: string) {
  try {
    const res = await customFetch(`${API_BASE_URL}/cart/${userId}`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn("Fetch cart offline fallback");
  }
  const local = await AsyncStorage.getItem(`@ecotrack_cart_${userId}`);
  return local ? JSON.parse(local) : [];
}

export async function addToCart(userId: string, item: any) {
  try {
    await customFetch(`${API_BASE_URL}/cart/${userId}/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
  } catch (e) {
    console.warn("Add to cart offline");
  }
}

export async function removeFromCart(userId: string, itemId: number) {
  try {
    await customFetch(`${API_BASE_URL}/cart/${userId}/remove`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
  } catch (e) {
    console.warn("Remove from cart offline");
  }
}

export async function updateCart(userId: string, items: any[]) {
  try {
    await customFetch(`${API_BASE_URL}/cart/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
  } catch (e) {
    console.warn("Update cart offline");
  }
}

export async function checkoutCart(userId: string, total: number, shippingAddress?: string) {
  try {
    const res = await customFetch(`${API_BASE_URL}/cart/${userId}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ total, shipping_address: shippingAddress }),
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn("Checkout offline");
  }
  return null;
}

// ── FAVORITES SYNC ──
export async function fetchFavorites(userId: string) {
  try {
    const res = await customFetch(`${API_BASE_URL}/users/${userId}/favorites`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn("Fetch favorites offline");
  }
  const local = await AsyncStorage.getItem(`@ecotrack_favorites_${userId}`);
  return local ? JSON.parse(local) : [];
}

export async function toggleFavorite(userId: string, itemId: number) {
  try {
    const res = await customFetch(`${API_BASE_URL}/users/${userId}/favorites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.favorites;
    }
  } catch (e) {
    console.warn("Toggle favorite offline");
  }
  return null;
}

// ── MARKETPLACE LISTINGS SYNC ──
export async function fetchListings() {
  try {
    const res = await customFetch(`${API_BASE_URL}/marketplace`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn("Fetch listings offline");
  }
  return null;
}

export async function createListing(listingData: any) {
  try {
    const res = await customFetch(`${API_BASE_URL}/marketplace/listing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(listingData),
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn("Create listing offline");
  }
  return null;
}

export async function deleteMarketplaceListing(id: number | string) {
  try {
    const res = await customFetch(`${API_BASE_URL}/marketplace/listing/${id}`, {
      method: "DELETE"
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn("Delete marketplace listing offline", e);
  }
  return null;
}



export async function fetchSocialProfile(userId: string) {
  try {
    const res = await customFetch(`${API_BASE_URL}/social/profile/${userId}`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn("Fetch social profile offline", e);
  }
  return null;
}

export async function fetchMySocialProfile() {
  try {
    const res = await customFetch(`${API_BASE_URL}/social/me`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.profile) {
        await AsyncStorage.setItem("@ecotrack_social_profile", JSON.stringify(data));
      }
      return data;
    }
  } catch (e) {
    console.warn("Fetch my social profile offline, checking local storage", e);
  }
  try {
    const cached = await AsyncStorage.getItem("@ecotrack_social_profile");
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.warn("Error reading cached profile", e);
  }
  return null;
}

export async function updateSocialProfile(profileData: any) {
  try {
    const res = await customFetch(`${API_BASE_URL}/social/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profileData),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.profile) {
        // Fetch current cached data and update it
        const cached = await AsyncStorage.getItem("@ecotrack_social_profile");
        let updatedCache = { profile: data.profile, pets: [], achievements: [] };
        if (cached) {
          const parsed = JSON.parse(cached);
          updatedCache = {
            ...parsed,
            profile: { ...parsed.profile, ...data.profile }
          };
        }
        await AsyncStorage.setItem("@ecotrack_social_profile", JSON.stringify(updatedCache));
      }
      return data;
    }
  } catch (e) {
    console.warn("Update social profile offline, falling back to local storage update", e);
  }
  // Offline fallback
  try {
    const cached = await AsyncStorage.getItem("@ecotrack_social_profile");
    if (cached) {
      const parsed = JSON.parse(cached);
      const updatedProfile = { ...parsed.profile, ...profileData };
      const updatedCache = { ...parsed, profile: updatedProfile };
      await AsyncStorage.setItem("@ecotrack_social_profile", JSON.stringify(updatedCache));
      return { profile: updatedProfile };
    }
  } catch (err) {
    console.warn("Offline profile save failed", err);
  }
  return null;
}

export async function toggleFollow(followingId: string) {
  try {
    const res = await customFetch(`${API_BASE_URL}/social/follow/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ following_id: followingId }),
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn("Toggle follow offline");
  }
  return null;
}

export async function toggleBookmark(postId: number) {
  try {
    const res = await customFetch(`${API_BASE_URL}/social/posts/${postId}/bookmark`, {
      method: "POST"
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn("Toggle bookmark offline");
  }
  return null;
}

// ── USER PROFILE ──
export async function fetchUserProfile(userId: string) {
  try {
    const res = await customFetch(`${API_BASE_URL}/users/${userId}`);
    if (res.ok) {
      const data = await res.json();
      return data.profile || data;
    }
  } catch (e) {
    console.warn("Fetch user profile offline, trying social profile endpoint", e);
  }
  try {
    const res2 = await customFetch(`${API_BASE_URL}/social/profile/${userId}`);
    if (res2.ok) {
      const data = await res2.json();
      return data.profile || data;
    }
  } catch (err) {}
  return null;
}

export async function updateUserProfile(profileData: any) {
  try {
    const res = await customFetch(`${API_BASE_URL}/social/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profileData),
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn("Update profile error:", e);
  }
  return null;
}

export async function fetchFullUserProfile(userId: string) {
  try {
    const res = await customFetch(`${API_BASE_URL}/social/profile/${userId}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {}
  return null;
}

export async function addPet(petData: any) {
  try {
    const res = await customFetch(`${API_BASE_URL}/social/pets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(petData),
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn("Add pet failed:", e);
  }
  return null;
}

// ── CHAT & MESSAGING SYNC ──
export async function fetchThread(user1Id: string, user2Id: string, listingId?: string | null) {
  try {
    const url = listingId
      ? `${API_BASE_URL}/messages/thread/${user1Id}/${user2Id}?listing_id=${listingId}`
      : `${API_BASE_URL}/messages/thread/${user1Id}/${user2Id}`;
    const res = await customFetch(url);
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data : (data.messages || []);
    }
  } catch (e) {
    console.warn("Fetch message thread offline");
  }
  return null;
}

export async function fetchMessages(userId: string) {
  try {
    const res = await customFetch(`${API_BASE_URL}/messages/conversations/${userId}`);
    if (res.ok) {
      const data = await res.json();
      const rawList = Array.isArray(data) ? data : (data.conversations || []);
      const normalized = rawList.map((c: any) => ({
        id: c.id || c.partner_id || c.other_user_id,
        other_user_id: c.other_user_id || c.partner_id,
        other_user_name: c.other_user_name || c.partner_name || "Eco Member",
        other_user_avatar: c.other_user_avatar || c.partner_avatar || "",
        last_message: c.last_message || "",
        last_message_time: c.last_message_time || c.last_time || new Date().toISOString(),
        listing_id: c.listing_id || null,
        listing_title: c.listing_title || null,
        listing_image: c.listing_image || null,
        unread_count: c.unread_count || 0
      }));
      return { conversations: normalized };
    }
  } catch (e) {
    console.warn("Fetch messages offline", e);
  }
  return { conversations: [] };
}

export async function sendMessage(fromUserId: string, toUserId: string, text: string, mediaUrl?: string, mediaType?: string, listingId?: string | null) {
  try {
    const res = await customFetch(`${API_BASE_URL}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to_user_id: toUserId,
        receiver_id: toUserId,
        text,
        media_url: mediaUrl || null,
        media_type: mediaType || null,
        listing_id: listingId || null
      }),
    });
    if (res.ok) return await res.json();
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Send failed: ${res.status}`);
  } catch (e: any) {
    console.warn("Send message error:", e.message || e);
    throw e;
  }
}

export async function deleteMessage(messageId: string | number, deleteType: 'me' | 'all' = 'me') {
  try {
    const userId = (await AsyncStorage.getItem(STORAGE_KEYS.USER_ID)) || 'usr1';
    const res = await customFetch(`${API_BASE_URL}/messages/${messageId}?delete_type=${deleteType}&user_id=${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });
    if (res.ok) return await res.json();
    return null;
  } catch (e: any) {
    console.warn("Delete message error:", e.message || e);
    return null;
  }
}

export async function deleteConversation(partnerId: string) {
  try {
    const userId = (await AsyncStorage.getItem(STORAGE_KEYS.USER_ID)) || 'usr1';
    const res = await customFetch(`${API_BASE_URL}/messages/conversations/${partnerId}?user_id=${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });
    if (res.ok) return await res.json();
    return null;
  } catch (e: any) {
    console.warn("Delete conversation error:", e.message || e);
    return null;
  }
}

// ── TRAINING PROGRAMS SYNC ──
export async function fetchTrainingPrograms(userId: string) {
  try {
    const res = await customFetch(`${API_BASE_URL}/training/programs/${userId}`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn("Fetch training programs offline");
  }
  return null;
}

export async function saveTrainingProgram(userId: string, programData: any) {
  try {
    const res = await customFetch(`${API_BASE_URL}/training/programs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, ...programData }),
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn("Save training program offline");
  }
  return null;
}

export async function updateTrainingProgramProgress(userId: string, programId: string, progressData: any) {
  try {
    const res = await customFetch(`${API_BASE_URL}/training/programs/${userId}/${programId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(progressData),
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn("Update training program progress offline");
  }
  return null;
}

export async function deleteTrainingProgram(userId: string, programId: string) {
  try {
    const res = await customFetch(`${API_BASE_URL}/training/programs/${userId}/${programId}`, {
      method: "DELETE"
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn("Delete training program offline", e);
  }
  return null;
}

// ── COMMUNITY POSTS SYNC ──
export async function fetchCommunityPosts(userId?: string) {
  try {
    const res = await customFetch(`${API_BASE_URL}/community?user_id=${userId || ""}`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn("Fetch community posts offline");
  }
  return null;
}

export async function createCommunityPost(postData: any) {
  try {
    const res = await customFetch(`${API_BASE_URL}/community`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(postData),
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn("Create community post offline");
  }
  return null;
}

export async function likeCommunityPost(postId: number, userId: string) {
  try {
    const res = await customFetch(`${API_BASE_URL}/social/posts/${postId}/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    if (res.ok) return await res.json();
  } catch (e) {
    try {
      const res2 = await customFetch(`${API_BASE_URL}/community/${postId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      if (res2.ok) return await res2.json();
    } catch(err) {}
    console.warn("Like community post offline");
  }
  return null;
}

export async function commentCommunityPost(postId: number, commentData: any) {
  try {
    const res = await customFetch(`${API_BASE_URL}/social/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(commentData),
    });
    if (res.ok) return await res.json();
  } catch (e) {
    try {
      const res2 = await customFetch(`${API_BASE_URL}/community/${postId}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(commentData),
      });
      if (res2.ok) return await res2.json();
    } catch(err) {}
    console.warn("Comment community post offline");
  }
  return null;
}

// ── REAL CARE SERVICES SYNC ──
export async function fetchCareServices(type?: string, search?: string) {
  try {
    const params = new URLSearchParams();
    if (type) params.append("type", type);
    if (search) params.append("search", search);
    const res = await customFetch(`${API_BASE_URL}/services?${params.toString()}`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn("Fetch care services offline, using static verified list");
  }
  return null;
}

// ── MARKETPLACE SYNC ──
export async function fetchMarketplaceAnimals() {
  try {
    const res = await customFetch(`${API_BASE_URL}/marketplace?category=Pets`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (e) {
    console.warn("Fetch marketplace animals offline");
  }
  return null;
}

export async function fetchMarketplaceProducts() {
  try {
    const res = await customFetch(`${API_BASE_URL}/marketplace`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        const products = data.filter((item: any) => item.category !== 'Pets');
        if (products.length > 0) return products;
      }
    }
  } catch (e) {
    console.warn("Fetch marketplace products offline");
  }
  return null;
}

// ── EVENTS SYNC ──
export async function fetchEvents(category?: string) {
  try {
    const url = `${API_BASE_URL}/events` + (category ? `?category=${category}` : "");
    const res = await customFetch(url);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn("Fetch events offline");
  }
  return null;
}

export async function createEvent(eventData: any) {
  try {
    const res = await customFetch(`${API_BASE_URL}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eventData),
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn("Create event offline", e);
  }
  return null;
}

export async function deleteEvent(eventId: number | string) {
  try {
    const res = await customFetch(`${API_BASE_URL}/events/${eventId}`, {
      method: "DELETE"
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn("Delete event offline", e);
  }
  return null;
}

export async function registerForEvent(eventId: number) {
  try {
    const res = await customFetch(`${API_BASE_URL}/events/${eventId}/register`, {
      method: "POST"
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn("Register event offline");
  }
  return null;
}

export async function fetchRegisteredEvents(userId: string) {
  try {
    const res = await customFetch(`${API_BASE_URL}/events/registrations/${userId}`);
    if (res.ok) {
      const data = await res.json();
      await AsyncStorage.setItem(`@ecotrack_registered_events_${userId}`, JSON.stringify(data));
      return data;
    }
  } catch (e) {
    console.warn("Fetch registered events offline, using cache", e);
  }
  try {
    const cached = await AsyncStorage.getItem(`@ecotrack_registered_events_${userId}`);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {}
  return [];
}

export async function fetchScanHistory(userId: string) {
  try {
    const res = await customFetch(`${API_BASE_URL}/ai/scan-history?user_id=${userId}`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn("Fetch scan history offline", e);
  }
  return [];
}

export async function fetchFollowers(userId: string) {
  try {
    const res = await customFetch(`${API_BASE_URL}/social/followers/${userId}`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn("Fetch followers offline", e);
  }
  return [];
}

export async function fetchFollowing(userId: string) {
  try {
    const res = await customFetch(`${API_BASE_URL}/social/following/${userId}`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn("Fetch following offline", e);
  }
  return [];
}

export async function fetchSavedPosts() {
  try {
    const res = await customFetch(`${API_BASE_URL}/social/posts?saved_only=true`);
    if (res.ok) {
      const data = await res.json();
      return data.posts || [];
    }
  } catch (e) {
    console.warn("Fetch saved posts offline", e);
  }
  return [];
}

export async function fetchScanReport(scanId: string) {
  try {
    const res = await customFetch(`${API_BASE_URL}/ai/scan-report/${scanId}`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn("Fetch scan report offline", e);
  }
  return null;
}
