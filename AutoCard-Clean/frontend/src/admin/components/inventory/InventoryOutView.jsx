import { useState, useEffect, useMemo, useRef } from "react";
import {
  PackageMinus,
  Plus,
  Search,
  RefreshCw,
  ArrowLeft,
  Calendar,
  User,
  Users,
  ShieldCheck,
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  RotateCcw,
  Trash2,
  X,
  FileText,
  Boxes,
  Download,
  MapPin,
  Tag,
  Layers,
  Eye,
  Filter,
  ChevronDown,
  Folder,
  Package,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPut, apiDelete } from "../../../lib/api.js";
import { getAuthUser } from "../../../lib/auth.js";
import { canPerformAction } from "../../../lib/permissions.js";

const resolveImageUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  const rawApiUrl = import.meta.env.VITE_API_URL || "";
  let baseOrigin = "";
  if (rawApiUrl) {
    try {
      baseOrigin = new URL(rawApiUrl).origin;
    } catch {
      baseOrigin = rawApiUrl.replace(/\/api\/?$/, "").replace(/\/+$/, "");
    }
  } else if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    baseOrigin = "http://localhost:4000";
  } else {
    baseOrigin = "https://api.techwareautomation.in";
  }
  const cleanPath = url.startsWith("/") ? url : `/${url}`;
  return `${baseOrigin}${cleanPath}`;
};

// Helper to check if item belongs to a category ID (matches direct, root, or any ancestor)
const isItemInCategoryId = (item, targetCategoryId, categoriesList = []) => {
  if (!item || !targetCategoryId || targetCategoryId === "ALL") return true;

  const targetStr = String(targetCategoryId);
  const catId = item.categoryId || item.categoryRef?.id;
  if (catId && String(catId) === targetStr) return true;

  // Walk up categoriesList
  if (catId && Array.isArray(categoriesList) && categoriesList.length > 0) {
    let curr = categoriesList.find((c) => String(c.id) === String(catId));
    let depth = 0;
    while (curr && depth < 6) {
      if (String(curr.id) === targetStr) return true;
      curr = curr.parentId ? categoriesList.find((c) => String(c.id) === String(curr.parentId)) : null;
      depth++;
    }
  }

  // Walk up categoryRef
  if (item.categoryRef) {
    let curr = item.categoryRef;
    let depth = 0;
    while (curr && depth < 6) {
      if (String(curr.id) === targetStr) return true;
      curr = curr.parent;
      depth++;
    }
  }

  return false;
};

// Helper to get ancestry chain of a category or item
const getCategoryAncestryChain = (categoryOrItem, categoriesList = []) => {
  const catMap = new Map((categoriesList || []).map((c) => [String(c.id), c]));
  let curr = null;

  if (categoryOrItem?.categoryRef) {
    curr = categoryOrItem.categoryRef;
  } else if (categoryOrItem?.categoryId) {
    curr = catMap.get(String(categoryOrItem.categoryId));
  } else if (categoryOrItem?.id && catMap.has(String(categoryOrItem.id))) {
    curr = catMap.get(String(categoryOrItem.id));
  }

  if (!curr) return [];

  const chain = [];
  const visited = new Set();
  while (curr && !visited.has(String(curr.id))) {
    visited.add(String(curr.id));
    chain.unshift(curr);
    curr = curr.parentId ? catMap.get(String(curr.parentId)) : curr.parent;
  }
  return chain;
};

