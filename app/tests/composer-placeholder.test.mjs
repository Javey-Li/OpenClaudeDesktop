import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { composerPlaceholder, composerFirstRun, SESSION_PLACEHOLDER, DRAFT_PLACEHOLDER, CHAT_PLACEHOLDER, FIRST_RUN_PLACEHOLDER } from "../src/composer-placeholder.mjs";

const root = path.resolve(import.meta.dirname, "..");

// cc43287c9-BMbiZYzF.js:28686 placeholder Yn ? 'Type / for commands' : 'Describe a task or ask a question' (:27454 Yn = Pn?.id ?? null).
test("Code composer: session id → 'Type / for commands'; draft (null/empty) → draft copy", () => {
  assert.equal(SESSION_PLACEHOLDER, "Type / for commands");
  assert.equal(DRAFT_PLACEHOLDER, "Describe a task or ask a question");
  assert.equal(composerPlaceholder({ sessionId: "thread-1", mode: "code" }), "Type / for commands");
  assert.equal(composerPlaceholder({ sessionId: null, mode: "code" }), "Describe a task or ask a question");
  assert.equal(composerPlaceholder({ sessionId: "", mode: "code" }), "Describe a task or ask a question", "Yn ?? null: an empty id is not a session");
  assert.equal(composerPlaceholder({ mode: "code" }), DRAFT_PLACEHOLDER);
  assert.equal(composerPlaceholder(), DRAFT_PLACEHOLDER);
});

// cc43287c9-Bchz60VT :33797-33816 ho (scope store firstRun === true, set from Zq :15632-15660).
test("first run (no sessions, stats read with no sessions) → 'Describe something to build, change, or fix' on the draft only", () => {
  assert.equal(FIRST_RUN_PLACEHOLDER, "Describe something to build, change, or fix");
  assert.equal(composerPlaceholder({ sessionId: null, mode: "code", firstRun: true }), FIRST_RUN_PLACEHOLDER);
  assert.equal(composerPlaceholder({ sessionId: null, mode: "code", firstRun: null }), DRAFT_PLACEHOLDER, "pending: the usual copy");
  assert.equal(composerPlaceholder({ sessionId: null, mode: "code", firstRun: false }), DRAFT_PLACEHOLDER);
  assert.equal(composerPlaceholder({ sessionId: "thread-1", mode: "code", firstRun: true }), SESSION_PLACEHOLDER);
  assert.equal(composerPlaceholder({ sessionId: null, mode: "chat", firstRun: true }), CHAT_PLACEHOLDER);
});

test("Zq: null while the session list or stats are pending, false with any session or unreadable stats, else totalSessions === 0", () => {
  const empty = { dailyActivity: [], dailyModelTokens: [], modelUsage: {} };
  assert.equal(composerFirstRun({ sessionsLoaded: false, sessionCount: 0, stats: empty }), null);
  assert.equal(composerFirstRun({ sessionsLoaded: true, sessionCount: 2, stats: undefined }), false, "r > 0 wins before the stats");
  assert.equal(composerFirstRun({ sessionsLoaded: true, sessionCount: 0, stats: undefined }), null, "stats pending (eR null)");
  assert.equal(composerFirstRun({ sessionsLoaded: true, sessionCount: 0, stats: null }), false, "stats failed (eR undefined)");
  assert.equal(composerFirstRun({ sessionsLoaded: true, sessionCount: 0, stats: empty }), true);
  assert.equal(composerFirstRun({ sessionsLoaded: true, sessionCount: 0, stats: { ...empty, dailyActivity: [{ date: "2026-10-01", sessionCount: 3 }] } }), false, "sessions recorded on this Mac before");
  assert.equal(composerFirstRun({ sessionsLoaded: true, sessionCount: 0, stats: { totalSessions: 1 } }), false);
  assert.equal(composerFirstRun(), null);
});

test("Chat mode is not the cc43287c9 Code branch and keeps its own copy with or without a session", () => {
  assert.equal(CHAT_PLACEHOLDER, "How can I help you today?");
  assert.equal(composerPlaceholder({ sessionId: "thread-1", mode: "chat" }), CHAT_PLACEHOLDER);
  assert.equal(composerPlaceholder({ sessionId: null, mode: "chat" }), CHAT_PLACEHOLDER);
});

test("main.jsx feeds the current session id into the composer placeholder; SourceComposer's fallback is the draft copy", async () => {
  const main = await fs.readFile(path.join(root, "src/main.jsx"), "utf8");
  const composer = await fs.readFile(path.join(root, "src/source-composer.jsx"), "utf8");
  assert.match(main, /composerPlaceholder\(\{ sessionId: current, mode, firstRun: composerFirstRun\(\{ sessionsLoaded, sessionCount: sessions\.length \+ \(hiddenSessions\?\.otherEngine \|\| 0\) \+ \(hiddenSessions\?\.missing \|\| 0\), stats: statsSnapshot \}\) \}\)\}/);
  // A core's suggested next prompt (codeDesktop/promptSuggestion) clears the placeholder (c099c328d :8988) and is drawn
  // bare by the ghost overlay; bash mode reads 'Enter a shell command'.
  assert.match(composer, /placeholder=\{showSuggestion \? "" : bashMode \? t\("Enter a shell command"\) : placeholder \?\? composerPlaceholder\(\{ mode \}\)\}/);
  assert.doesNotMatch(composer, /Tab to use/);
  const editor = await fs.readFile(path.join(root, "src/source-composer-editor.jsx"), "utf8");
  assert.match(editor, /data-placeholder=\{props\.placeholder\}/, "the ProseMirror editor exposes the copy through data-placeholder (::before content)");
});
