/**
 * EcoTrack Redesigned Profile Engine v2.0
 * Fully rewritten for absolute detail accuracy and high-fidelity UI.
 */

let activeProfileTabSection = 'pets';
let activeProfileData = null;

// ── Auth header helper ──
function getAuthHeaders() {
  try {
    const raw = localStorage.getItem('@ecotrack_web_session');
    if (raw) {
      const sess = JSON.parse(raw);
      if (sess && sess.token) return { 'Authorization': `Bearer ${sess.token}`, 'Content-Type': 'application/json' };
    }
  } catch (e) {}
  return { 'Content-Type': 'application/json' };
}

function isSelfProfile(id) {
  return window.currentUser && window.currentUser.id === id;
}

// ── Main Load Function ──
async function loadProfileTab(userOrEcoId) {
  const currentUserId = window.currentUser ? window.currentUser.id : null;
  const targetId = userOrEcoId || currentUserId;

  if (!targetId) {
    if (window.showToast) window.showToast('Please sign in to view your welfare profile', 'info');
    return;
  }

  const contentArea = document.getElementById('profileTabContentArea');
  if (contentArea) contentArea.innerHTML = `<div class="profile-loader"><i class="fas fa-dna fa-spin"></i><span>Analyzing Welfare Data...</span></div>`;

  try {
    // 1. Fetch Core Profile & Integrated Stats
    let data;
    if (targetId === currentUserId) {
      data = await window.EcoSocialDB.fetchMyProfile();
    } else {
      data = await window.EcoSocialDB.fetchProfile(targetId);
    }

    if (!data || !data.profile) throw new Error("Welfare link unavailable");

    // 2. Fetch Supplemental Live Metrics
    const metrics = await getSupplementalMetrics(targetId);

    activeProfileData = { ...data, metrics };

    renderRedesignedProfile(data.profile, data.impactStats, metrics, targetId);
    switchProfileTabSection(activeProfileTabSection);

  } catch (err) {
    console.error("[Profile/Redesign] Failed:", err);
    if (contentArea) contentArea.innerHTML = `<div class="card error-state"><h3>Welfare Data Sync Failed</h3><p>${err.message}</p></div>`;
  }
}

async function getSupplementalMetrics(userId) {
  const headers = getAuthHeaders();
  const base = 'http://localhost:5000/api';
  try {
    const [scans, progs] = await Promise.all([
      fetch(`${base}/ai/scan-history?user_id=${userId}`, { headers }).then(r => r.ok ? r.json() : []),
      fetch(`${base}/training/programs/${userId}`, { headers }).then(r => r.ok ? r.json() : [])
    ]);
    return { scans, programs: progs };
  } catch {
    return { scans: [], programs: [] };
  }
}

