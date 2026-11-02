/**
 * EcoTrack Real-Time Direct Messaging Engine v7.0
 * Connects directly to SQLite backend /api/social/messages
 * - Complete followed members + chatted users
 * - Instant search filter
 * - Real-time thread loading & message persistence
 * - Automatic unread clearing and notification synchronization
 * - Full desktop, tablet, and mobile responsiveness
 */

let activeChatPartnerId = null;
let cachedFollowedUsers = [];
let cachedConversations = [];
let chatContactSearchQuery = "";
let isSendingChat = false;

function getSession() {
  if (window.currentUser && window.currentUser.id) return window.currentUser;
  try {
    const raw = localStorage.getItem(AUTH_CONFIG.sessionKey);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

async function openMessagingDrawer(partnerId, partnerName) {
  const modal = document.getElementById('messagingDrawerModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('active');    // Required by .modal-backdrop.active CSS rule
  modal.style.display = 'flex';

  chatContactSearchQuery = "";
  const searchInput = document.getElementById('chatSearchContactsInput');
  if (searchInput) searchInput.value = "";

  // Reset mobile view to contacts sidebar if on small screen
  if (window.innerWidth <= 768) {
    showChatSidebarOnMobile();
  }

  // Fetch current user's profile to check latest privacy settings
  const session = getSession();
  if (session) {
    try {
      const res = await fetch(`${window.EcoSocialDB.apiBase}/profile/${session.id}`, { headers: window.EcoSocialDB.getAuthHeader() });
      if (res.ok) {
        const data = await res.json();
        session.privacy_setting = data.profile.privacy_setting || 'Public';
        session.dm_privacy_setting = data.profile.dm_privacy_setting || 'Everyone';
        window.currentUser.privacy_setting = session.privacy_setting;
        window.currentUser.dm_privacy_setting = session.dm_privacy_setting;
        localStorage.setItem(AUTH_CONFIG.sessionKey, JSON.stringify(window.currentUser));
      }
    } catch (e) {}
    
    // Toggle active chats sidebar section depending on DM privacy setting
    const activeChatsSection = document.getElementById('chatActiveChatsSection');
    if (activeChatsSection) {
      if (session.dm_privacy_setting === 'FollowersOnly') {
        activeChatsSection.style.display = 'none';
      } else {
        activeChatsSection.style.display = 'flex';
      }
    }
  }

  await Promise.all([
    loadFollowedList(),
    loadConversationsList()
  ]);

  if (partnerId) {
    selectChatConversation(partnerId, partnerName);
  }
}

async function loadFollowedList() {
  const container = document.getElementById('chatFollowedList');
  if (!container) return;

  const session = getSession();
  if (!session) return;

  try {
    const following = await window.EcoSocialDB.fetchFollowing(session.id);
    cachedFollowedUsers = Array.isArray(following) ? following : [];
    renderFollowedList(cachedFollowedUsers, container);
  } catch (e) {
    container.innerHTML = `<div style="padding:12px; text-align:center; color:var(--text-muted); font-size:11px;">Failed to load followed list</div>`;
  }
}

function renderFollowedList(users, container) {
  const q = chatContactSearchQuery.toLowerCase().trim();
  const filtered = q
    ? users.filter(u => (u.name || '').toLowerCase().includes(q) || (u.display_name || '').toLowerCase().includes(q) || (u.ecotrack_id || '').toLowerCase().includes(q))
    : users;

  if (!filtered.length) {
    container.innerHTML = `<div style="padding:12px; text-align:center; color:var(--text-muted); font-size:11px;">${q ? 'No matching members' : 'Not following any members'}</div>`;
    return;
  }

  container.innerHTML = filtered.map(u => {
    const uid = u.id || u.user_id;
    const name = u.display_name || u.name || 'Member';
    const avatar = u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=10b981&color=fff`;
    const isActive = String(activeChatPartnerId) === String(uid);

    // Look up unread count from cached conversations
    const convMatch = cachedConversations.find(c => String(c.partner_id) === String(uid));
    const unreadCount = convMatch ? Number(convMatch.unread_count || 0) : 0;

    return `
      <div class="chat-thread-item ${isActive ? 'active' : ''}" onclick="selectChatConversation('${uid}', '${escapeHtml(name).replace(/'/g, "\\'")}')" style="display:flex; align-items:center; gap:8px; padding:6px 10px; border-radius:10px; cursor:pointer; margin-bottom:2px; transition:background 0.2s; background:${isActive ? 'var(--primary-light, rgba(16,185,129,0.12))' : 'transparent'};">
        <img src="${avatar}" class="avatar-sm" style="width:28px; height:28px; border-radius:50%; object-fit:cover; border:1px solid var(--border-color); flex-shrink:0;" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=User&background=10b981&color=fff'">
        <div style="flex:1; overflow:hidden; text-align:left;">
          <div style="font-weight:700; font-size:12px; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(name)}</div>
          <div style="font-size:10px; color:var(--text-muted);">@${escapeHtml(u.ecotrack_id || 'member')}</div>
        </div>
        ${unreadCount > 0 ? `<span class="badge" style="background:var(--primary); color:#fff; font-size:10px; padding:2px 6px; border-radius:10px; font-weight:800; margin-left:auto; flex-shrink:0;">${unreadCount}</span>` : ''}
      </div>
    `;
  }).join('');
}

function closeMessagingDrawer() {
  const modal = document.getElementById('messagingDrawerModal');
  if (modal) {
    modal.classList.remove('active');
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}

async function loadConversationsList() {
  const container = document.getElementById('chatConversationsList');
  if (!container) return;

  const session = getSession();
  if (!session) {
    container.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-muted); font-size:12px;">Please sign in to chat</div>`;
    return;
  }

  try {
    const res = await fetch(`${window.EcoSocialDB.apiBase}/messages/conversations`, { headers: window.EcoSocialDB.getAuthHeader() });
    if (res.ok) {
      const data = await res.json();
      cachedConversations = data.conversations || [];
      renderConversations(cachedConversations, container);
      return;
    }
  } catch (e) {
    console.warn('Backend chat API failed:', e.message);
  }

  container.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-muted); font-size:12px;">Could not load conversations</div>`;
}

function renderConversations(threads, container) {
  // Exclude followed members from the Active Chats list
  const followedIds = new Set(cachedFollowedUsers.map(u => String(u.id || u.user_id)));
  const filteredThreads = threads.filter(t => !followedIds.has(String(t.partner_id)));

  const q = chatContactSearchQuery.toLowerCase().trim();
  const filtered = q
    ? filteredThreads.filter(t => (t.partner_name || '').toLowerCase().includes(q) || (t.last_message || '').toLowerCase().includes(q))
    : filteredThreads;

  if (!filtered.length) {
    container.innerHTML = `<div style="padding:16px 12px; text-align:center; color:var(--text-muted); font-size:12px;"><i class="far fa-comment-dots" style="font-size:20px; opacity:0.4; margin-bottom:6px; display:block;"></i>${q ? 'No matching chats' : 'No active conversations yet'}</div>`;
    return;
  }

  container.innerHTML = filtered.map(t => {
    const isActive = String(activeChatPartnerId) === String(t.partner_id);
    const avatar = t.partner_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.partner_name || 'User')}&background=10b981&color=fff`;

    return `
      <div class="chat-thread-item ${isActive ? 'active' : ''}" onclick="selectChatConversation('${t.partner_id}', '${escapeHtml(t.partner_name || '').replace(/'/g, "\\'")}')" style="display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:12px; cursor:pointer; margin-bottom:4px; transition:background 0.2s; background:${isActive ? 'var(--primary-light, rgba(16,185,129,0.12))' : 'transparent'};">
        <div style="position:relative; flex-shrink:0;">
          <img src="${avatar}" class="avatar-sm" style="width:34px; height:34px; border-radius:50%; object-fit:cover; border:1.5px solid var(--border-color);" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=User&background=10b981&color=fff'">
        </div>
        <div style="flex:1; overflow:hidden; text-align:left;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:800; font-size:12.5px; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(t.partner_name)}</span>
            <span style="font-size:9.5px; color:var(--text-muted);">${t.last_time ? formatTimeAgo(t.last_time) : ''}</span>
          </div>
          <div style="font-size:11px; color:${Number(t.unread_count) > 0 ? 'var(--text-primary)' : 'var(--text-muted)'}; font-weight:${Number(t.unread_count) > 0 ? '700' : '400'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;">${escapeHtml(t.last_message || '')}</div>
        </div>
        ${Number(t.unread_count) > 0 ? `<span class="badge" style="background:var(--primary); color:#fff; font-size:10px; padding:2px 6px; border-radius:10px; font-weight:800;">${t.unread_count}</span>` : ''}
      </div>
    `;
  }).join('');
}

function onSearchChatContacts(query) {
  chatContactSearchQuery = query || "";
  const followedContainer = document.getElementById('chatFollowedList');
  const convContainer = document.getElementById('chatConversationsList');
  if (followedContainer) renderFollowedList(cachedFollowedUsers, followedContainer);
  if (convContainer) renderConversations(cachedConversations, convContainer);
}

async function selectChatConversation(partnerId, partnerName) {
  if (!partnerId) return;
  activeChatPartnerId = String(partnerId);

  const headerName = document.getElementById('chatHeaderName');
  const chatThread = document.getElementById('chatMessagesHistory');
  const mobileBackBtn = document.getElementById('chatMobileBackBtn');

  // Handle mobile view transition
  if (window.innerWidth <= 768) {
    const sidebar = document.getElementById('chatSidebarContainer');
    const threadPane = document.getElementById('chatThreadPane');
    if (sidebar) sidebar.style.display = 'none';
    if (threadPane) threadPane.style.display = 'flex';
    if (mobileBackBtn) mobileBackBtn.style.display = 'inline-flex';
  }

  // Highlight active in sidebar
  const followedContainer = document.getElementById('chatFollowedList');
  const convContainer = document.getElementById('chatConversationsList');
  if (followedContainer) renderFollowedList(cachedFollowedUsers, followedContainer);
  if (convContainer) renderConversations(cachedConversations, convContainer);

  let nameDisp = partnerName || '';
  let avatarDisp = '';
  
  // Try to find avatar in cached followed users
  if (Array.isArray(cachedFollowedUsers)) {
    const followedMatch = cachedFollowedUsers.find(u => String(u.id || u.user_id) === String(partnerId));
    if (followedMatch) {
      avatarDisp = followedMatch.avatar_url || '';
      if (!nameDisp) nameDisp = followedMatch.display_name || followedMatch.name || '';
    }
  }
  
  // If not found, try cached conversations
  if (!avatarDisp && Array.isArray(cachedConversations)) {
    const convMatch = cachedConversations.find(c => String(c.partner_id) === String(partnerId));
    if (convMatch) {
      avatarDisp = convMatch.partner_avatar || '';
      if (!nameDisp) nameDisp = convMatch.partner_name || '';
    }
  }

  // If we still don't have nameDisp or avatarDisp, fetch it
  if (!nameDisp || !avatarDisp) {
    try {
      const res = await fetch(`${window.EcoSocialDB.apiBase}/profile/${partnerId}`, { headers: window.EcoSocialDB.getAuthHeader() });
      if (res.ok) {
        const data = await res.json();
        if (data && data.profile) {
          if (!nameDisp) nameDisp = data.profile.display_name || data.profile.name;
          if (!avatarDisp) avatarDisp = data.profile.avatar_url || '';
        }
      }
    } catch (e) {
      console.warn("Failed to fetch profile for chat header:", e);
    }
  }
  if (!nameDisp) nameDisp = 'EcoTrack Member';

  if (headerName) {
    const avatarSrc = avatarDisp || `https://ui-avatars.com/api/?name=${encodeURIComponent(nameDisp || 'User')}&background=10b981&color=fff`;
    headerName.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px; cursor:pointer;" onclick="closeMessagingDrawer(); if(window.viewUserProfile) window.viewUserProfile('${partnerId}');">
        <img src="${avatarSrc}" style="width:32px; height:32px; border-radius:50%; object-fit:cover; border:1px solid var(--border-color);" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=User&background=10b981&color=fff'">
        <div>
          <div style="font-weight:800; font-size:13.5px; color:var(--text-primary); display:flex; align-items:center; gap:6px;">
            <span>${escapeHtml(nameDisp || 'Chat Partner')}</span>
            <span style="font-size:11px; color:var(--primary); font-weight:600;">(View Profile)</span>
          </div>
        </div>
      </div>
    `;
  }

  // Render options dropdown in header bar
  const headerBar = document.getElementById('chatHeaderBar');
  if (headerBar) {
    const oldDrop = document.getElementById('chatHeaderOptionsContainer');
    if (oldDrop) oldDrop.remove();
    
    const optionsDiv = document.createElement('div');
    optionsDiv.id = 'chatHeaderOptionsContainer';
    optionsDiv.style.position = 'relative';
    optionsDiv.style.display = 'inline-block';
    optionsDiv.innerHTML = `
      <button onclick="toggleChatHeaderOptions(event)" style="background:none; border:none; color:var(--text-muted); cursor:pointer; padding:6px 10px; font-size:16px;" class="scale-hover" title="Chat Options">
        <i class="fas fa-ellipsis-v"></i>
      </button>
      <div id="chatHeaderOptionsDropdown" class="hidden" style="position:absolute; right:0; top:100%; background:var(--bg-card); border:1px solid var(--border-color); border-radius:12px; box-shadow:var(--shadow-md); z-index:100; width:150px; padding:6px 0; display:none;">
        <button onclick="deleteUserChat('${partnerId}')" style="display:block; width:100%; text-align:left; background:none; border:none; padding:8px 14px; font-size:12px; color:var(--text-primary); cursor:pointer;" class="msg-menu-item">
          <i class="fas fa-trash-alt" style="margin-right:6px; color:var(--text-muted);"></i> Delete Chat
        </button>
        <button id="chatBlockOptionBtn" onclick="toggleBlockUser('${partnerId}')" style="display:block; width:100%; text-align:left; background:none; border:none; padding:8px 14px; font-size:12px; color:var(--danger); cursor:pointer;" class="msg-menu-item">
          <i class="fas fa-ban" style="margin-right:6px;"></i> Block User
        </button>
      </div>
    `;
    headerBar.appendChild(optionsDiv);
  }

  const session = getSession();
  if (!session) return;

  if (chatThread) {
    chatThread.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted);"><i class="fas fa-spinner fa-spin fa-lg" style="color:var(--primary);"></i><div style="margin-top:8px; font-size:12px;">Loading messages...</div></div>`;
    // Ensure input container is shown (in case it was hidden by settings view)
    const inputFooter = chatThread.nextElementSibling;
    if (inputFooter) inputFooter.style.display = 'flex';
  }

  try {
    const res = await fetch(`${window.EcoSocialDB.apiBase}/messages/${partnerId}`, { headers: window.EcoSocialDB.getAuthHeader() });
    if (res.ok) {
      const data = await res.json();
      renderMessageThread(data.messages || [], chatThread);

      // Handle blocked UI state
      const isBlocked = !!data.isBlocked;
      const isBlockedBy = !!data.isBlockedBy;
      
      const blockBtn = document.getElementById('chatBlockOptionBtn');
      if (blockBtn) {
        blockBtn.innerHTML = isBlocked 
          ? `<i class="fas fa-check" style="margin-right:6px; color:var(--primary);"></i> Unblock User` 
          : `<i class="fas fa-ban" style="margin-right:6px;"></i> Block User`;
      }
      
      const input = document.getElementById('chatInputText');
      const sendBtn = document.getElementById('chatSendBtn');
      const emojiBtn = document.getElementById('chatEmojiBtn');
      const uploadBtn = document.getElementById('chatUploadBtn');
      
      if (isBlocked || isBlockedBy) {
        if (input) {
          input.disabled = true;
          input.placeholder = isBlocked ? "You have blocked this user" : "This user has restricted messaging";
          input.value = "";
        }
        if (sendBtn) sendBtn.disabled = true;
        if (emojiBtn) emojiBtn.style.pointerEvents = 'none';
        if (uploadBtn) uploadBtn.style.pointerEvents = 'none';
      } else {
        if (input) {
          input.disabled = false;
          input.placeholder = "Type a message...";
        }
        if (sendBtn) sendBtn.disabled = false;
        if (emojiBtn) emojiBtn.style.pointerEvents = 'auto';
        if (uploadBtn) uploadBtn.style.pointerEvents = 'auto';
      }

      // Auto clear notifications for this sender
      try {
        const notifRes = await window.EcoSocialDB.fetchNotifications();
        if (Array.isArray(notifRes)) {
          const partnerNotifs = notifRes.filter(n => (!n.is_read) && (String(n.actor_id) === String(partnerId) || n.type === 'message' || n.type === 'chat'));
          partnerNotifs.forEach(n => {
            if (window.markNotificationAsRead) window.markNotificationAsRead(n.id);
          });
        }
      } catch (e) {}

      // Refresh conversation list to clear unread badges and update header counts
      loadConversationsList();
      if (window.checkNotificationsAndMessages) {
        window.checkNotificationsAndMessages();
      }
      return;
    }
  } catch (e) {
    console.warn('Messages thread fetch failed:', e.message);
  }

  if (chatThread) {
    chatThread.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-muted); font-size:12px;">Could not load messages</div>`;
  }
}

