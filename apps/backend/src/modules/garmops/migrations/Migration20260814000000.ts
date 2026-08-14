import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/** Stage 2 finalization constraints and retry state. Safe to apply to existing installs. */
export class Migration20260814000000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      alter table "stored_file" add column if not exists "scan_attempts" integer not null default 0;
      alter table "stored_file" add column if not exists "scan_started_at" timestamptz null;
      alter table "stored_file" add column if not exists "scan_completed_at" timestamptz null;
      alter table "stored_file" add column if not exists "scan_error" text null;
      alter table "payment_event" add column if not exists "provider_transaction_id" text null;
      alter table "payment_event" add column if not exists "payment_session_id" text null;
      alter table "payment_event" add column if not exists "last_error" text null;
      create unique index if not exists "IDX_payment_event_transaction" on "payment_event" ("provider_transaction_id") where "provider_transaction_id" is not null;
      alter table "gst_invoice" add column if not exists "order_number" text null;
      alter table "gst_invoice" add column if not exists "cgst_paise" numeric not null default 0;
      alter table "gst_invoice" add column if not exists "sgst_paise" numeric not null default 0;
      alter table "gst_invoice" add column if not exists "igst_paise" numeric not null default 0;
      alter table "gst_invoice" add column if not exists "place_of_supply" text not null default 'inter_state';
      alter table "gst_invoice" add column if not exists "shipping_snapshot" jsonb null;
      alter table "gst_invoice" add column if not exists "payment_snapshot" jsonb null;
      alter table "gst_invoice" add column if not exists "last_error" text null;
      create table if not exists "invoice_number_counter" (
        "id" text not null primary key, "year" integer not null unique, "next_sequence" integer not null default 1,
        "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null
      );
      create table if not exists "notification_event" (
        "id" text not null primary key, "event_key" text not null unique, "channel" text not null, "template" text not null,
        "recipient" text not null, "status" text not null default 'pending', "payload" jsonb not null,
        "sent_at" timestamptz null, "last_error" text null, "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null
      );
      create table if not exists "refund_request" (
        "id" text not null primary key, "payment_id" text not null, "idempotency_key" text not null unique, "amount_paise" numeric not null,
        "status" text not null default 'pending', "requested_by" text not null, "provider_reference" text null, "last_error" text null,
        "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null
      );
      create index if not exists "IDX_refund_request_payment" on "refund_request" ("payment_id");
    `)
  }

  async down(): Promise<void> {
    this.addSql(`drop table if exists "refund_request", "notification_event", "invoice_number_counter" cascade;`)
    this.addSql(`drop index if exists "IDX_payment_event_transaction";`)
    this.addSql(`alter table "gst_invoice" drop column if exists "payment_snapshot", drop column if exists "shipping_snapshot", drop column if exists "last_error", drop column if exists "place_of_supply", drop column if exists "igst_paise", drop column if exists "sgst_paise", drop column if exists "cgst_paise", drop column if exists "order_number";`)
    this.addSql(`alter table "payment_event" drop column if exists "last_error", drop column if exists "payment_session_id", drop column if exists "provider_transaction_id";`)
    this.addSql(`alter table "stored_file" drop column if exists "scan_error", drop column if exists "scan_completed_at", drop column if exists "scan_started_at", drop column if exists "scan_attempts";`)
  }
}
