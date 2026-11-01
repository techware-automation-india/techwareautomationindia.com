import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Folder,
  FolderTree,
  FolderInput,
  ArrowRightLeft,
  Search,
  X,
  ChevronRight,
  ChevronDown,
  Check,
  Package,
  Layers,
  AlertCircle,
  Loader2,
  Box,
  CornerDownRight,
} from "lucide-react";
import { toast } from "sonner";
import { apiPut } from "../../../lib/api.js";

// Helper: Build tree structure from flat category list
const buildTree = (list = []) => {
  if (!Array.isArray(list)) return [];
  const uniqueList = Array.from(
    new Map(list.filter((c) => c && c.id).map((c) => [c.id, c])).values()
  );
  const map = new Map();
  const roots = [];

  uniqueList.forEach((c) => {
    map.set(c.id, { ...c, children: [] });
  });

  uniqueList.forEach((c) => {
    const node = map.get(c.id);
    if (c.parentId && map.has(c.parentId) && c.parentId !== c.id) {
      map.get(c.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
};

// Helper: Compute depth/height of subtree for a category
const getSubtreeHeight = (catId, childrenMap) => {
  const children = childrenMap.get(catId) || [];
  if (children.length === 0) return 1;
  let maxChildHeight = 0;
  for (const childId of children) {
    maxChildHeight = Math.max(maxChildHeight, getSubtreeHeight(childId, childrenMap));
  }
  return 1 + maxChildHeight;
};

// Helper: Collect all descendant IDs of a category
const collectDescendants = (catId, childrenMap) => {
  let ids = [];
  const children = childrenMap.get(catId) || [];
  for (const childId of children) {
    ids.push(childId);
    ids = ids.concat(collectDescendants(childId, childrenMap));
  }
  return ids;
};

// Level Pill badge
const LevelPill = ({ level }) => {
  switch (level) {
    case 1:
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
          L1 Root
        </span>
      );
    case 2:
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
          L2 Sub
        </span>
      );
    case 3:
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          L3 Sub
        </span>
      );
    case 4:
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          L4 Final
        </span>
      );
    default:
      return null;
  }
};

