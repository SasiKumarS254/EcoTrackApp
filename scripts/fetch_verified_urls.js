const fs = require('fs');
const path = require('path');
const https = require('https');

const USERDATA_PATH = path.join(__dirname, '..', 'backend', 'ecotrack_userdata.json');
const IMG_DIR       = path.join(__dirname, '..', 'backend', 'public', 'species_images');

fs.mkdirSync(IMG_DIR, { recursive: true });

function downloadWithRedirects(url, destPath) {
  return new Promise((resolve) => {
    if (!url) return resolve(false);
    const tmpPath = destPath + '.tmp';
    const file = fs.createWriteStream(tmpPath);

    const request = (currentUrl, redirects = 0) => {
      if (redirects > 5) {
        file.close();
        try { fs.unlinkSync(tmpPath); } catch {}
        return resolve(false);
      }
      https.get(currentUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 EcoTrack/1.0',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Referer': 'https://commons.wikimedia.org/'
        },
        timeout: 20000
      }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
          return request(res.headers.location, redirects + 1);
        }
        if (res.statusCode !== 200) {
          file.close();
          try { fs.unlinkSync(tmpPath); } catch {}
          return resolve(false);
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close(() => {
            if (fs.existsSync(tmpPath) && fs.statSync(tmpPath).size > 5000) {
              try { fs.renameSync(tmpPath, destPath); } catch {}
              return resolve(true);
            }
            try { fs.unlinkSync(tmpPath); } catch {}
            return resolve(false);
          });
        });
      }).on('error', () => {
        file.close();
        try { fs.unlinkSync(tmpPath); } catch {}
        return resolve(false);
      });
    };

    request(url);
  });
}

function scientificNameToFilename(name) {
  return (name || 'species').replace(/\s+/g, '_').replace(/[^A-Za-z0-9_.-]/g, '') + '.jpg';
}

async function main() {
  console.log('📖 Reading ecotrack_userdata.json...');
  const data = JSON.parse(fs.readFileSync(USERDATA_PATH, 'utf8'));
  const entries = data.verified_species_images || [];
  console.log(`✅ Found ${entries.length.toLocaleString()} entries.`);

  // Unique URLs map
  const uniqueUrls = Array.from(new Set(entries.map(e => e.wikimedia_image_url).filter(Boolean)));
  console.log(`🔗 Found ${uniqueUrls.length} unique wikimedia image URLs.`);

  const urlToLocalFileMap = new Map();

  for (let i = 0; i < uniqueUrls.length; i++) {
    const url = uniqueUrls[i];
    const filename = `master_species_${i + 1}.jpg`;
    const destPath = path.join(IMG_DIR, filename);
    const ok = await downloadWithRedirects(url, destPath);
    if (ok) {
      urlToLocalFileMap.set(url, destPath);
      console.log(`  ✅ [${i + 1}/${uniqueUrls.length}] Successfully downloaded: ${path.basename(destPath)}`);
    } else {
      console.log(`  ⚠️ [${i + 1}/${uniqueUrls.length}] Failed URL: ${url}`);
    }
  }

  console.log(`\n🔄 Updating all ${entries.length.toLocaleString()} entries...`);
  let updatedCount = 0;
  for (const entry of entries) {
    delete entry.cached_local_image_path;

    const sciName = entry.scientific_name || `Species_${entry.taxon_id}`;
    const targetFilename = scientificNameToFilename(sciName);
    const targetPath = path.join(IMG_DIR, targetFilename);
    const relPath = `species_images/${targetFilename}`;

    const masterPath = urlToLocalFileMap.get(entry.wikimedia_image_url);
    if (masterPath && fs.existsSync(masterPath)) {
      if (!fs.existsSync(targetPath)) {
        try { fs.copyFileSync(masterPath, targetPath); } catch {}
      }
      entry.local_image_path = relPath;
      updatedCount++;
    } else {
      entry.local_image_path = null;
    }
  }

  console.log(`💾 Writing ${USERDATA_PATH}...`);
  fs.writeFileSync(USERDATA_PATH, JSON.stringify(data, null, 2), 'utf8');
  console.log(`✅ Fully updated ${updatedCount.toLocaleString()} / ${entries.length.toLocaleString()} entries.`);

  console.log('\n==================================================');
  console.log('       UPDATED DATA SAMPLE (First 5 entries)      ');
  console.log('==================================================');
  console.log(JSON.stringify(entries.slice(0, 5), null, 2));

  console.log('\n==================================================');
  console.log('       UPDATED DATA SAMPLE (Lines 99730-99770 area)');
  console.log('==================================================');
  console.log(JSON.stringify(entries.slice(9930, 9936), null, 2));
}

main().catch(console.error);
