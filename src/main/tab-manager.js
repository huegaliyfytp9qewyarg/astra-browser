const { WebContentsView, session } = require('electron');
const path = require('path');
const { getMainWindow, getChromeView, getContentBounds } = require('./window-manager');
const { DEFAULT_URL } = require('../shared/constants');

let tabs = new Map();
let activeTabId = null;
let tabCounter = 0;

function createTab(url = DEFAULT_URL) {
  const tabId = ++tabCounter;
  const win = getMainWindow();
  if (!win) return null;

  const view = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'tab-preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webviewTag: false,
    },
  });

  const tabInfo = {
    id: tabId,
    view,
    title: 'New Tab',
    url: url,
    favicon: null,
    isLoading: false,
    canGoBack: false,
    canGoForward: false,
  };

  tabs.set(tabId, tabInfo);
  win.contentView.addChildView(view);

  // Set up webContents event listeners
  const wc = view.webContents;

  wc.on('did-start-loading', () => {
    tabInfo.isLoading = true;
    notifyChromeTabUpdate(tabId);
  });

  wc.on('did-stop-loading', () => {
    tabInfo.isLoading = false;
    tabInfo.canGoBack = wc.canGoBack();
    tabInfo.canGoForward = wc.canGoForward();
    notifyChromeTabUpdate(tabId);
  });

  wc.on('did-navigate', (_e, navUrl) => {
    tabInfo.url = navUrl;
    tabInfo.canGoBack = wc.canGoBack();
    tabInfo.canGoForward = wc.canGoForward();
    notifyChromeTabUpdate(tabId);
    notifyChromeNavState(tabId);

    // Record in history (skip internal pages)
    if (navUrl && !navUrl.startsWith('astra://')) {
      try {
        const historyDb = require('./storage/history-db');
        historyDb.addVisit(navUrl, tabInfo.title, tabInfo.favicon);
      } catch { /* ignore if DB not ready */ }
    }
  });

  wc.on('did-navigate-in-page', (_e, navUrl) => {
    tabInfo.url = navUrl;
    tabInfo.canGoBack = wc.canGoBack();
    tabInfo.canGoForward = wc.canGoForward();
    notifyChromeTabUpdate(tabId);
    notifyChromeNavState(tabId);
  });

  wc.on('page-title-updated', (_e, title) => {
    tabInfo.title = title;
    notifyChromeTabUpdate(tabId);
  });

  wc.on('page-favicon-updated', (_e, favicons) => {
    if (favicons && favicons.length > 0) {
      tabInfo.favicon = favicons[0];
    }
    notifyChromeTabUpdate(tabId);
  });

  wc.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL) => {
    if (errorCode === -3) return; // Aborted, ignore
    tabInfo.isLoading = false;
    notifyChromeTabUpdate(tabId);
  });

  // Handle target=_blank links: open in new tab
  wc.setWindowOpenHandler(({ url: newUrl }) => {
    createTab(newUrl);
    return { action: 'deny' };
  });

  // Navigate to the URL
  if (url.startsWith('astra://')) {
    wc.loadURL(url);
  } else {
    wc.loadURL(url);
  }

  switchTab(tabId);
  return tabId;
}

function closeTab(tabId) {
  const tab = tabs.get(tabId);
  if (!tab) return;

  const win = getMainWindow();
  if (win) {
    win.contentView.removeChildView(tab.view);
  }

  tab.view.webContents.close();
  tabs.delete(tabId);

  // If we closed the active tab, switch to the last remaining tab
  if (activeTabId === tabId) {
    const remaining = Array.from(tabs.keys());
    if (remaining.length > 0) {
      switchTab(remaining[remaining.length - 1]);
    } else {
      // No tabs left, create a new one
      createTab();
    }
  }

  notifyChromeAllTabs();
}

function switchTab(tabId) {
  const tab = tabs.get(tabId);
  if (!tab) return;

  activeTabId = tabId;
  const bounds = getContentBounds();

  // Hide all tabs, show the active one
  for (const [id, t] of tabs) {
    if (id === tabId) {
      t.view.setBounds(bounds);
    } else {
      t.view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    }
  }

  notifyChromeAllTabs();
  notifyChromeNavState(tabId);
}

function getActiveTabId() {
  return activeTabId;
}

function getActiveTab() {
  return tabs.get(activeTabId) || null;
}

function getTab(tabId) {
  return tabs.get(tabId) || null;
}

function getAllTabs() {
  return Array.from(tabs.values()).map((t) => ({
    id: t.id,
    title: t.title,
    url: t.url,
    favicon: t.favicon,
    isLoading: t.isLoading,
    isActive: t.id === activeTabId,
  }));
}

function getTabCount() {
  return tabs.size;
}

function switchToNextTab() {
  const ids = Array.from(tabs.keys());
  const idx = ids.indexOf(activeTabId);
  const nextIdx = (idx + 1) % ids.length;
  switchTab(ids[nextIdx]);
}

function switchToPrevTab() {
  const ids = Array.from(tabs.keys());
  const idx = ids.indexOf(activeTabId);
  const prevIdx = (idx - 1 + ids.length) % ids.length;
  switchTab(ids[prevIdx]);
}

function switchToTabIndex(index) {
  const ids = Array.from(tabs.keys());
  if (index >= 0 && index < ids.length) {
    switchTab(ids[index]);
  }
}

function updateActiveTabBounds() {
  if (!activeTabId) return;
  const tab = tabs.get(activeTabId);
  if (!tab) return;
  const bounds = getContentBounds();
  tab.view.setBounds(bounds);
}

// Notify chrome UI about tab changes
function notifyChromeTabUpdate(tabId) {
  const chrome = getChromeView();
  if (!chrome) return;
  const tab = tabs.get(tabId);
  if (!tab) return;
  chrome.webContents.send('tab:updated', {
    id: tab.id,
    title: tab.title,
    url: tab.url,
    favicon: tab.favicon,
    isLoading: tab.isLoading,
    isActive: tab.id === activeTabId,
  });
}

function notifyChromeAllTabs() {
  const chrome = getChromeView();
  if (!chrome) return;
  chrome.webContents.send('tab:allUpdated', getAllTabs());
}

function notifyChromeNavState(tabId) {
  if (tabId !== activeTabId) return;
  const chrome = getChromeView();
  if (!chrome) return;
  const tab = tabs.get(tabId);
  if (!tab) return;
  chrome.webContents.send('nav:stateChanged', {
    url: tab.url,
    title: tab.title,
    canGoBack: tab.canGoBack,
    canGoForward: tab.canGoForward,
    isLoading: tab.isLoading,
  });
}

module.exports = {
  createTab,
  closeTab,
  switchTab,
  getActiveTabId,
  getActiveTab,
  getTab,
  getAllTabs,
  getTabCount,
  switchToNextTab,
  switchToPrevTab,
  switchToTabIndex,
  updateActiveTabBounds,
};
