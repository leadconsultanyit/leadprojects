// Lightweight fuzzy matching utilities for search boxes across the app.
// Goal: tolerant matching (e.g. "Karthik" should match "Kartik") with the
// most-compatible results ranked first.

function normalize(s) {
  return String(s == null ? '' : s).toLowerCase().trim();
}

// Levenshtein edit distance (iterative, O(n*m)).
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

// Dice coefficient on character bigrams — good for transposition/typo tolerance.
function diceCoefficient(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = new Map();
  for (let i = 0; i < a.length - 1; i++) {
    const bg = a.substr(i, 2);
    bigrams.set(bg, (bigrams.get(bg) || 0) + 1);
  }
  let intersection = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bg = b.substr(i, 2);
    const count = bigrams.get(bg) || 0;
    if (count > 0) {
      bigrams.set(bg, count - 1);
      intersection++;
    }
  }
  return (2 * intersection) / (a.length + b.length - 2);
}

// Similarity between two strings in [0, 1]. Blends a normalized Levenshtein
// distance with the Dice bigram coefficient for robustness.
export function similarity(a, b) {
  a = normalize(a);
  b = normalize(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  const lev = 1 - levenshtein(a, b) / maxLen;
  const dice = diceCoefficient(a, b);
  return Math.max(lev, dice);
}

// Best fuzzy score of `query` against a single `text`, accounting for the case
// where the query matches a word/substring within a longer field.
export function fuzzyScore(query, text) {
  const q = normalize(query);
  const t = normalize(text);
  if (!q) return 1;
  if (!t) return 0;
  if (t.includes(q)) return 1;                       // direct substring → top score
  let best = similarity(q, t);
  // Compare against individual tokens so a query can match one word in a phrase.
  for (const token of t.split(/[\s,/&\-_.]+/)) {
    if (!token) continue;
    if (token.startsWith(q)) best = Math.max(best, 0.95);
    best = Math.max(best, similarity(q, token));
  }
  return best;
}

// Best score of `query` across multiple field values for one item.
export function fuzzyScoreFields(query, fields) {
  const list = Array.isArray(fields) ? fields : [fields];
  let best = 0;
  for (const f of list) best = Math.max(best, fuzzyScore(query, f));
  return best;
}

// Filter + sort items by fuzzy relevance. `getFields` returns the searchable
// strings for an item. Returns matches (score >= threshold) best-first.
// An empty query returns the items unchanged.
export function fuzzyFilterSort(query, items, getFields, threshold = 0.4) {
  const q = normalize(query);
  if (!q) return items;
  return items
    .map(item => ({ item, score: fuzzyScoreFields(q, getFields(item)) }))
    .filter(x => x.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .map(x => x.item);
}
