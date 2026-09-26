"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Boxes,
  LayoutDashboard,
  Package,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  ClipboardCheck,
  History,
  Warehouse,
  Plus,
  ShieldCheck,
  Search,
  RefreshCw,
  ArrowRight,
  AlertTriangle,
  Download,
  CheckCircle2,
  UserRound,
  LogOut,
  Pencil,
  CircleHelp,
} from "lucide-react";
import {
  Sidebar,
  SidebarProvider,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  Inventory,
  Product,
  Operation,
  kinds,
  states,
  formatQty as q,
} from "@/lib/inventory";
import {
  ProductForm,
  LocationForm,
  OperationForm,
  Choice,
  kindNames,
} from "./forms";
const nav = [
  [LayoutDashboard, "Overview"],
  [Package, "Products"],
  [ArrowDownLeft, "Receipts"],
  [ArrowUpRight, "Deliveries"],
  [ArrowLeftRight, "Transfers"],
  [ClipboardCheck, "Adjustments"],
  [History, "Move history"],
  [Warehouse, "Warehouses"],
] as const;
type View = (typeof nav)[number][1] | "Profile";
const viewKind: Partial<Record<View, (typeof kinds)[number]>> = {
  Receipts: "receipt",
  Deliveries: "delivery",
  Transfers: "transfer",
  Adjustments: "adjustment",
};
const icons = {
  receipt: ArrowDownLeft,
  delivery: ArrowUpRight,
  transfer: ArrowLeftRight,
  adjustment: ClipboardCheck,
};
const date = (d: string) =>
  new Date(d).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
