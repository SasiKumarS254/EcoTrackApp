const path = require('path');
const fs   = require('fs');
const crypto = require('crypto');
const database = require('./database');
// Universal query â€” routes to Postgres OR local SQLite transparently
const dbQuery = database.query;

let dbInitialized = false;
let dbInitializationPromise = null;

// â”€â”€ UniversalWrapper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Exposes the same .prepare().get/.all/.run API used throughout the codebase
// but dispatches through the dual-mode database layer (Postgres or SQLite).
class UniversalWrapper {
  prepare(sql) {
    // 1. Normalise ? placeholders â†’ $1, $2, â€¦ (Postgres style)
    //    The universal query layer will convert them back for SQLite.
    let index = 0;
    let pgSql = sql.replace(/\?/g, () => { index++; return `$${index}`; });

    // 2. Translate SQLite-specific DML keywords â†’ standard SQL
    if (pgSql.includes('INSERT OR IGNORE INTO')) {
      pgSql = pgSql.replace('INSERT OR IGNORE INTO', 'INSERT INTO') + ' ON CONFLICT DO NOTHING';
    }

    if (pgSql.includes('INSERT OR REPLACE INTO FullScans')) {
      pgSql = pgSql.replace('INSERT OR REPLACE INTO FullScans', 'INSERT INTO FullScans').trim();
      pgSql += ` ON CONFLICT (id) DO UPDATE SET
        user_id = EXCLUDED.user_id, created_at = EXCLUDED.created_at,
        detected_species = EXCLUDED.detected_species, detected_breed = EXCLUDED.detected_breed,
        detection_confidence = EXCLUDED.detection_confidence, analysis_source = EXCLUDED.analysis_source,
        is_full_body_visible = EXCLUDED.is_full_body_visible, bounding_box = EXCLUDED.bounding_box,
        keypoints = EXCLUDED.keypoints, joint_angles = EXCLUDED.joint_angles,
        joint_statuses = EXCLUDED.joint_statuses, form_score = EXCLUDED.form_score,
        posture_score = EXCLUDED.posture_score, balance_score = EXCLUDED.balance_score,
        reps_completed = EXCLUDED.reps_completed, grade = EXCLUDED.grade,
        exercise_name = EXCLUDED.exercise_name, exercise_id = EXCLUDED.exercise_id,
        feedback = EXCLUDED.feedback`;
    } else if (pgSql.includes('INSERT OR REPLACE INTO')) {
      pgSql = pgSql.replace('INSERT OR REPLACE INTO', 'INSERT INTO');
    }

    // 3. Append RETURNING id for INSERTs (allows lastInsertRowid compat)
    const isInsert     = pgSql.trim().toUpperCase().startsWith('INSERT INTO');
    const hasReturning = pgSql.toUpperCase().includes('RETURNING');
    const skipReturn   = pgSql.includes('Profiles') || pgSql.includes('UserSettings');
    if (isInsert && !hasReturning && !skipReturn) pgSql += ' RETURNING id';

    return {
      get:  async (...params) => { const r = await dbQuery(pgSql, params); return r.rows[0] || null; },
      all:  async (...params) => { const r = await dbQuery(pgSql, params); return r.rows; },
      run:  async (...params) => {
        const r = await dbQuery(pgSql, params);
        return { changes: r.rowCount, lastInsertRowid: r.rows[0]?.id || null };
      }
    };
  }

  async exec(sql) { return dbQuery(sql, []); }
}

const dbWrapperInstance = new UniversalWrapper();

dbInitializationPromise = initializeDatabase();

function getSocialDB() { return dbWrapperInstance; }

