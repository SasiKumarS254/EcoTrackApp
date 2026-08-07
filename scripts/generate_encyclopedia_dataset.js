#!/usr/bin/env node
// ============================================================
// EcoTrack Encyclopedia Dataset Generation Pipeline
// Stages 1-11: ITIS → Wikimedia Commons → encyclopedia.db
// ============================================================

'use strict';

const fs   = require('fs');
const path = require('path');
const https = require('https');
const http  = require('http');
const crypto = require('crypto');

// ── Parse CLI args ──
const ARGS = process.argv.slice(2);
const INCREMENTAL   = ARGS.includes('--incremental');
const SEED_ONLY     = ARGS.includes('--seed-only');
const LIMIT         = (() => { const i = ARGS.indexOf('--limit'); return i !== -1 ? parseInt(ARGS[i+1]) : Infinity; })();
const CONCURRENCY   = (() => { const i = ARGS.indexOf('--concurrency'); return i !== -1 ? parseInt(ARGS[i+1]) : 3; })();
const DRY_RUN       = ARGS.includes('--dry-run');

// ── Paths ──
const ROOT          = path.resolve(__dirname, '..');
const BACKEND_DIR   = path.join(ROOT, 'backend');
const ITIS_DB_PATH  = path.join(__dirname, 'itis', 'ITIS.sqlite');
const SEED_PATH     = path.join(__dirname, 'itis', 'curated_species_seed.json');
const ENC_DB_PATH   = path.join(BACKEND_DIR, 'encyclopedia.db');
const IMG_BASE_DIR  = path.join(BACKEND_DIR, 'public', 'encyclopedia');
const REPORT_DIR    = path.join(__dirname, 'reports');

// Ensure directories exist
[IMG_BASE_DIR, REPORT_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));

const CLASS_DIR_MAP = {
  'mammalia':       'mammalia',
  'aves':           'aves',
  'reptilia':       'reptilia',
  'amphibia':       'amphibia',
  'actinopterygii': 'actinopterygii',
  'chondrichthyes': 'actinopterygii',
  'insecta':        'insecta',
  'arachnida':      'arachnida',
  'malacostraca':   'malacostraca',
  'cephalopoda':    'cephalopoda',
  'gastropoda':     'gastropoda',
  'bivalvia':       'bivalvia',
  'asteroidea':     'other',
  'holothuroidea':  'other',
  'echinoidea':     'other',
  'crinoidea':      'other',
  'polychaeta':     'other',
  'anthozoa':       'other',
  'scyphozoa':      'other',
  'clitellata':     'other',
};

function classToDir(className) {
  if (!className) return 'other';
  return CLASS_DIR_MAP[className.toLowerCase()] || 'other';
}

// Ensure all class subdirs exist
Object.values(CLASS_DIR_MAP).forEach(d => {
  fs.mkdirSync(path.join(IMG_BASE_DIR, d), { recursive: true });
});

// ──────────────────────────────────────────────────────────────
// SECTION 1: Database setup (better-sqlite3)
// ──────────────────────────────────────────────────────────────
let Database;
try {
  // Try local first, then from backend's node_modules
  try { Database = require('better-sqlite3'); }
  catch { Database = require(path.join(ROOT, 'backend', 'node_modules', 'better-sqlite3')); }
} catch (e) {
  console.error('❌ better-sqlite3 not found. Run: cd backend && npm install better-sqlite3');
  process.exit(1);
}

