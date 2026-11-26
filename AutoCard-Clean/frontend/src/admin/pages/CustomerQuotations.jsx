import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  FileSpreadsheet,
  Plus,
  Search,
  Trash2,
  X,
  IndianRupee,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "../../lib/api.js";

const STORAGE_KEY = "techware_admin_customer_quotations_v1";

const initialQuotes = [
  {
    id: "QT-2026-011",
    customerName: "Tata AutoComp Systems",
    subject: "SCM-200 Automation Line Upgrade",
    amount: 325000,
    validUntil: "2026-12-15",
    status: "Sent",
  },
  {
    id: "QT-2026-012",
    customerName: "Mahindra Precision",
    subject: "Annual AMC Renewal + Sensor Kit",
    amount: 95000,
    validUntil: "2026-12-10",
    status: "Approved",
  },
];

const CustomerQuotations = () => {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : initialQuotes;
    } catch {
      return initialQuotes;
    }
  });
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    customerName: "",
    subject: "",
    amount: "",
    validUntil: "",
    status: "Draft",
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quotes));
  }, [quotes]);

  useEffect(() => {
    apiGet("/customers")
      .then((d) => setCustomers(d.customers || []))
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    return quotes.filter((item) => {
      const matchesSearch =
        !search ||
        item.customerName.toLowerCase().includes(search.toLowerCase()) ||
        item.subject.toLowerCase().includes(search.toLowerCase()) ||
        item.id.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "All" || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [quotes, search, statusFilter]);

  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.customerName || !form.subject || !form.amount) {
      toast.error("Please fill in customer, subject, and amount.");
      return;
    }
    const newItem = {
      ...form,
      amount: Number(form.amount),
      id: `QT-2026-${10 + quotes.length + 1}`,
    };
    setQuotes((prev) => [newItem, ...prev]);
    setForm({ customerName: "", subject: "", amount: "", validUntil: "", status: "Draft" });
    setShowModal(false);
    toast.success("Quotation created.");
  };

  const handleDelete = (id) => {
    setQuotes((prev) => prev.filter((item) => item.id !== id));
    toast.success("Quotation removed.");
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
              Quotations
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Create, track, and manage machine, spare-part, and AMC quotations.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-all cursor-pointer shadow-xs shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>New Quotation</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer, quote ID, or subject..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3.5 py-2 rounded-xl border border-border bg-background text-sm"
        >
          <option value="All">All Statuses</option>
          <option value="Draft">Draft</option>
          <option value="Sent">Sent</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </select>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground border-b border-border">
            <tr>
              <th className="px-4 py-3">Quote #</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Valid Until</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-mono text-xs font-semibold">{item.id}</td>
                <td className="px-4 py-3 font-medium">{item.customerName}</td>
                <td className="px-4 py-3">{item.subject}</td>
                <td className="px-4 py-3 font-semibold flex items-center gap-0.5">
                  <IndianRupee className="h-3.5 w-3.5" />
                  {Number(item.amount).toLocaleString("en-IN")}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{item.validUntil || "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      item.status === "Approved"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : item.status === "Sent"
                        ? "bg-blue-500/10 text-blue-600"
                        : item.status === "Rejected"
                        ? "bg-rose-500/10 text-rose-600"
                        : "bg-muted text-muted-foreground"
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
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No quotations found.
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
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                Create Quotation
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
                  list="quotes-customer-list"
                  value={form.customerName}
                  onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                  placeholder="Select or type customer"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                />
                <datalist id="quotes-customer-list">
                  {customers.map((c) => (
                    <option key={c.id} value={c.companyName || c.fullName} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Subject / Machine *</label>
                <input
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="e.g., SCM-200 Upgrade"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Amount (INR) *</label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Valid Until</label>
                  <input
                    type="date"
                    value={form.validUntil}
                    onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
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
                  Save Quotation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerQuotations;
