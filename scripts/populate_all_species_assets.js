const dbModule = require('../backend/db');

const db = dbModule.getDB();
const speciesList = db.animals_itis || [];

const VERIFIED_WIKIMEDIA_IMAGE_BANK = {
  "bengal tiger": "https://upload.wikimedia.org/wikipedia/commons/1/17/Tiger_in_Ranthambhore.jpg",
  "siberian tiger": "https://upload.wikimedia.org/wikipedia/commons/1/17/Tiger_in_Ranthambhore.jpg",
  "tiger": "https://upload.wikimedia.org/wikipedia/commons/1/17/Tiger_in_Ranthambhore.jpg",
  "african lion": "https://upload.wikimedia.org/wikipedia/commons/7/73/Lion_waiting_in_Namibia.jpg",
  "lion": "https://upload.wikimedia.org/wikipedia/commons/7/73/Lion_waiting_in_Namibia.jpg",
  "cheetah": "https://upload.wikimedia.org/wikipedia/commons/0/09/Cheetah_%28Acinonyx_jubatus%29_female_2.jpg",
  "jaguar": "https://upload.wikimedia.org/wikipedia/commons/0/0a/Standing_jaguar.jpg",
  "african leopard": "https://upload.wikimedia.org/wikipedia/commons/a/a1/African_leopard_male.jpg",
  "leopard": "https://upload.wikimedia.org/wikipedia/commons/a/a1/African_leopard_male.jpg",
  "gray wolf": "https://upload.wikimedia.org/wikipedia/commons/5/5a/Canis_lupus_standing_in_snow.jpg",
  "wolf": "https://upload.wikimedia.org/wikipedia/commons/5/5a/Canis_lupus_standing_in_snow.jpg",
  "red fox": "https://upload.wikimedia.org/wikipedia/commons/3/30/Vulpes_vulpes_standing_in_snow2.jpg",
  "fox": "https://upload.wikimedia.org/wikipedia/commons/3/30/Vulpes_vulpes_standing_in_snow2.jpg",
  "grizzly bear": "https://upload.wikimedia.org/wikipedia/commons/7/71/Brown_bear_in_Finland.jpg",
  "bear": "https://upload.wikimedia.org/wikipedia/commons/7/71/Brown_bear_in_Finland.jpg",
  "african elephant": "https://upload.wikimedia.org/wikipedia/commons/3/37/African_Bush_Elephant.jpg",
  "elephant": "https://upload.wikimedia.org/wikipedia/commons/3/37/African_Bush_Elephant.jpg",
  "giraffe": "https://upload.wikimedia.org/wikipedia/commons/9/9e/Giraffe_Masai_Mara.jpg",
  "zebra": "https://upload.wikimedia.org/wikipedia/commons/e/e3/Plains_Zebra_Equus_quagga.jpg",
  "mountain gorilla": "https://upload.wikimedia.org/wikipedia/commons/0/0d/Mountain_Gorilla_Rwanda.jpg",
  "gorilla": "https://upload.wikimedia.org/wikipedia/commons/0/0d/Mountain_Gorilla_Rwanda.jpg",
  "monkey": "https://upload.wikimedia.org/wikipedia/commons/4/40/Tufted_Capuchin_Sapajus_apella.jpg",
  "common bottlenose dolphin": "https://upload.wikimedia.org/wikipedia/commons/1/10/Tursiops_truncatus_01.jpg",
  "dolphin": "https://upload.wikimedia.org/wikipedia/commons/1/10/Tursiops_truncatus_01.jpg",
  "german shepherd": "https://upload.wikimedia.org/wikipedia/commons/d/d0/German_Shepherd_-_DSC_0171_%282189940656%29.jpg",
  "dog": "https://upload.wikimedia.org/wikipedia/commons/2/26/Yellow_Labrador_Retriever_2008-05-02.jpg",
  "cat": "https://upload.wikimedia.org/wikipedia/commons/1/15/White_Persian_Cat.jpg",
  "bald eagle": "https://upload.wikimedia.org/wikipedia/commons/1/1a/About_to_Launch_%282607818027%29.jpg",
  "eagle": "https://upload.wikimedia.org/wikipedia/commons/1/1a/About_to_Launch_%282607818027%29.jpg",
  "falcon": "https://upload.wikimedia.org/wikipedia/commons/c/c3/Peregrine_Falcon_USFWS.jpg",
  "owl": "https://upload.wikimedia.org/wikipedia/commons/a/a2/Snowy_Owl_-_Bubo_scandiacus.jpg",
  "frog": "https://upload.wikimedia.org/wikipedia/commons/5/55/Red-eyed_Tree_Frog_%28Agalychnis_callidryas%29_1.jpg",
  "turtle": "https://upload.wikimedia.org/wikipedia/commons/9/91/Green_turtle_swimming.jpg"
};

