const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'ecotrack_social.db');

let db = null;

function getSocialDB() {
  if (db) return db;
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Programmatic migration check: check if foreign keys are active on Pets
  try {
    const fkList = db.prepare("PRAGMA foreign_key_list(Pets)").all();
    if (fkList.length === 0) {
      console.log("⚠️ Old schema detected (missing foreign keys on Pets). Dropping tables to rebuild...");
      const tables = [
        'Pets', 'Followers', 'Messages', 'Conversations', 'Notifications', 
        'SavedPosts', 'Achievements', 'EnvironmentalImpact', 'ActivityHistory', 
        'PortfolioItems', 'UserAnalytics', 'AIScannerReports', 'AITrainerLogs', 
        'BlockedUsers', 'CartItems', 'MarketplaceOrders', 'MarketplaceListings', 
        'EncyclopediaBookmarks', 'EventRegistrations', 'AITrainerPrograms', 
        'UserSettings', 'SearchHistory', 'UploadedMedia', 'Appointments', 
        'Services', 'FullScans', 'Profiles', 'Posts', 'Likes', 'Comments', 
        'Replies', 'CommentLikes', 'Users'
      ];
      for (const table of tables) {
        db.exec(`DROP TABLE IF EXISTS ${table}`);
      }
      console.log("✅ Outdated tables dropped successfully.");
    }
  } catch (err) {
    console.warn("⚠️ Schema migration check error:", err.message);
  }

  initTables(db);
  seedInitialData(db);
  ensureUsersInSQLite(db);

  return db;
}

function initTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS Users (
      id TEXT PRIMARY KEY,
      ecotrack_id TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Profiles (
      user_id TEXT PRIMARY KEY,
      display_name TEXT,
      ecotrack_id TEXT,
      avatar_url TEXT,
      cover_url TEXT,
      bio TEXT,
      country TEXT,
      city TEXT,
      languages TEXT,
      interests TEXT,
      favorite_species TEXT,
      vet_status INTEGER DEFAULT 0,
      vet_verification TEXT,
      trainer_certs TEXT,
      rescue_org_membership TEXT,
      social_links TEXT,
      website TEXT,
      education TEXT,
      experience TEXT,
      volunteer_work TEXT,
      skills TEXT,
      personal_info TEXT,
      privacy_setting TEXT DEFAULT 'Public',
      reputation_score INTEGER DEFAULT 120,
      profile_completion_pct INTEGER DEFAULT 85,
      pinned_post_id INTEGER,
      profession TEXT,
      organization TEXT,
      FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      content TEXT,
      media_urls TEXT,
      media_types TEXT,
      post_type TEXT DEFAULT 'general',
      training_achievement TEXT,
      scanner_report TEXT,
      encyclopedia_discovery TEXT,
      event_participation TEXT,
      marketplace_purchase TEXT,
      rescued_animal TEXT,
      certificate TEXT,
      environmental_milestones TEXT,
      privacy_visibility TEXT DEFAULT 'Public',
      location_tag TEXT,
      animal_tag TEXT,
      hashtags TEXT,
      is_pinned INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_edited INTEGER DEFAULT 0,
      FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      post_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, post_id),
      FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE,
      FOREIGN KEY(post_id) REFERENCES Posts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      text TEXT NOT NULL,
      media_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_edited INTEGER DEFAULT 0,
      FOREIGN KEY(post_id) REFERENCES Posts(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      comment_id INTEGER NOT NULL,
      post_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      parent_reply_id INTEGER,
      text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_edited INTEGER DEFAULT 0,
      FOREIGN KEY(comment_id) REFERENCES Comments(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS CommentLikes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      target_type TEXT NOT NULL, -- 'comment' or 'reply'
      target_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, target_type, target_id),
      FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Followers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      follower_id TEXT NOT NULL,
      following_id TEXT NOT NULL,
      status TEXT DEFAULT 'Approved', -- 'Approved' or 'Pending'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(follower_id, following_id),
      FOREIGN KEY(follower_id) REFERENCES Users(id) ON DELETE CASCADE,
      FOREIGN KEY(following_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id TEXT NOT NULL,
      receiver_id TEXT NOT NULL,
      text TEXT,
      media_url TEXT,
      media_type TEXT,
      voice_note_url TEXT,
      document_url TEXT,
      is_delivered INTEGER DEFAULT 1,
      is_seen INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(sender_id) REFERENCES Users(id) ON DELETE CASCADE,
      FOREIGN KEY(receiver_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      partner_id TEXT NOT NULL,
      is_pinned INTEGER DEFAULT 0,
      is_archived INTEGER DEFAULT 0,
      last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, partner_id),
      FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE,
      FOREIGN KEY(partner_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      type TEXT NOT NULL, -- 'like', 'comment', 'reply', 'follow', 'mention', 'message', 'profile_visit'
      target_id INTEGER,
      target_type TEXT,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(recipient_id) REFERENCES Users(id) ON DELETE CASCADE,
      FOREIGN KEY(actor_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS SavedPosts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      post_id INTEGER NOT NULL,
      collection_name TEXT DEFAULT 'Default',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, post_id),
      FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE,
      FOREIGN KEY(post_id) REFERENCES Posts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      badge_code TEXT NOT NULL,
      badge_name TEXT NOT NULL,
      icon TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, badge_code),
      FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS EnvironmentalImpact (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      activity_type TEXT NOT NULL,
      title TEXT NOT NULL,
      impact_value REAL NOT NULL,
      unit TEXT NOT NULL,
      metric_category TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reference_id TEXT,
      FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ActivityHistory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      activity_type TEXT NOT NULL,
      description TEXT NOT NULL,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Pets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      species TEXT NOT NULL,
      breed TEXT,
      age TEXT,
      weight TEXT,
      diet TEXT,
      images TEXT,
      medical_history TEXT,
      vaccination_records TEXT,
      scanner_reports TEXT,
      training_progress TEXT,
      achievements TEXT,
      milestones TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(owner_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS PortfolioItems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL, -- 'certification', 'course', 'license', 'membership', 'project', 'paper', 'award', 'volunteer', 'campaign'
      title TEXT NOT NULL,
      issuer_org TEXT,
      issue_date TEXT,
      credential_id TEXT,
      credential_url TEXT,
      description TEXT,
      media_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS UserAnalytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      metric_key TEXT NOT NULL,
      metric_value REAL NOT NULL,
      recorded_date TEXT DEFAULT CURRENT_DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS AIScannerReports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      species_detected TEXT NOT NULL,
      confidence REAL NOT NULL,
      scan_image TEXT,
      injuries_notes TEXT,
      posture_analysis TEXT,
      recommendations TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS AITrainerLogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      plan_name TEXT NOT NULL,
      exercise_name TEXT NOT NULL,
      duration_minutes INTEGER DEFAULT 0,
      xp_earned INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS BlockedUsers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      blocker_id TEXT NOT NULL,
      blocked_id TEXT NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(blocker_id, blocked_id),
      FOREIGN KEY(blocker_id) REFERENCES Users(id) ON DELETE CASCADE,
      FOREIGN KEY(blocked_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS CartItems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      product_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      price REAL NOT NULL,
      qty INTEGER DEFAULT 1,
      image TEXT,
      category TEXT,
      saved_for_later INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS MarketplaceOrders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      items_json TEXT NOT NULL,
      total_price REAL NOT NULL,
      status TEXT DEFAULT 'Confirmed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS MarketplaceListings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      price REAL NOT NULL,
      description TEXT,
      image TEXT,
      category TEXT,
      type TEXT DEFAULT 'sale',
      location TEXT,
      breed TEXT,
      age TEXT,
      vaccinated INTEGER DEFAULT 0,
      specs_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS EncyclopediaBookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      species_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, species_id),
      FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS EventRegistrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      ticket_id TEXT UNIQUE,
      registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(event_id, user_id),
      FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS AITrainerPrograms (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      species TEXT,
      breed TEXT,
      goal TEXT,
      is_active INTEGER DEFAULT 1,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      progress_json TEXT,
      FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS UserSettings (
      user_id TEXT PRIMARY KEY,
      theme TEXT DEFAULT 'light',
      email_notifications INTEGER DEFAULT 1,
      push_notifications INTEGER DEFAULT 1,
      privacy_profile TEXT DEFAULT 'Public',
      FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS SearchHistory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      query TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS UploadedMedia (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      file_url TEXT NOT NULL,
      file_type TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Appointments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      center_name TEXT NOT NULL,
      pet_info TEXT,
      phone TEXT,
      date TEXT,
      time TEXT,
      urgency TEXT,
      notes TEXT,
      status TEXT DEFAULT 'Active',
      cancelled_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      type TEXT,
      description TEXT,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS FullScans (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      detected_species TEXT,
      detected_breed TEXT,
      detection_confidence REAL,
      analysis_source TEXT,
      is_full_body_visible INTEGER,
      bounding_box TEXT,
      keypoints TEXT,
      joint_angles TEXT,
      joint_statuses TEXT,
      form_score REAL,
      posture_score REAL,
      balance_score REAL,
      reps_completed INTEGER,
      grade TEXT,
      exercise_name TEXT,
      exercise_id TEXT,
      feedback TEXT,
      FOREIGN KEY(user_id) REFERENCES Users(id) ON DELETE CASCADE
    );

    -- Indices for high performance
    CREATE INDEX IF NOT EXISTS idx_posts_user ON Posts(user_id);
    CREATE INDEX IF NOT EXISTS idx_likes_post ON Likes(post_id);
    CREATE INDEX IF NOT EXISTS idx_comments_post ON Comments(post_id);
    CREATE INDEX IF NOT EXISTS idx_replies_comment ON Replies(comment_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON Messages(sender_id, receiver_id);
    CREATE INDEX IF NOT EXISTS idx_impact_user ON EnvironmentalImpact(user_id);
    CREATE INDEX IF NOT EXISTS idx_pets_owner ON Pets(owner_id);
    CREATE INDEX IF NOT EXISTS idx_portfolio_user ON PortfolioItems(user_id);
    CREATE INDEX IF NOT EXISTS idx_scanner_reports ON AIScannerReports(user_id);
    CREATE INDEX IF NOT EXISTS idx_trainer_logs ON AITrainerLogs(user_id);
    CREATE INDEX IF NOT EXISTS idx_cart_user ON CartItems(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_user ON MarketplaceOrders(user_id);
    CREATE INDEX IF NOT EXISTS idx_listings_user ON MarketplaceListings(user_id);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON EncyclopediaBookmarks(user_id);
    CREATE INDEX IF NOT EXISTS idx_event_reg ON EventRegistrations(user_id);
    CREATE INDEX IF NOT EXISTS idx_programs_user ON AITrainerPrograms(user_id);
    CREATE INDEX IF NOT EXISTS idx_settings_user ON UserSettings(user_id);
    CREATE INDEX IF NOT EXISTS idx_search_user ON SearchHistory(user_id);
    CREATE INDEX IF NOT EXISTS idx_media_user ON UploadedMedia(user_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_user ON Appointments(user_id);
    CREATE INDEX IF NOT EXISTS idx_services_user ON Services(user_id);
    CREATE INDEX IF NOT EXISTS idx_full_scans_user ON FullScans(user_id);
  `);

  // Add profession/organization columns if not present (non-destructive migration)
  try { db.exec(`ALTER TABLE Profiles ADD COLUMN profession TEXT`); } catch (_) {}
  try { db.exec(`ALTER TABLE Profiles ADD COLUMN organization TEXT`); } catch (_) {}
}

function seedInitialData(db) {
  const userCount = db.prepare(`SELECT COUNT(*) as count FROM Users`).get().count;
  if (userCount > 0) return;

  console.log('🌱 Seeding EcoTrack Social SQLite Database...');

  const insertUser = db.prepare(`
    INSERT INTO Users (id, ecotrack_id, email, name, password_hash, role)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertProfile = db.prepare(`
    INSERT INTO Profiles (
      user_id, display_name, ecotrack_id, avatar_url, cover_url, bio, country, city,
      languages, interests, favorite_species, vet_status, vet_verification, trainer_certs,
      rescue_org_membership, social_links, website, education, experience, volunteer_work,
      skills, personal_info, privacy_setting, reputation_score, profile_completion_pct
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);

  const insertPet = db.prepare(`
    INSERT INTO Pets (
      owner_id, name, species, breed, age, weight, diet, images, medical_history,
      vaccination_records, scanner_reports, training_progress, achievements, milestones
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertPost = db.prepare(`
    INSERT INTO Posts (
      user_id, content, media_urls, media_types, post_type, training_achievement,
      scanner_report, encyclopedia_discovery, event_participation, marketplace_purchase,
      rescued_animal, certificate, environmental_milestones, privacy_visibility,
      location_tag, animal_tag, hashtags, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertImpact = db.prepare(`
    INSERT INTO EnvironmentalImpact (user_id, activity_type, title, impact_value, unit, metric_category, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAchievement = db.prepare(`
    INSERT INTO Achievements (user_id, badge_code, badge_name, icon, category, description, unlocked_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Default Users
  const users = [
    {
      id: 'usr1',
      ecotrack_id: 'ECO-948123',
      email: 'user@ecotrack.org',
      name: 'Eco Explorer',
      role: 'admin',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
      cover: 'https://images.unsplash.com/photo-1511497584788-876761c119ef?w=1200',
      bio: 'Nature enthusiast • Wildlife Protection Advocate • EcoTrack Certified Explorer',
      country: 'India', city: 'Bengaluru',
      languages: 'English, Hindi',
      interests: 'Wildlife Conservation, AI Animal Diagnostics, Organic Pets',
      favSpecies: 'Bengal Tiger, Peregrine Falcon',
      vetStatus: 0, vetVerif: '', trainerCerts: 'Basic Animal Handling Certified',
      rescueOrg: 'WildlifeSOS Contributor',
      socialLinks: JSON.stringify({ twitter: '@eco_explorer', github: 'ecoexplorer' }),
      website: 'https://ecotrack.org/explorers/eco',
      education: 'B.Sc. Environmental Science, University of Delhi',
      experience: '5 Years Volunteer Field Researcher at Wildlife Protection Society',
      volunteerWork: '120+ Hours Animal Shelter Care & Wildlife Rescue',
      skills: 'AI Species Identification, Emergency Animal Saline Wash, Tracking',
      personalInfo: 'Passionate about digital wildlife preservation and rescue networks.',
      reputation: 340, completion: 92
    },
    {
      id: 'usr_user1',
      ecotrack_id: 'VET-882104',
      email: 'user1@ecotrack.org',
      name: 'Alice Green',
      role: 'user',
      avatar: 'https://randomuser.me/api/portraits/women/45.jpg',
      cover: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=1200',
      bio: 'Professional Veterinarian & Pet Welfare Volunteer',
      country: 'India', city: 'Chennai',
      languages: 'English, Tamil, Hindi',
      interests: 'Small Animal Surgery, Vet Diagnostics, Stray Vaccination Campaigns',
      favSpecies: 'Peregrine Falcon, German Shepherd',
      vetStatus: 1, vetVerif: 'VERIFIED_VET_LIC_99812', trainerCerts: 'Certified Vet Surgeon (BVSc & AH)',
      rescueOrg: 'Chennai Stray Care NGO',
      socialLinks: JSON.stringify({ linkedin: 'alicegreen' }),
      website: 'https://chennaivetcare.com',
      education: 'M.V.Sc. Veterinary Surgery, Madras Veterinary College',
      experience: '12 Years Senior Veterinary Surgeon & Wild Care Specialist',
      volunteerWork: 'Free Monthly Vaccination Drives for Stray Canines',
      skills: 'Surgical Treatment, Vaccine Protocols, AI Pose Diagnostics',
      personalInfo: 'Dedicated to providing top-tier medical assistance to animals everywhere.',
      reputation: 980, completion: 100
    },
    {
      id: 'usr_user2',
      ecotrack_id: 'RGR-302194',
      email: 'user2@ecotrack.org',
      name: 'Bob Forester',
      role: 'user',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
      cover: 'https://images.unsplash.com/photo-1511497584788-876761c119ef?w=1200',
      bio: 'Wildlife Conservationist & Forest Ranger',
      country: 'India', city: 'Coimbatore',
      languages: 'English, Tamil',
      interests: 'Wildlife Conservation, Forest Patrol, Rescue Tracking',
      favSpecies: 'Bengal Tiger, Elephant',
      vetStatus: 0, vetVerif: '', trainerCerts: 'Certified Forest Ranger',
      rescueOrg: 'Western Ghats Rescue NGO',
      socialLinks: JSON.stringify({ twitter: '@bob_ranger' }),
      website: 'https://westernghatsrescue.org',
      education: 'B.Sc. Forestry, Tamil Nadu Agricultural University',
      experience: '8 Years Wildlife Ranger and Tracker',
      volunteerWork: '500+ Hours Wild Animal Tracking & Rehab Support',
      skills: 'Forest Navigation, Species ID, Wildlife First Aid',
      personalInfo: 'Committed to safeguarding Western Ghats biodiversity and ecosystems.',
      reputation: 750, completion: 94
    },
    {
      id: 'usr_user3',
      ecotrack_id: 'TRN-441209',
      email: 'user3@ecotrack.org',
      name: 'Charlie Eco',
      role: 'user',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200',
      cover: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=1200',
      bio: 'Master Canine Agility Coach & Behaviorist',
      country: 'India', city: 'Chennai',
      languages: 'English, Hindi',
      interests: 'Pet Obedience, Canine Agility, Rescue Rehab',
      favSpecies: 'German Shepherd, Labrador',
      vetStatus: 0, vetVerif: '', trainerCerts: 'Certified Agility Coach, PDT-KA',
      rescueOrg: 'EcoTrack Welfare Grounds',
      socialLinks: JSON.stringify({ instagram: '@charlie_dogs' }),
      website: 'https://charliedogtraining.com',
      education: 'B.Sc. Animal Behavior, University of Madras',
      experience: '6 Years Professional Dog Trainer',
      volunteerWork: 'Trains shelter dogs to improve adoption readiness',
      skills: 'Leash Training, Obedience, Agility Course Design',
      personalInfo: 'Unlocking pet potential through positive training methods.',
      reputation: 670, completion: 95
    }
  ];

  for (const u of users) {
    const pass = u.email === 'user@ecotrack.org' ? 'demo' : 'password123';
    insertUser.run(u.id, u.ecotrack_id, u.email, u.name, pass, u.role);
    insertProfile.run(
      u.id, u.name, u.ecotrack_id, u.avatar, u.cover, u.bio, u.country, u.city,
      u.languages, u.interests, u.favSpecies, u.vetStatus, u.vetVerif, u.trainerCerts,
      u.rescueOrg, u.socialLinks, u.website, u.education, u.experience, u.volunteerWork,
      u.skills, u.personalInfo, 'Public', u.reputation, u.completion
    );
  }

  // Seed Pets for usr1 & usr_ananya
  insertPet.run(
    'usr1', 'Shadow', 'Canis lupus familiaris', 'German Shepherd', '3 Years', '32 kg',
    'High protein kibble + raw beef topper (2 cups twice daily)',
    JSON.stringify(['https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?w=600']),
    JSON.stringify([
      { date: '2026-01-15', title: 'Annual Wellness Check', notes: 'All vitals healthy. Weight optimal.' },
      { date: '2025-06-10', title: 'Minor Paw Scrap', notes: 'Flushed with saline, healed completely.' }
    ]),
    JSON.stringify([
      { vaccine: 'DHPP Booster', date: '2026-02-01', nextDue: '2027-02-01', clinic: 'Mumbai Vet Care' },
      { vaccine: 'Rabies Anti-Viral', date: '2025-09-14', nextDue: '2026-09-14', clinic: 'Mumbai Vet Care' }
    ]),
    JSON.stringify([
      { date: '2026-03-12', result: '99.4% German Shepherd', notes: 'AI Body Condition Index: 5/9 (Ideal)' }
    ]),
    JSON.stringify({ recallSpeed: '98%', agilityLevel: 'Advanced Phase 3' }),
    JSON.stringify(['🏆 Master Agility Runner 2026', '🛡️ Fully Vaccinated Shield']),
    JSON.stringify([{ title: 'Learned Emergency Stop Command', date: '2026-04-10' }])
  );

  insertPet.run(
    'usr1', 'Luna', 'Felis catus', 'Persian Cat', '2 Years', '4.2 kg',
    'Wet Salmon Pate + Kidney Support Formula',
    JSON.stringify(['https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=600']),
    JSON.stringify([{ date: '2026-02-20', title: 'Dental Polish', notes: 'Cleaned mild tartar.' }]),
    JSON.stringify([{ vaccine: 'FVRCP Vaccine', date: '2025-11-10', nextDue: '2026-11-10', clinic: 'Vet Hub' }]),
    JSON.stringify([]),
    JSON.stringify({ agilityLevel: 'Indoor Calm' }),
    JSON.stringify(['🐈 Fluff Royalty']),
    JSON.stringify([{ title: 'Mastered Scratching Post Use', date: '2025-12-01' }])
  );

  // Seed Pets for usr_user3 (Charlie Eco)
  insertPet.run(
    'usr_user3', 'Rocky', 'Canis lupus familiaris', 'German Shepherd', '2 Years', '30 kg',
    'Premium Dry Kibble + Salmon Oil',
    JSON.stringify(['https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=600']),
    JSON.stringify([{ date: '2026-05-12', title: 'Vaccination Appointment', notes: 'Administered Rabies and DHPP boosters.' }]),
    JSON.stringify([{ vaccine: 'DHPP Booster', date: '2026-05-12', nextDue: '2027-05-12', clinic: 'Chennai Vet Center' }]),
    JSON.stringify([]),
    JSON.stringify({ agilityScore: '85%' }),
    JSON.stringify(['🏆 Beginner Agility Award']),
    JSON.stringify([])
  );

  // Seed Pets for usr_user1 (Alice Green)
  insertPet.run(
    'usr_user1', 'Bella', 'Felis catus', 'Siamese Cat', '1 Year', '3.5 kg',
    'High-protein wet food',
    JSON.stringify(['https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=600']),
    JSON.stringify([]),
    JSON.stringify([]),
    JSON.stringify([]),
    JSON.stringify({}),
    JSON.stringify([]),
    JSON.stringify([])
  );

  // Seed Dynamic Environmental Impact Records (Zero hardcoded values!)
  insertImpact.run('usr1', 'co2_saved', 'CO2 Reduction via Eco Recycled Purchases', 120.5, 'kg', 'Environmental', '2026-04-01');
  insertImpact.run('usr1', 'trees_planted', 'Trees Planted via EcoTrack Campaign', 15.0, 'trees', 'Conservation', '2026-05-10');
  insertImpact.run('usr1', 'rescues', 'Rescued Animals Assisted', 8.0, 'animals', 'Animal Welfare', '2026-06-12');
  insertImpact.run('usr1', 'trainings', 'Completed Pet Training Sessions', 24.0, 'sessions', 'Training', '2026-07-01');
  insertImpact.run('usr1', 'scanner', 'Verified AI Scanner Detections', 45.0, 'analyses', 'AI Technology', '2026-07-15');
  insertImpact.run('usr1', 'volunteer', 'Community Animal Shelter Hours', 38.0, 'hours', 'Volunteer Work', '2026-08-01');

  // Seed Dynamic Environmental Impact Records for usr_user1 (Alice Green)
  insertImpact.run('usr_user1', 'rescues', 'Rescued Animals Assisted', 24.0, 'animals', 'Animal Welfare', '2026-06-12');
  insertImpact.run('usr_user1', 'trainings', 'Completed Pet Training Sessions', 3.0, 'sessions', 'Training', '2026-07-01');
  insertImpact.run('usr_user1', 'scanner', 'Verified AI Scanner Detections', 14.0, 'analyses', 'AI Technology', '2026-07-15');

  // Seed Dynamic Environmental Impact Records for usr_user2 (Bob Forester)
  insertImpact.run('usr_user2', 'rescues', 'Rescued Animals Assisted', 48.0, 'animals', 'Animal Welfare', '2026-06-12');
  insertImpact.run('usr_user2', 'trainings', 'Completed Pet Training Sessions', 8.0, 'sessions', 'Training', '2026-07-01');
  insertImpact.run('usr_user2', 'scanner', 'Verified AI Scanner Detections', 22.0, 'analyses', 'AI Technology', '2026-07-15');

  // Seed Dynamic Environmental Impact Records for usr_user3 (Charlie Eco)
  insertImpact.run('usr_user3', 'rescues', 'Rescued Animals Assisted', 12.0, 'animals', 'Animal Welfare', '2026-06-12');
  insertImpact.run('usr_user3', 'trainings', 'Completed Pet Training Sessions', 2.0, 'sessions', 'Training', '2026-07-01');
  insertImpact.run('usr_user3', 'scanner', 'Verified AI Scanner Detections', 5.0, 'analyses', 'AI Technology', '2026-07-15');

  // Seed Dynamic Achievements
  insertAchievement.run('usr1', 'RESCUE_HERO_1', 'Rescue Guardian', '🛡️', 'Welfare', 'Assisted 5+ animal rescues in your community', '2026-06-12');
  insertAchievement.run('usr1', 'AI_SCANNER_PRO', 'AI Bio Scanner Expert', '🧠', 'Technology', 'Performed 40+ accurate AI species analyses', '2026-07-15');
  insertAchievement.run('usr1', 'GREEN_CHAMPION', 'Carbon Reducer', '🌿', 'Eco', 'Saved over 100 kg of CO2 through eco activities', '2026-04-01');
  insertAchievement.run('usr1', 'MASTER_TRAINER', 'Agility Master', '🏆', 'Training', 'Completed 20+ training modules with pets', '2026-07-01');

  // Seed Dynamic Achievements for usr_user3 (Charlie Eco)
  insertAchievement.run('usr_user3', 'MASTER_TRAINER', 'Agility Master', '🏆', 'Training', 'Completed training modules with pets', '2026-07-01');
  insertAchievement.run('usr_user3', 'RESCUE_HERO_1', 'Rescue Guardian', '🛡️', 'Welfare', 'Assisted rescues in your community', '2026-06-12');

  // Seed Sample Posts
  const now = new Date();
  insertPost.run(
    'usr_user1',
    '🦅 **Wildlife Protection Guide**: When observing nesting birds of prey or wild fauna, maintain a distance of at least 50 meters. Avoid loud noises that disturb territorial parents during brooding season. Feel free to ask any species observation questions below!',
    JSON.stringify(['https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=1000']),
    JSON.stringify(['image']),
    'general',
    null,
    JSON.stringify({ species: 'German Shepherd', confidence: '99.4% Match', notes: 'Verified by EcoTrack AI Identification Engine' }),
    null, null, null, null, null, null,
    'Public', 'Mumbai Reserve', 'Canis lupus familiaris', '#WildlifeProtection #PetCare #EcoTrack',
    new Date(now - 7200000).toISOString()
  );

  insertPost.run(
    'usr_user3',
    '🏆 **Training Tip of the Day**: Consistent positive reinforcement during recall drills improves response speed by over 300%! Always reward with high-value treats within 1.5 seconds of execution. Check out Shadow\'s agility progress below!',
    JSON.stringify(['https://images.unsplash.com/photo-1534361960057-19889db9621e?w=1000']),
    JSON.stringify(['image']),
    'training',
    JSON.stringify({ planTitle: 'Advanced Recall Drill Phase 3', completionRate: '100%', xpEarned: 250 }),
    null, null, null, null, null, null, null,
    'Public', 'Austin Training Grounds', 'German Shepherd', '#DogTraining #AgilityCoach #PositiveReinforcement',
    new Date(now - 14400000).toISOString()
  );

  insertPost.run(
    'usr1',
    '🌱 **Wildlife Protection Update**: Successfully observed and documented a juvenile Peregrine Falcon in the wild with @dr_ananya! AI Scanner verified 99.8% species accuracy. Thank you to everyone supporting our community conservation drives! 🦅',
    JSON.stringify(['https://images.unsplash.com/photo-1611001716885-b3402558a62b?w=1000']),
    JSON.stringify(['image']),
    'rescue',
    null,
    JSON.stringify({ species: 'Peregrine Falcon (Falco peregrinus)', confidence: '99.8%', status: 'Documented' }),
    JSON.stringify({ tsn: 175404, common_name: 'Peregrine Falcon', speed: '389 km/h (Fastest animal on Earth)' }),
    null, null,
    JSON.stringify({ tag: 'RES-8891', animalName: 'Falcon Sky', location: 'Western Ghats Sanctuary' }),
    JSON.stringify({ title: 'Wildlife Rehabilitation Hero Certificate', issuer: 'EcoTrack Wildlife Board' }),
    JSON.stringify({ treesPlanted: 5, co2Saved: '15kg' }),
    'Public', 'Bengaluru Wildlife Reserve', 'Peregrine Falcon', '#WildlifeProtection #Falcon #EcoTrackHeroes',
    new Date(now - 28800000).toISOString()
  );

  // Seed Likes & Comments
  db.prepare(`INSERT OR IGNORE INTO Likes (user_id, post_id) VALUES ('usr1', 1)`).run();
  db.prepare(`INSERT OR IGNORE INTO Likes (user_id, post_id) VALUES ('usr_user3', 1)`).run();
  db.prepare(`INSERT OR IGNORE INTO Likes (user_id, post_id) VALUES ('usr1', 2)`).run();
  db.prepare(`INSERT OR IGNORE INTO Likes (user_id, post_id) VALUES ('usr_user1', 3)`).run();

  const c1 = db.prepare(`INSERT INTO Comments (post_id, user_id, text) VALUES (1, 'usr1', 'Thank you Dr. Ananya! Great advice on keeping a safe distance during bird nesting season.')`).run();
  db.prepare(`INSERT INTO Replies (comment_id, post_id, user_id, text) VALUES (?, 1, 'usr_user1', 'Always happy to share conservation tips for animal safety!')`).run(c1.lastInsertRowid);

  // Seed default marketplace items
  const listingCount = db.prepare(`SELECT COUNT(*) as count FROM MarketplaceListings`).get().count;
  if (listingCount === 0) {
    console.log('🌱 Seeding marketplace listings in SQLite...');
    const insertListing = db.prepare(`
      INSERT INTO MarketplaceListings (id, user_id, title, price, description, image, category, type, location, breed, age, vaccinated, specs_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertListing.run(101, 'usr_user1', 'Purebred German Shepherd Pup', 15000, 'AKC-line purebred with full vaccination certificate. Health tested parents.', 'https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?w=600', 'Pets', 'sale', 'Chennai', 'German Shepherd', '8 weeks', 1, JSON.stringify({ color: 'Black & Tan', weight: '3.2 kg' }));
    insertListing.run(102, 'usr_user2', 'Orthopedic Memory Foam Pet Bed', 1499, 'High-density memory foam with waterproof cover. Suitable for dogs up to 30kg.', 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=400', 'Accessories', 'accessory', 'Bangalore', null, null, 0, JSON.stringify({ size: '90×70cm', material: 'Memory foam', washable: true }));
    insertListing.run(103, 'usr_user3', 'Premium Bird Cage (Large)', 3500, 'Powder-coated steel cage with multiple perches, feeding stations and pull-out tray.', 'https://images.unsplash.com/photo-1549737221-bef65e2604a6?w=400', 'Housing', 'accessory', 'Mumbai', null, null, 0, JSON.stringify({ dimensions: '80×60×120cm', bars: 'Non-toxic coating', suitable_for: 'Parrots, Cockatiels, Macaws' }));
    insertListing.run(104, 'usr_user1', 'Golden Retriever (Adoption)', 0, 'Rescued Golden Retriever. Neutered, vaccinated, socialized. Needs a loving home.', 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=400', 'Pets', 'adoption', 'Hyderabad', 'Golden Retriever', '2 years', 1, JSON.stringify({ color: 'Golden', weight: '28 kg' }));
  }

  console.log('✅ EcoTrack Social Database successfully seeded with full relational records.');
}

function ensureUsersInSQLite(db) {
  const targetUsers = [
    { id: 'usr1', ecotrack_id: 'ECO-948123', email: 'user@ecotrack.org', name: 'Eco Explorer', role: 'admin', pass: 'demo' },
    { id: 'usr_user1', ecotrack_id: 'VET-882104', email: 'user1@ecotrack.org', name: 'Alice Green', role: 'user', pass: 'password123' },
    { id: 'usr_user2', ecotrack_id: 'RGR-302194', email: 'user2@ecotrack.org', name: 'Bob Forester', role: 'user', pass: 'password123' },
    { id: 'usr_user3', ecotrack_id: 'TRN-441209', email: 'user3@ecotrack.org', name: 'Charlie Eco', role: 'user', pass: 'password123' }
  ];

  for (const u of targetUsers) {
    const existing = db.prepare(`SELECT id FROM Users WHERE email = ?`).get(u.email);
    if (!existing) {
      db.prepare(`INSERT INTO Users (id, ecotrack_id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)`).run(u.id, u.ecotrack_id, u.email, u.name, u.pass, u.role);
    } else {
      // Force align ID and core fields if mismatch
      if (existing.id !== u.id) {
        console.log(`[SQLite] Re-aligning ID for ${u.email}: ${existing.id} -> ${u.id}`);
        try {
          db.prepare(`UPDATE Users SET id = ?, ecotrack_id = ?, name = ?, password_hash = ?, role = ? WHERE email = ?`).run(u.id, u.ecotrack_id, u.name, u.pass, u.role, u.email);
          // Update foreign keys in other tables
          const tables = ['Profiles', 'Posts', 'Pets', 'Likes', 'Comments', 'SavedPosts', 'Achievements', 'EnvironmentalImpact', 'Followers', 'FullScans', 'AITrainerPrograms'];
          tables.forEach(t => {
            const col = (t === 'Pets') ? 'owner_id' : (t === 'Followers' ? 'follower_id' : 'user_id');
            try { db.prepare(`UPDATE ${t} SET ${col} = ? WHERE ${col} = ?`).run(u.id, existing.id); } catch(e){}
            if (t === 'Followers') {
              try { db.prepare(`UPDATE Followers SET following_id = ? WHERE following_id = ?`).run(u.id, existing.id); } catch(e){}
            }
          });
        } catch (err) { console.error(`[SQLite] Migration failed for ${u.email}:`, err.message); }
      }
    }
    // Ensure Profile exists for these core users
    const profileExists = db.prepare(`SELECT 1 FROM Profiles WHERE user_id = ?`).get(u.id);
    if (!profileExists) {
      db.prepare(`INSERT INTO Profiles (user_id, display_name, ecotrack_id, bio, reputation_score) VALUES (?, ?, ?, ?, 120)`).run(u.id, u.name, u.ecotrack_id, 'EcoTrack member • Wildlife enthusiast');
    }
  }
}

module.exports = {
  getSocialDB
};
