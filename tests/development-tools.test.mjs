import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { missingBuildInputs } from '../scripts/doctor.mjs';

test('a directory with a required filename cannot pass the build input check', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'open-claude-doctor-'));
  const input = 'new-2.42304.0/reference/installed-2.42304.0-20261017/ion-dist/assets/v1/vendor-frame-DfPJ1QmD.js';
  try {
    assert.ok(missingBuildInputs(root).includes(input));
    fs.mkdirSync(path.join(root, input), { recursive: true });
    assert.ok(missingBuildInputs(root).includes(input));
    fs.rmdirSync(path.join(root, input));
    fs.writeFileSync(path.join(root, input), 'fixture');
    assert.ok(!missingBuildInputs(root).includes(input));
    assert.ok(missingBuildInputs(root).length > 0, 'one supplied input must not hide the other missing inputs');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
