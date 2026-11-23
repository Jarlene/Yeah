#!/usr/bin/env bash
# License / NOTICE / clean-room gate for the plugin-native migration (TASK-004).
#
# Offline by design: reads only files inside the repository tree. Fails closed
# when the NOTICE, the deny.toml allow-list, the clean-room record, or the
# third-party baseline is missing or inconsistent.
#
# Usage:
#   scripts/ci/license-check.sh
#   scripts/ci/license-check.sh --root /path/to/repo
#   scripts/ci/license-check.sh --self-test
#
# Exit codes: 0 = pass, 1 = rejected, 2 = usage error.

set -euo pipefail

FORBIDDEN_LICENSES=(
  "GPL-2.0"
  "GPL-2.0-only"
  "GPL-2.0-or-later"
  "GPL-3.0"
  "GPL-3.0-only"
  "GPL-3.0-or-later"
  "AGPL-3.0"
  "AGPL-3.0-only"
  "AGPL-3.0-or-later"
  "SSPL-1.0"
  "BUSL-1.1"
  "Commons-Clause"
)

failures=0

fail() {
  printf '  - %s\n' "$1" >&2
  failures=$((failures + 1))
}

have() {
  grep -qF -- "$2" "$1" 2>/dev/null
}

check_notice() {
  local root="$1"
  local notice="$root/NOTICE"
  if [[ ! -f "$notice" ]]; then
    fail "缺少 NOTICE"
    return
  fi
  if [[ ! -s "$notice" ]]; then
    fail "NOTICE 为空"
    return
  fi
  have "$notice" "pi-rust" || fail "NOTICE 缺少 pi-rust 来源说明"
  have "$notice" "MIT" || fail "NOTICE 缺少 MIT attribution"
  have "$notice" "Copyright" || fail "NOTICE 缺少 Copyright 行"
  if ! grep -Eq '^[[:space:]]*License:[[:space:]]*MIT' "$notice"; then
    fail "NOTICE 未在归属段写明 License: MIT"
  fi
  if ! grep -Eq '^[[:space:]]*Attribution:[[:space:]]*[^[:space:]]' "$notice"; then
    fail "NOTICE 缺少非空 Attribution 行"
  fi
}

check_deny() {
  local root="$1"
  local deny="$root/deny.toml"
  if [[ ! -f "$deny" ]]; then
    fail "缺少 deny.toml"
    return
  fi
  if ! grep -Eq '^\[licenses\]' "$deny"; then
    fail "deny.toml 缺少 [licenses] 段"
    return
  fi
  local allow_block
  allow_block="$(awk '/^\[licenses\]/{flag=1} /^\[/{if (flag && $0 !~ /^\[licenses\]/) exit} flag' "$deny")"
  if ! printf '%s' "$allow_block" | grep -Eq 'allow[[:space:]]*=[[:space:]]*\['; then
    fail "deny.toml 的 [licenses] 缺少 allow 列表"
    return
  fi
  local license
  for license in "${FORBIDDEN_LICENSES[@]}"; do
    if printf '%s' "$allow_block" | grep -qF "\"$license\""; then
      fail "deny.toml allow 列表包含禁止许可证 $license"
    fi
  done
}

check_clean_room() {
  local root="$1"
  local record="$root/docs/legal/clean-room-record.md"
  if [[ ! -f "$record" ]]; then
    fail "缺少 docs/legal/clean-room-record.md"
    return
  fi
  if ! grep -Eq '未复制[^。\n]*pi-rust|no pi-rust source code has been copied' "$record"; then
    fail "clean-room 记录未明确声明未复制 pi-rust 代码"
  fi
  if ! grep -Eq 'TASK-004' "$record"; then
    fail "clean-room 记录未标注所属门禁任务 TASK-004"
  fi
}

check_third_party_baseline() {
  local root="$1"
  local baseline="$root/docs/legal/third-party-baseline.md"
  if [[ ! -f "$baseline" ]]; then
    fail "缺少 docs/legal/third-party-baseline.md"
    return
  fi
  local license
  for license in "${FORBIDDEN_LICENSES[@]}"; do
    if grep -qF "| $license" "$baseline" || grep -qF "| $license |" "$baseline"; then
      fail "依赖基线声明了禁止许可证 $license"
    fi
  done
  have "$baseline" "pi-rust" || fail "依赖基线缺少 pi-rust 条目"
  have "$baseline" "MIT" || fail "依赖基线缺少 MIT 许可结论"
}