function renderRedesignedProfile(p, impact, metrics, targetId) {
  const isOwner = isSelfProfile(p.id);
  const actionsEl = document.getElementById('profileHeroActions');

  console.log("[Profile/Render] Data:", { p, impact, metrics, isOwner });

  // Avatar Logic
  const avatarEl = document.getElementById('profileAvatarDisplay');
  if (avatarEl) {
    const avatarUrl = p.avatar_url || (isOwner && window.currentUser && window.currentUser.avatar ? window.currentUser.avatar : null);
    if (avatarUrl && avatarUrl.startsWith('http')) {
      avatarEl.innerHTML = `<img src="${avatarUrl}" alt="${p.name}" onerror="this.remove(); document.getElementById('profileAvatarInitial').style.display='flex';">`;
    } else {
      const nameForInit = p.display_name || p.name || (window.currentUser ? window.currentUser.name : 'E');
      const initial = nameForInit.charAt(0).toUpperCase();
      avatarEl.innerHTML = `<span id="profileAvatarInitial" style="display:flex;">${initial}</span>`;
      avatarEl.style.background = 'var(--primary)';
    }
  }

  // Identity & Meta
  setElText('profileHeroName', p.display_name || p.name || 'Eco Explorer');
  setElText('profileHeroBio', p.bio || (isOwner ? 'Add a bio to share your journey...' : 'Welfare enthusiast.'));

  const city = p.city || '';
  const country = p.country || '';
  const locText = (city && country) ? `${city}, ${country}` : (city || country || (isOwner ? 'Update Location' : 'Global'));
  setElText('profileHeroLoc', locText);
  setElText('profileHeroJoined', p.created_at ? `Member since ${new Date(p.created_at).getFullYear()}` : 'New Explorer');

  // Badges Row
  const badgesRow = document.getElementById('profileHeroBadges');
  if (badgesRow) {
    let badgesHtml = '';
    if (p.vet_status === 1) badgesHtml += `<span class="profile-badge badge-vet"><i class="fas fa-user-doctor"></i> Vet</span>`;
    if (p.role === 'admin') badgesHtml += `<span class="profile-badge badge-admin"><i class="fas fa-shield-halved"></i> Admin</span>`;
    badgesRow.innerHTML = badgesHtml;
  }

  // Glass Stats
  setElText('profileFollowersCount', p.followers_count || 0);
  setElText('profileFollowingCount', p.following_count || 0);
  setElText('statRescuesCount', (impact && impact.rescues) || 0);
  setElText('statScansCount', (metrics && metrics.scans.length) || (impact && impact.scannerAnalyses) || 0);

  // Mini Impact Card
  setElText('statCo2Saved', impact.co2Saved || '0 kg');
  setElText('statTreesPlanted', impact.treesPlanted || '0');

  // Actions
  if (actionsEl) {
    if (isOwner) {
      actionsEl.innerHTML = `
        <button class="btn btn-primary" onclick="openEditProfileModal()"><i class="fas fa-pen"></i> Edit Profile</button>
        <button class="btn btn-secondary" onclick="openAddPetModal()"><i class="fas fa-plus-circle"></i> Add Pet</button>
      `;
    } else {
      const fIcon = p.is_following ? 'fa-check' : 'fa-user-plus';
      actionsEl.innerHTML = `
        <button class="btn ${p.is_following ? 'btn-secondary' : 'btn-primary'}" onclick="toggleFollowUser('${p.id}', this)">
          <i class="fas ${fIcon}"></i> ${p.is_following ? 'Following' : 'Follow'}
        </button>
        <button class="btn btn-secondary" onclick="openDirectMessageModal('${p.id}', '${escapeHtml(p.display_name || p.name)}')"><i class="fas fa-comment"></i> Message</button>
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
  const isOwner = isSelfProfile(data.profile.id);

  if (section === 'pets') {
    renderPetsGrid(data.pets || [], container, isOwner);
  } else if (section === 'scans') {
    renderScansList(data.metrics.scans || [], container);
  } else if (section === 'posts') {
    container.innerHTML = `<div class="tab-loader"><i class="fas fa-spinner fa-spin"></i><span>Fetching Activity...</span></div>`;
    const posts = await window.EcoSocialDB.fetchPosts({ user_id: data.profile.id });
    renderPostsGrid(posts || [], container);
  } else if (section === 'training') {
    renderTrainingGrid(data.metrics.programs || [], container);
  } else if (section === 'achievements') {
    renderAchievementsList(data.achievements || [], container);
  }
}

function renderPetsGrid(pets, container, isOwner) {
  if (!pets.length) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-paw fa-3x"></i>
        <h4>No Registered Pets</h4>
        <p>Start your pet's digital health record today.</p>
        ${isOwner ? `<button class="btn btn-primary" onclick="openAddPetModal()">Register Pet</button>` : ''}
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="welfare-grid">
      ${pets.map(pet => `
        <div class="welfare-card pet-v2">
          <div class="card-media">
            <img src="${(pet.images && pet.images[0]) || 'https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?w=600'}" alt="${pet.name}">
            <div class="media-tag">${pet.breed || pet.species}</div>
          </div>
          <div class="card-body">
            <div class="card-header-row">
              <h3>${escapeHtml(pet.name)}</h3>
              <span class="age-tag">${pet.age || 'N/A'}</span>
            </div>
            <div class="pet-vitals">
              <span><i class="fas fa-weight-hanging"></i> ${pet.weight || 'N/A'}</span>
              <span><i class="fas fa-bone"></i> ${pet.diet || 'Standard Diet'}</span>
            </div>
            <button class="btn btn-secondary btn-block" onclick="openPetDetailsModal(${pet.id})">Medical Records</button>
          </div>
        </div>
      `).join('')}
    </div>`;
}

function renderScansList(scans, container) {
  if (!scans.length) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-microscope fa-3x"></i><h4>No AI Scans Found</h4><p>Use the AI Scanner to analyze animal posture and health.</p></div>`;
    return;
  }

  container.innerHTML = `
    <div class="welfare-list">
      ${scans.map(s => `
        <div class="welfare-card-horizontal">
          <div class="scan-score-badge ${s.grade || 'C'}">${s.grade || 'C'}</div>
          <div class="scan-details">
            <div class="scan-title">${s.detectedSpecies || 'Animal'} Analysis</div>
            <div class="scan-meta">${new Date(s.timestamp).toLocaleDateString()} • ${s.exerciseName || 'Free Scan'}</div>
            <div class="scan-metrics-row">
              <span>Form: <b>${s.formScore}%</b></span>
              <span>Posture: <b>${s.postureScore}%</b></span>
            </div>
          </div>
          <button class="btn-icon" onclick="viewFullReport('${s.scanId}')"><i class="fas fa-chevron-right"></i></button>
        </div>
      `).join('')}
    </div>`;
}

function renderPostsGrid(posts, container) {
  if (!posts.length) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-rss fa-3x"></i><h4>No Recent Activity</h4><p>Updates from the welfare network will appear here.</p></div>`;
    return;
  }
  container.innerHTML = `<div class="welfare-grid">${posts.map(p => window.renderPostCardHtml(p)).join('')}</div>`;
}

