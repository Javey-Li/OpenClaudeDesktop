# OpenCode / MiMo Code bridge for OpenClaude Desktop

A zero-dependency Node bridge that makes the official **OpenCode** and **MiMo Code** (Xiaomi's OpenCode fork)
binaries speak the Codex app-server protocol (v0.155.1, JSON-RPC lines on stdio) that OpenClaude Desktop drives.
One bridge serves both agents; it ships as two Extension Packs (`opencode`, `mimo`) built by
`work/agents/opencode-bridge/make-pack.mjs`.

```
node bin/app-server.mjs app-server --stdio
```

## What the pack contains

| Path | |
|---|---|
| `manifest.json` | pack format 1; `core` = the core descriptor (data only), `bridge.script` = `bridge/bin/app-server.mjs` |
| `bridge/bin/app-server.mjs` | entry: detects the agent, starts the bridge |
| `bridge/src/*.js` | the bridge (no imports outside this folder, no npm dependencies) |
| `README.md` | this file |

The agent program itself is not in the pack: OpenClaude Desktop downloads the pinned official release (size + sha256
checked) or uses the user's own install.

## Pinned agent releases

| Agent | Version | Assets (darwin) | sha256 |
|---|---|---|---|
| OpenCode | 1.18.34 (`v1.18.34`, github.com/anomalyco/opencode) | `opencode-darwin-arm64.zip` 45538151 B | `8522b70f545184b3a8d97c5ca4f814093b2476d72aebfda8c48bcd072ec31d1b` |
| | | `opencode-darwin-x64.zip` 49165415 B | `66bf0638cffad3b65bd6648cc3947619e1dd71f4bfeee0a81e087ac036bb1088` |
| MiMo Code | 0.1.15 (`v0.1.15`, github.com/XiaomiMiMo/MiMo-Code) | `mimocode-darwin-arm64.zip` 33820063 B | `9805686d8e14a5bff091833ec021aba0e7f7d41361cebf90152482e5c38e40b3` |
| | | `mimocode-darwin-x64.zip` 36144793 B | `42a3f0416dbcfb8590ae504538d27a0414e9625a7b766b2512aeafe7b8b35cad` |

## How it works

- **Server.** One `opencode serve` / `mimo serve` per bridge on a random loopback port with HTTP basic auth (fresh
  random password). The global SSE stream (`/global/event`) carries every session's events.
- **Config overlay.** `OPENCODE_CONFIG_DIR` / `MIMOCODE_CONFIG_DIR` points at `<state>/config`, layered over the
  user's own config: Settings › Models custom providers (`CODE_DESKTOP_PROVIDERS_FILE`, keys by `{env:…}` reference),
  Connectors (MCP) added in OpenClaude Desktop, skill switches, plugins added in OpenClaude Desktop, `autoupdate: false`.
- **Plugin.** `<state>/config/plugin/code-desktop.js` (generated, no imports) is the per-session channel the HTTP API
  lacks: custom system prompt (replaces the assembled prompt; skills/MCP catalogs kept), project instructions,
  per-model temperature / max tokens, the shell sandbox profile, and a capture of the real prompt for the preview.
- **Sandbox.** `$SHELL` (and OpenCode's `shell` config) is a wrapper that runs every agent shell command under macOS
  Seatbelt: workspace-write (cwd + extra roots + temp, network per sandboxPolicy) for Auto/Ask/Accept edits,
  read-only for Plan/chat/review, none for Bypass. Fails closed to read-only.
- **Permissions.** Each session's ruleset makes every non-read call ask; the bridge answers each `permission.asked`
  from the thread's *current* mode (allow, Codex approval card, or reject), so Mode changes apply mid-turn.
  "Allow for this session" is kept by the bridge per root thread (the ask's `always` patterns) and answers later
  asks only in a mode that may act; it is never offered in Plan / chat / review and is dropped on every mode change
  (a card answered across one records none); the agent is only ever told `once`. Cards still open for asks the new grant
  covers (OpenCode runs a step's tool calls in parallel) are withdrawn and answered `once` too. OpenCode's own `always` is stored per
  project folder and outranks every session ruleset, so it would reach other sessions and the read-only modes.
  MiMo's background actors (the actor tool's default `spawn`) never ask: they read the session ruleset and fail
  closed otherwise, so on MiMo the ruleset also grants what the mode allows (Auto: every tool except paths outside
  the workspace, secrets and repeated calls; Accept edits: edits; Bypass: everything) plus the session grants, and
  is re-PATCHed on every mode change. A switch to a read-only mode mid-turn still stops edits at once (the plugin's
  edit guard) and shell writes (the sandbox). The user's own config denies (`opencode.json` / `mimocode.json`,
  global and project) are appended after the bridge's rules in every mode, MiMo's compose-only skills
  (`compose:*`) stay denied and are left out of `skills/list`, and the plan file under the data folder (a folder
  without git) is writable in Plan.
- **Account.** `account/read` reports an account only for providers that hold a credential: the agent's auth store
  (`<data>/<agent>/auth.json`: browser sign-ins `oauth`, saved keys `api`), a key environment variable, a
  Settings › Models provider, or a key in the user's config. The free tier (OpenCode Zen, MiMo Auto) and providers
  the agent's config lists without a key (MiMo's `xiaomi`) are not an account; `<agent>.freeTier` names the free
  tier and `<agent>.providers[].auth` how each provider is signed in. A browser sign-in reads as Codex's
  `chatgpt` account with `planType` naming what was signed in to (ChatGPT Pro/Plus, Xiaomi MiMo, GitHub Copilot …),
  so no reader mistakes another vendor's sign-in for ChatGPT. `account/logout` without `codeDesktop.provider`
  removes every credential in the auth store; `<agent>.canSignOut` says whether there is any, and with none the
  logout fails with where the remaining key lives (an environment variable, Settings › Models, the config). When
  `GET /provider` fails (the server still starting) the answer rests on the auth store alone, `<agent>.unknown` is
  true and `requiresOpenaiAuth` false, and `account/updated` follows once the provider list answers. The default
  model prefers a provider with a credential, then the free tier, then a provider still missing its key.
- **MCP OAuth.** `mcpServer/oauth/login` listens on the agent's callback address (127.0.0.1:19876, or the server's
  `oauth.redirectUri` / `callbackPort`) before starting the agent's flow (`POST /mcp/:name/auth`), so the agent
  leaves that port alone; the redirect's state is checked and the code goes to `POST /mcp/:name/auth/callback`.
