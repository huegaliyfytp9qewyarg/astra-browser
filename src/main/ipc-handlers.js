const { ipcMain } = require('electron');
const { IPC } = require('../shared/constants');
const tabManager = require('./tab-manager');
const navigation = require('./navigation');
const { getMainWindow } = require('./window-manager');

function registerIpcHandlers() {
  // Tab management
  ipcMain.handle(IPC.TAB_CREATE, (_e, url) => {
    return tabManager.createTab(url || undefined);
  });

  ipcMain.handle(IPC.TAB_CLOSE, (_e, tabId) => {
    tabManager.closeTab(tabId);
  });

  ipcMain.handle(IPC.TAB_SWITCH, (_e, tabId) => {
    tabManager.switchTab(tabId);
  });

  ipcMain.handle(IPC.TAB_GET_ALL, () => {
    return tabManager.getAllTabs();
  });

  // Navigation
  ipcMain.handle(IPC.NAV_GO, (_e, input) => {
    navigation.navigate(input);
  });

  ipcMain.handle(IPC.NAV_BACK, () => {
    navigation.goBack();
  });

  ipcMain.handle(IPC.NAV_FORWARD, () => {
    navigation.goForward();
  });

  ipcMain.handle(IPC.NAV_RELOAD, () => {
    navigation.reload();
  });

  ipcMain.handle(IPC.NAV_STOP, () => {
    navigation.stop();
  });

  // Window controls (for frameless window)
  ipcMain.handle(IPC.WINDOW_MINIMIZE, () => {
    const win = getMainWindow();
    if (win) win.minimize();
  });

  ipcMain.handle(IPC.WINDOW_MAXIMIZE, () => {
    const win = getMainWindow();
    if (!win) return;
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  ipcMain.handle(IPC.WINDOW_CLOSE, () => {
    const win = getMainWindow();
    if (win) win.close();
  });

  // Search
  ipcMain.handle(IPC.SEARCH_QUERY, async (_e, query) => {
    try {
      const searchEngine = require('./search-engine');
      return await searchEngine.search(query);
    } catch (err) {
      console.error('Search error:', err);
      return { results: [], error: err.message };
    }
  });

  // Privacy status
  ipcMain.handle(IPC.PRIVACY_GET_STATUS, () => {
    const adBlocker = require('./privacy/ad-blocker');
    const httpsUpgrade = require('./privacy/https-upgrade');
    return {
      adBlockEnabled: adBlocker.isEnabled(),
      httpsUpgradeEnabled: httpsUpgrade.isEnabled(),
      adsBlocked: adBlocker.getBlockedCount(),
    };
  });

  ipcMain.handle(IPC.PRIVACY_TOGGLE_ADS, () => {
    const adBlocker = require('./privacy/ad-blocker');
    return adBlocker.toggle();
  });

  ipcMain.handle(IPC.PRIVACY_TOGGLE_HTTPS, () => {
    const httpsUpgrade = require('./privacy/https-upgrade');
    return httpsUpgrade.toggle();
  });

  // History
  ipcMain.handle(IPC.HISTORY_GET_RECENT, (_e, limit) => {
    const historyDb = require('./storage/history-db');
    return historyDb.getRecent(limit || 50);
  });

  ipcMain.handle(IPC.HISTORY_SEARCH, (_e, query) => {
    const historyDb = require('./storage/history-db');
    return historyDb.search(query);
  });

  ipcMain.handle(IPC.HISTORY_CLEAR, () => {
    const historyDb = require('./storage/history-db');
    historyDb.clearAll();
  });

  ipcMain.handle(IPC.HISTORY_DELETE, (_e, id) => {
    const historyDb = require('./storage/history-db');
    historyDb.deleteEntry(id);
  });

  // Bookmarks
  ipcMain.handle(IPC.BOOKMARKS_ADD, (_e, data) => {
    const bookmarksDb = require('./storage/bookmarks-db');
    const parentId = data.parentId || bookmarksDb.getBookmarksBarId();
    return bookmarksDb.addBookmark(parentId, data.title, data.url, data.favicon);
  });

  ipcMain.handle(IPC.BOOKMARKS_REMOVE, (_e, url) => {
    const bookmarksDb = require('./storage/bookmarks-db');
    bookmarksDb.removeByUrl(url);
  });

  ipcMain.handle(IPC.BOOKMARKS_GET_BAR, () => {
    const bookmarksDb = require('./storage/bookmarks-db');
    return bookmarksDb.getBookmarksBar();
  });

  ipcMain.handle(IPC.BOOKMARKS_GET_ALL, () => {
    const bookmarksDb = require('./storage/bookmarks-db');
    return bookmarksDb.getAll();
  });

  ipcMain.handle(IPC.BOOKMARKS_IS_BOOKMARKED, (_e, url) => {
    const bookmarksDb = require('./storage/bookmarks-db');
    return bookmarksDb.isBookmarked(url);
  });

  // Settings
  ipcMain.handle(IPC.SETTINGS_GET, async (_e, key) => {
    const settingsStore = require('./storage/settings-store');
    return await settingsStore.get(key);
  });

  ipcMain.handle(IPC.SETTINGS_SET, async (_e, key, value) => {
    const settingsStore = require('./storage/settings-store');
    await settingsStore.set(key, value);
  });

  ipcMain.handle(IPC.SETTINGS_GET_ALL, async () => {
    const settingsStore = require('./storage/settings-store');
    return await settingsStore.getAll();
  });
}

module.exports = { registerIpcHandlers };
