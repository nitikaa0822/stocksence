# StockSense

A working inventory operations app for the StockSense hackathon brief. Products, warehouse locations, receipts, deliveries, internal transfers, physical stock counts, low-stock alerts, and an immutable movement ledger are backed by a persistent SQL database.

## Why this implementation

Inventory is a consistency problem: a beautiful dashboard is only useful if its numbers stay correct. Validating an operation changes stock and records its movements in one database transaction. Failed deliveries and transfers roll back completely. Repeated validation does not change stock twice. Physical counts reject stale balances. Quantities use integer thousandths, so 0.001 kg movements do not introduce floating-point drift.

The Stock watch panel turns low-stock alerts into a prefilled receipt using the product's target level. It is a transparent rule-based recommendation, not an AI demand forecast.

## Stack

- React 19, TypeScript, Vinext with Next.js App Router conventions
- Tailwind CSS and accessible Shadcn/Radix primitives
- Cloudflare Workers and D1 (SQLite), Drizzle schema/migrations
- Zod validation, platform sign-in, optional Supabase email/OTP auth, account-scoped data
- Python's standard-library SQLite/unittest for invariant tests

## Run locally

Prerequisites: Node.js 22.13+ with npm, and Python 3 for the invariant tests.

```sh
npm ci
npm run build
npm run db:local
npm run dev
```

Open the local address printed by the server (normally `http://localhost:5173`). Click **Sign in**. The development middleware uses the local test account `seedy@sites.test`; it does not require an email or password. Click **Explore sample warehouse** once, or create your own locations and products. Sample data is persisted and cannot be reset through the UI.

`npm run db:local` applies only migrations not yet recorded locally. Both dev and built preview use `.wrangler/state`. Do not commit that directory. `npm start` runs the built Worker but does not provide the development sign-in simulator.

```sh
npm run typecheck
python -m unittest discover -s tests -v
npm run build
```

## Product workflows

1. Create products and warehouse locations.
2. Create a receipt with products and quantities; save the draft.
3. Review, mark ready, and validate. Stock appears at the destination.
4. Transfers capture a scheduled date/time and debit one location while crediting the other atomically when manually validated.
5. Deliveries require separate **Mark picked → Mark packed & ready → Validate** actions. Only validation reduces source stock; insufficient availability is rejected.
6. Adjustments accept a physical count, require a reason, and record the difference.
7. Open Movement history to inspect each change or export CSV.

States: `Draft → Waiting → Ready → Done`, with direct `Draft → Ready` also supported. Any unfinished document can be canceled. Done and canceled documents are final. To correct a completed operation, create a new documented operation; do not alter history.

## Architecture

```text
app/stock-sense.tsx      Dashboard, products, operations, locations, ledger
app/forms.tsx           Validated product/location/operation forms
app/api/inventory/      Account-scoped read and mutation API
lib/inventory.ts        Shared input validation, types, quantity formatting
lib/database.ts         D1 binding helper
lib/seed.ts             Explicit sample-warehouse initialization
db/schema.ts            Tables, keys, indexes, and checks
drizzle/                Schema migrations and transactional stock triggers
tests/                  Real-migration inventory invariant tests
docs/                   Team plan, demo script, scope and architecture notes
```

The API derives ownership and operator identity on the server. Queries use prepared statements. Stock updates happen through validated operations; there is no arbitrary balance-edit endpoint. CSV cells are quoted and formula-like values are escaped.

## Authentication and scope

The hosted Site uses ChatGPT sign-in and is private by default. Inventory is isolated per signed-in account. This is **not yet a shared multi-user organization workspace**. The four-person development team can collaborate through GitHub; different app accounts do not share inventory.

Email/password signup, code confirmation, login and OTP recovery are implemented using Supabase, but require your project URL, public key and email configuration. See [EMAIL-SETUP.md](docs/EMAIL-SETUP.md). Provider email delivery has not been verified because no Supabase project was supplied. Manager/staff permissions, invite-based team workspaces, reservation/backorder logic, notifications by email, and predictive demand models are future work. The present app focuses on the core inventory flow and demonstrable integrity. A private hosted URL cannot be accessed by judges until the owner explicitly changes sharing.

Refresh loads current state, successful actions refresh immediately, and the app polls every 5 seconds while visible. This is polling, not WebSocket real-time sync. This hackathon version loads the account's complete inventory; pagination is a production follow-up.

## GitHub collaboration

The implementation lives on `feat/stocksense-inventory`. See [the team plan](docs/HACKATHON.md) for a four-person ownership split and deadline checkpoints. Review changes before merging into `main`.

## Hosting

`.openai/hosting.json` declares the Site identity and logical D1 binding. The Sites publishing workflow supplies the actual database binding and applies migrations. The platform identity headers are trusted only behind that dispatcher. Do not expose the built Worker directly on an untrusted origin without replacing authentication with a verified provider and configuring the real database binding.

Never commit access tokens or database state. The source contains no API keys. The optional browser `read_inventory` tool uses the same authenticated API and is feature-detected.

## Demo checks

`node scripts/smoke-local.mjs` checks authentication, input validation and duplicate validation without changing stock. After loading sample data, `node scripts/demo-check.mjs` runs the receipt/transfer/pick/pack/delivery/count journey on the dedicated `DEMO-STEEL-77` product. It preserves the result for rehearsal and skips creation on subsequent runs.

Warehouse, location and category filters apply to balances and the ledger. Scheduled transfers have their own dashboard card on desktop and mobile. Export the ledger as CSV for an audit trail. Opening stock is entered as a receipt so its source remains traceable.
