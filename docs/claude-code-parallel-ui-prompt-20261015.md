# Claude Code 并行研究 Prompt

将下面内容作为 Claude Code 的任务指令：

```text
请在 /Users/oleyyu/claude-ui-lab 中，对本机新版 Claude Desktop 的 Code 界面做完整的静态资源与交互结构研究。

你正在与另一位 agent 并行：
- 对方负责新版资源快照、文件完整性校验、依赖图和可读源码索引。
- 你负责逐区域分析新旧 Code UI 的变化，以及本项目需要如何跟进。

参考：
- 本机应用：/Applications/Claude.app，当前版本 2.37337.1。
- 新版资源：reference/installed-2.37337.1-20261015/
- 旧版资源：reference/installed-2.31226.0-20261012/
- 新版可读源码：analysis/code-ui-unpack-20261015/readable/
- 新版索引：analysis/code-ui-unpack-20261015/CODE-INDEX.md
- 旧版同步记录：docs/code-ui-inventory-20261013.md、docs/code-ui-sync-20261013.md。
- 先读 HANDOFF.md 顶部，了解现有项目状态。

完整覆盖：Code 首页、侧栏、顶部栏、输入框、对话内容、工具卡片、Files、Diff/Git、Terminal、Preview、任务与子代理、设置、菜单、分屏与弹窗。

每个区域输出：
1. 新版组件入口、关键符号、依赖与源码位置。
2. 相对旧版的结构、样式、文案和交互变化。
3. 对照 app/src 与 app/electron，哪些已一致、哪些需调整。
4. 明确区分源码确认、功能开关控制、需要运行态验证的结论。
5. 建议后续实现顺序与验证场景。

不要仅凭文件哈希变化判定 UI 变化；共享 chunk 可能重新分组，必须追踪实际组件和调用关系。

本轮只做研究与报告。工作区已有大量未提交修改，请保留。你的产物统一写入 analysis/code-ui-audit-20261015-claude/，总结写入 docs/code-ui-audit-20261015-claude.md；不要修改另一位 agent 的输出、HANDOFF.md 或产品代码。

完成后给出有源码行号依据的变化清单、优先级和未确认项。
```
