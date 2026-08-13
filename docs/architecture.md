# Architecture

```text
garmops
Next.js frontend
      │
      ▼
garmops-medusa
Medusa backend
      │
      ├── PostgreSQL
      ├── Redis
      └── future R2 / PayU / auth providers
```

Medusa will become the authoritative backend. The Garmops frontend remains a
separate repository and communicates with this backend over its HTTP APIs.

PostgreSQL is the authoritative relational database. Redis holds infrastructure
and runtime state such as sessions, caching, events, workflow execution, and
locking. Cloudflare R2 will later own persistent binary files. VM/container
compute must remain replaceable, and no business data should depend exclusively
on a specific VM disk.

This document describes the intended boundary only. No Stage 2 modules or
integrations are implemented.
