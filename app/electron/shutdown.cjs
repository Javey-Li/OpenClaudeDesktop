/** Defer Electron's before-quit once while owned child processes stop.
 * Does not import Electron so the re-entry/deadline contract is unit-testable.
 */
function installShutdownHandler(app, { stop, timeoutMs = 3000, onError = () => {} } = {}) {
  if (typeof stop !== "function") throw new TypeError("shutdown stop must be a function");
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) throw new TypeError("shutdown timeout must be non-negative");
  let state = "idle", completion = null;
  const reportError = (error) => {
    try { onError(error); } catch { /* Reporting must not deadlock app shutdown. */ }
  };
  const beforeQuit = (event) => {
    if (state === "complete") return;
    event.preventDefault();
    if (state === "waiting") return;
    state = "waiting";
    completion = new Promise((resolve) => {
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(deadline);
        state = "complete";
        resolve(result);
        app.quit();
      };
      const deadline = setTimeout(() => {
        const error = new Error(`Shutdown cleanup exceeded ${timeoutMs}ms.`);
        reportError(error);
        finish({ timedOut: true, error });
      }, timeoutMs);
      Promise.resolve().then(stop).then(
        (result) => finish({ timedOut: false, result }),
        (error) => { reportError(error); finish({ timedOut: false, error }); },
      );
    });
  };
  app.on("before-quit", beforeQuit);
  return {
    get state() { return state; },
    get completion() { return completion; },
    dispose() { app.removeListener("before-quit", beforeQuit); },
  };
}
module.exports = { installShutdownHandler };
