#!/usr/bin/env node
// Baseline review gate for the plugin-native migration (TASK-001 / AC-001).
//
// The gate is offline by design: it only reads the review document, never the
// network and never the Git object store. It fails closed when the document is
// missing, incomplete, or claims behaviour that was not actually observed.
//
// Usage:
//   node scripts/ci/baseline-review-check.mjs
//   node scripts/ci/baseline-review-check.mjs --file docs/planning/baseline-review.md
//   node scripts/ci/baseline-review-check.mjs --self-test
//
// Exit codes: 0 = pass, 1 = document rejected, 2 = usage/IO error.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const DEFAULT_FILE = path.join(REPO_ROOT, 'docs', 'planning', 'baseline-review.md');

const YEAH_SNAPSHOT = 'b8381157d85b83b86f3c71d8dabaa892fdfc4db1';
const PI_RUST_DESIGN_SNAPSHOT = '61c833cd40e4fb818d715524e624546c8ee20c9d';

const REQUIRED_SECTIONS = [
  '## 快照',
  '## 落点清单',
  '## 偏差清单',
  '## 类型与函数偏差',
  '## pi-rust 设计快照差异',
  '## 零回归结论',
  '## AC 覆盖',
];

// Paths the review must have actually looked at. Each entry is a substring of
// the reviewed path; the document has to mention every one of them.
const REQUIRED_PATHS = [
  'crates/codegen/xai-grok-agent/src/plugins/discovery.rs',
  'crates/codegen/xai-grok-agent/src/plugins/git_install.rs',
  'crates/codegen/xai-grok-agent/src/plugins/hooks_adapter.rs',
  'crates/codegen/xai-grok-agent/src/plugins/install_registry.rs',
  'crates/codegen/xai-grok-agent/src/plugins/local_refresh.rs',
  'crates/codegen/xai-grok-agent/src/plugins/manifest.rs',
  'crates/codegen/xai-grok-agent/src/plugins/marketplace.rs',
  'crates/codegen/xai-grok-agent/src/plugins/mod.rs',
  'crates/codegen/xai-grok-agent/src/plugins/registry.rs',
  'crates/codegen/xai-grok-agent/src/plugins/trust.rs',
  'crates/codegen/xai-grok-plugin-marketplace/src/lib.rs',
  'crates/codegen/xai-grok-plugin-marketplace/src/installer.rs',
  'crates/codegen/xai-grok-shell/src/plugin/mod.rs',
  'crates/codegen/xai-grok-workspace-types/src/types/plugins.rs',
  'crates/codegen/xai-grok-telemetry/src/events/plugin.rs',
  'crates/common/xai-tool-runtime/src/lib.rs',
  'crates/common/xai-tool-runtime/src/tool.rs',
];

// Claims that need a real compiler/test run behind them. Without a toolchain
// these must never appear as facts in the review document.
const FORBIDDEN_CLAIMS = ['已编译通过', '已实测加载', 'cargo check 通过', '单元测试全部通过'];

const SHA1 = /^[0-9a-f]{40}$/;
const NEGATIONS = ['未', '不', '无', '没有', '禁止', '尚未', '没有出现'];

function fail(findings, message) {
  findings.push(message);
}

