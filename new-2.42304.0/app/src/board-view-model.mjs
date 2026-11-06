// Board snapshot model for the full-page 总管 board.
//
// The first version is deliberately a fixture, but the shape is the one the
// real aggregator will return: a read-only roll-up from every superagent
// instance's /orchestrator/api, T3 threads, and Codex sessions under
// ~/.codex/sessions. Keep this module pure so Electron and the renderer read
// the same contract.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const projectRows = [
  { id: "fretsense", name: "Fret Sense", repo: "Javey-Li/FretSense", note: "主产品" },
  { id: "delicacy", name: "Delicacy", repo: "Javey-Li/delicacy-html", note: "设计智能" },
  { id: "guitaros", name: "GuitarOS", repo: "Javey-Li/GuitarOS", note: "教学系统" },
  { id: "dawdex", name: "DAWdex", repo: "Javey-Li/DAWdex", note: "暂存" },
  { id: "mission", name: "Mission", repo: "Javey-Li/mission", note: "个人系统" },
];

const projectName = (id) => projectRows.find((project) => project.id === id)?.name ?? id;

const item = (id, projectId, title, detail, extra = {}) => ({
  id,
  projectId,
  project: projectName(projectId),
  title,
  detail,
  ...extra,
});

const conversation = (id, projectId, title, preview, source, status, minutesAgo, extra = {}) => ({
  id,
  projectId,
  project: projectName(projectId),
  title,
  preview,
  source,
  status,
  updatedAt: new Date(Date.parse("2026-11-07T08:40:00+09:00") - minutesAgo * MINUTE).toISOString(),
  ...extra,
});

export const BOARD_COLUMNS = Object.freeze([
  { key: "decide", title: "要我定的", eyebrow: "01", empty: "没有等你定的事。" },
  { key: "done", title: "做完的", eyebrow: "02", empty: "今天还没有收口的事。" },
  { key: "stuck", title: "卡住的", eyebrow: "03", empty: "没有卡住的事。" },
]);

export const BOARD_SOURCES = Object.freeze([
  { id: "superagent", label: "Superagent", hint: "各实例 /orchestrator/api" },
  { id: "t3", label: "T3", hint: "T3 线程" },
  { id: "codex", label: "Codex", hint: "~/.codex/sessions" },
]);

