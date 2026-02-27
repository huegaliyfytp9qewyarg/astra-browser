const { isValidURL, normalizeURL, isSearchQuery } = require('../shared/url-utils');
const { getActiveTab, getTab, getActiveTabId } = require('./tab-manager');

function navigate(input, tabId) {
  const tab = tabId ? getTab(tabId) : getActiveTab();
  if (!tab) return;

  const trimmed = input.trim();

  if (isSearchQuery(trimmed)) {
    // Route to the built-in search page
    const encoded = encodeURIComponent(trimmed);
    tab.view.webContents.loadURL(`astra://search?q=${encoded}`);
    return;
  }

  const url = normalizeURL(trimmed);
  tab.view.webContents.loadURL(url);
}

function goBack(tabId) {
  const tab = tabId ? getTab(tabId) : getActiveTab();
  if (tab && tab.view.webContents.canGoBack()) {
    tab.view.webContents.goBack();
  }
}

function goForward(tabId) {
  const tab = tabId ? getTab(tabId) : getActiveTab();
  if (tab && tab.view.webContents.canGoForward()) {
    tab.view.webContents.goForward();
  }
}

function reload(tabId) {
  const tab = tabId ? getTab(tabId) : getActiveTab();
  if (tab) {
    tab.view.webContents.reload();
  }
}

function stop(tabId) {
  const tab = tabId ? getTab(tabId) : getActiveTab();
  if (tab) {
    tab.view.webContents.stop();
  }
}

module.exports = {
  navigate,
  goBack,
  goForward,
  reload,
  stop,
};
