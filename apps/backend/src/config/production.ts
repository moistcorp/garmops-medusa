type Environment = Record<string, string | undefined>

const PLACEHOLDER = /^(?:replace-with|not-configured|development-only|change-me|local-|stage\d+-|your-)/i

function required(env: Environment, name: string, errors: string[]): string {
  const value = env[name]?.trim()
  if (!value || PLACEHOLDER.test(value)) errors.push(`Missing or invalid required environment variable: ${name}`)
  return value ?? ""
}

export function validateProductionEnvironment(env: Environment = process.env): void {
  if (env.NODE_ENV !== "production") return
  const errors: string[] = []
  for (const name of ["DATABASE_URL", "REDIS_URL", "JWT_SECRET", "COOKIE_SECRET", "AUTH_MFA_ENCRYPTION_KEY", "PAYU_KEY", "PAYU_SALT", "PAYU_CALLBACK_URL", "PAYU_BROWSER_RETURN_URL", "TURNSTILE_SECRET_KEY", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_S3_ENDPOINT", "R2_PUBLIC_BUCKET", "R2_PRIVATE_BUCKET", "RESEND_API_KEY", "RESEND_FROM", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_CALLBACK_URL"]) required(env, name, errors)
  for (const name of ["JWT_SECRET", "COOKIE_SECRET", "AUTH_MFA_ENCRYPTION_KEY"]) {
    if ((env[name]?.trim().length ?? 0) < 32) errors.push(`${name} must be at least 32 characters long`)
  }
  if (!env.PAYU_ENV?.trim() || !["test", "live"].includes(env.PAYU_ENV.trim())) errors.push("PAYU_ENV must be explicitly set to test or live")
  for (const name of ["STORE_CORS", "ADMIN_CORS", "AUTH_CORS"]) {
    const cors = env[name]?.trim()
    if (!cors || cors.split(",").some((origin) => origin.trim() === "*")) errors.push(`${name} must contain explicit origins and cannot be wildcard`
    )
  }
  if (errors.length) throw new Error(`Production environment validation failed:\n${errors.map((error) => `- ${error}`).join("\n")}`)
}
