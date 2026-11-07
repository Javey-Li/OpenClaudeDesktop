import test from "node:test";
import assert from "node:assert/strict";
import { firstSentence, plainText } from "../src/board-text-model.mjs";

test("markdown becomes plain words and paths stay short", () => {
  const text = [
    "## 结论",
    "**已修好**：`/Users/javeyli/Projects/FretSense/app.js` 的 [PR #114](https://github.com/Javeyli-Li/FretSense/pull/114) 过了。",
    "- 下一项",
    "```json",
    '{"raw":true}',
    "```",
  ].join("\n");
  const plain = plainText(text);
  assert.equal(plain, "结论\n已修好：…/FretSense/app.js 的 PR #114 过了。\n下一项");
  assert.doesNotMatch(plain, /[*`]|\[|\]\(/);
  assert.doesNotMatch(plain, /\{"raw":true\}/);
  assert.match(plain, /…\/FretSense\/app\.js/);
});

test("the first sentence skips a label-only line and a leading label", () => {
  assert.equal(firstSentence("**结论**\n**已修好**：先修表格，再跑截图。\n下一段"), "先修表格，再跑截图。");
  assert.equal(firstSentence("### 说明\n这一句就够了。后面还有"), "这一句就够了。");
  assert.equal(firstSentence("", 30), "");
});

test("a github issue or pull link reads as repo#number", () => {
  assert.equal(plainText("见 https://github.com/Javey-Li/FretSense/issues/5 。"), "见 Javey-Li/FretSense#5 。");
});
