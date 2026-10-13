import { useState, useEffect, useMemo } from "react";
import {
  Boxes,
  Search,
  RefreshCw,
  ArrowLeft,
  Filter,
  Package,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Tag,
  MapPin,
  IndianRupee,
  Layers,
  Image as ImageIcon,
  Eye,
  LayoutGrid,
  List,
  User,
  ShieldAlert,
  Clock,
  ExternalLink,
  Folder,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "../../../lib/api.js";
import ProductQuickViewModal, { resolveImageUrl } from "./ProductQuickViewModal.jsx";

// Resolves the Level-1 root category object { id, name, code, level: 1 } for an item
export const getRootCategory = (item, categoriesList = []) => {
  if (!item) return null;
  const catId = item.categoryId || item.categoryRef?.id;

  // 1. Traverse up categoriesList
  if (catId && Array.isArray(categoriesList) && categoriesList.length > 0) {
    let curr = categoriesList.find((c) => c.id === catId);
    let depth = 0;
    while (curr && depth < 6) {
      if (Number(curr.level) === 1 || !curr.parentId) {
        return curr;
      }
      const parentId = curr.parentId;
      curr = categoriesList.find((c) => c.id === parentId);
      depth++;
    }
  }

  // 2. Fallback to item.categoryRef ancestry
  if (item.categoryRef) {
    let ref = item.categoryRef;
    if (Number(ref.level) === 1 || !ref.parentId) return ref;
    let curr = ref.parent;
    let depth = 0;
    while (curr && depth < 6) {
      if (Number(curr.level) === 1 || !curr.parentId) return curr;
      curr = curr.parent;
      depth++;
    }
    return ref;
  }

  return null;
};

// Gets category hierarchy details: { rootName, subName, fullBreadcrumb }
export const getItemCategoryDetails = (item, categoriesList = []) => {
  if (!item) {
    return { rootName: "Uncategorized", subName: "", fullBreadcrumb: "Uncategorized" };
  }

  const catId = item.categoryId || item.categoryRef?.id;
  const chain = [];

  if (catId && Array.isArray(categoriesList) && categoriesList.length > 0) {
    let curr = categoriesList.find((c) => c.id === catId);
    let depth = 0;
    while (curr && depth < 6) {
      chain.unshift(curr.name);
      curr = curr.parentId ? categoriesList.find((c) => c.id === curr.parentId) : null;
      depth++;
    }
  } else if (item.categoryRef) {
    let curr = item.categoryRef;
    let depth = 0;
    while (curr && depth < 6) {
      chain.unshift(curr.name);
      curr = curr.parent;
      depth++;
    }
  }

  if (chain.length === 0) {
    const raw = item.category || "Uncategorized";
    return { rootName: raw, subName: "", fullBreadcrumb: raw };
  }

  const rootName = chain[0] || "Uncategorized";
  const subName = chain.length > 1 ? chain.slice(1).join(" › ") : "";
  const fullBreadcrumb = chain.join(" › ");

  return { rootName, subName, fullBreadcrumb };
};

// Checks whether an item belongs to a target category ID (matches Level 1, subcategories, or uncategorized)
export const isItemInCategoryId = (item, targetCategoryId, categoriesList = []) => {
  if (!item || !targetCategoryId || targetCategoryId === "ALL") return true;

  if (targetCategoryId === "UNCATEGORIZED") {
    return !item.categoryId && !item.categoryRef;
  }

  const catId = item.categoryId || item.categoryRef?.id;
  if (catId === targetCategoryId) return true;

  // Root category match (e.g. user selected Level 1 CONSUAMBLE, item is under Electrical)
  const root = getRootCategory(item, categoriesList);
  if (root?.id === targetCategoryId) return true;

  // Walk up categoriesList
  if (catId && Array.isArray(categoriesList) && categoriesList.length > 0) {
    let curr = categoriesList.find((c) => c.id === catId);
    let depth = 0;
    while (curr && depth < 6) {
      if (curr.id === targetCategoryId) return true;
      curr = curr.parentId ? categoriesList.find((c) => c.id === curr.parentId) : null;
      depth++;
    }
  }

  // Walk up categoryRef
  if (item.categoryRef) {
    let curr = item.categoryRef;
    let depth = 0;
    while (curr && depth < 6) {
      if (curr.id === targetCategoryId) return true;
      curr = curr.parent;
      depth++;
    }
  }

  return false;
};

export default function ViewInventoryView({ onBackToHub }) {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Views
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [stockStatusFilter, setStockStatusFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "table"
  const [viewingItem, setViewingItem] = useState(null);

  const loadCatalogData = async () => {
    setLoading(true);
    try {
      const [itemsRes, catsRes] = await Promise.all([
        apiGet("/inventory/items"),
        apiGet("/inventory/categories"),
      ]);
      setItems(itemsRes.items || []);
      setCategories(catsRes.categories || []);
    } catch (err) {
      toast.error(err.message || "Failed to load master stock catalog.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalogData();
  }, []);

  // Level 1 Root Categories
  const level1Categories = useMemo(() => {
    return categories.filter((c) => Number(c.level) === 1 || !c.parentId);
  }, [categories]);

  // Calculate accurate item counts for each Level 1 category (including all descendant items)
  const level1CategoryCounts = useMemo(() => {
    const counts = {};
    level1Categories.forEach((cat) => {
      counts[cat.id] = 0;
    });
    let uncategorizedCount = 0;

    items.forEach((item) => {
      const root = getRootCategory(item, categories);
      if (root && counts[root.id] !== undefined) {
        counts[root.id]++;
      } else if (root && root.id) {
        counts[root.id] = (counts[root.id] || 0) + 1;
      } else {
        uncategorizedCount++;
      }
    });

    return { counts, uncategorizedCount };
  }, [items, categories, level1Categories]);

  // Filter items
  const filteredItems = items.filter((item) => {
    const q = search.trim().toLowerCase();
    const { rootName, fullBreadcrumb } = getItemCategoryDetails(item, categories);

    const matchesSearch =
      !q ||
      (item.name || "").toLowerCase().includes(q) ||
      (item.code || item.sku || "").toLowerCase().includes(q) ||
      (item.location || "").toLowerCase().includes(q) ||
      (item.warehouse || "").toLowerCase().includes(q) ||
      (item.createdByName || "").toLowerCase().includes(q) ||
      (item.categoryRef?.name || item.category || "").toLowerCase().includes(q) ||
      rootName.toLowerCase().includes(q) ||
      fullBreadcrumb.toLowerCase().includes(q);

    const matchesCategory =
      selectedCategory === "ALL" ||
      isItemInCategoryId(item, selectedCategory, categories);

    let matchesStock = true;
    const qty = Number(item.quantity || 0);
    const minS = Number(item.minStock || 5);

    if (stockStatusFilter === "IN_STOCK") {
      matchesStock = qty > minS;
    } else if (stockStatusFilter === "LOW_STOCK") {
      matchesStock = qty > 0 && qty <= minS;
    } else if (stockStatusFilter === "OUT_OF_STOCK") {
      matchesStock = qty === 0;
    }

    return matchesSearch && matchesCategory && matchesStock;
  });

  // Calculate Metrics
  const totalItemsCount = items.length;
  const totalStockQuantity = items.reduce((acc, curr) => acc + Number(curr.quantity || 0), 0);
  const totalValuation = items.reduce((acc, curr) => {
    const qty = Number(curr.quantity || 0);
    const cost = Number(curr.costPrice || 0);
    return acc + qty * cost;
  }, 0);
  const lowStockCount = items.filter(
    (i) => Number(i.quantity || 0) <= Number(i.minStock || 5) && Number(i.quantity || 0) > 0
  ).length;
  const outOfStockCount = items.filter((i) => Number(i.quantity || 0) === 0).length;

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToHub}
            className="p-2 rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
            title="Back to Inventory Submodules"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="w-12 h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center text-violet-600 dark:text-violet-400">
            <Boxes className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              View Inventory (Master Stock Catalog)
            </h1>
            <p className="text-sm text-muted-foreground">
              Real-time stock catalog, high-resolution product photos, material valuation, and specifications.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Switch */}
          <div className="flex items-center bg-secondary/50 border border-border rounded-xl p-1">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === "grid"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Grid View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === "table"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Table View"
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={loadCatalogData}
            disabled={loading}
            className="p-2.5 rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh Catalog"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Metrics Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-border bg-background card-shadow flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-violet-500/10 text-violet-600 flex items-center justify-center shrink-0">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
              Total SKU Items
            </span>
            <span className="text-2xl font-bold text-foreground">{totalItemsCount} Items</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-background card-shadow flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
            <Boxes className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
              Total Units in Stock
            </span>
            <span className="text-2xl font-bold text-foreground">{totalStockQuantity} Units</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-background card-shadow flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
            <IndianRupee className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
              Estimated Inventory Value
            </span>
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              ₹{totalValuation.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-background card-shadow flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
              Low / Out Stock Alerts
            </span>
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {lowStockCount + outOfStockCount}
            </span>
          </div>
        </div>
      </div>

      {/* Level-1 Category Quick Filter Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 shrink-0 mr-1">
          <Layers className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
          <span>Level 1:</span>
        </span>

        <button
          type="button"
          onClick={() => setSelectedCategory("ALL")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            selectedCategory === "ALL"
              ? "bg-violet-600 text-white shadow-xs ring-2 ring-violet-500/30"
              : "bg-secondary/40 border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`}
        >
          All Items ({items.length})
        </button>

        {level1Categories.map((c) => {
          const count = level1CategoryCounts.counts[c.id] || 0;
          const isSelected = selectedCategory === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCategory(isSelected ? "ALL" : c.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                isSelected
                  ? "bg-violet-600 text-white shadow-xs ring-2 ring-violet-500/30"
                  : "bg-secondary/40 border border-border text-foreground/80 hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Folder className="h-3.5 w-3.5 opacity-70" />
              <span>{c.name}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  isSelected
                    ? "bg-white/20 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}

        {level1CategoryCounts.uncategorizedCount > 0 && (
          <button
            type="button"
            onClick={() =>
              setSelectedCategory(
                selectedCategory === "UNCATEGORIZED" ? "ALL" : "UNCATEGORIZED"
              )
            }
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              selectedCategory === "UNCATEGORIZED"
                ? "bg-violet-600 text-white shadow-xs ring-2 ring-violet-500/30"
                : "bg-secondary/40 border border-border text-muted-foreground hover:bg-secondary"
            }`}
          >
            <span>Uncategorized</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                selectedCategory === "UNCATEGORIZED"
                  ? "bg-white/20 text-white"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {level1CategoryCounts.uncategorizedCount}
            </span>
          </button>
        )}
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-background p-4 rounded-2xl border border-border card-shadow">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search catalog by item name, SKU, location, or created by..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-secondary/30 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Category Dropdown Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-secondary/30 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
          >
            <option value="ALL">All Categories ({items.length})</option>
            {level1Categories.map((c) => {
              const cnt = level1CategoryCounts.counts[c.id] || 0;
              const subcats = categories.filter((sub) => sub.parentId === c.id);
              return (
                <optgroup key={c.id} label={`Level 1: ${c.name} (${cnt} items)`}>
                  <option value={c.id}>
                    📁 All {c.name} ({cnt} items)
                  </option>
                  {subcats.map((sub) => {
                    const subCnt = items.filter(
                      (it) => it.categoryId === sub.id || it.categoryRef?.id === sub.id
                    ).length;
                    return (
                      <option key={sub.id} value={sub.id}>
                        &nbsp;&nbsp;↳ {sub.name} ({subCnt} items)
                      </option>
                    );
                  })}
                </optgroup>
              );
            })}
            {level1CategoryCounts.uncategorizedCount > 0 && (
              <option value="UNCATEGORIZED">
                Uncategorized ({level1CategoryCounts.uncategorizedCount} items)
              </option>
            )}
          </select>

          {/* Stock Status Buttons */}
          <div className="flex items-center gap-1.5 border-l border-border pl-2">
            {[
              { id: "ALL", label: "All" },
              { id: "IN_STOCK", label: "In Stock" },
              { id: "LOW_STOCK", label: "Low Stock" },
              { id: "OUT_OF_STOCK", label: "Out of Stock" },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStockStatusFilter(st.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  stockStatusFilter === st.id
                    ? "bg-violet-600 text-white shadow-xs"
                    : "bg-secondary/40 border border-border text-muted-foreground hover:bg-secondary"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Items Catalog Display */}
      {loading ? (
        <div className="p-16 text-center text-muted-foreground bg-background rounded-2xl border border-border">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
          <p className="text-sm font-semibold">Loading master stock catalog...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-16 text-center text-muted-foreground bg-background rounded-2xl border border-border">
          <Boxes className="h-10 w-10 mx-auto mb-3 text-muted-foreground/60" />
          <h3 className="font-bold text-base text-foreground mb-1">No Items Found</h3>
          <p className="text-xs text-muted-foreground">
            No stock items match your search and filter criteria.
          </p>
        </div>
      ) : viewMode === "grid" ? (
        /* ─── GRID VIEW ─────────────────────────────────────────── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredItems.map((item) => {
            const qty = Number(item.quantity || 0);
            const minS = Number(item.minStock || 5);
            const cost = Number(item.costPrice || 0);
            const totalVal = qty * cost;
            const isLowStock = qty > 0 && qty <= minS;
            const isOutOfStock = qty === 0;
            const { rootName, subName } = getItemCategoryDetails(item, categories);
            const photoSrc = resolveImageUrl(item.photoUrl);

            const specsArr = Array.isArray(item.specifications)
              ? item.specifications
              : item.specifications && typeof item.specifications === "object"
              ? Object.entries(item.specifications).map(([k, v]) => ({ key: k, value: v }))
              : [];

            return (
              <div
                key={item.id}
                className="rounded-2xl border border-border bg-background p-5 card-shadow hover:border-violet-500/40 hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
              >
                <div>
                  {/* Photo Thumbnail Banner with View Action */}
                  <div
                    onClick={() => setViewingItem(item)}
                    className="w-full h-44 rounded-xl bg-secondary/30 border border-border/70 overflow-hidden flex items-center justify-center mb-3 relative group/img cursor-pointer transition-colors hover:bg-secondary/40"
                  >
                    {photoSrc ? (
                      <img
                        src={photoSrc}
                        alt={item.name}
                        className="w-full h-full object-contain p-2 transition-transform duration-300 group-hover/img:scale-105"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          if (e.currentTarget.nextSibling) {
                            e.currentTarget.nextSibling.style.display = "flex";
                          }
                        }}
                      />
                    ) : null}

                    {/* Fallback Placeholder (shown if no photo or error) */}
                    <div
                      className={`flex flex-col items-center justify-center text-muted-foreground/60 p-4 text-center ${
                        photoSrc ? "hidden" : "flex"
                      }`}
                    >
                      <Package className="h-10 w-10 stroke-[1.2] mb-1" />
                      <span className="text-[10px] font-mono uppercase tracking-wider">
                        No Image
                      </span>
                    </div>

                    {/* Stock Status Badge */}
                    <span
                      className={`absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border backdrop-blur-xs shadow-xs ${
                        isOutOfStock
                          ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30"
                          : isLowStock
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                          : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                      }`}
                    >
                      {qty} {item.unit || "Nos"}
                    </span>

                    {/* Hover View Overlay Button */}
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-gray-900 text-xs font-bold shadow-lg">
                        <Eye className="h-3.5 w-3.5 text-violet-600" />
                        <span>View Product</span>
                      </span>
                    </div>
                  </div>

                  {/* Title & Code */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3
                        onClick={() => setViewingItem(item)}
                        className="font-bold text-base text-foreground line-clamp-1 hover:text-violet-600 transition-colors cursor-pointer"
                        title={item.name}
                      >
                        {item.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono mt-0.5">
                        <Tag className="h-3 w-3" />
                        <span>{item.code || item.sku || "No Code"}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setViewingItem(item)}
                      className="p-1.5 rounded-lg border border-border bg-secondary/40 hover:bg-secondary text-muted-foreground hover:text-violet-600 transition-colors cursor-pointer shrink-0"
                      title="Inspect Product & Photo"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Created By Print Name */}
                  <div className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground/80">Created by:</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-violet-700 dark:text-violet-300 bg-violet-500/10 px-2.5 py-0.5 rounded-full border border-violet-500/20 text-[11px]">
                      <User className="h-3 w-3" />
                      {item.createdByName || "Admin"}
                    </span>
                  </div>

                  {/* Category, Warehouse & Location Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground mt-2.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-violet-500/10 text-violet-700 dark:text-violet-300 font-semibold text-[11px] border border-violet-500/20">
                      <Layers className="h-3 w-3" />
                      Level 1: {rootName}
                    </span>
                    {subName && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-foreground font-medium text-[11px] border border-border/60">
                        › {subName}
                      </span>
                    )}
                    {(item.warehouse || item.location) && (
                      <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-300 font-semibold flex items-center gap-1 border border-blue-500/20 text-[11px]">
                        <MapPin className="h-3 w-3" />
                        {[item.warehouse, item.location].filter(Boolean).join(" • ")}
                      </span>
                    )}
                  </div>

                  {/* Specifications Badges */}
                  {specsArr.length > 0 && (
                    <div className="mt-3 p-2.5 rounded-xl bg-secondary/30 border border-border text-xs space-y-1 max-h-28 overflow-y-auto">
                      <div className="flex flex-wrap gap-1.5">
                        {specsArr.map((sp, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-md bg-background border border-border text-muted-foreground font-mono text-[10px]"
                          >
                            <strong className="text-foreground">{sp.key}:</strong> {String(sp.value || "—")}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Footer: Stock, Unit Price & Total Price (Qty * Price) */}
                <div className="pt-3 border-t border-border flex items-center justify-between text-xs flex-wrap gap-2">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                      Stock
                    </span>
                    <span className="font-bold text-foreground text-sm">
                      {qty} {item.unit || "Nos"}
                    </span>
                    <span className="text-[10px] text-muted-foreground block font-mono">
                      Min: {minS} | Max: {item.maxStock ?? 100}
                    </span>
                  </div>

                  <div className="text-center">
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                      Unit Price
                    </span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-xs">
                      ₹{cost.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                      Total Value
                    </span>
                    <span className="font-bold text-foreground text-sm">
                      ₹{totalVal.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ─── TABLE VIEW ────────────────────────────────────────── */
        <div className="rounded-2xl border border-border overflow-hidden bg-background card-shadow">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-secondary/30 text-muted-foreground uppercase tracking-wider font-semibold">
                  <th className="py-3.5 px-4 w-16">Photo</th>
                  <th className="py-3.5 px-4">Product Name & SKU</th>
                  <th className="py-3.5 px-4">Created By</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Stock Qty</th>
                  <th className="py-3.5 px-4">Price / Unit</th>
                  <th className="py-3.5 px-4">Total Value</th>
                  <th className="py-3.5 px-4">Warehouse & Rack</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredItems.map((item) => {
                  const qty = Number(item.quantity || 0);
                  const minS = Number(item.minStock || 5);
                  const cost = Number(item.costPrice || 0);
                  const totalVal = qty * cost;
                  const isLowStock = qty > 0 && qty <= minS;
                  const isOutOfStock = qty === 0;
                  const { rootName, subName } = getItemCategoryDetails(item, categories);
                  const photoSrc = resolveImageUrl(item.photoUrl);

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-secondary/20 transition-colors cursor-pointer"
                      onClick={() => setViewingItem(item)}
                    >
                      {/* Photo Thumbnail */}
                      <td className="py-2.5 px-4">
                        <div className="w-12 h-12 rounded-xl bg-secondary/40 border border-border overflow-hidden flex items-center justify-center shrink-0">
                          {photoSrc ? (
                            <img
                              src={photoSrc}
                              alt={item.name}
                              className="w-full h-full object-contain p-1"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                                if (e.currentTarget.nextSibling) {
                                  e.currentTarget.nextSibling.style.display = "flex";
                                }
                              }}
                            />
                          ) : null}
                          <div
                            className={`flex flex-col items-center justify-center text-muted-foreground/50 ${
                              photoSrc ? "hidden" : "flex"
                            }`}
                          >
                            <Package className="h-5 w-5" />
                          </div>
                        </div>
                      </td>

                      {/* Name & Code */}
                      <td className="py-2.5 px-4">
                        <div className="font-bold text-foreground text-sm hover:text-violet-600 transition-colors">
                          {item.name}
                        </div>
                        <div className="font-mono text-[11px] text-muted-foreground mt-0.5">
                          {item.code || item.sku || "—"}
                        </div>
                      </td>

                      {/* Created By */}
                      <td className="py-2.5 px-4">
                        <span className="inline-flex items-center gap-1 font-semibold text-violet-700 dark:text-violet-300 bg-violet-500/10 px-2.5 py-1 rounded-full border border-violet-500/20 text-[11px]">
                          <User className="h-3 w-3" />
                          {item.createdByName || "Admin"}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="py-2.5 px-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-violet-500/10 text-violet-700 dark:text-violet-300 font-semibold text-[11px] border border-violet-500/20 w-fit">
                            <Layers className="h-3 w-3" />
                            {rootName}
                          </span>
                          {subName && (
                            <span className="text-[10px] text-muted-foreground font-medium pl-1">
                              › {subName}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Stock Quantity */}
                      <td className="py-2.5 px-4">
                        <div className="flex flex-col gap-0.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border w-fit ${
                              isOutOfStock
                                ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30"
                                : isLowStock
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                                : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                            }`}
                          >
                            {qty} {item.unit || "Nos"}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono pl-1">
                            Min: {minS} | Max: {item.maxStock ?? 100}
                          </span>
                        </div>
                      </td>

                      {/* Price / Unit */}
                      <td className="py-2.5 px-4">
                        <div className="font-bold text-xs text-emerald-600 dark:text-emerald-400">
                          ₹{cost.toLocaleString("en-IN")}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          per {item.unit || "Nos"}
                        </div>
                      </td>

                      {/* Total Value */}
                      <td className="py-2.5 px-4 font-bold text-xs text-foreground">
                        ₹{totalVal.toLocaleString("en-IN")}
                      </td>

                      {/* Storage */}
                      <td className="py-2.5 px-4 text-xs text-muted-foreground">
                        <div>{item.warehouse || "—"}</div>
                        {item.location && (
                          <div className="text-[11px] text-foreground font-medium flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {item.location}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingItem(item);
                          }}
                          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-violet-600 transition-colors cursor-pointer"
                          title="View Product & Photo"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Product Quick View / Photo Lightbox Modal */}
      <ProductQuickViewModal
        isOpen={!!viewingItem}
        onClose={() => setViewingItem(null)}
        item={viewingItem}
      />
    </div>
  );
}
