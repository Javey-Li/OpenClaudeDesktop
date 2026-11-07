// Display text for the 总管 board.
//
// Lines report in markdown: bold labels, backtick paths, fenced psa-report
// blocks, links. The board shows plain words only, and on cards only the first
// sentence. Pure, so the rules are testable.

const text = (value) => (typeof value === "string" ? value : "");

function shortPath(path) {
  const parts = path.split("/").filter(Boolean);
  if (parts.length <= 2) return path;
  return `…/${parts.slice(-2).join("/")}`;
}

// Markdown → plain words. Keeps line breaks so the caller can still find the first line.
export function plainText(value) {
  let out = text(value).replace(/\r\n?/g, "\n");
  out = out.replace(/```[\s\S]*?(```|$)/g, "\n");
  out = out.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  out = out.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  out = out.replace(/`([^`\n]*)`/g, "$1");
  out = out.replace(/\*\*([^*\n]+)\*\*|__([^_\n]+)__/g, (_, a, b) => a ?? b);
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,，。]|$)/g, "$1$2");
  out = out.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  out = out.replace(/^\s{0,3}>\s?/gm, "");
  out = out.replace(/^\s*(?:[-*+•]|\d+[.)])\s+/gm, "");
  out = out.replace(/^\s*\|.*\|\s*$/gm, "");
  out = out.replace(/(?:~|\/Users\/[^/\s]+)(\/[^\s，。；、)）]+)/g, (_, rest) => shortPath(rest));
  out = out.replace(/https?:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/(?:pull|issues)\/(\d+)/g, "$1#$2");
  out = out.replace(/[*_]{2,}/g, "");
  return out.split("\n").map((line) => line.replace(/[ \t]+/g, " ").trim()).join("\n").replace(/\n{2,}/g, "\n").trim();
}

// A short markdown label on its own ("**结论**", "**借了什么**") says nothing by itself.
const LABEL_LINE = /^\s*(?:\*\*[^*\n]{1,14}\*\*|#{1,6}\s+[^\n]{1,14})\s*[:：]?\s*$/;
const LEADING_LABEL = /^\s*\*\*([^*\n]{1,14})\*\*\s*(?:[:：]\s*|\s+(?=\S))/;

// First plain sentence, for cards and rows. Skips bare labels and code; cuts at 。！？ or a newline.
export function firstSentence(value, limit = 90) {
  const lines = text(value).replace(/\r\n?/g, "\n").replace(/```[\s\S]*?(```|$)/g, "\n").split("\n")
    .filter((line) => line.trim() && !LABEL_LINE.test(line));
  const source = (lines.join("\n") || text(value)).replace(LEADING_LABEL, "");
  const plain = plainText(source.replace(/\s+[-•]\s+(?=\S)/g, "\n")).split("\n").find((line) => /[\p{L}\p{N}]/u.test(line)) ?? "";
  const match = /^(.+?(?:[。！？!?；;]|\.(?=\s)))/u.exec(plain);
  let sentence = (match ? match[1] : plain).replace(/[：:，,、；;]\s*$/, "").trim();
  if (sentence.length > limit) sentence = `${sentence.slice(0, limit - 1).trimEnd()}…`;
  return sentence;
}
