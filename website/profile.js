/**
 * EcoTrack Redesigned Profile Engine v3.1
 * Functional Account Dashboard with Real-Time Data Sync
 */

let activeProfileTabSection = 'scans';
let activeProfileData = null;
window.activeViewedProfileId = null;

// Helper: get auth headers from local session
function getAuthHeaders() {
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
}

/**
 * Main Profile Entry Point
 * Fetches real data for the current authenticated user or a specific user ID.
 */
async function loadProfileTab(userOrEcoId) {
  const session = getSession();
  const currentUserId = session ? session.id : null;
  const targetId = userOrEcoId || currentUserId;

  if (!targetId) {
    showToast('Please sign in to view your profile', 'info');
    if (window.switchTab) window.switchTab('dashboard');
    return;
  }

  const contentArea = document.getElementById('profileTabContentArea');
  if (contentArea) contentArea.innerHTML = `<div class="tab-loader" style="text-align:center; padding:3rem;"><i class="fas fa-spinner fa-spin fa-2x" style="color:var(--primary);"></i><div style="margin-top:1rem; font-weight:700;">Loading your dashboard...</div></div>`;

  try {
    // 1. Fetch Core Profile & Integrated Stats from Backend
    let data;
    if (targetId === currentUserId) {
      data = await window.EcoSocialDB.fetchMyProfile();
    } else {
      data = await window.EcoSocialDB.fetchProfile(targetId);
    }

    if (!data || !data.profile) throw new Error("Could not retrieve profile data.");

    // 2. Fetch Supplemental Live Metrics (Scans, Training)
    const metrics = await getSupplementalMetrics(targetId);
    activeProfileData = { ...data, metrics };

    // 3. Update UI Header & Summary Stats
    renderProfileDashboard(data.profile, data.impactStats, metrics, targetId);

    // 4. Load Current Sub-tab Content
    switchProfileTabSection(activeProfileTabSection);

  } catch (err) {
    console.error("[Profile] Sync Error:", err);
    if (contentArea) contentArea.innerHTML = `
      <div class="card error-state" style="text-align:center; border-color:var(--danger); border-radius:16px; padding:2rem;">
        <h3 style="color:var(--danger); margin-bottom:10px;"><i class="fas fa-exclamation-triangle"></i> Dashboard Offline</h3>
        <p style="color:var(--text-muted); margin-bottom:16px;">${err.message}</p>
        <button class="btn btn-primary" onclick="loadProfileTab()">Try Again</button>
      </div>`;
  }
}

async function getSupplementalMetrics(userId) {
  const headers = getAuthHeaders();
  const base = AUTH_CONFIG.apiBase;
  try {
    const [scans, progs] = await Promise.all([
      fetch(`${base}/ai/scan-history?user_id=${userId}`, { headers }).then(r => r.ok ? r.json() : []),
      fetch(`${base}/training/programs/${userId}`, { headers }).then(r => r.ok ? r.json() : [])
    ]);
    return { scans, programs: progs };
  } catch (e) {
    console.warn("Failed to load supplemental metrics:", e.message);
    return { scans: [], programs: [] };
  }
}

