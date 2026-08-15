#!/usr/bin/env bash
set -euo pipefail

repository_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_dir="${1:-${HOME}/.cloudflared}"
source_config="${source_dir}/config.yml"
destination_dir="${repository_dir}/cloudflare"

if [[ ! -f "${source_config}" ]]; then
  echo "Cloudflare config not found at ${source_config}." >&2
  exit 1
fi

tunnel_id="$(awk '/^[[:space:]]*tunnel:[[:space:]]*/ { sub(/^[[:space:]]*tunnel:[[:space:]]*/, ""); print; exit }' "${source_config}" | tr -d "\"'")"
if [[ ! "${tunnel_id}" =~ ^[0-9a-fA-F-]{36}$ ]]; then
  echo "Could not read a valid tunnel UUID from ${source_config}." >&2
  exit 1
fi

credential_source="${source_dir}/${tunnel_id}.json"
if [[ ! -f "${credential_source}" ]]; then
  echo "Tunnel credential not found at ${credential_source}." >&2
  exit 1
fi

install -d -m 700 "${destination_dir}"
install -m 600 "${credential_source}" "${destination_dir}/${tunnel_id}.json"

temporary_config="$(mktemp "${destination_dir}/config.yml.tmp.XXXXXX")"
chmod 600 "${temporary_config}"
printf 'tunnel: %s\ncredentials-file: /etc/cloudflared/%s.json\nurl: http://medusa-server:9000\n' \
  "${tunnel_id}" "${tunnel_id}" >"${temporary_config}"
mv "${temporary_config}" "${destination_dir}/config.yml"

echo "Installed Docker tunnel configuration in ${destination_dir}."
echo "The files are ignored by Git and must be transferred securely to a new VM."
