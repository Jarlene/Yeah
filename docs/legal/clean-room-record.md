# Clean-room 记录（TASK-004）

- 适用工作：COS-1544「将 pi-rust 插件机制迁移到 Yeah」
- 门禁任务：`TASK-004`（许可证 / NOTICE / clean-room）
- 记录时间：2026-11-23
- 当前状态：**门禁已建立；截至本提交未复制任何 pi-rust 代码**（no pi-rust source code has been copied）

## 1. 目的

在引入 pi-rust（MIT）任何源码之前，先固定“可以看什么、不可以复制什么、复制后必须补什么”的流程，避免把上游实现细节当成自有代码写入 Yeah。

## 2. 允许的输入

下列信息属于公开事实，可用于设计与实现，不构成代码复制：

1. 仓库目录结构、文件路径、文件大小、blob SHA-1。
2. 公开文档、README、CHANGELOG、issue 与提交说明。
3. 公开 API 边界：类型名、函数名、常量名、ABI 版本号、协议方法名（例如 `RPI_PLUGIN_ABI_VERSION_UNIFIED = 4`、注册符号 `rpi_plugin_register`、事件标签数量）。
4. 行为约定：状态集合、错误码、超时与失败语义。

## 3. 禁止的做法

1. 直接复制 pi-rust 源文件、注释、测试或用例文本。
2. 通过变量改名、拆分函数等方式规避来源标注。
3. 在未更新 `NOTICE` 与依赖基线的情况下引入上游代码。
4. 把上游实现细节写成 Yeah 的“既有行为”而不加标注。

## 4. 复制后的强制补全

一旦某次变更确实引入了 pi-rust 代码，必须在同一变更内完成：

1. 在 `NOTICE` 中补全上游 MIT 版权行原文与文件清单。
2. 在 `docs/legal/third-party-baseline.md` 登记该文件与许可证。
3. 在提交信息中标注 `pi-rust-origin: <path>@<snapshot>`。
4. 更新本记录的“已复制文件清单”小节，并把当前状态改为“已复制”。

## 5. 当前已复制文件清单

空。截至本提交，Yeah 仓库中不存在来自 pi-rust 的源文件。

## 6. 复核方式

```bash
# 1. 离线门禁：NOTICE / deny.toml / 本记录 / 依赖基线一致性
bash scripts/ci/license-check.sh

# 2. 人工复核：列出本分支新增的文件，确认没有未登记的上游拷贝
git log --diff-filter=A --name-only --pretty=format: origin/main..HEAD
```

## 7. 评审签署

| 角色 | 结论 | 时间 |
| --- | --- | --- |
| TDD 执行者 | 门禁文件已建立，未复制上游代码 | 2026-11-23 |
| 许可证评审人 | 待评审 | — |
