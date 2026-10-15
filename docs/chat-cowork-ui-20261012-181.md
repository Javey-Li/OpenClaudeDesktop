# Chat / Cowork UI — 0.2.181

继续使用本机 `/Applications/Claude.app` 的 **2.31226.0** 快照，版本在本轮再次核实。
没有使用待安装的 2.31226.1，也没有修改官方应用。

## 同步内容

- 项目列表：当前 Page / PageHeader、搜索展开和 Escape 行为、项目卡片、空状态。
- 项目详情：当前项目标题、置顶操作布局、描述、会话行和日期排版。
- 资料库：当前网格/列表、卡片尺寸和分隔线、时间分组、置顶位置、搜索状态及加载占位。
- 资料预览：当前标题、图标按钮和 48px 顶部栏、内容区背景与顶部分隔线。
- 页面搜索和项目名称输入：使用当前 TextInput。补全原生字段适配器转交 disabled 与辅助说明属性，避免带图标/清除按钮的输入遗漏禁用状态。

提取器：`app/scripts/extract-current-chat-ui.mjs`。生成模块从 13 个增加至 29 个，
`app/src/generated/current-chat/provenance.json` 保留源文件、提取声明、适配边界和 SHA-256。
构建时 `prepare-current-chat-ui.mjs` 检查来源与输出完整性；当前 CSS 仍只作用于 Chat/Cowork。

本地项目存储、指令编辑、文件读取、资料置顶、系统打开和会话跳转由宿主提供。
官方账号、共享和云端服务没有被复制或伪装；本地无共享数据时不显示共享操作。

## 验证

验证记录位于 `analysis/chat-cowork-ui-20261012/`，使用独立测试配置和 fixture 模型，
通过真实 Electron IPC 操作本地项目和文件。没有调用付费模型。

- 项目创建、搜索、置顶、指令编辑、草稿隔离与重启恢复通过。
- 资料库网格/列表、搜索与 Escape、置顶持久化、Markdown/CSV/图片预览、重载与文件缺失、返回焦点通过。
- 800 / 1000 / 1440 像素窗口无标题区横向溢出，深色模式通过。
- Chat 发送、回复排版、进度栏，以及 Chat/Cowork 四种宽度的 Logo/标题布局回归通过。
- 6 项字段测试通过，包括新版带图标/清除按钮输入的 disabled 与 ARIA 回归。
- 签名的 0.2.181 在可见原生窗口通过项目列表/详情、资料库、CSV 预览、48px 工具栏和返回焦点检查，无页面错误。
- 安装包内 571 个前端资源与构建一致；Cowork 运行时代码和 smol-bin 与上一版已验证包哈希相同。

[资料库验证](../analysis/chat-cowork-ui-20261012/library-final-result.json) ·
[Chat/Cowork 回归](../analysis/chat-cowork-ui-20261012/chat-final-result.json) ·
[原生窗口验证](../analysis/chat-cowork-ui-20261012/native-ui-result.json) ·
[安装包校验](../analysis/chat-cowork-ui-20261012/package-verification.json)

[原生项目页](../analysis/chat-cowork-ui-20261012/native-projects.png) ·
[原生资料库](../analysis/chat-cowork-ui-20261012/native-artifacts.png) ·
[深色资料库](../analysis/chat-cowork-ui-20261012/native-artifacts-dark.png)

## 交付

`releases/OpenClaude Desktop-darwin-arm64/OpenClaude Desktop.app`，版本 **0.2.181**。
已运行的旧进程需要退出后重新打开此应用，才能加载新版。


## 剩余边界

这批同步不代表全应用 1:1 完成。Cowork 首页任务列表/推荐内容、计划任务页面以及部分菜单、弹窗
仍有较旧来源的组件。项目详情的本地文件夹和指令功能、资料库的本地文件读取与预览是宿主适配。
Cowork VM 运行时未在本轮改动；0.2.180 的真实 VM 验证见 `docs/chat-cowork-20261012.md`。
