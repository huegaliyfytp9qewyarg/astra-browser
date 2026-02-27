// Minimal preload for web-facing tab content
// No IPC bridge exposed - web content is fully sandboxed
// Only the adblocker cosmetic filtering script is injected here if needed

try {
  require('@ghostery/adblocker-electron-preload');
} catch {
  // Adblocker preload not available, skip cosmetic filtering
}
