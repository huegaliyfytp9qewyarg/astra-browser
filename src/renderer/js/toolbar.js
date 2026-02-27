// Toolbar logic: address bar, navigation buttons, privacy shield
const addressBar = document.getElementById('address-bar');
const backBtn = document.getElementById('back-btn');
const forwardBtn = document.getElementById('forward-btn');
const reloadBtn = document.getElementById('reload-btn');
const reloadIcon = document.getElementById('reload-icon');
const stopIcon = document.getElementById('stop-icon');
const securityIcon = document.getElementById('security-icon');
const shieldBtn = document.getElementById('shield-btn');
const shieldCount = document.getElementById('shield-count');

let isLoading = false;

// Address bar: navigate on Enter
addressBar.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const input = addressBar.value.trim();
    if (input) {
      astra.nav.go(input);
      addressBar.blur();
    }
  }
  if (e.key === 'Escape') {
    addressBar.blur();
  }
});

// Select all on focus
addressBar.addEventListener('focus', () => {
  setTimeout(() => addressBar.select(), 0);
});

// Navigation buttons
backBtn.addEventListener('click', () => astra.nav.back());
forwardBtn.addEventListener('click', () => astra.nav.forward());
reloadBtn.addEventListener('click', () => {
  if (isLoading) {
    astra.nav.stop();
  } else {
    astra.nav.reload();
  }
});

// Update toolbar state when navigation changes
astra.nav.onStateChanged((state) => {
  // Update address bar
  if (document.activeElement !== addressBar) {
    addressBar.value = state.url || '';
  }

  // Update nav buttons
  backBtn.disabled = !state.canGoBack;
  forwardBtn.disabled = !state.canGoForward;

  // Update reload/stop toggle
  isLoading = state.isLoading;
  reloadIcon.style.display = isLoading ? 'none' : '';
  stopIcon.style.display = isLoading ? '' : 'none';

  // Update security icon
  if (state.url && state.url.startsWith('https://')) {
    securityIcon.classList.add('secure');
  } else {
    securityIcon.classList.remove('secure');
  }
});

// Privacy shield: show blocked count
shieldBtn.addEventListener('click', async () => {
  const status = await astra.privacy.getStatus();
  const msg = `Ads/trackers blocked: ${status.adsBlocked}\nAd blocker: ${status.adBlockEnabled ? 'ON' : 'OFF'}\nHTTPS upgrades: ${status.httpsUpgradeEnabled ? 'ON' : 'OFF'}`;
  // For now, just toggle ad blocker on click
  // Later this will open a privacy popup
  console.log(msg);
});

// Periodically update shield count
setInterval(async () => {
  try {
    const status = await astra.privacy.getStatus();
    if (status.adsBlocked > 0) {
      shieldCount.textContent = status.adsBlocked > 999 ? '999+' : status.adsBlocked;
      shieldCount.classList.remove('hidden');
    }
  } catch { /* ignore */ }
}, 5000);

// Ctrl+L to focus address bar
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
    e.preventDefault();
    addressBar.focus();
    addressBar.select();
  }
});
