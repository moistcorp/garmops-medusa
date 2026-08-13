import { model } from "@medusajs/framework/utils"

export const DesignProject = model.define("design_project", {
  id: model.id().primaryKey(), owner_customer_id: model.text().index(), title: model.text(), product_slug: model.text().index(), active_version_id: model.text().nullable(), source: model.text().default("configurator"), archived: model.boolean().default(false), metadata: model.json().nullable(),
})

export const DesignVersion = model.define("design_version", {
  id: model.id().primaryKey(), project_id: model.text().index(), revision: model.number(), schema_version: model.number(), product_slug: model.text(), configuration: model.json(), quantity: model.number(), pricing_snapshot: model.json().nullable(), client_operation_id: model.text().nullable(),
})

export const ConfiguredCartLine = model.define("configured_cart_line", {
  id: model.id().primaryKey(), cart_id: model.text().index(), line_item_id: model.text().nullable(), customer_id: model.text().nullable(), project_id: model.text(), version_id: model.text(), product_slug: model.text(), quantity: model.number(), size_breakdown: model.json(), delivery_type: model.text(), validated: model.boolean().default(false), pricing_snapshot: model.json().nullable(),
})

export const CartProfile = model.define("cart_profile", {
  id: model.id().primaryKey(), cart_id: model.text().unique(), cart_type: model.enum(["configured", "sample"] as const), customer_id: model.text().nullable(),
})

export const OrderConfigurationSnapshot = model.define("order_configuration_snapshot", {
  id: model.id().primaryKey(), order_id: model.text().index(), line_item_id: model.text().nullable(), line_number: model.number(), customer_id: model.text().nullable(), project_id: model.text().nullable(), version_id: model.text().nullable(), product_slug: model.text(), quantity: model.number(), size_breakdown: model.json(), snapshot: model.json(), pricing_snapshot: model.json(), immutable_hash: model.text(),
})

export const StoredFile = model.define("stored_file", {
  id: model.id().primaryKey(), object_key: model.text().unique(), bucket: model.text(), purpose: model.text(), kind: model.text(), visibility: model.enum(["public", "private"] as const), original_filename: model.text(), safe_filename: model.text(), content_type: model.text(), extension: model.text(), byte_size: model.bigNumber(), sha256: model.text().nullable(), uploaded_by: model.text().nullable(), customer_id: model.text().nullable(), project_id: model.text().nullable(), order_id: model.text().nullable(), replacement_for_file_id: model.text().nullable(), scan_status: model.enum(["pending", "clean", "infected", "quarantined", "failed"] as const).default("pending"), state: model.enum(["pending", "uploaded", "finalized", "rejected"] as const).default("pending"), finalized_at: model.dateTime().nullable(), metadata: model.json().nullable(),
})

export const ProductionJob = model.define("production_job", {
  id: model.id().primaryKey(), order_id: model.text().unique(), order_number: model.text().unique(), order_type: model.enum(["configured", "sample"] as const), status: model.text(), hold_from_status: model.text().nullable(), requested_delivery_date: model.text().nullable(), artwork_review_status: model.enum(["pending", "approved", "rejected"] as const).default("pending"), tracking_number: model.text().nullable(), tracking_url: model.text().nullable(), metadata: model.json().nullable(),
})

export const ProductionStatusHistory = model.define("production_status_history", {
  id: model.id().primaryKey(), production_job_id: model.text().index(), from_status: model.text().nullable(), to_status: model.text(), actor_id: model.text().nullable(), request_id: model.text().nullable(), reason: model.text().nullable(),
})

export const StaffMember = model.define("staff_member", {
  id: model.id().primaryKey(), email: model.text().unique(), auth_user_id: model.text().unique().nullable(), display_name: model.text(), role: model.enum(["founder", "operations"] as const), active: model.boolean().default(true), provisioned_by: model.text().nullable(), metadata: model.json().nullable(),
})

export const PaymentEvent = model.define("payment_event", {
  id: model.id().primaryKey(), provider: model.text(), provider_event_id: model.text().unique(), payment_id: model.text().nullable(), cart_id: model.text().nullable(), order_id: model.text().nullable(), event_type: model.text(), status: model.text(), amount_paise: model.bigNumber().nullable(), payload_hash: model.text(), processed_at: model.dateTime().nullable(),
})

export const Invoice = model.define("gst_invoice", {
  id: model.id().primaryKey(), order_id: model.text().unique(), invoice_number: model.text().unique(), status: model.enum(["pending", "issued", "failed", "void"] as const).default("pending"), subtotal_paise: model.bigNumber(), tax_paise: model.bigNumber(), total_paise: model.bigNumber(), gst_rate_basis_points: model.number(), hsn_snapshot: model.json(), seller_snapshot: model.json(), billing_snapshot: model.json(), pdf_file_id: model.text().nullable(), issued_at: model.dateTime().nullable(),
})

export const TermsAcceptance = model.define("terms_acceptance", {
  id: model.id().primaryKey(), customer_id: model.text().index(), order_id: model.text().nullable(), terms_version: model.text(), privacy_version: model.text().nullable(), accepted_at: model.dateTime(), request_id: model.text().nullable(),
})

export const AuditLog = model.define("audit_log", {
  id: model.id().primaryKey(), actor_type: model.text(), actor_id: model.text().nullable(), action: model.text(), resource_type: model.text(), resource_id: model.text(), request_id: model.text().nullable(), before_snapshot: model.json().nullable(), after_snapshot: model.json().nullable(), metadata: model.json().nullable(),
})

export const OtpChallenge = model.define("otp_challenge", {
  id: model.id().primaryKey(), email: model.text().index(), code_hash: model.text(), expires_at: model.dateTime(), attempts: model.number().default(0), consumed: model.boolean().default(false), request_id: model.text().nullable(),
})

export const OrderNumberCounter = model.define("order_number_counter", {
  id: model.id().primaryKey(), counter_key: model.text().unique(), order_type: model.enum(["configured", "sample"] as const), year: model.number(), next_sequence: model.number().default(1),
})
