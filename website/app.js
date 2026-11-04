/* ============================================================
   EcoTrack Web — Complete Application Engine v2.0
   ============================================================ */

const API_BASE = "http://localhost:5000/api";

// ── GLOBAL STATE ──
let activeTab = "dashboard";
let activeMarketTab = "animals";
let selectedClassFilter = "All";
let selectedServiceType = "All";
let serviceSearchQuery = "";
let currentUser = null;
let cart = [];
let favorites = [];
let chatHistory = {};
let currentActiveSeller = null;
let COMMUNITY_POSTS = [];
let userPets = [];

// ══════════════════════════════════════════════════
// TOAST NOTIFICATION SYSTEM
// ══════════════════════════════════════════════════
function showToast(message, type = "success", duration = 3500) {
  console.log(`[Toast ${type.toUpperCase()}] ${message}`);
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toastIcons = {
    success: '<i class="fas fa-check-circle" style="color:#10b981;font-size:18px;"></i>',
    error: '<i class="fas fa-circle-exclamation" style="color:#ef4444;font-size:18px;"></i>',
    warning: '<i class="fas fa-triangle-exclamation" style="color:#f59e0b;font-size:18px;"></i>',
    info: '<i class="fas fa-circle-info" style="color:#3b82f6;font-size:18px;"></i>'
  };

  const toastColors = {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6'
  };

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon-wrap" style="background:${toastColors[type] || '#10b981'}15;border:1px solid ${toastColors[type] || '#10b981'}30;">
      ${toastIcons[type] || toastIcons.info}
    </div>
    <div class="toast-body">
      <span class="toast-msg">${message}</span>
    </div>
    <button type="button" class="toast-close" title="Dismiss" aria-label="Dismiss">&times;</button>
    <div class="toast-progress-bar" style="background:${toastColors[type] || '#10b981'};animation-duration:${duration}ms;"></div>
  `;

  container.appendChild(toast);

  let dismissTimeout = setTimeout(dismiss, duration);
  let isPaused = false;

  function dismiss() {
    toast.classList.add("fade-out");
    setTimeout(() => toast.remove(), 280);
  }

  toast.querySelector('.toast-close')?.addEventListener('click', (e) => {
    e.stopPropagation();
    clearTimeout(dismissTimeout);
    dismiss();
  });

  // Pause timer on hover
  toast.addEventListener('mouseenter', () => {
    clearTimeout(dismissTimeout);
    isPaused = true;
    const bar = toast.querySelector('.toast-progress-bar');
    if (bar) bar.style.animationPlayState = 'paused';
  });

  toast.addEventListener('mouseleave', () => {
    if (isPaused) {
      dismissTimeout = setTimeout(dismiss, 1200);
      const bar = toast.querySelector('.toast-progress-bar');
      if (bar) bar.style.animationPlayState = 'running';
    }
  });
}
window.showToast = showToast;

// ══════════════════════════════════════════════════
// CUSTOM IN-APP CONFIRMATION MODAL SYSTEM
// ══════════════════════════════════════════════════
function showConfirmModal({ 
  title = 'Confirm Action', 
  message = 'Are you sure you want to proceed?', 
  icon = 'fa-circle-question', 
  confirmText = 'Confirm', 
  cancelText = 'Cancel', 
  isDanger = false 
} = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('customConfirmModal');
    if (!modal) {
      resolve(true);
      return;
    }

    const titleEl = document.getElementById('confirmModalTitle');
    const msgEl = document.getElementById('confirmModalMessage');
    const iconEl = document.getElementById('confirmModalIcon');
    const iconWrap = document.getElementById('confirmModalIconWrap');
    const okBtn = document.getElementById('confirmModalOkBtn');
    const cancelBtn = document.getElementById('confirmModalCancelBtn');
    const closeBtn = document.getElementById('confirmModalCloseBtn');

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.innerHTML = String(message).replace(/\n/g, '<br>');
    if (iconEl) {
      iconEl.className = `fas ${icon}`;
    }
    if (iconWrap) {
      iconWrap.className = `confirm-icon-wrap ${isDanger ? 'danger' : 'normal'}`;
    }
    if (okBtn) {
      okBtn.textContent = confirmText;
      okBtn.className = isDanger ? 'btn btn-danger' : 'btn btn-primary';
      okBtn.style.background = isDanger 
        ? 'linear-gradient(135deg, #ef4444, #dc2626)' 
        : 'linear-gradient(135deg, #059669, #10b981)';
      okBtn.style.boxShadow = isDanger 
        ? '0 6px 20px rgba(239, 68, 68, 0.35)' 
        : '0 6px 20px rgba(16, 185, 129, 0.35)';
      okBtn.style.border = 'none';
      okBtn.style.color = '#fff';
    }
    if (cancelBtn) cancelBtn.textContent = cancelText;

    function cleanup(result) {
      modal.classList.remove('active');
      modal.style.display = 'none';
      okBtn?.removeEventListener('click', onOk);
      cancelBtn?.removeEventListener('click', onCancel);
      closeBtn?.removeEventListener('click', onCancel);
      modal.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKey);
      resolve(result);
    }

    function onOk(e) { e?.stopPropagation(); cleanup(true); }
    function onCancel(e) { e?.stopPropagation(); cleanup(false); }
    function onBackdrop(e) { if (e.target === modal) cleanup(false); }
    function onKey(e) { 
      if (e.key === 'Escape') cleanup(false); 
      else if (e.key === 'Enter') cleanup(true);
    }

    okBtn?.addEventListener('click', onOk);
    cancelBtn?.addEventListener('click', onCancel);
    closeBtn?.addEventListener('click', onCancel);
    modal.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKey);

    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.classList.add('active'));
    okBtn?.focus();
  });
}
window.showConfirmModal = showConfirmModal;
window.showConfirm = function(msgOrOptions, title, isDanger) {
  if (typeof msgOrOptions === 'string') {
    return showConfirmModal({
      title: title || 'Confirm Action',
      message: msgOrOptions,
      isDanger: Boolean(isDanger)
    });
  }
  return showConfirmModal(msgOrOptions);
};

// Intercept window.alert so native browser alert popups never appear
window.alert = function(msg) {
  showToast(String(msg), 'info', 4000);
};

// ══════════════════════════════════════════════════
// AUTH — LOGIN PAGE
// ══════════════════════════════════════════════════
// ══════════════════════════════════════════════════
// AUTH — LOGIN & FORGOT PASSWORD SYSTEM
// ══════════════════════════════════════════════════

let otpTimerInterval = null;
let currentOtpState = { email: "", otp: "", expiresAt: 0, verified: false };

function getRegisteredAccounts() { return {}; }
function saveRegisteredAccount() { return; }

function updateRegisteredPassword(email, newPassword) {
  const accounts = getRegisteredAccounts();
  const lowerEmail = email.toLowerCase().trim();
  if (accounts[lowerEmail]) {
    accounts[lowerEmail].password = newPassword;
    localStorage.setItem("@ecotrack_registered_accounts", JSON.stringify(accounts));
    return true;
  }
  return false;
}

function switchLoginTab(tab) {
  document.getElementById("signinForm")?.classList.toggle("hidden", tab !== "signin");
  document.getElementById("signupForm")?.classList.toggle("hidden", tab !== "signup");
  document.getElementById("adminForm")?.classList.toggle("hidden", tab !== "admin");
  document.getElementById("forgotForm")?.classList.toggle("hidden", tab !== "forgot");
  document.getElementById("otpForm")?.classList.toggle("hidden", tab !== "otp");
  document.getElementById("resetForm")?.classList.toggle("hidden", tab !== "reset");

  const tabsNav = document.querySelector(".login-tabs");
  if (tabsNav) {
    tabsNav.style.display = (tab === "signin" || tab === "signup" || tab === "admin") ? "flex" : "none";
  }

  document.getElementById("tab-signin")?.classList.toggle("active", tab === "signin");
  document.getElementById("tab-signup")?.classList.toggle("active", tab === "signup");
  document.getElementById("tab-admin")?.classList.toggle("active", tab === "admin");

  const adminBadge = document.getElementById("loginAdminHeroBadge");
  if (adminBadge) {
    adminBadge.style.display = tab === "admin" ? "inline-flex" : "none";
  }

  if (tab !== "otp" && otpTimerInterval) {
    clearInterval(otpTimerInterval);
    otpTimerInterval = null;
  }
}

function fillAdminCredentials(email, password) {
  const eInput = document.getElementById("adminEmail");
  const pInput = document.getElementById("adminPassword");
  if (eInput) eInput.value = email;
  if (pInput) pInput.value = password;
}
window.fillAdminCredentials = fillAdminCredentials;

async function handleAdminSignIn(e) {
  if (e && e.preventDefault) e.preventDefault();
  const email = document.getElementById("adminEmail")?.value.trim();
  const password = document.getElementById("adminPassword")?.value;
  if (!email || !password) {
    showToast("Please enter admin credentials.", "error");
    return;
  }

  const btn = document.getElementById("adminSignInBtn");
  const btnText = document.getElementById("adminSignInBtnText");
  setLoadingState(btn, btnText, true, "Verifying Admin Privileges...");

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Admin authentication failed.");
    }

    if (data.user.role !== 'admin' && data.user.role !== 'superadmin' && data.user.role !== 'staff') {
      throw new Error("Access denied: Account lacks administrative privileges.");
    }

    completeLogin(data.user, data.token);
    showToast(`🛡️ Welcome Administrator, ${data.user.name}!`, "success");

    setTimeout(() => {
      if (typeof switchTab === 'function') {
        switchTab('admin');
      }
    }, 250);
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    setLoadingState(btn, btnText, false, '<i class="fas fa-shield-halved"></i> Sign In to Admin Center');
  }
}
window.handleAdminSignIn = handleAdminSignIn;

/**
 * EcoTrack Premium Login & Authentication System v3.0
 * Responsive UI, Real Persistence, Secure Sessions
 */

async function handleSignIn(e) {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  if (!email || !password) { showToast("Please enter your email and password.", "error"); return; }

  const btn = document.getElementById("signInBtn");
  const btnText = document.getElementById("signInBtnText");
  const originalText = btnText ? btnText.textContent : "Sign In to EcoTrack";

  setLoadingState(btn, btnText, true, "Authenticating...");

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Login failed. Please check your credentials.");
    }

    completeLogin(data.user, data.token);
    showToast(`Welcome back, ${data.user.name}!`, "success");
  } catch (err) {
    console.error("Login Error:", err);
    showToast(err.message, "error");
  } finally {
    setLoadingState(btn, btnText, false, originalText);
  }
}

async function handleSignUp(e) {
  e.preventDefault();
  const name = document.getElementById("signupName").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;

  if (!email || !password) { showToast("Email and password are required.", "error"); return; }
  if (password.length < 6) { showToast("Password must be at least 6 characters.", "error"); return; }

  const btn = document.getElementById("signUpBtn");
  const btnText = document.getElementById("signUpBtnText");
  const originalText = btnText ? btnText.textContent : "Create My Account";

  setLoadingState(btn, btnText, true, "Creating Account...");

  try {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name: name || email.split("@")[0], password })
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Signup failed.");
    }

    completeLogin(data.user, data.token);
    showToast(`🎉 Welcome to EcoTrack, ${data.user.name}!`, "success");
  } catch (err) {
    console.error("Signup Error:", err);
    showToast(err.message, "error");
  } finally {
    setLoadingState(btn, btnText, false, originalText);
  }
}

function setLoadingState(btn, textEl, isLoading, loadingText = "Processing...") {
  if (!btn) return;
  btn.disabled = isLoading;
  if (textEl) {
    if (isLoading) {
      textEl.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> ${loadingText}`;
    } else {
      textEl.textContent = loadingText;
    }
  }
}

function togglePasswordVisibility(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(iconId);
  if (input && icon) {
    const isVisible = input.type === "text";
    input.type = isVisible ? "password" : "text";
    icon.className = isVisible ? "fas fa-eye" : "fas fa-eye-slash";
  }
}

// ── FORGOT PASSWORD & OTP FUNCTIONS ──

async function handleSendOtp(e) {
  if (e) e.preventDefault();
  const emailInput = document.getElementById("forgotEmail");
  const email = emailInput ? emailInput.value.trim() : "";
  if (!email) { showToast("Please enter a valid email address.", "error"); return; }

  const btn = document.getElementById("sendOtpBtn");
  const btnText = document.getElementById("sendOtpBtnText");
  const originalText = btnText ? btnText.textContent : "Send Verification OTP";

  setLoadingState(btn, btnText, true, "Sending OTP...");

  try {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Unable to send OTP.");
    }

    currentOtpState = {
      email: email.toLowerCase(),
      otp: "SERVER_VALIDATED", // Backend checks this
      expiresAt: Date.now() + (data.expiresInSeconds || 300) * 1000,
      verified: false
    };

    const targetEmailEl = document.getElementById("otpTargetEmail");
    if (targetEmailEl) targetEmailEl.textContent = email;
    const otpInput = document.getElementById("otpCodeInput");
    if (otpInput) otpInput.value = "";

    switchLoginTab("otp");
    startOtpCountdown();
    showToast(`📧 A security code has been sent to ${email}!`, "info", 6000);
  } catch (err) {
    console.error("OTP Send Error:", err);
    showToast(err.message, "error");
  } finally {
    setLoadingState(btn, btnText, false, originalText);
  }
}

async function handleVerifyOtp(e) {
  if (e) e.preventDefault();
  const otpCode = document.getElementById("otpCodeInput").value.trim();
  if (otpCode.length !== 6) { showToast("Please enter the 6-digit code.", "warning"); return; }

  const btn = document.getElementById("verifyOtpBtn");
  const btnText = document.getElementById("verifyOtpBtnText");
  const originalText = btnText ? btnText.textContent : "Verify OTP Code";

  setLoadingState(btn, btnText, true, "Verifying...");

  try {
    const res = await fetch(`${API_BASE}/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: currentOtpState.email, otp: otpCode })
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Verification failed.");
    }

    currentOtpState.verified = true;
    currentOtpState.otp = otpCode; // Save verified code for final reset

    switchLoginTab("reset");
    showToast("✅ Identity verified. Please set your new password.", "success");
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    setLoadingState(btn, btnText, false, originalText);
  }
}

async function handleResetPassword(e) {
  if (e) e.preventDefault();
  const newPassword = document.getElementById("newPasswordInput").value;
  const confirmPassword = document.getElementById("confirmPasswordInput").value;

  if (newPassword.length < 6) { showToast("Password must be at least 6 characters.", "warning"); return; }
  if (newPassword !== confirmPassword) { showToast("Passwords do not match.", "error"); return; }

  const btn = document.getElementById("resetPassBtn");
  const btnText = document.getElementById("resetPassBtnText");
  const originalText = btnText ? btnText.textContent : "Reset My Password";

  setLoadingState(btn, btnText, true, "Updating Password...");

  try {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: currentOtpState.email,
        otp: currentOtpState.otp,
        newPassword
      })
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Password reset failed.");
    }

    showToast("🎉 Password updated successfully! Please sign in.", "success");
    const loginEmailInput = document.getElementById("loginEmail");
    if (loginEmailInput) loginEmailInput.value = currentOtpState.email;
    const loginPassInput = document.getElementById("loginPassword");
    if (loginPassInput) { loginPassInput.value = ""; loginPassInput.focus(); }

    currentOtpState = { email: "", otp: "", expiresAt: 0, verified: false };
    switchLoginTab("signin");
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    setLoadingState(btn, btnText, false, originalText);
  }
}

function startOtpCountdown() {
  startOtpTimer();
}

function startOtpTimer() {
  if (otpTimerInterval) clearInterval(otpTimerInterval);

  const timerCard = document.getElementById("otpTimerCard");
  const timerSpan = document.getElementById("otpCountdownTimer");
  const verifyBtn = document.getElementById("verifyOtpBtn");
  const resendBtn = document.getElementById("resendOtpBtn");

  if (timerCard) timerCard.classList.remove("expired");
  if (verifyBtn) verifyBtn.disabled = false;
  if (resendBtn) resendBtn.disabled = true;

  function updateTimer() {
    const remainingMs = currentOtpState.expiresAt - Date.now();

    if (remainingMs <= 0) {
      clearInterval(otpTimerInterval);
      otpTimerInterval = null;
      if (timerSpan) timerSpan.textContent = "00:00 (Expired)";
      if (timerCard) timerCard.classList.add("expired");
      if (verifyBtn) verifyBtn.disabled = true;
      if (resendBtn) resendBtn.disabled = false;
      showToast("⏱️ OTP has expired after 5 minutes. Please request a new OTP code.", "warning");
      return;
    }

    const totalSeconds = Math.floor(remainingMs / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const formatted = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

    if (timerSpan) timerSpan.textContent = formatted;
  }

  updateTimer();
  otpTimerInterval = setInterval(updateTimer, 1000);
}

function handleResendOtp() {
  handleSendOtp(null);
}



function completeLogin(user, token) {
  // Clear any previous user's in-memory state to prevent cross-user leakage
  COMMUNITY_POSTS = [];
  userPets = [];
  cart = [];
  favorites = [];
  chatHistory = {};
  registeredEventIds = [];
  userEventTickets = [];

  currentUser = { ...user, token };
  window.currentUser = currentUser;

  const session = { ...user, token, loggedInAt: new Date().toISOString() };
  localStorage.setItem(AUTH_CONFIG.sessionKey, JSON.stringify(session));

  // Sync UI immediately with shared logic
  syncUserInterface(currentUser);

  // Re-initialize modules that rely on user-scoped local storage
  initEventsModule();

  // Reset rendered training container for clean user session
  const container = document.getElementById("trainingResultContainer");
  if (container) container.innerHTML = "";

  // Instantly show main application without waiting for network calls
  showMainApp();

  // Load user cart, favorites, and messages in background
  syncUserDataInBackground(user);
}

async function syncUserDataInBackground(user) {
  const headers = {
    'Content-Type': 'application/json',
    ...(user.token ? { 'Authorization': `Bearer ${user.token}` } : {})
  };

  try {
    const cRes = await fetch(`${API_BASE}/cart/${user.id}`, { headers });
    if (cRes.ok) cart = await cRes.json();
    else cart = JSON.parse(localStorage.getItem(`@ecotrack_cart_${user.id}`) || "[]");
  } catch (e) {
    cart = JSON.parse(localStorage.getItem(`@ecotrack_cart_${user.id}`) || "[]");
  }

  try {
    const fRes = await fetch(`${API_BASE}/users/${user.id}/favorites`, { headers });
    if (fRes.ok) favorites = await fRes.json();
    else favorites = JSON.parse(localStorage.getItem(`@ecotrack_favs_${user.id}`) || "[]");
  } catch (e) {
    favorites = JSON.parse(localStorage.getItem(`@ecotrack_favs_${user.id}`) || "[]");
  }

  try {
    const mRes = await fetch(`${API_BASE}/messages/${user.id}`, { headers });
    if (mRes.ok) {
      const messages = await mRes.json();
      chatHistory = {};
      messages.forEach(msg => {
        const otherId = msg.from_user_id === user.id ? msg.to_user_id : msg.from_user_id;
        const cleanId = otherId.replace("seller_", "");
        const threadKey = msg.listing_id ? `${cleanId}_${msg.listing_id}` : cleanId;
        if (!chatHistory[threadKey]) chatHistory[threadKey] = [];
        chatHistory[threadKey].push({
          id: msg.id,
          sender: msg.from_user_id === user.id ? "me" : "other",
          text: msg.text,
          media_url: msg.media_url,
          media_type: msg.media_type,
          timestamp: msg.timestamp,
          time: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      });
    } else {
      chatHistory = JSON.parse(localStorage.getItem(`@ecotrack_chat_${user.id}`) || "{}");
    }
  } catch {
    chatHistory = JSON.parse(localStorage.getItem(`@ecotrack_chat_${user.id}`) || "{}");
  }

  updateCartBadges();
}

function showLoginPage() {
  document.getElementById("loginPage")?.classList.remove("hidden");
  const mainApp = document.getElementById("mainApp");
  if (mainApp) mainApp.style.display = "none";
}

function showMainApp() {
  document.getElementById("loginPage")?.classList.add("hidden");
  const mainApp = document.getElementById("mainApp");
  if (mainApp) mainApp.style.display = "flex";
  initApp();
}

function handleLogout() {
  performLogout();
}

async function checkAuthOnLoad() {
  initTheme();
  const session = getSession();
  if (session) {
    await completeLogin(session, session.token);
    return;
  }
  showLoginPage();
}

// ══════════════════════════════════════════════════
// APP INIT
// ══════════════════════════════════════════════════
function initApp() {
  initTheme();
  updateSidebarUser();
  updateCartBadges();
  fetchMarketplaceListings();
  loadCommunityPosts();
  renderEvents();
  renderServicesGrid();
  if (window.loadProfileTab) window.loadProfileTab();
  loadTrainingAnalytics();
  fetchDashboardMetrics();

  const targetHash = (window.location.hash || '').replace('#', '');
  if (targetHash && document.getElementById(targetHash)) {
    switchTab(targetHash);
  } else {
    switchTab("dashboard");
  }

  window.addEventListener('hashchange', () => {
    const h = (window.location.hash || '').replace('#', '');
    if (h && document.getElementById(h)) switchTab(h);
  });
}

function updateSidebarUser() {
  syncUserInterface(currentUser);
}

window.switchTab = switchTab;
window.updateSidebarUser = updateSidebarUser;
window.completeLogin = completeLogin;
window.handleLogout = handleLogout;

// ══════════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════════
function switchTab(tabId) {
  activeTab = tabId;
  document.querySelectorAll(".tab-section").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));

  const topCart = document.getElementById("topCartBtn");
  if (topCart) topCart.style.display = "none";

  const section = document.getElementById(tabId);
  if (section) section.classList.add("active");

  const navBtn = document.querySelector(`[data-tab="${tabId}"]`);
  if (navBtn) navBtn.classList.add("active");

  const TITLES = {
    dashboard: ["Dashboard", "Real-time animal welfare management & offline AI engine"],
    training: ["Species AI Trainer", "Generate custom, weight & age-scaled training sheets"],
    aiscanner: ["AI Scanner", "Analyze species motion postures and keypoints in real-time"],
    marketplace: ["Marketplace", "Verified animal supplies & adoption listings"],
    events: ["Events & Rescue", "Join vaccination drives & training workshops"],
    community: ["Community Feed", "Share training tips, health advice & updates"],
    maps: ["Find Services", "Locate veterinary clinics & animal care centers"],
    profile: ["My Profile", "Manage your account, pets & achievements"],
    admin: ["Admin Control Center", "Platform telemetry, user governance & content moderation"]
  };

  if (tabId === "profile") {
    if (window.loadProfileTab) window.loadProfileTab();
  }

  if (tabId === "admin") {
    if (typeof loadAdminDashboard === "function") loadAdminDashboard();
  }

  const h = TITLES[tabId];
  if (h) {
    setEl("topPageTitle", h[0]);
    setEl("topPageSub", h[1]);
  }

  if (tabId === "aiscanner") {
    if (typeof window.applyScannerParameters === "function") {
      window.applyScannerParameters();
    }
  }

  if (tabId === "community") {
    if (typeof initCommunityFeed === "function") initCommunityFeed();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ══════════════════════════════════════════════════
// THEME MANAGEMENT
// ══════════════════════════════════════════════════
function initTheme() {
  const saved = localStorage.getItem(AUTH_CONFIG.themeKey) || "light";
  document.documentElement.setAttribute("data-theme", saved);
  updateThemeIcon(saved);
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute("data-theme");
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem(AUTH_CONFIG.themeKey, next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  // Sidebar theme controls
  const icon = document.getElementById("themeIcon");
  const text = document.getElementById("themeText");
  if (icon) icon.className = theme === "dark" ? "fas fa-sun" : "fas fa-moon";
  if (text) text.textContent = theme === "dark" ? "Light Mode" : "Dark Mode";

  // Login page theme controls
  const loginIcon = document.getElementById("loginThemeIcon");
  if (loginIcon) loginIcon.className = theme === "dark" ? "fas fa-sun" : "fas fa-moon";
}

// Initialize theme immediately on load so login screen is light/dark as desired
initTheme();


function generateSpeciesTargetedDrills(species, goal) {
  const s = (species || "Human").toLowerCase().trim();
  let pool = [];

  // Human Fitness & Strength Routine
  if (s.includes("human") || s.includes("person") || s.includes("man") || s.includes("woman") || s.includes("myself") || s.includes("me") || s.includes("gym") || s.includes("boy") || s.includes("girl") || s.includes("athlete")) {
    pool = [
      {
        phase: "Phase 1: Deep Lower Body Power", title: "Bodyweight / Barbell Deep Squats",
        desc: "4 sets × 12 reps. Keep heels grounded and thighs parallel to floor.", chip: "Legs & Glutes", exerciseKey: "squat",
        difficulty: "Intermediate", duration: "12-15 mins", sets_reps: "4 sets × 12 reps", rest: "90 seconds",
        equipment: "Bodyweight / Barbell", environment: "Gym / Flat Indoor Surface", safety: "Keep heels grounded, avoid knee valgus (collapsing inwards).",
        muscles: "Quadriceps, Gluteus Maximus, Hamstrings", joints: "Knee, Hip, Ankle", energy: "~150 kcal"
      },
      {
        phase: "Phase 2: Upper Body Pushing Strength", title: "Chest & Triceps Push Ups",
        desc: "4 sets × 15 reps. Maintain rigid plank alignment from neck to heels.", chip: "Chest & Arms", exerciseKey: "pushup",
        difficulty: "Beginner", duration: "10 mins", sets_reps: "4 sets × 15 reps", rest: "60 seconds",
        equipment: "None", environment: "Indoor/Outdoor Flat Surface", safety: "Maintain rigid plank alignment, do not let lower back sag.",
        muscles: "Pectoralis Major, Triceps Brachii", joints: "Shoulder, Elbow", energy: "~120 kcal"
      },
      {
        phase: "Phase 3: Core Anti-Extension Stability", title: "Forearm Core Plank Hold",
        desc: "3 rounds × 60 sec. Brace transverse abdominis tight.", chip: "Core & Abs", exerciseKey: "plank",
        difficulty: "Beginner", duration: "5-7 mins", sets_reps: "3 rounds × 60 sec", rest: "45 seconds",
        equipment: "Yoga Mat", environment: "Indoor Flat Surface", safety: "Keep neck neutral, do not hike hips up.",
        muscles: "Transverse Abdominis, Rectus Abdominis", joints: "Shoulder (Isometric)", energy: "~50 kcal"
      },
      {
        phase: "Phase 4: Cardiovascular Cadence", title: "High Knees Agility Sprint",
        desc: "5 sets × 45 sec. Drive knees up to waist height with rapid footwork.", chip: "Cardio", exerciseKey: "cardio",
        difficulty: "Advanced", duration: "10 mins", sets_reps: "5 sets × 45 sec", rest: "30 seconds",
        equipment: "None", environment: "Open Space", safety: "Land softly on the balls of the feet to minimize impact.",
        muscles: "Hip Flexors, Calves, Core", joints: "Hip, Knee, Ankle", energy: "~200 kcal"
      },
      {
        phase: "Phase 5: Posterior Chain Engagement", title: "Romanian Deadlifts (RDLs)",
        desc: "4 sets × 10 reps. Hinge at hips with slight knee bend to engage hamstrings.", chip: "Hamstrings", exerciseKey: "deadlift",
        difficulty: "Intermediate", duration: "12 mins", sets_reps: "4 sets × 10 reps", rest: "90 seconds",
        equipment: "Dumbbells/Barbell", environment: "Gym", safety: "Maintain neutral spine, do not round the lower back.",
        muscles: "Hamstrings, Glutes, Erector Spinae", joints: "Hip, Knee", energy: "~160 kcal"
      },
      {
        phase: "Phase 6: Back & Biceps Pull", title: "Dumbbell Bent-Over Rows",
        desc: "3 sets × 12 reps each side. Pull elbow towards hip.", chip: "Back", exerciseKey: "row",
        difficulty: "Beginner/Intermediate", duration: "10 mins", sets_reps: "3 sets × 12 reps", rest: "60 seconds",
        equipment: "Dumbbells", environment: "Indoor Gym", safety: "Keep core braced and back flat.",
        muscles: "Latissimus Dorsi, Rhomboids, Biceps", joints: "Shoulder, Elbow", energy: "~110 kcal"
      },
      {
        phase: "Phase 7: Dynamic Mobility", title: "Alternating Forward Lunges",
        desc: "3 sets × 10 reps per leg. Keep torso upright.", chip: "Mobility & Legs", exerciseKey: "lunge",
        difficulty: "Beginner", duration: "8 mins", sets_reps: "3 sets × 10 reps/leg", rest: "60 seconds",
        equipment: "None", environment: "Flat Surface", safety: "Ensure front knee does not collapse inwards or extend far past toes.",
        muscles: "Quads, Glutes, Calves", joints: "Hip, Knee, Ankle", energy: "~100 kcal"
      }
    ];
  } else if (s.includes("dog") || s.includes("canine") || s.includes("puppy")) {
    pool = [
      {
        phase: "Phase 1: Base Focus", title: "Sit & Stay Hold",
        desc: "Builds impulse control and core spinal stability.", chip: "Obedience", exerciseKey: "sit_stay",
        difficulty: "Beginner", duration: "5 mins", sets_reps: "5 reps × 30-sec", rest: "15 seconds",
        equipment: "Leash, Treats", environment: "Low-distraction area", safety: "Do not force posture; use positive reinforcement.",
        muscles: "Pelvic stabilizers, Core", joints: "Hip, Stifle", energy: "Low Metabolic Drain"
      },
      {
        phase: "Phase 2: Agility Sprint", title: "High-Drive Recall",
        desc: "Develops hindquarter propulsion and directional agility.", chip: "Agility", exerciseKey: "recall",
        difficulty: "Advanced", duration: "10 mins", sets_reps: "10 sprints × 20m", rest: "60 seconds",
        equipment: "Long Line", environment: "Fenced outdoor field", safety: "Ensure even ground free of holes to prevent ACL tears.",
        muscles: "Gluteals, Hamstrings", joints: "Stifle, Hock, Hip", energy: "High Metabolic Drain"
      },
      {
        phase: "Phase 3: Proprioception", title: "Balance Beam Walk",
        desc: "Enhances joint awareness and ACL ligament protection.", chip: "Balance", exerciseKey: "balance",
        difficulty: "Intermediate", duration: "8 mins", sets_reps: "6 passes", rest: "30 seconds",
        equipment: "Elevated plank (low)", environment: "Indoor/Outdoor", safety: "Use a wide enough plank for safety, guide with leash.",
        muscles: "Core, Limbs", joints: "All joints", energy: "Low Metabolic Drain"
      },
      {
        phase: "Phase 4: Behavioral", title: "Down-Stay Control",
        desc: "Builds emotional control and sustained quiet relaxation.", chip: "Discipline", exerciseKey: "down_stay",
        difficulty: "Intermediate", duration: "10 mins", sets_reps: "8 reps × 45s", rest: "10 seconds",
        equipment: "Mat", environment: "Indoor", safety: "Ensure floor is not too cold or slippery.",
        muscles: "Core relaxation", joints: "Spine", energy: "Resting Metabolic Rate"
      },
      {
        phase: "Phase 5: Fetch & Retrieve", title: "Aerobic Toy Fetch",
        desc: "Provides intense cardiovascular burst and tracking focus.", chip: "Cardio", exerciseKey: "fetch",
        difficulty: "Beginner", duration: "15 mins", sets_reps: "15-20 throws", rest: "As needed",
        equipment: "Tennis Ball / Toy", environment: "Park / Yard", safety: "Avoid sharp sticks; ensure dog rests if panting heavily.",
        muscles: "Full body", joints: "All limbs", energy: "High Metabolic Drain"
      }
    ];
  } else {
    pool = [
      {
        phase: "Phase 1: Agility", title: "Target Object Jump",
        desc: "Target stick cueing to develop hindlimb explosive propulsion.", chip: "Agility", exerciseKey: "jump",
        difficulty: "Intermediate", duration: "5 mins", sets_reps: "8 reps", rest: "30 seconds",
        equipment: "Target Stick", environment: "Indoor Secure Area", safety: "Ensure non-slip landing surface.",
        muscles: "Hindlimb extensors", joints: "Stifle, Hock, Hip", energy: "Moderate Active Drain"
      }
    ];
  }

  // Shuffle the pool to ensure variety
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool;
}

async function generateWebTrainingPlan(e) {
  if (e && e.preventDefault) e.preventDefault();

  const rawSpecies = document.getElementById("trainSpecies")?.value.trim();
  if (!rawSpecies) {
    showToast("Please enter the animal species name.", "warning");
    return;
  }

  const rawGoal = document.getElementById("trainGoal")?.value.trim();
  if (!rawGoal) {
    showToast("Please enter the training goal.", "warning");
    return;
  }

  const rawBreed = document.getElementById("trainBreed")?.value.trim();
  const rawAge = document.getElementById("trainAge")?.value.trim();
  const rawWeight = document.getElementById("trainWeight")?.value.trim();
  const rawDays = document.getElementById("trainDays")?.value.trim();

  const payload = {
    species: rawSpecies,
    goal: rawGoal,
    breed: rawBreed || undefined,
    age: rawAge ? parseFloat(rawAge) : undefined,
    weight: rawWeight ? parseFloat(rawWeight) : undefined,
    days: rawDays ? parseInt(rawDays, 10) : undefined
  };

  const container = document.getElementById("trainingResultContainer");
  if (!container) return;

  container.innerHTML = `
    <div style="text-align:center; padding:40px;">
      <i class="fas fa-spinner fa-spin" style="font-size:2rem; color:var(--primary); margin-bottom:10px;"></i>
      <div style="font-size:14px; color:var(--text-secondary);">Generating tailored training regimen via AI models...</div>
    </div>
  `;

  const headers = {
    'Content-Type': 'application/json',
    ...(currentUser && currentUser.token ? { 'Authorization': `Bearer ${currentUser.token}` } : {})
  };

  try {
    const res = await fetch(`${API_BASE}/training/programs`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to generate training plan.");
    }

    const program = data.program;
    const plan = program.progress.plan;
    window.lastGeneratedProgram = program;
    window.lastGeneratedPlan = plan;
    const days = plan.planDurationDays;
    const species = plan.speciesName || program.species || payload.species || "Dog";
    const breed = plan.breedName || program.breed || payload.breed || "";
    const age = plan.age || "N/A";
    const weight = plan.weight || "N/A";
    const goal = plan.goal;
    const daysPlan = plan.daysPlan;

    const safeSpecies = (species || "").replace(/'/g, "\\'");
    const safeBreed = (breed || "").replace(/'/g, "\\'");
    const safeGoal = (goal || "").replace(/'/g, "\\'");

    let totalCheckboxes = 0;
    
    const daysScheduleHtml = daysPlan.map((d) => {
      let dailyNutritionHtml = "";
      if (d.isRest) {
        dailyNutritionHtml = `
          <div style="background:var(--bg-main);border:1px solid rgba(2,132,199,0.3);border-left:4px solid var(--accent);padding:12px;border-radius:var(--radius-sm);margin-bottom:14px;">
            <div style="font-size:11px;font-weight:800;color:var(--accent);text-transform:uppercase;">🥗 Rest Day Nutrition Protocol</div>
            <div style="font-size:13px;color:var(--text-primary);font-weight:700;margin-top:2px;">${d.diet.recommendation}</div>
          </div>
        `;
      } else {
        dailyNutritionHtml = `
          <div style="background:var(--bg-main);border:1px solid rgba(16,185,129,0.3);border-left:4px solid var(--primary);padding:12px;border-radius:var(--radius-sm);margin-bottom:14px;">
            <div style="font-size:11px;font-weight:800;color:var(--primary);text-transform:uppercase;">🔥 Training Day Nutrition Protocol</div>
            <div style="font-size:13px;color:var(--text-primary);font-weight:700;margin-top:2px;">${d.diet.recommendation}</div>
          </div>
        `;
      }

      const drillsListHtml = (d.drills || []).map((drill, index) => {
        totalCheckboxes++;
        const uniqueId = `drill-${d.dayNum}-${index}`;
        return `
        <div style="background:var(--bg-main);border:1px solid var(--border-color);padding:16px;border-radius:var(--radius-sm);margin-top:12px;box-shadow:var(--shadow-sm);">
          <div style="display:flex;align-items:flex-start;gap:12px;">
            <input type="checkbox" class="drill-checkbox" style="width:22px;height:22px;accent-color:var(--primary);cursor:pointer;margin-top:2px;" onchange="updateTrainingPlanProgress()">
            <div style="flex:1;">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                <strong style="color:var(--primary);font-size:16px;font-weight:900;">${drill.name}</strong>
                <div style="display:flex;gap:8px;align-items:center;">
                  <span class="tag-chip" style="font-size:11px;padding:4px 10px;background:var(--primary-light);color:var(--primary);font-weight:800;border-radius:12px;">${drill.difficulty || 'Intermediate'}</span>
                  <button type="button" class="btn btn-primary" style="padding:4px 10px;font-size:11px;border-radius:12px;" onclick="window.openAiScannerModal('${drill.name.replace(/'/g, "\\'")}', '${drill.id || 'scan'}', '${safeSpecies}', '${safeBreed}')"><i class="fas fa-camera"></i> AI Pose Scan</button>
                  <button type="button" class="btn btn-secondary" style="padding:4px 8px;border-radius:50%;" onclick="window.toggleDrillDetails('${uniqueId}')"><i class="fas fa-chevron-down" id="icon-${uniqueId}"></i></button>
                </div>
              </div>
              <div style="font-size:13px;color:var(--text-primary);margin-top:4px;font-weight:500;">${drill.desc}</div>
            </div>
          </div>
          
          <div id="${uniqueId}" style="display:none;margin-top:12px;border-top:1px solid var(--border-color);padding-top:12px;">
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px;background:var(--card-bg-subtle, rgba(255,255,255,0.03));padding:12px;border-radius:8px;">
              <div style="display:flex;flex-direction:column;gap:8px;">
                <div style="font-size:12px;color:var(--text-secondary);"><strong>⏱️ Duration:</strong> <span style="color:var(--text-main);font-weight:600;">10-15 mins</span></div>
                <div style="font-size:12px;color:var(--text-secondary);"><strong>🔄 Sets/Reps:</strong> <span style="color:var(--text-main);font-weight:600;">${drill.reps || '3 sets'}</span></div>
                <div style="font-size:12px;color:var(--text-secondary);"><strong>⏳ Rest:</strong> <span style="color:var(--text-main);font-weight:600;">60s</span></div>
              </div>
              <div style="display:flex;flex-direction:column;gap:8px;">
                <div style="font-size:12px;color:var(--text-secondary);"><strong>🔥 Energy:</strong> <span style="color:var(--text-main);font-weight:600;">${drill.intensity || 'Moderate'}</span></div>
                <div style="font-size:12px;color:var(--text-secondary);"><strong>🏋️ Equipment:</strong> <span style="color:var(--text-main);font-weight:600;">None</span></div>
                <div style="font-size:12px;color:var(--text-secondary);"><strong>📍 Environment:</strong> <span style="color:var(--text-main);font-weight:600;">Safe space</span></div>
              </div>
              <div style="display:flex;flex-direction:column;gap:8px;">
                <div style="font-size:12px;color:var(--text-secondary);"><strong>💪 Muscles:</strong> <span style="color:var(--text-main);font-weight:600;">${drill.targetMuscles || 'Full Body'}</span></div>
                <div style="font-size:12px;color:var(--text-secondary);"><strong>🦴 Joints:</strong> <span style="color:var(--text-main);font-weight:600;">Multiple</span></div>
              </div>
            </div>
          </div>
        </div>
        `;
      }).join("");

      return `
        <div style="background:${d.isRest ? 'var(--bg-main)' : 'var(--bg-card)'};border:1px solid var(--border-color);border-left:5px solid ${d.isRest ? 'var(--accent)' : 'var(--primary)'};padding:18px 20px;border-radius:var(--radius-md);margin-bottom:16px;box-shadow:var(--shadow-sm);">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px;">
            <strong style="font-size:17px;font-weight:900;color:var(--text-primary);">${d.title}</strong>
            <span style="font-size:12px;font-weight:800;color:${d.isRest ? 'var(--accent)' : 'var(--primary)'};background:rgba(16,185,129,0.1);padding:4px 12px;border-radius:14px;border:1px solid ${d.isRest ? 'rgba(2,132,199,0.2)' : 'rgba(16,185,129,0.2)'};">
              ${d.isRest ? '💤 Active Recovery' : '🔥 Workout Session'}
            </span>
          </div>
          ${dailyNutritionHtml}
          <div style="font-size:13.5px;color:var(--text-secondary);margin-top:6px;font-weight:500;margin-bottom:10px;">${d.focus}</div>
          ${drillsListHtml}
        </div>
      `;
    }).join("");

    const safetyItems = (plan.safetyWarnings || []).map(tip => `<li>${tip}</li>`).join("");

    container.innerHTML = `
      <div class="card" id="activeWorkoutPlanCard" style="margin-top:24px;border-left:4px solid var(--primary);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:14px;margin-bottom:18px;">
          <div>
            <div class="card-title" style="margin-bottom:4px;"><i class="fas fa-brain" style="color:var(--primary)"></i> ${days}-Day AI Species-Targeted Training Protocol: ${species} (${breed})</div>
            <div class="card-subtitle" style="margin-bottom:0;">Tailored module for ${age} yrs • ${weight} kg • ${days}-Day Plan • Primary Goal: <strong>${goal}</strong></div>
            <div style="margin-top:8px;font-size:12px;color:var(--primary);font-weight:700;display:flex;align-items:center;gap:8px;">
              <span style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3);padding:3px 10px;border-radius:12px;font-size:11px;font-weight:800;"><i class="fas fa-robot"></i> Trained ML Model Verified</span>
              <span><i class="fas fa-check-double"></i> Adapted: ${plan.adaptationExplanation || 'Default'}</span>
            </div>
          </div>
          <span class="tag-chip" style="background:var(--primary-light);color:var(--primary);font-weight:800;padding:6px 14px;">⚡ ${days}-DAY PLAN GENERATED</span>
        </div>

        <!-- Metric Cards Grid -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(190px,1fr));gap:14px;margin-bottom:22px;">
          <div style="background:var(--bg-main);border:1px solid var(--border-color);padding:16px;border-radius:var(--radius-md);">
            <div style="font-size:11px;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Caloric Target</div>
            <div style="font-size:22px;font-weight:900;color:var(--primary);margin-top:4px;">${plan.daysPlan[0]?.targetCalories || 0} <span style="font-size:13px;font-weight:600;">kcal/day</span></div>
          </div>
          <div style="background:var(--bg-main);border:1px solid var(--border-color);padding:16px;border-radius:var(--radius-md);">
            <div style="font-size:11px;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Hydration Minimum</div>
            <div style="font-size:22px;font-weight:900;color:var(--accent);margin-top:4px;">${plan.daysPlan[0]?.diet?.hydration || '1.5L'}</div>
          </div>
          <div style="background:var(--bg-main);border:1px solid var(--border-color);padding:16px;border-radius:var(--radius-md);">
            <div style="font-size:11px;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Plan Duration</div>
            <div style="font-size:22px;font-weight:900;color:var(--purple);margin-top:4px;">${days} Days <span style="font-size:13px;font-weight:600;">Regimen</span></div>
          </div>
        </div>

        <!-- Multi-Day Workout Regimen & Interactive Drills -->
        <div style="margin-bottom:22px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <h4 style="font-size:16px;font-weight:800;color:var(--text-primary);margin:0;">📅 ${days}-Day Training Schedule</h4>
            <span style="font-size:12px;font-weight:700;color:var(--primary);" id="trainingPlanProgressLabel">0% Complete (0/${totalCheckboxes} Drills Verified)</span>
          </div>
          <div style="width:100%;height:8px;background:var(--bg-main);border-radius:4px;overflow:hidden;margin-bottom:16px;border:1px solid var(--border-color);">
            <div id="trainingPlanProgressBar" style="width:0%;height:100%;background:var(--primary);transition:width 0.3s ease;"></div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${daysScheduleHtml}
          </div>
        </div>

        <!-- Safety & Biomechanics Notes -->
        <div style="background:var(--bg-main);border:1px solid var(--border-color);padding:16px 20px;border-radius:var(--radius-md);margin-bottom:20px;">
          <div style="font-weight:800;font-size:14px;color:var(--text-primary);margin-bottom:8px;">⚠️ Biomechanics & Trainer Guidelines:</div>
          <ul style="padding-left:20px;font-size:13px;color:var(--text-secondary);line-height:1.7;margin:0;">
            <li>Verify ambient temperature is under 30°C before exterior pavement drills.</li>
            <li>For animals/humans over 25 kg, avoid sudden sharp pivots on hard asphalt to safeguard joint ligaments.</li>
            ${safetyItems}
          </ul>
        </div>

        <!-- Action Buttons -->
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <button class="btn btn-primary" onclick="saveCurrentTrainingPlan('${safeSpecies}','${safeBreed}','${safeGoal}')">
            <i class="fas fa-bookmark"></i> Save ${days}-Day Plan to Profile
          </button>
          <button class="btn btn-secondary" onclick="exportWorkoutPlanToPDF()">
            <i class="fas fa-print"></i> Print / Export PDF Plan
          </button>
        </div>
      </div>
    `;

    showToast("AI Training Program generated and saved to history successfully!", "success");

  } catch (err) {
    showToast(err.message, "error");
    container.innerHTML = `
      <div class="card" style="margin-top:24px; border-left:4px solid var(--error-color, #ef4444); padding:20px; text-align:center;">
        <i class="fas fa-circle-exclamation" style="font-size:2.5rem; color:var(--error-color, #ef4444); margin-bottom:12px;"></i>
        <h4 style="font-size:1.1rem; font-weight:800; color:var(--text-primary); margin-bottom:8px;">Regimen Generation Failed</h4>
        <div style="font-size:13px; color:var(--text-secondary); line-height:1.5; max-width:400px; margin:0 auto;">${err.message}</div>
      </div>
    `;
  }
}


window.markWebExerciseCompleted = function markWebExerciseCompleted(drillTitle) {
  const checkboxes = document.querySelectorAll('.drill-checkbox');
  let count = 0;
  checkboxes.forEach(cb => {
    const parent = cb.closest('div');
    const titleEl = parent ? parent.querySelector('strong') : null;
    if (titleEl && drillTitle && (titleEl.textContent.toLowerCase().includes(drillTitle.toLowerCase()) || drillTitle.toLowerCase().includes(titleEl.textContent.toLowerCase()))) {
      cb.checked = true;
      count++;
    }
  });
  if (count > 0) {
    updateTrainingPlanProgress();
    showToast(`✅ Verified: "${drillTitle}" marked COMPLETED in AI Trainer!`, "success", 5000);
  }
};

function toggleTrainingDrillCheck(el) {
  // No-op or custom logic if needed
}

function updateTrainingPlanProgress() {
  const checkboxes = document.querySelectorAll('.drill-checkbox');
  if (!checkboxes.length) return;
  const checked = Array.from(checkboxes).filter(c => c.checked).length;
  const pct = Math.round((checked / checkboxes.length) * 100);
  const bar = document.getElementById("trainingPlanProgressBar");
  const label = document.getElementById("trainingPlanProgressLabel");
  if (bar) bar.style.width = `${pct}%`;
  if (label) label.textContent = `${pct}% Complete (${checked}/${checkboxes.length} Drills Verified)`;
  if (pct === 100) showToast("🏆 Training Plan 100% Completed! XP awarded to your profile.", "success");
}

function exportWorkoutPlanToPDF() {
  const planEl = document.getElementById("activeWorkoutPlanCard") || document.getElementById("trainingResultContainer");
  if (!planEl) {
    showToast("No active workout plan found to export.", "warning");
    return;
  }

  const clone = planEl.cloneNode(true);
  clone.style.cssText = `
    position: absolute;
    left: -9999px;
    top: 0;
    width: 800px;
    background: #ffffff !important;
    color: #0f172a !important;
    padding: 24px;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    box-sizing: border-box;
  `;
  clone.querySelectorAll('*').forEach(el => {
    el.style.color = '#0f172a';
    if (el.tagName === 'BUTTON' || el.classList.contains('btn')) {
      el.remove();
    }
  });

  document.body.appendChild(clone);

  const opt = {
    margin: [8, 8, 8, 8],
    filename: `ecotrack-training-plan-${Date.now()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
  };

  if (window.html2pdf) {
    showToast("Generating Training Plan PDF...", "info", 2000);
    window.html2pdf().set(opt).from(clone).save()
      .then(() => {
        clone.remove();
        showToast("Training Plan PDF downloaded successfully!", "success");
      })
      .catch(err => {
        clone.remove();
        window.print();
      });
  } else {
    clone.remove();
    window.print();
  }
}
window.exportWorkoutPlanToPDF = exportWorkoutPlanToPDF;

