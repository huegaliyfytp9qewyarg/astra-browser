const Database = require('better-sqlite3');
const { app } = require('electron');
const path = require('path');

let db = null;

function getDatabase() {
  if (db) return db;

  const dbPath = path.join(app.getPath('userData'), 'astra.db');
  db = new Database(dbPath);

  // Enable WAL mode for better concurrent performance
  db.pragma('journal_mode = WAL');

  runMigrations();
  return db;
}

function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      title TEXT,
      favicon TEXT,
      visit_time INTEGER NOT NULL,
      visit_count INTEGER DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_history_url ON history(url);
    CREATE INDEX IF NOT EXISTS idx_history_time ON history(visit_time DESC);

    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER REFERENCES bookmarks(id) ON DELETE CASCADE,
      type TEXT CHECK(type IN ('bookmark', 'folder', 'separator')) DEFAULT 'bookmark',
      title TEXT NOT NULL,
      url TEXT,
      favicon TEXT,
      position INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_bookmarks_parent ON bookmarks(parent_id);
  `);

  // Create default bookmarks bar folder if it doesn't exist
  const bar = db.prepare('SELECT id FROM bookmarks WHERE parent_id IS NULL AND type = ? AND title = ?').get('folder', 'Bookmarks Bar');
  if (!bar) {
    const now = Date.now();
    db.prepare('INSERT INTO bookmarks (parent_id, type, title, url, position, created_at, updated_at) VALUES (NULL, ?, ?, NULL, 0, ?, ?)').run('folder', 'Bookmarks Bar', now, now);
  }
}

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDatabase, close };
