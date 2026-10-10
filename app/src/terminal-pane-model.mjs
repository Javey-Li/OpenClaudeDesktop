// Terminal pane: pure renderer helpers (labels, the xterm theme from the code theme, links in terminal output, keys,
// auto-close). Independent implementation of the behavior traced from the 2.2553.1 terminal pane (c6bf19e8f ShellTerminal,
// cccc2cf0a pane + tab strip, cf718f694 code theme → xterm theme, c5d464fa3 palettes, shared-21 aR toggleTerminal).
import { t } from "../electron/i18n/index.mjs";

export const TERMINAL_PANE = "terminal";
export const SCROLLBACK_LINES = 10000;
export const MINIMUM_CONTRAST_RATIO = 3;
export const MAX_CACHED_TERMINALS = 16;
// Auto-close (official): a shell that exits with 0, or within 2s of the user pressing Enter (typed `exit`), closes its tab.
export const EXIT_AFTER_ENTER_MS = 2000;

// ---------------------------------------------------------------------------
// Labels.

/** The tab's name: its own title, else "Terminal {n}" while several tabs are open, else "Terminal". */
export function tabLabel(info, count) {
  if (info?.title) return info.title;
  return count > 1 ? t("Terminal {n}", { n: info?.number ?? 1 }) : t("Terminal");
}
export function shouldAutoClose(info, lastEnterAt = 0, now = Date.now()) {
  if (!info || info.status !== "exited") return false;
  if (info.exitCode === 0 && !info.signal) return true;
  return lastEnterAt > 0 && now - lastEnterAt <= EXIT_AFTER_ENTER_MS;
}

// ---------------------------------------------------------------------------
// Keys.

/** toggleTerminal: ⌃` everywhere, ⌘J on the Mac (shared-21 aR). Matched by code; never during IME composition. */
export function isTerminalToggle(event) {
  if (!event || event.isComposing) return false;
  if (event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.code === "Backquote") return true;
  return !!event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey && event.code === "KeyJ";
}
/**
 * What a key press inside the terminal does before xterm sees it:
 *   "toggle"     let the app toggle the pane (xterm skips it, the window handler runs)
 *   "clear"      ⌘K clears the screen and scrollback        "find"   ⌘F opens the terminal's find bar
 *   "select-all" ⌘A selects all output                       "find-next" / "find-previous"  ⌘G / ⇧⌘G
 *   "line-start" / "line-end"   ⌘← / ⌘→ (Ctrl-A / Ctrl-E)    "word-left" / "word-right"     ⌥← / ⌥→
 *   null         xterm handles it (or the app, for other ⌘ chords: xterm leaves those alone)
 */
export function terminalKeyAction(event) {
  if (!event || event.type !== "keydown" || event.isComposing) return null;
  if (isTerminalToggle(event)) return "toggle";
  const meta = !!event.metaKey, ctrl = !!event.ctrlKey, alt = !!event.altKey, shift = !!event.shiftKey;
  if (meta && !ctrl && !alt) {
    if (!shift && event.code === "KeyK") return "clear";
    if (!shift && event.code === "KeyF") return "find";
    if (!shift && event.code === "KeyA") return "select-all";
    if (event.code === "KeyG") return shift ? "find-previous" : "find-next";
    // ⇧⌘L attachTerminalOutput (2.2553.1 cccc2cf0a Dm): the selection goes to this session's composer.
    if (shift && event.code === "KeyL") return "attach-selection";
    if (!shift && event.key === "ArrowLeft") return "line-start";
    if (!shift && event.key === "ArrowRight") return "line-end";
  }
  if (alt && !meta && !ctrl && !shift) {
    if (event.key === "ArrowLeft") return "word-left";
    if (event.key === "ArrowRight") return "word-right";
  }
  return null;
}
export const KEY_SEQUENCES = Object.freeze({ "line-start": "\u0001", "line-end": "\u0005", "word-left": "\u001bb", "word-right": "\u001bf" });

// ---------------------------------------------------------------------------
// Theme (cf718f694): the code theme's VS Code terminal colours, editor colours when it has none, and the Claude
// palettes for the two Claude themes. Scrollbar thumbs follow the app's alpha tokens through CSS.

