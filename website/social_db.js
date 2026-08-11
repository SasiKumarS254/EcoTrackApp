/**
 * EcoTrack Social Database & API Bridge v6.0
 * Connects frontend to backend SQLite database endpoints.
 * ─ ALL requests carry Authorization header (fixes 401 → stale-localStorage fallback bug)
 * ─ ZERO localStorage fallback for user data (prevents cross-user data leakage)
 * ─ Single source of truth: backend SQLite via authenticated API
 */

const EcoSocialDB = {
  apiBase: 'http://localhost:5000/api/social',

  // ── Helper: get auth token from session ──
  getAuthHeader() {
    try {
      const raw = localStorage.getItem(AUTH_CONFIG.sessionKey);
      if (raw) {
        const sess = JSON.parse(raw);
        if (sess && sess.token) {
          return {
            'Authorization': `Bearer ${sess.token}`,
            'Content-Type': 'application/json'
          };
        }
      }
    } catch (e) {}
    return { 'Content-Type': 'application/json' };
  },

  // ── POSTS ──
  async fetchPosts(params = {}) {
    try {
      const q = new URLSearchParams(params).toString();
      const res = await fetch(`${this.apiBase}/posts?${q}`, {
        headers: this.getAuthHeader()  // FIX: auth header was missing — caused 401 → stale localStorage fallback
      });
      if (res.ok) {
        const data = await res.json();
        return data.posts || [];
      }
      console.warn('fetchPosts: HTTP', res.status);
    } catch (e) {
      console.warn('fetchPosts API unavailable:', e.message);
    }
    return [];  // NO localStorage fallback — prevents cross-user data leakage
  },

  async fetchComments(postId) {
    try {
      const res = await fetch(`${this.apiBase}/posts/${postId}/comments`, {
        headers: this.getAuthHeader()
      });
      if (res.ok) {
        const data = await res.json();
        return data.comments || [];
      }
      console.warn('fetchComments: HTTP', res.status);
    } catch (e) {
      console.warn('fetchComments API failed:', e.message);
    }
    return [];
  },

  async createPost(postData) {
    try {
      const res = await fetch(`${this.apiBase}/posts`, {
        method: 'POST',
        headers: this.getAuthHeader(),
        body: JSON.stringify(postData)
      });
      if (res.ok) return await res.json();
      const err = await res.json().catch(() => ({}));
      console.warn('createPost API failed:', err.error || res.status);
    } catch (e) {
      console.warn('createPost API failed:', e.message);
    }
    return null;  // Return null on failure — caller handles empty state
  },

  async toggleLike(postId) {
    try {
      const res = await fetch(`${this.apiBase}/posts/${postId}/like`, {
        method: 'POST',
        headers: this.getAuthHeader()
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('toggleLike API failed:', e.message);
    }
    return null;
  },

  async toggleBookmark(postId) {
    try {
      const res = await fetch(`${this.apiBase}/posts/${postId}/bookmark`, {
        method: 'POST',
        headers: this.getAuthHeader()
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('toggleBookmark failed:', e.message);
    }
    return null;
  },

  async addComment(postId, text) {
    try {
      const res = await fetch(`${this.apiBase}/posts/${postId}/comments`, {
        method: 'POST',
        headers: this.getAuthHeader(),
        body: JSON.stringify({ text })
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('addComment API failed:', e.message);
    }
    return null;
  },

  async addReply(commentId, postId, text) {
    try {
      const res = await fetch(`${this.apiBase}/comments/${commentId}/replies`, {
        method: 'POST',
        headers: this.getAuthHeader(),
        body: JSON.stringify({ post_id: postId, text })
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('addReply API failed:', e.message);
    }
    return null;
  },

  async toggleFollow(followerId, followingId) {
    try {
      const res = await fetch(`${this.apiBase}/follow/toggle`, {
        method: 'POST',
        headers: this.getAuthHeader(),
        body: JSON.stringify({ following_id: followingId })
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('toggleFollow failed:', e.message);
    }
    return null;
  },

  async manageFollowAction(action, actorId, targetId) {
    try {
      const res = await fetch(`${this.apiBase}/follow/manage`, {
        method: 'POST',
        headers: this.getAuthHeader(),
        body: JSON.stringify({ action, actor_id: actorId, target_id: targetId })
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('manageFollowAction failed:', e.message);
    }
    return null;
  },

  async fetchFollowers(userId) {
    try {
      const res = await fetch(`${this.apiBase}/followers/${userId}`, {
        headers: this.getAuthHeader()
      });
      if (res.ok) {
        const data = await res.json();
        return data.followers || [];
      }
    } catch (e) {
      console.warn('fetchFollowers API failed:', e.message);
    }
    return [];
  },

  async fetchFollowing(userId) {
    try {
      const res = await fetch(`${this.apiBase}/following/${userId}`, {
        headers: this.getAuthHeader()
      });
      if (res.ok) {
        const data = await res.json();
        return data.following || [];
      }
    } catch (e) {
      console.warn('fetchFollowing API failed:', e.message);
    }
    return [];
  },

  async fetchRecommendations() {
    try {
      const res = await fetch(`${this.apiBase}/recommendations`, {
        headers: this.getAuthHeader()
      });
      if (res.ok) {
        const data = await res.json();
        return data.users || [];
      }
    } catch (e) {
      console.warn('fetchRecommendations failed:', e.message);
    }
    return [];
  },

  // ── PROFILES ──
  async fetchProfile(userOrEcoId) {
    try {
      const res = await fetch(`${this.apiBase}/profile/${userOrEcoId}`, {
        headers: this.getAuthHeader()
      });
      if (res.ok) return await res.json();
      console.warn('fetchProfile: HTTP', res.status, 'for', userOrEcoId);
    } catch (e) {
      console.warn('fetchProfile API failed:', e.message);
    }
    return null;  // NO localStorage fallback — prevents showing wrong-user data
  },

  async fetchMyProfile() {
    try {
      const res = await fetch(`${this.apiBase}/me`, {
        headers: this.getAuthHeader()
      });
      if (res.ok) return await res.json();
      console.warn('fetchMyProfile: HTTP', res.status);
    } catch (e) {
      console.warn('fetchMyProfile API failed:', e.message);
    }
    return null;
  },

  // Refresh authenticated user's session data from the backend DB
  async refreshMySession() {
    try {
      const res = await fetch(`${this.apiBase}/me/refresh`, {
        headers: this.getAuthHeader()
      });
      if (res.ok) {
        const freshUser = await res.json();
        // Atomically update window.currentUser and localStorage session
        if (freshUser && freshUser.id) {
          const existingSession = window.currentUser || {};
          window.currentUser = {
            ...existingSession,
            ...freshUser,
            token: existingSession.token  // preserve the auth token
          };
          localStorage.setItem(AUTH_CONFIG.sessionKey, JSON.stringify(window.currentUser));
          return window.currentUser;
        }
      }
    } catch (e) {
      console.warn('refreshMySession API failed:', e.message);
    }
    return window.currentUser || null;
  },

  async updateProfile(profileData) {
    try {
      const res = await fetch(`${this.apiBase}/profile`, {
        method: 'PUT',
        headers: this.getAuthHeader(),
        body: JSON.stringify(profileData)
      });
      if (res.ok) {
        const result = await res.json();
        return result;
      }
      const err = await res.json().catch(() => ({}));
      console.warn('updateProfile API failed:', err.error || res.status);
    } catch (e) {
      console.warn('updateProfile API failed:', e.message);
    }
    return null;
  },

  // Upload avatar to backend DB — persists as avatar_url in Profiles table
  async uploadAvatar(avatarDataUrl) {
    try {
      const res = await fetch(`${this.apiBase}/profile/avatar`, {
        method: 'POST',
        headers: this.getAuthHeader(),
        body: JSON.stringify({ avatar_url: avatarDataUrl })
      });
      if (res.ok) {
        const result = await res.json();
        return result.avatar_url;
      }
    } catch (e) {
      console.warn('uploadAvatar API failed:', e.message);
    }
    return null;
  },

  // ── PETS ──
  async addPet(petData) {
    try {
      const res = await fetch(`${this.apiBase}/pets`, {
        method: 'POST',
        headers: this.getAuthHeader(),
        body: JSON.stringify(petData)  // owner_id comes from auth token server-side
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('addPet API failed:', e.message);
    }
    return null;
  },

  async removePet(petId) {
    try {
      const res = await fetch(`${this.apiBase}/pets/${petId}`, {
        method: 'DELETE',
        headers: this.getAuthHeader()
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('removePet API failed:', e.message);
    }
    return null;
  },

  async deletePost(postId) {
    try {
      const res = await fetch(`${this.apiBase}/posts/${postId}`, {
        method: 'DELETE',
        headers: this.getAuthHeader()
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('deletePost API failed:', e.message);
    }
    return null;
  },

  // ── PORTFOLIO ──
  async fetchPortfolio(userId) {
    try {
      const res = await fetch(`${this.apiBase}/portfolio/${userId}`, {
        headers: this.getAuthHeader()
      });
      if (res.ok) {
        const data = await res.json();
        return data.items || [];
      }
    } catch (e) {
      console.warn('fetchPortfolio API failed:', e.message);
    }
    return [];
  },

  async addPortfolioItem(itemData) {
    try {
      const res = await fetch(`${this.apiBase}/portfolio`, {
        method: 'POST',
        headers: this.getAuthHeader(),
        body: JSON.stringify(itemData)
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('addPortfolioItem API failed:', e.message);
    }
    return null;
  },

  // ── MESSAGING ──
  async fetchConversations() {
    try {
      const res = await fetch(`${this.apiBase}/messages/conversations`, {
        headers: this.getAuthHeader()
      });
      if (res.ok) {
        const data = await res.json();
        return data.conversations || [];
      }
    } catch (e) {
      console.warn('fetchConversations API failed:', e.message);
    }
    return [];
  },

  async fetchMessages(partnerId) {
    try {
      const res = await fetch(`${this.apiBase}/messages/${partnerId}`, {
        headers: this.getAuthHeader()
      });
      if (res.ok) {
        const data = await res.json();
        return data.messages || [];
      }
    } catch (e) {
      console.warn('fetchMessages API failed:', e.message);
    }
    return [];
  },

  async sendMessage(receiverId, text) {
    try {
      const res = await fetch(`${this.apiBase}/messages`, {
        method: 'POST',
        headers: this.getAuthHeader(),
        body: JSON.stringify({ receiver_id: receiverId, text })
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('sendMessage API failed:', e.message);
    }
    return null;
  },

  // ── NOTIFICATIONS ──
  async fetchNotifications() {
    try {
      const res = await fetch('http://localhost:5000/api/social/notifications', {
        headers: this.getAuthHeader()
      });
      if (res.ok) {
        const data = await res.json();
        return data.notifications || [];
      }
    } catch (e) {
      console.warn('fetchNotifications API failed:', e.message);
    }
    return [];
  },

  // ── SESSION MANAGEMENT ──
  /**
   * Called on logout — clears ONLY the session token.
   * Does NOT clear cached posts/pets/etc from other-user sessions.
   * Each user's data is always fetched fresh from the backend.
   */
  clearSession() {
    window.currentUser = null;
    localStorage.removeItem(AUTH_CONFIG.sessionKey);
  }
};

window.EcoSocialDB = EcoSocialDB;
