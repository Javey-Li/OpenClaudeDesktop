// wi.Timestamp (scroll-shared-10-current.js:14983 AO over pO 14518) as used by
// OY (scroll-messages-current.js:33857): <time data-cds="RelativeTime"> in a
// top tooltip (hoverable false) whose content is the absolute fO string. Not
// focusable, so it never joins the MessageActions roving order.
import React, { useSyncExternalStore } from 'react';
import { SourceTooltip } from './source-tooltip.jsx';
import { DEFAULT_LOCALE, relativeClock, timestampView } from './relative-time-model.mjs';
import './source-timestamp.css';

export function SourceTimestamp({ dateMs, locale = DEFAULT_LOCALE, clock = relativeClock, className = '' }) {
  const snapshot = useSyncExternalStore(clock.subscribe, clock.getSnapshot, clock.getServerSnapshot);
  const view = timestampView(dateMs, snapshot, locale);
  const time = <time data-cds="RelativeTime" dateTime={view.iso} className={`source-timestamp ${className}`.trim()}>{view.text}</time>;
  return view.title ? <SourceTooltip content={view.title} side="top" hoverable={false}>{time}</SourceTooltip> : time;
}
