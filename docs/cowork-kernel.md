# Cowork VM runtime integration

The user selected `/Users/oleyyu/cowork-ref` as the Cowork engine on
2026-10-11. This is separate from the Chat/Code core selection and from the
older 2.2553.1 UI reference. The supplied runtime package identifies itself as
Desktop 2.31226.0. The installed app was freshly extracted on 2026-10-12 to
`reference/installed-2.31226.0-20261012`; its native addon matches the supplied
reference byte-for-byte. The installed app offers 2.31226.1 as a pending update;
that pending version was not installed or used as a source.

## Verified source contracts

- `claude-unpacked/.vite/build/index.chunk-CiiI592G.js` contains the actual
  VM orchestration. The README points at `heavyWorkWorker.js`, but that worker
  does not contain the `startVM`/session-spawn implementation in this version.
- `uBr` passes `spawn(id, processName, command, args, cwd, env, additionalMounts,
  isResume, allowedDomains, oneShot, mountSkeletonHome, oauthToken)`. The token
  is removed from `env` before the native call.
- `fLr` installs seven callbacks, in order: stdout, stderr, exit, process error,
  network status, API reachability, startup step. Exit carries process ID, exit
  code, signal, OOM kill count and peak bytes. The addon separately emits
  `guestConnectionChanged` and `vmStopped`.
- `lLr` buffers stdin until the spawn acknowledgement, then calls
  `writeStdin(id, text)`. `kill(id, signal)` requests termination; the exit
  callback establishes that it actually exited.
- VM startup calls `startVM(bundlePath, memoryGB, cpuCount, "gvisor",
  reachabilityTarget, proxyConfig, networkConfig, pacURL)`, then waits for
  `isGuestConnected()`. `_Vr` calls `installSdk(storageSubpath, version)` before
  marking the guest ready.
- `index.chunk-CC1Xit3_.js` contains the SDK stream-json transport. It uses
  `--output-format stream-json --verbose --input-format stream-json`, stdio
  tool approvals, and request-ID-correlated `control_request` /
  `control_response` / `control_cancel_request` records.
- `guest-claude` is an ARM64 Linux ELF shim. It is not the Claude model SDK.
  The installed SDK resource was found separately at
  `~/Library/Application Support/Claude/claude-code-vm/2.1.293/claude`.

## Implemented

`electron/cowork-runtime/reference.mjs` discovers the explicitly selected
reference and checks file metadata without loading native code. The default
directory can be overridden with `OPENCLAUDE_COWORK_REF`. `loadCoworkNative`
is a lazy loader for the signed Electron main process and checks the
native interface before returning it.

`electron/cowork-runtime/vm-transport.mjs` implements the observed process ABI,
serializes stdin behind spawn acknowledgement, preserves UTF-8 chunk boundaries,
keeps diagnostic stderr out of stream-json stdout, and preserves nonzero exits
and OOM metadata. Failed mounts terminate the launched process. Cancellation is
reissued after a late acknowledgement, and disconnections fail outstanding work.
Teardown removes only this transport's event listeners and targets only its own
guest process IDs.

Launch (including connection probing), stdin writes and process-stop requests
have deadlines. A timed-out spawn is removed from active processes immediately,
and its late acknowledgement triggers another kill. A stuck native kill does
not hold transport shutdown open indefinitely.

`electron/cowork-runtime/sdk-channel.mjs` runs the observed stream-json protocol
over that transport. It frames UTF-8 records with a per-record size limit,
correlates control replies, gates user messages on initialization, handles stdio
tool approvals and cancellation, redelivers pending initialization approvals,
and sends the source `interrupt` control request. Tool approvals without a host
handler deny access; unsupported controls return an explicit error. stderr stays
separate. Initialization failure terminates the owned process. A simulated
integration test joins the VM adapter to the SDK channel through a full
initialize → user message → tool approval → result exchange.

`session-service.mjs` now projects SDK messages into the app's thread/turn/item
protocol. New Cowork sessions route here in `main.cjs`; Chat, Code and previously
created sessions keep their existing engine. Cowork threads persist separately
with `cowork-vm` ownership and their SDK session UUID. Restarted incomplete turns
become interrupted, and subsequent messages resume the saved SDK session.

`main-host.mjs` / `runtime-worker.mjs` host the VM lazily on the macOS main run
loop. The supplied Swift addon dispatches Virtualization.framework work to
`DispatchQueue.main`; an Electron utility process does not pump that queue and
cannot start this VM. The unused worker host remains for protocol fixtures.
The production sequence is:
start VM → wait for guest → install SDK → mount the chosen folder → initialize
SDK → send user input. Per-turn generations isolate late events and cancellation.
The existing approval ledger displays tool permissions and user questions.
TodoWrite updates the progress panel. Changed files in the workspace's `outputs`
folder populate the original deliverables cards and artifact index. Guest paths
in final replies are translated back to host workspace paths.

