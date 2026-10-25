import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'dev-tools.lock.json')));
const run = (command, args, cwd = root) => {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status ?? result.signal}).`);
};

if (process.platform !== 'darwin' || process.arch !== 'arm64') {
  throw new Error('This setup currently supports macOS arm64. Read docs/PLAN.md for the platform scope.');
}
if (!/^24\./.test(process.versions.node) || process.versions.node.localeCompare(lock.node, undefined, { numeric: true }) < 0) {
  throw new Error(`Use Node ${lock.node} or a later Node 24 release.`);
}

for (const name of ['tools', 'harness', 'app']) {
  run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], path.join(root, 'new-2.42304.0', name));
}
const app = path.join(root, 'new-2.42304.0/app');
run(process.execPath, ['node_modules/electron/install.js'], app);
run(process.execPath, ['node_modules/node-pty/scripts/prebuild.js'], app);
run(process.execPath, ['node_modules/node-pty/scripts/post-install.js'], app);

const rea = path.join(root, '.local/tools/rea');
fs.mkdirSync(rea, { recursive: true });
for (const file of ['package.json', 'package-lock.json']) {
  fs.copyFileSync(path.join(root, 'tools/rea', file), path.join(rea, file));
}
run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], rea);

for (const ref of lock.references) {
  const dir = path.join(root, '.local/references', ref.name);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    run('git', ['clone', '--no-checkout', `https://github.com/${ref.repo}.git`, dir]);
    run('git', ['checkout', '--detach', ref.ref], dir);
  }
  const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' });
  if (revision.status !== 0 || revision.stdout.trim() !== ref.ref) {
    throw new Error(`${ref.name} has another revision. Preserve local changes before replacing it.`);
  }
}
run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], path.join(root, '.local/references/open-claude-ui'));

const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
const installer = path.join(codexHome, 'skills/.system/skill-installer/scripts/install-skill-from-github.py');
for (const skill of lock.skills) {
  const target = path.join(codexHome, 'skills', skill.name);
  if (fs.existsSync(target)) {
    const file = path.join(target, 'SKILL.md');
    const digest = fs.existsSync(file) ? createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null;
    if (digest !== skill.sha256) throw new Error(`${skill.name} differs from the pinned skill. Setup will not overwrite it.`);
    continue;
  }
  if (!fs.existsSync(installer)) throw new Error('Codex skill-installer is missing. See docs/SETUP.md.');
  run('python3', [installer, '--repo', skill.repo, '--ref', skill.ref, '--path', skill.path, '--name', skill.name]);
}
run(process.execPath, ['scripts/doctor.mjs']);
console.log('\nSetup finished. Build status is separate. Run npm run check:build.');
