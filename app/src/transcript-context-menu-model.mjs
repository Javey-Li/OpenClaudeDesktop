// Transcript right-click menus. Pure: the caller resolves the DOM target.
//
// messageMenu: scroll-messages-current.js:33652-33818 CY. Items in order —
// Copy (the selection, cmd+c); Copy code block / Copy path / Copy code over
// code that is not inside a link; Open in default browser (http/https only)
// and Copy link over a link; a separator when anything came before the
// message items; Copy message and Copy message as Markdown; a separator
// before Attach selection as context (cmd+shift+l, a selection of at least 2
// characters) or Attach message as context. No Fork or Rewind: the DeepSeek
// core lists thread/fork and thread/revert as unsupported. No image items:
// response images keep their own menu (source-response-image.jsx).
//
// fileRefMenu: c856385e2-k3utJqnh.js Mn/Z for a transcript file reference —
// Attach as context (with a composer), Copy ▸ Absolute path / Relative path /
// Filename, a separator, Open in ▸ Files pane, Show in Finder.

const separator = Object.freeze({ type: "separator" });
const item = (id, label, extra = {}) => ({ type: "item", id, label, ...extra });

// scroll-messages-current.js:33094-33115 qJ/JJ/YJ: a link counts only for
// these protocols, and only http/https can open in the browser.
const LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:", "irc:", "ircs:", "xmpp:", "computer:"]);
export function linkTarget(href) {
  if (!href) return { linkHref: null, canOpenInBrowser: false };
  try {
    const protocol = new URL(href).protocol;
    return { linkHref: LINK_PROTOCOLS.has(protocol) ? href : null, canOpenInBrowser: protocol === "http:" || protocol === "https:" };
  } catch {
    return { linkHref: null, canOpenInBrowser: false };
  }
}

/** True when the selection is long enough to attach (CY w / S: trimmed ≥ 2). */
export const attachableSelection = (text) => typeof text === "string" && text.trim().length >= 2;

export function messageMenu({ selectionText = null, codeTarget = null, linkHref = null, canOpenInBrowser = false, messageText, canAttach = false } = {}) {
  const selection = typeof selectionText === "string" && selectionText.trim() !== "" ? selectionText : null;
  const link = linkHref || null;
  const code = link ? null : codeTarget?.text ? codeTarget : null;
  const hasText = typeof messageText === "string";
  const attach = canAttach && hasText;
  const entries = [];
  if (selection !== null) entries.push(item("copy-selection", "Copy", { shortcut: "cmd+c" }));
  if (code) entries.push(item("copy-code", code.isBlock ? "Copy code block" : code.isPath ? "Copy path" : "Copy code"));
  if (link) {
    if (canOpenInBrowser) entries.push(item("open-link", "Open in default browser"));
    entries.push(item("copy-link", "Copy link"));
  }
  const before = entries.length > 0;
  if (before && hasText) entries.push(separator);
  if (hasText) entries.push(item("copy-message", "Copy message"), item("copy-markdown", "Copy message as Markdown"));
  if ((before || hasText) && attach) entries.push(separator);
  if (attach) entries.push(attachableSelection(selection)
    ? item("attach", "Attach selection as context", { shortcut: "cmd+shift+l" })
    : item("attach", "Attach message as context"));
  return entries;
}

export function fileRefMenu({ absolute = null, relative = null, filename, canAttach = false, canOpen = true, canReveal = false } = {}) {
  const entries = [];
  if (canAttach && absolute) entries.push(item("attach-file", "Attach as context"));
  entries.push(item("copy", "Copy", { submenu: [
    ...(absolute ? [item("copy-absolute", "Absolute path")] : []),
    ...(relative ? [item("copy-relative", "Relative path")] : []),
    item("copy-filename", "Filename"),
  ] }));
  if (canOpen) entries.push(separator, item("open-in", "Open in", { submenu: [item("open-files-pane", "Files pane")] }));
  if (canReveal && absolute) {
    if (!canOpen) entries.push(separator);
    entries.push(item("reveal", "Show in Finder"));
  }
  return entries;
}

/** The text 'Attach … as context' puts in the composer: a Markdown quote of
 * the attached text (the local stand-in for the source's context snippet). */
export function quoteBlock(text) {
  const value = typeof text === "string" ? text.replace(/\s+$/, "") : "";
  if (!value.trim()) return "";
  return value.split("\n").map((line) => (line.length ? `> ${line}` : ">")).join("\n");
}
/** The draft after attaching: the existing draft, a blank line, the quote and
 * a blank line to type into, so several attachments keep their order. */
export function draftWithQuote(draft, text) {
  const quote = quoteBlock(text);
  if (!quote) return typeof draft === "string" ? draft : "";
  const head = typeof draft === "string" ? draft.replace(/\s+$/, "") : "";
  return head ? `${head}\n\n${quote}\n\n` : `${quote}\n\n`;
}

/** A transcript row's message text for Copy message / Attach message: an
 * agent or plan row's Markdown, a user row's text parts joined as the bubble
 * shows them; undefined for any other row or an empty message (F9: only rows
 * with text get the message menu). */
export function messageItemText(item) {
  if (!item) return undefined;
  if (item.type === "agentMessage" || item.type === "plan") return typeof item.text === "string" && item.text !== "" ? item.text : undefined;
  if (item.type !== "userMessage") return undefined;
  const text = (item.content || []).filter((part) => part.type === "text" || part.text).map((part) => part.text || "").join("\n");
  return text !== "" ? text : undefined;
}
