# Garmops domain model

Medusa owns Product, ProductVariant, Pricing, Customer, Address, Cart, Line
Item, Promotion, Payment, Order, Refund, Fulfillment, Tax, Auth, and
Notification records. Garmops does not duplicate those tables.

The garmops custom module owns:

- design_project and immutable design_version revisions.
- configured_cart_line and cart_profile (configured versus sample).
- order_configuration_snapshot, the immutable manufacturing truth.
- stored_file, whose PostgreSQL metadata is authoritative for R2 objects.
- production_job and production_status_history.
- staff_member with only founder and operations roles.
- payment_event, gst_invoice, terms_acceptance, audit_log, OTP challenges,
  and order-number counter inputs.

Configured production lines remain one logical cart/order line. Size
breakdown, configuration, artwork references, delivery choice, and pricing are
copied to order_configuration_snapshot at paid-order completion. Sample lines
are size-specific and use the sample cart profile.
