import { useState, useEffect, useMemo, useRef } from "react";
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
  Sparkles,
  ChevronRight,
  X,
  SlidersHorizontal,
  Compass,
  ArrowRight,
  Building,
  HelpCircle
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

// Gets category hierarchy details: { rootName, subName, fullBreadcrumb, levels }
export const getItemCategoryDetails = (item, categoriesList = []) => {
  if (!item) {
    return { rootName: "Uncategorized", subName: "", fullBreadcrumb: "Uncategorized", chain: [] };
  }

  const catId = item.categoryId || item.categoryRef?.id;
  const chain = [];

  if (catId && Array.isArray(categoriesList) && categoriesList.length > 0) {
    let curr = categoriesList.find((c) => c.id === catId);
    let depth = 0;
    while (curr && depth < 6) {
      chain.unshift({ id: curr.id, name: curr.name, level: curr.level });
      curr = curr.parentId ? categoriesList.find((c) => c.id === curr.parentId) : null;
      depth++;
    }
  } else if (item.categoryRef) {
    let curr = item.categoryRef;
    let depth = 0;
    while (curr && depth < 6) {
      chain.unshift({ id: curr.id, name: curr.name, level: curr.level });
      curr = curr.parent;
      depth++;
    }
  }

  if (chain.length === 0) {
    const raw = item.category || "Uncategorized";
    return { rootName: raw, subName: "", fullBreadcrumb: raw, chain: [] };
  }

  const names = chain.map((c) => c.name);
  const rootName = names[0] || "Uncategorized";
  const subName = names.length > 1 ? names.slice(1).join(" › ") : "";
  const fullBreadcrumb = names.join(" › ");

  return { rootName, subName, fullBreadcrumb, chain };
};

