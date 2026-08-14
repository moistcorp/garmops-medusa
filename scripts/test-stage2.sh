#!/usr/bin/env bash
set -euo pipefail

compose_file="docker-compose.test.yml"
cleanup() {
  docker compose -f "$compose_file" down -v --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker compose -f "$compose_file" up -d --wait postgres

export NODE_ENV=test
export DB_HOST=localhost
export DB_PORT=55432
export DB_USERNAME=garmops_test
export DB_PASSWORD=garmops_test_only
export DATABASE_URL="postgres://garmops_test:garmops_test_only@localhost:55432/medusa-garmops-stage2-integration-1"
export REDIS_URL="${E2E_REDIS_URL:-redis://127.0.0.1:6379/15}"
export CACHE_REDIS_URL="$REDIS_URL"
export LOCKING_REDIS_URL="$REDIS_URL"
export JWT_SECRET="${E2E_JWT_SECRET:-stage2-e2e-jwt-secret-change-me}"
export COOKIE_SECRET="${E2E_COOKIE_SECRET:-stage2-e2e-cookie-secret-change-me}"
export AUTH_MFA_ENCRYPTION_KEY="${E2E_MFA_KEY:-stage2-e2e-mfa-secret-change-me}"
export PAYU_ENV=test
export PAYU_KEY="${E2E_PAYU_KEY:-stage2-test-key}"
export PAYU_SALT="${E2E_PAYU_SALT:-stage2-test-salt}"
export EXPOSE_TEST_OTP=true
export GARMOPS_TEST_DOUBLES=true
export R2_PRIVATE_BUCKET=garmops-e2e-private
export R2_PUBLIC_BUCKET=garmops-e2e-public

npm run test:unit --workspace @garmops/backend
npm run test:integration:http --workspace @garmops/backend