- **Plugins.** `plugin/installed` lists what the agent loads for the home folder and the asked-for project folders
  (`cwds`; `plugin/read` reuses the last ones): the global config's `plugin`, each project's config file, and the
  `{plugin,plugins}/*.{ts,js}` files of every config folder (`~/.config/<agent>`, `<project>/.<agent>`). `GET /config`
  answers the merged list without origins, so each row carries `codeDesktop.origin` (`globalConfig`, `globalFolder`,
  `projectConfig`, `projectFolder`, `codeDesktop`) with a localized description (`{en, zh-CN}`) saying where it comes
  from, and `[spec, options]` entries keep their options (shown, not edited). `plugin/read` returns the hooks and
  tools (`tools: [{name, description}]`) the plugin registers, read from its source (a local file, or the package
  entry in the agent's package cache) without running it; a tool is kept when the agent lists it for that folder.
- **Plan review.** The plan card's "Keep planning": OpenCode's `plan_exit` ends the turn on `No`, so typed feedback
  is queued as the next message. MiMo's keeps the turn on any answer but `Yes`, and takes any other answer as the
  user's feedback, so the feedback is the answer itself and MiMo refines the plan in the same turn.
- **MiMo workflows.** A `workflow` tool run is the call's `item.workflowRun` (structure tree polled while it runs). A
  run that outlives its call (`async: true`, a `resume` call, a settled run MiMo ran again) follows MiMo's run list
  (`GET /workflows?sessionID=`, its transcript route, the `workflow.*` events): `background: true`, and its Stop asks
  the model to cancel it with MiMo's own tool (`stopScope: 'run'`; MiMo has no cancel route). A failed or stopped
  top-level run is `resumable`: `codeDesktop/workflow/resume` calls `POST /workflows/:runID/resume` (Dynamic
  workflows on MiMo's engine, not in a read-only mode). A run MiMo's list keeps running that this MiMo no longer
  holds (it quit) ends failed. A command wins over a skill of its name (MiMo's `/deep-research`); a command whose
  template calls `workflow({…})` carries `requiresWorkflowTool` and is refused while the thread withholds the tool.
- **OpenClaude Desktop's tools.** The plugin names the app thread with the `__code_desktop_session` argument
  (`tool.execute.before`); `experimental.chat.messages.transform` drops it from every step's history, so the model
  never sees it and the prompt prefix stays the same across steps and turns.
- **State.** `threads.json` may be shared by several bridges (a workflow run starts its own core on the same state
  folder): a flush re-reads it under a lock file and writes only the fields this process changed.
- **MiMo differences** handled: `MIMOCODE_*` env, `mimocode.json`, snake_case tool arguments, sub-agent actors inside
  the parent session (projected as `<session>~<actor>` threads), `task` work items as the plan checklist, the
  `prompt_async` rate limit (turns use `POST /message`), title revisions on rename.

## Capabilities (initialize)

`customization`, `permissionHints`, `systemPromptPreview`, `livePermissions`, `toolSelection`, `codeStats`,
`structuredOutput`, `deleteHistory`, `unloadOnNavigate`, `perTokenBilling`, `skillToggle`, `mcpConfigWrite`,
`pluginManage`; not: `modelWorkflows`, `harnessProfile`, `providerSettings`, `computerUse`, `backgroundTerminals`.
`unsupportedMethods`: `thread/rollback` (rewind uses `thread/revert`), `thread/backgroundTerminals/terminate`.

## Environment

| Variable | |
|---|---|
| `CODE_DESKTOP_AGENT_BINARY` | the agent program (empty: `opencode` / `mimo` on PATH) |
| `CODE_DESKTOP_AGENT_RUNNER`, `CODE_DESKTOP_NODE_BINARY` | `node` runner support |
| `CODE_DESKTOP_AGENT_VERSION` | the installed release (reported until the server answers) |
| `CODE_DESKTOP_BRIDGE_STATE` | the bridge's folder (thread index, config overlay, runtime files, `bridge.log`) |
| `CODE_DESKTOP_OPENCODE_FLAVOR` | force `opencode` or `mimo` (otherwise from the binary name / path) |
| `CODE_DESKTOP_PROVIDERS_FILE` + `CODE_DESKTOP_PROVIDER_KEY_<ROUTE>` | custom providers (Settings › Models format) |
| `CODE_DESKTOP_OPENCODE_CONFIG_EXTRA` | JSON merged into the overlay (tests, advanced users) |

## Tests

```
node --test harness/tests/opencode-bridge*.test.mjs
node harness/tests/opencode-bridge-smoke.mjs both            # real binaries, scripted model, temp homes
node harness/tests/opencode-bridge-smoke.mjs both --from-packs  # the same, from the assembled packs
```
