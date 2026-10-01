import { useState, useEffect } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import {
  Package, Plus, Search, RefreshCw, Loader2, X,
  Edit3, Trash2, AlertTriangle, ArrowUpDown, ArrowLeft, ArrowRight,
  PackagePlus, PackageMinus, Box, Boxes,
  ChevronDown, Calendar, Building, UserCheck, Send, RotateCcw, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPut, apiDelete } from "../../lib/api.js";

// ── helpers ──────────────────────────────────────────────────────────
const inputClass =
  "w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow";

const fmtDate = (d) => {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const toInputDate = (d) => {
  if (!d) return "";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
};

const CATEGORIES = [
  "Electronics", "Furniture", "Office Supplies", "IT Equipment",
  "Tools & Hardware", "Safety Equipment", "Cleaning Supplies",
  "Raw Materials", "Packaging", "Other",
];

// ═══════════════════════════════════════════════════════════════════════
// Sub-page: Inventory Items Table
// ═══════════════════════════════════════════════════════════════════════
const InventoryTable = ({ items, filterMode, onEdit, onDelete }) => {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  let filtered = items;

  if (filterMode === "LOW") {
    filtered = filtered.filter((i) => i.quantity > 0 && i.quantity <= (i.minStock || 5));
  } else if (filterMode === "OUT") {
    filtered = filtered.filter((i) => i.quantity === 0);
  }

  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (i) =>
        (i.name || "").toLowerCase().includes(q) ||
        (i.sku || "").toLowerCase().includes(q) ||
        (i.category || "").toLowerCase().includes(q) ||
        (i.location || "").toLowerCase().includes(q) ||
        (i.companyName || "").toLowerCase().includes(q)
    );
  }

  filtered = [...filtered].sort((a, b) => {
    let aVal = a[sortField] ?? "";
    let bVal = b[sortField] ?? "";
    if (typeof aVal === "string") aVal = aVal.toLowerCase();
    if (typeof bVal === "string") bVal = bVal.toLowerCase();
    if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const toggleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  return (
    <div className="space-y-5">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search items, company, SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputClass} pl-10`}
        />
      </div>

      <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <Box className="h-10 w-10 mx-auto mb-3 opacity-30 text-muted-foreground" />
            No items found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border bg-secondary/40">
                  <th className="px-5 py-3.5 font-semibold cursor-pointer" onClick={() => toggleSort("name")}>
                    <span className="inline-flex items-center gap-1">Item Name <ArrowUpDown className="h-3 w-3 opacity-40" /></span>
                  </th>
                  <th className="px-5 py-3.5 font-semibold">SKU</th>
                  <th className="px-5 py-3.5 font-semibold cursor-pointer" onClick={() => toggleSort("companyName")}>
                    <span className="inline-flex items-center gap-1">Company <ArrowUpDown className="h-3 w-3 opacity-40" /></span>
                  </th>
                  <th className="px-5 py-3.5 font-semibold cursor-pointer" onClick={() => toggleSort("category")}>
                    <span className="inline-flex items-center gap-1">Category <ArrowUpDown className="h-3 w-3 opacity-40" /></span>
                  </th>
                  <th className="px-5 py-3.5 font-semibold cursor-pointer" onClick={() => toggleSort("date")}>
                    <span className="inline-flex items-center gap-1">Date <ArrowUpDown className="h-3 w-3 opacity-40" /></span>
                  </th>
                  <th className="px-5 py-3.5 font-semibold cursor-pointer" onClick={() => toggleSort("quantity")}>
                    <span className="inline-flex items-center gap-1">Qty <ArrowUpDown className="h-3 w-3 opacity-40" /></span>
                  </th>
                  <th className="px-5 py-3.5 font-semibold">Min Stock</th>
                  <th className="px-5 py-3.5 font-semibold">Unit</th>
                  <th className="px-5 py-3.5 font-semibold">Location</th>
                  <th className="px-5 py-3.5 font-semibold">Status</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((item) => {
                  const isOut = item.quantity === 0;
                  const isLow = !isOut && item.quantity <= (item.minStock || 5);
                  return (
                    <tr key={item.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-5 py-4 font-semibold whitespace-nowrap">{item.name}</td>
                      <td className="px-5 py-4 text-xs text-muted-foreground font-mono">{item.sku || "—"}</td>
                      <td className="px-5 py-4 text-xs font-medium text-foreground whitespace-nowrap">{item.companyName || "—"}</td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-secondary text-foreground border border-border">
                          {item.category || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(item.date || item.createdAt)}</td>
                      <td className="px-5 py-4 font-bold whitespace-nowrap">{item.quantity}</td>
                      <td className="px-5 py-4 text-muted-foreground whitespace-nowrap">{item.minStock ?? 5}</td>
                      <td className="px-5 py-4 text-muted-foreground whitespace-nowrap">{item.unit || "pcs"}</td>
                      <td className="px-5 py-4 text-muted-foreground whitespace-nowrap">{item.location || "—"}</td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20">Out of Stock</span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">Low Stock</span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">In Stock</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => onEdit(item)} className="p-1.5 rounded-lg text-muted-foreground hover:text-blue-600 hover:bg-blue-500/10 transition-colors cursor-pointer" title="Edit">
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button onClick={() => onDelete(item)} className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer" title="Delete">
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
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// Sub-page: Issued Products / Allocations Table
// ═══════════════════════════════════════════════════════════════════════
const IssuedItemsTable = ({ issues, onMarkReturn, onDeleteIssue }) => {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");

  let filtered = issues;

  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (i) =>
        (i.itemName || "").toLowerCase().includes(q) ||
        (i.assignedToPerson || "").toLowerCase().includes(q) ||
        (i.companyName || "").toLowerCase().includes(q) ||
        (i.projectName || "").toLowerCase().includes(q) ||
        (i.status || "").toLowerCase().includes(q) ||
        (i.notes || "").toLowerCase().includes(q)
    );
  }

  filtered = [...filtered].sort((a, b) => {
    let aVal = a[sortField] ?? "";
    let bVal = b[sortField] ?? "";
    if (typeof aVal === "string") aVal = aVal.toLowerCase();
    if (typeof bVal === "string") bVal = bVal.toLowerCase();
    if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const toggleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  return (
    <div className="space-y-5">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by product, worker, project, company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputClass} pl-10`}
        />
      </div>

      <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <UserCheck className="h-10 w-10 mx-auto mb-3 opacity-30 text-muted-foreground" />
            No product issue entries found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border bg-secondary/40">
                  <th className="px-5 py-3.5 font-semibold cursor-pointer" onClick={() => toggleSort("itemName")}>
                    <span className="inline-flex items-center gap-1">Product Name <ArrowUpDown className="h-3 w-3 opacity-40" /></span>
                  </th>
                  <th className="px-5 py-3.5 font-semibold cursor-pointer" onClick={() => toggleSort("assignedToPerson")}>
                    <span className="inline-flex items-center gap-1">Worker / Person <ArrowUpDown className="h-3 w-3 opacity-40" /></span>
                  </th>
                  <th className="px-5 py-3.5 font-semibold cursor-pointer" onClick={() => toggleSort("projectName")}>
                    <span className="inline-flex items-center gap-1">Running Project <ArrowUpDown className="h-3 w-3 opacity-40" /></span>
                  </th>
                  <th className="px-5 py-3.5 font-semibold cursor-pointer" onClick={() => toggleSort("companyName")}>
                    <span className="inline-flex items-center gap-1">Company <ArrowUpDown className="h-3 w-3 opacity-40" /></span>
                  </th>
                  <th className="px-5 py-3.5 font-semibold">Qty</th>
                  <th className="px-5 py-3.5 font-semibold cursor-pointer" onClick={() => toggleSort("issueDate")}>
                    <span className="inline-flex items-center gap-1">Issue Date <ArrowUpDown className="h-3 w-3 opacity-40" /></span>
                  </th>
                  <th className="px-5 py-3.5 font-semibold">Status</th>
                  <th className="px-5 py-3.5 font-semibold">Notes</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((item) => {
                  const isReturned = item.status === "RETURNED";
                  return (
                    <tr key={item.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-5 py-4 font-semibold whitespace-nowrap">{item.itemName}</td>
                      <td className="px-5 py-4 font-medium text-foreground whitespace-nowrap">{item.assignedToPerson}</td>
                      <td className="px-5 py-4 text-xs font-medium text-primary whitespace-nowrap">{item.projectName || "—"}</td>
                      <td className="px-5 py-4 text-xs text-muted-foreground whitespace-nowrap">{item.companyName || "—"}</td>
                      <td className="px-5 py-4 font-bold whitespace-nowrap">{item.quantity}</td>
                      <td className="px-5 py-4 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(item.issueDate || item.createdAt)}</td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {isReturned ? (
                          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" /> Returned
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                            <Send className="h-3 w-3" /> Issued
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs text-muted-foreground max-w-xs truncate">{item.notes || "—"}</td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {!isReturned && (
                            <button
                              onClick={() => onMarkReturn(item.id)}
                              className="text-xs px-2.5 py-1 rounded-lg border border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 font-semibold transition-colors cursor-pointer flex items-center gap-1"
                              title="Mark as Returned"
                            >
                              <RotateCcw className="h-3.5 w-3.5" /> Return
                            </button>
                          )}
                          <button
                            onClick={() => onDeleteIssue(item.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Delete Record"
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
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// Main Inventory Component (Hub Page & Submodules)
// ═══════════════════════════════════════════════════════════════════════
const Inventory = ({ defaultTab = "overview" }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const tabQuery = searchParams.get("tab");

  const getInitialTab = () => {
    if (location.pathname.includes("out-stock") || location.pathname.includes("out-of-stock")) return "out-stock";
    if (location.pathname.includes("low-stock")) return "low-stock";
    if (location.pathname.includes("issued")) return "issued";
    if (tabQuery) return tabQuery;
    return defaultTab;
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [items, setItems] = useState([]);
  const [issues, setIssues] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittingIssue, setSubmittingIssue] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (location.pathname.includes("out-stock") || location.pathname.includes("out-of-stock")) {
      setActiveTab("out-stock");
    } else if (location.pathname.includes("low-stock")) {
      setActiveTab("low-stock");
    } else if (location.pathname.includes("issued")) {
      setActiveTab("issued");
    } else if (tabQuery) {
      setActiveTab(tabQuery);
    }
  }, [location.pathname, tabQuery]);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    if (newTab === "overview") {
      searchParams.delete("tab");
      setSearchParams(searchParams);
    } else {
      setSearchParams({ tab: newTab });
    }
  };

  const todayStr = () => new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    name: "", sku: "", category: "", companyName: "", date: todayStr(), quantity: 0, minStock: 5, unit: "pcs", location: "", description: "", costPrice: "",
  });

  const [issueForm, setIssueForm] = useState({
    inventoryItemId: "",
    itemName: "",
    assignedToPerson: "",
    companyName: "",
    projectName: "",
    quantity: 1,
    issueDate: todayStr(),
    notes: "",
  });

  // ── Load items, issues & projects ────────────────────────────────────
  const load = async () => {
    try {
      const [itemsRes, issuesRes, projectsRes] = await Promise.all([
        apiGet("/inventory"),
        apiGet("/inventory/issues/all").catch(() => ({ issues: [] })),
        apiGet("/projects").catch(() => ({ projects: [] })),
      ]);
      setItems(itemsRes.items || []);
      setIssues(issuesRes.issues || []);
      setProjects(projectsRes.projects || []);
    } catch (err) {
      toast.error(err.message || "Failed to load inventory.");
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => { setLoading(true); load(); };
  useEffect(() => { load(); }, []);

  // ── Form handlers ─────────────────────────────────────────────────
  const resetForm = () => {
    setForm({
      name: "", sku: "", category: "", companyName: "",
      date: todayStr(), quantity: 0, minStock: 5, unit: "pcs",
      location: "", description: "", costPrice: "",
    });
    setEditItem(null);
  };

  const resetIssueForm = () => {
    setIssueForm({
      inventoryItemId: "",
      itemName: "",
      assignedToPerson: "",
      companyName: "",
      projectName: "",
      quantity: 1,
      issueDate: todayStr(),
      notes: "",
    });
  };

  const openAdd = () => { resetForm(); setShowForm(true); };
  const openIssueProduct = () => { resetIssueForm(); setShowIssueModal(true); };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({
      name: item.name || "",
      sku: item.sku || "",
      category: item.category || "",
      companyName: item.companyName || "",
      date: item.date ? toInputDate(item.date) : (item.createdAt ? toInputDate(item.createdAt) : todayStr()),
      quantity: item.quantity ?? 0,
      minStock: item.minStock ?? 5,
      unit: item.unit || "pcs",
      location: item.location || "",
      description: item.description || "",
      costPrice: item.costPrice ?? "",
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.name.trim()) { toast.error("Item name is required."); return; }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        quantity: Number(form.quantity) || 0,
        minStock: Number(form.minStock) || 0,
        costPrice: form.costPrice ? Number(form.costPrice) : null,
        date: form.date ? form.date : null,
        companyName: form.companyName ? form.companyName : null,
      };
      if (editItem) {
        await apiPut(`/inventory/${editItem.id}`, payload);
        toast.success("Item updated successfully!");
      } else {
        await apiPost("/inventory", payload);
        toast.success("Item added successfully!");
      }
      setShowForm(false);
      resetForm();
      refresh();
    } catch (err) {
      toast.error(err.message || "Failed to save item.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleIssueSubmit = async (e) => {
    e.preventDefault();
    if (submittingIssue) return;
    if (!issueForm.itemName.trim()) { toast.error("Please enter or select a product."); return; }
    if (!issueForm.assignedToPerson.trim()) { toast.error("Please enter person name."); return; }
    setSubmittingIssue(true);
    try {
      await apiPost("/inventory/issues", {
        ...issueForm,
        quantity: Number(issueForm.quantity) || 1,
      });
      toast.success("Product issued successfully!");
      setShowIssueModal(false);
      resetIssueForm();
      refresh();
    } catch (err) {
      toast.error(err.message || "Failed to issue product.");
    } finally {
      setSubmittingIssue(false);
    }
  };

  const handleMarkReturn = async (issueId) => {
    try {
      await apiPut(`/inventory/issues/${issueId}`, { status: "RETURNED" });
      toast.success("Product marked as returned & stock restored!");
      refresh();
    } catch (err) {
      toast.error(err.message || "Failed to mark item returned.");
    }
  };

  const handleDeleteIssue = async (issueId) => {
    try {
      await apiDelete(`/inventory/issues/${issueId}`);
      toast.success("Issue record deleted.");
      refresh();
    } catch (err) {
      toast.error(err.message || "Failed to delete record.");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await apiDelete(`/inventory/${deleteTarget.id}`);
      toast.success("Item deleted.");
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      toast.error(err.message || "Failed to delete item.");
    } finally {
      setDeleting(false);
    }
  };

  // ── Stats ─────────────────────────────────────────────────────────
  const totalItems = items.length;
  const totalQty = items.reduce((a, i) => a + (i.quantity || 0), 0);
  const lowStockCount = items.filter((i) => i.quantity > 0 && i.quantity <= (i.minStock || 5)).length;
  const outOfStockCount = items.filter((i) => i.quantity === 0).length;
  const issuedCount = issues.filter((i) => i.status === "ISSUED").length;

  // ── Render ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-12 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading inventory…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button for Submodules */}
      {activeTab !== "overview" && (
        <div>
          <button
            type="button"
            onClick={() => handleTabChange("overview")}
            className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border bg-background text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary card-shadow transition-all active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1 text-primary" />
            <span>Back to Inventory Submodules</span>
          </button>
        </div>
      )}

      {/* ─── Overview Page ────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-4 border-b border-border pb-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Package className="h-6 w-6" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold">Inventory & Stock</h1>
                <p className="text-sm text-muted-foreground">Manage company inventory items and product allocations.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={refresh} className="p-2.5 rounded-xl border border-border bg-background hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground cursor-pointer" title="Refresh">
                <RefreshCw className="h-4 w-4" />
              </button>
              <button onClick={openIssueProduct} className="px-4 py-2.5 rounded-xl border border-border bg-background hover:bg-secondary text-sm font-semibold text-foreground transition-colors flex items-center gap-2 shadow-sm cursor-pointer">
                <Send className="h-4 w-4 text-blue-600" /> Give Product
              </button>
              <button onClick={openAdd} className="cta-gradient text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm cursor-pointer">
                <Plus className="h-4 w-4" /> Add Item
              </button>
            </div>
          </div>

          {/* Module Cards */}
          <h2 className="font-display text-lg font-semibold text-foreground">Select Submodule</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* All Items */}
            <div
              onClick={() => handleTabChange("all")}
              className="group cursor-pointer rounded-2xl border border-border bg-background p-6 card-shadow transition-all hover:border-primary/40 hover:bg-primary/[0.02]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                  <Boxes className="h-6 w-6" />
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                  Submodule <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
              <h3 className="mt-5 font-display text-xl font-bold text-foreground">All Items</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                View and manage all inventory items.
              </p>
              <p className="mt-3 text-2xl font-bold text-blue-600 dark:text-blue-400">{totalItems} <span className="text-xs font-medium text-muted-foreground">items</span></p>
            </div>

            {/* Low Stock Submodule */}
            <div
              onClick={() => handleTabChange("low-stock")}
              className="group cursor-pointer rounded-2xl border border-border bg-background p-6 card-shadow transition-all hover:border-amber-500/40 hover:bg-amber-500/[0.02]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold text-amber-600">
                  Submodule <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
              <h3 className="mt-5 font-display text-xl font-bold text-foreground">Low Stock</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Items running below minimum stock level.
              </p>
              <p className="mt-3 text-2xl font-bold text-amber-600 dark:text-amber-400">{lowStockCount} <span className="text-xs font-medium text-muted-foreground">items</span></p>
            </div>

            {/* Out Stock Submodule */}
            <div
              onClick={() => handleTabChange("out-stock")}
              className="group cursor-pointer rounded-2xl border border-border bg-background p-6 card-shadow transition-all hover:border-rose-500/40 hover:bg-rose-500/[0.02]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600">
                  <PackageMinus className="h-6 w-6" />
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold text-rose-600">
                  Submodule <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
              <h3 className="mt-5 font-display text-xl font-bold text-foreground">Out Stock</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Items with zero stock quantity.
              </p>
              <p className="mt-3 text-2xl font-bold text-rose-600 dark:text-rose-400">{outOfStockCount} <span className="text-xs font-medium text-muted-foreground">items</span></p>
            </div>

            {/* Issued / Given Products Submodule */}
            <div
              onClick={() => handleTabChange("issued")}
              className="group cursor-pointer rounded-2xl border border-border bg-background p-6 card-shadow transition-all hover:border-emerald-500/40 hover:bg-emerald-500/[0.02]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                  <UserCheck className="h-6 w-6" />
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                  Submodule <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
              <h3 className="mt-5 font-display text-xl font-bold text-foreground">Given / Issued Products</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Track products given to employees or companies.
              </p>
              <p className="mt-3 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{issuedCount} <span className="text-xs font-medium text-muted-foreground">active issues</span></p>
            </div>
          </div>
        </>
      )}

      {/* ─── All Items Submodule ──────────────────────────────────── */}
      {activeTab === "all" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-4 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <Boxes className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold">All Inventory Items</h2>
                <p className="text-xs text-muted-foreground">{totalItems} items total ({totalQty} total units)</p>
              </div>
            </div>
            <button onClick={openAdd} className="cta-gradient text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm cursor-pointer">
              <Plus className="h-4 w-4" /> Add Item
            </button>
          </div>
          <InventoryTable items={items} filterMode="ALL" onEdit={openEdit} onDelete={setDeleteTarget} />
        </div>
      )}

      {/* ─── Low Stock Submodule ──────────────────────────────────── */}
      {activeTab === "low-stock" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-4 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-amber-700 dark:text-amber-400">Low Stock Submodule</h2>
                <p className="text-xs text-muted-foreground">{lowStockCount} items running below minimum required stock level</p>
              </div>
            </div>
            <button onClick={openAdd} className="cta-gradient text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm cursor-pointer">
              <Plus className="h-4 w-4" /> Add Item
            </button>
          </div>
          <InventoryTable items={items} filterMode="LOW" onEdit={openEdit} onDelete={setDeleteTarget} />
        </div>
      )}

      {/* ─── Out Stock Submodule ─────────────────────────────────── */}
      {(activeTab === "out-stock" || activeTab === "out-of-stock") && (
        <div className="space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-4 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
                <PackageMinus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-rose-600 dark:text-rose-400">Out Stock Submodule</h2>
                <p className="text-xs text-muted-foreground">{outOfStockCount} items currently out of stock (0 quantity)</p>
              </div>
            </div>
            <button onClick={openAdd} className="cta-gradient text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm cursor-pointer">
              <Plus className="h-4 w-4" /> Add Item
            </button>
          </div>
          <InventoryTable items={items} filterMode="OUT" onEdit={openEdit} onDelete={setDeleteTarget} />
        </div>
      )}

      {/* ─── Given / Issued Products Submodule ────────────────────── */}
      {activeTab === "issued" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-4 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-emerald-700 dark:text-emerald-400">Given / Issued Products Submodule</h2>
                <p className="text-xs text-muted-foreground">Track products issued to persons, employees, or companies.</p>
              </div>
            </div>
            <button onClick={openIssueProduct} className="cta-gradient text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm cursor-pointer">
              <Send className="h-4 w-4" /> Give Product to Person/Company
            </button>
          </div>
          <IssuedItemsTable issues={issues} onMarkReturn={handleMarkReturn} onDeleteIssue={handleDeleteIssue} />
        </div>
      )}

      {/* ─── Add/Edit Modal (Product) ─────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-background border border-border p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                  {editItem ? <Edit3 className="h-5 w-5" /> : <PackagePlus className="h-5 w-5" />}
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-foreground">
                    {editItem ? "Edit Item" : "Add New Item"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {editItem ? "Update inventory item details" : "Add a new item to inventory"}
                  </p>
                </div>
              </div>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="rounded-lg p-1 text-muted-foreground hover:bg-secondary cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Item Name <span className="text-rose-500">*</span></label>
                  <input type="text" className={inputClass} placeholder="e.g. Laptop Dell Latitude" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">SKU / Code</label>
                  <input type="text" className={inputClass} placeholder="e.g. LAP-001" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Category</label>
                  <select className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    <option value="">Select category...</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Company Name</label>
                  <input type="text" className={inputClass} placeholder="e.g. Techware Ltd" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Date</label>
                  <input type="date" className={inputClass} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Quantity <span className="text-rose-500">*</span></label>
                  <input type="number" min="0" className={inputClass} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Min Stock Level</label>
                  <input type="number" min="0" className={inputClass} value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Unit</label>
                  <select className={inputClass} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                    <option value="pcs">Pieces</option>
                    <option value="kg">Kg</option>
                    <option value="ltr">Litre</option>
                    <option value="mtr">Metre</option>
                    <option value="box">Box</option>
                    <option value="set">Set</option>
                    <option value="pair">Pair</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Location / Storage</label>
                  <input type="text" className={inputClass} placeholder="e.g. Warehouse A, Shelf 3" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Cost Price (₹)</label>
                  <input type="number" min="0" step="0.01" className={inputClass} placeholder="e.g. 5000" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Description</label>
                <textarea rows={2} className={inputClass} placeholder="Brief description of the item..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
                <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="px-4 py-2 text-sm font-semibold rounded-xl border border-border hover:bg-secondary cursor-pointer">Cancel</button>
                <button type="submit" disabled={submitting} className="cta-gradient text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer">
                  {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : editItem ? <><Edit3 className="h-4 w-4" /> Update Item</> : <><Plus className="h-4 w-4" /> Add Item</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Issue Product Modal (Give Product to Person / Company) ──── */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-background border border-border p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <Send className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-foreground">Give / Issue Product</h3>
                  <p className="text-xs text-muted-foreground">Assign product to a person or company</p>
                </div>
              </div>
              <button onClick={() => { setShowIssueModal(false); resetIssueForm(); }} className="rounded-lg p-1 text-muted-foreground hover:bg-secondary cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleIssueSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Select Inventory Item <span className="text-rose-500">*</span>
                </label>
                <select
                  className={inputClass}
                  value={issueForm.inventoryItemId}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    const selectedItem = items.find((i) => i.id === selectedId);
                    setIssueForm({
                      ...issueForm,
                      inventoryItemId: selectedId,
                      itemName: selectedItem ? selectedItem.name : issueForm.itemName,
                      companyName: selectedItem?.companyName || issueForm.companyName,
                    });
                  }}
                >
                  <option value="">Select product from inventory...</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id} disabled={i.quantity <= 0}>
                      {i.name} ({i.quantity} available {i.quantity <= 0 ? "- OUT OF STOCK" : ""})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Product Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Product name..."
                  value={issueForm.itemName}
                  onChange={(e) => setIssueForm({ ...issueForm, itemName: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Given To (Worker / Person) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="e.g. Worker Name"
                    value={issueForm.assignedToPerson}
                    onChange={(e) => setIssueForm({ ...issueForm, assignedToPerson: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Running Project
                  </label>
                  {projects.length > 0 ? (
                    <select
                      className={inputClass}
                      value={issueForm.projectName}
                      onChange={(e) => setIssueForm({ ...issueForm, projectName: e.target.value })}
                    >
                      <option value="">Select running project...</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.name}>
                          {p.code ? `${p.code} - ${p.name}` : p.name} ({p.status})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className={inputClass}
                      placeholder="e.g. Project Alpha"
                      value={issueForm.projectName}
                      onChange={(e) => setIssueForm({ ...issueForm, projectName: e.target.value })}
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Company Name
                </label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="e.g. Techware Ltd"
                  value={issueForm.companyName}
                  onChange={(e) => setIssueForm({ ...issueForm, companyName: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Quantity Given <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    className={inputClass}
                    value={issueForm.quantity}
                    onChange={(e) => setIssueForm({ ...issueForm, quantity: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Issue Date
                  </label>
                  <input
                    type="date"
                    className={inputClass}
                    value={issueForm.issueDate}
                    onChange={(e) => setIssueForm({ ...issueForm, issueDate: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Notes / Purpose
                </label>
                <textarea
                  rows={2}
                  className={inputClass}
                  placeholder="Reason or notes for giving product..."
                  value={issueForm.notes}
                  onChange={(e) => setIssueForm({ ...issueForm, notes: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
                <button type="button" onClick={() => { setShowIssueModal(false); resetIssueForm(); }} className="px-4 py-2 text-sm font-semibold rounded-xl border border-border hover:bg-secondary cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={submittingIssue} className="cta-gradient text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer">
                  {submittingIssue ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><Send className="h-4 w-4" /> Submit Issue Record</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation Modal ────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-background border border-border p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-foreground">Delete Item</h3>
              <button onClick={() => setDeleteTarget(null)} className="rounded-lg p-1 text-muted-foreground hover:bg-secondary cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>{deleteTarget.sku ? ` (${deleteTarget.sku})` : ""}? This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm font-semibold rounded-xl border border-border hover:bg-secondary cursor-pointer">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 text-sm font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer">
                {deleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
