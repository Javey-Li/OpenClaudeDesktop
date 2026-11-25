const text = (value) => (typeof value === "string" ? value.trim() : "");

export const MORNING_BRIEF_SECTIONS = Object.freeze([
  { key: "done", title: "昨天做完了什么", state: "done" },
  { key: "blocked", title: "卡在哪", state: "stuck" },
  { key: "decide", title: "要你定什么", state: "decide" },
  { key: "today", title: "今天会做什么", state: "running" },
]);

export function tokyoDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function briefDateLabel(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text(value));
  return match ? `${Number(match[2])}月${Number(match[3])}日` : text(value);
}

function markerState(marker) {
  if (/^(?:\[[xX]\]|✅|✔|✓|完成|已做)$/.test(marker)) return "done";
  if (/^(?:\[\s\]|⬜|○|待做|今天)$/.test(marker)) return "running";
  if (/^(?:⚠️|⚠|❌|失败|卡住)$/.test(marker)) return "stuck";
  if (/^(?:❓|\?|要定|等你定)$/.test(marker)) return "decide";
  return "";
}

function cleanItem(value) {
  return text(value)
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

export function parseMorningBrief(markdown, { expectedDate = "" } = {}) {
  const source = String(markdown ?? "");
  const heading = /^#\s+(\d{4}-\d{2}-\d{2})\s+早报\s*$/m.exec(source)?.[1] ?? "";
  if (!heading) return { status: "error", date: expectedDate, sections: [], error: "早报开头没有日期。" };
  const lines = source.split(/\r?\n/);
  const sections = [];
  let current = null;
  let lastItem = null;
  for (const line of lines) {
    const section = MORNING_BRIEF_SECTIONS.find((entry) => new RegExp(`^##\\s+${entry.title}\\s*$`).test(line.trim()));
    if (section) {
      current = { ...section, lines: [] };
      sections.push(current);
      lastItem = null;
      continue;
    }
    if (/^##\s+/.test(line.trim())) {
      current = null;
      lastItem = null;
      continue;
    }
    if (!current) continue;
    const item = /^\s*[-*+]\s+(.+)$/.exec(line);
    if (item) {
      const body = cleanItem(item[1]);
      if (body === "没有") continue;
      const marker = /^(\[[xX\s]\]|✅|✔|✓|⬜|○|⚠️|⚠|❌|❓|\?|完成|已做|待做|今天|失败|卡住|要定|等你定)\s*/.exec(body)?.[1] ?? "";
      const value = cleanItem(body.slice(marker.length));
      if (!value) continue;
      lastItem = { text: value, marker, state: markerState(marker) || current.state };
      current.lines.push(lastItem);
      continue;
    }
    if (lastItem && /^\s+/.test(line)) lastItem.text = `${lastItem.text} ${cleanItem(line)}`;
  }
  if (sections.length !== MORNING_BRIEF_SECTIONS.length) {
    return { status: "error", date: heading, sections, error: "早报的四段标题没读全。" };
  }
  return {
    status: expectedDate && heading !== expectedDate ? "stale" : "ready",
    date: heading,
    sections,
    error: "",
  };
}

export function buildMorningBriefReport(brief, fallback) {
  const date = briefDateLabel(brief?.date);
  if (brief?.status !== "ready") {
    const notice = brief?.status === "stale" ? `早报是 ${date} 的，不是今天`
      : brief?.status === "error" ? `早报没读好：${text(brief.error) || "格式不认识"}`
        : `早报是 ${date} 的 · 没有文件`;
    return { ...fallback, briefDateLabel: "", briefNotice: notice };
  }
  const sections = [...brief.sections].sort((left, right) => Number(right.key === "decide") - Number(left.key === "decide"));
  const decide = sections.find((section) => section.key === "decide")?.lines.length ?? 0;
  const blocked = sections.find((section) => section.key === "blocked")?.lines.length ?? 0;
  const headline = decide ? `先看 ${decide} 件要你定的`
    : blocked ? `有 ${blocked} 件卡住的`
      : sections.some((section) => section.key === "today" && section.lines.length) ? "今天的事都列在下面"
        : "今天没有要你处理的事";
  return {
    ...fallback,
    source: "早报",
    headline,
    sections,
    lines: [],
    briefDateLabel: `早报是 ${date} 的`,
    briefNotice: "",
  };
}
