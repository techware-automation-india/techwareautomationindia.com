import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Cog,
  Plus,
  Search,
  Trash2,
  Truck,
  CheckCircle2,
  Clock,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "../../lib/api.js";

const STORAGE_KEY = "techware_admin_customer_spares_v1";

const initialSpares = [
  {
    id: "SPR-401",
    customerName: "Tata AutoComp Systems",
    partName: "Omron Proximity Sensor E2E-X5ME1",
    machineTag: "SCM-200 #SN8841",
    quantity: 4,
    status: "Dispatched",
    requestedDate: "2026-11-20",
  },
  {
    id: "SPR-402",
    customerName: "Mahindra Precision",
    partName: "Delta Servo Drive ASD-B2-0721-B",
    machineTag: "ATR-Line 02",
    quantity: 1,
    status: "Pending",
    requestedDate: "2026-11-24",
  },
];

const CustomerSpares = () => {
  const navigate = useNavigate();
  const [spares, setSpares] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : initialSpares;
    } catch {
      return initialSpares;
    }
  });
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    customerName: "",
    partName: "",
    machineTag: "",
    quantity: 1,
    status: "Pending",
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(spares));
  }, [spares]);

  useEffect(() => {
    apiGet("/customers")
      .then((d) => setCustomers(d.customers || []))
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    return spares.filter((item) => {
      const matchesSearch =
        !search ||
        item.customerName.toLowerCase().includes(search.toLowerCase()) ||
        item.partName.toLowerCase().includes(search.toLowerCase()) ||
        item.id.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "All" || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [spares, search, statusFilter]);

  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.customerName || !form.partName) {
      toast.error("Please enter customer and part name.");
      return;
    }
    const newItem = {
      ...form,
      id: `SPR-${400 + spares.length + 1}`,
      requestedDate: new Date().toISOString().slice(0, 10),
    };
    setSpares((prev) => [newItem, ...prev]);
    setForm({ customerName: "", partName: "", machineTag: "", quantity: 1, status: "Pending" });
    setShowModal(false);
    toast.success("Spare part request logged.");
  };

  const handleDelete = (id) => {
    setSpares((prev) => prev.filter((item) => item.id !== id));
    toast.success("Spare part request removed.");
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={() => navigate("/admin/customer-hub")}
            className="p-2.5 rounded-xl border border-border bg-background hover:bg-secondary text-muted-foreground hover:text-foreground transition-all shrink-0 cursor-pointer shadow-xs"
            aria-label="Back to Customer Hub"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Spare Parts & Consumables
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Track customer spare part orders, machine-linked replacements, and dispatch status.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-all cursor-pointer shadow-xs shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>New Spare Request</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card flex items-center gap-3.5">
          <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600">
            <Cog className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Requests</p>
            <p className="text-xl font-bold">{spares.length}</p>
          </div>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card flex items-center gap-3.5">
          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pending Dispatch</p>
            <p className="text-xl font-bold">{spares.filter((s) => s.status === "Pending").length}</p>
          </div>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card flex items-center gap-3.5">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Dispatched / Delivered</p>
            <p className="text-xl font-bold">
              {spares.filter((s) => s.status === "Dispatched" || s.status === "Delivered").length}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer, part name, or request ID..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3.5 py-2 rounded-xl border border-border bg-background text-sm"
        >
          <option value="All">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Dispatched">Dispatched</option>
          <option value="Delivered">Delivered</option>
        </select>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground border-b border-border">
            <tr>
              <th className="px-4 py-3">Req ID</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Part / Component</th>
              <th className="px-4 py-3">Machine Tag</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-mono text-xs font-semibold">{item.id}</td>
                <td className="px-4 py-3 font-medium">{item.customerName}</td>
                <td className="px-4 py-3">{item.partName}</td>
                <td className="px-4 py-3 text-muted-foreground">{item.machineTag || "—"}</td>
                <td className="px-4 py-3 font-semibold">{item.quantity}</td>
                <td className="px-4 py-3 text-muted-foreground">{item.requestedDate}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      item.status === "Delivered" || item.status === "Dispatched"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-amber-500/10 text-amber-600"
                    }`}
                  >
                    {item.status === "Delivered" && <CheckCircle2 className="h-3 w-3" />}
                    {item.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No spare part requests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">Log Spare Part Request</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg hover:bg-muted cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-medium mb-1">Customer *</label>
                <input
                  list="spares-customer-list"
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  placeholder="Select or type customer"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                />
                <datalist id="spares-customer-list">
                  {customers.map((c) => (
                    <option key={c.id} value={c.companyName || c.fullName} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Part / Component Name *</label>
                <input
                  value={form.partName}
                  onChange={(e) => setForm({ ...form, partName: e.target.value })}
                  placeholder="e.g., Omron Sensor / Servo Drive"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium mb-1">Machine Tag</label>
                  <input
                    value={form.machineTag}
                    onChange={(e) => setForm({ ...form, machineTag: e.target.value })}
                    placeholder="e.g., SCM-200 #SN8841"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Qty</label>
                  <input
                    type="number"
                    min={1}
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) || 1 })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border border-border text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold cursor-pointer"
                >
                  Save Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerSpares;
