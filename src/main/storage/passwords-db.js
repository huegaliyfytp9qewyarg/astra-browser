// Secure password storage using Electron's safeStorage (DPAPI on Windows)
const { safeStorage } = require('electron');
const { readJSON, writeJSON } = require('./database');

const PASSWORDS_FILE = 'passwords.json';

function loadPasswords() {
  return readJSON(PASSWORDS_FILE, []);
}

function savePasswords(passwords) {
  writeJSON(PASSWORDS_FILE, passwords);
}

function extractDomain(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

function addPassword(url, username, password) {
  const passwords = loadPasswords();
  const domain = extractDomain(url);
  const existing = passwords.find((p) => p.domain === domain && p.username === username);

  if (existing) {
    existing.encryptedPassword = safeStorage.encryptString(password).toString('base64');
    existing.url = url;
    existing.updatedAt = Date.now();
  } else {
    passwords.push({
      domain, url, username,
      encryptedPassword: safeStorage.encryptString(password).toString('base64'),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
  savePasswords(passwords);
}

function getPasswordsForDomain(domain) {
  const passwords = loadPasswords();
  return passwords
    .filter((p) => p.domain === domain)
    .map((p) => ({
      domain: p.domain,
      url: p.url,
      username: p.username,
      password: safeStorage.decryptString(Buffer.from(p.encryptedPassword, 'base64')),
    }));
}

function getAllPasswords() {
  return loadPasswords().map((p) => ({
    domain: p.domain, url: p.url, username: p.username,
  }));
}

function removePassword(domain, username) {
  const passwords = loadPasswords();
  const filtered = passwords.filter((p) => !(p.domain === domain && p.username === username));
  savePasswords(filtered);
}

function bulkAddPasswords(entries) {
  if (!safeStorage.isEncryptionAvailable()) {
    console.error('[Passwords] safeStorage encryption not available');
    return 0;
  }
  const passwords = loadPasswords();
  const existingKeys = new Set(passwords.map((p) => `${p.domain}:${p.username}`));
  let added = 0;

  for (const entry of entries) {
    const domain = extractDomain(entry.url);
    const key = `${domain}:${entry.username}`;
    if (existingKeys.has(key)) continue;
    if (!entry.username || !entry.password) continue;

    passwords.push({
      domain, url: entry.url, username: entry.username,
      encryptedPassword: safeStorage.encryptString(entry.password).toString('base64'),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    existingKeys.add(key);
    added++;
  }

  if (added > 0) savePasswords(passwords);
  return added;
}

module.exports = { addPassword, getPasswordsForDomain, getAllPasswords, removePassword, bulkAddPasswords, extractDomain };