export default function InventoryOutView({ onBackToHub, assignedUsers: propAssignedUsers, currentUser: propCurrentUser }) {
  const canCreate = canPerformAction("inventory-out", "create");
  const canEdit = canPerformAction("inventory-out", "edit");
  const canDelete = canPerformAction("inventory-out", "delete");

  const [issues, setIssues] = useState([]);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [tableRoot1Filter, setTableRoot1Filter] = useState("ALL");
  const [tableRoot2Filter, setTableRoot2Filter] = useState("ALL");
  const [tableRoot3Filter, setTableRoot3Filter] = useState("ALL");
  const [tableRoot4Filter, setTableRoot4Filter] = useState("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [viewDetailsModal, setViewDetailsModal] = useState(null);

  // Assigned personnel
  const [internalAssignedUsers, setInternalAssignedUsers] = useState(propAssignedUsers || []);
  const [internalCurrentUser, setInternalCurrentUser] = useState(propCurrentUser || null);

  useEffect(() => {
    if (propAssignedUsers && propAssignedUsers.length > 0) {
      setInternalAssignedUsers(propAssignedUsers);
    } else {
      apiGet("/inventory/assigned-users")
        .then((data) => setInternalAssignedUsers(data.inventoryOutUsers || []))
        .catch(() => {});
    }

    if (propCurrentUser) {
      setInternalCurrentUser(propCurrentUser);
    } else {
      setInternalCurrentUser(getAuthUser());
    }
  }, [propAssignedUsers, propCurrentUser]);

  // Form State
  const [form, setForm] = useState({
    level1Id: "ALL",
    level2Id: "ALL",
    level3Id: "ALL",
    level4Id: "ALL",
    inventoryItemId: "",
    itemName: "",
    issuedToPerson: "",
    issuedToCompany: "",
    quantity: 1,
    issueDate: new Date().toISOString().slice(0, 10),
    status: "ISSUED",
    notes: "",
  });

  // Hierarchy filter cascade in Modal
  const [modalSearchItem, setModalSearchItem] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [issuesRes, itemsRes, catsRes] = await Promise.all([
        apiGet("/inventory/issues/all"),
        apiGet("/inventory/items"),
        apiGet("/inventory/categories").catch(() => ({ categories: [] })),
      ]);
      setIssues(issuesRes.issues || []);
      setItems(itemsRes.items || []);
      setCategories(catsRes.categories || []);
    } catch (err) {
      toast.error(err.message || "Failed to load material outward data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLevelChange = (level, value) => {
    setForm((prev) => {
      const updated = { ...prev };
      const valStr = String(value);
      if (level === 1) {
        updated.level1Id = valStr;
        updated.level2Id = "ALL";
        updated.level3Id = "ALL";
        updated.level4Id = "ALL";
        updated.inventoryItemId = "";
        updated.itemName = "";
      } else if (level === 2) {
        updated.level2Id = valStr;
        updated.level3Id = "ALL";
        updated.level4Id = "ALL";
        updated.inventoryItemId = "";
        updated.itemName = "";
      } else if (level === 3) {
        updated.level3Id = valStr;
        updated.level4Id = "ALL";
        updated.inventoryItemId = "";
        updated.itemName = "";
      } else if (level === 4) {
        updated.level4Id = valStr;
        updated.inventoryItemId = "";
        updated.itemName = "";
      }
      return updated;
    });
  };

  const handleItemSelect = (itemId) => {
    if (!itemId) {
      setForm((prev) => ({ ...prev, inventoryItemId: "", itemName: "" }));
      return;
    }
    const selected = items.find((i) => String(i.id) === String(itemId));
    if (selected) {
      // Auto-populate roots based on item's category ancestry chain
      const chain = getCategoryAncestryChain(selected, categories);
      setForm((prev) => ({
        ...prev,
        level1Id: chain[0]?.id ? String(chain[0].id) : prev.level1Id,
        level2Id: chain[1]?.id ? String(chain[1].id) : "ALL",
        level3Id: chain[2]?.id ? String(chain[2].id) : "ALL",
        level4Id: chain[3]?.id ? String(chain[3].id) : "ALL",
        inventoryItemId: selected.id,
        itemName: selected.name,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.itemName || !form.itemName.trim()) {
      toast.error("Item name is required.");
      return;
    }
    if (!form.issuedToPerson || !form.issuedToPerson.trim()) {
      toast.error("Recipient person name is required.");
      return;
    }
    if (!form.issuedToCompany || !form.issuedToCompany.trim()) {
      toast.error("Company or project name is required.");
      return;
    }
    if (!form.quantity || Number(form.quantity) < 1) {
      toast.error("Quantity must be at least 1.");
      return;
    }

    setSubmitting(true);
    try {
      await apiPost("/inventory/issues", {
        inventoryItemId: form.inventoryItemId || null,
        itemName: form.itemName.trim(),
        issuedToPerson: form.issuedToPerson.trim(),
        issuedToCompany: form.issuedToCompany.trim(),
        quantity: Number(form.quantity),
        issueDate: form.issueDate || new Date().toISOString().slice(0, 10),
        status: form.status || "ISSUED",
        notes: form.notes || null,
      });
      toast.success("Material issued successfully!");
      setIsModalOpen(false);
      setForm({
        level1Id: "ALL",
        level2Id: "ALL",
        level3Id: "ALL",
        level4Id: "ALL",
        inventoryItemId: "",
        itemName: "",
        issuedToPerson: "",
        issuedToCompany: "",
        quantity: 1,
        issueDate: new Date().toISOString().slice(0, 10),
        status: "ISSUED",
        notes: "",
      });
      setModalSearchItem("");
      await loadData();
    } catch (err) {
      toast.error(err.message || "Failed to issue material.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturn = async (issueId) => {
    try {
      await apiPut(`/inventory/issues/${issueId}`, { status: "RETURNED" });
      toast.success("Item marked as RETURNED and stock restocked.");
      await loadData();
    } catch (err) {
      toast.error(err.message || "Failed to return item.");
    }
  };

  const handleDelete = async (issueId) => {
    if (!window.confirm("Are you sure you want to delete this issue record?")) return;
    try {
      await apiDelete(`/inventory/issues/${issueId}`);
      toast.success("Issue record deleted.");
      await loadData();
    } catch (err) {
      toast.error(err.message || "Failed to delete record.");
    }
  };

  // Build category hierarchy roots for each issue item
  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const getItemRoots = (issue) => {
    let r1 = "—", r2 = "—", r3 = "—", r4 = "—";
    const item = issue.inventoryItem || items.find((i) => i.id === issue.inventoryItemId || i.name?.toLowerCase() === issue.itemName?.toLowerCase());
    if (!item) return { r1, r2, r3, r4 };

    let curr = item.categoryRef || (item.categoryId ? catMap.get(item.categoryId) : null);
    if (!curr) {
      if (item.category) r1 = item.category;
      return { r1, r2, r3, r4 };
    }

    const chain = [];
    const visited = new Set();
    while (curr && !visited.has(curr.id)) {
      visited.add(curr.id);
      chain.unshift(curr);
      curr = curr.parentId ? catMap.get(curr.parentId) : curr.parent;
    }

    if (chain.length > 0) r1 = chain[0]?.name || "—";
    if (chain.length > 1) r2 = chain[1]?.name || "—";
    if (chain.length > 2) r3 = chain[2]?.name || "—";
    if (chain.length > 3) r4 = chain[3]?.name || "—";

    return { r1, r2, r3, r4 };
  };

  const getExactLocation = (issue) => {
    const item = issue.inventoryItem || items.find((i) => i.id === issue.inventoryItemId || i.name?.toLowerCase() === issue.itemName?.toLowerCase());
    if (!item) return "—";
    const parts = [];
    if (item.warehouse && item.warehouse.trim()) parts.push(item.warehouse.trim());
    if (item.location && item.location.trim()) parts.push(item.location.trim());
    return parts.length > 0 ? parts.join(" - ") : "—";
  };

  // Table Root 1-4 filter cascading options
  const tableL1Options = useMemo(() => {
    return categories.filter((c) => (c.level && Number(c.level) === 1) || !c.parentId);
  }, [categories]);

  const tableL2Options = useMemo(() => {
    if (!tableRoot1Filter || tableRoot1Filter === "ALL") return [];
    return categories.filter((c) => c.parentId && String(c.parentId) === String(tableRoot1Filter));
  }, [categories, tableRoot1Filter]);

  const tableL3Options = useMemo(() => {
    if (!tableRoot2Filter || tableRoot2Filter === "ALL") return [];
    return categories.filter((c) => c.parentId && String(c.parentId) === String(tableRoot2Filter));
  }, [categories, tableRoot2Filter]);

  const tableL4Options = useMemo(() => {
    if (!tableRoot3Filter || tableRoot3Filter === "ALL") return [];
    return categories.filter((c) => c.parentId && String(c.parentId) === String(tableRoot3Filter));
  }, [categories, tableRoot3Filter]);

  const filteredIssues = useMemo(() => {
    // Deepest active filter category for table
    const tableActiveCatId =
      tableRoot4Filter !== "ALL"
        ? tableRoot4Filter
        : tableRoot3Filter !== "ALL"
        ? tableRoot3Filter
        : tableRoot2Filter !== "ALL"
        ? tableRoot2Filter
        : tableRoot1Filter !== "ALL"
        ? tableRoot1Filter
        : null;

    return issues.filter((issue) => {
      const q = search.toLowerCase();
      const personName = (issue.issuedToPerson || issue.assignedToPerson || "").toLowerCase();
      const companyName = (issue.issuedToCompany || issue.companyName || issue.projectName || "").toLowerCase();
      const itemName = (issue.itemName || "").toLowerCase();
      const roots = getItemRoots(issue);
      const matchesSearch =
        !search ||
        itemName.includes(q) ||
        personName.includes(q) ||
        companyName.includes(q) ||
        roots.r1.toLowerCase().includes(q) ||
        roots.r2.toLowerCase().includes(q) ||
        roots.r3.toLowerCase().includes(q) ||
        roots.r4.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "ALL" || issue.status === statusFilter;

      let matchesHierarchy = true;
      if (tableActiveCatId) {
        const item = issue.inventoryItem || items.find((i) => i.id === issue.inventoryItemId || i.name?.toLowerCase() === issue.itemName?.toLowerCase());
        matchesHierarchy = item ? isItemInCategoryId(item, tableActiveCatId, categories) : false;
      }

      return matchesSearch && matchesStatus && matchesHierarchy;
    });
  }, [issues, search, statusFilter, tableRoot1Filter, tableRoot2Filter, tableRoot3Filter, tableRoot4Filter, items, categories, catMap]);

  // Cascading options for Modal hierarchy selector
  const modalL1Options = useMemo(() => {
    return categories.filter((c) => (c.level && Number(c.level) === 1) || !c.parentId);
  }, [categories]);

  const modalL2Options = useMemo(() => {
    if (!form.level1Id || form.level1Id === "ALL") return [];
    return categories.filter((c) => c.parentId && String(c.parentId) === String(form.level1Id));
  }, [categories, form.level1Id]);

  const modalL3Options = useMemo(() => {
    if (!form.level2Id || form.level2Id === "ALL") return [];
    return categories.filter((c) => c.parentId && String(c.parentId) === String(form.level2Id));
  }, [categories, form.level2Id]);

  const modalL4Options = useMemo(() => {
    if (!form.level3Id || form.level3Id === "ALL") return [];
    return categories.filter((c) => c.parentId && String(c.parentId) === String(form.level3Id));
  }, [categories, form.level3Id]);

  // Check if user has reached the final/leaf level for the chosen path
  const isAllRootSelected = useMemo(() => {
    // Level 1 must be selected
    if (!form.level1Id || form.level1Id === "ALL") return false;

    // If level 1 has subcategories, level 2 must be selected
    if (modalL2Options.length > 0) {
      if (!form.level2Id || form.level2Id === "ALL") return false;

      // If level 2 has subcategories, level 3 must be selected
      if (modalL3Options.length > 0) {
        if (!form.level3Id || form.level3Id === "ALL") return false;

        // If level 3 has subcategories, level 4 must be selected
        if (modalL4Options.length > 0) {
          if (!form.level4Id || form.level4Id === "ALL") return false;
        }
      }
    }

    return true;
  }, [form.level1Id, form.level2Id, form.level3Id, form.level4Id, modalL2Options, modalL3Options, modalL4Options]);

  // Deepest selected category ID in modal
  const modalActiveCategoryId = useMemo(() => {
    if (form.level4Id && form.level4Id !== "ALL") return form.level4Id;
    if (form.level3Id && form.level3Id !== "ALL") return form.level3Id;
    if (form.level2Id && form.level2Id !== "ALL") return form.level2Id;
    if (form.level1Id && form.level1Id !== "ALL") return form.level1Id;
    return null;
  }, [form.level1Id, form.level2Id, form.level3Id, form.level4Id]);

  // Filter items matching the modal hierarchy and search term
  // Only show items when the full root hierarchy for the branch has been selected
  const modalFilteredItems = useMemo(() => {
    // Only show items when user has selected all root levels in the branch (or typed search query)
    if (!isAllRootSelected && !modalSearchItem.trim()) {
      return [];
    }

    let result = items;

    if (modalActiveCategoryId) {
      result = result.filter((it) => isItemInCategoryId(it, modalActiveCategoryId, categories));
    }

    if (modalSearchItem.trim()) {
      const q = modalSearchItem.toLowerCase().trim();
      result = result.filter((it) => {
        const name = (it.name || "").toLowerCase();
        const code = (it.code || it.sku || "").toLowerCase();
        const loc = (it.warehouse || it.location || "").toLowerCase();
        return name.includes(q) || code.includes(q) || loc.includes(q);
      });
    }

    return result;
  }, [items, categories, isAllRootSelected, modalActiveCategoryId, modalSearchItem]);

  // Summary Metrics
  const totalQuantityOut = issues.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
  const activeIssuedCount = issues.filter((i) => i.status === "ISSUED").reduce((acc, curr) => acc + (curr.quantity || 0), 0);
  const returnedCount = issues.filter((i) => i.status === "RETURNED").reduce((acc, curr) => acc + (curr.quantity || 0), 0);
  const consumedCount = issues.filter((i) => i.status === "CONSUMED").reduce((acc, curr) => acc + (curr.quantity || 0), 0);

  // ─── Export to Excel (.csv) ────────────────────────────────────────────────
  const handleExportExcel = () => {
    if (!filteredIssues || filteredIssues.length === 0) {
      toast.error("No material outward records available to export.");
      return;
    }

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = [
      "S.No",
      "Root 1",
      "Root 2",
      "Root 3",
      "Root 4",
      "Item Name",
      "Issued Qty",
      "Issued To (Person)",
      "Project / Company",
      "Status",
      "Location",
      "Issue Date",
      "Notes",
    ];

    const rows = filteredIssues.map((issue, idx) => {
      const roots = getItemRoots(issue);
      const personName = issue.issuedToPerson || issue.assignedToPerson || "—";
      const companyName = issue.issuedToCompany || issue.companyName || issue.projectName || "—";
      const dateStr = issue.issueDate
        ? new Date(issue.issueDate).toLocaleDateString("en-IN")
        : new Date(issue.createdAt).toLocaleDateString("en-IN");

      return [
        idx + 1,
        escapeCsv(roots.r1),
        escapeCsv(roots.r2),
        escapeCsv(roots.r3),
        escapeCsv(roots.r4),
        escapeCsv(issue.itemName),
        issue.quantity || 1,
        escapeCsv(personName),
        escapeCsv(companyName),
        escapeCsv(issue.status),
        escapeCsv(getExactLocation(issue)),
        escapeCsv(dateStr),
        escapeCsv(issue.notes || "—"),
      ].join(",");
    });

    const totalUnits = filteredIssues.reduce((acc, i) => acc + Number(i.quantity || 0), 0);
    const totalRow = [
      "",
      "",
      "",
      "",
      "",
      '"TOTAL QUANTITY OUT:"',
      totalUnits,
      '""',
      '""',
      '""',
      '""',
      '""',
      '""',
    ].join(",");

    const csvContent =
      "\uFEFF" +
      `"TECHWARE AUTOMATION — MATERIAL OUTWARD (INVENTORY OUT) REPORT"\r\n` +
      `"Total Records:","${filteredIssues.length}"\r\n` +
      `"Total Quantity Out:","${totalUnits}"\r\n` +
      `"Filter:","${statusFilter}"\r\n` +
      `"Export Date:","${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}"\r\n\r\n` +
      [headers.join(","), ...rows, totalRow].join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Inventory_Outward_${statusFilter}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Material Outward exported to Excel successfully!");
  };

  // ─── Export to PDF (Print View) ────────────────────────────────────────────
  const handleExportPDF = () => {
    if (!filteredIssues || filteredIssues.length === 0) {
      toast.error("No material outward records available to export.");
      return;
    }

    const printWin = window.open("", "_blank", "width=1200,height=850");
    if (!printWin) {
      toast.error("Popup blocked! Please allow popups to download or print PDF.");
      return;
    }

    const totalUnits = filteredIssues.reduce((acc, i) => acc + Number(i.quantity || 0), 0);

    const tableRowsHtml = filteredIssues
      .map((issue, idx) => {
        const roots = getItemRoots(issue);
        const personName = issue.issuedToPerson || issue.assignedToPerson || "—";
        const companyName = issue.issuedToCompany || issue.companyName || issue.projectName || "—";
        const exactLoc = getExactLocation(issue);
        const dateStr = issue.issueDate
          ? new Date(issue.issueDate).toLocaleDateString("en-IN")
          : new Date(issue.createdAt).toLocaleDateString("en-IN");

        const statusBg =
          issue.status === "RETURNED"
            ? "#d1fae5"
            : issue.status === "ISSUED"
            ? "#fef3c7"
            : issue.status === "CONSUMED"
            ? "#e0e7ff"
            : "#fee2e2";
        const statusColor =
          issue.status === "RETURNED"
            ? "#065f46"
            : issue.status === "ISSUED"
            ? "#92400e"
            : issue.status === "CONSUMED"
            ? "#3730a3"
            : "#991b1b";

        return `
          <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
            <td style="padding: 7px 8px; text-align: center; color: #64748b; font-weight: bold;">${idx + 1}</td>
            <td style="padding: 7px 8px; font-weight: 600; color: #1e293b;">${roots.r1}</td>
            <td style="padding: 7px 8px; color: #475569;">${roots.r2}</td>
            <td style="padding: 7px 8px; color: #475569;">${roots.r3}</td>
            <td style="padding: 7px 8px; color: #475569;">${roots.r4}</td>
            <td style="padding: 7px 8px; font-weight: bold; color: #0f172a;">${issue.itemName}</td>
            <td style="padding: 7px 8px; text-align: center; font-weight: bold; color: #d97706;">${issue.quantity || 1}</td>
            <td style="padding: 7px 8px; color: #4338ca; font-weight: 600;">${personName}</td>
            <td style="padding: 7px 8px; color: #334155;">${companyName}</td>
            <td style="padding: 7px 8px; text-align: center;">
              <span style="display: inline-block; padding: 2px 7px; border-radius: 9999px; font-weight: bold; font-size: 9px; background: ${statusBg}; color: ${statusColor};">
                ${issue.status}
              </span>
            </td>
            <td style="padding: 7px 8px; font-size: 10px; color: #64748b;">${exactLoc}</td>
            <td style="padding: 7px 8px; text-align: center; color: #64748b; white-space: nowrap;">${dateStr}</td>
          </tr>
        `;
      })
      .join("");

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Material Outward Report - Techware Automation (INDIA)</title>
          <style>
            @page { size: landscape; margin: 12mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 15px; color: #1e293b; background: #fff; }
            .header-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
            .report-title { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0; }
            .report-sub { font-size: 11px; color: #64748b; margin-top: 2px; }
            .badge-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px 12px; display: inline-block; font-size: 11px; font-weight: bold; margin-bottom: 10px; }
            table.data { width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; }
            table.data th { background: #f1f5f9; padding: 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; border-bottom: 2px solid #cbd5e1; }
            .footer { margin-top: 15px; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 8px; }
            @media print {
              .no-print { display: none; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom: 15px; display: flex; gap: 10px;">
            <button onclick="window.print()" style="padding: 8px 16px; background: #d97706; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">
              🖨️ Print / Save as PDF
            </button>
            <button onclick="window.close()" style="padding: 8px 16px; background: #64748b; color: white; border: none; border-radius: 6px; cursor: pointer;">
              Close
            </button>
          </div>

          <table class="header-table">
            <tr>
              <td style="vertical-align: middle;">
                <h1 class="report-title">TECHWARE AUTOMATION INDIA</h1>
                <p class="report-sub">Material Outward Register & Dispatches (Sub-module 2: Inventory Out)</p>
              </td>
              <td style="text-align: right; vertical-align: middle; font-size: 11px; color: #64748b;">
                <strong>Generated On:</strong> ${new Date().toLocaleDateString("en-IN")} ${new Date().toLocaleTimeString("en-IN")}<br/>
                <strong>Filter Status:</strong> ${statusFilter} | <strong>Total Dispatches:</strong> ${filteredIssues.length} | <strong>Total Units:</strong> ${totalUnits}
              </td>
            </tr>
          </table>

          <table class="data">
            <thead>
              <tr>
                <th style="width: 35px; text-align: center;">S.No</th>
                <th style="text-align: left;">Root 1</th>
                <th style="text-align: left;">Root 2</th>
                <th style="text-align: left;">Root 3</th>
                <th style="text-align: left;">Root 4</th>
                <th style="text-align: left;">Item Name</th>
                <th style="width: 55px; text-align: center;">Qty</th>
                <th style="text-align: left;">Issued To (Person)</th>
                <th style="text-align: left;">Project / Company</th>
                <th style="width: 75px; text-align: center;">Status</th>
                <th style="text-align: left;">Location</th>
                <th style="width: 75px; text-align: center;">Issue Date</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
            <tfoot>
              <tr style="background: #f8fafc; font-weight: bold; border-top: 2px solid #cbd5e1; font-size: 11px;">
                <td colspan="6" style="padding: 8px; text-align: right; color: #0f172a;">TOTAL QUANTITY OUT:</td>
                <td style="padding: 8px; text-align: center; color: #d97706; font-size: 12px;">${totalUnits}</td>
                <td colspan="5" style="padding: 8px;"></td>
              </tr>
            </tfoot>
          </table>

          <div class="footer">
            <span>Techware Automation — Confidential Inventory System</span>
            <span>Printed by Authorized User</span>
          </div>
        </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(htmlContent);
    printWin.document.close();
  };

  return (
    <div className="space-y-6">
      {/* ─── Assigned Access Personnel & Active Operator Bar (Admin Only) ─── */}
      {internalCurrentUser?.role === "ADMIN" && (
        <div className="flex items-center justify-between flex-wrap gap-3 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/25 rounded-2xl p-3 px-4.5 text-xs card-shadow">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span>Assigned Module Access (Inventory Out):</span>
            </div>
            {internalAssignedUsers.length > 0 ? (
              internalAssignedUsers.map((u) => (
                <span
                  key={u.id}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-200 font-semibold text-xs border border-amber-500/30"
                >
                  <User className="h-3 w-3" />
                  {u.fullName} {u.role === "ADMIN" ? "(Admin)" : ""}
                </span>
              ))
            ) : (
              <span className="text-muted-foreground italic">Admin Only</span>
            )}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span>Operator:</span>
            <strong className="text-foreground">{internalCurrentUser.fullName}</strong>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary uppercase font-semibold text-muted-foreground">
              {internalCurrentUser.role}
            </span>
          </div>
        </div>
      )}

      {/* ─── Top Header & Primary Action Buttons ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-start sm:items-center gap-3">
          <button
            type="button"
            onClick={onBackToHub}
            className="p-2.5 rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0 shadow-2xs"
            title="Back to Inventory Submodules"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 shadow-xs">
            <PackageMinus className="h-5.5 w-5.5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground truncate">
              Material Outward (Inventory Out)
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Track material dispatches, project equipment issuances, and restock returns with Root 1–4 classification.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2.5 rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50 shrink-0 shadow-2xs cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-primary" : ""}`} />
          </button>

          {/* Export Excel (CSV) */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs sm:text-sm font-semibold text-white shadow-xs hover:shadow-sm transition-all cursor-pointer whitespace-nowrap"
            title="Export outward register to Excel (CSV) with Root 1, 2, 3, 4"
          >
            <Download className="h-4 w-4 shrink-0" />
            <span>Export Excel</span>
          </button>

          {/* Export PDF */}
          <button
            type="button"
            onClick={handleExportPDF}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs sm:text-sm font-semibold text-white shadow-xs hover:shadow-sm transition-all cursor-pointer whitespace-nowrap"
            title="Print or Download Outward Report (PDF) with Root 1, 2, 3, 4"
          >
            <FileText className="h-4 w-4 shrink-0" />
            <span>Export PDF</span>
          </button>

          {/* Issue Material / Stock Out Button */}
          {canCreate && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm hover:shadow transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span>Issue Material</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── Modern Key Stat Metric Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Quantity Out */}
        <div className="p-4.5 rounded-2xl border border-border/80 bg-background hover:bg-card card-shadow transition-all flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
            <Boxes className="h-5.5 w-5.5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block truncate">
              Total Qty Out
            </span>
            <span className="text-xl sm:text-2xl font-bold text-foreground">
              {totalQuantityOut} <span className="text-xs font-normal text-muted-foreground">Units</span>
            </span>
          </div>
        </div>

        {/* Active Issued */}
        <div className="p-4.5 rounded-2xl border border-border/80 bg-background hover:bg-card card-shadow transition-all flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Clock className="h-5.5 w-5.5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block truncate">
              Active Outward
            </span>
            <span className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400">
              {activeIssuedCount} <span className="text-xs font-normal text-muted-foreground">Issued</span>
            </span>
          </div>
        </div>

        {/* Restocked / Returned */}
        <div className="p-4.5 rounded-2xl border border-border/80 bg-background hover:bg-card card-shadow transition-all flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5.5 w-5.5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block truncate">
              Returned &amp; Restocked
            </span>
            <span className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {returnedCount} <span className="text-xs font-normal text-muted-foreground">Units</span>
            </span>
          </div>
        </div>

        {/* Consumed / Used */}
        <div className="p-4.5 rounded-2xl border border-border/80 bg-background hover:bg-card card-shadow transition-all flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
            <PackageMinus className="h-5.5 w-5.5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider block truncate">
              Consumed / Scrapped
            </span>
            <span className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {consumedCount} <span className="text-xs font-normal text-muted-foreground">Units</span>
            </span>
          </div>
        </div>
      </div>

      {/* ─── Search & Status Filter Bar + Hierarchy Root Filters ─── */}
      <div className="space-y-3 bg-background p-4 rounded-2xl border border-border card-shadow">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by item name, Root 1-4, person, or project..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-secondary/35 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mr-1">
              <Filter className="h-3.5 w-3.5" />
              <span>Status:</span>
            </span>
            {["ALL", "ISSUED", "RETURNED", "CONSUMED", "DAMAGED"].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  statusFilter === status
                    ? "bg-primary text-white shadow-xs"
                    : "bg-secondary/40 border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Root 1, 2, 3, 4 Filter Row for the Outward Log Table */}
        <div className="pt-2 border-t border-border/60 flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground mr-1">
            <Folder className="h-3.5 w-3.5 text-primary" />
            <span>Hierarchy Filter:</span>
          </div>

          {/* Root 1 */}
          <select
            value={tableRoot1Filter}
            onChange={(e) => {
              setTableRoot1Filter(e.target.value);
              setTableRoot2Filter("ALL");
              setTableRoot3Filter("ALL");
              setTableRoot4Filter("ALL");
            }}
            className="px-2.5 py-1.5 bg-secondary/35 border border-border rounded-lg text-xs font-medium focus:ring-2 focus:ring-primary/20 text-foreground"
          >
            <option value="ALL">All Root 1</option>
            {tableL1Options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Root 2 */}
          <select
            value={tableRoot2Filter}
            onChange={(e) => {
              setTableRoot2Filter(e.target.value);
              setTableRoot3Filter("ALL");
              setTableRoot4Filter("ALL");
            }}
            disabled={tableRoot1Filter === "ALL" || tableL2Options.length === 0}
            className="px-2.5 py-1.5 bg-secondary/35 border border-border rounded-lg text-xs font-medium focus:ring-2 focus:ring-primary/20 text-foreground disabled:opacity-50"
          >
            <option value="ALL">
              {tableRoot1Filter === "ALL" ? "Root 2 (Select Root 1)" : tableL2Options.length === 0 ? "No Sub-folders" : "All Root 2"}
            </option>
            {tableL2Options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Root 3 */}
          <select
            value={tableRoot3Filter}
            onChange={(e) => {
              setTableRoot3Filter(e.target.value);
              setTableRoot4Filter("ALL");
            }}
            disabled={tableRoot2Filter === "ALL" || tableL3Options.length === 0}
            className="px-2.5 py-1.5 bg-secondary/35 border border-border rounded-lg text-xs font-medium focus:ring-2 focus:ring-primary/20 text-foreground disabled:opacity-50"
          >
            <option value="ALL">
              {tableRoot2Filter === "ALL" ? "Root 3 (Select Root 2)" : tableL3Options.length === 0 ? "No Sub-folders" : "All Root 3"}
            </option>
            {tableL3Options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Root 4 */}
          <select
            value={tableRoot4Filter}
            onChange={(e) => setTableRoot4Filter(e.target.value)}
            disabled={tableRoot3Filter === "ALL" || tableL4Options.length === 0}
            className="px-2.5 py-1.5 bg-secondary/35 border border-border rounded-lg text-xs font-medium focus:ring-2 focus:ring-primary/20 text-foreground disabled:opacity-50"
          >
            <option value="ALL">
              {tableRoot3Filter === "ALL" ? "Root 4 (Select Root 3)" : tableL4Options.length === 0 ? "No Sub-folders" : "All Root 4"}
            </option>
            {tableL4Options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {(tableRoot1Filter !== "ALL" || tableRoot2Filter !== "ALL" || tableRoot3Filter !== "ALL" || tableRoot4Filter !== "ALL") && (
            <button
              type="button"
              onClick={() => {
                setTableRoot1Filter("ALL");
                setTableRoot2Filter("ALL");
                setTableRoot3Filter("ALL");
                setTableRoot4Filter("ALL");
              }}
              className="text-xs text-rose-500 hover:text-rose-700 font-semibold cursor-pointer ml-1"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* ─── Redesigned Outward Table with Root 1, 2, 3, 4 Hierarchy ─── */}
      <div className="rounded-2xl border border-border bg-background card-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-secondary/35 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                <th className="p-3.5 pl-4 text-center w-12">S.No</th>
                <th className="p-3.5">Hierarchy (Root 1 › Root 2 › Root 3 › Root 4)</th>
                <th className="p-3.5">Item &amp; Qty</th>
                <th className="p-3.5">Issued To (Person)</th>
                <th className="p-3.5">Project / Company</th>
                <th className="p-3.5">Location</th>
                <th className="p-3.5">Issue Date</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {loading ? (
                <tr>
                  <td colSpan="9" className="p-10 text-center text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                    <span>Loading material outward logs...</span>
                  </td>
                </tr>
              ) : filteredIssues.length === 0 ? (
                <tr>
                  <td colSpan="9" className="p-12 text-center text-muted-foreground">
                    <PackageMinus className="h-8 w-8 mx-auto mb-2 opacity-30 text-muted-foreground" />
                    <p className="font-semibold text-foreground text-sm">No material outward records found.</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {search ? "No records match your query." : "Click '+ Issue Material' to record your first outward dispatch."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredIssues.map((issue, idx) => {
                  const roots = getItemRoots(issue);
                  const personName = issue.issuedToPerson || issue.assignedToPerson || "—";
                  const companyName = issue.issuedToCompany || issue.companyName || issue.projectName || "—";
                  const exactLoc = getExactLocation(issue);
                  const invItem = issue.inventoryItem || items.find((i) => i.id === issue.inventoryItemId || i.name?.toLowerCase() === issue.itemName?.toLowerCase());

                  return (
                    <tr key={issue.id} className="hover:bg-secondary/25 transition-colors group">
                      {/* S.No */}
                      <td className="p-3.5 pl-4 text-center text-xs font-semibold text-muted-foreground">
                        {idx + 1}
                      </td>

                      {/* Hierarchy Root 1, 2, 3, 4 */}
                      <td className="p-3.5 max-w-xs">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 truncate max-w-[110px]" title={roots.r1}>
                            {roots.r1}
                          </span>
                          {roots.r2 !== "—" && (
                            <>
                              <span className="text-muted-foreground text-[10px]">›</span>
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 truncate max-w-[110px]" title={roots.r2}>
                                {roots.r2}
                              </span>
                            </>
                          )}
                          {roots.r3 !== "—" && (
                            <>
                              <span className="text-muted-foreground text-[10px]">›</span>
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 truncate max-w-[110px]" title={roots.r3}>
                                {roots.r3}
                              </span>
                            </>
                          )}
                          {roots.r4 !== "—" && (
                            <>
                              <span className="text-muted-foreground text-[10px]">›</span>
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 truncate max-w-[110px]" title={roots.r4}>
                                {roots.r4}
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Item & Quantity */}
                      <td className="p-3.5 font-semibold text-foreground">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center justify-center shrink-0">
                            {invItem?.photoUrl || invItem?.img ? (
                              <img
                                src={resolveImageUrl(invItem.photoUrl || invItem.img)}
                                alt=""
                                className="w-full h-full object-contain rounded-xl p-0.5"
                                onError={(e) => { e.currentTarget.style.display = "none"; }}
                              />
                            ) : (
                              <PackageMinus className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-foreground text-sm line-clamp-1">{issue.itemName}</div>
                            <div className="text-[11px] font-medium text-muted-foreground">
                              Qty: <strong className="text-amber-600 dark:text-amber-400 font-bold">{issue.quantity}</strong> {invItem?.unit || "Nos"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Issued To (Person) */}
                      <td className="p-3.5">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-300 font-bold text-xs border border-violet-500/20 shadow-2xs">
                          <User className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
                          <span className="capitalize">{personName}</span>
                        </span>
                      </td>

                      {/* Project / Company */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate max-w-[140px]">{companyName}</span>
                        </div>
                      </td>

                      {/* Location */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground max-w-[130px] truncate" title={exactLoc}>
                          <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="truncate">{exactLoc}</span>
                        </div>
                      </td>

                      {/* Issue Date */}
                      <td className="p-3.5 text-xs text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span>
                            {issue.issueDate
                              ? new Date(issue.issueDate).toLocaleDateString("en-IN")
                              : new Date(issue.createdAt).toLocaleDateString("en-IN")}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-3.5 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                            issue.status === "ISSUED"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                              : issue.status === "RETURNED"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                              : issue.status === "CONSUMED"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border-blue-300 dark:border-blue-800"
                              : "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border-rose-300 dark:border-rose-800"
                          }`}
                        >
                          {issue.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 pr-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewDetailsModal(issue)}
                            className="p-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors cursor-pointer shadow-2xs"
                            title="Quick View Details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

                          {canEdit && issue.status === "ISSUED" && (
                            <button
                              type="button"
                              onClick={() => handleReturn(issue.id)}
                              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                              title="Mark Returned & Restock"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              <span>Return</span>
                            </button>
                          )}

                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => handleDelete(issue.id)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                              title="Delete record"
                            >
                              <Trash2 className="h-4 w-4" />
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

      {/* ─── Modal: Quick View Outward Record ─── */}
      {viewDetailsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground border border-border rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-border bg-secondary/20">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 flex items-center justify-center">
                  <PackageMinus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">Outward Dispatch Details</h3>
                  <p className="text-xs text-muted-foreground">ID: {viewDetailsModal.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewDetailsModal(null)}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-sm">
              <div className="p-3.5 rounded-xl bg-secondary/35 border border-border/80">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Item Name
                </span>
                <span className="font-bold text-lg text-foreground">{viewDetailsModal.itemName}</span>
                <div className="text-xs text-muted-foreground mt-1">
                  Quantity Dispatched: <strong className="text-amber-600 dark:text-amber-400 font-bold">{viewDetailsModal.quantity}</strong>
                </div>
              </div>

              {/* Hierarchy */}
              <div className="p-3 rounded-xl bg-secondary/20 border border-border">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                  <Layers className="h-3.5 w-3.5 text-primary" /> Hierarchy Classification
                </span>
                {(() => {
                  const roots = getItemRoots(viewDetailsModal);
                  return (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded font-semibold text-xs bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                        L1: {roots.r1}
                      </span>
                      {roots.r2 !== "—" && (
                        <>
                          <span className="text-muted-foreground font-bold">›</span>
                          <span className="px-2 py-0.5 rounded font-semibold text-xs bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                            L2: {roots.r2}
                          </span>
                        </>
                      )}
                      {roots.r3 !== "—" && (
                        <>
                          <span className="text-muted-foreground font-bold">›</span>
                          <span className="px-2 py-0.5 rounded font-semibold text-xs bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                            L3: {roots.r3}
                          </span>
                        </>
                      )}
                      {roots.r4 !== "—" && (
                        <>
                          <span className="text-muted-foreground font-bold">›</span>
                          <span className="px-2 py-0.5 rounded font-semibold text-xs bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                            L4: {roots.r4}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-secondary/20 border border-border">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Issued To (Person)</span>
                  <span className="font-semibold text-foreground text-sm mt-0.5 block">{viewDetailsModal.issuedToPerson || viewDetailsModal.assignedToPerson || "—"}</span>
                </div>
                <div className="p-3 rounded-xl bg-secondary/20 border border-border">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Project / Company</span>
                  <span className="font-semibold text-foreground text-sm mt-0.5 block">{viewDetailsModal.issuedToCompany || viewDetailsModal.companyName || viewDetailsModal.projectName || "—"}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-secondary/20 border border-border">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Storage Location</span>
                  <span className="font-semibold text-foreground text-xs mt-0.5 block flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>{getExactLocation(viewDetailsModal)}</span>
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-secondary/20 border border-border">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Issue Date</span>
                  <span className="font-semibold text-foreground text-xs mt-0.5 block flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span>
                      {viewDetailsModal.issueDate
                        ? new Date(viewDetailsModal.issueDate).toLocaleDateString("en-IN")
                        : new Date(viewDetailsModal.createdAt).toLocaleDateString("en-IN")}
                    </span>
                  </span>
                </div>
              </div>

              {viewDetailsModal.notes && (
                <div className="p-3 rounded-xl bg-secondary/20 border border-border">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Notes / Requisition Reference</span>
                  <p className="text-xs text-foreground mt-1 whitespace-pre-wrap">{viewDetailsModal.notes}</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border bg-secondary/30 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setViewDetailsModal(null)}
                className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-xs"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Issue Material / Stock Out ─── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground border border-border rounded-2xl shadow-xl max-w-2xl w-full max-h-[92vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-border bg-secondary/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 flex items-center justify-center shadow-2xs">
                  <PackageMinus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">Issue Material / Stock Out</h3>
                  <p className="text-xs text-muted-foreground">Select Root 1, 2, 3, 4 folder to pick registered stock item or enter details</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* ── 4-Level Root Hierarchy Filter (Root 1 -> Root 2 -> Root 3 -> Root 4) ── */}
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/15 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <Folder className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    1. Hierarchy Root Filter (Levels 1 → 4)
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    Filter catalog items by category path
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {/* Root Level 1 */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                      Root 1
                    </label>
                    <select
                      value={form.level1Id || "ALL"}
                      onChange={(e) => handleLevelChange(1, e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs font-semibold focus:ring-2 focus:ring-amber-500/20"
                    >
                      <option value="ALL">-- All Root 1 --</option>
                      {modalL1Options.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Root Level 2 */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                      Root 2
                    </label>
                    <select
                      value={form.level2Id || "ALL"}
                      onChange={(e) => handleLevelChange(2, e.target.value)}
                      disabled={!form.level1Id || form.level1Id === "ALL" || modalL2Options.length === 0}
                      className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs font-semibold focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50"
                    >
                      <option value="ALL">
                        {!form.level1Id || form.level1Id === "ALL"
                          ? "-- Select Root 1 --"
                          : modalL2Options.length === 0
                          ? "-- No Sub-folders --"
                          : "-- All Root 2 --"}
                      </option>
                      {modalL2Options.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Root Level 3 */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                      Root 3
                    </label>
                    <select
                      value={form.level3Id || "ALL"}
                      onChange={(e) => handleLevelChange(3, e.target.value)}
                      disabled={!form.level2Id || form.level2Id === "ALL" || modalL3Options.length === 0}
                      className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs font-semibold focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50"
                    >
                      <option value="ALL">
                        {!form.level2Id || form.level2Id === "ALL"
                          ? "-- Select Root 2 --"
                          : modalL3Options.length === 0
                          ? "-- No Sub-folders --"
                          : "-- All Root 3 --"}
                      </option>
                      {modalL3Options.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Root Level 4 */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                      Root 4
                    </label>
                    <select
                      value={form.level4Id || "ALL"}
                      onChange={(e) => handleLevelChange(4, e.target.value)}
                      disabled={!form.level3Id || form.level3Id === "ALL" || modalL4Options.length === 0}
                      className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs font-semibold focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50"
                    >
                      <option value="ALL">
                        {!form.level3Id || form.level3Id === "ALL"
                          ? "-- Select Root 3 --"
                          : modalL4Options.length === 0
                          ? "-- No Sub-folders --"
                          : "-- All Root 4 --"}
                      </option>
                      {modalL4Options.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 2. Choose Registered Item from Filtered List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-foreground">
                    2. Select Registered Inventory Item{" "}
                    {isAllRootSelected || modalSearchItem.trim() ? (
                      <span className="text-amber-600">({modalFilteredItems.length} matching)</span>
                    ) : (
                      <span className="text-muted-foreground font-normal">(Please select all roots down to the final folder)</span>
                    )}
                  </label>
                  {form.inventoryItemId && (
                    <button
                      type="button"
                      onClick={() => handleItemSelect("")}
                      className="text-[11px] text-rose-500 hover:underline cursor-pointer"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>

                {/* Search in dropdown items */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search by product name, code, SKU or location..."
                    value={modalSearchItem}
                    onChange={(e) => setModalSearchItem(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-background border border-border rounded-xl text-xs placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <select
                  value={form.inventoryItemId}
                  onChange={(e) => handleItemSelect(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                  size={modalFilteredItems.length > 5 ? 5 : Math.max(2, modalFilteredItems.length + 1)}
                >
                  <option value="">
                    {!isAllRootSelected && !modalSearchItem.trim()
                      ? "-- Please select all root levels to view items --"
                      : modalFilteredItems.length === 0
                      ? "-- No registered items found in this category --"
                      : "-- Choose registered item or enter manually below --"}
                  </option>
                  {modalFilteredItems.map((item) => (
                    <option key={item.id} value={item.id} className="py-1">
                      {item.name} {item.code ? `(${item.code})` : ""} | Available Stock: {item.quantity} {item.unit || "Nos"} | Loc: {item.warehouse || item.location || "Default"}
                    </option>
                  ))}
                </select>
                {!isAllRootSelected && !modalSearchItem.trim() && (
                  <p className="text-[11px] text-muted-foreground italic">
                    Select Root 1, Root 2, Root 3, Root 4 (all available child folders) to reveal registered items, or search directly.
                  </p>
                )}
              </div>

              {/* Item Name (auto-filled or manual) */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter item name"
                  value={form.itemName}
                  onChange={(e) => setForm((prev) => ({ ...prev, itemName: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Issued To Person */}
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Issued To (Person) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Employee name"
                    value={form.issuedToPerson}
                    onChange={(e) => setForm((prev) => ({ ...prev, issuedToPerson: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* Company / Project */}
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Project / Company *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Project or company name"
                    value={form.issuedToCompany}
                    onChange={(e) => setForm((prev) => ({ ...prev, issuedToCompany: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Quantity */}
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={form.quantity}
                    onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* Issue Date */}
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Issue Date
                  </label>
                  <input
                    type="date"
                    value={form.issueDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, issueDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                >
                  <option value="ISSUED">ISSUED (Active Outward)</option>
                  <option value="RETURNED">RETURNED (Restocked)</option>
                  <option value="CONSUMED">CONSUMED (Used up)</option>
                  <option value="DAMAGED">DAMAGED (Scrapped)</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Notes / Requisition Reference
                </label>
                <textarea
                  rows="2"
                  placeholder="Optional details or reference note..."
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2 border border-border bg-background hover:bg-secondary text-sm font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl shadow-sm disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {submitting ? "Issuing..." : "Confirm Issue Material"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
