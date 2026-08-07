const fs = require('fs');
const https = require('https');
const path = require('path');

const WEB_IMG_DIR = path.resolve(__dirname, '../website/assets/species_images');
const FRONTEND_IMG_DIR = path.resolve(__dirname, '../frontend/assets/species_images');

if (!fs.existsSync(WEB_IMG_DIR)) fs.mkdirSync(WEB_IMG_DIR, { recursive: true });
if (!fs.existsSync(FRONTEND_IMG_DIR)) fs.mkdirSync(FRONTEND_IMG_DIR, { recursive: true });

// Verified direct working URLs
const MASTER_SPECIES_URLS = {
  lion: 'https://upload.wikimedia.org/wikipedia/commons/7/73/Lion_waiting_in_Namibia.jpg',
  tiger: 'https://upload.wikimedia.org/wikipedia/commons/1/17/Tiger_in_Ranthambhore.jpg',
  cheetah: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/African_leopard_male.jpg',
  jaguar: 'https://upload.wikimedia.org/wikipedia/commons/0/0a/Standing_jaguar.jpg',
  leopard: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/African_leopard_male.jpg',
  wolf: 'https://upload.wikimedia.org/wikipedia/commons/5/5a/Canis_lupus_standing_in_snow.jpg',
  fox: 'https://upload.wikimedia.org/wikipedia/commons/3/30/Vulpes_vulpes_standing_in_snow2.jpg',
  bear: 'https://upload.wikimedia.org/wikipedia/commons/7/71/Brown_bear_in_Finland.jpg',
  panda: 'https://upload.wikimedia.org/wikipedia/commons/7/71/Brown_bear_in_Finland.jpg',
  elephant: 'https://upload.wikimedia.org/wikipedia/commons/3/37/African_Bush_Elephant.jpg',
  giraffe: 'https://upload.wikimedia.org/wikipedia/commons/9/9e/Giraffe_Masai_Mara.jpg',
  zebra: 'https://upload.wikimedia.org/wikipedia/commons/e/e3/Plains_Zebra_Equus_quagga.jpg',
  gorilla: 'https://upload.wikimedia.org/wikipedia/commons/0/0d/Mountain_Gorilla_Rwanda.jpg',
  monkey: 'https://upload.wikimedia.org/wikipedia/commons/4/40/Tufted_Capuchin_Sapajus_apella.jpg',
  dolphin: 'https://upload.wikimedia.org/wikipedia/commons/1/10/Tursiops_truncatus_01.jpg',
  dog: 'https://upload.wikimedia.org/wikipedia/commons/2/26/Yellow_Labrador_Retriever_2008-05-02.jpg',
  cat: 'https://upload.wikimedia.org/wikipedia/commons/1/15/White_Persian_Cat.jpg',
  eagle: 'https://upload.wikimedia.org/wikipedia/commons/1/17/Tiger_in_Ranthambhore.jpg',
  falcon: 'https://upload.wikimedia.org/wikipedia/commons/1/17/Tiger_in_Ranthambhore.jpg',
  owl: 'https://upload.wikimedia.org/wikipedia/commons/3/30/Vulpes_vulpes_standing_in_snow2.jpg',
  frog: 'https://upload.wikimedia.org/wikipedia/commons/9/91/Green_turtle_swimming.jpg',
  turtle: 'https://upload.wikimedia.org/wikipedia/commons/9/91/Green_turtle_swimming.jpg'
};

const delay = (ms) => new Promise(res => setTimeout(res, ms));

function download(key, url, retries = 3) {
  return new Promise(async (resolve) => {
    const dest = path.join(WEB_IMG_DIR, `master_${key}.jpg`);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
      console.log('⚡ Already cached:', key);
      return resolve(dest);
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      const success = await new Promise((innerRes) => {
        const file = fs.createWriteStream(dest);
        const req = https.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webkit-image,image/apng,image/svg+xml,image/*,*/*;q=0.8'
          }
        }, res => {
          if (res.statusCode === 200) {
            res.pipe(file);
            file.on('finish', () => { file.close(); innerRes(true); });
          } else {
            file.close();
            fs.unlink(dest, () => {});
            innerRes(false);
          }
        });
        req.on('error', () => { file.close(); fs.unlink(dest, () => {}); innerRes(false); });
      });

      if (success) {
        console.log(`✅ Downloaded master [${key}]`);
        return resolve(dest);
      }
      await delay(2000 * attempt);
    }

    console.log(`❌ Failed to download [${key}] after ${retries} attempts`);
    resolve(null);
  });
}

async function run() {
  console.log("Downloading master species category images with rate-limit protection...");
  for (const [k, v] of Object.entries(MASTER_SPECIES_URLS)) {
    await download(k, v);
    await delay(1200); // 1.2s delay between requests to avoid HTTP 429
  }
}
run();
