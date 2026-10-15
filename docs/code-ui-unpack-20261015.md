# Claude Desktop 2.37337.1：Code UI 重新提取与源码索引

日期：2026-10-15（Asia/Taipei）。来源为本机 `/Applications/Claude.app`，Info.plist 的版本与 build 均为 **2.37337.1**。比较基线为 **2.31226.0**。本轮完成新版本完整资源提取、Code 入口重新定位、可读代码整理、依赖索引及逐文件校验；产品 UI 的移植不属于本轮交付。

## 交付位置

| 内容 | 路径 |
|---|---|
| 新版完整资源快照 | `reference/installed-2.37337.1-20261015/` |
| ASAR 全部内容与外置 native 文件 | 快照内 `asar/` |
| 全部前端、CSS、字体、图片、i18n、frame 资源 | 快照内 `ion-dist/` |
| 文件 SHA-256、应用版本与源路径 | 快照内 `manifest.json` |
| Code 分区导航、可读导出名称与行号 | [CODE-INDEX.md](../analysis/code-ui-unpack-20261015/CODE-INDEX.md) |
| 格式化后的前端、CSS、Electron 壳与 preload | `analysis/code-ui-unpack-20261015/readable/` |
| 原文件 → 可读文件、双份 SHA-256、旧版候选 | `analysis/code-ui-unpack-20261015/ui-map.json` |
| 顶层命名函数位置 | `analysis/code-ui-unpack-20261015/symbols.json` |
| 全部前端模块的 ESM 导入、动态导入与导出 | `analysis/code-ui-unpack-20261015/module-imports.json` |
| 从 Code 路由、工作区可达的依赖 | `analysis/code-ui-unpack-20261015/code-dependency-closure.json` |
| Code 标记、CSS 变量和选择器索引 | `feature-hits.json`、`css-tokens.json`、`code-selectors.json`，均在同一分析目录 |
| 新旧同文件族体积、导出、字符串差异 | `analysis/code-ui-unpack-20261015/baseline-diff.json` |
| 提取校验 | [integrity.json](../analysis/code-ui-unpack-20261015/integrity.json) |
| 分析统计与错误清单 | `summary.json`、`errors.json`、`analyze.log`，均在同一分析目录 |
| Claude Code 的并行研究指令 | [Prompt](claude-code-parallel-ui-prompt-20261015.md) |

旧版 `reference/` 快照、根目录 `readable/` 和产品代码保持原状态。新版使用独立目录，不移动 `current-*` 路径，不改变现有构建所引用的资源版本。

## 数量与完整性

| 项目 | 旧版 2.31226.0 | 新版 2.37337.1 |
|---|---:|---:|
| ASAR 条目 | 481 | 500 |
| 外置前端文件 | 3,768 | 3,847 |

- 解析 **3,426** 个前端 JavaScript 模块。
- 格式化 **270** 个文件，覆盖 Code 相关模块、共享桌面模块、全部 25 份 v1 CSS，以及选定 Electron 壳 / preload。原始资源已全量保留，格式化集是供阅读的重点子集。
- 从两个 Code 根模块经字面量 ESM 静态、动态导入可达 **3,407** 个模块。它包含共享路由及其他模式的传递依赖，不能解释为 3,407 个 Code 专属模块。
- CSS 索引记录 **5,784** 条声明、**1,820** 个不同自定义属性名；不是经过层叠后的最终样式。
- **0** 个解析 / 格式化错误，**0** 个缺失的已识别本地 ESM 导入，**0** 个随包提供的 `.map` 文件。
- 500 个 ASAR 文件、3,847 个前端文件和 1 个随快照保存的运行时镜像，均与安装目录内容逐字节一致；副本问题为 **0**。
- 10 个外置 native 文件的原有 ASAR integrity 元数据与安装文件不一致，但副本与安装文件逐字节一致。这与旧版记录同类，已单独列入 `integrity.json`，未把它们计为内嵌哈希通过。

安装包 ASAR SHA-256：

```text
82a54170115e3e20c9600a257a5b2679cbadb83f38baf5111235f123af484163
```

## 新版 Code 入口

```text
ion-dist/index.html
  前端入口与共享路由
  c9500abe8-_dvMAnUO.js
    wa → CodeIndexRoute
    Ca → CodeSessionRoute
    xa → CodeLayoutRoute
    c11959232-BLXfQuwv.js
      em → EpitaxyFramePage
      vm → EpitaxySecondPane
```

关键映射已重新从新版导出和 import 关系确认。旧版文件名、混淆符号与行号不能继续套用。Code 主页、输入框和会话逻辑分散在 `cc43287c9-CNtlFMhj.js`、`cd5a31703-Byc-oNJo.js`、`cf74bc599-3YM7j6aS.js` 等共享文件中，不应仅提取路由文件。

