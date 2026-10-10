import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { previewLinksStore } from "./preview-links-model.mjs";
import { Icon } from "./icons";
import { SourceMenu } from "./source-menu";
import { SourceTooltip } from "./source-tooltip";
import { SourceSpinner } from "./source-pane-states.jsx";
import { SourceAnsiText } from "./source-ansi-text.jsx";
import { SourceConfirmationDialog } from "./source-dialog";
import { SourceSettingsButton } from "./source-settings-button.jsx";
import { SourcePaneSketch } from "./source-pane-sketch.jsx";
import {
  ADD_SERVER_PROMPT, COLOR_SCHEMES, anyServerRunning, LOGS_HEIGHT, SHOW_RETRY_MS, boundsOf, clampLogsHeight, failedServer, fixServerPrompt, isOccluded, logTone,
  pageError, pageRefused, pageServer, previewSurface, stoppedServer, sameBounds, serverErrorText, serverRows, serverStatus, showsPage, urlParts, viewportLabel, viewportRows,
} from "./preview-model.mjs";
import { t } from "../electron/i18n/index.mjs";
import "./source-preview-pane.css";

// The Preview pane (2.2553.1 legacy Preview, panes-tile-current.js Xv/vr): a "Servers & settings" menu, the URL
// field, Back / Forward / Attach screenshot / Open in browser / Reload, then the tile's drag handle and controls.
// The page itself is a WebContentsView the main process lays over .spv-viewport (electron/preview-service.cjs):
// this component reports that rectangle on every change, hides the page while something covers it (a menu, a
// dialog, a tooltip) and shows the start page, server states and errors in the DOM when no page is shown. When
// another pane of the session shows the page, main refuses this pane's show (2.2553.1 claimant): the viewport stays
// empty, and the pane asks again 50/250/1000 ms later and whenever its layout changes.

// A page capture (preview-capture bytes) as a PNG data URL with its pixel size.
const captureDataUrl = (bytes) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error(t("Couldn’t capture the page.")));
  reader.readAsDataURL(new Blob([bytes], { type: "image/png" }));
});
const imageSize = (src) => new Promise((resolve) => {
  const image = new Image();
  image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
  image.onerror = () => resolve({ width: 0, height: 0 });
  image.src = src;
});
const SKETCH_SHORTCUT = "cmd+shift+x";

const newInstanceId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);

function GhostButton({ label, icon, shortcut, onClick, disabled = false, className = "", pressed, children, ...rest }) {
  return (
    <SourceTooltip content={label} shortcut={shortcut} side="bottom" hoverable={false}>
      <button type="button" className={`source-icon-button spc-ghost spv-icon ${className}`.trim()} aria-label={label} aria-pressed={pressed} disabled={disabled}
        onMouseDown={(event) => event.preventDefault()} onClick={onClick} {...rest}>
        {children ?? <Icon name={icon} size={16} />}
      </button>
    </SourceTooltip>
  );
}

function UrlField({ url, loading, onNavigate, focusRef }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const input = useRef(null);
  const { host, rest } = urlParts(url);
  useEffect(() => { if (editing) { input.current?.focus(); input.current?.select(); } }, [editing]);
  const start = () => { setDraft(url && url !== "about:blank" ? url : ""); setEditing(true); };
  if (editing) {
    return (
      <div className="spv-url" data-editing="">
        <input ref={input} className="spv-url-input" aria-label={t("Page URL")} placeholder={t("Enter a URL")} value={draft} spellCheck={false} autoCapitalize="off" autoCorrect="off"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setEditing(false); }
            else if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); const value = draft.trim(); setEditing(false); if (value) onNavigate(value); }
          }} />
      </div>
    );
  }
  return (
    <div className="spv-url">
      <button ref={focusRef} type="button" className="spv-url-display" aria-label={host ? t("Page URL: {url}", { url }) : t("Enter a URL")} onClick={start}>
        {loading && <span className="spv-url-spinner"><SourceSpinner size="sm" /></span>}
        {host ? <><span className="spv-url-host">{host}</span><span className="spv-url-rest">{rest}</span></> : <span className="spv-url-placeholder">{t("Enter a URL")}</span>}
      </button>
    </div>
  );
}

