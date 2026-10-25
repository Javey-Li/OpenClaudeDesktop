import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export function missingBuildInputs(base) {
  const appRoot = path.join(base, 'new-2.42304.0');
  const sources = {
    'current-2.2553.1': ['c838f53ee-DqwARLA7.json', 'cf27cae7f-IGfSpeOJ.js', 'shared-7-DsClUbcz.js', 'cf2613ee5-Btwr9m9F.js', 'c71860c77-CCdfSDER.js', 'c25011d97-Dg-b7-mk.png', 'c5a058668-BzDsGvUV.js', 'c41eb0199-C-RzbqEe.js', 'c8a544a8c-DRZSqxeJ.js'],
    'installed-2.42304.0-20261017': ['vendor-frame-DfPJ1QmD.js', 'shared-frame-BfjMqbuN.js', 'c3fde7009-BH42YUtA.css', 'ce598b86c-CctVJsaN.css', 'c6a992d55-sXiDGMFQ.css', 'shared-styles-Bl9zqrv-.css', 'shared-frame-CegduNQ2.css'],
  };
  const provenance = path.join(appRoot, 'app/src/generated/current-chat/provenance.json');
  if (fs.existsSync(provenance)) {
    const record = JSON.parse(fs.readFileSync(provenance));
    sources['installed-2.31226.0-20261012'] = record.modules.map(module => module.source);
  }
  const inputs = Object.entries(sources).flatMap(([snapshot, names]) => names.map(name => `new-2.42304.0/reference/${snapshot}/ion-dist/assets/v1/${name}`));
  // shortcut: this lists known inputs, not every generator dependency. A real build remains required.
  return inputs.filter(file => !fs.statSync(path.join(base, file), { throwIfNoEntry: false })?.isFile());
}

export function inspect(base = root) {
  const lock = JSON.parse(fs.readFileSync(path.join(base, 'dev-tools.lock.json')));
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, status: ok ? 'ready' : 'missing', detail });
  const command = (exe, args, cwd = base, env = process.env) => spawnSync(exe, args, { cwd, env, encoding: 'utf8', timeout: 15000 });
  add('platform', process.platform === 'darwin' && process.arch === 'arm64', `${process.platform}/${process.arch}`);
  add('node', /^24\./.test(process.versions.node) && process.versions.node.localeCompare(lock.node, undefined, { numeric: true }) >= 0, process.versions.node);
  for (const name of ['app', 'harness', 'tools']) {
    add(`${name} dependencies`, fs.existsSync(path.join(base, `new-2.42304.0/${name}/node_modules/.package-lock.json`)), 'Run npm run setup if missing.');
  }
  const electron = path.join(base, 'new-2.42304.0/app/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron');
  const version = command(electron, ['-p', 'process.versions.electron'], base, { ...process.env, ELECTRON_RUN_AS_NODE: '1' });
  add('electron', version.status === 0 && version.stdout.trim() === '44.4.3', version.status === 0 ? version.stdout.trim() : 'Binary is missing or cannot start.');
  const harness = command(process.execPath, ['new-2.42304.0/harness/bin/codex-app-server.mjs', '--version']);
  add('harness entry', harness.status === 0, harness.status === 0 ? harness.stdout.trim() : 'Cannot load the installed Harness.');
  const rea = command(process.execPath, ['.local/tools/rea/node_modules/rea-agents/scripts/rea.mjs', '--version']);
  add('rea', rea.status === 0 && rea.stdout.trim() === lock.rea, rea.status === 0 ? rea.stdout.trim() : 'Run npm run setup.');
  for (const ref of lock.references) {
    const dir = path.join(base, '.local/references', ref.name);
    const revision = command('git', ['rev-parse', 'HEAD'], dir);
    add(`reference ${ref.name}`, revision.status === 0 && revision.stdout.trim() === ref.ref, ref.ref);
  }
  const skillsRoot = path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'skills');
  for (const skill of lock.skills) {
    const file = path.join(skillsRoot, skill.name, 'SKILL.md');
    const digest = fs.existsSync(file) ? createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null;
    add(`skill ${skill.name}`, digest === skill.sha256, 'Compare SKILL.md with the pinned source.');
  }
  const missing = missingBuildInputs(base);
  return { toolingReady: checks.every(check => check.status === 'ready'), checks, build: { status: missing.length ? 'blocked' : 'inputs-present-not-built', missingInputs: missing, note: 'Known inputs only. Build must pass before the UI is ready.' } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = inspect();
  if (process.argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
  else {
    for (const check of result.checks) console.log(`${check.status.toUpperCase()} ${check.name}: ${check.detail}`);
    console.log(`BUILD ${result.build.status}: ${result.build.missingInputs.length} known reference inputs missing.`);
    if (process.argv.includes('--build')) for (const file of result.build.missingInputs) console.log(`  ${file}`);
    console.log('See docs/STATUS.md. Tooling readiness is not product readiness.');
  }
  process.exitCode = !result.toolingReady || (process.argv.includes('--build') && result.build.missingInputs.length) ? 1 : 0;
}
