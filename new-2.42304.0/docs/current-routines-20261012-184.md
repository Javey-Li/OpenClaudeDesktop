# 计划任务 UI 同步 — 0.2.184

基准仍为当前安装的 Claude Desktop **2.31226.0**，安装 archive 与拆包清单的 SHA-256 再次一致。
本批直接提取当前组件声明；截图仅用于检查运行后的本地结果。

## 替换内容

- 当前 Page 容器、任务卡片 `Fi`、状态文案 `yi`、操作菜单 `GV`。
- `ccd3f68fe-CZhDe3qc.js` 的 `_o` 详情页、运行记录和跳转、分组标题、任务状态、
  指令预览、文件夹、日期与权限信息。
- 六个 `gc` 模板的原始文案、预览插图、时钟提示、hover/focus 效果；
  原版响应式双栏 class、ObjectStopwatch 插图和 `Ii` 波浪分隔线。
- 当前 scheduled copy 与日期格式化依赖。菜单、弹窗和任务数据由已有本地服务连接。

提取脚本 `app/scripts/extract-current-chat-ui.mjs` 现在生成 54 个可达模块，保留声明来源与
source/output SHA。新增服务边界仅涉及账号/云端迁移、远程设备、连接器和实验开关；
本地没有的数据不伪造成云端状态。详情使用 scheduled 分支，未启用云端 unified/routine 账号实验。

指令预览使用原版 prompt 渲染器。宿主 RoutineDialog 补上 controlled open/onOpenChange，
使原版组件的展开状态、关闭及焦点恢复一致。一次性任务 fireAt 使用毫秒时间戳匹配当前源接口；
页面仍遵循本地调度服务的启停/执行数据。删除确认明确保留会话和文件。

## 验证

- 构建与源码哈希验证通过。
- `current-routines`：六个模板填入、两栏到单栏、创建、无效 cron 阻止保存、
  放弃修改确认、键盘菜单暂停、指令完整预览与关闭后的焦点、编辑频率/权限、
  运行记录、重启持久化、一次性任务和删除保留历史；700/900/1440px 与深浅主题。
- `current-chat`：发送与活动面板；Chat/Cowork 四种宽度下字号、行高、Logo 间距；
  六种高度及 prerender 分支的输入框绝对位置与未修改的当前源码 CSS 对照通过。
- `current-home`：推荐预览和填入、任务排序/折叠/清除活动、计划任务跳转及深浅主题通过。
- 签名的 0.2.184 原生应用：原版空状态/双栏模板、键盘暂停菜单、详情、完整指令弹窗、
  深浅主题通过，无 renderer 异常。

运行链路测试使用独立 profile 的 Codex fixture runner：新建任务保存后，在应用关闭时将该测试
任务切到已有 Codex runner，再测试按钮、IPC、历史与调度。它不证明真实 Cowork VM 已能启动。
真实新建 Cowork 任务的 UI 验证暴露了另一个现有后端问题：自动生成的 scheduled-tasks 工作目录
未进入 workspaceQueryRoot 的允许列表，开始执行时会报 Unknown workspace directory。
该失败保留在 ui/failure.json（早期尝试）中，本次没有改动或发布后端修复。

## 发布与剩余工作

发布路径：`releases/OpenClaude Desktop-darwin-arm64/OpenClaude Desktop.app`，版本 **0.2.184**。
571 个前端文件与构建一致；164 个后端文件与前一 UI 包哈希一致，后端基线为 0.2.181。
`package-ui.mjs` 备份了 0.2.183，并记录组合构建来源和签名验证。

证据在 `analysis/current-routines-20261012/`：`routines-result.json`、`chat-result.json`、
`home-result.json`、对应 `*-suite-result.json`、`native-result.json`、`package-verification.json`。

当前创建/编辑表单仍来自旧版已接通的组件；后续继续迁移新版表单和其它残留旧来源 UI。
本批并不代表全部 Chat/Cowork 已完全一致，也没有宣称 Cowork SDK/API/VM 问题已解决。