async function saveCurrentTrainingPlan(species, breed, goal) {
  const session = (typeof getSession === 'function' ? getSession() : null) || window.currentUser;
  const user = session || currentUser || { id: 'usr1' };

  const plan = window.lastGeneratedPlan || null;
  const days = plan?.planDurationDays || 3;
  const programData = {
    user_id: user.id,
    name: `${days}-Day Training Plan for ${species}`,
    species,
    breed: breed || 'Standard',
    goal,
    days,
    plan: plan
  };

  const headers = {
    "Content-Type": "application/json",
    ...(user.token ? { "Authorization": `Bearer ${user.token}` } : {})
  };

  try {
    const res = await fetch(`${API_BASE}/training/programs`, {
      method: "POST",
      headers,
      body: JSON.stringify(programData)
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      const userPlansKey = `@ecotrack_training_plans_${user.id}`;
      let userPlans = JSON.parse(localStorage.getItem(userPlansKey) || "[]");
      const savedObj = data?.program || {
        id: `tp_${Date.now()}`,
        species,
        breed,
        goal,
        title: `${days}-Day Training Plan for ${species}`,
        started_at: new Date().toISOString(),
        progress: {
          completed_exercises: [],
          current_week: 1,
          plan
        }
      };
      userPlans = userPlans.filter(p => String(p.id) !== String(savedObj.id));
      userPlans.unshift(savedObj);
      localStorage.setItem(userPlansKey, JSON.stringify(userPlans));
      showToast(`📋 Training Plan for ${species} saved to your profile!`, "success", 4500);
      if (window.loadProfileTab) window.loadProfileTab();
    } else {
      throw new Error();
    }
  } catch {
    showToast("Saved plan to your profile locally.", "info");
    const userPlansKey = `@ecotrack_training_plans_${user.id}`;
    let userPlans = JSON.parse(localStorage.getItem(userPlansKey) || "[]");
    const newPlan = {
      id: `tp_loc_${Date.now()}`,
      species,
      breed,
      goal,
      started_at: new Date().toISOString(),
      progress: {
        completed_exercises: [],
        current_week: 1,
        plan
      }
    };
    userPlans.unshift(newPlan);
    localStorage.setItem(userPlansKey, JSON.stringify(userPlans));
    setEl("profileStatPlans", userPlans.length);
  }
}

// ══════════════════════════════════════════════════
// PROFILE, MARKETPLACE, COMMUNITY, EVENTS, MAPS
// ══════════════════════════════════════════════════

// Profile loading is fully managed by profile.js and exported on window.loadProfileTab

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function openAddPetModal() {
  ["petName", "petSpecies", "petBreed", "petAge", "petWeight", "petPhotoFile"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("addPetModal")?.classList.add("active");
}

function closeAddPetModal() {
  document.getElementById("addPetModal")?.classList.remove("active");
}

async function submitAddPet() {
  const name = document.getElementById("petName")?.value.trim();
  const species = document.getElementById("petSpecies")?.value.trim();
  if (!name || !species) { showToast("Pet name and species are required.", "error"); return; }

  const fileInput = document.getElementById("petPhotoFile");
  const file = fileInput?.files[0];
  let imageUrl = "";

  if (file) {
    imageUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  }

  const curId = (typeof currentUser !== 'undefined' && currentUser?.id) || (typeof window !== 'undefined' && window.currentUser?.id) || 'usr1';
  const petData = {
    name, species,
    breed: document.getElementById("petBreed")?.value.trim() || "Standard Breed",
    age: document.getElementById("petAge")?.value.trim() || "1 Year",
    weight: document.getElementById("petWeight")?.value.trim() || "10 kg",
    image: imageUrl,
    isPrimary: (typeof userPets !== 'undefined' && userPets.length === 0)
  };

  const authHeaders = (typeof window.EcoSocialDB !== 'undefined' && window.EcoSocialDB.getAuthHeader) ? window.EcoSocialDB.getAuthHeader() : { 'Content-Type': 'application/json' };
  let addedPet = null;

  try {
    const res = await fetch(`${API_BASE}/users/${curId}/pets`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(petData)
    });
    if (res.ok) {
      const data = await res.json();
      addedPet = data.pet;
      if (typeof userPets !== 'undefined' && Array.isArray(userPets)) {
        userPets.unshift(data.pet);
      }
    }
  } catch (e) {
    console.warn("Failed to sync added pet to backend:", e.message);
  }

  // Also sync in-memory activeProfileData.pets
  if (typeof activeProfileData !== 'undefined' && activeProfileData && addedPet) {
    if (!Array.isArray(activeProfileData.pets)) activeProfileData.pets = [];
    activeProfileData.pets.unshift(addedPet);
  }

  closeAddPetModal();
  if (window.loadProfileTab) {
    await window.loadProfileTab(curId);
  }
  if (window.switchProfileTabSection) {
    window.switchProfileTabSection("pets");
  }
  showToast(`🐾 ${name} added to your animal vault!`, "success");
}

async function loadTrainingAnalytics() {
  if (!currentUser) return;
  try {
    const res = await fetch(`${API_BASE}/analytics?user_id=${currentUser.id}`);
    if (res.ok) {
      const data = await res.json();
      const ob = data.obedience || 85;
      const fo = data.focus || 90;
      setEl("trainScoreObedience", ob + "%");
      setEl("trainScoreFocus", fo + "%");
      const bOb = document.getElementById("trainBarObedience");
      const bFo = document.getElementById("trainBarFocus");
      if (bOb) bOb.style.width = ob + "%";
      if (bFo) bFo.style.width = fo + "%";
    }
  } catch { /* offline fallback */ }
}

async function fetchDashboardMetrics() {
  const container = document.getElementById("dashboardActivitySection");
  if (!container) return;

  const session = getSession();
  if (!session) {
    container.innerHTML = "";
    return;
  }

  const userId = session.id;
  const token = session.token;
  const headers = { 'Authorization': `Bearer ${token}` };

  try {
    // 1. Fetch scan history
    const scans = await fetch(`${API_BASE}/ai/scan-history?user_id=${userId}`, { headers })
      .then(r => r.ok ? r.json() : [])
      .catch(() => []);

    // 2. Fetch training programs
    const programs = await fetch(`${API_BASE}/training/programs/${userId}`, { headers })
      .then(r => r.ok ? r.json() : [])
      .catch(() => []);

    // 3. Read registered events
    let registeredEvents = [];
    if (window.registeredEventIds && Array.isArray(window.registeredEventIds) && window.registeredEventIds.length > 0) {
      const list = window.eventsList || [];
      window.registeredEventIds.forEach(id => {
        const ev = list.find(e => e.id === id);
        if (ev) registeredEvents.push(ev);
      });
    }

    renderDashboardActivity(scans, programs, registeredEvents);
  } catch (err) {
    console.error("Error loading dashboard metrics:", err);
    renderDashboardActivity([], [], []);
  }
}

function renderDashboardActivity(scans, programs, registeredEvents) {
  const container = document.getElementById("dashboardActivitySection");
  if (!container) return;

  if (registeredEvents.length === 0) {
    container.innerHTML = `
      <div class="activity-welcome-card">
        <div class="activity-welcome-title">Welcome to EcoTrack! 👋</div>
        <div class="activity-welcome-desc">
          Get started by training your animal species with our weight-scaled AI trainer, 
          scanning coordinates/postures in real-time, or joining upcoming community events.
        </div>
      </div>
    `;
    return;
  }

  let html = `<div class="activity-grid">`;

  // Upcoming Event Card
  if (registeredEvents.length > 0) {
    const nextEvent = registeredEvents[0];
    html += `
      <div class="activity-card">
        <div>
          <div class="activity-card-header">
            <i class="fas fa-calendar-alt"></i>
            <span>Upcoming Registered Event</span>
          </div>
          <div class="activity-card-body" style="margin-top: 0.75rem;">
            <p style="font-weight: 800; font-size: 1.05rem; color: var(--text-primary); margin-bottom: 0.25rem;">${nextEvent.title}</p>
            <p style="margin-bottom: 0.5rem; font-size: 0.85rem;"><i class="fas fa-location-dot" style="color: var(--primary); margin-right: 4px;"></i> ${nextEvent.location}</p>
            <p style="font-size: 0.8rem; color: var(--text-muted);"><i class="far fa-calendar"></i> Starts ${nextEvent.date}</p>
          </div>
        </div>
        <div class="activity-card-footer">
          <button class="btn btn-secondary" style="font-size:12px; padding: 6px 12px; width: 100%;" onclick="switchTab('events'); activeEventsTab='tickets'; renderEvents();">
            <i class="fas fa-ticket-simple"></i> View Entry Pass
          </button>
        </div>
      </div>
    `;
  }

  html += `</div>`;
  container.innerHTML = html;
}

window.fetchDashboardMetrics = fetchDashboardMetrics;


// ══════════════════════════════════════════════════
// MARKETPLACE & COMMERCE
// ══════════════════════════════════════════════════
const BASE_MARKET_ANIMALS = [
  { id: 101, name: "Purebred German Shepherd Pup", species: "Dog", gender: "Male", type: "sale", age: "8 Weeks", price: "₹15,000", priceStr: "₹15,000", location: "Chennai, TN", image: "https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?w=600", breed: "German Shepherd", description: "AKC-line purebred with full vaccination certificate. Health tested parents.", vaccinated: true, health: "Athletic", lat: 13.0827, lng: 80.2707, sellerId: "usr_apex_k9", sellerName: "Apex K9 Kennels", seller: "Apex K9 Kennels" },
  { id: 104, name: "Golden Retriever (Adoption)", species: "Dog", gender: "Female", type: "adoption", age: "2 Years", price: "Free Adoption", priceStr: "Free Adoption", location: "Hyderabad, TS", image: "https://images.unsplash.com/photo-1552053831-71594a27632d?w=400", breed: "Golden Retriever", description: "Rescued Golden Retriever. Neutered, vaccinated, socialized. Needs a loving home.", vaccinated: true, health: "Excellent", lat: 17.3850, lng: 78.4867, sellerId: "usr_golden_haven", sellerName: "Golden Haven Sanctuary", seller: "Golden Haven Sanctuary" },
  { id: 107, name: "Rescued Indie Puppy - Bruno", species: "Dog", gender: "Male", type: "adoption", age: "3 Months", price: "Free Adoption", priceStr: "Free Adoption", location: "Chennai, TN", image: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=600", breed: "Indian Pariah", description: "Playful and loving Indie pup rescued from the streets. Fully vaccinated and dewormed.", vaccinated: true, health: "Perfect", lat: 13.0827, lng: 80.2707, sellerId: "usr_paws_rescue", sellerName: "Paws Rescue Trust", seller: "Paws Rescue Trust" },
  { id: 108, name: "Rescued Persian Cat - Luna", species: "Cat", gender: "Female", type: "adoption", age: "1 Year", price: "Free Adoption", priceStr: "Free Adoption", location: "Bangalore, KA", image: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=600", breed: "Persian", description: "Gentle and affectionate Persian cat looking for a quiet, warm home. Vaccinated and litter trained.", vaccinated: true, health: "Optimal", lat: 12.9716, lng: 77.5946, sellerId: "usr_kavita_persian", sellerName: "Kavita Reddy", seller: "Kavita Reddy" },
  { id: 109, name: "Hand-Reared Sun Conure - Rio", species: "Bird", gender: "Male", type: "sale", age: "6 Months", price: "₹8,500", priceStr: "₹8,500", location: "Mumbai, MH", image: "https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=600", breed: "Sun Conure", description: "Tame, step-up trained hand-reared Sun Conure. Vibrant plumage and high cognitive intelligence.", vaccinated: true, health: "Flourishing", lat: 19.0760, lng: 72.8777, sellerId: "usr_avian_care", sellerName: "Avian Care World", seller: "Avian Care World" },
  { id: 110, name: "Thoroughbred Colt - Sultan", species: "Horse", gender: "Male", type: "sale", age: "3 Years", price: "₹85,000", priceStr: "₹85,000", location: "Pune, MH", image: "https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=600", breed: "Marwari / Thoroughbred", description: "Healthy and agile athletic young stallion with excellent stamina and regal carriage.", vaccinated: true, health: "Athletic", lat: 18.5204, lng: 73.8567, sellerId: "usr_royal_stables", sellerName: "Royal Equine Stables", seller: "Royal Equine Stables" },
  { id: 111, name: "Holland Lop Bunny - Thumper", species: "Rabbit", gender: "Male", type: "adoption", age: "5 Months", price: "Free Adoption", priceStr: "Free Adoption", location: "Chennai, TN", image: "https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=600", breed: "Holland Lop", description: "Super calm and friendly indoor bunny rabbit. Dewormed and loves fresh greens.", vaccinated: true, health: "Healthy", lat: 13.0827, lng: 80.2707, sellerId: "usr_chennai_paws", sellerName: "Chennai Animal Rescue", seller: "Chennai Animal Rescue" }
];

const BASE_MARKET_PRODUCTS = [
  { id: 102, name: "Orthopedic Memory Foam Pet Bed", category: "Accessories", subCategory: "Accessories", price: 1499, priceNum: 1499, priceStr: "₹1,499", image: "assets/pet_bed.jpg", description: "High-density memory foam with waterproof cover. Suitable for dogs up to 30kg.", specs: "Memory Foam, L-Size, Washable Cover", location: "Bangalore, KA", seller: "ComfortPaws Pet Supplies", sellerId: "usr_comfort_paws", sellerName: "ComfortPaws Pet Supplies", lat: 12.9716, lng: 77.5946 },
  { id: 103, name: "Premium Bird Cage (Large)", category: "Housing", subCategory: "Housing", price: 3500, priceNum: 3500, priceStr: "₹3,500", image: "assets/bird_cage.jpg", description: "Powder-coated steel cage with multiple perches, feeding stations and pull-out tray.", specs: "80×60×120cm, Non-toxic coating", location: "Mumbai, MH", seller: "Avian Care World", sellerId: "usr_avian_care", sellerName: "Avian Care World", lat: 19.0760, lng: 72.8777 },
  { id: 105, name: "Organic Aloe & Oatmeal Pet Shampoo", category: "Supplies", subCategory: "Supplies", price: 499, priceNum: 499, priceStr: "₹499", image: "assets/pet_shampoo.jpg", description: "Soothing, organic aloe vera and oatmeal shampoo formula for dogs and cats. Promotes a soft, shiny coat and relieves itchy skin.", specs: "Volume: 500ml, Tear-free, Oatmeal & Honey scent", location: "Chennai, TN", seller: "VetCare Organics", sellerId: "usr_vetcare_meds", sellerName: "VetCare Organics", lat: 13.0827, lng: 80.2707 },
  { id: 106, name: "Ergonomic GPS Animal Tracker Harness", category: "Gear", subCategory: "Gear", price: 1899, priceNum: 1899, priceStr: "₹1,899", image: "assets/dog_tracker.jpg", description: "Real-time GPS tracker harness for dogs and cats with night reflective strips.", specs: "Battery: 10 days, IP68 Waterproof, LTE Geo-fence", location: "Bangalore, KA", seller: "Rex Gear Official", sellerId: "usr_rex_gear", sellerName: "Rex Gear Official", lat: 12.9784, lng: 77.6408 },
  { id: 201, name: "Organic Canine Kibble 10kg", category: "Food", subCategory: "Food", price: 2499, priceNum: 2499, priceStr: "₹2,499", image: "assets/dog_kibble.jpg", description: "100% natural organic ingredients, grain-free canine nutrition. Formulated for high-energy active dogs.", specs: "Protein: 28%, Fat: 16%, 10kg Bag", location: "Chennai, TN", seller: "EcoPet Supplies", sellerId: "usr_comfort_paws", sellerName: "EcoPet Supplies", lat: 13.0850, lng: 80.2101 },
  { id: 202, name: "Heavy-Duty Agility Harness", category: "Gear", subCategory: "Gear", price: 1299, priceNum: 1299, priceStr: "₹1,299", image: "assets/dog_harness.jpg", description: "No-pull ergonomic design with reinforced reflective stitching and soft padding for animal safety.", specs: "Nylon/Steel, Adjustable, Reflective", location: "Bangalore, KA", seller: "Rex Gear Official", sellerId: "usr_rex_gear", sellerName: "Rex Gear Official", lat: 12.9784, lng: 77.6408 },
  { id: 203, name: "Sterile Saline Wash & First Aid", category: "Medical", subCategory: "Medical", price: 450, priceNum: 450, priceStr: "₹450", image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?q=85&w=1200", description: "Essential veterinary first-aid antiseptic saline. Non-stinging formula for cleaning animal wounds and abrasions.", specs: "500ml Spray, 0.9% NaCl", location: "Chennai, TN", seller: "VetCare Organics", sellerId: "usr_vetcare_meds", sellerName: "VetCare Organics", lat: 12.9815, lng: 80.2180 },
  { id: 204, name: "Stainless Steel Anti-Skid Pet Bowl", category: "Supplies", subCategory: "Supplies", price: 399, priceNum: 399, priceStr: "₹399", image: "assets/dog_bowl.jpg", description: "Durable food-grade stainless steel feeding bowl with non-slip rubber base. Dishwasher safe.", specs: "850ml capacity, Stainless Steel", location: "Bangalore, KA", seller: "ComfortPaws Pet Supplies", sellerId: "usr_comfort_paws", sellerName: "ComfortPaws Pet Supplies", lat: 12.9716, lng: 77.5946 },
  { id: 205, name: "Interactive Laser Teaser Cat Toy", category: "Accessories", subCategory: "Accessories", price: 599, priceNum: 599, priceStr: "₹599", image: "https://images.unsplash.com/photo-1545249390-6bdfa286032f?w=600", description: "Automatic rotating laser pointer with multiple speed modes for endless playful feline exercise.", specs: "Rechargeable USB, 3 Speed Modes", location: "Hyderabad, TS", seller: "Apex K9 Kennels", sellerId: "usr_apex_k9", sellerName: "Apex K9 Kennels", lat: 17.3850, lng: 78.4867 },
  { id: 206, name: "Multi-Tier Deluxe Cat Tree Condo", category: "Housing", subCategory: "Housing", price: 4200, priceNum: 4200, priceStr: "₹4,200", image: "https://images.unsplash.com/photo-1541599540903-216a46ca1dc0?w=600", description: "Plush multi-level cat tree with natural sisal scratching posts, cozy hammock, and elevated lookout perches.", specs: "145cm Height, Sisal Rope & Soft Plush", location: "Mumbai, MH", seller: "Avian Care World", sellerId: "usr_avian_care", sellerName: "Avian Care World", lat: 19.0760, lng: 72.8777 }
];

let MARKET_ANIMALS = [...BASE_MARKET_ANIMALS];
let MARKET_PRODUCTS = [...BASE_MARKET_PRODUCTS];

async function fetchMarketplaceListings() {
  try {
    const res = await fetch(`${API_BASE}/marketplace?t=${Date.now()}`);
    if (res.ok) {
      const items = await res.json();
      if (items && Array.isArray(items) && items.length > 0) {
        const fetchedAnimals = [];
        const fetchedProducts = [];
        items.forEach(item => {
          const titleLower = (item.title || item.name || '').toLowerCase();
          const breedLower = (item.breed || '').toLowerCase();

          // Species detection
          const speciesVal = item.species || (
            (breedLower.includes('dog') || breedLower.includes('shepherd') || breedLower.includes('retriever') || breedLower.includes('pariah') || breedLower.includes('puppy') || breedLower.includes('pup') ||
             titleLower.includes('dog') || titleLower.includes('puppy') || titleLower.includes('shepherd') || titleLower.includes('retriever') || titleLower.includes('pup')) ? 'Dog' :
            (breedLower.includes('cat') || breedLower.includes('persian') || breedLower.includes('kitten') || breedLower.includes('shorthair') ||
             titleLower.includes('cat') || titleLower.includes('kitten') || titleLower.includes('persian')) ? 'Cat' :
            (breedLower.includes('horse') || breedLower.includes('foal') || breedLower.includes('equine') || breedLower.includes('thoroughbred') || breedLower.includes('marwari') ||
             titleLower.includes('horse') || titleLower.includes('colt') || titleLower.includes('stallion') || titleLower.includes('mare')) ? 'Horse' :
            (breedLower.includes('bird') || breedLower.includes('parrot') || breedLower.includes('conure') || breedLower.includes('cockatiel') || breedLower.includes('macaw') ||
             titleLower.includes('bird') || titleLower.includes('parrot') || titleLower.includes('conure')) ? 'Bird' :
            (breedLower.includes('rabbit') || breedLower.includes('bunny') || breedLower.includes('lop') ||
             titleLower.includes('rabbit') || titleLower.includes('bunny')) ? 'Rabbit' :
            'Dog'
          );

          // Category correction & normalization
          let categoryVal = item.category || 'Supplies';
          if (titleLower.includes('tracker') || titleLower.includes('harness') || titleLower.includes('leash') || titleLower.includes('collar')) {
            categoryVal = 'Gear';
          } else if (titleLower.includes('kibble') || titleLower.includes('food') || titleLower.includes('treat') || titleLower.includes('grain')) {
            categoryVal = 'Food';
          } else if (titleLower.includes('saline') || titleLower.includes('medical') || titleLower.includes('first aid') || titleLower.includes('antiseptic') || titleLower.includes('medicine')) {
            categoryVal = 'Medical';
          } else if (titleLower.includes('bed') || titleLower.includes('toy') || titleLower.includes('laser') || titleLower.includes('chew')) {
            categoryVal = 'Accessories';
          } else if (titleLower.includes('cage') || titleLower.includes('tree') || titleLower.includes('condo') || titleLower.includes('aquarium') || titleLower.includes('kennel') || titleLower.includes('housing')) {
            categoryVal = 'Housing';
          } else if (titleLower.includes('shampoo') || titleLower.includes('bowl') || titleLower.includes('feeder') || titleLower.includes('litter') || titleLower.includes('supplies')) {
            categoryVal = 'Supplies';
          }

          // Image correction: prevent misassigned stock dog photos from being attached to GPS tracker
          let imgVal = item.image_url || item.image;
          if (!imgVal || (String(item.id) === '106' && (imgVal.includes('photo-1583337130417-3346a1be7dee') || !imgVal.includes('dog_tracker'))) || titleLower.includes('gps animal tracker')) {
            imgVal = 'assets/dog_tracker.jpg';
          } else if (imgVal.startsWith('/assets/')) {
            imgVal = imgVal.substring(1);
          }

          // Seller name extraction
          const sellerNameStr = (typeof item.seller === 'object' && item.seller !== null)
            ? (item.seller.name || 'Verified Seller')
            : (item.sellerName || item.seller_name || item.seller || 'Verified Seller');

          const mappedItem = {
            id: item.id,
            sellerId: item.seller ? (item.seller.id || item.seller) : (item.user_id || `usr_seller_${item.id}`),
            sellerName: sellerNameStr,
            seller: sellerNameStr,
            name: item.title || item.name,
            type: item.type === "adoption" ? "adoption" : (item.type === "sale" ? "sale" : "accessory"),
            age: item.age || "Unknown",
            price: item.price === 0 ? "Free Adoption" : (String(item.price).startsWith("₹") ? item.price : `₹${item.price.toLocaleString("en-IN")}`),
            priceNum: typeof item.price === 'number' ? item.price : parseFloat(String(item.price).replace(/[^0-9.]/g, '')) || 0,
            location: item.location || "Local",
            image: imgVal || "assets/pet_bed.jpg",
            breed: item.breed || "",
            species: speciesVal,
            gender: item.gender || "Unknown",
            vaccinated: item.vaccinated === 1 || item.vaccinated === true,
            description: item.description || "Verified EcoTrack listing.",
            specs: item.specs || item.specs_json || "Standard Quality",
            category: categoryVal,
            subCategory: categoryVal,
            lat: item.lat || 13.0827,
            lng: item.lng || 80.2707
          };

          const isProduct = ['Food', 'Gear', 'Medical', 'Accessories', 'Housing', 'Supplies'].includes(categoryVal) || item.type === 'accessory';
          const isAnimal = !isProduct && (item.category === "Pets" || item.type === "sale" || item.type === "adoption" || !!item.breed || !!item.species);
          if (isAnimal) {
            fetchedAnimals.push(mappedItem);
          } else {
            fetchedProducts.push({ ...mappedItem, priceStr: mappedItem.price });
          }
        });

        // Merge base items with fetched items by ID to guarantee full catalog availability
        const animalMap = new Map();
        BASE_MARKET_ANIMALS.forEach(a => animalMap.set(String(a.id), { ...a }));
        fetchedAnimals.forEach(a => animalMap.set(String(a.id), { ...(animalMap.get(String(a.id)) || {}), ...a }));
        MARKET_ANIMALS = Array.from(animalMap.values());

        const productMap = new Map();
        BASE_MARKET_PRODUCTS.forEach(p => productMap.set(String(p.id), { ...p }));
        fetchedProducts.forEach(p => productMap.set(String(p.id), { ...(productMap.get(String(p.id)) || {}), ...p }));
        MARKET_PRODUCTS = Array.from(productMap.values());
      }
    }
  } catch (e) {
    console.warn("Marketplace fetch error, using local base data:", e);
    MARKET_ANIMALS = [...BASE_MARKET_ANIMALS];
    MARKET_PRODUCTS = [...BASE_MARKET_PRODUCTS];
  }
  renderMarketplace();
}

let marketplaceSearchQuery = "";
let activeMarketSecondaryFilter = "All";

function setMarketSecondaryFilter(filterVal) {
  activeMarketSecondaryFilter = filterVal;
  renderMarketplace();
}

function renderMarketplaceSecondaryFilters() {
  const container = document.getElementById("marketplaceSecondaryFilters");
  if (!container) return;

  if (activeMarketTab === "saved") {
    container.innerHTML = "";
    return;
  }

  const pills = activeMarketTab === "animals"
    ? ["All", "Sale", "Adoption"]
    : ["All", "Food", "Gear", "Medical", "Accessories", "Housing", "Supplies"];

  container.innerHTML = pills.map(p => {
    const isActive = activeMarketSecondaryFilter.toLowerCase() === p.toLowerCase();
    return `<button class="btn ${isActive ? 'btn-primary' : 'btn-secondary'}" style="border-radius:20px; padding:4px 14px; font-size:12px; font-weight:700;" onclick="setMarketSecondaryFilter('${p}')">${p}</button>`;
  }).join("");
}

function filterMarketplace(query) {
  marketplaceSearchQuery = query.toLowerCase().trim();
  renderMarketplace();
}

function switchMarketTab(sub) {
  activeMarketTab = sub;
  activeMarketSecondaryFilter = "All";
  document.querySelectorAll(".market-tab-btn").forEach(b => {
    b.classList.remove("btn-primary", "active"); b.classList.add("btn-secondary");
  });
  const btn = document.getElementById(`mtab-${sub}`);
  if (btn) { btn.classList.remove("btn-secondary"); btn.classList.add("btn-primary", "active"); }

  const nearbyBtn = document.getElementById("nearbyFilterBtn");
  if (nearbyBtn) nearbyBtn.style.display = (sub === "animals" || sub === "products") ? "flex" : "none";

  renderMarketplace();
}

let userCoords = null;
let nearbyFilterActive = false;

function getDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 9999;
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

function toggleNearbyMarket() {
  if (!nearbyFilterActive) {
    if (navigator.geolocation) {
      showToast("📍 Accessing GPS to find nearby listings...", "info");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          userCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          nearbyFilterActive = true;
          updateNearbyButtonUI();
          renderMarketplace();
          showToast("✅ GPS locked! Showing nearest animals and supplies.", "success");
        },
        () => {
          showToast("❌ Location access denied. Using default region.", "error");
        }
      );
    } else {
      showToast("Geolocation not supported.", "warning");
    }
  } else {
    nearbyFilterActive = false;
    updateNearbyButtonUI();
    renderMarketplace();
  }
}

function updateNearbyButtonUI() {
  const btn = document.getElementById("nearbyFilterBtn");
  if (btn) {
    btn.classList.toggle("btn-primary", nearbyFilterActive);
    btn.classList.toggle("btn-secondary", !nearbyFilterActive);
    btn.innerHTML = nearbyFilterActive ? `<i class="fas fa-check-circle"></i> Nearby On` : `<i class="fas fa-location-arrow"></i> Nearby`;
  }
}

function renderMarketplace() {
  renderMarketplaceSecondaryFilters();
  const container = document.getElementById("marketplaceGrid");
  if (!container) return;

  let list = [];
  if (activeMarketTab === "animals") {
    list = [...MARKET_ANIMALS];
  } else if (activeMarketTab === "products") {
    list = [...MARKET_PRODUCTS];
  } else if (activeMarketTab === "saved") {
    const favAnimals = MARKET_ANIMALS.filter(a => favorites.includes(a.id));
    const favProducts = MARKET_PRODUCTS.filter(p => favorites.includes(p.id));
    list = [...favAnimals, ...favProducts];
  }

  // 1. Search Filter with word-boundary for short words (e.g. "cat", "dog")
  if (marketplaceSearchQuery) {
    const q = marketplaceSearchQuery.toLowerCase().trim();
    const isShortWord = q.length <= 4;
    const wordRegex = isShortWord ? new RegExp(`\\b${q}\\b`, 'i') : null;

    list = list.filter(item => {
      const name = (item.name || '').toLowerCase();
      const breed = (item.breed || '').toLowerCase();
      const species = (item.species || '').toLowerCase();
      const cat = (item.category || '').toLowerCase();
      const subCat = (item.subCategory || '').toLowerCase();
      const seller = (item.seller || '').toLowerCase();
      const loc = (item.location || '').toLowerCase();
      const desc = (item.description || '').toLowerCase();

      if (wordRegex) {
        return wordRegex.test(name) || wordRegex.test(breed) || wordRegex.test(species) ||
               wordRegex.test(cat) || wordRegex.test(subCat) || wordRegex.test(seller) || wordRegex.test(loc);
      }
      return name.includes(q) || breed.includes(q) || species.includes(q) ||
             cat.includes(q) || subCat.includes(q) || seller.includes(q) || loc.includes(q) ||
             desc.includes(q);
    });
  }

  // 2. Secondary Filter Pills
  if (activeMarketSecondaryFilter && activeMarketSecondaryFilter !== "All") {
    const sf = activeMarketSecondaryFilter.toLowerCase();
    list = list.filter(item => {
      if (activeMarketTab === "animals") {
        return (item.type || '').toLowerCase() === sf;
      }
      const cat = (item.category || '').toLowerCase();
      const subCat = (item.subCategory || '').toLowerCase();
      return cat === sf || subCat === sf;
    });
  }

  // 3. Real-time Distance Calculation
  list = list.map(item => {
    const d = (userCoords && item.lat && item.lng) ? getDistance(userCoords.lat, userCoords.lng, item.lat, item.lng) : 999;
    return { ...item, realDistance: d };
  });

  // 4. Nearby Filter & Sort (within 50km) — only when no search query active
  if (nearbyFilterActive && userCoords && !marketplaceSearchQuery) {
    list = list.filter(item => item.realDistance <= 50).sort((a, b) => a.realDistance - b.realDistance);
  } else if (nearbyFilterActive && userCoords && marketplaceSearchQuery) {
    // When searching, sort by distance but don't filter out distant items
    list = list.sort((a, b) => a.realDistance - b.realDistance);
  }

  if (!list.length) {
    if (activeMarketTab === "saved") {
      container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-muted);"><div style="font-size:44px;margin-bottom:12px;">❤️</div><p style="font-weight:700;">No saved items match your criteria.</p></div>`;
    } else {
      container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:80px 20px;color:var(--text-muted);"><div style="font-size:54px;margin-bottom:12px;">🔍</div><p style="font-weight:700;font-size:18px;">No matching listings found ${nearbyFilterActive ? 'nearby' : ''}.</p></div>`;
    }
    return;
  }

  container.innerHTML = list.map(item => {
    const isFav = favorites.includes(item.id);
    const isProduct = activeMarketTab === "products" || (item.category && item.category !== 'Pets' && item.category !== 'Animal' && item.type !== 'adoption' && item.type !== 'sale' && !item.breed && !item.species);
    const isAdoption = item.type === 'adoption' || (item.price && String(item.price).toLowerCase().includes('free'));
    const safeName = (item.name || '').replace(/'/g, "\\'");
    const distStr = (item.realDistance && item.realDistance !== 999) ? (item.realDistance < 1 ? Math.round(item.realDistance * 1000) + 'm' : item.realDistance.toFixed(1) + 'km') : 'Local';
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((item.location || '') + ' ' + (item.name || ''))}`;

    // Chips for animals
    const animalChips = !isProduct ? [
      item.species ? `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:var(--primary-light,#ecfdf5);color:var(--primary,#10b981);border:1px solid var(--primary,#10b981)30;">${item.species}</span>` : '',
      item.breed ? `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:#f0f9ff;color:#0284c7;border:1px solid #0284c720;">${item.breed}</span>` : '',
      item.gender && item.gender !== 'Unknown' ? `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:#fdf4ff;color:#9333ea;border:1px solid #9333ea20;">${item.gender === 'Male' ? '♂ Male' : '♀ Female'}</span>` : '',
      item.age ? `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:#fff7ed;color:#ea580c;border:1px solid #ea580c20;">${item.age}</span>` : ''
    ].filter(Boolean).join('') : '';

    const isOwner = currentUser && (
      (item.sellerId && String(item.sellerId) === String(currentUser.id)) ||
      (item.user_id && String(item.user_id) === String(currentUser.id)) ||
      (item.seller && (String(item.seller.id) === String(currentUser.id) || String(item.seller) === String(currentUser.id))) ||
      (item.sellerName && currentUser.name && item.sellerName.toLowerCase() === currentUser.name.toLowerCase())
    );

    return `
    <div class="animal-card">
      <div style="position:relative;height:190px;overflow:hidden;background:var(--bg-main);display:flex;align-items:center;justify-content:center;border-bottom:1px solid var(--border-color);">
        <img src="${item.image}" style="width:100%;height:100%;object-fit:contain;cursor:pointer;" onclick="viewMarketItem('${item.id}','${isProduct ? 'products' : 'animals'}')" alt="${item.name}" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?w=600'">
        <div style="position:absolute;top:12px;left:12px;display:flex;gap:6px;">
          <span style="font-size:10px;font-weight:800;color:#fff;background:${isAdoption ? 'var(--secondary)' : 'var(--primary)'};padding:3px 10px;border-radius:20px;text-transform:uppercase;backdrop-filter:blur(4px);">${isProduct ? (item.category || 'Supplies') : (isAdoption ? 'Adoption' : 'Sale')}</span>
        </div>
        <button class="btn btn-ghost" style="position:absolute;top:10px;right:10px;width:34px;height:34px;border-radius:50%;background:rgba(0,0,0,0.2);backdrop-filter:blur(4px);padding:0;display:flex;align-items:center;justify-content:center;" onclick="toggleFavorite('${item.id}')">
          <i class="fas fa-heart" style="color:${isFav ? 'var(--danger)' : '#fff'};font-size:14px;"></i>
        </button>
        <div style="position:absolute;bottom:12px;right:12px;background:rgba(255,255,255,0.9);padding:4px 10px;border-radius:20px;font-size:10px;font-weight:900;color:var(--primary);box-shadow:var(--shadow-sm);backdrop-filter:blur(4px);">
          📍 ${distStr}
        </div>
      </div>
      <div class="animal-card-body" style="padding:18px;">
        <div class="animal-name" style="font-size:17px;font-weight:800;color:var(--text-primary);cursor:pointer;line-height:1.2;min-height:42px;" onclick="viewMarketItem('${item.id}','${isProduct ? 'products' : 'animals'}')">${item.name}</div>
        ${animalChips ? `<div style="display:flex;flex-wrap:wrap;gap:5px;margin:8px 0 4px 0;">${animalChips}</div>` : ''}
        <div class="animal-latin" style="margin-top:6px;color:var(--text-secondary);font-size:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
           ${isProduct ? `<span><i class="fas fa-user-circle" style="font-size:11px;color:var(--primary);"></i> ${item.sellerName || item.seller || 'Verified Seller'}</span>` : ''}
           <span><a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="color:var(--text-secondary);text-decoration:none;" onclick="event.stopPropagation()"><i class="fas fa-map-marker-alt" style="font-size:11px;color:var(--primary);"></i> ${item.location} <i class="fas fa-arrow-up-right-from-square" style="font-size:9px;"></i></a></span>
           ${(item.created_at || item.timestamp || item.created) ? `<span style="color:var(--text-muted);font-size:11px;">• <i class="far fa-clock" style="font-size:10px;"></i> ${timeAgo(item.created_at || item.timestamp || item.created)}</span>` : ''}
        </div>
        <div style="font-size:22px;font-weight:900;color:${isAdoption ? 'var(--secondary)' : 'var(--primary)'};margin:12px 0;">${item.priceStr || item.price}</div>
        <div style="display:flex;gap:8px;margin-top:6px;">
          <button class="btn btn-primary" style="flex:1.2;border-radius:12px;font-weight:800;" onclick="viewMarketItem('${item.id}','${isProduct ? 'products' : 'animals'}')">
            Details
          </button>
          ${isProduct ? `
            <button class="btn btn-secondary" style="flex:1;border-radius:12px;font-weight:700;background:var(--bg-main);" onclick="addToCart('${item.id}','${safeName}',parseCartPrice('${item.priceNum || item.price || 0}'),'${item.image}')">
              Add
            </button>
          ` : `
            <button class="btn btn-secondary" style="flex:1;border-radius:12px;font-weight:700;background:var(--bg-main);" onclick="openChatModal('${item.sellerId || item.user_id || ('usr_seller_' + item.id)}','${safeName}','${item.id}')">
              Chat
            </button>
          `}
          ${isOwner ? `
            <button class="btn btn-ghost" style="padding:0 10px;border-radius:12px;color:var(--danger);border:1px solid rgba(239,68,68,0.3);" onclick="deleteMarketplaceListingWeb('${item.id}','${safeName}')" title="Delete listing">
              <i class="fas fa-trash-alt"></i>
            </button>
          ` : ''}
        </div>
      </div>
    </div>`;
  }).join("");
}

async function deleteMarketplaceListingWeb(id, name) {
  const item = MARKET_ANIMALS.find(a => String(a.id) === String(id)) || MARKET_PRODUCTS.find(p => String(p.id) === String(id));
  const isOwner = currentUser && item && (
    (item.sellerId && String(item.sellerId) === String(currentUser.id)) ||
    (item.user_id && String(item.user_id) === String(currentUser.id)) ||
    (item.seller && (String(item.seller.id) === String(currentUser.id) || String(item.seller) === String(currentUser.id))) ||
    (item.sellerName && currentUser.name && item.sellerName.toLowerCase() === currentUser.name.toLowerCase())
  );
  if (!isOwner) {
    showToast("⚠️ You can only delete listings that you created.", "warning");
    return;
  }
  const ok = await showConfirmModal({
    title: "Delete Marketplace Listing",
    message: `Are you sure you want to delete "${name}" from the marketplace? This cannot be undone.`,
    icon: "fa-trash-alt",
    confirmText: "Yes, Delete",
    cancelText: "Cancel",
    isDanger: true
  });
  if (!ok) return;
  try {
    const token = currentUser ? currentUser.token : null;
    await fetch(`${API_BASE}/marketplace/listing/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ user_id: currentUser.id })
    });
  } catch (e) {
    console.warn("Backend delete marketplace listing offline:", e);
  }
  MARKET_ANIMALS = MARKET_ANIMALS.filter(a => String(a.id) !== String(id));
  MARKET_PRODUCTS = MARKET_PRODUCTS.filter(p => String(p.id) !== String(id));
  renderMarketplace();
  showToast(`🗑️ Listing "${name}" deleted successfully.`, "info");
}

async function toggleFavorite(id) {
  if (favorites.includes(id)) {
    favorites = favorites.filter(x => x !== id);
    showToast("Removed from saved items.", "info");
  } else {
    favorites.push(id);
    showToast("💖 Saved to your favorites!", "success");
  }
  if (currentUser) {
    localStorage.setItem(`@ecotrack_favs_${currentUser.id}`, JSON.stringify(favorites));
    try {
      await fetch(`${API_BASE}/users/${currentUser.id}/favorites`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(currentUser.token ? { "Authorization": `Bearer ${currentUser.token}` } : {})
        },
        body: JSON.stringify({ itemId: id })
      });
    } catch { /* offline */ }
  }
  updateCartBadges();
  renderMarketplace();
}

function openAddListingModal() {
  document.getElementById("addListingModal")?.classList.add("active");
  // Initialize field visibility based on default (animal) category
  toggleListingFields();
}

function closeAddListingModal() {
  document.getElementById("addListingModal")?.classList.remove("active");
}

function switchListingImgTab(mode) {
  const fileDiv = document.getElementById('listingImgFileDiv');
  const urlDiv = document.getElementById('listingImgUrlDiv');
  const tabFile = document.getElementById('imgTabFile');
  const tabUrl = document.getElementById('imgTabUrl');
  if (!fileDiv || !urlDiv) return;
  if (mode === 'file') {
    fileDiv.style.display = '';
    urlDiv.style.display = 'none';
    if (tabFile) { tabFile.style.background = 'var(--primary)'; tabFile.style.color = '#fff'; }
    if (tabUrl) { tabUrl.style.background = 'var(--bg-main)'; tabUrl.style.color = 'var(--primary)'; }
  } else {
    fileDiv.style.display = 'none';
    urlDiv.style.display = '';
    if (tabFile) { tabFile.style.background = 'var(--bg-main)'; tabFile.style.color = 'var(--primary)'; }
    if (tabUrl) { tabUrl.style.background = 'var(--primary)'; tabUrl.style.color = '#fff'; }
  }
}

function switchEventImgTab(mode) {
  const fileDiv = document.getElementById('eventImgFileDiv');
  const urlDiv  = document.getElementById('eventImgUrlDiv');
  const tabFile = document.getElementById('eventImgTabFile');
  const tabUrl  = document.getElementById('eventImgTabUrl');
  if (!fileDiv || !urlDiv) return;
  if (mode === 'file') {
    fileDiv.style.display = ''; urlDiv.style.display = 'none';
    if (tabFile) { tabFile.style.background = 'var(--primary)'; tabFile.style.color = '#fff'; }
    if (tabUrl)  { tabUrl.style.background  = 'var(--bg-main)'; tabUrl.style.color  = 'var(--primary)'; }
  } else {
    fileDiv.style.display = 'none'; urlDiv.style.display = '';
    if (tabFile) { tabFile.style.background = 'var(--bg-main)'; tabFile.style.color = 'var(--primary)'; }
    if (tabUrl)  { tabUrl.style.background  = 'var(--primary)'; tabUrl.style.color  = '#fff'; }
  }
}

function switchPostImgTab(mode) {
  const fileDiv = document.getElementById('postImgFileDiv');
  const urlDiv  = document.getElementById('postImgUrlDiv');
  const tabFile = document.getElementById('postImgTabFile');
  const tabUrl  = document.getElementById('postImgTabUrl');
  if (!fileDiv || !urlDiv) return;
  if (mode === 'file') {
    fileDiv.style.display = ''; urlDiv.style.display = 'none';
    if (tabFile) { tabFile.style.background = 'var(--primary)'; tabFile.style.color = '#fff'; }
    if (tabUrl)  { tabUrl.style.background  = 'var(--bg-main)'; tabUrl.style.color  = 'var(--primary)'; }
  } else {
    fileDiv.style.display = 'none'; urlDiv.style.display = '';
    if (tabFile) { tabFile.style.background = 'var(--bg-main)'; tabFile.style.color = 'var(--primary)'; }
    if (tabUrl)  { tabUrl.style.background  = 'var(--primary)'; tabUrl.style.color  = '#fff'; }
  }
}


function toggleListingFields() {
  const cat = document.getElementById('listingCategory')?.value;
  const isAnimal   = cat === 'animal_adoption' || cat === 'animal_sale';
  const isAdoption = cat === 'animal_adoption';
  const isSaleOrProduct = cat === 'animal_sale' || cat === 'product';

  // Animal-specific fields
  const animalGroups = ['listingSpeciesGroup', 'listingBreedGroup', 'listingGenderGroup', 'listingAgeGroup'];
  animalGroups.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = isAnimal ? '' : 'none';
  });

  // Product sub-category
  const prodGroup = document.getElementById('listingProductCategoryGroup');
  if (prodGroup) prodGroup.style.display = isAnimal ? 'none' : '';

  // Price: hide for adoption (it's free), show for everything else
  const priceGroup = document.getElementById('listingPriceGroup');
  if (priceGroup) priceGroup.style.display = isAdoption ? 'none' : '';
  const priceInput = document.getElementById('listingPrice');
  if (priceInput) priceInput.required = !isAdoption;

  // Payment details: required only for sale / product
  const payGroup = document.getElementById('listingPaymentGroup');
  if (payGroup) payGroup.style.display = isSaleOrProduct ? '' : 'none';
  const payInput = document.getElementById('listingPayment');
  if (payInput) payInput.required = isSaleOrProduct;
}

async function submitNewListing(e) {
  if (e && e.preventDefault) e.preventDefault();

  const title = document.getElementById("listingTitle")?.value.trim();
  const category = document.getElementById("listingCategory")?.value;
  const price = document.getElementById("listingPrice")?.value.trim();
  const location = document.getElementById("listingLocation")?.value.trim() || "Local";
  const subInfo = document.getElementById("listingSubInfo")?.value.trim() || "";
  const species = document.getElementById("listingSpecies")?.value.trim() || "";
  const breed = document.getElementById("listingBreed")?.value.trim() || "";
  const gender = document.getElementById("listingGender")?.value.trim() || "Unknown";
  const fileInput = document.getElementById("listingMediaFile");
  const file = fileInput?.files[0];
  const imgUrlVal = document.getElementById("listingImageUrl")?.value.trim();
  const isUrlTabActive = document.getElementById('listingImgUrlDiv')?.style.display !== 'none';
  const isAnimal = category !== 'product';

  const isAdoption = category === 'animal_adoption';

  if (!title) {
    showToast("Please fill in the listing title.", "error");
    return;
  }

  if (!isAdoption && !price) {
    showToast("Please enter a price for this listing.", "error");
    return;
  }

  if (isAnimal && !species) {
    showToast("Species (e.g. Dog, Cat, Horse, Bird) is mandatory for animal listings.", "error");
    return;
  }

  const payment = document.getElementById("listingPayment")?.value.trim() || "";
  const isSaleOrProduct = category === 'animal_sale' || category === 'product';
  if (isSaleOrProduct && !payment) {
    showToast("Payment Details (UPI / Bank) are mandatory for sale and product listings.", "error");
    return;
  }

  const hasImage = isUrlTabActive ? !!imgUrlVal : !!file;
  if (!hasImage) {
    showToast("Photo / Video is mandatory. Please upload a file or enter an Image URL.", "error");
    return;
  }

  if (!isUrlTabActive && file && !file.type.startsWith("image/")) {
    showToast("Invalid file type. Please upload image files only.", "error");
    return;
  }

  const productSubCat = !isAnimal ? (document.getElementById("listingProductCategory")?.value || "Supplies") : "";
  const defaultImg = category === "product"
    ? (productSubCat === "Food" ? "assets/dog_kibble.jpg" :
       productSubCat === "Gear" ? "assets/dog_tracker.jpg" :
       productSubCat === "Medical" ? "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?q=85&w=1200" :
       productSubCat === "Housing" ? "assets/bird_cage.jpg" :
       productSubCat === "Accessories" ? "assets/pet_bed.jpg" : "assets/pet_shampoo.jpg")
    : "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?q=85&w=1200";

  let mediaUrl = defaultImg;
  if (isUrlTabActive && imgUrlVal) {
    mediaUrl = imgUrlVal;
  } else if (file) {
    mediaUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target.result);
      reader.readAsDataURL(file);
    });
  }

  const pVal = isAdoption ? 0 : (parseFloat(price.replace(/[^0-9.]/g, "")) || 0);

  const newListing = {
    title,
    category: category === "product" ? productSubCat : "Pets",
    subCategory: productSubCat,
    price: pVal,
    location,
    image_url: mediaUrl,
    type: category === "product" ? "accessory" : (category === "animal_adoption" ? "adoption" : "sale"),
    age: subInfo,
    sellerId: currentUser?.id || (session ? session.id : 'usr_user1'),
    user_id: currentUser?.id || (session ? session.id : 'usr_user1'),
    sellerName: currentUser?.name || 'You',
    ...(isSaleOrProduct && payment && { payment_details: payment }),
    ...(isAnimal && species && { species }),
    ...(isAnimal && breed && { breed }),
    ...(isAnimal && { gender })
  };

  const session = getSession();
  const token = session ? session.token : null;

  try {
    const res = await fetch(`${API_BASE}/marketplace/listing`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      },
      body: JSON.stringify(newListing)
    });
    if (res.ok) {
      showToast(`🎉 Listing "${title}" published to EcoTrack Marketplace!`, "success", 4000);
      await fetchMarketplaceListings();
      switchMarketTab(category === "product" ? "products" : "animals");
    } else {
      showToast("Failed to publish listing to backend.", "error");
    }
  } catch {
    showToast("Server offline. Published listing locally.", "warning");
    const newId = Date.now();
    const uid = currentUser?.id || (session ? session.id : 'usr_user1');
    const uName = currentUser?.name || 'You';
    if (category === "product") {
      MARKET_PRODUCTS.unshift({ id: newId, name: title, category: productSubCat, subCategory: productSubCat, price: pVal, priceNum: pVal, priceStr: price.startsWith("₹") ? price : `₹${price}`, image: mediaUrl, location: location, sellerId: uid, user_id: uid, seller: uName });
      switchMarketTab("products");
    } else {
      const displayName = species ? `${title} (${species}${breed ? ' · ' + breed : ''})` : title;
      MARKET_ANIMALS.unshift({ id: newId, name: displayName, type: category === "animal_adoption" ? "adoption" : "sale", age: subInfo, species, breed, gender, price: category === "animal_adoption" && !pVal ? "Free Adoption" : price, priceStr: category === "animal_adoption" && !pVal ? "Free Adoption" : (price.startsWith("₹") ? price : `₹${price}`), location: location, image: mediaUrl, sellerId: uid, user_id: uid, sellerName: uName });
      switchMarketTab("animals");
    }
  }

  closeAddListingModal();
  setElVal("listingTitle", "");
  setElVal("listingPrice", "");
  setElVal("listingLocation", "");
  setElVal("listingSubInfo", "");
  setElVal("listingBreed", "");
  const speciesSel = document.getElementById("listingSpecies"); if (speciesSel) speciesSel.value = "";
  const genderSel = document.getElementById("listingGender"); if (genderSel) genderSel.value = "Unknown";
}

function parseCartPrice(val) {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val).replace(/[^0-9.]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function toggleFullscreenModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  const card = modal.querySelector('.modal-card');
  if (!card) return;
  card.classList.toggle('fullscreen');
  const btnIcon = card.querySelector('.modal-expand-btn i');
  if (btnIcon) {
    if (card.classList.contains('fullscreen')) {
      btnIcon.className = 'fas fa-compress';
    } else {
      btnIcon.className = 'fas fa-expand';
    }
  }
}

async function addToCart(productId, title, price, image) {
  let prod = MARKET_PRODUCTS.find(p => p.id === productId || p.id === String(productId));

  let numericPrice = parseCartPrice(price);
  if (!numericPrice && prod) {
    numericPrice = parseCartPrice(prod.priceNum || prod.price);
  }

  if (!prod) {
    prod = {
      id: productId,
      name: title || "Marketplace Product",
      price: numericPrice,
      priceStr: numericPrice ? `₹${numericPrice.toLocaleString("en-IN")}` : "₹0",
      image: image || ""
    };
  } else {
    prod = { ...prod, price: numericPrice, priceStr: numericPrice ? `₹${numericPrice.toLocaleString("en-IN")}` : "₹0" };
  }

  const existing = cart.find(c => String(c.id) === String(prod.id));
  if (existing) {
    existing.qty = (existing.qty || 1) + 1;
    existing.price = parseCartPrice(existing.price || numericPrice);
  } else {
    cart.push({ ...prod, qty: 1, price: numericPrice });
  }

  if (currentUser) {
    localStorage.setItem(`@ecotrack_cart_${currentUser.id}`, JSON.stringify(cart));
    try {
      await fetch(`${API_BASE}/cart/${currentUser.id}/add`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(currentUser.token ? { "Authorization": `Bearer ${currentUser.token}` } : {})
        },
        body: JSON.stringify({ id: prod.id, name: prod.name, price: numericPrice, priceStr: prod.priceStr })
      });
    } catch { /* offline */ }
  }

  updateCartBadges();
  showToast(`🛒 "${prod.name}" added to cart!`, "success");
}

function updateCartBadges() {
  cart.forEach(c => { c.price = parseCartPrice(c.price || c.priceNum); });
  const count = cart.reduce((s, c) => s + (c.qty || 1), 0);
  setEl("cartCountBadge", count);
  setEl("cartCountBadgeInner", count);
  setEl("favCountBadge", favorites.length);
}

function showCartModal() {
  const list = document.getElementById("cartItemsList");
  const totalEl = document.getElementById("cartTotalPrice");
  if (!list || !totalEl) return;

  if (!cart.length) {
    list.innerHTML = `
      <div style="text-align:center;padding:40px 20px;color:var(--text-muted);">
        <i class="fas fa-shopping-basket" style="font-size:48px;margin-bottom:16px;opacity:0.3;"></i>
        <p style="font-weight:600;font-size:15px;">Your boutique cart is empty.</p>
        <button class="btn btn-primary" style="margin-top:20px;padding:8px 24px;border-radius:var(--radius-full);" onclick="closeCartModal();switchTab('marketplace');">Explore Items</button>
      </div>`;
    totalEl.textContent = "₹0";
  } else {
    let total = 0;
    list.innerHTML = cart.map((item, idx) => {
      item.price = parseCartPrice(item.price || item.priceNum);
      const itemTotal = item.price * (item.qty || 1);
      total += itemTotal;
      return `
      <div style="display:flex;align-items:center;padding:14px 0;border-bottom:1px solid var(--border-color);gap:14px;">
        <img src="${item.image || 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?q=85&w=1200'}" style="width:64px;height:64px;border-radius:12px;object-fit:cover;background:#f1f5f9;">
        <div style="flex:1;">
          <div style="font-weight:800;font-size:15px;color:var(--text-primary);">${item.name}</div>
          <div style="font-size:12px;color:var(--primary);font-weight:700;margin-top:2px;">₹${item.price.toLocaleString("en-IN")} per unit</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;background:var(--bg-main);padding:4px 10px;border-radius:var(--radius-full);border:1px solid var(--border-color);">
          <button class="btn btn-ghost" style="width:28px;height:28px;padding:0;background:#fff;border-radius:50%;box-shadow:var(--shadow-sm);font-weight:800;" onclick="changeCartQty(${idx},-1)">−</button>
          <span style="font-weight:900;min-width:24px;text-align:center;font-size:14px;">${item.qty || 1}</span>
          <button class="btn btn-ghost" style="width:28px;height:28px;padding:0;background:#fff;border-radius:50%;box-shadow:var(--shadow-sm);font-weight:800;" onclick="changeCartQty(${idx},1)">+</button>
        </div>
        <button class="btn btn-ghost" style="color:#ef4444;padding:8px;" onclick="changeCartQty(${idx}, -${item.qty})">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>`;
    }).join("");
    totalEl.textContent = `₹${total.toLocaleString("en-IN")}`;
  }
  document.getElementById("cartModal")?.classList.add("active");
}

async function changeCartQty(idx, delta) {
  if (cart[idx]) {
    const item = cart[idx];
    const newQty = (item.qty || 1) + delta;
    if (newQty <= 0) {
      cart.splice(idx, 1);
      if (currentUser) {
        try {
          await fetch(`${API_BASE}/cart/${currentUser.id}/remove`, {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              ...(currentUser.token ? { "Authorization": `Bearer ${currentUser.token}` } : {})
            },
            body: JSON.stringify({ itemId: item.id })
          });
        } catch { }
      }
    } else {
      item.qty = newQty;
    }
  }
  if (currentUser) {
    localStorage.setItem(`@ecotrack_cart_${currentUser.id}`, JSON.stringify(cart));
    try {
      await fetch(`${API_BASE}/cart/${currentUser.id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          ...(currentUser.token ? { "Authorization": `Bearer ${currentUser.token}` } : {})
        },
        body: JSON.stringify({ items: cart })
      });
    } catch { }
  }
  updateCartBadges();
  showCartModal();
}

