const { autoUpdater } = require('electron-updater');
const { getChromeView } = require('./window-manager');

let updateAvailable = false;
let updateDownloaded = false;
let updateInfo = null;

function init() {
  // Don't check signatures (app is unsigned)
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;

  autoUpdater.on('checking-for-update', () => {
    console.log('[Updater] Checking for updates...');
    sendToChrome('update:checking');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[Updater] Update available:', info.version);
    updateAvailable = true;
    updateInfo = info;
    sendToChrome('update:available', { version: info.version });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[Updater] App is up to date');
    sendToChrome('update:not-available');
  });

  autoUpdater.on('download-progress', (progress) => {
    sendToChrome('update:progress', {
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[Updater] Update downloaded:', info.version);
    updateDownloaded = true;
    updateInfo = info;
    sendToChrome('update:downloaded', { version: info.version });
  });

  autoUpdater.on('error', (err) => {
    console.error('[Updater] Error:', err.message);
    sendToChrome('update:error', { message: err.message });
  });

  // Check for updates after a short delay (let the app finish loading)
  setTimeout(() => {
    checkForUpdates();
  }, 5000);
}

function sendToChrome(channel, data) {
  try {
    const chromeView = getChromeView();
    if (chromeView) {
      chromeView.webContents.send(channel, data || {});
    }
  } catch { /* ignore if chrome view not ready */ }
}

function checkForUpdates() {
  autoUpdater.checkForUpdates().catch((err) => {
    console.error('[Updater] Check failed:', err.message);
  });
}

function installUpdate() {
  if (updateDownloaded) {
    autoUpdater.quitAndInstall(false, true);
  }
}

function getStatus() {
  return {
    updateAvailable,
    updateDownloaded,
    version: updateInfo ? updateInfo.version : null,
    currentVersion: require('../../package.json').version,
  };
}

module.exports = { init, checkForUpdates, installUpdate, getStatus };
