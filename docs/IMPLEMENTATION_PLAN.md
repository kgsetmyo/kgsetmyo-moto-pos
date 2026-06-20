# Implementation Plan — Moto POS

## Phase 1: Foundation (Week 1) ✅ Scaffolded

1. **Supabase project setup**
   - Run `supabase/migrations/001_initial_schema.sql`
   - Enable Email auth; create Admin + Cashier test users
   - Create `slips` storage bucket (public or signed URLs)

2. **Environment**
   - Copy `.env.example` → `.env.local`
   - `npm run db:generate && npm run db:push`

3. **Seed data** (manual or seed script)
   - Brands, categories, bike brands/models
   - Sample products with compatibilities
   - Initial inventory batches

## Phase 2: Inventory & Catalog (Week 2)

| Task | Priority | Notes |
|------|----------|-------|
| Product CRUD UI | P0 | Admin-only form with compatibility multi-select |
| Batch receive UI | P0 | Cost/sell/qty; calls `POST /api/inventory/batches` |
| Barcode generator | P1 | Optional CODE128 from SKU |
| Stock adjustment | P1 | Admin audit log for write-offs |
| Bulk CSV import | P2 | Products + compatibilities |

**Performance**
- Paginated product list (`page`, `pageSize` query params)
- `React.lazy` for inventory admin modals
- Skeleton loaders on tables

## Phase 3: POS Hardening (Week 2–3)

| Task | Priority | Notes |
|------|----------|-------|
| Customer picker modal | P0 | Replace UUID input for credit sales |
| Mobile slip upload | P0 | Supabase Storage → `slipUrl` on payment |
| Split payments | P1 | Cash + mobile on same sale |
| Price override (admin) | P2 | PIN-gated discount |
| Offline queue | P3 | Service worker + IndexedDB retry |

**Performance**
- 250ms debounced search (implemented)
- `keepPreviousData` on SWR (implemented)
- Prefetch popular SKUs on POS mount

## Phase 4: Credit & Customers (Week 3)

| Task | Priority |
|------|----------|
| Customer CRUD | P0 |
| Credit payment recording | P0 (`POST /api/customers`) |
| Ledger history view | P0 |
| Credit limit enforcement | P1 |
| SMS reminders | P3 |

## Phase 5: Reporting & Daily Close (Week 4)

| Task | Priority |
|------|----------|
| Z-Report UI | P0 (shell done) |
| Date-range P&L | P0 (shell done) |
| Daily close lock | P1 — prevent edits after close |
| Export PDF/Excel | P2 |
| Expense entry UI | P1 |

## Phase 6: Production & Ops

- **Security**: Tighten RLS per role (cashiers read-only on costs)
- **Monitoring**: Supabase logs + Vercel analytics
- **Backups**: Supabase daily backups enabled
- **Thermal printer**: Test 80mm CSS `@media print` margins

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products/search?q=&bikeBrand=&bikeModel=&year=` | Paginated POS search |
| POST | `/api/inventory/batches` | Receive FIFO batch |
| POST | `/api/sales` | Checkout with FIFO deduction |
| GET | `/api/dashboard` | Today stats + low stock |
| GET | `/api/customers` | Paginated customers |
| POST | `/api/customers` | Record credit payment |
| GET | `/api/reports?type=z-report&date=` | Daily close |
| GET | `/api/reports?from=&to=` | Range P&L |

## Database Design Highlights

### FIFO
- `inventory_batches.quantity_remaining` decremented oldest-first
- `sale_batch_allocations` immutable audit trail per sale line
- `total_cogs` on `sales` and `sale_line_items` for fast reporting

### Compatibility Matrix
- `product_compatibilities(product_id, bike_model_id, year)` unique tuple
- Search joins through `bike_models` → `bike_brands`

### Low Stock
- `product_stock_view` aggregates batch remainders vs threshold
- Dashboard queries view (falls back if view missing)

## Testing Checklist

- [x] Receive 2 batches at different costs → sell qty spanning both → verify COGS (FIFO RPC)
- [x] Sell more than stock → 409 error, no partial deduction (smoke test)
- [x] Credit sale increases customer balance + ledger entry (smoke test)
- [x] Credit payment decreases balance (smoke test)
- [x] Z-report totals match sum of payments (smoke test)
- [x] Cashier cannot see cost prices on batch API (smoke test)
- [ ] Barcode scan adds correct product in <300ms (manual POS test)

## Deferred (out of scope)

- Offline queue / service worker
- SMS credit reminders
- PIN-gated discount override
- PDF export (print + CSV available)
- Per-role Supabase RLS (route guards in place)
- Prisma removal
