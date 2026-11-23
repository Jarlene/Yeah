# Yeah 插件机制迁移 · 仓库基线与代码落点复核（TASK-001）

- 复核时间：2026-11-23（Asia/Shanghai）
- 复核方式：只读。`git ls-tree`、`git show`、本地文件读取与 GitHub 只读 API；未执行编译、未安装依赖、未修改被测仓库。
- 复核结论：**静态基线一致，可以进入 TASK-004 许可证门禁与 TASK-002 脚手架**；因本地没有 pi-rust Git 检出，pi-rust 一侧标记 `evidence-limited`，详细文件级差异以 GitHub 只读 compare API 为准。
- 门禁脚本：`scripts/ci/baseline-review-check.mjs`（离线、fail-closed）。

## 快照

| 项 | 实际值 | 说明 |
| --- | --- | --- |
| Yeah 快照 | `b8381157d85b83b86f3c71d8dabaa892fdfc4db1` | `Jarlene/Yeah` 的 `main`，本次复核对齐的基线 |
| Yeah 仓库属性 | 公开，Apache-2.0，默认分支 `main` | GitHub 只读 API `repos/Jarlene/Yeah` |
| Yeah 树规模 | 5133 条目 / 4516 blob / 617 tree | `git ls-tree -r` 全量枚举，未截断 |
| Yeah `SOURCE_REV` | `559751fdcec02d413e4c57c8832ab275e4f44980` | 仓库根 `SOURCE_REV` 文件 |
| Rust 工具链 | `1.94.0`，组件 `rustfmt`+`clippy`，目标 `x86_64-unknown-linux-gnu`、`aarch64-unknown-linux-gnu` | `rust-toolchain.toml` |
| 工作区成员数 | 107 | 根 `Cargo.toml` 的 `[workspace] members` |
| pi-rust 设计快照 | `61c833cd40e4fb818d715524e624546c8ee20c9d` | 方案设计引用的迁移基线，**本次迁移的唯一参考版本** |
| pi-rust 上游 `main` | `10a608e39081437afcf8d6249a316859d1e020a3` | GitHub 只读 API `repos/bigfish1913/pi-rust` |
| pi-rust 本地检出 | 无 | `repos/pi-rust` 不存在；工作目录只有只读文件快照，不含 `.git`，无法测得本地 HEAD |
| pi-rust 许可证 | MIT | 插件 SDK `Cargo.toml` / 仓库 `LICENSE` |

## 落点清单

以下为 Yeah 侧已存在的插件相关落点，行号为 0，数值取自 `git ls-tree -l b838115`（blob 字节数 / blob SHA-1）。

