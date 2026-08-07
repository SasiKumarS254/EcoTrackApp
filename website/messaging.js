/**
 * EcoTrack Real-Time Messaging Engine
 * Modern user-to-user chat UI in EcoTrack theme.
 */

let activeChatPartnerId = null;

async function openMessagingDrawer(partnerId) {
  const modal = document.getElementById('messagingDrawerModal');
  if (!modal) return;
  modal.classList.remove('hidden');

  await loadConversationsList();
  if (partnerId) {
    selectChatConversation(partnerId);
  }
}

function closeMessagingDrawer() {
  const modal = document.getElementById('messagingDrawerModal');
  if (modal) modal.classList.add('hidden');
}

async function loadConversationsList() {
  const container = document.getElementById('chatConversationsList');
  if (!container) return;

  const userId = window.currentUser ? window.currentUser.id : 'usr1';

  try {
    const res = await fetch(`http://localhost:5000/api/social/messages/conversations?user_id=${userId}`);
    if (res.ok) {
      const data = await res.json();
      renderConversations(data.conversations || [], container);
      return;
    }
  } catch (e) {
    console.warn('Backend chat API fallback:', e.message);
  }

  // Fallback default threads
  const defaultThreads = [
    { partner_id: 'usr_ananya', partner_name: 'Dr. Ananya Sharma', partner_avatar: 'https://images.unsplash.com/photo-1594824813566-7885a3964670?w=400', last_message: 'Keep saline in your first aid kit!', last_time: '10m ago', unread_count: 1, vet_status: 1 },
    { partner_id: 'usr_marcus', partner_name: 'Marcus Vance', partner_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400', last_message: 'Shadow recall speed reached 98%!', last_time: '2h ago', unread_count: 0, vet_status: 0 }
  ];
  renderConversations(defaultThreads, container);
}

function renderConversations(threads, container) {
  if (!threads.length) {
    container.innerHTML = `<div style="padding:20px; text-align:center; color:var(--text-muted);">No active conversations</div>`;
    return;
  }

  container.innerHTML = threads.map(t => `
    <div class="chat-thread-item ${activeChatPartnerId === t.partner_id ? 'active' : ''}" onclick="selectChatConversation('${t.partner_id}')" style="display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:12px; cursor:pointer; margin-bottom:4px;">
      <div style="position:relative;">
        <img src="${t.partner_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400'}" class="avatar-sm">
        <div style="position:absolute; bottom:0; right:0; width:10px; height:10px; border-radius:50%; background:#10b981; border:2px solid var(--card-bg);"></div>
      </div>
      <div style="flex:1; overflow:hidden;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-weight:700; font-size:13px; color:var(--text-main);">${escapeHtml(t.partner_name)}</span>
          <span style="font-size:10.5px; color:var(--text-muted);">${t.last_time || ''}</span>
        </div>
        <div style="font-size:12px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(t.last_message || '')}</div>
      </div>
      ${t.unread_count ? `<span class="badge" style="background:var(--primary); color:#fff; font-size:11px; padding:2px 6px; border-radius:10px;">${t.unread_count}</span>` : ''}
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
      nameDisp = partnerId === 'usr_ananya' ? 'Dr. Ananya Sharma' : (partnerId === 'usr_marcus' ? 'Marcus Vance' : partnerId);
    }
  }

  if (headerName) {
    headerName.textContent = nameDisp;
    headerName.style.cursor = 'pointer';
    headerName.onclick = () => {
      if (window.openViewProfileModal) {
        window.openViewProfileModal(partnerId);
      }
    };
  }

  const userId = window.currentUser ? window.currentUser.id : 'usr1';

  try {
    const res = await fetch(`http://localhost:5000/api/social/messages/${partnerId}?user_id=${userId}`);
    if (res.ok) {
      const data = await res.json();
      renderMessageThread(data.messages || [], chatThread);
      return;
    }
  } catch (e) {
    console.warn('Fallback messages thread:', e.message);
  }

  const fallbackMsgs = [
    { sender_id: partnerId, text: 'Hello! How can I assist with your pet care today?', is_seen: 1, created_at: new Date(Date.now() - 3600000).toISOString() },
    { sender_id: userId, text: 'Hi! Shadow is doing great following the recall tips.', is_seen: 1, created_at: new Date(Date.now() - 1800000).toISOString() }
  ];
  renderMessageThread(fallbackMsgs, chatThread);
}

function renderMessageThread(messages, container) {
  if (!container) return;
  const userId = window.currentUser ? window.currentUser.id : 'usr1';

  container.innerHTML = messages.map(m => {
    const isMine = m.sender_id === userId;
    return `
      <div style="display:flex; justify-content:${isMine ? 'flex-end' : 'flex-start'}; margin-bottom:10px;">
        <div style="max-width:75%; padding:10px 14px; border-radius:${isMine ? '16px 16px 2px 16px' : '16px 16px 16px 2px'}; background:${isMine ? 'var(--primary)' : 'var(--card-bg-subtle, rgba(255,255,255,0.06))'}; color:${isMine ? '#fff' : 'var(--text-main)'}; border:1px solid var(--border-color); font-size:13px;">
          <div>${escapeHtml(m.text || '')}</div>
          <div style="text-align:right; font-size:10px; opacity:0.7; margin-top:4px;">
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

  const userId = window.currentUser ? window.currentUser.id : 'usr1';

  try {
    await fetch('http://localhost:5000/api/social/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender_id: userId,
        receiver_id: activeChatPartnerId,
        text
      })
    });
  } catch (e) {
    console.warn('API message error:', e.message);
  }

  selectChatConversation(activeChatPartnerId);
}

function openDirectMessageModal(partnerId, partnerName) {
  openMessagingDrawer(partnerId);
  if (partnerId) {
    selectChatConversation(partnerId, partnerName);
  }
}

window.openMessagingDrawer = openMessagingDrawer;
window.closeMessagingDrawer = closeMessagingDrawer;
window.selectChatConversation = selectChatConversation;
window.sendChatMessage = sendChatMessage;
window.openDirectMessageModal = openDirectMessageModal;
