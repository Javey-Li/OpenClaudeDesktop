# Chat / Cowork — 0.2.180 验证记录

本轮从 `/Applications/Claude.app` 重新拆包。实际安装版本是 **2.31226.0**；
官方窗口提示的 **2.31226.1** 仍是待安装更新，没有拿待安装版本冒充本轮来源。
新快照位于 `reference/installed-2.31226.0-20261012`，记录 ASAR、前端和运行资源校验值。

## 界面

按当前版本源码提取 13 个相关模块，同步 Chat/Cowork 首页布局、Logo 与标题间距、
输入框及底部操作栏、回复区域和进度侧栏。标题栏使用当前尺寸和控件位置。
进度侧栏保留原版步骤折叠、运行状态动画、空状态插图及键盘操作。
生成规则和来源边界见 [源码记录](chat-cowork-source.md)。

四种窗口宽度、独立草稿、真实 Electron IPC 的 fixture 发送、回复宽度与字体、
进度事件和鼠标/键盘折叠检查通过。打包后的原生可见窗口也已启动检查，没有页面错误。

- [原生 Cowork 首页](../analysis/chat-cowork-20261012/native-cowork-home.png)
- [进度侧栏](../analysis/chat-cowork-20261012/ui/current-activity.png)
- [最终 UI 检查](../analysis/chat-cowork-20261012/ui-final-result.json)
- [原生窗口检查](../analysis/chat-cowork-20261012/native-ui-result.json)

## Cowork 运行时

- 修复 Electron 强制复制 APFS 镜像时的 ENOSYS：使用 macOS 原生 clone，并校验独立 inode。
- Swift VM 在带虚拟化权限的 Electron 主进程运行循环中启动；补齐 smol-bin 磁盘与 SDK 校验元数据。
- 第三方 Key 与官方代理凭证分开；模型请求经 VM 代理及指定地址/端口白名单。
- SDK 启动后进入选择的文件夹，修复 NO_PROXY 导致的 ENETUNREACH。
- 会话关闭等待原生进程退出，修复立即恢复时的 “process already running”。

**53 项 Cowork 单元检查通过。** 签名后的 0.2.180 包通过真实 VM 启动、SDK 初始化、
流式消息往返、一次工具权限审批、实际写入 `outputs/cowork-smoke.txt`，以及立即恢复同一会话。
这些测试使用本地确定性模型接口和测试 Key，未调用付费模型，也未使用 Claude 账号凭证。

- [打包版文件写入和恢复](../analysis/chat-cowork-20261012/vm-packaged-resume.json)
- [安装包与源码/资源校验](../analysis/chat-cowork-20261012/package-verification.json)
- [运行时实现说明](cowork-kernel.md)

测试创建的 44 个 VM/SDK 资源目录已清理，保留结果、测试文件和日志。

## 交付与边界

应用：`releases/OpenClaude Desktop-darwin-arm64/OpenClaude Desktop.app`，版本 **0.2.180**。
仍在运行的旧应用进程需要退出后重新打开，才能载入新版。

这不是全应用 1:1 完成声明。项目、资料库、计划任务等页面仍有较旧源码组件；
语音和官方云服务未接入。Cowork 使用指定的 `~/cowork-ref` 与本机已安装的 Linux SDK，
模型接口目前要求兼容 Anthropic Messages。付费服务商的实际推理未在本轮验证。