function openEncyclopediaDB() {
  const db = new Database(ENC_DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS species (
      speciesId         INTEGER PRIMARY KEY AUTOINCREMENT,
      itisRecordId      INTEGER,
      kingdom           TEXT DEFAULT 'Animalia',
      phylum            TEXT,
      class             TEXT,
      order_name        TEXT,
      family            TEXT,
      genus             TEXT,
      scientificName    TEXT UNIQUE,
      commonName        TEXT,
      conservationStatus TEXT,
      habitat           TEXT,
      diet              TEXT,
      lifespan          TEXT,
      description       TEXT,
      wikipediaUrl      TEXT,
      wikimediaUrl      TEXT,
      localImagePath    TEXT,
      imageVerified     INTEGER DEFAULT 0,
      lastUpdated       TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_scientificName ON species(scientificName);
    CREATE INDEX IF NOT EXISTS idx_class          ON species(class);
    CREATE INDEX IF NOT EXISTS idx_commonName     ON species(commonName);
    CREATE INDEX IF NOT EXISTS idx_genus          ON species(genus);
    CREATE INDEX IF NOT EXISTS idx_family         ON species(family);
    CREATE INDEX IF NOT EXISTS idx_imageVerified  ON species(imageVerified);
  `);
  return db;
}

// ──────────────────────────────────────────────────────────────
// SECTION 2: Load species list
// ──────────────────────────────────────────────────────────────
function loadSpeciesList() {
  let speciesList = [];

  // Try real ITIS SQLite first
  if (!SEED_ONLY && fs.existsSync(ITIS_DB_PATH)) {
    console.log(`\n📂 Loading ITIS SQLite from: ${ITIS_DB_PATH}`);
    try {
      const itisDb = new Database(ITIS_DB_PATH, { readonly: true });
      const rows = itisDb.prepare(`
        SELECT
          t.tsn          AS itisRecordId,
          t.kingdom      AS kingdom,
          h.phylum       AS phylum,
          h.class        AS class,
          h.order_       AS order_name,
          t.family       AS family,
          t.genus        AS genus,
          t.complete_name AS scientificName,
          v.vernacular_name AS commonName
        FROM taxonomic_units t
        LEFT JOIN hierarchy h ON h.tsn = t.tsn
        LEFT JOIN vernaculars v ON v.tsn = t.tsn AND v.language = 'English'
        WHERE t.kingdom_id = 5
          AND t.rank_id = 220
          AND t.usage = 'valid'
        GROUP BY t.tsn
        ORDER BY h.class, t.complete_name
        LIMIT 50000
      `).all();
      itisDb.close();

      speciesList = rows.map(r => ({
        itisRecordId:      r.itisRecordId,
        kingdom:           r.kingdom || 'Animalia',
        phylum:            r.phylum  || '',
        class:             r.class   || '',
        order_name:        r.order_name || '',
        family:            r.family  || '',
        genus:             r.genus   || '',
        scientificName:    r.scientificName || '',
        commonName:        r.commonName || '',
        conservationStatus:'',
        habitat:           '',
        diet:              '',
        lifespan:          '',
        description:       ''
      })).filter(s => s.scientificName && s.scientificName.trim().length > 3);

      console.log(`✅ ITIS: Loaded ${speciesList.length.toLocaleString()} valid animal species records`);
    } catch (err) {
      console.warn(`⚠️ ITIS load failed: ${err.message}. Falling back to seed dataset.`);
      speciesList = [];
    }
  }

  // Load curated seed dataset (always — merge with ITIS or use standalone)
  if (fs.existsSync(SEED_PATH)) {
    const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
    if (speciesList.length === 0) {
      speciesList = seed;
      console.log(`📋 Using curated seed: ${seed.length} verified species`);
    } else {
      // Merge seed into ITIS list (seed data enriches ITIS records with richer metadata)
      const sciNameMap = new Map(speciesList.map(s => [s.scientificName.toLowerCase(), s]));
      seed.forEach(s => {
        const key = s.scientificName.toLowerCase();
        if (sciNameMap.has(key)) {
          Object.assign(sciNameMap.get(key), s); // enrich with seed metadata
        } else {
          speciesList.push(s); // add new seed-only species
        }
      });
      console.log(`🔀 Merged seed enrichment: now ${speciesList.length.toLocaleString()} total records`);
    }
  }

  // Apply limit for testing
  if (isFinite(LIMIT)) {
    speciesList = speciesList.slice(0, LIMIT);
    console.log(`🔢 Limiting to ${LIMIT} species (--limit flag)`);
  }

  return speciesList;
}

// ──────────────────────────────────────────────────────────────
// SECTION 3: Wikimedia Commons API image search
// ──────────────────────────────────────────────────────────────

// Rejected filename patterns
const REJECTED_PATTERNS = [
  /skull/i, /skeleton/i, /fossil/i, /museum/i, /drawing/i, /illustration/i,
  /diagram/i, /map/i, /range/i, /distribution/i, /logo/i, /icon/i,
  /flag/i, /stamp/i, /taxidermy/i, /stuffed/i, /specimen/i, /mounted/i,
  /egg/i, /bones/i, /anatomy/i, /historic/i, /vintage/i, /old_photo/i,
  /engraving/i, /lithograph/i, /painting/i, /artwork/i, /cartoon/i,
  /coat_of_arms/i, /heraldry/i, /blurry/i, /silhouette/i, /outline/i,
  /placeholder/i, /no_image/i, /missing/i, /replacement/i, /default/i,
];

function isImageNameRejected(filename) {
  return REJECTED_PATTERNS.some(p => p.test(filename));
}

// Preferred filename patterns (positive signals)
const PREFERRED_PATTERNS = [
  /_(wild|nature|wildlife|natural|habitat|field|photo|photograph|image)/i,
  /(adult|male|female|juvenile)_/i,
  /^[A-Z][a-z]+_[a-z]+\./i, // Genus_species.ext
];

function imageScore(filename) {
  let score = 0;
  if (PREFERRED_PATTERNS.some(p => p.test(filename))) score += 2;
  if (/\.(jpg|jpeg)$/i.test(filename)) score += 1;
  if (/\d{4,}x\d{4,}/.test(filename)) score += 1; // high-res indicator
  if (isImageNameRejected(filename)) score -= 10;
  return score;
}

function httpsGet(url, options = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'EcoTrackEncyclopediaPipeline/1.0 (https://ecotrack.app; pipeline@ecotrack.app)',
        'Accept': 'application/json',
        ...(options.headers || {})
      },
      timeout: 20000
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return httpsGet(res.headers.location, options).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks), headers: res.headers }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Search Wikimedia Commons for images of a species using the scientific name.
 * Returns array of candidate image URLs, sorted best-first.
 */
async function searchWikimediaCommons(scientificName) {
  // Strategy 1: Wikimedia Commons MediaSearch API
  const candidates = [];

  // Step 1a: Search Wikimedia Commons files with scientific name
  try {
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(scientificName)}&srnamespace=6&srlimit=20&format=json&origin=*`;
    const r = await httpsGet(searchUrl);
    if (r.status === 200) {
      const data = JSON.parse(r.body.toString());
      const results = data?.query?.search || [];
      for (const result of results) {
        const title = result.title; // "File:Panthera_tigris_ITIS.jpg"
        if (title && !isImageNameRejected(title)) {
          candidates.push({ title, score: imageScore(title), source: 'commons-search' });
        }
      }
    }
  } catch {}

  // Step 1b: Wikipedia API — get image for the species page
  try {
    const wikiTitle = scientificName.replace(/\s+/g, '_');
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(wikiTitle)}&prop=pageimages&pithumbsize=1200&format=json&origin=*`;
    const r = await httpsGet(wikiUrl);
    if (r.status === 200) {
      const data = JSON.parse(r.body.toString());
      const pages = Object.values(data?.query?.pages || {});
      for (const page of pages) {
        if (page.thumbnail?.source) {
          candidates.push({
            directUrl: page.thumbnail.source
              .replace('/thumb/', '/').replace(/\/\d+px-[^/]+$/, ''),
            score: 3,
            source: 'wikipedia-pageimage'
          });
        }
      }
    }
  } catch {}

  // Step 1c: Wikimedia Commons category for the species
  try {
    const catTitle = `Category:${scientificName.replace(/\s+/g, '_')}`;
    const catUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(catTitle)}&prop=images&imlimit=20&format=json&origin=*`;
    const r = await httpsGet(catUrl);
    if (r.status === 200) {
      const data = JSON.parse(r.body.toString());
      const pages = Object.values(data?.query?.pages || {});
      for (const page of pages) {
        const imgs = page.images || [];
        for (const img of imgs) {
          if (!isImageNameRejected(img.title)) {
            candidates.push({ title: img.title, score: imageScore(img.title) + 1, source: 'commons-category' });
          }
        }
      }
    }
  } catch {}

  return candidates.sort((a, b) => b.score - a.score);
}

