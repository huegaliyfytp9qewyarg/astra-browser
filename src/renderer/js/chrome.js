// Tab bar UI logic
const tabsContainer = document.getElementById('tabs-container');
const newTabBtn = document.getElementById('new-tab-btn');

// Window controls
document.getElementById('min-btn').addEventListener('click', () => astra.window.minimize());
document.getElementById('max-btn').addEventListener('click', () => astra.window.maximize());
document.getElementById('close-btn').addEventListener('click', () => astra.window.close());

// New tab
newTabBtn.addEventListener('click', () => {
  astra.tabs.create();
});

// Render all tabs
function renderTabs(tabs) {
  tabsContainer.innerHTML = '';
  tabs.forEach((tab) => {
    const el = createTabElement(tab);
    tabsContainer.appendChild(el);
  });
}

function createTabElement(tab) {
  const el = document.createElement('div');
  el.className = 'tab' + (tab.isActive ? ' active' : '');
  el.dataset.tabId = tab.id;

  // Favicon
  if (tab.isLoading) {
    const spinner = document.createElement('div');
    spinner.className = 'favicon-spinner';
    el.appendChild(spinner);
  } else if (tab.favicon) {
    const img = document.createElement('img');
    img.className = 'tab-favicon';
    img.src = tab.favicon;
    img.onerror = () => {
      img.style.display = 'none';
    };
    el.appendChild(img);
  }

  // Title
  const title = document.createElement('span');
  title.className = 'tab-title';
  title.textContent = tab.title || 'New Tab';
  el.appendChild(title);

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'tab-close';
  closeBtn.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="1.2"/></svg>';
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    astra.tabs.close(tab.id);
  });
  el.appendChild(closeBtn);

  // Click to switch
  el.addEventListener('click', () => {
    astra.tabs.switch(tab.id);
  });

  // Middle click to close
  el.addEventListener('mousedown', (e) => {
    if (e.button === 1) {
      e.preventDefault();
      astra.tabs.close(tab.id);
    }
  });

  return el;
}

// Listen for tab updates
astra.tabs.onAllUpdated((tabs) => {
  renderTabs(tabs);
});

astra.tabs.onUpdate((tab) => {
  // Update a single tab element
  const el = tabsContainer.querySelector(`[data-tab-id="${tab.id}"]`);
  if (el) {
    const newEl = createTabElement(tab);
    el.replaceWith(newEl);
  }
});

// Initial load
astra.tabs.getAll().then((tabs) => {
  if (tabs.length === 0) {
    // No tabs exist yet, the main process will create one
  } else {
    renderTabs(tabs);
  }
});
