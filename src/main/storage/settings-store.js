let store = null;

async function getStore() {
  if (store) return store;

  // electron-store v10+ is ESM only
  const ElectronStore = (await import('electron-store')).default;

  store = new ElectronStore({
    name: 'settings',
    defaults: {
      search: {
        defaultEngine: 'astra',
        braveApiKey: '',
        searxngInstance: '',
        safeSearch: 'moderate',
      },
      privacy: {
        adBlockEnabled: true,
        trackerBlockEnabled: true,
        httpsUpgradeEnabled: true,
        sendDNT: true,
        clearOnExit: false,
      },
      appearance: {
        theme: 'dark',
        showBookmarksBar: false,
        fontSize: 'medium',
      },
      proxy: {
        enabled: false,
        type: 'socks5',
        host: '',
        port: 0,
      },
      general: {
        homepage: 'astra://newtab',
        restoreTabs: true,
        downloadPath: '',
      },
    },
  });

  return store;
}

async function get(key) {
  const s = await getStore();
  return s.get(key);
}

async function set(key, value) {
  const s = await getStore();
  s.set(key, value);
}

async function getAll() {
  const s = await getStore();
  return s.store;
}

module.exports = { getStore, get, set, getAll };