function renderTrainingGrid(progs, container) {
  if (!progs.length) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-bolt-lightning fa-3x"></i><h4>No Training Logs</h4><p>Start a training program in the AI Trainer tab.</p></div>`;
    return;
  }
  container.innerHTML = `
    <div class="welfare-grid">
      ${progs.map(p => `
        <div class="welfare-card training-log">
          <div class="log-header">
            <i class="fas fa-dumbbell"></i>
            <div>
              <div class="log-title">${p.title || p.species + ' Training'}</div>
              <div class="log-date">${new Date(p.started_at).toLocaleDateString()}</div>
            </div>
          </div>
          <div class="log-progress">
             <div class="progress-bar-v2"><div style="width:${p.progress || 0}%"></div></div>
             <span>${p.progress || 0}% Mastery</span>
          </div>
        </div>
      `).join('')}
    </div>`;
}

function renderAchievementsList(ach, container) {
  if (!ach.length) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-award fa-3x"></i><h4>No Achievements Yet</h4><p>Rescue animals and save CO2 to earn professional badges.</p></div>`;
    return;
  }
  container.innerHTML = `
    <div class="achievements-wrap">
      ${ach.map(a => `
        <div class="achievement-card-v2">
          <div class="ach-icon">${a.icon || '🏆'}</div>
          <div class="ach-info">
            <div class="ach-name">${escapeHtml(a.badge_name)}</div>
            <div class="ach-desc">${escapeHtml(a.description)}</div>
          </div>
        </div>
      `).join('')}
    </div>`;
}

// ══════════════════════════════════════════
// FUNCTIONALITY & MODALS
// ══════════════════════════════════════════

function openEditProfileModal() {
  const modal = document.getElementById('editProfileModal');
  if (!modal) return;
  const p = (activeProfileData && activeProfileData.profile) ? activeProfileData.profile : {};

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  set('editProfileName', p.display_name || p.name || '');
  set('editProfileBio', p.bio || '');
  set('editProfileCity', p.city || '');
  set('editProfileCountry', p.country || '');
  set('editProfileProfession', p.profession || '');
  set('editProfileOrganization', p.organization || '');

  const preview = document.getElementById('editAvatarPreview');
  if (preview && p.avatar_url) { preview.src = p.avatar_url; preview.style.display = 'block'; }

  modal.classList.remove('hidden');
  modal.style.display = 'flex';
}

function closeEditProfileModal() {
  const modal = document.getElementById('editProfileModal');
  if (modal) { modal.classList.add('hidden'); modal.style.display = 'none'; }
}

