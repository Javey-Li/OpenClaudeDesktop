// 总看板 three-level screenshots from the real Electron app (dist/), light and dark.
// The board reads the owner's real sources (Codex sessions, superagent, T3), so the
// pictures contain real project names: they go to a local folder, never into the repo.
// The app itself runs on a throwaway profile with the fixture core, so no chat session shows.
//   cd app && npx vite build && BOARD_SHOTS=/some/dir node scripts/board-levels-screenshots.mjs
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron } from '../../tools/node_modules/playwright/index.mjs';

const root = path.resolve(import.meta.dirname, '..');
const out = process.env.BOARD_SHOTS || path.join(os.tmpdir(), 'board-levels-shots');
await fs.mkdir(path.join(out, 'parts'), { recursive: true });

async function profile(theme) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `board-shots-${theme}-`));
  await fs.mkdir(path.join(dir, 'codex-home'), { recursive: true });
  const write = (file, value) => fs.writeFile(path.join(dir, file), JSON.stringify(value));
  await write('preferences.json', { cwd: dir, theme, mode: 'code', locale: 'zh-CN', whatsNewSeen: '999.0.0', onboarded: true, sidebarWidth: 260 });
  await write('fixture-core.json', { engine: 'deepseek-harness', capabilities: {}, models: [] });
  await write('fixture-usage.json', { 'account/read': { result: { account: { type: 'apiKey' }, requiresOpenaiAuth: false, deepseek: { apiKey: { configured: true, source: 'file' }, platform: null, links: null } } } });
  await write('fixture-threads.json', { next: 1, threads: {} });
  return dir;
}

// Wait until every finite animation and transition has finished (running dots loop on purpose and are skipped).
async function settle(page, extra = 250) {
  await page.waitForFunction(() => document.getAnimations().every((animation) => {
    const timing = animation.effect?.getComputedTiming?.();
    return animation.playState !== 'running' || timing?.iterations === Infinity;
  }), null, { timeout: 15000 });
  await page.waitForTimeout(extra);
}

async function shot(page, name, { fullPage = false } = {}) {
  await settle(page);
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage });
  console.log('wrote', name);
}

async function part(page, selector, name, index = 0) {
  const node = page.locator(selector).nth(index);
  if (!(await node.count())) { console.log('missing', selector); return false; }
  await node.scrollIntoViewIfNeeded();
  await settle(page);
  await node.screenshot({ path: path.join(out, 'parts', `${name}.png`) });
  console.log('wrote part', name);
  return true;
}

const scrollTo = (page, selector) => page.evaluate((sel) => {
  const node = document.querySelector(sel);
  const scroller = document.querySelector('.psb-page');
  if (node && scroller) scroller.scrollTop += node.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 24;
}, selector);

const resetScroll = (page) => page.evaluate(() => {
  const scroller = document.querySelector('.psb-page');
  if (scroller) scroller.scrollTop = 0;
});

for (const theme of ['light', 'dark']) {
  const dir = await profile(theme);
  const env = { ...process.env, CODE_DESKTOP_CORE_SYSTEM_PATHS: '', CODE_DESKTOP_DATA: dir, CODEX_HOME: path.join(dir, 'codex-home'), CODEX_BINARY: path.join(root, 'tests/fixtures/codex-server.cjs') };
  delete env.ELECTRON_RUN_AS_NODE; delete env.CODE_DESKTOP_DEV_URL;
  const app = await electron.launch({ args: [root], executablePath: path.join(root, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'), env, colorScheme: theme, timeout: 30000 });
  try {
    const page = await app.firstWindow();
    await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.setContentSize(1440, 900); w.center(); });
    await page.waitForLoadState('domcontentloaded');
    await page.getByText('总看板', { exact: true }).first().click({ timeout: 20000 });
    await page.locator('.psl-project-card').first().waitFor({ timeout: 60000 });

    // Level 1
    await shot(page, `${theme}-1-today`);
    await scrollTo(page, '.psl-section');
    await shot(page, `${theme}-1-today-projects`);
    await part(page, '.psl-project-card', `${theme}-project-card`);

    // Level 2: the project with the most running lines
    const projectIndex = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.psl-project-card')];
      const running = cards.map((card) => Number(card.querySelector('.psl-stat b')?.textContent || 0));
      return running.indexOf(Math.max(...running));
    });
    await page.locator('.psl-project-card').nth(projectIndex).click();
    await page.locator('.psl-line-card').first().waitFor();
    await page.locator('.psl-section-head').getByText('全部', { exact: true }).click().catch(() => {});
    await resetScroll(page);
    await shot(page, `${theme}-2-project`, { fullPage: true });
    await part(page, '.psl-line-card', `${theme}-line-card`);

    // Level 3: a running Codex line (it has tool calls, context and models)
    const lineCard = page.locator('.psl-line-card[data-state="running"]').filter({ hasText: 'Codex' }).first();
    const target = (await lineCard.count()) ? lineCard : page.locator('.psl-line-card').filter({ hasText: 'Codex' }).first();
    await target.click();
    await page.locator('.psa-monitor').waitFor();
    await resetScroll(page);
    await shot(page, `${theme}-3-line`, { fullPage: true });
    await part(page, '.psa-monitor', `${theme}-monitor`);
    await part(page, '.psa-toolgroup', `${theme}-toolgroup`);
    // one call opened: plain sentence + result, raw JSON still folded
    const toolHead = page.locator('.psa-tool-head').first();
    if (await toolHead.count()) {
      await toolHead.click();
      await part(page, '.psa-toolgroup', `${theme}-toolgroup-open`);
    } else {
      console.log('missing', '.psa-tool-head', '— this line has no tool calls');
    }
    await scrollTo(page, '.psl-detail-pair');
    await shot(page, `${theme}-3-line-context`);
    await part(page, '.psa-ctxmap', `${theme}-ctxmap`);
    await part(page, '.psa-chain', `${theme}-chain`);
  } finally {
    await app.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
}
console.log('done →', out);
