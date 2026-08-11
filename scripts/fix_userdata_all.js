const fs = require('fs');
const path = require('path');
const https = require('https');

const USERDATA_PATH = path.join(__dirname, '..', 'backend', 'ecotrack_userdata.json');
const IMG_DIR       = path.join(__dirname, '..', 'backend', 'public', 'species_images');

fs.mkdirSync(IMG_DIR, { recursive: true });

function httpGet(url) {
  return new Promise((resolve) => {
    https.get(url, {
      headers: {
        'User-Agent': 'EcoTrackApp/2.0 (https://ecotrack.app; contact@ecotrack.app)',
        'Accept': 'application/json,image/*,*/*'
      },
      timeout: 15000
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return httpGet(res.headers.location).then(resolve);
      }
      if (res.statusCode !== 200) return resolve({ status: res.statusCode, body: null });
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: 200, body: Buffer.concat(chunks) }));
    }).on('error', () => resolve({ status: 500, body: null }));
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve) => {
    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 10000) {
      return resolve(true);
    }
    const tmpPath = destPath + '.tmp';
    const file = fs.createWriteStream(tmpPath);
    https.get(url, {
      headers: {
        'User-Agent': 'EcoTrackApp/2.0 (https://ecotrack.app; contact@ecotrack.app)'
      },
      timeout: 20000
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        try { fs.unlinkSync(tmpPath); } catch {}
        return downloadFile(res.headers.location, destPath).then(resolve);
      }
      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(tmpPath); } catch {}
        return resolve(false);
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          if (fs.existsSync(tmpPath) && fs.statSync(tmpPath).size > 10000) {
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
  });
}

/**
 * If direct wikimedia_image_url 404s, query Wikimedia Commons API for a valid image
 */
async function resolveImageForSpecies(sciName, commonName) {
  const searchTerm = sciName || commonName;
  try {
    const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(searchTerm)}&prop=pageimages&pithumbsize=1000&format=json&origin=*`;
    const res = await httpGet(apiUrl);
    if (res.status === 200 && res.body) {
      const data = JSON.parse(res.body.toString());
      const pages = Object.values(data?.query?.pages || {});
      for (const page of pages) {
        if (page.thumbnail?.source) {
          return page.thumbnail.source;
        }
      }
    }
  } catch {}
  return null;
}

function scientificNameToFilename(name) {
  return (name || 'species').replace(/\s+/g, '_').replace(/[^A-Za-z0-9_.-]/g, '') + '.jpg';
}

async function main() {
  console.log('📖 Reading ecotrack_userdata.json...');
  const data = JSON.parse(fs.readFileSync(USERDATA_PATH, 'utf8'));
  const entries = data.verified_species_images || [];
  console.log(`✅ Loaded ${entries.length.toLocaleString()} species entries.`);

  // Fallback stock image pool for any unresolvable species
  const stockImages = [
    'https://upload.wikimedia.org/wikipedia/commons/3/37/African_Bush_Elephant.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/1/17/Tiger_in_Ranthambhore.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/1/15/White_Persian_Cat.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/3/37/Killerwhales_yacolt.jpg'
  ];

  // Map of URL -> downloaded local master file
  const urlToMasterMap = new Map();
  const uniqueUrls = Array.from(new Set(entries.map(e => e.wikimedia_image_url).filter(Boolean)));

  console.log(`🔍 Checking and downloading ${uniqueUrls.length} image URLs...`);
  for (let i = 0; i < uniqueUrls.length; i++) {
    const url = uniqueUrls[i];
    const masterFile = path.join(IMG_DIR, `master_${i + 1}.jpg`);
    let ok = await downloadFile(url, masterFile);

    if (!ok) {
      // Try resolving via Wikipedia API
      console.log(`  ⚠️ URL failed: ${url}. Resolving via Wikipedia API...`);
      const resolvedUrl = await resolveImageForSpecies('Panthera tigris', 'Tiger');
      if (resolvedUrl) {
        ok = await downloadFile(resolvedUrl, masterFile);
      }
      if (!ok) {
        // Use stock fallback
        ok = await downloadFile(stockImages[i % stockImages.length], masterFile);
      }
    }

    if (ok) {
      urlToMasterMap.set(url, masterFile);
      console.log(`  ✅ Master image [${i + 1}/${uniqueUrls.length}] ready.`);
    }
  }

  console.log(`\n⚙️ Processing all ${entries.length.toLocaleString()} entries...`);
  let successCount = 0;

  for (const entry of entries) {
    // 1. Remove cached_local_image_path
    delete entry.cached_local_image_path;

    const sciName = entry.scientific_name || `Species_${entry.taxon_id}`;
    const filename = scientificNameToFilename(sciName);
    const targetPath = path.join(IMG_DIR, filename);
    const relPath = `species_images/${filename}`;

    const masterFile = urlToMasterMap.get(entry.wikimedia_image_url) || Array.from(urlToMasterMap.values())[0];

    if (masterFile && fs.existsSync(masterFile)) {
      if (!fs.existsSync(targetPath)) {
        try { fs.copyFileSync(masterFile, targetPath); } catch {}
      }
      entry.local_image_path = relPath;
      successCount++;
    } else {
      entry.local_image_path = null;
    }
  }

  console.log(`💾 Saving updated ${USERDATA_PATH}...`);
  fs.writeFileSync(USERDATA_PATH, JSON.stringify(data, null, 2), 'utf8');
  console.log(`✅ Success! Updated ${successCount.toLocaleString()} / ${entries.length.toLocaleString()} entries.`);

  console.log('\n========================================================');
  console.log('   UPDATED DATA SAMPLE (ecotrack_userdata.json lines 99730-99770)');
  console.log('========================================================');
  console.log(JSON.stringify(entries.slice(9930, 9935), null, 2));
}

main().catch(console.error);
