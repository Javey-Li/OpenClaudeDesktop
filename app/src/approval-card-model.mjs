// Codex data adaptation for the current non-dock jM/EM approval-card branch.
// This model does not grant permissions, hold request identities or invoke IPC.
import { assistantName, escapeRegExp } from "./persona-store.mjs";
import { t } from "../electron/i18n/index.mjs";
const COMMAND = "item/commandExecution/requestApproval";
const FILE = "item/fileChange/requestApproval";
const PERMISSIONS = "item/permissions/requestApproval";

function nonempty(value) {
  return typeof value === "string" && value.trim() ? value : null;
}

function rawText(value) {
  if (value == null) return null;
  if (typeof value === "string") return nonempty(value);
  if (Array.isArray(value) && value.length === 0) return null;
  try { return JSON.stringify(value, null, 2) ?? null; }
  catch { return null; } // IPC data is JSON; do not synthesize truncated details.
}

// approval-current.js:14521-14534 Write -> "write", Edit/MultiEdit -> "edit", each ...SM(file_path);
// :15201-15205 SM = {meta: Yn(path) basename, detail: full path, clampTitle: true}. Codex
// FileChangeRequestApprovalParams carries no paths, so only item.changes (FileUpdateChange
// {path, kind: PatchChangeKind}) can name the file, and only when it is exactly one change.
// Adaptation: PatchChangeKind "delete" has no source verb (no Delete tool) and stays "edit".
// Legacy string kinds ("update", fixture codex-server.cjs:712) are accepted beside {type}.
function fileHeading(changes) {
  if (!Array.isArray(changes) || changes.length !== 1) return null;
  const path = nonempty(changes[0]?.path);
  if (!path) return null;
  const meta = path.split(/[\\/]/).pop();
  if (!meta) return null;
  const type = typeof changes[0].kind === "string" ? changes[0].kind : changes[0].kind?.type;
  return { action: type === "add" ? t("write") : t("edit"), meta };
}

const singleLine = value => nonempty(value)?.replace(/\s+/g, " ").trim() ?? null;
// approval-current.js:14121-14133 Xj: a change over 200,000 characters gets no preview.
export const PREVIEW_LIMIT = 200000;
export const PREVIEW_TOO_LARGE = t("Preview unavailable \u2014 this change is too large to show here (over 200,000 characters). The full change appears in the conversation after it runs.");
export const previewTooLarge = change => typeof change?.diff === "string" && change.diff.length > PREVIEW_LIMIT;
// KS(path, {singleLine}) (ion-dist cba82325b d): control characters, newlines included,
// show as [U+XXXX] escapes so a path stays one visible line; spaces are kept as spelled.
const pathText = value => nonempty(value)?.replace(/[\u0000-\u001f\u007f-\u009f]/gu,
  char => `[U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}]`) ?? null;
const firstLine = value => singleLine(nonempty(value)?.trim().split("\n")[0]);
function argumentsDetail(value) {
  if (value == null || (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0)) return null;
  const text = rawText(value);
  return text === null ? null : { kind: "arguments", text, value };
}

