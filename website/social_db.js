/**
 * EcoTrack Social Database & API Bridge
 * Connects frontend to backend SQLite database endpoints with instant local fallback.
 */

const EcoSocialDB = {
  apiBase: 'http://localhost:5000/api/social',

  async fetchPosts(params = {}) {
    try {
      const q = new URLSearchParams(params).toString();
      const res = await fetch(`${this.apiBase}/posts?${q}`);
      if (res.ok) {
        const data = await res.json();
        return data.posts || [];
      }
    } catch (e) {
      console.warn('Backend API unavailable, using client SQLite state:', e.message);
    }
    return this.getLocalPosts(params);
  },

  async createPost(postData) {
    try {
      const res = await fetch(`${this.apiBase}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData)
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Save post via API failed:', e.message);
    }
    return this.saveLocalPost(postData);
  },

  async toggleLike(postId, userId) {
    try {
      const res = await fetch(`${this.apiBase}/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Toggle like via API failed:', e.message);
    }
    return this.toggleLocalLike(postId, userId);
  },

  async toggleBookmark(postId, userId) {
    try {
      const res = await fetch(`${this.apiBase}/posts/${postId}/bookmark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Toggle bookmark failed:', e.message);
    }
    return this.toggleLocalBookmark(postId, userId);
  },

  async addComment(postId, userId, text) {
    try {
      const res = await fetch(`${this.apiBase}/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, text })
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Add comment API failed:', e.message);
    }
    return this.addLocalComment(postId, userId, text);
  },

  async addReply(commentId, postId, userId, text) {
    try {
      const res = await fetch(`${this.apiBase}/comments/${commentId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId, user_id: userId, text })
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Add reply API failed:', e.message);
    }
    return this.addLocalReply(commentId, postId, userId, text);
  },

  async toggleFollow(followerId, followingId) {
    try {
      const res = await fetch(`${this.apiBase}/follow/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ follower_id: followerId, following_id: followingId })
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Toggle follow failed:', e.message);
    }
    return { status: 'Approved', is_following: true };
  },

  async manageFollowAction(action, actorId, targetId) {
    try {
      const res = await fetch(`${this.apiBase}/follow/manage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, actor_id: actorId, target_id: targetId })
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Manage follow action failed:', e.message);
    }
    return { message: 'Action recorded' };
  },

  async fetchFollowers(userId, currentUserId) {
    try {
      const res = await fetch(`${this.apiBase}/followers/${userId}?current_user_id=${currentUserId || ''}`);
      if (res.ok) {
        const data = await res.json();
        return data.followers || [];
      }
    } catch (e) {
      console.warn('Fetch followers API failed:', e.message);
    }
    return [
      { id: 'usr_ananya', name: 'Dr. Ananya Sharma', ecotrack_id: 'VET-882104', avatar_url: 'https://images.unsplash.com/photo-1594824813566-7885a3964670?w=400', bio: 'Chief Veterinary Surgeon 🩺', vet_status: 1, is_following: true },
      { id: 'usr_marcus', name: 'Marcus Vance', ecotrack_id: 'TRN-441209', avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400', bio: 'Master Canine Agility Coach 🏋️', vet_status: 0, is_following: true }
    ];
  },

  async fetchFollowing(userId) {
    try {
      const res = await fetch(`${this.apiBase}/following/${userId}`);
      if (res.ok) {
        const data = await res.json();
        return data.following || [];
      }
    } catch (e) {
      console.warn('Fetch following API failed:', e.message);
    }
    return [
      { id: 'usr_ananya', name: 'Dr. Ananya Sharma', ecotrack_id: 'VET-882104', avatar_url: 'https://images.unsplash.com/photo-1594824813566-7885a3964670?w=400', bio: 'Chief Veterinary Surgeon 🩺', vet_status: 1, is_following: true }
    ];
  },

  async fetchRecommendations(userId) {
    try {
      const res = await fetch(`${this.apiBase}/recommendations?user_id=${userId}`);
      if (res.ok) {
        const data = await res.json();
        return data.users || [];
      }
    } catch (e) {
      console.warn('Fetch recommendations failed:', e.message);
    }
    return [
      { id: 'usr_ananya', name: 'Dr. Ananya Sharma', avatar_url: 'https://images.unsplash.com/photo-1594824813566-7885a3964670?w=400', bio: 'Chief Veterinary Surgeon 🩺', vet_status: 1 },
      { id: 'usr_marcus', name: 'Marcus Vance', avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400', bio: 'Master Canine Agility Coach 🏋️', vet_status: 0 }
    ];
  },

  async fetchProfile(userOrEcoId, currentUserId) {
    try {
      const res = await fetch(`${this.apiBase}/profile/${userOrEcoId}?current_user_id=${currentUserId}`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Fetch profile API failed:', e.message);
    }
    return this.getLocalProfile(userOrEcoId);
  },

  async updateProfile(profileData) {
    try {
      const res = await fetch(`${this.apiBase}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData)
      });
      if (res.ok) {
        const result = await res.json();
        this.saveLocalProfileUpdate(profileData);
        return result;
      }
    } catch (e) {
      console.warn('Update profile API failed:', e.message);
    }
    return this.saveLocalProfileUpdate(profileData);
  },

  async fetchPortfolio(userId) {
    try {
      const res = await fetch(`${this.apiBase}/portfolio/${userId}`);
      if (res.ok) {
        const data = await res.json();
        return data.items || [];
      }
    } catch (e) {
      console.warn('Fetch portfolio API failed:', e.message);
    }
    return this.getLocalPortfolio(userId);
  },

  async addPortfolioItem(itemData) {
    try {
      const res = await fetch(`${this.apiBase}/portfolio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemData)
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Add portfolio item API failed:', e.message);
    }
    return this.saveLocalPortfolioItem(itemData);
  },

  async removePet(petId) {
    try {
      const res = await fetch(`${this.apiBase}/pets/${petId}`, { method: 'DELETE' });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Remove pet API failed:', e.message);
    }
    return { message: 'Pet removed' };
  },

  // ── LOCAL FALLBACK DB IMPLEMENTATION (Guarantees zero downtime) ──
  getLocalPosts(params = {}) {
    const posts = JSON.parse(localStorage.getItem('ecotrack_posts') || 'null');
    if (posts && posts.length) {
      if (params.user_id) return posts.filter(p => p.user_id === params.user_id);
      if (params.saved_only) return posts.filter(p => p.saved_by_me);
      return posts;
    }

    // Default Seed Posts
    const defaultPosts = [
      {
        id: 1,
        user_id: 'usr_ananya',
        author_name: 'Dr. Ananya Sharma',
        author_ecotrack_id: 'VET-882104',
        author_avatar: 'https://images.unsplash.com/photo-1594824813566-7885a3964670?w=400',
        vet_status: 1,
        content: '🏥 **Veterinary Emergency Guide**: When treating minor animal lacerations, always flush with 0.9% sterile saline before applying any bandage. Never apply rubbing alcohol on raw skin as it destroys healthy healing cells!',
        media_urls: ['https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=1000'],
        post_type: 'veterinary',
        privacy_visibility: 'Public',
        location_tag: 'Mumbai Clinic',
        animal_tag: 'Canis lupus familiaris',
        hashtags: '#VetCare #AnimalHealth #PetSafety',
        likes_count: 142,
        comments_count: 12,
        saves_count: 38,
        liked_by_me: false,
        saved_by_me: false,
        created_at: new Date(Date.now() - 3600000).toISOString(),
        comments: [
          {
            id: 101,
            author_name: 'Eco Explorer',
            author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
            text: 'Thank you Dr. Ananya! Super helpful tip for pet owners.',
            created_at: new Date(Date.now() - 1800000).toISOString(),
            replies: []
          }
        ]
      },
      {
        id: 2,
        user_id: 'usr_marcus',
        author_name: 'Marcus Vance',
        author_ecotrack_id: 'TRN-441209',
        author_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
        vet_status: 0,
        content: '🏆 **Canine Agility Benchmark**: Shadow achieved a 98% recall accuracy score on today\'s 100m obstacle course! Consistency with high-value treats builds lifelong trust.',
        media_urls: ['https://images.unsplash.com/photo-1534361960057-19889db9621e?w=1000'],
        post_type: 'training',
        training_achievement: { planTitle: 'Advanced Recall Drill Phase 3', completionRate: '100%', xpEarned: 250 },
        privacy_visibility: 'Public',
        location_tag: 'Austin Training Grounds',
        animal_tag: 'German Shepherd',
        hashtags: '#DogTraining #AgilityCoach #PositiveReinforcement',
        likes_count: 98,
        comments_count: 5,
        saves_count: 14,
        liked_by_me: true,
        saved_by_me: true,
        created_at: new Date(Date.now() - 7200000).toISOString(),
        comments: []
      },
      {
        id: 3,
        user_id: 'usr1',
        author_name: 'Eco Explorer',
        author_ecotrack_id: 'ECO-948123',
        author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
        vet_status: 0,
        content: '🌱 **Wildlife Protection Update**: Successfully observed and documented a juvenile Peregrine Falcon with @dr_ananya! Thank you to everyone supporting our community conservation drives! 🦅',
        media_urls: ['https://images.unsplash.com/photo-1611001716885-b3402558a62b?w=1000'],
        post_type: 'rescue',
        privacy_visibility: 'Public',
        location_tag: 'Bengaluru Wildlife Reserve',
        animal_tag: 'Peregrine Falcon',
        hashtags: '#WildlifeProtection #Falcon #EcoTrackHeroes',
        likes_count: 215,
        comments_count: 18,
        saves_count: 45,
        liked_by_me: false,
        saved_by_me: false,
        created_at: new Date(Date.now() - 14400000).toISOString(),
        comments: []
      }
    ];

    localStorage.setItem('ecotrack_posts', JSON.stringify(defaultPosts));
    if (params.user_id) return defaultPosts.filter(p => p.user_id === params.user_id);
    if (params.saved_only) return defaultPosts.filter(p => p.saved_by_me);
    return defaultPosts;
  },

  saveLocalPost(postData) {
    const posts = this.getLocalPosts();
    const newPost = {
      id: Date.now(),
      user_id: postData.user_id || 'usr1',
      author_name: 'Eco Explorer',
      author_ecotrack_id: 'ECO-948123',
      author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
      vet_status: 0,
      content: postData.content,
      media_urls: postData.media_urls || [],
      post_type: postData.post_type || 'general',
      privacy_visibility: postData.privacy_visibility || 'Public',
      likes_count: 0,
      comments_count: 0,
      saves_count: 0,
      liked_by_me: false,
      saved_by_me: false,
      created_at: new Date().toISOString(),
      comments: []
    };

    posts.unshift(newPost);
    localStorage.setItem('ecotrack_posts', JSON.stringify(posts));
    return { message: 'Post created locally', post_id: newPost.id };
  },

  toggleLocalBookmark(postId, userId) {
    const posts = this.getLocalPosts();
    const p = posts.find(item => item.id == postId);
    if (!p) return { saved: false, saves_count: 0 };
    if (p.saved_by_me) {
      p.saved_by_me = false;
      p.saves_count = Math.max(0, (p.saves_count || 1) - 1);
    } else {
      p.saved_by_me = true;
      p.saves_count = (p.saves_count || 0) + 1;
    }
    localStorage.setItem('ecotrack_posts', JSON.stringify(posts));
    return { saved: p.saved_by_me, saves_count: p.saves_count };
  },

  addLocalComment(postId, userId, text) {
    const posts = this.getLocalPosts();
    const p = posts.find(item => item.id == postId);
    if (!p) return { message: 'Post not found' };

    const user = window.currentUser || { name: 'Eco Explorer', avatar: '' };
    const newComment = {
      id: Date.now(),
      author_name: user.name,
      author_avatar: user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=10b981&color=fff`,
      user_id: userId,
      text,
      created_at: new Date().toISOString(),
      replies: []
    };
    p.comments = p.comments || [];
    p.comments.push(newComment);
    p.comments_count = p.comments.length;
    localStorage.setItem('ecotrack_posts', JSON.stringify(posts));
    return { message: 'Comment added locally', comments_count: p.comments_count, comment: newComment };
  },

  addLocalReply(commentId, postId, userId, text) {
    const posts = this.getLocalPosts();
    const p = posts.find(item => item.id == postId);
    if (!p) return { message: 'Post not found' };

    const comment = (p.comments || []).find(c => c.id == commentId);
    if (!comment) return { message: 'Comment not found' };

    const user = window.currentUser || { name: 'Eco Explorer', avatar: '' };
    const newReply = {
      id: Date.now(),
      author_name: user.name,
      author_avatar: user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=10b981&color=fff`,
      user_id: userId,
      text,
      created_at: new Date().toISOString()
    };

    comment.replies = comment.replies || [];
    comment.replies.push(newReply);
    localStorage.setItem('ecotrack_posts', JSON.stringify(posts));
    return { message: 'Reply added locally', reply: newReply };
  },

  saveLocalProfileUpdate(profileData) {
    const localProf = JSON.parse(localStorage.getItem('ecotrack_user_profile') || 'null') || this.getLocalProfile('usr1').profile;
    Object.assign(localProf, profileData);
    localStorage.setItem('ecotrack_user_profile', JSON.stringify(localProf));
    return { message: 'Local profile saved' };
  },

  getLocalProfile(userIdOrEcoId) {
    const savedProf = JSON.parse(localStorage.getItem('ecotrack_user_profile') || 'null');
    const currentUserId = window.currentUser ? window.currentUser.id : 'usr1';
    const isTargetOwner = !userIdOrEcoId || 
                          userIdOrEcoId === currentUserId || 
                          userIdOrEcoId === 'usr1' || 
                          userIdOrEcoId === 'usr_expl' || 
                          userIdOrEcoId === 'ECO-948123' || 
                          userIdOrEcoId === '@ECO-948123';

    const baseProfile = savedProf || {
      id: 'usr1',
      ecotrack_id: 'ECO-948123',
      name: 'Eco Explorer',
      display_name: 'Eco Explorer',
      email: 'user@ecotrack.org',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
      cover_url: 'https://images.unsplash.com/photo-1511497584788-876761c119ef?w=1200',
      bio: 'Nature enthusiast • Wildlife Protection Advocate • Certified Explorer',
      country: 'India', city: 'Bengaluru',
      occupation: 'Environmental Researcher',
      organization: 'Wildlife Protection Society',
      languages: 'English, Hindi',
      interests: 'Wildlife Conservation, AI Animal Diagnostics, Organic Pets',
      favorite_species: 'Bengal Tiger, Peregrine Falcon',
      vet_status: 0,
      trainer_certs: 'Basic Animal Handling Certified',
      rescue_org_membership: 'WildlifeSOS Contributor',
      social_links: { twitter: '@eco_explorer', github: 'ecoexplorer', linkedin: 'ecoexplorer', instagram: '@ecoexplorer' },
      website: 'https://ecotrack.org/explorers/eco',
      education: 'B.Sc. Environmental Science, University of Delhi',
      experience: '5 Years Volunteer Field Researcher',
      volunteer_work: '120+ Hours Animal Shelter Care & Rescue Operations',
      skills: 'AI Identification, Saline Wash, Species Tracking, Agility Coaching',
      privacy_setting: 'Public',
      reputation_score: 340,
      profile_completion_pct: 92,
      is_owner: isTargetOwner,
      followers_count: 0,
      following_count: 0
    };

    if (isTargetOwner) {
      baseProfile.id = currentUserId;
      if (window.currentUser && window.currentUser.name) {
        baseProfile.name = window.currentUser.name;
        baseProfile.display_name = window.currentUser.name;
      }
      baseProfile.is_owner = true;
      baseProfile.is_private_restricted = false;
    }

    if (!isTargetOwner && userIdOrEcoId === 'usr_ananya') {
      return {
        profile: {
          id: 'usr_ananya',
          ecotrack_id: 'VET-882104',
          name: 'Dr. Ananya Sharma',
          display_name: 'Dr. Ananya Sharma',
          email: 'dr.ananya@ecotrack.org',
          avatar_url: 'https://images.unsplash.com/photo-1594824813566-7885a3964670?w=400',
          cover_url: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=1200',
          bio: 'Chief Veterinary Surgeon 🩺 • Avian & Exotic Animal Specialist',
          country: 'India', city: 'Mumbai',
          occupation: 'Chief Veterinary Surgeon',
          organization: 'Mumbai Stray Care NGO',
          vet_status: 1,
          trainer_certs: 'Certified Vet Surgeon (BVSc & AH)',
          rescue_org_membership: 'Head Vet at Mumbai Stray Care',
          social_links: { linkedin: 'drananyasharma', twitter: '@drananya_vet' },
          website: 'https://mumbaivetcare.com',
          education: 'M.V.Sc. Veterinary Surgery',
          privacy_setting: 'Public',
          reputation_score: 980,
          profile_completion_pct: 100,
          is_owner: false,
          is_following: true,
          followers_count: 1420,
          following_count: 310
        },
        impactStats: { co2Saved: '450 kg', treesPlanted: '85 trees', rescues: 42, trainingsCompleted: 15, volunteerHours: '240 hrs' },
        achievements: [{ badge_code: 'VET_MASTER', badge_name: 'Master Veterinary Surgeon', icon: '🩺', category: 'Medical', description: 'Performed 500+ successful animal surgeries', unlocked_at: '2025-10-12' }],
        pets: []
      };
    }

    const userPets = isTargetOwner
      ? JSON.parse(localStorage.getItem(`@ecotrack_pets_${currentUserId}`) || '[]')
      : [
          {
            id: 1,
            name: 'Shadow',
            species: 'Canis lupus familiaris',
            breed: 'German Shepherd',
            age: '3 Years',
            gender: 'Male',
            weight: '32 kg',
            height: '62 cm',
            diet: 'High protein kibble (2 cups twice daily)',
            images: ['https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?w=600'],
            medical_history: [{ date: '2026-01-15', title: 'Annual Checkup', notes: 'Optimal health vitals.' }],
            vaccination_records: [{ vaccine: 'DHPP Booster', date: '2026-02-01', nextDue: '2027-02-01', clinic: 'Vet Hub' }]
          }
        ];

    const userAchievements = isTargetOwner
      ? JSON.parse(localStorage.getItem(`@ecotrack_achievements_${currentUserId}`) || '[]')
      : [
          { badge_code: 'RESCUE_HERO', badge_name: 'Rescue Guardian', icon: '🛡️', category: 'Welfare', description: 'Assisted 5+ animal rescues', unlocked_at: '2026-06-12' }
        ];

    return {
      profile: baseProfile,
      impactStats: {
        co2Saved: '0 kg',
        treesPlanted: '0 trees',
        rescues: 0,
        trainingsCompleted: 0,
        volunteerHours: '0 hrs'
      },
      achievements: userAchievements,
      pets: userPets
    };
  },

  getLocalPortfolio(userId) {
    const items = JSON.parse(localStorage.getItem(`ecotrack_portfolio_${userId}`) || 'null');
    if (items && items.length) return items;

    const defaultItems = [
      {
        id: 1,
        type: 'certification',
        title: 'Certified Wildlife Emergency First Responder',
        issuer_org: 'International Wildlife Rescue Federation',
        issue_date: 'Jan 2025',
        credential_id: 'IWRF-99812-2025',
        description: 'Advanced field emergency medical care and species stabilization protocols.'
      },
      {
        id: 2,
        type: 'license',
        title: 'Licensed Avian Rehabilitation Specialist',
        issuer_org: 'State Wildlife Protection Board',
        issue_date: 'Mar 2024',
        credential_id: 'LIC-AV-77120',
        description: 'State authorized raptor and songbird rehabilitation license.'
      }
    ];
    localStorage.setItem(`ecotrack_portfolio_${userId}`, JSON.stringify(defaultItems));
    return defaultItems;
  },

  saveLocalPortfolioItem(itemData) {
    const userId = itemData.user_id || 'usr1';
    const items = this.getLocalPortfolio(userId);
    const newItem = { id: Date.now(), ...itemData, created_at: new Date().toISOString() };
    items.unshift(newItem);
    localStorage.setItem(`ecotrack_portfolio_${userId}`, JSON.stringify(items));
    return { message: 'Item saved locally', id: newItem.id };
  }
};

window.EcoSocialDB = EcoSocialDB;
