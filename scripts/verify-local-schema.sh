#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
migrations_dir="$repo_root/supabase/migrations"
config_file="$repo_root/supabase/config.toml"
seed_file="$repo_root/supabase/seed.sql"
tests_dir="$repo_root/supabase/tests"
temp_root="$(mktemp -d "${TMPDIR:-/tmp}/movenotes-schema-XXXXXX")"
local_project="$temp_root/project"
local_supabase="$local_project/supabase"
verify_project_id="movenotes-schema-check"
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
# Use a separate identity and ports: never reset the developer's normal stack.
sed -E \
  -e '/^\[functions\./,/^$/d' \
  -e "s/^project_id = .*/project_id = \"$verify_project_id\"/" \
  -e 's/5432([0-9])/5532\1/g' \
  -e 's/54329/55329/g' \
  -e 's/8083/8183/g' \
  "$config_file" > "$local_supabase/config.toml"
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

if [[ -d "$tests_dir" ]]; then
  for test_file in "$tests_dir"/*.sql; do
    [[ -f "$test_file" ]] || continue
    echo "Checking database behavior: $(basename "$test_file")"
    docker exec -i "supabase_db_${verify_project_id}" \
      psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$test_file"
  done
fi

echo "Local schema verification passed. No hosted Supabase project was changed."
