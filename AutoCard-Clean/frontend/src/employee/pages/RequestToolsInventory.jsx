import { useEffect, useState, useMemo } from "react";
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

export default function RequestToolsInventory() {
  const navigate = useNavigate();
  const location = useLocation();

  const [submitting, setSubmitting] = useState(false);
  const [loadingTools, setLoadingTools] = useState(false);
  const [assignedToolsList, setAssignedToolsList] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [adminCategoriesList, setAdminCategoriesList] = useState([]);
  const [isCustomProductId, setIsCustomProductId] = useState(false);

  const [categories] = useState(["Tools", "Project", "General / Consumables"]);
  const [productTypes, setProductTypes] = useState([]);
  const [projects, setProjects] = useState([]);
  const [customProjectName, setCustomProjectName] = useState("");

  // Form State - Unified Schema for Taking and Return
  const [form, setForm] = useState({
    actionType: "Taking", // "Taking" | "Return"
    category: "Tools", // "Tools" | "Project" | "General / Consumables"
    productType: "", // Dynamic category fetched from inventory module
    projectName: "",
    projectCode: "",
    productId: "",
    itemName: "",
    selectedAssignedTool: "",
    quantity: 1,
    urgency: "Normal",
    itemCondition: "Good Condition",
    returnDate: new Date().toISOString().slice(0, 10),
    reason: "",
  });

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
        productId: productId || prev.productId,
        itemName: itemName || prev.itemName,
        selectedAssignedTool: itemName || prev.selectedAssignedTool,
        projectName: effectiveCategory === "Tools" ? "" : (projectName || prev.projectName),
        projectCode: effectiveCategory === "Tools" ? "" : (projectCode || prev.projectCode),
        productType: productType || prev.productType,
      }));
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
            if (uniqueCatNames.length > 0) {
              setForm((prev) => ({
                ...prev,
                productType: prev.productType && uniqueCatNames.includes(prev.productType)
                  ? prev.productType
                  : "",
              }));
            }
          }
        } catch (catErr) {
          console.warn("Could not load admin inventory categories:", catErr);
        }

        // 2. Fetch real catalog inventory items
        try {
          const invRes = await apiGet("/inventory/items").catch(() => ({ items: [] }));
          if (isMounted && Array.isArray(invRes?.items)) {
            setInventoryItems(invRes.items);
          }
        } catch (invErr) {
          console.warn("Could not load catalog inventory items:", invErr);
        }

        // Fetch active projects for request selection
        let loadedProjects = [];
        try {
          // 1. Try dedicated active-options endpoint first
          let projRes = await apiGet("/projects/active-options").catch(() => null);
          let rawProjects = Array.isArray(projRes?.projects) ? projRes.projects : [];

          // 2. Fallback to /projects or /projects/my-assigned
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

          // Filter for active projects
          const activeProjects = rawProjects.filter((p) => {
            const st = String(p.status || "").trim().toUpperCase();
            return st !== "COMPLETED" && st !== "CANCELLED" && !p.isArchived;
          });

          if (activeProjects.length > 0) {
            const structured = activeProjects
              .map((p) => {
                const nameStr = (p.name || p.title || "").trim();
                const codeStr = (p.code || "").trim();
                return {
                  id: p.id,
                  name: nameStr,
                  code: codeStr,
                  label: codeStr ? `${nameStr}-(${codeStr})` : nameStr,
                };
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
          // Preserve any existing projectName/code from location.state or keep empty to prompt selection
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
            if (toolsArr.length > 0) {
              setForm((prev) => ({ ...prev, selectedAssignedTool: toolsArr[0], itemName: toolsArr[0] }));
            } else {
              setForm((prev) => ({ ...prev, selectedAssignedTool: "Other / Custom Item" }));
            }
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
      // Must strictly be a Level-1 root category (no parentId, or level === 1)
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
        // For Tools: show ONLY Level-1 Tools category / tool folder
        return isToolCat;
      } else if (isGenConsumable) {
        // For General / Consumables: show ONLY Level-1 consumable categories
        return isConsumableCat;
      } else if (isProjectReq) {
        // For Project: show ONLY Level-1 non-consumable, non-tool project categories
        return !isConsumableCat && !isToolCat;
      }

      // Default fallback
      return !isConsumableCat && !isToolCat;
    });

    // Extract unique category names
    const names = [];
    validCats.forEach((cat) => {
      const catName = (cat.name || "").trim();
      if (catName && !names.includes(catName)) {
        names.push(catName);
      }
    });

    // For Tools: Fallback to "Tools" Level-1 category if none found in list
    if (isToolsReq && names.length === 0) {
      names.push("Tools");
    }

    if (isGenConsumable && names.length === 0) {
      names.push("General / Consumables");
    }

    // Sort, placing "Tools" first when on Tools tab
    names.sort((a, b) => {
      if (isToolsReq) {
        if (a.toLowerCase() === "tools") return -1;
        if (b.toLowerCase() === "tools") return 1;
      }
      return a.localeCompare(b);
    });

    return names;
  }, [adminCategoriesList, form.category]);

  // Ensure form.productType stays synced and valid whenever category or options change
  useEffect(() => {
    // If the currently selected productType is not available in displayProductTypes, reset it
    if (form.productType && !displayProductTypes.includes(form.productType)) {
      setForm((prev) => ({
        ...prev,
        productType: "",
        productId: "",
        itemName: "",
      }));
    }
  }, [form.category, displayProductTypes]);

  // Filter product items dynamically strictly according to selected Product Type / Category
  const filteredInventoryItems = useMemo(() => {
    if (!Array.isArray(inventoryItems) || inventoryItems.length === 0) return [];

    const selectedType = (form.productType || "").toLowerCase().trim();

    // CRITICAL: If no Product Type / Category is selected, DO NOT show any products in the dropdown!
    if (!selectedType) {
      return [];
    }

    return inventoryItems.filter((item) => {
      return doesItemMatchCategory(item, selectedType, adminCategoriesList);
    });
  }, [inventoryItems, form.productType, adminCategoriesList]);

  // Lookup full details of selected product code
  const selectedProductDetails = useMemo(() => {
    if (!form.productId || !Array.isArray(inventoryItems)) return null;
    const cleanId = form.productId.toLowerCase().trim();
    return inventoryItems.find(
      (i) =>
        (i.code && i.code.toLowerCase() === cleanId) ||
        (i.sku && i.sku.toLowerCase() === cleanId) ||
        (i.id && i.id.toLowerCase() === cleanId)
    );
  }, [inventoryItems, form.productId]);

  const handleChange = (field, value) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === "category") {
        updated.productType = "";
        updated.productId = "";
        updated.itemName = "";
        if (value !== "Project" && value !== "Product") {
          updated.projectName = "";
          updated.projectCode = "";
        }
      } else if (field === "productType") {
        updated.productId = "";
        updated.itemName = "";
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
          const rootCat = getRootCategoryName(matchedItem, adminCategoriesList);
          if (!updated.productType && rootCat) {
            updated.productType = rootCat;
          }
        }
      }
      return updated;
    });
    if (field === "category" || field === "productType") {
      setIsCustomProductId(false);
    }
  };

  const handleToolSelectChange = (value) => {
    if (value === "Other / Custom Item") {
      setForm((prev) => ({ ...prev, selectedAssignedTool: value, itemName: "" }));
    } else {
      setForm((prev) => ({ ...prev, selectedAssignedTool: value, itemName: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const isProjectCategory = form.category === "Project" || form.category === "Product";

    if (isProjectCategory) {
      if (!form.projectName || !form.projectName.trim() || form.projectName.includes("No assigned projects found")) {
        toast.error("Please choose a Project Name.");
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
      toast.error("Project Name is mandatory. Please select an assigned project or enter a custom project name.");
      return;
    }

    if (displayProductTypes.length > 0 && !form.productType.trim()) {
      toast.error("Please select a Product Type / Category.");
      return;
    }

    if (!form.productId.trim()) {
      toast.error("Please enter the Product ID / Part Code.");
      return;
    }

    const effectiveItemName =
      form.actionType === "Return" && form.selectedAssignedTool !== "Other / Custom Item"
        ? form.selectedAssignedTool
        : form.itemName.trim();

    if (!effectiveItemName) {
      toast.error("Please enter or select the Tool or Item Name.");
      return;
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

      const isConsumableCat = isGeneralOrConsumable(form.category);
      const effectiveProductType = form.productType || (isConsumableCat ? "General / Consumables" : "General");

      const actionTag = form.actionType === "Return" ? "Inventory Return" : "Inventory Taking";
      const projLabel = effectiveProjectCode ? `${effectiveProjectCode} - ${effectiveProjectName}` : effectiveProjectName;
      const subject = effectiveProjectName
        ? `[${actionTag}: ${projLabel}] ${effectiveItemName} (${effectiveProductType} - ID: ${form.productId.trim()})`
        : `[${actionTag}: ${form.productId.trim()}] ${effectiveItemName} (${effectiveProductType})`;

      const descriptionLines = [
        `Action Type: ${form.actionType.toUpperCase()}`,
        `Category: ${form.category}`,
        effectiveProductType ? `Product Type: ${effectiveProductType}` : null,
        `Product ID: ${form.productId.trim()}`,
        effectiveProjectName ? `Project Name: ${effectiveProjectName}` : null,
        effectiveProjectCode ? `Project Code: ${effectiveProjectCode}` : null,
        `Item Name: ${effectiveItemName}`,
        `Quantity: ${form.quantity}`,
        `Unit: ${selectedProductDetails?.unit || "Nos"}`,
        `Urgency Level: ${form.urgency}`,
        form.actionType === "Return" ? `Item Condition: ${form.itemCondition}` : null,
        `Date: ${form.returnDate}`,
        `Purpose / Work Details / Remarks: ${form.reason.trim()}`,
      ]
        .filter(Boolean)
        .join("\n");

      await apiPost("/requests", {
        type: "EQUIPMENT",
        subject,
        description: descriptionLines,
      });

      toast.success(
        `Tool / Inventory request (${form.actionType}) submitted successfully!`
      );
      navigate("/employee/requests/track");
    } catch (err) {
      toast.error(err.message || "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderProductTypeField = () => (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center justify-between">
        <span>
          Product Type / Category <span className="text-rose-500">*</span>
        </span>
      </label>
      <select
        value={form.productType}
        onChange={(e) => handleChange("productType", e.target.value)}
        className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm font-semibold"
      >
        <option value="">-- Select Product Type / Category --</option>
        {displayProductTypes.length === 0 ? (
          <option value="" disabled>
            {form.category === "Tools"
              ? "-- No Tools Categories Created Yet --"
              : (form.category === "Project" || form.category === "Product")
                ? "-- No Project Categories Created Yet --"
                : form.category === "General / Consumables"
                  ? "-- No Consumables Categories Created Yet --"
                  : "-- No Categories Found --"}
          </option>
        ) : (
          displayProductTypes.map((pt) => (
            <option key={pt} value={pt}>
              {pt}
            </option>
          ))
        )}
      </select>
    </div>
  );

  const renderProductIdField = (fullWidth = false) => {
    const isCategorySelected = Boolean(form.productType && form.productType.trim());

    return (
      <div className={fullWidth ? "md:col-span-2" : ""}>
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Product ID / Part Code <span className="text-rose-500">*</span>
        </label>
        {inventoryItems.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Select product by Code</span>
            </div>
            <select
              disabled={!isCategorySelected}
              value={isCustomProductId ? "CUSTOM" : form.productId}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "CUSTOM") {
                  setIsCustomProductId(true);
                  setForm((prev) => ({ ...prev, productId: "" }));
                } else {
                  setIsCustomProductId(false);
                  const matchedItem = inventoryItems.find(
                    (i) => (i.code || i.sku || i.id) === val
                  );
                  setForm((prev) => ({
                    ...prev,
                    productId: val,
                    itemName: matchedItem ? matchedItem.name : prev.itemName,
                  }));
                }
              }}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {!isCategorySelected ? (
                <option value="" disabled>
                  -- Please select Product Type / Category first --
                </option>
              ) : (
                <option value="">-- Select Product ID / Part Code --</option>
              )}
              {isCategorySelected && filteredInventoryItems.length === 0 && (
                <option value="" disabled>
                  -- No items registered under &quot;{form.productType}&quot; --
                </option>
              )}
              {isCategorySelected &&
                filteredInventoryItems.map((item) => {
                  const codeVal = item.code || item.sku || item.id;
                  return (
                    <option key={item.id || item._id || codeVal} value={codeVal}>
                      {codeVal} {item.name ? `— ${item.name}` : ""}
                    </option>
                  );
                })}
              {isCategorySelected && (
                <option value="CUSTOM">➕ Enter Custom Product ID / Code Not Listed</option>
              )}
            </select>

            {isCustomProductId && isCategorySelected && (
              <input
                type="text"
                required
                placeholder="Enter custom product ID or part code..."
                value={form.productId}
                onChange={(e) => handleChange("productId", e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm font-mono"
              />
            )}
          </div>
        ) : (
          <input
            type="text"
            required
            placeholder={
              form.category === "Project"
                ? "e.g. PRD-MECH-8802"
                : isGeneralOrConsumable(form.category)
                  ? "e.g. CON-OIL-001"
                  : "e.g. TOOL-ELE-001"
            }
            value={form.productId}
            onChange={(e) => handleChange("productId", e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm font-mono"
          />
        )}
      </div>
    );
  };

  if (!hasAccess) {
    return (
      <div className="p-8 text-center max-w-md mx-auto my-12 bg-card rounded-2xl border border-border shadow-sm">
        <ShieldAlert className="h-12 w-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Access Restricted</h2>
        <p className="text-sm text-muted-foreground mb-6">
          You do not have permission to submit Tools & Inventory requests. Please contact your system administrator to assign this role capability.
        </p>
        <button
          type="button"
          onClick={() => navigate("/employee/requests")}
          className="px-4 py-2 bg-primary text-white font-medium rounded-xl text-sm hover:bg-primary/90 transition-colors"
        >
          Go to Requests
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6 pb-12">
      {/* Back button */}
      <Link
        to="/employee/requests"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
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

      {/* Form Card - Unified Schema */}
      <form onSubmit={handleSubmit} className="rounded-2xl border-2 border-border bg-background p-6 md:p-8 shadow-sm space-y-6">
        {/* Action Type Toggle (1. Taking | 2. Return) */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Action Type <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3 p-1.5 rounded-xl border border-border bg-secondary/30">
            <button
              type="button"
              onClick={() => handleChange("actionType", "Taking")}
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
              onClick={() => handleChange("actionType", "Return")}
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

        {/* Unified Form Grid (Same Schema for Taking & Return) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Row 1: Request Category & Project Name (if Category == "Project") */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Request Category <span className="text-rose-500">*</span>
            </label>
            <select
              value={form.category}
              onChange={(e) => handleChange("category", e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm font-semibold"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Row 1 Col 2:
              1) If Project: show Project Name selection
              2) If Tools or General / Consumables: show Product Type / Category dropdown
          */}
          {(form.category === "Project" || form.category === "Product") ? (
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
                  {!customProjectName.trim() && (
                    <p className="text-[11px] text-rose-500 font-medium">
                      * Custom project name is mandatory when "Other / Custom Project" is selected.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            renderProductTypeField()
          )}

          {/* Row 2:
              1) If Project: Col 1 is Product Type / Category, Col 2 is Product ID / Part Code
              2) If Tools or General / Consumables: full width Product ID / Part Code
          */}
          {(form.category === "Project" || form.category === "Product") ? (
            <>
              {renderProductTypeField()}
              {renderProductIdField(false)}
            </>
          ) : (
            renderProductIdField(true)
          )}

          {/* Row: Tool / Item Name */}
          <div className="md:col-span-2 space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              {form.category === "Project"
                ? "Item / Component Name"
                : isGeneralOrConsumable(form.category)
                  ? "Consumable / Item Name"
                  : "Tool / Item Name"}{" "}
              <span className="text-rose-500">*</span>
            </label>
            {form.actionType === "Return" && assignedToolsList.length > 0 ? (
              <div className="space-y-3">
                <select
                  value={form.selectedAssignedTool}
                  onChange={(e) => handleToolSelectChange(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm font-semibold"
                >
                  {assignedToolsList.map((tool, idx) => (
                    <option key={idx} value={tool}>
                      {tool}
                    </option>
                  ))}
                  <option value="Other / Custom Item">Other / Custom Item Not Listed</option>
                </select>

                {form.selectedAssignedTool === "Other / Custom Item" && (
                  <input
                    type="text"
                    required
                    placeholder="Enter custom tool or item name to return"
                    value={form.itemName}
                    onChange={(e) => handleChange("itemName", e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm font-semibold"
                  />
                )}
              </div>
            ) : (
              <input
                type="text"
                required
                placeholder={
                  form.category === "Project"
                    ? "e.g. Conveyor Motor Assembly, PLC Controller Module"
                    : isGeneralOrConsumable(form.category)
                      ? "e.g. Cable Ties, Insulation Tape, Grease..."
                      : "e.g. Fluke 87V Digital Multimeter, Bosch Hammer Drill 26mm"
                }
                value={form.itemName}
                onChange={(e) => handleChange("itemName", e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm font-semibold"
              />
            )}
          </div>

          {/* Row 3: Complete Product Details Card */}
          {selectedProductDetails && (
            <div className="md:col-span-2 p-4 rounded-2xl border border-border bg-card shadow-sm space-y-3 text-xs text-foreground mt-1">
                <div className="flex items-center justify-between font-bold border-b border-border pb-2 text-sm text-primary">
                  <span className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-primary" />
                    Complete Product Details
                  </span>
                  {selectedProductDetails.stockQuantity !== undefined && (
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/20">
                      In Stock: {selectedProductDetails.stockQuantity} {selectedProductDetails.unit || "units"}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground font-medium">Product Name:</span>{" "}
                    <strong className="text-foreground">{selectedProductDetails.name}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-medium">Product Code / SKU:</span>{" "}
                    <span className="font-mono font-semibold text-primary">{selectedProductDetails.code || selectedProductDetails.sku || "N/A"}</span>
                  </div>
                  {selectedProductDetails.categoryRef?.name && (
                    <div>
                      <span className="text-muted-foreground font-medium">Category:</span>{" "}
                      <span className="font-medium">{selectedProductDetails.categoryRef.name} {selectedProductDetails.categoryRef.parent?.name ? `(Parent: ${selectedProductDetails.categoryRef.parent.name})` : ""}</span>
                    </div>
                  )}
                </div>
                {selectedProductDetails.description && (
                  <div className="pt-2 text-xs text-muted-foreground border-t border-border/50">
                    <span className="font-medium text-foreground">Description / Technical Specs:</span> {selectedProductDetails.description}
                  </div>
                )}
              </div>
            )}

          {/* Row 4: Quantity & Urgency Level */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Quantity <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              max="500"
              required
              value={form.quantity}
              onChange={(e) => handleChange("quantity", Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Urgency Level <span className="text-rose-500">*</span>
            </label>
            <select
              value={form.urgency}
              onChange={(e) => handleChange("urgency", e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
            >
              <option value="Normal">Normal (Standard Processing)</option>
              <option value="Urgent">Urgent (Needed within 24 Hours)</option>
              <option value="Emergency">Emergency / Immediate Site Work</option>
            </select>
          </div>

          {/* Row 5: Item Condition (if Return) & Date */}
          {form.actionType === "Return" && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Item Condition Upon Return <span className="text-rose-500">*</span>
              </label>
              <select
                value={form.itemCondition}
                onChange={(e) => handleChange("itemCondition", e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm font-medium"
              >
                <option value="Good Condition">Good Condition (Clean & Fully Functional)</option>
                <option value="Minor Wear">Minor Wear & Tear (Normal Usage)</option>
                <option value="Damaged / Needs Repair">Damaged / Needs Maintenance or Repair</option>
                <option value="Defective / Missing Parts">Defective / Missing Accessories</option>
              </select>
            </div>
          )}

          <div className={form.actionType === "Return" ? "" : "md:col-span-2"}>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              {form.actionType === "Return" ? "Return Date" : "Date"} <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={form.returnDate}
              onChange={(e) => handleChange("returnDate", e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
            />
          </div>

          {/* Row 6: Purpose / Work Details / Remarks */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Purpose / Work Details / Remarks <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              required
              placeholder={
                form.actionType === "Return"
                  ? "Provide return remarks or work details (e.g. Project completed at Site B. Returning multimeter and drill to store)."
                  : "Provide details about why this item is needed and where it will be used."
              }
              value={form.reason}
              onChange={(e) => handleChange("reason", e.target.value)}
              className="w-full rounded-xl border border-border bg-background p-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm resize-y"
            />
          </div>
        </div>

        {/* Submit Actions */}
        <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
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
                <Send className="h-4 w-4" /> Submit {form.actionType === "Return" ? "Return" : "Taking"} Request
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
