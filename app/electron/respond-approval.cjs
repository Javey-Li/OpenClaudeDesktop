// Synchronous desktop:call response mapper with exact bridge identity checks.
const { ApprovalTransportError } = require("./approval-transport.cjs");
const invalid = (message) => { throw new ApprovalTransportError("invalid_response", message); };
const DECISIONS = new Set(["accept", "decline", "cancel", "acceptForSession"]);
// harness questions.js PLAN_REVIEW; permission-policy.mjs afterPlanPermission targets.
const PLAN_REVIEW = "plan-review", PLAN_KEEP_PLANNING = "Keep planning";
const PLAN_TARGETS = new Set(["auto", "ask", "acceptEdits"]);

function approvalResponse(request, p) {
  const method = request.method;
  if (method === "item/commandExecution/requestApproval" || method === "item/fileChange/requestApproval") {
    if (!DECISIONS.has(p.decision)) invalid("Invalid decision.");
    return { decision: p.decision };
  }
  if (method === "item/permissions/requestApproval") {
    if (typeof p.allow !== "boolean") invalid("Choose allow or deny for this permission request.");
    return { permissions: p.allow ? request.params.permissions : {}, scope: "turn" };
  }
  if (method === "item/tool/requestUserInput") {
    const questions = request.params?.questions;
    if (!Array.isArray(questions) || !questions.length || !p.answers || typeof p.answers !== "object" || Array.isArray(p.answers))
      invalid("Answer each question before submitting.");
    const ids = new Set();
    for (const question of questions) {
      if (typeof question.id !== "string" || !question.id || ids.has(question.id)) invalid("The question IDs are invalid.");
      ids.add(question.id);
      // A skipped question (approval-current.js:7997-8008 q) is an absent key: the schema's
      // `answers: { [key in string]?: ToolRequestUserInputAnswer }` makes keys optional. A
      // present key keeps the full single-answer validation below.
      if (!Object.hasOwn(p.answers, question.id)) continue;
      const values = p.answers[question.id]?.answers;
      // The wire schema is an array. A single-choice/freeform question keeps the
      // one-answer local contract; a multiSelect question (the bridge's extension
      // field, approval-current.js:7911-7921) sends each chosen label once.
      const multi = question.multiSelect === true && question.options?.length > 0;
      // The DeepSeek plan review's Revise (approval-current.js Rse, R07) sends its
      // 'Keep planning' option followed by the feedback text.
      const revise = question.id === PLAN_REVIEW && question.isOther === true && values?.length === 2 && values[0] === PLAN_KEEP_PLANNING &&
        question.options?.some(option => option.label === values[0]) && !question.options.some(option => option.label === values[1]);
      if (!Array.isArray(values) || !values.length || (!multi && !revise && values.length !== 1) || new Set(values).size !== values.length ||
          values.some(value => typeof value !== "string" || !value.trim()))
        invalid("Answer each question before submitting.");
      if (question.options?.length && !question.isOther &&
          values.some(value => !question.options.some(option => option.label === value)))
        invalid("Choose an available answer.");
    }
    if (Object.keys(p.answers).some(id => !ids.has(id))) invalid("An answer belongs to an unknown question.");
    // codeDesktop.afterPlan (R07): the mode the plan card's accept continues in, only on
    // a plan review and never Bypass; the bridge prefers it over its turn hint.
    let extension;
    if (p.codeDesktop !== undefined) {
      if (!questions.some(question => question.id === PLAN_REVIEW) || !p.codeDesktop || typeof p.codeDesktop !== "object" ||
          Array.isArray(p.codeDesktop) || Object.keys(p.codeDesktop).some(key => key !== "afterPlan") || !PLAN_TARGETS.has(p.codeDesktop.afterPlan))
        invalid("Invalid plan approval.");
      extension = { codeDesktop: { afterPlan: p.codeDesktop.afterPlan } };
    }
    return { answers: Object.fromEntries(questions.filter(question => Object.hasOwn(p.answers, question.id))
      .map(question => [question.id, { answers: [...p.answers[question.id].answers] }])), ...extension };
  }
  invalid(`Unsupported request: ${method}`);
}

function respondToApproval(owner, p) {
  try {
    const request = owner.getApproval(p.id, p.expected);
    const result = approvalResponse(request, p);
    const identity = owner.respond(p.id, result, p.expected);
    return { ok: true, identity };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: error instanceof ApprovalTransportError ? error.code : "transport_error",
        // Do not include p, result, answers, JSON payloads, or connection objects.
        message: error instanceof ApprovalTransportError ? error.message : "Could not send the approval response.",
      },
    };
  }
}
module.exports = { approvalResponse, respondToApproval };
