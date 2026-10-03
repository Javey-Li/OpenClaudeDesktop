// Stop must use the exact live connection shown by the renderer. In particular,
// never start a replacement client while waiting to dispatch an old click.
function interruptTurn(owner, payload) {
  const { threadId, turnId, expected } = payload || {};
  if (typeof threadId !== "string" || !threadId || typeof turnId !== "string" || !turnId
    || typeof expected?.connectionId !== "string" || !expected.connectionId
    || !Number.isSafeInteger(expected.connectionEpoch) || expected.connectionEpoch <= 0)
    throw new Error("The task identity is unavailable. Reconnect before stopping.");
  const connection = owner?.connection;
  const snapshot = owner?.approvalSnapshot();
  if (!connection || connection.closed || snapshot?.closed
    || connection.approvalConnectionId !== expected.connectionId
    || connection.approvalConnectionEpoch !== expected.connectionEpoch
    || snapshot?.connectionId !== expected.connectionId
    || snapshot?.connectionEpoch !== expected.connectionEpoch)
    throw new Error("The DeepSeek connection changed. The stop request was not sent.");
  // CodexClient.request writes synchronously and binds its promise to this
  // connection. There is no await/client lookup between this check and send.
  return owner.request("turn/interrupt", { threadId, turnId }, 120000, connection);
}

module.exports = { interruptTurn };
