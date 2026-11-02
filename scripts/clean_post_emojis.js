const path = require('path');
const Database = require(path.join(__dirname, '..', 'backend', 'node_modules', 'better-sqlite3'));

const db = new Database(path.join(__dirname, '..', 'backend', 'local_ecotrack.db'));

const posts = [
  {
    id: 1,
    content: "🦅 **Wildlife Protection Guide**: When observing nesting birds of prey or wild fauna, maintain a distance of at least 50 meters. Avoid loud noises that disturb territorial parents during brooding season. Feel free to ask any species observation questions below!"
  },
  {
    id: 2,
    content: "🏆 **Training Tip of the Day**: Consistent positive reinforcement during recall drills improves response speed by over 300%! Always reward with high-value treats within 1.5 seconds of execution. Check out Shadow's agility progress below!"
  },
  {
    id: 3,
    content: "🌱 **Wildlife Protection Update**: Successfully observed and documented a juvenile Peregrine Falcon in the wild with @dr_ananya! AI Scanner verified 99.8% species accuracy. Thank you to everyone supporting our community conservation drives! 🦅"
  }
];

const stmt = db.prepare('UPDATE Posts SET content = ? WHERE id = ?');
for (const p of posts) {
  stmt.run(p.content, p.id);
  console.log(`Updated post ${p.id} with clean emojis`);
}

db.close();
console.log('✅ All posts updated cleanly with proper emojis.');
