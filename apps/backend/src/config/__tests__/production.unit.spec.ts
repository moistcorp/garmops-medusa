import { validateProductionEnvironment } from "../production"

const complete = {
  NODE_ENV: "production", DATABASE_URL: "postgres://db", REDIS_URL: "redis://redis", JWT_SECRET: "j".repeat(40), COOKIE_SECRET: "c".repeat(40), AUTH_MFA_ENCRYPTION_KEY: "m".repeat(40),
  PAYU_KEY: "payu-key", PAYU_SALT: "payu-salt", PAYU_ENV: "live", PAYU_CALLBACK_URL: "https://api.example.com/payments/payu/callback",
  R2_ACCOUNT_ID: "account", R2_ACCESS_KEY_ID: "access", R2_SECRET_ACCESS_KEY: "secret", R2_S3_ENDPOINT: "https://account.r2.cloudflarestorage.com", R2_PUBLIC_BUCKET: "public", R2_PRIVATE_BUCKET: "private",
  RESEND_API_KEY: "re_123", RESEND_FROM: "orders@example.com", GOOGLE_CLIENT_ID: "google-id", GOOGLE_CLIENT_SECRET: "google-secret", GOOGLE_CALLBACK_URL: "https://app.example.com/auth/callback",
  STORE_CORS: "https://app.example.com", ADMIN_CORS: "https://admin.example.com", AUTH_CORS: "https://app.example.com",
}

describe("production environment validation", () => {
  it("fails closed for missing critical settings", () => {
    expect(() => validateProductionEnvironment({ ...complete, AUTH_MFA_ENCRYPTION_KEY: undefined })).toThrow(/AUTH_MFA_ENCRYPTION_KEY/)
    expect(() => validateProductionEnvironment({ ...complete, PAYU_SALT: undefined })).toThrow(/PAYU_SALT/)
    expect(() => validateProductionEnvironment({ ...complete, PAYU_ENV: "sandbox" })).toThrow(/PAYU_ENV/)
  })

  it("accepts complete production configuration and ignores development gaps", () => {
    expect(() => validateProductionEnvironment(complete)).not.toThrow()
    expect(() => validateProductionEnvironment({ NODE_ENV: "development" })).not.toThrow()
  })
})
