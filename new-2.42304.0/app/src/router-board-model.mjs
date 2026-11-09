// Router board (personal super agent): sorts what the per-project routers know into
// three columns — what needs the owner's call, what is done, what is stuck.
// Input is the personal-super-agent store (data/state.json) plus optional live PR
// rows per repo; every field is optional so the board keeps working while the
// store's shape evolves.

const list = (value) => (Array.isArray(value) ? value : []);
const text = (value) => (typeof value === "string" ? value.trim() : "");
const time = (value) => {
  const at = Date.parse(value ?? "");
  return Number.isFinite(at) ? at : 0;
};

const DONE_STATES = new Set(["done", "merged", "closed", "completed", "resolved"]);
const STUCK_STATES = new Set(["blocked", "stuck", "failed", "error"]);
const DECIDE_ROUTER = new Set(["needs_human", "needs_owner", "ask_owner"]);

function projectName(projects, id) {
  return projects.get(id)?.name || id || "";
}

function eventLabel(event) {
  if (!event || typeof event !== "object") return "";
  const kind = event.kind === "pr" ? "PR" : event.kind === "issue" ? "Issue" : text(event.kind);
  return event.number != null ? `${kind} #${event.number}` : kind;
}

function failingChecks(ci) {
  return list(ci?.failing).map((check) => text(check?.name)).filter(Boolean);
}

export function buildRouterBoard(state = {}, live = {}) {
  const projects = new Map(list(state.projects).map((project) => [project?.id, project]));
  const decide = [], done = [], stuck = [];
  const seen = new Set();
  const push = (column, item) => {
    if (!item.id || seen.has(item.id)) return;
    seen.add(item.id);
    column.push(item);
  };

  for (const item of list(state.workItems)) {
    const status = text(item?.status).toLowerCase();
    const row = {
      id: `work:${item?.id}`,
      project: projectName(projects, item?.projectId),
      title: text(item?.title) || eventLabel(item?.ref) || text(item?.id),
      detail: text(item?.summary) || text(item?.reason),
      who: text(item?.assignee) || text(item?.worker),
      at: time(item?.updatedAt || item?.createdAt),
    };
    if (DONE_STATES.has(status)) push(done, row);
    else if (STUCK_STATES.has(status)) push(stuck, row);
    else if (status === "needs_owner" || status === "needs_human") push(decide, row);
  }

  for (const decision of list(state.decisions)) {
    const failing = failingChecks(decision?.ci);
    const label = eventLabel(decision?.event);
    const base = {
      project: projectName(projects, decision?.projectId),
      at: time(decision?.createdAt || decision?.at),
    };
    if (failing.length) {
      push(stuck, { ...base, id: `ci:${decision?.event?.repo}:${label}`, title: label, detail: `检查没过：${failing.join("、")}` });
    } else if (DECIDE_ROUTER.has(text(decision?.router))) {
      push(decide, { ...base, id: `decision:${decision?.id}`, title: label || text(decision?.action), detail: text(decision?.reason) });
    }
  }

  for (const entry of list(state.baseline)) {
    if (text(entry?.status) && text(entry?.status) !== "active") continue;
    const row = {
      id: `baseline:${entry?.id}`,
      project: projectName(projects, entry?.projectId),
      title: text(entry?.title),
      detail: text(entry?.claim),
      who: text(entry?.whoSaidLabel),
      at: time(entry?.lastVerified || entry?.createdAt),
    };
    if (entry?.type === "OpenQuestion") push(decide, row);
    else if (entry?.type === "Failure") push(stuck, row);
  }

  for (const run of list(state.runs)) {
    const status = text(run?.status).toLowerCase();
    const row = {
      id: `run:${run?.id}`,
      project: projectName(projects, run?.projectId),
      title: text(run?.title) || text(run?.id),
      detail: text(run?.summary),
      who: text(run?.worker),
      at: time(run?.finishedAt || run?.updatedAt),
    };
    if (DONE_STATES.has(status)) push(done, row);
    else if (STUCK_STATES.has(status)) push(stuck, row);
  }

  for (const [repo, rows] of Object.entries(live || {})) {
    const project = [...projects.values()].find((entry) => entry?.repo === repo);
    for (const pr of list(rows)) {
      const failing = failingChecks(pr?.ci);
      if (!failing.length) continue;
      push(stuck, {
        id: `ci:${repo}:PR #${pr?.number}`,
        project: project?.name || repo,
        title: `PR #${pr?.number}`,
        detail: `${text(pr?.title)}；检查没过：${failing.join("、")}`,
        at: 0,
      });
    }
  }

  const newest = (a, b) => b.at - a.at;
  return { decide: decide.sort(newest), done: done.sort(newest), stuck: stuck.sort(newest) };
}

export const ROUTER_COLUMNS = Object.freeze([
  { key: "decide", title: "要你定的", empty: "没有要你定的事。" },
  { key: "done", title: "做完的", empty: "还没有做完的事。" },
  { key: "stuck", title: "卡住的", empty: "没有卡住的事。" },
]);
