const { session, shell } = require('electron');
const { getChromeView, setDownloadsBarHeight } = require('./window-manager');
const { DOWNLOADS_BAR_HEIGHT } = require('../shared/constants');

let downloads = new Map();
let downloadCounter = 0;

function init() {
  session.defaultSession.on('will-download', (_event, item) => {
    const id = ++downloadCounter;

    const info = {
      id,
      filename: item.getFilename(),
      path: item.getSavePath(),
      totalBytes: item.getTotalBytes(),
      receivedBytes: 0,
      state: 'progressing',
      startTime: Date.now(),
      item,
    };

    downloads.set(id, info);
    updateDownloadsBarVisibility();
    sendToChrome('download:started', sanitize(info));

    item.on('updated', (_event, state) => {
      info.receivedBytes = item.getReceivedBytes();
      info.totalBytes = item.getTotalBytes();
      info.path = item.getSavePath();
      info.state = state;
      sendToChrome('download:progress', sanitize(info));
    });

    item.once('done', (_event, state) => {
      info.state = state;
      info.receivedBytes = item.getReceivedBytes();
      info.path = item.getSavePath();
      sendToChrome('download:done', sanitize(info));
    });
  });
}

function sanitize(info) {
  return {
    id: info.id,
    filename: info.filename,
    path: info.path,
    totalBytes: info.totalBytes,
    receivedBytes: info.receivedBytes,
    state: info.state,
    startTime: info.startTime,
  };
}

function sendToChrome(channel, data) {
  const chrome = getChromeView();
  if (chrome) {
    chrome.webContents.send(channel, data);
  }
}

function updateDownloadsBarVisibility() {
  const hasActive = [...downloads.values()].some(
    (d) => d.state === 'progressing' || d.state === 'interrupted'
  );
  if (hasActive) {
    setDownloadsBarHeight(DOWNLOADS_BAR_HEIGHT);
  }
}

function cancel(id) {
  const dl = downloads.get(id);
  if (dl && dl.item) dl.item.cancel();
}

function pause(id) {
  const dl = downloads.get(id);
  if (dl && dl.item) dl.item.pause();
}

function resume(id) {
  const dl = downloads.get(id);
  if (dl && dl.item && dl.item.canResume()) dl.item.resume();
}

function openFile(id) {
  const dl = downloads.get(id);
  if (dl && dl.path) shell.openPath(dl.path);
}

function showInFolder(id) {
  const dl = downloads.get(id);
  if (dl && dl.path) shell.showItemInFolder(dl.path);
}

function clearCompleted() {
  for (const [id, dl] of downloads) {
    if (dl.state === 'completed' || dl.state === 'cancelled') {
      downloads.delete(id);
    }
  }
}

function hideBar() {
  setDownloadsBarHeight(0);
}

module.exports = { init, cancel, pause, resume, openFile, showInFolder, clearCompleted, hideBar };
