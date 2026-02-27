const { getDatabase } = require('./database');

function addVisit(url, title, favicon) {
  const db = getDatabase();
  const existing = db.prepare('SELECT id, visit_count FROM history WHERE url = ?').get(url);

  if (existing) {
    db.prepare('UPDATE history SET title = ?, favicon = ?, visit_time = ?, visit_count = visit_count + 1 WHERE id = ?')
      .run(title || '', favicon || null, Date.now(), existing.id);
  } else {
    db.prepare('INSERT INTO history (url, title, favicon, visit_time, visit_count) VALUES (?, ?, ?, ?, 1)')
      .run(url, title || '', favicon || null, Date.now());
  }
}

function search(query, limit = 50, offset = 0) {
  const db = getDatabase();
  const pattern = `%${query}%`;
  return db.prepare('SELECT * FROM history WHERE url LIKE ? OR title LIKE ? ORDER BY visit_time DESC LIMIT ? OFFSET ?')
    .all(pattern, pattern, limit, offset);
}

function getRecent(limit = 50) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM history ORDER BY visit_time DESC LIMIT ?').all(limit);
}

function deleteEntry(id) {
  const db = getDatabase();
  db.prepare('DELETE FROM history WHERE id = ?').run(id);
}

function clearAll() {
  const db = getDatabase();
  db.prepare('DELETE FROM history').run();
}

function clearOlderThan(days) {
  const db = getDatabase();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  db.prepare('DELETE FROM history WHERE visit_time < ?').run(cutoff);
}

module.exports = { addVisit, search, getRecent, deleteEntry, clearAll, clearOlderThan };
