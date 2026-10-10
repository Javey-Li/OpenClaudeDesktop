// .claude/launch.json parsing and the preview's address rules (electron/preview-launch.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { configUrl, insideFolder, isLocalHost, navigationAllowed, normalizeConfiguration, parseJsonc, parseLaunchConfig, parseUserUrl, portFromArgs } from '../electron/preview-launch.mjs';

const root = '/work/app';

test('JSONC: comments and trailing commas are accepted, strings are left alone', () => {
  assert.deepEqual(parseJsonc('{\n // a comment\n "a": "http://x//y", /* block */ "b": [1, 2,],\n}'), { a: 'http://x//y', b: [1, 2] });
  assert.deepEqual(parseJsonc('{"s": "a \\" // not a comment"}'), { s: 'a " // not a comment' });
});

test('a configuration becomes a command, a port and a url', () => {
  const parsed = parseLaunchConfig(JSON.stringify({ version: '0.0.1', configurations: [{ name: 'web', runtimeExecutable: 'npm', runtimeArgs: ['run', 'dev'], port: 5173 }] }), root);
  assert.equal(parsed.exists, true);
  assert.equal(parsed.error, null);
  assert.equal(parsed.autoVerify, true);
  assert.deepEqual(parsed.configs, [{ name: 'web', command: 'npm', args: ['run', 'dev'], cwd: root, env: {}, port: 5173, autoPort: false, url: null, attach: false }]);
  assert.equal(configUrl(parsed.configs[0]), 'http://localhost:5173');
  assert.equal(configUrl(parsed.configs[0], 6000), 'http://localhost:6000');
});

test('program, args, cwd, env, ${workspaceFolder}, autoPort and the port fallbacks', () => {
  const { config } = normalizeConfiguration({ name: 'api', program: '${workspaceFolder}/server.js', args: ['--port', '8080'], cwd: 'api', env: { DEBUG: '1' }, autoPort: true }, root);
  assert.deepEqual(config, { name: 'api', command: 'node', args: ['/work/app/server.js', '--port', '8080'], cwd: '/work/app/api', env: { DEBUG: '1' }, port: 8080, autoPort: true, url: null, attach: false });
  assert.equal(normalizeConfiguration({ runtimeExecutable: 'vite', env: { PORT: '4100' } }, root).config.port, 4100);
  assert.equal(normalizeConfiguration({ runtimeExecutable: 'serve', runtimeArgs: ['-l', 'localhost:7000'] }, root).config.port, 7000);
  const defaulted = normalizeConfiguration({ runtimeExecutable: 'npm', runtimeArgs: ['run', 'dev'] }, root).config;
  assert.equal(defaulted.port, 3000, 'a command with no port anywhere defaults to 3000');
  assert.equal(defaulted.name, 'dev', 'the default name is the last argument');
  assert.equal(portFromArgs(['--port=5000']), 5000);
  assert.equal(portFromArgs(['-p', '3001']), 3001);
  assert.equal(portFromArgs(['dev']), null);
});

