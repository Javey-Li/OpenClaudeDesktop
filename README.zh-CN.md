# OpenClaudeDesktop · Javey-Li 衍生项目

简体中文 · [English](README.md)

这是基于 [oleyyu/OpenClaudeDesktop](https://github.com/oleyyu/OpenClaudeDesktop) 继续开发的开源衍生项目，目标是逐步构建完整的 Claude Desktop 日常替代体验。

范围包括聊天、项目知识、附件、Artifacts、代码与工作任务、工具调用、浏览器和桌面操作，以及可持续的后台工作。开发分阶段进行；这些是产品目标，不代表当前全部可用。

## 现在到哪一步

本项目处于产品定义和基础实现核实阶段。当前应用代码继承自上游，尚未发布本衍生项目独立验证的应用版本。

上游已经包含 Electron/React 应用、DeepSeek Harness 桥接、多种内核适配、文件与终端服务、预览、本地 Projects 和 Artifacts 代码，以及 Chrome Bridge。代码存在不等于完整可用，也不代表各内核的行为一致。

目前从干净源码构建仍缺少历史版本的 `reference/` 资源。完整应用启动、真实模型执行任务和 Cowork VM 尚未在本衍生项目验证，因此暂不提供承诺可用的一键安装步骤。

## 我们准备做什么

- 在继承的代码工作台上，补齐更完整的 Claude Desktop 工作流程。
- 把会话、资料、产物和任务执行连起来，明确状态、恢复和权限。
- 支持明确选择模型与 Agent 内核，让数据、账号和服务边界可理解。
- 先让构建和功能检查可复现，再把对应功能标为可用。

首先服务于维护者自己的日常使用。仓库公开，是为了让项目方向、实现过程和实际限制都可查看。

## 从哪里了解项目

| 文件 | 回答什么问题 |
|---|---|
| [PRD：产品需求](docs/PRD.md) | 为谁做、要解决什么、完整范围是什么、怎样判断完成 |
| [开发说明](docs/DEVELOPMENT.md) | 代码在哪、当前受什么阻碍、下一步先改什么 |
| [参与开发](CONTRIBUTING.md) | 怎样提出改动、说明来源和检查结果 |

## 代码目录

- [`new-2.42304.0/`](new-2.42304.0/)：当前开发基线。目录名记录上游参考的界面版本，不是本衍生项目的发行版本。
- [`old-2.31226.0/`](old-2.31226.0/)：保留用于比较的历史源码。

这两个目录中的 README 是上游文档，其中的功能表述和安装步骤尚未全部由本项目独立验证。本仓库根目录的 README 说明本衍生项目的状态。

## 来源与相关项目

应用基础来自 [OpenClaudeDesktop](https://github.com/oleyyu/OpenClaudeDesktop)。保留上游贡献与版权说明，区分继承实现和本项目新增改动。

[Open Claude UI](https://github.com/Caho1/open-claude-ui) 可供选择组件和交互实现；[REA](https://github.com/morluto/rea) 用于研究可观察的原版行为；[learn-claude-code](https://github.com/shareAI-lab/learn-claude-code) 提供 Agent 教学案例。列出这些项目不代表已经集成，也不代表它们都是应用运行依赖。

## 模型接入与官方服务

模型 API、本地 Agent 内核和 Claude 订阅提供的能力不同。接入某个后端，不会自动获得官方账号功能、云会话或同步数据。每项接入都需要说明认证方式、费用归属和服务限制。

## 许可证与项目关系

保留上游的 [MIT 许可证与版权声明](LICENSE)。第三方代码和提取资源需要分别核实来源与许可；根目录许可证不能证明每项继承资源都可重新分发。

这是独立社区项目，不是 Anthropic 官方应用，也未获 Anthropic 认可。
