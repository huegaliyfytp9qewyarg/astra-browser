/**
 * Browser Data Import
 * Imports bookmarks, history, and passwords from installed browsers into Astra.
 * Supports: Chrome, Edge, Brave, Opera, Vivaldi, Firefox
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

// ── Browser Definitions ──
const BROWSERS = {
  chrome: {
    name: 'Google Chrome',
    type: 'chromium',
    paths: {
      win32: () => path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Google', 'Chrome', 'User Data'),
      darwin: () => path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome'),
      linux: () => path.join(os.homedir(), '.config', 'google-chrome'),
    },
  },
  edge: {
    name: 'Microsoft Edge',
    type: 'chromium',
    paths: {
      win32: () => path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Microsoft', 'Edge', 'User Data'),
      darwin: () => path.join(os.homedir(), 'Library', 'Application Support', 'Microsoft Edge'),
      linux: () => path.join(os.homedir(), '.config', 'microsoft-edge'),
    },
  },
  brave: {
    name: 'Brave',
    type: 'chromium',
    paths: {
      win32: () => path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'BraveSoftware', 'Brave-Browser', 'User Data'),
      darwin: () => path.join(os.homedir(), 'Library', 'Application Support', 'BraveSoftware', 'Brave-Browser'),
      linux: () => path.join(os.homedir(), '.config', 'BraveSoftware', 'Brave-Browser'),
    },
  },
  opera: {
    name: 'Opera',
    type: 'chromium',
    paths: {
      win32: () => path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Opera Software', 'Opera Stable'),
      darwin: () => path.join(os.homedir(), 'Library', 'Application Support', 'com.operasoftware.Opera'),
      linux: () => path.join(os.homedir(), '.config', 'opera'),
    },
    // Opera stores profiles directly in the base dir (no "Default" subfolder on some installs)
    flatProfile: true,
  },
  vivaldi: {
    name: 'Vivaldi',
    type: 'chromium',
    paths: {
      win32: () => path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Vivaldi', 'User Data'),
      darwin: () => path.join(os.homedir(), 'Library', 'Application Support', 'Vivaldi'),
      linux: () => path.join(os.homedir(), '.config', 'vivaldi'),
    },
  },
  firefox: {
    name: 'Mozilla Firefox',
    type: 'firefox',
    paths: {
      win32: () => path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Mozilla', 'Firefox', 'Profiles'),
      darwin: () => path.join(os.homedir(), 'Library', 'Application Support', 'Firefox', 'Profiles'),
      linux: () => path.join(os.homedir(), '.mozilla', 'firefox'),
    },
  },
};

// ── Detect installed browsers ──
function getAvailableBrowsers() {
  const available = [];
  for (const [key, browser] of Object.entries(BROWSERS)) {
    const pathFn = browser.paths[process.platform];
    if (!pathFn) continue;
    const basePath = pathFn();
    if (fs.existsSync(basePath)) {
      available.push({ id: key, name: browser.name, type: browser.type });
    }
  }
  return available;
}

// ── Chromium profile detection ──
function getChromiumProfileDirs(browserKey) {
  const browser = BROWSERS[browserKey];
  if (!browser) return [];
  const pathFn = browser.paths[process.platform];
  if (!pathFn) return [];

  const base = pathFn();
  if (!fs.existsSync(base)) return [];

  const dirs = [];

  // Opera stores data directly in base dir
  if (browser.flatProfile) {
    if (fs.existsSync(path.join(base, 'Bookmarks')) || fs.existsSync(path.join(base, 'History'))) {
      dirs.push(base);
    }
  }

  // Default profile
  const defaultDir = path.join(base, 'Default');
  if (fs.existsSync(defaultDir)) dirs.push(defaultDir);

  // Numbered profiles
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

// ── Firefox profile detection ──
function getFirefoxProfileDirs() {
  const browser = BROWSERS.firefox;
  const pathFn = browser.paths[process.platform];
  if (!pathFn) return [];

  const profilesBase = pathFn();
  if (!fs.existsSync(profilesBase)) return [];

  const dirs = [];

  // On Windows/Mac, profiles.ini is one level up
  const iniPath = path.join(path.dirname(profilesBase), 'profiles.ini');
  if (fs.existsSync(iniPath)) {
    try {
      const ini = fs.readFileSync(iniPath, 'utf8');
      const profileBlocks = ini.split(/\[Profile\d+\]/);
      for (const block of profileBlocks) {
        const pathMatch = block.match(/Path=(.+)/);
        const isRelMatch = block.match(/IsRelative=(\d)/);
        if (pathMatch) {
          const profilePath = pathMatch[1].trim();
          const isRelative = !isRelMatch || isRelMatch[1] === '1';
          const fullPath = isRelative
            ? path.join(path.dirname(profilesBase), profilePath)
            : profilePath;
          if (fs.existsSync(fullPath)) dirs.push(fullPath);
        }
      }
    } catch { /* ignore */ }
  }

  // Fallback: scan Profiles directory for .default directories
  if (dirs.length === 0) {
    try {
      const entries = fs.readdirSync(profilesBase);
      for (const entry of entries) {
        const fullDir = path.join(profilesBase, entry);
        if (fs.existsSync(path.join(fullDir, 'places.sqlite'))) {
          dirs.push(fullDir);
        }
      }
    } catch { /* ignore */ }
  }

  return dirs;
}

