const { MetadataStorage } = require("@medusajs/framework/mikro-orm/core")
const path = require("node:path")

MetadataStorage.clear()

if (process.env.NODE_ENV === "test" && process.env.DB_HOST && process.env.DB_PORT) {
  const databaseName = `medusa-garmops-stage2-integration-${process.env.JEST_WORKER_ID || "1"}`
  process.env.DATABASE_URL = `postgres://garmops_test:garmops_test_only@${process.env.DB_HOST}:${process.env.DB_PORT}/${databaseName}`
  // The compiled Medusa config resolves custom modules relative to its
  // compiled server directory, matching `medusa start`.
  process.chdir(path.resolve(__dirname, "..", ".medusa/server"))
}
