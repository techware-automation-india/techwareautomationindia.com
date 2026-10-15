import { useState, useEffect } from "react";
import {
  Bell,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Search,
  RefreshCw,
  ArrowLeft,
  Package,
  Sliders,
  Edit3,
  Plus,
  Tag,
  MapPin,
  X,
  Layers,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPut } from "../../../lib/api.js";
import { canPerformAction } from "../../../lib/permissions.js";

export default function InventoryAlertView({ onBackToHub }) {
  const canEdit = canPerformAction("inventory-alert", "edit");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [alertFilter, setAlertFilter] = useState("ALL_ALERTS"); // "ALL_ALERTS", "OUT_OF_STOCK", "LOW_STOCK", "HEALTHY"

  // Restock / Limit Modal
  const [editModalItem, setEditModalItem] = useState(null);
  const [addQty, setAddQty] = useState(0);
  const [newMinStock, setNewMinStock] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiGet("/inventory/items");
      setItems(res.items || []);
    } catch (err) {
      toast.error(err.message || "Failed to load inventory alerts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openEditModal = (item) => {
    setEditModalItem(item);
    setAddQty(0);
    setNewMinStock(item.minStock ?? 5);
  };

  const handleUpdateStockLimit = async (e) => {
    e.preventDefault();
    if (!editModalItem) return;

    setSubmitting(true);
    try {
      const currentQty = Number(editModalItem.quantity || 0);
      const updatedQty = currentQty + Number(addQty || 0);
      const updatedMinStock = Number(newMinStock);

      await apiPut(`/inventory/items/${editModalItem.id}`, {
        quantity: updatedQty,
        minStock: updatedMinStock,
      });

      toast.success("Item stock and threshold limit updated!");
      setEditModalItem(null);
      await loadData();
    } catch (err) {
      toast.error(err.message || "Failed to update item stock.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredItems = items.filter((item) => {
    const qty = Number(item.quantity || 0);
    const minS = Number(item.minStock || 5);

    const isOutOfStock = qty === 0;
    const isLowStock = qty > 0 && qty <= minS;
    const isHealthy = qty > minS;

    const matchesSearch =
      (item.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (item.code || item.sku || "").toLowerCase().includes(search.toLowerCase()) ||
      (item.categoryRef?.name || item.category || "").toLowerCase().includes(search.toLowerCase());

    let matchesFilter = true;
    if (alertFilter === "ALL_ALERTS") {
      matchesFilter = isOutOfStock || isLowStock;
    } else if (alertFilter === "OUT_OF_STOCK") {
      matchesFilter = isOutOfStock;
    } else if (alertFilter === "LOW_STOCK") {
      matchesFilter = isLowStock;
    } else if (alertFilter === "HEALTHY") {
      matchesFilter = isHealthy;
    }

    return matchesSearch && matchesFilter;
  });

  const outOfStockCount = items.filter((i) => Number(i.quantity || 0) === 0).length;
  const lowStockCount = items.filter(
    (i) => Number(i.quantity || 0) > 0 && Number(i.quantity || 0) <= Number(i.minStock || 5)
  ).length;
  const healthyCount = items.filter(
    (i) => Number(i.quantity || 0) > Number(i.minStock || 5)
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-start sm:items-center gap-3">
          <button
            type="button"
            onClick={onBackToHub}
            className="p-2 rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
            title="Back to Inventory Submodules"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
            <Bell className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground truncate">
              Sub-module 4: Inventory Alert (Thresholds & Reorder Warnings)
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Real-time warnings for low stock items, zero-stock alerts, and minimum stock threshold tuning.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="self-end sm:self-auto p-2.5 rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Metrics Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-border bg-background card-shadow flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
            <XCircle className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
              Out of Stock (Zero)
            </span>
            <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">{outOfStockCount}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-background card-shadow flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
              Low Stock Warnings
            </span>
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{lowStockCount}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-background card-shadow flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
              Healthy Stock Items
            </span>
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{healthyCount}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-background card-shadow flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
              Total Monitored SKUs
            </span>
            <span className="text-2xl font-bold text-foreground">{items.length}</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-background p-4 rounded-2xl border border-border card-shadow">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search alerts by item name, SKU, or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-secondary/30 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "ALL_ALERTS", label: `Active Alerts (${outOfStockCount + lowStockCount})` },
            { id: "OUT_OF_STOCK", label: `Out of Stock (${outOfStockCount})` },
            { id: "LOW_STOCK", label: `Low Stock (${lowStockCount})` },
            { id: "HEALTHY", label: `Healthy (${healthyCount})` },
          ].map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setAlertFilter(st.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                alertFilter === st.id
                  ? "bg-rose-600 text-white shadow-xs"
                  : "bg-secondary/40 border border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Alert Items List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground bg-background rounded-2xl border border-border">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-rose-600" />
            <p className="text-sm">Loading stock alerts...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground bg-background rounded-2xl border border-border">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-emerald-500" />
            <h3 className="font-bold text-base text-foreground mb-1">No Alerts for Selected Filter</h3>
            <p className="text-xs text-muted-foreground">
              All items in this view are within normal stock thresholds.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredItems.map((item) => {
              const qty = Number(item.quantity || 0);
              const minS = Number(item.minStock || 5);

              const isOutOfStock = qty === 0;
              const isLowStock = qty > 0 && qty <= minS;
              const isHealthy = qty > minS;
              const deficit = Math.max(0, minS - qty);
              const categoryName = item.categoryRef?.name || item.category || "Uncategorized";

              return (
                <div
                  key={item.id}
                  className={`rounded-2xl border bg-background p-5 card-shadow transition-all flex flex-col justify-between space-y-4 ${
                    isOutOfStock
                      ? "border-rose-500/50 bg-rose-500/[0.03]"
                      : isLowStock
                      ? "border-amber-500/40 bg-amber-500/[0.02]"
                      : "border-border"
                  }`}
                >
                  <div>
                    {/* Header: Title & Alert Badge */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <h3 className="font-bold text-base text-foreground line-clamp-1">
                          {item.name}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <Tag className="h-3 w-3" />
                          <span>{item.code || item.sku || "No Code"}</span>
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold border shrink-0 flex items-center gap-1 ${
                          isOutOfStock
                            ? "bg-rose-100 text-rose-800 border-rose-500/40 dark:bg-rose-950/40 dark:text-rose-300"
                            : isLowStock
                            ? "bg-amber-100 text-amber-800 border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300"
                            : "bg-emerald-100 text-emerald-800 border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300"
                        }`}
                      >
                        {isOutOfStock ? (
                          <>
                            <XCircle className="h-3.5 w-3.5" />
                            CRITICAL
                          </>
                        ) : isLowStock ? (
                          <>
                            <AlertTriangle className="h-3.5 w-3.5" />
                            WARNING
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            HEALTHY
                          </>
                        )}
                      </span>
                    </div>

                    {/* Category & Location Badges */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-3">
                      <span className="px-2 py-0.5 rounded-md bg-secondary text-foreground font-medium">
                        {categoryName}
                      </span>
                      {item.location && (
                        <span className="px-2 py-0.5 rounded-md bg-secondary/60 text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {item.location}
                        </span>
                      )}
                    </div>

                    {/* Threshold & Deficit Box */}
                    <div className="p-3.5 rounded-xl bg-secondary/40 border border-border text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-medium">Current Stock:</span>
                        <span className={`font-bold text-sm ${isOutOfStock ? "text-rose-600" : isLowStock ? "text-amber-600" : "text-foreground"}`}>
                          {qty} {item.unit || "Nos"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-medium">Min Threshold Limit:</span>
                        <span className="font-semibold text-foreground">{minS} {item.unit || "Nos"}</span>
                      </div>
                      {!isHealthy && (
                        <div className="pt-2 border-t border-border flex items-center justify-between text-rose-600 dark:text-rose-400 font-bold">
                          <span>Required Reorder Deficit:</span>
                          <span>+{deficit > 0 ? deficit : minS} {item.unit || "Nos"}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Button */}
                  {canEdit && (
                    <div className="pt-3 border-t border-border flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sliders className="h-3.5 w-3.5" />
                        Adjust Limit / Quick Restock
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Adjust Threshold / Restock */}
      {editModalItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground border border-border rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-2">
                <Sliders className="h-5 w-5 text-rose-600" />
                <h3 className="font-bold text-base text-foreground">Adjust Stock & Threshold</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditModalItem(null)}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateStockLimit} className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-secondary/40 border border-border text-xs space-y-1">
                <div className="font-bold text-foreground text-sm">{editModalItem.name}</div>
                <div className="text-muted-foreground">
                  Current Stock: <strong>{editModalItem.quantity || 0} {editModalItem.unit || "Nos"}</strong> | Code: {editModalItem.code || "N/A"}
                </div>
              </div>

              {/* Add Fresh Stock Quantity */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Add Fresh Restock Quantity (Optional)
                </label>
                <input
                  type="number"
                  min="0"
                  value={addQty}
                  onChange={(e) => setAddQty(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                />
                <span className="text-[11px] text-muted-foreground mt-0.5 block">
                  New Stock will become: <strong>{Number(editModalItem.quantity || 0) + Number(addQty || 0)} {editModalItem.unit || "Nos"}</strong>
                </span>
              </div>

              {/* Minimum Stock Limit */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Minimum Stock Threshold Limit (minStock) *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={newMinStock}
                  onChange={(e) => setNewMinStock(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                />
                <span className="text-[11px] text-muted-foreground mt-0.5 block">
                  Alert will trigger whenever stock drops to or below this limit.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditModalItem(null)}
                  className="px-4 py-2 rounded-xl border border-border bg-background hover:bg-secondary text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Save className="h-3.5 w-3.5" />
                  {submitting ? "Saving..." : "Save Adjustments"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