// 22 conversations across five projects, enough to show that the board does not
// fall back to the sidebar for the long tail.
const CONVERSATIONS = [
  conversation("conv-fs-audio", "fretsense", "音频识别：复制和弦回放", "把昨天录的 Dm7 → G7 片段接进回放，检查第二遍是否还偏半拍。", "codex", "waiting", 18, { unread: true, threadId: "mock-fs-audio" }),
  conversation("conv-fs-whitepaper", "fretsense", "白皮书 P31–P36 编辑复核", "六页的结论都留住了，删掉了两处把推测写成事实的句子。", "superagent", "done", 52),
  conversation("conv-fs-home", "fretsense", "主页 Hero 的第二版构图", "把真实吉他照片放回右侧，标题缩短到两行；还在看小屏。", "codex", "running", 6),
  conversation("conv-fs-scale", "fretsense", "练习页 scale 路线收口", "等一份真实学生的练习记录，暂时不凭感觉改路径。", "codex", "stuck", 96),
  conversation("conv-fs-calibration", "fretsense", "校准桥 CalibrationBridge 探针", "四个探针都回到同一组 latency，先记下，不改算法。", "t3", "done", 140),
  conversation("conv-fs-showroom", "fretsense", "产品系统 Showroom 的组件清单", "从 31 个组件里收回 12 个真正有人用的。", "codex", "done", 260),
  conversation("conv-fs-book", "fretsense", "公开书第 4 章的事实边界", "把“会识别”改成“能验证回放判断”，等你读一遍。", "codex", "waiting", 34),
  conversation("conv-dl-harmony", "delicacy", "Dm7 → G7 → CMaj7 的第四小节", "第四小节保住了，没有为了整齐把 CMaj7 折回两拍。", "codex", "running", 12),
  conversation("conv-dl-s05", "delicacy", "S05 harmonic-route 候选复核", "浏览器里走通了三种走法，还差你听一次。", "t3", "waiting", 28),
  conversation("conv-dl-doctype", "delicacy", "模板包与渲染器的 docType 漂移", "模板写 article，渲染器按 report 读；先不改，等决定。", "superagent", "stuck", 78),
  conversation("conv-dl-works", "delicacy", "作品总表的 8 个页面", "8 页都在，链接检查过；内容整合还差两页。", "codex", "done", 205),
  conversation("conv-dl-decisions", "delicacy", "第二大脑里的设计决定回填", "把 5 月到 10 月的原话按页面归好，没有改写。", "codex", "done", 310),
  conversation("conv-go-teacher", "guitaros", "AI Guitar Teacher 的教师层定义", "先有“看作业”还是“陪练”这个分叉，写在产品页第一屏。", "codex", "waiting", 24, { unread: true }),
  conversation("conv-go-loop", "guitaros", "浏览器端练习循环", "从一句目标进到第一轮反馈，暂用假音频。", "codex", "running", 3),
  conversation("conv-go-permission", "guitaros", "旧后端接口的权限边界", "接口人还没回，不能确认哪些字段能给教师层。", "superagent", "stuck", 190),
  conversation("conv-go-render", "guitaros", "产品定义 HTML 的渲染检查", "桌面和窄屏都能开，图标没有断。", "codex", "done", 280),
  conversation("conv-daw-track", "dawdex", "AI Virtual Studio 的轨道模型", "把 12 轨压到 8 轨，保留两条总线。", "codex", "running", 46),
  conversation("conv-daw-index", "dawdex", "16 页系统表的入口重整", "入口从 16 个减到 6 个，旧的都留在归档。", "codex", "waiting", 112),
  conversation("conv-daw-playhead", "dawdex", "旧 UI 的播放头同步", "暂停再播放时不再跳回零。", "codex", "done", 420),
  conversation("conv-mi-weekly", "mission", "本周复盘：什么值得继续", "只留三件真正推进的事，其余写清楚为什么停。", "t3", "waiting", 64),
  conversation("conv-mi-timeline", "mission", "五个项目的总时间线", "三月到十月的节点都接上了。", "codex", "done", 360),
  conversation("conv-mi-archive", "mission", "旧项目的归档边界", "Windows 目录只读，认证和会话没有搬回来。", "codex", "done", 520),
];

const DECIDE = [
  item("board-decide-fs-home", "fretsense", "主页第二版：真吉他的近景留不留",
    "留着更像你，但会把标题挤到两行。我倾向前者，等你点头。",
    { source: "superagent", kind: "产品", who: "Fret Sense 总管", at: "2026-11-07T08:12:00+09:00", accent: "ochre" }),
  item("board-decide-dl-s05", "delicacy", "S05：第四小节要不要保留成正式节奏",
    "现在三条走法都能听，保留 CMaj7 会多出一拍；这是口味，不是技术问题。",
    { source: "codex", kind: "作品", who: "Delicacy 写线", at: "2026-11-07T07:58:00+09:00", accent: "ochre" }),
  item("board-decide-go-teacher", "guitaros", "教师层先做“看作业”还是“陪练”",
    "两条都能开始，但同时做会把第一版拖成四不像。",
    { source: "superagent", kind: "方向", who: "GuitarOS 总管", at: "2026-11-07T07:31:00+09:00", accent: "ochre" }),
  item("board-decide-mi-weekly", "mission", "下周是否只推 Fret Sense 一件事",
    "其余四个项目保活即可；如果你不同意，我就按原计划并行。",
    { source: "t3", kind: "取舍", who: "Mission 线程", at: "2026-11-07T07:05:00+09:00", accent: "ochre" }),
];