async function initializeDatabase() {
  // â”€â”€ Step 1: Test cloud connection first; auto-selects SQLite if offline â”€â”€
  await database.testConnection();
  const isSbConnected = database.isSupabaseConnected();
  const offline = database.isUsingLocalSQLite() && !isSbConnected;
  if (isSbConnected) {
    console.log('☁️  Running in Supabase Cloud Mode (HTTPS Synchronized).');
  } else if (offline) {
    console.log('📂 Running in LOCAL SQLite mode (Supabase offline or unreachable).');
  } else {
    console.log('☁️  Running in Supabase PostgreSQL mode.');
  }

  try {
    // â”€â”€ Step 2: Create tables (works in both modes) â”€â”€
    await createTables();
    console.log('ðŸ“Š Database tables verified.');

    // â”€â”€ Step 3: Schema migrations (works in both PG and SQLite) â”€â”€
    const migrations = [
      `ALTER TABLE Profiles ADD COLUMN IF NOT EXISTS dm_privacy_setting TEXT DEFAULT 'Everyone'`,
      `ALTER TABLE Profiles ADD COLUMN IF NOT EXISTS profession TEXT`,
      `ALTER TABLE Profiles ADD COLUMN IF NOT EXISTS organization TEXT`,
      `ALTER TABLE Messages ADD COLUMN IF NOT EXISTS conversation_id TEXT`,
      `ALTER TABLE Messages ADD COLUMN IF NOT EXISTS listing_id TEXT`,
      `ALTER TABLE MarketplaceListings ADD COLUMN IF NOT EXISTS seller_name TEXT`,
      `ALTER TABLE MarketplaceListings ADD COLUMN IF NOT EXISTS seller_avatar TEXT`,
      `ALTER TABLE MarketplaceListings ADD COLUMN IF NOT EXISTS payment_details TEXT`,
      `ALTER TABLE MarketplaceListings ADD COLUMN IF NOT EXISTS species TEXT`,
      `ALTER TABLE MarketplaceListings ADD COLUMN IF NOT EXISTS gender TEXT`,
      `UPDATE MarketplaceListings SET image = 'assets/pet_bed.jpg', category = 'Accessories', seller_name = 'ComfortPaws Pet Supplies' WHERE id = 102`,
      `UPDATE MarketplaceListings SET image = 'assets/bird_cage.jpg', category = 'Housing', seller_name = 'Avian Care World' WHERE id = 103`,
      `UPDATE MarketplaceListings SET image = 'assets/pet_shampoo.jpg', category = 'Supplies', seller_name = 'VetCare Organics' WHERE id = 105`,
      `UPDATE MarketplaceListings SET image = 'assets/dog_tracker.jpg', category = 'Gear', price = 1899, seller_name = 'Rex Gear Official' WHERE id = 106`,
      `UPDATE MarketplaceListings SET seller_name = 'Apex K9 Kennels' WHERE id = 101`,
      `UPDATE MarketplaceListings SET seller_name = 'Golden Haven Sanctuary' WHERE id = 104`,
      `UPDATE MarketplaceListings SET seller_name = 'Paws Rescue Trust' WHERE id = 107`,
      `ALTER TABLE Profiles ADD COLUMN IF NOT EXISTS emergency_helper INTEGER DEFAULT 0`,
      `ALTER TABLE Profiles ADD COLUMN IF NOT EXISTS emergency_phone TEXT`,
    ];
    for (const m of migrations) {
      try {
        if (database.isUsingLocalSQLite()) {
          const sqliteSql = m.replace(/IF NOT EXISTS\s*/gi, '');
          await dbQuery(sqliteSql, []);
        } else {
          await dbQuery(m, []);
        }
      } catch (e) {
        // Ignore duplicate column errors or harmless update warnings
        if (!e.message.includes('duplicate column') && !e.message.includes('already exists')) {
          console.warn('Migration note:', e.message);
        }
      }
    }

    if (!offline) {
      // Seed supplies item 105 if missing
      try {
        const chk = await dbQuery(`SELECT COUNT(*) as count FROM MarketplaceListings WHERE id = 105`, []);
        if (parseInt(chk.rows[0]?.count ?? chk.rows[0]?.COUNT ?? 0, 10) === 0) {
          await dbQuery(`INSERT INTO MarketplaceListings (id,user_id,title,price,description,image,category,type,location,breed,age,vaccinated,specs_json)
            VALUES ($1,'usr_user1','Organic Aloe & Oatmeal Pet Shampoo',499,'Soothing organic shampoo.','/assets/pet_shampoo.jpg','Supplies','accessory','Chennai',null,null,0,$2)
            ON CONFLICT DO NOTHING`,
            [105, JSON.stringify({ volume: '500ml', formula: 'Tear-free, pH-balanced', scent: 'Oatmeal & Honey' })]);
        }
      } catch (e) { console.warn('Seed warning (item 105):', e.message); }
    }

    // â”€â”€ Step 4: Seed initial data â”€â”€
    await seedInitialData();

    // â”€â”€ Step 5: Reset PG sequences (Postgres only) â”€â”€
    if (!database.isUsingLocalSQLite()) {
      try {
        await dbQuery(`SELECT setval(pg_get_serial_sequence('posts','id'), COALESCE(max(id),1)) FROM posts`, []);
        await dbQuery(`SELECT setval(pg_get_serial_sequence('marketplacelistings','id'), COALESCE(max(id),1)) FROM marketplacelistings`, []);
      } catch (e) { console.warn('Sequence reset warning:', e.message); }
    }

    // ── Step 6: Auto-Sync offline database with all historical & userdata.json entries ──
    await syncOfflineDatabase();

    dbInitialized = true;
    console.log(isSbConnected ? '✅ Supabase Cloud database ready & synchronized.' : (offline ? '✅ Local SQLite database ready & synchronized.' : '✅ Supabase database loaded successfully.'));
  } catch (err) {
    console.error('âŒ Database initialization error:', err.message);
    // Do NOT crash â€” server still starts; individual endpoints will return 500s
  }
}