const MoveHierarchyModal = ({
  isOpen,
  onClose,
  type = "item", // 'item' or 'category'
  target,
  allCategories = [],
  onSuccess,
}) => {
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [selectedDestinationId, setSelectedDestinationId] = useState(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState({});

  // Reset state on open
  useEffect(() => {
    if (!isOpen || !target) return;
    setSearch("");
    setLevelFilter("all");
    setSubmitting(false);

    // Initial destination selection: keep unselected until user picks
    setSelectedDestinationId(undefined);

    // Expand all root nodes by default
    const initExpanded = {};
    allCategories.forEach((c) => {
      initExpanded[c.id] = true;
    });
    setExpandedNodes(initExpanded);
  }, [isOpen, target, allCategories]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Build children lookup map
  const childrenMap = useMemo(() => {
    const map = new Map();
    allCategories.forEach((c) => {
      if (c.parentId) {
        if (!map.has(c.parentId)) map.set(c.parentId, []);
        map.get(c.parentId).push(c.id);
      }
    });
    return map;
  }, [allCategories]);

  // Build category tree
  const categoryTree = useMemo(() => buildTree(allCategories), [allCategories]);

  // Category map for quick lookup
  const categoryMap = useMemo(() => {
    return new Map(allCategories.map((c) => [c.id, c]));
  }, [allCategories]);

  // Compute descendants of the target category (if type === 'category')
  const descendantIds = useMemo(() => {
    if (type !== "category" || !target?.id) return new Set();
    return new Set(collectDescendants(target.id, childrenMap));
  }, [type, target, childrenMap]);

  // Compute height of target's subtree
  const targetSubtreeHeight = useMemo(() => {
    if (type !== "category" || !target?.id) return 1;
    return getSubtreeHeight(target.id, childrenMap);
  }, [type, target, childrenMap]);

  // Helper to build full path of any category
  const getCategoryPath = (catId) => {
    if (!catId) return "Root (Direct Level)";
    const parts = [];
    let curr = categoryMap.get(catId);
    let depth = 0;
    while (curr && depth < 6) {
      parts.unshift(curr.name);
      curr = curr.parentId ? categoryMap.get(curr.parentId) : null;
      depth++;
    }
    return parts.length > 0 ? parts.join(" > ") : "Root";
  };

  // Current location string
  const currentLocationPath = useMemo(() => {
    if (!target) return "";
    if (type === "item") {
      return getCategoryPath(target.categoryId);
    }
    // For category: show current parent path
    return target.parentId
      ? getCategoryPath(target.parentId)
      : "Root Level (Level 1 Root Category)";
  }, [type, target, categoryMap]);

  // Destination path string
  const destinationPath = useMemo(() => {
    if (selectedDestinationId === undefined) return null;
    if (selectedDestinationId === null) {
      return type === "item"
        ? "Root Level (Direct Item - No Category)"
        : "Root Level (Convert to Level 1 Root Category)";
    }
    return getCategoryPath(selectedDestinationId);
  }, [selectedDestinationId, type, categoryMap]);

  // Validation function: Check if a destination category is valid to move into
  const checkDestinationStatus = (cat) => {
    if (type === "item") {
      const isCurrent = target?.categoryId === cat.id;
      return {
        disabled: isCurrent,
        reason: isCurrent ? "Current Location" : null,
      };
    }

    // For Category:
    if (cat.id === target?.id) {
      return { disabled: true, reason: "Same Category" };
    }
    if (cat.id === target?.parentId) {
      return { disabled: true, reason: "Current Parent" };
    }
    if (descendantIds.has(cat.id)) {
      return { disabled: true, reason: "Subcategory of this category" };
    }

    // Depth check: newLevel = cat.level + 1. Deepest child level = newLevel + targetSubtreeHeight - 1
    const newDeepestLevel = cat.level + 1 + targetSubtreeHeight - 1;
    if (newDeepestLevel > 4) {
      return {
        disabled: true,
        reason: `Exceeds 4-level limit (would reach Level ${newDeepestLevel})`,
      };
    }

    return { disabled: false, reason: null };
  };

  const isRootOptionDisabled = useMemo(() => {
    if (type === "item") {
      return !target?.categoryId; // already at root
    }
    // For category: disabled if already root
    return !target?.parentId;
  }, [type, target]);

  const toggleExpand = (id) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Submit Move Action
  const handleConfirmMove = async () => {
    if (selectedDestinationId === undefined) {
      toast.error("Please select a destination from the hierarchy tree.");
      return;
    }

    setSubmitting(true);
    try {
      if (type === "item") {
        const res = await apiPut(`/inventory/items/${target.id}/move`, {
          targetCategoryId: selectedDestinationId,
        });
        toast.success(res?.message || `Item moved successfully!`);
        if (onSuccess) onSuccess(res?.item, res?.message);
      } else {
        const res = await apiPut(`/inventory/categories/${target.id}/move`, {
          targetParentId: selectedDestinationId,
        });
        toast.success(res?.message || `Category moved successfully!`);
        if (onSuccess) onSuccess(res?.category, res?.message);
      }
      onClose();
    } catch (err) {
      console.error("Move error:", err);
      toast.error(err?.message || "Failed to move location.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !target) return null;

  // Filter matching categories for quick list or tree
  const matchesSearch = (cat) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      cat.name?.toLowerCase().includes(term) ||
      cat.code?.toLowerCase().includes(term)
    );
  };

  // Recursive tree renderer for destination selector
  const renderTreeNode = (node, level = 1) => {
    const isExpanded = expandedNodes[node.id] ?? true;
    const hasChildren = node.children && node.children.length > 0;
    const { disabled, reason } = checkDestinationStatus(node);
    const isSelected = selectedDestinationId === node.id;
    const match = matchesSearch(node);

    // If search active and neither node nor children match, don't render
    const anyChildMatches = (n) => {
      if (matchesSearch(n)) return true;
      if (n.children && n.children.length > 0) {
        return n.children.some(anyChildMatches);
      }
      return false;
    };

    if (search.trim() && !anyChildMatches(node)) {
      return null;
    }

    if (levelFilter !== "all" && String(node.level) !== String(levelFilter)) {
      // Still show children if any match level filter
    }

    return (
      <div key={node.id} className="relative">
        <div
          onClick={() => {
            if (!disabled) {
              setSelectedDestinationId(node.id);
            }
          }}
          className={`flex items-center justify-between gap-2.5 p-2.5 rounded-xl border transition-all text-xs ${
            isSelected
              ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/20"
              : disabled
              ? "opacity-55 bg-secondary/20 border-border/50 cursor-not-allowed"
              : "bg-background border-border hover:border-primary/40 hover:bg-secondary/40 cursor-pointer"
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {/* Expand / Collapse */}
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(node.id);
                }}
                className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
            ) : (
              <span className="w-5 h-5 flex items-center justify-center text-muted-foreground/30 text-xs shrink-0">
                •
              </span>
            )}

            {/* Folder Icon */}
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                level === 1
                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  : level === 2
                  ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                  : level === 3
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
              }`}
            >
              <Folder className="h-3.5 w-3.5" />
            </div>

            {/* Name & Details */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`font-semibold truncate ${match && search.trim() ? "bg-amber-200/50 dark:bg-amber-900/40 px-1 rounded" : ""}`}>
                  {node.name}
                </span>
                {node.code && (
                  <span className="font-mono text-[10px] text-muted-foreground">
                    ({node.code})
                  </span>
                )}
                <LevelPill level={node.level || level} />
              </div>
            </div>
          </div>

          {/* Status or Radio Indicator */}
          <div className="flex items-center gap-2 shrink-0">
            {disabled && reason && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">
                {reason}
              </span>
            )}

            <div
              className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                isSelected
                  ? "border-primary bg-primary text-white"
                  : disabled
                  ? "border-border/40 bg-secondary/40"
                  : "border-border hover:border-primary"
              }`}
            >
              {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
            </div>
          </div>
        </div>

        {/* Nested Children */}
        {hasChildren && isExpanded && (
          <div className="ml-4 pl-3 border-l-2 border-primary/20 space-y-1.5 mt-1.5">
            {node.children.map((child) => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
      className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 overflow-y-auto"
      style={{ isolation: "isolate" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-card border border-border/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 relative my-8"
      >
        {/* ─── Modal Header ────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-b border-border bg-secondary/15 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-xs">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-foreground">
                {type === "item" ? "Swap / Move Item Location" : "Swap / Move Subcategory Location"}
              </h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <span>Relocate</span>
                <strong className="text-foreground font-semibold">{target.name}</strong>
                {target.code && (
                  <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-secondary border border-border">
                    {target.code}
                  </span>
                )}
                <span>in the hierarchy tree</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ─── Modal Body ──────────────────────────────────────────────── */}
        <div className="p-6 space-y-5 max-h-[72vh] overflow-y-auto">
          {/* Current Location Box */}
          <div className="rounded-xl border border-border/80 bg-secondary/30 p-3.5 space-y-1.5 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
              <Layers className="h-3.5 w-3.5 text-primary" />
              <span>Current Position:</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground bg-background px-2 py-1 rounded-md border border-border shadow-2xs font-mono text-xs">
                {currentLocationPath}
              </span>
              {type === "category" && (
                <LevelPill level={target.level || 1} />
              )}
            </div>
          </div>

          {/* Search & Filter Destination */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FolderTree className="h-3.5 w-3.5 text-primary" />
                <span>Select New Destination in Hierarchy Tree:</span>
              </label>
              <span className="text-[11px] text-muted-foreground">
                {allCategories.length} categories available
              </span>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search destination category by name or code..."
                className="w-full pl-9 pr-8 py-2 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Hierarchy Options List */}
          <div className="space-y-2 border border-border/80 rounded-xl p-3 bg-secondary/15 max-h-64 overflow-y-auto">
            {/* 1. Root Level Option */}
            <div
              onClick={() => {
                if (!isRootOptionDisabled) {
                  setSelectedDestinationId(null);
                }
              }}
              className={`flex items-center justify-between gap-2.5 p-2.5 rounded-xl border transition-all text-xs ${
                selectedDestinationId === null
                  ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/20"
                  : isRootOptionDisabled
                  ? "opacity-55 bg-secondary/20 border-border/50 cursor-not-allowed"
                  : "bg-background border-border hover:border-primary/40 hover:bg-secondary/40 cursor-pointer"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Box className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-foreground">
                      {type === "item" ? "Direct Root Level" : "Root Level (Level 1 Category)"}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      {type === "item" ? "No Category" : "Top Level"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {type === "item"
                      ? "Place directly in main inventory without any parent category"
                      : "Convert into an independent Level 1 Root Category"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isRootOptionDisabled && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">
                    Current Location
                  </span>
                )}
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                    selectedDestinationId === null
                      ? "border-primary bg-primary text-white"
                      : isRootOptionDisabled
                      ? "border-border/40 bg-secondary/40"
                      : "border-border hover:border-primary"
                  }`}
                >
                  {selectedDestinationId === null && <Check className="h-3 w-3 stroke-[3]" />}
                </div>
              </div>
            </div>

            {/* 2. Render Categories Tree */}
            <div className="space-y-1.5 pt-1">
              {categoryTree.map((rootNode) => renderTreeNode(rootNode, 1))}
            </div>
          </div>

          {/* Preview Destination Box */}
          {selectedDestinationId !== undefined && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 text-xs space-y-1 animate-in fade-in duration-200">
              <div className="font-bold text-primary flex items-center gap-1.5">
                <CornerDownRight className="h-4 w-4 shrink-0" />
                <span>Move Confirmation Summary:</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Will move <strong className="text-foreground font-semibold">{target.name}</strong> to:
              </p>
              <div className="p-2 rounded-lg bg-background border border-primary/20 font-mono text-primary font-bold text-xs flex items-center gap-1.5">
                <FolderInput className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{destinationPath}</span>
              </div>
            </div>
          )}
        </div>

        {/* ─── Modal Footer ────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-border bg-secondary/15 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-xl border border-border hover:bg-secondary text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirmMove}
            disabled={submitting || selectedDestinationId === undefined}
            className="px-5 py-2 rounded-xl cta-gradient text-white text-xs font-bold hover:opacity-95 transition-opacity disabled:opacity-50 cursor-pointer flex items-center gap-2 shadow-sm"
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Moving...</span>
              </>
            ) : (
              <>
                <ArrowRightLeft className="h-3.5 w-3.5" />
                <span>Confirm Move</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MoveHierarchyModal;