| 落点 | 类型 | 实际值 | 期望值 | 影响任务 | 停止条件 |
| --- | --- | --- | --- | --- | --- |
| `crates/codegen/xai-grok-agent/src/plugins/mod.rs` | 声明入口 | 906 B / `f86e6315…` | 保留声明式入口，新增原生后端时不得改写现有导出 | TASK-002, TASK-005 | 现有 `pub use` 被删除或重命名即停止 |
| `crates/codegen/xai-grok-agent/src/plugins/manifest.rs` | manifest 解析 | 28116 B / `75e45997…`；`PluginManifest` 14 个字段，无 `runtime`/`capabilities`/`platforms` | 追加 runtime 与 capabilities DTO，未知字段容忍 | TASK-005 | 声明式 manifest 解析结果发生变化即停止 |
| `crates/codegen/xai-grok-agent/src/plugins/discovery.rs` | 发现 | 68489 B / `96b8caae…` | 发现流程不因未知 runtime fail-closed 而整体失败 | TASK-005, TASK-006 | 单个坏 manifest 阻断其它插件即停止 |
| `crates/codegen/xai-grok-agent/src/plugins/git_install.rs` | 安装 | 55449 B / `43ed0734…` | 原生插件走独立安装路径，不复用 git 安装副作用 | TASK-041 | 复用导致既有安装记录格式变更即停止 |
| `crates/codegen/xai-grok-agent/src/plugins/install_registry.rs` | 安装记录 | 24824 B / `81da4003…` | 原生插件记录独立于现有 `InstallRegistry` | TASK-041, TASK-042 | 现有注册表 schema 被就地修改即停止 |
| `crates/codegen/xai-grok-agent/src/plugins/local_refresh.rs` | 本地刷新 | 32127 B / `324db551…` | 刷新不得触发原生后端重载 | TASK-039 | 刷新路径调用未实现的 reload 即停止 |
| `crates/codegen/xai-grok-agent/src/plugins/marketplace.rs` | marketplace 适配 | 17789 B / `c129e613…` | 保留现有 marketplace 语义 | TASK-041 | 现有市场索引解析变更即停止 |
| `crates/codegen/xai-grok-agent/src/plugins/registry.rs` | 注册表 | 47278 B / `31112af7…` | 原生插件注册与声明式注册共存 | TASK-026 | 注册表 API 破坏性改动即停止 |
| `crates/codegen/xai-grok-agent/src/plugins/trust.rs` | 信任 | 11993 B / `64fbd84a…` | 原生信任独立存储（`native-trust.json`） | TASK-010, TASK-044 | 复用 `TrustStore` 覆盖用户既有授权即停止 |
| `crates/codegen/xai-grok-agent/src/plugins/hooks_adapter.rs` | hooks 适配 | 27192 B / `7b09a196…` | 原生事件不进入 hooks 适配器 | TASK-031 | 事件重复投递即停止 |
| `crates/codegen/xai-grok-plugin-marketplace/src/lib.rs` | crate 声明入口 | 4063 B / `2cfcd406…`；已导出 catalog/config/error/git/index/install_resolve/installer/matcher/scanner/types | 新增 install/staging/current/uninstall/records 模块时不破坏现有导出 | TASK-012, TASK-041, TASK-042, TASK-043 | 现有导出被移除即停止 |
| `crates/codegen/xai-grok-plugin-marketplace/src/installer.rs` | 安装实现 | 60851 B / `5888e59c…` | 与 TASK-041 新增 `install.rs` 明确分工，禁止双实现 | TASK-041 | 出现第二套安装入口即停止 |
| `crates/codegen/xai-grok-shell/src/plugin/mod.rs` | CLI 插件命令 | 90302 B / `60d0d7fb…`；已含安装/卸载/更新命令族 | 新增原生插件子命令复用现有命令框架 | TASK-041, TASK-045 | 现有命令行为变化即停止 |
| `crates/codegen/xai-grok-shell/src/lib.rs` | crate 声明入口 | 1523 B / `e3539fd2…` | 新增 `plugin_status` 时保持现有模块声明 | TASK-011 | 现有模块声明被改写即停止 |
| `crates/codegen/xai-grok-workspace-types/src/types/plugins.rs` | 工作区 DTO | 1539 B / `1bc7c260…` | 原生插件状态不并入现有 DTO | TASK-011 | 现有 DTO 序列化变化即停止 |
| `crates/codegen/xai-grok-telemetry/src/events/plugin.rs` | 遥测事件 | 1767 B / `38126f1d…` | 新增原生事件需单独命名空间 | TASK-030, TASK-044 | 现有事件名复用即停止 |
| `crates/common/xai-tool-runtime/src/lib.rs` | 工具运行时入口 | 2074 B / `7b931245…`；导出 `Tool`、`ToolDispatch`、`ToolCallContext`、`ToolSearchIndex` 等 | 原生工具经适配器接入，不改 `Tool` trait | TASK-025 | `Tool` trait 破坏性变更即停止 |
| `crates/common/xai-tool-runtime/src/tool.rs` | 工具契约 | 17965 B / `9212ea83…`；`pub trait Tool` + `ToolStream`/`ToolProgress`/`ContentBlock` | 适配器把 JSON-RPC 结果映射到既有流式契约 | TASK-025, TASK-028 | 映射需要改 `ToolStreamItem` 即停止 |

## 偏差清单