function ServersMenu({ state, rows, onStart, onStop, onOpen, logsOpen, onToggleLogs, onViewport, onColorScheme, onDevTools, onScreenshot, onSaveScreenshot, screenshotBusy = false, onExternal, onEditConfig, onAutoVerify, onKeepCookies, onClearData, onOpenFile, onOpenRecent }) {
  const [open, setOpen] = useState(null);
  const trigger = useRef(null);
  const label = t("Servers & settings");
  const linksInPreview = useSyncExternalStore(previewLinksStore.subscribe, previewLinksStore.getSnapshot, previewLinksStore.getSnapshot);
  const running = rows.filter((row) => row.running || row.busy);
  const hasPage = !!state?.hasPage;
  const web = /^https?:/i.test(state?.url ?? "");
  return (
    <>
      <SourceTooltip content={label} side="bottom" hoverable={false} open={open ? false : undefined}>
        <button ref={trigger} type="button" className="source-icon-button spc-ghost spv-icon" aria-label={label} aria-haspopup="menu" aria-expanded={!!open} data-preview-menu=""
          onMouseDown={(event) => event.preventDefault()} onClick={() => setOpen(open ? null : { token: Date.now() })}
          onKeyDown={(event) => { if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp") && !event.metaKey && !event.altKey && !event.ctrlKey) { event.preventDefault(); setOpen({ token: Date.now() }); } }}>
          <Icon name="Globe" size={16} />
        </button>
      </SourceTooltip>
      {open && (
        <SourceMenu.Popup key={open.token} anchor={trigger.current} side="bottom" align="start" label={label} onClose={() => setOpen(null)} className="spv-menu">
          <SourceMenu.Group>
            <SourceMenu.GroupLabel>{t("Servers")}</SourceMenu.GroupLabel>
            {rows.length === 0 && <SourceMenu.Item icon="Cache" disabled>{t("No dev server configured")}</SourceMenu.Item>}
            {rows.map((row) => {
              const status = serverStatus(row);
              return (
                <SourceMenu.Item key={row.name} icon={row.running ? "Stop" : row.busy ? "Cache" : "Play"} description={`${status.label}${row.port ? ` · :${row.port}` : ""}`}
                  disabled={row.busy} variant={row.running ? "danger" : undefined} data-preview-server={row.name}
                  onClick={() => (row.running ? onStop(row.name) : onStart(row.name))}>
                  {row.running ? t("Stop {serverName}", { serverName: row.name }) : t("Run {serverName}", { serverName: row.name })}
                </SourceMenu.Item>
              );
            })}
            {running.filter((row) => row.running && row.url !== state?.url).map((row) => (
              <SourceMenu.Item key={`open-${row.name}`} icon="ArrowOutSquare" onClick={() => onOpen(row.url)}>{t("Open {name}", { name: row.name })}</SourceMenu.Item>
            ))}
            {running.length > 1 && <SourceMenu.Item icon="Stop" variant="danger" onClick={() => running.forEach((row) => onStop(row.name))}>{t("Stop all servers")}</SourceMenu.Item>}
          </SourceMenu.Group>
          {/* 2.2553.1 cv: Files › Open file… (an HTML file of the session folder) and the files this preview showed,
              the one on screen checked. */}
          {onOpenFile && <>
            <SourceMenu.Separator />
            <SourceMenu.Group>
              <SourceMenu.GroupLabel>{t("Files")}</SourceMenu.GroupLabel>
              <SourceMenu.Item icon="FolderOpen" data-preview-open-file="" onClick={onOpenFile}>{t("Open file…")}</SourceMenu.Item>
              {(Array.isArray(state?.recentFiles) ? state.recentFiles : []).map((file) => (
                <SourceMenu.Item key={file.path} icon="File" checked={file.url === state?.url} data-preview-recent-file={file.name}
                  onClick={() => onOpenRecent?.(file.path)}><bdi>{file.name}</bdi></SourceMenu.Item>
              ))}
            </SourceMenu.Group>
          </>}
          <SourceMenu.Separator />
          <SourceMenu.Group>
            <SourceMenu.GroupLabel>{t("Settings")}</SourceMenu.GroupLabel>
            <SourceMenu.Item icon="ListBullet" disabled={!state?.servers?.length} onClick={onToggleLogs}>{logsOpen ? t("Hide dev server logs") : t("Show dev server logs")}</SourceMenu.Item>
            <SourceMenu.Submenu>
              <SourceMenu.SubmenuTrigger icon="MobilePhone" hint={state?.viewport?.preset !== "responsive" ? viewportLabel(state?.viewport) : undefined}>{t("Viewport")}</SourceMenu.SubmenuTrigger>
              <SourceMenu.Popup label={t("Viewport")}>
                {viewportRows(state?.viewport).map((row) => (
                  <SourceMenu.Item key={row.value} checked={row.checked} checkedRole="radio" hint={row.hint} data-viewport-row={row.value}
                    description={row.setByAgent ? t("Set by {assistant}", { assistant: t("DeepSeek") }) : undefined}
                    onClick={() => { if (!row.keep) onViewport(row.value); }}>{row.label}</SourceMenu.Item>
                ))}
              </SourceMenu.Popup>
            </SourceMenu.Submenu>
            <SourceMenu.Submenu>
              <SourceMenu.SubmenuTrigger icon={state?.viewport?.colorScheme === "dark" ? "Moon" : state?.viewport?.colorScheme === "light" ? "Sun" : "Computer"}>{t("Color scheme")}</SourceMenu.SubmenuTrigger>
              <SourceMenu.Popup label={t("Color scheme")}>
                {COLOR_SCHEMES.map((scheme) => (
                  <SourceMenu.Item key={scheme.value} icon={scheme.icon} checked={(state?.viewport?.colorScheme ?? "system") === scheme.value} checkedRole="radio"
                    onClick={() => onColorScheme(scheme.value)}>{t(scheme.label)}</SourceMenu.Item>
                ))}
              </SourceMenu.Popup>
            </SourceMenu.Submenu>
            <SourceMenu.Item icon="Camera" disabled={!hasPage} onClick={onScreenshot}>{t("Attach screenshot")}</SourceMenu.Item>
            {/* 2.2553.1 vn: "Save screenshot" writes the page capture to a file (disabled while annotating). */}
            {onSaveScreenshot && <SourceMenu.Item icon="Download" disabled={!hasPage || screenshotBusy} data-preview-save-screenshot="" onClick={onSaveScreenshot}>{t("Save screenshot")}</SourceMenu.Item>}
            <SourceMenu.Item icon="ArrowOutSquare" disabled={!web} disabledReason={hasPage && !web ? t("This only works for websites.") : undefined} onClick={onExternal}>{t("Open in default browser")}</SourceMenu.Item>
            {/* 'epitaxy-transcript-links-in-preview': a click on a local page's link in a reply or the terminal opens
                here; ⌘-click still goes to the browser (preview-links-model.mjs). */}
            <SourceMenu.Item icon="Globe" checked={linksInPreview} data-preview-links=""
              description={t("Links to pages on this computer, from replies and the terminal. ⌘-click opens the browser.")}
              onClick={() => previewLinksStore.set(!linksInPreview)}>{t("Open links in preview")}</SourceMenu.Item>
            <SourceMenu.Item icon="Code" disabled={!hasPage} onClick={onDevTools}>{state?.devtools ? t("Close developer tools") : t("Open developer tools")}</SourceMenu.Item>
            {/* 2.2553.1 legacy preview (panes-tile-current.js ~9620-9645): plain action rows, each confirmed. "Keep cookies"
                becomes "Clear session data" while they are kept (clearing also stops keeping them); "Enable auto verify" ↔
                "Disable auto verify". */}
            {onKeepCookies && state?.keepCookies !== true && <SourceMenu.Item icon="LockShield" data-preview-keep-cookies=""
              onClick={() => onKeepCookies(true)}>{t("Keep cookies")}</SourceMenu.Item>}
            {onClearData && state?.keepCookies === true && <SourceMenu.Item icon="Trash" data-preview-clear-data="" onClick={onClearData}>{t("Clear session data")}</SourceMenu.Item>}
            {state?.launch?.exists && onAutoVerify && <SourceMenu.Item icon={state.launch.autoVerify !== false ? "EyeSlash" : "CheckCircle"} data-preview-auto-verify=""
              data-enabled={state.launch.autoVerify !== false ? "" : undefined}
              onClick={() => onAutoVerify(state.launch.autoVerify === false)}>{state.launch.autoVerify !== false ? t("Disable auto verify") : t("Enable auto verify")}</SourceMenu.Item>}
            {state?.launch?.exists && <SourceMenu.Item icon="Edit" onClick={onEditConfig}>{t("Edit launch.json")}</SourceMenu.Item>}
          </SourceMenu.Group>
        </SourceMenu.Popup>
      )}
    </>
  );
}

function DownloadNotice({ download, onReveal, onDismiss }) {
  const text = download.state === "completed" ? t("Downloaded {file}", { file: download.file })
    : download.state === "failed" ? t("Couldn’t download {file}", { file: download.file })
      : t("{file} wasn’t downloaded: the preview has to be on screen to ask where to save it.", { file: download.file });
  return (
    <div className="spv-download" role="status" data-preview-download={download.state}>
      <Icon name={download.state === "completed" ? "Download" : "Warning"} size={16} className="spv-download-icon" />
      <span className="spv-download-text"><bdi>{text}</bdi></span>
      {download.state === "completed" && download.canReveal && <button type="button" className="spv-button" data-variant="secondary" onClick={onReveal}>{t("Show in Finder")}</button>}
      <GhostButton label={t("Dismiss")} icon="X" onClick={onDismiss} />
    </div>
  );
}

function StartPage({ state, rows, onStart, onStop, onOpen, onAddServer, onEditConfig, starting, detection = null, onDetect, onUse, onPreviewHtml, agentUsesPreview = true }) {
  const launch = state?.launch;
  if (!launch?.exists) {
    // 2.2553.1 legacy preview: "Detect dev server" reads the project here (no model turn), lists what it finds with a
    // Use button (writes .claude/launch.json and starts it) and "Preview HTML" for a static page; asking the agent
    // stays as the fallback.
    const found = detection?.status === "done" ? detection.result : null;
    return (
      <div className="spv-start" data-preview-start="empty">
        <Icon name="Globe" size={32} className="spv-start-icon" />
        <h2 className="spv-start-title">{t("Preview your app")}</h2>
        <p className="spv-start-body">{agentUsesPreview ? t("Type a URL above, or let DeepSeek set up your dev server. DeepSeek can then open the preview, read it, and click through it to check its work.")
          : t("Type a URL above, or detect your dev server.")}</p>
        {detection?.status === "running" && <p className="spv-start-caption" role="status"><SourceSpinner size="sm" /> {t("Reading your project files. This can take a moment.")}</p>}
        {found && found.candidates.length > 0 && <>
          <p className="spv-start-caption">{t("Dev server detected. This command runs in your shell when the preview starts.")}</p>
          <ul className="spv-servers" aria-label={t("Detected dev servers")}>
            {found.candidates.map((candidate) => (
              <li key={candidate.name} className="spv-server" data-detected-server={candidate.name}>
                <span className="spv-server-main spv-candidate">
                  <Icon name="Cache" size={16} className="spv-server-icon" />
                  <span className="spv-server-name">{[candidate.runtimeExecutable, ...candidate.runtimeArgs].join(" ")}</span>
                  <span className="spv-server-port">:{candidate.port}</span>
                </span>
                <button type="button" className="spv-button" data-size="small" data-variant="primary" disabled={!!starting} onClick={() => onUse?.(candidate)}>{t("Use")}</button>
              </li>
            ))}
          </ul>
        </>}
        {found && !found.candidates.length && <p className="spv-start-caption" role="status">{t("No dev server was found in this project.")}</p>}
        <div className="spv-start-actions">
          {onDetect && !found && detection?.status !== "running" && <button type="button" className="spv-button" data-variant="primary" onClick={onDetect}>{t("Detect dev server")}</button>}
          {found?.htmlEntry && onPreviewHtml && <button type="button" className="spv-button" data-variant="secondary" onClick={() => onPreviewHtml(found.htmlEntry)}>{t("Preview HTML")}</button>}
          {onAddServer && <button type="button" className="spv-button" data-variant={onDetect ? "secondary" : "primary"} onClick={onAddServer}>{onDetect ? t("Ask DeepSeek") : t("Add server")}</button>}
        </div>
      </div>
    );
  }
  return <ServerList launch={launch} rows={rows} starting={starting} onStart={onStart} onStop={onStop} onOpen={onOpen} />;
}

// 2.2553.1 bv / yv (panes-tile-current.js:10172-10365): a bordered rounded list (at most 5 rows until "See all"),
// each row Cache icon · name (truncates) · muted tabular port · an icon-only Play (secondary) / Stop (danger). A
// running server's row is itself the Open button. The two muted captions sit at the bottom of the pane; editing
// .claude/launch.json lives in the Servers & settings menu, not on the caption.
const VISIBLE_SERVERS = 5;
function ServerList({ launch, rows, starting, onStart, onStop, onOpen }) {
  const [all, setAll] = useState(false);
  const firstHidden = useRef(null);
  const focusHidden = useRef(false);
  const showAll = all || rows.some((row, index) => index >= VISIBLE_SERVERS && (row.running || row.busy || row.name === starting));
  const shown = showAll ? rows : rows.slice(0, VISIBLE_SERVERS);
  useEffect(() => { if (showAll && focusHidden.current) { focusHidden.current = false; firstHidden.current?.focus(); } }, [showAll]);
  return (
    <div className="spv-start-servers" data-preview-start="servers">
      <div className="spv-start-servers-inner">
        <div className="spv-start-servers-main">
          <div className="spv-start-column">
            {launch.error && <p className="spv-start-problem" role="alert">{launch.error}</p>}
            {shown.length > 0 && (
              <ul role="list" className="spv-servers" aria-label={t("Servers")}>
                {shown.map((row, index) => {
                  const open = row.running && !!row.port;
                  const label = row.running ? t("Stop {serverName}", { serverName: row.name }) : t("Run {serverName}", { serverName: row.name });
                  const body = <>
                    <Icon name="Cache" size={16} className="spv-server-icon" />
                    <span className="spv-server-name">{row.name}</span>
                    {row.port ? <span className="spv-server-port">:{row.port}</span> : null}
                  </>;
                  return (
                    <li key={row.name} ref={index === VISIBLE_SERVERS ? firstHidden : undefined} tabIndex={-1} className="spv-server" data-status={row.status}
                      data-open={open || undefined} aria-busy={row.name === starting || undefined}>
                      {open
                        ? <button type="button" className="spv-server-main" aria-label={t("Open {name}", { name: row.name })} onClick={() => onOpen(row.url)}>{body}</button>
                        : <span className="spv-server-main">{body}</span>}
                      <SourceSettingsButton size="sm" variant={row.running ? "danger" : "secondary"} icon={row.running ? "Stop" : "Play"} iconSize="auto" iconOnly
                        className="spv-server-action" aria-label={label} busy={row.busy || row.name === starting}
                        disabled={!!starting && row.name !== starting} onMouseDown={(event) => event.preventDefault()}
                        onClick={() => (row.running ? onStop(row.name) : onStart(row.name))} />
                    </li>
                  );
                })}
              </ul>
            )}
            {shown.length < rows.length && (
              <SourceSettingsButton variant="ghost" size="xxs" className="spv-see-all" onMouseDown={(event) => event.preventDefault()}
                onClick={(event) => { focusHidden.current = event.currentTarget === event.currentTarget.ownerDocument.activeElement; setAll(true); }}>{t("See all")}</SourceSettingsButton>
            )}
          </div>
        </div>
        <div className="spv-start-captions">
          <p className="spv-start-caption">{rows.some((row) => row.running) ? t("Open a server to preview your app, or enter a URL.") : t("Run a server to preview your app, or enter a URL.")}</p>
          <p className="spv-start-caption">{t("Edit this list in .claude/launch.json.")}</p>
        </div>
      </div>
    </div>
  );
}

function FailureCard({ server, logs, onRetry, onFix, onCopy, copied }) {
  return (
    <div className="spv-failure" role="alert" data-preview-failure={server.name}>
      <div className="spv-failure-head">
        <Icon name="Warning" size={16} className="spv-failure-icon" />
        <div className="spv-failure-copy">
          <div className="spv-failure-title">{t("Dev server failed to start")}</div>
          <div className="spv-failure-meta">{serverErrorText(server.error, server.name)}</div>
        </div>
        <GhostButton label={copied ? t("Copied") : t("Copy error log")} icon={copied ? "Check" : "Copy"} onClick={onCopy} />
      </div>
      {logs.length > 0 && <pre className="spv-failure-log">{logs.slice(-14).map((line, index) => <div key={index} data-tone={logTone(line) ?? undefined}><SourceAnsiText text={line} /></div>)}</pre>}
      <div className="spv-failure-actions">
        {onFix && <button type="button" className="spv-button" data-variant="secondary" onClick={onFix}>{t("Ask DeepSeek to fix it")}</button>}
        <button type="button" className="spv-button" data-variant="primary" onClick={onRetry}>{t("Try again")}</button>
      </div>
    </div>
  );
}

function LogsDrawer({ name, lines, height, onResize, onClose, paneHeight }) {
  const body = useRef(null);
  const pinned = useRef(true);
  useLayoutEffect(() => { const node = body.current; if (node && pinned.current) node.scrollTop = node.scrollHeight; }, [lines]);
  const drag = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startY = event.clientY, startHeight = height;
    const move = (moveEvent) => onResize(clampLogsHeight(startHeight + (startY - moveEvent.clientY), paneHeight));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <section className="spv-logs" style={{ height }} aria-label={t("Dev server logs")}>
      <div role="separator" aria-orientation="horizontal" aria-label={t("Resize dev server logs")} tabIndex={0} className="spv-logs-handle"
        aria-valuenow={height} aria-valuemin={LOGS_HEIGHT.min} aria-valuemax={Math.round((paneHeight || 0) * LOGS_HEIGHT.maxRatio)}
        onPointerDown={drag}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); onResize(clampLogsHeight(height + (event.key === "ArrowUp" ? 24 : -24), paneHeight)); }
        }} />
      <div className="spv-logs-head">
        <span className="spv-logs-title">{name ? t("Dev server logs · {name}", { name }) : t("Dev server logs")}</span>
        <GhostButton label={t("Close dev server logs")} icon="X" onClick={onClose} />
      </div>
      <div ref={body} className="spv-logs-body" tabIndex={0} onScroll={(event) => { const node = event.currentTarget; pinned.current = node.scrollHeight - node.scrollTop - node.clientHeight < 8; }}>
        {lines.length === 0 ? <div className="spv-logs-empty">{t("Waiting for output…")}</div>
          : lines.map((line, index) => <div key={index} className="spv-log-line" data-tone={logTone(line) ?? undefined}><SourceAnsiText text={line} /></div>)}
      </div>
    </section>
  );
}

