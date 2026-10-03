import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { bindCustomizeScroll } from './customize-scroll.mjs';
import { pluginDetailTabs, pluginDetailView } from './plugin-detail-model.mjs';
import { Icon } from "./icons";
import { SourceSkillFile } from './source-skill-file.jsx';
import { SourceSwitch as Switch } from './source-switch.jsx';
import { SourceSettingsButton as Button } from './source-settings-button.jsx';
import { SourceTooltip } from './source-tooltip.jsx';
import { SourceMenu, menuTriggerProps } from './source-menu.jsx';
import { SourceSegments } from './source-segments.jsx';
import { SourcePictogram } from './source-pictogram.jsx';
import { SourceDisclosure } from './source-disclosure.jsx';
import { SourceConfirmationDialog } from './source-dialog.jsx';
import { useSourceToasts } from './source-toast.jsx';
import {
  CONNECTOR_TOASTS, MCP_CLIENT_PACKAGE, MCP_STATUS_FILTERS, MCP_STATUS_LABELS, connectorDetailMessage, connectorDetailState, connectorsListView, customizeCore,
  filterErrors, filterMcp, filterMcpByStatus, filterPlugins, filterSkills, mcpServerConfigValue, pluginChangeOutcome, pluginDisplayNames, pluginInstallStatus,
  shortDate, skillAuthor, skillGroupOptions, skillInvocable, skillTrigger, splitArguments, validateServerName,
} from "./customize-model.mjs";
import "./source-customize.css";

// 2.2553.1 "Customize" settings group (shared-22 hS): Skills / Connectors /
// Plugins pages over the local Codex catalog. Page shell = title + search +
// actions (customize-page-shell U), optional owner segments (De, only with
// >= 2 groups), a fixed-layout CDS table (q over c51c45b79 Table primitives)
// inside the horizontal scroller (Y), and the official empty states. Cloud
// features (upload, security scan, Directory/Browse, remote install, cloud
// "last updated") have no Codex backend and are not drawn. Copy, skill
// roots and the skill/connector write controls follow the running core
// (customize-model customizeCore over boot.core).

function useStore(store) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

function useCatalogNavigation(focus, selectionKey) {
  const [query,setQuery]=useState(focus?.searchSeed||'');
  const [selected,setSelected]=useState(focus?.[selectionKey]||null);
  useEffect(()=>{setQuery(focus?.searchSeed||'');setSelected(focus?.[selectionKey]||null);},[focus,selectionKey]);
  return {query,setQuery,selected,setSelected};
}

// Official CDS SearchInput (ccefd43d9 x / c13348442 t) defaults to
// collapsible: a ghost icon-only Search button that expands into a
// role="search" wrapper (classic pageLayout=false: w-48 = 192px) holding <input type="search"> with a
// Search slotStart and a "Clear search" button. Escape clears first, then
// collapses; blurring an empty field collapses it again.
function PageSearch({ label, value, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const button = useRef(null);
  const input = useRef(null);
  const returnFocus = useRef(false);
  useLayoutEffect(() => {
    if (returnFocus.current && !expanded && !value) { returnFocus.current = false; button.current?.focus(); }
  }, [expanded, value]);
  const collapse = () => { returnFocus.current = true; setExpanded(false); };
  if (!expanded && value.length === 0) {
    return (
      <button ref={button} type="button" className="cz-search-toggle" data-cds="Button" data-variant="ghost"
        aria-label={label} aria-expanded="false" onClick={() => setExpanded(true)}><Icon name="Search" size={20} /></button>
    );
  }
  return (
    <div className="cz-search" data-cds="TextInput" data-clearable={value !== "" || undefined} role="search" onMouseDown={event => {
      // shared-frame gd: focus on the field chrome, preserving native input,
      // clear-button and non-primary mouse behavior.
      if (event.button !== 0) return;
      const control = event.target.closest?.('input,button,a[href],label,select,textarea,[role="button"],[contenteditable]:not([contenteditable="false"]),[tabindex]:not([tabindex="-1"])');
      if (control && event.currentTarget.contains(control)) return;
      event.preventDefault(); input.current?.focus();
    }}>
      <Icon name="Search" size={16} aria-hidden="true" />
      <input ref={input} type="search" autoFocus autoComplete="off" aria-label={label} placeholder={label} value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setExpanded(true)}
        onBlur={() => { if (!value) setExpanded(false); }}
        onKeyDown={(event) => {
          // ccefd43d9 x: while the collapsible field is open Escape always
          // stops there — it clears the query and collapses, it does not
          // close the dialog behind it.
          if (event.key !== "Escape") return;
          if (event.nativeEvent.isComposing) { event.stopPropagation(); return; }
          event.preventDefault();
          event.stopPropagation();
          if (value) onChange("");
          collapse();
        }} />
      {value !== "" && (
        <span className="cz-search-end" data-cds-end-slot=""><button type="button" className="cz-search-clear" data-cds="Button" data-cds-ghost="" aria-label="Clear search"
          onMouseDown={event => event.preventDefault()}
          onClick={() => { onChange(""); setExpanded(true); input.current?.focus(); }}><Icon name="X" size={20} /></button></span>
      )}
    </div>
  );
}

function PageHeader({ title, searchLabel, searchValue, onSearch, actions }) {
  return (
    <header className="cz-header">
      <h2 className="cz-title text-heading-medium">{title}</h2>
      <div className="cz-header-controls"><PageSearch label={searchLabel} value={searchValue} onChange={onSearch} />
        {actions && <div className="cz-actions">{actions}</div>}</div>
    </header>
  );
}

function PageBody({ children, memory, scrollKey = 'list' }) {
  const root = useRef(null);
  useLayoutEffect(() => memory ? bindCustomizeScroll(root.current, memory, scrollKey) : undefined, [memory, scrollKey]);
  return <div ref={root} className="cz-page-body scroll-fade-y scroll-fade-size-6">{children}</div>;
}

// Uncontained SegmentedControl filters (page shell De :628-655 "Filter by owner",
// customize-connectors :3580-3600 "Filter by status"): size A() = shared-20 Za →
// "sm" in the classic dialog, self-start.
function FilterSegments({ label, value, options, onChange, className = "self-start" }) {
  return <SourceSegments label={label} value={value} options={options} onChange={onChange} variant="uncontained" size={DIALOG_BUTTON_SIZE} className={className} />;
}