function Status({ value }: { value: string }) {
  return (
    <span
      className={`status status-${value.toLowerCase().replaceAll(" ", "-")}`}
    >
      {value}
    </span>
  );
}
function Empty({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <Boxes size={34} />
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}
export default function StockSense() {
  const [data, setData] = useState<Inventory | null>(null),
    [error, setError] = useState(""),
    [unauthorized, setUnauthorized] = useState(false),
    [view, setView] = useState<View>("Overview"),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [location, setLocation] = useState("all"),
    [warehouse, setWarehouse] = useState("all"),
    [category, setCategory] = useState("all"),
    [kindFilter, setKindFilter] = useState("all"),
    [modal, setModal] = useState<"product" | "location" | "operation" | null>(
      null,
    ),
    [editing, setEditing] = useState<Product | undefined>(),
    [opKind, setOpKind] = useState<(typeof kinds)[number]>("receipt"),
    [reorder, setReorder] = useState<Product | undefined>(),
    [detail, setDetail] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [refreshing, setRefreshing] = useState(false),
    [cancelId, setCancelId] = useState<string | null>(null),
    [onlyLow, setOnlyLow] = useState(false),
    [synced, setSynced] = useState<Date | null>(null);
  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await fetch("/api/inventory", { cache: "no-store" });
      const result = (await r.json()) as Inventory & {
        error?: string;
        ok?: boolean;
      };
      setUnauthorized(r.status === 401);
      if (!r.ok) throw new Error(result.error || "Could not load inventory.");
      setData(result);
      setError("");
      setSynced(new Date());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 5000);
    return () => clearInterval(timer);
  }, [load]);
  useEffect(() => {
    const onHash = () => {
      const v = decodeURIComponent(window.location.hash.slice(1));
      if (nav.some((n) => n[1] === v) || v === "Profile") setView(v as View);
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  function go(v: View) {
    setView(v);
    window.location.hash = encodeURIComponent(v);
    setSearch("");
    setStatus("all");
    setOnlyLow(false);
    setKindFilter("all");
  }
  async function mutate(action: string, payload?: unknown) {
    const r = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, data: payload }),
    });
    const result = (await r.json()) as Inventory & {
      error?: string;
      ok?: boolean;
    };
    if (!r.ok) throw new Error(result.error || "Could not save.");
    await load();
    return result;
  }
  async function deliveryStep(id: string, step: "pick" | "pack") {
    setBusy(true);
    try {
      await mutate("delivery-step", { id, step });
      toast.success(
        step === "pick"
          ? "Items picked. Pack them next."
          : "Packed and ready to validate.",
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function transition(id: string, value: string) {
    setBusy(true);
    try {
      await mutate("transition", { id, status: value });
      toast.success(
        value === "Done"
          ? "Validated. Stock and movement history updated."
          : `Operation marked ${value.toLowerCase()}.`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function start(k: (typeof kinds)[number], p?: Product) {
    if (!data?.products.length) {
      toast.info("Create a product first.");
      setEditing(undefined);
      setModal("product");
      return;
    }
    if (!data.locations.length) {
      toast.info("Add a warehouse location first.");
      setModal("location");
      return;
    }
    setOpKind(k);
    setReorder(p);
    setModal("operation");
  }
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    Promise.resolve(
      context.registerTool(
        {
          name: "read_inventory",
          title: "Read StockSense inventory",
          description:
            "Read current stock balances, products, and operation status from the signed-in inventory workspace.",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          execute: async (input: unknown) => {
            if (
              !input ||
              typeof input !== "object" ||
              Object.keys(input).length
            )
              throw new Error("Expected an empty object.");
            const r = await fetch("/api/inventory", { cache: "no-store" });
            const result = (await r.json()) as Inventory & {
              error?: string;
              ok?: boolean;
            };
            if (!r.ok) throw new Error(result.error);
            setData(result);
            return {
              products: result.products,
              balances: result.balances,
              operations: result.operations,
            };
          },
        },
        { signal: controller.signal },
      ),
    ).catch(() => {});
    return () => controller.abort();
  }, []);
  const balance = (id: string, loc = location) =>
    data?.balances
      .filter(
        (b) =>
          b.product_id === id &&
          (loc === "all" || b.location_id === loc) &&
          (warehouse === "all" ||
            data?.locations.find((l) => l.id === b.location_id)?.warehouse ===
              warehouse),
      )
      .reduce((s, b) => s + b.qty, 0) || 0;
  const locName = (id: string | null) => {
    const l = data?.locations.find((l) => l.id === id);
    return l ? l.warehouse + " / " + l.name : "—";
  };
  const product = (id: string) => data?.products.find((p) => p.id === id);
  const matchesProduct = (p: Product) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase());
  const products =
    data?.products.filter(
      (p) =>
        (category === "all" || p.category === category) &&
        matchesProduct(p) &&
        (!onlyLow || balance(p.id) <= p.reorder),
    ) || [];
  const low = (data?.products || [])
    .filter(
      (p) =>
        (category === "all" || p.category === category) &&
        balance(p.id) <= p.reorder,
    )
    .sort((a, b) => balance(a.id) - balance(b.id));
  const operationMatches = (o: Operation) => {
    const ls = data?.lines.filter((l) => l.operation_id === o.id) || [];
    return (
      (warehouse === "all" ||
        data?.locations.some(
          (l) =>
            l.warehouse === warehouse &&
            (l.id === o.source_id || l.id === o.dest_id),
        )) &&
      (location === "all" ||
        o.source_id === location ||
        o.dest_id === location) &&
      (category === "all" ||
        ls.some((l) => product(l.product_id)?.category === category)) &&
      (status === "all" || o.status === status) &&
      (kindFilter === "all" || o.kind === kindFilter) &&
      (!search ||
        [
          o.reference,
          o.partner,
          ...ls.map((l) => product(l.product_id)?.name || ""),
          ...ls.map((l) => product(l.product_id)?.sku || ""),
        ]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase()))
    );
  };
  const operations = (data?.operations || []).filter(
    (o) =>
      operationMatches(o) && (!viewKind[view] || o.kind === viewKind[view]),
  );
  const pending = (kind: string) =>
    (data?.operations || []).filter(
      (o) =>
        operationMatches(o) &&
        o.kind === kind &&
        !["Done", "Canceled"].includes(o.status),
    ).length;
  const selected = data?.operations.find((o) => o.id === detail);
  const stockState = (p: Product) =>
    balance(p.id) === 0
      ? "Out of stock"
      : balance(p.id) <= p.reorder
        ? "Low stock"
        : "In stock";
  const categories = [...new Set(data?.products.map((p) => p.category))].sort();
  const queue =
    view === "Overview"
      ? operations
          .filter(
            (o) => status !== "all" || !["Done", "Canceled"].includes(o.status),
          )
          .slice(0, 6)
      : operations;
  function csv() {
    if (!data) return;
    const cell = (v: unknown) =>
      '"' +
      String(v ?? "")
        .replace(/^[=+\-@\t\r]/, "'$&")
        .replaceAll('"', '""') +
      '"';
    const rows = [
      [
        "Timestamp",
        "Operation",
        "Type",
        "SKU",
        "Product",
        "Warehouse / location",
        "Change",
        "Unit",
        "Balance after",
        "Actor",
        "Reason",
      ],
      ...data.movements
        .filter(
          (m) =>
            (location === "all" || m.location_id === location) &&
            (warehouse === "all" ||
              data.locations.some(
                (l) => l.id === m.location_id && l.warehouse === warehouse,
              )) &&
            (!search ||
              [product(m.product_id)?.name, product(m.product_id)?.sku]
                .join(" ")
                .toLowerCase()
                .includes(search.toLowerCase())) &&
            (category === "all" ||
              product(m.product_id)?.category === category),
        )
        .map((m) => {
          const o = data.operations.find((o) => o.id === m.operation_id);
          const p = product(m.product_id);
          return [
            m.created_at,
            o?.reference,
            o?.kind,
            p?.sku,
            p?.name,
            locName(m.location_id),
            m.delta / 1000,
            p?.unit,
            m.balance_after / 1000,
            o?.actor,
            o?.note,
          ];
        }),
    ];
    const url = URL.createObjectURL(
      new Blob(
        ["\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "stocksense-movement-history.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  function OperationsTable() {
    return queue.length ? (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reference / partner</TableHead>
            <TableHead>Operation</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>
              <span className="sr-only">Open</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {queue.map((o) => {
            const Icon = icons[o.kind];
            return (
              <TableRow key={o.id}>
                <TableCell>
                  <button className="reference" onClick={() => setDetail(o.id)}>
                    {o.reference}
                  </button>
                  <small className="cell-sub">
                    {o.partner || "Internal operation"}
                  </small>
                </TableCell>
                <TableCell>
                  <span className="kind-label">
                    <span className={`kind-icon ${o.kind}`}>
                      <Icon size={16} />
                    </span>
                    {kindNames[o.kind]}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="location-cell">
                    {locName(o.kind === "receipt" ? o.dest_id : o.source_id)}
                  </span>
                </TableCell>
                <TableCell>
                  <Status value={o.status} />
                </TableCell>
                <TableCell className="muted">{date(o.created_at)}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Open ${o.reference}`}
                    onClick={() => setDetail(o.id)}
                  >
                    <ArrowRight size={16} />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    ) : (
      <Empty
        title="No operations here"
        text="Create an operation or change the filters to see more results."
      />
    );
  }
  const title =
    (
      {
        Overview: "Inventory overview",
        Products: "Product catalog",
        "Move history": "Movement history",
        Warehouses: "Warehouses & locations",
        Profile: "My profile",
      } as Partial<Record<View, string>>
    )[view] || view;
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <button className="brand" onClick={() => go("Overview")}>
            <span>
              <Boxes size={25} />
            </span>
            StockSense<b>INVENTORY WORKSPACE</b>
          </button>
        </SidebarHeader>
        <SidebarContent>
          <div className="nav-label">WORKSPACE</div>
          <SidebarMenu>
            {nav.map(([Icon, name]) => (
              <SidebarMenuItem key={name}>
                <SidebarMenuButton
                  isActive={view === name}
                  onClick={() => go(name)}
                >
                  <Icon />
                  <span>{name}</span>
                  {name === "Products" && data && (
                    <small className="nav-count">{data.products.length}</small>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          <div className="sidebar-tip">
            <ShieldCheck size={22} />
            <strong>Every move has a story.</strong>
            <p>Trace a stock change back to its source document.</p>
            <button onClick={() => go("Move history")}>
              Explore your ledger <ArrowRight size={14} />
            </button>
          </div>
        </SidebarContent>
        <SidebarFooter>
          <button className="profile-link" onClick={() => go("Profile")}>
            <span className="avatar">
              {data?.user.name.slice(0, 1).toUpperCase() || "S"}
            </span>
            <span>
              {data?.user.name || "Your workspace"}
              <small>Inventory manager</small>
            </span>
          </button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="topbar">
          <SidebarTrigger />
          <span>
            Workspace / <strong>{view}</strong>
          </span>
          <div className="topbar-right">
            <span className="sync-text">
              {refreshing
                ? "Syncing…"
                : synced
                  ? `Updated ${synced.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
                  : "Connecting…"}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Refresh inventory"
              disabled={refreshing}
              onClick={() => void load()}
            >
              <RefreshCw size={17} className={refreshing ? "spin" : ""} />
            </Button>
            <button
              className="avatar avatar-small"
              aria-label="My profile"
              onClick={() => go("Profile")}
            >
              {data?.user.name.slice(0, 1).toUpperCase() || "S"}
            </button>
          </div>
        </header>
        <main className="workspace">
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {view === "Overview"
                  ? "YOUR OPERATIONS, AT A GLANCE"
                  : "STOCKSENSE WORKSPACE"}
              </p>
              <h1>{title}</h1>
              <p>
                {view === "Overview"
                  ? "Know what’s on hand. Keep goods moving."
                  : view === "Products"
                    ? "A single source of truth for every SKU."
                    : view === "Move history"
                      ? "A permanent record of validated stock changes."
                      : view === "Warehouses"
                        ? "Track exactly where your inventory lives."
                        : view === "Profile"
                          ? "Your account and workspace access."
                          : "Create, review, and validate your stock operations."}
              </p>
            </div>
            <div className="heading-actions">
              {view === "Move history" ? (
                <Button variant="outline" onClick={csv} disabled={!data}>
                  <Download size={16} />
                  Export CSV
                </Button>
              ) : view === "Products" ? (
                <Button
                  onClick={() => {
                    setEditing(undefined);
                    setModal("product");
                  }}
                >
                  <Plus />
                  New product
                </Button>
              ) : view === "Warehouses" ? (
                <Button onClick={() => setModal("location")}>
                  <Plus />
                  Add location
                </Button>
              ) : (
                view !== "Profile" && (
                  <Button
                    disabled={!data}
                    onClick={() => start(viewKind[view] || "receipt")}
                  >
                    <Plus />
                    New{" "}
                    {viewKind[view]
                      ? kindNames[viewKind[view]!].toLowerCase()
                      : "operation"}
                  </Button>
                )
              )}
            </div>
          </div>
          {error && (
            <div role="alert" className="error-banner">
              <AlertTriangle size={19} />
              <span>{error}</span>
              {unauthorized ? (
                <a href="/signin-with-chatgpt?return_to=%2F" target="_top">
                  Sign in
                </a>
              ) : (
                <button onClick={() => void load()}>Retry</button>
              )}
            </div>
          )}
          {!data && !error && (
            <div className="metrics">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-36 rounded-xl" />
              ))}
            </div>
          )}
          {data && (
            <>
              {view !== "Profile" && view !== "Warehouses" && (
                <div className="global-filters">
                  <Choice
                    label="Warehouse"
                    value={warehouse}
                    onChange={(value) => {
                      setWarehouse(value);
                      setLocation("all");
                    }}
                    options={[
                      { value: "all", label: "All warehouses" },
                      ...Array.from(
                        new Set(data.locations.map((l) => l.warehouse)),
                      ).map((w) => ({ value: w, label: w })),
                    ]}
                  />
                  <Choice
                    label="Location"
                    value={location}
                    onChange={setLocation}
                    options={[
                      { value: "all", label: "All locations" },
                      ...data.locations
                        .filter(
                          (l) =>
                            warehouse === "all" || l.warehouse === warehouse,
                        )
                        .map((l) => ({
                          value: l.id,
                          label: l.warehouse + " / " + l.name,
                        })),
                    ]}
                  />
                  <Choice
                    label="Product category"
                    value={category}
                    onChange={setCategory}
                    options={[
                      { value: "all", label: "All categories" },
                      ...categories.map((c) => ({ value: c, label: c })),
                    ]}
                  />
                  {(warehouse !== "all" ||
                    location !== "all" ||
                    category !== "all") && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setLocation("all");
                        setCategory("all");
                        setWarehouse("all");
                      }}
                    >
                      Clear filters
                    </Button>
                  )}
                  <span className="scope-note">
                    {location === "all"
                      ? warehouse === "all"
                        ? "Across your workspace"
                        : warehouse
                      : "Selected location"}
                  </span>
                </div>
              )}
              {!data.products.length && view === "Overview" ? (
                <section className="welcome panel">
                  <span className="welcome-icon">
                    <Boxes size={38} />
                  </span>
                  <p className="eyebrow">READY WHEN YOU ARE</p>
                  <h2>A clearer picture of your inventory.</h2>
                  <p>
                    Start with your products and warehouse locations, or explore
                    a sample warehouse with receipts, deliveries, and stock
                    alerts.
                  </p>
                  <div>
                    <Button
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await mutate("seed");
                          toast.success(
                            "Sample warehouse loaded. All stock is backed by real movements.",
                          );
                        } catch (e) {
                          toast.error((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {busy ? "Loading warehouse…" : "Explore sample warehouse"}
                      <ArrowRight size={16} />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditing(undefined);
                        setModal("product");
                      }}
                    >
                      Add my first product
                    </Button>
                  </div>
                  <small>Sample records are saved to your workspace.</small>
                </section>
              ) : (
                view === "Overview" && (
                  <>
                    <div className="metrics">
                      {[
                        {
                          label: "Products in stock",
                          value: data.products.filter(
                            (p) =>
                              (category === "all" || p.category === category) &&
                              balance(p.id) > 0,
                          ).length,
                          sub: "Distinct stocked SKUs",
                          Icon: Package,
                          color: "blue",
                          action: () => go("Products"),
                        },
                        {
                          label: "Needs attention",
                          value: low.length,
                          sub: `${low.filter((p) => balance(p.id) === 0).length} out of stock · ${low.filter((p) => balance(p.id) > 0).length} low stock`,
                          Icon: AlertTriangle,
                          color: "orange",
                          action: () => {
                            go("Products");
                            setOnlyLow(true);
                          },
                        },
                        {
                          label: "Pending receipts",
                          value: pending("receipt"),
                          sub: "Awaiting validation",
                          Icon: ArrowDownLeft,
                          color: "teal",
                          action: () => go("Receipts"),
                        },
                        {
                          label: "Pending deliveries",
                          value: pending("delivery"),
                          sub: "Waiting to leave",
                          Icon: ArrowUpRight,
                          color: "purple",
                          action: () => go("Deliveries"),
                        },
                        {
                          label: "Scheduled transfers",
                          value: data.operations.filter(
                            (o) =>
                              o.kind === "transfer" &&
                              o.scheduled_at &&
                              !["Done", "Canceled"].includes(o.status) &&
                              operationMatches(o),
                          ).length,
                          sub: "Planned between locations",
                          Icon: ArrowLeftRight,
                          color: "teal",
                          action: () => go("Transfers"),
                        },
                      ].map((m) => (
                        <button
                          className="metric"
                          key={m.label}
                          onClick={m.action}
                        >
                          <span>{m.label}</span>
                          <span className={`metric-icon ${m.color}`}>
                            <m.Icon size={19} />
                          </span>
                          <strong>{m.value}</strong>
                          <small>{m.sub}</small>
                        </button>
                      ))}
                    </div>
                    <div className="dashboard-grid">
                      <section className="panel attention-panel">
                        <div className="panel-heading">
                          <div>
                            <h2>Stock watch</h2>
                            <p>Replenish before work comes to a stop.</p>
                          </div>
                          <span className="count-pill">
                            {low.length} alerts
                          </span>
                        </div>
                        {low.length ? (
                          <div className="stock-watch">
                            {low.slice(0, 4).map((p) => (
                              <div className="watch-row" key={p.id}>
                                <span
                                  className={`product-icon ${balance(p.id) === 0 ? "critical" : ""}`}
                                >
                                  <Package size={20} />
                                </span>
                                <div>
                                  <strong>{p.name}</strong>
                                  <small>
                                    {p.sku} · reorder at {q(p.reorder)} {p.unit}
                                  </small>
                                </div>
                                <div className="watch-qty">
                                  <strong>
                                    {q(balance(p.id))}
                                    <small> {p.unit}</small>
                                  </strong>
                                  <Status value={stockState(p)} />
                                </div>
                                <Button
                                  variant="outline"
                                  onClick={() => start("receipt", p)}
                                  aria-label={`Replenish ${p.name}`}
                                >
                                  Replenish
                                  <Plus size={14} />
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <Empty
                            title="Stock levels look good"
                            text="No products are at or below their reorder point."
                          />
                        )}
                        <div className="panel-bottom">
                          <button
                            onClick={() => {
                              go("Products");
                              setOnlyLow(true);
                            }}
                          >
                            View stock alerts
                            <ArrowRight size={14} />
                          </button>
                          <span>Based on your reorder rules</span>
                        </div>
                      </section>
                      <section className="flow-panel">
                        <div className="flow-mark">
                          <ArrowLeftRight size={22} />
                        </div>
                        <p className="eyebrow">WAREHOUSE FLOW</p>
                        <h2>
                          Right stock.
                          <br />
                          Right place.
                        </h2>
                        <p>
                          Move goods between locations with both sides recorded
                          together.
                        </p>
                        <div className="flow-count">
                          <strong>{pending("transfer")}</strong>
                          <span>
                            transfers
                            <br />
                            scheduled
                          </span>
                        </div>
                        <Button
                          variant="secondary"
                          onClick={() => start("transfer")}
                        >
                          Create transfer
                          <ArrowRight size={16} />
                        </Button>
                        <div className="flow-footer">
                          <ShieldCheck size={15} />
                          Total stock stays unchanged
                        </div>
                      </section>
                    </div>
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Operations queue</h2>
                          <p>
                            Your next receipts, deliveries, transfers, and
                            counts.
                          </p>
                        </div>
                        <Button variant="ghost" onClick={() => go("Receipts")}>
                          All receipts
                          <ArrowRight size={16} />
                        </Button>
                      </div>
                      <div className="table-toolbar">
                        <Choice
                          value={kindFilter}
                          onChange={setKindFilter}
                          label="Document type"
                          options={[
                            { value: "all", label: "All operation types" },
                            ...kinds.map((k) => ({
                              value: k,
                              label: kindNames[k],
                            })),
                          ]}
                        />
                        <Choice
                          value={status}
                          onChange={setStatus}
                          label="Queue status"
                          options={[
                            { value: "all", label: "Pending documents" },
                            ...states.map((s) => ({ value: s, label: s })),
                          ]}
                        />
                      </div>
                      <OperationsTable />
                    </section>
                    <section className="activity-strip">
                      <ShieldCheck size={20} />
                      <div>
                        <strong>
                          {data.movements.length} recorded movements
                        </strong>
                        <span>
                          Each linked to a validated document, location, and
                          operator.
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() => go("Move history")}
                      >
                        View ledger
                        <ArrowRight size={16} />
                      </Button>
                    </section>
                  </>
                )
              )}
              {view === "Products" && (
                <section className="panel">
                  <div className="table-toolbar">
                    <div className="search-field">
                      <Search size={17} />
                      <Input
                        aria-label="Search products"
                        placeholder="Search name or SKU…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <Button
                      variant={onlyLow ? "default" : "outline"}
                      onClick={() => setOnlyLow(!onlyLow)}
                    >
                      <AlertTriangle size={16} />
                      Low stock{onlyLow ? " only" : ""}
                    </Button>
                    <span className="muted">{products.length} products</span>
                  </div>
                  {products.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product / SKU</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>On hand</TableHead>
                          <TableHead>Reorder / target</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {products.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>
                              <strong>{p.name}</strong>
                              <small className="cell-sub mono">{p.sku}</small>
                            </TableCell>
                            <TableCell>{p.category}</TableCell>
                            <TableCell>
                              <strong>{q(balance(p.id))}</strong>{" "}
                              <span className="muted">{p.unit}</span>
                            </TableCell>
                            <TableCell>
                              {q(p.reorder)} / {q(p.target)}
                            </TableCell>
                            <TableCell>
                              <Status value={stockState(p)} />
                            </TableCell>
                            <TableCell>
                              <div className="row-actions">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Edit ${p.name}`}
                                  onClick={() => {
                                    setEditing(p);
                                    setModal("product");
                                  }}
                                >
                                  <Pencil size={16} />
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => start("receipt", p)}
                                >
                                  Receive
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <Empty
                      title="No matching products"
                      text="Add a product or clear the search and filters."
                    />
                  )}
                </section>
              )}
              {viewKind[view] && (
                <section className="panel">
                  <div className="table-toolbar">
                    <div className="search-field">
                      <Search size={17} />
                      <Input
                        aria-label="Search operations"
                        placeholder="Search reference, partner, SKU…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <Choice
                      value={status}
                      onChange={setStatus}
                      label="Status"
                      options={[
                        { value: "all", label: "All statuses" },
                        ...states.map((s) => ({ value: s, label: s })),
                      ]}
                    />
                    <span className="muted">{operations.length} documents</span>
                  </div>
                  <OperationsTable />
                </section>
              )}
              {view === "Move history" && (
                <section className="panel">
                  <div className="table-toolbar">
                    <div className="search-field">
                      <Search size={17} />
                      <Input
                        aria-label="Search movement history"
                        placeholder="Search product or SKU…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <span className="ledger-note">
                      <ShieldCheck size={16} />
                      Append-only ledger
                    </span>
                  </div>
                  {data.movements.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product / operation</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Change</TableHead>
                          <TableHead>Balance after</TableHead>
                          <TableHead>When / operator</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.movements
                          .filter(
                            (m) =>
                              (warehouse === "all" ||
                                data.locations.some(
                                  (l) =>
                                    l.id === m.location_id &&
                                    l.warehouse === warehouse,
                                )) &&
                              (location === "all" ||
                                m.location_id === location) &&
                              (category === "all" ||
                                product(m.product_id)?.category === category) &&
                              (!search ||
                                matchesProduct(product(m.product_id)!)),
                          )
                          .map((m) => {
                            const p = product(m.product_id),
                              o = data.operations.find(
                                (o) => o.id === m.operation_id,
                              );
                            return (
                              <TableRow key={m.id}>
                                <TableCell>
                                  <strong>{p?.name}</strong>
                                  <button
                                    className="cell-sub reference"
                                    onClick={() => setDetail(m.operation_id)}
                                  >
                                    {o?.reference} · {o && kindNames[o.kind]}
                                  </button>
                                </TableCell>
                                <TableCell>{locName(m.location_id)}</TableCell>
                                <TableCell
                                  className={
                                    m.delta > 0
                                      ? "positive"
                                      : m.delta < 0
                                        ? "negative"
                                        : ""
                                  }
                                >
                                  <strong>
                                    {m.delta > 0 ? "+" : ""}
                                    {q(m.delta)}
                                  </strong>{" "}
                                  {p?.unit}
                                </TableCell>
                                <TableCell>
                                  {q(m.balance_after)} {p?.unit}
                                </TableCell>
                                <TableCell>
                                  {date(m.created_at)}
                                  <small className="cell-sub">{o?.actor}</small>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  ) : (
                    <Empty
                      title="No movements yet"
                      text="Validate your first operation to record a stock movement."
                    />
                  )}
                </section>
              )}
              {view === "Warehouses" && (
                <div className="warehouse-grid">
                  {data.locations.length ? (
                    data.locations.map((l) => (
                      <section className="panel warehouse-card" key={l.id}>
                        <div className="warehouse-icon">
                          <Warehouse size={24} />
                        </div>
                        <p className="eyebrow">{l.warehouse}</p>
                        <h2>{l.name}</h2>
                        <p className="muted">
                          {
                            data.balances.filter(
                              (b) => b.location_id === l.id && b.qty > 0,
                            ).length
                          }{" "}
                          stocked products
                        </p>
                        <div className="warehouse-stock">
                          {data.balances
                            .filter((b) => b.location_id === l.id && b.qty > 0)
                            .map((b) => (
                              <div key={b.product_id}>
                                <span>{product(b.product_id)?.name}</span>
                                <strong>
                                  {q(b.qty)}{" "}
                                  <small>{product(b.product_id)?.unit}</small>
                                </strong>
                              </div>
                            ))}
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => {
                            go("Products");
                            setLocation(l.id);
                          }}
                        >
                          View location stock
                          <ArrowRight size={16} />
                        </Button>
                      </section>
                    ))
                  ) : (
                    <section className="panel">
                      <Empty
                        title="Add your first location"
                        text="A location can be a warehouse, store, rack, or production floor."
                      />
                    </section>
                  )}
                </div>
              )}
              {view === "Profile" && (
                <section className="panel profile-panel">
                  <span className="avatar avatar-large">
                    <UserRound size={30} />
                  </span>
                  <h2>{data.user.name}</h2>
                  <p>{data.user.email}</p>
                  <div className="info-note">
                    <ShieldCheck size={20} />
                    <span>
                      Your inventory is private to the account shown above.
                    </span>
                  </div>
                  <a className="logout-link" href="/auth">
                    Email account and password recovery
                  </a>
                  <a
                    className="logout-link"
                    href="/signout-with-chatgpt?return_to=%2F"
                    onClick={async (event) => {
                      event.preventDefault();
                      try {
                        const r = await fetch("/api/auth/logout", {
                          method: "POST",
                        });
                        if (!r.ok)
                          throw new Error("Please try signing out again.");
                        window.location.assign(
                          "/signout-with-chatgpt?return_to=%2F",
                        );
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                    target="_top"
                  >
                    <LogOut size={16} />
                    Sign out
                  </a>
                </section>
              )}
            </>
          )}
          <footer className="workspace-footer">
            <span>StockSense</span>
            <span>Clear stock. Confident decisions.</span>
          </footer>
        </main>
      </SidebarInset>
      <Toaster position="bottom-right" richColors />
      {modal === "product" && (
        <ProductForm
          product={editing}
          mutate={mutate}
          close={() => setModal(null)}
        />
      )}
      {modal === "location" && (
        <LocationForm mutate={mutate} close={() => setModal(null)} />
      )}
      {modal === "operation" && data && (
        <OperationForm
          inventory={data}
          initialKind={opKind}
          initialProduct={reorder}
          initialLocation={location === "all" ? undefined : location}
          mutate={mutate}
          close={() => setModal(null)}
          onCreated={setDetail}
        />
      )}
      <Sheet
        open={!!selected}
        onOpenChange={(open) => !open && setDetail(null)}
      >
        <SheetContent className="detail-sheet">
          {selected && data && (
            <>
              <SheetHeader>
                <p className="eyebrow">{kindNames[selected.kind]}</p>
                <SheetTitle>{selected.reference}</SheetTitle>
                <SheetDescription>
                  {selected.partner || "Internal warehouse operation"}
                </SheetDescription>
              </SheetHeader>
              <div className="detail-body">
                <Status value={selected.status} />
                {selected.scheduled_at && (
                  <p>
                    Scheduled:{" "}
                    {new Date(selected.scheduled_at).toLocaleString()}
                  </p>
                )}
                {selected.kind === "delivery" && (
                  <p className="info-note">
                    Pick:{" "}
                    {selected.picked_at
                      ? new Date(selected.picked_at).toLocaleString()
                      : "Pending"}{" "}
                    · Pack:{" "}
                    {selected.packed_at
                      ? new Date(selected.packed_at).toLocaleString()
                      : "Pending"}
                  </p>
                )}
                <div className="detail-flow">
                  {selected.source_id && (
                    <div>
                      <small>FROM</small>
                      <strong>{locName(selected.source_id)}</strong>
                    </div>
                  )}
                  {selected.source_id && selected.dest_id && (
                    <ArrowRight size={22} />
                  )}{" "}
                  {selected.dest_id && (
                    <div>
                      <small>TO</small>
                      <strong>{locName(selected.dest_id)}</strong>
                    </div>
                  )}
                </div>
                <h3>
                  {selected.kind === "adjustment"
                    ? "Physical count"
                    : "Products"}
                </h3>
                {data.lines
                  .filter((l) => l.operation_id === selected.id)
                  .map((l) => {
                    const p = product(l.product_id);
                    const here =
                      data.balances.find(
                        (b) =>
                          b.product_id === l.product_id &&
                          b.location_id === selected.source_id,
                      )?.qty || 0;
                    return (
                      <div className="detail-product" key={l.id}>
                        <div>
                          <strong>{p?.name}</strong>
                          <small>{p?.sku}</small>
                          {selected.kind === "adjustment" && (
                            <small>
                              Recorded at count: {q(l.expected_qty || 0)}{" "}
                              {p?.unit}
                            </small>
                          )}
                          {selected.kind !== "receipt" &&
                            selected.status !== "Done" && (
                              <small>
                                Available now: {q(here)} {p?.unit}
                              </small>
                            )}
                        </div>
                        <strong>
                          {q(l.qty)} <small>{p?.unit}</small>
                        </strong>
                      </div>
                    );
                  })}
                <div className="detail-meta">
                  <span>Created</span>
                  <strong>{date(selected.created_at)}</strong>
                  <span>Operator</span>
                  <strong>{selected.actor}</strong>
                </div>
                {selected.note && (
                  <div className="note-box">
                    <small>NOTE / REASON</small>
                    <p>{selected.note}</p>
                  </div>
                )}
                {selected.status === "Done" ? (
                  <div className="validated">
                    <CheckCircle2 size={20} />
                    <div>
                      <strong>Validated and recorded</strong>
                      <p>{date(selected.updated_at)} · Stock updated once.</p>
                    </div>
                  </div>
                ) : selected.status === "Canceled" ? (
                  <p className="info-note">
                    This document was canceled. No stock was changed.
                  </p>
                ) : (
                  <>
                    <p className="info-note">
                      <CircleHelp size={18} />
                      {selected.kind === "delivery"
                        ? "Pick and pack the listed items before marking this delivery ready. Validation reduces stock."
                        : selected.kind === "adjustment"
                          ? "Validation replaces the recorded balance with this physical count and logs the difference."
                          : "Review locations and quantities before validation. Drafts do not change stock."}
                    </p>
                    <div className="detail-actions">
                      {selected.status !== "Ready" ? (
                        <>
                          <Button
                            disabled={busy}
                            onClick={() =>
                              selected.kind === "delivery"
                                ? deliveryStep(
                                    selected.id,
                                    selected.picked_at ? "pack" : "pick",
                                  )
                                : transition(selected.id, "Ready")
                            }
                          >
                            {selected.kind === "delivery"
                              ? selected.picked_at
                                ? "Mark packed & ready"
                                : "Mark picked"
                              : "Mark ready"}
                            <ArrowRight size={16} />
                          </Button>
                          {selected.status === "Draft" && (
                            <Button
                              disabled={busy}
                              variant="outline"
                              onClick={() => transition(selected.id, "Waiting")}
                            >
                              Set waiting
                            </Button>
                          )}
                        </>
                      ) : (
                        <Button
                          disabled={busy}
                          onClick={() => transition(selected.id, "Done")}
                        >
                          <CheckCircle2 size={16} />
                          {busy ? "Validating…" : "Validate & update stock"}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => setCancelId(selected.id)}
                      >
                        Cancel document
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      <AlertDialog
        open={!!cancelId}
        onOpenChange={(open) => !open && setCancelId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this document?</AlertDialogTitle>
            <AlertDialogDescription>
              Its stock will not change. A canceled document stays in the
              history and cannot be reopened.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep document</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (cancelId) void transition(cancelId, "Canceled");
                setCancelId(null);
              }}
            >
              Cancel document
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