export const CLAUDE_DARK = Object.freeze({
  background: "#1a1a19", foreground: "#f0efec", cursor: "#0099ff", cursorAccent: "#1a1a19", selectionBackground: "#0099ff4d",
  black: "#262626", red: "#ff3a30", green: "#32d74b", yellow: "#ffd014", blue: "#0099ff", magenta: "#ff2c56", cyan: "#b796ff", white: "#a6a6a6",
  brightBlack: "#525252", brightRed: "#ff5047", brightGreen: "#32d74b", brightYellow: "#ffd014", brightBlue: "#0087ee", brightMagenta: "#ff2c56", brightCyan: "#b796ff", brightWhite: "#ededed",
});
export const CLAUDE_LIGHT = Object.freeze({
  background: "#ffffff", foreground: "#1a1a1a", cursor: "#0073e6", cursorAccent: "#ffffff", selectionBackground: "#0073e640",
  black: "#1a1a1a", red: "#d70015", green: "#1e9e3c", yellow: "#98801f", blue: "#0073e6", magenta: "#cd2054", cyan: "#8e6bd9", white: "#999999",
  brightBlack: "#666666", brightRed: "#d70015", brightGreen: "#1e9e3c", brightYellow: "#98801f", brightBlue: "#0078f0", brightMagenta: "#cd2054", brightCyan: "#8e6bd9", brightWhite: "#d6d6d6",
});
const ANSI = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"];
const capital = (name) => name[0].toUpperCase() + name.slice(1);
const color = (value) => (typeof value === "string" && /^#[0-9a-f]{3,8}$/i.test(value.trim()) ? value.trim() : null);
/** A css colour that is not transparent, else null. */
export function opaqueColor(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const text = value.trim();
  if (text === "transparent" || /rgba?\([^)]*,\s*0(?:\.0+)?\s*\)$/.test(text) || /\/\s*0(?:\.0+)?\s*\)$/.test(text)) return null;
  return text;
}
/**
 * xterm ITheme for a code theme id in `mode`. `colors` is the VS Code colour map of a third-party theme (null for the
 * Claude themes or before it loaded); `surface` the pane's own background, which the Claude themes paint with.
 */
export function terminalTheme({ themeId = null, mode = "light", colors = null, surface = null } = {}) {
  const base = mode === "dark" ? CLAUDE_DARK : CLAUDE_LIGHT;
  const claude = !themeId || themeId === "claude-light" || themeId === "claude-dark";
  if (claude || !colors) {
    const background = opaqueColor(surface) ?? base.background;
    return { ...base, background, cursorAccent: background };
  }
  const pick = (...keys) => keys.map((key) => color(colors[key])).find(Boolean) ?? null;
  const background = pick("terminal.background", "editor.background") ?? base.background;
  const theme = {
    background,
    foreground: pick("terminal.foreground", "editor.foreground") ?? base.foreground,
    cursor: pick("terminalCursor.foreground", "editorCursor.foreground") ?? base.cursor,
    cursorAccent: pick("terminalCursor.background") ?? background,
    selectionBackground: pick("terminal.selectionBackground", "editor.selectionBackground") ?? base.selectionBackground,
  };
  for (const name of ANSI) {
    theme[name] = pick(`terminal.ansi${capital(name)}`) ?? base[name];
    theme[`bright${capital(name)}`] = pick(`terminal.ansiBright${capital(name)}`) ?? base[`bright${capital(name)}`];
  }
  return theme;
}
/** Terminal font: the app's code font chain (--cds-font-code), else the official default. */
export function terminalFont(codeFont) {
  const fallback = '"anthropic-mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace';
  return typeof codeFont === "string" && codeFont.trim() ? `${codeFont.trim()}, ui-monospace, Menlo, Consolas, monospace` : fallback;
}
/** 12px at the default 16px root size, scaled with the app's font size. */
export function terminalFontSize(rootFontPx) {
  const root = Number(rootFontPx);
  return Math.max(9, Math.min(24, Math.round((12 * (Number.isFinite(root) && root > 0 ? root : 16)) / 16)));
}