// ── Chromium bookmarks ──
function importChromiumBookmarks(profileDir) {
  const bookmarksFile = path.join(profileDir, 'Bookmarks');
  if (!fs.existsSync(bookmarksFile)) return [];

  try {
    const data = JSON.parse(fs.readFileSync(bookmarksFile, 'utf8'));
    const bookmarks = [];

    function traverse(node) {
      if (node.type === 'url' && node.url) {
        bookmarks.push({ title: node.name || node.url, url: node.url });
      }
      if (node.children) node.children.forEach(traverse);
    }

    if (data.roots) {
      if (data.roots.bookmark_bar) traverse(data.roots.bookmark_bar);
      if (data.roots.other) traverse(data.roots.other);
      if (data.roots.synced) traverse(data.roots.synced);
    }

    return bookmarks;
  } catch (err) {
    console.error('[BrowserImport] Chromium bookmarks parse error:', err.message);
    return [];
  }
}

// ── Chromium history ──
async function importChromiumHistory(profileDir) {
  const historyFile = path.join(profileDir, 'History');
  if (!fs.existsSync(historyFile)) return [];

  const tmpFile = path.join(os.tmpdir(), `astra-browser-history-${Date.now()}.db`);
  try {
    fs.copyFileSync(historyFile, tmpFile);
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    const db = new SQL.Database(fs.readFileSync(tmpFile));

    const results = db.exec(
      'SELECT url, title, visit_count, last_visit_time FROM urls ORDER BY last_visit_time DESC LIMIT 5000'
    );
    db.close();
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }

    if (!results.length || !results[0].values.length) return [];

    return results[0].values.map((row) => ({
      url: row[0],
      title: row[1] || '',
      visitCount: row[2] || 1,
      visitTime: Math.floor(row[3] / 1000) - 11644473600000,
    }));
  } catch (err) {
    console.error('[BrowserImport] Chromium history error:', err.message);
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    return [];
  }
}

// ── Chromium passwords (Windows DPAPI) ──
async function decryptDPAPI(encryptedData) {
  if (process.platform !== 'win32') return null;
  const { execSync } = require('child_process');
  const b64 = encryptedData.toString('base64');
  const psScript = `Add-Type -AssemblyName System.Security; $d = [System.Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String('${b64}'), $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser); [Convert]::ToBase64String($d)`;

  try {
    const result = execSync(`powershell -NoProfile -Command "${psScript}"`, {
      encoding: 'utf8', timeout: 15000, windowsHide: true,
    }).trim();
    return Buffer.from(result, 'base64');
  } catch {
    return null;
  }
}

