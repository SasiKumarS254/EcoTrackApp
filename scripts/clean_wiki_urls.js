const fs = require('fs');
const path = require('path');

function cleanFile(filePath) {
  const absolutePath = path.resolve(filePath);
  let content = fs.readFileSync(absolutePath, 'utf8');
  // Convert https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/File.jpg/1200px-File.jpg -> https://upload.wikimedia.org/wikipedia/commons/a/ab/File.jpg
  const updated = content.replace(/https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/([0-9a-f]\/[0-9a-f][0-9a-f]\/[^\/]+)\/\d+px-[^\s\"\'\`]+/gi, 'https://upload.wikimedia.org/wikipedia/commons/$1');
  
  if (content !== updated) {
    fs.writeFileSync(absolutePath, updated, 'utf8');
    console.log('✅ Cleaned Wikipedia URLs in', filePath);
  } else {
    console.log('ℹ️ No thumb URLs to clean in', filePath);
  }
}

cleanFile('backend/db.js');
cleanFile('website/app.js');
cleanFile('frontend/data/animals.ts');
