# Garmops authentication model

Medusa actor types remain separate:

| Actor | Providers | Purpose |
| --- | --- | --- |
| `customer` | `emailotp`, `google` | Public customer sign-in. No customer email/password route is enabled. |
| `user` | `emailpass` | Medusa Admin and manually provisioned Garmops staff. |

Email OTP requests are created at `/store/garmops/otp/request`; the standard Medusa route `/auth/customer/emailotp` consumes the challenge and returns the customer session. OTPs expire, are single-use, are hash-compared, and have a five-attempt limit. Google identities must be linked to the existing customer before use in production; a provider identity must never silently create a second customer for an email already attached to a customer.

Staff roles are exactly `founder` and `operations`. There is no public staff registration or invitation route. Provision accounts from the backend workspace:

```bash
npm run staff:create -- --email founder@example.com --role founder --display-name Founder --password-stdin
printf '%s' 'use-a-secret-from-your-secret-manager' | npm run staff:create -- --email founder@example.com --role founder --password-stdin
```

The command rejects malformed/duplicate emails and customer collisions, creates a Medusa `user` auth identity, and links it to `staff_member`. Login uses `/auth/user/emailpass`; production MFA should be enabled in Medusa Auth for staff identities.

Founder controls staff, discounts, refunds, raw payments, and all production actions. Operations can review artwork and advance valid production states but cannot refund, manage staff/promotions, edit frozen configurations, set payment state, or create payment links. These checks are server-side.

The invariant is strict: a normalized staff email cannot be a customer email, and customer OTP refuses a staff email without revealing that fact to public callers.