/**
 * Given a Commons File: title, get the actual full-resolution download URL
 */
async function getCommonsFileUrl(fileTitle) {
  try {
    const cleanTitle = fileTitle.startsWith('File:') ? fileTitle : `File:${fileTitle}`;
    const url = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(cleanTitle)}&prop=imageinfo&iiprop=url|mime|size&format=json&origin=*`;
    const r = await httpsGet(url);
    if (r.status !== 200) return null;
    const data = JSON.parse(r.body.toString());
    const pages = Object.values(data?.query?.pages || {});
    for (const page of pages) {
      const info = page?.imageinfo?.[0];
      if (info && info.url && /image\/(jpeg|jpg|png|webp)/i.test(info.mime || '')) {
        // Reject tiny files
        if (info.size && info.size < 20000) return null;
        return { url: info.url, mime: info.mime, size: info.size };
      }
    }
  } catch {}
  return null;
}

// ──────────────────────────────────────────────────────────────
// SECTION 4: Image download and verification
// ──────────────────────────────────────────────────────────────

async function downloadImage(url, destPath) {
  return new Promise((resolve) => {
    const tmpPath = destPath + '.tmp';
    const file = fs.createWriteStream(tmpPath);
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, {
      headers: {
        'User-Agent': 'EcoTrackEncyclopediaPipeline/1.0 (https://ecotrack.app)',
        'Accept': 'image/*,*/*'
      },
      timeout: 30000
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(tmpPath);
        downloadImage(res.headers.location, destPath).then(resolve);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(tmpPath); } catch {}
        resolve({ ok: false, reason: `HTTP ${res.statusCode}` });
        return;
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          try { fs.renameSync(tmpPath, destPath); } catch {}
          resolve({ ok: true });
        });
      });
    }).on('error', (err) => {
      file.close();
      try { fs.unlinkSync(tmpPath); } catch {}
      resolve({ ok: false, reason: err.message });
    }).on('timeout', () => {
      file.close();
      try { fs.unlinkSync(tmpPath); } catch {}
      resolve({ ok: false, reason: 'Timeout' });
    });
  });
}

/**
 * Verify a downloaded image file.
 * Returns { valid: bool, reason: string }
 */
function verifyImage(filePath) {
  if (!fs.existsSync(filePath)) return { valid: false, reason: 'File does not exist' };

  const stat = fs.statSync(filePath);
  if (stat.size < 15000) return { valid: false, reason: `File too small (${stat.size} bytes)` };
  if (stat.size > 50 * 1024 * 1024) return { valid: false, reason: 'File too large (>50MB)' };

  // Check magic bytes for JPEG / PNG / WebP
  const buf = Buffer.allocUnsafe(12);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buf, 0, 12, 0);
  fs.closeSync(fd);

  const isJPEG = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
  const isPNG  = buf[0] === 0x89 && buf.slice(1, 4).toString() === 'PNG';
  const isWebP = buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP';

  if (!isJPEG && !isPNG && !isWebP) {
    return { valid: false, reason: 'Not a valid JPEG/PNG/WebP image' };
  }

  return { valid: true, reason: 'OK' };
}

/**
 * Compute file hash to detect duplicates
 */
function fileHash(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buf).digest('hex');
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────
// SECTION 5: Process a single species
// ──────────────────────────────────────────────────────────────

const seenHashes = new Set();

async function processSpecies(species, encDb, stats, insertStmt, updateStmt) {
  const { scientificName, class: className, commonName } = species;

  if (!scientificName || scientificName.trim().length < 5) {
    stats.skipped++;
    return;
  }

  // Build image file path
  const classDir = classToDir(className);
  const safeFileName = scientificName.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_.-]/g, '') + '.jpg';
  const imgDir = path.join(IMG_BASE_DIR, classDir);
  const imgPath = path.join(imgDir, safeFileName);
  const relImgPath = `encyclopedia/${classDir}/${safeFileName}`;

  // Check if already in DB and verified (incremental mode)
  if (INCREMENTAL) {
    const existing = encDb.prepare('SELECT speciesId, imageVerified FROM species WHERE scientificName = ?').get(scientificName);
    if (existing && existing.imageVerified === 1 && fs.existsSync(imgPath)) {
      stats.skipped++;
      return;
    }
  }

  stats.processed++;
  let wikimediaUrl = '';
  let wikipediaUrl = `https://en.wikipedia.org/wiki/${scientificName.replace(/\s+/g, '_')}`;
  let imageVerified = 0;
  let localImagePath = null;
  let downloadedOk = false;

  // Try to find and download an image
  if (!DRY_RUN) {
    const candidates = await searchWikimediaCommons(scientificName);
    stats.wikiSearches++;

    let attempts = 0;
    for (const candidate of candidates) {
      if (attempts >= 5) break;
      attempts++;

      let imgUrl = candidate.directUrl || null;

      if (!imgUrl && candidate.title) {
        const info = await getCommonsFileUrl(candidate.title);
        if (info) imgUrl = info.url;
        await delay(200);
      }

      if (!imgUrl) continue;

      // Reject ITIS-hosted images
      if (imgUrl.includes('itis.gov')) continue;
      if (isImageNameRejected(imgUrl)) continue;

      const dlResult = await downloadImage(imgUrl, imgPath);
      if (!dlResult.ok) continue;

      const verification = verifyImage(imgPath);
      if (!verification.valid) {
        try { fs.unlinkSync(imgPath); } catch {}
        stats.brokenLinks++;
        continue;
      }

      // Duplicate detection
      const hash = fileHash(imgPath);
      if (hash && seenHashes.has(hash)) {
        try { fs.unlinkSync(imgPath); } catch {}
        stats.duplicates++;
        continue;
      }
      if (hash) seenHashes.add(hash);

      wikimediaUrl = imgUrl;
      localImagePath = relImgPath;
      imageVerified = 1;
      downloadedOk = true;
      stats.downloaded++;
      break;
    }

    if (!downloadedOk) {
      stats.missing++;
    }
  } else {
    // Dry run — simulate
    localImagePath = relImgPath;
    wikimediaUrl = `https://commons.wikimedia.org/wiki/File:${safeFileName}`;
    imageVerified = 0;
  }

  // Upsert into encyclopedia.db
  const now = new Date().toISOString();
  const row = {
    itisRecordId:      species.itisRecordId || null,
    kingdom:           species.kingdom || 'Animalia',
    phylum:            species.phylum  || '',
    class:             species.class   || '',
    order_name:        species.order_name || '',
    family:            species.family  || '',
    genus:             species.genus   || '',
    scientificName:    scientificName,
    commonName:        commonName || '',
    conservationStatus: species.conservationStatus || '',
    habitat:           species.habitat  || '',
    diet:              species.diet     || '',
    lifespan:          species.lifespan || '',
    description:       species.description || (imageVerified ? '' : 'Image Pending Verification'),
    wikipediaUrl:      wikipediaUrl,
    wikimediaUrl:      wikimediaUrl,
    localImagePath:    localImagePath || '',
    imageVerified:     imageVerified,
    lastUpdated:       now,
  };

  try {
    insertStmt.run(row);
    stats.dbInserted++;
  } catch (e) {
    if (e.message.includes('UNIQUE constraint')) {
      try {
        updateStmt.run({
          ...row,
          scientificName: row.scientificName
        });
        stats.dbUpdated++;
      } catch {}
    }
  }
}

