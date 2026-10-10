import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icons";
import { SourceSwitch as SettingSwitch } from "./source-switch.jsx";
import { SourceMenu } from "./source-menu";
import { filterModels, modelMenuSections } from "./model-menu-model.mjs";
import "./source-model-menu.css";
import { t } from "../electron/i18n/index.mjs";

const modelKey = (model) => model.model || model.id;
const modelName = (model) => model.displayName || model.name || modelKey(model);

/** Code's CDS ModelSelector: current 2.2553.1 shared-14 FS → AS/kS → $.Popup
 * (data-cds ModelSelector, max-w min(26rem, available width)) over the shared
 * SourceMenu primitive. The primary/overflow split and the Fast decision are
 * model-menu-model.mjs modelMenuSections (first four, explicit catalog
 * sections first). Rows follow bS: main rows show descriptions, digit rows
 * carry a 16px trailing slot holding the accent Check or the digit, and the
 * name carries only a catalog badge (pS: e.badge.message; no local 'Default').
 * Codex's Model type has no disabled/disabled_reason field, so no row is ever
 * disabled from the live catalog; the optional fields are read only if present.
 * The Fast section (ES) renders only for a model with a Fast tier. Its row
 * follows wS: a wrapping copy block with the option name and, on the next
 * line, the tier description Codex reports (ModelServiceTier.description); a
 * right-side tooltip only wraps it when tooltip content exists (Codex has none).
 */
