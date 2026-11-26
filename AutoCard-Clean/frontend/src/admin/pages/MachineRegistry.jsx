import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Cpu,
  Plus,
  RefreshCw,
  Search,
  Building2,
  Calendar,
  Wrench,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  FolderKanban,
  Edit,
  Trash2,
  Tag,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../lib/api.js";

// Local machine types & sample default seed if database projects exist
const MACHINE_MODELS = [
  "Sheet Collation Machine (SCM-200)",
  "Card Laser Marker (CLM-40)",
  "Manual ATR Unit (ATR-01)",
  "Card Sorting & Feeding Line (CSF-90)",
  "Dual Head Card Punching Machine (DHP-10)",
  "Module Push-Pull Tester (MPT-500)",
];

const MachineRegistry = () => {
  const navigate = useNavigate();
  const [machines, setMachines] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterModel, setFilterModel] = useState("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [form, setForm] = useState({
    modelName: MACHINE_MODELS[0],
    serialNumber: "",
    customerId: "",
    siteLocation: "",
    installationDate: new Date().toISOString().split("T")[0],
    warrantyStatus: "ACTIVE", // ACTIVE or EXPIRED
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [projRes, custRes] = await Promise.allSettled([
        apiGet("/projects"),
        apiGet("/customers"),
      ]);

      const custList = custRes.status === "fulfilled" && custRes.value?.customers ? custRes.value.customers : [];
      setCustomers(custList);

      // We extract or format projects that are machinery installations
      let list = [];
      const stored = localStorage.getItem("techware_machine_registry");
      if (stored) {
        try {
          list = JSON.parse(stored);
        } catch (_) {}
      }

      if (list.length === 0 && custList.length > 0) {
        // Sample seed linking first customer if exists
        list = [
          {
            id: "m-1",
            modelName: "Sheet Collation Machine (SCM-200)",
            serialNumber: "TC-SCM-2025-01",
            customerId: custList[0]?.id,
            customerName: custList[0]?.companyName || custList[0]?.fullName || "Primary Client",
            siteLocation: custList[0]?.city || "Plant Floor #1",
            installationDate: "2025-08-15",
            warrantyStatus: "ACTIVE",
          },
        ];
        localStorage.setItem("techware_machine_registry", JSON.stringify(list));
      }

      setMachines(list);
    } catch (err) {
      console.error("Failed to load machine registry:", err);
      toast.error(err.message || "Failed to load machines.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddMachine = (e) => {
    e.preventDefault();
    if (!form.serialNumber.trim()) {
      toast.error("Serial Number is required.");
      return;
    }

    setSubmitting(true);
    try {
      const matchedCust = customers.find((c) => c.id === form.customerId);
      const newEntry = {
        id: `m-${Date.now()}`,
        modelName: form.modelName,
        serialNumber: form.serialNumber.trim(),
        customerId: form.customerId,
        customerName: matchedCust?.companyName || matchedCust?.fullName || "Unassigned Client",
        siteLocation: form.siteLocation.trim() || matchedCust?.city || "Customer Facility",
        installationDate: form.installationDate,
        warrantyStatus: form.warrantyStatus,
      };

      const updated = [newEntry, ...machines];
      setMachines(updated);
      localStorage.setItem("techware_machine_registry", JSON.stringify(updated));

      toast.success(`Machine "${form.serialNumber}" registered successfully!`);
      setModalOpen(false);
      setForm({
        modelName: MACHINE_MODELS[0],
        serialNumber: "",
        customerId: "",
        siteLocation: "",
        installationDate: new Date().toISOString().split("T")[0],
        warrantyStatus: "ACTIVE",
      });
    } catch (err) {
      toast.error("Failed to register machine.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id, sn) => {
    if (!confirm(`Delete machine unit "${sn}" from registry?`)) return;
    const updated = machines.filter((m) => m.id !== id);
    setMachines(updated);
    localStorage.setItem("techware_machine_registry", JSON.stringify(updated));
    toast.success(`Machine ${sn} removed.`);
  };

  const filteredMachines = useMemo(() => {
    return machines.filter((m) => {
      if (filterModel !== "ALL" && !m.modelName.includes(filterModel)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          m.serialNumber.toLowerCase().includes(q) ||
          m.modelName.toLowerCase().includes(q) ||
          m.customerName?.toLowerCase().includes(q) ||
          m.siteLocation?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [machines, filterModel, searchQuery]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={() => navigate("/admin/customer-hub")}
            className="p-2.5 rounded-xl border border-border bg-background hover:bg-secondary text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-xs"
            aria-label="Back to Customer Hub"
            title="Back to Customer Hub"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">Customer Management</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">Asset Registry</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Machinery & Asset Registry
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border bg-background hover:bg-secondary text-xs font-medium text-foreground transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 text-white text-xs font-semibold shadow-xs hover:from-blue-700 hover:to-indigo-700 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Register Deployed Machine
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Installed Machines</span>
          <div className="mt-2 text-3xl font-black text-blue-600 dark:text-blue-400">{machines.length}</div>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Under Active Warranty</span>
          <div className="mt-2 text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {machines.filter((m) => m.warrantyStatus === "ACTIVE").length}
          </div>
        </div>
        <div className="rounded-2xl border border-purple-500/20 bg-purple-500/10 p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Client Deployments</span>
          <div className="mt-2 text-3xl font-black text-purple-600 dark:text-purple-400">
            {new Set(machines.map((m) => m.customerName)).size}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative min-w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by serial number, machine model, client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Machines Table Container */}
      <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs">Loading machine assets...</span>
          </div>
        ) : filteredMachines.length === 0 ? (
          <div className="p-16 text-center">
            <Cpu className="h-12 w-12 mx-auto mb-3 opacity-30 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">No machines registered</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Register deployed machinery to link automation lines directly to customer accounts.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/80 bg-secondary/40 text-left uppercase tracking-wider text-[11px] font-semibold text-muted-foreground">
                  <th className="px-5 py-3.5">Machine Model & Serial No.</th>
                  <th className="px-5 py-3.5">Customer & Site Location</th>
                  <th className="px-5 py-3.5">Installation Date</th>
                  <th className="px-5 py-3.5">Warranty Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredMachines.map((machine) => (
                  <tr key={machine.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Cpu className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <div className="font-semibold text-foreground text-sm">{machine.modelName}</div>
                          <div className="text-muted-foreground font-mono text-[11px] mt-0.5">SN: {machine.serialNumber}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="space-y-0.5">
                        <div className="font-medium text-foreground">{machine.customerName}</div>
                        <div className="text-muted-foreground text-[11px]">{machine.siteLocation}</div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{machine.installationDate}</span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          machine.warrantyStatus === "ACTIVE"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : "bg-muted text-muted-foreground border border-border"
                        }`}
                      >
                        <ShieldCheck className="h-3 w-3" />
                        {machine.warrantyStatus === "ACTIVE" ? "Under Warranty" : "Warranty Expired"}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => handleDelete(machine.id, machine.serialNumber)}
                        className="p-1.5 rounded-lg border border-destructive/30 bg-destructive/5 hover:bg-destructive/15 text-destructive transition-colors cursor-pointer"
                        title="Delete asset"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Register Machine Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-xs">
          <div className="relative bg-card rounded-2xl border border-border shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95 duration-200">
            <h3 className="font-semibold text-base text-foreground mb-1">Register Installed Machine</h3>
            <p className="text-xs text-muted-foreground mb-4">Add automation line details and assign to client site.</p>

            <form onSubmit={handleAddMachine} className="space-y-4 text-xs">
              <div>
                <label className="font-medium text-foreground mb-1 block">Machine Model *</label>
                <select
                  value={form.modelName}
                  onChange={(e) => setForm((p) => ({ ...p, modelName: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs"
                >
                  {MACHINE_MODELS.map((mod) => (
                    <option key={mod} value={mod}>
                      {mod}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-medium text-foreground mb-1 block">Serial Number / Asset Tag *</label>
                <input
                  required
                  placeholder="e.g. TC-SCM-2026-004"
                  value={form.serialNumber}
                  onChange={(e) => setForm((p) => ({ ...p, serialNumber: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs font-mono"
                />
              </div>

              <div>
                <label className="font-medium text-foreground mb-1 block">Assign to Customer Account</label>
                <select
                  value={form.customerId}
                  onChange={(e) => setForm((p) => ({ ...p, customerId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs"
                >
                  <option value="">-- Select Customer / Client --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName || c.fullName} {c.city ? `(${c.city})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-medium text-foreground mb-1 block">Installation / Commissioning Date</label>
                  <input
                    type="date"
                    value={form.installationDate}
                    onChange={(e) => setForm((p) => ({ ...p, installationDate: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs"
                  />
                </div>
                <div>
                  <label className="font-medium text-foreground mb-1 block">Warranty Status</label>
                  <select
                    value={form.warrantyStatus}
                    onChange={(e) => setForm((p) => ({ ...p, warrantyStatus: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs"
                  >
                    <option value="ACTIVE">Under Active Warranty</option>
                    <option value="EXPIRED">Warranty Expired</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-medium text-foreground mb-1 block">Plant Location / Site</label>
                <input
                  placeholder="e.g. Unit 2, Main Production Line"
                  value={form.siteLocation}
                  onChange={(e) => setForm((p) => ({ ...p, siteLocation: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border bg-background text-xs font-medium hover:bg-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Register Machine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MachineRegistry;
