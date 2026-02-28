/**
 * Chrome Data Import
 * Imports bookmarks and history from Google Chrome into Astra.
 * Runs automatically on first launch if Chrome data is found and Astra data is empty.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * Find Chrome's user data directory (supports Default + numbered profiles)
 */
function getChromeProfileDirs() {
  const dirs = [];
  let base;

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    base = path.join(localAppData, 'Google', 'Chrome', 'User Data');
  } else if (process.platform === 'darwin') {
    base = path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome');
  } else {
    base = path.join(os.homedir(), '.config', 'google-chrome');
  }

  if (!fs.existsSync(base)) return dirs;

  // Default profile
  const defaultDir = path.join(base, 'Default');
  if (fs.existsSync(defaultDir)) dirs.push(defaultDir);

  // Numbered profiles (Profile 1, Profile 2, etc.)
  try {
    const entries = fs.readdirSync(base);
    for (const entry of entries) {
      if (entry.startsWith('Profile ')) {
        const profileDir = path.join(base, entry);
        if (fs.existsSync(profileDir)) dirs.push(profileDir);
      }
    }
  } catch { /* ignore */ }

  return dirs;
}

/**
 * Import bookmarks from Chrome's Bookmarks JSON file
 */
function importBookmarks(profileDir) {
  const bookmarksFile = path.join(profileDir, 'Bookmarks');
  if (!fs.existsSync(bookmarksFile)) return [];

  try {
    const data = JSON.parse(fs.readFileSync(bookmarksFile, 'utf8'));
    const bookmarks = [];

    function traverse(node) {
      if (node.type === 'url' && node.url) {
        bookmarks.push({
          title: node.name || node.url,
          url: node.url,
        });
      }
      if (node.children) {
        node.children.forEach(traverse);
      }
    }

    if (data.roots) {
      if (data.roots.bookmark_bar) traverse(data.roots.bookmark_bar);
      if (data.roots.other) traverse(data.roots.other);
      if (data.roots.synced) traverse(data.roots.synced);
    }

    console.log(`[ChromeImport] Found ${bookmarks.length} bookmarks in ${profileDir}`);
    return bookmarks;
  } catch (err) {
    console.error('[ChromeImport] Bookmarks parse error:', err.message);
    return [];
  }
}

/**
 * Import history from Chrome's History SQLite database
 * Chrome locks this file while running, so we copy it first.
 */
async function importHistory(profileDir) {
  const historyFile = path.join(profileDir, 'History');
  if (!fs.existsSync(historyFile)) return [];

  const tmpFile = path.join(os.tmpdir(), `astra-chrome-history-${Date.now()}.db`);

  try {
    // Copy the locked database file
    fs.copyFileSync(historyFile, tmpFile);

    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    const fileBuffer = fs.readFileSync(tmpFile);
    const db = new SQL.Database(fileBuffer);

    const results = db.exec(
      'SELECT url, title, visit_count, last_visit_time FROM urls ORDER BY last_visit_time DESC LIMIT 5000'
    );

    db.close();
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }

    if (!results.length || !results[0].values.length) return [];

    const history = results[0].values.map((row) => ({
      url: row[0],
      title: row[1] || '',
      visitCount: row[2] || 1,
      // Chrome time: microseconds since 1601-01-01 → JS timestamp (ms since 1970-01-01)
      visitTime: Math.floor(row[3] / 1000) - 11644473600000,
    }));

    console.log(`[ChromeImport] Found ${history.length} history entries in ${profileDir}`);
    return history;
  } catch (err) {
    console.error('[ChromeImport] History import error:', err.message);
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    return [];
  }
}

/**
 * Run the full import: bookmarks + history from Chrome into Astra storage
 * Returns { bookmarks: number, history: number }
 */
async function runImport() {
  const profileDirs = getChromeProfileDirs();
  if (profileDirs.length === 0) {
    console.log('[ChromeImport] No Chrome profile directories found');
    return { bookmarks: 0, history: 0, error: 'Chrome not found' };
  }

  // Use the first profile (Default)
  const profileDir = profileDirs[0];
  console.log(`[ChromeImport] Importing from: ${profileDir}`);

  // Import bookmarks
  const chromeBookmarks = importBookmarks(profileDir);
  let importedBookmarks = 0;

  if (chromeBookmarks.length > 0) {
    try {
      const bookmarksDb = require('./storage/bookmarks-db');
      const barId = bookmarksDb.getBookmarksBarId();
      if (barId) {
        // Check which bookmarks already exist
        const existing = bookmarksDb.getAll();
        const existingUrls = new Set(existing.filter(b => b.url).map(b => b.url));

        for (const bm of chromeBookmarks) {
          if (!existingUrls.has(bm.url)) {
            bookmarksDb.addBookmark(barId, bm.title, bm.url, null);
            importedBookmarks++;
          }
        }
        console.log(`[ChromeImport] Imported ${importedBookmarks} new bookmarks`);
      }
    } catch (err) {
      console.error('[ChromeImport] Bookmark storage error:', err.message);
    }
  }

  // Import history
  let importedHistory = 0;
  try {
    const chromeHistory = await importHistory(profileDir);
    if (chromeHistory.length > 0) {
      const historyDb = require('./storage/history-db');

      for (const entry of chromeHistory) {
        if (entry.url && !entry.url.startsWith('chrome://') && !entry.url.startsWith('chrome-extension://')) {
          historyDb.addVisit(entry.url, entry.title, null);
          importedHistory++;
        }
      }
      console.log(`[ChromeImport] Imported ${importedHistory} history entries`);
    }
  } catch (err) {
    console.error('[ChromeImport] History storage error:', err.message);
  }

  return { bookmarks: importedBookmarks, history: importedHistory };
}

/**
 * Check if Chrome data exists and Astra is fresh (no user bookmarks yet)
 */
function shouldAutoImport() {
  const profileDirs = getChromeProfileDirs();
  if (profileDirs.length === 0) return false;

  // Check if Astra already has user bookmarks
  try {
    const bookmarksDb = require('./storage/bookmarks-db');
    const all = bookmarksDb.getAll();
    // Only the Bookmarks Bar folder exists = fresh install
    const userBookmarks = all.filter(b => b.type === 'bookmark');
    return userBookmarks.length === 0;
  } catch {
    return false;
  }
}

module.exports = { runImport, shouldAutoImport, getChromeProfileDirs };
