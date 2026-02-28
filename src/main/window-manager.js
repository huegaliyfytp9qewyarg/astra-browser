const { BaseWindow, WebContentsView } = require('electron');
const path = require('path');
const { CHROME_HEIGHT } = require('../shared/constants');

let mainWindow = null;
let chromeView = null;
let chromeExpanded = false;
let downloadsBarHeight = 0;

function createMainWindow() {
  mainWindow = new BaseWindow({
    width: 1280,
    height: 800,
    minWidth: 400,
    minHeight: 300,
    frame: false,
    title: 'Astra',
    backgroundColor: '#1e1e2e',
  });

  // Create the chrome (tab bar + toolbar) view
  chromeView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      sandbox: false, // Chrome UI needs access to preload IPC
      nodeIntegration: false,
    },
  });

  mainWindow.contentView.addChildView(chromeView);
  chromeView.webContents.loadFile(
    path.join(__dirname, '..', 'renderer', 'index.html')
  );

  // Set initial bounds
  updateLayout();

  // Update layout on ALL size-changing events
  mainWindow.on('resized', updateLayout);
  mainWindow.on('resize', updateLayout);
  mainWindow.on('maximize', updateLayout);
  mainWindow.on('unmaximize', updateLayout);
  mainWindow.on('enter-full-screen', updateLayout);
  mainWindow.on('leave-full-screen', updateLayout);
  mainWindow.on('restore', updateLayout);

  mainWindow.on('closed', () => {
    mainWindow = null;
    chromeView = null;
  });

  // Create first tab once chrome UI is ready
  chromeView.webContents.on('did-finish-load', () => {
    const tabManager = require('./tab-manager');
    tabManager.createTab();
  });

  return mainWindow;
}

function updateLayout() {
  if (!mainWindow || !chromeView) return;
  const { width, height } = mainWindow.getContentBounds();
  if (chromeExpanded) {
    chromeView.setBounds({ x: 0, y: 0, width, height });
  } else {
    chromeView.setBounds({ x: 0, y: 0, width, height: CHROME_HEIGHT + downloadsBarHeight });
  }

  // Also resize the active tab
  try {
    const tabManager = require('./tab-manager');
    tabManager.updateActiveTabBounds();
  } catch { /* tab manager not ready yet */ }
}

function expandChrome() {
  chromeExpanded = true;
  // Bring chrome view to front (above tab views) so the dialog is visible
  if (mainWindow && chromeView) {
    mainWindow.contentView.removeChildView(chromeView);
    mainWindow.contentView.addChildView(chromeView);
  }
  updateLayout();
}

function restoreChrome() {
  chromeExpanded = false;
  updateLayout();
}

function getMainWindow() {
  return mainWindow;
}

function getChromeView() {
  return chromeView;
}

function setDownloadsBarHeight(h) {
  downloadsBarHeight = h;
  updateLayout();
}

function getContentBounds() {
  if (!mainWindow) return { x: 0, y: CHROME_HEIGHT, width: 800, height: 520 };
  const { width, height } = mainWindow.getContentBounds();
  const chromeH = CHROME_HEIGHT + downloadsBarHeight;
  return {
    x: 0,
    y: chromeH,
    width,
    height: height - chromeH,
  };
}

module.exports = {
  createMainWindow,
  getMainWindow,
  getChromeView,
  getContentBounds,
  updateLayout,
  expandChrome,
  restoreChrome,
  setDownloadsBarHeight,
};