async function handleEditProfileSubmit(e) {
  e.preventDefault();
  const saveBtn = document.getElementById('editProfileSaveBtn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...'; }

  const body = {
    display_name: document.getElementById('editProfileName')?.value.trim(),
    bio: document.getElementById('editProfileBio')?.value.trim(),
    city: document.getElementById('editProfileCity')?.value.trim(),
    country: document.getElementById('editProfileCountry')?.value.trim(),
    profession: document.getElementById('editProfileProfession')?.value.trim(),
    organization: document.getElementById('editProfileOrganization')?.value.trim(),
    vet_status: parseInt(document.getElementById('editProfileVetStatus')?.value || '0'),
    privacy_setting: document.getElementById('editProfilePrivacy')?.value || 'Public'
  };

  try {
    const res = await window.EcoSocialDB.updateProfile(body);
    if (res) {
      if (window.showToast) window.showToast('Profile Verified & Updated', 'success');
      // Update session cache
      const sess = JSON.parse(localStorage.getItem('@ecotrack_web_session') || '{}');
      sess.name = body.display_name;
      localStorage.setItem('@ecotrack_web_session', JSON.stringify(sess));
      window.currentUser = sess; // Sync memory state
      if (window.updateSidebarUser) window.updateSidebarUser();

      closeEditProfileModal();
      await loadProfileTab();
    }
  } catch (err) {
    if (window.showToast) window.showToast('Update failed: ' + err.message, 'error');
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes'; }
  }
}

function openAddPetModal() {
  const modal = document.getElementById('addPetModal');
  if (modal) modal.classList.add('active');
}

function closeAddPetModal() {
  const modal = document.getElementById('addPetModal');
  if (modal) modal.classList.remove('active');
}

async function toggleFollowUser(targetId, btn) {
  const res = await window.EcoSocialDB.toggleFollow(null, targetId);
  if (res) loadProfileTab(targetId);
}

function openDirectMessageModal(id, name) {
  if (window.openChatModal) window.openChatModal(id, name);
}

