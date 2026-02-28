// Tab bar UI logic with drag reorder and detach
const tabsContainer = document.getElementById('tabs-container');
const newTabBtn = document.getElementById('new-tab-btn');

// Window controls
document.getElementById('min-btn').addEventListener('click', () => astra.window.minimize());
document.getElementById('max-btn').addEventListener('click', () => astra.window.maximize());
document.getElementById('close-btn').addEventListener('click', () => astra.window.close());

// New tab
newTabBtn.addEventListener('click', () => astra.tabs.create());

// Current tabs data
let currentTabs = [];
let dragState = null;

function renderTabs(tabs) {
  currentTabs = tabs;
  tabsContainer.innerHTML = '';
  tabs.forEach((tab, index) => {
    const el = createTabElement(tab, index);
    tabsContainer.appendChild(el);
  });
  // Keep the + button at the end, right after the last tab
  tabsContainer.appendChild(newTabBtn);
}

function createTabElement(tab, index) {
  const el = document.createElement('div');
  el.className = 'tab' + (tab.isActive ? ' active' : '');
  el.dataset.tabId = tab.id;
  el.dataset.index = index;
  el.draggable = true;

  // Favicon
  if (tab.isLoading) {
    const spinner = document.createElement('div');
    spinner.className = 'favicon-spinner';
    el.appendChild(spinner);
  } else if (tab.favicon) {
    const img = document.createElement('img');
    img.className = 'tab-favicon';
    img.src = tab.favicon;
    img.draggable = false;
    img.onerror = () => { img.style.display = 'none'; };
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
  el.addEventListener('click', () => astra.tabs.switch(tab.id));

  // Middle click to close
  el.addEventListener('mousedown', (e) => {
    if (e.button === 1) {
      e.preventDefault();
      astra.tabs.close(tab.id);
    }
  });

  // Drag start
  el.addEventListener('dragstart', (e) => {
    dragState = {
      tabId: tab.id,
      index: index,
      startX: e.screenX,
      startY: e.screenY,
    };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tab.id.toString());
    el.classList.add('dragging');
    // Slight delay to let the drag image render
    setTimeout(() => el.style.opacity = '0.4', 0);
  });

  el.addEventListener('dragend', (e) => {
    el.style.opacity = '';
    el.classList.remove('dragging');

    // Check if dragged far enough vertically to detach
    if (dragState) {
      const dy = Math.abs(e.screenY - dragState.startY);
      if (dy > 80) {
        astra.tabs.detach(dragState.tabId);
      }
    }
    dragState = null;

    // Remove all drop indicators
    document.querySelectorAll('.tab').forEach((t) => {
      t.classList.remove('drop-left', 'drop-right');
    });
  });

  // Drag over — show drop indicator
  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (!dragState) return;
    const rect = el.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;

    // Show indicator on left or right side
    document.querySelectorAll('.tab').forEach((t) => {
      t.classList.remove('drop-left', 'drop-right');
    });

    if (e.clientX < midX) {
      el.classList.add('drop-left');
    } else {
      el.classList.add('drop-right');
    }
  });

  el.addEventListener('dragleave', () => {
    el.classList.remove('drop-left', 'drop-right');
  });

  // Drop — reorder
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    el.classList.remove('drop-left', 'drop-right');

    if (!dragState) return;
    const rect = el.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    let newIndex = parseInt(el.dataset.index);

    if (e.clientX >= midX) {
      newIndex = newIndex + 1;
    }

    // Adjust if dragging forward
    if (dragState.index < newIndex) {
      newIndex = newIndex - 1;
    }

    if (newIndex !== dragState.index) {
      astra.tabs.reorder(dragState.tabId, newIndex);
    }
  });

  return el;
}

// Listen for tab updates
astra.tabs.onAllUpdated((tabs) => renderTabs(tabs));

astra.tabs.onUpdate((tab) => {
  const el = tabsContainer.querySelector('[data-tab-id="' + tab.id + '"]');
  if (el) {
    const index = parseInt(el.dataset.index);
    const newEl = createTabElement(tab, index);
    el.replaceWith(newEl);
  }
});

// Initial load
astra.tabs.getAll().then((tabs) => {
  if (tabs.length > 0) renderTabs(tabs);
});
