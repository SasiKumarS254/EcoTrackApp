/**
 * EcoTrack Unified Authentication & Session Configuration
 * Central source of truth for user identity across all website pages.
 */

const AUTH_CONFIG = {
  sessionKey: "@ecotrack_web_session",
  themeKey: "@ecotrack_theme",
  // Use 127.0.0.1 for CI stability
  apiBase: (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
           ? "http://127.0.0.1:5000/api"
           : "https://SasiKumarS254.github.io/EcoTrackApp/api"
};

/**
 * Restore session from localStorage.
 * Returns null if no valid session exists.
 */
function getSession() {
  try {
    const raw = localStorage.getItem(AUTH_CONFIG.sessionKey);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (session && session.id && session.token) {
      return session;
    }
  } catch (e) {
    console.error("Auth session parsing error:", e);
  }
  return null;
}

/**
 * Shared UI update for user-specific elements (Sidebar, Top Bar, Profile).
 * Ensures consistency across index.html and aiscanner.html.
 */
function syncUserInterface(user) {
  if (!user) return;

  const name = user.display_name || user.name || (user.email ? user.email.split('@')[0] : 'User');
  const initial = name.charAt(0).toUpperCase();

  // Unified element updates
  const elements = {
    "sidebarUserName": name,
    "sidebarUserEmail": user.email || "",
    "topUserName": name,
    "profileHeroName": name,
    "profileHeroBio": user.bio || "EcoTrack Enthusiast"
  };

  Object.entries(elements).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  });

  // Avatar updates
  const avatarElements = ["sidebarAvatar", "profileAvatarDisplay", "topUserAvatar"];
  avatarElements.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    if (user.avatar_url && user.avatar_url.startsWith("http")) {
      el.innerHTML = `<img src="${user.avatar_url}" alt="${name}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
    } else if (user.avatar && user.avatar.startsWith("http")) {
       el.innerHTML = `<img src="${user.avatar}" alt="${name}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
    } else {
      el.innerHTML = initial;
    }
  });

  // Global window variable for other scripts
  window.currentUser = user;
}

/**
 * Global logout handler
 */
function performLogout() {
  localStorage.removeItem(AUTH_CONFIG.sessionKey);
  window.location.href = 'index.html';
  window.location.reload();
}

// Auto-sync theme on load
(function() {
  const theme = localStorage.getItem(AUTH_CONFIG.themeKey) || "light";
  document.documentElement.setAttribute("data-theme", theme);
})();
// Global fetch interceptor to inject Authorization header across all pages
(function() {
  const originalFetch = window.fetch;
  window.fetch = async function(resource, options = {}) {
    const urlStr = typeof resource === 'string' ? resource : resource.url;
    // Only intercept EcoTrack API calls
    if (urlStr.includes('localhost:5000') || urlStr.startsWith('/api') || urlStr.includes('/api/')) {
      const sessionObj = getSession();
      if (sessionObj && sessionObj.token) {
        options.headers = options.headers || {};
        if (options.headers instanceof Headers) {
          options.headers.set('Authorization', `Bearer ${sessionObj.token}`);
        } else if (Array.isArray(options.headers)) {
          const existingIndex = options.headers.findIndex(h => h[0].toLowerCase() === 'authorization');
          if (existingIndex !== -1) {
            options.headers[existingIndex] = ['Authorization', `Bearer ${sessionObj.token}`];
          } else {
            options.headers.push(['Authorization', `Bearer ${sessionObj.token}`]);
          }
        } else {
          options.headers['Authorization'] = `Bearer ${sessionObj.token}`;
        }
      }
    }
    return originalFetch(resource, options);
  };
})();
