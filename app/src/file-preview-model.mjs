import { HIGHLIGHT_LIMITS, isPlainLanguage, normalizeLanguage } from './highlight-model.mjs';
import { FILE_EXTENSION_LANGUAGES, LOCKFILE_LANGUAGES } from './highlight-languages.mjs';
import { t, tn } from '../electron/i18n/index.mjs';

// Highlight tokens describe complete fragments; split without dropping empty
// lines, CRs, or a token that spans multiple lines. No HTML is interpreted.
export function tokenLines(tokens, text) {
  if (!tokens || tokens.map(token => token.text).join('') !== text) return text.split('\n').map(line => [{ text: line }]);
  const lines = [[]];
  for (const token of tokens) {
    const parts = token.text.split('\n');
    parts.forEach((part, index) => {
      if (index) lines.push([]);
      if (part) lines.at(-1).push({ ...token, text: part });
    });
  }
  return lines;
}

// Do not join missing hunk context into a fictional document: each hunk has
// its own lexical context and each displayed row refers to one actual side.
export function previewHunks(rows) {
  const hunks = [];
  let current;
  for (const row of rows) {
    if (!current || row.type === 'separator') {
      current = { header: row.type === 'separator' ? row.text : null, rows: [], before: [], after: [] };
      hunks.push(current);
      if (row.type === 'separator') continue;
    }
    const side = row.type === 'removed' ? 'before' : row.type === 'added' || row.type === 'context' ? 'after' : null;
    const line = side ? current[side].length : null;
    current.rows.push({ ...row, side, line });
    if (row.type === 'removed' || row.type === 'context') current.before.push(row.text);
    if (row.type === 'added' || row.type === 'context') current.after.push(row.text);
  }
  return hunks.map(hunk => ({ ...hunk, before: hunk.before.join('\n'), after: hunk.after.join('\n') }));
}

// The original resolver r() (c41eb0199-C-RzbqEe.js; no custom extensions are
// registered locally): the exact name (Dockerfile, CMakeLists.txt,
// CODEOWNERS), then the compound `.a.b` suffix (component.ts -> angular-ts,
// blade.php), then the last extension, else 'text'. Keys are case-sensitive.
function nameLanguage(name) {
  if (Object.hasOwn(FILE_EXTENSION_LANGUAGES, name)) return FILE_EXTENSION_LANGUAGES[name];
  const compound = /\.([^/\\]+\.[^/\\]+)$/.exec(name)?.[1];
  if (compound !== undefined && Object.hasOwn(FILE_EXTENSION_LANGUAGES, compound)) return FILE_EXTENSION_LANGUAGES[compound];
  const last = /\.([^.]+)$/.exec(name)?.[1] ?? '';
  return Object.hasOwn(FILE_EXTENSION_LANGUAGES, last) ? FILE_EXTENSION_LANGUAGES[last] : 'text';
}
// g() (code-language-current.js:78-85) around r(): the base name (wh,
// shared-11), a lockfile name (c8a544a8c, lowercased) first, then r(); a
// 'text' result retries the lowercased name, so 'X.PY' and 'name.TS' still
// resolve. Every value is a bundled id or alias, which consumers pass through
// normalizeLanguage (source-file-viewer.jsx, use-diff-hunk.mjs,
// source-file-tool.jsx).
export function fileHighlightLanguage(path = '') {
  const value = String(path);
  const name = value.split(/[\\/]/).pop() || value;
  const lockfile = name.toLowerCase();
  if (Object.hasOwn(LOCKFILE_LANGUAGES, lockfile)) return LOCKFILE_LANGUAGES[lockfile];
  const language = nameLanguage(name);
  if (language !== 'text') return language;
  return lockfile === name ? language : nameLanguage(lockfile);
}

// Files viewer preview kinds (cd2efac6e jo :2626-2627 zt/Bt and qo :4777-4792;
// the sandbox arm needs a rich-text MIME reader, which is not ported):
// markdown for .md/.mdx/.markdown, csv with the delimiter of .tsv or .csv.
export function filePreviewKind(path = '') {
  const value = String(path);
  if (/\.tsv$/i.test(value)) return { kind: 'csv', delimiter: '\t' };
  if (/\.csv$/i.test(value)) return { kind: 'csv', delimiter: ',' };
  if (/\.(md|mdx|markdown)$/i.test(value)) return { kind: 'markdown', delimiter: null };
  return null;
}
// nr/ir (cd2efac6e :2672-2673): je = shared-4 Jh (the last extension,
// lowercased, among png jpg jpeg gif bmp webp avif; no svg) shows an <img>;
// ye = shared-11 gh, video (mp4 webm mov m4v ogv) or audio (mp3 m4a aac wav
// flac opus ogg oga), shows a <video> or, for audio (we), an <audio>.
// electron/files.cjs classifies the same lists without reading the bytes.
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'avif']);
export function fileMediaKind(path = '') {
  const value = String(path), at = value.lastIndexOf('.');
  if (IMAGE_EXTENSIONS.has(at < 0 ? '' : value.slice(at + 1).toLowerCase())) return 'image';
  if (/\.(mp4|webm|mov|m4v|ogv)$/i.test(value)) return 'video';
  if (/\.(mp3|m4a|aac|wav|flac|opus|ogg|oga)$/i.test(value)) return 'audio';
  return null;
}
// The composer's file:// preview URL (main.jsx filePreviewUrl), the same
// encoding for the Files viewer's <img>/<video>/<audio>.
export const filePreviewUrl = (filePath) => encodeURI(`file://${filePath}`);

