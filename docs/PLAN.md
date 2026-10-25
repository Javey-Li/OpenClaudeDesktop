# 开发路线与施工顺序

目标：个人使用的完整 Claude Desktop 替代应用。按固定官方版本和实际账号界面逐项实现功能、交互、恢复与系统行为。阶段交付只决定顺序，不删最终范围。当前结果看 [STATUS](STATUS.md)，逐项完成条件看 [FEATURES](FEATURES.md)，运行命令看 [SETUP](SETUP.md)。

## 这次定下的做法

1. 在 Javey-Li/OpenClaudeDesktop 的 main 延续开发，保留 upstream 关系。只改 new-2.42304.0，不拼接两套旧新树。
2. 保留 Electron 宿主、DSH/Harness 桥、工具 host、预览、终端、项目和产物索引。先修真实缺口，不重写已有调用链。
3. UI 仓库是组件来源。选择组件、拆 renderer/main 入口、映射受控 props 和 tokens，保留它的 MIT 声明。演示计时成功必须删除。
4. 模型与执行内核分开。API 先走已有 Harness provider；个人订阅代码任务通过未修改官方 CLI 自行登录，新增窄适配，不读 OAuth token。
5. REA 查原版包和可观察行为，普通源码问题直接读代码。静态推断、运行观察、未知分开。原版 fuse 不改。
6. 当前文件和日志先由已有服务管理。需要跨表事务、全文搜索或恢复一致性时再引入 SQLite。先增加用得到的字段，不预建九个 packages 或全新大框架。
7. 云端任务、同步和新 Artifacts 都在完整范围内。没有官方授权接口时做独立替代并注明差异，不把本地 agent 写成官方云 Cowork。

上一轮方案的取舍：Harness/浏览器/组件复用为 Keep；预先拆包和全量存储迁移为 Maybe，等实际调用证明需要；“必须取得作者旧 reference 才能开发”为 Deprecated，正常构建要消除这个隐藏前提；旧版官方功能当全范围为 Conflict，当前云与新产物必须另列；原版 UI/模型/云灰度仍有 Open Question。

## 系统沿着什么流程工作

```text
React界面（消息、项目、产物、任务、设置）
  → preload白名单 / 现有主进程服务
  → 会话与run状态 / 审批 / 已有持久化
  → core adapter（DSH、官方CLI，其他已有core按能力接入）
  → 模型、文件/PTY/git、MCP、Chrome/受控浏览器、桌面工具
  → 事件与文件结果 → 索引/版本 → UI
远程worker与本机在线桥后续接同一run事件格式，不另造第二套任务UI。
```

用现有 codex-compatible JSON-RPC 做兼容层。新功能不要把供应商私有事件直接散落进组件。只在实际跨层新增时定义需要的字段：sessionId、runId、attemptId、toolCallId、seq、state、error。取消必须走到模型请求和工具/子进程，不能只停止渲染。

任务状态至少区分 queued、starting、running、awaiting_approval、completed、failed、interrupted。恢复保留旧 attempt，以新 attempt 续做。浏览器站点、文件写入、shell、桌面 app 和远程连接器分别授权。审批过期和拒绝必须让调用终止，不进入“成功”状态。

数据按用途分开：Harness会话正文沿用原日志；项目指令/归属扩展现有元数据；附件保存原件、hash、提取结果和页码；Artifact用稳定ID+不可变revision，路径只是文件位置；恢复记录保存工具执行与确认结果。云端同步前明确删除墓碑、冲突和schema迁移，不用同步文件夹冒充持久任务队列。

## 依赖顺序和工作量

