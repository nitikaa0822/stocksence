import { getAppUser } from "@/lib/auth";
import { database } from "@/lib/database";
import { productInput, locationInput, operationInput } from "@/lib/inventory";
import { seedInventory } from "@/lib/seed";
import { z } from "zod";
export const dynamic = "force-dynamic";
function failure(e: unknown) {
  console.error("Inventory request failed", e);
  if (e instanceof z.ZodError)
    return Response.json(
      { error: e.issues.map((i) => i.message).join(" ") },
      { status: 400 },
    );
  const message = String(e);
  const known = [
    [
      "delivery_not_packed",
      "Pick and pack this delivery before validating it.",
    ],
    ["delivery_not_picked", "Pick this delivery before packing it."],
    [
      "stock_nonnegative",
      "Insufficient stock at the source location. Nothing was changed.",
    ],
    [
      "stale_count",
      "Stock changed after this count was entered. Create a fresh adjustment.",
    ],
    ["UNIQUE constraint failed: products", "That SKU already exists."],
    ["UNIQUE constraint failed: locations", "That location already exists."],
    [
      "invalid_transition",
      "That operation can no longer make this transition. Refresh and try again.",
    ],
    ["immutable", "Validated records cannot be edited."],
    ["invalid_document", "Check the document locations and quantities."],
  ];
  for (const [match, error] of known)
    if (message.includes(match))
      return Response.json({ error }, { status: 409 });
  return Response.json(
    {
      error:
        "The inventory service is unavailable. Your input is preserved; please try again.",
    },
    { status: 503 },
  );
}
export async function GET() {
  try {
    const user = await getAppUser();
    if (!user)
      return Response.json(
        { error: "Sign in to access inventory." },
        { status: 401 },
      );
    const db = database(),
      owner = user.userId;
    const result = await db.batch([
      db
        .prepare(
          "SELECT id,name,sku,category,unit,reorder,target FROM products WHERE owner=? ORDER BY name",
        )
        .bind(owner),
      db
        .prepare(
          "SELECT id,warehouse,name FROM locations WHERE owner=? ORDER BY warehouse,name",
        )
        .bind(owner),
      db
        .prepare(
          "SELECT b.* FROM balances b JOIN products p ON p.id=b.product_id WHERE p.owner=?",
        )
        .bind(owner),
      db
        .prepare(
          "SELECT * FROM operations WHERE owner=? ORDER BY created_at DESC,id DESC",
        )
        .bind(owner),
      db
        .prepare(
          "SELECT l.* FROM lines l JOIN operations o ON o.id=l.operation_id WHERE o.owner=?",
        )
        .bind(owner),
      db
        .prepare(
          "SELECT m.* FROM movements m JOIN operations o ON o.id=m.operation_id WHERE o.owner=? ORDER BY m.id DESC",
        )
        .bind(owner),
    ]);
    return Response.json(
      Object.fromEntries([
        ...[
          "products",
          "locations",
          "balances",
          "operations",
          "lines",
          "movements",
        ].map((key, i) => [key, result[i].results]),
        ["user", { name: user.displayName, email: user.email }],
      ]),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const user = await getAppUser();
    if (!user)
      return Response.json(
        { error: "Sign in to access inventory." },
        { status: 401 },
      );
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      return Response.json(
        { error: "Invalid request origin." },
        { status: 403 },
      );
    const body = await request.text();
    if (body.length > 50000)
      return Response.json({ error: "Request too large." }, { status: 413 });
    let raw;
    try {
      raw = JSON.parse(body);
    } catch {
      return Response.json({ error: "Invalid request." }, { status: 400 });
    }
    const input = z
      .object({
        action: z.enum([
          "product",
          "location",
          "operation",
          "transition",
          "seed",
          "delivery-step",
        ]),
        data: z.unknown().optional(),
      })
      .parse(raw);
    const db = database(),
      owner = user.userId,
      now = new Date().toISOString();
    if (input.action === "seed") {
      await seedInventory(db, owner, user.email);
      return Response.json({ ok: true });
    }
    if (input.action === "product") {
      const p = productInput.parse(input.data);
      if (p.id) {
        const result = await db
          .prepare(
            "UPDATE products SET name=?,sku=?,category=?,reorder=?,target=? WHERE id=? AND owner=? AND unit=?",
          )
          .bind(
            p.name,
            p.sku,
            p.category,
            p.reorder,
            p.target,
            p.id,
            owner,
            p.unit,
          )
          .run();
        if (!result.meta.changes)
          return Response.json(
            {
              error:
                "Product not found or unit changed. Units cannot change after creation.",
            },
            { status: 409 },
          );
      } else
        await db
          .prepare(
            "INSERT INTO products(id,owner,name,sku,category,unit,reorder,target) VALUES(?,?,?,?,?,?,?,?)",
          )
          .bind(
            crypto.randomUUID(),
            owner,
            p.name,
            p.sku,
            p.category,
            p.unit,
            p.reorder,
            p.target,
          )
          .run();
      return Response.json({ ok: true });
    }
    if (input.action === "location") {
      const l = locationInput.parse(input.data);
      await db
        .prepare(
          "INSERT INTO locations(id,owner,warehouse,name) VALUES(?,?,?,?)",
        )
        .bind(crypto.randomUUID(), owner, l.warehouse, l.name)
        .run();
      return Response.json({ ok: true });
    }
    if (input.action === "operation") {
      const o = operationInput.parse(input.data);
      const existing = await db
        .prepare("SELECT id FROM operations WHERE id=? AND owner=?")
        .bind(o.id, owner)
        .first();
      if (existing) return Response.json({ ok: true, id: o.id });
      const owned = await db
        .prepare("SELECT id FROM products WHERE owner=?")
        .bind(owner)
        .all<{ id: string }>();
      if (o.lines.some((l) => !owned.results.some((p) => p.id === l.productId)))
        return Response.json({ error: "Product not found." }, { status: 400 });
      const locs = await db
        .prepare("SELECT id FROM locations WHERE owner=?")
        .bind(owner)
        .all<{ id: string }>();
      if (
        [o.sourceId, o.destId].some(
          (id) => id && !locs.results.some((l) => l.id === id),
        )
      )
        return Response.json({ error: "Location not found." }, { status: 400 });
      const source = o.kind === "receipt" ? null : o.sourceId,
        dest = ["receipt", "transfer"].includes(o.kind) ? o.destId : null;
      const ref =
        { receipt: "IN", delivery: "OUT", transfer: "INT", adjustment: "ADJ" }[
          o.kind
        ] +
        "-" +
        o.id.slice(0, 8).toUpperCase();
      await db.batch([
        db
          .prepare(
            "INSERT INTO operations(id,owner,reference,kind,status,source_id,dest_id,partner,note,actor,created_at,updated_at,scheduled_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            o.id,
            owner,
            ref,
            o.kind,
            "Draft",
            source,
            dest,
            o.partner,
            o.note,
            user.email,
            now,
            now,
            o.kind === "transfer" ? o.scheduledAt || now : null,
          ),
        ...o.lines.map((l) =>
          db
            .prepare(
              "INSERT INTO lines(id,operation_id,product_id,qty,expected_qty) VALUES(?,?,?,?,?)",
            )
            .bind(
              crypto.randomUUID(),
              o.id,
              l.productId,
              l.qty,
              o.kind === "adjustment" ? l.expectedQty : null,
            ),
        ),
      ]);
      return Response.json({ ok: true, id: o.id });
    }
    if (input.action === "delivery-step") {
      const step = z
        .object({ id: z.string(), step: z.enum(["pick", "pack"]) })
        .parse(input.data);
      const current = await db
        .prepare(
          "SELECT kind,status,picked_at,packed_at FROM operations WHERE id=? AND owner=?",
        )
        .bind(step.id, owner)
        .first<{
          kind: string;
          status: string;
          picked_at: string | null;
          packed_at: string | null;
        }>();
      if (!current || current.kind !== "delivery")
        return Response.json({ error: "Delivery not found." }, { status: 404 });
      if (current.status === "Canceled")
        return Response.json(
          { error: "This delivery was canceled." },
          { status: 409 },
        );
      if (
        (step.step === "pick" && current.picked_at) ||
        (step.step === "pack" && current.packed_at)
      )
        return Response.json({ ok: true });
      if (
        step.step === "pick" &&
        ["Draft", "Waiting"].includes(current.status)
      ) {
        await db
          .prepare(
            "UPDATE operations SET status='Waiting',picked_at=?,actor=?,updated_at=? WHERE id=? AND owner=? AND picked_at IS NULL AND status IN ('Draft','Waiting')",
          )
          .bind(now, user.email, now, step.id, owner)
          .run();
      } else if (
        step.step === "pack" &&
        current.status === "Waiting" &&
        current.picked_at
      ) {
        await db
          .prepare(
            "UPDATE operations SET status='Ready',packed_at=?,actor=?,updated_at=? WHERE id=? AND owner=? AND packed_at IS NULL AND picked_at IS NOT NULL AND status='Waiting'",
          )
          .bind(now, user.email, now, step.id, owner)
          .run();
      } else
        return Response.json(
          {
            error:
              "Complete picking before packing; completed deliveries cannot change.",
          },
          { status: 409 },
        );
      return Response.json({ ok: true });
    }
    const t = z
      .object({
        id: z.string(),
        status: z.enum(["Waiting", "Ready", "Done", "Canceled"]),
      })
      .parse(input.data);
    const current = await db
      .prepare("SELECT status FROM operations WHERE id=? AND owner=?")
      .bind(t.id, owner)
      .first<{ status: string }>();
    if (!current)
      return Response.json({ error: "Operation not found." }, { status: 404 });
    if (current.status === t.status) return Response.json({ ok: true });
    const allowed: Record<string, string[]> = {
      Draft: ["Waiting", "Ready", "Canceled"],
      Waiting: ["Ready", "Canceled"],
      Ready: ["Done", "Canceled"],
    };
    if (!allowed[current.status]?.includes(t.status))
      return Response.json(
        { error: "This operation cannot make that transition." },
        { status: 409 },
      );
    const result = await db
      .prepare(
        "UPDATE operations SET status=?,actor=?,updated_at=? WHERE id=? AND owner=? AND status=?",
      )
      .bind(t.status, user.email, now, t.id, owner, current.status)
      .run();
    if (!result.meta.changes) {
      const latest = await db
        .prepare("SELECT status FROM operations WHERE id=? AND owner=?")
        .bind(t.id, owner)
        .first<{ status: string }>();
      if (latest?.status !== t.status)
        return Response.json(
          { error: "Operation changed. Refresh and try again." },
          { status: 409 },
        );
    }
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