async function openViewProfileModal(userIdOrEcoId) {
  const modal = document.getElementById('viewProfileModal');
  if (!modal) return;

  modal.classList.remove('hidden');
  modal.style.display = 'flex';

  try {
    const data = await window.EcoSocialDB.fetchProfile(userIdOrEcoId);
    if (!data || !data.profile) {
      throw new Error("Unable to fetch user profile details.");
    }
    const p = data.profile;
    const impact = data.impactStats || {};
    const pets = data.pets || [];
    const achievements = data.achievements || [];

    // Populate data
    document.getElementById('viewProfileName').textContent = p.display_name || p.name || 'Eco Explorer';
    document.getElementById('viewProfileEcoId').textContent = `@${p.ecotrack_id || p.id}`;
    document.getElementById('viewProfileBio').textContent = p.bio || 'Welfare enthusiast.';
    
    const city = p.city || '';
    const country = p.country || '';
    const locText = (city && country) ? `${city}, ${country}` : (city || country || 'Global');
    document.getElementById('viewProfileLoc').innerHTML = `<i class="fas fa-map-marker-alt"></i> ${locText}`;
    document.getElementById('viewProfileJoined').innerHTML = `<i class="fas fa-calendar-alt"></i> Joined ${p.created_at ? new Date(p.created_at).getFullYear() : 'New'}`;

    // Stats
    document.getElementById('viewStatRescues').textContent = impact.rescues || 0;
    document.getElementById('viewStatTrainings').textContent = (data.metrics && data.metrics.programs && data.metrics.programs.length) || impact.programs || 0;
    document.getElementById('viewStatConnections').textContent = p.followers_count || 0;

    // Avatar
    const avatarContainer = document.getElementById('viewProfileAvatarContainer');
    if (avatarContainer) {
      if (p.avatar_url && p.avatar_url.startsWith('http')) {
        avatarContainer.innerHTML = `<img src="${p.avatar_url}" alt="${p.name}" style="width:100%; height:100%; object-fit:cover;">`;
      } else {
        const initial = (p.display_name || p.name || 'E').charAt(0).toUpperCase();
        avatarContainer.innerHTML = `<span style="font-size:48px; font-weight:800; color:#fff;">${initial}</span>`;
        avatarContainer.style.background = 'var(--primary)';
        avatarContainer.style.display = 'flex';
        avatarContainer.style.alignItems = 'center';
        avatarContainer.style.justifyContent = 'center';
      }
    }

    // Follow Button
    const followBtn = document.getElementById('viewProfileFollowBtn');
    if (followBtn) {
      const fIcon = p.is_following ? 'fa-check' : 'fa-user-plus';
      followBtn.className = p.is_following ? 'btn btn-secondary' : 'btn btn-primary';
      followBtn.innerHTML = `<i class="fas ${fIcon}"></i> ${p.is_following ? 'Following' : 'Follow'}`;
      followBtn.onclick = async () => {
        const res = await window.EcoSocialDB.toggleFollow(null, p.id);
        if (res) {
          openViewProfileModal(userIdOrEcoId); // refresh
          if (window.loadCommunityPosts) window.loadCommunityPosts(); // refresh community
        }
      };
    }

    // Message Button
    const msgBtn = document.getElementById('viewProfileMessageBtn');
    if (msgBtn) {
      msgBtn.onclick = () => {
        closeViewProfileModal();
        if (window.openChatModal) window.openChatModal(p.id, p.display_name || p.name);
      };
    }

    // Privacy setting check
    const isPrivate = p.privacy_setting === 'Private' && !p.is_following;
    const restrictedNotice = document.getElementById('viewProfileRestrictedNotice');
    const publicContent = document.getElementById('viewProfilePublicContent');

    if (isPrivate) {
      if (restrictedNotice) restrictedNotice.style.display = 'block';
      if (publicContent) publicContent.style.display = 'none';
    } else {
      if (restrictedNotice) restrictedNotice.style.display = 'none';
      if (publicContent) publicContent.style.display = 'block';

      // Populate Pets
      const petsGrid = document.getElementById('viewProfilePetsGrid');
      if (petsGrid) {
        if (!pets.length) {
          petsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); font-size: 13px; padding: 20px;">No registered pets.</div>`;
        } else {
          petsGrid.innerHTML = pets.map(pet => `
            <div class="welfare-card pet-v2" style="margin: 0;">
              <div class="card-media" style="height: 120px;">
                <img src="${(pet.images && pet.images[0]) || 'https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?w=600'}" alt="${pet.name}" style="width:100%; height:100%; object-fit:cover;">
                <div class="media-tag" style="font-size: 9px; padding: 2px 6px;">${pet.breed || pet.species}</div>
              </div>
              <div class="card-body" style="padding: 10px;">
                <h4 style="margin: 0 0 4px; font-size: 13px; font-weight: 800;">${escapeHtml(pet.name)}</h4>
                <div style="font-size: 11px; color: var(--text-muted);">${pet.age || '?'} yrs • ${pet.gender || 'Unknown'}</div>
              </div>
            </div>
          `).join('');
        }
      }

      // Populate Achievements/Badges
      const badgesGrid = document.getElementById('viewProfileBadgesGrid');
      if (badgesGrid) {
        if (!achievements.length) {
          badgesGrid.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 13px; width: 100%;">No conservation badges earned yet.</div>`;
        } else {
          badgesGrid.innerHTML = achievements.map(ach => `
            <span class="profile-badge badge-admin" style="font-size: 11px; padding: 6px 12px; border-radius: 12px; background: rgba(234,179,8,0.1); border-color: rgba(234,179,8,0.3); color: #eab308;">
              <i class="fas fa-trophy"></i> ${escapeHtml(ach.title || ach.name)}
            </span>
          `).join('');
        }
      }
    }

  } catch (err) {
    console.error(err);
    closeViewProfileModal();
    if (window.showToast) window.showToast('Failed to load profile: ' + err.message, 'error');
  }
}

function closeViewProfileModal() {
  const modal = document.getElementById('viewProfileModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
}

// ── UTILITIES ──
function setElText(id, txt) { const el = document.getElementById(id); if (el) el.textContent = txt !== undefined ? txt : ''; }
function escapeHtml(str) { return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

window.loadProfileTab = loadProfileTab;
window.switchProfileTabSection = switchProfileTabSection;
window.openEditProfileModal = openEditProfileModal;
window.closeEditProfileModal = closeEditProfileModal;
window.handleEditProfileSubmit = handleEditProfileSubmit;
window.toggleFollowUser = toggleFollowUser;
window.openViewProfileModal = openViewProfileModal;
window.closeViewProfileModal = closeViewProfileModal;

