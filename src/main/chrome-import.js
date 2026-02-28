/**
 * Chrome Data Import
 * Imports bookmarks and history from Google Chrome into Astra.
 * Runs automatically on first launch if Chrome data is found and Astra data is empty.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

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
 * Decrypt Chrome's DPAPI-encrypted master key using PowerShell (Windows only)
 */
async function decryptDPAPI(encryptedData) {
  if (process.platform !== 'win32') return null;

  const { execSync } = require('child_process');
  const b64 = encryptedData.toString('base64');
  const psScript = `Add-Type -AssemblyName System.Security; $d = [System.Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String('${b64}'), $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser); [Convert]::ToBase64String($d)`;

  try {
    const result = execSync(`powershell -NoProfile -Command "${psScript}"`, {
      encoding: 'utf8',
      timeout: 15000,
      windowsHide: true,
    }).trim();
    return Buffer.from(result, 'base64');
  } catch (err) {
    console.error('[ChromeImport] DPAPI decryption failed:', err.message);
    return null;
  }
}

/**
 * Decrypt a single Chrome password using AES-256-GCM
 */
function decryptPassword(encryptedValue, masterKey) {
  if (!encryptedValue || encryptedValue.length < 15) return null;

  const prefix = encryptedValue.slice(0, 3).toString('utf8');
  if (prefix === 'v10' || prefix === 'v20') {
    // AES-256-GCM: 3-byte prefix + 12-byte nonce + ciphertext + 16-byte auth tag
    const nonce = encryptedValue.slice(3, 15);
    const ciphertext = encryptedValue.slice(15, encryptedValue.length - 16);
    const authTag = encryptedValue.slice(encryptedValue.length - 16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, nonce);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
  }

  return null; // Older DPAPI-only passwords not supported
}

/**
 * Import passwords from Chrome's Login Data SQLite database (Windows only)
 */
async function importPasswords(profileDir) {
  if (process.platform !== 'win32') {
    console.log('[ChromeImport] Password import only supported on Windows (DPAPI)');
    return [];
  }

  const localStatePath = path.join(profileDir, '..', 'Local State');
  if (!fs.existsSync(localStatePath)) return [];

  const loginDataPath = path.join(profileDir, 'Login Data');
  if (!fs.existsSync(loginDataPath)) return [];

  try {
    // Step 1: Get encrypted master key from Local State
    const localState = JSON.parse(fs.readFileSync(localStatePath, 'utf8'));
    const encryptedKeyB64 = localState.os_crypt && localState.os_crypt.encrypted_key;
    if (!encryptedKeyB64) {
      console.log('[ChromeImport] No os_crypt.encrypted_key found in Local State');
      return [];
    }

    // Step 2: Decode and strip "DPAPI" prefix (5 bytes)
    const encryptedKeyFull = Buffer.from(encryptedKeyB64, 'base64');
    const encryptedKey = encryptedKeyFull.slice(5);

    // Step 3: Decrypt master key using DPAPI
    const masterKey = await decryptDPAPI(encryptedKey);
    if (!masterKey) {
      console.log('[ChromeImport] Failed to decrypt Chrome master key');
      return [];
    }

    // Step 4: Copy and read Login Data SQLite
    const tmpFile = path.join(os.tmpdir(), `astra-chrome-logins-${Date.now()}.db`);
    fs.copyFileSync(loginDataPath, tmpFile);

    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    const fileBuffer = fs.readFileSync(tmpFile);
    const db = new SQL.Database(fileBuffer);

    const results = db.exec(
      'SELECT origin_url, username_value, password_value FROM logins WHERE blacklisted_by_user = 0'
    );

    db.close();
    try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }

    if (!results.length || !results[0].values.length) return [];

    // Step 5: Decrypt each password
    const passwords = [];
    for (const row of results[0].values) {
      const url = row[0];
      const username = row[1];
      const encryptedPw = row[2];

      if (!username || !encryptedPw) continue;

      try {
        const pwBuffer = Buffer.from(encryptedPw);
        const password = decryptPassword(pwBuffer, masterKey);
        if (password) {
          passwords.push({ url, username, password });
        }
      } catch { /* skip entries that fail decryption */ }
    }

    console.log(`[ChromeImport] Found ${passwords.length} passwords in ${profileDir}`);
    return passwords;
  } catch (err) {
    console.error('[ChromeImport] Password import error:', err.message);
    return [];
  }
}

/**
 * Run the full import: bookmarks + history + passwords from Chrome into Astra storage
 * Returns { bookmarks: number, history: number, passwords: number }
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
        importedBookmarks = bookmarksDb.bulkAddBookmarks(barId, chromeBookmarks);
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
      const filtered = chromeHistory.filter(
        (e) => e.url && !e.url.startsWith('chrome://') && !e.url.startsWith('chrome-extension://')
      );
      importedHistory = historyDb.bulkAddVisits(filtered);
      console.log(`[ChromeImport] Imported ${importedHistory} history entries`);
    }
  } catch (err) {
    console.error('[ChromeImport] History storage error:', err.message);
  }

  // Import passwords (Windows only — uses DPAPI)
  let importedPasswords = 0;
  try {
    const chromePasswords = await importPasswords(profileDir);
    if (chromePasswords.length > 0) {
      const passwordsDb = require('./storage/passwords-db');
      importedPasswords = passwordsDb.bulkAddPasswords(chromePasswords);
      console.log(`[ChromeImport] Imported ${importedPasswords} passwords`);
    }
  } catch (err) {
    console.error('[ChromeImport] Password storage error:', err.message);
  }

  return { bookmarks: importedBookmarks, history: importedHistory, passwords: importedPasswords };
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
