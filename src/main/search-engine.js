const { normalizeForDedup } = require('../shared/url-utils');

async function search(query) {
  const results = [];
  const errors = [];

  // Search DuckDuckGo
  try {
    const ddgResults = await searchDDG(query);
    results.push(...ddgResults.map((r, i) => ({ ...r, source: 'DuckDuckGo', rank: i + 1 })));
  } catch (err) {
    errors.push(`DuckDuckGo: ${err.message}`);
  }

  // Merge and deduplicate
  const merged = deduplicateResults(results);

  return {
    query,
    results: merged,
    total: merged.length,
    errors: errors.length > 0 ? errors : undefined,
  };
}

async function searchDDG(query) {
  try {
    const ddg = await import('duck-duck-scrape');
    const searchResults = await ddg.search(query, { safeSearch: ddg.SafeSearchType.MODERATE });

    if (!searchResults || !searchResults.results) return [];

    return searchResults.results.slice(0, 20).map((r) => ({
      title: r.title || '',
      url: r.url || '',
      description: r.description || '',
    }));
  } catch (err) {
    console.error('DDG search error:', err);
    throw err;
  }
}

function deduplicateResults(results) {
  const seen = new Map();
  const merged = [];

  for (const result of results) {
    const key = normalizeForDedup(result.url);
    if (seen.has(key)) {
      // Add source to existing result
      const existing = seen.get(key);
      if (!existing.sources.includes(result.source)) {
        existing.sources.push(result.source);
        existing.score += 1; // Bonus for appearing in multiple engines
      }
    } else {
      const entry = {
        title: result.title,
        url: result.url,
        description: result.description,
        sources: [result.source],
        score: 1 / result.rank, // Position-based score
      };
      seen.set(key, entry);
      merged.push(entry);
    }
  }

  // Sort by score descending
  merged.sort((a, b) => b.score - a.score);
  return merged.slice(0, 30);
}

module.exports = { search };
