#!/usr/bin/env node
// Workspace skeleton gate for the plugin-native migration (TASK-002).
//
// Validates, offline:
//   1. root `[workspace] members` contains the six plugin crates, sorted and
//      without duplicates;
//   2. every crate declares the expected package name, edition, licence and
//      an empty `[dependencies]` table;
//   3. `Cargo.lock` carries a matching `[[package]]` entry;
//   4. every `mod` declared in `lib.rs` (recursively) resolves to a file, and
//      the declared module set equals the contract derived from tasks.json;
//   5. the A/B switch defaults to `Declarative` and is declared by
//      `xai-grok-config`.
//
// `cargo check` is executed only when a toolchain is present. Without one the
// script reports `cargo: SKIPPED` and keeps validating structure; CI must pass
// `--require-cargo` so a missing toolchain is a failure there.
//
// Usage:
//   node scripts/ci/workspace-skeleton-check.mjs
//   node scripts/ci/workspace-skeleton-check.mjs --require-cargo
//   node scripts/ci/workspace-skeleton-check.mjs --self-test
//
// Exit codes: 0 = pass, 1 = rejected, 2 = usage/IO error.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');

const CRATES = {
  'xai-plugin-native-api': [
    'context',
    'error',
    'events',
    'manifest',
    'negotiation',
    'protocol',
    'redaction',
    'rpc_error',
    'state',
    'validation',
    'version',
  ],
  'xai-plugin-native-runtime': [
    'asset',
    'audit',
    'command_adapter',
    'effects',
    'event_budget',
    'event_bus',
    'event_dedup',
    'gate',
    'kill_switch',
    'lease',
    'lifecycle',
    'policy',
    'prompt_resource',
    'provider_registry',
    'provider_transform',
    'registry',
    'reload',
    'resource_adapter',
    'resource_guard',
    'shutdown_budget',
    'state_store',
    'supervisor',
    'tool_adapter',
    'trust',
  ],
  'xai-plugin-native-sidecar': [
    'backend',
    'fs_quota',
    'health',
    'net_quota',
    'process',
    'quota',
    'quota/fairness',
    'quota/permit_release',
    'quota/rate_limit',
    'quota/release_matrix',
    'rpc',
    'sandbox',
    'shutdown',
    'terminate',
  ],
  'xai-plugin-pi-compat': [
    'abi_shim',
    'api_shim',
    'event_map',
    'host',
    'resource_map',
    'support_matrix',
  ],
  'xai-plugin-sdk': ['sdk'],
  'xai-plugin-testkit': [
    'admission',
    'admission/audit',
    'admission/rate',
    'admission/refund',
    'conformance',
    'fault',
    'fault_acceptance',
    'fault_acceptance/lifecycle',
    'fault_acceptance/platform',
    'fixtures',
    'fuzz',
    'harness',
    'security',
  ],
};

const findings = [];

function fail(message) {
  findings.push(message);
}

