/**
 * EcoTrack Community Feed Engine
 * Instagram / LinkedIn style animal welfare social platform.
 */

let activeFeedFilter = 'All';
let activeHashtagFilter = '';
let activeSearchQuery = '';

// Pagination & Infinite Scroll States
let currentPage = 1;
const postsPerPage = 10;
let isFetching = false;
let hasMorePosts = true;
let loadedPosts = []; // Local cache of currently loaded posts
let allRecommendedUsers = []; // Cached recommendations for View All modal

// Periodic message check and notifications sync
let messageNotificationCheckInterval = null;

function startMessageNotificationCheck() {
  if (messageNotificationCheckInterval) clearInterval(messageNotificationCheckInterval);
  
  // Check notifications immediately, then every 3 seconds
  checkNotificationsAndMessages();
  messageNotificationCheckInterval = setInterval(checkNotificationsAndMessages, 3000);
}

async function checkNotificationsAndMessages() {
  if (!window.currentUser) return;
  try {
    // 1. Fetch notifications for dropdown
    const notifs = await window.EcoSocialDB.fetchNotifications();
    renderCommunityNotifications(notifs);

    // 2. Fetch conversations to check for unread counts
    const res = await fetch(`${window.EcoSocialDB.apiBase}/messages/conversations`, { headers: window.EcoSocialDB.getAuthHeader() });
    if (res.ok) {
      const data = await res.json();
      const conversations = data.conversations || [];
      
      // Calculate total unread messages count
      let totalUnread = 0;
      conversations.forEach(c => {
        totalUnread += Number(c.unread_count || 0);
      });

      // Update sidebar active chats badge
      const activeChatsContainer = document.getElementById('chatConversationsList');
      if (activeChatsContainer && document.getElementById('messagingDrawerModal') && !document.getElementById('messagingDrawerModal').classList.contains('hidden')) {
        renderConversations(conversations, activeChatsContainer);
      }

      // Update the main header message badge
      const topBadge = document.getElementById('unreadMessagesCountBadge');
      if (topBadge) {
        if (totalUnread > 0) {
          topBadge.textContent = totalUnread;
          topBadge.style.display = 'flex';
        } else {
          topBadge.style.display = 'none';
        }
      }
    }
  } catch (e) {
    console.warn('Error in periodic notification sync:', e);
  }
}

function toggleCommunityNotificationsDropdown() {
  // Notifications dropdown replaced by messages drawer
}

