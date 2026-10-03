// Codex 0.155.1: thread uses SandboxMode; turn uses the tagged SandboxPolicy.
// acceptEdits (shared-14-BOJVa-jT.js:10259-10273 nE local list) is Manual's
// untrusted policy plus the DeepSeek mode hint: the bridge lets workspace
// write/edit calls through and still asks for commands (approval.js acceptsEdit).
// Codex has no such policy, so there it behaves as Manual.
export const PERMISSION_MODES = Object.freeze(['auto', 'ask', 'acceptEdits', 'plan', 'bypass']);
const AFTER_PLAN = Object.freeze(['auto', 'ask', 'acceptEdits', 'bypass']);
// hints (DeepSeek core only; Codex never receives the field): a read-only
// sandbox alone cannot tell Plan from chat or review, so the bridge also gets
// the mode and the permission an approved plan continues with (afterPlan).
export function threadPermissionParams({ permission = 'auto', mode = 'code', review = false, hints = false, afterPlan = 'auto' } = {}) {
  if (!PERMISSION_MODES.includes(permission) || !['code', 'chat'].includes(mode)) throw new Error('Choose a valid permission mode.');
  const readOnly = review || mode === 'chat' || permission === 'plan';
  const bypass = permission === 'bypass' && !readOnly;
  return { approvalsReviewer: 'user', approvalPolicy: bypass ? 'never' : permission === 'ask' || permission === 'acceptEdits' ? 'untrusted' : 'on-request',
    sandbox: readOnly ? 'read-only' : bypass ? 'danger-full-access' : 'workspace-write',
    ...(hints === true ? { codeDesktop: { permissionMode: hintedMode({ permission, mode, review }), afterPlan: AFTER_PLAN.includes(afterPlan) ? afterPlan : 'auto' } } : {}) };
}
function hintedMode({ permission, mode, review }) {
  if (permission === 'plan' && mode === 'code' && !review) return 'plan';
  return review ? 'review' : mode === 'chat' ? 'chat' : permission;
}
// The DeepSeek plan review (exit_plan_mode, question id 'plan-review') was
// approved with its 'Approve' option: the request's single answer is exactly that.
export const PLAN_REVIEW_QUESTION = 'plan-review';
export function approvesPlan(request, payload) {
  if (request?.method !== 'item/tool/requestUserInput') return false;
  if (!request.params?.questions?.some?.(question => question?.id === PLAN_REVIEW_QUESTION)) return false;
  const values = payload?.answers?.[PLAN_REVIEW_QUESTION]?.answers;
  return Array.isArray(values) && values.length === 1 && values[0] === 'Approve';
}
// The permission an approved plan continues with: the one used before Plan,
// except Bypass, which keeps needing its own confirmation (as the bridge does).
export const afterPlanPermission = afterPlan => afterPlan === 'ask' || afterPlan === 'acceptEdits' ? afterPlan : 'auto';
// The plan card (R07, approval-current.js Rse) names its target on the response
// (codeDesktop.afterPlan: Accept → 'ask', the primary → the trust-forward mode),
// which wins over the remembered mode; null when the response did not approve.
export function approvedPlanPermission(request, payload, afterPlan) {
  if (!approvesPlan(request, payload)) return null;
  const chosen = payload?.codeDesktop?.afterPlan;
  return afterPlanPermission(chosen === 'auto' || chosen === 'ask' || chosen === 'acceptEdits' ? chosen : afterPlan);
}
export function turnPermissionParams({ cwd, additionalFolders = [], ...options } = {}) {
  const { sandbox, ...base } = threadPermissionParams(options);
  return { ...base, sandboxPolicy: sandbox === 'danger-full-access' ? { type: 'dangerFullAccess' }
    : sandbox === 'read-only' ? { type: 'readOnly', networkAccess: false }
    : { type: 'workspaceWrite', writableRoots: [cwd, ...additionalFolders], networkAccess: false, excludeTmpdirEnvVar: false, excludeSlashTmp: false } };
}
export function requestsBypass(params) {
  return params?.sandbox === 'danger-full-access' || params?.sandboxPolicy?.type === 'dangerFullAccess';
}
export function bypassAvailability(response) {
  if (!response || !Object.hasOwn(response, 'requirements')) return { allowed: false, reason: 'Permission requirements are unavailable. Reconnect and try again.' };
  const requirements = response.requirements;
  if (requirements !== null && (typeof requirements !== 'object' || Array.isArray(requirements))) return { allowed: false, reason: 'Permission requirements are unavailable. Reconnect and try again.' };
  for (const [key, value] of [['allowedSandboxModes', 'danger-full-access'], ['allowedApprovalPolicies', 'never']]) {
    const allowed = requirements?.[key];
    if (allowed != null && (!Array.isArray(allowed) || !allowed.includes(value))) return { allowed: false, reason: 'Bypass permissions is disabled by your organization.' };
  }
  return { allowed: true, reason: '' };
}
export async function validateBypassRequest(params, config, readRequirements) {
  if (!requestsBypass(params)) return;
  const checkOptIn = () => { if ((typeof config === 'function' ? config() : config)?.allowBypassPermissions !== true) throw new Error('Turn on Allow bypass permissions mode in Settings first.'); };
  checkOptIn();
  const availability = bypassAvailability(await readRequirements());
  checkOptIn();
  if (!availability.allowed) throw new Error(availability.reason);
}
