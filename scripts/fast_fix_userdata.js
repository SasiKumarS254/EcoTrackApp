const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const USERDATA_PATH = path.join(__dirname, '..', 'backend', 'ecotrack_userdata.json');
const IMG_DIR       = path.join(__dirname, '..', 'backend', 'public', 'species_images');

fs.mkdirSync(IMG_DIR, { recursive: true });

function download(url, destPath) {
  return new Promise((resolve) => {
    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 10000) {
      return resolve({ ok: true });
    }
    const tmpPath = destPath + '.tmp';
    const file = fs.createWriteStream(tmpPath);
    const lib = url.startsWith('https') ? https : http;

    lib.get(url, {
      headers: {
        'User-Agent': 'EcoTrackFastFixer/1.0 (https://ecotrack.app)',
        'Accept': 'image/*,*/*'
      },
      timeout: 20000
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
    });
  });
}

function scientificNameToFilename(name) {
  return (name || 'species').replace(/\s+/g, '_').replace(/[^A-Za-z0-9_.-]/g, '') + '.jpg';
}

async function main() {
  console.log('📖 Loading ecotrack_userdata.json...');
  const data = JSON.parse(fs.readFileSync(USERDATA_PATH, 'utf8'));
  const entries = data.verified_species_images || [];
  console.log(`✅ Found ${entries.length.toLocaleString()} entries`);

  // Step 1: Collect unique URLs & download them once
  const urlMap = new Map();
  let count = 0;
  for (const entry of entries) {
    if (entry.wikimedia_image_url && !urlMap.has(entry.wikimedia_image_url)) {
      count++;
      const masterName = `master_image_${count}.jpg`;
      const masterPath = path.join(IMG_DIR, masterName);
      urlMap.set(entry.wikimedia_image_url, masterPath);
    }
  }

  console.log(`⬇️ Downloading ${urlMap.size} unique master images from Wikimedia...`);
  for (const [url, destPath] of urlMap.entries()) {
    const res = await download(url, destPath);
    console.log(`  ${res.ok ? '✅' : '❌'} Downloaded ${path.basename(destPath)}`);
  }

  // Step 2: Update all 10,000 entries and link local image files
  console.log('🔄 Updating 10,000 entries and setting local_image_path...');
  let updatedCount = 0;
  for (const entry of entries) {
    // Delete old field
    delete entry.cached_local_image_path;

    const sciName = entry.scientific_name || `Species_${entry.taxon_id}`;
    const filename = scientificNameToFilename(sciName);
    const destPath = path.join(IMG_DIR, filename);
    const relPath  = `species_images/${filename}`;

    const masterPath = urlMap.get(entry.wikimedia_image_url);
    if (masterPath && fs.existsSync(masterPath)) {
      if (!fs.existsSync(destPath)) {
        try { fs.copyFileSync(masterPath, destPath); } catch {}
      }
      entry.local_image_path = relPath;
    } else {
      entry.local_image_path = null;
    }
    updatedCount++;
  }

  // Step 3: Write back to ecotrack_userdata.json
  console.log('💾 Writing updated ecotrack_userdata.json...');
  fs.writeFileSync(USERDATA_PATH, JSON.stringify(data, null, 2), 'utf8');
  console.log('✅ Done! Updated 10,000 entries.');

  // Show sample data
  console.log('\n--- SAMPLE UPDATED DATA (First 3 entries) ---');
  console.log(JSON.stringify(entries.slice(0, 3), null, 2));
  console.log('\n--- SAMPLE UPDATED DATA (Last 3 entries) ---');
  console.log(JSON.stringify(entries.slice(-3), null, 2));
}

main().catch(console.error);
