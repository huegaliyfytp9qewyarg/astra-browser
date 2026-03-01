const { app, protocol, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { createMainWindow, getMainWindow, getChromeView } = require('./window-manager');
const { registerIpcHandlers } = require('./ipc-handlers');
const { buildAppMenu } = require('./menu');
const { initAdBlocker } = require('./privacy/ad-blocker');
const { initHttpsUpgrade } = require('./privacy/https-upgrade');
const downloadManager = require('./download-manager');
const sessionManager = require('./session-manager');
const browserImport = require('./browser-import');
const proxyManager = require('./privacy/proxy-manager');
const autoUpdaterModule = require('./auto-updater');

// ── Privacy & Security: Chromium command-line switches ──
// Disable safe browsing warnings (no "dangerous file" prompts)
app.commandLine.appendSwitch('disable-features', 'SafeBrowsing,SafeBrowsingEnhancedProtection,DownloadBubble,DownloadBubbleV2');
// Prevent WebRTC IP leaks
app.commandLine.appendSwitch('force-webrtc-ip-handling-policy', 'disable_non_proxied_udp');
// Disable background network traffic
app.commandLine.appendSwitch('disable-background-networking');
// Disable component updates (no phoning home)
app.commandLine.appendSwitch('disable-component-update');
// Disable autofill server communication
app.commandLine.appendSwitch('disable-sync');
// Enable smooth scrolling
app.commandLine.appendSwitch('enable-smooth-scrolling');
// DNS-over-HTTPS via Cloudflare for private DNS resolution
app.commandLine.appendSwitch('enable-features', 'DnsOverHttps');
app.commandLine.appendSwitch('dns-over-https-mode', 'automatic');
app.commandLine.appendSwitch('dns-over-https-templates', 'https://cloudflare-dns.com/dns-query');

// Single instance lock — reuse existing window when opened via protocol/file
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    const win = getMainWindow();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
    // Open URL passed as argument
    const url = commandLine.find(arg => arg.startsWith('http://') || arg.startsWith('https://') || arg.endsWith('.html') || arg.endsWith('.htm'));
    if (url) {
      const tabManager = require('./tab-manager');
      tabManager.createTab(url);
    }
  });
}

// Register astra:// as a privileged scheme before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'astra',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
    },
  },
]);

app.whenReady().then(async () => {
  // Register custom protocol handler
  registerProtocol();

  // ── Privacy headers on all requests (instant, no async) ──
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['DNT'] = '1';
    details.requestHeaders['Sec-GPC'] = '1';
    callback({ requestHeaders: details.requestHeaders });
  });

  // ── Permission management (instant) ──
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    const blocked = ['notifications', 'midi', 'idle-detection', 'display-capture'];
    if (blocked.includes(permission)) return callback(false);

    const allowed = [
      'clipboard-read', 'clipboard-sanitized-write',
      'media', 'fullscreen', 'pointerLock', 'openExternal',
    ];
    if (allowed.includes(permission)) return callback(true);

    callback(false);
  });

  // ── Spellcheck (instant) ──
  session.defaultSession.setSpellCheckerLanguages(['en-US']);

  // Initialize HTTPS upgrade (instant, sync)
  initHttpsUpgrade();

  // Initialize proxy manager (loads saved config)
  proxyManager.init();

  // Initialize download manager (instant)
  downloadManager.init();

  // Register IPC handlers (instant)
  registerIpcHandlers();

  // Create the main browser window FIRST (show UI immediately)
  const win = createMainWindow();

  // Build application menu (contains all keyboard shortcuts)
  buildAppMenu();

  // Initialize ad blocker in background (don't block window creation)
  initAdBlocker().then(() => {
    console.log('[Astra] Ad blocker initialized');
  }).catch(err => {
    console.error('[Astra] Ad blocker init error:', err);
  });

  // Initialize auto-updater (checks GitHub releases)
  autoUpdaterModule.init();

  // ── Session restore + Chrome auto-import ──
  const chromeView = getChromeView();
  chromeView.webContents.on('did-finish-load', async () => {
    const tabManager = require('./tab-manager');

    // Check if opened with a URL argument (clicked link / file association)
    const launchUrl = process.argv.find(arg => arg.startsWith('http://') || arg.startsWith('https://') || arg.endsWith('.html') || arg.endsWith('.htm'));

    if (launchUrl) {
      tabManager.createTab(launchUrl);
    } else {
      const savedTabs = sessionManager.restoreSession();
      if (savedTabs && savedTabs.length > 0) {
        savedTabs.forEach((url) => tabManager.createTab(url));
      } else {
        tabManager.createTab();
      }
    }

    // Auto-import browser data on first launch
    if (browserImport.shouldAutoImport()) {
      const bestBrowser = browserImport.getAutoImportBrowser();
      if (bestBrowser) {
        console.log(`[Astra] First launch — importing from ${bestBrowser}...`);
        try {
          const result = await browserImport.runImport(bestBrowser);
          if (result.bookmarks > 0 || result.history > 0 || result.passwords > 0) {
            console.log(`[Astra] Imported ${result.bookmarks} bookmarks, ${result.history} history, ${result.passwords || 0} passwords`);
            chromeView.webContents.send('bookmarks:refresh');
          }
        } catch (err) {
          console.error('[Astra] Browser import error:', err);
        }
      }
    }
  });

  // Save session before quit
  app.on('before-quit', () => {
    try {
      const tabManager = require('./tab-manager');
      const tabs = tabManager.getAllTabs();
      sessionManager.saveSession(tabs);
    } catch { /* ignore */ }
  });

  win.on('close', () => {
    try {
      const tabManager = require('./tab-manager');
      const tabs = tabManager.getAllTabs();
      sessionManager.saveSession(tabs);
    } catch { /* ignore */ }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (!getMainWindow()) {
    createMainWindow();
  }
});

function registerProtocol() {
  const pagesDir = path.join(__dirname, '..', 'renderer', 'pages');
  const rendererDir = path.join(__dirname, '..', 'renderer');

  protocol.handle('astra', async (request) => {
    const url = new URL(request.url);
    const hostname = url.hostname;

    // Serve static assets from renderer directory
    if (hostname === 'assets' || hostname === 'css' || hostname === 'js') {
      const filePath = path.join(rendererDir, hostname, url.pathname.slice(1));
      return serveFile(filePath);
    }

    // Handle search API requests
    if (hostname === 'search' && url.pathname === '/api') {
      const query = url.searchParams.get('q');
      if (query) {
        try {
          const searchEngine = require('./search-engine');
          const results = await searchEngine.search(query);
          return new Response(JSON.stringify(results), {
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (err) {
          return new Response(JSON.stringify({ error: err.message, results: [] }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
    }

    switch (hostname) {
      case 'newtab':
        return serveFile(path.join(pagesDir, 'newtab.html'));
      case 'search':
        return serveFile(path.join(pagesDir, 'search.html'));
      case 'settings':
        return serveFile(path.join(pagesDir, 'settings.html'));
      case 'history':
        return serveFile(path.join(pagesDir, 'history.html'));
      case 'bookmarks':
        return serveFile(path.join(pagesDir, 'bookmarks.html'));
      default:
        return new Response('Not Found', { status: 404 });
    }
  });
}

function serveFile(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.ico': 'image/x-icon',
    };
    return new Response(content, {
      headers: { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' },
    });
  } catch {
    return new Response('Not Found', { status: 404 });
  }
}
