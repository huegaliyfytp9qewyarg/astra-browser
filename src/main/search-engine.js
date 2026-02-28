const { net } = require('electron');
const { normalizeForDedup } = require('../shared/url-utils');

async function search(query) {
  const results = [];
  const errors = [];

  // Search DuckDuckGo via lite page (POST, most reliable)
  try {
    const ddgResults = await searchDDGLite(query);
    results.push(...ddgResults.map((r, i) => ({ ...r, source: 'DuckDuckGo', rank: i + 1 })));
  } catch (err) {
    console.error('[Astra] DDG lite search error:', err.message);
    errors.push('DuckDuckGo: ' + err.message);
  }

  const merged = deduplicateResults(results);

  return {
    query,
    results: merged,
    total: merged.length,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// Use DuckDuckGo's lite page with POST — most reliable, no API key needed
async function searchDDGLite(query) {
  const postBody = 'q=' + encodeURIComponent(query);

  const html = await fetchPost('https://lite.duckduckgo.com/lite/', postBody, {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'en-US,en;q=0.9',
  });

  return parseDDGLite(html);
}

function parseDDGLite(html) {
  const results = [];

  // DDG lite format: <a rel="nofollow" href="URL" class='result-link'>Title</a>
  // followed by a snippet in a <td class="result-snippet">...</td>
  const rows = html.split(/<tr>/g);

  let currentResult = null;

  for (const row of rows) {
    // Check for a result link
    const linkMatch = row.match(/class='result-link'[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/a>/i) ||
                      row.match(/class="result-link"[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/a>/i);
    const hrefMatch = row.match(/href="(https?:\/\/[^"]*)"/);

    if (linkMatch && hrefMatch) {
      // Save previous result
      if (currentResult && currentResult.url) {
        results.push(currentResult);
      }
      currentResult = {
        title: stripHtml(linkMatch[1]).trim(),
        url: hrefMatch[1],
        description: '',
      };
    }

    // Check for snippet
    const snippetMatch = row.match(/class='result-snippet'[^>]*>([\s\S]*?)<\/td>/i) ||
                         row.match(/class="result-snippet"[^>]*>([\s\S]*?)<\/td>/i);
    if (snippetMatch && currentResult) {
      currentResult.description = stripHtml(snippetMatch[1]).trim();
    }
  }

  // Don't forget the last result
  if (currentResult && currentResult.url) {
    results.push(currentResult);
  }

  return results.slice(0, 25);
}

function stripHtml(html) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fetchPost(url, body, headers) {
  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'POST',
      url: url,
    });

    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        request.setHeader(key, value);
      }
    }

    let responseBody = '';
    request.on('response', (response) => {
      // Follow redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        const redirectUrl = Array.isArray(response.headers.location)
          ? response.headers.location[0]
          : response.headers.location;
        // On redirect, switch to GET
        fetchGet(redirectUrl, headers).then(resolve).catch(reject);
        return;
      }

      response.on('data', (chunk) => { responseBody += chunk.toString(); });
      response.on('end', () => resolve(responseBody));
      response.on('error', reject);
    });

    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

function fetchGet(url, headers) {
  return new Promise((resolve, reject) => {
    const request = net.request(url);

    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        request.setHeader(key, value);
      }
    }

    let body = '';
    request.on('response', (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        const redirectUrl = Array.isArray(response.headers.location)
          ? response.headers.location[0]
          : response.headers.location;
        fetchGet(redirectUrl, headers).then(resolve).catch(reject);
        return;
      }

      response.on('data', (chunk) => { body += chunk.toString(); });
      response.on('end', () => resolve(body));
      response.on('error', reject);
    });

    request.on('error', reject);
    request.end();
  });
}

function deduplicateResults(results) {
  const seen = new Map();
  const merged = [];

  for (const result of results) {
    const key = normalizeForDedup(result.url);
    if (seen.has(key)) {
      const existing = seen.get(key);
      if (!existing.sources.includes(result.source)) {
        existing.sources.push(result.source);
        existing.score += 1;
      }
    } else {
      const entry = {
        title: result.title,
        url: result.url,
        description: result.description,
        sources: [result.source],
        score: 1 / result.rank,
      };
      seen.set(key, entry);
      merged.push(entry);
    }
  }

  merged.sort((a, b) => b.score - a.score);
  return merged.slice(0, 30);
}

module.exports = { search };