// `flush` drops q's mt-sm: the connectors table sits in its own gap-sm block
// right under the status filter (customize-connectors :3582-3600, ln without mt-sm).
function ListTable({ columns, children, label, flush = false }) {
  return (
    <div className="cz-scroller">
      <table className={flush ? "cz-table cz-table-flush" : "cz-table"} data-cds="Table" aria-label={label}>
        <thead>
          <tr>
            {columns.map((column) => <th key={column.key} scope="col" className={column.width ? `cz-col-${column.width}` : undefined}>{column.header}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

// Official row (customize-page-shell G, :525-548): both the click and the
// Enter/Space handler ignore events that started inside a nested control, so
// buttons rendered in a cell keep their own activation.
const ROW_CLICK_SKIP = "button, a, [role='menu'], [role='menuitem'], [data-cds='SplitDropdownButton']";
const ROW_KEY_SKIP = "button, a, [role='menu'], [role='menuitem']";

function rowActivates(event, selector) {
  const target = event.target;
  if (!(target instanceof Element)) return true;
  return !target.closest(selector) && event.currentTarget.contains(target);
}

// G :555 names the row "View {name}" (focus-visible:shadow-focus, outline-none).
function Row({ id, name, selected, onSelect, children, ...rest }) {
  return (
    <tr data-hoverable="" data-clickable="" tabIndex={0} aria-selected={selected || undefined} data-selected={selected ? "true" : undefined}
      data-row-id={id} aria-label={`View ${name}`}
      onClick={(event) => { if (rowActivates(event, ROW_CLICK_SKIP)) onSelect(event); }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        if (!rowActivates(event, ROW_KEY_SKIP)) return;
        event.preventDefault();
        onSelect(event);
      }} {...rest}>
      {children}
    </tr>
  );
}

function Badge({ children, variant = "default" }) {
  return <span className="cz-badge" data-variant={variant} data-size="xs">{children}</span>;
}

function Dash() {
  return <span aria-hidden="true">—</span>;
}

// Page shell Ee (customize-page-shell-current.js:566-612). A search with no
// match is the plain p (searchActions are null on every local page); otherwise
// a flex-1 column centred in the page body: CDS pictogram, max-w-xs secondary
// copy, then the page's actions.
function EmptyState({ searchValue = "", noMatchMessage, emptyMessage, pictogram, actions }) {
  if (searchValue) return <p className="cz-empty-search py-lg text-center text-body text-secondary">{noMatchMessage}</p>;
  return (
    <div className="cz-empty flex flex-1 flex-col items-center justify-center gap-lg py-lg text-center" data-cz-empty="">
      {pictogram && <SourcePictogram name={pictogram} />}
      <p className="max-w-xs text-pretty text-body text-secondary">{emptyMessage}</p>
      {actions}
    </div>
  );
}

// _r / shared-13 Jk bordered connector tile: size×size, radius size*.27,
// surface-3, 0.5px --cds-border, shadow-sm. Local MCP servers carry no icon,
// so the tile holds the Connectors glyph at imageSize (24/16 in rows and
// headers, 56/40 in the not-connected drill).
function ConnectorTile({ size = 24 }) {
  const large = size === 56;
  return <span aria-hidden="true" className={large ? "cz-connector-tile cz-connector-tile-lg" : "cz-connector-tile"}><Icon name="Connectors" size={large ? 40 : 16} /></span>;
}

// Ghost icon-only DotsVertical trigger plus its SourceMenu (cfaabd194 ct /
// c08e79e85 Sn: tooltip false, Popup align end). Customize lives in the
// Settings dialog, so the menu takes the page's --cds-layer-base. Without
// items ct disables its trigger (`disabled: !b || !De`) and Sn renders nothing.
function MoreMenu({ label, size, items, className, hideWhenEmpty = false }) {
  const trigger = useRef(null);
  const [menu, setMenu] = useState(null);
  if (!items.length && hideWhenEmpty) return null;
  const open = (entry) => setMenu({ entry, layerBase: Number.parseInt(getComputedStyle(trigger.current).getPropertyValue("--cds-layer-base"), 10) || 0 });
  return <>
    <Button ref={trigger} variant="ghost" size={size} iconOnly icon="DotsVertical" iconSize="auto" aria-label={label} className={className} disabled={!items.length}
      {...menuTriggerProps({ open: !!menu, disabled: !items.length, onOpen: (entry) => open(entry) })}
      onClick={() => (menu ? setMenu(null) : open(undefined))} />
    {menu && <SourceMenu.Popup anchor={trigger.current} side="bottom" align="end" label={label} initialHighlight={menu.entry}
      layerBase={menu.layerBase} onClose={() => setMenu(null)}>
      {items.map((item) => <SourceMenu.Item key={item.label} icon={item.icon} variant={item.variant} disabled={item.disabled} onClick={item.onClick}>{item.label}</SourceMenu.Item>)}
    </SourceMenu.Popup>}
  </>;
}

// AS (shared-frame :13915-13960) InfoTip: a muted Info sm button labelled
// "More info" that opens the content on hover after 300ms, side top, offset 6.
// Locally the popover is the CDS tooltip.
function InfoTip({ content }) {
  return <SourceTooltip content={content} side="top" sideOffset={6} delay={300} multiline>
    <button type="button" data-cds="InfoTip" aria-label="More info" className="cz-infotip"><Icon name="Info" size={16} /></button>
  </SourceTooltip>;
}

// Catalog loading skeleton (2.2553.1 readable/shared-22-Cz3C_T8d.js). Every
// class string is the source string; each utility exists in the loaded
// original /assets/v1/c6a992d55-Vcbdv79k.css.
// TC/OC/kC/AC :3389-3396 → row bar widths (128/160/112/144/96/128px), header
// cell, h-7 + py-sm row cell with an alpha-1 rule, and the 3 column boxes.
export const SKELETON_WIDTHS = ["w-32", "w-40", "w-28", "w-36", "w-24", "w-32"];
const SKELETON_HEADER_CELL = "flex h-control items-center px-md";
const SKELETON_ROW_CELL = "box-content flex h-7 items-center gap-sm border-b border-alpha-1 px-md py-sm";
const SKELETON_COLUMNS = ["min-w-0 flex-1", "w-40 shrink-0", "w-40 shrink-0"];
// K = shared-frame gc (:3448-3480, exported as wc) outside a SkeletonGroup:
// role=status, shimmer ::after and an sr-only "Loading". X is tailwind-merge,
// so a caller's size-6 / h-control replaces the default h-[1em].
const SKELETON_BAR = "max-w-full overflow-hidden rounded bg-[var(--cds-skeleton-base)] after:absolute after:inset-0 after:animate-[cds-shimmer_2s_linear_infinite] after:bg-[linear-gradient(90deg,transparent,var(--cds-skeleton-sheen),transparent)] motion-reduce:after:hidden";
// gc also takes width/height as inline style; a caller's rounded-* replaces
// the default `rounded` (tailwind-merge).
function SkeletonBar({ className = "", width, height }) {
  const sized = /(^|\s)(size-|h-)/.test(className);
  const base = /(^|\s)rounded-/.test(className) ? SKELETON_BAR.replace(" rounded ", " ") : SKELETON_BAR;
  const style = width !== undefined || height !== undefined ? { width, height } : undefined;
  return <div data-cds="Skeleton" role="status" className={`relative ${sized ? "" : "h-[1em] "}${base} ${className}`.trim()} style={style}><span className="sr-only">Loading</span></div>;
}
// Q :2880-2885: a line-height box centring a 1em bar at the given text size.
const SkeletonLine = ({ className, width }) => <div className={`flex h-lh max-w-full items-center ${className}`}><SkeletonBar className={width} /></div>;
// jC :3397-3458 (flush=false: Dp is the page-layout breakpoint, false in the
// classic settings dialog).
function CatalogRowsSkeleton({ count = SKELETON_WIDTHS.length, leadingIcon = false, className = "" }) {
  const widths = Array.from({ length: count }, (_, index) => SKELETON_WIDTHS[index % SKELETON_WIDTHS.length]);
  return <div className={`-mx-pad-lg shrink-0 overflow-hidden px-lg [scrollbar-gutter:stable]${className ? ` ${className}` : ""}`}>
    <div className="flex">{SKELETON_COLUMNS.map((column, index) => <div key={index} className={`${SKELETON_HEADER_CELL} ${column}`}>
      <SkeletonLine className="text-footnote" width={index === 0 ? "w-16" : "w-8"} /></div>)}</div>
    {widths.map((width, row) => <div key={row} className="flex">{SKELETON_COLUMNS.map((column, index) => <div key={index} className={column}>
      <div className={row === 0 ? `${SKELETON_ROW_CELL} border-t` : SKELETON_ROW_CELL}>
        {index === 0 && leadingIcon && <SkeletonBar className="size-6 shrink-0" />}
        <SkeletonLine className="min-w-0 flex-1 text-body" width={index === 0 ? width : index === 1 ? "w-8" : "w-16"} />
      </div></div>)}</div>)}
  </div>;
}
// Loading body of the Customize panel skeleton FC (:3574-3650): an sr-only
// role=status "Loading" (:3620-3628) beside an aria-hidden body. Connectors use
// MC (:3459-3480: data-testid connectors-rows-skeleton, pt-sm, VS w-63 search
// stand-in at :2886-2893, rows with leadingIcon); skills and plugins use
// jC {className:"mt-sm"} without the icon slot (:3876-3881). The real page
// header stays drawn above it, so FC's toolbar stand-ins are not repeated.
export function CatalogSkeleton({ section }) {
  return <>
    <span role="status" className="sr-only">Loading</span>
    <div aria-hidden="true" className="flex flex-col" data-cz-skeleton={section}>
      {section === "connectors"
        ? <div className="flex flex-col gap-sm pt-sm" data-testid="connectors-rows-skeleton">
            <div className="shrink-0 self-start"><div className="shrink-0 w-63"><SkeletonBar className="h-control w-full" /></div></div>
            <div aria-hidden="true" className="flex flex-col"><CatalogRowsSkeleton leadingIcon /></div>
          </div>
        : <CatalogRowsSkeleton className="mt-sm" />}
    </div>
  </>;
}

// shared-20 Lf (exported as Za, tmp-shared-20-BrTrXIRV.js:2013):
// `Ff() ? void 0 : "sm"` — page-shell/skill buttons are "sm" unless the
// Customize surface is a pageLayout page. Locally Customize lives in the
// classic settings dialog (pageLayout=false), so Za resolves to "sm".
const DIALOG_BUTTON_SIZE = "sm";

// Catalog load failure. Connectors = so() (customize-connectors-current.js
// :3830-3848, chosen by :3136-3147 G "error"): muted body copy and a secondary
// "Try again". Skills = Ti {missing:"all"} (customize-skills-current.js
// :2380-2396) → c27f32a39 Ie non-partial: role=status data-testid
// skills-tabbed-list-error, secondary busy "Retry" at size:a (a = A() =
// shared-20 Za = Lf, tmp-shared-20:2013 → "sm" outside pageLayout, which the
// classic dialog is; see PageSearch); its ObjectMagnifier
// pictogram (shared-7 tV) is not drawn locally (pictograms are deferred).
// Plugins: the classic plugins page has no load-failure branch; so() is reused
// with the source catalog copy "Couldn’t load plugins." (cb2367241
// catalogLoadFailed / c84e37421). The raw backend message goes to console only.
export function CatalogLoadError({ section, onRetry, busy = false }) {
  if (section === "skills") return <div role="status" data-testid="skills-tabbed-list-error" className="flex flex-1 flex-col items-center justify-center gap-lg px-md py-xl text-center cz-load-error">
    <p className="max-w-xs text-pretty text-body text-secondary">Couldn’t load your skills.</p>
    <Button variant="secondary" size={DIALOG_BUTTON_SIZE} busy={busy} onClick={onRetry}>Retry</Button>
  </div>;
  return <div className="flex h-full flex-col items-center justify-center gap-md p-lg text-center cz-load-error">
    <p className="text-body text-muted">{section === "plugins" ? "Couldn’t load plugins." : "Couldn’t load connectors"}</p>
    <Button variant="secondary" onClick={onRetry}>Try again</Button>
  </div>;
}

// Only the copy above reaches the DOM; each distinct backend failure is logged once.
function useLoadFailureLog(section, status, error) {
  const last = useRef("");
  useEffect(() => {
    if (status !== "error") { last.current = ""; return; }
    if (last.current === error) return;
    last.current = error;
    console.warn(`[customize] ${section} catalog failed to load: ${error || "unknown error"}`);
  }, [section, status, error]);
}

// c9d36aa51 plugin-page skeleton (c36b3644c be: shown while plugin/read has no
// result): a 200×24 title bar with a 40×20 pill and a 32×32 square, a 2-column
// grid of 60/100×14 bars, a 100×14 bar over a full-width 40px block, then a
// 120×18 bar over four 100×32 pills. Only the title bar is announced.
export function PluginPageSkeleton() {
  return <div data-testid="plugin-page-skeleton" className="flex h-full flex-col">
    <div className="flex items-center justify-between px-6 py-3">
      <SkeletonBar width={200} height={24} />
      <div aria-hidden="true" className="flex items-center gap-3">
        <SkeletonBar width={40} height={20} className="rounded-full" />
        <SkeletonBar width={32} height={32} />
      </div>
    </div>
    <div aria-hidden="true" className="grid grid-cols-2 gap-4 px-6 py-3">
      {[0, 1].map((index) => <div key={index} className="flex flex-col gap-1"><SkeletonBar width={60} height={14} /><SkeletonBar width={100} height={14} /></div>)}
    </div>
    <div aria-hidden="true" className="flex flex-col gap-2 px-6 py-4">
      <SkeletonBar width={100} height={14} />
      <SkeletonBar height={40} className="w-full" />
    </div>
    <div aria-hidden="true" className="flex flex-col gap-3 px-6 py-4">
      <SkeletonBar width={120} height={18} />
      <div className="flex flex-wrap gap-2.5">{[0, 1, 2, 3].map((index) => <SkeletonBar key={index} width={100} height={32} className="rounded-full" />)}</div>
    </div>
  </div>;
}

// ---------------------------------------------------------------------------
// Skills

const SKILL_COLUMNS = [
  { key: "name", header: "Skill" },
  { key: "updated", header: "Last updated", width: "32" },
  { key: "author", header: "Author", width: "40" },
];

// Skill detail = the official page-shell drill-in (customize-skills
// :2822-2852 -> W :432-517): the list is replaced, the header becomes a ghost
// ArrowLeft button labelled "Skills", and the body is the skill header plus
// the SKILL.md file view (customize-skill-detail :276, :136-176).
function useSkillFile(callRef, path) {
  const [state, setState] = useState({ path, status: "loading", content: null });
  useEffect(() => {
    if (!path) return undefined;
    let live = true;
    setState({ path, status: "loading", content: null });
    callRef.current({ operation: "skill-file", path })
      .then((result) => { if (live) setState({ path, status: "ready", content: typeof result?.content === "string" ? result.content : null }); })
      .catch(() => { if (live) setState({ path, status: "error", content: null }); });
    return () => { live = false; };
  }, [callRef, path]);
  return state.path===path?state:{path,status:"loading",content:null};
}

// Page-shell drill header (customize-page-shell-current.js:486-493): CDS
// Button {variant:"ghost", size:c, icon:"ArrowLeft", flush:true} labelled with
// the page title, c = A() (:442) = shared-20 Za → "sm" here; the icon follows
// the button's density-auto size (Ds) and flush outsets by the sm pad-md.
function BackButton({ onClick, children }) {
  return <Button variant="ghost" size={DIALOG_BUTTON_SIZE} icon="ArrowLeft" iconSize="auto" flush onClick={onClick}>{children}</Button>;
}

// customize-skill-detail :77-87: while the file loads, "p-3" around a 100% ×
// 200px rounded-md shimmer bar with one sr-only "Loading" (here the CDS
// SkeletonBar); B :140-176 owns the empty and error copy.
function SkillFiles({ state }) {
  if (state.status === "error") return <p className="cz-file-empty">Files unavailable right now.</p>;
  if (state.status === "loading") return <div className="p-3" data-cz-file-loading=""><SkeletonBar height={200} className="w-full rounded-md" /></div>;
  if (state.content === null) return <p className="cz-file-empty">No files to show.</p>;
  return <SourceSkillFile key={state.path} content={state.content} />;
}

// Skill drill body = c9a7e510b D in the drill's isModal branch: "flex flex-col
// h-full px-6 pb-6 gap-3"; header "flex justify-between min-h-14 items-center
// py-3 -mr-6 pr-md" with the h2 "min-w-0 font-large-bold text-primary
// truncate" and cfaabd194 wt headerActions; then the ccb4abbdf facts row, the
// c6f9b6c10 Description block, and the files in "flex-1 min-h-0 flex flex-col
// gap-3 mt-2".
// ccb4abbdf r: the Trigger value is a focusable dotted-underline span whose
// tooltip explains the invocation policy.
const TRIGGER_VALUE = "font-base text-primary whitespace-nowrap cursor-help underline decoration-dotted decoration-alpha-2 underline-offset-4";

function SkillDetail({ skill, author, file, toggling, toggleError, onToggle, onBack, onRevealPath, onUseSkill, copy, backLabel="Skills" }) {
  const toggleLabel = "Enable skill";
  // A core without a per-skill switch (copy.skillToggle false) gates Try in
  // chat on user invocation alone; Codex keeps `enabled`.
  const tryable = copy.skillToggle ? skill.enabled : skillInvocable(skill);
  const trigger = skillTrigger(skill, copy);
  return (
    <div className="cz-drill" data-cz-detail="skill">
      <div className="cz-drill-header">
        <BackButton onClick={onBack}>{backLabel}</BackButton>
      </div>
      <div className="cz-drill-scroll scroll-fade-y scroll-fade-size-6"><div className="cz-skill-detail flex flex-col h-full px-6 pb-6 gap-3">
        <div className="cz-skill-head flex justify-between min-h-14 items-center py-3 -mr-6 pr-md">
          <div className="flex flex-1 flex-col min-w-0"><div className="flex min-w-0 items-center gap-xs">
            <h2 className="min-w-0 font-large-bold text-primary truncate">{skill.name}</h2>
          </div></div>
          <div className="cz-skill-actions flex items-center gap-2">
            {/* wt: primary "Try in chat", size te (Za → sm), icon Chat, disabled
                while the skill is off with disabledReason "Enable skill to try in
                chat". Locally it inserts the skill chip into the composer. */}
            <SourceTooltip disabledReason={tryable || !copy.skillToggle ? undefined : "Enable skill to try in chat"}>
              <Button variant="primary" size={DIALOG_BUTTON_SIZE} icon="Chat" iconSize="auto" disabled={!tryable || !onUseSkill}
                onClick={() => onUseSkill?.({ name: skill.name, skillName: skill.skillName, path: skill.path })}>Try in chat</Button>
            </SourceTooltip>
            {/* wt: Switch size sm, aria-label "Enable skill", no visible label,
                only when the skill can be toggled (cfaabd194 `Ce && Switch`): the
                DeepSeek core has no per-skill switch, so none is drawn. */}
            {copy.skillToggle && <Switch label={toggleLabel} size="sm" checked={skill.enabled} disabled={toggling} onChange={(value) => onToggle(skill, value)} />}
            {/* ct: ghost icon-only DotsVertical (size sm outside pageLayout) whose
                menu holds "Show in Folder" (the reveal of SKILL.md). */}
            <MoreMenu label={`More options for ${skill.name}`} size={DIALOG_BUTTON_SIZE}
              items={onRevealPath ? [{ label: "Show in Folder", icon: "Folder", onClick: () => onRevealPath(skill.path) }] : []} />
          </div>
        </div>
        {toggleError && <p className="cz-error" role="alert">{toggleError}</p>}
        {/* ccb4abbdf r: Added by / Version (SKILL.md metadata.version, when
            reported) / Last updated / Trigger (when the core reports the
            invocation policy; a Codex core does not). */}
        <div className="cz-skill-facts flex flex-wrap gap-x-8 gap-y-3">
          <div className="flex min-w-0 max-w-full flex-col gap-1">
            <span className="font-small text-muted whitespace-nowrap">Added by</span>
            <span className="font-base text-primary [overflow-wrap:anywhere]">{author}</span>
          </div>
          {skill.version ? <div className="flex flex-col gap-1">
            <span className="font-small text-muted whitespace-nowrap">Version</span>
            <span className="font-base text-primary whitespace-nowrap">{skill.version}</span>
          </div> : null}
          {skill.updatedAt ? <div className="flex flex-col gap-1">
            <span className="font-small text-muted whitespace-nowrap">Last updated</span>
            <span className="font-base text-primary whitespace-nowrap"><time dateTime={new Date(skill.updatedAt * 1000).toISOString()}>{shortDate(skill.updatedAt)}</time></span>
          </div> : null}
          {trigger && <div className="flex flex-col gap-1" data-cz-skill-trigger="">
            <span className="font-small text-muted whitespace-nowrap">Trigger</span>
            <SourceTooltip multiline className="[overflow-wrap:anywhere]" content={trigger.tooltip}>
              <span className={TRIGGER_VALUE} tabIndex={0}>{trigger.label}</span>
            </SourceTooltip>
          </div>}
        </div>
        {/* c9a7e510b T + c6f9b6c10: h3 "Description" (font-small muted) with the InfoTip, then the text. */}
        {skill.description && <div className="cz-skill-description flex flex-col gap-1">
          <div className="flex items-center justify-between"><div className="flex items-center gap-0.5">
            <h3 className="font-small text-muted">Description</h3>
            <InfoTip content={copy.skillDescriptionTooltip} />
          </div></div>
          <p className="font-base text-secondary whitespace-pre-wrap [overflow-wrap:anywhere]">{skill.description}</p>
        </div>}
        <div className="cz-skill-files flex-1 min-h-0 flex flex-col gap-3 mt-2"><SkillFiles state={file} /></div>
      </div>
      </div>
    </div>
  );
}

function SkillsPage({ store, cwd, call, onUseSkill, onRevealPath, onNavigate, focus, copy }) {
  const scrollMemory = useRef(new Map());
  const snapshot = useStore(store);
  const ownsCatalog = snapshot.skills.cwd === cwd;
  const { skills, errors, status, error } = ownsCatalog ? snapshot.skills
    : { skills: [], errors: [], status: "loading", error: "" };
  const plugins = snapshot.plugins.cwd === cwd ? snapshot.plugins.rows : [];
  const {query,setQuery,selected,setSelected}=useCatalogNavigation(focus,"skillPath");
  const [group,setGroup]=useState("all");
  useEffect(()=>{if(focus)setGroup("all");},[focus]);
  const [toggleError, setToggleError] = useState(""), [toggling, setToggling] = useState(false);
  const callRef = useRef(call);
  callRef.current = call;
  useEffect(() => { store.loadSkills({ cwd }); store.loadPlugins({ cwd }); }, [store, cwd]);
  const groups = useMemo(() => skillGroupOptions(skills), [skills]);
  const effectiveGroup = groups.show && groups.options.some((option) => option.value === group) ? group : "all";
  const rows = useMemo(() => filterSkills(skills, { query, group: effectiveGroup }), [skills, query, effectiveGroup]);
  const errorRows = useMemo(() => (effectiveGroup === "all" ? filterErrors(errors, { query }) : []), [errors, query, effectiveGroup]);
  const current = selected ? skills.find((row) => row.path === selected) : null;
  useEffect(() => { if (status === "ready" && selected && !current) setSelected(null); }, [selected, current, status]);
  const file = useSkillFile(callRef, current?.path || null);
  const empty = status === "ready" && rows.length === 0 && errorRows.length === 0;
  // Ie keeps the failure on screen with a busy Retry while ut.retry runs; the
  // store reports that forced reload as "loading" until it settles.
  const [retrying, setRetrying] = useState(false);
  useLoadFailureLog("skills", status, error);
  const retry = async () => { setRetrying(true); try { await store.loadSkills({ cwd, force: true }); } finally { setRetrying(false); } };
  async function toggle(row, enabled) {
    setToggleError(""); setToggling(true);
    try { await store.setSkillEnabled(row.path, enabled); }
    catch (reason) { setToggleError(reason.message || "The skill setting could not be saved."); }
    finally { setToggling(false); }
  }
  // detailPresenting (page shell :118, :288): the header and the list are not
  // drawn while a drill-in is open.
  if (current) {
    return (
      <div className="cz-page" data-cz-page="skills" data-detail="">
        <SkillDetail skill={current} author={skillAuthor(current, plugins)} file={file} toggling={toggling} toggleError={toggleError}
          onToggle={toggle} onBack={() => { setToggleError(""); setSelected(null); }} onRevealPath={onRevealPath} onUseSkill={onUseSkill} copy={copy} />
      </div>
    );
  }
  const header = <PageHeader title="Skills" searchLabel="Search skills" searchValue={query} onSearch={setQuery} />;
  if (status === "error" || (retrying && status === "loading"))
    return <div className="cz-page" data-cz-page="skills">{header}<CatalogLoadError section="skills" busy={retrying} onRetry={retry} /></div>;
  // customize-connectors :3136-3147 (the shared page-shell pattern): G "loading"
  // draws the header and the panel skeleton only — no notice, bands or table.
  if (status === "loading")
    return <div className="cz-page" data-cz-page="skills">{header}<PageBody><CatalogSkeleton section="skills" /></PageBody></div>;
  return (
    <div className="cz-page" data-cz-page="skills">
      {header}
      {/* customize-skills :3075-3127: [code-execution banner (none locally)], De
          owner segments, the q table (mt-sm), else Ee as the flex-1 body child. */}
      <PageBody memory={scrollMemory.current} scrollKey={JSON.stringify([cwd, effectiveGroup, query])}>
      {groups.show && <FilterSegments label="Filter by owner" value={effectiveGroup} options={groups.options} onChange={setGroup} />}
          {!empty && (
            <ListTable columns={SKILL_COLUMNS} label="Skills">
              {rows.map((row) => (
                <Row key={row.id} id={row.id} name={row.name} onSelect={() => { setToggleError(""); setSelected(row.path); }}
                  data-skill-scope={row.scope} data-skill-enabled={row.enabled ? "true" : "false"}>
                  <td className="cz-cell-primary">
                    <div className="cz-name">
                      <span className="cz-truncate">{row.name}</span>
                      {row.pluginId && <button type="button" className="cz-chip" onClick={(event) => { event.stopPropagation(); onNavigate?.("customize-plugins", { pluginId: row.pluginId }); }}
                        title="Open plugin">{skillAuthor(row, plugins)}</button>}
                      {/* customize-skills :3130-3131: the badge needs the toggle capability. */}
                      {copy.skillToggle && !row.enabled && <Badge>Disabled</Badge>}
                    </div>
                  </td>
                  <td className="cz-cell-secondary">{row.updatedAt ? <time dateTime={new Date(row.updatedAt * 1000).toISOString()}>{shortDate(row.updatedAt)}</time> : <Dash />}</td>
                  <td className="cz-cell-secondary"><span className="cz-truncate cz-block">{skillAuthor(row, plugins)}</span></td>
                </Row>
              ))}
              {errorRows.map((row) => (
                <tr key={row.id} data-row-id={row.id} data-skill-error="" className="cz-row-error">
                  <td className="cz-cell-primary">
                    <div className="cz-name">
                      <Icon name="Warning" size={16} className="cz-warning" />
                      <span className="cz-truncate">{row.name}</span>
                      <span className="cz-muted cz-truncate" title={row.message}>{row.message}</span>
                    </div>
                  </td>
                  <td className="cz-cell-secondary"><Dash /></td>
                  <td className="cz-cell-secondary"><span className="cz-truncate cz-block cz-mono" title={row.path}>{row.path}</span></td>
                </tr>
              ))}
            </ListTable>
          )}
          {/* ObjectBulb; the actions slot lists the core's skill folders (the
              source's Add skill / Learn more have no local backend). */}
          {empty && <EmptyState searchValue={query.trim() || (effectiveGroup !== "all" ? effectiveGroup : "")} noMatchMessage="No skills match your search"
            pictogram="ObjectBulb" emptyMessage={copy.skillsEmpty}
            actions={<ul className="cz-roots" aria-label="Skill folders">{copy.skillRoots.map((root) => <li key={root}><code>{root}</code></li>)}</ul>} />}
      </PageBody>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Connectors (MCP servers)

// customize-connectors :3610-3640 header row: sn Connector (flexible), Pa
// Type = sn className "w-40" (:2885-2888, 160px), sn Status "w-40". Every
// server here is run by the local core (stdio or url profile entries), so the
// io Type cell (:3767-3772) reads "Desktop"; the tool count lives in the drill.
const MCP_COLUMNS = [
  { key: "name", header: "Connector" },
  { key: "type", header: "Type", width: "40" },
  { key: "status", header: "Status", width: "40" },
];

// customize-connectors ca (:2027-2048) for la's reconnect/blocked branches
// (:2150-2243, row la size "sm" :3800-3808): div "flex min-w-0 items-center
// gap-xs text-warning" = Warning sm (shrink-0, aria-hidden), the action inside
// a CDS tooltip Y whose content is the explanation, and span.sr-only with the
// same explanation — never visible text beside the button.
function WarningStatus({ kind, status, children }) {
  const label = MCP_STATUS_LABELS[kind];
  return <span className="cz-status" data-status={status}><Icon name="Warning" size={16} className="cz-status-icon" aria-hidden="true" />
    <SourceTooltip content={label}><span className="cz-status-action">{children}</span></SourceTooltip><span className="cz-sr-only">{label}</span></span>;
}

// la (:2049-2275): unavailable → sa (:2010-2025) "—" plus sr-only "Not
// available"; the default not-connected branch is a secondary sm Mn "Connect"
// (locally config/mcpServer/reload, which starts never-started servers).
function StatusCell({ row, busy, onReconnect, onSignIn }) {
  switch (row.kind) {
    case "connected":
      return <span className="cz-status" data-status="connected"><Icon name="Check" size={16} aria-hidden="true" /><span className="cz-sr-only">Connected</span></span>;
    case "connecting":
      return <span role="status" className="cz-status" data-status="connecting"><span className="sc-spinner" aria-hidden="true" /><span className="cz-sr-only">Connecting</span></span>;
    case "unreachable":
      return <WarningStatus kind="unreachable" status="unreachable">
        <Button variant="secondary" size="sm" disabled={busy} onClick={(event) => { event.stopPropagation(); onReconnect(row); }}>Reconnect</Button></WarningStatus>;
    case "signIn":
      return <WarningStatus kind="signIn" status="sign-in">
        <Button variant="secondary" size="sm" disabled={busy} onClick={(event) => { event.stopPropagation(); onSignIn(row); }}>Sign in</Button></WarningStatus>;
    case "disabled":
      return <span className="cz-status" data-status="disabled"><Dash /><span className="cz-sr-only">Not available</span></span>;
    default:
      return <span className="cz-status" data-status="not-started">
        <Button variant="secondary" size="sm" disabled={busy} onClick={(event) => { event.stopPropagation(); onReconnect(row); }}>Connect</Button></span>;
  }
}

// customize-connectors va = 5 (:2302): ba shows the first va rows until
// "Show all" is pressed.
export const BROKEN_CARD_LIMIT = 5;

// "Connectors that stopped working" card, customize-connectors ba (:2300-2530)
// with rows Ca (:2644-2750). Heading row "-mx-pad-lg flex items-center
// justify-between gap-md border-b border-alpha-1 px-lg pb-lg"; h3 "flex
// min-w-0 items-start gap-xs text-body-medium text-primary" led by a Warning sm
// in "flex h-[1lh] shrink-0 items-center text-warning". Reconnect all (Sa) is
// the only bulk action and only exists while a sign-in is missing.
function BrokenConnectorsCard({ broken, expired, busy, onReconnectAll, onReconnect, onSignIn }) {
  // ba :2446-2450: [te,H] expanded, W = useId() list id, G = v.length > va;
  // `te && !G && H(!1)` collapses again once the count drops to va or fewer.
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const overflow = broken.length > BROKEN_CARD_LIMIT;
  if (expanded && !overflow) setExpanded(false);
  const rows = overflow && !expanded ? broken.slice(0, BROKEN_CARD_LIMIT) : broken;
  return (
    <section className="cz-broken" aria-label="Connectors that stopped working">
      <div className="cz-broken-head">
        <h3><span aria-hidden="true" className="cz-broken-icon"><Icon name="Warning" size={16} /></span>
          {broken.length === 1 ? `${broken[0].title} stopped working` : `${broken.length} connectors stopped working`}</h3>
        {expired.length > 0 && (
          <Button variant="secondary" disabled={busy} onClick={onReconnectAll}
            aria-label={`Reconnect all ${expired.length} ${expired.length === 1 ? "connector" : "connectors"} whose sign-in expired`}>Reconnect all</Button>
        )}
      </div>
      {/* ul "mt-xs grid gap-x-sm": without the snooze Ce menu (7-day hide is a
          claude.ai account preference with no Codex store) each row has three
          cells, the v2 "grid-cols-[auto_minmax(0,1fr)_auto]" track list. */}
      <ul id={listId} className="cz-broken-list" role="list">
        {rows.map((row) => (
          <li key={row.id} data-broken-name={row.name}>
            {/* Ca :2658-2662 leading slot: the connector tile _r size 24 /
                imageSize 16 (shared-13 lA → Jk bordered tile), shared with the rows. */}
            <ConnectorTile size={24} />
            <div className="cz-broken-text">
              <span className="cz-broken-name">{row.title}</span>
              {/* Si :1674-1692 unreachable "Server not responding". signIn keeps
                  "Sign-in required" (q87c5Fstfm): Codex McpAuthStatus notLoggedIn does
                  not say a previous sign-in expired, so Si's "Sign-in expired" (and Ca's
                  "Reconnect" label below) would claim something Codex never reports. */}
              <span className="cz-broken-reason">{MCP_STATUS_LABELS[row.kind]}</span>
            </div>
            {/* Ca :2733-2748 trailing: secondary Mn, "Retry" for unreachable
                (same local reload as the table's Reconnect). */}
            <div className="cz-broken-action">
              {row.kind === "signIn"
                ? <Button variant="secondary" size="sm" disabled={busy} onClick={() => onSignIn(row)}>Sign in</Button>
                : <Button variant="secondary" size="sm" disabled={busy} onClick={() => onReconnect(row)}>Retry</Button>}
            </div>
          </li>
        ))}
      </ul>
      {/* ba :2516-2530: ghost Button, size _ (Ze → sm in the classic dialog),
          flush "start", self-start, CaretUp/CaretDown, aria-expanded +
          aria-controls = the list id. */}
      {overflow && (
        <Button variant="ghost" size={DIALOG_BUTTON_SIZE} flush className="cz-broken-more" icon={expanded ? "CaretUp" : "CaretDown"} iconSize="auto"
          aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded((value) => !value)}>{expanded ? "Show less" : "Show all"}</Button>
      )}
    </section>
  );
}

function AddConnectorForm({ onSubmit, onCancel, busy, existingNames, copy }) {
  const [name, setName] = useState(""), [command, setCommand] = useState(""), [args, setArgs] = useState(""), [url, setUrl] = useState(""), [error, setError] = useState("");
  const nameId = useId();
  return (
    <form className="cz-form" aria-label="Add custom connector" onSubmit={async (event) => {
      event.preventDefault();
      const problem = validateServerName(name.trim());
      if (problem) { setError(problem); return; }
      // ~/.codex/config.toml is shared with the CLI: an upsert on an existing
      // mcp_servers.<name> would silently replace that server's command/url.
      if (existingNames.includes(name.trim())) { setError(`A connector named ${name.trim()} is already in ${copy.configFile}. Remove it first or choose another name.`); return; }
      let value;
      try { value = mcpServerConfigValue({ command, args: splitArguments(args), url }); }
      catch (reason) { setError(reason.message); return; }
      setError("");
      try { await onSubmit({ name: name.trim(), ...value }); }
      catch (reason) { setError(reason.message || "The connector could not be added."); }
    }}>
      <h3 id={nameId}>Add custom connector</h3>
      <p className="cz-muted">A stdio server needs a command (and optional arguments); a streamable HTTP server needs a URL. {copy.addConnectorNote}</p>
      <label className="cz-field"><span>Name</span><input aria-label="Connector name" value={name} onChange={(event) => { setName(event.target.value); setError(""); }} autoFocus /></label>
      <label className="cz-field"><span>Command</span><input aria-label="Command" value={command} placeholder="npx" onChange={(event) => { setCommand(event.target.value); setError(""); }} /></label>
      <label className="cz-field"><span>Arguments</span><input aria-label="Arguments" value={args} placeholder="-y my-mcp-server" onChange={(event) => { setArgs(event.target.value); setError(""); }} /></label>
      <label className="cz-field"><span>URL</span><input aria-label="URL" value={url} placeholder="https://example.com/mcp" onChange={(event) => { setUrl(event.target.value); setError(""); }} /></label>
      {error && <p className="cz-error" role="alert">{error}</p>}
      <div className="cz-form-actions">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={busy}>Add connector</Button>
      </div>
    </form>
  );
}

// Local server config, c2e7fd468 export t (_) in En's `mt-4` slot (c08e79e85):
// space-y-4 default-open Collapsible sections titled "font-small-bold
// text-secondary" with a pt-1 panel over the h code block — Command (a URL row
// for a url server), Arguments when there are any, and Environment variables
// as names masked with the source's "=••••••••". The definition comes from
// desktop-settings-read mcpDefinitions (settings-pages.cjs), which carries env
// names only, never values. No matching definition draws nothing.
const LOCAL_CONFIG_CODE = "block overflow-hidden whitespace-pre-wrap [overflow-wrap:anywhere] rounded bg-surface-1 px-2 py-1 font-mono text-sm text-primary";
const LOCAL_CONFIG_MASK = "=\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
function LocalConfigSection({ title, children }) {
  return <SourceDisclosure defaultOpen label={<span className="font-small-bold text-secondary flex items-center gap-sm">{title}</span>}>
    <div className="pt-1">{children}</div>
  </SourceDisclosure>;
}
function LocalConfig({ definition }) {
  const command = typeof definition?.command === "string" && definition.command ? definition.command : null;
  const url = !command && typeof definition?.url === "string" && definition.url ? definition.url : null;
  if (!command && !url) return null;
  const args = Array.isArray(definition.args) ? definition.args.filter((arg) => typeof arg === "string") : [];
  const names = Array.isArray(definition.environmentNames) ? definition.environmentNames.filter((name) => typeof name === "string" && name) : [];
  return <div className="mt-4" data-cz-local-config=""><div className="space-y-4">
    {command ? <LocalConfigSection title="Command"><code className={LOCAL_CONFIG_CODE}>{command}</code></LocalConfigSection>
      : <LocalConfigSection title="URL"><code className={LOCAL_CONFIG_CODE}>{url}</code></LocalConfigSection>}
    {args.length > 0 && <LocalConfigSection title="Arguments"><code className={LOCAL_CONFIG_CODE}>{args.join(" ")}</code></LocalConfigSection>}
    {names.length > 0 && <LocalConfigSection title="Environment variables"><code className={`${LOCAL_CONFIG_CODE} space-y-1`}>
      {names.map((name) => <span key={name} className="block"><span className="text-secondary">{name}</span>{LOCAL_CONFIG_MASK}</span>)}
    </code></LocalConfigSection>}
  </div></div>;
}

// Connector action feedback = the source's toasts (N() addError/addSuccess):
// reconnect / sign-in failures read "Connection to server failed. You can try
// again." (customize-connectors :2565-2590); the connected drill's Reconnect
// reloads the tools ("Tools list refreshed" / "Couldn’t refresh tools list.
// You can try again.", c08e79e85 Sn); a failed removal is c5fb58ef0's "Failed
// to remove server". Raw reasons go to the console only. Exported for tests.
export function connectorActions({ call, store, toasts, threadId = null, onOpenExternal, onEditConfig, copy = customizeCore() }) {
  const reload = async () => { await call({ operation: "mcp-reload" }); await store.loadMcp({ force: true }); };
  const run = async (label, fn, failure, success) => {
    try { await fn(); }
    catch (reason) {
      console.warn(`[customize] ${label} failed: ${reason?.message || reason}`);
      const message = typeof failure === "function" ? failure(reason) : failure;
      if (message) toasts?.add(message, { variant: "danger" });
      return false;
    }
    if (success) toasts?.add(success, { variant: "neutral" });
    return true;
  };
  return {
    reconnectAll: () => run("reconnect all", reload, CONNECTOR_TOASTS.connectFailed),
    reconnect: (row) => run(`reconnect ${row.name}`, reload, CONNECTOR_TOASTS.connectFailed),
    refresh: (row) => run(`refresh ${row.name}`, reload, CONNECTOR_TOASTS.refreshFailed, CONNECTOR_TOASTS.refreshed),
    signIn: (row) => run(`sign in to ${row.name}`, async () => {
      const result = await call({ operation: "mcp-login", name: row.name, threadId: threadId ?? null });
      await onOpenExternal(result.authorizationUrl);
    }, CONNECTOR_TOASTS.connectFailed),
    remove: (row) => run(`remove ${row.name}`, async () => {
      await call({ operation: "mcp-remove", name: row.name });
      await store.loadMcp({ force: true });
    }, CONNECTOR_TOASTS.removeFailed, `Removed ${row.name} from ${copy.configFile}.`),
    // Edit config opens the core's own file; its failure is app copy (main.cjs editConfigTarget).
    editConfig: () => run("edit config", () => onEditConfig(), (reason) => reason?.message || null),
  };
}

// Removal confirm over the Settings dialog (.ss-backdrop z 500, --cds-layer-base 500).
const SETTINGS_CONFIRM_LAYER = Object.freeze({ base: 520, z: 560 });

// Connector drill body, c08e79e85 En by connectorDetailState (customize-model).
// Connected: "px-6 pb-6" with the N header row (min-h-14 py-3, the drill's
// "-mr-6 pr-md"), the 24/16 tile and h2 font-large-bold name, a secondary
// Reconnect plus the Sn ⋮ menu, then the description, the LocalConfig block
// and the tool names (or "This connector has no tools available.").
// Connecting: the 56/40 tile over a role=status spinner and "Checking
// connection…". Otherwise the centred column with the 56/40 tile, the warning
// "Connection issue" title for a failure, the font-large muted message and one
// primary Reconnect / Sign in / Connect.
function ConnectorDetail({ row, busy, menuItems, onAction, definition }) {
  const state = connectorDetailState(row);
  const more = <MoreMenu label={`More options for ${row.title}`} items={menuItems} hideWhenEmpty />;
  if (state.view === "checking") return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4" data-connector-view="checking">
      <ConnectorTile size={56} />
      <div role="status" className="cz-checking text-center flex flex-col items-center gap-3">
        <span className="sc-spinner" aria-hidden="true" />
        <p className="font-base text-muted">Checking connection…</p>
      </div>
    </div>
  );
  if (state.view === "disconnected") return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-4" data-connector-view="disconnected">
      {menuItems.length > 0 && <div className="absolute top-3 right-6">{more}</div>}
      <ConnectorTile size={56} />
      <div className="text-center flex flex-col gap-2 px-6">
        {state.issue && <div className="flex items-center justify-center gap-1.5 text-warning" data-connection-issue="">
          <Icon name="Warning" size={16} /><span className="font-large-bold">Connection issue</span></div>}
        <p className="font-large text-muted [overflow-wrap:anywhere]">{connectorDetailMessage(state, row.title)}</p>
      </div>
      <div className="flex flex-wrap items-start justify-center gap-2">
        <Button variant="primary" disabled={busy || state.disabled} onClick={() => onAction(state.action, row)}>{state.label}</Button>
      </div>
    </div>
  );
  return (
    <div className="px-6 pb-6" data-connector-view="connected">
      <div className="flex items-center justify-between min-h-14 py-3 -mr-6 pr-md">
        <div className="flex items-center gap-3 min-w-0">
          <ConnectorTile size={24} />
          <div className="flex items-center gap-2 min-w-0"><h2 className="font-large-bold text-primary [overflow-wrap:anywhere]">{row.title}</h2></div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => onAction("refresh", row)}>Reconnect</Button>
          {more}
        </div>
      </div>
      {row.description && <p className="font-base text-secondary">{row.description}</p>}
      <LocalConfig definition={definition} />
      {row.tools.length > 0
        ? <div className="relative mt-6 isolate"><ul className="cz-tool-list" aria-label={`${row.title} tools`}>
            {row.tools.map((tool) => <li key={tool} className="flex gap-2.5 items-center py-2 border-b last:border-b-0"><span className="text-sm font-normal text-primary">{tool}</span></li>)}
          </ul></div>
        : <p className="font-base text-muted">This connector has no tools available.</p>}
    </div>
  );
}

function ConnectorsPage({ store, threadId, cwd, onOpenExternal, call, onNavigate, focus, copy, onEditConfig, mcpDefinitions }) {
  const scrollMemory = useRef(new Map());
  const snapshot = useStore(store);
  const ownsCatalog = snapshot.mcp.cwd === cwd && snapshot.mcp.threadId === (threadId ?? null);
  const { rows, status, error } = ownsCatalog ? snapshot.mcp
    : { rows: [], status: "loading", error: "" };
  const {query,setQuery,selected,setSelected}=useCatalogNavigation(focus,"connectorName");
  const [adding,setAdding]=useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [busy, setBusy] = useState(""), [confirmRemove, setConfirmRemove] = useState(null);
  const toasts = useSourceToasts();
  useEffect(()=>{setAdding(false);setConfirmRemove(null);if(focus)setStatusFilter("all");},[focus]);
  useEffect(() => { store.loadMcp({ threadId: threadId ?? null, cwd }); }, [store, threadId, cwd]);
  const searched = useMemo(() => filterMcp(rows, { query }), [rows, query]);
  const shown = useMemo(() => filterMcpByStatus(searched, statusFilter), [searched, statusFilter]);
  const current = selected ? rows.find((row) => row.name === selected) : null;
  useEffect(() => { if (status === "ready" && selected && !current) { setSelected(null); setConfirmRemove(null); } }, [selected, current, status]);
  // One action at a time; every outcome is a toast (connectorActions), never
  // a paragraph in the page. Add keeps its errors in the form.
  async function act(key, fn) {
    if (busy) return false;
    setBusy(key);
    try { return await fn(); }
    finally { setBusy(""); }
  }
  const actions = connectorActions({ call, store, toasts, threadId, onOpenExternal, onEditConfig, copy });
  const reconnectAll = () => act("reconnect-all", actions.reconnectAll);
  const reconnect = (row) => act(`reconnect:${row.name}`, () => actions.reconnect(row));
  const refresh = (row) => act(`refresh:${row.name}`, () => actions.refresh(row));
  const signIn = (row) => act(`login:${row.name}`, () => actions.signIn(row));
  const add = (payload) => act("add", async () => {
    await call({ operation: "mcp-add", ...payload });
    setAdding(false);
    await store.loadMcp({ force: true });
  });
  const remove = (row) => act(`remove:${row.name}`, async () => {
    const removed = await actions.remove(row);
    setConfirmRemove(null);
    if (removed) setSelected(null);
  });
  useLoadFailureLog("connectors", status, error);
  // Official "Connectors that stopped working" card (customize-connectors ba
  // :2300-2530, BrokenConnectorsCard): the only place a bulk Reconnect all
  // exists, and only when at least one connector's sign-in is missing. It sits
  // in the bands block above the status filter, so the filter never hides it.
  const broken = useMemo(() => searched.filter((row) => row.kind === "unreachable" || row.kind === "signIn"), [searched]);
  const expired = useMemo(() => broken.filter((row) => row.kind === "signIn"), [broken]);
  const editConfig = () => act("edit-config", actions.editConfig);
  const startAdding = () => { setAdding(true); setSelected(null); };
  // A core that cannot write MCP servers (capabilities.mcpConfigWrite false)
  // gets no add/remove controls; its profile patch is edited by hand, so the
  // header actions slot (where the source's add-connector action sits) holds
  // Edit config instead.
  const header = <PageHeader title="Connectors" searchLabel="Search connectors" searchValue={query} onSearch={setQuery}
    actions={copy.mcpConfigWrite
      ? <Button variant="primary" onClick={startAdding} disabled={!!busy || adding}>Add custom connector</Button>
      : <Button variant="secondary" disabled={!!busy || !onEditConfig} onClick={editConfig}>Edit config</Button>} />;
  // :3136-3147: G "error" renders the page header and so() alone. Mt retries
  // the catalog query; locally that is a forced mcpServerStatus/list.
  if (status === "error")
    return <div className="cz-page" data-cz-page="connectors">{header}<CatalogLoadError section="connectors" onRetry={() => { store.loadMcp({ threadId: threadId ?? null, cwd, force: true }); }} /></div>;
  // G "loading": header + MC only; rows of a previous catalog key (and their
  // stopped-working card) are not shown while the new key loads.
  if (status === "loading")
    return <div className="cz-page" data-cz-page="connectors">{header}<PageBody><CatalogSkeleton section="connectors" /></PageBody></div>;
  // :3164-3178: with a selected connector the page shell drill (wn, backLabel
  // "Connectors") replaces the header and the list; the body is En. Back
  // re-mounts the list body, whose scroll position bindCustomizeScroll restores.
  if (current) {
    const closeDetail = () => { setSelected(null); setConfirmRemove(null); };
    // Sn ⋮ items: Remove (danger) when the core writes MCP config and the
    // server is not plugin-owned; the DeepSeek core edits its profile instead.
    const menuItems = copy.mcpConfigWrite
      ? (current.pluginId ? [] : [{ label: "Remove connector", variant: "danger", disabled: !!busy, onClick: () => setConfirmRemove(current.name) }])
      : [{ label: "Edit config", disabled: !!busy || !onEditConfig, onClick: editConfig }];
    const runAction = (action, row) => (action === "signIn" ? signIn(row) : action === "refresh" ? refresh(row) : reconnect(row));
    const definition = Array.isArray(mcpDefinitions) ? mcpDefinitions.find((entry) => entry?.name === current.name) : undefined;
    return (
      <div className="cz-page" data-cz-page="connectors" data-detail="">
        <div className="cz-drill" data-cz-detail="connector">
          <div className="cz-drill-header"><BackButton onClick={closeDetail}>Connectors</BackButton></div>
          <div className="cz-drill-scroll scroll-fade-y scroll-fade-size-6"><div className="cz-connector-detail flex min-h-full flex-col">
            <ConnectorDetail key={current.name} row={current} busy={!!busy} menuItems={menuItems} onAction={runAction} definition={definition} />
          </div></div>
        </div>
        {/* c5fb58ef0 (c08e79e85 Sn ⋮ Remove → ut): the personal "Remove {serverName}?"
            ConfirmationDialog, confirmLabel "Remove", confirmVariant "danger",
            initial focus on Confirm; layered over the Settings dialog. */}
        {confirmRemove === current.name && copy.mcpConfigWrite && (
          <SourceConfirmationDialog title={`Remove ${current.title}?`} confirmLabel="Remove" confirmVariant="danger" layer={SETTINGS_CONFIRM_LAYER}
            pending={busy === `remove:${current.name}`} onCancel={() => setConfirmRemove(null)} onConfirm={() => remove(current)}
            body={<>You can still continue previous chats that reference {current.title} content.<br /><br />{copy.connectorRemoveNote}</>} />
        )}
      </div>
    );
  }
  const view = connectorsListView({ total: rows.length, visible: shown.length, status: statusFilter, query });
  return (
    <div className="cz-page" data-cz-page="connectors">
      {header}
      {/* :3546-3740: the bands block "flex shrink-0 flex-col gap-lg pt-sm" (the
          stopped-working card), then the body "flex flex-1 flex-col gap-lg" (pt-lg
          below bands, else pt-sm) with the gap-sm filter + table block and Ee. */}
      <PageBody memory={scrollMemory.current} scrollKey={JSON.stringify([cwd, threadId ?? null, statusFilter, query])}>
      {broken.length > 0 && <div className="flex shrink-0 flex-col gap-lg pt-sm">
        <BrokenConnectorsCard broken={broken} expired={expired} busy={!!busy} onReconnectAll={reconnectAll} onReconnect={reconnect} onSignIn={signIn} />
      </div>}
      <div className={`cz-connectors-body flex flex-1 flex-col gap-lg ${broken.length > 0 ? "pt-lg" : "pt-sm"}`}>
        {adding && copy.mcpConfigWrite && <AddConnectorForm busy={busy === "add"} existingNames={rows.map((row) => row.name)} copy={copy} onSubmit={add} onCancel={() => setAdding(false)} />}
        {(view.filter || view.table) && <div className="flex shrink-0 flex-col gap-sm">
          {view.filter && <FilterSegments label="Filter by status" value={statusFilter} options={MCP_STATUS_FILTERS} onChange={setStatusFilter} className="shrink-0 self-start" />}
          {view.table && (
            <ListTable columns={MCP_COLUMNS} label="Connectors" flush>
              {shown.map((row) => (
                <Row key={row.id} id={row.id} name={row.title} onSelect={() => { setSelected(row.name); setConfirmRemove(null); }}
                  data-mcp-name={row.name} data-mcp-status={row.kind}>
                  <td className="cz-cell-primary">
                    <div className="cz-name">
                      <ConnectorTile size={24} />
                      <span className="cz-truncate">{row.title}</span>
                      {row.pluginId && <button type="button" className="cz-chip" onClick={(event) => { event.stopPropagation(); onNavigate?.("customize-plugins", { pluginId: row.pluginId }); }}>{row.pluginId}</button>}
                    </div>
                  </td>
                  <td className="cz-cell-secondary">
                    <div className="cz-type flex min-w-0 items-center gap-xs overflow-hidden"><span>Desktop</span></div>
                  </td>
                  <td className="cz-cell-secondary"><StatusCell row={row} busy={!!busy} onReconnect={reconnect} onSignIn={signIn} /></td>
                </Row>
              ))}
            </ListTable>
          )}
          {view.filterEmpty && <p className="py-lg text-center text-body text-muted" data-cz-filter-empty="">{view.filterEmpty}</p>}
        </div>}
        {/* Ee NodeShapes. Actions as in :3698-3733: Codex keeps the secondary
            Add custom connector; the DeepSeek core cannot add one, so the body
            names the profile entry and the action is Edit config. */}
        {view.empty && <EmptyState searchValue={query.trim()} noMatchMessage="No connectors match your search"
          pictogram="NodeShapes"
          emptyMessage={copy.mcpConfigWrite ? copy.connectorsEmpty : <>{copy.connectorsEmpty}<span className="block" data-cz-config-hint="">Add a <code>{MCP_CLIENT_PACKAGE}</code> entry to <code>{copy.configFile}</code>, then Reconnect.</span></>}
          actions={copy.mcpConfigWrite
            ? <div className="flex flex-col items-center gap-3"><Button variant="secondary" onClick={startAdding} disabled={!!busy || adding}>Add custom connector</Button></div>
            : <div className="flex flex-col items-center gap-3"><Button variant="secondary" disabled={!!busy || !onEditConfig} onClick={editConfig}>Edit config</Button></div>} />}
      </div>
      </PageBody>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plugins (installed only)

const PLUGIN_COLUMNS = [
  { key: "name", header: "Plugin" },
  { key: "author", header: "Author", width: "40" },
  { key: "skills", header: "Skills", width: "20" },
  { key: "updated", header: "Last updated", width: "32" },
];

// c36b3644c fe → c26958849 nav row: the 24/16 connector tile in a size-6 slot
// (opacity-50 unless enabled), the server title, its status as the font-small
// muted description, text-muted unless connected; selecting it opens the
// connector drill (pe onSelect → Z).
function PluginConnectorRow({ item, onSelect }) {
  const content = <>
    <span className={`flex-shrink-0 flex items-center justify-center size-6 text-secondary${item.connected ? "" : " opacity-50"}`}><ConnectorTile size={24} /></span>
    <div className="flex flex-col flex-1 min-w-0">
      <span className="flex items-center gap-1.5 min-w-0"><span className="truncate">{item.label}</span></span>
      {item.description && <span className="font-small text-muted truncate" title={item.description}>{item.description}</span>}
    </div>
  </>;
  const tone = `rounded-lg text-sm w-full${onSelect ? " hover:bg-surface-0" : ""} ${item.connected ? "text-primary" : "text-muted"}`;
  return onSelect
    ? <button type="button" className={`flex items-center gap-3 px-3 py-1.5 text-left cursor-pointer ${tone}`} data-connector-name={item.connectorName} onClick={() => onSelect(item.connectorName)}>{content}</button>
    : <div className={`flex items-center gap-3 px-3 py-1.5 text-left ${tone}`} data-connector-name={item.connectorName}>{content}</div>;
}

// c36b3644c pe: two h-control skeleton bars while the connector rows load,
// "This plugin has no required connectors." without any, the tab's no-match
// line for a search without results, else the rows. Exported for tests.
export function PluginConnectors({ tab, items, loading, onSelect }) {
  if (loading) return <div className="flex flex-col gap-sm" data-plugin-mcp-loading=""><SkeletonBar className="h-control w-full" /><SkeletonBar className="h-control w-full" /></div>;
  if (!tab.items.length) return <p className="py-md text-body text-muted">This plugin has no required connectors.</p>;
  if (!items.length) return <p className="cz-plugin-no-match">No connectors match your search</p>;
  return <ul className="cz-plugin-items" data-plugin-mcp="">{items.map((item) => <li key={item.key}><PluginConnectorRow item={item} onSelect={onSelect} /></li>)}</ul>;
}

const DEFAULT_COPY = customizeCore();

// Classic plugin detail: customize-plugins-current Dt/Kt -> c36b3644c ye/_e.
// Exported for window-free rendering tests of the actual production surface.
// `mcp` = {rows, loading} of the Customize connectors catalog (connector rows'
// titles and status); `onConnector(name)` opens a connector's drill.
export function PluginDetail({ plugin, detail, error, skills, view, onView, onBack, onSkill, onConnector, scrollMemory, copy = DEFAULT_COPY, mcp = null, manage = null }) {
  const id = useId();
  const scroll = useRef(null);
  const mcpRows = mcp?.rows;
  const tabs = useMemo(() => pluginDetailTabs(detail, plugin.id, skills, { descriptions: copy.pluginTabDescriptions, mcpRows: mcpRows || [] }), [detail, plugin.id, skills, copy, mcpRows]);
  const { tab, searchable, items } = pluginDetailView(tabs, view?.tab, view?.query);
  useLayoutEffect(() => scrollMemory ? bindCustomizeScroll(scroll.current, scrollMemory, `detail:${plugin.id}`) : undefined, [scrollMemory, plugin.id]);
  useEffect(() => {
    if (detail && (view?.tab !== tab?.id || (!searchable && view?.query))) onView({ tab: tab?.id, query: '' });
  }, [detail, tab?.id, searchable, view?.tab, view?.query, onView]);
  const changeTab = next => onView({ tab: next, query: '' });
  return <div className="cz-drill" data-cz-detail="plugin">
    <div className="cz-drill-header"><BackButton onClick={onBack}>Plugins</BackButton></div>
    <div ref={scroll} className="cz-drill-scroll scroll-fade-y scroll-fade-size-6">
      {/* c36b3644c be: `s || !a ? q` — until plugin/read answers, the whole page is the c9d36aa51 skeleton. */}
      {!detail && !error ? <PluginPageSkeleton /> :
      <section className="cz-plugin-detail" aria-label={plugin.name}>
        <header className="cz-plugin-head"><h2 className="text-heading-semibold">{plugin.name}</h2>{!plugin.enabled && <Badge>Disabled</Badge>}{manage}</header>
        {plugin.loadError && <p className="cz-error cz-plugin-message" role="alert" data-plugin-load-error="">This plugin could not load: {plugin.loadError}</p>}
        <div className="cz-plugin-metadata">
          {plugin.marketplaceName && <div><span>Source</span><div>Marketplace (<button type="button" className="cz-text-button" onClick={onBack}>{plugin.marketplaceName}</button>)</div></div>}
          {plugin.author && <div><span>Author</span><div className="cz-truncate" title={plugin.author}>{plugin.author}</div></div>}
          {/* c26e90ba3 qt `!local && Last updated`: no backend timestamp, so the muted "—". */}
          {plugin.source !== "local" && <div><span>Last updated</span><div><span className="text-muted">—</span></div></div>}
        </div>
        {(detail?.description || plugin.description) && <div className="cz-plugin-description"><span>Description</span><p>{detail?.description || plugin.description}</p></div>}
        {error ? <p className="cz-error cz-plugin-message" role="alert">{error}</p> :
          <div className="cz-plugin-contents">
            <div className="cz-plugin-controls">
              <div data-cds="Tabs" data-orientation="horizontal"><div role="tablist" aria-label="Plugin contents" className="cz-plugin-tabs" onKeyDown={event => {
                if (event.altKey || event.ctrlKey || event.metaKey) return;
                const at = tabs.findIndex(entry => entry.id === tab?.id);
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : event.key === 'ArrowRight' ? (at + 1) % tabs.length : event.key === 'ArrowLeft' ? (at - 1 + tabs.length) % tabs.length : null;
                if (next !== null && tabs.length) { event.preventDefault(); event.currentTarget.querySelectorAll('[role="tab"]')[next]?.focus(); }
              }}>
                {tabs.length ? tabs.map(entry => <button type="button" role="tab" key={entry.id} id={`${id}-${entry.id}`} aria-controls={`${id}-panel`} aria-selected={entry.id === tab.id} tabIndex={entry.id === tab.id ? 0 : -1}
                  onFocus={() => { if (entry.id !== tab.id) changeTab(entry.id); }} onClick={() => { if (entry.id !== tab.id) changeTab(entry.id); }}>{entry.label}</button>) : <button type="button" role="tab" disabled aria-selected="true">Skills</button>}
              </div></div>
              {searchable && <PageSearch key={tab.id} label={`Search ${tab.id}`} value={view?.query || ''} onChange={query => onView({ tab: tab.id, query })} />}
            </div>
            {tab ? <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab.id}`}>
              <p className="cz-plugin-tab-description">{tab.description}</p>
              {tab.id === 'connectors' ? <PluginConnectors tab={tab} items={items} loading={!!mcp?.loading} onSelect={onConnector} /> : items.length ? <ul className="cz-plugin-items" {...{ [`data-plugin-${tab.id}`]: '' }}>
                {items.map(item => <li key={item.key}>{item.path ? <button type="button" className="cz-plugin-item" onClick={() => onSkill(item.path)}><span>{item.label}</span>{item.description.trim().length > 1 && <small title={item.description}>{item.description}</small>}{item.disabled && <Badge>Disabled</Badge>}</button> :
                  <div className="cz-plugin-item"><span>{item.label}</span>{item.description.trim().length > 1 && <small title={item.description}>{item.description}</small>}{item.disabled && <Badge>Disabled</Badge>}</div>}</li>)}
              </ul> : <p className="cz-plugin-no-match">No {tab.id} match your search</p>}
            </div> : <div className="flex flex-col items-center gap-2 px-6 py-10 text-center" data-plugin-empty="">
              {/* c36b3644c _e D: "This plugin doesn’t have any skills or agents." */}
              <span className="font-base text-secondary">This plugin doesn’t have any skills or agents.</span>
            </div>}
          </div>}
      </section>}
    </div>
  </div>;
}

// ---------------------------------------------------------------------------
// Plugin management (DeepSeek core: customize-store plugin ops → harness
// plugins.js over dsh-plugin-manager). The source page has no install flow
// for local bundles; this follows the Connectors page's inline add form.

// The core loads plugin changes when it starts (its profile runs without hot reload).
export function PluginRestartBanner({ onRestartCore }) {
  const [busy, setBusy] = useState(false);
  return <div className="cz-plugin-restart" role="status" data-plugin-restart="">
    <span>Plugin changes apply after DeepSeek restarts. Restarting stops sessions that are running.</span>
    {onRestartCore && <Button size="sm" variant="secondary" busy={busy} disabled={busy} onClick={async () => { setBusy(true); try { await onRestartCore(); } finally { setBusy(false); } }}>Restart DeepSeek</Button>}
  </div>;
}

export function AddPluginForm({ store, install, onClose }) {
  const [spec, setSpec] = useState(install?.spec || ""), [inspection, setInspection] = useState(null), [checking, setChecking] = useState(false), [error, setError] = useState("");
  const running = install?.status === "running";
  const outcome = install?.outcome;
  const pending = outcome?.pendingBuilds?.length ? outcome.pendingBuilds : null;
  async function submit(event) {
    event.preventDefault();
    if (running || checking || !spec.trim()) return;
    setError(""); setInspection(null); setChecking(true);
    try {
      const found = await store.inspectPlugin(spec.trim());
      setInspection(found);
      if (found?.status !== "accepted") { setError(found?.reason || "This package cannot be installed."); return; }
      if (found.bundle === false) { setError("This package is not a DeepSeek Harness plugin."); return; }
      setChecking(false);
      await store.installPlugin(spec.trim());
    } catch (reason) { setError(reason?.message || "The plugin could not be installed."); }
    finally { setChecking(false); }
  }
  const close = () => { store.clearPluginInstall(); onClose(); };
  return (
    <form className="cz-form" aria-label="Add plugin" onSubmit={submit} data-plugin-install={install?.status || "idle"}>
      <h3>Add plugin</h3>
      <p className="cz-muted">Install a DeepSeek Harness plugin from npm, a local folder (absolute path), a git URL or a tarball. Plugins run inside DeepSeek with your user permissions; install only ones you trust.</p>
      <label className="cz-field"><span>Package</span><input aria-label="Plugin package" value={spec} placeholder="@scope/dsh-plugin or /path/to/plugin" disabled={running}
        onChange={(event) => { setSpec(event.target.value); setError(""); setInspection(null); }} autoFocus /></label>
      {inspection?.status === "accepted" && inspection.name && <p className="cz-muted" data-plugin-inspection="">
        <strong>{inspection.name}</strong>{inspection.version ? ` ${inspection.version}` : ""}{inspection.description ? ` — ${inspection.description}` : ""}</p>}
      {running && <p className="cz-muted" role="status">{checking ? "Checking…" : pluginInstallStatus(install)}</p>}
      {install?.log && <SourceDisclosure label="Output"><pre className="cz-plugin-log" tabIndex={0} aria-label="Install output">{install.log}</pre></SourceDisclosure>}
      {outcome?.ok && <p className="cz-muted" role="status">Installed {outcome.bundle || install.spec}.{outcome.restartRequired ? " Restart DeepSeek to load it." : ""}</p>}
      {outcome && !outcome.ok && !outcome.cancelled && <p className="cz-error" role="alert">{outcome.message}</p>}
      {outcome?.cancelled && <p className="cz-muted" role="status">{outcome.message}</p>}
      {pending && <div className="cz-plugin-builds" data-plugin-pending-builds="">
        <p>These packages want to run build scripts: <strong>{pending.join(", ")}</strong>. Build scripts run with your user permissions.</p>
        <Button size="sm" variant="secondary" onClick={() => store.installPlugin(install.spec, { approvedBuilds: pending })}>Allow these scripts and retry</Button>
      </div>}
      {error && <p className="cz-error" role="alert">{error}</p>}
      <div className="cz-form-actions">
        {running
          ? <Button variant="secondary" disabled={install.phase === "cancelling" || install.phase === "applying"} onClick={() => store.cancelPluginInstall()}>Cancel install</Button>
          : <Button variant="secondary" disabled={checking} onClick={close}>{outcome ? "Close" : "Cancel"}</Button>}
        <Button type="submit" variant="primary" busy={checking || running} disabled={checking || running || !spec.trim()}>Install</Button>
      </div>
    </form>
  );
}

// Detail-page controls: on/off and Remove for a bundle the manager may change.
function PluginManageControls({ plugin, store, onRemoved }) {
  const [busy, setBusy] = useState(""), [error, setError] = useState(""), [confirm, setConfirm] = useState(false);
  async function run(kind, action) {
    setBusy(kind); setError("");
    try { const outcome = await action(); if (!outcome.ok) setError(outcome.message); return outcome; }
    catch (reason) { setError(reason?.message || "The plugin change failed."); return null; }
    finally { setBusy(""); }
  }
  return <div className="cz-plugin-manage" data-plugin-manage="">
    {plugin.manageable && <Switch label={`Turn ${plugin.name} ${plugin.enabled ? "off" : "on"}`} size="sm" checked={plugin.enabled} disabled={!!busy}
      onChange={(value) => run("toggle", () => store.setPluginEnabled(plugin.pluginName, value))} />}
    {plugin.removable && <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => setConfirm(true)}>Remove</Button>}
    {error && <p className="cz-error" role="alert">{error}</p>}
    <SourceConfirmationDialog open={confirm} title={`Remove ${plugin.name}?`} confirmLabel="Remove" confirmVariant="danger" pending={busy === "remove"}
      body="The plugin is uninstalled from the DeepSeek core’s profile. You can install it again later."
      onCancel={() => setConfirm(false)} onConfirm={async () => { const outcome = await run("remove", () => store.removePlugin(plugin.pluginName)); setConfirm(false); if (outcome?.ok) onRemoved?.(); }} />
  </div>;
}

function PluginsPage({ store, threadId, cwd, call, focus, onUseSkill, onRevealPath, onNavigate, copy, onRestartCore }) {
  const scrollMemory = useRef(new Map());
  const [ownedView, setOwnedView] = useState(null);
  const snapshot = useStore(store);
  const { rows, status, error } = snapshot.plugins.cwd === cwd ? snapshot.plugins
    : { rows: [], status: "loading", error: "" };
  const {query,setQuery,selected,setSelected}=useCatalogNavigation(focus,"pluginId");
  const [adding,setAdding]=useState(false);
  const pluginOps=snapshot.pluginOps||{install:null,restartRequired:false};
  const banner=copy.pluginManage&&pluginOps.restartRequired?<PluginRestartBanner onRestartCore={onRestartCore}/>:null;
  const [ownedDetail,setOwnedDetail]=useState(null),[ownedError,setOwnedError]=useState(null);
  const [skillPath,setSkillPath]=useState(focus?.skillPath||null),[toggling,setToggling]=useState(false),[toggleError,setToggleError]=useState('');
  const request = useRef(0);
  // `call` must not be an effect dependency: App re-renders on every streamed
  // token, and a fresh arrow there would reset `detail` and re-issue
  // plugin/read on each one.
  const callRef = useRef(call);
  callRef.current = call;
  useEffect(() => { store.loadPlugins({ cwd }); store.loadSkills({ cwd }); }, [store, cwd]);
  useLoadFailureLog("plugins", status, error);
  useEffect(() => {setSkillPath(focus?.skillPath||null);setToggleError('');},[focus]);
  const shown = useMemo(() => filterPlugins(rows, { query }), [rows, query]);
  const current = selected ? rows.find((row) => row.id === selected) : null;
  const detail=ownedDetail?.id===current?.id?ownedDetail?.value:null;
  const detailError=ownedError?.id===current?.id?ownedError?.message:'';
  useEffect(() => {
    const id=++request.current;
    if(!current)return;
    let live=true;
    setOwnedDetail(null);setOwnedError(null);
    callRef.current({operation:'plugin-read',pluginName:current.pluginName,marketplacePath:current.marketplacePath})
      .then(result=>{if(live&&id===request.current){if(result?.plugin)setOwnedDetail({id:current.id,value:result.plugin});else setOwnedError({id:current.id,message:'Plugin details are unavailable.'});}})
      .catch(reason=>{if(live&&id===request.current)setOwnedError({id:current.id,message:reason.message||'Plugin details are unavailable.'});});
    return()=>{live=false;};
  },[cwd,current?.id,current?.pluginName,current?.marketplacePath]);
  // The Connectors tab names its servers through the connectors catalog (pe's ue(e)).
  const wantsMcp=!!detail?.mcpServers?.length;
  useEffect(()=>{if(wantsMcp)store.loadMcp({threadId:threadId??null,cwd});},[store,wantsMcp,threadId,cwd]);
  const ownsMcp=snapshot.mcp.cwd===cwd&&snapshot.mcp.threadId===(threadId??null);
  const mcp=useMemo(()=>({rows:ownsMcp&&snapshot.mcp.status==='ready'?snapshot.mcp.rows:[],loading:wantsMcp&&(!ownsMcp||snapshot.mcp.status==='loading'||snapshot.mcp.status==='idle')}),[ownsMcp,wantsMcp,snapshot.mcp.rows,snapshot.mcp.status]);
  const currentSkill=current&&snapshot.skills.status==='ready'&&snapshot.skills.cwd===cwd?snapshot.skills.skills.find(skill=>skill.path===skillPath&&skill.pluginId===current.id):null;
  const file=useSkillFile(callRef,currentSkill?.path||null);
  async function toggleSkill(skill,enabled){setToggleError('');setToggling(true);try{await store.setSkillEnabled(skill.path,enabled);}catch(error){setToggleError(error.message);}finally{setToggling(false);}}
  if(currentSkill)return <div className="cz-page" data-cz-page="plugins" data-detail="">
    <SkillDetail skill={currentSkill} author={current.name} backLabel={current.name} file={file} toggling={toggling} toggleError={toggleError}
      onToggle={toggleSkill} onBack={()=>setSkillPath(null)} onUseSkill={onUseSkill} onRevealPath={onRevealPath} copy={copy}/>
  </div>;
  if(current)return <div className="cz-page" data-cz-page="plugins" data-detail="">
    {banner}
    <PluginDetail plugin={current} manage={copy.pluginManage&&(current.manageable||current.removable)?<PluginManageControls plugin={current} store={store} onRemoved={()=>{setSelected(null);setSkillPath(null);}}/>:null} detail={detail} error={detailError}
      skills={snapshot.skills.cwd===cwd&&snapshot.skills.status==='ready'?snapshot.skills.skills:[]}
      view={ownedView?.id===current.id?ownedView:null} onView={value=>setOwnedView({id:current.id,...value})}
      onBack={()=>{setSelected(null);setSkillPath(null);}} onSkill={setSkillPath} scrollMemory={scrollMemory.current} copy={copy} mcp={mcp}
      onConnector={onNavigate?connectorName=>onNavigate('customize-connectors',{connectorName}):undefined}/>
  </div>;
  const empty = status === "ready" && shown.length === 0;
  const names = pluginDisplayNames(rows);
  const header = <PageHeader title="Plugins" searchLabel="Search plugins" searchValue={query} onSearch={setQuery}
    actions={copy.pluginManage ? <Button variant="primary" onClick={() => setAdding(true)} disabled={adding || !!pluginOps.install}>Add plugin</Button> : null} />;
  const addForm = copy.pluginManage && (adding || pluginOps.install) ? <AddPluginForm store={store} install={pluginOps.install} onClose={() => setAdding(false)} /> : null;
  if (status === "error")
    return <div className="cz-page" data-cz-page="plugins">{header}<CatalogLoadError section="plugins" onRetry={() => { store.loadPlugins({ cwd, force: true }); }} /></div>;
  if (status === "loading")
    return <div className="cz-page" data-cz-page="plugins">{header}<PageBody><CatalogSkeleton section="plugins" /></PageBody></div>;
  return (
    <div className="cz-page" data-cz-page="plugins">
      {header}
      <PageBody memory={scrollMemory.current} scrollKey={JSON.stringify([cwd, query])}>
          {banner}
          {addForm}
          {!empty && (
            <ListTable columns={PLUGIN_COLUMNS} label="Plugins">
              {shown.map((row) => {
                // sn :1499-1505: the muted "(marketplace)" suffix only on a display-name collision (_L).
                const display = names.get(row.id) ?? { name: row.name };
                return (
                <Row key={row.id} id={row.id} name={row.name} selected={current?.id === row.id} onSelect={() => {setSelected(row.id);setSkillPath(null);}} data-plugin-id={row.id} data-plugin-enabled={row.enabled ? "true" : "false"}>
                  <td className="cz-cell-primary">
                    <div className="cz-name">
                      <span className="cz-truncate">{display.name}</span>
                      {display.suffix && <span className="cz-muted cz-truncate" data-plugin-suffix="">{display.suffix}</span>}
                      {!row.enabled && <Badge>Disabled</Badge>}
                      {row.loadError && <Badge variant="danger">Failed to load</Badge>}
                    </div>
                  </td>
                  <td className="cz-cell-secondary"><span className="cz-truncate cz-block">{row.author || <Dash />}</span></td>
                  <td className="cz-cell-secondary cz-tabular">{row.skillCount}</td>
                  <td className="cz-cell-secondary"><Dash /></td>
                </Row>
                );
              })}
            </ListTable>
          )}
          {/* customize-plugins :1409-1430: Ee with ObjectPuzzle (no Directory actions locally). */}
          {empty && <EmptyState searchValue={query.trim()} noMatchMessage="No plugins match your search" pictogram="ObjectPuzzle" emptyMessage={copy.pluginsEmpty} />}
      </PageBody>
    </div>
  );
}

// `core` is boot.core (engine, capabilities, configPath); without one the
// pages keep the Codex copy and every control.
// `mcpDefinitions` is desktop-settings-read's (command/url/args/env names) for
// the connector drill's LocalConfig.
export function SourceCustomize({ section, store, threadId, cwd, call, core, onUseSkill, onOpenExternal, onRevealPath, onEditConfig, onNavigate, focus, mcpDefinitions, onRestartCore }) {
  const copy = useMemo(() => customizeCore(core), [core]);
  if (section === "customize-skills") return <SkillsPage store={store} cwd={cwd} call={call} onUseSkill={onUseSkill} onRevealPath={onRevealPath} onNavigate={onNavigate} focus={focus} copy={copy} />;
  if (section === "customize-connectors") return <ConnectorsPage store={store} threadId={threadId} cwd={cwd} onOpenExternal={onOpenExternal} call={call} onNavigate={onNavigate} focus={focus} copy={copy} onEditConfig={onEditConfig} mcpDefinitions={mcpDefinitions} />;
  if (section === "customize-plugins") return <PluginsPage store={store} threadId={threadId} cwd={cwd} call={call} focus={focus} onUseSkill={onUseSkill} onRevealPath={onRevealPath} onNavigate={onNavigate} copy={copy} onRestartCore={onRestartCore} />;
  return null;
}
