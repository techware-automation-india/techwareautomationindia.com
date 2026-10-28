import { useState, useEffect } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPut, apiDelete } from "../../../lib/api.js";
import { getAuthUser } from "../../../lib/auth.js";
import { canPerformAction } from "../../../lib/permissions.js";

export default function InventoryOutView({ onBackToHub, assignedUsers: propAssignedUsers, currentUser: propCurrentUser }) {
  const canCreate = canPerformAction("inventory-out", "create");
  const canEdit = canPerformAction("inventory-out", "edit");
  const canDelete = canPerformAction("inventory-out", "delete");

  const [issues, setIssues] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
    inventoryItemId: "",
    itemName: "",
    issuedToPerson: "",
    issuedToCompany: "",
    quantity: 1,
    issueDate: new Date().toISOString().slice(0, 10),
    status: "ISSUED",
    notes: "",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [issuesRes, itemsRes] = await Promise.all([
        apiGet("/inventory/issues/all"),
        apiGet("/inventory/items"),
      ]);
      setIssues(issuesRes.issues || []);
      setItems(itemsRes.items || []);
    } catch (err) {
      toast.error(err.message || "Failed to load material outward data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleItemSelect = (itemId) => {
    if (!itemId) {
      setForm((prev) => ({ ...prev, inventoryItemId: "", itemName: "" }));
      return;
    }
    const selected = items.find((i) => i.id === itemId);
    if (selected) {
      setForm((prev) => ({
        ...prev,
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
        ...form,
        quantity: Number(form.quantity),
      });
      toast.success("Material issued successfully!");
      setIsModalOpen(false);
      setForm({
        inventoryItemId: "",
        itemName: "",
        issuedToPerson: "",
        issuedToCompany: "",
        quantity: 1,
        issueDate: new Date().toISOString().slice(0, 10),
        status: "ISSUED",
        notes: "",
      });
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

  const filteredIssues = issues.filter((issue) => {
    const matchesSearch =
      (issue.itemName || "").toLowerCase().includes(search.toLowerCase()) ||
      (issue.issuedToPerson || issue.assignedToPerson || "").toLowerCase().includes(search.toLowerCase()) ||
      (issue.issuedToCompany || issue.companyName || issue.projectName || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || issue.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalIssuedCount = issues.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
  const activeIssuedCount = issues
    .filter((i) => i.status === "ISSUED")
    .reduce((acc, curr) => acc + (curr.quantity || 0), 0);
  const returnedCount = issues
    .filter((i) => i.status === "RETURNED")
    .reduce((acc, curr) => acc + (curr.quantity || 0), 0);

  return (
    <div className="space-y-6">
      {/* ─── Assigned Access Personnel & Active Operator Bar (Admin Only) ─── */}
      {internalCurrentUser?.role === "ADMIN" && (
        <div className="flex items-center justify-between flex-wrap gap-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 rounded-2xl p-3 px-4 text-xs card-shadow">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              <ShieldCheck className="h-4 w-4 text-amber-600" />
              <span>Assigned Module Access (Inventory Out):</span>
            </div>
            {internalAssignedUsers.length > 0 ? (
              internalAssignedUsers.map((u) => (
                <span
                  key={u.id}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 font-semibold text-xs border border-amber-300 dark:border-amber-800"
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

      {/* Top Breadcrumb & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-start sm:items-center gap-3">
          <button
            type="button"
            onClick={onBackToHub}
            className="p-2 rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
            title="Back to Inventory Submodules"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <PackageMinus className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground truncate">
              Sub-module 2: Inventory Out (Material Outward Logs)
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Track product outward logs, material dispatches, project tool allocations, and status returns.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2.5 rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          {canCreate && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span>Issue Material / Stock Out</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border border-border bg-background card-shadow flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
            <Boxes className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
              Total Quantity Out
            </span>
            <span className="text-2xl font-bold text-foreground">{totalIssuedCount}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-background card-shadow flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
              Currently Issued (Active)
            </span>
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{activeIssuedCount}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-background card-shadow flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
              Returned Items
            </span>
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{returnedCount}</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-background p-4 rounded-2xl border border-border card-shadow">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by item name, person, or project..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-secondary/30 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
          {["ALL", "ISSUED", "RETURNED", "CONSUMED", "DAMAGED"].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                statusFilter === status
                  ? "bg-primary text-white shadow-xs"
                  : "bg-secondary/40 border border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Issues Table */}
      <div className="rounded-2xl border border-border bg-background card-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-secondary/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="p-4">Item & Quantity</th>
                <th className="p-4">Issued To (Person)</th>
                <th className="p-4">Project / Company</th>
                <th className="p-4">Issue Date</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {loading ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading material outward entries...
                  </td>
                </tr>
              ) : filteredIssues.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-muted-foreground">
                    No material outward records found.
                  </td>
                </tr>
              ) : (
                filteredIssues.map((issue) => {
                  const personName = issue.issuedToPerson || issue.assignedToPerson || "—";
                  const companyName = issue.issuedToCompany || issue.companyName || issue.projectName || "—";

                  return (
                    <tr key={issue.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="p-4 font-semibold text-foreground">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                            <PackageMinus className="h-4 w-4" />
                          </div>
                          <div>
                            <div>{issue.itemName}</div>
                            <div className="text-xs font-normal text-muted-foreground">
                              Qty: <span className="font-bold text-foreground">{issue.quantity}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-300 font-bold text-xs border border-violet-500/20 shadow-2xs">
                            <User className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
                            <span className="capitalize">{personName}</span>
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{companyName}</span>
                        </div>
                      </td>
                      <td className="p-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>
                            {issue.issueDate
                              ? new Date(issue.issueDate).toLocaleDateString("en-IN")
                              : new Date(issue.createdAt).toLocaleDateString("en-IN")}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            issue.status === "ISSUED"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                              : issue.status === "RETURNED"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : issue.status === "CONSUMED"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                              : "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                          }`}
                        >
                          {issue.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canEdit && issue.status === "ISSUED" && (
                            <button
                              type="button"
                              onClick={() => handleReturn(issue.id)}
                              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1 cursor-pointer"
                              title="Mark Returned & Restock"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Return
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

      {/* Modal: Issue Material / Stock Out */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground border border-border rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <PackageMinus className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-lg text-foreground">Issue Material / Stock Out</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Select Inventory Item */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Select Registered Inventory Item (Optional)
                </label>
                <select
                  value={form.inventoryItemId}
                  onChange={(e) => handleItemSelect(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">-- Choose item or type custom item below --</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} (Stock: {item.quantity} {item.unit})
                    </option>
                  ))}
                </select>
              </div>

              {/* Item Name */}
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
                    placeholder="Employee / Person name"
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
                  className="px-4 py-2 border border-border bg-background hover:bg-secondary text-sm font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl shadow-sm disabled:opacity-50 flex items-center gap-2"
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
