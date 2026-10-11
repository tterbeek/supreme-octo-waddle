#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
baseline_file="$repo_root/supabase/remote-schema-baseline.sql"
config_file="$repo_root/supabase/config.toml"
temp_root="$(mktemp -d "${TMPDIR:-/tmp}/movenotes-schema-XXXXXX")"
local_project="$temp_root/project"
local_supabase="$local_project/supabase"
stack_started=0

cleanup() {
  if [[ "$stack_started" -eq 1 ]]; then
    (
      cd "$local_project"
      npx supabase stop >/dev/null || true
    )
  fi
  rm -rf "$temp_root"
}

trap cleanup EXIT INT TERM

if [[ ! -f "$baseline_file" ]]; then
  echo "Missing schema baseline: $baseline_file" >&2
  exit 1
fi

if [[ ! -f "$config_file" ]]; then
  echo "Missing Supabase config: $config_file" >&2
  exit 1
fi

mkdir -p "$local_supabase/migrations"
cp "$config_file" "$local_supabase/config.toml"
cp "$baseline_file" \
  "$local_supabase/migrations/00000000000000_remote_schema_baseline.sql"

echo "Starting isolated local Supabase stack..."
(
  cd "$local_project"
  npx supabase start
)
stack_started=1

echo "Resetting local database from the remote schema baseline..."
(
  cd "$local_project"
  npx supabase db reset --local --no-seed
)

echo "Local schema verification passed. No hosted Supabase project was changed."
