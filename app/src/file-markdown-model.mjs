// Files viewer Markdown preview plan (2.2553.1 ion-dist/assets/v1/
// cd2efac6e-CAi4fxTN.js, prettier-formatted :232-937). Ai renders a file
// through Ti: Ur splits off a YAML frontmatter block (shown as the ki <dl>
// grid), a body above Si = 49152 chars is cut into ~16 KiB chunks at block
// boundaries (Ar over shared-16 Bx), and when any chunk trips Ci the whole
// source is shown as plain text (ji) instead. This module is the pure part;
// source-file-viewer.jsx mounts it.

// --- Size gate (Lr :372-397, Ci :889-897, Vr :398-405) ---------------------

export const MARKDOWN_PROGRESSIVE_CHARS = 49152; // Si
export const MARKDOWN_CHUNK_CHARS = 16384; // pr
export const MARKDOWN_FIRST_CHUNK_CHARS = 24576; // pr * 1.5, Ei's progressive cap
export const MARKDOWN_PLAIN_LIMITS = Object.freeze({ chars: 524288, pipes: 5000, longestRun: 262144, longestLine: 32768 });

const BLANK = /^[ \t\r]*$/; // vr
const DEFINITION_LINE = /^ {0,3}\[[^\]]{1,999}\]:/; // Fr
// Ir: data-URL images and reference definitions are not counted as prose.
const uncounted = (line) => line.includes('](data:') || DEFINITION_LINE.test(line);

// Lr: the pipe count, the counted characters, the longest run of non-blank
// lines and the longest counted line.
export function markdownFileStats(text) {
  let pipes = 0;
  for (let at = text.indexOf('|'); at !== -1; at = text.indexOf('|', at + 1)) pipes += 1;
  let chars = 0, longestRun = 0, longestLine = 0, run = 0, at = 0;
  while (at < text.length) {
    const newline = text.indexOf('\n', at), end = newline === -1 ? text.length : newline, line = text.slice(at, end);
    at = end + 1;
    if (BLANK.test(line)) {
      chars += line.length + 1;
      longestRun = Math.max(longestRun, run);
      run = 0;
    } else if (!uncounted(line)) {
      chars += line.length + 1;
      run += line.length + 1;
      longestLine = Math.max(longestLine, line.length);
    }
  }
  return { chars, pipes, longestRun: Math.max(longestRun, run), longestLine };
}
// Ci: formatting this text would be too slow.
export function markdownTooSlow(text) {
  const stats = markdownFileStats(text);
  return stats.chars > MARKDOWN_PLAIN_LIMITS.chars || stats.pipes > MARKDOWN_PLAIN_LIMITS.pipes
    || stats.longestRun > MARKDOWN_PLAIN_LIMITS.longestRun || stats.longestLine > MARKDOWN_PLAIN_LIMITS.longestLine;
}
// Vr: the contain-intrinsic-size estimate of an unmounted chunk.
export function markdownChunkHeight(text) {
  return Math.round(text.split('\n').length * 24 + (text.length / 90) * 14);
}

// --- Block boundaries (shared-16-Cg1UfeMy.js Lx/Rx/zx/Bx) -------------------

