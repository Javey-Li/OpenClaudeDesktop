// Computer use in the transcript (computer-use-model.mjs): one step row per action ("Clicked (512, 300)",
// "Typed “hello”", "Pressed ⌘C") whose body is the step's screenshot with the action marked on it (a ring where it
// clicked, a line for a drag); pressing the screenshot opens the image viewer. SourceComputerUseBanner is the live
// strip above the composer while the agent is controlling the computer: the latest screenshot, the current action
// and Stop.
import React, { useRef, useState } from "react";
import { Icon } from "./icons";
import { SourceImageViewer } from "./source-image-viewer.jsx";
import { SourceSettingsButton } from "./source-settings-button.jsx";
import { computerUseAction, computerUseLabel, computerUseScreenshot, screenshotMarker } from "./computer-use-model.mjs";
import { t } from "../electron/i18n/index.mjs";
import "./source-computer-use.css";

function MarkedScreenshot({ src, action, onOpen, buttonRef, compact = false }) {
  const [size, setSize] = useState(null);
  const marker = size ? screenshotMarker(action, size.width, size.height) : null;
  return (
    <button ref={buttonRef} type="button" className="scu-shot" data-compact={compact || undefined} aria-label={t("View screenshot")} onClick={onOpen}>
      <img src={src} alt="" draggable={false} onLoad={(event) => setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} />
      {marker && <svg className="scu-marker" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {marker.kind === "drag" && marker.x2 != null && <line x1={marker.x * 100} y1={marker.y * 100} x2={marker.x2 * 100} y2={marker.y2 * 100} vectorEffect="non-scaling-stroke" />}
      </svg>}
      {marker && <span className="scu-ring" data-kind={marker.kind} style={{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }} />}
      {marker?.kind === "drag" && marker.x2 != null && <span className="scu-ring" data-kind="drag-end" style={{ left: `${marker.x2 * 100}%`, top: `${marker.y2 * 100}%` }} />}
    </button>
  );
}

/**
 * One computer-use step as a transcript row. Step is the shared SourceStep (row + collapsible body).
 * @param {{item: object, state: string, Step: Function, stepProps: object, inToolGroup?: boolean}} props
 */
export function SourceComputerUseStep({ item, state, Step, stepProps, inToolGroup = false }) {
  const action = computerUseAction(item);
  const screenshot = computerUseScreenshot(item);
  const [open, setOpen] = useState(false);
  const button = useRef(null);
  const { label, meta } = computerUseLabel(action, state);
  const shot = screenshot ? <div className="scu-body">
    <MarkedScreenshot src={screenshot} action={action} buttonRef={button} onOpen={() => setOpen(true)} />
    {open && <SourceImageViewer src={screenshot} alt={t("Screenshot")} caption={[label, meta].filter(Boolean).join(" ")} originRef={button} onClose={() => setOpen(false)} />}
  </div> : null;
  return (
    <Step item={item} {...stepProps} label={label} meta={meta} state={state} classic caretSize={14} className={`source-generic-step scu-step scu-kind-${action.kind}`}
      after={inToolGroup ? null : shot}>
      {inToolGroup ? shot : null}
    </Step>
  );
}

/**
 * The live strip while a computer-use step runs.
 * @param {{active: {item: object, action: object, screenshot: string | null} | null, coreName?: string, onStop?: () => void, stopping?: boolean}} props
 */
export function SourceComputerUseBanner({ active, coreName, onStop, stopping = false }) {
  const [open, setOpen] = useState(false);
  const button = useRef(null);
  if (!active) return null;
  const { label, meta } = computerUseLabel(active.action, "busy");
  return (
    // composer-zone: the composer's own column (width, gutters and the custom transcript width), so the strip lines up with it.
    <div className="composer-zone scu-banner-zone"><div className="scu-banner" role="status" aria-live="polite" data-computer-use-banner="">
      {active.screenshot ? <MarkedScreenshot compact src={active.screenshot} action={active.action} buttonRef={button} onOpen={() => setOpen(true)} />
        : <span className="scu-banner-icon" aria-hidden="true"><Icon name="Computer" size={18} /></span>}
      <span className="scu-banner-text">
        <span className="scu-banner-title">{coreName ? t("{name} is using your computer", { name: coreName }) : t("Using your computer")}</span>
        <span className="scu-banner-action"><span className="source-shimmer">{label}</span>{meta ? ` ${meta}` : ""}</span>
      </span>
      {onStop && <SourceSettingsButton size="sm" variant="danger" busy={stopping} onClick={onStop}>{t("Stop")}</SourceSettingsButton>}
      {open && active.screenshot && <SourceImageViewer src={active.screenshot} alt={t("Screenshot")} caption={[label, meta].filter(Boolean).join(" ")} originRef={button} onClose={() => setOpen(false)} />}
    </div></div>
  );
}
