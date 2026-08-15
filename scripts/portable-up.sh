#!/usr/bin/env bash
set -euo pipefail

repository_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
frontend_dir="$(cd "${repository_dir}/.." && pwd)/garmops"
environment_file="${repository_dir}/.env.portable"
compose_file="${repository_dir}/docker-compose.portable.yml"
backend_environment_file="${repository_dir}/.env"
frontend_environment_file="${frontend_dir}/.env.local"

if [[ ! -f "${frontend_dir}/Dockerfile" ]]; then
  echo "Expected the garmops repository beside garmops-medusa at ${frontend_dir}." >&2
  exit 1
fi

random_secret() {
  od -An -N48 -tx1 /dev/urandom | tr -d ' \n'
}

if [[ ! -f "${environment_file}" ]]; then
  umask 077
  jwt_secret="$(random_secret)"
  cookie_secret="$(random_secret)"
  mfa_secret="$(random_secret)"
  {
    printf 'JWT_SECRET=%s\n' "${jwt_secret}"
    printf 'COOKIE_SECRET=%s\n' "${cookie_secret}"
    printf 'AUTH_MFA_ENCRYPTION_KEY=%s\n' "${mfa_secret}"
    printf 'DATABASE_SSL_MODE=require\n'
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

compose=(docker compose)
for source_environment_file in "${backend_environment_file}" "${frontend_environment_file}" "${environment_file}"; do
  if [[ -f "${source_environment_file}" ]]; then
    compose+=(--env-file "${source_environment_file}")
  fi
done
compose+=(-f "${compose_file}")

has_environment_value() {
  local setting_name="$1"
  local source_environment_file
  for source_environment_file in "${environment_file}" "${frontend_environment_file}" "${backend_environment_file}"; do
    if [[ -f "${source_environment_file}" ]] && awk -F= -v name="${setting_name}" '$1 == name && length(substr($0, index($0, "=") + 1)) > 0 { found=1 } END { exit(found ? 0 : 1) }' "${source_environment_file}"; then
      return 0
    fi
  done
  return 1
}

if ! has_environment_value DATABASE_URL; then
  echo "DATABASE_URL is required. Add the Neon connection string to .env.portable or .env." >&2
  exit 1
fi

if ! has_environment_value MEDUSA_PUBLISHABLE_API_KEY; then
  echo "MEDUSA_PUBLISHABLE_API_KEY is required. Add the Neon-linked key to .env.portable or ../garmops/.env.local." >&2
  exit 1
fi

cloudflare_dir="${CLOUDFLARE_CONFIG_DIR:-${repository_dir}/cloudflare}"
tunnel_mode="${PORTABLE_WITH_TUNNEL:-auto}"

if [[ "${tunnel_mode}" != "auto" && "${tunnel_mode}" != "0" && "${tunnel_mode}" != "1" ]]; then
  echo "PORTABLE_WITH_TUNNEL must be auto, 0, or 1." >&2
  exit 1
fi

if [[ "${tunnel_mode}" == "1" && ! -f "${cloudflare_dir}/config.yml" ]]; then
  echo "Tunnel requested, but ${cloudflare_dir}/config.yml does not exist." >&2
  echo "Run ./scripts/portable-tunnel-import.sh or install the tunnel files first." >&2
  exit 1
fi

if [[ "${tunnel_mode}" == "1" || ( "${tunnel_mode}" == "auto" && -f "${cloudflare_dir}/config.yml" ) ]]; then
  export CLOUDFLARE_CONFIG_DIR="${cloudflare_dir}"
  compose+=(--profile tunnel)
  echo "Cloudflare Tunnel enabled from ${cloudflare_dir}."
fi

"${compose[@]}" up --build -d --wait

echo "Garmops customer: http://localhost:3000/configurator"
echo "Garmops Foundry:  http://localhost:3001"
echo "Medusa Admin:     http://localhost:9000/app"
echo "Medusa health:    http://localhost:9000/health"
