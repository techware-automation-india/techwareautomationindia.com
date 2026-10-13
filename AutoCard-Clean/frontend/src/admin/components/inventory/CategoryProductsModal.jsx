import { useState, useEffect, useMemo } from "react";
import {
  Package, X, Search, Plus, Edit3, Trash2, Loader2, Folder,
  ExternalLink, Layers, AlertCircle, LayoutGrid, List, MapPin,
  Building, RefreshCw, Tag, ShieldAlert, ArrowRight, Boxes, Eye
} from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "../../../lib/api.js";
import ProductQuickViewModal, { resolveImageUrl } from "./ProductQuickViewModal.jsx";

const fmtDate = (d) => {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const getLevelBadge = (lvl) => {
  const levelNum = Number(lvl) || 1;
  const styles = {
    1: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    2: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    3: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    4: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
        styles[levelNum] || styles[1]
      }`}
    >
      <Layers className="h-3 w-3" />
      <span>Level {levelNum}</span>
    </span>
  );
};

const CategoryProductsModal = ({
  isOpen,
  onClose,
  category,
  allCategories = [],
  onDrillDown,
  onAddItem,
  onEditItem,
  onDeleteItem,
  refreshTrigger = 0,
}) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "table"
  const [scope, setScope] = useState("direct"); // "direct" | "all"
  const [viewingItem, setViewingItem] = useState(null);

  // Collect all descendant category IDs (including the category itself)
  const descendantMap = useMemo(() => {
    if (!category?.id || !Array.isArray(allCategories)) return new Map();
    const map = new Map();
    allCategories.forEach((c) => {
      if (c && c.id) map.set(c.id, c);
    });

    const descendantIds = new Set([category.id]);
    let added = true;
    while (added) {
      added = false;
      allCategories.forEach((c) => {
        if (c?.parentId && descendantIds.has(c.parentId) && !descendantIds.has(c.id)) {
          descendantIds.add(c.id);
          added = true;
        }
      });
    }
    return descendantIds;
  }, [category?.id, allCategories]);

  // Fetch products for category
  const fetchProducts = async () => {
    if (!category?.id) return;
    setLoading(true);
    try {
      // Fetch all items from inventory to have complete items list
      const res = await apiGet("/inventory/items");
      const allItems = res?.items || [];
      setItems(allItems);
    } catch (err) {
      console.error("Failed to load products for category:", err);
      toast.error(err.message || "Failed to load products.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && category?.id) {
      fetchProducts();
      setSearch("");
      setScope("direct");
    }
  }, [isOpen, category?.id, refreshTrigger]);

  if (!isOpen || !category) return null;

  // Filter items based on scope (direct vs including subcategories)
  const scopedItems = items.filter((item) => {
    if (scope === "direct") {
      return item.categoryId === category.id;
    }
    // Include all descendant subcategory items
    return item.categoryId === category.id || descendantMap.has(item.categoryId);
  });

  const directCount = items.filter((i) => i.categoryId === category.id).length;
  const branchCount = items.filter((i) => i.categoryId === category.id || descendantMap.has(i.categoryId)).length;
  const hasSubcategoryItems = branchCount > directCount;

  // Filter items by search query
  const filteredItems = scopedItems.filter((i) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    const nameMatch = (i.name || "").toLowerCase().includes(q);
    const codeMatch = (i.code || i.sku || "").toLowerCase().includes(q);
    const locMatch = (i.location || i.warehouse || "").toLowerCase().includes(q);
    const catMatch = (i.categoryRef?.name || "").toLowerCase().includes(q);

    let specMatch = false;
    if (Array.isArray(i.specifications)) {
      specMatch = i.specifications.some(
        (s) =>
          (s?.key && s.key.toLowerCase().includes(q)) ||
          (s?.value && s.value.toLowerCase().includes(q))
      );
    } else if (i.specifications && typeof i.specifications === "object") {
      specMatch = Object.entries(i.specifications).some(
        ([k, v]) =>
          k.toLowerCase().includes(q) || String(v).toLowerCase().includes(q)
      );
    }

    return nameMatch || codeMatch || locMatch || catMatch || specMatch;
  });

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6 backdrop-blur-xs overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl rounded-3xl bg-card border border-border card-shadow flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* ─── Modal Header ────────────────────────────────────────── */}
        <div className="p-5 sm:p-6 border-b border-border bg-secondary/20 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 shadow-xs">
                <Folder className="h-6 w-6 fill-primary/20" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-display text-xl font-bold text-foreground">
                    {category.name}
                  </h3>
                  {category.code && (
                    <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-secondary text-muted-foreground border border-border font-medium">
                      {category.code}
                    </span>
                  )}
                  {getLevelBadge(category.level || 1)}
                </div>
                {category.description ? (
                  <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                    {category.description}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    Viewing products and inventory items registered under this category.
                  </p>
                )}
              </div>
            </div>

            {/* Actions: Open Folder, Close */}
            <div className="flex items-center gap-2 shrink-0">
              {onDrillDown && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onDrillDown(category);
                  }}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border hover:bg-secondary text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Drill down into this category folder"
                >
                  <span>Open Folder</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Subheader Toolbar: Search, Filter scope, Add Product button */}
          <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
            <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products by name, SKU, specs, location..."
                  className="w-full pl-9 pr-8 py-2 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Scope toggle (Direct vs Subcategories) */}
              {hasSubcategoryItems && (
                <div className="flex items-center bg-secondary/60 rounded-xl p-0.5 border border-border text-xs">
                  <button
                    type="button"
                    onClick={() => setScope("direct")}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                      scope === "direct"
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Direct ({directCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setScope("all")}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                      scope === "all"
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All in Branch ({branchCount})
                  </button>
                </div>
              )}

              {/* View mode toggle */}
              <div className="flex items-center bg-secondary/60 rounded-xl p-0.5 border border-border text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    viewMode === "grid"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Grid Cards"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    viewMode === "table"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Table View"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>

              {/* Refresh button */}
              <button
                type="button"
                onClick={fetchProducts}
                disabled={loading}
                className="p-2 rounded-xl border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
                title="Refresh products list"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>

              {/* Add Product button */}
              {onAddItem && (
                <button
                  type="button"
                  onClick={() => onAddItem(category)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-xs cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Product</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ─── Modal Content ───────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
              <p className="text-sm font-semibold text-foreground">
                Loading products for {category.name}...
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Please wait a moment.
              </p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 px-4 rounded-2xl border border-dashed border-border bg-secondary/10 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-secondary/80 flex items-center justify-center text-muted-foreground/60 mb-3.5">
                <Package className="h-7 w-7" />
              </div>
              <h4 className="font-display text-base font-bold text-foreground">
                {search ? "No matching products found" : `No products in "${category.name}"`}
              </h4>
              <p className="text-xs text-muted-foreground max-w-md mt-1 mb-5">
                {search
                  ? `No items match "${search}". Try searching for another name, SKU or specification.`
                  : `There are currently no products registered under this category. Click below to add the first item.`}
              </p>
              {onAddItem && !search && (
                <button
                  type="button"
                  onClick={() => onAddItem(category)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-xs cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Product Now</span>
                </button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            /* ─── Grid View ───────────────────────────────────────── */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item, idx) => {
                const specsArr = Array.isArray(item.specifications)
                  ? item.specifications
                  : item.specifications && typeof item.specifications === "object"
                  ? Object.entries(item.specifications).map(([k, v]) => ({ key: k, value: v }))
                  : [];

                const isLowStock =
                  Number(item.quantity || 0) <= Number(item.minStock || 0);

                return (
                  <div
                    key={item.id ? `${item.id}-${idx}` : idx}
                    className="group rounded-2xl border border-border bg-background p-4 card-shadow flex flex-col justify-between hover:border-primary/50 hover:shadow-md transition-all"
                  >
                    <div>
                      {/* Product Thumbnail & Quantity Badge */}
                      <div
                        onClick={() => setViewingItem(item)}
                        className="w-full h-40 rounded-xl bg-secondary/30 border border-border/60 overflow-hidden flex items-center justify-center mb-3 relative group-hover:bg-secondary/40 transition-colors cursor-pointer"
                        title="Click to view product details & photo"
                      >
                        {item.photoUrl ? (
                          <img
                            src={resolveImageUrl(item.photoUrl)}
                            alt={item.name}
                            className="w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex flex-col items-center text-muted-foreground/60">
                            <Package className="h-10 w-10 stroke-[1.2]" />
                            <span className="text-[10px] mt-1 font-mono uppercase tracking-wider">
                              No Image
                            </span>
                          </div>
                        )}

                        {/* Stock Quantity Badge */}
                        <span
                          className={`absolute top-2 right-2 px-2.5 py-1 rounded-full text-[11px] font-bold shadow-xs border backdrop-blur-xs ${
                            isLowStock
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                              : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                          }`}
                        >
                          {item.quantity} {item.unit || "Nos"}
                        </span>

                        {/* Low stock warning indicator */}
                        {isLowStock && (
                          <span
                            className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 text-[10px] font-semibold flex items-center gap-1 shadow-xs"
                            title="Low Stock"
                          >
                            <ShieldAlert className="h-3 w-3" />
                            <span>Low</span>
                          </span>
                        )}
                      </div>

                      {/* Name & Code */}
                      <h4 className="font-display text-sm font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                        {item.name}
                      </h4>

                      {(item.code || item.sku) && (
                        <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                          {item.code || item.sku}
                        </p>
                      )}

                      {/* Price per item badge & Total */}
                      <div className="mt-2.5 flex items-center justify-between gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 font-bold text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 shadow-2xs">
                          <span>₹{Number(item.costPrice || 0).toLocaleString("en-IN")}</span>
                          <span className="text-[10px] font-normal text-muted-foreground">/ {item.unit || "Nos"}</span>
                        </span>
                        {Number(item.quantity || 0) > 1 && Number(item.costPrice || 0) > 0 && (
                          <span className="text-[11px] font-semibold text-muted-foreground">
                            Total: ₹{(Number(item.quantity || 0) * Number(item.costPrice || 0)).toLocaleString("en-IN")}
                          </span>
                        )}
                      </div>

                      {/* Location & Warehouse */}
                      {(item.location || item.warehouse) && (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-2 truncate">
                          <MapPin className="h-3 w-3 shrink-0 text-muted-foreground/80" />
                          <span className="truncate">
                            {[item.warehouse, item.location].filter(Boolean).join(" • ")}
                          </span>
                        </div>
                      )}

                      {/* Category Pill (if item is from subcategory) */}
                      {item.categoryId !== category.id && item.categoryRef?.name && (
                        <div className="mt-2">
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-secondary text-muted-foreground border border-border">
                            <Folder className="h-2.5 w-2.5" />
                            <span className="truncate">{item.categoryRef.name}</span>
                          </span>
                        </div>
                      )}

                      {/* Created By Print Name */}
                      <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="font-semibold text-foreground/80">Created by:</span>
                        <span className="inline-flex items-center gap-1 font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 text-[10px]">
                          {item.createdByName || "Admin"}
                        </span>
                      </div>

                      {/* Specifications Preview (No Limit) */}
                      {specsArr.length > 0 && (
                        <div className="mt-3 border border-border/60 rounded-xl overflow-hidden bg-secondary/15 text-[11px] max-h-36 overflow-y-auto">
                          <div className="divide-y divide-border/40">
                            {specsArr.map((sp, sIdx) => (
                              <div
                                key={sIdx}
                                className="grid grid-cols-12 py-1 px-2.5 items-center"
                              >
                                <span className="col-span-5 font-semibold text-muted-foreground truncate">
                                  {sp.key}
                                </span>
                                <span className="col-span-7 font-mono text-foreground truncate pl-1">
                                  {sp.value}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Updated {fmtDate(item.updatedAt || item.createdAt)}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setViewingItem(item)}
                          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                          title="View Product Details & Photo"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {onEditItem && (
                          <button
                            type="button"
                            onClick={() => onEditItem(item, category)}
                            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-blue-600 transition-colors cursor-pointer"
                            title="Edit Product"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                        )}
                        {onDeleteItem && (
                          <button
                            type="button"
                            onClick={() => onDeleteItem(item)}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                            title="Delete Product"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ─── Table View ──────────────────────────────────────── */
            <div className="rounded-2xl border border-border overflow-hidden bg-background">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30 text-muted-foreground">
                      <th className="py-3 px-4 font-semibold w-14">Photo</th>
                      <th className="py-3 px-4 font-semibold">Product Name & SKU</th>
                      <th className="py-3 px-4 font-semibold">Created By</th>
                      <th className="py-3 px-4 font-semibold">Stock Quantity</th>
                      <th className="py-3 px-4 font-semibold">Price / Unit</th>
                      <th className="py-3 px-4 font-semibold">Total Value</th>
                      <th className="py-3 px-4 font-semibold">Location / Warehouse</th>
                      <th className="py-3 px-4 font-semibold">Specifications</th>
                      <th className="py-3 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredItems.map((item, idx) => {
                      const specsArr = Array.isArray(item.specifications)
                        ? item.specifications
                        : item.specifications && typeof item.specifications === "object"
                        ? Object.entries(item.specifications).map(([k, v]) => ({ key: k, value: v }))
                        : [];

                      const isLowStock =
                        Number(item.quantity || 0) <= Number(item.minStock || 0);

                      return (
                        <tr
                          key={item.id ? `${item.id}-${idx}` : idx}
                          className="hover:bg-secondary/20 transition-colors"
                        >
                          {/* Photo */}
                          <td className="py-2.5 px-4">
                            <div className="w-10 h-10 rounded-lg bg-secondary border border-border overflow-hidden flex items-center justify-center shrink-0">
                              {item.photoUrl ? (
                                <img
                                  src={resolveImageUrl(item.photoUrl)}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className="h-4 w-4 text-muted-foreground/60" />
                              )}
                            </div>
                          </td>

                          {/* Name & Code */}
                          <td className="py-2.5 px-4">
                            <div className="font-semibold text-foreground text-sm">
                              {item.name}
                            </div>
                            <div className="font-mono text-[11px] text-muted-foreground mt-0.5">
                              {item.code || item.sku || "—"}
                            </div>
                            {item.categoryId !== category.id && item.categoryRef?.name && (
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                in <span className="font-medium text-foreground">{item.categoryRef.name}</span>
                              </div>
                            )}
                          </td>

                          {/* Created By Print Name */}
                          <td className="py-2.5 px-4 text-xs">
                            <span className="inline-flex items-center gap-1 font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20 text-[11px]">
                              {item.createdByName || "Admin"}
                            </span>
                          </td>

                          {/* Stock Quantity */}
                          <td className="py-2.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
                                isLowStock
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                                  : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                              }`}
                            >
                              {item.quantity} {item.unit || "Nos"}
                            </span>
                            {item.minStock !== undefined && (
                              <span className="block text-[10px] text-muted-foreground mt-0.5">
                                Min: {item.minStock}
                              </span>
                            )}
                          </td>

                          {/* Price / Unit (Price print per item) */}
                          <td className="py-2.5 px-4">
                            <div className="font-bold text-xs text-emerald-600 dark:text-emerald-400">
                              ₹{Number(item.costPrice || 0).toLocaleString("en-IN")}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              per {item.unit || "Nos"}
                            </div>
                          </td>

                          {/* Total Valuation */}
                          <td className="py-2.5 px-4 font-bold text-xs text-foreground">
                            ₹{(Number(item.quantity || 0) * Number(item.costPrice || 0)).toLocaleString("en-IN")}
                          </td>

                          {/* Location */}
                          <td className="py-2.5 px-4 text-muted-foreground text-xs">
                            <div>{item.warehouse || "—"}</div>
                            {item.location && (
                              <div className="text-[11px] text-foreground font-medium">
                                {item.location}
                              </div>
                            )}
                          </td>

                          {/* Specs (No limit) */}
                          <td className="py-2.5 px-4">
                            {specsArr.length === 0 ? (
                              <span className="text-muted-foreground text-[11px]">—</span>
                            ) : (
                              <div className="flex flex-wrap gap-1 max-w-sm">
                                {specsArr.map((sp, sIdx) => (
                                  <span
                                    key={sIdx}
                                    className="px-1.5 py-0.5 rounded bg-secondary text-[10px] font-mono border border-border"
                                  >
                                    <strong className="font-semibold text-foreground">{sp.key}:</strong> {sp.value}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-2.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setViewingItem(item)}
                                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                                title="View Product Details & Photo"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              {onEditItem && (
                                <button
                                  type="button"
                                  onClick={() => onEditItem(item, category)}
                                  className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-blue-600 transition-colors cursor-pointer"
                                  title="Edit Product"
                                >
                                  <Edit3 className="h-4 w-4" />
                                </button>
                              )}
                              {onDeleteItem && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteItem(item)}
                                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                  title="Delete Product"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ─── Modal Footer ────────────────────────────────────────── */}
        <div className="p-4 sm:p-5 border-t border-border bg-secondary/20 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>
              Showing <strong className="text-foreground">{filteredItems.length}</strong> {filteredItems.length === 1 ? "product" : "products"}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {onDrillDown && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDrillDown(category);
                }}
                className="px-4 py-2 rounded-xl border border-border hover:bg-secondary text-foreground font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>Open in Full Folder View</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-secondary text-foreground font-semibold hover:bg-secondary/80 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Product Quick View / Photo Modal */}
      <ProductQuickViewModal
        isOpen={!!viewingItem}
        onClose={() => setViewingItem(null)}
        item={viewingItem}
        onEdit={onEditItem ? (it) => onEditItem(it, category) : undefined}
      />
    </div>
  );
};

export default CategoryProductsModal;
