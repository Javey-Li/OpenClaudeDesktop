import React, { useId } from "react";
import { SourceMenu } from "./source-menu";
import "./source-permission-menu.css";
import { t } from "../electron/i18n/index.mjs";

// These are the existing Codex wire values, not Claude's permission-mode enum.
// Order and copy: shared-14-BOJVa-jT.js:10259-10273 nE/rE for a local session
// (['default','acceptEdits','plan'], auto unshifted when autoFirst, bypass last) and
// :10283-10440 aE: Accept edits :10302-10313, Bypass :10370-10388, Manual :10431-10440.
// The nn item builder (ion-dist cf6ae6197) passes no icon, so no item draws one.
export const PERMISSION_OPTIONS = Object.freeze([
  // Auto: aE local branch (shared-14 :10346-10356) 'Claude handles permission decisions', no period.
  Object.freeze({ value: "auto", label: t("Auto"), description: t("DeepSeek handles permission decisions") }),
  Object.freeze({ value: "ask", label: t("Manual"), description: t("Always ask before making changes") }),
  Object.freeze({ value: "acceptEdits", label: t("Accept edits"), description: t("Automatically accept all file edits") }),
  Object.freeze({ value: "plan", label: t("Plan"), description: t("Create a plan before making changes") }),
  Object.freeze({ value: "bypass", label: t("Bypass permissions"), description: t("Accepts all permissions") }),
]);
const BYPASS_LABEL = PERMISSION_OPTIONS.at(-1).label;
/** Bypass while its local opt-in is off (approval-shared-current.js Lb nn, :8746-8803): a managed refusal shows a
 * disabled 'Bypass permissions' row ('Disabled by your organization'); otherwise (Vc showDisabled) the row has no quick
 * key and a trailing 'Enable' (text-footnote text-primary) and opens the Code settings page at the opt-in. */
export function bypassOffer({ enabled = false, availability = null } = {}) {
  if (enabled) return null;
  if (availability && availability.allowed === false && /organization/.test(availability.reason || "")) return "blocked";
  return "enable";
}
/** The chin trigger reads the item's full label (`ht = triggerLabel ?? label`;
 * the compact 'Accept'/'Bypass' trigger labels belong to the compact composer). */
export const permissionLabel = value => PERMISSION_OPTIONS.find(option => option.value === value)?.label ?? t("Manual");

/** Current 2.2553.1 chin: c360 Ud → Wr.Popup (side top, align start, one
 * GroupLabel "Mode") → cfca6870a item mapper, on the shared SourceMenu.
 * Selection closes the menu and hands focus to the composer editor through
 * finalFocus; Escape returns to the trigger (retained verified behavior).
 * defaultValue is Settings' default permission mode: wy() (ion-dist cf6ae6197)
 * gives that item a trailing neutral xxs Badge "Default" (pointer-events-none).
 */
// agents / agentValue / defaultAgent / onAgentChange: a core whose sessions can run as one of its own primary agents
// (OpenCode's and MiMo's build, docs, compose…) adds an 'Agent' group; Plan still runs the core's plan agent.
export function SourcePermissionMenu({ anchor, value, defaultValue, onChange, onClose, onSelectComplete, initialHighlight, bypassEnabled = false, bypassOffer = null, onEnableBypass,
  agents = null, agentValue = null, defaultAgent = null, onAgentChange }) {
  const prefix = useId(), headingId = `${prefix}-heading`, agentHeadingId = `${prefix}-agent-heading`;
  return (
    <SourceMenu.Popup anchor={anchor} side="top" align="start" collisionPadding={{ top: 48, right: 8, bottom: 8, left: 8 }}
      labelledBy={headingId} className="sp-permission-menu" onClose={onClose}
      finalFocus={onSelectComplete ? () => { onSelectComplete(); return null; } : undefined}
      initialHighlight={initialHighlight}>
      <SourceMenu.Group aria-labelledby={headingId}>
        <SourceMenu.GroupLabel id={headingId} className="sp-permission-heading">{t("Mode")}</SourceMenu.GroupLabel>
        {PERMISSION_OPTIONS.filter(option => option.value !== "bypass" || bypassEnabled).map((option, index) => {
          const selected = option.value === value, labelId = `${prefix}-${option.value}-label`;
          const descriptionId = `${prefix}-${option.value}-description`, digit = index + 1;
          return <SourceMenu.Item key={option.value} className="sp-permission-item" checked={selected} checkedRole="radio"
            label={option.label} description={option.description} labelId={labelId} descriptionId={descriptionId}
            aria-labelledby={labelId} aria-describedby={descriptionId} shortcut={String(digit)} digit={digit}
            trailing={option.value === defaultValue
              ? <span className="sp-permission-badge-slot"><span className="sp-permission-badge" data-cds="Badge" data-variant="neutral" data-step="1">
                  <span className="sp-permission-badge-text">{t("Default")}</span></span></span>
              : undefined}
            data-permission-value={option.value} onClick={() => { if (option.value !== value) onChange?.(option.value); }}>
            {option.label}
          </SourceMenu.Item>;
        })}
        {!bypassEnabled && bypassOffer === "enable" && onEnableBypass && <SourceMenu.Item className="sp-permission-item sp-permission-enable" label={BYPASS_LABEL}
          description={t("Turn on in Settings to use it")} data-permission-action="enable-bypass"
          trailing={<span className="sp-permission-enable-text">{t("Enable")}</span>}
          onClick={() => onEnableBypass()}>{BYPASS_LABEL}</SourceMenu.Item>}
        {!bypassEnabled && bypassOffer === "blocked" && <SourceMenu.Item className="sp-permission-item" label={BYPASS_LABEL} disabled
          disabledReason={t("Disabled by your organization")} data-permission-action="bypass-blocked">{BYPASS_LABEL}</SourceMenu.Item>}
      </SourceMenu.Group>
      {Array.isArray(agents) && agents.length > 1 && onAgentChange && <SourceMenu.Group aria-labelledby={agentHeadingId}>
        <SourceMenu.GroupLabel id={agentHeadingId} className="sp-permission-heading">{t("Agent")}</SourceMenu.GroupLabel>
        {agents.map((agent) => <SourceMenu.Item key={agent.name} className="sp-permission-item" checked={agent.name === agentValue} checkedRole="radio"
          label={agent.name} description={agent.description || (value === "plan" ? t("Used when you leave Plan") : undefined)}
          trailing={agent.name === defaultAgent
            ? <span className="sp-permission-badge-slot"><span className="sp-permission-badge" data-cds="Badge" data-variant="neutral" data-step="1">
                <span className="sp-permission-badge-text">{t("Default")}</span></span></span>
            : undefined}
          data-agent-value={agent.name} onClick={() => { if (agent.name !== agentValue) onAgentChange(agent.name); }}>{agent.name}</SourceMenu.Item>)}
      </SourceMenu.Group>}
    </SourceMenu.Popup>
  );
}
