# TASK-004 验证记录

- 验证时间：2026-11-23 19:26–19:32（Asia/Shanghai）
- 验证主机：Windows，Git Bash（`C:\Program Files\Git\bin\bash.exe`）
- 被测对象：`NOTICE`、`deny.toml`、`scripts/ci/license-check.sh`、`docs/legal/third-party-baseline.md`、`docs/legal/clean-room-record.md`
- 说明：本文件在 `docs/evidence/**`，不在 TASK-004 的 writeScope 内，作为交付偏差声明。

## 1. Red：门禁文件缺失

```text
$ bash scripts/ci/license-check.sh
  - 缺少 NOTICE
  - 缺少 deny.toml
  - 缺少 docs/legal/clean-room-record.md
  - 缺少 docs/legal/third-party-baseline.md
license-check: 4 项不通过
exit=1
```

## 2. Green：补齐后通过

```text
$ bash scripts/ci/license-check.sh
license-check: 通过（root=.../repos/Yeah-partial）
exit=0
```

## 3. 失败用例夹具

```text
$ bash scripts/ci/license-check.sh --self-test
ok    合法依赖/完整声明
ok    夹具 missing-notice 按预期失败
ok    夹具 empty-attribution 按预期失败
ok    夹具 forbidden-license 按预期失败
ok    夹具 missing-clean-room 按预期失败
license-check --self-test: 5 个夹具全部符合预期
exit=0
```

## 4. 覆盖映射

| testRequirements | 证据 |
| --- | --- |
| 缺失 NOTICE、禁止许可证、空 attribution 三类夹具先失败 | 夹具 `missing-notice`、`forbidden-license`、`empty-attribution` |
| 覆盖合法依赖、禁止许可证、缺失 NOTICE、空 attribution、缺失 clean-room 记录五类场景 | 上述 4 个失败夹具 + 「合法依赖/完整声明」 |
| deny.toml 与 NOTICE 可被脚本解析，不把凭据写入文件 | `check_deny` 解析 `[licenses] allow`；`check_no_secrets` 扫描 `ghp_`/`github_pat_` 模式 |

## 5. 诚实声明：未验证项

| 项 | 原因 | 影响 |
| --- | --- | --- |
| `cargo deny check` | 环境无 Rust 工具链 | `deny.toml` 仅经离线脚本解析与人工核对，未由 cargo-deny 执行 |
| 依赖许可证全量扫描 | 无工具链、且全量清单依赖 `THIRD-PARTY-NOTICES` | 本次只校验策略文件与已登记组件的一致性 |
| 上游 MIT 版权行原文 | 尚未复制任何 pi-rust 文件 | `NOTICE` 已预留归属段，首次复制时须补全原文 |

## 6. 冲突处置说明

`TASK-004` 要求「在复制任何 pi-rust 代码前完成许可证结论」，同时要求「NOTICE 含 MIT attribution」。本提交的处置是：`NOTICE` 预先登记 pi-rust 的 MIT 归属与来源，并明确标注「当前未复制任何源码」；`docs/legal/clean-room-record.md` 同步声明未复制代码。两者在语义上不冲突：归属段为后续复制预留，状态以 clean-room 记录为准。
