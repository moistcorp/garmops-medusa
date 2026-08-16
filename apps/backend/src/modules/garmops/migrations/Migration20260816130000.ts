import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/** Adds retry scheduling and immutable line/refund identity boundaries. */
export class Migration20260816130000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      alter table "payment_event" add column if not exists "retry_count" integer not null default 0;
      alter table "payment_event" add column if not exists "next_attempt_at" timestamptz null;
      update "payment_event" set "next_attempt_at" = coalesce("next_attempt_at", "created_at") where "status" = 'artifact_pending';
      create index if not exists "IDX_payment_event_reconciliation" on "payment_event" ("status", "next_attempt_at", "created_at");
      create unique index if not exists "IDX_order_snapshot_order_line" on "order_configuration_snapshot" ("order_id", "line_item_id") where "line_item_id" is not null and "deleted_at" is null;
      create unique index if not exists "IDX_order_snapshot_order_number" on "order_configuration_snapshot" ("order_id", "line_number") where "line_number" is not null and "deleted_at" is null;
      alter table "refund_request" add column if not exists "request_fingerprint" text null;
    `)
  }

  async down(): Promise<void> {
    this.addSql(`
      drop index if exists "IDX_order_snapshot_order_line";
      drop index if exists "IDX_order_snapshot_order_number";
      drop index if exists "IDX_payment_event_reconciliation";
      alter table "payment_event" drop column if exists "next_attempt_at", drop column if exists "retry_count";
      alter table "refund_request" drop column if exists "request_fingerprint";
    `)
  }
}
