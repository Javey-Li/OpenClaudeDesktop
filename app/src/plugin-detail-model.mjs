// 2.2553.1 c36b3644c _e: populated tabs, >5 item search, stable hook order.
// Adapt only fields actually reported by Codex plugin/read and skills/list.
import { MCP_STATUS_LABELS, customizeCore } from './customize-model.mjs';
const text = value => typeof value === 'string' ? value : '';
const list = value => Array.isArray(value) ? value : [];
// Tab descriptions come from customizeCore (Claude → DeepSeek); connector
// items resolve their title and status from the Customize mcp rows (c36b3644c
// fe: the server name, its status as the description, muted unless connected).
export function pluginDetailTabs(detail, pluginId, knownSkills = [], { descriptions = customizeCore().pluginTabDescriptions, mcpRows = [] } = {}) {
  if (!detail) return [];
  const skills = list(detail.skills).filter(skill => text(skill?.name)).map((skill, index) => {
    const matches = knownSkills.filter(row => row.pluginId === pluginId && (skill.path ? row.path === skill.path : row.skillName === skill.name));
    return { key: `skill:${index}`, name: skill.name, label: `/${skill.name}`, description: text(skill.description),
      disabled: skill.enabled === false, path: matches.length === 1 ? matches[0].path : null };
  });
  // A core that runs a plugin's servers under their own names and switches each (Kimi: plugin-<id>:<server>,
  // detail.mcpServerStates) names the connector by that runtime name and offers its switch.
  const states = list(detail.mcpServerStates);
  const connectors = list(detail.mcpServers).filter(name => text(name)).map((name, index) => {
    const state = states.find(entry => entry?.name === name);
    const connectorName = text(state?.runtimeName) || name;
    const row = list(mcpRows).find(entry => entry?.name === connectorName);
    return { key: `mcp:${index}`, name, label: text(row?.title) || name, description: row ? MCP_STATUS_LABELS[row.kind] ?? '' : state && state.enabled === false ? 'Off' : '', connected: row?.kind === 'connected', connectorName,
      ...(state && typeof state.enabled === 'boolean' ? { server: name, enabled: state.enabled } : {}) };
  });
  const hooks = list(detail.hooks).filter(hook => text(hook?.key)).map((hook, index) => ({ key: `hook:${index}`, name: hook.key, label: text(hook.eventName) || hook.key, description: text(hook.eventName) ? hook.key : '' }));
  // The plugin's own tools (OpenCode's plugin/read detail.tools [{name, description}]).
  const tools = list(detail.tools).filter(tool => text(tool?.name)).map((tool, index) => ({ key: `tool:${index}`, name: tool.name, label: tool.name, description: text(tool.description) }));
  const tabs = [
    { id: 'skills', label: 'Skills', description: descriptions.skills, items: skills },
    { id: 'connectors', label: 'Connectors', description: descriptions.connectors, items: connectors },
    { id: 'tools', label: 'Tools', description: descriptions.tools ?? '', items: tools },
    { id: 'hooks', label: 'Hooks', description: descriptions.hooks, items: hooks },
  ].filter(tab => tab.items.length);
  for (const tab of tabs) if (tab.id !== 'hooks') tab.items.sort((a,b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  return tabs;
}

export function pluginDetailView(tabs, selectedTab, query = '') {
  const tab = tabs.find(tab => tab.id === selectedTab) || tabs[0] || null;
  const searchable = !!tab && tab.items.length > 5;
  const term = searchable ? text(query).trim().toLowerCase() : '';
  const items = tab?.items.filter(item => !term || `${item.label}\n${item.name}\n${item.description || ''}`.toLowerCase().includes(term)) || [];
  return { tab, searchable, items };
}
