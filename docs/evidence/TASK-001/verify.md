# TASK-001 验证记录

- 验证时间：2026-11-23 19:20–19:30（Asia/Shanghai）
- 验证主机：Windows，Node `v24.14.1`
- 被测对象：`docs/planning/baseline-review.md` + `scripts/ci/baseline-review-check.mjs`
- 说明：本文件是 runner 证据路径（`docs/evidence/**`），不在 TASK-001 的 writeScope 内；按上游 05 节点 P-06 约定由执行环节统一回写，作为交付偏差一并声明。

## 1. Red：文档不存在时门禁必须失败

```text
$ node scripts/ci/baseline-review-check.mjs
baseline-review-check: 无法读取 .../docs/planning/baseline-review.md：ENOENT
exit=1
```

## 2. Green：文档补齐后门禁通过

```text
$ node scripts/ci/baseline-review-check.mjs
baseline-review-check: docs\planning\baseline-review.md 通过
exit=0
```

## 3. 失败用例夹具（`--self-test`）

```text
$ node scripts/ci/baseline-review-check.mjs --self-test
ok    合法基线（无漂移）
ok    缺失快照号
ok    缺失落点清单
ok    缺失类型/函数偏差
ok    无本地 HEAD 但未标记 evidence-limited
ok    漂移分支缺少影响任务与停止条件
ok    合法漂移分支
ok    把编译结论写成事实
ok    否定式提及不算违规
baseline-review-check --self-test: 9 个夹具全部符合预期
exit=0
```

## 4. 覆盖映射

| testRequirements | 证据 |
| --- | --- |
| 断言文档含快照号、路径清单、类型/函数偏差、evidence-limited 四类字段，缺失即失败 | 夹具「缺失快照号」「缺失落点清单」「缺失类型/函数偏差」「无本地 HEAD 但未标记 evidence-limited」 |
| 覆盖 pi-rust 设计快照与本地 HEAD 不一致分支 | 夹具「合法漂移分支」「漂移分支缺少影响任务与停止条件」 |
| 覆盖一致与漂移两分支，漂移须输出受影响任务与停止条件 | 同上，`changedEntries` 缺 `impactTasks`/`stopCondition` 即失败 |
| 集成检查不访问网络、不修改代码仓 | 脚本仅 `fs.readFileSync`，无网络调用；本仓在验证期间无源码改动 |

## 5. 事实来源

- Yeah 侧文件大小与 blob SHA-1：`git ls-tree -l b8381157…`。
- pi-rust 设计快照与上游 `main` 的 7 个变更文件：GitHub 只读 compare API（`61c833cd…10a608e3`，`status=ahead`）。
- 本地无 pi-rust Git 检出：`repos/pi-rust` 不存在；工作目录内只有无 `.git` 的只读文件快照。
- 本记录不包含任何编译或运行结论。
