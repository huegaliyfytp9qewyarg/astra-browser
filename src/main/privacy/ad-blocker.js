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
    // Read existing file to preserve other keys (e.g. httpsUpgradeEnabled)
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
    const { ElectronBlocker } = await import('@ghostery/adblocker-electron');
    const fetch = (await import('cross-fetch')).default;

    const cachePath = path.join(app.getPath('userData'), 'adblocker-engine.bin');

    blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch, {
      path: cachePath,
      read: fs.promises.readFile,
      write: fs.promises.writeFile,
    });

    // Apply saved state — if user had it disabled, don't enable
    if (enabled) {
      blocker.enableBlockingInSession(session.defaultSession);
    }

    // Track blocked requests — classify as ad or tracker
    blocker.on('request-blocked', (request) => {
      if (isTrackerUrl(request.url)) {
        blockedTrackers++;
      } else {
        blockedAds++;
      }
    });

    console.log('Ad blocker initialized successfully');
  } catch (err) {
    console.error('Failed to initialize ad blocker:', err.message);
    enabled = false;
  }
}

function isEnabled() {
  return enabled;
}

function toggle() {
  if (!blocker) return false;

  if (enabled) {
    blocker.disableBlockingInSession(session.defaultSession);
    enabled = false;
  } else {
    blocker.enableBlockingInSession(session.defaultSession);
    enabled = true;
  }
  saveState();
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
