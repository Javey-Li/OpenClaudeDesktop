// Stuck-column hygiene for the 总管 board.
//
// A stuck row is only worth the owner's attention while it is current. Pilot
// workspaces, test pings, recovered sources and turns that have gone quiet all
// stay readable, but move to a folded "已过去" list instead of sitting beside
// live blockers. Pure and time-injected so the rules are testable.

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const STUCK_TTL_HOURS = 12;

const text = (value) => (typeof value === "string" ? value.trim() : "");
const time = (value) => {
  const at = Date.parse(value ?? "");
  return Number.isFinite(at) ? at : 0;
};

const PATTERNS = Object.freeze({
  test: [
    /T3_MCP_REQUIRED_FOR_WORKTREE/i,
    /^reply with exactly/i,
    /FULL_ACCESS_OK/i,
    /^noop\b/i,
    /链路测试/i,
    /smoke test/i,
    /PSA report protocol/i,
  ],
  pilot: [
    /\/private\/tmp\//i,
    /(^|\s)\/tmp\//i,
    /fretsense-batch1/i,
  ],
  review: [
    /只读复核/,
    /独立只读审查/,
    /独立复核/,
    /复核结论/,
    /旧复核/,
  ],
});

function pastReasonFor(row, age) {
  const haystack = `${text(row.title)} ${text(row.detail)}`;
  if (row.recovered === true) return { kind: "recovered", reason: "来源已恢复" };
  if (PATTERNS.test.some((pattern) => pattern.test(haystack))) return { kind: "test", reason: "测试记录" };
  if (PATTERNS.pilot.some((pattern) => pattern.test(haystack))) return { kind: "pilot", reason: "试点临时目录" };
  if (age >= 6 * HOUR && PATTERNS.review.some((pattern) => pattern.test(haystack))) {
    return { kind: "review", reason: "旧复核记录" };
  }
  return null;
}

export function splitStuck(rows = [], { now = new Date().toISOString(), ttlHours = STUCK_TTL_HOURS } = {}) {
  const at = time(now);
  const active = [];
  const past = [];
  for (const row of rows) {
    const stamp = time(row.at);
    const age = stamp ? Math.max(0, at - stamp) : 0;
    const hit = pastReasonFor(row, age);
    if (!hit && age >= ttlHours * HOUR) {
      const reason = age >= DAY
        ? `${Math.floor(age / DAY)} 天没有新事件`
        : `${Math.max(1, Math.floor(age / HOUR))} 小时没有新事件`;
      past.push({ ...row, pastKind: "expired", pastLabel: "已过去", pastReason: reason });
    } else if (hit) {
      past.push({ ...row, pastKind: hit.kind, pastLabel: hit.kind === "recovered" ? "已恢复" : "已过去", pastReason: hit.reason });
    } else {
      active.push(row);
    }
  }
  past.sort((a, b) => time(b.at) - time(a.at));
  return {
    active,
    past,
    summary: {
      active: active.length,
      past: past.length,
      recovered: past.filter((row) => row.pastKind === "recovered").length,
      expired: past.filter((row) => row.pastKind === "expired").length,
      tests: past.filter((row) => row.pastKind === "test").length,
    },
  };
}

export function cleanBoardTitle(value) {
  let title = text(value)
    .replace(/^@+/, "")
    .replace(/^(?:标题[:：]\s*)+/, "")
    .trim();
  title = title.replace(/@?标题[:：]\s*/g, "").replace(/\s+/g, " ").trim();
  // Codex titles can arrive as "A@标题：A". Keep one copy when the halves match exactly.
  if (title.length > 16) {
    const repeated = /^(.{6,}?)[@\s]*(?:标题[:：]\s*)?\1$/.exec(title);
    if (repeated) title = repeated[1].trim();
    const leadingCopy = /^(.{6,}?)\s+\1(?=\s|$)/.exec(title);
    if (leadingCopy) title = title.slice(leadingCopy[1].length).trim();
  }
  return title.replace(/^[“"](.*)[”"]$/, "$1").trim();
}