| 项 | 实际值 | 期望值 | 影响任务 | 停止条件 |
| --- | --- | --- | --- | --- |
| 原生插件 crate 目录 | 不存在 `crates/plugin/` | 6 个 crate：native-api / native-runtime / native-sidecar / sdk / testkit / pi-compat | TASK-002 | 目录落点与设计不一致即停止 |
| A/B 开关 | 不存在 `xai-grok-config/src/plugin_features.rs`，`xai-grok-config` 未声明该模块 | 新增该模块并在 `lib.rs` 声明，默认关闭原生后端 | TASK-002 | 默认开启原生路径即停止 |
| 脚本目录 | 不存在 `scripts/` | `scripts/ci/baseline-review-check.mjs`、`license-check.sh`、`workspace-skeleton-check.mjs` | TASK-001, TASK-002, TASK-004 | 脚本需要联网才能判定即停止 |
| 文档目录 | 不存在 `docs/` | `docs/planning`、`docs/legal`、`docs/contracts`、`docs/evidence` | TASK-001, TASK-003, TASK-004 | 证据写到 writeScope 之外且未在任务中声明即停止 |
| 许可证声明 | 只有 `THIRD-PARTY-NOTICES`（763905 B），不存在 `NOTICE` | 根 `NOTICE`，含 pi-rust MIT attribution 与来源说明 | TASK-004, TASK-054 | 未完成许可证结论即复制 pi-rust 代码 |
| 依赖许可证策略 | 不存在 `deny.toml` | `deny.toml` 定义 allow-list 与禁止许可证 | TASK-004 | allow-list 含 GPL/AGPL/SSPL/BUSL 即停止 |
| 许可证门禁覆盖面 | `TASK-004` 是 DAG 根，但只有 `TASK-054` 依赖它 | 任何复制 pi-rust 代码的任务都必须被 `TASK-004` 门禁 | TASK-004, TASK-054 | 复制类任务绕开门禁即停止 |
| Shell 安装实现重叠 | `xai-grok-shell/src/plugin/mod.rs` 已含安装/卸载/更新命令；`installer.rs` 60851 B 已含安装编排 | TASK-041 新增 `install.rs`/`staging.rs` 前必须给出分工结论 | TASK-041 | 出现两套并行安装实现即停止 |
| marketplace crate 声明归属 | `xai-grok-plugin-marketplace/src/lib.rs` 未声明 `current_schema`/`install`/`staging`/`current`/`uninstall`/`records` | 各任务新增模块前必须确定父文件声明归属 | TASK-012, TASK-041, TASK-042, TASK-043 | 新增模块无父声明即停止 |
| 子模块父声明缺口 | 12 处新增 Rust 模块缺少所属父文件声明（config `lib.rs`、shell `lib.rs`、marketplace `lib.rs`、hooks `lib.rs`、shell `plugin/mod.rs`） | 由 TASK-002 统一处理 config `lib.rs`，其余在所属批次锁定归属 | TASK-002, TASK-031, TASK-041, TASK-042, TASK-043, TASK-045 | 父文件归属未定即开始写子模块 |
| Yeax 仓使用 | 65 个任务全部 `repository = repos/Yeah`，无一引用 Yeax | 交付面只在 Yeah；Yeax 不在本次迁移范围 | TASK-001（全量） | 出现 Yeax 改动即说明任务包漂移 |
| DoR 证据路径 | 65 个任务的 `docs/evidence/TASK-XXX/verify.md` 均在 writeScope 之外 | 由 runner 统一回写证据，或上游把 `docs/evidence/**` 纳入 writeScope | 全部任务 | 证据无处落盘即停止 |

## 类型与函数偏差

pi-rust 侧符号取自设计快照 `61c833cd` 的 `crates/rpi-plugin-sdk`；Yeah 侧取自 `b8381157` 的实际源码。

| 符号 | 实际值（Yeah） | 期望值（迁移目标） | 影响任务 |
| --- | --- | --- | --- |
| `PluginManifest` | 14 个字段：`name`/`version`/`description`/`author`/`homepage`/`repository`/`license`/`keywords`/`skills`/`commands`/`agents`/`hooks`/`mcp_servers`/`lsp_servers`；无 `runtime`、`capabilities`、`platforms` | 在保留上述字段的前提下追加 `runtime`、`capabilities`、逐平台资产表，未知字段容忍 | TASK-005, TASK-006 |
| 注册符号 `rpi_plugin_register` | Yeah 无动态注册符号；插件以目录 + manifest 静态发现 | 兼容宿主 `dlopen`/`dlsym("rpi_plugin_register")`，B 分支用 `initialize` 握手 | TASK-055, TASK-056 |
| `RPI_PLUGIN_ABI_VERSION_UNIFIED` | 不存在；Yeah 无 ABI 版本常量 | A 分支固定 `u32 = 4` 并做版本协商；B 分支用 `yeah-plugin/1.0` | TASK-015, TASK-056 |
| `PluginApi.struct_size` | Yeah 无版本化宿主结构体 | 兼容宿主按 `struct_size` 判断槽位可用性，不得读越界字段 | TASK-056 |
| 工具执行模型 | `xai_tool_runtime::Tool`：async，返回 `ToolStream<T>`，含 `ToolProgress`/`ContentBlock` | 兼容宿主把 `execute_fn`/`poll_fn`/`cancel_fn`/`destroy_fn` 回调翻译为同一 `ToolStream` 语义 | TASK-025, TASK-028, TASK-057 |
| `StableToolSchema` | 无对应类型；Yeah 工具以 `Tool` trait + 结构化参数描述 | A 分支把 `{name, description, parameters(JSON 字符串)}` 转为 Yeah 工具描述；解析失败即拒绝该工具 | TASK-025 |
| `HOST_CONTEXT_KEY = "__rpi"` | 无；Yeah 直接传 `ToolCallContext` | 兼容宿主注入 `__rpi` 上下文键，模型不可见，不落盘、不进日志 | TASK-025, TASK-027 |
| `EVENT_TAG_COUNT = 38` | Yeah 现有 telemetry 插件事件为单一事件文件，无 38 项事件目录 | 只注册设计裁剪后的核心事件子集（12+1 目录），未支持事件不注册 | TASK-030, TASK-031, TASK-057 |

