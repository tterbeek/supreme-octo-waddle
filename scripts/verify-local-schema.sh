#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
migrations_dir="$repo_root/supabase/migrations"
config_file="$repo_root/supabase/config.toml"
seed_file="$repo_root/supabase/seed.sql"
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

if [[ ! -d "$migrations_dir" ]] || [[ -z "$(find "$migrations_dir" -maxdepth 1 -type f -name '*.sql' -print -quit)" ]]; then
  echo "No active Supabase migrations found: $migrations_dir" >&2
  exit 1
fi

if [[ ! -f "$config_file" ]]; then
  echo "Missing Supabase config: $config_file" >&2
  exit 1
fi

if [[ ! -f "$seed_file" ]]; then
  echo "Missing Supabase seed file: $seed_file" >&2
  exit 1
fi

mkdir -p "$local_supabase/migrations"
cp "$config_file" "$local_supabase/config.toml"
cp "$migrations_dir"/*.sql "$local_supabase/migrations/"
cp "$seed_file" "$local_supabase/seed.sql"

echo "Starting isolated local Supabase stack..."
(
  cd "$local_project"
  npx supabase start
)
stack_started=1

echo "Resetting local database from repository migrations..."
(
  cd "$local_project"
  npx supabase db reset --local
)

echo "Local schema verification passed. No hosted Supabase project was changed."
