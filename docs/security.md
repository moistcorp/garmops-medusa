# Security controls

- Authoritative money values are integer paise. Browser prices are never
  accepted as totals; the backend recalculates configuration inputs.
- PayU callbacks must be authenticated with the merchant key and response hash,
  then checked against transaction ID, INR currency, expected amount, and
  payment state. Provider event fingerprints are persisted for idempotency.
- OTP codes use a cryptographic random source, are stored as SHA-256 digests,
  expire after ten minutes, and are capped at five attempts. Production
  responses never include the code.
- Customer artwork and operational documents are private R2 objects. Upload
  authorization creates pending StoredFile metadata and finalization HEAD
  verifies ownership and size before use.
- File names are normalized and validated against both extension and MIME
  policy. Sensitive files stay scan-pending until the malware scanner returns
  clean.
- Configuration snapshots are append-only. Foundry APIs transition production
  state or perform approved payment/fulfillment actions; they never edit
  placed manufacturing data.
- Operations has no refund, staff-management, discount-management,
  raw-payment, or order-configuration mutation permission.
- CORS, secrets, provider credentials, and signed URL lifetimes are
  environment-controlled. No Supabase runtime dependency exists here.