function renderProfileDashboard(p, impact, metrics, targetId) {
  const isOwner = isSelfProfile(p.id);
  const actionsEl = document.getElementById('profileHeroActions');

  // 1. Unified Avatar Sync
  const avatarEl = document.getElementById('profileAvatarDisplay');
  if (avatarEl) {
    const avatarUrl = p.avatar_url || p.avatar;
    if (avatarUrl && avatarUrl.startsWith('http')) {
      avatarEl.innerHTML = `<img src="${avatarUrl}" alt="${p.name}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
    } else {
      const initial = (p.display_name || p.name || 'E').charAt(0).toUpperCase();
      avatarEl.innerHTML = `<span style="font-size:3rem; font-weight:900; color:#fff;">${initial}</span>`;
      avatarEl.style.background = 'var(--gradient-primary)';
      avatarEl.style.display = 'flex';
      avatarEl.style.alignItems = 'center';
      avatarEl.style.justifyContent = 'center';
      avatarEl.style.borderRadius = '50%';
    }
  }

  // 2. Identity & Meta Information
  setElText('profileHeroName', p.display_name || p.name || 'Anonymous Member');
  setElText('profileHeroBio', p.bio || (isOwner ? 'Tell the community about your welfare journey...' : 'Member of the EcoTrack network.'));

  const locText = (p.city && p.country) ? `${p.city}, ${p.country}` : (p.city || p.country || 'Global Citizen');
  setElText('profileHeroLoc', locText);
  setElText('profileHeroJoined', p.created_at ? `Member since ${new Date(p.created_at).getFullYear()}` : 'Joined recently');

  // 3. Badges & Roles
  const badgesRow = document.getElementById('profileHeroBadges');
  if (badgesRow) {
    let badgesHtml = '';
    if (p.vet_status === 1) badgesHtml += `<span class="profile-badge badge-vet" style="background:var(--primary-light,#10b98115); color:var(--primary); padding:4px 10px; border-radius:10px; font-size:11px; font-weight:800; border:1px solid var(--primary);"><i class="fas fa-user-md"></i> Certified Vet</span>`;
    if (p.role === 'admin') badgesHtml += `<span class="profile-badge badge-admin" style="background:var(--purple); color:#fff; padding:4px 10px; border-radius:10px; font-size:11px; font-weight:800; margin-left:8px;"><i class="fas fa-shield-alt"></i> Staff</span>`;
    badgesRow.innerHTML = badgesHtml;
  }

  // 4. Real-Time Summary Statistics
  setElText('profileFollowersCount', p.followers_count || 0);
  setElText('profileFollowingCount', p.following_count || 0);
  setElText('statScansCount', (metrics && metrics.scans.length) || 0);
  setElText('statTrainingsCount', (metrics && metrics.programs.length) || 0);

  // 5. Environmental Impact
  setElText('statCo2Saved', (impact && impact.co2Saved) || '0 kg');
  setElText('statTreesPlanted', (impact && impact.treesPlanted) || '0');

  // 6. Action Buttons (Owner vs Viewer)
  if (actionsEl) {
    if (isOwner) {
      actionsEl.innerHTML = `
        <button class="btn btn-primary scale-hover" onclick="openEditProfileModal()"><i class="fas fa-user-edit"></i> Edit Profile</button>
        <button class="btn btn-secondary scale-hover" style="margin-left:0.5rem;" onclick="openSettingsModal()"><i class="fas fa-cog"></i> Settings</button>
      `;
    } else {
      const fIcon = p.is_following ? 'fa-check' : 'fa-user-plus';
      const fText = p.is_following ? 'Following' : (p.follow_status === 'Pending' ? 'Requested' : 'Follow');
      actionsEl.innerHTML = `
        <button class="btn ${p.is_following ? 'btn-secondary' : 'btn-primary'} scale-hover" onclick="toggleFollowUser('${p.id}', this)">
          <i class="fas ${fIcon}"></i> ${fText}
        </button>
        <button class="btn btn-secondary scale-hover" style="margin-left:0.5rem;" onclick="openDirectMessageModal('${p.id}', '${(p.display_name || p.name).replace(/'/g, "\\'")}')"><i class="fas fa-paper-plane"></i> Message</button>
      `;
    }
  }
}

function switchProfileTabSection(section, btn) {
  activeProfileTabSection = section;
  document.querySelectorAll('.profile-tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  else {
     const targetBtn = document.querySelector(`[onclick*="switchProfileTabSection('${section}'"]`);
     if (targetBtn) targetBtn.classList.add('active');
  }
  renderProfileSubTab(section);
}

async function renderProfileSubTab(section) {
  const container = document.getElementById('profileTabContentArea');
  if (!container || !activeProfileData) return;

  const data = activeProfileData;
  const p = data.profile;
  const isOwner = isSelfProfile(p.id);

  if (section === 'pets') {
    renderPetsGrid(data.pets || [], container, isOwner);
  } else if (section === 'scans') {
    renderScansList(data.metrics.scans || [], container);
  } else if (section === 'posts') {
    container.innerHTML = `<div class="tab-loader" style="text-align:center; padding:2rem;"><i class="fas fa-spinner fa-spin"></i><span>Fetching activity feed...</span></div>`;
    const posts = await window.EcoSocialDB.fetchPosts({ user_id: p.id });
    renderPostsGrid(posts || [], container);
  } else if (section === 'training') {
    renderTrainingGrid(data.metrics.programs || [], container);
  } else if (section === 'achievements') {
    renderAchievementsList(data.achievements || [], container);
  } else if (section === 'connections') {
    renderConnections(p, container);
  } else if (section === 'account') {
    renderAccountInfo(p, container);
  } else if (section === 'settings') {
    renderSettings(p, container);
  } else if (section === 'saved') {
    container.innerHTML = `<div class="tab-loader" style="text-align:center; padding:2rem;"><i class="fas fa-spinner fa-spin"></i><span>Fetching bookmarked items...</span></div>`;
    const posts = await window.EcoSocialDB.fetchPosts({ saved_only: 'true' });
    renderPostsGrid(posts || [], container);
  } else if (section === 'events') {
    container.innerHTML = `<div class="tab-loader" style="text-align:center; padding:2rem;"><i class="fas fa-spinner fa-spin"></i><span>Fetching registered events...</span></div>`;
    try {
      const res = await fetch(`${AUTH_CONFIG.apiBase}/events/registrations/${p.id}`);
      let events = [];
      if (res.ok) {
        events = await res.json();
      }
      
      // Merge with localStorage if this profile belongs to the current user
      if (isOwner) {
        const localReg = localStorage.getItem(`@ecotrack_events_registered_${p.id}`);
        const localRegIds = localReg ? JSON.parse(localReg) : [];
        const localTickets = localStorage.getItem(`@ecotrack_events_tickets_${p.id}`);
        const localTicketsData = localTickets ? JSON.parse(localTickets) : [];
        
        const savedEvents = localStorage.getItem("@ecotrack_events_list");
        const allEvents = savedEvents ? JSON.parse(savedEvents) : [];
        
        localRegIds.forEach(id => {
          if (!events.some(ev => ev.id === id)) {
            const evDetail = allEvents.find(e => e.id === id);
            if (evDetail) {
              const ticket = localTicketsData.find(t => t.eventId === id);
              events.push({
                ...evDetail,
                user_registration: {
                  user_id: p.id,
                  registered_at: ticket ? ticket.purchaseDate : new Date().toISOString(),
                  ticket_id: ticket ? ticket.serialNumber : 'Registered'
                }
              });
            }
          }
        });
      }

      renderEventsList(events || [], container);
    } catch (e) {
      container.innerHTML = `<div class="empty-state"><h4>Error fetching events</h4></div>`;
    }
  }
}

function renderEventsList(events, container) {
  if (!events.length) {
    container.innerHTML = `
      <div class="empty-state" style="text-align:center; padding:4rem 2rem; color:var(--text-muted);">
        <i class="fas fa-calendar-times fa-3x" style="margin-bottom:1rem; opacity:0.3;"></i>
        <h4>No Registered Events</h4>
        <p>You haven't registered for any wildlife conservation events or volunteer drives yet.</p>
      </div>`;
    return;
  }
  container.innerHTML = `
    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:1.5rem; text-align:left;">
      ${events.map(ev => `
        <div class="card" style="padding:0; overflow:hidden; border:1px solid var(--border-color); background:var(--bg-card); border-radius:16px; display:flex; flex-direction:column; justify-content:space-between; height:100%;">
          <div style="height:140px; background:#000;">
            <img src="${ev.image || 'https://images.unsplash.com/photo-1470240731273-7821a6eeb6bd?w=600'}" style="width:100%; height:100%; object-fit:cover;">
          </div>
          <div style="padding:1.25rem; flex:1;">
            <div style="font-size:0.75rem; font-weight:800; color:var(--primary); text-transform:uppercase; margin-bottom:0.375rem;">${escapeHtml(ev.category || 'Volunteer')}</div>
            <h4 style="margin:0 0 0.5rem 0; font-size:1.05rem; font-weight:900; color:var(--text-primary);">${escapeHtml(ev.title)}</h4>
            <div style="font-size:0.8rem; color:var(--text-muted); display:flex; flex-direction:column; gap:4px;">
              <div><i class="far fa-calendar-alt" style="color:var(--primary); margin-right:6px;"></i>${escapeHtml(ev.date || 'N/A')}</div>
              <div><i class="fas fa-map-marker-alt" style="color:var(--primary); margin-right:6px;"></i>${escapeHtml(ev.location || 'Online')}</div>
            </div>
          </div>
          <div style="padding:1rem 1.25rem; border-top:1px solid var(--border-color); background:var(--bg-main); display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:11px; font-weight:800; color:var(--text-muted);">Pass ID: ${escapeHtml(ev.user_registration?.ticket_id || 'Registered')}</span>
            <button class="btn btn-secondary" style="font-size:0.7rem; padding:6px 12px;" onclick="switchTab('events')">View Ticket</button>
          </div>
        </div>
      `).join('')}
    </div>`;
}

function renderPetsGrid(pets, container, isOwner) {
  if (!pets.length) {
    container.innerHTML = `
      <div class="empty-state" style="text-align:center; padding:4rem 2rem; color:var(--text-muted);">
        <i class="fas fa-paw fa-3x" style="margin-bottom:1rem; opacity:0.3;"></i>
        <h4>No Registered Animals</h4>
        <p>Digitally register your pets for AI monitoring and health tracking.</p>
        ${isOwner ? `<button class="btn btn-primary" style="margin-top:1.5rem;" onclick="openAddPetModal()"><i class="fas fa-plus"></i> Register Animal</button>` : ''}
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="welfare-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:1.5rem;">
      ${pets.map(pet => `
        <div class="card pet-card" style="padding:0; overflow:hidden; transition:transform 0.2s; border:1px solid var(--border-color); background:var(--bg-card);">
          <div style="height:160px; position:relative; background:#000;">
            <img src="${(pet.images && pet.images[0]) || 'https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?w=600'}" style="width:100%; height:100%; object-fit:cover;" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?w=600'">
            <div style="position:absolute; top:12px; right:12px; background:rgba(0,0,0,0.6); color:#fff; padding:4px 10px; border-radius:12px; font-size:10px; font-weight:800; backdrop-filter:blur(4px);">
              ${escapeHtml(pet.breed || pet.species)}
            </div>
          </div>
          <div style="padding:1.25rem; text-align:left;">
            <h4 style="margin:0; font-size:1.1rem; font-weight:900; color:var(--text-primary);">${escapeHtml(pet.name)}</h4>
            <div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">${escapeHtml(pet.age || 'N/A')} • ${escapeHtml(pet.weight || 'N/A')}</div>
            <button class="btn btn-secondary btn-block scale-hover" style="width:100%; margin-top:1rem; font-size:0.75rem; font-weight:800;" onclick="openPetDetailsModal(${pet.id})">Health Record</button>
          </div>
        </div>
      `).join('')}
    </div>`;
}

function renderScansList(scans, container) {
  if (!scans.length) {
    container.innerHTML = `<div class="empty-state" style="text-align:center; padding:4rem 2rem; color:var(--text-muted);"><i class="fas fa-microscope fa-3x" style="margin-bottom:1rem; opacity:0.3;"></i><h4>No Scan History</h4><p>Perform an AI Scan to see biomechanical diagnostics here.</p></div>`;
    return;
  }

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:1rem;">
      ${scans.map(s => `
        <div class="card" style="padding:1rem; display:flex; align-items:center; gap:1.25rem; border-left:4px solid var(--primary); background:var(--bg-card); border-radius:16px;">
          <div style="width:50px; height:50px; border-radius:12px; background:var(--primary-light,#10b98115); color:var(--primary); display:flex; align-items:center; justify-content:center; font-weight:900; font-size:1.25rem; flex-shrink:0;">
            ${s.grade || 'C'}
          </div>
          <div style="flex:1; text-align:left;">
            <div style="font-weight:800; color:var(--text-primary);">${escapeHtml(s.detectedSpecies || 'Animal')} Analysis</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${new Date(s.timestamp).toLocaleDateString()} • ${escapeHtml(s.exerciseName || 'General Scan')}</div>
          </div>
          <button class="btn btn-ghost scale-hover" onclick="viewFullReport('${s.scanId}')"><i class="fas fa-chevron-right"></i></button>
        </div>
      `).join('')}
    </div>`;
}

async function renderConnections(p, container) {
  container.innerHTML = `<div class="tab-loader" style="text-align:center; padding:2rem;"><i class="fas fa-spinner fa-spin"></i><span>Syncing connections...</span></div>`;
  const isOwner = isSelfProfile(p.id);
  try {
    const [followers, following] = await Promise.all([
      window.EcoSocialDB.fetchFollowers(p.id),
      window.EcoSocialDB.fetchFollowing(p.id)
    ]);

    const renderConnectionCard = (u) => `
      <div class="card" style="display:flex; align-items:center; gap:12px; padding:14px; border-radius:14px; background:var(--bg-card); border:1px solid var(--border-color); transition:box-shadow 0.2s;" onmouseenter="this.style.boxShadow='0 4px 16px rgba(16,185,129,0.1)'" onmouseleave="this.style.boxShadow='none'">
        <div style="width:46px; height:46px; border-radius:50%; overflow:hidden; flex-shrink:0; cursor:pointer;" onclick="viewUserProfile('${u.id}')">
          <img src="${u.avatar_url || 'https://ui-avatars.com/api/?name='+encodeURIComponent(u.display_name||u.name)+'&background=10b981&color=fff'}" style="width:100%; height:100%; object-fit:cover;" onerror="this.onerror=null;this.src='https://ui-avatars.com/api/?name=User&background=10b981&color=fff'">
        </div>
        <div style="flex:1; overflow:hidden; text-align:left; cursor:pointer;" onclick="viewUserProfile('${u.id}')">
          <div style="font-size:13.5px; font-weight:800; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(u.display_name || u.name)}</div>
          <div style="font-size:11px; color:var(--text-muted); margin-top:1px;">@${escapeHtml(u.ecotrack_id || 'member')}</div>
        </div>
        ${isOwner ? `
        <button class="btn btn-secondary" style="padding:6px 12px; font-size:11px; font-weight:800; border-radius:10px; flex-shrink:0;" onclick="event.stopPropagation(); openDirectMessageModal('${u.id}', '${escapeHtml(u.display_name||u.name).replace(/'/g,"\\'")}')"><i class="fas fa-comment-dots" style="color:var(--primary);"></i> Chat</button>
        ` : ''}
      </div>
    `;

    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:2rem;">
        <div class="card" style="border-radius:16px; background:var(--bg-card);">
          <div class="card-title" style="margin-bottom:1.5rem; font-weight:800; color:var(--text-primary);"><i class="fas fa-user-friends" style="color:var(--primary);"></i> Following (${following.length})</div>
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:0.875rem;">
            ${following.length ? following.map(u => renderConnectionCard(u)).join('') : '<p style="font-size:0.85rem; color:var(--text-muted); text-align:left; grid-column:1/-1;">Not following any members yet.</p>'}
          </div>
        </div>
        <div class="card" style="border-radius:16px; background:var(--bg-card);">
          <div class="card-title" style="margin-bottom:1.5rem; font-weight:800; color:var(--text-primary);"><i class="fas fa-users" style="color:var(--primary);"></i> Followers (${followers.length})</div>
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:0.875rem;">
            ${followers.length ? followers.map(u => renderConnectionCard(u)).join('') : '<p style="font-size:0.85rem; color:var(--text-muted); text-align:left; grid-column:1/-1;">No followers yet.</p>'}
          </div>
        </div>
      </div>`;
  } catch (err) { container.innerHTML = `<div class="empty-state"><h4>Failed to load connections</h4></div>`; }
}

function renderAccountInfo(p, container) {
  container.innerHTML = `
    <div class="card" style="border-radius:16px; background:var(--bg-card);">
      <div class="card-title" style="margin-bottom:1.5rem; font-weight:800; color:var(--text-primary);"><i class="fas fa-id-card" style="color:var(--primary);"></i> Account Information</div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:2rem; text-align:left;">
        <div class="info-item">
          <label class="login-label" style="font-size:11px; font-weight:800; color:var(--text-muted);">Universal ID</label>
          <div style="font-weight:700; font-family:monospace; color:var(--primary); font-size:1.1rem; margin-top:0.25rem;">${p.ecotrack_id || p.id}</div>
        </div>
        <div class="info-item">
          <label class="login-label" style="font-size:11px; font-weight:800; color:var(--text-muted);">Verified Email</label>
          <div style="font-weight:700; margin-top:0.25rem; color:var(--text-primary);">${p.email}</div>
        </div>
        <div class="info-item">
          <label class="login-label" style="font-size:11px; font-weight:800; color:var(--text-muted);">Member Role</label>
          <div style="font-weight:700; margin-top:0.25rem; color:var(--primary);"><i class="fas fa-check-circle"></i> ${p.role === 'admin' ? 'Administrator' : 'Standard Member'}</div>
        </div>
        <div class="info-item">
          <label class="login-label" style="font-size:11px; font-weight:800; color:var(--text-muted);">Join Date</label>
          <div style="font-weight:700; margin-top:0.25rem; color:var(--text-primary);">${p.created_at ? new Date(p.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'August 2026'}</div>
        </div>
      </div>
      <hr style="border:none; border-top:1px solid var(--border-color); margin:2rem 0;">
      <div class="card-title" style="margin-bottom:1.5rem; font-weight:800; color:var(--text-primary);"><i class="fas fa-user-shield" style="color:var(--primary);"></i> Profile Visibility</div>
      <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-main); padding:1rem; border-radius:12px; border:1px solid var(--border-color);">
        <div style="font-weight:700; color:var(--text-primary);">Account Privacy Status</div>
        <span style="background:var(--primary); color:#fff; padding:4px 12px; border-radius:20px; font-size:11px; font-weight:800;">${p.privacy_setting || 'Public'}</span>
      </div>
    </div>`;
}

function renderSettings(p, container) {
  if (!isSelfProfile(p.id)) {
    container.innerHTML = `<div class="empty-state" style="text-align:center; padding:4rem 2rem;"><i class="fas fa-lock fa-3x" style="opacity:0.2; margin-bottom:1rem;"></i><h4>Privacy Restricted</h4><p>You cannot manage settings for other members.</p></div>`;
    return;
  }
  container.innerHTML = `
    <div class="card" style="border-radius:16px; background:var(--bg-card);">
      <div class="card-title" style="margin-bottom:1.5rem; font-weight:800; color:var(--text-primary);"><i class="fas fa-cog" style="color:var(--primary);"></i> Account Preferences</div>
      <div style="display:flex; flex-direction:column; gap:1.25rem; text-align:left;">
        <div style="display:flex; justify-content:space-between; align-items:center; padding:1.25rem; background:var(--bg-main); border-radius:12px; border:1px solid var(--border-color);">
          <div>
            <div style="font-weight:800; font-size:0.95rem; color:var(--text-primary);">Interface Theme</div>
            <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">Switch between light and dark visual modes.</div>
          </div>
          <button class="btn btn-secondary scale-hover" onclick="toggleTheme()"><i class="fas fa-circle-half-stroke"></i> Switch</button>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; padding:1.25rem; background:var(--bg-main); border-radius:12px; border:1px solid var(--border-color);">
          <div>
            <div style="font-weight:800; font-size:0.95rem; color:var(--text-primary);">Push Notifications</div>
            <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">Receive real-time alerts for scans and social activity.</div>
          </div>
          <button class="btn btn-secondary scale-hover">Manage</button>
        </div>

        <button class="btn btn-danger scale-hover" style="background:rgba(239,68,68,0.08); color:var(--danger); border:1px solid rgba(239,68,68,0.2); width:100%; font-weight:900; margin-top:1rem; height:3.5rem; border-radius:12px;" onclick="handleLogout()">
          <i class="fas fa-sign-out-alt"></i> Sign Out of EcoTrack
        </button>
      </div>
    </div>`;
}

function renderAchievementsList(ach, container) {
  const totalScans = activeProfileData?.metrics?.scans?.length || 0;
  const totalPlans = activeProfileData?.metrics?.programs?.length || 0;
  const followingCount = activeProfileData?.profile?.following_count || 0;

  const milestones = [
    { name: "AI Bio-Scanner Pioneer",   code: "AI_PIONEER",          icon: "🔬", desc: "Perform your first AI pose estimation scan.",        current: totalScans,    target: 1,  color: "#3b82f6", gradient: "135deg, #3b82f6, #1d4ed8" },
    { name: "Elite Species Analyst",    code: "SPECIES_ANALYST",     icon: "🧬", desc: "Perform 5 or more AI pose estimation scans.",         current: totalScans,    target: 5,  color: "#8b5cf6", gradient: "135deg, #8b5cf6, #6d28d9" },
    { name: "Certified Trainer",        code: "CERTIFIED_TRAINER",   icon: "🏋️", desc: "Register your first custom AI training program.",     current: totalPlans,    target: 1,  color: "#10b981", gradient: "135deg, #10b981, #059669" },
    { name: "Master Welfare Coach",     code: "WELFARE_COACH",       icon: "🎓", desc: "Register 3 or more AI training programs.",            current: totalPlans,    target: 3,  color: "#f59e0b", gradient: "135deg, #f59e0b, #d97706" },
    { name: "Community Connector",      code: "COMMUNITY_CONNECTOR", icon: "🤝", desc: "Follow 3 or more members in the EcoTrack network.",   current: followingCount, target: 3, color: "#ec4899", gradient: "135deg, #ec4899, #be185d" }
  ];

  // Merge: treat any milestone at 100% as earned even if backend hasn't synced yet
  const earnedNames = new Set(ach.map(a => a.badge_name || a.title));
  const locallyEarned = milestones.filter(m => m.current >= m.target && !earnedNames.has(m.name));
  const mergedAch = [
    ...ach,
    ...locallyEarned.map(m => ({
      badge_name: m.name,
      title: m.name,
      icon: m.icon,
      description: m.desc,
      _local: true
    }))
  ];

  const unlockedHtml = mergedAch.map(a => {
    const milestone = milestones.find(m => m.name === (a.badge_name || a.title));
    const color = milestone?.color || '#10b981';
    const gradient = milestone?.gradient || '135deg, #10b981, #059669';
    return `
    <div class="card" style="display:flex; flex-direction:column; gap:0; padding:0; background:var(--bg-card); border:none; border-radius:20px; text-align:left; box-shadow:0 8px 24px rgba(0,0,0,0.1); overflow:hidden; position:relative;">
      <!-- Badge gradient banner -->
      <div style="background:linear-gradient(${gradient}); padding:20px 20px 28px; position:relative;">
        <div style="position:absolute; top:0; left:0; right:0; bottom:0; background:url('data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'><circle cx=\'80\' cy=\'20\' r=\'30\' fill=\'rgba(255,255,255,0.07)\'></circle><circle cx=\'20\' cy=\'80\' r=\'20\' fill=\'rgba(255,255,255,0.05)\'></circle></svg>'); background-size:cover;"></div>
        <div style="position:relative; display:flex; align-items:center; gap:16px;">
          <div style="width:60px; height:60px; border-radius:50%; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:2rem; backdrop-filter:blur(4px); border:2px solid rgba(255,255,255,0.3); flex-shrink:0;">${a.icon || '🏆'}</div>
          <div>
            <div style="font-size:10px; font-weight:800; color:rgba(255,255,255,0.75); text-transform:uppercase; letter-spacing:1.5px; margin-bottom:4px;">Achievement Unlocked</div>
            <div style="font-weight:900; font-size:1.05rem; color:#fff; line-height:1.2;">${escapeHtml(a.badge_name || a.title)}</div>
          </div>
          <div style="margin-left:auto; width:28px; height:28px; border-radius:50%; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            <i class="fas fa-check" style="color:#fff; font-size:12px;"></i>
          </div>
        </div>
      </div>
      <!-- Bottom content -->
      <div style="padding:16px 20px; display:flex; justify-content:space-between; align-items:center; background:var(--bg-card);">
        <div style="font-size:0.78rem; color:var(--text-muted); flex:1; padding-right:8px;">${escapeHtml(a.description || milestone?.desc || 'Earned milestone.')}</div>
        <button class="btn" style="font-size:0.7rem; padding:6px 14px; font-weight:800; color:#fff; background:linear-gradient(${gradient}); border:none; border-radius:10px; flex-shrink:0;" onclick="shareAchievementToFeed('${(a.badge_name || a.title).replace(/'/g, "\\'")}", '${a.icon || '🏆'}')">
          <i class="fas fa-share-nodes"></i> Share
        </button>
      </div>
    </div>
  `}).join('');

  const lockedMilestones = milestones.filter(m => !mergedAch.some(a => (a.badge_name || a.title) === m.name));
  const lockedHtml = lockedMilestones.map(m => {
    const pct = Math.min(100, Math.round((m.current / m.target) * 100));
    return `
      <div class="card" style="display:flex; flex-direction:column; gap:0.75rem; padding:0; background:var(--bg-card); border:1px solid var(--border-color); border-radius:20px; text-align:left; overflow:hidden;">
        <div style="background:linear-gradient(135deg, var(--bg-main) 0%, var(--border-color) 100%); padding:18px; position:relative;">
          <div style="display:flex; align-items:center; gap:14px;">
            <div style="width:54px; height:54px; border-radius:50%; background:var(--border-color); display:flex; align-items:center; justify-content:center; font-size:1.75rem; filter:grayscale(80%); flex-shrink:0;">${m.icon}</div>
            <div style="flex:1;">
              <div style="font-weight:900; color:var(--text-secondary); font-size:0.95rem;">${m.name}</div>
              <div style="font-size:0.75rem; color:var(--text-muted); margin-top:3px; line-height:1.4;">${m.desc}</div>
            </div>
          </div>
        </div>
        <div style="padding:0 18px 16px;">
          <div style="display:flex; justify-content:space-between; font-size:0.7rem; font-weight:800; color:var(--text-muted); margin-bottom:6px;">
            <span>Milestone Progress</span>
            <span style="color:${pct >= 80 ? 'var(--primary)' : 'var(--text-muted)'}">${m.current} / ${m.target} (${pct}%)</span>
          </div>
          <div style="height:8px; background:var(--bg-main); border-radius:4px; overflow:hidden; border:1px solid var(--border-color);">
            <div style="width:${pct}%; height:100%; background:linear-gradient(90deg, ${m.color}80, ${m.color}); transition:width 0.6s ease; border-radius:4px;"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div>
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:1.25rem;">
        <div style="width:36px; height:36px; border-radius:10px; background:linear-gradient(135deg, #f59e0b, #d97706); display:flex; align-items:center; justify-content:center;">
          <i class="fas fa-medal" style="color:#fff; font-size:16px;"></i>
        </div>
        <div>
          <h3 style="font-weight:900; font-size:1.1rem; color:var(--text-primary); margin:0;">Earned Badges <span style="color:var(--primary);">(${mergedAch.length})</span></h3>
          <div style="font-size:0.75rem; color:var(--text-muted);">Your conservation achievements</div>
        </div>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(290px, 1fr)); gap:1.25rem; margin-bottom:2.5rem;">
        ${unlockedHtml || `<div style="grid-column:1/-1; background:var(--bg-main); border-radius:16px; padding:2.5rem; text-align:center; border:2px dashed var(--border-color);"><i class="fas fa-award" style="font-size:2.5rem; color:var(--border-color); margin-bottom:12px; display:block;"></i><div style="font-weight:800; color:var(--text-muted);">No badges earned yet</div><div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">Participate in AI Scans and training programs to unlock your first badge!</div></div>`}
      </div>

      <div style="display:flex; align-items:center; gap:12px; margin-bottom:1.25rem;">
        <div style="width:36px; height:36px; border-radius:10px; background:var(--bg-main); border:1px solid var(--border-color); display:flex; align-items:center; justify-content:center;">
          <i class="fas fa-lock" style="color:var(--text-muted); font-size:14px;"></i>
        </div>
        <div>
          <h3 style="font-weight:900; font-size:1.1rem; color:var(--text-primary); margin:0;">Locked Milestones <span style="color:var(--text-muted);">(${lockedMilestones.length})</span></h3>
          <div style="font-size:0.75rem; color:var(--text-muted);">Keep going to unlock these!</div>
        </div>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(290px, 1fr)); gap:1.25rem;">
        ${lockedHtml || '<p style="font-size:0.85rem; color:var(--primary); font-weight:800; text-align:left; grid-column:1/-1;">🎉 All badges unlocked! You are a master ecosystem warden.</p>'}
      </div>
    </div>
  `;
}

async function shareAchievementToFeed(badgeName, icon) {
  try {
    const text = `🏆 I just unlocked the "${badgeName}" achievement on EcoTrack! ${icon}\nJoin me in protecting animal welfare!`;
    const res = await window.EcoSocialDB.createPost({
      content: text,
      post_type: 'achievement'
    });
    if (res) {
      showToast(`Shared "${badgeName}" achievement to community feed!`, 'success');
      if (window.switchTab) window.switchTab('community');
      if (window.initCommunityFeed) window.initCommunityFeed();
    }
  } catch (e) {
    showToast('Failed to share achievement.', 'error');
  }
}
window.shareAchievementToFeed = shareAchievementToFeed;

function computeTrainingProgress(prog) {
  // progress is an object {completed_exercises: [], current_week, total_scans, avg_score}
  if (typeof prog === 'number') return prog;
  if (!prog || typeof prog !== 'object') return 0;
  const completed = Array.isArray(prog.completed_exercises) ? prog.completed_exercises.length : 0;
  // Estimate total exercises from avg (default 5 drills per week, 4 weeks = 20)
  const totalWeeks = prog.total_weeks || 4;
  const drillsPerWeek = 5;
  const estimated = totalWeeks * drillsPerWeek;
  if (estimated === 0) return prog.avg_score ? Math.round(prog.avg_score) : 0;
  return Math.min(100, Math.round((completed / estimated) * 100));
}

function openTrainingPlanDetail(progIndex) {
  const prog = activeProfileData?.metrics?.programs?.[progIndex];
  if (!prog) return;

  const progress = prog.progress || {};
  const pct = computeTrainingProgress(progress);
  const completedExs = Array.isArray(progress.completed_exercises) ? progress.completed_exercises : [];
  const currentWeek = progress.current_week || 1;
  const totalScans = progress.total_scans || 0;
  const avgScore = progress.avg_score ? progress.avg_score.toFixed(1) : 'N/A';

  // Build drills list from completed exercises
  const drillsHtml = completedExs.length
    ? completedExs.map(ex => `
        <div style="display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid var(--border-color);">
          <div style="width:28px; height:28px; border-radius:8px; background:rgba(16,185,129,0.1); color:var(--primary); display:flex; align-items:center; justify-content:center; flex-shrink:0;"><i class="fas fa-check" style="font-size:11px;"></i></div>
          <div style="font-size:13px; font-weight:700; color:var(--text-primary);">${escapeHtml(String(ex))}</div>
        </div>`).join('')
    : `<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:13px;">No exercises completed yet. Start training!</div>`;

  let existingModal = document.getElementById('trainingDetailModal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'trainingDetailModal';
  modal.className = 'modal-backdrop';
  modal.style.cssText = 'display:flex;';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  modal.innerHTML = `
    <div class="modal-card" style="max-width:580px; padding:0; border-radius:24px; overflow:hidden; max-height:85vh; display:flex; flex-direction:column;">
      <!-- Header Banner -->
      <div style="background:linear-gradient(135deg, #10b981, #059669); padding:28px 28px 22px; position:relative;">
        <div style="position:absolute; top:0; right:0; width:140px; height:140px; border-radius:50%; background:rgba(255,255,255,0.06); transform:translate(40px,-40px);"></div>
        <button onclick="document.getElementById('trainingDetailModal').remove()" style="position:absolute; top:16px; right:16px; background:rgba(255,255,255,0.2); border:none; color:#fff; width:32px; height:32px; border-radius:50%; cursor:pointer; font-size:16px; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(4px);">✕</button>
        <div style="display:flex; align-items:center; gap:14px; position:relative;">
          <div style="width:52px; height:52px; border-radius:16px; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; backdrop-filter:blur(4px);">
            <i class="fas fa-dumbbell" style="color:#fff; font-size:22px;"></i>
          </div>
          <div>
            <div style="font-size:11px; font-weight:800; color:rgba(255,255,255,0.7); text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Training Plan</div>
            <div style="font-size:1.2rem; font-weight:900; color:#fff;">${escapeHtml(prog.title || (prog.species || 'Animal') + ' Program')}</div>
            <div style="font-size:12px; color:rgba(255,255,255,0.75); margin-top:3px;">Started ${new Date(prog.started_at).toLocaleDateString('en-US', {month:'long', day:'numeric', year:'numeric'})}</div>
          </div>
        </div>
        <!-- Progress bar -->
        <div style="margin-top:18px;">
          <div style="display:flex; justify-content:space-between; font-size:11px; font-weight:800; color:rgba(255,255,255,0.8); margin-bottom:6px;">
            <span>Overall Progress</span><span>${pct}% Complete</span>
          </div>
          <div style="height:10px; background:rgba(255,255,255,0.2); border-radius:5px; overflow:hidden;">
            <div style="width:${pct}%; height:100%; background:rgba(255,255,255,0.9); border-radius:5px; transition:width 0.6s ease;"></div>
          </div>
        </div>
      </div>

      <!-- Stats row -->
      <div style="display:grid; grid-template-columns:repeat(3,1fr); background:var(--bg-main); border-bottom:1px solid var(--border-color);">
        <div style="padding:14px; text-align:center; border-right:1px solid var(--border-color);">
          <div style="font-size:1.3rem; font-weight:900; color:var(--primary);">${currentWeek}</div>
          <div style="font-size:10px; font-weight:800; color:var(--text-muted); text-transform:uppercase;">Week</div>
        </div>
        <div style="padding:14px; text-align:center; border-right:1px solid var(--border-color);">
          <div style="font-size:1.3rem; font-weight:900; color:var(--primary);">${completedExs.length}</div>
          <div style="font-size:10px; font-weight:800; color:var(--text-muted); text-transform:uppercase;">Drills Done</div>
        </div>
        <div style="padding:14px; text-align:center;">
          <div style="font-size:1.3rem; font-weight:900; color:var(--primary);">${totalScans}</div>
          <div style="font-size:10px; font-weight:800; color:var(--text-muted); text-transform:uppercase;">AI Scans</div>
        </div>
      </div>

      <!-- Body -->
      <div style="flex:1; overflow-y:auto; padding:24px;">
        <div style="font-weight:900; font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:12px;">Plan Details</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:20px;">
          <div style="background:var(--bg-main); border:1px solid var(--border-color); border-radius:12px; padding:12px;">
            <div style="font-size:10px; font-weight:800; color:var(--text-muted); text-transform:uppercase;">Species</div>
            <div style="font-weight:800; color:var(--text-primary); margin-top:3px;">${escapeHtml(prog.species || 'General')}</div>
          </div>
          <div style="background:var(--bg-main); border:1px solid var(--border-color); border-radius:12px; padding:12px;">
            <div style="font-size:10px; font-weight:800; color:var(--text-muted); text-transform:uppercase;">Goal</div>
            <div style="font-weight:800; color:var(--text-primary); margin-top:3px;">${escapeHtml(prog.goal || 'General Training')}</div>
          </div>
        </div>
        <div style="font-weight:900; font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:12px;">Completed Exercises (${completedExs.length})</div>
        <div style="background:var(--bg-main); border:1px solid var(--border-color); border-radius:12px; padding:0 16px;">
          ${drillsHtml}
        </div>
        ${avgScore !== 'N/A' ? `
          <div style="margin-top:16px; padding:14px; background:linear-gradient(135deg, rgba(16,185,129,0.08), rgba(5,150,105,0.04)); border:1px solid rgba(16,185,129,0.2); border-radius:12px; display:flex; align-items:center; gap:12px;">
            <div style="width:40px; height:40px; border-radius:10px; background:linear-gradient(135deg, #10b981, #059669); display:flex; align-items:center; justify-content:center;"><i class="fas fa-star" style="color:#fff; font-size:16px;"></i></div>
            <div><div style="font-size:10px; font-weight:800; color:var(--text-muted); text-transform:uppercase;">Average Score</div><div style="font-size:1.4rem; font-weight:900; color:var(--primary);">${avgScore}%</div></div>
          </div>` : ''}
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}
window.openTrainingPlanDetail = openTrainingPlanDetail;

function renderTrainingGrid(progs, container) {
  if (!progs.length) {
    container.innerHTML = `<div class="empty-state" style="text-align:center; padding:4rem 2rem; color:var(--text-muted);"><i class="fas fa-bolt-lightning fa-3x" style="margin-bottom:1rem; opacity:0.3;"></i><h4>No Training Logs</h4><p>Start a training program in the Species AI Trainer tab.</p></div>`;
    return;
  }
  container.innerHTML = `
    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:1.5rem;">
      ${progs.map((p, idx) => {
        const pct = computeTrainingProgress(p.progress);
        return `
        <div class="card" style="padding:0; background:var(--bg-card); border:1px solid var(--border-color); border-radius:20px; text-align:left; overflow:hidden; cursor:pointer; transition:transform 0.2s, box-shadow 0.2s;" onclick="openTrainingPlanDetail(${idx})" onmouseenter="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 12px 32px rgba(16,185,129,0.15)'" onmouseleave="this.style.transform=''; this.style.boxShadow='none'">
          <!-- Card top accent -->
          <div style="height:4px; background:linear-gradient(90deg, #10b981, #059669);"></div>
          <div style="padding:1.5rem;">
            <div style="display:flex; align-items:center; gap:1rem; margin-bottom:1.25rem;">
              <div style="width:46px; height:46px; border-radius:14px; background:linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.1)); color:var(--primary); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <i class="fas fa-dumbbell"></i>
              </div>
              <div style="flex:1; overflow:hidden;">
                <div style="font-weight:900; font-size:1rem; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(p.title || (p.species || 'Animal') + ' Program')}</div>
                <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">${new Date(p.started_at).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})}</div>
              </div>
              <div style="flex-shrink:0; width:36px; height:36px; border-radius:50%; background:var(--bg-main); display:flex; align-items:center; justify-content:center;">
                <i class="fas fa-chevron-right" style="color:var(--primary); font-size:12px;"></i>
              </div>
            </div>
            <div style="margin-bottom:0.5rem; display:flex; justify-content:space-between; font-size:0.75rem; font-weight:800;">
              <span style="color:var(--text-secondary);">Current Progress</span>
              <span style="color:var(--primary);">${pct}%</span>
            </div>
            <div style="height:8px; background:var(--bg-main); border-radius:4px; overflow:hidden; border:1px solid var(--border-color);">
              <div style="width:${pct}%; height:100%; background:linear-gradient(90deg, #10b981, #059669); transition:width 0.5s ease;"></div>
            </div>
            <div style="margin-top:12px; font-size:11px; color:var(--text-muted); font-weight:700;">Click to view full training plan →</div>
          </div>
        </div>
      `}).join('')}
    </div>`;
}

function renderPostsGrid(posts, container) {
  if (!posts.length) {
    container.innerHTML = `<div class="empty-state" style="text-align:center; padding:4rem 2rem; color:var(--text-muted);"><i class="fas fa-rss fa-3x" style="margin-bottom:1rem; opacity:0.3;"></i><h4>No Activity Found</h4><p>This user hasn't shared any community updates yet.</p></div>`;
    return;
  }
  container.innerHTML = `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:1.5rem; text-align:left;">${posts.map(p => window.renderPostCardHtml(p)).join('')}</div>`;
}