// ──────────────────────────────────────────────────────────────
// SECTION 6: Concurrency pool
// ──────────────────────────────────────────────────────────────

async function runWithConcurrency(tasks, concurrency) {
  let i = 0;
  const results = [];
  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      try { await tasks[idx](); } catch {}
    }
  }
  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  return results;
}

// ──────────────────────────────────────────────────────────────
// SECTION 7: Main pipeline
// ──────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║   EcoTrack Encyclopedia Dataset Generation Pipeline  ║');
  console.log('║   Version 2.0 — Scientific Name → Wikimedia Commons  ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  if (DRY_RUN) console.log('⚠️  DRY RUN mode — no images will be downloaded\n');
  if (INCREMENTAL) console.log('🔄  INCREMENTAL mode — only processing new/unverified species\n');

  const startTime = Date.now();

  // 1. Open encyclopedia DB
  const encDb = openEncyclopediaDB();
  console.log(`✅ encyclopedia.db opened at: ${ENC_DB_PATH}`);

  // 2. Load species list
  const speciesList = loadSpeciesList();
  if (speciesList.length === 0) {
    console.error('❌ No species records loaded. Exiting.');
    process.exit(1);
  }
  console.log(`\n🧬 Total species to process: ${speciesList.length.toLocaleString()}`);
  console.log(`⚙️  Concurrency: ${CONCURRENCY} parallel workers\n`);

  // 3. Prepare DB statements
  const insertStmt = encDb.prepare(`
    INSERT OR IGNORE INTO species (
      itisRecordId, kingdom, phylum, class, order_name, family, genus,
      scientificName, commonName, conservationStatus, habitat, diet, lifespan,
      description, wikipediaUrl, wikimediaUrl, localImagePath, imageVerified, lastUpdated
    ) VALUES (
      @itisRecordId, @kingdom, @phylum, @class, @order_name, @family, @genus,
      @scientificName, @commonName, @conservationStatus, @habitat, @diet, @lifespan,
      @description, @wikipediaUrl, @wikimediaUrl, @localImagePath, @imageVerified, @lastUpdated
    )
  `);

  const updateStmt = encDb.prepare(`
    UPDATE species SET
      itisRecordId=@itisRecordId, kingdom=@kingdom, phylum=@phylum, class=@class,
      order_name=@order_name, family=@family, genus=@genus, commonName=@commonName,
      conservationStatus=@conservationStatus, habitat=@habitat, diet=@diet, lifespan=@lifespan,
      description=@description, wikipediaUrl=@wikipediaUrl, wikimediaUrl=@wikimediaUrl,
      localImagePath=@localImagePath, imageVerified=@imageVerified, lastUpdated=@lastUpdated
    WHERE scientificName=@scientificName
  `);

  // 4. Stats tracking
  const stats = {
    processed: 0, skipped: 0, downloaded: 0, missing: 0,
    duplicates: 0, brokenLinks: 0, wikiSearches: 0,
    dbInserted: 0, dbUpdated: 0,
  };

  // 5. Build task list
  const tasks = speciesList.map((species, idx) => async () => {
    await processSpecies(species, encDb, stats, insertStmt, updateStmt);
    // Rate limiting — polite delay between requests
    await delay(300 + Math.random() * 200);

    // Progress report every 25
    if ((stats.processed + stats.skipped) % 25 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const pct = (((stats.processed + stats.skipped) / speciesList.length) * 100).toFixed(1);
      process.stdout.write(
        `\r  [${pct}%] Processed:${stats.processed} | Downloaded:${stats.downloaded} | Missing:${stats.missing} | DB:${stats.dbInserted+stats.dbUpdated} | ${elapsed}s`
      );
    }
  });

  // 6. Run pipeline
  console.log('🚀 Starting species processing...\n');
  await runWithConcurrency(tasks, CONCURRENCY);
  console.log('\n');

  // 7. Final DB stats
  const totalInDb = encDb.prepare('SELECT COUNT(*) AS cnt FROM species').get().cnt;
  const verified  = encDb.prepare('SELECT COUNT(*) AS cnt FROM species WHERE imageVerified=1').get().cnt;
  const pending   = encDb.prepare('SELECT COUNT(*) AS cnt FROM species WHERE imageVerified=0').get().cnt;

  // ──────────────────────────────────────────────────────────────
  // STAGE 8: Verification Report
  // ──────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const reportTs = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  const report = {
    generatedAt: new Date().toISOString(),
    mode: INCREMENTAL ? 'incremental' : SEED_ONLY ? 'seed-only' : 'full',
    dryRun: DRY_RUN,
    elapsedSeconds: parseFloat(elapsed),
    inputSpeciesCount: speciesList.length,
    processed: stats.processed,
    skipped: stats.skipped,
    wikimediaSearches: stats.wikiSearches,
    imagesDownloaded: stats.downloaded,
    imagesVerified: verified,
    duplicatesRemoved: stats.duplicates,
    brokenLinksRemoved: stats.brokenLinks,
    missingImages: stats.missing,
    dbTotal: totalInDb,
    dbInserted: stats.dbInserted,
    dbUpdated: stats.dbUpdated,
    pendingVerification: pending,
    speciesRequiringManualReview: pending,
  };

  const jsonReportPath = path.join(REPORT_DIR, `verification_report_${reportTs}.json`);
  const txtReportPath  = path.join(REPORT_DIR, `verification_report_${reportTs}.txt`);

  fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));

  const txtReport = `
╔════════════════════════════════════════════════════════════╗
║         EcoTrack Encyclopedia — Verification Report         ║
╚════════════════════════════════════════════════════════════╝

Generated:               ${report.generatedAt}
Mode:                    ${report.mode}${DRY_RUN ? ' (DRY RUN)' : ''}
Elapsed:                 ${elapsed}s

INPUT
  Total ITIS/Seed records:      ${report.inputSpeciesCount.toLocaleString()}
  Processed:                    ${report.processed.toLocaleString()}
  Skipped (already verified):   ${report.skipped.toLocaleString()}

WIKIPEDIA / WIKIMEDIA
  Wikimedia searches run:       ${report.wikimediaSearches.toLocaleString()}
  Images downloaded:            ${report.imagesDownloaded.toLocaleString()}
  Duplicate images removed:     ${report.duplicatesRemoved.toLocaleString()}
  Broken image links removed:   ${report.brokenLinksRemoved.toLocaleString()}

DATABASE (encyclopedia.db)
  Total records:                ${report.dbTotal.toLocaleString()}
  Newly inserted:               ${report.dbInserted.toLocaleString()}
  Updated:                      ${report.dbUpdated.toLocaleString()}

IMAGE VERIFICATION
  ✅ Verified images:           ${report.imagesVerified.toLocaleString()}
  ⏳ Pending verification:      ${report.pendingVerification.toLocaleString()}
  ❌ Missing images:            ${report.missingImages.toLocaleString()}
  🔍 Species requiring review:  ${report.speciesRequiringManualReview.toLocaleString()}

OUTPUT
  Database:   ${ENC_DB_PATH}
  Images:     ${IMG_BASE_DIR}
  Report:     ${jsonReportPath}
`;

  fs.writeFileSync(txtReportPath, txtReport);

  console.log(txtReport);
  console.log(`\n📋 Reports saved to: ${REPORT_DIR}`);
  console.log('✅ Pipeline complete.\n');

  encDb.close();
}

main().catch(err => {
  console.error('\n❌ Pipeline failed:', err);
  process.exit(1);
});
