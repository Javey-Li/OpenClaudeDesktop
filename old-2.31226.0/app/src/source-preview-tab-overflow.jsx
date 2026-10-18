import React, { useId, useLayoutEffect, useRef } from 'react';
import { createPreviewOverflowRow } from './generated/code-editor/preview-tab-overflow.mjs';
import { SourceMenu } from './source-menu.jsx';
import { SourceTooltip, textOverflows } from './source-tooltip.jsx';
import { Icon } from './icons';
import { t } from '../electron/i18n/index.mjs';

function OverflowText({ children, ...props }) {
  const text = useRef(null);
  return <SourceTooltip {...props} content={() => textOverflows(text.current, { subpixel: true }) ? children : undefined}>
    <span ref={text} className="block min-w-0 truncate">{children}</span>
  </SourceTooltip>;
}
const { Row, sizes, typeaheadResetKeys } = createPreviewOverflowRow({
  Item: SourceMenu.Item,
  Icon: ({ name }) => <Icon name={name} size={12} />,
  OverflowTooltip: OverflowText,
});

// The shared strip's overflow menu (cfe7c4b3b ae): Preview passes its own labels by default; the terminal strip
// (cccc2cf0a Zg) passes "More terminals" / "Close terminal" / its delete hint.
export function SourcePreviewTabOverflow({ anchor, tabs, onActivate, onCloseTab, onClose, initialHighlight, labels = null, className = 'spv-overflow-menu' }) {
  const copy = labels ?? { moreTabs: t('More tabs'), closeTab: t('Close tab'), closeTabHint: t('press right arrow to close'), closeTabDeleteHint: t('Press Delete or Backspace to close the tab') };
  const hint = useId(), deleteHint = useId(), typed = useRef(false), rows = useRef(null), pendingFocus = useRef(null);
  const closeTab = id => {
    const focused = rows.current?.ownerDocument.activeElement?.closest('[data-preview-overflow-id]');
    if (focused?.dataset.previewOverflowId === id) pendingFocus.current = { id, index: tabs.findIndex(tab => tab.id === id) };
    onCloseTab(id);
  };
  useLayoutEffect(() => {
    const pending = pendingFocus.current;
    if (!pending || tabs.some(tab => tab.id === pending.id)) return;
    pendingFocus.current = null;
    const items = rows.current?.querySelectorAll('[role="menuitem"]');
    const next = items?.[Math.min(pending.index, items.length - 1)];
    // Local menu primitive keeps its highlighted state after removal; restore
    // DOM focus too so a second keyboard action stays in this source menu.
    next?.focus({ preventScroll: true });
  }, [tabs]);
  return <SourceMenu.Popup anchor={anchor} side="bottom" align="end" label={copy.moreTabs} className={className}
    initialHighlight={initialHighlight} onClose={onClose}>
    <div ref={rows} onContextMenu={event => event.preventDefault()} onKeyDownCapture={event => {
      // Original ae: after typeahead, the first Backspace clears that gesture;
      // a fresh close key is required to remove a tab.
      if (event.key === 'Backspace' && typed.current) {
        event.preventDefault();event.stopPropagation();typed.current = false;
      } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) typed.current = true;
      else if (typeaheadResetKeys.has(event.key)) typed.current = false;
    }}>
      <span id={hint} className="source-sr-only">{copy.closeTabHint}</span>
      <span id={deleteHint} className="source-sr-only">{copy.closeTabDeleteHint}</span>
      {tabs.map(tab => <div key={tab.id} data-preview-overflow-id={tab.id}>
        <Row tab={tab} sizes={sizes} hintIds={`${hint} ${deleteHint}`}
          closeLabel={copy.closeTab} onActivate={onActivate} onClose={closeTab} />
      </div>)}
    </div>
  </SourceMenu.Popup>;
}