check_no_secrets() {
  local root="$1"
  local targets=("$root/NOTICE" "$root/deny.toml" "$root/docs/legal" "$root/scripts/ci")
  local hit
  hit="$(grep -REn 'gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{20,}' "${targets[@]}" 2>/dev/null || true)"
  if [[ -n "$hit" ]]; then
    fail "检测到疑似凭据写入交付文件"
  fi
}

run_checks() {
  local root="$1"
  failures=0
  check_notice "$root"
  check_deny "$root"
  check_clean_room "$root"
  check_third_party_baseline "$root"
  check_no_secrets "$root"
  if [[ "$failures" -gt 0 ]]; then
    printf 'license-check: %s 项不通过（root=%s）\n' "$failures" "$root" >&2
    return 1
  fi
  printf 'license-check: 通过（root=%s）\n' "$root"
  return 0
}

write_valid_fixture() {
  local root="$1"
  mkdir -p "$root/docs/legal" "$root/scripts/ci"
  cat >"$root/NOTICE" <<'EOF'
Yeah
Copyright 2026 Yeah contributors

Third-party components
pi-rust (https://github.com/bigfish1913/pi-rust)
License: MIT
Copyright: see upstream LICENSE
Attribution: design reference for the plugin mechanism migration.
EOF
  cat >"$root/deny.toml" <<'EOF'
[licenses]
version = 2
allow = ["Apache-2.0", "MIT"]
EOF
  cat >"$root/docs/legal/clean-room-record.md" <<'EOF'
# Clean-room record (TASK-004)

截至本记录，未复制任何 pi-rust 代码。
EOF
  cat >"$root/docs/legal/third-party-baseline.md" <<'EOF'
| 组件 | 许可 |
| --- | --- |
| pi-rust | MIT |
EOF
}

self_test() {
  local workdir
  workdir="$(mktemp -d)"
  trap 'rm -rf "${workdir:-}"' EXIT

  local case_root="$workdir/valid"
  write_valid_fixture "$case_root"
  if ! run_checks "$case_root" >/dev/null 2>&1; then
    echo "FAIL  合法依赖/完整声明应通过" >&2
    return 1
  fi
  echo "ok    合法依赖/完整声明"

  local expected_failures=(
    "missing-notice"
    "empty-attribution"
    "forbidden-license"
    "missing-clean-room"
  )

  for name in "${expected_failures[@]}"; do
    case_root="$workdir/$name"
    write_valid_fixture "$case_root"
    case "$name" in
      missing-notice)
        rm -f "$case_root/NOTICE"
        ;;
      empty-attribution)
        sed -i 's/^Attribution:.*/Attribution:/' "$case_root/NOTICE"
        ;;
      forbidden-license)
        sed -i 's/allow = \["Apache-2.0", "MIT"\]/allow = ["Apache-2.0", "MIT", "GPL-3.0"]/' "$case_root/deny.toml"
        ;;
      missing-clean-room)
        rm -f "$case_root/docs/legal/clean-room-record.md"
        ;;
    esac
    if run_checks "$case_root" >/dev/null 2>&1; then
      echo "FAIL  夹具 $name 应失败但通过了" >&2
      return 1
    fi
    echo "ok    夹具 $name 按预期失败"
  done

  echo "license-check --self-test: 5 个夹具全部符合预期"
  return 0
}

main() {
  local root=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --self-test)
        self_test
        return $?
        ;;
      --root)
        if [[ $# -lt 2 ]]; then
          echo "用法：license-check.sh --root <path>" >&2
          return 2
        fi
        root="$2"
        shift 2
        ;;
      *)
        echo "未知参数：$1" >&2
        return 2
        ;;
    esac
  done

  if [[ -z "$root" ]]; then
    root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
  fi
  if [[ ! -d "$root" ]]; then
    echo "license-check: root 不存在：$root" >&2
    return 2
  fi
  run_checks "$root"
}

main "$@"
