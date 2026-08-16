import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/** Enforces design-save idempotency and binds legal acceptance to a paid cart revision. */
export class Migration20260816120000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      alter table "design_version" add column if not exists "client_operation_fingerprint" text null;
      alter table "terms_acceptance" add column if not exists "cart_id" text null;
      alter table "terms_acceptance" add column if not exists "cart_revision_hash" text null;
      alter table "terms_acceptance" add column if not exists "terms_content_hash" text null;
      alter table "terms_acceptance" add column if not exists "privacy_content_hash" text null;
      create index if not exists "IDX_terms_acceptance_cart" on "terms_acceptance" ("cart_id");
      create unique index if not exists "IDX_design_version_operation" on "design_version" ("project_id", "client_operation_id") where "client_operation_id" is not null;
    `)
  }

  async down(): Promise<void> {
    this.addSql(`
      drop index if exists "IDX_design_version_operation";
      drop index if exists "IDX_terms_acceptance_cart";
      alter table "terms_acceptance" drop column if exists "privacy_content_hash", drop column if exists "terms_content_hash", drop column if exists "cart_revision_hash", drop column if exists "cart_id";
      alter table "design_version" drop column if exists "client_operation_fingerprint";
    `)
  }
}
