import { t, tn } from "../electron/i18n/index.mjs";

// Composer attachment staging (2.2553.1 c099c328d :1520-1625 image lane and
// :2947-2975 image/file pills), reduced to what the local Codex backend can
// carry: an image becomes {type:"localImage",path}, any other file becomes a
// real Codex file reference {type:"mention",name,path}. Nothing here touches
// the DOM or the file system; the caller supplies name/size/type/path facts.
export const IMAGE_TYPES = Object.freeze(["image/png", "image/jpeg", "image/gif", "image/webp"]);
export const IMAGE_MAX_BYTES = 31457280;
export const IMAGE_CAP = 5;
export const IMAGE_TYPE_ERROR = t("Only PNG, JPEG, GIF, and WebP images are supported.");
export const IMAGE_SIZE_ERROR = t("Some images were too large to attach. Maximum size is 30 MB.");
export const IMAGE_PROCESS_ERROR = t("Failed to process image. You can try again.");
// Local addition for a catalog model without image input (the DeepSeek core
// rejects such a turn); Codex catalogs either list "image" or say nothing.
export const IMAGE_MODEL_ERROR = t("The selected model doesn’t support image input.");
const EXTENSION_TYPES = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };

export function trimMessage(removed, max) {
  return tn(removed, "Removed {count} image — this session allows up to {max}.", "Removed {count} images — this session allows up to {max}.", { max });
}

export function basename(path = "") {
  return String(path).split(/[\\/]/).filter(Boolean).pop() || String(path);
}

export function extensionOf(name = "") {
  const at = String(name).lastIndexOf(".");
  return at > 0 ? String(name).slice(at + 1).toLowerCase() : "";
}

// MIME by declared type first, then by extension. Anything else is "" (a file).
export function imageMime(file) {
  const type = typeof file?.type === "string" ? file.type.toLowerCase() : "";
  if (IMAGE_TYPES.includes(type)) return type;
  return EXTENSION_TYPES[extensionOf(file?.name || file?.path)] || "";
}

export function isImageFile(file) {
  return imageMime(file) !== "";
}

// Codex Model.inputModalities: images are refused only when the catalog lists
// modalities without "image"; an absent list (fixtures, older servers) allows them.
export function modelAcceptsImages(model) {
  const modalities = model?.inputModalities;
  return !Array.isArray(modalities) || modalities.includes("image");
}

function nextId(make, index) {
  return typeof make === "function" ? make(index) : `attachment-${Date.now().toString(36)}-${index}`;
}

// Stage a batch of files. Options:
//   imagesOnly — the paste/drop image lane (official q): non-images are rejected
//                with the type toast instead of becoming file entries.
//   maxImages  — official min(maxImages ?? 5, lane cap); 5 here.
//   imagesAllowed — false when the chosen model takes no image input
//                (modelAcceptsImages): images are refused with IMAGE_MODEL_ERROR.
//   makeId     — injectable id factory for deterministic tests.
// Returns the next entries, the added entries and the toast notices in the
// official order: type, size, then the cap trim (the model notice first).
export function stageFiles(entries, files, { imagesOnly = false, imagesAllowed = true, maxImages = IMAGE_CAP, makeId } = {}) {
  const notices = [];
  const added = [];
  const list = Array.isArray(files) ? files : [];
  const images = [], others = [];
  for (const file of list) (isImageFile(file) ? images : others).push(file);
  if (!imagesAllowed && images.length > 0) { notices.push(IMAGE_MODEL_ERROR); images.length = 0; }
  else if (imagesOnly && list.length > 0 && images.length === 0) notices.push(IMAGE_TYPE_ERROR);
  let tooLarge = false;
  const accepted = [];
  for (const file of images) {
    if (Number.isFinite(file.size) && file.size > IMAGE_MAX_BYTES) { tooLarge = true; continue; }
    accepted.push(file);
  }
  if (tooLarge) notices.push(IMAGE_SIZE_ERROR);
  const cap = Math.max(0, Math.min(maxImages ?? IMAGE_CAP, IMAGE_CAP));
  const imageCount = entries.filter((entry) => entry.kind === "image").length;
  const room = cap - imageCount;
  const kept = accepted.slice(0, Math.max(0, room));
  if (accepted.length > Math.max(0, room)) notices.push(trimMessage(accepted.length - Math.max(0, room), cap));
  let next = entries.slice();
  const known = new Set(next.map((entry) => entry.path).filter(Boolean));
  let index = 0;
  const push = (file, kind) => {
    if (file.path && known.has(file.path)) return;
    const entry = {
      id: nextId(makeId, index++),
      kind,
      name: file.name || basename(file.path),
      path: file.path || "",
      size: Number.isFinite(file.size) ? file.size : null,
      mime: kind === "image" ? imageMime(file) : (file.type || ""),
      // Official entries start "loading" until the image is processed; a file
      // reference with a real path is ready immediately.
      status: kind === "image" ? "loading" : "ready",
      previewUrl: file.previewUrl || "",
    };
    if (file.path) known.add(file.path);
    next.push(entry);
    added.push(entry);
  };
  for (const file of kept) push(file, "image");
  if (!imagesOnly) for (const file of others) push(file, "file");
  return { entries: next, added, notices };
}