async function createTables() {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS Users (
      id TEXT PRIMARY KEY,
      ecotrack_id TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Profiles (
      user_id TEXT PRIMARY KEY REFERENCES Users(id) ON DELETE CASCADE,
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
      dm_privacy_setting TEXT DEFAULT 'Everyone',
      reputation_score INTEGER DEFAULT 120,
      profile_completion_pct INTEGER DEFAULT 85,
      pinned_post_id INTEGER,
      profession TEXT,
      organization TEXT
    );

    CREATE TABLE IF NOT EXISTS Posts (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_edited INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS Likes (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      post_id INTEGER NOT NULL REFERENCES Posts(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, post_id)
    );

    CREATE TABLE IF NOT EXISTS Comments (
      id SERIAL PRIMARY KEY,
      post_id INTEGER NOT NULL REFERENCES Posts(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      media_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_edited INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS Replies (
      id SERIAL PRIMARY KEY,
      comment_id INTEGER NOT NULL REFERENCES Comments(id) ON DELETE CASCADE,
      post_id INTEGER NOT NULL REFERENCES Posts(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      parent_reply_id INTEGER,
      text TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_edited INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS CommentLikes (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      target_type TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, target_type, target_id)
    );

    CREATE TABLE IF NOT EXISTS Followers (
      id SERIAL PRIMARY KEY,
      follower_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      following_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'Approved',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(follower_id, following_id)
    );

    CREATE TABLE IF NOT EXISTS Messages (
      id SERIAL PRIMARY KEY,
      sender_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      receiver_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      text TEXT,
      media_url TEXT,
      media_type TEXT,
      voice_note_url TEXT,
      document_url TEXT,
      is_delivered INTEGER DEFAULT 1,
      is_seen INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      conversation_id TEXT,
      listing_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Conversations (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      partner_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      is_pinned INTEGER DEFAULT 0,
      is_archived INTEGER DEFAULT 0,
      last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, partner_id)
    );

    CREATE TABLE IF NOT EXISTS Notifications (
      id SERIAL PRIMARY KEY,
      recipient_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      actor_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      target_id INTEGER,
      target_type TEXT,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS BlockedUsers (
      id SERIAL PRIMARY KEY,
      blocker_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      blocked_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(blocker_id, blocked_id)
    );

    CREATE TABLE IF NOT EXISTS SavedPosts (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      post_id INTEGER NOT NULL REFERENCES Posts(id) ON DELETE CASCADE,
      collection_name TEXT DEFAULT 'Default',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, post_id)
    );

    CREATE TABLE IF NOT EXISTS Achievements (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      badge_code TEXT NOT NULL,
      badge_name TEXT NOT NULL,
      icon TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, badge_code)
    );

    CREATE TABLE IF NOT EXISTS EnvironmentalImpact (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      activity_type TEXT NOT NULL,
      title TEXT NOT NULL,
      impact_value REAL NOT NULL,
      unit TEXT NOT NULL,
      metric_category TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      reference_id TEXT
    );

    CREATE TABLE IF NOT EXISTS Pets (
      id TEXT PRIMARY KEY DEFAULT ('pet_' || md5(random()::text)),
      owner_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ActivityHistory (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      activity_type TEXT NOT NULL,
      description TEXT NOT NULL,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS PortfolioItems (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      media_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS UserAnalytics (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      metric_key TEXT NOT NULL,
      metric_value REAL NOT NULL,
      recorded_date DATE DEFAULT CURRENT_DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS AIScannerReports (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      species_detected TEXT NOT NULL,
      confidence REAL NOT NULL,
      scan_image TEXT,
      injuries_notes TEXT,
      posture_analysis TEXT,
      recommendations TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS AITrainerLogs (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      plan_name TEXT NOT NULL,
      exercise_name TEXT NOT NULL,
      duration_minutes INTEGER DEFAULT 0,
      xp_earned INTEGER DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS BlockedUsers (
      id SERIAL PRIMARY KEY,
      blocker_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      blocked_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(blocker_id, blocked_id)
    );

    CREATE TABLE IF NOT EXISTS CartItems (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      price REAL NOT NULL,
      qty INTEGER DEFAULT 1,
      image TEXT,
      category TEXT,
      saved_for_later INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS MarketplaceOrders (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      items_json TEXT NOT NULL,
      total_price REAL NOT NULL,
      status TEXT DEFAULT 'Confirmed',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS MarketplaceListings (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
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
      seller_name TEXT,
      seller_avatar TEXT,
      payment_details TEXT,
      species TEXT,
      gender TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS EncyclopediaBookmarks (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      species_id INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, species_id)
    );

    CREATE TABLE IF NOT EXISTS Events (
      id BIGINT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT,
      date_str TEXT,
      date_iso TEXT,
      location TEXT,
      description TEXT,
      long_description TEXT,
      attendees INTEGER DEFAULT 0,
      max_attendees INTEGER DEFAULT 500,
      image TEXT,
      organizer TEXT,
      creator_id TEXT,
      is_free INTEGER DEFAULT 1,
      price REAL DEFAULT 0,
      refund_policy TEXT,
      coordinates_json TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS EventRegistrations (
      id SERIAL PRIMARY KEY,
      event_id BIGINT NOT NULL,
      user_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      ticket_id TEXT UNIQUE,
      registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(event_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS AITrainerPrograms (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      species TEXT,
      breed TEXT,
      goal TEXT,
      is_active INTEGER DEFAULT 1,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      progress_json TEXT
    );

    CREATE TABLE IF NOT EXISTS UserSettings (
      user_id TEXT PRIMARY KEY REFERENCES Users(id) ON DELETE CASCADE,
      theme TEXT DEFAULT 'light',
      email_notifications INTEGER DEFAULT 1,
      push_notifications INTEGER DEFAULT 1,
      privacy_profile TEXT DEFAULT 'Public'
    );

    CREATE TABLE IF NOT EXISTS SearchHistory (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      query TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS UploadedMedia (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      file_url TEXT NOT NULL,
      file_type TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Appointments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      center_name TEXT NOT NULL,
      pet_info TEXT,
      phone TEXT,
      date TEXT,
      time TEXT,
      urgency TEXT,
      notes TEXT,
      status TEXT DEFAULT 'Active',
      cancelled_at TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Services (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      phone TEXT,
      type TEXT,
      description TEXT,
      address TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS FullScans (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
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
      feedback TEXT
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
    CREATE INDEX IF NOT EXISTS idx_events_creator ON Events(creator_id);
  `);
}

async function seedInitialData() {
  const userCheck = await dbQuery('SELECT COUNT(*) as count FROM Users');
  const userCount = parseInt(userCheck.rows[0].count, 10);
  if (userCount > 0) return;

  console.log('ðŸŒ± Seeding EcoTrack Social PostgreSQL Database on Supabase...');

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
      bio: 'Nature enthusiast â€¢ Wildlife Protection Advocate â€¢ EcoTrack Certified Explorer',
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
    
    await dbQuery(`
      INSERT INTO Users (id, ecotrack_id, email, name, password_hash, role)
      VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING
    `, [u.id, u.ecotrack_id, u.email, u.name, pass, u.role]);

    await dbQuery(`
      INSERT INTO Profiles (
        user_id, display_name, ecotrack_id, avatar_url, cover_url, bio, country, city,
        languages, interests, favorite_species, vet_status, vet_verification, trainer_certs,
        rescue_org_membership, social_links, website, education, experience, volunteer_work,
        skills, personal_info, privacy_setting, reputation_score, profile_completion_pct
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
      ) ON CONFLICT DO NOTHING
    `, [
      u.id, u.name, u.ecotrack_id, u.avatar, u.cover, u.bio, u.country, u.city,
      u.languages, u.interests, u.favSpecies, u.vetStatus, u.vetVerif, u.trainerCerts,
      u.rescueOrg, u.socialLinks, u.website, u.education, u.experience, u.volunteerWork,
      u.skills, u.personalInfo, 'Public', u.reputation, u.completion
    ]);
  }

  // Seed Pets
  const pets = [
    {
      id: 'pet_shadow', owner_id: 'usr1', name: 'Shadow', species: 'Canis lupus familiaris', breed: 'German Shepherd', age: '3 Years', weight: '32 kg',
      diet: 'High protein kibble + raw beef topper (2 cups twice daily)',
      images: JSON.stringify(['https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?w=600']),
      medical_history: JSON.stringify([
        { date: '2026-01-15', title: 'Annual Wellness Check', notes: 'All vitals healthy. Weight optimal.' },
        { date: '2025-06-10', title: 'Minor Paw Scrap', notes: 'Flushed with saline, healed completely.' }
      ]),
      vaccination_records: JSON.stringify([
        { vaccine: 'DHPP Booster', date: '2026-02-01', nextDue: '2027-02-01', clinic: 'Mumbai Vet Care' },
        { vaccine: 'Rabies Anti-Viral', date: '2025-09-14', nextDue: '2026-09-14', clinic: 'Mumbai Vet Care' }
      ]),
      scanner_reports: JSON.stringify([
        { date: '2026-03-12', result: '99.4% German Shepherd', notes: 'AI Body Condition Index: 5/9 (Ideal)' }
      ]),
      training_progress: JSON.stringify({ recallSpeed: '98%', agilityLevel: 'Advanced Phase 3' }),
      achievements: JSON.stringify(['ðŸ† Master Agility Runner 2026', 'ðŸ›¡ï¸ Fully Vaccinated Shield']),
      milestones: JSON.stringify([{ title: 'Learned Emergency Stop Command', date: '2026-04-10' }])
    },
    {
      id: 'pet_luna', owner_id: 'usr1', name: 'Luna', species: 'Felis catus', breed: 'Persian Cat', age: '2 Years', weight: '4.2 kg',
      diet: 'Wet Salmon Pate + Kidney Support Formula',
      images: JSON.stringify(['https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=600']),
      medical_history: JSON.stringify([{ date: '2026-02-20', title: 'Dental Polish', notes: 'Cleaned mild tartar.' }]),
      vaccination_records: JSON.stringify([{ vaccine: 'FVRCP Vaccine', date: '2025-11-10', nextDue: '2026-11-10', clinic: 'Vet Hub' }]),
      scanner_reports: JSON.stringify([]),
      training_progress: JSON.stringify({ agilityLevel: 'Indoor Calm' }),
      achievements: JSON.stringify(['ðŸˆ Fluff Royalty']),
      milestones: JSON.stringify([{ title: 'Mastered Scratching Post Use', date: '2025-12-01' }])
    },
    {
      id: 'pet_rocky', owner_id: 'usr_user3', name: 'Rocky', species: 'Canis lupus familiaris', breed: 'German Shepherd', age: '2 Years', weight: '30 kg',
      diet: 'Premium Dry Kibble + Salmon Oil',
      images: JSON.stringify(['https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=600']),
      medical_history: JSON.stringify([{ date: '2026-05-12', title: 'Vaccination Appointment', notes: 'Administered Rabies and DHPP boosters.' }]),
      vaccination_records: JSON.stringify([{ vaccine: 'DHPP Booster', date: '2026-05-12', nextDue: '2027-05-12', clinic: 'Chennai Vet Center' }]),
      scanner_reports: JSON.stringify([]),
      training_progress: JSON.stringify({ agilityScore: '85%' }),
      achievements: JSON.stringify(['ðŸ† Beginner Agility Award']),
      milestones: JSON.stringify([])
    },
    {
      id: 'pet_bella', owner_id: 'usr_user1', name: 'Bella', species: 'Felis catus', breed: 'Siamese Cat', age: '1 Year', weight: '3.5 kg',
      diet: 'High-protein wet food',
      images: JSON.stringify(['https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=600']),
      medical_history: JSON.stringify([]),
      vaccination_records: JSON.stringify([]),
      scanner_reports: JSON.stringify([]),
      training_progress: JSON.stringify({}),
      achievements: JSON.stringify([]),
      milestones: JSON.stringify([])
    }
  ];

  for (const pet of pets) {
    await dbQuery(`
      INSERT INTO Pets (
        id, owner_id, name, species, breed, age, weight, diet, images, 
        medical_history, vaccination_records, scanner_reports, training_progress, 
        achievements, milestones
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (id) DO NOTHING
    `, [
      pet.id, pet.owner_id, pet.name, pet.species, pet.breed, pet.age, pet.weight, pet.diet,
      pet.images, pet.medical_history, pet.vaccination_records, pet.scanner_reports,
      pet.training_progress, pet.achievements, pet.milestones
    ]);
  }

  // Seed Impact Records
  const impacts = [
    { user_id: 'usr1', type: 'co2_saved', title: 'CO2 Reduction via Eco Recycled Purchases', val: 120.5, unit: 'kg', cat: 'Environmental' },
    { user_id: 'usr1', type: 'trees_planted', title: 'Trees Planted via EcoTrack Campaign', val: 15.0, unit: 'trees', cat: 'Conservation' },
    { user_id: 'usr1', type: 'rescues', title: 'Rescued Animals Assisted', val: 8.0, unit: 'animals', cat: 'Animal Welfare' },
    { user_id: 'usr1', type: 'trainings', title: 'Completed Pet Training Sessions', val: 24.0, unit: 'sessions', cat: 'Training' },
    { user_id: 'usr1', type: 'scanner', title: 'Verified AI Scanner Detections', val: 45.0, unit: 'analyses', cat: 'AI Technology' },
    { user_id: 'usr1', type: 'volunteer', title: 'Community Animal Shelter Hours', val: 38.0, unit: 'hours', cat: 'Volunteer Work' },
    { user_id: 'usr_user1', type: 'rescues', title: 'Rescued Animals Assisted', val: 24.0, unit: 'animals', cat: 'Animal Welfare' },
    { user_id: 'usr_user2', type: 'rescues', title: 'Rescued Animals Assisted', val: 48.0, unit: 'animals', cat: 'Animal Welfare' },
    { user_id: 'usr_user3', type: 'rescues', title: 'Rescued Animals Assisted', val: 12.0, unit: 'animals', cat: 'Animal Welfare' }
  ];

  for (const imp of impacts) {
    await dbQuery(`
      INSERT INTO EnvironmentalImpact (user_id, activity_type, title, impact_value, unit, metric_category)
      VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING
    `, [imp.user_id, imp.type, imp.title, imp.val, imp.unit, imp.cat]);
  }

  // Seed Sample Posts
  const postsList = [
    {
      id: 1, user_id: 'usr_user1',
      content: 'ðŸ¦… **Wildlife Protection Guide**: When observing nesting birds of prey or wild fauna, maintain a distance of at least 50 meters. Avoid loud noises that disturb territorial parents during brooding season. Feel free to ask any species observation questions below!',
      media_urls: JSON.stringify(['https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=1000']),
      media_types: JSON.stringify(['image']),
      post_type: 'general',
      training_achievement: null,
      scanner_report: JSON.stringify({ species: 'German Shepherd', confidence: '99.4% Match', notes: 'Verified by EcoTrack AI Identification Engine' }),
      encyclopedia_discovery: null,
      location_tag: 'Mumbai Reserve', animal_tag: 'Canis lupus familiaris', hashtags: '#WildlifeProtection #PetCare #EcoTrack'
    },
    {
      id: 2, user_id: 'usr_user3',
      content: 'ðŸ† **Training Tip of the Day**: Consistent positive reinforcement during recall drills improves response speed by over 300%! Always reward with high-value treats within 1.5 seconds of execution. Check out Shadow\'s agility progress below!',
      media_urls: JSON.stringify(['https://images.unsplash.com/photo-1534361960057-19889db9621e?w=1000']),
      media_types: JSON.stringify(['image']),
      post_type: 'training',
      training_achievement: JSON.stringify({ planTitle: 'Advanced Recall Drill Phase 3', completionRate: '100%', xpEarned: 250 }),
      scanner_report: null,
      encyclopedia_discovery: null,
      location_tag: 'Austin Training Grounds', animal_tag: 'German Shepherd', hashtags: '#DogTraining #AgilityCoach #PositiveReinforcement'
    },
    {
      id: 3, user_id: 'usr1',
      content: 'ðŸŒ± **Wildlife Protection Update**: Successfully observed and documented a juvenile Peregrine Falcon in the wild with @dr_ananya! AI Scanner verified 99.8% species accuracy. Thank you to everyone supporting our community conservation drives! ðŸ¦…',
      media_urls: JSON.stringify(['https://images.unsplash.com/photo-1611001716885-b3402558a62b?w=1000']),
      media_types: JSON.stringify(['image']),
      post_type: 'rescue',
      training_achievement: null,
      scanner_report: JSON.stringify({ species: 'Peregrine Falcon (Falco peregrinus)', confidence: '99.8%', status: 'Documented' }),
      encyclopedia_discovery: JSON.stringify({ tsn: 175404, common_name: 'Peregrine Falcon', speed: '389 km/h (Fastest animal on Earth)' }),
      location_tag: 'Bengaluru Wildlife Reserve', animal_tag: 'Peregrine Falcon', hashtags: '#WildlifeProtection #Falcon #EcoTrackHeroes'
    }
  ];

  for (const post of postsList) {
    await dbQuery(`
      INSERT INTO Posts (id, user_id, content, media_urls, media_types, post_type, training_achievement, scanner_report, encyclopedia_discovery, location_tag, animal_tag, hashtags)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT DO NOTHING
    `, [
      post.id, post.user_id, post.content, post.media_urls, post.media_types, post.post_type,
      post.training_achievement, post.scanner_report, post.encyclopedia_discovery, post.location_tag, post.animal_tag, post.hashtags
    ]);
  }

  // Seed Likes & Comments
  await dbQuery("INSERT INTO Likes (user_id, post_id) VALUES ('usr1', 1) ON CONFLICT DO NOTHING");
  await dbQuery("INSERT INTO Likes (user_id, post_id) VALUES ('usr_user3', 1) ON CONFLICT DO NOTHING");
  await dbQuery("INSERT INTO Likes (user_id, post_id) VALUES ('usr1', 2) ON CONFLICT DO NOTHING");
  await dbQuery("INSERT INTO Likes (user_id, post_id) VALUES ('usr_user1', 3) ON CONFLICT DO NOTHING");

  const commentRes = await dbQuery("INSERT INTO Comments (post_id, user_id, text) VALUES (1, 'usr1', 'Thank you Dr. Ananya! Great advice on keeping a safe distance during bird nesting season.') RETURNING id");
  if (commentRes.rows[0]) {
    await dbQuery("INSERT INTO Replies (comment_id, post_id, user_id, text) VALUES ($1, 1, 'usr_user1', 'Always happy to share conservation tips for animal safety!')", [commentRes.rows[0].id]);
  }

  // Seed default marketplace items
  const listingCheck = await dbQuery('SELECT COUNT(*) as count FROM MarketplaceListings');
  if (parseInt(listingCheck.rows[0].count, 10) === 0) {
    console.log('🌱 Seeding marketplace listings in PostgreSQL...');
    await dbQuery(`
      INSERT INTO MarketplaceListings (id, user_id, seller_name, title, price, description, image, category, type, location, breed, age, vaccinated, specs_json)
      VALUES 
      (101, 'usr_apex_k9', 'Apex K9 Kennels', 'Purebred German Shepherd Pup', 15000, 'AKC-line purebred with full vaccination certificate. Health tested parents.', 'https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?w=600', 'Pets', 'sale', 'Chennai', 'German Shepherd', '8 weeks', 1, $1),
      (102, 'usr_comfort_paws', 'ComfortPaws Pet Supplies', 'Orthopedic Memory Foam Pet Bed', 1499, 'High-density memory foam with waterproof cover. Suitable for dogs up to 30kg.', '/assets/pet_bed.jpg', 'Accessories', 'accessory', 'Bangalore', null, null, 0, $2),
      (103, 'usr_avian_care', 'Avian Care World', 'Premium Bird Cage (Large)', 3500, 'Powder-coated steel cage with multiple perches, feeding stations and pull-out tray.', '/assets/bird_cage.jpg', 'Housing', 'accessory', 'Mumbai', null, null, 0, $3),
      (104, 'usr_golden_haven', 'Golden Haven Sanctuary', 'Golden Retriever (Adoption)', 0, 'Rescued Golden Retriever. Neutered, vaccinated, socialized. Needs a loving home.', 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=400', 'Pets', 'adoption', 'Hyderabad', 'Golden Retriever', '2 years', 1, $4),
      (105, 'usr_vetcare_meds', 'VetCare Organics', 'Organic Aloe & Oatmeal Pet Shampoo', 499, 'Soothing, organic aloe vera and oatmeal shampoo formula for dogs and cats. Promotes a soft, shiny coat and relieves itchy skin.', '/assets/pet_shampoo.jpg', 'Supplies', 'accessory', 'Chennai', null, null, 0, $5),
      (106, 'usr_rex_gear', 'Rex Gear Official', 'Ergonomic GPS Animal Tracker Harness', 1899, 'Real-time GPS tracker harness for dogs and cats with night reflective strips.', '/assets/dog_tracker.jpg', 'Gear', 'accessory', 'Bangalore', null, null, 0, $6),
      (107, 'usr_paws_rescue', 'Paws Rescue Trust', 'Rescued Indie Puppy - Bruno', 0, 'Playful and loving Indie pup rescued from the streets. Fully vaccinated and dewormed.', 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=600', 'Pets', 'adoption', 'Chennai', 'Indian Pariah', '3 months', 1, $7)
    `, [
      JSON.stringify({ color: 'Black & Tan', weight: '3.2 kg', gender: 'Male', species: 'Dog' }),
      JSON.stringify({ size: '90×70cm', material: 'Memory foam', washable: true }),
      JSON.stringify({ dimensions: '80×60×120cm', bars: 'Non-toxic coating', suitable_for: 'Parrots, Cockatiels, Macaws' }),
      JSON.stringify({ color: 'Golden', weight: '28 kg', gender: 'Female', species: 'Dog' }),
      JSON.stringify({ volume: '500ml', formula: 'Tear-free, pH-balanced', scent: 'Oatmeal & Honey' }),
      JSON.stringify({ battery: '10 days', waterproof: 'IP68', weight: '120g' }),
      JSON.stringify({ color: 'Brown & White', weight: '4.5 kg', gender: 'Male', species: 'Dog' })
    ]);
  }

  // Migration to update seeded items' specs_json with gender and species
  try {
    await dbQuery(`
      UPDATE MarketplaceListings
      SET specs_json = '{"color":"Black & Tan","weight":"3.2 kg","gender":"Male","species":"Dog"}'
      WHERE id = 101 AND (specs_json IS NULL OR specs_json NOT LIKE '%gender%')
    `);
    await dbQuery(`
      UPDATE MarketplaceListings
      SET specs_json = '{"color":"Golden","weight":"28 kg","gender":"Female","species":"Dog"}'
      WHERE id = 104 AND (specs_json IS NULL OR specs_json NOT LIKE '%gender%')
    `);
  } catch (e) {
    console.warn("Failed to run specs migrations:", e.message);
  }

  // Ensure default UserSettings exist
  for (const u of users) {
    await dbQuery(`INSERT INTO UserSettings (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [u.id]);
  }

  console.log('âœ… EcoTrack Social PostgreSQL Database successfully seeded.');
}


async function ensureAdminAccounts() {
  try {
    const adminCheck = await dbQuery("SELECT id FROM Users WHERE email = 'admin@ecotrack.org'");
    if (!adminCheck.rows || adminCheck.rows.length === 0) {
      await dbQuery(`
        INSERT INTO Users (id, ecotrack_id, email, name, password_hash, role)
        VALUES ('usr_admin', 'ECO-ADMIN-01', 'admin@ecotrack.org', 'System Administrator', 'admin123', 'admin')
        ON CONFLICT (id) DO UPDATE SET role = 'admin', password_hash = 'admin123'
      `);
      await dbQuery(`
        INSERT INTO Profiles (user_id, display_name, ecotrack_id, avatar_url, bio, country, city, reputation_score)
        VALUES ('usr_admin', 'System Administrator', 'ECO-ADMIN-01', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400', 'EcoTrack System Administrator • Platform Governance & Security Operations', 'Global', 'Headquarters', 999)
        ON CONFLICT (user_id) DO UPDATE SET display_name = 'System Administrator'
      `);
      await dbQuery(`INSERT INTO UserSettings (user_id) VALUES ('usr_admin') ON CONFLICT (user_id) DO NOTHING`);
    } else {
      await dbQuery("UPDATE Users SET role = 'admin', password_hash = 'admin123' WHERE email = 'admin@ecotrack.org'");
    }

    // Ensure usr1 (user@ecotrack.org) has role 'admin'
    await dbQuery("UPDATE Users SET role = 'admin' WHERE email = 'user@ecotrack.org'");
    console.log("🛡️  Admin accounts verified (admin@ecotrack.org & user@ecotrack.org).");
  } catch (e) {
    console.warn("⚠️  Admin accounts verification warning:", e.message);
  }
}

async function syncOfflineDatabase() {
  await ensureAdminAccounts();
  const userFile = path.join(__dirname, 'ecotrack_userdata.json');
  if (!fs.existsSync(userFile)) return;

  let data;
  try {
    data = JSON.parse(fs.readFileSync(userFile, 'utf8'));
  } catch (e) {
    console.warn("⚠️ Failed to read ecotrack_userdata.json for auto-sync:", e.message);
    return;
  }

  try {
    let usersCount = 0;
    let eventsCount = 0;
    let servicesCount = 0;
    let petsCount = 0;
    let programsCount = 0;
    let scansCount = 0;

    // Pull and sync live from Supabase Cloud if connected
    const sb = database.getSupabaseClient();
    if (sb) {
      try {
        // Sync Users from Supabase
        const { data: sbUsers } = await sb.from('users').select('*');
        if (Array.isArray(sbUsers) && sbUsers.length > 0) {
          for (const u of sbUsers) {
            try {
              const cleanEmail = (u.email || '').toLowerCase().trim();
              const existingUser = await dbQuery(`SELECT id FROM Users WHERE email = $1`, [cleanEmail]);
              if (existingUser.rows && existingUser.rows.length > 0) {
                const oldId = existingUser.rows[0].id;
                if (oldId !== u.id) {
                  const childTables = [
                    ['Profiles', 'user_id'], ['Pets', 'owner_id'], ['Posts', 'user_id'],
                    ['Likes', 'user_id'], ['Comments', 'user_id'], ['Messages', 'sender_id'],
                    ['Messages', 'receiver_id'], ['Followers', 'follower_id'], ['Followers', 'following_id'],
                    ['AITrainerPrograms', 'user_id'], ['AIScannerReports', 'user_id'], ['FullScans', 'user_id'],
                    ['EnvironmentalImpact', 'user_id'], ['SavedPosts', 'user_id'], ['Achievements', 'user_id'],
                    ['UserSettings', 'user_id'], ['CartItems', 'user_id'], ['EventRegistrations', 'user_id']
                  ];
                  for (const [tbl, col] of childTables) {
                    try { await dbQuery(`UPDATE ${tbl} SET ${col} = $1 WHERE ${col} = $2`, [u.id, oldId]); } catch (e) {}
                  }
                  await dbQuery(`UPDATE Users SET id = $1, ecotrack_id = $2, name = $3 WHERE email = $4`, [u.id, u.ecotrack_id, u.name, cleanEmail]);
                }
              } else {
                await dbQuery(`
                  INSERT INTO Users (id, ecotrack_id, email, name, password_hash, role, created_at)
                  VALUES ($1, $2, $3, $4, $5, $6, $7)
                  ON CONFLICT (id) DO UPDATE SET
                    ecotrack_id = excluded.ecotrack_id,
                    name = excluded.name,
                    password_hash = excluded.password_hash,
                    role = excluded.role
                `, [
                  u.id, u.ecotrack_id, cleanEmail, u.name || 'Universal Member',
                  u.password_hash || '123456', u.role || 'user', u.created_at || new Date().toISOString()
                ]);
              }
              usersCount++;
            } catch (e) {}
          }
        }

        // Sync Profiles from Supabase
        const { data: sbProfiles } = await sb.from('profiles').select('*');
        if (Array.isArray(sbProfiles) && sbProfiles.length > 0) {
          for (const p of sbProfiles) {
            try {
              await dbQuery(`
                INSERT INTO Profiles (
                  user_id, display_name, ecotrack_id, avatar_url, cover_url, bio,
                  country, city, languages, interests, favorite_species, vet_status,
                  vet_verification, trainer_certs, rescue_org_membership, social_links,
                  website, education, experience, volunteer_work, skills, personal_info,
                  privacy_setting, reputation_score, profile_completion_pct, pinned_post_id,
                  profession, organization, dm_privacy_setting, emergency_helper, emergency_phone
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31)
                ON CONFLICT (user_id) DO UPDATE SET
                  display_name = excluded.display_name,
                  ecotrack_id = excluded.ecotrack_id,
                  avatar_url = excluded.avatar_url,
                  cover_url = excluded.cover_url,
                  bio = excluded.bio,
                  country = excluded.country,
                  city = excluded.city,
                  languages = excluded.languages,
                  interests = excluded.interests,
                  favorite_species = excluded.favorite_species,
                  vet_status = excluded.vet_status,
                  vet_verification = excluded.vet_verification,
                  trainer_certs = excluded.trainer_certs,
                  rescue_org_membership = excluded.rescue_org_membership,
                  social_links = excluded.social_links,
                  website = excluded.website,
                  education = excluded.education,
                  experience = excluded.experience,
                  volunteer_work = excluded.volunteer_work,
                  skills = excluded.skills,
                  personal_info = excluded.personal_info,
                  privacy_setting = excluded.privacy_setting,
                  reputation_score = excluded.reputation_score,
                  profile_completion_pct = excluded.profile_completion_pct,
                  pinned_post_id = excluded.pinned_post_id,
                  profession = excluded.profession,
                  organization = excluded.organization,
                  dm_privacy_setting = excluded.dm_privacy_setting,
                  emergency_helper = excluded.emergency_helper,
                  emergency_phone = excluded.emergency_phone
              `, [
                p.user_id, p.display_name, p.ecotrack_id, p.avatar_url, p.cover_url, p.bio,
                p.country, p.city, p.languages, p.interests, p.favorite_species, p.vet_status || 0,
                p.vet_verification, p.trainer_certs, p.rescue_org_membership, p.social_links,
                p.website, p.education, p.experience, p.volunteer_work, p.skills, p.personal_info,
                p.privacy_setting || 'Public', p.reputation_score || 120, p.profile_completion_pct || 85,
                p.pinned_post_id, p.profession, p.organization, p.dm_privacy_setting || 'Everyone',
                p.emergency_helper || 0, p.emergency_phone
              ]);
            } catch (e) {}
          }
        }

        // Sync Pets from Supabase
        const { data: sbPets } = await sb.from('pets').select('*');
        if (Array.isArray(sbPets) && sbPets.length > 0) {
          for (const pt of sbPets) {
            try {
              await dbQuery(`
                INSERT INTO Pets (
                  id, owner_id, name, species, breed, age, weight, diet, images,
                  medical_history, vaccination_records, scanner_reports, training_progress,
                  achievements, milestones, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                ON CONFLICT (id) DO UPDATE SET
                  owner_id = excluded.owner_id,
                  name = excluded.name,
                  species = excluded.species,
                  breed = excluded.breed,
                  age = excluded.age,
                  weight = excluded.weight,
                  diet = excluded.diet,
                  images = excluded.images,
                  medical_history = excluded.medical_history,
                  vaccination_records = excluded.vaccination_records,
                  scanner_reports = excluded.scanner_reports,
                  training_progress = excluded.training_progress,
                  achievements = excluded.achievements,
                  milestones = excluded.milestones
              `, [
                pt.id, pt.owner_id, pt.name, pt.species, pt.breed, pt.age, pt.weight, pt.diet,
                typeof pt.images === 'string' ? pt.images : JSON.stringify(pt.images || []),
                typeof pt.medical_history === 'string' ? pt.medical_history : JSON.stringify(pt.medical_history || []),
                typeof pt.vaccination_records === 'string' ? pt.vaccination_records : JSON.stringify(pt.vaccination_records || []),
                typeof pt.scanner_reports === 'string' ? pt.scanner_reports : JSON.stringify(pt.scanner_reports || []),
                typeof pt.training_progress === 'string' ? pt.training_progress : JSON.stringify(pt.training_progress || {}),
                typeof pt.achievements === 'string' ? pt.achievements : JSON.stringify(pt.achievements || []),
                typeof pt.milestones === 'string' ? pt.milestones : JSON.stringify(pt.milestones || []),
                pt.created_at || new Date().toISOString()
              ]);
              petsCount++;
            } catch (e) {}
          }
        }

        // Sync Achievements from Supabase
        const { data: sbAch } = await sb.from('achievements').select('*');
        if (Array.isArray(sbAch) && sbAch.length > 0) {
          for (const a of sbAch) {
            try {
              await dbQuery(`
                INSERT INTO Achievements (id, user_id, badge_code, badge_name, icon, category, description, unlocked_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (id) DO UPDATE SET
                  user_id = excluded.user_id,
                  badge_code = excluded.badge_code,
                  badge_name = excluded.badge_name,
                  icon = excluded.icon,
                  category = excluded.category,
                  description = excluded.description,
                  unlocked_at = excluded.unlocked_at
              `, [a.id, a.user_id, a.badge_code, a.badge_name, a.icon, a.category, a.description, a.unlocked_at]);
            } catch (e) {}
          }
        }

        const { data: sbEvents } = await sb.from('events').select('*');
        if (Array.isArray(sbEvents) && sbEvents.length > 0) {
          for (const ev of sbEvents) {
            try {
              await dbQuery(`
                INSERT INTO Events (id, title, category, date_str, date_iso, location, description, long_description, image_url, organizer, is_free, price, refund_policy)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                ON CONFLICT (id) DO UPDATE SET
                  title = excluded.title,
                  category = excluded.category,
                  date_str = excluded.date_str,
                  date_iso = excluded.date_iso,
                  location = excluded.location,
                  description = excluded.description,
                  long_description = excluded.long_description,
                  image_url = excluded.image_url,
                  organizer = excluded.organizer,
                  is_free = excluded.is_free,
                  price = excluded.price,
                  refund_policy = excluded.refund_policy
              `, [
                ev.id, ev.title, ev.category, ev.date_str, ev.date_iso, ev.location,
                ev.description, ev.long_description, ev.image_url, ev.organizer,
                ev.is_free ? 1 : 0, ev.price || 0, ev.refund_policy || ''
              ]);
              eventsCount++;
            } catch (e) {}
          }
        }

        const { data: sbServices } = await sb.from('services').select('*');
        if (Array.isArray(sbServices) && sbServices.length > 0) {
          for (const s of sbServices) {
            try {
              await dbQuery(`
                INSERT INTO Services (id, user_id, name, phone, type, description, address)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (id) DO UPDATE SET
                  name = excluded.name,
                  phone = excluded.phone,
                  type = excluded.type,
                  description = excluded.description,
                  address = excluded.address
              `, [
                s.id, 'usr1', s.name, s.emergency_phone || s.phone || '', s.type || 'General', s.description || '', s.address || ''
              ]);
              servicesCount++;
            } catch (e) {}
          }
        }
      } catch (cloudSyncErr) {
        console.warn("Supabase Cloud pull notice:", cloudSyncErr.message);
      }
    }

    // 1. Users, Profiles, UserSettings
    if (Array.isArray(data.users)) {
      for (const u of data.users) {
        if (!u.id || !u.email) continue;
        const cleanEmail = u.email.toLowerCase().trim();
        try {
          const existing = await dbQuery(`SELECT id FROM Users WHERE email = $1 OR id = $2 LIMIT 1`, [cleanEmail, u.id]);
          if (!existing.rows || existing.rows.length === 0) {
            const ecotrack_id = u.ecotrack_id || ('USR-' + Math.floor(100000 + Math.random() * 900000));
            await dbQuery(`
              INSERT INTO Users (id, ecotrack_id, email, name, password_hash, role, created_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
              u.id,
              ecotrack_id,
              cleanEmail,
              u.name || cleanEmail.split('@')[0],
              u.password_hash || 'demo',
              u.role || 'user',
              u.created_at || new Date().toISOString()
            ]);

            const avatar = u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'User')}&background=10b981&color=fff`;
            await dbQuery(`
              INSERT INTO Profiles (user_id, display_name, ecotrack_id, avatar_url, bio, privacy_setting)
              VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (user_id) DO NOTHING
            `, [
              u.id,
              u.name || cleanEmail.split('@')[0],
              ecotrack_id,
              avatar,
              u.bio || 'EcoTrack member • Wildlife enthusiast',
              'Public'
            ]);

            await dbQuery(`INSERT INTO UserSettings (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [u.id]);
            usersCount++;
          }
        } catch (e) { /* ignore single user duplicate */ }
      }
    }

    // 2. Events
    if (Array.isArray(data.events)) {
      for (const e of data.events) {
        if (!e.id) continue;
        try {
          await dbQuery(`
            INSERT INTO Events (id, title, category, date_str, date_iso, location, description, long_description, attendees, max_attendees, image, organizer, creator_id, is_free, price, refund_policy, coordinates_json)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            ON CONFLICT (id) DO UPDATE SET
              title = EXCLUDED.title,
              category = EXCLUDED.category,
              date_str = EXCLUDED.date_str,
              date_iso = EXCLUDED.date_iso,
              location = EXCLUDED.location,
              description = EXCLUDED.description,
              long_description = EXCLUDED.long_description,
              attendees = EXCLUDED.attendees,
              max_attendees = EXCLUDED.max_attendees,
              image = EXCLUDED.image,
              organizer = EXCLUDED.organizer,
              creator_id = EXCLUDED.creator_id,
              is_free = EXCLUDED.is_free,
              price = EXCLUDED.price
          `, [
            e.id,
            e.title || 'Untitled Event',
            e.category || 'General',
            e.date_str || 'TBD',
            e.date_iso || new Date().toISOString(),
            e.location || 'Local',
            e.description || '',
            e.long_description || e.description || '',
            e.attendees || 0,
            e.max_attendees || 500,
            e.image || '',
            e.organizer || 'EcoTrack',
            e.creator_id || 'usr1',
            (e.is_free !== false && e.price === 0) ? 1 : 0,
            e.price || 0,
            e.refund_policy || '',
            e.coordinates ? JSON.stringify(e.coordinates) : null
          ]);
          eventsCount++;
        } catch (e) { /* ignore single event error */ }
      }
    }

    // 3. Services
    if (Array.isArray(data.services)) {
      for (const s of data.services) {
        if (!s.id) continue;
        try {
          await dbQuery(`
            INSERT INTO Services (id, user_id, name, phone, type, description, address)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO NOTHING
          `, [
            s.id,
            'usr1',
            s.name || 'Care Service',
            s.emergency_phone || s.phone || '',
            s.type || s.category || 'General',
            s.description || '',
            s.address || s.city || 'Local'
          ]);
          servicesCount++;
        } catch (e) { /* ignore single service error */ }
      }
    }

    // 4. Pets
    if (data.pets && typeof data.pets === 'object') {
      for (const [uid, petList] of Object.entries(data.pets)) {
        if (Array.isArray(petList)) {
          for (const p of petList) {
            const petId = p.id ? String(p.id) : `pet_${Date.now()}`;
            try {
              await dbQuery(`
                INSERT INTO Pets (id, owner_id, name, species, breed, age, weight, diet, images, medical_history, vaccination_records)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (id) DO NOTHING
              `, [
                petId,
                uid,
                p.name || 'Pet',
                p.species || 'Canine',
                p.breed || '',
                p.age ? String(p.age) : '2',
                p.weight ? String(p.weight) : '15',
                p.diet || '',
                p.images ? (typeof p.images === 'string' ? p.images : JSON.stringify(p.images)) : null,
                p.medical_history || '',
                p.vaccination_records || ''
              ]);
              petsCount++;
            } catch (e) { /* ignore single pet error */ }
          }
        }
      }
    }

    // 5. Training Programs
    if (data.training_programs && typeof data.training_programs === 'object') {
      for (const [uid, progList] of Object.entries(data.training_programs)) {
        if (Array.isArray(progList)) {
          for (const p of progList) {
            const pid = p.id || p.plan_id || `tp_${Date.now()}`;
            try {
              await dbQuery(`
                INSERT INTO AITrainerPrograms (id, user_id, species, breed, goal, is_active, progress_json)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (id) DO NOTHING
              `, [
                pid,
                uid,
                p.species || 'Canine',
                p.breed || null,
                p.goal || 'General Fitness',
                p.is_active === false ? 0 : 1,
                p.progress ? JSON.stringify(p.progress) : JSON.stringify(p)
              ]);
              programsCount++;
            } catch (e) { /* ignore single program error */ }
          }
        }
      }
    }

    // 6. Scans
    if (Array.isArray(data.scans)) {
      for (const sc of data.scans) {
        if (!sc.id) continue;
        try {
          await dbQuery(`
            INSERT INTO FullScans (id, user_id, created_at, detected_species, form_score, reps_completed)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO NOTHING
          `, [
            String(sc.id),
            sc.user_id || 'usr1',
            sc.created_at || sc.timestamp || new Date().toISOString(),
            sc.species || 'Unknown',
            typeof sc.score === 'string' ? parseFloat(sc.score) || 85 : (sc.score || 85),
            sc.reps || 0
          ]);
          scansCount++;
        } catch (e) { /* ignore single scan error */ }
      }
    }

    console.log(`🔄 Database auto-sync complete: Users (${usersCount}), Events (${eventsCount}), Services (${servicesCount}), Programs (${programsCount}), Scans (${scansCount}) verified & up to date.`);
  } catch (err) {
    console.warn("⚠️ Database auto-sync warning:", err.message);
  }
}

module.exports = {
  getSocialDB,
  dbInitializationPromise,
  syncOfflineDatabase
};