const DONE = [
  item("board-done-whitepaper", "fretsense", "白皮书 P31–P36 的编辑复核",
    "六页都读过了，删掉两处越界结论；没有改 Founder 的原话。",
    { source: "superagent", kind: "文档", who: "Fret Sense 写线", at: "2026-11-07T07:44:00+09:00", accent: "sage" }),
  item("board-done-works", "delicacy", "Delicacy 的 8 页作品总表收口",
    "链接全部可开，第四页的重复条目已经合掉。",
    { source: "codex", kind: "整理", who: "Delicacy 写线", at: "2026-11-07T07:18:00+09:00", accent: "sage" }),
  item("board-done-render", "guitaros", "产品定义 HTML 的渲染检查",
    "桌面和 390px 窄屏都过了一遍，图标和标题没有断。",
    { source: "codex", kind: "页面", who: "GuitarOS 写线", at: "2026-11-07T06:55:00+09:00", accent: "sage" }),
  item("board-done-entry", "mission", "把散着的侧栏入口并到一处",
    "总管、动作中心和会话入口不再互相抢位置。",
    { source: "t3", kind: "结构", who: "Mission 线程", at: "2026-11-07T06:34:00+09:00", accent: "sage" }),
];

const STUCK = [
  item("board-stuck-scale", "fretsense", "练习页 scale 路线缺真实学生样本",
    "再改就是凭感觉。等一份 10 分钟的练习记录，或者你指定一个学生。",
    { source: "codex", kind: "证据", who: "Fret Sense 写线", at: "2026-11-07T07:22:00+09:00", accent: "rust" }),
  item("board-stuck-doctype", "delicacy", "模板包和渲染器还在 docType 上打架",
    "模板写 article，渲染器只认 report；两边都能改，先等你的产品定义。",
    { source: "superagent", kind: "冲突", who: "Delicacy 总管", at: "2026-11-07T06:48:00+09:00", accent: "rust" }),
  item("board-stuck-permission", "guitaros", "旧后端权限边界等接口人回话",
    "没有字段清单，教师层不能假装已经能读作业。",
    { source: "t3", kind: "外部", who: "GuitarOS 线程", at: "2026-11-07T06:12:00+09:00", accent: "rust" }),
];

const BASE_REPORT = Object.freeze({
  task: "总管日报",
  generatedAt: "2026-11-07T08:40:00+09:00",
  cadence: "每天 08:40 生成",
  title: "今天先做一件事",
  lines: [
    { key: "done", label: "做完了什么", text: "白皮书 P31–P36 的复核做完了，Delicacy 的 8 页作品总表也收口了；散在侧栏里的入口并到了一处。" },
    { key: "open", label: "没做完什么", text: "Fret Sense 主页第二版还差你点头；GuitarOS 的教师层只写到定义，练习循环还没接上真实会话。" },
    { key: "stuck", label: "卡在哪", text: "Delicacy 的模板包和渲染器还在 docType 上打架；GuitarOS 的旧后端等接口人回话；Fret Sense 的 scale 路线缺一份真实学生练习。" },
    { key: "decide", label: "要主人定什么", text: "今天只需要定一件事：下周是否只推 Fret Sense，其余四个项目先保活。" },
  ],
});

