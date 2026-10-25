# 完整功能清单

目标为Mac个人日常替代，基准是官方3.6556.2候选与2026-10-26文档。具体账号灰度、GUI和模型行为仍需观察。表中“部分”表示存在实现，“未发现”只限已查路径，“未验证”不代表不可能。单个测试通过不把整行改成完成。状态与下一步只更新受本次改动影响的行。

路径省略 new-2.42304.0/ 前缀。每行的完成条件应包含真实模型/GUI验证；本次工具检查见STATUS，不冒充功能完成度。

| ID / 功能 | 当前状态与实现入口 | 缺口与边界 | 阶段 / 推荐实现 | 完成条件 |
|---|---|---|---|---|
| F01 聊天/流式/停止/模型选择 | 部分；harness index/transport、core-registry | 真模型/断流恢复未验证；每core不同 | S1/2，保留桥和provider | 多轮真实会话含一次工具、断流与停止；不多发请求 |
| F02 历史/搜索/归档/删除 | 部分；ThreadStore、session-operations | 全文、大历史和同步；原版云历史不自动继承 | S2，现有日志+索引 | 重启一致，标题/正文可搜，删除后检索失效 |
| F03 编辑/重试/分支/文件回退 | 部分；fork/revert/retry模型 | lineage、附件继承、文件回滚不能与revert混同 | S2，补字段和快照 | 编辑第一轮保留旧分支；重试不重复副作用；回滚有差异预览 |
| F04 上下文/compact/用量 | 部分；compact、contextUsage、usage | 模型限制、失败解锁、计费区分 | S2，保留服务 | 溢出可恢复，压缩必要事实不丢，账单来源明确 |
| F05 记忆/历史引用/隐身 | 未发现完整服务 | 模型自述不算持久化；需可控删除和隔离 | S3，独立可见记录 | 跨会话命中，暂停/删除后不使用，隐身不写入 |
| F06 Projects CRUD/归档 | 部分；local-projects | delete/archive、Chat/Code归属 | S3，扩展现有服务 | 创建/修改/归档/删除与重启一致，项目不串资料 |
| F07 项目指令/跨会话 | 部分；applyProjectContext | resume后指令更新，非Cowork surface | S3，项目上下文版本 | 两会话同指令，修改后旧会话恢复得到新指令 |
| F08 项目资料/解析/RAG/引用 | 专用知识库未发现；已有working folder | 解析、索引、更新删除和页码 | S3，统一附件摄入+检索 | 冲突PDF按来源/页码回答，更新删除即时生效 |
| F09 项目Library/云并行/分享 | 未发现完整实现；分享adapter为空 | 当前官方beta与传统项目区分，云端依赖 | S3/7，统一项目版本与worker | 并行线程继承同版本资料；跨端无静默覆盖 |
| F10 图片/拖入/粘贴附件 | 部分；composer-attachments-model、main staging | 视觉模型转换、重启路径与错误 | S3，保留staging和卡片 | 图片确实进入视觉请求；失败可解释；附件重启可读 |
| F11 PDF/Office/表格/扫描件 | core特定支持；ZCode attachment，files viewer | 文件可预览/下载不等于解析；OCR/表格/图文 | S3，先测原生core，再选解析器 | 固定图文/扫描/Office/损坏/超限集通过，引用可定位 |
| F12 生成文档/表格/幻灯片/PDF和导出 | 部分文件工具/present | 真实格式、分页、公式、渲染 | S3/4，隔离生成/导出worker | docx/xlsx/pptx/pdf可打开、可编辑，公式/图表/分页正确 |
| F13 Artifact生成识别/库/预览 | 部分；artifact-index、source-artifact-viewer | 类型和稳定身份，code surface排除 | S4，扩展索引和viewer | 成功产物出现，失败不出现，重启可打开对应内容 |
| F14 Artifact持续修改/版本/回退 | 当前同路径覆盖 | revision/直接编辑/冲突与恢复 | S4，不可变blob+revision | 三版本、直接编辑、对话再改、回退、重启都可复现 |
| F15 HTML/SVG/React运行 | HTML frame部分；React专门运行器未发现 | JSX/依赖、网络、CSP、错误和资源隔离 | S4，复用frame+受限编译worker | 运行/报错/修复均正确，不接触host密钥和用户cookie |
| F16 新Docs/Slides/Design/Dashboard及beta产物 | 完整模板体系未发现 | 画布模型、导出、连接数据；实际账号beta范围 | S4/7，按类型编辑器共享revision | 对话和直接编辑不互盖，导出对应同版；beta逐项观察 |
| F17 Code文件/PTY/git/worktree/diff | 部分；files、terminal-service、git-status、worktrees | 并行、边缘路径、原生模块和模型E2E | S5，复用宿主 | 两worktree并行不互写，PTY终止，diff与落盘一致 |
| F18 dev preview/审阅/PR | 部分；preview-service、git-pull-request | server在core sandbox外，端口与进程清理 | S5，纳入执行权限 | 拒绝不启动，退出无遗留，预览报错可修，PR状态来源真实 |
| F19 本地Cowork任务 | 实验默认关闭；cowork-runtime | 官方资源依赖、只text、队列空；VM未实测 | S5，独立可替换runtime | 真实多步文件任务含审批、中断/恢复和产物；无隐藏VM依赖 |
| F20 prompt队列/后台/计划/恢复 | queue/jobs/local-routines/schedule有实现 | 四种对象不同；睡眠/退出/crash/时区未全测 | S2/5/7，共同run状态 | 保留待执行输入；不重复副作用；禁用后不调度；补跑规则明确 |
| F21 权限/审批/取消 | 部分；sandbox/approval、agent-tools-host | 网络、工具一致性、extension取消；不能总允许覆盖全部 | S2/5/6，扩展policy | 拒绝无副作用，过期/迟到授权失效，符号链接/跨站边界有效 |
| F22 Skills/命令/hooks | Harness有；UI参考部分硬编码 | 按core装载/启停、真实执行 | S5，复用registry | 安装后被使用，禁用后不加载；命令产生实际结果 |
| F23 MCP/插件/扩展 | host/plugin/MCP app sandbox有实现 | OAuth、包兼容、跨surface、卸载清理 | S5，复用协议和host | 真server调用，拒绝/断连/取消可恢复，卸载清理生效 |
| F24 Chrome操作 | 9工具；本次原始Electron P0–P5分别通过 | isTrusted、截图、传文件、复杂DOM、并发、取消 | S6，扩展现有Bridge | fixture+真实站点；两会话不串tab/ref；中断后不继续动作 |
| F25 内置/受控浏览器 | preview不等同完整browser | profile、登录、下载、任务归属 | S6，独立BrowserService | 用户Chrome与preview隔离，下载路径与任务对应 |
| F26 OS桌面computer use | 完整工具未验证；Chrome工具不覆盖 | AX/截图/输入、app权限、焦点/缩放/多屏 | S6，独立OS工具adapter | 测试app操作成功；拒绝后不可控制；失焦不误点 |
| F27 快捷入口/语音/截屏/输入法 | 有入口和组件；E2E未验证 | 全局键、权限、录音取消、草稿与上下文 | S6，复用原生host+窄VoiceService | 快捷入口聚焦正确，取消/识别失败不丢草稿和不误发送 |
| F28 设置/窗口/通知/动效/无障碍 | 多项真实模块与UI | 版本/平台差异，多窗恢复和reduce-motion | S6/8，按观察补齐 | 键盘全流程、主题/多窗/睡眠/多屏、滚动锚与焦点正确 |
| F29 云Cowork/远程执行 | 完整等价后端未发现 | 持久worker、在线桌面桥、远程权限 | S7，授权API或独立后端 | Mac关机云任务继续；本地离线明确等待；恢复不重复执行 |
| F30 同步/多端/离线冲突 | 本地为主；完整同步未发现 | 设备身份、冲突、墓碑、迁移与备份 | S7，个人同步服务 | 两端离线编辑可解释合并，删除同步，备份可恢复 |
| F31 SaaS连接器/远程MCP | core入口/UI；逐服务未验证 | 官方授权不迁移，OAuth和写入审批 | S5/7，逐服务复用MCP | 可追溯搜索结果、写入可审查，撤销授权实际阻止调用 |
| F32 发布/分享/应用存储 | 未发现完整服务 | URL、身份、版本、撤销、持久数据 | S7，独立托管/对象服务 | 固定版本可访问，撤销即失效，不暴露本机路径和密钥 |
| F33 模型/API/订阅/费用/账号设置 | 多core设置；官方CLI适配未实现 | API与订阅及云服务边界，凭据不进renderer | S1/7，已有provider+原样CLI | 各路径认证/计费说明正确；不复制/代理Claude.ai token |
| F34 安装/升级/资源/备份 | 上游打包脚本；本次setup/doctor | 正常build缺旧资源，许可/签名/更新回退 | S1/8，独立构建和迁移 | 干净checkout可重建；升级失败可回退；产物无缺资源 |
| F35 官方基准/REA/日常回归 | CLI/技能/fixture/fuses已实测；GUI未测 | 版本/套餐/feature flags与真实行为 | S1/8，问题驱动观察 | 每项结论可追溯到具体版本、场景、结果与未知边界 |

本次不提前安装尚未选定的解析器、预览框架和云平台。它们不是被删出范围，而是在对应实现前通过小测试集决定。新增依赖必须解决已有测试证明的缺口，不能仅因前一报告提过名称就全部加入。