export function SourceModelMenu({
  anchor, models = [], selected, onSelect, onClose, fastTier, fastMode = false, fastDisabled = false,
  fastSaving = false, onFastModeChange, initialHighlight, scopeNote = null,
  // Several faster tiers (Fast, Ultrafast): a Speed group of Standard and each tier in place of the Fast switch.
  speedTiers = [], speed = "standard", onSpeedChange,
}) {
  const severalSpeeds = Array.isArray(speedTiers) && speedTiers.length > 1 && !!onSpeedChange;
  const { primary, overflow, showFast, searchable } = useMemo(() => modelMenuSections({ models, fastTier, selected }), [models, fastTier, selected]);
  // A long catalog (more than MODEL_SEARCH_THRESHOLD models) is searched by name, provider or id: typing filters a flat
  // list of matches in place of the sections; Enter picks the first, Escape clears the query first.
  const [query, setQuery] = useState(""), searchRef = useRef(null);
  const matches = useMemo(() => (searchable ? filterModels(models, query) : []), [searchable, models, query]);
  const searching = searchable && query.trim() !== "";
  useEffect(() => { if (searchable) { const timer = setTimeout(() => searchRef.current?.focus({ preventScroll: true }), 0); return () => clearTimeout(timer); } return undefined; }, [searchable]);
  const primaryDigits = useMemo(() => {
    const digits = new Map();
    let digit = 1;
    primary.forEach((model) => {
      if (!model.disabled && digit <= 9) digits.set(modelKey(model), digit++);
    });
    return digits;
  }, [primary]);
  const pick = (model) => {
    if (modelKey(model) !== selected) onSelect?.(model);
  };
  const row = (model, main) => {
    const id = modelKey(model), active = id === selected, digit = main ? primaryDigits.get(id) : undefined;
    const disabled = !!model.disabled && !active;
    const description = main ? model.description : undefined;
    const trailing = digit !== undefined
      ? <span className="sm-model-trailing" aria-hidden="true">{active
          ? <Icon name="Check" size={16} weight="strong" />
          : <span className="sm-model-digit">{digit}</span>}</span>
      : undefined;
    return <SourceMenu.Item key={id} className="sm-model-item" label={modelName(model)} description={description}
      disabled={disabled} disabledReason={disabled ? model.disabled_reason?.message : undefined}
      checked={digit !== undefined ? undefined : active} checkedRole="radio"
      {...(digit !== undefined ? { role: "menuitemradio", "aria-checked": active, "aria-keyshortcuts": String(digit) } : {})}
      data-model-id={id} digit={digit}
      trailing={trailing} onClick={() => pick(model)}>
      <span className="sm-model-name"><span className="sm-model-label">{modelName(model)}</span>{typeof model.badge?.message === "string" && model.badge.message && <span className="sm-model-badge">{model.badge.message}</span>}</span>
    </SourceMenu.Item>;
  };

  const searchKeyDown = (event) => {
    if (event.target !== searchRef.current || event.nativeEvent?.isComposing) return;
    if (event.key === "Enter" && searching) { event.preventDefault(); if (matches[0]) { pick(matches[0]); onClose?.(); } }
    else if (event.key === "Escape" && query) { event.preventDefault(); event.stopPropagation(); setQuery(""); }
  };
  return <SourceMenu.Popup anchor={anchor} side="top" align="end" label={t("Models")} dataCds="ModelSelector"
    className="sm-model-menu" onClose={onClose} initialHighlight={searchable ? null : initialHighlight} onKeyDown={searchable ? searchKeyDown : undefined}>
    {searchable && <div className="sm-model-search">
      <Icon name="Search" size={14} aria-hidden="true" />
      <input ref={searchRef} type="text" className="sm-model-search-input cds-reset" aria-label={t("Search models")} placeholder={t("Search models")}
        value={query} spellCheck={false} autoComplete="off" onChange={(event) => setQuery(event.target.value)} />
    </div>}
    {searching ? <>
      {matches.length > 0
        ? <SourceMenu.Group>{matches.map((model) => row(model, false))}</SourceMenu.Group>
        : <div className="sm-model-empty" role="status">{t("No matching models")}</div>}
    </> : <>
    <SourceMenu.Group>{primary.map((model) => row(model, true))}</SourceMenu.Group>
    {!primary.length && !overflow.length && <div className="sm-model-empty" role="status">{t("No models available")}</div>}
    {overflow.length > 0 && <>
      <SourceMenu.Separator />
      <SourceMenu.Submenu>
        <SourceMenu.SubmenuTrigger className="sm-model-item" label={t("More models")}>{t("More models")}</SourceMenu.SubmenuTrigger>
        <SourceMenu.Popup label={t("More models")} dataCds="ModelSelector" className="sm-model-menu sm-model-submenu">
          <SourceMenu.Group>{overflow.map((model) => row(model, false))}</SourceMenu.Group>
        </SourceMenu.Popup>
      </SourceMenu.Submenu>
    </>}
    </>}
    {showFast && severalSpeeds && <>
      <SourceMenu.Separator />
      <SourceMenu.Header className="sm-model-header">{t("Speed")}</SourceMenu.Header>
      {[{ key: "standard", name: t("Standard"), description: t("The model’s usual speed and usage.") }, ...speedTiers].map((tier) =>
        <SourceMenu.Item key={tier.key} className="sm-model-item sm-model-fast" checked={speed === tier.key} checkedRole="radio" label={tier.name}
          keepOpen disabled={fastDisabled} aria-busy={fastSaving || undefined} data-speed={tier.key}
          onClick={() => { if (speed !== tier.key) onSpeedChange(tier.key); }}>
          <span className="sm-fast-copy">
            <span className="sm-fast-name"><span className="sm-fast-label">{tier.name}</span></span>
            {typeof tier.description === "string" && tier.description.trim() !== ""
              && <span className="sm-fast-description" data-fast-description="">{tier.description}</span>}
          </span>
        </SourceMenu.Item>)}
    </>}
    {showFast && !severalSpeeds && onFastModeChange && <>
      <SourceMenu.Separator />
      <SourceMenu.Header className="sm-model-header">{t("Fast mode")}</SourceMenu.Header>
      <SourceMenu.Item className="sm-model-item sm-model-fast" role="menuitemcheckbox" aria-checked={fastMode} label={t("Enable fast mode")}
        keepOpen disabled={fastDisabled} aria-busy={fastSaving || undefined}
        trailing={<SettingSwitch checked={fastMode} decorative />} onClick={() => onFastModeChange(!fastMode)}>
        <span className="sm-fast-copy">
          <span className="sm-fast-name"><span className="sm-fast-label">{t("Enable fast mode")}</span></span>
          {typeof fastTier?.description === "string" && fastTier.description.trim() !== ""
            && <span className="sm-fast-description" data-fast-description="">{fastTier.description}</span>}
        </span>
      </SourceMenu.Item>
    </>}
    {scopeNote && <div className="sm-model-scope" data-model-scope="">{scopeNote}</div>}
  </SourceMenu.Popup>;
}
