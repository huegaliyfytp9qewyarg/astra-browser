const { ipcMain, Menu, dialog } = require('electron');
const { IPC } = require('../shared/constants');
const tabManager = require('./tab-manager');
const navigation = require('./navigation');
const { getMainWindow, expandChrome, restoreChrome, setDownloadsBarHeight, setFindBarHeight, setUpdateBarHeight } = require('./window-manager');
const downloadManager = require('./download-manager');

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

  ipcMain.handle('tab:reorder', (_e, tabId, newIndex) => {
    tabManager.reorderTab(tabId, newIndex);
  });

  ipcMain.handle('tab:detach', (_e, tabId) => {
    tabManager.detachTab(tabId);
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
    const proxyManager = require('./privacy/proxy-manager');
    return {
      adBlockEnabled: adBlocker.isEnabled(),
      httpsUpgradeEnabled: httpsUpgrade.isEnabled(),
      adsBlocked: adBlocker.getBlockedAds(),
      trackersBlocked: adBlocker.getBlockedTrackers(),
      totalBlocked: adBlocker.getBlockedCount(),
      proxyMode: proxyManager.getMode(),
      proxyConfig: proxyManager.getConfig(),
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

  // Per-site ad blocker whitelist
  ipcMain.handle('privacy:isWhitelisted', (_e, domain) => {
    const adBlocker = require('./privacy/ad-blocker');
    return adBlocker.isWhitelisted(domain);
  });

  ipcMain.handle('privacy:whitelistAdd', (_e, domain) => {
    const adBlocker = require('./privacy/ad-blocker');
    adBlocker.addToWhitelist(domain);
  });

  ipcMain.handle('privacy:whitelistRemove', (_e, domain) => {
    const adBlocker = require('./privacy/ad-blocker');
    adBlocker.removeFromWhitelist(domain);
  });

  // Proxy / VPN
  ipcMain.handle('privacy:setProxy', async (_e, mode, details) => {
    const proxyManager = require('./privacy/proxy-manager');
    return await proxyManager.setProxy(mode, details);
  });

  ipcMain.handle('privacy:getProxy', () => {
    const proxyManager = require('./privacy/proxy-manager');
    return proxyManager.getConfig();
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
    try {
      const bookmarksDb = require('./storage/bookmarks-db');
      const parentId = data.parentId || bookmarksDb.getBookmarksBarId();
      return bookmarksDb.addBookmark(parentId, data.title, data.url, data.favicon);
    } catch (err) {
      console.error('[Bookmarks] add error:', err);
      throw err;
    }
  });

  ipcMain.handle('bookmarks:update', (_e, url, data) => {
    try {
      const bookmarksDb = require('./storage/bookmarks-db');
      bookmarksDb.updateByUrl(url, data);
    } catch (err) {
      console.error('[Bookmarks] update error:', err);
      throw err;
    }
  });

  ipcMain.handle(IPC.BOOKMARKS_REMOVE, (_e, url) => {
    try {
      const bookmarksDb = require('./storage/bookmarks-db');
      bookmarksDb.removeByUrl(url);
    } catch (err) {
      console.error('[Bookmarks] remove error:', err);
      throw err;
    }
  });

  ipcMain.handle(IPC.BOOKMARKS_GET_BAR, () => {
    try {
      const bookmarksDb = require('./storage/bookmarks-db');
      return bookmarksDb.getBookmarksBar();
    } catch (err) {
      console.error('[Bookmarks] getBar error:', err);
      return [];
    }
  });

  ipcMain.handle(IPC.BOOKMARKS_GET_ALL, () => {
    try {
      const bookmarksDb = require('./storage/bookmarks-db');
      return bookmarksDb.getAll();
    } catch (err) {
      console.error('[Bookmarks] getAll error:', err);
      return [];
    }
  });

  ipcMain.handle(IPC.BOOKMARKS_IS_BOOKMARKED, (_e, url) => {
    try {
      const bookmarksDb = require('./storage/bookmarks-db');
      return bookmarksDb.isBookmarked(url);
    } catch (err) {
      console.error('[Bookmarks] isBookmarked error:', err);
      return false;
    }
  });

  // Passwords
  ipcMain.handle('passwords:getForDomain', (_e, domain) => {
    try {
      const passwordsDb = require('./storage/passwords-db');
      return passwordsDb.getPasswordsForDomain(domain);
    } catch (err) {
      console.error('[Passwords] getForDomain error:', err);
      return [];
    }
  });

  ipcMain.handle('passwords:getAll', () => {
    try {
      const passwordsDb = require('./storage/passwords-db');
      return passwordsDb.getAllPasswords();
    } catch (err) {
      console.error('[Passwords] getAll error:', err);
      return [];
    }
  });

  ipcMain.handle('passwords:add', (_e, url, username, password) => {
    try {
      const passwordsDb = require('./storage/passwords-db');
      passwordsDb.addPassword(url, username, password);
    } catch (err) {
      console.error('[Passwords] add error:', err);
    }
  });

  ipcMain.handle('passwords:remove', (_e, domain, username) => {
    try {
      const passwordsDb = require('./storage/passwords-db');
      passwordsDb.removePassword(domain, username);
    } catch (err) {
      console.error('[Passwords] remove error:', err);
    }
  });

  // Auto-updater
  ipcMain.handle('updater:check', () => {
    const autoUpdater = require('./auto-updater');
    autoUpdater.checkForUpdates();
  });

  ipcMain.handle('updater:install', () => {
    const autoUpdater = require('./auto-updater');
    autoUpdater.installUpdate();
  });

  ipcMain.handle('updater:getStatus', () => {
    const autoUpdater = require('./auto-updater');
    return autoUpdater.getStatus();
  });

  ipcMain.handle('updater:setBarHeight', (_e, h) => {
    setUpdateBarHeight(h);
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

  // Toolbar menu (⋮ button)
  ipcMain.handle('menu:show', () => {
    const { getChromeView } = require('./window-manager');
    const win = getMainWindow();
    const menu = Menu.buildFromTemplate([
      {
        label: 'New Tab',
        accelerator: 'Ctrl+T',
        click: () => tabManager.createTab(),
      },
      {
        label: 'Reopen Closed Tab',
        accelerator: 'Ctrl+Shift+T',
        click: () => tabManager.reopenLastClosedTab(),
      },
      { type: 'separator' },
      {
        label: 'Find in Page...',
        accelerator: 'Ctrl+F',
        click: () => {
          const chrome = getChromeView();
          if (chrome) chrome.webContents.send('find:show');
        },
      },
      {
        label: 'Print...',
        accelerator: 'Ctrl+P',
        click: () => {
          const tab = tabManager.getActiveTab();
          if (tab) tab.view.webContents.print();
        },
      },
      { type: 'separator' },
      {
        label: 'Import from Browser...',
        click: async () => {
          const browserImport = require('./browser-import');
          const available = browserImport.getAvailableBrowsers();
          if (available.length === 0) {
            dialog.showMessageBox(win, {
              type: 'info',
              title: 'No Browsers Found',
              message: 'No supported browsers were detected on this system.',
              buttons: ['OK'],
            });
            return;
          }
          const { response } = await dialog.showMessageBox(win, {
            type: 'question',
            title: 'Import Browser Data',
            message: 'Which browser would you like to import from?',
            buttons: [...available.map(b => b.name), 'Cancel'],
            cancelId: available.length,
          });
          if (response >= available.length) return;
          const chosen = available[response];
          try {
            const result = await browserImport.runImport(chosen.id);
            const chrome = getChromeView();
            if (chrome) chrome.webContents.send('bookmarks:refresh');
            dialog.showMessageBox(win, {
              type: 'info',
              title: 'Import Complete',
              message: `Imported ${result.bookmarks} bookmarks, ${result.history} history entries, and ${result.passwords || 0} passwords from ${chosen.name}.`,
              buttons: ['OK'],
            });
          } catch (err) {
            dialog.showMessageBox(win, {
              type: 'error',
              title: 'Import Failed',
              message: `Could not import data from ${chosen.name}: ${err.message}`,
              buttons: ['OK'],
            });
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Developer Tools',
        accelerator: 'F12',
        click: () => {
          const tab = tabManager.getActiveTab();
          if (tab) tab.view.webContents.toggleDevTools();
        },
      },
      { type: 'separator' },
      {
        label: 'Quit Astra',
        accelerator: 'Alt+F4',
        click: () => { if (win) win.close(); },
      },
    ]);
    menu.popup({ window: win });
  });

  // Browser data import
  ipcMain.handle('import:browser', async (_e, browserKey) => {
    const browserImport = require('./browser-import');
    return await browserImport.runImport(browserKey);
  });

  ipcMain.handle('import:getAvailable', () => {
    const browserImport = require('./browser-import');
    return browserImport.getAvailableBrowsers();
  });

  // Find in page
  ipcMain.handle('find:query', (_e, text) => {
    const tab = tabManager.getActiveTab();
    if (tab && text) tab.view.webContents.findInPage(text);
  });

  ipcMain.handle('find:next', (_e, text) => {
    const tab = tabManager.getActiveTab();
    if (tab && text) tab.view.webContents.findInPage(text, { forward: true, findNext: true });
  });

  ipcMain.handle('find:prev', (_e, text) => {
    const tab = tabManager.getActiveTab();
    if (tab && text) tab.view.webContents.findInPage(text, { forward: false, findNext: true });
  });

  ipcMain.handle('find:stop', () => {
    const tab = tabManager.getActiveTab();
    if (tab) tab.view.webContents.stopFindInPage('clearSelection');
  });

  ipcMain.handle('find:setBarHeight', (_e, h) => {
    setFindBarHeight(h);
  });

  // Chrome expand/restore (for modal dialogs)
  ipcMain.handle(IPC.CHROME_EXPAND_FULL, () => {
    expandChrome();
  });

  ipcMain.handle(IPC.CHROME_RESTORE_SIZE, () => {
    restoreChrome();
  });

  ipcMain.handle(IPC.CHROME_SET_DOWNLOADS_VISIBLE, (_e, visible) => {
    const { DOWNLOADS_BAR_HEIGHT } = require('../shared/constants');
    setDownloadsBarHeight(visible ? DOWNLOADS_BAR_HEIGHT : 0);
  });

  // Downloads
  ipcMain.handle(IPC.DOWNLOAD_CANCEL, (_e, id) => {
    downloadManager.cancel(id);
  });

  ipcMain.handle(IPC.DOWNLOAD_PAUSE, (_e, id) => {
    downloadManager.pause(id);
  });

  ipcMain.handle(IPC.DOWNLOAD_RESUME, (_e, id) => {
    downloadManager.resume(id);
  });

  ipcMain.handle(IPC.DOWNLOAD_OPEN, (_e, id) => {
    downloadManager.openFile(id);
  });

  ipcMain.handle(IPC.DOWNLOAD_SHOW_IN_FOLDER, (_e, id) => {
    downloadManager.showInFolder(id);
  });

  ipcMain.handle(IPC.DOWNLOAD_CLEAR_COMPLETED, () => {
    downloadManager.clearCompleted();
  });
}

module.exports = { registerIpcHandlers };
