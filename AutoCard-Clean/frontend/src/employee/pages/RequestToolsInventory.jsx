import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  Wrench,
  ArrowLeft,
  Loader2,
  Send,
  FolderKanban,
  RotateCcw,
  PackagePlus,
  ShieldAlert,
  Tag,
  Plus,
  Trash2,
  ShoppingCart,
  ChevronRight,
  ChevronDown,
  Folder,
  Search,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../lib/api.js";
import { getAuthUser } from "../../lib/auth.js";
import { hasModuleAccess } from "../../lib/permissions.js";

const isExcludedProductType = (name) => {
  if (!name) return false;
  const lower = String(name).toLowerCase().trim();
  return (
    lower === "project" ||
    lower === "projects"
  );
};

const isToolCategory = (nameOrCat) => {
  if (!nameOrCat) return false;
  const name = typeof nameOrCat === "string" ? nameOrCat : (nameOrCat.name || "");
  const lower = String(name).toLowerCase().trim();
  return (
    lower === "tools" ||
    lower === "tool" ||
    lower.includes("tool")
  );
};

const isGeneralOrConsumable = (cat) => {
  if (!cat) return false;
  const lower = String(cat).toLowerCase().trim();
  return (
    lower.includes("general") ||
    lower.includes("genral") ||
    lower.includes("consumable") ||
    lower.includes("consuamble") ||
    lower.includes("consumables") ||
    lower.includes("consuambles") ||
    lower.includes("consumble")
  );
};

// Resolves the Level-1 root category name for any item
const getRootCategoryName = (item, categoriesList = []) => {
  if (!item) return "";
  const catId = item.categoryId || item.categoryRef?.id;

  if (catId && Array.isArray(categoriesList) && categoriesList.length > 0) {
    let curr = categoriesList.find((c) => c.id === catId);
    let depth = 0;
    while (curr && depth < 5) {
      if (curr.level === 1 || !curr.parentId) {
        return (curr.name || "").trim();
      }
      const parentId = curr.parentId;
      curr = categoriesList.find((c) => c.id === parentId);
      depth++;
    }
  }

  // Fallback to checking categoryRef parents
  if (item.categoryRef) {
    let ref = item.categoryRef;
    if (ref.level === 1 || !ref.parentId) return (ref.name || "").trim();
    if (ref.parent) {
      let p = ref.parent;
      if (p.level === 1 || !p.parentId) return (p.name || "").trim();
      if (p.parent) {
        let gp = p.parent;
        if (gp.level === 1 || !gp.parentId) return (gp.name || "").trim();
        if (gp.parent) return (gp.parent.name || "").trim();
      }
    }
  }

  return (item.categoryRef?.name || item.category || "").trim();
};

