"use client";
import { useState } from "react";
import { Plus, Trash2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Inventory, Product, formatQty, kinds } from "@/lib/inventory";
export type Mutate = (action: string, data?: unknown) => Promise<any>;
export function Choice({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export const kindNames = {
  receipt: "Receipt",
  delivery: "Delivery",
  transfer: "Internal transfer",
  adjustment: "Stock adjustment",
};
function Modal({
  title,
  description,
  close,
  children,
}: {
  title: string;
  description: string;
  close: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="form-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export function ProductForm({
  product,
  mutate,
  close,
}: {
  product?: Product;
  mutate: Mutate;
  close: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal
      title={product ? "Edit product" : "New product"}
      description="Stock is added through a receipt, so every opening balance has a history."
      close={close}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          try {
            await mutate("product", {
              id: product?.id,
              name: f.get("name"),
              sku: f.get("sku"),
              category: f.get("category"),
              unit: f.get("unit"),
              reorder: Math.round(Number(f.get("reorder")) * 1000),
              target: Math.round(Number(f.get("target")) * 1000),
            });
            close();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Product name">
          <Input
            name="name"
            required
            maxLength={120}
            defaultValue={product?.name}
            placeholder="e.g. Steel rods"
          />
        </Field>
        <div className="form-grid">
          <Field label="SKU / code">
            <Input
              name="sku"
              required
              maxLength={120}
              defaultValue={product?.sku}
              placeholder="STL-001"
            />
          </Field>
          <Field label="Category">
            <Input
              name="category"
              required
              maxLength={120}
              defaultValue={product?.category}
              placeholder="Raw materials"
            />
          </Field>
        </div>
        <Field
          label="Unit of measure"
          hint={
            product
              ? "The unit stays fixed to protect historical quantities."
              : undefined
          }
        >
          <Input
            name="unit"
            required
            readOnly={!!product}
            defaultValue={product?.unit || "units"}
            maxLength={120}
          />
        </Field>
        <div className="form-grid">
          <Field label="Reorder point">
            <Input
              name="reorder"
              type="number"
              required
              min="0"
              max="1000000000"
              step="0.001"
              defaultValue={(product?.reorder ?? 10000) / 1000}
            />
          </Field>
          <Field label="Target stock">
            <Input
              name="target"
              type="number"
              required
              min="0"
              max="1000000000"
              step="0.001"
              defaultValue={(product?.target ?? 50000) / 1000}
            />
          </Field>
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="form-actions">
          <Button type="button" variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button disabled={busy}>{busy ? "Saving…" : "Save product"}</Button>
        </div>
      </form>
    </Modal>
  );
}
export function LocationForm({
  mutate,
  close,
}: {
  mutate: Mutate;
  close: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal
      title="Add warehouse location"
      description="Group racks, stores, and dispatch areas under a warehouse."
      close={close}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          try {
            await mutate("location", {
              warehouse: f.get("warehouse"),
              name: f.get("name"),
            });
            close();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Warehouse">
          <Input
            required
            name="warehouse"
            maxLength={120}
            placeholder="Central warehouse"
          />
        </Field>
        <Field label="Location">
          <Input
            required
            name="name"
            maxLength={120}
            placeholder="Main store"
          />
        </Field>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="form-actions">
          <Button type="button" variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button disabled={busy}>Save location</Button>
        </div>
      </form>
    </Modal>
  );
}
export function OperationForm({
  inventory,
  initialKind,
  initialProduct,
  initialLocation,
  mutate,
  close,
  onCreated,
}: {
  inventory: Inventory;
  initialKind: (typeof kinds)[number];
  initialProduct?: Product;
  initialLocation?: string;
  mutate: Mutate;
  close: () => void;
  onCreated: (id: string) => void;
}) {
  const [id] = useState(() => crypto.randomUUID()),
    [kind, setKind] = useState(initialKind),
    [source, setSource] = useState(
      initialLocation || inventory.locations[0]?.id || "",
    ),
    [dest, setDest] = useState(
      initialLocation ||
        inventory.locations[initialKind === "transfer" ? 1 : 0]?.id ||
        "",
    ),
    [partner, setPartner] = useState(""),
    [note, setNote] = useState(""),
    [scheduledAt, setScheduledAt] = useState(() => {
      const d = new Date();
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [openingBalances] = useState(inventory.balances);
  const available = (p: string, l: string) =>
    openingBalances.find((b) => b.product_id === p && b.location_id === l)
      ?.qty || 0;
  const total = (p: string) =>
    openingBalances
      .filter(
        (b) =>
          b.product_id === p &&
          (!initialLocation || b.location_id === initialLocation),
      )
      .reduce((s, b) => s + b.qty, 0);
  const first = initialProduct || inventory.products[0];
  const [lines, setLines] = useState([
    {
      productId: first?.id || "",
      qty: initialProduct
        ? String(
            Math.max(0, initialProduct.target - total(initialProduct.id)) /
              1000,
          )
        : "1",
    },
  ]);
  const locOptions = inventory.locations.map((l) => ({
    value: l.id,
    label: l.warehouse + " / " + l.name,
  }));
  const change = (i: number, key: "productId" | "qty", v: string) =>
    setLines(lines.map((l, n) => (n === i ? { ...l, [key]: v } : l)));
  const kindLabel = kindNames[kind];
  return (
    <Modal
      title={`New ${kindLabel.toLowerCase()}`}
      description="Save a draft, review the quantities, then validate to update stock."
      close={close}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const data = {
              id,
              kind,
              sourceId: kind === "receipt" ? null : source,
              destId: ["receipt", "transfer"].includes(kind) ? dest : null,
              partner,
              note,
              scheduledAt:
                kind === "transfer"
                  ? new Date(scheduledAt).toISOString()
                  : null,
              lines: lines.map((l) => ({
                productId: l.productId,
                qty: Math.round(Number(l.qty) * 1000),
                expectedQty:
                  kind === "adjustment" ? available(l.productId, source) : null,
              })),
            };
            await mutate("operation", data);
            close();
            onCreated(id);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Operation type">
          <Choice
            value={kind}
            onChange={(v) => setKind(v as typeof kind)}
            label="Operation type"
            options={kinds.map((k) => ({ value: k, label: kindNames[k] }))}
          />
        </Field>
        <div className="form-grid">
          {kind !== "receipt" && (
            <Field
              label={kind === "adjustment" ? "Count location" : "From location"}
            >
              <Choice
                value={source}
                onChange={setSource}
                options={locOptions}
                label="Source location"
              />
            </Field>
          )}
          {["receipt", "transfer"].includes(kind) && (
            <Field label="To location">
              <Choice
                value={dest}
                onChange={setDest}
                options={locOptions}
                label="Destination location"
              />
            </Field>
          )}
        </div>
        {kind === "transfer" && (
          <Field
            label="Scheduled date and time"
            hint="Shown in your local time zone. Validation is always a deliberate action."
          >
            <Input
              type="datetime-local"
              required
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </Field>
        )}
        {["receipt", "delivery"].includes(kind) && (
          <Field label={kind === "receipt" ? "Supplier" : "Customer"}>
            <Input
              value={partner}
              onChange={(e) => setPartner(e.target.value)}
              maxLength={120}
              placeholder={
                kind === "receipt" ? "Supplier name" : "Customer name"
              }
            />
          </Field>
        )}
        <div className="line-heading">
          <h3>Products</h3>
          <span>{kind === "adjustment" ? "Physical count" : "Quantity"}</span>
        </div>
        {lines.map((line, i) => {
          const p = inventory.products.find((p) => p.id === line.productId);
          return (
            <div key={i} className="operation-line">
              <div>
                <Choice
                  value={line.productId}
                  onChange={(v) => change(i, "productId", v)}
                  label={`Product ${i + 1}`}
                  options={inventory.products.map((p) => ({
                    value: p.id,
                    label: p.name + " · " + p.sku,
                  }))}
                />
                {kind !== "receipt" && (
                  <small>
                    Recorded here:{" "}
                    {formatQty(available(line.productId, source))} {p?.unit}
                  </small>
                )}
              </div>
              <div>
                <Input
                  aria-label={`${kind === "adjustment" ? "Counted" : "Quantity"} ${i + 1}`}
                  type="number"
                  min={kind === "adjustment" ? 0 : 0.001}
                  max="1000000000"
                  step="0.001"
                  required
                  value={line.qty}
                  onChange={(e) => change(i, "qty", e.target.value)}
                />
                <small>{p?.unit}</small>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove line ${i + 1}`}
                disabled={lines.length === 1}
                onClick={() => setLines(lines.filter((_, n) => n !== i))}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          );
        })}
        <Button
          type="button"
          variant="outline"
          disabled={lines.length >= 50}
          onClick={() =>
            setLines([
              ...lines,
              {
                productId:
                  inventory.products.find(
                    (p) => !lines.some((l) => l.productId === p.id),
                  )?.id || "",
                qty: "1",
              },
            ])
          }
        >
          <Plus size={16} />
          Add product
        </Button>
        <Field
          label={
            kind === "adjustment" ? "Reason for adjustment" : "Notes (optional)"
          }
        >
          <Input
            value={note}
            required={kind === "adjustment"}
            maxLength={1000}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              kind === "adjustment"
                ? "e.g. 3 kg damaged during handling"
                : "Reference, handling instructions…"
            }
          />
        </Field>
        {kind === "adjustment" && (
          <p className="info-note">
            Count the physical stock, not the difference. Validation records the
            difference and rejects a count if stock has changed since this form
            opened.
          </p>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="form-actions">
          <Button type="button" variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            disabled={
              busy || !inventory.products.length || !inventory.locations.length
            }
          >
            {busy ? "Saving…" : "Save draft"}
            <ArrowRight size={16} />
          </Button>
        </div>
      </form>
    </Modal>
  );
}
