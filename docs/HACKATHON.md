# StockSense: submission plan

## Product argument

Inventory managers need to answer three questions: What is available? Where is it? Why did it change? StockSense answers these through location balances, clear operation states, and an auditable ledger. Warehouse staff need fast, explicit actions with useful errors when an operation cannot proceed.

The strongest demo is a complete stock journey with correct numbers, not a collection of disconnected screens. No feature can guarantee a hackathon win; rubric fit, team understanding, reliability, and presentation matter.

## Four-person split

| Owner | Responsibility | Acceptance evidence |
|---|---|---|
| 1 — integration lead | Repository, branches, setup, build, deployment | Fresh clone runs; no secrets; working demo URL |
| 2 — inventory engineer | API, schema, transitions, stock integrity | Explain and rerun all invariant tests; show atomic failure |
| 3 — product/UI engineer | Forms, filters, small screens, empty/error states | Run the complete workflow by keyboard and on a phone-width screen |
| 4 — demo/QA lead | Requirement checklist, test matrix, pitch, backup video | Three-minute rehearsal and prepared answers to judge questions |

Use separate branches. Avoid editing the same central UI file simultaneously: the UI owner owns `app/stock-sense.tsx` and `app/forms.tsx`; the inventory owner owns `app/api/`, `lib/`, `db/`, and `drizzle/`; the integration lead owns setup/configuration. Everyone reads the architecture before presenting it.

## Deadline: 5 pm India time

- By 12:30 pm: each teammate runs the app and understands their area.
- By 1:30 pm: resolve rubric-critical gaps. Confirm whether custom signup/OTP and team roles are mandatory, because email/OTP requires Supabase configuration and all accounts currently have isolated inventory.
- By 2:30 pm: freeze features; run the full manual matrix and clean up blocking issues.
- By 3:30 pm: record a backup demo and finish presentation/submission assets.
- By 4:15 pm: rehearse twice, verify sharing and submission links.
- By 4:45 pm: submit; preserve the last 15 minutes for upload or access problems.

Do not add an AI label to a fixed-threshold rule. If a rubric rewards AI, first establish an honest measurable use case and a working data/service integration; do not trade away the functioning stock engine for a chatbot placeholder.

## Three-minute demo

**0:00–0:25 — Problem.** “A spreadsheet can show 100 units without telling us which warehouse owns them or why the count changed. StockSense makes every unit traceable.”

**0:25–0:50 — Dashboard.** Load the sample warehouse once. Show stock alerts, pending receipts, and pending deliveries. Explain that cards are calculated from saved records. Open a low-stock replenishment draft and explain its target-based suggestion, then cancel the form.

**0:50–1:20 — Receipt.** For a repeatable rehearsal, create a uniquely named demo product with zero stock. Receive 100 kg into Main store, mark ready, and validate. Show the +100 ledger entry. Drafts do not change stock.

**1:20–1:45 — Transfer.** Move 40 kg from Main store to Production rack. The total remains 100, split 60/40. Show the paired debit and credit.

**1:45–2:05 — Delivery.** Create a 20 kg delivery from Main store. Mark picked, mark packed & ready, then validate. Total becomes 80, split 40/40.

**2:05–2:25 — Count adjustment.** Count 37 kg in Main store; use reason “3 kg damaged during handling.” Total becomes 77, split 37/40. Show the -3 ledger entry.

**2:25–2:45 — Integrity.** Attempt a delivery larger than stock. The document remains ready, stock remains 77, and the app explains why validation failed. Cancel that document afterward.

**2:45–3:00 — Close.** “Every receipt, shipment, transfer, and correction ends with a consistent balance and a source document. We can explain all 77 units.”

## Questions to prepare for

- **What prevents double counting?** A conditional status transition and unique movement keys; a Done document cannot validate again.
- **What if one line has insufficient stock?** Validation and ledger/balance updates share a database statement transaction. The whole document rolls back.
- **Why integer quantities?** Three decimal places are represented as integer thousandths, avoiding floating-point drift.
- **What happens when counts are stale?** Validation compares the captured balance with the current balance and rejects stale counts.
- **Is it AI-powered?** No predictive model is implemented. Replenishment recommendations use explicit reorder and target rules.
- **What is incomplete?** Supabase project configuration and live email verification, shared organizations/roles, automated notifications, and production-scale pagination. Be explicit rather than claiming them.

## Manual QA matrix

- Create and edit a product; reject duplicate SKU and invalid thresholds.
- Add a warehouse and rack; reject duplicate location names within a warehouse.
- Receive a fractional quantity and inspect its exact balance.
- Transfer across warehouses and verify unchanged global quantity.
- Reject same-location transfers and insufficient deliveries.
- Enter multiple products and verify atomic failure when only one lacks stock.
- Create a count, change stock in another tab, and confirm stale-count rejection.
- Validate twice (or retry a request) and confirm one stock change.
- Cancel a draft and verify no new ledger entry.
- Search by SKU, filter by category/location/status, and export movement CSV.
- Reload and verify records persist; sign out and verify protected access.
- Inspect desktop and phone-width layouts; tab through forms and dialogs.

## Submission checklist

- Push the feature branch and review it before merging.
- Include README, architecture, tested workflows, and honest limitations.
- Confirm hackathon rules permit the chosen tools and AI assistance; disclose as required.
- Verify judges can access the submitted link; the initial hosted Site is owner-private.
- Keep a local run and a backup screen recording available.