test('a url entry attaches to a running server; localhost urls are bare origins on the entry port', () => {
  const attach = normalizeConfiguration({ name: 'docs', url: 'http://localhost:4000' }, root).config;
  assert.deepEqual({ attach: attach.attach, command: attach.command, port: attach.port, url: attach.url }, { attach: true, command: null, port: 4000, url: 'http://localhost:4000' });
  assert.match(normalizeConfiguration({ url: 'http://localhost:4000/docs' }, root).problem, /bare origin/);
  assert.match(normalizeConfiguration({ url: 'http://localhost:4000', port: 4001, runtimeExecutable: 'x' }, root).problem, /doesn't match/);
  assert.match(normalizeConfiguration({ url: 'ftp://example.com' }, root).problem, /http or https/);
  assert.match(normalizeConfiguration({ url: 'https://user:pw@example.com' }, root).problem, /credentials/);
  assert.equal(normalizeConfiguration({ url: 'https://staging.example.com/app' }, root).config.url, 'https://staging.example.com/app');
});

test('malformed entries are reported, the rest still load; names are unique ignoring case', () => {
  const parsed = parseLaunchConfig(JSON.stringify({ autoVerify: false, configurations: [
    { name: 'ok', runtimeExecutable: 'npm' }, { name: 'bad', runtimeArgs: 'nope', runtimeExecutable: 'npm' }, { name: 'OK', runtimeExecutable: 'yarn' }, { name: 'none' },
    { name: 'escape', runtimeExecutable: 'npm', cwd: '../elsewhere' }, { name: 'port', runtimeExecutable: 'npm', port: 70000 },
  ] }), root);
  assert.equal(parsed.autoVerify, false);
  assert.deepEqual(parsed.configs.map((config) => config.name), ['ok']);
  assert.equal(parsed.problems.length, 5);
  assert.ok(parsed.problems.some((problem) => /malformed "runtimeArgs"/.test(problem)));
  assert.ok(parsed.problems.some((problem) => /repeats the name/.test(problem)));
  assert.ok(parsed.problems.some((problem) => /outside the project/.test(problem)));
  assert.ok(parsed.problems.some((problem) => /malformed "port"/.test(problem)));
  assert.equal(parseLaunchConfig(null, root).exists, false);
  assert.match(parseLaunchConfig('{ nope', root).error, /failed to parse/);
  assert.match(parseLaunchConfig('{"configurations": []}', root).error, /no configurations/);
  assert.match(parseLaunchConfig('{"configurations": [{"name": "x"}]}', root).error, /none of the 1 configuration/);
});

test('the preview opens http(s), about:blank and files inside the session folder only', () => {
  assert.equal(navigationAllowed('http://localhost:3000/a', root).ok, true);
  assert.equal(navigationAllowed('https://example.com', root).ok, true);
  assert.equal(navigationAllowed('about:blank', root).ok, true);
  assert.equal(navigationAllowed('file:///work/app/dist/index.html', root).ok, true);
  assert.equal(navigationAllowed('file:///work/app/../secrets.txt', root).ok, false);
  assert.equal(navigationAllowed('file:///etc/passwd', root).ok, false);
  for (const url of ['javascript:alert(1)', 'chrome://settings', 'devtools://x', 'data:text/html,hi', 'http://user:pw@localhost/', 'not a url'])
    assert.equal(navigationAllowed(url, root).ok, false, url);
  assert.equal(insideFolder('/work/app', '/work/app'), true);
  assert.equal(insideFolder('/work/app', '/work/application'), false);
  for (const host of ['localhost', '127.0.0.1', '[::1]', 'app.localhost']) assert.equal(isLocalHost(host), true, host);
  assert.equal(isLocalHost('example.com'), false);
});

test('the URL field understands localhost, ports, paths, domains and searches', () => {
  assert.equal(parseUserUrl('localhost:3000', root), 'http://localhost:3000');
  assert.equal(parseUserUrl(':5173/about', root), 'http://localhost:5173/about');
  assert.equal(parseUserUrl('https://example.com/x', root), 'https://example.com/x');
  assert.equal(parseUserUrl('example.com', root), 'https://example.com');
  assert.equal(parseUserUrl('myhost:8080', root), 'http://myhost:8080');
  assert.equal(parseUserUrl('./dist/index.html', root), 'file:///work/app/dist/index.html');
  assert.equal(parseUserUrl('~/site/a b.html', root, '/Users/me'), 'file:///Users/me/site/a%20b.html');
  assert.equal(parseUserUrl('how to center a div', root), 'https://www.google.com/search?q=how%20to%20center%20a%20div');
  assert.equal(parseUserUrl('   ', root), null);
});

test('a launch.json "cwd" that is a link to a folder outside the project is refused', async () => {
  const fs = (await import('node:fs')).default;
  const path = (await import('node:path')).default;
  fs.mkdirSync('/private/tmp/claude-501', { recursive: true });
  const base = fs.realpathSync(fs.mkdtempSync('/private/tmp/claude-501/preview-launch-'));
  try {
    const project = path.join(base, 'proj'), outside = path.join(base, 'outside');
    fs.mkdirSync(path.join(project, 'inner'), { recursive: true });
    fs.mkdirSync(outside);
    fs.symlinkSync(outside, path.join(project, 'web'));
    fs.symlinkSync(path.join(project, 'inner'), path.join(project, 'inner-link'));
    assert.match(normalizeConfiguration({ name: 'clean', runtimeExecutable: 'npm', runtimeArgs: ['run', 'clean'], cwd: 'web' }, project).problem, /"cwd" is outside the project folder/);
    assert.equal(normalizeConfiguration({ name: 'dev', runtimeExecutable: 'npm', cwd: 'inner-link' }, project).config.cwd, path.join(project, 'inner-link'), 'a link that stays inside is fine');
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});
