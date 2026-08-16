import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/** Converts only identifiable pre-boundary Garmops line prices from paise to Medusa major units. */
export class Migration20260816140000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      update "cart_line_item"
      set
        "unit_price" = "unit_price" / 100,
        "raw_unit_price" = jsonb_build_object('value', ("unit_price" / 100)::text, 'precision', coalesce(("raw_unit_price"->>'precision')::integer, 20)),
        "compare_at_unit_price" = case when "compare_at_unit_price" is null then null else "compare_at_unit_price" / 100 end,
        "raw_compare_at_unit_price" = case when "raw_compare_at_unit_price" is null then null else jsonb_build_object('value', ("compare_at_unit_price" / 100)::text, 'precision', coalesce(("raw_compare_at_unit_price"->>'precision')::integer, 20)) end
      where ("metadata"->>'garmops_configured' = 'true' or "metadata"->>'garmops_sample' = 'true')
        and "unit_price" >= 100
        and "raw_unit_price"->>'value' = "unit_price"::text;

      update "order_line_item"
      set
        "unit_price" = "unit_price" / 100,
        "raw_unit_price" = jsonb_build_object('value', ("unit_price" / 100)::text, 'precision', coalesce(("raw_unit_price"->>'precision')::integer, 20)),
        "compare_at_unit_price" = case when "compare_at_unit_price" is null then null else "compare_at_unit_price" / 100 end,
        "raw_compare_at_unit_price" = case when "raw_compare_at_unit_price" is null then null else jsonb_build_object('value', ("compare_at_unit_price" / 100)::text, 'precision', coalesce(("raw_compare_at_unit_price"->>'precision')::integer, 20)) end
      where ("metadata"->>'garmops_configured' = 'true' or "metadata"->>'garmops_sample' = 'true')
        and "unit_price" >= 100
        and "raw_unit_price"->>'value' = "unit_price"::text;
    `)
  }

  async down(): Promise<void> {
    // Monetary backfills are intentionally not reversed: the old paise representation
    // is incompatible with the native Medusa boundary after this migration.
  }
}