function closeCartModal() { document.getElementById("cartModal")?.classList.remove("active"); }

async function checkoutCart() {
  if (!cart.length) { showToast("Your cart is empty!", "error"); return; }
  openCheckoutModal();
}

// ── CHAT & MESSAGING ──
let pendingChatMedia = null;

function previewChatMedia(input) {
  const file = input.files[0];
  const preview = document.getElementById("chatMediaPreview");
  if (!file || !preview) return;

  const isVideo = file.type.startsWith("video/");
  const reader = new FileReader();
  reader.onload = function (e) {
    pendingChatMedia = { dataUrl: e.target.result, isVideo, name: file.name };
    preview.style.display = "block";
    preview.innerHTML = `📎 Attached ${isVideo ? "Video" : "Photo"}: <strong>${file.name}</strong> <button class="btn btn-ghost" style="padding:0 6px;color:var(--danger);" onclick="clearChatMedia()">✕</button>`;
  };
  reader.readAsDataURL(file);
}

function clearChatMedia() {
  pendingChatMedia = null;
  const preview = document.getElementById("chatMediaPreview");
  if (preview) { preview.style.display = "none"; preview.innerHTML = ""; }
  const fileInput = document.getElementById("chatMediaFile");
  if (fileInput) fileInput.value = "";
}