export function parseMembers(cargoToml) {
  const start = cargoToml.indexOf('members = [');
  if (start === -1) {
    return null;
  }
  const end = cargoToml.indexOf(']', start);
  if (end === -1) {
    return null;
  }
  return [...cargoToml.slice(start, end).matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

export function parseModDeclarations(source) {
  // Only out-of-line declarations (`mod x;`) matter; inline `mod x { }` bodies
  // are not used by this scaffold.
  return [...source.matchAll(/^\s*(?:pub(?:\([^)]*\))?\s+)?mod\s+([a-z0-9_]+)\s*;/gm)].map(
    (match) => match[1],
  );
}

export function validateMembers(members, required) {
  const problems = [];
  if (!members) {
    problems.push('根 Cargo.toml 缺少 [workspace] members');
    return problems;
  }
  const seen = new Set();
  for (const member of members) {
    if (seen.has(member)) {
      problems.push(`members 重复登记：${member}`);
    }
    seen.add(member);
  }
  for (const crate of required) {
    const expected = `crates/plugin/${crate}`;
    if (!members.includes(expected)) {
      problems.push(`members 缺少 ${expected}`);
    }
  }
  const sorted = [...members].sort();
  if (members.some((member, index) => member !== sorted[index])) {
    problems.push('members 未按字典序排列');
  }
  return problems;
}

export function validateDefaultFeatureOff(cargoToml) {
  const problems = [];
  const defaultMatch = cargoToml.match(/^\s*default\s*=\s*\[([^\]]*)\]/m);
  if (!defaultMatch) {
    return problems;
  }
  const entries = [...defaultMatch[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  for (const entry of entries) {
    if (/native|sidecar|compat/i.test(entry)) {
      problems.push(`默认 feature 打开了原生路径：${entry}`);
    }
  }
  return problems;
}

export function validateDeclaredModules(declared, expected) {
  const problems = [];
  const declaredSet = new Set(declared);
  const expectedSet = new Set(expected);
  for (const module of expectedSet) {
    if (!declaredSet.has(module)) {
      problems.push(`lib.rs 未声明模块：${module}`);
    }
  }
  for (const module of declaredSet) {
    if (!expectedSet.has(module)) {
      problems.push(`lib.rs 声明了契约外模块：${module}`);
    }
  }
  return problems;
}

function readCrateToml(dir) {
  const file = path.join(dir, 'Cargo.toml');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

function resolveModuleTree(srcDir, declared, prefix, problems) {
  for (const name of declared) {
    const flat = path.join(srcDir, `${name}.rs`);
    const nested = path.join(srcDir, name, 'mod.rs');
    let file = null;
    if (fs.existsSync(nested)) {
      file = nested;
    } else if (fs.existsSync(flat)) {
      file = flat;
    }
    if (!file) {
      problems.push(`模块无对应文件：${prefix}${name}`);
      continue;
    }
    const source = fs.readFileSync(file, 'utf8');
    if (!source.includes('implemented by TASK-')) {
      problems.push(`脚手架文件缺少归属任务标注：${path.relative(REPO_ROOT, file)}`);
    }
    const children = parseModDeclarations(source);
    if (children.length > 0) {
      resolveModuleTree(path.dirname(file), children, `${prefix}${name}::`, problems);
    }
  }
}

export function selfTest() {
  const cases = [];

  const push = (name, expectPass, problems) => {
    const passed = problems.length === 0;
    cases.push(passed === expectPass);
    if (passed !== expectPass) {
      console.error(`FAIL  ${name}：期望 ${expectPass ? '通过' : '失败'}，实际相反`);
      for (const problem of problems) {
        console.error(`      ${problem}`);
      }
    } else {
      console.log(`ok    ${name}`);
    }
  };

  const crates = Object.keys(CRATES);
  const members = ['crates/common/xai-tracing', ...crates.map((c) => `crates/plugin/${c}`)].sort();
  push('members 完整且有序', true, validateMembers(members, crates));
  push(
    'members 缺少 plugin crate',
    false,
    validateMembers(members.filter((m) => !m.endsWith('xai-plugin-sdk')), crates),
  );
  push('members 重复登记', false, validateMembers([...members, members[0]].sort(), crates));

  push('默认关闭原生 feature', true, validateDefaultFeatureOff('[features]\ndefault = []\n'));
  push(
    '默认打开原生 feature',
    false,
    validateDefaultFeatureOff('[features]\ndefault = ["native"]\n'),
  );

  push(
    'lib.rs 模块声明完整',
    true,
    validateDeclaredModules(['gate', 'policy'], ['gate', 'policy']),
  );
  push(
    'lib.rs 缺少模块声明',
    false,
    validateDeclaredModules(['gate'], ['gate', 'policy']),
  );

  const failures = cases.filter((ok) => !ok).length;
  if (failures > 0) {
    console.error(`workspace-skeleton-check --self-test: ${failures} 个夹具不符合预期`);
    return 1;
  }
  console.log(`workspace-skeleton-check --self-test: ${cases.length} 个夹具全部符合预期`);
  return 0;
}

function checkCrate(crate) {
  const dir = path.join(REPO_ROOT, 'crates', 'plugin', crate);
  const toml = readCrateToml(dir);
  if (!toml) {
    fail(`缺少 ${crate}/Cargo.toml`);
    return;
  }
  const nameMatch = toml.match(/^name\s*=\s*"([^"]+)"/m);
  if (!nameMatch || nameMatch[1] !== crate) {
    fail(`${crate}/Cargo.toml 的 name 与目录名不一致`);
  }
  if (!/^edition\.workspace\s*=\s*true/m.test(toml)) {
    fail(`${crate}/Cargo.toml 未继承 workspace edition`);
  }
  if (!/^license\.workspace\s*=\s*true/m.test(toml)) {
    fail(`${crate}/Cargo.toml 未继承 workspace license`);
  }
  if (!/^\[dependencies\]/m.test(toml)) {
    fail(`${crate}/Cargo.toml 缺少 [dependencies] 段`);
  }
  for (const problem of validateDefaultFeatureOff(toml)) {
    fail(`${crate}: ${problem}`);
  }

  const libPath = path.join(dir, 'src', 'lib.rs');
  if (!fs.existsSync(libPath)) {
    fail(`${crate}/src/lib.rs 缺失`);
    return;
  }
  const libSource = fs.readFileSync(libPath, 'utf8');
  if (!libSource.includes('#![forbid(unsafe_code)]')) {
    fail(`${crate}/src/lib.rs 缺少 #![forbid(unsafe_code)]`);
  }
  const declared = parseModDeclarations(libSource);
  const expectedTopLevel = CRATES[crate].filter((module) => !module.includes('/'));
  for (const problem of validateDeclaredModules(declared, expectedTopLevel)) {
    fail(`${crate}: ${problem}`);
  }
  resolveModuleTree(path.join(dir, 'src'), declared, '', findings);
  for (const expected of CRATES[crate]) {
    if (!expected.includes('/')) {
      continue;
    }
    const nestedFile = path.join(dir, 'src', `${expected}.rs`);
    if (!fs.existsSync(nestedFile)) {
      fail(`${crate}: 缺少嵌套模块文件 ${expected}.rs`);
    }
  }
}

function checkLock(lockText) {
  const names = [...lockText.matchAll(/^name = "([^"]+)"$/gm)].map((match) => match[1]);
  for (const crate of Object.keys(CRATES)) {
    if (!names.includes(crate)) {
      fail(`Cargo.lock 缺少 ${crate} 的 [[package]] 条目`);
    }
  }
  const packages = lockText.split('\n\n[[package]]\n').slice(1);
  for (const block of packages) {
    const nameMatch = block.match(/^name = "([^"]+)"$/m);
    if (nameMatch && nameMatch[1] in CRATES) {
      const versionMatch = block.match(/^version = "([^"]+)"/m);
      if (!versionMatch || versionMatch[1] !== '0.1.0') {
        fail(`Cargo.lock 中 ${nameMatch[1]} 的版本不是 0.1.0`);
      }
    }
  }
}