// Helper to check if item belongs to a category ID (matches direct, root, or any ancestor)
const isItemInCategoryId = (item, targetCategoryId, categoriesList = []) => {
  if (!item || !targetCategoryId || targetCategoryId === "ALL") return true;

  const catId = item.categoryId || item.categoryRef?.id;
  if (catId === targetCategoryId) return true;

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

// Checks whether an inventory item belongs to the selected product category
const doesItemMatchCategory = (item, selectedCategory, categoriesList = []) => {
  if (!item || !selectedCategory) return false;
  const target = String(selectedCategory).toLowerCase().trim();
  if (!target) return false;

  if (target === "other") return true;

  // 1. Direct category name or legacy category string
  const directName = String(item.categoryRef?.name || item.category || "").toLowerCase().trim();
  if (directName === target) return true;

  // 2. Direct category code
  const directCode = String(item.categoryRef?.code || "").toLowerCase().trim();
  if (directCode && directCode === target) return true;

  // 3. Level-1 root category name
  const rootName = String(getRootCategoryName(item, categoriesList) || "").toLowerCase().trim();
  if (rootName && rootName === target) return true;

  // 4. Ancestry traversal on item.categoryRef
  let ref = item.categoryRef?.parent;
  let depth = 0;
  while (ref && depth < 6) {
    const parentName = String(ref.name || "").toLowerCase().trim();
    const parentCode = String(ref.code || "").toLowerCase().trim();
    if (parentName === target || (parentCode && parentCode === target)) return true;
    ref = ref.parent;
    depth++;
  }

  // 5. Ancestry traversal using categoriesList by id
  const catId = item.categoryId || item.categoryRef?.id;
  if (catId && Array.isArray(categoriesList) && categoriesList.length > 0) {
    let curr = categoriesList.find((c) => c.id === catId);
    let d = 0;
    while (curr && d < 6) {
      const cName = String(curr.name || "").toLowerCase().trim();
      const cCode = String(curr.code || "").toLowerCase().trim();
      if (cName === target || (cCode && cCode === target)) return true;
      const pid = curr.parentId;
      curr = pid ? categoriesList.find((c) => c.id === pid) : null;
      d++;
    }
  }

  // 6. Consumable/General fuzzy match
  if (target.includes("consum") || target.includes("general") || target.includes("genral")) {
    const isConsumable =
      directName.includes("consum") ||
      directName.includes("consuamble") ||
      directName.includes("general") ||
      directName.includes("genral") ||
      rootName.includes("consum") ||
      rootName.includes("consuamble") ||
      rootName.includes("general") ||
      rootName.includes("genral");
    if (isConsumable) return true;
  }

  // 7. Tool fuzzy match: if target is "tools" or contains "tool"
  if (target === "tools" || target === "tool" || target.includes("tool")) {
    const isTool =
      directName.includes("tool") ||
      rootName.includes("tool") ||
      (item.name && item.name.toLowerCase().includes("tool")) ||
      (item.categoryRef?.code && String(item.categoryRef.code).toLowerCase().includes("tool"));
    if (isTool) return true;
  }

  return false;
};

// Reusable Searchable Dropdown Component with embedded search bar & multi-select with inline quantity
const SearchableDropdown = ({
  value,
  onChange,
  options = [],
  placeholder = "-- Select --",
  disabled = false,
  className = "",
  size = "sm", // "sm" for roots, "md" for product
  multiple = false, // When true, value is an array of values
  onMultiChange, // (selectedValuesArray) => void
  selectedQuantities = {}, // Map of optValue -> quantity
  onQuantityChange, // (optValue, newQty) => void
  renderOption,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // Focus search input when opened
  useEffect(() => {
    if (open && searchInputRef.current) {
      searchInputRef.current.focus();
    }
    if (!open) {
      setQuery("");
    }
  }, [open]);

  const selectedValues = multiple
    ? Array.isArray(value)
      ? value.map(String)
      : value
        ? [String(value)]
        : []
    : [];

  const selectedOption = !multiple ? options.find((opt) => String(opt.value) === String(value)) : null;

  const filteredOptions = options.filter((opt) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    const labelMatch = (opt.label || "").toLowerCase().includes(q);
    const subMatch = (opt.subLabel || "").toLowerCase().includes(q);
    const valueMatch = String(opt.value || "").toLowerCase().includes(q);
    return labelMatch || subMatch || valueMatch;
  });

  const isSmall = size === "sm";

  const handleToggleMulti = (optVal) => {
    const strVal = String(optVal);
    let newVals;
    if (selectedValues.includes(strVal)) {
      newVals = selectedValues.filter((v) => v !== strVal);
    } else {
      newVals = [...selectedValues, strVal];
    }
    if (onMultiChange) {
      onMultiChange(newVals);
    } else if (onChange) {
      onChange(newVals);
    }
  };

  const getButtonLabel = () => {
    if (multiple) {
      if (selectedValues.length === 0) return placeholder;
      if (selectedValues.length === 1) {
        const found = options.find((o) => String(o.value) === selectedValues[0]);
        const qty = selectedQuantities[selectedValues[0]] || 1;
        return found ? `${found.label} (Qty: ${qty})` : `${selectedValues[0]} (Qty: ${qty})`;
      }
      return `${selectedValues.length} items selected`;
    }
    return selectedOption ? selectedOption.label : placeholder;
  };

  return (
    <div ref={dropdownRef} className={`relative w-full ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2 rounded-lg border border-border bg-background text-left transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 ${
          isSmall ? "px-3 py-1.5 text-xs" : "px-3.5 py-2 text-sm"
        } ${className}`}
      >
        <span className="truncate block font-medium text-foreground">
          {getButtonLabel()}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {multiple && selectedValues.length > 0 && (
            <span className="inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-primary text-primary-foreground">
              {selectedValues.length}
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu Popup */}
      {open && !disabled && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-80 min-w-[280px] rounded-xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden animate-in fade-in-0 zoom-in-95">
          {/* Embedded Search Bar */}
          <div className="p-2 border-b border-border/70 bg-secondary/50 sticky top-0 z-10">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                onClick={(e) => e.stopPropagation()}
              />
              {query && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setQuery("");
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            {multiple && (
              <div className="flex items-center justify-between pt-1.5 px-0.5 text-[11px] text-muted-foreground">
                <span>Select items & set quantity</span>
                {selectedValues.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onMultiChange) onMultiChange([]);
                      else if (onChange) onChange([]);
                    }}
                    className="text-rose-500 hover:text-rose-700 font-semibold"
                  >
                    Clear All
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Options List */}
          <div className="overflow-y-auto max-h-64 p-1 bg-card divide-y divide-border/20">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                No matching options found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const optStrVal = String(opt.value);
                const isSelected = multiple
                  ? selectedValues.includes(optStrVal)
                  : optStrVal === String(value);
                const currentQty = selectedQuantities[optStrVal] || 1;

                return (
                  <div
                    key={optStrVal}
                    onClick={() => {
                      if (multiple) {
                        handleToggleMulti(opt.value);
                      } else {
                        onChange(opt.value);
                        setOpen(false);
                      }
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs rounded-md transition-colors cursor-pointer select-none ${
                      isSelected
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-foreground hover:bg-secondary/70"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
                      {multiple && (
                        <div
                          className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-border bg-background"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                        </div>
                      )}
                      <div className="truncate flex-1">
                        {renderOption ? (
                          renderOption(opt, isSelected)
                        ) : (
                          <div>
                            <div className="truncate font-medium">{opt.label}</div>
                            {opt.subLabel && (
                              <div className="text-[11px] text-muted-foreground truncate">{opt.subLabel}</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Inline Quantity Stepper / Selector inside dropdown when checked */}
                    {multiple && isSelected && optStrVal !== "CUSTOM" && (
                      <div
                        className="flex items-center gap-1 shrink-0 ml-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-[10px] text-muted-foreground uppercase font-bold mr-0.5">
                          Qty:
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onQuantityChange) {
                              onQuantityChange(opt.value, Math.max(1, currentQty - 1));
                            }
                          }}
                          className="h-5 w-5 rounded bg-background border border-border flex items-center justify-center text-foreground hover:bg-muted font-bold text-xs"
                          title="Decrease quantity"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          max="999"
                          value={currentQty}
                          onChange={(e) => {
                            e.stopPropagation();
                            const val = Math.max(1, parseInt(e.target.value) || 1);
                            if (onQuantityChange) {
                              onQuantityChange(opt.value, val);
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-11 h-5 text-center text-xs font-semibold bg-background border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onQuantityChange) {
                              onQuantityChange(opt.value, currentQty + 1);
                            }
                          }}
                          className="h-5 w-5 rounded bg-background border border-border flex items-center justify-center text-foreground hover:bg-muted font-bold text-xs"
                          title="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                    )}

                    {!multiple && isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default function RequestToolsInventory() {
  const navigate = useNavigate();
  const location = useLocation();

  const [submitting, setSubmitting] = useState(false);
  const [loadingTools, setLoadingTools] = useState(false);
  const [assignedToolsList, setAssignedToolsList] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [adminCategoriesList, setAdminCategoriesList] = useState([]);

  const [categories] = useState(["Tools", "Project", "General / Consumables"]);
  const [productTypes, setProductTypes] = useState([]);
  const [projects, setProjects] = useState([]);
  const [customProjectName, setCustomProjectName] = useState("");

  // Base Form State
  const [form, setForm] = useState({
    actionType: "Taking", // "Taking" | "Return"
    category: "Tools", // "Tools" | "Project" | "General / Consumables"
    projectName: "",
    projectCode: "",
    urgency: "Normal",
    itemCondition: "Good Condition",
    returnDate: new Date().toISOString().slice(0, 10),
    reason: "",
  });

  // Multiple Items List (Dynamic Cart with 4-level root cascade)
  const [items, setItems] = useState([
    {
      id: Date.now(),
      level1Id: "ALL",
      level2Id: "ALL",
      level3Id: "ALL",
      level4Id: "ALL",
      productType: "",
      productId: "",
      itemName: "",
      selectedAssignedTool: "",
      quantity: 1,
      unit: "Nos",
      isCustomProductId: false,
      selectedProducts: [],
    },
  ]);

  const [hasAccess, setHasAccess] = useState(() => hasModuleAccess("requests-tools-inventory"));

  useEffect(() => {
    setHasAccess(hasModuleAccess("requests-tools-inventory"));
  }, []);

  // Pre-fill form state when navigated from MyTools.jsx Product Return button
  useEffect(() => {
    if (location.state) {
      const { actionType, category, productId, itemName, projectName, projectCode, productType } = location.state;
      const effectiveCategory = category || "Tools";
      setForm((prev) => ({
        ...prev,
        actionType: actionType || "Return",
        category: effectiveCategory,
        projectName: effectiveCategory === "Tools" ? "" : (projectName || prev.projectName),
        projectCode: effectiveCategory === "Tools" ? "" : (projectCode || prev.projectCode),
      }));
      setItems([
        {
          id: Date.now(),
          level1Id: "ALL",
          level2Id: "ALL",
          level3Id: "ALL",
          level4Id: "ALL",
          productType: productType || "",
          productId: productId || "",
          itemName: itemName || "",
          selectedAssignedTool: itemName || "",
          quantity: 1,
          unit: "Nos",
          isCustomProductId: false,
          searchTerm: "",
        },
      ]);
    }
  }, [location.state]);

  useEffect(() => {
    if (!hasAccess) return;
    let isMounted = true;

    const loadData = async () => {
      try {
        setLoadingTools(true);

        // 1. Fetch categories directly from Admin Inventory Module
        try {
          const catRes = await apiGet("/inventory/categories").catch(() => ({ categories: [] }));
          if (isMounted && Array.isArray(catRes?.categories)) {
            setAdminCategoriesList(catRes.categories);
            const validAdminCatNames = catRes.categories
              .filter((c) => (c.level === 1 || !c.parentId) && !isExcludedProductType(c.name))
              .map((c) => (c.name || "").trim())
              .filter(Boolean);
            const uniqueCatNames = Array.from(new Set(validAdminCatNames));
            setProductTypes(uniqueCatNames);
          }
        } catch (catErr) {
          console.warn("Could not load admin inventory categories:", catErr);
        }

        // 2. Fetch inventory items
        try {
          const invRes = await apiGet("/inventory/items").catch(() => ({ items: [] }));
          if (isMounted && Array.isArray(invRes?.items)) {
            setInventoryItems(invRes.items);
          }
        } catch (invErr) {
          console.warn("Could not load catalog inventory items:", invErr);
        }

        // 3. Fetch active projects
        let loadedProjects = [];
        try {
          let projRes = await apiGet("/projects/active-options").catch(() => null);
          let rawProjects = Array.isArray(projRes?.projects) ? projRes.projects : [];

          if (rawProjects.length === 0) {
            const authUser = getAuthUser();
            const isAdmin = authUser?.role === "ADMIN";
            const endpoint = isAdmin ? "/projects" : "/projects/my-assigned";
            const fallbackRes = await apiGet(endpoint).catch(() => null);
            rawProjects = Array.isArray(fallbackRes)
              ? fallbackRes
              : Array.isArray(fallbackRes?.projects)
                ? fallbackRes.projects
                : [];
          }

          if (rawProjects.length > 0) {
            const structured = rawProjects
              .map((p) => {
                if (typeof p === "string") return { id: p, name: p, code: "", label: p };
                const pName = p.name || p.title || p.projectName || "";
                const pCode = p.code || p.projectCode || "";
                const pLabel = pCode ? `${pCode} - ${pName}` : pName;
                return { id: p.id || p._id || pName, name: pName, code: pCode, label: pLabel };
              })
              .filter((p) => p.name);

            const uniqueMap = new Map();
            structured.forEach((item) => {
              if (!uniqueMap.has(item.name)) {
                uniqueMap.set(item.name, item);
              }
            });

            const uniqueProjects = Array.from(uniqueMap.values());
            uniqueProjects.push({
              id: "custom",
              name: "Other / Custom Project",
              code: "",
              label: "Other / Custom Project",
            });
            loadedProjects = uniqueProjects;
          } else {
            loadedProjects = [
              {
                id: "custom",
                name: "Other / Custom Project",
                code: "",
                label: "Other / Custom Project",
              },
            ];
          }
        } catch (projErr) {
          console.warn("Could not fetch projects:", projErr);
          loadedProjects = [
            {
              id: "custom",
              name: "Other / Custom Project",
              code: "",
              label: "Other / Custom Project",
            },
          ];
        }

        if (isMounted) {
          setProjects(loadedProjects);
          setForm((prev) => ({
            ...prev,
            projectName: prev.projectName || "",
            projectCode: prev.projectCode || "",
          }));
        }

        // Load assigned employee tools for Return option
        try {
          const profileRes = await apiGet("/onboarding/me").catch(() => null);
          const rawTools = profileRes?.profile?.assignedTools || "";
          const toolsArr = rawTools
            .split(/,\s*|\n+/)
            .map((t) => t.trim())
            .filter(Boolean);

          if (isMounted) {
            setAssignedToolsList(toolsArr);
          }
        } catch (onboardingErr) {
          console.warn("Could not load employee assigned tools:", onboardingErr);
        }
      } catch (err) {
        console.warn("Failed to load initial tools form settings:", err);
      } finally {
        if (isMounted) setLoadingTools(false);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [hasAccess]);

  // Available Level-1 product categories directly from Admin Inventory Module
  const displayProductTypes = useMemo(() => {
    if (!Array.isArray(adminCategoriesList) || adminCategoriesList.length === 0) {
      return form.category === "Tools" ? ["Tools"] : [];
    }

    const currentReqCat = (form.category || "").toLowerCase().trim();
    const isGenConsumable = isGeneralOrConsumable(currentReqCat);
    const isToolsReq = currentReqCat === "tools" || currentReqCat.includes("tool");
    const isProjectReq = currentReqCat === "project" || currentReqCat === "product";

    const validCats = adminCategoriesList.filter((cat) => {
      const isLevel1 = (cat.level && Number(cat.level) === 1) || !cat.parentId;
      if (!isLevel1) return false;

      const name = (cat.name || "").trim().toLowerCase();
      if (!name || isExcludedProductType(cat.name)) return false;

      const isConsumableCat =
        name.includes("consumable") ||
        name.includes("consuamble") ||
        name.includes("general") ||
        name.includes("genral") ||
        (cat.code && String(cat.code).toLowerCase().includes("con"));

      const isToolCat = isToolCategory(name) || (cat.code && String(cat.code).toLowerCase().includes("tool"));

      if (isToolsReq) {
        // When request type is Tools, allow all Root Level 1 categories
        return true;
      } else if (isGenConsumable) {
        return isConsumableCat;
      } else if (isProjectReq) {
        return !isConsumableCat && !isToolCat;
      }

      return true;
    });

    const names = [];
    validCats.forEach((cat) => {
      const catName = (cat.name || "").trim();
      if (catName && !names.includes(catName)) {
        names.push(catName);
      }
    });

    if (isToolsReq && names.length === 0) {
      names.push("Tools");
    }

    if (isGenConsumable && names.length === 0) {
      names.push("General / Consumables");
    }

    names.sort((a, b) => {
      if (isToolsReq) {
        if (a.toLowerCase() === "tools") return -1;
        if (b.toLowerCase() === "tools") return 1;
      }
      return a.localeCompare(b);
    });

    return names;
  }, [adminCategoriesList, form.category]);

  const handleBaseChange = (field, value) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === "category") {
        if (value !== "Project" && value !== "Product") {
          updated.projectName = "";
          updated.projectCode = "";
        }
        // Reset items' productType and productId when category switches
        setItems([
          {
            id: Date.now(),
            level1Id: "ALL",
            level2Id: "ALL",
            level3Id: "ALL",
            level4Id: "ALL",
            productType: "",
            productId: "",
            itemName: "",
            selectedAssignedTool: "",
            quantity: 1,
            unit: "Nos",
            isCustomProductId: false,
            searchTerm: "",
            selectedProducts: [],
          },
        ]);
      }
      return updated;
    });
  };

  // Item List Operations (Add another folder / root category group)
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        level1Id: "ALL",
        level2Id: "ALL",
        level3Id: "ALL",
        level4Id: "ALL",
        productType: "",
        productId: "",
        itemName: "",
        selectedAssignedTool: "",
        quantity: 1,
        unit: "Nos",
        isCustomProductId: false,
        searchTerm: "",
        selectedProducts: [],
      },
    ]);
  };

  const handleRemoveItem = (id) => {
    if (items.length <= 1) {
      toast.error("At least one item is required in the request.");
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleItemLevelChange = (id, level, value) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item };
        if (level === 1) {
          updated.level1Id = value;
          updated.level2Id = "ALL";
          updated.level3Id = "ALL";
          updated.level4Id = "ALL";
          updated.productId = "";
          updated.itemName = "";
          updated.isCustomProductId = false;
          updated.selectedProducts = [];
          // Set productType name if known
          const matchedCat = adminCategoriesList.find((c) => c.id === value);
          updated.productType = matchedCat ? (matchedCat.name || "").trim() : (value === "ALL" ? "" : value);
        } else if (level === 2) {
          updated.level2Id = value;
          updated.level3Id = "ALL";
          updated.level4Id = "ALL";
          updated.productId = "";
          updated.itemName = "";
          updated.isCustomProductId = false;
        } else if (level === 3) {
          updated.level3Id = value;
          updated.level4Id = "ALL";
          updated.productId = "";
          updated.itemName = "";
          updated.isCustomProductId = false;
        } else if (level === 4) {
          updated.level4Id = value;
          updated.productId = "";
          updated.itemName = "";
          updated.isCustomProductId = false;
        }
        return updated;
      })
    );
  };

  const handleItemChange = (id, field, value) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };

        if (field === "productType") {
          // If changed via direct productType dropdown, match level1Id if possible
          const matchedCat = adminCategoriesList.find(
            (c) => (c.name || "").toLowerCase().trim() === (value || "").toLowerCase().trim() && ((c.level && Number(c.level) === 1) || !c.parentId)
          );
          updated.level1Id = matchedCat ? matchedCat.id : "ALL";
          updated.level2Id = "ALL";
          updated.level3Id = "ALL";
          updated.level4Id = "ALL";
          updated.productId = "";
          updated.itemName = "";
          updated.isCustomProductId = false;
        } else if (field === "productId") {
          const cleanVal = (value || "").toLowerCase().trim();
          const matchedItem = inventoryItems.find(
            (i) =>
              (i.code && i.code.toLowerCase() === cleanVal) ||
              (i.sku && i.sku.toLowerCase() === cleanVal) ||
              (i.id && i.id.toLowerCase() === cleanVal)
          );
          if (matchedItem) {
            updated.itemName = matchedItem.name;
            updated.unit = matchedItem.unit || "Nos";
            const rootCat = getRootCategoryName(matchedItem, adminCategoriesList);
            if (!updated.productType && rootCat) {
              updated.productType = rootCat;
            }
          }
        }
        return updated;
      })
    );
  };

  // Multi-Select for Products inside a specific Folder / Item Card (no extra Item # cards created!)
  const handleCardProductMultiSelect = (cardId, selectedCodeVals) => {
    setItems((prev) =>
      prev.map((card) => {
        if (card.id !== cardId) return card;

        const currentSelectedProducts = Array.isArray(card.selectedProducts) ? card.selectedProducts : [];
        const cleanVals = (selectedCodeVals || []).filter((v) => v !== "CUSTOM" && v !== "");

        const newSelectedList = cleanVals.map((codeVal) => {
          const cleanVal = String(codeVal).toLowerCase().trim();
          const existing = currentSelectedProducts.find(
            (p) => String(p.code).toLowerCase().trim() === cleanVal
          );

          const matchedInv = inventoryItems.find(
            (i) =>
              (i.code && i.code.toLowerCase() === cleanVal) ||
              (i.sku && i.sku.toLowerCase() === cleanVal) ||
              (i.id && i.id.toLowerCase() === cleanVal)
          );

          return {
            code: codeVal,
            name: matchedInv ? matchedInv.name : (existing ? existing.name : codeVal),
            unit: matchedInv?.unit || (existing ? existing.unit : "Nos"),
            quantity: existing ? existing.quantity : 1,
            stockQuantity: matchedInv?.stockQuantity,
          };
        });

        // Update single-item compatibility fields so form validation & preview stay in sync
        const firstProd = newSelectedList[0];
        return {
          ...card,
          selectedProducts: newSelectedList,
          productId: firstProd ? firstProd.code : (card.isCustomProductId ? card.productId : ""),
          itemName: firstProd ? firstProd.name : (card.isCustomProductId ? card.itemName : ""),
          unit: firstProd ? firstProd.unit : (card.unit || "Nos"),
          quantity: firstProd ? firstProd.quantity : (card.quantity || 1),
        };
      })
    );
  };

  // Update quantity for a specific product inside a specific Card
  const handleCardProductQuantityChange = (cardId, codeVal, newQty) => {
    const cleanVal = String(codeVal).toLowerCase().trim();
    setItems((prev) =>
      prev.map((card) => {
        if (card.id !== cardId) return card;
        const currentSelected = Array.isArray(card.selectedProducts) ? card.selectedProducts : [];
        const updatedList = currentSelected.map((prod) => {
          if (String(prod.code).toLowerCase().trim() === cleanVal) {
            return { ...prod, quantity: Math.max(1, newQty) };
          }
          return prod;
        });

        const firstProd = updatedList[0];
        return {
          ...card,
          selectedProducts: updatedList,
          quantity: firstProd ? firstProd.quantity : card.quantity,
        };
      })
    );
  };

  // Remove a single product from a Card's selected products list
  const handleCardRemoveProduct = (cardId, codeVal) => {
    const cleanVal = String(codeVal).toLowerCase().trim();
    setItems((prev) =>
      prev.map((card) => {
        if (card.id !== cardId) return card;
        const currentSelected = Array.isArray(card.selectedProducts) ? card.selectedProducts : [];
        const updatedList = currentSelected.filter(
          (prod) => String(prod.code).toLowerCase().trim() !== cleanVal
        );
        const firstProd = updatedList[0];
        return {
          ...card,
          selectedProducts: updatedList,
          productId: firstProd ? firstProd.code : "",
          itemName: firstProd ? firstProd.name : "",
          quantity: firstProd ? firstProd.quantity : 1,
          unit: firstProd ? firstProd.unit : "Nos",
        };
      })
    );
  };

  const handleToolSelectChange = (id, value) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (value === "Other / Custom Item") {
          return { ...item, selectedAssignedTool: value, itemName: "" };
        } else {
          return { ...item, selectedAssignedTool: value, itemName: value };
        }
      })
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const isProjectCategory = form.category === "Project" || form.category === "Product";

    if (isProjectCategory) {
      if (!form.projectName || !form.projectName.trim() || form.projectName.includes("No assigned projects found")) {
        toast.error("Please select a Project Name first to configure and submit project request items.");
        return;
      }
      if (form.projectName === "Other / Custom Project" && !customProjectName.trim()) {
        toast.error("Custom Project Name is mandatory! Please enter the project name.");
        return;
      }
    }

    const effectiveProjectName = isProjectCategory && form.projectName
      ? form.projectName === "Other / Custom Project"
        ? customProjectName.trim()
      : form.projectName.includes("No assigned projects found")
          ? ""
          : form.projectName.trim()
      : "";

    if (isProjectCategory && !effectiveProjectName) {
      toast.error("Project Name is mandatory. Please choose a Project Name before submitting items.");
      return;
    }

    if (items.length === 0) {
      toast.error("Please add at least one item.");
      return;
    }

    // Flatten all selected products across all group cards into a unified list
    const allRequestProducts = [];
    for (let i = 0; i < items.length; i++) {
      const card = items[i];
      const cardNum = items.length > 1 ? ` (Item #${i + 1})` : "";

      const hasCategorySelected = card.productType?.trim() || (card.level1Id && card.level1Id !== "ALL");
      if (displayProductTypes.length > 0 && !hasCategorySelected) {
        toast.error(`Please select a Category / Root Level${cardNum}.`);
        return;
      }

      const prods = (Array.isArray(card.selectedProducts) && card.selectedProducts.length > 0)
        ? card.selectedProducts
        : (card.productId || card.itemName)
          ? [{
              code: card.productId || "CUSTOM",
              name: form.actionType === "Return" && card.selectedAssignedTool !== "Other / Custom Item"
                ? card.selectedAssignedTool
                : (card.itemName || card.productId),
              quantity: card.quantity || 1,
              unit: card.unit || "Nos",
            }]
          : [];

      if (prods.length === 0) {
        toast.error(`Please select at least one Product ID / Part Code${cardNum}.`);
        return;
      }

      for (const p of prods) {
        if (!p.code || !String(p.code).trim()) {
          toast.error(`Product ID / Part Code is missing${cardNum}.`);
          return;
        }
        if (!p.name || !String(p.name).trim()) {
          toast.error(`Product / Item name is missing for ${p.code}${cardNum}.`);
          return;
        }
        if (!p.quantity || p.quantity < 1) {
          toast.error(`Please enter a valid quantity for ${p.name}${cardNum}.`);
          return;
        }
        allRequestProducts.push({
          ...p,
          productType: card.productType || "General",
          level1Id: card.level1Id,
        });
      }
    }

    if (!form.reason.trim()) {
      toast.error("Please provide purpose / work details / remarks.");
      return;
    }

    try {
      setSubmitting(true);

      const effectiveProjectCode = isProjectCategory && form.projectName && form.projectName !== "Other / Custom Project"
        ? (form.projectCode || "").trim()
        : "";

      const actionTag = form.actionType === "Return" ? "Inventory Return" : "Inventory Taking";
      const projLabel = effectiveProjectCode ? `${effectiveProjectCode} - ${effectiveProjectName}` : effectiveProjectName;

      // Build items summary for subject
      let subject = "";
      if (allRequestProducts.length === 1) {
        const singleP = allRequestProducts[0];
        const effectiveProdType = singleP.productType || "General";

        subject = effectiveProjectName
          ? `[${actionTag}: ${projLabel}] ${singleP.name} (${effectiveProdType} - ID: ${String(singleP.code).trim()})`
          : `[${actionTag}: ${String(singleP.code).trim()}] ${singleP.name} (${effectiveProdType})`;
      } else {
        const itemNamesPreview = allRequestProducts.slice(0, 3).map((it) => it.name || it.code).join(", ");
        const moreCount = allRequestProducts.length > 3 ? ` +${allRequestProducts.length - 3} more` : "";
        subject = effectiveProjectName
          ? `[${actionTag}: ${projLabel}] ${allRequestProducts.length} Items: ${itemNamesPreview}${moreCount}`
          : `[${actionTag}: Multiple Items] ${allRequestProducts.length} Items: ${itemNamesPreview}${moreCount}`;
      }

      // Build structured description
      const descriptionLines = [
        `Action Type: ${form.actionType.toUpperCase()}`,
        `Category: ${form.category}`,
        effectiveProjectName ? `Project Name: ${effectiveProjectName}` : null,
        effectiveProjectCode ? `Project Code: ${effectiveProjectCode}` : null,
      ];

      if (allRequestProducts.length === 1) {
        const it = allRequestProducts[0];
        descriptionLines.push(
          it.productType ? `Product Type: ${it.productType}` : null,
          `Product ID: ${String(it.code).trim()}`,
          `Item Name: ${it.name}`,
          `Quantity: ${it.quantity}`,
          `Unit: ${it.unit || "Nos"}`
        );
      } else {
        descriptionLines.push(`Items (${allRequestProducts.length}):`);
        allRequestProducts.forEach((it, idx) => {
          descriptionLines.push(
            `${idx + 1}. [${String(it.code).trim()}] ${it.name} (Qty: ${it.quantity}, ${it.unit || "Nos"}${it.productType ? `, ${it.productType}` : ""})`
          );
        });
      }

      descriptionLines.push(
        `Urgency Level: ${form.urgency}`,
        form.actionType === "Return" ? `Item Condition: ${form.itemCondition}` : null,
        `Date: ${form.returnDate}`,
        `Purpose / Work Details / Remarks: ${form.reason.trim()}`
      );

      await apiPost("/requests", {
        type: "EQUIPMENT",
        subject,
        description: descriptionLines.filter(Boolean).join("\n"),
      });

      toast.success(
        `Tool / Inventory request (${form.actionType}) for ${items.length} item${items.length === 1 ? "" : "s"} submitted successfully!`
      );
      navigate("/employee/requests/track");
    } catch (err) {
      toast.error(err.message || "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!hasAccess) {
    return (
      <div className="p-8 text-center max-w-md mx-auto my-12 bg-card rounded-2xl border border-border shadow-sm">
        <ShieldAlert className="h-12 w-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Access Restricted</h2>
        <p className="text-sm text-muted-foreground mb-6">
          You do not have permission to submit Tool / Inventory requests. Please contact your administrator.
        </p>
        <Link
          to="/employee/requests"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white font-medium rounded-xl text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Requests
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back button */}
      <Link
        to="/employee/requests"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Requests
      </Link>

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-border bg-gradient-to-br from-amber-500/10 via-primary/5 to-purple-500/10 p-6 md:p-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border-2 border-amber-500/30 flex items-center justify-center shrink-0">
            {form.actionType === "Return" ? (
              <RotateCcw className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            ) : (
              <PackagePlus className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            )}
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              Request Tools & Inventory
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Submit a request for Taking (Issue) or Return of tools, mechanical & electrical equipment, or project items.
            </p>
          </div>
        </div>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="rounded-2xl border-2 border-border bg-background p-6 md:p-8 shadow-sm space-y-6">
        {/* Action Type Toggle (1. Taking | 2. Return) */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Action Type <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3 p-1.5 rounded-xl border border-border bg-secondary/30">
            <button
              type="button"
              onClick={() => handleBaseChange("actionType", "Taking")}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                form.actionType === "Taking"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60"
              }`}
            >
              <PackagePlus className="h-4 w-4" />
              1. Taking (Issue Item)
            </button>

            <button
              type="button"
              onClick={() => handleBaseChange("actionType", "Return")}
              className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${
                form.actionType === "Return"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60"
              }`}
            >
              <RotateCcw className="h-4 w-4" />
              2. Return (Return Item)
            </button>
          </div>
        </div>

        {/* Base Info Grid: Request Category & Project Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Request Category */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Request Category <span className="text-rose-500">*</span>
            </label>
            <select
              value={form.category}
              onChange={(e) => handleBaseChange("category", e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm font-semibold"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Project Selection (if Category == "Project") */}
          {(form.category === "Project" || form.category === "Product") && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center justify-between">
                <span>Choose Project Name-(Project Code) <span className="text-rose-500">*</span></span>
              </label>
              <select
                value={form.projectName}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    setForm((prev) => ({
                      ...prev,
                      projectName: "",
                      projectCode: "",
                    }));
                    return;
                  }
                  const matched = projects.find((p) => p.name === val || p.id === val);
                  setForm((prev) => ({
                    ...prev,
                    projectName: matched ? matched.name : val,
                    projectCode: matched ? (matched.code || "") : "",
                  }));
                }}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm font-semibold"
              >
                <option value="">-- Choose Project Name --</option>
                {projects.map((proj) => {
                  const nameVal = typeof proj === "string" ? proj : proj.name;
                  const labelVal = typeof proj === "string" ? proj : (proj.label || proj.name);
                  const keyVal = typeof proj === "string" ? proj : (proj.id || proj.name);
                  return (
                    <option key={keyVal} value={nameVal}>
                      {labelVal}
                    </option>
                  );
                })}
              </select>

              {form.projectCode && (
                <div className="mt-2 text-xs font-medium text-blue-700 dark:text-blue-300 flex items-center gap-2 bg-blue-50 dark:bg-blue-950/40 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800/60 w-fit shadow-2xs">
                  <FolderKanban className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>Project Code: <strong className="font-mono bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded-md font-bold text-blue-800 dark:text-blue-200">{form.projectCode}</strong></span>
                </div>
              )}

              {form.projectName === "Other / Custom Project" && (
                <div className="mt-3 space-y-1.5 animate-in fade-in duration-150">
                  <label className="block text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>
                      Custom Project Name <span className="text-rose-500 font-bold">* (Mandatory)</span>
                    </span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter custom project name (Mandatory)..."
                    value={customProjectName}
                    onChange={(e) => setCustomProjectName(e.target.value)}
                    className={`w-full rounded-xl border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm ${
                      !customProjectName.trim()
                        ? "border-rose-400 dark:border-rose-500/70 focus:border-rose-500"
                        : "border-border focus:border-primary"
                    }`}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── DYNAMIC ITEMS LIST (Cart / Multi-item block) ─── */}
        {(form.category === "Project" || form.category === "Product") && (!form.projectName || form.projectName.includes("No assigned projects found") || (form.projectName === "Other / Custom Project" && !customProjectName.trim())) ? (
          <div className="rounded-2xl border-2 border-dashed border-blue-300 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 p-6 text-center space-y-3 animate-in fade-in duration-200">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
              <FolderKanban className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-sm font-bold text-foreground">
                Please Choose Project Name First
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Select your assigned Project Name-(Project Code) or specify a Custom Project above to unlock the requested items box and select inventory components.
              </p>
            </div>
          </div>
        ) : (
        <div className="space-y-4 pt-2">
          {/* Header Card */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-primary/10 via-background to-secondary/30 border border-primary/20 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold shadow-xs">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-base font-bold text-foreground">
                    Requested Items
                  </h2>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-primary text-primary-foreground shadow-xs">
                    {items.reduce((total, it) => total + ((Array.isArray(it.selectedProducts) && it.selectedProducts.length > 0) ? it.selectedProducts.length : (it.productId ? 1 : 0)), 0)} Products
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select categories, folders, product part code and item details for your request
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all shadow-sm active:scale-95"
            >
              <Plus className="h-4 w-4" />
              Add Another Item
            </button>
          </div>

          {items.map((item, index) => {
            // Find Level 1 Category object for this item
            const currentL1Cat = adminCategoriesList.find((c) => {
              if (item.level1Id && item.level1Id !== "ALL" && c.id === item.level1Id) return true;
              if (item.productType && (c.name || "").toLowerCase().trim() === item.productType.toLowerCase().trim() && ((c.level && Number(c.level) === 1) || !c.parentId)) return true;
              return false;
            });
            const effectiveL1Id = currentL1Cat ? currentL1Cat.id : (item.level1Id !== "ALL" ? item.level1Id : "");

            // Subcategories cascading options for this item
            const itemLevel2Options = effectiveL1Id
              ? adminCategoriesList.filter((c) => c.parentId === effectiveL1Id)
              : [];
            const itemLevel3Options = item.level2Id && item.level2Id !== "ALL"
              ? adminCategoriesList.filter((c) => c.parentId === item.level2Id)
              : [];
            const itemLevel4Options = item.level3Id && item.level3Id !== "ALL"
              ? adminCategoriesList.filter((c) => c.parentId === item.level3Id)
              : [];

            // Root 1 base list
            const root1BaseList = adminCategoriesList
              .filter((c) => (c.level && Number(c.level) === 1) || !c.parentId)
              .filter((c) => {
                if (!c.name || isExcludedProductType(c.name)) return false;
                const catName = c.name.toLowerCase();
                const curCat = (form.category || "").toLowerCase();
                if (isGeneralOrConsumable(curCat)) return isGeneralOrConsumable(catName);
                if (isToolCategory(curCat)) return true; // all root level 1 folders when request type is Tools
                return true;
              });

            const r1Q = (item.root1Search || "").toLowerCase().trim();
            const root1Filtered = r1Q
              ? root1BaseList.filter((c) => (c.name || "").toLowerCase().includes(r1Q))
              : root1BaseList;

            const filteredDisplayProductTypes = r1Q
              ? displayProductTypes.filter((pt) => pt.toLowerCase().includes(r1Q))
              : displayProductTypes;

            const r2Q = (item.root2Search || "").toLowerCase().trim();
            const filteredLevel2Options = r2Q
              ? itemLevel2Options.filter((c) => (c.name || "").toLowerCase().includes(r2Q))
              : itemLevel2Options;

            const r3Q = (item.root3Search || "").toLowerCase().trim();
            const filteredLevel3Options = r3Q
              ? itemLevel3Options.filter((c) => (c.name || "").toLowerCase().includes(r3Q))
              : itemLevel3Options;

            const r4Q = (item.root4Search || "").toLowerCase().trim();
            const filteredLevel4Options = r4Q
              ? itemLevel4Options.filter((c) => (c.name || "").toLowerCase().includes(r4Q))
              : itemLevel4Options;

            // Active category scope for this item (deepest selected)
            const activeScopeCatId = (item.level4Id && item.level4Id !== "ALL")
              ? item.level4Id
              : (item.level3Id && item.level3Id !== "ALL")
                ? item.level3Id
                : (item.level2Id && item.level2Id !== "ALL")
                  ? item.level2Id
                  : effectiveL1Id || "ALL";

            // Items filtered by category hierarchy or fallback productType
            const filteredForThisItem = inventoryItems.filter((i) => {
              if (activeScopeCatId && activeScopeCatId !== "ALL") {
                return isItemInCategoryId(i, activeScopeCatId, adminCategoriesList);
              }
              if (item.productType) {
                return doesItemMatchCategory(i, item.productType, adminCategoriesList);
              }
              return false;
            });

            // Further filter by search term if provided
            const searchQ = (item.searchTerm || "").toLowerCase().trim();
            const displayedForThisItem = searchQ
              ? filteredForThisItem.filter((inv) => {
                  const codeVal = (inv.code || inv.sku || inv.id || "").toLowerCase();
                  const nameVal = (inv.name || "").toLowerCase();
                  const descVal = (inv.description || "").toLowerCase();
                  return codeVal.includes(searchQ) || nameVal.includes(searchQ) || descVal.includes(searchQ);
                })
              : filteredForThisItem;

            // Active category name for badge preview
            const activeCatObj = adminCategoriesList.find((c) => c.id === activeScopeCatId);

            const selectedDetails = inventoryItems.find(
              (i) =>
                (i.code && i.code.toLowerCase() === (item.productId || "").toLowerCase().trim()) ||
                (i.sku && i.sku.toLowerCase() === (item.productId || "").toLowerCase().trim()) ||
                (i.id && i.id.toLowerCase() === (item.productId || "").toLowerCase().trim())
            );

            return (
              <div
                key={item.id}
                className="relative rounded-2xl border border-border/90 bg-card/75 p-5 md:p-6 shadow-sm space-y-5 transition-all hover:border-primary/50 hover:shadow-md"
              >
                {/* Item Card Header */}
                <div className="flex items-center justify-between pb-3 border-b border-border/60">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary/10 text-primary font-bold text-xs shadow-2xs">
                      <Tag className="h-3.5 w-3.5 text-primary" />
                      Item #{index + 1}
                    </span>
                    {activeCatObj && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20">
                        <Folder className="h-3.5 w-3.5" />
                        {activeCatObj.name}
                      </span>
                    )}
                  </div>

                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="inline-flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 font-semibold px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors"
                      title="Remove Item"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  )}
                </div>

                {/* ── 4-Level Root Hierarchy Filter (Level 1 -> Level 2 -> Level 3 -> Level 4) ── */}
                <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Folder className="h-3.5 w-3.5 text-violet-500" />
                      Inventory Root / Folder Navigation
                    </span>
                    <span className="text-[11px] text-muted-foreground font-medium">
                      Select folder to filter items
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {/* Root Level 1 */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-violet-600"></span>
                          Root 1 (Category) <span className="text-rose-500">*</span>
                        </span>
                        {root1Filtered.length > 0 && (
                          <span className="text-[10px] text-muted-foreground font-normal">({root1Filtered.length})</span>
                        )}
                      </label>
                      <SearchableDropdown
                        value={effectiveL1Id || "ALL"}
                        onChange={(val) => handleItemLevelChange(item.id, 1, val)}
                        options={[
                          { value: "ALL", label: "-- Choose Root 1 --" },
                          ...root1Filtered.map((c) => ({ value: c.id, label: c.name })),
                          ...filteredDisplayProductTypes
                            .filter((pt) => !root1Filtered.some((c) => (c.name || "").toLowerCase() === pt.toLowerCase()))
                            .map((pt) => ({ value: pt, label: pt })),
                        ]}
                        placeholder="-- Choose Root 1 --"
                        size="sm"
                        className="font-semibold"
                      />
                    </div>

                    {/* Root Level 2 */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                          Root 2 (Folder)
                        </span>
                        {itemLevel2Options.length > 0 && (
                          <span className="text-[10px] text-muted-foreground font-normal">({filteredLevel2Options.length})</span>
                        )}
                      </label>
                      <SearchableDropdown
                        value={item.level2Id || "ALL"}
                        onChange={(val) => handleItemLevelChange(item.id, 2, val)}
                        disabled={!effectiveL1Id || itemLevel2Options.length === 0}
                        options={[
                          {
                            value: "ALL",
                            label: !effectiveL1Id
                              ? "Select Root 1 First"
                              : itemLevel2Options.length === 0
                                ? "No Sub-folders"
                                : "All Sub-folders",
                          },
                          ...filteredLevel2Options.map((c) => ({ value: c.id, label: c.name })),
                        ]}
                        placeholder={
                          !effectiveL1Id
                            ? "Select Root 1 First"
                            : itemLevel2Options.length === 0
                              ? "No Sub-folders"
                              : "All Sub-folders"
                        }
                        size="sm"
                      />
                    </div>

                    {/* Root Level 3 */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                          Root 3 (Sub-folder)
                        </span>
                        {itemLevel3Options.length > 0 && (
                          <span className="text-[10px] text-muted-foreground font-normal">({filteredLevel3Options.length})</span>
                        )}
                      </label>
                      <SearchableDropdown
                        value={item.level3Id || "ALL"}
                        onChange={(val) => handleItemLevelChange(item.id, 3, val)}
                        disabled={!item.level2Id || item.level2Id === "ALL" || itemLevel3Options.length === 0}
                        options={[
                          {
                            value: "ALL",
                            label: !item.level2Id || item.level2Id === "ALL"
                              ? "Select Root 2 First"
                              : itemLevel3Options.length === 0
                                ? "No Sub-folders"
                                : "All Level 3",
                          },
                          ...filteredLevel3Options.map((c) => ({ value: c.id, label: c.name })),
                        ]}
                        placeholder={
                          !item.level2Id || item.level2Id === "ALL"
                            ? "Select Root 2 First"
                            : itemLevel3Options.length === 0
                              ? "No Sub-folders"
                              : "All Level 3"
                        }
                        size="sm"
                      />
                    </div>

                    {/* Root Level 4 */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                          Root 4 (Sub-folder)
                        </span>
                        {itemLevel4Options.length > 0 && (
                          <span className="text-[10px] text-muted-foreground font-normal">({filteredLevel4Options.length})</span>
                        )}
                      </label>
                      <SearchableDropdown
                        value={item.level4Id || "ALL"}
                        onChange={(val) => handleItemLevelChange(item.id, 4, val)}
                        disabled={!item.level3Id || item.level3Id === "ALL" || itemLevel4Options.length === 0}
                        options={[
                          {
                            value: "ALL",
                            label: !item.level3Id || item.level3Id === "ALL"
                              ? "Select Root 3 First"
                              : itemLevel4Options.length === 0
                                ? "No Sub-folders"
                                : "All Level 4",
                          },
                          ...filteredLevel4Options.map((c) => ({ value: c.id, label: c.name })),
                        ]}
                        placeholder={
                          !item.level3Id || item.level3Id === "ALL"
                            ? "Select Root 3 First"
                            : itemLevel4Options.length === 0
                              ? "No Sub-folders"
                              : "All Level 4"
                        }
                        size="sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Product ID / Code */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 flex-wrap">
                        <span>Product ID / Part Code <span className="text-rose-500">*</span></span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                          multi-select & qty enabled
                        </span>
                      </span>
                      {displayedForThisItem.length > 0 && (
                        <span className="text-[11px] text-primary font-bold">
                          {displayedForThisItem.length} items found
                        </span>
                      )}
                    </label>

                    <SearchableDropdown
                      disabled={!effectiveL1Id && !item.productType}
                      multiple={true}
                      value={
                        item.isCustomProductId
                          ? ["CUSTOM"]
                          : (Array.isArray(item.selectedProducts) && item.selectedProducts.length > 0)
                            ? item.selectedProducts.map((p) => p.code)
                            : item.productId ? [item.productId] : []
                      }
                      selectedQuantities={
                        (Array.isArray(item.selectedProducts) && item.selectedProducts.length > 0)
                          ? item.selectedProducts.reduce((acc, p) => {
                              acc[String(p.code)] = p.quantity || 1;
                              return acc;
                            }, {})
                          : item.productId ? { [String(item.productId)]: item.quantity || 1 } : {}
                      }
                      onQuantityChange={(codeVal, newQty) => {
                        handleCardProductQuantityChange(item.id, codeVal, newQty);
                      }}
                      onMultiChange={(vals) => {
                        if (vals.includes("CUSTOM")) {
                          handleItemChange(item.id, "isCustomProductId", true);
                          handleItemChange(item.id, "productId", "");
                        } else {
                          handleItemChange(item.id, "isCustomProductId", false);
                          handleCardProductMultiSelect(item.id, vals.filter(v => v !== "CUSTOM" && v !== ""));
                        }
                      }}
                      options={[
                        ...((effectiveL1Id || item.productType)
                          ? displayedForThisItem.map((inv) => {
                              const codeVal = inv.code || inv.sku || inv.id;
                              return {
                                value: codeVal,
                                label: `${codeVal}${inv.name ? ` — ${inv.name}` : ""}`,
                                subLabel: inv.sku && inv.sku !== codeVal ? `SKU: ${inv.sku}` : "",
                              };
                            })
                          : []),
                        ...((effectiveL1Id || item.productType)
                          ? [{ value: "CUSTOM", label: "➕ Enter Custom Product ID / Code Not Listed" }]
                          : []),
                      ]}
                      placeholder={
                        !effectiveL1Id && !item.productType
                          ? "-- Select Root 1 / Category first --"
                          : displayedForThisItem.length === 0
                            ? "-- No items found in category --"
                            : "-- Select Product ID(s) / Code(s) --"
                      }
                      size="md"
                    />

                    {item.isCustomProductId && (
                      <input
                        type="text"
                        required
                        placeholder="Enter custom product ID or part code..."
                        value={item.productId}
                        onChange={(e) => handleItemChange(item.id, "productId", e.target.value)}
                        className="mt-2 w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    )}
                  </div>

                  {/* Selected Products Table / List for this Folder Group */}
                  {Array.isArray(item.selectedProducts) && item.selectedProducts.length > 0 && (
                    <div className="md:col-span-2 space-y-2 pt-1">
                      <div className="flex items-center justify-between text-xs font-bold text-foreground">
                        <span className="flex items-center gap-1.5 text-primary">
                          <Check className="h-4 w-4 stroke-[2.5]" />
                          Selected Products from this Folder ({item.selectedProducts.length})
                        </span>
                        <span className="text-[11px] font-medium text-muted-foreground">
                          Adjust quantities below or in the dropdown
                        </span>
                      </div>

                      <div className="rounded-xl border border-border/80 bg-background/80 overflow-hidden divide-y divide-border/60 shadow-xs">
                        {item.selectedProducts.map((prod, pIdx) => (
                          <div
                            key={prod.code || pIdx}
                            className="p-3 flex flex-wrap items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                          >
                            {/* Product Info */}
                            <div className="flex items-center gap-2.5 min-w-[180px] flex-1">
                              <span className="h-6 w-6 rounded-md bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                                {pIdx + 1}
                              </span>
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-foreground truncate">
                                  {prod.name || prod.code}
                                </div>
                                <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-2">
                                  <span>ID: {prod.code}</span>
                                  {prod.stockQuantity !== undefined && (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-medium font-sans">
                                      • In Stock: {prod.stockQuantity} {prod.unit || "units"}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Quantity Controls & Unit */}
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-lg border border-border">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground px-1">
                                  Qty:
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCardProductQuantityChange(
                                      item.id,
                                      prod.code,
                                      Math.max(1, (prod.quantity || 1) - 1)
                                    )
                                  }
                                  className="h-6 w-6 rounded bg-background border border-border flex items-center justify-center text-foreground hover:bg-muted font-bold text-xs shadow-2xs active:scale-95 transition-all"
                                  title="Decrease quantity"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  max="500"
                                  value={prod.quantity || 1}
                                  onChange={(e) => {
                                    const val = Math.max(1, parseInt(e.target.value) || 1);
                                    handleCardProductQuantityChange(item.id, prod.code, val);
                                  }}
                                  className="w-12 h-6 text-center text-xs font-bold bg-background border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCardProductQuantityChange(
                                      item.id,
                                      prod.code,
                                      (prod.quantity || 1) + 1
                                    )
                                  }
                                  className="h-6 w-6 rounded bg-background border border-border flex items-center justify-center text-foreground hover:bg-muted font-bold text-xs shadow-2xs active:scale-95 transition-all"
                                  title="Increase quantity"
                                >
                                  +
                                </button>
                              </div>

                              <span className="text-xs font-medium text-muted-foreground min-w-[32px]">
                                {prod.unit || "Nos"}
                              </span>

                              {/* Remove product button */}
                              <button
                                type="button"
                                onClick={() => handleCardRemoveProduct(item.id, prod.code)}
                                className="h-7 w-7 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 flex items-center justify-center transition-colors"
                                title="Remove this product"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Fallback Single Item Name & Single Item Qty when custom or return item */}
                  {(!item.selectedProducts || item.selectedProducts.length === 0) && (
                    <>
                      {/* Item Name */}
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                          {form.category === "Project"
                            ? "Item / Component Name"
                            : isGeneralOrConsumable(form.category)
                              ? "Consumable / Item Name"
                              : "Tool / Item Name"}{" "}
                          <span className="text-rose-500">*</span>
                        </label>
                        {form.actionType === "Return" && assignedToolsList.length > 0 ? (
                          <div className="space-y-2">
                            <select
                              value={item.selectedAssignedTool}
                              onChange={(e) => handleToolSelectChange(item.id, e.target.value)}
                              className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
                            >
                              <option value="">-- Select Assigned Item to Return --</option>
                              {assignedToolsList.map((tool, idx) => (
                                <option key={idx} value={tool}>
                                  {tool}
                                </option>
                              ))}
                              <option value="Other / Custom Item">Other / Custom Item Not Listed</option>
                            </select>

                            {item.selectedAssignedTool === "Other / Custom Item" && (
                              <input
                                type="text"
                                required
                                placeholder="Enter custom tool or item name to return"
                                value={item.itemName}
                                onChange={(e) => handleItemChange(item.id, "itemName", e.target.value)}
                                className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
                              />
                            )}
                          </div>
                        ) : (
                          <input
                            type="text"
                            required
                            placeholder="e.g. Multimeter, Hammer Drill, Conveyor Motor, Cable Ties..."
                            value={item.itemName}
                            onChange={(e) => handleItemChange(item.id, "itemName", e.target.value)}
                            className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
                          />
                        )}
                      </div>

                      {/* Quantity & Unit Details */}
                      <div className="grid grid-cols-2 gap-3 md:col-span-2">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                            Quantity <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="500"
                            required
                            value={item.quantity}
                            onChange={(e) =>
                              handleItemChange(item.id, "quantity", Math.max(1, parseInt(e.target.value) || 1))
                            }
                            className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                            Unit
                          </label>
                          <input
                            type="text"
                            value={item.unit || "Nos"}
                            onChange={(e) => handleItemChange(item.id, "unit", e.target.value)}
                            placeholder="Nos, Set, Pcs, Mtr..."
                            className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Product Stock Badge Preview */}
                  {selectedDetails && (
                    <div className="md:col-span-2 p-3 rounded-xl bg-background border border-border/80 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-foreground">{selectedDetails.name}</span>
                        <span className="font-mono text-muted-foreground">({selectedDetails.code || selectedDetails.sku})</span>
                      </div>
                      {selectedDetails.stockQuantity !== undefined && (
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/20">
                          Available: {selectedDetails.stockQuantity} {selectedDetails.unit || "units"}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <div className="pt-2 flex justify-start">
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-bold transition-all hover:scale-[1.01] active:scale-95"
            >
              <Plus className="h-4 w-4" />
              + Add Another Item to this Request
            </button>
          </div>
        </div>
        )}

        {/* Common Request Details (Urgency, Condition, Date, Remarks) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Urgency Level <span className="text-rose-500">*</span>
            </label>
            <select
              value={form.urgency}
              onChange={(e) => handleBaseChange("urgency", e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
            >
              <option value="Normal">Normal (Standard Processing)</option>
              <option value="Urgent">Urgent (Needed within 24 Hours)</option>
              <option value="Emergency">Emergency / Immediate Site Work</option>
            </select>
          </div>

          {form.actionType === "Return" && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Item Condition Upon Return <span className="text-rose-500">*</span>
              </label>
              <select
                value={form.itemCondition}
                onChange={(e) => handleBaseChange("itemCondition", e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm font-medium"
              >
                <option value="Good Condition">Good Condition (Clean & Fully Functional)</option>
                <option value="Minor Wear">Minor Wear & Tear (Normal Usage)</option>
                <option value="Damaged / Needs Repair">Damaged / Needs Maintenance or Repair</option>
                <option value="Defective / Missing Parts">Defective / Missing Accessories</option>
              </select>
            </div>
          )}

          <div className={form.actionType === "Return" ? "md:col-span-2" : "md:col-span-1"}>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              {form.actionType === "Return" ? "Return Date" : "Date"} <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={form.returnDate}
              onChange={(e) => handleBaseChange("returnDate", e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
            />
          </div>

          {/* Purpose / Remarks */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Purpose / Work Details / Remarks <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              required
              placeholder={
                form.actionType === "Return"
                  ? "Provide return remarks or work details (e.g. Project completed at Site B. Returning tools to store)."
                  : "Provide details about why these items are needed and where they will be used."
              }
              value={form.reason}
              onChange={(e) => handleBaseChange("reason", e.target.value)}
              className="w-full rounded-xl border border-border bg-background p-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm resize-y"
            />
          </div>
        </div>

        {/* Submit Actions */}
        <div className="pt-4 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium">
            Total items in this request: <strong className="text-foreground">{items.length}</strong>
          </span>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/employee/requests")}
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl border border-border bg-secondary text-foreground text-sm font-semibold hover:bg-secondary/80 transition-all"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting || loadingTools}
              className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md disabled:opacity-60 ${
                form.actionType === "Return"
                  ? "bg-rose-600 text-white hover:bg-rose-700"
                  : "bg-primary text-primary-foreground hover:opacity-90"
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> Submit {form.actionType === "Return" ? "Return" : "Taking"} Request ({items.length} {items.length === 1 ? "Item" : "Items"})
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
