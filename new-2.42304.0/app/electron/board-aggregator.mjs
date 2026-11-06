// Read-only board aggregator for the full-page 总管 board.
//
// Runtime shape (first version is a fixture):
//   - every superagent instance's /orchestrator/api (read-only)
//   - T3 threads
//   - Codex sessions under ~/.codex/sessions
//
// Nothing is written here. Capture stays behind the UI's explicit fake-routing
// step until the Trigger / Issue writers land.
import { createMockBoardSnapshot } from "../src/board-view-model.mjs";

export async function readBoardSnapshot({ variant = "normal" } = {}) {
  if (variant === "error") {
    return { ok: false, error: "聚合器没有回话：三个来源里有两个超时。" };
  }
  return {
    ok: true,
    snapshot: createMockBoardSnapshot({ empty: variant === "empty" }),
  };
}
