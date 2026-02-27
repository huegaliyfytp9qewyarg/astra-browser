module.exports = {
  IPC: {
    TAB_CREATE: 'tab:create',
    TAB_CLOSE: 'tab:close',
    TAB_SWITCH: 'tab:switch',
    TAB_GET_ALL: 'tab:getAll',
    TAB_UPDATED: 'tab:updated',
    TAB_ACTIVATED: 'tab:activated',

    NAV_GO: 'nav:go',
    NAV_BACK: 'nav:back',
    NAV_FORWARD: 'nav:forward',
    NAV_RELOAD: 'nav:reload',
    NAV_STOP: 'nav:stop',
    NAV_STATE_CHANGED: 'nav:stateChanged',

    SEARCH_QUERY: 'search:query',

    BOOKMARKS_ADD: 'bookmarks:add',
    BOOKMARKS_REMOVE: 'bookmarks:remove',
    BOOKMARKS_GET_BAR: 'bookmarks:getBar',
    BOOKMARKS_GET_ALL: 'bookmarks:getAll',
    BOOKMARKS_IS_BOOKMARKED: 'bookmarks:isBookmarked',

    HISTORY_GET_RECENT: 'history:getRecent',
    HISTORY_SEARCH: 'history:search',
    HISTORY_CLEAR: 'history:clear',
    HISTORY_DELETE: 'history:delete',

    SETTINGS_GET: 'settings:get',
    SETTINGS_SET: 'settings:set',
    SETTINGS_GET_ALL: 'settings:getAll',

    PRIVACY_GET_STATUS: 'privacy:getStatus',
    PRIVACY_TOGGLE_ADS: 'privacy:toggleAds',
    PRIVACY_TOGGLE_HTTPS: 'privacy:toggleHttps',

    FIND_IN_PAGE: 'find:inPage',
    FIND_STOP: 'find:stop',

    WINDOW_MINIMIZE: 'window:minimize',
    WINDOW_MAXIMIZE: 'window:maximize',
    WINDOW_CLOSE: 'window:close',
  },

  CHROME_HEIGHT: 80,
  TAB_BAR_HEIGHT: 36,
  TOOLBAR_HEIGHT: 44,
  BOOKMARKS_BAR_HEIGHT: 28,

  DEFAULT_URL: 'astra://newtab',
  PROTOCOL: 'astra',

  SEARCH_ENGINES: {
    ASTRA: 'astra',
    DUCKDUCKGO: 'duckduckgo',
    BRAVE: 'brave',
  },
};
