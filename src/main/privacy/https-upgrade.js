const { session, app } = require('electron');
const path = require('path');
const fs = require('fs');

let enabled = true;
const httpsBrokenDomains = new Set();
const statePath = () => path.join(app.getPath('userData'), 'privacy-state.json');

function loadState() {
  try {
    const data = JSON.parse(fs.readFileSync(statePath(), 'utf8'));
    if (typeof data.httpsUpgradeEnabled === 'boolean') enabled = data.httpsUpgradeEnabled;
  } catch { /* first run, defaults to true */ }
}

function saveState() {
  try {
    let data = {};
    try { data = JSON.parse(fs.readFileSync(statePath(), 'utf8')); } catch { /* ignore */ }
    data.httpsUpgradeEnabled = enabled;
    fs.writeFileSync(statePath(), JSON.stringify(data), 'utf8');
  } catch { /* ignore */ }
}

function initHttpsUpgrade() {
  loadState();

  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['http://*/*'] },
    (details, callback) => {
      if (!enabled) {
        callback({});
        return;
      }

      try {
        const url = new URL(details.url);

        // Skip localhost and local network
        if (
          url.hostname === 'localhost' ||
          url.hostname === '127.0.0.1' ||
          url.hostname.startsWith('192.168.') ||
          url.hostname.startsWith('10.') ||
          url.hostname.endsWith('.local')
        ) {
          callback({});
          return;
        }

        // Skip domains known to not support HTTPS
        if (httpsBrokenDomains.has(url.hostname)) {
          callback({});
          return;
        }

        // Upgrade to HTTPS
        url.protocol = 'https:';
        callback({ redirectURL: url.toString() });
      } catch {
        callback({});
      }
    }
  );
}

function markHttpsBroken(hostname) {
  httpsBrokenDomains.add(hostname);
}

function isEnabled() {
  return enabled;
}

function toggle() {
  enabled = !enabled;
  saveState();
  return enabled;
}

module.exports = { initHttpsUpgrade, markHttpsBroken, isEnabled, toggle };
