import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../new-2.42304.0/app/package.json', import.meta.url));
test('the installed PTY can execute a command and report its exit', { timeout: 5000 }, async () => {
  const pty = require('node-pty');
  const terminal = pty.spawn('/bin/sh', ['-c', 'printf pty-ready'], { env: { PATH: process.env.PATH } });
  let output = '';
  try {
    const result = await new Promise(resolve => {
      terminal.onData(text => { output += text; });
      terminal.onExit(resolve);
    });
    assert.equal(result.exitCode, 0);
    assert.match(output, /pty-ready/);
  } finally {
    terminal.kill();
  }
});
