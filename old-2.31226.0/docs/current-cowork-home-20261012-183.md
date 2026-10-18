# Cowork 首页同步 — 0.2.183

继续以当前安装版 Claude Desktop **2.31226.0** 拆包源码为基准；安装 archive 的 SHA-256
再次与拆包清单比对通过。这批替换 Cowork 首页仍使用的 2.2553.1 模块。

## 组件来源

- `shared-23-CuGEZNcW.js`：GF 活跃/置顶任务与计划任务列表，LF/zF 的过滤排序及保留顺序，
  HF 日期文案，xI 推荐列表，当前插图和颜色函数。
- `shared-19-DmuztgN-.js`：jI 任务行，包含新图标接口、固定宽度的 CaretRight 占位及状态区域。
- `shared-18-DaJGQi6_.js`：gD 任务图标、uD 状态标签、Ry 状态点和动画相位同步。
- `shared-2-DtKYxnkM.js`：当前未读/完成判断；`shared-100-Bs3K3KCN.js`：当前任务状态判断。
- `c2bf50d9e-Borm-ayr.js`：当前推荐 catalog 的 pool；首页保留适用于本地文件的三条选择，
  文案、插图、预览和点击填入采用当前源码。

提取器 `app/scripts/extract-current-chat-ui.mjs`，生成模块现为 33 个。
原始声明和 source/output SHA 保留在 `app/src/generated/current-chat/provenance.json`。

服务边界仍由本地会话、未读/置顶记录、审批和计划任务存储提供。云端权限 Review 弹层不假装存在，
需要操作时打开实际会话。推荐选择是本地能力筛选，不模拟官方账号实验或个人化服务。

## 修复的接入问题

把原始 UI 模块静态导入数据适配器会形成循环，让首页 greeting 在模块初始化时读取到尚未赋值的
字号常量；React 会静默丢弃这条 inline style。现改为页面向 `HomeIdeasContext` 注入 catalog 数据，
适配器不再静态反向导入组件模块，恢复原版字号。新增实际字号及行高验证，避免仅检查间距而漏掉回退。

## 验证

- 独立 Electron 首页测试：推荐 hover 预览不修改草稿；Enter 填入并聚焦，不自动发送。
- 任务五行折叠、显示更多/更少、排序、清除未读、保留置顶和会话记录、打开会话。
- 计划任务三行折叠，启用项排在暂停项前，箭头 hover 不改变文字占位，打开真实计划任务。
- 800/1200/1440px 无列表横向溢出，浅色/深色。
- Chat/Cowork 四种宽度的标题字号/行高/Logo 间距；600–1200px 高度与预渲染分支的位置回归。
- Chat 发送回复、活动面板，以及项目/资料库交互与持久化回归。
- 三项 Cowork 首页数据模型测试通过。
- 签名后的 0.2.183 原生窗口通过首页字号、列表折叠、计划任务跳转和浅色/深色验证，无页面错误。

证据目录 `analysis/current-cowork-home-20261012/`：`home-result.json`、`chat-result.json`、
`library-result.json`、`native-result.json`、`model-tests.log`、`package-verification.json`。

## 交付与后续

交付 `releases/OpenClaude Desktop-darwin-arm64/OpenClaude Desktop.app`，版本 **0.2.183**。
571 个前端文件与构建一致；164 个后端文件保持前次 UI 包哈希，独立 Cowork 启动修复仍在工作区，
没有混入此次 UI 发布。组合发布过程与上一版一致，记录在 `package-ui.mjs` 和包内 releaseAssembly。

完整 Chat/Cowork UI 同步尚未完成；接下来继续计划任务页面、表单/菜单与其他旧来源组件。
不要把这批首页测试当作全应用 1:1 的完成证明。
