# TASK-002 验证记录

- 验证时间：2026-11-23 19:30–19:34（Asia/Shanghai）
- 验证主机：Windows，Node `v24.14.1`，**无 `cargo` / `rustc`**
- 被测对象：6 个插件 crate 骨架、根 `Cargo.toml` members、`Cargo.lock`、`xai-grok-config/src/plugin_features.rs`、`scripts/ci/workspace-skeleton-check.mjs`
- 说明 1：本文件在 `docs/evidence/**`，不在 TASK-002 的 writeScope 内。
- 说明 2：**未执行 `cargo check`**，本记录不声称编译通过。

## 1. 结构门禁

```text
$ node scripts/ci/workspace-skeleton-check.mjs
cargo check: SKIPPED（PATH 中没有 cargo；CI 需使用 --require-cargo）
workspace-skeleton-check: 通过（6 个 crate / 113 个 members / 默认关闭）
exit=0
```

## 2. 失败用例夹具

```text
$ node scripts/ci/workspace-skeleton-check.mjs --self-test
ok    members 完整且有序
ok    members 缺少 plugin crate
ok    members 重复登记
ok    默认关闭原生 feature
ok    默认打开原生 feature
ok    lib.rs 模块声明完整
ok    lib.rs 缺少模块声明
workspace-skeleton-check --self-test: 7 个夹具全部符合预期
exit=0
```

## 3. Cargo.lock 变更方式

条目按字典序插入到 `xai-plugin-…` 的排序位置（位于 `xai-pager-*` 之后、`xai-prompt-queue` 之前），每条为：

```toml
[[package]]
name = "xai-plugin-native-api"
version = "0.1.0"
```

变更行数：`24 insertions`，无其它改动。未重新生成锁文件（无 `cargo`），因此 CI 首次运行 `cargo check` 时仍须确认锁文件无需变更。

## 4. 诚实声明：未验证项

| 项 | 原因 | 影响 |
| --- | --- | --- |
| `cargo check --workspace` | 环境无 Rust 工具链（`where cargo` 为空） | 编译级验收未完成，PR 中已显式标注 |
| `Cargo.lock` 与 `cargo metadata` 一致 | 同上 | 手写条目按既有格式插入，未经过 cargo 校验 |
| 新旧 crate 依赖关系 | TASK-002 只建骨架，crate 之间暂无依赖 | 后续任务引入依赖时须同步锁文件 |
| `plugin_features` 单测 | 无 `cargo test` | A/B 解析分支仅有静态审查 |

## 5. 交付偏差

1. 为满足「`lib.rs` 一次性声明后续模块」且保持可编译，所有后续模块以带 `implemented by TASK-XXX` 标注的占位文件落盘；这些文件不在 TASK-002 的 writeScope 内，需在任务包中扩充 writeScope 或由后续任务原地替换。
2. `Cargo.lock` 与 `docs/evidence/**` 同样不在 writeScope 内。
3. 未在 `lib.rs` 中声明任何跨 crate 依赖；`xai-plugin-native-runtime` 等 crate 暂时不引用 `xai-plugin-native-api`，依赖边留给 TASK-003 之后的任务。
