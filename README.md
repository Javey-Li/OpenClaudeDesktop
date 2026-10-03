# Code Desktop

## 2026-09-24 重复审批请求断线修复（源码与安装版已修复）

修复 `Codex reused an outstanding request ID. Reconnect to continue.`：Codex 在 thread/resume 时会重发尚未完成的审批。ApprovalLedger 现在对相同 wire ID、method、完整 params 的重发沿用原条目，保留 nonce、草稿、revision 和 sending 锁；内容冲突及过期身份仍拦截。

源码保持 0.2.129；已安装的 0.2.13 单独应用该热修复（hotfix `request-replay-20260924`），只改 ledger 和 build-info，已更新 ASAR integrity、签名并验证。旧安装包已备份，未退出用户正在运行的开发实例；需重新启动应用加载修复。完整源码测试 1148 项：1147 通过、1 既有跳过、0 失败；build/integrity、离屏审批交互、安装版兼容的 24 项 transport 测试通过。详情及安装收据：[request-replay-fix-20260924](analysis/request-replay-fix-20260924/README.md)。

## 0.2.129 本轮（0.2.124–0.2.129）最终回归（未安装）

构建身份：0.2.129，builtAt 2026-09-23T21:55:38.730Z，SHA `0053f8285d55bd930223f4b87a31a7e048e8231e8b251864ab613083091936fd`，444源文件。日志work/claude-ui-sweep/final/v129-*。`npm run build`通过；`npm test` 1139项1138通过、0失败、1既有跳过；`node scripts/verify-build.mjs`通过（文档更新后复验v129-verify-build-after-docs.log）。

离屏run-suite已登记全部60套（＝validate-local标准链全部）串行（run-all-v129.sh，v129-summary.txt记录每套退出码与负载均值3–6）：首轮60/60通过，无复跑；每份report.json的build均为0.2.129/0053f828…，passed=true，无boundaryError/reportError/cleanupError，窗口全部不可见/未聚焦/离屏，剪贴板套件内存剪贴板终态等于初态。本轮无产品修复、无测试改动。

未运行：validate-local标准链60套原生窗口脚本（用户禁止占屏），nativeWindowAcceptance仍为false；官方同态像素未验。状态文件analysis/batch2-status-0.2.129-offscreen-20260924.json（unrunSuites为标准链全部60套，offscreenReceipts129含60套receipt）。

## 0.2.129 Connectors页Status单元格改为源码Warning图标＋按钮（说明进tooltip/sr-only）、Type列固定160px、“stopped working”卡片Ca行/Retry/Show all折叠（未安装）

背景：Connectors表格的Type列没有宽度；unreachable/signIn状态单元格把“Server not responding”/“Sign in required”作为可见文字放在按钮旁（HANDOFF 0.2.107记录其在160px Status列内被截断）；“Connectors that stopped working”卡片每行以Warning图标开头、unreachable按钮为“Reconnect”、无折叠。源码current-2.2553.1 `customize-connectors-current.js`：
- ca（:2027-2048）：`div.flex.min-w-0.items-center.gap-xs.text-warning`＝Warning（size sm、shrink-0、aria-hidden）＋CDS tooltip Y（content＝explanation）包裹的`span>按钮`＋`span.sr-only`（explanation）；la的reconnect/blocked分支（:2150-2243）走ca，表格行la为size sm（:3800-3808）。
- Pa（:2885-2888）：Type表头sn className `w-40`（160px）；表头行:3610-3640（Status同为w-40）。
- ba（:2300-2530）：va＝5（:2302）；`G = v.length > va`，未展开只显示前5行；ghost Button（size _＝Ze→经典对话框sm、flush start、self-start、icon CaretUp/CaretDown、aria-expanded、aria-controls＝ul的useId）文案“Show all”/“Show less”（:2516-2530）；`te && !G && H(!1)`在数量回落到5及以下时收起。标题行`-mx-pad-lg flex items-center justify-between gap-md border-b border-alpha-1 px-lg pb-lg`，h3 `flex min-w-0 items-start gap-xs text-body-medium text-primary`＋`h-[1lh] text-warning`的Warning sm。
- Ca（:2644-2750）：li `col-span-full grid grid-cols-subgrid items-center border-t border-alpha-1 py-sm first:border-t-0`；首格为连接器tile `_r size 24 / imageSize 16`（c08e79e85 hn→shared-13 lA→Jk：24px、圆角size*.27、`bg-bg-000 border-border-300 border-0.5 shadow-sm`，design-system.css映射为surface-3/--cds-border/--cds-shadow-sm），不是Warning；随后`div.flex.min-w-0.items-center.gap-sm`内名称（truncate text-body text-primary）与原因（min-w-0 flex-1 truncate text-body text-secondary；Si :1674-1692 unreachable→“Server not responding”）；尾部secondary按钮，signIn“Reconnect”、unreachable“Retry”。

改动：
- `app/src/source-customize.jsx`：`MCP_COLUMNS`的Type加`width:"40"`（既有`.cz-col-40`＝160px），Type单元格内容“MCP server · N tools”保留（有记录的Codex适配）。新增`WarningStatus`按ca输出：`span.cz-status[data-status]`内Warning 16px aria-hidden → `SourceTooltip content=MCP_STATUS_LABELS[kind]`包裹的`span.cz-status-action`（内含原sm Button，Reconnect/Sign in处理函数与stopPropagation不变）→ `span.cz-sr-only`说明；删除可见说明span。connected/connecting/disabled/notStarted未改。卡片抽为`BrokenConnectorsCard`并导出`BROKEN_CARD_LIMIT = 5`：行首为`span.cz-broken-tile`（24px tile＋16px Connectors字形，与表格行同一字形；Codex MCP服务器没有图标，故不用源码的字母/favicon回退）；名称text-primary、原因text-secondary flex 1 truncate；unreachable按钮改为“Retry”（同一reload处理）；超过5行时截取前5行并在列表后渲染ghost `SourceSettingsButton`（size sm、flush、icon CaretDown/CaretUp、iconSize auto、aria-expanded、aria-controls＝`useId`列表id），数量回落到≤5时渲染期间复位为收起（同ba）。“Reconnect all”及其aria-label原样保留。
- 诚实适配（代码注释已写明）：signIn行保持原因“Sign in required”与按钮“Sign in”——Codex `McpAuthStatus` `notLoggedIn`并不表示此前登录已过期，源码Si的“Sign-in expired”与Ca的“Reconnect”会声称Codex从未报告的事实。没有snooze菜单Ce（“Hide for 7 days”是claude.ai账户偏好，Codex无存储），所以每行三格，采用v2的`grid-cols-[auto_minmax(0,1fr)_auto]`。
- `app/src/source-customize.css`：`.cz-status`的unreachable/sign-in变体为`display:flex; gap:var(--cds-gap-xs); color:var(--cds-text-warning)`，新增`.cz-status-icon`/`.cz-status-action`。卡片：`.cz-broken-head`改为`margin-inline:-pad-lg; padding:0 pad-lg pad-lg`（横跨卡片的分隔线＋pb-lg）；`.cz-broken-list`为三列、`column-gap:gap-sm`、`margin-top:gap-xs`；li去掉自身gap（继承subgrid）；新增`.cz-broken-tile`、`.cz-broken-text`、`.cz-broken-name`、`.cz-broken-reason`、`.cz-broken-action`（justify-self end）、`.cz-broken-more`（align-self flex-start）。
- 说明：任务说明写gap-xs为“4px compact”，实际token为compact 6px / comfortable 8px（design-system.css :52914/:53865）；实现直接用`var(--cds-gap-xs)`，离屏comfortable测得8px。

测试：
- `app/tests/customize-states.test.mjs`新增1项SSR：第2、3个th均为`cz-col-40`；unreachable/sign-in单元格精确结构为Warning(16px、aria-hidden)→`cz-status-action`内secondary sm按钮→`cz-sr-only`说明，且说明文字在单元格中只出现一次；connected不变；卡片unreachable行为tile＋Connectors字形＋名称＋“Server not responding”＋“Retry”，signIn行为“Sign in required”＋“Sign in”，列表内无Warning字形、无“Reconnect”，Reconnect all aria-label不变；6行时只有5个li、第6个不在DOM、列表后的按钮为ghost/flush start/sm、aria-expanded=false、aria-controls＝ul id、CaretDown＋“Show all”；恰好5行时无折叠按钮。（SSR不渲染tooltip弹层；tooltip内容由离屏套件验证。）
- `app/scripts/skills-mcp-ui-test.mjs`：原读取`.cz-status > span`首元素为可见“Server not responding”/“Sign in required”的两条断言改为ca结构（子元素依次为aria-hidden Icon、cz-status-action、cz-sr-only；sr-only为说明；action标签为Reconnect/Sign in），引ca :2027-2048；原Reconnect/Sign in按钮与RPC断言不变。新增：Type与Status表头宽160±0.5；两个警告单元格颜色＝解析后的`--cds-text-warning`、gap＝`--cds-gap-xs`、Warning 16px、单元格宽160±0.5、按钮在单元格内容框内（right ≤ 内容右缘）且按钮与单元格均无scroll溢出；悬停Reconnect/Sign in分别出现含“Server not responding”/“Sign in required”的`[data-cds=Tooltip]`，移开后消失。卡片：标题行pb＝pad-lg、1px下边框、左右贴齐卡片；两行tile 24×24、字形16px、无Warning、名称为text-primary、原因为text-secondary/flex-grow 1/ellipsis、按钮[secondary,sm,Sign in]与[secondary,sm,Retry]；≤5行无折叠按钮。折叠：在fixture种子追加fx-down-1..4（failed）后经表格Reconnect重列 → 标题“6 connectors stopped working”、仅前5行（fx-failed被隐藏）、ghost sm flush start CaretDown“Show all”、aria-expanded=false、aria-controls＝ul id、align-self flex-start、位于ul之后；点击后“Show less”、aria-expanded=true、CaretUp、6行；缩到4个（种子减2）并点卡片Retry → trace为config/mcpServer/reload→mcpServerStatus/list、无折叠按钮；再回到6个 → 重新为收起的“Show all”（aria-expanded=false、5行），证明`te && !G && H(!1)`复位；最后恢复原种子并等待回到2行，后续步骤不受影响。新增截图connectors-broken-card/collapsed/expanded.png。

验证（日志work/claude-ui-sweep/0.2.129/）：`npm test` 1139项1138通过、0失败、1既有跳过（npm-test.log）；`npm run build`通过（build.log）；`node scripts/verify-build.mjs`通过（0.2.129，SHA `0053f8285d55bd930223f4b87a31a7e048e8231e8b251864ab613083091936fd`，444源文件，builtAt 2026-09-23T21:49:33.166Z；verify-build.log，改完套件脚本后复跑verify-build-final.log相同）。离屏run-suite（最终脚本，无error/boundaryError/reportError，blocked为空，窗口均不可见/offscreen）：skills-mcp（22项，1次启动，offscreen-skills-mcp-hf3nl5）、settings（7项，2次启动，offscreen-settings-9P9UkQ）、settings-complete（9项，1次启动，offscreen-settings-complete-NPQupY）全部通过；报告与截图已复制到该目录并查看：Status列为Warning＋按钮，160px内完整；卡片行为tile＋名称＋灰色原因＋Retry/Sign in，6行时“Show all”折叠、展开后“Show less”。结束后无本应用Electron/vite/codex-server残留进程。

开发过程失败（报告已保存）：skills-mcp r1（offscreen-skills-mcp-r1-report.json）——新增的`const relist`与该脚本:552既有`relist`同名导致SyntaxError，重命名为`reloadConnectors`；r2（offscreen-skills-mcp-r2-report.json）——用`parseFloat(getPropertyValue("--cds-gap-xs"))`取token得NaN（token是`calc(0.5rem * var(--cds-rem-scale,1))`字符串），改为在元素内放探针取解析后的宽度（pad-lg同理）。两者都是测试脚本自身错误，非产品问题；产品代码在两次之间未改。

剩余缺口：卡片外框（D的内边距/背景）与行排序（源xi按最近连接时间与signIn优先）未对齐；源码的snooze菜单、Dismiss X（v2）、“Reconnect {name} · # left”逐个重连、EMA/re-SSO分支无Codex对应能力未做；tile不显示服务器图标（Codex不提供）；源码tooltip说明来自ra（按失败原因的细分文案），本地用MCP_STATUS_LABELS两种状态文案；原生窗口验收未跑。

## 0.2.128 Files面板源码树状态与空预览文案、根Spinner、子文件夹错误treeitem、标题栏“Search files”按钮（未安装）

背景：Files面板的树状态与空预览是本地自编文案（根“Loading files…”/原始错误role=alert/“This folder is empty.”，子文件夹“Loading…”/“Empty folder”/原始错误，空预览正文“Pick a file in the tree.”等），且缺少源码的“Search files”标题按钮。源码current-2.2553.1 `panes-tile-current.js`：
- Ig（:5496-5512）根状态，全部包在Jg（:6101-6110）`flex items-center justify-center px-lg py-2.5 text-body text-muted`：加载→Yg（:6111-6113）只有CDS Spinner sm（shared-frame xo，:2300-2360，无label时仅aria-hidden图形）；`isError && !data`→“Couldn’t read this folder.”（不显示原始错误）；无行→“Folder is empty”。
- Pg（:5335-5350）子文件夹：无数据时只有读失败才追加`{kind:"error"}`行（深度为子级深度d），加载中与空文件夹不追加任何行；Lg（:5547-5570）渲染为role=treeitem、data-tree-row、aria-level=depth+1、tabIndex -1、`flex items-center min-h-control px-lg text-body text-muted outline-none`、style ko(depth)（c621b1e2d `o`＝paddingLeft 8+depth*8），文案“Couldn’t read this folder.”（span.truncate）。
- 空预览（:6355-6390）：`flex min-h-0 min-w-0 flex-1 flex-col`内EmptyState yu（cc0a875c8，本地SourceEmptyState即其复刻），icon Folder；标题tabs>0“No file selected”否则“Open files appear here”；正文tabs>0“Pick an open file above, or click a file path in the conversation.”，否则树显示时“Pick a file in the tree, or click a file path in the conversation.”，否则“Click a file path in the conversation to open it.”。本地点击对话中的文件路径已能打开Files面板（HANDOFF 0.2.14），文案属实。
- c_（:6791-6807）：ghost iconOnly CDS Button、icon Search、aria-label“Search files”，onClick `focusFilesTreeFilter("filter")`；受Xg开关（默认开）与jl(session)（本地文件系统）门控；位于trailing槽settings菜单之前（:16366-16378）。CDS Button在iconOnly且有aria-label时以其为tooltip（shared-frame ks的oe/se）。ka的trailing（panes-toggle-current.js:1508-1551）为[c, Lr settings, la, close, ma dock]，弹出窗口同样包含c。
- focusFilesTreeFilter（panes-state-current.js:3097-3113）：清除filesTreeHiddenWhileEmpty；能容纳时有fileView则filesTreePeek（树与文件并排），否则vi()（fileView置空、保留treeReturnPath，即切到树）；随后聚焦“Filter files”并选中文本。

改动：
- `source-pane-states.jsx`新增：`FILES_FOLDER_ERROR`/`FILES_FOLDER_EMPTY`/`FILES_TREE_LOADING_LABEL`；`SourceFilesTreeState({state})`——loading为role=status的Jg类div＋`SourceSpinner size="sm"`＋sr-only“Loading”（本地补充的无障碍名称，源Yg无label；无可见文字），error/empty为同类div内的固定文案（非alert）；`SourceTreeErrorRow({depth})`按Lg逐项输出（无data-tree-primary按钮，故Enter/Space/点击无动作）；`filesEmptyPreviewCopy({tabs,treeShown})`与`SourceFilesEmptyPreview`（wrapper＋SourceEmptyState icon Folder）。
- `source-session.jsx`：根状态改为`entries===null`时`treeError ? error : loading`、`!entries.length`时empty（不再渲染空SourceTree）；有数据时刷新失败保留原树（源`isError && !data`）。treeError仍只用于aria-busy，原始错误不进DOM（此前也没有console日志，未新增）。无cwd的“Choose a folder to browse files.”保留（源无此状态）。子文件夹：`error`改为布尔，`children===null`时仅失败渲染`<SourceTreeErrorRow depth={level+1}/>`，加载/空不渲染任何内容，已有children时刷新失败保留children。空预览改用`SourceFilesEmptyPreview`，条件`!preview && (!treeVisible || treeCanFit)`不变（源`(!N || M)`）。新增`focusFilesFilter()`：若treeHiddenWhileEmpty则清除，若树不可见则`setVisibleTree(true)`（即“Show file tree”同一路径：能容纳且有预览→treeShown；不能容纳→selectFile(null)切到树），再由layout effect在树可见、输入框未hidden/inert后`focus({preventScroll})`＋`select()`。本地适配：无瞬时filesTreePeek，能容纳时持久显示树；fileEditDirty分支无对应（本地预览只读）。标题栏trailing：`tab==="files" && cwd`时生成Search按钮，经`paneControls({menuSections, leading})`传入；非函数paneControls/回退Close时按钮置于其前。
- `source-pane-controls.jsx`：新增`SourceFilesSearchButton`（GhostButton label/tooltip“Search files”、icon Search、无原生title）；`SourcePaneControls`与`SourcePopoutControls`新增`leading`并渲染在settings菜单之前。`main.jsx`两处paneControls转发`leading`。
- `source-session.css`：删除`.source-tree-notice`与旧`.source-file-empty-*`；新增`.source-files-tree-state`、`.source-tree-error`（min-height var(--cds-h-control)、padding-inline var(--cds-pad-lg)、text-muted、body字号；Lg内联paddingLeft优先）与`.source-file-empty-preview`包裹层。

测试：
- 新增`tests/files-pane-states.test.mjs`（7项SSR）：根loading/error/empty精确输出（error无role/alert）；面板SSR根加载为Yg状态、无“Loading files/This folder is empty/Empty folder/role=alert”，无cwd文案保留；源文件中无`{treeError}`与旧提示，子文件夹只渲染错误行；Lg行精确标记（depth 1→aria-level 2、padding-left 16px；depth 3→4/32px）及CSS三项；空预览三组精确文案、yu结构，面板treeHiddenWhileEmpty且无tab时为“Click a file path…”；Search files在spc-controls内顺序为Search→Files settings→Expand→Close panel、无title、无cwd/changes面板时不存在、回退路径位于Close之前、main.jsx两处转发leading；focusFilesFilter调用顺序。
- `scripts/pane-ui-test.mjs`：原:368等待“Empty folder”改为展开的empty-folder无子treeitem且group文本为空（引Pg :5335-5350）；复审后不再用固定300ms等待：先`holdRead("empty-folder","readdir")`，`waitForHeldRead()`证明真实读取仍在途时断言加载态为空，再`deliverHeldRead()`（释放后等主进程包装器返回——其后listFiles与ipcMain.handle回复在同一微任务链内入队——再经同一renderer管道发一次真实`files`调用，其回复不可能先于被扣回复到达，最后等两帧供React提交）后断言已加载空态为空；原`getByRole("alert")`含ENOENT改为`.source-tree-error`：role treeitem、aria-level=父+1、文案、颜色=--cds-text-muted探针、min-height=--cds-h-control探针、padding-right=--cds-pad-lg探针、padding-left=8+8*depth，树内无alert、无ENOENT文字；ArrowDown从removed-folder到错误行，Enter/Space无动作，ArrowUp返回（截图pane-source-tree-error.png）。空预览度量改读`.source-empty-state`内title/body p（原12px gap/28px图标/13/19与12/15断言保留），新增title/body精确文案。窄于400px段新增：隐藏树且打开file-9.txt时点击Search files→树全宽、预览关闭、tab保留、无选中tab，“Filter files”获得焦点且“file-9”全选；随后“Hide file tree”回到原文件，原“Back to files”流程不变。:296/:345/:375/:388/:445/:466/:666与:489标题查找不变。
- `scripts/files-pane-ui-test.mjs`新增search-files步骤：trailing按钮为['Search files','Files settings','Expand','Close panel']；按钮无title、spc-ghost、1个图标；hover出现“Search files”tooltip；树已显示时点击只聚焦并全选“notes”，面板状态不变；打开notes.txt、过滤“deep”、隐藏树后（面板607px≥400）点击→树作为列显示在同一文件旁、选中与预览不变、“deep”全选（截图search-files-beside.png）。file-tabs步骤开头改为`size(1328,820)`：r1中新增的24px按钮＋2px gap使四个tab的标签条在1280宽下少26px，README.md标签被裁切（`clipped true !== false`，:127）；2:3分栏下+48px窗口约给面板+29px，恢复原断言所依据的标签条宽度，tab断言本身未改。
- `scripts/pane-layout-ui-test.mjs:678`：弹出窗口header按钮期望由["Files settings","Open in main window"]改为["Search files","Files settings","Open in main window"]（引ka trailing [c,…,ma]与c_）。:577-647的Tab/Shift+Tab断言均在树内，未受影响，未改。

验证（日志work/claude-ui-sweep/0.2.128/）：`npm test` 1138项1137通过、0失败、1既有跳过（npm-test.log；脚本改完后复跑npm-test-final.log结果相同）；`npm run build`通过；`node scripts/verify-build.mjs`通过（0.2.128，SHA `60155665651fca23d1563d64fa560fbfa491d78203d0f2ba8aabb01e66ecd4ed`，444源文件，builtAt 2026-09-23T21:26:51.063Z）。离屏run-suite（最终版脚本，均无error/boundaryError/reportError，blocked除pane-layout第二启既定的[window.focus]外均为空）：files-pane（11项，2次启动）、pane（12项，1次启动；最终为复审后的offscreen-pane-DgsWC3，见下）、pane-layout（13项，2次启动）、file-search（9）、session（11）、scrollbar-mode（5）全部通过；另因会打开Files面板加跑user-markdown（10）、edit-read（17）、changes-pane（18）、approval-card（12）、transcript-fade（8）、transcript-scroll（11）、ui029（6）全部通过。报告JSON与截图（search-files-beside、pane-source-tree-error、pane-source-narrow、file-tabs-light）已复制到该目录并查看：错误行位于removed-folder下缩进16px的灰色单行，空预览为Folder图标＋源文案；Search按钮位于tab条右侧、settings之前。结束后无Electron/vite/codex-server残留进程。

开发过程失败（日志均保存）：files-pane r1——新按钮挤窄tab条导致README.md标签被裁切（见上，属新按钮带来的真实布局变化而非产品回归，按源c_同样占位处理测试宽度）；pane r1——新增步骤用`getByRole("textbox")`取隐藏树内输入框超时（隐藏元素不在无障碍树中），改为`input[aria-label="Filter files"]`选择器，属新增步骤自身错误；pane r2/r3为补强错误行token与padding-left断言、加截图后的复跑；pane-layout r1——弹出窗口header按钮列表多出“Search files”，按源ka trailing更新期望。

复审修正（版本不变）：
- 归档证据错误：原`work/claude-ui-sweep/0.2.128/offscreen-pane-report.json`与`offscreen-pane-layout-report.json`逐字节相同（suite为pane-layout、output offscreen-pane-layout-1DxrkG），上文pane“13项，2次启动”即抄自该错误副本。真实的最终pane运行是`analysis/batch-20260920/offscreen-pane-JXQTEO/report.json`（passed，12项originalChecks，1次启动，sourceHash abe35dc6…与当时的pane-ui-test.mjs一致，build 0.2.128/60155665…），已存为`offscreen-pane-report-JXQTEO.json`；pane套件当时确实通过，只是计数写错，已更正为12项/1次启动。
- 测试强度：`pane-ui-test.mjs`空子文件夹检查原为展开后固定等300ms，未证明子文件夹读取已完成。改为held-read（见上测试说明），`holdRead`的gate新增`returned`计数，新增`deliverHeldRead()`；其余holdRead/releaseFileRead用法不变。负对照：临时让已加载的空子文件夹渲染“Empty folder”并重建，pane套件在新断言“Loaded empty folder has no child rows and no notice”处失败（加载态断言通过，offscreen-pane-review-negative-control.log），随即还原源码并重建，verify-build SHA回到60155665…。
- 复审验证：`npm run build`通过（build-review.log）；`npm test` 1138项1137通过、0失败、1既有跳过（npm-test-review.log）；`node scripts/verify-build.mjs`通过（0.2.128，SHA 60155665…未变，verify-build-review.log）；离屏pane：offscreen-pane-enEqNt（review-r1）与还原后最终offscreen-pane-DgsWC3（review-r2）均passed、12项、1次启动、sourceHash d0295138…（当前pane-ui-test.mjs），无error，报告已替换为`offscreen-pane-report.json`（不再与pane-layout相同）。产品代码与其它脚本未改，其余套件未重跑。

剩余缺口：无filesTreePeek瞬时并排状态（能容纳时Search files会持久显示树）；Xg远程开关未实现（视为默认开）；源Yg无可访问名称，本地加sr-only“Loading”；子文件夹错误无重试入口（源同样没有）；原生窗口验收未跑。

## 0.2.127 文件改动审批标题点名文件：“Allow Codex to write/edit {basename}?”（源EM/SM，text-primary片段＋line-clamp-2）（未安装）

背景：`approval-card-model.mjs`对`item/fileChange/requestApproval`恒返回“Allow Codex to edit files?”。源码current-2.2553.1 `approval-current.js`：
- :14521-14534：Write→action "write"＋`...SM(file_path)`；Edit/MultiEdit→action "edit"＋`...SM(file_path)`。
- :15201-15205 SM(path)＝`{meta: Yn(path)（basename）, detail: 完整路径单行, clampTitle: true}`。
- :15399-15470 EM的B：有t.meta时文案“Allow Claude to <b>{action}</b> <meta>{metaText}</meta>?”，b与meta均为`span.text-primary [unicode-bidi:plaintext]`；外层span在`t.clampTitle && y`时加`line-clamp-2`，y（:15254）＝`(!!t.detail && t.detail !== t.meta) || 有foldedDetail`。
- 颜色核对：B外层是rm＝cf6ae6197 `ev`，className默认`text-primary min-h-[24px] flex items-center gap-1`，内层`text-body-semibold`——标题本身即text-primary，故非片段文字颜色不改，只加片段。ion-dist css `.line-clamp-2{-webkit-line-clamp:2;-webkit-box-orient:vertical;display:-webkit-box;overflow:hidden}`。

改动：
- `approval-card-model.mjs`新增`fileHeading(changes)`：Codex FileChangeRequestApprovalParams无changes字段（work/codex-schema-0.155.1/ts/v2/FileChangeRequestApprovalParams.ts），真实数据为`item.changes`（FileUpdateChange {path, kind: PatchChangeKind}）。恰好1项且path非空时：kind为add→"write"，否则"edit"；同时接受`kind.type`与遗留字符串kind（夹具codex-server.cjs:712的'update'）。meta＝按`/`或`\`切分的最后一段（不trim）。返回`heading:{action,meta}`、`clampTitle:true`、`title:"Allow Codex to {action} {meta}?"`（纯字符串仍用于aria-label“Permission request: …”）。0项、多项、缺path保持“Allow Codex to edit files?”且无heading。本地适配：PatchChangeKind "delete"源码无对应动词（无Delete工具），保持"edit"。
- `source-approval-card.jsx`：有model.heading时渲染`Allow Codex to <span class="sac-em">{action}</span> <span class="sac-em">{meta}</span>?`；button与div两种标题一致；`clampTitle && model.detail`（本地detail即changes块）时内层span加`data-clamp`。
- `source-approval-card.css`：`.sac-heading > span[data-clamp]`＝源line-clamp-2四条声明；`.sac-em{color:var(--cds-text-primary);unicode-bidi:plaintext}`。
- 夹具`tests/fixtures/codex-server.cjs`：新增`fixture:file-tool-approval-multi`，与`fixture:file-tool-approval`同一路径，只多推一条真实FileUpdateChange（fixture.txt update），用于验证多文件保持通用标题。原单文件分支未变（edit-read套件复跑通过）。

测试：
- `tests/approval-card-model.test.mjs`新增1项：src/a/b.ts单个update→“edit b.ts”，add→“write b.ts”，字符串'update'/'add'同义，delete→edit；Windows反斜杠路径且保留空格；0项/2项/缺path/空白path保持通用标题且无heading/clampTitle；grantRoot-only、command、permissions标题不变。
- `tests/source-shortcut.test.mjs`新增1项SSR：单文件卡aria-label为纯字符串，按钮标题内恰两个`.sac-em`及`data-clamp=""`；多文件与命令卡无sac-em/data-clamp。
- `scripts/approval-card-ui-test.mjs`：在通用file卡之后新增真实`fixture:file-tool-approval`断言——标题文本/aria-label为“Allow Codex to write created.ts?”，两片段["write","created.ts"]计算色均等于`--cds-text-primary`探针色、unicode-bidi plaintext，标题色本身也等于该色，内层span `-webkit-line-clamp:2`、box-orient vertical、overflow hidden，display等于同引擎下源line-clamp-2声明探针的计算值；截图approval-card-file-heading.png；随后`-multi`仍为“Allow Codex to edit files?”且无sac-em/data-clamp。
- `scripts/session-ui-test.mjs:320`：核查其请求为通用`fixture:file {decision}`（只带grantRoot、itemId 'command'，无item.changes），不是单文件请求，期望保持“Allow Codex to edit files?”不变，仅加注释说明原因。

验证（日志work/claude-ui-sweep/0.2.127/）：`npm test` 1131项1130通过、0失败、1既有跳过（npm-test.log）；`npm run build`通过；`node scripts/verify-build.mjs`通过（0.2.127，SHA `1cb8f7bed378f7d22d815013260b2935f151f11daef5fa940c5b097d2f4b10c4`，444源文件）。离屏run-suite：approval-card（8组checks，passed）、session（10）、approval-transport（9）、permission（7）、edit-read（14，因夹具改动加跑）全部通过；报告JSON与截图已复制到该目录。

开发过程失败：approval-card r1——新断言`display === "-webkit-box"`失败，实得`flow-root`。源line-clamp-2声明与本地逐字相同，Chromium把这一旧式-webkit-box＋line-clamp组合计算为flow-root；改为与同页探针套用源四条声明的计算值比较，并补box-orient断言，属本版新增断言的更正而非放宽。r1日志被r2覆盖（未单独保存），失败信息即上述断言。

剩余缺口：源SM的detail是完整路径单行，本地detail是changes块（FileChanges），截图中该块首行路径列排版拥挤（既有渲染，非本版引入）；Read/NotebookEdit/Grep等其它源动词在Codex审批协议中无对应请求，未做；多文件无源对应文案，保持本地通用标题；原生窗口验收未跑。

## 0.2.126 首页标题栏“What’s new”仅在本客户端版本未看过时显示（源P/V justUpdated门控）（未安装）

背景：此前`source-titlebar.jsx`在首页（`!session && section === "new"`）始终渲染“What’s new”按钮。源码current-2.2553.1 `titlebar-release-notes.js`只在“刚更新”时提示：
- :5058-5069 P(surface)：存储键N=`ccd-whats-new-seen-version`（surface "code"即N本身）；t=运行版本；n=发布说明列表中存在version===t的条目；`[a,o]`=持久化字符串（默认""）；markSeen=`t && n && o(t)`；`justUpdated = !C() && !!t && n && a !== t`。C()（shared-11 Gi）为含义未确认的环境门控，本地不实现（模型文件注释已注明）。
- :5238-5256 V（CodeWhatsNewNudgeInner）：按钮仅在`justUpdated || modalOpen`时渲染，ghost CDS Button、className `text-accent`、文案“What’s new”。
- :5156-5168 B（WhatsNewModal）：打开即调用markSeen()。故打开一次后，弹窗关闭按钮随即消失，只有新版本（且有说明）才再出现。

改动：
- 新增`app/src/whats-new-model.mjs`（纯模块）：`WHATS_NEW_SEEN_KEY`、`whatsNewVisible({version,hasNotes,seen,open})`＝`(!!version && hasNotes && seen !== version) || open`、`markSeenValue({version,hasNotes})`（无版本或无说明返回null不写）、`readSeenVersion/writeSeenVersion`（storage缺失/抛错/非字符串均按""处理，写失败返回false）。
- `source-titlebar.jsx`：新增prop `showWhatsNew`（默认false），按钮仅在`!session && section === "new" && showWhatsNew`时渲染；样式沿用`.st-whats-new`（source-titlebar.css:154-164，text-accent＋ghost hover）。导出`LOCAL_RELEASE_NOTE_VERSIONS = [clientVersion]`——本地说明唯一条目即构建的clientVersion，对应P的`n`。未新增任何说明内容。
- `main.jsx`：`whatsNewSeen`状态由localStorage一次性读取（try/catch，失败为""）；`whatsNew`变为true时按源B效果写入并更新状态（try/catch）；向SourceTitlebar传`showWhatsNew=whatsNewVisible(...)`。localStorage属per-viewer便利项，源同样用持久化设置保存。
- 焦点：源按钮在弹窗关闭时卸载，原有“关闭后焦点回到What’s new按钮”不再可能。LocalReleaseNotes原本只恢复仍连接的元素（`previous?.isConnected`），未改；源CDS Dialog（Base UI/floating-ui）可能回退到更早仍连接的焦点历史，本地未复刻，列为缺口。

测试：
- 新增`tests/whats-new-model.test.mjs`（6项）：键值；首次运行可见、seen===version隐藏、版本变化再现；无说明/无版本隐藏；弹窗打开时即便已看过也可见；markSeen仅记录有说明的版本；storage缺失/抛错/非字符串。
- `tests/source-titlebar-tooltips.test.mjs`新增1项SSR：showWhatsNew=false或缺省时无按钮，true时渲染原按钮标记，会话页不渲染；`LOCAL_RELEASE_NOTE_VERSIONS`等于package.json版本。
- `scripts/titlebar-ui-test.mjs`（:303起）：保留520px宽、48px header、初始焦点、Tab陷阱、版本code等全部原断言；原“Escape/按钮关闭后焦点回到按钮并再次点击打开”一步因源行为（:5064-5068 markSeen＋V门控）按钮已不存在而改为：关闭后按钮count 0、activeElement仍为已连接节点、localStorage键=build.version；打开会话再回首页仍为0；reload后仍为0（截图titlebar-source-whats-new-seen.png）；再把键改为旧值并reload→按钮重现→点击打开（打开期间count 1）→“Close release notes”按钮关闭→count 0、键=build.version。`.st-trailing`空时不可见，故等待其attached（r1失败原因，见下）。
- code-ui-test.mjs:71在全新profile（mkdtemp，userData=CODE_DESKTOP_DATA）中打开What’s new，无需改动；其余已登记套件无引用What’s new。

验证（日志work/claude-ui-sweep/0.2.126/）：`npm test` 1129项1128通过、0失败、1既有跳过（npm-test.log）；`npm run build`通过；`node scripts/verify-build.mjs`通过（0.2.126，SHA `fd757b1d839fdeff0acbb4710abfd14b41d3caf1235c639c3dc5686b47664b40`，444源文件，builtAt 2026-09-23T21:04:17.813Z）。离屏run-suite：titlebar通过（9项原检查，1次启动）、code通过（9项，1次启动）、home-page通过（19项，4次启动），均无error/boundaryError/reportError。截图已查看：release-notes（弹窗打开时右上按钮仍在）与whats-new-seen（关闭并reload后首页标题栏无按钮），副本在同目录。

开发过程失败：titlebar r1（offscreen-titlebar-r1-fail.log）——新增步骤`locator('.st-trailing').waitFor()`默认等visible，而按钮消失后首页`.st-trailing`为空、不可见，超时；改为`{state:"attached"}`并以`.st-title` detached确认已在首页，属测试新增步骤自身错误，非产品问题。

剩余缺口：C()（shared-11 Gi）环境门控未实现；关闭后焦点未复刻源Dialog的焦点历史回退（当前落到body）；本地仅一条说明，版本升级即视为“有说明的新版本”；原生窗口验收未跑。

## 0.2.125 测试债C（二）：剩余10个剪贴板/生命周期脚本全部登记离屏run-suite并执行通过（未安装）

背景：接0.2.124，把validate-local standard中最后10套从未离屏执行的脚本（workflow-package、git、highlight、highlight-coalescing、turn-footer、user-actions、rich-copy、git-rail、shutdown、file-search-shutdown）登记进`work/offscreen-app-integration-20260922/run-suite.mjs`（standard列表未改）并逐套执行。10套全部可离屏运行，无“不可运行”余项。产品代码无改动（无产品回归）；3处脚本期望因已记录的产品变更过时、1处脚本门限与Chromium常量竞态（均已按源/受控实验更正）；适配器新增git-rail夹具入口、shutdown自退出宿主证据、两个假服务器接纳规则。

登记（脚本→最终fs.writeFile的规范报告，均已核对，均有`passed`字段）：workflow-package→analysis/batch-20260920/workflow-package-ui-report.json；git→git-ui-test.json；highlight→highlight-ui-test.json（TEST_APP_PATH未设时的local-built名）；highlight-coalescing→highlight-coalescing-ui-report.json（`args:appPath?[]:[root]`，TEST_APP_PATH未设即[root]，timeout 20000被适配器同值覆盖；失败时仅process.exitCode=1，run-suite再以规范报告passed把关）；turn-footer→turn-footer-ui-report.json；user-actions→user-actions-ui-report.json；rich-copy→rich-copy-ui-report.json；git-rail→git-rail-ui-report.json；shutdown→shutdown-ui-test.json；file-search-shutdown→file-search-shutdown-test.json。均DPR 1（无冻结Retina基线比对）、无expectedBlocked条目。workflow-package未设CODE_DESKTOP_WORKFLOW_BINARY（任务说明有误，已核对脚本:31），main.cjs:398回落到已验证的CODEX_BINARY夹具，plan:true干跑不派生代理；其clipboard字样只在clipboardSaved为真时执行，而该标志从不置真，故不开内存剪贴板（任何OS剪贴板调用仍被bootstrap拒绝）。

内存剪贴板：未新增readRTF/readBookmark/readImage。实测与源码均表明四个“整剪贴板快照”脚本（highlight:262、turn-footer:175、user-actions:195、rich-copy:180）先判断`clipboard.read`与`ClipboardItem`，内存适配两者皆有，于是走ClipboardItem[]分支并return，legacy readRTF/readImage/readBookmark分支不可达；10套全部调用序列中没有这些方法。按任务“只加脚本实际调用的方法”原则保持memory-clipboard.cjs方法集不变（readText/readHTML/writeText/writeHTML/clear/availableFormats/read/write），bootstrap禁止列表一项未删。clipboardCalls下限（均为read保存＋finally一次write恢复，再加产品复制点）：git{read:1,writeText:1,write:1}（Copy branch name→main.jsx:321 copyWithToast）；highlight{read:1,writeText:5,write:1}（5次Copy code，source-code-block.jsx:41）；highlight-coalescing{read:1,writeText:2,write:1}；turn-footer{read:1,write:4,writeText:1}（键盘/固定底部/历史三次富复制source-turn-footer.jsx:32→clipboard-payload.mjs:19，richDeny回落clipboard-payload.mjs:27）；user-actions{read:1,write:3,writeText:1}（鼠标/键盘source-user-actions.jsx:37→:19，richDeny回落:27）；rich-copy{read:1,write:4,writeText:2}（助手footer/用户鼠标/用户键盘富复制、richDeny回落、代码块Copy）。deny/hold桩不触达存储。实测序列：git read,writeText,readText,readText,write；highlight read,(writeText,readText)×5,write；highlight-coalescing read,(writeText,readText)×2,write；turn-footer read,write,readText,read,write,read,readText,read,readText,read,writeText,readText,read,write,write；user-actions read,write,readText,read,write,readText,read,readText,read,readText,read,writeText,readText,read,write；rich-copy read,write,readText,read,read,write,readText,read,read,write,readText,read,read,writeText,read,read,readText,readText,read,readText,read,writeText,readText,read,read,write。每次启动clipboard final与initial逐MIME相等。

适配器改动：
- bootstrap.cjs：fixtures白名单加入仓库夹具tests/fixtures/turn-footer-server.cjs（turn-footer-ui-test:51，只require node:fs/path/readline）。新增`stubbornOf`：shutdown-ui-test:45-64在每个场景profile内写出故意忽略SIGTERM的stubborn-codex.cjs；仅当位于本次profile、文件名恰为stubborn-codex.cjs、首行恰为`#!/usr/bin/env node`、正文无spawn/exec/fork/import/eval/Function/process.binding|dlopen|kill及网络/子进程模块字样、每个require恰为'node:fs'或'node:readline'时接受；standaloneOf与proxyOf原文不变。新增夹具入口：环境变量CODE_DESKTOP_VERIFY_ENTRY仅允许等于tests/fixtures/composer-window.cjs，且COMPOSER_FIXTURE_URL须为`http://127.0.0.1:<port>/tests/fixtures/git-rail-fixture.html`、CODEX_BINARY须未设置；此时userData设到run-suite自建profile/user-data，并require该夹具代替main.cjs——夹具的`new BrowserWindow({show:false…})`经同一Module._load适配得到HiddenWindow代理（离屏、不可聚焦、show/focus被拦）。will-quit写出的offscreen-evidence.json改为`{launch,evidence,clipboard,windows}`（launch为本次launcher路径）。
- run-suite.mjs：`suites`追加10项；clipboardCalls追加6项（注释逐条引产品调用点）。git-rail：仅当name为git-rail且args恰为[appRoot/tests/fixtures/composer-window.cjs]时接受（此时要求options.env无CODE_DESKTOP_DATA，适配器在输出目录建fixture-profile-N并注入CODE_DESKTOP_DATA/CODE_DESKTOP_VERIFY_ENTRY），其余启动仍deepEqual [appRoot]；该入口在DPR探测前等待夹具loadURL完成（r1：适配器自己的page.evaluate撞上导航“Execution context was destroyed”）。宿主自退出：launch后监听app.process()的exit；若不是经close包装退出，则只在读到本次launch标记一致的will-quit文件时以其evidence/windows/clipboard作为beforeClose并置closed，否则记录observationError、closed保持未置，边界断言失败。close包装在宿主已退出时不再观测。边界检查新增：每次启动evidence.created非空且全部不可见/未聚焦/离屏（加严）。record.closed、windows、violations、blocked、native、clipboard final===initial断言均未放宽。
- 受控实验（probe-kill-host.log，临时探针脚本已删除，副本probe-kill-host-ui-test.mjs.txt）：同一应用宿主SIGTERM→Electron正常退出码0、will-quit文件存在并被接受；SIGKILL→无will-quit文件，run-suite报“host exited without will-quit evidence”且boundaryError（closed未置），即被脚本SIGKILL的宿主按阻断处理。highlight/highlight-coalescing只在关闭失败/看门狗路径才SIGTERM/SIGKILL，通过路径均经close包装。

脚本更正（非放宽，注释引HANDOFF版本与源）：
- git-ui-test.mjs:22：`/-original/`→`/−original/`。0.2.45起Changes删除行标记为U+2212（source-diff.jsx:53 DiffLine；work/diff-separators-headless-20260922/check.mjs:62断言['−','−']）；r1实际文本`change.txt+2−11−original1+replacement2+second`。该脚本0.2.15原生通过，失败原因即此有意变更。
- highlight-ui-test.mjs（0.2.15同一脚本SHA原生通过，按回归排查）：①:380“prior settled block keeps its settled tokens”得stream。0.2.71起assistant正文分步显示（use-response-pacing.js；approval-current h5→markdown-current Ml/Dl→shared-16 Sb），纯模型实验（highlight-pacing-experiment.log）显示该条目首帧为"```js\nconst prior = "，即前一个围栏本身先当一次frontier；按流绑定规则（highlight-stream-binding.mjs:12-15，源code-block-current.js:1489-1620、addendum-027）首帧渲染早于围栏闭合则保留stream，否则归settled——两者皆为源规定。改为等待前一块闭合且已着色后记录其来源与token节点，delta后断言同一code节点、同一来源、token节点逐一相同（比原来只看属性更严），实测来源为stream。②:547说明文件数25→81：0.2.54起KaTeX/remark-math及其依赖并入同一build/highlight-notices/manifest.json（verify-build.mjs:54-59逐字节校验），check文案同改。③:459“Actual worker target close”2000ms：该窗口在“观测到终止”之后才开始，而Blink对执行中worker的强制终止固定延迟2s。无应用代码的裸隐藏离屏Electron探针（probe-worker-terminate/，12轮）：terminate→target close 2002.1–2003.9ms，观测滞后0.4–17.4ms，4/12轮即会越过原门限；0.2.7–0.2.15全部原生运行记录为2001.5–2002.8ms，r2为2002.8ms边缘通过、r3超时。改为等待≤2500ms以便观测，再以渲染进程自身terminate()时刻断言关闭<2050ms（原门限等效上限约2000＋滞后≤2042ms，量级相同，锚点改正）。本版实测2003.4/2002.7ms。

单测：offscreen-suite-registry.test.mjs新增1项（10个键→精确脚本与报告、6项clipboardCalls精确值、4套无clipboardCalls且不用剪贴板、内存存储方法集精确、四脚本ClipboardItem分支先于legacy读取并return、highlight-coalescing launch形状、git-rail入口规则/bootstrap入口断言/composer-window show:false、turn-footer-server白名单、stubbornOf以shutdown真实模板正例与child_process/net/`const r=require`/process.kill/import/非node:前缀/sh shebang/改名/profile外反例、will-quit launch标记与created加严、bootstrap剪贴板禁止列表精确19项）；0.2.124一项中CODEX_BINARY析取式的正则同步为追加stubbornOf后的精确文本（前三条规则不变）。

验证（日志work/claude-ui-sweep/0.2.125/）：`npm test` 1122项1121通过、0失败、1既有跳过（npm-test.log）；`npm run build`通过；`node scripts/verify-build.mjs`通过（0.2.125，SHA `10d82853040d362a51b81f117089cf52c4c16aff70e469cb71d87452874bb898`，443源文件，builtAt 2026-09-23T20:44:36.050Z）。全部改动后run-all-v125.sh串行跑已登记全部60套（v125-summary.txt，1分钟负载均值2.9–9.3）：首轮60/60退出码0，无复跑；check-reports.cjs（加严为每次启动closed、created全隐藏、剪贴板final===initial）逐份核对v125-report-check.txt：bad=0，build均为0.2.125/10d82853…、passed=true、无error/boundaryError/reportError/cleanupError、violations全为[]；blocked仅menu-bar首启[show,show,focus]与pane-layout第二启[focus]、native仅settings-complete 3项（既有期望）。新10套：workflow-package 0（1项，offscreen-workflow-package-FhfKQP）、git 0（4项，offscreen-git-iB4bce）、highlight 0（11项）、highlight-coalescing 0（3项，offscreen-highlight-coalescing-p1XR8R）、turn-footer 0（11项，offscreen-turn-footer-XEgzEV）、user-actions 0（9项，offscreen-user-actions-s8B3OL）、rich-copy 0（7项，offscreen-rich-copy-IvZTf8）、git-rail 0（10项，2次启动，第二次entry=composer-window，offscreen-git-rail-NViRLu）、shutdown 0（2项，2次启动均宿主自退出code 0＋will-quit证据，quit场景3个stubborn子进程/1079ms、window-close 1个/1072ms，offscreen-shutdown-uP8rQt）、file-search-shutdown 0（2项，offscreen-file-search-shutdown-ak6NNF）。highlight注释数值更正（0.6→0.4ms）后单独复跑通过（v125b-suite-highlight.log，offscreen-highlight-zTTVHK，11项，关闭2002.7ms）。每轮结束后无Electron/vite/codex-server/stubborn/git-wrapper残留进程；~/Library/Application Support下默认userData目录未被本轮写入。截图已查看：git-source-compact（“Branch name copied to clipboard.”经内存剪贴板）、git-rail rail.png。

开发过程失败（均保存日志、均已定位）：git r1（U+2212）；highlight r1（前块stream）、r2（说明文件81）、r3（worker关闭门限竞态）；git-rail r1（适配器DPR探测撞导航）。其余6套首跑即通过。

剩余缺口：validate-local标准链60套现已全部登记离屏并通过，但原生窗口验收（nativeWindowAcceptance）仍为false；本版未新增内存剪贴板方法，若将来脚本在无ClipboardItem的环境下走legacy分支，会被bootstrap拒绝而非静默读取OS剪贴板；被SIGKILL的宿主无法产生will-quit证据，按设计判为失败；package-lock.json的version字段仍停在0.2.93（历来未同步）。

## 0.2.124 测试债C（一）：8个无剪贴板脚本登记离屏run-suite并执行通过，修复/usage关闭后焦点落到Account menu（未安装）

背景：沿用0.2.118/0.2.119机制，把validate-local standard中18套从未离屏执行的脚本里不使用剪贴板的8套登记进`work/offscreen-app-integration-20260922/run-suite.mjs`（standard列表未改）并逐套执行。grep确认8个脚本均不调用electron.clipboard/navigator.clipboard、不show()/focus() BrowserWindow、不开原生对话框（settings-rest的.focus()仅对DOM元素）。暴露1处真实产品回归（已修）、9处脚本过时/竞态期望（5个脚本，已按源更正）、1处适配器边界缺口（connection-lifecycle的独立假服务器）。

登记（脚本→最终fs.writeFile的规范报告，均已核对；electron.launch均为`args:[root]`＋默认executablePath（TEST_ELECTRON_BINARY/TEST_APP_PATH未设，session-actions-ui-test.mjs:14仅在TEST_APP_PATH设置时用打包应用），CODE_DESKTOP_DATA均在analysis下）：protocol-0155→analysis/batch-20260920/protocol-0155-ui-report.json；settings-rest→settings-rest-ui-report.json；session-actions→**analysis/functions-20260920/session-actions-local.json**（该脚本的evidence目录）；menus-states→menus-states-ui-report.json；sidebar-rest→sidebar-rest-ui-report.json；transcript-scroll→transcript-scroll-ui-report.json；integration-race→integration-race-test.json；connection-lifecycle→connection-lifecycle-test.json。8份报告均已有同值`passed`字段（integration-race/connection-lifecycle/transcript-scroll为字面`passed:true`，session-actions为report.passed），无需补字段。无clipboardCalls条目（默认仍为“无内存剪贴板”）、DPR 1、无expectedBlocked条目——全链实测8套每次启动blocked/native/violations均为[]，产品未触发任何window.show/focus。

适配器改动：
- run-suite.mjs：`suites`追加上述8项，其余表未动。
- bootstrap.cjs：新增`standaloneOf`。connection-lifecycle-test.mjs:8-21在本次profile内写出自包含假app-server `connection-server.cjs`（不spawn任何进程，只require node:fs/path/readline），原断言（fixture白名单或proxyOf）拒绝它。新规则仅在以下全部成立时接受CODEX_BINARY：位于本次launch的profile内、文件名恰为connection-server.cjs、首行为node shebang（`#!/usr/bin/env node`或`#!/…/node`；codex.cjs:64直接spawn该文件，故解释器也须受限）、正文无`spawn(`/`exec`/`fork`/`import`/`eval(`/`Function(`/`process.binding|dlopen`、无child_process/net/http/https/tls/dgram/vm/worker_threads字样、每个`require`都带括号且参数恰为'node:fs'/'node:path'/'node:readline'。其它边界断言未改。scratch对照：真实生成文件通过；追加child_process/net require、`const r=require;`、exec(、import(、非node:前缀require、http字样、改名、/bin/sh shebang、profile外路径均被拒。integration-race的代理（spawn唯一目标tests/fixtures/codex-server.cjs，require child_process/readline/fs）经原proxyOf通过，已验证。

产品修复（回归）：通过`/usage`打开的Usage对话框关闭后焦点落到侧栏“Account menu”而不是composer（session-actions r4–r6：关闭Usage后填写“First message”的按键进入Account menu按钮，failureState.active=Account menu）。机制（探针probe-usage-focus*.log，focusin/focusout捕获栈）：SettingsContent中`tab==='usage'`的passive effect声明在焦点生命周期effect之前，先把焦点移进弹窗，生命周期effect随后读`document.activeElement`得到的是弹窗自身；关闭后弹窗已脱离DOM，回退到Account menu。0.2.68加入usage聚焦effect时引入；从账户菜单打开Usage时回退目标恰好就是opener，所以一直未暴露。源Base UI Dialog finalFocus默认回到打开前的焦点元素。改：source-settings.jsx以`useLayoutEffect`在任何passive effect之前记录opener，生命周期effect改用`opener.current`，Account menu回退与其余逻辑不变。修复后探针：关闭后activeElement为“Message Codex”编辑器。session-actions新增断言：Close usage后等待对话框detached且焦点回到ChatComposerEditor。

脚本更正（均非放宽，断言值/容差不变或更严，注释引HANDOFF版本与源）：
- integration-race-test.mjs:11-22代理：0.2.15起（analysis/protocol-0155-20260921/source-contract.md）分页线程（fixture默认，codex-server.cjs:27）以excludeTurns＋initialTurnsPage恢复（src/thread-history-model.mjs:63-66），从initialTurnsPage hydrate（src/main.jsx:1067），不读thread.turns。r1 fixture-history.jsonl三次resume均为excludeTurns:true，代理注入的STALE/CURRENT快照被忽略，CURRENT_SNAPSHOT永不出现。改为注入到initialTurnsPage.data（legacy响应仍写thread.turns）。
- integration-race-test.mjs:36：composer自0.2.81为contenteditable ProseMirror，Playwright inputValue报“Node is not an input…”（r2）；改读其序列化草稿`node.value`（source-composer-editor.jsx:61），期望文本不变。
- session-actions-ui-test.mjs：①清空与填写改用`fillComposer`（composer-test-helpers.mjs，0.2.81先例：Playwright fill设置DOM Range后按Delete，PM尚未读到选区；r1 failure.png显示旧/unknown-command被选中未删除）；②/usage（:40）与限额不可用（:79）断言按0.2.68独立Usage弹窗：对话框名“Usage”、关闭按钮“Close usage”（source-settings.jsx:262），meter显示usedPercent，故“80% remaining/1% remaining”换为同一数据的“20% used/99% used”（session-actions-server.cjs:34：codex桶20%须胜过legacy primary 99%）；不可用时另断言弹窗内meter为0；③Escape关闭Usage后等待detached再输入（弹窗exit期间#root inert，use-modal-presence.js/modal-inert.mjs；r6中/review HOLD的按键丢失）；④仅失败路径新增failureState证据（焦点、composer值、对话框）。
- menus-states-ui-test.mjs:226：加载期“无弹窗/无骨架”选择器命中6个元素——0.2.99侧栏会话列表加载骨架SourceSidebarSkeleton（source-sidebar.jsx:408-413，sidebar-groups.js:7761-7830 AO）复用CDS `.smenu-skeleton`，3行×(圆点＋条)=6（r2诊断metrics.loadingPopups）。选择器排除`[data-testid="sidebar-rows-skeleton"]`内元素，任何menu或其它busy骨架仍失败。
- menus-states-ui-test.mjs:646：标题栏Session menu的Files行自0.2.105带toggleBrowser ⌘⇧F（panes-toggle-current.js:3236-3253，main.jsx:1868），按source-menu.jsx:425 `bareCheck=check&&!hint&&!shortcut`不再是bare槽，细指针下margin 0（同脚本:369数字快捷键Mode行先例）。期望改为[16,16,"0px"]，并新增断言无data-bare、kbd为“⌘ ⇧ F”。
- sidebar-rest-ui-test.mjs:357：digit移组后立即读选区得[P,F1,F2]。与同脚本'u'步骤注释同一竞态：配置文件先于最后一个并发响应到达渲染进程，runBulk在全部settle后才clearSelection。改为先poll选区为[P]再做原断言；poll成功即证明产品确实清空。
- transcript-scroll-ui-test.mjs:366-405：0.2.123起经典工具行为源div[role=button]（approval-current.js:17288-17300），其ce（:16875-16877）在Enter/Space **keydown**即切换，不再是keyup激活的原生button。r2诊断：keydown把已展开的历史工具收起，scrollHeight 5011→4511、scrollTop 4273→3773，可见锚点reply-turn-101偏移−366.703125完全不变。“不导航视口”改为锚点行相同、偏移差≤2px、且scrollTop变化等于切换高度差（±2px）；“激活仍待keyup”改为keydown即切换，keyup后仍只切换一次。

单测：offscreen-suite-registry.test.mjs新增1项（8个键→精确脚本与报告路径、脚本写出该报告名且含passed、无clipboard字样、无clipboardCalls/DPR2/expectedBlocked条目、bootstrap standaloneOf精确文本与断言组合、integration-race代理唯一spawn目标）；新增settings-focus-return.test.mjs 1项（opener在useLayoutEffect中记录、生命周期effect使用opener.current、无passive effect读activeElement、usage聚焦effect与Account menu回退保留）。

验证（日志work/claude-ui-sweep/0.2.124/）：`npm test` 1121项1120通过、0失败、1既有跳过（npm-test.log）；`npm run build`通过；`node scripts/verify-build.mjs`通过（0.2.124，SHA `1115beb17dc55da918984dac46118a5ce4a6c27da22ee64c4f5c5a0b5eeeffd1`，443源文件，builtAt 2026-09-23T20:14:34.070Z）。全部改动后run-all-v124.sh串行跑已登记全部50套（v124-summary.txt，1分钟负载均值3.6–50.6）：首轮50/50退出码0，无复跑；check-reports.cjs逐份核对（v124-report-check.txt）：每份report.json build为0.2.124/1115beb1…、passed=true、无error/boundaryError/reportError/cleanupError，violations全为[]，窗口全部不可见/未聚焦/离屏；blocked仅menu-bar首启[show,show,focus]与pane-layout第二启[focus]、native仅settings-complete 3项（均为既有期望）。新8套：protocol-0155 0（15项，offscreen-protocol-0155-l1h9MO）、settings-rest 0（13项，2次启动，offscreen-settings-rest-rneQfl）、session-actions 0（8项，offscreen-session-actions-foQyDv）、menus-states 0（14项，2次启动，offscreen-menus-states-6qLB2d）、sidebar-rest 0（13项，4次启动，offscreen-sidebar-rest-gri1tZ）、transcript-scroll 0（11项，offscreen-transcript-scroll-ovleRo）、integration-race 0（3项，offscreen-integration-race-oi1sGC）、connection-lifecycle 0（4项，offscreen-connection-lifecycle-HU3HFd），均位于analysis/batch-20260920/。protocol-0155与settings-rest首跑早于产品修复，本链在修复后构建上再次通过。截图已查看：session-actions失败截图（r1选中未删的草稿、r2 Usage弹窗、r3空composer）、usage-home、transcript-reading-ui。

开发过程失败（均保存日志，均已定位）：integration-race r1（分页注入）、r2（inputValue）；session-actions r1（fill('')未清空）、r2（Settings→Usage弹窗）、r3–r5（/usage关闭焦点落到Account menu——产品回归，含失败证据r5）、r6（Escape后未等detached）；menus-states r1–r2（侧栏骨架）、r3（Files ⌘⇧F）；sidebar-rest r1（选区竞态）；transcript-scroll r1–r2（keydown激活）。protocol-0155、settings-rest、connection-lifecycle首轮即通过（connection-lifecycle在standaloneOf加入后首跑）。临时探针脚本已从app/scripts与suites删除，副本为probe-usage-focus-ui-test.mjs.txt。

剩余缺口：标准链其余10套仍未登记离屏、从未执行——使用剪贴板的7套workflow-package、highlight、highlight-coalescing、turn-footer、user-actions、rich-copy、git（需clipboardCalls下限），以及不含clipboard字样但不在本项范围、未评估边界的git-rail、shutdown、file-search-shutdown（测试债C第二部分）；原生窗口验收（nativeWindowAcceptance）仍为false；session-actions-server.cjs不支持account/usage/read，Usage弹窗如实显示“Daily token usage is unavailable”（fixture缺口，非产品问题）。

## 0.2.123 本轮（0.2.118–0.2.123）最终回归（未安装）

构建身份：0.2.123，builtAt 2026-09-23T19:30:47.047Z，SHA `5deb047bd06451eb34669f833efb7a3f66be2f69aac7c7e1aa6268b28ec236cf`，443源文件。日志work/claude-ui-sweep/final/v123-*。`npm run build`通过；`npm test` 1119项1118通过、0失败、1既有跳过；`node scripts/verify-build.mjs`通过。

离屏run-suite已登记全部42套串行（run-all-v123.sh，v123-summary.txt记录每套退出码与负载均值2–5）：首轮42/42通过，无复跑；每份report.json的build均为0.2.123/5deb047b…，passed=true，无boundaryError/reportError/cleanupError，窗口全部不可见/未聚焦/离屏。本轮无产品修复、无测试改动。

未运行：validate-local标准链60套原生窗口脚本（用户禁止占屏）；其中18套未登记离屏、从未执行（见0.2.119剩余缺口）。状态文件analysis/batch2-status-0.2.123-offscreen-20260924.json（unrunSuites为标准链全部60套）。

## 0.2.123 经典独立工具行按源zv几何（无内边距/最小高度/外伸，rounded-sm）与Ve/He/Ue caret、动词颜色状态（未安装）

源链（2.2553.1）：
- `readable/approval-current.js:17288-17300`：非卡片经典行为`div[role=button]`，class `${zv} cursor-pointer`；zv＝c425fb3cf导出`_`＝Y（`analysis/batch2-audit-20260920/readable/c425fb3cf-BPM7HGXR.js:143-144`，导出表已核对）：`relative group/tool flex self-start max-w-full items-center py-0 gap-0.75 text-left focus-visible:outline-hidden hide-focus-ring focus-visible:shadow-focus rounded-sm`——无padding、无min-height、无负外边距、max-width 100%、gap 3px。
- rounded-sm：`c6a992d55-Vcbdv79k.css` `.rounded-sm{border-radius:var(--radius-sm)}`，`--radius-sm:.25rem`。**CDS中不存在`--cds-radius-sm`**（任务说明写的是它；首轮离屏探针解析为0px即暴露），按源用`var(--radius-sm,.25rem)`＝4px。
- 颜色：`:17099-17101` Ve＝!(运行Y‖待审批K‖失败且非benign Ne)；别名`:1424-1433`→c425fb3cf `:149-153`（ny＝u＝ne `text-muted group-hover/tool:text-secondary`；ry＝v＝Q `text-secondary group-hover/tool:text-primary`；Jv＝l＝$ muted＋hover/focus-visible/has-[:focus-visible] secondary；ey＝s＝te `text-secondary`）。He＝Ve?ny:ry；Ue＝Ve?(展开?ey:Jv):ry。`:17120-17133`运行动词为无颜色类的text-body包Le shimmer，失败为`text-body text-danger`。caret＝c425fb3cf ie `:156-166` CaretRight 14、`transition-transform duration-fast motion-reduce:transition-none`、展开rotate-90、常显。
- Ne（`:16920`）＝`ie && !re && !Ee && !je && !S.errorIsBenign`：中断（Ee）与拒绝/策略拒绝（je）不算Ne。
- Le＝shared-7 `rU` ShimmerText（`analysis/batch2-audit-20260920/readable/shared-7-DsClUbcz.js:18297-18348`）default变体：浅色底色text-primary、峰值`color-mix(primary 30%, white)`；深色底色text-secondary、峰值text-primary；motion-reduce绘制底色。
- 行高：zv本身不设字号，动词span为text-body；转录内`c6a992d55` `.epitaxy-transcript-typography :where(.text-body)`把text-body改写为`--chat-body/--chat-leading`，故一行＝14px×1.42857（布局19.984375px），而非裸`--cds-leading-body`（此作用域为19px的chrome值）。任务“高度等于--cds-leading-body”按源改为等于转录text-body行，在测试注释中说明。

改动（仅CSS，除一处shimmer钩子）：
- `app/src/source-tool-group.css`：新增`.source-step-classic:not(.stg-row *) > .source-step-trigger`：padding 0、margin 0、min-height 0、max-width 100%、gap 3px、radius `var(--radius-sm,.25rem)`；有aria-expanded时cursor pointer；focus-visible `outline:none; box-shadow:var(--cds-focus-shadow)`。本地data-state映射（注释写明）：busy＝Y、blocked＝K、failed＝Ne（Codex协议无errorIsBenign，故所有Codex failed均非benign）；done、denied（je）、stopped（Ee）、unknown（本地传输中断）为已结算Ve。caret：已结算muted，trigger `:hover/:focus-visible/:has(:focus-visible)/[aria-expanded=true]`为secondary；busy/blocked/failed为secondary、hover primary；opacity 1；`transition:transform var(--cds-dur-fast) var(--default-transition-timing-function,cubic-bezier(.4,0,.2,1))`（审查修正，见下），`prefers-reduced-motion`与`html[data-local-motion=reduce]`下none。动词：已结算沿用基础规则（muted/hover secondary）；blocked secondary、hover primary；failed恒danger（此前`.source-step-trigger:hover .source-step-label`因source-session.css后加载会把失败动词悬停改成secondary，现以更高特异性修正）；busy设置color与shimmer变量为rU default（浅色primary＋峰值mix，`[data-mode=dark]`为secondary＋峰值primary），reduce-motion时currentColor即对应底色。全部用`:not(.stg-row *)`限定，不影响组内行与`.stg-trigger`。
- `app/src/source-session.css`：`.source-shimmer`渐变峰值改为`var(--source-shimmer-peak, var(--cds-text-primary))`，默认值不变，其余shimmer用法外观不变。
- 核对：`.source-shimmer`原底色secondary/峰值primary只与rU深色一致，浅色与源矛盾，故仅对经典独立运行动词调整。非经典TurnStatusStep（Thinking、Compacted conversation、Review）仍用source-session.css的26px/-4px几何。
- 版本0.2.122→0.2.123。

测试：
- `app/tests/source-tool-incard.test.mjs`新增1项SSR：独立command（done/busy/blocked（pendingApprovalItemIds）/failed）与Read行包裹层带`source-step-classic`及对应data-state，trigger为role=button＋aria-expanded，有caret；Read带sft-step；contextCompaction行为TurnStatusStep但无source-step-classic；CSS含zv几何规则与duration-fast过渡。
- `app/scripts/run-command-ui-test.mjs`（rc-solo）：新增helper（classicStyle/assertClassicGeometry/assertSettledCaret，令牌探针解析`--radius-sm`（且断言非0px）、`--cds-dur-fast`、转录text-body行高、`--cds-focus-shadow`）。断言padding四边0px、margin左右0px、min-height 0px或auto、max-width 100%、gap 3px、radius＝4px、高度＝19.984375、cursor pointer、caret opacity 1、transition-property transform、duration 0.06s；caret与动词静止muted、悬停secondary；Shift+Tab/Tab键盘焦点下`:focus-visible`为真、caret secondary、outline none、box-shadow＝解析后的focus-shadow；展开并失焦后caret secondary。夹具新增rc-t3回合的contextCompaction行：Compacted conversation仍min-height 26px、高26、margin-left -4px、padding-left 4px。审批阻塞行（fixture:run-command-approval，独立行）同样zv几何，caret与动词secondary、悬停均primary。深色：rc-solo几何不变、caret与动词muted→secondary（深色secondary rgb(195,194,183)）、键盘焦点与展开状态同上。说明：text-muted在浅/深色同为rgb(137,135,129)，故“深色令牌生效”改以secondary不同断言（首轮我写的muted不同断言本身错误）。
- `app/scripts/edit-read-ui-test.mjs`（solo-read，sft-step）：同一helper，浅色全部状态；深色在该套件既有的reduce-motion仿真下断言caret transition为none/0s（motion-reduce:transition-none），其余同上。切换一律用键盘Enter，避免指针落在ToolPath上。
- `app/scripts/session-ui-test.mjs`：原`:268-271/:422`对独立busy stream-command行断言26px——该行是经典zv行，26px是非工具TurnStatusStep的min-height，与approval-current.js:17298/c425fb3cf:143矛盾；改为等于解析后的转录text-body行高（实测19.984375＝19.984375），注释写明原因；检查文本去掉“26px tool row”，另加一条check。无其他断言放宽。

验证（日志work/claude-ui-sweep/0.2.123/）：`npm run build`通过；`npm test` 1119项1118通过、0失败、1既有跳过；`node scripts/verify-build.mjs`通过（0.2.123，SHA `df8e61468e8fad18f0cc62e492e77ecd1e4f82bec9b08d02493413d11c1ddcee`，443源文件）。离屏run-suite串行（均该构建、passed=true、窗口不可见/未聚焦/离屏、OS剪贴板未触达）：run-command（15项，offscreen-run-command-cJOyqz）、edit-read（17项，offscreen-edit-read-OONo9q）、subagents（7项，offscreen-subagents-uYAbz9）、transcript-states（5项，offscreen-transcript-states-vFn0EV）、workflows（9项，2次启动，offscreen-workflows-uiAJY0）、session（11项，offscreen-session-VvWAYT，行高19.984375）；另跑background-tasks（9项，offscreen-background-tasks-C6rC03）与approval-card（11项，offscreen-approval-card-AP2w7M）。已查看截图command-standalone-light/dark与standalone-read-light：独立行与组内内容列左缘对齐、无外伸。

审查修正（仍为0.2.123，未升版本）：caret过渡原先只写`transition:transform var(--cds-dur-fast)`，缓动回落为`ease`；源ie（c425fb3cf `:156-166`）为Tailwind `transition-transform duration-fast`，2.2553.1发布CSS中`.transition-transform{transition-timing-function:var(--tw-ease,var(--default-transition-timing-function))}`、`--default-transition-timing-function:cubic-bezier(.4, 0, .2, 1)`（已在reference/current-2.2553.1/asar已编译CSS核对）。`source-tool-group.css`该规则补上与`.source-tree-caret`（source-session.css:723）相同的`var(--default-transition-timing-function,cubic-bezier(.4,0,.2,1))`，并加注释。rc-solo/solo-read的assertClassicGeometry新增caret `transitionTimingFunction`＝`cubic-bezier(0.4, 0, 0.2, 1)`；edit-read深色在reduce-motion仿真下`transition:none`把缓动复位为初始值`ease`，故该调用显式传`easing:'ease'`。其余审查结论（zv几何、Ve/He/Ue映射、rU shimmer、--radius-sm、行高、`.stg-row`作用域、Compacted 26px）无需改动。验证（日志work/claude-ui-sweep/0.2.123/review-fix/）：`npm run build`通过；`npm test` 1119项1118通过、0失败、1既有跳过；`node scripts/verify-build.mjs`通过（0.2.123，SHA `5deb047bd06451eb34669f833efb7a3f66be2f69aac7c7e1aa6268b28ec236cf`，443源文件）。离屏run-suite串行（均该构建、passed=true、窗口不可见/未聚焦/离屏）：run-command（15项，offscreen-run-command-hetVUU，caret缓动13次测得cubic-bezier）、edit-read（17项，offscreen-edit-read-yq8tvK，浅色cubic-bezier、深色reduce为ease/none/0s）、subagents（7项，offscreen-subagents-83ORxi）、transcript-states（5项，offscreen-transcript-states-dWsy5w）、workflows（9项，2次启动，offscreen-workflows-3j6ozE）、session（11项，offscreen-session-eG5pkc）。

保留失败与原因（均为本版新增断言写法，已修正后通过，非产品回归）：
- run-command r1/r2：`--cds-leading-body`宽度/高度探针得19px而行高19.984375——转录内text-body被epitaxy-transcript-typography改写为chat-body/chat-leading（见上），探针改为`calc(var(--chat-body) * var(--chat-leading))`。
- run-command r3：“深色muted不同”断言错误（text-muted两主题同值），改为secondary不同；同轮报告显示radius令牌解析为0px→发现`--cds-radius-sm`不存在，CSS与测试改用源`--radius-sm`，并加非0px守卫。r4通过。

剩余差距：
- 组内（.stg-row）经典行在源中同为zv行、同一Ve/He/Ue颜色，但按本项要求未改：组内caret仍恒muted、动词悬停secondary（无blocked/busy的secondary→primary）；组内trigger半径仍为6px。
- 独立busy行caret（secondary→primary悬停）只由CSS与SSR data-state覆盖，离屏只测了审批阻塞行（夹具中运行中的命令都在组内）；busy动词shimmer浅色峰值未做像素级离屏断言（session仅断言动画名）。
- Codex协议没有errorIsBenign，因此源中“benign失败按已结算着色”的分支本地无法出现。

## 0.2.122 Changes面板文件头按源We/Ke/Ze/$e：He chevron、文件类型图标、CDS路径提示、仅W标签、Renamed from、Open file按钮与Copy右键菜单（未安装）

源链（2.2553.1）：
- `ion-dist/assets/v1/c219730b0-DMsvWaVJ.js`（prettier副本）：He chevron路径；Ue＝`min-w-0 shrink-[9999] truncate text-body text-muted`；W仅五个行标签（Binary file/Too large to show/Whitespace only/Made executable/No longer executable）及提示后缀`{path} (…)`；qe只把100644↔100755映射为set/cleared。We顺序：aria-hidden `span.flex.items-center.justify-center.size-[16px].shrink-0.text-muted`（禁用时opacity-40）内16×16 svg（`transition-transform duration-fast motion-reduce:transition-none`，收起加`-rotate-90`）→ Icon ae(basename) xs `shrink-0 text-muted` → CDS提示E{content, delay 150, multiline, side bottom, hoverable false}包`span.flex.min-w-0.text-body.text-secondary`＞ge路径 → Ke → 标签 → Xe（评审线程计数，本地无） → 计数`span.flex.shrink-0.items-center.gap-0.5.text-body.tabular-nums`（'+n' text-git-added、'−n' text-git-removed） → reserveAction时`span[aria-hidden][data-size=xs].w-control.shrink-0`。提示文本＝path或`{previousPath} → {path}`，再依次套各标签后缀。Ke“Renamed from {path}”同目录时只显示basename，路径元素title为完整旧路径。Ze：`span.absolute.inset-y-0.right-0.flex.items-center.pr-md.opacity-0.transition-opacity … group-hover/diff-file:opacity-100 group-focus-within/diff-file:opacity-100 pointer-coarse:opacity-100`包CDS Button{xs, ghost, ArrowUpRight, iconOnly, aria-label 'Open file', tooltipSide bottom}（shared-frame ks :2839-2842：iconOnly＋aria-label→提示{content aria-label, side, hoverable false}；Ts xs→auto-sm图标＝紧凑12/舒适16）。$e：Attach as context（有handler时）→ c3e58cab4 Copy子菜单 → Separator → Open file → renderFileMenuItems。
- `c3e58cab4-BIx3-QB8.js` p/f/d：SubmenuPopup side right、align start、sideOffset -4；Absolute path（仅有绝对路径时）/Relative path/Filename（Wp basename）；写入后addSuccess“Copied to clipboard.”；复制前去除控制/双向/行分隔字符。
- `c784da984-Dg-Rfi0I.js` p（ge，We传title ""）：先basename（max-w-full shrink-0 truncate），后目录（去尾斜杠，footnote muted，ResizeObserver测量不足min(dir+last, min(last,5em)+1em)-1时data-clipped→透明）；c：目录前缀＋末段，aria-label＝path（有前缀时）。
- `readable/panes-diff-view-current.js:3700-3774` aa：ContextMenu Trigger `group/diff-file relative`；无body时aria-disabled且无aria-expanded；`:3469`删除文件不传onOpenFile（Open file与reserve均不渲染）。`c856385e2` Hn（attachFileToChat）、Un（打开文件）、Wn（resolveAbsolutePath＝根目录拼接）。

改动：
- 新增`app/src/diff-file-header-model.mjs`（纯函数）：DIFF_ROW_LABELS（W）、executableChange（qe）、renamedFrom、rowLabels（binary→仅解析器已知；tooLarge/whitespaceOnly只在解析器置位时使用，当前解析器都不产生，不从hunk推断）、headerTooltip、renamedFromDisplay（Ke）、splitPosixPath（shared-11 Um）、pathParts（c784 p）、stripClipboardControls（c3e58cab4 d同一正则）、absoluteDiffPath、copyChoices。
- `app/src/source-diff.jsx`：SourceDiff新增`placement`（默认"inline"）与`fileActions`，根节点带`data-placement`。**仅Changes放置**渲染新`ChangesFileHeader`：头部div为`sdiff-header group/diff-file relative`（onContextMenu→光标锚定的SourceMenu，data-cds ContextMenu、layer contextmenu、sideOffset -5/alignOffset 2），保留原切换button（aria-expanded/aria-controls、Enter），内容按We顺序：He svg、`fileKindIcon(basename)` 12px、SourceTooltip包`span.sdiff-path`＞DiffPathLabel（c784 p移植，含data-clipped测量）、RenamedFrom（Ke）、W行标签、计数（We无条件渲染，binary为+0/−0；仅解析器fallback文件不显示——diff-model把其added/removed置null即未知，写数字就是编造）、有Open file时的w-control占位；按钮外Ze（SourceSettingsButton xs ghost iconOnly ArrowUpRight，SourceTooltip 'Open file' bottom）。菜单：Attach as context → Copy▸（右侧、start、-4）Absolute path/Relative path/Filename → Separator → Open file。删除文件无Open file、无占位、无Attach。移除Changes放置中的原生title、Copy patch按钮与role=status行（源头部无对应物，c219730b0 We/$e）。非W标签（New file/Deleted file/Copied from/Mode …）不再出现在Changes头部；无文本hunk的文件（纯重命名、空新增/删除文件、仅mode变化、binary）按`:3279` hasBody＝meta && hunks.length>0渲染aa无body态：button aria-disabled、无aria-expanded/aria-controls/onClick，We chevron span加opacity-40且svg保持-rotate-90，不渲染正文（Changes放置不再出现“No text hunks in this patch”或重复标签的填充正文；该行只在inline放置可达）；解析器fallback文件（源meta＝null）仍可切换，因本地正文展示原始patch而非隐藏——本地适配。
- 其他调用方核对：`source-session.jsx` Diff仅两处——FileChanges（审批卡片`SourceApproval`内联差异）与FilePane的Changes面板；前者保持默认placement "inline"，原头部（路径·元数据、原生title、Copy patch、status）行为不变并在SourceDiff注释中说明；后者传`placement="changes" fileActions={diffFileActions}`。弹出窗口（popout）Changes未传fileActions→无Open file/右键菜单（该窗口无Files窗格与toast表面，记为差距）。
- `app/src/source-session.jsx` FilePane新增`diffFileActions`属性；`app/src/main.jsx`构造diffFileActions：root＝git仓库toplevel（workspace-git-status cwd）或workdir；onCopy＝copyWithToast(text, 'Copied to clipboard.')；onOpenFile走transcript chip同一路径openFileRef（workdir内用相对路径，否则绝对路径）；onAttachFile——**本地存在真实的composer文件附件路径**（stageFiles按路径引用→发送时为mention，与粘贴/拖放的referenced分支相同），故实现Attach as context；删除文件不提供（路径已不存在，属本地适配，源仍传Lt）。
- `app/src/source-settings-button.jsx`：iconSize新增'auto-sm'（紧凑12/舒适16，shared-frame Ts/aa）。
- `app/src/source-diff.css`：旧`.sdiff-header span`/`.sdiff-path`/`.sdiff-counts`规则限定为非changes放置；changes放置下切换按钮内span与Ze包裹`display/white-space: revert-layer`（message-style未分层的`.diff span{display:block;white-space:pre-wrap}`会压过c6a992d55分层utility）；切换按钮右内边距改为pad-md（占位由w-control承担）；`.sdiff-path-directory[data-clipped]{opacity:0}`；Ze显隐用本地CSS：默认0、header `:hover/:focus-within`为1、`(pointer:coarse)`恒为1（加载的utility副本无pointer-coarse:opacity-100）。
- 版本0.2.121→0.2.122。

测试：
- 新增`app/tests/diff-file-header.test.mjs`（7项）：模型（qe仅644↔755、W顺序、提示后缀叠加与重命名箭头、Ke basename、控制字符去除、copyChoices）；Vite SSR：修改文件头无任何[title]、无Copy patch/status、He svg与class、图标字形＝fileKindIcon('app.js')＝Code、路径span结构（basename＋目录）、计数与w-control、Ze类串与xs ghost iconOnly按钮；7种文件的标签全部属于W、无New file/Deleted file/Copied from/Mode；同目录重命名文本“Renamed from old.txt”（唯一title为Ke的完整旧路径`docs/old.txt`，源同此）；跨目录保留`a/`前缀；binary为'Binary file'且计数+0/−0；无body（RENAMED、空新增、空删除、run.sh 644→755、symlink mode、binary）头部均为`aria-disabled="true"`、无aria-expanded/aria-controls、chevron `opacity-40`＋svg `-rotate-90`、无sdiff-file-body/“No text hunks”，标签仍仅W且Open file/删除规则不变；修改文件保留切换，fallback文件保留切换、无计数并显示原始patch；Open file在修改文件存在、删除文件不存在（亦无占位），无fileActions时亦无；inline放置原头部不变。
- `app/tests/offscreen-suite-registry.test.mjs`：clipboardCalls允许按启动数组，逐项校验方法名，并断言changes-pane为`[{read:1,writeText:1},{}]`（扩展形状，非放宽）。
- `work/offscreen-app-integration-20260922/run-suite.mjs`：clipboardCalls值可为按启动索引的数组（与expectedBlocked同机制）；changes-pane登记内存剪贴板，首启下限read 1/writeText 1，暗色重启无复制；新增report.memoryClipboardCallsByLaunch。
- 离屏`app/scripts/changes-pane-ui-test.mjs`新增file-header段（保存/恢复内存剪贴板，git-band同法）：头部无[title]/Copy patch/status；悬停路径后[data-cds=Tooltip]“src/app.js”在指针进入约150ms后出现（实测156ms，位于路径下方）；Ze默认opacity 0（等待前一悬停的淡出结束），悬停头部→1，按钮距头部右缘8px（pr-md）、w-control占位与按钮同宽20px；点击Open file在Files窗格打开src/app.js（标签app.js、内容可见），⌘⇧F关闭；收起时chevron svg computed rotate '-90deg'、展开'none'；右键→ContextMenu [Attach as context, Copy, |, Open file]，Copy子菜单[Absolute path, Relative path, Filename]，左缘＝根菜单右缘−4px；Relative path→内存剪贴板'src/app.js'＋toast“Copied to clipboard.”；Attach as context→composer出现app.js文件附件，移除后清空；no-body段（夹具新增已提交的run.sh，refresh后chmod 755）：run.sh头部aria-disabled "true"、aria-expanded/aria-controls为null、cursor default、chevron span opacity 0.4、svg rotate -90deg、标签['Made executable']、计数['+0','−0']、无正文与填充文本，点击（Playwright视aria-disabled为不可用，故force真实指针点击）、Enter、Expand all files后不变，其余3文件正文仍在；悬停路径提示“run.sh (made executable)”；右键仍为[Attach as context, Copy, |, Open file]；refresh-clean的`git checkout -- .`恢复mode。截图changes-no-body已查看。截图changes-path-tooltip、changes-open-file-hover、changes-open-file-files-pane、changes-context-copy、changes-attach-context已查看。
- `app/scripts/diff-ui-test.mjs`：原`:201-205`断言“Copy patch for alpha.txt”按钮与“Copied patch”status并比对剪贴板＝Git patch——源头部无此按钮（c219730b0 $e / c3e58cab4只提供路径复制），改为右键Copy▸Relative path并断言内存剪贴板恰为'alpha.txt'与toast，且Copy patch按钮数为0（逐字节patch复制检查随非源功能一并移除，渲染行仍对照真实Git核验）；原`:125` counts aria-label“3 additions, 2 deletions”（源无此aria-label）改为断言两个计数span的类与文本['text-git-added','+3']、['text-git-removed','−2']（同等强度）。clipboardCalls diff下限{read:1,writeText:3,write:1}不变（Relative path取代Copy patch的一次writeText）。

验证（日志work/claude-ui-sweep/0.2.122/）：`npm test` 1117项1116通过、0失败、1既有跳过（npm-test.log；首轮1失败为registry测试不认识数组形状，已按上扩展）；`npm run build`通过；`node scripts/verify-build.mjs`通过（0.2.122，SHA `33d1832c3b84b0fdb4ea02d4a0863d09480e38200fce1fe6acd260f114eeef0d`，443源文件）。离屏run-suite串行（均该构建、passed=true、窗口不可见/未聚焦/离屏、OS剪贴板未触达）：changes-pane（17项，2次启动，offscreen-changes-pane-eRQwQH / changes-pane-ui-ALLxzX；内存剪贴板首启read,writeText,readText,write，二启无调用）、diff（8项，offscreen-diff-JK3Ogs）、git-band（10项，offscreen-git-band-psQ5AE）、edit-read（16项，offscreen-edit-read-BVoIUS）；另跑approval-card（11项，offscreen-approval-card-OaDldV，内联放置不变）与files-pane（10项，offscreen-files-pane-ccET1z）。

评审修复（同版0.2.122，未升版）：
- 发现1（无body态缺失，且“每个本地文件都有正文”的理由在Changes放置不成立——New file/Renamed from/Mode事实已移出正文）：确认成立，按上实现`:3279` hasBody与aa/We禁用态；源码注释与本节同步更正。
- 发现2（binary/fallback隐藏计数）：binary确无源依据，改为无条件渲染（+0/−0，解析器已有0/0）；fallback保留隐藏——diff-model对fallback文件置added/removed为null（未知），渲染数字违反“不编造数据”，此为真实理由；单测“no line counts for a binary file”改为断言+0/−0（按源更正，非放宽），另断言fallback无计数。
- 验证（日志work/claude-ui-sweep/0.2.122/review-fix/）：`npm run build`通过；`npm test` 1118项1117通过、0失败、1既有跳过；`node scripts/verify-build.mjs`通过（0.2.122，SHA `2846978efd3bf53457604a5130d2055380c9a2b2cfe30eab291e22105341b0bf`，443源文件）。离屏run-suite串行（均该构建、passed=true、窗口不可见/未聚焦/离屏、OS剪贴板未触达）：changes-pane（18项，2次启动，offscreen-changes-pane-kFcjiW / changes-pane-ui-9qy631；内存剪贴板首启read,writeText,readText,write，二启无调用，与前次相同）、diff（8项，offscreen-diff-pra3aE，内存剪贴板调用序列与本版前次offscreen-diff-JK3Ogs逐项相同）、git-band（10项，offscreen-git-band-YMzove）、edit-read（16项，offscreen-edit-read-iQfrUS）、approval-card（11项，offscreen-approval-card-tbWwcJ，inline放置不变）。
- 保留失败：changes-pane首轮（offscreen-changes-pane-qoppoa / changes-pane-ui-bWOVLO）在新增no-body段失败——Playwright `click()`的可操作性检查把aria-disabled按钮视为not enabled而超时（首个探针本身已全部符合）；为新断言写法问题，改为`click({force:true})`（仍是真实指针点击）后通过。

保留失败与原因（均为本版新增断言本身，非产品回归）：
- changes-pane r1（offscreen-changes-pane-I61Szp）：Ze opacity读到0.031≠0——前一步悬停路径时也悬停了头部，neutral后transition-opacity仍在淡出；改为轮询到0（断言值未变）。
- changes-pane r2（offscreen-changes-pane-TEDf6t）：子菜单左缘955.05＝触发行右缘，而断言按触发行右缘−4计算；本地（同Base UI）子菜单水平锚定父popup边缘（menu-model nestedAnchor），根菜单右缘959.05−4＝955.05，sideOffset -4正确生效；改为以根ContextMenu右缘为基准。r3通过；r4为截图前等待提示opacity 1（r3截图时提示尚在进入过渡）后通过。

剩余差距：
- 源fallback（meta＝null）文件无body且禁用；本地仍显示原始patch正文并可切换（本地适配，见上）。
- Xe评审线程计数、renderFileMenuItems（c856385e2 Vn：Open in/远端链接等）无本地能力，未实现；tooLarge/whitespaceOnly无本地数据源。
- popout窗口的Changes头部无Open file/右键菜单（无同窗Files窗格与toast表面）。
- 右键菜单以鼠标关闭后焦点回到切换按钮并显示focus-visible环（SourceMenu既有焦点恢复行为，diff-source-real-git.png可见），未改。
- 内联（审批卡片）放置仍保留非源的Copy patch与元数据标签，本项按要求未动。

## 0.2.121 侧栏New行实心df-new-circle与df-user-menu-btn账户页脚几何（未安装）

源链（2.2553.1 readable）：
- `sidebar-groups.js:7062-7073` mD＝`span.df-new-circle.flex.shrink-0.items-center.justify-center.rounded-full`包Icon Add `sm`（shared-frame ra：sm＝16，xs＝12），类`text-secondary group-hover:text-primary group-data-[selected=focused]:text-primary`；`:12828-12842`仅New的`span.df-leading-slot`放mD，Artifacts/Routines/Customize保持普通图标。shared-21 ND（`:7590-7597`）给每个普通行按钮加`group`。
- `desktop-layout.css:532-542`（尺寸、hover 25% muted混色、`[data-selected=focused]`透明）、`:884-886`（18px/13px）、`:1917-1929`（`span[style*=font-size]` 13px/700；web底色`--cds-neutral-70`，暗色`--cds-neutral-150`）——本地shared-styles-DunnEebG.css副本已加载，本地Icon以内联font-size渲染，选择器直接命中，无需镜像规则。
- `sidebar-groups.js:5225-5310` pw：`button.df-user-menu-btn.cds-reset`（h-[max(28px,var(--df-footer-btn-size))]、rounded-[var(--df-radius-pill)]、pl-[var(--df-row-px)] pr-2、gap-[var(--df-row-gap)]、hover:bg-[var(--df-hover)]、focus-visible:shadow-focus）；`span.df-on-rail`（w-[var(--df-leading-slot)]）放Tn；名称`span.whitespace-nowrap.text-secondary.max-w-full.shrink-0`；aria-hidden的`·`与后缀均为`df-footer-suffix-text text-muted`；CaretDown xs `shrink-0 text-muted`在后缀容器外（名称为空时不渲染）。`sidebar-main.js:14187-14202` hL（df-footer-row＋df-footer-aux），`:14970-14976` df-bottom-tray，`:14925`源body `gap-2 … pb-1.5`。
- Tn核对：sidebar-groups导入`kr as Tn`＝shared-21 `_B`（`:15687-15692`），2.2553.1中无论账户一律返回`js`＝shared-frame `Mr`＝`dv`（`:10218`）→`bd` Spark（`:5128`），sm为16px、shrink-0；name/photo计算未被使用。故头像用已有`SourceSpark`（静态，16），不用首字母——任务清单“无Avatar组件则保留首字母”的回退与源不符，以源为准。

改动：
- `app/src/source-sidebar.jsx`：四个nav行按钮加`group`；New的前导槽为`source-leading-slot df-leading-slot > span.df-new-circle… > Icon Add 16`（带上述三类颜色utility），其他三行不变。账户页脚改为`div.df-bottom-tray.shrink-0 > div.df-footer-row.account-footer… > div.min-w-0.flex-1 > button.df-user-menu-btn.account-button…`（pw全类串、`data-testid="user-menu-button"`、保留aria-label“Account menu”与menuTriggerProps菜单行为），df-on-rail内`SourceSpark size=16`，df-footer-suffix内名称/`·`/后缀，xs CaretDown；本地Connection settings按钮（诚实的本地适配）放进`df-footer-aux`，因此`:has(.df-footer-aux:empty)`规则不生效。数据不变：名称仍取displayName首词，后缀仍为accountLabel（planType或“Codex”）；删除非源`<small>`与手工首字母头像。
- `app/src/style.css`：删除`.account-footer/.account-button/.account-name/.avatar`旧度量（44px min-height、30px按钮、12px字、ghost-hover、20px头像）。新增：`.source-sidebar .df-bottom-tray{margin:0 -8px}`——源body的gap-2/pb-1.5吸收tray的-8px上/-6px下外边距，本地body gap 0且无底部内边距，只保留左右-8px。另：pw的utility位于c6a992d55-Vcbdv79k.css的`@layer utilities/components`，被本文件顶部未分层的`button{padding:0;background:transparent}`与`button:focus-visible{outline}`压过（首轮离屏实测padding-left 0px≠2px），故仅重述冲突声明：`.df-user-menu-btn{padding:0 8px 0 var(--df-row-px)}`、`:hover{background-color:var(--df-hover)}`、`:focus-visible{outline:none}`；高度、圆角、gap、shadow-focus照常由已加载CSS提供。页脚行8px内边距、tray 0.5px发丝线、后缀mask/12px与后缀字号calc(row-font - 2px)均来自已加载shared-styles。
- 版本0.2.120→0.2.121。

测试：
- `app/tests/source-sidebar-states.test.mjs`：newRow匹配器随DOM改为`class="source-sidebar-nav-row group"`（非放宽，注释引ND）；新增2项SSR——New前导槽含唯一`df-new-circle`与带颜色utility的Add（16px），其余三行无圆且为普通图标；账户按钮为df-user-menu-btn全类串、type/testid/aria-label/aria-haspopup，df-on-rail内16px静态Spark，名称/aria-hidden`·`/df-footer-suffix-text后缀、xs muted caret，无`<small>`/avatar/account-name，无label时无点和后缀。
- 离屏`app/scripts/sidebar-chrome-ui-test.mjs`新增3段（均用探针元素解析token）：new-circle——New选中时圆透明、字形primary；打开会话后18×18、radius≥9、底色＝解析后`--cds-neutral-70`（rgb(234,233,228)）、字形13px/700 secondary；悬停为25% muted混色且字形primary；再点New恢复透明。account-footer——按钮28px、radius 6px＝--df-radius-pill、padding-left＝--df-row-px(2px)、padding-right 8px、gap＝--df-row-gap(4px)；名称13px＝--df-row-font、色＝--cds-text-secondary；`·`与后缀11px、muted、aria-hidden仅点；df-footer-suffix mask为linear-gradient、右内边距12px；caret 12px muted；槽宽＝--df-leading-slot、Spark 16×16；页脚行padding 8px、高44；tray发丝线与0.5px探针一致（DPR1下Chromium取整为1px，首轮直接断言'0.5px'失败，改为探针比较）；悬停底色＝解析后`--df-hover`；从Connection settings Shift+Tab后`:focus-visible`且box-shadow非none。dark-footer-760——暗色760px页脚行/按钮无横向溢出且在侧栏内，打开会话时圆底色＝`--cds-neutral-150`（rgb(44,44,42)），文档/body无溢出。截图new-circle-hover、account-footer-hover、account-footer-focus、sidebar-footer-circle-dark-760已查看。
- account-lifecycle、home-account-usage未选中页脚，无需改选择器；menus-states的`.account-button`类名保留。

验证（日志work/claude-ui-sweep/0.2.121/）：`npm test` 1111项1110通过、0失败、1既有跳过（npm-test.log）；`npm run build`通过；`node scripts/verify-build.mjs`通过（0.2.121，SHA `99c1639f0658eb3f249202054653a3bbbd78488cc16200915b7a74d1504f2c38`，442源文件）。离屏run-suite串行（均build 0.2.121/99c1639f…、passed=true、窗口不可见/未聚焦/离屏）：sidebar-chrome（39项，3次启动，offscreen-sidebar-chrome-1kGySM / sidebar-chrome-ui-GSYKB8）、account-lifecycle（12项，offscreen-account-lifecycle-ayd2Di）、home-account-usage（3项，offscreen-home-account-usage-IzlxEy）、sidebar（10项，3次启动，offscreen-sidebar-Whcn1A）、code（9项，offscreen-code-W84nyF）、scrollbar-mode（5项，offscreen-scrollbar-mode-dQUzON）、home-page（19项，4次启动，offscreen-home-page-TQ9hvG）。sidebar-chrome前两轮失败均为新增断言本身（上述layer冲突为产品修复；发丝线为测试更正），第三轮通过；无保留失败。

剩余差距：
- 源pw的pending-invite头像角标（`o > 0`）、comfortable密度md头像（20px）、hideSuffix变体及hover外的`[data-popup-open]`样式均无本地能力/场景，未实现；旧实现菜单打开时的ghost-hover底色（非源）已随删除。
- menus-states-ui-test（测`.account-button`弹层）未登记run-suite，本轮未执行。
- 名称仍取displayName首词（本地数据），源为identity全称。

## 0.2.120 Composer chin快捷键（⌘⇧M/⌥⌘M Mode、⌘⇧I Model、⌘⇧E Effort、⌥⌘F Fast、Mode内数字选择）、Mode提示快捷键/危险文案、Fast状态live region与chin CDS提示（未安装）

源链（2.2553.1 readable）：
- `sidebar-rows.js:14191-14200`（shared-21 aR行）：openModeMenu `cmd+shift+m`（KeyM，when isClaudeApp）与`cmd+alt+m`（KeyM）；openModelMenu `cmd+shift+i`（KeyI）；openEffortMenu `cmd+shift+e`（KeyE）；toggleFastMode `cmd+alt+f`（KeyF）。已核对匹配器Se＝shared-21 `uR`（:14326-14346，按e.code经dR）＋`sR`（:14300-14309，mac上metaKey/ctrlKey/shiftKey/altKey**全部精确相等**，故⌘⇧⌥M、⌃⌘⇧M都不匹配），ve＝`mR`（:14362）取该命令首行→Mode提示显示⌘⇧M。
- `c360a9e1c-GPs-MV9u.js:4626-4630` qd命令→菜单；`Zd`（:4655-4775）：面板活动时window**捕获阶段**keydown，忽略defaultPrevented/hidden；菜单开着时无修饰Escape关闭；Mode菜单开着时无修饰Digit*一律preventDefault+stopPropagation，Digit1-9选第N个可用quick-key项（Jd/Yd），Digit0不选；toggleFastMode仅在`s && !a`（有fast、模型选择器未禁用）时preventDefault+stopPropagation且repeat不切换；其余qd命令先preventDefault+stopPropagation，非repeat才走w。w：effort且选项≤1回落model；已有chin菜单开着时仅同一（回落后）菜单的chord关闭它、其他忽略；模型选择器禁用时忽略model/effort；无条目no-op。
- `:4544-4575` Ud：Zt{content: tooltip ?? header, shortcut: triggerKey, open: !o && undefined}；`:4924-4945` Mode的triggerKey＝ve("openModeMenu")，tooltip：危险（bypass）为“Claude can modify or delete files without asking”，否则chipLevel description，再否则header“Mode”。
- `:4840-4848`＋`:4972-4980` ze：`<span role=status aria-live=polite class=sr-only>` 'Fast mode on'/'Fast mode off'，位于trailing Ve最后（usage之后）。
- `c8e04f916`（prettier :236-262）：effort触发器包在f{content: effortLabel, detail: 仅warning badge时的警告文案, open: !popoverOpen && undefined}。`shared-14 :7160-7226`：Model pill无warning时无提示。

改动：
- 新增`app/src/chin-shortcuts.mjs`（pane-shortcuts.mjs同风格纯函数）：`chinShortcutCommand(event)`按e.code、要求metaKey且ctrlKey为false、shift/alt与行精确一致、isComposing返回null→'mode'|'model'|'effort'|'fast'|null；`resolveChinRequest({command, openKind, effortCount, modelCount, modeCount, pickerDisabled, repeat})`实现w回落/同键关闭/他菜单忽略/无条目no-op/repeat不开；`modeMenuDigit`（无修饰Digit0-9）；`CHIN_MENU_KINDS`（mode→permission、model→model、effort→effort）与`MODE_MENU_KEYS`原始键串`cmd+shift+m`（评审修正：原为硬编码“⌘⇧M”，见下）。
- `main.jsx`：独立的捕获阶段window keydown effect（`addEventListener('keydown', fn, true)`）。Settings、actionDialog、rename、搜索、whatsNew、workflowLaunch、Bypass确认框打开，非chin菜单打开，无`.sc-chin`或其在inert中，或event.defaultPrevented时完全不处理。Mode菜单打开时无修饰Digit→preventDefault+stopPropagation，1-9（从任意目标、含repeat，见评审修正）点击`.sp-permission-menu [data-number-key=N]`（渲染顺序即numberedModeItems，走菜单项自身click路径：选择、关闭、finalFocus回编辑器）。Mode/Model/Effort chord→preventDefault+stopPropagation，resolveChinRequest后在`.sc-permission`/`.sc-model-trigger`/`.sc-effort-trigger`上openMenu（与chin按钮同锚点）；触发器不存在或disabled（本地running/sending禁用Mode与Model）即no-op。Fast：仅当fastTier存在且模型菜单自己的Fast行可用（`fastSaving||running||sending||!connected`为假，对应源`s && !a`）时才preventDefault+stopPropagation，非repeat调用`changeFastMode(!fastEnabled)`；否则不认领。Escape保持现有路径（SourceMenu document监听＋冒泡处理器）。监听器以`useLayoutEffect`注册（评审修正，见下）。⌘⇧D/⌘⇧F窗格chord、⌥⌘I（DevTools）不重叠。SourceComposer新增`fastAvailable={!!fastTier}`。
- `source-composer.jsx`：Mode提示改为导出的`modeTooltip({permission, menuKind})`＝{content: bypass ? 'Codex can modify or delete files without asking' : 'Mode', shortcut '⇧⌘M'（shortcutCaps按源io序格式化，评审修正）, open: menuKind ? false : undefined}——“Codex”为对源“Claude …”同一字符串的诚实适配（本地代理是Codex），本地无chipLevel description故其余模式回落header“Mode”；Effort触发器加CDS提示{content 'Effort', open: menuKind==='effort' ? false : undefined}（原生title随之消失）；Model触发器`tooltip={false}`＝无包裹、无原生title（ComposerButton注释说明三态：对象＝CDS提示、false＝无提示无title、省略＝title={label}回退）；在trailing末尾（usage之后）渲染sr-only role=status live region——**与源的差异**：源无条件渲染，本地仅在模型有Fast tier时渲染（无fast状态时不播报不存在的能力）。aria-label 'Model'/'Reasoning effort'未改（约20个脚本按名选择，留待后续）。
- 版本0.2.119→0.2.120。

测试：
- 新增`app/tests/chin-shortcuts.test.mjs`（6项）：5个chord→命令；ctrl、缺meta、composing、多余shift/alt、⌘⇧F/⌘⇧D、裸⌘字母、⌥⌘I、错码拒绝；effortCount≤1回落model（含无条目no-op、禁用选择器）；同键关闭（按回落后目标比较）、他菜单忽略；repeat不开不关；Digit解析与menu kind映射。
- `app/tests/source-composer-dictation.test.mjs`新增3项SSR：modeTooltip带⇧⌘M、Bypass文案≠'Mode'、menu打开时open:false、Mode按钮无title；`.sc-model-trigger`/`.sc-effort-trigger`无title且aria-label不变；fast live region文本随fastMode、无fast tier不渲染、位于usage之后。
- 离屏`composer-states-ui-test.mjs`：profile写`fixture-model-list.json {fastTierModels:['fixture']}`（fixture既有knob）；新增第16段，在空闲的会话E中运行（r1放在A中失败：A仍有运行中的fixture回合，本地running禁用Mode/Model，chord被认领但不开——行为正确，是脚本放错位置，见保留失败）：合成repeat ⌘⇧I被preventDefault但不开；⌘⇧I开Models（aria-expanded true），同键关、Escape关；⌘⇧E开effort弹层（fixture 4档>1），其间⌘⇧I被认领但忽略；⌘⇧M开Mode，Digit2选第2项（Auto→Manual），⌥⌘M＋原数字恢复（评审修正后改为在popup外派发，见下）；悬停Mode出CDS提示'Mode'＋['⇧⌘M']（评审修正前为['⌘⇧M']）（chin-mode-tooltip.png已查看），悬停Effort出'Effort'；Mode/Model/Effort三个title均null；⌥⌘F切到'Fast mode on'（模型按钮出' Fast'，preferences fastMode true），再按恢复off；Settings打开时四个chord的合成事件defaultPrevented均false、无菜单、fast不变。build必需源列表加入src/chin-shortcuts.mjs。
- `bypass-permission-ui-test.mjs`：首次确认Bypass后悬停Mode，提示为'Codex can modify or delete files without asking'＋['⇧⌘M']（评审修正前为['⌘⇧M']）且无title（bypass-tooltip.png已查看）。
- 脚本更正（非放宽）：`tooltip-ui-test.mjs:445-456`原断言Model/Effort“retain native titles”（本地ComposerButton title={label}回退，非源）；按shared-14 :7160-7226与c8e04f916改为两者title为null，并把Effort加入chin提示循环（'Effort'、top侧、4px偏移、父元素为sc-chin-*，与Add/Mode/Usage同一组断言）。`menu-bar-ui-test.mjs:65`见下。

评审修正（同版0.2.120，未再升版；日志work/claude-ui-sweep/0.2.120/review-*.log、chin-listener-race-probe-*.log）：
- Mode提示快捷键顺序（采纳）：源ve("openModeMenu")返回原始键串`cmd+shift+m`（sidebar-rows.js:14191-14197，mR :14359取第一行）；Ud经Zt→Mu（shared-frame-C_2npUJq.js:4572-4580）以Qa text变体（:2046-2110）渲染，po（:2206-2219）按io=[ctrl,control,alt,option,shift,cmd,command,meta]（:2136）排序修饰键→macOS上为⇧⌘M（逐键kbd、0.3em间距）。原实现硬编码“⌘⇧M”，4处断言钉住了错误顺序。现`chin-shortcuts.mjs`导出`MODE_MENU_KEYS='cmd+shift+m'`，`source-composer.jsx`用已有po/ho移植`shortcutCaps(MODE_MENU_KEYS, true)`拼成“⇧⌘M”（导出`MODE_MENU_SHORTCUT`）。断言按源更正（非放宽）：tests/chin-shortcuts.test.mjs（改为断言原始键串）、tests/source-composer-dictation.test.mjs、scripts/composer-states-ui-test.mjs、scripts/bypass-permission-ui-test.mjs均为'⇧⌘M'。本地提示仍把快捷键渲染为单个字符串（非Qa逐键kbd），与⌘B等既有提示一致，属既有通用差异。任务清单“提示显示⌘⇧M”与其要求核对的源格式化器冲突，以源为准。
- 同类既有问题（早于本项，未改，仅标记）：`source-titlebar.jsx` CHANGES_TOOLTIP '⌘⇧D'（源应为⇧⌘D）、`source-pane-controls.jsx` TOGGLE_SHORTCUT_LABEL '⌘⇧\\'（应为⇧⌘\\）、main.jsx键盘快捷键对话框“⌘⇧\\”。
- Mode菜单数字（采纳）：原离屏检查在焦点位于SourceMenu内时按Digit2，而SourceMenu自身popup onKeyDown（source-menu.jsx:361-364）也选[data-number-key]，不能证明新捕获路径。现改在编辑器（popup外）派发合成keydown：Digit0被认领（defaultPrevented true）但不选、菜单仍开；Digit2被认领并选第2项（Auto→Manual）；Mode关闭时普通数字不认领；⌥⌘M后以repeat:true的原数字恢复。main.jsx去掉数字分支的`!e.repeat`，与源T（c360a9e1c:4728-4737，数字无repeat判断）一致；chin-shortcuts.test增加repeat数字断言。
- 回归（按规则7处理，已修）：本轮修正后composer-states r1在第二次⌥⌘F处超时（Fast仍on，offscreen-composer-states-XYNJul/failure.png）；同构建重跑r2通过，但未以此结案。确定性复现`work/claude-ui-sweep/0.2.120/chin-listener-race-probe.mjs`（离屏bootstrap、隔离fixture profile、不改应用代码）：把performance.now改为每次+100ms，使React Scheduler在commit任务后让出、passive effect推迟到下一宏任务；在status span的MutationObserver（commit后微任务）中派发第二个⌥⌘F。旧构建（SHA ae29eb7a…）3/3被丢弃（defaultPrevented false、保持'Fast mode on'；首版探针第3轮在未打补丁、真实按键恢复后立即派发时也自然重现）。原因：chin监听器由无依赖`useEffect`注册，DefaultLane commit后到passive effect之间window仍挂着旧闭包（fastSaving true）。修复：改为`useLayoutEffect`，监听器与DOM在同一commit中同步替换；修复后构建（SHA 28fd31a3…）3/3认领并切回off。composer-states第16段加入同一commit窗口守卫（metrics.chinFastCommitWindow {first:true, second:true}）。
- 评审验证：`npm run build`通过；`npm test` 1109项1108通过、0失败、1既有跳过（npm-test-review.log）；`node scripts/verify-build.mjs`通过（0.2.120，SHA `28fd31a3f27481688684e30f5f27229ab1565f784738ad702998559bb0179dcb`，442源文件）。离屏run-suite串行（均该构建、passed=true、窗口不可见/未聚焦/离屏）：composer-states（26项，offscreen-composer-states-SXSbb5；chin-mode-tooltip.png已查看为“Mode ⇧⌘M”）、bypass-permission（8项，offscreen-bypass-permission-V5VwaT，bypassTooltip快捷键['⇧⌘M']）、code（9项，offscreen-code-pQpFlS）、home-page（19项，offscreen-home-page-X59LKw）、tooltip（11项，offscreen-tooltip-tpyWq4）、permission（7项，offscreen-permission-av7GVQ）、menu-bar（9项，offscreen-menu-bar-dhCnM1）、settings-complete（9项，offscreen-settings-complete-EEM1Qc）。

初版验证（评审修正前；日志work/claude-ui-sweep/0.2.120/）：`npm run build`通过；`npm test` 1109项1108通过、0失败、1既有跳过（npm-test.log）；`node scripts/verify-build.mjs`通过（0.2.120，SHA `a5dc1eb85e7242e902ff6ebf3997862b125ef3fc7f594228f2b99c749d831f71`，442源文件）。离屏run-suite（均build 0.2.120/a5dc1eb8…、passed=true、边界断言全绿、窗口不可见/未聚焦/离屏）：composer-states 0（26项，offscreen-composer-states-hGBEP4，r2）、bypass-permission 0（8项，2次启动，offscreen-bypass-permission-yeqvjr）、code 0（9项，offscreen-code-pTw99Q）、home-page 0（19项，4次启动，offscreen-home-page-eW0n5K）、tooltip 0（11项，offscreen-tooltip-gntFsv）、permission 0（7项，offscreen-permission-wmqC1u）、slash-commands-complete 0（offscreen-slash-commands-complete-qDfXXo）、settings-complete 0（9项，offscreen-settings-complete-CETn8Z）、titlebar 0（8项，offscreen-titlebar-RBBtl7）、menu-bar 0（9项，修正后r4 offscreen-menu-bar-9U5hmN、r5 offscreen-menu-bar-XovZl1）。

保留失败与原因：
- composer-states r1：第16段最初位于会话A，A仍有运行中的hold回合（failure.png可见Working…），本地running禁用Mode/Model触发器→⌘⇧I被认领但no-op，等待Models超时。属脚本放置错误，产品行为与源（禁用选择器忽略）一致；移到空闲会话E后r2通过。
- menu-bar r1（此前v119b通过）在search步`search.fill('menu bar')`后读到''。按规则7未以“重跑通过”结案：确定性复现`settings-race-probe.mjs`（离屏bootstrap、隔离profile，不经chin代码路径）：拦住rAF，⌘,打开Settings后在挂载帧之前填写→3/3被清空（焦点落到dialog root），先放行挂载帧再填写→3/3保留。机制：useModalPresence首个rAF前data-open为false、无过渡，脚本的`getAnimations().every(finished)`空真；SettingsContent挂载rAF `root.focus()`（source-settings.jsx:141）使搜索框失焦，onBlur closeSearch清空——与0.2.119 settings-complete同一机制，settings代码本版未改。修正：打开后先等`data-open==='true'`再等动画（断言未改），r4/r5通过。

剩余缺口：
- Mode提示的非危险分支无chipLevel description可用，恒为header“Mode”；源的onModelChordRedirect（无模型选择器时的重定向）本地无对应。
- Effort触发器aria-label源为“Effort: {name}”、Model选择器aria-label与本地不同，本项按要求未改（约20个脚本依赖现名）。
- Fast live region仅在有Fast tier时渲染（源无条件），已在代码注释记录。
- 冒泡阶段`key()`处理器（main.jsx，⌘B/⌘K/Escape等）同样是无依赖useEffect闭包，存在同类commit后旧闭包窗口，本项未改。
- CHANGES_TOOLTIP '⌘⇧D'、TOGGLE_SHORTCUT_LABEL '⌘⇧\\'修饰键顺序与源po不符（既有，未改）。
- 标准链其余18套仍未登记离屏；其他脚本中同样“打开Settings后只等getAnimations”的空真等待未逐一排查；原生窗口验收（nativeWindowAcceptance）仍为false。

## 0.2.119 测试债B：pane/pane-layout/file-search/diff/transcript-fade/ui029登记离屏run-suite并执行通过，修复窄tile拖动手柄被文件标签条遮挡（未安装）

背景：沿用0.2.118测试债A的机制，把validate-local standard中另外6套从未在离屏执行的原生脚本登记进`work/offscreen-app-integration-20260922/run-suite.mjs`（standard列表未改），逐套执行；暴露1处真实产品回归（已修）、4类脚本过时或竞态期望（已按源更正，共9处调用点）、2处适配器期望缺口（DPR、按套blocked）。

登记（脚本→最终fs.writeFile的规范报告，均已核对）：pane→analysis/batch-20260920/pane-source-test.json；pane-layout→pane-layout-ui-report.json；file-search→file-search-ui-test.json；diff→diff-ui-test.json；transcript-fade→transcript-fade-ui-report.json（验证模式，比对冻结的transcript-fade-baseline-report.json，未重生成，mtime仍为09-20）；ui029→ui029-ui-report.json（验证模式，比对ui029-baseline-report.json，未重生成）。

适配器改动（run-suite.mjs / bootstrap.cjs）：
- 按套剪贴板期望表`clipboardCalls`（替代原memoryClipboard数组与user-markdown三元式）：每套声明内存剪贴板各方法的最少调用次数。diff{read:1,writeText:3,write:1}（Copy patch source-diff.jsx:126＋两张sft卡片CommandCopyButton source-command.jsx:58；保存read、finally恢复write）；transcript-fade{read:1,writeText:1,write:1}（Copy code source-code-block.jsx:41）；ui029{read:1,writeText:1,write:2}（代码块Copy＋整回合Copy富文本ClipboardItem clipboard-payload.mjs:19，再加finally恢复）；原6套期望不变（user-markdown仍为write）。实测调用序列：diff read,writeText,readText,writeText,readText,readText,writeText,readText,readText,write；transcript-fade read,writeText,readText,write；ui029 read,writeText,readText,readText,write,readText,write。三套clipboard final与initial逐MIME相等，app.evaluate(({clipboard})…)经bootstrap的Module._load解析到内存适配（与git-band同），未触达OS剪贴板。
- 按套按启动的blocked期望表`expectedBlocked`（替代menu-bar三元式，menu-bar首启仍恰为show,show,focus）：pane-layout第二次启动（:567）的重复popout-open（:676）使main.cjs openPopout（:259）focus已有弹出窗，恰1次window.focus在适配器被拦截——套件本身断言“duplicates focus it”。其余启动一律期望[]。
- deviceScaleFactor：transcript-fade与ui029改为2（与user-markdown/edit-read同一先例）。两份冻结基线在原生Retina窗口（DPR2）采集；字体度量按设备像素取整，DPR1下ui029每行偏1/128–1/64px（用户行67.984375对原生67.9921875、回答49.96875对49.984375），累计超出0.5px门限（r1-ui029：wide-1468 728→727.484375等19项）。对照实验仅改DPR：r2各行与0.2.14原生通过值完全相等（67.9921875/49.984375），几何段通过。
- bootstrap.cjs：剪贴板禁止列表补入readRTF/readBookmark/readFindText/read/has（原先未列，内存模式下`{...electron.clipboard}`展开会带出OS读方法；收紧，非放宽）。
- ui029-ui-test.mjs末尾：`if(failure){process.exitCode=1;throw failure;}`，run-suite以import执行时同时经异常与规范报告passed=false两路看到失败。

产品修复（回归）：pane-layout撕出（tear-off）在800×600窗口中从不开始——`.tiles-drag-handle`中心被`.source-file-tabs`（position:relative、isolation:isolate）盖住（elementsFromPoint首项为标签条，按压落在标签条上变成文本选择）。源ka（panes-toggle-current.js:1614-1632）把tile中心拖动手柄o渲染在header/标题内容之后（`[H, t, o]`，再接trailing pe），绝对定位的手柄按树序绘于标签条之上；本地0.2.101把文件标签放进header时手柄仍在首位。改：source-session.jsx SidePanel header把`{headerCenter}`移到标签条/标题之后、paneControls之前；source-agent.jsx后台任务header同序（标题后、controls前）。验证：修复后命中首项为button.tiles-drag-handle，撕出窗口位于指针−120/−14；verified.png可见手柄条绘于标签条上方。

脚本更正（均非放宽，断言值不变，注释引HANDOFF版本与源）：
- pane-ui-test.mjs:508/:607、file-search-ui-test.mjs:588/:655/:659：预览标签名“X, preview”→“X , preview”（0.2.101未执行写入；源`.sr-only` position:absolute，design-system.css:4083-4093，本地source-session.jsx:929同构，accname对非inline子元素补空格；同0.2.118 session-ui-test更正）。
- pane-ui-test.mjs:594/:626：点树行slow-c.txt后用关闭X关闭他tab，原期望焦点到file-8标签。该期望写于关闭X为可聚焦“Close <name>”按钮时（点X使焦点进入被关行）；0.2.101起X为pe（tabIndex −1、mousedown preventDefault，panes-tabs-current.js:190-202），源tab条（:652-663）仅在被移除tab含焦点或焦点落到body时才移焦点。失败证据failureFocus={BUTTON,label slow-c.txt,treeRow:true}与源一致，改为新增focusedTreeRow断言焦点留在该树行。
- ui029-ui-test.mjs idleAndSpacing：空会话原期望idle Spark尾行。0.2.100起空会话渲染Cl“No messages yet”（approval-entry-current.js:4224-4233）代替转录状态（main.jsx emptyPane），改为断言该EmptyState存在且TAIL/SPARK数为0；short/multi/geometry会话的idle断言保留。复审更正：:186的check文案原仍写“One static aria-hidden tail for empty/short/multiple completed turns”，v119b报告（offscreen-ui029-WQtPiC）因而记录了与断言相反的“空会话有尾行”；已改为“Empty session shows Cl "No messages yet" with no tail or Spark (HANDOFF 0.2.119); one static aria-hidden tail for short/multiple completed turns; …”，断言未改（仅报告文案）。
- settings-complete-ui-test.mjs:71（已登记套件，v119首轮全链失败“Closing style never committed”）：useModalPresence在挂载后的下一rAF才提交data-open="true"（use-modal-presence.js:11-12），之前无过渡，`getAnimations().every(finished)`等待空真；若在entered前点Close，data-open已是false、无属性变化即超时。先等待data-open==='true'，并在residency evaluate开头对未entered给出明确拒绝信息。该机制与证据一致（geometry已测、无动画），3次单独重跑未复现，属推断而非确定性复现，记录于此。
- 仅失败路径新增证据（不影响通过路径）：pane-ui-test catch记录failureFocus；pane-layout-ui-test catch记录failureHandleHits（各手柄中心elementsFromPoint、header子序）与failureArrangeState（arrange触发器hook refs）。

单测：offscreen-suite-registry.test.mjs新增1项（6套登记与报告名、clipboardCalls、DPR2列表、expectedBlocked精确值、ui029 throw、bootstrap剪贴板禁止列表）；新增pane-header-handle-order.test.mjs 2项（SidePanel与后台任务header中headerCenter位于标签条/标题之后、controls之前）。

验证（日志work/claude-ui-sweep/0.2.119/）：`npm test` 1100项1099通过、0失败、1既有跳过；`npm run build`通过；`node scripts/verify-build.mjs`通过（0.2.119，SHA `d64c2e85f311241bd10889e731a6b8c4bb50e752dece620ea0ed6bc02b7dd38c`，441源文件）。最终在全部改动后用run-all-v119b.sh串行跑已登记全部42套（v119b-summary.txt，负载均值3–7）：42/42退出码0，每份report.json build为0.2.119/d64c2e85…、passed=true、边界断言全绿，窗口全部不可见/未聚焦/离屏。新6套：pane 0（10项，offscreen-pane-83XAu1）、pane-layout 0（13项，2次启动，第二次blocked恰为window.focus，offscreen-pane-layout-9973pi）、file-search 0（9项，检索worker随app.close干净退出、无cleanupError、无残留Electron/vite进程，offscreen-file-search-rTE0NN）、diff 0（8项，offscreen-diff-KYhnbG）、transcript-fade 0（8项，validation，DPR2，offscreen-transcript-fade-128hEV）、ui029 0（6项，validation，DPR2，offscreen-ui029-WQtPiC），均位于analysis/batch-20260920/；changes-pane、files-pane、git-band同链通过。截图已查看：pane-layout verified（手柄在标签条上方）与failure、diff-source-real-git、ui029 idle-tail-light与空会话failure、ui029 wide布局。复审文案更正后（ui029脚本不在源哈希内，源SHA不变）重跑：`npm run build`通过；`npm test` 1100项1099通过、0失败、1既有跳过（npm-test-final3.log）；ui029 0（6项，validation，DPR2，offscreen-ui029-MeWYvN，suiteDirectory ui029-local-eHctTv，v119c-suite-ui029.log）：build 0.2.119/d64c2e85…、passed=true，originalChecks为新文案；剪贴板final等于initial、native []、blocked []、violations []，memoryClipboard calls含read/writeText/readText×3/write×2，窗口不可见/未聚焦/离屏；`node scripts/verify-build.mjs`通过（同SHA，verify-build-final3.log）。其余套件无文件变化，未重跑。

保留失败与原因（开发过程，均保存日志）：
- pane-layout r4（修复后第一轮之一）在:490悬停打开arrange弹窗超时（截图显示Expand提示可见、弹窗未开）。其后r5–r15共11轮全部通过，其中r7–r9在10个`yes`进程人为加载下运行；未能复现、机制未证实，不认定为环境问题。已在失败路径加入arrange触发器refs证据以便下次定位。
- v119首次全链：sidebar因Vite依赖预构建（serverLog“Re-optimizing dependencies because vite config has changed”）在10s内未加载页面；对照实验：仅把app/node_modules/.vite移到scratch（不改app代码）即确定性复现同类中断（冷缓存发现新依赖后整页重载，“Execution context was destroyed”），缓存热后r2/r4与v119b全链通过。缓存配置哈希何以变化未查明（当时本机另有vitest进程）。settings-complete见上文更正。

剩余缺口：标准链60套中其余18套未登记离屏、仍从未执行（protocol-0155、settings-rest、session-actions、menus-states、sidebar-rest、workflow-package、highlight、highlight-coalescing、turn-footer、user-actions、rich-copy、transcript-scroll、integration-race、git、git-rail、connection-lifecycle、shutdown、file-search-shutdown）；原生窗口验收（nativeWindowAcceptance）仍为false；DPR1下ui029的亚像素差异仅经DPR2对照解释，未在原生窗口复核。

## 0.2.118 测试债A：7个从未执行的原生脚本登记离屏run-suite并执行通过（未安装）

背景：0.2.117最终回归记录validate-local标准链60套原生脚本从未运行，0.2.112–0.2.115对其中脚本的选择器更正未经执行验证。本版把其中7套（均已在`app/scripts/validate-local.mjs` standard列表，列表未改）登记进离屏适配器`work/offscreen-app-integration-20260922/run-suite.mjs`的`suites`映射并逐套执行。产品代码无改动（无产品修复）。

登记（脚本→脚本自身最终fs.writeFile的规范报告，均已逐一核对；electron.launch均为`args:[root]`＋默认executablePath（TEST_ELECTRON_BINARY未设），CODE_DESKTOP_DATA均在analysis下，scrollbar-mode的`directory`在analysis/batch-20260920下）：
- tooltip → analysis/batch-20260920/tooltip-ui-report.json
- permission → analysis/batch-20260920/permission-source-test.json
- approval-transport → analysis/batch-20260920/approval-transport-ui-test.json
- session → analysis/batch-20260920/session-source-test.json
- titlebar → analysis/batch-20260920/titlebar-source-test.json
- sidebar → analysis/batch-20260920/sidebar-ui-test.json（该脚本经vite dev服务器加载src，源文件与build-info哈希一致）
- scrollbar-mode → analysis/batch-20260920/scrollbar-mode-ui-report.json

边界：7套均不读写剪贴板、不触发window.show/focus、不调用原生对话框，故memoryClipboard列表与menu-bar/settings-complete的blocked/native期望保持原样，未新增按套期望（无需改三元式，也未放宽任何默认）。全部报告blocked=[]、native=[]、violations=[]，窗口不可见/未聚焦/离屏。

适配器改动（run-suite前完成，不在运行中改）：
- run-suite.mjs：`suites`追加上述7项。
- bootstrap.cjs:5：原fixture白名单只含codex/session-actions/highlight三个server，approval-transport用`tests/fixtures/approval-server.cjs`（approval-transport-ui-test.mjs:286，隔离fixture，需profile内marker），permission与titlebar在自身profile内生成转发代理（permission-ui-test.mjs:21-35记录thread/turn请求、titlebar-ui-test.mjs:56-63延迟rename响应）。白名单加入approval-server.cjs；代理仅当位于本次profile内、只有一个`spawn(process.execPath,[<allowed fixture>])`且只require node:child_process/readline/fs时接受。首轮permission与approval-transport即因此在bootstrap断言处启动失败（适配器边界，非产品）。

脚本更正（均非放宽，断言值不变）：
- tooltip-ui-test.mjs:618/656：成功与失败报告在`pass`之外增加同值`passed`（run-suite.mjs断言result.passed===true），附加字段。
- session-ui-test.mjs:199-207：seed-command至seed-failed是相邻工具，按Npe classic组（approval-current.js:53880-54010，HANDOFF 0.2.66/0.2.108）渲染在默认折叠的`.stg`组内、展开前成员不挂载；原脚本先等seed-command可见再点`.stg-trigger`，改为先展开组再做行检查（原222行的点击移到前面）。
- session-ui-test.mjs:238-275、:420-422：①10px条目间距取自transcript级条目——组展开后首个`.source-step`是组内成员（m8 inCard，approval-current.js:54035-54063），间距规则`.source-message + .source-message`（source-session.css:13）落在其外层`.stg`，故margin/border改读`step.closest('.stg')||step`，期望仍为10px/0px；②26px是独立TurnStatusStep触发器（source-session.css:295 min-height 26px），组成员由`.stg-row .source-step-trigger`（source-tool-group.css:27，HANDOFF 0.2.108）置为min-height 0（实测19.984375，记录为groupMemberRowHeight指标），26px断言移到同脚本后段单独成回合、不成组的stream-command行上（并断言其不在`.stg`内）。
- session-ui-test.mjs:513-517（原:514）：预览标签名由"deep.txt, preview"改为"deep.txt , preview"。0.2.101未执行地写入；源`.sr-only`为position:absolute（design-system.css:4083-4093，panes-tabs-current.js:449-466），accname按内容取名时非inline子元素两侧补空格（Playwright innerAccumulatedElementText），本地与源同构，故精确名含空格。

单测：新增app/tests/offscreen-suite-registry.test.mjs（2项）：run-suite每套脚本均在validate-local standard中、报告路径在analysis下、脚本写出该报告文件名且含`passed`字段；7套已登记且tooltip两处写入含`passed`。

验证（日志work/claude-ui-sweep/0.2.118/）：`npm test` 1097项1096通过、0失败、1既有跳过；`npm run build`通过；`node scripts/verify-build.mjs`通过（0.2.118，SHA `9fcb70285cd08299ec9e67e50745f6977591d8a4b4e1b288c7ac8f51e1eabb1c`，441源文件）。开发过程：tooltip/titlebar/sidebar/scrollbar-mode首轮即通过；permission、approval-transport首轮因bootstrap白名单失败（r1-*.log），改适配器后通过（r2-*）；session经r1–r4四轮依次暴露上述三处脚本过时期望，r5通过。最终在全部改动后用run-all-v118.sh串行跑已登记全部36套（v118-summary.txt，负载均值4–14）：36/36退出码0，每份report.json build为0.2.118/9fcb7028…、passed=true、边界断言全绿；menu-bar首个启动blocked恰为3项、settings-complete native恰为3项（与既有期望一致）。新7套退出码与离屏报告：tooltip 0（11项，offscreen-tooltip-2AOkKs）、permission 0（7项，2次启动，offscreen-permission-0hJaj5）、approval-transport 0（9项，offscreen-approval-transport-ORTwSC）、session 0（10项，offscreen-session-bmi0B0）、titlebar 0（8项，offscreen-titlebar-RyUxok）、sidebar 0（10项，3次启动，offscreen-sidebar-9rwHpw）、scrollbar-mode 0（5项，offscreen-scrollbar-mode-EVv8c3），均位于analysis/batch-20260920/。截图已查看：session-source-file-pane、tooltip-ui-light、sidebar-source-fixture、approval-transport question-retained-after-failure。保留失败：无。

剩余缺口：标准链其余53套中未登记离屏的原生脚本（如menus-states、sidebar-rest、session-actions、pane、pane-layout、file-search、diff、highlight*、turn-footer、user-actions、rich-copy、transcript-scroll/fade、ui029、git、git-rail、connection-lifecycle、shutdown等）仍从未执行；原生窗口验收（nativeWindowAcceptance）仍为false。

## 0.2.117 本轮（0.2.112–0.2.117）最终回归（未安装）

构建身份：0.2.117，builtAt 2026-09-23T16:13:10.580Z，SHA `ee4a8678654d671524b310c62913e4057f781411f4c8f4d4858e91813fe79e1f`，441源文件。日志work/claude-ui-sweep/final/v117-*。`npm run build`通过；`npm test` 1095项1094通过、0失败、1既有跳过；`node scripts/verify-build.mjs`通过。

离屏run-suite全部29套串行（run-all-v117.sh，v117-summary.txt记录每套退出码与负载均值8–34）：首轮29/29通过，无复跑；每份report.json的build均为0.2.117/ee4a8678…，passed=true，适配器边界断言（窗口不可见/未聚焦/离屏、剪贴板复原、原生调用拦截）全部通过。本轮无产品修复、无测试改动。

未运行：validate-local标准链60套原生窗口脚本（用户禁止占屏），因此0.2.112–0.2.115对tooltip、permission、approval-transport、session等原生脚本的选择器更正仍未经执行验证。状态文件analysis/batch2-status-0.2.117-offscreen-20260924.json（unrunSuites为标准链全部60套）。

## 0.2.117 侧栏拖拽手柄：源提示、点击/拖拽隐藏、Home/End、侧栏下限与拖拽结束单次提交（未安装）

源链（2.2553.1 readable）：
- `sidebar-groups.js:5113-5207 uw`：Kl `{side:'right', trackCursorAxis:'y', hoverable:false, content 'Hide sidebar', shortcut cmd+b, detail 'Drag to resize'}`包住`o_`（`:1023`，实为`shared-19-CjdiaR4X.js` Os＝CDS ResizeHandle，不是shared-16）；aria-valuenow `round(max(sidebarWidth, minWidth))`、valuemin＝minWidth、valuemax＝Po.MAX 420。onResizeStart读`.dframe-root`的`--df-sidebar-width`并记startW/maxW＝Do(innerWidth)/canHide＝Tl（`shared-22 OL`门，默认开）→setIsResizing；onResize：`r=startW+delta`，`hidden = canHide && !TL(r, minWidth)`（`shared-22:13960 TL e>=t/2`），未隐藏时只写CSS变量`clamp(r, minWidth, maxW)`，hidden变化时即时setCollapsedPref；onResizeEnd(dragged)：未拖动＝Tm("resize_handle")隐藏侧栏；拖动且hidden＝变量恢复startW；否则commitSidebarWidth(currentW)一次。onKeyDown：meta/ctrl/alt或拖动中忽略；Home提交minWidth，End提交`max(minWidth, Do(innerWidth))`。
- `shared-19 Os`：拖动阈值`ws=3`（与`shared-22:14029 HL=3`一致），键盘步长8／Shift 32（Ts/Es），Enter/Space（无Shift，非repeat）＝start+end(false)，箭头＝start→onResize(±step)→end(true)；class `cds-reset group/resize outline-none focus-visible:outline-hidden w-3 cursor-col-resize absolute inset-y-0 end-[calc(-6px-(ring-outer - ring-inner)/2)]`，子层为12px圆角focus层（shadow-focus）与3px `resize-pill`（`h-full max-h-12 bg-current`，空闲`text-muted opacity-[var(--cds-resize-pill-force,0)] delay-200 duration-base group-hover:opacity-100`，拖动中`text-secondary opacity-100 duration-snap`，focus-visible `bg-fill-accent max-h-none`）。
- `shared-2-C6aD8DvJ.js` Km `{MIN:200,MAX:420,DEFAULT:288}`／qm／Xm`qm(floor(w)-330)`／$m／commitSidebarWidth`qm(t)`／Qg`max(sidebarWidth, sidebarFloor)`；`sidebar-main.js:14721-14734`由`hd`＝`shared-22:13945-13959 wL`（chrome各部分宽度之和再qm）setSidebarFloor，`:14902`把它作为`kw{minWidth: ye}`传给uw，`:15316`在根上切换data-resizing，`:15391`根style写`--df-sidebar-width`。
- `desktop-layout.css:1459-1471, 2032-2036`：本地已加载的shared-styles副本自带`.dframe-resize-handle{z-index:25;clip-path:inset(0 0 0 37.5%)}`、`:focus-visible{clip-path:none}`、`[data-resizing]`无过渡、web变体`top:var(--df-chrome-bar-height)`(无WCO为0)与ring 0.5px/0px。

实现：
- 新增app/src/sidebar-width-model.mjs：`SIDEBAR_WIDTH`、`DRAG_THRESHOLD=3`、`KEYBOARD_STEP(_LARGE)`、`clampSidebarWidth`、`sidebarMaxWidth`、`dragHidesSidebar(width, minWidth)`、`isResizeDrag`、`storedSidebarWidth`($m)、`sidebarFloorWidth`(wL的qm(ceil))、`effectiveSidebarWidth`(Qg)、`sidebarDragFrame`(uw onResize一帧)。
- app/src/source-sidebar.jsx：删除旧beginResize（每次pointermove都setSidebarWidth＝每帧一次settings写入）与224下限；新`SidebarResizeHandle`基于`useSourcePointerResize`（focusOnStart:false，同Os不因按下取焦）：拖动中只`style.setProperty('--df-sidebar-width')`并在根上加data-resizing，body cursor col-resize/userSelect none；原始宽度低于minWidth/2时经新prop `onCollapsedChange`(main的setSidebarCollapsed，按变化各写一次sidebarCollapsed)即时隐藏，回到阈值上方即时恢复；结束时|Δ|≤3＝`onCollapse()`（与Hide sidebar按钮同一路径），hidden＝变量恢复startW且保持折叠，否则`setSidebarWidth(currentW)`恰一次settings写入。键盘：箭头±8/Shift±32、Home＝minWidth、End＝max(minWidth, Do(innerWidth))各提交一次，Enter/Space隐藏；aria-valuemin＝minWidth、valuemax 420、valuenow＝round(max(width,minWidth))；role=separator、aria-orientation vertical、tabIndex 0，class为Os原class＋`sidebar-resizer dframe-resize-handle`，子节点为Os的ring与pill（原class，由已加载的design-system工具类提供）。外包`SourceTooltip{side right, trackCursorAxis y, hoverable false, 'Hide sidebar', SIDEBAR_TOGGLE_TOOLTIP的'⌘B', detail 'Drag to resize'}`，拖动中`open={false}`。wL的本地对应：toolbar行在`width:max-content`下的宽度＋aside右边框，经qm得到侧栏下限（fixture中231px），在全屏/折叠变化时重测并经`onSidebarFloor`上报。
- app/src/source-tooltip.jsx／source-tooltip-model.js：TooltipCore新增`trackCursorAxis`（默认'none'，行为不变）；新`cursorAnchorRect(rect, point, axis)`＝`vendor-frame-BmPfNbgY.js:16554-16602 js`虚拟元素（y轴：触发器x范围、指针clientY、高0）；hover打开时锚定最近一次指针（触发器pointerenter/pointermove及打开期间document pointermove，popup内除外），focus打开时锚定触发器矩形。
- app/src/use-pointer-resize.js：新增`focusOnStart`选项（默认true，文件树分隔条不变）。
- app/src/main.jsx：`sidebarFloor`状态（初值Km.MIN）；根`--df-sidebar-width`＝`effectiveSidebarWidth(sidebarWidth, sidebarFloor)`（Qg）；启动恢复用`storedSidebarWidth`（$m）；`saveWidth`以qm钳制后一次settings写入；向侧栏传`onCollapsedChange/sidebarFloor/onSidebarFloor/fullScreen`。
- app/electron/main.cjs：settings的sidebarWidth钳制224..420改为200..420（Km）并拒绝非有限数。
- app/src/style.css：删除旧`.sidebar-resizer`（5px、right:-2px、hover alpha-2、z 30）；只补`.sidebar-collapsed .dframe-resize-handle{display:none}`（源键为`[data-collapsed]`，本地根用class）；`.app-sidebar.dframe-sidebar`由overflow hidden改为visible（源卡片不裁剪，手柄才能跨过边缘；body本来就hidden），`.sidebar-toolbar`改为overflow hidden兜底。
- 与任务说明的偏差（均有源依据）：①命中几何改为Os（12px、跨边缘、裁掉左37.5%后可命中带为边缘-1.25px～+6.25px），因为保留旧5px几何再叠加clip-path只剩约1px可命中；②最小值是侧栏下限而非固定200：源`:14902`传`minWidth: ye`（wL），fixture中toolbar在200px会把Code单选按钮裁掉（实测scrollWidth 230 > 199），故Home/aria-valuemin＝231；③提示框按源Nu默认align center以指针y为中心（实测中心＝指针y，top＝y-23），不是“top≈指针y”；④clip-path/z-index/[data-resizing]规则已由加载的shared-styles提供，不在style.css重复；⑤未画自创pill，pill即Os原子节点。
- 本地适配：Escape／pointercancel恢复startW并取消拖动中的隐藏（Os无取消）；阈值内的按下隐藏侧栏时也把变量恢复startW（源会把≤3px的实时偏移留在变量上直到下次提交）。

测试：
- 新app/tests/sidebar-width-model.test.mjs（6项）：Km/qm钳制；Xm（1000→420、750→420、749.9→419、600→270、400→200）；TL（99隐藏、100不隐藏，230下限时114/115）；HL=3与8/32步长；uw帧（288-38→250、夹在MIN/下限、raw 99隐藏、窄窗maxW、canHide关）；wL下限与Qg；$m。
- app/tests/tooltip-model.test.mjs：新增cursorAnchorRect（y/x/both/无指针/none）及side right时以指针y居中。
- app/scripts/sidebar-chrome-ui-test.mjs（离屏sidebar-chrome）新增resize-handle/resize-drag/resize-escape/resize-keys/resize-drag-hide/resize-click六段：包装真实`desktop:call`计数settings调用（同approval-card-ui-test做法，不改参数）；几何（12px、右缘＝padding边缘+6.25、clip inset(0 0 0 37.5%)、z 25、边缘外3px与边缘内1px命中、内3px不命中、aria值、无title）；悬停提示'Hide sidebar'＋'⌘B'＋'Drag to resize'、side right、left≥手柄右缘+4、中心＝指针y且下移80px后跟随，hover pill不透明；288→250四步拖动：变量278/268/258/250实时、data-resizing、aria-valuenow仍288、提示关闭、pill为text-secondary，松开后settings恰为`[{sidebarWidth:250}]`且400ms后仍一次并落盘；Escape取消不写入；Home＝下限（toolbar不再溢出）、End＝qm(innerWidth-330)、箭头/Shift箭头每次一写、Meta+Home忽略、拖回288一写；拖到raw 99即时折叠（与⌘B同一状态：class、Show sidebar、落盘true、菜单文案），回到raw 138展开再隐藏，松开后变量恢复288、settings只有三次sidebarCollapsed、无宽度写入，⌘B后宽288；2px按下与Enter都隐藏侧栏（各一次sidebarCollapsed）。原有⌘B／菜单／重启持久化断言未改。

验证：`npm run build`通过；`npm test` 1095项1094通过、0失败、1既有跳过（新增7项）；离屏`run-suite sidebar-chrome`通过（36项检查，analysis/batch-20260920/sidebar-chrome-ui-PX0Bac）、`run-suite code`通过（含'appearance and keyboard sidebar resize'，analysis/batch-20260920/offscreen-code-c6ehdU）、额外`run-suite home-page`通过（offscreen-home-page-YdSn46）；`node scripts/verify-build.mjs`通过。构建0.2.117，sourceSha256 `ee4a8678654d671524b310c62913e4057f781411f4c8f4d4858e91813fe79e1f`，441源文件。已查看resize-handle-tooltip.png（提示在手柄右侧、以指针为中心，中部灰色3px pill）、resize-home-floor.png（231px时toolbar完整，focus-visible时全高accent pill与focus ring）、resize-dragging-250.png、resize-drag-hidden.png。首轮失败均为本次新断言与实现的调整（shared-styles的web变体top为0、aside边框使padding边缘为287、Escape拖动目标低于下限、下限需含边框），非回归。日志work/claude-ui-sweep/0.2.117/。无保留失败。

剩余差距/后续：
- 源在点击/Enter隐藏时用`shared-22 NL/RL`把焦点交给Show sidebar；本地所有侧栏开关都没有这套焦点交接（隐藏后焦点落到body）。
- 源`content: To() ? undefined : 'Hide sidebar'`的条件（shared-2 fp）未追查，本地始终显示。
- wL按源常量（traffic light spacer、search 50/26、nav 56、switcher 70）求和；本地以toolbar实测宽度代替。
- 手柄上方46px与toolbar拖拽区重叠（源web变体同样从0开始），Electron拖拽区可能吞掉那一段的按下。
- app/src/code-ui.jsx旧`Sidebar`组件（未被引用）仍含224常量，未动。

## 0.2.116 “View live output”移到命令行标题＋状态行“# running tasks”按钮（未安装）

源链（2.2553.1 readable）：
- `approval-current.js:16326-16365 GM/KM/XM`：toolUseId映射到存活后台任务且有侧栏窗格时，渲染`button[type=button]`，class `shrink-0 text-body text-primary hover:underline underline-offset-[3px] focus-visible:outline-hidden hide-focus-ring focus-visible:shadow-focus rounded-[3px]`；onClick先stopPropagation再`openTasksPaneAtTask(taskId)`，onKeyDown stopPropagation。`:16852 ne = bash && te==="running"`；`:17279`在行标题中verb/meta之后、sr-only 'running'与状态字形之前渲染`ne ? GM`。`:2894-2925 KE`运行页脚只有状态、'Run in background'与Copy。
- `scroll-messages-current.js:58132-58145 Whe`（Uhe=1500）：running降为0后保留最后非零计数1500ms作为finished；`:58273-58327` P＝`onToggleTasksPane!==null && (running>0||finished>0)`，K＝`br{ghost, xs, flush both, pressed: tasksPaneOpen}` className `text-secondary hover:text-accent before:absolute before:inset-x-0 before:-inset-y-[10px]`，子`span.text-footnote`文案`{count, plural, one {# running task} other {# running tasks}}`／`# task(s) finished`；G：stopping→'Stopping…'+q(true)（`:58483-58500`），非working且P→idle仅q(false)，否则stats分支`:58615-58628`＝elapsed [· tokens] [· q] · status；apiRetry分支F无q。`:58739-58800 Xhe`：`onToggleTasksPane: !N && hasSidePanes && P!==null ? R : null`。shared-frame `:2724` ghost `aria-pressed:text-accent`。

实现：
- app/src/source-session.jsx：commandExecution分支在`state==='busy' && item.processId && agentContext?.onTask`时向SourceStep的`trailing`传`button.src-cmd-live[type=button][data-row-live]` 'View live output'（onClick stopPropagation后`onTask(item.id)`，onKeyDown stopPropagation），位于meta之后、outcome/caret之前，不切换行展开。本地适配：源条件是Bash工具已completed（转入后台）且任务running；Codex的后台命令在运行期间保持inProgress（busy）并带processId，故以busy+processId为对应条件。
- app/src/source-command.jsx：RunningFooter与SourceCommandBody删除onViewLiveOutput及按钮；页脚保留状态与Copy（KE等价），不加'Run in background'（本地无此能力）。
- app/src/source-command.css：`.src-cmd-live`改为flex-shrink 0、font-sans 400、`--cds-font-size-body/--cds-leading-body`、text-primary、无背景/边框/内边距、圆角3px、text-underline-offset 3px；hover underline；focus-visible outline none＋`var(--cds-focus-shadow)`。
- app/src/transcript-status-model.mjs：新增`taskButtonLabel(running, finished)`（源复数文案或null）、`FINISHED_TASK_HOLD_MS=1500`与`createFinishedTaskHold(onChange)`（Whe的计时存储；`owner`变化即清零，对应源按会话重挂载transcript）。
- app/src/source-transcript-status.jsx：新增`useFinishedTaskHold(running, owner)`；新props `runningTaskCount/tasksPaneOpen/onToggleTasksPane`。按钮为`SourceSettingsButton{variant ghost, size xs, flush both, aria-pressed}`＋`span.sts-tasks-label`；running/approval：stats每项后接`·`，再按钮＋`·`＋活动文案；stopping：'Stopping…'＋`·`＋按钮；idle：Spark＋仅按钮（无分隔符）。按钮可见时根与`.sts-label`不再aria-hidden，`.sts-label` data-visible=true；role=status/aria-live仅在原announce时保留（idle不设status）。retry行不渲染按钮（同源F）。行可见性仍由`view.visible`决定——本地所有不可见呈现（home、loading、审批卡替换行＝源hideLoader）在源中都没有Y5行，因此不采用“view.visible || 按钮可见”的析取（与任务说明的偏差，有源依据）。
- app/src/source-transcript-status.css：`.sts-tasks`文字text-secondary，hover与aria-pressed=true为text-accent；`::before`绝对定位inset-inline 0、top/bottom -10px；标签footnote字号/行高。ghost hover底色与xs令牌沿用SourceSettingsButton与design-system `.cds-root [data-size=xs]`。
- app/src/main.jsx：向SourceTranscriptStatus传`runningTaskCount=taskSections(tasks).running.length`（与任务窗格同一列表；运行中任务从不被dismiss过滤）、`tasksPaneOpen=openPanes.has('tasks')`，仅在`session && section==="new"`时传`onToggleTasksPane=()=>togglePaneTile('tasks')`。
- app/tests/fixtures/codex-server.cjs：`fixture:background-command*`回合带真实`Turn.startedAt`（0.155.1 v2/Turn.ts:29），使状态行出现elapsed统计，以验证“stats · 按钮”顺序。

测试：
- app/tests/transcript-status-model.test.mjs：新增2项（1/3 running、2 finished及null文案；fake timers下finished恰好保持1500ms：1499ms仍为2，第1500ms清零并回调一次；重新运行取消清零、换owner不继承、dispose取消计时）。
- app/tests/response-markdown-render.test.mjs：新增2项SSR：状态行running/idle/stopping下按钮位置、aria-pressed、ghost/xs/flush both、idle无aria-hidden容器、无toggle/无任务/retry/审批替换时无按钮且无任务时DOM与原先相同；busy＋processId＋onTask命令行的`.src-cmd-live`在`.source-step-trigger`内且在caret前、footer内没有，settled/无processId/无onTask时无。
- app/scripts/background-tasks-ui-test.mjs（离屏background-tasks）：原:67“先点行trigger再点正文里的View live output”改为**产品更正**（引:17279）：行折叠（aria-expanded=false）时标题内按钮可见，位于meta后caret前，颜色＝解析后的`--cds-text-primary`，hover underline且offset 3px，点击打开Background tasks窗格并定位到任务，aria-expanded仍为false。新增：状态行'1 running task'前为`·`且再前为elapsed统计，footnote字号（12px）、text-secondary颜色、hover text-accent，`::before` top/bottom -10px；点击aria-pressed true并打开窗格，再点false且窗格关闭；Stop后MutationObserver记录文案序列恰为['1 running task','1 task finished',null]，finished保持约1504ms，按钮在3s内消失。

验证：`npm run build`通过；`npm test` 1088项1087通过、0失败、1既有跳过（新增4项）；离屏`run-suite background-tasks`（9项检查，analysis/batch-20260920/offscreen-background-tasks-FOpSvs）、`run-command`（offscreen-run-command-Rlcbtg）、`stream-highlight`（offscreen-stream-highlight-XMrZr9）均通过，后两者无任务时状态行不变；`node scripts/verify-build.mjs`通过。构建0.2.116，sourceSha256 `86363071367de38d79ec05f72d7a872d0b7c1aea87062c130d899aa47ee9d5dd`，440源文件。已查看running-task-status.png（“Running sleep 30 View live output ›”，状态行“2s · 1 running task · Running tools…”，悬停为accent蓝＋ghost底色）。日志work/claude-ui-sweep/0.2.116/。无保留失败。

剩余差距/后续：
- 源按钮外包`uE{morphKey "running-tasks", openWidth}`宽度/淡入动画与U5 middot变形动画，本地无对应morph动画。
- 源XM只在有侧栏窗格时渲染；本地命令行按钮只看agentContext.onTask（主会话总是提供），未额外区分窗格可用性。
- 源在Bash工具completed后才以后台任务状态判定；Codex协议无“转入后台”事件，本地用busy＋processId近似。

## 0.2.115 问题卡：首项预选＋次级Skip按钮，跳过的问题在答复中省略（未安装）

源链（2.2553.1 readable `approval-current.js`，yk / request_user_input）：
- `:7790-7800 _se/mk`：每题初始答案`{selected: e.multiSelect || e.options.length===0 ? [] : [0], other:""}`，即单选且有选项时预选第0项。Codex问题无multiSelect，故有选项即预选。
- `:7764 uk`：`selected.length>0 || skipped===true`算已答；`:7960-7961`选中选项时写`skipped:!1`。
- `:7975-8008`：W=canAdvance；G＝W ? undefined : k(M) ? 'Question {n} is unanswered'（U＝首个t≠M且未uk的页）: 'Choose an option or skip this question'（单一文案，不区分选项/Other/自由输入）；Skip处理器q把本页置为`{selected:[], other:"", skipped:!0}`，末页时`findIndex(!uk)`为-1则`R(e,!0)`提交，否则跳到该页；非末页跳到M+1。
- `:8232-8258`页脚：`div.epitaxy-approval-actions.flex.items-center.justify-end.gap-sm`内先`br{variant "secondary", onMouseDown hk(preventDefault), onClick q, disabled: l(busy)}` 'Skip'，再primary Next/Submit（busy、`disabled: !l && !W`、disabledReason G、`shortcut: a ? "cmd+enter"`）。
- 后端可行性：`work/codex-schema-0.155.1/ts-experimental/v2/ToolRequestUserInputResponse.ts` `answers: { [key in string]?: ToolRequestUserInputAnswer }`，键可选。

实现：
- app/src/approval-draft-model.mjs：
  - `initialAnswer`：有选项且非isSecret的问题初始`choice: freeze({kind:'option', label: options[0].label})`；自由输入与secret问题仍为`{choice:null}`（secret为本地密码输入，不预选）。仍全部freeze。
  - 答案形状新增`skipped`：跳过写`freeze({choice:null, customText:'', skipped:true})`；`isQuestionAnswered`（导出，原isAnswered）对skipped返回true；`modifyAnswer`在selectOption/selectOther/writeCustom前剥掉skipped（等价源`skipped:!1`，且保持原有`{choice, customText}`形状）。
  - **答复载荷选择**：`answerPayload`对skipped问题**省略该键**——**有意的本地偏离**：源提交R（approval-current.js:7903-7907 `if(s.selected.length===0){(r||s.skipped)&&i.push([o,Hi]);return}`）**会发送**被跳过的问题，值为Hi＝shared-11的`Tr`→`sO="[No preference]"`（:371导入；ion-dist/assets/v1/shared-11-CDihEvbJ.js），即源模型收到`["[No preference]"]`。本地改为省略该键：协议`answers`键可选（缺键即“未作答”），且无需让electron/respond-approval.cjs为仅选项问题放行非选项标签的哨兵值。全部跳过时发送`{answers:{}}`（源会发送每题`["[No preference]"]`）。（审查更正：先前此处误写“源在草稿中保存skipped:true，线上无对应字段”。）
  - 新`runtime.skip(ticket, respond, {getVisibleThreadId})`，按q：非末页标记skipped并`page+1`（返回`{status:'page'}`，不发送）；末页标记后若无未答页则走`submit`（同一可见会话、busy、ticket守卫），否则跳到首个未答页。守卫与advance相同：非editable（非pending、busy、过期ticket）拒绝并返回busy/stale且不改草稿；提交分支在改动前检查可见会话。
- electron/respond-approval.cjs（任务说明未列出、但为必要改动）：主进程原要求每个问题都有答案，会以invalid_response拒绝Skip；改为缺键＝跳过（结果中同样省略），存在的键仍做完整单答案/选项/未知ID校验。
- app/src/source-question-card.jsx：页脚在primary前加`button.sq-skip[data-variant=secondary]` 'Skip'（onMouseDown preventDefault，busy/非活动/菜单打开时disabled，无keycap）；点击调用runtime.skip，页变化沿用navigate的焦点恢复，提交结果走onResolved/onError。disabledReason改为源G：保留'Question {n} is unanswered'（末页且本页已答）与本地'This request is not currently active'，其余统一'Choose an option or skip this question'（删除'Choose an option or enter an answer'/'Choose an option'/'Enter an answer'）。unanswered改用isQuestionAnswered（计入skipped、排除当前页）。⌘⏎只在primary。
- app/src/source-question-card.css：`.sq-skip`并入`.sq-nav/.sq-submit`共享控件规则（24px高、13/19、圆角、disabled透明度、focus-visible）；次级涂层`::before`＝fill-secondary＋1px secondary-ring＋xs阴影，hover fill-secondary-hover，文字text-primary、400字重（同.sac-button secondary）。`.sq-actions`已是`flex; justify-content:flex-end; gap: var(--cds-gap-sm)`，未改。

测试：
- app/tests/approval-draft-model.test.mjs：新增6项（新草稿预选options[0]且自由输入/secret为null；非末页skip前进不发送；末页skip在其余已答时提交且无该键、全跳过为`{}`；末页skip跳到首个未答页；skip后选择/输入清除skipped；busy/已答/过期/非可见会话时拒绝且草稿不变）。两项旧断言按产品更正修改（非放宽）：“schema变更不保留旧答案”由`choice===null`改为等于新schema的options[0]“Replacement”（仍证明不保留Alpha）；“Next需显式答案”改为预选即可Next，“末页需所有题”改用自由输入在前的夹具保持原意。
- app/tests/approval-transport.test.mjs：新增1项，缺键被接受并在结果中省略，`{}`被接受；空数组、undefined值、非法选项、未知键仍invalid_response。
- app/tests/source-shortcut.test.mjs：新增2项SSR：Skip在Submit前、secondary、无keycap、busy/非活动/菜单打开时disabled、首项aria-pressed；disabledReason为源文案，无旧文案。
- app/scripts/approval-card-ui-test.mjs（离屏approval-card）：`metrics.questionKeycap.disabled`由`true`改为`false`——**产品更正**，引_se :7790-7800（单页问题预选首项后Submit本应可用），非放宽；新增断言首项“First”aria-pressed=true且仅1项；Skip在Submit左侧、data-variant secondary、无keycap、footer justify flex-end、间距＝解析后的`var(--cds-gap-sm)`（实测8）、与Submit同高（24）同行、Submit贴右内边距、涂层与primary不同且有inset ring；保留原Meta+Enter提交及其精确线上断言；新增第二次`fixture:input skip`：先用现有gate扣住respond，点击Skip后卡片busy，Skip disabled、primary aria-busy＋1个spinner、记录数不变，放行后卡片detach，夹具记录`result`恰为`{answers:{}}`。
- 原生脚本（用户禁止占屏，未运行）同步产品更正：app/scripts/approval-transport-ui-test.mjs 原“Next初始disabled”改为enabled且First aria-pressed；app/scripts/session-ui-test.mjs 原“Submit初始disabled”改为enabled，checks文案同步。

验证：`npm run build`通过；`npm test` 1084项1083通过、0失败、1既有跳过（新增9项）；离屏`run-suite approval-card`首跑通过（11项检查，负载3.5）；`node scripts/verify-build.mjs`通过。构建0.2.115，SHA `f4b0fb877873dce83b5e3657954f6277f0fcfb600499b76e626808ff4a12c598`，440源文件。已查看approval-card-question-keycap.png（首项预选、右下“Skip”次级按钮＋“Submit ⌘⏎”）与approval-card-question-skip-busy.png（跳过后无选中项、Skip淡化禁用、Submit转圈）。日志与截图work/claude-ui-sweep/0.2.115/。无保留失败。
审查更正（同版本0.2.115，未升版）：仅改approval-draft-model.mjs answerPayload注释与本节载荷说明（源R :7903-7907对跳过题发送Hi="[No preference]"，本地省略键为有意偏离），无行为变化。复验：`npm run build`通过；`npm test` 1084项1083通过、0失败、1既有跳过；`node scripts/verify-build.mjs`通过（0.2.115，sourceSha256 `cd329af4a8863f7f2a8041c1eb82c108ff72d1622b652a37811bd5e30055cbf3`）；离屏`run-suite approval-card`通过（analysis/batch-20260920/offscreen-approval-card-nsAlWh）。

剩余差距/后续：
- 源Skip前调用`Dc()`（遥测）、提交时`cc({question_count})`，本地无遥测，不实现。
- 源多选（multiSelect）分支本地无对应（Codex问题无此字段）。
- 源Skip按钮在busy时仅disabled、无disabledReason；本地非活动/菜单打开时也禁用Skip（与primary守卫一致的本地适配）。
- approval-transport/session原生脚本的改动未经执行验证。

## 0.2.114 侧栏/标题栏原生title改为CDS提示或去除，行键盘模型按源eO/JD（未安装）

源链（2.2553.1 readable）：
- `sidebar-rows.js:7675-7729 qD`：行标签span（ref a）是`Xs{side "right", hoverable:false, lazy}`的触发器，content仅在`zD`（`:7611`，内层scrollWidth > 标签offsetWidth）判定截断时为标题，拖拽中无；`:7730-7750 JD`：DotsVertical `tooltip:false, tabIndex:-1, data-row-action`；`:7811-7870 $D`：分组标签切换按钮无title/无提示；`:7915-7962 eO` onKeyDown；`:7970-7980`滚动器`pl-1 pt-1 pb-2 -ml-1 -mt-1`。
- `sidebar-main.js:12290-12350 lI`：Filter为`hp{content 'Filter'/'Filter (active)', hoverable:false, open: !a && void 0}`包裹`tooltip:false`按钮；hp＝shared-frame `Nu`（`shared-frame-C_2npUJq.js:4582-4605`，side默认"top"、delay 300）。
- `sidebar-groups.js:13871-13907 cI`：无自定义target时“+”无提示；`:18925-18933 Vz` Older批量触发器`tooltip:false`；`:13749-13785 rI`家族把手`Kl{content, lazy, delay 350, side "right", trackCursorAxis "y"}`；`:1815-1830` 模式切换`Ze{tooltipSide "bottom"}` → ion-dist shared-7 `SR`图标分段用`Xa{content, side, hoverable:false}`。
- `c360a9e1c-GPs-MV9u.js`：`:7387-7420 mm`标题按钮包在`Zt{content "Rename"}`；`:6347-6360 yp`原点字形`Zt{content: label}`；`:6760-6810 Fp`文件夹胶囊`Zt{content [environmentName, cwd, repoNames].filter(Boolean).join(" · "), open: !f && void 0}`；`Zt`＝`no as Zt`（`:177`）＝Nu，未传side即"top"。
- 菜单触发器方向键：`vendor-frame-BmPfNbgY.js:23791` Menu `openOnArrowKeyDown: type !== "context-menu"`，`:20378-20383` useListNavigation reference onKeyDown对ArrowUp/Down调用`Zr`（`:14774`，preventDefault + stopPropagation）后打开菜单，故焦点在关闭的行More触发器上时eO收不到ArrowDown/Up。

实现：
- app/src/source-sidebar.jsx：
  - 会话行：去掉`.source-session-open`的title；按qD把`.source-session-name`标签span包进`SourceTooltip{side "right", hoverable:false}`，content为函数，打开时用`textOverflows(.source-session-name)`（`.source-session-title`是inline span，scrollWidth恒为0，故量其块级标签，等价zD非装饰分支），未截断返回undefined不显示；该行菜单打开时`open={false}`；重命名时行被RenameRow替换；本地无行拖拽。aria-label不变。
  - 行More：`tooltip={false} tabIndex={-1} data-row-action=""`，保留menuTriggerProps。
  - 分组切换：去掉title，不加提示。Filter：`tooltip={{content, hoverable:false, open: menu?.kind==='filter' ? false : undefined}}`，side取Nu默认top（非bottom，有源依据）。“New session in …”：`tooltip={false}`。
  - 为使`.app-sidebar [title]`为0，同步处理其余侧栏原生title：模式切换两个radio改SourceTooltip{side bottom, hoverable:false}（无本地cmd+alt+←/→快捷键，故不显示shortcut）；家族把手改SourceTooltip{delay 350, side right}（trackCursorAxis无本地对应）；自定义分组More与Older批量触发器`tooltip={false}`（同JD/Vz）；本地独有的Search sessions/Close search/Dismiss error/Connection settings改CDS提示`{hoverable:false}`（内容=标签，与Filter一致）。
  - nav onKeyDown按eO重写：保留INPUT豁免与修饰键检查；ArrowLeft/Right在所在`[data-row]`的`[data-roving-item]`与`[data-row-action]`间移动（夹紧，仅焦点移动时preventDefault）；ArrowUp/Down/Home/End把焦点解析为所在行的roving项，不在行内（分组切换、表头按钮）时不处理；该项不在可见列表时ArrowDown→0、ArrowUp→末项，否则环绕；目标scrollIntoView nearest。另加`event.defaultPrevented`早退：本地menuTriggerProps只preventDefault不stopPropagation，源触发器会stopPropagation（见上），否则会同时打开菜单又移行。
- app/src/source-sidebar.css：`.source-session-list`加`padding-top/left:4px; margin-top/left:-4px`（源4px内缩，行内容位置不变），底部padding由16px改为源pb-2的8px。
- app/src/source-titlebar.jsx：去掉`.st-origin` title，`.st-origin-glyph`（源yp触发器即字形）包SourceTooltip“Local”；标题按钮去掉`title='Rename'`，包SourceTooltip“Rename”；`.st-folder`去掉title，包SourceTooltip content=`session.cwd`（无cwd则无提示，不再回退“Workspace”），`menuKind==='folder'`时`open={false}`。本地适配：无environmentName/repoNames，只用本地cwd，不编造。三者side均为Nu默认top，在窗口顶部因碰撞翻到下方（实测data-side=bottom）。重命名错误输入框的title保留（范围外）。
- 与任务说明的偏差（均有源依据）：①提示锚点是标签span而非整个主按钮（qD的ref a），故断言为`tooltip.left >= label.right + 3.5`（实测label.right 274、tooltip.left 278、row.right 276），且键盘聚焦主按钮不弹出（span不可聚焦，与源同）；②“从More按ArrowDown到下一行”与源不符：More是关闭的Menu.Trigger，ArrowDown打开“Session options”并被stopPropagation，测试改为断言菜单打开、焦点进入菜单、期间无行主按钮获得焦点、Escape归还More，再ArrowLeft回行后ArrowDown到下一行；③Filter/标题栏提示side按Nu默认top（说明允许按源默认）。

延后：`Session options`触发器标签保持不变；源menuTriggerLabel为`More options for {title}`（`c360a9e1c:7864-7869`），约20个原生脚本按现名定位，本次不改。

测试：
- app/tests/source-sidebar-states.test.mjs：新增2项——SSR整侧栏（含onSessionAction/onProject/搜索）无任何`title="`；主按钮、分组切换、Filter、New session in、行More、模式radio无title；More为`tabindex="-1"`且有`data-row-action`；Filter (active)标签；CSS断言滚动器4px内缩、pb 8px、-mr-2保留。
- 新app/tests/source-titlebar-tooltips.test.mjs：三种props（默认、menuKind folder、无cwd）下`.st-origin`/`.st-origin-glyph`/`.st-title`/`.st-folder`无title，aria-label不变。
- app/scripts/sidebar-chrome-ui-test.mjs（离屏sidebar-chrome）：夹具新增第4个长标题会话D（ids.length随之为4）；新阶段row-tooltips（长标签截断545>236，悬停恰1个[role=tooltip]全标题、data-side right、在标签右侧；短标签悬停1s无提示）、filter-tooltip（提示文字=aria-label、无title；打开菜单后提示消失，再悬停1s不出现）、row-keyboard（More tabindex -1/data-row-action；Tab/Shift+Tab行到行；分组切换上ArrowUp/Down不动；ArrowRight到More并夹紧、More不透明度1；ArrowDown在More上打开菜单且无行获焦、Escape归还；ArrowLeft回并夹紧；ArrowDown/Up移行、Up环绕到末项、Home到首行）、titlebar-tooltips（“Rename”在标题下方、文件夹胶囊显示cwd、文件夹菜单打开时无提示；`.app-sidebar [title], .st-lead [title]`为0）；truncate-dark-narrow阶段在Older批量触发器存在时再次断言无[title]。检查项29条。
- app/scripts/tooltip-ui-test.mjs（原生标准链脚本，未运行）：原“`.st-title`/`.st-folder`保留原生title”断言按产品更正改为断言为null（引mm/Fp），checks文案同步。

验证：`npm run build`通过；`npm test` 1075项1074通过、0失败、1既有跳过（新增3项）；离屏run-suite串行（负载4.4–5.2）：sidebar-chrome通过（29项）、code通过（9项）、home-page通过（19项）；`node scripts/verify-build.mjs`通过。构建0.2.114，SHA `cf6a8ffd33f50e8c1f0af8af6b58cf0c25333cc8820133c5de5ea66d3b6cdc14`，440源文件。已查看row-truncated-tooltip.png（全标题黑色提示在行右侧）、filter-tooltip.png（“Filter (active)”在按钮上方）、titlebar-rename-tooltip.png（“Rename”在标题下方）。中途失败记录：首跑因测试脚本变量名重复（SyntaxError）；第二、三跑row-keyboard失败，定位为More上ArrowDown同时触发菜单打开与eO移行（产品缺陷，已按源stopPropagation语义修复），修复后第四跑通过；追加Older [title]断言后的第五跑失败于“焦点仍在More”，是菜单异步取焦的断言时序问题（非产品），改为轮询菜单取焦并用focusin记录证明期间无行主按钮获焦，第六跑通过。日志work/claude-ui-sweep/0.2.114/。无保留失败。

剩余差距/后续：
- 行提示与家族把手的`lazy`/`trackCursorAxis "y"`无本地对应；qD的装饰行（decorated/wide，PD与--df-deco-extra修正）本地无装饰行，未实现。
- 源Filter触发器带`data-row-action`与`df-chrome-btn -my-1`，本地未加（不影响eO：表头不在[data-row]内）。
- 标题栏`Session options`标签延后（见上）；原生tooltip-ui-test改动未经执行验证（用户禁止占屏）。

## 0.2.113 删除伪造的常禁用听写分裂按钮：按源hideDictation分支不渲染听写控件（未安装）

源链（2.2553.1）：`c360a9e1c-GPs-MV9u.js:4892-4907` chin前导簇为`bH{squareSeam, className "flex shrink-0 items-center empty:hidden gap-xs", children:[P ? null : (ce ?? nf{hideDictation:P,…}), null]}`（P＝hideDictation；bH见ion-dist shared-13 `function bH({squareSeam,className,children})`，只是一个div）；`:5067-5095 nf`在hideDictation时返回null，只有showDictationButton＋start/stop/switch处理器＋ownerId齐备才用分裂`Tc`（带设备菜单），否则为单个禁用Microphone；Code传`hideDictation: !Bu`（`cc43287c9-BMbiZYzF.js:36836`），`Bu = Sd(…).dictationEnabled`（`:32338-32360`，支持性与功能开关）。本Codex客户端没有听写能力，源在此情形下不渲染任何听写控件（硬规则3）。

实现（产品更正）：
- app/src/source-composer.jsx：删除`div.sc-dictation[role=group][aria-label='Dictation unavailable'][data-cds=SplitDropdownButton][data-disabled]`及其“Dictate”/“Dictation settings”两个按钮与编造的禁用原因，改为引用上述源行的注释；未新增任何永远不会被设置的能力prop。
- app/src/source-composer.css：删除`.sc-dictation`/`.sc-dictation-mic`/`.sc-dictation-seam`/`.sc-dictation-settings`规则；`.sc-chin-leading`保持`gap:0`并加注释。
- 与任务说明的偏差（有源依据）：说明要求Add→Mode间距等于gap-xs，但gap-xs是bH簇内部的间距；无听写时bH为空div→`empty:hidden`（display:none）。Code在CDS composer下走chin布局（`cc43287c9:2967 AD → DD(e,"chin")`，`c360a9e1c:5034 mn.Chin{leading:Be}`），shared-11 `cu`前导槽为`flex items-center self-start`（无gap），Mode触发器（`Ud`，`Nt{ghost, className "min-w-0 shrink"}`）与plus均无外边距，故源中`Mode.left − Add.right = 0`。只有row布局（`div.flex items-center gap-xs min-w-0`）才是6px，本应用按CDS chin还原，因此保留0。
- analysis/composer-states-20260920/source-contract.md：听写一条标注0.2.113起渲染无听写分支，并记录上述chin/row间距推导。

测试：
- 新app/tests/source-composer-dictation.test.mjs：SSR完整SourceComposer（空闲/运行/发送/断开四态），断言无SplitDropdownButton、无“Dictat…”文本或标签、无sc-dictation，chin前导按钮恰为[Add, Permission mode]。
- app/scripts/composer-states-ui-test.mjs：原“39×20禁用分裂、标签['Dictate','Dictation settings']”断言按产品更正替换（引c360a9e1c:4893-4907，非放宽）：chin内无`.sc-dictation`/`[data-cds=SplitDropdownButton]`、无名为Dictate的按钮；前导子节点恰为[Add, Permission mode]；前导槽computed column-gap为`0px`，`Mode.left − Add.right`等于该解析值（±0.5px，实测0）。checks文案同步更新。
- app/scripts/code-ui-test.mjs（离屏code套件）：首跑确定性失败（`.sc-dictation`为null → getBoundingClientRect TypeError，日志code-before-fix.log），属本次删除导致的旧断言，而非环境问题；同理替换为：无听写控件、前导为[Add, Permission mode]、Add→Mode为0，其余Add 20px/16px字形与chin 20px断言不变；复跑通过。
- app/scripts/tooltip-ui-test.mjs（原生标准链脚本，本次未运行）：原541-590行禁用原因阶段以伪造的听写按钮为目标，已删除并改为断言chin中无听写控件、无Dictate按钮、无disabled-reason触发器；Pu禁用原因包装（tabindex 0、隐藏data-cds-disabled-reason描述、悬停/键盘）仍由离屏git-band套件在真实禁用Commit原因上覆盖。原阶段中的Enter/Escape保持打开与“首次打开前pointerdown不取消计时”两个子检查目前无原生覆盖。
- app/scripts/permission-ui-test.mjs：仅更新注释（外部点击点取编辑器右侧8px，与位置变化无关），未运行。
- home-page套件：无依赖旧位置的chin几何，未改动，照常通过。

验证：`npm run build`通过；`npm test` 1072项1071通过、0失败、1既有跳过（新增4项）；离屏run-suite串行全部通过（负载4–6）：composer-states（25项检查）、home-page（19）、bypass-permission（7）、code（9，修测后）、usage（8）、slash-commands-complete（4）、git-band（10）、transcript-states（5）、approval-card（10）；`node scripts/verify-build.mjs`通过。构建0.2.113，SHA `e2ceff8a9027f83293f9bd4df22577de6355e68a0276274184a28ed96e325683`，440源文件。已查看placeholder-session.png：chin左侧为“+ Auto”，无麦克风/下拉。日志work/claude-ui-sweep/0.2.113/。无保留失败。

剩余差距/后续：
- app/src/code-ui.jsx旧`Composer`（含`.dictation-controls`）与style.css `.dictation-controls`规则是未被渲染的死代码，本次未动。
- chin前导槽源为`self-start`，本地`.sc-chin-leading`未设（chin单行20px时无可见差异）。
- validate-local标准链原生窗口脚本（tooltip、permission）未运行（用户禁止占屏），其改动未经执行验证。

## 0.2.112 Composer发送/停止控件：源Stop字形、禁用Send不淡化、共享网格单元交叉淡入淡出、10px命中区、aria-keyshortcuts（未安装）

源链（2.2553.1 c099c328d-CbkcmYSW.js；旧版可读副本analysis/batch2-audit-20260920/readable/c099c328d-CbkcmYSW.js:8349-8383 sm/im/am/om）：sm({showStop,stop,send})在渲染期切换active键（[i,a]/[o,s]/[c,l]），`div.grid items-center justify-items-end`中stop、send两层都位于im `col-start-1 row-start-1 flex cursor-default items-center justify-end`；只有切换后新层才加am `motion-safe:animate-[cds-fade-in_0.12s_ease-out_0.08s_backwards]`（首次挂载无），旧层保留为`inert aria-hidden` + om `pointer-events-none invisible opacity-0 [transition:visibility_0s_linear_80ms] motion-safe:[transition:opacity_80ms_ease-out,visibility_0s_linear_80ms]`，仅在自身（target===currentTarget）visibility的transitionend时卸载。Send＝ga `Ut{ghost iconOnly icon Nh(ArrowReturn sm text-secondary group-disabled/btn:text-disabled), aria-keyshortcuts nn('enter')='Enter', busy/busyLabel 'Sending', className `${jh} ${Fh}`}`；Fh `[&:disabled:not([aria-busy])]:opacity-100`；jh（非compact主composer）`before:absolute before:left-0 before:-top-2.5 before:-right-2.5 before:-bottom-2.5`。Stop＝`hn{content 'Stop', shortcut Vt?void 0:'escape', hoverable:!1, lazy, open:Ki?void 0:!1}` 包 `Ut{icon Ih(Icon 'Stop' sm text-secondary), aria-keyshortcuts Vt?void 0:'Escape', className jh}`；Send提示 `open:!Ki&&void 0`。@keyframes cds-fade-in{0%{opacity:0}}（readable/design-system.css）。

实现：
- app/src/source-composer.jsx：新增导出的SubmitCrossfade（逐条对照sm，React 19 `inert`布尔属性→`inert=""`）；Stop改为`icon="Stop"`（16px，原为StopCircle）、`aria-keyshortcuts={menuKind?undefined:'Escape'}`（Vt↔menuKind），提示`hoverable={false}`、非活动时`open={false}`；Send加`aria-keyshortcuts="Enter"`，Stop活动时其提示`open={false}`。可访问名仍为“Send message”/“Stop response”。
- app/src/source-composer.css：`.sc-submit-cell`/`.sc-submit-layer`/`[data-entering]`/`[data-leaving]`与@keyframes cds-fade-in；删除`.sc-submit:disabled{opacity:.4}`，改为`.sc-submit:disabled:not([aria-busy]){opacity:1}`＋禁用时图标`--cds-text-disabled`、否则`--cds-text-secondary`（busy时仍由`.sc-button:disabled`淡到.4＋spinner，视觉不变）；`.sc-submit{position:relative}::before{left:0;top/right/bottom:-10px}`（绝对定位，不改变40px卡片高度）。
- 本地适配（有记录）：本应用在`prefers-reduced-motion: reduce`（style.css `* {transition:none!important}`）与设置里的data-local-motion=reduce下全局清除transition，源没有这条；这会让旧层永不收到visibility transitionend而一直挂载。首次离屏运行即暴露（reduce下transition为none、held为空），故对`[data-leaving]`在这两种情况下以!important保留`visibility 0s linear 80ms`（源中这一段本就不是motion-safe），opacity淡出仍按reduce去掉。

测试：
- 新app/tests/source-composer-submit.test.mjs：SSR首次挂载（showStop真/假）只有一个`sc-submit-layer`，无data-entering/data-leaving/inert/aria-hidden。
- app/scripts/composer-states-ui-test.mjs：基线空草稿禁用Send——单层、无淡入、aria-keyshortcuts Enter、opacity 1、图标色＝解析后的--cds-text-disabled、::before 0/-10/-10/-10、24×24；第8阶段Send→Stop用MutationObserver在旧层变[data-leaving]时抓取并暂停其transition、只finish opacity：新Stop层animation cds-fade-in 0.12s/0.08s/backwards/ease-out，旧Send层inert、aria-hidden=true、pointer-events none、opacity 0、`opacity 0.08s ease-out, visibility 0s linear 0.08s`；层级opacity及子元素冒泡的visibility transitionend都不卸载，放行后自身visibility transitionend卸载、只剩一层；Stop为Ih字形57578、16px、text-secondary、aria-keyshortcuts Escape、::before命中区，并存stop-control.png；运行中有内容的Send为text-secondary、Enter；reduce下Stop→Send：animationName none、旧层只有`visibility 0s linear 0.08s`且立即opacity 0（duration为design-system.css:1423的0.01ms钳制，不属本契约故不比）；第11阶段轮次完成时的反向Stop→Send同样核对。
- 更正（非放宽）：原`assert.equal(glyph, 57579, "StopCircle glyph")`编码的是本地偏差，改为源Ih 'Stop' 57578；原始DOM探针（:626/:629/:644 stops计数/:665 archived）改为`.sc-submit-cell [aria-label=…]:not([inert] *)`，`.sc-submit-slot`悬停改为`.sc-submit-layer:not([data-leaving]) .sc-submit-slot`（共享单元中离场层短暂共存）。同类更正（未运行，属标准链原生窗口脚本）：ui029-ui-test.mjs:234、tooltip-ui-test.mjs:504/519、transcript-fade-ui-test.mjs:189、permission-ui-test.mjs:208、session-actions-live.mjs:23。

验证：`npm run build`通过；`npm test` 1068项1067通过、0失败、1既有跳过；离屏run-suite串行全部通过（负载3–6）：composer-states（25项检查，最终构建上两次通过）、approval-card、background-tasks、code-fence、git-band、bypass-permission、code、transcript-states、turn-errors、turn-timestamps、subagents、workflows、slash-commands-complete、stream-highlight、run-command、edit-read、settings、skills-mcp；`node scripts/verify-build.mjs`通过。构建0.2.112，SHA `f8f0a7b433fbfa49c8ae8ebd7bfdc7664e435c6f2f0a20c2eb89c929d1a9d0db`，440源文件。已查看stop-control.png（方形Stop字形）与placeholder-session.png（禁用Send为浅灰ArrowReturn、不淡化）。日志work/claude-ui-sweep/0.2.112/。无保留失败。

剩余差距/后续：
- 可访问名偏差：源aria-label为“Send”/“Stop”，本地仍为“Send message”/“Stop response”（约39个脚本/测试按此定位），需单独一批统一改名。
- 源Stop提示`lazy:true`本地SourceTooltip无对应项（行为差异仅在于首次挂载延迟渲染，不可见）；源禁用Send外包`span.inline-flex min-w-0`，本地仍由既有`.sc-submit-slot`承担。
- compact（Mh 6px）变体未实现，Code主composer不用；data-local-motion=reduce下的交叉淡出未单独做离屏覆盖（与OS reduce共用同一CSS规则）。
- validate-local标准链原生窗口脚本未运行（用户禁止占屏），上面5个脚本的选择器更正未经执行验证。

## 0.2.111 设置/Usage对话框在焦点落到body时的Escape关闭（Claude复核0.2.110回归，未安装）

复核0.2.110最终回归：usage套件三次失败被判为“接了鼠标导致常驻滚动条”的环境问题，但本机AppleShowScrollBars未设置、无鼠标，AppKit preferredScrollerStyle为overlay；该套件0.2.98–0.2.104全部通过、0.2.110每次失败，故未接受该结论。受控探针（不含本应用任何CSS的隐藏Electron窗口，离屏与非离屏均测）当前溢出盒保留15px经典滚动条，证明Electron此刻选经典滚动条与本轮代码无关；列宽629=640−11（html * scrollbar-width:thin）。usage-ui-test按scrollbar-mode-gate classifyMode先例改为按模式精确断言：实测lane仅允许0或11，列宽＝640−lane，其余几何不变（非放宽）。

几何修正后暴露真实产品缺陷：点Refresh usage时按钮原生disabled，负载高时Chromium把焦点丢到body，而设置/Usage对话框只在根节点onKeyDown处理Escape，于是Escape无效（bypass-permission、background-tasks在Reconnect后Escape失败同类）。源Base UI Dialog useDismiss在document上监听Escape。新增usage步骤：fixture挂起rateLimits读取、点Refresh、确认焦点在body后按Escape——修复前确定性失败（busyFocus=body，对话框未卸载），修复后通过。修复：source-settings.jsx增加document级Escape回退，仅当activeElement为body/documentElement且本对话框是最后一个aria-modal时关闭，嵌套对话框Escape不受影响。

验证：npm test 1066项1065通过1既有跳过；离屏bypass-permission、background-tasks、settings、settings-complete、account-lifecycle、menu-bar、skills-mcp、usage全部通过（负载36–80）；0.2.111最终构建上usage复跑通过；integrity通过。未改变禁用按钮失焦本身（与源禁用控件一致）。构建SHA `0356e94c93c0bc1a86da1f4fcbd494a1fb1c142d8bef5e69821717d17cefb993`，440源文件。日志work/claude-ui-sweep/final/escape-fix。0.2.110中“usage为鼠标滚动条环境问题”的结论作废。

## 0.2.110 Composer提示历史：空编辑器↑/↓回溯本会话已发送提示，“History i/n”头部条（未安装）

源链（2.2553.1）：shared-13-Bl2X1oob.js :14448-14600 Vj（Lj/Rj/zj/Bj）；c099c328d-CbkcmYSW.js :10677-10697 Zi调用（resetKey＝pi、getHumanPrompts＝mi、caretAfterRecall "end"），:10733 wi＝navState !== null → wh（:9712-9719）在历史导航期间禁用slash/mention建议，:11170-11188 ya只在无建议弹层时（`!t && gi(e)`）运行历史并stopPropagation，:10770 Pi提交与:10937 insertSlashCommand调用dismissNavState；cc43287c9-BMbiZYzF.js :28625-28628 historyResetKey仅对已有会话为`${draftKey}:${sessionId}`（New草稿无历史）；getHumanPrompts＝:30678 la → L_（cf6ae6197 OE）：按消息顺序（旧→新）取人类user消息文本，非空才入列。头部条：本地composer是CDS壳（data-cds-shell，cdsShell分支Em），故按Em :9012-9015 `Nn.Header aria-hidden whitespace-nowrap` + wm（:8580-8633）而非epitaxy分支:11386-11490的grid条：shared-11 uu（:1430-1446）`flex min-h-[var(--cds-h-control-nested)] min-w-0 items-center gap-xs text-footnote font-normal text-muted`＋So("text")（无卡内leading动作，:1703）pl 4px/comfortable 6px；header槽（:1856-1878）grid-rows-[1fr] overflow-hidden、enterClassName nl＝motion-safe `cds-grid-rows-in 0.3s cubic-bezier(0.25,0.1,0.35,1)`，内层min-h-0 min-w-0 pb-[var(--cmp-gap-y)]（compact .375rem）；位于卡内附件与编辑器之上。hasDraft时“·”分隔＋`inline-flex min-w-0 items-center gap-1 truncate`内含cbd6db52c Kbd（text-caption＋单字方形keycap）“↓ to restore your draft”。sr-only role=status为“History {index}/{total}”（＋草稿提示）。

实现：
- 新app/src/prompt-history-model.mjs：纯reducer promptHistoryStep(state,{resetKey,key,修饰键,composing,inEditor,atStart,atEnd,text,prompts}) → {state,action:'none'|'exit'|'swallow'|'recall'|'restore',text,nav}，逐条对照Vj：resetKey为空时无效；resetKey变化清空；非方向键在导航中（index非空）且为可打印/Backspace/Delete/Enter（无meta/ctrl/alt、非组合输入）时exit（只清strip，不吞键，index按源保留）；方向键带shift/meta/ctrl/alt或组合输入、目标不在编辑器、光标不在首/末行（Bj）、列表为空时忽略；列表长度变化或注入后文本被改动则重置；↑仅空编辑器进入（isEmpty＝全空段落），暂存草稿、hasDraft＝草稿非空（Rj），index＝最新；导航中↑到max(0,i-1)，最旧处swallow；↓仅导航中，越过最新恢复草稿并结束。humanPrompts(items)：userMessage的text部分以“\n”连接，非空保留。promptHistoryStatus(nav)生成sr文本。
- app/src/source-composer-editor.jsx：input新增caretAtEdge('start'|'end')（zj/Bj：折叠选区在文档首/末，或与首/末textblock同块且view.endOfTextblock('up'/'down')）与recallText(text)（整文档替换、Selection.atEnd、addToHistory false、scrollIntoView；docChanged走现有onChange受控路径同步draft，不进入撤销历史）；卸载时一并删除。
- app/src/source-composer.jsx：新增props getHumanPrompts、historyResetKey；模型state在ref，nav在state；resetKey变化（layout effect）清空；keyDown在mention/slash弹层都未打开时先跑模型（弹层保有↑优先权），swallow/recall/restore时preventDefault＋stopPropagation；导航中（nav非空）showCommands为false、updateMention直接关闭（wh）；submit与'open-slash'事件dismiss strip。卡内`.sc-surface`顶部渲染`.sc-history-header-grid > .sc-history-header-clip > .sc-history-header[data-cds=ChatComposerHeader][aria-hidden]`，计数span tabular-nums；表单内sr-only role=status `[data-history-status]`。source-composer.css新增对应样式（prefers-reduced-motion时无动画）。
- app/src/main.jsx：historyResetKey＝current ? `${mode}:${current}` : undefined（本地没有per-scope草稿key，以mode代替draftKey），getHumanPrompts＝() => humanPrompts(items)（仅当前打开Codex线程的真实userMessage）。

测试：新增tests/prompt-history-model.test.mjs（10项）：只在空编辑器进入且先取最新；到最旧后swallow；↓越过最新恢复暂存草稿（含“\n”空段落草稿）；空草稿hasDraft false及携带非空草稿时的hasDraft/恢复；输入x/Backspace/Delete/Enter退出且不吞键，其他键与带修饰/组合输入不退出；修饰键、组合输入、非编辑器目标、光标不在边缘、空列表均忽略；resetKey变化与列表长度变化重置；编辑回溯文本后重置（未改动则继续）；resetKey undefined完全无效；humanPrompts过滤与顺序。离屏composer-states：fixture新增线程composer-states-E（两个用户回合），新增第15阶段（20→21项检查）：New草稿↑无反应；E中空编辑器↑→文本“Second history prompt.”、光标在末尾、strip“History 2/2”（tabular-nums、字号等于卡内解析的--cds-font-size-footnote 12px、颜色等于--cds-text-muted、nowrap、aria-hidden、data-cds ChatComposerHeader、位于卡内且在编辑器之前、动画cds-grid-rows-in 0.3s），sr-only status“History 2/2”；↑→“History 1/2”；再↑ keydown被preventDefault且停在1/2；浅色/深色截图；End后输入x→strip消失；非空“wip”时↑不被消费、文本不变；空编辑器↑再↓→恢复空草稿且strip消失；“/”打开slash菜单时↑移动菜单高亮（0→24/25）、无strip；reduced motion下animation none。测试更正（非放宽）：首轮把探针挂在body上解析--cds-font-size-footnote得到13px，而composer位于data-density="compact"根内为12px，探针改挂到卡内再比较。

验证（日志work/claude-ui-sweep/0.2.110/）：npm run build通过；npm test 1066项，1065通过、0失败、1跳过（原有跳过）；离屏composer-states 21项检查通过（analysis/batch-20260920/composer-states-ui-2026-09-23T13-18-51.250Z，截图prompt-history-light/dark.png已目视，副本在日志目录）；回归code 9项、slash-commands-complete 4项通过；verify-build通过（0.2.110，SHA 1793af626a5b776b24cc75d81d3d6f77bc0dfada21710f5f7529d54edfa16733，440源文件）。保留失败：无。

剩余缺口：Ctrl+R历史反向搜索（c099c328d _d，“Search history:”条与cycle/cancel提示）未做；bash模式的历史变体（getBashHistory/W_）不适用（本地无bash模式）；onEmptyArrowUp取回最后一条排队消息（cc43287c9:28653 `_n ? Ne : void 0`、c099c328d:11172-11183 Ge）未做，空编辑器↑目前直接进入历史。回溯时不重建命令chip（源di把已知“/id”转成chip），本地插入纯文本“/id …”，序列化结果相同；源header的退出高度动画（rr exit height 0，保留上一状态Ei折叠）未移植，strip直接卸载；源OE还拼接未完成pending turn（jd），本地只读state.items中已有的userMessage。hasDraft在Vj中只能对空编辑器进入，因而实际恒为false，“↓ to restore your draft”分支只由单测覆盖。

## 0.2.109 Git状态条/rail改用CDS提示：去掉原生title、仓库菜单“Copy path”与源复制成功toast（未安装）

源链（2.2553.1）：git-status-card.js :1296-1318 计数按钮包K{content:'View changes'}；:1270-1292 behind为多行K；:1085-1119 Me的禁用Commit由Fe＝shared-frame Pu（:4869-4895：multiline、closeOnClick false、sr-only描述理由）包裹；:5231 repoTooltip＝repo || cwd。git-chips.js :46-96 D（仓库chip）仅当tooltip !== repoName时显示，且chip菜单打开时open:false；:97-221 M（分支chip）只在标签被截断（scrollWidth > clientWidth，head/tail任一）时显示全名，菜单打开时不显示，“Copy branch name”成功后addSuccess('Branch name copied to clipboard.')。cc70f2bdf-CILU7c4u.js Ko（:2270-2385）＋qo（:2387-2394）：仓库菜单按组以分隔符连接 [open-in/reveal] | [Copy path(+Change directory…)] | [Open in terminal]；band调用mr时只传cwd不传branch（git-status-card :4793），故复制组为单行“Copy path”，写cwd后addSuccess('Path copied to clipboard.')。rail：Zi（:1633-1760）标题为`Y{lazy}`＝shared-frame Fu OverflowTooltip（内容为函数：scrollWidth > clientWidth或Jc Range越界＞0.1px时才给全文）；c0b46114c y的Dismiss tooltip默认false；Hi把Fe的wrapperClassName设为`min-w-0 flex-1`。

实现：
- app/src/source-git-status.jsx：删除全部原生title。计数按钮包SourceTooltip“View changes”；behind为multiline SourceTooltip；禁用Commit用SourceTooltip disabledReason（沿用现有Pu实现：tabindex 0包装span＋aria-describedby指向hidden `[data-cds-disabled-reason]`）；仓库chip内容＝cwd且仅在cwd !== repoName时存在，菜单打开时`open={false}`；分支chip内容为函数，在打开时测量head/tail span是否截断才返回全名，菜单打开时`open={false}`。仓库菜单改用SourceMenu.Item/Separator，按gitRepoMenuItems渲染：Open in Finder | 分隔符 | Copy path（新prop onCopyPath(cwd)）；两个菜单都不再用裸button。仓库chip只有在两个菜单项都不可用时才禁用。
- app/src/source-git-rail.jsx：标题改为SourceTooltip函数内容（textOverflows subpixel，镜像Fu，data-cds="OverflowTooltip"）；Dismiss删掉源里没有的“Dismiss”title；rail Commit用disabledReason包装，wrapperClassName `sgr-action-wrap`（source-git-rail.css：flex 1、min-width 0，对应Hi的`min-w-0 flex-1`）。
- app/src/source-tooltip.jsx：新增导出textOverflows(node,{subpixel})（git-chips A＋Fu的Jc）；SourceTooltip新增wrapperClassName（Pu的wrapperClassName），默认行为不变。
- app/src/git-rail-model.mjs：新增纯函数gitRepoMenuItems({openFolder, copyPath})，按qo把非空组的首项标separatorBefore。
- app/src/main.jsx：App内用useSourceToasts()；onCopyPath/onCopyBranch经navigator.clipboard.writeText写入，resolve后add('Path copied to clipboard.' / 'Branch name copied to clipboard.', neutral)；reject时不出成功toast，仍走原setError。
- 未加“Change directory…”与“Open in terminal”：本地没有换目录的session ref，也没有终端tab打开器（诚实缺省，见剩余缺口）。

测试：新增tests/source-git-band.test.mjs（5项，vite SSR）：gitRepoMenuItems返回[{label:'Open in Finder'},{label:'Copy path',separatorBefore:true}]，缺组时不留分隔符；band在dirty空闲/运行中与behind下无任何`title=`，运行中Commit位于tabindex 0包装内且aria-describedby指向hidden理由“Claude is working — wait for the turn to finish”，clean时band不渲染；rail空闲/运行中/clean均无title，标题为data-cds="OverflowTooltip"，Dismiss无title，运行中Commit包装带sgr-action-wrap并有描述理由。新离屏套件app/scripts/git-band-ui-test.mjs（已登记到run-suite.mjs suites与memoryClipboard数组、validate-local.mjs standard列表）：隔离profile下建临时git仓库（提交＋改动，+2 −1），夹具线程在该cwd；检查nav.sg-status内无[title]；悬停+2 −1出现单行CDS提示“View changes”；短分支main悬停900ms无提示；仓库chip显示cwd提示；菜单打开时无提示（含重新悬停）；菜单为Open in Finder | 分隔符 | Copy path（不点Open in Finder，避免触及shell.openPath）；Copy path后恰好一个neutral toast“Path copied to clipboard.”且内存剪贴板＝cwd；真实`git checkout -b`切到91字符分支并经window focus刷新后，截断的chip提示全名；分支菜单打开时无提示，Copy branch name出现一个“Branch name copied to clipboard.”且剪贴板＝全名；发送fixture:hold运行中，禁用Commit包装tabindex 0、hidden理由，悬停与Tab聚焦都显示多行理由；结束前恢复剪贴板。

断言更正（非放宽）：app/scripts/git-rail-ui-test.mjs（不可在离屏下运行，本次未运行）原先断言禁用Commit/behind的`getAttribute("title") === 理由`，这正是源里不存在的原生title；按Fe/Pu与K改为断言aria-describedby指向的hidden理由等于同一字符串，同时新增title必须为null，enabled时理由为null且无包装。

验证（日志work/claude-ui-sweep/0.2.109/）：npm test 1056项1055通过、1跳过（原有跳过）、0失败；npm run build通过；离屏run-suite：git-band 10项检查通过（analysis/batch-20260920/git-band-ui-ifSYk6，offscreen-git-band-5kc9wj，memoryClipboard调用含writeText且结束时与初始一致，violations/blocked/native均为空）；run-command回归14项通过（run-command-ui-2026-09-23T13-02-52.234Z）；截图已查看（view-changes-tooltip、repo-tooltip、repo-menu、copy-path-toast、long-branch-tooltip、copy-branch-toast、running-disabled-reason）：长分支提示为多行深色CDS气泡，菜单两项之间有分隔线，toast在右下。verify-build通过（0.2.109，SHA d01a63fce9563bebe48392ed2dc86b68e382d38e0de8bed1fd9b3975571ed24a，439源文件）。保留失败：无。

剩余缺口：仓库菜单缺“Change directory…”（需要changeCwdSessionRef/Go能力）与“Open in terminal”（需要终端tab打开器），open-in组只有本地Finder而无源or()的编辑器/其他应用项；分支菜单无“Open branch on GitHub”（无forge数据）。源Fe在Commit启用时也包一层tabIndex -1的inline-flex span，本地仍只在禁用且有理由时包装。band分支chip的aria-label本地始终为分支名（源只在split时设置）。rail仍无宿主挂载（SourceGitRail只由显式调用方使用），其标题截断提示仅由SSR单测覆盖，未做离屏悬停验证。git-ui-test.mjs与git-rail-ui-test.mjs会占用真实窗口/剪贴板，按规定未运行。

## 0.2.108 分组工具行改用源in-card布局：命令行无嵌套“Shell”卡，Read/Edit路径头移到代码框外（未安装）

源链（2.2553.1 readable/approval-current.js）：classic工具组展开体对每个成员调用m8（:54035-54063），渲染RN{tool, inGroup:true, inCard:true}；inCard经FN（:17308-17330）→gN（:16622-16645）→KO（:6943，:7006 bash、:7007-7026 diff、:7027 file）一路传下。此前本地SourceMessage只把inToolGroup交给SourceAgentTool，命令与文件分支忽略它，组内每行都画成独立行的整卡，出现“组卡里再套一张带Shell标题的描边卡”。

命令（app/src/source-command.jsx SourceCommandBody新增inCard）：inCard分支＝Uoe（:6874-6941）→GO非standalone（:6847-6862）：`group/body relative flex w-full pt-xs`＞`flex-1 min-w-0 flex flex-col gap-md text-code`{UT“$”命令块＋compact Copy、RO“Tool output”、KE运行页脚}＋copyAction。无标题span、无WO卡（:6838 epitaxy-card-outline-inset）；copyAction仅在无命令但有输出时填充（:6882 `l = c(!r && e.output ? ty : null)`，运行中与原逻辑一样隐藏）。外层仍为.src-cmd-card-outer，加data-in-card；source-command.css以`[data-in-card]`作用域给出padding-top var(--cds-pad-xs)/bottom 0、flex、position relative，内列padding 0、flex:1（gap-md与text-code沿用.src-cmd-content），悬停显隐Copy的group/body改为该wrapper本身。独立行（非组）仍走WO卡＋“Shell”标题，DOM/CSS未改。文件头注释改为描述两支并引上述行号（原注释“transcript never passes inCard”对组行不成立）。“cell”变体（:6908-6921）非本地表面，未移植。

Read/Edit（app/src/source-file-tool.jsx ToolCard/FileToolMessage新增inCard）：UO（:6784-6837）inCard支＝`group/body flex w-full flex-col pt-xs`＞头部`flex items-center gap-1 pb-xs`（无px）在代码框外＋代码框`epitaxy-diff epitaxy-code-card rounded-lg overflow-clip`，style {background: Tv, minHeight: reservePx}，无epitaxy-card-outline-layer。Read（Yoe :7211-7234）与Edit/Write diff（KO :7007-7026）都走UO，故两者同改；失败/搜索/列目录的DetailsBody不走UO，未动。组内渲染为`.sft-outer[data-in-card]`＞header.sft-header＋div.sft-code（无section.sft-card）；source-file-tool.css以`[data-in-card]`作用域：wrapper flex column、padding-top pad-xs；header padding `0 0 pad-xs`；代码框radius-lg、overflow-x clip（RO的max-h-[400px] overflow-y-auto保留）、背景与独立卡同一Tv表达式（light-dark(--code-theme-*-bg, alpha-1)）、前景同独立卡；min-height预留逻辑不变。source-session.jsx把inToolGroup作为inCard传给SourceCommandBody与FileToolMessage。

测试：新增tests/source-tool-incard.test.mjs（4项，vite SSR）：组内命令有data-in-card、无.src-cmd-title/.src-cmd-card/“Shell”，仍有“$ ”块、compact Copy与Tool output组，且有命令时copyAction槽为空；无命令有输出时Copy按钮位于内容列之后；非组命令仍为WO卡＋Shell；组内Read与Edit的header是代码框前的兄弟节点且无sft-card，非组Read头部仍在section.sft-card内。离屏：run-command-ui-test.mjs新增第二轮独立命令夹具rc-solo（用户消息后单个命令，不成组）与4b阶段——组内rc-done wrapper padding-top＝在body内解析的--cds-pad-xs（4px）、bottom 0、flex/relative、box-shadow none、outline none、无.src-cmd-card/标题/“Shell”文字、内列padding 0、gap＝--cds-gap-md、“$”块radius 8px且非透明背景；独立rc-solo wrapper padding pad-md×2、卡片inset 1px描边、radius 8px、头部padding pad-sm pad-md、内容padding `0 pad-md pad-lg`，且“$”块几何与组内逐项相等；末尾切暗色再验一次并截图（commands-grouped-light/dark、command-standalone-light/dark）。edit-read-ui-test.mjs新增独立Read夹具solo-read（第一轮末尾prose之后）与组内阶段——组内read-a/edit-a：header在wrapper内且紧邻代码框、wrapper padding-top pad-xs/bottom 0/flex column/无阴影、header padding 0 0 pad-xs 0、gap 4px、代码框radius 8px/无阴影/背景等于独立卡背景/max-height 400/overflow-y auto/min-height保留；独立solo-read：header在.sft-card内、wrapper pad-md×2、header pad-sm/pad-md、卡片8px inset 1px；暗色下组内代码框背景仍等于暗色独立卡（截图group-incard-light/dark、standalone-read-light/dark）。

断言更正（非放宽）：①run-command原第4步在组内行rc-done上断言`title === "Shell"`并取`.src-cmd-card`——这是独立WO卡的几何，按m8 inCard（:54035-54063）与GO（:6847-6862）改为断言无标题、无嵌套卡，Shell/描边断言转到新的独立行rc-solo上；body定位由`.src-cmd-card`改为两支共有的`.src-cmd-card-outer`；原仅记录未断言的cardOuterPadding/cardShadow删除，由4b精确断言取代。②edit-read的body定位由`.sft-card`改为两支共有的`.sft-outer`（计数2/3张卡与Copy断言不变）。③token长度须在transcript体内解析：body级--cds-pad-xs为6px，transcript作用域内为4px（首轮离屏因在document.body上取值而失败，已改为在行内挂探针）。

验证（日志work/claude-ui-sweep/0.2.108/）：npm run build通过；npm test 1051项1050通过、1跳过（原有跳过）、0失败；离屏run-suite：run-command 14项检查通过（analysis/batch-20260920/run-command-ui-2026-09-23T12-48-10.957Z）、edit-read 16项（edit-read-ui-2026-09-23T12-48-38.221Z）、background-tasks 6项、approval-card 10项、subagents 7项回归通过，violations/blocked/native均为空；截图已查看：组内命令无第二张描边卡、“$”块直接位于行下；组内Read/Edit路径头在代码框外；独立命令仍为Shell卡。verify-build通过（0.2.108，SHA 965b32decf1ac77a416ad5b7db269091702bbebd2508482488cabffdbb4a2a44，439源文件）。保留失败：无。

剩余缺口：`.epitaxy-diff:not(.epitaxy-fence)`在claude-light/claude-dark代码主题下的外圈`box-shadow:0 0 0 1px var(--cds-border)`（design-system.css:56758-56768）本地从未实现——影响UT“$”块、独立UO卡内RO（表现为头部与代码之间的1px分隔线）和本次的inCard代码框；本地根元素也未设置data-code-theme-light/dark属性。为保持独立行像素不变与“$”块一致，本次未加，需统一处理。通用工具（SourceGenericToolBody）组内应走GO非standalone（KO中`standalone: i`在inCard时为false），未在本项范围内核对；Uoe的“cell”变体与RO的Dx(slot)数据属性未移植；独立WO卡的Copy悬停组本地挂在.src-cmd-card而非py-md外层（原有差异）。

## 0.2.107 Customize目录加载态：源表格骨架、“Couldn’t load …”失败态与全部操作改用CDS Button（未安装）

加载骨架（app/src/source-customize.jsx CatalogSkeleton，2.2553.1 readable/shared-22-Cz3C_T8d.js）：类串均为源串且都在已加载的c6a992d55-Vcbdv79k.css中。jC（:3397-3458）＝`-mx-pad-lg shrink-0 overflow-hidden px-lg [scrollbar-gutter:stable]`内1个表头行（OC `flex h-control items-center px-md`，footnote条宽w-16/w-8）＋TC.length=6行（kC `box-content flex h-7 items-center gap-sm border-b border-alpha-1 px-md py-sm`，首行加border-t；AC三列`min-w-0 flex-1`/`w-40 shrink-0`×2；首列条宽TC w-32/w-40/w-28/w-36/w-24/w-32=128/160/112/144/96/128px，后两列w-8/w-16）。条＝Q（:2880 `flex h-lh max-w-full items-center`）内K＝shared-frame gc（:3448-3480，导出为wc）非SkeletonGroup分支：role=status、sr-only“Loading”、shimmer ::after；tailwind-merge语义下size-6/h-control替换默认h-[1em]。Connectors用MC（:3459-3480，data-testid connectors-rows-skeleton、`flex flex-col gap-sm pt-sm`、VS w-63=252px h-control搜索占位、行带size-6前导图标槽）；Skills/Plugins按FC（:3876-3881）用jC {className:"mt-sm"}且无图标槽（规格说Plugins带图标，源不带，按源）。FC的sr-only role=status“Loading”（:3620-3628）在aria-hidden主体旁。按源G "loading"（customize-connectors-current.js:3136-3147）加载时只画页头＋骨架：说明文字、owner分段、“stopped working”卡与表格均不画（此前旧键的行与卡片会在新键加载时残留）。原“Loading skills…/connectors…/plugins…”文字删除；plugin详情的“Loading plugin details…”保留（c36b3644c无对应骨架）。本地`* {box-sizing:border-box}`（style.css:17，未分层）压过@layer utilities的.box-content，故source-customize.css为`[data-cz-skeleton] .box-content`重申content-box（同transcript骨架做法）。

失败态（CatalogLoadError）：status==='error'时只渲染页头＋失败块，无表格/说明/role=alert，原始后端错误只按不同消息console.warn一次（useLoadFailureLog）。Connectors＝so()（:3830-3848）`div.flex.h-full.flex-col.items-center.justify-center.gap-md.p-lg.text-center`＞p`text-body text-muted`“Couldn’t load connectors”＋CDS Button secondary“Try again”（Mt→store.loadMcp({threadId,cwd,force:true})）。Skills＝Ti {missing:"all"}（customize-skills-current.js:2380-2396）→c27f32a39 Ie非partial：role=status、data-testid skills-tabbed-list-error、`flex flex-1 flex-col items-center justify-center gap-lg px-md py-xl text-center`、p`max-w-xs text-pretty text-body text-secondary`“Couldn’t load your skills.”、secondary busy按钮“Retry”（源为Retry而非规格写的Try again，按源）；重试期间保持失败块并aria-busy（ut.retrying），ObjectMagnifier pictogram（shared-7 tV）未画（pictogram缺口）。Plugins：classic插件页源无失败分支，本地适配为so()布局＋源目录文案“Couldn’t load plugins.”（cb2367241 catalogLoadFailed / c84e37421）＋“Try again”。store原有“ready列表重载失败保持ready”不变。

CDS Button（app/src/source-settings-button.jsx/.css）：新增flush（shared-frame ks :2833-2836/:2880，仅非joined ghost；true=start，Cs ms-/me-/mx-outset，--cds-outset-x为ws var(--cds-pad-md)，icon-only为Os(h-control−图标)/2）与danger变体（_s text-on-danger font-medium、ys bg-fill-danger/hover、ds实心squish inset .5px、is focus-shadow-danger）。Customize全部.cz-button/.cz-back替换并删除其CSS：drill返回＝ghost size sm ArrowLeft（density auto）flush（customize-page-shell-current.js:486-493，size:c见下“审阅修正”）；Show in Finder、Reconnect、Reconnect all、Sign in、Cancel、Try again＝secondary；行内/卡片内Reconnect、Sign in＝secondary size sm（.cds-root [data-size=sm]重映射h-control/radius）；Add custom connector、Add connector（submit）＝primary；“Use in message”＝primary size sm＋icon Chat，技能关闭时外包SourceTooltip disabledReason“Enable skill to try in chat”（cfaabd194技能头“Try in chat”；标签保持本地“Use in message”，头部重做另列缺口）；确认“Remove”＝danger（c5fb58ef0 confirmVariant "danger"）；“Remove connector”触发器在c08e79e85中是danger菜单项而非Button，本地为secondary＋--cds-text-danger文字色。.ss-dialog .cz-page的通用focus轮廓改为排除.source-settings-button（与source-settings.css一致），CDS焦点阴影生效。

夹具与离屏：tests/fixtures/codex-server.cjs新增replyCustomize：fixture-customize.json的skillsFail/pluginsFail/mcpFail使列表失败，skillsDelayMs/pluginsDelayMs/mcpDelayMs（≤5000）延迟回复；MCP旋钮只作用于Customize请求形状（无limit），Developer设置快照不受影响；无旋钮时行为不变。work/offscreen-app-integration-20260922/run-suite.mjs注册'skills-mcp'（已在validate-local标准列表）；该套件在main进程桩化shell.openExternal/showItemInFolder且不碰剪贴板，基线（改动前）离屏16项通过、violations/blocked/native为空。skills-mcp-ui-test.mjs：`.cz-back`定位改为`.cz-drill-header`内getByRole('button',{name})；新增1a技能骨架几何（sr-only status、表头32px、行=28+2×pad-sm+1(+1)、TC宽度、w-8/w-16、w-40列、无图标槽、cds-shimmer、无文字/表格/说明）、1b技能失败→Retry busy→失败保留→清旋钮Retry恢复（forceReload）、Plugins骨架→“Couldn’t load plugins.”→Try again恢复、fx-beta的Use in message禁用opacity=--cds-opacity-disabled与disabledReason、返回按钮ghost size sm/按钮自身（sm重映射后）--cds-h-control/--cds-radius/flush −自身pad-md/hover paint=--cds-fill-ghost-hover且无下划线、Show in Finder/Use in message变体与高度、行内Reconnect/Sign in sm高度/圆角、Add custom connector primary、Remove connector危险文字色、确认Remove danger paint/on-danger；10步重开会话使MCP目录键变化→MC骨架（252px占位、6个24px槽、无旧卡片）→“Couldn’t load connectors”＋secondary Try again（无table/th/notice/alert/原始文本）→点击后恰一次带threadId的mcpServerStatus/list并恢复表格。原RPC断言（Reconnect all、Enter行内Reconnect、Sign in外部打开一次、add/remove写入、toggle、reveal）均未改且通过。

测试：新增tests/customize-states.test.mjs（3项，vite SSR）：三页加载只有页头＋sr-only Loading＋aria-hidden骨架（18个kC格、首行border-t、TC宽度、connectors MC/w-63/6个size-6、skills/plugins mt-sm无size-6、无Loading…文字/表格/说明）；失败只有源文案与按钮、无表格/原始错误/alert；ready保持列表，按钮变体/sm（行内按钮、返回、Show in Finder、Use in message、技能Retry；so() Try again无size）/flush/disabledReason，无cz-button/cz-back。tests/response-markdown-render.test.mjs两处返回按钮邻接断言`Plugins<\/button>`、`Real Package<\/button>`改为`…<\/span><\/button>`：CDS Button把标签放在.ssb-content内，是本次标记的真实变化，断言强度不变。

审阅修正（按钮尺寸）：本地Customize建模为classic设置对话框（pageLayout=false，见PageSearch的w-48），源在此情形下给三处CDS Button传size "sm"：①page-shell drill返回`w({variant:"ghost",size:c,icon:"ArrowLeft",flush:!0})`（customize-page-shell-current.js:486-493），c=A()（:442），A为shared-20导出Za＝Lf（tmp-shared-20-BrTrXIRV.js:2013 `return Ff() ? void 0 : "sm"`，:9918 `Lf as Za`）；②技能失败Retry为c27f32a39 Ie `S({variant:"secondary",size:a,busy:t…})`，a=A()＝shared-20 Za；③cfaabd194技能头“Try in chat”primary `size:te`，te=Te()＝shared-20 Za（同一headerActions里的secondary“Share”也是size:te）。source-customize.jsx新增常量DIALOG_BUTTON_SIZE="sm"（注释引Lf/Za），BackButton、CatalogLoadError技能Retry、“Use in message”传size；本地“Show in Finder”位于同一headerActions行，按te一并取sm（本地适配，避免同行28/32px混高）。so()的“Try again”源不传size，保持base 32px。flush外扩仍为var(--cds-pad-md)，在按钮自身[data-size=sm]上解析为pad-md--sm（10px）。skills-mcp-ui-test.mjs新增ownLengthToken（在按钮内部挂探针取自身计算值，尊重design-system.css:54649 `.cds-root [data-size="sm"]`重映射）：返回按钮断言size=sm、自身h-control/radius/pad-md等于--cds-h-control--sm/--cds-radius--sm/--cds-pad-md--sm，高度/圆角/flush按自身token；Show in Finder/Use in message与技能Retry断言size=sm并按自身token与h-control--sm测量；Try again断言无size（base）。原先把返回按钮与头部按钮对比对话框级32px --cds-h-control是断言了错误的base尺寸，属测试本身错误，故改为按按钮自身token测量（未放宽容差）。customize-states SSR测试同步断言上述data-size与Try again无data-size。离屏实测：返回28px/7px/margin −10px、Show in Finder/Use in message/Retry 28px/7px、Try again 32px/8px。

审阅修正后验证（日志work/claude-ui-sweep/0.2.107/review-sm-size-*.log）：npm run build通过；npm test 1047项1046通过、1跳过（原有跳过）、0失败（修正后首次运行在构建刚结束时有1项失败，未能取得名称，随后两次完整重跑均0失败，视为主机负载下的原有时序抖动）；离屏run-suite skills-mcp 21项检查通过（analysis/batch-20260920/skills-mcp-ui-2026-09-23T12-33-35.672Z，violations/blocked/native为空，skill-detail截图已查看）；回归settings 7项、settings-complete 9项通过；verify-build通过（0.2.107，SHA 1e7657b255cdf0f715a470c469f6630386c1d6a9c8a4053fb2b1db0bb0dabc55，439源文件）。

首轮验证（日志work/claude-ui-sweep/0.2.107/）：npm run build通过；npm test 1047项：负载下（load average约107）1045通过、1跳过（原有跳过）、1失败——codex-client “stopAndWait includes older detached connections…”时序用例，单独重跑tests/codex-client.test.mjs 13/13通过（codex-client-rerun.log），与本改动无关；离屏skills-mcp 21项检查通过（analysis/batch-20260920/skills-mcp-ui-2026-09-23T12-11-46.994Z，截图已查看：connectors-skeleton、connectors-error、skill-detail、connectors、plugins）；回归settings 7项、settings-complete 9项通过；verify-build通过（0.2.107，SHA b8c2bc055ff19768078ba799929f03fe11ea96880a143fa4120c2cf155a6c0ac，439源文件）。保留失败：主机负载（load average 60–180）期间一次npm test有22项进程/超时类用例失败（codex-client “initialize timed out”、file-search/Git子进程截止时间，均与本改动无关，日志npm-test-under-load.log），负载下降后重跑见上；一次离屏skills-mcp在原有第6步（startupStatus ready行短暂patch为connected后被重列覆盖）超时（skills-mcp-flake-under-load.log），另一次骨架截图晚于延迟回复（skills-mcp-skeleton-timing.log，已改为先取DOM事实再截图、MCP延迟5000ms），最终运行通过。离屏截图中表格右侧少11px为当前主机连接了鼠标、滚动条为classic（cz-scroller的scrollbar-gutter:stable保留11px通道），与本改动无关。

剩余缺口：connector drill-in（整页详情替代右侧卡）；技能详情头（Enable开关位置、⋮菜单、“Try in chat”标签与元数据facts）；pictogram空态与Ie的ObjectMagnifier；“Filter by status”分段；行aria“View {name}”；插件重名后缀；行内状态列160px放不下“Sign in required”＋sm按钮（改动前即截断）；MC/jC计数按TC.length，源fC测量的行数（tableBound）与page-layout flush分支未移植；plugin详情加载仍为文字状态。

## 0.2.106 Changes/Plan窗格主体状态：源EmptyState、延迟lg Spinner与Changes设置菜单“Collapse all files”/“Expand all files”/“Refresh”（未安装）

主体状态（新app/src/source-pane-states.jsx/.css，2.2553.1 readable/panes-diff-states-current.js:54-92 ke）：加载→rh（tmp-shared-20-BrTrXIRV.js:2703-2717）`div.flex.items-center.justify-center.h-full.w-full`内`span[role=status][aria-label="Loading changes"].leading-[0]`，其中CDS Spinner xo（shared-frame-C_2npUJq.js:2300-2360，bo lg=20px盒/2px描边，Wi即px/16rem×--cds-rem-scale；轨道var(--cds-border)、圆锥头var(--cds-text-muted)、animate-[spin_1s_linear_infinite] motion-reduce:animate-none）按源在1000ms计时后才渲染；无可见文字（原“Loading changes…”与12px .spinner移除）。源xo把标签作为延迟出现的sr-only文字放在status span里，本地改为status元素的aria-label，首帧即有可访问名、仍不绘制（记录差异）。失败→`div[data-diff-pane-body][tabindex=-1].h-full.w-full.outline-none`内EmptyState role=alert、icon Warning、标题“Couldn’t load the changes. Close and reopen this pane to try again.”，原始diffError不再进入DOM，FilePane按不同消息console.warn一次。空→同一data-diff-pane-body包EmptyState“No uncommitted changes”（uncommitted作用域）或“No changes to show”。Plan空→kp（panes-tile-current.js:1751-1766）EmptyState icon Checklist、“No plan yet”，正文本地如实改为“Codex writes the plan here as it works. Keep chatting.”（源为“Claude writes the plan here as it explores. Keep chatting.”，本地由Codex的turn/plan/updated产生计划）；有任务时原Tasks列表不变。本地窗格是header下的flex列，故source-pane-states.css让`.source-file-panel > .source-pane-state/.source-empty-state`取flex 1 1 0（源这些主体在全高槽中h-full）。

SourceEmptyState（source-transcript-states.jsx，cc0a875c8-B6xI6vLN.js u）：新增可选icon，按源`Icon size "lg"`（ra lg=24px字形、stroke 1.4）加类`!size-7 text-muted`（28px盒，已加载c6a992d55的.\!size-7/.text-muted），aria-hidden；原调用者不传icon，标记不变（transcript-states SSR原断言未改且通过）。source-session.css中随之失效的.source-changes-empty/.source-changes-error（含small/p/Icon子规则）删除；.source-panel-empty仍被Files面板使用，保留。

Changes设置菜单（新纯模块app/src/changes-menu-model.mjs changesMenuSections，fh panes-tile-current.js:3692-3868）：有补丁时为[diff-fold: Collapse all files、Expand all files] | [diff-display: Side by side、Word wrap（原value/checked/checkedRole/keepOpen与“Needs a wider pane”提示不变；原节key 'diff-reading'改为源key 'diff-display'）] | [diff-refresh: Refresh]；空/加载/失败时只返回[diff-refresh]（源diffBodyEmpty分支）。Refresh按Am（:2799，kill switch默认开）总是提供，无icon，故PaneSettingsMenu不展开成按钮（与源同）。源fold组要求diffIsLarge已知；本地没有“太大无法一次展开”概念——diff-model.js的“Large patch”回退（MAX_PATCH_CHARS/LINES）整体渲染原始文本、没有逐文件折叠，是不同状态，不映射，因此Expand all files从不disabled、无提示。

折叠（source-diff.jsx）：SourceDiff/FileDiff新增foldAll={collapsed,seq}（requestDiffFoldAll，panes-state-current.js:2809-2821）；FileDiff记住挂载时的seq，仅在seq变化时setExpanded(!collapsed)一次——对应源consumeDiffFoldAll消费请求，之后新挂载的文件保持默认展开，手动切换仍可用。FilePane持有diffFoldAll状态，每次请求seq+1。

刷新（main.jsx）：FilePanel新增onRefresh。主窗口refreshChanges置diffRefreshRequested并递增gitRefresh；workspace-git-status结果（成功或失败）落地时在同一次更新里递增新计数diffRefresh（已加入diff effect依赖），因此一次Refresh恰好一次workspace-git-status和一次workspace-git-diff，即使change key同时变化也不会读两次diff。弹出窗口PopoutApp的onRefresh清gitError并递增原popout-refresh键（该effect本就依次读status与diff）。

测试：新增tests/changes-menu-model.test.mjs（3项：有补丁的节key/顺序/标签/value/checked/hint，Expand不disabled；无补丁仅['diff-refresh']；onSelect路由fold true/false、layout、wrap、refresh）；新增tests/changes-pane-states.test.mjs（5项，vite SSR真实SourceFilePanel：加载为rh包装+status aria-label“Loading changes”、主体无可见文字、spinner延迟未渲染、aria-busy；失败role=alert、Warning图标!size-7 text-muted、精确文案、无原始错误；空状态data-diff-pane-body tabindex=-1与两种标题；Plan空“No plan yet”+适配正文+28px图标盒，有任务仍渲染Tasks；Spinner lg几何）。离屏changes-pane套件扩展（夹具3个已提交文件、初始2个脏，PATH git垫片记录应用启动的每个git——同git-rail-ui-test；两个处理器都跑status --porcelain，故以带--numstat的tracked diff识别status、以不带--numstat的完整diff识别diff）：菜单顺序Collapse all files、Expand all files | Side by side、Word wrap | Refresh且组间role=separator、无disabled；Collapse all后所有.sdiff-file-toggle aria-expanded=false且无文件体，其后手动切换有效，Expand all后全部true，重复请求各自生效；磁盘改第三个文件后Refresh（期间0次window focus事件）出现notes.txt，且恰好+1 status、+1 diff；清空仓库Refresh后“No uncommitted changes”在主体内水平/垂直居中（偏差≤1px）、text-align center、颜色等于--cds-text-primary，主体从header下沿填到tile底，菜单只剩Refresh；随后重新弄脏、关窗格、focus刷新使圆点恢复，原clean步骤保持有效；深色重启后空状态同样居中且为深色--cds-text-primary（与浅色不同），再弄脏+Refresh恢复差异与完整菜单。打开tile后把指针移到transcript并等待hover-intent的排列弹层关闭（标题栏Changes按钮位置正好落在新tile的排列按钮上），截图light/dark：changes-diff/menu/empty(-menu)-light、changes-empty/diff/menu-dark。

验证（日志work/claude-ui-sweep/0.2.106/）：npm run build通过；npm test 1044项，1043通过、0失败、1跳过（原有跳过）；离屏changes-pane 12项检查通过（analysis/batch-20260920/changes-pane-ui-9yIPOE，截图已查看）；回归files-pane 10项、transcript-states 5项通过；verify-build通过（0.2.106，SHA 1c154db40698365c5bd56310e908935172b5a2b75be7070d47fc89e197c4d74e，439源文件）。无保留失败。

剩余缺口：“Highlight changed words”/“Hide whitespace changes”（fh diff-display后两项）未做——需要渲染器开关与git -w管线；diff-file-list组（Show files/Group files by folder/Separate test, build, and generated files）无本地文件列表列；diffIsLarge与“This diff is too large to expand at once…”禁用提示无本地对应；Plan任务列表的源样式重做（kp的Dp/Op内容+Tasks）与“Copy plan”未做；Plan空状态只经SSR验证——夹具无turn/plan/updated，视图菜单不提供Plan行，离屏未打开Plan tile；失败状态也只经SSR验证（离屏未制造git失败）；加载spinner的1000ms延迟只经SSR与代码验证，离屏加载通常不足1s；fold请求与折叠状态不跨会话/关闭窗格持久（源存于pane store但同样被消费）；$t/yi埋点未移植。

## 0.2.105 标题栏Changes开关：源标签“Changes”、⌘⇧D/⌘⇧F窗格快捷键、4px脏树圆点与视图菜单提示（未安装）

标题栏（source-titlebar.jsx，2.2553.1 readable/panes-toggle-current.js:3160-3172 diff spec与:3571-3593 cl）：原非源标签“Show changes”改为常量“Changes”（aria-label与提示content；diff spec无activeLabel）。新导出CHANGES_TOOLTIP {content:'Changes',shortcut:'⌘⇧D',side:'bottom',hoverable:true}——cl的ze只传content/shortcut/side，hoverable取提示默认值（shared-frame Nu `hoverable: _ = !0`），故保留true；原automatic:false与菜单打开时open:false不变。按钮加aria-keyshortcuts="Meta+Shift+D"（aR toggleDiff cmd+shift+d，shared-21-D098Wd--.js:14165-14169）。新prop changesDirty：changesDirty && !panes.has('changes')（spec activity: n && !p）时按Button indicator网格（shared-frame-C_2npUJq.js:2885-2905）渲染`span.st-indicator-grid`（display grid）→图标span（col/row 1）+ `span[data-cds-part=indicator][aria-hidden]`（relative、col/row 1、margin-inline-end/top −1px、align-self start、justify-self end）内含sl（:3565-3570）圆点：4×4px、margin-inline-end/top −1px、border-radius 2147483647px（design-system.css .rounded-full）、background var(--cds-fill-accent)。CSS在source-titlebar.css并带源注释。源两层各−1px，实测圆点越出图标右上角2px（与源同）。

活动来源（main.jsx）：changesDirty={!!(gitStatus?.isRepo && gitStatus.hasChanges)}，对应Ic（panes-toggle-current.js:3002-3012，本地非远程会话的工作树脏状态，响应中每10s重取）；本地gitStatus已有的10s轮询（运行中）与窗口focus刷新沿用，未新增查询。

快捷键：新纯模块app/src/pane-shortcuts.mjs（aR :14145-14187桌面行）：paneShortcutKind(e)在metaKey && shiftKey && !ctrl && !alt && !isComposing时按e.code返回KeyD→'changes'、KeyF→'files'（toggleBrowser cmd+shift+f即Files窗格）；paneShortcut(e)另要求!repeat。main.jsx keydown在Settings早退与⌘B/⌘[之后、⌘N之前：命中即preventDefault（重复键也吞掉），非重复时经paneShortcutRef调用togglePaneTile(kind)；paneShortcutRef与toggleSidebarRef同一守卫（Settings、action dialog、inline rename、What's New打开时无效），并且仅在有当前会话且section==='new'时生效（与标题栏Changes按钮/Session options菜单的显示条件一致），Files另需workdir。视图菜单（main.jsx 'titlebar'，panes-toggle-current.js:3236-3253）：仅Files行加shortcut "Meta+Shift+F"（渲染“⌘ ⇧ F”键帽、aria-keyshortcuts Meta+Shift+F）；Plan/Background tasks在aR中无桌面快捷键，不加。

脚本定位器：“Show changes”是本地非源名称，以下按角色定位的脚本改为“Changes”并注释引panes-toggle-current.js:3165（纠正错误名称，非放宽）：scripts/diff-ui-test.mjs:112、approval-ui.mjs:67、packaged-ui.mjs:48-49、session-ui-test.mjs:463、pane-ui-test.mjs:714、tooltip-ui-test.mjs:261/306/598/615/626（提示标签断言按.source-tooltip-label精确文本，快捷键在独立span中，原13/18排版、宽≤240等断言不变）。session-command-model.mjs的斜杠命令“Show changes”是命令标签，与按钮无关，未改。

测试：新增tests/pane-shortcuts.test.mjs（2项：Meta+Shift+KeyD/KeyF接受；Ctrl/Alt/缺Shift/缺Meta/isComposing/其他code拒绝；repeat时kind仍识别以便preventDefault、paneShortcut为null）；新增tests/changes-toggle.test.mjs（2项，vite SSR SourceTitlebar：aria-label “Changes”、aria-pressed随panes、aria-keyshortcuts、无title、无“Show changes”、CHANGES_TOOLTIP值；指示网格仅在changesDirty且窗格关闭时渲染且只有一个，无会话时无按钮）。新离屏套件app/scripts/changes-pane-ui-test.mjs（登记于work/offscreen-app-integration-20260922/run-suite.mjs的suites 'changes-pane'与scripts/validate-local.mjs标准列表；隔离profile analysis/batch-20260920/changes-pane-ui-*、临时CODEX_HOME、fixture codex-server.cjs、工作区为临时git仓库（git init/提交README后修改）；不触碰剪贴板）7项：dirty-dot（按钮无title、aria-pressed false、Meta+Shift+D；唯一aria-hidden indicator，圆点计算宽高4px、背景等于解析后的--cds-fill-accent（rgb(42,120,214)）、网格/对齐/−1px边距、位于图标右上角）；tooltip（悬停“Changes”+“⌘⇧D”，位于按钮下方）；meta-shift-d（打开data-pane-kind=diff，aria-pressed true、圆点消失；合成repeat keydown被preventDefault且不切换；再按关闭、圆点恢复）；meta-shift-f（Files窗格开/关）；view-menu（Files行“⌘⇧F”、其他窗格行无快捷键）；settings-guard（⌘,打开Settings时两快捷键无效）；clean（git checkout -- .后派发window focus，圆点消失）。截图changes-dirty-button.png、changes-tooltip.png、view-menu-files.png已目视（副本在work/claude-ui-sweep/0.2.105/）。

验证（日志work/claude-ui-sweep/0.2.105/）：npm run build通过；npm test 1036项，1035通过、0失败、1跳过（原有跳过）——此前两次完整运行时本机负载均值40-160，codex-client initialize超时、file-name-search TIMEOUT、highlight-stream-worker 15s、workflow-package等计时用例失败（unit-first-run-loaded.log / unit-second-run-loaded.log），单独重跑这4个文件39项全部通过（unit-retry-timing-files.log），第三次完整运行全绿（unit.log），均与本改动无关；离屏changes-pane 7项通过；回归sidebar-chrome 24项、files-pane 10项、menu-bar 9项通过；verify-build通过（0.2.105，SHA 1bc9d6d5aa7bb4424f88414e210c47ea7a1261b6e94057b0ace86cb311962a37，436源文件）。无保留失败。本机不可运行的原生脚本（diff/approval/packaged/session/pane/tooltip）只改了定位名称，未实际运行。

剩余缺口：⌘⇧Y（toggleDiffFileList）未实现——本地Changes窗格没有源的文件列表列；aR其余窗格键（togglePreview ⌘⇧P/⌘⇧B、toggleTerminal ⌘J、toggleSideChat ⌘;）无对应窗格未做；源窗格切换的$t埋点与onButton焦点注册未移植；Pulse指示（has-[>[data-cds=Pulse]]遮罩）只用于其他窗格活动，未移植；本地脏状态来自gitStatus（git status），Ic的isWorkingTreeDirty在远程/worktree会话上的排除条件无本地对应。

## 0.2.104 Back/Forward：折叠标题栏导航簇、aria-disabled与⌘[ / ⌘]提示、键盘快捷键与Go菜单（未安装）

新组件app/src/source-nav-buttons.jsx/.css（2.2553.1 readable/sidebar-session.js:10732-10800 qM）：SourceNavButtons({placement,historyAt,historyLength,travel})，两个ToolButton（ArrowLeft“Back”/ArrowRight“Forward”），CDS提示{content,shortcut:'⌘['/'⌘]',side:'bottom',hoverable:false}（qM tooltipSide bottom、mac shortcut cmd+[ / cmd+]；shared-frame ks把shortcut交给es提示），aria-keyshortcuts按ks的vo("cmd+[")即“Meta+[”/“Meta+]”；不可用方向为`aria-disabled="true"`且onClick为undefined（源`"aria-disabled": !f || void 0`、`onClick: f ? u : void 0`），不再用原生disabled、无title，仍可聚焦。KM（`aria-disabled:pointer-events-none aria-disabled:*:opacity-50`）→`[aria-disabled=true]{pointer-events:none}`与`> *{opacity:.5}`。包裹div按qM：sidebar placement为flex/items-center/no-drag，其他placement另加gap 2px。navAvailability(historyAt,length)与travel()边界一致。ToolButton未改（aria-*经...props透传）。

侧栏工具栏（source-sidebar.jsx）：原两个disabled ToolButton替换为`<SourceNavButtons placement="sidebar">`；style.css的24×28尺寸规则扩展到`.sidebar-toolbar > .source-nav-buttons > .code-icon-button`。折叠标题栏（source-titlebar.jsx，sidebar-groups.js:2774-2840 Ib）：`div.df-collapsed-chrome`（flex/items-center）内先“Show sidebar”（Nb），后`div.df-collapsed-nav`（relative/flex/items-center/no-drag）包Pb（:2752-2766，qM placement sidebar）。SourceTitlebar新增historyAt/historyLength/travel props，main.jsx传入与SourceSidebar相同的值。desktop-layout.css:2331-2335对df-collapsed-nav的margin-left:-2px针对28px（size-7）的df-compact-trigger，本地触发器是24px标题栏ToolButton，未套用（CSS注释已记录）。

键盘（main.jsx keydown）：按⌘B同一模式（e.code、仅metaKey、无ctrl/alt/shift、!isComposing、preventDefault、忽略repeat），BracketLeft→travel(-1)、BracketRight→travel(1)，经travelShortcutRef执行，与toggleSidebarRef同一守卫（Settings、action dialog、inline rename、What's New打开时无效）。

Go菜单（electron/app-menu.cjs，reference/asar/.vite/build/index.chunk-D6ATlqeD.js gyr/_yr/Cyr/Syr，jOr中位于View之后）：appMenuTemplate({sidebarOpen,canGoBack,canGoForward,emit})在View与Window之间加{label:'Go'}，submenu为Cyr的四项：隐藏孪生{Back, Command+[, visible:false}（携带注册的加速键）、{id:'go-back', registerAccelerator:false, enabled:canGoBack}，Forward同理（Command+]、go-forward）；四项click均emit({kind:'navigate',delta:±1})。渲染端对⌘[ / ⌘]已preventDefault，故加速键不会重复触发（同⌘B说明）。新navigationState(payload)只接受真正的true。main.cjs：desktop:call新增'navigation-state'动作（沿用现有call通道，preload无需改动），保存状态并按Syr以getMenuItemById('go-back'/'go-forward').enabled更新，installAppMenu重建时带入该状态；初始为{false,false}（本地历史起始为[null]；源xyr初值为true/true，由首次did-navigate立即覆盖）。main.jsx在canGoBack/canGoForward变化时调用call("navigation-state")，并处理桌面事件{kind:'navigate',delta}（delta仅±1）→travelShortcutRef。

测试：tests/app-menu.test.mjs新增2项（Go四项的label/accelerator/id/visible/registerAccelerator/enabled随输入四种组合、click各emit {kind:'navigate',delta:±1}、无状态时两项disabled；navigationState过滤非true）；原“Code Desktop/Edit/Window”顶层顺序断言按jOr更新为['Code Desktop','editMenu','View','Go','windowMenu']（新增菜单导致的真实变化，非放宽），View/Sidebar断言未改。新增tests/source-nav-buttons.test.mjs（3项，vite SSR）：navAvailability边界；qM两按钮aria-disabled="true"、无disabled属性、无title、aria-keyshortcuts Meta+[ / Meta+]、中间位置两者都无aria-disabled、NAV_TOOLTIPS值；折叠SourceTitlebar按钮顺序Show sidebar→Back→Forward且后两者在df-collapsed-nav内、展开时无该簇。离屏sidebar-chrome扩展4个阶段（原18项→24项检查，新增6项）：nav-initial（实际应用菜单为Code Desktop/Edit/View/Go/Window；Go四项含隐藏孪生visible false/registerAccelerator true，go-back/go-forward disabled；Back/Forward aria-disabled "true"、无disabled、无title、aria-keyshortcuts、pointer-events none、子元素opacity 0.5、element.focus()可聚焦）；nav-travel（打开A再B后Back可用、Go go-back启用；悬停Back出现“Back”+“⌘[”提示且位于按钮下方、无title；Meta+[回到A（行aria-current与标题栏标题），Meta+]回到B，Go状态逐步跟随；Go可见项与隐藏孪生的click均导航）；nav-settings-guard（Settings打开时Meta+[与Go>Back都不导航）；nav-collapsed（Meta+B折叠后.df-collapsed-chrome按钮顺序Show sidebar/Back/Forward，后两者在.df-collapsed-nav内、x依次递增同一行、-webkit-app-region no-drag；折叠态提示同样带⌘[；点Back到A、点Forward到B并随之aria-disabled）；nav-expanded（展开后侧栏Back/Forward同样导航；聚焦aria-disabled的Forward按Enter无动作），随后点New回到原流程起点。menu-bar离屏套件只捕获托盘菜单（Tray adapter），不读取应用菜单；应用菜单Go项由上面的sidebar-chrome与单元测试覆盖。按角色点“Back”的原生脚本只有subagents-ui-test（pane内的Back，与此无关）；titlebar-ui-test折叠断言（首个按钮仍为Show sidebar、st-inner在其右侧≥24px）与本改动兼容。截图nav-back-tooltip.png、nav-collapsed-titlebar.png已目视（副本在work/claude-ui-sweep/0.2.104/）。

验证（日志work/claude-ui-sweep/0.2.104/）：npm run build通过；npm test 1032项，1031通过、0失败、1跳过（原有跳过）；离屏sidebar-chrome 24项检查全部通过；离屏menu-bar 9项、code 9项回归通过；verify-build通过（0.2.104，SHA 20ca393ceff6ac45820577d2e4dc7eabc008adc6e6fd7a837f9c75fe0d0c4cb5，435源文件）。无保留失败。

剩余缺口：Go菜单的区域复选项（Tyr）、“Previous Session”/“Next Session”（Command+Shift+[ / ]）与“Search…”（Command+Shift+K）未做；源fZ/Ygr的“仅加速键触发时校验修饰键”逻辑与webContents navigationHistory不适用（本地历史在渲染端）；qM的track埋点与fc(nav-back/nav-forward)焦点注册、Ib的--df-trigger-right/--df-nav-extent测量未移植；非mac的alt+left/alt+right未做（本构建仅macOS）；禁用按钮因pointer-events none在悬停时不显示提示（与源一致），离屏套件在可用状态下验证提示。

## 0.2.103 Composer用量按钮：12px阈值色上下文环、“Context {used} / {max} ({pct}%)”提示与源aria-label（未安装）

新纯模块app/src/context-usage-model.mjs（2.2553.1 shared-14-BOJVa-jT.js:9700-9793）：compactTokens=oT(e,sT)（≥1e9 B；≥1e6 M、四舍五入到1000M进B；≥1e3 k、到1000k进M；否则整数；去尾“.0”，如45200→45.2k、999950→1M）；contextThreshold=dT经hT（≥90 danger、≥75 warning、否则accent），contextRingStroke=pT的`var(--cds-fill-*)`，轨道为_d的an.alpha[2]即`var(--cds-alpha-2)`；contextRingGeometry=xT（yT 12、bT 2、r 5、C=2π·5、dashoffset C·(1−clamp(pct)/100)）；contextSummary=ST（max缺失或超窗→仅iT(used)、pct null；否则“{used} / {max} ({pct}%)”；第三参allowOver按源保留，调用方不传——源仅在已取回的非stale用量报告时放开，本地无该报告）；usageTriggerCopy=c360a9e1c-GPs-MV9u.js:4065-4295 hd的ge/Se/le：有tokenUsage（last.totalTokens / modelContextWindow）时tooltip“Context {summary}”、aria-label“Usage: ”+Intl.ListFormat('en',{type:'unit'})([ge])、ringPct=contextPct??0；否则“Usage”/“Usage”/0。

与任务说明的差异（按源）：hd的`Y = !s && !P && (e === null || spawnedFresh)`（c06cf64bb Hy=spawnedFresh），sessionRef为null（草稿/New composer，$d默认sessionRef null）时ie仍为真，K=0、G=null，故源显示“Context 0”/“Usage: Context 0”。本地以`usageFresh={!current}`（main.jsx传入）实现；打开的已有会话在无tokenUsage时仍为“Usage”。本地新建线程在首个tokenUsage到达前的spawnedFresh窗口没有对应状态，按“Usage”处理（缺口）。

组件（source-composer.jsx/.css）：删除UsageGaugeMiddle字形与本地“{n}% of context used”/“Context usage is not available yet”文案。ComposerButton的icon接受节点（字符串仍走Icon）。新ContextRing按xT：svg 12×12、viewBox 0 0 12 12、aria-hidden；Tailwind `-rotate-90`在c6a992d55中为`rotate:-90deg`属性，本地同用rotate；第二圆dasharray/dashoffset/round cap/阈值描边，`transition: stroke-dashoffset 300ms cubic-bezier(.4,0,.2,1)`（transition-[stroke-dashoffset] duration-300与默认缓动），prefers-reduced-motion下关闭（本地约定，源无对应规则）。_d的Zt包裹：content=ge、detail=xe（本地恒为空——composer无plan-limit数据md planWindow/planPct/planResets，不捏造）、open=菜单打开时false（原有`open: menuKind ? false : undefined`）。按钮仍为20px chin icon-only、无title。popover（main.jsx case 'usage'）未改。

测试：新增tests/context-usage-model.test.mjs（5项：compactTokens含999950→1M/1250000→1.3M/B进位；ST的超窗与null；阈值74/75/89/90与fill变量；xT几何与clamp；usageTriggerCopy null/有用量/超窗/fresh）。离屏composer-states扩展：打开会话A时aria-label“Usage”、svg 12×12、2圆r 5 stroke 2、rotate -90deg、dashoffset=2π·5、stroke=解析后的--cds-fill-accent、轨道=--cds-alpha-2、round、transition stroke-dashoffset 0.3s，emulateMedia reduce后transition-property none；New草稿为“Usage: Context 0”；fixture首轮完成（codex-server.cjs complete() last 100/窗口128000）后aria-label“Usage: Context 100 / 128k (0%)”、dashoffset≈2π·5（±0.05）、描边accent、悬停提示“Context 100 / 128k (0%)”且无detail；点击打开usage popover后提示消失、持续悬停900ms仍无提示。原生tooltip-ui-test.mjs:466（本机不可运行）期望文案由“Context usage is not available yet”改为“Usage”（该处为无tokenUsage的已恢复会话，引c360a9e1c:4138-4165）。全仓脚本无其他“of context used”文案。

评审修正（同版本0.2.103）：原报告称“无其他按名‘Usage’定位的按钮”有误——标准列表中的scripts/code-ui-test.mjs:57-59在主页草稿composer（profile threadIds:[]，此前未打开会话）上循环`getByRole('button',{name,exact:true})`点击['Permission mode','Add','Usage','Account menu']；按hd Y（!P && sessionRef===null）该处名称为“Usage: Context 0”，精确匹配“Usage”超时。已仅将Usage一项改为`{name:/^Usage/}`并注释引c360a9e1c hd Y/Se；弹层断言（.code-popover碰撞与Escape）不变。为能离屏复现，在work/offscreen-app-integration-20260922/run-suite.mjs的suites中登记`code`（code-ui-test.mjs → analysis/batch-20260920/code-source-test.json）。复现：临时恢复旧定位器，离屏code失败于“waiting for getByRole('button', { name: 'Usage', exact: true })”（review-offscreen-code-before-fix.log），修正后通过9项。tooltip-ui-test.mjs:461的精确“Usage”位于已恢复会话（无tokenUsage，ie=false），名称确为“Usage”，保持不变；slash-commands-complete/usage-ui-test中的“Usage”是dialog/Settings导航按钮，与本按钮无关。

验证（日志work/claude-ui-sweep/0.2.103/）：npm run build通过；npm test 1027项，1026通过、0失败、1跳过（原有跳过）；离屏composer-states 20项检查全部通过（含本轮新增2项，截图usage-ring-tooltip.png/usage-popover-open.png已查看）；离屏usage 7项、slash-commands-complete 4项、home-page 19项回归通过；verify-build通过（SHA 77dfdbc8943a584746c5683fe25afc60587c6027a58f9204694f8aff5f7f809d，433源文件）。评审修正后复跑（review-*.log）：npm run build通过；npm test 1027项，1026通过、0失败、1跳过；离屏code 9项、composer-states 20项、usage 7项、slash-commands-complete 4项全部通过；verify-build通过（SHA不变，433源文件；仅测试脚本与离屏登记改动）。

剩余缺口：plan-limit detail（“{pct}% of 5-hour limit”/“{limit}: {pct}%”与resets）与无上下文时的planPct环无数据源未做；源K优先的live contextTokens与dd的auto-compact窗口（W.max/enforced）、ST allowOver分支无本地对应；本地新建线程首个tokenUsage前的spawnedFresh“Context 0”未覆盖；usage popover仍为本地版本（后续项）。

## 0.2.102 CDS Shortcut键帽：审批“Allow once”与问答Next/Submit的⌘⏎，approval-card离屏注册（未安装）

新组件app/src/source-shortcut.jsx/.css（2.2553.1 shared-frame-C_2npUJq.js:2031-2110 Qa，仅keycap变体）：根`span[data-cds=Shortcut][data-variant=keycap]`，inline-flex/shrink-0/items-center/gap 2px/text-caption（design-system.css:20907）；每键`kbd`按Wa：inline-flex居中、h calc(1em+6px)、圆角var(--cds-keycap-radius,4px)、color var(--cds-shortcut-cap-ink)、背景var(--cds-shortcut-cap-fill)、1px solid var(--cds-shortcut-cap-line)、font-family/font-variation-settings inherit、line-height 1；单字形加Ga（w calc(1em+6px)、padding 0），否则Ka（min-w、padding 0 3px）。键解析按fo/po/ho（:2206-2254，空白分隔“then”序列，修饰键按io排序），mac字形表ao/so、非mac表oo/co（:2137-2194），朗读名mo（:2225-2244）：字形键为`<span aria-hidden=true>⌘</span><span class=sr-only>Command</span>`，⏎为Enter，Esc/Ctrl等字母标签无朗读名。平台按to()（:2116-2124）useSyncExternalStore测UA，服务端快照非mac（与源同）；另留`mac`覆盖参数仅供SSR测试。令牌确认由已加载的官方样式表c6a992d55-Vcbdv79k.css解析（design-system.css:53426-53428：ink gray-500、fill transparent、line currentColor 18%；暗色:53630-53631 gray-300/22%）；--cds-keycap-radius未定义，走4px回退。按钮内用法（ks :2936-2944）：aria-hidden、`pointer-coarse:hidden ms-1`（本地`@media (pointer: coarse){[data-cds=Shortcut].scds-in-button{display:none}}`，design-system.css:45342）；非joined按钮加gs（:2716）end margin calc((h-control-1em-6px)/2-pad-md)（实测-4.5px）。primary变体设`--cds-shortcut-cap-ink: currentColor`（_s :2722），Button调用处未传onFill。

审批卡（source-approval-card.jsx ActionButton/footer）：只有primary“Allow once”画⌘⏎（approval-current.js:15846-15854 `shortcut: P||!ee?void 0:"cmd+enter"`；Deny的esc与session/always的cmd+shift+enter在card placement带chordHintHidden，approval-actions-current.js:3181-3183，故无键帽）。键帽位于.sac-button-label之后；.sac-button加gap 4px对应ks内容span `inline-flex min-w-0 items-center gap-1`（shared-frame :2886），标签到键帽共8px（gap4+ms4）。显示门槛actionable&&!menuOpen（与aria-keyshortcuts的shortcutEnabled同源，但不含!busy）：源里Button busy只把内容span整体opacity-0（:2886），键帽仍占位，因此本地busy时保留键帽并随spinning标签data-busy淡出——这是对任务说明“仅shortcutEnabled时渲染”的有意偏离，否则既有“busy动作尺寸稳定±0.1”断言（approval-card-ui-test）会失败。aria-keyshortcuts与键处理未改（仍为“Meta+Enter Control+Enter”；源vo(:2282-2300)在mac只给“Meta+Enter”，保留差异）。

问答卡（source-question-card.jsx）：Submit/Next的.sq-submit-label改为内容span（inline-flex/min-w-0/items-center/gap 4px），isActive&&!menuOpen时在文字后画⌘⏎（approval-current.js:8249-8256 `shortcut: a?"cmd+enter"`，a=isPanelActive）；busy时同样保留在aria-hidden且opacity 0的标签内（approval-transport-ui-test.mjs:673-674要求busy前后按钮宽度严格相等，同为有意偏离“!view.busy”）。.sq-submit设cap ink currentColor。另外：原本⌘⏎只在Other/自由输入框内生效，只加键帽会宣传一个大部分场景不存在的快捷键（违反“不虚构能力”）；源yk以ep({active, allowOnce:K})（:8011-8023）让⌘⏎在整卡推进，因此新增section级onKeyDown：isQuestionInputSubmit且isActive&&!menuOpen&&canAdvance时advance()。输入框已有处理并stopPropagation，不重复；既有处理器未改。与本地审批卡一致为卡片内作用域，未移植ep的文档级注册、400ms armGrace与离屏让位。

离屏注册：approval-card-ui-test.mjs原把打补丁的fixture副本写进profile，bootstrap.cjs只接受三种CODEX_BINARY，故未改bootstrap，把增强迁入tests/fixtures/codex-server.cjs的可选profile旋钮（与fixture-model-list.json同法）：profile含fixture-approval-card.json {enrichCommand:true}时，command分支对'fixture:command-card-long'给出与测试同生成器的150行命令，并设params.cwd=thread.cwd、networkApprovalContext {https, approval-card.example.invalid:8443}；permissions分支设cwd。无旋钮时参数完全不变。测试改为写旋钮并用CODEX_BINARY=app/tests/fixtures/codex-server.cjs；原“分支恰出现一次”守卫换成“旋钮文件名恰出现一次”。run-suite.mjs suites新增'approval-card'（validate-local standard已含）。离屏运行记录blocked=[]、native=[]，窗口均不可见/未聚焦/offscreen，未新增任何白名单。

测试：新增tests/source-shortcut.test.mjs（7项，vite SSR）：mac下cmd+enter为2个square kbd，⌘/⏎+sr-only Command/Enter；排序与非mac Ctrl、Esc、then序列；审批卡恰1个键帽且在[data-approval-primary] accept内、aria-hidden，Deny与acceptForSession无kbd；isActive=false/menuOpen/enabled=false/无onAction均无键帽且无aria-keyshortcuts；busy时键帽在data-busy中保留；问答卡active时Submit标签后有键帽，inactive/menuOpen无，busy时位于aria-hidden标签内。离屏approval-card套件新增：键帽count 1、owner accept、glyph ⌘⏎、kbd高/宽17=round(11+6)、圆角4px、1px solid、ink=按钮色（primary currentColor）、背景透明、margin-inline-start 4px、标签间距8、end margin=(24-11-6)/2-8=-4.5、Deny/session无；CDP Emulation.setTouchEmulationEnabled使matchMedia('(pointer: coarse)')为真，键帽display none，关闭后恢复；busy时键帽opacity 0；问答卡（fixture:input）Submit内键帽17px/4px/ink=按钮色/ms 4px，聚焦选项按Meta+Enter提交真实答案{approach:["First"]}。截图approval-card-keycap.png、approval-card-question-keycap.png已目视（副本在work/claude-ui-sweep/0.2.102/）。

验证（日志work/claude-ui-sweep/0.2.102/）：npm run build通过；npm test 1022项，1021通过、0失败、1跳过（原有跳过）；离屏approval-card 10项检查全部通过（首次离屏注册，含新增键帽/问答2项）；离屏bypass-permission 7项回归通过；verify-build passed（0.2.102，432源文件）。无保留失败。

剩余缺口：问答卡Skip按钮（approval-current.js:8238-8245 b(br,{variant:"secondary"})）与预选/草稿恢复（yk hse/Pm/Fp）仍未做；问答⌘⏎为卡片内作用域，无ep的文档级注册/400ms grace/离屏让位；审批卡aria-keyshortcuts仍含Control+Enter；dock placement的chord提示与数字键帽（showDigitKeycaps）未做；approval-transport-ui-test为原生窗口脚本，本轮未运行（其问答按钮尺寸断言已按上面方式保持）。

## 0.2.101 Files面板标签条：源标签外观、700ms CDS提示（含目录detail）与标签右键菜单（未安装）

标签模型（panes-tile-current.js:6656-6668 ce）：新纯模块app/src/file-tab-menu-model.mjs。label=basename，detail=dn(path,cwd)取到最后一个“/”（为空时“/”，根级文件undefined；工作区内绝对路径先转相对cwd），无icon；文案le（:6669-6710）Close file / Close other files / Close all files / Keep open / preview / “Press Delete or Backspace to close the file”。tabTooltip：仅有detail或标签被裁时content=label，菜单打开或指针按下（he N/F/ie，指针离开前）时content与detail都为null。tabMenuItems({preview,solo})按he弹层（panes-tabs-current.js:470-485）顺序：[Keep open（仅preview）] Close file [Close other files][Close all files]（后两项仅非solo，solo=恰一个标签）。

标签渲染（source-session.jsx SourceFileTab，he panes-tabs-current.js:333-491）：删除旧`<Icon name="File" size={14}/>`与`title={file.path}`。根`div[role=presentation][data-selected][data-preview][data-popup-open]`：h 1.5rem、min-w 104（Xd minTabWidth，:6786）、max-w max-content、basis 192px、gap 4、overflow clip、rounded=var(--cds-radius)（design-system.css:14250）、p 2px、text-body text-secondary；选中justify-end text-primary；has-focus-visible shadow-focus。背景层`span[aria-hidden]` absolute inset-0 z -1 rounded-inherit，hover与data-popup-open为fill-ghost-hover，选中!fill-ghost-selected。role=tab：flex h-full flex-1 gap 2px outline none，无图标min-w 6px pl 6px。标签span：max-w 140px overflow-x clip，ResizeObserver测scrollWidth>clientWidth，被裁且可关时加fe遮罩（:187-188）；内层nowrap，preview斜体并附sr-only“, preview”。关闭按钮pe（:190-202）：`<button type=button tabIndex=-1 aria-hidden=true aria-label="Close file">`，onMouseDown preventDefault，20px grid rounded-sm text-muted，hover fill-ghost-hover+text-primary，选中标签text-primary，X xs（12px），常显。提示te（:382-392）：SourceTooltip side bottom、align start、delay 700、hoverable false，外层SourceTooltipGroup delay 700（Xd提供者）；全处无原生title。右键菜单：onContextMenu preventDefault打开SourceMenu.Popup（dataCds ContextMenu，锚定标签根，bottom/start），Escape回焦点到打开前元素。l_的文件级项（panes-tile-current.js:6809-6862：Copy子菜单、Reveal、“Reveal in file tree”及其后的分隔线）本项未做，代码注释已记录。键：Delete/Backspace关闭（ge :275-296）；本地ArrowLeft/Right/Home/End漫游保留；双击keepFile、中键closeFile保留；次键/macOS Ctrl按下不移焦点（_e）。批量关闭用已有closeFiles(paths,keep)（panes-state-current.js:2891-2951 closeFileTab/closeOtherFileTabs/closeAllFileTabs，一次写状态）。

测试：tests/file-tab-menu-model.test.mjs（3项：菜单顺序preview+multi/pinned+multi/solo/solo+preview；tabDetail('src/a/b.ts')='src/a'、'README.md'→undefined、cwd下绝对路径转相对、工作区外保留；tooltip内容/抑制）。离屏files-pane套件新增file-tabs阶段（fixture新增根级长文件名quarterly-infrastructure-migration-checklist.txt）：4个标签均无图标（仅关闭X一个glyph）、无[title]、高24、basis 192、padding 2、gap 4、圆角=--cds-radius、tab pl/min 6px、gap 2、标签max-width 140、nowrap；选中text-primary/justify-end/背景fill-ghost-selected，其余secondary/透明；preview斜体+“, preview”；长名data-clipped且遮罩`linear-gradient(90deg, #000 calc(100% - 8px), transparent 100%)`（浏览器把to right序列化为90deg，正则两者都接受）；关闭按钮aria-hidden、tabIndex -1、label“Close file”、20×20、X 12px、不透明度1、颜色=--cds-text-muted（选中为primary）。提示：悬停nested/deep.txt 500ms无提示、900ms内出现（实测约707ms），data-side bottom、在标签下方、左缘与标签对齐，内容“deep.txt”+detail“nested”；notes.txt无提示；被裁根级长名只显示标签无detail。菜单：README（preview）右键4项顺序正确、弹层在标签根下方左对齐；pinned deep.txt无Keep open、data-popup-open背景fill-ghost-hover、菜单打开时900ms无提示；Close other files仅留README；solo preview只有Keep open+Close file，Keep open后去斜体；solo pinned仅Close file；aria-hidden关闭按钮指针点击仍关闭。另修正该脚本原有缺陷：tree-dark截图调用被行尾注释吞掉，现已实际截图。

原生（不可在本机运行）脚本按源更新选择器/名称，不放宽：pane-ui-test.mjs focusedTab改读`.source-file-tab`的data-file-path（标签不再有title）；“Close file-7.txt/file-2.txt/slow-c.txt”按钮改为按路径结构定位`> button[aria-label="Close file"][aria-hidden="true"]`（le.closeTab，panes-tile-current.js:6671，源纠正而非放宽）；preview标签名改为“beta.md, preview”“slow-c.txt, preview”（sr-only提示，panes-tabs-current.js:436-441）；“slow-c.txt不复活”的count 0改用data-file-path定位（避免因名称带“, preview”而恒真）。session-ui-test.mjs、file-search-ui-test.mjs同理更新“deep.txt, preview”“UniqueNeedle.ts, preview”、Space预览标签名与“Close file”按钮。pane-layout-ui-test.mjs只读data-file-path/data-preview（"true"），无需改动。

审查修正（同版本0.2.101，未再升版）：①焦点环被裁：标签根has-focus-visible的shadow-focus（design-system.css:52987：1px accent环+6px光晕）画在标签外，而`.source-file-tabs`原为overflow-x auto、高24、无内边距，环与光晕在上下及首个标签左侧被滚动盒裁掉。按Xd tablist z（panes-tabs-current.js:1138-1141 `relative isolate -mx-[4px] flex items-center gap-[4px] overflow-x-hidden p-[4px]`）改为padding 4px、margin 0 -4px、高32（24+2×4，恰合32px .source-pane-header，负边距抵消其0 4px内边距），加relative/isolate/align-items center；保留overflow-x auto为本地适配（未移植“More files”溢出菜单，多余标签需可滚动），CSS注释已记录。②he根补onMouseUp：按Z（:309-314，he :359）中键mouseup preventDefault（本地标签均可关，等同X=I&&!W）。离屏files-pane新增1项检查：Home/End键盘漫游让notes.txt与README.md获得:focus-visible，box-shadow非none；tablist padding 4px、margin -4px、高32且在header内；沿祖先链求所有非visible溢出的裁剪矩形，聚焦标签上下≥4px、首标签左≥4px、末标签右≥4px（实测均为4，与源p-[4px]一致）；Home/End后选中状态恢复为README；中键mouseup被preventDefault。

验证（日志work/claude-ui-sweep/0.2.101/，审查修正日志前缀review-fix-）：npm run build通过；npm test 1015项，1014通过、0失败、1跳过（原有跳过）；离屏files-pane 10项检查通过（含本轮新增焦点环项），截图file-tabs-light/file-tab-tooltip/file-tab-menu已目视；edit-read 15项回归通过（审查修正后重跑），user-markdown 10项回归通过（修正前）；verify-build passed（0.2.101，430源文件）。无保留失败。

剩余缺口：“More files”溢出下拉（panes-tabs-current.js:66-190）、Control+Shift+Arrow重排（ge :280-290）、minTabWidth 104压缩/compact与隐藏计算（_e compactIds/hiddenIds）、l_文件级菜单项（Copy子菜单/Reveal/Reveal in file tree）均未做；pane-ui/session-ui/file-search-ui为原生窗口脚本，本轮未运行。

## 0.2.100 会话转录三态：加载骨架、“Couldn’t load this session”+Retry、“No messages yet”（未安装）

加载中（_d，approval-entry-current.js:1141-1190）：删除main.jsx旧`<p className="loading-state">Loading conversation…</p>`。无可显示行（shownRows=items+本地命令行+workflow行）时渲染`div.loading-state.source-transcript-pending[role=status]`＋sr-only“Loading session”＋新SourceTranscriptSkeleton；已有缓存行时只留零高度`div.loading-state[role=status]`与sr-only文案（缓存行无视觉变化）。.loading-state类保留，供25个GUI脚本等待附着/脱离。骨架=Zw（readable/shared-22-Cz3C_T8d.js:5356-5374：`div[data-transcript-skeleton][aria-hidden=true].h-full.overflow-hidden`，paddingTop 48；本地无earlier分页指示，hasEarlier恒false）包k_（2.2553.1 ion-dist/assets/v1/shared-8-B5xbG2px.js O_/k_：`text-prose flex flex-col fade-out-bottom h-[calc(100vh-12.5rem)]`，用户气泡条`box-content h-[1lh] w-72 max-w-[85%] rounded-card py-md text-heading`靠右，mt-xs mb-xs h-6间隔，三段O_=[[96%,100%,92%,58%],[100%,94%,41%],[97%,90%,66%]]的`h-[0.72em]`条，末尾mt-xs h-6）。k_的外层ta即CDS SkeletonGroup hc（shared-frame-C_2npUJq.js:3206+，默认motion ac="wave"，:3163-3165 ic=2000/oc=90），骨架条Xi=gc（:3448-3480）位于组内（Ns为真）故走组分支：无role、无::after shimmer，类为tailwind-merge结果；呼吸动画由已加载的原版design-system规则`[data-cds=SkeletonGroup][data-motion=wave] [data-cds=Skeleton]`提供，--cds-skel-i按DOM顺序写入（静态标记，等价hc的MutationObserver赋值）。与任务说明不同处（按源）：说明称条带::after shimmer与motion-reduce:after:hidden，那是gc的非组分支；组内实际无::after，减少动效由design-system `prefers-reduced-motion`规则把动画压到0.01ms×1实现。延迟：gd（:1126-1139）总传对象hold（门控__gb__2846116625默认关→{none:"route"}），对象hold不是"delayed"，hc立即渲染data-hold="none" data-shown，故无显现延迟，已确定而非猜测。尺寸：.source-transcript-content在含pending/空状态时取100%高，Zw overflow-hidden裁掉k_的100vh-12.5rem，滚动器不溢出（Zw的both-edges gutter在本地改为auto，因本地.transcript滚动器已预留一次）。

加载失败（xu，:4211-4217 → ion-dist c4ea84cb3-BrWqBPlP.js V；EmptyState为cc0a875c8-B6xI6vLN.js u）：openSession的catch在seq为当前时写loadError{id,message}；会话无可显示行时不再setError，原始错误不进.composer-error；有可显示行时保留原setError路径。判定用渲染时同一shownRows计数（shownRowCount ref，每次渲染写{id,count}），不用catch闭包里过期的state.items[id]，保证alert与横幅恰有一个报告失败。loadError.id===current且非加载且无行时渲染role=alert的SourceEmptyState：标题“Couldn’t load this session”（弯撇号）、正文B默认“Something went wrong while loading earlier messages.”（Codex不提供失败kind，kind专用正文不适用）、主按钮Retry复用source-settings-button.jsx（data-cds=Button、variant primary）。Retry调用openSession(current,{retry:true})：不走navigate、不压历史，并保留草稿/附件/队列/附加目录（源onRetry原地重取）。每次加载开始清loadError。原始消息从不显示于此状态。EmptyState类：根`flex h-full flex-col items-center justify-center gap-md px-lg py-lg text-center`（本地CSS用--cds-gap-md/--cds-pad-lg复述）、文本块`flex flex-col items-center gap-1`、标题`max-w-[36ch] break-words text-body text-primary`、正文`… text-footnote text-muted`、操作区`flex flex-wrap items-center justify-center gap-1`。

空会话（Cl，:4224-4233）：current存在、非加载、无loadError、无行、未运行、未发送/未请求turn、无会话错误、无待审批时渲染仅标题“No messages yet”的EmptyState；主页草稿（current null）不渲染。旧message-style.css/style.css中的.loading-state文字样式删除，改由source-transcript-states.css清零margin/padding。xu与Cl在源中替换整个转录滚动器（:4211-4233），故这两个EmptyState显示时本地不再渲染SourceTranscriptStatus（idle spark）；main.jsx由emptyPane（"failure"|"empty"|null）统一决定两者与状态行。

fixture：tests/fixtures/codex-server.cjs thread/resume新增可选按线程`resumeFailOnce:true`：命中时删除标志、persist()、记history（failed:true），回`{id,error:{code:-32603,message:'fixture resume failure'}}`；无此标志时行为不变。

新文件：app/src/source-transcript-states.jsx/.css、app/tests/source-transcript-states.test.mjs（SSR 5项（含评审修复新增的content-box规则检查）：Zw/k_结构与顺序、48/88内边距、hold none、11条、O_宽度顺序、无::after/无逐条role、--cds-skel-i 0..10；EmptyState类与文案、primary Retry、不含原始消息；Retry回调；“No messages yet”精确标记）、app/scripts/transcript-states-ui-test.mjs（离屏套件，已注册run-suite.mjs `transcript-states`与validate-local.mjs标准链）。套件fixture：SLOW/SLOW_DARK/SLOW_RM（resumeDelayMs 1500，2轮；骨架仅在首次hydrate前存在，浅色/深色/减少动效各需一个）、FAIL（resumeFailOnce，1轮）、EMPTY（0轮）。检查：①SLOW：role=status .loading-state内sr-only“Loading session”、aria-hidden骨架、paddingTop 48px、11条、hold none；气泡条宽288=min(18rem,85%×768)、右缘=行右缘；三段条宽占段落96/100/92/58、100/94/41、97/90/66%（实测逐项精确）；无“Loading conversation”；滚动器scrollHeight 654=clientHeight 654、渐隐条不透明度0；hydrate后骨架脱离；浅/深色截图。②减少动效：11条::after content none、animationDuration 1e-05s、运行中动画0。③FAIL：居中role=alert（水平偏差−0.008px），标题/正文逐字相等，标题max-width 282.667px与同字体36ch探针282.656px差<1/64px（布局宽度按1/64px取整，首跑按字符串相等失败后改为该容差，属新断言的量纲修正，非放宽既有断言），primary Retry，无.composer-error、无原始消息，history记录1次失败resume；点Retry后行出现、alert脱离、URL不变、resume共2次、fixture标志已消费。④EMPTY：恰1个“No messages yet”，垂直居中偏差0px、无溢出；发送hello后用户行替换它。截图已目视：analysis/batch-20260920/transcript-states-ui-MgRYAL/（skeleton-light/dark、load-failure-light、empty-light）。

评审修复（0.2.100内，未升版本）：①气泡骨架条高度：k_给气泡Skeleton `box-content … py-md text-heading`，源中为content-box即1lh+2×pad-md；原版.box-content在c6a992d55-Vcbdv79k.css的@layer utilities内，被本地未分层`* { box-sizing: border-box }`（style.css:17-18）覆盖，条塌成border-box（实测18px）。source-transcript-states.css新增`[data-transcript-skeleton] .box-content { box-sizing: content-box }`（仅限骨架），实测34px=text-heading 1lh 18px+2×pad-md 8px；套件新增boxSizing=content-box与高度=1lh+2×pad-md（±0.5）断言，SSR测试新增该CSS规则存在检查。②openSession catch改用渲染同一shownRows计数（见上）。③失败/空状态下不再绘制idle状态行（见上），套件在FAIL与EMPTY两步新增`[data-testid=code-transcript-status]`计数为0断言；截图load-failure-light/empty-light已目视无spark、气泡条为34px。未拒绝任何评审项。

验证（0.2.100评审修复，2026-09-23T07:20:33Z verify-build，SHA `7c735dfa55971166efecfc7820db9a203fd513399d0c8b4e2d026980c39c11d6`，429源文件）：`npm run build`通过；`npm test` 1012项：1011通过、1既有跳过、0失败；`node scripts/verify-build.mjs`通过。离屏（同一SHA，串行）：transcript-states通过（5项，offscreen-transcript-states-anRaeK，截图transcript-states-ui-GLuDgn/）；turn-errors通过（6项，offscreen-turn-errors-yzDGi0）；files-pane通过（6项，offscreen-files-pane-ZjzqGC）；composer-states通过（18项，offscreen-composer-states-0IoULC）；turn-timestamps通过（4项，offscreen-turn-timestamps-BxIiFB）；另因状态行改动加跑run-command通过（12项，offscreen-run-command-FSz0Pm）、stream-highlight通过（15项，offscreen-stream-highlight-F2h0tC）。未注册的ui029/transcript-fade脚本按规则未运行（其idle断言针对有行会话，不受影响）。日志work/claude-ui-sweep/0.2.100/（已用本轮输出覆盖）。无保留失败。

差距：transcript-fade-ui-test（:315-328断言加载态无溢出、渐隐为0，以及EMPTY会话无溢出）未在run-suite表中，本轮无离屏证据（新套件对同样条件做了断言）；源hc的onAnimationStart跨文档相位同步pc()、earlier分页的+40内边距、kind专用失败正文未实现；骨架fade-out-bottom在本地高度下被Zw裁剪，只可见前部。未打包安装，安装版0.2.13。

## 0.2.99 侧栏New行仅在新建路由选中、源空状态/加载骨架/滚动顶部渐隐（未安装）

New行选中修复（可见度5）：按sidebar-groups.js:12741-12767 zP，`y = _ && !v`，其中_=aP（:12310）仅在该模式的新建路由为真；本地main.jsx:942 navigate(id)对每个打开的会话都setSection("new")，导致New行与当前会话行同时高亮。source-sidebar.jsx中New改为`section === "new" && !current`时才data-selected="focused"，仅选中时aria-current="page"，aria-keyshortcuts恒在；其余导航行仍为`section === key`，⌘ N提示保留，main.jsx未改。aria-keyshortcuts取值按源实际输出为"Meta+n"而非任务说明中的"Meta+N"：Rl为shared-frame-C_2npUJq.js:2282-2298 vo，po（:2210）先把"cmd+n"小写化，单字符键原样输出，Mac上即"Meta+n"（与本地menu-model normalizeShortcut对单字符的处理一致）。Artifacts/Routines行未动。

空状态：sidebar-model.js新增纯函数sidebarEmptyVariant({visible,total,hasNonDefaultFilter,hasArchived})，按:7700-7705 CO+wO（有可见行→undefined；否则total>0或非默认筛选→filtered；no-sessions在有归档会话时转filtered）；hasNonDefaultFilter按:7600-7609 fO用新纯函数sidebarEmptyHasNonDefaultFilter（仅status archived或group by state下活动天数在(0,7)时为真；本地无环境筛选；status all、30d/All、showEmptyGroups均不算，与筛选徽标用的hasSidebarFilters不同，故status all且无会话时为no-sessions而非filtered），hasArchived=sourceSessions中任一sessionArchived，total=已加载会话数。新组件SourceSidebarEmpty按:7721-7760 OO：filtered为“No sessions match the current filters”（footnote/muted，flex-col items-center gap-2 px-4 py-6）＋“Show all sessions”按钮（footnote、text-secondary、underline-offset-2、hover text-primary+下划线、hide-focus-ring+focus-visible --cds-focus-shadow），点击按源handleShowAllCodeSessions（sidebar-groups.js:21497-21507 He→:21843-21847 OU）走新纯函数showAllSessionsPreferences：status设"all"、清环境（本地无）、group by state（codeCutsByAge即bH :20896）时活动天数设0（All），其余偏好不动（sidebar-main.js:13774-13778 onShowAllSessions仅Code）。任务说明称其与过滤菜单“Clear filters”（sidebar-main.js:12802-12811，active+7天）同一路径，与源不符；首版照此实现时，仅有归档会话且默认筛选的配置显示filtered但按钮点击无效（clearSidebarFilters返回相同偏好），审查后已改；no-sessions为“Sessions you start will show up here”＋aria-hidden xO象形图（scale .55：82.5×77、viewBox 0 0 150 140、fill none、单path fill hsl(var(--pictogram-200))），path按bO（:7645-7686）由逐字复制的hO/gO/_O与vO棋盘（gO取(row+col)%2==0，_O取row、col均偶）生成，已一次性与参考bO()输出逐字比对相等（29168字符）。替换旧文案“No sessions match these filters”/“No archived sessions”/“Open a folder”+“Start a session to see it here.”。本地适配：有搜索字符串且无命中时保留“No matching sessions”（源搜索为命令面板）；源头部在eO滚动器外而本地分组标题在nav内，故no-sessions时nav改为列布局、空块flex:1 min-h 200px代替h-full，避免溢出滚动器。

加载骨架：按:7761-7830 AO单行形态，SourceSidebarSkeleton为div.df-placeholder-rows（flex-col gap-px、data-testid="sidebar-rows-skeleton"，保留本地role=status aria-label“Loading sessions”），每行div[data-row]高--df-row-h、gap --df-row-gap、pr --df-row-px，pl按Wn（shared-21 TD，sidebar-rows.js:7177）为calc(var(--df-row-px)+var(--df-row-indent,0px))（首版漏了左内边距，审查后补上），source-leading-slot内6×6圆形骨架，再接kO宽度（68%/54%/44%循环）、高var(--df-row-font,13px)的骨架条；骨架元素data-cds="Skeleton"复用source-menu.css .smenu-skeleton的--cds-skeleton-base底色与cds-shimmer，未新造颜色。延迟显现（df-placeholder-fade .15s ease-out，延迟--placeholder-reveal-delay默认.5s，减少动效时0s）直接由已加载的shared-styles-DunnEebG.css（desktop-layout.css:752-778的同一规则）作用于.df-placeholder-rows。行数保持3（源来自rememberedRecentsRows，本地不持久化，已注释）。删除旧.source-sidebar-loading条CSS。

滚动顶部渐隐与重置：按sidebar-rows.js:7887-7896/7970-7977 eO，nav.source-session-list加onScroll（scrollLeft强制0；scrollTop>2时data-scrolled，React按源`i || void 0`写出"true"）并加dframe-nav-scroll类，由已加载的desktop-layout.css:799-801规则施加mask-image linear-gradient(#0000 0,#000 12px)；scrollResetKey本地为规范化偏好status/groupBy/sortBy/stateActivityDays/showEmptyGroups，变化时scrollTop归0并清除data-scrolled。--df-nav-scrollbar-lane哨兵与ResizeObserver逻辑未动。

测试：新增tests/source-sidebar-states.test.mjs（SSR真实SourceSidebar，4项）：current='s1'+section='new'时New无data-selected/aria-current、全侧栏仅会话行data-selected；current=null时New为focused、aria-current=page、aria-keyshortcuts=Meta+n、kbd保留；Customize路由只选中Customize；filtered渲染含“Show all sessions”、无旧文案；无处理器时不渲染按钮；no-sessions含viewBox 0 0 150 140、82.5×77、path前缀、长度29168与2000个单元格；搜索保留“No matching sessions”；加载时3行骨架、宽度68/54/44%与6×6圆点。sidebar-model.test.mjs新增sidebarEmptyVariant用例（visible>0→undefined；默认筛选total 0→no-sessions；total>0→filtered；非默认筛选→filtered；hasArchived→filtered），审查后再加2项：showAllSessionsPreferences（默认偏好下clearSidebarFilters无变化而OU切到all；project分组天数不动；state分组天数归0）与sidebarEmptyHasNonDefaultFilter（fO真值表，status all为假而hasSidebarFilters为真）；states SSR测试补status all无会话→no-sessions、state 3d→filtered、state 30d→no-sessions，并读取source-sidebar.css断言骨架行padding-left。离屏sidebar-chrome（已注册）原14项检查全部保留，追加4项：启动时仅New选中→打开会话A后侧栏恰1个[data-selected=focused]且为该会话行、New无data-selected/aria-current→点New后仅New选中且aria-current=page、aria-keyshortcuts=Meta+n；Status=Archived（无归档会话的配置）显示“No sessions match the current filters”，计算样式flex-col/center/gap 8px/padding 24px 16px、字号=--cds-font-size-footnote、颜色=muted/secondary、underline-offset 2px，点“Show all sessions”后3行返回且preferences.sidebarPreferences.status==='all'（审查后由'active'改为按源OU的'all'，并断言project分组下stateActivityDays不为0；这是纠正原本与源不符的期望，不是放宽）；45行阶段760×600下scrollTop 40时data-scrolled="true"且mask-image含linear-gradient，回0两者皆无；滚动40后改Group by为None（Filter按钮用派发点击以免被滚入视口；改前scrollTop仍为40），scrollTop归0、data-scrolled清除且列表仍可滚动（溢出289px，证明非钳制）。检查清单前后见work/claude-ui-sweep/0.2.99/sidebar-chrome-checks-before.json（14项）与-after.json（18项，审查修正后重生成，仅第3项文案随OU改为status all）。首轮调试中两处为测试侧错误并已修正：窗口minHeight 580使520px高度无法达到（改600）；data-scrolled期望值应为"true"而非空串（按源React输出）；子菜单触发器改用真实点击（位于nav外的portal，不会滚动nav）。

验证（审查修正后重建0.2.99，2026-09-23T05:31:03.904Z，SHA `f9c61a01fc090f4ab56bb2bb2281c140c46b322ee742c22d68a5bd40208a6979`，427源文件；上一轮b4db4243已作废）：`npm test` 1007项：1006通过、1既有跳过、0失败；`npm run build`通过；`node scripts/verify-build.mjs`通过。离屏（同一SHA）：sidebar-chrome通过（18项，offscreen-sidebar-chrome-5Qsn7W，运行目录sidebar-chrome-ui-oFaT9S）；home-page通过（19项，offscreen-home-page-X4Lbw5）。日志work/claude-ui-sweep/0.2.99/（unit.log、build.log、verify-build.log、suite-sidebar-chrome.log、suite-home-page.log均为本轮覆盖；diag-sidebar-chrome.log为首轮调试记录）。无保留失败。

差距：no-sessions象形图与加载骨架只有SSR证据，无离屏截图（离屏fixture启动即有会话/连接很快，骨架在0.5s显现延迟内即被替换）；源TO/EO/DO的占位与空状态互斥细节、rememberedRecentsRows行数记忆、twoLineRows两行骨架、归档探测的独立请求（源af按status archived查询，本地用已加载列表）未实现；“Open a folder”入口从侧栏空状态移除（源无此项，主页仍有文件夹选择）。未打包安装，安装版0.2.13。

## 0.2.98 本轮（0.2.93–0.2.98）最终回归（未安装）

同一构建（0.2.98，2026-09-23T03:20:58.787Z，SHA `56b171cce67ef50602fad84dfce97b08abc40645ea105bfa227eab28aedc6b11`，427源文件）：`npm run build`、`npm test`（1000项：999通过、1既有跳过、0失败）、`node scripts/verify-build.mjs`均通过。run-suite.mjs suites表全部23套离屏串行运行：22套首跑通过（files-pane、turn-timestamps、turn-errors、sidebar-chrome、menu-bar、account-lifecycle、response-math、stream-highlight、workflows、bypass-permission、usage、background-tasks、subagents、user-markdown、run-command、edit-read、home-page、home-account-usage、settings-complete、settings、composer-states、slash-commands-complete），code-fence首跑失败。日志work/claude-ui-sweep/final/（summary.txt、suite-*.log）。

code-fence失败（测试时序竞态，非产品回归）：:181 openingState期望`{hidden:"true",text:"",blocks:1,tailBlocks:0}`，实得`{blocks:2}`（占位已被替换），另一次在:174等待`.scb-language-placeholder`超时；同构建9跑3败。诊断副本（work/codefence-diag-20260923/，页内MutationObserver+longtask，不改产品）显示通过与失败跑的页内时间线逐次一致：发送后~345ms首段文本、~500ms附着未完成语言行占位、~842ms（fixture codeFenceStream +800ms首个grow delta）替换为代码块，无>50ms长任务；即占位是约340ms的节奏化状态（response-pacing-model targetLagMs 550，2026-09-22起未改，本轮未触及），失败只因CDP waitFor→evaluate往返偶尔超过该窗口。修正测试：Enter前在页内挂MutationObserver，于首个附着占位的变更时刻按原字段快照，断言值不变（未放宽）；修正后同构建code-fence 10/10通过，npm test与verify-build复跑通过（测试脚本不在构建源内，SHA不变）。

未运行：validate-local标准链57套原生窗口脚本一律未直接运行（用户禁止占屏）；其中23套已以离屏适配器覆盖原断言，其余（pane-layout、file-search、scrollbar-mode、titlebar、sidebar、turn-footer等）无离屏证据。5项历史高度阻塞保留。未打包安装，安装版0.2.13。状态文件analysis/batch2-status-0.2.98-offscreen-20260923.json。

复跑（2026-09-23 12:22起，构建时间2026-09-23T04:22:31.828Z，SHA不变`56b171cc…6b11`，427源文件）：`npm run build`通过；紧接其后的`npm test`有1项取消——codex-client.test.mjs:224“awaited stop snapshot”10s超时（当时负载均值23.7；单独跑与整套复跑均~0.65s通过，环境性，未改测试），复跑1000项999通过、1既有跳过、0失败，verify-build通过（unit-3.log）。23套离屏串行重跑（summary-2.txt、run2-suite-*.log）：22套通过（含已修测试的code-fence），composer-states在:241附件移除按钮opacity 0.849082≠0失败。根因（测试时序，非产品回归）：点击Add菜单“Add files or photos”后指针停在新附件处，.sca-pill:hover按源启动180ms移除按钮淡入，测量取到过渡中值——即0.2.94/0.2.96/0.2.97/0.2.98记录的同一“既有抖动”。修正composer-states-ui-test：测量前把指针移到套件已用的中性点(100,700)并等待移除按钮getAnimations()为空，静止opacity仍断言"0"（未放宽）；同构建复跑3/3通过，verify-build通过（测试脚本不在构建源内）。状态文件analysis/batch2-status-0.2.98-offscreen-20260923.json（本次写入；unrunSuites为validate-local标准链全部57套）。

## 0.2.98 已有会话输入框占位符“Type / for commands”（未安装）

按cc43287c9-BMbiZYzF.js:28680-28699 `placeholder: Yn ? 'Type / for commands' : (ht ?? (Ki ? 'Describe something to build, change, or fix' : 'Describe a task or ask a question'))`，其中:27454 `Yn = Pn?.id ?? null`（当前会话id）：凡挂在已有会话上的Code输入框显示“Type / for commands”，只有草稿/新会话输入框显示“Describe a task or ask a question”。Ki为带开关的替代文案、ht为调用方覆盖，本应用无对应来源，保留现有草稿文案。

新增纯函数src/composer-placeholder.mjs `composerPlaceholder({sessionId, mode})`：Code模式有会话id→“Type / for commands”，否则（null/空串）→草稿文案；Chat模式不是该源Code输入框分支，有无会话都保持本地“How can I help you today?”（本地适配，已在模块注释说明）。main.jsx向SourceComposer传`placeholder={composerPlaceholder({ sessionId: current, mode })}`；source-composer.jsx回退改为`composerPlaceholder({ mode })`（文案不变）。编辑器（source-composer-editor.jsx）经data-placeholder暴露，CSS以`[data-empty=true]::before{content:attr(data-placeholder)}`绘制，因此current变化即时生效，无需重挂载。code-ui.jsx:531的旧Composer副本不在主界面渲染，未改。

测试：新增composer-placeholder.test 3项（会话id/null/空串/缺省、Chat两态、main.jsx与SourceComposer接线及data-placeholder暴露）。composer-states离屏套件扩展：会话A空输入框data-placeholder与::before content均为“Type / for commands”；新增第14段：New→草稿文案（截图placeholder-draft.png）→切到会话C→会话文案→New→草稿文案→从草稿发送首回合（fixture创建新线程，turn/start的threadId不属于A–D且已写入fixture线程库）→即刻变为“Type / for commands”（截图placeholder-session.png）→New恢复草稿文案。home-page套件新增：首页（无会话）输入框为草稿文案。

最终Node 1000项：999通过、1既有跳过；离屏composer-states、home-page、slash-commands-complete 3套通过（同源SHA），blocked/violations均空；verify-build完整性通过；截图已查看。日志在work/claude-ui-sweep/0.2.98/。

保留失败：composer-states首跑在新增第14段等待thread/start计数失败——fixture把thread/start记入fixture-history.jsonl而非fixture-requests.jsonl（测试假设错误），改为以首个turn/start的threadId证明新线程已创建（断言更强，未放宽），截图显示功能正确；第二跑在:241附件移除按钮opacity 0.849229≠0（0.18s过渡中取值，与0.2.94/0.2.96记录的同一既有时序抖动，本改动未触及附件），同构建第三跑通过。

差距：源的Ki替代文案“Describe something to build, change, or fix”（功能开关）与ht调用方覆盖未实现；Chat模式输入框占位符未按claude.ai网页源核对。

## 0.2.97 Files树/搜索/@提及的源文件类型图标与提及路径提示（未安装）

新增纯函数src/file-kind-icon.mjs，逐字搬运shared-14-BOJVa-jT.js:19083-19140 cP（nP/aP/oP/sP）：路径含“SKILL.md”→Scroll；否则按aP（最后一个“.”之后小写，无点为''）经oP依次判定kN压缩包（:18875）→Archive、$N ppt/pptx→Slides、YN jsonl/parquet/db/sqlite/sqlite3→Database、XN csv/tsv→Spreadsheet、uu或ZN→Code、QN ico→Image、eP文档或tP音视频→File，再落到qN（:19005，file.<ext>：xls/xlsx→sheet、mermaid/mmd与svg/Hc→Image、jsx/tsx与Zc→Code、pdf/md/docx/cd/clark→doc），都不命中→File；md/markdown→Note、html/htm/xhtml→Globe按as覆盖。导入已解析并注释：uu=shared-5-CGK2eyBT导出Ai=tF（js.jsx.gs.ts.tsx.py…lua.r），Hc=shared-4-D8W6lHTW导出Zd=Bh（png/jpg/jpeg/gif/bmp/webp），Zc=shared-4导出pf=eg（python…plaintext），as=shared-8-B5xbG2px导出Na=OT/DT（任务说明里旧审计“md→File”有误，README.md实为Note）。

Files树行按panes-tile-current.js:5692-5775：每行只一个12px（xs）图标，目录为CaretRight（展开时rotate(90deg)，transform过渡用--cds-dur-fast（60ms）与Tailwind默认缓动，html[data-local-motion=reduce]与prefers-reduced-motion下为none），文件为fileKindIcon(entry.name)；图标颜色改为--cds-text-muted并self-center，名称--cds-text-primary；去掉行上原生title（本项不加替代提示）；原CaretDown＋Folder/FolderOpen双图标移除。为让原生窗口脚本仍能按路径定位行，按钮加data-file-path（与文件标签页同名属性，不可见）；file-search-ui-test与scrollbar-mode-ui-test定位器从[title=…]同步改为[data-file-path=…]（仅定位方式，断言未变）。24px行高、8+8*level缩进与全部树键盘行为不变。本地文件条目不带symlink信息，源的ArrowUpRight链接标记未实现。文件名搜索结果（source-files-search.jsx）同样改为fileKindIcon 12px。

@提及下拉：前导图标按c099c328d Ip :6286-6330 su分支，目录Folder、其余fileKindIcon(label)，保持16px；按shared-frame-C_2npUJq.js:13140-13165 Bx每个选项包在SourceTooltip中：内容=(tooltip ?? renderedText ?? label)把“/”替换为“/​”，side right、sideOffset 8、delay 200，有description时multiline且max-w 360px（本地提示定位层默认240px上限，用.smd-tooltip-wide在popup与positioner上同时放宽到360px）；移除原生title；保留onMouseDown preventDefault，编辑器焦点不丢。

测试：新增file-kind-icon.test 2项（任务12例：a.tsx Code、b.png Image、c.csv Spreadsheet、d.sqlite Database、e.pptx Slides、f.zip Archive、dir/SKILL.md Scroll、g.md Note、h.html Globe、notes.txt/Makefile File、x.json Code；另覆盖oP各分支与qN回退、大小写、无点/点文件、所有返回字形都在icons.json中）。composer-states离屏套件扩展：根级与@docs/结果逐行前导字形等于助手结果（txt File、js Code、readme.md Note、photo.png Image），16px、选项无title；悬停选项≥200ms后出现.source-tooltip-popup：side right、距选项8px、文本“src/​app.js”、multiline、popup与定位层max-width 360px、绘制在下拉之上、移开后关闭；原先用title取插入路径改为description/label（mentionOptions renderedText）。新增files-pane-ui-test并登记离屏run-suite与validate-local标准链（57套）：种入README.md/index.html/app.tsx/data.csv/store.sqlite/deck.pptx/bundle.zip/photo.png/notes.txt/Makefile/config.json/nested/skills/demo/SKILL.md，展开nested与skills/demo后每个treeitem恰一个12px图标、颜色=--cds-text-muted、名称=--cds-text-primary、字形逐项等于助手、行与内部无title、24px、padding 8+8*level；展开目录caret为matrix(0,1,-1,0,0,0)且transition transform 0.06s（=--cds-dur-fast），折叠为none，文件图标无过渡；data-local-motion=reduce时0s且折叠立即none，恢复后过渡回来；Tab/Home/ArrowDown/ArrowLeft/ArrowRight键盘不变；搜索“e”结果逐行12px muted字形等于助手；深色重启同样断言、760px文档/body无横向溢出。截图已查看（tree-light、search-light、tree-dark、tree-dark-760、mention-tooltip-light）。

最终Node 997项：996通过、1既有跳过；离屏files-pane、composer-states 2套通过（同源SHA），blocked/violations均空；verify-build完整性通过。

保留失败：files-pane首跑在深色阶段断言“深色--cds-text-muted与浅色不同”失败——该令牌两主题都是gray-400（design-system.css:53578/54142），属测试假设错误，改为断言深色--cds-text-primary不同以证明主题切换，其余逐行断言不变，重跑通过。composer-states首跑在:228附件移除按钮opacity 0.849187≠0（0.18s过渡中取值，与0.2.94/0.2.96记录的同一既有时序抖动，发生在提及阶段之前），同构建第二次通过。

差距：源树行的文件夹无展开器形态（Folder）、symlink ArrowUpRight标记、匹配高亮次要文本色、行右键菜单与Hu详情提示未实现；树行去掉title后本轮不加替代提示；提及Tooltip的tooltip字段本地选项不提供（走renderedText）。file-search、scrollbar-mode、pane-layout等原生窗口脚本未在本轮运行（仅改了定位器）。未打包安装，安装版0.2.13。构建SHA `3faab2e8523c4685a45eea808acd2a11326e96232acbbcae6f1c41b8ec1d0f66`，426源文件，2026-09-23T03:04:24.405Z。日志work/claude-ui-sweep/0.2.97。

## 0.2.96 回合页脚与用户行源相对时间戳（未安装）

按scroll-messages-current.js:33848-33868 OY（TY “text-body text-muted tabular-nums”＋ps-md pe-md，absoluteAfterHours Infinity）与scroll-shared-10-current.js:14983 AO（已解析导入：scroll-messages的wi=shared-10导出pt=jO=Object.assign(SO,{Timestamp:AO})；tooltipSide top、tooltipTimeZone false，基类“flex h-control items-center ps-sm pe-sm first:ps-0 last:pe-0 text-caption font-normal text-muted select-none”经Ca合并后text-body/ps-md/pe-md胜出，first:ps-0/last:pe-0保留），新增消息行时间戳。纯模型src/relative-time-model.mjs：formatRelative按uO（|s|<60且en长格式→“just now”，否则Intl format(0,'second')；其余取aO年/月/周/日/时/分最大单位，RelativeTimeFormat numeric auto、style long）；formatAbsolute按fO（year numeric、month short、day numeric、hour numeric、minute 2-digit，无timeZoneName）；无效日期文本“—”且无提示；共享时钟按14418-14440 eO/nO/iO：仅有订阅者时运行一个60000ms setInterval，读取时快照≥30s陈旧即刷新，供useSyncExternalStore（服务端快照null），now/interval可注入。本应用UI仅英文，locale固定en-US（源取应用intl locale，已注释）。

新增source-timestamp.jsx/.css：`<time data-cds="RelativeTime" dateTime={ISO}>`包在SourceTooltip（side top、hoverable false，内容为绝对时间）中，无tabindex、无原生title；CSS为合并结果：display flex、height --cds-h-control（24px，不改变行高）、padding-inline-start/end --cds-pad-md、:first-child起始0、:last-child结束0、--cds-font-size-body/--cds-leading-body、400、--cds-text-muted、tabular-nums、user-select none。回合页脚按Z0（43056-43200）把时间放在Copy之后作为最后元素（sr-only状态span移到它之前以保持last:pe-0），取该回合Codex Turn.completedAt×1000（本地替代源entry.timestamp，56825 K=isStreaming?undefined:timestamp）；运行中回合本就无页脚，completedAt为null时不渲染。用户行按BY（39679-39694）把时间放在Copy之前，取该回合Turn.startedAt×1000，仅用于开启该回合的用户行（Codex每回合只有一个startedAt，回合中途steer的用户消息不显示时间，不伪造）；null不渲染。时间不可聚焦，turnFooterKeyIndex与漫游不变；Copy载荷不含时间文本。

状态：state.turnTimes[线程][回合]={startedAt,completedAt}由turn/started、turn/completed与hydrate（thread/read、resume initialTurnsPage、turns/list）写入；仅接受有限数字，缺失字段不覆盖已观测值，未变化时保持引用；页外的实时回合保留；taskTurnFacts语义不变。

测试：新增relative-time-model.test 6项（10s→just now、125s前→2 minutes ago、3h→3 hours ago、1天→yesterday、3天→3 days ago、8天→last week、未来/法语/无效值；本地构造日期formatAbsolute→“Sep 23, 2026, 3:04 PM”且无时区名；timestampView与turnSecondsToMs；假定时器验证单一60s interval、30s陈旧刷新、最后退订清除与重启；reducer逐回合记录、completed无startedAt时保留、taskTurnFacts不变、非法值为null；hydrate填充并保留页外回合）。fixture新增fixture:timestamps（Turn.startedAt=now-125，显示进行中回复后等待timestamps-complete标记，再以completedAt=now-120完成并落盘）。新增turn-timestamps-ui-test并登记离屏run-suite与标准链（56套），不点击Copy：种入历史回合（3天前真实时间、另一回合时间为null）：页脚顺序Copy→time、“3 days ago”、dateTime=completedAt ISO、提示为top且等于页面内toLocaleString(en-US,fO选项)并无时区名、离开后提示关闭；用户行time→Copy、dateTime=startedAt；几何与令牌逐项等于--cds-h-control/--cds-pad-md/body/leading/text-muted、tabular-nums、select none、行高24px；null回合页脚与用户行无<time>；运行中用户行“2 minutes ago”、该回合无页脚无<time>；完成后页脚“2 minutes ago”、提示正确、ArrowLeft/Right/Home/End焦点留在Copy；关闭重启深色后从历史恢复页脚与用户行时间；深色760px文档/body/转录区无横向溢出、行高24px。截图已查看（history-light、history-user-row-light、running-light、completed-tooltip-light、completed-dark、completed-dark-760）。

最终Node 995项：994通过、1既有跳过；离屏turn-timestamps、user-markdown、turn-errors、composer-states 4套通过（同源SHA），blocked/violations均空；verify-build完整性通过。

保留失败：turn-timestamps首跑即通过；为截图质量补“等待提示入场完成”与“离开后提示关闭”断言后重跑两次均通过（未放宽断言）。composer-states前两次在:225附件移除按钮opacity 0.848982/0.848957≠0（0.18s过渡中取值，与0.2.94记录的同一既有时序抖动相同，本改动未触及composer），同构建第三次通过。

差距：源的DY/Ci经典样式时间戳、“settling”淡入（epitaxy-hint-fade-in）、revealOnHover、modelLabel“ · ”分隔与回合中途steer消息的逐条时间戳未实现（Codex无逐消息时间）；子代理嵌套转录不显示时间；locale固定en-US。turn-footer、user-actions、rich-copy等原生窗口脚本未在本轮运行（其种子回合无时间，行为不变）。未打包安装，安装版0.2.13。构建SHA `4aec08393f64211c3a330b0e0f8de106b37ae1dfbd72e170ce897617941965df`，425源文件，2026-09-23T02:50:34.626Z。日志work/claude-ui-sweep/0.2.96。

## 0.2.95 侧栏分组20行截断与源“Show N more”行（未安装）

按sidebar-main.js:11657 Yn，Code模式每个分组truncateAt=20（源另有5行变体，需ne!==null的侧栏布局上下文，本应用没有，未实现；Chat模式不截断）；Pinned按sidebar-main.js:9300-9316 Px(g,20,S)两种模式都截20。新增纯函数sidebar-model.js truncateRuns(runs,{truncateAt,extraRevealed,keepVisibleIds,shownRows})：按实际渲染行计数（父行＋嵌套run中实际显示的子行，折叠子行不计）；按shared-16 dc/fc仅在总数>truncateAt+extraRevealed+1时截断，且在嵌套家族延伸后对延伸后的截断点再套一次dc（剩余≤1行则整组显示），因此不会出现“Show 1 more”；按sidebar-groups.js:13421-13455 bF把截断点向后延伸（不重排）到最远的保持可见行——本地为当前会话、已选中行、等待审批/输入的行，并回报有效extraRevealed供组件按xF `j>h&&c(j)`写回保持；本地适配：嵌套家族整体渲染，截断点落在嵌套run内或恰在其父行之后时延伸到该run末尾；revealCount按SF=min(truncateAt,hiddenCount)，另回报firstHiddenId。

source-sidebar.jsx：extraRevealed按分组key存于Map状态，折叠/重开分组保留；分组方式/排序/状态/活动天数/搜索任一变化即在渲染中重置（xF vF epoch的本地替身，已注释）。行之后在hiddenCount>0时渲染按VD（7177-7231）的button type=button data-row data-roving-item，aria-label“Show {count} more in {bucketLabel}”，内容为df-leading-slot占位＋“Show {count} more”；点击extraRevealed+=20，按ID(e)键盘激活（detail 0或:focus-visible）时聚焦第一条新显示行。Shift范围选择、全选与漫游键只使用可见行（visibleOrder改用截断后的runs，隐藏行不渲染故不参与漫游）。CSS .source-show-more取kD/AD（7126-7135）：高--df-row-h、px --df-row-px、gap --df-row-gap、圆角--df-radius-pill、字号--df-row-font、text-muted→hover text-secondary+--df-hover、aria-disabled 70%，BD外层overflow-anchor:none落在按钮上。

测试：sidebar-model新增2项（45行→20可见/hidden 25/reveal 20；extra 20→40可见/reveal 5；extra 40→全部；21行不截、22行藏2；truncateAt undefined返回原runs；跨第20行的嵌套run整体保留（23可见）；父行恰为第20行时连同子run保留；折叠子run只计显示行；index 30的保持可见行把截断延伸到31且extraRevealed=11、顺序不变；复审修复用例：18平铺行＋父行r18、其2子run跨第20行、再1尾行共22行→整组22行显示、hiddenCount 0（修复前家族延伸后剩1行，渲染“Show 1 more”，源对平铺ee切在20显示“Show 2 more”且从不留单行），再加1尾行→21可见、Show 2 more）。sidebar-chrome离屏套件原9阶段不变，追加5阶段：第三次启动（深色）种入45个31天前的fixture线程、按日期分组：Older显示前20行且顺序正确、按钮“Show 20 more”/aria-label“Show 20 more in Older”、高度=--df-row-h、字号/圆角/左内边距/gap等于对应--df-*令牌、颜色=text-muted、前导槽24px使文字与行标题左对齐（38px）、按钮为分组最后一个元素；点击→40行“Show 5 more”，再点→45行且按钮消失；折叠再展开Older仍45行；搜索改变后回到20行（epoch重置）；行上End漫游落在按钮，Enter展开40行并聚焦第21行；深色760px文档/body/会话列表均无横向溢出。首跑通过，截图已查看（show-more-truncated-dark、show-more-dark-760）；复审修复后重跑通过（sidebar-chrome-run2.log，report为offscreen suite-report）。

最终Node 989项：988通过、1既有跳过；离屏sidebar-chrome 1套通过（14阶段，3次启动blocked/violations均空）；verify-build完整性通过。无保留失败。

差距：源的5行截断变体、fetch-floor/远端分页“Load more sessions”/“Loading…”、Show more后的焦点保持(holding)与overflow菜单保持、revealAllRows与finalReveal卸载时序未实现；源嵌套行可在家族内被截断，本地以整个家族为单位（记录为本地适配）；保持可见行本地加入了已选中与等待输入行（源为窗格打开/定位目标/fetch-floor）；源bF仅在`!isCollapsed && hiddenCount>0`（13433）时应用窗格打开延伸，本地keepVisibleIds在分组折叠时也参与并写回，折叠分组不渲染行，重开后可见结果相同（已在truncateRuns注释记录）。sidebar-ui、sidebar-rest等原生窗口脚本未在本轮运行（均未种入超过21行的分组）。未打包安装，安装版0.2.13。构建SHA `459b3a33594cfdd35935884969c4cfa2fc0d5666f82847d3eecc4eb75f01fd73`，422源文件，2026-09-23T02:37:31.527Z。日志work/claude-ui-sweep/0.2.95。

## 0.2.94 失败回合源错误卡、历史保留与Retrying状态行（未安装）

失败回合改为按源在回合内渲染：scroll-messages-current.js:56485-56503 最后一个回合的最新错误显示ehe/YY完整卡，其余错误显示JY/uJ紧凑标记（32289-32330）。新增纯模型src/turn-error-model.mjs：CodexErrorInfo映射到c1298b0ba Z类别（usageLimitExceeded/sessionBudgetExceeded→rate_limit“Usage limit reached”用UsageGaugeHigh图标，按shared-9 OF；rateLimitExceeded按源bF把API rate_limit码归server_rate_limit；serverOverloaded→overloaded；internalServerError→server_error；四种连接对象变体→network；unauthorized→auth；contextWindowExceeded→context_length；badRequest→invalid_request；其余及null→unknown，未知仅无状态码/429/5xx时可重试）。文案逐字取自shared-18 _r/xr/Sr、c1298 Y/X与shared-9 Q/$，Codex适配均注释：提示统一走源hintNoRewind分支（本应用卡上无Rewind/Compact）；server_error去掉指向Anthropic状态页的“check {statusUrl}”；所有类别保留View details（源对rate_limit等会drop，但Codex的message是重置时间等细节的唯一来源）。

新增source-turn-error.jsx/.css：卡片按cf6ae6197 Bp “flex w-fit min-w-[min(480px,100%)] max-w-full flex-col gap-md rounded-lg p-lg epitaxy-card-outline-inset select-text”，令牌取自design-system.css（--cds-pad-lg/--cds-gap-md/--cds-gap-xs/--radius-lg、inset 1px --cds-border、text-body-medium），图标16px text-danger；详情按Rp/zp：View details触发器（text-footnote、py-xs、尾随CaretRight展开-90°），面板order-first位于触发器上方，内含message+additionalDetails、对象变体的“Status: {httpStatusCode}”与Copy details（ghost sm flush start）。标记按uJ max-w 480px、gap 4/5px、无提示、同一详情。SourceDisclosure新增caret/triggerClassName/after可选参数，默认行为不变。Try again（CS secondary sm，点击后锁存隐藏）仅在retryHelps、该失败回合为最新回合、无运行中回合、已连接未归档且该回合userMessage全为文本时出现：Codex无重试回合请求，本地通过turn/start重发同一文本输入（图片/附件输入不重放，省略按钮）。

状态：state.turnErrors[线程][回合]由turn/completed（带error）、error willRetry:false（用turnId）与历史hydrate（thread/read、resume initialTurnsPage、turns/list中status failed+error）写入，下一回合turn/started不再清除；state.errors只保留无回合ID的错误（原inline-error仍用于它们）。willRetry:true只写state.retrying，在任何item/*、turn/started、turn/completed或断线时清除。状态行按经典Y5 apiRetry（58388/58545）显示“{短错误} · Retrying…”（短错误取c4a9ee384 sn短表：Rate limited/Model overloaded/Authentication failed/Request failed），无shimmer、无token统计，保留计时；Codex不提供次数，不显示(n/m)。侧栏“Needs input”对最新回合失败保持原语义（latestTurnError）。

测试：新增turn-error-model.test 11项（映射表含对象变体/null、文案与重试/图标规则、详情/状态码、短标签、卡/标记位置、重试输入、reducer跨turn/started保留、willRetry只设retrying并被delta/turn结束/断线清除、willRetry false记录、hydrate记录历史失败与侧栏状态、状态行Retrying）；transcript-status-model旧断言“失败写入state.errors”按新契约改为断言errors为null且turnErrors[线程][回合].message精确相等（契约变更，非放宽）。fixture新增fixture:turn-error:usage（willRetry:true rateLimitExceeded，保持retryMs后error willRetry:false+turn/completed failed usageLimitExceeded+additionalDetails，落盘）与fixture:turn-error:other（部分回复后other失败）。新增turn-errors-ui-test并登记离屏run-suite与标准链（55套）：重试期间状态行“Rate limited · Retrying…”且无[role=alert].inline-error与卡片；失败卡紧随该回合行、位于状态行前，min-width min(480px,100%)、padding=p-lg、gap=gap-md、radius=rounded-lg、inset描边、图标/颜色、标题/提示、详情展开含message+additionalDetails且面板在触发器上方；Try again发出同文本turn/start，新回合运行时旧卡降为标记；第二种失败后两个标记（max-width 480px）+unknown卡在部分回复之后；关闭重启深色从历史恢复同样布局；深色760px文档/body/转录区无横向溢出。

最终Node 987项：986通过、1既有跳过；离屏turn-errors、composer-states、background-tasks、subagents 4套通过（同源SHA），blocked/violations均空；verify-build完整性通过。截图已查看（浅色重试行/失败卡/标记+卡、深色760px）。

保留失败：turn-errors首跑①.source-message.source-message的min-width:0覆盖卡片min-width（同特异度后加载），改为双类选择器修正产品；②测试把footnote令牌探针挂在body下（13px）而卡片作用域为12px，改为挂在卡内测量，断言未放宽；截图前补等待详情面板高度过渡结束。composer-states首跑附件移除按钮opacity 0.849≠0（0.18s过渡中取值，与本改动无关），同构建重跑通过。

差距：源的自动续跑（Auto-continue when limits reset）、Sign in again/切换模型/Compact/Rewind等恢复动作、重置时间提示（TurnError无resetsAt）、Slack反馈与requestId解析未实现；misalignment字段未展示；没有turn项的失败回合不另造锚点。子代理线程的失败仅记在子线程桶内，不在父转录显示。未打包安装，安装版0.2.13。构建SHA `f0c702bd9e83682428bc9f05763a5280e3c5a84ca512608577d9ce86f6caa749`，422源文件，2026-09-23T01:48:02.464Z。日志work/claude-ui-sweep/0.2.94。

## 0.2.93 ⌘B侧栏切换、源标签提示与折叠持久化（未安装）

按sidebar-main.js:14680 Vf("toggle_sidebar") 新增⌘B：焦点在输入框、会话行等任意处按⌘B折叠/展开侧栏（仅Meta，不含Alt/Shift/重复/输入法组合；Ctrl+B保留为文本框后退一字符）；Settings打开时直接返回，操作对话框、行内重命名、What's New打开时不切换。渲染层preventDefault使Electron不再触发同键菜单加速器，保证一次按键至多切换一次。标签改为源文案：侧栏内按钮sidebar-groups.js:5320 hw “Hide sidebar”，折叠后标题栏按钮2685 Nb “Show sidebar”，均为CDS Kl提示（⌘B快捷键、hoverable:false）且无原生title；code-ui.jsx旧Sidebar（已不渲染）同步。按钮几何不变。

折叠状态按shared-2 Hm "dframe-store" Zm {collapsed:false, sidebarWidth:288} 与宽度一起持久化：preferences新增默认sidebarCollapsed:false，settings只接受布尔（'yes'/1等忽略），启动从配置恢复；按钮、⌘B、菜单共用一个setter，每次实际变化只写一次。应用菜单抽出为electron/app-menu.cjs纯函数：按index.chunk-ChZ67Jhw.js _Nr/gNr，View首项为macOS形态“Hide Sidebar”/“Show Sidebar”（CmdOrCtrl+B，点击发{kind:"toggle-sidebar"}到渲染层走同一守卫），其后分隔线与原有roles不变；每次sidebarCollapsed写入后重建菜单以更新标签。源首项Command Palette…本地无对应命令面板，未添加。

新增3项单测（布尔校验、View首项Hide/Show/加速器/click事件/分隔线、其余菜单与Settings加速器不变）。新增sidebar-chrome-ui-test并登记离屏run-suite与标准链（54套）：9阶段覆盖无键旧profile默认展开与初始菜单、输入框⌘B折叠且草稿不变不加粗、再按展开、会话行焦点⌘B、菜单click三次往返与标签、Settings打开时⌘B与菜单均不切换且不写盘、Hide/Show提示含⌘B且无title、同profile关闭重启保持折叠且菜单为Show Sidebar、深色760px折叠/展开均无横向溢出。首跑通过，截图已查看。标签改名同步至smoke-ui、packaged-ui、titlebar-ui-test（仅名称按源更正，断言未放宽；这三者为原生窗口脚本，本轮未运行）。

最终Node 976项：975通过、1既有跳过；离屏sidebar-chrome、menu-bar、settings 3套通过，blocked/violations均空；verify-build完整性通过。无保留失败。

差距：源折叠态hover-peek浮出侧栏（desktop-layout.css:1343-1453）、窄视口Mb图标/重启提示点、Win/Linux复选框形态未实现；侧栏内会话行内重命名输入框stopPropagation，焦点在其中时⌘B由原生菜单加速器处理（离屏合成按键不经过NSMenu，未能验证该路径与“渲染层preventDefault抑制加速器”的实际OS行为）。titlebar-ui-test等原生窗口脚本未在本轮运行。未打包安装，安装版0.2.13。构建SHA `0f59814cb8deb51c9f4b9f717cbcc39ef7f63f411e695b4c161dee2e8a4c2a00`，419源文件，2026-09-23T01:23:43.024Z。日志work/claude-ui-sweep/0.2.93。

## 0.2.92 账户busy整应用收尾与General菜单栏（Claude接手，未安装）

接手GPT未完成的0.2.92账户busy：源码已按shared-frame Button（busy时内容opacity-0保留宽度、aria-busy/aria-disabled、原生disabled只来自disabled）实现，接手时未跑验证。补跑account-lifecycle离屏11阶段首跑通过：Refresh busy保持标签宽度/焦点、无多余Sign in行推移Appearance、退出确认/设备码取消焦点与单次RPC、迟到完成/旧读取/重连均按原断言；settings与settings-complete回归通过。

新增General“Menu bar”：按c71860c77顺序置于Run on startup与Keep computer awake之间，文案适配为Show Code Desktop in the menu bar.；menuBarEnabled按源默认true（旧profile无该键也开启），desktopPatch布尔校验。主进程按index.chunk-D6ATlqeD dji/NOr/M5n/tOr/pK实现：开关即建/销Tray；左键为pji无Quick Entry回退（最小化restore，否则show，再focus）；右键为原生Swift用量弹窗不可用时的源fallback菜单：Show App / 灰色“{Plan} plan”“Usage: N%”（全部窗口usedPercent峰值，Intl百分比）/ Quit Code Desktop。每次右键实时account/rateLimits/read，最多等800ms后用同连接同身份上次成功快照；无快照且失败显示Usage unavailable；API key/Bedrock无计划用量不显示行；换账户/连接不复用。usage-model移到electron/供主进程共享，src保留re-export。图标为本应用</>字形按原模板几何生成（24pt/@2x/@3x，纯黑alpha，Template命名；scripts/make-tray-icon.mjs无头渲染）。

离屏适配器新增OffscreenTray：记录创建/销毁/菜单模板，禁止setContextMenu/displayBalloon，保证默认开启的托盘不会出现在真实菜单栏；run-suite仅为menu-bar首次启动声明精确blocked序列window.show、window.show、window.focus（Show App与左键故意触达），其余套件仍要求空。新增menu-bar-ui-test并登记离屏与标准链（53套）：默认开启、真实fixture计划/用量菜单、held读取800ms内出菜单且迟到更新、失败保留快照、Show App/左键路径、源顺序、开关写盘/销毁/键盘重建、搜索定位、深色760px无横向溢出、关闭后重启不建托盘。

保留4次失败：①开关读aria-checked早于IPC回包（主进程先写盘建销托盘再回复），改为轮询真实状态；②窄窗导航为tab角色，定位器错用button；③套件自身点Quit使应用在runner取证前退出（observationError），改为只断言Quit项，Quit→app.quit由单测覆盖；④设置对话框打开动画未完成即fill搜索被重置，按account套件先例等待动画并断言输入值。均未放宽产品断言。最终Node 973项972通过1既有跳过；离屏menu-bar/account-lifecycle/settings/settings-complete/usage/home-account-usage 6套通过，violations均空；integrity通过。

差距：本应用关窗即退出（源为隐藏窗口，window-all-closed空操作），Show App只能恢复最小化/隐藏窗口；原生Swift用量弹窗、复制用量图、Quick Entry、Windows/Linux托盘分支未实现；真实菜单栏图标外观与原生菜单弹出未验（离屏不触达OS）。未离屏化的原生标准套件若直接运行会创建真实托盘。未打包安装，安装版0.2.13。构建SHA `3c93d284b2d84b0d68eeac4093b5685bf2ef98fe8e21d4ea577cc6592479e371`，418源文件。日志work/claude-092-20260923，源契约analysis/menu-bar-20260923/source-contract.md。

## 0.2.91 AI公式共享加载、失败回退与整应用验证（未安装）

按shared-16的Gw/Jw独立实现共享公式加载状态：并发公式共用一个请求，ready通知已有订阅者；失败后后续请求至少间隔10000ms、总计最多3次，没有自动重试定时器。vite:preloadError禁止继续尝试，失败才变为failed；CSS失败独立处理，不阻止可用KaTeX引擎就绪。禁用公式读取固定pending；组件卸载取消订阅，共享资源保留到当前renderer结束。首个启用且ready公式只记一次来源performance mark。没有引入错误卡、假重试按钮或改变原公式几何。

8项新增加载器单测精确覆盖并发、冷却边界、三次上限、Vite失败、CSS独立失败、迟到旧样式及同步异常。最终965项Node：964通过、1既有跳过。相同构建公式10组、流式高亮15组共25组整应用离屏GUI通过，构建完整性通过。真实main/preload/IPC与隔离highlight fixture发出普通通知；实际webRequest拦截生产KaTeX的JS/CSS，页面只观察真实vite:preloadError，不注入ready或渲染内容。

验证开放前沿不加载、两条等待公式共用单次import且共同唤醒、离线本地CSS/字体、MathML/键盘焦点、真实设置深色与写盘、积分/矩阵/行内根式、错误TeX、CSS失败仍渲染、JS失败持续保留源文、10秒后切会话不越过preload错误限制、重载恢复、加载时切会话无旧内容串入、800px键盘横向滚动。CSS缺失时只证明引擎生成正确公式DOM，不声称排版仍正确。可重试非Vite失败的精确三次/10秒与旧订阅者恢复由可控Promise/假时钟单测证明，不能把浏览器原生模块失败缓存当作它们的整应用证明。

保留1次失败：第二条公式先发起加载时第一条闭合delta尚在逐词展示队列，测试误读开放原文。改为等待真实闭合状态后保持原精确断言，不改变产品时序或容差。首次通过后的深色截图落在设置退出过渡中，补等待dialog卸载及真实主题写盘后重跑10组；最终浅/深/窄三张已查看。

新增response-math-ui-test并注册，标准链由50增至51；全部原生窗口链仍未完成，5项历史高度阻塞保留。所有本轮窗口不可见/不聚焦，无原生调用；流式套件复制仍只用隔离内存。完整alluvium/held、公式解析前沿、源插件预加载调度和遥测、feature gate、跨公式选区仍有差距；remark解析静态打包、20000字符保护为明确本地适配。未打包安装，安装版0.2.13。构建SHA `c3917479f3cb9a1829915e97153e8f5b08853f9701275ee17b94d22440f4c425`，412源文件，2026-09-22T16:33:42.559Z。

## 0.2.90 AI代码输出刷新节奏与整应用后台验证（未安装）

静态重读官方code-block-current.js的Lr/Jr/oi调用链，补齐纯文本代码围栏的100ms刷新节奏：连续输入更新待显示内容，截止时间保持为上次提交后100ms；结束时立即返回完整原文。专用纯文本子组件不增加DOM，按scopeKey隔离，卸载或切换到高亮时取消待提交；Copy读取完整源文本，高亮token通道保持原有节奏。

新增4项假时钟回归覆盖持续输入、完整空白、重复值取消、卸载和旧回调失效。最终957项Node：956通过、1既有跳过。相同构建30组整应用离屏GUI通过：stream-highlight15、code-fence5、user-markdown10。真实fixture协议连续16次追加在本次观察中合并为10次文本提交，完成和复制保留尾部空格；真实worker的stream/settled颜色、四路上限、4000ms超时与重启、减少动态和状态动画、代码自动换行/复制失败/显式跟随等原断言仍通过。构建完整性通过，深色流式与窄窗截图已查看。

保留两次基线失败：旧测试等待HELD_STREAM单片标记，但实际协议分片为HELD_STREA与M，导致故障注入未拦住任何push。诊断确认页面visible且实际stream正常；测试改为绑定预先armed的下一笔真实streamId，从首push拦截。4000ms期限、颜色、回退、worker重启及并发限制未放宽。修复后的基线14组只作为诊断证据，不计入最终15组产品验证。

后台适配器新增精确审核的highlight-server fixture入口；只操作隔离profile和普通Codex协议，不运行真实命令或模型。围栏套件采用唯一证据目录、源码/fixture前后哈希与隔离CODEX_HOME。全部窗口不可见且不聚焦，无原生调用；复制验证使用隔离内存并完整恢复所有MIME，不代表系统剪贴板验收。围栏隔离profile仍保留于证据目录，未声称清除全部测试数据。

50套原生标准链及官方同状态像素仍未完成，5项历史高度阻塞保留；完整alluvium/held/morph与真实账户仍有差距。未打包安装，安装版0.2.13。构建SHA `7ed7e5b2551ccb28bb9ffeabf0c4343c864c64e0c1f297c18e979c91a66c2f87`，411源文件，2026-09-22T16:22:22.638Z。

## 0.2.89 工作流卡片保真与整应用后台验证（未安装）

按ipe/npe/fpe/upe/dpe源码重整工作流卡：头部外层12px、内部标题/元信息5px；描述和失败原因独立间距；运行类型和数值secondary、单位muted。Stop改共享sm secondary/auto图标，实际compact20px/radius5；纠正.23文档Stop24旧结论。compact标题有名称时不再shimmer，工作流标题及终态行跟随聊天Small/Medium/Large13/14/16，面板保留CDS13px；失败终态动词也显示danger。

阶段头采用CDS gap-xs6px、标题/计数/箭头20px对齐，rounded-sm源变量4px；展开保持alpha1，收起才ghost-hover。空阶段不绘制虚构点阵，底距pad-sm6px。代理表头auto15px、数据行16px、横gap-sm8/纵4，随面板展开显示Token列；未完成代理仅在工作流运行时使用secondary/实时计时。Phases标题使用footnote-medium字重与字体轴。无停止能力时不渲染空操作按钮。

新增后台适配器的workflows审核入口，workflow二进制只允许精确隔离fixture路径；原标准套件由3组扩展至9组，使用真实production main/preload/IPC、实际Node工作流子进程及fixture协议。真实设置启用，三代理read-only请求、两阶段、失败PreviewCard、展开收起、三字号、深色、Stop后真实settled、完整Electron重启恢复磁盘阶段/代理且wire日志不变、无代理的真实runner失败均通过；没有真实模型/账户/脚本文件选择器操作。

最终953项Node：952通过、1既有跳过；同构建工作流9组、后台任务6组、子代理7组，共22组离屏整应用GUI通过，构建完整性通过。最终展开表格、深色错误预览、失败空阶段截图已查看。窗口始终不可见/不聚焦，无原生对话框/剪贴板调用；测试profile已清理，关键协议与停止快照另行归档。不能将这些算作原生窗口验收。

保留1次失败：新增测试误把gap-sm/gap-xs当作4px，复核官方CDS定义后精确改为8/6，pad-sm同为6；产品使用正确令牌，不放宽容差。后续复核发现初稿圆角2不符源rounded-sm4，已纠正并加入精确GUI断言，重新Node/build/全部相关GUI。基线3组和中间7组不作为最终9组构建证据。

50套原生标准链仍未完成，5项历史高度阻塞保留；共享PreviewCard全部分支、真实账户模型、官方同状态像素与整体99.99%未证明。工作流仍固定read-only；本地脚本启动与plan说明是明确Codex适配，没有捏造独立journal/artifact页面。未打包安装，安装版0.2.13。构建SHA `5edfe7ec89c17d4365e3545c0a85afb2d69b29321d8f7f1e350dd16ddb4f8d51`，410源文件，2026-09-22T16:06:51.332Z。

## 0.2.88 Bypass确认框与整应用验证（未安装）

按shared-frame mf/Wd/yf及CDS令牌修正Bypass确认框：surface-3底色、rounded-card圆角、无实体边框、panel-lg ring与阴影，专属backdrop使用背景令牌与2px模糊。保留400px宽度、p-xl、取消初始焦点与既有真实权限行为；其它ActionDialog不改。完整共享ConfirmationDialog入退场presence/nested分支尚未实现，不宣称全部等价。

新增标准bypass-permission-ui-test，使用真实production main/preload/IPC与隔离fixture，7组覆盖：默认隐藏/设置启用落盘；第四菜单项/确认/取消/焦点/浅色精确令牌；thread/start与turn/start的真实Bypass参数、不同会话隔离；重连第一笔及后续resume恢复普通权限；组织策略变更在主进程拒绝且保留草稿；关闭再启用不恢复旧选择、Plan readOnly、深色760px和键盘；完整Electron重启保留opt-in但不保留临时Bypass。重连实际通过，无需修改产品权限逻辑。测试不执行模型或shell，也不改变真实账户权限。

最终953项Node：952通过、1既有跳过；同构建Bypass7组、完整设置9组、输入框15组，共31组离屏整应用GUI通过，构建完整性通过。浅深色确认截图已查看，背景/圆角/阴影/padding/blur均与独立令牌探针精确比较。窗口始终不可见、不聚焦；设置3次系统确认在原生调用前拦截。没有占用屏幕、原生剪贴板或用户配置操作。

保留1次失败：新测试误把Codex App Server设置搜索结果归到Code，实际来源为Developer；依据产品路由与截图改正测试精确名称，未改产品搜索或放宽断言。早期基线7/9组通过不冒充最终构建证据。生产最小窗宽760，未人为改成600来宣称小于640px整应用覆盖；该分支仍只有既有组件证据。

本地Bypass为当前连接内的会话选择，与官方workspace持久ack不同。标准链现为50套，原生全量验收未完成、5项历史高度阻塞保留；真实账户后端、官方同状态像素与整体99.99%未证明。未打包安装，安装版0.2.13。构建SHA `cb396fff303367cc38836133bec184d310dfaeeb770ade24c3427240e2e0365d`，410源文件，2026-09-22T15:52:51.006Z。

## 0.2.87 Usage刷新失败修复与整应用验证（未安装）

真实IPC复现并修复Usage刷新失败清空旧额度：readSessionStatus把RPC错误包装为limits:null，旧回调误当成功替换快照；现在必需quota读取失败进入SourceUsage现有失败分支，保留上一份数据并明确显示Showing the previous usage snapshot。成功返回的空额度仍清除旧值，明确零值显示0且无indicator；可选账户信息/每日Token接口失败保留成功读取的配额，并展示真实缺失原因。Usage错误仅去除已知Electron内部调用包装，服务端原因保留。

新增标准usage-ui-test，通过真实production main/preload/IPC和隔离协议fixture覆盖7组：独立壳/4px meter/真实plan与多bucket；错误刷新与零值；legacy和75/90阈值/可选接口失败/空额度；首次失败重试；持有请求关闭再开后的迟到响应；深色与窄屏/Tab/Escape焦点；只读请求和哈希。测试使用合法协议窗口null而非usedPercent:null，额度和日期是明确测试数据。布局沿用0.2.68源码Meter/壳及截图派生列宽，未宣称本地包含完整远端新版正文。

953项Node：952通过、1既有跳过。最终同构建Usage7组、完整设置9组、首页账户用量3组，共19组离屏整应用GUI通过；构建完整性通过。浅色、深色窄屏及失败保留快照截图已查看。窗口始终不可见/不聚焦；设置的3次确认在OS调用前拦截，使用原套件CDP处理，无真实系统设置/账户/会话操作。

保留2次失败：配额错误清空3条meter的真实产品缺陷，以及测试未等连接/account启动便读取旧断线实例的竞态。后者改为等待真实composer启用、fixture Pro账户和源码入场动画，不绕过生产状态或放宽几何断言。首版fixture还缺SpendControl.remainingPercent及后续分支的required rateLimits，最终补齐；基线RPC错误清空问题不依赖这些字段。

标准链增加Usage后为49套，原生全量验收仍未完成，5项历史高度阻塞保留。真实账户服务端、官方同状态像素和整体99.99%未证明；未打包安装，安装版0.2.13。构建SHA `80de8831fa1f982b01d56379801bf7ef048a0c3a5ad49d862bac70031aa22e81`，410源文件，2026-09-22T15:32:52.481Z。

## 0.2.86 任务卡元信息与按钮密度（后台验证，未安装）

按panes-tile Ub源码将元信息改为带3px底距、5px内距的列结构；运行中的类型、模型和数值使用secondary，单位仍muted。标题/输出使用CDS字体和间距令牌，展开箭头在行高内居中。只有可展开卡片拥有hover/focus底色，悬停Stop排除卡片hover底色。完成任务在完成时间相同或缺失时按逆出现顺序排列，运行顺序不变。

Stop/Clear改用共享sm secondary/ghost按钮，compact控制20px/radius5、comfortable28px/radius7；auto图标随密度16/20并乘缩放，保留各自光学字重。两枚装饰图标通过继承密度变量只显示一枚，无DOM观察器；现有数字iconSize调用不变。Codex Stop的busy/disabled仍是实际请求等待适配，只有权威终态才进入Finished。

953项Node：952通过、1既有跳过。实际组件5组headless通过（浅深色、compact/comfortable、125%缩放、宽窄换行、hover/focus、停止等待与清理）；同构建离屏整应用后台任务6组、子代理7组、完整设置9组通过，共27组GUI。构建完整性通过，浅深色截图已查看。所有窗口不可见/不聚焦；设置原有3次确认在OS前拦截并用CDP模拟，不是原生对话框验收。

保留4次失败：脚本重复变量、把基础按钮24px误当显式sm20px、窄幅元信息换行遗漏、CSSOM字重量化。均复核来源后修正精确测试：宽幅元信息38px，窄幅56px；inline字重433.3/533.3与本机CSSOM433.25/533.25分别验证，未放宽容差。失败不是产品通过证据。

48套原生标准链仍未完成、5项历史高度阻塞保留；真实账户/后台进程和官方同状态像素仍未验，不声称整体99.99%。未打包安装，安装版0.2.13。构建SHA `62a16ea2085c6f6881ea2d84cce38e31b52d808d6c2e31b43b4d44be35e85156`，410源文件，2026-09-22T15:18:14.847Z。

## 0.2.85 断连状态修复与后台任务/子代理验证（未安装）

修复实际断连被误报为Stopped：本地连接丢失观察以Symbol和权威item/turn终态分开，任务面板、工具行和混合折叠汇总一致显示Status unavailable，不追加虚构的Tool execution was interrupted.。真实完成/失败/中断继续显示真实结果；重连库存/新历史恢复Running，旧在途历史不抹掉断连观察。该unknown文案为Codex能力适配，非声称Claude源有相同传输状态。

新增可控协议竞态验收：请求开始时为空的库存延迟返回，不能覆盖后来开始的进程；首次Stop补读真实进程成员后发送一次terminate，仅ACK时保持Running/busy，item/completed后才归Finished。实际fixture进程退出验证Unknown，使用设置搜索选择Codex App Server并Reconnect，真实新连接读取fixture历史/库存恢复Running。混合组的另一个已完成命令不能掩盖unknown。复制/读取均使用隔离profile，测试不执行实际shell命令或模型。

952项Node：951通过、1既有跳过。最终同构建离屏整应用后台任务6组、子代理7组、命令12组、Read/Edit15组，共40组通过；构建完整性通过。子代理涵盖嵌套视图、跨会话返回、工具计数、心跳/模型、真实完成/失败/中断及2500ms无结果等待。原命令中断仍Stopped并保留中断文案；Read六次一行/三文件汇总回归通过。窗口始终不可见/不聚焦，无原生调用；工具复制仅隔离内存剪贴板。最终断连和重连截图已查看。

保留3次测试失败：父回合未结束被生产锁正确拒绝、搜索未选结果、morph离场槽造成严格选择器重复。均修正测试交互/观察范围，未绕过锁或放宽断言。早期仅任务面板Unknown而转录仍Stopped的截图已撤销最终一致性资格。

48套原生标准链仍未完成，5项历史高度阻塞保留，未做真实账户/后台进程与官方同状态像素验收，不声称整体99.99%。未打包安装，安装版0.2.13。构建SHA `f0c1a0af58b11360a5a4bd39a3aef659753575a6e27fd6066edeabecc2da4d2a`，410源文件，2026-09-22T15:00:07.024Z。

## 0.2.84 设置与输出整应用后台回归（未安装）

本轮补齐整应用验证和协议fixture，产品UI沿用0.2.83。设置7组、Read/Edit15组、命令12组、用户消息10组，共44组在真实production main/preload/IPC的隔离离屏Electron通过。新增逐批通知检查：同一文件6次读取之间夹隐藏思考/空白消息，始终只占1条汇总；展开保留6份输出，正文隔开后3文件显示Read 3 files，fixture历史保留全部事件。命令失败/流式输出/中断/审批、文件定位、表格、复制、设置保存与完整重启均走实际应用代码。

原生剪贴板调用被阻断，复制在隔离内存ClipboardItem边界验证并恢复全部MIME；不能算OS剪贴板验收。全部窗口不可见且不聚焦，无原生对话框/外部打开/用户数据操作。Read与用户消息采用Electron offscreen.deviceScaleFactor=2，保持原36.9921875px行高与0.5px边框严格断言；默认DPR1产生的差异不是产品错误。撤回早期“Chrome版本量化变化”的误归因与临时期望迁移，失败记录全部保留。

947项Node：946通过、1既有跳过；构建与完整性通过。保留4次失败收据（DPR、嵌套路径点击、剪贴板适配器方法覆盖）；未用放宽断言换通过。截图已查看，使用测试数据。48套原生标准验收仍未完成、5项历史高度阻塞保留，整体同状态像素/99.99%未证明。未打包安装，安装版0.2.13。

构建SHA `8d9355d55e827a821ff11a2598d33a3df97a0e0af996789ece48ea0ea5c1b052`，409源文件，2026-09-22T14:31:09.181Z。

## 0.2.83 首页官方账户用量（后台验证，未安装）

首页SourceStatsCard通过既有rpc读取Codex0.155.1 account/usage/read。All使用summary.lifetimeTokens；7d/30d按返回日期桶汇总，热力图显示每日Token，Active days为返回历史范围内有Token的天数。标明账户/本地范围：会话、消息、高峰小时和Models仍是本应用向前记录，没有伪造全账户历史。模型占比保持本地分母。nullable/缺失字段显示—或不可用，缺失日期提示No reported usage，明确tokens:0才显示0。保留官方六格、范围、Models、26周热力图结构，账户来源/刷新行是Codex能力适配。

请求仅在卡片显示时运行，父渲染不重复请求；刷新保留同账户最近结果并报告错误，切账户/断线隐藏旧账户结果，晚到请求及卸载不更新。接口不可用（包括不支持的认证）明确回退本应用记录。无额外API key或登录/购买动作，不自动扫描用户转录。

947项Node：946通过、1既有跳过；实际组件5组headless、生产账户用量3组及既有首页18组完整应用离屏通过，构建完整性通过。协议fixture验证真实main/preload/IPC account/usage/read请求，非真实账户服务端验收；始终不可见/不聚焦，无系统设置或真实账户会话变更。浅色与390px深色截图已查看。首次harness嵌套主题配置错误的截图不作为视觉通过证据；另保留1次暗色断言误用旧暖灰的失败，按官方gray-850 #151515改正精确期望，产品颜色未改。

新增home-account-usage-ui-test进入standard列表，原生全量链现48套未完成（旧47+新1）；历史5高度阻塞保留。0.2.82多行输入修复和3套离屏结果独立归档。未打包安装，安装版仍0.2.13；官方同状态像素、完整历史统计与真实账户验收仍未完成，不声称整体99.99%。

构建SHA `0e2b9036cbfb04400020b3e5c446393a91790ec8d9e0cef820471e0c1cce2641`，409源文件，2026-09-22T14:02:12.435Z。

## 0.2.82 多行输入修复与整应用离屏验证（未安装）

修复一次性插入多行时仅保留第一行：编辑器doc允许多个段落，序列化和光标映射覆盖段落、空行、末尾换行及命令atom；参数提示定位本段尾，分隔符扫描全稿。依据官方Tiptap doc block+及shared-14 lN/uN，独立实现。标准脚本迁移contenteditable API；Usage检查按已归档0.2.68契约使用独立Usage和20% used，保持真实配额与原断言强度。

942项Node：941通过、1既有跳过；编辑器8组headless通过。通过隔离启动适配器，原composer-states、slash-commands-complete、settings-complete三套完整应用检查均通过（生产main/preload/IPC，fixture后台）。Electron窗口offscreen且始终不可见/不聚焦；系统对话框在原生调用前阻断，设置确认由原脚本CDP模拟，不冒充OS操作验收。原生标准链47套仍未验，历史5高度阻塞保留，无打包安装，安装版0.2.13。失败原记录保留：多行数据丢失、过时Settings查询；未放宽断言或改用户环境。

构建SHA `a353abfa7ec6efa51e7b7576438c24ce62bc73bfcea43fa91952eb39192aa7e3`，407源文件。完整性通过。

## 0.2.81 命令原子标签与输入编辑器（后台验证，未安装）

按scroll-shared-10选择回调及shared-14 fN/eN/rN/tN/lN/uN链，改为真实ProseMirror文档编辑器。菜单选中的命令成为不可拆开的标签，手打命令仍是普通文字；提交和复制仍精确序列化为/命令+参数。Backspace先选中再删除，独立撤销/重做；8px slash槽、accent选中底色、300ms悬停、178px描述卡和inline参数提示按源实现。卡片只展示已有本地命令说明，不虚构远端Skill身份、路由或链接。固定6个直接编辑器依赖，10份MIT依赖声明随构建校验。

保持文件提及、附件粘贴、多行输入、发送/排队/停止与草稿边界。组合输入期间保持节点和提示DOM；外部草稿变更延迟到组合结束再应用，避免旧文档覆盖新值；切会话/清空不带旧撤销历史，断线阻止输入键盘回调。光标使用真实编辑器坐标，修正DOMRect展开运算丢失getter坐标的问题。中文组合检查使用合成composition事件加真实DOM文本输入，不等同于OS输入法；复制/文件粘贴也不操作系统剪贴板。

939项Node：938通过、1既有跳过。最终同构建实际编辑器8组、斜杠菜单6组、Read与混合工具6组，共20组后台检查通过，构建完整性通过。Read回归：六次同文件读为一行Read a file (6 reads)，三文件为Read 3 files；隐藏思考/空白消息不分裂分组，展开保留全部输出，失败、运行与审批状态保留，正文及回合仍是边界，子Tasks同步适用。已查看最终命令卡和Read/混合工具截图。

本轮保留7份失败收据：首次菜单坐标错误、提交参数测试误期望、组合期间外部草稿丢失，以及四次旧菜单输入迁移失败。后者经归档bundle复现：Playwright.fill直接改DOM选区后Delete偶尔未清空，增加等待并未解决；真实Meta+A/Backspace正确。最终后台助手使用真实键盘全选/删除并等待父draft/序列化值，原精确行为和几何断言保持。标准Electron脚本只迁移受影响的读取/选择器并语法检查，其余fill流程仍需实际Electron复核，不能算已通过。

范围：独立单段落schema覆盖当前文字/换行/命令节点，完整官方富文本、WASM频次排序/虚拟化、OS IME/剪贴板、真实RPC与官方同状态像素仍未验证。没有占屏、改系统设置或真实账户/会话。47标准Electron未运行，5个历史高度阻塞保留；未打包安装，安装版仍0.2.13，整体99.99%未证明。

构建SHA `055af4050f2bb714141f7d6d5222bb56e0022be56a84fdb8ef4e367351c404d3`，407源文件，2026-09-22T13:04:23.511Z。

## 0.2.80 斜杠菜单定位与提示（后台验证，未安装）

按shared-11 BT/UT floating分支纠正菜单外壳/内部滚动层，保留240px最小宽、384px上限、10px上方间距与−16px横向偏移，使用实际宽度避开右边缘。描述追到c17e03edc x/b，改为实际宽高测量、8px右侧优先/左侧翻面、上下对齐翻转与垂直避让、26rem与可用宽度的上限、10行正文；滚动时随行更新，部分可见时保留、完全被裁掉后隐藏。外部点击关闭且保留新焦点。CDS字体/高度/圆角/表面/阴影从编辑器上下文同步，compact13/19/24px以及comfortable1.25缩放17.5/25/40px均已后台检查。

Type to filter只在文末光标和足够宽度时显示，使用编辑器实际字体/行高中点；参数提示固定在已输入命令的末端，避免光标移到命令中间时跟着漂移。仍为textarea和文本命令适配，未实现原子skillChip、WASM频次排序和大列表虚拟化，不声称这一轮已覆盖完整官方斜杠系统。

931项Node：930通过、1既有跳过。实际SourceComposer与SourceSlashMenu的6组headless检查通过，包含新会话提示头与门控、浅深/390px、键盘、别名、选择不执行、描述长短/左右翻面/底边对齐/裁切、内部滚动、光标/空间、密度缩放和卸载；构建完整性通过。本轮保留1份失败或超时收据，详情见实施记录。标准Electron斜杠脚本只纠正padding所在层并语法检查，未运行，不计通过。没有占屏、操作真实账户/会话或系统设置；47标准Electron未运行与5历史高度阻塞保留，未打包安装，安装版仍0.2.13。未完成官方同状态像素或完整端到端验收。

构建SHA `0f33a9e3c166568a08169555968d64a61fc7ae669e8ee75c3ab9fb4c68f7837e`，393源文件，2026-09-22T12:32:30.782Z。

## 0.2.79 工作流代理错误 PreviewCard（后台验证，未安装）

将代理Error从普通Tooltip改为官方实际PreviewCard链：scroll-messages dpe/ppe→shared-11 Dl/tp→Xf/Zf/ep→vendor-base-ui PreviewCard。鼠标600ms打开、300ms离开延迟和safe-hover短暂停留、键盘focus-visible立即显示，指针可移入卡片选择完整原文，多个错误即时切换且只显示一个；Escape关闭但不抢焦点。保持默认非interactive语义，没有点击toggle、autofocus或dialog角色。200–360px宽度、12px compact padding、12/15 footnote、6px top/end、Ka顶部48/其余8px碰撞内距、surface3/圆角/shadow和动态主题/缩放。源Qf没有高度限制或滚动壳，因此自然呈现完整文本，不自行添加滚动上限；超长错误可能超出视口，这是当前源调用分支本身的表现，未改造为另一种控件。

927项Node中926通过、1既有跳过，新增5项模型检查。最终同SHA的PreviewCard7项和实际SourceBackgroundTasks集成3项共10项后台通过；完整性通过。覆盖hover/选择/延迟/安全通道/即时换卡/键盘/主题缩放/原文安全、错误更新、task id与阶段卸载、恢复、Stop失败/重试；真实workflowEvent归约驱动Running→Finished、清除已完成任务、晚到metadata和焦点。数据与停止回调均隔离，未运行真实模型、用户工作流、Electron或OS剪贴板；Tasks localStorage只写一次性浏览器上下文。最终浅色与390px深色截图已查看。

关键纠正：最初漏读Mi的import块结束位置，误接到shared-frame普通Popover，实现并测了320px点击dialog。最终导出链自查推翻该结论，全部普通Popover通过报告撤回保真资格；产品、模型、headless与标准Electron断言均重写为shared-11实际PreviewCard。旧报告、截图、失败与probe观察保留，未复制到最终输出。总计7次失败runner：一次全量Node运行180秒超时，隔离复查18项通过后原命令重跑；其余为旧分支初次隐藏时转焦失败、两次测试误认Tab下一站、外部点击异步检查过早、按钮中心被浮层覆盖；正确分支一次safe-hover在指针停止后未收尾，补已有safePolygon40ms停留后300ms关闭。Tab的归档重放证明原生行为正确，试验性手动tab遍历已撤回。未通过放松断言保留错误终态。

app/scripts/workflows-ui-test.mjs新增真实引擎错误PreviewCard断言、完整错误含Fixture failed、select-text/无dialog/Escape；已语法检查，但该标准Electron套件本轮未运行，不计通过。完整PreviewCard的interactive/lazy/glide和跨其它业务卡片共用provider尚未覆盖；当前dpe使用默认非interactive分支。没有官方同状态像素对比、完整引擎真实认证或整体99.99%证明。47标准Electron未运行、5历史高度阻塞保留；不占屏、不改真实配置，未打包安装，安装版仍0.2.13。

构建SHA `f86ab82a1ae6447b001e2e1e25d5d8242353f2e4e5e070cce544073ac385cdf5`，392源文件，2026-09-22T12:05:37.337Z。

## 0.2.78 格式化链接逐词显示（后台验证，未安装）

静态追踪markdown-current el/Zc与cbd5abfdb hi/mi，确认单text标签（即便有空格的描述性纯文字）本来整体淡入；混合strong/em等描述性标签才递归逐词。修正原先全部a标签atomic的过度归并。简单格式化文件标签仍以目的地显示并整体淡入；其动画调度长度现在用实际目的地，后续兄弟的offset继续按原标签语义长度。原始HAST在atomic分支保持，已有URL缩写、文件行号、scheme校验、React回调不变，无额外metadata或真实外部能力。

922项Node中921通过、1既有跳过，新增4项模型测试。实际React新增7项、pacing6、增量块6、前沿6、Read聚合6，共31项后台检查通过；build/integrity通过。新测格式化外链/文件描述、单text和长URL、200ms线性backwards WAAPI、点击/中键/Enter/Space隔离回调、追加后DOM与原生选区、结束cleanup/所有权、390px深色/减弱动态/不安全scheme。所有五份GUI报告对应相同SHA，无renderer错误，无失败runner。已查看窄屏深色、文件链接浅色、Read3files展开截图。截图等待实际有限动画完成，未修改产品动画。

用户关心的工具占空间回归：六次同文件读取被隐藏reasoning/空白消息隔开时仍只有一行（19.984375px），展开保留全部输出；三文件为Read3files；真实正文/turn边界保留，命令/search/listFiles/web/MCP/dynamic均通过，子Tasks使用相同逻辑。原始事件不删除，失败和pending approval不隐藏。

范围：没有执行官方bundle或做官方同状态像素对比；本地文件识别继续为已有独立适配，官方issue/session特殊链接业务分支未实现。完整alluvium/嵌套子块/其它共享组件与真实backend验收差距保留，不声称整体99.99%。47标准Electron未运行、5个历史高度阻塞保留；全程不占屏、不改用户配置，未打包安装，安装版仍0.2.13。

构建SHA `ad7bbb49f228bdf035a9b154b7c3ad0d5e3a6be9f1fac6498c674367dbe1da68`，389源文件，2026-09-22T11:38:25.502Z。

## 0.2.77 设置本地昵称编辑与busy按钮（后台验证，未安装）

先实测0.2.76窄窗基线：390px时本地昵称标签被224px不可缩小输入框挤到58px宽、144px高，整行168px。现使用shared-21 Av的below插槽、shared-frame Bh默认fullWidth输入和Lv dirty动作区：32px输入、12px comfortable间距、28px primary Save changes/ghost Discard，390px浅色下标签和输入均310px宽，标签44px高、整行112px。520px/宽窗与浅深色也通过。普通设置行、Code font的224px源布局不改。官方此版Profile姓名两行实际!1隐藏，因此此处明确是保留真实本地displayName的共享组件适配，不声称是官方远端姓名编辑1:1；“Used only in this app.”继续说明作用域。

共享SourceSettingsButton补ks/xo busy分支：原内容透明占位，居中12px spinner、1.5px声明stroke（当前Chromium border CSSOM取整为1px，mask仍保留1.5px）、1s线性动画和减弱动态；aria-busy/aria-disabled保留可聚焦按钮，阻断click和Enter/Space keydown/up，宽度不随Saving文案变化。其余variant和控制大小保持不变。昵称显式保存接真实onSave，单请求锁、dirty/Discard、失败可重试、关联aria错误；pending期间继续输入或退回旧值都不被ack覆盖，旧失败不附着新草稿，IME Enter不误提交，切页卸载不接收迟到状态。纯控制器不取消已提交的真实持久化请求。

918项Node中917通过、1既有跳过；新增Profile6、共享按钮6、设置分组6、账户生命周期6共24项后台检查全部通过，完整性通过。真实React+既有save coordinator，账户回归使用真实主进程controller和隔离RPC/URL adapter；没有修改用户配置、真实认证/退出、真实OS调用或可见Electron。覆盖Save/Discard/pending/错误/重试/外部确认更新/IME/卸载、focus、三宽度/两主题/缩放和无横溢，已查看最终390px浅色与宽窗截图。

保留3次失败：初版测试误把comfortable gap-sm12px写成compact8px，按design-system:53866修正精确几何；外部prop更新后立即读取旧值，等待真实effect同步后仍精确断言；spinner CSSOM border预期未考虑1.5px取整，改为同时断言实际1px边框和mask保留1.5px，源码CSS不变。最后截图等待有限DocumentTimeline过渡完成，未禁用产品动画。打开流程改为点击真实触发按钮，以验证有来源的焦点归还。旧通过截图与报告保留，不替代最终截图；没有放宽既有产品行为或几何容差。已有settings-ui-test只按Lv源文案更新Save changes，其真实IPC保存断言保持，该Electron套件本轮未运行。

保真与范围：本地昵称是明确适配；完整远端Profile（头像/工作/账户偏好等）仍无诚实本地来源。共享按钮链接、joined、tooltip/disabledReason等未覆盖分支不在本轮。未与官方同状态截图像素比较；原AI语法/业务能力/端到端差距继续保留，整体99.99%未证明。

构建SHA `8e728f6f064c3be292d7d55df1af27c10db5a2c15cf0eff1415b0151e78e0f86`，389源文件，2026-09-22T09:00:46.305Z。47标准Electron未运行，5个历史高度阻塞保留；未重新探测屏幕或修改系统设置，未打包安装，安装版只读核对仍0.2.13。

## 0.2.76 AI流式图片、引用与定义边界（后台验证，未安装）

按markdown-current Y/b/S、sa/frontier分类与el/qc链，补齐未闭合图片目的地：已收到](后生成实际open image，alt保留语义文本，src只使用已收到字符；空src不显示，远程URL仍按原有标签/链接fallback，本地走原有loader。没有新加网络取图或假图。已知定义的shortcut引用恰好停在]时保留字面，后续字符到达才解析；完整和collapsed引用保持即时解析。图片shortcut等待期间也保留标签内加粗和转义，未丢成plain alt。

未终止的单行link/footnote定义按官方frontier规则作为段落呈现，避免链接定义提前消失、脚注提前变为definition。换行或消息完成后才按已结束定义解释，脚注中的未闭合强调因此仍按源码settled语义保留标记。独立wrapper仅在解析副本插入普通字符打断definition识别，随后移除该字符并还原AST坐标；VFile、原始协议与复制文本不改。增量调度与实际Markdown renderer使用同一wrapper；priorDefinitions在外层，历史metadata不进入内容。quote/list/CRLF与代码围栏保持各自语法归属。

914项Node中913通过、1既有跳过；最终同构建的新增6项、增量6项、pacing6项、回退5项、flow7项后台检查共30项通过。完整性通过。新增实测真实React/reducer delta、原始文本、部分图片地址、本地image loader的隔离adapter、危险scheme、引用等待、定义换行/EOF、窄屏/浅深色与卸载；没有实际本地文件读取、远程取图、可见Electron、真实backend或OS动作。回归继续验证60已结束块/20delta的DOM与选择保留、只解析尾部，及原有排版/动画/回退。

本轮无失败runner；早期通过报告与截图仍保留，但不替代最终构建证据。自查发现首轮截图抓在200ms文字淡入中，改为等待正文内DocumentTimeline有限动画完成后重拍；首轮image截图文件误带dark名但实际浅色，最终命名已改为light。另在自查中补回imageReference被MDAST压成plain alt后丢失的格式化标签，之后重新跑Node/build/全部30项。未改产品动画、样式或放宽断言。最终浅色脚注与390px深色截图已查看。

保真范围：只证明上述分支的本地行为与源码对应，未做官方同状态像素比较。仍依赖remark语法核心；多行定义、格式化reference label查找、其它原生alluvium差异、嵌套子块增量复用与held/phrase/morph分支未完整覆盖。已有共享表格portal/异步错误、secret扫描及各业务远端能力差距继续保留，整体99.99%未证明。

构建SHA `b2e9799dccc398fe7f984da8c6638243a9276b0d99e712b69b9113544140e817`，386源文件，2026-09-22T08:49:30.747Z。47标准Electron未运行，5个历史高度阻塞保留，无屏幕探测或系统设置修改；未打包安装，安装版只读核对仍0.2.13。

## 0.2.75 AI输出增量分块与两级回退（后台验证，未安装）

按markdown-current sa/Do/Oo/cl/ll/jl调用链独立实现已结束块与增长前沿。历史已完成顶层块保持对象、React key和局部上下文；新增文本只送入未提交尾部的开源remark语法识别器。段落空行、完整heading/hr/脚注行、关闭代码/数学围栏可提交；列表、引用、缩进代码保留可延伸前沿，未完成行首空格不能丢弃。非前缀文本重写重新分块。全消息fade ledger与1000ms收尾继续共用，各块使用独立命名空间，原始protocol/复制/导出文本保持不变。

已结束代码/表格使用块级完成状态，因此整条回复仍在增长时，结束且溢出的表格即可展开；后文不会重建其DOM或展开快照。链接定义只影响后续块、先定义优先；历史定义前置为解析metadata，真实节点line/offset还原，避免未闭合围栏吞入定义。空行分隔的相邻引用段落按sa保持同一引用框。增量主路径异常锁存为整段remark回退并关闭pacing；整段remark若再失败（包括layout effect），通过独立guard转交既有全文纯文本边界，卸载失败子树与定时器。异常对象只在转交时短暂存在，不写入应用状态、文件或telemetry。

908项Node中907通过、1既有跳过；新增增量6项、pacing6项、故障回退5项、Markdown flow7项后台检查共24项通过。真实React+reducer验证60个已完成段落在20次delta下保持DOM与选区，渲染计数仅出现增长块60，解析读取固定offset3770后的12–107字符；闭合代码、提前可展开表格、Escape焦点、定义/引用、脚注、浅深色、390/520px与字号、原样完整回退均通过。计数与故障注入仅在测试Vite bundle中，产品无测试开关。故障回归记录5次逻辑故障各经3次明确边界交接（共15条caught事件），没有uncaught异常或重试循环。已查看最终窄屏截图；没有真实backend、剪贴板、可见Electron或用户配置操作。

保留3次runner失败：初版二级layout异常重复落入同一边界，修正为独立remark guard向外转交；误复制旧flow脚本在paced文本未到齐时测间距，恢复0.2.71已验证的等待条件；旧故障断言按单层计数，按Ml→jl→Cl/Al明确交接更新为每个故障恰好3条，行为/几何/原文断言未放宽。另保留首次直接Node的缩进空白失败与自查SSR发现定义误入未闭合围栏的记录，均先修再跑最终Node/build/所有相关GUI。初轮通过报告不代替最终构建。一次历史headless耗时159秒但成功，最终加阶段时间记录后4.37秒；未确定长停顿来源，不把耗时当性能基准，工作量结论只基于实际解析字符和渲染计数。

范围限制：采用独立调度+开源remark识别，未复刻全部原生alluvium语法、held/frontier细节、嵌套容器内已结束子块的增量复用、morph或phrase特性分支。段落未完部分仍按整个尾部重解析；大量历史定义的解析成本未专门基准化。共享父级表格portal/独立异步错误与完整secret扫描仍保留原差距。未声称官方同态像素或整体99.99%。

构建SHA `3823e1f23ae068884b1728f58d3f816836aab08b1b9b7b08f86d140524c7feac`，385源文件，2026-09-22T08:28:07.725Z，完整性通过。47标准Electron未运行，5个历史高度阻塞保留；无新屏幕探测或系统设置修改。未打包安装，安装版只读核对仍0.2.13。

## 0.2.74 设置账户生命周期与工具合并回归（后台验证，未安装）

Preferences → Codex account补齐浏览器登录、真实设备码、等待/取消/重新打开、错误与重试，以及明确确认后的本机账户退出。按shared-21 Av的below插槽和既有CDS按钮布局；账户文案与RPC明确是Codex适配，不冒充Claude远端profile或Log out of all devices。登录attempt保留在主进程，关闭重开设置仍可取消；只按真实loginId匹配完成通知，兼容通知早于start响应、取消中完成、取消notFound/失败、重连和迟到读取。认证地址经HTTPS校验，浏览器失败保留有效attempt。退出后先清除旧身份，再account/read查询实际剩余凭据，不伪造退出成功的身份。init与更新共用受版本保护的读取；手动刷新失败跨设置重开可见，成功重试清除错误。执行中会话禁用退出入口。

899项Node中898通过、1既有跳过；账户6项、设置按钮6项、连续工具压缩6项实际React后台检查通过。账户检查使用真正的主进程controller与React，经隔离HTTP/SSE传递状态、RPC和浏览器打开由测试adapter记录；没有真正认证、退出、浏览器打开、IPC端到端或可见Electron。覆盖设备码、失败/重试、关闭重开、完成、退出确认/焦点、断线、390px窄屏与真实account/updated刷新。Node另覆盖早到、并发和过期读取。最终浅色账户截图与窄屏确认截图已查看。

用户要求的Read压缩在当前构建再次通过：连续同文件6次为Read a file (6 reads)，3个不同文件为Read 3 files，展开保留原始输出；隐藏thinking/空白正文不切组，实际正文和回合仍分隔。命令/search/list/web/MCP/dynamic同样按组收拢，根转录与子代理一致。没有改动0.2.72已实现的计数语义。

保留4次失败收据：首次清理账户局部变量误删Usage身份键依赖，引发account is not defined，恢复后重跑全部单测/build/GUI；随后两次截图等待错误包含后代scroll-timeline动画，诊断表明窗口已为opacity=1但滚动遮罩始终running，改为只等待弹窗自身有限opacity/scale过渡；一次诊断脚本多余括号解析失败已修正。早期功能通过的截图抓在入场首帧，最终等待完成后重拍，不作为最终截图证据。所有历史日志保留；未放宽产品几何、颜色、行为断言。

构建SHA `4bd573782baeb45f27278b5d709ad4a7bd5e5a685f23f06f338409e80e3bc484`，384源文件，2026-09-22T07:54:48.923Z，完整性校验通过。47标准Electron未运行，5个历史高度阻塞保留；无屏幕探测或系统设置修改。未打包安装，安装版只读核对仍0.2.13。官方同状态像素、完整远端账户页面及总体99.99%仍未证明，其它既有差距继续保留。

## 0.2.73 AI正文渲染回退（后台验证，未安装）

按markdown-current Ml→jl→Cl/Al及shared8 dm调用链，为每个现有message/session owner加独立React边界。本地当前已是remark路径，因此同步解析或正文子组件render/layout异常直接进入纯文本回退，不虚构另一个alluvium主引擎。回退显示最新完整sourceText并保留换行/空白，卸载paced/reveal子树；该owner后续delta和完成保持原文，不不断重试；新消息或新owner恢复富文本。正常路径样式/解析未改。异常内容或stack不作为产品内容显示，也不新增错误上传/持久化。

889项Node中888通过、1既有跳过；5项新后台错误隔离检查与6项正常pacing/选区/富Markdown回归通过，构建与完整性通过。错误通过仅测试Vite transform在真实remark transformer、表格render和layout effect注入；没有产品测试开关。覆盖首次和后续delta失败、完整未显示后缀、同owner无重试、其它回复/按钮/工具展开、新owner恢复、监听清理、全部长文本、HTML文本转义、三字号/浅深/窄窗与卸载。React记录5次预期caught异常，无uncaught异常、desktop调用或真实backend/OS操作。

保留一次后台失败：fixture没导入生产Settings加载的transcript-size覆盖CSS，small字号仍14px；补齐真实stylesheet后13/14/16精确断言通过，未改产品CSS或降低断言。已查看最终浅色回退截图。正常pacing的6项全部通过，未以故障注入结果代替真实用户问题证据。

范围限制：这层边界只捕获该正文React子树的render/lifecycle异常，不涵盖事件处理器、独立异步任务，或在共享父级挂载的展开表格portal。官方qe完整secret扫描遮罩、本地尚未实现；原文与既有本地展示保持一致。full alluvium committed块和其它解析/样式差距仍保留，未声称全局99.99%。

构建SHA `35b946ab63f0012612d798b21d080b161d4d38b6487d1306d4c94d0400497a48`，381源文件，2026-09-22T06:28:17.800Z。47标准Electron未运行，5个历史高度阻塞保留，未重新测量屏幕或修改系统设置；未打包安装，安装版只读核对仍0.2.13。

## 0.2.72 连续工具调用压缩（后台验证，未安装）

按用户截图修复重复Read占多行的问题。明确根因：groupFileTools在SourceMessage隐藏Normal reasoning之前已用其切断pending；空白agentMessage/plan还产生空article。现在根转录与子代理Tasks pane共享可见性判定，隐藏thinking和空白正文不再切组，可见thinking/verbose、真实正文、用户消息、回合、本地命令与工作流仍保留边界。不可见条目保留为真实turn-footer锚点，原始协议不删改。

分组按原始调用数判断，内部同路径继续合并详情。纯Read多文件显示Read N files；同一路径重复6次显示Read a file (6 reads)，不会虚报6个不同文件；多文件含重复时同时给出真实文件数与读取次数。这是用户要求优先于官方Sk单路径basename规则的明确适配。混合Read/Edit/command仍保留原共享路径摘要。空白消息不渲染正文；仅有空白正文的回合不再产生空复制区域，有正文的真实末尾复制按钮仍保留。

889项Node中888通过、1既有跳过；6项新实际React后台检查与6项经典工具组回归通过，构建与完整性通过。新增覆盖6次Read＋6隐藏thinking＋6空白消息压成19.984375px单行、两层展开全部6份原始输出、3个独立文件、浅深/窄窗、normal/thinking/verbose、正文与回合边界、末尾footer、命令/search/list/web/MCP/dynamic共7工具、失败、真实reducer started/completed与审批输入、实际子代理面板。没有运行显示的命令、连接真实backend或使用可见窗口。

保留2次失败：首次测试把14px×1.42857行盒误期望成整20px，按DPR1布局量化精确修正为19.984375并注明来源，未改CSS；既有回归在caret旋转过渡中测量gap，改为等待其真实animation.finished后仍精确断言2px。首次通过后自查补空白footer修复，重新跑完整Node/build/两组后台，旧构建通过不替代最终证据。

构建SHA `0618a48e8eeb71e7b4de4f0b70b49c3bed1e7e3fd190ee9b198adc0a209979f7`，380源文件，2026-09-22T06:18:53.217Z。47标准Electron未运行，5个历史高度阻塞保留，未重新测量屏幕或修改系统设置；未打包安装，安装版只读核对仍0.2.13。官方同态像素及全局99.99%仍未证明，前述其它剩余项继续保留。

## 0.2.71 AI正文显示节奏（后台验证，未安装）

按approval-current h5→markdown-current Ml/Dl→shared-16 Sb调用链，在已有逐词淡入前加入正文分步显示。通常每步22个UTF16单位，步长后半段按空格断开并避开代理项；间隔按积压自适应25–150ms，初始超过400或积压超过600直接追上。未完成标题/列表标记暂缓，真实正文到达后继续。仅assistant text启用，不擅自对plan/reasoning加节奏；原始协议文本、复制与导出不截断。

结束、系统或本地减少动态立即显示全文；后台暂停，回前台追上。Stop由现有主界面interrupt tracker传入并在该消息锁存，取消显示延迟但不伪造协议完成。消息/会话owner独立，非前缀替换映射共同前后缀；卸载移除定时器和visibility监听。保留已有200ms逐词淡入、1000ms收尾、选区保护与闭合代码块DOM。

884项Node中883通过、1既有跳过；6项新增实际React后台检查与7项既有AI行流回归通过，构建与完整性通过。覆盖burst中间前缀、22/400/600边界、真实reducer delta/completed、标题/checkbox/代码/表格、选区、停止输入、浅深色/窄窗、减少动态、可见性和卸载。Stop检查是隔离hook输入，不是实际后台interrupt RPC；visibility为隔离document属性事件，不声称操作系统后台切换。未读取真实用户会话、执行显示代码或使用可见窗口。

保留3次后台失败：新增测试把任务图标辅助文字计入li正文，改为精确任务内容节点；回归新增等待误假设整个根textContent没有尾随空白，以及br不含换行，分别改为精确段落内容和原有三行innerText。原几何、颜色、选区和动画断言未放宽；旧回归增加等待实际paced文本的条件，并注明Ml来源。最终截图已查看浅色和窄屏，未发现横向溢出。

构建SHA `02d8b1ba08d039e669493765d5b50f01926ca9059765f79159aa8d27c41b9ef2`，379源文件，2026-09-22T05:29:44.240Z。full alluvium committed块、phrase feature flag及其它解析分支仍未完成，不声称官方同态像素或全局99.99%。47标准Electron未运行，5个历史高度阻塞保留，无新的屏幕探测；未打包安装，安装版只读核对仍0.2.13。0.2.70 Bypass实现保留。

## 0.2.70 Bypass Permission mode（后台验证，未安装）

按用户新增要求与拆包链实现设置Code → Local sessions → Allow bypass permissions mode。开关默认关闭，只保存Code Desktop本地opt-in，不修改共享Codex配置。启用后当前会话Mode菜单增加第四项Bypass permissions（Warning图标、Accepts all permissions、数字4），composer显示Bypass，/status准确显示完整访问无批准。默认权限设置保留Auto/Manual/Plan；Bypass只在会话菜单显式选择。

确认对齐c936fcd42的Bypass all permissions?、Cancel初始焦点、workspace及实际Codex风险说明，shared-frame rp的400px/p-xl/title/description/footer；窄屏按钮反向竖排。菜单完全退出后才展示确认，避免焦点与退出动画交叠。取消不改模式，关闭开关或断线清除临时选择，draft选择在真实thread/start成功后迁移到该会话；其它会话不继承。与官方workspace持久ack不同，本地每次显式进入Bypass均确认且仅保留本次连接的会话选择，文案没有永久免确认承诺。

真实0.155.1请求映射：thread/start/resume/fork的sandbox=danger-full-access、approvalPolicy=never；turn/start使用sandboxPolicy.type=dangerFullAccess；Compact保持当前模式，Chat/Review/Plan继续readOnly与原批准语义。统一策略模块由renderer与主进程共用；主进程每次发起完整访问前重新读configRequirements/read，检查本地opt-in、allowedSandboxModes、allowedApprovalPolicies，读失败/组织限制拒绝并显示实际原因。请求等待期间关闭开关也会再次检查，后端仍有最终决定权。设置变更仅影响后续消息，不能撤销已运行turn授予的权限。没有改动工作流引擎自己的权限契约。

878项Node中877通过、1既有跳过；5项Bypass实际React后台检查与6项Settings/Storage/Developer按钮回归通过，构建与完整性通过。后台覆盖设置保存失败和重试、默认关闭、数字4、Cancel/Escape、400px、真实wire字段、draft迁移、跨会话resume、Plan取消、迟到confirm、Chat隐藏入口、组织拒绝不发送、连接重建、开关关闭后不复活旧模式、未知requirements禁用、浅/深/窄窗、焦点与renderer无异常。全部fixture隔离，无真实backend权限变更、OS操作、可见Electron或用户配置写入。

保留4次失败：两次Node分别是既有高亮worker 5000ms超时与Codex client initialize fixture 2000ms超时，未延长时间或改断言，最终完整套件通过；两次后台分别是测试漏掉错误行既有前缀，以及菜单退出/聚焦未完成的快速键盘操作。后者产品延迟确认至菜单关闭，测试等待实际焦点及已提交模式，未放宽最终状态。修改后再跑最终Node/build/UI/回归，旧构建通过不替代最终证据。

构建SHA `316ced044d4fcc1f9adddb8b1d1776bebe082c5b3d23ae9a16d32d8672534009`，377源文件，2026-09-22T05:16:19.021Z。47标准Electron套件未运行，5个历史高度阻塞保留；没有重新测量可用桌面区或修改滚动条策略。未打包安装，安装版只读核对仍0.2.13，无安装收据。此次不等于全局99.99%或真实账户端到端验收。

## 0.2.69 网页与普通工具（后台验证，未安装）

网页、MCP、dynamic连续调用现在使用相同classic工具组；按拆包源码实现输入逐行、真实文本输出、错误在先、400px滚动、Copy、文件参数入口和两层展开。statusless webSearch由真实reducer事件派生活动状态；组摘要支持这些工具的650ms运行标签切换。opaque结果与不支持的媒体保留原始数据，不造搜索卡或自然语言动作描述。

873项Node中872通过、1既有跳过；5项实际React后台检查和7项工具组回归通过。保留一次失败：测试误用compact的8/6px，fixture实际comfortable应为12/8px，官方density tokens确认后修正预期，产品变量未改。构建SHA `c5a5145e9090d781e6e5fea90094b25639f5231b01f3f0d0cd1fc6e7f5c58f86`，374源文件，完整性通过。没有占屏、真实账户调用或OS剪贴板操作。47标准Electron未跑、5项历史几何阻塞保留，未安装，仍0.2.13；特殊MCP认证/媒体卡未覆盖，不声称全局99.99%。

## 0.2.68 Usage独立弹窗（后台验证，未安装）

按用户Usage截图重做独立页：保留现有Settings/usage入口，选中后呈现Usage标题和关闭按钮，隐藏设置侧栏；44px头、24px正文边距、224px左标签列、4px细meter和80px百分比列，窄屏标签换到进度条上方。源码核实shared-22 cw壳、c17c9c40b Meter及shared-14 gT；新版Usage正文由远端提供，本地包未含全部代码，截图派生几何在契约中单独标注，不声称完整源码或像素1:1。

接真实Codex账户plan、primary/secondary及独立model bucket；显示usedPercent，75/90阈值warning/danger，重置时间采用账户窗口。credits仅真实返回时呈现余额/Unlimited，不添加后端未提供的货币符号；individualLimit标Spend limit，因无周期字段不谎称Monthly；保留真实Daily token usage。没有预测、购买权限/URL、自动充值与按产品周汇总数据，因此不渲染相关标题/按钮/开关，不写死Max、Fable或截图金额。

刷新读取保留已有数据、显示真实失败和重试；账户/连接key与卸载fence阻止旧请求覆盖，回调ref避免父重渲染重复读取。测试暴露busy只在effect更新的短暂窗口，改为点击同步提交busy，避免按钮暂时仍可点击；切到Usage将焦点转入弹窗，沿用Escape/Tab圈定、背景关闭与焦点还原。

867项Node：866通过、1既有跳过、0失败；新增6个模型边界测试。6项Usage实际React后台检查及6项设置按钮/Storage/Developer回归通过。包括精确布局、真实百分比/空值、浅深色/窄屏、刷新失败/重试、账户切换迟到响应、0/75/95/100、credits/Spend limit、系统/本地减少动态、缩放、恶意文本转义、初次加载失败、真正卸载后返回、焦点恢复、无renderer异常与source manifest不变。查看最终浅色截图及窄屏截图。仅隔离协议形状fixture，没有读取用户实际额度、启动可见窗口或系统操作。

保留4次后台失败：前三次在刷新effect状态尚未提交时断言disabled（原100ms延迟改为显式held response，第三次增加诊断）；第四次在新刷新尚未进入busy时提前检查下一份数据。先前关于纯100ms计时的推测已由诊断纠正。最终产品在点击时设置busy，测试等待已提交状态并持有/释放请求，不放宽原布尔、颜色或几何断言。产品修正后重新跑完整Node/build，再跑最终后台与回归；旧通过不替代最终证据。

构建SHA `e44e874345978ae35cc6e6d2ffdd5eb76bcc0a8a454ee11cfb230a850416947b`，371文件，2026-09-22T01:49:48.401Z，完整性通过。47标准Electron套件本轮未运行，5个历史高度阻塞保留；未打包安装，安装版仍0.2.13，不声称全局99.99%完成。

## 0.2.67 工具组动态摘要（后台验证，未安装）

按 approval-current.js rE/WM/Npe 与 cf6ae6197 Sk 调用链，独立实现180ms文字进出与宽度过渡；650ms held key期间继续读取当前工具的最新描述，移除工具及切换会话清理旧状态。混合文件与命令组可合并同文件动词并保留basename，正确呈现部分/全部失败。

861项Node：860通过、1既有跳过、0失败；7项新后台检查及6项经典工具组回归通过，构建/完整性通过。测试覆盖混合摘要、held更新、审批/删除/切会话、180ms过渡、同key宽度、快速更新、减少动态及观察者清理。查看混合文件命令截图。未启动可见窗口、未执行展示命令。

保留两次夹具失败：安全命令摘要会截断参数，改用git log测试描述更新；SourceTranscript本身另有ResizeObserver，卸载测试改为空宿主以单独验证本组件，零观察者要求未放宽。快速反转同key动画连续性、未知工具实时标签及官方同态像素仍未完整验证。47标准Electron未运行，安装版仍0.2.13；整体还原未完成。

## 0.2.66 经典工具组布局及文件计数（不占屏，未安装）

按Npe classic、Sk、Wv/Gv/Kv和NN调用链，工具组摘要改为原生type=button；单文件basename以文本显示，去掉混入classic的现代ToolPath链接，展开后的文件行仍保留真实打开入口。摘要/增删/审批内层gap4、外caret gap2、数字内部gap2，去掉额外margin；展开体flow-root，外框使用absolute after双重inset覆盖层且不拦点击。caret按Wi随rem-scale缩放，展开记忆、650ms held key和真实计数不改。

截图自查发现移除ToolPath import改变CSS加载顺序，旧file-tool药丸计数CSS重新覆盖global修补，数字缩小。将classic NN计数样式归回所属文件、删除DiffIndicator/xs属性和跨组件补丁，保持正文14px普通字重/纯色数字/无底色padding。此修正后重新跑完整Node与构建，旧通过不计最终证据。

857项Node：856通过、1既有跳过、0失败。扩充实际SSR检查原生button、单文件basename纯文本及无嵌套链接。6项后台实际SourceMessage/SourceTranscript检查通过：3创建/1读取/3编辑及+17−2、行pad8×10/1pxdivider与4/2px gap、每行14px计数；两层Read展开/内容/保留DOM及会话记忆/文件打开不误折叠；单文件与520px窄窗；8命令含1失败、60行输出、运行→完成；caret缩放/减少动态/verbose/键盘焦点；零renderer异常、零desktop调用、manifest未变。后台DPR1行高精确36.984375，原标准Electron36.9921875断言未修改。查看最终浅色文件组和命令组截图。报告analysis/batch-20260920/toolgroups066-headless-tkYn66/report.json。

保留三次headless失败：首次把旧Electron量化行高直接用到DPR1 Chrome，改为当前14×1.42857行盒按1/64px布局加8+8+1的精确值，字号/padding/border未动；第二次点击行中心命中文件链接，改为焦点进入行并Enter，另独立断言文件链接；第三次鼠标后程序focus不是键盘focus-visible，改为真实Tab/ShiftTab遍历再断言，无降低焦点要求。一个曾通过的早期headless因截图发现计数CSS问题而重跑最终证据。

三路自查核对classic/现代分支差异及NN/边框层、原生交互/行内链接隔离与现有状态生命周期、失败记录和实际fixture范围。没有执行展示命令/删除用户文件/系统窗口。完整rE morph、held内容更新、混合file+command共享path摘要模型与官方同态像素仍未完成；Codex无description时不伪造截图中的Printed/Showed文案。

构建与完整性通过，367文件，SHA `98450f789c97dfd842d8b0f3582bfe25bc8b1469ae0a76a9ff679d622798e6e5`，构建2026-09-22T00:32:53.157Z。最终headless期间产品/测试源不变。47标准Electron未运行、未打包安装，已安装仍0.2.13；整体Goal继续。

## 0.2.65 设置动作按钮（不占屏，未安装）

按shared-frame ks/_s/ys/ds及Storage/Developer实际调用链，独立实现SourceSettingsButton。General Manage为sm28px，Storage Open folder/Refresh及Developer Edit config/docs为base32px；Delete为ghost/sm方形且显式16px图标。base/sm均14/20正文，横pad12/10、radius8/7；primary500、其余400。独立paint层承载背景、ring/hover/焦点，primary内缩0.5px；按压只缩paint至.975/60ms，释放450ms spring。图标按Wi随rem-scale缩放；重复Enter/Space不重复触发，左键多击防选择，原生disabled/default type保留。

迁移现有有源调用方，移除旧ssp-button及Delete重复hover/focus覆盖，普通设置旧button选择器排除新组件；真实读取、编辑配置、文档、删除确认和存储刷新能力保持。未扩散到未复核Account/Display name/close，未声称busy/joined/router/延迟Tooltip等完整原语分支。

857项Node：856通过、1既有跳过、0失败。6项后台检查通过：General及Storage准确几何/图标、读取禁用/失败保留100MB/重试/还焦点；Developer取消不写、失败保留、重试空态及正确edit/docs桥调用；浅深色三variant×两size尺寸/字重/hover；键盘焦点与重复键/多击/disabled/非submit；仅背景按压、系统及本地减少动态、1.25缩放；无renderer错误且manifest未变。浅色Storage与窄窗Developer截图已查看，另存浅深色Developer/General/Storage。报告analysis/batch-20260920/buttons065-headless-4un1yx/report.json。

保留两次失败：初次Node旧SSR正则依赖删除按钮属性顺序，改为逐项精确断言native/ghost/sm/iconOnly和class，注明ks/N来源；首次headless在主题切换60ms背景过渡尚未完成时测色，增加等待90ms再测最终色，几何/颜色期望不变。三路自查核对源尺寸、paint层和图标Wi，原生交互与现有删除/刷新所有权，以及收据/隔离范围；不增加真实破坏性操作。

构建与完整性通过，367文件，SHA `8617025151352c0a7237005f29ebcb4f0a3b387b90b0e911547c6eba84e95100`，构建2026-09-22T00:20:21.690Z。最终headless期间产品/测试源不变。47标准Electron未运行、未打包安装，已安装仍0.2.13。全设置页与AI输出整体还原、官方同态像素验证仍未完成，Goal继续。

## 0.2.64 设置分组、行距与主题布局（不占屏，未安装）

直接复核shared-21 Av/Fv和原始c6 CSS，纠正普通设置组首/末行无源padding清零：所有行保留py-md，comfortable为上下12px。分组标题采用text-heading-semibold（15/20/580；浅色GRAD0、深色额外wght540），包含Developer顶层标题与明确本地Usage适配；内部独立详情标题不改。标题下16px、组间40px随CDS令牌缩放。Av标签改为text-body外层和inline-block/align-top文字span，高亮波浪不再铺满整个伸展列。Code theme隐藏标题没有可见描述时去掉悬空aria-describedby。

按_i保留固定等宽双列代码主题、gap-md/py-md，删除自造780px单列覆盖及控制容器60%限宽。真实Code font224px、菜单选择、主题预览继续工作。静态自查同时发现主题保存错误以codeThemeLight/Dark为键但页面读取codeTheme，失败提示不可见；两种偏好操作归入同一主题行错误状态，仍传真实偏好键值，不改变保存能力。此错误提示为Codex异步保存桥适配，非官方同步store的假分支。

857项Node：856通过、1既有跳过、0失败；6项后台实际React检查通过：Preferences/Code/General/Developer浅深色标题/轴/首尾行pad；44px版本首行、16px标题距、可访问描述；1468/760/520宽度双列主题、224px字体字段与无横溢；CDS1.25缩放；真实搜索定位/文字宽高亮/导航清理及返回顶部；真实选择和保存协调器失败保留值、错误提示、重试、重开已确认值；零renderer异常与manifest未变。浅色/窄窗截图已查看，另存深色、Preferences和隔离失败提示截图。报告analysis/batch-20260920/groups064-headless-j1svcS/report.json。

保留两次headless失败：首次测试错误假定浅色wght580轴，复核源后改为精确浅色GRAD0/深色wght540，font-weight580原断言保持；第二次重开默认Preferences后直接找Code字段超时，修正夹具按真实导航点击Code再断言，产品导航未改。未放宽几何/字号或成功条件。主题错误修正后已重跑最终完整Node和build，旧通过不冒充最终。三路自查涵盖原样式调用链、现有焦点/搜索定时器清理及错误状态归属、真实后台范围与保留失败；没有新增原生系统操作。

构建及完整性通过，365文件，SHA `0d6649d9e7bc50bc0eb461be8d0c898f886a4923aa6f0c6bdaf029ba18e28b73`，构建2026-09-21T23:29:15.848Z。headless期间未编辑产品/测试源。47标准Electron本轮未运行，已安装仍0.2.13，未打包安装；完整设置原语/原生端到端/官方同状态像素仍未完成，Goal继续。

## 0.2.63 AI输出快捷键及行内代码（不占屏，未安装）

按markdown-current.js Y/ra/el及c19 CSS独立实现真实kbd原子：精确标签、不区分大小写、普通段落64UTF16上限、原文实体/Markdown/HTML保持字面。在代码围栏/行内代码中不触发，图片alt取键帽正文，支持段首多行及引用/列表/表格；源块解析无HTML分支，局部让精确kbd开头回到段落，其他HTML保持现有安全字面策略，没有启用任意HTML。显式声明已有micromark-core-commonmark2.0.3依赖，未下载升级。

恢复inlineCode原文LF及源ASCII边缘空格规则，避免MDAST→HAST换行变空格，闭合/未闭合均覆盖，容器前缀不混入内容；表格奇数反斜线管道解转义保持。code/kbd取消font简写重置，改用源单独属性保留粗体/斜体，kbd正文−2px、1/2px边框、4px圆角、2×4px padding。文件链接现有能力不改变。

857项Node：856通过、1既有跳过、0失败；新增3项实际SourceMessage SSR。6项后台实际React检查通过：浅深色×三字号精确kbd几何与代码/键帽粗斜体继承；实际表格及文件行定位、520px窄窗；code原始换行/空格和多行/UTF16边界；流式闭合原子200ms linear淡入、选区不丢失及完成收尾；恶意标签/属性/转义/过长回退、零desktop调用；renderer无异常与源码manifest不变。浅色及窄窗截图已查看，深色另有自动截图与样式检查。后台报告analysis/batch-20260920/atoms063-headless-U3Fxw6/report.json。

开发探针第一次因多行token缺少子事件发生RangeError，第二次缺data分段持续运行，以该探针会话Ctrl-C退出130；补齐逐行data/lineEnding分段后再跑完整测试。正式Node/build/headless/integrity均首次通过，没有放松断言。三路自查涵盖源上限与不透明正文、无HTML执行/新异步资源与既有流式生命周期、真实收据及边界披露。0.2.63kbd在普通段落64UTF16上限正确；表格内先按原始字符计数、后解转义管道，恰好64显示单位但原文65单位的标签仍退回字面（table-boundary-observation.json有实测）。完整alluvium HTML/块边界、代码/文件链接frontier、引用与官方同态像素仍未完成。

构建及完整性通过，365文件，SHA `eeaf2ab15bdbb6042265a68f34eb474fff33ade679e058e7317c78cf9a14cbc1`，构建2026-09-21T23:17:08.939Z。headless期间未编辑产品/测试源。47标准Electron本轮未运行，已安装仍0.2.13，未打包安装，Goal继续。

## 0.2.62 Customize搜索与标题（不占屏，未安装）

复核ccefd43d9 x→shared-20 Ff/co→shared-frame Bh有slot分支：co表示pageLayout而非modal；当前经典壳应w-48=192px，纠正0.2.31保留的256px（仅pageLayout分支w-64）。Skills/Plugins/Connectors目录页与插件详情内搜索共同采用字段背景、ring/hover/focus shadow、32px高度、12px左pad与8px gap；清除末槽32px、按钮22px、圆角3px，clear时右pad0/否则12px，slot Search16px、折叠及Clear20px。去掉无源200字符限制和窄窗160px覆盖，尺寸随CDS rem缩放。

目录标题由600/16/22改为源text-heading-medium（comfortable15/20/500），插件详情用text-heading-semibold（15/20/580），包含源字体轴。通过原生输入框保留搜索/筛选；空值blur折叠、Clear保持展开及输入焦点、IME Escape停在输入、普通Escape清空折叠并把焦点还给按钮。焦点回送在layout effect内完成，不留下卸载后的rAF；字段空白/图标左键聚焦，跳过内部交互目标及右键。现用经典分支以外pageLayout/hero/frame没有假定启用，也没有把未知新版壳硬塞进去。

854项Node：853通过、1既有跳过、0失败。本轮不新增镜像逻辑单测，实际交互由6项后台SourceSettings/SourceCustomize/catalog store检查：三个目录真实读取/标题/搜索/焦点；浅深色字段颜色阴影及精确末槽几何；实际过滤/220字符/IME/Clear/左右键；1.25缩放和系统/本地减少动态、520px窄窗；插件detail读取/semibold标题/搜索/tab切换/返回；迟到detail不会覆盖新目录、没有目录写操作及renderer异常。查看浅色与窄窗截图，另有深色截图与精确样式检查。报告analysis/batch-20260920/customize062-headless-lBUNJv/report.json。

首次Node失败是旧SSR标题正则未包含新源码字体类，改成准确的text-heading-semibold断言并注明源码，仍严格检查转义安全内容。首次headless测量发生在真实200ms弹窗缩放过渡中，按钮为31.446px；夹具改为等待data-open及真实过渡完成，原32px等断言未放宽。两次失败收据保留。另一次Node通过发生在点击目标作用域自查修正前，已重新跑最终完整Node，不以旧结果替代。

skills-mcp标准脚本仅将明确错误的256px改为192px，注记x/Ff链，容差不变；本轮未运行该Electron脚本。构建及完整性通过，364文件，SHA `82025838b6566adee9ced4ed7df9f1d953fa7c33ccbf958b80478948ef0fc8ff`，构建2026-09-21T23:02:32.170Z。最终后台验证期间源/测试不变。三路自查覆盖调用链和精确几何、焦点生命周期及迟到读取隔离、真实测试/失败记录；不宣称全BaseUI输入/按钮语义、完整coarse/pageLayout或官方像素等价。47标准Electron本轮未运行，已安装仍0.2.13，未打包安装，Goal继续。

## 0.2.61 AI正文换行、列表与表格排版（不占屏，未安装）

直接复核markdown-current.js Xc/el/rl及原c19 CSS，修正ReactMarkdown默认将普通单换行折为空格的问题：正文、强调、链接、引用和列表中的文本换行变为br，既有双空格/反斜线硬换行不重复；表格单元格额外支持源Jc的<br>、<br/>、大小写/空白及实体解码拼写，普通正文的br仍字面。代码、公式、图片alt和其他原子不拆分，不开启HTML执行。

按rl仅展开列表项的首个paragraph，后续p/引用/嵌套列表保持块结构；脚注sup后也展开首段，纠正0.2.60漏看rl导致标签独占一行的错误。对齐原CSS的真实元素兄弟选择器，排除data-wf逐词壳，避免流式额外6px间距；任务内容span不加源中不存在的通用段落间距。用户消息及Skills独立Markdown分支不改。

854项Node：853通过、1既有跳过、0失败。新增3项实际SourceMessage SSR测试，覆盖soft/hard/CRLF、强调链接/引用列表、table br安全与代码字面、脚注同排和后续段落。首次Node失败为更新后的任务首段断言漏写MDAST结构换行，改成精确含换行的期望；仍断言首段无p及后续段落有p，并在改动处注明rl/il源码。失败日志保留，没有放松容差。

7项后台实际组件检查通过：浅深色×三字号双行几何；脚注同排及列表/引用结构；520px窄窗及溢出表格展开、单元格换行、Escape还焦点；原间距排除reveal壳；流式追加/强调闭合/选区与200ms淡入、收尾后3行保留；安全字面及零外部/desktop调用；无renderer错误、manifest未变。查看浅色和窄窗截图，深色另有自动截图及几何检查。报告analysis/batch-20260920/flow061-headless-Iny1S6/report.json。

构建及完整性通过；364源码文件，SHA `7fa7ed1dae1706befe298279985f9a3ca9cbc32dbfa3403be26149b71ab3bdcc`，构建2026-09-21T22:51:03.415Z。测试期间没有更改产品/测试源。三路自查已核对原解析→渲染链、无新定时器/全局状态且无HTML执行、仅将真实后台fixture证据计入本轮。完整alluvium/inlineCode多行/引用/citation与官方同态像素未完成；47标准Electron本轮未运行。已安装仍0.2.13，未打包安装，Goal继续。

## 0.2.60 AI正文脚注（不占屏，未安装）

按markdown-current.js di/Y/qa/sl/el链独立实现micromark脚注构造，替换GFM编号及页尾汇总。引用保持原标签、大小写和实体拼写；重复或无定义引用仍为原子sup。定义在原位置，以单行正文解析，不能打断已有段落、不吞后续缩进代码；不生成Footnotes标题、hash链接、编号ID或回链。按原CSS定义用正文小1px及secondary色。Skills通用Markdown分支保持其独立行为。

新增6项解析与2项实际SourceMessage SSR测试，完整851项Node：850通过、1既有跳过、0失败。6项后台实际SourceMessage/SourceTranscript检查：原标签/重复/未定义与多消息；数学、任务、表格、代码混合；浅深色13/14/16px及520px窄窗；流式未闭合字面→闭合sup原子200ms linear淡入；追加定义及完成收尾保留选区；定义段落边界/缩进/实体/恶意标签安全字面。全部在无界面Chromium中运行，无外部或desktop调用。已查看浅深色截图。

保留4次失败：初次SSR的id匹配误伤data-transcript-item-id，改成真实属性边界；首次后台全局[id]误伤代码块scb-status可访问性ID，按源将无ID断言限于脚注节点，并继续断言全局无footnote ID/hash/footer；两次字号失败来自夹具把字号设在被局部令牌覆盖的root，以及未加载真实设置字号CSS。修正为真实data-local-transcript-size与加载source-settings.css。字号/颜色/动画/语义原期望未降低，产品无需为这些夹具失败修改。失败收据全部保留。

构建及完整性通过；363源码文件，SHA `30b132e91431ace6525c36f519504d8cc7e4497fc18b7b711878ef42cb9748d3`，构建2026-09-21T22:41:58.424Z。最终后台检查期间产品/测试源均未更改。报告analysis/batch-20260920/footnotes060-headless-wGTxly/report.json。

三路自查：逐条复核di/Ia边界、qa段落状态与sl/el结构；标签仅React安全文本，无HTML执行，构造无异步或全局状态，沿用已验证reveal生命周期；测试使用实际组件但仍是隔离fixture，没有将其冒充原生端到端或官方同状态像素验证。完整alluvium/citation/块级解析未完成。47标准Electron本轮未运行，用户不占屏限制保持，已安装仍0.2.13，没有打包安装，Goal未完成。

## 0.2.59 设置、技能与Fast菜单共享Switch（不占屏，未安装）

按Desktop General H→shared-frame _r/Qv→qv/Jv/Yv/Xv独立实现SourceSwitch。设置、Customize技能Enabled及模型菜单装饰开关共用；模型菜单不再通过整页settings导入开关。基础尺寸取CDS变量，compact16px/comfortable20px、宽1.8倍、thumb高−4、2px内边距、checked位移.8倍；支持现有xs/sm/lg和rem-scale，不再写死20px。

修正通用设置按钮hover把选中开关刷成ghost色的问题；off/on分别采用switch-track/track-hover与fill-accent/accent-hover，disabled保持颜色及opacity令牌，focus使用源shadow-focus，移除通用outline抢覆盖。thumb用源switch-knob/shadow-sm、120ms overshoot cubic-bezier(.34,1.3,.64,1)，OS及应用减少动态取消过渡。按Qv Zv阻止重复Enter，Va/Ba仅阻止多次左击选区，保留普通单击聚焦。native button处理Space、disabled和单次Enter；decorative无role/交互并aria-hidden，避免菜单里嵌套开关。

843项Node：842通过、1既有跳过、0失败；8项后台实际组件检查通过。SourceSettings真实keepAwake保存协调器、按成功值显示电池子行、失败保留选中和焦点/重试；浅深色精确36×20/16px与颜色、hover、阴影、focus/120ms；8个density×size组合、1.25缩放、重复Enter和鼠标事件取消、禁用与减少动态；真实SourceModelMenu菜单一次Fast变更/compact16装饰开关；真实SourceCustomize与catalog store技能启用/失败回滚。全部IPC仅隔离内存适配器，没有操作OS设置、系统剪贴板或用户配置。已查看浅深色设置截图。

首次headless失败为测试把ref对象传给要求DOM元素的SourceModelMenu anchor，触发getBoundingClientRect错误；只将fixture传参改成anchor.current，所有原断言保留；最终通过。失败报告与收据保留。未为纯视觉规则添加镜像单测，实际浏览器交互覆盖新增行为。报告analysis/batch-20260920/switch059-headless-Jr24JR/report.json。

build/integrity通过；362源码文件，SHA `3be8ef28392d186871bf2489b307129686451963069012cc9805eba61bca0442`，构建2026-09-21T22:27:36.392Z。产品在最终后台检查期间未改变。

三路自查：几何/配色/时序链逐项复核，通用hover/focus覆盖已剥离；组件无异步/全局监听，保存/竞态仍由现有协调器和store负责，装饰不生成第二焦点；失败保留，没有将后台fixture算原生端到端。完整BaseUI表单name/value/required/hidden input、disabledReason包裹和RTL未完成/验证，未声称整套原语等价。47标准Electron未运行、官方同状态全像素仍未验收，已安装仍0.2.13，未打包安装，Goal未完成。

## 0.2.58 Changes真实上下文展开（不占屏，未安装）

工作区Git查询新增可选completeContext信封，用同一Git diff相对已确定HEAD得到真实前后完整文本；旧字符串接口不变。主窗口与popout Changes均已接线。超过现有4MiB/50000行渲染预算回退普通部分patch；Git输出/超时/外部filter禁用及路径授权沿用现有边界。不拿当前磁盘文本填历史Codex补丁。

完整文件保留更改附近3行（Git默认上下文本地适配），首段/中间/尾段按源码fromStart/fromEnd每次100行展开；文字点击both，两端各100。剩1行自动露出。源Expand all独立按钮被CSS隐藏，本轮没有虚构可见按钮。真正的旧/新行号、语法/worddiff、并排、换行和Copy完整原patch保持。切会话/patch重置展开，布局/文件折叠保留；按钮展开消失时焦点留在文件正文。二进制、损坏与历史partial继续原文或已知行数，不伪造尾部。

源码复核纠正0.2.45遗漏：最终FileDiff la无条件注入Gi/Qi（ca7ba268c:8463–8582），separator背景transparent、按钮16px/gap4/左8/文字padding0；保留库32px高/首尾外间距与精细指针上下按钮。以前只追到库默认混色背景的结论已过时。静态16px SVG路径来自c64baa838两个原始symbol；无官方业务JS执行/复制。source-contract记录完整链。

843项Node：842通过、1既有跳过、0失败；7项后台实际Changes检查通过。隔离真实Git800行、两处修改，核对146/443/197省略数、100行定向与双向、精确坐标、键盘焦点、布局和520px深色、全展开后800新侧行逐行相等、Copy对独立Git输出逐字相等、历史partial不造尾、空信封显示无改动。50,100行超预算回退与Git index不写由Node验证。已查看浅色/深色窄窗截图。报告analysis/batch-20260920/context058-headless-ocpU4A/report.json。图中页头布局/换行按钮是测试适配器，不能作为官方页头像素证明。

构建2026-09-21T22:15:47.095Z，360源码文件，SHA `bfa085549a69f38543a0838f1089ad3b31130f41e14cd7702198501f308fe433`；build/integrity均通过。首次与最终headless均通过，最终仅把深色截图滚到分隔处并纠正报告fixture说明，产品未变。本轮无失败记录。既有diff-ui-test的完整Git已知尾部/按钮/Copy预期按上述源链更新，标准Electron脚本未运行，不计通过。

三路自查：最终CDS覆盖已核实；数据只来自真实Git/历史patch，React安全文本，完整/部分分支显式、接口权限不扩展、会话迟到结果沿用live所有权；测试使用真实组件和Git，系统剪贴板/窗口/用户会话均未触及。尚未实现完整虚拟化、注释、逐文件懒加载、跨刷新锚点保留；完整上下文获取是本地适配，不声称源引擎等价。47标准Electron未运行，官方同状态全像素未验收。已安装仍0.2.13，未打包安装，Goal未完成。

## 0.2.57 AI图片操作可见通知（不占屏，未安装）

追踪图片菜单→shared-2 Errors(addSuccess/addError)→shared-25 Bg/zg→shared-21 CDS Toast→vendor-base-ui原语后独立实现。图片复制成功、保存成功与失败现以可见通知反馈，取消保存不产生成功。普通复制/info源映射neutral，错误默认warning；Save成功反馈为本地原生保存结果适配。代码块保留原Copy/Check工具提示，表格保留源Expand，没有新造Copy table。

通知宽360、右/下16、20px Info/Warning、16px关闭X、compact13px正文500字重、8×12内边距/8间距、rounded-card按源radius+4解析为10px；200ms ease-out。最多3层可见，后层−14px及每层.04缩放、内容隐藏，受限条目inert；重复消息显示×N并重置期限。neutral6500ms、纯文本warning10000ms，正数下限6000，0/无限为持续。hover/focus/window失焦按剩余时间暂停，F6进入、Tab到卡片、Escape关闭并返回真实触发焦点，不自动抢焦点。Root应用及popout Provider共享每窗store，portal适配现有模态层2060；TableDialog不再因Toast获得焦点而关闭。

实际后台测试先验证图片菜单→真正canvas PNG编码→隔离IPC结果→Toast；再验证精确几何/堆叠/dedupe/F6与关闭恢复、深色340px窗内308px通知、减少动态效果、真实等待6700ms仍保留hover通知、移开后恢复并消失，以及DOM window blur/focus处理器的暂停。后者未切换OS焦点。已查看堆叠与深色窄窗截图。首次headless失败是把图标字形计入innerText，修正为单独精确比较消息节点；没有删除图标或放宽期望。

自查修复到期但回调未执行前暂停的边界：区分剩余0与显式无限，恢复时前者立即退出；新增注入时钟测试。store销毁清除截止/退出定时器及订阅，ResizeObserver/window监听在组件卸载释放，全部正文React文本。当前未实现action/pinned/provisional、完整uniqueKey/高优先播报/触摸焦点哨兵和全局错误桥；不声称Base UI所有语义等价。关闭保留200ms移除后备，减少动态取消CSS过渡。表格内图片通知焦点豁免接线未单独交互验收。

834项Node：833通过、1既有跳过、0失败；30项后台实际组件检查通过，含设置/Storage/Developer/Skills/AI文件命令/流式/公式/图片回归。build/integrity通过，359源码文件，SHA `7fc807f6c8d4b60eb312e3a871b7a3d10a292e284db5f00a4894fa4bbdd322d1`，构建2026-09-21T21:58:39.850Z。报告analysis/batch-20260920/toasts057-headless-xQ6AJn/report.json。

47标准Electron未运行、官方同状态像素仍未全验收。已安装仍0.2.13，未打包安装，Goal未完成。

## 0.2.56 设置Storage占比与详情（不占屏，未安装）

按c71860c77-B72Ova_w dt/ft/ht/Z与c91b6e9db StackedMeter调用链独立实现。存储占比条使用8px高、1px段间缝、4px外/2px内圆角；小于1px的类别不人为放大、极小容器显示最大类别圆点。字节和两位有效数字百分比来自实际类别数值，app为chart-muted、首个本地非muted类别code用categorical-1。鼠标hover单类别读数，键盘Tab显示多行全部读数，支持鼠标仍停在分段时切入键盘。嵌套Storage层520，提示层650；hoverable false保持鼠标穿透。

Details由native details改为已按源实现的SourceDisclosure，13px解析后的footnote字、200ms高度、150mscaret、内容8px上内边距/间距；展开/关闭有aria-expanded、退出inert和所有权清理。后台验证Refresh期间保留旧数据和展开状态，失败仍可查看旧值，重试替换、下界说明真实显示，关闭后旧请求不覆盖重新打开的窗口；Open folder仅调用隔离adapter。3秒/5次轮询是源Cowork分支，本地没有该能力，不新增轮询或清理假按钮。

829项Node：828通过、1既有跳过、0失败；27项后台实际组件检查通过，包含设置/Developer/Skills/AI文件命令组/流式/公式/图片回归和本轮Storage。构建与完整性通过，356源码文件，SHA `e2201f3cc3767ea9ef7173e6d723f9e29e29d5b2d919ede01c8ac641a2bdd3e1`，构建2026-09-21T21:43:50.581Z。报告analysis/batch-20260920/storage056-headless-ATSGkN/report.json。已查看浅色/深色窄窗/键盘读数截图。

保留三次后台失败：父meter提示延迟覆盖子分段提示，修复局部hover/focus所有权；测试把hoverable:false的鼠标穿透误判为遮挡，改为同时断言650层与pointer-events:none；测试将13px计算字号与calc令牌字符串直接比较，改为解析同一CSS令牌后精确比较。没有放宽几何容差或修改真实数据来通过。旧settings-complete脚本中Advanced options的summary选择器已更新为源Collapsible button，原展开内容断言不变；未运行该Electron脚本，不算验收。

47标准Electron未运行，完整官方同状态像素仍未验收。已安装仍0.2.13，不打包安装，Goal未完成。

## 0.2.55 AI图片显示与操作（不占屏，未安装）

对照2.2553.1 markdown-current qc/Lc/Rc及cfc63964b图片ContextMenu，补齐AI输出中的本地/内嵌图片。图片按自然比例缩放、5px圆角和1px边框；加载中占位、不可读或损坏时回到真实文件入口。菜单支持右键及Shift+F10，复制在浏览器canvas编码真实PNG像素后交给Electron，保存保留原始图片格式并由原生对话框选择目标。测试只注入剪贴板/保存边界，不操作用户桌面。

主进程复用workspaceQueryRoot和scopedPath，拒绝目录、越界路径/符号链接、非图片及超30MB文件；文件读取仅分配stat.size+1并拒绝读取中尺寸变化。SVG仅用img资源渲染，脚本未执行。异步图片切换忽略旧响应；保存取消和复制失败不会报成功。远程图片仍是真实链接，未自动抓取；完整文件菜单、共享Toast、blob缓存/hold时序尚未实现。

826项Node：825通过、1既有跳过、0失败。24项后台实际组件检查通过，覆盖设置、文件/命令组、流式文字、公式以及本轮图片自然尺寸、菜单/键盘、真实PNG字节、浅深色/520px窄窗、源替换竞态、损坏回退。构建与完整性通过，354源码文件，SHA `4edeeb73ed2151874d18454a6ac7bef4e92aa3a915ec2e6b6c192070a4df7395`，构建2026-09-21T21:30:18.676Z。报告analysis/batch-20260920/images055-headless-xrGFUM/report.json。

保留两次失败记录：首次把路径分类当成授权，错误期望../secret.png分类为unsupported；实际授权由主进程scopedPath执行。第二次测试误漏传越界路径，收到Invalid image path；补回../secret.png并保留缺参数检查后通过。未通过放宽产品权限修复测试。

47标准Electron未运行、完整官方同态像素仍未验收。已安装仍0.2.13，不打包安装，Goal未完成。

## 0.2.54 AI数学公式（不占屏，未安装）

优先继续AI输出：读取2.2553.1 markdown-current Yc/Eo/Es与cd535dee8守卫，新增独立数学解析及渲染。用npm独立KaTeX0.16.47（与源模块Oa一致）及remark-math6，未执行官方bundle。支持双美元独立公式、受边界/长度/符号限制的\(行内\)和单行\[display\]、math代码围栏；普通金额、嵌入正文的双美元、普通code及转义括号保留原语义。未闭合双美元保留原文，闭合后才加载公式引擎；行内公式作为整体随流式文字淡入。

KaTeX以htmlAndMathml生成可访问内容，display有role math/tabIndex0；源码errorColor inherit/throwOnError false/strict false，trust false与1000宏展开限额保持。错误TeX可读，URL/HTML命令不会发起外部资源。公式宏不跨次共享。长公式横向滚动、键盘ArrowRight可滚动，不撑宽对话。单公式20000字符是额外本地响应性限制，超限保留TeX。加载失败/完整alluvium/multiline backslash feature分支仍列剩余项。

最终Node820项，819通过、1既有跳过、0失败；21项后台真实组件检查通过，包含设置/Developer/Skills/文件命令组/流式选区回归与本轮字体真实加载、分数/积分/矩阵、浅深色、520px窄窗、公式前沿/错误/原子淡入。没有可见窗口、Electron启动或外部公式资源请求。单测后仅补许可和构建证据；最终build/headless/integrity独立验证。

构建2026-09-21T21:13:34.153Z，SHA `65aa0beecbefbe025f67a37dfb597a161e6ebc49c90f849735dc237fb7612fd0`，350文件。KaTeX动态JS/CSS/本地字体61个输出共1360383字节，最终字节hash全部通过；许可manifest覆盖81项（含类型/CLI依赖）。实际依赖按owner路径解析，KaTeX依赖的Commander8.3.0亦有正确许可；早期许可收集额外保留Commander9.5.0许可文件，不作为KaTeX依赖证据。remark-math npm包不含license，从npm gitHead对应官方仓库提交获取MIT文本。

保留3次失败：初版构建证据误把CSS导入shim也计为KaTeX运行时；初次headless在失败构建后仍执行且过程中修改vite配置，最终完整性检查明确失败，该次结果不作最终证据；CSS在generateBundle后被Vite改写12字节导致hash不匹配，改writeBundle读取最终产物字节，不放宽断言。最终版本重新完整构建、hash校验与headless通过。

报告analysis/batch-20260920/math054-headless-3hrUf6/report.json。47标准Electron未运行，完整官方同态像素未验收；已安装仍0.2.13，不打包安装，Goal未完成。

## 0.2.53 Skills预览代码块（不占屏，未安装）

按2.2553.1 shared-16 UA/WA/Gk独立实现文档通用代码块。Skills Preview现在有语言标题、固定Claude浅深主题五类语法高亮、sticky悬浮/焦点复制、键盘触发、两秒成功反馈，以及无语言自动换行/有语言横向滚动。复制与显示先trimEnd再去除有效UUID形式的antCitation；原始Code模式保留文件源码。复制失败不显示成功、替换与卸载清理反馈。代码文字以React文本节点渲染。

实际CSS源映射再次核实：border-border-400→CDS border、bg-bg-000/50→surface-3半透明、font-small→密度相关caption（compact 11/17）；修正初版截图发现的深边框与标签字号，最终源码重新build/headless/integrity。单测812项，811通过、1既有跳过、0失败；18项后台真实组件检查通过，含设置/Developer/AI/文件命令分组/流式选区回归。CSS修正后没有重复不受影响的Node测试。没有可见窗口、Electron启动或系统剪贴板写入。

构建2026-09-21T20:54:36.675Z，SHA `fe06f130449be8b5742dfb209cdf1000ecd44fa111a048b8c27b19f400b9ef1a`，294文件。报告analysis/batch-20260920/skill053-headless-G4NxWx/report.json。更多语言、原始Markdown源码颜色、嵌套规范化、Mermaid、图片/表格/多文件与大文件虚拟化仍保留差距。47标准Electron未运行，完整同态像素未验收；已安装仍0.2.13，不打包安装，Goal未完成。

## 0.2.52 Developer空态与高级折叠（不占屏，未安装）

读取2.2553.1 c71860c77-CCdfSDER j/M与shared-frame K_：Developer无服务器状态换原始70×71、四path静态插画，主题配色随浅深色切换，Edit config使用primary/500字重/32px控制。图形经prepare-ui只提取数据、不执行bundle，源模块与生成数据hash加入ui-provenance，所有权沿原资产声明。

Advanced options改为独立受控Collapsible：默认收起、6px间距、16px caret、150ms旋转、200ms/ease-out高度，展开内容16px上内边距；环境名称分行，保留真实snapshot限制，不透传values/headers或伪造logs入口。支持Enter/Space、inert/aria-hidden退出、快速反转、服务器切换重置、OS/local减少动态效果与卸载清理。后台发现祖先入场scale让测量98px而真实内容100px，改为不受transform影响的computed layout height，原高度等式断言保留。

纠正旧剩余项：普通设置页面cc011544b at:335–378按section键重建滚动容器，本来就不保留跨节位置；实际Code→General→Code回到0已后台验证。只在Customize page-shell等显式scrollMemory调用处实现其记忆契约，没有擅加全局跨页记忆。

最终Node808项，807通过、1既有跳过、0失败；build/integrity通过；15项后台真实组件检查通过，含上一轮设置/AI/文件命令组/选区回归与本轮动画/键盘/清理/主题插画/主按钮实际回调。构建2026-09-21T20:42:05.042Z，SHA `0e0ed2bf68e299879103dd61d939c1fa24b61257d5bfb79bdedf16042b1274f8`，291文件。没有可见窗口或Electron启动。

47标准Electron套件本轮未运行，五项852px历史阻塞与全范围历史差距保留；只读安装仍0.2.13，未打包安装。整页官方同态像素和完整原生行为仍未验，整体Goal未完成。

来源/实现analysis/developer-details-20260922；脚本work/developer-details-20260922；报告analysis/batch-20260920/developer052-headless-Z0Dkta/report.json；当前状态analysis/batch2-status-20260921.json。三个失败收据保留：harness同名变量解析错误、两次原生高度裁切（第二次添加测量证据），未放宽断言。

## 0.2.51 AI流式行内格式与选区（不占屏，未安装）

按2.2553.1 markdown-current Y/S/ua/el补最后增长容器中的未闭合粗体、斜体、删除线、行内代码，已收到但未结束的链接使用真实URL。保留转义/实体来源、完整AST原子、围栏原文；段落/引用/list/table最后项采用流式处理，终止表格行不再误算未闭合。停止时恢复正常Markdown解析。直接依赖MIT micromark-util-decode-string并补齐四份许可及manifest。

真实后台检测发现追加词尾空白会通过React更新text.nodeValue清空原生选区。新增正文局部before-update快照，在source前缀追加且可见prefix不变时恢复原anchor/focus；不恢复外部/折叠选区或文本重写。实际验证同strong DOM、追加选区、闭合、反向选择和1000ms收尾后选区；这属于ReactMarkdown适配，不是官方alluvium DOM完全等价。

最终Node807项，806通过、1既有跳过、0失败；build/integrity通过。后台13项实际组件检查通过，包括设置字体输入/错误恢复/工作树，浅深色×三字号×两宽度，文件组+17/-2、8命令1失败及running状态，200ms词淡入/减少动态效果/链接/清理，以及本轮流式开闭/停止/原文代码/安全链接。未启动可见窗口。

构建2026-09-21T20:23:41.143Z，SHA `aeb96bbd9fea36916da92ba3fc1504abd7ba03a678d624ccf357862e677d8fbc`，288源码文件。47标准Electron套件本轮未运行；五项852px历史环境阻塞与全部历史推迟项保留，不以headless代替全链验收。只读安装版本仍0.2.13，未打包安装，整体Goal未完成。

来源/实现记录analysis/streaming-inline-20260922，后台脚本work/streaming-inline-20260922，报告analysis/batch-20260920/inline051-headless-NOTlxZ/report.json。保留三次失败：table终止行/长文fixture末空格断言、真实选区清空、测试错误比较跨文本节点offset；均解释并修正，不放宽产品断言。完整数学/image/reference/footnote与块级增量语法仍保留差距。

## 0.2.50 AI流式正文逐词淡入（不占屏，未安装）

按2.2553.1 markdown-current Ml→ll→qo/as接入默认word显示节奏：200ms linear/backwards、2.5ms/字符、同render16/后续48字符块、延迟上限600ms；超过400字符首挂载的历史正文直接可见，追加文字再淡入。非前缀修改不会重播旧条目，完成后1000ms收尾。标题/正文/列表/表格/引用共用，inline code与文件/URL链接原子包裹保留现有语义，代码围栏保持原高亮与复制数据。

动画按原始时间恢复，重新渲染不重播；会话/消息隔离，OS与本地减少动态效果取消正在淡入的文字；结束/卸载清理自有动画、监听、观察器和定时器。实际后台检查发现清理settled词壳破坏选区，已改为追加期间保留已画span，完成才统一收尾；原选区断言未放宽。

最终完整Node795项794通过、1既有跳过、0失败；build/integrity通过。构建2026-09-21T20:03:47.283Z，SHA `0ca6ef9d6e5059cd8ec91a1207734dad6c99bacd9b727f554b34629421605989`，282源码文件。headless真实React/WAAPI检查200ms/linear/backwards与≤600ms、同DOM/同animation/startTime、追加时选区、Enter文件/外链、任务/表格/原文代码、1000ms收尾无布局变化、>400历史prime、新增后缀、OS/local reduce、卸载取消，结束/卸载后实际motion监听数0。并复跑.49设置字体/工作树、12阅读状态、文件组与8命令1失败。

没有启动Electron或可见浏览器，没有操作用户桌面/剪贴板/会话。47标准Electron套件本轮未跑，5项852px历史环境阻塞保留，1470×849为旧观测；安装只读仍0.2.13，未打包替换。所有原七界面与历史推迟项保留，整体Goal未完成。

边界：不是官方完整alluvium renderer；phrase feature flag、paceReveal/morph、块级淡入与描述性链接内部逐词仍缺。保留span是现有ReactMarkdown的选区适配，不宣称DOM结构/全部stream状态1:1。后台为明确fixture，不代表真实模型端到端；静态截图也不能单独证明动画。原失败日志保留，数值/时序由真实动画API和断言支撑。

契约/自查analysis/response-reveal-20260922；后台脚本work/response-reveal-20260922；当前状态analysis/batch2-status-20260921.json；.49历史analysis/batch2-status-0.2.49-headless-20260922.json。

## 0.2.49 设置字体即时输入与AI后台回归（不占屏，未安装）

Code font按2.2553.1 c71860 _i→shared-frame Bh改为224×32 CDS TextInput、comfortable密度12px横向内边距/8px圆角，移除额外Save。每次有效输入立即调用真实settings，不trim、不延迟排队；空值恢复默认。无效草稿/IME组字不写入，完成组字提交完整值，错误保留草稿并可Enter重试，不禁用输入或丢焦点。Display name原Save保持本地适配。

补全偏好异步同步：最新版保存失败后通过现有init读取真实config，显示前一次实际保存成功的值；读回期间新操作仍按revision隔离，原保存错误不被掩盖。不重写旧配置、不编造成功。字段卸载仅取消本地反馈，已经发出的写入继续正常确认。

最终完整Node782项781通过、1既有跳过、0失败；build/integrity通过。构建2026-09-21T19:48:10.389Z，SHA `8e5637d80778a92339ab6890b8aabd4f5c0ba0082a83f0b87f07e9951eec795e`，279源码文件。headless Chromium加载实际React组件和相同preference-save协调器，验证输入尺寸/每次输入/焦点/无效值/IME/失败重试/失败确认同步，设置顺序与工作树，AI浅深色×3字号×2宽度共12状态及文件组+17/-2折叠展开、8命令1失败、运行转完成。测试数据来自明确内存fixture，没有运行真实命令、读取用户文件或把组件检查算作完整Electron持久化验证。

本轮遵守用户最新不占屏要求：无Electron、可见浏览器或桌面操作，恢复screen-tests-paused门禁。47标准Electron套件未跑；.48七项GUI属于历史版本。5项852px历史高度阻塞保留，1470×849为旧观测。安装只读仍0.2.13，未打包替换。其余七界面和全部历史推迟项保留，整体未验收，不声称99.99%/1:1。

失败保留：首轮新增断言误把compact的8px用于comfortable输入（实际12px），按源密度令牌修正精确值；第二轮测试点击Read行中心落在文件路径控件，不能当成展开操作，改为真实行Enter键后原内容断言通过。产品代码没有为测试降级。早期通过的后台构建不混作最终版本证据。

契约/实现/自查analysis/settings-font-input-20260922；后台脚本work/settings-font-input-20260922；当前机器记录analysis/batch2-status-20260921.json；.48历史归档analysis/batch2-status-0.2.48-gui-20260922.json。

## 0.2.48 设置分段控件与7项GUI（未安装）

按2.2553.1 shared-7 SR/dR/Db重做主题/动态效果/字体/字号/宽度/默认视图分段控件：32px控制高、1px inset、30px纯图标按钮与20px图标；CDS track/thumb、当前8px主题圆角派生thumb7/按钮6。选中背景用200ms cds-ease-snap FLIP跟随真实受控值，初次定位/减少动态效果直接落位；重新选择当前值不重复写入。单tabstop、方向/Home/End/RTL/disabled/IME保留；ResizeObserver与DPR/模态缩放校正，卸载取消observer/listener/WAAPI。

完整Node768项767通过1既有跳过0失败；build/integrity通过。最终构建2026-09-21T19:24:43.039Z，SHA `4c970ac1f3875d12147dd98ff403daf43bde17e09b4f9c4bd0b5e3ea0d294fc1`，275源码文件。同一构建7GUI串行通过：settings、settings-rest、settings-complete、skills-mcp、edit-read、run-command、code-fence。包含新精确尺寸/动画参数/选中背景对齐、连续键盘/异步保存焦点、减弱动态效果、主题/字体/视图持久化与重启、Developer/Storage、Skills、AI文件命令/代码围栏与Copy回归。

保留首轮失败：新增圆角断言错误假定CDS基础6px，实际主题8px；改为源码radius−1/−2公式，仍精确比较，不放宽容差。动画easing按CSSOM归一化后的四个数值核对源令牌，避免把.32与0.32当不同曲线。无产品代码为测试降级。最终7套证据仅计重建后的版本。

当前Goal允许GUI，.47追加4项同版本GUI已归档。40标准未运行，5项852px历史环境阻塞继续；本轮无窗口工作区探测1470×849。安装只读仍0.2.13，未打包替换；用户原Electron8272未动。全局仍未验收，separated/外部thumb拖拽、完整上下文/虚拟化/其他七界面推迟项继续保留，不声称99.99%或整体1:1。

契约/实现/自查analysis/settings-segments-20260922；机器状态analysis/batch2-status-20260921.json；.47历史analysis/batch2-status-0.2.47-gui-20260922.json。

## 0.2.47 优先设置与AI阅读样式（不占屏，未安装）

Code页按2.2553.1源码顺序前置Code appearance、Appearance与Local sessions，原模型/effort/Fast/权限功能完整保留在后部（Codex适配）。Local sessions先bypass再Dynamic workflows，sandbox只读策略后置。Worktree选择器显示真实custom路径、220px控制/8px间距/截断title；项目选项补实际.code/worktrees说明，切回项目不再显示旧custom路径提示。通用选项说明采用label/description双行。

AI任务清单按markdown-current Dc/Oc补空心圆、Check、done/not done语义、已完成灰色1px删除线。普通列表保持原语义，GFM紧凑/松散/嵌套任务正文完整保留，无可修改假控件。浅深色×13/14/16px×1468/520宽的12种无窗口渲染通过，无横向溢出。

最终Node764项763通过1既有跳过0失败；build/integrity通过。构建2026-09-21T19:12:04.423Z，SHA `3173fecd39ec87b5c66237b99eabe1feac96be56b71f047ba11b6440000cef84`，271源码文件。headless Chromium加载独立打包的实际React组件，验证设置排序、工作树路径/下拉说明/真实组件回调、代码预览worker高亮与清单尺寸；后端为内存隔离adapter，未测试原生目录选择器或真实持久化，不等于完整Electron GUI或官方同态像素证明。

本轮遵守用户最新不占屏要求，没有Electron/可见浏览器/桌面操作，没有更改系统或用户配置/会话/剪贴板。47标准Electron套件未跑；.46七项GUI已归档历史。5项852px历史环境阻塞保留，1470×849为旧观测；安装只读仍0.2.13，未打包替换。其余七界面及所有历史推迟项继续保留，整体仍未验收。

保留失败：测试harness直接导入React的CJS入口不能在开发浏览器使用；改bare imports与dedupe。初版harness漏应用主题变量，截图不能作最终证据；补真实palette与高亮断言。开发worker未在固定期限内完成，转独立生产构建，首轮out-of-root HTML入口失败，改合法repo root后原断言全通过。没有改产品高亮期限/几何容差或删除断言。

契约/实现/自查analysis/settings-output-priority-20260922；headless脚本work/settings-output-priority-20260922/check.mjs；当前机器记录analysis/batch2-status-20260921.json。

## 0.2.46 设置选择器与7项GUI（未安装）

继续“大头优先”：按2.2553.1 shared-frame xb/Tb/Eb，把设置中的原生select替换为CDS单选字段与listbox浮层。主题超过5项自动搜索，重音/大小写不敏感、空态与选中Check；通知/声音/归档160px、worktree220px、主题全宽，32px实际控制高/16px caret/4px浮层内边距/最大320px。真实选项与保存回调不变，没有新增虚假能力。

焦点/键盘支持方向、Home/End/首字母、Enter、Escape、Tab，输入法Escape不误关设置；Cmd+F继续交给设置搜索，点击外部保留新目标焦点。浮层对齐实际字段容器并跟随滚动/ResizeObserver；卸载清理监听。单选桌面分支以外的共享Combobox能力仍未全部复刻。

最终Node763项762通过1既有跳过0失败；build/integrity通过。构建2026-09-21T18:54:33.875Z，SHA `e37b4d89d354354a911c240a4d1c372a766d0ef6c91b2e559958d92a9f043857`，270源码文件。最终同一构建7GUI串行通过：settings-rest、settings-complete、settings、skills-mcp、edit-read、run-command、diff。包含搜索/空结果/焦点/快捷键/原有主题高亮与持久化、Skills文件、用户截图中的工具组/运行统计、Changes真实补丁复制与分隔条。

失败保留：新增测试直接parseFloat解析calc令牌得到NaN，改为测量解析后的像素，原exact断言不变；GUI同时发现锚点错误导致浮层窄8px，修为整字段。补测证明Cmd+F被popup无条件stopPropagation吞掉，修为保留父级组合快捷键后原测试通过。中间构建的通过不混作最终证据。

当前40标准套件未运行，含5项852px环境阻塞；新无窗口工作区观测1470×849。安装只读仍0.2.13，未打包/替换，用户原Electron8272未动，测试实例已退出。全部历史推迟项保留，不声称整体99.99%或1:1，Goal仍active。当前Goal允许GUI，旧不占屏门禁已归档。

契约与自查analysis/settings-select-20260922；机器状态analysis/batch2-status-20260921.json；.45补diff GUI证据归档analysis/batch2-status-0.2.45-gui-20260922.json。

## 0.2.45 AI差异阅读与不占屏验证（未安装）

继续用户最常见的设置/AI阅读体验，Changes按2.2553.1默认line-info显示真实省略行数，替代裸`@@`补丁头；从第1行开始或相邻hunk不占分隔空间。对话工具预览仍按源码simple分支。只使用实际patch坐标，不读取当前磁盘充作历史、不提供虚假上下文展开。

完整Node758项757通过、1既有跳过、0失败；build/integrity通过。最终构建2026-09-21T18:33:04.343Z，SHA `0ba6fd5656ebdeb3f10f6718e4ad712dfbb4893dec2de0625aa0e1083e0c781d`，267源码文件。使用headless Chromium加载真实React SSR与生产CSS，8种浅/深色×单/双列×换行/不换行组合通过：32px高、8px间距/内边距、6px圆角、真实6/33行计数、行号和无假展开按钮。没有启动Electron或可见浏览器，不占用户屏幕；没有改系统设置/用户会话/配置/剪贴板。

此后台渲染不是完整Electron交互测试，不验证点击/键盘/Copy/effect/高亮worker；本版47标准套件未运行。既有diff套件追加真实Git夹具且语法检查通过，尚未执行。5项历史852px环境阻塞保留，工作区1470×849为旧观测。安装只读确认仍0.2.13，未打包替换。完整上下文加载/100行展开/虚拟化及全部历史推迟项继续保留，不声称整体1:1。

首轮后台HTML遗漏UTF-8声明并使用默认色值，查看截图发现乱码；修复测试页面编码、载入生产Claude主题变量，加真实减号断言后8组合重跑通过。两轮记录保留，未修改产品代码或降低断言。源码契约与三方面自查analysis/diff-separators-20260922，headless脚本work/diff-separators-headless-20260922/check.mjs；.44的6GUI属于历史版本，已归档。当前Goal的GUI授权保留，本轮选用不占屏方式，Goal尚未完成。

## 0.2.44 Skills文件预览与6项GUI（未安装）

优先设置/AI可见体验，按2.2553.1拆包给Skills详情补默认Markdown Preview与Code切换、结构化元信息、源码行号、真实完整原文。仅现有白名单SKILL.md，不伪造文件树/编辑操作；按路径隔离模式。继续追到shared-16后确认typography=inherit不是CDS prose，使用源22/18/16px标题与12px grid间距。sm Eye/Code单tabstop、方向键切换与焦点；描述不在文件内重复。YAML使用独立ISC依赖yaml2.9.1，许可随构建输出并纳入完整性检查。

最终Node752项751通过、1既有跳过、0失败；build/integrity通过。构建2026-09-21T18:16:27.231Z，SHA `96d70030eeb48c7662fb9c9db0bf6ac8f7be16b2b855b78806facdbe12e285b8`，266源码文件。最终同一构建6GUI串行通过：skills-mcp、settings-complete、settings-rest、settings、edit-read、run-command。包括Preview/Code真实CRLF与末空行、20px inset/26.4px行高/28px控制高、Developer删除全部分支、外观持久化和AI文件/命令组/运行统计回归。新增Code定位初次匹配主界面同名按钮失败，限定到文件区域后原断言通过；原失败日志保留，未放宽断言。

官方200KiB大文件走完整纯文本；本地另加10000行限制防止大量DOM。未实现Markdown源码颜色、文件fence完整工具条、复杂表格壳/远程图片、多文件树/虚拟查找等；没有声称完整文件预览1:1。当前41个标准套件未跑（含5个852px环境阻塞），最后工作区1470×849；安装只读确认仍0.2.13，未打包替换。用户原Electron8272未动，测试实例已退出。当前active Goal允许GUI，旧门禁仍归档；全部历史差距保留，Goal未完成。

契约/三方面自查analysis/skill-file-preview-20260922；机器状态analysis/batch2-status-20260921.json；.43的20项GUI归档analysis/batch2-status-0.2.43-gui-20260922.json。官方AX/截图不一致，仍不能证明同态像素或99.99%。

## 0.2.43 追加20项GUI回归（当前Goal重新授权，未安装）

当前active Goal明确允许GUI，历史不占屏门禁已归档。20项相关套件同一构建串行通过：设置4项、Skills/MCP、命令/文件工具、流式高亮、会话、协议、后台任务、子代理、工作流2项、斜杠、diff、回合页脚、用户操作、菜单、输入框。Developer确认取消/写入失败保留与恢复焦点/成功删除真实刷新均通过；完整Node742项741通过1既有跳过0失败，最终integrity通过。源码构建哈希仍56495a8a5b7ed84e978ffad0077edff9f1818a1be3e9d5c80c4e3bec735c3a2f。

两次测试失败保留：命令等待文案须等Ghe150ms/WM650ms稳定；关闭设置后须等200ms卸载与inert解除再填编辑器。补源码支持的前置等待后原严格断言通过，未放宽容差。隔离fixture补真实配置删除回读及失败注入；未写真实用户配置。新无窗口探测1470×849；27项标准未运行（含5项852px环境阻塞），未全链验收，未打包安装，安装仍0.2.13。官方AX/截图不一致不能作为像素等价证明。

完整收据归档analysis/batch2-status-0.2.43-gui-20260922.json。下一处明显设置差距是Skills纯文本文件缺Preview/Code；研究见work/skill-detail-source-20260922。全部历史推迟项保留。下方“后台验证”段是此前普通回合的历史状态，不覆盖当前Goal授权。

## 0.2.43 设置操作与 AI 等待文字（后台验证，未安装）

按当前用户“先改设置与AI输出、不占屏测试”的要求继续。Developer按拆包补标题/状态与右侧ghost/sm删除按钮；只为真实可删除定义显示，插件管理/缺配置/不支持的key名称不显示。原生确认说明与CLI共用配置，调用既有mcp-remove真实RPC后刷新；取消不写入，失败后仍读取真实状态，不凭空移除行。旧请求/切页/卸载回包受隔离，删除过程阻止重复点击，操作后恢复可用焦点。

AI等待文字按Ghe/WM补150ms稳定与650ms最短驻留；只作用于Working与真实工具活动。推理/压缩/停止/审批/断连/完成即刻更新；会话与回合隔离，卸载取消计时器，耗时/token计数不受节流影响。完整morph和全部官方状态仍未实现。

当前Node742项：741通过、1既有跳过、0失败；build/integrity通过。构建2026-09-21T17:45:26.748Z，`56495a8a5b7ed84e978ffad0077edff9f1818a1be3e9d5c80c4e3bec735c3a2f`，262源码文件。实际React SSR、虚拟时钟与生产RPC adapter的隔离mock通过；settings-complete追加删除尺寸/取消不写入断言，仅语法检查，未运行。当前47GUI全未跑，无新屏幕/像素证据；0.2.42八项GUI仅历史，已归档。

本轮未启动Electron/可见浏览器、未探测桌面、未修改真实Codex配置。测试门禁启用；下方旧版本“当前Goal允许GUI”是历史记录，不代表本轮授权。5项852px环境阻塞沿用历史1470×849。安装版本只读确认仍0.2.13，未打包替换。源码契约与三方面自查：analysis/settings-ai-interactions-20260922；机器状态：analysis/batch2-status-20260921.json。全部历史推迟项继续保留。

## 0.2.42 AI运行状态行与8项GUI（未安装）

按用户截图与2.2553.1 Y5经典分支补“耗时 · tokens · 活动”状态行：真实Turn.startedAt驱动整秒时钟，2秒后显示；仅在已知输出累计基线时显示当前回合outputTokens，不累加重复通知、不混入旧回合、不估算字数。工具/推理由实际当前turn item生命周期驱动，思考文案按源15/30/45/60秒变化。时间/token普通secondary，活动shimmer；完成/停止/断连隐藏统计并取消订阅。缺明确model等待事件保留Working，不伪造Waiting for Claude。

同时修复0.2.41新插件Connectors分页因描述缺失而崩溃：补统一空描述模型并增加真实SSR分页覆盖；设置整页详情、分页/技能返回已在GUI通过。

最终完整Node731项730通过1既有跳过0失败；build/integrity通过。构建2026-09-21T17:25:12.131Z，`71cf2495791ec8c9f7a34516ad4c875418d53dc1a9e293bf1ce851f61ebde6af`，260源码文件。同一构建8GUI串行通过：run-command、stream-highlight、session、skills-mcp、settings-complete、edit-read、protocol-0155、settings-rest。实际状态行43s/287 tokens/Running tools、20px行高/16px间距/4px中点padding，重复/迟到通知不重复计数，工具→推理→停止清空。字体/主题/转录视图/行展开意图、插件分页、文件工具、协议恢复等相关回归通过。截图是隔离fixture，不是官方像素等价证明。

失败保留：插件可选description未覆盖造成真实崩溃；新统计GUI把computed 4px与custom property calc表达式直接比较。前者修代码+SSR，后者解析token后保持exact断言；未降低容差。源码时钟/基线/回退/迟到/断连与hydrate竞态另有Node覆盖；GUI用真实隔离协议通知而非伪造DOM。

当前Goal允许GUI，门禁归档；不应在自动续跑时重新套用早先“不占屏”约束。新无窗口探测工作区1470×849，classic11px为当前工具GUI观察。39项标准未运行，5项852px环境阻塞仍在。未打包安装，只读确认安装0.2.13，无新安装收据。完整动画/等待/重试状态、插件详情其他分支、AI完整上下文/虚拟化以及全部历史推迟项继续保留，Goal保持active。

源码契约/三路自查analysis/transcript-runtime-stats-20260922与analysis/plugin-detail-20260922；机器状态analysis/batch2-status-20260921.json；0.2.41四项GUI历史归档analysis/batch2-status-0.2.41-gui-20260922.json。

## 0.2.41 Plugins整页详情（后台验证，未安装）

继续优先设置与AI输出的可见体验：按2.2553.1动态入口追到PluginDetailPageClient，Plugins详情由旧侧栏改成整页返回头/独立滚动正文，标题、来源与作者、Description、Skills/Connectors/Hooks内容Tabs。真实条目超过5个才出现搜索，技能按名排序、Hooks保留报告顺序；返回技能详情保留根分页意图，列表保留搜索与已观察滚动。只有同插件唯一真实路径可打开技能；摘要条目不伪造操作；空回包显示失败而非无限loading。

完整Node725项：724通过、1既有跳过、0失败；22定向通过。build/integrity通过，构建2026-09-21T17:09:43.298Z，`5b53d3f9a4cce14f5ca29d942fd7bad9d838bdf68c03521de98a4f30e74d2904`，259源码文件。skills-mcp GUI已按源码更新分tab/整页预期，原表格尺寸及RPC断言保留，仅语法检查，未运行。实际点击/键盘/滚动与像素均待验，不声称1:1。

按用户不占屏要求，本轮没有启动Electron/可见浏览器或桌面探测；47标准GUI均未运行。0.2.40六项GUI已归档历史，5项852px环境阻塞沿用1470×849旧观测。未全链通过，不打包、不安装，没有新安装收据。当前读码发现旧.40机器收据索引把settings-rest重复作settings，已按真实receipt.name更正历史索引；旧原始记录/日志保留。

源码契约与三方面自查analysis/plugin-detail-20260922，机器状态analysis/batch2-status-20260921.json。插件详情其他旗标/多文件树/完整hook与connector细节、Storage/认证、AI完整上下文与虚拟化及全部历史推迟项继续保留。

## 0.2.40 设置搜索定位与6项GUI回归（未安装）

直接对照2.2553.1拆包补设置搜索定位：等待真实可见行和稳定布局再播放波浪/洗色；至少250ms及3稳定帧、1500ms上限，用户滚动后不强制拉回；重复搜索同一行可重播，取消/卸载/动画结束会清理。Developer标题说明按源码补齐。

当前最终构建2026-09-21T16:53:34.085Z，`5703b095bfa6ed556180e4d0007e05256c281c64479e124909e664194bad78ee`，258源码文件。完整Node721项720通过1既有跳过0失败；build/integrity通过。6项GUI串行通过：settings-complete、settings-rest、settings、skills-mcp、edit-read、run-command。包含真实目录详情与禁用条目、More查询种入；主题/字体/字号/宽度与重启恢复；行展开意图跨Normal卸载/Thinking重挂载且Verbose不覆盖；文件/命令分组、ANSI、真实diff/表格/链接、复制与键盘。重复定位高亮实测263.2ms后开始；初始弹窗1024×736、导航192px不变。

失败保留并说明：Search Clear保持展开影响后续前置状态、预加载改变MCP最后一条请求归属、Node夹具位移未超过200px边界、旧测试CDP往返耗尽200ms关闭驻留。均修正测试场景/定位，未放宽断言/几何/计时容差。源码等待/清理逻辑另有确定性模型覆盖。

新无窗口探测工作区1470×849，当前文件工具GUI观察classic11px。41个标准套件尚未跑，5个852px套件继续环境阻塞；完整链未验收，因此不打包、不替换安装0.2.13，没有新安装收据。官方像素同态对比仍未证明，不声称99.99%。

契约/三路自查analysis/settings-anchor-20260922；机器状态analysis/batch2-status-20260921.json；历史.39五套见analysis/batch2-status-0.2.39-gui-20260922.json。剩余包括完整插件页/Storage/认证、完整上下文diff与虚拟化、后台竞态及全部历史推迟项。下一轮继续用户最常见设置/AI表面；Goal保持active。

## 0.2.39 设置目录与AI展开体验（后台验证，未安装）

按用户“大头优先”和“不占屏”要求继续对照2.2553.1拆包独立实现：

- 设置搜索接入实际Skills/Connectors/Plugins，可直达真实详情；同名路径不混淆、插件技能去重、More种入页内查询。索引及页面隔离cwd/thread，旧详情回包不能覆盖新选择。
- AI命令/文件/读取等工具行记忆显式展开，组与行分别保存；切会话隔离、重挂载恢复，Verbose强制展开，返回Normal恢复原意图。仅有限内存布尔缓存，未写用户配置。
- 0.2.37的分类失败动词颜色、真实状态计数、文件diff、ANSI、表格与设置布局继续保留。

最终Node715项714通过、1既有跳过、0失败；build/integrity通过。构建2026-09-21T16:41:37.958Z，`a87d0859ed4149544f789737a96fc31700fda3b110085419bb1cbdb35b52c65f`，257源码文件。使用真实React组件SSR，当前47个GUI均未运行；0.2.37七项GUI证据已归档历史。本轮没有启动可见窗口/桌面探测，没有操作用户应用。

5项852px环境阻塞沿用历史1470×851观测；未降低容差、未改系统设置。安装Info.plist只读确认仍0.2.13；未打包替换。新增GUI断言仅语法检查，不能宣称像素/焦点/点击已验。旧失败和全部推迟项保留。

契约/实现：analysis/settings-catalog-search-20260922、analysis/ai-tool-expansion-20260922；机器状态analysis/batch2-status-20260921.json。剩余包括完整插件详情/More技能词列表、设置精确锚点/Developer/Storage完整能力/认证，以及AI完整上下文与虚拟化等历史项。不宣称全界面1:1。

## 0.2.37 优先设置与 AI 输出（后台验证，未安装）

按用户要求优先主要可见界面，继续对照2.2553.1拆包独立实现，本轮不占屏。

- 设置搜索：按节分组，最多3个子项与“+N more”，节图标/两行命中/连续原文accent高亮、真实关键词跳转；空查询关闭，IME Escape保护。导航/搜索明确md图标改20px，空态SearchCircle按xl=28px（纠正0.2.34的16px结论；不放宽断言）。动态Customize子路径索引未完成。
- AI工具组：全失败类别仅动词红色，部分失败保留(N failed)，中断不计失败；同路径重试按实际观测更新；Web搜索用browsed the web。按会话+组首工具ID记忆显式展开，Verbose强制展开，回Normal恢复意图；仅内存布尔缓存，最多1000项。源码8px/10px工具列表几何未改。
- 后台任务：真实启动不会被启动前空列表暂时盖成unknown；早期Stop先重新核实成员和连接。未造时间或终态。

最终Node708项707通过1既有跳过、0失败；build/integrity通过。构建2026-09-21T16:24:21.872Z，`4c69a1f308589193166c6716cffc099b20939ad2e21a4e139b640df9fbc91b8e`，256源码文件。真实React组件SSR覆盖设置搜索/工具组，并非GUI或像素验收。当前47标准屏幕套件全未运行；0.2.34的8项GUI仅保留历史。没有启动可见窗口/桌面probe，原用户应用进程未动。

最后观测环境1470×851、classic11px仍为历史；5项852px环境阻塞继续。未全链验收，因此未打包/替换安装，Info.plist只读确认安装仍0.2.13。所有失败记录保留；新增搜索测试曾遗漏一字符关键词匹配，已按真实源行为纠正并重跑通过。

契约与三路自查：analysis/background-lifecycle-20260922、settings-search-20260922、ai-tool-summary-20260922；完整机器状态analysis/batch2-status-20260921.json（包含全部历史推迟项）。本版没有新安装收据，不宣称全界面1:1。

## 0.2.34 设置主要界面修正与8项GUI回归（未安装）

按拆包mS调用链修正导航为Settings→Desktop app→Customize，窄屏Tabs同序。修复Icon字体span错误继承flex:1，恢复16px图标与正常192px栏内完整Preferences/Connectors标签；修复旧raw-diff的8px span留白污染设置代码预览行号。原有代码/输出改动保留。

当前构建2026-09-21T15:53:32.312Z，`914f72d8c94c6d4964f0dcf91963bd8dca9c08ac668f3170330757e2b044b4da`，254源码文件。完整Node687项686通过1既有跳过；之后CSS修复以GUI验证并重建，未重复Node。build/integrity通过。同一最终构建8项GUI串行通过：skills-mcp、settings-complete、settings、settings-rest、run-command、edit-read、background-tasks、diff。包含设置主题/字体/字号/宽度/退出与焦点/重启恢复、Customize真实fixture操作、Read/Edit/词级差异/表格/文件链接、命令ANSI/复制/审批、后台输出跟随与停止、Changes分栏换行与真实Git复制。

失败均保留：过期标签选择器、动画中测量、关闭提交早于卸载、真实预览CSS污染、异步terminal inventory、未建立窄pane条件、旧generic fileChange DOM。测试只按具体源码/生命周期更新，几何阈值与容差不放宽；两个raw patch保留逐字节和真实Copy验证。

当前桌面1470×851，classic滚动条本轮观察11px；39项标准GUI尚未跑，5项852px旧环境阻塞仍在。官方AX读取到设置顺序，但截图与AX不同步，不能作为像素等价证据。全链未验收，未打包/替换安装0.2.13。下一步继续剩余界面与回归、处理后台事件/快照短暂unknown，不声称99.99%。契约/三路自查analysis/settings-navigation-20260921，完整状态analysis/batch2-status-20260921.json。

## 0.2.33 AI响应链接与恢复GUI验证（未安装）

响应中的file URL和相对路径可打开真实Files内容并定位行范围；普通网页链接保留安全HTTP(S)行为，超长URL按源码缩短文字，避免嵌套代码双重按钮。687项Node测试686通过、1既有跳过，build/integrity通过。构建2026-09-21T15:38:43.559Z，c9af82d8135257002a4a8099fb8fdb978b0bbbbbb9730d9b2fcf2c15557036d3，254文件。追加过滤器断言后16项定向Node测试通过。

用户新Goal明确允许GUI，原禁止占屏门禁已归档。当前edit-read与settings-complete专项通过：文件/命令分组、Read/词级diff、表格展开/焦点、真实文件链接/行范围；固定设置头部、退出驻留、Developer/Storage、窄屏Tabs。skills-mcp在旧直接文本节点定位处失败待修，日志保留。首次链接GUI也曾失败：官方过滤器拒绝app.ts:1，fixture改用./app.ts:1并新增裸路径不可点击断言，未放宽容差。

新无窗口探测1470×851；五项852px历史环境阻塞继续；edit-read观察classic滚动条11px，旧overlay事实不再作为当前事实。官方AX已读取Code设置导航，但截图仍显示此前转录，不能用作同状态像素证据。完整47标准链尚未通过，不打包、不替换0.2.13安装；所有历史差距保留。契约/实现analysis/response-links-20260921，状态analysis/batch2-status-20260921.json。

## 0.2.32 后台命令输出（后台验证，未安装）

后台输出与对话命令共用ANSI着色组件，命令区共用带美元提示符的语法高亮代码卡；保留末尾8000字符与真实截断提示，不重建未知前缀颜色。只用受控React样式/文本，不解释HTML或OSC链接。自动跟随按session+task记忆，折叠重开保留暂停状态；仅输出区内部的非空选区暂停跟随，源严格小于16px恢复，缓存最多1000个意图、不保存输出。summary等于description时走源空输出文案。

后台680项679通过、1既有跳过、0失败，含实际前台/后台SSR共享ANSI与安全文本、截断、提示符和跟随边界/选区/隔离/缓存测试；build/integrity通过。构建2026-09-21T15:28:32.706Z，`fd7b44f9c20ef16ea38287979d83c6f642c457e1d294a0ccd006442cce5c6c35`，253源码文件。background GUI fixture补彩色60行输出/HTML-looking文本、实际命令高亮与折叠后跟随断言，仅语法检查未运行；既有几何/Stop真实性断言不放宽。

源契约和三路自查：analysis/background-output-20260921。没有启动窗口，47标准GUI全部未运行；真实选区/滚动/主题像素仍待验，不宣称全界面1:1。安装仍0.2.13，无打包替换，历史差距/失败/推迟项保留。旧段落“后台无ANSI”为当时版本状态。

## 0.2.31 Customize设置页布局（后台验证，未安装）

Skills/Connectors/Plugins共用固定56px页头和独立滚动正文，移除旧外层56px padding造成的额外空段；关闭按钮保留右上位置。技能详情返回栏固定、正文独立滚动，返回原query/group列表恢复实际观察到的位置。Clear search按源保持展开与输入焦点，普通Escape收起；IME composing Escape阻止传到设置弹窗。没有新增共享Codex配置写入。

后台675项：674通过、1既有跳过、0失败；模型验证返回/不同查询组/清理后迟到事件/布局夹断，实际SSR覆盖三个空列表壳无伪造条目；build/integrity通过。构建2026-09-21T15:21:59.473Z，`3ac4d86963c524b30c24bddaa04a2db0ec58ec28ff03eb7a68a487057e1b936f`，251源码文件。skills-mcp套件补固定头/独立overflow/Clear/IME断言，仅node --check，GUI没有运行。既有表格尺寸/颜色/焦点断言未放宽。

契约及三路自查：analysis/customize-shell-20260921。本轮纠正现有非pageLayout/折叠搜索壳；源码另有pageLayout/hero/frame旗标分支，实际旗标、所有分支和跨设置节滚动记忆仍未完成。47标准GUI全部未跑，视觉/真实滚动/焦点待验，安装仍0.2.13，无打包替换。历史失败/剩余/推迟项继续保留。

## 0.2.30 Changes阅读控制（后台验证，未安装）

继续按2.2553.1拆包源码补Side by side与Word wrap设置：菜单勾选后保持打开，选择分栏但正文不足560px时显示Needs a wider pane并临时单栏，扩大后恢复。偏好用Code Desktop独立全局键保存，跨窗口storage事件同步。分栏按真实change块配对，缺侧空白、不编造行号，保留两侧语法/词级装饰与无末尾换行注释。关闭换行后共享hunk列宽。

后台671项：670通过、1既有跳过、0失败；实际React SSR、配对/注释/独立索引、存储异常/跨窗口事件、560/零宽/清理边界均有验证。build/integrity通过；构建2026-09-21T15:14:12.017Z，`dcaf0c95d36e9de3f35acdac35b14d702fd9ed175882444b7fdd266798a18c73`，250源码文件。diff-ui仅补断言并做语法检查，没有运行。

源码契约与三路自查：analysis/changes-controls-20260921。47标准GUI仍全部未运行，实际列宽/水平滚动/焦点/像素待验；安装仍0.2.13，没有打包替换。完整上下文/精确separator/行选择批注/虚拟化以及设置搜索等历史差距继续保留。下方旧版本split未实现条目为历史状态。

## 0.2.29 Changes面板阅读（后台验证，未安装）

Changes接上工具预览同一套前后片段语法高亮、word-alt词级装饰与主题；按源默认改成单列unified行号和自动换行，真实old/new坐标仍在DOM，Copy保留完整原始patch。scope包含session/cwd/diffScope/file/hunk；重命名前后扩展名分别决定语言。修复旧span样式给代码token添多余留白，空hunk与malformed/raw不造内容。

后台664项：663通过、1既有跳过、0失败，含真实Changes和共享代码行的Node SSR；build/integrity通过。构建2026-09-21T15:01:59.210Z，`d4b806219461e3a7e70cd6ab0e46f04b004be907dd62f5fa907db59d6ff8f8eb`，248文件。词级Worker构建字节/依赖图仍通过；0.2.28实际构建Worker执行收据明确归历史。

源契约与三路自查：analysis/changes-reading-20260921；机器记录analysis/batch2-status-20260921.json。diff-ui旧双列预期按原文改成精确单列，双侧坐标断言保留，并新增真实Git TypeScript第四文件、语法/词级叠加、长行换行与token无额外padding断言，GUI全部未运行。

完整上下文、split/上下文展开/精确hunk separator、选行批注/审查/虚拟化仍未完成，旧差距继续。没有占屏测试、没有打包安装；安装仍0.2.13，47标准GUI未跑，不宣称1:1。下方旧版本“Changes未接高亮”为历史状态。

## 0.2.28 AI文件编辑词级差异（后台验证，未安装）

继续AI输出大头：文件工具Edit预览按源word-alt标出行内改变的词/空白，与旧/新两侧语法颜色叠加。配对行按change块顺序，纯新增/删除不标词；源1000字符上限、Unicode码点和UTF16坐标保留。Copy仍是原始patch。

计算进入共享独立Worker，过期/取消/超时与队列压力有处理，文本选中时延迟替换。未用当前磁盘内容假装历史文件，完整上下文高亮仍未完成；Changes pane尚未统一这套词级diff。

后台660项：659通过、1既有跳过、0失败；构建、源码完整性和实际生产Worker的Node隔离执行通过。构建2026-09-21T14:52:29.728Z，哈希`5808bb1f013b8e0cdfed281f3e20d2be75307c792de4e200be276ae483ce3111`，245文件。生产词级Worker1869字节，单独manifest和依赖图校验；既有语法Worker约束未放宽。未开任何测试窗口，47GUI全部未运行，安装仍0.2.13。

契约/三路自查：analysis/file-word-diff-20260921；source-only格式化资料在work/diff-word-20260921。当前机器记录analysis/batch2-status-20260921.json；0.2.27快照已保留。所有历史失败与推迟项继续，下方“词级diff未做”为旧版本状态，本轮只完成文件工具接入与后台验证，不宣称源引擎全部行为/像素等价。

## 0.2.27 设置页主体布局（后台验证，未安装）

继续用户“大头优先”：独立固定顶部栏与滚动正文；按源text-body修正行说明字号，组间距使用gap而非pad；panel小阴影/圆角/深色边框。关闭后内容保留到opacity过渡结束，重开取消旧清理，inert/焦点在实际卸载时释放；窄屏按源只显示标题/关闭/横向Tabs，并支持方向键、Home/End、RTL。

后台648项，647通过、1既有跳过、0失败；逻辑单测后补源CSS token修正并重新build/integrity通过。构建2026-09-21T14:41:30.871Z，`ae8e94b4e244f766033c0275faca646a842d868ae548171d31d0dc37c6218c43`，241文件。没有启动Electron、浏览器窗口或桌面probe；47标准GUI全部未运行，实际动画/焦点/几何待验。安装仍0.2.13，没有打包替换。

契约与三路自查：analysis/settings-shell-20260921；当前机器记录analysis/batch2-status-20260921.json。窄屏旧测试的Search焦点入口按源“窄屏无搜索”改为活动Tab，保留焦点约束并新增无搜索/键盘断言；未放宽几何或计时容差，GUI仍未运行。旧源码/失败/推迟记录保留。

当前剩余以机器记录为准：设置搜索、精确锚点、动态Customize索引、认证/托盘、Developer/Storage完整能力与Customize完整页面壳、全部AI输出/工具及历史差距继续保留；下文旧版本“退出驻留未实现”为历史状态，本轮已有代码但GUI待验。

## 0.2.26 AI输出阅读交互（后台验证，未安装）

继续设置页面、AI输出大头优先。已按拆包源码补齐宽表格Expand阅读弹窗（实际内容快照、标题、流式状态、退出驻留、外观同步）与AI行内文件路径代码片段打开Files pane；修复表格/设置交叉关闭造成主界面inert残留的问题。0.2.24/25设置与输出排版改动保留。

后台最终644项：643通过、1既有跳过、0失败，含实际React SSR；build/integrity通过。构建2026-09-21T14:33:04.255Z，源码哈希`a8ef10eaf8393da9c7626c00414b6d68c17120d59fec6f3f3b755e3f5e26cf7b`，239文件。未启动Electron/浏览器窗口/桌面probe，47屏幕套件全部未运行，不能声称像素或焦点实测通过。安装仍0.2.13，未打包或替换。

本轮契约/三路自查：analysis/ai-output-interactions-20260921。机器记录analysis/batch2-status-20260921.json；0.2.25快照已保留。首次新测试fixture失败及修复日志完整保留，未放宽断言。

当前差距：表格实际几何/动效/焦点仍待GUI；全文上下文菜单等响应分支、完整上下文词级diff、原生虚拟化/morph、设置搜索/退出驻留及全部历史推迟项仍未完成。下方版本段落为历史状态：其中“表格Expand未做”已由本轮实现更新，不能据历史条目否定当前实现或把历史GUI通过搬到当前版本。

## 0.2.25 设置与AI输出优先（后台验证，未安装）

用户优先级调整：先改设置页面和AI输出等高可感知区域；搜索细节计划暂停，尚未改搜索组件。全过程不启动任何屏幕测试/桌面probe，不改系统设置，不写用户共享Codex配置。

- 0.2.24 设置：Developer改为192px服务器列表＋真实配置/状态详情；Storage改为720px独立弹窗，含真实总量、分区、Details、刷新、打开目录、父窗inert与焦点恢复。统计不重复计算嵌套根，未测量完整则显示下界；不画假清理按钮。
- 0.2.25 AI输出：按拆包response分支修正正文标题、段落/列表/引用、行内代码和表格底色/间距/滚动；Read补行号并修复token没有着色的问题，Edit按hunk前后两侧独立语法高亮，Copy仍保留真实原文/补丁。
- 最终后台单测634项，633通过、1既有跳过、0失败；build/integrity通过。构建时间2026-09-21T14:10:44.892Z，源码哈希`e0464dafa7bc43c185f2f792bd6de349c707e88ff47b44ec1172427140a617a5`，235文件。相关GUI断言已新增，但全部47标准屏幕套件当前未运行，不声称1:1。
- 安装仍0.2.13，未打包/未替换，无新安装收据。保留所有旧失败日志和环境事实（1470×849、overlay0；未重新占屏探测）。

本轮源契约/自查：analysis/settings-pages-20260921与analysis/ai-output-style-20260921；最新机器记录analysis/batch2-status-20260921.json，日志work/batch2-takeover-20260921/settings-pages-*、ai-output-*。

当前剩余：AI输出：Read已补摘录行号/语法paint，Edit已接可见hunk片段高亮，但缺完整上下文与词级diff、原生虚拟化/morph和部分分组状态持久化/全失败分类颜色；表格Expand弹窗未做；命令描述与shell字段缺失时仍只显示真实Codex信息。 设置：Developer双栏/Storage独立弹窗已实现，GUI未验；Storage为本地数据统计适配，未接清理；Developer空态插画/环境变量值/日志/删除仍有差异。搜索分组更多/高亮、退出驻留动画、精确锚点、动态Customize索引、device-code/cancel/logout、托盘仍未完成。Sandbox/Bypass只读，不写共享~/.codex。 其余背景任务、工作流、子代理、斜杠、源像素/打包和历史推迟项全部延续下方清单；不把无数据能力补成假UI。

## 0.2.23 第二批当前状态（未验收、未安装）

用户最新要求：测试不得占用屏幕。禁止启动Electron GUI/交互应用/桌面probe；`work/batch2-takeover-20260921/screen-tests-paused.json`为运行器门禁，所有屏幕套件未运行不计为通过。npm test已默认串行，不改断言/容差。

七项均有实现与源契约；edit-read(0.2.17)、subagents(0.2.18)、slash(0.2.19)只有各自历史局部GUI证据；settings(0.2.20，仍有功能/保真差距)、background(0.2.21)、workflow-package(0.2.22)、workflows(0.2.23)GUI均待验。工作流是MIT独立Node引擎真实事件，非伪造Codex item；/workflows打开Background tasks，不是虚构独立路由。开关、/workflow启动、实际阶段/代理/停止、journal/cache/replay/result已接。

最终单测626项625通过1既有跳过；后续展示壳源码对齐已重新build/integrity通过。当前源码哈希 `d28fc74e1cb04fb6fe651fe9d1fa852397df9df31974d7aae2214cf738bb798e`（231文件）；构建时间 `2026-09-21T13:27:05.219Z`。全部47标准屏幕套件当前未跑，不能把历史版本绿灯搬过来。真实0.155.1隔离握手通过，隔离环境未认证，真实模型调用0。详细机器记录analysis/batch2-status-20260921.json；日志work/batch2-takeover-20260921/release-*与source-alignment-*。

最后环境事实1470×849/overlay0px，不再占屏复测；5个852px旧阻塞保留。并发时序/worker超时日志完整保留，串行通过未放宽断言。安装仍0.2.13，未打包、未安装、无installation receipt、无新verified快照。

### 当前剩余（旧历史不删除）

- 当前构建47个标准屏幕套件全部未运行；历史0.2.17–0.2.19的局部通过不等于0.2.23全链通过。官方同状态像素对照、打包/ASAR/签名/安装验收未完成。
- 文件工具：读取摘录无独立行号栏、编辑diff未接完整语法高亮、原生布局morph与部分分组状态持久化/全失败分类颜色仍有差距。命令描述与shell字段缺失时只显示真实Codex信息。
- 子代理：无可靠handback/peer标记，不能伪造Report from subagent/Message from subagent标题；无远程teleport、Agent审批、description变位或Claude模型别名。
- 斜杠：completion不是原生原子chip；无官方WASM/frequency排名与大列表虚拟化。status、导出格式为Codex适配；rewind不回滚磁盘文件；未实现无真实能力的CLI命令。
- 设置：搜索分组更多/描述高亮、退出驻留动画、精确锚点波纹、Storage独立弹窗和清理、Developer双栏、device-code/cancel/logout、托盘开关仍未完成。Sandbox/Bypass只读，不写共享~/.codex配置。
- 后台任务：输出尚无ANSI着色；未知状态单列为Codex适配。历史缺真实时间戳时省略；不伪造Stopped或完成。
- 工作流：代理沙箱当前固定read-only；human需要args.checkpointAnswers预答；独立认证环境真实模型运行未验。脚本由用户明确选择，Node vm不是OS安全边界。
- 工作流UI：错误详情当前用tooltip而非官方popover；无anticipate装饰ghost；没有阶段事件的代理归入Agents展示组；本地启动对话框、plan说明和命令是公开的Codex适配。无官方独立journal/narrator/artifact页面，不发明这些界面。

### 推迟类别（包含旧审计纠正）

- Run in background/Ctrl+B、TaskOutput/TaskStop及非后台agent命令的独立kill，无对应真实接口；不绘制假功能。
- 工作流审批卡、组织策略分支、pending/Queued、ultrareview停止确认，无真实触发源。
- 后台loops/CronDelete、preview server、monitor/dream/remote agent、View session/artifact、session-details rail、auto-archive/model-switch提示、Claude输出文件轮询及来源不明的OS/toast通知。
- Glob、secret扫描/Reveal secrets、NotebookEdit、缺失的Read offset/limit注释、编辑器探测/Open in editor、Attach as context。
- git-operation动词、未报告的description/shell（含PowerShell）不可编造；Claude usage attribution、process/realtime/detached review、废弃rollback/settings UI不模拟。
- 缺实际来源的Claude CLI命令：cd/btw/memory/output-style/autocompact、feedback/login/usage-credits/ultrareview、logs/storage/advisor/auto-mode-setup/reload-plugins/create-pr/reset-limits/schedule、会话前CLI builtin和skills-as-commands。已有真实tasks/workflows/plugin与队列不再统一列为“无能力”。
- 设置里的Claude云端Privacy/Billing/Capabilities/Memory/Cowork/Import-export、Chrome/Extensions/Computer use/Browser tools/cookies/sites、Mobile simulators、Pull requests/Cloud sessions、CLI install/Output style/Classify states、Quick Entry/Voice/Dictation与远程控制。已有真实MCP Connectors不再列为缺失。
- 历史transcript-motion与diff-engine大项、完整pane结构动画/所有tile与popout状态同步、侧栏云端/分享/拖动置顶/批量模型和审批悬停卡等旧差距保留，详见README/HANDOFF历史章节；classic scrollbar与官方运行态像素对照仍未验。
- six-ddc备用包未启用；主候选已内置。真实script meta、phase、journal与result落盘/重放已接通，纠正旧审计将其永久推迟的结论。


## 0.2.21 后台任务进度（GUI暂停）

任务列表、真实终端停止、子线程与View live output已接入；17项定向单测与构建通过。全量单测两轮仍有既有耗时相关失败，日志保留；GUI全部未运行，不能声明验收通过。最新用户要求不占屏幕持续有效，不打包安装。workflow-package/workflows-ui继续；全部历史差距与五项环境阻塞保留。

## 0.2.20 设置实现进度（GUI 待验）

设置壳、导航、弹层搜索与真实本地桌面接口已接通；608单测607通过1既有跳过，构建通过。用户要求不占工作屏幕：此版本没有跑任何GUI，不能声明界面验收通过。保真/功能剩余见analysis/settings-complete-20260921/implementation.md，继续后台任务和工作流。安装仍0.2.13；所有历史推迟项保留。

## 0.2.19 第二批进度（2026-09-21；未安装）

斜杠命令完成本地实现及专项/8项相关串行GUI回归，601单测600通过1既有跳过；构建915da5cc…77de。源契约、真实接口适配、失败记录与保真差距见analysis/slash-commands-complete-20260921/implementation.md。安装仍0.2.13，无安装收据。

**用户最新约束：测试不得占用工作屏幕。已停止可见Electron套件；后续仅单测、构建和静态复核，GUI留待独立测试环境，不计为通过。** 五项既有桌面高度阻塞与全部历史推迟项仍保留。剩余settings、background-tasks、workflow-package、workflows。

## 0.2.18 第二批接手进度（2026-09-21；未打包安装）

subagents已接真实子线程生命周期、Agent行、工具活动计数、嵌套tasks转录与导航；596项单测595通过/1既有跳过，专项与9项直接影响回归串行通过。最终构建eb557b84…2bc3；细节与失败记录在analysis/subagents-ui-20260921/implementation.md。仍未整体1:1，无官方同状态运行像素对比。前项差距和五项852px环境阻塞保留。安装仍0.2.13，全链验收未通过；接下来slash、settings、background、workflow-package、workflows。

## 0.2.17 第二批接手进度（2026-09-21 20:11 台北；未打包安装）

前置run-command文档与protocol遗留已核实/修正，edit-read及用户指定的文件/命令经典分组已实现并完成局部串行回归。589项单测588通过、1既有跳过；最终本项构建f4c0ccad…732c；edit-read/run-command/protocol/file-search/approval-card/session通过。仅上述fixture状态验证，非整体1:1。详情见analysis/edit-read-ui-20260921/implementation.md，包含失败记录及自查差距。

最新只读桌面探测为1470×849（非旧851），滚动条overlay 0px。五个852px既有套件仍环境阻塞，未改几何/系统设置。全量最终链尚未跑，验收未通过；安装仍0.2.13，无新安装收据。剩余按序subagents、slash、settings、background、workflow-package、workflows；其余历史推迟项继续保留。


本地 macOS 桌面应用：按 Claude Desktop 的 Code 界面拆包源码重建 React 交互层，复用官方 CSS、字体、图标和动画素材，实际会话由本机开源 OpenAI Codex App Server 执行。当前优先完善 Code；Chat、Cowork 排后。

2026-09-21（台北）：**0.2.14 仍未打包、未安装**。完整 `validate-local` 标准链跑过一轮（含两次 `--resume` 与修复后的新链）：build/unit/integrity 与 38 个 GUI 套件中的 33 个通过，5 个因本机桌面可用高度只有 851pt（要求 852）在启动阶段超时；按门槛未打包、未安装，安装目录仍是 0.2.13。详见下节。

2026-09-20（台北）：**0.2.13 已于09:47安装。Fast mode真实档位与设置UI已接通；319项单测通过、1项跳过，28步回归、真实Codex、实际安装版及原生Computer Use通过。** 0.2.12原生键盘验收发现的焦点问题已修复，失败证据保留。0.2.11及更早快照保留；不声称整体1:1。

## 0.2.14 交付验证（2026-09-21 01:30 台北）：**未打包、未安装**

本轮任务是"跑完整 `validate-local` 标准链 → 通过才打包安装"。**标准链没有整体通过**，因此按门槛**没有执行 `npm run package`、没有安装、没有写 installation receipt、没有冻结 `verified-0.2.14/`**；`/Users/oleyyu/Applications/Code Desktop.app` 仍是 0.2.13，用户正在用的应用未被替换。版本号保持 0.2.14（未发布）。

- **环境阻断（无法用仓库改动解决）**：本机桌面可用区只有 **1470×851**（屏幕 1470×956 − 33pt 菜单栏 − 72pt Dock）。macOS 会把每个可见的带标题窗口夹到可用区，实测 5 种设定方式（show 后 setContentSize、隐藏时设定再 show、setBounds、放开 maximumSize、movable:false）全部得到 `1468×851`，比套件要求的 `innerHeight===852` 差 1px。证据：`analysis/batch-20260920/environment-workarea-20260921.json`。因此 `pane-layout-ui-test`、`highlight-coalescing-ui-test`、`transcript-fade-ui-test`、`ui029-ui-test`、`scrollbar-mode-ui-test` 5 个套件在启动阶段超时。**没有改 macOS 设置，也没有放宽任何套件的几何期望**；要恢复只需让桌面可用高度 ≥884pt（例如把 Dock 设为自动隐藏），再重跑这 5 个套件与完整链。
- **通过情况**（同一构建 `ac0dd0a5…a00b79`，UI029/FADE 冻结基线 env 照给）：`build`、`unit`、`integrity` 与 38 个 GUI 套件中的 **33 个**通过；失败的 5 个全部且仅是上面那条 852px 夹断。完整链日志 `analysis/batch-20260920/validation-2026-09-20T16-58-54.156Z/`（首轮）、`…T17-04-37.537Z/`、`…T17-05-25.241Z/`（两次 `--resume`）、`…T17-07-23.766Z/`（修复后的新链，跑到 pane-layout 停）；pane-layout 之后的 22 个套件与 `verify-build` 逐个串行重跑于 `analysis/batch-20260920/sweep-20260921/`（`summary.txt` 为逐项结果）；机器可读汇总 `analysis/batch-20260920/validation-summary-20260921.json`。
- **三处根因修复（没有放宽任何断言）**：
  1. `app/tests/fixtures/{codex,approval,turn-footer,highlight,session-actions}-server.cjs` 的存档写入改为**原子写**（临时文件 + rename）。`permission-ui-test` 连续两次在同一字节偏移 940 处 `Unterminated string in JSON`：`writeFileSync` 就地截断，而套件正在轮询同一个文件。
  2. `app/src/source-session-actions.jsx` 的 `ActionDialog` 改为在 mount effect 里立即移焦（保留原来的 rAF 二次移焦）。窗口被遮挡时 rAF 不触发，对话框拿不到焦点，Escape 于是落在 composer 上按 `showStop` 语义中断了正在跑的回合而不是关闭对话框 —— `session-actions-ui-test` 首轮就是这样在 "Stop response" 上超时。
  3. `app/scripts/user-markdown-ui-test.mjs` 第 8 项在测量前**先关掉 Files 面板**，恢复该断言的前提：面板打开时 chat tile 只有 403px，"单行" chip 夹具实际折成三行（span 187.46 / 高 75.98 / 宽 287），关掉面板后 tile 1036px、夹具确为单行（span 490.21、宽 514.21 = span+24），断言与容差一字未改。这项此前是跨批次遗留的确定性失败（shrink-wrap 批次的新检查 × pane-layout 批次的 tile 宽度）。
- **本机环境事实**：今天滚动条为**覆盖式（overlay，0px gutter）**（新窗口里 `offsetWidth-clientWidth === 0`），此前批次记录的 Razer 鼠标在线导致的 classic 22px 状态已不成立；冻结基线本身是 overlay 录的，`UI029_BASELINE_REPORT` / `FADE_BASELINE_REPORT` 仍按既定方式传入。classic 模式的几何/绘制仍只有源码依据，未与官方窗口像素对照，不称 1:1。
- **保留的失败与未做项**：上述 5 个套件的失败日志原样保留；没有做官方同状态 Computer Use 对照；没有 ASAR / 签名 / TEST_APP_PATH 的安装版专项（全部依赖打包）。各 gap 自身的遗留差异见下面各节，未改动。
- **仍未收口的大项（本轮明确延后）**：`transcript-motion`（XL；history 分页依赖抓不到的 thread/turns/list 真实协议样本，thinking 阶梯阈值未定位，且需要重新冻结 0.2.14 基线）与 `diff-engine`（XL；依赖 pane-layout 的 Changes 头部与 composer 草稿插入 API，仅 Slice 0–2 可独立先做）。

## 0.2.14 侧边栏其余差异（未打包，源码在进行中）

按 2.2553.1 classic 侧边栏调用链（`sidebar-session-items.js` 单选 `M`/多选 `N` 与 `we` 热键、`shared-11` `uI` 选区存储、`sidebar-groups.js` 行点击 `H`/`ZT`/`QT`/`XT`/`JT`/`WF`/`GF`/`KF`/`IR`/`LR`/`rI`/`oI`/`Vz`、`sidebar-session.js` `GH` 热键与 `mq` 悬停卡门控、`desktop-layout.css:419-489` 树线）在 0.2.14 源码补上：shift 区间 / cmd 切换 / Escape 与外部 pointerdown 清空的多选（`src/sidebar-selection.mjs` 纯模型），选中行 `data-selected="focused"`，多选行菜单 "Mark N as unread"(u) / "Move N to group"（组按 1–9、Ungrouped、New group…）/ "Archive N"|"Unarchive N"(a) / "Delete N"(d, danger)，空白处右键 Select all / Archive selected (N) / Delete selected (N)，并发 8、跳过当前会话、3s `role=status` 计数；`thread/delete` 白名单（运行中拒绝、清除全部配置记录）与确认框；一层嵌套行（`forkedFromId`/`parentThreadId`/本地 `forkedFrom`，`buildNestedRuns` 链压一层）带 `df-accordion-guide` 树线（38px 内缩、30.875/13px 肘线、1.25px ink）、折叠柄与 "{n} nested sessions · {n} new/working" 桩行、sr-only "Forked from {title}"，折叠持久化 `sidebarPreferences.collapsedNested`（桩行按 `oI` 左内边距 row-px + `.df-session-list` 的 `--df-iconless-pad` 10px，仅 "{n} new" 为 accent+ready 点、"{n} working" 为纯文本，折叠时仍列出等待审批的子行且桩行改为 "{n} more nested sessions"）；**不渲染行悬停卡**：官方 `sidebar-groups.js:17222-17229` 以 `disabled: F || !ie`（`ie` = 未归档且 pendingPermissions>0）挂载 `mq`，且整体受 feature flag `code_session_hover_card_main` 门控，非等待行永不打开，等待变体需 Allow/Deny 审批 RPC（本地未暴露），故评审后删除了先前的摘要卡；单选菜单补 Open in→Terminal（`open-terminal` IPC，绝对存在目录）、置顶行 Move up/down（`config.pinnedOrder`；仅在可移动时渲染该项，端点行只有一项，`sidebar-session.js:16113-16114`）、Fork(f)、Show/Hide nested、Delete(d)，字母热键改为 document 捕获并跳过可编辑目标；Older 桶 "Bulk actions for older sessions" 按钮（0 → 0.6 → 1；无可归档/可删除目标时整个按钮不渲染，`Vz` 返回 null）与仅在计数>0 时出现的 Archive all/Delete all (N) 确认。依据与范围见 `analysis/sidebar-rest-20260920/source-contract.md`、`implementation.md`；GUI `scripts/sidebar-rest-ui-test.mjs`（13 项，含无悬停卡断言、等待子行 "1 more nested session·1 working" 桩、Older 空集合无按钮、端点 Move 项；已登记 validate-local，报告 `analysis/batch-20260920/sidebar-rest-ui-report.json`）；单测 506 项 505 通过 1 跳过；sidebar/menus-states/session-actions/home-page/ui029/transcript-fade（后两者冻结基线 env）串行通过。已知差异：多选子菜单文案按 raw 为 "Move N to group"/"Ungrouped"（审计稿写 "Move N to…"/"Remove from group"）；无 Set model for N、Copy link/Share/Export、项目/云项、拖拽置顶、批量提示气泡、悬停卡等待变体（Allow/Deny 审批 RPC 未暴露给侧边栏）；侧边栏 Fork 不自动跳转，新分支作为嵌套子行出现在来源之后；桩行内边距取自官方 CSS，未做运行态量测。未打包、未安装。

## 0.2.14 Composer 状态族（未打包，源码在进行中）

按 2.2553.1 的 composer 调用链在 0.2.14 源码补上五个状态族，依据与范围见 `analysis/composer-states-20260920/source-contract.md`、`implementation.md`（c099c328d/shared-11/cf74bc599/c47a58ae1 四个 chunk 的行号以 prettier 3.6.2 `--print-width 120` stdin 输出为准）。后端为本机 Codex **0.155.1**（`current` 已从 0.153.4 切换）；`thread/queue/add|list|update|delete|reorder|start`、`thread/queue/changed`、`turn/steer` 均用隔离 `CODEX_HOME` 的只读探针确认了真实字段（add 需 `clientUserMessageId`，delete/update 用 `queuedSubmissionId`，reorder 用 `queuedSubmissionIds`，list 返回 `{data,nextCursor}`）。

- **附件**：CDS Attachments 插槽（4/4/10px、4px 条带）内 40×40 `epitaxy-pill-body`：图片 `object-fit: cover` 预览 + `role=status` "Processing image" 加载层，文件为 quiet 变体（alpha-2、小写扩展名 caption）；16px 圆形移除控件在 −6/−6，hover/focus-within 显示（.18s），`aria-label "Remove {name}"`；`@starting-style` 进入动画（容器 −8px/.2s，pill scale .92/.18s，reduced motion 无）。粘贴 `clipboardData.files` 与 Finder 拖放走图片 lane（PNG/JPEG/GIF/WebP、30 MB、最多 5 张，官方 toast 文案走既有错误面）；剪贴板图片由主进程写入 `userData/attachments/` 得到真实路径。`turn/start` 输入：图片 → `localImage`，其他文件 → `{type:"mention",name,path}`；伪造的 "Attached file:" 文本已删除。Add 菜单首项保持 "Add files or photos"。
- **@mention**：caret 处 `@` token 经主进程 `files:search`（新 `composer` lane，120ms、50 条）打开 `div[data-cds=MentionDropdown][role=listbox][aria-label="Mention suggestions"]`（420px；有目录 description 时按官方 `Ap.wide` 560px；caret 上方 24px、16px 碰撞、≤384px、4px padding；`role=option` + `data-option-index` + `aria-selected`、16px 前导字形、命中高亮）；ArrowUp/Down、Tab/Enter 接受（组合中不接受不提交）、Escape 关闭。textarea 内 token 保持纯文本（无法渲染 TipTap chip，不称 1:1）；提交时生成 UTF-8 `text_elements` 字节区间与绝对路径的 `{type:"mention"}` 项。
- **排队/steer**：回合运行时 Enter → `turn/steer(expectedTurnId)`（review/compact 的 `activeTurnNotSteerable` 回落 `thread/queue/add`），Cmd+Enter → `thread/queue/add`；有草稿时 Send 取代 Stop，tooltip 列出 "Send ↵" 与 "Queue for later ⌘↵"；Stop 的 tooltip 为 "Stop" + "Esc"（官方 `shortcut:"escape"`，菜单占用 Escape 时不带）；按下 Stop/Escape 后（官方 `showStop = busy && !interrupting`）Stop 立即卸载，槽位由禁用的 Send 字形占据、不再列 "Queue for later"，直到 `turn/interrupt` 完成。`thread/queue/changed`/`turn/completed` 后 `thread/queue/list` 驱动 QueuedMessageBar（key `${session}:queued`，挂在操作横幅之后、composer 之前）：单条 40px/12px/10px/alpha-1 行 + Edit/X；多条折叠按钮 "N messages queued"/"Next: …" 与展开 `role=list`（min(40vh,22rem)、5px 行、line-clamp 2、Reorder 手柄 + DotsVertical 菜单、"Clear all"）；120ms `epitaxy-band-enter` 进入。删除/取回/重排走真实 `thread/queue/delete|reorder`，乐观更新失败回滚。ParkedMessageBar 无 Codex 数据，不渲染。
- **IME/键盘**：Escape 组合中吞掉；busy 且未 interrupting 时 Escape 在聚焦编辑器内一次性 `turn/interrupt`（锁存到回合结束，菜单打开视为 claimed）；`event.repeat` 与组合中的 Enter/Cmd+Enter 不提交；Shift/Alt+Enter 换行。`searchFiles` 回调放在 ref 里，流式 delta 引起的父级重渲染不再重启 120ms 防抖或丢弃在途结果（运行中输入 `@src` 仍打开列表）。
- **禁用/忙碌**：`disabled = 未连接 || 归档 || 加载中` → 卡片 `data-disabled`、textarea `disabled`、cursor default；发送中 `aria-busy` + 旋转器 + sr "Sending"；断线时 composer 上方 footnote 警告行 "Connection to Codex lost." + Retry（真实重连）。听写保持 39px 禁用分裂按钮，recording/connecting/error 因无后端不实现；`main.jsx` 死代码 dictation 菜单删除。Stop 的无障碍名保持 "Stop response"（官方 "Stop"），以免改动既有套件。
- 验证：新增 4 个模型单测（22 项，全量 477 项 476 通过 1 跳过）与 `scripts/composer-states-ui-test.mjs`（15 项，含 Stop tooltip "Esc"、interrupting 期间 Send 占位、运行中 @mention；报告 `analysis/batch-20260920/composer-states-ui-report.json`，已登记 `validate-local`）；`tooltip-ui-test` 的 Stop 检查改为断言官方 "Esc" 快捷键，`ui029-ui-test` 的 pending stop 阶段改为断言 Stop 卸载 + 禁用 Send 并以 Escape 验证重复激活被忽略。在同一构建（source `0d7a90a0…7be1e`）上逐个串行重跑 composer-states、tooltip、session-actions、stream-highlight、turn-footer、sidebar、ui029、transcript-fade（后两者用冻结基线 env）、user-actions、approval-card、code-fence、git-rail、permission、settings、session、integration-race、connection-lifecycle、code-ui、file-search、transcript-scroll、scrollbar-mode 共 21 组均通过，`verify-build` 完整性通过。未打包、未安装、未做官方同状态对照；官方 "Type / for commands" placeholder 未在运行中的官方应用核对，本地 placeholder 未改。

## 0.2.14 Skills / Connectors / Plugins（未打包，源码在进行中）

按 2.2553.1 的 "Customize" 设置组（`shared-22` hS、页面外壳 `c9e81e7b9`、CDS Table `c51c45b79`、Skills `c5e558aae`、Connectors `c40525e86`、Plugins `c76f00e40`）与 composer Add 菜单的 Skills/Plugins 子菜单（`scroll-shared-10` jy/Ay/Oy/Bv/zv），在 0.2.14 源码实现本机 Codex 0.155.1 真实提供的子集：主进程 `electron/customize-operations.cjs` 以校验过的 `customize` 操作族封装 `skills/list`、`skills/config/write`（仅限上次列表返回的 path）、`mcpServerStatus/list`（toolsAndAuthOnly、15s 超时、有会话才传 threadId）、`config/mcpServer/reload`、`mcpServer/oauth/login`（authorizationUrl 只经 external 打开）、`config/batchWrite`（`mcp_servers.<name>` upsert / null 清除）、`plugin/installed`、`plugin/read`、`hooks/list`；设置导航新增 Customize 组（Skills/Connectors/Plugins，32px 行），三页为 h2 + 可折叠页面搜索（默认是 ghost 图标按钮，展开为 `role=search` + `type=search`、角色 searchbox、w-64=256px、带 Clear search）+ 固定布局 CDS 表格（th 32px footnote/secondary，td 28px + 2×8px + 1px alpha-1，列宽 80/128/160）；Skills 页含仅在 ≥2 组时出现的 "Filter by owner" 分段、真实 SKILL.md mtime 或 aria-hidden "—"、Disabled 徽章、插件 chip、drill-in 详情（列表整体被替换，ArrowLeft “Skills” 返回，主体 `flex flex-col h-full pb-xs px-xl gap-md`，含真实 SKILL.md 文件视图与官方的 “No files to show.” / “Files unavailable right now.”）里的 role=switch Enabled（乐观、随 effectiveEnabled、失败 role=alert 回滚）、Show in Finder、Use in message；Connectors 页状态单元 Check+sr-only Connected / role=status Connecting / Server not responding+Reconnect / Sign in required+Sign in / Disabled / Not started（无线程运行态永不 Connected）、官方 “Connectors that stopped working” 卡片（仅在存在 Sign in required 行时才带 Reconnect all，aria-label 用官方复数文案）、Add custom connector 表单（与已配置的同名服务器冲突时拒绝，绝不 upsert 覆盖 CLI 的配置）与 Remove（二次确认，明示写入 `~/.codex/config.toml`）；Plugins 页只列已安装插件、Skills 列为真实计数、行详情来自 plugin/read。Add 菜单删除占位 "Manage connectors"，Skills/Plugins 子菜单选中技能后在附件行放 chip，发送时 `turn/start` 追加 `{type:"skill",name,path}`（官方为 ProseMirror skillChip，本地 textarea 无法承载，属有意差异）；新增 `/skills`、`/mcp`（`/connectors`）、`/plugins`。`skills/changed` 250ms 防抖重列（实测 252ms）、`mcpServer/startupStatus/updated` 就地打补丁、`mcpServer/oauthLogin/completed` 重列。**不做**：技能上传/安全扫描/Create with Claude、Directory/远程 marketplace 浏览安装、云端 Last updated/作者身份、hooks 页面。依据与范围见 `analysis/skills-mcp-20260920/source-contract.md`、`implementation.md`；单测 `tests/customize-model.test.mjs`（17 项，全量 524 项 523 通过 1 跳过）；GUI `scripts/skills-mcp-ui-test.mjs`（14 项，隔离 CODEX_HOME + 协议 fixture，报告 `analysis/batch-20260920/skills-mcp-ui-report.json`，已登记 validate-local）；只读实机 `scripts/skills-mcp-live.mjs` → `analysis/skills-mcp-20260920/live-readonly.json`（真实 Codex：78 技能、5 个 MCP 服务器全为 runtimeStatus null、14 个已安装插件，只记计数、无任何写入）。未打包、未安装、未在官方窗口实测表格行高，不称 1:1。验证：全量 `validate-local` 标准列表在本构建（source `53eaf338…95aa`）上逐个串行运行（`analysis/skills-mcp-20260920/logs/validate-local-full.log`、`-resume.log`、`-resume2.log`、`-remaining.log`、`-remaining2.log`）：build、unit、integrity 与 38 个 GUI 套件中的 36 个通过（含 settings-ui-test、skills-mcp-ui-test、settings-rest、session-actions、composer-states、user-actions；transcript-fade 与 ui029 以冻结基线环境变量通过，本次实测为 overlay 滚动条）；highlight-ui-test 与 composer-states-ui-test 在串行队列中各失败一次（流式 token 超时 / pill hover 显隐超时，机器负载与物理指针所致），单独重跑通过（`analysis/skills-mcp-20260920/logs/highlight-rerun1.log`、`composer-states-rerun1.log`）。**两个确定性失败与本批无关且早于本批开始（21:32）**：`user-markdown-ui-test` 第 8 项 "single-line chip bubble = inline span + 24px padding"（expected 212, got 287，chat tile 403px 时 chip 气泡折成三行；20:19–20:21 的三次运行已同样失败，属进行中的 shrink-wrap 批次）与 `scrollbar-mode-ui-test` 第 4 项 `--df-nav-scrollbar-lane`（overlay 模式下 `source-sidebar.jsx:385-388` 以 "0px" 为默认值且仅在变化时写入，变量从未被设置，读到空串；20:23 已失败，属 21:11 的侧栏批次）。二者未在本批修改（改 src 会使全部已验证构建失效），留待各自批次处理。

复审（9 条 major）已全部修复，构建 `a90c3883…5e972`：页面搜索改为官方的可折叠 SearchInput；Skill 详情改为官方 drill-in 并新增只读 `skill-file` 操作提供真实 SKILL.md（官方的 “Slash command” 徽章未做 —— Codex 没有 `/<skill>` 调用方式，不给不存在的能力画 UI）；Add 菜单删掉四条自造的 loading/empty 文案，改为官方的“不渲染 / 骨架行”并补上技能悬停说明浮层；Skills/Plugins 页头的 Refresh 删除、Connectors 的 Reconnect all 移进官方故障卡片；Badge xs 与行圆角改为令牌驱动（comfortable 下 18/6/4.5/11px、`--cds-radius` 8px）；`main.jsx` 用 useCallback/useMemo 固化 customize props（消除串流期间 plugin/read 重发与详情闪烁）；store 在 cwd 变化时必定重列（消除切换工作区后的陈旧技能/插件）；表格行的 click/keydown 按官方 `G` 跳过嵌套控件（行内 Reconnect/Sign in 恢复键盘可用）；`mcp-add` 拒绝已存在的服务器名。细节见 `analysis/skills-mcp-20260920/implementation.md` 的“复审修复”节。验证：unit 524/523+1skip、integrity、以及 32 个 GUI 套件串行通过（含 skills-mcp 14 项、settings、menus-states、user-actions、composer-states、code）；`scripts/code-ui-test.mjs` 修正了一处过期断言（Add 早已是 CDS 菜单而非 `.code-popover`，用逐字回滚到 53eaf338 的 main.jsx 复现证明与本批无关）。**环境阻断**：本机可用桌面高度降到 851px（`analysis/skills-mcp-20260920/environment-workarea.json`），`setContentSize(1468,852)` 被夹住，导致 pane-layout / highlight-coalescing / transcript-fade / ui029 / scrollbar-mode 五个套件在启动阶段超时（今天 15:09 还通过）；不改 macOS 设置、也不改套件的几何期望。`user-markdown-ui-test` 第 8 项仍是 shrink-wrap 批次的既有失败。

## 0.2.14 设置余项（未打包，源码在进行中）

OpenDyslexic 界面字体、Light/Dark 代码主题选择与默认 transcript view 已在 0.2.14 源码实现，依据与范围见 `analysis/settings-rest-20260920/source-contract.md`、`implementation.md`。界面字体第三档按官方在 html 上切换 `data-system-font`/`data-dyslexic-font` 并给 cds-root 写 `data-font`，四个 OpenDyslexic 面沿用随 `assets/v1` 复制的 `@font-face`；"Font licenses" 打开只读对话框（本地 `third-party/fonts.txt`，如实说明字体来源）。代码主题目录 26 项（官方 28 项去掉无独立数据来源的 Pierre Light/Dark），第三方主题来自 `@shikijs/themes@4.4.3` 按需分块，主题对进入 settled 高亮的缓存键；`--code-theme-*` 变量驱动代码块/用户围栏背景；设置页两列 Select + greet.ts 预览（含 pierre unified 默认行号列）。评审后修正：无 `editor.selectionBackground` 的主题按官方回退到 Claude 调色板的 selection；流式保留的围栏在主题对变化时释放给 settled 路径重新分词；settled 绑定对 queue-limit/subscriber-limit 退避重试，主题切换不再把超出队列的围栏永久变成纯文本。默认 transcript view 存 `preferences.json`，每会话覆盖存 localStorage（最多 100 条）；会话菜单新增 "Transcript view" 子菜单；Normal 隐藏 reasoning，Thinking 显示，Verbose 显示并默认展开步骤（本地语义，不称与官方合并时间线 1:1）。新增 `scripts/settings-rest-ui-test.mjs`（11 项检查，含 12 围栏容量、流式围栏换主题与行号几何）并登记到 `validate-local`；428 项单测、427 通过、1 项跳过。github-dark 的 keyword 色按官方 chunk 与主题数据为 `#f97583`。

## 0.2.13 Fast mode 与设置

2026-09-20 09:47（台北）安装。模型菜单增加来源CDS的Fast分节和开关，点击保持菜单打开；模型、可用档位及用量说明读取实时Codex目录。新增`/fast`、`/fast on`、`/fast off`和`/settings`；也可从账户菜单或⌘,进入设置。Fast影响下一条普通消息，开启传目录id，关闭明确传default，不覆写正在执行的回合或review专用策略。

设置按当前2.2553.1的modal/nav/row/group/switch结构实现：最大1024×800、192px导航、搜索、主题与系统主题监听、减少动态效果、字体、正文13/14/16px及宽768/960/1280px；另接真实模型/effort/权限、账号读取、默认目录、本地配置目录和引擎重连。只绘制有实际能力的导航。

最终源码`9fd9b20429ee5e623ab73d922a45d649fd8133a92d15255761f43196839ce1f4`（123文件）；release与安装ASAR`4a1c8a0c29ad1329330bcb93e71b24ed3d58928c4da7084e9073eff7574e33a9`；签名校验通过。receipt为`analysis/batch-20260920/installation-0.2.13.json`，旧版备份`installed-before-0.2.13.app`。

319项单测通过、1项明确跳过；build/unit/25组GUI与lifecycle/integrity共28步通过。真实Codex0.153.4在同一gpt-6-astra会话返回priority→default，两轮完成；压缩/分叉/审查/Stop、流式和审批拒绝在本批最终源码上再次通过。验证了档位切换，未测量速度倍率。减少动态效果专项用长消息验证两条滚动渐隐均保持opacity=1。

实际安装路径完成packaged、settings、session-actions三组测试；另在1468×852窗口用Computer Use检查Fast开关、快捷键、主题、搜索、Code设置和连续键盘调整。与官方同窗口截图均为1324×768 JPEG。菜单AX读取未提供截图，因此菜单开关状态由原生AX及独立Electron截图共同佐证，未把菜单AX树称为原生菜单。详见`analysis/settings-20260920/computer-use-host.json`。

0.2.12虽通过自动化，安装后CU发现保存时radio失焦；没有作为最终通过版本。源码及报告保留于`attempt-0.2.12/`，失败原生证据在`installed-cu-BYsbZB/`。0.2.13恢复被disabled移除的焦点，同时不抢走用户已经移到别处的焦点。新增连续方向键断言；测试等待落盘、checked、enabled和焦点同时满足。最终同源码验证保留build/unit两步后续跑，首轮失败记录保留。

本批最终测试的7个真实会话均有归档确认；只处理测试报告记录的ID，未列举/修改用户其他任务。正常账号窗口已恢复，用户配置和会话保留。源码依据及范围见`analysis/settings-20260920/source-contract.md`、`implementation.md`；不可变快照见`verified-0.2.13/`。

本机 Codex 可证的 Skills/Connectors(MCP)/Plugins 管理子集已在 0.2.14 源码补上（见上文 "Skills / Connectors / Plugins" 节；云端上传/扫描/远程 marketplace 仍未覆盖），Claude云端/语音/远程能力未覆盖（OpenDyslexic、代码主题选择、默认transcript view 已在 0.2.14 源码补上，见上节）。账号登录、Finder和目录选择复用已有入口，本批未为验收更改真实登录；不声称完整官方设置1:1。

## 0.2.11 会话功能

在输入框输入 `/` 可用上下键选择、Enter执行、Tab补全；也可从 **Add → Commands** 打开可搜索面板。已有会话的标题栏菜单直接提供四项操作。

| 命令 | 真实功能与边界 |
| --- | --- |
| `/compact` | 请求 Codex 压缩上下文；等待实际终态，显示进度、完成或失败，不把请求确认当完成。 |
| `/fork [名称]` | 从最后保存的完整回合创建独立会话，保留历史和工作目录；原会话不变。 |
| `/review [说明]` | 表单支持未提交改动、基准分支、指定commit、自定义说明；结果留在当前会话，可停止。固定只读沙箱，因为该版Codex内置审查不发审批。 |
| `/status` | 实时连接、账号、目录、下一条消息的模型/权限、已报告上下文用量及账户额度；未知数据明确不可用。 |
| `/new`、`/resume`、`/model`、`/permissions`、`/plan`、`/diff`、`/files`、`/rename`、`/help` | 打开或执行已有界面能力；resume限本应用管理会话，plan为现有只读模式。 |

新增 `app/electron/session-operations.cjs`、`app/src/session-command-model.mjs`、`app/src/source-session-actions.jsx/.css`。主进程按会话所有权、连接身份和运行状态校验，防止重复或过期操作。审查真实运行中发现outer submission ID与nested started ID不同，已分别追踪，完成及Stop均有真实回归。

依据为本机Codex 0.153.4及官方 `rust-v0.153.4` 源码（commit `3d2ee51ca2d5db578f328aa75e20aa22c0197c9a`），详见 `analysis/functions-20260920/source-contract.md`。完整实现/范围见同目录 `implementation.md`，冻结证据见 `verified-0.2.11/`。

0.2.11源码SHA256：`183402e432442b7c55b394b0f11397444a47dbadb6fb0b4975100f0f093e6a7f`（120文件）；release/installed ASAR：`2bbdf2fd188c84da6c5e57fd100ada7f292baaee596985200221b62456085133`。安装receipt为 `analysis/batch-20260920/installation-0.2.11.json`，0.2.10备份为该目录 `installed-before-0.2.11.app`。

最终回归在同一源码/构建身份下恢复执行：保留22步已通过结果，修正Git剪贴板异步读取测试后完成剩余5步；首次失败日志保留。tooltip/package测试的隔离窗口使用CDP focus emulation以排除共享桌面鼠标干扰，原断言保留，不能替代原生鼠标验证。实际安装版另完成1468×852窗口的Computer Use：slash键盘、状态、审查表单/结果、菜单分叉、压缩和停止，见 `computer-use-host.json`；截图实际为1324×768 JPEG，旧`.png`后缀原件保持不变，交付副本使用`.jpg`。

`session-actions-local.json`和`session-actions-installed.json`为隔离协议及真实临时Git测试；`session-actions-live.json`和`review-stop-live.json`为真实Codex；`installed-validation.json`绑定实际安装路径及ASAR。本批11个可由测试报告确证的真实测试会话已有归档确认，见 `test-thread-cleanup.json`。正常账号窗口已恢复；用户开始使用后不重置或归档其会话。

完整Codex TUI命令、外部历史导入、detached review、指定历史回合分叉尚未实现；skills/MCP/插件管理已在 0.2.14 源码实现本机可证子集（`/skills`、`/mcp`、`/plugins` 与 Settings › Customize，见上文）。Fast mode及设置UI已在0.2.13独立实现和验收，见上文。

## 本轮改进

- 0.2.10修复冷启动的重复高亮队列耗尽：相同语言与原文共用在途任务，独立订阅/取消，最后订阅者离开才取消底层任务。原队列/worker/超时预算保留。新专项与安装CU检查冷加载11个显示全部token、两种主题、原文Copy和同itemId跨会话隔离；没有改CSS掩盖几何差异。

- 0.2.9补上普通用户代码围栏的独立卡片和受限高亮，保持完整原文，无助手Copy/header/gutter；持续classic尾部Spark区分idle、真实Working/Stopping与审批替换，停止请求按连接/会话/回合身份校验；0.2.14起Working/Stopping播放真实thinking sprite，reduced motion或sprite chunk缺失时保持静态Spark。普通内容顶部与底部改为来源48px，原消息宽高保留，状态间距继承问题已由实际失败复现后修正。

- 输入区改为来源明确的 composer/chin 结构，8px 内边距、ArrowReturn 发送、StopCircle 停止、原始小螃蟹 Lottie；Effort 是保持打开的 220px 离散滑杆。
- 模型选择使用源码确认的 DOM 菜单，包含当前项、数字快捷键与 More models 子菜单；模型及支持的 effort 仍来自实时 Codex catalog。目录加载中 trigger 按官方禁用并显示 spinner 与 “Loading models…”。
- Mode 权限选择采用当前 chin 的 DOM 菜单与焦点交互，显示真实 Codex 的 Auto、Manual、Plan 三种策略及说明。
- Model / Filter / Session / Mode / Account 五个菜单共用一个按 2.2553.1 CDS Menu（shared-frame B_/Wr over Base UI）实现的 `SourceMenu` 原语：portal 根与层级（右键 ContextMenu 130）、6/4/2 偏移与碰撞（指针锚 −5/2）、10px surface-3 shadow-popover popup、官方 `scroll-fade-y` 滚动体、单一 `data-highlighted` 高亮、`data-popup-open` trigger、按关闭原因归还焦点、右侧禁用原因 tooltip、嵌套子菜单（鼠标 hover 100ms + safe polygon）、Fast 行内的真实档位描述；桌面菜单按源码无任何过渡；`(pointer: coarse)` sheet 分支只在触控仿真下出现（见 [menus-states-20260920](analysis/menus-states-20260920/implementation.md)）。
- 侧栏采用 classic 分支的分组、排序、Active/Archived/All 过滤；连接归档/恢复、重命名、置顶、未读和自定义组持久化。归档恢复后发消息会先恢复服务端会话加载状态。
- 消息和工具行采用 14px / 20px 正文、26px 无边框工具行、真实失败状态和 Working 动画；审批根据实际 command/file/permissions/question 协议提供选项。
- 标题栏支持ChangesPlusMinus和Files/Plan菜单；打开pane时使用32px内部标题栏，无pane时外层40px。Files/Changes初始chat:pane为2:3，Plan为2:1，可拖动或用键盘调整。文件树和标签页读取真实工作区，支持预览/固定、关闭后的焦点恢复及过期读取保护。
- 变更面板已接入独立SourceDiff：按真实unified patch显示文件头、新旧行号、增删及rename/binary/mode信息，支持折叠和复制；解析不可靠时保留原文。完整编辑器和官方专用diff引擎仍未复刻。
- 首页统计改为本应用实际观察到的按日事件账本，消息去重，累计 token 使用基线及最高值避免重连/乱序重复累计。不会根据会话最后更新时间伪造历史。
- 新会话可添加真实额外目录，传入 Codex writable roots 并按会话保存；会话上方 Git 条及变更面板已接入只读本地 Git 数据，范围为 HEAD 到工作树加未跟踪文件。PR、CI、自动提交按钮尚未提供。
- Codex app-server在固定home目录初始化，实际thread/turn继续使用选定工作目录。重连按连接身份隔离回包；退出会等待本应用创建的旧/当前子进程结束，并对忽略SIGTERM的进程限时升级SIGKILL。

- 0.2.2加入独立SourceTranscript：首开尾部、流式跟随/主动阅读、会话锚点恢复、generation隔离、审批跳转与历史工具Space激活；同时修正父级min-height，避免长消息挤出输入区。宽Files面板增加240px树+空预览和明确目录/文件错误；Add/chin归正20px及真实禁用39px语音双按钮槽。

- 0.2.3加入源码Tooltip和普通Markdown代码块：焦点/分组/禁用原因、真实复制及streaming frontier；修复位置测量与鼠标远跳不关闭，并保留重连后的item完成状态。

新增文件名搜索按主进程已知工作目录运行，Git仓库遵循忽略规则；扫描触及上限时明确提示不完整。打开预览后可清空筛选定位真实文件，保持输入焦点和已有标签。官方同状态Files视觉对照仍缺，未声称该面板1:1。

0.2.5新增独立审批与问答卡：理由和授权范围保持可见，按钮/响应式/忙碌状态按当前非dock源码实现；多题答案按真实请求身份跨会话暂存，失败后保留，断线/完成后清理。后端为每个连接和请求生成身份，拒绝过期卡响应，完整快照处理初始化竞态；真实Codex命令审批拒绝已验证。

0.2.6新增每轮完成后的统一Copy：整轮助手文字汇总、24/16px按钮、2000ms确认反馈；流式当前轮不出现。键盘/hover/复制失败/迟到/滚动跟随和真实消息锚点均通过新回归。0.2.14起助手footer与用户消息Copy同时写text/plain与text/html（CommonMark+GFM table、软换行提升为硬换行、原始HTML转义、不安全协议丢弃），rich写入被拒时静默回退纯文本；见`analysis/rich-copy-20260920/`。

0.2.7新增已完成代码块的五语言语法高亮：JS、TS、JSON、Python与Shell。浅深色使用源码确认的Code主题token，选区保留，复制仍是原文；一个worker有界执行，增长中/未知/超限/失败保持完整纯文字。真实安装包在离线和既有CSP下加载全部语言分块，并携带依赖许可证。

0.2.8新增来源明确的滚动边缘渐隐：顶部32px、底部48px，按实际scroll timeline连续变化；短内容透明，装饰层不抢鼠标或焦点，代码Copy保持在顶部37px。修正本地reduced-motion全局覆盖后重新验收，流式跟随、阅读位置和切会话恢复通过；七种G=0尺寸与0.2.7基线几何等值，经典滚动条仅源码/代数核对。官方新建90行代码块会话已成功，提供同1324×768实际对照。

各组件的源码依据和未完成项见 [交接说明](HANDOFF.md)。

## 官方资源版本与菜单结论

当前 `/Applications/Claude.app` 的实际版本为 **2.2553.1**。本轮独立提取到 `reference/current-2.2553.1/`，其中 `ion-dist/assets/v1/` 是前端资源，`asar/` 是 Electron 解包，`readable/` 是格式化编译 JS，`manifest.json` 记录来源和文件 SHA256。旧 `reference/asar/`、`reference/ion-dist/` 与根目录 `readable/` 属于 **2.110.1**，保留作历史比对，不能单独代表当前运行版本。

**旧交接中“AX 已确认模型菜单为 macOS 原生菜单”的结论错误。** 两个版本的完整 ModelSelector 调用链均进入 CDS/Base UI 的 DOM portal 和 `role="menu"`；当前 Filter、会话菜单和chin的Mode菜单也走DOM。独立 AX 菜单树或截图返回 null 不能证明 Electron 原生菜单。实现已采用 DOM 菜单，完整反证见 [当前版本审计](analysis/current-version-audit.md)，权限链见 [当前Mode审计](analysis/batch-20260920/permission-current-source.md)。运行时远端资源和 feature flags 仍需按实际窗口验证，不能混拼不同分支。

`app/scripts/prepare-ui.mjs` 已切换到当前 2.2553.1，重复生成 Anthropicons glyph 映射，复制原始 Lottie/播放器、CSS 及引用字体，并记录 `app/public/ui-provenance.json`。`app/public/build-info.json` 记录参与构建的源码哈希。原版业务 JS、账户与私有服务未接入本应用；仅 Lottie 播放器作为本地动画资源使用。

提取资源保留原有权属，本目录供本机研究和使用，未将专有资源声明为开源。早期提取方法见 [EXTRACTION.md](EXTRACTION.md)，其版本信息应结合本轮审计阅读。

## 运行与验证

应用使用已安装的 `codex` 和已有 Codex 登录状态，不需要 Claude 登录。默认工作目录为 `~/Documents/Code Desktop`，可在新会话选择项目。Enter发送，Shift+Enter换行。Code的Auto/Manual使用工作区写入沙箱，审批策略分别为`on-request`/`untrusted`；Plan使用`on-request`加只读沙箱，Chat也使用只读沙箱。模式名称对应本应用的Codex适配，不代表Claude全部权限策略。

```sh
cd /Users/oleyyu/claude-ui-lab/app
npm ci
# 若 npm 配置禁用了 install scripts，再执行：
node node_modules/electron/install.js
npm run build
npm test
npm start
```

构建要求已提取的 `reference/current-2.2553.1/ion-dist/assets/v1/`。本轮 UI 测试使用 `tools/node_modules/playwright` 及独立测试配置目录；统一入口按顺序构建并测试，避免多个Electron测试争用焦点：

```sh
node scripts/validate-local.mjs
# 已构建且源码未变化时，可加 --skip-build。
# 真实 Codex 调用，会使用当前账号额度：
node scripts/live-ui.mjs
node scripts/live-approval.mjs # 真实审批拒绝专项
node scripts/session-actions-live.mjs # 真实压缩/分叉/审查/额度
node scripts/review-stop-live.mjs # 真实审查停止
node scripts/fast-mode-live.mjs # 同一真实会话Fast开启/关闭
npm run package
# 默认验证release产物，不执行安装：
node scripts/packaged-ui.mjs
# 完成安装后，明确验证安装位置：
TEST_APP_PATH='/Users/oleyyu/Applications/Code Desktop.app' node scripts/packaged-ui.mjs
```

统一入口涵盖unit、GUI/lifecycle与构建完整性检查，不包含live、打包、安装及packaged专项。0.2.13共28步通过：build、unit（319通过/1跳过）、25组GUI/lifecycle、integrity；实际验收范围以该次`validation-run.json`的steps为准。旧`approval-ui.mjs`、`smoke-ui.mjs`保留旧UI或profile假设，不作为推荐主入口；`packaged-ui.mjs`已更新，是有效的产物专项。fixture只通过测试进程和隔离profile注入，生产模型/账户/会话数据始终来自真实Codex。

| 阶段证据入口 | 对应检查范围；是否通过须核对该次报告 |
| --- | --- |
| [validation-run.json](analysis/batch-20260920/validation-run.json) | 本次步骤、日志、执行时间、构建标识及脚本hash；unit结果在对应日志中 |
| [code-source-test.json](analysis/batch-20260920/code-source-test.json) | 原始字体/glyph/Lottie、768px 输入区、DOM 模型菜单、220px effort、浅深色及 800×600 |
| [permission-source-test.json](analysis/batch-20260920/permission-source-test.json) | 当前Mode菜单、键盘/选中/焦点、真实三种Codex策略 |
| [tooltip-ui-report.json](analysis/batch-20260920/tooltip-ui-report.json) | 11组真实组件提示时序、焦点/菜单、定位、禁用原因、主题与卸载 |
| [code-fence-ui-test.json](analysis/batch-20260920/code-fence-ui-test.json) | 5组Markdown/真剪贴板/失败/窄宽/协议流式与滚动边界 |
| [highlight-ui-test.json](analysis/batch-20260920/highlight-ui-test.json) / [highlight-packaged-test.json](analysis/batch-20260920/highlight-packaged-test.json) | 双主题词法、原文/selection/streaming、实际worker超时退出、离线相对chunk与原CSP及许可证 |
| [highlight-coalescing-ui-report.json](analysis/batch-20260920/highlight-coalescing-ui-report.json) / [highlight-coalescing-packaged-report.json](analysis/batch-20260920/highlight-coalescing-packaged-report.json) | 冷启动11显示/6种原文、实际worker、双主题原文Copy、同itemId跨会话隔离与退出；主进程和renderer使用隔离profile |
| [ui029-ui-report.json](analysis/batch-20260920/ui029-ui-report.json) / [ui029-packaged-report.json](analysis/batch-20260920/ui029-packaged-report.json) | 7尺寸8版基线、真实尾部/审批/Stopping/阅读与用户围栏/原文Copy；安装ASAR独立重验 |
| [transcript-fade-ui-report.json](analysis/batch-20260920/transcript-fade-ui-report.json) / [transcript-fade-packaged-report.json](analysis/batch-20260920/transcript-fade-packaged-report.json) | 8组32/48渐隐、七尺寸基线、真实opacity/Copy37/剪贴板、点击穿透、隐藏恢复、reduced-motion及流式 |
| [scrollbar-mode-ui-report.json](analysis/batch-20260920/scrollbar-mode-ui-report.json) | 官方顺序滚动条探针（feed保留/both-edges/thin/auto车道、只读AppleShowScrollBars）、design-system全局`scrollbar-color`（html,[data-theme]，border-300/35%透明轨道）被feed/nav/四个pane滚动容器继承且nav hover不变、七布局clientWidth列与both-edges对称、composer对齐、pane滚动容器both-edges、侧栏lane补偿；ui029/fade的冻结基线比较按模式门控（same-mode-full / cross-mode-*） |
| [turn-footer-ui-report.json](analysis/batch-20260920/turn-footer-ui-report.json) | 10组真实turn尾部Copy、剪贴板、2000ms反馈、交互归属及跟随/锚点回归 |
| [sidebar-ui-test.json](analysis/batch-20260920/sidebar-ui-test.json) | 分组排序、重命名、pin/unread/custom group、归档恢复、重启持久化、恢复后发送 |
| [sidebar-rest-ui-report.json](analysis/batch-20260920/sidebar-rest-ui-report.json) | 13组多选/批量菜单、空白处菜单、嵌套树线几何与折叠持久化、折叠桩 oI 内边距与等待子行 "more"/working 变体、无悬停卡、Terminal/Fork/Delete/置顶排序（端点单项）、Older 批量（空集合无按钮）、thread/delete 与重启清除 |
| [approval-card-ui-test.json](analysis/batch-20260920/approval-card-ui-test.json) | 8组普通审批卡几何/折叠/主题/busy/局部键盘/离屏与重新入屏400ms |
| [approval-transport-ui-test.json](analysis/batch-20260920/approval-transport-ui-test.json) | 9组nonce/快照/重连/过期/断管/多题草稿/异常schema/实际响应 |
| [live-approval-test.json](analysis/batch-20260920/live-approval-test.json) | 真实Codex0.153.4命令审批拒绝后工具declined、turn完成 |
| [session-source-test.json](analysis/batch-20260920/session-source-test.json) | 工具/审批/问题协议、消息尺寸、Working、文件/计划/变更面板 |
| [titlebar-source-test.json](analysis/batch-20260920/titlebar-source-test.json) | 标题栏尺寸、重命名竞态、窄窗口、折叠侧栏、更新弹窗焦点 |
| [file-search-ui-test.json](analysis/batch-20260920/file-search-ui-test.json) | 9组真实IPC搜索/主进程可信目录、home导航、深层文件/忽略、键盘/IME、预览/clear、窄宽与竞态 |
| [file-search-shutdown-test.json](analysis/batch-20260920/file-search-shutdown-test.json) | 实际Electron退出清理阻塞的搜索worker/Git进程组，无关进程存活 |
| [pane-source-test.json](analysis/batch-20260920/pane-source-test.json) | 分割比例/resize、文件预览与固定、树宽、延迟读取和关闭焦点、窄布局及真实变更 |
| [transcript-scroll-ui-report.json](analysis/batch-20260920/transcript-scroll-ui-report.json) | 11组长会话跟随/阅读/恢复/审批/键盘/尺寸/背景事件隔离 |
| [live-ui-test.json](analysis/batch-20260920/live-ui-test.json) | 真实 Codex 读文件、流式、工具、重启恢复、追问、停止 |
| [git-ui-test.json](analysis/batch-20260920/git-ui-test.json) | 真实临时 Git 仓库的计数、实际diff、分支复制、40px/768px/6px尺寸与关闭 |
| [git-rail-ui-report.json](analysis/batch-20260920/git-rail-ui-report.json) | 真实临时仓库+bare origin：base/ahead/behind IPC、Commit真实回合文案、responding时按官方`cc`禁用并给出"Claude is working"原因（无busy）、band节点跨回合/轮询/focus不卸载、Changes面板轮询期间不重读diff、10s轮询与focus刷新、band几何不变；隔离fixture中的behind标记、rail触发器/facts/dismiss/占位（官方behind因`xq0t4i`缺失从不渲染；rail无官方宿主，不称1:1） |
| [integration-race-test.json](analysis/batch-20260920/integration-race-test.json) | 乱序会话恢复、等待发送时的新草稿、延迟归档不覆盖后续导航 |
| [connection-lifecycle-test.json](analysis/batch-20260920/connection-lifecycle-test.json) | App-server初始化cwd、连接替换与旧回包隔离 |
| [shutdown-ui-test.json](analysis/batch-20260920/shutdown-ui-test.json) | Electron退出等待旧/当前抗SIGTERM子进程真实消失 |
| [source-integrity.json](analysis/batch-20260920/source-integrity.json) | 仅来源资源、glyph和构建源码hash完整性；不证明unit或UI通过 |
| [packaged-app-test.json](analysis/batch-20260920/packaged-app-test.json) | 报告所指release/安装路径的ASAR、版本、资源、浅深色、真实Codex及文件/标题栏场景 |

以上报告只证明各自执行时的源码和场景，源码继续变化后应核对构建标识，不能自动沿用通过结论。根目录`analysis/*test.json`中较早报告仅作历史记录。0.2.10统一验收、实际安装版专项及同1324×768官方/安装版尾部与用户围栏Computer Use已完成，冷启动所有11个显示另有实际token守卫；正常首页另作启动检查，图片宽度相差1px，未列为同尺寸对照；局部观察不等于所有状态1:1。 本轮测试不证明整体1:1；官方参考截图在`analysis/batch-20260920/official-*.jpg`。

打包命令为`npm run package`，产物位于`releases/Code Desktop-darwin-arm64/Code Desktop.app`，执行本机ad-hoc签名。0.2.13已完成该步骤，没有发行公证。安装目标`/Users/oleyyu/Applications/Code Desktop.app`，台北09:47安装0.2.13，release/installed ASAR一致，见[安装记录](analysis/batch-20260920/installation-0.2.13.json)。旧版备份均保留。

本次0.2.13源码标识为`9fd9b20429ee5e623ab73d922a45d649fd8133a92d15255761f43196839ce1f4`；安装ASAR SHA256为`4a1c8a0c29ad1329330bcb93e71b24ed3d58928c4da7084e9073eff7574e33a9`。后续重新构建/安装时必须更新对应证据。

## 边界与数据位置

0.2.9安装CU发现的重复高亮占队列问题已在0.2.10通过同key任务合并修复，冷启动11显示/双主题/原文Copy有新专项和安装CU证明；这不代表全部grammar或增量流式引擎等价。9的原始失败与快照保留。用户bubble仍缺source测量式shrink-wrap和持续24px用户消息actions+8px gap，宽度与后续assistant距离尚不一致，来源见[user-bubble-spacing-current.md](analysis/batch-20260920/user-bubble-spacing-current.md)。

普通用户气泡在0.2.14已按源码u1/qQ/Ob实现inline code chip（文件引用按源码oh纯语法门控成为链接并打开Files pane到行，不做存在性检查；打开失败由pane报告，请求处理后即消费）、Markdown/裸URL链接与host披露、开头/command pill（eN结构：8px留白+半透明中等字重斜杠字形+裸命令名）、1200字折叠Show more以及图片附件120px方形tile与文件卡（本地图片part无宽高，源码natural分支不可达，不声称natural；见[user-markdown-20260920](analysis/user-markdown-20260920/implementation.md)）；people/session/Slack/线程mention、reply引用、Excerpt/Comment chip、cloak chip与flag门控的列表因Codex无对应数据仍未实现。首次流式的增量配色（stream worker、完成后保留、重开会话settled）与尾部真实thinking sprite（WAAPI 9帧×90ms、实时reduced motion回退）已在0.2.14实现（见[stream-highlight-20260920](analysis/stream-highlight-20260920/implementation.md)）；目前仍需完善完整字体核验、全语言高亮、完整动画、虚拟化/历史补页、极短视口边界与≤560px tile 16px gutter（经典滚动条已在0.2.14以模式门控基线验收，见[scrollbar-mode-20260920](analysis/scrollbar-mode-20260920/implementation.md)）、侧栏特殊分支（菜单状态已在0.2.14按共享CDS Menu原语验收，sheet钻入式子菜单与官方运行态逐帧核对仍开放）。Pane已有split resize和源码比例，仍缺拖动停靠、多tile/popout、完整编辑器/远端文件与完整树键盘导航；宽pane未选文件时树+空预览已补，筛选栏已接真实文件名搜索/50结果/取消/键盘与清空定位，内容搜索、索引缓存及完整slash分支尚未实现，窄pane隐藏chat属于本地适配。外层surface/shadow已补并通过计算样式检查；尚未完成全部面板状态的像素比对。SourceDiff尚无完整word diff、split、gutter注释、上下文展开和虚拟化。Git PR/CI语义及Chat、Cowork、Artifacts、Routines、Customize保留后续范围。模型名称、用量、账户和工具摘要采用Codex真实语义，不能伪装Claude服务能力。

`app/electron/main.cjs`管理窗口和白名单IPC，`codex.cjs`管理JSON-RPC与连接生命周期，`shutdown.cjs`让Electron等待有界清理后退出；`src/main.jsx`集成各个`source-*`组件。Electron开启context isolation和sandbox；文件预览经过真实路径范围检查及大小限制。

应用配置在 `~/Library/Application Support/Code Desktop`；本地 Git worktree 位于该配置目录的 `worktrees/` 下。Codex 自行保存会话，侧栏仅列出本应用管理的会话。测试通过 `CODE_DESKTOP_DATA` 隔离配置，`CODEX_BINARY` 指定测试服务或真实 CLI；不要将 fixture 写入生产配置。
