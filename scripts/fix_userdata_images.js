#!/usr/bin/env node
// ============================================================
// EcoTrack: Fix ecotrack_userdata.json Species Images
// - Remove all cached_local_image_path fields
// - Download wikimedia_image_url for each species (with URL reuse cache to prevent Wikimedia HTTP 429)
// - Save with scientific-name-based filename
// - Add local_image_path field to each entry
// ============================================================

'use strict';

const fs    = require('fs');
const path  = require('path');
const https = require('https');
const http  = require('http');

const USERDATA_PATH = path.join(__dirname, '..', 'backend', 'ecotrack_userdata.json');
const IMG_DIR       = path.join(__dirname, '..', 'backend', 'public', 'species_images');
const CONCURRENCY   = 3;

fs.mkdirSync(IMG_DIR, { recursive: true });

// URL to local path cache to prevent hammering Wikimedia with duplicate image downloads
const downloadedUrlMap = new Map();

function download(url, destPath) {
  return new Promise((resolve) => {
    const tmpPath = destPath + '.tmp';
    const file = fs.createWriteStream(tmpPath);
    const lib = url.startsWith('https') ? https : http;

    lib.get(url, {
      headers: {
        'User-Agent': 'EcoTrackUserDataFixer/1.0 (https://ecotrack.app)',
        'Accept': 'image/*,*/*'
      },
      timeout: 25000
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        try { fs.unlinkSync(tmpPath); } catch {}
        download(res.headers.location, destPath).then(resolve);
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

function verifyImage(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  const stat = fs.statSync(filePath);
  if (stat.size < 10000) return false;
  const buf = Buffer.allocUnsafe(4);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buf, 0, 4, 0);
  fs.closeSync(fd);
  const isJPEG = buf[0] === 0xFF && buf[1] === 0xD8;
  const isPNG  = buf[0] === 0x89 && buf.slice(1, 4).toString() === 'PNG';
  return isJPEG || isPNG;
}

function scientificNameToFilename(scientificName) {
  return scientificName.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_.-]/g, '') + '.jpg';
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runConcurrent(tasks, concurrency) {
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      await tasks[idx]();
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  EcoTrack: Fix ecotrack_userdata.json Species Images  ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  console.log('📖 Reading ecotrack_userdata.json...');
  const raw = fs.readFileSync(USERDATA_PATH, 'utf8');
  const data = JSON.parse(raw);

  const entries = data.verified_species_images;
  if (!entries || !Array.isArray(entries)) {
    console.error('❌ No verified_species_images array found.');
    process.exit(1);
  }
  console.log(`✅ Found ${entries.length.toLocaleString()} species entries in verified_species_images\n`);

  const stats = { downloaded: 0, reused: 0, failed: 0, total: entries.length };
  const startTime = Date.now();

  const tasks = entries.map((entry, idx) => async () => {
    // Remove old field
    delete entry.cached_local_image_path;

    const sciName = entry.scientific_name || `Species_${entry.taxon_id}`;
    const imgUrl  = entry.wikimedia_image_url || '';

    if (!imgUrl) {
      entry.local_image_path = null;
      stats.failed++;
      return;
    }

    const filename = scientificNameToFilename(sciName);
    const destPath = path.join(IMG_DIR, filename);
    const relPath  = `species_images/${filename}`;

    // If file already exists & is valid
    if (verifyImage(destPath)) {
      entry.local_image_path = relPath;
      downloadedUrlMap.set(imgUrl, relPath);
      stats.reused++;
      return;
    }

    // Check if we already downloaded this URL for another species
    if (downloadedUrlMap.has(imgUrl)) {
      const existingRelPath = downloadedUrlMap.get(imgUrl);
      const existingFullPath = path.join(__dirname, '..', 'backend', 'public', existingRelPath);
      if (verifyImage(existingFullPath)) {
        // Copy existing file to new destination
        try {
          fs.copyFileSync(existingFullPath, destPath);
          entry.local_image_path = relPath;
          stats.reused++;
          return;
        } catch {}
      }
    }

    // Download from URL
    const result = await download(imgUrl, destPath);
    if (result.ok && verifyImage(destPath)) {
      entry.local_image_path = relPath;
      downloadedUrlMap.set(imgUrl, relPath);
      stats.downloaded++;
    } else {
      entry.local_image_path = null;
      stats.failed++;
      try { fs.unlinkSync(destPath); } catch {}
    }

    await delay(150);

    const done = stats.downloaded + stats.reused + stats.failed;
    if (done % 500 === 0 || done === stats.total) {
      const pct = ((done / stats.total) * 100).toFixed(1);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      process.stdout.write(
        `\r  [${pct}%] Downloaded: ${stats.downloaded} | Reused/Cached: ${stats.reused} | Failed: ${stats.failed} | ${elapsed}s`
      );
    }
  });

  console.log(`🚀 Processing ${entries.length.toLocaleString()} entries...\n`);
  await runConcurrent(tasks, CONCURRENCY);
  console.log('\n');

  console.log('💾 Writing updated ecotrack_userdata.json...');
  fs.writeFileSync(USERDATA_PATH, JSON.stringify(data, null, 2), 'utf8');
  console.log('✅ ecotrack_userdata.json updated successfully.\n');

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`
╔═══════════════════════════════════════════════════╗
║             Final Summary                         ║
╠═══════════════════════════════════════════════════╣
  Total entries:       ${stats.total.toLocaleString()}
  ✅ Downloaded:       ${stats.downloaded.toLocaleString()}
  🔁 Reused / Cached:  ${stats.reused.toLocaleString()}
  ❌ Failed:           ${stats.failed.toLocaleString()}
  ⏱️  Elapsed time:     ${elapsed}s

  Field removed:       cached_local_image_path
  Field added:         local_image_path → species_images/<Genus_species>.jpg
╚═══════════════════════════════════════════════════╝
`);
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
