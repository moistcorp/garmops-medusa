import { loadEnv, defineConfig, Modules, ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { GARMOPS_MODULE } from './src/modules/garmops'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

const databaseSslMode = process.env.DATABASE_SSL_MODE?.trim().toLowerCase()
const databaseDriverOptions = databaseSslMode === 'disable'
  ? { connection: { ssl: false } }
  : databaseSslMode === 'require'
    ? { connection: { ssl: { rejectUnauthorized: false } } }
    : undefined

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    ...(databaseDriverOptions ? { databaseDriverOptions } : {}),
    redisUrl: process.env.REDIS_URL,
    workerMode:
      (process.env.MEDUSA_WORKER_MODE as 'shared' | 'server' | 'worker') ||
      'shared',
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      authMethodsPerActor: {
        user: ['emailpass'],
        customer: ['emailotp', 'google'],
      },
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    },
  },
  admin: {
    disable: process.env.DISABLE_MEDUSA_ADMIN === 'true',
    backendUrl: process.env.MEDUSA_BACKEND_URL,
    vite: (config) => ({
      ...config,
      server: {
        ...config.server,
        host: '0.0.0.0',
        allowedHosts: ['localhost', '.localhost', '127.0.0.1'],
        hmr: {
          port: 5173,
          clientPort: 5173,
        },
      },
    }),
  },
  modules: [
    {
      resolve: '@medusajs/medusa/auth',
      dependencies: [Modules.CACHE, Modules.CUSTOMER, GARMOPS_MODULE, ContainerRegistrationKeys.LOGGER],
      options: {
        mfa: { encryption_key: process.env.AUTH_MFA_ENCRYPTION_KEY || process.env.JWT_SECRET || 'development-only-mfa-key' },
        providers: [
          { resolve: '@medusajs/medusa/auth-emailpass', id: 'emailpass' },
          { resolve: './src/providers/email-otp', id: 'emailotp' },
          { resolve: '@medusajs/medusa/auth-google', id: 'google', options: { clientId: process.env.GOOGLE_CLIENT_ID || 'not-configured', clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'not-configured', callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/callback' } },
        ],
      },
    },
    {
      resolve: '@medusajs/medusa/notification',
      options: { providers: [{ resolve: './src/providers/resend', id: 'resend', options: { apiKey: process.env.RESEND_API_KEY, from: process.env.RESEND_FROM, channels: ['email'] } }] },
    },
    {
      resolve: '@medusajs/medusa/payment',
      options: {
        providers: [
          { resolve: './src/providers/payu', options: { key: process.env.PAYU_KEY, salt: process.env.PAYU_SALT, environment: process.env.PAYU_ENV || 'test', callbackUrl: process.env.PAYU_CALLBACK_URL } },
        ],
      },
    },
    {
      resolve: './src/modules/garmops',
    },
    {
      resolve: '@medusajs/medusa/caching',
      options: {
        providers: [
          {
            resolve: '@medusajs/caching-redis',
            id: 'caching-redis',
            is_default: true,
            options: {
              redisUrl: process.env.CACHE_REDIS_URL || process.env.REDIS_URL,
            },
          },
        ],
      },
    },
    {
      resolve: '@medusajs/medusa/event-bus-redis',
      options: {
        redisUrl: process.env.REDIS_URL,
      },
    },
    {
      resolve: '@medusajs/medusa/workflow-engine-redis',
      options: {
        redis: {
          redisUrl: process.env.REDIS_URL,
        },
      },
    },
    {
      resolve: '@medusajs/medusa/locking',
      options: {
        providers: [
          {
            resolve: '@medusajs/medusa/locking-redis',
            id: 'locking-redis',
            is_default: true,
            options: {
              redisUrl: process.env.LOCKING_REDIS_URL || process.env.REDIS_URL,
            },
          },
        ],
      },
    },
  ],
})
