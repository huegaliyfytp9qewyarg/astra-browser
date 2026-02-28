const { WebContentsView, BaseWindow } = require('electron');
const path = require('path');
const { getMainWindow, getChromeView, getContentBounds } = require('./window-manager');
const { DEFAULT_URL, CHROME_HEIGHT } = require('../shared/constants');
const { setupContextMenu } = require('./context-menu');

let tabs = new Map();
let tabOrder = []; // Track tab order for reordering
let activeTabId = null;
let tabCounter = 0;
let closedTabs = []; // Stack of recently closed tab URLs (for Ctrl+Shift+T)

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
  tabOrder.push(tabId);
  win.contentView.addChildView(view);

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

    if (navUrl && !navUrl.startsWith('astra://')) {
      try {
        const historyDb = require('./storage/history-db');
        historyDb.addVisit(navUrl, tabInfo.title, tabInfo.favicon);
      } catch { /* ignore */ }
    }
  });

  wc.on('did-navigate-in-page', (_e, navUrl) => {
    tabInfo.url = navUrl;
    tabInfo.canGoBack = wc.canGoBack();
    tabInfo.canGoForward = wc.canGoForward();
    notifyChromeTabUpdate(tabId);
    notifyChromeNavState(tabId);
  });

  // When a search page finishes loading, inject search results
  wc.on('did-finish-load', () => {
    const currentUrl = wc.getURL();
    console.log('[Astra] did-finish-load:', currentUrl);
    if (currentUrl && currentUrl.startsWith('astra://search')) {
      try {
        const url = new URL(currentUrl);
        const query = url.searchParams.get('q');
        if (query) {
          console.log('[Astra] Triggering search for:', query);
          performSearchAndInject(wc, query);
        }
      } catch (err) {
        console.error('[Astra] Search trigger error:', err);
      }
    }
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

  wc.on('did-fail-load', (_e, errorCode) => {
    if (errorCode === -3) return;
    tabInfo.isLoading = false;
    notifyChromeTabUpdate(tabId);
  });

  wc.setWindowOpenHandler(({ url: newUrl }) => {
    createTab(newUrl);
    return { action: 'deny' };
  });

  // Right-click context menu (Copy, Paste, Open Link, Inspect, etc.)
  setupContextMenu(wc, createTab);

  // Forward find-in-page results to chrome view
  wc.on('found-in-page', (_event, result) => {
    const chrome = getChromeView();
    if (chrome) {
      chrome.webContents.send('find:result', {
        activeMatchOrdinal: result.activeMatchOrdinal,
        matches: result.matches,
      });
    }
  });

  // Escape key: close find bar + stop loading
  wc.on('before-input-event', (_event, input) => {
    if (input.key === 'Escape' && input.type === 'keyDown') {
      const chrome = getChromeView();
      if (chrome) chrome.webContents.send('find:hide');
      if (wc.isLoading()) wc.stop();
    }
  });

  wc.loadURL(url);
  switchTab(tabId);
  return tabId;
}

async function performSearchAndInject(wc, query) {
  try {
    console.log('[Astra] Starting search for:', query);
    const searchEngine = require('./search-engine');
    const results = await searchEngine.search(query);
    console.log('[Astra] Search returned', results.results.length, 'results');
    const json = JSON.stringify(results);
    await wc.executeJavaScript(`
      if (typeof window.receiveSearchResults === 'function') {
        window.receiveSearchResults(${JSON.stringify(json)});
        'ok';
      } else {
        'receiveSearchResults not defined';
      }
    `).then(r => console.log('[Astra] Inject result:', r))
      .catch(e => console.error('[Astra] Inject error:', e));
  } catch (err) {
    console.error('[Astra] Search error:', err);
    const msg = err.message || 'Search failed';
    wc.executeJavaScript(`
      if (typeof window.receiveSearchError === 'function') {
        window.receiveSearchError(${JSON.stringify(msg)});
      }
    `).catch(() => {});
  }
}

function closeTab(tabId) {
  const tab = tabs.get(tabId);
  if (!tab) return;

  // Save URL for reopen (Ctrl+Shift+T)
  if (tab.url && !tab.url.startsWith('astra://newtab')) {
    closedTabs.push(tab.url);
    if (closedTabs.length > 25) closedTabs.shift();
  }

  const win = getMainWindow();
  if (win) {
    win.contentView.removeChildView(tab.view);
  }

  tab.view.webContents.close();
  tabs.delete(tabId);
  tabOrder = tabOrder.filter((id) => id !== tabId);

  if (activeTabId === tabId) {
    if (tabOrder.length > 0) {
      switchTab(tabOrder[tabOrder.length - 1]);
    } else {
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

function reorderTab(tabId, newIndex) {
  const oldIndex = tabOrder.indexOf(tabId);
  if (oldIndex === -1) return;
  tabOrder.splice(oldIndex, 1);
  tabOrder.splice(newIndex, 0, tabId);
  notifyChromeAllTabs();
}

function detachTab(tabId) {
  const tab = tabs.get(tabId);
  if (!tab) return;
  if (tabs.size <= 1) return; // Don't detach the last tab

  const oldWin = getMainWindow();
  if (oldWin) {
    oldWin.contentView.removeChildView(tab.view);
  }

  // Remove from current window's tab list
  tabs.delete(tabId);
  tabOrder = tabOrder.filter((id) => id !== tabId);

  if (activeTabId === tabId && tabOrder.length > 0) {
    switchTab(tabOrder[tabOrder.length - 1]);
  }
  notifyChromeAllTabs();

  // Create a new standalone window for this tab
  const newWin = new BaseWindow({
    width: 900,
    height: 600,
    minWidth: 400,
    minHeight: 300,
    frame: false,
    title: tab.title || 'Astra',
    backgroundColor: '#1a1b26',
  });

  const chromeView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  });

  newWin.contentView.addChildView(chromeView);
  newWin.contentView.addChildView(tab.view);

  chromeView.webContents.loadFile(
    path.join(__dirname, '..', 'renderer', 'index.html')
  );

  const updateNewLayout = () => {
    const { width, height } = newWin.getContentBounds();
    chromeView.setBounds({ x: 0, y: 0, width, height: CHROME_HEIGHT });
    tab.view.setBounds({ x: 0, y: CHROME_HEIGHT, width, height: height - CHROME_HEIGHT });
  };

  updateNewLayout();
  newWin.on('resized', updateNewLayout);
  newWin.on('resize', updateNewLayout);
  newWin.on('maximize', updateNewLayout);
  newWin.on('unmaximize', updateNewLayout);
  newWin.on('enter-full-screen', updateNewLayout);
  newWin.on('leave-full-screen', updateNewLayout);
  newWin.on('restore', updateNewLayout);
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
  return tabOrder.map((id) => {
    const t = tabs.get(id);
    if (!t) return null;
    return {
      id: t.id,
      title: t.title,
      url: t.url,
      favicon: t.favicon,
      isLoading: t.isLoading,
      isActive: t.id === activeTabId,
    };
  }).filter(Boolean);
}

function getTabCount() {
  return tabs.size;
}

function switchToNextTab() {
  const idx = tabOrder.indexOf(activeTabId);
  const nextIdx = (idx + 1) % tabOrder.length;
  switchTab(tabOrder[nextIdx]);
}

function switchToPrevTab() {
  const idx = tabOrder.indexOf(activeTabId);
  const prevIdx = (idx - 1 + tabOrder.length) % tabOrder.length;
  switchTab(tabOrder[prevIdx]);
}

function switchToTabIndex(index) {
  if (index >= 0 && index < tabOrder.length) {
    switchTab(tabOrder[index]);
  }
}

function updateActiveTabBounds() {
  if (!activeTabId) return;
  const tab = tabs.get(activeTabId);
  if (!tab) return;
  const bounds = getContentBounds();
  tab.view.setBounds(bounds);
}

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

function reopenLastClosedTab() {
  if (closedTabs.length === 0) return;
  const url = closedTabs.pop();
  createTab(url);
}

module.exports = {
  createTab,
  closeTab,
  switchTab,
  reorderTab,
  detachTab,
  getActiveTabId,
  getActiveTab,
  getTab,
  getAllTabs,
  getTabCount,
  switchToNextTab,
  switchToPrevTab,
  switchToTabIndex,
  updateActiveTabBounds,
  reopenLastClosedTab,
};
