const { session } = require('electron');

let enabled = true;
const httpsBrokenDomains = new Set();

function initHttpsUpgrade() {
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['http://*/*'] },
    (details, callback) => {
      if (!enabled) {
        callback({});
        return;
      }

      try {
        const url = new URL(details.url);

        // Skip localhost and local network
        if (
          url.hostname === 'localhost' ||
          url.hostname === '127.0.0.1' ||
          url.hostname.startsWith('192.168.') ||
          url.hostname.startsWith('10.') ||
          url.hostname.endsWith('.local')
        ) {
          callback({});
          return;
        }

        // Skip domains known to not support HTTPS
        if (httpsBrokenDomains.has(url.hostname)) {
          callback({});
          return;
        }

        // Upgrade to HTTPS
        url.protocol = 'https:';
        callback({ redirectURL: url.toString() });
      } catch {
        callback({});
      }
    }
  );
}

function markHttpsBroken(hostname) {
  httpsBrokenDomains.add(hostname);
}

function isEnabled() {
  return enabled;
}

function toggle() {
  enabled = !enabled;
  return enabled;
}

module.exports = { initHttpsUpgrade, markHttpsBroken, isEnabled, toggle };
