import {showsThinking} from './transcript-view-model.mjs';

export function reasoningText(item) {
  return (item?.summary || []).map(part => typeof part === 'string' ? part : part.text || '').join('\n') || item?.reasoningText || '';
}

// Visibility must be resolved before segmentation as well as rendering.
// Keep these items in the presentation list for real turn-footer anchors.
export function isHiddenTranscriptItem(item, view = 'normal') {
  if (item.type === 'reasoning') return !showsThinking(view) || !reasoningText(item).trim();
  if (item.type === 'agentMessage' || item.type === 'plan') return !(item.text || '').trim();
  return false;
}
