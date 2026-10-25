# Open-Claude 项目约定

这是个人 Claude Desktop 替代应用。完整功能目标见 docs/FEATURES.md。Ponytail 用于减少重复代码，不得把明确目标缩成聊天演示或 MVP。

## 从哪里继续

- 先读 docs/STATUS.md 的“下一项”。需要路线和设计理由时读 docs/PLAN.md。
- 安装与本机检查见 docs/SETUP.md。不要每次重装工具或重读全部上游文档。
- 只在项目事实、决定或运行结果变化时更新对应记录。旧调查在本机 research/，它是历史材料，不是当前进度。

## 仓库与改动

- origin 是 Javey-Li/OpenClaudeDesktop。upstream 是 oleyyu/OpenClaudeDesktop，仅用于比对。用户要求推送时推 origin，不推 upstream，不重写远端历史。
- 只在 new-2.42304.0 开发。old-2.31226.0 保留为历史参考，除非任务明确涉及它。
- 先找现有实现，再选标准库、已有依赖或新库。当前不做预先拆包、统一重写和为未来创建的接口。
- UI 的定时演示、mock host、源码正则检查不能充当真实工具成功、VM启动或完整功能完成。
- 修改工具协议前查所有调用方和测试。审批拒绝、取消、失败、恢复都要有明确结果。
- sub-agent 使用 GPT-6 Luna，reasoning_effort=medium，fork_turns=none。只委派独立任务，主 Agent 汇总检查。

## 验证与数据

- npm run doctor 检查工具。npm run check:build 单独检查已知缺失构建输入。两者不能互相替代。
- npm run check 是选定的基础检查，不是全量测试。npm run check:rea 验证实际 REA 静态分析。
- npm run check:chrome 跑原始 Electron 脚本 P0–P5。session 参数会调用真模型，不能混入无模型检查。
- 测试数据、API key、官方资源副本、运行日志和会话放 .local/，不提交。禁止读取、复制或中转原版登录 token。
- 不修改原版 Claude.app、fuses、签名或日常 Chrome profile。REA 的静态结论和运行观察分别记录。
- 上游根许可 MIT 不自动覆盖提取的官方资源。新资源要保留来源和许可证，不能用占位文件宣称完整构建成功。

## 交付

每项功能在 docs/FEATURES.md 保留状态、实现位置和完成条件。只改本次涉及的行。实现后记录实际命令与结果；构建、单测、真实模型和 GUI 分开描述。
