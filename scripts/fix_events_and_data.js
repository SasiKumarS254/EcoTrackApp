const fs = require('fs');
const path = require('path');
const backendDir = path.join(__dirname, '..', 'backend');
const Database = require(path.join(backendDir, 'node_modules', 'better-sqlite3'));

// 1. Fix local_ecotrack.db
try {
  const dbPath = path.join(backendDir, 'local_ecotrack.db');
  const db = new Database(dbPath);

  // Fix Event 6
  db.prepare(`
    UPDATE Events SET 
      title = 'Eco Park Wildlife Awareness & Rescue Drive',
      description = 'Hands-on community workshop covering injured wildlife response and rescue safety.',
      long_description = 'Join our certified wildlife rescue team for an immersive outdoor training session at Eco Park. Learn to safely handle birds of prey, small mammals, and urban wildlife emergencies.',
      image = 'https://images.unsplash.com/photo-1535268647677-300dbf3d78d1?w=1200'
    WHERE id = 1791995275302 OR title = 'good'
  `).run();
  console.log('✅ Updated Events in local_ecotrack.db');

  // Fix Mojibake in Posts, Comments, etc.
  const posts = db.prepare('SELECT id, content FROM Posts').all();
  for (const p of posts) {
    if (p.content && p.content.includes('ð')) {
      const fixed = Buffer.from(p.content, 'latin1').toString('utf8');
      db.prepare('UPDATE Posts SET content = ? WHERE id = ?').run(fixed, p.id);
    }
  }
  console.log('✅ Fixed any remaining mojibake in local_ecotrack.db Posts');
  db.close();
} catch (e) {
  console.error('Error on local_ecotrack.db:', e.message);
}

// 2. Fix ecotrack_social.db if present
try {
  const dbPath = path.join(backendDir, 'ecotrack_social.db');
  if (fs.existsSync(dbPath)) {
    const db = new Database(dbPath);
    try {
      db.prepare(`
        UPDATE Events SET 
          title = 'Eco Park Wildlife Awareness & Rescue Drive',
          description = 'Hands-on community workshop covering injured wildlife response and rescue safety.',
          long_description = 'Join our certified wildlife rescue team for an immersive outdoor training session at Eco Park. Learn to safely handle birds of prey, small mammals, and urban wildlife emergencies.',
          image = 'https://images.unsplash.com/photo-1535268647677-300dbf3d78d1?w=1200'
        WHERE id = 1791995275302 OR title = 'good'
      `).run();
      console.log('✅ Updated Events in ecotrack_social.db');
    } catch {}

    const posts = db.prepare('SELECT id, content FROM Posts').all();
    for (const p of posts) {
      if (p.content && p.content.includes('ð')) {
        const fixed = Buffer.from(p.content, 'latin1').toString('utf8');
        db.prepare('UPDATE Posts SET content = ? WHERE id = ?').run(fixed, p.id);
      }
    }
    console.log('✅ Fixed mojibake in ecotrack_social.db Posts');
    db.close();
  }
} catch (e) {
  console.error('Error on ecotrack_social.db:', e.message);
}

// 3. Fix ecotrack_userdata.json
try {
  const p = path.join(backendDir, 'ecotrack_userdata.json');
  if (fs.existsSync(p)) {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (data.events && Array.isArray(data.events)) {
      for (const ev of data.events) {
        if (ev.title === 'good' || ev.id === 1791995275302) {
          ev.title = 'Eco Park Wildlife Awareness & Rescue Drive';
          ev.description = 'Hands-on community workshop covering injured wildlife response and rescue safety.';
          ev.long_description = 'Join our certified wildlife rescue team for an immersive outdoor training session at Eco Park. Learn to safely handle birds of prey, small mammals, and urban wildlife emergencies.';
          ev.image = 'https://images.unsplash.com/photo-1535268647677-300dbf3d78d1?w=1200';
          ev.date_str = '15 August 2026';
          ev.date_iso = '2026-08-15';
          ev.date = '15 August 2026';
        }
      }
      fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
      console.log('✅ Updated events in ecotrack_userdata.json');
    }
  }
} catch (e) {
  console.error('Error on ecotrack_userdata.json:', e.message);
}

// 4. Enrich animals_itis in ecotrack_database.json with real images
try {
  const p = path.join(backendDir, 'ecotrack_database.json');
  if (fs.existsSync(p)) {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    const speciesImages = {
      180092: "https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?w=600", // African Elephant
      183803: "https://images.unsplash.com/photo-1561731216-c3a4d99437d5?w=600", // Bengal Tiger
      180596: "https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?w=600", // German Shepherd Dog
      180587: "https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=600", // Gray Wolf
      180543: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=600", // Persian Cat
      175404: "https://images.unsplash.com/photo-1611689342806-0863700ce1e4?w=600", // Peregrine Falcon
      175005: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=600", // Bald Eagle
      173802: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600", // Green Sea Turtle
      173812: "https://images.unsplash.com/photo-1578326457399-3b34dbbf23b8?w=600", // Komodo Dragon
      173825: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600"  // Axolotl
    };

    if (data.animals_itis && Array.isArray(data.animals_itis)) {
      for (const a of data.animals_itis) {
        if (speciesImages[a.tsn]) {
          a.image = speciesImages[a.tsn];
          a.imageUrl = speciesImages[a.tsn];
        }
      }
      fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
      console.log('✅ Enriched animals_itis in ecotrack_database.json with unique photos');
    }
  }
} catch (e) {
  console.error('Error on ecotrack_database.json:', e.message);
}
