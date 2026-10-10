// Computer use in the transcript (source-computer-use.jsx). A core reports a step either as Code Desktop's own
// item {type: "computerUse", id, status, action, screenshot?, app?, display?} (bridges emit this when their
// agent controls the computer), or as an ordinary tool call in one of the shapes agents use:
//   Anthropic computer tool   name "computer", {action: "left_click", coordinate: [x, y], text?, scroll_direction?, …}
//   OpenAI computer use       {action: {type: "click", x, y, button?} | {type: "type", text} | {type: "keypress", keys} | …}
//   computer-use MCP servers  tools named left_click / type / key / scroll / screenshot / … with {coordinate: [x, y]} or {x, y}
// computerUseAction() normalizes all of them to one action, or null for anything else.
import { toolOutputImages } from "./generic-tool-model.mjs";
import { t } from "../electron/i18n/index.mjs";

const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const num = (value) => (typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null);
const str = (value) => (typeof value === "string" ? value : "");

// Action names across the shapes → one kind.
const KINDS = {
  click: "click", left_click: "click", leftclick: "click", mouse_click: "click", tap: "click",
  double_click: "double_click", doubleclick: "double_click", triple_click: "triple_click",
  right_click: "right_click", rightclick: "right_click", middle_click: "middle_click",
  type: "type", type_text: "type", input_text: "type", write: "type",
  key: "key", keypress: "key", key_press: "key", hotkey: "key", press: "key",
  scroll: "scroll", mouse_scroll: "scroll",
  mouse_move: "move", move: "move", hover: "move", move_mouse: "move",
  left_click_drag: "drag", drag: "drag", left_mouse_drag: "drag",
  screenshot: "screenshot", take_screenshot: "screenshot", capture_screen: "screenshot",
  zoom: "zoom", wait: "wait", sleep: "wait",
  open_app: "open_app", open_application: "open_app", launch_app: "open_app",
  cursor_position: "cursor", get_cursor_position: "cursor",
};
const TOOL_NAMES = /^(computer|computer_use|computer-use|computer_20\d{6})$/i;
const SERVER_NAMES = /computer[-_ ]?use|^computer$|desktop[-_ ]?control/i;

function pointOf(input) {
  if (Array.isArray(input?.coordinate) && input.coordinate.length >= 2) return { x: num(input.coordinate[0]), y: num(input.coordinate[1]) };
  if (num(input?.x) !== null && num(input?.y) !== null) return { x: num(input.x), y: num(input.y) };
  return null;
}

function normalize(kind, input = {}) {
  const point = pointOf(input);
  const action = { kind, ...(point ?? {}) };
  if (kind === "drag") {
    const start = Array.isArray(input.start_coordinate) ? { x: num(input.start_coordinate[0]), y: num(input.start_coordinate[1]) }
      : Array.isArray(input.path) && input.path.length ? pointOf(input.path[0]) : null;
    const end = Array.isArray(input.path) && input.path.length > 1 ? pointOf(input.path.at(-1)) : point;
    if (start) Object.assign(action, { x: start.x, y: start.y });
    if (end) Object.assign(action, { x2: end.x, y2: end.y });
  }
  if (kind === "type") action.text = str(input.text) || str(input.value);
  if (kind === "key") action.keys = Array.isArray(input.keys) ? input.keys.map(String) : str(input.text) || str(input.key) ? [str(input.text) || str(input.key)] : [];
  if (kind === "scroll") {
    action.direction = str(input.scroll_direction) || str(input.direction) || (num(input.scroll_y) ? (input.scroll_y > 0 ? "down" : "up") : num(input.scroll_x) ? (input.scroll_x > 0 ? "right" : "left") : "");
    action.amount = num(input.scroll_amount) ?? num(input.amount) ?? (num(input.scroll_y) !== null ? Math.abs(input.scroll_y) : null);
  }
  if (kind === "wait") action.seconds = num(input.duration) ?? num(input.seconds) ?? null;
  if (kind === "open_app") action.app = str(input.app) || str(input.name) || str(input.bundle_id);
  if (kind === "zoom" && Array.isArray(input.region)) action.region = input.region.slice(0, 4).map(num);
  return action;
}

/** The computer-use action a transcript item stands for, or null. */
export function computerUseAction(item) {
  if (!record(item)) return null;
  if (item.type === "computerUse") {
    const action = record(item.action) ? item.action : {};
    const kind = KINDS[str(action.kind || action.type).toLowerCase()] ?? (str(action.kind) || "other");
    return { ...normalize(kind, action), app: str(item.app) || str(action.app) || undefined };
  }
  if (item.type !== "mcpToolCall" && item.type !== "dynamicToolCall") return null;
  const tool = str(item.tool) || str(item.name);
  const server = str(item.server) || str(item.namespace);
  const input = record(item.arguments) ? item.arguments : {};
  // Anthropic / OpenAI single computer tool: the action is inside the input.
  if (TOOL_NAMES.test(tool)) {
    const inner = record(input.action) ? input.action : input;
    const kind = KINDS[str(record(input.action) ? input.action.type : input.action).toLowerCase()];
    return kind ? normalize(kind, inner) : { kind: "other", label: str(input.action) || tool };
  }
  // A computer-use MCP server: the tool name is the action.
  if (SERVER_NAMES.test(server)) {
    const kind = KINDS[tool.toLowerCase().replace(/^computer_/, "")];
    return kind ? normalize(kind, input) : null;
  }
  return null;
}

