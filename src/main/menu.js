const { Menu, app } = require('electron');

function buildAppMenu() {
  const isMac = process.platform === 'darwin';

  // Lazy-load to avoid circular dependencies
  const tm = () => require('./tab-manager');
  const nav = () => require('./navigation');
  const wm = () => require('./window-manager');

  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Tab',
          accelerator: 'CmdOrCtrl+T',
          click: () => tm().createTab(),
        },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            const tabId = tm().getActiveTabId();
            if (tabId) tm().closeTab(tabId);
          },
        },
        {
          label: 'Reopen Closed Tab',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () => tm().reopenLastClosedTab(),
        },
        { type: 'separator' },
        {
          label: 'Print',
          accelerator: 'CmdOrCtrl+P',
          click: () => {
            const tab = tm().getActiveTab();
            if (tab) tab.view.webContents.print();
          },
        },
        { type: 'separator' },
        {
          label: 'Import from Browser...',
          click: async () => {
            const browserImport = require('./browser-import');
            const { dialog } = require('electron');
            const win = wm().getMainWindow();
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
              const chrome = wm().getChromeView();
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
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Find in Page',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            const chrome = wm().getChromeView();
            if (chrome) chrome.webContents.send('find:show');
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => nav().reload(),
        },
        {
          label: 'Reload (F5)',
          accelerator: 'F5',
          visible: false,
          click: () => nav().reload(),
        },
        {
          label: 'Force Reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            const tab = tm().getActiveTab();
            if (tab) tab.view.webContents.reloadIgnoringCache();
          },
        },
        { type: 'separator' },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+=',
          click: () => {
            const tab = tm().getActiveTab();
            if (tab) {
              const level = tab.view.webContents.getZoomLevel();
              tab.view.webContents.setZoomLevel(Math.min(level + 0.5, 5));
            }
          },
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            const tab = tm().getActiveTab();
            if (tab) {
              const level = tab.view.webContents.getZoomLevel();
              tab.view.webContents.setZoomLevel(Math.max(level - 0.5, -5));
            }
          },
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => {
            const tab = tm().getActiveTab();
            if (tab) tab.view.webContents.setZoomLevel(0);
          },
        },
        { type: 'separator' },
        {
          label: 'Full Screen',
          accelerator: 'F11',
          click: () => {
            const win = wm().getMainWindow();
            if (win) win.setFullScreen(!win.isFullScreen());
          },
        },
        {
          label: 'Developer Tools',
          accelerator: 'F12',
          click: () => {
            const tab = tm().getActiveTab();
            if (tab) tab.view.webContents.toggleDevTools();
          },
        },
      ],
    },
    {
      label: 'Navigate',
      submenu: [
        {
          label: 'Back',
          accelerator: 'Alt+Left',
          click: () => nav().goBack(),
        },
        {
          label: 'Forward',
          accelerator: 'Alt+Right',
          click: () => nav().goForward(),
        },
        { type: 'separator' },
        {
          label: 'Focus Address Bar',
          accelerator: 'CmdOrCtrl+L',
          click: () => {
            const chrome = wm().getChromeView();
            if (chrome) chrome.webContents.send('addressbar:focus');
          },
        },
        {
          label: 'Focus Address Bar (F6)',
          accelerator: 'F6',
          visible: false,
          click: () => {
            const chrome = wm().getChromeView();
            if (chrome) chrome.webContents.send('addressbar:focus');
          },
        },
        {
          label: 'Bookmark This Page',
          accelerator: 'CmdOrCtrl+D',
          click: () => {
            const chrome = wm().getChromeView();
            if (chrome) chrome.webContents.send('bookmark:toggle');
          },
        },
        { type: 'separator' },
        {
          label: 'Next Tab',
          accelerator: 'Ctrl+Tab',
          click: () => tm().switchToNextTab(),
        },
        {
          label: 'Next Tab (PageDown)',
          accelerator: 'Ctrl+PageDown',
          visible: false,
          click: () => tm().switchToNextTab(),
        },
        {
          label: 'Previous Tab',
          accelerator: 'Ctrl+Shift+Tab',
          click: () => tm().switchToPrevTab(),
        },
        {
          label: 'Previous Tab (PageUp)',
          accelerator: 'Ctrl+PageUp',
          visible: false,
          click: () => tm().switchToPrevTab(),
        },
        // Tab 1-8
        ...Array.from({ length: 8 }, (_, i) => ({
          label: `Tab ${i + 1}`,
          accelerator: `CmdOrCtrl+${i + 1}`,
          visible: false,
          click: () => tm().switchToTabIndex(i),
        })),
        {
          label: 'Last Tab',
          accelerator: 'CmdOrCtrl+9',
          visible: false,
          click: () => {
            const count = tm().getTabCount();
            if (count > 0) tm().switchToTabIndex(count - 1);
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

module.exports = { buildAppMenu };
