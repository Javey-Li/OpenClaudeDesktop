import { _electron as electron } from "../../tools/node_modules/playwright/index.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { BOOKS, formatDayKey, localDayKey } from "../src/home-model.mjs";

// Draft home (2.2553.1 Jk greeting, Zk Action Center / stats card). Four
// sequential launches of the real app against the isolated protocol fixture:
// A) hold skeleton then the landing-clear stats card from a seeded ledger;
// B) a corrupt ledger: the stats IPC rejects and the home hides the card;
// C) Action Center rows from seeded unread metadata and a real approval;
// D) an acknowledged row re-listed by a newer session timestamp.
// Never run alongside another GUI suite; rebuild before running.
const project = path.resolve(import.meta.dirname, "../..");
const root = path.join(project, "app");
const evidence = path.join(project, "analysis/batch-20260920");
await fs.mkdir(evidence, { recursive: true });
const startedAt = new Date().toISOString();
const directory = path.join(evidence, `home-page-ui-${startedAt.replaceAll(":", "-")}`);
await fs.mkdir(directory, { recursive: true });
const profile = await fs.mkdtemp(path.join(directory, "profile-"));
const workspace = path.join(profile, "workspace");
await fs.mkdir(workspace);
await fs.writeFile(path.join(profile, "home-page-fixture.marker"), "isolated-home-page-test\n");
const executablePath = process.env.TEST_ELECTRON_BINARY || path.join(root, "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron");
const env = { ...process.env, CODE_DESKTOP_DATA: profile, CODEX_BINARY: path.join(root, "tests/fixtures/codex-server.cjs") };
delete env.ELECTRON_RUN_AS_NODE; delete env.CODE_DESKTOP_DEV_URL;
const checks = [], metrics = {}, rendererErrors = [];
let app, page, build, failure, runtime, profileRemoved = false;
const testSources = ["scripts/home-page-ui-test.mjs", "tests/fixtures/codex-server.cjs", "src/home-model.mjs"];
let testSourceHashes;
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function verifySource() {
  assert.ok(build && Array.isArray(build.sources) && build.sources.length, "Build must contain a source manifest");
  assert.equal(sha(JSON.stringify(build.sources)), build.sourceSha256, "Build source digest must be internally consistent");
  const current = JSON.parse(await fs.readFile(path.join(root, "dist/build-info.json"), "utf8"));
  assert.equal(current.sourceSha256, build.sourceSha256, "Build changed during this test");
  assert.equal(current.builtAt, build.builtAt, "Build was replaced during this test");
  assert.equal(JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8")).version, build.version, "Package version must match build");
  for (const entry of build.sources) assert.equal(sha(await fs.readFile(path.join(root, entry.path))), entry.sha256, `Build is stale: ${entry.path}`);
  for (const required of ["src/home-model.mjs", "src/source-home.jsx", "src/source-home.css", "src/source-action-center.jsx",
    "src/source-action-center.css", "src/main.jsx", "electron/main.cjs", "electron/activity.cjs"])
    assert.ok(build.sources.some((entry) => entry.path === required), `Build does not identify ${required}`);
  const hashes = Object.fromEntries(await Promise.all(testSources.map(async (file) => [file, sha(await fs.readFile(path.join(root, file)))])));
  if (testSourceHashes) assert.deepEqual(hashes, testSourceHashes, "Test or protocol fixture changed during this run");
  else testSourceHashes = hashes;
}
const near = (actual, expected, label, tolerance = 0.5) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`);
const readPreferences = async () => JSON.parse(await fs.readFile(path.join(profile, "preferences.json"), "utf8"));
async function waitPreferences(predicate, attempts = 40) {
  let value = await readPreferences();
  for (let attempt = 0; attempt < attempts && !predicate(value); attempt++) { await new Promise((resolve) => setTimeout(resolve, 100)); value = await readPreferences(); }
  return value;
}
const dayKey = (offset) => { const date = new Date(); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() - offset); return localDayKey(date); };
const T0 = dayKey(0), T6 = dayKey(6), T7 = dayKey(7), T30 = dayKey(30);
const TOTAL = 10_500_000_000;
const BIG = 6_000_000, TINY = 4_000_000;
const oldDayModels = { fixture: TOTAL - 34_300 - TINY - 7 * BIG, "fixture-1": BIG, "fixture-2": BIG, "fixture-3": BIG, "fixture-4": BIG, "fixture-5": BIG, "extra-7": BIG, "extra-8": BIG, tiny: TINY };
// Ledger v2 days (activity.cjs): models and modelUsage.input are read as recorded.
const ledger = { startedAt: new Date(Date.now() - 40 * 86400e3).toISOString(), days: {
  [T0]: { v: 2, messages: 1000, tokens: 7300, sessions: 2, sessionIds: ["s-a", "s-b"], hours: { 5: 900, 9: 100 },
    models: { fixture: 4000, "fixture-1": 2000, "fixture-2": 1000, "fixture-3": 300 },
    modelUsage: { fixture: { input: 3000, output: 1000, cached: 0 }, "fixture-1": { input: 1500, output: 500, cached: 0 }, "fixture-2": { input: 700, output: 300, cached: 0 }, "fixture-3": { input: 200, output: 100, cached: 0 } } },
  [T6]: { v: 2, messages: 200, tokens: 5000, sessions: 1, sessionIds: ["s-c"], hours: { 9: 200 }, models: { fixture: 5000 }, modelUsage: { fixture: { input: 4000, output: 1000, cached: 0 } } },
  [T7]: { v: 2, messages: 30, tokens: 22000, hours: { 9: 30 }, models: { "fixture-4": 22000 }, modelUsage: { "fixture-4": { input: 20000, output: 2000, cached: 0 } } },
  // T30 is outside 7d and 30d: its usage still reaches the model list because
  // the official Iw attaches stats.modelUsage[model] unranged.
  [T30]: { v: 2, messages: 4, tokens: TOTAL - 34_300, hours: { 9: 4 }, models: oldDayModels, modelUsage: { "fixture-3": { input: 50, output: 20, cached: 0 } } },
} };
assert.equal(Object.values(ledger.days).reduce((sum, day) => sum + Object.values(day.models).reduce((a, b) => a + b, 0), 0), TOTAL);
const now = Math.floor(Date.now() / 1000);
const userItem = (id, text) => ({ id, type: "userMessage", content: [{ type: "text", text }] });
const textItem = (id, text) => ({ id, type: "agentMessage", text });
const thread = (id, name, age, extra = {}) => ({ id, name, cwd: workspace, createdAt: now - age - 100, updatedAt: now - age, archived: false,
  turns: [{ id: `${id}-turn`, status: "completed", items: [userItem(`${id}-user`, `Prompt for ${id}`), textItem(`${id}-answer`, `ANSWER_${id}`)] }], ...extra });
const UNREAD = ["U1", "U2", "U3", "U4", "U5", "U6"], UNTITLED = "N", PINNED = "P", ARCHIVED = "AR", S = "S";
async function writeProfile({ displayName, activity, threadIds, archived = [], sessionMetadata = {}, remembered = { sessions: 0, projects: 0, prs: 0 }, threadMetadata = {} }) {
  await fs.writeFile(path.join(profile, "preferences.json"), JSON.stringify({
    cwd: workspace, theme: "light", mode: "code", model: "fixture", effort: "low", threadIds, archivedThreadIds: archived, threadMetadata,
    sidebarWidth: 288, displayName, activity, stats: {}, sessionMetadata, rememberedActionCenterCounts: remembered,
  }));
}
async function writeThreads(threads) {
  await fs.writeFile(path.join(profile, "fixture-threads.json"), JSON.stringify({ next: 100, threads }));
}
async function writeModelListKnob(knob) {
  const file = path.join(profile, "fixture-model-list.json");
  if (knob) await fs.writeFile(file, JSON.stringify(knob)); else await fs.rm(file, { force: true });
}
async function launch(label) {
  await verifySource();
  app = await electron.launch({ executablePath, args: [root], env });
  runtime = await app.evaluate(({ app }) => ({ version: app.getVersion(), electron: process.versions.electron, chrome: process.versions.chrome }));
  assert.equal(runtime.version, build.version, "Runtime version must match the verified source build");
  page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (error) => rendererErrors.push(`${label}: ${error.message}`));
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1324, 768));
  await page.waitForFunction(() => innerWidth === 1324 && innerHeight === 768);
  await page.mouse.move(20, 740);
}
async function close() { if (app) { await app.close(); app = null; page = null; } }
async function frames(count = 3) {
  await page.evaluate((count) => new Promise((resolve) => { const step = () => (--count ? requestAnimationFrame(step) : resolve()); requestAnimationFrame(step); }), count);
}
const resolveVar = (name) => page.evaluate((name) => {
  const probe = document.createElement("span"); probe.style.color = `var(${name})`; document.querySelector(".cds-root").append(probe);
  const value = getComputedStyle(probe).color; probe.remove(); return value;
}, name);
const resolveColor = (css) => page.evaluate((css) => {
  const probe = document.createElement("span"); probe.style.color = css; document.body.append(probe);
  const value = getComputedStyle(probe).color; probe.remove(); return value;
}, css);
const greeting = () => page.locator("header.source-greeting h1");
const card = () => page.locator('[data-testid="epitaxy-stats-card"]');
const rows = () => page.locator(".source-action-center li.hac-row");
async function hoverCard() {
  await card().hover();
  await page.getByRole("tablist", { name: "Stats view" }).waitFor();
}
const clickTab = async (name) => page.getByRole("tab", { name, exact: true }).click();
try {
  build = JSON.parse(await fs.readFile(path.join(root, "dist/build-info.json"), "utf8"));
  await verifySource();

  // ---------------------------------------------------------------- Phase A
  await writeThreads({ [S]: thread(S, "Approval session", 3600) });
  await writeProfile({ displayName: "Fixture", activity: ledger, threadIds: [S] });
  await writeModelListKnob({ delayMs: 2500 });
  await launch("A");
  // This fixture lists no capabilities.codeStats, so main.cjs 'stats' serves the
  // Codex fallback (activity.cjs ledgerStats) once initialize answers: the card
  // renders while init still waits for the 2.5 s model/list. The hold skeleton
  // (a delayed SkeletonGroup) is covered by home-account-usage and its geometry
  // by composer-fixture-test.
  await card().waitFor();
  const early = await page.evaluate(() => ({
    hold: document.querySelectorAll('[data-testid="epitaxy-stats-hold"]').length,
    modelsLoaded: [...document.querySelectorAll("button")].some((button) => button.textContent.includes("Test model")),
    footer: document.querySelectorAll('[data-testid="epitaxy-stats-card"] .sh-account-source, [data-testid="epitaxy-stats-card"] [role="status"]').length,
    connectionCard: document.querySelectorAll(".connection-card").length,
    greeting: document.querySelector("header.source-greeting h1")?.textContent ?? null,
  }));
  assert.deepEqual(early, { hold: 0, modelsLoaded: false, footer: 0, connectionCard: 0, greeting: "What’s up next, Fixture?" },
    "stats card before init settles; no provenance footer and no connection card while connecting");
  metrics.beforeInit = early;
  await page.screenshot({ path: path.join(directory, "a-before-init.png") });
  checks.push("Stats before connect: the ledger-fallback card renders while init still waits for the 2.5 s model/list (no skeleton, models not loaded yet), with no provenance footer and no 'Connecting to DeepSeek…' card");
  await page.getByRole("button", { name: "Model", exact: true }).filter({ hasText: "Test model" }).waitFor();

  await card().waitFor();
  await page.waitForFunction(() => !document.querySelector(".welcome .home-content").hasAttribute("aria-busy"));
  await page.evaluate(() => document.fonts.ready);
  // Greeting geometry (Jk / shared-12 Qm/$m) and the spark pulse.
  const spark = page.locator("header.source-greeting .claude-spark");
  const pulse = await spark.evaluate((node) => ({ name: getComputedStyle(node).animationName, duration: getComputedStyle(node).animationDuration }));
  assert.match(pulse.name, /pill-pulse$/); assert.equal(pulse.duration, "0.42s");
  await spark.evaluate((node) => Promise.all(node.getAnimations().map((animation) => animation.finished)));
  const header = await page.locator("header.source-greeting").evaluate((node) => {
    const h1 = node.querySelector("h1"), img = node.querySelector("img");
    const s = getComputedStyle(node), t = getComputedStyle(h1), i = getComputedStyle(img);
    return { height: node.getBoundingClientRect().height, gap: s.gap, paddingTop: s.paddingTop, paddingBottom: s.paddingBottom, display: s.display,
      h1: [t.fontSize, t.lineHeight, t.fontWeight], img: [img.getBoundingClientRect().width, img.getBoundingClientRect().height, i.transform], text: h1.textContent };
  });
  assert.deepEqual(header, { height: 61, gap: "6px", paddingTop: "12px", paddingBottom: "24px", display: "flex", h1: ["20px", "25px", "400"], img: [22, 22, "matrix(1, 0, 0, 1, 0, 1)"], text: "What’s up next, Fixture?" });
  metrics.header = header;
  checks.push("Greeting: 61px header (12+25+24), gap 6px, h1 20/25/400, 22px spark translateY(1px) with a .42s pill-pulse on mount");

  // Card geometry (Lw fill surface) and tiles ($w).
  const geometry = await card().evaluate((node) => {
    const s = getComputedStyle(node), tiles = [...node.querySelectorAll(".stats-grid > div")];
    const value = (el) => getComputedStyle(el.querySelector(".sh-tile-value")), label = (el) => getComputedStyle(el.querySelector(".sh-tile-label"));
    return { width: node.getBoundingClientRect().width, padding: s.padding, radius: s.borderRadius, background: s.backgroundColor, gap: s.gap,
      tiles: tiles.length, tilePadding: getComputedStyle(tiles[0]).padding, tileRadius: getComputedStyle(tiles[0]).borderRadius, tileBackground: getComputedStyle(tiles[0]).backgroundColor,
      label: [label(tiles[0]).fontSize, label(tiles[0]).lineHeight], value: [value(tiles[0]).fontSize, value(tiles[0]).lineHeight, value(tiles[0]).fontWeight],
      favorite: [value(tiles[5]).fontSize, value(tiles[5]).lineHeight, value(tiles[5]).fontWeight], gridGap: getComputedStyle(node.querySelector(".stats-grid")).gap };
  });
  assert.equal(geometry.width, 480); assert.equal(geometry.padding, "8px 12px 12px"); assert.equal(geometry.radius, "8px"); assert.equal(geometry.gap, "20px");
  assert.equal(geometry.background, await page.evaluate(() => { const p = document.createElement("span"); p.style.backgroundColor = "var(--cds-alpha-1)"; document.querySelector(".cds-root").append(p); const v = getComputedStyle(p).backgroundColor; p.remove(); return v; }));
  assert.equal(geometry.tiles, 6); assert.equal(geometry.tilePadding, "4px"); assert.equal(geometry.tileRadius, "5px"); assert.equal(geometry.gridGap, "4px");
  assert.equal(geometry.tileBackground, await page.evaluate(() => { const p = document.createElement("span"); p.style.backgroundColor = "var(--cds-alpha-2)"; document.querySelector(".cds-root").append(p); const v = getComputedStyle(p).backgroundColor; p.remove(); return v; }));
  assert.deepEqual(geometry.label, ["12px", "15px"]); assert.deepEqual(geometry.value, ["13px", "19px", "580"]); assert.deepEqual(geometry.favorite, ["12px", "15px", "400"]);
  // Yw: the tabs row and Xw (tiles, heatmap, footnote) only: no [title], no footer row.
  const stack = await card().evaluate((node) => {
    const h = (el) => el.getBoundingClientRect().height;
    return { titles: node.querySelectorAll("[title]").length, children: node.children.length,
      height: h(node), parts: h(node.querySelector(".sh-tabs-row")) + 20 + h(node.querySelector(".sh-overview")) + 8 + 12 };
  });
  assert.equal(stack.titles, 0, "no native title tooltips in the card");
  assert.equal(stack.children, 2, "tabs row + overview");
  near(stack.height, stack.parts, "card height = tabs row + gap + overview (heatmap and footnote) + padding");
  metrics.card = { ...geometry, stack };
  checks.push("Stats card: 480px, padding 8/12/12, radius 8, alpha-1 fill, gap 20; six alpha-2 tiles padding 4 radius 5, label 12/15, value 13/19/580, favorite 12/15/400");

  // Numbers from the seeded ledger (All range).
  const readTiles = async () => Object.fromEntries(await page.locator(".sh-tile").evaluateAll((tiles) => tiles.map((tile) => [tile.querySelector(".sh-tile-label").textContent, tile.querySelector(".sh-tile-value").textContent])));
  const allTiles = await readTiles();
  assert.deepEqual(allTiles, { Sessions: "3", Messages: "1,234", "Total tokens": "10.5B", "Active days": "4", "Peak hour": new Intl.DateTimeFormat(undefined, { hour: "numeric" }).format(new Date(2000, 0, 1, 5)), "Favorite model": "Test model" });
  metrics.tiles = { all: allTiles };
  // Footnote (Qw): the seeded pick is a real book and the multiplier is its floor ratio.
  const footnote = await page.locator(".sh-footnote").textContent();
  const pick = BOOKS.find((book) => footnote.endsWith(`than ${book.name}.`));
  assert.ok(pick, `footnote names a book: ${footnote}`);
  assert.equal(footnote, `You’ve used ~${Math.floor(TOTAL / pick.tokens)}× more tokens than ${pick.name}.`);
  const footnoteStyle = await page.locator(".sh-footnote").evaluate((node) => { const s = getComputedStyle(node); return [s.fontSize, s.lineHeight, s.paddingTop]; });
  assert.deepEqual(footnoteStyle, ["11px", "17px", "4px"]);
  checks.push("Numbers: Sessions 3, Messages 1,234, Total tokens 10.5B, Active days 4, Peak hour 5 AM, Favorite model from the catalog; ~N× book footnote 11/17 pt-4");

  // Tabs (Kw): aria-hidden disabled buttons until hover, then live tablists.
  const before = await card().evaluate((node) => ({ hidden: node.querySelectorAll('[aria-hidden="true"][data-size="sm"] button:disabled').length, tabs: node.querySelectorAll('[role="tab"]').length }));
  assert.deepEqual(before, { hidden: 5, tabs: 0 });
  // R02, Kw (code-home.js:13844-13847): unselected pre-live labels are text-muted, not button:disabled's text-disabled.
  const preLive = await card().evaluate((node) => [...node.querySelectorAll('[aria-hidden="true"][data-size="sm"] button:disabled:not(.is-selected)')].map((button) => [button.textContent, getComputedStyle(button).color]));
  const muted = await resolveVar("--cds-text-muted");
  assert.deepEqual(preLive, [["Models", muted], ["30d", muted], ["7d", muted]], "pre-live unselected tabs paint --cds-text-muted");
  metrics.preLiveTabs = preLive;
  assert.equal(await page.locator('[role="tooltip"]').count(), 0, "no tooltip before any hover");
  await hoverCard();
  const tabs = await page.evaluate(() => {
    const lists = [...document.querySelectorAll('[data-testid="epitaxy-stats-card"] [role="tablist"]')];
    const selected = document.querySelector('[data-testid="epitaxy-stats-card"] [role="tab"][aria-selected="true"]');
    const s = getComputedStyle(selected), b = getComputedStyle(selected, "::before");
    return { labels: lists.map((list) => [list.getAttribute("aria-label"), list.querySelectorAll('[role="tab"]').length]),
      height: selected.getBoundingClientRect().height, padding: s.padding, font: [s.fontSize, s.lineHeight, s.fontWeight], color: s.color, backdrop: b.backgroundColor, radius: b.borderRadius };
  });
  assert.deepEqual(tabs.labels, [["Stats view", 2], ["Date range", 3]]);
  assert.equal(tabs.height, 20); assert.equal(tabs.padding, "0px 6px"); assert.deepEqual(tabs.font, ["12px", "17px", "500"]); assert.equal(tabs.radius, "4px");
  assert.equal(tabs.color, await resolveVar("--cds-text-primary"));
  assert.equal(tabs.backdrop, await page.evaluate(() => { const p = document.createElement("span"); p.style.backgroundColor = "var(--cds-fill-ghost-hover)"; document.querySelector(".cds-root").append(p); const v = getComputedStyle(p).backgroundColor; p.remove(); return v; }));
  // shared-15 rn: an enabled, unselected live tab paints the same ghost pill on hover and turns text-secondary.
  const ghostHover = tabs.backdrop;
  const modelsTab = page.getByRole("tab", { name: "Models", exact: true });
  const idle = await modelsTab.evaluate((node) => getComputedStyle(node, "::before").backgroundColor);
  await modelsTab.hover();
  const tabHover = await modelsTab.evaluate((node) => { const b = getComputedStyle(node, "::before"); return { backdrop: b.backgroundColor, radius: b.borderRadius, left: b.left, right: b.right, color: getComputedStyle(node).color }; });
  assert.equal(idle, "rgba(0, 0, 0, 0)", "unhovered unselected tab: transparent pill");
  assert.deepEqual(tabHover, { backdrop: ghostHover, radius: "4px", left: "1px", right: "0px", color: await resolveVar("--cds-text-secondary") }, "hovered Models: ghost pill (last child end-0), secondary text");
  await page.getByRole("tab", { name: "Overview", exact: true }).hover();
  // F09 review, shared-15 rn `focus-visible:before:shadow-focus before:transition-shadow before:duration-fast`:
  // keyboard focus rings the inset pill (inset-x-px; flush at the row ends), not the button.
  const ring = (name) => page.getByRole("tab", { name, exact: true }).evaluate((node) => {
    const probe = document.createElement("span"); probe.style.boxShadow = "var(--cds-focus-shadow)"; node.parentElement.append(probe);
    const want = getComputedStyle(probe).boxShadow; probe.remove();
    const b = getComputedStyle(node, "::before"), s = getComputedStyle(node);
    return { focused: node.matches(":focus-visible"), ringed: b.boxShadow === want, button: s.boxShadow, outline: s.outlineStyle, left: b.left, right: b.right, transition: [b.transitionProperty, b.transitionDuration] };
  });
  const ringed = (name) => page.waitForFunction((name) => {
    const node = [...document.querySelectorAll('[data-testid="epitaxy-stats-card"] [role="tab"]')].find((tab) => tab.textContent === name);
    const probe = document.createElement("span"); probe.style.boxShadow = "var(--cds-focus-shadow)"; node.parentElement.append(probe);
    const want = getComputedStyle(probe).boxShadow; probe.remove();
    return getComputedStyle(node, "::before").boxShadow === want;
  }, name);
  await page.getByRole("tab", { name: "Overview", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await ringed("Models");
  const modelsRing = await ring("Models");
  await page.keyboard.press("ArrowLeft");
  await ringed("Overview");
  const overviewRing = await ring("Overview");
  await page.evaluate(() => document.activeElement?.blur());
  assert.deepEqual(modelsRing, { focused: true, ringed: true, button: "none", outline: "none", left: "1px", right: "0px", transition: ["box-shadow", "0.06s"] }, "keyboard focus on Models (last child): ring on the pill, none on the button");
  assert.deepEqual(overviewRing, { focused: true, ringed: true, button: "none", outline: "none", left: "0px", right: "1px", transition: ["box-shadow", "0.06s"] }, "keyboard focus on Overview (first child): ring on the pill");
  metrics.tabs = { ...tabs, hovered: tabHover, focus: { models: modelsRing, overview: overviewRing } };
  checks.push("Tabs: aria-hidden disabled group before hover (unselected Models/30d/7d text-muted); live Stats view (2) / Date range (3) tablists after; 20px, 0 6px, 12/17/500, ghost-hover backdrop, primary text; hovering unselected Models paints the ghost pill with secondary text; keyboard focus rings the inset ::before pill (box-shadow, 60ms), not the button");

  // Heatmap (eT): 26×7 square cells, hue 217 lightness ladder, future cells transparent, tooltips after hover.
  const heat = await page.locator('[role="img"][aria-label="Daily activity heatmap"]').evaluate((node, keys) => {
    const columns = [...node.children];
    const cell = (key) => node.querySelector(`[data-date="${key}"]`);
    const r = (el) => el.getBoundingClientRect();
    const last = columns.at(-1).children;
    return { columns: columns.length, perColumn: columns.map((c) => c.children.length), square: [...node.querySelectorAll(".sh-heatmap-cell")].every((el) => Math.abs(r(el).width - r(el).height) < 0.01),
      radius: getComputedStyle(cell(keys.T0)).borderRadius, today: getComputedStyle(cell(keys.T0)).backgroundColor, t6: getComputedStyle(cell(keys.T6)).backgroundColor,
      future: [...last].filter((el) => el.dataset.date > keys.T0).map((el) => getComputedStyle(el).backgroundColor), lastDate: last[6].dataset.date };
  }, { T0, T6 });
  assert.equal(heat.columns, 26); assert.ok(heat.perColumn.every((count) => count === 7)); assert.equal(heat.square, true); assert.equal(heat.radius, "2px");
  assert.equal(heat.today, await resolveColor("hsl(217 70% 48%)")); assert.equal(heat.t6, await resolveColor("hsl(217 70% 72%)"));
  assert.ok(heat.future.every((color) => color === "rgba(0, 0, 0, 0)"), `future cells transparent: ${heat.future}`);
  const saturday = new Date(); saturday.setHours(12, 0, 0, 0); saturday.setDate(saturday.getDate() + 6 - saturday.getDay());
  assert.equal(heat.lastDate, localDayKey(saturday));
  // The F09 focus step's ArrowRight/ArrowLeft switch the view (automatic activation), so this eT is freshly mounted
  // with no cell tooltips. Its first pointerenter only mounts them (code-home.js eT), replacing the cell node under
  // the pointer, which then gets no pointerenter of its own (a 1px nudge inside it is only a pointermove). Like a real
  // pointer crossing the grid, enter on the first cell, then move to today's cell.
  await page.locator(".sh-heatmap-cell").first().hover();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await page.locator('[role="tooltip"]').count(), 0, "entering the grid only mounts the cell tooltips");
  await page.locator(`.sh-heatmap-cell[data-date="${T0}"]`).hover();
  await page.locator('[role="tooltip"]').waitFor();
  assert.equal((await page.locator('[role="tooltip"]').textContent()).trim(), `${formatDayKey(T0)} — 1,000`);
  await page.mouse.move(20, 740);
  await page.locator('[role="tooltip"]').waitFor({ state: "detached" });
  metrics.heatmap = heat;
  checks.push("Heatmap: 26 columns × 7 square 2px cells ending Saturday, max day hsl(217 70% 48%), 20% day 72%, future transparent, '{Mon D} — {count}' tooltip only after hover");

  // Ranges (Pw): 7d keeps two days, 30d three, All four (date-key comparison).
  await clickTab("7d");
  const weekTiles = await readTiles();
  assert.equal(weekTiles["Active days"], "2"); assert.equal(weekTiles.Sessions, "3"); assert.equal(weekTiles.Messages, "1,200"); assert.equal(weekTiles["Total tokens"], "12.3k");
  assert.equal(await page.locator(".sh-footnote").count(), 0, "12.3k tokens: no book reached");
  await clickTab("30d");
  const monthTiles = await readTiles();
  assert.equal(monthTiles["Active days"], "3"); assert.equal(monthTiles["Total tokens"], "34.3k"); assert.equal(monthTiles.Messages, "1,230");
  assert.equal(await page.locator(".sh-footnote").textContent(), "You’ve used about as many tokens as The Little Prince.");
  await clickTab("All");
  assert.equal((await readTiles())["Active days"], "4");
  metrics.tiles.week = weekTiles; metrics.tiles.month = monthTiles;
  checks.push("Ranges: 7d → 2 active days/12.3k/no footnote, 30d → 3/34.3k/'about as many … The Little Prince', All → 4; Peak hour unranged");

  // Models (cT/lT) in 7d: ticks for max 7,300, 72% segments, list rows, then All with eight rows + Show 2 more.
  await clickTab("7d"); await clickTab("Models");
  const chartImg = page.locator('[role="img"][aria-label="Daily tokens by model"]');
  await chartImg.waitFor();
  await frames();
  const chart = await chartImg.evaluate((node) => {
    const s = getComputedStyle(node), days = [...node.querySelectorAll('[data-testid="token-chart-day"]')];
    const seg = (day) => [...day.querySelectorAll(".sh-chart-segment")];
    return { height: node.getBoundingClientRect().height, columns: s.gridTemplateColumns.split(" ").length, padding: s.padding,
      ticks: [...node.querySelectorAll(".sh-chart-tick")].map((el) => el.textContent), days: days.length,
      widths: days.map((day) => seg(day).map((el) => Math.round((el.getBoundingClientRect().width / day.getBoundingClientRect().width) * 1000) / 10)),
      topRadius: days.map((day) => { const top = seg(day).at(-1); const t = getComputedStyle(top); return [t.borderTopLeftRadius, t.borderTopRightRadius]; }),
      heights: days.map((day) => seg(day).map((el) => Math.round((el.getBoundingClientRect().height / day.getBoundingClientRect().height) * 1000) / 10)),
      labels: [...node.querySelectorAll(".sh-chart-label")].map((el) => el.textContent) };
  });
  assert.equal(chart.height, 160); assert.equal(chart.columns, 2); assert.equal(chart.padding, "8px 10px 5px 3px");
  assert.deepEqual(chart.ticks, ["0", "2k", "4k", "6k", "8k"]); assert.equal(chart.days, 2);
  assert.ok(chart.widths.flat().every((width) => Math.abs(width - 72) < 0.6), `segments 72% wide: ${chart.widths}`);
  assert.ok(chart.topRadius.every((pair) => pair[0] === "2px" && pair[1] === "2px"));
  const expectedHeights = [[62.5], [50, 25, 12.5, 3.75]];
  chart.heights.forEach((day, i) => day.forEach((height, j) => near(height, expectedHeights[i][j], `segment height ${i}/${j} = tokens / 8k`, 0.2)));
  assert.deepEqual(chart.labels, [formatDayKey(T6), formatDayKey(T0)]);
  const list = await page.locator(".sh-model-row").evaluateAll((items) => items.map((row) => {
    const swatch = row.querySelector(".sh-model-swatch"), pct = row.querySelector(".sh-model-pct"), r = swatch.getBoundingClientRect();
    return { name: row.querySelector(".sh-model-name").textContent, io: row.querySelector(".sh-model-io").textContent, pct: pct.textContent,
      pctWidth: pct.getBoundingClientRect().width, pctAlign: getComputedStyle(pct).textAlign, swatch: [r.width, r.height, getComputedStyle(swatch).borderRadius, getComputedStyle(swatch).backgroundColor] };
  }));
  assert.deepEqual(list.map((row) => [row.name, row.io, row.pct]), [["Test model", "7k in · 2k out", "73.2%"], ["Test model 2", "1.5k in · 500 out", "16.3%"], ["Test model 3", "700 in · 300 out", "8.1%"], ["Test model 4", "250 in · 120 out", "2.4%"]],
    "7d: tokens/percent ranged, in/out all-time (Test model 4 includes the T30 usage)");
  assert.ok(list.every((row) => row.pctWidth === 56 && row.pctAlign === "right"));
  assert.deepEqual(list.map((row) => row.swatch.slice(0, 3)), Array.from({ length: 4 }, () => [8, 8, "2px"]));
  assert.equal(list[0].swatch[3], await resolveColor("hsl(217 70% 58%)")); assert.equal(list[1].swatch[3], await resolveColor("hsl(217 70% 65%)"));
  // Chart day tooltip lists the day's models.
  await page.locator(`[data-testid="token-chart-day"][data-date="${T0}"]`).hover();
  await page.locator('[role="tooltip"]').waitFor();
  const dayTooltip = await page.locator('[role="tooltip"]').textContent();
  assert.ok(dayTooltip.includes(formatDayKey(T0)) && dayTooltip.includes("Test model") && dayTooltip.includes("4k"), dayTooltip);
  // dT: each row is a 6px round aria-hidden dot followed by '{model}: {tokens}'.
  const tooltipRows = await page.locator('[role="tooltip"] .sh-day-tooltip-row').evaluateAll((items) => items.map((row) => {
    const dot = row.querySelector(".sh-day-tooltip-dot"), r = dot.getBoundingClientRect();
    return { text: row.textContent, dot: [r.width, r.height, getComputedStyle(dot).borderRadius, dot.getAttribute("aria-hidden")], gap: getComputedStyle(row).gap, numeric: getComputedStyle(row).fontVariantNumeric };
  }));
  assert.deepEqual(tooltipRows.map((row) => row.text), ["Test model: 4k", "Test model 2: 2k", "Test model 3: 1k", "Test model 4: 300"]);
  assert.ok(tooltipRows.every((row) => /^.+: [\d.]+[kMB]?$/.test(row.text) && row.gap === "4px" && row.numeric === "tabular-nums"));
  assert.ok(tooltipRows.every((row) => JSON.stringify(row.dot) === JSON.stringify([6, 6, "50%", "true"])), JSON.stringify(tooltipRows));
  metrics.dayTooltip = tooltipRows;
  await page.mouse.move(20, 740);
  await clickTab("All");
  await page.getByRole("button", { name: "Show 2 more" }).waitFor();
  assert.equal(await page.locator(".sh-model-row").count(), 6);
  assert.equal(await page.locator(".sh-model-row").evaluateAll((items) => items.some((row) => row.dataset.model === "tiny")), false, "0.038% model is not listed");
  assert.equal(await page.getByRole("button", { name: "Show 2 more" }).getAttribute("aria-expanded"), "false");
  await page.getByRole("button", { name: "Show 2 more" }).click();
  assert.equal(await page.locator(".sh-model-row").count(), 8);
  assert.equal(await page.getByRole("button", { name: "Show less" }).getAttribute("aria-expanded"), "true");
  assert.equal(await page.locator(".sh-model-row").evaluateAll((items) => items.map((row) => row.dataset.model).includes("tiny")), false);
  const allTicks = await chartImg.locator(".sh-chart-tick").evaluateAll((els) => els.map((el) => el.textContent));
  assert.deepEqual(allTicks, ["0", "2B", "4B", "6B", "8B", "10B", "12B"]);
  metrics.chart = chart; metrics.modelList = list; metrics.allTicks = allTicks;
  await page.screenshot({ path: path.join(directory, "a-models.png") });
  checks.push("Models: 160px grid chart (8/10/5/3 padding), ticks 0/2k/4k/6k/8k for 7,300, 72% stacked segments with 2px top radius, '{in} in · {out} out' rows (usage all-time while tokens/pct are ranged) with 56px right-aligned pct, eight rows → Show 2 more/Show less, 0.038% model dropped, per-day tooltip");
  // Empty range text: a fresh ledger day set has no models.
  await close();

  // ---------------------------------------------------------------- Phase B
  await writeProfile({ displayName: "a.b@example.com", activity: "corrupt", threadIds: [S] });
  await writeModelListKnob(null);
  await launch("B");
  await page.locator(".welcome header.source-greeting").waitFor();
  await page.getByRole("button", { name: "Model", exact: true }).filter({ hasText: "Test model" }).waitFor();
  const rejection = await page.evaluate(() => window.desktop.call("stats").then(() => null, (error) => error.message));
  assert.match(rejection, /usage ledger could not be read/);
  await frames(6);
  const failed = await page.evaluate(() => ({ greeting: document.querySelector("header.source-greeting h1").textContent,
    card: document.querySelectorAll('[data-testid="epitaxy-stats-card"], [data-testid="epitaxy-stats-hold"], [data-testid="epitaxy-stats-failed"]').length,
    wrapper: document.querySelectorAll(".welcome .home-content").length, busy: document.querySelectorAll(".welcome [aria-busy]").length }));
  assert.deepEqual(failed, { greeting: "What’s up next, a.b?", card: 0, wrapper: 0, busy: 0 });
  metrics.corruptLedger = { rejection, ...failed };
  checks.push("Corrupt ledger: the stats IPC rejects and the home shows the greeting only (official $O undefined → Zk renders no card); e-mail preferred name → local part");
  // Empty-range copy on a readable but empty ledger is covered by code-ui-test ('No model usage in this range').
  await close();

  // ---------------------------------------------------------------- Phase C
  const threads = { [S]: thread(S, "Approval session", 3600) };
  UNREAD.forEach((id, index) => { threads[id] = thread(id, `Unread session ${id}`, 60 + index * 60); });
  threads[UNTITLED] = thread(UNTITLED, "", 30);
  threads[PINNED] = thread(PINNED, "Pinned session", 10);
  threads[ARCHIVED] = thread(ARCHIVED, "Archived session", 20, { archived: true });
  await writeThreads(threads);
  const sessionMetadata = Object.fromEntries([...UNREAD, UNTITLED].map((id) => [id, { unread: true }]));
  sessionMetadata[PINNED] = { unread: true, pinned: true };
  sessionMetadata[ARCHIVED] = { unread: true };
  await writeProfile({ displayName: "Fixture", activity: ledger, threadIds: [S, ...UNREAD, UNTITLED, PINNED], archived: [ARCHIVED],
    threadMetadata: { [ARCHIVED]: { id: ARCHIVED, name: "Archived session", cwd: workspace, updatedAt: now - 20 } },
    sessionMetadata, remembered: { sessions: 2, projects: 0, prs: 0 } });
  await writeModelListKnob({ delayMs: 2500 });
  await launch("C");
  const placeholderRoot = page.locator('.welcome .source-action-center[aria-busy="true"]');
  await placeholderRoot.waitFor();
  const placeholder = await placeholderRoot.evaluate((node) => {
    const list = node.querySelector('ul[aria-hidden="true"]'), items = [...list.querySelectorAll("li")];
    return { items: items.length, bars: items.map((li) => { const bar = li.querySelector(".hac-skeleton-bar"); const w = bar.getBoundingClientRect().width / li.querySelector(".hac-skeleton-slot").getBoundingClientRect().width; return [Math.round(w * 1000) / 10, bar.getBoundingClientRect().height]; }),
      caret: items.map((li) => getComputedStyle(li.querySelector(".hac-caret")).visibility), dismiss: items.map((li) => li.querySelector(".hac-dismiss-slot").getBoundingClientRect().width),
      stats: document.querySelectorAll('[data-testid^="epitaxy-stats"]').length, greeting: document.querySelector("header.source-greeting h1").textContent };
  });
  assert.equal(placeholder.items, 2); assert.deepEqual(placeholder.bars.map((bar) => bar[1]), [10, 10]); near(placeholder.bars[0][0], 40, "first bar 40%"); near(placeholder.bars[1][0], 33.3, "second bar 33.3%");
  assert.deepEqual(placeholder.caret, ["hidden", "hidden"]); assert.deepEqual(placeholder.dismiss, [24, 24]); assert.equal(placeholder.stats, 0);
  assert.equal(placeholder.greeting, "Welcome back, Fixture", "remembered shape is not landing clear");
  metrics.placeholder = placeholder;
  await page.screenshot({ path: path.join(directory, "c-placeholder.png") });
  checks.push("Placeholder: remembered count 2 renders an aria-hidden skeleton list (10px bars 40%/33.3%, invisible caret, 24px dismiss slot) under aria-busy while sessions load; greeting Welcome back");

  // Load window: the placeholder must hand over to the rows directly. Gating on
  // boot instead of the session list would mount the landing-clear stats card
  // and flip the greeting between init and thread/read, and write a transient
  // 0 into rememberedActionCenterCounts. Trace the DOM and the profile until
  // the live rows are in.
  await page.evaluate(() => {
    const text = () => document.querySelector("header.source-greeting h1")?.textContent;
    const trace = { statsCard: 0, greetings: [text()], busyGaps: 0 };
    const observer = new MutationObserver(() => {
      if (document.querySelector(".welcome .home-content, .welcome [data-testid^=\"epitaxy-stats\"]")) trace.statsCard += 1;
      if (!document.querySelector(".welcome .source-action-center")) trace.busyGaps += 1;
      const current = text();
      if (trace.greetings[trace.greetings.length - 1] !== current) trace.greetings.push(current);
    });
    observer.observe(document.querySelector(".welcome"), { childList: true, subtree: true, characterData: true, attributes: true });
    window.__homeTrace = trace; window.__homeTraceStop = () => observer.disconnect();
  });
  const rememberedSamples = [];
  const sampling = (async () => {
    while (!page.isClosed() && !rememberedSamples.done) { rememberedSamples.push((await readPreferences()).rememberedActionCenterCounts?.sessions); await new Promise((resolve) => setTimeout(resolve, 20)); }
  })();
  await page.locator(".source-action-center:not([aria-busy]) li.hac-row").first().waitFor();
  rememberedSamples.done = true; await sampling;
  const loadTrace = await page.evaluate(() => { window.__homeTraceStop(); return window.__homeTrace; });
  assert.equal(loadTrace.statsCard, 0, "no landing-clear stats card between init and the session list");
  assert.equal(loadTrace.busyGaps, 0, "the placeholder is replaced by the live list, never unmounted in between");
  assert.deepEqual(loadTrace.greetings, ["Welcome back, Fixture"], `greeting never flipped while loading: ${JSON.stringify(loadTrace.greetings)}`);
  assert.ok(rememberedSamples.length > 0 && rememberedSamples.every((count) => count === 2 || count === 7), `remembered count never written as 0 during the load: ${rememberedSamples.join(",")}`);
  metrics.loadTrace = { ...loadTrace, rememberedSamples: [...new Set(rememberedSamples)] };
  checks.push("Load window: placeholder → live rows with no stats card, no greeting flip and no transient remembered count 0 (traced by MutationObserver + profile sampling)");
  await page.evaluate(() => document.fonts.ready);
  const center = await page.locator(".source-action-center").evaluate((node) => {
    const s = getComputedStyle(node), section = node.querySelector("section"), h2 = section.querySelector("h2"), ul = section.querySelector("ul");
    const li = ul.querySelector("li"), t = getComputedStyle(h2), l = getComputedStyle(li);
    return { padding: s.padding, gap: s.gap, sections: node.querySelectorAll("section").length, h2: [h2.textContent, t.fontSize, t.lineHeight, t.borderRadius], sectionGap: getComputedStyle(section).gap,
      ulRole: ul.getAttribute("role"), ulGap: getComputedStyle(ul).gap, rows: ul.children.length, li: [l.padding, l.borderRadius, l.backgroundColor, l.gap],
      more: section.querySelector('header [aria-expanded]')?.textContent, expanded: section.querySelector('header [aria-expanded]')?.getAttribute("aria-expanded"),
      markAll: !!section.querySelector("header button:not([aria-expanded])"), stats: document.querySelectorAll('[data-testid^="epitaxy-stats"]').length,
      text: document.body.innerText };
  });
  assert.equal(center.padding, "24px 0px 56px"); assert.equal(center.gap, "40px"); assert.equal(center.sections, 1);
  assert.deepEqual(center.h2, ["Sessions", "13px", "19px", "4px"]); assert.equal(center.sectionGap, "8px"); assert.equal(center.ulRole, "list"); assert.equal(center.ulGap, "4px");
  assert.equal(center.rows, 3); assert.equal(center.more, "Show 4 more"); assert.equal(center.expanded, "false"); assert.equal(center.markAll, true); assert.equal(center.stats, 0);
  assert.deepEqual(center.li.slice(0, 2), ["8px 5px", "8px"]); assert.equal(center.li[3], "8px");
  assert.equal(center.li[2], await page.evaluate(() => { const p = document.createElement("span"); p.style.backgroundColor = "var(--cds-alpha-1)"; document.querySelector(".cds-root").append(p); const v = getComputedStyle(p).backgroundColor; p.remove(); return v; }));
  assert.ok(!/Projects|Pull requests/.test(center.text), "no Projects or Pull requests section text");
  assert.equal(await greeting().textContent(), "Welcome back, Fixture");
  metrics.center = { ...center, text: undefined };
  checks.push("Action Center: padding 24/0/56, gap 40, single Sessions section (h2 13/19 radius 4, gap 8), role=list gap 4, alpha-1 rows padding 8/5 radius 8, three rows + 'Show 4 more' at 768px, no Projects/PR text, greeting Welcome back");
  // cc43287c9-BMbiZYzF.js:28686 placeholder Yn ? 'Type / for commands' : 'Describe a task or ask a question' — the home is the draft (Yn null).
  metrics.homePlaceholder = await page.evaluate(() => { const node = document.querySelector('[data-cds="ChatComposerEditor"]'); return { attr: node.getAttribute("data-placeholder"), empty: node.dataset.empty, painted: getComputedStyle(node, "::before").content }; });
  assert.deepEqual(metrics.homePlaceholder, { attr: "Describe a task or ask a question", empty: "true", painted: JSON.stringify("Describe a task or ask a question") });
  checks.push("0.2.98: the home (draft, no session id) composer paints 'Describe a task or ask a question', never the session-only 'Type / for commands'");

  // Listed ids: unread U1..U6 + untitled, newest first; pinned and archived never listed.
  const listedIds = () => rows().evaluateAll((items) => items.map((li) => li.dataset.sessionId));
  await page.getByRole("button", { name: "Show 4 more" }).click();
  assert.equal(await page.getByRole("button", { name: "Show less" }).getAttribute("aria-expanded"), "true");
  assert.deepEqual(await listedIds(), [UNTITLED, ...UNREAD]);
  const untitled = await rows().first().evaluate((li) => ({ title: li.querySelector(".hac-title").textContent, label: li.querySelector("[data-row-main-button]").getAttribute("aria-label") }));
  assert.deepEqual(untitled, { title: "Untitled session", label: "Open session " });
  await page.getByRole("button", { name: "Show less" }).click();
  // The display cannot host an 1100px window; emulate the viewport (innerHeight
  // and min-height media queries follow) and restore 768 afterwards.
  await page.setViewportSize({ width: 1324, height: 1100 });
  await page.waitForFunction(() => innerHeight === 1100);
  await page.getByRole("button", { name: "Show 2 more" }).waitFor();
  assert.equal(await rows().count(), 5);
  await page.setViewportSize({ width: 1324, height: 768 });
  await page.waitForFunction(() => innerHeight === 768);
  await page.getByRole("button", { name: "Show 4 more" }).waitFor();
  assert.equal(await rows().count(), 3);
  checks.push("Header buttons: Show 4 more → Show less lists all 7 (untitled row 'Untitled session' / aria-label 'Open session '); 1100px viewport → 5 rows + Show 2 more; pinned/archived unread sessions never listed");

  // A real protocol approval makes S blocked; it sorts first although it is the oldest session.
  await page.locator(`[data-source-session-id="${S}"] .source-session-open`).click();
  await page.locator(`[data-transcript-item-id="${S}-answer"]`).waitFor();
  await page.getByRole("textbox", { name: "Message DeepSeek" }).fill("fixture:command");
  await page.keyboard.press("Enter");
  await page.locator('[data-approval-presentation="card"]').waitFor({ state: "attached" });
  await page.getByRole("button", { name: "New", exact: true }).click();
  await page.locator(".welcome").waitFor();
  await page.locator(`li.hac-row[data-session-id="${S}"]`).waitFor();
  const pills = await rows().evaluateAll((items) => items.slice(0, 2).map((li) => {
    const dot = li.querySelector(".hac-dot"), label = li.querySelector(".hac-pill-label"), r = dot.getBoundingClientRect();
    return { id: li.dataset.sessionId, kind: li.dataset.attentionKind, dot: [r.width, r.height, getComputedStyle(dot).borderRadius, getComputedStyle(dot).backgroundColor], label: [label.textContent, getComputedStyle(label).color, getComputedStyle(label).fontSize, getComputedStyle(label).lineHeight],
      slot: dot.parentElement.getBoundingClientRect().width };
  }));
  assert.equal(pills[0].id, S); assert.equal(pills[0].kind, "blocked"); assert.deepEqual(pills[0].dot.slice(0, 3), [5, 5, "9999px"]); assert.equal(pills[0].slot, 16);
  assert.equal(pills[0].dot[3], await page.evaluate(() => { const p = document.createElement("span"); p.style.backgroundColor = "var(--cds-fill-warning)"; document.querySelector(".cds-root").append(p); const v = getComputedStyle(p).backgroundColor; p.remove(); return v; }));
  assert.deepEqual(pills[0].label.slice(2), ["12px", "15px"]); assert.equal(pills[0].label[0], "Needs input"); assert.equal(pills[0].label[1], await resolveVar("--cds-text-warning"));
  assert.equal(pills[1].kind, "unread"); assert.equal(pills[1].label[0], "Unread"); assert.equal(pills[1].label[1], await resolveVar("--cds-text-accent"));
  assert.equal(pills[1].dot[3], await page.evaluate(() => { const p = document.createElement("span"); p.style.backgroundColor = "var(--cds-fill-accent)"; document.querySelector(".cds-root").append(p); const v = getComputedStyle(p).backgroundColor; p.remove(); return v; }));
  metrics.pills = pills;
  await page.screenshot({ path: path.join(directory, "c-action-center.png") });
  checks.push("Blocked row (real pending approval) precedes newer unread rows: 5px warning dot in a 16px slot + 'Needs input' text-warning; unread rows accent dot + 'Unread'");

  // Row content and hover states (Ak / tA).
  const first = page.locator(`li.hac-row[data-session-id="${S}"]`);
  const content = await first.evaluate((li) => {
    const main = li.querySelector("[data-row-main-button]"), title = li.querySelector(".hac-title"), meta = li.querySelector(".hac-meta"), time = li.querySelector(".hac-time"), caret = li.querySelector(".hac-caret"), dismiss = li.querySelector(".hac-dismiss");
    const t = getComputedStyle(title), c = getComputedStyle(time);
    return { label: main.getAttribute("aria-label"), title: [title.textContent, t.fontSize, t.color, t.textOverflow], meta: meta && meta.textContent,
      time: [time.textContent, c.minWidth, c.marginRight, c.fontVariantNumeric, c.textAlign], caret: getComputedStyle(caret).color, dismiss: [dismiss.getAttribute("aria-label"), getComputedStyle(dismiss).opacity, dismiss.getBoundingClientRect().width, dismiss.getBoundingClientRect().height], background: getComputedStyle(li).backgroundColor };
  });
  assert.equal(content.label, "Open session Approval session");
  assert.deepEqual(content.title, ["Approval session", "13px", await resolveVar("--cds-text-primary"), "ellipsis"]);
  // R02, tA meta (cc43287c9 :5416-5417, :5473): owner/name or the repo name from main.cjs 'repo-identities'; the fixture
  // workspace is not a git repo, so the row has no meta (never the folder basename).
  assert.equal(content.meta, null, "no meta for a folder outside a repo");
  assert.deepEqual(content.time.slice(1), ["20px", "-4px", "tabular-nums", "center"]); assert.equal(content.time[0], "1h ago");
  assert.equal(content.caret, await resolveVar("--cds-text-muted")); assert.deepEqual(content.dismiss, ["Dismiss session", "0", 24, 24]);
  await first.hover();
  await page.waitForFunction((id) => getComputedStyle(document.querySelector(`li.hac-row[data-session-id="${id}"] .hac-dismiss`)).opacity === "1", S);
  const hovered = await first.evaluate((li) => ({ caret: getComputedStyle(li.querySelector(".hac-caret")).color, background: getComputedStyle(li).backgroundColor }));
  assert.equal(hovered.caret, await resolveVar("--cds-text-secondary"));
  assert.equal(hovered.background, await page.evaluate(() => { const p = document.createElement("span"); p.style.backgroundColor = "var(--cds-alpha-2)"; document.querySelector(".cds-root").append(p); const v = getComputedStyle(p).backgroundColor; p.remove(); return v; }));
  await page.mouse.move(20, 740);
  await page.waitForFunction((id) => getComputedStyle(document.querySelector(`li.hac-row[data-session-id="${id}"] .hac-dismiss`)).opacity === "0", S);
  await first.locator("[data-row-main-button]").focus();
  await page.waitForFunction((id) => getComputedStyle(document.querySelector(`li.hac-row[data-session-id="${id}"] .hac-dismiss`)).opacity === "1", S);
  await page.locator(".welcome").click({ position: { x: 5, y: 5 } });
  // Context menu: the row's main button anchors the shared session menu; the row reads data-menu-open.
  await first.click({ button: "right" });
  await page.getByRole("menu", { name: "Session menu" }).waitFor();
  assert.equal(await first.getAttribute("data-menu-open"), "true");
  await page.keyboard.press("Escape");
  await page.getByRole("menu", { name: "Session menu" }).waitFor({ state: "detached" });
  metrics.rowContent = { content, hovered };
  checks.push("Row: aria-label 'Open session {title}', 13px primary truncating title, no meta for the non-repo fixture folder, '1h ago' narrow time (min-w 20, -4px), caret muted → secondary and alpha-2 row on hover, dismiss 24px opacity 0 → 1 on hover/focus-within, right-click opens the session menu with data-menu-open");

  // Dismiss U1 (visible third row): official onDismissAwaiting = ack(id, timestamp) + markRead(id);
  // persists ackedAt = session timestamp and unread false, row removed without opening.
  const u1 = page.locator(`li.hac-row[data-session-id="U1"]`);
  await u1.waitFor();
  assert.equal(await page.locator(`[data-source-session-id="U1"][data-unread="true"]`).count(), 1, "U1 carries the sidebar unread marker before dismiss");
  await u1.hover();
  await u1.locator("[data-row-dismiss]").click();
  await u1.waitFor({ state: "detached" });
  let prefs = await waitPreferences((value) => value.sessionMetadata.U1?.ackedAt !== undefined);
  assert.equal(prefs.sessionMetadata.U1.ackedAt, threads.U1.updatedAt * 1000);
  assert.equal(prefs.sessionMetadata.U1.unread, false, "dismiss acknowledges and marks the session read (official ack + markRead)");
  await page.locator(`[data-source-session-id="U1"]:not([data-unread])`).waitFor();
  assert.equal(await page.locator(`[data-source-session-id="U1"] [role="status"]`).count(), 0, "sidebar unread dot cleared by the dismiss");
  assert.equal(await page.locator(".welcome").count(), 1, "dismiss does not open the session");
  assert.deepEqual(await listedIds(), [S, UNTITLED, "U2"]);
  // Open U2 from its row: the session opens and unread clears.
  await page.locator(`li.hac-row[data-session-id="U2"] [data-row-main-button]`).click();
  await page.locator(`[data-transcript-item-id="U2-answer"]`).waitFor();
  assert.equal(await page.locator(`[data-source-session-id="U2"] [aria-current="page"]`).count(), 1);
  prefs = await waitPreferences((value) => value.sessionMetadata.U2?.unread === false);
  assert.equal(prefs.sessionMetadata.U2.unread, false);
  await page.getByRole("button", { name: "New", exact: true }).click();
  await page.locator(".welcome").waitFor();
  assert.deepEqual(await listedIds(), [S, UNTITLED, "U3"]);
  // Reload: the acknowledgement persists (U1 hidden) while the pending approval still lists S.
  await page.reload();
  await page.locator(".source-action-center:not([aria-busy]) li.hac-row").first().waitFor();
  await page.getByRole("button", { name: "Show 3 more" }).click();
  assert.deepEqual(await listedIds(), [S, UNTITLED, "U3", "U4", "U5", "U6"]);
  prefs = await waitPreferences((value) => value.rememberedActionCenterCounts?.sessions === 6);
  assert.equal(prefs.rememberedActionCenterCounts.sessions, 6, "remembered shape follows the loaded rows");
  checks.push("Dismiss persists ackedAt (session timestamp) + unread false via IPC (sidebar dot cleared) and hides the row across reload without opening it; opening a row clears unread; remembered count updated");

  // Mark all as read clears every listed unread session; dismissing the blocked row restores landing clear.
  await page.getByRole("button", { name: "Mark all as read" }).click();
  await page.waitForFunction(() => document.querySelectorAll(".source-action-center li.hac-row").length === 1);
  assert.deepEqual(await listedIds(), [S]);
  prefs = await waitPreferences((value) => [UNTITLED, "U3", "U4", "U5", "U6"].every((id) => value.sessionMetadata[id]?.unread === false));
  assert.ok([UNTITLED, "U3", "U4", "U5", "U6"].every((id) => prefs.sessionMetadata[id].unread === false), "all listed unread sessions were marked read through the metadata IPC");
  assert.equal(await page.getByRole("button", { name: "Mark all as read" }).count(), 0);
  assert.equal(await greeting().textContent(), "Welcome back, Fixture");
  await first.hover();
  await first.locator("[data-row-dismiss]").click();
  await card().waitFor();
  assert.equal(await greeting().textContent(), "What’s up next, Fixture?");
  assert.equal(await rows().count(), 0);
  assert.equal(await page.locator(".welcome .home-content").evaluate((node) => node.hasAttribute("aria-busy")), false);
  // Reduced motion: no spark pulse.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await page.locator("header.source-greeting .claude-spark").waitFor();
  assert.equal(await page.locator("header.source-greeting .claude-spark").evaluate((node) => getComputedStyle(node).animationName), "none");
  await page.emulateMedia({ reducedMotion: null });
  metrics.remembered = (await readPreferences()).rememberedActionCenterCounts;
  await page.screenshot({ path: path.join(directory, "c-landing-clear.png") });
  checks.push("Mark all as read clears unread on every listed session; dismissing the blocked row flips the greeting to What’s up next and brings the stats card back; reduced motion removes the pulse");
  await close();

  // ---------------------------------------------------------------- Phase D
  prefs = await readPreferences();
  const relisted = { ...threads, U1: { ...threads.U1, updatedAt: now + 100 } };
  await writeThreads(relisted);
  await writeProfile({ displayName: "", activity: ledger, threadIds: [S, ...UNREAD, UNTITLED, PINNED], archived: [ARCHIVED],
    threadMetadata: prefs.threadMetadata, sessionMetadata: { ...prefs.sessionMetadata, U1: { unread: true, ackedAt: threads.U1.updatedAt * 1000 } },
    remembered: prefs.rememberedActionCenterCounts });
  await writeModelListKnob(null);
  await launch("D");
  await page.locator(".source-action-center:not([aria-busy]) li.hac-row").first().waitFor();
  assert.deepEqual(await listedIds(), ["U1"], "a newer session timestamp re-lists an acknowledged row");
  assert.equal(await greeting().textContent(), "Welcome back", "empty preferred name: no comma, no invented name");
  await page.locator(`li.hac-row[data-session-id="U1"]`).hover();
  await page.locator(`li.hac-row[data-session-id="U1"] [data-row-dismiss]`).click();
  await card().waitFor();
  assert.equal(await greeting().textContent(), "What’s up next?");
  assert.ok(!/Projects|Pull requests/.test(await page.locator(".welcome").innerText()));
  checks.push("Re-list: ackedAt older than the session timestamp lists the row again; empty preferred name renders 'Welcome back' / 'What’s up next?' without a comma");
  await close();

  assert.deepEqual(rendererErrors, []);
  await verifySource();
} catch (error) {
  failure = error;
  try { if (page) await page.screenshot({ path: path.join(directory, "failure.png") }); } catch {}
  await close().catch(() => {});
} finally {
  await close().catch(() => {});
  try { await fs.rm(profile, { recursive: true, force: true }); profileRemoved = true; } catch {}
  const report = { passed: !failure, startedAt, finishedAt: new Date().toISOString(), build: build ? { version: build.version, builtAt: build.builtAt, sourceSha256: build.sourceSha256 } : null,
    runtime, checks, metrics, rendererErrors, failure: failure ? { message: failure.message, stack: failure.stack } : null, evidence: directory, profileRemoved,
    note: "Isolated CODE_DESKTOP_DATA profile and the protocol fixture only; no user data or real Codex session was read. Official chain: cc43287c9 Jk/Zk/Qk/tA/Pk/Lk, code-home Rw/qw/Yw/Xw/eT/cT/lT, shared-14 oT." };
  await fs.writeFile(path.join(evidence, "home-page-ui-report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ passed: report.passed, checks: checks.length, failure: report.failure?.message, evidence: directory }, null, 2));
  if (failure) { console.error(failure.stack); process.exitCode = 1; }
}