// approval-current.js:14508-14595 per-tool copy, read from the transcript item the
// card belongs to (Codex command approvals carry only a command string). Bash -> "run"
// + description meta + command detail (clampTitle); Task/Agent -> "run an agent" +
// description and no detail (:14570-14579); Skill -> "run skill /name"; WebFetch ->
// "fetch url"; WebSearch -> "search the web" + query; anything else -> "use {label}" +
// pretty JSON detail. Adaptations: the DeepSeek core's subagent/subagent_fork tools and
// Codex spawnAgent are agents, whose prompt (first line) stands in for a missing
// description; MCP labels are "tool (server)".
function itemHeading(item, command) {
  switch (item?.type) {
    case "commandExecution": {
      const meta = singleLine(item.description);
      if (!meta) return null;
      const text = rawText(command);
      return { heading: { action: t("run"), meta }, detail: text === null ? null : { kind: "command", text, value: command }, clampTitle: text !== null };
    }
    case "dynamicToolCall": {
      const tool = nonempty(item.tool);
      if (!tool) return null;
      const args = item.arguments && typeof item.arguments === "object" && !Array.isArray(item.arguments) ? item.arguments : {};
      if (tool === "subagent" || tool === "subagent_fork") {
        const description = singleLine(args.description);
        return { heading: { action: t("run an agent"), meta: description ?? firstLine(args.prompt) }, detail: null, clampTitle: !description };
      }
      if (tool === "skill") {
        const name = singleLine(args.name);
        const { name: _name, ...rest } = args;
        return { heading: { action: t("run skill"), meta: name ? `/${name}` : null }, detail: argumentsDetail(rest) };
      }
      if (tool === "web_fetch") return { heading: { action: t("fetch"), meta: singleLine(args.url) }, detail: null };
      if (tool === "web_search") {
        const queries = Array.isArray(args.queries) ? args.queries.filter(query => typeof query === "string") : [];
        return { heading: { action: t("search the web"), meta: singleLine(queries.join(", ")) ?? singleLine(args.query) }, detail: null };
      }
      return { heading: { action: t("use {tool}", { tool }), meta: null }, detail: argumentsDetail(item.arguments) };
    }
    case "mcpToolCall": {
      const tool = nonempty(item.tool);
      if (!tool) return null;
      const server = nonempty(item.server);
      return { heading: { action: server ? t("use {tool} ({server})", { tool, server }) : t("use {tool}", { tool }), meta: null }, detail: argumentsDetail(item.arguments) };
    }
    case "webSearch":
      return item.action?.type === "openPage"
        ? { heading: { action: t("fetch"), meta: singleLine(item.action.url) }, detail: null }
        : { heading: { action: t("search the web"), meta: singleLine(item.action?.query) ?? singleLine(item.query) }, detail: null };
    case "collabAgentToolCall": {
      if (item.tool !== "spawnAgent") return null;
      // The DeepSeek core keeps the delegation's description on the item (Codex has none).
      const description = singleLine(item.description);
      return { heading: { action: t("run an agent"), meta: description ?? firstLine(item.prompt) }, detail: null, clampTitle: !description };
    }
    default:
      return null;
  }
}

