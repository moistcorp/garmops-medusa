#!/usr/bin/env bash
set -euo pipefail

repository_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
frontend_dir="$(cd "${repository_dir}/.." && pwd)/garmops"
compose_file="${repository_dir}/docker-compose.portable.yml"

compose=(docker compose)
for source_environment_file in "${repository_dir}/.env" "${frontend_dir}/.env.local" "${repository_dir}/.env.portable"; do
  if [[ -f "${source_environment_file}" ]]; then
    compose+=(--env-file "${source_environment_file}")
  fi
done
compose+=(-f "${compose_file}")

exec "${compose[@]}" "$@"
