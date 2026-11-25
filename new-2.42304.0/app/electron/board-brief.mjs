import fs from "node:fs/promises";
import path from "node:path";
import { parseMorningBrief, tokyoDate } from "../src/board-morning-brief.mjs";

const text = (value) => (typeof value === "string" ? value.trim() : "");

export async function readBoardBrief({ env = process.env, now = new Date(), readFile = (file) => fs.readFile(file, "utf8") } = {}) {
  const date = tokyoDate(now);
  const dir = text(env.BOARD_BRIEF_DIR);
  if (!dir) return { status: "missing", date, sections: [], error: "" };
  try {
    const markdown = await readFile(path.join(dir, `${date}.md`));
    return parseMorningBrief(markdown, { expectedDate: date });
  } catch (error) {
    if (error?.code === "ENOENT") return { status: "missing", date, sections: [], error: "" };
    return { status: "error", date, sections: [], error: error?.message || "早报文件读不到。" };
  }
}
