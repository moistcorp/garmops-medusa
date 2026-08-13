import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260813223000 extends Migration {
  async up(): Promise<void> {
    this.addSql('alter table "staff_member" add column if not exists "auth_user_id" text null;')
    this.addSql('create unique index if not exists "IDX_staff_auth_user" on "staff_member" ("auth_user_id") where "auth_user_id" is not null;')
  }

  async down(): Promise<void> {
    this.addSql('drop index if exists "IDX_staff_auth_user";')
    this.addSql('alter table "staff_member" drop column if exists "auth_user_id";')
  }
}
