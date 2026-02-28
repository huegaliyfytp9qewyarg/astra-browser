// Bookmarks bar and bookmark button logic
const bookmarksItems = document.getElementById('bookmarks-items');
const bookmarkBtn = document.getElementById('bookmark-btn');
const bookmarkIconEmpty = document.getElementById('bookmark-icon-empty');
const bookmarkIconFilled = document.getElementById('bookmark-icon-filled');

let currentPageUrl = '';
let currentPageTitle = '';
let currentPageFavicon = '';
let isCurrentBookmarked = false;

// Load bookmarks bar on startup
loadBookmarksBar();

// Reload bookmarks bar when nav state changes (to update star icon)
astra.nav.onStateChanged(async (state) => {
  currentPageUrl = state.url || '';
  currentPageTitle = state.title || '';

  // Don't show bookmark star for internal pages
  if (currentPageUrl.startsWith('astra://')) {
    bookmarkBtn.style.display = 'none';
    return;
  }
  bookmarkBtn.style.display = '';

  // Check if current page is bookmarked
  try {
    isCurrentBookmarked = await astra.bookmarks.isBookmarked(currentPageUrl);
    updateBookmarkIcon();
  } catch { /* ignore */ }
});

// Bookmark button click — toggle bookmark
bookmarkBtn.addEventListener('click', async () => {
  if (!currentPageUrl || currentPageUrl.startsWith('astra://')) return;

  if (isCurrentBookmarked) {
    await astra.bookmarks.remove(currentPageUrl);
    isCurrentBookmarked = false;
  } else {
    await astra.bookmarks.add({
      title: currentPageTitle || currentPageUrl,
      url: currentPageUrl,
      favicon: currentPageFavicon || null,
    });
    isCurrentBookmarked = true;
  }

  updateBookmarkIcon();
  loadBookmarksBar();
});

// Ctrl+D to bookmark
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
    e.preventDefault();
    bookmarkBtn.click();
  }
});

function updateBookmarkIcon() {
  if (isCurrentBookmarked) {
    bookmarkIconEmpty.style.display = 'none';
    bookmarkIconFilled.style.display = '';
  } else {
    bookmarkIconEmpty.style.display = '';
    bookmarkIconFilled.style.display = 'none';
  }
}

async function loadBookmarksBar() {
  try {
    const bookmarks = await astra.bookmarks.getBar();
    renderBookmarksBar(bookmarks);
  } catch {
    bookmarksItems.innerHTML = '<span class="bookmarks-empty">Bookmarks will appear here</span>';
  }
}

function renderBookmarksBar(bookmarks) {
  bookmarksItems.innerHTML = '';

  if (!bookmarks || bookmarks.length === 0) {
    bookmarksItems.innerHTML = '<span class="bookmarks-empty">Press Ctrl+D to bookmark a page</span>';
    return;
  }

  bookmarks.forEach((bm) => {
    const el = document.createElement('button');
    el.className = 'bookmark-item';
    el.title = bm.url || bm.title;

    if (bm.favicon) {
      const img = document.createElement('img');
      img.className = 'bookmark-item-favicon';
      img.src = bm.favicon;
      img.draggable = false;
      img.onerror = () => { img.style.display = 'none'; };
      el.appendChild(img);
    }

    const title = document.createElement('span');
    title.className = 'bookmark-item-title';
    title.textContent = bm.title || bm.url;
    el.appendChild(title);

    // Click to navigate
    el.addEventListener('click', () => {
      if (bm.url) astra.nav.go(bm.url);
    });

    // Right-click to remove
    el.addEventListener('contextmenu', async (e) => {
      e.preventDefault();
      if (bm.url) {
        await astra.bookmarks.remove(bm.url);
        loadBookmarksBar();
        // Update star icon if we removed the current page's bookmark
        if (bm.url === currentPageUrl) {
          isCurrentBookmarked = false;
          updateBookmarkIcon();
        }
      }
    });

    bookmarksItems.appendChild(el);
  });
}

// Also capture favicon from tab updates for bookmarking
astra.tabs.onUpdate((tab) => {
  if (tab.isActive && tab.favicon) {
    currentPageFavicon = tab.favicon;
  }
});
