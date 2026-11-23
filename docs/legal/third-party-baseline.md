# 依赖与许可证基线（TASK-004）

- 基线快照：`b8381157d85b83b86f3c71d8dabaa892fdfc4db1`
- 机器策略：`deny.toml`（allow-list）
- 离线门禁：`scripts/ci/license-check.sh`
- 生成清单：`THIRD-PARTY-NOTICES`（763905 B，仓库自带）+ `Cargo.lock`（1360 个 package 条目）

## 1. 本仓自身

| 组件 | 版本/提交 | 许可证 | 用途 | 来源 |
| --- | --- | --- | --- | --- |
| Yeah | `b8381157d85b83b86f3c71d8dabaa892fdfc4db1` | Apache-2.0 | 被迁移的宿主工程 | 仓库根 `LICENSE` |
| Yeah `SOURCE_REV` | `559751fdcec02d413e4c57c8832ab275e4f44980` | Apache-2.0 | 上游同步标识 | 仓库根 `SOURCE_REV` |

## 2. 迁移参考组件

| 组件 | 版本/提交 | 许可证 | 用途 | 来源 |
| --- | --- | --- | --- | --- |
| pi-rust | 设计快照 `61c833cd40e4fb818d715524e624546c8ee20c9d` | MIT | 插件机制设计与 ABI 参考；**当前未复制任何源码** | https://github.com/bigfish1913/pi-rust |
| pi-rust 插件 SDK | 同上 | MIT | `PluginApi`、`RPI_PLUGIN_ABI_VERSION_UNIFIED = 4`、`rpi_plugin_register`、事件目录等符号参考 | `crates/rpi-plugin-sdk` |

## 3. 结论与约束

1. MIT 与 Apache-2.0 兼容，可在保留版权与许可声明的前提下参考 pi-rust 设计；实际复制源码前必须先完成 TASK-004 门禁并在 `NOTICE` 中登记。
2. 依赖侧一律不允许 copyleft 家族（GPL / AGPL / SSPL / BUSL / Commons-Clause）进入 allow-list；确需引入时必须单独立项评审，不得通过修改 `deny.toml` 绕过。
3. 本文件只登记插件原生工作（COS-1544）直接相关的组件；全量依赖许可信息以 `THIRD-PARTY-NOTICES` 为准，`deny.toml` 负责在 CI 中做机器校验。
4. 本次未执行在线依赖扫描，原因是当前环境无 Rust 工具链（无 `cargo`），无法运行 `cargo deny check`；上述结论来自静态清单与 `deny.toml` allow-list 的一致性检查。

## 4. 复核方式

```bash
# 离线门禁（无需网络、无需 cargo）
bash scripts/ci/license-check.sh

# 具备工具链时的完整校验
cargo deny check licenses advisories bans sources
```