export function approvalCardModel(request, item) {
  const params = request?.params ?? {};
  const method = request?.method;
  const kind = method === COMMAND ? "command" : method === FILE ? "file"
    : method === PERMISSIONS ? "permissions" : "unsupported";
  const context = [];
  const add = (key, text) => { if (nonempty(text)) context.push({ key, text }); };
  // approval-current.js:15275-15284 decision reason: its own block, not context.
  const reason = nonempty(params.reason);
  // A terminal's stdin approval keeps its own copy; other command approvals name
  // the tool from the item. Its detail wins over params.command (for a non-bash
  // tool the DeepSeek core sends "<tool> <json>" there). The source card has no
  // working-directory row (approval-current.js:15561-15591 EM blocks; Bash copy
  // :14507-14515), so only the item-less fallback keeps that local line.
  const derived = kind === "command" && params.kind !== "writeStdin"
    ? itemHeading(item, params.command ?? item?.command) : null;
  const cwd = nonempty(params.cwd) ?? nonempty(item?.cwd);
  if (cwd && !derived) add("cwd", t("Working directory: {cwd}", { cwd }));
  if (kind === "command" && params.networkApprovalContext) {
    const { protocol, host } = params.networkApprovalContext;
    const target = [nonempty(protocol), nonempty(host)].filter(Boolean).join("://");
    if (target) add("network", t("Network access: {target}", { target }));
  }
  if (kind === "file" && nonempty(params.grantRoot))
    add("grant-root", t("Requested write root: {root}", { root: params.grantRoot }));
  if (kind === "permissions") add("scope", t("Applies to this turn only."));

  let detail = null;
  if (derived) detail = derived.detail;
  else if (kind === "command") {
    const value = params.command ?? item?.command;
    const text = rawText(value);
    if (text !== null) detail = { kind: "command", text, value };
    else add("missing-detail", t("Command details were not provided."));
  } else if (kind === "file") {
    // approval-current.js:15201-15205 SM: the detail is the full path (KS singleLine)
    // under the "{write|edit} {basename}" heading; several changes list every path.
    // value keeps the changes for the in-card preview (:15596-15607 yce).
    const value = params.changes ?? item?.changes;
    if (Array.isArray(value) && value.length) {
      detail = { kind: "path", text: value.map(change => pathText(change?.path)).filter(Boolean).join("\n"), value };
      // :15501-15506 V / :14792-14798 fM (Xj: any string over 200,000 characters).
      if (value.some(previewTooLarge))
        add("too-large", PREVIEW_TOO_LARGE);
    } else {
      const text = rawText(value);
      if (text !== null) detail = { kind: "changes", text, value };
      else add("missing-detail", t("File change details were not provided."));
    }
  } else if (kind === "permissions") {
    const value = params.permissions;
    const text = rawText(value);
    if (text !== null) detail = { kind: "permissions", text, value };
    else add("missing-detail", t("Permission details were not provided."));
  } else add("method", nonempty(method) ?? t("The request type was not provided."));

  const heading = kind === "file" ? fileHeading(detail?.value) : derived?.heading ?? null;
  // EM y (approval-current.js:15254): a detail equal to the meta (a bare file name) is no
  // detail at all, so the card has no path box, no preview (:15596-15607) and no toggle.
  if (detail?.kind === "path" && heading?.meta && detail.text === heading.meta) detail = null;
  const clampTitle = kind === "file" ? !!heading : !!derived?.clampTitle;
  const who = assistantName(); // C2 persona; "DeepSeek" by default
  const title = heading ? t("Allow {name} to {action}?", { name: who, action: `${heading.action}${heading.meta ? ` ${heading.meta}` : ""}` })
    : kind === "command"
      ? params.kind === "writeStdin" ? t("Allow {name} to send input to this terminal?", { name: who }) : t("Allow {name} to run this command?", { name: who })
      : kind === "file" ? t("Allow {name} to edit files?", { name: who })
      : kind === "permissions" ? t("Allow {name} to use these permissions?", { name: who }) : t("Unsupported approval request");
  const supported = kind !== "unsupported";
  const deny = supported ? { key: kind === "permissions" ? "deny" : "decline", label: t("Deny"), primary: false } : null;
  // sessionGrantable (DeepSeek core): false when the core would not remember the
  // grant, e.g. a full-access file escalation (source disableAlwaysAllow).
  const allows = !supported ? [] : kind === "permissions"
    ? [{ key: "allow", label: t("Allow for this turn"), primary: true }]
    : [...(params.sessionGrantable === false ? [] : [{ key: "acceptForSession", label: t("Allow for this session"), primary: false }]),
       { key: "accept", label: t("Allow once"), primary: true }];
  return { kind, supported, title, ...(heading && { heading }), ...(clampTitle && { clampTitle }), reason, context, detail, deny, allows };
}

// approval-current.js:14649-14658 iM: one whitespace-collapsed line, capped at 150
// code points with ", truncated".
function announceText(text) {
  const line = text.replace(/\s+/g, " ").trim(), chars = [...line];
  return chars.length <= 150 ? line : t("{text}, truncated", { text: chars.slice(0, 150).join("") });
}
/** pM (approval-current.js:14799-14905): the live-region text for a new request,
 * "Permission requested: {action}. {detail}, {meta}" from the card copy (oM action,
 * iM detail when it differs from the meta, sM meta), then each extra block as
 * "{announcement}. {extra}" — the decision reason capped, the too-large sentence
 * (dM) in full. A headingless local title announces its own phrase. */
export function approvalAnnouncement(model) {
  if (!model) return "";
  const heading = model.heading;
  const action = announceText(heading ? heading.action
    : model.title.replace(new RegExp(`^Allow ${escapeRegExp(assistantName())} to `), "").replace(/^Allow DeepSeek to /, "").replace(/[?？]$/, ""));
  const meta = heading?.meta ? announceText(heading.meta) : null;
  const detail = model.detail?.text && model.detail.text !== heading?.meta ? announceText(model.detail.text) : null;
  let text = detail && meta ? t("Permission requested: {action}. {detail}, {meta}", { action, detail, meta })
    : detail ? t("Permission requested: {action}. {detail}", { action, detail })
    : meta ? t("Permission requested: {action}, {meta}", { action, meta })
    : t("Permission requested: {action}", { action });
  const extras = [model.reason && announceText(model.reason),
    ...model.context.filter(part => part.key === "too-large").map(part => part.text)];
  for (const extra of extras) if (extra?.trim()) text = t("{text}. {extra}", { text, extra });
  return text;
}