分区导航覆盖：首页、侧栏、标题栏、输入框、对话、审批与排队、Files、编辑器、Diff/Git、Terminal、Preview、设置、命令面板、快捷键、弹出窗口、布局命令和设计样式。详细文件名和可读导出见 `CODE-INDEX.md`。

## 已直接核对的变化

以下行号均相对于 `analysis/code-ui-unpack-20261015/readable/`。这里只列已人工复核的样例，不将自动字符串差异当成完整的产品变化清单。

| 区域 | 源码确认的变化 | 新版证据 |
|---|---|---|
| 侧栏分组 | `.df-session-list` 的分组上边距由 `calc(20px - var(--df-row-stack-gap))` 改为 `calc(10px - var(--df-row-stack-gap))` | `shared-styles-C6yuIsHz.css:388` |
| 置顶列表 | 桌面、非 phone sheet、compact Code 侧栏新增 `[data-pinned-list]` 专门覆盖：26px 行高、20px 控件、1.5px 行间距、9px 分组间距、2px 描述裁切 | `shared-styles-C6yuIsHz.css:414` |
| 方向与窗口控件 | traffic-light 留白分为 start/end；路由、侧栏、消息等大量样式改用 inline-start/end、ps/pe、ms/me；不是单纯重命名文件 | `shared-styles-C6yuIsHz.css:1046`；`c9500abe8-_dvMAnUO.js` 的 baseline-diff |
| Files 菜单 | 新增 `files-thimble` / “Auto save” checkbox 菜单项，保持菜单开启并写回偏好；存在 `l && k` 条件，不代表所有会话均展示 | `cccc2cf0a-CTtFjPG4.js:7331`、`:7387` |
| 编辑器 | 出现单独的 active indent guide 色值及缩进计算逻辑，默认 active 混色 40%、普通 14%；旧包装层的 repeating-linear-gradient 字符串被替换 | `cbd02b8f2-vu6Kl_xC.js:771`，同文件后续引导线实现 |
| Diff 范围持久化 | 旧版全局 `epitaxy-diff-scope` 改为 `epitaxy-diff-uncommitted-sessions`；按 session id 判断 uncommitted，否则 branch，写入时保留至多 50 个 id | `c03935b01-CBfL8GES.js:887`；旧版可读 `c03935b01-DOWikwO_.js.readable.js:894` |
| 更早消息入口 | 新增 `$lt`：“Earlier messages”、`CaretUp`、xs ghost 按钮及 loading 分支；原有 “Load earlier messages” 入口仍保留。具体挂载条件需要继续追踪调用方 | `cd5a31703-Byc-oNJo.js:97503`、`:97541` |

另有 `See all`、`Switch to auto mode`、`Computer use` 文案和 `cai_fizzy_nest` / `in-data-cds-fizzy` 条件样式变化。这些已收进差异与源码索引，尚未据此判断用户实际启用的界面分支。

同文件族匹配只用于导航。尤其 `shared-N` 可能重新分组；某字符串从一个 chunk 消失，不代表该功能删除。对照时应结合所有模块搜索与实际 import 链。

## 重现

在仓库根目录执行，提取目标应使用新的独立目录；现有提取器会覆盖目标中的同名文件，不会自动清理旧文件：

```sh
python3 scripts/extract.py --output reference/installed-<version>-<date>

node scripts/analyze-code-snapshot.mjs \
  --snapshot reference/installed-2.37337.1-20261015 \
  --baseline reference/installed-2.31226.0-20261012 \
  --output analysis/code-ui-unpack-20261015

python3 scripts/verify-code-snapshot.py \
  --snapshot reference/installed-2.37337.1-20261015 \
  --output analysis/code-ui-unpack-20261015/integrity.json
```

分析器使用项目现有的 `tools/node_modules/prettier` 及 Babel parser，不执行提取出的应用代码。校验器比对快照、manifest、安装源、前端完整文件列表及 ASAR 内嵌 integrity。

`CODE-INDEX.md` 和 `symbols.json` 是本轮额外生成的阅读导航；分析器命令重建核心 JSON 索引与可读文件，不自动重写这两份导航。换版本后需要重新生成导航及核对报告行号。

## 交付范围

这是新版资源与静态源码研究结果，不是可独立运行的官方 Code 应用，也不是 UI 移植完成报告。可读文件仍是编译产物；没有 source map，不能声称恢复原始 TSX。服务端状态、账户与功能开关影响实际界面，本轮未进行官方运行态截图对比。

Claude Code 的并行任务专门负责逐区域差异审计与本项目迁移清单，输出目录为 `analysis/code-ui-audit-20261015-claude/`，与本轮文件分开。这里只提供了可复制的 Prompt，没有通过工具启动或向 Claude Code 发送任务。
