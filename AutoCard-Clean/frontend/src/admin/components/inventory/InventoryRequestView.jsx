import { useState, useEffect } from "react";
import {
  ClipboardList,
  Plus,
  Search,
  RefreshCw,
  ArrowLeft,
  Calendar,
  User,
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  RotateCcw,
  Wrench,
  PackagePlus,
  X,
  FileText,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../../lib/api.js";

export default function InventoryRequestView({ onBackToHub }) {
  const [requests, setRequests] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State - Unified Schema for Material Indents
  const [form, setForm] = useState({
    actionType: "Taking", // "Taking" | "Return"
    category: "Tools",
    productType: "Mechanical",
    projectName: "AutoCard Assembly Line 1",
    inventoryItemId: "",
    itemName: "",
    quantity: 1,
    urgency: "Normal",
    itemCondition: "Good Condition",
    returnDate: new Date().toISOString().slice(0, 10),
    reason: "",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [reqsRes, itemsRes] = await Promise.all([
        apiGet("/requests"),
        apiGet("/inventory/items"),
      ]);
      const allReqs = reqsRes.requests || [];
      // Filter for EQUIPMENT / Inventory Requisitions
      const eqReqs = allReqs.filter(
        (r) => r.type === "EQUIPMENT" || (r.subject && r.subject.includes("[TOOLS_INVENTORY]"))
      );
      setRequests(eqReqs);
      setItems(itemsRes.items || []);
    } catch (err) {
      toast.error(err.message || "Failed to load material requests.");
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
    if (!form.quantity || Number(form.quantity) < 1) {
      toast.error("Quantity must be at least 1.");
      return;
    }

    setSubmitting(true);
    try {
      const subject = `[TOOLS_INVENTORY] ${form.actionType}: ${form.itemName} (${form.quantity} Nos)`;
      const description = `
${form.reason || "Material requisition requested."}

[TOOLS_INVENTORY]
${JSON.stringify({
  actionType: form.actionType,
  category: form.category,
  productType: form.productType,
  projectName: form.projectName,
  inventoryItemId: form.inventoryItemId || null,
  itemName: form.itemName,
  quantity: Number(form.quantity),
  urgency: form.urgency,
  itemCondition: form.itemCondition,
  returnDate: form.actionType === "Return" ? form.returnDate : null,
  reason: form.reason,
})}
`.trim();

      await apiPost("/requests", {
        type: "EQUIPMENT",
        subject,
        description,
      });

      toast.success("Material request submitted successfully!");
      setIsModalOpen(false);
      setForm({
        actionType: "Taking",
        category: "Tools",
        productType: "Mechanical",
        projectName: "AutoCard Assembly Line 1",
        inventoryItemId: "",
        itemName: "",
        quantity: 1,
        urgency: "Normal",
        itemCondition: "Good Condition",
        returnDate: new Date().toISOString().slice(0, 10),
        reason: "",
      });
      await loadData();
    } catch (err) {
      toast.error(err.message || "Failed to submit material request.");
    } finally {
      setSubmitting(false);
    }
  };

  const parseRequestDetails = (reqItem) => {
    let details = {};
    try {
      if (reqItem.description && reqItem.description.includes("{")) {
        const jsonMatch = reqItem.description.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          details = JSON.parse(jsonMatch[0]);
        }
      }
    } catch {
      // Ignore
    }
    return details;
  };

  const filteredRequests = requests.filter((req) => {
    const details = parseRequestDetails(req);
    const empName = req.employee?.user?.fullName || req.employee?.fullName || "";
    const empCode = req.employee?.employeeCode || "";

    const matchesSearch =
      (details.itemName || req.subject || "").toLowerCase().includes(search.toLowerCase()) ||
      empName.toLowerCase().includes(search.toLowerCase()) ||
      empCode.toLowerCase().includes(search.toLowerCase()) ||
      (details.projectName || "").toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "ALL" || req.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalReqsCount = requests.length;
  const pendingCount = requests.filter((r) => r.status === "PENDING").length;
  const approvedCount = requests.filter((r) => r.status === "APPROVED").length;
  const rejectedCount = requests.filter((r) => r.status === "REJECTED").length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToHub}
            className="p-2 rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Back to Inventory Submodules"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              Sub-module 5: Inventory Request (Material Requisition & Indents)
            </h1>
            <p className="text-sm text-muted-foreground">
              Raise material indents, request spare parts or tools, and track requisition status.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2.5 rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Raise Material Request
          </button>
        </div>
      </div>

      {/* Metrics Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-border bg-background card-shadow flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center shrink-0">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
              Total Indents Raised
            </span>
            <span className="text-2xl font-bold text-foreground">{totalReqsCount}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-background card-shadow flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
              Pending Approval
            </span>
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{pendingCount}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-background card-shadow flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
              Approved Indents
            </span>
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{approvedCount}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-background card-shadow flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
            <XCircle className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider block">
              Rejected Indents
            </span>
            <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">{rejectedCount}</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-background p-4 rounded-2xl border border-border card-shadow">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search request by item name, employee, or project..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-secondary/30 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex items-center gap-2">
          {["ALL", "PENDING", "APPROVED", "REJECTED"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                statusFilter === st
                  ? "bg-cyan-600 text-white shadow-xs"
                  : "bg-secondary/40 border border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Requests History List */}
      <div className="rounded-2xl border border-border bg-background card-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-secondary/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="p-4">Item & Action</th>
                <th className="p-4">Requested By</th>
                <th className="p-4">Project & Category</th>
                <th className="p-4">Urgency</th>
                <th className="p-4">Date</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {loading ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-muted-foreground">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-cyan-600" />
                    Loading material requests...
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-muted-foreground">
                    No material requests found.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((reqItem) => {
                  const details = parseRequestDetails(reqItem);
                  const empName = reqItem.employee?.user?.fullName || reqItem.employee?.fullName || "Employee";
                  const empCode = reqItem.employee?.employeeCode || "";
                  const isTaking = details.actionType === "Taking";

                  return (
                    <tr key={reqItem.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="p-4 font-semibold text-foreground">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isTaking
                                ? "bg-blue-500/10 text-blue-600"
                                : "bg-emerald-500/10 text-emerald-600"
                            }`}
                          >
                            {isTaking ? <PackagePlus className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                          </div>
                          <div>
                            <div>{details.itemName || reqItem.subject}</div>
                            <div className="text-xs font-normal text-muted-foreground">
                              Qty: <span className="font-bold text-foreground">{details.quantity || 1}</span> ({details.actionType || "Requisition"})
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <div>
                            <div>{empName}</div>
                            <div className="text-xs text-muted-foreground">{empCode || "EMP"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-xs">
                        <div className="font-semibold text-foreground">{details.projectName || "General"}</div>
                        <div className="text-muted-foreground">
                          {details.category || "Tools"} ({details.productType || "Mechanical"})
                        </div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase ${
                            details.urgency === "Emergency"
                              ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                              : details.urgency === "Urgent"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {details.urgency || "Normal"}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{new Date(reqItem.createdAt).toLocaleDateString("en-IN")}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            reqItem.status === "PENDING"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                              : reqItem.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                          }`}
                        >
                          {reqItem.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Raise Material Request */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground border border-border rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-lg text-foreground">Raise Material Request / Indent</h3>
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
              {/* Action Type */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Requisition Action Type *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {["Taking", "Return"].map((act) => (
                    <button
                      key={act}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, actionType: act }))}
                      className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                        form.actionType === act
                          ? "border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300"
                          : "border-border bg-background text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      {act === "Taking" ? <PackagePlus className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                      <span>{act === "Taking" ? "Taking (Stock Out Issue)" : "Return (Stock Return)"}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Select Item from Catalog */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Select Registered Item (Optional)
                </label>
                <select
                  value={form.inventoryItemId}
                  onChange={(e) => handleItemSelect(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">-- Select item from catalog or type custom item --</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} (Available: {i.quantity} {i.unit})
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
                  placeholder="e.g., Pneumatic Cylinder, Laser Sensor, M6 Screws"
                  value={form.itemName}
                  onChange={(e) => setForm((prev) => ({ ...prev, itemName: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Category */}
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Category
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="Tools">Tools</option>
                    <option value="Project">Project Material</option>
                    <option value="Consumable">Consumables</option>
                    <option value="Spare Part">Spare Parts</option>
                  </select>
                </div>

                {/* Product Type */}
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Product Type
                  </label>
                  <select
                    value={form.productType}
                    onChange={(e) => setForm((prev) => ({ ...prev, productType: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="Mechanical">Mechanical</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Pneumatic">Pneumatic</option>
                    <option value="Electronic">Electronic</option>
                    <option value="Other">Other</option>
                  </select>
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

                {/* Urgency */}
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">
                    Urgency Priority
                  </label>
                  <select
                    value={form.urgency}
                    onChange={(e) => setForm((prev) => ({ ...prev, urgency: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="Normal">Normal</option>
                    <option value="Urgent">Urgent</option>
                    <option value="Emergency">Emergency</option>
                  </select>
                </div>
              </div>

              {/* Project Name */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Project Name / Machine Assembly
                </label>
                <input
                  type="text"
                  placeholder="e.g., AutoCard Assembly Line 1, Project Titan"
                  value={form.projectName}
                  onChange={(e) => setForm((prev) => ({ ...prev, projectName: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Requisition Purpose / Reason
                </label>
                <textarea
                  rows="2"
                  placeholder="State why this material is required..."
                  value={form.reason}
                  onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
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
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold rounded-xl shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  {submitting ? "Submitting..." : "Submit Material Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