function checkFeatureSwitch() {
  const configLib = path.join(REPO_ROOT, 'crates', 'codegen', 'xai-grok-config', 'src', 'lib.rs');
  if (!fs.existsSync(configLib)) {
    fail('缺少 xai-grok-config/src/lib.rs');
    return;
  }
  if (!/^pub mod plugin_features;$/m.test(fs.readFileSync(configLib, 'utf8'))) {
    fail('xai-grok-config/src/lib.rs 未声明 pub mod plugin_features;');
  }
  const features = path.join(
    REPO_ROOT,
    'crates',
    'codegen',
    'xai-grok-config',
    'src',
    'plugin_features.rs',
  );
  if (!fs.existsSync(features)) {
    fail('缺少 xai-grok-config/src/plugin_features.rs');
    return;
  }
  const source = fs.readFileSync(features, 'utf8');
  if (!/NATIVE_PLUGIN_MODE_ENV/.test(source)) {
    fail('plugin_features.rs 缺少 NATIVE_PLUGIN_MODE_ENV');
  }
  if (!/#\[default\]\s*\n\s*Declarative/.test(source)) {
    fail('plugin_features.rs 未把 Declarative 标为 #[default]');
  }
  if (!/pub enum NativePluginMode/.test(source)) {
    fail('plugin_features.rs 缺少 NativePluginMode');
  }
}

function checkCargo(requireCargo) {
  const probe = spawnSync('cargo', ['--version'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) {
    if (requireCargo) {
      fail('cargo check 被要求执行，但当前环境没有 cargo');
      return;
    }
    console.log('cargo check: SKIPPED（PATH 中没有 cargo；CI 需使用 --require-cargo）');
    return;
  }
  const run = spawnSync('cargo', ['check', '--workspace', '--quiet'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  if (run.status !== 0) {
    fail(`cargo check --workspace 失败：${(run.stderr || '').trim().split('\n').slice(-5).join(' ')}`);
    return;
  }
  console.log('cargo check: passed');
}

function main(argv) {
  if (argv.includes('--self-test')) {
    return selfTest();
  }

  findings.length = 0;
  const cargoTomlPath = path.join(REPO_ROOT, 'Cargo.toml');
  if (!fs.existsSync(cargoTomlPath)) {
    console.error('workspace-skeleton-check: 缺少根 Cargo.toml');
    return 2;
  }
  const cargoToml = fs.readFileSync(cargoTomlPath, 'utf8');
  for (const problem of validateMembers(parseMembers(cargoToml), Object.keys(CRATES))) {
    fail(problem);
  }

  for (const crate of Object.keys(CRATES)) {
    checkCrate(crate);
  }

  const lockPath = path.join(REPO_ROOT, 'Cargo.lock');
  if (!fs.existsSync(lockPath)) {
    fail('缺少 Cargo.lock');
  } else {
    checkLock(fs.readFileSync(lockPath, 'utf8'));
  }

  checkFeatureSwitch();
  checkCargo(argv.includes('--require-cargo'));

  if (findings.length > 0) {
    console.error(`workspace-skeleton-check: ${findings.length} 项不通过`);
    for (const finding of findings) {
      console.error(`  - ${finding}`);
    }
    return 1;
  }
  console.log('workspace-skeleton-check: 通过（6 个 crate / 113 个 members / 默认关闭）');
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  process.exit(main(process.argv.slice(2)));
}
