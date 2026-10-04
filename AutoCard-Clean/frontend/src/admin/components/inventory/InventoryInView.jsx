import { useState, useEffect, useMemo } from "react";
import {
  Folder, FolderPlus, FolderTree, Package, Plus, Search, ChevronRight,
  ChevronDown, ArrowLeft, Edit3, Trash2, Loader2, Layers, AlertCircle,
  FileText, LayoutGrid, List, RefreshCw, X, Box, Sparkles
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

// ─── Helper: Build Recursive Category Tree (Up to 4 Levels) ─────────────────
const buildCategoryTree = (categoriesList) => {
  if (!Array.isArray(categoriesList)) return [];
  const map = new Map();
  const roots = [];

  // Pass 1: Clone and map all categories
  categoriesList.forEach((cat) => {
    map.set(cat.id, { ...cat, children: [] });
  });

  // Pass 2: Connect children to parents
  categoriesList.forEach((cat) => {
    const node = map.get(cat.id);
    if (cat.parentId && map.has(cat.parentId)) {
      map.get(cat.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
};

// ─── Helper: Flatten Tree with Full Breadcrumb Path ─────────────────────────
const flattenTreeWithPath = (tree, parentPath = "") => {
  const result = [];
  const traverse = (nodes, currentPath) => {
    nodes.forEach((node) => {
      const fullPath = currentPath ? `${currentPath} > ${node.name}` : node.name;
      result.push({ ...node, fullPath });
      if (node.children && node.children.length > 0) {
        traverse(node.children, fullPath);
      }
    });
  };
  traverse(tree, parentPath);
  return result;
};

// ─── Level Badge Component ──────────────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════════════════
// Recursive Tree Node Component (Shows Indentation & Hierarchy Connectors)
// ═══════════════════════════════════════════════════════════════════════════
const CategoryTreeNode = ({
  cat,
  level = 1,
  expandedMap,
  toggleExpand,
  onDrillDown,
  onAddSubcategory,
  onAddItem,
  onEdit,
  onDelete,
  searchTerm,
}) => {
  const isExpanded = expandedMap[cat.id] ?? true;
  const hasChildren = cat.children && cat.children.length > 0;
  const childCount = cat.children?.length ?? cat._count?.children ?? 0;
  const itemCount = cat._count?.items ?? cat.items?.length ?? 0;

  // Highlight if matches search
  const isMatch = searchTerm
    ? cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cat.code && cat.code.toLowerCase().includes(searchTerm.toLowerCase()))
    : false;

  return (
    <div className="relative">
      {/* Node Row */}
      <div
        className={`group flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-all ${
          isMatch
            ? "border-primary ring-2 ring-primary/20 bg-primary/5"
            : level === 1
            ? "bg-background border-border hover:border-primary/50 card-shadow"
            : level === 2
            ? "bg-secondary/40 border-border/80 hover:border-primary/40"
            : level === 3
            ? "bg-secondary/25 border-border/60 hover:border-amber-500/40"
            : "bg-secondary/15 border-border/40 hover:border-rose-500/40"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Expand / Collapse Chevron */}
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleExpand(cat.id)}
              className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <span className="w-6 h-6 flex items-center justify-center text-muted-foreground/30 text-xs">
              •
            </span>
          )}

          {/* Color-coded Folder Icon */}
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
              level === 1
                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                : level === 2
                ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                : level === 3
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
            }`}
          >
            <Folder className="h-4 w-4" />
          </div>

          {/* Name, Code & Level */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                onClick={() => onDrillDown(cat)}
                className="font-bold text-sm text-foreground hover:text-primary transition-colors cursor-pointer truncate"
                title={`Click to open "${cat.name}"`}
              >
                {cat.name}
              </span>

              {cat.code && (
                <span className="font-mono text-[11px] text-muted-foreground px-1.5 py-0.5 rounded bg-secondary border border-border/50">
                  {cat.code}
                </span>
              )}

              {getLevelBadge(level)}
            </div>

            {cat.description && (
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5 leading-relaxed">
                {cat.description}
              </p>
            )}
          </div>
        </div>

        {/* Counts & Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <span className="px-2 py-0.5 rounded-full bg-secondary font-medium">
              {childCount} {childCount === 1 ? "sub" : "subs"}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-secondary font-medium">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Open / Drill-Down Button */}
            <button
              type="button"
              onClick={() => onDrillDown(cat)}
              className="px-2.5 py-1 rounded-lg border border-border hover:bg-secondary text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
              title="Open category folder"
            >
              <span>Open</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>

            {/* Add Subcategory (Levels 1 to 3 only) */}
            {level < 4 && (
              <button
                type="button"
                onClick={() => onAddSubcategory(cat)}
                className="p-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors cursor-pointer shadow-xs"
                title={`Add Subcategory (Level ${level + 1})`}
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Add Item directly to this category */}
            <button
              type="button"
              onClick={() => onAddItem(cat)}
              className="p-1.5 rounded-lg border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer shadow-xs"
              title="Add item into this category"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>

            {/* Edit */}
            <button
              type="button"
              onClick={() => onEdit(cat)}
              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-blue-600 transition-colors cursor-pointer"
              title="Edit category"
            >
              <Edit3 className="h-3.5 w-3.5" />
            </button>

            {/* Delete */}
            <button
              type="button"
              onClick={() => onDelete(cat)}
              className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
              title="Delete category"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Children branches (Indented with visual connector line) */}
      {hasChildren && isExpanded && (
        <div className="ml-5 pl-4 border-l-2 border-primary/20 space-y-2.5 mt-2.5">
          {cat.children.map((child) => (
            <CategoryTreeNode
              key={child.id}
              cat={child}
              level={level + 1}
              expandedMap={expandedMap}
              toggleExpand={toggleExpand}
              onDrillDown={onDrillDown}
              onAddSubcategory={onAddSubcategory}
              onAddItem={onAddItem}
              onEdit={onEdit}
              onDelete={onDelete}
              searchTerm={searchTerm}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Main InventoryInView Component
// ═══════════════════════════════════════════════════════════════════════════
const InventoryInView = ({ onBackToHub }) => {
  // Navigation stack: array of category objects [rootCategory, sub2, sub3, sub4]
  const [navPath, setNavPath] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // Default to 'tree' view so the hierarchy is immediately visible!
  const [viewMode, setViewMode] = useState("tree"); // 'tree' | 'grid' | 'table'
  const [expandedNodes, setExpandedNodes] = useState({});

  // Modals state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [modalParentCategory, setModalParentCategory] = useState(null);
  const [categoryToEdit, setCategoryToEdit] = useState(null);

  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemTargetCategory, setItemTargetCategory] = useState(null);
  const [itemToEdit, setItemToEdit] = useState(null);

  // Delete confirmations
  const [deleteCatTarget, setDeleteCatTarget] = useState(null);
  const [deleteItemTarget, setDeleteItemTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Current category is the last item in navPath (or null if at root)
  const currentCategory = navPath.length > 0 ? navPath[navPath.length - 1] : null;
  const currentLevel = currentCategory ? (currentCategory.level || 1) : 0;
  const canAddSubcategory = currentLevel < 4;

  // Build recursive category tree from all categories
  const categoryTree = useMemo(() => buildCategoryTree(allCategories), [allCategories]);

  // Flattened tree for Table View with complete breadcrumb paths
  const flattenedCategories = useMemo(
    () => flattenTreeWithPath(categoryTree),
    [categoryTree]
  );

  // Toggle node expand/collapse
  const toggleExpand = (id) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [id]: !(prev[id] ?? true),
    }));
  };

  const expandAll = () => {
    const allExpanded = {};
    allCategories.forEach((c) => {
      allExpanded[c.id] = true;
    });
    setExpandedNodes(allExpanded);
  };

  const collapseAll = () => {
    const allCollapsed = {};
    allCategories.forEach((c) => {
      allCollapsed[c.id] = false;
    });
    setExpandedNodes(allCollapsed);
  };

  // Load inventory data
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch all categories so tree and counts are always up-to-date
      const catsRes = await apiGet("/inventory/categories");
      const cats = catsRes?.categories || [];
      setAllCategories(cats);

      // 2. Filter categories for CURRENT level in Folder Cards View
      if (!currentCategory) {
        // At Root level: only show Level 1 root categories (e.g. A and B)
        const roots = cats.filter((c) => !c.parentId || c.level === 1);
        setCategories(roots);

        // Load root-level direct items
        const itemsRes = await apiGet("/inventory/items?rootOnly=true");
        setItems(itemsRes?.items || []);
      } else {
        // Inside a category: only show direct children of currentCategory
        const directChildren = cats.filter((c) => c.parentId === currentCategory.id);
        setCategories(directChildren);

        // Load direct items in this category
        const itemsRes = await apiGet(`/inventory/items?categoryId=${currentCategory.id}`);
        setItems(itemsRes?.items || []);
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
    // In folder cards mode, drill into category
    setNavPath((prev) => [...prev, cat]);
    // Switch to folder grid view when drilling into a folder
    if (viewMode === "tree") {
      setViewMode("grid");
    }
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
      // If we deleted the current category or an ancestor, reset nav
      if (navPath.some((c) => c.id === deleteCatTarget.id)) {
        setNavPath([]);
      }
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

  // Filter categories by search
  const filteredCategories = categories.filter((cat) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      cat.name.toLowerCase().includes(q) ||
      (cat.code && cat.code.toLowerCase().includes(q)) ||
      (cat.description && cat.description.toLowerCase().includes(q))
    );
  });

  // Filter items by search
  const filteredItems = items.filter((i) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const nameMatch = i.name.toLowerCase().includes(q);
    const codeMatch =
      (i.code && i.code.toLowerCase().includes(q)) ||
      (i.sku && i.sku.toLowerCase().includes(q));
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
    return nameMatch || codeMatch || specMatch;
  });

  return (
    <div className="space-y-6">
      {/* ─── Breadcrumb Navigation & Back ─────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-background border border-border rounded-2xl p-4 card-shadow">
        <div className="flex items-center gap-2 flex-wrap text-sm">
          {navPath.length === 0 && onBackToHub && (
            <button
              type="button"
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
              type="button"
              onClick={handleBack}
              className="mr-2 p-1.5 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Go Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
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
                  type="button"
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
            type="button"
            onClick={loadData}
            className="p-2.5 rounded-xl border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Refresh View"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          {/* Add Category / Subcategory button */}
          {canAddSubcategory ? (
            <button
              type="button"
              onClick={() => {
                setCategoryToEdit(null);
                setModalParentCategory(currentCategory);
                setIsCategoryModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl border border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <FolderPlus className="h-4 w-4" />
              {currentLevel === 0 ? "Add Root Category" : `Add Subcategory (Level ${currentLevel + 1})`}
            </button>
          ) : (
            <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Max Level 4 Reached (Items Only)</span>
            </div>
          )}

          {/* Add Item button */}
          <button
            type="button"
            onClick={() => {
              setItemToEdit(null);
              setItemTargetCategory(currentCategory);
              setIsItemModalOpen(true);
            }}
            className="bg-[#1e3a5f] hover:bg-[#162b45] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Add Item
          </button>
        </div>
      </div>

      {/* ─── Search & View Switcher ───────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap bg-background border border-border rounded-2xl p-4 card-shadow">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={
              viewMode === "tree"
                ? "Filter hierarchy tree categories..."
                : currentLevel === 4
                ? "Search items in this level..."
                : "Search categories and items..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 pl-10 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="flex items-center gap-3">
          {viewMode === "tree" && (
            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={expandAll}
                className="px-2.5 py-1 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Expand All
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="px-2.5 py-1 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Collapse All
              </button>
            </div>
          )}

          {/* View Mode Switcher: Tree View vs Folder Cards vs Table List */}
          <div className="border border-border rounded-xl p-1 flex items-center bg-secondary/40 gap-1">
            <button
              type="button"
              onClick={() => setViewMode("tree")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === "tree"
                  ? "bg-background text-primary shadow-xs font-bold ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Interactive Hierarchy Tree View"
            >
              <FolderTree className="h-3.5 w-3.5" />
              <span>Hierarchy Tree</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === "grid"
                  ? "bg-background text-primary shadow-xs font-bold ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Folder Cards (Drill-Down)"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Folder Cards</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-background text-primary shadow-xs font-bold ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Hierarchical Table View"
            >
              <List className="h-3.5 w-3.5" />
              <span>Table List</span>
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
      ) : viewMode === "tree" ? (
        /* ═══════════════════════════════════════════════════════════════ */
        /* VIEW MODE 1: HIERARCHY TREE VIEW (Complete Visual Tree)         */
        /* ═══════════════════════════════════════════════════════════════ */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderTree className="h-5 w-5 text-primary" />
              <h3 className="font-display text-base font-bold text-foreground">
                Inventory Hierarchy Structure
              </h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold border border-primary/20">
                {allCategories.length} total categories
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              Expand branches to see subcategories up to 4 levels
            </span>
          </div>

          {categoryTree.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-secondary/10 p-12 text-center text-muted-foreground text-sm">
              <FolderTree className="h-10 w-10 mx-auto mb-3 opacity-30 text-primary" />
              <p className="font-semibold text-foreground">No Categories Found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Click "+ Add Root Category" above to create your first Level 1 category.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {categoryTree.map((rootNode) => (
                <CategoryTreeNode
                  key={rootNode.id}
                  cat={rootNode}
                  level={1}
                  expandedMap={expandedNodes}
                  toggleExpand={toggleExpand}
                  onDrillDown={handleDrillDown}
                  onAddSubcategory={(parent) => {
                    setCategoryToEdit(null);
                    setModalParentCategory(parent);
                    setIsCategoryModalOpen(true);
                  }}
                  onAddItem={(targetCat) => {
                    setItemToEdit(null);
                    setItemTargetCategory(targetCat);
                    setIsItemModalOpen(true);
                  }}
                  onEdit={(cat) => {
                    setCategoryToEdit(cat);
                    setModalParentCategory(null);
                    setIsCategoryModalOpen(true);
                  }}
                  onDelete={(cat) => setDeleteCatTarget(cat)}
                  searchTerm={search}
                />
              ))}
            </div>
          )}

          {/* Quick Info Bar */}
          <div className="rounded-xl border border-border bg-secondary/30 p-4 text-xs text-muted-foreground flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-foreground">Color Legend:</span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Level 1 (Root)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Level 2 (Sub)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Level 3 (Sub)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Level 4 (Final)
              </span>
            </div>
            <span>Click "Open" on any category to view its direct items.</span>
          </div>
        </div>
      ) : viewMode === "table" ? (
        /* ═══════════════════════════════════════════════════════════════ */
        /* VIEW MODE 2: TABLE LIST VIEW (Indented Hierarchy Table)        */
        /* ═══════════════════════════════════════════════════════════════ */
        <div className="rounded-2xl border border-border bg-background card-shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary/70 border-b border-border text-xs uppercase font-bold text-muted-foreground">
                <tr>
                  <th className="py-3 px-4">Category Name & Hierarchy Path</th>
                  <th className="py-3 px-4">Level</th>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Subcategories</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {flattenedCategories.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground text-sm">
                      No categories defined yet.
                    </td>
                  </tr>
                ) : (
                  flattenedCategories.map((cat) => {
                    const childCount = cat.children?.length ?? cat._count?.children ?? 0;
                    const itemCount = cat._count?.items ?? cat.items?.length ?? 0;
                    return (
                      <tr key={cat.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="py-3 px-4">
                          <div
                            className="flex items-center gap-2"
                            style={{ paddingLeft: `${(cat.level - 1) * 20}px` }}
                          >
                            <Folder className="h-4 w-4 text-primary shrink-0" />
                            <span
                              onClick={() => handleDrillDown(cat)}
                              className="font-bold text-foreground hover:text-primary cursor-pointer"
                            >
                              {cat.name}
                            </span>
                            <span className="text-xs text-muted-foreground hidden lg:inline">
                              ({cat.fullPath})
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">{getLevelBadge(cat.level)}</td>
                        <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                          {cat.code || "—"}
                        </td>
                        <td className="py-3 px-4 font-semibold text-xs">
                          {childCount}
                        </td>
                        <td className="py-3 px-4 font-semibold text-xs">
                          {itemCount}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleDrillDown(cat)}
                              className="p-1.5 rounded-lg border border-border hover:bg-secondary text-xs text-muted-foreground hover:text-foreground"
                              title="Open folder"
                            >
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                            {cat.level < 4 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCategoryToEdit(null);
                                  setModalParentCategory(cat);
                                  setIsCategoryModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/10"
                                title="Add subcategory"
                              >
                                <FolderPlus className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setItemToEdit(null);
                                setItemTargetCategory(cat);
                                setIsItemModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg border border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                              title="Add item"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCategoryToEdit(cat);
                                setModalParentCategory(null);
                                setIsCategoryModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-blue-600"
                              title="Edit"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteCatTarget(cat)}
                              className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ═══════════════════════════════════════════════════════════════ */
        /* VIEW MODE 3: FOLDER CARDS VIEW (Drill-Down for Current Level)  */
        /* ═══════════════════════════════════════════════════════════════ */
        <div className="space-y-8">
          {/* Subcategories Section (Hidden at Level 4) */}
          {canAddSubcategory && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Folder className="h-5 w-5 text-primary" />
                  <h3 className="font-display text-base font-bold text-foreground">
                    {currentLevel === 0
                      ? "Categories (Level 1 Root)"
                      : `Subcategories in "${currentCategory.name}" (Level ${currentLevel + 1})`}
                  </h3>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-semibold">
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
                      ? "No root categories defined yet. Click '+ Add Root Category' above."
                      : `No subcategories created under "${currentCategory.name}" yet.`}
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
                              type="button"
                              onClick={() => {
                                setCategoryToEdit(cat);
                                setModalParentCategory(null);
                                setIsCategoryModalOpen(true);
                              }}
                              className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-blue-600 transition-colors cursor-pointer"
                              title="Edit Category"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteCatTarget(cat)}
                              className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                              title="Delete Category"
                            >
                              <Trash2 className="h-4 w-4" />
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

          {/* Items Section at Current Level */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-[#1e3a5f]" />
                <h3 className="font-display text-base font-bold text-foreground">
                  {currentCategory
                    ? `Items in "${currentCategory.name}"`
                    : "Direct Inventory Items (Root Level)"}
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-semibold">
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
            ) : (
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
                        {/* Photo Thumbnail */}
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

                          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-background/90 backdrop-blur-xs border border-border text-[11px] font-bold text-foreground shadow-xs">
                            {item.quantity} {item.unit || "Nos"}
                          </span>
                        </div>

                        {/* Title & Code */}
                        <h4 className="font-display text-sm font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                          {item.name}
                        </h4>
                        {(item.code || item.sku) && (
                          <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                            {item.code || item.sku}
                          </p>
                        )}

                        {/* 5 Specifications Table Preview */}
                        {specsArr.length > 0 && (
                          <div className="mt-3 border border-border/60 rounded-lg overflow-hidden bg-secondary/20">
                            <div className="divide-y divide-border/40 text-[11px]">
                              {specsArr.slice(0, 5).map((sp, sIdx) => (
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
                        <span>
                          Updated: {fmtDate(item.updatedAt || item.createdAt)}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setItemToEdit(item);
                              setItemTargetCategory(currentCategory);
                              setIsItemModalOpen(true);
                            }}
                            className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-blue-600 transition-colors cursor-pointer"
                            title="Edit Item"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteItemTarget(item)}
                            className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                            title="Delete Item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Modals ───────────────────────────────────────────────── */}
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          setModalParentCategory(null);
        }}
        parentCategory={modalParentCategory || currentCategory}
        categoryToEdit={categoryToEdit}
        onSuccess={loadData}
      />

      <ItemCardModal
        isOpen={isItemModalOpen}
        onClose={() => {
          setIsItemModalOpen(false);
          setItemTargetCategory(null);
        }}
        item={itemToEdit}
        categoryId={itemTargetCategory?.id || currentCategory?.id || null}
        categoryName={
          itemTargetCategory
            ? itemTargetCategory.name
            : currentCategory
            ? navPath.map((c) => c.name).join(" > ")
            : "Root Level"
        }
        onSuccess={loadData}
      />

      {/* Delete Category Modal */}
      {deleteCatTarget && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteCatTarget(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-card border border-border p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-foreground">
                Delete Category
              </h3>
              <button
                type="button"
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
                type="button"
                onClick={() => setDeleteCatTarget(null)}
                className="px-4 py-2 text-sm font-semibold rounded-xl border border-border hover:bg-secondary cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
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
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteItemTarget(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-card border border-border p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-foreground">
                Delete Item
              </h3>
              <button
                type="button"
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
                type="button"
                onClick={() => setDeleteItemTarget(null)}
                className="px-4 py-2 text-sm font-semibold rounded-xl border border-border hover:bg-secondary cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
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