// EpitaxyCsvPreview's parse (c02d6193d-EqKLGBaH.js p): at most 1 MiB of text
// (cut after the last complete record), the delimiter sniffed from the first
// 16 non-blank lines (o), at most 500 rows of 64 columns and 300-unit cells,
// a header when the first row reads as labels over a data row (s). Locally
// the csv-parse call (bom, relax_column_count, relax_quotes,
// skip_empty_lines, to: 501) is a small RFC 4180 reader with the same options.
const CSV_MAX_ROWS = 500, CSV_MAX_COLUMNS = 64, CSV_MAX_CELL = 300, CSV_MAX_BYTES = 1 << 20;
function sniffDelimiter(text, fallback) {
  if (fallback === '\t') return fallback;
  const line = text.split(/\r?\n/).slice(0, 16).find((value) => value.trim() !== '');
  if (!line) return fallback;
  const bare = line.replace(/"(?:[^"]|"")*"/g, '');
  const count = (value) => bare.split(value).length - 1, base = count(fallback);
  return count('\t') > base ? '\t' : count(';') > base ? ';' : fallback;
}
function looksLikeHeader(rows) {
  if (rows.length < 2) return false;
  const [first, second] = rows;
  const numeric = (value) => value.trim() !== '' && !Number.isNaN(Number(value));
  const label = (value) => value.trim() !== '' && !numeric(value);
  const labels = first.filter(label).length;
  if (labels === 0 || labels / first.length < 0.5) return false;
  return first.some((value, index) => label(value) && numeric(second[index] ?? ''));
}
// d: the end of the last complete record before `limit` (quote-aware), or -1.
function lastRecordEnd(text, limit, delimiter) {
  const separator = delimiter.charCodeAt(0), end = Math.min(limit, text.length);
  let quoted = false, fieldStart = true, at = -1;
  for (let index = text.charCodeAt(0) === 0xfeff ? 1 : 0; index < end; index++) {
    const code = text.charCodeAt(index);
    if (quoted) {
      if (code !== 34) continue;
      if (text.charCodeAt(index + 1) === 34) index++;
      else { quoted = false; fieldStart = false; }
    } else if (code === 34 && fieldStart) quoted = true;
    else if (code === 10) { at = index + 1; fieldStart = true; }
    else fieldStart = code === separator;
  }
  return at;
}
// The csv-parse records, or 'ends_in_quoted_field' for an unclosed quote.
// relax_quotes (c63ad9d34, the CSV_INVALID_CLOSING_QUOTE branch): a closing
// quote followed by anything but a delimiter or EOL leaves quoting with the
// quote prepended and itself kept, so `"a"b` reads as the field `"a"b`; a
// quote inside an unquoted field is a plain character. With relax_quotes and
// relax_column_count nothing else rejects, so f()'s 'rejected' never occurs.
function readCsv(text, delimiter, limit) {
  const records = [];
  let record = [], field = '', quoted = false, started = false, closed = false;
  const endField = () => { record.push(field); field = ''; started = false; closed = false; };
  // skip_empty_lines drops a line with no field, unless its one field was
  // quoted (wasQuoting): `""` is a record with one empty cell.
  const endRecord = () => {
    const empty = record.length === 0 && field === '' && !closed;
    endField();
    if (!empty) records.push(record);
    record = [];
  };
  for (let index = text.charCodeAt(0) === 0xfeff ? 1 : 0; index < text.length && records.length < limit; index++) {
    const char = text[index];
    if (quoted) {
      if (char !== '"') field += char;
      else if (text[index + 1] === '"') { field += '"'; index++; }
      else { quoted = false; closed = true; }
      continue;
    }
    if (char === delimiter) endField();
    else if (char === '\n' || char === '\r') { if (char === '\r' && text[index + 1] === '\n') index++; endRecord(); }
    else if (closed) { field = `"${field}"${char}`; closed = false; }
    else if (char === '"' && !started) { quoted = true; started = true; }
    else { field += char; started = true; }
  }
  if (quoted) return 'ends_in_quoted_field';
  if (records.length < limit && (started || closed || record.length)) endRecord();
  return records;
}
export function parseCsvPreview(contents, delimiter) {
  const text = String(contents ?? ''), cut = text.length > CSV_MAX_BYTES;
  const separator = sniffDelimiter(cut ? text.slice(0, CSV_MAX_BYTES) : text, delimiter);
  let body = text;
  if (cut) { const end = lastRecordEnd(text, CSV_MAX_BYTES, separator); body = text.slice(0, end > 0 ? end : CSV_MAX_BYTES); }
  let records = readCsv(body, separator, CSV_MAX_ROWS + 1), trimmed = false;
  if (records === 'ends_in_quoted_field') {
    const end = lastRecordEnd(body, body.length, separator);
    if (end > 0 && end < body.length) { records = readCsv(body.slice(0, end), separator, CSV_MAX_ROWS + 1); trimmed = true; }
  }
  if (typeof records === 'string') return { kind: 'error' };
  if (records.length === 0) return trimmed ? { kind: 'error' } : { kind: 'empty' };
  const rowsTruncated = cut || trimmed || records.length > CSV_MAX_ROWS, kept = records.slice(0, CSV_MAX_ROWS);
  const hasHeader = looksLikeHeader(kept);
  let width = 0, colsTruncated = false, cellsTruncated = false;
  for (const row of kept) { if (row.length > CSV_MAX_COLUMNS) colsTruncated = true; width = Math.max(width, Math.min(row.length, CSV_MAX_COLUMNS)); }
  const cell = (value) => { const string = String(value); if (string.length <= CSV_MAX_CELL) return string; cellsTruncated = true; return `${string.slice(0, CSV_MAX_CELL)}…`; };
  const rows = kept.map((row) => Array.from({ length: width }, (_, index) => cell(row[index] ?? '')));
  return { kind: 'ok', parsed: { rows, hasHeader, rowsTruncated, colsTruncated, cellsTruncated } };
}
// cd5fd9055 l: the truncation caption above the table (ICU plural/number
// messages rendered for en-US).
export function csvTruncationCaption({ rowCount, columnCount, rowsTruncated, colsTruncated, cellsTruncated }) {
  const cells = cellsTruncated ? t(' Long cells are shortened.') : '';
  const rowsText = tn(rowCount, '{count} row', '{count} rows');
  if (rowsTruncated && colsTruncated) return t('Showing the first {rows} and {columns} columns.{cells} Switch to Source to see more.', { rows: rowsText, columns: columnCount.toLocaleString('en-US'), cells });
  if (rowsTruncated) return t('Showing the first {rows}.{cells} Switch to Source to see more.', { rows: rowsText, cells });
  if (colsTruncated) return tn(columnCount, 'Showing the first {count} column.{cells} Switch to Source to see more.', 'Showing the first {count} columns.{cells} Switch to Source to see more.', { cells });
  return t('Long cells are shortened. Switch to Source to see more.');
}

