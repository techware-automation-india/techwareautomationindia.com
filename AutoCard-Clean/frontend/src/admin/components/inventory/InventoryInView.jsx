import { useState, useEffect, useMemo } from "react";
import {
  Folder, FolderPlus, FolderTree, Package, Plus, Search, ChevronRight,
  ChevronDown, ArrowLeft, Edit3, Trash2, Loader2, Layers, AlertCircle,
  FileText, LayoutGrid, List, RefreshCw, X, Box, Sparkles, PackagePlus, Clock, Tag, Boxes, Eye,
  User, Users, ShieldCheck
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiDelete } from "../../../lib/api.js";
import { getAuthUser } from "../../../lib/auth.js";
import { canPerformAction } from "../../../lib/permissions.js";
import CategoryModal from "./CategoryModal.jsx";
import ItemCardModal from "./ItemCardModal.jsx";
import CategoryProductsModal from "./CategoryProductsModal.jsx";
import ProductQuickViewModal from "./ProductQuickViewModal.jsx";

const resolveImageUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:4001";
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
  // Deduplicate categories by ID
  const uniqueList = Array.from(
    new Map(categoriesList.filter(c => c && c.id).map((cat) => [cat.id, cat])).values()
  );
  const map = new Map();
  const roots = [];

  // Pass 1: Clone and map all categories
  uniqueList.forEach((cat) => {
    map.set(cat.id, { ...cat, children: [] });
  });

  // Pass 2: Connect children to parents
  uniqueList.forEach((cat) => {
    const node = map.get(cat.id);
    if (cat.parentId && map.has(cat.parentId) && cat.parentId !== cat.id) {
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
  onViewProducts,
  onAddSubcategory,
  onAddItem,
  onEdit,
  onDelete,
  searchTerm,
  canCreate = true,
  canEdit = true,
  canDelete = true,
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
            {/* View Products */}
            <button
              type="button"
              onClick={() => onViewProducts && onViewProducts(cat)}
              className="p-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors cursor-pointer shadow-xs"
              title="View products in this category"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>

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
            {canCreate && level < 4 && (
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
            {canCreate && (
              <button
                type="button"
                onClick={() => onAddItem(cat)}
                className="p-1.5 rounded-lg border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer shadow-xs"
                title="Add item into this category"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Edit */}
            {canEdit && (
              <button
                type="button"
                onClick={() => onEdit(cat)}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-blue-600 transition-colors cursor-pointer"
                title="Edit category"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Delete */}
            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete(cat)}
                className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                title="Delete category"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Children branches (Indented with visual connector line) */}
      {hasChildren && isExpanded && (
        <div className="ml-5 pl-4 border-l-2 border-primary/20 space-y-2.5 mt-2.5">
          {cat.children.map((child, cIdx) => (
            <CategoryTreeNode
              key={child.id ? `${child.id}-${cIdx}` : cIdx}
              cat={child}
              level={level + 1}
              expandedMap={expandedMap}
              toggleExpand={toggleExpand}
              onDrillDown={onDrillDown}
              onViewProducts={onViewProducts}
              onAddSubcategory={onAddSubcategory}
              onAddItem={onAddItem}
              onEdit={onEdit}
              onDelete={onDelete}
              searchTerm={searchTerm}
              canCreate={canCreate}
              canEdit={canEdit}
              canDelete={canDelete}
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
const InventoryInView = ({ onBackToHub, assignedUsers: propAssignedUsers, currentUser: propCurrentUser }) => {
  // Navigation stack: array of category objects [rootCategory, sub2, sub3, sub4]
  const [navPath, setNavPath] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [allInwardItems, setAllInwardItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all"); // 'all' | '1' | '2' | '3' | '4'
  // Default to 'grid' (Cards) view so product cards, categories, and items are immediately visible!
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'tree' | 'table' | 'inward'
  const [expandedNodes, setExpandedNodes] = useState({});

  // Assigned personnel
  const [internalAssignedUsers, setInternalAssignedUsers] = useState(propAssignedUsers || []);
  const [internalCurrentUser, setInternalCurrentUser] = useState(propCurrentUser || null);

  useEffect(() => {
    if (propAssignedUsers && propAssignedUsers.length > 0) {
      setInternalAssignedUsers(propAssignedUsers);
    } else {
      apiGet("/inventory/assigned-users")
        .then((data) => setInternalAssignedUsers(data.inventoryInUsers || []))
        .catch(() => {});
    }

    if (propCurrentUser) {
      setInternalCurrentUser(propCurrentUser);
    } else {
      setInternalCurrentUser(getAuthUser());
    }
  }, [propAssignedUsers, propCurrentUser]);

  // Modals state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [modalParentCategory, setModalParentCategory] = useState(null);
  const [categoryToEdit, setCategoryToEdit] = useState(null);

  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemTargetCategory, setItemTargetCategory] = useState(null);
  const [itemToEdit, setItemToEdit] = useState(null);

  // View Category Products Modal
  const [viewingCategoryProducts, setViewingCategoryProducts] = useState(null);
  const [categoryProductsRefresh, setCategoryProductsRefresh] = useState(0);

  // Quick Product View Modal
  const [viewingProductQuickView, setViewingProductQuickView] = useState(null);

  // Delete confirmations
  const [deleteCatTarget, setDeleteCatTarget] = useState(null);
  const [deleteItemTarget, setDeleteItemTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Current category is the last item in navPath (or null if at root)
  const currentCategory = navPath.length > 0 ? navPath[navPath.length - 1] : null;
  const currentLevel = currentCategory ? (currentCategory.level || 1) : 0;
  const canAddSubcategory = currentLevel < 4;

  const canCreate = canPerformAction("inventory-in", "create");
  const canEdit = canPerformAction("inventory-in", "edit");
  const canDelete = canPerformAction("inventory-in", "delete");

  // Build recursive category tree from all categories
  const categoryTree = useMemo(() => buildCategoryTree(allCategories), [allCategories]);

  // Flattened tree for Table View with complete breadcrumb paths
  const flattenedCategories = useMemo(() => {
    const list = flattenTreeWithPath(categoryTree);
    return list.filter((cat) => {
      if (levelFilter !== "all" && String(cat.level) !== String(levelFilter)) {
        return false;
      }
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        (cat.name || "").toLowerCase().includes(q) ||
        (cat.fullPath || "").toLowerCase().includes(q) ||
        (cat.code && cat.code.toLowerCase().includes(q))
      );
    });
  }, [categoryTree, search, levelFilter]);

  const filteredInwardLogs = useMemo(() => {
    if (!search.trim()) return allInwardItems;
    const q = search.trim().toLowerCase();
    return allInwardItems.filter((i) => {
      const nameMatch = (i.name || "").toLowerCase().includes(q);
      const codeMatch = (i.code || i.sku || "").toLowerCase().includes(q);
      const catMatch = (i.categoryRef?.name || i.category || "").toLowerCase().includes(q);
      const locMatch = (i.location || i.warehouse || "").toLowerCase().includes(q);
      return nameMatch || codeMatch || catMatch || locMatch;
    });
  }, [allInwardItems, search]);

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
  const loadData = async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
    }
    try {
      // 1. Fetch all categories so tree and counts are always up-to-date
      const [catsRes, allItemsRes] = await Promise.all([
        apiGet("/inventory/categories"),
        apiGet("/inventory/items"),
      ]);
      const rawCats = catsRes?.categories || [];
      const cats = Array.from(new Map(rawCats.filter((c) => c && c.id).map((c) => [c.id, c])).values());
      setAllCategories(cats);

      const rawAllItems = allItemsRes?.items || [];
      const uniqueAllItems = Array.from(new Map(rawAllItems.filter((i) => i && i.id).map((i) => [i.id, i])).values());
      setAllInwardItems(uniqueAllItems);

      // 2. Filter categories for CURRENT level in Folder Cards View
      if (!currentCategory) {
        // At Root level: only show Level 1 root categories
        const roots = cats.filter((c) => !c.parentId || c.level === 1);
        setCategories(roots);

        // Load root-level direct items
        const itemsRes = await apiGet("/inventory/items?rootOnly=true");
        const rawItems = itemsRes?.items || [];
        const uniqueItems = Array.from(new Map(rawItems.filter((i) => i && i.id).map((i) => [i.id, i])).values());
        setItems(uniqueItems);
      } else {
        // Inside a category: only show direct children of currentCategory
        const directChildren = cats.filter((c) => c.parentId === currentCategory.id);
        setCategories(directChildren);

        // Load direct items in this category
        const itemsRes = await apiGet(`/inventory/items?categoryId=${currentCategory.id}`);
        const rawItems = itemsRes?.items || [];
        const uniqueItems = Array.from(new Map(rawItems.filter((i) => i && i.id).map((i) => [i.id, i])).values());
        setItems(uniqueItems);
      }
      setCategoryProductsRefresh((prev) => prev + 1);
    } catch (err) {
      if (!isBackground) {
        toast.error(err.message || "Failed to load inventory data.");
      }
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadData(false);

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadData(true);
      }
    }, 10000);

    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        loadData(true);
      }
    };
    window.addEventListener("visibilitychange", handleFocus);
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("visibilitychange", handleFocus);
      window.removeEventListener("focus", handleFocus);
    };
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

  // Filter categories by search and Level (1, 2, 3, 4, or all)
  // When search or levelFilter is active, search across allCategories so users can find subcategories at Level 2, 3, 4 even from root view!
  const sourceCategories = (search.trim() || levelFilter !== "all") ? allCategories : categories;

  const filteredCategories = sourceCategories.filter((cat) => {
    const catLevel = cat.level || 1;
    if (levelFilter !== "all" && String(catLevel) !== String(levelFilter)) {
      return false;
    }
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      (cat.name || "").toLowerCase().includes(q) ||
      (cat.code && cat.code.toLowerCase().includes(q)) ||
      (cat.description && cat.description.toLowerCase().includes(q))
    );
  });

  // Filter items by search and Level (1, 2, 3, 4, or all)
  // When at root level OR when searching/level filtering, search across all inward items across all categories & levels
  const sourceItems = (!currentCategory || search.trim() || levelFilter !== "all") ? allInwardItems : items;

  const filteredItems = sourceItems.filter((i) => {
    // Level filtering for items (checks item's category level or direct root item level 1)
    const itemLevel = i.categoryRef?.level ? String(i.categoryRef.level) : "1";
    if (levelFilter !== "all" && itemLevel !== String(levelFilter)) {
      return false;
    }

    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    const nameMatch = (i.name || "").toLowerCase().includes(q);
    const codeMatch =
      ((i.code || "") && (i.code || "").toLowerCase().includes(q)) ||
      ((i.sku || "") && (i.sku || "").toLowerCase().includes(q));
    const compMatch = (i.companyName || "").toLowerCase().includes(q);
    const vendMatch = (i.vendorName || "").toLowerCase().includes(q);
    const locMatch =
      ((i.location || "") && (i.location || "").toLowerCase().includes(q)) ||
      ((i.warehouse || "") && (i.warehouse || "").toLowerCase().includes(q));
    const unitMatch = (i.unit || "").toLowerCase().includes(q);
    const createdByMatch = (i.createdByName || "").toLowerCase().includes(q);

    // Check all ancestor category names in the hierarchy chain (L1 -> L2 -> L3 -> L4)
    let catChainMatch = false;
    let currCat = i.categoryRef;
    while (currCat) {
      if (
        (currCat.name && currCat.name.toLowerCase().includes(q)) ||
        (currCat.code && currCat.code.toLowerCase().includes(q))
      ) {
        catChainMatch = true;
        break;
      }
      currCat = currCat.parent;
    }

    let specMatch = false;
    if (Array.isArray(i.specifications)) {
      specMatch = i.specifications.some(
        (s) =>
          (s?.key && s.key.toLowerCase().includes(q)) ||
          (s?.value && String(s.value).toLowerCase().includes(q))
      );
    } else if (i.specifications && typeof i.specifications === "object") {
      specMatch = Object.entries(i.specifications).some(
        ([k, v]) =>
          k.toLowerCase().includes(q) || String(v).toLowerCase().includes(q)
      );
    }

    return (
      nameMatch ||
      codeMatch ||
      compMatch ||
      vendMatch ||
      locMatch ||
      unitMatch ||
      createdByMatch ||
      catChainMatch ||
      specMatch
    );
  });

  return (
    <div className="space-y-6">
      {/* ─── Assigned Access Personnel & Active Operator Bar ─── */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/70 dark:border-blue-900/40 rounded-2xl p-3 px-4 text-xs card-shadow">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 font-bold text-foreground">
            <ShieldCheck className="h-4 w-4 text-blue-600" />
            <span>Assigned Module Access (Inventory In):</span>
          </div>
          {internalAssignedUsers.length > 0 ? (
            internalAssignedUsers.map((u) => (
              <span
                key={u.id}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 font-semibold text-xs border border-blue-300 dark:border-blue-800"
              >
                <User className="h-3 w-3" />
                {u.fullName} {u.role === "ADMIN" ? "(Admin)" : ""}
              </span>
            ))
          ) : (
            <span className="text-muted-foreground italic">Admin Only</span>
          )}
        </div>
        {internalCurrentUser && (
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span>Operator:</span>
            <strong className="text-foreground">{internalCurrentUser.fullName}</strong>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary uppercase font-semibold text-muted-foreground">
              {internalCurrentUser.role}
            </span>
          </div>
        )}
      </div>

      {/* ─── Breadcrumb Navigation & Action Buttons ────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 bg-background border border-border rounded-2xl p-3.5 sm:p-4 card-shadow">
        <div className="flex items-center gap-2 flex-wrap text-sm min-w-0 flex-1">
          {navPath.length === 0 && onBackToHub && (
            <button
              type="button"
              onClick={onBackToHub}
              className="mr-1 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border hover:bg-secondary text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
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
              className="mr-1 p-1.5 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
              title="Go Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => handleBreadcrumbClick(-1)}
            className={`font-semibold cursor-pointer hover:text-primary transition-colors truncate ${
              navPath.length === 0 ? "text-primary" : "text-muted-foreground"
            }`}
          >
            Inventory In
          </button>

          {navPath.map((crumb, idx) => {
            const isLast = idx === navPath.length - 1;
            return (
              <div key={crumb.id ? `crumb-${crumb.id}-${idx}` : `crumb-${idx}`} className="flex items-center gap-1.5 max-w-full">
                <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                <button
                  type="button"
                  onClick={() => handleBreadcrumbClick(idx)}
                  className={`font-semibold cursor-pointer transition-colors truncate max-w-[140px] sm:max-w-[200px] ${
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
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
          <button
            type="button"
            onClick={loadData}
            className="p-2 sm:p-2.5 rounded-xl border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
            title="Refresh View"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          {/* Add Category / Subcategory button */}
          {canCreate && (
            canAddSubcategory ? (
              <button
                type="button"
                onClick={() => {
                  setCategoryToEdit(null);
                  setModalParentCategory(currentCategory);
                  setIsCategoryModalOpen(true);
                }}
                className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer shadow-xs whitespace-nowrap"
              >
                <FolderPlus className="h-4 w-4 shrink-0" />
                <span>{currentLevel === 0 ? "Add Root Category" : `Add Subcategory (L${currentLevel + 1})`}</span>
              </button>
            ) : (
              <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 shrink-0">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>Max Level 4 Reached</span>
              </div>
            )
          )}

          {/* Add Item button */}
          {canCreate && (
            <button
              type="button"
              onClick={() => {
                setItemToEdit(null);
                setItemTargetCategory(currentCategory);
                setIsItemModalOpen(true);
              }}
              className="bg-[#1e3a5f] hover:bg-[#162b45] text-white text-xs sm:text-sm font-semibold px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="h-4 w-4 shrink-0" /> <span>Add Item</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── Search & View Switcher ───────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-background border border-border rounded-2xl p-3 sm:p-4 card-shadow">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:max-w-2xl flex-1">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search product, SKU, specs, category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 pl-9 pr-8 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
                title="Clear Search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Level 1, 2, 3, 4 Filter Buttons */}
          <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-xl border border-border overflow-x-auto shrink-0 scrollbar-none">
            <button
              type="button"
              onClick={() => setLevelFilter("all")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                levelFilter === "all"
                  ? "bg-background text-foreground shadow-xs border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Levels
            </button>
            <button
              type="button"
              onClick={() => setLevelFilter("1")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                levelFilter === "1"
                  ? "bg-blue-500 text-white shadow-xs"
                  : "text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-300 inline-block" />
              L1 Root
            </button>
            <button
              type="button"
              onClick={() => setLevelFilter("2")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                levelFilter === "2"
                  ? "bg-indigo-500 text-white shadow-xs"
                : "text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 inline-block" />
              L2 Sub
            </button>
            <button
              type="button"
              onClick={() => setLevelFilter("3")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                levelFilter === "3"
                  ? "bg-amber-500 text-white shadow-xs"
                  : "text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300 inline-block" />
              L3 Sub
            </button>
            <button
              type="button"
              onClick={() => setLevelFilter("4")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                levelFilter === "4"
                  ? "bg-rose-500 text-white shadow-xs"
                  : "text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-300 inline-block" />
              L4 Final
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between sm:justify-end w-full md:w-auto">
          {viewMode === "tree" && (
            <div className="flex items-center gap-1.5 text-xs shrink-0">
              <button
                type="button"
                onClick={expandAll}
                className="px-2.5 py-1 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-xs"
              >
                Expand All
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="px-2.5 py-1 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-xs"
              >
                Collapse All
              </button>
            </div>
          )}

          {/* View Mode Switcher: Tree View vs Folder Cards vs Table List */}
          <div className="border border-border rounded-xl p-1 flex items-center bg-secondary/40 gap-1 overflow-x-auto max-w-full scrollbar-none">
            <button
              type="button"
              onClick={() => setViewMode("tree")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
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
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                viewMode === "grid"
                  ? "bg-background text-primary shadow-xs font-bold ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Folder Cards (Drill-Down)"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Cards</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                viewMode === "table"
                  ? "bg-background text-primary shadow-xs font-bold ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Hierarchical Table View"
            >
              <List className="h-3.5 w-3.5" />
              <span>Table</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode("inward")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                viewMode === "inward"
                  ? "bg-background text-blue-600 shadow-xs font-bold ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Inventory Inward Logs (Product In Entries)"
            >
              <PackagePlus className="h-3.5 w-3.5 text-blue-600" />
              <span>In Logs</span>
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
      ) : viewMode === "inward" ? (
        /* ═══════════════════════════════════════════════════════════════ */
        /* VIEW MODE 4: INVENTORY IN LOGS (All Product Inward Entries)    */
        /* ═══════════════════════════════════════════════════════════════ */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PackagePlus className="h-5 w-5 text-blue-600" />
              <h3 className="font-display text-base font-bold text-foreground">
                Inventory Inward Register (All Inward Product Logs)
              </h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-bold">
                {filteredInwardLogs.length} Records
              </span>
            </div>
          </div>

          {/* Summary Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl border border-border bg-background card-shadow flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                <PackagePlus className="h-6 w-6" />
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
                  Total Inward Products
                </span>
                <span className="text-2xl font-bold text-foreground">{allInwardItems.length}</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-border bg-background card-shadow flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
                <Boxes className="h-6 w-6" />
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
                  Total Inward Stock Quantity
                </span>
                <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {allInwardItems.reduce((acc, i) => acc + (i.quantity || 0), 0)}
                </span>
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-border bg-background card-shadow flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                <Tag className="h-6 w-6" />
              </div>
              <div>
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
                  Inward Stock Valuation
                </span>
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  ₹{allInwardItems.reduce((acc, i) => acc + ((i.quantity || 0) * (i.costPrice || 0)), 0).toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>

          {/* Inward Logs Register Table */}
          <div className="rounded-2xl border border-border bg-background card-shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-secondary/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="p-4">Entry Date & Time</th>
                    <th className="p-4">Product Name & Photo</th>
                    <th className="p-4">Product Code / SKU</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Created By</th>
                    <th className="p-4">Quantity In Stock</th>
                    <th className="p-4">Cost Price / Unit</th>
                    <th className="p-4">Location / Warehouse</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {filteredInwardLogs.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="p-8 text-center text-muted-foreground">
                        No inward inventory product records found.
                      </td>
                    </tr>
                  ) : (
                    filteredInwardLogs.map((item) => (
                      <tr key={item.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="p-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5 font-medium">
                            <Clock className="h-3.5 w-3.5 text-blue-500" />
                            <span>{fmtDate(item.createdAt || item.purchaseDate)}</span>
                          </div>
                        </td>
                        <td className="p-4 font-semibold text-foreground">
                          <div className="flex items-center gap-3">
                            {item.photoUrl ? (
                              <img
                                src={resolveImageUrl(item.photoUrl)}
                                alt={item.name}
                                className="w-9 h-9 rounded-lg object-cover border border-border shadow-xs shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0 font-bold border border-blue-500/20">
                                <Package className="h-4 w-4" />
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-foreground">{item.name}</div>
                              {item.companyName && (
                                <div className="text-xs font-normal text-muted-foreground">
                                  Company: <span className="font-medium text-foreground/80">{item.companyName}</span>
                                </div>
                              )}
                              {item.vendorName && (
                                <div className="text-xs font-normal text-muted-foreground">
                                  Vendor: <span className="font-medium text-foreground/80">{item.vendorName}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          {item.code || item.sku ? (
                            <span className="font-mono text-xs px-2 py-0.5 rounded bg-secondary border border-border/60 text-foreground font-semibold">
                              {item.code || item.sku}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="p-4 text-xs font-medium text-muted-foreground">
                          {item.categoryRef ? (
                            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 font-semibold">
                              {item.categoryRef.name}
                            </span>
                          ) : item.category ? (
                            <span>{item.category}</span>
                          ) : (
                            <span>Root Item</span>
                          )}
                        </td>
                        <td className="p-4 text-xs font-semibold">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                            {item.createdByName || "Admin"}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                            {item.quantity} {item.unit || "Nos"}
                          </span>
                        </td>
                        <td className="p-4 font-semibold text-foreground">
                          {item.costPrice != null ? `₹${Number(item.costPrice).toLocaleString("en-IN")}` : "—"}
                        </td>
                        <td className="p-4 text-xs text-muted-foreground">
                          {item.warehouse || item.location ? (
                            <span>{item.warehouse || item.location}</span>
                          ) : (
                            <span>—</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => {
                                  setItemToEdit(item);
                                  setItemTargetCategory(item.categoryRef || null);
                                  setIsItemModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-blue-600 transition-colors"
                                title="Edit Item Specs / Stock"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => setDeleteItemTarget(item)}
                                className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                title="Delete Item"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
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
              {categoryTree.map((rootNode, rIdx) => (
                <CategoryTreeNode
                  key={rootNode.id ? `${rootNode.id}-${rIdx}` : rIdx}
                  cat={rootNode}
                  level={1}
                  expandedMap={expandedNodes}
                  toggleExpand={toggleExpand}
                  onDrillDown={handleDrillDown}
                  onViewProducts={(cat) => setViewingCategoryProducts(cat)}
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
                  canCreate={canCreate}
                  canEdit={canEdit}
                  canDelete={canDelete}
                />
              ))}
            </div>
          )}

          {/* Search / Filter Results inside Tree View */}
          {(search.trim() || levelFilter !== "all") && (
            <div className="mt-6 pt-6 border-t border-border space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-[#1e3a5f]" />
                  <h4 className="font-display text-sm font-bold text-foreground">
                    Matching Products across Levels ({filteredItems.length})
                  </h4>
                  {levelFilter !== "all" && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                      Level {levelFilter} Filter
                    </span>
                  )}
                </div>
                {search.trim() && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="text-xs text-muted-foreground hover:text-foreground font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <X className="h-3 w-3" /> Clear Search
                  </button>
                )}
              </div>

              {filteredItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-secondary/10 p-6 text-center text-muted-foreground text-xs">
                  No products matched "{search}".
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                  {filteredItems.slice(0, 12).map((item, idx) => (
                    <div
                      key={item.id ? `tree-item-${item.id}` : idx}
                      className="rounded-xl border border-border bg-background p-3.5 card-shadow flex flex-col justify-between hover:border-primary/50 transition-all text-xs"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="w-12 h-12 rounded-lg bg-secondary/40 border border-border shrink-0 overflow-hidden flex items-center justify-center">
                          {item.photoUrl ? (
                            <img
                              src={resolveImageUrl(item.photoUrl)}
                              alt={item.name}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <Package className="h-5 w-5 text-muted-foreground/50" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h5 className="font-bold text-foreground truncate">{item.name}</h5>
                          {(item.code || item.sku) && (
                            <span className="font-mono text-[10px] text-muted-foreground block truncate">
                              {item.code || item.sku}
                            </span>
                          )}
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              ₹{Number(item.costPrice || 0).toLocaleString("en-IN")}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-secondary text-muted-foreground">
                              Qty: {item.quantity} {item.unit || "Nos"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground truncate max-w-[130px]">
                          {item.categoryRef?.name ? `L${item.categoryRef.level || 1}: ${item.categoryRef.name}` : "Root Item"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setViewingProductQuickView(item)}
                          className="p-1 rounded-md border border-primary/30 text-primary hover:bg-primary/10 transition-colors cursor-pointer shrink-0"
                          title="Quick View Details"
                        >
                          <Eye className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                  flattenedCategories.map((cat, idx) => {
                    const childCount = cat.children?.length ?? cat._count?.children ?? 0;
                    const itemCount = cat._count?.items ?? cat.items?.length ?? 0;
                    return (
                      <tr key={cat.id ? `${cat.id}-${idx}` : idx} className="hover:bg-secondary/20 transition-colors">
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
                              onClick={() => setViewingCategoryProducts(cat)}
                              className="p-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                              title="View products in this category"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDrillDown(cat)}
                              className="p-1.5 rounded-lg border border-border hover:bg-secondary text-xs text-muted-foreground hover:text-foreground"
                              title="Open folder"
                            >
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                            {canCreate && cat.level < 4 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCategoryToEdit(null);
                                  setModalParentCategory(cat);
                                  setIsCategoryModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 cursor-pointer"
                                title="Add subcategory"
                              >
                                <FolderPlus className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {canCreate && (
                              <button
                                type="button"
                                onClick={() => {
                                  setItemToEdit(null);
                                  setItemTargetCategory(cat);
                                  setIsItemModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg border border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 cursor-pointer"
                                title="Add item"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCategoryToEdit(cat);
                                  setModalParentCategory(null);
                                  setIsCategoryModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-blue-600 cursor-pointer"
                                title="Edit"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => setDeleteCatTarget(cat)}
                                className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
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
          {/* Active Search & Filter Indicator Banner */}
          {(search.trim() || levelFilter !== "all") && (
            <div className="flex items-center justify-between p-3.5 px-4 rounded-2xl bg-primary/5 border border-primary/20 text-xs text-primary font-medium">
              <div className="flex items-center gap-2 flex-wrap">
                <Search className="h-4 w-4 shrink-0" />
                <span>
                  Showing results across all 4 levels: <strong>{filteredItems.length} Products</strong> and <strong>{filteredCategories.length} Categories</strong>
                  {search.trim() ? ` matching "${search}"` : ""}
                  {levelFilter !== "all" ? ` (Level ${levelFilter})` : ""}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setLevelFilter("all");
                }}
                className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-bold transition-colors cursor-pointer flex items-center gap-1 shrink-0"
              >
                <X className="h-3.5 w-3.5" />
                <span>Reset Search</span>
              </button>
            </div>
          )}

          {/* Subcategories Section */}
          {(canAddSubcategory || search.trim() || levelFilter !== "all") && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Folder className="h-5 w-5 text-primary" />
                  <h3 className="font-display text-base font-bold text-foreground">
                    {search.trim()
                      ? `Categories matching "${search}"`
                      : levelFilter !== "all"
                      ? `Level ${levelFilter} Categories`
                      : currentLevel === 0
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
                  {filteredCategories.map((cat, idx) => {
                    const childCount = cat._count?.children ?? cat.children?.length ?? 0;
                    const itemCount = cat._count?.items ?? cat.items?.length ?? 0;
                    const catLevel = cat.level || currentLevel + 1;

                    return (
                      <div
                        key={cat.id ? `${cat.id}-${idx}` : idx}
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
                              onClick={() => setViewingCategoryProducts(cat)}
                              className="p-1 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                              title="View Products in Category"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {canEdit && (
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
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => setDeleteCatTarget(cat)}
                                className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                                title="Delete Category"
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
                    : search.trim()
                    ? `Search Results for "${search}"`
                    : levelFilter !== "all"
                    ? `Inventory Items in Level ${levelFilter}`
                    : "Direct Inventory Items (Root Level)"}
                </h3>
                {levelFilter !== "all" && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                    Level {levelFilter} Filter Active
                  </span>
                )}
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
                {filteredItems.map((item, idx) => {
                  const specsArr = Array.isArray(item.specifications)
                    ? item.specifications
                    : item.specifications && typeof item.specifications === "object"
                    ? Object.entries(item.specifications).map(([k, v]) => ({ key: k, value: v }))
                    : [];

                  return (
                    <div
                      key={item.id ? `${item.id}-${idx}` : idx}
                      className="rounded-2xl border border-border bg-background p-4 card-shadow flex flex-col justify-between hover:border-[#1e3a5f]/50 transition-all group"
                    >
                      <div>
                        {/* Photo Thumbnail */}
                        <div className="w-full h-36 rounded-xl bg-secondary/40 border border-border/60 overflow-hidden flex items-center justify-center mb-3 relative">
                          {(item.photoUrl || item.img) ? (
                            <img
                              src={resolveImageUrl(item.photoUrl || item.img)}
                              alt={item.name}
                              className="w-full h-full object-contain p-2"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                                if (e.currentTarget.nextSibling) {
                                  e.currentTarget.nextSibling.style.display = "flex";
                                }
                              }}
                            />
                          ) : null}
                          <div
                            className={`flex flex-col items-center text-muted-foreground/60 ${
                              item.photoUrl || item.img ? "hidden" : "flex"
                            }`}
                          >
                            <Package className="h-10 w-10 stroke-[1.2]" />
                            <span className="text-[11px] mt-1 font-mono">No Image</span>
                          </div>

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

                        {/* Price per Item & Total Valuation */}
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

                        {/* Created By Print Name */}
                        <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground flex-wrap">
                          <span className="font-semibold text-foreground/80">Created by:</span>
                          <span className="inline-flex items-center gap-1 font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 text-[10px]">
                            {item.createdByName || "Admin"}
                          </span>
                          {item.companyName && (
                            <span className="inline-flex items-center gap-1 font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20 text-[10px]">
                              🏢 {item.companyName}
                            </span>
                          )}
                          {item.vendorName && (
                            <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 text-[10px]">
                              👤 {item.vendorName}
                            </span>
                          )}
                        </div>

                        {/* Hierarchy Path Badge (Root -> Level 1 -> Level 2 -> Level 3 -> Level 4) */}
                        {(() => {
                          const chain = [];
                          let parent = item.categoryRef;
                          while (parent) {
                            chain.unshift({ id: parent.id, name: parent.name, level: parent.level || 1 });
                            parent = parent.parent;
                          }
                          if (chain.length > 0) {
                            return (
                              <div className="mt-2.5 p-2 rounded-xl bg-secondary/35 border border-border/70 text-[10px]">
                                <div className="flex items-center gap-1 text-muted-foreground font-semibold mb-1">
                                  <Layers className="h-3 w-3 text-primary shrink-0" />
                                  <span>Hierarchy Classification:</span>
                                </div>
                                <div className="flex items-center gap-1 flex-wrap">
                                  {chain.map((c, cIdx) => (
                                    <div key={c.id || cIdx} className="flex items-center gap-1">
                                      {cIdx > 0 && <span className="text-muted-foreground font-bold">›</span>}
                                      <span
                                        className={`px-1.5 py-0.5 rounded font-medium border text-[10px] ${
                                          c.level === 1
                                            ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
                                            : c.level === 2
                                            ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20"
                                            : c.level === 3
                                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                                            : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20"
                                        }`}
                                      >
                                        L{c.level}: {c.name}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div className="mt-2 text-[10px] text-muted-foreground italic flex items-center gap-1">
                              <Layers className="h-3 w-3 text-muted-foreground/60" />
                              <span>Direct Root Level Item</span>
                            </div>
                          );
                        })()}

                        {/* Specifications Preview (No Limit) */}
                        {specsArr.length > 0 && (
                          <div className="mt-3 border border-border/60 rounded-xl overflow-hidden bg-secondary/20 max-h-36 overflow-y-auto">
                            <div className="divide-y divide-border/40 text-[11px]">
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
                        <span>
                          Updated: {fmtDate(item.updatedAt || item.createdAt)}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setViewingProductQuickView(item)}
                            className="p-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                            title="Quick View Details & Hierarchy"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => {
                                setItemToEdit(item);
                                setItemTargetCategory(currentCategory);
                                setIsItemModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-blue-600 transition-colors cursor-pointer"
                              title="Edit Item"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setDeleteItemTarget(item)}
                              className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                              title="Delete Item"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
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
      {/* View Category Products Modal (Background Viewer Modal) */}
      <CategoryProductsModal
        isOpen={Boolean(viewingCategoryProducts)}
        onClose={() => setViewingCategoryProducts(null)}
        category={viewingCategoryProducts}
        allCategories={allCategories}
        onDrillDown={(cat) => {
          handleDrillDown(cat);
        }}
        onAddItem={canCreate ? (cat) => {
          setItemToEdit(null);
          setItemTargetCategory(cat);
          setIsItemModalOpen(true);
        } : null}
        onEditItem={canEdit ? (item, cat) => {
          setItemToEdit(item);
          setItemTargetCategory(cat);
          setIsItemModalOpen(true);
        } : null}
        onDeleteItem={canDelete ? (item) => {
          setDeleteItemTarget(item);
        } : null}
        refreshTrigger={categoryProductsRefresh}
      />

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
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
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

      {/* Delete Item Modal with Level 1 to Level 4 Category Hierarchy & Next Items */}
      {deleteItemTarget && (() => {
        // Build Level 1 to Level 4 hierarchy breadcrumb path for this item
        const itemCatId = deleteItemTarget.categoryId || deleteItemTarget.categoryRef?.id;
        const categoryMap = new Map(allCategories.map((c) => [c.id, c]));
        const hierarchyChain = [];
        let curr = itemCatId ? categoryMap.get(itemCatId) : null;
        while (curr) {
          hierarchyChain.unshift(curr);
          curr = curr.parentId ? categoryMap.get(curr.parentId) : null;
        }

        // Sibling items in the same category or root
        const siblingItems = allInwardItems.filter(
          (i) => i.id !== deleteItemTarget.id && (i.categoryId || null) === (itemCatId || null)
        );

        return (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setDeleteItemTarget(null);
            }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-3xl bg-card border border-border p-5 sm:p-6 space-y-4 shadow-2xl my-auto animate-in fade-in zoom-in-95 duration-150"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/70 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/20">
                    <Trash2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold text-foreground">
                      Confirm Delete Item
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Permanent deletion warning & hierarchy impact
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteItemTarget(null)}
                  className="rounded-xl p-1.5 text-muted-foreground hover:bg-secondary cursor-pointer"
                  title="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Item Card Details */}
              <div className="bg-secondary/30 rounded-2xl p-3.5 border border-border/70 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Target Item:</span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-background border border-border text-foreground font-bold">
                    {deleteItemTarget.code || deleteItemTarget.sku}
                  </span>
                </div>
                <p className="text-sm font-bold text-foreground">
                  {deleteItemTarget.name}
                </p>
                {(deleteItemTarget.companyName || deleteItemTarget.vendorName) && (
                  <div className="flex items-center gap-2 flex-wrap text-[11px] pt-1">
                    {deleteItemTarget.companyName && (
                      <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium border border-indigo-500/20">
                        🏢 {deleteItemTarget.companyName}
                      </span>
                    )}
                    {deleteItemTarget.vendorName && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium border border-amber-500/20">
                        👤 {deleteItemTarget.vendorName}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Category Hierarchy (Level 1 to Level 4) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-primary" />
                    Category Hierarchy (Level 1 to Level 4):
                  </span>
                  <span className="text-[10px] text-muted-foreground font-semibold">
                    {hierarchyChain.length === 0 ? "Root Level" : `${hierarchyChain.length} Level(s)`}
                  </span>
                </div>

                <div className="bg-background rounded-xl border border-border/70 p-3 space-y-1.5 text-xs">
                  {hierarchyChain.length === 0 ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                      <span className="font-semibold text-foreground">Root Level (Direct Item)</span>
                      <span className="text-[10px] text-muted-foreground font-mono">(No parent category)</span>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {hierarchyChain.map((cat, idx) => {
                        const lvl = cat.level || idx + 1;
                        const colors = {
                          1: "text-blue-600 bg-blue-500/10 border-blue-500/20",
                          2: "text-indigo-600 bg-indigo-500/10 border-indigo-500/20",
                          3: "text-amber-600 bg-amber-500/10 border-amber-500/20",
                          4: "text-rose-600 bg-rose-500/10 border-rose-500/20",
                        };
                        return (
                          <div key={cat.id || idx} className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${colors[lvl] || colors[1]}`}>
                              Level {lvl}
                            </span>
                            <span className="font-semibold text-foreground">
                              {cat.name}
                            </span>
                            {cat.code && (
                              <span className="text-[10px] font-mono text-muted-foreground">
                                ({cat.code})
                              </span>
                            )}
                            {idx < hierarchyChain.length - 1 && (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Sibling Items in Hierarchy */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5 text-emerald-600" />
                    Other Items in this Category ({siblingItems.length}):
                  </span>
                </div>

                <div className="bg-secondary/20 rounded-xl border border-border/70 p-2.5 max-h-28 overflow-y-auto space-y-1 text-xs">
                  {siblingItems.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground italic py-1 text-center">
                      No other items found at this category level.
                    </p>
                  ) : (
                    siblingItems.slice(0, 8).map((sib, sIdx) => (
                      <div
                        key={sib.id || sIdx}
                        className="flex items-center justify-between px-2 py-1 rounded-lg bg-background border border-border/50 text-[11px]"
                      >
                        <span className="font-medium text-foreground truncate max-w-[240px]">
                          {sib.name}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                          {sib.code || sib.sku || `Qty: ${sib.quantity || 0}`}
                        </span>
                      </div>
                    ))
                  )}
                  {siblingItems.length > 8 && (
                    <p className="text-[10px] text-muted-foreground text-center pt-1 font-medium">
                      + {siblingItems.length - 8} more item(s) remain in this category
                    </p>
                  )}
                </div>
              </div>

              {/* Confirmation question */}
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-700 dark:text-rose-300 font-medium">
                Are you sure you want to permanently delete this item? This action cannot be undone.
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setDeleteItemTarget(null)}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-border hover:bg-secondary cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteItem}
                  disabled={deleting}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer transition-all shadow-md flex items-center gap-1.5"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Deleting...
                    </>
                  ) : (
                    "Yes, Delete Item"
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Product Quick View Modal */}
      <ProductQuickViewModal
        isOpen={Boolean(viewingProductQuickView)}
        onClose={() => setViewingProductQuickView(null)}
        item={viewingProductQuickView}
        onEdit={canEdit ? (item) => {
          setItemToEdit(item);
          setItemTargetCategory(item.categoryRef || currentCategory);
          setIsItemModalOpen(true);
        } : null}
      />
    </div>
  );
};

export default InventoryInView;

