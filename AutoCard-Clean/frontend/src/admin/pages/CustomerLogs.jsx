import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  PhoneCall,
  Plus,
  Search,
  Trash2,
  X,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "../../lib/api.js";

const STORAGE_KEY = "techware_admin_customer_logs_v1";

const initialLogs = [
  {
    id: "LOG-101",
    customerName: "Tata AutoComp Systems",
    type: "Site Visit",
    contactPerson: "Mr. Kulkarni (Plant Head)",
    summary: "Completed Q4 preventive check on SCM-200 line. Recommended spare sensor kit.",
    date: "2026-11-22",
    loggedBy: "R. Sharma",
  },
  {
    id: "LOG-102",
    customerName: "Bharat Forge Pune",
    type: "Phone Call",
    contactPerson: "Ms. Deshmukh",
    summary: "Discussed AMC renewal quote for FY 2026-27; follow up next Monday.",
    date: "2026-11-24",
    loggedBy: "Admin",
  },
];

const CustomerLogs = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : initialLogs;
    } catch {
      return initialLogs;
    }
  });
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    customerName: "",
    type: "Phone Call",
    contactPerson: "",
    summary: "",
    loggedBy: "Admin",
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    apiGet("/customers")
      .then((d) => setCustomers(d.customers || []))
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    return logs.filter((item) => {
      const matchesSearch =
        !search ||
        item.customerName.toLowerCase().includes(search.toLowerCase()) ||
        item.summary.toLowerCase().includes(search.toLowerCase()) ||
        item.contactPerson.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "All" || item.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [logs, search, typeFilter]);

  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.customerName || !form.summary) {
      toast.error("Please enter customer and interaction summary.");
      return;
    }
    const newItem = {
      ...form,
      id: `LOG-${100 + logs.length + 1}`,
      date: new Date().toISOString().slice(0, 10),
    };
    setLogs((prev) => [newItem, ...prev]);
    setForm({ customerName: "", type: "Phone Call", contactPerson: "", summary: "", loggedBy: "Admin" });
    setShowModal(false);
    toast.success("Interaction log saved.");
  };

  const handleDelete = (id) => {
    setLogs((prev) => prev.filter((item) => item.id !== id));
    toast.success("Log deleted.");
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
              Site Visit & Call Logs
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Record client calls, plant visits, MOM notes, and follow-up actions.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-all cursor-pointer shadow-xs shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Log Interaction</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer, contact, or notes..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3.5 py-2 rounded-xl border border-border bg-background text-sm"
        >
          <option value="All">All Types</option>
          <option value="Phone Call">Phone Call</option>
          <option value="Site Visit">Site Visit</option>
          <option value="Online Meeting">Online Meeting</option>
        </select>
      </div>

      <div className="space-y-3">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="p-4 rounded-xl border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{item.id}</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                  {item.type}
                </span>
                <span className="font-semibold text-sm">{item.customerName}</span>
                {item.contactPerson && (
                  <span className="text-xs text-muted-foreground">• {item.contactPerson}</span>
                )}
              </div>
              <p className="text-sm text-foreground/90">{item.summary}</p>
              <p className="text-xs text-muted-foreground">
                Logged on {item.date} by {item.loggedBy}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(item.id)}
              className="p-2 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer self-end sm:self-center"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="p-8 text-center rounded-xl border border-border bg-card text-muted-foreground text-sm">
            No interaction logs found.
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Log Customer Interaction
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
                <label className="block text-xs font-medium mb-1">Customer *</label>
                <input
                  list="logs-customer-list"
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  placeholder="Select or type customer"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                />
                <datalist id="logs-customer-list">
                  {customers.map((c) => (
                    <option key={c.id} value={c.companyName || c.fullName} />
                  ))}
                </datalist>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Interaction Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                  >
                    <option>Phone Call</option>
                    <option>Site Visit</option>
                    <option>Online Meeting</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Contact Person</label>
                  <input
                    value={form.contactPerson}
                    onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                    placeholder="e.g., Mr. Kulkarni"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Summary / MOM *</label>
                <textarea
                  rows={3}
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                  placeholder="Key discussion points and next steps..."
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                />
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
                  Save Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerLogs;
