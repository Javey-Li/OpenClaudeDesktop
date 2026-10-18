# Claude Desktop UI 拆包研究（第一阶段记录）

已分析这台 Mac 安装的 **Claude Desktop 2.110.1**。目标是找到并整理原版 Code 图形界面的前端资源，为独立 UI + Codex 内核提供依据。

**当前交付：原始资源副本、格式化后的关键代码、依赖与样式索引，以及一次离线加载测试。尚未完成独立 UI，也尚未接入 Codex。**

## 已得到的文件

| 内容 | 位置 | 说明 |
|---|---|---|
| 完整 ASAR 解包 | `reference/asar/` | 337 个文件，包含 Electron 主进程、preload、窗口渲染资源等 |
| 外置前端资源 | `reference/ion-dist/` | 3,382 个文件，约 177.5 MB；包括 2,998 个 JS、20 个 CSS、字体和图片 |
| Code 路由 | `readable/code-routes.js` | 明确导出 CodeIndexRoute、CodeSessionRoute、CodeLayoutRoute 等 |
| Code 工作区 | `readable/code-workspace.js` | 原模块导出 EpitaxyFramePage、EpitaxySecondPane；Code 路由引用的工作区与第二面板 |
| 桌面侧栏相关模块 | `readable/desktop-sidebar.js` | 包含 `aside.dframe-sidebar` 与会话行；这是共享模块，不是独立组件包 |
| Composer 相关共享模块 | `readable/code-composer-shared.js` | 包含 code-composer、会话 presets 等相关状态；并非仅含输入框 |
| 桌面布局样式 | `readable/desktop-layout.css` | 侧栏、行高、间距、圆角、阴影、折叠与深浅色规则 |
| 设计系统样式 | `readable/design-system.css` | 原版字体声明、设计变量、组件样式和工具类 |
| 框架样式 | `readable/frame.css` | 原入口加载的 shared-frame CSS |
| 前端入口 | `readable/app-entry.js` | 来自 ion-dist/index.html 中的入口模块 |
| Electron 桥接 | `readable/electron-preload.js` | 包含 claudeAppBindings、claudeAppSettings 和 IPC 桥接 |
| 窗口壳 | `readable/electron-window.js` | ASAR 中的 MainWindowPage 模块，与 Code 工作区不同 |

`readable/` 文件名是分析时赋予的名称，内容仅经 Prettier 格式化。**它们仍是编译后的代码，不是恢复出的原始 TSX。** 原始文件对应关系保存在 `analysis/ui-map.json`。

## 已确认的关键结构

```text
app.asar
  .vite/build/index.pre.js       Electron 主进程入口（package.json 指定）
  .vite/build/mainView.js        preload / IPC 桥接
  .vite/renderer/main_window/    本地窗口壳

ion-dist/index.html
  assets/v1/index-C0ExfbM8.js     前端入口
  c9500abe8-a_EtjZjH.js          Code 路由集合
    CodeIndexRoute / CodeSessionRoute
      EpitaxyFramePage
        c11959232-DSGhSoTs.js    工作区与第二面板
  shared-23-DVf01Zkw.js          包含桌面侧栏
  shared-styles-BR5YpWif.css     桌面布局样式
  c6a992d55-CCAJX9iv.css         设计系统、字体与工具类
```

这是代码引用关系的静态分析，不表示所有文件已能脱离官方运行环境独立使用。

## 原版 CSS 中直接读出的数值

`readable/desktop-layout.css` 的 `.dframe-root` 基础规则包含：

| 变量 | 基础值 |
|---|---|
| `--df-sidebar-width` | `288px` |
| `--df-sidebar-left` | `8px` |
| `--df-header-h` | `48px` |
| `--df-radius-card` | `8px` |
| `--df-row-h` | `26px` |
| `--df-row-font` | `13px` |
| `--df-icon-size` | `16px` |
| `--df-radius-pill` | `6px` |

这些是特定规则的基础值，密度、窗口形态、折叠状态和其他选择器会覆盖，不能把它们当作所有页面状态的最终计算值。

`design-system.css` 提供 `anthropic-sans`、`anthropic-serif`、`anthropic-mono`、`Anthropicons-Variable` 等字体声明。`analysis/css-tokens.json` 保存全部扫描到的 6,810 条 CSS 自定义属性声明（1,504 个不同属性名），带来源与偏移；这是声明索引，不是经过层叠计算的最终主题。

## 独立运行实验

用全新、无账户信息的无头 Chrome 浏览器访问本地 `/code`。测试脚本阻止所有非本地网络请求，服务不代理官方 API，不模拟账户或授权。

观测结果见 `analysis/offline-load.json`：

- 共观测到 475 次页面资源/请求事件（不是 475 个已验证成功的独立模块）。
- 页面运行后跳转到 `/login?returnTo=%2Fcode%3F`。
- `/edge-api/bootstrap?...` 请求返回本地 404；页面截图为空白，未渲染 Code 工作区。
- 此次测试未捕获未处理 JS 异常；不代表所有功能正常。
- 截图：`analysis/original-offline.png`。

静态代码提供独立证据：`CodeLayoutRoute` 检查 `account`、`activeOrganization`，不同状态会进入登录/其他界面；preload 暴露 Electron 桥接；其他模块调用 `/api/organizations/`、`/v1/code/` 等接口。

**结论：UI 资源确实在本地，可以用来精确还原外观和分析交互；完整原版工作区不能仅靠静态文件服务在本次离线环境直接使用。** 本次没有修改官方包、获取会话凭据、绕过账户检查或解锁服务端功能。

## Source map 与校验

- `reference/` 中未发现 `.map` 文件。
- 216 个 JS 文件含 `sourceMappingURL=` 字符串；抽查 Electron 模块指向未随包提供的 `.js.map`。该数量是字符串扫描结果，不等同于 216 份可恢复映射。
- 327 个 ASAR 内打包文件通过内嵌 SHA256 校验。
- 10 个外置 native 文件与安装目录中的对应文件逐字节一致；它们与 ASAR 的原有 integrity 元数据不同。此差异已记录，未据此推断原因。
- ion-dist 的 3,382 个副本与安装目录中的文件逐字节一致。
- `analysis/integrity.json` 记录结果。这些校验用于验证提取保真度，不是发行商身份或安全性验证。

## 后续实现边界

1. 从已定位的 Code 工作区与侧栏追踪展示子组件，建立需要的 props、状态与 provider 清单。
2. 以这些原版样式、尺寸和结构为参考，建立由本地 fixture 数据驱动的独立 UI，逐个验证交互状态。
3. 将会话、流式消息、工具执行和审批状态映射到 Codex App Server。

目前没有声称已完成第 1–3 步。提取参考文件保留 Anthropic 原有权属；本目录不是一份新开源授权，也不是可发布的独立产品。

## 重现

```sh
# 重新提取安装包；只写入本研究目录
python3 scripts/extract.py

# tools/package-lock.json 固定分析工具版本
npm ci --prefix tools --ignore-scripts
node scripts/analyze.mjs

# 仅监听本机；原始页面测试地址 /code；不会代理外部 API
python3 scripts/serve.py

# 另开终端运行无账户、限制联网的加载测试
node scripts/check-original.mjs
```

`reference/` 保存全部副本；`analysis/` 保存 JSON 索引；`readable/` 适合直接在编辑器中阅读。实际提取入口固定为此机 `/Applications/Claude.app`，不要在提取副本中运行原应用的构建或安装脚本。