// ── Redesigned External Profile Modal Loader ──
async function openViewProfileModal(userIdOrEcoId) {
  const modal = document.getElementById('viewProfileModal');
  if (!modal) return;

  // Clear previous data
  document.getElementById('viewProfileName').textContent = "Loading Profile...";
  document.getElementById('viewProfileBio').textContent = "";
  document.getElementById('viewProfileEcoId').textContent = "";
  document.getElementById('viewProfileLoc').innerHTML = "";
  document.getElementById('viewProfileJoined').innerHTML = "";
  document.getElementById('viewProfileAvatarContainer').innerHTML = "";
  document.getElementById('viewProfileBadges').innerHTML = "";
  document.getElementById('viewProfilePetsGrid').innerHTML = "";
  document.getElementById('viewProfileBadgesGrid').innerHTML = "";
  document.getElementById('viewStatFollowers').textContent = "0";
  document.getElementById('viewStatFollowing').textContent = "0";
  document.getElementById('viewStatScans').textContent = "0";
  document.getElementById('viewStatTrainings').textContent = "0";
  document.getElementById('viewProfileRestrictedNotice').style.display = 'none';
  document.getElementById('viewProfilePublicContent').style.display = 'none';

  modal.classList.remove('hidden');
  modal.style.display = 'flex';
  modal.classList.add('active');

  try {
    const [data, metrics] = await Promise.all([
      window.EcoSocialDB.fetchProfile(userIdOrEcoId),
      getSupplementalMetrics(userIdOrEcoId)
    ]);
    if (!data || !data.profile) {
      showToast("Could not retrieve user details.", "error");
      closeViewProfileModal();
      return;
    }

    const p = data.profile;
    window.activeViewedProfileId = p.id;

    // Display fields
    document.getElementById('viewProfileName').textContent = p.display_name || p.name || 'Anonymous User';
    document.getElementById('viewProfileBio').textContent = p.bio || 'EcoTrack welfare network participant';
    document.getElementById('viewProfileEcoId').textContent = `@${p.ecotrack_id || 'ecotrack'}`;

    const locText = (p.city && p.country) ? `${p.city}, ${p.country}` : (p.city || p.country || 'Global');
    document.getElementById('viewProfileLoc').innerHTML = `<i class="fas fa-map-marker-alt"></i> ${escapeHtml(locText)}`;
    const joinYear = p.created_at ? new Date(p.created_at).getFullYear() : '2026';
    document.getElementById('viewProfileJoined').innerHTML = `<i class="fas fa-calendar-alt"></i> Joined ${joinYear}`;

    // Cover
    const coverEl = document.getElementById('viewProfileCover');
    if (coverEl) {
      coverEl.style.backgroundImage = p.cover_url ? `url(${p.cover_url})` : `linear-gradient(135deg, var(--primary), #0d9488)`;
      coverEl.style.backgroundSize = 'cover';
    }

    // Avatar
    const avatarContainer = document.getElementById('viewProfileAvatarContainer');
    const avatarUrl = p.avatar_url || p.avatar;
    if (avatarUrl && avatarUrl.startsWith('http')) {
      avatarContainer.innerHTML = `<img src="${avatarUrl}" alt="${p.name}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
    } else {
      const initial = (p.display_name || p.name || 'E').charAt(0).toUpperCase();
      avatarContainer.innerHTML = `<span style="font-size:2.5rem; font-weight:900; color:#fff;">${initial}</span>`;
      avatarContainer.style.background = 'var(--gradient-primary)';
      avatarContainer.style.display = 'flex';
      avatarContainer.style.alignItems = 'center';
      avatarContainer.style.justifyContent = 'center';
      avatarContainer.style.borderRadius = '50%';
    }

    // Role badges
    const badgesContainer = document.getElementById('viewProfileBadges');
    let badgesHtml = '';
    if (p.vet_status === 1) {
      badgesHtml += `<span class="profile-badge badge-vet" style="background:var(--primary-light,#10b98115); color:var(--primary); padding:2px 8px; border-radius:8px; font-size:10px; font-weight:800; border:1px solid var(--primary);"><i class="fas fa-user-md"></i> Vet</span>`;
    }
    if (p.role === 'admin') {
      badgesHtml += `<span class="profile-badge badge-admin" style="background:var(--purple); color:#fff; padding:2px 8px; border-radius:8px; font-size:10px; font-weight:800;"><i class="fas fa-shield-alt"></i> Staff</span>`;
    }
    badgesContainer.innerHTML = badgesHtml;

    // Engagement stats
    document.getElementById('viewStatFollowers').textContent = p.followers_count || '0';
    document.getElementById('viewStatFollowing').textContent = p.following_count || '0';
    document.getElementById('viewStatScans').textContent = (metrics && metrics.scans.length) || '0';
    document.getElementById('viewStatTrainings').textContent = (metrics && metrics.programs.length) || '0';

    // Follow button configuration
    const followBtn = document.getElementById('viewProfileFollowBtn');
    if (followBtn) {
      const isOwner = window.currentUser && (p.id === window.currentUser.id);
      if (isOwner) {
        followBtn.style.display = 'none';
      } else {
        followBtn.style.display = 'inline-block';
        if (p.follow_status === 'Approved' || p.is_following) {
          followBtn.textContent = 'Following';
          followBtn.className = 'btn btn-secondary';
        } else if (p.follow_status === 'Pending') {
          followBtn.textContent = 'Requested';
          followBtn.className = 'btn btn-secondary';
        } else {
          followBtn.textContent = 'Follow';
          followBtn.className = 'btn btn-primary';
        }
        followBtn.onclick = () => handleModalFollowToggle(p.id, followBtn);
      }
    }

    // Message button configuration
    const messageBtn = document.getElementById('viewProfileMessageBtn');
    if (messageBtn) {
      const isOwner = window.currentUser && (p.id === window.currentUser.id);
      if (isOwner) {
        messageBtn.style.display = 'none';
      } else {
        messageBtn.style.display = 'inline-block';
        messageBtn.onclick = () => {
          closeViewProfileModal();
          if (window.openDirectMessageModal) {
            window.openDirectMessageModal(p.id, p.display_name || p.name);
          }
        };
      }
    }

    // Privacy security logic
    if (p.is_private_restricted) {
      document.getElementById('viewProfileRestrictedNotice').style.display = 'block';
      document.getElementById('viewProfilePublicContent').style.display = 'none';
      document.getElementById('viewProfilePrivateMessage').textContent = `Follow ${escapeHtml(p.display_name || p.name)} to view their pets vault, progress cards, and achievements.`;
    } else {
      document.getElementById('viewProfileRestrictedNotice').style.display = 'none';
      document.getElementById('viewProfilePublicContent').style.display = 'block';

      // Registered pets vault
      const petsGrid = document.getElementById('viewProfilePetsGrid');
      if (data.pets && data.pets.length) {
        petsGrid.innerHTML = data.pets.map(pet => `
          <div class="card pet-card" style="padding:0; overflow:hidden; border:1px solid var(--border-color); background:var(--bg-card); border-radius:12px;">
            <div style="height:100px; background:#000;">
              <img src="${(pet.images && pet.images[0]) || 'https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?w=600'}" style="width:100%; height:100%; object-fit:cover;" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?w=600'">
            </div>
            <div style="padding:8px; text-align:left;">
              <h4 style="margin:0; font-size:12px; font-weight:800; color:var(--text-primary);">${escapeHtml(pet.name)}</h4>
              <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">${escapeHtml(pet.breed || pet.species)}</div>
            </div>
          </div>
        `).join('');
      } else {
        petsGrid.innerHTML = `<div style="grid-column: 1 / -1; font-size:12px; color:var(--text-muted); text-align:center; padding:10px;">No registered pets.</div>`;
      }

      // Badges
      const achievementsGrid = document.getElementById('viewProfileBadgesGrid');
      if (data.achievements && data.achievements.length) {
        achievementsGrid.innerHTML = data.achievements.map(ach => `
          <span style="background:var(--bg-main); border:1px solid var(--border-color); padding:4px 10px; border-radius:20px; font-size:11.5px; font-weight:700; color:var(--text-primary); display:inline-flex; align-items:center; gap:4px;">
            <span>${ach.icon || '🏆'}</span>
            <span>${escapeHtml(ach.badge_name || ach.title)}</span>
          </span>
        `).join('');
      } else {
        achievementsGrid.innerHTML = `<div style="font-size:12px; color:var(--text-muted); text-align:center; width:100%;">No achievements unlocked.</div>`;
      }
    }

  } catch (err) {
    console.error("Error fetching view profile modal:", err);
    showToast("Failed to fetch user profile.", "error");
    closeViewProfileModal();
  }
}

async function handleModalFollowToggle(targetId, btnEl) {
  if (!window.currentUser) { showToast('Please sign in to follow users.', 'error'); return; }
  const currentUserId = window.currentUser.id;
  const res = await window.EcoSocialDB.toggleFollow(currentUserId, targetId);
  if (!res) return;

  if (res.is_pending) {
    btnEl.textContent = 'Requested';
    btnEl.className = 'btn btn-secondary';
    showToast('Follow request sent!', 'info');
  } else if (res.is_following) {
    btnEl.textContent = 'Following';
    btnEl.className = 'btn btn-secondary';
    showToast('You are now following this profile!', 'success');
  } else {
    btnEl.textContent = 'Follow';
    btnEl.className = 'btn btn-primary';
    showToast('Unfollowed profile.', 'info');
  }

  // Refresh profile details to sync stats counts
  openViewProfileModal(targetId);

  // Sync suggestion users widget
  if (window.loadSuggestedUsers) window.loadSuggestedUsers();
}

function closeViewProfileModal() {
  const modal = document.getElementById('viewProfileModal');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
    modal.classList.add('hidden');
    window.activeViewedProfileId = null;
  }
}

// ── Profile Modals for Editing Info ──
function openEditProfileModal() {
  const modal = document.getElementById('editProfileModal');
  if (!modal || !activeProfileData || !activeProfileData.profile) return;

  const p = activeProfileData.profile;

  document.getElementById('editProfileName').value = p.display_name || p.name || '';
  document.getElementById('editProfileBio').value = p.bio || '';
  document.getElementById('editProfileProfession').value = p.profession || '';
  document.getElementById('editProfileOrganization').value = p.organization || '';
  document.getElementById('editProfileCity').value = p.city || '';
  document.getElementById('editProfileCountry').value = p.country || '';
  document.getElementById('editProfileVetStatus').value = p.vet_status ? '1' : '0';
  document.getElementById('editProfilePrivacy').value = p.privacy_setting || 'Public';
  document.getElementById('editProfileAvatarUrl').value = p.avatar_url || p.avatar || '';
  document.getElementById('editProfileAvatarFile').value = '';

  modal.classList.remove('hidden');
  modal.style.display = 'flex';
  modal.classList.add('active');
}

function closeEditProfileModal() {
  const modal = document.getElementById('editProfileModal');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
}

async function handleEditProfileSubmit(e) {
  e.preventDefault();

  const session = getSession();
  const currentUserId = session ? session.id : null;
  const p = activeProfileData?.profile;

  // Security: block editing other users' profiles
  if (!p || p.id !== currentUserId) {
    showToast('Unauthorized: You cannot edit another user\'s profile.', 'error');
    return;
  }

  const display_name = document.getElementById('editProfileName').value.trim();
  const bio = document.getElementById('editProfileBio').value.trim();
  const profession = document.getElementById('editProfileProfession').value.trim();
  const organization = document.getElementById('editProfileOrganization').value.trim();
  const city = document.getElementById('editProfileCity').value.trim();
  const country = document.getElementById('editProfileCountry').value.trim();
  const vet_status = parseInt(document.getElementById('editProfileVetStatus').value) || 0;
  const privacy_setting = document.getElementById('editProfilePrivacy').value;
  const avatarUrlInput = document.getElementById('editProfileAvatarUrl').value.trim();

  // Validation: Display name is required
  if (!display_name) {
    showToast('Display Name is required.', 'error');
    return;
  }

  const saveBtn = document.getElementById('editProfileSaveBtn');
  let originalHtml = '';
  if (saveBtn) {
    originalHtml = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Saving...`;
  }

  try {
    let avatar_url = avatarUrlInput;

    // Handle file uploads if present
    const fileInput = document.getElementById('editProfileAvatarFile');
    if (fileInput && fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      const reader = new FileReader();

      const dataUrlPromise = new Promise((resolve) => {
        reader.onload = (event) => resolve(event.target.result);
        reader.readAsDataURL(file);
      });

      const base64Data = await dataUrlPromise;
      const uploadedUrl = await window.EcoSocialDB.uploadAvatar(base64Data);
      if (uploadedUrl) {
        avatar_url = uploadedUrl;
      }
    }

    const result = await window.EcoSocialDB.updateProfile({
      display_name,
      bio,
      profession,
      organization,
      city,
      country,
      vet_status,
      privacy_setting,
      avatar_url
    });

    if (result) {
      showToast('Profile updated successfully!', 'success');
      closeEditProfileModal();

      // Refresh authenticated session UI
      const freshUser = await window.EcoSocialDB.refreshMySession();
      if (freshUser) {
        syncUserInterface(freshUser);
      }

      // Reload active dashboard
      if (window.currentUser) {
        loadProfileTab(window.currentUser.id);
      }
    } else {
      showToast('Failed to update profile.', 'error');
    }
  } catch (err) {
    console.error('Edit Profile submit error:', err);
    showToast('An error occurred while saving your profile.', 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalHtml;
    }
  }
}

// ── UTILITIES ──
function setElText(id, txt) { const el = document.getElementById(id); if (el) el.textContent = txt !== undefined ? txt : ''; }
function escapeHtml(str) { return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function isSelfProfile(id) { const s = getSession(); return s && s.id === id; }

// ── SETTINGS MODAL HANDLERS ──
function openSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (!modal || !activeProfileData || !activeProfileData.profile) return;
  
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
  modal.classList.add('active');
  
  switchSettingsTab('account');
}

function closeSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
    modal.classList.add('hidden');
  }
}

