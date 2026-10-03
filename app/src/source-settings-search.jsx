import React from 'react';
import { Icon } from './icons.jsx';
import { settingsMatchRange } from './settings-model.mjs';

function Match({ text, query }) {
  const match = settingsMatchRange(text, query);
  if (!match) return text;
  return <>{text.slice(0, match.start)}<span className="ss-search-match">{text.slice(match.start, match.end)}</span>{text.slice(match.end)}</>;
}

// cc011544b gt:720–830: section + optional via, indented child, or +N more.
// The parent label always identifies the destination; a solitary row is its
// subtitle, not an ungrouped replacement for the section.
export function SettingsSearchResults({ results, query, active, onSelect, onActive }) {
  return <div className="ss-search-results" aria-label="Settings search results">
    {results.length ? results.map((result, index) => {
      const label = result.kind === 'more'
        ? `${result.count} more ${result.count === 1 ? 'match' : 'matches'} in ${result.section}`
        : result.id ? `${result.label} in ${result.section}` : result.section;
      return <button type="button" key={result.key} data-kind={result.kind}
        data-highlighted={index === active ? '' : undefined} aria-label={label}
        onMouseDown={event => event.preventDefault()} onMouseMove={() => onActive(index)} onClick={() => onSelect(result)}>
        {result.kind === 'hit' ? <span className="ss-search-hit">
          <span className="ss-search-heading"><Icon name={result.icon || 'Settings'} size={20}/><span><Match text={result.section} query={query}/></span></span>
          {result.via && <span className="ss-search-via"><Match text={result.via} query={query}/></span>}
        </span> : <span className="ss-search-child">{result.kind === 'child' ? <Match text={result.label} query={query}/> : `+${result.count} more`}</span>}
      </button>;
    }) : <div className="ss-search-empty"><Icon name="SearchCircle" size={28}/><span>No matching settings</span></div>}
  </div>;
}
