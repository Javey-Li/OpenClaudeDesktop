// Files pane viewer cards for files that open without a text body (2.2553.1
// ion-dist/assets/v1/cd2efac6e-CAi4fxTN.js, prettier-formatted): the jo
// unavailable card To/Un (:3602-3740, role "alert" unless the typed
// unsupported card, no icon, the reason body followed by the requested path),
// the binary card (:4604-4612, title only, with Xo's xxs secondary "View as
// text anyway" :4874-4897) and the empty card (:4336-4346, title only).
// The reasons are the classified results of electron/files.cjs readFile.
export const FILE_UNAVAILABLE_REASONS = Object.freeze(["missing", "outside_root", "too_large", "read_error", "binary", "empty"]);
export const VIEW_AS_TEXT_LABEL = "View as text anyway";

const COPY = Object.freeze({
  missing: { title: "Couldn’t find this file", body: "It may have been deleted or moved.", role: "alert", showsPath: true },
  outside_root: { title: "This file is outside the working directory", body: "It can’t be opened here, but it may still exist on disk.", role: "alert", showsPath: true },
  too_large: { title: "Preview isn’t available for this file", body: "It’s too large to preview here.", role: "alert", showsPath: true },
  read_error: { title: "Couldn’t read this file", body: "It may be unreadable, or the session’s connection may have dropped.", role: "alert", showsPath: true },
  binary: { title: "This file looks like binary data and can’t be previewed as text.", body: null, role: undefined, showsPath: false, action: "view-as-text" },
  empty: { title: "This file is empty.", body: null, role: undefined, showsPath: false },
});

// Media read without their bytes (electron/files.cjs): the viewer shows them
// from their file:// URL (cd2efac6e nr/ir) instead of a card.
export const FILE_MEDIA_KINDS = Object.freeze(["image", "video", "audio"]);
// The Un card of a media file that failed to load (cd2efac6e :4527-4599, the
// local-reader branch "Couldn’t load this file"): no role, no path, with Xo's
// "View as text anyway" (Uc). nr picks the image body; video and audio share
// the media one.
export function fileMediaErrorCopy(kind) {
  return {
    title: "Couldn’t load this file",
    body: kind === "image"
      ? "This image couldn’t be loaded. It may be too large, or it may have been deleted or moved."
      : "This file couldn’t be loaded for preview. It may be too large to preview inline, in a format this browser can’t play, or it may have been deleted or moved.",
    role: undefined, showsPath: false, action: "view-as-text",
  };
}

// A tab's body state: the read result's `unavailable` reason (a media kind
// included), an empty text body, or null for a renderable (or still loading)
// file.
export function fileTabReason(tab) {
  if (!tab) return null;
  if (FILE_MEDIA_KINDS.includes(tab.unavailable)) return tab.unavailable;
  if (typeof tab.unavailable === "string") return Object.hasOwn(COPY, tab.unavailable) ? tab.unavailable : "read_error";
  if (tab.text === "") return "empty";
  return null;
}

/** {title, body, role, showsPath, action} for a reason; unknown reasons read as read_error. */
export function fileUnavailableCopy(reason) {
  const copy = COPY[reason] ?? COPY.read_error;
  return { title: copy.title, body: copy.body, role: copy.role, showsPath: copy.showsPath, action: copy.action ?? null };
}
