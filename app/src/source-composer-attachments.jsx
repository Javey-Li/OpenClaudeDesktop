import React, { useState } from "react";
import { Icon } from "./icons";
import { SourceTooltip } from "./source-tooltip";
import { attachmentOpenAction, attachmentViewerState, extensionOf } from "./composer-attachments-model.mjs";
import { SourceImageViewer } from "./source-image-viewer.jsx";
import "./source-composer-attachments.css";

// 2.2553.1 CDS Attachments slot (shared-11 :1625-1633) hosting the epitaxy
// pills (c099c328d :2200-2330 Al, :2947-2975 Kl/ql, :2896-2912 strip). Image
// pills show the object-URL/file preview with a loading overlay until the
// entry is ready; file pills are the quiet variant with the lowercase
// extension caption (jl) or the Folder glyph. The remove control is the
// hover/focus-revealed 16px circle. Mounted only while entries exist (:7479).
// A press on the pill opens it (Kl/ql onClick, c099c328d :3551-3590): onOpen
// routes it through attachmentOpenAction.
function AttachmentPill({ entry, onRemove, onOpen, disabled }) {
  const image = entry.kind === "image";
  const name = entry.relativePath || entry.name;
  // Skills are editor chips now (source-composer-editor.jsx command_chip kind 'skill'), never pills.
  const body = (
    <button type="button" aria-label={name}
      className={`epitaxy-pill-body sca-body ${image ? "sca-body--image" : "epitaxy-pill-body--flat sca-body--flat"}`}
      onMouseDown={(event) => event.preventDefault()} onClick={(event) => onOpen?.(entry, event.currentTarget)}>
      {image ? (
        <span className="sca-thumb">
          {entry.previewUrl && <img src={entry.previewUrl} alt="" className="sca-picture" draggable={false} />}
          {entry.status === "loading" && (
            <span role="status" className="sca-loading">
              <span className="sc-spinner" aria-hidden="true" />
              <span className="sca-sr-only">Processing image</span>
            </span>
          )}
        </span>
      ) : (
        <span className="sca-glyph" aria-hidden="true">
          {entry.isDirectory ? <Icon name="Folder" size={16} /> : <span className="sca-extension">{extensionOf(entry.name)}</span>}
        </span>
      )}
    </button>
  );
  return (
    <div data-cds-attachment="" className="sca-pill" data-kind={entry.kind} data-status={entry.status}>
      <SourceTooltip content={name}>{body}</SourceTooltip>
      <button type="button" tabIndex={-1} aria-label={`Remove ${name}`} className="epitaxy-pill-remove sca-remove"
        disabled={disabled} onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => { event.stopPropagation(); event.preventDefault(); onRemove(entry.id); }}>
        <Icon name="X" size={12} />
      </button>
    </div>
  );
}

// Ue/Za (c099c328d :3143-3150, :3518-3526): an image pill opens the image viewer on its
// preview, named by the image, zooming from the pill; the viewer state stays here. A file or
// directory pill goes to onOpenFile(entry, 'file' | 'reveal') (Gl :3542-3550, adapted).
export function SourceComposerAttachments({ entries = [], onRemove, onOpenFile, disabled = false }) {
  const [viewer, setViewer] = useState(null);
  // The viewer lives only as long as its entry: a removed or swapped-out attachment (a draft swap,
  // a send, the last pill removed) closes it, and the state is cleared before the empty early
  // return so a later attachment never reopens a stale (possibly revoked) preview.
  const shown = attachmentViewerState(viewer, entries);
  if (viewer && !shown) setViewer(null);
  if (!entries.length) return null;
  const open = (entry, origin) => {
    const action = attachmentOpenAction(entry);
    if (action === "view") setViewer({ id: entry.id, src: entry.previewUrl, alt: entry.name, origin });
    else if (action) onOpenFile?.(entry, action);
  };
  return (
    <div className="sca-wrap">
      <div data-cds-composer-attachments="" className="sca-slot">
        <div className="sca-strip">
          {entries.map((entry) => <AttachmentPill key={entry.id} entry={entry} onRemove={onRemove} onOpen={open} disabled={disabled} />)}
        </div>
      </div>
      {shown && <SourceImageViewer key={shown.id} src={shown.src} alt={shown.alt} originRef={{ current: shown.origin }} onClose={() => setViewer(null)} />}
    </div>
  );
}