| 阶段 | 依赖 | 必须交付的结果 | 估算工程人周 |
|---|---|---|---|
| S0 工具和项目入口 | 无 | fork工作目录、固定工具、诊断、基础测试、完整需求和施工顺序；本次落地 | 1–2，含S1开始前的基线工作 |
| S1 可独立构建与基准 | S0 | 来源明确资源、真实窗口、隔离数据、一条真模型工具流程 | 与S0合计1–2；资源替换超出时重估 |
| S2 会话和执行可靠性 | S1 | 编辑/重试/队列/审批/取消/崩溃恢复/历史搜索 | 3–5 |
| S3 附件、项目与记忆 | S2 | 文档解析、项目知识和跨会话使用、可删除记忆 | 3–5 |
| S4 Artifacts全流程 | S2，文档产物依赖S3 | 版本/编辑/运行/导出，新Docs/Slides/Design等 | 5–9 |
| S5 Code和本地工作任务 | S2，与S3/4可部分并行 | 文件/PTY/git/worktree/preview、独立运行环境、skills/MCP/plugin | 4–7 |
| S6 浏览器、桌面、系统体验 | S2/5 | Chrome缺口、受控browser、OS控制、快捷入口/语音/通知/动效 | 4–7 |
| S7 云任务、同步和连接器 | S2，接口探索可提前 | 远程持久worker、跨端继续、在线桌面桥、OAuth和分享 | 6–12 |
| S8 完整范围回归 | S3–7 | 功能清单逐项有实际结果；升级/备份/长任务稳定 | 3–5 |

前提仍是一名熟悉Electron/React/Agent的全职工程师、AI辅助、Mac ARM64优先。总预算29–52人周，给资源重建、原版灰度和第三方变化留20%–30%，约35–68人周；不是确定完工日期。S1、S4、S7各用实际结果重估。个人兼职推进需按可投入时间换算。模型/API、云worker和文档处理可能另有使用费，不从订阅价推导。

## S1：先把可运行基础做实

| 编号/顺序 | 修改位置与具体工作 | 完成条件 |
|---|---|---|
| S1-01（已做输入诊断） | scripts/doctor.mjs、prepare-ui.mjs、current-design-assets.mjs、generated provenance；区分3个快照和build/runtime资源 | 缺文件逐项列出；不能以一个目录存在或Vite编译通过宣称UI可用 |
| S1-02（下一项） | app/scripts/prepare-ui.mjs、package scripts、src/source-pet.jsx、src/main入口/CSS；拆抽取验证与日常构建 | 正常build不读仓库外旧快照；合法自制装饰替代缺失宠物；CSS/font/icon不404；不伪造hash文件 |
| S1-03 | UI参考中的cds-pure/theme与本项目styles按入口映射；先首页→设置→会话→文件/预览→项目/产物 | 逐屏截图与键盘/主题检查；完整路由仍可操作；视觉差异留在对应功能项，不把它们删掉 |
| S1-04 | core-registry、core-manager、harness model/account/transport；API先用现有provider，官方CLI用stream-json窄bridge | 真实模型在隔离fixture读文件→请求写入→拒绝→再次批准→写入→汇报；账单路径可解释，日志不含key |
| S1-05 | Chrome脚本、Harness fixtures、原生PTY；把测试所需合法输入纳入仓库或由本项目生成 | 原始Electron P0–P5通过；缺失streaming-response fixture不再引用作者外部目录；成功与失败流均验证 |

S1-02不允许用空Lottie JSON、空player或未加载的CSS换取绿色build。若合法资源替换需要改生成视图，保留原props和业务服务连接，按屏幕逐项替换。根目录MIT存在，但不自动覆盖从官方包抽出的JS/字体/插图；每个新文件写清来源，不能给官方内容补一行MIT了事。

## S2：会话、任务和恢复

| 编号 | 具体修改 | 应通过的场景 |
|---|---|---|
| S2-01 | harness queue/store/projection、session-operations、retry/fork/revert；明确message parent/branch、附件归属和attempt | 三轮后编辑第一轮，旧分支仍在；重试不重复旧工具；退出后历史一致 |
| S2-02 | interrupt-turn、agent-tools-host、sandbox-approval、background-tasks；统一取消与审批失效，能力按core显示 | 拒绝无副作用；长命令/浏览器调用可中断；迟到结果不覆盖新run；不存在的能力不显示为成功 |
| S2-03 | session持久化与恢复记录；必要时增加事务表，不迁走全部旧session | kill后重启，已完成写入不重放；未知外部副作用需确认；队列/后台进程/计划任务分开恢复 |
| S2-04 | 历史索引、上下文压缩/搜索、用量服务 | 正文/标题检索、归档过滤；compact失败解锁；计费按provider，删除后检索不再命中 |

