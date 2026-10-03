import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Icon } from "./icons";
import { SourceMenu } from "./source-menu.jsx";
import { SourceTableScope } from "./source-response-table.jsx";
import { useTranscriptScroll } from "./use-transcript-scroll";
import { pathChoices } from "./file-tool-model.mjs";
import { clipboardEnvironment, writeClipboardPayload } from "./clipboard-payload.mjs";
import { markdownToClipboardHtml } from "./rich-copy-html.mjs";
import { attachableSelection, fileRefMenu, linkTarget, messageMenu } from "./transcript-context-menu-model.mjs";
import { useTranscriptFeedNav } from "./use-transcript-feed-nav.js";
import "./source-transcript.css";

const EDITABLE = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

// scroll-messages-current.js:33165-33193 iY: what the pointer is over. A
// [data-code-text] body (fence, or inline code holding a masked secret) wins;
// any other part of a fence suppresses the inline-code lookup.
function codeTargetOf(target) {
  const body = target.closest("[data-code-text]");
  const block = target.closest(".scb-block");
  const inline = body || block ? null : target.closest("[data-epitaxy-inline-code]");
  if (body?.dataset.codeText) return { text: body.dataset.codeText,
    isBlock: !body.hasAttribute("data-epitaxy-inline-code"), isPath: body.hasAttribute("data-epitaxy-file-ref") };
  if (inline?.textContent) return { text: inline.textContent, isBlock: false, isPath: inline.hasAttribute("data-epitaxy-file-ref") };
  return null;
}

function MenuEntries({ entries, run }) {
  return entries.map((entry, index) => {
    if (entry.type === "separator") return <SourceMenu.Separator key={`separator-${index}`} />;
    if (entry.submenu) return <SourceMenu.Submenu key={entry.id}>
      <SourceMenu.SubmenuTrigger>{entry.label}</SourceMenu.SubmenuTrigger>
      <SourceMenu.Popup label={entry.label}><MenuEntries entries={entry.submenu} run={run} /></SourceMenu.Popup>
    </SourceMenu.Submenu>;
    return <SourceMenu.Item key={entry.id} shortcut={entry.shortcut} onClick={() => run(entry.id)}>{entry.label}</SourceMenu.Item>;
  });
}

