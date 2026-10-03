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
export function SourcePermissionMenu({ anchor, value, defaultValue, onChange, onClose, onSelectComplete, initialHighlight, bypassEnabled = false }) {
  const prefix = useId(), headingId = `${prefix}-heading`;
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
      </SourceMenu.Group>
    </SourceMenu.Popup>
  );
}
