#!/usr/bin/env bash
set -euo pipefail

repository_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
environment_file="${repository_dir}/.env.portable"
compose_file="${repository_dir}/docker-compose.portable.yml"
frontend_dir="$(cd "${repository_dir}/.." && pwd)/garmops"

if [[ ! -f "${environment_file}" ]]; then
  echo "Run ./scripts/portable-up.sh first." >&2
  exit 1
fi

compose=(docker compose)
for source_environment_file in "${repository_dir}/.env" "${frontend_dir}/.env.local" "${environment_file}"; do
  if [[ -f "${source_environment_file}" ]]; then
    compose+=(--env-file "${source_environment_file}")
  fi
done
compose+=(-f "${compose_file}")

"${compose[@]}" ps
"${compose[@]}" exec -T customer node --input-type=module -e '
  async function expectOk(label, url) {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`)
    return response
  }

  await expectOk("Medusa health", "http://medusa-server:9000/health")
  await expectOk("Medusa Admin", "http://medusa-server:9000/app")
  await expectOk("Customer configurator", "http://127.0.0.1:3000/configurator")
  await expectOk("Foundry login", "http://foundry:3000/login")

  const response = await expectOk(
    "Customer catalogue proxy",
    "http://127.0.0.1:3000/api/medusa/store/garmops/catalog",
  )
  const catalog = await response.json()
  if (!Array.isArray(catalog.products) || catalog.products.length !== 10) {
    throw new Error(`Expected 10 products; received ${catalog.products?.length ?? "an invalid response"}`)
  }
  console.log(`Catalog OK: ${catalog.products.length} products (${catalog.currencyCode})`)
'
echo "Customer, Foundry, Medusa, and catalog smoke checks passed."