// ---------------------------------------------------------------------------
// Links in output. Web: http(s) URLs only (the official pattern), opened through the app's external opener after a
// check; credentials or backslashes are refused. Files: path-looking tokens, opened in the Files pane once the main
// process confirms they are files inside the session folder.

const URL_PATTERN = /(?:https?|HTTPS?):\/\/[^\s"'!*(){}|\\^<>`]*[^\s"':,.!?{}|\\^~[\]`()<>]/g;
/** A safe http(s) URL to open externally, or null. */
export function safeWebUrl(text) {
  if (typeof text !== "string" || text.length > 4096 || text.includes("\\")) return null;
  let url;
  try { url = new URL(text); } catch { return null; }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password || !url.hostname) return null;
  return url.href;
}
// A file path token: absolute, ./ ../ ~/ relative, or dir/name, or name.ext; optional :line[:col] or (line,col).
const PATH_PATTERN = /(?<![\w./~-])((?:~|\.{1,2})?\/?(?:[\w@+.-]+\/)*[\w@+-][\w@+.-]*\.[A-Za-z][\w]{0,11}|(?:~|\.{1,2})?\/(?:[\w@+.-]+\/)*[\w@+.-]+|(?:[\w@+.-]+\/)+[\w@+.-]+)(?::(\d{1,7})(?::(\d{1,5}))?|\((\d{1,7}),(\d{1,5})\))?/g;
/** Links on one line of terminal text: [{ kind: "web"|"file", start, end, text, url? , path?, line?, column? }]. */
export function findLinks(text) {
  if (typeof text !== "string" || !text) return [];
  const links = [];
  const taken = [];
  for (const match of text.matchAll(URL_PATTERN)) {
    const url = safeWebUrl(match[0]);
    if (!url) continue;
    links.push({ kind: "web", start: match.index, end: match.index + match[0].length, text: match[0], url });
    taken.push([match.index, match.index + match[0].length]);
  }
  for (const match of text.matchAll(PATH_PATTERN)) {
    const start = match.index, end = start + match[0].length;
    if (taken.some(([a, b]) => start < b && end > a)) continue;
    const path = match[1];
    if (path.length < 3 || /^\d+(?:\.\d+)+$/.test(path) || /^\.+\/?$/.test(path) || path.includes("//")) continue;
    const line = Number(match[2] ?? match[4]) || null, column = Number(match[3] ?? match[5]) || null;
    links.push({ kind: "file", start, end, text: match[0], path, line, column });
  }
  return links.sort((a, b) => a.start - b.start);
}
/** A clicked file path relative to the session folder (what the Files pane opens), or null outside it. */
export function relativeToFolder(path, folder, home = null) {
  if (typeof path !== "string" || !path || typeof folder !== "string" || !folder.startsWith("/")) return null;
  let absolute = path;
  if (path.startsWith("~/")) { if (!home) return null; absolute = `${home.replace(/\/$/, "")}/${path.slice(2)}`; }
  else if (!path.startsWith("/")) absolute = `${folder.replace(/\/$/, "")}/${path}`;
  const parts = [];
  for (const part of absolute.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") { if (!parts.length) return null; parts.pop(); } else parts.push(part);
  }
  const normal = `/${parts.join("/")}`, root = folder.replace(/\/+$/, "") || "/";
  if (normal === root) return null;
  if (!normal.startsWith(root === "/" ? "/" : `${root}/`)) return null;
  return normal.slice(root === "/" ? 1 : root.length + 1);
}

// ---------------------------------------------------------------------------
// Output replay: data events carry the running character count (`end`); one already covered by an attach is skipped,
// one straddling it is trimmed.

export function unseenData(event, written) {
  if (!event || typeof event.data !== "string" || !Number.isFinite(event.end)) return "";
  if (!Number.isFinite(written) || written < 0) return event.data;
  if (event.end <= written) return "";
  const start = event.end - event.data.length;
  return start >= written ? event.data : event.data.slice(written - start);
}

/** A failure's message without Electron's IPC wrapper, translated when it is one of the service's own messages. */
export function terminalError(error, fallback) {
  const message = String(error?.message ?? error ?? "").replace(/^Error invoking remote method '[^']+': (?:Error: )?/, "").trim();
  return message ? t(message) : fallback;
}