function switchSettingsTab(tabName) {
  const accountBtn = document.getElementById('settingsAccountTabBtn');
  const prefBtn = document.getElementById('settingsPrefTabBtn');
  const container = document.getElementById('settingsModalBody');
  if (!container || !activeProfileData) return;
  
  const p = activeProfileData.profile;
  
  if (tabName === 'account') {
    accountBtn.classList.add('active');
    accountBtn.style.color = 'var(--primary)';
    accountBtn.style.borderBottom = '3px solid var(--primary)';
    
    prefBtn.classList.remove('active');
    prefBtn.style.color = 'var(--text-muted)';
    prefBtn.style.borderBottom = '3px solid transparent';
    
    renderAccountInfo(p, container);
  } else {
    prefBtn.classList.add('active');
    prefBtn.style.color = 'var(--primary)';
    prefBtn.style.borderBottom = '3px solid var(--primary)';
    
    accountBtn.classList.remove('active');
    accountBtn.style.color = 'var(--text-muted)';
    accountBtn.style.borderBottom = '3px solid transparent';
    
    renderSettings(p, container);
  }
}

// Globalize functions
window.loadProfileTab = loadProfileTab;
window.switchProfileTabSection = switchProfileTabSection;
window.openEditProfileModal = openEditProfileModal;
window.closeEditProfileModal = closeEditProfileModal;
window.handleEditProfileSubmit = handleEditProfileSubmit;
window.openViewProfileModal = openViewProfileModal;
window.closeViewProfileModal = closeViewProfileModal;
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.switchSettingsTab = switchSettingsTab;
window.viewFullReport = (id) => { window.location.href = `aiscanner.html?reportId=${id}`; };
