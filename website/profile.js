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

  // Always start on Scan History tab for a fresh load
  activeProfileTabSection = 'scans';

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
    const [scansRes, progsRes] = await Promise.all([
      fetch(`${base}/ai/scan-history?user_id=${userId}`, { headers }),
      fetch(`${base}/training/programs/${userId}`, { headers })
    ]);

    let scans = [];
    let progs = [];

    if (scansRes.ok) {
      const d = await scansRes.json();
      if (Array.isArray(d)) {
        scans = d;
      } else if (d && Array.isArray(d.scans)) {
        scans = d.scans;
      } else if (d && Array.isArray(d.data)) {
        scans = d.data;
      }
    } else {
      console.warn('[Profile] Scan history fetch failed:', scansRes.status);
    }

    if (progsRes.ok) {
      const d = await progsRes.json();
      if (Array.isArray(d)) {
        progs = d;
      } else if (d && Array.isArray(d.programs)) {
        progs = d.programs;
      }
    } else {
      console.warn('[Profile] Training programs fetch failed:', progsRes.status);
    }

    // Merge with localStorage caches so newly saved scans & programs appear immediately!
    try {
      const userScans = JSON.parse(localStorage.getItem(`@ecotrack_scans_${userId}`) || '[]');
      const generalScans = JSON.parse(localStorage.getItem('@ecotrack_saved_scans') || '[]');
      const seenScanIds = new Set(scans.map(s => String(s.scanId || s.id)));
      for (const ls of [...userScans, ...generalScans]) {
        const sid = String(ls.scanId || ls.id || '');
        if (sid && !seenScanIds.has(sid)) {
          seenScanIds.add(sid);
          scans.unshift(ls);
        }
      }
    } catch (e) {}

    try {
      const userPlans = JSON.parse(localStorage.getItem(`@ecotrack_training_plans_${userId}`) || '[]');
      const seenPlanIds = new Set(progs.map(p => String(p.id)));
      for (const lp of userPlans) {
        if (lp.id && !seenPlanIds.has(String(lp.id))) {
          seenPlanIds.add(String(lp.id));
          progs.unshift(lp);
        }
      }
    } catch (e) {}

    return { scans, programs: progs };
  } catch (e) {
    console.warn('[Profile] Supplemental metrics error:', e.message);
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
  const profEl = document.getElementById('profileHeroProfession');
  if (profEl) {
    profEl.textContent = p.profession || ((p.role === 'admin' || p.role === 'staff') ? 'EcoTrack Staff Specialist' : 'EcoTrack Community Member');
  }

  const badgesRow = document.getElementById('profileHeroBadges');
  if (badgesRow) {
    let badgesHtml = '';
    if (p.vet_status === 1) badgesHtml += `<span class="profile-badge badge-vet" style="background:var(--primary-light,#10b98115); color:var(--primary); padding:4px 10px; border-radius:10px; font-size:11px; font-weight:800; border:1px solid var(--primary);"><i class="fas fa-user-md"></i> Certified Vet</span>`;
    else if (p.vet_status === 2) badgesHtml += `<span class="profile-badge badge-rescue" style="background:rgba(245,158,11,0.15); color:#f59e0b; padding:4px 10px; border-radius:10px; font-size:11px; font-weight:800; border:1px solid #f59e0b;"><i class="fas fa-ambulance"></i> Rescue Volunteer</span>`;
    else if (p.vet_status === 3) badgesHtml += `<span class="profile-badge badge-shelter" style="background:rgba(59,130,246,0.15); color:#3b82f6; padding:4px 10px; border-radius:10px; font-size:11px; font-weight:800; border:1px solid #3b82f6;"><i class="fas fa-paw"></i> Shelter Manager</span>`;
    else if (p.vet_status === 4) badgesHtml += `<span class="profile-badge badge-trainer" style="background:rgba(168,85,247,0.15); color:#a855f7; padding:4px 10px; border-radius:10px; font-size:11px; font-weight:800; border:1px solid #a855f7;"><i class="fas fa-dog"></i> Certified Trainer</span>`;
    else if (p.vet_status === 5) badgesHtml += `<span class="profile-badge badge-ranger" style="background:rgba(239,68,68,0.15); color:#ef4444; padding:4px 10px; border-radius:10px; font-size:11px; font-weight:800; border:1px solid #ef4444;"><i class="fas fa-shield-virus"></i> Ranger</span>`;
    
    if (p.role === 'admin' || p.role === 'staff') badgesHtml += `<span class="profile-badge badge-admin" style="background:var(--purple,#8b5cf6); color:#fff; padding:4px 10px; border-radius:10px; font-size:11px; font-weight:800; margin-left:8px;"><i class="fas fa-shield-alt"></i> Staff</span>`;
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
  if (btn) {
    btn.classList.add('active');
  } else {
    // Find the button whose onclick contains this section name
    const allBtns = document.querySelectorAll('.profile-tab-btn');
    for (const b of allBtns) {
      const oc = b.getAttribute('onclick') || '';
      if (oc.includes(`'${section}'`) || oc.includes(`"${section}"`)) {
        b.classList.add('active');
        break;
      }
    }
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
      let events = [];
      
      if (isOwner) {
        // Single source of truth for current logged-in user: localTicketsData / window.userEventTickets
        const localReg = localStorage.getItem(`@ecotrack_events_registered_${p.id}`);
        const localRegIds = localReg ? JSON.parse(localReg) : (window.registeredEventIds || []);
        const localTickets = localStorage.getItem(`@ecotrack_events_tickets_${p.id}`);
        const localTicketsData = localTickets ? JSON.parse(localTickets) : (window.userEventTickets || []);
        
        const savedEvents = localStorage.getItem("@ecotrack_events_list");
        let allEvents = savedEvents ? JSON.parse(savedEvents) : (window.eventsList || []);
        allEvents = allEvents.map(ev => {
          if (ev.id === 1 && ev.date === "20 June 2026") {
            ev.date = "20 September 2026";
          } else if (ev.id === 2 && ev.date === "28 June 2026") {
            ev.date = "28 September 2026";
          } else if (ev.id === 3 && ev.date === "5 July 2026") {
            ev.date = "5 October 2026";
          } else if (ev.id === 4 && ev.date === "12 July 2026") {
            ev.date = "12 October 2026";
          } else if (ev.id === 5 && ev.date === "19 July 2026") {
            ev.date = "19 October 2026";
          }
          return ev;
        });
        
        // Match strictly with user's issued tickets
        localTicketsData.forEach(t => {
          const evDetail = allEvents.find(e => String(e.id) === String(t.eventId));
          if (evDetail && !events.some(ev => String(ev.id) === String(t.eventId))) {
            events.push({
              ...evDetail,
              user_registration: {
                user_id: p.id,
                registered_at: t.purchaseDate || new Date().toISOString(),
                ticket_id: t.serialNumber || 'ET-VERIFIED'
              }
            });
          }
        });

        // Fallback for registered IDs if tickets object array not populated
        if (events.length === 0 && localRegIds.length > 0) {
          localRegIds.forEach(id => {
            const evDetail = allEvents.find(e => String(e.id) === String(id));
            if (evDetail && !events.some(ev => String(ev.id) === String(id))) {
              events.push({
                ...evDetail,
                user_registration: {
                  user_id: p.id,
                  registered_at: new Date().toISOString(),
                  ticket_id: 'ET-REGISTERED'
                }
              });
            }
          });
        }
      } else {
        const res = await fetch(`${AUTH_CONFIG.apiBase}/events/registrations/${p.id}`, {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          events = await res.json();
        }
      }

      renderEventsList(events || [], container, isOwner);
    } catch (e) {
      container.innerHTML = `<div class="empty-state"><h4>Error fetching events</h4></div>`;
    }
  }
}

function renderEventsList(events, container, isOwner = false) {
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
      ${events.map(ev => {
        const venueMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.title + ' ' + (ev.location || ''))}`;
        const displayDate = ev.date || ev.date_str || 'N/A';
        const displayLocation = ev.location || 'Online';
        
        return `
        <div class="card" style="padding:0; overflow:hidden; border:1px solid var(--border-color); background:var(--bg-card); border-radius:16px; display:flex; flex-direction:column; justify-content:space-between; height:100%;">
          <div style="height:140px; background:#000;">
            <img src="${ev.image || 'https://images.unsplash.com/photo-1470240731273-7821a6eeb6bd?w=600'}" style="width:100%; height:100%; object-fit:cover;">
          </div>
          <div style="padding:1.25rem; flex:1;">
            <div style="font-size:0.75rem; font-weight:800; color:var(--primary); text-transform:uppercase; margin-bottom:0.375rem;">${escapeHtml(ev.category || 'Volunteer')}</div>
            <h4 style="margin:0 0 0.5rem 0; font-size:1.05rem; font-weight:900; color:var(--text-primary);">${escapeHtml(ev.title)}</h4>
            <div style="font-size:0.8rem; color:var(--text-muted); display:flex; flex-direction:column; gap:4px;">
              <div><i class="far fa-calendar-alt" style="color:var(--primary); margin-right:6px;"></i>${escapeHtml(displayDate)}</div>
              <div>
                <i class="fas fa-map-marker-alt" style="color:var(--primary); margin-right:6px;"></i>
                <a href="${venueMapUrl}" target="_blank" rel="noopener noreferrer" style="color:var(--primary,#10b981); font-weight:700; text-decoration:underline;">
                  ${escapeHtml(displayLocation)} <i class="fas fa-arrow-up-right-from-square" style="font-size:9px;"></i>
                </a>
              </div>
            </div>
          </div>
          <div style="padding:1rem 1.25rem; border-top:1px solid var(--border-color); background:var(--bg-main); display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <span style="font-size:11px; font-weight:800; color:var(--text-muted);">Pass ID: ${escapeHtml(ev.user_registration?.ticket_id || 'Registered')}</span>
            <div style="display:flex; gap:6px;">
              <button class="btn btn-secondary" style="font-size:0.7rem; padding:6px 10px;" onclick="viewEventTicketPass('${ev.id}')">View Ticket</button>
              ${isOwner ? `<button class="btn btn-secondary" style="font-size:0.7rem; padding:6px 10px; color:#ef4444; border-color:#ef444430; background:#ef444408;" onclick="handleCancelEventReservation(${ev.id})">Cancel</button>` : ''}
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

function viewEventTicketPass(eventId) {
  if (window.switchTab) window.switchTab('events');
  setTimeout(() => {
    if (window.switchEventsTab) window.switchEventsTab('tickets');
  }, 150);
}
window.viewEventTicketPass = viewEventTicketPass;

function renderPetsGrid(pets, container, isOwner) {
  if (!pets || !pets.length) {
    container.innerHTML = `
      <div class="empty-state" style="text-align:center; padding:4rem 2rem; color:var(--text-muted);">
        <i class="fas fa-paw fa-3x" style="margin-bottom:1rem; opacity:0.3; color:var(--primary);"></i>
        <h4 style="font-weight:900; color:var(--text-primary); font-size:1.25rem;">No Registered Animals</h4>
        <p style="max-width:400px; margin:8px auto 0;">Digitally register your pets or rescue animals for AI pose monitoring and health tracking.</p>
        <button class="btn btn-primary scale-hover" style="margin-top:1.5rem; display:inline-flex; align-items:center; gap:8px; padding:0.6rem 1.4rem; font-weight:800; border-radius:12px; cursor:pointer;" onclick="openAddPetModal()"><i class="fas fa-plus"></i> + Add Animal to Vault</button>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:12px;">
      <div>
        <h4 style="margin:0; font-weight:900; font-size:1.25rem; color:var(--text-primary); display:flex; align-items:center; gap:8px;">
          <i class="fas fa-paw" style="color:var(--primary);"></i> Registered Animals (${pets.length})
        </h4>
        <p style="margin:2px 0 0 0; font-size:0.85rem; color:var(--text-muted);">Digital animal vault registry & health monitoring</p>
      </div>
      <button class="btn btn-primary scale-hover" style="display:inline-flex; align-items:center; gap:8px; padding:0.6rem 1.3rem; font-weight:800; border-radius:12px; cursor:pointer; box-shadow:var(--shadow-sm);" onclick="openAddPetModal()">
        <i class="fas fa-plus"></i> Add Animal
      </button>
    </div>
    <div class="welfare-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:1.5rem;">
      ${pets.map(pet => `
        <div class="card pet-card" style="padding:0; overflow:hidden; transition:transform 0.2s, box-shadow 0.2s; border:1px solid var(--border-color); background:var(--bg-card); border-radius:16px;">
          <div style="height:165px; position:relative; background:#000;">
            <img src="${(pet.images && pet.images[0]) || 'https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?w=600'}" style="width:100%; height:100%; object-fit:cover;" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?w=600'">
            <div style="position:absolute; top:12px; right:12px; background:rgba(0,0,0,0.65); color:#fff; padding:4px 10px; border-radius:12px; font-size:10px; font-weight:800; backdrop-filter:blur(4px);">
              ${escapeHtml(pet.breed || pet.species || 'Standard Breed')}
            </div>
          </div>
          <div style="padding:1.25rem; text-align:left;">
            <h4 style="margin:0; font-size:1.15rem; font-weight:900; color:var(--text-primary);">${escapeHtml(pet.name)}</h4>
            <div style="font-size:0.82rem; color:var(--text-muted); margin-top:4px;">${escapeHtml(pet.age || '1 Year')} • ${escapeHtml(pet.weight || '10 kg')}</div>
            <button class="btn btn-secondary btn-block scale-hover" style="width:100%; margin-top:1rem; font-size:0.8rem; font-weight:800; border-radius:10px;" onclick="openPetDetailsModal('${pet.id}')">Health Record</button>
          </div>
        </div>
      `).join('')}
      <!-- Always visible Add Animal action card inside the grid -->
      <div class="card pet-card scale-hover" onclick="openAddPetModal()" style="padding:2rem 1.5rem; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; min-height:280px; border:2px dashed var(--primary); background:rgba(16,185,129,0.04); border-radius:16px; cursor:pointer; transition:all 0.2s ease;">
        <div style="width:58px; height:58px; border-radius:50%; background:rgba(16,185,129,0.15); color:var(--primary); display:flex; align-items:center; justify-content:center; font-size:1.75rem; margin-bottom:12px; box-shadow:0 4px 12px rgba(16,185,129,0.18);">
          <i class="fas fa-plus"></i>
        </div>
        <h4 style="margin:0; font-size:1.1rem; font-weight:900; color:var(--text-primary);">Add Another Animal</h4>
        <p style="margin:6px 0 0; font-size:0.8rem; color:var(--text-muted); line-height:1.4; max-width:210px;">Register a new pet or rescue animal into your vault</p>
        <button class="btn btn-primary scale-hover" style="margin-top:14px; font-weight:800; border-radius:10px; padding:6px 16px; font-size:0.8rem; pointer-events:none;">
          + Add Animal
        </button>
      </div>
    </div>`;
}

function openPetDetailsModal(petId) {
  const pet = activeProfileData?.pets?.find(p => String(p.id) === String(petId));
  if (!pet) return;

  let existingModal = document.getElementById('petDetailModal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'petDetailModal';
  modal.className = 'modal-backdrop active';
  modal.style.cssText = 'display:flex; z-index:9999; justify-content:center; align-items:center; background:rgba(0,0,0,0.65); backdrop-filter:blur(8px); opacity:1; pointer-events:auto;';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  
  const avatarUrl = (pet.images && pet.images[0]) || pet.avatar_url || 'https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?w=200';
  
  modal.innerHTML = `
    <div class="modal-card" style="max-width:500px; padding:0; border-radius:24px; overflow:hidden; display:flex; flex-direction:column;">
      <div style="background:linear-gradient(135deg, #10b981, #059669); padding:24px; position:relative; color:#fff;">
        <button onclick="document.getElementById('petDetailModal').remove()" style="position:absolute; top:16px; right:16px; background:rgba(255,255,255,0.2); border:none; color:#fff; width:32px; height:32px; border-radius:50%; cursor:pointer; font-size:16px; display:flex; align-items:center; justify-content:center;">✕</button>
        <h3 style="margin:0; font-size:1.4rem; font-weight:900;">🐾 Health Record</h3>
        <p style="margin:4px 0 0; font-size:12px; opacity:0.8;">Registered Animal Profile & Diagnostics</p>
      </div>
      <div class="modal-body" style="padding:20px; overflow-y:auto; max-height:60vh;">
        <div style="display:flex; gap:16px; align-items:center; margin-bottom:20px;">
          <img src="${avatarUrl}" style="width:80px; height:80px; border-radius:20px; object-fit:cover; border:2px solid var(--primary);" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?w=200'">
          <div>
            <h4 style="margin:0 0 4px; font-size:1.2rem; font-weight:900; color:var(--text-primary);">${escapeHtml(pet.name)}</h4>
            <span style="background:rgba(16,185,129,0.1); color:var(--primary); padding:2px 8px; border-radius:8px; font-size:11px; font-weight:800; border:1px solid rgba(16,185,129,0.2);">${escapeHtml(pet.breed || pet.species)}</span>
          </div>
        </div>
        
        <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:12px; margin-bottom:20px; background:var(--bg-main); padding:12px; border-radius:12px; border:1px solid var(--border-color);">
          <div>
            <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Age</div>
            <div style="font-size:13px; font-weight:700; color:var(--text-primary); margin-top:2px;">${escapeHtml(pet.age || 'N/A')}</div>
          </div>
          <div>
            <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Weight</div>
            <div style="font-size:13px; font-weight:700; color:var(--text-primary); margin-top:2px;">${escapeHtml(pet.weight || 'N/A')}</div>
          </div>
          <div>
            <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Gender</div>
            <div style="font-size:13px; font-weight:700; color:var(--text-primary); margin-top:2px;">${escapeHtml(pet.gender || 'N/A')}</div>
          </div>
          <div>
            <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:800;">Registered At</div>
            <div style="font-size:13px; font-weight:700; color:var(--text-primary); margin-top:2px;">${pet.created_at ? new Date(pet.created_at).toLocaleDateString() : 'N/A'}</div>
          </div>
        </div>

        <div style="margin-bottom:10px;">
          <h5 style="margin:0 0 6px; font-size:12px; font-weight:800; color:var(--text-secondary); text-transform:uppercase;">Medical History / Notes</h5>
          <div style="background:var(--bg-main); border:1px solid var(--border-color); padding:14px; border-radius:12px; font-size:13px; color:var(--text-primary); line-height:1.5; font-weight:500;">
            ${escapeHtml(pet.medical_history || 'No medical issues registered. Animal is currently healthy and active.')}
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}
window.openPetDetailsModal = openPetDetailsModal;

function renderScansList(scans, container) {
  if (!scans.length) {
    container.innerHTML = `<div class="empty-state" style="text-align:center; padding:4rem 2rem; color:var(--text-muted);"><i class="fas fa-microscope fa-3x" style="margin-bottom:1rem; opacity:0.3;"></i><h4>No Scan History</h4><p>Perform an AI Scan in the AI Scanner tab to see biomechanical diagnostics here.</p></div>`;
    return;
  }

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:1rem;">
      ${scans.map(s => {
        const sid = s.scanId || s.id || '';
        const species = s.detectedSpecies || s.species || 'Animal';
        const breed = s.detectedBreed || s.breed || '';
        const title = breed ? `${species} (${breed})` : species;
        const exercise = s.exerciseName || s.exercise || 'Motion Analysis';
        const grade = s.grade || (s.formScore >= 90 ? 'A+' : s.formScore >= 80 ? 'A' : s.formScore >= 70 ? 'B' : 'C');
        const score = s.formScore !== undefined ? s.formScore : (s.postureScore || 85);
        const dateStr = (s.timestamp || s.createdAt) ? new Date(s.timestamp || s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently Saved';
        return `
        <div class="card" style="padding:1.25rem; display:flex; align-items:center; gap:1.25rem; border-left:4px solid var(--primary); background:var(--bg-card); border-radius:18px; cursor:pointer; transition:transform 0.2s, box-shadow 0.2s;" onclick="viewFullReport('${sid}')" onmouseenter="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 24px rgba(16,185,129,0.12)'" onmouseleave="this.style.transform=''; this.style.boxShadow='none'">
          <div style="width:52px; height:52px; border-radius:14px; background:linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.1)); color:var(--primary); display:flex; align-items:center; justify-content:center; font-weight:900; font-size:1.35rem; flex-shrink:0; border:1px solid rgba(16,185,129,0.25);">
            ${escapeHtml(grade)}
          </div>
          <div style="flex:1; text-align:left; overflow:hidden;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span style="font-weight:900; font-size:1.05rem; color:var(--text-primary);">${escapeHtml(title)} Analysis</span>
              <span style="background:rgba(16,185,129,0.12); color:var(--primary); font-size:11px; font-weight:800; padding:2px 8px; border-radius:8px;">${score}% Form</span>
            </div>
            <div style="font-size:0.78rem; color:var(--text-muted); margin-top:3px;">
              <i class="far fa-calendar-alt" style="margin-right:4px;"></i> ${escapeHtml(dateStr)} • <i class="fas fa-dumbbell" style="margin-right:4px; margin-left:6px;"></i> ${escapeHtml(exercise)} ${(s.repsCompleted || s.repCount) ? `• ${s.repsCompleted || s.repCount} reps` : ''}
            </div>
          </div>
          <button class="btn btn-secondary scale-hover" style="border-radius:10px; font-size:12px; font-weight:800; padding:8px 14px;" onclick="event.stopPropagation(); viewFullReport('${sid}')">
            View Report <i class="fas fa-arrow-right" style="margin-left:4px;"></i>
          </button>
        </div>
      `;}).join('')}
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
          <div style="font-weight:700; margin-top:0.25rem; color:var(--primary);"><i class="fas fa-check-circle"></i> ${(p.role === 'admin' || p.role === 'staff') ? 'Staff / Administrator' : 'Standard Member'}</div>
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
  const notifEnabled = localStorage.getItem('@ecotrack_notifications') !== 'disabled';
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
          <button id="notifToggleBtn" class="btn ${notifEnabled ? 'btn-primary' : 'btn-secondary'} scale-hover" onclick="toggleProfileNotifications(this)">
            <i class="fas ${notifEnabled ? 'fa-bell' : 'fa-bell-slash'}"></i> ${notifEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; padding:1.25rem; background:var(--bg-main); border-radius:12px; border:1px solid var(--border-color);">
          <div>
            <div style="font-weight:800; font-size:0.95rem; color:var(--text-primary);">Edit Profile Info</div>
            <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">Update your name, bio, location, and privacy settings.</div>
          </div>
          <button class="btn btn-secondary scale-hover" onclick="closeSettingsModal(); setTimeout(openEditProfileModal, 200);"><i class="fas fa-user-edit"></i> Edit</button>
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

  // Strictly evaluate earned vs locked based on actual user counts
  const mergedAch = milestones.filter(m => m.current >= m.target).map(m => ({
    badge_name: m.name,
    title: m.name,
    icon: m.icon,
    description: m.desc
  }));

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
        <button class="btn" style="font-size:0.7rem; padding:6px 14px; font-weight:800; color:#fff; background:linear-gradient(${gradient}); border:none; border-radius:10px; flex-shrink:0;" onclick="shareAchievementToFeed(encodeURIComponent('${(a.badge_name || a.title).replace(/'/g, \"\\\\'\")}'), encodeURIComponent('${a.icon || '🏆'}'))">
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
    const rawName = (badgeName && typeof badgeName === 'string' && badgeName.includes('%')) ? decodeURIComponent(badgeName) : (badgeName || 'EcoTrack Achievement');
    const rawIcon = (icon && typeof icon === 'string' && icon.includes('%')) ? decodeURIComponent(icon) : (icon || '🏆');
    const text = `🏆 I just unlocked the "${rawName}" achievement on EcoTrack! ${rawIcon}\nJoin me in protecting animal welfare!`;

    // 1. Attempt post to community feed in background
    let sharedToFeed = false;
    if (window.EcoSocialDB && window.EcoSocialDB.createPost) {
      try {
        const res = await window.EcoSocialDB.createPost({
          content: text,
          post_type: 'achievement'
        });
        if (res) sharedToFeed = true;
      } catch (e) {
        console.warn('Feed post background attempt:', e);
      }
    }

    // 2. Copy to clipboard with fallback
    let copied = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        copied = true;
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        copied = true;
      }
    } catch (e) {}

    // 3. Try Native Web Share if available
    if (navigator.share) {
      try {
        await navigator.share({
          title: `EcoTrack Achievement: ${rawName}`,
          text: text,
          url: window.location.href
        });
        const toastFn = window.showToast || (typeof showToast === 'function' ? showToast : null);
        if (toastFn) toastFn(`Shared "${rawName}" achievement!`, 'success');
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    // 4. Show friendly celebratory share modal dialog
    openAchievementShareModal(rawName, rawIcon, text, sharedToFeed, copied);
  } catch (e) {
    console.error('Share achievement error:', e);
    const toastFn = window.showToast || (typeof showToast === 'function' ? showToast : null);
    if (toastFn) toastFn('Achievement ready to share.', 'info');
  }
}

function openAchievementShareModal(name, icon, shareText, sharedToFeed, copied) {
  let modal = document.getElementById('achievementShareModal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'achievementShareModal';
  modal.className = 'modal-backdrop active';
  modal.style.cssText = 'display:flex; z-index:10000; justify-content:center; align-items:center; background:rgba(0,0,0,0.65); backdrop-filter:blur(8px);';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  modal.innerHTML = `
    <div class="modal-card" style="max-width:440px; width:90%; background:var(--bg-card); border:1px solid var(--border-color); border-radius:24px; box-shadow:0 12px 40px rgba(0,0,0,0.25); text-align:center; overflow:hidden; animation:modalPopIn 0.25s ease;">
      <div style="background:linear-gradient(135deg, #10b981, #059669); padding:28px 20px; color:#fff;">
        <div style="width:70px; height:70px; border-radius:50%; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:2.2rem; margin:0 auto 12px; border:2px solid rgba(255,255,255,0.3); backdrop-filter:blur(4px);">
          ${icon}
        </div>
        <div style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:1.5px; opacity:0.85;">Conservation Badge</div>
        <h3 style="margin:4px 0 0; font-size:1.35rem; font-weight:900;">${escapeHtml(name)}</h3>
      </div>
      <div style="padding:22px 24px; text-align:left;">
        <div style="background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.2); border-radius:12px; padding:12px 14px; margin-bottom:18px; display:flex; align-items:center; gap:10px;">
          <i class="fas fa-check-circle" style="color:var(--primary); font-size:18px;"></i>
          <span style="font-size:12.5px; font-weight:700; color:var(--text-primary);">${sharedToFeed ? 'Shared to Community Feed & copied to clipboard!' : (copied ? 'Achievement celebration copied to clipboard!' : 'Achievement ready to share!')}</span>
        </div>
        <div style="font-size:11px; font-weight:800; color:var(--text-muted); text-transform:uppercase; margin-bottom:6px;">Share Caption</div>
        <div style="background:var(--bg-main); border:1px solid var(--border-color); border-radius:10px; padding:10px 12px; font-size:12px; color:var(--text-primary); margin-bottom:20px; word-break:break-word;">
          ${escapeHtml(shareText)}
        </div>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <button class="btn btn-primary btn-block scale-hover" style="font-weight:800; border-radius:12px; padding:12px;" onclick="if(window.switchTab){ window.switchTab('community'); if(window.initCommunityFeed) window.initCommunityFeed(); } document.getElementById('achievementShareModal')?.remove();">
            <i class="fas fa-users"></i> View on Community Feed
          </button>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <a href="https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}" target="_blank" class="btn btn-secondary scale-hover" style="font-weight:700; border-radius:10px; padding:9px; text-decoration:none; display:flex; align-items:center; justify-content:center; gap:6px; font-size:12px; color:#25D366;">
              <i class="fab fa-whatsapp"></i> WhatsApp
            </a>
            <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}" target="_blank" class="btn btn-secondary scale-hover" style="font-weight:700; border-radius:10px; padding:9px; text-decoration:none; display:flex; align-items:center; justify-content:center; gap:6px; font-size:12px; color:#1DA1F2;">
              <i class="fab fa-twitter"></i> X / Twitter
            </a>
          </div>
        </div>
      </div>
      <div style="padding:12px 24px 18px; text-align:center;">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('achievementShareModal')?.remove()" style="font-size:12px; color:var(--text-muted); font-weight:700;">Close</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}
window.openAchievementShareModal = openAchievementShareModal;
window.shareAchievementToFeed = shareAchievementToFeed;

function computeTrainingProgress(prog) {
  if (typeof prog === 'number') return prog;
  if (!prog || typeof prog !== 'object') return 0;
  const completed = Array.isArray(prog.completed_exercises) ? prog.completed_exercises.length : 0;
  // Use actual exercise count from the real AI-generated plan if available
  let totalDrills = 5;
  if (prog.plan) {
    if (Array.isArray(prog.plan.exercises) && prog.plan.exercises.length > 0) {
      totalDrills = prog.plan.exercises.length;
    } else if (Array.isArray(prog.plan.daysPlan)) {
      // Count all non-rest day drills across the plan
      const drillCount = prog.plan.daysPlan.reduce((sum, day) => sum + (Array.isArray(day.drills) ? day.drills.length : 0), 0);
      if (drillCount > 0) totalDrills = drillCount;
    }
  }
  return Math.min(100, Math.round((completed / totalDrills) * 100));
}

function findTrainingProgramById(programId) {
  if (!programId) return null;
  const pId = String(programId);
  let prog = activeProfileData?.metrics?.programs?.find(p => String(p.id) === pId)
    || activeProfileData?.programs?.find(p => String(p.id) === pId);
  if (prog) return prog;

  try {
    const session = getSession();
    const uid = session ? session.id : 'usr1';
    const userPlans = JSON.parse(localStorage.getItem(`@ecotrack_training_plans_${uid}`) || '[]');
    prog = userPlans.find(p => String(p.id) === pId);
    if (prog) return prog;
  } catch (e) {}

  try {
    const generalPlans = JSON.parse(localStorage.getItem('@ecotrack_saved_plans') || '[]');
    prog = generalPlans.find(p => String(p.id) === pId);
    if (prog) return prog;
  } catch (e) {}

  return null;
}
window.findTrainingProgramById = findTrainingProgramById;

function openTrainingPlanDetail(programId) {
  const prog = findTrainingProgramById(programId);
  if (!prog) {
    showToast("Training plan details could not be loaded.", "error");
    return;
  }

  const progress = prog.progress || {};
  let plan = progress.plan || {};
  const completedExs = Array.isArray(progress.completed_exercises) ? progress.completed_exercises : [];

  const species = plan.speciesName || prog.species || 'Dog';
  const breed = plan.breedName || prog.breed || 'Standard';
  const age = plan.age != null ? plan.age : 'N/A';
  const weight = plan.weight != null ? plan.weight : 'N/A';
  const goal = plan.goal || prog.goal || 'Obedience & Agility';
  const days = plan.planDurationDays || (plan.daysPlan ? plan.daysPlan.length : 3);
  const adaptationExplanation = plan.adaptationExplanation || 'Initial baseline plan.';

  // If daysPlan is missing or empty, construct default daysPlan for this species and goal
  let daysPlan = Array.isArray(plan.daysPlan) && plan.daysPlan.length > 0 ? plan.daysPlan : null;
  if (!daysPlan) {
    const focusThemes = [
      "Foundation & Biomechanical Form Setup",
      "Hypertrophy, Core & Postural Stability",
      "High-Drive Endurance & Cardiovascular Stamina",
      "Active Recovery, Joint Mobility & Hydration",
      "Explosive Agility & Kinetic Power"
    ];
    daysPlan = [];
    const drillsSource = (plan.exercises && plan.exercises.length > 0) ? plan.exercises : [
      { name: "Weave Pole Slalom Agility Navigation", objectives: "ML Model Optimized Primary Movement", difficulty: "Beginner" },
      { name: "Tug Pulldown Neck & Back Engagement", objectives: "ML Model Optimized Primary Movement", difficulty: "Beginner" },
      { name: "Rear-Drive Backward Stepping", objectives: "ML Model Optimized Secondary Movement", difficulty: "Beginner" },
      { name: "Chest-Elevated Step-Ups", objectives: "ML Model Optimized Primary Movement", difficulty: "Beginner" },
      { name: "Incline Ramp Quad Power Climbs", objectives: "ML Model Optimized Secondary Movement", difficulty: "Beginner" }
    ];

    let drillIdx = 0;
    for (let d = 1; d <= days; d++) {
      const theme = focusThemes[(d - 1) % focusThemes.length];
      const countForDay = d === 1 ? 1 : 2;
      const dayDrills = [];
      for (let k = 0; k < countForDay && drillIdx < drillsSource.length; k++) {
        const item = drillsSource[drillIdx++];
        dayDrills.push({
          name: item.name || item.title,
          desc: item.objectives || item.desc || "ML Model Optimized Primary Movement",
          difficulty: item.difficulty || item.intensity || "Beginner",
          reps: item.reps || "3 sets × 10 reps",
          targetMuscles: item.targetMuscles || "Core & Prime Movers"
        });
      }
      daysPlan.push({
        dayNum: d,
        title: `${theme} 🔥`,
        focus: `Targeted ${goal} progression`,
        isRest: false,
        drills: dayDrills,
        targetCalories: 260,
        diet: {
          recommendation: "High protein recovery meal after training session.",
          hydration: "1500 mL"
        }
      });
    }
  }

  // Count total drills and completed drills
  let totalDrills = 0;
  let doneDrills = 0;
  daysPlan.forEach(d => {
    (d.drills || []).forEach(drill => {
      totalDrills++;
      const drillTitle = drill.name || drill.title;
      if (completedExs.includes(drillTitle)) doneDrills++;
    });
  });
  const pct = totalDrills > 0 ? Math.round((doneDrills / totalDrills) * 100) : 0;

  // Build the day-by-day HTML matching the first image
  const daysScheduleHtml = daysPlan.map((d, dIdx) => {
    const dailyNutritionHtml = d.isRest ? `
      <div style="background:var(--bg-main);border:1px solid rgba(2,132,199,0.3);border-left:4px solid var(--accent);padding:12px 14px;border-radius:12px;margin-bottom:12px;">
        <div style="font-size:10.5px;font-weight:800;color:var(--accent);text-transform:uppercase;letter-spacing:0.5px;">🥗 Rest Day Nutrition Protocol</div>
        <div style="font-size:12.5px;color:var(--text-primary);font-weight:700;margin-top:2px;">${d.diet?.recommendation || 'Hydration and joint supplements.'}</div>
      </div>
    ` : `
      <div style="background:var(--bg-main);border:1px solid rgba(16,185,129,0.3);border-left:4px solid var(--primary);padding:12px 14px;border-radius:12px;margin-bottom:12px;">
        <div style="font-size:10.5px;font-weight:800;color:var(--primary);text-transform:uppercase;letter-spacing:0.5px;">🔥 Training Day Nutrition Protocol</div>
        <div style="font-size:12.5px;color:var(--text-primary);font-weight:700;margin-top:2px;">${d.diet?.recommendation || 'High protein recovery meal after training session.'}</div>
      </div>
    `;

    const drillsListHtml = (d.drills || []).map((drill, index) => {
      const drillTitle = drill.name || drill.title || 'Exercise';
      const isDone = completedExs.includes(drillTitle);
      const safeDrillTitle = drillTitle.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const uniqueId = `modalDrill_${d.dayNum}_${index}`;
      return `
        <div style="background:var(--bg-main);border:1px solid var(--border-color);padding:14px 16px;border-radius:12px;margin-top:10px;">
          <div style="display:flex;align-items:flex-start;gap:12px;">
            <input type="checkbox" class="drill-modal-cb" ${isDone ? 'checked' : ''} 
              onchange="toggleExerciseInProgram('${prog.id}', '${safeDrillTitle}', this.checked)"
              style="width:20px;height:20px;accent-color:var(--primary);cursor:pointer;margin-top:2px;flex-shrink:0;">
            <div style="flex:1;">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                <strong style="color:var(--primary);font-size:15px;font-weight:900;${isDone ? 'text-decoration:line-through;opacity:0.75;' : ''}">${escapeHtml(drillTitle)}</strong>
                <div style="display:flex;gap:6px;align-items:center;">
                  <span class="tag-chip" style="font-size:10px;padding:3px 8px;background:var(--primary-light);color:var(--primary);font-weight:800;border-radius:10px;">${escapeHtml(drill.difficulty || 'Beginner')}</span>
                  <button type="button" class="btn btn-primary" style="padding:4px 9px;font-size:10.5px;border-radius:10px;" onclick="window.openAiScannerModal('${safeDrillTitle}', 'drill', '${(species || '').replace(/'/g, "\\'")}', '${(breed || '').replace(/'/g, "\\'")}')"><i class="fas fa-camera"></i> AI Pose Scan</button>
                  <button type="button" class="btn btn-secondary" style="padding:3px 7px;border-radius:50%;font-size:10px;" onclick="window.toggleDrillDetails('${uniqueId}')"><i class="fas fa-chevron-down" id="icon-${uniqueId}"></i></button>
                </div>
              </div>
              <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;font-weight:500;">${escapeHtml(drill.desc || drill.objectives || 'ML Model Optimized Movement')}</div>
            </div>
          </div>
          <div id="${uniqueId}" style="display:none;margin-top:10px;border-top:1px solid var(--border-color);padding-top:10px;">
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:8px;font-size:11px;color:var(--text-secondary);">
              <div><strong>⏱️ Sets/Reps:</strong> <span style="color:var(--text-primary);font-weight:700;">${escapeHtml(drill.reps || '3 sets × 10 reps')}</span></div>
              <div><strong>🎯 Muscles:</strong> <span style="color:var(--text-primary);font-weight:700;">${escapeHtml(drill.targetMuscles || 'Core & Stance Prime Movers')}</span></div>
              <div><strong>📍 Intensity:</strong> <span style="color:var(--primary);font-weight:700;">${escapeHtml(drill.difficulty || 'Moderate')}</span></div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div style="background:${d.isRest ? 'var(--bg-main)' : 'var(--bg-card)'};border:1px solid var(--border-color);border-left:5px solid ${d.isRest ? 'var(--accent)' : 'var(--primary)'};padding:18px 20px;border-radius:14px;margin-bottom:14px;box-shadow:var(--shadow-sm);">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:10px;">
          <strong style="font-size:16px;font-weight:900;color:var(--text-primary);">Day ${d.dayNum}: ${escapeHtml(d.title)}</strong>
          <span style="font-size:11px;font-weight:800;color:${d.isRest ? 'var(--accent)' : 'var(--primary)'};background:rgba(16,185,129,0.1);padding:3px 10px;border-radius:12px;border:1px solid ${d.isRest ? 'rgba(2,132,199,0.2)' : 'rgba(16,185,129,0.2)'};">
            ${d.isRest ? '💤 Active Recovery' : '🔥 Workout Session'}
          </span>
        </div>
        ${dailyNutritionHtml}
        <div style="font-size:12.5px;color:var(--text-secondary);margin-top:4px;font-weight:500;margin-bottom:8px;">${escapeHtml(d.focus || '')}</div>
        ${drillsListHtml}
      </div>
    `;
  }).join('');

  const safetyItems = [
    "Verify ambient temperature is under 30°C before exterior pavement drills.",
    "For animals/humans over 25 kg, avoid sudden sharp pivots on hard asphalt to safeguard joint ligaments.",
    "Ensure non-slip surface.",
    "Stop if animal shows distress or panting."
  ].map(tip => `<li>${tip}</li>`).join("");

  let existingModal = document.getElementById('trainingDetailModal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'trainingDetailModal';
  modal.className = 'modal-backdrop active';
  modal.style.cssText = 'display:flex; z-index:9999; justify-content:center; align-items:center; background:rgba(0,0,0,0.65); backdrop-filter:blur(8px); opacity:1; pointer-events:auto;';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  modal.innerHTML = `
    <div class="modal-card" style="max-width:880px; width:95%; padding:0; border-radius:24px; overflow:hidden; max-height:92vh; display:flex; flex-direction:column; background:var(--bg-card); box-shadow:0 25px 60px rgba(0,0,0,0.35);">
      
      <!-- Top Modal Bar -->
      <div style="display:flex; justify-content:space-between; align-items:center; padding:14px 22px; background:var(--bg-main); border-bottom:1px solid var(--border-color);">
        <div style="font-size:12px; font-weight:800; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">
          <i class="fas fa-bookmark" style="color:var(--primary); margin-right:6px;"></i> Saved Profile Training Plan
        </div>
        <button onclick="document.getElementById('trainingDetailModal').remove()" style="background:var(--bg-card); border:1px solid var(--border-color); color:var(--text-primary); width:32px; height:32px; border-radius:50%; cursor:pointer; font-size:14px; display:flex; align-items:center; justify-content:center; font-weight:800;">✕</button>
      </div>

      <!-- Printable & Scrollable Content Area (Matching First Image) -->
      <div id="trainingDetailModalContent" style="padding:22px; overflow-y:auto; flex:1;">
        <div class="card" style="margin:0; border-left:4px solid var(--primary); background:var(--bg-card); padding:20px; border-radius:18px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:14px;margin-bottom:18px;">
            <div>
              <div class="card-title" style="margin-bottom:4px; font-size:18px; font-weight:900;"><i class="fas fa-brain" style="color:var(--primary)"></i> ${days}-Day AI Species-Targeted Training Protocol: ${escapeHtml(species)} (${escapeHtml(breed)})</div>
              <div class="card-subtitle" style="margin-bottom:0; font-size:13px; color:var(--text-secondary);">Tailored module for ${escapeHtml(String(age))} yrs • ${escapeHtml(String(weight))} kg • ${days}-Day Plan • Primary Goal: <strong>${escapeHtml(goal)}</strong></div>
              <div style="margin-top:8px;font-size:12px;color:var(--primary);font-weight:700;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3);padding:3px 10px;border-radius:12px;font-size:11px;font-weight:800;"><i class="fas fa-robot"></i> Trained ML Model Verified</span>
                <span><i class="fas fa-check-double"></i> Adapted: ${escapeHtml(adaptationExplanation)}</span>
              </div>
            </div>
            <span class="tag-chip" style="background:var(--primary-light);color:var(--primary);font-weight:800;padding:6px 14px;border-radius:14px;font-size:12px;">⚡ ${days}-DAY PLAN GENERATED</span>
          </div>

          <!-- Metric Cards Grid -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px,1fr));gap:14px;margin-bottom:22px;">
            <div style="background:var(--bg-main);border:1px solid var(--border-color);padding:14px 16px;border-radius:14px;">
              <div style="font-size:11px;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Caloric Target</div>
              <div style="font-size:22px;font-weight:900;color:var(--primary);margin-top:4px;">${daysPlan[0]?.targetCalories || 260} <span style="font-size:13px;font-weight:600;">kcal/day</span></div>
            </div>
            <div style="background:var(--bg-main);border:1px solid var(--border-color);padding:14px 16px;border-radius:14px;">
              <div style="font-size:11px;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Hydration Minimum</div>
              <div style="font-size:22px;font-weight:900;color:var(--accent,#0284c7);margin-top:4px;">${daysPlan[0]?.diet?.hydration || '1500 mL'}</div>
            </div>
            <div style="background:var(--bg-main);border:1px solid var(--border-color);padding:14px 16px;border-radius:14px;">
              <div style="font-size:11px;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Plan Duration</div>
              <div style="font-size:22px;font-weight:900;color:var(--purple,#8b5cf6);margin-top:4px;">${days} Days <span style="font-size:13px;font-weight:600;">Regimen</span></div>
            </div>
          </div>

          <!-- Multi-Day Workout Regimen & Interactive Drills -->
          <div style="margin-bottom:22px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
              <h4 style="font-size:15px;font-weight:800;color:var(--text-primary);margin:0;">📅 ${days}-Day Training Schedule</h4>
              <span style="font-size:12px;font-weight:700;color:var(--primary);" id="modalTrainingProgressLabel">${pct}% Complete (${doneDrills}/${totalDrills} Drills Verified)</span>
            </div>
            <div style="width:100%;height:8px;background:var(--bg-main);border-radius:4px;overflow:hidden;margin-bottom:16px;border:1px solid var(--border-color);">
              <div id="modalTrainingProgressBar" style="width:${pct}%;height:100%;background:var(--primary);transition:width 0.3s ease;"></div>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;">
              ${daysScheduleHtml}
            </div>
          </div>

          <!-- Safety & Biomechanics Notes -->
          <div style="background:var(--bg-main);border:1px solid var(--border-color);padding:16px 20px;border-radius:14px;margin-bottom:20px;">
            <div style="font-weight:800;font-size:13px;color:var(--text-primary);margin-bottom:8px;">⚠️ Biomechanics & Trainer Guidelines:</div>
            <ul style="padding-left:20px;font-size:12.5px;color:var(--text-secondary);line-height:1.7;margin:0;">
              ${safetyItems}
            </ul>
          </div>

          <!-- Action Buttons Inside Modal -->
          <div style="display:flex;gap:12px;flex-wrap:wrap;border-top:1px solid var(--border-color);padding-top:16px;">
            <button class="btn btn-secondary scale-hover" style="border-radius:12px;font-weight:800;padding:10px 18px;" onclick="exportTrainingPlanModalToPDF('${prog.id}')">
              <i class="fas fa-print" style="margin-right:6px;"></i> Print / Export PDF Plan
            </button>
            <button class="btn btn-primary scale-hover" style="border-radius:12px;font-weight:800;padding:10px 18px;" onclick="openEditTrainingPlanModal('${prog.id}')">
              <i class="fas fa-pen-to-square" style="margin-right:6px;"></i> Update Plan
            </button>
            <button class="btn btn-ghost scale-hover" style="border-radius:12px;font-weight:700;padding:10px 16px;margin-left:auto;" onclick="document.getElementById('trainingDetailModal').remove()">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}
window.openTrainingPlanDetail = openTrainingPlanDetail;

async function toggleExerciseInProgram(progId, drillTitle, isChecked) {
  const prog = activeProfileData?.metrics?.programs?.find(p => String(p.id) === String(progId))
    || activeProfileData?.programs?.find(p => String(p.id) === String(progId));
  if (!prog) return;
  if (!prog.progress) prog.progress = {};
  if (!Array.isArray(prog.progress.completed_exercises)) prog.progress.completed_exercises = [];

  if (isChecked) {
    if (!prog.progress.completed_exercises.includes(drillTitle)) {
      prog.progress.completed_exercises.push(drillTitle);
    }
  } else {
    prog.progress.completed_exercises = prog.progress.completed_exercises.filter(t => t !== drillTitle);
  }

  // Update modal progress bar & label live
  const totalCbs = document.querySelectorAll('#trainingDetailModal .drill-modal-cb').length;
  const checkedCbs = document.querySelectorAll('#trainingDetailModal .drill-modal-cb:checked').length;
  const pct = totalCbs > 0 ? Math.round((checkedCbs / totalCbs) * 100) : 0;

  const bar = document.getElementById('modalTrainingProgressBar');
  const label = document.getElementById('modalTrainingProgressLabel');
  if (bar) bar.style.width = `${pct}%`;
  if (label) label.textContent = `${pct}% Complete (${checkedCbs}/${totalCbs} Drills Verified)`;

  // Update card in profile training logs grid in background
  const cardPct = document.getElementById(`progCardPct_${progId}`);
  const cardBar = document.getElementById(`progCardBar_${progId}`);
  if (cardPct) cardPct.textContent = `${pct}%`;
  if (cardBar) cardBar.style.width = `${pct}%`;

  // Persist to backend
  const session = (typeof getSession === 'function' ? getSession() : null) || window.currentUser;
  const userId = session?.id || session?.user_id || 'usr1';
  const headers = getAuthHeaders();

  try {
    await fetch(`${AUTH_CONFIG.apiBase}/training/programs/${userId}/${progId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ completed_exercises: prog.progress.completed_exercises })
    });
  } catch (err) {
    console.warn("Failed to persist drill completion:", err.message);
  }
}
window.toggleExerciseInProgram = toggleExerciseInProgram;

function exportTrainingPlanModalToPDF(progId) {
  const modalContent = document.getElementById('trainingDetailModalContent');
  if (!modalContent) {
    showToast("No training plan content available to export.", "warning");
    return;
  }

  const clone = modalContent.cloneNode(true);
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
    if (el.tagName === 'BUTTON' || el.classList.contains('btn') || el.classList.contains('modal-close-btn')) {
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
window.exportTrainingPlanModalToPDF = exportTrainingPlanModalToPDF;

function toggleModalTrainingDropdown(event) {
  event.stopPropagation();
  const d = document.getElementById('modalTrainingDropdown');
  if (d) {
    d.style.display = d.style.display === 'block' ? 'none' : 'block';
  }
}
window.toggleModalTrainingDropdown = toggleModalTrainingDropdown;

function openEditTrainingPlanModal(programId) {
  document.getElementById('trainingDetailModal')?.remove();
  document.getElementById('editTrainingPlanModal')?.remove();

  const prog = findTrainingProgramById(programId);
  if (!prog) {
    showToast("Training plan could not be opened for editing.", "error");
    return;
  }

  const progress = prog.progress || {};
  const plan = progress.plan || {};
  let exercises = [];

  if (plan && Array.isArray(plan.exercises) && plan.exercises.length > 0) {
    exercises = plan.exercises.map(e => ({
      title: e.name || e.title || '',
      reps: e.reps || e.sets_reps || '3 sets × 10 reps',
      difficulty: e.intensity || e.difficulty || 'Moderate',
      desc: e.instructions || e.desc || '',
      targetMuscles: e.targetMuscles || ''
    }));
  } else if (plan && Array.isArray(plan.daysPlan) && plan.daysPlan.length > 0) {
    plan.daysPlan.forEach(d => {
      if (Array.isArray(d.drills)) {
        d.drills.forEach(drill => {
          exercises.push({
            title: drill.name || drill.title || '',
            reps: drill.reps || drill.sets_reps || '3 sets × 10 reps',
            difficulty: drill.difficulty || drill.intensity || 'Moderate',
            desc: drill.desc || drill.instructions || '',
            targetMuscles: drill.targetMuscles || ''
          });
        });
      }
    });
  }

  if (exercises.length === 0) {
    exercises = [
      { title: 'Core Posture & Alignment', reps: '3 × 30s hold', difficulty: 'Beginner', desc: 'Maintain neutral spine and balanced stance.', targetMuscles: 'Core, back' },
      { title: 'Gait & Mobility Stride', reps: '4 × 20m walk', difficulty: 'Moderate', desc: 'Rhythmic movement testing limb symmetry.', targetMuscles: 'Limb extensors' },
      { title: 'Balance & Focus Drill', reps: '5 reps', difficulty: 'Intermediate', desc: 'Sustained focus and balance holds.', targetMuscles: 'Proprioception' }
    ];
  }

  const modal = document.createElement('div');
  modal.id = 'editTrainingPlanModal';
  modal.className = 'modal-backdrop active';
  modal.style.cssText = 'display:flex; z-index:10000; justify-content:center; align-items:center; background:rgba(0,0,0,0.65); backdrop-filter:blur(8px); opacity:1; pointer-events:auto;';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  modal.innerHTML = `
    <div class="modal-card" style="max-width:680px; width:95%; padding:0; border-radius:24px; overflow:hidden; max-height:92vh; display:flex; flex-direction:column; background:var(--bg-card); box-shadow:0 25px 60px rgba(0,0,0,0.35);">
      <!-- Header -->
      <div style="background:linear-gradient(135deg, #10b981, #059669); padding:20px 24px; color:#fff; display:flex; justify-content:space-between; align-items:center;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:42px; height:42px; border-radius:12px; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center;">
            <i class="fas fa-pen-to-square" style="color:#fff; font-size:18px;"></i>
          </div>
          <div>
            <div style="font-size:11px; font-weight:800; color:rgba(255,255,255,0.85); text-transform:uppercase; letter-spacing:1px;">Customize & Sync</div>
            <div style="font-size:1.15rem; font-weight:900; color:#fff;">Update Plan</div>
          </div>
        </div>
        <button onclick="document.getElementById('editTrainingPlanModal').remove(); openTrainingPlanDetail('${prog.id}');" style="background:rgba(255,255,255,0.2); border:none; color:#fff; width:32px; height:32px; border-radius:50%; cursor:pointer; font-size:16px; display:flex; align-items:center; justify-content:center;">✕</button>
      </div>

      <!-- Form Body -->
      <div style="padding:22px; overflow-y:auto; flex:1;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px;">
          <div>
            <label style="font-size:11px; font-weight:800; color:var(--text-secondary); text-transform:uppercase; display:block; margin-bottom:6px;">Plan Title *</label>
            <input type="text" id="editPlanTitle" class="form-input" style="width:100%; border-radius:12px; padding:10px 14px; font-weight:700;" value="${escapeHtml(prog.title || (prog.species || 'Animal') + ' Program')}">
          </div>
          <div>
            <label style="font-size:11px; font-weight:800; color:var(--text-secondary); text-transform:uppercase; display:block; margin-bottom:6px;">Species & Breed</label>
            <div style="display:flex; gap:8px;">
              <input type="text" id="editPlanSpecies" class="form-input" style="flex:1; border-radius:12px; padding:10px 14px;" value="${escapeHtml(prog.species || '')}" placeholder="Species">
              <input type="text" id="editPlanBreed" class="form-input" style="flex:1; border-radius:12px; padding:10px 14px;" value="${escapeHtml(prog.breed || '')}" placeholder="Breed (Optional)">
            </div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:2fr 1fr; gap:14px; margin-bottom:18px;">
          <div>
            <label style="font-size:11px; font-weight:800; color:var(--text-secondary); text-transform:uppercase; display:block; margin-bottom:6px;">Training Goal / Objective</label>
            <input type="text" id="editPlanGoal" class="form-input" style="width:100%; border-radius:12px; padding:10px 14px;" value="${escapeHtml(prog.goal || 'General Health')}" placeholder="e.g. Mobility, Strength, Rehab">
          </div>
          <div>
            <label style="font-size:11px; font-weight:800; color:var(--text-secondary); text-transform:uppercase; display:block; margin-bottom:6px;">Current Week</label>
            <input type="number" min="1" max="52" id="editPlanWeek" class="form-input" style="width:100%; border-radius:12px; padding:10px 14px;" value="${progress.current_week || 1}">
          </div>
        </div>

        <!-- Exercises Section -->
        <div style="margin-bottom:18px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <label style="font-size:12px; font-weight:900; color:var(--text-primary); text-transform:uppercase; letter-spacing:0.5px;">
              <i class="fas fa-list-check" style="color:var(--primary); margin-right:6px;"></i> Exercises & Drills Routine
            </label>
            <button type="button" class="btn btn-secondary scale-hover" style="font-size:11px; padding:5px 12px; border-radius:10px; font-weight:800;" onclick="addNewExerciseRowToEditor()">
              <i class="fas fa-plus"></i> Add Exercise
            </button>
          </div>
          <div id="editExercisesContainer" style="display:flex; flex-direction:column; gap:10px;">
            ${exercises.map((ex, idx) => `
              <div class="edit-drill-row" style="background:var(--bg-main); border:1px solid var(--border-color); border-radius:14px; padding:14px; position:relative;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                  <span style="font-size:11px; font-weight:900; color:var(--primary);">Exercise #${idx + 1}</span>
                  <button type="button" class="btn btn-ghost" style="padding:4px 8px; color:#ef4444;" onclick="this.closest('.edit-drill-row').remove()" title="Remove Exercise">
                    <i class="fas fa-trash-alt"></i>
                  </button>
                </div>
                <div style="display:grid; grid-template-columns:2fr 1fr 1fr; gap:10px; margin-bottom:8px;">
                  <input type="text" class="form-input drill-edit-title" style="border-radius:10px; padding:8px 12px; font-weight:700; font-size:12.5px;" value="${escapeHtml(ex.title)}" placeholder="Exercise Name">
                  <input type="text" class="form-input drill-edit-reps" style="border-radius:10px; padding:8px 12px; font-size:12px;" value="${escapeHtml(ex.reps)}" placeholder="Sets / Reps">
                  <select class="form-input drill-edit-diff" style="border-radius:10px; padding:8px 10px; font-size:12px;">
                    <option value="Beginner" ${ex.difficulty === 'Beginner' ? 'selected' : ''}>Beginner</option>
                    <option value="Moderate" ${ex.difficulty === 'Moderate' || ex.difficulty === 'Intermediate' ? 'selected' : ''}>Moderate</option>
                    <option value="Advanced" ${ex.difficulty === 'Advanced' ? 'selected' : ''}>Advanced</option>
                  </select>
                </div>
                <div style="display:grid; grid-template-columns:1fr; gap:8px;">
                  <input type="text" class="form-input drill-edit-desc" style="border-radius:10px; padding:8px 12px; font-size:12px;" value="${escapeHtml(ex.desc)}" placeholder="Coaching Instructions & Proper Form Tips">
                  <input type="text" class="form-input drill-edit-muscles" style="border-radius:10px; padding:8px 12px; font-size:12px;" value="${escapeHtml(ex.targetMuscles)}" placeholder="Target Muscles (e.g. Core, Hindquarters, Spine)">
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div>
          <label style="font-size:11px; font-weight:800; color:var(--text-secondary); text-transform:uppercase; display:block; margin-bottom:6px;">Observations & Coaching Notes</label>
          <textarea id="editPlanNotes" class="form-input" style="width:100%; border-radius:12px; padding:10px 14px; min-height:70px; resize:vertical; font-size:12.5px;" placeholder="Add private notes on animal behavior, gait improvement, energy levels...">${escapeHtml(progress.notes || '')}</textarea>
        </div>
      </div>

      <!-- Footer Buttons -->
      <div style="padding:16px 24px; border-top:1px solid var(--border-color); background:var(--bg-main); display:flex; justify-content:flex-end; gap:10px;">
        <button type="button" class="btn btn-secondary" style="border-radius:12px; padding:10px 18px; font-weight:700;" onclick="document.getElementById('editTrainingPlanModal').remove(); openTrainingPlanDetail('${prog.id}');">
          Cancel
        </button>
        <button type="button" class="btn btn-primary" style="border-radius:12px; padding:10px 20px; font-weight:800; display:flex; align-items:center; gap:8px;" onclick="saveEditedTrainingPlan('${prog.id}', false)">
          <i class="fas fa-floppy-disk"></i> Update Plan
        </button>
        <button type="button" class="btn btn-primary" style="border-radius:12px; padding:10px 20px; font-weight:900; background:linear-gradient(135deg, #059669, #10b981); display:flex; align-items:center; gap:8px;" onclick="saveEditedTrainingPlan('${prog.id}', true)">
          <i class="fas fa-play"></i> Save & Continue
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}
window.openEditTrainingPlanModal = openEditTrainingPlanModal;

function addNewExerciseRowToEditor() {
  const container = document.getElementById('editExercisesContainer');
  if (!container) return;
  const count = container.querySelectorAll('.edit-drill-row').length + 1;
  const div = document.createElement('div');
  div.className = 'edit-drill-row';
  div.style.cssText = 'background:var(--bg-main); border:1px solid var(--border-color); border-radius:14px; padding:14px; position:relative;';
  div.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <span style="font-size:11px; font-weight:900; color:var(--primary);">Exercise #${count}</span>
      <button type="button" class="btn btn-ghost" style="padding:4px 8px; color:#ef4444;" onclick="this.closest('.edit-drill-row').remove()" title="Remove Exercise">
        <i class="fas fa-trash-alt"></i>
      </button>
    </div>
    <div style="display:grid; grid-template-columns:2fr 1fr 1fr; gap:10px; margin-bottom:8px;">
      <input type="text" class="form-input drill-edit-title" style="border-radius:10px; padding:8px 12px; font-weight:700; font-size:12.5px;" placeholder="Exercise Name">
      <input type="text" class="form-input drill-edit-reps" style="border-radius:10px; padding:8px 12px; font-size:12px;" value="3 sets × 10 reps" placeholder="Sets / Reps">
      <select class="form-input drill-edit-diff" style="border-radius:10px; padding:8px 10px; font-size:12px;">
        <option value="Beginner">Beginner</option>
        <option value="Moderate" selected>Moderate</option>
        <option value="Advanced">Advanced</option>
      </select>
    </div>
    <div style="display:grid; grid-template-columns:1fr; gap:8px;">
      <input type="text" class="form-input drill-edit-desc" style="border-radius:10px; padding:8px 12px; font-size:12px;" placeholder="Coaching Instructions & Proper Form Tips">
      <input type="text" class="form-input drill-edit-muscles" style="border-radius:10px; padding:8px 12px; font-size:12px;" placeholder="Target Muscles (e.g. Core, Hindquarters, Spine)">
    </div>
  `;
  container.appendChild(div);
}
window.addNewExerciseRowToEditor = addNewExerciseRowToEditor;

async function saveEditedTrainingPlan(programId, andContinue) {
  const prog = findTrainingProgramById(programId);
  if (!prog) return;

  const titleVal = document.getElementById('editPlanTitle')?.value.trim() || prog.title || (prog.species || 'Animal') + ' Program';
  const speciesVal = document.getElementById('editPlanSpecies')?.value.trim() || prog.species || 'Animal';
  const breedVal = document.getElementById('editPlanBreed')?.value.trim() || prog.breed || '';
  const goalVal = document.getElementById('editPlanGoal')?.value.trim() || prog.goal || 'General Health';
  const weekVal = parseInt(document.getElementById('editPlanWeek')?.value) || 1;
  const notesVal = document.getElementById('editPlanNotes')?.value.trim() || '';

  const rows = document.querySelectorAll('#editExercisesContainer .edit-drill-row');
  const collectedDrills = [];
  rows.forEach(r => {
    const t = r.querySelector('.drill-edit-title')?.value.trim();
    if (t) {
      collectedDrills.push({
        name: t,
        title: t,
        reps: r.querySelector('.drill-edit-reps')?.value.trim() || '3 sets × 10 reps',
        difficulty: r.querySelector('.drill-edit-diff')?.value || 'Moderate',
        intensity: r.querySelector('.drill-edit-diff')?.value || 'Moderate',
        desc: r.querySelector('.drill-edit-desc')?.value.trim() || '',
        instructions: r.querySelector('.drill-edit-desc')?.value.trim() || '',
        targetMuscles: r.querySelector('.drill-edit-muscles')?.value.trim() || ''
      });
    }
  });

  const updatedProgress = {
    ...(prog.progress || {}),
    title: titleVal,
    current_week: weekVal,
    notes: notesVal,
    plan: {
      ...(prog.progress?.plan || {}),
      exercises: collectedDrills,
      daysPlan: [{
        dayNum: 1,
        title: "Active Training Routine",
        drills: collectedDrills
      }]
    }
  };

  const payload = {
    title: titleVal,
    species: speciesVal,
    breed: breedVal,
    goal: goalVal,
    progress: updatedProgress
  };

  const session = getSession();
  const userId = session ? session.id : 'usr1';
  const headers = getAuthHeaders();

  try {
    const res = await fetch(`${AUTH_CONFIG.apiBase}/training/programs/${userId}/${programId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      prog.title = titleVal;
      prog.species = speciesVal;
      prog.breed = breedVal;
      prog.goal = goalVal;
      prog.progress = updatedProgress;

      try {
        const userPlans = JSON.parse(localStorage.getItem(`@ecotrack_training_plans_${userId}`) || '[]');
        const pIdx = userPlans.findIndex(p => String(p.id) === String(programId));
        if (pIdx !== -1) {
          userPlans[pIdx] = { ...userPlans[pIdx], ...prog };
        } else {
          userPlans.unshift(prog);
        }
        localStorage.setItem(`@ecotrack_training_plans_${userId}`, JSON.stringify(userPlans));
      } catch (e) {}

      document.getElementById('editTrainingPlanModal')?.remove();
      showToast('✅ Training plan updated and saved!', 'success');

      const gridContainer = document.getElementById('profileTabContentArea');
      if (activeProfileTabSection === 'training' && gridContainer && activeProfileData?.metrics?.programs) {
        renderTrainingGrid(activeProfileData.metrics.programs, gridContainer);
      }

      if (andContinue) {
        continueTrainingInTrainer(speciesVal, goalVal);
      } else {
        openTrainingPlanDetail(programId);
      }
    } else {
      showToast('Failed to save training plan changes.', 'error');
    }
  } catch (err) {
    console.error('Error saving edited training plan:', err);
    showToast('Failed to connect to server.', 'error');
  }
}
window.saveEditedTrainingPlan = saveEditedTrainingPlan;

async function confirmDeleteTrainingPlan(programId, title) {
  const safeName = title || 'this training plan';
  const ok = window.showConfirmModal ? await window.showConfirmModal({
    title: "Delete Training Plan",
    message: `Are you sure you want to delete "${safeName}"? This action cannot be undone.`,
    icon: "fa-trash-alt",
    confirmText: "Yes, Delete",
    cancelText: "Cancel",
    isDanger: true
  }) : true;
  if (!ok) return;

  const session = getSession();
  const userId = session ? session.id : 'usr1';
  const headers = getAuthHeaders();

  try {
    const res = await fetch(`${AUTH_CONFIG.apiBase}/training/programs/${userId}/${programId}`, {
      method: 'DELETE',
      headers
    });

    if (res.ok) {
      if (activeProfileData?.metrics?.programs) {
        activeProfileData.metrics.programs = activeProfileData.metrics.programs.filter(p => String(p.id) !== String(programId));
      }

      const countEl = document.getElementById('statTrainingsCount');
      if (countEl && activeProfileData?.metrics?.programs) {
        countEl.textContent = activeProfileData.metrics.programs.length;
      }

      document.getElementById('trainingDetailModal')?.remove();
      document.getElementById('editTrainingPlanModal')?.remove();

      const gridContainer = document.getElementById('profileTabContentArea');
      if (activeProfileTabSection === 'training' && gridContainer && activeProfileData?.metrics?.programs) {
        renderTrainingGrid(activeProfileData.metrics.programs, gridContainer);
      }

      showToast(`🗑️ "${safeName}" deleted successfully`, 'info');
    } else {
      showToast('Failed to delete training plan.', 'error');
    }
  } catch (err) {
    console.error('Delete training plan error:', err);
    showToast('Network error deleting plan.', 'error');
  }
}
window.confirmDeleteTrainingPlan = confirmDeleteTrainingPlan;

async function resetTrainingPlanProgress(programId) {
  const prog = activeProfileData?.metrics?.programs?.find(p => String(p.id) === String(programId));
  if (!prog) return;

  const ok = window.showConfirmModal ? await window.showConfirmModal({
    title: "Reset Progress",
    message: `Are you sure you want to reset training progress to 0% for "${prog.title || prog.species || 'this plan'}"?`,
    icon: "fa-rotate-left",
    confirmText: "Yes, Reset",
    cancelText: "Cancel",
    isDanger: true
  }) : true;
  if (!ok) return;

  if (!prog.progress) prog.progress = {};
  prog.progress.completed_exercises = [];

  const session = getSession();
  const userId = session ? session.id : 'usr1';
  const headers = getAuthHeaders();

  try {
    await fetch(`${AUTH_CONFIG.apiBase}/training/programs/${userId}/${programId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ completed_exercises: [] })
    });
    showToast('Progress reset to 0%', 'info');

    openTrainingPlanDetail(programId);

    const gridContainer = document.getElementById('profileTabContentArea');
    if (activeProfileTabSection === 'training' && gridContainer && activeProfileData?.metrics?.programs) {
      renderTrainingGrid(activeProfileData.metrics.programs, gridContainer);
    }
  } catch (err) {
    console.warn('Reset progress failed:', err);
  }
}
window.resetTrainingPlanProgress = resetTrainingPlanProgress;

function toggleTrainingCardDropdown(event, programId) {
  event.stopPropagation();
  const dropdown = document.getElementById(`trainingDropdown_${programId}`);
  const isShown = dropdown && dropdown.style.display === 'block';
  hideAllTrainingDropdowns();
  if (dropdown && !isShown) {
    dropdown.style.display = 'block';
  }
}
window.toggleTrainingCardDropdown = toggleTrainingCardDropdown;

function hideAllTrainingDropdowns() {
  document.querySelectorAll('.training-card-dropdown').forEach(d => {
    d.style.display = 'none';
  });
  const m = document.getElementById('modalTrainingDropdown');
  if (m) m.style.display = 'none';
}
window.hideAllTrainingDropdowns = hideAllTrainingDropdowns;

document.addEventListener('click', () => {
  hideAllTrainingDropdowns();
});

function continueTrainingInTrainer(species, goal) {
  document.getElementById('trainingDetailModal')?.remove();
  document.getElementById('editTrainingPlanModal')?.remove();
  if (window.switchTab) window.switchTab('training');
  setTimeout(() => {
    const spInput = document.getElementById('trainSpecies');
    const glInput = document.getElementById('trainGoal');
    if (spInput && species) spInput.value = species;
    if (glInput && goal) glInput.value = goal;
    // Auto-scroll to form if needed
    spInput?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 120);
}
window.continueTrainingInTrainer = continueTrainingInTrainer;

function renderTrainingGrid(progs, container) {
  if (!progs.length) {
    container.innerHTML = `<div class="empty-state" style="text-align:center; padding:4rem 2rem; color:var(--text-muted);"><i class="fas fa-bolt-lightning fa-3x" style="margin-bottom:1rem; opacity:0.3;"></i><h4>No Training Logs</h4><p>Start a training program in the Species AI Trainer tab.</p></div>`;
    return;
  }
  container.innerHTML = `
    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:1.5rem;">
      ${progs.map((p) => {
        const pct = computeTrainingProgress(p.progress);
        const titleText = p.title || (p.species ? (p.species.charAt(0).toUpperCase() + p.species.slice(1) + ' Program') : 'Training Program');
        const safeTitle = (titleText).replace(/'/g, "\\'");
        return `
        <div class="card" style="padding:0; background:var(--bg-card); border:1px solid var(--border-color); border-radius:20px; text-align:left; overflow:visible; cursor:pointer; position:relative; transition:transform 0.2s, box-shadow 0.2s;" onclick="openTrainingPlanDetail('${p.id}')" onmouseenter="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 12px 32px rgba(16,185,129,0.15)'" onmouseleave="this.style.transform=''; this.style.boxShadow='none'">
          <!-- Card top accent -->
          <div style="height:4px; border-radius:20px 20px 0 0; background:linear-gradient(90deg, #10b981, #059669);"></div>
          <div style="padding:1.5rem;">
            <div style="display:flex; align-items:center; gap:0.9rem; margin-bottom:1.25rem;">
              <div style="width:46px; height:46px; border-radius:14px; background:linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.1)); color:var(--primary); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <i class="fas fa-dumbbell"></i>
              </div>
              <div style="flex:1; overflow:hidden;">
                <div style="font-weight:900; font-size:1rem; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(titleText)}</div>
                <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">${new Date(p.started_at).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})}</div>
              </div>
              
              <!-- Three-Dots Option Menu -->
              <div style="position:relative; flex-shrink:0;" onclick="event.stopPropagation()">
                <button class="btn btn-ghost training-menu-toggle-btn" 
                  style="width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:var(--text-muted); padding:0; background:var(--bg-main); border:1px solid var(--border-color);" 
                  onclick="toggleTrainingCardDropdown(event, '${p.id}')" 
                  title="Plan Actions">
                  <i class="fas fa-ellipsis-v"></i>
                </button>
                <div id="trainingDropdown_${p.id}" class="training-card-dropdown" style="display:none; position:absolute; right:0; top:42px; background:var(--bg-card,#fff); border:1px solid var(--border-color,#e2e8f0); border-radius:14px; box-shadow:0 12px 30px rgba(0,0,0,0.18); min-width:190px; z-index:100; overflow:hidden; backdrop-filter:blur(10px);">
                  <button style="width:100%; text-align:left; padding:10px 14px; background:none; border:none; color:var(--text-primary); font-size:12px; font-weight:700; display:flex; align-items:center; gap:9px; cursor:pointer;" onmouseenter="this.style.background='var(--bg-main)'" onmouseleave="this.style.background='none'" onclick="openTrainingPlanDetail('${p.id}'); hideAllTrainingDropdowns();">
                    <i class="fas fa-eye" style="color:var(--primary); width:16px;"></i> View Full Plan
                  </button>
                  <button style="width:100%; text-align:left; padding:10px 14px; background:none; border:none; color:var(--text-primary); font-size:12px; font-weight:700; display:flex; align-items:center; gap:9px; cursor:pointer;" onmouseenter="this.style.background='var(--bg-main)'" onmouseleave="this.style.background='none'" onclick="openEditTrainingPlanModal('${p.id}'); hideAllTrainingDropdowns();">
                    <i class="fas fa-pen-to-square" style="color:#3b82f6; width:16px;"></i> Update Plan
                  </button>
                  <div style="height:1px; background:var(--border-color); margin:2px 0;"></div>
                  <button style="width:100%; text-align:left; padding:10px 14px; background:none; border:none; color:#ef4444; font-size:12px; font-weight:700; display:flex; align-items:center; gap:9px; cursor:pointer;" onmouseenter="this.style.background='rgba(239,68,68,0.08)'" onmouseleave="this.style.background='none'" onclick="confirmDeleteTrainingPlan('${p.id}', '${safeTitle}'); hideAllTrainingDropdowns();">
                    <i class="fas fa-trash-alt" style="color:#ef4444; width:16px;"></i> Delete Plan
                  </button>
                </div>
              </div>
            </div>
            <div style="margin-bottom:0.5rem; display:flex; justify-content:space-between; font-size:0.75rem; font-weight:800;">
              <span style="color:var(--text-secondary);">Current Progress</span>
              <span style="color:var(--primary);" id="progCardPct_${p.id}">${pct}%</span>
            </div>
            <div style="height:8px; background:var(--bg-main); border-radius:4px; overflow:hidden; border:1px solid var(--border-color);">
              <div id="progCardBar_${p.id}" style="width:${pct}%; height:100%; background:linear-gradient(90deg, #10b981, #059669); transition:width 0.5s ease;"></div>
            </div>
            <div style="margin-top:12px; display:flex; justify-content:space-between; align-items:center;">
              <div style="font-size:11px; color:var(--text-muted); font-weight:700;">Click to view full training plan →</div>
              <span style="font-size:10px; font-weight:800; color:var(--primary); background:rgba(16,185,129,0.1); padding:2px 8px; border-radius:10px;">${escapeHtml(p.species || 'Animal')}</span>
            </div>
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
  container.innerHTML = `<div style="display:flex; flex-direction:column; gap:1.5rem; text-align:left; width:100%;">${posts.map(p => window.renderPostCardHtml(p)).join('')}</div>`;
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
    if (p.role === 'admin' || p.role === 'staff') {
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
  const roleEl = document.getElementById('editProfileRole');
  if (roleEl) roleEl.value = (p.role === 'admin' || p.role === 'staff') ? 'admin' : 'user';
  const vetStatusEl = document.getElementById('editProfileVetStatus');
  if (vetStatusEl) vetStatusEl.value = String(p.vet_status ?? 0);
  document.getElementById('editProfilePrivacy').value = p.privacy_setting || 'Public';
  document.getElementById('editProfileDmPrivacy').value = p.dm_privacy_setting || 'Everyone';
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
  if (!p || (!isSelfProfile(p.id) && !isSelfProfile(p.ecotrack_id) && !isSelfProfile(p.user_id))) {
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
  const emergency_helper = document.getElementById('editProfileEmergencyHelper')?.checked ? 1 : 0;
  const emergency_phone = document.getElementById('editProfileEmergencyPhone')?.value.trim() || '';
  const privacy_setting = document.getElementById('editProfilePrivacy').value;
  const dm_privacy_setting = document.getElementById('editProfileDmPrivacy').value;
  const avatarUrlInput = document.getElementById('editProfileAvatarUrl').value.trim();

  const role = document.getElementById('editProfileRole')?.value || (p.role || 'user');

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
      role,
      emergency_helper,
      emergency_phone,
      privacy_setting,
      dm_privacy_setting,
      avatar_url
    });

    if (result) {
      showToast('Profile updated successfully!', 'success');
      closeEditProfileModal();

      // Refresh authenticated session UI
      const freshUser = await window.EcoSocialDB.refreshMySession();
      if (freshUser) {
        freshUser.role = role;
        syncUserInterface(freshUser);
      }

      // Reload active dashboard
      if (window.currentUser) {
        window.currentUser.role = role;
        if (activeProfileData && activeProfileData.profile) {
          activeProfileData.profile.role = role;
        }
        await loadProfileTab(window.currentUser.id);
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
function isSelfProfile(id) {
  const s = getSession();
  if (!s) return true;
  if (!id) return true;
  const cleanId = String(id).replace(/^(user_|usr_|seller_)/, '');
  const cleanSId = String(s.id || '').replace(/^(user_|usr_|seller_)/, '');
  const cleanSEco = String(s.ecotrack_id || '').replace(/^(user_|usr_|seller_)/, '');
  const cleanSUid = String(s.user_id || '').replace(/^(user_|usr_|seller_)/, '');
  return cleanId === cleanSId || cleanId === cleanSEco || cleanId === cleanSUid ||
         String(s.id) === String(id) || String(s.ecotrack_id || '') === String(id) || String(s.user_id || '') === String(id);
}

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

// ── Notification Toggle ──
function toggleProfileNotifications(btn) {
  const current = localStorage.getItem('@ecotrack_notifications') !== 'disabled';
  const newState = !current;
  localStorage.setItem('@ecotrack_notifications', newState ? 'enabled' : 'disabled');
  if (btn) {
    btn.className = `btn ${newState ? 'btn-primary' : 'btn-secondary'} scale-hover`;
    btn.innerHTML = `<i class="fas ${newState ? 'fa-bell' : 'fa-bell-slash'}"></i> ${newState ? 'Enabled' : 'Disabled'}`;
  }
  showToast(newState ? '🔔 Notifications enabled!' : '🔕 Notifications disabled.', 'info');
}
window.toggleProfileNotifications = toggleProfileNotifications;

// ── Utility: remove profile avatar in edit modal ──
function removeProfileAvatar() {
  const preview = document.getElementById('editAvatarPreview');
  const icon = document.getElementById('editAvatarIcon');
  const removeBtn = document.getElementById('editAvatarRemoveBtn');
  const urlInput = document.getElementById('editProfileAvatarUrl');
  const fileInput = document.getElementById('editProfileAvatarFile');
  if (preview) { preview.src = ''; preview.style.display = 'none'; }
  if (icon) icon.style.display = '';
  if (removeBtn) removeBtn.style.display = 'none';
  if (urlInput) urlInput.value = '';
  if (fileInput) fileInput.value = '';
}
window.removeProfileAvatar = removeProfileAvatar;

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
window.viewFullReport = (id) => {
  if (!id) { showToast('Scan report not available.', 'error'); return; }
  window.location.href = `aiscanner.html?reportId=${id}`;
};

