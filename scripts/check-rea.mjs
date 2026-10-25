import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = path.join(root, '.local/tools/rea/node_modules/rea-agents/scripts/rea.mjs');
const result = spawnSync(process.execPath, [cli, 'analyze-javascript-application', path.join(root, 'tests/fixtures/rea-electron'), '--format', 'json'], {
  cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024,
});
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(result.stderr || `REA failed (${result.status}).`);
const evidence = JSON.parse(result.stdout);
const nodes = evidence.normalized_result.graph.nodes;
assert.ok(nodes.some(node => node.kind === 'ipc-handler' && node.observations.some(observation => observation.properties.channel === 'profile:load')));
assert.ok(nodes.some(node => node.kind === 'storage' && node.observations.some(observation => observation.properties.name === 'theme')));
assert.ok(nodes.some(node => node.kind === 'endpoint' && node.observations.some(observation => observation.properties.value === 'https://api.example.test/v1/health')));
fs.mkdirSync(path.join(root, '.local/logs'), { recursive: true });
fs.writeFileSync(path.join(root, '.local/logs/rea-fixture.json'), result.stdout);
console.log(`REA fixture passed: IPC, storage, endpoint. ${nodes.length} graph nodes. No target code was executed.`);
