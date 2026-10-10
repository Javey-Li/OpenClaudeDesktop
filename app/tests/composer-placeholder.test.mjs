import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { composerPlaceholder, SESSION_PLACEHOLDER, DRAFT_PLACEHOLDER, CHAT_PLACEHOLDER } from "../src/composer-placeholder.mjs";

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

test("Chat mode is not the cc43287c9 Code branch and keeps its own copy with or without a session", () => {
  assert.equal(CHAT_PLACEHOLDER, "How can I help you today?");
  assert.equal(composerPlaceholder({ sessionId: "thread-1", mode: "chat" }), CHAT_PLACEHOLDER);
  assert.equal(composerPlaceholder({ sessionId: null, mode: "chat" }), CHAT_PLACEHOLDER);
});

test("main.jsx feeds the current session id into the composer placeholder; SourceComposer's fallback is the draft copy", async () => {
  const main = await fs.readFile(path.join(root, "src/main.jsx"), "utf8");
  const composer = await fs.readFile(path.join(root, "src/source-composer.jsx"), "utf8");
  assert.match(main, /placeholder=\{composerPlaceholder\(\{ sessionId: current, mode \}\)\}/);
  // A core's suggested next prompt (codeDesktop/promptSuggestion) clears the placeholder (c099c328d :8988) and is drawn
  // bare by the ghost overlay; bash mode reads 'Enter a shell command'.
  assert.match(composer, /placeholder=\{showSuggestion \? "" : bashMode \? t\("Enter a shell command"\) : placeholder \?\? composerPlaceholder\(\{ mode \}\)\}/);
  assert.doesNotMatch(composer, /Tab to use/);
  const editor = await fs.readFile(path.join(root, "src/source-composer-editor.jsx"), "utf8");
  assert.match(editor, /data-placeholder=\{props\.placeholder\}/, "the ProseMirror editor exposes the copy through data-placeholder (::before content)");
});
