# 开发说明

本页说明当前源码与下一步工作。产品范围见 [PRD](PRD.md)。本文不提供已经验证可安装的发行包。

## 基线与目录

当前应用基线来自 [oleyyu/OpenClaudeDesktop 的 c8f9880](https://github.com/oleyyu/OpenClaudeDesktop/commit/c8f9880e1ab23c559f14e771970aac42962b7f6a)。本衍生项目尚未加入新的应用业务实现。

| 目录 | 作用 |
|---|---|
| new-2.42304.0/app | Electron 主进程、preload、React 界面、工具宿主和应用测试 |
| new-2.42304.0/harness | Agent 内核桥接、模型与会话协议、相关测试 |
| new-2.42304.0/claude-ext | Chrome 扩展，与应用的 native host/工具服务通信 |
| new-2.42304.0/tools | 上游的开发工具依赖 |
| old-2.31226.0 | 历史源码，用于必要的比较，不与新树合计能力 |

新增实现优先扩展这些模块，不预先拆出新的大型工程结构。外部 UI 组件按需要选择，接入真实状态后再用于产品流程。

## 当前可确认的状态

- 新树存在模型与 Agent 桥、队列、审批、文件、终端、预览、Projects、Artifacts 和浏览器的实际代码。
- 部分模块做过专项测试和 Chrome 链路检查。这些结果不代表完整应用或所有内核已经可用，也不作为本 fork 的发行测试报告。
- 目前干净源码构建缺少历史 reference 资源；完整 GUI、真实模型任务和 Cowork VM 尚未验证。

## 首个开发任务：可重建的应用

先处理 app/scripts/prepare-ui.mjs、current-design-assets.mjs、相关源码生成器和运行时资源入口。

当前构建会访问仓库外的历史快照。已确认的一个缺失输入是：

```text
new-2.42304.0/reference/installed-2.42304.0-20261017/
  ion-dist/assets/v1/vendor-frame-DfPJ1QmD.js
```

此外，source-pet.jsx 依赖缺失的动画文件，界面还依赖未准备的样式资源。另一版本的同名文件、空动画和仅跳过检查不能证明问题解决。

完成条件：

1. 声明清楚所有必要构建输入、来源与许可。
2. 日常构建不依赖维护者的私人快照目录；来源不清或无法提供的资源有明确替代实现。
3. 干净 checkout 按文档生成应用，界面资源完整加载，主要路由可打开。
4. 保留抽取/比较工具的研究用途，区分编译通过、窗口运行和行为一致性。

## 后续改动从哪里开始

| 顺序 | 相关模块 | 需要证明什么 |
|---|---|---|
| 真实执行流程 | core-registry、core-manager、Harness transport/index、agent-tools-host | 模型读写测试文件，审批拒绝与批准都生效，结果与落盘一致 |
| 会话与恢复 | session-operations、queue/store/projection、interrupt-turn | 编辑、重试、取消、重启后历史明确，已执行副作用不重复 |
| 资料与产物 | composer附件、local-projects、artifact-index、file/preview服务 | 跨会话资料更新正确，产物多版本可回退和导出 |
| 工具与系统 | terminal、MCP/plugin、browser、OS相关宿主 | 真实工具可用，权限、并发、中断与窗口交互可靠 |
| 云与同步 | 在需要时接入的远程执行和数据服务 | 远程任务持久、本机离线状态明确、同步冲突可恢复 |

## 怎样记录一次改动

改动说明应包含：对应需求或使用问题、实际修改、继承或引用来源、运行的检查、尚未验证的部分。缺失功能和构建问题可通过 issue 追踪；已发生的结果才写入完成记录。

专项测试从对应 app/tests 或 harness/tests 选择。运行完整测试前先确认外部 fixture 和依赖齐全，不用省略失败用例的方式声称全量通过。本机研究日志、账号、官方资源副本和开发者偏好不作为仓库默认配置。