function decryptPassword(encryptedValue, masterKey) {
  if (!encryptedValue || encryptedValue.length < 15) return null;
  const prefix = encryptedValue.slice(0, 3).toString('utf8');
  if (prefix === 'v10' || prefix === 'v20') {
    const nonce = encryptedValue.slice(3, 15);
    const ciphertext = encryptedValue.slice(15, encryptedValue.length - 16);
    const authTag = encryptedValue.slice(encryptedValue.length - 16);
    const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, nonce);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
  }
  return null;
}

async function importChromiumPasswords(profileDir) {
  if (process.platform !== 'win32') return [];

  const localStatePath = path.join(profileDir, '..', 'Local State');
  if (!fs.existsSync(localStatePath)) return [];
  const loginDataPath = path.join(profileDir, 'Login Data');
  if (!fs.existsSync(loginDataPath)) return [];

  try {
    const localState = JSON.parse(fs.readFileSync(localStatePath, 'utf8'));
    const encryptedKeyB64 = localState.os_crypt && localState.os_crypt.encrypted_key;
    if (!encryptedKeyB64) return [];

    const encryptedKey = Buffer.from(encryptedKeyB64, 'base64').slice(5);
    const masterKey = await decryptDPAPI(encryptedKey);
    if (!masterKey) return [];

    const tmpFile = path.join(os.tmpdir(), `astra-browser-logins-${Date.now()}.db`);
    fs.copyFileSync(loginDataPath, tmpFile);

    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    const db = new SQL.Database(fs.readFileSync(tmpFile));
    const results = db.exec(
      'SELECT origin_url, username_value, password_value FROM logins WHERE blacklisted_by_user = 0'
    );
    db.close();
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }

    if (!results.length || !results[0].values.length) return [];

    const passwords = [];
    for (const row of results[0].values) {
      if (!row[1] || !row[2]) continue;
      try {
        const password = decryptPassword(Buffer.from(row[2]), masterKey);
        if (password) passwords.push({ url: row[0], username: row[1], password });
      } catch { /* skip */ }
    }
    return passwords;
  } catch (err) {
    console.error('[BrowserImport] Chromium passwords error:', err.message);
    return [];
  }
}

// ── Firefox bookmarks ──
async function importFirefoxBookmarks(profileDir) {
  const placesFile = path.join(profileDir, 'places.sqlite');
  if (!fs.existsSync(placesFile)) return [];

  const tmpFile = path.join(os.tmpdir(), `astra-ff-places-bm-${Date.now()}.db`);
  try {
    fs.copyFileSync(placesFile, tmpFile);
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    const db = new SQL.Database(fs.readFileSync(tmpFile));

    // Firefox stores bookmarks in moz_bookmarks joined with moz_places
    const results = db.exec(`
      SELECT p.url, b.title
      FROM moz_bookmarks b
      JOIN moz_places p ON b.fk = p.id
      WHERE b.type = 1 AND p.url NOT LIKE 'place:%'
      ORDER BY b.dateAdded DESC
      LIMIT 5000
    `);
    db.close();
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }

    if (!results.length || !results[0].values.length) return [];

    return results[0].values.map((row) => ({
      url: row[0],
      title: row[1] || row[0],
    }));
  } catch (err) {
    console.error('[BrowserImport] Firefox bookmarks error:', err.message);
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    return [];
  }
}

// ── Firefox history ──
async function importFirefoxHistory(profileDir) {
  const placesFile = path.join(profileDir, 'places.sqlite');
  if (!fs.existsSync(placesFile)) return [];

  const tmpFile = path.join(os.tmpdir(), `astra-ff-places-hist-${Date.now()}.db`);
  try {
    fs.copyFileSync(placesFile, tmpFile);
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    const db = new SQL.Database(fs.readFileSync(tmpFile));

    const results = db.exec(`
      SELECT p.url, p.title, p.visit_count, p.last_visit_date
      FROM moz_places p
      WHERE p.url NOT LIKE 'place:%'
        AND p.url NOT LIKE 'about:%'
        AND p.last_visit_date IS NOT NULL
      ORDER BY p.last_visit_date DESC
      LIMIT 5000
    `);
    db.close();
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }

    if (!results.length || !results[0].values.length) return [];

    return results[0].values.map((row) => ({
      url: row[0],
      title: row[1] || '',
      visitCount: row[2] || 1,
      // Firefox time: microseconds since epoch
      visitTime: Math.floor((row[3] || 0) / 1000),
    }));
  } catch (err) {
    console.error('[BrowserImport] Firefox history error:', err.message);
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    return [];
  }
}