// Files pane viewer (source-file-viewer.jsx). The rows of a file: a terminal LF
// ends the last line and adds no numbered row, as in the Read rows.
export function fileViewerLines(tokens, text) {
  const lines = tokenLines(tokens, text);
  if (text.endsWith('\n') && lines.length > 1) lines.pop();
  return lines;
}

// "Shown as plain text: formatting this file would be too slow." (cd2efac6e
// :990-1012 ji). The original falls back above its own size limits (Ci
// :888-897); locally the limits are the highlighter's own (HIGHLIGHT_LIMITS:
// code units, line count, longest line), so the notice appears exactly when a
// highlightable file would otherwise be formatted and is not.
export function fileViewerTooSlow(text, language) {
  if (typeof text !== 'string' || !text) return false;
  const normalized = normalizeLanguage(language);
  if (!normalized || isPlainLanguage(normalized)) return false;
  if (text.length > HIGHLIGHT_LIMITS.maxCodeUnits) return true;
  const lines = text.split(/\r\n|\n|\r/);
  return lines.length > HIGHLIGHT_LIMITS.maxLines || lines.some((line) => line.length > HIGHLIGHT_LIMITS.maxLineUnits);
}

// ja (cd2efac6e :1690-1711) without a lister: the leading slash(es), the
// directory segments and the file name of the displayed path.
export function breadcrumbParts(displayPath = '') {
  const value = String(displayPath);
  const at = value.lastIndexOf('/', value.endsWith('/') ? value.length - 2 : value.length - 1);
  const directory = at < 0 ? '' : value.slice(0, at + 1), name = at < 0 ? value : value.slice(at + 1);
  return { lead: /^\/+/.exec(directory)?.[0] ?? '', dirs: directory.split('/').filter(Boolean), name };
}

// ua (cd2efac6e :1519-1528): the active range covers line..endLine, at most
// 200 rows (la); a single line when endLine is missing or not after line.
export const JUMP_RANGE_MAX = 200;
export function jumpRange(line, endLine) {
  if (!Number.isInteger(line) || line < 1) return null;
  const last = Number.isInteger(endLine) && endLine > line ? Math.min(endLine, line + JUMP_RANGE_MAX - 1) : line;
  return { first: line, last };
}
