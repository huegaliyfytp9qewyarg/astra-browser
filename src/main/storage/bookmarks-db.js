const { getDatabase } = require('./database');

function getBookmarksBarId() {
  const db = getDatabase();
  const row = db.prepare('SELECT id FROM bookmarks WHERE parent_id IS NULL AND type = ? AND title = ?')
    .get('folder', 'Bookmarks Bar');
  return row ? row.id : null;
}

function addBookmark(parentId, title, url, favicon) {
  const db = getDatabase();
  const now = Date.now();
  const maxPos = db.prepare('SELECT MAX(position) as max FROM bookmarks WHERE parent_id = ?').get(parentId);
  const position = (maxPos && maxPos.max != null) ? maxPos.max + 1 : 0;

  const result = db.prepare(
    'INSERT INTO bookmarks (parent_id, type, title, url, favicon, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(parentId, 'bookmark', title, url, favicon || null, position, now, now);

  return result.lastInsertRowid;
}

function addFolder(parentId, title) {
  const db = getDatabase();
  const now = Date.now();
  const maxPos = db.prepare('SELECT MAX(position) as max FROM bookmarks WHERE parent_id = ?').get(parentId);
  const position = (maxPos && maxPos.max != null) ? maxPos.max + 1 : 0;

  const result = db.prepare(
    'INSERT INTO bookmarks (parent_id, type, title, url, position, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?, ?)'
  ).run(parentId, 'folder', title, position, now, now);

  return result.lastInsertRowid;
}

function getChildren(folderId) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM bookmarks WHERE parent_id = ? ORDER BY position').all(folderId);
}

function getBookmarksBar() {
  const barId = getBookmarksBarId();
  if (!barId) return [];
  return getChildren(barId);
}

function getAll() {
  const db = getDatabase();
  return db.prepare('SELECT * FROM bookmarks ORDER BY parent_id, position').all();
}

function isBookmarked(url) {
  const db = getDatabase();
  const row = db.prepare('SELECT id FROM bookmarks WHERE url = ? AND type = ?').get(url, 'bookmark');
  return !!row;
}

function removeByUrl(url) {
  const db = getDatabase();
  db.prepare('DELETE FROM bookmarks WHERE url = ? AND type = ?').run(url, 'bookmark');
}

function deleteBookmark(id) {
  const db = getDatabase();
  db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
}

function search(query) {
  const db = getDatabase();
  const pattern = `%${query}%`;
  return db.prepare('SELECT * FROM bookmarks WHERE type = ? AND (title LIKE ? OR url LIKE ?) ORDER BY created_at DESC')
    .all('bookmark', pattern, pattern);
}

module.exports = {
  getBookmarksBarId,
  addBookmark,
  addFolder,
  getChildren,
  getBookmarksBar,
  getAll,
  isBookmarked,
  removeByUrl,
  deleteBookmark,
  search,
};
