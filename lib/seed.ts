export async function seedInventory(
  db: D1Database,
  owner: string,
  actor: string,
) {
  const exists = await db
    .prepare("SELECT id FROM products WHERE owner=? LIMIT 1")
    .bind(owner)
    .first();
  if (exists) throw new Error("Sample inventory requires an empty workspace");
  const key = (v: string) => owner + ":sample:" + v,
    now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];
  for (const [id, warehouse, name] of [
    ["main", "Central warehouse", "Main store"],
    ["rack", "Central warehouse", "Production rack"],
    ["north", "North warehouse", "Dispatch bay"],
  ])
    statements.push(
      db
        .prepare(
          "INSERT OR IGNORE INTO locations(id,owner,warehouse,name) VALUES(?,?,?,?)",
        )
        .bind(key(id), owner, warehouse, name),
    );
  const sample = [
    ["steel", "Steel rods", "STL-001", "Raw materials", "kg", 30, 150, 100],
    ["chair", "Office chairs", "CHR-002", "Furniture", "units", 10, 40, 24],
    ["bolt", "Hex bolts M8", "BLT-003", "Hardware", "units", 100, 500, 65],
    ["glove", "Safety gloves", "GLV-004", "Safety", "pairs", 20, 80, 12],
    ["box", "Shipping cartons", "BOX-005", "Packaging", "units", 50, 200, 0],
  ] as const;
  for (const [id, name, sku, category, unit, reorder, target] of sample)
    statements.push(
      db
        .prepare(
          "INSERT OR IGNORE INTO products(id,owner,name,sku,category,unit,reorder,target) VALUES(?,?,?,?,?,?,?,?)",
        )
        .bind(
          key(id),
          owner,
          name,
          sku,
          category,
          unit,
          reorder * 1000,
          target * 1000,
        ),
    );
  function operation(
    id: string,
    kind: string,
    source: string | null,
    dest: string | null,
    partner: string,
    status: string,
    items: [string, number][],
    ago: number,
  ) {
    const timestamp = new Date(Date.now() - ago * 3600000).toISOString();
    statements.push(
      db
        .prepare(
          "INSERT OR IGNORE INTO operations(id,owner,reference,kind,status,source_id,dest_id,partner,note,actor,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          key(id),
          owner,
          id,
          kind,
          "Draft",
          source ? key(source) : null,
          dest ? key(dest) : null,
          partner,
          "Sample warehouse data",
          actor,
          timestamp,
          timestamp,
        ),
    );
    for (const [product, qty] of items)
      statements.push(
        db
          .prepare(
            "INSERT OR IGNORE INTO lines(id,operation_id,product_id,qty,expected_qty) VALUES(?,?,?,?,NULL)",
          )
          .bind(key(id + product), key(id), key(product), qty * 1000),
      );
    if (status !== "Draft")
      statements.push(
        db
          .prepare(
            "UPDATE operations SET status='Ready' WHERE id=? AND status='Draft'",
          )
          .bind(key(id)),
      );
    if (status === "Done")
      statements.push(
        db
          .prepare(
            "UPDATE operations SET status='Done' WHERE id=? AND status='Ready'",
          )
          .bind(key(id)),
      );
  }
  operation(
    "IN-1001",
    "receipt",
    null,
    "main",
    "Atlas Industrial",
    "Done",
    sample.filter((p) => p[7] > 0).map((p) => [p[0], p[7]]),
    48,
  );
  operation(
    "INT-1002",
    "transfer",
    "main",
    "rack",
    "",
    "Done",
    [["steel", 40]],
    24,
  );
  operation(
    "IN-1003",
    "receipt",
    null,
    "main",
    "Atlas Industrial",
    "Ready",
    [
      ["bolt", 200],
      ["glove", 50],
    ],
    3,
  );
  operation(
    "OUT-1004",
    "delivery",
    "main",
    null,
    "Northstar Offices",
    "Draft",
    [["chair", 10]],
    2,
  );
  operation(
    "INT-1005",
    "transfer",
    "main",
    "north",
    "",
    "Ready",
    [["steel", 20]],
    1,
  );
  await db.batch(statements);
}
