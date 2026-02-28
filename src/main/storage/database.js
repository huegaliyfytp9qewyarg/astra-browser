// JSON file-based storage (replaces better-sqlite3 to avoid native module cross-compilation issues)
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

let dataDir = null;

function getDataDir() {
  if (dataDir) return dataDir;
  dataDir = app.getPath('userData');
  return dataDir;
}

function readJSON(filename, defaultValue) {
  try {
    const filePath = path.join(getDataDir(), filename);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (err) {
    console.error(`[Storage] Failed to read ${filename}:`, err);
  }
  return defaultValue;
}

function writeJSON(filename, data) {
  try {
    const filePath = path.join(getDataDir(), filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`[Storage] Failed to write ${filename}:`, err);
  }
}

module.exports = { getDataDir, readJSON, writeJSON };
