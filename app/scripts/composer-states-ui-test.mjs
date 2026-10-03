import {fillComposer} from './composer-test-helpers.mjs';
// 0.2.81: source skillChip requires a real contenteditable editor; read its serialized draft API, not textarea inputValue.
import { _electron as electron } from "../../tools/node_modules/playwright/index.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileKindIcon } from "../src/file-kind-icon.mjs";

// Composer state families (2.2553.1 c099c328d / shared-11 / cf74bc599 over
// Codex 0.155.1 queue/steer): attachment pills, "@" mentions, queued/steered
// messages, IME/keyboard guards and disabled/busy/disconnected states. Runs
// only after a fresh build with no other GUI suite active; every payload is
// read back from the isolated protocol fixture's request log.
const project = path.resolve(import.meta.dirname, "../..");
const root = path.join(project, "app");
const evidence = path.join(project, "analysis/batch-20260920");
await fs.mkdir(evidence, { recursive: true });
const startedAt = new Date().toISOString();
const directory = path.join(evidence, `composer-states-ui-${startedAt.replaceAll(":", "-")}`);
await fs.mkdir(directory, { recursive: true });
const profile = await fs.mkdtemp(path.join(directory, "profile-"));
const workspace = path.join(profile, "workspace");
await fs.mkdir(path.join(workspace, "src"), { recursive: true });
await fs.mkdir(path.join(workspace, "docs"), { recursive: true });
await fs.writeFile(path.join(workspace, "fixture-a.txt"), "root fixture a\n");
await fs.writeFile(path.join(workspace, "fixture-b.txt"), "root fixture b\n");
await fs.writeFile(path.join(workspace, "src/app.js"), "export const app = 1;\n");
await fs.writeFile(path.join(workspace, "src/index.js"), "export const index = 1;\n");
await fs.writeFile(path.join(workspace, "docs/readme.md"), "# docs\n");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
await fs.writeFile(path.join(workspace, "docs/photo.png"), PNG);
// Fidelity F03: a second folder holding a git repo (main, feature/login, zeta-topic) for the folder and branch pickers.
const pickerRepo = path.join(profile, "picker-repo");
await fs.mkdir(pickerRepo);
const git = (...args) => execFileSync("git", args, { cwd: pickerRepo, env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" }, encoding: "utf8" });
git("init", "-q", "-b", "main"); git("config", "user.name", "Fixture"); git("config", "user.email", "fixture@example.invalid");
await fs.writeFile(path.join(pickerRepo, "README.md"), "picker fixture\n"); git("add", "."); git("commit", "-qm", "Fixture base");
git("branch", "zeta-topic"); git("branch", "feature/login");
// R05 review (wouldBranchSwitchConflict): zeta-topic changes README.md, so §17b's dirty README blocks a switch to it.
git("checkout", "-q", "zeta-topic"); await fs.writeFile(path.join(pickerRepo, "README.md"), "picker fixture\nzeta topic\n"); git("commit", "-qam", "Zeta topic"); git("checkout", "-q", "main");
const glyphs = JSON.parse(await fs.readFile(path.join(root, "src/generated/icons.json"), "utf8"));
const fixtureDirectories = new Set(["src", "docs"]);
const A = "composer-states-A", B = "composer-states-B", C = "composer-states-C", D = "composer-states-D", E = "composer-states-E";
// Fidelity F05: F holds thread/resume (fixture resumeDelayMs) for typing while a session loads; G is a plain
// session for the per-session draft, ↑ dequeue, live picker and window-Escape steps.
const F = "composer-states-F", G = "composer-states-G";
const now = Math.floor(Date.now() / 1000);
const userItem = (id, text) => ({ id, type: "userMessage", content: [{ type: "text", text, text_elements: [] }] });
const textItem = (id, text) => ({ id, type: "agentMessage", text });
const thread = (id, name, extra = {}) => ({ id, name, cwd: workspace, createdAt: now, updatedAt: now, archived: false,
  turns: [{ id: `${id}-turn-0`, status: "completed", items: [userItem(`${id}-user-0`, "Seeded prompt."), textItem(`${id}-answer-0`, "Seeded answer.")] }], ...extra });
await fs.writeFile(path.join(profile, "composer-states-fixture.marker"), "isolated-composer-states-test\n");
await fs.writeFile(path.join(profile, "preferences.json"), JSON.stringify({
  cwd: workspace, theme: "light", mode: "code", model: "fixture", effort: "low", threadIds: [A, C, D, E, F, G], archivedThreadIds: [B], sidebarWidth: 288, displayName: "Fixture",
  threadMetadata: { [B]: { id: B, name: "Archived composer", cwd: workspace, createdAt: now - 10, updatedAt: now - 10 } },
}));
// 0.2.120: the fixture model carries a Codex ModelServiceTier named Fast (codex-server.cjs model/list knob) so ⌥⌘F
// has a real tier to toggle; fastMode stays false until section 16 toggles it and restores it.
await fs.writeFile(path.join(profile, "fixture-model-list.json"), JSON.stringify({ fastTierModels: ["fixture"] }));
await fs.writeFile(path.join(profile, "fixture-threads.json"), JSON.stringify({ next: 100, threads: {
  [A]: thread(A, "Composer states A"),
  [B]: thread(B, "Archived composer", { archived: true, updatedAt: now - 10 }),
  [C]: thread(C, "Delayed start", { turnStartDelayMs: 900, updatedAt: now - 5 }),
  [D]: thread(D, "Delayed interrupt", { interruptDelayMs: 600, updatedAt: now - 6 }),
  // 0.2.110 prompt history: two real user turns, oldest first.
  [E]: thread(E, "Prompt history", { updatedAt: now - 7, turns: [
    { id: `${E}-turn-0`, status: "completed", items: [userItem(`${E}-user-0`, "First history prompt."), textItem(`${E}-answer-0`, "First answer.")] },
    { id: `${E}-turn-1`, status: "completed", items: [userItem(`${E}-user-1`, "Second history prompt."), textItem(`${E}-answer-1`, "Second answer.")] }] }),
  [F]: thread(F, "Held resume", { resumeDelayMs: 2500, updatedAt: now - 8 }),
  [G]: thread(G, "Draft session", { updatedAt: now - 9 }),
} }));
const env = { ...process.env, CODE_DESKTOP_DATA: profile, CODEX_BINARY: path.join(root, "tests/fixtures/codex-server.cjs") };
delete env.ELECTRON_RUN_AS_NODE; delete env.CODE_DESKTOP_DEV_URL;
const executablePath = process.env.TEST_ELECTRON_BINARY || path.join(root, "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron");
const checks = [], metrics = {}, rendererErrors = [];
let app, page, build, failure, runtime, profileRemoved = false;
const testSources = ["scripts/composer-test-helpers.mjs", "scripts/composer-states-ui-test.mjs", "tests/fixtures/codex-server.cjs"];
let testSourceHashes;
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
async function verifySource() {
  assert.ok(build && Array.isArray(build.sources) && build.sources.length, "Build must contain a source manifest");
  assert.equal(sha(JSON.stringify(build.sources)), build.sourceSha256, "Build source digest must be internally consistent");
  const current = JSON.parse(await fs.readFile(path.join(root, "dist/build-info.json"), "utf8"));
  assert.equal(current.sourceSha256, build.sourceSha256, "Build changed during this test");
  assert.equal(current.builtAt, build.builtAt, "Build was replaced during this test");
  assert.equal(JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8")).version, build.version, "Package version must match build");
  for (const entry of build.sources) assert.equal(sha(await fs.readFile(path.join(root, entry.path))), entry.sha256, `Build is stale: ${entry.path}`);
  for (const required of ["src/source-composer.jsx", "src/source-composer.css", "src/source-composer-attachments.jsx", "src/source-composer-attachments.css",
    "src/source-mention-dropdown.jsx", "src/source-mention-dropdown.css", "src/source-queued-messages.jsx", "src/source-queued-messages.css",
    "src/composer-attachments-model.mjs", "src/mention-model.mjs", "src/file-kind-icon.mjs", "src/queued-messages-model.mjs", "src/composer-keys-model.mjs", "src/prompt-history-model.mjs", "src/context-usage-model.mjs", "src/chin-shortcuts.mjs", "src/main.jsx", "electron/main.cjs", "electron/preload.cjs", "electron/codex.cjs"])
    assert.ok(build.sources.some(entry => entry.path === required), `Build does not identify ${required}`);
  const hashes = Object.fromEntries(await Promise.all(testSources.map(async file => [file, sha(await fs.readFile(path.join(root, file)))])));
  if (testSourceHashes) assert.deepEqual(hashes, testSourceHashes, "Test or protocol fixture changed during this run");
  else testSourceHashes = hashes;
}
const near = (actual, expected, label, tolerance = .5) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`);
const requestLog = path.join(profile, "fixture-requests.jsonl");
async function requests(method) {
  let text = "";
  try { text = await fs.readFile(requestLog, "utf8"); } catch { return []; }
  return text.split("\n").filter(Boolean).map(line => JSON.parse(line)).filter(entry => !method || entry.method === method);
}
async function readThreads() { return JSON.parse(await fs.readFile(path.join(profile, "fixture-threads.json"), "utf8")); }
async function frames(count = 4) {
  await page.evaluate(count => new Promise(resolve => { const step = () => --count ? requestAnimationFrame(step) : resolve(); requestAnimationFrame(step); }), count);
}
async function open(id, lastItem) {
  await page.locator(`[data-source-session-id="${id}"] .source-session-open`).click();
  await page.locator(`[data-transcript-item-id="${lastItem}"]`).waitFor();
  await page.locator(".loading-state").waitFor({ state: "detached" });
  await page.evaluate(() => document.fonts.ready);
  await frames(6);
}
const editor = () => page.getByRole("textbox", { name: "Message DeepSeek", exact: true });
// cc43287c9-BMbiZYzF.js:28686 placeholder Yn ? 'Type / for commands' : 'Describe a task or ask a question'
// (:27454 Yn = Pn?.id ?? null). The PM editor carries it as data-placeholder and paints it
// through [data-empty=true]::before content: attr(data-placeholder).
const placeholderState = () => page.evaluate(() => { const node = document.querySelector('[data-cds="ChatComposerEditor"]'), before = getComputedStyle(node, "::before");
  return { attr: node.getAttribute("data-placeholder"), empty: node.dataset.empty, painted: before.content, value: node.value }; });
async function expectPlaceholder(text, label) {
  await page.waitForFunction(text => document.querySelector('[data-cds="ChatComposerEditor"]')?.getAttribute("data-placeholder") === text, text);
  const state = await placeholderState();
  assert.deepEqual(state, { attr: text, empty: "true", painted: JSON.stringify(text), value: "" }, label);
  return state;
}
const errorText = async () => (await page.locator(".composer-error span").first().textContent().catch(() => "")) || "";
async function dismissError() {
  const dismiss = page.getByRole("button", { name: "Dismiss error", exact: true });
  if (await dismiss.count()) await dismiss.click();
  await page.locator(".composer-error").waitFor({ state: "detached" });
}
// Paste/drop lane: in-page File objects (no native path) exactly as Chromium
// hands clipboard images to the renderer; the main process persists them.
async function pasteFiles(files) {
  return page.evaluate(async files => {
    const list = files.map(file => new File([file.bytes ? Uint8Array.from(atob(file.bytes), c => c.charCodeAt(0)) : new Uint8Array(file.size)], file.name, { type: file.type }));
    const transfer = new DataTransfer();
    for (const file of list) transfer.items.add(file);
    const target = document.querySelector(".sc-input");
    const event = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: transfer });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  }, files);
}
async function keydown(init) {
  return page.evaluate(init => {
    const target = document.querySelector(".sc-input");
    const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return { defaultPrevented: event.defaultPrevented };
  }, init);
}
async function waitCount(method, count) {
  await page.waitForFunction(() => true);
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) { if ((await requests(method)).length >= count) return; await new Promise(resolve => setTimeout(resolve, 60)); }
  assert.fail(`${method} did not reach ${count} requests`);
}
// 0.2.103 usage trigger (c360a9e1c-GPs-MV9u.js:4065-4295 hd/_d; shared-14-BOJVa-jT.js:9700-9793 xT/ST/dT):
// ghost icon-only button whose aria-label is Se and whose icon is the 12px xT ring.
const usageTrigger = () => page.locator(".sc-chin .sc-usage-trigger");
async function usageRing() {
  await page.waitForFunction(() => document.querySelector(".sc-usage-trigger .sc-context-ring-value")?.getAnimations().every(animation => animation.playState === "finished"));
  return page.evaluate(() => {
    const button = document.querySelector(".sc-chin .sc-usage-trigger"), svg = button.querySelector("svg"), circles = [...svg.querySelectorAll("circle")], value = circles[1], box = svg.getBoundingClientRect();
    const resolve = variable => { const probe = document.createElement("span"); probe.style.color = `var(${variable})`; document.body.appendChild(probe); const color = getComputedStyle(probe).color; probe.remove(); return color; };
    return { label: button.getAttribute("aria-label"), title: button.getAttribute("title"), circles: circles.length, hidden: svg.getAttribute("aria-hidden"), viewBox: svg.getAttribute("viewBox"),
      width: box.width, height: box.height, rotate: getComputedStyle(svg).rotate, button: [button.getBoundingClientRect().width, button.getBoundingClientRect().height],
      radius: circles.map(circle => Number(circle.getAttribute("r"))), strokeWidth: circles.map(circle => Number(circle.getAttribute("stroke-width"))),
      dasharray: Number(value?.getAttribute("stroke-dasharray")), offset: Number(value?.getAttribute("stroke-dashoffset")), computedOffset: parseFloat(getComputedStyle(value).strokeDashoffset),
      linecap: getComputedStyle(value).strokeLinecap, stroke: getComputedStyle(value).stroke, track: getComputedStyle(circles[0]).stroke,
      transition: [getComputedStyle(value).transitionProperty, getComputedStyle(value).transitionDuration],
      accent: resolve("--cds-fill-accent"), alpha2: resolve("--cds-alpha-2") };
  });
}
const stopButton = () => page.getByRole("button", { name: "Stop response", exact: true });
const sendButton = () => page.getByRole("button", { name: "Send message", exact: true });
// 0.2.112 c099c328d sm crossfade: the outgoing Send/Stop layer stays mounted (inert, aria-hidden, om)
// until its own visibility transition ends. Role locators already skip it; raw DOM probes and CSS
// locators must target the active layer (a correction for the shared cell, not a loosening).
const activeSlot = () => page.locator(".sc-submit-layer:not([data-leaving]) .sc-submit-slot");
// Arm a MutationObserver that, the moment the layer holding `leavingLabel` turns [data-leaving],
// records both layers, pauses its transitions and finishes only the opacity one (so the resting
// opacity is read while the 80ms visibility transition — the one that unmounts it — is still held).
async function armSwap(leavingLabel) {
  await page.evaluate(leavingLabel => {
    const cell = document.querySelector(".sc-submit-cell");
    globalThis.__submitSwap = null; globalThis.__submitSwapHeld = [];
    const observer = new MutationObserver(() => {
      const leaving = cell.querySelector(".sc-submit-layer[data-leaving]");
      if (!leaving || leaving.querySelector("button")?.getAttribute("aria-label") !== leavingLabel) return;
      observer.disconnect();
      const entering = cell.querySelector(".sc-submit-layer:not([data-leaving])"), style = getComputedStyle(leaving), enter = getComputedStyle(entering);
      const snapshot = { transition: style.transition, property: style.transitionProperty, duration: style.transitionDuration, delay: style.transitionDelay, pointer: style.pointerEvents };
      const animations = leaving.getAnimations(), opacity = animations.find(animation => animation.transitionProperty === "opacity");
      animations.forEach(animation => animation.pause()); opacity?.finish();
      globalThis.__submitSwapHeld = animations.filter(animation => animation !== opacity);
      globalThis.__submitSwapEnds = [];
      leaving.addEventListener("transitionend", event => { if (event.target === leaving) globalThis.__submitSwapEnds.push(event.propertyName); });
      globalThis.__submitSwap = { leaving: { label: leavingLabel, inert: leaving.hasAttribute("inert"), hidden: leaving.getAttribute("aria-hidden"), ...snapshot,
          opacity: getComputedStyle(leaving).opacity, visibility: getComputedStyle(leaving).visibility, held: globalThis.__submitSwapHeld.map(animation => animation.transitionProperty) },
        entering: { label: entering.querySelector("button")?.getAttribute("aria-label"), entering: entering.hasAttribute("data-entering"), inert: entering.hasAttribute("inert"),
          animation: enter.animationName, duration: enter.animationDuration, delay: enter.animationDelay, fill: enter.animationFillMode, easing: enter.animationTimingFunction } };
    });
    observer.observe(cell, { subtree: true, childList: true, attributes: true });
  }, leavingLabel);
}
async function swapSnapshot() { await page.waitForFunction(() => globalThis.__submitSwap); return page.evaluate(() => globalThis.__submitSwap); }
// Release the held visibility transition; its transitionend (e.target===currentTarget, propertyName
// 'visibility') is the only thing that unmounts the outgoing layer. Before releasing, a layer-level
// 'opacity' transitionend and a bubbled 'visibility' one from the button must both leave it mounted.
async function releaseSwap() {
  await page.evaluate(() => { const leaving = document.querySelector(".sc-submit-layer[data-leaving]");
    leaving.dispatchEvent(new TransitionEvent("transitionend", { bubbles: true, propertyName: "opacity" }));
    leaving.querySelector("button").dispatchEvent(new TransitionEvent("transitionend", { bubbles: true, propertyName: "visibility" })); });
  await frames(4);
  const present = await page.evaluate(() => !!document.querySelector(".sc-submit-layer[data-leaving]"));
  await page.evaluate(() => globalThis.__submitSwapHeld.forEach(animation => animation.play()));
  await page.waitForFunction(() => !document.querySelector(".sc-submit-layer[data-leaving]"));
  return page.evaluate(present => ({ present, last: globalThis.__submitSwapEnds.at(-1), layers: document.querySelectorAll(".sc-submit-cell > .sc-submit-layer").length }), present);
}
// Idle = no Stop control, no pending send (the fixture's turn/start log line is
// written before the renderer has the response, so the spinner is the gate).
async function idle() { await stopButton().waitFor({ state: "detached" }); await page.waitForFunction(() => !document.querySelector(".sc-spinner")); await page.locator('[data-transcript-status="idle"], .source-transcript-status').first().waitFor({ state: "attached" }).catch(() => {}); }
try {
  build = JSON.parse(await fs.readFile(path.join(root, "dist/build-info.json"), "utf8"));
  await verifySource();
  app = await electron.launch({ executablePath, args: [root], env });
  runtime = await app.evaluate(({ app }) => ({ version: app.getVersion(), electron: process.versions.electron, chrome: process.versions.chrome }));
  assert.equal(runtime.version, build.version, "Runtime version must match the verified source build");
  page = await app.firstWindow();
  page.setDefaultTimeout(12000);
  page.on("pageerror", error => rendererErrors.push(error.message));
  await page.locator(`[data-source-session-id="${A}"]`).waitFor();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1324, 768));
  await page.waitForFunction(() => innerWidth === 1324 && innerHeight === 768);
  await page.mouse.move(100, 700);
  await open(A, `${A}-answer-0`);

  // 0.2.103: a resumed session without tokenUsage has hd ie=false → ge/Se 'Usage', le 0 (empty xT ring).
  metrics.usageBefore = await usageRing();
  assert.equal(metrics.usageBefore.label, "Usage"); assert.equal(metrics.usageBefore.title, null);
  assert.equal(metrics.usageBefore.circles, 2); assert.equal(metrics.usageBefore.hidden, "true"); assert.equal(metrics.usageBefore.viewBox, "0 0 12 12");
  near(metrics.usageBefore.width, 12, "ring svg width", .01); near(metrics.usageBefore.height, 12, "ring svg height", .01);
  assert.equal(metrics.usageBefore.rotate, "-90deg"); assert.deepEqual(metrics.usageBefore.radius, [5, 5]); assert.deepEqual(metrics.usageBefore.strokeWidth, [2, 2]);
  near(metrics.usageBefore.offset, 2 * Math.PI * 5, "empty ring dashoffset = C", .05); near(metrics.usageBefore.dasharray, 2 * Math.PI * 5, "ring dasharray = C", .05);
  assert.equal(metrics.usageBefore.stroke, metrics.usageBefore.accent); assert.equal(metrics.usageBefore.track, metrics.usageBefore.alpha2);
  assert.equal(metrics.usageBefore.linecap, "round"); assert.deepEqual(metrics.usageBefore.transition, ["stroke-dashoffset", "0.3s"]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  metrics.usageReducedMotion = (await usageRing()).transition;
  await page.emulateMedia({ reducedMotion: null });
  assert.equal(metrics.usageReducedMotion[0], "none", "prefers-reduced-motion disables the ring transition");
  checks.push("0.2.103 usage trigger before any turn: aria-label 'Usage', 12×12 aria-hidden xT svg rotated -90deg with 2 r=5 stroke-2 circles, empty ring (dashoffset = 2π·5), --cds-fill-accent over --cds-alpha-2, 300ms dashoffset transition that reduced motion disables");

  // shared-14:19954 setEditable drives contenteditable, not textarea.disabled; preserve true/false expectations.
  // 1. Baseline geometry with no attachments and no queue bar.
  metrics.baseline = await page.evaluate(() => {
    const card = document.querySelector(".sc-composer"), chin = document.querySelector(".sc-chin"), leading = chin.querySelector(".sc-chin-leading");
    const add = leading.querySelector(':scope > [aria-label="Add"]').getBoundingClientRect(), mode = leading.querySelector(':scope > [aria-label="Permission mode"]').getBoundingClientRect();
    return { card: card.getBoundingClientRect().height, chin: chin.getBoundingClientRect().height,
      dictation: { nodes: chin.querySelectorAll('.sc-dictation, [data-cds="SplitDropdownButton"]').length,
        named: [...document.querySelectorAll(".sc-composer button, .sc-chin button")].filter(button => /^Dictat/.test(button.getAttribute("aria-label") ?? "")).length },
      leading: [...leading.children].map(node => node.getAttribute("aria-label")), leadingGap: getComputedStyle(leading).columnGap, addToMode: mode.left - add.right,
      attachments: document.querySelector("[data-cds-composer-attachments]"), queued: document.querySelector("[data-queued-messages]"), disabled: card.hasAttribute("data-disabled"), editorDisabled: !document.querySelector(".sc-input").isContentEditable };
  });
  near(metrics.baseline.card, 40, "empty composer card height"); near(metrics.baseline.chin, 20, "chin height");
  // 0.2.113 product correction (not a loosened check): c360a9e1c:4892-4907 bH{…empty:hidden gap-xs} holds only
  // nf, which returns null for hideDictation (:5067-5095; Code hideDictation:!dictationEnabled, cc43287c9:36836).
  // No dictation here → no SplitDropdownButton, no 'Dictate', and the leading slot is exactly [Add, Mode]. The
  // resolved gap is the shared-11 cu leading slot's ('flex items-center self-start', no gap class → 0px); gap-xs
  // only spaces children inside the hidden bH cluster.
  assert.deepEqual(metrics.baseline.dictation, { nodes: 0, named: 0 }, "no dictation control when the client has no dictation");
  assert.deepEqual(metrics.baseline.leading, ["Add", "Permission mode"], "chin leading children are exactly Add then Mode");
  assert.equal(metrics.baseline.leadingGap, "0px", "cu leading slot has no gap");
  near(metrics.baseline.addToMode, parseFloat(metrics.baseline.leadingGap), "Mode.left - Add.right equals the resolved leading gap", .5);
  assert.equal(metrics.baseline.attachments, null); assert.equal(metrics.baseline.queued, null);
  assert.equal(metrics.baseline.disabled, false); assert.equal(metrics.baseline.editorDisabled, false);
  // 0.2.112 c099c328d ga/Nh/Fh/jh: the empty-draft Send is disabled but not faded (Fh opacity-100),
  // its ArrowReturn turns --cds-text-disabled, aria-keyshortcuts nn('enter') = 'Enter', and the
  // non-compact jh ::before extends the hit box 10px up/right/down without changing the 40px card.
  metrics.disabledSend = await page.evaluate(() => {
    const cell = document.querySelector(".sc-submit-cell"), button = cell.querySelector('[aria-label="Send message"]'), before = getComputedStyle(button, "::before");
    const probe = document.createElement("span"); probe.style.color = "var(--cds-text-disabled)"; document.body.appendChild(probe); const disabledColor = getComputedStyle(probe).color; probe.remove();
    return { layers: cell.querySelectorAll(":scope > .sc-submit-layer").length, entering: cell.querySelector("[data-entering]") !== null, grid: getComputedStyle(cell).display,
      disabled: button.disabled, busy: button.getAttribute("aria-busy"), keys: button.getAttribute("aria-keyshortcuts"), opacity: getComputedStyle(button).opacity,
      icon: getComputedStyle(button.querySelector('[data-cds="Icon"]')).color, disabledColor, glyph: button.querySelector('[data-cds="Icon"]').textContent.codePointAt(0),
      before: { content: before.content, position: before.position, left: before.left, top: before.top, right: before.right, bottom: before.bottom }, position: getComputedStyle(button).position,
      size: [button.getBoundingClientRect().width, button.getBoundingClientRect().height] };
  });
  assert.deepEqual({ ...metrics.disabledSend, icon: undefined, disabledColor: undefined }, { layers: 1, entering: false, grid: "grid", disabled: true, busy: null, keys: "Enter", opacity: "1", icon: undefined, disabledColor: undefined,
    glyph: glyphs.ArrowReturn, before: { content: '""', position: "absolute", left: "0px", top: "-10px", right: "-10px", bottom: "-10px" }, position: "relative", size: [24, 24] });
  assert.equal(metrics.disabledSend.icon, metrics.disabledSend.disabledColor, "disabled Send glyph uses resolved --cds-text-disabled");
  checks.push("0.2.112 disabled empty-draft Send (c099c328d ga): one sm layer on first mount (no fade-in), aria-keyshortcuts 'Enter', opacity 1 (Fh), ArrowReturn in --cds-text-disabled, 24×24 with a jh ::before hit box at 0/-10/-10/-10");
  checks.push("Connected session: 40px card, 20px chin, no dictation control (c360a9e1c:4893-4907 hideDictation branch: no SplitDropdownButton, no Dictate), chin leading exactly [Add, Permission mode] with Mode.left - Add.right = resolved leading gap 0px, no attachment slot or queue bar mounted");
  metrics.placeholderSession = await expectPlaceholder("Type / for commands", "an existing session's empty composer shows the Yn copy");
  checks.push("0.2.98: the empty composer of an existing session paints 'Type / for commands' (cc43287c9 :28686 Yn branch) via data-placeholder + [data-empty=true]::before");

  // 2. Paste a PNG: loading pill with role=status settles to ready with a real staged path.
  // Record the actual loading DOM transition before paste. Fast disk staging can
  // finish between two Playwright evaluations; sampling only afterwards misses
  // a real intermediate state. This neither injects a pill nor delays staging.
  await page.evaluate(()=>{
    globalThis.composerLoadingSeen=null;
    globalThis.composerLoadingObserver=new MutationObserver(()=>{
      const status=document.querySelector('[data-cds-attachment] [role="status"]');
      if(status)globalThis.composerLoadingSeen=status.textContent;
    });
    globalThis.composerLoadingObserver.observe(document.querySelector('.sc-composer'),{childList:true,subtree:true});
  });
  const pastePrevented = await pasteFiles([{ name: "pasted.png", type: "image/png", bytes: PNG.toString("base64") }]);
  assert.equal(pastePrevented, true, "image paste is consumed by the composer");
  await page.waitForFunction(()=>globalThis.composerLoadingSeen!==null);
  const loadingSeen=await page.evaluate(()=>{globalThis.composerLoadingObserver.disconnect();delete globalThis.composerLoadingObserver;return globalThis.composerLoadingSeen;});
  metrics.pasteLoading = loadingSeen;
  assert.equal(loadingSeen, "Processing image", "the pill starts in the loading state with the sr-only status text");
  await page.locator('[data-cds-attachment][data-status="ready"]').waitFor();
  const pasted = await page.locator("[data-cds-attachment]").first().evaluate(node => ({ kind: node.dataset.kind, status: node.dataset.status, img: !!node.querySelector("img"), src: node.querySelector("img")?.getAttribute("src") }));
  assert.equal(pasted.kind, "image"); assert.equal(pasted.status, "ready"); assert.equal(pasted.img, true);
  const stagedFiles = await fs.readdir(path.join(profile, "attachments"));
  assert.equal(stagedFiles.length, 1, "one staged clipboard image on disk");
  assert.equal((await fs.readFile(path.join(profile, "attachments", stagedFiles[0]))).equals(PNG), true, "staged bytes are the pasted PNG");
  metrics.staged = stagedFiles[0];
  // Text paste is unaffected: a plain text paste does not create a pill.
  await editor().focus();
  await page.evaluate(() => {
    const transfer = new DataTransfer(); transfer.setData("text/plain", "plain text paste");
    document.querySelector(".sc-input").dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: transfer }));
  });
  assert.equal(await page.locator("[data-cds-attachment]").count(), 1, "text paste creates no pill");
  checks.push("Pasting clipboardData.files=[image/png] stages one loading pill (role=status 'Processing image') that settles to ready once the main process persisted the real file; text paste is unaffected");

  // 3. Add files or photos through the (patched) native dialog: image with a path + a document file.
  await app.evaluate(({ dialog }, paths) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: paths }); }, [path.join(workspace, "docs/photo.png"), path.join(workspace, "docs/readme.md")]);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  // The Add menu is a CDS Menu (c752b32f8 yr: submenus + footer rows), not a
  // dialog: since the Skills/Plugins submenus landed it renders as role=menu "Add".
  await page.getByRole("menu", { name: "Add", exact: true }).waitFor();
  // R05 (c099c328d :8052-8330 em = [Qp, ...Kp, ...Hp]): Add files or photos, Add folder, Slash commands, then the
  // Skills/Plugins submenus, with no separators between the plain rows and no 'Mention a file' row.
  metrics.addMenu = await page.getByRole("menu", { name: "Add", exact: true }).evaluate((menu) => ({
    rows: [...menu.querySelectorAll('[role^="menuitem"]')].map((node) => node.querySelector(".smenu-label")?.textContent ?? node.textContent),
    separators: [...menu.querySelectorAll('[role="separator"]')].length }));
  assert.deepEqual(metrics.addMenu.rows.slice(0, 3), ["Add files or photos", "Add folder", "Slash commands"]);
  assert.equal(metrics.addMenu.rows.includes("Mention a file"), false, "no invented 'Mention a file' row");
  assert.equal(metrics.addMenu.separators, 0, "no separators between the Add rows");
  checks.push("R05 Add menu order: Add files or photos, Add folder, Slash commands (then Skills/Plugins), no separators and no 'Mention a file'");
  await page.getByRole("menuitem", { name: "Add files or photos", exact: true }).click();
  await page.locator("[data-cds-attachment]").nth(2).waitFor();
  // The enter transition (scale .92 → 1 over 180ms) must settle before geometry is read.
  await page.waitForFunction(() => [...document.querySelectorAll("[data-cds-attachment], [data-cds-composer-attachments]")].every(node => getComputedStyle(node).transform === "none" && getComputedStyle(node).opacity === "1"));
  // The menuitem click leaves the pointer where the new pills land, so
  // .sca-pill:hover starts the 180ms remove-control fade (read mid-way as
  // 0.849 in 0.2.94–0.2.98 runs). Park the pointer at the suite's neutral
  // spot and let those transitions finish so the resting opacity is measured.
  await page.mouse.move(100, 700);
  await page.waitForFunction(() => [...document.querySelectorAll("[data-cds-attachment] .epitaxy-pill-remove")].every(node => node.getAnimations().length === 0));
  metrics.slot = await page.evaluate(() => {
    const slot = document.querySelector("[data-cds-composer-attachments]"), strip = slot.firstElementChild;
    const probe = document.createElement("span"); probe.style.background = "var(--cds-alpha-2)"; document.body.appendChild(probe);
    const alpha2 = getComputedStyle(probe).backgroundColor; probe.remove();
    const pills = [...document.querySelectorAll("[data-cds-attachment]")].map(node => {
      const body = node.querySelector(".epitaxy-pill-body"), remove = node.querySelector(".epitaxy-pill-remove");
      const box = body.getBoundingClientRect(), wrap = node.getBoundingClientRect(), removeBox = remove.getBoundingClientRect();
      const img = node.querySelector("img");
      return { kind: node.dataset.kind, width: box.width, height: box.height, background: getComputedStyle(body).backgroundColor, shadow: getComputedStyle(body).boxShadow,
        img: img ? getComputedStyle(img).objectFit : null, extension: node.querySelector(".sca-extension")?.textContent ?? null,
        remove: { width: removeBox.width, height: removeBox.height, top: removeBox.top - wrap.top, right: wrap.right - removeBox.right, opacity: getComputedStyle(remove).opacity,
          duration: getComputedStyle(remove).transitionDuration, label: remove.getAttribute("aria-label"), tabindex: remove.getAttribute("tabindex") } };
    });
    return { padding: getComputedStyle(slot).padding, gap: getComputedStyle(strip).gap, slotTransition: getComputedStyle(slot).transitionDuration, alpha2, pills };
  });
  assert.equal(metrics.slot.padding, "4px 4px 10px"); assert.equal(metrics.slot.gap, "4px");
  assert.equal(metrics.slot.pills.length, 3);
  for (const pill of metrics.slot.pills) {
    near(pill.width, 40, `${pill.kind} pill width`); near(pill.height, 40, `${pill.kind} pill height`);
    near(pill.remove.width, 16, "remove width"); near(pill.remove.height, 16, "remove height");
    near(pill.remove.top, -6, "remove top offset"); near(pill.remove.right, -6, "remove right offset");
    assert.equal(pill.remove.opacity, "0"); assert.equal(pill.remove.duration, "0.18s"); assert.equal(pill.remove.tabindex, "-1");
  }
  const filePill = metrics.slot.pills.find(pill => pill.kind === "file");
  assert.equal(filePill.background, metrics.slot.alpha2, "file pill uses var(--cds-alpha-2)"); assert.equal(filePill.shadow, "none");
  assert.equal(filePill.extension, "md"); assert.equal(filePill.remove.label, "Remove readme.md");
  assert.ok(metrics.slot.pills.filter(pill => pill.kind === "image").every(pill => pill.img === "cover"), "image pills render an object-fit cover img");
  await page.locator("[data-cds-attachment]").nth(1).hover();
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelectorAll("[data-cds-attachment] .epitaxy-pill-remove")[1]).opacity) === 1);
  await page.mouse.move(100, 700);
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelectorAll("[data-cds-attachment] .epitaxy-pill-remove")[1]).opacity) === 0);
  checks.push("Attachment slot padding 4/4/10 with a 4px strip; 40x40 pills (quiet file pill = alpha-2, no shadow, lowercase extension; image pills object-fit cover); 16px remove control at -6/-6 with 0→1 hover opacity over 180ms, tabindex -1 and 'Remove {name}'");

  // 3b. R06 pill click (c099c328d :3143-3160 Ue → Za, :3542-3590 Kl/ql → Gl): the pasted image pill opens the
  // image viewer on its own preview; Escape closes it and focus returns to the pill. A .txt pill opens in the
  // Files pane; it and the pane are removed again so the later steps see the same three pills.
  const pastedPill = page.locator('[data-cds-attachment][data-kind="image"]').first();
  const pastedPreview = await pastedPill.locator("img").getAttribute("src");
  await pastedPill.locator(".epitaxy-pill-body").click();
  const imageViewer = page.getByRole("dialog", { name: "pasted.png", exact: true });
  await imageViewer.waitFor();
  metrics.attachmentViewer = await imageViewer.evaluate(node => ({ src: node.querySelector("img")?.getAttribute("src"), alt: node.querySelector("img")?.getAttribute("alt"),
    close: !!node.querySelector('button[aria-label="Close image preview"]'), annotate: !!node.querySelector('[aria-label="Annotate image"]'), modal: node.getAttribute("aria-modal") }));
  assert.equal(metrics.attachmentViewer.src, pastedPreview, "the viewer shows the pill's preview");
  assert.deepEqual([metrics.attachmentViewer.alt, metrics.attachmentViewer.close, metrics.attachmentViewer.annotate, metrics.attachmentViewer.modal], ["pasted.png", true, false, "true"]);
  await page.screenshot({ path: path.join(directory, "attachment-viewer.png") });
  await page.keyboard.press("Escape");
  await imageViewer.waitFor({ state: "detached" });
  assert.equal(await pastedPill.locator(".epitaxy-pill-body").evaluate(node => node === document.activeElement), true, "Escape returns focus to the pill");
  await app.evaluate(({ dialog }, paths) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: paths }); }, [path.join(workspace, "fixture-a.txt")]);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("menu", { name: "Add", exact: true }).waitFor();
  await page.getByRole("menuitem", { name: "Add files or photos", exact: true }).click();
  const textPill = page.locator('[data-cds-attachment][data-kind="file"]').filter({ has: page.locator(".sca-extension", { hasText: /^txt$/ }) });
  await textPill.waitFor();
  await textPill.locator(".epitaxy-pill-body").click();
  await page.getByRole("complementary", { name: "Files panel", exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('.source-file-tab[data-file-path$="fixture-a.txt"]'));
  metrics.attachmentFileOpened = await page.locator('.source-file-tab[data-file-path$="fixture-a.txt"]').first().getAttribute("data-file-path");
  await page.getByRole("button", { name: "Close panel", exact: true }).click();
  await page.locator(".source-side-tile").waitFor({ state: "detached" });
  await textPill.hover();
  await textPill.locator(".epitaxy-pill-remove").click();
  await page.mouse.move(100, 700);
  await page.waitForFunction(() => document.querySelectorAll("[data-cds-attachment]").length === 3);
  checks.push("R06 pill click: the pasted image pill opens a role=dialog image viewer (img src = the pill preview, alt pasted.png, 'Close image preview', no Annotate); Escape closes it with focus back on the pill; a .txt pill opens fixture-a.txt in the Files pane");

  // 4. Validation toasts on the image lane: .bmp, 31457281 bytes, cap of five.
  await pasteFiles([{ name: "shot.bmp", type: "image/bmp", size: 16 }]);
  await page.locator(".composer-error").waitFor();
  assert.equal(await errorText(), "Only PNG, JPEG, GIF, and WebP images are supported.");
  assert.equal(await page.locator("[data-cds-attachment]").count(), 3, "no pill for a .bmp");
  await dismissError();
  await pasteFiles([{ name: "huge.png", type: "image/png", size: 31457281 }]);
  await page.locator(".composer-error").waitFor();
  assert.equal(await errorText(), "Some images were too large to attach. Maximum size is 30 MB.");
  assert.equal(await page.locator("[data-cds-attachment]").count(), 3, "no pill for an oversized PNG");
  await dismissError();
  // Two images are staged; four more pasted at once → cap of five keeps three, drops one.
  await pasteFiles(["c1", "c2", "c3", "c4"].map(name => ({ name: `${name}.png`, type: "image/png", bytes: PNG.toString("base64") })));
  await page.locator(".composer-error").waitFor();
  assert.equal(await errorText(), "Removed 1 image — this session allows up to 5.");
  await page.waitForFunction(() => document.querySelectorAll('[data-cds-attachment][data-kind="image"][data-status="ready"]').length === 5);
  assert.equal(await page.locator("[data-cds-attachment]").count(), 6, "five images plus the file reference");
  await dismissError();
  // Remove the three extra images through the hover-revealed control.
  for (let index = 0; index < 3; index++) {
    const pill = page.locator('[data-cds-attachment][data-kind="image"]').last();
    await pill.hover();
    await pill.locator(".epitaxy-pill-remove").click();
  }
  assert.equal(await page.locator("[data-cds-attachment]").count(), 3);
  checks.push("Image lane validation: .bmp → type toast, 31457281-byte PNG → 30 MB toast, sixth image dropped with 'Removed 1 image — this session allows up to 5.'; the hover-revealed remove control removes pills");

  // 5. "@" mention dropdown: geometry, roles, keyboard acceptance, IME guard, Escape.
  // The popup opens above the caret; park the pointer far away so no option is hovered.
  await page.mouse.move(900, 120);
  await fillComposer(page,editor(),"Please read @fix");
  const dropdown = page.locator('[data-cds="MentionDropdown"]');
  await dropdown.waitFor();
  metrics.mention = await page.evaluate(() => {
    const list = document.querySelector('[data-cds="MentionDropdown"]'), popup = list.parentElement, textarea = document.querySelector(".sc-input");
    const box = popup.getBoundingClientRect(), text = textarea.getBoundingClientRect();
    const caretLineTop = text.top + parseFloat(getComputedStyle(textarea).paddingTop);
    return { role: list.getAttribute("role"), label: list.getAttribute("aria-label"), testid: popup.getAttribute("data-testid"), width: box.width, height: box.height,
      maxHeight: getComputedStyle(popup).maxHeight, bottomGap: caretLineTop - box.bottom, padding: getComputedStyle(list).padding,
      options: [...list.querySelectorAll('[role="option"]')].map(node => ({ index: node.dataset.optionIndex, selected: node.getAttribute("aria-selected"), label: node.querySelector(".smd-label").textContent, description: node.querySelector(".smd-description")?.textContent ?? null, icon: !!node.querySelector('[data-cds="Icon"]'), glyph: node.querySelector('.smd-leading [data-cds="Icon"]')?.textContent ?? null, glyphSize: node.querySelector('.smd-leading [data-cds="Icon"]') ? getComputedStyle(node.querySelector('.smd-leading [data-cds="Icon"]')).fontSize : null, title: node.getAttribute("title") })) };
  });
  assert.equal(metrics.mention.role, "listbox"); assert.equal(metrics.mention.label, "Mention suggestions"); assert.equal(metrics.mention.testid, "mention-dropdown");
  near(metrics.mention.width, 420, "root-level results keep the 420px base width");
  assert.ok(parseFloat(metrics.mention.maxHeight) <= 384 && metrics.mention.height <= 384, "max-height capped at 384px");
  near(metrics.mention.bottomGap, 24, "popup bottom sits 24px above the caret line", 1);
  assert.equal(metrics.mention.padding, "4px");
  assert.deepEqual(metrics.mention.options.map(option => option.label).sort(), ["fixture-a.txt", "fixture-b.txt"]);
  assert.equal(metrics.mention.options[0].selected, "true"); assert.equal(metrics.mention.options[0].index, "0");
  assert.ok(metrics.mention.options.every(option => option.icon && option.description === null));
  // 0.2.97 Ip su leading icon: Folder for directories else shared-14 cP(label) at 16px; Bx gives no native title.
  const expectGlyphs = options => { for (const option of options) {
    assert.equal(option.title, null, `${option.label} has no native title`); assert.equal(option.glyphSize, "16px", `${option.label} keeps the 16px leading icon`);
    assert.equal(option.glyph, String.fromCodePoint(glyphs[fixtureDirectories.has(option.label) ? "Folder" : fileKindIcon(option.label)]), `${option.label} leading glyph`); } };
  expectGlyphs(metrics.mention.options);
  await fillComposer(page,editor(),"Please read @docs/");
  await page.waitForFunction(() => [...document.querySelectorAll('[data-cds="MentionDropdown"] .smd-label')].some(node => node.textContent === "photo.png"));
  metrics.mentionKinds = await page.evaluate(() => [...document.querySelectorAll('[data-cds="MentionDropdown"] [role="option"]')].map(node => ({ label: node.querySelector(".smd-label").textContent,
    glyph: node.querySelector('.smd-leading [data-cds="Icon"]').textContent, glyphSize: getComputedStyle(node.querySelector('.smd-leading [data-cds="Icon"]')).fontSize, title: node.getAttribute("title") })));
  expectGlyphs(metrics.mentionKinds);
  assert.ok(["readme.md", "photo.png"].every(label => metrics.mentionKinds.some(option => option.label === label)), "docs results list readme.md (Note) and photo.png (Image)");
  assert.deepEqual(["Note", "Image"].map(name => metrics.mentionKinds.find(option => option.label === (name === "Note" ? "readme.md" : "photo.png")).glyph), [String.fromCodePoint(glyphs.Note), String.fromCodePoint(glyphs.Image)]);
  // Nested results carry a directory description → wide (560px).
  await fillComposer(page,editor(),"Please read @src");
  await page.waitForFunction(() => document.querySelector('[data-cds="MentionDropdown"] .smd-description'));
  metrics.mentionWide = await page.evaluate(() => { const popup = document.querySelector('[data-cds="MentionDropdown"]').parentElement; return { width: popup.getBoundingClientRect().width, descriptions: [...popup.querySelectorAll(".smd-description")].map(node => node.textContent) }; });
  near(metrics.mentionWide.width, 560, "nested results with descriptions use the 560px wide width");
  assert.deepEqual([...new Set(metrics.mentionWide.descriptions)], ["src"]);
  // Bx tooltip: hovering an option for >200ms opens a Nu tooltip on the right (sideOffset 8) whose text is the
  // renderedText path with '/' -> '/\u200B'; described options are multiline with a 360px cap.
  const hovered = page.locator('[data-cds="MentionDropdown"] [data-option-index="0"]');
  const hoverBox = await hovered.boundingBox();
  await page.mouse.move(hoverBox.x + 20, hoverBox.y + hoverBox.height / 2);
  const hoverStart = Date.now();
  await page.locator('.source-tooltip-popup[data-state="open"]').waitFor();
  metrics.mentionTooltipDelay = Date.now() - hoverStart;
  await page.waitForFunction(() => document.querySelector('.source-tooltip-popup')?.getAnimations().every(animation => animation.playState === "finished"));
  metrics.mentionTooltip = await page.evaluate(() => {
    const option = document.querySelector('[data-cds="MentionDropdown"] [data-option-index="0"]'), popup = document.querySelector(".source-tooltip-popup");
    const a = option.getBoundingClientRect(), b = popup.getBoundingClientRect();
    return { text: popup.querySelector(".source-tooltip-label").textContent, label: option.querySelector(".smd-label").textContent, description: option.querySelector(".smd-description")?.textContent ?? null,
      side: popup.parentElement.dataset.side, gap: b.left - a.right, multiline: popup.classList.contains("source-tooltip-multiline"), maxWidth: getComputedStyle(popup).maxWidth,
      positionerMaxWidth: getComputedStyle(popup.parentElement).maxWidth, above: getComputedStyle(popup.parentElement).zIndex, dropdownZ: getComputedStyle(option.closest(".smd-positioner")).zIndex,
      hit: document.elementFromPoint(b.left + 4, b.top + b.height / 2)?.closest(".source-tooltip-popup") === popup, title: option.getAttribute("title") };
  });
  assert.ok(metrics.mentionTooltipDelay >= 180, `tooltip waits for the 200ms Bx delay (${metrics.mentionTooltipDelay}ms)`);
  assert.equal(metrics.mentionTooltip.side, "right"); near(metrics.mentionTooltip.gap, 8, "tooltip sits 8px right of the option", 1);
  assert.equal(metrics.mentionTooltip.description, "src");
  assert.equal(metrics.mentionTooltip.text, `src/\u200B${metrics.mentionTooltip.label}`, "tooltip text is the path with a zero-width space after '/'");
  assert.equal(metrics.mentionTooltip.multiline, true); assert.equal(metrics.mentionTooltip.maxWidth, "360px"); assert.equal(metrics.mentionTooltip.positionerMaxWidth, "360px");
  assert.equal(metrics.mentionTooltip.hit, true, "tooltip paints above the mention popup"); assert.equal(metrics.mentionTooltip.title, null);
  await page.screenshot({ path: path.join(directory, "mention-tooltip-light.png") });
  await page.mouse.move(900, 120);
  await page.locator(".source-tooltip-popup").waitFor({ state: "detached" });
  // Enter while composing neither accepts nor submits.
  const before = (await requests("turn/start")).length;
  await keydown({ key: "Enter", isComposing: true });
  await keydown({ key: "Enter", keyCode: 229 });
  await frames(3);
  assert.equal(await dropdown.count(), 1, "dropdown survives an IME Enter");
  assert.equal(await editor().evaluate(node=>node.value), "Please read @src");
  assert.equal((await requests("turn/start")).length, before);
  // Escape closes without inserting; retyping reopens; ArrowDown + Tab inserts the path.
  await page.keyboard.press("Escape");
  await dropdown.waitFor({ state: "detached" });
  assert.equal(await editor().evaluate(node=>node.value), "Please read @src");
  assert.equal(await stopButton().count(), 0, "Escape while idle never issues a stop");
  // The submitted text uses the fixture's completing prefix so the turn ends without an approval.
  await fillComposer(page,editor(),"fixture:complete read @sr");
  await dropdown.waitFor();
  await page.keyboard.press("ArrowDown");
  const highlightedAfterArrow = await page.evaluate(() => document.querySelector('[data-cds="MentionDropdown"] [aria-selected="true"]')?.dataset.optionIndex);
  assert.equal(highlightedAfterArrow, "1");
  // Options carry no native title (Bx); the inserted path is description/label (mentionOptions renderedText).
  const second = await page.evaluate(() => { const node = document.querySelector('[data-cds="MentionDropdown"] [data-option-index="1"]'), label = node.querySelector(".smd-label").textContent, dir = node.querySelector(".smd-description")?.textContent; return dir ? `${dir}/${label}` : label; });
  await page.keyboard.press("Tab");
  await dropdown.waitFor({ state: "detached" });
  assert.equal(await editor().evaluate(node=>node.value), `fixture:complete read @${second} `);
  assert.equal(await page.evaluate(() => document.activeElement?.classList.contains("sc-input")), true, "Tab accepted the mention and kept the editor focused");
  metrics.mentionPath = second;
  // Fidelity F05 (c099c328d-CbkcmYSW.js:10502-10520 Vr; shared-13-Bl2X1oob.js:7882-7958 Aw): the pick is an atomic
  // [data-mention] chip showing the basename in --cds-text-accent with title = the path; the draft text is unchanged.
  const mentionChip = () => page.locator('.sc-input [data-mention]');
  metrics.mentionChip = await mentionChip().evaluate((node) => {
    const label = node.querySelector(".sc-mention-chip-label"), probe = document.createElement("span"); probe.style.color = "var(--cds-text-accent)"; document.body.appendChild(probe);
    const accent = getComputedStyle(probe).color; probe.remove();
    return { path: node.dataset.mention, text: label.textContent, title: label.getAttribute("title"), accent: getComputedStyle(label).color === accent, editable: node.contentEditable,
      display: getComputedStyle(node.querySelector(".sc-mention-chip")).display, chips: document.querySelectorAll(".sc-input [data-mention]").length };
  });
  assert.deepEqual(metrics.mentionChip, { path: second, text: path.basename(second), title: second, accent: true, editable: "false", display: "inline-flex", chips: 1 });
  // A click opens the chip menu (Copy ▸, Open in ▸, Delete); Escape closes it and the draft stays.
  await mentionChip().click();
  const mentionMenu = page.getByRole("menu", { name: "Mention actions", exact: true });
  await mentionMenu.waitFor();
  metrics.mentionMenu = await mentionMenu.evaluate((menu) => [...menu.querySelectorAll('[role^="menuitem"]')].map((node) => {
    const copy = node.cloneNode(true); copy.querySelectorAll('[data-cds="Icon"], [aria-hidden="true"]').forEach((part) => part.remove());
    return [copy.textContent.trim(), node.dataset.variant ?? null]; }));
  assert.deepEqual(metrics.mentionMenu, [["Copy", null], ["Open in", null], ["Delete", "danger"]]);
  assert.equal(await mentionChip().evaluate((node) => node.querySelector(".sc-mention-chip").hasAttribute("data-selected")), true, "the pressed chip is the selected atom (bg-accent)");
  await page.screenshot({ path: path.join(directory, "mention-chip-menu-light.png") });
  await page.keyboard.press("Escape");
  await mentionMenu.waitFor({ state: "detached" });
  await page.waitForFunction(() => document.activeElement?.classList.contains("sc-input"));
  assert.equal(await editor().evaluate(node=>node.value), `fixture:complete read @${second} `);
  checks.push("'@' token opens the listbox 'Mention suggestions' (420px at root, 560px with directory descriptions, ≤384px, 24px above the caret, 4px padding, role=option + data-option-index + aria-selected, 16px leading icon); ArrowDown+Tab inserts '@<path> ', Escape closes without inserting, IME Enter neither accepts nor submits");
  checks.push("F05 mention chip: the Tab pick inserts one contenteditable=false [data-mention] atom (inline-flex, basename label in --cds-text-accent, title = path) while the draft text stays '@<path> '; a click selects it and opens 'Mention actions' [Copy, Open in, Delete(danger)]; Escape closes the menu and refocuses the editor");
  checks.push("0.2.97: each mention option's 16px leading glyph is Folder for directories else shared-14 cP(label) (txt File, js Code, md Note, png Image) with no native title; hovering an option >200ms opens a right-side tooltip 8px away with the path ('/' + U+200B), multiline and 360px wide for described options, painted above the popup, closing when the pointer leaves");

  // 6. Payload: text_elements byte range for the mention plus real localImage/mention items, never 'Attached file:'.
  const draftText = await editor().evaluate(node=>node.value);
  await page.keyboard.press("Enter");
  await waitCount("turn/start", before + 1);
  await idle();
  const started = (await requests("turn/start")).at(-1).params;
  metrics.payload = started.input;
  assert.equal(started.input[0].type, "text"); assert.equal(started.input[0].text, draftText);
  const token = `@${second}`;
  const encoder = new TextEncoder();
  assert.deepEqual(started.input[0].text_elements, [{ byteRange: { start: encoder.encode(draftText.slice(0, draftText.indexOf(token))).length, end: encoder.encode(draftText.slice(0, draftText.indexOf(token) + token.length)).length }, placeholder: null }]);
  assert.deepEqual(started.input.slice(1).map(item => item.type), ["mention", "localImage", "localImage", "mention"]);
  assert.deepEqual(started.input[1], { type: "mention", name: path.basename(second), path: path.join(workspace, second) });
  assert.ok(started.input.some(item => item.type === "localImage" && item.path === path.join(profile, "attachments", metrics.staged)), "pasted image is sent by its staged path");
  assert.ok(started.input.some(item => item.type === "localImage" && item.path === path.join(workspace, "docs/photo.png")));
  assert.deepEqual(started.input.at(-1), { type: "mention", name: "readme.md", path: path.join(workspace, "docs/readme.md") });
  assert.ok(!JSON.stringify(started.input).includes("Attached file"), "no fabricated text item");
  assert.equal(await page.locator("[data-cds-attachment]").count(), 0, "attachments clear after send");
  assert.equal(await editor().evaluate(node=>node.value), "");
  checks.push("turn/start carries the '@path' byte range in text_elements plus {type:'mention'} for it, {type:'localImage'} for the staged/selected images and {type:'mention'} for the chosen document; no 'Attached file:' text and the composer clears");

  // 7. Held Enter submits once; key repeat is guarded.
  const beforeRepeat = (await requests("turn/start")).length;
  await fillComposer(page,editor(),"fixture:complete repeat guard");
  const repeatResult = await page.evaluate(() => {
    const target = document.querySelector(".sc-input");
    const first = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    const second = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, repeat: true });
    target.dispatchEvent(first); target.dispatchEvent(second);
    return { first: first.defaultPrevented, second: second.defaultPrevented };
  });
  await waitCount("turn/start", beforeRepeat + 1);
  await idle();
  await page.waitForTimeout(300);
  assert.equal((await requests("turn/start")).length, beforeRepeat + 1, "held Enter submits exactly once");
  assert.deepEqual(repeatResult, { first: true, second: true });
  checks.push("A repeated Enter keydown is prevented and never resubmits");

  // 8. Queue/steer while a turn runs.
  await fillComposer(page,editor(),"fixture:hold");
  await armSwap("Send message");
  await page.keyboard.press("Enter");
  await stopButton().waitFor();
  // 0.2.112 sm swap Send → Stop: the entering Stop layer runs am (cds-fade-in 0.12s ease-out 0.08s
  // backwards); the Send layer stays mounted inert + aria-hidden with om (opacity 0, opacity 80ms
  // ease-out + visibility 0s linear 80ms) and is dropped only on its visibility transitionend.
  metrics.swapToStop = await swapSnapshot();
  assert.deepEqual(metrics.swapToStop.entering, { label: "Stop response", entering: true, inert: false, animation: "cds-fade-in", duration: "0.12s", delay: "0.08s", fill: "backwards", easing: "ease-out" });
  assert.deepEqual(metrics.swapToStop.leaving, { label: "Send message", inert: true, hidden: "true", transition: "opacity 0.08s ease-out, visibility 0s linear 0.08s",
    property: "opacity, visibility", duration: "0.08s, 0s", delay: "0s, 0.08s", pointer: "none", opacity: "0", visibility: "visible", held: ["visibility"] });
  metrics.swapToStopRelease = await releaseSwap();
  assert.deepEqual(metrics.swapToStopRelease, { present: true, last: "visibility", layers: 1 }, "opacity / bubbled transitionends keep the layer; its own visibility one unmounts it");
  // Ih = Icon 'Stop' size sm text-secondary; aria-keyshortcuts nn('escape') = 'Escape' (nothing claims Escape); jh ::before.
  metrics.stopControl = await stopButton().evaluate(node => {
    const probe = document.createElement("span"); probe.style.color = "var(--cds-text-secondary)"; document.body.appendChild(probe); const secondary = getComputedStyle(probe).color; probe.remove();
    const icon = node.querySelector('[data-cds="Icon"]'), before = getComputedStyle(node, "::before");
    return { glyph: icon.textContent.codePointAt(0), fontSize: getComputedStyle(icon).fontSize, color: getComputedStyle(icon).color === secondary, keys: node.getAttribute("aria-keyshortcuts"),
      before: [before.left, before.top, before.right, before.bottom], size: [node.getBoundingClientRect().width, node.getBoundingClientRect().height] };
  });
  assert.deepEqual(metrics.stopControl, { glyph: glyphs.Stop, fontSize: "16px", color: true, keys: "Escape", before: ["0px", "-10px", "-10px", "-10px"], size: [24, 24] });
  await page.locator(".sc-composer").screenshot({ path: path.join(directory, "stop-control.png") });
  const glyph = metrics.stopControl.glyph;
  // 0.2.112: the source Stop glyph is Ih 'Stop' (57578); the earlier 'StopCircle' expectation encoded the local deviation this batch removes.
  assert.equal(glyph, 57578, "Stop glyph (c099c328d Ih)");
  checks.push("0.2.112 Send → Stop crossfade (c099c328d sm/am/om): entering Stop layer animates cds-fade-in 0.12s ease-out 0.08s backwards; the Send layer stays inert + aria-hidden with pointer-events none, opacity 0 and 'opacity 0.08s ease-out, visibility 0s linear 0.08s', survives its opacity transitionend and unmounts on the visibility one; Stop is Ih 'Stop' 16px text-secondary with aria-keyshortcuts 'Escape' and the 10px jh hit box");
  const activeTurn = (await readThreads()).threads[A].turns.at(-1);
  assert.equal(activeTurn.status, "inProgress");
  // Official Em: the Stop tooltip lists the escape shortcut while nothing else claims Escape.
  await page.mouse.move(100, 700);
  await activeSlot().hover();
  await page.locator(".source-tooltip-popup").waitFor();
  metrics.stopTooltip = await page.locator(".source-tooltip-popup").evaluate(node => ({ label: node.querySelector(".source-tooltip-label")?.textContent ?? node.textContent, shortcuts: [...node.querySelectorAll(".source-tooltip-shortcut")].map(chip => [...chip.querySelectorAll("kbd")].map(kbd => (kbd.querySelector('[aria-hidden="true"]') ?? kbd).textContent).join("")) }));
  assert.equal(metrics.stopTooltip.label, "Stop"); assert.deepEqual(metrics.stopTooltip.shortcuts, ["Esc"]);
  await page.mouse.move(900, 120);
  await page.locator(".source-tooltip-popup").waitFor({ state: "detached" });
  // The "@" lookup must survive the streaming re-renders (App re-renders on every delta).
  await fillComposer(page,editor(),"while streaming @src");
  await dropdown.waitFor();
  await page.waitForFunction(() => document.querySelector('[data-cds="MentionDropdown"] .smd-description'));
  // With content in the editor the Send control has replaced Stop (Ki); the turn itself keeps running.
  assert.equal(await page.locator(".sc-composer").getAttribute("data-busy"), "true", "the card stays busy while the mention popup is open");
  assert.equal((await readThreads()).threads[A].turns.at(-1).status, "inProgress", "the turn keeps running while the mention popup is open");
  await page.keyboard.press("Escape");
  await dropdown.waitFor({ state: "detached" });
  await page.waitForTimeout(200);
  assert.equal((await requests("turn/interrupt")).length, 0, "Escape that closes the mention popup never interrupts");
  assert.equal(await editor().evaluate(node=>node.value), "while streaming @src");
  checks.push("While a turn streams the Stop tooltip reads 'Stop' + 'Esc' and typing '@src' still opens the mention listbox (lookup unaffected by parent re-renders); Escape closes it without interrupting");
  await fillComposer(page,editor(),"steer this");
  // With content while running the Send control replaces Stop and lists both lanes.
  await sendButton().waitFor();
  await page.mouse.move(100, 700);
  await activeSlot().hover();
  await page.locator(".source-tooltip-popup").waitFor();
  metrics.enabledSend = await sendButton().evaluate(node => { const probe = document.createElement("span"); probe.style.color = "var(--cds-text-secondary)"; document.body.appendChild(probe); const secondary = getComputedStyle(probe).color; probe.remove();
    return { disabled: node.disabled, keys: node.getAttribute("aria-keyshortcuts"), opacity: getComputedStyle(node).opacity, secondary: getComputedStyle(node.querySelector('[data-cds="Icon"]')).color === secondary }; });
  assert.deepEqual(metrics.enabledSend, { disabled: false, keys: "Enter", opacity: "1", secondary: true }, "enabled Send keeps Nh text-secondary");
  metrics.runningTooltip = await page.locator(".source-tooltip-popup").evaluate(node => [...node.querySelectorAll(".source-tooltip-label-line")].map(line => ({ label: line.querySelector(".source-tooltip-label").textContent, shortcut: (chip => chip && [...chip.querySelectorAll("kbd")].map(kbd => (kbd.querySelector('[aria-hidden="true"]') ?? kbd).textContent).join(""))(line.querySelector(".source-tooltip-shortcut")) ?? null })));
  // Fidelity F02: the 'enter' / 'cmd+enter' specs draw ⏎ (shared-frame so/co), read from the visible glyphs.
  assert.deepEqual(metrics.runningTooltip, [{ label: "Send", shortcut: "⏎" }, { label: "Queue for later", shortcut: "⌘⏎" }]);
  await page.mouse.move(100, 700);
  await editor().focus();
  await page.keyboard.press("Enter");
  await waitCount("turn/steer", 1);
  const steer = (await requests("turn/steer"))[0].params;
  assert.equal(steer.threadId, A); assert.equal(steer.expectedTurnId, activeTurn.id); assert.equal(steer.input[0].text, "steer this");
  assert.equal(typeof steer.clientUserMessageId, "string");
  await page.waitForFunction(() => document.querySelector(".sc-input").value === "");
  assert.equal(await page.locator("[data-queued-messages]").count(), 0, "a steered message is not queued");
  await fillComposer(page,editor(),"later one");
  await page.keyboard.press("Meta+Enter");
  await waitCount("thread/queue/add", 1);
  const queued = (await requests("thread/queue/add"))[0].params;
  assert.equal(queued.threadId, A); assert.equal(queued.input[0].text, "later one"); assert.equal(typeof queued.clientUserMessageId, "string");
  const bar = page.locator("[data-queued-messages]");
  await bar.waitFor();
  metrics.queueSingle = await bar.evaluate(node => {
    const row = node.querySelector(".sqm-single"), probe = document.createElement("span"); probe.style.background = "var(--cds-alpha-1)"; document.body.appendChild(probe);
    const alpha1 = getComputedStyle(probe).backgroundColor; probe.remove();
    const style = getComputedStyle(row);
    return { height: row.getBoundingClientRect().height, paddingLeft: style.paddingLeft, paddingRight: style.paddingRight, radius: style.borderRadius, background: style.backgroundColor, alpha1, gap: style.gap,
      count: node.querySelector(".sqm-count").textContent, countSize: getComputedStyle(node.querySelector(".sqm-count")).fontSize, countLine: getComputedStyle(node.querySelector(".sqm-count")).lineHeight, countWeight: getComputedStyle(node.querySelector(".sqm-count")).fontWeight,
      preview: node.querySelector(".sqm-preview").textContent, transition: getComputedStyle(node).transitionDuration, timing: getComputedStyle(node).transitionTimingFunction,
      buttons: [...node.querySelectorAll("button")].map(button => ({ label: button.getAttribute("aria-label"), width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })) };
  });
  assert.ok(metrics.queueSingle.height >= 40, "single row is at least 40px");
  assert.equal(metrics.queueSingle.paddingLeft, "12px"); assert.equal(metrics.queueSingle.paddingRight, "12px");
  assert.equal(metrics.queueSingle.radius, "10px"); assert.equal(metrics.queueSingle.background, metrics.queueSingle.alpha1); assert.equal(metrics.queueSingle.gap, "5px");
  assert.equal(metrics.queueSingle.count, "1 message queued"); assert.equal(metrics.queueSingle.countSize, "13px"); assert.equal(metrics.queueSingle.countLine, "19px"); assert.equal(metrics.queueSingle.countWeight, "500");
  assert.equal(metrics.queueSingle.preview, "later one"); assert.equal(metrics.queueSingle.transition, "0.12s");
  assert.deepEqual(metrics.queueSingle.buttons, [{ label: "Edit in composer", width: 24, height: 24 }, { label: "Remove from queue", width: 24, height: 24 }]);
  await fillComposer(page,editor(),"later two");
  await page.keyboard.press("Meta+Enter");
  await waitCount("thread/queue/add", 2);
  await page.locator('[data-queued-messages][data-count="2"]').waitFor();
  const collapsed = page.locator(".sqm-collapsed");
  metrics.queueCollapsed = await collapsed.evaluate(node => ({ expanded: node.getAttribute("aria-expanded"), count: node.querySelector(".sqm-count").textContent, preview: node.querySelector(".sqm-preview").textContent, caret: !!node.querySelector(".sqm-caret [data-cds=\"Icon\"]"), height: node.getBoundingClientRect().height }));
  assert.equal(metrics.queueCollapsed.expanded, "false"); assert.equal(metrics.queueCollapsed.count, "2 messages queued"); assert.equal(metrics.queueCollapsed.preview, "Next: later one");
  assert.ok(metrics.queueCollapsed.caret && metrics.queueCollapsed.height >= 40);
  await collapsed.click();
  const list = page.getByRole("list", { name: "Queued messages", exact: true });
  await list.waitFor();
  metrics.queueExpanded = await page.evaluate(() => {
    const list = document.querySelector('[role="list"][aria-label="Queued messages"]');
    const items = [...list.querySelectorAll('[role="listitem"]')];
    const style = getComputedStyle(list), item = getComputedStyle(items[0]);
    return { maxHeight: style.maxHeight, padding: style.padding, items: items.map(node => node.querySelector(".sqm-item-text").textContent), itemPadding: item.padding, itemGap: item.gap, itemRadius: item.borderRadius, clamp: getComputedStyle(items[0].querySelector(".sqm-item-text")).webkitLineClamp,
      dividers: list.querySelectorAll('[role="presentation"]').length, clear: document.querySelector(".sqm-clear")?.textContent ?? null, clearSize: getComputedStyle(document.querySelector(".sqm-clear")).fontSize,
      collapse: document.querySelector('[aria-label="Collapse queued messages"]')?.getAttribute("aria-expanded") ?? null, handle: items[0].querySelector(".sqm-handle")?.getBoundingClientRect().width ?? null, menu: !!items[0].querySelector('[aria-label="Queued message actions"]') };
  });
  near(parseFloat(metrics.queueExpanded.maxHeight), Math.min(.4 * 768, 352), "list max-height min(40vh, 22rem)", 1);
  assert.equal(metrics.queueExpanded.padding, "4px"); assert.deepEqual(metrics.queueExpanded.items, ["later one", "later two"]);
  assert.equal(metrics.queueExpanded.itemPadding, "5px"); assert.equal(metrics.queueExpanded.itemGap, "5px"); assert.equal(metrics.queueExpanded.itemRadius, "6px"); assert.equal(metrics.queueExpanded.clamp, "2");
  assert.equal(metrics.queueExpanded.dividers, 1); assert.equal(metrics.queueExpanded.clear, "Clear all"); assert.equal(metrics.queueExpanded.clearSize, "12px"); assert.equal(metrics.queueExpanded.collapse, "true");
  assert.equal(metrics.queueExpanded.handle, 20); assert.equal(metrics.queueExpanded.menu, true);
  // Keyboard reorder on the handle issues thread/queue/reorder with the new order.
  await list.locator(".sqm-handle").nth(1).focus();
  await page.keyboard.press("ArrowUp");
  await waitCount("thread/queue/reorder", 1);
  const queueEntries = (await readThreads()).threads[A].queue.map(entry => entry.input[0].text);
  assert.deepEqual(queueEntries, ["later two", "later one"]);
  assert.deepEqual((await requests("thread/queue/reorder"))[0].params.queuedSubmissionIds.length, 2);
  await page.waitForFunction(() => [...document.querySelectorAll('[role="list"][aria-label="Queued messages"] .sqm-item-text')].map(node => node.textContent).join("|") === "later two|later one");
  // Clear all removes both through thread/queue/delete and unmounts the bar.
  await page.locator(".sqm-clear").click();
  await waitCount("thread/queue/delete", 2);
  await bar.waitFor({ state: "detached" });
  assert.deepEqual((await readThreads()).threads[A].queue, []);
  // Single-row X removes the last entry.
  await fillComposer(page,editor(),"later three");
  await page.keyboard.press("Meta+Enter");
  await waitCount("thread/queue/add", 3);
  await bar.waitFor();
  await page.getByRole("button", { name: "Remove from queue", exact: true }).click();
  await waitCount("thread/queue/delete", 3);
  await bar.waitFor({ state: "detached" });
  // Edit in composer takes the entry back into the draft.
  await fillComposer(page,editor(),"later four");
  await page.keyboard.press("Meta+Enter");
  await waitCount("thread/queue/add", 4);
  await bar.waitFor();
  await page.getByRole("button", { name: "Edit in composer", exact: true }).click();
  await waitCount("thread/queue/delete", 4);
  await bar.waitFor({ state: "detached" });
  await page.waitForFunction(() => document.querySelector(".sc-input").value === "later four");
  await fillComposer(page,editor(),"");
  // Reduced motion removes the band transition (a fresh bar must be mounted to read it).
  await page.emulateMedia({ reducedMotion: "reduce" });
  await armSwap("Stop response");
  await fillComposer(page,editor(),"later five");
  // 0.2.112: without motion-safe the entering layer has no am animation and om keeps only
  // [transition:visibility_0s_linear_80ms] — the outgoing Stop is at opacity 0 at once.
  metrics.swapReduced = await swapSnapshot();
  // (duration is the design-system.css:1423 reduced-motion `animation-duration:0.01ms !important` clamp on *, not this contract.)
  assert.deepEqual({ ...metrics.swapReduced.entering, duration: undefined }, { label: "Send message", entering: true, inert: false, animation: "none", duration: undefined, delay: "0s", fill: "none", easing: "ease" });
  assert.deepEqual(metrics.swapReduced.leaving, { label: "Stop response", inert: true, hidden: "true", transition: "visibility 0s linear 0.08s", property: "visibility", duration: "0s", delay: "0.08s", pointer: "none", opacity: "0", visibility: "visible", held: ["visibility"] });
  metrics.swapReducedRelease = await releaseSwap();
  assert.deepEqual(metrics.swapReducedRelease, { present: true, last: "visibility", layers: 1 });
  await page.keyboard.press("Meta+Enter");
  await waitCount("thread/queue/add", 5);
  await bar.waitFor();
  assert.equal(await bar.evaluate(node => getComputedStyle(node).transitionDuration), "0s");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "Remove from queue", exact: true }).click();
  await bar.waitFor({ state: "detached" });
  checks.push("0.2.112 reduced motion: the Stop → Send swap has no cds-fade-in (animationName none) and the outgoing Stop layer only carries 'visibility 0s linear 0.08s' at opacity 0 before unmounting");
  checks.push("While a turn runs: Enter → turn/steer with the active turn id, Cmd+Enter → thread/queue/add with clientUserMessageId; the bar renders '1 message queued' (≥40px, 12px inline padding, 10px radius, alpha-1, 13/19 medium count, 24px Edit/X, 120ms band enter, none under reduced motion), two entries collapse to '2 messages queued'/'Next: …' and expand into role=list (min(40vh,22rem), 4px padding, 5px rows, line-clamp 2, Reorder handle 20px, actions menu, 'Clear all'); keyboard reorder, Clear all, X and Edit in composer issue the real reorder/delete requests");

  // 9. IME Escape is swallowed; Escape in the focused editor stops the turn exactly once.
  await editor().focus();
  const imeEscape = await keydown({ key: "Escape", isComposing: true });
  assert.equal(imeEscape.defaultPrevented, true, "Escape during composition is prevented");
  await page.waitForTimeout(200);
  assert.equal((await requests("turn/interrupt")).length, 0, "IME Escape never interrupts");
  assert.equal(await stopButton().count(), 1, "the turn is still running");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await waitCount("turn/interrupt", 1);
  await stopButton().waitFor({ state: "detached" });
  await page.waitForTimeout(300);
  assert.equal((await requests("turn/interrupt")).length, 1, "Escape stops the running turn exactly once");
  assert.equal((await readThreads()).threads[A].turns.at(-1).status, "interrupted");
  checks.push("Escape while composing is defaultPrevented without turn/interrupt; Escape in the focused editor of a busy composer issues turn/interrupt exactly once (second press latched)");

  // 10. Non-steerable turn falls back to the queue.
  await fillComposer(page,editor(),"fixture:hold-review");
  await page.keyboard.press("Enter");
  await stopButton().waitFor();
  await fillComposer(page,editor(),"steer a review");
  await page.keyboard.press("Enter");
  await waitCount("turn/steer", 2);
  await waitCount("thread/queue/add", 6);
  await bar.waitFor();
  assert.equal(await bar.locator(".sqm-preview").textContent(), "steer a review");
  await page.getByRole("button", { name: "Remove from queue", exact: true }).click();
  await bar.waitFor({ state: "detached" });
  await stopButton().click();
  await stopButton().waitFor({ state: "detached" });
  checks.push("A review-style turn answers turn/steer with activeTurnNotSteerable and the message is queued through thread/queue/add instead");

  // 11. Busy send state on a delayed turn/start.
  await open(C, `${C}-answer-0`);
  await fillComposer(page,editor(),"busy send probe");
  await armSwap("Stop response");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector('.sc-submit-cell [aria-label="Send message"]:not([inert] *)')?.getAttribute("aria-busy") === "true");
  metrics.busy = await sendButton().evaluate(node => ({ busy: node.getAttribute("aria-busy"), disabled: node.disabled, spinner: !!node.querySelector(".sc-spinner"), sr: node.querySelector(".sc-sr-only")?.textContent ?? null, glyph: node.querySelector('[data-cds="Icon"]')?.textContent ?? null, cardBusy: node.closest(".sc-composer").getAttribute("data-busy") }));
  assert.deepEqual(metrics.busy, { busy: "true", disabled: true, spinner: true, sr: "Sending", glyph: null, cardBusy: "true" });
  await page.waitForFunction(() => document.querySelector('.sc-submit-cell [aria-label="Send message"]:not([inert] *)')?.getAttribute("aria-busy") !== "true");
  await page.locator(".assistant-message").filter({ hasText: "Delayed fixture response" }).waitFor();
  // 0.2.112 reverse swap when the turn completes: Stop leaves with om, Send enters with am.
  metrics.swapOnComplete = await swapSnapshot();
  assert.deepEqual(metrics.swapOnComplete.entering, { label: "Send message", entering: true, inert: false, animation: "cds-fade-in", duration: "0.12s", delay: "0.08s", fill: "backwards", easing: "ease-out" });
  assert.deepEqual(metrics.swapOnComplete.leaving, { label: "Stop response", inert: true, hidden: "true", transition: "opacity 0.08s ease-out, visibility 0s linear 0.08s",
    property: "opacity, visibility", duration: "0.08s, 0s", delay: "0s, 0.08s", pointer: "none", opacity: "0", visibility: "visible", held: ["visibility"] });
  metrics.swapOnCompleteRelease = await releaseSwap();
  assert.deepEqual(metrics.swapOnCompleteRelease, { present: true, last: "visibility", layers: 1 });
  checks.push("0.2.112 on turn completion the reverse Stop → Send swap fades Send in (cds-fade-in 0.12s/0.08s) while the inert, aria-hidden Stop layer fades out over 80ms and unmounts on its visibility transitionend");
  checks.push("While turn/start is pending the Send button is aria-busy with the spinner in the ArrowReturn slot and an sr-only 'Sending' label; the card carries data-busy");

  // 11b. Interrupting: once Stop is pressed the control yields to the disabled Send glyph
  // (official showStop = busy && !interrupting) until the backend confirms the interrupt.
  await open(D, `${D}-answer-0`);
  await fillComposer(page,editor(),"fixture:hold");
  await page.keyboard.press("Enter");
  await stopButton().waitFor();
  await page.locator(".assistant-message").filter({ hasText: "HOLD_CHUNK_01" }).waitFor();
  const interruptsBefore = (await requests("turn/interrupt")).length;
  await stopButton().click();
  await stopButton().waitFor({ state: "detached" });
  await waitCount("turn/interrupt", interruptsBefore + 1);
  metrics.interrupting = await sendButton().evaluate(node => ({ disabled: node.disabled, busy: node.getAttribute("aria-busy"), glyph: node.querySelector('[data-cds="Icon"]')?.textContent.codePointAt(0) ?? null, spinner: !!node.querySelector(".sc-spinner"), cardBusy: node.closest(".sc-composer").getAttribute("data-busy"), stops: document.querySelectorAll('.sc-submit-cell [aria-label="Stop response"]:not([inert] *)').length }));
  assert.equal((await readThreads()).threads[D].turns.at(-1).status, "inProgress", "the fixture interrupt is still pending");
  assert.deepEqual(metrics.interrupting, { disabled: true, busy: null, glyph: 57359, spinner: false, cardBusy: "true", stops: 0 });
  await page.mouse.move(100, 700);
  await activeSlot().hover();
  await page.locator(".source-tooltip-popup").waitFor();
  metrics.interruptingTooltip = await page.locator(".source-tooltip-popup").evaluate(node => [...node.querySelectorAll(".source-tooltip-label-line")].map(line => ({ label: line.querySelector(".source-tooltip-label").textContent, shortcut: (chip => chip && [...chip.querySelectorAll("kbd")].map(kbd => (kbd.querySelector('[aria-hidden="true"]') ?? kbd).textContent).join(""))(line.querySelector(".source-tooltip-shortcut")) ?? null })));
  assert.deepEqual(metrics.interruptingTooltip, [{ label: "Send", shortcut: "⏎" }], "no 'Queue for later' hint while interrupting");
  await page.mouse.move(900, 120);
  await page.waitForFunction(() => !document.querySelector(".sc-composer").hasAttribute("data-busy"));
  assert.equal((await readThreads()).threads[D].turns.at(-1).status, "interrupted");
  checks.push("After Stop is pressed the Stop control unmounts and the disabled Send glyph (ArrowReturn, no aria-busy, no queue hint) holds the slot while the card stays data-busy until turn/interrupt completes");

  // 12. Archived session: card data-disabled, editor and send disabled.
  await page.getByRole("button", { name: /^Filter(?: \(active\))?$/ }).click();
  const filterMenu = page.getByRole("menu", { name: "Filter sessions", exact: true });
  await filterMenu.getByRole("menuitem", { name: /^Status/ }).click();
  await page.getByRole("menu", { name: "Status", exact: true }).getByRole("menuitemradio", { name: "Archived", exact: true }).click();
  await filterMenu.waitFor({ state: "detached" });
  await page.locator(`[data-source-session-id="${B}"] .source-session-open`).click();
  await page.getByRole("button", { name: "Restore session", exact: true }).waitFor();
  metrics.archived = await page.evaluate(() => ({ card: document.querySelector(".sc-composer").hasAttribute("data-disabled"), editor: !document.querySelector(".sc-input").isContentEditable, send: document.querySelector('.sc-submit-cell [aria-label="Send message"]:not([inert] *)').disabled, cursor: getComputedStyle(document.querySelector(".sc-surface")).cursor }));
  assert.deepEqual(metrics.archived, { card: true, editor: true, send: true, cursor: "default" });
  checks.push("An archived session marks the card data-disabled with a disabled editor and Send");
  await page.getByRole("button", { name: /^Filter(?: \(active\))?$/ }).click();
  await filterMenu.getByRole("menuitem", { name: /^Status/ }).click();
  await page.getByRole("menu", { name: "Status", exact: true }).getByRole("menuitemradio", { name: "Active", exact: true }).click();
  await filterMenu.waitFor({ state: "detached" });

  // 13. Connection loss: warning row with Retry, disabled card.
  await open(A, `${A}-answer-0`);
  await fillComposer(page,editor(),"disconnect");
  await page.keyboard.press("Enter");
  await page.locator("[data-cds-composer-warning]").waitFor();
  metrics.disconnected = await page.evaluate(() => {
    const row = document.querySelector("[data-cds-composer-warning]");
    return { text: row.querySelector(".sc-warning-text").textContent, retry: row.querySelector("button")?.textContent ?? null, size: getComputedStyle(row).fontSize, gap: getComputedStyle(row).gap,
      color: getComputedStyle(row).color, warning: (() => { const probe = document.createElement("span"); probe.style.color = "var(--cds-text-warning)"; document.body.appendChild(probe); const value = getComputedStyle(probe).color; probe.remove(); return value; })(),
      card: document.querySelector(".sc-composer").hasAttribute("data-disabled"), editor: !document.querySelector(".sc-input").isContentEditable };
  });
  assert.equal(metrics.disconnected.text, "Connection to DeepSeek lost."); assert.equal(metrics.disconnected.retry, "Retry");
  assert.equal(metrics.disconnected.size, "12px"); assert.equal(metrics.disconnected.gap, "8px"); assert.equal(metrics.disconnected.color, metrics.disconnected.warning);
  // Fidelity F05 (cc43287c9-BMbiZYzF.js:27612 Jr / :28636-28638): a lost connection only gates sending; the editor stays
  // typeable (no data-disabled) and Enter sends nothing. This replaces the earlier disabled-card expectation on purpose.
  assert.equal(metrics.disconnected.card, false); assert.equal(metrics.disconnected.editor, false);
  const startsOffline = (await requests("turn/start")).length;
  await fillComposer(page, editor(), "typed while offline");
  await page.keyboard.press("Enter");
  await frames(4);
  metrics.offline = { value: await editor().evaluate(node => node.value), send: await sendButton().evaluate(node => node.disabled), starts: (await requests("turn/start")).length - startsOffline };
  assert.deepEqual(metrics.offline, { value: "typed while offline", send: true, starts: 0 });
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.locator("[data-cds-composer-warning]").waitFor({ state: "detached" });
  await page.waitForFunction(() => !document.querySelector(".sc-composer").hasAttribute("data-disabled"));
  await page.waitForFunction(() => document.querySelector(".sc-input").value === "typed while offline");
  checks.push("A lost connection shows the footnote warning row (12px, 8px gap, text-warning) with a real Retry that reconnects; F05: meanwhile the card is not data-disabled, typing works, Enter sends nothing and Send is disabled; the draft survives the reconnect");

  // 14. Placeholder follows Yn = current session id: draft ↔ session switches update it immediately,
  // and the first turn from the draft (thread/start) turns it into the session copy.
  await fillComposer(page,editor(),"");
  await expectPlaceholder("Type / for commands", "session A after reconnect");
  await page.getByRole("button", { name: "New", exact: true }).click();
  metrics.placeholderDraft = await expectPlaceholder("Describe a task or ask a question", "New session restores the draft copy");
  // c360a9e1c hd Y = !P && sessionRef === null: the draft composer reads 'Context 0' with an empty ring.
  metrics.usageDraft = await usageRing();
  assert.equal(metrics.usageDraft.label, "Usage: Context 0"); near(metrics.usageDraft.offset, 2 * Math.PI * 5, "draft ring is empty", .05);
  await page.screenshot({ path: path.join(directory, "placeholder-draft.png") });
  await open(C, `${C}-answer-0`);
  await expectPlaceholder("Type / for commands", "switching to another session");
  await page.getByRole("button", { name: "New", exact: true }).click();
  await expectPlaceholder("Describe a task or ask a question", "back to the draft");
  // thread/start is logged to fixture-history.jsonl, so the created thread is read off the first turn/start.
  const startsBefore = (await requests("turn/start")).length;
  await fillComposer(page,editor(),"fixture:complete first draft turn");
  assert.equal((await placeholderState()).empty, "false", "typed text hides the placeholder");
  await page.keyboard.press("Enter");
  await waitCount("turn/start", startsBefore + 1);
  metrics.placeholderCreatedThread = (await requests("turn/start")).at(-1).params.threadId;
  assert.ok(![A, B, C, D].includes(metrics.placeholderCreatedThread) && (await readThreads()).threads[metrics.placeholderCreatedThread], "the draft turn ran on a thread created by thread/start");
  await page.locator(".assistant-message").filter({ hasText: "Fixture response" }).last().waitFor();
  await idle();
  metrics.placeholderCreated = await expectPlaceholder("Type / for commands", "the session created by the first turn");
  // The fixture's completed turn emits thread/tokenUsage/updated last.totalTokens 100 / modelContextWindow 128000
  // (tests/fixtures/codex-server.cjs complete()), so ST gives '100 / 128k (0%)' and dT 'normal' → accent.
  await page.waitForFunction(() => document.querySelector(".sc-chin .sc-usage-trigger")?.getAttribute("aria-label")?.startsWith("Usage: Context 100"));
  metrics.usageAfter = await usageRing();
  assert.equal(metrics.usageAfter.label, "Usage: Context 100 / 128k (0%)"); assert.match(metrics.usageAfter.label, /^Usage: Context/);
  assert.equal(metrics.usageAfter.circles, 2); near(metrics.usageAfter.width, 12, "ring svg width after usage", .01); near(metrics.usageAfter.height, 12, "ring svg height after usage", .01);
  near(metrics.usageAfter.offset, 2 * Math.PI * 5, "0% ring dashoffset", .05); near(metrics.usageAfter.computedOffset, 2 * Math.PI * 5, "0% ring computed dashoffset", .05);
  assert.equal(metrics.usageAfter.stroke, metrics.usageAfter.accent, "normal threshold paints --cds-fill-accent");
  const usageBox = await usageTrigger().boundingBox();
  await page.mouse.move(usageBox.x + usageBox.width / 2, usageBox.y + usageBox.height / 2);
  await page.locator('.source-tooltip-popup[data-state="open"]').waitFor();
  metrics.usageTooltip = await page.locator(".source-tooltip-popup .source-tooltip-label").textContent();
  assert.equal(metrics.usageTooltip, "Context 100 / 128k (0%)");
  assert.equal(await page.locator(".source-tooltip-popup .source-tooltip-detail").count(), 0, "no plan-limit detail exists locally");
  await page.screenshot({ path: path.join(directory, "usage-ring-tooltip.png") });
  // _d Zt open = popover open ? false : undefined: opening the popover closes the tooltip and it stays closed while hovered.
  await usageTrigger().click();
  // Fidelity F03: the usage ring opens the CDS Popover (c360a9e1c-GPs-MV9u.js:4240-4285 vd: side top, align end,
  // sideOffset 8, padding none, w-[360px], sr-only Title 'Usage', 'flex flex-col py-sm' around the yc panel);
  // there is no visible 'Usage' heading and no menuitem row.
  const usagePopover = page.getByRole("dialog", { name: "Usage", exact: true });
  await usagePopover.waitFor();
  await page.locator(".source-tooltip-popup").waitFor({ state: "detached" });
  metrics.usagePopover = await usagePopover.evaluate((node) => {
    const box = node.getBoundingClientRect(), trigger = document.querySelector(".sc-chin .sc-usage-trigger").getBoundingClientRect();
    const title = node.querySelector("h2"), body = node.querySelector("[data-cds-popover-body]"), probe = document.createElement("span");
    probe.style.color = "var(--cds-surface-3)"; node.appendChild(probe); const surface = getComputedStyle(probe).color; probe.remove();
    return { cds: node.dataset.cds, overlay: node.hasAttribute("data-cds-overlay"), side: node.dataset.side, align: node.dataset.align, width: box.width,
      gap: Math.round(trigger.top - box.bottom), endGap: Math.round(trigger.right - box.right), labelledBy: node.getAttribute("aria-labelledby") === title?.id,
      title: title?.textContent, titleClip: [title?.getBoundingClientRect().width, title?.getBoundingClientRect().height], bodyPadding: getComputedStyle(body).padding,
      text: [...node.querySelectorAll(".sc-usage-body .sc-usage-muted, .sc-usage-body .sc-usage-link")].map((part) => part.textContent), menuitems: node.querySelectorAll('[role^="menuitem"]').length,
      headings: node.querySelectorAll(".menu-heading").length, progress: node.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow"),
      background: getComputedStyle(node).backgroundColor, surface, radius: getComputedStyle(node).borderRadius };
  });
  assert.deepEqual({ ...metrics.usagePopover, background: undefined, surface: undefined, radius: undefined }, { cds: "Popover", overlay: true, side: "top", align: "end", width: 360, gap: 8, endGap: 0,
    labelledBy: true, title: "Usage", titleClip: [1, 1], bodyPadding: "0px", text: ["Context window", "100 / 128k (0%)", "See detailed breakdown"], menuitems: 0, headings: 0, progress: "0",
    background: undefined, surface: undefined, radius: undefined });
  assert.equal(metrics.usagePopover.background, metrics.usagePopover.surface, "surface-3 popover");
  // R05 (cf6ae6197 Tw minPct 50): at 0% the compact action row stays absent.
  assert.equal(await usagePopover.locator(".sc-usage-compact-row").count(), 0, "no compact row below 50%");
  await page.mouse.move(usageBox.x + usageBox.width / 2 + 1, usageBox.y + usageBox.height / 2);
  await page.waitForTimeout(900);
  metrics.usageTooltipWhileOpen = await page.locator(".source-tooltip-popup").count();
  assert.equal(metrics.usageTooltipWhileOpen, 0, "no tooltip while the usage popover is open");
  await page.screenshot({ path: path.join(directory, "usage-popover-open.png") });
  await page.mouse.move(100, 700);
  await page.keyboard.press("Escape");
  await usagePopover.waitFor({ state: "detached" });
  await page.locator(".source-tooltip-popup").waitFor({ state: "detached" });
  checks.push("0.2.103 usage trigger: the draft reads 'Usage: Context 0'; after the fixture turn (last 100 / window 128000) aria-label is 'Usage: Context 100 / 128k (0%)', ring dashoffset 2π·5 in resolved --cds-fill-accent, 12×12 svg, hover tooltip 'Context 100 / 128k (0%)' without detail, and no tooltip while the usage popover is open; F03: the popover is a 360px [data-cds=Popover] dialog named by an sr-only 'Usage' title, 8px above the ring with its end edge aligned, padding none, surface-3, holding 'Context window 100 / 128k (0%)' and 'See detailed breakdown' with no heading and no menuitem");
  // R05 compact action (c2d611398 H row; cf6ae6197 Tw minPct 50 / Ow; c360a9e1c hd oe): the codex fixture always
  // reports last 100 tokens, so a 64000 / 128000 (50%) tokenUsage notification for this session is delivered on the
  // renderer's core event channel, then the original 100 is restored.
  const deliverUsage = (threadId, tokens) => app.evaluate(({ BrowserWindow }, payload) => {
    for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send("desktop:event", payload);
  }, { method: "thread/tokenUsage/updated", params: { threadId, tokenUsage: { total: { totalTokens: tokens }, last: { totalTokens: tokens }, modelContextWindow: 128000 } } });
  await deliverUsage(metrics.placeholderCreatedThread, 64000);
  await page.waitForFunction(() => document.querySelector(".sc-chin .sc-usage-trigger")?.getAttribute("aria-label") === "Usage: Context 64k / 128k (50%)");
  await usageTrigger().click();
  await usagePopover.waitFor();
  metrics.usageCompact = await usagePopover.evaluate((node) => {
    const row = node.querySelector(".sc-usage-compact-row"), button = row?.querySelector("button"), style = row && getComputedStyle(row);
    const bar = node.querySelector(".sc-usage-bar").getBoundingClientRect(), separator = node.querySelector(".sc-usage-separator")?.getBoundingClientRect();
    return { rows: node.querySelectorAll(".sc-usage-compact-row").length, label: button?.textContent, cds: button?.dataset.cds, disabled: button?.disabled,
      afterBar: !!row && row.getBoundingClientRect().top >= bar.bottom, beforeSeparator: !!row && !!separator && row.getBoundingClientRect().bottom <= separator.top,
      minHeight: style?.minHeight, gap: style?.columnGap, display: style?.display, underline: button && getComputedStyle(button).textDecorationLine };
  });
  assert.deepEqual(metrics.usageCompact, { rows: 1, label: "Compact session", cds: "TextLink", disabled: false, afterBar: true, beforeSeparator: true,
    minHeight: "20px", gap: metrics.usageCompact.gap, display: "flex", underline: "underline" });
  await page.screenshot({ path: path.join(directory, "usage-popover-compact.png") });
  await page.keyboard.press("Escape");
  await usagePopover.waitFor({ state: "detached" });
  await deliverUsage(metrics.placeholderCreatedThread, 100);
  await page.waitForFunction(() => document.querySelector(".sc-chin .sc-usage-trigger")?.getAttribute("aria-label") === "Usage: Context 100 / 128k (0%)");
  checks.push("R05 usage compact row: absent at 0%; at 64k / 128k (50%) the popover shows one row after the bar and before the separator (flex, min-height 20px) holding the enabled CDS TextLink 'Compact session' (underlined)");
  await page.mouse.move(100, 700);
  await page.screenshot({ path: path.join(directory, "placeholder-session.png") });
  await page.getByRole("button", { name: "New", exact: true }).click();
  await expectPlaceholder("Describe a task or ask a question", "New session after the created session");
  checks.push("0.2.98: New session shows 'Describe a task or ask a question'; switching to a session and back swaps the copy immediately; the first draft turn (new thread from thread/start, then turn/start) switches it to 'Type / for commands'; New restores the draft copy");

  // 15. 0.2.110 prompt-history recall (shared-13 Vj :14448-14600 with caretAfterRecall "end"; c099c328d
  // Em Nn.Header + wm :8580-8633/:9012-9015, shared-11 uu :1430-1446; cc43287c9 :28625-28628 resetKey only
  // for an existing session). History = the open thread's userMessage text, oldest → newest.
  const historyState = () => page.evaluate(() => {
    const node = document.querySelector('[data-cds="ChatComposerEditor"]'), header = document.querySelector(".sc-history-header"), grid = document.querySelector(".sc-history-header-grid");
    const probe = document.createElement("span"); probe.style.fontSize = "var(--cds-font-size-footnote)"; probe.style.color = "var(--cds-text-muted)"; document.querySelector(".sc-surface").appendChild(probe);
    const footnote = getComputedStyle(probe).fontSize, muted = getComputedStyle(probe).color; probe.remove();
    const count = header?.querySelector(".sc-history-count");
    return { value: node.value, start: node.selectionStart, end: node.selectionEnd, focused: node.contains(document.activeElement) || document.activeElement === node,
      status: document.querySelector("[data-history-status]")?.textContent ?? null, statusRole: document.querySelector("[data-history-status]")?.getAttribute("role") ?? null,
      strip: header ? { text: header.textContent, hidden: header.getAttribute("aria-hidden"), cds: header.dataset.cds, countText: count?.textContent, numeric: count ? getComputedStyle(count).fontVariantNumeric : null,
        fontSize: getComputedStyle(header).fontSize, footnote, color: getComputedStyle(header).color, muted, whiteSpace: getComputedStyle(header).whiteSpace, inCard: !!header.closest(".sc-surface"),
        beforeEditor: !!(header.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING), animation: getComputedStyle(grid).animationName, duration: getComputedStyle(grid).animationDuration } : null };
  });
  // The New draft (resetKey undefined) has no history.
  await fillComposer(page, editor(), "");
  await page.keyboard.press("ArrowUp");
  await frames(2);
  metrics.historyDraft = await historyState();
  assert.equal(metrics.historyDraft.value, ""); assert.equal(metrics.historyDraft.strip, null); assert.equal(metrics.historyDraft.status, "");
  await open(E, `${E}-answer-1`);
  await fillComposer(page, editor(), "");
  await page.keyboard.press("ArrowUp");
  await page.waitForFunction(() => document.querySelector('[data-cds="ChatComposerEditor"]').value === "Second history prompt.");
  await page.locator(".sc-history-header").waitFor();
  metrics.historyNewest = await historyState();
  assert.equal(metrics.historyNewest.start, "Second history prompt.".length, "caret after recall is at the end"); assert.equal(metrics.historyNewest.end, metrics.historyNewest.start);
  assert.equal(metrics.historyNewest.strip.text, "History 2/2"); assert.equal(metrics.historyNewest.strip.countText, "History 2/2");
  assert.equal(metrics.historyNewest.strip.numeric, "tabular-nums"); assert.equal(metrics.historyNewest.strip.fontSize, metrics.historyNewest.strip.footnote, "text-footnote");
  assert.equal(metrics.historyNewest.strip.color, metrics.historyNewest.strip.muted, "text-muted"); assert.equal(metrics.historyNewest.strip.hidden, "true");
  assert.equal(metrics.historyNewest.strip.cds, "ChatComposerHeader"); assert.equal(metrics.historyNewest.strip.whiteSpace, "nowrap");
  assert.equal(metrics.historyNewest.strip.inCard, true); assert.equal(metrics.historyNewest.strip.beforeEditor, true, "Nn.Header sits above the editor inside the card");
  assert.equal(metrics.historyNewest.strip.animation, "cds-grid-rows-in"); assert.equal(metrics.historyNewest.strip.duration, "0.3s");
  assert.equal(metrics.historyNewest.status, "History 2/2"); assert.equal(metrics.historyNewest.statusRole, "status");
  await page.keyboard.press("ArrowUp");
  await page.waitForFunction(() => document.querySelector('[data-cds="ChatComposerEditor"]').value === "First history prompt.");
  metrics.historyOldest = await historyState();
  assert.equal(metrics.historyOldest.strip.text, "History 1/2"); assert.equal(metrics.historyOldest.start, "First history prompt.".length);
  // At the oldest entry ArrowUp is swallowed (preventDefault) and nothing changes.
  metrics.historyClamp = await keydown({ key: "ArrowUp", code: "ArrowUp" });
  await frames(2);
  assert.equal(metrics.historyClamp.defaultPrevented, true);
  const clamped = await historyState();
  assert.equal(clamped.value, "First history prompt."); assert.equal(clamped.strip.text, "History 1/2");
  await page.mouse.move(100, 700);
  await page.screenshot({ path: path.join(directory, "prompt-history-light.png") });
  await page.getByRole("button", { name: "Account menu", exact: true }).click(); await page.getByRole("menuitem", { name: "Dark appearance", exact: true }).click();
  await page.waitForFunction(() => document.documentElement.dataset.mode === "dark");
  metrics.historyDark = await historyState();
  assert.equal(metrics.historyDark.strip.text, "History 1/2"); assert.equal(metrics.historyDark.strip.color, metrics.historyDark.strip.muted, "dark text-muted");
  await page.mouse.move(100, 700);
  await page.screenshot({ path: path.join(directory, "prompt-history-dark.png") });
  await page.getByRole("button", { name: "Account menu", exact: true }).click(); await page.getByRole("menuitem", { name: "Light appearance", exact: true }).click();
  await page.waitForFunction(() => document.documentElement.dataset.mode === "light");
  // Typing ends navigation; the key itself still types.
  await editor().focus();
  await page.keyboard.press("End");
  await page.keyboard.type("x");
  await page.waitForFunction(() => document.querySelector('[data-cds="ChatComposerEditor"]').value === "First history prompt.x");
  await page.locator(".sc-history-header").waitFor({ state: "detached" });
  assert.equal((await historyState()).status, "");
  // A non-empty draft never enters history.
  await fillComposer(page, editor(), "");
  await fillComposer(page, editor(), "wip");
  metrics.historyWip = await keydown({ key: "ArrowUp", code: "ArrowUp" });
  await frames(2);
  const wip = await historyState();
  assert.equal(metrics.historyWip.defaultPrevented, false); assert.equal(wip.value, "wip"); assert.equal(wip.strip, null);
  // ArrowUp then ArrowDown past the newest entry restores the (empty) draft and clears the strip.
  await fillComposer(page, editor(), "");
  await page.keyboard.press("ArrowUp");
  await page.locator(".sc-history-header").waitFor();
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => document.querySelector('[data-cds="ChatComposerEditor"]').value === "");
  await page.locator(".sc-history-header").waitFor({ state: "detached" });
  metrics.historyRestored = await historyState();
  assert.equal(metrics.historyRestored.value, ""); assert.equal(metrics.historyRestored.status, "");
  // An open slash popup keeps ArrowUp (c099c328d ya :11185 `!t && gi(e)`).
  await fillComposer(page, editor(), "/");
  const slash = page.getByRole("menu", { name: "Slash commands", exact: true });
  await slash.waitFor();
  const highlighted = () => page.evaluate(() => { const rows = [...document.querySelectorAll('[role="menu"][aria-label="Slash commands"] [role="menuitem"]')]; return { index: rows.findIndex(row => row.hasAttribute("data-highlighted")), count: rows.length }; });
  const slashBefore = await highlighted();
  await page.keyboard.press("ArrowUp");
  await frames(2);
  metrics.historySlash = { before: slashBefore, after: await highlighted(), state: await historyState() };
  assert.equal(metrics.historySlash.after.index, (slashBefore.index - 1 + slashBefore.count) % slashBefore.count, "ArrowUp moved the slash highlight");
  assert.equal(metrics.historySlash.state.value, "/"); assert.equal(metrics.historySlash.state.strip, null);
  await page.keyboard.press("Escape");
  await slash.waitFor({ state: "detached" });
  // Reduced motion drops the cds-grid-rows-in entry animation (motion-safe).
  await page.emulateMedia({ reducedMotion: "reduce" });
  await fillComposer(page, editor(), "");
  await page.keyboard.press("ArrowUp");
  await page.locator(".sc-history-header").waitFor();
  metrics.historyReducedMotion = (await historyState()).strip.animation;
  await page.emulateMedia({ reducedMotion: "no-preference" });
  assert.equal(metrics.historyReducedMotion, "none");
  await page.keyboard.press("ArrowDown");
  await page.locator(".sc-history-header").waitFor({ state: "detached" });
  checks.push("0.2.110 prompt history: the New draft ignores ArrowUp; in a 2-turn session ArrowUp in the empty editor recalls 'Second history prompt.' with the caret at the end and the aria-hidden ChatComposerHeader strip above the editor in the card reads 'History 2/2' (tabular-nums, footnote size, text-muted, nowrap, 0.3s cds-grid-rows-in) with an sr-only role=status copy; ArrowUp → 'History 1/2', again → swallowed at 1/2; typing ends it; a non-empty draft cannot enter; ArrowUp+ArrowDown restores the empty draft; an open slash menu keeps ArrowUp; reduced motion has no animation; light/dark screenshots");

  // 16. 0.2.120 composer chin chords (chin-shortcuts.mjs): sidebar-rows.js:14191-14200 openModeMenu cmd+shift+m /
  // cmd+alt+m, openModelMenu cmd+shift+i, openEffortMenu cmd+shift+e, toggleFastMode cmd+alt+f; c360a9e1c Zd
  // (:4655-4775) capture-phase window keydown: repeat claimed but never opens, same chord closes, a different open
  // chin menu ignores the chord, Digit1-9 pick the Nth Mode item; Ud tooltip shortcut (:4544-4575/:4924-4945);
  // ze live region 'Fast mode on/off' (:4840-4848/:4972-4980).
  // Runs in the idle 2-turn session E. (F05: the pickers stay usable during a turn too; section 18 covers that.)
  await page.mouse.move(100, 700);
  await editor().focus();
  const modelsMenu = () => page.getByRole("menu", { name: "Models", exact: true }), effortPopover = () => page.getByRole("dialog", { name: "Effort", exact: true });
  const modeMenu = () => page.getByRole("menu", { name: "Mode", exact: true }), modeTrigger = () => page.locator(".sc-chin .sc-permission");
  const fastStatus = () => page.locator('.sc-chin span[role="status"][aria-live="polite"].sr-only');
  const synthetic = init => page.evaluate(init => { const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }); (document.activeElement || document.body).dispatchEvent(event); return event.defaultPrevented; }, init);
  const readPreferences = async () => JSON.parse(await fs.readFile(path.join(profile, "preferences.json"), "utf8"));
  metrics.chinEfforts = await page.evaluate(() => document.querySelector(".sc-chin .sc-effort-trigger")?.disabled === false);
  metrics.chinRepeat = await synthetic({ key: "I", code: "KeyI", metaKey: true, shiftKey: true, repeat: true });
  await frames(3);
  assert.equal(metrics.chinRepeat, true, "a repeated ⌘⇧I is preventDefault'ed"); assert.equal(await modelsMenu().count(), 0, "a repeat never opens");
  await page.keyboard.press("Meta+Shift+KeyI");
  await modelsMenu().waitFor();
  metrics.chinModelAnchor = await page.evaluate(() => document.querySelector(".sc-model-trigger").getAttribute("aria-expanded"));
  await page.keyboard.press("Meta+Shift+KeyI");
  await modelsMenu().waitFor({ state: "detached" });
  await page.keyboard.press("Meta+Shift+KeyI");
  await modelsMenu().waitFor();
  await page.keyboard.press("Escape");
  await modelsMenu().waitFor({ state: "detached" });
  // The fixture model lists four efforts (> 1), so ⌘⇧E opens the effort popover, not the model menu (w fallback is ≤1).
  assert.equal(metrics.chinEfforts, true, "fixture model has more than one effort");
  await editor().focus();
  await page.keyboard.press("Meta+Shift+KeyE");
  await effortPopover().waitFor();
  assert.equal(await modelsMenu().count(), 0);
  // Fidelity F03: the effort popover is the CDS Popover (c8e04f916 p.Popup: data-cds ModelSelectorEffort, w-[220px],
  // flex-col gap-lg, padding lg) side top / align end of its chip, named by its Title 'Effort'; a keyboard open
  // (initialFocus he) focuses the slider.
  await page.waitForFunction(() => document.activeElement?.matches('[role="dialog"][data-cds="ModelSelectorEffort"] input[type="range"]'));
  metrics.effortPopover = await effortPopover().evaluate((node) => {
    const box = node.getBoundingClientRect(), chip = document.querySelector(".sc-chin .sc-effort-trigger").getBoundingClientRect(), body = node.querySelector("[data-cds-popover-body]");
    const probe = document.createElement("span"); probe.style.padding = "var(--cds-pad-lg)"; body.appendChild(probe); const padLg = getComputedStyle(probe).paddingTop; probe.remove();
    return { cds: node.dataset.cds, overlay: node.hasAttribute("data-cds-overlay"), side: node.dataset.side, align: node.dataset.align, width: box.width,
      gap: Math.round(chip.top - box.bottom), endGap: Math.round(chip.right - box.right), title: document.getElementById(node.getAttribute("aria-labelledby"))?.textContent,
      paddingMatches: getComputedStyle(body).paddingTop === padLg, display: getComputedStyle(node).display, direction: getComputedStyle(node).flexDirection,
      expanded: document.querySelector(".sc-chin .sc-effort-trigger").getAttribute("aria-expanded") };
  });
  assert.deepEqual(metrics.effortPopover, { cds: "ModelSelectorEffort", overlay: true, side: "top", align: "end", width: 220, gap: 6, endGap: 0, title: "Effort",
    paddingMatches: true, display: "flex", direction: "column", expanded: "true" });
  metrics.chinEffortOther = await synthetic({ key: "I", code: "KeyI", metaKey: true, shiftKey: true });
  await frames(3);
  assert.equal(metrics.chinEffortOther, true); assert.equal(await modelsMenu().count(), 0, "a different chin chord is ignored while effort is open");
  assert.equal(await effortPopover().count(), 1);
  await page.keyboard.press("Escape");
  await effortPopover().waitFor({ state: "detached" });
  await editor().focus();
  const modeBefore = await modeTrigger().textContent();
  await page.keyboard.press("Meta+Shift+KeyM");
  await modeMenu().waitFor();
  metrics.chinModeItems = await modeMenu().evaluate(menu => [...menu.querySelectorAll("[data-number-key]")].map(node => [node.dataset.numberKey, node.dataset.permissionValue, node.dataset.label]));
  const [, secondValue, secondLabel] = metrics.chinModeItems[1];
  // Digits are dispatched on the editor, OUTSIDE the popup: SourceMenu's own popup onKeyDown (source-menu.jsx:361-364)
  // only sees keys targeted inside the menu, so only main.jsx's capture-phase Zd T branch (:4728-4737) can select here.
  // Digit0 is claimed but selects nothing; the restore digit below is a repeat (T has no repeat guard).
  const editorKey = init => editor().evaluate((node, init) => { const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }); node.dispatchEvent(event); return event.defaultPrevented; }, init);
  metrics.chinModeDigit0 = await editorKey({ key: "0", code: "Digit0" });
  await frames(3);
  assert.equal(metrics.chinModeDigit0, true, "Digit0 is claimed while Mode is open");
  assert.equal(await modeMenu().count(), 1, "Digit0 selects nothing"); assert.equal(await modeTrigger().textContent(), modeBefore);
  metrics.chinModeDigit2 = await editorKey({ key: "2", code: "Digit2" });
  assert.equal(metrics.chinModeDigit2, true, "Digit2 is claimed (preventDefault) by the capture path");
  await modeMenu().waitFor({ state: "detached" });
  // F07: the chin trigger reads the item's full label (cf6ae6197 ht = triggerLabel ?? label).
  await page.waitForFunction(label => document.querySelector(".sc-chin .sc-permission")?.textContent === label, secondLabel);
  metrics.chinModeSelected = { before: modeBefore, after: await modeTrigger().textContent(), value: secondValue };
  assert.notEqual(metrics.chinModeSelected.after, modeBefore, "Digit2 selected a different (the 2nd) mode");
  // Restore through the second Mode chord (cmd+alt+m) and the original item's digit.
  const originalDigit = metrics.chinModeItems.find(([, , label]) => label === modeBefore)?.[0];
  assert.ok(originalDigit, "original mode is numbered");
  await editor().focus();
  metrics.chinDigitClosed = await editorKey({ key: "2", code: "Digit2" });
  assert.equal(metrics.chinDigitClosed, false, "a plain digit is not claimed while Mode is closed");
  await page.keyboard.press("Meta+Alt+KeyM");
  await modeMenu().waitFor();
  metrics.chinModeDigitRepeat = await editorKey({ key: originalDigit, code: `Digit${originalDigit}`, repeat: true });
  assert.equal(metrics.chinModeDigitRepeat, true);
  await modeMenu().waitFor({ state: "detached" });
  await page.waitForFunction(label => document.querySelector(".sc-chin .sc-permission")?.textContent === label, modeBefore);
  // Hovering Mode shows the CDS tooltip 'Mode' + ⇧⌘M (ve("openModeMenu") "cmd+shift+m" through po's io modifier
  // order, shared-frame-C_2npUJq.js:2136/:2206-2219); no native titles on Mode/Model/Effort.
  const modeBox = await modeTrigger().boundingBox();
  await page.mouse.move(modeBox.x + modeBox.width / 2, modeBox.y + modeBox.height / 2);
  await page.locator('.source-tooltip-popup[data-state="open"]').waitFor();
  metrics.chinModeTooltip = await page.locator(".source-tooltip-popup").evaluate(node => ({ label: node.querySelector(".source-tooltip-label")?.textContent, shortcuts: [...node.querySelectorAll(".source-tooltip-shortcut")].map(chip => [...chip.querySelectorAll("kbd")].map(kbd => (kbd.querySelector('[aria-hidden="true"]') ?? kbd).textContent).join("")) }));
  assert.deepEqual(metrics.chinModeTooltip, { label: "Mode", shortcuts: ["⇧⌘M"] });
  await page.screenshot({ path: path.join(directory, "chin-mode-tooltip.png") });
  await page.mouse.move(100, 700);
  await page.locator(".source-tooltip-popup").waitFor({ state: "detached" });
  const effortBox = await page.locator(".sc-chin .sc-effort-trigger").boundingBox();
  await page.mouse.move(effortBox.x + effortBox.width / 2, effortBox.y + effortBox.height / 2);
  await page.locator('.source-tooltip-popup[data-state="open"]').waitFor();
  metrics.chinEffortTooltip = await page.locator(".source-tooltip-popup .source-tooltip-label").textContent();
  assert.equal(metrics.chinEffortTooltip, "Effort");
  await page.mouse.move(100, 700);
  await page.locator(".source-tooltip-popup").waitFor({ state: "detached" });
  metrics.chinTitles = await page.evaluate(() => [".sc-permission", ".sc-model-trigger", ".sc-effort-trigger"].map(selector => document.querySelector(`.sc-chin ${selector}`).getAttribute("title")));
  assert.deepEqual(metrics.chinTitles, [null, null, null]);
  // ⌥⌘F toggles the fixture's Fast tier; the sr-only role=status text follows; a second press restores it.
  assert.equal(await fastStatus().textContent(), "Fast mode off");
  await editor().focus();
  await page.keyboard.press("Meta+Alt+KeyF");
  await page.waitForFunction(() => document.querySelector('.sc-chin span[role="status"].sr-only')?.textContent === "Fast mode on");
  await page.locator(".sc-chin .sc-model-trigger .sc-fast-label").waitFor();
  metrics.chinFastOn = { status: await fastStatus().textContent(), saved: (await readPreferences()).fastMode };
  assert.deepEqual(metrics.chinFastOn, { status: "Fast mode on", saved: true });
  await page.keyboard.press("Meta+Alt+KeyF");
  await page.waitForFunction(() => document.querySelector('.sc-chin span[role="status"].sr-only')?.textContent === "Fast mode off");
  await page.locator(".sc-chin .sc-model-trigger .sc-fast-label").waitFor({ state: "detached" });
  assert.equal((await readPreferences()).fastMode, false);
  // Commit-window guard (review r1 failure, work/claude-ui-sweep/0.2.120/chin-listener-race-probe.mjs): with
  // performance.now() jumping so React's Scheduler yields before its passive-effect task, a MutationObserver on the
  // status span dispatches the second chord right after the 'Fast mode on' commit; the listener must already see
  // fastSaving false (main.jsx registers it in a layout effect), so the chord is claimed and turns Fast back off.
  metrics.chinFastCommitWindow = await page.evaluate(() => new Promise(resolve => {
    const status = document.querySelector('.sc-chin span[role="status"].sr-only'), target = document.querySelector('[aria-label="Message DeepSeek"]'), now = performance.now;
    let offset = 0; const result = { first: null, second: null };
    const chord = () => { const event = new KeyboardEvent("keydown", { key: "ƒ", code: "KeyF", metaKey: true, altKey: true, bubbles: true, cancelable: true }); target.dispatchEvent(event); return event.defaultPrevented; };
    const observer = new MutationObserver(() => { if (status.textContent !== "Fast mode on" || result.second !== null) return; result.second = chord(); performance.now = now; observer.disconnect(); });
    observer.observe(status, { characterData: true, childList: true, subtree: true });
    performance.now = function () { return now.call(performance) + (offset += 100); };
    result.first = chord();
    setTimeout(() => { performance.now = now; observer.disconnect(); resolve(result); }, 3000);
  }));
  await page.waitForFunction(() => document.querySelector('.sc-chin span[role="status"].sr-only')?.textContent === "Fast mode off");
  assert.deepEqual(metrics.chinFastCommitWindow, { first: true, second: true }, "a chord right after the commit sees the committed state");
  assert.equal((await readPreferences()).fastMode, false);
  // Chords do nothing while Settings is open (not claimed, no menu, no fast toggle).
  await page.keyboard.press("Meta+,");
  const settingsDialog = page.getByRole("dialog", { name: "Settings", exact: true });
  await settingsDialog.waitFor();
  metrics.chinUnderSettings = { model: await synthetic({ key: "I", code: "KeyI", metaKey: true, shiftKey: true }), mode: await synthetic({ key: "M", code: "KeyM", metaKey: true, shiftKey: true }),
    effort: await synthetic({ key: "E", code: "KeyE", metaKey: true, shiftKey: true }), fast: await synthetic({ key: "f", code: "KeyF", metaKey: true, altKey: true }) };
  await frames(4);
  assert.deepEqual(metrics.chinUnderSettings, { model: false, mode: false, effort: false, fast: false }, "no chord is claimed under Settings");
  assert.equal(await modelsMenu().count() + await modeMenu().count() + await effortPopover().count(), 0);
  assert.equal(await fastStatus().textContent(), "Fast mode off"); assert.equal((await readPreferences()).fastMode, false);
  await page.keyboard.press("Escape");
  await settingsDialog.waitFor({ state: "detached" });
  checks.push("0.2.120 chin chords: a repeated ⌘⇧I is preventDefault'ed but opens nothing; ⌘⇧I opens Models (same chord closes, Escape closes); ⌘⇧E opens the effort popover (fixture has 4 efforts) and ⌘⇧I is ignored while it is open; ⌘⇧M opens Mode and, dispatched on the editor outside the popup (capture path only), Digit0 is claimed but selects nothing and Digit2 is claimed and selects the 2nd item, a plain digit is unclaimed with Mode closed, ⌥⌘M + a repeated digit restores; hovering Mode shows CDS 'Mode' + ⇧⌘M, Effort shows 'Effort', no native title on Mode/Model/Effort; ⌥⌘F toggles the fixture Fast tier (sr-only role=status 'Fast mode on'/'off', persisted fastMode) and back; a chord dispatched in the commit window right after 'Fast mode on' (Scheduler forced to yield before passive effects) is claimed and turns Fast off; under Settings no chord is claimed or acts");

  // 17. Fidelity F03 environment chips on the New draft (cc43287c9-BMbiZYzF.js dH :21863-22100): CDS tooltips with the
  // source copy (no native title in the row), the lH Recent folder picker (radio rows, Delete dismisses a non-current
  // recent and persists it, 'Open folder…' browses with the 'Select folder for local session' dialog) and the hT branch
  // search (step 1: 'No branches match', Enter picks the first match, worktree untouched). Popover and menu surfaces are
  // read in light and dark.
  await page.mouse.move(100, 700);
  await page.getByRole("button", { name: "New", exact: true }).click();
  await expectPlaceholder("Describe a task or ask a question", "New draft for the environment chips");
  const contextRow = page.locator(".sc-context-row"), folderChip = page.locator(".sc-context-row .sc-folder-chip");
  await contextRow.waitFor();
  const rowTitles = () => contextRow.evaluate((row) => [...row.querySelectorAll("[title]")].map((node) => node.outerHTML.slice(0, 80)));
  assert.deepEqual(await rowTitles(), [], "no native title inside .sc-context-row");
  assert.equal(await folderChip.getAttribute("aria-label"), path.basename(workspace), "the folder chip is named by its basename");
  const chipTip = async (locator) => {
    await page.mouse.move(100, 700);
    await page.locator(".source-tooltip-popup").waitFor({ state: "detached" });
    await locator.hover();
    await page.locator('.source-tooltip-popup[data-state="open"]').waitFor();
    return page.locator(".source-tooltip-popup").evaluate((node) => ({ label: node.querySelector(".source-tooltip-label")?.textContent,
      detail: node.querySelector(".source-tooltip-detail")?.textContent ?? null, rtl: node.querySelector(".source-tooltip-detail .sc-tooltip-path") ? getComputedStyle(node.querySelector(".sc-tooltip-path")).direction : null,
      hoverable: node.dataset.hoverable }));
  };
  metrics.envTooltips = {
    local: await chipTip(page.locator(".sc-context-row .sc-context-chip").first()),
    folder: await chipTip(folderChip),
    addFolder: await chipTip(page.locator(".sc-context-row .sc-add-folder")),
  };
  assert.deepEqual(metrics.envTooltips, {
    local: { label: "Where DeepSeek runs", detail: null, rtl: null, hoverable: "false" },
    folder: { label: "Working directory", detail: workspace, rtl: "rtl", hoverable: "true" },
    addFolder: { label: "Add another folder", detail: null, rtl: null, hoverable: "false" },
  });
  await page.mouse.move(100, 700);
  // lH menu: 'Recent' group with the current folder as the checked radio, then 'Open folder…'.
  const folderMenu = page.getByRole("menu", { name: "Working directory", exact: true });
  const readFolderMenu = () => folderMenu.evaluate((menu) => ({ label: menu.querySelector(".smenu-group-label")?.textContent, side: menu.dataset.side, align: menu.dataset.align,
    rows: [...menu.querySelectorAll('[role="menuitemradio"]')].map((node) => [node.dataset.recentFolder, node.getAttribute("aria-checked"), node.getAttribute("title"),
      node.getAttribute("aria-keyshortcuts"), !!node.querySelector("[data-dismiss-recent]")]),
    items: [...menu.querySelectorAll('[role="menuitem"]')].map((node) => node.textContent), separators: menu.querySelectorAll('[role="separator"]').length }));
  await folderChip.click();
  await folderMenu.waitFor();
  metrics.folderMenuInitial = await readFolderMenu();
  assert.deepEqual(metrics.folderMenuInitial, { label: "Recent", side: "top", align: "start", rows: [[workspace, "true", workspace, null, false]], items: ["Open folder…"], separators: 1 });
  await app.evaluate(({ dialog }, folder) => {
    globalThis.__folderDialogs = [];
    dialog.showOpenDialog = async (_window, options) => { globalThis.__folderDialogs.push({ title: options.title, message: options.message }); return { canceled: false, filePaths: [folder] }; };
  }, pickerRepo);
  await folderMenu.getByRole("menuitem", { name: "Open folder…", exact: true }).click();
  await page.waitForFunction((name) => document.querySelector(".sc-context-row .sc-folder-chip")?.getAttribute("aria-label") === name, path.basename(pickerRepo));
  metrics.folderDialogs = await app.evaluate(() => globalThis.__folderDialogs);
  assert.deepEqual(metrics.folderDialogs, [{ title: "Select folder for local session", message: "Select folder for local session" }]);
  // The browsed folder is prepended and checked; the session folder is a dismissible recent.
  await folderChip.click();
  await folderMenu.waitFor();
  metrics.folderMenuTwo = await readFolderMenu();
  await page.screenshot({ path: path.join(directory, "env-folder-recent-menu.png") });
  assert.deepEqual(metrics.folderMenuTwo.rows, [[pickerRepo, "true", pickerRepo, null, false], [workspace, "false", workspace, "Delete", true]]);
  await page.waitForFunction(() => document.activeElement?.closest('[role="menu"]')?.getAttribute("aria-label") === "Working directory");
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction((dir) => document.querySelector('[role="menu"] [data-highlighted]')?.dataset.recentFolder === dir, workspace);
  metrics.dismissVisible = await page.evaluate(() => getComputedStyle(document.querySelector('[role="menu"] [data-highlighted] .sc-recent-dismiss')).opacity);
  assert.equal(metrics.dismissVisible, "1", "the highlighted recent reveals its Remove from recent X");
  await page.keyboard.press("Delete");
  await page.waitForFunction(() => document.querySelectorAll('[role="menu"] [role="menuitemradio"]').length === 1);
  assert.equal(await folderMenu.count(), 1, "dismissing keeps the menu open");
  await page.waitForFunction(() => document.activeElement?.closest('[role="menu"]')?.getAttribute("aria-label") === "Working directory");
  // The row leaves at once (optimistic); main.cjs dismiss-recent-folder then saves the dismissedAt.
  const persistedDismissal = async () => JSON.parse(await fs.readFile(path.join(profile, "preferences.json"), "utf8")).dismissedRecentFolders?.[workspace];
  for (const deadline = Date.now() + 5000; !Number.isFinite(await persistedDismissal()) && Date.now() < deadline;) await new Promise((resolve) => setTimeout(resolve, 60));
  assert.ok(Number.isFinite(await persistedDismissal()), "the dismissal persists a dismissedAt for the folder");
  metrics.folderMenuDismissed = (await readFolderMenu()).rows;
  assert.deepEqual(metrics.folderMenuDismissed, [[pickerRepo, "true", pickerRepo, null, false]]);
  await page.keyboard.press("Escape");
  await folderMenu.waitFor({ state: "detached" });
  checks.push("F03 env chips: no [title] in .sc-context-row; the folder chip is named by its basename; tooltips 'Where DeepSeek runs' (hoverable false), 'Working directory' with the RTL path detail, 'Add another folder'; the Recent menu (side top, align start) lists the current folder as the checked radio and 'Open folder…' after a separator; browsing uses the 'Select folder for local session' dialog and prepends the new folder; ArrowDown + Delete dismisses the non-current recent, keeps the menu open and persists dismissedRecentFolders");

  // Popover and menu surfaces in light and dark: --cds-surface-3 on both.
  metrics.envSurfaces = {};
  for (const mode of ["light", "dark"]) {
    await page.evaluate((mode) => { document.documentElement.dataset.mode = mode; }, mode);
    const surface = (node) => { const probe = document.createElement("span"); probe.style.color = "var(--cds-surface-3)"; node.appendChild(probe); const color = getComputedStyle(probe).color; probe.remove(); return [getComputedStyle(node).backgroundColor, color, node.closest("[data-cds-portal]")?.getAttribute("data-mode")]; };
    await folderChip.click();
    await folderMenu.waitFor();
    const menuSurface = await folderMenu.evaluate(surface);
    await page.screenshot({ path: path.join(directory, `env-folder-menu-${mode}.png`) });
    await page.keyboard.press("Escape");
    await folderMenu.waitFor({ state: "detached" });
    await usageTrigger().click();
    const draftUsage = page.getByRole("dialog", { name: "Usage", exact: true });
    await draftUsage.waitFor();
    const popoverSurface = await draftUsage.evaluate(surface);
    await page.screenshot({ path: path.join(directory, `env-usage-popover-${mode}.png`) });
    await page.keyboard.press("Escape");
    await draftUsage.waitFor({ state: "detached" });
    metrics.envSurfaces[mode] = { menu: menuSurface, popover: popoverSurface };
    assert.equal(menuSurface[0], menuSurface[1], `${mode} menu paints surface-3`); assert.equal(menuSurface[2], mode);
    assert.equal(popoverSurface[0], popoverSurface[1], `${mode} popover paints surface-3`); assert.equal(popoverSurface[2], mode);
  }
  assert.notEqual(metrics.envSurfaces.light.popover[0], metrics.envSurfaces.dark.popover[0], "the popover surface follows the mode");
  await page.evaluate(() => { document.documentElement.dataset.mode = "light"; });
  checks.push("F03 surfaces: the Recent menu and the usage popover portals copy data-mode and paint --cds-surface-3 in light and dark");

  // hT step 1: the repo's branch chip opens a searchable radio list (main first, then localeCompare).
  const branchChip = page.locator(".sc-context-row .sc-branch-chip"), worktreeBox = page.locator(".sc-context-row .sc-worktree input");
  // The chip's label is its last span (the icon glyph precedes it).
  const branchLabel = (name) => page.waitForFunction((name) => document.querySelector(".sc-context-row .sc-branch-chip > span:last-child")?.textContent === name, name);
  await branchLabel("main");
  metrics.branchTooltips = { branch: await chipTip(branchChip), worktree: await chipTip(page.locator(".sc-context-row .sc-worktree")) };
  assert.deepEqual(metrics.branchTooltips, { branch: { label: "Branch to start from", detail: null, rtl: null, hoverable: "true" },
    worktree: { label: "Work in an isolated copy of the repository", detail: null, rtl: null, hoverable: "false" } });
  metrics.worktreeDescription = await worktreeBox.evaluate((input) => document.getElementById(input.getAttribute("aria-describedby"))?.textContent);
  assert.equal(metrics.worktreeDescription, "Work in an isolated copy of the repository");
  assert.deepEqual(await rowTitles(), [], "no native title inside .sc-context-row with the branch chip");
  await page.mouse.move(100, 700);
  const worktreeBefore = await worktreeBox.isChecked();
  await branchChip.click();
  const branchMenu = page.getByRole("menu", { name: "Branch", exact: true }), branchSearch = branchMenu.getByRole("textbox", { name: "Search branches…", exact: true });
  await branchMenu.waitFor();
  await page.waitForFunction(() => document.activeElement?.matches('[role="menu"] input[aria-label="Search branches…"]'));
  metrics.branchMenu = await branchMenu.evaluate((menu) => {
    const chip = document.querySelector(".sc-context-row .sc-branch-chip").getBoundingClientRect(), box = menu.getBoundingClientRect();
    const rows = [...menu.querySelectorAll('[role="menuitemradio"]')];
    return { side: menu.dataset.side, align: menu.dataset.align, gap: Math.round(chip.top - box.bottom), rows: rows.map((node) => [node.dataset.branch, node.getAttribute("aria-checked")]),
      icons: menu.querySelectorAll(".smenu-icon").length, headings: menu.querySelectorAll(".smenu-group-label, .smenu-header").length,
      placeholder: menu.querySelector("input").placeholder, fieldLast: menu.querySelector(".sc-branch-search").getBoundingClientRect().top >= rows.at(-1).getBoundingClientRect().bottom };
  });
  assert.deepEqual(metrics.branchMenu, { side: "top", align: "start", gap: 8, rows: [["main", "true"], ["feature/login", "false"], ["zeta-topic", "false"]],
    icons: 0, headings: 0, placeholder: "Search branches…", fieldLast: true });
  await page.screenshot({ path: path.join(directory, "env-branch-menu.png") });
  // Typed characters stay in the field (no menu typeahead) and filter the list.
  await page.keyboard.type("zzz");
  assert.equal(await branchSearch.inputValue(), "zzz");
  await branchMenu.locator(".sc-branch-empty", { hasText: "No branches match" }).waitFor();
  assert.equal(await branchMenu.getByRole("menuitemradio").count(), 0);
  await page.screenshot({ path: path.join(directory, "env-branch-empty.png") });
  await branchSearch.fill("zeta");
  await page.waitForFunction(() => document.querySelectorAll('[role="menu"] [role="menuitemradio"]').length === 1);
  assert.equal(await branchMenu.locator(".sc-branch-empty").count(), 0);
  await branchSearch.press("Enter");
  await branchMenu.waitFor({ state: "detached" });
  await branchLabel("zeta-topic");
  assert.equal(await worktreeBox.isChecked(), worktreeBefore, "choosing a branch leaves the worktree checkbox unchanged");
  await page.screenshot({ path: path.join(directory, "env-chips-branch.png") });
  checks.push("F03 branch picker: tooltip 'Branch to start from' and the worktree label tooltip with an sr-only description; the menu (side top, align start, 8px above) focuses 'Search branches…', lists main / feature/login / zeta-topic as radio rows without icons or heading and the field last; 'zzz' stays in the field and shows 'No branches match'; Enter picks the first match 'zeta-topic' and the worktree checkbox is unchanged");

  // 17b. R05 branch step 2 without a worktree (cc43287c9-BMbiZYzF.js:12084-12145 me/he/ge, :15860-16120 UR/GR, :35132
  // branchChanged + the spawn's 'git switch'): a clean pick is recorded and the next spawn checks it out first; on a
  // dirty tree the pick opens the GR alert dialog, whose Cancel keeps the branch and whose Stash stashes the changes.
  const historyLog = path.join(profile, "fixture-history.jsonl");
  const historyOf = async (method) => { let text = ""; try { text = await fs.readFile(historyLog, "utf8"); } catch { return []; }
    return text.split("\n").filter(Boolean).map(line => JSON.parse(line)).filter(entry => entry.method === method); };
  const checkedOut = () => git("branch", "--show-current").trim();
  if (await worktreeBox.isChecked()) await worktreeBox.uncheck();
  const pickBranch = async (name) => {
    await branchChip.click();
    await branchMenu.waitFor();
    await branchMenu.locator(`[role="menuitemradio"][data-branch="${name}"]`).click();
    await branchMenu.waitFor({ state: "detached" });
  };
  await pickBranch("feature/login");
  await branchLabel("feature/login");
  assert.equal(checkedOut(), "main", "a clean pick only records the branch");
  const branchStarts = (await historyOf("thread/start")).length, branchTurns = (await requests("turn/start")).length;
  // R05 review: a pause while typing stores a prefix of the Home draft (the 300 ms debounce); Enter right after the
  // last keystroke hands the draft to the new session, so that stored prefix must not come back on Home.
  await fillComposer(page, editor(), "fixture:complete on");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("composer-draft:epitaxy-draft") || "{}").text === "fixture:complete on");
  await page.keyboard.insertText(" feature login");
  await page.waitForFunction(() => document.querySelector('[data-cds="ChatComposerEditor"]').value === "fixture:complete on feature login");
  await page.keyboard.press("Enter");
  await waitCount("turn/start", branchTurns + 1);
  metrics.branchCheckout = { branch: checkedOut(), starts: (await historyOf("thread/start")).length - branchStarts, cwd: (await historyOf("thread/start")).at(-1)?.params.cwd };
  assert.deepEqual(metrics.branchCheckout, { branch: "feature/login", starts: 1, cwd: pickerRepo }, "the spawn switched the checkout before thread/start");
  await page.locator(".assistant-message").filter({ hasText: "Fixture response" }).last().waitFor();
  await idle();
  await page.getByRole("button", { name: "New", exact: true }).click();
  await branchLabel("feature/login");
  await page.waitForTimeout(400);
  metrics.homeAfterSend = await page.evaluate(() => ({ value: document.querySelector('[data-cds="ChatComposerEditor"]').value, stored: localStorage.getItem("composer-draft:epitaxy-draft") }));
  assert.deepEqual(metrics.homeAfterSend, { value: "", stored: null }, "the sent Home draft leaves no stored prefix behind");
  // R05 review (GitStatusService.wouldBranchSwitchConflict): dirty paths the target does not change (an untracked
  // file) record the pick without the dialog; 'git switch' carries them over.
  const scratchFile = path.join(pickerRepo, "scratch-notes.txt");
  await fs.writeFile(scratchFile, "untracked\n");
  await pickBranch("main");
  await branchLabel("main");
  metrics.branchCarryOver = { dialogs: await page.getByRole("dialog", { name: "Uncommitted changes on feature/login", exact: true }).count(), checkedOut: checkedOut() };
  assert.deepEqual(metrics.branchCarryOver, { dialogs: 0, checkedOut: "feature/login" }, "a non-conflicting dirty tree only records the pick");
  await pickBranch("feature/login");
  await branchLabel("feature/login");
  await fs.rm(scratchFile);
  // A dirty tree: GR asks how to handle the changes; Cancel keeps the branch.
  await fs.appendFile(path.join(pickerRepo, "README.md"), "uncommitted line\n");
  await pickBranch("zeta-topic");
  const switchDialog = page.getByRole("dialog", { name: "Uncommitted changes on feature/login", exact: true });
  await switchDialog.waitFor();
  await page.waitForFunction(() => document.activeElement?.textContent === "Cancel");
  metrics.branchDialog = await switchDialog.evaluate((node) => ({ alert: node.hasAttribute("data-alert"), cds: node.dataset.cds,
    description: node.querySelector(".sdlg-description")?.textContent, files: node.querySelector(".sbs-files")?.textContent,
    code: [...node.querySelectorAll("code")].map((code) => code.textContent),
    buttons: [...node.querySelectorAll("button")].map((button) => button.getAttribute("aria-label") || button.textContent),
    split: node.querySelector('[data-cds="SplitDropdownButton"]')?.getAttribute("aria-label"), width: Math.round(node.getBoundingClientRect().width) }));
  assert.deepEqual({ ...metrics.branchDialog, width: undefined }, { alert: true, cds: "ConfirmationDialog", description: "Handle them before switching to zeta-topic.",
    files: "1 file changed+1 −0", code: ["feature/login", "zeta-topic"], buttons: ["Cancel", "Stash changes", "More options"], split: "Stash changes", width: undefined });
  assert.ok(metrics.branchDialog.width <= 480, "max-w-[30rem]");
  await switchDialog.getByRole("button", { name: "More options", exact: true }).click();
  const switchModes = page.getByRole("menu", { name: "More options", exact: true });
  await switchModes.waitFor();
  metrics.branchModes = await switchModes.evaluate((menu) => [...menu.querySelectorAll('[role="menuitemradio"]')].map((node) => [node.querySelector(".smenu-label")?.textContent, node.getAttribute("aria-checked")]));
  assert.deepEqual(metrics.branchModes, [["Stash changes", "true"], ["Commit as WIP", "false"], ["Discard changes", "false"]]);
  await page.screenshot({ path: path.join(directory, "branch-switch-dialog.png") });
  await page.keyboard.press("Escape");
  await switchModes.waitFor({ state: "detached" });
  await switchDialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await switchDialog.waitFor({ state: "detached" });
  await branchLabel("feature/login");
  assert.equal(checkedOut(), "feature/login", "Cancel keeps the old branch");
  // Stash: 'git stash push -u -m "epitaxy: pre-switch from feature/login"'; the target is recorded for the next spawn.
  await pickBranch("zeta-topic");
  await switchDialog.waitFor();
  await switchDialog.getByRole("button", { name: "Stash changes", exact: true }).click();
  await switchDialog.waitFor({ state: "detached" });
  await branchLabel("zeta-topic");
  metrics.branchStash = { stashes: git("stash", "list").trim().split("\n").filter(Boolean), status: git("status", "--porcelain").trim() };
  assert.equal(metrics.branchStash.stashes.length, 1, "one stash entry");
  assert.match(metrics.branchStash.stashes[0], /epitaxy: pre-switch from feature\/login/);
  assert.equal(metrics.branchStash.status, "", "the working tree is clean");
  checks.push("R05 branch step 2 (worktree off): picking feature/login only relabels the chip; the Enter send runs 'git switch' first (checkout feature/login, one thread/start in picker-repo); with a dirty README the zeta-topic pick opens the alert dialog 'Uncommitted changes on feature/login' / 'Handle them before switching to zeta-topic.' ('1 file changed +1 −0', focus on Cancel, Stash changes split button whose More options menu holds Stash changes / Commit as WIP / Discard changes); Cancel keeps feature/login; Stash leaves one 'epitaxy: pre-switch from feature/login' stash and records zeta-topic");

  // 17c. R05 'Send and stay here' (cc43287c9 :35140-35200 stayOnDraft; c099c328d :11081-11088, :11270-11282): ⌘⏎ on
  // Home switches to the recorded branch, starts the session detached (one thread/start, one turn/start), inserts its
  // row and leaves Home with an empty, focused composer.
  const stayStarts = (await historyOf("thread/start")).length, stayTurns = (await requests("turn/start")).length;
  await fillComposer(page, editor(), "fixture:complete stay");
  await page.keyboard.press("Meta+Enter");
  await waitCount("turn/start", stayTurns + 1);
  const stayThread = (await requests("turn/start")).at(-1).params.threadId;
  await page.locator(`[data-source-session-id="${stayThread}"]`).waitFor();
  await page.waitForFunction(() => !document.querySelector(".sc-composer")?.hasAttribute("data-disabled") && !!document.activeElement?.closest(".sc-input"));
  await page.waitForTimeout(400);
  metrics.stay = { placeholder: await expectPlaceholder("Describe a task or ask a question", "Home stays open with an empty composer"),
    focused: await page.evaluate(() => !!document.activeElement?.closest(".sc-input")), branch: checkedOut(),
    starts: (await historyOf("thread/start")).length - stayStarts, turns: (await requests("turn/start")).length - stayTurns,
    row: await page.locator(`[data-source-session-id="${stayThread}"]`).textContent(), current: await page.locator(`[data-source-session-id="${stayThread}"] [aria-current="page"]`).count() };
  assert.deepEqual({ ...metrics.stay, placeholder: undefined, row: undefined }, { placeholder: undefined, focused: true, branch: "zeta-topic", starts: 1, turns: 1, row: undefined, current: 0 });
  assert.match(metrics.stay.row, /fixture:complete stay/, "the new row is titled from the first line");
  assert.equal((await requests("turn/start")).at(-1).params.input[0].text, "fixture:complete stay");
  await page.screenshot({ path: path.join(directory, "send-and-stay-home.png") });
  checks.push("R05 Send and stay here: ⌘⏎ on Home with 'fixture:complete stay' checks out zeta-topic, sends exactly one thread/start and one turn/start, inserts the 'fixture:complete stay' sidebar row (not current) and stays on Home with an empty, refocused composer ('Describe a task or ask a question'); Enter still navigates (17b, 18a)");
  // R05 review: with the worktree on, a background launch leaves the Home folder and the Worktree checkbox alone
  // (stayOnDraft keeps the draft environment), so two ⌘⏎ launches start in two different new worktrees.
  await worktreeBox.check();
  const worktreeStarts = (await historyOf("thread/start")).length, worktreeThreads = [];
  for (const label of ["one", "two"]) {
    const turns = (await requests("turn/start")).length;
    await fillComposer(page, editor(), `fixture:complete stay worktree ${label}`);
    await page.keyboard.press("Meta+Enter");
    await waitCount("turn/start", turns + 1);
    worktreeThreads.push((await requests("turn/start")).at(-1).params.threadId);
    await page.waitForFunction(() => !document.querySelector(".sc-composer")?.hasAttribute("data-disabled") && !!document.activeElement?.closest(".sc-input"));
  }
  const worktreeDone = async () => { const { threads } = await readThreads(); return worktreeThreads.every((id) => threads[id]?.turns.at(-1)?.status === "completed"); };
  for (const deadline = Date.now() + 6000; !(await worktreeDone()) && Date.now() < deadline;) await new Promise((resolve) => setTimeout(resolve, 60));
  await expectPlaceholder("Describe a task or ask a question", "Home stays open after the worktree launches");
  const worktreeCwds = (await historyOf("thread/start")).slice(worktreeStarts).map((entry) => entry.params.cwd);
  metrics.stayWorktree = { starts: worktreeCwds.length, distinct: new Set(worktreeCwds).size, inRepo: worktreeCwds.filter((cwd) => cwd === pickerRepo).length,
    worktrees: worktreeCwds.filter((cwd) => cwd.includes(`${path.sep}.code${path.sep}worktrees${path.sep}`)).length,
    folder: await page.locator(".sc-context-row .sc-folder-chip").getAttribute("aria-label"), checked: await worktreeBox.isChecked(), branch: checkedOut() };
  assert.deepEqual(metrics.stayWorktree, { starts: 2, distinct: 2, inRepo: 0, worktrees: 2, folder: path.basename(pickerRepo), checked: true, branch: "zeta-topic" });
  await worktreeBox.uncheck();
  checks.push("R05 review: with the worktree checkbox on, two ⌘⏎ launches from Home start in two different new worktrees (.code/worktrees), and Home keeps the picker-repo folder chip, the checked Worktree box and the zeta-topic checkout");

  // 18. Fidelity F05 composer behaviour.
  // 18a. Per-session drafts (code-workspace.js:1888-1915 Ul; cc43287c9-BMbiZYzF.js:28617, :6425-6450): text and a staged
  // image survive a switch to another session and back; a send clears that session's draft.
  await page.mouse.move(100, 700);
  await open(G, `${G}-answer-0`);
  await fillComposer(page, editor(), "half-written");
  await pasteFiles([{ name: "draft.png", type: "image/png", bytes: PNG.toString("base64") }]);
  await page.locator('[data-cds-attachment][data-status="ready"]').waitFor();
  await open(E, `${E}-answer-1`);
  metrics.draftOther = { value: await editor().evaluate(node => node.value), pills: await page.locator("[data-cds-attachment]").count() };
  assert.deepEqual(metrics.draftOther, { value: "", pills: 0 }, "the other session's composer is empty");
  await open(G, `${G}-answer-0`);
  await page.waitForFunction(() => document.querySelector(".sc-input").value === "half-written");
  metrics.draftBack = await page.evaluate(() => ({ value: document.querySelector(".sc-input").value,
    pills: [...document.querySelectorAll("[data-cds-attachment]")].map(node => [node.dataset.kind, node.dataset.status, !!node.querySelector("img")?.getAttribute("src")]) }));
  assert.deepEqual(metrics.draftBack, { value: "half-written", pills: [["image", "ready", true]] }, "the draft and its pill come back");
  await page.locator('[data-cds-attachment][data-kind="image"]').hover();
  await page.locator('[data-cds-attachment] .epitaxy-pill-remove').click();
  await fillComposer(page, editor(), "fixture:complete draft send");
  const startsDraft = (await requests("turn/start")).length;
  await page.keyboard.press("Enter");
  await waitCount("turn/start", startsDraft + 1);
  await idle();
  await open(E, `${E}-answer-1`);
  await open(G, `${G}-answer-0`);
  assert.equal(await editor().evaluate(node => node.value), "", "a sent draft does not come back");
  // A first message from Home whose turn/start is still pending when another session opens (the fixture holds a
  // 'delayed-start' reply 1.5 s): thread/start already made the new thread current, so leaving it stashed the live
  // draft under its id. The send's success clears that stash as well, so the new session opens empty.
  await page.getByRole("button", { name: "New", exact: true }).click();
  await fillComposer(page, editor(), "fixture:complete delayed-start from home");
  assert.equal(await page.locator("[data-cds-attachment]").count(), 0);
  const startsHome = (await requests("turn/start")).length;
  await page.keyboard.press("Enter");
  await waitCount("turn/start", startsHome + 1);
  const createdHome = (await requests("turn/start")).at(-1).params.threadId;
  assert.ok(![A, B, C, D, E, F, G].includes(createdHome), "the Home send created a thread");
  await open(E, `${E}-answer-1`);
  for (const deadline = Date.now() + 6000; (await readThreads()).threads[createdHome]?.turns.at(-1)?.status !== "completed" && Date.now() < deadline;) await new Promise(resolve => setTimeout(resolve, 60));
  await frames(4);
  await page.locator(`[data-source-session-id="${createdHome}"] .source-session-open`).click();
  await page.locator(".assistant-message").filter({ hasText: "Fixture response" }).last().waitFor();
  await page.locator(".loading-state").waitFor({ state: "detached" });
  metrics.homeSendStash = { value: await editor().evaluate(node => node.value), pills: await page.locator("[data-cds-attachment]").count() };
  assert.deepEqual(metrics.homeSendStash, { value: "", pills: 0 }, "a first message sent from Home does not come back in its new session");
  checks.push("F05 per-session drafts: 'half-written' + a pasted image pill in session G are gone in session E and both return (pill ready, preview kept) on the way back to G; after a send, G returns empty; a Home send left (for E) while its turn/start was held does not come back when its new session opens");

  // 18b. Typing while the session loads (cc43287c9 :27612 Jr): F's thread/resume is held 2.5s; the editor takes 'abc' at once.
  await page.locator(`[data-source-session-id="${F}"] .source-session-open`).click();
  await page.locator(".loading-state").waitFor();
  await editor().focus();
  await page.keyboard.type("abc");
  metrics.heldResume = { loading: await page.locator(".loading-state").count(), value: await editor().evaluate(node => node.value), card: await page.locator(".sc-composer").getAttribute("data-disabled") };
  assert.deepEqual(metrics.heldResume, { loading: 1, value: "abc", card: null }, "typed while thread/resume is held");
  await page.locator(`[data-transcript-item-id="${F}-answer-0"]`).waitFor();
  await page.locator(".loading-state").waitFor({ state: "detached" });
  assert.equal(await editor().evaluate(node => node.value), "abc", "the draft survives the load");
  await fillComposer(page, editor(), "");
  checks.push("F05 editable while loading: during a held thread/resume the card is not data-disabled and typing 'abc' lands in the editor, which keeps it once the rows hydrate");

  // 18c. Idle Escape in the editor blurs it (c099c328d :11223-11245 $?.commands.blur()).
  await editor().focus();
  await page.keyboard.press("Escape");
  metrics.idleEscape = await page.evaluate(() => !!document.activeElement?.closest(".sc-input"));
  assert.equal(metrics.idleEscape, false, "idle Escape leaves the editor");

  // 18d. During a held turn the chin pickers work (c360a9e1c:4544-4575, :4942, :2829): ⇧⌘I opens Models (Escape closes it
  // without stopping), ⇧⌘M opens Mode and Manual is saved; ↑ in the empty editor takes back the newest queued message;
  // Escape from the transcript (focus outside the editor) stops the turn exactly once.
  await open(G, `${G}-answer-0`);
  await fillComposer(page, editor(), "fixture:hold");
  await page.keyboard.press("Enter");
  await stopButton().waitFor();
  const interruptsHeld = (await requests("turn/interrupt")).length;
  await page.waitForFunction(() => !document.querySelector(".sc-chin .sc-permission").disabled);
  metrics.heldPickers = await page.evaluate(() => [".sc-permission", ".sc-model-trigger", ".sc-effort-trigger"].map(selector => document.querySelector(`.sc-chin ${selector}`).disabled));
  assert.deepEqual(metrics.heldPickers, [false, false, false], "Mode, Model and Effort stay enabled while the turn runs");
  await editor().focus();
  await page.keyboard.press("Meta+Shift+KeyI");
  await modelsMenu().waitFor();
  await page.keyboard.press("Escape");
  await modelsMenu().waitFor({ state: "detached" });
  await page.waitForTimeout(250);
  assert.equal((await requests("turn/interrupt")).length, interruptsHeld, "Escape that closes a menu never stops the turn");
  assert.equal(await stopButton().count(), 1);
  await editor().focus();
  await page.keyboard.press("Meta+Shift+KeyM");
  await modeMenu().waitFor();
  await modeMenu().getByRole("menuitemradio", { name: /^Manual/ }).click();
  await modeMenu().waitFor({ state: "detached" });
  await page.waitForFunction(() => document.querySelector(".sc-chin .sc-permission")?.textContent === "Manual");
  for (const deadline = Date.now() + 5000; (await readPreferences()).permission !== "ask" && Date.now() < deadline;) await new Promise(resolve => setTimeout(resolve, 60));
  assert.equal((await readPreferences()).permission, "ask", "the Mode change is saved during the turn");
  // ↑ dequeue (cc43287c9 :31152-31156): two ⌘⏎ entries, then ↑ in the empty editor restores the second.
  const queueAdds = (await requests("thread/queue/add")).length, queueDeletes = (await requests("thread/queue/delete")).length;
  for (const text of ["queued one", "queued two"]) { await fillComposer(page, editor(), text); await page.keyboard.press("Meta+Enter"); }
  await waitCount("thread/queue/add", queueAdds + 2);
  await page.locator('[data-queued-messages][data-count="2"]').waitFor();
  await fillComposer(page, editor(), "");
  await page.keyboard.press("ArrowUp");
  await page.waitForFunction(() => document.querySelector(".sc-input").value === "queued two");
  await waitCount("thread/queue/delete", queueDeletes + 1);
  await page.locator('[data-queued-messages] .sqm-single').waitFor();
  metrics.dequeue = { value: await editor().evaluate(node => node.value), count: await page.locator("[data-queued-messages] .sqm-count").textContent(), history: await page.locator(".sc-history-header").count(),
    left: (await readThreads()).threads[G].queue.map(entry => entry.input[0].text) };
  assert.deepEqual(metrics.dequeue, { value: "queued two", count: "1 message queued", history: 0, left: ["queued one"] });
  await page.getByRole("button", { name: "Remove from queue", exact: true }).click();
  await page.locator("[data-queued-messages]").waitFor({ state: "detached" });
  await fillComposer(page, editor(), "");
  // Escape with focus in the transcript (not the editor) stops the turn through the window listener, once.
  await page.locator(`[data-transcript-item-id="${G}-answer-0"]`).click();
  metrics.escapeTarget = await page.evaluate(() => !!document.activeElement?.closest(".sc-input"));
  assert.equal(metrics.escapeTarget, false, "focus left the editor");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await waitCount("turn/interrupt", interruptsHeld + 1);
  await stopButton().waitFor({ state: "detached" });
  await page.waitForTimeout(300);
  assert.equal((await requests("turn/interrupt")).length, interruptsHeld + 1, "exactly one turn/interrupt");
  await idle();
  // The saved Manual mode goes out with the next turn/start (Codex has no live permission request).
  assert.equal((await requests("codeDesktop/thread/permissions")).length, 0, "a core without capabilities.livePermissions gets no live request");
  const startsManual = (await requests("turn/start")).length;
  await fillComposer(page, editor(), "fixture:complete after manual");
  await page.keyboard.press("Enter");
  await waitCount("turn/start", startsManual + 1);
  metrics.manualTurn = (await requests("turn/start")).at(-1).params.approvalPolicy;
  assert.equal(metrics.manualTurn, "untrusted", "Manual → approvalPolicy untrusted on the next turn/start");
  await idle();
  await editor().focus();
  await page.keyboard.press("Meta+Shift+KeyM");
  await modeMenu().waitFor();
  await modeMenu().getByRole("menuitemradio", { name: /^Auto/ }).click();
  await page.waitForFunction(() => document.querySelector(".sc-chin .sc-permission")?.textContent === "Auto");
  checks.push("F05 during a held turn: Mode/Model/Effort are enabled; ⇧⌘I opens Models and its Escape closes it without a turn/interrupt; ⇧⌘M + Manual saves permission 'ask' and the next turn/start carries approvalPolicy 'untrusted'; with two ⌘⏎ entries ↑ in the empty editor restores 'queued two' via thread/queue/delete and leaves '1 message queued' (no history strip); Escape after clicking a transcript row sends exactly one turn/interrupt; idle Escape blurs the editor");

  // 18e. Mention chip Backspace and Delete (shared-13 Aw; composer-editor-model selectCommandBefore).
  await fillComposer(page, editor(), "look @fix");
  await dropdown.waitFor();
  await page.keyboard.press("Enter");
  await dropdown.waitFor({ state: "detached" });
  await mentionChip().waitFor();
  const chipValue = await editor().evaluate(node => node.value);
  assert.match(chipValue, /^look @fixture-[ab]\.txt $/);
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  metrics.chipBackspace = { value: await editor().evaluate(node => node.value), selected: await mentionChip().evaluate(node => node.querySelector(".sc-mention-chip").hasAttribute("data-selected")) };
  assert.deepEqual(metrics.chipBackspace, { value: chipValue.slice(0, -1), selected: true }, "the first Backspace after the atom selects it");
  await page.keyboard.press("Backspace");
  await mentionChip().waitFor({ state: "detached" });
  assert.equal(await editor().evaluate(node => node.value), "look ");
  await page.keyboard.type("@fix");
  await dropdown.waitFor();
  await page.keyboard.press("Enter");
  await mentionChip().waitFor();
  // Light and dark: the label paints --cds-text-accent in both.
  metrics.mentionChipModes = {};
  for (const mode of ["dark", "light"]) {
    await page.evaluate((mode) => { document.documentElement.dataset.mode = mode; }, mode);
    metrics.mentionChipModes[mode] = await mentionChip().evaluate((node) => { const label = node.querySelector(".sc-mention-chip-label"), probe = document.createElement("span"); probe.style.color = "var(--cds-text-accent)"; node.closest(".sc-composer").appendChild(probe); const accent = getComputedStyle(probe).color; probe.remove(); return [getComputedStyle(label).color, accent]; });
    assert.equal(metrics.mentionChipModes[mode][0], metrics.mentionChipModes[mode][1], `${mode} chip uses --cds-text-accent`);
    await page.locator(".sc-composer").screenshot({ path: path.join(directory, `mention-chip-${mode}.png`) });
  }
  assert.notEqual(metrics.mentionChipModes.dark[0], metrics.mentionChipModes.light[0], "the accent follows the mode");
  await mentionChip().click();
  await mentionMenu.waitFor();
  await mentionMenu.getByRole("menuitem", { name: "Delete", exact: true }).click();
  await mentionChip().waitFor({ state: "detached" });
  assert.equal(await editor().evaluate(node => node.value), "look  ", "Delete removes the atom and keeps the text around it");
  await fillComposer(page, editor(), "");
  checks.push("F05 mention chip: after a pick the first Backspace removes the space, the second selects the atom (data-selected) without changing the text and the third deletes it whole; the chip label paints --cds-text-accent in dark and light; the chip menu's Delete removes it");

  // 18f. A core that lists capabilities.livePermissions (the DeepSeek bridge) takes a Mode change during a turn at once:
  // codeDesktop/thread/permissions with the turn/start permission params (main.jsx appliedMode effect). The fixture
  // advertises it from the next initialize (fixture-core.json), so a throwaway Home thread drops the connection first.
  const coreSeed = path.join(profile, "fixture-core.json");
  await fs.writeFile(coreSeed, JSON.stringify({ capabilities: { livePermissions: true } }));
  await page.getByRole("button", { name: "New", exact: true }).click();
  await fillComposer(page, editor(), "disconnect");
  await page.keyboard.press("Enter");
  await page.locator("[data-cds-composer-warning]").waitFor();
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.locator("[data-cds-composer-warning]").waitFor({ state: "detached" });
  await open(G, `${G}-answer-0`);
  await fillComposer(page, editor(), "fixture:hold");
  await page.keyboard.press("Enter");
  await stopButton().waitFor();
  await page.waitForFunction(() => !document.querySelector(".sc-chin .sc-permission").disabled);
  await editor().focus();
  await page.keyboard.press("Meta+Shift+KeyM");
  await modeMenu().waitFor();
  await modeMenu().getByRole("menuitemradio", { name: /^Manual/ }).click();
  await modeMenu().waitFor({ state: "detached" });
  await waitCount("codeDesktop/thread/permissions", 1);
  const liveMode = (await requests("codeDesktop/thread/permissions"))[0].params;
  metrics.livePermissions = { threadId: liveMode.threadId, approvalPolicy: liveMode.approvalPolicy, sandbox: liveMode.sandboxPolicy?.type, roots: liveMode.sandboxPolicy?.writableRoots?.length > 0, error: await page.locator(".composer-error").count() };
  assert.deepEqual(metrics.livePermissions, { threadId: G, approvalPolicy: "untrusted", sandbox: "workspaceWrite", roots: true, error: 0 }, "the running thread gets Manual's turn/start params");
  await stopButton().click();
  await idle();
  // Idle, the change waits for the next turn/start: no live request.
  await editor().focus();
  await page.keyboard.press("Meta+Shift+KeyM");
  await modeMenu().waitFor();
  await modeMenu().getByRole("menuitemradio", { name: /^Auto/ }).click();
  await page.waitForFunction(() => document.querySelector(".sc-chin .sc-permission")?.textContent === "Auto");
  await page.waitForTimeout(300);
  assert.equal((await requests("codeDesktop/thread/permissions")).length, 1, "an idle Mode change sends no live request");
  await fs.rm(coreSeed);
  checks.push("F05 live Mode on a core with capabilities.livePermissions (fixture-core.json after a reconnect): Manual during a held turn in G sends one codeDesktop/thread/permissions with approvalPolicy 'untrusted' and the workspaceWrite sandboxPolicy, with no composer error; back to Auto while idle sends none");

  // 19. R05 persisted drafts (ion-dist shared-7-DsClUbcz.js ox 'composer-draft:' + cx `epitaxy-<id>` / px
  // 'epitaxy-draft', Xx/Qx; cc43287c9 :7300-7330 restored_draft): a session draft with an '@' mention chip and the
  // Home draft survive a renderer reload (View ▸ Reload, ⌘R); sending the session draft clears its stored key.
  // Session E (completed turns only): A still holds the fixture's 'disconnect' turn (section 13, the process exits
  // mid-turn), which the fixture persists as inProgress, so after the reload A resumes busy and Enter steers instead.
  await open(E, `${E}-answer-1`);
  await fillComposer(page, editor(), "fixture:complete keep me @fix");
  await dropdown.waitFor();
  await page.keyboard.press("Enter");
  await dropdown.waitFor({ state: "detached" });
  await mentionChip().waitFor();
  const keptDraft = await editor().evaluate(node => node.value);
  assert.match(keptDraft, /^fixture:complete keep me @fixture-[ab]\.txt $/);
  await page.getByRole("button", { name: "New", exact: true }).click();
  await fillComposer(page, editor(), "home draft");
  const storedDrafts = () => page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("composer-draft:")).sort());
  await page.waitForFunction((id) => !!localStorage.getItem(`composer-draft:epitaxy-${id}`) && JSON.parse(localStorage.getItem("composer-draft:epitaxy-draft") || "{}").text === "home draft", E);
  metrics.storedDrafts = await storedDrafts();
  await page.reload();
  await editor().waitFor();
  await page.waitForFunction(() => document.querySelector('[data-cds="ChatComposerEditor"]')?.value === "home draft");
  await frames(4);
  metrics.reloadHome = await editor().evaluate(node => node.value);
  await open(E, `${E}-answer-1`);
  await page.waitForFunction((text) => document.querySelector('[data-cds="ChatComposerEditor"]')?.value === text, keptDraft);
  await mentionChip().waitFor();
  metrics.reloadSession = { value: await editor().evaluate(node => node.value), chips: await mentionChip().count(), title: await mentionChip().getAttribute("title") };
  assert.deepEqual({ home: metrics.reloadHome, value: metrics.reloadSession.value, chips: metrics.reloadSession.chips }, { home: "home draft", value: keptDraft, chips: 1 });
  await page.screenshot({ path: path.join(directory, "draft-after-reload.png") });
  const keptTurns = (await requests("turn/start")).length;
  await editor().focus();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await waitCount("turn/start", keptTurns + 1);
  await idle();
  await page.waitForFunction((id) => !localStorage.getItem(`composer-draft:epitaxy-${id}`), E);
  metrics.storedAfterSend = await storedDrafts();
  assert.equal(metrics.storedAfterSend.includes(`composer-draft:epitaxy-${E}`), false, "a sent draft clears its stored key");
  assert.equal(metrics.storedAfterSend.includes("composer-draft:epitaxy-draft"), true, "the Home draft stays stored");
  checks.push("R05 persisted drafts: 'fixture:complete keep me @fixture-…' (one mention chip) in session E and 'home draft' on Home are stored under composer-draft:epitaxy-<id> / composer-draft:epitaxy-draft; after page.reload() Home shows 'home draft' and E shows its draft with the chip; sending E removes its key while the Home key stays");

  await open(A, `${A}-answer-0`);
  await page.screenshot({ path: path.join(directory, "verified.png") });
  assert.deepEqual(rendererErrors, []);
} catch (error) {
  failure = error;
  await page?.screenshot({ path: path.join(directory, "failure.png") }).catch(() => {});
} finally {
  await app?.close().catch(error => { failure ||= error; });
  if (build) await verifySource().catch(error => { failure ||= error; });
  await fs.rm(profile, { recursive: true, force: true }).then(() => { profileRemoved = true; }).catch(error => { failure ||= error; });
  const report = { schemaVersion: 1, suite: "composer-states-ui", passed: !failure, startedAt, at: new Date().toISOString(), fixture: true, directory, profileRemoved,
    build: build ? { version: build.version, builtAt: build.builtAt, sourceSha256: build.sourceSha256, verifiedSourceFiles: build.sources?.length } : null,
    runtime, testSourceHashes, executablePath, checks, metrics, rendererErrors, ...(failure ? { error: failure.stack || String(failure) } : {}) };
  await fs.writeFile(path.join(directory, "report.json"), JSON.stringify(report, null, 2));
  await fs.writeFile(path.join(evidence, "composer-states-ui-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, profile: undefined }, null, 2));
}
if (failure) throw failure;
