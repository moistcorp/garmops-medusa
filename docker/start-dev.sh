#!/bin/sh
set -eu

npm run db:migrate --workspace @garmops/backend
exec npm run dev --workspace @garmops/backend -- --host 0.0.0.0 --port "${PORT:-9000}"
