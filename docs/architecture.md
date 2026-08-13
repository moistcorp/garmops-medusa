# Architecture

```text
garmops
Next.js frontend
      │
      ▼
garmops-medusa
Medusa backend
      │
      ├── Garmops module: catalog, designs, snapshots, production, files, audit
      ├── Medusa Auth: customer Google and staff email/password providers
      ├── Medusa Payment: PayU provider and signed callback event intake
      ├── Medusa Notification: Resend provider
      ├── Neon PostgreSQL
      ├── Redis
      └── Cloudflare R2 (private signed uploads/downloads)
```

Medusa will become the authoritative backend. The Garmops frontend remains a
separate repository and communicates with this backend over its HTTP APIs.

Neon PostgreSQL is the authoritative relational database, accessed by Medusa
through the standard `DATABASE_URL` PostgreSQL connection string. Redis holds
infrastructure and runtime state such as sessions, caching, events, workflow
execution, and locking. Cloudflare R2 owns persistent binary files; PostgreSQL
stores their authoritative metadata and scan/finalization state. PayU, Resend,
and Google are optional environment-configured integrations.
VM/container compute must remain replaceable, and no business data should
depend exclusively on a specific VM disk.

Medusa owns catalog/product records, server-side pricing validation,
customer-owned design versions, immutable order configuration snapshots,
production transitions, payment event idempotency, and operational audit
metadata. The frontend remains read-only from this repository’s perspective.
