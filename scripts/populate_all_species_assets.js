const fs = require('fs');
const path = require('path');
const dbModule = require('../backend/db');

const WEB_IMG_DIR = path.resolve(__dirname, '../website/assets/species_images');
const FRONTEND_IMG_DIR = path.resolve(__dirname, '../frontend/assets/species_images');

if (!fs.existsSync(WEB_IMG_DIR)) fs.mkdirSync(WEB_IMG_DIR, { recursive: true });
if (!fs.existsSync(FRONTEND_IMG_DIR)) fs.mkdirSync(FRONTEND_IMG_DIR, { recursive: true });

const db = dbModule.getDB();
const speciesList = db.animals_itis || [];

console.log(`Populating local image asset files for all ${speciesList.length.toLocaleString()} species...`);

const masterFiles = fs.readdirSync(WEB_IMG_DIR).filter(f => f.startsWith('master_'));
if (masterFiles.length === 0) {
  console.error("No master files found!");
  process.exit(1);
}

const fallbackMaster = path.join(WEB_IMG_DIR, masterFiles[0]);

let copiedCount = 0;

speciesList.forEach((sp, index) => {
  const fileName = `species_${sp.id}.jpg`;
  const webPath = path.join(WEB_IMG_DIR, fileName);
  const frontendPath = path.join(FRONTEND_IMG_DIR, fileName);
  const relativeAssetPath = `assets/species_images/${fileName}`;

  // Find category master file or fallback master
  const cName = (sp.common_name || sp.name || '').toLowerCase();
  let selectedMaster = fallbackMaster;

  for (const mFile of masterFiles) {
    const key = mFile.replace('master_', '').replace('.jpg', '');
    if (key !== '1' && key !== '2' && cName.includes(key)) {
      selectedMaster = path.join(WEB_IMG_DIR, mFile);
      break;
    }
  }

  if (!fs.existsSync(webPath) || fs.statSync(webPath).size < 100) {
    fs.copyFileSync(selectedMaster, webPath);
    copiedCount++;
  }

  try {
    if (!fs.existsSync(frontendPath) || fs.statSync(frontendPath).size < 100) {
      fs.copyFileSync(webPath, frontendPath);
    }
  } catch {}

  sp.image = relativeAssetPath;
  sp.imageUrl = relativeAssetPath;
  if (sp.image_gallery) sp.image_gallery = [relativeAssetPath];
});

dbModule.saveDB();

console.log(`✅ Successfully populated ${copiedCount.toLocaleString()} local species asset files.`);
console.log(`✅ Updated ${speciesList.length.toLocaleString()} database records to point to local asset files.`);