/** Whether the session's folder has a dev server running or starting (the titlebar's activity dot). */
export function usePreviewActivity(sessionId, desktop = globalThis.desktop) {
  const [running, setRunning] = useState(false);
  useEffect(() => {
    setRunning(false);
    if (!sessionId || !desktop?.call) return undefined;
    let live = true;
    desktop.call("preview-state", { sessionId }).then((state) => { if (live) setRunning(anyServerRunning(state)); }, () => {});
    const off = desktop.onEvent?.((event) => { if (event?.kind === "preview" && event.sessionId === sessionId && event.state) setRunning(anyServerRunning(event.state)); });
    return () => { live = false; off?.(); };
  }, [sessionId, desktop]);
  return running;
}

/**
 * @param {object} props
 * @param {string} props.sessionId
 * @param {object} [props.desktop]            window.desktop (call / onEvent)
 * @param {React.ReactNode} [props.headerCenter]  the tile's drag handle
 * @param {React.ReactNode} [props.controls]      SourcePaneControls
 * @param {(file: File) => void} [props.onAttachScreenshot]
 * @param {(text: string) => void} [props.onAskAgent]   sends a message to this session
 * @param {(message: string) => void} [props.onError]
 * @param {object} [props.initialState]
 */
export function SourcePreviewPane({ sessionId, desktop = globalThis.desktop, headerCenter = null, controls = null, onAttachScreenshot, onAskAgent, onError, onClose, initialState = null, agentUsesPreview = true }) {
  const instanceId = useRef(newInstanceId()).current;
  // initialState: a snapshot to paint before main answers (server rendering and tests).
  const [state, setState] = useState(initialState);
  const [occlusion, setOcclusion] = useState({ covered: false, image: null });
  const [starting, setStarting] = useState(null);
  const [lastStarted, setLastStarted] = useState(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState({ name: null, lines: [] });
  const [logsHeight, setLogsHeight] = useState(LOGS_HEIGHT.initial);
  const [copied, setCopied] = useState(false);
  const [autoVerify, setAutoVerify] = useState(null); // the confirmation asked: {enabled}
  const [sessionData, setSessionData] = useState(null); // the confirmation asked: {kind: "keep" | "clear"}
  const [detection, setDetection] = useState(null); // "Detect dev server": {status: "running"|"done", result}
  // The page's latest download (preview-service state.download), until dismissed: saved, failed, or not started because
  // the preview wasn't on screen. A download still saving shows nothing (the Save dialog is up).
  const [dismissedDownload, setDismissedDownload] = useState(null);
  const mountedAt = useRef(Date.now());
  const downloadNotice = state?.download && state.download.state !== "saving" && state.download.at !== dismissedDownload && state.download.at >= mountedAt.current
    && (state.download.state !== "cancelled" || state.download.reason === "not-shown") ? state.download : null;
  // Annotate (2.2553.1 mt / bt): {token, backdrop} while sketching; backdrop undefined until the capture arrives.
  const [sketch, setSketch] = useState(null);
  const sketchRef = useRef(null);
  const sketchToken = useRef(0);
  const pane = useRef(null);
  const viewport = useRef(null);
  const skip = useRef(null);
  const urlButton = useRef(null);
  const shortcutRef = useRef(null);
  const sent = useRef({ bounds: null, visible: null });
  // Refused shows (another pane has the page): the bounds refused, how many retries ran, the pending retry.
  const refused = useRef({ bounds: null, count: 0, timer: 0 });
  const call = useCallback((action, params = {}) => (desktop?.call ? desktop.call(action, { sessionId, ...params }) : Promise.reject(new Error(t("Open Code Desktop to use the preview.")))), [desktop, sessionId]);
  // The main process words its refusals in English (preview-service.cjs): shown in the UI language, as terminalError does.
  const report = useCallback((error) => { if (error?.message) onError?.(t(error.message)); }, [onError]);

  // State: the snapshot, then every change main pushes for this session.
  useEffect(() => {
    let live = true;
    call("preview-state").then((next) => { if (live) setState(next); }, report);
    const off = desktop?.onEvent?.((event) => {
      if (event?.sessionId !== sessionId) return;
      if (event.kind === "preview" && event.state) setState(event.state);
      else if (event.kind === "preview-focus-out" && event.instanceId === instanceId) (skip.current ?? urlButton.current)?.focus();
      // A pane chord pressed inside the page (preview-service.cjs previewShortcut): the page never lets the pane see it.
      else if (event.kind === "preview-shortcut" && event.instanceId === instanceId) shortcutRef.current?.(event.action);
    });
    return () => { live = false; off?.(); };
  }, [call, desktop, sessionId, instanceId, report]);

  const rows = useMemo(() => serverRows(state), [state]);
  const surface = previewSurface(state, { starting, lastStarted });
  const failure = surface === "failed" ? failedServer(state, lastStarted) : null;
  const wantsPage = showsPage(surface) && !sketch;
  const pageVisible = wantsPage && !occlusion.covered;

  // Bounds: the viewport rectangle (CSS px; main scales by the window zoom), re-sent whenever it moves.
  const sync = useCallback((force = false) => {
    const node = viewport.current;
    if (!node) return;
    const bounds = boundsOf(node.getBoundingClientRect());
    const visible = wantsPage && !!bounds && bounds.width > 0 && bounds.height > 0 && !document.hidden;
    if (!force && sameBounds(bounds, sent.current.bounds) && visible === sent.current.visible) return;
    if (!force && visible && sameBounds(bounds, refused.current.bounds)) return;
    sent.current = { bounds, visible };
    call("preview-attach", { instanceId, bounds, visible }).then((next) => {
      if (!next) return;
      setState(next);
      const retry = refused.current;
      if (!visible || !pageRefused(next, instanceId)) { retry.bounds = null; retry.count = 0; return; }
      // Refused: the same rectangle is not sent again until a retry is due or the layout changes.
      sent.current = { bounds: null, visible: null };
      retry.bounds = bounds;
      if (retry.timer || retry.count >= SHOW_RETRY_MS.length) return;
      retry.timer = setTimeout(() => { retry.timer = 0; retry.bounds = null; latestSync.current(); }, SHOW_RETRY_MS[retry.count++]);
    }, () => {});
  }, [call, instanceId, wantsPage]);
  const latestSync = useRef(sync);
  latestSync.current = sync;
  useEffect(() => () => { clearTimeout(refused.current.timer); refused.current.timer = 0; }, []);
  useLayoutEffect(() => { sync(true); }, [sync, state?.hasPage, logsOpen, logsHeight]);
  useEffect(() => {
    const node = viewport.current;
    if (!node) return undefined;
    let frame = 0, settle = 0;
    const tick = () => { sync(); if (settle-- > 0) frame = requestAnimationFrame(tick); else frame = 0; };
    // A layout change asks again even after a refusal (2.2553.1 resets the retry budget on resize and tile moves).
    const kick = () => { const retry = refused.current; retry.bounds = null; retry.count = 0; settle = 30; if (!frame) frame = requestAnimationFrame(tick); };
    const resize = new ResizeObserver(kick);
    resize.observe(node);
    window.addEventListener("resize", kick);
    document.addEventListener("visibilitychange", kick);
    kick();
    return () => { cancelAnimationFrame(frame); resize.disconnect(); window.removeEventListener("resize", kick); document.removeEventListener("visibilitychange", kick); };
  }, [sync]);
  // Leaving (pane closed, session switched, window gone): the page moves to the parking window and keeps running.
  useEffect(() => () => { sent.current = { bounds: null, visible: null }; desktop?.call?.("preview-detach", { sessionId, instanceId }).catch?.(() => {}); }, [desktop, sessionId, instanceId]);

  // Overlays: whatever covers the viewport (menus, dialogs, tooltips, a dragged tile) hides the page behind a capture.
  useEffect(() => {
    if (!wantsPage) return undefined;
    let frame = 0, last = 0, timer = 0, current = false;
    const node = viewport.current;
    const check = () => {
      frame = 0;
      if (!node?.isConnected) return;
      const dragging = !!document.querySelector(".tiles-viewport[data-dragging]");
      const covered = dragging || isOccluded(node.getBoundingClientRect(), (x, y) => document.elementFromPoint(x, y), (element) => node.contains(element));
      if (covered === current) return;
      current = covered;
      setOcclusion({ covered, image: null });
      call("preview-occlude", { instanceId, occluded: covered }).then(({ image } = {}) => { if (covered && image) setOcclusion((now) => (now.covered ? { covered: true, image } : now)); }, () => {});
    };
    const schedule = () => {
      if (frame || timer) return;
      const wait = Math.max(0, 60 - (performance.now() - last));
      timer = setTimeout(() => { timer = 0; last = performance.now(); frame = requestAnimationFrame(check); }, wait);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["inert", "data-open", "data-dragging", "hidden", "open", "style"] });
    window.addEventListener("resize", schedule);
    document.addEventListener("scroll", schedule, true);
    schedule();
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame); clearTimeout(timer); window.removeEventListener("resize", schedule); document.removeEventListener("scroll", schedule, true);
      if (current) call("preview-occlude", { instanceId, occluded: false }).catch(() => {});
      setOcclusion({ covered: false, image: null });
    };
  }, [wantsPage, call, instanceId]);

  // Logs: polled while the drawer is open (the server last started, else the first one with output).
  const logsName = lastStarted ?? state?.servers?.[0]?.name ?? null;
  useEffect(() => {
    if (!logsOpen && surface !== "failed") return undefined;
    const name = surface === "failed" ? failure?.name : logsName;
    if (!name) return undefined;
    let live = true, timer = 0;
    const poll = () => call("preview-server-logs", { name, lines: 500 }).then((result) => { if (live) setLogs({ name: result?.name ?? name, lines: result?.lines ?? [] }); }, () => {})
      .finally(() => { if (live && logsOpen) timer = setTimeout(poll, 800); });
    poll();
    return () => { live = false; clearTimeout(timer); };
  }, [logsOpen, logsName, surface, failure?.name, call]);

  const start = useCallback(async (name) => {
    setStarting(name);
    setLastStarted(name);
    try {
      const result = await call("preview-server-start", { name });
      // A failure with a server entry shows the failure card; one without (no such server) is a notice.
      if (!result?.ok && ["no-config", "no-server", "error"].includes(result?.code)) report(new Error(serverErrorText(result, name)));
    } catch (error) { report(error); }
    finally { setStarting(null); }
  }, [call, report]);
  const stop = useCallback((name) => { call("preview-server-stop", { name }).catch(report); }, [call, report]);
  const navigate = useCallback((url) => { call("preview-navigate", { url }).catch(report); }, [call, report]);
  const history = (action) => call("preview-history", { action }).catch(report);
  const attachScreenshot = useCallback(async () => {
    try {
      const shot = await call("preview-capture");
      const bytes = shot?.bytes instanceof Uint8Array ? shot.bytes : new Uint8Array(shot?.bytes ?? []);
      if (!bytes.length) throw new Error(t("Couldn’t capture the page."));
      const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
      onAttachScreenshot?.(new File([bytes], `preview-${stamp}.png`, { type: "image/png" }));
    } catch (error) { report(error); }
  }, [call, onAttachScreenshot, report]);
  const closeSketch = useCallback(() => { sketchToken.current++; setSketch(null); }, []);
  // kt: a second press asks the sketch to close (Discard your annotations? when it has marks).
  const toggleSketch = useCallback(async () => {
    if (sketch) { sketchRef.current?.requestClose(); return; }
    if (!state?.hasPage || !onAttachScreenshot) return;
    const token = ++sketchToken.current;
    setSketch({ token, backdrop: undefined });
    try {
      const shot = await call("preview-capture");
      const bytes = shot?.bytes instanceof Uint8Array ? shot.bytes : new Uint8Array(shot?.bytes ?? []);
      const src = bytes.length ? await captureDataUrl(bytes) : null;
      const size = src ? await imageSize(src) : null;
      if (sketchToken.current === token) setSketch({ token, backdrop: src ? { src, ...size } : null });
    } catch (error) {
      if (sketchToken.current === token) setSketch({ token, backdrop: null });
      report(error);
    }
  }, [sketch, state?.hasPage, onAttachScreenshot, call, report]);
  useEffect(() => { if (sketch && !state?.hasPage) closeSketch(); }, [sketch, state?.hasPage, closeSketch]);
  // Chords from inside the page: ⇧⌘X Annotate, ⌘W close the preview, ⌘L the address field.
  shortcutRef.current = (action) => {
    if (action === "sketch") void toggleSketch();
    else if (action === "close") onClose?.();
    else if (action === "address") (urlButton.current ?? skip.current)?.focus();
  };
  // Pt: the annotated (or plain) capture goes to the composer and the sketch closes.
  const attachSketch = useCallback((file) => { onAttachScreenshot?.(file); closeSketch(); }, [onAttachScreenshot, closeSketch]);
  const saveScreenshot = useCallback(async () => {
    try {
      const shot = await call("preview-capture");
      const bytes = shot?.bytes instanceof Uint8Array ? shot.bytes : new Uint8Array(shot?.bytes ?? []);
      if (!bytes.length) throw new Error(t("Couldn’t capture the page."));
      const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
      await call("image:save", { dataUrl: await captureDataUrl(bytes), name: `preview-${stamp}.png` });
    } catch (error) { report(error); }
  }, [call, report]);

  const copyLog = useCallback(async () => {
    const text = [failure ? `${failure.name}: ${failure.error?.message ?? ""}` : "", ...logs.lines].filter(Boolean).join("\n");
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch (error) { report(error); }
  }, [failure, logs.lines, report]);

  const error = surface === "error" ? pageError(state) : null;
  const stopped = surface === "stopped" ? stoppedServer(state) : null;
  // A connection-refused page whose address is one of this folder's servers that isn't running.
  const refusedServer = (() => {
    if (!error || !/CONNECTION_REFUSED|ERR_CONNECTION_RESET|ADDRESS_UNREACHABLE/.test(state?.error?.description ?? "")) return null;
    const server = pageServer(state, { configs: true });
    return server && server.status !== "running" && server.status !== "starting" && server.status !== "stopping" ? server : null;
  })();
  const paneHeight = pane.current?.clientHeight ?? 0;
  return (
    <aside ref={pane} className="source-file-panel detail-panel spv-pane" aria-label={t("Preview")} data-preview-surface={surface} data-sketching={sketch ? "" : undefined}
      onKeyDown={(event) => {
        // toggleSketchMode (⇧⌘X) while focus is in this pane.
        if (event.code === "KeyX" && event.shiftKey && (event.metaKey || event.ctrlKey) && !event.altKey && !event.nativeEvent.isComposing) { event.preventDefault(); toggleSketch(); }
      }}>
      <header className="source-pane-header spv-header" data-pane-header="preview">
        <ServersMenu state={state} rows={rows} onStart={start} onStop={stop} onOpen={navigate} logsOpen={logsOpen} onToggleLogs={() => setLogsOpen((value) => !value)}
          onViewport={(preset) => call("preview-emulate", { preset }).catch(report)} onColorScheme={(colorScheme) => call("preview-emulate", { colorScheme }).catch(report)}
          onDevTools={() => call("preview-devtools").catch(report)} onScreenshot={attachScreenshot} onSaveScreenshot={desktop?.call ? saveScreenshot : null} screenshotBusy={!!sketch} onExternal={() => call("preview-external").catch(report)}
          onEditConfig={() => call("preview-reveal-config").catch(report)} onAutoVerify={agentUsesPreview ? (enabled) => setAutoVerify({ enabled }) : null}
          onKeepCookies={(enabled) => { if (enabled) setSessionData({ kind: "keep" }); else call("preview-keep-cookies", { enabled: false }).then((next) => { if (next) setState(next); }, report); }}
          onClearData={() => setSessionData({ kind: "clear" })}
          onOpenFile={() => call("preview-open-file").then((result) => { if (result && !result.canceled && result.ok === false) report(new Error(result.description || t("The page didn’t load."))); }, report)}
          onOpenRecent={(file) => call("preview-open-recent", { path: file }).catch(report)} />
        <UrlField url={state?.url ?? ""} loading={!!state?.loading} onNavigate={navigate} focusRef={urlButton} />
        <div className="spv-nav" role="group" aria-label={t("Navigation")}>
          <GhostButton label={t("Go back")} icon="CaretLeft" disabled={!state?.canGoBack} onClick={() => history("back")} />
          <GhostButton label={t("Go forward")} icon="CaretRight" disabled={!state?.canGoForward} onClick={() => history("forward")} className="spv-narrow-hide" />
          <GhostButton label={t("Attach screenshot")} icon="Camera" disabled={!state?.hasPage || !onAttachScreenshot} onClick={attachScreenshot} className="spv-narrow-hide" data-preview-screenshot="" />
          {/* 2.2553.1 dr: Annotate (Edit, toggleSketchMode), pressed while sketching. */}
          <GhostButton label={t("Annotate")} icon="Edit" shortcut={SKETCH_SHORTCUT} pressed={!!sketch} disabled={(!state?.hasPage && !sketch) || !onAttachScreenshot} onClick={toggleSketch} data-preview-annotate="" />
          <GhostButton label={t("Open in default browser")} icon="ArrowOutSquare" disabled={!/^https?:/i.test(state?.url ?? "")} onClick={() => call("preview-external").catch(report)} className="spv-narrow-hide" />
          {state?.loading
            ? <GhostButton label={t("Stop loading")} icon="X" onClick={() => history("stop")} />
            : <GhostButton label={t("Reload")} icon="ArrowClockwise" disabled={!state?.hasPage} onClick={() => history("reload")} />}
        </div>
        {headerCenter}
        {controls}
      </header>
      <div className="spv-body">
        <div ref={viewport} className="spv-viewport" data-page={pageVisible || undefined} data-covered={occlusion.covered || undefined}>
          {wantsPage && (
            <button ref={skip} type="button" className="spv-skip" onClick={() => call("preview-focus").catch(() => {})}>
              {t("Preview page — press Enter to move into it. Inside, press F6 or Ctrl+F6 to move back out.")}
            </button>
          )}
          {wantsPage && occlusion.covered && occlusion.image && <img className="spv-capture" src={occlusion.image} alt="" draggable={false} />}
          {state?.viewport?.preset && state.viewport.preset !== "responsive" && wantsPage && <span className="spv-viewport-badge" aria-hidden="true">{viewportLabel(state.viewport)}</span>}
          {sketch && <SourcePaneSketch key={sketch.token} ref={sketchRef} backdrop={sketch.backdrop} onCancel={closeSketch} onAttach={attachSketch} onError={(message) => onError?.(message)} />}
          {surface === "loading" && <div className="spv-center" role="status" aria-label={t("Loading preview")}><SourceSpinner size="lg" delay={400} /></div>}
          {surface === "start" && <StartPage state={state} rows={rows} starting={starting} onStart={start} onStop={stop} onOpen={navigate} agentUsesPreview={agentUsesPreview}
            onAddServer={onAskAgent ? () => onAskAgent(ADD_SERVER_PROMPT) : null} onEditConfig={() => call("preview-reveal-config").catch(report)}
            detection={detection}
            onDetect={() => { setDetection({ status: "running" }); call("preview-detect").then((result) => setDetection({ status: "done", result: { candidates: Array.isArray(result?.candidates) ? result.candidates : [], htmlEntry: result?.htmlEntry ?? null } }), (failure) => { setDetection(null); report(failure); }); }}
            onUse={(candidate) => { setStarting(candidate.name); call("preview-use-server", { candidate }).then((outcome) => { setStarting(null); setDetection(null); if (outcome && outcome.ok === false) report(new Error(outcome.message)); }, (failure) => { setStarting(null); report(failure); }); }}
            onPreviewHtml={(file) => navigate(file)} />}
          {/* bv: a server starting is a centred lg spinner with an sr-only "Starting server". */}
          {surface === "starting" && <div className="spv-center" role="status" data-preview-starting={starting}><SourceSpinner size="lg" /><span className="source-sr-only">{t("Starting server")}</span></div>}
          {surface === "failed" && failure && <FailureCard server={failure} logs={logs.name === failure.name ? logs.lines : []} copied={copied} onCopy={copyLog}
            onRetry={() => start(failure.name)} onFix={onAskAgent ? () => onAskAgent(fixServerPrompt(failure.name, failure.error, logs.lines)) : null} />}
          {/* 2.2553.1 Xv pv: the dev server the page came from stopped; Restart starts it again and reopens the page. */}
          {surface === "stopped" && stopped && (
            <div className="spv-center spv-error" role="status" data-preview-stopped={stopped.name}>
              <Icon name="Stop" size={20} className="spv-stopped-icon" />
              <div className="spv-error-title">{t("Stopped")}</div>
              <div className="spv-error-body">{t("The dev server stopped. Restart it, or close the preview.")}</div>
              <button type="button" className="spv-button" data-variant="primary" onClick={() => start(stopped.name)}>{t("Restart")}</button>
            </div>
          )}
          {surface === "error" && error && (
            <div className="spv-center spv-error" role="alert">
              <Icon name="Warning" size={20} className="spv-error-icon" />
              <div className="spv-error-title">{error.title}</div>
              {error.body && <div className="spv-error-body">{error.body}</div>}
              <div className="spv-error-actions">
                {/* Nothing answering at a launch.json server's address: start that server again from here. */}
                {refusedServer && <button type="button" className="spv-button" data-variant="primary" data-preview-restart={refusedServer.name} onClick={() => start(refusedServer.name)}>{t("Restart {serverName}", { serverName: refusedServer.name })}</button>}
                <button type="button" className="spv-button" data-variant="secondary" onClick={() => history("reload")}>{t("Reload")}</button>
              </div>
            </div>
          )}
        </div>
        {downloadNotice && <DownloadNotice download={downloadNotice} onReveal={() => call("preview-download-reveal").catch(report)} onDismiss={() => setDismissedDownload(downloadNotice.at)} />}
        {logsOpen && <LogsDrawer name={logs.name} lines={logs.lines} height={logsHeight} paneHeight={paneHeight} onResize={setLogsHeight} onClose={() => setLogsOpen(false)} />}
      </div>
      {sessionData && <SourceConfirmationDialog
        title={sessionData.kind === "keep" ? t("Keep cookies") : t("Clear session data")}
        body={sessionData.kind === "keep"
          ? t("Session data such as cookies and local storage will be saved across server restarts and app launches, and shared by the previews of every session.")
          : t("This will delete all saved cookies, local storage, and other session data for previews in all workspaces.")}
        confirmLabel={sessionData.kind === "keep" ? t("Keep cookies") : t("Clear session data")} confirmVariant={sessionData.kind === "clear" ? "danger" : "primary"}
        onCancel={() => setSessionData(null)}
        onConfirm={() => {
          const kind = sessionData.kind;
          setSessionData(null);
          // Clearing also stops keeping cookies, so the menu offers "Keep cookies" again (the official single row).
          const done = kind === "keep" ? call("preview-keep-cookies", { enabled: true }) : call("preview-clear-data").then(() => call("preview-keep-cookies", { enabled: false }));
          done.then((next) => { if (next) setState(next); }, report);
        }} />}
      {/* 2.2553.1 U_: Enable/Disable auto verify, saved in .claude/launch.json for the project. */}
      {autoVerify && <SourceConfirmationDialog
        title={autoVerify.enabled ? t("Enable auto verify") : t("Disable auto verify")}
        body={autoVerify.enabled
          ? t("After editing code, {assistant} will start the preview server, check its changes and share proof before it finishes its response. This setting is saved in .claude/launch.json for this project.", { assistant: t("DeepSeek") })
          : t("{assistant} will no longer check its changes in the preview on its own. You can still ask it to. This setting is saved in .claude/launch.json for this project.", { assistant: t("DeepSeek") })}
        confirmLabel={autoVerify.enabled ? t("Enable") : t("Disable")}
        onCancel={() => setAutoVerify(null)}
        onConfirm={() => { const enabled = autoVerify.enabled; setAutoVerify(null); call("preview-auto-verify", { enabled }).then((next) => { if (next) setState(next); }, report); }} />}
    </aside>
  );
}
