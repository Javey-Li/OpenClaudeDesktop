const { spawn } = require("node:child_process");
const { EventEmitter } = require("node:events");
const readline = require("node:readline");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
const { ApprovalLedger } = require("./approval-transport.cjs");

// This registry contains only processes spawned by this module. A reconnect
// replaces the client object, so keeping just the latest client loses children
// that are still in their SIGTERM grace period.
const liveClients = new Set();
let shuttingDown = false;
let shutdownPromise = null;
let nextApprovalConnectionEpoch = 0;
const duration = (value, fallback) => Number.isFinite(value) && value >= 0 ? value : fallback;

// The agent core behind the Codex app-server protocol. DeepSeek (default) is
// the DeepSeek Harness bridge in ../../harness, a Node script serving the
// same `app-server --stdio` contract; CODE_DESKTOP_CORE=codex selects the
// installed Codex CLI instead.
const firstExisting = (candidates) => candidates.filter(Boolean).find((p) => fs.existsSync(p));
function deepseekCoreScript() {
  return firstExisting([
    process.env.CODE_DESKTOP_DEEPSEEK_CORE,
    process.resourcesPath && path.join(process.resourcesPath, "harness/bin/codex-app-server.mjs"),
    path.resolve(__dirname, "../../harness/bin/codex-app-server.mjs"),
    path.join(os.homedir(), "claude-ui-lab/harness/bin/codex-app-server.mjs"),
  ]);
}
function nodeBinary() {
  return firstExisting([process.env.CODE_DESKTOP_NODE, "/opt/homebrew/bin/node", "/usr/local/bin/node", path.join(os.homedir(), ".local/bin/node")]) || "node";
}
function coreKind() {
  return process.env.CODE_DESKTOP_CORE === "codex" ? "codex" : "deepseek";
}
function resolveCore() {
  // An explicit CODEX_BINARY (tests' fixture servers, or a user override)
  // always wins over the default core.
  if (process.env.CODEX_BINARY) return { command: process.env.CODEX_BINARY, prefix: [], kind: "override" };
  if (coreKind() === "deepseek") {
    const script = deepseekCoreScript();
    if (script) return { command: nodeBinary(), prefix: [script], kind: "deepseek" };
  }
  const codex = firstExisting([process.env.CODEX_BINARY, path.join(os.homedir(), ".local/bin/codex"), "/opt/homebrew/bin/codex", "/usr/local/bin/codex"]);
  return { command: codex || "codex", prefix: [], kind: "codex" };
}

