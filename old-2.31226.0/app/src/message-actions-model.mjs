// The hover toolbar's turn actions under a user message (BY, approval-current.js:39671-39716): Rewind to here (jY
// :33919, ArrowCounterClockwise) and Fork from here (wi.Action ArrowSplitRight). The source offers each where the
// session can do it (Re = C && Le, ze = w && Le :38833-38834) and disables Rewind, with its reason (kY), while the
// agent works. Locally: Rewind where the core serves thread/revert (rewindServed), live only for a finished turn of an
// idle session (onRewindTo is null while running); Fork from a finished turn where the core forks at a turn
// (onForkFrom). Pure, so the decisions match the transcript's right-click menu and are unit-tested.
export function userMessageActions({ turnId, activeTurnId = null, running = false, rewindServed = false, busyReason = "", onRewindTo = null, onForkFrom = null } = {}) {
  if (!turnId) return null;
  const finished = turnId !== activeTurnId;
  const rewind = !rewindServed ? null
    : running ? { disabledReason: busyReason || null }
    : finished && typeof onRewindTo === "function" ? { onClick: () => onRewindTo(turnId) } : null;
  const fork = !running && finished && typeof onForkFrom === "function" ? () => onForkFrom(turnId) : null;
  return rewind || fork ? { rewind, fork } : null;
}