function conversationsFor(projectId) {
  return CONVERSATIONS.filter((row) => row.projectId === projectId)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

function projectGroups() {
  return projectRows.map((project) => ({
    ...project,
    conversations: conversationsFor(project.id),
  })).filter((project) => project.conversations.length > 0);
}

function sourceHealth() {
  return [
    { id: "superagent", label: "Superagent", detail: "3 个实例在线", status: "ok" },
    { id: "t3", label: "T3", detail: "2 个线程可读", status: "ok" },
    { id: "codex", label: "Codex", detail: "18 个本地会话", status: "ok" },
  ];
}

export function createMockBoardSnapshot({ empty = false, now = "2026-11-07T08:40:00+09:00" } = {}) {
  const generatedAt = now;
  if (empty) {
    return {
      schemaVersion: "psa.board.v1",
      generatedAt,
      report: null,
      columns: { decide: [], done: [], stuck: [] },
      projects: [],
      sources: sourceHealth().map((source) => ({ ...source, detail: "已连接，今天没有新内容" })),
      capture: captureConfig(),
      totals: { conversations: 0, running: 0, waiting: 0, unread: 0 },
    };
  }
  const columns = { decide: DECIDE, done: DONE, stuck: STUCK };
  const projects = projectGroups();
  return {
    schemaVersion: "psa.board.v1",
    generatedAt,
    report: {
      ...BASE_REPORT,
      generatedAt,
      source: "汇报任务",
      fresh: true,
    },
    columns,
    projects,
    sources: sourceHealth(),
    capture: captureConfig(),
    totals: boardTotals({ columns, projects }),
  };
}

export function captureConfig() {
  return {
    issueRepo: "Javey-Li/OpenClaudeDesktop",
    trigger: "superagent.inbox",
    issueLabel: "board-capture",
    hint: "一句话会进 superagent Trigger；链接会开成 Issue。第一版只做假处理。",
  };
}

export function boardTotals({ columns = {}, projects = [] } = {}) {
  const conversations = projects.flatMap((project) => project.conversations ?? []);
  return {
    conversations: conversations.length,
    running: conversations.filter((row) => row.status === "running").length,
    waiting: conversations.filter((row) => row.status === "waiting").length,
    unread: conversations.filter((row) => row.unread).length,
  };
}

export function groupConversations(projects = []) {
  return projects.map((project) => ({
    ...project,
    conversations: [...(project.conversations ?? [])].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
  })).filter((project) => project.conversations.length > 0);
}

export function conversationSources(projects = []) {
  const counts = new Map(BOARD_SOURCES.map((source) => [source.id, 0]));
  for (const project of projects) {
    for (const row of project.conversations ?? []) {
      counts.set(row.source, (counts.get(row.source) ?? 0) + 1);
    }
  }
  return BOARD_SOURCES.map((source) => ({ ...source, count: counts.get(source.id) ?? 0 }));
}

export function relativeLabel(iso, nowIso = new Date().toISOString()) {
  const at = Date.parse(iso ?? "");
  const now = Date.parse(nowIso ?? "");
  if (!Number.isFinite(at) || !Number.isFinite(now)) return "";
  const delta = Math.max(0, now - at);
  if (delta < MINUTE) return "刚刚";
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)} 分钟前`;
  if (delta < 24 * HOUR) return `${Math.floor(delta / HOUR)} 小时前`;
  if (delta < 7 * 24 * HOUR) return `${Math.floor(delta / (24 * HOUR))} 天前`;
  return new Date(at).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

// “一句话 / 一个链接”的门口：一句话给 superagent Trigger，链接写成目标仓库
// Issue。第一版只返回将要发生的事，界面负责把它显示成一次演示处理。
export function routeCapture({ mode = "note", text = "", config = captureConfig() } = {}) {
  const value = String(text ?? "").trim();
  if (!value) return { ok: false, reason: "先写点什么。" };
  if (mode === "link") {
    let url;
    try { url = new URL(value); } catch { return { ok: false, reason: "这个链接还读不出来。" }; }
    if (!/^https?:$/.test(url.protocol)) return { ok: false, reason: "只收 http 或 https 链接。" };
    const title = value.length > 72 ? `${value.slice(0, 69)}…` : value;
    return {
      ok: true,
      kind: "issue",
      target: config.issueRepo,
      label: "GitHub Issue",
      title,
      body: `从总看板丢进来：${value}\n\n> 第一版演示，没有真的创建 Issue。`,
      href: `https://github.com/${config.issueRepo}/issues/new?title=${encodeURIComponent(title)}`,
      message: `会开成 ${config.issueRepo} 的 Issue`,
    };
  }
  const title = value.length > 56 ? `${value.slice(0, 53)}…` : value;
  return {
    ok: true,
    kind: "trigger",
    target: config.trigger,
    label: "Superagent Trigger",
    title,
    payload: { text: value, source: "board", createdAt: new Date().toISOString() },
    message: `会交给 ${config.trigger}（Superagent Trigger）`,
  };
}

export function boardVariantFromLocation(search = "") {
  const value = new URLSearchParams(search).get("board");
  return value === "empty" || value === "error" ? value : "normal";
}