## pi-rust 设计快照差异

- 设计快照 `61c833cd40e4fb818d715524e624546c8ee20c9d` 与上游 `main` `10a608e39081437afcf8d6249a316859d1e020a3` **不是同一提交**，compare API 状态为 `ahead`，共 7 个文件变更（均为文档、根清单与锁文件，无 `crates/rpi-plugin-sdk/src` 变更）。
- 因此**插件 SDK 源码在两版本间无差异**，迁移基线仍取设计快照 `61c833cd`；下述差异不得作为迁移依据。
- 本地 `repos/pi-rust` 不存在，只有工作目录内的只读文件快照（无 `.git`），无法测得本地 HEAD，故本节的仓库级复核标记 `evidence-limited`。

| 变更文件 | 变更行数 | 影响任务 | 停止条件 |
| --- | --- | --- | --- |
| `Cargo.toml` | 22 | TASK-002 | 需要以上游依赖表覆盖 Yeah 工作区依赖时停止 |
| `Cargo.lock` | 22 | TASK-002 | 需要引入上游锁文件版本时停止 |
| `CHANGELOG.md` | 14 | TASK-054 | 需要引用上游变更说明作为迁移依据时停止 |
| `README.md` | 2 | TASK-054 | 需要引用上游说明作为兼容性承诺时停止 |
| `crates/rpi-cli/embedded-docs/README.md` | 2 | TASK-054 | 同上 |
| `crates/rpi-cli/embedded-docs/changelog.md` | 14 | TASK-054 | 同上 |
| `docs/rpi-tool/README.md` | 2 | TASK-054 | 同上 |

## 零回归结论

- 本次复核只读，未修改 Yeah 的任何源码，`git status` 在复核开始时为干净工作树（`main...origin/main`）。
- 现有声明式插件链路的关键落点全部存在且大小非零：`plugins/` 10 个文件、`xai-grok-plugin-marketplace/src/` 12 个文件、`xai-tool-runtime` 10 个源文件 + 9 个集成测试。
- 迁移引入的新能力一律走新增 crate 与新增模块，不改写 `PluginManifest` 既有字段语义、不改写 `xai_tool_runtime::Tool`、不改写 `xai-grok-shell` 既有命令行为，因此对现有声明式插件零行为变更。
- 原生后端默认关闭（A/B 开关默认 B 关闭），未启用时不得进入原生加载路径。
- 该结论是**静态结论**，不等价于编译或运行验证；本仓当前环境无 Rust 工具链，编译级零回归需在具备 `cargo` 的环境重跑。

## AC 覆盖

| AC | 覆盖位置 | 结论 |
| --- | --- | --- |
| AC-001 快照与落点 | 「快照」「落点清单」两节 17 行 | 覆盖，逐项给出实际值/期望值/影响任务/停止条件 |
| AC-001 pi-rust 差异 | 「pi-rust 设计快照差异」+ `piRustDrift` | 覆盖；SDK 无差异，仓库级差异 7 文件已列，本地无检出故标 `evidence-limited` |
| AC-001 无访问时的诚实标记 | 「快照」`pi-rust 本地检出 = 无`，`evidenceLimited = true` | 覆盖，未出现「已编译通过」「已实测加载」等无证据表述 |
| AC-001 门禁脚本 | `scripts/ci/baseline-review-check.mjs` | 覆盖，缺快照号/落点/类型偏差/evidence-limited 任一即非零退出 |
| AC-001 失败用例 | `--self-test` 7 个夹具 | 覆盖基线一致与漂移两分支；漂移缺影响任务或停止条件时失败 |

