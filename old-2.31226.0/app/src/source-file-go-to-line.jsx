import React, { useLayoutEffect, useRef, useState } from 'react';
import { Icon } from './icons';
import { SourceTooltip } from './source-tooltip';
import { parseEditorLocation, goToLineShortcut } from './file-editor-commands.mjs';
import { t } from '../electron/i18n/index.mjs';

// Original cd2efac6e so: a compact subheader, not a modal. Escape restores
// editor focus; clicking elsewhere dismisses without stealing that focus.
export function SourceFileGoToLine({ caret, onGo, onClose }) {
  const [query, setQuery] = useState('');
  const input = useRef(null);
  const location = parseEditorLocation(query), invalid = query.trim().length > 0 && !location;
  useLayoutEffect(() => { input.current?.focus(); }, []);
  return <div className="sfv-find sfv-go-to-line" data-go-to-line=""
    onMouseDown={event => { if (event.target !== input.current) event.preventDefault(); }}
    onBlur={event => { if (event.currentTarget.ownerDocument.hasFocus() && !event.currentTarget.contains(event.relatedTarget)) onClose(false); }}
    onKeyDown={event => {
      if (event.nativeEvent.isComposing) return;
      if (goToLineShortcut(event)) { event.preventDefault(); event.stopPropagation(); input.current?.select(); }
      else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(true); }
    }}>
    <input ref={input} className="sfv-find-input" aria-label={t('Go to line')} placeholder={t('Line, or line:column')}
      aria-invalid={invalid || undefined} spellCheck={false} autoComplete="off" value={query}
      onChange={event => setQuery(event.target.value)} onKeyDown={event => {
        if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); if (location) onGo(location.line, location.column); }
      }} />
    <span className="sfv-find-status" aria-live="polite">{invalid ? t('Type a line number from 1 to {lines}', { lines: String(caret.lines) }) : t('Line {line} of {lines}', { line: String(caret.line), lines: String(caret.lines) })}</span>
    <SourceTooltip content={t('Close go to line bar')} shortcut="esc" hoverable={false}>
      <button type="button" className="source-icon-button sfv-find-button" aria-label={t('Close go to line bar')} onClick={() => onClose(true)}><Icon name="X" size={16} /></button>
    </SourceTooltip>
  </div>;
}
