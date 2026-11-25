import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const app = path.resolve(import.meta.dirname, "..");
let server, React, render, Components;

before(async () => {
  React = (await import("react")).default;
  ({ renderToStaticMarkup: render } = await import("react-dom/server"));
  const { createServer } = await import("vite");
  const react = (await import("@vitejs/plugin-react")).default;
  server = await createServer({ configFile: false, root: app, plugins: [react()],
    server: { middlewareMode: true, hmr: false, watch: null }, appType: "custom", logLevel: "error" });
  Components = await server.ssrLoadModule("/src/agent-state-components.jsx");
});

after(() => server?.close());

test("a tool call opens with one plain sentence; raw JSON is folded away on first render", () => {
  const tool = {
    id: "t1", name: "apply_patch", kind: "edit", summary: "改 1 个文件：a.css",
    status: "ok", args: "*** Begin Patch\nRAW_ONLY_MARKER\n*** End Patch", result: "Success",
    resultLine: "已更新", diff: { add: 1, del: 1 }, durationMs: 1200,
  };
  const html = render(React.createElement(Components.ToolCallRow, { tool }));
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /改 1 个文件：a\.css/);
  assert.doesNotMatch(html, /RAW_ONLY_MARKER/);
  assert.match(html, /已更新/);
  assert.doesNotMatch(html, /看原始参数和结果/);
});

test("context map and fallback chain render real counts, not placeholders", () => {
  const map = render(React.createElement(Components.ContextMap, {
    context: { used: 4500, window: 10_000, percent: 45, parts: { cached: 3000, fresh: 1000, output: 500 }, reasoning: 80 },
  }));
  assert.match(map, /4\.5k/);
  assert.match(map, /10k/);
  assert.match(map, /空余 5\.5k/);
  assert.match(map, /已缓存输入/);

  const chain = render(React.createElement(Components.FallbackChain, {
    models: { segments: [
      { model: "auto/dfmodel", turns: 2, from: "2026-11-07T01:00:00.000Z", to: "2026-11-07T01:05:00.000Z", ended: "aborted", current: false },
      { model: "commandcode/deepseek/deepseek-v4.1-flash", turns: 1, from: "2026-11-07T01:10:00.000Z", to: "2026-11-07T01:12:00.000Z", ended: "open", current: true },
    ] },
  }));
  assert.match(chain, /dfmodel/);
  assert.match(chain, /deepseek-v4\.1-flash/);
  assert.match(chain, /当前/);
  assert.doesNotMatch(chain, /没有模型记录/);

  const t3 = render(React.createElement(Components.FallbackChain, {
    models: { segments: [{ model: "claude-opus-5-5", turns: null, from: "2026-11-07T01:00:00.000Z",
      to: "2026-11-07T01:00:00.000Z", ended: "open", current: true }] },
  }));
  assert.doesNotMatch(t3, /null 轮/);
});

test("line card meta shows source, session roles and time without duplicate counts", () => {
  const page = fs.readFileSync(path.join(app, "src/source-board-page.jsx"), "utf8");
  assert.match(page, /工作项 \{counts\.lines\} · 会话 \{counts\.sessions\}/);
  assert.match(page, /统计口径：工作项为主 · 会话 \{counts\.sessions\}/);
  assert.match(page, /line\.sessionCount > 1 \? sessionRoleLabel\(line\.sessions\) : ""/);
  assert.match(page, /\{sessionRoles && <span>\{sessionRoles\}<\/span>\}/);
  assert.doesNotMatch(page, /会话 \{line\.sessionCount\}/);
  assert.doesNotMatch(page, /shortModel\(model\)/);
  assert.doesNotMatch(page, /统计口径：会话数/);
  const css = fs.readFileSync(path.join(app, "src/board-levels.css"), "utf8");
  assert.match(css, /\.psl-line-card \.psl-card-meta > span \{[^}]*overflow: visible/s);
  assert.match(css, /\.psl-project-card \.psl-card-meta > span \{[^}]*overflow: visible/s);
  assert.match(css, /\.psl-line-card \.psl-card-meta \{[^}]*margin-top: auto/s);
  assert.match(page, /<p className="psl-detail-foot"><span>/);
  assert.match(css, /\.psl-detail-foot > span \{[^}]*margin-inline: auto/s);
  assert.match(page, /useState\("inspiration"\)/);
  assert.match(page, /放进灵感池/);
  assert.match(page, /report\.sections\?\.length/);
  assert.match(page, /onDrop=/);
  assert.match(page, /写一句想法…/);
  assert.match(css, /\.psl-page \.psl-origin \{[^}]*padding-inline: 0/s);
});
