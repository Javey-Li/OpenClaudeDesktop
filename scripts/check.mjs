import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const suites = [
  ['.', ['tests/development-tools.test.mjs', 'tests/native-pty.test.mjs']],
  ['new-2.42304.0/app', ['local-projects', 'artifact-index', 'composer-attachments-model', 'file-preview-frame', 'cowork-session-service', 'chrome-bridge', 'agent-tools-browser'].map(name => `tests/${name}.test.mjs`)],
  ['new-2.42304.0/harness', ['queue', 'store', 'background-jobs', 'tool-gate', 'approval', 'sandbox', 'fetch-undici', 'compact'].map(name => `tests/${name}.test.mjs`)],
];
for (const [dir, files] of suites) {
  console.log(`\nChecking ${dir}`);
  const result = spawnSync(process.execPath, ['--test', ...files], { cwd: path.join(root, dir), stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('\nSelected checks passed. Full suites, GUI, real models, and the Cowork VM are separate checks.');
