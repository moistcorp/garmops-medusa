#!/usr/bin/env bash
set -euo pipefail

repository_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
frontend_dir="$(cd "${repository_dir}/.." && pwd)/garmops"
environment_file="${repository_dir}/.env.portable"
compose_file="${repository_dir}/docker-compose.portable.yml"

if [[ ! -f "${frontend_dir}/Dockerfile" ]]; then
  echo "Expected the garmops repository beside garmops-medusa at ${frontend_dir}." >&2
  exit 1
fi

random_secret() {
  od -An -N48 -tx1 /dev/urandom | tr -d ' \n'
}

if [[ ! -f "${environment_file}" ]]; then
  umask 077
  postgres_password="$(random_secret)"
  jwt_secret="$(random_secret)"
  cookie_secret="$(random_secret)"
  mfa_secret="$(random_secret)"
  {
    printf 'POSTGRES_DB=garmops\n'
    printf 'POSTGRES_USER=garmops\n'
    printf 'POSTGRES_PASSWORD=%s\n' "${postgres_password}"
    printf 'JWT_SECRET=%s\n' "${jwt_secret}"
    printf 'COOKIE_SECRET=%s\n' "${cookie_secret}"
    printf 'AUTH_MFA_ENCRYPTION_KEY=%s\n' "${mfa_secret}"
    printf 'DATABASE_SSL_MODE=disable\n'
    printf 'BIND_ADDRESS=127.0.0.1\n'
    printf 'CUSTOMER_APP_URL=http://localhost:3000\n'
    printf 'STAFF_APP_URL=http://localhost:3001\n'
    printf 'MEDUSA_PUBLIC_URL=http://localhost:9000\n'
    printf 'STORE_CORS=http://localhost:3000,http://localhost:3001,http://localhost:9000\n'
    printf 'ADMIN_CORS=http://localhost:9000\n'
    printf 'AUTH_CORS=http://localhost:3000,http://localhost:3001,http://localhost:9000\n'
  } >"${environment_file}"
  echo "Created ${environment_file} with random local infrastructure secrets."
fi

compose=(docker compose --env-file "${environment_file}" -f "${compose_file}")

if [[ "${PORTABLE_WITH_TUNNEL:-0}" == "1" ]]; then
  cloudflare_dir="${CLOUDFLARE_CONFIG_DIR:-${repository_dir}/cloudflare}"
  if [[ ! -f "${cloudflare_dir}/config.yml" ]]; then
    echo "Tunnel requested, but ${cloudflare_dir}/config.yml does not exist." >&2
    echo "Copy config.example.yml to config.yml and add the tunnel credential JSON first." >&2
    exit 1
  fi
  export CLOUDFLARE_CONFIG_DIR="${cloudflare_dir}"
  compose+=(--profile tunnel)
fi

"${compose[@]}" up --build -d --wait

echo "Garmops customer: http://localhost:3000/configurator"
echo "Garmops Foundry:  http://localhost:3001"
echo "Medusa Admin:     http://localhost:9000/app"
echo "Medusa health:    http://localhost:9000/health"
