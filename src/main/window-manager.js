const { BaseWindow, WebContentsView } = require('electron');
const path = require('path');
const { CHROME_HEIGHT } = require('../shared/constants');

let mainWindow = null;
let chromeView = null;

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

  // Update layout on resize
  mainWindow.on('resized', updateLayout);
  mainWindow.on('maximize', updateLayout);
  mainWindow.on('unmaximize', updateLayout);

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
  chromeView.setBounds({ x: 0, y: 0, width, height: CHROME_HEIGHT });
}

function getMainWindow() {
  return mainWindow;
}

function getChromeView() {
  return chromeView;
}

function getContentBounds() {
  if (!mainWindow) return { x: 0, y: CHROME_HEIGHT, width: 800, height: 520 };
  const { width, height } = mainWindow.getContentBounds();
  return {
    x: 0,
    y: CHROME_HEIGHT,
    width,
    height: height - CHROME_HEIGHT,
  };
}

module.exports = {
  createMainWindow,
  getMainWindow,
  getChromeView,
  getContentBounds,
  updateLayout,
};
