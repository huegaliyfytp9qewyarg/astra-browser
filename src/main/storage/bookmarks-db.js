// Bookmarks storage using JSON file
const { readJSON, writeJSON } = require('./database');

const BOOKMARKS_FILE = 'bookmarks.json';
let nextId = 1;

function loadBookmarks() {
  const data = readJSON(BOOKMARKS_FILE, null);
  if (!data) {
    // Initialize with default Bookmarks Bar folder
    const now = Date.now();
    const initial = {
      nextId: 2,
      items: [
        { id: 1, parentId: null, type: 'folder', title: 'Bookmarks Bar', url: null, favicon: null, position: 0, createdAt: now, updatedAt: now }
      ]
    };
    writeJSON(BOOKMARKS_FILE, initial);
    nextId = 2;
    return initial.items;
  }
  nextId = data.nextId || 1;
  return data.items || [];
}

function saveBookmarks(items) {
  writeJSON(BOOKMARKS_FILE, { nextId, items });
}

function getBookmarksBarId() {
  const items = loadBookmarks();
  const bar = items.find(b => b.parentId === null && b.type === 'folder' && b.title === 'Bookmarks Bar');
  return bar ? bar.id : null;
}

function addBookmark(parentId, title, url, favicon) {
  const items = loadBookmarks();
  const children = items.filter(b => b.parentId === parentId);
  const maxPos = children.reduce((max, b) => Math.max(max, b.position || 0), -1);
  const now = Date.now();
  const id = nextId++;
  items.push({
    id, parentId, type: 'bookmark', title, url, favicon: favicon || null,
    position: maxPos + 1, createdAt: now, updatedAt: now
  });
  saveBookmarks(items);
  return id;
}

function addFolder(parentId, title) {
  const items = loadBookmarks();
  const children = items.filter(b => b.parentId === parentId);
  const maxPos = children.reduce((max, b) => Math.max(max, b.position || 0), -1);
  const now = Date.now();
  const id = nextId++;
  items.push({
    id, parentId, type: 'folder', title, url: null, favicon: null,
    position: maxPos + 1, createdAt: now, updatedAt: now
  });
  saveBookmarks(items);
  return id;
}

function getChildren(folderId) {
  const items = loadBookmarks();
  return items.filter(b => b.parentId === folderId).sort((a, b) => (a.position || 0) - (b.position || 0));
}

function getBookmarksBar() {
  const barId = getBookmarksBarId();
  if (!barId) return [];
  return getChildren(barId);
}

function getAll() {
  return loadBookmarks();
}

function isBookmarked(url) {
  const items = loadBookmarks();
  return items.some(b => b.url === url && b.type === 'bookmark');
}

function removeByUrl(url) {
  const items = loadBookmarks();
  const filtered = items.filter(b => !(b.url === url && b.type === 'bookmark'));
  saveBookmarks(filtered);
}

function deleteBookmark(id) {
  const items = loadBookmarks();
  const filtered = items.filter(b => b.id !== id);
  saveBookmarks(filtered);
}

function search(query) {
  const items = loadBookmarks();
  const q = query.toLowerCase();
  return items.filter(b => b.type === 'bookmark' && ((b.title && b.title.toLowerCase().includes(q)) || (b.url && b.url.toLowerCase().includes(q))));
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
