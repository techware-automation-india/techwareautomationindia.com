import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Search,
  Trash2,
  X,
  Building2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "../../lib/api.js";

const STORAGE_KEY = "techware_admin_amc_schedules_v1";

const initialAmcs = [
  {
    id: "AMC-1001",
    customerName: "Tata AutoComp Systems",
    machineName: "SCM-200 High-Speed Cutter",
    planType: "Comprehensive AMC",
    startDate: "2026-01-15",
    endDate: "2027-01-14",
    nextPmDate: "2026-12-10",
    engineer: "R. Sharma",
    status: "Active",
  },
  {
    id: "AMC-1002",
    customerName: "Bharat Forge Pune",
    machineName: "Laser Marker LM-50",
    planType: "Preventive Only",
    startDate: "2025-11-01",
    endDate: "2026-10-31",
    nextPmDate: "2026-11-28",
    engineer: "A. Verma",
    status: "Expiring Soon",
  },
];

const CustomerAmc = () => {
  const navigate = useNavigate();
  const [amcs, setAmcs] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : initialAmcs;
    } catch {
      return initialAmcs;
    }
  });
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    customerName: "",
    machineName: "",
    planType: "Comprehensive AMC",
    startDate: "",
    endDate: "",
    nextPmDate: "",
    engineer: "",
    status: "Active",
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(amcs));
  }, [amcs]);

  useEffect(() => {
    apiGet("/customers")
      .then((d) => setCustomers(d.customers || []))
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    return amcs.filter((item) => {
      const matchesSearch =
        !search ||
        item.customerName.toLowerCase().includes(search.toLowerCase()) ||
        item.machineName.toLowerCase().includes(search.toLowerCase()) ||
        item.id.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "All" || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [amcs, search, statusFilter]);

  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.customerName || !form.machineName || !form.endDate) {
      toast.error("Please fill in customer, machine, and contract end date.");
      return;
    }
    const newItem = {
      ...form,
      id: `AMC-${1000 + amcs.length + 1}`,
    };
    setAmcs((prev) => [newItem, ...prev]);
    setForm({
      customerName: "",
      machineName: "",
      planType: "Comprehensive AMC",
      startDate: "",
      endDate: "",
      nextPmDate: "",
      engineer: "",
      status: "Active",
    });
    setShowModal(false);
    toast.success("AMC & PM schedule added.");
  };

  const handleDelete = (id) => {
    setAmcs((prev) => prev.filter((item) => item.id !== id));
    toast.success("AMC record removed.");
  };

  const activeCount = amcs.filter((a) => a.status === "Active").length;
  const expiringCount = amcs.filter((a) => a.status === "Expiring Soon").length;

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
              AMC & Preventive Maintenance Scheduler
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Track annual maintenance contracts, renewal dates, and scheduled PM visits.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-all cursor-pointer shadow-xs shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>New AMC Schedule</span>
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card flex items-center gap-3.5">
          <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Contracts</p>
            <p className="text-xl font-bold">{amcs.length}</p>
          </div>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card flex items-center gap-3.5">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Active AMCs</p>
            <p className="text-xl font-bold">{activeCount}</p>
          </div>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card flex items-center gap-3.5">
          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Expiring Soon</p>
            <p className="text-xl font-bold">{expiringCount}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer, machine, or AMC ID..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3.5 py-2 rounded-xl border border-border bg-background text-sm"
        >
          <option value="All">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Expiring Soon">Expiring Soon</option>
          <option value="Expired">Expired</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground border-b border-border">
            <tr>
              <th className="px-4 py-3">AMC ID</th>
              <th className="px-4 py-3">Customer / Plant</th>
              <th className="px-4 py-3">Machine</th>
              <th className="px-4 py-3">Plan Type</th>
              <th className="px-4 py-3">Next PM Visit</th>
              <th className="px-4 py-3">Valid Until</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-mono text-xs font-semibold">{item.id}</td>
                <td className="px-4 py-3 font-medium flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  {item.customerName}
                </td>
                <td className="px-4 py-3">{item.machineName}</td>
                <td className="px-4 py-3 text-muted-foreground">{item.planType}</td>
                <td className="px-4 py-3">{item.nextPmDate || "—"}</td>
                <td className="px-4 py-3">{item.endDate}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      item.status === "Active"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : item.status === "Expiring Soon"
                        ? "bg-amber-500/10 text-amber-600"
                        : "bg-rose-500/10 text-rose-600"
                    }`}
                  >
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
                  No AMC schedules found.
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
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <Wrench className="h-5 w-5 text-primary" />
                Add AMC & PM Schedule
              </h2>
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
                <label className="block text-xs font-medium mb-1">Customer / Plant *</label>
                <input
                  list="amc-customer-list"
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  placeholder="Enter or select customer"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                />
                <datalist id="amc-customer-list">
                  {customers.map((c) => (
                    <option key={c.id} value={c.companyName || c.fullName} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Machine / Line *</label>
                <input
                  value={form.machineName}
                  onChange={(e) => setForm({ ...form, machineName: e.target.value })}
                  placeholder="e.g., SCM-200 Cutter"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Plan Type</label>
                  <select
                    value={form.planType}
                    onChange={(e) => setForm({ ...form, planType: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                  >
                    <option>Comprehensive AMC</option>
                    <option>Preventive Only</option>
                    <option>On-Call Support</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                  >
                    <option>Active</option>
                    <option>Expiring Soon</option>
                    <option>Expired</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Contract End Date *</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Next PM Visit</label>
                  <input
                    type="date"
                    value={form.nextPmDate}
                    onChange={(e) => setForm({ ...form, nextPmDate: e.target.value })}
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
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerAmc;
