import { isHiddenTranscriptItem } from './transcript-item-visibility.mjs';

// scroll-messages-current.js:44440-44448 B2: the "Copy as quote" payload, a
// Markdown quote headed by a ~4-characters-per-token estimate.
export function thinkingQuote(text) {
  const value = typeof text === 'string' ? text : '';
  return `> **Thinking** (~${Math.round(value.length / 4)} tok)\n>\n${value.split('\n').map(line => line.length > 0 ? `> ${line}` : '>').join('\n')}`;
}

// Rows the source splits a tool run at (i8/u8 :53030-53060, :53187-53196):
// tool items and the local grouped tool card.
const TOOL_ROWS = new Set(['commandExecution', 'fileChange', 'webSearch', 'mcpToolCall', 'dynamicToolCall', 'collabAgentToolCall', 'imageView', 'fileToolGroup']);

/** 'preceding-tools' when the thought belongs to the next tool call (the
 * source's precedingThinking, rendered as an open "Thought process" step),
 * otherwise 'standalone' (the classic U2 italic block). Hidden rows and
 * further thoughts in between are skipped, so consecutive thoughts before a
 * tool all precede it; another turn, prose or the end of the list do not. */
export function reasoningPlacement(items, index, view = 'thinking') {
  const turnId = items[index]?.turnId;
  for (let at = index + 1; at < items.length; at++) {
    const next = items[at];
    if (next.type === 'subAgentActivity' || isHiddenTranscriptItem(next, view) || next.type === 'reasoning') {
      if (next.turnId !== turnId && next.type !== 'subAgentActivity') return 'standalone';
      continue;
    }
    return next.turnId === turnId && TOOL_ROWS.has(next.type) ? 'preceding-tools' : 'standalone';
  }
  return 'standalone';
}