## S3：资料、Projects和记忆

先统一附件摄入。复用composer staging和file读服务，新增Attachment记录：assetId、hash、MIME、source、状态、页/表信息。原生文档API和本地提取是adapter选择，不能让file chip决定“已读”。PDF图文、扫描件、Office表格、损坏和超限文件构成固定测试集。先测试现有core的原生处理；确有缺口再评估PDF.js/Docling等，保留许可和离线成本。

然后扩展local-projects：CRUD/归档/会话归属、指令更新、项目资料版本与引用。补Chat/Code归属，不只Cowork目录。两个会话使用同份资料，修改/删除后旧会话重开不得继续引用旧索引。检索先做可解释的全文/分块，必要时加语义检索。

记忆独立于会话正文和项目资料：支持查看、编辑、暂停、删除、隐身和项目隔离。只凭模型输出“记住了”不算持久化。阶段结果是“项目+图文PDF→新会话引用页码→修改资料→另一个会话得到新内容→重启仍正确”。对应F05–F11。

## S4：Artifacts与文档产物

扩展artifact-index，稳定artifactId，不再用thread+path当唯一版本身份。先保存blob hash、revisionId、parentRevision、originMessage/tool、runtime和依赖锁；写同一路径不能覆盖历史。用户编辑和模型修改都生成revision。preview、source、export必须指向同一revision。

按依赖顺序实现：HTML/SVG/Markdown/表格→React编译与依赖→文档/幻灯片/Design画布→数据型dashboard及可用beta模板→发布与应用数据。复用file-preview-frame和现有viewer，编译/导出放受限worker；Sandpack等只在本地离线/网络边界测试后引入。

完成场景：生成→修改三版→直接编辑→对话再改→比较→回退→导出→重启；每版内容可复现，导出可打开。发布/分享要能撤销，运行预览不能取得host文件、密钥或用户Chrome会话。对应F12–F16，发布依赖S7。

## S5：Code与本地工作任务

先复测现有PTY、fs/git、worktree、diff、preview。预览renderer sandbox不隔离dev server，需将server进程纳入权限、端口、退出清理和工作目录限制。两worktree并行不能互写。文件回退与会话revert分开显示，先预览再落盘。

Cowork实验代码继续保持隔离，不直接把官方VM/native addon当独立开源基础。先用现有本地进程执行器完成可验证任务，再评估许可清楚的VM/container：挂载、出网、取消、权限、恢复都通过后接Cowork状态机。队列恒空、仅text输入的现状要补，不靠开一个环境变量宣布完成。

Skills/MCP/plugins/hooks/命令优先复用现有registry与host。补安装/发现/启停/卸载/取消/结果格式，不仅显示列表。官方CLI的工具与app工具避免重复注册。阶段场景：安装skill→启动任务→本地MCP读取测试目录→修改文件→生成产物→取消并恢复。对应F17–F23。

## S6：浏览器、桌面与系统

先扩展已通过的Chrome Bridge：可信输入/CDP、截图、上传下载、iframe/Shadow DOM、并发会话tab归属、断连重连、extension侧取消和跨站权限。按可控fixture逐项测试，再测真实站点。不要把Chrome computer工具当OS computer use。

受控浏览器复用现有WebContents/Playwright能力，独立profile；桌面工具单独封装AX、截图和输入，按app授权，处理缩放、多屏、焦点及辅助功能失败。模型是否能看图/选工具与工具是否正确执行分开测试。

系统体验包括Quick Entry、全局快捷键、窗口/托盘/通知、截屏上下文、语音、输入法、reduce-motion、滚动锚定和多窗恢复。UI参考仅提供起点，动画参数需观测，不能把项目自加spring当官方事实。对应F24–F28。

