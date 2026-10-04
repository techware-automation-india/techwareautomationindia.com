import { useState, useEffect } from "react";
import {
  Folder, FolderPlus, Package, Plus, Search, ChevronRight,
  ArrowLeft, Edit3, Trash2, Loader2, Layers, AlertCircle,
  FileText, LayoutGrid, List, RefreshCw, X, Box
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiDelete } from "../../../lib/api.js";
import CategoryModal from "./CategoryModal.jsx";
import ItemCardModal from "./ItemCardModal.jsx";

const resolveImageUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
  return `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
};

const fmtDate = (d) => {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const mins = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${mins}`;
};

const InventoryInView = ({ onBackToHub }) => {
  // Navigation stack: array of category objects [rootCategory, sub2, sub3, sub4]
  const [navPath, setNavPath] = useState([]);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'table'

  // Modals state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState(null);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState(null);

  // Delete confirmations
  const [deleteCatTarget, setDeleteCatTarget] = useState(null);
  const [deleteItemTarget, setDeleteItemTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Current category is the last item in navPath (or null if at root)
  const currentCategory = navPath.length > 0 ? navPath[navPath.length - 1] : null;
  const currentLevel = currentCategory ? (currentCategory.level || 1) : 0;
  const canAddSubcategory = currentLevel < 4;

  // Load current view data
  const loadData = async () => {
    setLoading(true);
    try {
      if (!currentCategory) {
        // Root view: get level 1 categories and root items
        const [catsRes, itemsRes] = await Promise.all([
          apiGet("/inventory/categories"),
          apiGet("/inventory/items?rootOnly=true"),
        ]);
        setCategories(catsRes.categories || []);
        setItems(itemsRes.items || []);
      } else {
        // Subcategory view: get details of current category (its children and direct items)
        const res = await apiGet(`/inventory/categories/${currentCategory.id}`);
        if (res?.category) {
          setCategories(res.category.children || []);
          setItems(res.category.items || []);
        }
      }
    } catch (err) {
      toast.error(err.message || "Failed to load inventory data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentCategory?.id]);

  // Navigation handlers
  const handleDrillDown = (cat) => {
    setSearch("");
    setNavPath((prev) => [...prev, cat]);
  };

  const handleBreadcrumbClick = (index) => {
    setSearch("");
    if (index === -1) {
      setNavPath([]);
    } else {
      setNavPath((prev) => prev.slice(0, index + 1));
    }
  };

  const handleBack = () => {
    setSearch("");
    setNavPath((prev) => prev.slice(0, prev.length - 1));
  };

  // Delete category
  const handleDeleteCategory = async () => {
    if (!deleteCatTarget || deleting) return;
    setDeleting(true);
    try {
      await apiDelete(`/inventory/categories/${deleteCatTarget.id}`);
      toast.success("Category deleted.");
      setDeleteCatTarget(null);
      loadData();
    } catch (err) {
      toast.error(err.message || "Failed to delete category.");
    } finally {
      setDeleting(false);
    }
  };

  // Delete item
  const handleDeleteItem = async () => {
    if (!deleteItemTarget || deleting) return;
    setDeleting(true);
    try {
      await apiDelete(`/inventory/items/${deleteItemTarget.id}`);
      toast.success("Item deleted.");
      setDeleteItemTarget(null);
      loadData();
    } catch (err) {
      toast.error(err.message || "Failed to delete item.");
    } finally {
      setDeleting(false);
    }
  };

  // Filtered categories and items
  const q = search.trim().toLowerCase();
  const filteredCategories = categories.filter((c) => {
    if (!q) return true;
    return (
      (c.name || "").toLowerCase().includes(q) ||
      (c.code || "").toLowerCase().includes(q) ||
      (c.description || "").toLowerCase().includes(q)
    );
  });

  const filteredItems = items.filter((i) => {
    if (!q) return true;
    const nameMatch = (i.name || "").toLowerCase().includes(q);
    const codeMatch = (i.code || i.sku || "").toLowerCase().includes(q);
    let specMatch = false;
    if (Array.isArray(i.specifications)) {
      specMatch = i.specifications.some(
        (s) =>
          (s?.key || "").toLowerCase().includes(q) ||
          (s?.value || "").toLowerCase().includes(q)
      );
    } else if (i.specifications && typeof i.specifications === "object") {
      specMatch = Object.entries(i.specifications).some(
        ([k, v]) =>
          k.toLowerCase().includes(q) || String(v).toLowerCase().includes(q)
      );
    }
    return nameMatch || codeMatch || specMatch;
  });

  // Level Badge colors
  const getLevelBadge = (level) => {
    switch (level) {
      case 1:
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
            Level 1 (Root)
          </span>
        );
      case 2:
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
            Level 2 (Sub)
          </span>
        );
      case 3:
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
            Level 3 (Sub)
          </span>
        );
      case 4:
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20">
            Level 4 (Final)
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Breadcrumb Navigation & Back ─────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-background border border-border rounded-2xl p-4 card-shadow">
        <div className="flex items-center gap-2 flex-wrap text-sm">
          {navPath.length === 0 && onBackToHub && (
            <button
              onClick={onBackToHub}
              className="mr-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border hover:bg-secondary text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Back to Inventory Submodules"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Hub</span>
            </button>
          )}

          {navPath.length > 0 && (
            <button
              onClick={handleBack}
              className="mr-2 p-1.5 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Go Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}

          <button
            onClick={() => handleBreadcrumbClick(-1)}
            className={`font-semibold cursor-pointer hover:text-primary transition-colors ${
              navPath.length === 0 ? "text-primary" : "text-muted-foreground"
            }`}
          >
            Inventory In
          </button>

          {navPath.map((crumb, idx) => {
            const isLast = idx === navPath.length - 1;
            return (
              <div key={crumb.id || idx} className="flex items-center gap-2">
                <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
                <button
                  onClick={() => handleBreadcrumbClick(idx)}
                  className={`font-semibold cursor-pointer transition-colors ${
                    isLast
                      ? "text-primary hover:underline"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {crumb.name}
                </button>
                {isLast && getLevelBadge(crumb.level || idx + 1)}
              </div>
            );
          })}
        </div>

        {/* Global actions in current level */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            className="p-2.5 rounded-xl border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Refresh View"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          {/* Add Subcategory button: ONLY if depth is less than 4 */}
          {canAddSubcategory ? (
            <button
              onClick={() => {
                setCategoryToEdit(null);
                setIsCategoryModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl border border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <FolderPlus className="h-4 w-4" />
              {currentLevel === 0 ? "Add Category" : "Add Subcategory"}
            </button>
          ) : (
            <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Max Level 4 Reached (Items Only)</span>
            </div>
          )}

          {/* Add Item button: Available at ANY level */}
          <button
            onClick={() => {
              setItemToEdit(null);
              setIsItemModalOpen(true);
            }}
            className="bg-[#1e3a5f] hover:bg-[#162b45] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Add Item
          </button>
        </div>
      </div>

      {/* ─── Search & View Controls ───────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={
              currentLevel === 4
                ? "Search items, specifications, codes..."
                : "Search categories, subcategories, items..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 pl-10 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground mr-1">
            {filteredCategories.length} categories • {filteredItems.length} items
          </span>
          <div className="border border-border rounded-xl p-1 flex items-center bg-secondary/30">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === "grid"
                  ? "bg-background text-primary shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Grid View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === "table"
                  ? "bg-background text-primary shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Table View"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Main Content ─────────────────────────────────────────── */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center text-muted-foreground gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-sm">Loading inventory hierarchy...</span>
        </div>
      ) : (
        <div className="space-y-8">
          {/* ═══════════════════════════════════════════════════════════ */}
          {/* Subcategories Section (Hidden at Level 4)                    */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {canAddSubcategory && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Folder className="h-5 w-5 text-primary" />
                  <h3 className="font-display text-base font-bold text-foreground">
                    {currentLevel === 0
                      ? "Categories (Level 1)"
                      : `Subcategories (Level ${currentLevel + 1})`}
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-semibold">
                    {filteredCategories.length}
                  </span>
                </div>
              </div>

              {filteredCategories.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-secondary/10 p-8 text-center text-muted-foreground text-sm">
                  <Folder className="h-8 w-8 mx-auto mb-2 opacity-30 text-muted-foreground" />
                  <p>
                    {search
                      ? "No categories matching your search query."
                      : currentLevel === 0
                      ? "No categories defined yet. Click '+ Add Category' to create the first root category."
                      : "No subcategories created under this category yet."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredCategories.map((cat) => {
                    const childCount = cat._count?.children ?? cat.children?.length ?? 0;
                    const itemCount = cat._count?.items ?? cat.items?.length ?? 0;
                    const catLevel = cat.level || currentLevel + 1;

                    return (
                      <div
                        key={cat.id}
                        onClick={() => handleDrillDown(cat)}
                        className="group relative rounded-2xl border border-border bg-background p-5 card-shadow transition-all hover:border-primary/50 hover:shadow-md cursor-pointer flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                              <Folder className="h-5 w-5 fill-primary/20" />
                            </div>
                            {getLevelBadge(catLevel)}
                          </div>

                          <h4 className="font-display text-base font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                            {cat.name}
                          </h4>

                          {cat.code && (
                            <p className="text-xs font-mono text-muted-foreground mt-0.5">
                              {cat.code}
                            </p>
                          )}

                          {cat.description && (
                            <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                              {cat.description}
                            </p>
                          )}
                        </div>

                        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span>{childCount} subs</span>
                            <span>•</span>
                            <span>{itemCount} items</span>
                          </div>

                          <div
                            className="flex items-center gap-1 opacity-80 group-hover:opacity-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                setCategoryToEdit(cat);
                                setIsCategoryModalOpen(true);
                              }}
                              className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-blue-600 transition-colors cursor-pointer"
                              title="Edit Category"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteCatTarget(cat)}
                              className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-rose-600 transition-colors cursor-pointer"
                              title="Delete Category"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* Items Section                                               */}
          {/* ═══════════════════════════════════════════════════════════ */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-[#1e3a5f]" />
                <h3 className="font-display text-base font-bold text-foreground">
                  {currentCategory
                    ? `Items in "${currentCategory.name}"`
                    : "Direct Inventory Items (Root Level)"}
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-semibold">
                  {filteredItems.length}
                </span>
              </div>
            </div>

            {filteredItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/10 p-10 text-center text-muted-foreground text-sm">
                <Box className="h-8 w-8 mx-auto mb-2 opacity-30 text-muted-foreground" />
                <p>
                  {search
                    ? "No items matching your search query."
                    : "No items added at this level yet. Click '+ Add Item' to create an item with specifications and photo."}
                </p>
              </div>
            ) : viewMode === "grid" ? (
              /* Items Grid View */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredItems.map((item) => {
                  const specsArr = Array.isArray(item.specifications)
                    ? item.specifications
                    : item.specifications && typeof item.specifications === "object"
                    ? Object.entries(item.specifications).map(([k, v]) => ({ key: k, value: v }))
                    : [];

                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-border bg-background p-4 card-shadow flex flex-col justify-between hover:border-[#1e3a5f]/50 transition-all group"
                    >
                      <div>
                        {/* Photo Thumbnail or Placeholder */}
                        <div className="w-full h-36 rounded-xl bg-secondary/40 border border-border/60 overflow-hidden flex items-center justify-center mb-3 relative">
                          {item.photoUrl ? (
                            <img
                              src={resolveImageUrl(item.photoUrl)}
                              alt={item.name}
                              className="w-full h-full object-contain p-2"
                            />
                          ) : (
                            <div className="flex flex-col items-center text-muted-foreground/60">
                              <Package className="h-10 w-10 stroke-[1.2]" />
                              <span className="text-[11px] mt-1 font-mono">No Image</span>
                            </div>
                          )}

                          {/* Quantity pill */}
                          <div className="absolute top-2 right-2 px-2.5 py-1 rounded-full text-xs font-bold bg-background/90 backdrop-blur-xs border border-border shadow-xs text-foreground">
                            {item.quantity} {item.unit || "Nos"}
                          </div>
                        </div>

                        {/* Item Code & Name */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[11px] font-mono font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                              {item.code || item.sku || "NO-CODE"}
                            </span>
                            <h4 className="font-display text-base font-bold text-foreground mt-1.5 line-clamp-1 group-hover:text-primary transition-colors">
                              {item.name}
                            </h4>
                          </div>
                        </div>

                        {/* 5 Key-Value Specifications */}
                        {specsArr.length > 0 && (
                          <div className="mt-3 pt-2.5 border-t border-border/60 space-y-1">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                              Specifications:
                            </span>
                            <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                              {specsArr.slice(0, 5).map((s, idx) => (
                                <div
                                  key={idx}
                                  className="text-xs flex items-center justify-between bg-secondary/40 px-2 py-1 rounded-md text-foreground"
                                >
                                  <span className="font-medium text-muted-foreground truncate max-w-[45%]">
                                    {s.key}:
                                  </span>
                                  <span className="font-semibold text-foreground truncate max-w-[50%]">
                                    {s.value}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Footer: Date & Actions */}
                      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                        <span className="text-[11px] truncate">
                          {fmtDate(item.updatedAt || item.createdAt)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setItemToEdit(item);
                              setIsItemModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-blue-600 transition-colors cursor-pointer"
                            title="Edit Item Details & Stock"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteItemTarget(item)}
                            className="p-1.5 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-rose-600 transition-colors cursor-pointer"
                            title="Delete Item"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Items Table View */
              <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border bg-secondary/40">
                        <th className="px-5 py-3.5 font-semibold">Photo</th>
                        <th className="px-5 py-3.5 font-semibold">Code</th>
                        <th className="px-5 py-3.5 font-semibold">Item Name</th>
                        <th className="px-5 py-3.5 font-semibold">Specifications</th>
                        <th className="px-5 py-3.5 font-semibold">Quantity</th>
                        <th className="px-5 py-3.5 font-semibold">Unit</th>
                        <th className="px-5 py-3.5 font-semibold">Last Updated</th>
                        <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredItems.map((item) => {
                        const specsArr = Array.isArray(item.specifications)
                          ? item.specifications
                          : item.specifications && typeof item.specifications === "object"
                          ? Object.entries(item.specifications).map(([k, v]) => ({ key: k, value: v }))
                          : [];

                        return (
                          <tr key={item.id} className="hover:bg-secondary/30 transition-colors">
                            <td className="px-5 py-3">
                              <div className="w-10 h-10 rounded-lg bg-secondary/60 border border-border overflow-hidden flex items-center justify-center">
                                {item.photoUrl ? (
                                  <img
                                    src={resolveImageUrl(item.photoUrl)}
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <Package className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-3 text-xs font-mono font-bold text-primary">
                              {item.code || item.sku || "—"}
                            </td>
                            <td className="px-5 py-3 font-semibold text-foreground whitespace-nowrap">
                              {item.name}
                            </td>
                            <td className="px-5 py-3 text-xs max-w-xs">
                              <div className="flex flex-wrap gap-1">
                                {specsArr.slice(0, 3).map((s, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 rounded bg-secondary text-muted-foreground font-mono text-[11px]"
                                  >
                                    {s.key}: {s.value}
                                  </span>
                                ))}
                                {specsArr.length > 3 && (
                                  <span className="text-[11px] text-muted-foreground">
                                    +{specsArr.length - 3} more
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-3 font-bold text-foreground">
                              {item.quantity}
                            </td>
                            <td className="px-5 py-3 text-xs text-muted-foreground">
                              {item.unit || "Nos"}
                            </td>
                            <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                              {fmtDate(item.updatedAt || item.createdAt)}
                            </td>
                            <td className="px-5 py-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setItemToEdit(item);
                                    setIsItemModalOpen(true);
                                  }}
                                  className="p-1.5 rounded-lg text-muted-foreground hover:text-blue-600 hover:bg-blue-500/10 transition-colors cursor-pointer"
                                  title="Edit"
                                >
                                  <Edit3 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => setDeleteItemTarget(item)}
                                  className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
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
        </div>
      )}

      {/* ─── Modals ───────────────────────────────────────────────── */}
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        parentCategory={currentCategory}
        categoryToEdit={categoryToEdit}
        onSuccess={loadData}
      />

      <ItemCardModal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        item={itemToEdit}
        categoryId={currentCategory?.id || null}
        categoryName={
          currentCategory
            ? navPath.map((c) => c.name).join(" > ")
            : "Root Level"
        }
        onSuccess={loadData}
      />

      {/* Delete Category Modal */}
      {deleteCatTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-foreground">
                Delete Category
              </h3>
              <button
                onClick={() => setDeleteCatTarget(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-secondary cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete category{" "}
              <strong className="text-foreground">{deleteCatTarget.name}</strong>?
              Any subcategories or items under it will also be deleted. This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteCatTarget(null)}
                className="px-4 py-2 text-sm font-semibold rounded-xl border border-border hover:bg-secondary cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCategory}
                disabled={deleting}
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
              >
                {deleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Item Modal */}
      {deleteItemTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-foreground">
                Delete Item
              </h3>
              <button
                onClick={() => setDeleteItemTarget(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-secondary cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete item{" "}
              <strong className="text-foreground">{deleteItemTarget.name}</strong> (
              <span className="font-mono text-xs">{deleteItemTarget.code || deleteItemTarget.sku}</span>)?
              This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteItemTarget(null)}
                className="px-4 py-2 text-sm font-semibold rounded-xl border border-border hover:bg-secondary cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteItem}
                disabled={deleting}
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
              >
                {deleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryInView;

