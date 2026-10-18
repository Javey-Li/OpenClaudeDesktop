# Chat / Cowork 首页位置 — 0.2.182

本轮按用户最新要求优先修复 UI，直接对照本机 Claude Desktop **2.31226.0** 的拆包源码。
已再次校验 `/Applications/Claude.app/Contents/Resources/app.asar` 的 SHA-256 与现有拆包清单相同。
没有用截图估算偏移。

## 原因与修复

1. `shared-19-DmuztgN-.js` 的 `aj` 定义 home 留白：普通桌面高度使用 28% + 0.56875rem，
   高度达到 900px 后使用 32% + 0.56875rem；另有显式 tall/short 预渲染分支。
   原版 `c6a992d55-C0zTICcS.css` 使用 `html[...]` 祖先条件实现这些分支。
   之前把整个 CSS 包在 Chat/Cowork 的 `@scope` 内，导致这些条件无法匹配作用域外的 html。
   独立复现中，1000px 高度的原版 padding 为 329.1px，宿主仅 289.1px。
   `prepare-current-chat-ui.mjs` 现在把两条原版条件规则保留在 scope 外，目标通过零特异性的
   `:where(.source-chat-tile-content:not([data-surface="code"]))` 限定，保留原来的媒体查询与层。
   没有重写原版留白数值或添加固定位置补偿。
2. Chat/Cowork 顶部栏的 48px 规则与旧 Code 的 40px 规则特异性相同，受导入顺序覆盖。
   调整宿主选择器后，48px 高度正常生效。来源为当前 `ca2ef848d-Dz47ULRM.js` 的 DQ 标题栏。
   Code 顶部栏原有 40px 高度经原生窗口验证保持不变。

## 验证

- Chat/Cowork：600、800、899、900、1000、1200px 高度，以及 tall/short/activation-height 分支。
  每项把同一个布局 class 放进独立 iframe，直接加载未经改写的安装版 CSS，比较计算值；
  同时验证顶部栏、标题和输入框的实际位置。两种模式共 18 个位置场景通过。
- 原有四种宽度的 Logo / 标题间距、Chat 发送回复、活动面板回归通过。
- 项目 / 资料库交互、持久化、搜索、预览与深色布局回归通过。
- 已签名安装包原生窗口通过 Chat/Cowork 布局、Code 顶部栏隔离检查，无页面错误。
  原生 1000px 请求被当前屏幕限制到 863px；900px 及以上由独立 offscreen Electron 验证，
  不将这部分描述为原生大屏验证。
- 包内 570 个前端资源（不含组合发布的 build-info）与构建完全一致，签名通过严格校验。

证据：`analysis/chat-cowork-layout-20261012/`，含 `scope-before.json`、两种模式的
`*-home-position.json`、`chat-result.json`、`library-result.json`、`native-result.json`、
`package-verification.json`。

## 发布边界

交付：`releases/OpenClaude Desktop-darwin-arm64/OpenClaude Desktop.app`，**0.2.182**。
这次只更新 UI；发布时以 0.2.181 包为基础替换前端，164 个 Electron 后端文件哈希保持一致。
工作区前一轮 Cowork 启动修复仍保留，未混入这次 UI 包，待单独完成真实 VM 验证。
组合发布信息写入包内 `dist/build-info.json` 的 `releaseAssembly` 字段，脚本为
`analysis/chat-cowork-layout-20261012/package-ui.mjs`。因此从当前工作区执行普通 `npm run package`
会包含尚未完成验收的 Cowork 后端变更，不能等同于此次 UI 包。

本轮解决首页输入框偏上的已复现问题，不代表所有页面及动态状态已达到完整 1:1。