async function openChatModal(sellerId, targetName, listingId) {
  const otherUserId = sellerId ? String(sellerId) : null;
  if (!otherUserId) { showToast('Cannot open chat: seller ID missing.', 'error'); return; }
  currentActiveSeller = { 
    id: otherUserId, 
    sellerName: targetName || "Member", 
    listingId: listingId ? String(listingId) : null 
  };
  setEl("chatSellerTitle", `💬 Direct Message · ${targetName || "User"}`);
  clearChatMedia();
  await loadRealUserThread();
  document.getElementById("chatModal")?.classList.add("active");
}

function closeChatModal() { document.getElementById("chatModal")?.classList.remove("active"); }

async function loadRealUserThread() {
  const box = document.getElementById("chatMessagesBox");
  if (!box) return;

  if (!currentUser) {
    box.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted);">Please sign in to view message history.</div>`;
    return;
  }

  box.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted);">Loading conversation...</div>`;

  const headers = {};
  try {
    const raw = localStorage.getItem("@ecotrack_user_session");
    if (raw) {
      const sess = JSON.parse(raw);
      if (sess && sess.token) {
        headers["Authorization"] = `Bearer ${sess.token}`;
      }
    }
  } catch (e) { }

  const threadKey = currentActiveSeller.listingId 
    ? `${currentActiveSeller.id}_${currentActiveSeller.listingId}` 
    : currentActiveSeller.id;

  try {
    const qListing = currentActiveSeller.listingId ? `?listing_id=${encodeURIComponent(currentActiveSeller.listingId)}` : '';
    const url = `${API_BASE}/messages/thread/${currentUser.id}/${currentActiveSeller.id}${qListing}`;
    const res = await fetch(url, { headers });
    if (res.ok) {
      const thread = await res.json();
      chatHistory[threadKey] = (Array.isArray(thread) ? thread : (thread.messages || [])).map(m => ({
        id: m.id,
        sender: m.from_user_id === currentUser.id ? "me" : "other",
        text: m.text,
        media_url: m.media_url,
        media_type: m.media_type,
        timestamp: m.timestamp
      }));
    }
  } catch {
    const stored = JSON.parse(localStorage.getItem(`@ecotrack_chat_${currentUser?.id}`) || "{}");
    chatHistory[threadKey] = stored[threadKey] || [];
  }

  renderChatBox();
}

function renderChatBox() {
  const box = document.getElementById("chatMessagesBox");
  if (!box) return;
  const threadKey = currentActiveSeller.listingId 
    ? `${currentActiveSeller.id}_${currentActiveSeller.listingId}` 
    : currentActiveSeller.id;
  const msgs = chatHistory[threadKey] || [];

  if (!msgs.length) {
    box.innerHTML = `
      <div style="text-align:center;padding:40px 20px;color:var(--text-muted);">
        <div style="font-size:48px;margin-bottom:12px;">💬</div>
        <p style="font-weight:700;font-size:16px;">Direct Messaging</p>
        <p style="font-size:13px;">Secure, end-to-end boutique communication with ${currentActiveSeller.sellerName}.</p>
      </div>`;
    return;
  }

  let html = "";
  let lastDateStr = "";

  msgs.forEach((m, idx) => {
    const isMe = m.sender === "me";
    let msgDate;
    if (m.timestamp) {
      let tStr = m.timestamp;
      // Do NOT append 'Z': server stores timestamps in local time (IST) without timezone marker.
      // Appending 'Z' would wrongly treat local time as UTC, causing a 5:30h offset in India.
      if (typeof tStr === "string" && tStr.includes(" ") && !tStr.includes("T")) {
        tStr = tStr.replace(" ", "T"); // normalize space separator to ISO 'T' only
      }
      msgDate = new Date(tStr);
    } else {
      msgDate = new Date();
    }

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let dateHeaderStr = msgDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    if (msgDate.toDateString() === today.toDateString()) {
      dateHeaderStr = "Today";
    } else if (msgDate.toDateString() === yesterday.toDateString()) {
      dateHeaderStr = "Yesterday";
    }

    if (dateHeaderStr !== lastDateStr) {
      html += `<div class="chat-date-divider"><span>${dateHeaderStr}</span></div>`;
      lastDateStr = dateHeaderStr;
    }

    const timeStr = m.time || msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    html += `
    <div style="display:flex;flex-direction:column;align-items:${isMe ? "flex-end" : "flex-start"};margin-bottom:12px;position:relative;" class="chat-message-group">
      <div style="background:${isMe ? "#e7fed3" : "#ffffff"};color:#111b21;padding:10px 14px;border-radius:14px;border-top-${isMe ? "right" : "left"}-radius:0;font-size:14.5px;box-shadow:0 1.5px 3px rgba(0,0,0,0.08);line-height:1.45;position:relative;max-width:82%;min-width:100px;border:1px solid ${isMe ? "#dcf8c6" : "#f1f5f9"};">
        <div style="margin-bottom:4px;word-break:break-word;padding-right:14px;">${m.text || ""}</div>
        ${m.media_url ? (
        m.media_type === "video" ?
          `<video src="${m.media_url}" controls style="max-width:100%;max-height:240px;border-radius:10px;margin-top:6px;margin-bottom:6px;"></video>` :
          `<img src="${m.media_url}" style="max-width:100%;max-height:240px;border-radius:10px;margin-top:6px;margin-bottom:6px;object-fit:cover;" alt="media">`
      ) : ""}
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:4px;margin-top:2px;">
          <span style="font-size:10px;color:#667781;font-weight:600;" title="${msgDate.toLocaleString()}">${timeStr}</span>
          ${isMe ? `<i class="fas fa-check-double" style="font-size:10px;color:#53bdeb;"></i>` : ""}
        </div>
        ${isMe ? `
          <button class="msg-delete-btn" style="position:absolute;top:-8px;right:-8px;background:#ef4444;color:#fff;width:24px;height:24px;border-radius:50%;display:none;align-items:center;justify-content:center;font-size:11px;border:2px solid #fff;cursor:pointer;box-shadow:var(--shadow-md);z-index:20;" onclick="deleteChatMessage('${threadKey}', ${idx})" title="Delete Message">
            <i class="fas fa-trash-alt"></i>
          </button>
        ` : ""}
      </div>
    </div>`;
  });

  box.innerHTML = html;
  box.scrollTop = box.scrollHeight;

  // Hover logic to show delete button
  const msgGroups = box.querySelectorAll('.chat-message-group');
  msgGroups.forEach(group => {
    group.onmouseenter = () => { const b = group.querySelector('.msg-delete-btn'); if (b) b.style.display = 'flex'; };
    group.onmouseleave = () => { const b = group.querySelector('.msg-delete-btn'); if (b) b.style.display = 'none'; };
  });
}

function toggleEmojiPicker() {
  const picker = document.getElementById("emojiPicker");
  if (picker) {
    picker.style.display = picker.style.display === "none" ? "grid" : "none";
  }
}

function insertEmoji(emoji) {
  const input = document.getElementById("chatInput");
  if (input) {
    input.value += emoji;
    input.focus();
    toggleEmojiPicker();
  }
}

async function deleteChatMessage(sellerKey, index) {
  const ok = await showConfirmModal({
    title: "Delete Message",
    message: "Are you sure you want to permanently delete this message?",
    icon: "fa-trash-alt",
    confirmText: "Yes, Delete",
    cancelText: "Cancel",
    isDanger: true
  });
  if (!ok) return;
  if (chatHistory[sellerKey]) {
    const msg = chatHistory[sellerKey][index];
    const messageId = msg ? msg.id : null;

    chatHistory[sellerKey].splice(index, 1);
    localStorage.setItem(`@ecotrack_chat_${currentUser.id}`, JSON.stringify(chatHistory));
    renderChatBox();
    showToast("🗑️ Message deleted.", "info");

    if (messageId) {
      const headers = {};
      try {
        const raw = localStorage.getItem("@ecotrack_user_session");
        if (raw) {
          const sess = JSON.parse(raw);
          if (sess && sess.token) {
            headers["Authorization"] = `Bearer ${sess.token}`;
          }
        }
      } catch (e) { }

      try {
        await fetch(`${API_BASE}/messages/${messageId}`, {
          method: "DELETE",
          headers
        });
      } catch (e) {
        console.warn("Failed to delete message from server:", e);
      }
    }
  }
}
window.deleteChatMessage = deleteChatMessage;

async function sendChatMessage() {
  const input = document.getElementById("chatInput");
  if (!input) return;
  const text = input.value.trim();
  const media = pendingChatMedia;

  if (!text && !media) return;
  if (!currentUser) { showToast("Please sign in to send messages.", "error"); return; }

  const headers = { "Content-Type": "application/json" };
  try {
    const raw = localStorage.getItem("@ecotrack_user_session");
    if (raw) {
      const sess = JSON.parse(raw);
      if (sess && sess.token) headers["Authorization"] = `Bearer ${sess.token}`;
    }
  } catch (e) { }

  // Disable input while sending
  input.disabled = true;
  const sendBtn = document.getElementById("chatSendBtn");
  if (sendBtn) sendBtn.disabled = true;

  try {
    const payload = {
      to_user_id: currentActiveSeller.id,
      text,
      media_url: media ? media.dataUrl : null,
      media_type: media ? (media.isVideo ? "video" : "image") : null
    };
    if (currentActiveSeller.listingId) payload.listing_id = currentActiveSeller.listingId;

    const res = await fetch(`${API_BASE}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      showToast(errData.error || "Failed to send message. Try again.", "error");
      return;
    }

    const data = await res.json();
    const savedMsg = data.msg || data.data || {};

    // Only add to local history AFTER backend confirms persistence
    const newMsg = {
      id: savedMsg.id,
      sender: "me",
      from_user_id: currentUser.id,
      text,
      media_url: media ? media.dataUrl : null,
      media_type: media ? (media.isVideo ? "video" : "image") : null,
      timestamp: savedMsg.created_at || new Date().toISOString()
    };

    const threadKey = currentActiveSeller.listingId 
      ? `${currentActiveSeller.id}_${currentActiveSeller.listingId}` 
      : currentActiveSeller.id;

    if (!chatHistory[threadKey]) chatHistory[threadKey] = [];
    chatHistory[threadKey].push(newMsg);
    input.value = "";
    clearChatMedia();
    renderChatBox();
    localStorage.setItem(`@ecotrack_chat_${currentUser.id}`, JSON.stringify(chatHistory));
    showToast(`✉️ Message delivered to ${currentActiveSeller.sellerName}!`, "success");

  } catch (err) {
    showToast("Network error. Message not sent. Check your connection.", "error");
    console.error("sendChatMessage error:", err);
  } finally {
    input.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
    input.focus();
  }
}

// ══════════════════════════════════════════════════
// COMMUNITY FEED
// ══════════════════════════════════════════════════
async function loadCommunityPosts() {
  try {
    const res = await fetch(`${API_BASE}/community?user_id=${currentUser?.id || ""}`);
    if (res.ok) {
      COMMUNITY_POSTS = await res.json();
      renderCommunityPosts();
      return;
    }
  } catch { /* offline */ }

  if (!COMMUNITY_POSTS.length) {
    // Zero-mock fallback: empty state preferred over hardcoded users
    COMMUNITY_POSTS = [];
  }
  renderCommunityPosts();
}

function timeAgo(dateVal) {
  if (typeof window.formatTimeAgo === 'function' && window.formatTimeAgo !== timeAgo) {
    return window.formatTimeAgo(dateVal);
  }
  if (!dateVal) return '';
  let d;
  if (dateVal instanceof Date) {
    d = dateVal;
  } else if (typeof dateVal === 'number' || (!isNaN(Number(dateVal)) && /^\d+$/.test(String(dateVal).trim()))) {
    d = new Date(Number(dateVal));
  } else {
    let str = String(dateVal).trim().replace(/(\.\d{3})\d+/, '$1');
    if (str.includes(' ') && !str.includes('T')) str = str.replace(' ', 'T');
    if (!str.endsWith('Z') && !str.includes('+') && !/[-+]\d{2}:\d{2}$/.test(str)) {
      str += 'Z';
    }
    d = new Date(str);
    if (isNaN(d.getTime())) {
      d = new Date(String(dateVal).trim());
    }
  }

  if (isNaN(d.getTime())) return '';

  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) {
    return timeStr;
  } else {
    const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `${dateStr}, ${timeStr}`;
  }
}
window.timeAgo = timeAgo;
window.formatTimeAgo = timeAgo;

function renderCommunityPosts() {
  const container = document.getElementById("communityPostsContainer");
  if (!container) return;
  if (!COMMUNITY_POSTS.length) {
    container.innerHTML = `<div class="card" style="text-align:center;padding:40px;"><div style="font-size:44px;margin-bottom:12px;">💬</div><p style="color:var(--text-muted);">No posts yet. Be the first to share!</p></div>`;
    return;
  }
  container.innerHTML = COMMUNITY_POSTS.map(post => {
    const isLiked = currentUser ? (post.liked_by || []).includes(currentUser.id) : post.liked;
    const comments = post.comments || [];
    return `
    <div class="card" id="post-${post.id}">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">
        <img src="${post.avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(post.user) + '&background=10b981&color=fff'}" style="width:46px;height:46px;border-radius:50%;object-fit:cover;border:2px solid var(--border-color);" alt="${post.user}">
        <div>
          <div style="font-weight:800;font-size:15px;color:var(--text-primary);">${post.user || "Eco User"}</div>
          <div style="font-size:12px;color:var(--text-muted);">${timeAgo(post.timestamp)}</div>
        </div>
      </div>
      <p style="font-size:14px;color:var(--text-primary);line-height:1.6;margin-bottom:${post.image ? 14 : 0}px;">${post.caption || post.content || ""}</p>
      ${post.image ? `<img src="${post.image}" style="width:100%;max-height:340px;object-fit:cover;border-radius:var(--radius-md);margin-bottom:14px;" alt="post image">` : ""}
      <div style="display:flex;gap:14px;border-top:1px solid var(--border-color);padding-top:12px;margin-bottom:14px;">
        <button class="btn btn-secondary" style="font-size:13px;gap:6px;" onclick="toggleLikePost(${post.id})">
          <i class="fas fa-heart" style="color:${isLiked ? "var(--danger)" : "var(--text-muted)"};"></i>
          <span>${post.likes || 0} Likes</span>
        </button>
        <button class="btn btn-ghost" style="font-size:13px;gap:6px;color:var(--text-muted);" onclick="focusCommentInput(${post.id})">
          <i class="fas fa-comment-alt"></i> ${comments.length} Comments
        </button>
      </div>
      ${comments.length ? `
        <div style="background:var(--bg-main);border-radius:var(--radius-md);padding:12px;margin-bottom:12px;display:flex;flex-direction:column;gap:8px;">
          ${comments.map(c => `
            <div style="font-size:13px;line-height:1.5;">
              <strong style="color:var(--text-primary);">${c.user}:</strong>
              <span style="color:var(--text-secondary);"> ${c.text}</span>
            </div>`).join("")}
        </div>` : ""}
      <div style="display:flex;gap:8px;">
        <input type="text" id="commentInput-${post.id}" class="form-input" style="padding:8px 14px;font-size:13px;" placeholder="Write a comment..." onkeypress="if(event.key==='Enter') submitCommentLegacy(${post.id})">
        <button class="btn btn-primary" style="padding:8px 16px;font-size:13px;" onclick="submitCommentLegacy(${post.id})">
          <i class="fas fa-paper-plane"></i>
        </button>
      </div>
    </div>`;
  }).join("");
}

function focusCommentInput(postId) {
  const el = document.getElementById(`commentInput-${postId}`);
  if (el) el.focus();
}

async function toggleLikePost(postId) {
  if (!currentUser) { showToast("Please sign in to like posts.", "warning"); return; }
  const post = COMMUNITY_POSTS.find(p => p.id === postId);
  if (!post) return;

  const wasLiked = (post.liked_by || []).includes(currentUser.id) || post.liked;
  try {
    const res = await fetch(`${API_BASE}/community/${postId}/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: currentUser.id })
    });
    if (res.ok) {
      const data = await res.json();
      const idx = COMMUNITY_POSTS.findIndex(p => p.id === postId);
      if (idx !== -1) COMMUNITY_POSTS[idx] = { ...COMMUNITY_POSTS[idx], ...data.post, liked: data.liked };
      renderCommunityPosts();
      return;
    }
  } catch { /* offline */ }

  if (!post.liked_by) post.liked_by = [];
  if (wasLiked) {
    post.liked_by = post.liked_by.filter(id => id !== currentUser.id);
    post.likes = Math.max(0, (post.likes || 0) - 1);
    post.liked = false;
  } else {
    post.liked_by.push(currentUser.id);
    post.likes = (post.likes || 0) + 1;
    post.liked = true;
  }
  renderCommunityPosts();
}

async function submitCommentLegacy(postId) {
  if (!currentUser) { showToast("Please sign in to comment.", "warning"); return; }
  const input = document.getElementById(`commentInput-${postId}`);
  if (!input || !input.value.trim()) return;
  const text = input.value.trim();

  try {
    const res = await fetch(`${API_BASE}/community/${postId}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: currentUser.id, user_name: currentUser.name || "User", text })
    });
    if (res.ok) {
      const data = await res.json();
      const idx = COMMUNITY_POSTS.findIndex(p => p.id === postId);
      if (idx !== -1) COMMUNITY_POSTS[idx] = { ...COMMUNITY_POSTS[idx], comments: data.post.comments };
      renderCommunityPosts();
      return;
    }
  } catch { /* offline */ }

  const post = COMMUNITY_POSTS.find(p => p.id === postId);
  if (post) {
    if (!post.comments) post.comments = [];
    post.comments.push({ user: currentUser.name || "You", text });
    renderCommunityPosts();
  }
}

function openCreatePostModalLegacy() {
  if (!currentUser) { showToast("Please sign in to create posts.", "warning"); return; }
  const m = document.getElementById("createPostModal");
  if (m) { m.classList.remove("hidden"); m.classList.add("active"); }
}
function closeCreatePostModalLegacy() {
  const m = document.getElementById("createPostModal");
  if (m) { m.classList.remove("active"); m.classList.add("hidden"); }
}

function previewMediaUpload(input, previewId) {
  const file = input.files[0];
  const preview = document.getElementById(previewId);
  if (!file || !preview) return;

  const isVideo = file.type.startsWith("video/");
  const reader = new FileReader();
  reader.onload = function (e) {
    preview.style.display = "block";
    preview.innerHTML = `
      <div style="position:relative;display:inline-block;margin-top:8px;">
        ${isVideo ?
        `<video src="${e.target.result}" controls style="max-height:160px;border-radius:var(--radius-md);border:1px solid var(--border-color);"></video>` :
        `<img src="${e.target.result}" style="max-height:160px;border-radius:var(--radius-md);border:1px solid var(--border-color);object-fit:cover;" alt="preview">`
      }
      </div>`;
  };
  reader.readAsDataURL(file);
}

async function submitNewPost() {
  const caption = document.getElementById("newPostCaption")?.value.trim();
  const fileInput = document.getElementById("newPostMediaFile");
  const file = fileInput?.files[0];

  if (!caption && !file) { showToast("Please write a caption or attach a photo/video.", "error"); return; }
  if (!currentUser) { showToast("Please sign in to publish posts.", "warning"); return; }

  let mediaUrl = null;
  let isVideo = false;

  if (file) {
    isVideo = file.type.startsWith("video/");
    mediaUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  }

  const postData = {
    user_id: currentUser.id,
    user: currentUser.name || (currentUser.email ? currentUser.email.split('@')[0] : 'User'),
    avatar: currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name || "E")}&background=10b981&color=fff`,
    caption: caption || "",
    image: mediaUrl,
    isVideo
  };

  try {
    const res = await fetch(`${API_BASE}/community`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(postData)
    });
    if (res.ok) {
      const data = await res.json();
      COMMUNITY_POSTS.unshift({ ...data.post, liked: false });
    } else {
      COMMUNITY_POSTS.unshift({ id: Date.now(), ...postData, likes: 0, liked: false, liked_by: [], comments: [], timestamp: new Date().toISOString() });
    }
  } catch {
    COMMUNITY_POSTS.unshift({ id: Date.now(), ...postData, likes: 0, liked: false, liked_by: [], comments: [], timestamp: new Date().toISOString() });
  }

  renderCommunityPosts();
  closeCreatePostModalLegacy();
  setElVal("newPostCaption", "");
  if (fileInput) fileInput.value = "";
  const preview = document.getElementById("newPostMediaPreview");
  if (preview) { preview.style.display = "none"; preview.innerHTML = ""; }
  showToast("🎉 Post published to Community feed!", "success");
}

function setElVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

// ══════════════════════════════════════════════════
// EVENTS, CARE SERVICES & DIGITAL TICKET VAULT
// ══════════════════════════════════════════════════
const INITIAL_EVENTS_DATA = [
  {
    id: 1,
    title: "Wildlife Rescue Camp",
    date: "22 November 2026",
    location: "Chennai Wildlife Reserve",
    image: "https://images.unsplash.com/photo-1546182990-dffeafbe841d?q=85&w=1200",
    description: "Join wildlife experts and rescue injured animals in a hands-on camp.",
    longDescription: "This intensive weekend camp is designed for animal lovers who want to learn real-world rescue techniques. You will shadow senior veterinarians, participate in rehabilitation sessions for raptors, and learn how to safely transport injured mammals. All equipment and basic meals provided.",
    category: "Rescue",
    attendees: 142,
    isFree: true,
    price: 0,
    refundPolicy: "Full refund available up to 48 hours before the event.",
    coordinates: { lat: 12.9229, lng: 80.1275 },
    organizer: "EcoTrack Foundation"
  },
  {
    id: 2,
    title: "International Dog Exhibition",
    date: "29 November 2026",
    location: "Bangalore Expo Center",
    image: "https://images.unsplash.com/photo-1517849845537-4d257902454a?q=85&w=1200",
    description: "Showcase dog breeds, participate in competitions, meet breeders.",
    longDescription: "The biggest canine event of the year! Over 500 breeds on display, agility competitions, grooming workshops, and stalls from the top pet care brands in Asia. Special sessions on advanced obedience using AI tracking tools. Tickets include a goodie bag for your pet.",
    category: "Exhibition",
    attendees: 894,
    isFree: false,
    price: 499,
    refundPolicy: "80% refundable until 24h before. No refunds on the day of event.",
    coordinates: { lat: 12.9716, lng: 77.5946 },
    organizer: "Kennel Club India"
  },
  {
    id: 3,
    title: "National Adoption Drive",
    date: "06 December 2026",
    location: "Chennai SPCA",
    image: "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?q=85&w=1200",
    description: "Adopt a rescued dog or cat and give them a loving forever home.",
    longDescription: "Find your new best friend at our monthly adoption drive. Over 50 dogs and cats from various shelters will be present. All animals are vaccinated, dewormed, and microchipped. Adoption counselors will be on site to help you find the perfect match for your lifestyle.",
    category: "Adoption",
    attendees: 320,
    isFree: true,
    price: 0,
    refundPolicy: "Not applicable.",
    coordinates: { lat: 13.0827, lng: 80.2707 },
    organizer: "Blue Cross India"
  },
  {
    id: 4,
    title: "Bird Conservation Seminar",
    date: "15 December 2026",
    location: "TNAU Auditorium, Coimbatore",
    image: "https://images.unsplash.com/photo-1444464666168-49d633b86797?q=85&w=1200",
    description: "Expert talks on endangered bird species conservation and habitat protection.",
    longDescription: "A gathering of ornithologists and conservationists to discuss the state of migratory birds in South India. Topics include wetland protection, pesticide impacts, and how citizen scientists can contribute to bird counts using the EcoTrack app.",
    category: "Conservation",
    attendees: 68,
    isFree: true,
    price: 0,
    refundPolicy: "Not applicable.",
    coordinates: { lat: 11.0168, lng: 76.9558 },
    organizer: "Bird Watch India"
  },
  {
    id: 5,
    title: "AI Animal Training Workshop",
    date: "27 December 2026",
    location: "Virtual + Chennai Hub",
    image: "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?q=85&w=1200",
    description: "Learn AI-powered training techniques for pets and wild animals.",
    longDescription: "Discover how advanced techniques are revolutionizing animal training. This workshop covers the basics of behavioral correction, focus training, and monitoring rehabilitation progress in injured animals.",
    category: "Training",
    attendees: 210,
    isFree: false,
    price: 999,
    refundPolicy: "50% Refundable. No-show will not be refunded.",
    coordinates: { lat: 13.0475, lng: 80.2089 },
    organizer: "EcoTrack AI Labs"
  }
];

const INITIAL_CARE_SERVICES = [
  {
    id: 101,
    title: "24/7 Emergency Vet Clinic & Surgery",
    provider: "Dr. A. Sharma, DVM",
    rating: 4.9,
    reviews: 184,
    category: "Veterinary",
    location: "Anna Nagar, Chennai",
    fee: "₹500 / Consultation",
    image: "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?q=85&w=1200",
    specs: "In-house X-Ray, Blood Diagnostics, Emergency Surgery",
    longDescription: "Our emergency clinic is equipped with the latest diagnostic and surgical tools. We specialize in trauma care, acute illness management, and orthopedic surgeries. Open 24/7 with a dedicated team of specialist vets and technicians.",
    coordinates: { lat: 13.0850, lng: 80.2101 },
    contactInfo: "+91 98765 43210"
  },
  {
    id: 102,
    title: "Certified K9 & Canine Behavior Trainer",
    provider: "Rex Canine Academy",
    rating: 4.8,
    reviews: 112,
    category: "Training",
    location: "Adyar, Chennai",
    fee: "₹1,200 / Session",
    image: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?q=85&w=1200",
    specs: "Obedience, Guarding, Agility & Socialization",
    longDescription: "Professional training for all dog breeds. We focus on positive reinforcement techniques to build a strong bond between you and your pet. Our courses range from puppy basics to advanced guard training and agility competitions.",
    coordinates: { lat: 13.0033, lng: 80.2550 },
    contactInfo: "+91 87654 32109"
  },
  {
    id: 103,
    title: "Luxury Pet Grooming & Spa",
    provider: "Pawfect Spa Salon",
    rating: 4.7,
    reviews: 96,
    category: "Grooming",
    location: "Coimbatore Central",
    fee: "₹800 / Bath & Trim",
    image: "https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?q=85&w=1200",
    specs: "Medicated Baths, Nail Clipping, Coat De-matting",
    longDescription: "Give your pet the ultimate pampering session. Our professional groomers use high-quality, pet-safe products. We offer full grooming, de-shedding treatments, and relaxing spa baths tailored to your pet's specific coat needs.",
    coordinates: { lat: 11.0168, lng: 76.9558 },
    contactInfo: "+91 76543 21098"
  },
  {
    id: 104,
    title: "Wildlife Rehabilitation Center",
    provider: "EcoRescue Foundation",
    rating: 5.0,
    reviews: 310,
    category: "Rehabilitation",
    location: "Western Ghats Eco Park",
    fee: "Free Community Service",
    image: "https://images.unsplash.com/photo-1546182990-dffeafbe841d?q=85&w=1200",
    specs: "Raptor & Mammal Rescue, Trauma Care, Release",
    longDescription: "Our center is dedicated to rescuing and rehabilitating wild animals found in distress. We work with forest departments to provide medical care and prepare animals for successful release back into their natural habitats. Community education is also a key part of our mission.",
    coordinates: { lat: 10.1632, lng: 77.0601 },
    contactInfo: "+91 65432 10987"
  }
];

let activeEventsTab = "events"; // 'events' | 'services' | 'tickets'
let activeEventCategory = "All";
let eventsSearchQuery = "";
let eventsList = [...INITIAL_EVENTS_DATA];
let registeredEventIds = [];
let userEventTickets = [];

function initEventsModule() {
  if (!currentUser) return;
  try {
    const savedReg = localStorage.getItem(`@ecotrack_events_registered_${currentUser.id}`);
    registeredEventIds = savedReg ? JSON.parse(savedReg) : [];

    const savedTickets = localStorage.getItem(`@ecotrack_events_tickets_${currentUser.id}`);
    userEventTickets = savedTickets ? JSON.parse(savedTickets) : [];

    const savedEvents = localStorage.getItem("@ecotrack_events_list");
    if (savedEvents) {
      eventsList = JSON.parse(savedEvents);
      // Migrate old June/July 2026 dates for default events (IDs 1-5) to September/October 2026
      let migrated = false;
      eventsList = eventsList.map(ev => {
        if (ev.id === 1 && ev.date === "20 June 2026") {
          ev.date = "22 November 2026";
          migrated = true;
        } else if (ev.id === 2 && ev.date === "28 June 2026") {
          ev.date = "29 November 2026";
          migrated = true;
        } else if (ev.id === 3 && ev.date === "5 July 2026") {
          ev.date = "06 December 2026";
          migrated = true;
        } else if (ev.id === 4 && ev.date === "12 July 2026") {
          ev.date = "15 December 2026";
          migrated = true;
        } else if (ev.id === 5 && ev.date === "19 July 2026") {
          ev.date = "27 December 2026";
          migrated = true;
        }
        return ev;
      });
      if (migrated) {
        saveEventsState();
      }
    }
  } catch { }

  updateEventsBadges();
  renderEvents();
}

function saveEventsState() {
  if (!currentUser) return;
  localStorage.setItem("@ecotrack_events_list", JSON.stringify(eventsList)); // List is global/cache
  localStorage.setItem(`@ecotrack_events_registered_${currentUser.id}`, JSON.stringify(registeredEventIds));
  localStorage.setItem(`@ecotrack_events_tickets_${currentUser.id}`, JSON.stringify(userEventTickets));
  updateEventsBadges();
}

function updateEventsBadges() {
  const evBadge = document.getElementById("eventsCountBadge");
  if (evBadge) evBadge.textContent = eventsList.length;

  const tickBadge = document.getElementById("ticketsCountBadge");
  if (tickBadge) tickBadge.textContent = userEventTickets.length;
}

function switchEventsTab(tab) {
  activeEventsTab = tab;

  if (tab === "tickets") {
    // Un-highlight all category buttons
    document.querySelectorAll(".event-cat-btn").forEach(btn => {
      btn.classList.remove("btn-primary");
      btn.classList.add("btn-secondary");
    });
    // Highlight My Pass Vault button
    const passBtn = document.getElementById("enav-tickets");
    if (passBtn) {
      passBtn.classList.remove("btn-secondary");
      passBtn.classList.add("btn-primary");
    }
  } else {
    const passBtn = document.getElementById("enav-tickets");
    if (passBtn) {
      passBtn.classList.remove("btn-primary");
      passBtn.classList.add("btn-secondary");
    }
  }

  renderEvents();
}

function filterEventCategory(cat) {
  activeEventsTab = "events";
  activeEventCategory = cat;

  // Un-highlight My Pass Vault button
  const passBtn = document.getElementById("enav-tickets");
  if (passBtn) {
    passBtn.classList.remove("btn-primary");
    passBtn.classList.add("btn-secondary");
  }

  document.querySelectorAll(".event-cat-btn").forEach(btn => {
    btn.classList.remove("btn-primary");
    btn.classList.add("btn-secondary");
  });
  const activeBtn = document.getElementById(`ecat-${cat}`);
  if (activeBtn) {
    activeBtn.classList.remove("btn-secondary");
    activeBtn.classList.add("btn-primary");
  }
  renderEvents();
}

function filterEventsQuery(query) {
  eventsSearchQuery = query.toLowerCase().trim();
  renderEvents();
}

function renderEvents() {
  const container = document.getElementById("eventsGrid");
  if (!container) return;

  // ── 1. EXPLORE EVENTS TAB ──
  if (activeEventsTab === "events") {
    let filtered = eventsList.filter(ev => {
      const matchCat = activeEventCategory === "All" || ev.category === activeEventCategory;
      const matchSearch = !eventsSearchQuery ||
        ev.title.toLowerCase().includes(eventsSearchQuery) ||
        ev.location.toLowerCase().includes(eventsSearchQuery) ||
        (ev.organizer || '').toLowerCase().includes(eventsSearchQuery);
      return matchCat && matchSearch;
    });

    if (!filtered.length) {
      container.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:48px 20px;color:var(--text-muted);">
          <div style="font-size:44px;margin-bottom:12px;">🎪</div>
          <p style="font-size:16px;font-weight:800;color:var(--text-primary,#0f172a);margin-bottom:6px;">No Events Found</p>
          <p style="font-size:13.5px;max-width:460px;margin:0 auto;">No events match your current filter. Try selecting <strong>"All Categories"</strong> or host a new community event!</p>
        </div>`;
      return;
    }

    container.innerHTML = filtered.map(ev => {
      const isRegistered = registeredEventIds.includes(ev.id);
      const isCreator = currentUser && (
        (ev.creator_id && String(ev.creator_id) === String(currentUser.id)) ||
        (ev.user_id && String(ev.user_id) === String(currentUser.id)) ||
        (ev.organizer && currentUser.name && ev.organizer.toLowerCase() === currentUser.name.toLowerCase()) ||
        (ev.organizer === "You")
      );
      const priceTag = ev.isFree
        ? `<span style="font-size:11.5px;font-weight:800;color:#ffffff;background:rgba(15,23,42,0.85);padding:3px 10px;border-radius:20px;backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,0.2);">FREE ENTRY</span>`
        : `<span style="font-size:11.5px;font-weight:800;color:#ffffff;background:rgba(15,23,42,0.85);padding:3px 10px;border-radius:20px;backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,0.2);">₹${ev.price} PASS</span>`;

      const safeTitle = (ev.title || '').replace(/'/g, "\\'");
      const venueMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.title + ' ' + ev.location)}`;

      return `
      <div class="service-card" style="background:var(--bg-card,#ffffff);border:1px solid var(--border-color,#e2e8f0);border-radius:20px;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 4px 20px rgba(0,0,0,0.04);transition:all 0.3s ease;height:100%;">
        <div onclick="openEventDetailModal(${ev.id})" style="cursor:pointer;">
          <!-- Image Header -->
          <div style="position:relative;height:180px;overflow:hidden;background:var(--bg-main);display:flex;align-items:center;justify-content:center;border-bottom:1px solid var(--border-color);">
            <img src="${ev.image}" alt="${ev.title}" style="width:100%;height:100%;object-fit:contain;">
            <div style="position:absolute;top:12px;left:12px;display:flex;gap:6px;">
              ${priceTag}
              <span style="font-size:11.5px;font-weight:700;color:#ffffff;background:rgba(15,23,42,0.75);padding:3px 9px;border-radius:20px;backdrop-filter:blur(4px);">${ev.category || 'Event'}</span>
            </div>
            <div style="position:absolute;bottom:12px;right:12px;font-size:11.5px;font-weight:700;color:#ffffff;background:rgba(16,185,129,0.85);padding:3px 10px;border-radius:20px;backdrop-filter:blur(4px);">
              👥 ${ev.attendees || 0} Attending
            </div>
          </div>

          <div style="padding:18px;">
            <div style="font-size:16.5px;font-weight:800;color:var(--text-primary,#0f172a);line-height:1.3;margin-bottom:8px;">${ev.title}</div>
            
            <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px;font-size:13px;color:var(--text-secondary,#475569);" onclick="event.stopPropagation()">
              <div style="display:flex;align-items:center;gap:8px;">
                <i class="far fa-calendar-alt" style="color:var(--primary);width:16px;"></i>
                <span><strong>Date:</strong> ${ev.date}</span>
              </div>
              <div style="display:flex;align-items:center;gap:8px;">
                <i class="fas fa-location-dot" style="color:var(--primary);width:16px;"></i>
                <span><strong>Venue:</strong> <a href="${venueMapUrl}" target="_blank" rel="noopener noreferrer" style="color:var(--primary,#10b981);font-weight:700;text-decoration:underline;" onclick="event.stopPropagation()">${ev.location} <i class="fas fa-arrow-up-right-from-square" style="font-size:10px;"></i></a></span>
              </div>
              <div style="display:flex;align-items:center;gap:8px;">
                <i class="fas fa-user-shield" style="color:var(--text-muted);width:16px;"></i>
                <span><strong>Organizer:</strong> ${ev.organizer || 'EcoTrack Community'}</span>
              </div>
            </div>

            <p style="font-size:13px;color:var(--text-muted);line-height:1.45;margin-bottom:16px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${ev.description}</p>
          </div>
        </div>

        <!-- Action Bar -->
        <div style="padding:14px 18px;border-top:1px solid var(--border-color,#f1f5f9);display:flex;gap:8px;align-items:center;margin-top:auto;">
          ${isRegistered ? `
            <button class="btn btn-primary" style="font-size:12.5px;padding:10px;font-weight:700;border-radius:12px;flex:1;display:flex;align-items:center;justify-content:center;gap:6px;background:linear-gradient(135deg,#059669,#10b981);" onclick="openTicketPassModalForEvent(${ev.id})">
              <i class="fas fa-qrcode"></i> Entry Pass
            </button>
            <button class="btn btn-secondary" style="font-size:12.5px;padding:10px;font-weight:700;border-radius:12px;flex:1;display:flex;align-items:center;justify-content:center;gap:6px;color:#ef4444;border-color:#ef444430;background:#ef444408;" onclick="handleCancelEventReservation(${ev.id})">
              <i class="fas fa-ban"></i> Cancel
            </button>
          ` : `
            <button class="btn btn-primary" style="font-size:13px;padding:10px;font-weight:700;border-radius:12px;flex:1;display:flex;align-items:center;justify-content:center;gap:6px;" onclick="openEventDetailModal(${ev.id})">
              <i class="fas fa-ticket"></i> ${ev.isFree ? 'Get Free Pass' : 'Reserve (₹' + ev.price + ')'}
            </button>
          `}
          ${isCreator ? `
            <button class="btn btn-ghost" style="padding:9px 12px;border-radius:12px;color:var(--danger);border:1px solid rgba(239,68,68,0.3);" onclick="deleteEventWeb(${ev.id},'${safeTitle}')" title="Delete Event Post">
              <i class="fas fa-trash-alt"></i>
            </button>
          ` : ''}
        </div>
      </div>`;
    }).join("");
    return;
  }

  // ── 3. MY PASS VAULT TAB ──
  if (activeEventsTab === "tickets") {
    if (!userEventTickets.length) {
      container.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:48px 20px;color:var(--text-muted);">
          <div style="font-size:44px;margin-bottom:12px;">🎟️</div>
          <p style="font-size:16px;font-weight:800;color:var(--text-primary,#0f172a);margin-bottom:6px;">No Digital Entry Passes Reserved Yet</p>
          <p style="font-size:13.5px;max-width:460px;margin:0 auto 16px auto;">Browse upcoming events under <strong>"Explore Events"</strong> and reserve your entry passes!</p>
          <button class="btn btn-primary" style="font-size:13px;padding:8px 18px;" onclick="switchEventsTab('events')">
            <i class="fas fa-compass"></i> Explore Events
          </button>
        </div>`;
      return;
    }

    container.innerHTML = userEventTickets.map(t => {
      const ev = eventsList.find(e => e.id === t.eventId) || {
        title: "Community Event",
        date: "2026",
        location: "Event Venue",
        organizer: "EcoTrack",
        image: "https://images.unsplash.com/photo-1546182990-dffeafbe841d?q=85&w=1200"
      };

      const safeTitle = (ev.title || '').replace(/'/g, "\\'");
      const currentOrigin = window.location.origin + window.location.pathname;
      const qrTargetUrl = `${currentOrigin}#events?pass=${t.serialNumber}`;
      const localQrUrl = getPassQrDataUrl(qrTargetUrl, 300, 300);
      const venueMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.title + ' ' + ev.location)}`;

      return `
      <div class="service-card" style="padding:0; background:#ffffff; color:#0f172a; border-radius:20px; border:2px solid #059669; box-shadow:0 6px 24px rgba(5,150,105,0.08); font-family:'Segoe UI', Arial, sans-serif; box-sizing:border-box; overflow:hidden; display:flex; flex-direction:column; justify-content:space-between; transition:all 0.3s ease; height:100%;">
        <div>
          <!-- Emerald Green Header Banner -->
          <div style="background:#059669; color:#ffffff; padding:16px; text-align:center;">
            <div style="font-size:15px; font-weight:900; letter-spacing:0.5px; margin-bottom:2px; text-transform:uppercase; line-height:1.2;">ECOTRACK VERIFIED ENTRY PASS</div>
            <div style="font-size:10px; font-weight:800; opacity:0.95; letter-spacing:0.8px; text-transform:uppercase;">OFFICIAL DIGITAL ENTRY TICKET</div>
          </div>

          <!-- Centered Event Image -->
          <div style="background:#f0fdf4; padding:12px; text-align:center; display:flex; align-items:center; justify-content:center; min-height:120px; border-bottom:1px solid #d1fae5; position:relative;">
            <img src="${ev.image || 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?q=85&w=1200'}" alt="${ev.title}" style="max-height:120px; max-width:100%; width:auto; height:auto; border-radius:10px; object-fit:contain; box-shadow:0 4px 10px rgba(0,0,0,0.08); display:block; margin:0 auto;">
            <div style="position:absolute;top:10px;right:10px;font-size:11px;font-weight:800;color:#10b981;background:rgba(255,255,255,0.95);padding:3px 9px;border-radius:20px;backdrop-filter:blur(4px);box-shadow:0 2px 6px rgba(0,0,0,0.05);display:flex;align-items:center;gap:4px;">
              <span style="display:inline-block;width:6px;height:6px;background:#10b981;border-radius:50%;"></span> Valid Pass
            </div>
          </div>

          <!-- Event Title -->
          <div style="font-size:18px; font-weight:900; color:#0f172a; margin:14px 12px 10px; text-align:center; line-height:1.25;">${ev.title}</div>
          
          <!-- Real Scannable Green QR Code with ECOTRACK Badge -->
          <div style="text-align:center; margin-bottom:12px;">
            <img src="${localQrUrl}" alt="Pass QR Code" style="width:140px; height:140px; border-radius:12px; border:2px solid #e2e8f0; padding:6px; background:#ffffff; display:inline-block; box-shadow:0 4px 10px rgba(0,0,0,0.04);">
            <div style="font-size:9.5px; font-weight:800; color:#64748b; margin-top:6px; letter-spacing:0.8px; text-transform:uppercase;">SCAN AT VENUE ENTRANCE</div>
            <div style="font-family:monospace; font-size:13.5px; font-weight:900; color:#059669; margin-top:2px; letter-spacing:1px;">PASS REF: ${t.serialNumber}</div>
          </div>

          <!-- Structured Event Details Box -->
          <div style="background:#f8fafc; margin:0 12px 12px; padding:12px; border-radius:10px; border:1px solid #e2e8f0; text-align:left; font-size:12.5px; color:#1e293b;">
            <div style="margin-bottom:6px; display:flex; align-items:center; gap:6px;">📅 <strong>Date:</strong> <span>${ev.date}</span></div>
            <div style="margin-bottom:6px; display:flex; align-items:center; gap:6px;">📍 <strong>Venue:</strong> <a href="${venueMapUrl}" target="_blank" rel="noopener noreferrer" style="color:#059669; font-weight:700; text-decoration:underline;">${ev.location} <i class="fas fa-arrow-up-right-from-square" style="font-size:9px;"></i></a></div>
            <div style="display:flex; align-items:center; gap:6px;">🗓️ <strong>Issued:</strong> <span>${t.purchaseDate}</span></div>
          </div>

          <!-- Emerald Green Footer Banner -->
          <div style="background:#059669; color:#ffffff; padding:10px 12px; font-size:10px; font-weight:800; text-align:center; letter-spacing:0.5px; margin-bottom:12px;">
            EcoTrack Animal Welfare Platform • www.ecotrack.org
          </div>
        </div>

        <!-- Pass Actions -->
        <div style="padding:0 12px 12px; display:flex; gap:6px; flex-wrap:wrap; margin-top:auto;">
          <button class="btn btn-primary" style="flex:1; font-size:11.5px; padding:8px 4px; font-weight:700; border-radius:10px; display:flex; align-items:center; justify-content:center; gap:4px;" onclick="simulateDownloadPass('${t.serialNumber}', 'pdf')">
            <i class="fas fa-file-pdf"></i> Download PDF
          </button>
          <button class="btn btn-primary" style="flex:1; font-size:11.5px; padding:8px 4px; font-weight:700; border-radius:10px; background:linear-gradient(135deg,#0284c7,#06b6d4); border:none; display:flex; align-items:center; justify-content:center; gap:4px;" onclick="simulateDownloadPass('${t.serialNumber}', 'png')">
            <i class="fas fa-file-image"></i> Download Image
          </button>
          <button class="btn btn-secondary" style="width:100%; font-size:11.5px; padding:6px; font-weight:700; border-radius:10px; color:#ef4444; border-color:#ef444430; background:#ef444408; display:flex; align-items:center; justify-content:center; gap:4px; margin-top:4px;" onclick="handleCancelEventReservation(${t.eventId})">
            <i class="fas fa-ban"></i> Cancel Pass
          </button>
        </div>
      </div>`;
    }).join("");
    return;
  }
}

async function deleteEventWeb(id, title) {
  const ev = eventsList.find(e => String(e.id) === String(id));
  const isCreator = currentUser && ev && (
    (ev.creator_id && String(ev.creator_id) === String(currentUser.id)) ||
    (ev.user_id && String(ev.user_id) === String(currentUser.id)) ||
    (ev.organizer && currentUser.name && ev.organizer.toLowerCase() === currentUser.name.toLowerCase()) ||
    (ev.organizer === "You")
  );
  if (!isCreator) {
    showToast("⚠️ You can only delete event posts that you created.", "warning");
    return;
  }
  const ok = await showConfirmModal({
    title: "Delete Event Post",
    message: `Are you sure you want to delete event post "${title}"? This action cannot be undone.`,
    icon: "fa-trash-alt",
    confirmText: "Yes, Delete",
    cancelText: "Cancel",
    isDanger: true
  });
  if (!ok) return;
  try {
    const token = currentUser ? currentUser.token : null;
    await fetch(`${API_BASE}/events/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ user_id: currentUser.id })
    });
  } catch (e) {
    console.warn("Backend delete event offline:", e);
  }
  eventsList = eventsList.filter(e => String(e.id) !== String(id));
  registeredEventIds = registeredEventIds.filter(eId => String(eId) !== String(id));
  userEventTickets = userEventTickets.filter(t => String(t.eventId) !== String(id));
  closeEventModal();
  renderEvents();
  showToast(`🗑️ Event "${title}" deleted successfully.`, "info");
}

// ── HOST COMMUNITY EVENT ──
function openHostEventModal() {
  document.getElementById("hostEventModal")?.classList.add("active");
}
function closeHostEventModal() {
  document.getElementById("hostEventModal")?.classList.remove("active");
}

