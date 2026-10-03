// Local filename-search adaptation. See analysis/batch-20260920/file-name-search-backend-024.md for scope.
function matchPath(pathname, query) {
  const sensitive = query !== query.toLowerCase();
  const text = sensitive ? pathname : pathname.toLowerCase();
  const needle = sensitive ? query : query.toLowerCase();
  if (!needle) return null;
  const rawPositions = [];
  let from = 0, gaps = 0, consecutive = 0;
  for (let index = 0; index < needle.length; index++) {
    const at = text.indexOf(needle[index], from);
    if (at < 0) return null;
    if (index) {
      const gap = at - rawPositions[index - 1] - 1;
      if (gap === 0) consecutive += 4;
      else gaps += 3 + gap;
    }
    rawPositions.push(at);
    from = at + 1;
  }
  // Lowercasing some Unicode characters changes their UTF-16 length. Return
  // highlight offsets in the original path, never offsets into its folded copy.
  let positions = rawPositions;
  if (!sensitive && text.length !== pathname.length) {
    const offsets = [];
    let offset = 0;
    for (const character of pathname) {
      for (let i = 0; i < character.toLowerCase().length; i++) offsets.push(offset);
      offset += character.length;
    }
    positions = rawPositions.map(at => offsets[at]);
  }
  let rankScore = needle.length * 16 + consecutive - gaps;
  for (let i = 0; i < positions.length; i++) {
    const at = positions[i];
    if (at === 0) rankScore += i === 0 ? 8 : 0;
    else if (/[\/\\\-_. ]/.test(pathname[at - 1])) rankScore += 8;
    else if (/[a-z]/.test(pathname[at - 1]) && /[A-Z]/.test(pathname[at])) rankScore += 6;
  }
  rankScore += Math.max(0, 32 - Math.floor(pathname.length / 4));
  return { rankScore, positions };
}

function compareMatches(a, b) {
  // Stable across Git/filesystem enumeration order and the host locale.
  return b.rankScore - a.rankScore || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}

module.exports = { matchPath, compareMatches };
