const { Menu, clipboard } = require('electron');

function setupContextMenu(webContents, createTab) {
  webContents.on('context-menu', (_event, params) => {
    const menuItems = [];

    // Link actions
    if (params.linkURL) {
      menuItems.push({
        label: 'Open Link in New Tab',
        click: () => createTab(params.linkURL),
      });
      menuItems.push({
        label: 'Copy Link Address',
        click: () => clipboard.writeText(params.linkURL),
      });
      menuItems.push({ type: 'separator' });
    }

    // Image actions
    if (params.hasImageContents) {
      menuItems.push({
        label: 'Open Image in New Tab',
        click: () => createTab(params.srcURL),
      });
      menuItems.push({
        label: 'Save Image As...',
        click: () => webContents.downloadURL(params.srcURL),
      });
      menuItems.push({
        label: 'Copy Image',
        click: () => webContents.copyImageAt(params.x, params.y),
      });
      menuItems.push({ type: 'separator' });
    }

    // Text editing
    if (params.isEditable) {
      menuItems.push({ label: 'Undo', role: 'undo' });
      menuItems.push({ label: 'Redo', role: 'redo' });
      menuItems.push({ type: 'separator' });
      menuItems.push({ label: 'Cut', role: 'cut' });
      menuItems.push({ label: 'Copy', role: 'copy' });
      menuItems.push({ label: 'Paste', role: 'paste' });
      menuItems.push({ label: 'Select All', role: 'selectAll' });
    } else {
      if (params.selectionText) {
        menuItems.push({ label: 'Copy', role: 'copy' });
        menuItems.push({ type: 'separator' });
        const searchText = params.selectionText.substring(0, 40);
        const label = searchText.length < params.selectionText.length
          ? `Search for "${searchText}..."`
          : `Search for "${searchText}"`;
        menuItems.push({
          label,
          click: () => createTab(`astra://search?q=${encodeURIComponent(params.selectionText)}`),
        });
      }
    }

    // Navigation
    menuItems.push({ type: 'separator' });
    menuItems.push({
      label: 'Back',
      enabled: webContents.canGoBack(),
      click: () => webContents.goBack(),
    });
    menuItems.push({
      label: 'Forward',
      enabled: webContents.canGoForward(),
      click: () => webContents.goForward(),
    });
    menuItems.push({
      label: 'Reload',
      click: () => webContents.reload(),
    });
    menuItems.push({ type: 'separator' });
    menuItems.push({ label: 'Select All', role: 'selectAll' });

    // Dev tools
    menuItems.push({ type: 'separator' });
    menuItems.push({
      label: 'Inspect Element',
      click: () => webContents.inspectElement(params.x, params.y),
    });

    Menu.buildFromTemplate(menuItems).popup();
  });
}

module.exports = { setupContextMenu };
