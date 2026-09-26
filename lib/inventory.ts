import { z } from "zod";
export const kinds = ["receipt", "delivery", "transfer", "adjustment"] as const;
export const states = [
  "Draft",
  "Waiting",
  "Ready",
  "Done",
  "Canceled",
] as const;
const label = z.string().trim().min(1).max(120);
const qty = z.number().int().min(0).max(1_000_000_000_000);
export const productInput = z
  .object({
    id: z.string().optional(),
    name: label,
    sku: label.transform((v) => v.toUpperCase()),
    category: label,
    unit: label,
    reorder: qty,
    target: qty,
  })
  .refine(
    (v) => v.target >= v.reorder,
    "Target stock must be at least the reorder point.",
  );
export const locationInput = z.object({ warehouse: label, name: label });
export const operationInput = z
  .object({
    id: z.string().uuid(),
    kind: z.enum(kinds),
    sourceId: z.string().nullable(),
    destId: z.string().nullable(),
    partner: z.string().trim().max(120),
    note: z.string().trim().max(1000),
    scheduledAt: z.string().datetime().nullable().optional(),
    lines: z
      .array(z.object({ productId: label, qty, expectedQty: qty.nullable() }))
      .min(1)
      .max(50),
  })
  .superRefine((v, c) => {
    const err = (message: string) => c.addIssue({ code: "custom", message });
    if (v.kind !== "receipt" && !v.sourceId) err("Choose a source location.");
    if ((v.kind === "receipt" || v.kind === "transfer") && !v.destId)
      err("Choose a destination location.");
    if (v.kind === "transfer" && v.sourceId === v.destId)
      err("Choose two different locations.");
    if (v.kind !== "adjustment" && v.lines.some((l) => l.qty === 0))
      err("Quantities must be greater than zero.");
    if (v.kind === "adjustment" && v.lines.some((l) => l.expectedQty === null))
      err("A recorded quantity is required for a count.");
    if (new Set(v.lines.map((l) => l.productId)).size !== v.lines.length)
      err("Use one line per product.");
    if (v.kind === "adjustment" && !v.note)
      err("Add a reason for the adjustment.");
  });
export type Product = {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  reorder: number;
  target: number;
};
export type Location = { id: string; warehouse: string; name: string };
export type Balance = { product_id: string; location_id: string; qty: number };
export type Operation = {
  id: string;
  reference: string;
  kind: (typeof kinds)[number];
  status: (typeof states)[number];
  source_id: string | null;
  dest_id: string | null;
  partner: string;
  note: string;
  actor: string;
  created_at: string;
  updated_at: string;
  scheduled_at: string | null;
  picked_at: string | null;
  packed_at: string | null;
};
export type Line = {
  id: string;
  operation_id: string;
  product_id: string;
  qty: number;
  expected_qty: number | null;
};
export type Movement = {
  id: number;
  operation_id: string;
  product_id: string;
  location_id: string;
  delta: number;
  balance_after: number;
  created_at: string;
};
export type Inventory = {
  products: Product[];
  locations: Location[];
  balances: Balance[];
  operations: Operation[];
  lines: Line[];
  movements: Movement[];
  user: { name: string; email: string };
};
export const formatQty = (n: number) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: 3 }).format(n / 1000);