## 机器可读清单

```json
{
  "yeahSnapshot": "b8381157d85b83b86f3c71d8dabaa892fdfc4db1",
  "yeahSourceRev": "559751fdcec02d413e4c57c8832ab275e4f44980",
  "piRustDesignSnapshot": "61c833cd40e4fb818d715524e624546c8ee20c9d",
  "piRustLocalHead": null,
  "piRustUpstreamHead": "10a608e39081437afcf8d6249a316859d1e020a3",
  "evidenceLimited": true,
  "paths": [
    { "path": "crates/codegen/xai-grok-agent/src/plugins/mod.rs", "kind": "declaration-entry", "actual": "906 B / f86e6315", "expected": "keep existing exports", "impactTasks": ["TASK-002", "TASK-005"], "stopCondition": "现有 pub use 被删除或重命名即停止" },
    { "path": "crates/codegen/xai-grok-agent/src/plugins/manifest.rs", "kind": "manifest-parser", "actual": "28116 B / 75e45997, 14 fields, no runtime/capabilities/platforms", "expected": "append runtime and capabilities DTO", "impactTasks": ["TASK-005"], "stopCondition": "声明式 manifest 解析结果变化即停止" },
    { "path": "crates/codegen/xai-grok-agent/src/plugins/discovery.rs", "kind": "discovery", "actual": "68489 B / 96b8caae", "expected": "single bad manifest does not block others", "impactTasks": ["TASK-005", "TASK-006"], "stopCondition": "单个坏 manifest 阻断其它插件即停止" },
    { "path": "crates/codegen/xai-grok-agent/src/plugins/git_install.rs", "kind": "install", "actual": "55449 B / 43ed0734", "expected": "native install path stays separate", "impactTasks": ["TASK-041"], "stopCondition": "复用导致既有安装记录格式变更即停止" },
    { "path": "crates/codegen/xai-grok-agent/src/plugins/install_registry.rs", "kind": "install-registry", "actual": "24824 B / 81da4003", "expected": "native records separate from InstallRegistry", "impactTasks": ["TASK-041", "TASK-042"], "stopCondition": "现有注册表 schema 被就地修改即停止" },
    { "path": "crates/codegen/xai-grok-agent/src/plugins/local_refresh.rs", "kind": "refresh", "actual": "32127 B / 324db551", "expected": "refresh does not reload native backends", "impactTasks": ["TASK-039"], "stopCondition": "刷新路径调用未实现的 reload 即停止" },
    { "path": "crates/codegen/xai-grok-agent/src/plugins/marketplace.rs", "kind": "marketplace-adapter", "actual": "17789 B / c129e613", "expected": "keep existing marketplace semantics", "impactTasks": ["TASK-041"], "stopCondition": "现有市场索引解析变更即停止" },
    { "path": "crates/codegen/xai-grok-agent/src/plugins/registry.rs", "kind": "registry", "actual": "47278 B / 31112af7", "expected": "native and declarative registries coexist", "impactTasks": ["TASK-026"], "stopCondition": "注册表 API 破坏性改动即停止" },
    { "path": "crates/codegen/xai-grok-agent/src/plugins/trust.rs", "kind": "trust", "actual": "11993 B / 64fbd84a", "expected": "native trust stored separately", "impactTasks": ["TASK-010", "TASK-044"], "stopCondition": "复用 TrustStore 覆盖既有授权即停止" },
    { "path": "crates/codegen/xai-grok-agent/src/plugins/hooks_adapter.rs", "kind": "hooks-adapter", "actual": "27192 B / 7b09a196", "expected": "native events bypass hooks adapter", "impactTasks": ["TASK-031"], "stopCondition": "事件重复投递即停止" },
    { "path": "crates/codegen/xai-grok-plugin-marketplace/src/lib.rs", "kind": "crate-declaration", "actual": "4063 B / 2cfcd406", "expected": "add modules without breaking exports", "impactTasks": ["TASK-012", "TASK-041", "TASK-042", "TASK-043"], "stopCondition": "现有导出被移除即停止" },
    { "path": "crates/codegen/xai-grok-plugin-marketplace/src/installer.rs", "kind": "installer", "actual": "60851 B / 5888e59c", "expected": "single install entry point", "impactTasks": ["TASK-041"], "stopCondition": "出现第二套安装入口即停止" },
    { "path": "crates/codegen/xai-grok-shell/src/plugin/mod.rs", "kind": "cli-commands", "actual": "90302 B / 60d0d7fb", "expected": "reuse existing command framework", "impactTasks": ["TASK-041", "TASK-045"], "stopCondition": "现有命令行为变化即停止" },
    { "path": "crates/codegen/xai-grok-shell/src/lib.rs", "kind": "crate-declaration", "actual": "1523 B / e3539fd2", "expected": "keep existing module declarations", "impactTasks": ["TASK-011"], "stopCondition": "现有模块声明被改写即停止" },
    { "path": "crates/codegen/xai-grok-workspace-types/src/types/plugins.rs", "kind": "workspace-dto", "actual": "1539 B / 1bc7c260", "expected": "native status stays out of existing DTO", "impactTasks": ["TASK-011"], "stopCondition": "现有 DTO 序列化变化即停止" },
    { "path": "crates/codegen/xai-grok-telemetry/src/events/plugin.rs", "kind": "telemetry-event", "actual": "1767 B / 38126f1d", "expected": "native events own namespace", "impactTasks": ["TASK-030", "TASK-044"], "stopCondition": "现有事件名复用即停止" },
    { "path": "crates/common/xai-tool-runtime/src/lib.rs", "kind": "tool-runtime-entry", "actual": "2074 B / 7b931245", "expected": "native tools adapt, Tool trait unchanged", "impactTasks": ["TASK-025"], "stopCondition": "Tool trait 破坏性变更即停止" },
    { "path": "crates/common/xai-tool-runtime/src/tool.rs", "kind": "tool-contract", "actual": "17965 B / 9212ea83", "expected": "map JSON-RPC results onto ToolStream", "impactTasks": ["TASK-025", "TASK-028"], "stopCondition": "映射需要改 ToolStreamItem 即停止" }
  ],
  "deviations": [
    { "item": "crates/plugin", "actual": "missing", "expected": "6 skeleton crates", "impactTasks": ["TASK-002"], "stopCondition": "目录落点与设计不一致即停止" },
    { "item": "plugin_features", "actual": "missing; xai-grok-config/lib.rs has no declaration", "expected": "plugin_features.rs declared and default-off", "impactTasks": ["TASK-002"], "stopCondition": "默认开启原生路径即停止" },
    { "item": "scripts", "actual": "missing", "expected": "baseline-review-check.mjs, license-check.sh, workspace-skeleton-check.mjs", "impactTasks": ["TASK-001", "TASK-002", "TASK-004"], "stopCondition": "脚本需要联网才能判定即停止" },
    { "item": "docs", "actual": "missing", "expected": "docs/planning, docs/legal, docs/contracts, docs/evidence", "impactTasks": ["TASK-001", "TASK-003", "TASK-004"], "stopCondition": "证据写到 writeScope 之外且未声明即停止" },
    { "item": "NOTICE", "actual": "only THIRD-PARTY-NOTICES (763905 B)", "expected": "root NOTICE with pi-rust MIT attribution", "impactTasks": ["TASK-004", "TASK-054"], "stopCondition": "未完成许可证结论即复制 pi-rust 代码" },
    { "item": "deny.toml", "actual": "missing", "expected": "allow-list without GPL/AGPL/SSPL/BUSL", "impactTasks": ["TASK-004"], "stopCondition": "allow-list 含禁止许可证即停止" },
    { "item": "license gate coverage", "actual": "TASK-004 is a DAG root but only TASK-054 depends on it", "expected": "every code-copying task gated by TASK-004", "impactTasks": ["TASK-004", "TASK-054"], "stopCondition": "复制类任务绕开门禁即停止" },
    { "item": "shell install overlap", "actual": "shell/src/plugin/mod.rs already has install/uninstall/update; installer.rs is 60851 B", "expected": "documented split before adding TASK-041 install.rs", "impactTasks": ["TASK-041"], "stopCondition": "出现两套并行安装实现即停止" },
    { "item": "marketplace declarations", "actual": "lib.rs lacks current_schema/install/staging/current/uninstall/records", "expected": "parent declaration ownership fixed first", "impactTasks": ["TASK-012", "TASK-041", "TASK-042", "TASK-043"], "stopCondition": "新增模块无父声明即停止" },
    { "item": "parent module gaps", "actual": "12 new modules without parent declaration", "expected": "TASK-002 fixes config lib.rs; others fixed in owning batch", "impactTasks": ["TASK-002", "TASK-031", "TASK-041", "TASK-042", "TASK-043", "TASK-045"], "stopCondition": "父文件归属未定即开始写子模块" },
    { "item": "Yeax usage", "actual": "0 of 65 tasks reference Yeax", "expected": "delivery scoped to Yeah only", "impactTasks": ["TASK-001"], "stopCondition": "出现 Yeax 改动即说明任务包漂移" },
    { "item": "DoR evidence path", "actual": "all 65 docs/evidence paths outside writeScope", "expected": "runner writes evidence or scope widened upstream", "impactTasks": ["TASK-001"], "stopCondition": "证据无处落盘即停止" }
  ],
  "typeDeviations": [
    { "symbol": "PluginManifest", "actual": "14 fields, no runtime/capabilities/platforms", "expected": "add runtime, capabilities, platforms; tolerate unknown fields", "impactTasks": ["TASK-005", "TASK-006"] },
    { "symbol": "rpi_plugin_register", "actual": "no dynamic registration symbol", "expected": "dlopen/dlsym entry for compat host; initialize handshake for native", "impactTasks": ["TASK-055", "TASK-056"] },
    { "symbol": "RPI_PLUGIN_ABI_VERSION_UNIFIED", "actual": "absent", "expected": "u32 = 4 on branch A; yeah-plugin/1.0 on branch B", "impactTasks": ["TASK-015", "TASK-056"] },
    { "symbol": "PluginApi.struct_size", "actual": "no versioned host struct", "expected": "size-checked slot access, no out-of-bounds reads", "impactTasks": ["TASK-056"] },
    { "symbol": "xai_tool_runtime::Tool", "actual": "async ToolStream with ToolProgress/ContentBlock", "expected": "execute/poll/cancel/destroy callbacks mapped onto ToolStream", "impactTasks": ["TASK-025", "TASK-028", "TASK-057"] },
    { "symbol": "StableToolSchema", "actual": "absent; tools described by Tool trait", "expected": "convert name/description/parameters JSON into Yeah tool description", "impactTasks": ["TASK-025"] },
    { "symbol": "HOST_CONTEXT_KEY", "actual": "absent; ToolCallContext passed directly", "expected": "inject __rpi context key, never logged or persisted", "impactTasks": ["TASK-025", "TASK-027"] },
    { "symbol": "EVENT_TAG_COUNT", "actual": "single telemetry plugin event file", "expected": "register only the trimmed 12+1 core event set", "impactTasks": ["TASK-030", "TASK-031", "TASK-057"] }
  ],
  "piRustDrift": {
    "status": "drifted",
    "changedCount": 7,
    "changedEntries": [
      { "path": "Cargo.toml", "impactTasks": ["TASK-002"], "stopCondition": "需要用上游依赖表覆盖 Yeah 工作区依赖时停止" },
      { "path": "Cargo.lock", "impactTasks": ["TASK-002"], "stopCondition": "需要引入上游锁文件版本时停止" },
      { "path": "CHANGELOG.md", "impactTasks": ["TASK-054"], "stopCondition": "需要引用上游变更说明作为迁移依据时停止" },
      { "path": "README.md", "impactTasks": ["TASK-054"], "stopCondition": "需要引用上游说明作为兼容性承诺时停止" },
      { "path": "crates/rpi-cli/embedded-docs/README.md", "impactTasks": ["TASK-054"], "stopCondition": "需要引用上游嵌入式文档作为迁移依据时停止" },
      { "path": "crates/rpi-cli/embedded-docs/changelog.md", "impactTasks": ["TASK-054"], "stopCondition": "需要引用上游变更日志作为迁移依据时停止" },
      { "path": "docs/rpi-tool/README.md", "impactTasks": ["TASK-054"], "stopCondition": "需要引用上游工具文档作为迁移依据时停止" }
    ],
    "sdkIdentical": true,
    "reason": "本地无 repos/pi-rust Git 检出，仓库级差异来自 GitHub 只读 compare API；插件 SDK 源码无差异，迁移基线锁定设计快照 61c833cd"
  }
}
```
