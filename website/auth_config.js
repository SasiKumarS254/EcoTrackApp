/**
 * EcoTrack Unified Authentication & Session Configuration
 * Central source of truth for user identity across all website pages.
 */

const AUTH_CONFIG = {
  sessionKey: "@ecotrack_web_session",
  themeKey: "@ecotrack_theme",
  // Resilient API base detection
  apiBase: (function() {
    try {
      const h = window.location.hostname || '';
      const p = window.location.port || '';
      if (h === '127.0.0.1' || h === 'localhost' || h === '' || p === '5000' || p === '3000' || p === '8080' || h.startsWith('192.168.') || h.startsWith('10.')) {
        return "http://127.0.0.1:5000/api";
      }
    } catch (e) {}
    return "https://SasiKumarS254.github.io/EcoTrackApp/api";
  })()
};

/**
 * Restore session from localStorage safely.
 * Returns null if no valid session exists.
 */
function getSession() {
  try {
    const raw = localStorage.getItem(AUTH_CONFIG.sessionKey);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (session) {
      const user = session.user || session;
      const token = session.token || (session.session && session.session.token) || session.jwt;
      const id = session.id || user.id || user.user_id || user.ecotrack_id;
      if (id || token) {
        return {
          ...user,
          ...session,
          id: id || user.id,
          token: token
        };
      }
    }
  } catch (e) {
    console.warn("Auth session parsing warning:", e.message);
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

  // Toggle Admin Center in navigation based on role
  const adminNav = document.getElementById("adminNavSection");
  if (adminNav) {
    adminNav.style.display = (user && (user.role === 'admin' || user.role === 'superadmin' || user.role === 'staff')) ? "block" : "none";
  }

  window.currentUser = user;
}

/**
 * Global logout handler
 */
function performLogout() {
  try {
    localStorage.removeItem(AUTH_CONFIG.sessionKey);
  } catch (e) {}
  window.location.href = 'index.html';
  window.location.reload();
}

// Auto-sync theme on load
(function() {
  try {
    const theme = localStorage.getItem(AUTH_CONFIG.themeKey) || "light";
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}
})();

// Global fetch interceptor to inject Authorization header across all pages safely
(function() {
  if (window.__ecotrackFetchInterceptorInstalled) return;
  window.__ecotrackFetchInterceptorInstalled = true;

  const originalFetch = window.fetch;
  if (typeof originalFetch !== 'function') return;

  window.fetch = function(input, init) {
    try {
      let url = '';
      if (typeof input === 'string') {
        url = input;
      } else if (input && typeof input.url === 'string') {
        url = input.url;
      } else if (input && typeof input.href === 'string') {
        url = input.href;
      } else if (input && typeof input.toString === 'function') {
        url = input.toString();
      }

      const isEcoTrackApi = url && (
        url.includes(':5000/api') ||
        url.includes('127.0.0.1:5000') ||
        url.includes('localhost:5000') ||
        url.startsWith('/api') ||
        url.includes('/api/') ||
        (typeof AUTH_CONFIG !== 'undefined' && AUTH_CONFIG.apiBase && url.includes(AUTH_CONFIG.apiBase))
      );

      if (isEcoTrackApi) {
        const session = (typeof getSession === 'function' ? getSession() : null);
        const token = session && session.token;
        if (token) {
          if (typeof Request !== 'undefined' && input instanceof Request) {
            try {
              input.headers.set('Authorization', `Bearer ${token}`);
            } catch (e) {
              init = init ? { ...init } : {};
              init.headers = init.headers || {};
              if (typeof Headers !== 'undefined' && init.headers instanceof Headers) {
                if (!init.headers.has('Authorization')) init.headers.set('Authorization', `Bearer ${token}`);
              } else if (Array.isArray(init.headers)) {
                if (!init.headers.some(h => h[0].toLowerCase() === 'authorization')) {
                  init.headers.push(['Authorization', `Bearer ${token}`]);
                }
              } else {
                if (!init.headers['Authorization'] && !init.headers['authorization']) {
                  init.headers['Authorization'] = `Bearer ${token}`;
                }
              }
            }
          } else {
            init = init ? { ...init } : {};
            if (typeof Headers !== 'undefined' && init.headers instanceof Headers) {
              if (!init.headers.has('Authorization')) init.headers.set('Authorization', `Bearer ${token}`);
            } else if (Array.isArray(init.headers)) {
              if (!init.headers.some(h => h[0].toLowerCase() === 'authorization')) {
                init.headers.push(['Authorization', `Bearer ${token}`]);
              }
            } else {
              init.headers = { ...(init.headers || {}) };
              if (!init.headers['Authorization'] && !init.headers['authorization']) {
                init.headers['Authorization'] = `Bearer ${token}`;
              }
            }
          }
        }
      }
    } catch (interceptorErr) {
      console.warn('[EcoTrack/Auth] Fetch interceptor non-fatal notice:', interceptorErr.message);
    }

    if (init !== undefined) {
      return originalFetch.call(window, input, init);
    }
    return originalFetch.call(window, input);
  };
})();

// Attach globally for universal script access
window.AUTH_CONFIG = AUTH_CONFIG;
window.getSession = getSession;
window.syncUserInterface = syncUserInterface;
window.performLogout = performLogout;