class CodexClient extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = options;
    this.seq = 0;
    this.pending = new Map();
    this.approvalLedger = new ApprovalLedger((event) => this.emit("event", event));
    this.approvals = this.approvalLedger.pending;
    this.ready = null;
    this.child = null;
    this.connection = null;
    this.connections = new Set();
    this.stopPromise = null;
    this.stopping = false;
  }

  start() {
    if (shuttingDown) return Promise.reject(new Error("DeepSeek is shutting down."));
    if (this.ready) return this.ready;
    this.stopping = false;
    this.stopPromise = null;
    const connection = { approvalConnectionId: randomUUID(), approvalConnectionEpoch: ++nextApprovalConnectionEpoch, child: null, reader: null, closed: false, settled: false, terminating: false, forced: false };
    connection.exited = new Promise((resolve) => { connection.resolveExit = resolve; });
    this.connections.add(connection);
    liveClients.add(this);
    this.connection = connection;
    // Publish the shared promise before spawning. Stop/restart may happen while
    // initialize is pending, so every callback belongs to this connection only.
    this.ready = Promise.resolve().then(async () => {
      if (this.connection !== connection) throw new Error("DeepSeek stopped.");
      this.approvalLedger.activate(connection);
      if (this.connection !== connection) throw new Error("DeepSeek stopped.");
      const core = this.options.binary ? { command: this.options.binary, prefix: [] } : resolveCore();
      const binary = core.command;
      const args = [...core.prefix, "app-server", "--stdio", ...(this.options.args || [])];
      const env = {
        ...process.env,
        PATH: [path.join(os.homedir(), ".local/bin"), "/opt/homebrew/bin", "/usr/local/bin", process.env.PATH]
          .filter(Boolean).join(":"),
        ...this.options.env,
      };
      const child = spawn(binary, args, {
        env,
        stdio: ["pipe", "pipe", "pipe"],
        // App-server initialization must not enter a selected Documents/iCloud
        // workspace. Actual thread/turn cwd is explicitly carried by the RPCs.
        cwd: this.options.serverCwd || os.homedir(),
      });
      connection.child = child;
      this.child = child;
      child.on("error", (error) => this.disconnect(connection, error));
      child.on("exit", (code, signal) => {
        this.disconnect(connection, new Error(`DeepSeek disconnected (${signal || code}). Reconnect to continue.`), false);
        this.settleConnection(connection, { exited: true, code, signal });
      });
      child.stdin.on("error", (error) => this.disconnect(connection, error));
      child.stdout.on("error", (error) => this.disconnect(connection, error));
      child.stderr.on("error", (error) => this.disconnect(connection, error));
      child.stderr.on("data", () => {}); // Never forward stderr/config/credentials into renderer logs.
      connection.reader = readline.createInterface({ input: child.stdout });
      connection.reader.on("line", (line) => {
        if (this.connection !== connection || connection.closed) return;
        try {
          this.receive(JSON.parse(line), connection);
        } catch (error) {
          this.emit("protocolError", error.message);
        }
      });
      const result = await this.request("initialize", {
        clientInfo: {
          name: "code_desktop_local",
          title: "Code Desktop",
          version: require("../package.json").version,
        },
        capabilities: { experimentalApi: true },
      }, this.options.initializeTimeout ?? 30000, connection);
      if (this.connection !== connection) throw new Error("DeepSeek stopped.");
      this.serverInfo = result;
      this.send({ method: "initialized", params: {} }, connection);
      this.emit("status", { connected: true });
      return result;
    }).catch((error) => {
      this.disconnect(connection, error);
      throw error;
    });
    return this.ready;
  }

  receive(message, connection = this.connection) {
    if (!connection || this.connection !== connection || connection.closed) return;
    if (message.method) {
      if (message.id !== undefined) {
        try { this.approvalLedger.register(message, connection); }
        catch (error) { this.disconnect(connection, error); }
      } else {
        if (message.method === "serverRequest/resolved") {
          try { this.approvalLedger.resolveFromServer(message.params, connection); }
          catch (error) { this.disconnect(connection, error); }
          return; // Only normalized, identity-qualified approval events reach UI.
        }
        if (message.method === "turn/completed") this.approvalLedger.expireTurn(message.params, connection);
        this.emit("event", { ...message, kind: "notification" });
      }
      return;
    }
    const pending = this.pending.get(String(message.id));
    if (!pending || pending.connection !== connection) return;
    this.pending.delete(String(message.id));
    clearTimeout(pending.timer);
    if (message.error) {
      // Keep the JSON-RPC error code/data (e.g. CodexErrorInfo
      // activeTurnNotSteerable) for callers that branch on them.
      const error = new Error(message.error.message || JSON.stringify(message.error));
      error.code = message.error.code;
      error.data = message.error.data;
      pending.reject(error);
    } else pending.resolve(message.result);
  }

  send(message, connection = this.connection) {
    if (!connection || this.connection !== connection || connection.closed || !connection.child?.stdin.writable)
      throw new Error("DeepSeek is not connected.");
    connection.child.stdin.write(JSON.stringify(message) + "\n");
  }

  request(method, params = {}, timeout = 120000, connection = this.connection) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(String(id));
        reject(new Error(`${method} timed out.`));
      }, timeout);
      this.pending.set(String(id), { resolve, reject, timer, connection });
      try {
        this.send({ id, method, params }, connection);
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(String(id));
        reject(error);
      }
    });
  }

  approvalSnapshot() {
    return this.approvalLedger.snapshot();
  }

  getApproval(id, expected) {
    return this.approvalLedger.requirePending(id, expected).event;
  }

  invalidateApprovals(reason = "reconnect") {
    return this.approvalLedger.invalidate(this.connection, reason);
  }

  respond(id, result, expected) {
    const entry = this.approvalLedger.requirePending(id, expected);
    const response = { id: entry.request.id, result };
    // Preflight before locking; a serialization error must retain the draft.
    JSON.stringify(response);
    this.approvalLedger.begin(entry);
    try { this.send(response, entry.connection); }
    catch (error) { this.approvalLedger.release(entry); throw error; }
    this.approvalLedger.resolve(entry, "responded");
    return { ...entry.identity };
  }

  settleConnection(connection, result) {
    if (result.exited) {
      this.connections.delete(connection);
      if (!this.connections.size) liveClients.delete(this);
    }
    if (connection.settled) return;
    connection.settled = true;
    clearTimeout(connection.killTimer);
    clearTimeout(connection.deadlineTimer);
    connection.reader?.close();
    // Waiting for child 'exit', rather than stdio 'close', also handles a
    // descendant that inherited a pipe. We only signal our direct child.
    connection.child?.stdin.destroy();
    connection.child?.stdout.destroy();
    connection.child?.stderr.destroy();
    if (!result.exited) connection.child?.unref();
    connection.resolveExit({
      pid: connection.child?.pid ?? null,
      forced: connection.forced,
      timedOut: false,
      ...result,
    });
  }

  terminate(connection) {
    if (!connection) return Promise.resolve({ pid: null, exited: true, forced: false, timedOut: false });
    const child = connection.child;
    if (!child?.pid || child.exitCode !== null || child.signalCode !== null) {
      this.settleConnection(connection, { exited: true, code: child?.exitCode ?? null, signal: child?.signalCode ?? null });
      return connection.exited;
    }
    if (connection.terminating) return connection.exited;
    connection.terminating = true;
    const hardTimeout = duration(this.options.shutdownHardTimeout, 2500);
    const grace = Math.min(duration(this.options.shutdownTimeout, 1000), Math.max(0, hardTimeout - 1));
    const signal = (name) => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      try { child.kill(name); } catch (error) { connection.killError = error.message; }
    };
    // A stuck app-server may not process SIGTERM; bound cleanup without ever
    // referring to this.child, which may already be a replacement process.
    connection.killTimer = setTimeout(() => {
      connection.forced = true;
      signal("SIGKILL");
    }, grace);
    connection.deadlineTimer = setTimeout(() => {
      connection.forced = true;
      signal("SIGKILL");
      this.settleConnection(connection, {
        exited: child.exitCode !== null || child.signalCode !== null,
        timedOut: child.exitCode === null && child.signalCode === null,
        ...(connection.killError ? { error: connection.killError } : {}),
      });
    }, hardTimeout);
    // Keep both timers referenced. Electron additionally defers app.quit until
    // stopAndWait settles; an unref timer cannot guarantee final escalation.
    signal("SIGTERM");
    return connection.exited;
  }

  disconnect(connection, error, terminate = true, notify = true) {
    if (!connection || connection.closed) return;
    connection.closed = true;
    connection.reader?.close();
    const active = this.connection === connection;
    if (active) {
      // Detach before rejecting promises/emitting status; their handlers may
      // immediately call start() and must receive an independent connection.
      this.connection = null;
      this.child = null;
      this.ready = null;
      for (const [id, pending] of this.pending) {
        if (pending.connection !== connection) continue;
        clearTimeout(pending.timer);
        this.pending.delete(id);
        pending.reject(error);
      }
      this.approvalLedger.invalidate(connection, "disconnected");
    }
    if (terminate) this.terminate(connection);
    if (active && notify) this.emit("status", { connected: false, error: error.message });
  }

  fail(error) {
    this.disconnect(this.connection, error);
  }

  stop() {
    this.stopping = true;
    this.disconnect(this.connection, new Error("DeepSeek stopped."), true, false);
  }

  stopAndWait() {
    this.stop();
    if (this.stopPromise) return this.stopPromise;
    // Snapshot only the connections present at this stop. A subsequent start
    // is independent and must not be killed by a previous stop's callbacks.
    const pending = [...this.connections].map((connection) => this.terminate(connection));
    this.stopPromise = Promise.all(pending).then((children) => ({
      exited: children.every((child) => child.exited),
      children,
    }));
    return this.stopPromise;
  }
}

function stopAllCodexClients() {
  if (shutdownPromise) return shutdownPromise;
  shuttingDown = true;
  shutdownPromise = Promise.all([...liveClients].map((client) => client.stopAndWait())).then((results) => {
    const children = results.flatMap((result) => result.children);
    return { exited: children.every((child) => child.exited), children };
  });
  return shutdownPromise;
}
module.exports = { CodexClient, stopAllCodexClients, resolveCore, coreKind };
