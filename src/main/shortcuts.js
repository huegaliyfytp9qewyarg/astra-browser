// Keyboard shortcuts are handled via the application menu accelerators
// and via IPC from the chrome renderer for address bar focus (Ctrl+L)
// This file handles any additional global shortcut registration if needed.

function registerShortcuts() {
  // Most shortcuts are handled in menu.js via accelerators
  // Additional shortcuts can be registered here using globalShortcut if needed
}

module.exports = { registerShortcuts };
