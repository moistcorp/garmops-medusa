#!/bin/sh
set -eu

npm run predeploy
exec npm start
