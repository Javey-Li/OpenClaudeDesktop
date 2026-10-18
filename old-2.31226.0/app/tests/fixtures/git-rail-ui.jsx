import React, { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import { SourceGitStatus } from "../../src/source-git-status";
import { SourceGitRail } from "../../src/source-git-rail";
import { railReservation, commitAction } from "../../src/git-rail-model.mjs";
import "../../src/style.css";

// Isolated fixture: the rail layout has no host column in this app (official
// EpitaxySessionRail is flag-gated), so it is exercised here with fixture props.
// Nothing here is read by the production entry point.
// F12: Commit gates on workingTreeDirty (git-status-card Qe isWorkingTreeDirty), the row on hasChanges.
const dirty = { isRepo: true, cwd: "/fixtures/rail-repo", repoName: "rail-repo", branch: "feature", hasChanges: true, workingTreeDirty: true, added: 2, removed: 1, files: 1 };
const comparison = { base: "main", baseSource: "default", ahead: 2, behind: 1, same: false, mergeBase: "0000000" };
const behind = { count: 1, base: "main", tooltip: "1 commit behind main" };
const log = [];
window.gitRailFixtureLog = log;

function Fixture() {
  const [session, setSession] = useState("A");
  const [pending, setPending] = useState(false);
  const [checkoutHadRow, setCheckoutHadRow] = useState(false);
  const [dismissed, setDismissed] = useState({});
  const [remembered, setRemembered] = useState({});
  const [busy, setBusy] = useState(false);
  const [uncounted, setUncounted] = useState(false);
  const [responding, setResponding] = useState(false);
  const onMeasured = useCallback((px) => setRemembered((value) => value[session] === px ? value : { ...value, [session]: px }), [session]);
  const reservation = railReservation({ remembered: remembered[session], checkoutHadRow });
  const live = uncounted ? { ...dirty, added: 0, removed: 0, binaryFiles: 1 } : dirty;
  const status = pending ? null : live;
  const action = commitAction(live, { responding });
  // Same density scope as the app's workspace <main> (main.jsx: cds-root + data-density="compact").
  return <div className="cds-root" data-density="compact" style={{ display: "flex", gap: 32, padding: 24, alignItems: "flex-start" }}>
    <div style={{ width: 768, display: "flex", flexDirection: "column", gap: 6 }} data-fixture="band">
      <SourceGitStatus status={live} prMode="commit" behind={behind} showBehind
        onOpenFolder={() => log.push("folder")} onCopyBranch={() => log.push("copy")} onOpenChanges={() => log.push("band:changes")}
        onAction={() => log.push("band:commit")} actionLabel="Commit" actionDisabled={action.disabled} actionDisabledReason={action.disabledReason} busy={busy} />
      <SourceGitStatus status={dirty} prMode="commit" dismissReserved onOpenChanges={() => log.push("band-reserved:changes")} />
    </div>
    <div style={{ width: 320 }} data-fixture="rail" data-session={session}>
      {!dismissed[session] && <SourceGitRail key={session} status={status} comparison={comparison} prMode="commit" hideRepo={false}
        reservation={reservation} onMeasured={onMeasured}
        onOpenChanges={() => log.push(`rail:${session}:changes`)} onAction={() => log.push(`rail:${session}:commit`)} busy={busy} responding={responding}
        onDismiss={() => setDismissed((value) => ({ ...value, [session]: true }))} />}
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }} data-fixture="controls">
      <button type="button" onClick={() => setSession("A")}>Fixture: session A</button>
      <button type="button" onClick={() => setSession("B")}>Fixture: session B</button>
      <button type="button" onClick={() => setPending(true)}>Fixture: pending</button>
      <button type="button" onClick={() => setPending(false)}>Fixture: resolve</button>
      <button type="button" onClick={() => setCheckoutHadRow((value) => !value)}>Fixture: toggle checkout memory</button>
      <button type="button" onClick={() => setRemembered({})}>Fixture: forget heights</button>
      <button type="button" onClick={() => setBusy((value) => !value)}>Fixture: toggle busy</button>
      <button type="button" onClick={() => setUncounted((value) => !value)}>Fixture: toggle uncounted</button>
      <button type="button" onClick={() => setResponding((value) => !value)}>Fixture: toggle responding</button>
      <output data-fixture="remembered">{JSON.stringify(remembered)}</output>
    </div>
  </div>;
}
createRoot(document.getElementById("root")).render(<Fixture />);
