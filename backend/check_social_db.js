const Database = require('better-sqlite3');
try {
  const db = new Database('ecotrack_social.db');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log("Tables in ecotrack_social.db:", tables.map(t => t.name));
  for (const t of tables) {
    try {
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${t.name}`).get().count;
      console.log(`Table ${t.name}: ${count} rows`);
      if (count > 0) {
        const sample = db.prepare(`SELECT * FROM ${t.name} LIMIT 1`).get();
        console.log(`  Sample row:`, JSON.stringify(sample));
      }
    } catch(err) {
      console.log(`Error reading table ${t.name}:`, err.message);
    }
  }
} catch(e) {
  console.error("Error:", e.message);
}
