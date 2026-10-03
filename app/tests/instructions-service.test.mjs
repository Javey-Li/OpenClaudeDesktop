import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import service from '../electron/instructions-service.cjs';
const { createInstructionsService, findProjectFile, composeInstructions, decorateCoreParams, TOTAL_CAP } = service;

function tree() {
  const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ins-home-')));
  const repo = path.join(home, 'work', 'repo');
  fs.mkdirSync(path.join(repo, 'packages', 'app', 'src'), { recursive: true });
  return { home, repo, cleanup: () => fs.rmSync(home, { recursive: true, force: true }) };
}
const writeFile = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };

test('findProjectFile walks up to the nearest file and never reads home or /', (t) => {
  const { home, repo, cleanup } = tree(); t.after(cleanup);
  const deep = path.join(repo, 'packages', 'app', 'src');
  assert.equal(findProjectFile(deep, { home }), null);
  writeFile(path.join(home, '.code-desktop', 'instructions.md'), 'home file');
  assert.equal(findProjectFile(deep, { home }), null, 'home is a boundary');
  writeFile(path.join(repo, '.code-desktop', 'instructions.md'), 'repo');
  assert.equal(findProjectFile(deep, { home }), path.join(repo, '.code-desktop', 'instructions.md'));
  writeFile(path.join(repo, 'packages', 'app', '.code-desktop', 'instructions.md'), 'app');
  assert.equal(findProjectFile(deep, { home }), path.join(repo, 'packages', 'app', '.code-desktop', 'instructions.md'));
  assert.equal(findProjectFile('relative', { home }), null);
});

test('findProjectFile stops after 8 levels', (t) => {
  const { home, repo, cleanup } = tree(); t.after(cleanup);
  writeFile(path.join(repo, '.code-desktop', 'instructions.md'), 'repo');
  const deep = path.join(repo, ...'abcdefghi'.split(''));
  fs.mkdirSync(deep, { recursive: true });
  assert.equal(findProjectFile(deep, { home }), null);
  assert.equal(findProjectFile(path.dirname(path.dirname(deep)), { home }), path.join(repo, '.code-desktop', 'instructions.md'));
});

test('composeInstructions: format, omitted parts, comments, disabled and the 40000 cap', () => {
  const prefs = { global: '  Be brief.  ', projects: { '/w/app': { text: 'Use pnpm.' } } };
  const full = composeInstructions({ prefs, cwd: '/w/app/src', fileText: '<!-- template -->\nRun tests.', filePath: '/w/app/.code-desktop/instructions.md' });
  assert.equal(full.text, '# Custom instructions\nBe brief.\n\n# Project instructions (/w/app)\nRun tests.\n\nUse pnpm.');
  assert.deepEqual(full.parts.map(p => p.source), ['global', 'projectFile', 'projectOverride']);
  assert.equal(full.chars, full.text.length);
  assert.equal(full.truncated, false);
  const fileOnly = composeInstructions({ prefs: {}, cwd: '/r/x', fileText: 'From file', filePath: '/r/.code-desktop/instructions.md' });
  assert.equal(fileOnly.text, '# Project instructions (/r)\nFrom file');
  const commentOnly = composeInstructions({ prefs: {}, cwd: '/r', fileText: '<!-- nothing yet -->\n', filePath: '/r/.code-desktop/instructions.md' });
  assert.equal(commentOnly.text, '');
  const noFile = composeInstructions({ prefs: { projects: { '/w': { text: 'o', useFile: false } } }, cwd: '/w', fileText: 'ignored', filePath: '/w/.code-desktop/instructions.md' });
  assert.equal(noFile.text, '# Project instructions (/w)\no');
  assert.equal(composeInstructions({ prefs: { ...prefs, enabled: false }, cwd: '/w/app' }).text, '');
  const big = composeInstructions({ prefs: { global: 'g'.repeat(20000), projects: { '/w': { text: 'p'.repeat(20000) } } }, cwd: '/w', fileText: 'f'.repeat(30000), filePath: '/w/.code-desktop/instructions.md' });
  assert.equal(big.truncated, true);
  assert.equal(big.text.length, TOTAL_CAP);
  assert.ok(big.text.endsWith('\n[truncated]'));
});

test('decorateCoreParams: DeepSeek merges the namespaced key on start, resume and turn', () => {
  const read = () => ({ text: 'T' });
  for (const method of ['thread/start', 'thread/resume', 'turn/start']) {
    const params = { codeDesktop: { hints: true, customization: { modelParams: { m: { temperature: 1 } } } } };
    decorateCoreParams(method, params, { engine: 'deepseek-harness', cwd: '/w', read });
    assert.deepEqual(params.codeDesktop, { hints: true, customization: { modelParams: { m: { temperature: 1 } }, instructions: 'T' } });
    assert.equal(params.developerInstructions, undefined, 'DeepSeek never gets developerInstructions from us');
  }
  const cleared = {};
  decorateCoreParams('turn/start', cleared, { engine: 'deepseek-harness', cwd: '/w', read: () => ({ text: '' }) });
  assert.deepEqual(cleared, { codeDesktop: { customization: { instructions: null } } });
  const other = {};
  decorateCoreParams('thread/list', other, { engine: 'deepseek-harness', cwd: '/w', read });
  assert.deepEqual(other, {});
});

