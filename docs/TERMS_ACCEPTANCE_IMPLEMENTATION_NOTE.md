# Terms Acceptance Implementation Note

## What is implemented in the website

- `checkout.html` requires users to check an "I agree to the Terms of Service" checkbox before account/payment flow can proceed.
- `register.html` requires users to check the same agreement before registration can proceed.
- Both validations are enforced in frontend JavaScript:
  - `js/checkout.js`
  - `js/register.js`
- Terms content is published at `terms.html`.

## Backend evidence requirement (recommended)

For stronger enforceability and auditability, backend registration endpoints should persist:

- `terms_version` (for example: `v2026-04-07`)
- `terms_accepted_at` (ISO timestamp)
- Optional: source page (`checkout` or `register`)

## Current gap

The current website enforces explicit acceptance in UI, but if backend does not persist acceptance metadata, legal evidence is limited to client behavior and logs.

## Suggested API change

Accept optional fields on registration/create-account endpoints:

- `terms_version`
- `terms_accepted_at`

Persist those fields on the user record or a dedicated acceptance log table.
