// History storage using JSON file
const { readJSON, writeJSON } = require('./database');

const HISTORY_FILE = 'history.json';
let nextId = 1;

function loadHistory() {
  const data = readJSON(HISTORY_FILE, null);
  if (!data) {
    writeJSON(HISTORY_FILE, { nextId: 1, items: [] });
    nextId = 1;
    return [];
  }
  nextId = data.nextId || 1;
  return data.items || [];
}

function saveHistory(items) {
  writeJSON(HISTORY_FILE, { nextId, items });
}

function addVisit(url, title, favicon) {
  const items = loadHistory();
  const existing = items.find(h => h.url === url);

  if (existing) {
    existing.title = title || existing.title;
    existing.favicon = favicon || existing.favicon;
    existing.visitTime = Date.now();
    existing.visitCount = (existing.visitCount || 1) + 1;
  } else {
    const id = nextId++;
    items.push({
      id, url, title: title || '', favicon: favicon || null,
      visitTime: Date.now(), visitCount: 1
    });
  }

  // Keep max 5000 history entries
  if (items.length > 5000) {
    items.sort((a, b) => b.visitTime - a.visitTime);
    items.length = 5000;
  }

  saveHistory(items);
}

function search(query, limit = 50) {
  const items = loadHistory();
  const q = query.toLowerCase();
  return items
    .filter(h => (h.url && h.url.toLowerCase().includes(q)) || (h.title && h.title.toLowerCase().includes(q)))
    .sort((a, b) => b.visitTime - a.visitTime)
    .slice(0, limit);
}

function getRecent(limit = 50) {
  const items = loadHistory();
  return items.sort((a, b) => b.visitTime - a.visitTime).slice(0, limit);
}

function deleteEntry(id) {
  const items = loadHistory();
  const filtered = items.filter(h => h.id !== id);
  saveHistory(filtered);
}

function clearAll() {
  saveHistory([]);
}

function clearOlderThan(days) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const items = loadHistory();
  const filtered = items.filter(h => h.visitTime >= cutoff);
  saveHistory(filtered);
}

module.exports = { addVisit, search, getRecent, deleteEntry, clearAll, clearOlderThan };
