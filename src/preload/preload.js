const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('astra', {
  tabs: {
    create: (url) => ipcRenderer.invoke('tab:create', url),
    close: (id) => ipcRenderer.invoke('tab:close', id),
    switch: (id) => ipcRenderer.invoke('tab:switch', id),
    getAll: () => ipcRenderer.invoke('tab:getAll'),
    reorder: (id, newIndex) => ipcRenderer.invoke('tab:reorder', id, newIndex),
    detach: (id) => ipcRenderer.invoke('tab:detach', id),
    onUpdate: (cb) => {
      ipcRenderer.on('tab:updated', (_e, data) => cb(data));
    },
    onAllUpdated: (cb) => {
      ipcRenderer.on('tab:allUpdated', (_e, data) => cb(data));
    },
  },

  nav: {
    go: (input) => ipcRenderer.invoke('nav:go', input),
    back: () => ipcRenderer.invoke('nav:back'),
    forward: () => ipcRenderer.invoke('nav:forward'),
    reload: () => ipcRenderer.invoke('nav:reload'),
    stop: () => ipcRenderer.invoke('nav:stop'),
    onStateChanged: (cb) => {
      ipcRenderer.on('nav:stateChanged', (_e, data) => cb(data));
    },
  },

  search: {
    query: (q) => ipcRenderer.invoke('search:query', q),
  },

  bookmarks: {
    add: (data) => ipcRenderer.invoke('bookmarks:add', data),
    remove: (url) => ipcRenderer.invoke('bookmarks:remove', url),
    update: (url, data) => ipcRenderer.invoke('bookmarks:update', url, data),
    getBar: () => ipcRenderer.invoke('bookmarks:getBar'),
    getAll: () => ipcRenderer.invoke('bookmarks:getAll'),
    isBookmarked: (url) => ipcRenderer.invoke('bookmarks:isBookmarked', url),
  },

  privacy: {
    getStatus: () => ipcRenderer.invoke('privacy:getStatus'),
    toggleAds: () => ipcRenderer.invoke('privacy:toggleAds'),
    toggleHttps: () => ipcRenderer.invoke('privacy:toggleHttps'),
  },

  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },

  chrome: {
    expandFull: () => ipcRenderer.invoke('chrome:expandFull'),
    restoreSize: () => ipcRenderer.invoke('chrome:restoreSize'),
    setDownloadsVisible: (visible) => ipcRenderer.invoke('chrome:setDownloadsVisible', visible),
  },

  find: {
    query: (text) => ipcRenderer.invoke('find:query', text),
    next: (text) => ipcRenderer.invoke('find:next', text),
    prev: (text) => ipcRenderer.invoke('find:prev', text),
    stop: () => ipcRenderer.invoke('find:stop'),
    setBarHeight: (h) => ipcRenderer.invoke('find:setBarHeight', h),
    onShow: (cb) => { ipcRenderer.on('find:show', () => cb()); },
    onHide: (cb) => { ipcRenderer.on('find:hide', () => cb()); },
    onResult: (cb) => { ipcRenderer.on('find:result', (_e, data) => cb(data)); },
  },

  import: {
    chrome: () => ipcRenderer.invoke('import:chrome'),
  },

  events: {
    onAddressBarFocus: (cb) => { ipcRenderer.on('addressbar:focus', () => cb()); },
    onBookmarkToggle: (cb) => { ipcRenderer.on('bookmark:toggle', () => cb()); },
    onBookmarksRefresh: (cb) => { ipcRenderer.on('bookmarks:refresh', () => cb()); },
  },

  downloads: {
    cancel: (id) => ipcRenderer.invoke('download:cancel', id),
    pause: (id) => ipcRenderer.invoke('download:pause', id),
    resume: (id) => ipcRenderer.invoke('download:resume', id),
    open: (id) => ipcRenderer.invoke('download:open', id),
    showInFolder: (id) => ipcRenderer.invoke('download:showInFolder', id),
    clearCompleted: () => ipcRenderer.invoke('download:clearCompleted'),
    onStarted: (cb) => { ipcRenderer.on('download:started', (_e, data) => cb(data)); },
    onProgress: (cb) => { ipcRenderer.on('download:progress', (_e, data) => cb(data)); },
    onDone: (cb) => { ipcRenderer.on('download:done', (_e, data) => cb(data)); },
  },
});
