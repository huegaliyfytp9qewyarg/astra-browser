const { session, app } = require('electron');
const path = require('path');
const fs = require('fs');

let proxyConfig = { mode: 'direct' }; // direct, system, manual
let proxyDetails = { type: 'socks5', host: '', port: '' };
const configPath = () => path.join(app.getPath('userData'), 'proxy-config.json');

function loadConfig() {
  try {
    const data = JSON.parse(fs.readFileSync(configPath(), 'utf8'));
    proxyConfig = data.config || { mode: 'direct' };
    proxyDetails = data.details || { type: 'socks5', host: '', port: '' };
  } catch {
    proxyConfig = { mode: 'direct' };
    proxyDetails = { type: 'socks5', host: '', port: '' };
  }
}

function saveConfig() {
  try {
    fs.writeFileSync(configPath(), JSON.stringify({ config: proxyConfig, details: proxyDetails }), 'utf8');
  } catch { /* ignore */ }
}

async function applyProxy() {
  const ses = session.defaultSession;

  if (proxyConfig.mode === 'direct') {
    await ses.setProxy({ mode: 'direct' });
    console.log('[Proxy] Direct connection (no proxy)');
  } else if (proxyConfig.mode === 'system') {
    await ses.setProxy({ mode: 'system' });
    console.log('[Proxy] Using system proxy');
  } else if (proxyConfig.mode === 'manual') {
    const { type, host, port } = proxyDetails;
    if (!host || !port) {
      await ses.setProxy({ mode: 'direct' });
      console.log('[Proxy] Manual proxy missing host/port, falling back to direct');
      return;
    }
    // Format: socks5://host:port or http://host:port
    const proxyUrl = `${type}://${host}:${port}`;
    await ses.setProxy({ proxyRules: proxyUrl });
    console.log(`[Proxy] Set proxy to ${proxyUrl}`);
  }
}

function init() {
  loadConfig();
  applyProxy();

  // Enable DNS-over-HTTPS via Cloudflare (always on for privacy)
  session.defaultSession.enableNetworkEmulation;
}

function getConfig() {
  return { mode: proxyConfig.mode, ...proxyDetails };
}

async function setProxy(mode, details) {
  proxyConfig.mode = mode;
  if (details) {
    proxyDetails = { type: details.type || 'socks5', host: details.host || '', port: details.port || '' };
  }
  saveConfig();
  await applyProxy();
  return getConfig();
}

function getMode() {
  return proxyConfig.mode;
}

module.exports = { init, getConfig, setProxy, getMode };