function showChatSidebarOnMobile() {
  const sidebar = document.getElementById('chatSidebarContainer');
  const threadPane = document.getElementById('chatThreadPane');
  const mobileBackBtn = document.getElementById('chatMobileBackBtn');
  if (sidebar) sidebar.style.display = 'flex';
  if (threadPane && window.innerWidth <= 768) threadPane.style.display = 'none';
  if (mobileBackBtn) mobileBackBtn.style.display = 'none';
}

function renderMessageThread(messages, container) {
  if (!container) return;
  const session = getSession();
  const userId = session ? String(session.id) : null;

  if (!messages.length) {
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 20px; color:var(--text-muted); height:100%;">
        <i class="far fa-comments fa-3x" style="color:var(--primary); margin-bottom:12px; opacity:0.4;"></i>
        <div style="font-weight:700; font-size:13.5px; color:var(--text-primary);">Say Hello!</div>
        <p style="font-size:12px; max-width:240px; margin-top:4px; text-align:center;">Start your dialogue regarding wildlife welfare and training insights.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = messages.map(m => {
    const isMine = String(m.sender_id) === userId;
    
    // Build attachments HTML if present
    let attachmentHtml = '';
    if (m.media_url) {
      if (m.media_type && m.media_type.startsWith('image/')) {
        attachmentHtml = `<img src="${m.media_url}" style="max-width:100%; max-height:220px; border-radius:10px; margin-bottom:6px; display:block; object-fit:cover; cursor:pointer;" onclick="window.open('${m.media_url}', '_blank')">`;
      } else if (m.media_type && m.media_type.startsWith('video/')) {
        attachmentHtml = `<video src="${m.media_url}" controls style="max-width:100%; max-height:220px; border-radius:10px; margin-bottom:6px; display:block;"></video>`;
      } else {
        attachmentHtml = `<div style="margin-bottom:6px;"><a href="${m.media_url}" target="_blank" style="color:inherit; text-decoration:underline; font-weight:600; display:inline-flex; align-items:center; gap:6px;"><i class="fas fa-external-link-alt"></i> View File</a></div>`;
      }
    } else if (m.document_url) {
      attachmentHtml = `
        <div style="margin-bottom:6px;">
          <a href="${m.document_url}" download="attachment" style="color:inherit; text-decoration:none; background:rgba(0,0,0,0.06); padding:8px 12px; border-radius:10px; display:inline-flex; align-items:center; gap:8px; border:1px solid var(--border-color);">
            <i class="fas fa-file-download" style="font-size:16px;"></i>
            <span style="font-size:12px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:140px;">Download Document</span>
          </a>
        </div>
      `;
    }

    // Ellipsis options dropdown next to bubble
    const deleteMenu = `
      <div class="msg-menu-container" style="position:relative; display:inline-block; margin-left:6px; margin-right:6px; align-self:center; height:20px;">
        <button onclick="event.stopPropagation(); toggleMsgMenu(event, ${m.id});" onmousedown="event.stopPropagation();" style="background:none; border:none; color:var(--text-muted); cursor:pointer; padding:4px; font-size:12px;" class="scale-hover" title="Message Options">
          <i class="fas fa-ellipsis-v"></i>
        </button>
        <div id="msgMenu-${m.id}" style="position:absolute; ${isMine ? 'right:0' : 'left:0'}; top:22px; background:var(--bg-card); border:1px solid var(--border-color); border-radius:10px; box-shadow:0 4px 20px rgba(0,0,0,0.15); z-index:1000; min-width:145px; padding:6px 0; display:none;">
          <button onclick="event.stopPropagation(); forwardChatMessage(${m.id});" style="display:flex; align-items:center; gap:8px; width:100%; text-align:left; background:none; border:none; padding:8px 14px; font-size:12px; font-weight:600; color:var(--text-primary); cursor:pointer;" class="msg-menu-item"><i class="fas fa-paper-plane" style="width:12px; color:var(--primary);"></i> Forward</button>
          <button onclick="event.stopPropagation(); deleteChatMessage(${m.id}, 'me');" style="display:flex; align-items:center; gap:8px; width:100%; text-align:left; background:none; border:none; padding:8px 14px; font-size:12px; font-weight:600; color:var(--text-primary); cursor:pointer;" class="msg-menu-item"><i class="fas fa-user" style="width:12px; color:var(--text-muted);"></i> Delete for me</button>
          ${isMine ? `<button onclick="event.stopPropagation(); deleteChatMessage(${m.id}, 'all');" style="display:flex; align-items:center; gap:8px; width:100%; text-align:left; background:none; border:none; padding:8px 14px; font-size:12px; font-weight:600; color:var(--danger); cursor:pointer;" class="msg-menu-item"><i class="fas fa-users" style="width:12px;"></i> Delete for all</button>` : ''}
        </div>
      </div>
    `;

    return `
      <div id="msg-row-${m.id}" data-msg-id="${m.id}" style="display:flex; justify-content:${isMine ? 'flex-end' : 'flex-start'}; margin-bottom:10px; text-align:left;">
        ${isMine ? deleteMenu : ''}
        <div style="max-width:75%; padding:10px 14px; border-radius:${isMine ? '16px 16px 2px 16px' : '16px 16px 16px 2px'}; background:${isMine ? 'var(--primary)' : 'var(--bg-main)'}; color:${isMine ? '#fff' : 'var(--text-primary)'}; border:1px solid var(--border-color); font-size:13px; line-height:1.5; word-break:break-word;">
          ${attachmentHtml}
          ${m.text ? `<div>${escapeHtml(m.text || '')}</div>` : ''}
          <div style="text-align:right; font-size:9.5px; opacity:${isMine ? '0.85' : '0.6'}; margin-top:4px; font-weight:600;">
            ${formatTimeAgo(m.created_at)} ${isMine ? (m.is_seen ? '✓✓' : '✓') : ''}
          </div>
        </div>
        ${!isMine ? deleteMenu : ''}
      </div>
    `;
  }).join('');

  container.scrollTop = container.scrollHeight;
}

async function sendInboxMessage() {
  if (isSendingChat) return;
  const input = document.getElementById('chatInputText');
  const sendBtn = document.getElementById('chatSendBtn');
  const text = input ? input.value.trim() : '';

  if ((!text && !pendingChatFile) || !activeChatPartnerId) {
    console.warn('[sendInboxMessage] Cannot send - no content or active partner');
    return;
  }

  isSendingChat = true;
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
  }

  const payload = {
    receiver_id: activeChatPartnerId,
    text
  };

  if (pendingChatFile) {
    if (pendingChatFile.type.startsWith('image/') || pendingChatFile.type.startsWith('video/')) {
      payload.media_url = pendingChatFile.dataUrl;
      payload.media_type = pendingChatFile.type;
    } else {
      payload.document_url = pendingChatFile.dataUrl;
    }
  }

  try {
    const res = await fetch(`${window.EcoSocialDB.apiBase}/messages`, {
      method: 'POST',
      headers: window.EcoSocialDB.getAuthHeader(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Send failed: ${res.status}`);
    }
    if (input) input.value = '';
    clearChatAttachment();
    await selectChatConversation(activeChatPartnerId);
  } catch (e) {
    console.error('[sendInboxMessage] Error:', e.message);
    if (window.showToast) window.showToast("Failed to send message. Please try again.", "error");
  } finally {
    isSendingChat = false;
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.innerHTML = `<i class="fas fa-paper-plane"></i> <span>Send</span>`;
    }
  }
}


function openDirectMessageModal(partnerId, partnerName) {
  console.log('[openDirectMessageModal] called, partnerId:', partnerId, 'user:', window.currentUser ? window.currentUser.id : 'NOT LOGGED IN');
  if (!window.currentUser) {
    if (window.showToast) window.showToast('Please sign in to send messages.', 'error');
    else if (window.showConfirmModal) window.showConfirmModal({ title: 'Sign In Required', message: 'Please sign in to send messages.', icon: 'fa-user-lock' });
    return;
  }
  openMessagingDrawer(partnerId, partnerName);
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatTimeAgo(dateVal) {
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
window.formatTimeAgo = formatTimeAgo;
window.timeAgo = formatTimeAgo;

// Size, file uploading, and emoji helper functions
let pendingChatFile = null;

const popularEmojis = [
  '😀', '😂', '😍', '😊', '👍', '🎉', '❤️', '🔥', '👏', '🙌',
  '🌟', '🐾', '🐶', '🐱', '🌿', '🌎', '🌳', '🦁', '🦅', '🐢', '🐬'
];

function toggleChatModalSize() {
  const modal = document.getElementById('messagingDrawerModal');
  const icon = document.getElementById('chatSizeIcon');
  if (!modal) return;

  const isFullscreen = modal.classList.toggle('fullscreen');
  if (isFullscreen) {
    if (icon) {
      icon.className = 'fas fa-compress';
    }
  } else {
    if (icon) {
      icon.className = 'fas fa-expand';
    }
  }
}

function triggerChatFileUpload() {
  document.getElementById('chatFileInput').click();
}

function handleChatFileUpload(input) {
  const file = input.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    if (window.showToast) window.showToast("File size should not exceed 5MB", "error");
    input.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    pendingChatFile = {
      name: file.name,
      type: file.type,
      dataUrl: e.target.result
    };
    
    // Show preview
    const previewContainer = document.getElementById('chatAttachmentPreview');
    const content = document.getElementById('chatAttachmentPreviewContent');
    if (previewContainer && content) {
      if (file.type.startsWith('image/')) {
        content.innerHTML = `
          <img src="${e.target.result}" style="width:36px; height:36px; border-radius:6px; object-fit:cover; border:1px solid var(--border-color);">
          <span style="font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-left:6px;">${escapeHtml(file.name)}</span>
        `;
      } else {
        content.innerHTML = `
          <div style="width:36px; height:36px; border-radius:6px; background:var(--primary-light); display:flex; align-items:center; justify-content:center; color:var(--primary);"><i class="fas fa-file-alt"></i></div>
          <span style="font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-left:6px;">${escapeHtml(file.name)}</span>
        `;
      }
      previewContainer.style.display = 'flex';
    }
  };
  reader.readAsDataURL(file);
}

function clearChatAttachment() {
  pendingChatFile = null;
  const fileInput = document.getElementById('chatFileInput');
  if (fileInput) fileInput.value = '';
  const previewContainer = document.getElementById('chatAttachmentPreview');
  if (previewContainer) previewContainer.style.display = 'none';
}

function toggleChatEmojiPicker(e) {
  if (e) e.stopPropagation();
  const picker = document.getElementById('chatEmojiPicker');
  if (!picker) return;
  
  if (picker.classList.contains('hidden')) {
    if (!picker.children.length) {
      picker.innerHTML = popularEmojis.map(emoji => `
        <span onclick="insertChatEmoji('${emoji}')" style="font-size:18px; cursor:pointer; padding:4px; text-align:center; border-radius:6px; transition:background 0.2s;" class="emoji-item">${emoji}</span>
      `).join('');
    }
    picker.classList.remove('hidden');
    picker.style.display = 'grid';
  } else {
    hideChatEmojiPicker();
  }
}

function hideChatEmojiPicker() {
  const picker = document.getElementById('chatEmojiPicker');
  if (picker) {
    picker.classList.add('hidden');
    picker.style.display = 'none';
  }
}

function insertChatEmoji(emoji) {
  const input = document.getElementById('chatInputText');
  if (input) {
    input.value += emoji;
    input.focus();
  }
  hideChatEmojiPicker();
}

// Close emoji picker when clicking outside
document.addEventListener('click', (e) => {
  const picker = document.getElementById('chatEmojiPicker');
  const btn = document.getElementById('chatEmojiBtn');
  if (picker && !picker.classList.contains('hidden')) {
    if (!picker.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
      hideChatEmojiPicker();
    }
  }
});

// Dropdown menu toggle helper for message bubbles
function toggleMsgMenu(e, msgId) {
  if (e) e.stopPropagation();
  // Close all OTHER menus
  document.querySelectorAll('[id^="msgMenu-"]').forEach(el => {
    if (el.id !== `msgMenu-${msgId}`) {
      el.style.display = 'none';
    }
  });
  const menu = document.getElementById(`msgMenu-${msgId}`);
  if (menu) {
    const isNowVisible = menu.style.display === 'none' || menu.style.display === '';
    menu.style.display = isNowVisible ? 'block' : 'none';
  }
}

// Ellipsis options dropdown in chat header
function toggleChatHeaderOptions(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById('chatHeaderOptionsDropdown');
  if (dropdown) {
    const isHidden = dropdown.classList.toggle('hidden');
    dropdown.style.display = isHidden ? 'none' : 'block';
  }
}

// Close message menus and header dropdown when clicking outside
document.addEventListener('mousedown', (e) => {
  // Close all message menus if click is outside any menu container
  document.querySelectorAll('[id^="msgMenu-"]').forEach(el => {
    const container = el.closest('.msg-menu-container');
    if (container && !container.contains(e.target)) {
      el.style.display = 'none';
    }
  });
  
  // Close header options if click is outside
  const dropdown = document.getElementById('chatHeaderOptionsDropdown');
  const btn = document.getElementById('chatHeaderOptionsContainer')?.querySelector('button');
  if (dropdown && dropdown.style.display !== 'none' && !dropdown.classList.contains('hidden')) {
    if (e.target !== btn && !btn?.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add('hidden');
      dropdown.style.display = 'none';
    }
  }
});

// (toggleMsgMenu defined above)

async function forwardChatMessage(msgId) {
  document.querySelectorAll('[id^="msgMenu-"]').forEach(el => el.style.display = 'none');
  
  let modal = document.getElementById('forwardMessageModal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'forwardMessageModal';
  modal.className = 'bottom-sheet-modal active';
  modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:2000; display:flex; align-items:center; justify-content:center; padding:16px;';
  modal.onclick = (e) => { if (e.target === modal) closeForwardModal(); };

  const contactsMap = new Map();
  if (Array.isArray(cachedConversations)) {
    cachedConversations.forEach(c => {
      contactsMap.set(String(c.partner_id), { id: c.partner_id, name: c.partner_name, avatar: c.partner_avatar });
    });
  }
  if (Array.isArray(cachedFollowedUsers)) {
    cachedFollowedUsers.forEach(u => {
      const uid = String(u.id || u.user_id);
      if (!contactsMap.has(uid)) {
        contactsMap.set(uid, { id: uid, name: u.display_name || u.name, avatar: u.avatar_url });
      }
    });
  }

  const currentUid = window.currentUser ? String(window.currentUser.id) : null;
  const contactsList = Array.from(contactsMap.values()).filter(c => String(c.id) !== currentUid);

  const contactsHtml = contactsList.length ? contactsList.map(c => `
    <div onclick="executeForwardMessage(${msgId}, '${c.id}', '${(c.name || 'Member').replace(/'/g, "\\'")}')" style="display:flex; align-items:center; justify-content:space-between; padding:10px 12px; border-radius:12px; background:var(--bg-main); border:1px solid var(--border-color); cursor:pointer; margin-bottom:8px;" class="scale-hover">
      <div style="display:flex; align-items:center; gap:10px;">
        <img src="${c.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name || 'User')}&background=10b981&color=fff`}" style="width:34px; height:34px; border-radius:50%; object-fit:cover;" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=User'">
        <div style="font-weight:700; font-size:13px; color:var(--text-primary);">${escapeHtml(c.name || 'Member')}</div>
      </div>
      <button class="btn btn-primary" style="padding:4px 12px; font-size:11px; border-radius:16px;">Forward <i class="fas fa-paper-plane" style="margin-left:4px;"></i></button>
    </div>
  `).join('') : `<div style="text-align:center; color:var(--text-muted); padding:20px; font-size:13px;">No contacts available to forward message.</div>`;

  modal.innerHTML = `
    <div style="background:var(--bg-card); border-radius:20px; padding:20px; width:100%; max-width:420px; border:1px solid var(--border-color); box-shadow:var(--shadow-xl); max-height:80vh; display:flex; flex-direction:column;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <h3 style="margin:0; font-weight:800; font-size:15px; display:flex; align-items:center; gap:8px; color:var(--text-primary);">
          <i class="fas fa-paper-plane" style="color:var(--primary);"></i> Forward Message
        </h3>
        <button onclick="closeForwardModal()" style="border:none; background:var(--bg-main); width:28px; height:28px; border-radius:50%; font-size:14px; cursor:pointer; color:var(--text-muted); display:flex; align-items:center; justify-content:center;">✕</button>
      </div>
      <div style="overflow-y:auto; flex:1; max-height:360px; padding-right:4px;">
        ${contactsHtml}
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

function closeForwardModal() {
  const modal = document.getElementById('forwardMessageModal');
  if (modal) modal.remove();
}

async function executeForwardMessage(msgId, recipientId, recipientName) {
  try {
    const session = getSession();
    if (!session) {
      if (window.showToast) window.showToast("Please log in to forward messages", "error");
      return;
    }

    const msgElem = document.getElementById(`msgMenu-${msgId}`);
    let msgText = '';
    if (msgElem) {
      const bubble = msgElem.closest('.msg-menu-container')?.parentNode;
      const textDiv = bubble?.querySelector('div[style*="word-break"]');
      if (textDiv) {
        msgText = textDiv.innerText.replace(/✓✓|✓|\d+:\d+|\d+m ago|\d+h ago/g, '').trim();
      }
    }

    const payload = {
      receiver_id: recipientId,
      text: msgText ? `[Forwarded]: ${msgText}` : `[Forwarded Message]`
    };

    const res = await fetch(`${window.EcoSocialDB.apiBase}/messages`, {
      method: 'POST',
      headers: window.EcoSocialDB.getAuthHeader(),
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      if (window.showToast) window.showToast(`Message forwarded to ${recipientName}`, "success");
      closeForwardModal();
      if (activeChatPartnerId === String(recipientId)) {
        await selectChatConversation(recipientId);
      }
    } else {
      throw new Error("Failed to forward");
    }
  } catch (e) {
    if (window.showToast) window.showToast("Failed to forward message.", "error");
  }
}

window.forwardChatMessage = forwardChatMessage;
window.executeForwardMessage = executeForwardMessage;
window.closeForwardModal = closeForwardModal;

// Delete specific chat message
async function deleteChatMessage(msgId, deleteType) {
  if (!msgId || !deleteType) return;
  // Close all open menus immediately
  document.querySelectorAll('[id^="msgMenu-"]').forEach(el => el.style.display = 'none');

  if (deleteType === 'all') {
    let ok = true;
    if (window.showConfirmModal) {
      ok = await window.showConfirmModal({
        title: "Delete for Everyone?",
        message: "Are you sure you want to delete this message for everyone in the chat? This cannot be undone.",
        icon: "fa-trash-alt",
        confirmText: "Delete for All",
        cancelText: "Cancel",
        isDanger: true
      });
    } else {
      ok = window.confirm("Are you sure you want to delete this message for everyone? This cannot be undone.");
    }
    if (!ok) return;
  }

  // Optimistically hide/remove the message bubble
  const row = document.getElementById(`msg-row-${msgId}`) || document.querySelector(`[data-msg-id="${msgId}"]`);
  if (row) row.style.display = 'none';

  const curUid = (typeof currentUser !== 'undefined' && currentUser?.id) || (typeof window !== 'undefined' && window.currentUser?.id) || 'usr1';
  try {
    const res = await fetch(`${window.EcoSocialDB.apiBase}/messages/${msgId}?delete_type=${deleteType}&user_id=${encodeURIComponent(curUid)}`, {
      method: 'DELETE',
      headers: window.EcoSocialDB.getAuthHeader()
    });
    if (res.ok) {
      if (row) row.remove();
      const toastFn = window.showToast || (typeof showToast === 'function' ? showToast : null);
      if (toastFn) toastFn(deleteType === 'all' ? "Message deleted for everyone." : "Message deleted for you.", "success");
      if (activeChatPartnerId) {
        // Reload messages to keep state consistent
        try {
          const fetchRes = await fetch(`${window.EcoSocialDB.apiBase}/messages/${activeChatPartnerId}`, {
            headers: window.EcoSocialDB.getAuthHeader()
          });
          if (fetchRes.ok) {
            const data = await fetchRes.json();
            const chatThread = document.getElementById('chatMessagesHistory');
            if (chatThread) renderMessageThread(data.messages || [], chatThread);
          }
        } catch (e) {}
      }
      if (typeof loadConversationsList === 'function') loadConversationsList();
    } else {
      if (row) row.style.display = '';
      throw new Error("Failed to delete");
    }
  } catch (e) {
    if (row) row.style.display = '';
    const toastFn = window.showToast || (typeof showToast === 'function' ? showToast : null);
    if (toastFn) toastFn("Failed to delete message.", "error");
  }
}

async function deleteUserChat(partnerId) {
  const ok = window.showConfirmModal ? await window.showConfirmModal({
    title: "Delete Chat History",
    message: "Are you sure you want to permanently delete this entire chat history? This cannot be undone.",
    icon: "fa-trash-alt",
    confirmText: "Yes, Delete",
    cancelText: "Cancel",
    isDanger: true
  }) : confirm("Are you sure you want to permanently delete this entire chat history? This cannot be undone.");
  if (!ok) return;
  const curUid = (typeof currentUser !== 'undefined' && currentUser?.id) || (typeof window !== 'undefined' && window.currentUser?.id) || 'usr1';
  try {
    const res = await fetch(`${window.EcoSocialDB.apiBase}/messages/conversations/${partnerId}?user_id=${encodeURIComponent(curUid)}`, {
      method: 'DELETE',
      headers: window.EcoSocialDB.getAuthHeader()
    });
    if (res.ok) {
      if (window.showToast) window.showToast("Chat history deleted", "success");
      const chatHistory = document.getElementById('chatMessagesHistory');
      if (chatHistory) {
        chatHistory.innerHTML = `
          <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; min-height:220px; color:var(--text-muted); text-align:center;">
            <i class="far fa-comments fa-3x" style="margin-bottom:12px; opacity:0.4;"></i>
            <p style="font-size:14px; font-weight:700; color:var(--text-primary);">No messages yet</p>
            <p style="font-size:12px;">Say hello to start the conversation!</p>
          </div>
        `;
      }
      const dd = document.getElementById('chatHeaderOptionsDropdown');
      if (dd) dd.style.display = 'none';
      if (typeof closeChatSettingsView === 'function') closeChatSettingsView();
      if (typeof loadConversationsList === 'function') await loadConversationsList();
    } else {
      throw new Error("Deletion failed");
    }
  } catch (e) {
    if (window.showToast) window.showToast("Failed to delete chat history.", "error");
  }
}

// Block/unblock user
async function toggleBlockUser(partnerId) {
  const btn = document.getElementById('chatBlockOptionBtn');
  const isBlocked = btn && btn.textContent.includes('Unblock');
  const endpoint = isBlocked ? 'unblock' : 'block';
  
  try {
    const res = await fetch(`${window.EcoSocialDB.apiBase}/messages/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...window.EcoSocialDB.getAuthHeader()
      },
      body: JSON.stringify({ blocked_id: partnerId })
    });
    
    if (res.ok) {
      if (window.showToast) window.showToast(`User ${isBlocked ? 'unblocked' : 'blocked'} successfully`, "success");
      await selectChatConversation(partnerId);
      await loadConversationsList();
    } else {
      throw new Error("Action failed");
    }
  } catch (e) {
    if (window.showToast) window.showToast("Action failed.", "error");
  }
}

// Open settings pane in chat messages history area
function openChatSettingsView() {
  const headerName = document.getElementById('chatHeaderName');
  const chatThread = document.getElementById('chatMessagesHistory');
  
  if (headerName) {
    headerName.innerHTML = `
      <div style="font-weight:800; font-size:14px; color:var(--text-primary);">
        <i class="fas fa-cog" style="color:var(--primary); margin-right:6px;"></i> Chat Privacy Settings
      </div>
    `;
  }
  
  const session = getSession();
  const currentPrivacy = session ? (session.privacy_setting || 'Public') : 'Public';
  const currentDmPrivacy = session ? (session.dm_privacy_setting || 'Everyone') : 'Everyone';
  
  if (chatThread) {
    chatThread.innerHTML = `
      <div style="padding:24px; max-width:480px; margin:0 auto; text-align:left; display:flex; flex-direction:column; gap:16px;">
        <!-- Account Visibility -->
        <div>
          <h4 style="margin:0 0 6px 0; font-weight:800; color:var(--text-primary); font-size:13.5px;">Account Visibility Settings</h4>
          <p style="font-size:11px; color:var(--text-muted); margin:0 0 10px 0; line-height:1.4;">
            Determine who can see your activity details, training milestones, and animal posts.
          </p>
          <div style="display:flex; flex-direction:column; gap:8px;">
            <label style="display:flex; align-items:flex-start; gap:8px; cursor:pointer; padding:10px; border:1px solid var(--border-color); border-radius:10px; background:var(--bg-card); transition:border-color 0.2s;">
              <input type="radio" name="chatPrivacyOption" value="Public" ${currentPrivacy === 'Public' ? 'checked' : ''} onchange="updateChatSettings('privacy_setting', 'Public')" style="margin-top:2px;">
              <div>
                <div style="font-weight:700; font-size:12px; color:var(--text-primary);">🌍 Public Profile</div>
                <div style="font-size:10.5px; color:var(--text-muted); margin-top:2px;">Everyone in the community can view your pets and activities.</div>
              </div>
            </label>
            
            <label style="display:flex; align-items:flex-start; gap:8px; cursor:pointer; padding:10px; border:1px solid var(--border-color); border-radius:10px; background:var(--bg-card); transition:border-color 0.2s;">
              <input type="radio" name="chatPrivacyOption" value="Private" ${currentPrivacy === 'Private' ? 'checked' : ''} onchange="updateChatSettings('privacy_setting', 'Private')" style="margin-top:2px;">
              <div>
                <div style="font-weight:700; font-size:12px; color:var(--text-primary);">🔒 Private Profile</div>
                <div style="font-size:10.5px; color:var(--text-muted); margin-top:2px;">Only approved followers can view your pets and activities.</div>
              </div>
            </label>
          </div>
        </div>

        <!-- Direct Messages Permissions -->
        <div>
          <h4 style="margin:0 0 6px 0; font-weight:800; color:var(--text-primary); font-size:13.5px;">Direct Messages Permissions</h4>
          <p style="font-size:11px; color:var(--text-muted); margin:0 0 10px 0; line-height:1.4;">
            Determine who can start a direct messaging conversation with you.
          </p>
          <div style="display:flex; flex-direction:column; gap:8px;">
            <label style="display:flex; align-items:flex-start; gap:8px; cursor:pointer; padding:10px; border:1px solid var(--border-color); border-radius:10px; background:var(--bg-card); transition:border-color 0.2s;">
              <input type="radio" name="chatDmPrivacyOption" value="Everyone" ${currentDmPrivacy === 'Everyone' ? 'checked' : ''} onchange="updateChatSettings('dm_privacy_setting', 'Everyone')" style="margin-top:2px;">
              <div>
                <div style="font-weight:700; font-size:12px; color:var(--text-primary);">💬 Everyone</div>
                <div style="font-size:10.5px; color:var(--text-muted); margin-top:2px;">Anyone in the community can start a direct chat with you.</div>
              </div>
            </label>
            
            <label style="display:flex; align-items:flex-start; gap:8px; cursor:pointer; padding:10px; border:1px solid var(--border-color); border-radius:10px; background:var(--bg-card); transition:border-color 0.2s;">
              <input type="radio" name="chatDmPrivacyOption" value="FollowersOnly" ${currentDmPrivacy === 'FollowersOnly' ? 'checked' : ''} onchange="updateChatSettings('dm_privacy_setting', 'FollowersOnly')" style="margin-top:2px;">
              <div>
                <div style="font-weight:700; font-size:12px; color:var(--text-primary);">👥 Followers Only</div>
                <div style="font-size:10.5px; color:var(--text-muted); margin-top:2px;">Only members you follow can send you messages.</div>
              </div>
            </label>
          </div>
        </div>
        
        <div style="text-align:right; margin-top:8px;">
          <button class="btn btn-primary" onclick="closeChatSettingsView()" style="border-radius:12px; padding:6px 16px; font-size:12px; font-weight:700;">Done</button>
        </div>
      </div>
    `;
    
    // Hide input footer in settings view
    const inputFooter = chatThread.nextElementSibling;
    if (inputFooter) inputFooter.style.display = 'none';
  }
}

async function updateChatSettings(field, value) {
  const session = getSession();
  if (!session) return;
  
  const payload = {};
  payload[field] = value;
  
  try {
    const res = await fetch(`${window.EcoSocialDB.apiBase}/profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...window.EcoSocialDB.getAuthHeader()
      },
      body: JSON.stringify(payload)
    });
    
    if (res.ok) {
      session[field] = value;
      window.currentUser[field] = value;
      localStorage.setItem(AUTH_CONFIG.sessionKey, JSON.stringify(window.currentUser));
      if (window.showToast) window.showToast("Settings updated successfully!", "success");
      
      // Update sidebar lists visibility based on new dm_privacy_setting value
      const activeChatsSection = document.getElementById('chatActiveChatsSection');
      if (activeChatsSection) {
        const checkValue = field === 'dm_privacy_setting' ? value : session.dm_privacy_setting;
        if (checkValue === 'FollowersOnly') {
          activeChatsSection.style.display = 'none';
        } else {
          activeChatsSection.style.display = 'flex';
        }
      }
    } else {
      throw new Error("Failed to update settings");
    }
  } catch (e) {
    if (window.showToast) window.showToast("Failed to update settings.", "error");
  }
}

function closeChatSettingsView() {
  const headerName = document.getElementById('chatHeaderName');
  const chatThread = document.getElementById('chatMessagesHistory');
  if (headerName) headerName.innerHTML = `<span style="color:var(--text-muted);">Select a Conversation</span>`;
  if (chatThread) {
    chatThread.innerHTML = `
      <div style="text-align:center; color:var(--text-muted); margin-top:60px;">
        <i class="far fa-comments fa-3x" style="color:var(--primary); opacity:0.3; margin-bottom:12px; display:block;"></i>
        <div style="font-weight:700; font-size:14px; color:var(--text-primary);">EcoTrack Direct Messaging</div>
        <p style="font-size:12px; color:var(--text-muted); margin-top:4px; max-width:280px; margin-left:auto; margin-right:auto;">Select a followed member or active conversation to start communicating.</p>
      </div>
    `;
    const inputFooter = chatThread.nextElementSibling;
    if (inputFooter) inputFooter.style.display = 'flex';
  }
}

window.openMessagingDrawer = openMessagingDrawer;
window.closeMessagingDrawer = closeMessagingDrawer;
window.selectChatConversation = selectChatConversation;
window.sendInboxMessage = sendInboxMessage;
window.openDirectMessageModal = openDirectMessageModal;
window.onSearchChatContacts = onSearchChatContacts;
window.showChatSidebarOnMobile = showChatSidebarOnMobile;
window.toggleChatModalSize = toggleChatModalSize;
window.triggerChatFileUpload = triggerChatFileUpload;
window.handleChatFileUpload = handleChatFileUpload;
window.clearChatAttachment = clearChatAttachment;
window.toggleChatEmojiPicker = toggleChatEmojiPicker;
window.insertChatEmoji = insertChatEmoji;
window.toggleMsgMenu = toggleMsgMenu;
window.deleteChatMessage = deleteChatMessage;
window.toggleChatHeaderOptions = toggleChatHeaderOptions;
window.deleteUserChat = deleteUserChat;
window.toggleBlockUser = toggleBlockUser;
window.openChatSettingsView = openChatSettingsView;
window.updateChatSettings = updateChatSettings;
window.closeChatSettingsView = closeChatSettingsView;
