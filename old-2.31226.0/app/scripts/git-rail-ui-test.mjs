import { _electron as electron } from "../../tools/node_modules/playwright/index.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import http from "node:http";
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";

// Git band Commit action, base/ahead/behind IPC, 10s responding poll and focus
// refresh in the real app against an isolated protocol fixture and a temp
// repository with a bare origin; then the rail layout (no host column in this
// app) in an isolated component fixture served by Vite. One Electron instance
// at a time; the app part runs only after a fresh production build.
const project = path.resolve(import.meta.dirname, "../..");
const root = path.join(project, "app");
const evidence = path.join(project, "analysis/batch-20260920");
await fs.mkdir(evidence, { recursive: true });
const startedAt = new Date().toISOString();
const directory = path.join(evidence, `git-rail-ui-${startedAt.replaceAll(":", "-")}`);
await fs.mkdir(directory, { recursive: true });
const profile = await fs.mkdtemp(path.join(directory, "profile-"));
const origin = path.join(profile, "origin.git"), cwd = path.join(profile, "rail-workspace");
await fs.mkdir(origin); await fs.mkdir(cwd);
const gitEnv = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
const git = (dir, ...args) => execFileSync("git", ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", ...args], { cwd: dir, env: gitEnv, encoding: "utf8" });
git(origin, "init", "-q", "--bare", "-b", "main");
git(cwd, "init", "-q", "-b", "main"); git(cwd, "remote", "add", "origin", origin);
await fs.writeFile(path.join(cwd, "change.txt"), "original\n"); git(cwd, "add", "."); git(cwd, "commit", "-qm", "Fixture base");
git(cwd, "push", "-q", "-u", "origin", "main"); git(cwd, "symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main");
git(cwd, "checkout", "-q", "-b", "feature");
await fs.writeFile(path.join(cwd, "f1.txt"), "one\n"); git(cwd, "add", "."); git(cwd, "commit", "-qm", "feature one");
await fs.writeFile(path.join(cwd, "f2.txt"), "two\n"); git(cwd, "add", "."); git(cwd, "commit", "-qm", "feature two");
git(cwd, "checkout", "-q", "main");
await fs.writeFile(path.join(cwd, "m1.txt"), "main moved\n"); git(cwd, "add", "."); git(cwd, "commit", "-qm", "main one"); git(cwd, "push", "-q", "origin", "main");
git(cwd, "checkout", "-q", "feature");
await fs.writeFile(path.join(cwd, "change.txt"), "replacement\nsecond\n"); // dirty worktree: +2 −1
// Every git the app spawns goes through this wrapper so polling is observed
// out of process; it only appends argv and execs the real binary.
const realGit = execFileSync("/usr/bin/which", ["git"], { encoding: "utf8", env: process.env }).trim();
const shim = path.join(profile, "bin"); await fs.mkdir(shim);
const gitLog = path.join(profile, "git-calls.log");
await fs.writeFile(path.join(shim, "git"), `#!/bin/sh\nprintf '%s\\n' "$*" >> "${gitLog}"\nexec "${realGit}" "$@"\n`, { mode: 0o755 });
const SESSION = "git-rail-thread", now = Math.floor(Date.now() / 1000);
await fs.writeFile(path.join(profile, "preferences.json"), JSON.stringify({ cwd, theme: "light", mode: "code", model: "fixture", effort: "low", threadIds: [SESSION], displayName: "Fixture" }));
await fs.writeFile(path.join(profile, "fixture-threads.json"), JSON.stringify({ next: 100, threads: { [SESSION]: { id: SESSION, cwd, name: "Git rail verification", createdAt: now, updatedAt: now, turns: [], archived: false } } }));
const env = { ...process.env, PATH: `${shim}:${process.env.PATH}`, CODE_DESKTOP_DATA: profile, CODEX_BINARY: path.join(root, "tests/fixtures/codex-server.cjs") };
delete env.ELECTRON_RUN_AS_NODE; delete env.CODE_DESKTOP_DEV_URL;
const executablePath = process.env.TEST_ELECTRON_BINARY || path.join(root, "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron");
const COMMIT_TEXT = "Commit the working tree changes with a sensible message.";
// git-rail-model COMMIT_RESPONDING_REASON names the assistant (i18n assistant-name rewrite): the fixture profile picks no
// core, so the app's default DeepSeek core names it.
const RESPONDING_REASON = "DeepSeek is working \u2014 wait for the turn to finish";
const checks = [], metrics = {}, rendererErrors = [];
let app, page, build, failure, runtime, vite, viteLog = "", profileRemoved = false;
const testSources = ["scripts/git-rail-ui-test.mjs", "tests/fixtures/codex-server.cjs", "tests/fixtures/git-rail-ui.jsx", "tests/fixtures/git-rail-fixture.html", "tests/fixtures/composer-window.cjs"];
let testSourceHashes;
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
async function verifySource() {
  assert.ok(build && Array.isArray(build.sources) && build.sources.length, "Build must contain a source manifest");
  assert.equal(sha(JSON.stringify(build.sources)), build.sourceSha256, "Build source digest must be internally consistent");
  const current = JSON.parse(await fs.readFile(path.join(root, "dist/build-info.json"), "utf8"));
  assert.equal(current.sourceSha256, build.sourceSha256, "Build changed during this test");
  assert.equal(JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8")).version, build.version, "Package version must match build");
  for (const entry of build.sources) assert.equal(sha(await fs.readFile(path.join(root, entry.path))), entry.sha256, `Build is stale: ${entry.path}`);
  for (const required of ["src/source-git-status.jsx", "src/source-git-status.css", "src/source-git-rail.jsx", "src/source-git-rail.css", "src/git-rail-model.mjs", "electron/git-status.cjs", "electron/main.cjs", "src/main.jsx"])
    assert.ok(build.sources.some(entry => entry.path === required), `Build does not identify ${required}`);
  const hashes = Object.fromEntries(await Promise.all(testSources.map(async file => [file, sha(await fs.readFile(path.join(root, file)))])));
  if (testSourceHashes) assert.deepEqual(hashes, testSourceHashes, "Test or fixture changed during this run");
  else testSourceHashes = hashes;
}
const near = (actual, expected, label, tolerance = .5) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, got ${actual}`);
const statusCalls = async () => { try { return (await fs.readFile(gitLog, "utf8")).split("\n").filter(line => line.includes("status --porcelain=v1")).length; } catch { return 0; } };
// Full worktree patch reads (workspace-git-diff): `diff … --find-renames` without --numstat (status uses --numstat).
const diffCalls = async () => { try { return (await fs.readFile(gitLog, "utf8")).split("\n").filter(line => /(^|\s)diff\s/.test(line) && line.includes("--find-renames") && !line.includes("--numstat")).length; } catch { return 0; } };
const bandProbe = () => page.evaluate(() => { const el = document.querySelector(".sg-row"), action = el?.querySelector(".sg-action"); return { sameNode: el === window.__sgRow && document.contains(el), height: el?.offsetHeight ?? null,
  gap: el ? document.querySelector(".sc-composer").getBoundingClientRect().top - el.getBoundingClientRect().bottom : null, disabled: action?.disabled ?? null, title: action?.getAttribute("title") ?? null, reason: (() => { const wrap = action?.closest(".source-tooltip-disabled-trigger"), id = wrap?.getAttribute("aria-describedby"); return id ? document.getElementById(id)?.textContent ?? null : null; })(), busy: action?.getAttribute("aria-busy") ?? null, spinners: el?.querySelectorAll(".sg-spinner").length ?? null }; });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function fixtureTurns() { return Object.values(JSON.parse(await fs.readFile(path.join(profile, "fixture-threads.json"), "utf8")).threads)[0].turns; }
try {
  build = JSON.parse(await fs.readFile(path.join(root, "dist/build-info.json"), "utf8"));
  await verifySource();
  app = await electron.launch({ executablePath, args: [root], env });
  page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  page.on("pageerror", error => rendererErrors.push(error.message));
  runtime = await app.evaluate(({ app: electronApp }) => ({ electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node, packaged: electronApp.isPackaged }));
  await page.locator(`[data-source-session-id="${SESSION}"] .source-session-open`).click();
  const row = page.locator(".sg-row"); await row.waitFor();
  await page.locator(".loading-state").waitFor({ state: "detached" });
  await page.evaluate(() => document.fonts.ready);

  // 1. Band geometry unchanged; commit-mode repo chip unbounded; no behind indicator by default.
  // F12 (heavyWorkWorker ya, getGitDiffStats(cwd, baseBranch)): the band counts merge-base(origin/main, HEAD) → worktree,
  // i.e. both feature commits (f1 +1, f2 +1) plus the dirty change.txt (+2 −1).
  assert.equal(await row.locator(".sg-added").textContent(), "+4"); assert.equal(await row.locator(".sg-removed").textContent(), "−1");
  const band = await row.evaluate(el => ({ height: el.offsetHeight, width: el.getBoundingClientRect().width,
    gap: document.querySelector(".sc-composer").getBoundingClientRect().top - el.getBoundingClientRect().bottom,
    repoMaxWidth: getComputedStyle(el.querySelector(".sg-repo")).maxWidth, repoChip: el.querySelector(".sg-repo").dataset.repoChip,
    branchShrink: getComputedStyle(el.querySelector(".sg-branch")).flexShrink, behind: el.querySelectorAll(".sg-behind").length, behindLabel: el.querySelector(".sg-behind")?.getAttribute("aria-label") ?? null, behindCount: el.querySelector(".sg-behind-count")?.textContent ?? null,
    navOverflow: getComputedStyle(el.parentElement).overflowY, navOverscroll: getComputedStyle(el.parentElement).overscrollBehaviorY, navMaxHeight: getComputedStyle(el.parentElement).maxHeight,
    actionText: el.querySelector(".sg-action")?.textContent, actionDisabled: el.querySelector(".sg-action")?.disabled, actionBusy: el.querySelector(".sg-action")?.getAttribute("aria-busy"),
    actionTitle: el.querySelector(".sg-action")?.getAttribute("title"), actionReason: (() => { const wrap = el.querySelector(".sg-action")?.closest(".source-tooltip-disabled-trigger"), id = wrap?.getAttribute("aria-describedby"); return id ? document.getElementById(id)?.textContent ?? null : null; })(), spinners: el.querySelectorAll(".sg-spinner").length }));
  metrics.band = band;
  assert.equal(band.height, 40); assert.equal(band.width, 768); assert.equal(band.gap, 6);
  assert.equal(band.repoMaxWidth, "none"); assert.equal(band.repoChip, "unbounded"); assert.equal(band.branchShrink, "9999");
  // B34 (cd5a31703 ORe): the main.jsx band passes showBehind. The fixture's main moved one commit after feature
  // branched (m1.txt), so feature is one commit behind its base and the band shows ArrowDown 1.
  assert.equal(band.behind, 1, "the band shows the behind indicator: feature is 1 commit behind its base");
  assert.equal(band.behindCount, "1"); assert.match(band.behindLabel ?? "", /^1 commit behind \S+$/);
  assert.equal(band.navOverflow, "auto"); assert.equal(band.navOverscroll, "contain"); near(parseFloat(band.navMaxHeight), await page.evaluate(() => innerHeight) / 2, "nav max-height is 50vh");
  assert.equal(band.actionText, "Commit changes"); assert.equal(band.actionDisabled, false); assert.equal(band.actionBusy, null);
  assert.equal(band.actionTitle, null, "no native title (CDS Fe tooltip only)"); assert.equal(band.actionReason, null, "enabled Commit carries no disabled reason (Hi/Fe reason only while disabled)"); assert.equal(band.spinners, 0);
  assert.equal(await page.getByRole("button", { name: "feature", exact: true }).count(), 1);
  checks.push("Band keeps 40px/768px/6px; commit-mode repo chip has no max-width; branch shrink 9999; behind indicator shows 1 commit behind (B34 ORe); nav overflow-y auto / overscroll contain / max-height 50vh; Commit enabled");

  // 2. Real comparison payload through the whitelisted IPC (scoped to the session cwd).
  const comparison = await page.evaluate(({ cwd, session }) => window.desktop.call("workspace-git-comparison", { cwd, sessionId: session }), { cwd, session: SESSION });
  metrics.comparison = comparison;
  assert.equal(comparison.base, "main"); assert.equal(comparison.ahead, 2); assert.equal(comparison.behind, 1); assert.equal(comparison.baseSource, "default");
  assert.match(comparison.mergeBase, /^[0-9a-f]{40}$/);
  const status = await page.evaluate(({ cwd, session }) => window.desktop.call("workspace-git-status", { cwd, sessionId: session }), { cwd, session: SESSION });
  assert.deepEqual({ base: status.comparison.base, ahead: status.comparison.ahead, behind: status.comparison.behind }, { base: "main", ahead: 2, behind: 1 });
  await assert.rejects(page.evaluate(() => window.desktop.call("workspace-git-status", { cwd: "/tmp" })), /Unknown workspace directory/);
  const gitLogBefore = await fs.readFile(gitLog, "utf8");
  assert.ok(!/(^|\s)(fetch|ls-remote|push|pull)(\s|$)/m.test(gitLogBefore), "no network git verb was spawned");
  checks.push("workspace-git-comparison/status return {base:'main', ahead:2, behind:1} with a real merge base; unknown cwd is rejected; no fetch/ls-remote spawned");

  // 3. Commit sends the exact official text as a real turn; while responding the action is disabled with the
  //    official reason (cc: !hasChanges || isResponding), never busy (pi holds only PR creation); the band node is
  //    kept across the turn start and every 10s poll; the Changes panel reads the diff once while polling.
  const callsBeforeClick = await statusCalls(), diffBeforeClick = await diffCalls();
  await page.evaluate(() => { window.__sgRow = document.querySelector(".sg-row"); });
  const clickedAt = Date.now();
  await row.locator(".sg-action").click();
  await page.waitForFunction(reason => { const action = document.querySelector(".sg-action"); const wrap = action?.closest(".source-tooltip-disabled-trigger"); return !!action && action.disabled && !!wrap && document.getElementById(wrap.getAttribute("aria-describedby"))?.textContent === reason; }, RESPONDING_REASON);
  await page.getByRole("button", { name: "Allow once", exact: true }).waitFor();
  const turns = await fixtureTurns();
  assert.equal(turns.length, 1); assert.equal(turns[0].items[0].type, "userMessage");
  assert.equal(turns[0].items[0].content[0].text, COMMIT_TEXT, "exact official commit ask");
  assert.equal(turns[0].items[0].content.length, 1);
  const responding = await bandProbe();
  metrics.responding = responding;
  assert.equal(responding.disabled, true); assert.equal(responding.reason, RESPONDING_REASON); assert.equal(responding.title, null, "reason is the Pu described tooltip, not a native title");
  assert.equal(responding.busy, null, "official Commit is never aria-busy for its own turn"); assert.equal(responding.spinners, 0);
  assert.equal(responding.sameNode, true, "band stays mounted across the turn start"); assert.equal(responding.height, 40); assert.equal(responding.gap, 6);
  assert.equal(git(cwd, "log", "--oneline").split("\n").filter(Boolean).length, 3, "the app itself never committed");
  await row.locator(".sg-diff").click();
  // F12: the default "All changes" scope lists the two feature commits' files plus change.txt.
  await page.locator(".sdiff-file").first().waitFor();
  await page.waitForFunction(() => document.querySelector(".sdiff-file-body") !== null);
  const diffOpened = await diffCalls();
  assert.equal(diffOpened - diffBeforeClick, 1, "opening the Changes panel reads the diff once");
  await sleep(Math.max(0, 25000 - (Date.now() - clickedAt)));
  const pollCalls = await statusCalls() - callsBeforeClick;
  metrics.pollCallsWithin25s = pollCalls;
  assert.ok(pollCalls >= 2, `expected >=2 status polls within 25s of responding, saw ${pollCalls}`);
  assert.ok(pollCalls <= 4, `polling is ~10s, saw ${pollCalls} calls in 25s`);
  metrics.diffCallsWhilePolling = await diffCalls() - diffOpened;
  assert.equal(metrics.diffCallsWhilePolling, 0, "unchanged polls do not re-read the worktree diff");
  assert.deepEqual(await page.locator(".sdiff-file").evaluateAll(nodes => nodes.map(node => node.dataset.filePath).sort()), ["change.txt", "f1.txt", "f2.txt"], "the branch diff stays on screen across polls");
  const polled = await bandProbe();
  assert.equal(polled.sameNode, true, "band stays mounted across polls"); assert.equal(polled.disabled, true); assert.equal(polled.reason, RESPONDING_REASON); assert.equal(polled.title, null); assert.equal(polled.busy, null);
  checks.push(`Commit sends "${COMMIT_TEXT}" as the only input; while responding the action is disabled with "${RESPONDING_REASON}" (no aria-busy, no spinner); band node kept at 40px/6px; no local git commit; ${pollCalls} status polls in 25s with 0 diff re-reads while the Changes panel is open`);

  // 4. Turn end stops the interval; window focus refreshes once; the band survives both; the reason disappears.
  await page.getByRole("button", { name: "Allow once", exact: true }).click();
  await page.waitForFunction(() => { const action = document.querySelector(".sg-action"); return !!action && !action.disabled; });
  await page.locator('[data-testid="code-prompt-stop"]:not([inert] *)').waitFor({ state: "detached" });
  await sleep(2500); // the running→idle refetch settles
  const idleBase = await statusCalls(), idleDiff = await diffCalls();
  await sleep(15000);
  metrics.idleCallsIn15s = await statusCalls() - idleBase;
  assert.equal(metrics.idleCallsIn15s, 0, "no polling after the turn ended");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await sleep(1500);
  metrics.focusCalls = await statusCalls() - idleBase;
  assert.equal(metrics.focusCalls, 1, "one refetch on window focus");
  assert.equal(await diffCalls() - idleDiff, 0, "an unchanged focus refetch does not re-read the diff");
  const idle = await bandProbe();
  metrics.idle = idle;
  assert.equal(idle.sameNode, true, "band stays mounted across the turn end and the focus refetch");
  assert.equal(idle.disabled, false); assert.equal(idle.reason, null, "no tooltip once enabled"); assert.equal(idle.title, null); assert.equal(idle.busy, null);
  checks.push("Polling stops after the turn ends (0 calls in 15s); window focus refetches exactly once without a diff re-read; band node kept; Commit re-enabled with no reason tooltip");
  await page.screenshot({ path: path.join(directory, "band.png") });
  assert.deepEqual(rendererErrors, []);
  await app.close(); app = null;

  // ---- Rail layout in an isolated component fixture (Vite dev server, no production build involved). ----
  const probe = net.createServer(); await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  vite = spawn(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { cwd: root, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
  vite.stdout.on("data", chunk => { viteLog += chunk; }); vite.stderr.on("data", chunk => { viteLog += chunk; });
  const url = `http://127.0.0.1:${port}/tests/fixtures/git-rail-fixture.html`;
  for (let attempt = 0; ; attempt++) {
    const ok = await new Promise(resolve => http.get(url, response => { response.resume(); resolve(response.statusCode === 200); }).on("error", () => resolve(false)));
    if (ok) break;
    if (attempt > 200) throw new Error("Vite fixture server did not start\n" + viteLog);
    await sleep(100);
  }
  const fixtureEnv = { ...process.env, COMPOSER_FIXTURE_URL: url }; delete fixtureEnv.ELECTRON_RUN_AS_NODE;
  app = await electron.launch({ executablePath, args: [path.join(root, "tests/fixtures/composer-window.cjs")], env: fixtureEnv });
  page = await app.firstWindow(); page.setDefaultTimeout(15000);
  page.on("pageerror", error => rendererErrors.push(error.message));
  const nav = page.locator('[data-fixture="rail"] nav.sgr-nav');
  await nav.locator(".sgr-row").waitFor();
  await page.evaluate(() => document.fonts.ready);

  // 5. Behind indicator markup with showBehind forced on (fixture only).
  const behindSpan = page.locator('[data-fixture="band"] .sg-row').first().locator(".sg-behind");
  const behind = await behindSpan.evaluate(el => {
    const style = getComputedStyle(el), glyph = el.querySelector('[data-cds="Icon"]');
    return { role: el.getAttribute("role"), label: el.getAttribute("aria-label"), title: el.getAttribute("title"), height: el.getBoundingClientRect().height,
      control: getComputedStyle(document.documentElement).getPropertyValue("--cds-h-control").trim(), gap: style.columnGap, paddingLeft: style.paddingInlineStart, paddingRight: style.paddingInlineEnd,
      color: style.color, muted: getComputedStyle(document.documentElement).getPropertyValue("--cds-text-muted").trim(), glyphSize: glyph && getComputedStyle(glyph).fontSize,
      count: el.querySelector(".sg-behind-count").textContent, numeric: getComputedStyle(el.querySelector(".sg-behind-count")).fontVariantNumeric,
      // Token probes resolve inside the same compact-density scope as the row.
      controlPx: (() => { const probe = document.createElement("div"); probe.style.height = "var(--cds-h-control)"; el.parentElement.append(probe); const px = probe.getBoundingClientRect().height; probe.remove(); return px; })() };
  });
  metrics.behind = behind;
  assert.equal(behind.role, "img"); assert.equal(behind.label, "1 commit behind main"); assert.equal(behind.title, null, "behind hint is the multiline K tooltip (git-status-card 1270-1292), not a native title");
  near(behind.height, behind.controlPx, "behind height is --cds-h-control"); assert.equal(behind.controlPx, 24);
  assert.equal(behind.gap, "3px"); assert.equal(behind.paddingLeft, "5px"); assert.equal(behind.paddingRight, "5px");
  assert.equal(behind.glyphSize, "16px"); assert.equal(behind.count, "1"); assert.equal(behind.numeric, "tabular-nums");
  const mutedRgb = await page.evaluate(() => { const probe = document.createElement("span"); probe.style.color = "var(--cds-text-muted)"; document.body.append(probe); const color = getComputedStyle(probe).color; probe.remove(); return color; });
  assert.equal(behind.color, mutedRgb);
  const reserved = await page.locator('[data-fixture="band"] .sg-row').nth(1).locator(".sg-dismiss-reserved").evaluate(el => el.getBoundingClientRect());
  assert.equal(reserved.width, 24); assert.equal(reserved.height, 24);
  assert.equal(await page.locator('[data-fixture="band"] .sg-row').nth(1).locator(".sg-dismiss").count(), 0);
  checks.push("Fixture-only behind indicator: role=img, aria-label = tooltip, ArrowDown 16px + tabular count '1', height 24px (--cds-h-control), gap 3px, padding-inline 5px, text-muted; dismissReserved renders a 24px square");

  // 6. Rail trigger/title/signal/aria and keyboard expansion.
  const trigger = nav.locator(".sgr-trigger");
  const railInitial = await nav.evaluate(el => {
    const trigger = el.querySelector(".sgr-trigger"), caret = trigger.querySelector(".sgr-caret"), glyph = trigger.querySelector(".sgr-glyph");
    const secondary = (() => { const probe = document.createElement("span"); probe.style.color = "var(--cds-text-secondary)"; document.body.append(probe); const color = getComputedStyle(probe).color; probe.remove(); return color; })();
    return { label: el.getAttribute("aria-label"), rowGap: getComputedStyle(el).rowGap, expanded: trigger.getAttribute("aria-expanded"),
      caretSize: getComputedStyle(caret).fontSize, glyphSize: getComputedStyle(glyph.querySelector('[data-cds="Icon"]')).fontSize, glyphLabel: glyph.getAttribute("aria-label"), glyphRole: glyph.getAttribute("role"),
      glyphColor: getComputedStyle(glyph).color, secondary, title: trigger.querySelector(".sgr-title").textContent, minHeight: getComputedStyle(trigger).minHeight,
      paddingRight: getComputedStyle(trigger).paddingRight, signal: trigger.querySelector(".sgr-signal")?.textContent ?? null, panel: !!el.querySelector(".sgr-panel") };
  });
  metrics.railInitial = railInitial;
  assert.equal(railInitial.label, "Repository and pull request controls"); assert.equal(railInitial.rowGap, "4px");
  assert.equal(railInitial.expanded, "true"); assert.equal(railInitial.panel, true, "official Zi starts expanded");
  assert.equal(railInitial.caretSize, "12px"); assert.equal(railInitial.glyphSize, "16px"); assert.equal(railInitial.glyphLabel, "Branch"); assert.equal(railInitial.glyphRole, "img");
  assert.equal(railInitial.glyphColor, railInitial.secondary); assert.equal(railInitial.title, "rail-repo · feature"); assert.equal(railInitial.minHeight, "28px");
  assert.equal(railInitial.paddingRight, "28px", "pr-7 while expanded with dismiss"); assert.equal(railInitial.signal, null, "no collapsed signal while open");
  await trigger.focus();
  await page.keyboard.press("ArrowLeft");
  assert.equal(await trigger.getAttribute("aria-expanded"), "false"); assert.equal(await nav.locator(".sgr-panel").count(), 0);
  // The caret rotation transitions over --cds-dur-fast (60ms); read the settled transform.
  await page.waitForFunction(() => getComputedStyle(document.querySelector(".sgr-caret")).transform === "none");
  // F12 GitCounts (shared-21 OV): the visible +/− pair is aria-hidden beside an sr-only unit list.
  const collapsed = await trigger.evaluate(el => ({ signal: el.querySelector('.sgr-signal [aria-hidden="true"]')?.textContent, spoken: el.querySelector(".sgr-signal .sr-only")?.textContent, caption: el.querySelector(".sgr-counts") && getComputedStyle(el.querySelector(".sgr-counts")).fontSize,
    weight: el.querySelector(".sgr-counts") && getComputedStyle(el.querySelector(".sgr-counts")).fontWeight, numeric: el.querySelector(".sgr-counts") && getComputedStyle(el.querySelector(".sgr-counts")).fontVariantNumeric,
    paddingRight: getComputedStyle(el).paddingRight, caretTransform: getComputedStyle(el.querySelector(".sgr-caret")).transform, height: el.getBoundingClientRect().height }));
  metrics.collapsed = collapsed;
  assert.equal(collapsed.signal, "+2−1"); assert.equal(collapsed.spoken, "2 additions, 1 deletion"); assert.equal(collapsed.caption, "11px"); assert.equal(collapsed.paddingRight, "4px", "signal shown: no pr-7 without touch");
  assert.equal(collapsed.weight, "400", "OV signal: tabular-nums only, no medium weight"); assert.equal(collapsed.numeric, "tabular-nums");
  assert.equal(collapsed.caretTransform, "none"); assert.equal(collapsed.height, 28);
  await page.keyboard.press("ArrowLeft"); assert.equal(await trigger.getAttribute("aria-expanded"), "false", "ArrowLeft on a collapsed row is a no-op");
  await page.keyboard.press("ArrowRight"); assert.equal(await trigger.getAttribute("aria-expanded"), "true");
  await page.waitForFunction(() => getComputedStyle(document.querySelector(".sgr-caret")).transform === "matrix(0, 1, -1, 0, 0, 0)", null, { timeout: 3000 }).catch(() => {});
  assert.equal(await trigger.locator(".sgr-caret").evaluate(el => getComputedStyle(el).transform), "matrix(0, 1, -1, 0, 0, 0)", "caret rotates 90deg when open");
  await page.keyboard.press("ArrowRight"); assert.equal(await trigger.getAttribute("aria-expanded"), "true");
  await trigger.click(); assert.equal(await trigger.getAttribute("aria-expanded"), "false");
  await trigger.click(); assert.equal(await trigger.getAttribute("aria-expanded"), "true");
  checks.push("Rail nav aria-label + 4px row gap; trigger CaretRight 12px, GitBranch 16px text-secondary aria-label Branch, title 'rail-repo · feature', 28px min-height; collapsed signal '+2 −1' at 11px caption; ArrowLeft/ArrowRight/click toggle aria-expanded; caret rotates");

  // 7. Panel and facts: only Changes for local data; geometry and colors.
  const panel = await nav.locator(".sgr-panel").evaluate(el => {
    const style = getComputedStyle(el), groups = [...el.querySelectorAll("[data-rail-group]")];
    const fact = el.querySelector('[data-rail-group="facts"] .sgr-fact');
    const label = fact.querySelector(".sgr-label"), value = fact.querySelector(".sgr-value");
    const probeColor = variable => { const probe = document.createElement("span"); probe.style.color = `var(${variable})`; document.body.append(probe); const color = getComputedStyle(probe).color; probe.remove(); return color; };
    const probeLength = variable => { const probe = document.createElement("div"); probe.style.width = `var(${variable})`; el.append(probe); const px = probe.getBoundingClientRect().width; probe.remove(); return px; };
    const action = el.querySelector(".sgr-action-row");
    return { marginLeft: style.marginLeft, borderLeft: style.borderLeftWidth, paddingLeft: style.paddingLeft, paddingBottom: style.paddingBottom,
      groups: groups.map(group => ({ name: group.dataset.railGroup, rows: group.children.length, marginTop: getComputedStyle(group).marginTop, borderTop: getComputedStyle(group).borderTopWidth })),
      factCount: el.querySelectorAll(".sgr-fact").length, factTag: fact.tagName, factLabel: fact.getAttribute("aria-label"), labelText: label.textContent, labelColor: getComputedStyle(label).color, secondary: probeColor("--cds-text-secondary"),
      valueText: value.querySelector('[aria-hidden="true"]')?.textContent ?? value.textContent, valueColor: getComputedStyle(value).color, primary: probeColor("--cds-text-primary"), valueJustify: getComputedStyle(value).justifyContent, valueMarginLeft: getComputedStyle(value).marginLeft,
      valueWeight: getComputedStyle(value.querySelector(".sgr-counts")).fontWeight,
      valueRightGap: fact.getBoundingClientRect().right - value.getBoundingClientRect().right, factMinHeight: getComputedStyle(fact).minHeight, factHeight: fact.getBoundingClientRect().height,
      factPaddingLeft: parseFloat(getComputedStyle(fact).paddingLeft), factGap: parseFloat(getComputedStyle(fact).columnGap), padXs: probeLength("--cds-pad-xs"), gapMd: probeLength("--cds-gap-md"),
      labels: [...el.querySelectorAll(".sgr-label")].map(node => node.textContent), text: el.textContent,
      action: { minHeight: getComputedStyle(action).minHeight, marginTop: getComputedStyle(action).marginTop, gap: parseFloat(getComputedStyle(action).columnGap), gapXs: probeLength("--cds-gap-xs"), paddingLeft: parseFloat(getComputedStyle(action).paddingLeft),
        button: action.querySelector(".sgr-action").textContent, flex: getComputedStyle(action.querySelector(".sgr-action")).flexGrow, disabled: action.querySelector(".sgr-action").disabled } };
  });
  metrics.panel = panel;
  assert.equal(panel.marginLeft, "10px"); assert.equal(panel.borderLeft, "1px"); assert.equal(panel.paddingLeft, "6px"); assert.equal(panel.paddingBottom, "4px");
  assert.deepEqual(panel.groups.map(group => [group.name, group.rows]), [["facts", 1], ["gates", 0], ["automation", 0]]);
  assert.ok(panel.groups.slice(1).every(group => group.marginTop === "0px" && group.borderTop === "0px"), "empty groups add no separator");
  assert.equal(panel.factCount, 1); assert.equal(panel.factTag, "BUTTON"); assert.equal(panel.factLabel, "View changes");
  assert.deepEqual(panel.labels, ["Changes"]);
  for (const absent of ["Base branch", "Status", "Repository", "Review", "Checks", "GitHub", "auto", "main"]) assert.ok(!panel.text.includes(absent), `rail must not show ${absent}`);
  assert.equal(panel.labelColor, panel.secondary); assert.equal(panel.valueColor, panel.primary); assert.equal(panel.valueText, "+2−1");
  assert.equal(panel.valueWeight, "500", "fact value counts are text-body-medium (na 1893)");
  assert.equal(panel.valueJustify, "flex-end");
  near(panel.valueRightGap, panel.padXs, "value sits at the right padding edge", 1);
  assert.equal(panel.factMinHeight, "28px"); assert.equal(panel.factHeight, 28); near(panel.factPaddingLeft, panel.padXs, "fact padding-inline = --cds-pad-xs"); near(panel.factGap, panel.gapMd, "fact gap = --cds-gap-md");
  assert.equal(panel.action.minHeight, "28px"); assert.equal(panel.action.marginTop, "2px"); near(panel.action.gap, panel.action.gapXs, "action row gap = --cds-gap-xs"); near(panel.action.paddingLeft, panel.padXs, "action row padding = --cds-pad-xs");
  assert.equal(panel.action.button, "Commit changes"); assert.equal(panel.action.flex, "1"); assert.equal(panel.action.disabled, false);
  await nav.locator('[data-rail-group="facts"] .sgr-fact').click();
  await nav.locator(".sgr-action").click();
  assert.deepEqual(await page.evaluate(() => window.gitRailFixtureLog.slice(-2)), ["rail:A:changes", "rail:A:commit"]);
  await page.getByRole("button", { name: "Fixture: toggle busy" }).click();
  assert.equal(await nav.locator(".sgr-action").getAttribute("aria-busy"), "true"); assert.equal(await nav.locator(".sgr-action").isDisabled(), true);
  await page.getByRole("button", { name: "Fixture: toggle busy" }).click();
  await nav.locator('[data-rail-group="facts"] .sgr-fact').hover();
  await page.locator(".source-tooltip-popup").waitFor();
  const tooltip = await page.locator(".source-tooltip-popup").evaluate(el => el.textContent);
  assert.ok(tooltip.includes("View changes") && tooltip.includes("Lines added and removed on this branch."), `hint + caption detail, got ${tooltip}`);
  await page.mouse.move(5, 5);
  checks.push("Panel ml 10px / border-left 1px / pl 6px / pb 4px; only the facts group is non-empty with one 'View changes' Changes row (label text-secondary, value right-aligned text-primary, 28px, pad-xs, gap-md); no Base branch/Status/Review/Checks/GitHub/auto rows; action row 28px/mt 2px with a flex-1 Commit; tooltip 'View changes' + 'Lines added and removed on this branch.'");

  // 8. Dismiss overlay: opacity 0 at rest, 1 on hover / focus-visible; per-session removal.
  const slot = nav.locator(".sgr-dismiss-slot");
  await page.mouse.move(5, 5);
  const rest = await slot.evaluate(el => ({ opacity: getComputedStyle(el).opacity, position: getComputedStyle(el).position, right: getComputedStyle(el).right, top: getComputedStyle(el).top, bottom: getComputedStyle(el).bottom }));
  assert.equal(rest.opacity, "0"); assert.equal(rest.position, "absolute"); assert.equal(rest.right, "0px"); assert.equal(rest.top, "0px"); assert.equal(rest.bottom, "0px");
  await trigger.hover();
  await page.waitForFunction(() => getComputedStyle(document.querySelector(".sgr-dismiss-slot")).opacity === "1");
  await page.mouse.move(5, 5);
  await page.waitForFunction(() => getComputedStyle(document.querySelector(".sgr-dismiss-slot")).opacity === "0");
  await trigger.focus(); await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.classList.contains("sgr-dismiss")), true);
  await page.waitForFunction(() => getComputedStyle(document.querySelector(".sgr-dismiss-slot")).opacity === "1");
  await trigger.focus(); await page.keyboard.press("ArrowLeft");
  const collapsedRest = await trigger.evaluate(el => getComputedStyle(el).paddingRight);
  assert.equal(collapsedRest, "4px");
  await page.mouse.move(5, 5); await page.locator("body").click({ position: { x: 2, y: 2 } });
  await page.waitForFunction(() => getComputedStyle(document.querySelector(".sgr-dismiss-slot")).opacity === "0");
  await trigger.hover();
  assert.equal(await trigger.locator(".sgr-signal").evaluate(el => getComputedStyle(el).visibility), "hidden", "collapsed signal yields to the dismiss overlay on hover");
  await page.mouse.move(5, 5);
  await trigger.focus(); await page.keyboard.press("Tab"); await page.keyboard.press("Enter");
  assert.equal(await nav.locator(".sgr-row").count(), 0);
  assert.equal(await page.locator('[data-fixture="rail"] nav').count(), 0, "session A rail unmounted after dismiss");
  await page.getByRole("button", { name: "Fixture: session B" }).click();
  await nav.locator(".sgr-row").waitFor();
  await page.getByRole("button", { name: "Fixture: session A" }).click();
  assert.equal(await page.locator('[data-fixture="rail"] .sgr-row').count(), 0, "dismiss is per session");
  await page.getByRole("button", { name: "Fixture: session B" }).click();
  await nav.locator(".sgr-row").waitFor();
  checks.push("Dismiss overlay absolute inset-y-0 right-0 with opacity 0 at rest, 1 on row hover and dismiss focus-visible; collapsed signal hides under hover; Enter on dismiss removes only that session's row");

  // 9. Placeholder: remembered height reserves the exact space; 4 skeleton rows = 124px capped at 360.
  const rowHeight = await nav.evaluate(el => el.getBoundingClientRect().height);
  await page.waitForFunction(height => JSON.parse(document.querySelector('[data-fixture="remembered"]').textContent).B === height, Math.round(rowHeight));
  await page.getByRole("button", { name: "Fixture: pending" }).click();
  await nav.locator(".sgr-placeholder").waitFor();
  const placeholder = await nav.locator(".sgr-placeholder").evaluate(el => ({ height: el.getBoundingClientRect().height, rows: el.querySelectorAll(".sgr-skeleton-row").length, hidden: el.querySelector(".sgr-skeleton").getAttribute("aria-hidden"),
    rowHeights: [...el.querySelectorAll(".sgr-skeleton-row")].map(row => row.getBoundingClientRect().height), gap: getComputedStyle(el.querySelector(".sgr-skeleton")).rowGap, overflow: getComputedStyle(el).overflow }));
  metrics.placeholder = { rowHeight, remembered: placeholder };
  near(placeholder.height, rowHeight, "remembered reservation equals the real row height", 1);
  assert.equal(placeholder.rows, Math.max(1, Math.round(rowHeight / 28))); assert.equal(placeholder.hidden, "true"); assert.equal(placeholder.overflow, "hidden");
  await page.getByRole("button", { name: "Fixture: resolve" }).click();
  await nav.locator(".sgr-row").waitFor();
  near(await nav.evaluate(el => el.getBoundingClientRect().height), rowHeight, "no layout jump when the real row replaces the reservation", 1);
  await page.getByRole("button", { name: "Fixture: forget heights" }).click();
  await page.getByRole("button", { name: "Fixture: toggle checkout memory" }).click();
  await page.getByRole("button", { name: "Fixture: pending" }).click();
  await nav.locator(".sgr-placeholder").waitFor();
  const fresh = await nav.locator(".sgr-placeholder").evaluate(el => ({ height: el.getBoundingClientRect().height, rows: [...el.querySelectorAll(".sgr-skeleton-row")].map(row => row.getBoundingClientRect().height),
    gaps: [...el.querySelectorAll(".sgr-skeleton-row")].slice(1).map((row, index) => row.getBoundingClientRect().top - el.querySelectorAll(".sgr-skeleton-row")[index].getBoundingClientRect().bottom),
    glyph: el.querySelector(".sgr-bone-glyph").getBoundingClientRect(), firstBar: el.querySelectorAll(".sgr-skeleton-row")[0].lastElementChild.getBoundingClientRect().width / el.querySelectorAll(".sgr-skeleton-row")[0].getBoundingClientRect().width }));
  metrics.placeholder.fresh = fresh;
  assert.equal(fresh.height, 124); assert.deepEqual(fresh.rows, [28, 28, 28, 28]); assert.deepEqual(fresh.gaps, [4, 4, 4]);
  assert.equal(fresh.glyph.width, 16); assert.equal(fresh.glyph.height, 16);
  await page.getByRole("button", { name: "Fixture: resolve" }).click();
  await nav.locator(".sgr-row").waitFor();
  await page.getByRole("button", { name: "Fixture: toggle checkout memory" }).click();
  await page.getByRole("button", { name: "Fixture: forget heights" }).click();
  await page.getByRole("button", { name: "Fixture: pending" }).click();
  await sleep(200);
  assert.equal(await nav.locator(".sgr-placeholder").count(), 0, "no memory and no checkout history reserves nothing");
  assert.equal(await nav.evaluate(el => getComputedStyle(el).display), "none", "empty nav is hidden");
  await page.getByRole("button", { name: "Fixture: resolve" }).click();
  await nav.locator(".sgr-row").waitFor();
  checks.push(`Placeholder reserves the remembered ${Math.round(rowHeight)}px (${placeholder.rows} skeleton rows) and the real row replaces it within 1px; checkout memory without a session height reserves 4×28px rows with 4px gaps = 124px; nothing is reserved without history and the empty nav is hidden`);

  // 10. Collapsed "Changes" badge ($i → xn size s = cd8aaaf0e q, Nn.neutral) and the responding state in both layouts.
  await page.getByRole("button", { name: "Fixture: toggle uncounted" }).click();
  await trigger.focus(); await page.keyboard.press("ArrowLeft");
  // qi hides the collapsed signal while the row has focus-visible; read it at rest.
  await page.mouse.move(5, 5); await page.locator("body").click({ position: { x: 2, y: 2 } });
  await nav.locator(".sgr-badge").waitFor();
  const badge = await nav.locator(".sgr-badge").evaluate(el => {
    const style = getComputedStyle(el), text = el.querySelector(".sgr-badge-text");
    const probe = (property, value) => { const node = document.createElement("div"); node.style[property] = value; el.parentElement.append(node); const computed = getComputedStyle(node)[property]; const px = node.getBoundingClientRect().width; node.remove(); return { computed, px }; };
    const bg = (() => { const node = document.createElement("span"); node.style.backgroundColor = "var(--cds-alpha-1)"; el.parentElement.append(node); const color = getComputedStyle(node).backgroundColor; node.remove(); return color; })();
    const muted = (() => { const node = document.createElement("span"); node.style.color = "var(--cds-text-muted)"; el.parentElement.append(node); const color = getComputedStyle(node).color; node.remove(); return color; })();
    return { text: el.textContent, display: style.display, radius: style.borderTopLeftRadius, paddingLeft: style.paddingLeft, paddingRight: style.paddingRight, paddingTop: style.paddingTop, paddingBottom: style.paddingBottom,
      padSm: probe("width", "var(--cds-pad-sm)").px, gap: style.columnGap, whiteSpace: style.whiteSpace, width: style.width, maxWidth: style.maxWidth, shrink: style.flexShrink, background: style.backgroundColor, alpha1: bg,
      color: style.color, muted, fontSize: style.fontSize, textOverflow: text && getComputedStyle(text).textOverflow, textOverflowHidden: text && getComputedStyle(text).overflow, height: el.getBoundingClientRect().height,
      rectWidth: el.getBoundingClientRect().width, textWidth: text && text.getBoundingClientRect().width };
  });
  metrics.badge = badge;
  assert.equal(badge.text, "Changes"); assert.equal(badge.display, "inline-flex"); assert.equal(badge.whiteSpace, "nowrap"); assert.equal(badge.shrink, "0");
  assert.ok(parseFloat(badge.radius) >= badge.height / 2, `rounded-full: radius ${badge.radius} for ${badge.height}px`);
  near(parseFloat(badge.paddingLeft), badge.padSm, "px-sm"); near(parseFloat(badge.paddingRight), badge.padSm, "px-sm"); assert.equal(badge.paddingTop, "0px"); assert.equal(badge.paddingBottom, "0px");
  assert.equal(badge.gap, "4px"); assert.equal(badge.maxWidth, "100%");
  near(badge.rectWidth, badge.textWidth + 2 * badge.padSm, "w-fit: the pill hugs its label plus px-sm", 1);
  assert.equal(badge.background, badge.alpha1, "Nn.neutral bg-alpha-1"); assert.equal(badge.color, badge.muted, "Nn.neutral text-muted"); assert.equal(badge.fontSize, "11px");
  assert.equal(badge.textOverflow, "ellipsis"); assert.equal(badge.textOverflowHidden, "hidden");
  assert.equal(await page.locator('[data-fixture="band"] .sg-row').first().locator(".sg-diff").count(), 0, "uncounted dirty tree shows no +/- in the band");
  await trigger.focus(); await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Fixture: toggle responding" }).click();
  const respondingRail = await nav.locator(".sgr-action").evaluate(el => ({ disabled: el.disabled, title: el.getAttribute("title"), reason: (() => { const wrap = el?.closest(".source-tooltip-disabled-trigger"), id = wrap?.getAttribute("aria-describedby"); return id ? document.getElementById(id)?.textContent ?? null : null; })(), busy: el.getAttribute("aria-busy"), spinner: el.querySelectorAll(".sg-spinner").length }));
  const respondingBand = await page.locator('[data-fixture="band"] .sg-row').first().locator(".sg-action").evaluate(el => ({ disabled: el.disabled, title: el.getAttribute("title"), reason: (() => { const wrap = el?.closest(".source-tooltip-disabled-trigger"), id = wrap?.getAttribute("aria-describedby"); return id ? document.getElementById(id)?.textContent ?? null : null; })(), busy: el.getAttribute("aria-busy") }));
  metrics.respondingFixture = { rail: respondingRail, band: respondingBand };
  assert.deepEqual(respondingRail, { disabled: true, title: null, reason: RESPONDING_REASON, busy: null, spinner: 0 });
  assert.deepEqual(respondingBand, { disabled: true, title: null, reason: RESPONDING_REASON, busy: null });
  assert.equal(await nav.locator(".sgr-row").count(), 1, "responding keeps the row mounted");
  await page.getByRole("button", { name: "Fixture: toggle responding" }).click();
  assert.equal(await nav.locator(".sgr-action").getAttribute("title"), null); assert.equal(await nav.locator(".source-tooltip-disabled-trigger").count(), 0); assert.equal(await nav.locator(".sgr-action").isDisabled(), false);
  await page.getByRole("button", { name: "Fixture: toggle uncounted" }).click();
  checks.push(`Collapsed uncounted signal is the official pill: inline-flex fit-content/max-w-full/shrink-0, rounded-full, px-sm (${badge.padSm}px) py-0, gap 4px, nowrap + truncating label, bg-alpha-1 text-muted caption 11px; responding disables rail and band Commit with "${RESPONDING_REASON}" and no busy state`);
  await page.screenshot({ path: path.join(directory, "rail.png") });
  assert.deepEqual(rendererErrors, []);
} catch (error) {
  failure = error;
  await page?.screenshot({ path: path.join(directory, "failure.png") }).catch(() => {});
} finally {
  await app?.close().catch(error => { failure ||= error; });
  vite?.kill("SIGTERM");
  if (build) await verifySource().catch(error => { failure ||= error; });
  await fs.rm(profile, { recursive: true, force: true }).then(() => { profileRemoved = true; }).catch(error => { failure ||= error; });
  const report = { schemaVersion: 1, suite: "git-rail-ui", passed: !failure, startedAt, at: new Date().toISOString(), fixture: true, realGit: true, directory, profileRemoved,
    build: build ? { version: build.version, builtAt: build.builtAt, sourceSha256: build.sourceSha256, verifiedSourceFiles: build.sources?.length } : null,
    runtime, testSourceHashes, executablePath, checks, metrics, rendererErrors,
    notes: ["2.31226 renders the behind indicator (cd5a31703 ORe, 3nAhFAuOAD) behind the desktop git engine; main.jsx passes showBehind with behindIndicator (B34). The fixture sets showBehind on one row to verify the markup.",
      "The rail layout is exercised in an isolated component fixture because this app has no EpitaxySessionRail host (official rail is growth-flag gated); it is not presented as the official rail."],
    ...(failure ? { error: failure.stack || String(failure), viteLog: viteLog.slice(-4000) } : {}) };
  await fs.writeFile(path.join(directory, "report.json"), JSON.stringify(report, null, 2));
  await fs.writeFile(path.join(evidence, "git-rail-ui-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
if (failure) throw failure;