// Bx: the offsets of the lines that start a new top-level block, scanned
// line by line with the open fence, math, list, table, quote and indented
// code state (a complete text, so zx's streaming tail state is not kept).
export function markdownBlockBoundaries(text) {
  const lines = text.split('\n'), last = lines.length - 1, boundaries = [];
  let fence = null, inMath = false, inList = false, listPendingBlank = false, inTable = false, inQuote = false;
  let inIndented = false, indentedPendingBlank = false, hadBlank = false, hadContent = false, offset = 0;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index], trimmed = line.trim(), blank = BLANK.test(line), indented = /^( {4}| {0,3}\t)/.test(line);
    const fenced = fence !== null, nested = fenced || inMath || inList || inTable || inQuote || inIndented;
    let leftIndented = false, leftList = false;
    if (inIndented) {
      if (blank) indentedPendingBlank = true;
      else if (indented) indentedPendingBlank = false;
      else { inIndented = false; leftIndented = indentedPendingBlank; indentedPendingBlank = false; }
    } else if (indented && !blank && !nested && (hadBlank || !hadContent)) {
      inIndented = true;
      indentedPendingBlank = false;
    }
    const fenceMatch = indented || inMath || inIndented ? null : trimmed.match(/^(`{3,}|~{3,})/);
    if (fenceMatch) {
      const char = fenceMatch[1][0], length = fenceMatch[1].length;
      if (fence === null) fence = { char, length };
      else if (char === fence.char && length >= fence.length && trimmed.length === length) fence = null;
    }
    const wasMath = inMath;
    if (!fenced && !inIndented) {
      if (trimmed === '$$') inMath = !inMath;
      if (!wasMath) {
        const rule = /^([-*_])(?:[ \t]*\1){2,}$/.test(trimmed);
        if (!indented && !rule && /^[-*+]\s|^\d+[.)]\s/.test(trimmed)) { inList = true; listPendingBlank = false; }
        else if (inList && blank) listPendingBlank = true;
        else if (inList && listPendingBlank) {
          if (/^[ \t]/.test(line)) listPendingBlank = false;
          else { inList = false; listPendingBlank = false; leftList = true; }
        }
        if (trimmed.includes('|')) inTable = true;
        else if (inTable && blank) inTable = false;
        if (!indented && trimmed.startsWith('>')) inQuote = true;
        else if (inQuote && blank) inQuote = false;
      }
    }
    if (blank) {
      if ((!nested && hadContent) || (nested && !(fence !== null || inMath || inList || inTable || inQuote || inIndented))) hadBlank = true;
    } else if (leftIndented || (leftList && !(index === last && /^([-*+]|\d+[.)]?)$/.test(trimmed))) || (hadBlank && !nested)) {
      boundaries.push(offset);
      hadBlank = false;
    }
    if (!blank) hadContent = true;
    offset += line.length + 1;
  }
  return boundaries;
}

// --- Chunking (Ar :253-260 and its Nr guard :261-371) -----------------------

const LINK_DEFINITION = /^\[?(?:[^[\]\\]|\\.)*\]:[ \t]*(?:\r?$|(?:<(?:[^<>\\\r]|\\.)*>|[^\s<]\S*)(?:[ \t]*\r?$|[ \t]+["'(]))/; // mr
const FOOTNOTE_DEFINITION = /^\[\^(?:[^\s[\]\\]|\\.)+\]:/; // hr
const FENCE = /^(`{3,}|~{3,})(.*)$/; // gr
const INDENTED_FENCE = /^\s+(?:`{3,}|~{3,})/; // _r
const INDENTED_CODE = /^(?: {4}| {0,3}\t)/; // yr
const ATX_HEADING = /^ {0,3}#{1,6}(?:[ \t]|$)/; // br
const QUOTE = /^ {0,3}>/; // xr
const SETEXT_OR_RULE = /^ {0,3}(?:=+|(?:-[ \t]*)+|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})[ \t]*$/; // Sr
const LIST_ITEM = /^ {0,3}(?:[-*+]|\d+[.)])[ \t]+\S/; // Cr
const EMPTY_MARKER = /^ {0,3}(?:[-*+]|\d{1,9}[.)])[ \t]*$/; // wr
const ORDERED_NOT_ONE = /^ {0,3}(?!1[.)])\d{1,9}[.)](?:[ \t]|$)/; // Tr
const HTML_TAG = /^<\/?[a-z][a-z0-9-]*(?:[\s/>]|$)/i; // Er
const MATH_OPEN = /^\${2,}[^$]*$/; // Dr
const CONTAINER_PREFIX = /^[ \t]*(?:>|(?:[-*+]|\d{1,9}[.)])(?=[ \t]|$))/; // V
const HTML_BLOCK = /^<(?:(pre|script|style|textarea)(?=[\s>]|$)|(!--)|(\?)|(!\[CDATA\[)|![a-z])/i; // H
const HTML_RAW_CLOSE = /<\/(?:pre|script|style|textarea)>/i; // Or
const RULE_LINE = /^---[ \t\r]*(?:\n|$)/; // kr

// jr: the line inside its quote / list markers, or null without any.
function stripContainers(line) {
  let rest = line, stripped = false;
  for (let match = CONTAINER_PREFIX.exec(rest); match; match = CONTAINER_PREFIX.exec(rest)) {
    rest = rest.slice(match[0].length);
    stripped = true;
  }
  return stripped ? rest.trimStart() : null;
}
// Mr: an HTML block opener that does not close on its own line.
function opensHtmlBlock(line) {
  const match = HTML_BLOCK.exec(line);
  if (match === null) return false;
  const rest = line.slice(match[0].length);
  if (match[1]) return !HTML_RAW_CLOSE.test(rest);
  return !rest.includes(match[2] ? '-->' : match[3] ? '?>' : match[4] ? ']]>' : '>');
}
// Pr: a fence line as the parser sees it (column-anchored, info string rules)
// and as a trimmed scan sees it; Nr refuses to split when they disagree.
function fenceLine(line, open) {
  const trimmed = line.trim(), loose = FENCE.exec(trimmed), strict = FENCE.exec(line);
  if (open === null) return {
    parser: strict && !(strict[1][0] === '`' && strict[2].includes('`')) ? { char: strict[1][0], length: strict[1].length } : null,
    splitter: loose !== null,
  };
  return {
    parser: strict && strict[1][0] === open.char && strict[1].length >= open.length && BLANK.test(strict[2]) ? open : null,
    splitter: loose !== null && loose[1][0] === open.char && loose[1].length >= open.length && trimmed.length === loose[1].length,
  };
}
// U: the kind of a non-blank, non-indented line.
function lineKind(line, content, pipes) {
  if (EMPTY_MARKER.test(line)) return 'marker';
  if (SETEXT_OR_RULE.test(line)) return 'block';
  if (LIST_ITEM.test(line)) return 'item';
  return pipes || ATX_HEADING.test(line) || QUOTE.test(line) || HTML_BLOCK.test(content) ? 'block' : 'text';
}
// Nr: constructs whose meaning can depend on text in another chunk
// (definitions, ambiguous fences, open HTML or math blocks, lazy lists and
// indented code after a paragraph) keep the body in one piece.
function markdownUnsplittable(text) {
  if (RULE_LINE.test(text)) return true;
  let fence = null, html = false, pipes = false, quote = false, inItem = false, previous = 'blank';
  let afterIndented = false, indentedState = 0, at = 0;
  while (at <= text.length) {
    const newline = text.indexOf('\n', at), end = newline === -1 ? text.length : newline, raw = text.slice(at, end);
    at = end + 1;
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    const inner = stripContainers(line), content = inner ?? line.trimStart();
    if (LINK_DEFINITION.test(content) || FOOTNOTE_DEFINITION.test(content) || INDENTED_FENCE.test(line)) return true;
    const { parser, splitter } = fenceLine(line, fence);
    if ((parser !== null) !== splitter) return true;
    if (fence !== null) {
      if (parser) { fence = null; previous = 'block'; }
      continue;
    }
    if (BLANK.test(line)) {
      html = false; pipes = false; quote = false;
      if (indentedState === 1) indentedState = 2;
      previous = 'blank';
      continue;
    }
    if (parser) {
      if (html) return true;
      fence = parser; indentedState = 0; afterIndented = false;
      inItem &&= previous !== 'blank';
      continue;
    }
    if (MATH_OPEN.test(content) || opensHtmlBlock(content) || (inner !== null && !INDENTED_CODE.test(line) && FENCE.test(inner))) return true;
    html ||= HTML_TAG.test(content);
    pipes ||= line.includes('|');
    if (INDENTED_CODE.test(line)) {
      if (indentedState === 2 || previous === 'marker') return true;
      if (previous === 'block' && !inItem) indentedState = 1;
      previous = 'text';
      afterIndented = !inItem;
      continue;
    }
    const leadingSpace = /^[ \t]/.test(line);
    if (previous === 'marker' ? leadingSpace : previous === 'blank' && afterIndented && ORDERED_NOT_ONE.test(line)) return true;
    indentedState = 0; afterIndented = false;
    const kind = lineKind(line, content, pipes);
    if (kind === 'marker' && (previous !== 'text' || quote)) return true;
    if (kind === 'item') inItem = true;
    else if (previous === 'blank' && !leadingSpace) inItem = false;
    quote ||= QUOTE.test(line);
    previous = kind === 'item' ? 'text' : kind;
  }
  return false;
}
// Ar: chunks of at least `limit` chars, cut only at a block boundary that does
// not start with a `---` line (which could turn the previous chunk's last
// paragraph into a setext heading).
export function markdownChunks(text, limit = MARKDOWN_CHUNK_CHARS) {
  if (text.length <= limit || markdownUnsplittable(text)) return [text];
  const chunks = [];
  let start = 0;
  for (const at of markdownBlockBoundaries(text)) {
    if (at - start < limit || RULE_LINE.test(text.slice(at, at + 8))) continue;
    chunks.push(text.slice(start, at));
    start = at;
  }
  chunks.push(text.slice(start));
  return chunks;
}

// --- Frontmatter (Hr/Ur :406-417 and the YAML subset reader Qr :418-886) ----

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
// Ur: {fields, body} for a leading `---` block, or null. Fields the subset
// reader refuses still split the body off, with no fields shown.
export function splitFrontmatter(text) {
  const match = FRONTMATTER.exec(text);
  if (!match) return null;
  const body = match[2].replace(/^\n+/, '');
  try { return { fields: frontmatterFields(match[1]), body }; } catch { return { fields: [], body }; }
}
// Oi: the field label ("allowed-tools" -> "Allowed tools").
export function frontmatterLabel(key) {
  const text = String(key).replace(/[-_]/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function unsupported() { throw new Error('Unsupported frontmatter'); } // W
const blankOrComment = (line) => /^[ \t]*(?:#.*)?$/.test(line); // Wr
function indentOf(line) { // Gr
  let at = 0;
  while (at < line.length && (line[at] === ' ' || line[at] === '\t')) at += 1;
  return at;
}
const stripComment = (line) => line.replace(/(?:^|[ \t])#.*$/, ''); // G
function plainLine(line) { // Kr
  const value = stripComment(line).trim();
  if (/:(?:[ \t]|$)/.test(value)) unsupported();
  return value;
}
function checkPlainStart(value) { // qr
  if (/^(?:[,[\]{}&*!|>%@`'"]|[-?](?:[ \t]|$))/.test(value)) unsupported();
}
const isNull = (value) => value === '' || value === '~' || /^(?:null|Null|NULL)$/.test(value); // Jr
function plainScalar(line) { // Yr
  const value = plainLine(line);
  checkPlainStart(value);
  return isNull(value) ? '' : value;
}
const KEY_LINE = /^([^\s#'"[\]{}&*!|>%@`,?:-][^#:]*):(.*)$/; // Xr
function keyLine(line) { // Zr
  const match = KEY_LINE.exec(line);
  if (!match || (match[2] !== '' && match[2][0] !== ' ' && match[2][0] !== '\t')) return null;
  return { key: match[1].trimEnd(), rest: match[2] };
}
// Qr: top-level `key: value` pairs, in order, every value flattened to text.
function frontmatterFields(source) {
  const lines = source.replace(/\r?\n$/, '').split(/\r?\n/), fields = [], keys = new Set();
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    index += 1;
    if (blankOrComment(line)) continue;
    const entry = keyLine(line);
    if (!entry || keys.has(entry.key)) unsupported();
    keys.add(entry.key);
    const rest = entry.rest.trim(), nested = blankOrComment(rest), flow = rest[0] === '[' || rest[0] === '{', from = index;
    while (index < lines.length && (/^(?:[ \t]|#|$)/.test(lines[index]) || (nested && /^-(?:[ \t]|$)/.test(lines[index])) || (flow && /^[\]}]/.test(lines[index])))) index += 1;
    const block = lines.slice(from, index);
    fields.push({ key: entry.key, value: nested ? nestedValue(block) : inlineValue(rest, block) });
  }
  return fields;
}
function inlineValue(rest, block) { // $r
  const header = blockHeader(rest);
  if (header) return blockScalar(header, block);
  if (/^["'[{]/.test(rest)) return flowValue([rest, ...block].join('\n'));
  return block.every(blankOrComment) ? plainScalar(rest) : multilinePlain([rest, ...block]);
}
function nestedValue(block) { // ei
  const first = block.findIndex((line) => !blankOrComment(line));
  if (first === -1) return '';
  const content = block.slice(first).filter((line) => !blankOrComment(line)), indent = indentOf(content[0]), lead = content[0].slice(indent);
  if (/^-(?:[ \t]|$)/.test(lead)) return sequenceValue(content, indent) ?? rawBlock(block);
  if (keyLine(lead) || blockHeader(lead)) return rawBlock(block);
  if (/^["'[{]/.test(lead)) return flowValue(block.slice(first).join('\n').trimStart());
  return multilinePlain(block);
}
// ti: a flat `- item` list as "a, b, c", or null for anything nested.
function sequenceValue(lines, indent) {
  if (lines.some((line) => indentOf(line) !== indent)) return null;
  const items = [];
  for (const line of lines) {
    const match = /^-(?:[ \t]+(.*))?$/.exec(line.slice(indent));
    if (!match) return null;
    const value = (match[1] ?? '').trim();
    if (value[0] === '{' || /^-(?:[ \t]|$)/.test(value) || blockHeader(value) || keyLine(value)) return null;
    items.push(flowValue(value));
  }
  return items.join(', ');
}
// ni: a nested mapping or list shown as its dedented source, comments cut.
function rawBlock(block) {
  const out = [];
  let literalIndent = -1, quote = '';
  for (const line of block) {
    const blank = line.trim() === '';
    if (literalIndent >= 0 && (blank || indentOf(line) > literalIndent)) { out.push(line.trimEnd()); continue; }
    literalIndent = -1;
    if (quote === '' && /^[ \t]*#/.test(line)) continue;
    const scan = commentCut(line, quote);
    quote = scan.openQuote;
    const kept = line.slice(0, scan.cut).trimEnd();
    if (quote === '' && /(?:^|[ \t])[|>][-+1-9]*$/.test(kept)) literalIndent = indentOf(line);
    out.push(kept);
  }
  const lines = trimBlankEdges(out);
  const dedent = lines.reduce((least, line) => (line === '' ? least : Math.min(least, indentOf(line))), Infinity);
  return lines.map((line) => line.slice(dedent)).join('\n');
}
function commentCut(line, openQuote) { // ri
  let quote = openQuote, previous = '', at = 0;
  while (at < line.length) {
    const char = line[at], pair = line.slice(at, at + 2);
    if (quote !== '') {
      const escaped = (quote === '"' && char === '\\') || pair === "''";
      quote = !escaped && char === quote ? '' : quote;
      previous = char;
      at += escaped ? 2 : 1;
    } else if ((char === '"' || char === "'") && /^[-:,[{]?$/.test(previous)) {
      quote = char;
      at += 1;
    } else if (startsComment(line, at)) return { cut: at, openQuote: '' };
    else {
      previous = char === ' ' || char === '\t' ? previous : char;
      at += 1;
    }
  }
  return { cut: line.length, openQuote: quote };
}
function trimBlankEdges(lines) { // ii
  let start = 0, end = lines.length;
  while (start < end && lines[start].trim() === '') start += 1;
  while (end > start && lines[end - 1].trim() === '') end -= 1;
  return lines.slice(start, end);
}
// ai: a multi-line plain scalar, lines folded with a space, blank lines kept.
function multilinePlain(lines) {
  let value = '', blanks = 0, commented = false;
  for (const line of lines) {
    const text = plainLine(line), hasComment = stripComment(line).length !== line.length;
    if (text === '') {
      commented ||= value !== '' && hasComment;
      blanks += 1;
      continue;
    }
    if (commented) unsupported();
    if (value === '') { checkPlainStart(text); value = text; }
    else value += (blanks > 0 ? '\n'.repeat(blanks) : ' ') + text;
    blanks = 0;
    commented = hasComment;
  }
  return value;
}
function blockHeader(value) { // oi
  const match = /^([|>])([1-9]?)([+-]?)([1-9]?)(?:[ \t]+#.*|[ \t]*)$/.exec(value);
  if (!match || (match[2] !== '' && match[4] !== '')) return null;
  return { folded: match[1] === '>', chomp: match[3] === '-' ? 'strip' : match[3] === '+' ? 'keep' : 'clip', indent: Number(match[2] || match[4] || 0) };
}
function blockScalar(header, block) { // si
  const firstLine = block.find((line) => line.trim() !== '');
  if (firstLine === undefined) return '';
  const indent = header.indent || indentOf(firstLine), lines = [];
  let at = 0;
  while (at < block.length) {
    const line = block[at];
    if (line.trim() === '') lines.push('');
    else if (indent > 0 && indentOf(line) >= indent) lines.push(line.slice(indent));
    else break;
    at += 1;
  }
  if (!block.slice(at).every(blankOrComment)) unsupported();
  let trailing = 0;
  while (lines.length > 0 && lines[lines.length - 1] === '') { lines.pop(); trailing += 1; }
  if (lines.length === 0) return '';
  const text = header.folded ? foldLines(lines) : lines.join('\n');
  if (header.chomp === 'strip') return text;
  return header.chomp === 'keep' ? `${text}\n${'\n'.repeat(trailing)}` : `${text}\n`;
}
function foldLines(lines) { // ci
  let text = '', blanks = 0, previousMore = false;
  for (const line of lines) {
    if (line === '') { blanks += 1; continue; }
    const more = line[0] === ' ' || line[0] === '\t';
    const joiner = text === '' ? '' : more || previousMore ? '\n' : blanks ? '' : ' ';
    text += '\n'.repeat(blanks) + joiner + line;
    blanks = 0;
    previousMore = more;
  }
  return text;
}
const startsComment = (text, at) => text[at] === '#' && (at === 0 || /[ \t\n]/.test(text[at - 1])); // li
function flowValue(source) { // ui
  const parsed = flowNode(source, 0);
  if (!parsed) return plainScalar(source);
  if (!source.slice(parsed.end).split('\n').every(blankOrComment)) unsupported();
  return parsed.value;
}
function flowNode(source, at) { // di
  switch (source[at]) {
    case '"': return doubleQuoted(source, at);
    case "'": return singleQuoted(source, at);
    case '[': return flowSequence(source, at);
    case '{': return flowMapping(source, at);
    default: return null;
  }
}
function flowSequence(source, start) { // fi
  const items = [];
  let at = start + 1;
  for (;;) {
    at = skipSpace(source, at);
    if (at >= source.length) unsupported();
    if (source[at] === ']') return { value: items.join(', '), end: at + 1 };
    const item = flowNode(source, at) ?? flowPlain(source, at);
    items.push(item.value);
    at = skipSpace(source, item.end);
    if (source[at] === ',') at += 1;
    else if (source[at] !== ']') unsupported();
  }
}
function flowPlain(source, start) { // pi
  let text = '', at = start;
  while (at < source.length && source[at] !== ',' && source[at] !== ']') {
    if (startsComment(source, at)) at = lineEnd(source, at);
    else { text += source[at]; at += 1; }
  }
  const value = foldFlow(text).trim();
  return { value: isNull(value) ? '' : value, end: at };
}
function foldFlow(text) { // mi
  const lines = text.split('\n'), last = lines.length - 1;
  if (last === 0) return text;
  const parts = [lines[0].trimEnd()];
  for (let index = 1; index < last; index += 1) {
    const line = lines[index].trim();
    if (line !== '') parts.push(line);
  }
  parts.push(lines[last].trimStart());
  return parts.join(' ');
}
// hi: a flow mapping is shown as its own (folded) source text.
function flowMapping(source, start) {
  let value = '{', space = '', previous = '{', depth = 1, at = start + 1;
  while (at < source.length) {
    const char = source[at];
    if ((char === '"' || char === "'") && ':,[{'.includes(previous)) {
      const { end } = (char === '"' ? doubleQuoted : singleQuoted)(source, at);
      value += space + foldFlow(source.slice(at, end));
      space = ''; previous = char; at = end;
    } else if (startsComment(source, at)) at = lineEnd(source, at);
    else if (char === '\n') { space = ' '; at = skipSpace(source, at); }
    else if (char === ' ' || char === '\t') { space += char; at += 1; }
    else {
      value += space + char;
      space = ''; previous = char;
      depth += char === '{' ? 1 : char === '}' ? -1 : 0;
      at += 1;
      if (depth === 0) return { value, end: at };
    }
  }
  return unsupported();
}
function skipSpace(source, start) { // gi
  let at = start;
  while (at < source.length) {
    if (source[at] === ' ' || source[at] === '\t' || source[at] === '\n') at += 1;
    else if (startsComment(source, at)) at = lineEnd(source, at);
    else break;
  }
  return at;
}
function lineEnd(source, at) { // _i
  const end = source.indexOf('\n', at);
  return end === -1 ? source.length : end;
}
function foldBreak(source, start) { // K
  let breaks = 0, at = start;
  while (at < source.length && /[ \t\n]/.test(source[at])) { breaks += +(source[at] === '\n'); at += 1; }
  return { value: breaks === 1 ? ' ' : '\n'.repeat(breaks - 1), end: at };
}
function singleQuoted(source, start) { // vi
  let value = '', space = '', at = start + 1;
  while (at < source.length) {
    const char = source[at];
    if (char === '\n') { const fold = foldBreak(source, at); value += fold.value; space = ''; at = fold.end; }
    else if (char === ' ' || char === '\t') { space += char; at += 1; }
    else if (char !== "'" || source[at + 1] === "'") { value += space + char; space = ''; at += char === "'" ? 2 : 1; }
    else return { value: value + space, end: at + 1 };
  }
  return unsupported();
}
const ESCAPES = { 0: '\0', a: '\x07', b: '\b', t: '\t', '\t': '\t', n: '\n', v: '\v', f: '\f', r: '\r', e: '\x1B', ' ': ' ', '"': '"', '/': '/', '\\': '\\', N: '\u0085', _: ' ', L: ' ', P: ' ' }; // yi
const HEX_ESCAPES = { x: 2, u: 4, U: 8 }; // bi
function doubleQuoted(source, start) { // xi
  let value = '', space = '', at = start + 1;
  while (at < source.length) {
    const char = source[at];
    if (char === '"') return { value: value + space, end: at + 1 };
    if (char === '\n') { const fold = foldBreak(source, at); value += fold.value; space = ''; at = fold.end; continue; }
    if (char === ' ' || char === '\t') { space += char; at += 1; continue; }
    value += space;
    space = '';
    if (char !== '\\') { value += char; at += 1; continue; }
    const next = source[at + 1] ?? '';
    if (next === '\n') {
      at += 2;
      while (source[at] === ' ' || source[at] === '\t') at += 1;
    } else if (Object.hasOwn(ESCAPES, next)) { value += ESCAPES[next]; at += 2; }
    else if (Object.hasOwn(HEX_ESCAPES, next)) {
      const digits = HEX_ESCAPES[next], hex = source.slice(at + 2, at + 2 + digits);
      if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length !== digits) unsupported();
      value += String.fromCodePoint(parseInt(hex, 16));
      at += 2 + digits;
    } else unsupported();
  }
  return unsupported();
}

// --- The plan (Ti :898-907) --------------------------------------------------

// Ti, with its one-entry cache (wi) so the deferral hook and the renderer
// share one computation: the frontmatter, the body, whether the source is
// shown as plain text, and the chunks (one chunk at or below Si).
let cachedPlan = null;
export function markdownFilePlan(text) {
  const source = String(text ?? '');
  if (cachedPlan?.source === source) return cachedPlan.plan;
  const frontmatter = splitFrontmatter(source), body = frontmatter?.body ?? source;
  const chunks = source.length > MARKDOWN_PROGRESSIVE_CHARS ? markdownChunks(body) : [body];
  const plain = chunks.some(markdownTooSlow);
  const plan = { frontmatter, body, plain, chunks: plain ? [body] : chunks };
  cachedPlan = { source, plan };
  return plan;
}
// Ei's unmount cleanup: drop the cache when it still holds this source.
export function releaseMarkdownFilePlan(text) {
  if (cachedPlan?.source === text) cachedPlan = null;
}
