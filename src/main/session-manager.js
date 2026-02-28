const path = require('path');
const { app } = require('electron');
const fs = require('fs');

const sessionFile = path.join(app.getPath('userData'), 'session.json');

function saveSession(tabs) {
  try {
    const urls = tabs
      .map((t) => t.url)
      .filter((u) => u && !u.startsWith('astra://newtab'));
    if (urls.length === 0) {
      // Don't save empty sessions
      try { fs.unlinkSync(sessionFile); } catch { /* ignore */ }
      return;
    }
    fs.writeFileSync(sessionFile, JSON.stringify({ tabs: urls, timestamp: Date.now() }));
  } catch (err) {
    console.error('[Session] Save error:', err);
  }
}

function restoreSession() {
  try {
    if (!fs.existsSync(sessionFile)) return null;
    const data = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
    // Delete session file after reading so stale sessions don't persist
    fs.unlinkSync(sessionFile);
    if (data.tabs && data.tabs.length > 0) return data.tabs;
  } catch (err) {
    console.error('[Session] Restore error:', err);
  }
  return null;
}

module.exports = { saveSession, restoreSession };
