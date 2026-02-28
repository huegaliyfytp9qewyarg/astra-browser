// Bookmarks bar and bookmark button logic
const bookmarksItems = document.getElementById('bookmarks-items');
const bookmarkBtn = document.getElementById('bookmark-btn');
const bookmarkIconEmpty = document.getElementById('bookmark-icon-empty');
const bookmarkIconFilled = document.getElementById('bookmark-icon-filled');
const addressBar = document.getElementById('address-bar');

let currentPageUrl = '';
let currentPageTitle = '';
let currentPageFavicon = '';
let isCurrentBookmarked = false;

// Load bookmarks bar on startup
loadBookmarksBar();

// Update state when nav state changes
astra.nav.onStateChanged(async (state) => {
  currentPageUrl = state.url || '';
  currentPageTitle = state.title || '';

  // Hide bookmark star for internal pages, show for real pages
  if (!currentPageUrl || currentPageUrl.startsWith('astra://')) {
    bookmarkBtn.style.visibility = 'hidden';
  } else {
    bookmarkBtn.style.visibility = 'visible';
    try {
      isCurrentBookmarked = await astra.bookmarks.isBookmarked(currentPageUrl);
      updateBookmarkIcon();
    } catch (err) {
      console.error('[Bookmarks] isBookmarked failed:', err);
    }
  }
});

// Use mousedown instead of click — more reliable, fires before focus changes
bookmarkBtn.addEventListener('mousedown', async (e) => {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  // Get URL — try multiple sources
  let url = currentPageUrl;
  if (!url || url.startsWith('astra://')) {
    url = addressBar ? addressBar.value.trim() : '';
  }
  if (!url || url.startsWith('astra://')) {
    // Flash red to show it can't bookmark this page
    bookmarkBtn.style.color = '#ef4444';
    setTimeout(() => { bookmarkBtn.style.color = ''; }, 500);
    return;
  }

  // Immediate visual feedback — flash the button
  bookmarkBtn.style.color = 'var(--accent, #6366f1)';

  try {
    if (isCurrentBookmarked) {
      await astra.bookmarks.remove(url);
      isCurrentBookmarked = false;
    } else {
      await astra.bookmarks.add({
        title: currentPageTitle || url,
        url: url,
        favicon: currentPageFavicon || null,
      });
      isCurrentBookmarked = true;
    }
    updateBookmarkIcon();
    await loadBookmarksBar();
  } catch (err) {
    console.error('[Bookmarks] toggle failed:', err);
    // Flash red on error
    bookmarkBtn.style.color = '#ef4444';
    setTimeout(() => { bookmarkBtn.style.color = ''; }, 1000);
  }
});

// Ctrl+D to bookmark
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
    e.preventDefault();
    // Simulate mousedown on the bookmark button
    bookmarkBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  }
});

function updateBookmarkIcon() {
  if (isCurrentBookmarked) {
    bookmarkIconEmpty.style.display = 'none';
    bookmarkIconFilled.style.display = '';
    bookmarkBtn.style.color = 'var(--accent, #6366f1)';
  } else {
    bookmarkIconEmpty.style.display = '';
    bookmarkIconFilled.style.display = 'none';
    bookmarkBtn.style.color = '';
  }
}

async function loadBookmarksBar() {
  try {
    const bookmarks = await astra.bookmarks.getBar();
    renderBookmarksBar(bookmarks);
  } catch (err) {
    console.error('[Bookmarks] loadBookmarksBar failed:', err);
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

    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (bm.url) astra.nav.go(bm.url);
    });

    // Right-click to remove
    el.addEventListener('contextmenu', async (e) => {
      e.preventDefault();
      if (bm.url) {
        await astra.bookmarks.remove(bm.url);
        loadBookmarksBar();
        if (bm.url === currentPageUrl) {
          isCurrentBookmarked = false;
          updateBookmarkIcon();
        }
      }
    });

    bookmarksItems.appendChild(el);
  });
}

// Capture favicon from tab updates
astra.tabs.onUpdate((tab) => {
  if (tab.isActive && tab.favicon) {
    currentPageFavicon = tab.favicon;
  }
});