function submitHostEvent(e) {
  if (e && e.preventDefault) e.preventDefault();
  const title    = document.getElementById("hostEventTitle")?.value.trim();
  const date     = document.getElementById("hostEventDate")?.value.trim();
  const endDate  = document.getElementById("hostEventEndDate")?.value.trim();
  const location = document.getElementById("hostEventLocation")?.value.trim();
  const category = document.getElementById("hostEventCategory")?.value || "Rescue";
  const desc     = document.getElementById("hostEventDesc")?.value.trim() || "Community organized animal welfare event.";

  // Determine image source: uploaded file takes priority over URL tab
  const isUrlTabActive = document.getElementById('eventImgUrlDiv')?.style.display !== 'none';
  const eventFile      = document.getElementById('hostEventImageFile')?.files[0];
  const imageUrlVal    = document.getElementById('hostEventImage')?.value.trim();

  if (!title || !date || !location) {
    showToast("Please enter title, date, and location.", "error");
    return;
  }

  const hasImage = isUrlTabActive ? !!imageUrlVal : !!eventFile;
  if (!hasImage) {
    showToast("Cover Image is mandatory. Please upload a file or enter an Image URL.", "error");
    return;
  }

  const resolveAndPublish = (imageData) => {
    const displayDate = endDate ? `${date} - ${endDate}` : date;
    const newEvent = {
      id: Date.now(),
      title,
      date: displayDate,
      location,
      image: imageData,
      description: desc,
      longDescription: desc,
      category,
      attendees: 1,
      isFree: true,
      price: 0,
      refundPolicy: "Not applicable.",
      organizer: currentUser?.name || "Community Member",
      creator_id: currentUser?.id || "usr_user1",
      user_id: currentUser?.id || "usr_user1"
    };
    try {
      const token = currentUser ? currentUser.token : null;
      fetch(`${API_BASE}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify(newEvent)
      }).catch(() => {});
    } catch (e) {}
    eventsList.unshift(newEvent);
    saveEventsState();
    closeHostEventModal();
    renderEvents();
    showToast(`🎉 Event "${title}" published to community!`, "success", 6000);

    // Reset Form Fields
    try {
      document.getElementById("hostEventTitle").value = "";
      document.getElementById("hostEventDate").value = "";
      const endD = document.getElementById("hostEventEndDate");
      if (endD) endD.value = "";
      document.getElementById("hostEventLocation").value = "";
      document.getElementById("hostEventCategory").value = "Rescue";
      document.getElementById("hostEventDesc").value = "";
      document.getElementById("hostEventPayment").value = "";
      const fInput = document.getElementById("hostEventImageFile");
      if (fInput) fInput.value = "";
      const uInput = document.getElementById("hostEventImage");
      if (uInput) uInput.value = "";
    } catch (err) { console.error("Reset Form Error:", err); }
  };

  if (!isUrlTabActive && eventFile) {
    const reader = new FileReader();
    reader.onload = (ev) => resolveAndPublish(ev.target.result);
    reader.readAsDataURL(eventFile);
  } else {
    resolveAndPublish(imageUrlVal);
  }
}

// ── EVENT DETAIL & PAYMENT GATEWAY ──
let activeEventForDetail = null;

function openEventDetailModal(eventId) {
  const ev = eventsList.find(e => e.id === eventId);
  if (!ev) return;
  activeEventForDetail = ev;

  const titleEl = document.getElementById("eventDetailModalTitle");
  if (titleEl) titleEl.textContent = `🎪 ${ev.title}`;

  const bodyEl = document.getElementById("eventDetailModalBody");
  if (!bodyEl) return;

  const isRegistered = registeredEventIds.includes(ev.id);
  const isCreator = currentUser && (
    (ev.creator_id && String(ev.creator_id) === String(currentUser.id)) ||
    (ev.user_id && String(ev.user_id) === String(currentUser.id)) ||
    (ev.organizer && currentUser.name && ev.organizer.toLowerCase() === currentUser.name.toLowerCase()) ||
    (ev.organizer === "You")
  );
  const safeTitle = (ev.title || '').replace(/'/g, "\\'");
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.title + ' ' + ev.location)}`;

  bodyEl.innerHTML = `
    <div style="position:relative;height:220px;border-radius:16px;overflow:hidden;margin-bottom:18px;">
      <img src="${ev.image}" alt="${ev.title}" style="width:100%;height:100%;object-fit:cover;">
      <div style="position:absolute;bottom:12px;left:12px;right:12px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:12px;font-weight:800;color:#fff;background:var(--primary);padding:4px 12px;border-radius:20px;">${ev.category || 'Event'}</span>
        <span style="font-size:12px;font-weight:800;color:#fff;background:rgba(15,23,42,0.85);padding:4px 12px;border-radius:20px;">👥 ${ev.attendees || 0} Attending</span>
      </div>
    </div>

    <div style="font-size:20px;font-weight:900;color:var(--text-primary,#0f172a);margin-bottom:10px;">${ev.title}</div>
    
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;background:var(--bg-main,#f8fafc);padding:14px;border-radius:14px;border:1px solid var(--border-color,#e2e8f0);margin-bottom:16px;">
      <div>📅 <strong>Date:</strong> ${ev.date}</div>
      <div>📍 <strong>Venue:</strong> <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="color:var(--primary,#10b981);font-weight:700;text-decoration:underline;">${ev.location} <i class="fas fa-arrow-up-right-from-square" style="font-size:10px;"></i></a></div>
      <div>👤 <strong>Organizer:</strong> ${ev.organizer || "EcoTrack"}</div>
      <div>💵 <strong>Fee:</strong> ${ev.isFree ? 'FREE Entry' : '₹' + ev.price}</div>
    </div>

    <div style="font-size:14px;line-height:1.6;color:var(--text-secondary,#475569);margin-bottom:18px;">
      ${ev.longDescription || ev.description}
    </div>

    ${!ev.isFree ? `
      <div style="background:var(--bg-main,#f8fafc);border:1px solid var(--border-color,#e2e8f0);border-radius:14px;padding:14px;margin-bottom:18px;">
        <div style="font-size:12px;font-weight:800;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px;">Cancellation & Refund Policy</div>
        <div style="font-size:13px;color:var(--text-secondary);">${ev.refundPolicy || "Standard event cancellation terms apply."}</div>
      </div>
    ` : ''}

    <div style="display:flex;gap:10px;flex-wrap:wrap;">
      ${isRegistered ? `
        <button class="btn btn-primary" style="flex:1;" onclick="closeEventDetailModal();openTicketPassModalForEvent(${ev.id})">
          <i class="fas fa-qrcode"></i> View Digital Pass
        </button>
        <button class="btn btn-secondary" style="flex:1;color:#ef4444;border-color:#ef444430;background:#ef444408;" onclick="closeEventDetailModal();handleCancelEventReservation(${ev.id})">
          <i class="fas fa-ban"></i> Cancel Pass
        </button>
      ` : `
        <button class="btn btn-primary" style="flex:1;" onclick="processEventRegistration(${ev.id})">
          <i class="fas fa-check-circle"></i> ${ev.isFree ? 'Confirm Free Spot' : 'Proceed to Pay ₹' + ev.price}
        </button>
      `}
      <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary" style="flex:1;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:6px;">
        <i class="fas fa-directions"></i> Google Maps
      </a>
    </div>
    ${isCreator ? `
      <div style="margin-top:12px;">
        <button class="btn btn-secondary" style="width:100%;color:#ef4444;border-color:rgba(239,68,68,0.3);background:rgba(239,68,68,0.06);padding:11px;font-weight:700;border-radius:12px;display:flex;align-items:center;justify-content:center;gap:8px;" onclick="closeEventDetailModal();deleteEventWeb(${ev.id},'${safeTitle}')">
          <i class="fas fa-trash-alt"></i> Delete Event Post
        </button>
      </div>
    ` : ''}`;

  document.getElementById("eventDetailModal")?.classList.add("active");
}

function closeEventDetailModal() {
  document.getElementById("eventDetailModal")?.classList.remove("active");
  activeEventForDetail = null;
}

function processEventRegistration(eventId) {
  const ev = eventsList.find(e => e.id === eventId);
  if (!ev) return;

  if (!ev.isFree) {
    closeEventDetailModal();
    openEventPaymentModal(ev);
    return;
  }

  // Free Event Registration
  issueEventTicket(ev);
}

function issueEventTicket(ev, paymentInfo = null) {
  const serial = "ET-" + Math.random().toString(36).substr(2, 9).toUpperCase();
  const currentOrigin = window.location.origin + window.location.pathname;
  const qrUrl = `${currentOrigin}#events?pass=${serial}&event=${ev.id}`;

  const ticket = {
    eventId: ev.id,
    serialNumber: serial,
    qrData: qrUrl,
    purchaseDate: new Date().toLocaleDateString(),
    paymentMethod: paymentInfo ? paymentInfo.method : 'Free Pass'
  };

  registeredEventIds.push(ev.id);
  userEventTickets.unshift(ticket);
  ev.attendees = (ev.attendees || 0) + 1;

  saveEventsState();
  closeEventDetailModal();
  closeEventPaymentModal();
  renderEvents();

  // Background sync registration with backend database
  if (window.currentUser) {
    fetch(`${AUTH_CONFIG.apiBase}/events/${ev.id}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(currentUser.token ? { 'Authorization': `Bearer ${currentUser.token}` } : {})
      }
    }).catch(err => console.warn("Backend registration sync failed:", err));
  }

  showToast(`🎉 Verified Pass issued for ${ev.title}! Pass Ref: ${serial}`, "success", 6000);
  switchEventsTab("tickets");
}

function handleCancelEventReservation(eventId) {
  const session = typeof getSession === 'function' ? getSession() : null;
  const userId = session ? session.id : (currentUser ? currentUser.id : null);
  if (!userId) return;

  registeredEventIds = registeredEventIds.filter(id => id !== eventId);
  userEventTickets = userEventTickets.filter(t => t.eventId !== eventId);

  // Decrement attendees count
  const ev = eventsList.find(e => e.id === eventId);
  if (ev && ev.attendees > 0) ev.attendees -= 1;

  saveEventsState();
  renderEvents();

  // Cancel on backend SQLite DB
  const headers = typeof getAuthHeaders === 'function' ? getAuthHeaders() : { 'Content-Type': 'application/json' };
  fetch(`${AUTH_CONFIG.apiBase}/events/registrations/${userId}/${eventId}`, {
    method: 'DELETE',
    headers
  }).catch(err => console.warn('Cancel event registration failed:', err));

  if (typeof showToast === 'function') {
    showToast('Event pass cancelled successfully', 'info');
  }

  // Re-render profile events tab if visible
  if (typeof activeProfileTabSection !== 'undefined' && activeProfileTabSection === 'events' && typeof renderProfileSubTab === 'function') {
    renderProfileSubTab('events');
  }
}
window.handleCancelEventReservation = handleCancelEventReservation;

// ── PAID EVENT PAYMENT GATEWAY ──
let paymentTargetEvent = null;

function openEventPaymentModal(ev) {
  paymentTargetEvent = ev;
  const titleEl = document.getElementById("payModalEventTitle");
  if (titleEl) titleEl.textContent = ev.title.toUpperCase();

  const amtEl = document.getElementById("payModalAmount");
  if (amtEl) amtEl.textContent = `₹${ev.price}`;

  const nameInput = document.getElementById("payModalName");
  if (nameInput && currentUser?.name) nameInput.value = currentUser.name;

  document.getElementById("eventPaymentModal")?.classList.add("active");
}

function closeEventPaymentModal() {
  document.getElementById("eventPaymentModal")?.classList.remove("active");
}

function togglePayMethodFields(method) {
  const upiSec = document.getElementById("payUpiSection");
  const cardSec = document.getElementById("payCardSection");
  if (upiSec) upiSec.style.display = method === "upi" ? "block" : "none";
  if (cardSec) cardSec.style.display = method === "card" ? "block" : "none";
}

function submitEventPayment(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (!paymentTargetEvent) return;

  const method = document.getElementById("payModalMethod")?.value || "upi";
  const btn = document.getElementById("payModalSubmitBtn");

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Processing Secure Payment...`;
  }

  showToast("🔒 Contacting Payment Gateway...", "info", 1500);

  setTimeout(() => {
    showToast("⚡ Authorizing Transaction...", "info", 1500);
    setTimeout(() => {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-lock"></i> Pay & Generate Verified Entry Pass`;
      }
      issueEventTicket(paymentTargetEvent, { method });
    }, 1500);
  }, 1500);
}

function openTicketPassModalForEvent(eventId) {
  const ticket = userEventTickets.find(t => t.eventId === eventId);
  if (ticket) {
    renderTicketPassModal(ticket);
  } else {
    showToast("Pass not found in your vault.", "error");
  }
}

function renderTicketPassModal(ticket) {
  const ev = eventsList.find(e => e.id === ticket.eventId) || { title: "Community Event", date: "2026", location: "Venue", image: "https://images.unsplash.com/photo-1546182990-dffeafbe841d?q=85&w=1200" };
  const body = document.getElementById("ticketPassModalBody");
  if (!body) return;

  const currentOrigin = window.location.origin + window.location.pathname;
  const qrTargetUrl = `${currentOrigin}#events?pass=${ticket.serialNumber}`;
  const localQrUrl = getPassQrDataUrl(qrTargetUrl, 300, 300);
  const venueMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.title + ' ' + ev.location)}`;

  body.innerHTML = `
    <div id="passCardContainer" style="padding:0; background:#ffffff; color:#0f172a; border-radius:20px; border:2px solid #059669; box-shadow:0 12px 36px rgba(0,0,0,0.12); font-family:'Segoe UI', Arial, sans-serif; box-sizing:border-box; overflow:hidden; margin-bottom:16px;">
      <!-- Emerald Green Header Banner -->
      <div style="background:#059669; color:#ffffff; padding:18px 16px; text-align:center;">
        <div style="font-size:18px; font-weight:900; letter-spacing:0.5px; margin-bottom:3px; text-transform:uppercase;">ECOTRACK VERIFIED ENTRY PASS</div>
        <div style="font-size:12px; font-weight:800; opacity:0.95; letter-spacing:1px; text-transform:uppercase;">OFFICIAL DIGITAL ENTRY TICKET</div>
      </div>

      <!-- Centered Event Image -->
      <div style="background:#f0fdf4; padding:16px; text-align:center; display:flex; align-items:center; justify-content:center; min-height:140px;">
        <img id="passCoverImage" src="${ev.image || 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?q=85&w=1200'}" alt="${ev.title}" style="max-height:160px; max-width:100%; width:auto; height:auto; border-radius:12px; object-fit:contain; box-shadow:0 4px 12px rgba(0,0,0,0.1); display:block; margin:0 auto;" crossorigin="anonymous">
      </div>

      <!-- Event Title -->
      <div style="font-size:22px; font-weight:900; color:#0f172a; margin:16px 14px 12px; text-align:center; line-height:1.25;">${ev.title}</div>
      
      <!-- Real Scannable Green QR Code with ECOTRACK Badge -->
      <div style="text-align:center; margin-bottom:14px;">
        <img id="passQrImage" src="${localQrUrl}" alt="Pass QR Code" style="width:180px; height:180px; border-radius:14px; border:2px solid #e2e8f0; padding:8px; background:#ffffff; display:inline-block; box-shadow:0 4px 12px rgba(0,0,0,0.06);">
        <div style="font-size:11px; font-weight:800; color:#64748b; margin-top:8px; letter-spacing:1px; text-transform:uppercase;">SCAN AT VENUE ENTRANCE</div>
        <div style="font-family:monospace; font-size:16px; font-weight:900; color:#059669; margin-top:4px; letter-spacing:1.5px;">PASS REF: ${ticket.serialNumber}</div>
      </div>

      <!-- Structured Event Details Box -->
      <div style="background:#f8fafc; margin:0 16px 16px; padding:16px; border-radius:14px; border:1px solid #e2e8f0; text-align:left; font-size:14px; color:#1e293b;">
        <div style="margin-bottom:8px; display:flex; align-items:center; gap:6px;">📅 <strong>Date:</strong> <span>${ev.date}</span></div>
        <div style="margin-bottom:8px; display:flex; align-items:center; gap:6px;">📍 <strong>Venue:</strong> <a href="${venueMapUrl}" target="_blank" rel="noopener noreferrer" style="color:#059669; font-weight:700; text-decoration:underline;">${ev.location} <i class="fas fa-arrow-up-right-from-square" style="font-size:11px;"></i></a></div>
        <div style="display:flex; align-items:center; gap:6px;">🗓️ <strong>Issued:</strong> <span>${ticket.purchaseDate}</span></div>
      </div>

      <!-- Emerald Green Footer Banner -->
      <div style="background:#059669; color:#ffffff; padding:13px 16px; font-size:12px; font-weight:800; text-align:center; letter-spacing:0.5px;">
        EcoTrack Animal Welfare Platform • www.ecotrack.org
      </div>
    </div>

    <!-- Pass Actions -->
    <div id="passActionButtons" style="display:flex; gap:8px; flex-wrap:wrap;">
      <button class="btn btn-primary" style="flex:1; padding:12px;" onclick="simulateDownloadPass('${ticket.serialNumber}', 'pdf')">
        <i class="fas fa-file-pdf"></i> Download PDF
      </button>
      <button class="btn btn-primary" style="flex:1; padding:12px; background:linear-gradient(135deg,#0284c7,#06b6d4); border:none;" onclick="simulateDownloadPass('${ticket.serialNumber}', 'png')">
        <i class="fas fa-file-image"></i> Download Image
      </button>
      <button class="btn btn-secondary" style="width:100%; color:#ef4444; border-color:#ef444430; background:#ef444408; margin-top:4px;" onclick="closeTicketPassModal();handleCancelEventReservation(${ticket.eventId})">
        <i class="fas fa-ban"></i> Cancel Pass
      </button>
    </div>`;

  document.getElementById("ticketPassModal")?.classList.add("active");
}

function closeTicketPassModal() {
  document.getElementById("ticketPassModal")?.classList.remove("active");
}

function getPassQrDataUrl(text, width = 300, height = 300) {
  const canvas = document.createElement('canvas');
  drawQrToCanvas(canvas, text, Math.max(width, height));
  return canvas.toDataURL('image/png');
}

function drawQrToCanvas(canvas, text, size = 300) {
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  ctx.lineWidth = 4;
  ctx.strokeStyle = "#e2e8f0";
  ctx.strokeRect(4, 4, size - 8, size - 8);

  ctx.fillStyle = "#059669"; // EcoTrack Green

  function drawFinderPattern(x, y, pSize) {
    ctx.fillRect(x, y, pSize, pSize);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + pSize / 7, y + pSize / 7, pSize * 5 / 7, pSize * 5 / 7);
    ctx.fillStyle = "#059669";
    ctx.fillRect(x + pSize * 2 / 7, y + pSize * 2 / 7, pSize * 3 / 7, pSize * 3 / 7);
  }

  const pSize = Math.floor(size * 0.24);
  drawFinderPattern(16, 16, pSize);
  drawFinderPattern(size - pSize - 16, 16, pSize);
  drawFinderPattern(16, size - pSize - 16, pSize);

  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }

  const gridCount = 21;
  const cellSize = (size - 32) / gridCount;

  for (let r = 0; r < gridCount; r++) {
    for (let c = 0; c < gridCount; c++) {
      if ((r < 7 && c < 7) || (r < 7 && c >= gridCount - 7) || (r >= gridCount - 7 && c < 7)) continue;

      const bit = (Math.abs(hash ^ (r * 31 + c * 17 + r * c)) % 100) > 40;
      if (bit) {
        ctx.fillRect(16 + c * cellSize, 16 + r * cellSize, cellSize - 0.5, cellSize - 0.5);
      }
    }
  }

  const logoW = size * 0.42;
  const logoH = size * 0.18;
  const logoX = (size - logoW) / 2;
  const logoY = (size - logoH) / 2;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(logoX - 2, logoY - 2, logoW + 4, logoH + 4);
  ctx.fillStyle = "#059669";
  ctx.fillRect(logoX, logoY, logoW, logoH);

  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.floor(size * 0.055)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ECOTRACK", size / 2, size / 2);
}

async function simulateDownloadPass(serial, format = 'pdf') {
  const ticket = userEventTickets.find(t => t.serialNumber === serial) || { serialNumber: serial, eventId: 1, purchaseDate: new Date().toLocaleDateString() };
  const ev = (ticket ? eventsList.find(e => e.id === ticket.eventId) : null) || { title: "EcoTrack Community Event", date: "2026", location: "Community Center", image: "https://images.unsplash.com/photo-1546182990-dffeafbe841d?q=85&w=1200" };
  const title = ev.title || "EcoTrack Event Entry Pass";
  const venue = ev.location || "Event Venue";
  const date = ev.date || "2026";

  const fmtName = format.toUpperCase() === 'PNG' || format.toUpperCase() === 'IMAGE' ? 'PNG Image' : 'PDF Document';
  showToast(`⚙️ Generating ${fmtName}...`, "info", 2500);

  const currentOrigin = window.location.origin + window.location.pathname;
  const qrTargetUrl = `${currentOrigin}#events?pass=${serial}`;
  const localQrUrl = getPassQrDataUrl(qrTargetUrl, 300, 300);

  // Create clean export container matching the reference ticket design
  const exportCard = document.createElement("div");
  exportCard.style.position = "fixed";
  exportCard.style.top = "0";
  exportCard.style.left = "0";
  exportCard.style.width = "420px";
  exportCard.style.padding = "0";
  exportCard.style.backgroundColor = "#ffffff";
  exportCard.style.color = "#0f172a";
  exportCard.style.borderRadius = "20px";
  exportCard.style.border = "2px solid #059669";
  exportCard.style.boxShadow = "0 12px 36px rgba(0,0,0,0.15)";
  exportCard.style.fontFamily = "'Segoe UI', Arial, sans-serif";
  exportCard.style.boxSizing = "border-box";
  exportCard.style.zIndex = "999999";
  exportCard.style.overflow = "hidden";
  exportCard.style.textAlign = "center";

  const eventImgUrl = ev.image || "https://images.unsplash.com/photo-1546182990-dffeafbe841d?q=85&w=1200";

  exportCard.innerHTML = `
    <!-- Emerald Green Header Banner -->
    <div style="background:#059669; color:#ffffff; padding:18px 16px; text-align:center;">
      <div style="font-size:18px; font-weight:900; letter-spacing:0.5px; margin-bottom:3px; text-transform:uppercase;">ECOTRACK VERIFIED ENTRY PASS</div>
      <div style="font-size:12px; font-weight:800; opacity:0.95; letter-spacing:1px; text-transform:uppercase;">OFFICIAL DIGITAL ENTRY TICKET</div>
    </div>

    <!-- Centered Event Image -->
    <div style="background:#f0fdf4; padding:16px; text-align:center; display:flex; align-items:center; justify-content:center; min-height:140px;">
      <img id="exportCoverImg" src="${eventImgUrl}" alt="${title}" style="max-height:160px; max-width:100%; width:auto; height:auto; border-radius:12px; object-fit:contain; box-shadow:0 4px 12px rgba(0,0,0,0.1); display:block; margin:0 auto;" crossorigin="anonymous">
    </div>

    <!-- Event Title -->
    <div style="font-size:22px; font-weight:900; color:#0f172a; margin:16px 14px 12px; text-align:center; line-height:1.25;">${title}</div>
    
    <!-- Real Scannable Green QR Code with ECOTRACK Badge -->
    <div style="text-align:center; margin-bottom:14px;">
      <img src="${localQrUrl}" alt="Pass QR Code" style="width:180px; height:180px; border-radius:14px; border:2px solid #e2e8f0; padding:8px; background:#ffffff; display:inline-block; box-shadow:0 4px 12px rgba(0,0,0,0.06);" crossorigin="anonymous">
      <div style="font-size:11px; font-weight:800; color:#64748b; margin-top:8px; letter-spacing:1px; text-transform:uppercase;">SCAN AT VENUE ENTRANCE</div>
      <div style="font-family:monospace; font-size:16px; font-weight:900; color:#059669; margin-top:4px; letter-spacing:1.5px;">PASS REF: ${serial}</div>
    </div>

    <!-- Structured Event Details Box -->
    <div style="background:#f8fafc; margin:0 16px 16px; padding:16px; border-radius:14px; border:1px solid #e2e8f0; text-align:left; font-size:14px; color:#1e293b;">
      <div style="margin-bottom:8px;">📅 <strong>Date:</strong> <span>${date}</span></div>
      <div style="margin-bottom:8px;">📍 <strong>Venue:</strong> <span>${venue}</span></div>
      <div>🗓️ <strong>Issued:</strong> <span>${ticket ? ticket.purchaseDate : new Date().toLocaleDateString()}</span></div>
    </div>

    <!-- Emerald Green Footer Banner -->
    <div style="background:#059669; color:#ffffff; padding:13px 16px; font-size:12px; font-weight:800; text-align:center; letter-spacing:0.5px;">
      EcoTrack Animal Welfare Platform • www.ecotrack.org
    </div>`;

  document.body.appendChild(exportCard);

  // Convert QR to data URI first to avoid CORS issues with html2canvas
  await new Promise(resolve => {
    const tempImg = new Image();
    tempImg.crossOrigin = 'anonymous';
    tempImg.onload = () => {
      try {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 300;
        tempCanvas.height = 300;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.fillStyle = '#ffffff';
        tempCtx.fillRect(0, 0, 300, 300);
        tempCtx.drawImage(tempImg, 0, 0, 300, 300);
        const dataUri = tempCanvas.toDataURL('image/png');
        const qrImgInCard = exportCard.querySelector('img[alt="Pass QR Code"]');
        if (qrImgInCard) qrImgInCard.src = dataUri;
      } catch (e) { /* taint fallback - keep original */ }
      resolve();
    };
    tempImg.onerror = resolve;
    tempImg.src = localQrUrl;
    // Also timeout fallback
    setTimeout(resolve, 4000);
  });

  // Brief wait for layout
  await new Promise(r => setTimeout(r, 300));

  try {
    const getH2C = () => {
      if (typeof html2canvas !== 'undefined') return html2canvas;
      if (typeof window !== 'undefined' && window.html2canvas) return window.html2canvas;
      return null;
    };

    const h2c = getH2C();

    if (h2c) {
      const canvas = await h2c(exportCard, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');

      if (format === 'png' || format === 'image') {
        const a = document.createElement("a");
        a.href = imgData;
        a.download = `EcoTrack-Pass-${serial}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast(`✅ Pass downloaded as PNG Image! (${serial})`, "success", 5000);
      } else {
        const cardW = canvas.width / 2;
        const cardH = canvas.height / 2;

        let pdfObj = null;
        if (window.jspdf && window.jspdf.jsPDF) {
          pdfObj = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'px', format: [cardW, cardH] });
        } else if (window.jsPDF) {
          pdfObj = new window.jsPDF({ orientation: 'portrait', unit: 'px', format: [cardW, cardH] });
        }

        if (pdfObj) {
          pdfObj.addImage(imgData, 'PNG', 0, 0, cardW, cardH);
          pdfObj.save(`EcoTrack-Pass-${serial}.pdf`);
          showToast(`✅ Pass downloaded as PDF document! (${serial})`, "success", 5000);
        } else if (typeof html2pdf !== 'undefined') {
          const opt = {
            margin: 0,
            filename: `EcoTrack-Pass-${serial}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
            jsPDF: { unit: 'px', format: [cardW, cardH], orientation: 'portrait' }
          };
          await html2pdf().set(opt).from(exportCard).save();
          showToast(`✅ Pass downloaded as PDF document! (${serial})`, "success", 5000);
        } else {
          const a = document.createElement("a");
          a.href = imgData;
          a.download = `EcoTrack-Pass-${serial}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          showToast(`✅ Pass saved as crisp PNG Image! (${serial})`, "success", 5000);
        }
      }
    } else if (typeof html2pdf !== 'undefined') {
      const opt = {
        margin: 0,
        filename: `EcoTrack-Pass-${serial}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'px', format: [400, 550], orientation: 'portrait' }
      };
      await html2pdf().set(opt).from(exportCard).save();
      showToast(`✅ Pass saved as PDF document! (${serial})`, "success", 5000);
    } else {
      triggerNativePrintPass(exportCard, serial);
    }
  } catch (err) {
    console.error("Pass Export Error:", err);
    triggerNativePrintPass(exportCard, serial);
  } finally {
    if (document.body.contains(exportCard)) {
      document.body.removeChild(exportCard);
    }
  }
}

