import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pluginRequest, installLogParams, specParam } from '../packages/codex-app-server/src/plugins.js'
import { packageManager, prepareProfile } from '../bin/profile.mjs'
import { pluginSummary } from '../packages/codex-app-server/src/catalog.js'

const fakeManager = () => {
  const calls = []
  const record = (name) => async (...args) => { calls.push([name, ...args]); return { changed: true, application: 'restart-required', stage: 'install', target: args[0] } }
  return { calls, inspect: record('inspect'), installBundle: record('installBundle'), cancelInstall: record('cancelInstall'), setBundleEnabled: record('setBundleEnabled'), removeBundle: record('removeBundle') }
}

test('management methods validate their parameters before the manager runs', async () => {
  const manager = fakeManager()
  const installed = await pluginRequest('codeDesktop/plugin/install', { spec: ' dsh-plugin-x ', requestId: 'r1', approvedBuilds: ['esbuild', 'esbuild'] }, manager)
  assert.deepEqual(manager.calls.at(-1), ['installBundle', 'dsh-plugin-x', { requestId: 'r1', approvedBuilds: ['esbuild'] }])
  assert.equal(installed.requestId, 'r1')
  const generated = await pluginRequest('codeDesktop/plugin/install', { spec: '/abs/plugin' }, manager)
  assert.match(generated.requestId, /^[0-9a-f-]{36}$/)
  await pluginRequest('codeDesktop/plugin/setEnabled', { pluginName: 'p', enabled: false }, manager)
  assert.deepEqual(manager.calls.at(-1), ['setBundleEnabled', 'p', false])
  await pluginRequest('codeDesktop/plugin/remove', { pluginName: 'p' }, manager)
  assert.deepEqual(manager.calls.at(-1), ['removeBundle', 'p'])
  for (const [method, params] of [
    ['codeDesktop/plugin/install', { spec: '--registry=https://evil' }],
    ['codeDesktop/plugin/install', { spec: '' }],
    ['codeDesktop/plugin/install', { spec: 'p', requestId: '../../x' }],
    ['codeDesktop/plugin/install', { spec: 'p', approvedBuilds: 'esbuild' }],
    ['codeDesktop/plugin/install', { spec: 'p', registry: 'file:///x' }],
    ['codeDesktop/plugin/setEnabled', { pluginName: 'p', enabled: 'no' }],
    ['codeDesktop/plugin/remove', {}],
    ['codeDesktop/plugin/cancelInstall', { requestId: 'a b' }],
  ]) await assert.rejects(pluginRequest(method, params, manager), (error) => error.code === -32602, `${method} ${JSON.stringify(params)}`)
  await assert.rejects(pluginRequest('codeDesktop/plugin/inspect', { spec: 'p' }, undefined), (error) => error.code === -32601)
  assert.equal(specParam('  @scope/p@1  '), '@scope/p@1')
})

test('install output is forwarded per request and bounded', () => {
  assert.equal(installLogParams({ jobId: 'j', stream: 'stdout', text: 'x' }), null)
  const long = installLogParams({ requestId: 'r', stream: 'stderr', text: 'y'.repeat(20000), exitCode: 1 })
  assert.equal(long.text.length, 16384)
  assert.deepEqual([long.requestId, long.stream, long.exitCode], ['r', 'stderr', 1])
})

test('the user profile is seeded from the template once and keeps the core bundles', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-profile-'))
  const template = path.join(root, 'template'), dir = path.join(root, 'home', 'code-desktop', 'profile')
  fs.mkdirSync(template)
  fs.writeFileSync(path.join(template, 'package.json'), JSON.stringify({ name: 't', private: true, dependencies: {}, dsh: { profile: { bundles: ['base', 'core'] } } }))
  fs.writeFileSync(path.join(template, 'cordis.yml'), '[]\n')
  fs.writeFileSync(path.join(template, 'cordis.patch.yml'), '# local\n[]\n')
  prepareProfile(dir, template)
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).dsh.profile.bundles, ['base', 'core'])
  assert.match(fs.readFileSync(path.join(dir, 'pnpm-workspace.yaml'), 'utf8'), /nodeLinker: hoisted/)
  // The user's own edits and plugins stay; a core bundle that went missing comes back first.
  fs.writeFileSync(path.join(dir, 'cordis.patch.yml'), '# mine\n[]\n')
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 't', private: true, dependencies: { plug: '1.0.0' }, dsh: { profile: { bundles: ['core', 'plug'] } } }))
  prepareProfile(dir, template)
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
  assert.deepEqual(manifest.dsh.profile.bundles, ['base', 'core', 'plug'])
  assert.deepEqual(manifest.dependencies, { plug: '1.0.0' })
  assert.equal(fs.readFileSync(path.join(dir, 'cordis.patch.yml'), 'utf8'), '# mine\n[]\n')
  fs.rmSync(root, { recursive: true, force: true })
})

test('installs use CODE_DESKTOP_PNPM, else the bundled pnpm 11 under this node', () => {
  assert.deepEqual(packageManager('/nowhere', { CODE_DESKTOP_PNPM: '/opt/pnpm' }), { command: '/opt/pnpm' })
  assert.equal(packageManager('/nowhere', {}), undefined)
  const root = path.resolve(import.meta.dirname, '..')
  const bundled = packageManager(root, {})
  assert.equal(bundled.command, process.execPath)
  assert.ok(bundled.args[0].endsWith(path.join('pnpm', 'bin', 'pnpm.mjs')))
})

test('plugin rows tell the client what it may change', () => {
  const summary = pluginSummary({ name: 'p', version: '1.0.0', enabled: true, removable: true, optional: false, error: { code: 'operation-error', diagnostic: 'Cannot find module' }, rows: [] }, '/profile')
  assert.deepEqual(summary.codeDesktop, { removable: true, optional: false, readOnlyReason: null, loadError: 'Cannot find module' })
  assert.equal(pluginSummary({ name: 'core', readOnlyReason: 'management-required', rows: [] }, '/profile').codeDesktop.readOnlyReason, 'management-required')
})