function renderCommunityNotifications(notifs) {
  const listContainer = document.getElementById('communityNotificationsList');
  const badge = document.getElementById('unreadMessagesCountBadge');
  if (!listContainer) return;

  const unreadNotifs = notifs.filter(n => n.is_read === 0);
  if (badge) {
    if (unreadNotifs.length > 0) {
      badge.textContent = unreadNotifs.length;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  if (!notifs.length) {
    listContainer.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:12px;">No new notifications</div>`;
    return;
  }

  listContainer.innerHTML = notifs.map(n => {
    const avatar = n.actor_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(n.actor_name || 'User')}&background=10b981&color=fff`;
    const readStyle = n.is_read ? 'opacity: 0.75;' : 'font-weight: 700; background: var(--primary-ultra-light);';
    let clickAction = '';
    if (n.type === 'message' || n.type === 'chat') {
      clickAction = `onclick="markNotificationAsRead(${n.id}); if(window.openMessagingDrawer) window.openMessagingDrawer('${n.actor_id}')"`;
    } else {
      clickAction = `onclick="markNotificationAsRead(${n.id}); viewUserProfile('${n.actor_id}')"`;
    }
    
    return `
      <div class="notification-item" ${clickAction} style="display:flex; align-items:center; gap:10px; padding:10px; border-radius:10px; cursor:pointer; transition:background 0.2s; ${readStyle}">
        <img src="${avatar}" class="avatar-sm" style="width:30px; height:30px; border-radius:50%;" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=User'">
        <div style="flex:1; font-size:12.5px; text-align:left; color:var(--text-primary);">
          <span style="font-weight:800;">${escapeHtml(n.actor_name)}</span> ${escapeHtml(n.message)}
          <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">${formatTimeAgo(n.created_at)}</div>
        </div>
        ${!n.is_read ? `<div style="width:8px; height:8px; border-radius:50%; background:var(--primary);"></div>` : ''}
      </div>
    `;
  }).join('');
}

async function markNotificationAsRead(notifId) {
  try {
    await fetch(`${window.EcoSocialDB.apiBase}/notifications/${notifId}/read`, {
      method: 'POST',
      headers: window.EcoSocialDB.getAuthHeader()
    });
    checkNotificationsAndMessages();
  } catch (e) {
    console.warn('Failed to mark notification as read:', e);
  }
}

async function markAllNotificationsAsRead() {
  try {
    await fetch(`${window.EcoSocialDB.apiBase}/notifications/read-all`, {
      method: 'POST',
      headers: window.EcoSocialDB.getAuthHeader()
    });
    checkNotificationsAndMessages();
  } catch (e) {
    console.warn('Failed to clear notifications:', e);
  }
}

async function initCommunityFeed(isNextPage = false) {
  if (isFetching) return;
  if (isNextPage && !hasMorePosts) return;

  // Start notification sync loop when page is loaded
  startMessageNotificationCheck();

  isFetching = true;
  const container = document.getElementById('communityPostsContainer');
  const endLoader = document.getElementById('feedEndLoader');
  if (!container) {
    isFetching = false;
    return;
  }

  if (!isNextPage) {
    currentPage = 1;
    hasMorePosts = true;
    loadedPosts = [];
    container.innerHTML = `
      <div style="text-align:center; padding:40px; color:var(--text-muted);">
        <i class="fas fa-spinner fa-spin fa-2x" style="color:var(--primary); margin-bottom:12px;"></i>
        <div>Syncing community updates...</div>
      </div>
    `;
  } else if (endLoader) {
    endLoader.style.display = 'block';
  }

  const currentUserId = window.currentUser ? window.currentUser.id : null;
  
  try {
    const posts = await window.EcoSocialDB.fetchPosts({
      filter: activeFeedFilter,
      hashtag: activeHashtagFilter,
      search: activeSearchQuery,
      page: currentPage,
      limit: postsPerPage
    });

    if (endLoader) endLoader.style.display = 'none';

    if (!posts || posts.length < postsPerPage) {
      hasMorePosts = false;
    }

    if (!isNextPage) {
      loadedPosts = posts || [];
      renderPostsList(loadedPosts, container);
    } else {
      if (posts && posts.length) {
        loadedPosts = loadedPosts.concat(posts);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = posts.map(post => renderPostCardHtml(post)).join('');
        while (tempDiv.firstChild) {
          container.appendChild(tempDiv.firstChild);
        }
      }
    }
  } catch (err) {
    console.error('Error loading community feed:', err);
    if (!isNextPage) {
      container.innerHTML = `
        <div class="card error-state" style="text-align:center; padding:40px; border-color:var(--danger); border-radius:16px;">
          <h3 style="color:var(--danger); margin-bottom:10px;"><i class="fas fa-exclamation-triangle"></i> Feed Offline</h3>
          <p style="color:var(--text-muted); margin-bottom:16px;">Failed to sync with social network database.</p>
          <button class="btn btn-primary" onclick="initCommunityFeed()">Try Again</button>
        </div>
      `;
    }
  } finally {
    isFetching = false;
  }

  if (!isNextPage) {
    loadSuggestedUsers();
    loadTrendingTopics();
  }
}

async function loadSuggestedUsers() {
  const container = document.getElementById('suggestedUsersList');
  if (!container) return;

  const currentUserId = window.currentUser ? window.currentUser.id : null;
  allRecommendedUsers = currentUserId ? await window.EcoSocialDB.fetchRecommendations() : [];

  // Exclude current user from suggestions
  allRecommendedUsers = allRecommendedUsers.filter(u => u.id !== currentUserId);

  // Take initial 4 recommendations
  const initialDisplay = allRecommendedUsers.slice(0, 4);

  if (!initialDisplay || !initialDisplay.length) {
    container.innerHTML = `<div style="font-size:12px; color:var(--text-muted); text-align:center; padding:10px;">No recommendations available.</div>`;
    return;
  }

  container.innerHTML = initialDisplay.map(u => {
    const avatar = u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=10b981&color=fff`;
    return `
      <div class="suggested-user-row">
        <div style="display:flex; align-items:center; gap:10px; cursor:pointer; overflow:hidden; flex:1;" onclick="viewUserProfile('${u.id}')">
          <img src="${avatar}" class="avatar-sm" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=User'">
          <div style="overflow:hidden; text-align:left;">
            <div style="font-weight:800; font-size:13px; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${escapeHtml(u.name)}
            </div>
            <div style="font-size:11px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${u.vet_status ? '🩺 Vet Specialist' : (u.trainer_certs ? '🏋️ Trainer' : '🐾 Volunteer')}
            </div>
          </div>
        </div>
        <button class="btn btn-secondary scale-hover" style="padding:4px 10px; font-size:11px; border-radius:14px; font-weight:800; color:var(--primary); background:#fff; border:1px solid var(--border-color);" onclick="toggleFollowUser('${u.id}', this)">
          Follow
        </button>
      </div>
    `;
  }).join('');
}

function openAllRecommendationsModal() {
  let modal = document.getElementById('allRecommendationsModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'allRecommendationsModal';
    modal.className = 'modal-backdrop';
    modal.onclick = (e) => { if (e.target === modal) closeAllRecommendationsModal(); };
    modal.innerHTML = `
      <div class="modal-card" style="max-width:480px; border-radius:24px;">
        <div class="modal-header" style="border-bottom:1px solid var(--border-color); padding:16px 20px;">
          <h3 class="modal-title" style="font-weight:900; font-size:16px; margin:0; display:flex; align-items:center; gap:8px;">
            <i class="fas fa-users" style="color:var(--primary);"></i> Recommended Experts
          </h3>
          <button class="modal-close" onclick="closeAllRecommendationsModal()" style="border:none; background:none; font-size:16px; cursor:pointer;">✕</button>
        </div>
        <div class="modal-body" id="allRecommendationsList" style="display:flex; flex-direction:column; gap:12px; max-height:400px; overflow-y:auto; padding:20px;">
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  const listContainer = document.getElementById('allRecommendationsList');
  if (listContainer) {
    if (!allRecommendedUsers || !allRecommendedUsers.length) {
      listContainer.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted);">No recommendations available.</div>`;
    } else {
      listContainer.innerHTML = allRecommendedUsers.map(u => {
        const avatar = u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=10b981&color=fff`;
        return `
          <div class="suggested-user-row" style="padding:10px 14px; display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:12px; cursor:pointer; overflow:hidden; flex:1;" onclick="closeAllRecommendationsModal(); viewUserProfile('${u.id}')">
              <img src="${avatar}" class="avatar-sm" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=User'">
              <div style="overflow:hidden; text-align:left;">
                <div style="font-weight:800; font-size:13.5px; color:var(--text-primary);">${escapeHtml(u.name)}</div>
                <div style="font-size:11px; color:var(--text-muted);">${u.vet_status ? '🩺 Verified Veterinarian' : (u.trainer_certs ? '🏋️ Certified Trainer' : '🐾 Conservationist')}</div>
              </div>
            </div>
            <button class="btn btn-secondary scale-hover" style="padding:6px 14px; font-size:12px; border-radius:20px; font-weight:800; color:var(--primary); border:1px solid var(--border-color);" onclick="toggleFollowUser('${u.id}', this)">
              Follow
            </button>
          </div>
        `;
      }).join('');
    }
  }

  modal.classList.add('active');
  modal.style.display = 'flex';
}

function closeAllRecommendationsModal() {
  const modal = document.getElementById('allRecommendationsModal');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
}

function loadTrendingTopics() {
  const container = document.getElementById('trendingTopicsContainer');
  if (!container) return;

  const topics = [
    { tag: 'VetCare', count: 142 },
    { tag: 'WildlifeRescue', count: 98 },
    { tag: 'AgilityCoach', count: 64 },
    { tag: 'BioShield', count: 45 },
    { tag: 'EcoTrack', count: 198 }
  ];

  container.innerHTML = topics.map(t => `
    <span class="hashtag-pill" onclick="filterByHashtag('${t.tag}')">
      #${t.tag} <span style="opacity:0.75; font-size:10px; font-weight:500; margin-left:2px;">${t.count}</span>
    </span>
  `).join('');
}

async function toggleFollowUser(targetId, btnEl) {
  if (!window.currentUser) { showToast('Please sign in to follow users.', 'error'); return; }
  const currentUserId = window.currentUser.id;
  const res = await window.EcoSocialDB.toggleFollow(currentUserId, targetId);
  if (btnEl) {
    if (res.is_pending) {
      btnEl.textContent = 'Requested';
      btnEl.classList.add('btn-secondary');
      showToast('Follow request sent!', 'info');
    } else if (res.is_following) {
      btnEl.textContent = 'Following';
      btnEl.classList.add('btn-secondary');
      showToast('You are now following this profile!', 'success');
    } else {
      btnEl.textContent = 'Follow';
      btnEl.classList.remove('btn-secondary');
      btnEl.classList.add('btn-primary');
    }
  }

  // If viewing this profile, refresh profile details dynamically to update followers count
  const profileNameEl = document.getElementById('viewProfileName');
  const viewProfileModal = document.getElementById('viewProfileModal');
  if (viewProfileModal && viewProfileModal.classList.contains('active') && window.activeViewedProfileId === targetId) {
    if (window.openViewProfileModal) window.openViewProfileModal(targetId);
  }
  
  const mainProfileSec = document.getElementById('profile');
  if (mainProfileSec && mainProfileSec.style.display !== 'none' && window.loadProfileTab) {
     window.loadProfileTab(window.currentUser.id);
  }
}

function setFeedFilter(filterName, btnEl) {
  activeFeedFilter = filterName;
  activeHashtagFilter = '';
  document.querySelectorAll('.feed-filter-btn').forEach(btn => {
    btn.classList.remove('active', 'btn-primary');
    btn.classList.add('btn-secondary');
  });
  if (btnEl) {
    btnEl.classList.remove('btn-secondary');
    btnEl.classList.add('btn-primary', 'active');
  }
  initCommunityFeed();
}

function filterByHashtag(tag) {
  activeHashtagFilter = tag.replace('#', '');
  activeFeedFilter = 'All';
  showToast(`Filtering by topic: #${activeHashtagFilter}`, 'info');
  
  const searchInput = document.getElementById('socialSearchInput');
  if (searchInput) searchInput.value = `#${activeHashtagFilter}`;
  
  initCommunityFeed();
}

function filterByLocation(loc) {
  activeSearchQuery = loc;
  activeFeedFilter = 'All';
  showToast(`Filtering by location: ${loc}`, 'info');
  
  const searchInput = document.getElementById('socialSearchInput');
  if (searchInput) searchInput.value = loc;

  initCommunityFeed();
}

function filterBySpecies(spec) {
  activeSearchQuery = spec;
  activeFeedFilter = 'All';
  showToast(`Filtering by species: ${spec}`, 'info');
  
  const searchInput = document.getElementById('socialSearchInput');
  if (searchInput) searchInput.value = spec;

  initCommunityFeed();
}

function onSocialSearchInput(val) {
  activeSearchQuery = val.trim();
  initCommunityFeed();
}

function renderPostsList(posts, container) {
  if (!posts || !posts.length) {
    container.innerHTML = `
      <div class="card" style="text-align:center; padding:60px 20px; border-radius:16px; border:1px solid var(--border-color); background:var(--bg-card);">
        <i class="fas fa-comments" style="font-size:48px; color:var(--primary); opacity:0.4; margin-bottom:16px;"></i>
        <h3 style="margin-bottom:8px; font-weight:800; color:var(--text-primary);">No Community Posts Found</h3>
        <p style="color:var(--text-muted); max-width:400px; margin:0 auto 20px; font-size:13.5px;">Be the first to share veterinary tips, rescue updates, or training milestones with animal lovers worldwide!</p>
        <button class="btn btn-primary" onclick="openCreatePostModal()">
          <i class="fas fa-plus-circle"></i> Create First Post
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = posts.map(post => renderPostCardHtml(post)).join('');
}

function formatPostText(text) {
  if (!text) return '';
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/\n/g, '<br>');
  html = html.replace(/#(\w+)/g, '<span class="hashtag-link" onclick="filterByHashtag(\'$1\')">#$1</span>');
  html = html.replace(/@(\w+)/g, '<span class="mention-link" onclick="viewUserProfile(\'$1\')">@$1</span>');
  return html;
}

function renderPostCardHtml(post) {
  const isVet = post.vet_status || post.post_type === 'veterinary';
  const vetBadge = isVet ? `<span class="vet-badge" title="Verified Veterinarian" style="display:inline-flex; align-items:center; gap:4px; font-size:10.5px; font-weight:800; background:rgba(16,185,129,0.12); color:var(--primary); padding:2px 8px; border-radius:12px;"><i class="fas fa-stethoscope"></i> Vet Specialist</span>` : '';
  const timeAgo = formatTimeAgo(post.created_at);
  const privacyIcon = post.privacy_visibility === 'Private' ? '🔒' : post.privacy_visibility === 'Followers Only' ? '👥' : '🌍';

  const authorAvatar = post.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author_name || 'User')}&background=10b981&color=fff`;
  const formattedContent = formatPostText(post.content);

  // Category Badge mapping
  let categoryBadgeHtml = '';
  if (post.post_type) {
    const cat = post.post_type.toLowerCase();
    let label = '✨ General';
    let css = 'cat-general';
    if (cat === 'veterinary') { label = '🩺 Vet Care'; css = 'cat-veterinary'; }
    else if (cat === 'training') { label = '🏋️ Training'; css = 'cat-training'; }
    else if (cat === 'rescue') { label = '🛡️ Rescue'; css = 'cat-rescue'; }
    else if (cat === 'marketplace') { label = '🛒 Market'; css = 'cat-marketplace'; }

    categoryBadgeHtml = `<span class="category-badge ${css}" style="font-size:11px; font-weight:800; padding:4px 10px; border-radius:20px;">${label}</span>`;
  }

  // Media gallery - sleek, high clarity, balanced aspect ratio
  let mediaHtml = '';
  const validMediaUrls = (post.media_urls || []).filter(url => url && url.trim().startsWith('http'));
  if (validMediaUrls && validMediaUrls.length) {
    const count = validMediaUrls.length;
    const gridStyle = count === 1
      ? 'display:block;'
      : count === 2
        ? 'display:grid; grid-template-columns:1fr 1fr; gap:6px;'
        : count === 3
          ? 'display:grid; grid-template-columns:2fr 1fr; grid-template-rows:1fr 1fr; gap:6px;'
          : 'display:grid; grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr; gap:6px;';

    const mediaItems = validMediaUrls.slice(0, 4).map((url, i) => {
      const isVideo = post.media_types && post.media_types[i] === 'video';
      const spanStyle = count === 3 && i === 0 ? 'grid-row: span 2;' : '';
      if (isVideo) {
        return `<div style="${spanStyle} overflow:hidden; max-height:${count === 1 ? '360px' : '220px'}; max-width:${count === 1 ? '480px' : '100%'}; margin:${count === 1 ? '0 auto' : '0'}; border-radius:12px; background:#000; display:flex; align-items:center; justify-content:center; width:100%;"><video src="${url}" controls style="width:100%; max-height:${count === 1 ? '360px' : '220px'}; object-fit:contain;" onerror="this.style.display='none'"></video></div>`;
      }
      if (count === 1) {
        return `<div style="overflow:hidden; max-height:360px; min-height:160px; position:relative; background:var(--bg-main); display:flex; align-items:center; justify-content:center; border-radius:12px; width:100%; max-width:480px; margin:0 auto;">
          <img src="${url}" alt="Post media" class="post-media-img" style="max-width:100%; width:auto; height:auto; max-height:360px; object-fit:contain; display:block; margin:0 auto; transition:transform 0.3s ease;" loading="lazy" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=600'">
        </div>`;
      }
      return `<div style="${spanStyle} overflow:hidden; height:200px; position:relative; background:var(--bg-main); display:flex; align-items:center; justify-content:center; border-radius:12px; border:1px solid var(--border-color);">
        <img src="${url}" alt="Post media" style="width:100%; height:100%; object-fit:cover; display:block; transition:transform 0.3s ease;" loading="lazy" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=600'">
        ${i === 3 && validMediaUrls.length > 4 ? `<div style="position:absolute;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;font-weight:900;border-radius:12px;backdrop-filter:blur(2px);">+${validMediaUrls.length - 4}</div>` : ''}
      </div>`;
    }).join('');

    mediaHtml = `<div class="post-media-container" style="${gridStyle}">${mediaItems}</div>`;
  }

  // Attachments (Training Certificate, Rescue Record)
  let attachmentHtml = '';
  if (post.training_achievement) {
    const t = post.training_achievement;
    attachmentHtml += `
      <div class="post-attachment-card training-attachment" style="border-radius:14px; padding:12px 14px; border:1px solid var(--border-color); margin-top:10px; background:var(--bg-main); display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:10.5px; font-weight:800; color:#f59e0b; text-transform:uppercase; display:flex; align-items:center; gap:5px;"><i class="fas fa-trophy"></i> Training Milestone</div>
          <div style="font-weight:800; font-size:13.5px; color:var(--text-primary); margin-top:2px;">${escapeHtml(t.planTitle || 'Agility Milestone')}</div>
        </div>
        <div style="font-size:13.5px; font-weight:900; color:#f59e0b; background:rgba(245,158,11,0.12); padding:4px 10px; border-radius:10px;">+${t.xpEarned || 250} XP</div>
      </div>
    `;
  }

  // Direct message button next to three dots menu (only shown for other users)
  const currentUid = window.currentUser ? String(window.currentUser.id) : null;
  const isOwnPost = currentUid && (String(post.user_id) === currentUid || (window.currentUser.ecotrack_id && post.author_ecotrack_id === window.currentUser.ecotrack_id));
  const safeAuthorName = (post.author_name || 'Member').replace(/'/g, "\\'");
  const messageBtnHtml = !isOwnPost ? `
    <button class="btn-icon scale-hover" title="Send Direct Message to ${escapeHtml(post.author_name || 'Member')}" onclick="event.stopPropagation(); if(window.openDirectMessageModal) window.openDirectMessageModal('${post.user_id}', '${safeAuthorName}');" style="width:32px; height:32px; border-radius:50%; border:1px solid var(--border-color); background:var(--bg-main); color:var(--primary); cursor:pointer; display:flex; align-items:center; justify-content:center;">
      <i class="far fa-comment-dots" style="font-size:13px;"></i>
    </button>
  ` : '';

  return `
    <div class="card post-card" id="post-card-${post.id}" style="border-radius:18px; border:1px solid var(--border-color); background:var(--bg-card); padding:16px; display:flex; flex-direction:column; gap:10px; transition:box-shadow 0.2s ease, border-color 0.2s ease;">
      <div>
        <!-- Post Header -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <div style="display:flex; align-items:center; gap:10px; cursor:pointer; flex:1; overflow:hidden;" onclick="viewUserProfile('${post.user_id}')">
            <img src="${authorAvatar}" class="avatar-md" alt="${escapeHtml(post.author_name)}" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=User&background=10b981&color=fff'" style="width:40px; height:40px; border-radius:50%; border:1.5px solid var(--border-color); flex-shrink:0;">
            <div style="overflow:hidden;">
              <div style="font-weight:800; font-size:14px; display:flex; align-items:center; gap:6px; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                <span>${escapeHtml(post.author_name)}</span>
                ${vetBadge}
              </div>
              <div style="font-size:11.5px; color:var(--text-muted); display:flex; align-items:center; gap:5px; margin-top:2px;">
                <span>${post.author_ecotrack_id || '@ecotrack'}</span>
                <span>•</span>
                <span>${timeAgo}</span>
                <span>•</span>
                <span title="Visibility">${privacyIcon}</span>
              </div>
            </div>
          </div>
          
          <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
            ${categoryBadgeHtml}
            ${messageBtnHtml}
            <div style="position:relative;">
              <button class="btn-icon scale-hover" onclick="togglePostMenu(${post.id}, event)" style="width:32px; height:32px; border-radius:50%; border:1px solid var(--border-color); background:var(--bg-main); color:var(--text-muted); cursor:pointer; display:flex; align-items:center; justify-content:center;"><i class="fas fa-ellipsis-h" style="font-size:12px;"></i></button>
            </div>
          </div>
        </div>

        <!-- Post Content -->
        <div style="font-size:13.5px; line-height:1.55; color:var(--text-primary); margin-bottom:8px; text-align:left; word-break:break-word;">
          ${formattedContent}
        </div>

        ${mediaHtml}
        ${attachmentHtml}

        <!-- Interactive Species & Location Tags -->
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:8px;">
          ${post.location_tag ? `<span class="interactive-pill" onclick="filterByLocation('${escapeHtml(post.location_tag)}')" style="cursor:pointer; display:inline-flex; align-items:center; gap:4px; font-size:11.5px; font-weight:700; color:var(--text-secondary); background:var(--bg-main); border:1px solid var(--border-color); padding:3px 10px; border-radius:12px;"><i class="fas fa-location-dot" style="color:var(--primary); font-size:10px;"></i> ${escapeHtml(post.location_tag)}</span>` : ''}
          ${post.animal_tag ? `<span class="interactive-pill" onclick="filterBySpecies('${escapeHtml(post.animal_tag)}')" style="cursor:pointer; display:inline-flex; align-items:center; gap:4px; font-size:11.5px; font-weight:700; color:var(--text-secondary); background:var(--bg-main); border:1px solid var(--border-color); padding:3px 10px; border-radius:12px;"><i class="fas fa-paw" style="color:var(--primary); font-size:10px;"></i> ${escapeHtml(post.animal_tag)}</span>` : ''}
        </div>
      </div>

      <div>
        <!-- Post Action Counter Bar -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; padding-top:10px; border-top:1px solid var(--border-color);">
          <button class="post-action-btn heart-btn-animate ${post.liked_by_me ? 'liked' : ''}" onclick="togglePostLike(${post.id}, this)" style="display:flex; align-items:center; gap:6px; cursor:pointer; background:none; border:none; color:${post.liked_by_me ? 'var(--danger, #ef4444)' : 'var(--text-secondary)'}; font-size:13px; font-weight:700; padding:4px 8px; border-radius:8px; transition:background 0.2s;">
            <i class="${post.liked_by_me ? 'fas' : 'far'} fa-heart" style="${post.liked_by_me ? 'color:#ef4444;' : ''}"></i>
            <span class="like-count" style="font-weight:800;">${post.likes_count || 0}</span>
          </button>

          <button class="post-action-btn scale-hover" onclick="toggleCommentsSection(${post.id})" style="display:flex; align-items:center; gap:6px; cursor:pointer; background:none; border:none; color:var(--text-secondary); font-size:13px; font-weight:700; padding:4px 8px; border-radius:8px; transition:background 0.2s;">
            <i class="far fa-comment"></i>
            <span class="comment-count" style="font-weight:800;">${post.comments_count || 0}</span>
          </button>

          <button class="post-action-btn scale-hover ${post.saved_by_me ? 'saved' : ''}" onclick="togglePostBookmark(${post.id}, this)" style="display:flex; align-items:center; gap:6px; cursor:pointer; background:none; border:none; color:${post.saved_by_me ? 'var(--primary)' : 'var(--text-secondary)'}; font-size:13px; font-weight:700; padding:4px 8px; border-radius:8px; transition:background 0.2s;">
            <i class="${post.saved_by_me ? 'fas' : 'far'} fa-bookmark" style="${post.saved_by_me ? 'color:var(--primary);' : ''}"></i>
            <span style="font-weight:800;">${post.saved_by_me ? 'Saved' : 'Save'}</span>
          </button>

          <button class="post-action-btn scale-hover" onclick="openShareModal(${post.id})" style="display:flex; align-items:center; gap:6px; cursor:pointer; background:none; border:none; color:var(--text-secondary); font-size:13px; font-weight:700; padding:4px 8px; border-radius:8px; transition:background 0.2s;">
            <i class="far fa-paper-plane"></i>
            <span style="font-weight:800;">Share</span>
          </button>
        </div>

        <!-- Comments Section (Lazy-Loaded / Expandable) -->
        <div id="comments-section-${post.id}" class="comments-section" style="display:none; margin-top:12px; padding-top:12px; border-top:1px dashed var(--border-color);">
          <!-- Add Comment Input Form (shown only when signed in) -->
          <div id="comment-input-row-${post.id}" style="display:flex; gap:8px; margin-bottom:12px; align-items:center;">
            <img id="comment-avatar-${post.id}" src="https://ui-avatars.com/api/?name=Me&background=10b981&color=fff" class="avatar-sm" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=Me'" style="width:30px; height:30px; border-radius:50%; border:1px solid var(--border-color); flex-shrink:0;">
            <div style="flex:1; display:flex; gap:6px; background:var(--bg-main); border:1px solid var(--border-color); border-radius:24px; padding:3px 4px 3px 12px; align-items:center;">
              <input type="text" id="comment-input-${post.id}" class="form-input" placeholder="Write a comment..." style="border:none; background:transparent; font-size:12.5px; color:var(--text-primary); width:100%; outline:none; padding:4px 0;" onkeydown="if(event.key==='Enter'&&!event.shiftKey){ event.preventDefault(); submitComment(${post.id}); }">
              <button id="comment-btn-${post.id}" class="btn btn-primary scale-hover" style="border-radius:20px; padding:5px 14px; font-size:11.5px; font-weight:800; white-space:nowrap;" onclick="submitComment(${post.id})">Post</button>
            </div>
          </div>

          <div id="comments-list-${post.id}">
            <!-- Loaded dynamically on comment button trigger -->
          </div>
        </div>
      </div>
    </div>
  `;
}

async function togglePostLike(postId, btnEl) {
  if (!window.currentUser) { showToast('Please sign in to like posts.', 'error'); return; }
  const res = await window.EcoSocialDB.toggleLike(postId);
  if (!res) return;

  const icon = btnEl.querySelector('i');
  const countEl = btnEl.querySelector('.like-count');

  if (res.liked) {
    btnEl.classList.add('liked');
    icon.className = 'fas fa-heart';
  } else {
    btnEl.classList.remove('liked');
    icon.className = 'far fa-heart';
  }
  if (countEl) countEl.textContent = res.likes_count;

  const post = loadedPosts.find(p => p.id === postId);
  if (post) {
    post.liked_by_me = res.liked;
    post.likes_count = res.likes_count;
  }
}

async function togglePostBookmark(postId, btnEl) {
  if (!window.currentUser) { showToast('Please sign in to bookmark posts.', 'error'); return; }
  const res = await window.EcoSocialDB.toggleBookmark(postId);
  if (!res) { showToast('Bookmark failed. Please try again.', 'error'); return; }

  const icon = btnEl.querySelector('i');
  if (res.saved) {
    btnEl.classList.add('saved');
    icon.className = 'fas fa-bookmark';
    showToast('Saved to bookmarks!', 'success');
  } else {
    btnEl.classList.remove('saved');
    icon.className = 'far fa-bookmark';
    showToast('Removed from bookmarks.', 'info');
  }

  const post = loadedPosts.find(p => p.id === postId);
  if (post) {
    post.saved_by_me = res.saved;
    post.saves_count = res.saves_count;
  }
}

async function toggleCommentsSection(postId) {
  const section = document.getElementById(`comments-section-${postId}`);
  const list = document.getElementById(`comments-list-${postId}`);
  if (!section) return;

  const isHidden = section.style.display === 'none';
  if (isHidden) {
    section.style.display = 'block';

    // Update avatar now that we know who is signed in
    const avatarImg = document.getElementById(`comment-avatar-${postId}`);
    if (avatarImg && window.currentUser) {
      const u = window.currentUser;
      avatarImg.src = u.avatar_url || u.avatar ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(u.display_name || u.name || 'Me')}&background=10b981&color=fff`;
    }

    // If not logged in, hide input row and show sign-in notice instead
    const inputRow = document.getElementById(`comment-input-row-${postId}`);
    const btn = document.getElementById(`comment-btn-${postId}`);
    if (!window.currentUser) {
      if (inputRow) {
        inputRow.innerHTML = `
          <div style="width:100%; text-align:center; padding:10px; background:rgba(16,185,129,0.06); border:1px dashed var(--primary); border-radius:12px; font-size:12.5px; color:var(--text-muted);">
            <i class="fas fa-lock" style="color:var(--primary); margin-right:6px;"></i>
            <span>Please <strong style="color:var(--primary); cursor:pointer;" onclick="document.getElementById('loginPage')?.classList.remove('hidden'); document.getElementById('mainApp').style.display='none';">sign in</strong> to post a comment.</span>
          </div>
        `;
      }
    }

    list.innerHTML = `
      <div style="text-align:center; padding:16px; color:var(--text-muted);">
        <i class="fas fa-spinner fa-spin" style="color:var(--primary); margin-right:6px;"></i> Loading comments...
      </div>
    `;
    try {
      const comments = await window.EcoSocialDB.fetchComments(postId);
      list.innerHTML = comments && comments.length ? comments.map(c => renderCommentItemHtml(c, postId)).join('') : `
        <div style="text-align:center; padding:16px; color:var(--text-muted); font-size:12.5px;">
          No comments yet. Share your thoughts!
        </div>
      `;
    } catch (err) {
      console.error('toggleCommentsSection fetchComments error:', err);
      list.innerHTML = `
        <div style="text-align:center; padding:16px; color:var(--danger); font-size:12.5px;">
          Failed to load comments. Please try again.
        </div>
      `;
    }
    setTimeout(() => {
      const input = document.getElementById(`comment-input-${postId}`);
      if (input) input.focus();
    }, 50);
  } else {
    section.style.display = 'none';
  }
}

const activeCommentSubmissions = new Set();

async function submitComment(postId) {
  if (!postId) return;
  const session = window.currentUser || (function() {
    try {
      // Use AUTH_CONFIG.sessionKey which is '@ecotrack_web_session'
      const key = (typeof AUTH_CONFIG !== 'undefined' && AUTH_CONFIG.sessionKey) ? AUTH_CONFIG.sessionKey : '@ecotrack_web_session';
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
  })();

  if (!session || !session.id) {
    showToast('Please sign in to comment.', 'error');
    return;
  }
  if (activeCommentSubmissions.has(postId)) {
    return;
  }

  const input = document.getElementById(`comment-input-${postId}`);
  const btn = document.getElementById(`comment-btn-${postId}`);
  if (!input) return;
  const text = input.value.trim();
  if (!text) {
    input.focus();
    return;
  }

  activeCommentSubmissions.add(postId);
  
  // Visual loading state
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin" style="margin-right:4px;"></i> Posting`;
    btn.style.opacity = '0.7';
  }
  if (input) input.disabled = true;

  try {
    const res = await window.EcoSocialDB.addComment(postId, text);
    if (res && (res.comment_id || res.message === 'Comment added')) {
      const authorName = session.display_name || session.name || 'Community Member';
      const authorAvatar = session.avatar_url || session.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=10b981&color=fff`;
      
      const commentEl = {
        id: res.comment_id || Date.now(),
        user_id: session.id,
        author_name: authorName,
        author_avatar: authorAvatar,
        text: text,
        created_at: new Date().toISOString(),
        replies: []
      };

      const list = document.getElementById(`comments-list-${postId}`);
      if (list) {
        if (list.innerHTML.includes("No comments yet") || list.innerHTML.includes("No comments yet. Share your thoughts!")) {
          list.innerHTML = "";
        }
        const commentHtml = renderCommentItemHtml(commentEl, postId);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = commentHtml;
        list.prepend(tempDiv.firstElementChild);
      }

      // Update all matching comment count badges for this post across the UI
      const countSpans = document.querySelectorAll(`#post-card-${postId} .comment-count`);
      countSpans.forEach(countSpan => {
        const currentCount = parseInt(countSpan.textContent || '0', 10) || 0;
        countSpan.textContent = res.comments_count !== undefined ? res.comments_count : (currentCount + 1);
      });

      // Update loadedPosts in-memory cache
      const postObj = loadedPosts.find(p => p.id === postId || String(p.id) === String(postId));
      if (postObj) {
        postObj.comments_count = res.comments_count !== undefined ? res.comments_count : ((postObj.comments_count || 0) + 1);
      }

      input.value = '';
      showToast('Comment posted!', 'success');
    } else {
      showToast('Failed to post comment. Please try again.', 'error');
    }
  } catch (err) {
    console.error('submitComment error:', err);
    showToast('Failed to post comment. Please try again.', 'error');
  } finally {
    activeCommentSubmissions.delete(postId);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `Post`;
      btn.style.opacity = '1';
    }
    if (input) {
      input.disabled = false;
      input.focus();
    }
  }
}
window.submitComment = submitComment;
window.toggleCommentsSection = toggleCommentsSection;


function renderCommentItemHtml(c, postId) {
  const authorAvatar = c.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.author_name || 'User')}&background=10b981&color=fff`;

  const repliesHtml = (c.replies || []).map(r => `
    <div style="display:flex; gap:8px; margin-top:8px; margin-left:20px; animation: slideInLow 0.3s ease-out; text-align:left;">
      <img src="${r.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.author_name || 'User')}&background=10b981&color=fff`}" class="avatar-xs" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=User'">
      <div style="flex:1; background:var(--card-bg-subtle, rgba(255,255,255,0.03)); padding:6px 10px; border-radius:10px; border:1px solid var(--border-color);">
        <div style="font-weight:800; font-size:11.5px; color:var(--text-primary);">${escapeHtml(r.author_name)}</div>
        <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">${formatPostText(r.text)}</div>
      </div>
    </div>
  `).join('');

  return `
    <div class="comment-item" id="comment-${c.id}" style="margin-top:12px; padding-top:12px; border-top:1px solid var(--border-color); text-align:left;">
      <div style="display:flex; gap:10px;">
        <img src="${authorAvatar}" class="avatar-sm" style="cursor:pointer;" onclick="viewUserProfile('${c.user_id}')" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=User'">
        <div style="flex:1;">
          <div class="comment-bubble" style="background:var(--card-bg-subtle, rgba(255,255,255,0.04)); padding:8px 12px; border-radius:12px; border:1px solid var(--border-color);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span style="font-weight:800; font-size:12.5px; cursor:pointer; color:var(--text-primary);" onclick="viewUserProfile('${c.user_id}')">${escapeHtml(c.author_name)}</span>
              <span style="font-size:10.5px; color:var(--text-muted);">${formatTimeAgo(c.created_at)}</span>
            </div>
            <div style="font-size:12.5px; line-height:1.4; color:var(--text-secondary);">${formatPostText(c.text)}</div>
          </div>
          <div style="display:flex; gap:14px; margin-top:4px; font-size:11.5px; font-weight:800; color:var(--text-muted); padding-left:4px;">
            <span style="cursor:pointer; transition:color 0.2s;" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color='var(--text-muted)'" onclick="toggleCommentLike(${c.id}, this)"><i class="far fa-heart"></i> Like</span>
            <span style="cursor:pointer; transition:color 0.2s;" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color='var(--text-muted)'" onclick="toggleReplyBox(${c.id})"><i class="far fa-comment"></i> Reply</span>
          </div>
          <div id="replies-container-${c.id}">${repliesHtml}</div>
          <div id="reply-box-${c.id}" style="margin-top:8px; margin-left:20px; display:none; gap:8px;">
            <input type="text" id="reply-input-${c.id}" class="form-input" style="font-size:12px; padding:6px 12px; border-radius:16px; border:1px solid var(--border-color); background:var(--bg-main); width:100%; outline:none;" placeholder="Write a reply..." onkeypress="if(event.key==='Enter') submitReply(${c.id}, ${postId})">
            <button class="btn btn-primary scale-hover" style="padding:6px 12px; font-size:11px; border-radius:16px; font-weight:800;" onclick="submitReply(${c.id}, ${postId})">Reply</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function toggleCommentLike(commentId, el) {
  const icon = el.querySelector('i');
  const isLiked = icon.classList.contains('fas');

  if (isLiked) {
    icon.className = 'far fa-heart';
    el.style.color = 'var(--text-muted)';
  } else {
    icon.className = 'fas fa-heart';
    el.style.color = '#ef4444';
    el.style.transform = 'scale(1.1)';
    setTimeout(() => el.style.transform = 'scale(1)', 100);
  }
}

function toggleReplyBox(commentId) {
  const box = document.getElementById(`reply-box-${commentId}`);
  if (box) {
    const isHidden = box.style.display === 'none';
    box.style.display = isHidden ? 'flex' : 'none';
    if (isHidden) {
      setTimeout(() => {
        const input = document.getElementById(`reply-input-${commentId}`);
        if (input) input.focus();
      }, 50);
    }
  }
}

async function submitReply(commentId, postId) {
  if (!window.currentUser) { showToast('Please sign in to reply.', 'error'); return; }
  const input = document.getElementById(`reply-input-${commentId}`);
  if (!input || !input.value.trim()) return;

  const text = input.value.trim();
  const res = await window.EcoSocialDB.addReply(commentId, postId, text);
  if (res) {
    const replyData = {
      author_name: window.currentUser.name || '',
      author_avatar: window.currentUser.avatar || '',
      text
    };
    const container = document.getElementById(`replies-container-${commentId}`);
    if (container) {
      const r = replyData;
      const replyHtml = `
        <div style="display:flex; gap:8px; margin-top:8px; margin-left:20px; animation: slideInLow 0.3s ease-out; text-align:left;">
          <img src="${r.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.author_name || 'User')}&background=10b981&color=fff`}" class="avatar-xs" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=User'">
          <div style="flex:1; background:var(--card-bg-subtle, rgba(255,255,255,0.03)); padding:6px 10px; border-radius:10px; border:1px solid var(--border-color);">
            <div style="font-weight:800; font-size:11.5px; color:var(--text-primary);">${escapeHtml(r.author_name)}</div>
            <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">${formatPostText(r.text)}</div>
          </div>
        </div>
      `;
      container.insertAdjacentHTML('beforeend', replyHtml);
    }
    input.value = '';
    toggleReplyBox(commentId);
    showToast('Reply added!', 'success');
  }
}

async function handleDeletePost(postId) {
  const confirmed = window.showConfirmModal
    ? await window.showConfirmModal({ title: 'Delete Post', message: 'Are you sure you want to delete this post? This cannot be undone.', icon: 'fa-trash-alt', confirmText: 'Delete', cancelText: 'Cancel', isDanger: true })
    : window.confirm('Are you sure you want to delete this post?');
  if (!confirmed) return;
  const res = await window.EcoSocialDB.deletePost(postId);
  if (res && res.success) {
    showToast("Post deleted successfully!", "success");
    const card = document.getElementById(`post-card-${postId}`);
    if (card) {
      card.style.opacity = '0';
      card.style.transform = 'scale(0.9)';
      card.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      setTimeout(() => card.remove(), 250);
    }
    loadedPosts = loadedPosts.filter(p => String(p.id) !== String(postId));
  } else {
    showToast("Failed to delete post.", "error");
  }
}

function togglePostMenu(postId, event) {
  let menu = document.getElementById(`post-menu-${postId}`);
  if (menu) {
    menu.remove();
    return;
  }

  document.querySelectorAll('.post-options-menu').forEach(m => m.remove());

  const btn = event.currentTarget;
  const rect = btn.getBoundingClientRect();

  menu = document.createElement('div');
  menu.id = `post-menu-${postId}`;
  menu.className = 'post-options-menu card';
  menu.style.cssText = `
    position: fixed;
    top: ${rect.bottom + 5}px;
    right: ${window.innerWidth - rect.right}px;
    width: 180px;
    padding: 8px;
    z-index: 1000;
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    animation: fadeInScale 0.2s ease-out;
  `;

  const post = loadedPosts.find(p => String(p.id) === String(postId));
  const isOwner = window.currentUser && post && (String(post.user_id) === String(window.currentUser.id) || (window.currentUser.ecotrack_id && post.author_ecotrack_id === window.currentUser.ecotrack_id));

  menu.innerHTML = `
    <div class="menu-item" onclick="openShareModal(${postId}); togglePostMenu(${postId})" style="display:flex; align-items:center; gap:10px; padding:10px; cursor:pointer; font-size:13px; font-weight:600; border-radius:8px; color:var(--text-primary);">
      <i class="fas fa-share-nodes" style="color:#3b82f6; width:16px;"></i> Forward
    </div>
    <div class="menu-item" onclick="copyPostLink(${postId}); togglePostMenu(${postId})" style="display:flex; align-items:center; gap:10px; padding:10px; cursor:pointer; font-size:13px; font-weight:600; border-radius:8px; color:var(--text-primary);">
      <i class="fas fa-link" style="color:var(--primary); width:16px;"></i> Copy Link
    </div>
    <div class="menu-item" onclick="showToast('Post reported to community moderators','info'); togglePostMenu(${postId})" style="display:flex; align-items:center; gap:10px; padding:10px; cursor:pointer; font-size:13px; font-weight:600; border-radius:8px; color:var(--text-primary);">
      <i class="fas fa-flag" style="color:#f59e0b; width:16px;"></i> Report Post
    </div>
    ${isOwner ? `
      <div class="menu-item" onclick="handleDeletePost(${postId}); togglePostMenu(${postId})" style="display:flex; align-items:center; gap:10px; padding:10px; cursor:pointer; font-size:13px; font-weight:600; border-radius:8px; color:var(--danger);">
        <i class="fas fa-trash-alt" style="width:16px;"></i> Delete Post
      </div>
    ` : `
      <div class="menu-item" onclick="showToast('You will see fewer posts like this','info'); togglePostMenu(${postId})" style="display:flex; align-items:center; gap:10px; padding:10px; cursor:pointer; font-size:13px; font-weight:600; border-radius:8px; color:var(--text-muted);">
        <i class="fas fa-eye-slash" style="width:16px;"></i> Not Interested
      </div>
    `}
  `;

  document.body.appendChild(menu);

  const closeMenu = (e) => {
    if (!menu.contains(e.target) && !btn.contains(e.target)) {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }
  };
  setTimeout(() => document.addEventListener('click', closeMenu), 10);
}

function openCreatePostModal() {
  const modal = document.getElementById('createPostModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('active');
    modal.style.display = 'flex';
  }
}

function closeCreatePostModal() {
  const modal = document.getElementById('createPostModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
}

async function handleCreatePostSubmit(e) {
  e.preventDefault();
  const content     = document.getElementById('createPostText').value.trim();
  const postType    = document.getElementById('createPostType').value;
  const visibility  = document.getElementById('createPostVisibility').value;
  const locationTag = document.getElementById('createPostLocation').value.trim();
  const animalTag   = document.getElementById('createPostAnimal').value.trim();
  const hashtags    = document.getElementById('createPostHashtags').value.trim();

  // Determine media: file upload takes priority over URL tab
  const isUrlTabActive = document.getElementById('postImgUrlDiv')?.style.display !== 'none';
  const postFile       = document.getElementById('createPostMediaFile')?.files[0];
  const mediaUrlVal    = document.getElementById('createPostMediaUrl')?.value.trim();

  if (!window.currentUser) { showToast('Please sign in to publish posts.', 'error'); return; }
  const userId = window.currentUser.id;

  const publishPost = async (mediaUrl) => {
    const res = await window.EcoSocialDB.createPost({
      user_id: userId,
      author_name: window.currentUser.name,
      content,
      post_type: postType,
      privacy_visibility: visibility,
      location_tag: locationTag,
      animal_tag: animalTag,
      hashtags,
      media_urls: mediaUrl ? [mediaUrl] : []
    });

    if (res) {
      document.getElementById('createPostText').value = '';
      document.getElementById('createPostLocation').value = '';
      document.getElementById('createPostAnimal').value = '';
      document.getElementById('createPostHashtags').value = '';
      const urlEl = document.getElementById('createPostMediaUrl');
      if (urlEl) urlEl.value = '';
      const fileEl = document.getElementById('createPostMediaFile');
      if (fileEl) fileEl.value = '';
      closeCreatePostModal();
      showToast('Post published successfully!', 'success');
      initCommunityFeed();
    }
  };

  if (!isUrlTabActive && postFile) {
    const reader = new FileReader();
    reader.onload = (ev) => publishPost(ev.target.result);
    reader.readAsDataURL(postFile);
  } else {
    publishPost(mediaUrlVal || '');
  }
}

function viewUserProfile(userIdOrEcoId) {
  const currentUserId = window.currentUser ? window.currentUser.id : null;
  const currentEcoId = window.currentUser ? window.currentUser.ecotrack_id : null;
  
  if (currentUserId && (userIdOrEcoId === currentUserId || userIdOrEcoId === currentEcoId)) {
    if (window.switchTab) window.switchTab('profile');
    if (window.loadProfileTab) window.loadProfileTab(currentUserId);
  } else {
    if (window.openViewProfileModal) {
      window.openViewProfileModal(userIdOrEcoId);
    }
  }
}

function formatTimeAgo(dateVal) {
  if (typeof window.formatTimeAgo === 'function' && window.formatTimeAgo !== formatTimeAgo) {
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

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function openShareModal(postId) {
  let modal = document.getElementById('sharePostModal');
  if (modal) modal.remove(); // Force rebuild to avoid stale link target bugs

  const post = loadedPosts.find(p => p.id === postId);
  const authorName = post ? post.author_name : 'User';
  const contentSnippet = post ? (post.content.length > 85 ? post.content.substring(0, 85) + '...' : post.content) : 'EcoTrack Social Post';

  modal = document.createElement('div');
  modal.id = 'sharePostModal';
  modal.className = 'bottom-sheet-modal';
  modal.onclick = (e) => { if (e.target === modal) closeShareModal(); };
  modal.innerHTML = `
    <div class="bottom-sheet-card" style="background:var(--bg-card); border-radius:20px 20px 0 0; padding:20px; max-width:480px; margin:0 auto; border:1px solid var(--border-color); box-shadow:var(--shadow-xl);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <h3 style="margin:0; font-weight:800; font-size:15px; display:flex; align-items:center; gap:8px; color:var(--text-primary);">
          <i class="fas fa-share-nodes" style="color:var(--primary);"></i> Share welfare update
        </h3>
        <button onclick="closeShareModal()" style="border:none; background:var(--bg-main); width:28px; height:28px; border-radius:50%; font-size:14px; cursor:pointer; color:var(--text-muted); display:flex; align-items:center; justify-content:center;">✕</button>
      </div>
      
      <!-- Post Preview snippet -->
      <div style="background:var(--bg-main); border:1px solid var(--border-color); border-radius:12px; padding:10px 12px; margin-bottom:14px; text-align:left;">
        <div style="font-weight:800; font-size:11px; color:var(--primary); text-transform:uppercase; margin-bottom:3px;">Post by ${escapeHtml(authorName)}</div>
        <div style="font-size:12px; color:var(--text-secondary); line-height:1.4;">"${escapeHtml(contentSnippet)}"</div>
      </div>
      
      <div style="display:flex; flex-direction:column; gap:8px;">
        <button class="btn btn-secondary scale-hover" onclick="copyPostLink(${postId})" style="justify-content:flex-start; gap:12px; border-radius:12px; padding:10px 14px; text-align:left; font-weight:800; font-size:12.5px; border:1px solid var(--border-color); background:var(--bg-main); color:var(--text-primary); cursor:pointer;">
          <i class="fas fa-link" style="color:var(--primary); width:16px;"></i> Copy Direct Post Link
        </button>
        <button class="btn btn-secondary scale-hover" onclick="sharePostToDirectMessage(${postId})" style="justify-content:flex-start; gap:12px; border-radius:12px; padding:10px 14px; text-align:left; font-weight:800; font-size:12.5px; border:1px solid var(--border-color); background:var(--bg-main); color:var(--text-primary); cursor:pointer;">
          <i class="fas fa-paper-plane" style="color:#3b82f6; width:16px;"></i> Send in Direct Message
        </button>
        <button class="btn btn-secondary scale-hover" onclick="shareToExternalSocial('twitter', ${postId})" style="justify-content:flex-start; gap:12px; border-radius:12px; padding:10px 14px; text-align:left; font-weight:800; font-size:12.5px; border:1px solid var(--border-color); background:var(--bg-main); color:var(--text-primary); cursor:pointer;">
          <i class="fab fa-x-twitter" style="color:#38bdf8; width:16px;"></i> Share to X (Twitter)
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  setTimeout(() => modal.classList.add('active'), 20);
}

function closeShareModal() {
  const modal = document.getElementById('sharePostModal');
  if (modal) {
    modal.classList.remove('active');
    setTimeout(() => modal.remove(), 250);
  }
}

function copyPostLink(postId) {
  const dummyUrl = `${window.location.origin}${window.location.pathname}#post-${postId}`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(dummyUrl).then(() => {
      showToast('Post link copied to clipboard!', 'success');
      closeShareModal();
    }).catch(() => {
      fallbackCopy(dummyUrl);
    });
  } else {
    fallbackCopy(dummyUrl);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  showToast('Post link copied to clipboard!', 'success');
  closeShareModal();
}

function sharePostToDirectMessage(postId) {
  closeShareModal();
  const post = loadedPosts.find(p => p.id === postId);
  // If we know the author, open DM directly with them
  if (post && post.user_id && window.currentUser && post.user_id !== window.currentUser.id) {
    if (window.openDirectMessageModal) {
      window.openDirectMessageModal(post.user_id, post.author_name);
    } else if (window.openMessagingDrawer) {
      window.openMessagingDrawer(post.user_id);
    }
    showToast(`Opening direct message with ${escapeHtml(post.author_name)}...`, 'success');
  } else {
    if (window.openMessagingDrawer) window.openMessagingDrawer();
    showToast('Select a contact to send this post!', 'info');
  }
}

function shareToExternalSocial(platform, postId) {
  const url = encodeURIComponent(`${window.location.origin}${window.location.pathname}#community?post=${postId}`);
  const text = encodeURIComponent('Check out this animal welfare post on EcoTrack!');
  if (platform === 'twitter') window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  closeShareModal();
}

// Infinite Scroll logic
function initInfiniteScroll() {
  window.addEventListener('scroll', () => {
    const communitySection = document.getElementById('community');
    if (communitySection && communitySection.style.display !== 'none' && !communitySection.classList.contains('hidden')) {
      const threshold = 350; // trigger loading when 350px from bottom
      const position = window.innerHeight + window.scrollY;
      const height = document.documentElement.scrollHeight;
      
      if (position >= height - threshold) {
        if (hasMorePosts && !isFetching) {
          currentPage++;
          initCommunityFeed(true);
        }
      }
    }
  });
}

// Run scroll initialization immediately
initInfiniteScroll();

window.initCommunityFeed = initCommunityFeed;
window.setFeedFilter = setFeedFilter;
window.filterByHashtag = filterByHashtag;
window.filterByLocation = filterByLocation;
window.filterBySpecies = filterBySpecies;
window.onSocialSearchInput = onSocialSearchInput;
window.togglePostLike = togglePostLike;
window.togglePostBookmark = togglePostBookmark;
window.toggleCommentsSection = toggleCommentsSection;
window.submitComment = submitComment;
window.toggleReplyBox = toggleReplyBox;
window.submitReply = submitReply;
window.openCreatePostModal = openCreatePostModal;
window.closeCreatePostModal = closeCreatePostModal;
window.handleCreatePostSubmit = handleCreatePostSubmit;
window.viewUserProfile = viewUserProfile;
window.toggleFollowUser = toggleFollowUser;
window.openShareModal = openShareModal;
window.closeShareModal = closeShareModal;
window.copyPostLink = copyPostLink;
window.sharePostToDirectMessage = sharePostToDirectMessage;
window.shareToExternalSocial = shareToExternalSocial;
window.renderPostCardHtml = renderPostCardHtml;
window.openAllRecommendationsModal = openAllRecommendationsModal;
window.toggleCommunityNotificationsDropdown = toggleCommunityNotificationsDropdown;
window.renderCommunityNotifications = renderCommunityNotifications;
window.markNotificationAsRead = markNotificationAsRead;
window.markAllNotificationsAsRead = markAllNotificationsAsRead;
window.handleDeletePost = handleDeletePost;

// Re-enforce community function exports after all scripts finish loading
// This ensures app.js (loaded after community.js) cannot accidentally override these
document.addEventListener('DOMContentLoaded', function() {
  window.submitComment = submitComment;
  window.toggleCommentsSection = toggleCommentsSection;
  window.togglePostLike = togglePostLike;
  window.togglePostBookmark = togglePostBookmark;
  window.submitReply = submitReply;
  window.toggleReplyBox = toggleReplyBox;
  window.handleCreatePostSubmit = handleCreatePostSubmit;
  window.initCommunityFeed = initCommunityFeed;
  console.log('[community.js] All community functions re-exported to window after DOMContentLoaded');
});
