const URL_PATTERN = /^(https?:\/\/|file:\/\/|astra:\/\/)/i;
const DOMAIN_PATTERN = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+/;
const IP_PATTERN = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/|$)/;
const LOCALHOST_PATTERN = /^localhost(:\d+)?(\/|$)/i;

function isValidURL(input) {
  if (!input || typeof input !== 'string') return false;
  const trimmed = input.trim();
  if (URL_PATTERN.test(trimmed)) return true;
  if (IP_PATTERN.test(trimmed)) return true;
  if (LOCALHOST_PATTERN.test(trimmed)) return true;
  if (DOMAIN_PATTERN.test(trimmed) && !trimmed.includes(' ')) return true;
  return false;
}

function normalizeURL(input) {
  const trimmed = input.trim();
  if (/^astra:\/\//i.test(trimmed)) return trimmed;
  if (/^file:\/\//i.test(trimmed)) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (IP_PATTERN.test(trimmed) || LOCALHOST_PATTERN.test(trimmed)) {
    return 'http://' + trimmed;
  }
  return 'https://' + trimmed;
}

function isSearchQuery(input) {
  return !isValidURL(input);
}

function formatDisplayURL(url) {
  if (!url) return '';
  if (url.startsWith('astra://')) return url;
  try {
    const parsed = new URL(url);
    let display = parsed.hostname + parsed.pathname;
    if (display.endsWith('/')) display = display.slice(0, -1);
    if (parsed.search) display += parsed.search;
    return display;
  } catch {
    return url;
  }
}

function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function normalizeForDedup(url) {
  try {
    const parsed = new URL(url);
    let normalized = parsed.hostname.replace(/^www\./, '') + parsed.pathname;
    if (normalized.endsWith('/')) normalized = normalized.slice(0, -1);
    return normalized.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

module.exports = {
  isValidURL,
  normalizeURL,
  isSearchQuery,
  formatDisplayURL,
  extractDomain,
  normalizeForDedup,
};
