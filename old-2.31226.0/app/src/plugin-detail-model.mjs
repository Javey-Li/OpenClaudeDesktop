// 2.2553.1 c36b3644c _e: populated tabs, >5 item search, stable hook order.
// Adapt only fields actually reported by Codex plugin/read and skills/list.
// 2.31226.0 c24c8737b (:5277-5440 tabs Skills / Commands / Connectors / Hooks / Monitors / Agents) and c99ed1520
// (:380-455 agent / monitor items): a plugin's commands are its plugin/read skills of type "command" (Aa) or a
// reported `commands` list, agents and monitors are listed when plugin/read reports them.
import { MCP_STATUS_LABELS, customizeCore } from './customize-model.mjs';
import { t } from '../electron/i18n/index.mjs';
const text = value => typeof value === 'string' ? value : '';
const list = value => Array.isArray(value) ? value : [];
// cd0c65b43 c / l: a monitor's label (its name, else "Monitor {number}") and when it starts.
const ON_SKILL_INVOKE = 'on-skill-invoke:';
export function monitorLabel(monitor, index) {
  return text(monitor?.name).trim() || t('Monitor {number}', { number: index + 1 });
}
export function monitorWhen(when) {
  if (when === undefined || when === null || when === 'always') return t('Every session, from session start');
  if (typeof when === 'string' && when.startsWith(ON_SKILL_INVOKE) && when.slice(ON_SKILL_INVOKE.length))
    return t('When the {skill} skill is first invoked', { skill: when.slice(ON_SKILL_INVOKE.length) });
  return text(when);
}
// Tab descriptions come from customizeCore (Claude → DeepSeek); connector
// items resolve their title and status from the Customize mcp rows (c36b3644c
// fe: the server name, its status as the description, muted unless connected).
export function pluginDetailTabs(detail, pluginId, knownSkills = [], { descriptions = customizeCore().pluginTabDescriptions, mcpRows = [] } = {}) {
  if (!detail) return [];
  const isCommand = skill => skill?.type === 'command';
  const skillItem = (skill, index, prefix) => {
    const matches = knownSkills.filter(row => row.pluginId === pluginId && (skill.path ? row.path === skill.path : row.skillName === skill.name));
    return { key: `${prefix}:${index}`, name: skill.name, label: `/${skill.name}`, description: text(skill.description),
      disabled: skill.enabled === false, path: matches.length === 1 ? matches[0].path : null };
  };
  const reported = list(detail.skills).filter(skill => text(skill?.name));
  const skills = reported.filter(skill => !isCommand(skill)).map((skill, index) => skillItem(skill, index, 'skill'));
  // ccea1f474 Ks(e, "/"): commands read as /name; a command has no SKILL.md to open.
  const commands = [...reported.filter(isCommand), ...list(detail.commands).filter(command => text(command?.name))]
    .map((command, index) => ({ key: `command:${index}`, name: command.name, label: `/${command.name}`, description: text(command.description), disabled: command.enabled === false, path: null }));
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
  // c99ed1520 ve: the agent's description, else "Model: {model}".
  const agents = list(detail.agents).filter(agent => text(agent?.name)).map((agent, index) => ({ key: `agent:${index}`, name: agent.name, label: agent.name,
    description: text(agent.description) || (text(agent.model) ? t('Model: {model}', { model: agent.model }) : '') }));
  // c99ed1520 xe / cd0c65b43 f: label, then when it runs (with its description) and the command.
  const monitors = list(detail.monitors).filter(monitor => monitor && typeof monitor === 'object').map((monitor, index) => {
    const when = monitorWhen(monitor.when);
    return { key: `monitor:${index}`, name: monitorLabel(monitor, index), label: monitorLabel(monitor, index),
      description: text(monitor.description) ? `${when} (${monitor.description})` : when, command: text(monitor.command) };
  });
  const tabs = [
    { id: 'skills', label: 'Skills', description: descriptions.skills, items: skills },
    { id: 'commands', label: 'Commands', description: descriptions.commands ?? '', items: commands },
    { id: 'connectors', label: 'Connectors', description: descriptions.connectors, items: connectors },
    { id: 'tools', label: 'Tools', description: descriptions.tools ?? '', items: tools },
    { id: 'hooks', label: 'Hooks', description: descriptions.hooks, items: hooks },
    { id: 'monitors', label: 'Monitors', description: descriptions.monitors ?? '', items: monitors },
    { id: 'agents', label: 'Agents', description: descriptions.agents ?? '', items: agents },
  ].filter(tab => tab.items.length);
  // Hooks and monitors keep the plugin's order (the source lists them as declared).
  for (const tab of tabs) if (tab.id !== 'hooks' && tab.id !== 'monitors') tab.items.sort((a,b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  return tabs;
}

export function pluginDetailView(tabs, selectedTab, query = '') {
  const tab = tabs.find(tab => tab.id === selectedTab) || tabs[0] || null;
  const searchable = !!tab && tab.items.length > 5;
  const term = searchable ? text(query).trim().toLowerCase() : '';
  const items = tab?.items.filter(item => !term || `${item.label}\n${item.name}\n${item.description || ''}`.toLowerCase().includes(term)) || [];
  return { tab, searchable, items };
}
