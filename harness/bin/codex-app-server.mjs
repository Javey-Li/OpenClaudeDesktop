#!/usr/bin/env node
/**
 * Code Desktop core entry: a Codex app-server compatible JSON-RPC endpoint on
 * stdio, backed by a DeepSeek Harness runtime. Code Desktop spawns this as
 * `<binary> app-server --stdio`, exactly as it spawned the Codex CLI.
 *
 * Credentials, sessions and settings come from the user's Harness home
 * ($DSH_HOME, default ~/.dsh), so a DeepSeek API key configured in DeepSeek
 * Harness works here unchanged. The profile lives there too
 * (<DSH_HOME>/code-desktop/profile, seeded from ./profile: profile.mjs), so the
 * plugins a user installs are theirs, not this checkout's.
 */
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadLayeredEnv, loadProfileDirectory, StartupError } from '@deepseek-ai/dsh-app-boot'
import { runProfile } from '@deepseek-ai/dsh/profile-boot'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { packageManager, prepareProfile } from './profile.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const installAnchor = join(root, 'package.json')
const templateDir = join(root, 'profile')

// Codex CLI compatibility: `app-server` selects the server and `--stdio` its
// transport; both are implied here. Remaining arguments reach the app plugin.
const args = process.argv.slice(2).filter((arg) => arg !== 'app-server' && arg !== '--stdio')
if (args.includes('--version') || args.includes('-V')) {
  const { default: pkg } = await import('../package.json', { with: { type: 'json' } })
  process.stdout.write(`code-desktop-deepseek-core ${pkg.version ?? '0.0.0'}\n`)
  process.exit(0)
}

try {
  const profileDir = prepareProfile(process.env.CODE_DESKTOP_PROFILE_DIR || join(resolveDshHome(), 'code-desktop', 'profile'), templateDir)
  const profile = loadProfileDirectory('code-desktop-core', profileDir, installAnchor)
  if (profile.skippedBundles.length > 0)
    throw new Error(`code-desktop-core: profile bundles failed to load: ${profile.skippedBundles.map((b) => `${b.packageName}: ${b.reason}`).join('; ')}`)
  await runProfile({
    environment: loadLayeredEnv('dsh'),
    profile: 'code-desktop',
    patchFiles: [],
    args,
    resolvedProfile: { profile, installAnchor },
    // Customize › Plugins installs run this pnpm (dsh-plugin-manager reads the launcher fact).
    ...(packageManager(root) ? { packageManager: packageManager(root) } : {}),
  })
} catch (error) {
  process.stderr.write(`${error instanceof StartupError ? error.message : error?.stack || error}\n`)
  process.exit(1)
}