export function approvalActionIndex(key, current, count) {
  const direction = key === "ArrowLeft" || key === "ArrowUp" ? -1
    : key === "ArrowRight" || key === "ArrowDown" ? 1 : 0;
  if (!direction || count <= 0) return null;
  return current < 0 ? direction > 0 ? 0 : count - 1
    : (current + direction + count) % count;
}

/** Only a key already bubbling within this card is eligible. Root remains
 * responsible for current-pane/menu state; no global listener is installed. */
export function approvalKeyIntent(event, { target, model, busy = false,
  active = true, menuOpen = false, armed = true } = {}) {
  if (!model?.supported || busy || !active || menuOpen || event.defaultPrevented ||
      event.isComposing || event.nativeEvent?.isComposing || event.keyCode === 229 || event.nativeEvent?.keyCode === 229 ||
      target === "editor" || event.altKey) return null;
  if (event.repeat) return ["Enter", " ", "Escape"].includes(event.key) ? { type: "suppress" } : null;
  if (event.key === "Escape" && !event.metaKey && !event.ctrlKey && !event.shiftKey)
    return { type: "action", action: model.deny.key };
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    if (!armed) return { type: "suppress" };
    // The local permission adapter remains turn-only even for the shifted chord.
    const action = model.kind === "permissions" ? "allow"
      : event.shiftKey ? "acceptForSession" : "accept";
    // approval-hotkeys-current.js:100 allowPersistent?.(): no session grant, no action.
    if (!model.allows.some(allow => allow.key === action)) return { type: "suppress" };
    return { type: "action", action };
  }
  if (event.metaKey || event.ctrlKey || event.shiftKey) return null;
  if (target === "card" && event.key === "Enter") return { type: "focus-primary" };
  if ((target === "card" || target === "actions") && event.key.startsWith("Arrow"))
    return approvalActionIndex(event.key, -1, 1) === null ? null : { type: "navigate", key: event.key };
  return null;
}

export function detailsOverflow(metrics) {
  return metrics.scrollHeight > metrics.clientHeight;
}

/** cf6ae6197 bv (approval-current.js Up): a clamped region takes keyboard focus,
 * role group and its label (e.g. "Reason") only while its content overflows. */
export function scrollRegionProps(label, overflow) {
  return overflow ? { tabIndex: 0, role: "group", "aria-label": label } : {};
}

/** approval-hotkeys ep C/S + shared-6 aR. Visibility is observational here;
 * eligibility still needs a fresh geometry check at the actual key event.
 * This clock is deliberately independent of the allow-click arming clock. */
export function createApprovalHotkeyArming({ now = Date.now, active = true } = {}) {
  let requestOrReentryAt = now(), activationAt = -Infinity;
  let wasActive = active, hiddenObserved = false;
  return {
    observeVisibility({ intersecting, visible }) {
      if (!intersecting || !visible) { hiddenObserved = true; return false; }
      if (!hiddenObserved) return false;
      hiddenObserved = false;
      requestOrReentryAt = now();
      return true;
    },
    setActive(value) {
      if (value && !wasActive) activationAt = now();
      wasActive = value;
    },
    isArmed() {
      const time = now();
      return time - requestOrReentryAt >= 400 && time - activationAt >= 400;
    },
  };
}

/** shared-6 Zt -> nR/rR: partial intersection is eligible; fully clipped or
 * offscreen cards yield. These are synchronous measurements, not IO state. */
export function approvalHasVisibleIntersection({ rect, viewport, clips = [], visible = true } = {}) {
  if (!visible || !rect || !viewport || viewport.width <= 0 || viewport.height <= 0 ||
      rect.right <= rect.left || rect.bottom <= rect.top) return false;
  let { top, bottom, left, right } = rect;
  const pixels = value => typeof value === "string" && value.endsWith("px") ? parseFloat(value) || 0 : 0;
  for (const clip of clips) {
    if (clip.overflowY !== "visible") {
      top = Math.max(top, clip.rect.top + pixels(clip.scrollPaddingTop));
      bottom = Math.min(bottom, clip.rect.bottom - pixels(clip.scrollPaddingBottom));
    }
    if (clip.overflowX !== "visible") {
      left = Math.max(left, clip.rect.left);
      right = Math.min(right, clip.rect.right);
    }
  }
  return bottom > Math.max(0, top) && top < viewport.height &&
    right > Math.max(0, left) && left < viewport.width;
}
