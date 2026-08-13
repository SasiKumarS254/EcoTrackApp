/**
 * EcoTrack Redesigned Profile Engine v3.1
 * Functional Account Dashboard with Real-Time Data Sync
 */

let activeProfileTabSection = 'pets';
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
  document.querySelectorAll('.side-nav-btn').forEach(b => b.classList.remove('active'));
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
  }
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
  try {
    const [followers, following] = await Promise.all([
      window.EcoSocialDB.fetchFollowers(p.id),
      window.EcoSocialDB.fetchFollowing(p.id)
    ]);
    container.innerHTML = `
      <div class="card" style="border-radius:16px; background:var(--bg-card);">
        <div class="card-title" style="margin-bottom:2rem; font-weight:800; color:var(--text-primary);"><i class="fas fa-users" style="color:var(--primary);"></i> Network Graph</div>

        <h4 style="font-size:0.75rem; font-weight:900; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted); margin-bottom:1rem; text-align:left;">Following (${following.length})</h4>
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:1rem; margin-bottom:2.5rem;">
          ${following.length ? following.map(u => `
            <div class="sidebar-user suggested-user-row" style="margin:0; padding:10px; border-radius:12px;" onclick="viewUserProfile('${u.id}')">
              <div class="sidebar-avatar" style="width:40px; height:40px;"><img src="${u.avatar_url || 'https://ui-avatars.com/api/?name='+encodeURIComponent(u.name)}" style="border-radius:50%; width:100%; height:100%; object-fit:cover;"></div>
              <div style="overflow:hidden; text-align:left;">
                <div class="sidebar-user-name" style="font-size:13px; font-weight:800; color:var(--text-primary);">${escapeHtml(u.display_name || u.name)}</div>
                <div class="sidebar-user-email" style="font-size:10px; color:var(--text-muted);">@${u.ecotrack_id || 'member'}</div>
              </div>
            </div>
          `).join('') : '<p style="font-size:0.85rem; color:var(--text-muted); text-align:left;">Not following any members yet.</p>'}
        </div>

        <h4 style="font-size:0.75rem; font-weight:900; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted); margin-bottom:1rem; text-align:left;">Followers (${followers.length})</h4>
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:1rem;">
          ${followers.length ? followers.map(u => `
            <div class="sidebar-user suggested-user-row" style="margin:0; padding:10px; border-radius:12px;" onclick="viewUserProfile('${u.id}')">
              <div class="sidebar-avatar" style="width:40px; height:40px;"><img src="${u.avatar_url || 'https://ui-avatars.com/api/?name='+encodeURIComponent(u.name)}" style="border-radius:50%; width:100%; height:100%; object-fit:cover;"></div>
              <div style="overflow:hidden; text-align:left;">
                <div class="sidebar-user-name" style="font-size:13px; font-weight:800; color:var(--text-primary);">${escapeHtml(u.display_name || u.name)}</div>
                <div class="sidebar-user-email" style="font-size:10px; color:var(--text-muted);">@${u.ecotrack_id || 'member'}</div>
              </div>
            </div>
          `).join('') : '<p style="font-size:0.85rem; color:var(--text-muted); text-align:left;">No followers yet.</p>'}
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
  if (!ach.length) {
    container.innerHTML = `<div class="empty-state" style="text-align:center; padding:4rem 2rem; color:var(--text-muted);"><i class="fas fa-award fa-3x" style="margin-bottom:1rem; opacity:0.3;"></i><h4>No Achievements Yet</h4><p>Unlock professional badges by participating in rescues and scans.</p></div>`;
    return;
  }
  container.innerHTML = `
    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:1.5rem;">
      ${ach.map(a => `
        <div class="card" style="display:flex; align-items:center; gap:1rem; padding:1.25rem; background:var(--bg-card); border:1px solid var(--border-color); border-radius:16px; text-align:left;">
          <div style="font-size:2.5rem;">${a.icon || '🏆'}</div>
          <div>
            <div style="font-weight:900; color:var(--text-primary);">${escapeHtml(a.badge_name || a.title)}</div>
            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">${escapeHtml(a.description)}</div>
          </div>
        </div>
      `).join('')}
    </div>`;
}

function renderTrainingGrid(progs, container) {
  if (!progs.length) {
    container.innerHTML = `<div class="empty-state" style="text-align:center; padding:4rem 2rem; color:var(--text-muted);"><i class="fas fa-bolt-lightning fa-3x" style="margin-bottom:1rem; opacity:0.3;"></i><h4>No Training Logs</h4><p>Start a training program in the Species AI Trainer tab.</p></div>`;
    return;
  }
  container.innerHTML = `
    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:1.5rem;">
      ${progs.map(p => `
        <div class="card" style="padding:1.5rem; background:var(--bg-card); border:1px solid var(--border-color); border-radius:16px; text-align:left;">
          <div style="display:flex; align-items:center; gap:1rem; margin-bottom:1.25rem;">
            <div style="width:40px; height:40px; border-radius:50%; background:var(--primary-light,#10b98115); color:var(--primary); display:flex; align-items:center; justify-content:center;">
              <i class="fas fa-dumbbell"></i>
            </div>
            <div>
              <div style="font-weight:900; font-size:1rem; color:var(--text-primary);">${escapeHtml(p.title || p.species + ' Program')}</div>
              <div style="font-size:0.7rem; color:var(--text-muted);">${new Date(p.started_at).toLocaleDateString()}</div>
            </div>
          </div>
          <div style="margin-bottom:0.5rem; display:flex; justify-content:space-between; font-size:0.75rem; font-weight:800;">
            <span style="color:var(--text-secondary);">Current Progress</span>
            <span style="color:var(--primary);">${p.progress || 0}%</span>
          </div>
          <div style="height:8px; background:var(--bg-main); border-radius:4px; overflow:hidden; border:1px solid var(--border-color);">
            <div style="width:${p.progress || 0}%; height:100%; background:var(--gradient-primary); transition:width 0.5s ease;"></div>
          </div>
        </div>
      `).join('')}
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
  document.getElementById('viewStatRescues').textContent = "0";
  document.getElementById('viewStatTrainings').textContent = "0";
  document.getElementById('viewStatConnections').textContent = "0";
  document.getElementById('viewProfileRestrictedNotice').style.display = 'none';
  document.getElementById('viewProfilePublicContent').style.display = 'none';

  modal.classList.remove('hidden');
  modal.style.display = 'flex';

  try {
    const data = await window.EcoSocialDB.fetchProfile(userIdOrEcoId);
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
    document.getElementById('viewStatRescues').textContent = data.impactStats?.rescues || '0';
    document.getElementById('viewStatTrainings').textContent = data.impactStats?.trainingsCompleted || '0';
    document.getElementById('viewStatConnections').textContent = p.followers_count || '0';

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

  const display_name = document.getElementById('editProfileName').value.trim();
  const bio = document.getElementById('editProfileBio').value.trim();
  const profession = document.getElementById('editProfileProfession').value.trim();
  const organization = document.getElementById('editProfileOrganization').value.trim();
  const city = document.getElementById('editProfileCity').value.trim();
  const country = document.getElementById('editProfileCountry').value.trim();
  const vet_status = parseInt(document.getElementById('editProfileVetStatus').value) || 0;
  const privacy_setting = document.getElementById('editProfilePrivacy').value;
  const avatarUrlInput = document.getElementById('editProfileAvatarUrl').value.trim();

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
}

// ── UTILITIES ──
function setElText(id, txt) { const el = document.getElementById(id); if (el) el.textContent = txt !== undefined ? txt : ''; }
function escapeHtml(str) { return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function isSelfProfile(id) { const s = getSession(); return s && s.id === id; }

// Globalize functions
window.loadProfileTab = loadProfileTab;
window.switchProfileTabSection = switchProfileTabSection;
window.openEditProfileModal = openEditProfileModal;
window.closeEditProfileModal = closeEditProfileModal;
window.handleEditProfileSubmit = handleEditProfileSubmit;
window.openDirectMessageModal = openDirectMessageModal;
window.openViewProfileModal = openViewProfileModal;
window.closeViewProfileModal = closeViewProfileModal;
window.viewFullReport = (id) => { window.location.href = `aiscanner.html?reportId=${id}`; };