`provision.mjs` creates an app-owned bundle on first task submission, using an
APFS clone of rootfs and fresh VM state. It never copies the supplied session
disk. SDK discovery validates Linux ARM64 ELF before copying to app storage.
Electron 44's Node 24 returns ENOSYS for forced clones on this Mac. On macOS,
`cloneRootfs` falls back to `/bin/cp -c -n`, retaining APFS cloning and exclusive
creation. It verifies regular-file status, size, link count and a separate inode;
there is no full 10 GB byte-copy or hard-link fallback. Other I/O failures remain
errors. Both source and copied SDK binaries must match `.payload`; `.verified`
and `.payload` are preserved for the guest's SDK verifier.

`model-settings.cjs` resolves the selected Anthropic Messages-compatible model
from OpenClaude's saved providers/DeepSeek connection. Secrets pass only to the
runtime and are not stored in thread JSON. Only first-party credentials enter
the native first-party proxy approval list. The selected provider host and port
are passed as an exact VM egress rule; arbitrary network access is not enabled. New scheduled tasks record the Cowork
engine; pre-existing schedules retain their recorded engine. The packaged main application gains the virtualization entitlement in
`scripts/sign-local.mjs`. Packaging also verifies and includes the installed
`smol-bin.arm64.img`; without this disk coworkd cannot finish guest startup.

## Native dependency audit correction

The earlier interpretation of `otool -L` was incorrect: the detailed command
`otool -l -arch arm64 swift_addon.node` identifies
`@rpath/libClaudeSwift.dylib` as **LC_ID_DYLIB**, the image's own install name,
not LC_LOAD_DYLIB. No separate libClaudeSwift file is required by that entry.
The erroneous required-file check was removed and the user was told explicitly.
The supplied six assets now pass discovery; the installed Linux ARM64 SDK
2.1.293 also passes header validation. Real VM boot was subsequently verified as described below.

## Running and remaining verification

Use a packaged build (`npm --prefix app run package`) so its main executable has
the virtualization entitlement and its resources include the smol-bin disk. Launch it manually, choose an Anthropic Messages
provider in Settings → Models, switch to Cowork, choose a folder and submit a
task. Provisioning occurs at that point, not at app startup.

Reference defaults to `~/cowork-ref` (`OPENCLAUDE_COWORK_REF` overrides it).
SDK storage defaults to `~/Library/Application Support/Claude/claude-code-vm`
(`OPENCLAUDE_COWORK_SDK_DIR` overrides it). Only executable versions, `.payload` and `.verified`
are read from that directory; account data is not imported. This local build
still requires those external runtime resources and is not a self-contained
redistributable Cowork runtime.

On 2026-10-12, isolated signed-app tests booted a real app-owned VM, reached
CONNECTED / REACHABLE, installed SDK 2.1.293, and completed its stream-json
initialize handshake. Evidence is in `analysis/chat-cowork-20261012/`:
`rootfs-clone-verification.json`, `vm-boot-success.json`, and
`vm-sdk-initialize-success.json`. Tests use fresh profiles and dummy API keys;
they do not import Claude account credentials or reuse its session disk.
The signed 0.2.180 package also completed a real guest SDK → local Anthropic
Messages fixture → SDK response roundtrip, then a real `Write` tool call with
one host permission approval. The resulting `outputs/cowork-smoke.txt` was read
back from the selected host folder. `vm-packaged-workspace.json` records this
check. The model response is a deterministic local fixture, not paid-provider
inference. Resume is verified separately in `vm-packaged-resume.json`.

The guest sandbox sets NO_PROXY private-network CIDRs and starts in the session
home. `/usr/bin/env` launches the SDK with those proxy exemptions removed and
`--chdir` set to the selected mount. This keeps requests on the enforcing proxy,
fixes ENETUNREACH for private API endpoints, and makes relative file writes land
in the selected folder. There is no shell interpolation or TLS bypass. Closing a
session retains its channel until native exit; immediate resume waits for the
old process to release its name/mounts before spawning the replacement.

Current limitations: Anthropic Messages endpoints only (no automatic OpenAI
protocol conversion or loopback forwarding), text plus files in the chosen
workspace (attachment uploads are rejected explicitly), one active turn per
session, no bypass mode, fork, explicit compaction, cloud connectors or background
SDK agents. These do not change the existing Chat/Code engines. UI components
remain the extracted source components documented in `chat-cowork-source.md`;
no screenshot imitation or new visual redesign was introduced here.

## Background checks

```sh
node app/scripts/inspect-cowork-runtime.mjs /Users/oleyyu/cowork-ref
node --test --test-concurrency=1 app/tests/cowork-*.test.mjs
```

The inspection reports `assetsAvailable` separately from `readyToRun`. The
tests use temporary files and a simulated native VM/SDK; they prove the adapter,
protocol, persistence, routing-related contracts and lifecycle handling, not
bootability or end-to-end inference. See `analysis/cowork-kernel/` for check logs.
