import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/sqlite-core";
export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    sku: text("sku").notNull(),
    category: text("category").notNull(),
    unit: text("unit").notNull(),
    reorder: integer("reorder").notNull().default(10000),
    target: integer("target").notNull().default(50000),
  },
  (t) => [
    uniqueIndex("product_owner_sku").on(t.owner, t.sku),
    check(
      "valid_thresholds",
      sql`${t.reorder} >= 0 AND ${t.target} >= ${t.reorder}`,
    ),
  ],
);
export const locations = sqliteTable(
  "locations",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    warehouse: text("warehouse").notNull(),
    name: text("name").notNull(),
  },
  (t) => [uniqueIndex("location_unique").on(t.owner, t.warehouse, t.name)],
);
export const balances = sqliteTable(
  "balances",
  {
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    locationId: text("location_id")
      .notNull()
      .references(() => locations.id),
    qty: integer("qty").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.locationId] }),
    check("stock_nonnegative", sql`${t.qty} >= 0`),
  ],
);
export const operations = sqliteTable(
  "operations",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    reference: text("reference").notNull(),
    kind: text("kind").notNull(),
    status: text("status").notNull().default("Draft"),
    sourceId: text("source_id").references(() => locations.id),
    destId: text("dest_id").references(() => locations.id),
    partner: text("partner").notNull().default(""),
    note: text("note").notNull().default(""),
    actor: text("actor").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    scheduledAt: text("scheduled_at"),
    pickedAt: text("picked_at"),
    packedAt: text("packed_at"),
  },
  (t) => [
    index("operation_owner_time").on(t.owner, t.createdAt),
    check(
      "operation_kind",
      sql`${t.kind} IN ('receipt','delivery','transfer','adjustment')`,
    ),
    check(
      "operation_status",
      sql`${t.status} IN ('Draft','Waiting','Ready','Done','Canceled')`,
    ),
  ],
);
export const lines = sqliteTable(
  "lines",
  {
    id: text("id").primaryKey(),
    operationId: text("operation_id")
      .notNull()
      .references(() => operations.id),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    qty: integer("qty").notNull(),
    expectedQty: integer("expected_qty"),
  },
  (t) => [
    uniqueIndex("line_operation_product").on(t.operationId, t.productId),
    check("quantity_nonnegative", sql`${t.qty} >= 0`),
  ],
);
export const movements = sqliteTable(
  "movements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    operationId: text("operation_id")
      .notNull()
      .references(() => operations.id),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    locationId: text("location_id")
      .notNull()
      .references(() => locations.id),
    delta: integer("delta").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("move_once").on(t.operationId, t.productId, t.locationId),
    index("movement_product").on(t.productId),
  ],
);
