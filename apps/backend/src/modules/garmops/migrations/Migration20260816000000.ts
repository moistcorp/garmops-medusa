import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/** Separates immutable PayU attempts from replayable provider events. */
export class Migration20260816000000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      alter table "payment_event" add column if not exists "event_payload_hash" text;
      update "payment_event" set "event_payload_hash" = "payload_hash" where "event_payload_hash" is null;
      alter table "payment_event" alter column "event_payload_hash" set not null;
      alter table "payment_event" alter column "payload_hash" drop not null;

      create table if not exists "payment_attempt" (
        "id" text not null primary key,
        "provider" text not null,
        "cart_id" text not null,
        "customer_id" text not null,
        "payment_session_id" text not null unique,
        "provider_transaction_id" text not null unique,
        "expected_amount_paise" numeric not null,
        "raw_expected_amount_paise" text null,
        "cart_revision_hash" text not null,
        "snapshot" jsonb null,
        "status" text not null default 'active',
        "expires_at" timestamptz not null,
        "invalidated_at" timestamptz null,
        "completed_at" timestamptz null,
        "last_error" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null
      );
      create index if not exists "IDX_payment_attempt_cart" on "payment_attempt" ("cart_id");
      create index if not exists "IDX_payment_attempt_customer" on "payment_attempt" ("customer_id");

      alter table "refund_request" add column if not exists "order_id" text null;
      alter table "refund_request" add column if not exists "submitted_at" timestamptz null;
      alter table "refund_request" add column if not exists "completed_at" timestamptz null;
      create index if not exists "IDX_refund_request_order" on "refund_request" ("order_id");
    `)
  }

  async down(): Promise<void> {
    this.addSql(`drop table if exists "payment_attempt" cascade;`)
    this.addSql(`alter table "refund_request" drop column if exists "completed_at", drop column if exists "submitted_at", drop column if exists "order_id";`)
    this.addSql(`alter table "payment_event" drop column if exists "event_payload_hash";`)
  }
}