// Checks whether an item belongs to a target category ID (matches Level 1, subcategories, or uncategorized)
export const isItemInCategoryId = (item, targetCategoryId, categoriesList = []) => {
  if (!item || !targetCategoryId || targetCategoryId === "ALL") return true;

  if (targetCategoryId === "UNCATEGORIZED") {
    return !item.categoryId && !item.categoryRef;
  }

  const catId = item.categoryId || item.categoryRef?.id;
  if (catId === targetCategoryId) return true;

  // Root category match (e.g. user selected Level 1, item is under child)
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
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "table"
  const [viewingItem, setViewingItem] = useState(null);

  // Cascading Root Level Category & Item Filters (Level 1 -> Level 2 -> Level 3 -> Level 4 -> Item)
  const [level1Id, setLevel1Id] = useState("ALL");
  const [level2Id, setLevel2Id] = useState("ALL");
  const [level3Id, setLevel3Id] = useState("ALL");
  const [level4Id, setLevel4Id] = useState("ALL");
  const [selectedItemId, setSelectedItemId] = useState("ALL");

  const searchInputRef = useRef(null);

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

  // Level 2 Subcategories (children of chosen Level 1)
  const level2Options = useMemo(() => {
    if (level1Id === "ALL") return [];
    return categories.filter((c) => c.parentId === level1Id);
  }, [categories, level1Id]);

  // Level 3 Subcategories (children of chosen Level 2)
  const level3Options = useMemo(() => {
    if (level2Id === "ALL") return [];
    return categories.filter((c) => c.parentId === level2Id);
  }, [categories, level2Id]);

  // Level 4 Subcategories (children of chosen Level 3)
  const level4Options = useMemo(() => {
    if (level3Id === "ALL") return [];
    return categories.filter((c) => c.parentId === level3Id);
  }, [categories, level3Id]);

  // Cascade Handlers
  const handleLevel1Change = (val) => {
    setLevel1Id(val);
    setLevel2Id("ALL");
    setLevel3Id("ALL");
    setLevel4Id("ALL");
    setSelectedItemId("ALL");
  };

  const handleLevel2Change = (val) => {
    setLevel2Id(val);
    setLevel3Id("ALL");
    setLevel4Id("ALL");
    setSelectedItemId("ALL");
  };

  const handleLevel3Change = (val) => {
    setLevel3Id(val);
    setLevel4Id("ALL");
    setSelectedItemId("ALL");
  };

  const handleLevel4Change = (val) => {
    setLevel4Id(val);
    setSelectedItemId("ALL");
  };

  const handleResetHierarchy = () => {
    setLevel1Id("ALL");
    setLevel2Id("ALL");
    setLevel3Id("ALL");
    setLevel4Id("ALL");
    setSelectedItemId("ALL");
    setSearch("");
  };

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

  // Active category scope
  const activeEffectiveCategory = useMemo(() => {
    if (level4Id !== "ALL") return level4Id;
    if (level3Id !== "ALL") return level3Id;
    if (level2Id !== "ALL") return level2Id;
    if (level1Id !== "ALL") return level1Id;
    return "ALL";
  }, [level1Id, level2Id, level3Id, level4Id]);

  // Selected category object
  const activeCategoryObj = useMemo(() => {
    if (activeEffectiveCategory === "ALL") return null;
    return categories.find((c) => c.id === activeEffectiveCategory) || null;
  }, [activeEffectiveCategory, categories]);

  // Items in active category scope (for populating Item Dropdown)
  const categoryFilteredItems = useMemo(() => {
    if (activeEffectiveCategory === "ALL") return items;
    return items.filter((item) =>
      isItemInCategoryId(item, activeEffectiveCategory, categories)
    );
  }, [items, categories, activeEffectiveCategory]);

  // SEARCH TRIGGER FLAG:
  // "if user search then show if no search data is not show"
  // User search criteria is active if:
  // 1. Text search is typed (search.trim().length > 0) OR
  // 2. A Root Level Category is chosen (level1Id !== "ALL") OR
  // 3. A specific item is selected from dropdown (selectedItemId !== "ALL")
  const hasActiveSearch = useMemo(() => {
    return Boolean(
      search.trim().length > 0 ||
      level1Id !== "ALL" ||
      selectedItemId !== "ALL"
    );
  }, [search, level1Id, selectedItemId]);

  // Filter items based on user's active search and root hierarchy
  const filteredItems = useMemo(() => {
    if (!hasActiveSearch) {
      return []; // DATA IS NOT SHOWN UNLESS USER SEARCHES
    }

    const q = search.trim().toLowerCase();

    return items.filter((item) => {
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
        activeEffectiveCategory === "ALL" ||
        isItemInCategoryId(item, activeEffectiveCategory, categories);

      const matchesSelectedItem =
        selectedItemId === "ALL" || item.id === selectedItemId;

      return matchesSearch && matchesCategory && matchesSelectedItem;
    });
  }, [items, categories, search, hasActiveSearch, activeEffectiveCategory, selectedItemId]);

  // Metrics for all catalog
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

  // Search Results valuation & totals
  const searchResultsValuation = useMemo(() => {
    return filteredItems.reduce((acc, curr) => {
      return acc + Number(curr.quantity || 0) * Number(curr.costPrice || 0);
    }, 0);
  }, [filteredItems]);

  const searchResultsUnits = useMemo(() => {
    return filteredItems.reduce((acc, curr) => acc + Number(curr.quantity || 0), 0);
  }, [filteredItems]);

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════════════════════════
          ULTRA PRO HEADER & BACK BAR
      ═══════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card/90 to-violet-500/5 p-6 sm:p-8 card-shadow">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-60 w-60 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 h-40 w-40 rounded-full bg-blue-500/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <button
              type="button"
              onClick={onBackToHub}
              className="group p-3 rounded-2xl border border-border/80 bg-background/80 hover:bg-background text-muted-foreground hover:text-foreground transition-all duration-200 card-shadow hover:scale-105 active:scale-95 cursor-pointer shrink-0"
              title="Back to Inventory Submodules"
            >
              <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" />
            </button>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-violet-500/25 shrink-0">
              <Boxes className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                  View Inventory
                </h1>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20">
                  <Sparkles className="h-3.5 w-3.5" />
                  Ultra Pro Catalog
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                Smart hierarchical stock catalog with Root-Level multi-tier filtering, instant SKU valuation, and visual photo inspection.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end lg:self-center">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-secondary/60 border border-border rounded-2xl p-1 shadow-inner">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  viewMode === "grid"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Grid View with Product Cards"
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  viewMode === "table"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Dense Master Table View"
              >
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>

            <button
              type="button"
              onClick={loadCatalogData}
              disabled={loading}
              className="p-3 rounded-2xl border border-border/80 bg-background text-muted-foreground hover:text-foreground hover:bg-secondary transition-all disabled:opacity-50 card-shadow hover:scale-105 active:scale-95 cursor-pointer"
              title="Refresh Master Catalog"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-primary" : ""}`} />
            </button>
          </div>
        </div>

      </div>



      {/* ═══════════════════════════════════════════════════════════════
          ULTRA PRO ROOT LEVEL MULTI-TIER FILTERING CONSOLE
      ═══════════════════════════════════════════════════════════════ */}
      <div className="rounded-3xl border border-border/90 bg-card p-6 card-shadow space-y-4">
        {/* Root Level Multi-Tier Dropdown Cascade */}
        <div>
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-violet-600" />
              <span className="text-xs font-extrabold uppercase tracking-wider text-foreground">
                Root Level Hierarchy Filter
              </span>
            </div>
            {activeEffectiveCategory !== "ALL" && (
              <span className="text-xs font-mono font-semibold text-violet-600 dark:text-violet-400 bg-violet-500/10 px-2.5 py-0.5 rounded-full border border-violet-500/20">
                Scope: {activeCategoryObj?.name || activeEffectiveCategory}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* 1. Root Level 1 */}
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-violet-600"></span>
                Root Level 1
              </label>
              <select
                value={level1Id}
                onChange={(e) => handleLevel1Change(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500/20 cursor-pointer"
              >
                <option value="ALL">All Level 1</option>
                {level1Categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Root Level 2 */}
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                Root Level 2
              </label>
              <select
                value={level2Id}
                onChange={(e) => handleLevel2Change(e.target.value)}
                disabled={level1Id === "ALL" || level2Options.length === 0}
                className="w-full px-3.5 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <option value="ALL">
                  {level1Id === "ALL"
                    ? "Select Level 1 First"
                    : level2Options.length === 0
                    ? "No Subcategories"
                    : "All Level 2"}
                </option>
                {level2Options.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Root Level 3 */}
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                Root Level 3
              </label>
              <select
                value={level3Id}
                onChange={(e) => handleLevel3Change(e.target.value)}
                disabled={level2Id === "ALL" || level3Options.length === 0}
                className="w-full px-3.5 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <option value="ALL">
                  {level2Id === "ALL"
                    ? "Select Level 2 First"
                    : level3Options.length === 0
                    ? "No Subcategories"
                    : "All Level 3"}
                </option>
                {level3Options.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Root Level 4 */}
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                Root Level 4
              </label>
              <select
                value={level4Id}
                onChange={(e) => handleLevel4Change(e.target.value)}
                disabled={level3Id === "ALL" || level4Options.length === 0}
                className="w-full px-3.5 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <option value="ALL">
                  {level3Id === "ALL"
                    ? "Select Level 3 First"
                    : level4Options.length === 0
                    ? "No Subcategories"
                    : "All Level 4"}
                </option>
                {level4Options.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 5. Product / Item Select */}
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                Product / Item
              </label>
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
              >
                <option value="ALL">All Items</option>
                {categoryFilteredItems.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} {it.code || it.sku ? `(${it.code || it.sku})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SEARCH RESULTS OR "WAITING FOR SEARCH" STATE
      ═══════════════════════════════════════════════════════════════ */}
      {loading ? (
        <div className="p-20 text-center text-muted-foreground bg-card rounded-3xl border border-border card-shadow">
          <RefreshCw className="h-10 w-10 animate-spin mx-auto mb-4 text-violet-600" />
          <h3 className="text-base font-bold text-foreground">Loading Stock Catalog...</h3>
          <p className="text-xs text-muted-foreground mt-1">Fetching root hierarchy and product master data.</p>
        </div>
      ) : !hasActiveSearch ? (
        /* ─── EMPTY STATE: NO SEARCH PERFORMED YET (DATA NOT SHOWN) ─── */
        <div className="relative overflow-hidden rounded-3xl border border-dashed border-border/90 bg-gradient-to-b from-card to-card/60 p-12 sm:p-16 text-center card-shadow">
          <div className="max-w-lg mx-auto space-y-6">
            <div className="relative mx-auto w-24 h-24 rounded-3xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400 shadow-inner">
              <Search className="h-10 w-10 animate-bounce" />
              <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-md">
                <Folder className="h-4 w-4" />
              </div>
            </div>

            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-violet-500/10 text-violet-700 dark:text-violet-300 mb-3 border border-violet-500/20">
                <Compass className="h-3.5 w-3.5" />
                Root Level Search Mode
              </span>
              <h2 className="font-display text-2xl font-extrabold text-foreground tracking-tight">
                Select a Root Level to View Stock
              </h2>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Stock records are hidden by default. Select a <strong>Root Level 1</strong> category or product from the filters above to display inventory items.
              </p>
            </div>
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        /* ─── SEARCH RETURNED ZERO MATCHES ─── */
        <div className="rounded-3xl border border-border bg-card p-14 text-center card-shadow space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-foreground">No Matching Stock Items</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
              No inventory records matched your search criteria in the selected category scope.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetHierarchy}
            className="px-4 py-2 bg-secondary text-foreground rounded-xl text-xs font-bold hover:bg-secondary/80 transition-colors cursor-pointer"
          >
            Clear Search Filters
          </button>
        </div>
      ) : (
        /* ─── DATA RESULTS FOUND: RENDER ULTRA PRO CARDS OR TABLE ─── */
        <div className="space-y-4">
          {/* Results Summary Sub-header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground flex-wrap">
              <span className="font-bold text-foreground text-sm">
                Found {filteredItems.length} {filteredItems.length === 1 ? "Item" : "Items"}
              </span>
              <span>•</span>
              <span>Total Units: <strong>{searchResultsUnits}</strong></span>
              <span>•</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                Value: ₹{searchResultsValuation.toLocaleString("en-IN")}
              </span>
            </div>

            <div className="text-xs text-muted-foreground">
              Showing active results for: <span className="font-bold text-foreground">{search || activeCategoryObj?.name || "Selected Filter"}</span>
            </div>
          </div>

          {viewMode === "grid" ? (
            /* ═══════════════════════════════════════════════════════════════
                ULTRA PRO GRID VIEW
            ═══════════════════════════════════════════════════════════════ */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredItems.map((item) => {
                const qty = Number(item.quantity || 0);
                const minS = Number(item.minStock || 5);
                const cost = Number(item.costPrice || 0);
                const totalVal = qty * cost;
                const isLowStock = qty > 0 && qty <= minS;
                const isOutOfStock = qty === 0;
                const { rootName, subName, fullBreadcrumb } = getItemCategoryDetails(item, categories);
                const photoSrc = resolveImageUrl(item.photoUrl || item.img);

                const specsArr = Array.isArray(item.specifications)
                  ? item.specifications
                  : item.specifications && typeof item.specifications === "object"
                  ? Object.entries(item.specifications).map(([k, v]) => ({ key: k, value: v }))
                  : [];

                return (
                  <div
                    key={item.id}
                    className="group rounded-3xl border border-border/90 bg-card p-5 card-shadow hover:border-violet-500/50 hover:shadow-xl transition-all duration-300 flex flex-col justify-between space-y-4"
                  >
                    <div>
                      {/* Product Photo Canvas */}
                      <div
                        onClick={() => setViewingItem(item)}
                        className="relative w-full h-48 rounded-2xl bg-secondary/30 border border-border/70 overflow-hidden flex items-center justify-center mb-3 group/img cursor-pointer transition-colors hover:bg-secondary/50"
                      >
                        {photoSrc ? (
                          <img
                            src={photoSrc}
                            alt={item.name}
                            className="w-full h-full object-contain p-3 transition-transform duration-300 group-hover/img:scale-105"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                              if (e.currentTarget.nextSibling) {
                                e.currentTarget.nextSibling.style.display = "flex";
                              }
                            }}
                          />
                        ) : null}

                        {/* Fallback Placeholder */}
                        <div
                          className={`flex flex-col items-center justify-center text-muted-foreground/50 p-4 text-center ${
                            photoSrc ? "hidden" : "flex"
                          }`}
                        >
                          <Package className="h-12 w-12 stroke-[1.2] mb-1 text-muted-foreground/40" />
                          <span className="text-[10px] font-mono uppercase tracking-wider">
                            No Photo Preview
                          </span>
                        </div>

                        {/* Stock Status Badge */}
                        <span
                          className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold border backdrop-blur-md shadow-sm ${
                            isOutOfStock
                              ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30"
                              : isLowStock
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                              : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                          }`}
                        >
                          {qty} {item.unit || "Nos"}
                        </span>

                        {/* Root Category Pill on Image */}
                        <span className="absolute top-3 left-3 px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-background/80 backdrop-blur-md border border-border text-foreground flex items-center gap-1 shadow-xs">
                          <Folder className="h-3 w-3 text-violet-600" />
                          <span className="truncate max-w-[120px]">{rootName}</span>
                        </span>

                        {/* Hover Overlay Button */}
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-gray-950 text-xs font-extrabold shadow-xl">
                            <Eye className="h-4 w-4 text-violet-600" />
                            <span>Inspect Product</span>
                          </span>
                        </div>
                      </div>

                      {/* Title & SKU */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3
                            onClick={() => setViewingItem(item)}
                            className="font-bold text-base text-foreground line-clamp-1 hover:text-violet-600 transition-colors cursor-pointer"
                            title={item.name}
                          >
                            {item.name}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono mt-0.5">
                            <span className="inline-flex items-center gap-1">
                              <Tag className="h-3 w-3 text-violet-500" />
                              {item.code || item.sku || "NO-CODE"}
                            </span>
                            {item.companyName && (
                              <span className="text-[11px] font-sans text-muted-foreground truncate">
                                • {item.companyName}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setViewingItem(item)}
                          className="p-2 rounded-xl border border-border bg-secondary/40 hover:bg-secondary text-muted-foreground hover:text-violet-600 transition-colors cursor-pointer shrink-0 shadow-xs"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Breadcrumb Hierarchy Path */}
                      <div className="mt-2.5 text-[11px] text-muted-foreground flex items-center gap-1 flex-wrap bg-secondary/20 p-2 rounded-xl border border-border/60">
                        <Layers className="h-3.5 w-3.5 text-violet-600 shrink-0" />
                        <span className="font-semibold text-foreground/90 truncate max-w-full">
                          {fullBreadcrumb}
                        </span>
                      </div>

                      {/* Location & Warehouse */}
                      {(item.warehouse || item.location) && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          <span className="font-medium truncate">
                            {[item.warehouse, item.location].filter(Boolean).join(" • Rack: ")}
                          </span>
                        </div>
                      )}

                      {/* Specifications Preview */}
                      {specsArr.length > 0 && (
                        <div className="mt-3 p-2.5 rounded-xl bg-secondary/30 border border-border/60 text-xs space-y-1 max-h-24 overflow-y-auto scrollbar-none">
                          <div className="flex flex-wrap gap-1.5">
                            {specsArr.slice(0, 4).map((sp, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-md bg-background border border-border text-muted-foreground font-mono text-[10px]"
                              >
                                <strong className="text-foreground">{sp.key}:</strong> {String(sp.value || "—")}
                              </span>
                            ))}
                            {specsArr.length > 4 && (
                              <span className="px-1.5 py-0.5 text-[10px] text-violet-600 font-bold">
                                +{specsArr.length - 4} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bottom Pricing & Valuation Bar */}
                    <div className="pt-3 border-t border-border flex items-center justify-between text-xs flex-wrap gap-2">
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">
                          Stock Level
                        </span>
                        <span className="font-extrabold text-foreground text-sm">
                          {qty} {item.unit || "Nos"}
                        </span>
                      </div>

                      <div className="text-center">
                        <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">
                          Cost / Unit
                        </span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-xs">
                          ₹{cost.toLocaleString("en-IN")}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">
                          Total Value
                        </span>
                        <span className="font-extrabold text-foreground text-sm">
                          ₹{totalVal.toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ═══════════════════════════════════════════════════════════════
                ULTRA PRO TABLE VIEW
            ═══════════════════════════════════════════════════════════════ */
            <div className="rounded-3xl border border-border overflow-hidden bg-card card-shadow">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50 text-muted-foreground uppercase tracking-wider font-bold">
                      <th className="py-4 px-4 w-16">Preview</th>
                      <th className="py-4 px-4">Product Name & Code</th>
                      <th className="py-4 px-4">Root & Hierarchy</th>
                      <th className="py-4 px-4">Stock Qty</th>
                      <th className="py-4 px-4">Unit Price</th>
                      <th className="py-4 px-4">Total Value</th>
                      <th className="py-4 px-4">Location / Rack</th>
                      <th className="py-4 px-4">Created By</th>
                      <th className="py-4 px-4 text-right">Action</th>
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
                      const photoSrc = resolveImageUrl(item.photoUrl || item.img);

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-secondary/30 transition-colors cursor-pointer"
                          onClick={() => setViewingItem(item)}
                        >
                          {/* Image */}
                          <td className="py-3 px-4">
                            <div className="w-12 h-12 rounded-xl bg-secondary/60 border border-border overflow-hidden flex items-center justify-center shrink-0">
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
                          <td className="py-3 px-4">
                            <div className="font-extrabold text-foreground text-sm hover:text-violet-600 transition-colors">
                              {item.name}
                            </div>
                            <div className="font-mono text-[11px] text-muted-foreground mt-0.5">
                              {item.code || item.sku || "—"}
                            </div>
                          </td>

                          {/* Hierarchy */}
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-violet-500/10 text-violet-700 dark:text-violet-300 font-bold text-[11px] border border-violet-500/20 w-fit">
                                <Folder className="h-3 w-3" />
                                {rootName}
                              </span>
                              {subName && (
                                <span className="text-[10px] text-muted-foreground font-medium pl-1 truncate max-w-[180px]">
                                  › {subName}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Stock Qty */}
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold border ${
                                isOutOfStock
                                  ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30"
                                  : isLowStock
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                                  : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                              }`}
                            >
                              {qty} {item.unit || "Nos"}
                            </span>
                          </td>

                          {/* Unit Price */}
                          <td className="py-3 px-4 font-bold text-xs text-emerald-600 dark:text-emerald-400">
                            ₹{cost.toLocaleString("en-IN")}
                          </td>

                          {/* Total Valuation */}
                          <td className="py-3 px-4 font-extrabold text-xs text-foreground">
                            ₹{totalVal.toLocaleString("en-IN")}
                          </td>

                          {/* Storage */}
                          <td className="py-3 px-4 text-xs text-muted-foreground">
                            <div>{item.warehouse || "—"}</div>
                            {item.location && (
                              <div className="text-[11px] text-foreground font-medium flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                {item.location}
                              </div>
                            )}
                          </td>

                          {/* Created By */}
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 font-semibold text-violet-700 dark:text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/20 text-[10px]">
                              <User className="h-3 w-3" />
                              {item.createdByName || "Admin"}
                            </span>
                          </td>

                          {/* Action */}
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingItem(item);
                              }}
                              className="p-2 rounded-xl hover:bg-secondary text-muted-foreground hover:text-violet-600 transition-colors cursor-pointer"
                              title="Inspect Product"
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
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          QUICK VIEW MODAL / LIGHTBOX
      ═══════════════════════════════════════════════════════════════ */}
      <ProductQuickViewModal
        isOpen={!!viewingItem}
        onClose={() => setViewingItem(null)}
        item={viewingItem}
      />
    </div>
  );
}