function extractJsonBlock(text) {
  const match = text.match(/```json\r?\n([\s\S]*?)\r?\n```/);
  if (!match) {
    return { error: '缺少机器可读清单：未找到 ```json 代码块' };
  }
  try {
    return { value: JSON.parse(match[1]) };
  } catch (error) {
    return { error: `机器可读清单不是合法 JSON：${error.message}` };
  }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * A claim is only a violation when it is stated as fact. Mentions such as
 * 「未出现「已编译通过」」 are describing the rule, not asserting the result.
 */
function hasUnnegatedClaim(text, claim) {
  let from = 0;
  for (;;) {
    const index = text.indexOf(claim, from);
    if (index === -1) {
      return false;
    }
    const window = text.slice(Math.max(0, index - 12), index);
    if (!NEGATIONS.some((negation) => window.includes(negation))) {
      return true;
    }
    from = index + claim.length;
  }
}

/**
 * Validate one review document. Pure function so `--self-test` can drive it
 * with fixtures without touching the filesystem.
 */
export function validate(text) {
  const findings = [];

  for (const section of REQUIRED_SECTIONS) {
    if (!text.includes(section)) {
      fail(findings, `缺少必需章节：${section}`);
    }
  }

  for (const claim of FORBIDDEN_CLAIMS) {
    if (hasUnnegatedClaim(text, claim)) {
      fail(findings, `文档在无编译证据的情况下声称「${claim}」`);
    }
  }

  const parsed = extractJsonBlock(text);
  if (parsed.error) {
    fail(findings, parsed.error);
    return findings;
  }
  const data = parsed.value;

  if (data.yeahSnapshot !== YEAH_SNAPSHOT) {
    fail(findings, `yeahSnapshot 必须是 ${YEAH_SNAPSHOT}，实际为 ${data.yeahSnapshot}`);
  }
  if (!SHA1.test(String(data.piRustDesignSnapshot))) {
    fail(findings, 'piRustDesignSnapshot 缺失或不是 40 位 SHA-1');
  } else if (data.piRustDesignSnapshot !== PI_RUST_DESIGN_SNAPSHOT) {
    fail(
      findings,
      `piRustDesignSnapshot 必须是 ${PI_RUST_DESIGN_SNAPSHOT}，实际为 ${data.piRustDesignSnapshot}`,
    );
  }

  const localHead = data.piRustLocalHead;
  const hasLocalHead = typeof localHead === 'string' && SHA1.test(localHead);
  if (localHead !== null && !hasLocalHead) {
    fail(findings, 'piRustLocalHead 只能是 40 位 SHA-1 或 null');
  }
  if (!hasLocalHead && data.evidenceLimited !== true) {
    fail(findings, '没有本地 pi-rust HEAD 时，evidenceLimited 必须为 true');
  }
  if (typeof data.evidenceLimited !== 'boolean') {
    fail(findings, 'evidenceLimited 缺失或不是布尔值');
  }

  const paths = Array.isArray(data.paths) ? data.paths : [];
  if (paths.length < REQUIRED_PATHS.length) {
    fail(findings, `paths 只有 ${paths.length} 行，少于必需落点 ${REQUIRED_PATHS.length} 个`);
  }
  const flaggedText = paths.map((entry) => (entry && entry.path) || '').join('\n');
  for (const required of REQUIRED_PATHS) {
    if (!flaggedText.includes(required)) {
      fail(findings, `paths 未覆盖必需落点：${required}`);
    }
  }
  for (const entry of paths) {
    if (!entry || !isNonEmptyString(entry.path)) {
      fail(findings, 'paths 存在缺少 path 的行');
      continue;
    }
    for (const field of ['actual', 'expected', 'kind']) {
      if (!isNonEmptyString(entry[field])) {
        fail(findings, `paths[${entry.path}] 缺少 ${field}`);
      }
    }
    if (!Array.isArray(entry.impactTasks) || entry.impactTasks.length === 0) {
      fail(findings, `paths[${entry.path}] 缺少 impactTasks`);
    }
    if (!isNonEmptyString(entry.stopCondition)) {
      fail(findings, `paths[${entry.path}] 缺少 stopCondition`);
    }
  }

  const deviations = Array.isArray(data.deviations) ? data.deviations : [];
  if (deviations.length === 0) {
    fail(findings, 'deviations 为空：必须逐项记录实际值、期望值、影响任务与停止条件');
  }
  for (const entry of deviations) {
    if (!entry || !isNonEmptyString(entry.item)) {
      fail(findings, 'deviations 存在缺少 item 的行');
      continue;
    }
    for (const field of ['actual', 'expected', 'stopCondition']) {
      if (!isNonEmptyString(entry[field])) {
        fail(findings, `deviations[${entry.item}] 缺少 ${field}`);
      }
    }
    if (!Array.isArray(entry.impactTasks) || entry.impactTasks.length === 0) {
      fail(findings, `deviations[${entry.item}] 缺少 impactTasks`);
    }
  }

  const typeDeviations = Array.isArray(data.typeDeviations) ? data.typeDeviations : [];
  if (typeDeviations.length === 0) {
    fail(findings, 'typeDeviations 为空：必须记录类型与函数层偏差');
  }
  for (const entry of typeDeviations) {
    if (!entry || !isNonEmptyString(entry.symbol)) {
      fail(findings, 'typeDeviations 存在缺少 symbol 的行');
      continue;
    }
    for (const field of ['actual', 'expected']) {
      if (!isNonEmptyString(entry[field])) {
        fail(findings, `typeDeviations[${entry.symbol}] 缺少 ${field}`);
      }
    }
    if (!Array.isArray(entry.impactTasks) || entry.impactTasks.length === 0) {
      fail(findings, `typeDeviations[${entry.symbol}] 缺少 impactTasks`);
    }
  }

  const drift = data.piRustDrift || {};
  if (!['identical', 'drifted', 'evidence-limited'].includes(drift.status)) {
    fail(findings, `piRustDrift.status 非法：${JSON.stringify(drift.status)}`);
  }
  if (drift.status === 'drifted') {
    const changed = Array.isArray(drift.changedEntries) ? drift.changedEntries : [];
    if (changed.length === 0) {
      fail(findings, 'piRustDrift.status=drifted 但 changedEntries 为空');
    }
    if (!Number.isInteger(drift.changedCount) || drift.changedCount !== changed.length) {
      fail(findings, 'piRustDrift.changedCount 与 changedEntries 数量不一致');
    }
    for (const entry of changed) {
      if (!entry || !isNonEmptyString(entry.path)) {
        fail(findings, 'piRustDrift.changedEntries 存在缺少 path 的行');
        continue;
      }
      if (!Array.isArray(entry.impactTasks) || entry.impactTasks.length === 0) {
        fail(findings, `piRustDrift.changedEntries[${entry.path}] 缺少 impactTasks`);
      }
      if (!isNonEmptyString(entry.stopCondition)) {
        fail(findings, `piRustDrift.changedEntries[${entry.path}] 缺少 stopCondition`);
      }
    }
  }
  if (drift.status === 'evidence-limited' && !isNonEmptyString(drift.reason)) {
    fail(findings, 'piRustDrift.status=evidence-limited 时必须给出 reason');
  }

  return findings;
}

function renderFindings(findings) {
  const lines = [`baseline-review-check: ${findings.length} 项不通过`];
  for (const finding of findings) {
    lines.push(`  - ${finding}`);
  }
  return lines.join('\n');
}

const FIXTURES = [
  {
    name: '合法基线（无漂移）',
    expectPass: true,
    mutate: (doc) => {
      doc.piRustLocalHead = PI_RUST_DESIGN_SNAPSHOT;
      doc.evidenceLimited = false;
      doc.piRustDrift = { status: 'identical', changedCount: 0, changedEntries: [] };
    },
  },
  {
    name: '缺失快照号',
    expectPass: false,
    mutate: (doc) => {
      delete doc.yeahSnapshot;
    },
  },
  {
    name: '缺失落点清单',
    expectPass: false,
    mutate: (doc) => {
      doc.paths = doc.paths.slice(0, 3);
    },
  },
  {
    name: '缺失类型/函数偏差',
    expectPass: false,
    mutate: (doc) => {
      doc.typeDeviations = [];
    },
  },
  {
    name: '无本地 HEAD 但未标记 evidence-limited',
    expectPass: false,
    mutate: (doc) => {
      doc.piRustLocalHead = null;
      doc.evidenceLimited = false;
    },
  },
  {
    name: '漂移分支缺少影响任务与停止条件',
    expectPass: false,
    mutate: (doc) => {
      doc.piRustDrift = { status: 'drifted', changedCount: 1, changedEntries: [{ path: 'Cargo.toml' }] };
    },
  },
  {
    name: '合法漂移分支',
    expectPass: true,
    mutate: (doc) => {
      doc.piRustLocalHead = '10a608e39081437afcf8d6249a316859d1e020a3';
      doc.evidenceLimited = false;
      doc.piRustDrift = {
        status: 'drifted',
        changedCount: 1,
        changedEntries: [
          { path: 'Cargo.toml', impactTasks: ['TASK-054'], stopCondition: '差异文件未复核即停止迁移' },
        ],
      };
    },
  },
  {
    name: '把编译结论写成事实',
    expectPass: false,
    mutate: (doc, appendParagraph) => {
      appendParagraph('本节点 cargo check 通过，已编译通过。');
    },
  },
  {
    name: '否定式提及不算违规',
    expectPass: true,
    mutate: (doc, appendParagraph) => {
      appendParagraph('本节点未出现「已编译通过」，也没有「已实测加载」。');
    },
  },
];

function selfTest() {
  const sample = {
    yeahSnapshot: YEAH_SNAPSHOT,
    piRustDesignSnapshot: PI_RUST_DESIGN_SNAPSHOT,
    piRustLocalHead: null,
    evidenceLimited: true,
    paths: REQUIRED_PATHS.map((p) => ({
      path: p,
      kind: 'file',
      actual: 'present',
      expected: 'present',
      impactTasks: ['TASK-002'],
      stopCondition: '落点缺失即停止',
    })),
    deviations: [
      {
        item: 'sample',
        actual: 'a',
        expected: 'b',
        impactTasks: ['TASK-002'],
        stopCondition: 'stop',
      },
    ],
    typeDeviations: [
      { symbol: 'sample', actual: 'a', expected: 'b', impactTasks: ['TASK-002'] },
    ],
    piRustDrift: { status: 'evidence-limited', changedCount: 0, changedEntries: [], reason: 'no local checkout' },
  };

  const build = (doc, appendix = '') => {
    const cloned = JSON.parse(JSON.stringify(doc));
    const body = REQUIRED_SECTIONS.join('\n\n');
    return `${body}\n\n${appendix}\n\n\`\`\`json\n${JSON.stringify(cloned, null, 2)}\n\`\`\`\n`;
  };

  let failed = 0;
  for (const fixture of FIXTURES) {
    const doc = JSON.parse(JSON.stringify(sample));
    let appendix = '';
    fixture.mutate(doc, (paragraph) => {
      appendix += `${paragraph}\n`;
    });
    const findings = validate(build(doc, appendix));
    const passed = findings.length === 0;
    if (passed !== fixture.expectPass) {
      failed += 1;
      console.error(`FAIL  ${fixture.name}：期望 ${fixture.expectPass ? '通过' : '失败'}，实际相反`);
      if (findings.length > 0) {
        console.error(renderFindings(findings));
      }
    } else {
      console.log(`ok    ${fixture.name}`);
    }
  }

  if (failed > 0) {
    console.error(`baseline-review-check --self-test: ${failed} 个夹具不符合预期`);
    return 1;
  }
  console.log(`baseline-review-check --self-test: ${FIXTURES.length} 个夹具全部符合预期`);
  return 0;
}

function main(argv) {
  if (argv.includes('--self-test')) {
    return selfTest();
  }

  let file = DEFAULT_FILE;
  const index = argv.indexOf('--file');
  if (index !== -1) {
    if (!argv[index + 1]) {
      console.error('用法：baseline-review-check.mjs --file <path>');
      return 2;
    }
    file = path.resolve(process.cwd(), argv[index + 1]);
  }

  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    console.error(`baseline-review-check: 无法读取 ${file}：${error.code || error.message}`);
    return 1;
  }

  const findings = validate(text);
  if (findings.length > 0) {
    console.error(renderFindings(findings));
    return 1;
  }
  console.log(`baseline-review-check: ${path.relative(REPO_ROOT, file)} 通过`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  process.exit(main(process.argv.slice(2)));
}
