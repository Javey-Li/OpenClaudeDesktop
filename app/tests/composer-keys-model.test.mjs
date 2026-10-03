import test from "node:test";
import assert from "node:assert/strict";
import { isComposingEvent, keyKind, escapeAction, enterAction, submitPriority, windowEscapeAction, escapeExemptTarget, emptyArrowUpDequeues } from "../src/composer-keys-model.mjs";

const key = (overrides) => ({ key: "Enter", shiftKey: false, altKey: false, metaKey: false, ctrlKey: false, repeat: false, isComposing: false, keyCode: 13, ...overrides });

test("IME classification: isComposing, keyCode 229 and key 'Process'", () => {
  assert.equal(isComposingEvent(key({ isComposing: true })), true);
  assert.equal(isComposingEvent(key({ keyCode: 229 })), true);
  assert.equal(isComposingEvent(key({ key: "Process" })), true);
  assert.equal(isComposingEvent(key({ nativeEvent: { isComposing: true } })), true);
  assert.equal(keyKind(key({ key: "Process" })), "ime");
  assert.equal(keyKind(key({ key: "Meta", metaKey: true })), "modifier");
  assert.equal(keyKind(key({ metaKey: true })), "shortcut");
  assert.equal(keyKind(key()), "text");
});

test("Enter: newline on Shift/Alt, ignored on repeat/IME/Cmd while composing, submit lanes", () => {
  assert.equal(enterAction({ event: key({ shiftKey: true }) }), "newline");
  assert.equal(enterAction({ event: key({ altKey: true }) }), "newline");
  assert.equal(enterAction({ event: key({ repeat: true }) }), "ignore");
  assert.equal(enterAction({ event: key({ isComposing: true }) }), "ignore");
  assert.equal(enterAction({ event: key({ keyCode: 229 }) }), "ignore");
  assert.equal(enterAction({ event: key({ metaKey: true, isComposing: true }) }), "ignore");
  assert.equal(enterAction({ event: key({ metaKey: true }) }), "submit-later");
  assert.equal(enterAction({ event: key() }), "submit");
  assert.equal(enterAction({ event: key(), popupOwnsEnter: true }), "popup");
  assert.equal(enterAction({ event: key({ key: "a" }) }), "none");
  assert.equal(submitPriority("submit", true), "next");
  assert.equal(submitPriority("submit-later", true), "later");
  assert.equal(submitPriority("submit-later", false), undefined);
});

// R05: c099c328d :11081-11088 Bi (idle → {stayOnDraft: e && zi()}), cc43287c9 :28620 stayOnDraftHint (Home draft only).
test("Cmd+Enter on the idle Home draft is 'Send and stay here'; Enter and the running lanes are unchanged", () => {
  assert.equal(submitPriority("submit-later", false, { stayOnDraft: true }), "stay");
  assert.equal(submitPriority("submit", false, { stayOnDraft: true }), undefined, "plain Enter still sends and navigates");
  assert.equal(submitPriority("submit-later", false, { stayOnDraft: false }), undefined, "an open session has no stay lane");
  assert.equal(submitPriority("submit-later", true, { stayOnDraft: true }), "later", "while a turn runs ⌘⏎ queues");
  assert.equal(submitPriority("submit", true, { stayOnDraft: true }), "next");
});

test("Escape: swallowed during composition, stops a busy turn once, claimed or interrupting keeps the key", () => {
  const escape = (overrides) => key({ key: "Escape", keyCode: 27, ...overrides });
  assert.equal(escapeAction({ event: escape({ isComposing: true }), running: true }), "swallow");
  assert.equal(escapeAction({ event: escape(), running: true }), "stop");
  assert.equal(escapeAction({ event: escape(), running: true, stopLatched: true }), "none");
  assert.equal(escapeAction({ event: escape(), running: true, interrupting: true }), "none");
  assert.equal(escapeAction({ event: escape(), running: true, escapeClaimed: true }), "none");
  assert.equal(escapeAction({ event: escape(), running: true, popupOpen: true }), "close");
  assert.equal(escapeAction({ event: escape({ defaultPrevented: true }), running: true }), "none");
  assert.equal(escapeAction({ event: escape(), running: false }), "none");
});

// Fidelity F05: the window Escape listener (c099c328d-CbkcmYSW.js:10129-10150) stops a busy turn from any target
// once; claimed, composing, canvas/[role=application] and latched events are left alone.
test("window Escape: stop for a busy, unclaimed Escape; none for claimed, composing, canvas, idle or latched", () => {
  const busy = { key: "Escape", running: true };
  assert.equal(windowEscapeAction(busy), "stop");
  assert.equal(windowEscapeAction({ ...busy, defaultPrevented: true }), "none");
  assert.equal(windowEscapeAction({ ...busy, isComposing: true }), "none");
  assert.equal(windowEscapeAction({ ...busy, keyCode: 229 }), "none");
  assert.equal(windowEscapeAction({ ...busy, targetIsCanvas: true }), "none");
  assert.equal(windowEscapeAction({ ...busy, overlayOpen: true }), "none", "an open menu, dialog or Settings claims Escape");
  assert.equal(windowEscapeAction({ ...busy, latched: true }), "none", "the stop is sent once");
  assert.equal(windowEscapeAction({ ...busy, interrupting: true }), "none");
  assert.equal(windowEscapeAction({ ...busy, panelActive: false }), "none");
  assert.equal(windowEscapeAction({ key: "Escape", running: false }), "none");
  assert.equal(windowEscapeAction({ ...busy, key: "Enter" }), "none");
  const node = (match) => ({ closest: (selector) => (selector === 'canvas, [role="application"]' && match ? {} : null) });
  assert.equal(escapeExemptTarget(node(true)), true); assert.equal(escapeExemptTarget(node(false)), false); assert.equal(escapeExemptTarget(null), false);
});

// c099c328d :11162-11188 ya: plain ArrowUp in an empty editor without a popup tries the dequeue first.
test("empty ArrowUp dequeues only unmodified, not composing, empty and without a popup", () => {
  const up = key({ key: "ArrowUp", keyCode: 38 });
  assert.equal(emptyArrowUpDequeues({ event: up, empty: true }), true);
  assert.equal(emptyArrowUpDequeues({ event: up, empty: false }), false);
  assert.equal(emptyArrowUpDequeues({ event: up, empty: true, popupOpen: true }), false);
  for (const modifier of ["metaKey", "ctrlKey", "altKey", "shiftKey"]) assert.equal(emptyArrowUpDequeues({ event: { ...up, [modifier]: true }, empty: true }), false, modifier);
  assert.equal(emptyArrowUpDequeues({ event: { ...up, isComposing: true }, empty: true }), false);
  assert.equal(emptyArrowUpDequeues({ event: key({ key: "ArrowDown" }), empty: true }), false);
});
