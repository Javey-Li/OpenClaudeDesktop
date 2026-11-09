import test from "node:test";
import assert from "node:assert/strict";
import { buildRouterBoard } from "../src/router-board-model.mjs";

const projects = [{ id: "fretsense", name: "Fret Sense", repo: "Javey-Li/FretSense" }];

test("sorts router knowledge into decide, done and stuck", () => {
  const board = buildRouterBoard({
    projects,
    decisions: [
      { id: "d1", projectId: "fretsense", event: { kind: "pr", number: 114 }, router: "needs_human", reason: "PR 没关联 issue", ci: { failing: [] } },
      { id: "d2", projectId: "fretsense", event: { repo: "Javey-Li/FretSense", kind: "pr", number: 110 }, router: "routed", ci: { failing: [{ name: "Product checks" }] } },
    ],
    baseline: [
      { id: "b1", projectId: "fretsense", type: "OpenQuestion", title: "设计系统分几层", status: "active" },
      { id: "b2", projectId: "fretsense", type: "Failure", title: "钩子拦得太宽", status: "active" },
      { id: "b3", projectId: "fretsense", type: "Decision", title: "一个项目一个总管", status: "active" },
      { id: "b4", projectId: "fretsense", type: "OpenQuestion", title: "旧问题", status: "retired" },
    ],
    workItems: [{ id: "w1", projectId: "fretsense", title: "收口 #113", status: "done" }],
  });
  assert.deepEqual(board.decide.map((row) => row.title).sort(), ["PR #114", "设计系统分几层"]);
  assert.deepEqual(board.stuck.map((row) => row.title).sort(), ["PR #110", "钩子拦得太宽"]);
  assert.deepEqual(board.done.map((row) => row.title), ["收口 #113"]);
  assert.equal(board.decide[0].project, "Fret Sense");
});

test("live failing checks show once, even when the store already has them", () => {
  const board = buildRouterBoard({ projects, decisions: [{ id: "d2", projectId: "fretsense", event: { repo: "Javey-Li/FretSense", kind: "pr", number: 110 }, ci: { failing: [{ name: "Product checks" }] } }] },
    { "Javey-Li/FretSense": [{ number: 110, title: "x", ci: { failing: [{ name: "Product checks" }] } }, { number: 111, ci: { failing: [] } }] });
  assert.equal(board.stuck.length, 1);
});

test("an empty or odd store gives three empty columns", () => {
  assert.deepEqual(buildRouterBoard(), { decide: [], done: [], stuck: [] });
  assert.deepEqual(buildRouterBoard({ decisions: "x", baseline: null }), { decide: [], done: [], stuck: [] });
});
