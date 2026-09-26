import assert from "node:assert/strict";
const base = process.argv[2] || "http://localhost:5173";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("This smoke check is restricted to local development.");
const anonymous = await fetch(base + "/api/inventory");
assert.equal(anonymous.status, 401);
const signIn = await fetch(base + "/signin-with-chatgpt?return_to=%2F", {
  redirect: "manual",
});
assert.equal(signIn.status, 302);
const cookie = signIn.headers.get("set-cookie")?.split(";")[0];
assert.ok(cookie);
const read = async () => {
  const r = await fetch(base + "/api/inventory", { headers: { cookie } });
  assert.equal(r.status, 200);
  return r.json();
};
const post = (body, origin = base) =>
  fetch(base + "/api/inventory", {
    method: "POST",
    headers: { cookie, origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const before = await read();
assert.ok(Array.isArray(before.products));
assert.ok(before.user.email);
const invalid = await post({
  action: "product",
  data: {
    name: "",
    sku: "bad",
    category: "test",
    unit: "units",
    reorder: -1,
    target: 0,
  },
});
assert.equal(invalid.status, 400);
const forged = await post({ action: "seed" }, "https://untrusted.example");
assert.equal(forged.status, 403);
const missing = await post({
  action: "transition",
  data: { id: "nonexistent-smoke-test-document", status: "Done" },
});
assert.equal(missing.status, 404);
const done = before.operations.find((o) => o.status === "Done");
if (done) {
  const duplicate = await post({
    action: "transition",
    data: { id: done.id, status: "Done" },
  });
  assert.equal(duplicate.status, 200);
}
const after = await read();
assert.deepEqual(after.balances, before.balances);
assert.deepEqual(after.movements, before.movements);
assert.deepEqual(after.products, before.products);
console.log(
  "PASS: anonymous access, local sign-in, authenticated read, invalid input, cross-origin rejection, missing document, duplicate validation (when present), no stock or record changes.",
);
