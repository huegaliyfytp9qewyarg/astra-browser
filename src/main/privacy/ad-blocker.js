const { session } = require('electron');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

let blocker = null;
let enabled = true;
let blockedAds = 0;
let blockedTrackers = 0;
let siteWhitelist = new Set();
const whitelistPath = () => path.join(app.getPath('userData'), 'ad-whitelist.json');
const statePath = () => path.join(app.getPath('userData'), 'privacy-state.json');

// Known tracker domains (subset for classification)
const TRACKER_PATTERNS = [
  'google-analytics', 'googletagmanager', 'doubleclick', 'facebook.com/tr',
  'connect.facebook', 'analytics', 'tracking', 'tracker', 'pixel',
  'hotjar', 'mixpanel', 'segment.io', 'segment.com', 'amplitude',
  'sentry.io', 'newrelic', 'fullstory', 'mouseflow', 'clarity.ms',
  'scorecardresearch', 'quantserve', 'omtrdc', 'demdex', 'krxd',
  'bluekai', 'adnxs', 'criteo', 'taboola', 'outbrain',
];

function loadWhitelist() {
  try {
    const data = JSON.parse(fs.readFileSync(whitelistPath(), 'utf8'));
    siteWhitelist = new Set(data);
  } catch {
    siteWhitelist = new Set();
  }
}

function saveWhitelist() {
  try {
    fs.writeFileSync(whitelistPath(), JSON.stringify([...siteWhitelist]), 'utf8');
  } catch { /* ignore */ }
}

function loadState() {
  try {
    const data = JSON.parse(fs.readFileSync(statePath(), 'utf8'));
    if (typeof data.adBlockEnabled === 'boolean') enabled = data.adBlockEnabled;
  } catch { /* first run, defaults to true */ }
}

function saveState() {
  try {
    let data = {};
    try { data = JSON.parse(fs.readFileSync(statePath(), 'utf8')); } catch { /* ignore */ }
    data.adBlockEnabled = enabled;
    fs.writeFileSync(statePath(), JSON.stringify(data), 'utf8');
  } catch { /* ignore */ }
}

function isTrackerUrl(url) {
  const lower = url.toLowerCase();
  return TRACKER_PATTERNS.some((p) => lower.includes(p));
}

async function initAdBlocker() {
  loadWhitelist();
  loadState();

  try {
    // Use require() for CJS compatibility in Electron's packaged app
    let ElectronBlocker;
    try {
      ElectronBlocker = require('@ghostery/adblocker-electron').ElectronBlocker;
    } catch {
      // Fallback to dynamic import for ESM-only builds
      const mod = await import('@ghostery/adblocker-electron');
      ElectronBlocker = mod.ElectronBlocker;
    }

    let fetch;
    try {
      fetch = require('cross-fetch');
      if (fetch.default) fetch = fetch.default;
    } catch {
      const mod = await import('cross-fetch');
      fetch = mod.default;
    }

    const cachePath = path.join(app.getPath('userData'), 'adblocker-engine.bin');

    blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch, {
      path: cachePath,
      read: fs.promises.readFile,
      write: fs.promises.writeFile,
    });

    // Always enable first, then disable if saved state says so
    blocker.enableBlockingInSession(session.defaultSession);

    if (!enabled) {
      blocker.disableBlockingInSession(session.defaultSession);
    }

    // Track blocked requests — classify as ad or tracker
    blocker.on('request-blocked', (request) => {
      if (isTrackerUrl(request.url)) {
        blockedTrackers++;
      } else {
        blockedAds++;
      }
    });

    console.log('[AdBlocker] Initialized successfully, enabled:', enabled);
  } catch (err) {
    console.error('[AdBlocker] Failed to initialize:', err.message, err.stack);
    enabled = false;
  }
}

function isEnabled() {
  return enabled;
}

function toggle() {
  if (!blocker) {
    console.error('[AdBlocker] Cannot toggle — blocker not initialized');
    return false;
  }

  if (enabled) {
    blocker.disableBlockingInSession(session.defaultSession);
    enabled = false;
  } else {
    blocker.enableBlockingInSession(session.defaultSession);
    enabled = true;
  }
  saveState();
  console.log('[AdBlocker] Toggled, now:', enabled);
  return enabled;
}

function getBlockedCount() {
  return blockedAds + blockedTrackers;
}

function getBlockedAds() {
  return blockedAds;
}

function getBlockedTrackers() {
  return blockedTrackers;
}

// Per-site whitelist (disable ad blocking on these domains)
function isWhitelisted(domain) {
  return siteWhitelist.has(domain);
}

function addToWhitelist(domain) {
  siteWhitelist.add(domain);
  saveWhitelist();
}

function removeFromWhitelist(domain) {
  siteWhitelist.delete(domain);
  saveWhitelist();
}

function getWhitelist() {
  return [...siteWhitelist];
}

// Check if blocking should apply to a given URL
function shouldBlock(url) {
  if (!enabled) return false;
  try {
    const domain = new URL(url).hostname;
    return !siteWhitelist.has(domain);
  } catch {
    return enabled;
  }
}

module.exports = {
  initAdBlocker, isEnabled, toggle,
  getBlockedCount, getBlockedAds, getBlockedTrackers,
  isWhitelisted, addToWhitelist, removeFromWhitelist, getWhitelist,
  shouldBlock,
};