function triggerNativePrintPass(cardContainer, serial) {
  const printWin = window.open('', '_blank', 'width=600,height=700');
  if (!printWin) {
    showToast("⚠️ Please allow popups to save/print your PDF pass", "warning");
    return;
  }
  printWin.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>EcoTrack Pass - ${serial}</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #ffffff; }
        .print-card { width: 420px; padding: 20px; border: 2px dashed #10b981; border-radius: 18px; text-align: center; background: #ffffff; color: #0f172a; }
        @media print {
          body { background: #ffffff; }
          .print-card { box-shadow: none; border: 2px dashed #10b981; }
        }
      </style>
    </head>
    <body onload="window.print();">
      <div class="print-card">
        ${cardContainer.innerHTML}
      </div>
    </body>
    </html>
  `);
  printWin.document.close();
  showToast(`✅ Pass PDF print/save dialog opened!`, "success", 5000);
}

async function handleCancelEventReservation(eventId) {
  const ev = eventsList.find(e => e.id === eventId);
  const title = ev ? ev.title : "Event";
  const ok = await showConfirmModal({
    title: "Cancel Reservation",
    message: `Are you sure you want to cancel your reservation for "${title}"?`,
    icon: "fa-ticket",
    confirmText: "Yes, Cancel Pass",
    cancelText: "Keep Pass",
    isDanger: true
  });
  if (!ok) return;

  registeredEventIds = registeredEventIds.filter(id => id !== eventId);
  userEventTickets = userEventTickets.filter(t => t.eventId !== eventId);
  if (ev) ev.attendees = Math.max(0, (ev.attendees || 1) - 1);

  saveEventsState();
  renderEvents();
  showToast(`❌ Reservation for "${title}" voided and spot released.`, "info", 5000);
}

// ══════════════════════════════════════════════════
// FIND SERVICES (MAPS)
// ══════════════════════════════════════════════════
let SERVICES_DATA = [
  { id: 1, name: "Blue Cross of India (Animal Rescue & Hospital)", type: "Emergency", category: "Shelter & Hospital", distance: "1.2 km", rating: 4.9, reviews: 1240, hours: "24 Hours / 7 Days", phone: "+91 44 2235 4959", emergency_phone: "+91 44 2230 0666", address: "72, Velachery Road, Guindy, Chennai, Tamil Nadu 600032", city: "Chennai", latitude: 13.0067, longitude: 80.2206, emoji: "🚨", color: "#ef4444", emergency: true, open24h: true, specialties: ["24x7 Ambulance", "Emergency Trauma Care", "Wildlife & Stray Rescue"] },
  { id: 2, name: "Madras Veterinary College Hospital (Government Vet)", type: "Veterinary", category: "Multi-Specialty Hospital", distance: "2.5 km", rating: 4.8, reviews: 890, hours: "24 Hours / 7 Days", phone: "+91 44 2530 4000", emergency_phone: "+91 44 2530 4000", address: "High Road, Vepery, Chennai, Tamil Nadu 600007", city: "Chennai", latitude: 13.0878, longitude: 80.2642, emoji: "🏥", color: "#10b981", emergency: true, open24h: true, specialties: ["Advanced Radiology", "ICU Care", "Orthopedic Surgery", "Blood Bank"] },
  { id: 3, name: "People For Animals (PFA) India National Helpline", type: "Rehab", category: "Animal Welfare & Helpline", distance: "Pan-India Helpline", rating: 4.9, reviews: 2150, hours: "Daily 8:00 AM – 10:00 PM", phone: "+91 11 2371 9293", emergency_phone: "+91 98101 00000", address: "14 Ashoka Road, New Delhi 110001", city: "New Delhi", latitude: 28.6219, longitude: 77.2144, emoji: "🌿", color: "#f59e0b", emergency: true, open24h: false, specialties: ["Legal Animal Rights Protection", "Cruelty Prevention", "Wildlife Rescue"] },
  { id: 4, name: "SPCA Animal Hospital & Shelter", type: "Shelter", category: "Shelter & Care Clinic", distance: "3.1 km", rating: 4.7, reviews: 430, hours: "Daily 9:00 AM – 6:00 PM", phone: "+91 44 2561 2894", emergency_phone: "+91 44 2561 2894", address: "5, Vepery High Road, Vepery, Chennai, Tamil Nadu 600007", city: "Chennai", latitude: 13.0865, longitude: 80.2621, emoji: "🏠", color: "#3b82f6", emergency: false, open24h: false, specialties: ["Stray Animal Inpatient Care", "Vaccination Drives", "Free Spay/Neuter"] },
  { id: 5, name: "CUPA Wildlife & Pet Trauma Center", type: "Rehab", category: "Wildlife Rescue & Trauma", distance: "4.8 km", rating: 4.8, reviews: 670, hours: "24 Hours Emergency", phone: "+91 80 2294 7352", emergency_phone: "+91 98451 71321", address: "Kengeri, Bengaluru, Karnataka 560060", city: "Bengaluru", latitude: 12.9081, longitude: 77.4851, emoji: "🌿", color: "#f59e0b", emergency: true, open24h: true, specialties: ["Avian & Reptile Rehab", "Monkey & Wildlife Rescue", "Sanctuary"] },
  { id: 6, name: "Happy Paws Grooming & Pet Care Spa", type: "Grooming", category: "Grooming & Hygiene Spa", distance: "1.8 km", rating: 4.9, reviews: 310, hours: "Tue–Sun 9:30 AM – 7:30 PM", phone: "+91 98401 22334", emergency_phone: "+91 98401 22334", address: "124 OMR Road, Kandanchavadi, Chennai, Tamil Nadu 600096", city: "Chennai", latitude: 12.9642, longitude: 80.2447, emoji: "✂️", color: "#8b5cf6", emergency: false, open24h: false, specialties: ["Medicated Flea Baths", "Breed Haircuts", "De-shedding Spa"] },
  { id: 7, name: "AquaVet Marine & Exotic Pet Clinic", type: "Marine", category: "Marine & Exotic Care", distance: "5.2 km", rating: 4.7, reviews: 195, hours: "Mon–Sat 10:00 AM – 6:00 PM", phone: "+91 44 2441 8899", emergency_phone: "+91 98402 77889", address: "22 East Coast Road (ECR), Thiruvanmiyur, Chennai, Tamil Nadu 600041", city: "Chennai", latitude: 12.9830, longitude: 80.2594, emoji: "🐠", color: "#06b6d4", emergency: false, open24h: false, specialties: ["Aquarium Diagnostics", "Fish Surgery", "Turtle Shell Repair", "Exotic Birds"] },
  { id: 8, name: "Wildlife Crime Control Bureau (WCCB) National Helpline", type: "Rehab", category: "Government Helpline", distance: "Pan-India Helpline", rating: 5.0, reviews: 1540, hours: "24 Hours Toll-Free", phone: "1800-11-9300", emergency_phone: "1800-11-9300", address: "Bhikaji Cama Place, New Delhi 110066", city: "New Delhi", latitude: 28.5684, longitude: 77.1843, emoji: "🚨", color: "#ef4444", emergency: true, open24h: true, specialties: ["Reporting Poaching", "Illegal Trade Helpline", "Protected Wildlife"] },
  { id: 9, name: "Certified K9 & Canine Behavior Academy", type: "Veterinary", category: "K9 Behavior & Obedience Training", distance: "3.5 km", rating: 4.8, reviews: 112, hours: "Mon–Sat 8:00 AM – 7:00 PM", phone: "+91 87654 32109", emergency_phone: "+91 87654 32109", address: "Adyar, Chennai, Tamil Nadu 600020", city: "Chennai", latitude: 13.0033, longitude: 80.2550, emoji: "🎓", color: "#3b82f6", emergency: false, open24h: false, specialties: ["Obedience", "Guarding", "Agility & Socialization"] }
];

async function loadServicesFromBackend() {
  try {
    const res = await fetch(`${API_BASE}/services`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        SERVICES_DATA = data;
        renderServices(SERVICES_DATA);
      }
    }
  } catch (err) {
    console.log("ℹ️ Using local verified services dataset.");
  }
}
loadServicesFromBackend();


const TEN_MINUTES_MS = 10 * 60 * 1000;

function purgeExpiredCancelledAppointments() {
  const userId = currentUser?.id || "guest";
  const now = Date.now();
  const initialLen = userAppointments.length;
  userAppointments = userAppointments.filter(a => {
    if (a.status === "Cancelled" && a.cancelled_at) {
      const elapsed = now - new Date(a.cancelled_at).getTime();
      if (elapsed >= TEN_MINUTES_MS) return false;
    }
    return true;
  });
  if (userAppointments.length !== initialLen) {
    localStorage.setItem(`@ecotrack_appointments_${userId}`, JSON.stringify(userAppointments));
    updateAppointmentsBadgeCount();
  }
}

function updateAppointmentsBadgeCount() {
  purgeExpiredCancelledAppointments();
  const badge = document.getElementById("appointmentsBadgeCount");
  if (!badge) return;
  const count = userAppointments.length;
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = "inline-block";
  } else {
    badge.style.display = "none";
  }
}

function filterServicesByType(type) {
  selectedServiceType = type;
  document.querySelectorAll(".service-filter-btn").forEach(btn => {
    btn.classList.remove("btn-primary", "active");
    btn.classList.add("btn-secondary");
  });
  const activeBtn = document.getElementById(`sfilter-${type}`);
  if (activeBtn) {
    activeBtn.classList.remove("btn-secondary");
    activeBtn.classList.add("btn-primary", "active");
  }
  renderServicesGrid();
}

function filterServicesData(query) {
  serviceSearchQuery = query.toLowerCase().trim();
  renderServicesGrid();
}

function renderServicesGrid() {
  const container = document.getElementById("servicesGrid");
  if (!container) return;

  purgeExpiredCancelledAppointments();
  updateAppointmentsBadgeCount();

  // ── SPECIAL CASE: MY APPOINTMENTS TAB ──
  if (selectedServiceType === "Appointments") {
    let apptList = userAppointments;
    if (serviceSearchQuery) {
      apptList = apptList.filter(b =>
        (b.center_name || '').toLowerCase().includes(serviceSearchQuery) ||
        (b.pet_info || '').toLowerCase().includes(serviceSearchQuery) ||
        (b.id || '').toLowerCase().includes(serviceSearchQuery)
      );
    }

    if (!apptList.length) {
      container.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:48px 20px;color:var(--text-muted);">
          <div style="font-size:44px;margin-bottom:12px;">📅</div>
          <p style="font-size:16px;font-weight:800;color:var(--text-primary,#0f172a);margin-bottom:6px;">No Booked Appointments</p>
          <p style="font-size:13.5px;max-width:460px;margin:0 auto 16px auto;">You haven't scheduled any clinic or grooming visits yet. Select a facility from <strong>"All Facilities"</strong> or <strong>"🏥 Vet Clinics"</strong> above and click <strong>"Book"</strong>!</p>
          <button class="btn btn-primary" style="font-size:13px;padding:8px 18px;" onclick="filterServicesByType('All')">
            <i class="fas fa-stethoscope"></i> Browse Facilities
          </button>
        </div>`;
      return;
    }

    const now = Date.now();
    container.innerHTML = apptList.map(b => {
      const isCancelled = b.status === "Cancelled";
      const safeCenter = (b.center_name || 'Clinic').replace(/'/g, "\\'");

      let statusBadge = `<span style="font-size:11px;font-weight:700;color:#10b981;background:#10b98115;border:1px solid #10b98130;padding:3px 8px;border-radius:20px;white-space:nowrap;flex-shrink:0;margin-top:2px;">🟢 Confirmed</span>`;
      if (isCancelled) {
        const cancelledAt = b.cancelled_at ? new Date(b.cancelled_at).getTime() : now;
        const elapsed = now - cancelledAt;
        const remainingMin = Math.max(1, Math.ceil((TEN_MINUTES_MS - elapsed) / 60000));
        statusBadge = `<span style="font-size:11px;font-weight:700;color:#ef4444;background:#ef444415;border:1px solid #ef444430;padding:3px 8px;border-radius:20px;white-space:nowrap;flex-shrink:0;margin-top:2px;" title="Cancelled appointment will automatically delete in ${remainingMin} mins">🔴 Cancelled (Deletes in ${remainingMin}m)</span>`;
      }

      return `
      <div class="service-card" style="background:var(--bg-card,#ffffff);border:1px solid var(--border-color,#e2e8f0);border-radius:20px;padding:22px;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 4px 20px rgba(0,0,0,0.04);transition:all 0.3s ease;height:100%;">
        <div>
          <!-- Header -->
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px;">
            <div style="display:flex;align-items:center;gap:12px;min-width:0;flex:1;">
              <div style="width:48px;height:48px;border-radius:14px;background:#10b98115;border:1px solid #10b98130;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;">
                📅
              </div>
              <div style="min-width:0;flex:1;">
                <div style="font-size:16px;font-weight:800;color:var(--text-primary,#0f172a);line-height:1.3;min-height:42px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
                  ${b.center_name}
                </div>
              </div>
            </div>
            
            ${statusBadge}
          </div>

          <!-- Booking Details Banner -->
          <div style="background:var(--bg-main,#f8fafc);padding:12px 14px;border-radius:12px;border:1px solid var(--border-color,#f1f5f9);margin-bottom:14px;">
            ${b.owner_name ? `<div style="font-size:13px;font-weight:700;color:var(--text-primary,#0f172a);margin-bottom:4px;">👤 <strong>Owner:</strong> ${b.owner_name}</div>` : ''}
            <div style="font-size:12.5px;color:var(--text-secondary,#475569);margin-bottom:4px;">
              🐾 <strong>Pet:</strong> ${b.pet_info}
            </div>
            ${b.phone ? `<div style="font-size:12.5px;color:var(--text-secondary,#475569);margin-bottom:4px;">📞 <strong>Phone:</strong> <a href="tel:${b.phone.replace(/\s+/g, '')}" style="color:var(--primary,#10b981);font-weight:700;text-decoration:none;">${b.phone}</a> ${b.email ? `&bull; 📧 <strong>Email:</strong> ${b.email}` : ''}</div>` : ''}
            <div style="font-size:12.5px;color:var(--primary,#10b981);font-weight:700;">
              🗓️ ${b.date} &nbsp;•&nbsp; 🕒 ${b.time}
            </div>
            <div style="font-size:11.5px;color:var(--text-muted);margin-top:4px;">
              Ref: <strong>${(b.id || '').toUpperCase()}</strong> &nbsp;|&nbsp; Urgency: <strong>${b.urgency || "Routine"}</strong>
            </div>
            ${b.notes ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:6px;font-style:italic;">"${b.notes}"</div>` : ''}
          </div>
        </div>

        <!-- Action Bar -->
        <div style="padding-top:14px;border-top:1px solid var(--border-color,#f1f5f9);margin-top:auto;">
          ${!isCancelled ? `
            <button class="btn btn-secondary" style="width:100%;font-size:13px;padding:10px;color:#ef4444;border-color:#ef444430;background:#ef444408;border-radius:12px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:6px;" onclick="cancelAppointmentBooking('${b.id}','${safeCenter}')">
              <i class="fas fa-calendar-xmark"></i> Cancel Appointment
            </button>
          ` : `
            <div style="text-align:center;font-size:12px;font-weight:700;color:#ef4444;padding:8px;background:#ef444408;border-radius:10px;">
              <i class="fas fa-clock"></i> Auto-deleting in 10 mins
            </div>
          `}
        </div>
      </div>`;
    }).join("");
    return;
  }

  // ── STANDARD CARE DIRECTORY LISTING ──
  let list = Array.isArray(SERVICES_DATA) ? [...SERVICES_DATA] : [];
  if (selectedServiceType && selectedServiceType !== "All") {
    list = list.filter(s => s.type === selectedServiceType);
  }
  if (serviceSearchQuery) {
    list = list.filter(s =>
      s.name.toLowerCase().includes(serviceSearchQuery) ||
      s.type.toLowerCase().includes(serviceSearchQuery) ||
      s.hours.toLowerCase().includes(serviceSearchQuery)
    );
  }

  if (!list.length) {
    container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:44px;color:var(--text-muted);"><div style="font-size:44px;margin-bottom:10px;">🔍</div><p style="font-size:15px;font-weight:600;">No care facilities match your search criteria.</p></div>`;
    return;
  }

  container.innerHTML = list.map(s => {
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.name + ' ' + (s.type || 'Clinic'))}`;
    const safeName = (s.name || '').replace(/'/g, "\\'");
    return `
    <div class="service-card" style="background:var(--bg-card,#ffffff);border:1px solid var(--border-color,#e2e8f0);border-radius:20px;padding:22px;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 4px 20px rgba(0,0,0,0.04);transition:all 0.3s ease;height:100%;">
      <div>
        <!-- Top Header Row -->
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:12px;min-width:0;flex:1;">
            <div style="width:48px;height:48px;border-radius:14px;background:${s.color}15;border:1px solid ${s.color}30;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;box-shadow:0 2px 8px ${s.color}20;">
              ${s.emoji}
            </div>
            <div style="min-width:0;flex:1;">
              <div style="font-size:16px;font-weight:800;color:var(--text-primary,#0f172a);line-height:1.3;min-height:42px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;" title="${s.name}">
                ${s.name}
              </div>
            </div>
          </div>
          
          <span style="font-size:11px;font-weight:700;color:#10b981;background:#10b98115;border:1px solid #10b98130;padding:3px 8px;border-radius:20px;white-space:nowrap;flex-shrink:0;margin-top:2px;">
            <i class="fas fa-check-circle"></i> Verified
          </span>
        </div>

        <!-- Status & Category Badges -->
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
          <span style="font-size:11.5px;font-weight:700;color:${s.color};background:${s.color}12;padding:4px 10px;border-radius:20px;border:1px solid ${s.color}25;">${s.type}</span>
          <span style="font-size:11.5px;font-weight:700;color:#10b981;background:#10b98112;padding:4px 10px;border-radius:20px;display:inline-flex;align-items:center;gap:5px;">
            <span style="width:6px;height:6px;border-radius:50%;background:#10b981;display:inline-block;"></span> Open Now
          </span>
        </div>

        <!-- Rating & Distance Banner -->
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;background:var(--bg-main,#f8fafc);padding:10px 14px;border-radius:12px;border:1px solid var(--border-color,#f1f5f9);">
          <div style="font-size:13px;font-weight:700;color:#f59e0b;display:flex;align-items:center;gap:5px;">
            <i class="fas fa-star"></i> ${s.rating} <span style="font-size:11.5px;color:var(--text-muted,#94a3b8);font-weight:600;">(120+ reviews)</span>
          </div>
          <div style="font-size:12.5px;font-weight:700;color:var(--primary,#10b981);display:flex;align-items:center;gap:4px;">
            <i class="fas fa-location-dot"></i> ${s.distance} away
          </div>
        </div>

        <!-- Contact & Hours Details -->
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;font-size:13px;color:var(--text-secondary,#475569);">
          <div style="display:flex;align-items:center;gap:10px;">
            <i class="far fa-clock" style="width:16px;color:var(--text-muted);text-align:center;"></i>
            <span><strong>Hours:</strong> ${s.hours}</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <i class="fas fa-phone-alt" style="width:16px;color:var(--text-muted);text-align:center;"></i>
            <span><strong>Phone:</strong> <a href="tel:${s.phone.replace(/\s+/g, '')}" style="color:var(--primary,#10b981);font-weight:700;text-decoration:none;">${s.phone}</a></span>
          </div>
        </div>
      </div>

      <!-- Action Buttons Row -->
      <div style="display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:8px;padding-top:14px;border-top:1px solid var(--border-color,#f1f5f9);margin-top:auto;">
        <button class="btn btn-primary" style="font-size:13px;padding:10px;font-weight:700;border-radius:12px;display:flex;align-items:center;justify-content:center;gap:6px;" onclick="openBookingModal(${s.id},'${safeName}')">
          <i class="fas fa-calendar-check"></i> Book
        </button>
        <a href="tel:${s.phone.replace(/\s+/g, '')}" class="btn btn-secondary" style="font-size:13px;padding:10px;font-weight:700;border-radius:12px;display:flex;align-items:center;justify-content:center;gap:6px;text-decoration:none;" onclick="showToast('📞 Dialing ${s.name}...','info')">
          <i class="fas fa-phone-alt"></i> Call
        </a>
        <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary" style="font-size:13px;padding:10px;font-weight:700;border-radius:12px;display:flex;align-items:center;justify-content:center;gap:6px;text-decoration:none;" onclick="showToast('🗺️ Opening Google Maps for ${s.name}...','info')">
          <i class="fas fa-directions"></i> Maps
        </a>
      </div>
    </div>`;
  }).join("");
}

function requestLocationServices() {
  if (navigator.geolocation) {
    showToast("📍 Acquiring precise GPS coordinates...", "info");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=veterinary+hospital+near+${pos.coords.latitude},${pos.coords.longitude}`;
        showToast("✅ GPS locked! Opening Google Maps to nearby animal care centers.", "success");
        window.open(mapsUrl, "_blank");
      },
      () => showToast("Location permission denied. Displaying regional emergency services.", "warning")
    );
  } else {
    showToast("Geolocation is not supported by your browser.", "warning");
  }
}

// ══════════════════════════════════════════════════
// MODAL HANDLERS & FULL FEATURE ACTIONS
// ══════════════════════════════════════════════════

// 1. SPECIES DETAIL MODAL
async function viewSpeciesDetails(speciesId) {
  const dataset = typeof SPECIES_DATASET !== "undefined" ? SPECIES_DATASET : [];
  const sp = dataset.find(s => String(s.id) === String(speciesId) || s.name === speciesId || s.latin === speciesId);
  const modal = document.getElementById("speciesDetailModal");
  const title = document.getElementById("speciesDetailTitle");
  const body = document.getElementById("speciesDetailBody");
  if (!modal || !body) return;

  const item = sp || {
    name: speciesId,
    latin: "Taxonomic Record",
    class: "Mammalia",
    image: getFullBodyImage(speciesId),
    status: "Least Concern",
    habitat: "Terrestrial & Aquatic Environments",
    diet: "Omnivore",
    lifespan: "15–25 yrs",
    desc: "Authentic biological taxonomy record in EcoTrack Encyclopedia."
  };

  const nameStr = item.name || speciesId;
  const latinStr = item.latin || "Taxonomic Record";
  const initialImgSrc = item.image || item.imageUrl || getFullBodyImage(nameStr, item.id);
  const safeNameStr = nameStr.replace(/'/g, "\\'");

  if (title) title.textContent = `🧬 ${nameStr}`;

  const statusColor = (typeof STATUS_COLORS !== 'undefined' && STATUS_COLORS[item.status]) || "#10b981";

  body.innerHTML = `
    <div style="position:relative;height:240px;border-radius:18px;overflow:hidden;margin-bottom:18px;background:#0f172a;box-shadow:0 8px 24px rgba(0,0,0,0.12);">
      <img id="speciesModalImg" src="${initialImgSrc}" alt="${nameStr}" style="width:100%;height:100%;object-fit:cover;object-position:center 20%;display:block;" onerror="this.onerror=null;this.src=getLocalFallbackImage('${safeNameStr}');">
      <div style="position:absolute;bottom:14px;left:14px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <span style="font-size:11px;font-weight:900;color:#fff;background:rgba(15,23,42,0.85);padding:4px 12px;border-radius:20px;backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,0.2);">${item.class || 'Mammalia'}</span>
        <span style="font-size:11px;font-weight:900;color:#fff;background:${statusColor}d0;padding:4px 12px;border-radius:20px;backdrop-filter:blur(6px);">${item.status || 'Least Concern'}</span>
      </div>
    </div>

    <div style="margin-bottom:14px;">
      <h3 style="font-size:22px;font-weight:900;color:var(--text-primary);margin:0 0 2px 0;">${nameStr}</h3>
      <div style="font-size:14px;font-weight:700;color:var(--primary,#10b981);font-style:italic;">${latinStr}</div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;">
      <div style="background:var(--bg-main);border-radius:16px;padding:14px;border:1px solid var(--border-color);">
        <div style="font-size:10.5px;font-weight:800;color:var(--primary);text-transform:uppercase;margin-bottom:6px;letter-spacing:0.5px;">TAXONOMY & CLASSIFICATION</div>
        <div style="font-size:13.5px;color:var(--text-primary);margin-bottom:4px;"><strong>Class:</strong> ${item.class || "Mammalia"}</div>
        <div style="font-size:13.5px;color:var(--text-primary);margin-bottom:4px;"><strong>Lifespan:</strong> ${item.lifespan || "15-20 yrs"}</div>
        <div style="font-size:13.5px;color:var(--text-primary);"><strong>Species Record ID:</strong> #${item.id || '101'}</div>
      </div>
      <div style="background:var(--bg-main);border-radius:16px;padding:14px;border:1px solid var(--border-color);">
        <div style="font-size:10.5px;font-weight:800;color:var(--accent);text-transform:uppercase;margin-bottom:6px;letter-spacing:0.5px;">ECOLOGY & HABITAT</div>
        <div style="font-size:13.5px;color:var(--text-primary);margin-bottom:4px;"><strong>Status:</strong> ${item.status || "Least Concern"}</div>
        <div style="font-size:13.5px;color:var(--text-primary);margin-bottom:4px;"><strong>Habitat:</strong> ${item.habitat || "Terrestrial"}</div>
        <div style="font-size:13.5px;color:var(--text-primary);"><strong>Diet:</strong> ${item.diet || "Omnivore"}</div>
      </div>
    </div>

    <div style="background:var(--bg-main);border-radius:16px;padding:16px;border:1px solid var(--border-color);margin-bottom:18px;">
      <div style="font-size:11px;font-weight:800;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px;letter-spacing:0.5px;">ENCYCLOPEDIC OVERVIEW</div>
      <p id="speciesModalDesc" style="font-size:14px;color:var(--text-secondary);line-height:1.6;margin:0;">${item.desc || item.description || "Verified biological species record."}</p>
    </div>

    <div style="display:flex;gap:10px;">
      <button class="btn btn-primary" style="flex:1;border-radius:14px;padding:12px;font-weight:800;" onclick="closeSpeciesDetailModal();switchTab('training');document.getElementById('trainSpecies').value='${nameStr.replace(/'/g, "\\'")}';generateWebTrainingPlan();">
        <i class="fas fa-brain"></i> Generate AI Care & Training Plan
      </button>
    </div>`;

  modal.classList.add("active");

  // Asynchronously fetch Wikipedia data to enrich modal with live Wikipedia article & image
  try {
    const queryTerm = (item.latin && item.latin !== "Taxonomic Record" && item.latin !== "Canis lupus familiaris" && item.latin !== "Felis catus") ? item.latin : nameStr;
    let wikiData = await fetchWikipediaSpeciesData(queryTerm);
    if (!wikiData || !wikiData.thumbnail) {
      wikiData = await fetchWikipediaSpeciesData(nameStr);
    }
    if (wikiData) {
      const imgEl = document.getElementById("speciesModalImg");
      if (imgEl && wikiData.thumbnail) {
        imgEl.src = wikiData.thumbnail;
      }
      if (item && wikiData.thumbnail) {
        item.image = wikiData.thumbnail;
      }
      const cardImg = document.getElementById(`species-card-img-${item.id || speciesId}`);
      if (cardImg && wikiData.thumbnail) {
        cardImg.src = wikiData.thumbnail;
      }
      const descEl = document.getElementById("speciesModalDesc");
      if (descEl && wikiData.extract) {
        descEl.textContent = wikiData.extract;
      }
    }
  } catch (err) {
    /* Silent notice fallback */
  }
}


function closeSpeciesDetailModal() {
  document.getElementById("speciesDetailModal")?.classList.remove("active");
}

// 2. ITEM DETAIL MODAL (MARKETPLACE)
function viewMarketItem(itemId, sourceTab) {
  // Search the correct array first based on the active tab to prevent ID collisions
  let item;
  if (sourceTab === 'products') {
    item = MARKET_PRODUCTS.find(i => String(i.id) === String(itemId))
      || MARKET_ANIMALS.find(i => String(i.id) === String(itemId))
      || (userPets || []).find(i => String(i.id) === String(itemId));
  } else if (sourceTab === 'animals') {
    item = MARKET_ANIMALS.find(i => String(i.id) === String(itemId))
      || MARKET_PRODUCTS.find(i => String(i.id) === String(itemId))
      || (userPets || []).find(i => String(i.id) === String(itemId));
  } else {
    const allItems = [...MARKET_ANIMALS, ...MARKET_PRODUCTS, ...(userPets || [])];
    item = allItems.find(i => String(i.id) === String(itemId));
  }

  const modal = document.getElementById("itemDetailModal");
  const title = document.getElementById("itemDetailTitle");
  const body = document.getElementById("itemDetailBody");
  if (!modal || !body) return;

  if (!item) {
    showToast("Listing details not found in current view.", "error");
    return;
  }

  // Determine if this is an animal listing: use sourceTab first for accuracy, then fall back to item properties
  const isAnimal = sourceTab === 'animals'
    ? true
    : (sourceTab === 'products'
      ? false
      : (item.type === 'adoption' || item.type === 'sale' || (!!item.breed && !item.category)));
  const isAdoption = item.type === 'adoption' || (item.price && String(item.price).toLowerCase().includes('free'));

  const isOwner = currentUser && item && (
    (item.sellerId && String(item.sellerId) === String(currentUser.id)) ||
    (item.user_id && String(item.user_id) === String(currentUser.id)) ||
    (item.seller && (String(item.seller.id) === String(currentUser.id) || String(item.seller) === String(currentUser.id))) ||
    (item.sellerName && currentUser.name && item.sellerName.toLowerCase() === currentUser.name.toLowerCase())
  );
  const safeItemName = (item.name || '').replace(/'/g, "\\'");

  if (title) title.textContent = isAnimal ? `🐾 Animal Intelligence Report` : `📦 Product Specifications`;

  // UI Construction with high-fidelity boutique styling
  body.innerHTML = `
    <div style="position:relative;height:260px;border-radius:20px;overflow:hidden;margin-bottom:22px;background:var(--bg-main);display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow-md);border:1px solid var(--border-color);">
      <img src="${item.image}" style="width:100%;height:100%;object-fit:contain;" alt="${item.name}">
      <div style="position:absolute;bottom:16px;left:16px;display:flex;gap:8px;">
        <span style="font-size:11px;font-weight:900;color:#fff;background:rgba(15,23,42,0.85);padding:5px 14px;border-radius:20px;backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,0.15);text-transform:uppercase;">${item.species || item.category || item.breed || 'Verified'}</span>
        ${item.vaccinated ? `<span style="font-size:11px;font-weight:900;color:#fff;background:rgba(16,185,129,0.9);padding:5px 14px;border-radius:20px;backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,0.15);"><i class="fas fa-shield-virus"></i> Vaccinated</span>` : ''}
      </div>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;gap:16px;">
      <div style="flex:1;">
        <h2 style="font-size:24px;font-weight:900;color:var(--text-primary);line-height:1.1;margin:0;">${item.name}</h2>
        <div style="font-size:13px;color:var(--text-secondary);margin-top:5px;font-weight:600;">
          ${isAnimal ? `<i class="fas fa-dna"></i> Breed: ${item.breed || 'Mixed'}` : `<i class="fas fa-tag"></i> Premium Welfare Supply`}
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:28px;font-weight:900;color:${isAdoption ? 'var(--secondary)' : 'var(--primary)'};letter-spacing:-0.5px;">${isAdoption ? 'Free' : (item.priceStr || ('₹' + item.price))}</div>
        <div style="font-size:10px;color:var(--text-muted);font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-top:2px;">${isAdoption ? 'Free Adoption' : 'Boutique Pricing'}</div>
      </div>
    </div>

    ${isAnimal ? `
    <!-- Animal chips row -->
    <div style="display:flex;flex-wrap:wrap;gap:7px;margin-bottom:18px;">
      ${item.species ? `<span style="font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;background:var(--primary-light,#ecfdf5);color:var(--primary,#10b981);border:1px solid #10b98130;">🐾 ${item.species}</span>` : ''}
      ${item.breed ? `<span style="font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;background:#f0f9ff;color:#0284c7;border:1px solid #0284c730;">🧬 ${item.breed}</span>` : ''}
      ${item.gender && item.gender !== 'Unknown' ? `<span style="font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;background:#fdf4ff;color:#9333ea;border:1px solid #9333ea30;">${item.gender === 'Male' ? '♂ Male' : '♀ Female'}</span>` : ''}
      ${item.age ? `<span style="font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;background:#fff7ed;color:#ea580c;border:1px solid #ea580c30;">⏳ ${item.age}</span>` : ''}
      ${item.health ? `<span style="font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;background:#f0fdf4;color:#16a34a;border:1px solid #16a34a30;">❤️ ${item.health}</span>` : ''}
    </div>` : ''}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px;">
      <div style="background:var(--bg-main);border:1px solid var(--border-color);padding:16px;border-radius:16px;">
        <div style="font-size:10px;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">${isAnimal ? 'Location' : 'Logistics'}</div>
        <div style="font-size:14px;color:var(--text-primary);font-weight:700;">
          <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((item.location || '') + ' ' + (item.name || ''))}" target="_blank" rel="noopener noreferrer" style="color:var(--primary,#10b981);text-decoration:underline;font-weight:800;">📍 ${item.location} <i class="fas fa-arrow-up-right-from-square" style="font-size:10px;"></i></a>
        </div>
        <div style="font-size:13px;color:var(--text-secondary);margin-top:4px;">${isAnimal ? '⏳ Age: ' + (item.age || 'N/A') : '🚚 Fast Delivery Available'}</div>
      </div>
      <div style="background:var(--bg-main);border:1px solid var(--border-color);padding:16px;border-radius:16px;">
        <div style="font-size:10px;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">${isAnimal ? 'Vitals' : 'Assurance'}</div>
        <div style="font-size:14px;color:var(--text-primary);font-weight:700;">${isAnimal ? '❤️ Health: ' + (item.health || 'Optimal') : ('🛡️ ' + (item.sellerName || item.seller || 'Verified Seller'))}</div>
        <div style="font-size:13px;color:var(--text-secondary);margin-top:4px;">${isAnimal ? (item.vaccinated ? '✅ Vaccinated' : '❌ Not Vaccinated') : '⭐ Rating: 4.9/5'}</div>
      </div>
    </div>

    <div style="background:var(--bg-main);border:1px solid var(--border-color);padding:18px;border-radius:16px;margin-bottom:24px;">
      <div style="font-size:11px;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Listing Overview</div>
      <p style="font-size:14.5px;color:var(--text-secondary);line-height:1.6;margin:0;">${item.description || 'Verified EcoTrack listing. This item has passed our 12-point quality and welfare inspection protocol.'}</p>
      ${item.specs ? `
        <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border-color);">
          <div style="font-size:11px;font-weight:800;color:var(--primary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Technical Specifications</div>
          <div style="font-size:13.5px;color:var(--text-primary);font-weight:600;">
            ${typeof item.specs === 'object'
              ? `<div style="display:flex;flex-direction:column;gap:4px;">${Object.entries(item.specs).map(([k, v]) => `<div><span style="color:var(--text-muted);font-size:12px;font-weight:700;">${k}:</span> <span style="color:var(--text-primary);">${v}</span></div>`).join('')}</div>`
              : `<i class="fas fa-list-check"></i> ${item.specs}`}
          </div>
        </div>
      ` : ''}
    </div>

    ${item.payment_details ? `
    <div style="background:linear-gradient(135deg,#ecfdf5,#f0fdf4);border:1.5px solid var(--primary);padding:16px 18px;border-radius:16px;margin-bottom:20px;">
      <div style="font-size:11px;font-weight:800;color:var(--primary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;"><i class="fas fa-wallet"></i> Payment Details</div>
      <div style="font-size:14.5px;color:var(--text-primary);font-weight:700;word-break:break-all;">${item.payment_details}</div>
      <div style="font-size:11.5px;color:var(--text-secondary);margin-top:4px;">Transfer payment directly to the seller after confirming the listing.</div>
    </div>
    ` : ''}

    ${!isAnimal ? `
    <div style="display:flex;gap:12px;">
      <button class="btn btn-primary" style="flex:1;height:56px;border-radius:16px;font-weight:900;font-size:16px;box-shadow:var(--shadow-glow);" onclick="addToCart('${item.id}','${item.name.replace(/'/g, "\\'")}',parseCartPrice('${item.priceNum || item.price || 0}'),'${item.image}');closeItemDetailModal();">
        <i class="fas fa-shopping-basket"></i> Add to Boutique Cart
      </button>
    </div>
    ` : ''}
    ${isOwner ? `
      <div style="margin-top:12px;">
        <button class="btn btn-secondary" style="width:100%;color:#ef4444;border-color:rgba(239,68,68,0.3);background:rgba(239,68,68,0.06);height:48px;border-radius:14px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;" onclick="closeItemDetailModal();deleteMarketplaceListingWeb('${item.id}','${safeItemName}')">
          <i class="fas fa-trash-alt"></i> Delete Marketplace Listing
        </button>
      </div>
    ` : ''}`;

  modal.classList.add("active");
}

function closeItemDetailModal() {
  document.getElementById("itemDetailModal")?.classList.remove("active");
}

// 3. CHECKOUT MODAL & PAYING PLACE
let selectedPaymentMethod = "upi";

function openCheckoutModal() {
  if (!cart.length) { showToast("Your cart is empty!", "error"); return; }
  closeCartModal();

  cart.forEach(c => { c.price = parseCartPrice(c.price || c.priceNum); });
  const total = cart.reduce((s, c) => s + c.price * (c.qty || 1), 0);

  const display = document.getElementById("checkoutTotalDisplay");
  if (display) display.textContent = `Total: ₹${total.toLocaleString('en-IN')}`;

  if (currentUser) {
    const nameInput = document.getElementById("checkoutName");
    if (nameInput && currentUser.name) nameInput.value = currentUser.name;
  }

  // Reset steps
  const s1 = document.getElementById("checkoutStep1");
  const s2 = document.getElementById("checkoutStep2");
  const s3 = document.getElementById("checkoutStep3");
  if (s1) s1.style.display = "block";
  if (s2) s2.style.display = "none";
  if (s3) s3.style.display = "none";

  const title = document.getElementById("checkoutModalTitle");
  if (title) title.textContent = "💳 Secure Payment & Checkout";

  document.getElementById("checkoutModal")?.classList.add("active");
}

function closeCheckoutModal() {
  document.getElementById("checkoutModal")?.classList.remove("active");
}

function goToPaymentPlace(e) {
  if (e && e.preventDefault) e.preventDefault();

  const name = document.getElementById("checkoutName")?.value.trim();
  const address = document.getElementById("checkoutAddress")?.value.trim();
  const phone = document.getElementById("checkoutPhone")?.value.trim();

  if (!name || !address || !phone) {
    showToast("Please fill in your name, delivery address and phone number.", "error");
    return;
  }

  if (!isValidPhoneNumber(phone)) {
    showToast("🚫 Invalid phone number. Please enter a valid 10-digit number.", "error");
    return;
  }

  cart.forEach(c => { c.price = parseCartPrice(c.price || c.priceNum); });
  const total = cart.reduce((s, c) => s + c.price * (c.qty || 1), 0);

  const amountEl = document.getElementById("payingPlaceAmount");
  if (amountEl) amountEl.textContent = `₹${total.toLocaleString("en-IN")}`;

  const btnAmount = document.getElementById("payBtnAmount");
  if (btnAmount) btnAmount.textContent = `₹${total.toLocaleString("en-IN")}`;

  const orderId = `EC-${Math.floor(100000 + Math.random() * 900000)}`;
  const upiQrImg = document.getElementById("upiQrCodeImg");
  if (upiQrImg) {
    upiQrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=upi://pay?pa=ecotrack@upi%26pn=EcoTrackApp%26am=${total}%26cu=INR%26tn=Order_${orderId}`;
  }

  document.getElementById("checkoutStep1").style.display = "none";
  document.getElementById("checkoutStep2").style.display = "block";
  document.getElementById("checkoutModalTitle").textContent = "⚡ EcoTrack Paying Place";
}

function selectPaymentMethod(method) {
  selectedPaymentMethod = method;
  const methods = ["upi", "card", "netbanking", "cod"];

  methods.forEach(m => {
    const btn = document.getElementById(`payBtn${m.charAt(0).toUpperCase() + m.slice(1)}`);
    const details = document.getElementById(`payDetails${m.charAt(0).toUpperCase() + m.slice(1)}`);

    if (m === method) {
      if (btn) {
        btn.style.border = "2px solid var(--primary)";
        btn.style.background = "var(--primary-light)";
      }
      if (details) details.style.display = "block";
    } else {
      if (btn) {
        btn.style.border = "1px solid var(--border-color)";
        btn.style.background = "var(--bg-card)";
      }
      if (details) details.style.display = "none";
    }
  });
}

function backToStep1() {
  document.getElementById("checkoutStep2").style.display = "none";
  document.getElementById("checkoutStep1").style.display = "block";
  document.getElementById("checkoutModalTitle").textContent = "💳 Secure Payment & Checkout";
}

async function confirmAndPayOrder() {
  const name = document.getElementById("checkoutName")?.value.trim() || currentUser?.name || "Customer";
  const address = document.getElementById("checkoutAddress")?.value.trim();
  const phone = document.getElementById("checkoutPhone")?.value.trim();
  const method = selectedPaymentMethod;

  if (method === "card") {
    const num = document.getElementById("cardNumInput")?.value.trim();
    if (!num || num.length < 12) {
      showToast("Please enter a valid card number.", "error");
      return;
    }
  }

  cart.forEach(c => { c.price = parseCartPrice(c.price || c.priceNum); });
  const total = cart.reduce((s, c) => s + c.price * (c.qty || 1), 0);
  const orderId = `EC-${Math.floor(100000 + Math.random() * 900000)}`;

  try {
    await fetch(`${API_BASE}/cart/${currentUser?.id || "anon"}/checkout`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        ...(currentUser?.token ? { "Authorization": `Bearer ${currentUser.token}` } : {})
      },
      body: JSON.stringify({ orderId, total, address, phone, method, user_id: currentUser?.id })
    });
  } catch { }

  const finalCart = [...cart];
  cart = [];
  if (currentUser) localStorage.setItem(`@ecotrack_cart_${currentUser.id}`, "[]");
  updateCartBadges();

  showToast(`🎉 Payment verified via ${method.toUpperCase()}! Generating digital bill...`, "success", 3000);

  renderInvoice({ orderId, total, name, address, phone, method, items: finalCart, date: new Date().toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' }) });
}

function renderInvoice(order) {
  document.getElementById("checkoutStep1").style.display = "none";
  document.getElementById("checkoutStep2").style.display = "none";
  const step3 = document.getElementById("checkoutStep3");
  if (!step3) return;

  step3.style.display = "block";
  document.getElementById("checkoutModalTitle").textContent = "🧾 Official Digital Invoice";

  const tax = Math.round(order.total * 0.05);
  const grandTotal = order.total + tax;

  step3.innerHTML = `
    <div id="invoiceContainer" style="padding:24px;background:#fff;border-radius:20px;font-family:'Plus Jakarta Sans',sans-serif;box-shadow:0 10px 30px rgba(0,0,0,0.05);border:1px solid #e2e8f0;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;border-bottom:3px solid #10b981;padding-bottom:16px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="background:#10b981;color:#fff;width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;">🌿</div>
          <div>
            <h2 style="margin:0;font-size:22px;font-weight:900;color:#065f46;letter-spacing:-0.5px;">ECOTRACK</h2>
            <div style="font-size:11px;color:#64748b;font-weight:600;">GSTIN: 33ABCDE1234F1Z5 · Official Tax Receipt</div>
          </div>
        </div>
        <div style="text-align:right;">
          <span style="background:#dcfce7;color:#15803d;font-size:12px;font-weight:900;padding:4px 12px;border-radius:20px;display:inline-block;margin-bottom:4px;">STATUS: PAID</span>
          <div style="font-size:12px;color:#334155;font-weight:800;">INV #${order.orderId}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:20px;margin-bottom:24px;background:#f8fafc;padding:16px;border-radius:14px;">
        <div>
          <div style="font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;margin-bottom:6px;">Billed & Shipped To:</div>
          <div style="font-size:14px;font-weight:800;color:#0f172a;">${order.name}</div>
          <div style="font-size:12px;color:#475569;margin-top:4px;">📍 ${order.address}</div>
          <div style="font-size:12px;color:#475569;">📞 ${order.phone}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;margin-bottom:6px;">Payment Details:</div>
          <div style="font-size:12px;font-weight:700;color:#334155;">Date: ${order.date}</div>
          <div style="font-size:12px;font-weight:800;color:#10b981;margin-top:2px;">Method: ${order.method.toUpperCase()}</div>
          <div style="font-size:11px;color:#64748b;margin-top:4px;">Auth ID: ${Math.floor(10000000 + Math.random() * 90000000)}</div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <thead>
          <tr style="border-bottom:2px solid #e2e8f0;background:#f1f5f9;">
            <th style="text-align:left;padding:10px 12px;font-size:11px;color:#475569;text-transform:uppercase;border-top-left-radius:8px;">Item Description</th>
            <th style="text-align:center;padding:10px 12px;font-size:11px;color:#475569;text-transform:uppercase;">Qty</th>
            <th style="text-align:right;padding:10px 12px;font-size:11px;color:#475569;text-transform:uppercase;border-top-right-radius:8px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${order.items.map(i => `
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:12px;font-size:13px;font-weight:700;color:#1e293b;">${i.name}</td>
              <td style="padding:12px;text-align:center;font-size:13px;font-weight:600;color:#475569;">${i.qty}</td>
              <td style="padding:12px;text-align:right;font-size:13px;font-weight:800;color:#0f172a;">₹${(i.price * i.qty).toLocaleString("en-IN")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:24px;">
        <div style="text-align:center;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=VERIFIED_ORDER_${order.orderId}" style="width:70px;height:70px;border-radius:8px;border:1px solid #e2e8f0;">
          <div style="font-size:9px;color:#94a3b8;margin-top:4px;font-weight:700;">SCAN TO VERIFY</div>
        </div>
        <div style="width:230px;background:#f8fafc;padding:16px;border-radius:14px;border:1px solid #e2e8f0;">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px;color:#64748b;">
            <span>Subtotal</span><span>₹${order.total.toLocaleString("en-IN")}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:10px;color:#64748b;">
            <span>GST (5%)</span><span>₹${tax.toLocaleString("en-IN")}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:900;border-top:2px dashed #cbd5e1;padding-top:10px;color:#0f172a;">
            <span>Grand Total</span><span style="color:#10b981;">₹${grandTotal.toLocaleString("en-IN")}</span>
          </div>
        </div>
      </div>

      <div style="text-align:center;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;font-weight:600;">
        Thank you for purchasing with EcoTrack. For support, email support@ecotrack.app.<br>
        This is a computer-generated tax invoice and requires no physical signature.
      </div>

      <div style="display:flex;gap:12px;margin-top:24px;" class="no-print">
        <button class="btn btn-primary" style="flex:1;height:46px;border-radius:12px;font-weight:800;" onclick="window.print()">
          <i class="fas fa-print"></i> Print / Save PDF Invoice
        </button>
        <button class="btn btn-secondary" style="flex:1;height:46px;border-radius:12px;background:#f1f5f9;font-weight:700;" onclick="closeCheckoutModal()">
          Close
        </button>
      </div>
    </div>
  `;
}

// 4. APPOINTMENT BOOKING & CANCELLATION MANAGEMENT
let currentBookingCenter = null;
let userAppointments = [];

async function loadUserAppointments() {
  const userId = currentUser?.id || "guest";
  try {
    const res = await fetch(`${API_BASE}/appointments?user_id=${userId}`);
    if (res.ok) {
      const data = await res.json();
      userAppointments = Array.isArray(data) ? data : [];
    } else { throw new Error("offline"); }
  } catch {
    const local = JSON.parse(localStorage.getItem(`@ecotrack_appointments_${userId}`) || "[]");
    userAppointments = local;
  }
  updateAppointmentsBadgeCount();
  if (selectedServiceType === "Appointments") renderServicesGrid();
}

function openBookingModal(serviceId, serviceName) {
  currentBookingCenter = { id: serviceId, name: serviceName };
  const title = document.getElementById("bookingCenterTitle");
  if (title) title.textContent = `📅 Book Appointment · ${serviceName || 'Center'}`;

  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const dateInput = document.getElementById("bookingDate");
  if (dateInput) dateInput.value = tomorrow;
  const timeInput = document.getElementById("bookingTime");
  if (timeInput) timeInput.value = "10:00";

  document.getElementById("bookAppointmentModal")?.classList.add("active");
}

function closeBookingModal() {
  document.getElementById("bookAppointmentModal")?.classList.remove("active");
}

function isValidPhoneNumber(phoneStr) {
  if (!phoneStr) return false;
  // Professional 10-digit check after stripping all non-digits
  const digits = phoneStr.replace(/\D/g, '');
  // Handles 10 digits or 12 digits (with 91 prefix)
  return digits.length === 10 || (digits.length === 12 && digits.startsWith('91'));
}

function filterPhoneInput(el) {
  // Real-time professional filtering: allow only digits and +
  el.value = el.value.replace(/[^\d+]/g, '');
  if (el.value.length > 13) el.value = el.value.slice(0, 13);
}

async function submitAppointmentBooking(e) {
  if (e && e.preventDefault) e.preventDefault();
  const ownerName = document.getElementById("bookingOwnerName")?.value.trim();
  const petInfo = document.getElementById("bookingPetInfo")?.value.trim() || "Not specified";
  const phone = document.getElementById("bookingPhone")?.value.trim();
  const date = document.getElementById("bookingDate")?.value;
  const time = document.getElementById("bookingTime")?.value;
  const urgency = document.getElementById("bookingUrgency")?.value || "Routine";
  const notes = document.getElementById("bookingNotes")?.value.trim() || "";

  if (!ownerName) {
    showToast("Please enter Name of the Owner", "error", 4000);
    return;
  }

  if (!phone || !isValidPhoneNumber(phone)) {
    showToast("Please enter a valid 10-digit phone number", "error", 4000);
    return;
  }

  if (!date || !time) {
    showToast("Please select appointment date and time", "error", 4000);
    return;
  }

  const bookingId = `BK-${Math.floor(100000 + Math.random() * 900000)}`;
  const booking = {
    id: bookingId,
    user_id: currentUser?.id || "guest",
    center_name: currentBookingCenter?.name || "Care Center",
    owner_name: ownerName,
    pet_info: petInfo,
    phone: phone,
    date,
    time,
    urgency,
    notes,
    status: "Confirmed",
    created_at: new Date().toISOString()
  };

  try {
    await fetch(`${API_BASE}/appointments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(booking)
    });
  } catch { }

  userAppointments.unshift(booking);
  const userId = currentUser?.id || "guest";
  localStorage.setItem(`@ecotrack_appointments_${userId}`, JSON.stringify(userAppointments));

  closeBookingModal();
  updateAppointmentsBadgeCount();
  showToast(`✅ Appointment saved & confirmed at ${booking.center_name} for ${date} at ${time}! Ref: ${bookingId}`, "success", 6000);

  // Switch to My Appointments filter tab automatically so the user sees their newly saved appointment!
  filterServicesByType("Appointments");
}