/** The step's screenshot (a data URL), or null: the item's own, else the tool's last output image. */
export function computerUseScreenshot(item) {
  if (typeof item?.screenshot === "string" && /^data:image\/(png|jpeg|webp|gif);base64,/.test(item.screenshot)) return item.screenshot;
  if (record(item?.screenshot) && typeof item.screenshot.dataUrl === "string") return item.screenshot.dataUrl;
  return toolOutputImages(item).at(-1) ?? null;
}

const KEY_GLYPHS = { cmd: "⌘", command: "⌘", super: "⌘", meta: "⌘", ctrl: "⌃", control: "⌃", alt: "⌥", option: "⌥", shift: "⇧", enter: "↩", return: "↩", tab: "⇥", escape: "⎋", esc: "⎋", backspace: "⌫", delete: "⌦", space: "Space", up: "↑", down: "↓", left: "←", right: "→" };
/** "cmd+shift+4" / ["CTRL","C"] → "⌘⇧4" / "⌃C". */
export function keyLabel(keys = []) {
  return keys.flatMap((key) => String(key).split("+")).map((part) => KEY_GLYPHS[part.trim().toLowerCase()] ?? (part.length === 1 ? part.toUpperCase() : part)).join("");
}

const truncate = (text, max = 48) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** The row's verb and meta for a state ("busy" | "done" | "failed" | …). */
export function computerUseLabel(action, state = "done") {
  const busy = state === "busy" || state === "blocked", failed = state === "failed";
  const at = action.x != null && action.y != null ? `(${action.x}, ${action.y})` : null;
  const pick = (running, done, fail) => (busy ? running : failed ? fail : done);
  switch (action.kind) {
    case "click": return { label: pick(t("Clicking"), t("Clicked"), t("Failed to click")), meta: at };
    case "double_click": return { label: pick(t("Double-clicking"), t("Double-clicked"), t("Failed to double-click")), meta: at };
    case "triple_click": return { label: pick(t("Triple-clicking"), t("Triple-clicked"), t("Failed to triple-click")), meta: at };
    case "right_click": return { label: pick(t("Right-clicking"), t("Right-clicked"), t("Failed to right-click")), meta: at };
    case "middle_click": return { label: pick(t("Middle-clicking"), t("Middle-clicked"), t("Failed to click")), meta: at };
    case "type": return { label: pick(t("Typing"), t("Typed"), t("Failed to type")), meta: action.text ? `“${truncate(action.text)}”` : null };
    case "key": return { label: pick(t("Pressing"), t("Pressed"), t("Failed to press")), meta: keyLabel(action.keys) || null };
    case "scroll": return { label: pick(t("Scrolling"), t("Scrolled"), t("Failed to scroll")), meta: [action.direction && t(action.direction), at].filter(Boolean).join(" ") || null };
    case "move": return { label: pick(t("Moving the pointer"), t("Moved the pointer"), t("Failed to move the pointer")), meta: at };
    case "drag": return { label: pick(t("Dragging"), t("Dragged"), t("Failed to drag")), meta: at && action.x2 != null ? `${at} → (${action.x2}, ${action.y2})` : at };
    case "screenshot": return { label: pick(t("Taking a screenshot"), t("Took a screenshot"), t("Failed to take a screenshot")), meta: null };
    case "zoom": return { label: pick(t("Zooming in"), t("Zoomed in"), t("Failed to zoom")), meta: null };
    case "wait": return { label: pick(t("Waiting"), t("Waited"), t("Failed to wait")), meta: action.seconds ? t("{seconds}s", { seconds: action.seconds }) : null };
    case "open_app": return { label: pick(t("Opening"), t("Opened"), t("Failed to open")), meta: action.app || null };
    case "cursor": return { label: pick(t("Finding the pointer"), t("Found the pointer"), t("Failed to find the pointer")), meta: null };
    default: return { label: pick(t("Using the computer"), t("Used the computer"), t("Computer action failed")), meta: action.label || null };
  }
}

/**
 * Where to draw on a screenshot of natural size width × height: a ring at the point, a line for a drag.
 * Coordinates are in screenshot pixels; null when the action has no point inside it.
 */
export function screenshotMarker(action, width, height) {
  if (!action || action.x == null || action.y == null || !(width > 0) || !(height > 0)) return null;
  const inside = (x, y) => x >= 0 && y >= 0 && x <= width && y <= height;
  if (!inside(action.x, action.y)) return null;
  const marker = { kind: action.kind === "drag" ? "drag" : action.kind === "move" ? "move" : action.kind === "scroll" ? "scroll" : "click",
    x: action.x / width, y: action.y / height };
  if (action.kind === "drag" && action.x2 != null && inside(action.x2, action.y2)) Object.assign(marker, { x2: action.x2 / width, y2: action.y2 / height });
  return marker;
}

/** The running computer-use step of a turn's items (the live banner), or null. */
export function activeComputerUse(items = [], isRunning = (item) => item?.status === "inProgress") {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    const action = computerUseAction(item);
    if (!action) continue;
    // The newest computer-use step decides: running → banner with its screenshot, else none.
    if (!isRunning(item)) return null;
    let screenshot = computerUseScreenshot(item);
    for (let back = index - 1; !screenshot && back >= 0; back -= 1) if (computerUseAction(items[back])) screenshot = computerUseScreenshot(items[back]);
    return { item, action, screenshot };
  }
  return null;
}
