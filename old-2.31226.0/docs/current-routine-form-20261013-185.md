# 定时任务表单与日历同步 — 0.2.185

基准为当前安装的 Claude Desktop **2.31226.0**。打包前重新校验安装 archive 与拆包 manifest 的 SHA-256，一致。

## 当前来源

- `c97b955f1-BIk31E_b.js` 的 `ga` 创建/编辑表单，以及本地 schedule、权限、模型、指令区域。
- `cff2bf6cb-BcVMRZW0.js` 的当前分段日期输入与日历，保留日期运算、键盘、locale 字典赋值及 focus/transition 初始化。
- 当前 `shared-frame-DVFSKIcx.js` 的 Field、Label、TextInput、TextArea 等组件；宿主 provider 负责原生字段的标签、说明、错误和禁用状态。
- 保留原版 `max-height:680px` 且 `min-width:900px` 六列布局；高窗口和窄窗口使用一列。

提取器现在输出 62 个可达模块，`provenance.json` 记录原声明、初始化表达式偏移、源/输出哈希和宿主边界。
日历初始化审计保存在 `analysis/current-routine-form-20261013/calendar-initializers.json`。

当前 CSS 通过 `data-chat-source-version="2.31226.0"` 显式传入表单 portal 与它创建的菜单、选择器、popover 和 tooltip。
未标记的旧版 portal 保持原有样式；已有字段识别同时兼容两个版本。

## 适配修正

- 官方权限正规化只接受自动执行相关模式；本地模式在保存边界显式映射，解决 Manual 保存成 Auto 的回退。
- 名称预览恢复原始 slug 函数，避免固定显示 `scheduled-task`。
- 提示恢复 ICU 富文本格式化，避免显示 `<link>` 标签；帮助链接连接本地 external 打开接口。
- 保留原版受控表单关闭和未保存确认；日期确认、焦点恢复及原始按键处理连接已有宿主弹层。

只启用当前源码的本地/classic 表单分支；账户依赖的 unified/cloud/code-onboarding 分支未启用。
源组件接入并不等于这些云端服务已实现。

## 验证与发布

构建、源哈希验证和 UI 打包通过。签名包为
`releases/OpenClaude Desktop-darwin-arm64/OpenClaude Desktop.app` **0.2.185**。
571 个前端文件与构建一致，164 个后端文件与上一发布完全一致；后端仍为 0.2.181。
旧包备份在本批 evidence 目录。

验证记录在 `analysis/current-routine-form-20261013/`，详细结果在对应 `*-result.json` 与 `*-suite-result.json`。
运行测试使用独立 profile 和 Codex fixture runner，不证明真实 Cowork VM/API 问题已解决。

一次性任务回归测试现在在 fixture runner 启动后设置触发时间，避免将慢启动时正确跳过逾期任务误判为执行失败。
全部 Chat/Cowork 的迁移仍未完成。