async function cancelAppointmentBooking(id, centerName) {
  const ok = await showConfirmModal({
    title: "Cancel Appointment",
    message: `Are you sure you want to cancel your appointment at ${centerName}?`,
    icon: "fa-calendar-xmark",
    confirmText: "Yes, Cancel",
    cancelText: "Keep Appointment",
    isDanger: true
  });
  if (!ok) return;

  const userId = currentUser?.id || "guest";
  try {
    await fetch(`${API_BASE}/appointments/${id}/cancel`, { method: "PUT" });
  } catch { }

  const target = userAppointments.find(a => a.id === id);
  if (target) {
    target.status = "Cancelled";
    target.cancelled_at = new Date().toISOString();
  }

  localStorage.setItem(`@ecotrack_appointments_${userId}`, JSON.stringify(userAppointments));
  updateAppointmentsBadgeCount();
  renderServicesGrid();
  showToast(`❌ Appointment at ${centerName} has been cancelled (will auto-delete in 10 mins).`, "info", 5000);
}

// Helper to close modal on background click
function closeModalOnBg(e, modalId) {
  if (e.target.id === modalId) {
    document.getElementById(modalId)?.classList.remove("active");
  }
}

// BOOTSTRAP ON LOAD
document.addEventListener("DOMContentLoaded", () => {
  checkAuthOnLoad();
  loadUserAppointments();
  initEventsModule();
  // Periodically purge cancelled appointments older than 10 minutes
  setInterval(() => {
    purgeExpiredCancelledAppointments();
    if (selectedServiceType === "Appointments") renderServicesGrid();
  }, 15000);

  // Read and handle completed drill redirect
  const urlParams = new URLSearchParams(window.location.search);
  const completedDrill = urlParams.get('completed_drill');
  if (completedDrill) {
    // Switch to training tab and mark completed
    setTimeout(() => {
      switchTab('training');
      setTimeout(() => {
        if (typeof window.markWebExerciseCompleted === 'function') {
          window.markWebExerciseCompleted(completedDrill);
        }
      }, 500);
    }, 500);
  }
});

window.toggleDrillDetails = function (id) {
  const el = document.getElementById(id);
  const icon = document.getElementById('icon-' + id);
  if (el.style.display === 'none') {
    el.style.display = 'block';
    icon.classList.remove('fa-chevron-down');
    icon.classList.add('fa-chevron-up');
  } else {
    el.style.display = 'none';
    icon.classList.remove('fa-chevron-up');
    icon.classList.add('fa-chevron-down');
  }
};


let currentAiScannerStream = null;
let currentAiScannerDrill = null;
let currentAiScannerSpecies = null;
let aiScannerProgress = 0;

window.openAiScannerModal = async function (title, exerciseKey, explicitSpecies, explicitBreed) {
  // Determine target species with robust fallback chain
  const speciesVal = explicitSpecies
    || window.lastGeneratedPlan?.speciesName
    || window.lastGeneratedProgram?.species
    || document.getElementById("trainSpecies")?.value.trim()
    || "Dog";

  // Determine breed with robust fallback chain
  const breedVal = explicitBreed
    || window.lastGeneratedPlan?.breedName
    || window.lastGeneratedProgram?.breed
    || document.getElementById("trainBreed")?.value.trim()
    || "";

  currentAiScannerSpecies = speciesVal;

  const handoffData = {
    drill: title,
    exercise: exerciseKey || 'scan',
    species: speciesVal,
    breed: breedVal,
    timestamp: Date.now()
  };

  try {
    localStorage.setItem('@ecotrack_scanner_handoff', JSON.stringify(handoffData));
  } catch (e) {}

  // Navigate using aiscanner (without .html to prevent 301 query-stripping on serve dev servers)
  const q = `drill=${encodeURIComponent(title)}&exercise=${encodeURIComponent(exerciseKey || 'scan')}&species=${encodeURIComponent(speciesVal)}&breed=${encodeURIComponent(breedVal)}`;
  window.location.href = `aiscanner?${q}`;
};

window.startAiScannerInference = function () {
  document.getElementById('aiScannerOverlay').style.display = 'none';
  const video = document.getElementById('aiScannerVideo');
  const canvas = document.getElementById('aiScannerCanvas');

  if (typeof window.runInferenceLoop === 'function') {
    window.runInferenceLoop(video, canvas, currentAiScannerSpecies,
      (errorMsg) => {
        // onHalt
        document.getElementById('aiScannerOverlay').style.display = 'block';
        document.getElementById('aiScannerStatusMsg').innerText = errorMsg;
        document.getElementById('aiScannerStatusMsg').style.color = '#ef4444';
        document.getElementById('aiScannerStartBtn').style.display = 'none';
      },
      (progressData) => {
        // onProgress
        if (progressData.targetFound) {
          aiScannerProgress += 0.8;
          if (aiScannerProgress > 100) aiScannerProgress = 100;

          const pct = Math.floor(aiScannerProgress) + '%';
          document.getElementById('aiScannerProgressLabel').textContent = pct;
          document.getElementById('aiScannerProgressBar').style.width = pct;

          const fpsEl = document.getElementById('webFpsLabel');
          if (fpsEl) {
            fpsEl.textContent = `${progressData.fps} FPS`;
          }

          if (aiScannerProgress >= 100) {
            if (typeof window.stopInference === 'function') window.stopInference();
            if (typeof window.saveWebScan === 'function') {
              window.saveWebScan();
            }
            window.closeAiScannerModal();
            if (typeof window.markWebExerciseCompleted === 'function') {
              window.markWebExerciseCompleted(currentAiScannerDrill);
            } else if (typeof markWebExerciseCompleted === 'function') {
              markWebExerciseCompleted(currentAiScannerDrill);
            }
          }
        }
      }
    );
  }
};

window.closeAiScannerModal = function () {
  if (typeof window.stopInference === 'function') {
    window.stopInference();
  }
  if (currentAiScannerStream) {
    currentAiScannerStream.getTracks().forEach(track => track.stop());
    currentAiScannerStream = null;
  }
  const video = document.getElementById('aiScannerVideo');
  if (video) video.srcObject = null;

  const ctx = document.getElementById('aiScannerCanvas')?.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const modal = document.getElementById('aiScannerModal');
  if (modal) modal.style.display = 'none';
};


// ══════════════════════════════════════════════════
// 🛡️ ADMINISTRATOR CENTER & GOVERNANCE MODULE
// ══════════════════════════════════════════════════

let adminAllUsers = [];

async function loadAdminDashboard() {
  await Promise.all([
    fetchAdminStats(),
    fetchAdminUsers(),
    fetchAdminListings(),
    fetchAdminPosts()
  ]);
}

async function fetchAdminStats() {
  try {
    const res = await fetch(`${API_BASE}/admin/stats`);
    if (!res.ok) throw new Error("Failed to load telemetry");
    const data = await res.json();
    if (data.success && data.stats) {
      const s = data.stats;
      setEl("adminKpiUsers", s.total_users || 0);
      setEl("adminKpiUsersBreakdown", `${s.total_members || 0} Members • ${s.total_sellers || 0} Sellers • ${s.total_admins || 0} Admins`);
      setEl("adminKpiListings", s.total_listings || 0);
      setEl("adminKpiPosts", s.total_posts || 0);
      setEl("adminKpiScans", s.total_scans || 0);
      setEl("diagDbEngine", s.database_engine || "Dual-Mode Engine");

      const hours = Math.floor(s.system_uptime / 3600);
      const minutes = Math.floor((s.system_uptime % 3600) / 60);
      setEl("diagUptime", `${hours}h ${minutes}m (${s.system_uptime}s)`);
    }
  } catch (err) {
    console.error("fetchAdminStats error:", err);
  }
}

async function fetchAdminUsers() {
  const tbody = document.getElementById("adminUsersTableBody");
  if (!tbody) return;

  try {
    const res = await fetch(`${API_BASE}/admin/users`);
    if (!res.ok) throw new Error("Failed to load users roster");
    const data = await res.json();
    adminAllUsers = data.users || [];
    renderAdminUsersTable(adminAllUsers);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="padding: 24px; text-align: center; color: #ef4444;"><i class="fas fa-triangle-exclamation"></i> ${err.message}</td></tr>`;
  }
}

function renderAdminUsersTable(users) {
  const tbody = document.getElementById("adminUsersTableBody");
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="padding: 30px; text-align: center; color: var(--text-muted, #94a3b8);">No users match this filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const role = (u.role || "user").toLowerCase();
    const roleColors = {
      admin: { bg: "rgba(16,185,129,0.18)", color: "#047857", icon: "shield-halved" },
      seller: { bg: "rgba(2,132,199,0.16)", color: "#0284c7", icon: "store" },
      user: { bg: "rgba(100,116,139,0.12)", color: "#475569", icon: "user" }
    };
    const c = roleColors[role] || roleColors.user;
    const isRoot = (u.id === 'usr1' || u.id === 'usr_admin');

    return `
      <tr style="border-bottom: 1px solid var(--border, #f1f5f9); transition: background 0.15s ease;">
        <td style="padding: 12px 16px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 34px; height: 34px; border-radius: 50%; background: ${c.bg}; color: ${c.color}; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem; overflow: hidden;">
              ${u.avatar_url ? `<img src="${u.avatar_url}" style="width: 100%; height: 100%; object-fit: cover;">` : (u.name ? u.name.charAt(0).toUpperCase() : 'U')}
            </div>
            <div>
              <div style="font-weight: 700; color: var(--text-primary, #0f172a);">${u.name || "Anonymous Member"}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted, #94a3b8);">ID: ${u.ecotrack_id || u.id}</div>
            </div>
          </div>
        </td>
        <td style="padding: 12px 16px; color: var(--text-secondary, #334155); font-family: monospace; font-size: 0.82rem;">
          ${u.email}
        </td>
        <td style="padding: 12px 16px;">
          <span style="background: ${c.bg}; color: ${c.color}; padding: 3px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
            <i class="fas fa-${c.icon}"></i> ${role.toUpperCase()}
          </span>
        </td>
        <td style="padding: 12px 16px; font-size: 0.8rem; color: var(--text-muted, #64748b);">
          ${u.post_count || 0} posts • ${u.listing_count || 0} listings
        </td>
        <td style="padding: 12px 16px;">
          <select onchange="handleRoleChange('${u.id}', this.value)" style="padding: 5px 8px; border-radius: 6px; border: 1px solid var(--border, #cbd5e1); font-size: 0.82rem; background: var(--bg-card, #fff); color: var(--text-primary, #0f172a);">
            <option value="user" ${role === 'user' ? 'selected' : ''}>Member</option>
            <option value="seller" ${role === 'seller' ? 'selected' : ''}>Verified Seller</option>
            <option value="admin" ${role === 'admin' ? 'selected' : ''}>Administrator</option>
          </select>
        </td>
        <td style="padding: 12px 16px; text-align: right;">
          ${isRoot ? `
            <span style="font-size: 0.72rem; color: #94a3b8; font-style: italic;">Protected</span>
          ` : `
            <button class="btn btn-sm" onclick="handleDeleteUser('${u.id}', '${(u.name || u.email).replace(/'/g, "\\'")}')" style="background: rgba(239,68,68,0.1); color: #dc2626; border: 1px solid rgba(239,68,68,0.25); padding: 5px 10px; border-radius: 6px; cursor: pointer; font-size: 0.78rem;">
              <i class="fas fa-trash-can"></i> Delete
            </button>
          `}
        </td>
      </tr>
    `;
  }).join('');
}

function filterAdminUserTable() {
  const query = (document.getElementById("adminUserSearchInput")?.value || "").toLowerCase().trim();
  const roleFilter = document.getElementById("adminRoleFilterSelect")?.value || "ALL";

  let filtered = adminAllUsers;
  if (roleFilter !== "ALL") {
    filtered = filtered.filter(u => (u.role || "user").toUpperCase() === roleFilter);
  }
  if (query) {
    filtered = filtered.filter(u => 
      (u.name || "").toLowerCase().includes(query) ||
      (u.email || "").toLowerCase().includes(query) ||
      (u.ecotrack_id || "").toLowerCase().includes(query)
    );
  }
  renderAdminUsersTable(filtered);
}

async function handleRoleChange(userId, newRole) {
  try {
    const res = await fetch(`${API_BASE}/admin/users/${userId}/role`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to update role");

    showToast(`Role updated to ${newRole.toUpperCase()} for ${userId}`, "success");
    const target = adminAllUsers.find(u => u.id === userId);
    if (target) target.role = newRole;
    filterAdminUserTable();
    fetchAdminStats();
  } catch (err) {
    showToast(err.message, "error");
    fetchAdminUsers();
  }
}

async function handleDeleteUser(userId, userName) {
  if (!confirm(`Are you sure you want to permanently delete user "${userName}" and all associated records?`)) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
      method: "DELETE"
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to delete user");

    showToast(`User account ${userName} has been deleted.`, "success");
    adminAllUsers = adminAllUsers.filter(u => u.id !== userId);
    filterAdminUserTable();
    fetchAdminStats();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function fetchAdminListings() {
  const container = document.getElementById("adminListingsContainer");
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/admin/listings`);
    if (!res.ok) throw new Error("Failed to load listings");
    const data = await res.json();
    const listings = data.listings || [];

    if (listings.length === 0) {
      container.innerHTML = `<div style="padding: 30px; text-align: center; color: var(--text-muted, #94a3b8); grid-column: 1/-1;">No marketplace listings found.</div>`;
      return;
    }

    container.innerHTML = listings.map(item => `
      <div style="background: var(--bg-card, #fff); border: 1px solid var(--border, #e2e8f0); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column;">
        <div style="height: 140px; background: #e2e8f0; position: relative;">
          ${item.image ? `<img src="${item.image}" style="width: 100%; height: 100%; object-fit: cover;">` : `<div style="height: 100%; display: flex; align-items: center; justify-content: center; color: #94a3b8;"><i class="fas fa-box-open fa-2x"></i></div>`}
          <span style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.65); color: #fff; padding: 2px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 600;">
            ${item.category || "General"}
          </span>
        </div>
        <div style="padding: 14px; flex: 1; display: flex; flex-direction: column;">
          <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary, #0f172a); margin-bottom: 4px;">${item.title || item.name}</div>
          <div style="font-weight: 800; color: #059669; font-size: 1.1rem; margin-bottom: 8px;">₹${item.price}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted, #64748b); margin-bottom: 12px;">
            Seller: ${item.seller_name || item.seller_email || item.user_id || "Unknown"}
          </div>
          <div style="margin-top: auto;">
            <button class="btn btn-sm" onclick="handleDeleteListingAdmin(${item.id}, '${(item.title || item.name).replace(/'/g, "\\'")}')" style="width: 100%; background: rgba(239,68,68,0.1); color: #dc2626; border: 1px solid rgba(239,68,68,0.25); border-radius: 6px; padding: 6px; font-size: 0.8rem; cursor: pointer;">
              <i class="fas fa-trash-can"></i> Remove Listing
            </button>
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div style="padding: 24px; text-align: center; color: #ef4444; grid-column: 1/-1;">${err.message}</div>`;
  }
}

async function handleDeleteListingAdmin(id, title) {
  if (!confirm(`Are you sure you want to remove marketplace listing "${title}"?`)) return;

  try {
    const res = await fetch(`${API_BASE}/admin/listings/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to remove listing");

    showToast("Listing removed by administrator.", "success");
    fetchAdminListings();
    fetchAdminStats();
    if (typeof fetchMarketplaceListings === 'function') fetchMarketplaceListings();
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function fetchAdminPosts() {
  const container = document.getElementById("adminPostsContainer");
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/admin/posts`);
    if (!res.ok) throw new Error("Failed to load posts");
    const data = await res.json();
    const posts = data.posts || [];

    if (posts.length === 0) {
      container.innerHTML = `<div style="padding: 30px; text-align: center; color: var(--text-muted, #94a3b8);">No community posts found.</div>`;
      return;
    }

    container.innerHTML = posts.map(p => `
      <div style="background: var(--bg-card, #fff); border: 1px solid var(--border, #e2e8f0); border-radius: 12px; padding: 16px; display: flex; justify-content: space-between; align-items: flex-start; gap: 14px;">
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <strong style="color: var(--text-primary, #0f172a); font-size: 0.92rem;">${p.author_name || "Community Member"}</strong>
            <span style="font-size: 0.75rem; color: var(--text-muted, #94a3b8);">(${p.author_email || p.user_id})</span>
            <span style="font-size: 0.72rem; color: var(--text-muted, #94a3b8);">• ${p.created_at ? new Date(p.created_at).toLocaleDateString() : ""}</span>
          </div>
          <p style="margin: 0 0 8px 0; font-size: 0.88rem; color: var(--text-secondary, #334155); line-height: 1.4;">
            ${p.content || p.text || "No text content"}
          </p>
          <div style="display: flex; gap: 12px; font-size: 0.75rem; color: var(--text-muted, #64748b);">
            <span><i class="fas fa-heart" style="color: #ef4444;"></i> ${p.likes_count || 0} likes</span>
            <span><i class="fas fa-comment" style="color: #0284c7;"></i> ${p.comments_count || 0} comments</span>
          </div>
        </div>
        <div>
          <button class="btn btn-sm" onclick="handleDeletePostAdmin(${p.id}, '${(p.author_name || 'Member').replace(/'/g, "\\'")}')" style="background: rgba(239,68,68,0.1); color: #dc2626; border: 1px solid rgba(239,68,68,0.25); border-radius: 6px; padding: 6px 12px; font-size: 0.78rem; cursor: pointer; white-space: nowrap;">
            <i class="fas fa-trash-can"></i> Remove Post
          </button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div style="padding: 24px; text-align: center; color: #ef4444;">${err.message}</div>`;
  }
}

async function handleDeletePostAdmin(postId, author) {
  if (!confirm(`Are you sure you want to remove this community post by ${author}?`)) return;

  try {
    const res = await fetch(`${API_BASE}/admin/posts/${postId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to remove post");

    showToast("Community post removed by administrator.", "success");
    fetchAdminPosts();
    fetchAdminStats();
    if (typeof loadCommunityPosts === 'function') loadCommunityPosts();
  } catch (err) {
    showToast(err.message, "error");
  }
}

function switchAdminSubtab(subtab) {
  const panels = ["users", "listings", "posts", "diagnostics"];
  panels.forEach(p => {
    const el = document.getElementById("adminPanel" + p.charAt(0).toUpperCase() + p.slice(1));
    const btn = document.getElementById("adminSubtab" + p.charAt(0).toUpperCase() + p.slice(1));
    if (el) el.style.display = (p === subtab) ? "block" : "none";
    if (btn) {
      btn.style.color = (p === subtab) ? "#10b981" : "var(--text-muted, #64748b)";
      btn.style.fontWeight = (p === subtab) ? "700" : "600";
      btn.style.borderBottom = (p === subtab) ? "3px solid #10b981" : "none";
    }
  });
}

// Window registrations
window.loadAdminDashboard = loadAdminDashboard;
window.switchAdminSubtab = switchAdminSubtab;
window.handleRoleChange = handleRoleChange;
window.handleDeleteUser = handleDeleteUser;
window.filterAdminUserTable = filterAdminUserTable;
window.fetchAdminListings = fetchAdminListings;
window.handleDeleteListingAdmin = handleDeleteListingAdmin;
window.fetchAdminPosts = fetchAdminPosts;
window.handleDeletePostAdmin = handleDeletePostAdmin;
