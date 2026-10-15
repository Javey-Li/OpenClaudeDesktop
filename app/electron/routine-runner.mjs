import { threadPermissionParams, turnPermissionParams } from './permission-policy.mjs';
import { surfaceInstructions } from './surface-policy.mjs';

export function captureRoutineOptions({ config, coreId, models, execution, previous }) {
  if (execution !== undefined && (!execution || typeof execution !== 'object' || Array.isArray(execution))) throw new Error('Choose valid execution settings.');
  if (previous && previous.coreId !== coreId) throw new Error(`Switch to ${previous.coreId} before changing this task’s execution settings.`);
  const chosenModel = execution?.model ?? previous?.model ?? config.model;
  const permission = execution?.permission ?? previous?.permission ?? config.permission ?? 'auto';
  if (!['auto', 'ask', 'acceptEdits', 'plan', 'bypass'].includes(permission)) throw new Error('Choose a valid permission mode.');
  const model = models.find(model => (model.model ?? model.id) === chosenModel)
    ?? (!chosenModel ? models.find(model => model.isDefault) ?? models[0] : null);
  if (!model) throw new Error('Choose an available model before creating a scheduled task.');
  return { coreId, model: model.model ?? model.id,
    effort: previous && previous.model === chosenModel ? previous.effort : model.defaultReasoningEffort ?? config.effort ?? null,
    permission, networkAccess: previous?.networkAccess ?? (config.sandboxNetworkAccess === true) };
}

// rpc is the same validated main-process pipeline used by the interactive composer.
// Never switch cores or silently substitute a different model for a saved routine.
export function createRoutineRunner({ context, rpc }) {
  return async (task, { attach, assertActive = () => {} }) => {
    const before = await context(task.options.coreId);
    const check = async () => {
      const current = await context(task.options.coreId);
      if (current.owner !== before.owner || current.coreId !== task.options.coreId)
        throw new Error(`Switch to ${task.options.coreId} to run this scheduled task.`);
      if (!current.models.some(model => (model.model ?? model.id) === task.options.model))
        throw new Error('The saved model is unavailable. Restore it before running this task.');
      return current;
    };
    const host = await check();
    const invoke = async (method, params) => {
      await check();
      assertActive();
      const result = await rpc({ method, params }, before.owner);
      if (result?.__codeDesktopRpcError) throw new Error(result.__codeDesktopRpcError.message);
      return result;
    };
    const permission = { mode: 'cowork', permission: task.options.permission,
      hints: host.hints, autoReview: host.autoReview };
    const start = await invoke('thread/start', {
      cwd: task.cwd, model: task.options.model,
      ...threadPermissionParams(permission),
      developerInstructions: surfaceInstructions('cowork'),
      codeDesktop: { ...threadPermissionParams(permission).codeDesktop, surface: 'cowork' },
    });
    const threadId = start?.thread?.id;
    if (!threadId) throw new Error('The core did not create a session.');
    attach(threadId);
    await invoke('thread/name/set', { threadId, name: task.name });
    const permissions = turnPermissionParams({ ...permission, cwd: task.cwd, networkAccess: task.options.networkAccess });
    const result = await invoke('turn/start', { threadId, cwd: task.cwd,
      model: task.options.model, effort: task.options.effort,
      input: [{ type: 'text', text: task.prompt }], ...permissions,
      codeDesktop: { ...permissions.codeDesktop, workflowTurn: { mode: 'cowork', permission: task.options.permission } },
    });
    return { threadId, turnId: result?.turn?.id };
  };
}
