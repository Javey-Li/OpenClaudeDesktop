import test from "node:test";
import assert from "node:assert/strict";
import {
  mentionToken, insertMention, mentionRanges, mentionInputs, mentionOptions, optionHighlights, segments,
  mentionWidth, mentionPopupGeometry, nextHighlight, MENTION_WIDTHS,
} from "../src/mention-model.mjs";

test("token detection: '@' at start or after whitespace, caret inside the token", () => {
  assert.deepEqual(mentionToken("@src", 4), { start: 0, end: 4, query: "src" });
  assert.deepEqual(mentionToken("look at @src/app now", 12), { start: 8, end: 16, query: "src" }, "the whole run is the token, the query stops at the caret");
  assert.deepEqual(mentionToken("look at @src/app now", 16), { start: 8, end: 16, query: "src/app" });
  assert.equal(mentionToken("mail@example.com", 16), null, "an email-like run is not a mention");
  assert.equal(mentionToken("plain text", 5), null);
  assert.equal(mentionToken("@src done", 9), null, "caret after the token's trailing space");
  assert.equal(mentionToken("@", 1)?.query, "");
});

test("insertMention replaces the token with '@<path> ' and moves the caret", () => {
  const token = mentionToken("see @sr please", 7);
  const result = insertMention("see @sr please", token, "src/app.js");
  assert.equal(result.text, "see @src/app.js  please");
  assert.equal(result.caret, "see @src/app.js ".length);
});

test("ranges and UTF-8 byte offsets for text_elements plus mention items", () => {
  const text = "héllo @src/app.js and @docs/read me.md @src/app.js";
  const inputs = mentionInputs(text, ["src/app.js", "docs/read"], { resolvePath: (path) => `/w/${path}` });
  assert.equal(inputs.text, text);
  const encoder = new TextEncoder();
  const bytes = (slice) => encoder.encode(slice).length;
  assert.deepEqual(inputs.text_elements, [
    { byteRange: { start: bytes("héllo "), end: bytes("héllo @src/app.js") }, placeholder: null },
    { byteRange: { start: bytes("héllo @src/app.js and "), end: bytes("héllo @src/app.js and @docs/read") }, placeholder: null },
    { byteRange: { start: bytes("héllo @src/app.js and @docs/read me.md "), end: bytes(text) }, placeholder: null },
  ]);
  assert.deepEqual(inputs.items, [
    { type: "mention", name: "app.js", path: "/w/src/app.js" },
    { type: "mention", name: "read", path: "/w/docs/read" },
  ]);
  assert.deepEqual(mentionRanges("x@src/app.js", ["src/app.js"]), [], "no boundary before '@' means plain text");
  assert.deepEqual(mentionRanges("@src/a @src/a/b", ["src/a", "src/a/b"]).map((range) => range.path), ["src/a", "src/a/b"]);
});

test("options follow the official ccd-files shape and highlight positions", () => {
  const options = mentionOptions([{ path: "src/app.js", positions: [4, 5, 6] }, { path: "README.md", positions: [0, 1] }]);
  assert.deepEqual(options.map((option) => [option.label, option.description, option.renderedText]),
    [["app.js", "src", "src/app.js"], ["README.md", undefined, "README.md"]]);
  const lit = optionHighlights(options[0]);
  assert.deepEqual(lit.label, [{ text: "app", lit: true }, { text: ".js", lit: false }]);
  assert.equal(lit.description, null);
  const dirLit = optionHighlights({ ...options[0], positions: [0, 1] });
  assert.deepEqual(dirLit.description, [{ text: "sr", lit: true }, { text: "c", lit: false }]);
  assert.equal(dirLit.label, null);
  assert.deepEqual(segments("a\u{1F600}b", [1], 0), [{ text: "a", lit: false }, { text: "\u{1F600}", lit: true }, { text: "b", lit: false }], "a hit on one UTF-16 half lights the whole code point");
  assert.equal(mentionWidth(options), MENTION_WIDTHS.wide);
  assert.equal(mentionWidth([options[1]]), MENTION_WIDTHS.base);
});

test("popup geometry: 24px above the caret, 16px collision padding, 384px cap", () => {
  const box = mentionPopupGeometry({ caret: { left: 100, top: 700 }, width: 420, viewport: { width: 1324, height: 768 } });
  assert.deepEqual(box, { left: 100, bottom: 768 - (700 - 24), maxHeight: 384, width: 420 });
  const tight = mentionPopupGeometry({ caret: { left: 1300, top: 120 }, width: 420, viewport: { width: 1324, height: 768 } });
  assert.equal(tight.left, 1324 - 16 - 420);
  assert.equal(tight.maxHeight, 120 - 24 - 16);
});

test("highlight navigation wraps", () => {
  assert.equal(nextHighlight(0, 3, "ArrowUp"), 2);
  assert.equal(nextHighlight(2, 3, "ArrowDown"), 0);
  assert.equal(nextHighlight(1, 0, "ArrowDown"), -1);
  assert.equal(nextHighlight(1, 3, "End"), 2);
});

// Fidelity F05: the editor's mention node (composer-editor-model.mjs) serializes to the text this helper writes,
// so the draft, mentionRanges and the turn/start payload do not change with the chip.
test("the mention chip and the text insertion produce the same draft and payload", async () => {
  const { EditorState } = await import("prosemirror-state");
  const { composerSchema, composerDocument, composerSelection, composerText, mentionTransaction } = await import("../src/composer-editor-model.mjs");
  let state = EditorState.create({ schema: composerSchema, doc: composerDocument("see @sr") });
  state = state.apply(state.tr.setSelection(composerSelection(state.doc, 7)));
  const token = mentionToken(composerText(state.doc), 7);
  state = state.apply(mentionTransaction(state, token, { path: "src/a.ts", label: "a.ts" }));
  const typed = insertMention("see @sr", token, "src/a.ts");
  assert.equal(composerText(state.doc), typed.text);
  assert.equal(typed.text, "see @src/a.ts ");
  assert.deepEqual(mentionInputs(composerText(state.doc), [{ path: "src/a.ts" }], { resolvePath: (path) => `/w/${path}` }).items, [{ type: "mention", name: "a.ts", path: "/w/src/a.ts" }]);
});
