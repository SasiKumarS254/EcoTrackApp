/**
 * EcoTrack Community Feed Engine
 * Instagram / LinkedIn style animal welfare social platform.
 */

let activeFeedFilter = 'All';
let activeHashtagFilter = '';
let activeSearchQuery = '';

async function initCommunityFeed() {
  const container = document.getElementById('communityPostsContainer');
  if (!container) return;

  container.innerHTML = `
    <div style="text-align:center; padding:40px; color:var(--text-muted);">
      <i class="fas fa-spinner fa-spin fa-2x" style="color:var(--primary); margin-bottom:12px;"></i>
      <div>Loading Community Feed from SQLite DB...</div>
    </div>
  `;

  const currentUserId = window.currentUser ? window.currentUser.id : 'usr1';
  const posts = await window.EcoSocialDB.fetchPosts({
    current_user_id: currentUserId,
    filter: activeFeedFilter,
    hashtag: activeHashtagFilter,
    search: activeSearchQuery
  });

  renderPostsList(posts, container);
  loadSuggestedUsers();
}

async function loadSuggestedUsers() {
  const container = document.getElementById('suggestedUsersList');
  if (!container) return;

  const currentUserId = window.currentUser ? window.currentUser.id : 'usr1';
  const users = await window.EcoSocialDB.fetchRecommendations(currentUserId);

  if (!users || !users.length) {
    container.innerHTML = `<div style="font-size:12px; color:var(--text-muted);">No recommendations available.</div>`;
    return;
  }

  container.innerHTML = users.map(u => `
    <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
      <div style="display:flex; align-items:center; gap:10px; cursor:pointer;" onclick="viewUserProfile('${u.id}')">
        <img src="${u.avatar_url || 'https://images.unsplash.com/photo-1594824813566-7885a3964670?w=400'}" class="avatar-sm">
        <div style="overflow:hidden;">
          <div style="font-weight:700; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--text-main);">
            ${escapeHtml(u.name)}
          </div>
          <div style="font-size:11px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${u.vet_status ? '🩺 Vet Specialist' : '🏋️ Trainer'}
          </div>
        </div>
      </div>
      <button class="btn btn-secondary" style="padding:4px 10px; font-size:11px; border-radius:14px;" onclick="toggleFollowUser('${u.id}', this)">
        Follow
      </button>
    </div>
  `).join('');
}

async function toggleFollowUser(targetId, btnEl) {
  const currentUserId = window.currentUser ? window.currentUser.id : 'usr1';
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
  initCommunityFeed();
}

function onSocialSearchInput(val) {
  activeSearchQuery = val.trim();
  initCommunityFeed();
}

