const { session } = require('electron');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

let blocker = null;
let enabled = true;
let blockedCount = 0;

async function initAdBlocker() {
  try {
    const { ElectronBlocker } = await import('@ghostery/adblocker-electron');
    const fetch = (await import('cross-fetch')).default;

    const cachePath = path.join(app.getPath('userData'), 'adblocker-engine.bin');

    blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch, {
      path: cachePath,
      read: fs.promises.readFile,
      write: fs.promises.writeFile,
    });

    blocker.enableBlockingInSession(session.defaultSession);

    // Track blocked requests
    blocker.on('request-blocked', () => {
      blockedCount++;
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
  return enabled;
}

function getBlockedCount() {
  return blockedCount;
}

module.exports = { initAdBlocker, isEnabled, toggle, getBlockedCount };
