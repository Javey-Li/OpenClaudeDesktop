// customCommands preference (C3). Pure and renderer-safe: no node:* imports.
// The command files live on disk (<globalDir || userData/commands>/*.md and
// <project>/.code-desktop/commands/*.md); only the folder choice and the
// project switch are preferences.
export const CUSTOM_COMMANDS_DEFAULT = Object.freeze({ globalDir: '', projectEnabled: true });
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const absolute = value => typeof value === 'string' && value.startsWith('/') && value.length <= 1024 && !/[\x00]/.test(value);

export function normalizeCustomCommands(value) {
  if (!object(value)) return { ...CUSTOM_COMMANDS_DEFAULT };
  return {
    globalDir: absolute(value.globalDir) ? value.globalDir : '',
    projectEnabled: value.projectEnabled !== false,
  };
}

export function validateCustomCommands(value) {
  if (value === null) return null;
  if (!object(value)) throw new Error('Invalid custom commands setting.');
  const { globalDir = '', projectEnabled = true } = value;
  if (typeof globalDir !== 'string' || (globalDir !== '' && !absolute(globalDir)))
    throw new Error('Choose an absolute folder for your commands.');
  if (typeof projectEnabled !== 'boolean') throw new Error('Invalid project commands setting.');
  return { globalDir, projectEnabled };
}
export { CUSTOM_COMMANDS_DEFAULT as DEFAULT, normalizeCustomCommands as normalize, validateCustomCommands as validate };