function renderPostsList(posts, container) {
  if (!posts || !posts.length) {
    container.innerHTML = `
      <div class="card" style="text-align:center; padding:60px 20px;">
        <i class="fas fa-comments" style="font-size:48px; color:var(--primary); opacity:0.4; margin-bottom:16px;"></i>
        <h3 style="margin-bottom:8px; font-weight:700;">No Community Posts Found</h3>
        <p style="color:var(--text-muted); max-width:400px; margin:0 auto 20px;">Be the first to share veterinary tips, rescue updates, or training milestones with animal lovers worldwide!</p>
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
  const vetBadge = isVet ? `<span class="vet-badge" title="Verified Veterinarian"><i class="fas fa-stethoscope"></i> Vet</span>` : '';
  const timeAgo = formatTimeAgo(post.created_at);
  const privacyIcon = post.privacy_visibility === 'Private' ? '🔒' : post.privacy_visibility === 'Followers Only' ? '👥' : '🌍';

  const authorAvatar = post.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author_name || 'User')}&background=10b981&color=fff`;
  const formattedContent = formatPostText(post.content);

  // Media gallery
  let mediaHtml = '';
  if (post.media_urls && post.media_urls.length) {
    mediaHtml = `
      <div class="post-media-grid" style="margin-top:12px; border-radius:12px; overflow:hidden; border:1px solid var(--border-color);">
        ${post.media_urls.map(url => `<img src="${url}" alt="Post media" style="width:100%; max-height:280px; object-fit:cover;" loading="lazy" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=600'">`).join('')}
      </div>
    `;
  }

  // Attachments (Training Certificate, Rescue Record)
  let attachmentHtml = '';

  if (post.training_achievement) {
    const t = post.training_achievement;
    attachmentHtml += `
      <div class="post-attachment-card training-attachment">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:11px; font-weight:700; color:#f59e0b;"><i class="fas fa-trophy"></i> Training Achievement</div>
            <div style="font-weight:800; font-size:14px;">${t.planTitle || 'Agility Milestone'}</div>
          </div>
          <div style="font-size:16px; font-weight:900; color:#f59e0b;">+${t.xpEarned || 250} XP</div>
        </div>
      </div>
    `;
  }

  // Comments HTML
  const commentsHtml = (post.comments || []).map(c => renderCommentItemHtml(c, post.id)).join('');

  return `
    <div class="card post-card" id="post-card-${post.id}" style="margin-bottom:0; border-radius:16px; border:1px solid var(--border-color); display:flex; flex-direction:column; justify-content:space-between;">

      <div>
        <!-- Post Header -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <div style="display:flex; align-items:center; gap:10px; cursor:pointer;" onclick="viewUserProfile('${post.user_id}')">
            <img src="${authorAvatar}" class="avatar-md" alt="${escapeHtml(post.author_name)}" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=User&background=10b981&color=fff'">
            <div>
              <div style="font-weight:700; font-size:14px; display:flex; align-items:center; gap:6px;">
                ${escapeHtml(post.author_name)}
                ${vetBadge}
              </div>
              <div style="font-size:11.5px; color:var(--text-muted); display:flex; align-items:center; gap:6px;">
                <span>${post.author_ecotrack_id || '@ecotrack'}</span>
                <span>•</span>
                <span>${timeAgo}</span>
                <span>•</span>
                <span title="Visibility">${privacyIcon}</span>
              </div>
            </div>
          </div>
          <div style="position:relative;">
            <button class="btn-icon" onclick="togglePostMenu(${post.id}, event)"><i class="fas fa-ellipsis-h"></i></button>
          </div>
        </div>

        <!-- Post Content -->
        <div style="font-size:13.5px; line-height:1.5; color:var(--text-main); margin-bottom:10px;">
          ${formattedContent}
        </div>

        ${mediaHtml}
        ${attachmentHtml}

        <!-- Tags & Location -->
        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:8px; font-size:11.5px; color:var(--text-muted);">
          ${post.location_tag ? `<span><i class="fas fa-location-dot" style="color:var(--primary);"></i> ${escapeHtml(post.location_tag)}</span>` : ''}
          ${post.animal_tag ? `<span><i class="fas fa-paw" style="color:var(--primary);"></i> ${escapeHtml(post.animal_tag)}</span>` : ''}
        </div>
      </div>

      <div>
        <!-- Post Action & Counter Bar -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding-top:10px; border-top:1px solid var(--border-color);">
          <button class="post-action-btn ${post.liked_by_me ? 'liked' : ''}" onclick="togglePostLike(${post.id}, this)">
            <i class="${post.liked_by_me ? 'fas' : 'far'} fa-heart"></i>
            <span class="like-count">${post.likes_count || 0}</span>
          </button>

          <button class="post-action-btn" onclick="toggleCommentsSection(${post.id})">
            <i class="far fa-comment"></i>
            <span>${post.comments_count || 0}</span>
          </button>

          <button class="post-action-btn ${post.saved_by_me ? 'saved' : ''}" onclick="togglePostBookmark(${post.id}, this)">
            <i class="${post.saved_by_me ? 'fas' : 'far'} fa-bookmark"></i>
            <span>${post.saves_count || 0}</span>
          </button>

          <button class="post-action-btn" onclick="openShareModal(${post.id})">
            <i class="far fa-paper-plane"></i>
            <span>Share</span>
          </button>
        </div>

        <!-- Comments Section (HIDDEN BY DEFAULT, EXPANDS ONLY ON CLICKING COMMENT BUTTON) -->
        <div id="comments-section-${post.id}" class="comments-section hidden" style="display:none; margin-top:12px; padding-top:12px; border-top:1px dashed var(--border-color);">
          <!-- Add Comment Form -->
          <div style="display:flex; gap:8px; margin-bottom:12px;">
            <img src="${window.currentUser ? window.currentUser.avatar : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400'}" class="avatar-sm" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=Me&background=10b981&color=fff'">
            <div style="flex:1; display:flex; gap:6px;">
              <input type="text" id="comment-input-${post.id}" class="form-input" placeholder="Add a public comment..." style="border-radius:20px; font-size:12px; padding:6px 12px;">
              <button class="btn btn-primary" style="border-radius:20px; padding:6px 14px; font-size:12px;" onclick="submitComment(${post.id})">Post</button>
            </div>
          </div>

          <div id="comments-list-${post.id}">
            ${commentsHtml}
          </div>
        </div>
      </div>

    </div>
  `;
}

async function togglePostLike(postId, btnEl) {
  const userId = window.currentUser ? window.currentUser.id : 'usr1';
  const res = await window.EcoSocialDB.toggleLike(postId, userId);

  // Surgical Update: only change the specific button and count
  const icon = btnEl.querySelector('i');
  const countEl = btnEl.querySelector('.like-count');

  if (res.liked) {
    btnEl.classList.add('liked');
    icon.className = 'fas fa-heart';
    // Add a quick animation trigger if possible
    btnEl.style.transform = 'scale(1.2)';
    setTimeout(() => btnEl.style.transform = 'scale(1)', 150);
  } else {
    btnEl.classList.remove('liked');
    icon.className = 'far fa-heart';
  }
  if (countEl) countEl.textContent = res.likes_count;

  // Update local memory if needed
  const post = COMMUNITY_POSTS.find(p => p.id === postId);
  if (post) {
    post.liked_by_me = res.liked;
    post.likes_count = res.likes_count;
  }
}

async function togglePostBookmark(postId, btnEl) {
  const userId = window.currentUser ? window.currentUser.id : 'usr1';
  const res = await window.EcoSocialDB.toggleBookmark(postId, userId);

  const icon = btnEl.querySelector('i');
  const countEl = btnEl.querySelector('span'); // The bookmark span for count

  if (res.saved) {
    btnEl.classList.add('saved');
    icon.className = 'fas fa-bookmark';
    showToast('Saved to your bookmarks!', 'success');
  } else {
    btnEl.classList.remove('saved');
    icon.className = 'far fa-bookmark';
  }
  if (countEl) countEl.textContent = res.saves_count;

  const post = COMMUNITY_POSTS.find(p => p.id === postId);
  if (post) {
    post.saved_by_me = res.saved;
    post.saves_count = res.saves_count;
  }
}

function toggleCommentsSection(postId) {
  const section = document.getElementById(`comments-section-${postId}`);
  if (section) {
    const isHidden = section.style.display === 'none';
    section.style.display = isHidden ? 'block' : 'none';

    // Auto-focus input if opening
    if (isHidden) {
      setTimeout(() => {
        const input = document.getElementById(`comment-input-${postId}`);
        if (input) input.focus();
      }, 50);
    }
  }
}

async function submitComment(postId) {
  const input = document.getElementById(`comment-input-${postId}`);
  if (!input || !input.value.trim()) return;

  const text = input.value.trim();
  const userId = window.currentUser ? window.currentUser.id : 'usr1';

  const res = await window.EcoSocialDB.addComment(postId, userId, text);
  if (res.comment) {
    // Surgical Update: Append the new comment to the list
    const list = document.getElementById(`comments-list-${postId}`);
    if (list) {
      const commentHtml = renderCommentItemHtml(res.comment, postId);
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = commentHtml;
      list.prepend(tempDiv.firstElementChild);
    }

    // Update count in UI
    const postCard = document.getElementById(`post-card-${postId}`);
    const commentBtn = postCard.querySelector('button[onclick*="toggleCommentsSection"]');
    const countSpan = commentBtn.querySelector('span');
    if (countSpan) countSpan.textContent = res.comments_count;

    input.value = '';
    showToast('Comment posted!', 'success');
  }
}

function renderCommentItemHtml(c, postId) {
  const authorAvatar = c.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.author_name || 'User')}&background=10b981&color=fff`;

  const repliesHtml = (c.replies || []).map(r => `
    <div style="display:flex; gap:8px; margin-top:8px; margin-left:20px; animation: slideInLow 0.3s ease-out;">
      <img src="${r.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.author_name || 'User')}&background=10b981&color=fff`}" class="avatar-xs">
      <div style="flex:1; background:var(--card-bg-subtle, rgba(255,255,255,0.03)); padding:6px 10px; border-radius:10px; border:1px solid var(--border-color);">
        <div style="font-weight:700; font-size:11.5px;">${escapeHtml(r.author_name)}</div>
        <div style="font-size:12px;">${formatPostText(r.text)}</div>
      </div>
    </div>
  `).join('');

  return `
    <div class="comment-item" id="comment-${c.id}" style="margin-top:12px; padding-top:12px; border-top:1px solid var(--border-color);">
      <div style="display:flex; gap:10px;">
        <img src="${authorAvatar}" class="avatar-sm" style="cursor:pointer;" onclick="viewUserProfile('${c.user_id || c.author_name}')">
        <div style="flex:1;">
          <div class="comment-bubble" style="background:var(--card-bg-subtle, rgba(255,255,255,0.04)); padding:8px 12px; border-radius:12px; border:1px solid var(--border-color);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span style="font-weight:700; font-size:12.5px; cursor:pointer;" onclick="viewUserProfile('${c.user_id || c.author_name}')">${escapeHtml(c.author_name)}</span>
              <span style="font-size:10.5px; color:var(--text-muted);">${formatTimeAgo(c.created_at)}</span>
            </div>
            <div style="font-size:12.5px; line-height:1.4;">${formatPostText(c.text)}</div>
          </div>
          <div style="display:flex; gap:14px; margin-top:4px; font-size:11.5px; font-weight:600; color:var(--text-muted); padding-left:4px;">
            <span style="cursor:pointer;" onclick="toggleCommentLike(${c.id}, this)"><i class="far fa-heart"></i> Like</span>
            <span style="cursor:pointer;" onclick="toggleReplyBox(${c.id})"><i class="far fa-comment"></i> Reply</span>
          </div>
          <div id="replies-container-${c.id}">${repliesHtml}</div>
          <div id="reply-box-${c.id}" style="margin-top:8px; margin-left:20px; display:none; gap:8px;">
            <input type="text" id="reply-input-${c.id}" class="form-input" style="font-size:12px; padding:6px 12px;" placeholder="Write a reply..." onkeypress="if(event.key==='Enter') submitReply(${c.id}, ${postId})">
            <button class="btn btn-primary" style="padding:6px 12px; font-size:12px;" onclick="submitReply(${c.id}, ${postId})">Reply</button>
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
  const input = document.getElementById(`reply-input-${commentId}`);
  if (!input || !input.value.trim()) return;

  const text = input.value.trim();
  const userId = window.currentUser ? window.currentUser.id : 'usr1';

  const res = await window.EcoSocialDB.addReply(commentId, postId, userId, text);
  if (res.reply) {
    const container = document.getElementById(`replies-container-${commentId}`);
    if (container) {
      const r = res.reply;
      const replyHtml = `
        <div style="display:flex; gap:8px; margin-top:8px; margin-left:20px; animation: slideInLow 0.3s ease-out;">
          <img src="${r.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.author_name || 'User')}&background=10b981&color=fff`}" class="avatar-xs">
          <div style="flex:1; background:var(--card-bg-subtle, rgba(255,255,255,0.03)); padding:6px 10px; border-radius:10px; border:1px solid var(--border-color);">
            <div style="font-weight:700; font-size:11.5px;">${escapeHtml(r.author_name)}</div>
            <div style="font-size:12px;">${formatPostText(r.text)}</div>
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

function togglePostMenu(postId, event) {
  // Check if menu already exists
  let menu = document.getElementById(`post-menu-${postId}`);
  if (menu) {
    menu.remove();
    return;
  }

  // Remove any other open menus
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

  menu.innerHTML = `
    <div class="menu-item" onclick="copyPostLink(${postId})" style="display:flex; align-items:center; gap:10px; padding:10px; cursor:pointer; font-size:13px; font-weight:600; border-radius:8px;">
      <i class="fas fa-link" style="color:var(--primary); width:16px;"></i> Copy Link
    </div>
    <div class="menu-item" onclick="showToast('Post reported to community moderators','info'); togglePostMenu(${postId})" style="display:flex; align-items:center; gap:10px; padding:10px; cursor:pointer; font-size:13px; font-weight:600; border-radius:8px;">
      <i class="fas fa-flag" style="color:#f59e0b; width:16px;"></i> Report Post
    </div>
    <div class="menu-item" onclick="showToast('You will see fewer posts like this','info'); togglePostMenu(${postId})" style="display:flex; align-items:center; gap:10px; padding:10px; cursor:pointer; font-size:13px; font-weight:600; border-radius:8px;">
      <i class="fas fa-eye-slash" style="color:var(--text-muted); width:16px;"></i> Not Interested
    </div>
  `;

  document.body.appendChild(menu);

  // Close menu when clicking outside
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
  if (modal) modal.classList.remove('hidden');
}

function closeCreatePostModal() {
  const modal = document.getElementById('createPostModal');
  if (modal) modal.classList.add('hidden');
}

async function handleCreatePostSubmit(e) {
  e.preventDefault();
  const content = document.getElementById('createPostText').value.trim();
  const postType = document.getElementById('createPostType').value;
  const visibility = document.getElementById('createPostVisibility').value;
  const locationTag = document.getElementById('createPostLocation').value.trim();
  const animalTag = document.getElementById('createPostAnimal').value.trim();
  const hashtags = document.getElementById('createPostHashtags').value.trim();
  const mediaUrl = document.getElementById('createPostMediaUrl').value.trim();

  const userId = window.currentUser ? window.currentUser.id : 'usr1';

  await window.EcoSocialDB.createPost({
    user_id: userId,
    author_name: window.currentUser ? window.currentUser.name : 'Eco Explorer',
    content,
    post_type: postType,
    privacy_visibility: visibility,
    location_tag: locationTag,
    animal_tag: animalTag,
    hashtags,
    media_urls: mediaUrl ? [mediaUrl] : []
  });

  closeCreatePostModal();
  showToast('Post published successfully!', 'success');
  initCommunityFeed();
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

function formatTimeAgo(dateStr) {
  if (!dateStr) return 'Just now';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function openShareModal(postId) {
  let modal = document.getElementById('sharePostModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'sharePostModal';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); z-index:99999; display:flex; align-items:center; justify-content:center; padding:16px;';
    modal.innerHTML = `
      <div class="card modal-card" style="width:100%; max-width:440px; border-radius:16px; background:var(--card-bg);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h3 style="margin:0; font-weight:800;"><i class="fas fa-share-nodes" style="color:var(--primary);"></i> Share Post</h3>
          <button onclick="closeShareModal()" class="btn-icon">&times;</button>
        </div>
        <p style="font-size:13px; color:var(--text-muted); margin-bottom:16px;">Share this animal welfare update with your community network.</p>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <button class="btn btn-secondary" onclick="copyPostLink(${postId})" style="justify-content:flex-start; gap:10px;">
            <i class="fas fa-link" style="color:var(--primary);"></i> Copy Direct Post Link
          </button>
          <button class="btn btn-secondary" onclick="sharePostToDirectMessage(${postId})" style="justify-content:flex-start; gap:10px;">
            <i class="fas fa-paper-plane" style="color:#3b82f6;"></i> Send in Direct Message
          </button>
          <button class="btn btn-secondary" onclick="shareToExternalSocial('whatsapp', ${postId})" style="justify-content:flex-start; gap:10px;">
            <i class="fab fa-whatsapp" style="color:#22c55e;"></i> Share to WhatsApp
          </button>
          <button class="btn btn-secondary" onclick="shareToExternalSocial('twitter', ${postId})" style="justify-content:flex-start; gap:10px;">
            <i class="fab fa-twitter" style="color:#38bdf8;"></i> Share to X (Twitter)
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  } else {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }
}

function closeShareModal() {
  const modal = document.getElementById('sharePostModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}

function copyPostLink(postId) {
  const url = `${window.location.origin}${window.location.pathname}#community?post=${postId}`;
  navigator.clipboard.writeText(url);
  showToast('Post link copied to clipboard!', 'success');
  closeShareModal();
}

function sharePostToDirectMessage(postId) {
  closeShareModal();
  if (window.openMessagingDrawer) window.openMessagingDrawer();
  showToast('Select a contact to send this post link!', 'info');
}

function shareToExternalSocial(platform, postId) {
  const url = encodeURIComponent(`${window.location.origin}${window.location.pathname}#community?post=${postId}`);
  const text = encodeURIComponent('Check out this animal welfare post on EcoTrack!');
  if (platform === 'whatsapp') window.open(`https://api.whatsapp.com/send?text=${text}%20${url}`, '_blank');
  if (platform === 'twitter') window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  closeShareModal();
}

window.initCommunityFeed = initCommunityFeed;
window.setFeedFilter = setFeedFilter;
window.filterByHashtag = filterByHashtag;
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