## S7：云、同步、连接器和发布

不等所有本机功能完成才研究接口，但先保持一个run格式。远程worker保存任务、attempt、租约、输出blob和事件seq；重试使用幂等键。云任务能在Mac关机后继续，本地文件/Chrome/GUI要通过已授权在线桌面桥；设备离线时明确等待，不能伪造已访问本地。

个人同步先解决设备身份、离线冲突、墓碑删除、schema版本和备份恢复，再增加多端UI。官方账号数据不从私有cookie抓取；从用户授权导出或明确公共接口接入。SaaS连接器逐服务OAuth，撤销后实际调用失败；写入操作有可审查结果。

工件发布独立托管，不开放任意本机路径；版本固定、分享可撤销。模型账单、worker和对象存储分别记录。订阅、模型API与官方云功能不是同一个权限。对应F29–F33。

## S8：完整日常替代的完成条件

功能表所有目标项都有对应实现、可复现真实场景与适用边界。采用替代方案的功能标出与原版差异，不能将missing改成“不需要”。保留断网/睡眠/重启/取消/拒绝/损坏文件/权限撤销等失败场景，进行升级迁移、备份恢复和长任务检查。Windows/Linux是否跟进另排，不能因此降低本次Mac完整范围。

优先从真实日常流程验证：找旧聊天→带附件继续→项目引用→修改文档/代码→浏览器取信息→审批→后台运行→中断/恢复→查看产物版本→导出/分享→下次打开接着做。测试通过和主观体验分别记录，不用组件数量换算完成度。

## REA每次研究要得到什么

| 具体问题 | 方法与环境 | 要留下的结果/后续实现 |
|---|---|---|
| 选定官方版本有哪些模块和动态未知边 | 固定app版本/签名/hash，静态ASAR图，缩小到对应模块 | 方法/路径/未知，不复制私有服务器逻辑 |
| 一次点击经过哪些IPC与进程 | 先查fuses；支持时观察，否则静态+原生AX/截图 | channel/shape/时间线→preload与host API行为测试 |
| 项目、附件和Artifact如何更新/恢复 | 无敏感样例，创建/修改/删除/离线/重启 | 状态差异和资源版本→失效/恢复规则 |
| stop/审批/崩溃是否还会有副作用 | 可控临时目录、延迟工具、kill/reload | 事件seq、退出与落盘→取消和幂等测试 |
| 动画、焦点、滚动和窗口规则 | 固定尺寸/缩放、AX和录屏、reduce-motion | 几何/时序/焦点规则；没测到的精确参数保持未知 |
| 云与本机职责 | 文档、授权网络类别观察和离线对照 | 云继续/本机不可达差异→worker和在线桥状态 |

本机官方3.6556.2已经由REA确认EnableNodeCliInspectArguments与RunAsNode为disabled。主动Inspector路径受限，不修改fuses绕过；优先静态ASAR和原生UI观察。技能已装，CLI已测，MCP不注册也能完成这些CLI调查。需要实时工具时再按固定客户端scope注册，不为安装本身重写全局配置。

## 授权和还不能替用户提供的条件

2026-10-26重新核实：Pro/Max新Cowork任务在云端；个人用户可在未修改的官方CLI内登录，但第三方不得中介Claude.ai凭据。参考：[Cowork云与本机](https://support.claude.com/en/articles/15520349-use-claude-cowork-on-web-desktop-and-mobile)、[认证与凭据](https://code.claude.com/docs/en/legal-and-compliance#authentication-and-credential-use)。CLI/API接入不自动提供官方Projects、Artifacts和云会话。

可独立完成的工具、clone、依赖、诊断、fixture、路线和基础检查在本次做完。无法代替的是模型/订阅账号实际授权、目标connector的OAuth、OS交互权限和云资源费用。这些只在对应实现可审查时集中提出；不阻止继续S1构建与资料工作，也不把“缺账号”写成整个项目不能开始。