// ── Main import function ──
async function runImport(browserKey) {
  if (!browserKey) browserKey = 'chrome'; // default fallback

  const browser = BROWSERS[browserKey];
  if (!browser) {
    return { bookmarks: 0, history: 0, passwords: 0, error: 'Unknown browser' };
  }

  let profileDirs;
  if (browser.type === 'firefox') {
    profileDirs = getFirefoxProfileDirs();
  } else {
    profileDirs = getChromiumProfileDirs(browserKey);
  }

  if (profileDirs.length === 0) {
    return { bookmarks: 0, history: 0, passwords: 0, error: `${browser.name} not found` };
  }

  const profileDir = profileDirs[0];
  console.log(`[BrowserImport] Importing from ${browser.name}: ${profileDir}`);

  // Import bookmarks
  let rawBookmarks;
  if (browser.type === 'firefox') {
    rawBookmarks = await importFirefoxBookmarks(profileDir);
  } else {
    rawBookmarks = importChromiumBookmarks(profileDir);
  }

  let importedBookmarks = 0;
  if (rawBookmarks.length > 0) {
    try {
      const bookmarksDb = require('./storage/bookmarks-db');
      const barId = bookmarksDb.getBookmarksBarId();
      if (barId) {
        importedBookmarks = bookmarksDb.bulkAddBookmarks(barId, rawBookmarks);
      }
    } catch (err) {
      console.error('[BrowserImport] Bookmark storage error:', err.message);
    }
  }

  // Import history
  let importedHistory = 0;
  try {
    let rawHistory;
    if (browser.type === 'firefox') {
      rawHistory = await importFirefoxHistory(profileDir);
    } else {
      rawHistory = await importChromiumHistory(profileDir);
    }
    if (rawHistory.length > 0) {
      const historyDb = require('./storage/history-db');
      const filtered = rawHistory.filter(
        (e) => e.url && !e.url.startsWith('chrome://') && !e.url.startsWith('chrome-extension://') && !e.url.startsWith('about:')
      );
      importedHistory = historyDb.bulkAddVisits(filtered);
    }
  } catch (err) {
    console.error('[BrowserImport] History storage error:', err.message);
  }

  // Import passwords (Chromium only, Windows DPAPI)
  let importedPasswords = 0;
  if (browser.type === 'chromium') {
    try {
      const rawPasswords = await importChromiumPasswords(profileDir);
      if (rawPasswords.length > 0) {
        const passwordsDb = require('./storage/passwords-db');
        importedPasswords = passwordsDb.bulkAddPasswords(rawPasswords);
      }
    } catch (err) {
      console.error('[BrowserImport] Password storage error:', err.message);
    }
  }

  console.log(`[BrowserImport] ${browser.name}: ${importedBookmarks} bookmarks, ${importedHistory} history, ${importedPasswords} passwords`);
  return { bookmarks: importedBookmarks, history: importedHistory, passwords: importedPasswords };
}

/**
 * Auto-import: pick the best available browser on first launch
 */
function shouldAutoImport() {
  try {
    const bookmarksDb = require('./storage/bookmarks-db');
    const all = bookmarksDb.getAll();
    const userBookmarks = all.filter(b => b.type === 'bookmark');
    if (userBookmarks.length > 0) return false;
  } catch {
    return false;
  }

  return getAvailableBrowsers().length > 0;
}

function getAutoImportBrowser() {
  const priority = ['chrome', 'edge', 'brave', 'firefox', 'vivaldi', 'opera'];
  const available = getAvailableBrowsers();
  for (const key of priority) {
    if (available.find(b => b.id === key)) return key;
  }
  return null;
}

module.exports = { runImport, shouldAutoImport, getAutoImportBrowser, getAvailableBrowsers, BROWSERS };
