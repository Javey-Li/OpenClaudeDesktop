// Reads the personal-super-agent store for the Router pane. The store lives outside
// the app (PSA_HOME, default ~/Projects/_governance/personal-super-agent); a
// missing or broken store is reported, not thrown, so the pane can say so.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildRouterBoard } from "../src/router-board-model.mjs";

export function routerHome(env = process.env) {
  const home = typeof env.PSA_HOME === "string" && env.PSA_HOME.trim() ? env.PSA_HOME.trim() : null;
  return home ?? path.join(os.homedir(), "Projects", "_governance", "personal-super-agent");
}

export async function readRouterBoard({ env = process.env } = {}) {
  const home = routerHome(env);
  const file = path.join(home, "data", "state.json");
  let state;
  try {
    state = JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    return { ok: false, home, error: error?.code === "ENOENT" ? "还没找到总管的数据。" : "总管的数据读不出来。" };
  }
  const board = buildRouterBoard(state);
  const projects = (Array.isArray(state.projects) ? state.projects : []).map((project) => ({ id: project?.id, name: project?.name || project?.id }));
  return { ok: true, home, readAt: new Date().toISOString(), projects, ...board };
}