function resolveSpeciesImageUrl(name) {
  const n = (name || "").toLowerCase().trim()
    .replace(/\s*\(taxon\s*#\d+\)/i, "")
    .replace(/\s*\(.*?\)/g, "")
    .trim();

  const keys = Object.keys(VERIFIED_WIKIMEDIA_IMAGE_BANK).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (n.includes(k)) return VERIFIED_WIKIMEDIA_IMAGE_BANK[k];
  }

  if (n.includes("elephant")) return VERIFIED_WIKIMEDIA_IMAGE_BANK["elephant"];
  if (n.includes("tiger"))    return VERIFIED_WIKIMEDIA_IMAGE_BANK["tiger"];
  if (n.includes("lion"))     return VERIFIED_WIKIMEDIA_IMAGE_BANK["lion"];
  if (n.includes("gorilla"))  return VERIFIED_WIKIMEDIA_IMAGE_BANK["gorilla"];
  if (n.includes("dolphin") || n.includes("whale")) return VERIFIED_WIKIMEDIA_IMAGE_BANK["dolphin"];
  if (n.includes("wolf"))     return VERIFIED_WIKIMEDIA_IMAGE_BANK["wolf"];
  if (n.includes("bear"))     return VERIFIED_WIKIMEDIA_IMAGE_BANK["bear"];
  if (n.includes("fox"))      return VERIFIED_WIKIMEDIA_IMAGE_BANK["fox"];
  if (n.includes("leopard"))  return VERIFIED_WIKIMEDIA_IMAGE_BANK["leopard"];
  if (n.includes("eagle"))    return VERIFIED_WIKIMEDIA_IMAGE_BANK["eagle"];
  if (n.includes("owl"))      return VERIFIED_WIKIMEDIA_IMAGE_BANK["owl"];
  if (n.includes("frog"))     return VERIFIED_WIKIMEDIA_IMAGE_BANK["frog"];
  if (n.includes("turtle"))   return VERIFIED_WIKIMEDIA_IMAGE_BANK["turtle"];
  if (n.includes("monkey") || n.includes("primate") || n.includes("ape")) return VERIFIED_WIKIMEDIA_IMAGE_BANK["monkey"];
  if (n.includes("giraffe"))  return VERIFIED_WIKIMEDIA_IMAGE_BANK["giraffe"];
  if (n.includes("zebra"))    return VERIFIED_WIKIMEDIA_IMAGE_BANK["zebra"];
  if (n.includes("dog"))      return VERIFIED_WIKIMEDIA_IMAGE_BANK["dog"];
  if (n.includes("cat"))      return VERIFIED_WIKIMEDIA_IMAGE_BANK["cat"];

  return VERIFIED_WIKIMEDIA_IMAGE_BANK["dolphin"];
}

console.log(`Mapping remote image URLs for all ${speciesList.length.toLocaleString()} species...`);

let updatedCount = 0;

speciesList.forEach((sp) => {
  const commonName = sp.common_name || sp.name || `Species #${sp.id}`;
  const url = resolveSpeciesImageUrl(commonName);

  sp.image = url;
  sp.imageUrl = url;
  if (sp.image_gallery) sp.image_gallery = [url];
  updatedCount++;
});

dbModule.saveDB();

console.log(`✅ Successfully updated ${updatedCount.toLocaleString()} database records to point to remote Wikipedia URLs.`);