test('decorateCoreParams: Codex appends developerInstructions on start and resume only', () => {
  const read = () => ({ text: 'Mine' });
  const start = { developerInstructions: 'App' };
  decorateCoreParams('thread/start', start, { engine: undefined, cwd: '/w', read });
  assert.equal(start.developerInstructions, 'App\n\nMine');
  assert.equal(start.codeDesktop, undefined);
  const resume = {};
  decorateCoreParams('thread/resume', resume, { engine: 'codex', cwd: '/w', read });
  assert.equal(resume.developerInstructions, 'Mine');
  const turn = {};
  decorateCoreParams('turn/start', turn, { engine: 'codex', cwd: '/w', read });
  assert.deepEqual(turn, {});
  const empty = { developerInstructions: 'App' };
  decorateCoreParams('thread/start', empty, { engine: 'codex', cwd: '/w', read: () => ({ text: '' }) });
  assert.equal(empty.developerInstructions, 'App');
});

test('service: decorate reads the file fresh and resolves cwd from thread metadata', (t) => {
  const { home, repo, cleanup } = tree(); t.after(cleanup);
  const config = { cwd: '/nowhere', customInstructions: { global: 'G' }, threadMetadata: { t1: { cwd: repo } } };
  const client = { serverInfo: { engine: 'deepseek-harness' } };
  const svc = createInstructionsService({ getConfig: () => config, getClient: () => client, shell: {}, knownCwd: c => c, home });
  const turn = { threadId: 't1' };
  svc.decorate('turn/start', turn);
  assert.equal(turn.codeDesktop.customization.instructions, '# Custom instructions\nG');
  writeFile(path.join(repo, '.code-desktop', 'instructions.md'), 'Repo rule');
  const next = { threadId: 't1' };
  svc.decorate('turn/start', next);
  assert.equal(next.codeDesktop.customization.instructions, `# Custom instructions\nG\n\n# Project instructions (${repo})\nRepo rule`);
  config.customInstructions = { enabled: false, global: 'G' };
  const off = { cwd: repo };
  svc.decorate('thread/start', off);
  assert.equal(off.codeDesktop.customization.instructions, null);
});

test('service ops: preview, create-file (never overwrites), open/reveal, cwd validation', async (t) => {
  const { home, repo, cleanup } = tree(); t.after(cleanup);
  const opened = [], revealed = [];
  const shell = { openPath: async p => { opened.push(p); return ''; }, showItemInFolder: p => revealed.push(p) };
  const config = { cwd: repo, customInstructions: { global: 'G' } };
  const svc = createInstructionsService({ getConfig: () => config, getClient: () => ({ serverInfo: {} }), shell, home,
    knownCwd: c => { if (c !== repo) throw new Error('Unknown workspace directory.'); return c; } });
  const target = path.join(repo, '.code-desktop', 'instructions.md');
  const before = await svc.run({ op: 'preview', cwd: repo });
  assert.equal(before.text, '# Custom instructions\nG');
  assert.equal(before.engine, 'codex');
  assert.deepEqual(before.file, { path: target, exists: false, bytes: 0 });
  await assert.rejects(svc.run({ op: 'open-file', cwd: repo }), /doesn’t exist yet/);
  const created = await svc.run({ op: 'create-file', cwd: repo });
  assert.equal(created.file.exists, true);
  assert.equal(created.text, '# Custom instructions\nG', 'the template comment adds nothing');
  assert.deepEqual(opened, [target]);
  fs.writeFileSync(target, 'Custom');
  await svc.run({ op: 'create-file', cwd: repo });
  assert.equal(fs.readFileSync(target, 'utf8'), 'Custom');
  assert.equal(await svc.run({ op: 'open-file', cwd: repo }), true);
  assert.equal(await svc.run({ op: 'reveal-file', cwd: repo }), true);
  assert.deepEqual(revealed, [target]);
  await assert.rejects(svc.run({ op: 'preview', cwd: '/etc' }), /Unknown workspace directory/);
  await assert.rejects(svc.run({ op: 'nope', cwd: repo }), /Unsupported instructions operation/);
});

test('the project file is capped at 32 KB', (t) => {
  const { home, repo, cleanup } = tree(); t.after(cleanup);
  writeFile(path.join(repo, '.code-desktop', 'instructions.md'), 'x'.repeat(40 * 1024));
  const svc = createInstructionsService({ getConfig: () => ({}), getClient: () => ({ serverInfo: { engine: 'deepseek-harness' } }), shell: {}, knownCwd: c => c, home });
  const params = { cwd: repo };
  svc.decorate('thread/start', params);
  const body = params.codeDesktop.customization.instructions.split('\n').at(-1);
  assert.equal(body.length, 32 * 1024);
});
