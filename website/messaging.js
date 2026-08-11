/**
 * EcoTrack Real-Time Messaging Engine
 * Modern user-to-user chat UI in EcoTrack theme.
 */

let activeChatPartnerId = null;

async function openMessagingDrawer(partnerId) {
  const modal = document.getElementById('messagingDrawerModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.style.display = 'flex';

  await loadConversationsList();
  if (partnerId) {
    selectChatConversation(partnerId);
  }
}

function closeMessagingDrawer() {
  const modal = document.getElementById('messagingDrawerModal');
  if (modal) {
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
    const res = await fetch(`http://localhost:5000/api/social/messages/conversations`);
    if (res.ok) {
      const data = await res.json();
      renderConversations(data.conversations || [], container);
      return;
    }
  } catch (e) {
    console.warn('Backend chat API failed:', e.message);
  }

  container.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-muted); font-size:12px;">Could not load conversations</div>`;
}

function renderConversations(threads, container) {
  if (!threads.length) {
    container.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-muted); font-size:12.5px;">No active conversations</div>`;
    return;
  }

  container.innerHTML = threads.map(t => `
    <div class="chat-thread-item ${activeChatPartnerId === t.partner_id ? 'active' : ''}" onclick="selectChatConversation('${t.partner_id}')" style="display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:12px; cursor:pointer; margin-bottom:4px; transition: background 0.2s;">
      <div style="position:relative;">
        <img src="${t.partner_avatar || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(t.partner_name || 'User')}" class="avatar-sm" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=User'">
        <div style="position:absolute; bottom:0; right:0; width:10px; height:10px; border-radius:50%; background:#10b981; border:2px solid var(--card-bg, #fff);"></div>
      </div>
      <div style="flex:1; overflow:hidden; text-align:left;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-weight:800; font-size:13px; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(t.partner_name)}</span>
          <span style="font-size:10px; color:var(--text-muted);">${t.last_time ? formatTimeAgo(t.last_time) : ''}</span>
        </div>
        <div style="font-size:12px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(t.last_message || '')}</div>
      </div>
      ${t.unread_count ? `<span class="badge" style="background:var(--primary); color:#fff; font-size:10px; padding:2px 6px; border-radius:10px; font-weight:800;">${t.unread_count}</span>` : ''}
    </div>
  `).join('');
}

async function selectChatConversation(partnerId, partnerName) {
  activeChatPartnerId = partnerId;
  const headerName = document.getElementById('chatHeaderName');
  const chatThread = document.getElementById('chatMessagesHistory');

  let nameDisp = partnerName || '';
  if (!nameDisp) {
    try {
      const res = await fetch(`http://localhost:5000/api/social/profile/${partnerId}`);
      if (res.ok) {
        const data = await res.json();
        nameDisp = data.profile.display_name || data.profile.name;
      }
    } catch(e) {
      nameDisp = 'EcoTrack Member';
    }
  }

  if (headerName) {
    headerName.textContent = nameDisp || 'Chat Partner';
    headerName.style.cursor = 'pointer';
    headerName.onclick = () => {
      closeMessagingDrawer();
      if (window.openViewProfileModal) {
        window.openViewProfileModal(partnerId);
      }
    };
  }

  const session = getSession();
  if (!session) return;

  try {
    const res = await fetch(`http://localhost:5000/api/social/messages/${partnerId}`);
    if (res.ok) {
      const data = await res.json();
      renderMessageThread(data.messages || [], chatThread);
      
      // Refresh list to clear unread badges
      loadConversationsList();
      return;
    }
  } catch (e) {
    console.warn('Messages thread fetch failed:', e.message);
  }

  chatThread.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-muted); font-size:12px;">Could not load messages</div>`;
}

function renderMessageThread(messages, container) {
  if (!container) return;
  const session = getSession();
  const userId = session ? session.id : null;

  if (!messages.length) {
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 20px; color:var(--text-muted); height:100%;">
        <i class="far fa-comments fa-3x" style="color:var(--primary); margin-bottom:12px; opacity:0.4;"></i>
        <div style="font-weight:700; font-size:13.5px; color:var(--text-primary);">Say Hello!</div>
        <p style="font-size:12px; max-width:240px; margin-top:4px;">Start your dialogue regarding wildlife welfare and training insights.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = messages.map(m => {
    const isMine = m.sender_id === userId;
    return `
      <div style="display:flex; justify-content:${isMine ? 'flex-end' : 'flex-start'}; margin-bottom:10px; text-align:left;">
        <div style="max-width:75%; padding:10px 14px; border-radius:${isMine ? '16px 16px 2px 16px' : '16px 16px 16px 2px'}; background:${isMine ? 'var(--primary)' : 'var(--bg-main)'}; color:${isMine ? '#fff' : 'var(--text-primary)'}; border:1px solid var(--border-color); font-size:13px; line-height:1.5;">
          <div>${escapeHtml(m.text || '')}</div>
          <div style="text-align:right; font-size:9.5px; opacity:0.75; margin-top:4px; font-weight:600;">
            ${formatTimeAgo(m.created_at)} ${isMine ? (m.is_seen ? '✓✓' : '✓') : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.scrollTop = container.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById('chatInputText');
  if (!input || !input.value.trim() || !activeChatPartnerId) return;

  const text = input.value.trim();
  input.value = '';

  try {
    const res = await fetch('http://localhost:5000/api/social/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receiver_id: activeChatPartnerId,
        text
      })
    });
    if (!res.ok) throw new Error("Send failed");
  } catch (e) {
    console.warn('API message error:', e.message);
    if (window.showToast) window.showToast("Failed to send message", "error");
  }

  selectChatConversation(activeChatPartnerId);
}

function openDirectMessageModal(partnerId, partnerName) {
  openMessagingDrawer(partnerId);
  if (partnerId) {
    selectChatConversation(partnerId, partnerName);
  }
}

// Reuse helper functions safely
function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return 'Just now';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

window.openMessagingDrawer = openMessagingDrawer;
window.closeMessagingDrawer = closeMessagingDrawer;
window.selectChatConversation = selectChatConversation;
window.sendChatMessage = sendChatMessage;
window.openDirectMessageModal = openDirectMessageModal;
