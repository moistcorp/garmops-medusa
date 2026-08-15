import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/** Server-side checkout idempotency records for retried sample submissions. */
export class Migration20260815000000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      create table if not exists "checkout_idempotency" (
        "id" text not null primary key,
        "key" text not null unique,
        "customer_id" text not null,
        "request_fingerprint" text not null,
        "cart_id" text not null,
        "status" text not null default 'prepared',
        "result" jsonb null,
        "expires_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null
      );
      create index if not exists "IDX_checkout_idempotency_customer" on "checkout_idempotency" ("customer_id");
    `)
  }

  async down(): Promise<void> {
    this.addSql(`drop table if exists "checkout_idempotency" cascade;`)
  }
}
