import React, { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { SourceMenu } from "./source-menu.jsx";
import { SourceTooltip, textOverflows } from "./source-tooltip.jsx";
import { SourceSettingsButton } from "./source-settings-button.jsx";
import { GitCounts } from "./source-git-counts.jsx";
import { gitRepoMenuItems } from "./git-rail-model.mjs";
import "./source-git-status.css";
import { t } from "../electron/i18n/index.mjs";

const basename = (path = "") => path.split("/").filter(Boolean).pop() || path;

/** Current c819d4a78-DmjxkWNN Ii, neutral band (non-rail) repository row.
 * Only verified local dirty state is rendered. The action is the real Commit
 * turn supplied by the integration layer; PR/CI/review slots stay absent.
 *
 * prMode: every local session without a forge repo is `commit` (git-status-card
 * 4711/4912), so the repo chip has no 160px bound and no base is shown.
 * behind/showBehind: markup of the official behind indicator (1240-1262). It is
 * off by default because official 2.2553.1 gates it on intl id `xq0t4i`, which
 * ships in no ion-dist/i18n catalog and therefore never renders there.
 * dismissReserved: the aspect-square w-control spacer when dismiss is absent.
 * busy: official prBusy (PR creation only; a commit turn never sets it). The
 * disabled reason is shown only while disabled (Ii 1092 `reason: he ? L : void 0`).
 *
 * Hints are CDS tooltips, never native titles: repo chip = git-chips D 46-96
 * (tooltip `repo || cwd` from git-status-card 5231, only when it differs from
 * the chip label, forced closed while the chip menu is open); branch chip = M
 * 97-221 (full name only when the head/tail label is truncated, closed while
 * its menu is open); behind = multiline K (1270-1292); counts = K 'View
 * changes' (1296-1318); disabled Commit = Fe/shared-frame Pu (1085-1119,
 * 4869-4895: multiline, closeOnClick false, hidden described reason).
 * The repo menu follows cc70f2bdf Ko/qo (gitRepoMenuItems); copies report
 * through onCopyPath/onCopyBranch, whose caller raises the success toast.
 *
 * F12: the counts and Commit are CDS secondary Buttons (git-status-card
 * 1081-1122 / 1287-1305 render H without a variant = shared-frame :2815 "secondary");
 * the counts are OV GitCounts (sr-only "N additions, M deletions", the tooltip
 * stays "View changes"); the chip menus are Popups side bottom / align start
 * (git-chips 48/83 menuAlign "start"). `stale` renders the inert last snapshot
 * of a revisited session (git-status-card 2816-2962 Na, git-pr-slot 5834-5990);
 * onMeasured reports the live band height for that hold.
 */
export function SourceGitStatus({
  status, onOpenFolder, onCopyPath, onCopyBranch, onOpenChanges, onDismiss, dismissReserved = false,
  onAction, actionLabel, actionDisabled = false, actionDisabledReason, busy = false,
  prMode = "commit", behind = null, showBehind = false, stale = false, heightPx, onMeasured, pr = null,
}) {
  const [menu, setMenu] = useState(null);
  const branchHead = useRef(null), branchTail = useRef(null), nav = useRef(null);
  const visible = !!status?.isRepo && !!status.hasChanges;
  useEffect(() => {
    if (!visible || stale || !onMeasured || !nav.current || typeof ResizeObserver !== "function") return undefined;
    const node = nav.current;
    const report = () => onMeasured(Math.round(node.getBoundingClientRect().height));
    report();
    const observer = new ResizeObserver(report);
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible, stale, onMeasured]);
  if (!visible) return null;
  const localOnly = prMode === "commit" || prMode === "none";
  const repoName = status.repoName || basename(status.cwd);
  const branch = status.branch || status.head || "HEAD";
  const added = status.added, removed = status.removed;
  const counted = Number.isFinite(added) && Number.isFinite(removed) && (added > 0 || removed > 0);
  if (stale) return <SourceGitStatusStale repoName={repoName} branch={branch} localOnly={localOnly}
    counts={counted ? { added, removed } : null} actionLabel={onAction ? actionLabel : undefined} heightPx={heightPx} />;
  const behindShown = showBehind && behind && Number.isFinite(behind.count) && behind.count > 0
    && typeof behind.tooltip === "string" && behind.tooltip;
  const split = Array.from(branch).length >= 16
    ? { head: Array.from(branch).slice(0, -10).join(""), tail: Array.from(branch).slice(-10).join("") }
    : null;
  const open = (kind) => (event) => {
    event.preventDefault();
    setMenu({ kind, anchor: event.currentTarget });
  };
  const run = (callback, value) => {
    setMenu(null);
    callback?.(value);
  };
  const repoMenu = gitRepoMenuItems({ openFolder: !!onOpenFolder, copyPath: !!onCopyPath });
  const repoActions = { "Show in Finder": () => run(onOpenFolder, status.cwd), "Copy path": () => run(onCopyPath, status.cwd) };
  // D: `S = t && t !== e ? t : void 0` with t = repo || cwd (no forge repo locally).
  const repoTooltip = status.cwd && status.cwd !== repoName ? status.cwd : undefined;
  // M: V = A(N) || A(P) ? branchName : undefined, measured when the tooltip opens.
  const branchTooltip = () => (textOverflows(branchHead.current) || textOverflows(branchTail.current) ? branch : undefined);
  // Ii 1296-1318: OV with `contents text-body-medium` inside the counts Button, `contents` in the static span.
  const counts = (className) => <GitCounts added={added} removed={removed} className={className} />;
  return <nav ref={nav} className="sg-status" aria-label={t("Repository and pull request controls")}>
    <div className="sg-row" data-source-component="GitStatusCard">
      <div className="sg-leading">
        <div className="sg-checkout">
          <SourceTooltip content={repoTooltip} open={menu?.kind === "folder" ? false : undefined}>
            <button type="button" className="sg-button sg-repo" data-repo-chip={localOnly ? "unbounded" : "bounded"}
              aria-label={repoName} disabled={!repoMenu.length} aria-haspopup="menu"
              aria-expanded={menu?.kind === "folder"} onClick={open("folder")} onContextMenu={open("folder")}>
              <span>{repoName}</span>
            </button>
          </SourceTooltip>
          <SourceTooltip content={branchTooltip} open={menu?.kind === "branch" ? false : undefined}>
            <button type="button" className="sg-button sg-branch"
              aria-label={branch} disabled={!onCopyBranch} aria-haspopup="menu"
              aria-expanded={menu?.kind === "branch"} onClick={open("branch")} onContextMenu={open("branch")}>
              {split ? <span className="sg-branch-split" dir="ltr">
                <span ref={branchHead}>{split.head}</span><span ref={branchTail}>{split.tail}</span>
              </span> : <span ref={branchHead} dir="ltr">{branch}</span>}
            </button>
          </SourceTooltip>
        </div>
        <span className="sg-checkout-spacer" aria-hidden="true" />
      </div>
      {behindShown && <SourceTooltip multiline content={behind.tooltip}>
        <span role="img" aria-label={behind.tooltip} className="sg-behind">
          <Icon name="ArrowDown" size={16} /><span className="sg-behind-count">{behind.count.toLocaleString()}</span>
        </span>
      </SourceTooltip>}
      {counted && (onOpenChanges
        ? <SourceTooltip content={t("View changes")}>
          <SourceSettingsButton variant="secondary" className="sg-diff"
            onMouseDown={(event) => event.preventDefault()} onClick={() => onOpenChanges(status)}>{counts("contents text-body-medium")}</SourceSettingsButton>
        </SourceTooltip>
        : <span className="sg-diff sg-diff-static">{counts("contents")}</span>)}
      {/* git-status-card.js:4985-5020: the pull request split button (a GitHub origin, a committed branch). */}
      {pr && <span className="sg-pr" data-pr-action="">
        <SourceTooltip disabledReason={pr.disabledReason}>
          <SourceSettingsButton variant="secondary" className="sg-action sg-pr-main" disabled={!!pr.disabledReason || pr.busy} busy={pr.busy}
            onMouseDown={(event) => event.preventDefault()} onClick={() => pr.onCreate?.()}>{t("Create PR")}</SourceSettingsButton>
        </SourceTooltip>
        <SourceSettingsButton variant="secondary" className="sg-pr-more" icon="CaretDown" iconSize={12} iconOnly aria-label={t("More pull request options")}
          aria-haspopup="menu" aria-expanded={menu?.kind === "pr"} onMouseDown={(event) => event.preventDefault()} onClick={open("pr")} />
      </span>}
      {!pr && onAction && actionLabel && <SourceTooltip disabledReason={actionDisabled ? actionDisabledReason : undefined}>
        {/* git-status-card.js:1116 `onMouseDown: Mn` (e => e.preventDefault()): a pointer click keeps the composer's focus. */}
        <SourceSettingsButton variant="secondary" className="sg-action" disabled={actionDisabled || busy} busy={busy}
          onMouseDown={(event) => event.preventDefault()} onClick={() => onAction(status)}>{actionLabel}</SourceSettingsButton>
      </SourceTooltip>}
      {onDismiss && <button type="button" className="sg-button sg-dismiss" aria-label={t("Dismiss")}
        onMouseDown={(event) => event.preventDefault()} onClick={() => onDismiss(status)}><Icon name="X" size={16} /></button>}
      {!onDismiss && dismissReserved && <span aria-hidden="true" className="sg-dismiss-reserved" />}
    </div>
    {/* git-chips D/M: Menu.Popup side bottom, align start (menuAlign default "start", 48/83, 109/200). */}
    {menu && <SourceMenu.Popup anchor={menu.anchor} side="bottom" align="start" layer="menu" dataCds="Menu"
      label={menu.kind === "folder" ? t("Repository options") : menu.kind === "pr" ? t("Pull request options") : t("Branch options")} onClose={() => setMenu(null)}>
      {menu.kind === "pr" && pr && <>
        <SourceMenu.Item disabled={!!pr.disabledReason || pr.busy} onClick={() => run(pr.onDraft)}>{t("Create draft PR")}</SourceMenu.Item>
        <SourceMenu.Item disabled={!!pr.manualDisabledReason || !pr.onManual} onClick={() => run(pr.onManual)}>{t("Manually create PR")}</SourceMenu.Item>
      </>}
      {menu.kind === "folder" && repoMenu.map((item) => <React.Fragment key={item.label}>
        {item.separatorBefore && <SourceMenu.Separator />}
        <SourceMenu.Item onClick={repoActions[item.label]}>{t(item.label)}</SourceMenu.Item>
      </React.Fragment>)}
      {menu.kind === "branch" && onCopyBranch && <SourceMenu.Item onClick={() => run(onCopyBranch, branch)}>{t("Copy branch name")}</SourceMenu.Item>}
    </SourceMenu.Popup>}
  </nav>;
}

/** git-status-card 2816-2962 Na (commit mode, no PR): the last rendered row of a
 * revisited session, held until the live query settles. data-prbar-stale,
 * aria-hidden, inert, pointer-events none, opacity-60; plain chips (ja), the
 * counts in an Aa fill-secondary/shadow-field span and the action label in an
 * Aa px-md span of the Commit button's width (Ma). No menus, tooltips or actions. */
export function SourceGitStatusStale({ repoName, branch, localOnly = true, counts = null, actionLabel, heightPx }) {
  return <nav className="sg-status" aria-label={t("Repository and pull request controls")}
    style={Number.isFinite(heightPx) && heightPx > 0 ? { minHeight: heightPx } : undefined}>
    <div className="sg-row sg-row-stale" data-source-component="GitStatusCard" data-prbar-stale="" aria-hidden="true" inert>
      <div className="sg-leading">
        <div className="sg-checkout">
          {repoName && <span className="sg-stale-chip sg-repo" data-repo-chip={localOnly ? "unbounded" : "bounded"}><span>{repoName}</span></span>}
          <span className="sg-stale-chip sg-branch"><span dir="ltr">{branch}</span></span>
        </div>
        <span className="sg-checkout-spacer" />
      </div>
      {counts && <span className="sg-stale-fill sg-diff">
        <span className="sg-added">{`+${counts.added.toLocaleString()}`}</span>
        <span className="sg-removed">{`−${counts.removed.toLocaleString()}`}</span>
      </span>}
      {actionLabel && <span className="sg-stale-fill sg-stale-action">{actionLabel}</span>}
    </div>
  </nav>;
}
