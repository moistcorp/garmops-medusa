import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260813220000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      create table if not exists "design_project" (
        "id" text not null primary key, "owner_customer_id" text not null, "title" text not null,
        "product_slug" text not null, "active_version_id" text null, "source" text not null default 'configurator',
        "archived" boolean not null default false, "metadata" jsonb null, "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null
      );
      create index if not exists "IDX_design_project_owner" on "design_project" ("owner_customer_id");
      create index if not exists "IDX_design_project_product" on "design_project" ("product_slug");
      create table if not exists "design_version" (
        "id" text not null primary key, "project_id" text not null, "revision" integer not null,
        "schema_version" integer not null, "product_slug" text not null, "configuration" jsonb not null,
        "quantity" integer not null, "pricing_snapshot" jsonb null, "client_operation_id" text null,
        "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null,
        unique ("project_id", "revision")
      );
      create index if not exists "IDX_design_version_project" on "design_version" ("project_id");
      create table if not exists "configured_cart_line" (
        "id" text not null primary key, "cart_id" text not null, "line_item_id" text null, "customer_id" text null,
        "project_id" text not null, "version_id" text not null, "product_slug" text not null, "quantity" integer not null,
        "size_breakdown" jsonb not null, "delivery_type" text not null, "validated" boolean not null default false,
        "pricing_snapshot" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null
      );
      create index if not exists "IDX_configured_cart_line_cart" on "configured_cart_line" ("cart_id");
      create table if not exists "cart_profile" (
        "id" text not null primary key, "cart_id" text not null unique, "cart_type" text not null,
        "customer_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null
      );
      create table if not exists "order_configuration_snapshot" (
        "id" text not null primary key, "order_id" text not null, "line_item_id" text null, "line_number" integer not null,
        "customer_id" text null, "project_id" text null, "version_id" text null, "product_slug" text not null, "quantity" integer not null,
        "size_breakdown" jsonb not null, "snapshot" jsonb not null, "pricing_snapshot" jsonb not null, "immutable_hash" text not null,
        "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null
      );
      create index if not exists "IDX_order_snapshot_order" on "order_configuration_snapshot" ("order_id");
      create table if not exists "stored_file" (
        "id" text not null primary key, "object_key" text not null unique, "bucket" text not null, "purpose" text not null,
        "kind" text not null, "visibility" text not null, "original_filename" text not null, "safe_filename" text not null,
        "content_type" text not null, "extension" text not null, "byte_size" numeric not null, "raw_byte_size" text not null,
        "sha256" text null, "uploaded_by" text null, "customer_id" text null, "project_id" text null, "order_id" text null,
        "replacement_for_file_id" text null, "scan_status" text not null default 'pending', "state" text not null default 'pending',
        "finalized_at" timestamptz null, "metadata" jsonb null, "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null
      );
      create table if not exists "production_job" (
        "id" text not null primary key, "order_id" text not null unique, "order_number" text not null unique,
        "order_type" text not null, "status" text not null, "hold_from_status" text null, "requested_delivery_date" text null,
        "artwork_review_status" text not null default 'pending', "tracking_number" text null, "tracking_url" text null,
        "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null
      );
      create table if not exists "production_status_history" (
        "id" text not null primary key, "production_job_id" text not null, "from_status" text null, "to_status" text not null,
        "actor_id" text null, "request_id" text null, "reason" text null, "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null
      );
      create index if not exists "IDX_status_history_job" on "production_status_history" ("production_job_id");
      create table if not exists "staff_member" (
        "id" text not null primary key, "email" text not null unique, "display_name" text not null, "role" text not null,
        "active" boolean not null default true, "provisioned_by" text null, "metadata" jsonb null,
        "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null
      );
      alter table "staff_member" add column if not exists "auth_user_id" text null;
      create unique index if not exists "IDX_staff_auth_user" on "staff_member" ("auth_user_id") where "auth_user_id" is not null;
      create table if not exists "payment_event" (
        "id" text not null primary key, "provider" text not null, "provider_event_id" text not null unique, "payment_id" text null,
        "cart_id" text null, "order_id" text null, "event_type" text not null, "status" text not null, "amount_paise" numeric null,
        "raw_amount_paise" text null, "payload_hash" text not null, "processed_at" timestamptz null,
        "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null
      );
      create table if not exists "gst_invoice" (
        "id" text not null primary key, "order_id" text not null unique, "invoice_number" text not null unique,
        "status" text not null default 'pending', "subtotal_paise" numeric not null, "raw_subtotal_paise" text not null,
        "tax_paise" numeric not null, "raw_tax_paise" text not null, "total_paise" numeric not null, "raw_total_paise" text not null,
        "gst_rate_basis_points" integer not null, "hsn_snapshot" jsonb not null, "seller_snapshot" jsonb not null,
        "billing_snapshot" jsonb not null, "pdf_file_id" text null, "issued_at" timestamptz null,
        "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null
      );
      create table if not exists "terms_acceptance" (
        "id" text not null primary key, "customer_id" text not null, "order_id" text null, "terms_version" text not null,
        "privacy_version" text null, "accepted_at" timestamptz not null, "request_id" text null,
        "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null
      );
      create index if not exists "IDX_terms_customer" on "terms_acceptance" ("customer_id");
      create table if not exists "audit_log" (
        "id" text not null primary key, "actor_type" text not null, "actor_id" text null, "action" text not null,
        "resource_type" text not null, "resource_id" text not null, "request_id" text null, "before_snapshot" jsonb null,
        "after_snapshot" jsonb null, "metadata" jsonb null, "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null
      );
      create table if not exists "otp_challenge" (
        "id" text not null primary key, "email" text not null, "code_hash" text not null, "expires_at" timestamptz not null,
        "attempts" integer not null default 0, "consumed" boolean not null default false, "request_id" text null,
        "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null
      );
      create index if not exists "IDX_otp_email" on "otp_challenge" ("email");
      create table if not exists "order_number_counter" (
        "id" text not null primary key, "counter_key" text not null unique, "order_type" text not null, "year" integer not null,
        "next_sequence" integer not null default 1, "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null
      );
    `)
  }

  async down(): Promise<void> {
    this.addSql(`drop table if exists "order_number_counter", "otp_challenge", "audit_log", "terms_acceptance", "gst_invoice", "payment_event", "staff_member", "production_status_history", "production_job", "stored_file", "order_configuration_snapshot", "cart_profile", "configured_cart_line", "design_version", "design_project" cascade;`)
  }
}
