# Dependency security audit

Audit date: 2026-08-14

Commands:

```bash
npm audit --omit=dev --json
npm audit --json
```

The current lockfile reports 0 critical, 68 high and 6 moderate findings in
the production-shaped audit graph, with 1,096 production dependencies. The
unfiltered graph reports the same 0 critical, 68 high and 6 moderate findings
across 1,503 total dependencies.

The high count is dominated by npm audit's advisory propagation through the
Medusa 2.19 dependency graph (`@medusajs/framework`, `@medusajs/medusa`, and
their module packages), plus the transitive `lodash` advisory. There are no
critical findings. The moderate findings include `ajv`, `bullmq`/`uuid`, and
RushStack tooling chains.

No blind `npm audit fix --force` was run. The Medusa packages are intentionally
kept on the mutually compatible 2.19.0 line. The remaining high findings need
an upstream Medusa-compatible release or a reviewed dependency-tree change;
forcing an override would risk the payment, workflow, and module runtime.
Before launch, re-run both commands after the next compatible Medusa upgrade
and separately verify whether the affected GraphQL/code-generation packages
are reachable in the production server image.
