// Bundled release notes for the What’s new dialog (titlebar-release-notes.js:4184-4200 j(surface) over the
// versioned `releases` list: {version, date, entries: [{surface, kind, text}]}, newest first). This client has a
// single surface, so an entry is {version, date, items: [{kind, text}]}; `limits` is the local "Known limits"
// footnote. Text may hold [[keys]] (keycaps) and `code` spans (I, :5071-5094).
export const RELEASE_NOTES = Object.freeze([
  {
    version: "0.2.130",
    date: "2026-10-01",
    items: [
      { kind: "feat", text: "This local Code Desktop client is now powered by DeepSeek Harness." },
      { kind: "feat", text: "Sessions run on DeepSeek models; the model menu lists each model’s reasoning efforts." },
      { kind: "feat", text: "Sessions are saved by DeepSeek Harness in `~/.dsh`, so the DeepSeek Harness app can open them too." },
      { kind: "feat", text: "Plan mode, queued messages and `/compact` work with DeepSeek, along with approvals, sub-agents, skills and image input." },
      { kind: "improvement", text: "While DeepSeek thinks, the status line can show its reasoning in the transcript, and reads “Thought for Ns” when a thought ends." },
      { kind: "improvement", text: "Reasoning reads as plain text with Copy as quote; thinking before tool calls is an open Thought process step." },
      { kind: "improvement", text: "The Plan pane lists tasks as done, in progress or not done, and stays after a session is reopened." },
    ],
    limits: [
      "/fork, /review and /rewind aren’t available yet.",
      "Sessions created before the switch don’t appear in the sidebar.",
      "Removing a session hides it here only; its history stays in DeepSeek Harness.",
      "Settings can’t add MCP servers, turn skills on or off, or save the API key; set the key in DeepSeek Harness.",
      "Usage counts come from session logs on this Mac, not from DeepSeek billing, and no balance is shown.",
      "Background jobs don’t appear in the Tasks pane, and sub-agent replies arrive step by step.",
      "Writing to an added folder may need an extra permission step.",
    ],
  },
]);

// F (:5070): groups render in this order, labelled New / Improved / Fixed (L, :5095-5099).
export const RELEASE_NOTE_KINDS = Object.freeze(["feat", "improvement", "fix"]);
export const RELEASE_NOTE_KIND_LABELS = Object.freeze({ feat: "New", improvement: "Improved", fix: "Fixed" });

// P (:5059-5069) `n`: the nudge needs an entry whose version is the running version.
export const LOCAL_RELEASE_NOTE_VERSIONS = Object.freeze(RELEASE_NOTES.map((entry) => entry.version));
export function hasReleaseNotes(version, notes = RELEASE_NOTES) {
  return !!version && notes.some((entry) => entry.version === version);
}

// d/p: a plain x.y.z version and its ordering (prerelease/build suffixes are not used locally).
const VERSION = /^(\d+)\.(\d+)\.(\d+)$/;
export function validVersion(value) {
  return typeof value === "string" && VERSION.test(value);
}
export function compareVersions(a, b) {
  const left = VERSION.exec(a).slice(1).map(Number), right = VERSION.exec(b).slice(1).map(Number);
  for (let index = 0; index < 3; index++) if (left[index] !== right[index]) return left[index] - right[index];
  return 0;
}

// B m (:5161-5165): with a valid running version only entries at or below it show; newest first.
export function releaseNotesFor(clientVersion, notes = RELEASE_NOTES) {
  const shown = validVersion(clientVersion)
    ? notes.filter((entry) => validVersion(entry.version) && compareVersions(entry.version, clientVersion) <= 0)
    : [...notes];
  return shown.sort((a, b) => (validVersion(a.version) && validVersion(b.version) ? compareVersions(b.version, a.version) : 0));
}

// I: split on [[keys]] (not followed by another ]) and `code`; text runs stay text.
export function releaseNoteSegments(text) {
  const parts = String(text).split(/\[\[(.+?)\]\](?!\])|`([^`]+)`/), segments = [];
  for (let index = 0; index < parts.length; index += 3) {
    if (parts[index]) segments.push({ type: "text", value: parts[index] });
    const keys = parts[index + 1], code = parts[index + 2];
    if (keys !== undefined) segments.push({ type: "keys", value: keys });
    else if (code !== undefined) segments.push({ type: "code", value: code });
  }
  return segments;
}

// The h4 date: O(new Date(`${date}T00:00:00Z`), {timeZone: "UTC", year: "numeric", month: "long", day: "numeric"}).
export function releaseNoteDate(date, locale = "en-US") {
  return new Intl.DateTimeFormat(locale, { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" }).format(new Date(`${date}T00:00:00Z`));
}
