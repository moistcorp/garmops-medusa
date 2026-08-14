#!/usr/bin/env bash
set -euo pipefail

compose_project="garmops-stage41-browser"
compose_file="docker-compose.browser.yml"
frontend_dir="${GARMOPS_FRONTEND_DIR:-/Users/rahul/garmops}"
backend_port="${E2E_BACKEND_PORT:-19000}"
backend_pid=""
key_output="$(mktemp)"
backend_log="$(mktemp)"

stop_isolated_services() {
  docker compose -p "$compose_project" -f "$compose_file" down -v --remove-orphans >/dev/null 2>&1 || true
}

cleanup() {
  status=$?
  if [ -n "$backend_pid" ]; then
    kill "$backend_pid" >/dev/null 2>&1 || true
    wait "$backend_pid" >/dev/null 2>&1 || true
  fi
  if [ "$status" -ne 0 ] && [ -f "$backend_log" ]; then
    echo "--- isolated backend log (last 160 lines) ---" >&2
    tail -n 160 "$backend_log" >&2 || true
  fi
  rm -f "$key_output" "$backend_log"
  stop_isolated_services
  return "$status"
}
trap cleanup EXIT INT TERM

docker compose -p "$compose_project" -f "$compose_file" down -v --remove-orphans >/dev/null 2>&1 || true
docker compose -p "$compose_project" -f "$compose_file" up -d --wait

postgres_container="$(docker compose -p "$compose_project" -f "$compose_file" ps -q postgres)"
docker exec "$postgres_container" createdb -U garmops_browser medusa-garmops-stage41-browser

export NODE_ENV=test
export PORT="$backend_port"
export DATABASE_URL="postgres://garmops_browser:garmops_browser_only@127.0.0.1:55433/medusa-garmops-stage41-browser"
export REDIS_URL=redis://127.0.0.1:56379/15
export CACHE_REDIS_URL="$REDIS_URL"
export LOCKING_REDIS_URL="$REDIS_URL"
export JWT_SECRET=stage41-browser-jwt-secret
export COOKIE_SECRET=stage41-browser-cookie-secret
export AUTH_MFA_ENCRYPTION_KEY=stage41-browser-mfa-secret
export STORE_CORS=http://127.0.0.1:13000,http://127.0.0.1:13001
export AUTH_CORS="$STORE_CORS"
export ADMIN_CORS="http://127.0.0.1:$backend_port"
export PAYU_ENV=test
export PAYU_KEY=stage41-browser-payu-key
export PAYU_SALT=stage41-browser-payu-salt
export EXPOSE_TEST_OTP=true
export GARMOPS_TEST_DOUBLES=true
export R2_PRIVATE_BUCKET=garmops-stage41-browser-private
export R2_PUBLIC_BUCKET=garmops-stage41-browser-public
export MALWARE_SCANNER_HOST=127.0.0.1
export MALWARE_SCANNER_PORT=1

npm run db:migrate --workspace @garmops/backend
npm run seed:garmops --workspace @garmops/backend
npm run setup:publishable-key --workspace @garmops/backend > "$key_output"
export MEDUSA_PUBLISHABLE_API_KEY="$(sed -n 's/^PUBLISHABLE_API_KEY=//p' "$key_output")"
if [ -z "$MEDUSA_PUBLISHABLE_API_KEY" ]; then
  echo "Could not obtain the isolated publishable API key" >&2
  exit 1
fi

export E2E_CUSTOMER_EMAIL="e2e-customer@example.test"
export E2E_FOUNDER_EMAIL="e2e-founder@example.test"
export E2E_FOUNDER_PASSWORD="stage41-founder-password"
export E2E_OPERATIONS_EMAIL="e2e-operations@example.test"
export E2E_OPERATIONS_PASSWORD="stage41-operations-password"
printf '%s\n' "$E2E_FOUNDER_PASSWORD" | npm run staff:create --workspace @garmops/backend -- --email "$E2E_FOUNDER_EMAIL" --role founder --display-name Founder --password-stdin
printf '%s\n' "$E2E_OPERATIONS_PASSWORD" | npm run staff:create --workspace @garmops/backend -- --email "$E2E_OPERATIONS_EMAIL" --role operations --display-name Operations --password-stdin

npm run dev --workspace @garmops/backend -- --host 127.0.0.1 --port "$backend_port" > "$backend_log" 2>&1 &
backend_pid=$!
for attempt in $(seq 1 90); do
  if curl --silent --fail "http://127.0.0.1:$backend_port/health" | rg -q '^OK$'; then break; fi
  if [ "$attempt" = "90" ]; then
    sed -n '1,240p' "$backend_log" >&2
    exit 1
  fi
  sleep 1
done

cd "$frontend_dir"
customer_args=(--project=chromium --grep-invert "Founder|Operations")
if [ -n "${E2E_CUSTOMER_GREP:-}" ]; then
  customer_args+=(--grep "$E2E_CUSTOMER_GREP")
fi
if [ "${E2E_UPDATE_SNAPSHOTS:-false}" = "true" ]; then
  customer_args+=(--update-snapshots)
fi
if [ "${E2E_ONLY_STAFF:-false}" != "true" ] && [ "${E2E_SKIP_CUSTOMER:-false}" != "true" ]; then
  NEXT_PUBLIC_MEDUSA_BACKEND_URL="http://127.0.0.1:$backend_port" \
  NEXT_PUBLIC_ACCOUNTS_ENABLED=true \
  STAFF_PORTAL_ENABLED=true \
  GARMOPS_E2E=true \
  PORT=13000 \
  PLAYWRIGHT_BASE_URL=http://127.0.0.1:13000 \
  PLAYWRIGHT_BROWSER_MATRIX=false \
  npm run e2e -- "${customer_args[@]}"
fi

if [ "${E2E_ONLY_CUSTOMER:-false}" = "true" ]; then
  stop_isolated_services
  exit 0
fi

if [ "${E2E_SKIP_STAFF:-false}" != "true" ]; then
  NEXT_PUBLIC_APP_SURFACE=staff \
  NEXT_PUBLIC_MEDUSA_BACKEND_URL="http://127.0.0.1:$backend_port" \
  NEXT_PUBLIC_ACCOUNTS_ENABLED=false \
  STAFF_PORTAL_ENABLED=true \
  GARMOPS_E2E=false \
  PORT=13001 \
  PLAYWRIGHT_BASE_URL=http://127.0.0.1:13001 \
  PLAYWRIGHT_BROWSER_MATRIX=false \
  npm run e2e -- --project=chromium --grep "Founder|Operations"
fi

if [ "${E2E_ONLY_STAFF:-false}" = "true" ]; then
  stop_isolated_services
  exit 0
fi

NEXT_PUBLIC_MEDUSA_BACKEND_URL="http://127.0.0.1:$backend_port" \
NEXT_PUBLIC_ACCOUNTS_ENABLED=true \
STAFF_PORTAL_ENABLED=true \
GARMOPS_E2E=true \
PORT=13000 \
PLAYWRIGHT_BASE_URL=http://127.0.0.1:13000 \
PLAYWRIGHT_BROWSER_MATRIX=true \
npx playwright test e2e/authenticated-critical.spec.ts --grep "customer"
stop_isolated_services