export const SourceTranscript = forwardRef(function SourceTranscript(
  { sessionKey, ready = true, pendingInput = false, interactionHandlers, messageActions = null, responding = false, onFeedEscape = null, findBarRef = null, children },
  ref,
) {
  const scroll = useTranscriptScroll({ sessionKey, ready });
  const actions = useRef(messageActions);
  actions.current = messageActions;
  // F10: scroll-transcript-host-current.js:2982 feedKeyboardNav (N9 feed and
  // articles). The ZB find bar is app-level (sidebar-main.js:20491): main.jsx
  // mounts SourceFindBar outside this keyed transcript and hands its ref in;
  // the handle keeps openFind/stepFind for the Edit ▸ Find menu events.
  const feed = useTranscriptFeedNav({ viewportRef: scroll.viewportRef, contentRef: scroll.contentRef, api: scroll.api, responding,
    resolveMessage: (id) => actions.current?.resolveMessage?.(id), onEscape: onFeedEscape });
  useImperativeHandle(ref, () => ({ ...scroll.api,
    openFind: () => findBarRef?.current?.open(), stepFind: (forward) => findBarRef?.current?.step(forward) }), [scroll.api, findBarRef]);
  const [menu, setMenu] = useState(null);
  useEffect(() => { setMenu(null); }, [sessionKey]);

  // scroll-messages-current.js:33411-33640 SY: a right-click on a user or
  // assistant row (or a file reference chip) opens the CDS ContextMenu at the
  // pointer, as source-response-image.jsx does; preventDefault keeps the
  // native menu (F04) closed. Rows without message text keep the native menu.
  function onContextMenu(event) {
    interactionHandlers?.onContextMenu?.(event);
    const current = actions.current;
    if (!current || event.defaultPrevented) return;
    const viewport = event.currentTarget;
    const target = event.target?.nodeType === 1 ? event.target : event.target?.parentElement;
    if (!target || !viewport.contains(target) || target.closest(EDITABLE)) return;
    const point = { x: event.clientX, y: event.clientY };
    const fileNode = target.closest("[data-file-ref]");
    if (fileNode && viewport.contains(fileNode)) {
      const path = fileNode.dataset.fileRef, choices = pathChoices(path, current.cwd);
      const entries = fileRefMenu({ absolute: choices?.absolute, relative: choices?.relative, filename: choices?.filename || path,
        canAttach: !!current.onAttachFile, canOpen: !!current.onOpenFile, canReveal: !!current.onRevealFile && !!choices?.relative });
      event.preventDefault();
      setMenu({ kind: "file", point, entries, path, choices,
        line: fileNode.dataset.fileLine ? Number(fileNode.dataset.fileLine) : undefined,
        endLine: fileNode.dataset.fileEndLine ? Number(fileNode.dataset.fileEndLine) : undefined });
      return;
    }
    const row = target.closest("[data-transcript-item-id]");
    if (!row || !viewport.contains(row)) return;
    const text = current.resolveMessage?.(row.dataset.transcriptItemId);
    if (typeof text !== "string") return;
    const selectionText = viewport.ownerDocument.getSelection()?.toString() ?? "";
    const link = linkTarget(target.closest("a[href]")?.href);
    const code = codeTargetOf(target);
    const entries = messageMenu({ selectionText: selectionText.trim() ? selectionText : null, codeTarget: code,
      ...link, messageText: text, canAttach: !!current.onAttachText });
    event.preventDefault();
    setMenu({ kind: "message", point, entries, text, code, link: link.linkHref, selectionText });
  }

  function run(id) {
    const current = actions.current, viewport = scroll.viewportRef.current;
    const write = (value) => navigator.clipboard.writeText(value).catch(() => {});
    if (!menu || !current) return;
    if (menu.kind === "file") {
      const { choices, path } = menu;
      switch (id) {
        case "attach-file": current.onAttachFile?.(choices?.absolute); break;
        case "copy-absolute": current.onCopyPath?.(choices?.absolute); break;
        case "copy-relative": current.onCopyPath?.(choices?.relative); break;
        case "copy-filename": current.onCopyPath?.(choices?.filename || path); break;
        case "open-files-pane": current.onOpenFile?.({ path, line: menu.line, endLine: menu.endLine }); break;
        case "reveal": current.onRevealFile?.(choices?.absolute); break;
      }
      return;
    }
    switch (id) {
      case "copy-selection": void write(menu.selectionText); break;
      case "copy-code": void write(menu.code.text); break;
      case "open-link": current.onOpenLink?.(menu.link); break;
      case "copy-link": void write(menu.link); break;
      // rY: the rich text/plain + text/html payload of the footer Copy.
      case "copy-message": {
        let html = "";
        try { html = markdownToClipboardHtml(menu.text); } catch { html = ""; }
        void writeClipboardPayload(clipboardEnvironment(viewport), { text: menu.text, html });
        break;
      }
      case "copy-markdown": void write(menu.text); break;
      // S: a live selection of at least 2 characters wins over the message.
      case "attach": {
        const selection = viewport?.ownerDocument.getSelection();
        const selected = selection?.toString().trim() ?? "";
        if (attachableSelection(selected)) { selection.removeAllRanges(); current.onAttachText?.(selected); }
        else current.onAttachText?.(menu.text);
        break;
      }
    }
  }

  // cf74bc599 df: cmd+shift+L attaches a selection made inside the transcript.
  const canAttach = !!messageActions?.onAttachText;
  useEffect(() => {
    const viewport = scroll.viewportRef.current;
    if (!canAttach || !viewport) return undefined;
    const document = viewport.ownerDocument;
    const onKey = (event) => {
      if (event.defaultPrevented || event.repeat || event.altKey || !event.shiftKey || event.metaKey === event.ctrlKey
        || event.key.toLowerCase() !== "l" || event.target?.closest?.(EDITABLE)) return;
      const selection = document.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      for (let index = 0; index < selection.rangeCount; index += 1)
        if (!viewport.contains(selection.getRangeAt(index).commonAncestorContainer)) return;
      const text = selection.toString().trim();
      if (!attachableSelection(text)) return;
      event.preventDefault();
      selection.removeAllRanges();
      actions.current?.onAttachText?.(text);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [canAttach, sessionKey]);

  return (
    <SourceTableScope scopeKey={sessionKey}><div
      className="source-transcript-frame"
      data-following={scroll.following}
      data-scroll-fade={scroll.showFade}
    >
      <div
        ref={scroll.viewportRef}
        className="transcript supports-[animation-timeline:scroll()]:[--epitaxy-top-fade-height:32px]"
        {...interactionHandlers}
        {...feed.feedProps}
        onContextMenu={onContextMenu}
      >
        {feed.instructions}
        <div
          aria-hidden="true"
          data-testid="transcript-fade-top"
          className="scroll-fade-strip-top [--cds-scroll-fade-size:var(--epitaxy-top-fade-height)] [--cds-scroll-fade-strip-color:var(--epitaxy-transcript-surface,var(--cds-surface-1))]"
        />
        <div
          ref={scroll.contentRef}
          className="source-transcript-content"
          data-testid="transcript-sizer"
          data-transcript-spacing={sessionKey && ready ? "regular" : undefined}
        >
          {children}
          <div
            ref={scroll.endRef}
            className="source-transcript-end"
            aria-hidden="true"
            data-testid="transcript-end-sentinel"
          />
        </div>
        <div
          aria-hidden="true"
          data-testid="transcript-fade-bottom"
          className="scroll-fade-strip-bottom scroll-fade-size-[48px] [--cds-scroll-fade-strip-color:var(--epitaxy-transcript-surface,var(--cds-surface-1))]"
        />
      </div>
      {/* c360a9e1c-GPs-MV9u.js:3944-3978 od: the classic chip (os) for both
          states, jumping smoothly; the 'contents' wrapper forwards a wheel over
          the chip to the transcript. */}
      {sessionKey && (
        <div className="source-transcript-jump-wrap" onWheel={(event) => scroll.api.forwardWheel(event)}>
          <button
            type="button"
            className={`source-transcript-jump${pendingInput ? " source-transcript-needs-input" : ""}`}
            data-testid="jump-to-latest"
            data-visible={scroll.showJump}
            aria-label={
              pendingInput
                ? "Needs your input. Scroll to the request"
                : "Scroll to bottom"
            }
            aria-hidden={!scroll.showJump}
            inert={!scroll.showJump || undefined}
            tabIndex={scroll.showJump ? 0 : -1}
            onClick={() => scroll.api.jumpToLatest({ behavior: "smooth" })}
          >
            {pendingInput ? (
              <>
                <span className="source-transcript-input-dot" />
                Needs your input
                <Icon name="CaretDown" size={12} />
              </>
            ) : (
              <Icon name="CaretDown" size={12} />
            )}
          </button>
        </div>
      )}
      {menu && <SourceMenu.Popup anchor={scroll.viewportRef.current} point={menu.point} dataCds="ContextMenu" layer="contextmenu"
        label={menu.kind === "file" ? "File actions" : "Message actions"} onClose={() => setMenu(null)}>
        <MenuEntries entries={menu.entries} run={run} />
      </SourceMenu.Popup>}
    </div></SourceTableScope>
  );
});