export function markReady(entries, id, patch = {}) {
  return entries.map((entry) => (entry.id === id ? { ...entry, ...patch, status: "ready" } : entry));
}

// Official failure path (:1590-1615): the entry is removed and the caller
// shows IMAGE_PROCESS_ERROR. Returns the entries unchanged when unknown.
export function markFailed(entries, id) {
  const exists = entries.some((entry) => entry.id === id);
  return { entries: exists ? entries.filter((entry) => entry.id !== id) : entries, notice: exists ? IMAGE_PROCESS_ERROR : null };
}

export function removeAttachment(entries, id) {
  return entries.filter((entry) => entry.id !== id);
}

// Skill chip → protocol input. The Add › Skills row and the '/' list insert the editor's skill chip
// (scroll-shared-10-current.js:8667-8722 wv/Ev; shared-14 :18578-18600 renders it as '/name'), so a
// draft whose leading token is the chosen skill becomes the {type:"skill",name,path} item the bridge
// maps to Harness's '/name' gesture (Codex injects the skill from it). The token and its one separator
// leave the message text; nothing else changes.
export function skillChipInput(text, skill) {
  if (!skill || typeof skill.name !== "string" || !skill.name || typeof skill.path !== "string" || !skill.path) return null;
  const value = String(text ?? "").replace(/^\s+/, ""), token = `/${skill.name}`;
  if (!value.startsWith(token)) return null;
  const rest = value.slice(token.length);
  if (rest && !/^\s/.test(rest)) return null;
  return { text: rest.replace(/^[ \u00a0]/, ""), item: { type: "skill", name: skill.name, path: skill.path } };
}

export function attachmentsReady(entries) {
  return entries.every((entry) => entry.status === "ready" && !!entry.path);
}

// turn/start | turn/steer | thread/queue/add input items for the staged files.
// Images are localImage parts; other files are real mention references (v2
// UserInput). No descriptive text item is ever synthesized.
export function attachmentInputs(entries) {
  return entries
    .filter((entry) => entry.status === "ready" && entry.path)
    .map((entry) => (entry.kind === "image"
      ? { type: "localImage", path: entry.path }
      : { type: "mention", name: entry.name || basename(entry.path), path: entry.path }));
}

export function attachmentLabel(entry) {
  return entry.kind === "image" ? entry.name : (entry.relativePath || entry.name);
}

// Pill click routing (c099c328d :3542-3590: Kl image pill → Ue, ql file pill → Gl). A ready
// image opens the image viewer on its preview; nothing happens while it is still loading. A
// file with a real path opens in the Files pane, the desktop's file viewer (the source's
// FilePreviewModal / new tab have no local counterpart); a directory is revealed instead.
export function attachmentOpenAction(entry) {
  if (!entry || entry.status === "loading") return null;
  if (entry.kind === "image") return entry.previewUrl ? "view" : null;
  if (!entry.path) return null;
  return entry.isDirectory ? "reveal" : "file";
}

// The open image viewer ({id, origin, …}) as it should show now: on its entry's current preview and
// name while that entry is still attached and viewable, otherwise null (the entry was removed, sent,
// swapped out with its draft or emptied), so the viewer never outlives or reopens on a stale entry.
export function attachmentViewerState(viewer, entries = []) {
  if (!viewer) return null;
  const entry = entries.find((candidate) => candidate.id === viewer.id);
  return entry && attachmentOpenAction(entry) === "view" ? { ...viewer, src: entry.previewUrl, alt: entry.name } : null;
}
