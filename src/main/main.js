const { app, protocol, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { createMainWindow, getMainWindow } = require('./window-manager');
const { registerIpcHandlers } = require('./ipc-handlers');
const { buildAppMenu } = require('./menu');
const { registerShortcuts } = require('./shortcuts');
const { initAdBlocker } = require('./privacy/ad-blocker');
const { initHttpsUpgrade } = require('./privacy/https-upgrade');
const downloadManager = require('./download-manager');

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

  // Initialize privacy features
  await initAdBlocker();
  initHttpsUpgrade();

  // Set DNT header on all requests
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['DNT'] = '1';
    details.requestHeaders['Sec-GPC'] = '1';
    callback({ requestHeaders: details.requestHeaders });
  });

  // Initialize download manager
  downloadManager.init();

  // Register IPC handlers
  registerIpcHandlers();

  // Create the main browser window
  createMainWindow();

  // Build application menu
  buildAppMenu();

  // Register shortcuts
  registerShortcuts();
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
