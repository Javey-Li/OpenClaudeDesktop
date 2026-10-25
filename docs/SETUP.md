# 安装和运行入口

当前支持 macOS Apple Silicon、Node 24.22.1 及更新的 Node 24、npm、Python 3、Git。根目录 .node-version 固定本次实际版本。工具已安装不代表产品 UI 已可运行，当前结果见 [STATUS](STATUS.md)。

## 一次安装

```bash
npm run setup
npm run doctor
npm run check
npm run check:rea
```

setup 使用已有锁文件安装 app/harness/tools，单独准备 Electron 和 node-pty，安装固定版本 REA，检出参考仓库，并安装固定技能。不改全局 npm、Node、MCP 配置或 Chrome 设置，不安装原版提取资源。重复执行会重建依赖；遇到不同版本参考仓库或技能会停止，不覆盖本地改动。

技能安装使用 Codex 自带 skill-installer。位置从 CODEX_HOME 或默认 ~/.codex 获取。没有该安装器的环境仍可用 CLI、源码和测试，但需要先提供该安装器，或单独按 dev-tools.lock.json 安装技能。技能在下一轮对话可被发现；不需要把技能正文复制进项目规则。

## 本次安装的内容

| 内容 | 固定来源/位置 | 使用方式 |
|---|---|---|
| Ponytail 六个技能 | Javey-Li/ponytail@09c434a；Codex skills | 最少完整改动、review、audit、debt、gain、help；本项目完整目标优先 |
| ASD-STE100 | danyuchn/asd-ste100-skill@c7b11cd；Codex skills | 澄清英文工具描述、错误和Agent指令；中文方案仍用清楚的中文 |
| REA CLI | rea-agents@6.8.0；.local/tools/rea | npm run rea -- <command> |
| REA 技能 | morluto/rea@bc14312；Codex skills | 源码快照技能与 npm 包可能有细节差异，以已安装 CLI help/schema 为准 |
| UI 参考 | Javey-Li/open-claude-ui@c1f923a；.local/references/open-claude-ui | 查看/构建组件库，按需复制并保留许可，不整体装进 app |
| Harness 教学参考 | shareAI-lab/learn-claude-code@ce8f9f1；.local/references/learn-claude-code | 读指定案例，不当作生产内核 |
| REA 源码参考 | morluto/rea@bc14312；.local/references/rea | 查固定版本实现；npm 包和源码身份分别记录 |
| Desktop 执行依赖 | new-2.42304.0 下三个 npm 项目 | 沿用原锁文件，未安装旧树依赖 |

完整 Git SHA、SKILL.md SHA256 见 [dev-tools.lock.json](../dev-tools.lock.json)。REA npm tarball依赖/完整性由 [tools/rea/package-lock.json](../tools/rea/package-lock.json) 固定。其版本6.8.0是本次查询npm latest的结果；新源码main已前进，未自动追浮动分支。

## 有区别的检查

```bash
# 工具检查。只输出状态，不打印密钥。
npm run doctor
npm run doctor -- --json

# 已知官方构建输入缺失时返回非零；不能用来替代真实build。
npm run check:build
npm run build

# 选定基础测试与原生PTY，不含真模型/VM/完整GUI。
npm run check

# 实际REA静态分析。只分析仓库自己的fixture，不执行fixture代码。
npm run check:rea
npm run rea -- inspect-electron-fuses /Applications/Claude.app --format json

# 原始Electron+隔离Chrome profile，不改日常浏览器。
npm run check:chrome
```

原始Chrome脚本会用本机Chrome for Testing。没有时，用当前项目 tools 中 Playwright 下载 Chromium，而不是改日常Google Chrome的启动参数：

```bash
cd new-2.42304.0/tools
npx playwright install chromium
```

默认Chrome验收不调用模型。真模型的session验收另外执行，明确记录所用账号/provider与费用归属，不能把P0–P5通过当模型已正确选工具。

## 模型、配置与数据

本机有官方 Claude Code CLI 2.1.296，尚未测试其登录状态或模型调用。个人订阅登录由未修改的官方CLI自行处理；应用只消费执行协议，不读取或中转token。API模式通过应用自有设置或受保护的本机配置输入key，避免写进仓库。.env.example仅列变量名，脚本不会隐式读取它。

开发运行时应显式指定隔离数据目录，避免读取已有应用会话：

```bash
CODE_DESKTOP_DATA="$PWD/.local/data/desktop" \
DSH_HOME="$PWD/.local/data/dsh" \
npm --prefix new-2.42304.0/app start
```

这条命令需要先构建出 app/dist/index.html。当前源码build因缺官方历史reference而受阻，直接启动不能代替完成构建。模型连接、目录授权、macOS辅助功能/录屏权限、远程worker和OAuth分别在其阶段验证，不为完成setup就批量申请权限。

## 当前构建阻碍怎样处理

doctor列出三个独立快照的已知输入：current-2.2553.1、installed-2.31226.0-20261012、installed-2.42304.0-20261017。部分generator还会读取这些文件引用的其他chunk，所以已知文件都出现也不等于build通过。

当前已提交generated源码可供研究，但仍依赖缺失的宠物动画和运行时CSS。S1-02会把源码抽取校验与日常构建分开，并以来源明确的样式/资源替换缺失输入。保留现有业务组件和props。替换后必须验证资源404、样式、图标、焦点和真实窗口，不用两份空宠物文件或另一版本hash冒充原版。

不在setup安装Docling、Sandpack、Ghidra、Hopper、Java或整套VM。它们还不是当前可执行任务的必需依赖；在功能阶段通过小型测试集确认价值和许可后再引入。
