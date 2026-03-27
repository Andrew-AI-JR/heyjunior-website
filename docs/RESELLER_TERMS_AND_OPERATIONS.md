# Reseller Program Terms & Operations Runbook

## Reseller Terms

### Commission Structure

- **Rate**: 20% of net subscription revenue per referred subscriber
- **Duration**: Lifetime of each referred subscription (as long as the subscriber remains active)
- **Basis**: Net revenue = gross invoice amount minus refunds and lost disputes
- **Currency**: Commissions are calculated and paid in USD

### Attribution Rules

- Attribution is based on the `?ref=CODE` URL parameter
- First-touch attribution: the first valid referral code seen by a user within 30 days is permanently locked
- Attribution is persisted server-side at account creation and is immutable
- Referral codes expire after 30 days if the referred user has not signed up

### Payout Schedule

- Payouts are processed automatically by Stripe based on the reseller's connected account settings
- Default: rolling payouts (typically 2-day delay for US accounts)
- Resellers can configure their own payout schedule (daily, weekly, monthly) via the Stripe Express Dashboard
- Stripe handles all tax reporting (1099-K/1099-MISC) for US-based resellers

### Refund & Dispute Policy

- **Refunds**: If a referred subscriber receives a refund, the corresponding commission is automatically reversed by Stripe proportionally
- **Disputes**: When a charge is disputed, the commission hold is applied immediately. If the platform wins the dispute, the commission is reinstated. If the platform loses, the reversal is permanent
- **Clawback window**: Stripe handles reversal automatically at the time of the event; no manual clawback is needed

### Eligibility & Approval

- All reseller applicants must be approved by Junior before activation
- Approval criteria: professional standing, relevant audience, no conflicts of interest
- Junior reserves the right to suspend or terminate reseller accounts for violations of terms

### Prohibited Activities

- Resellers may not make false or misleading claims about Junior
- Self-referral (creating accounts to earn commissions on own subscriptions) is prohibited
- Resellers may not use paid advertising that bids on the "Junior" or "HeyJunior" brand name
- Spam, unsolicited bulk messaging, or any outreach that violates CAN-SPAM or GDPR is prohibited

### Termination

- Either party may terminate the reseller relationship with 30 days written notice
- Upon termination, pending commissions for the current billing cycle will be paid out
- Future recurring commissions cease after termination
- Subscribers sourced by a terminated reseller are not reassigned

---

## Operations Runbook

### Approving a New Reseller

1. Receive application email at `support@heyjunior.ai`
2. Verify the applicant's identity and audience (LinkedIn profile, website, etc.)
3. In the database, set:
   - `is_reseller = TRUE`
   - `reseller_status = 'approved'`
4. Send approval email directing them to `https://heyjunior.ai/reseller-dashboard.html`
5. They will complete Stripe Express onboarding on their own

### Monitoring Onboarding

- Check `account.updated` webhook events for connected account status
- If a reseller's onboarding stalls (no `charges_enabled` after 7 days), send a follow-up email
- If `charges_enabled` becomes `false` after being `true`, investigate (bank account issue, compliance hold)

### Handling Reseller Disputes

| Scenario | Action |
|----------|--------|
| Reseller claims missing commission | Check `commission_ledger` for the relevant `stripe_invoice_id`. Cross-reference with Stripe Dashboard > Payments > Transfer details |
| Commission amount seems wrong | Verify: `commission_amount = gross_amount * 0.20`. Check for refunds or disputes on the invoice |
| Reseller requests early payout | Inform that payout timing is managed by Stripe; direct to Express Dashboard |
| Subscriber disputes charge | Commission hold is automatic. Monitor dispute outcome via `charge.dispute.closed` webhook |

### Suspending a Reseller

1. Set `reseller_status = 'suspended'` in the database
2. This immediately stops:
   - New checkout sessions from applying the revenue split
   - Access to the reseller dashboard data endpoints
   - (Existing subscriptions with `transfer_data` continue paying out until changed)
3. To stop existing subscription payouts, update the subscriptions in Stripe to remove `transfer_data`
4. Send notification email explaining the suspension and next steps

### Reconciliation Process (Monthly)

Run this on the first business day of each month:

1. Query `commission_ledger` grouped by `reseller_id` for the previous month
2. For each reseller, sum `commission_amount` entries
3. Cross-reference with Stripe Dashboard > Connect > Transfers for the same period
4. Flag any discrepancies > $1.00 for manual review
5. Document results

### Key Stripe Dashboard Locations

| Task | Dashboard Path |
|------|---------------|
| View connected accounts | Connect > Accounts |
| View transfers to resellers | Connect > Transfers |
| View specific reseller's activity | Connect > Accounts > [Account] |
| Check payout status | Connect > Accounts > [Account] > Payouts |
| Handle disputes | Payments > Disputes |

### Support Templates

**Reseller Approval Email:**
```
Subject: Welcome to the Junior Reseller Program!

Hi [NAME],

Congratulations! You've been approved as a Junior reseller. You'll earn 20% of all subscription revenue from customers you refer, for the lifetime of their subscription.

To get started:
1. Visit your Reseller Dashboard: https://heyjunior.ai/reseller-dashboard.html
2. Complete the payout setup (takes ~5 minutes)
3. Copy your unique referral link and start sharing!

Your referral link format: https://heyjunior.ai?ref=[THEIR_CODE]

Questions? Reply to this email anytime.

Best,
The Junior Team
```

**Reseller Suspension Email:**
```
Subject: Important: Your Junior Reseller Account

Hi [NAME],

Your Junior reseller account has been suspended effective immediately.

Reason: [REASON]

Pending commissions for the current billing cycle will still be paid out.
If you believe this is an error, please reply to this email.

The Junior Team
```

---

## Pilot Rollout Checklist

### Pre-Pilot (Before Inviting Resellers)

- [ ] Stripe Connect enabled in Dashboard
- [ ] Express branding configured (Junior logo, colors)
- [ ] Backend schema migration applied
- [ ] Reseller API endpoints deployed and tested
- [ ] Connect webhook endpoint configured and verified
- [ ] Reseller dashboard page deployed
- [ ] Test full flow with Stripe test mode (Express onboarding, subscription, payout)

### Pilot Phase (2-3 Resellers, 1 Billing Cycle)

- [ ] Select 2-3 existing partners for pilot
- [ ] Approve them as resellers in the database
- [ ] Guide them through Stripe Express onboarding
- [ ] Add their codes to `MIGRATED_TO_CONNECT` in `referral.js`
- [ ] Monitor first subscription through their referral link
- [ ] Verify commission ledger entry after `invoice.paid`
- [ ] Verify Stripe transfer to connected account
- [ ] Wait for full payout cycle to complete
- [ ] Run reconciliation: ledger totals match Stripe transfer totals
- [ ] Collect reseller feedback on dashboard and payout experience

### Post-Pilot Expansion

- [ ] Fix any issues discovered during pilot
- [ ] Migrate remaining partners to Connect one at a time
- [ ] Remove each partner from `PARTNER_LINKS` after Connect verification
- [ ] Once all partners migrated, remove `PARTNER_LINKS` object entirely
- [ ] Update public-facing reseller program page (if any)
