import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FileText,
  Plus,
  RefreshCw,
  Search,
  Upload,
  Download,
  Trash2,
  Calendar,
  Building2,
  ArrowLeft,
  FileCheck,
  FileCode,
  FileSpreadsheet,
  ShieldCheck,
  Loader2,
  Tag,
  Eye,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "../../lib/api.js";

const DOCUMENT_CATEGORIES = [
  "ALL",
  "User Manuals & SOPs",
  "Electrical & Wiring Schematics",
  "AMC & Service Contracts",
  "Invoices & Delivery Challans",
  "Handover & Commissioning Certificates",
];

const CustomerDocuments = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Upload Form State
  const [form, setForm] = useState({
    title: "",
    category: "User Manuals & SOPs",
    customerId: "",
    fileUrl: "",
    notes: "",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const custRes = await apiGet("/customers");
      const custList = custRes?.customers || [];
      setCustomers(custList);

      // Check localStorage for persisted customer documents
      let list = [];
      const stored = localStorage.getItem("techware_customer_documents");
      if (stored) {
        try {
          list = JSON.parse(stored);
        } catch (_) {}
      }

      if (list.length === 0 && custList.length > 0) {
        // Sample default technical documents
        list = [
          {
            id: "doc-1",
            title: "Sheet Collation Machine (SCM-200) User Manual",
            category: "User Manuals & SOPs",
            fileType: "PDF",
            fileSize: "4.2 MB",
            customerId: custList[0]?.id,
            customerName: custList[0]?.companyName || custList[0]?.fullName || "Primary Client",
            uploadedDate: "2025-11-10",
            notes: "Complete operating procedure and calibration manual.",
          },
          {
            id: "doc-2",
            title: "ATR Control Panel Wiring Schematic",
            category: "Electrical & Wiring Schematics",
            fileType: "DWG/PDF",
            fileSize: "8.5 MB",
            customerId: custList[0]?.id,
            customerName: custList[0]?.companyName || custList[0]?.fullName || "Primary Client",
            uploadedDate: "2025-10-18",
            notes: "Circuit breaker and PLC I/O map diagram.",
          },
          {
            id: "doc-3",
            title: "Annual Maintenance Contract 2025-2026",
            category: "AMC & Service Contracts",
            fileType: "PDF",
            fileSize: "1.1 MB",
            customerId: custList[0]?.id,
            customerName: custList[0]?.companyName || custList[0]?.fullName || "Primary Client",
            uploadedDate: "2025-09-01",
            notes: "Signed AMC agreement covering quarterly visits.",
          },
        ];
        localStorage.setItem("techware_customer_documents", JSON.stringify(list));
      }

      setDocuments(list);
    } catch (err) {
      console.error("Failed to load customer documents:", err);
      toast.error(err.message || "Failed to load documents.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUploadDocument = (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Document title is required.");
      return;
    }

    setUploading(true);
    try {
      const matchedCust = customers.find((c) => c.id === form.customerId);
      const newDoc = {
        id: `doc-${Date.now()}`,
        title: form.title.trim(),
        category: form.category,
        fileType: "PDF",
        fileSize: "2.5 MB",
        customerId: form.customerId,
        customerName: matchedCust?.companyName || matchedCust?.fullName || "General / All Clients",
        uploadedDate: new Date().toISOString().split("T")[0],
        notes: form.notes.trim() || "No additional notes.",
      };

      const updated = [newDoc, ...documents];
      setDocuments(updated);
      localStorage.setItem("techware_customer_documents", JSON.stringify(updated));

      toast.success(`Document "${form.title}" added to vault!`);
      setUploadModalOpen(false);
      setForm({
        title: "",
        category: "User Manuals & SOPs",
        customerId: "",
        fileUrl: "",
        notes: "",
      });
    } catch (err) {
      toast.error("Failed to upload document.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (id, title) => {
    if (!confirm(`Delete document "${title}"?`)) return;
    const updated = documents.filter((d) => d.id !== id);
    setDocuments(updated);
    localStorage.setItem("techware_customer_documents", JSON.stringify(updated));
    toast.success(`Document "${title}" removed.`);
  };

  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      if (categoryFilter !== "ALL" && doc.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          doc.title.toLowerCase().includes(q) ||
          doc.customerName?.toLowerCase().includes(q) ||
          doc.category.toLowerCase().includes(q) ||
          doc.notes?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [documents, categoryFilter, searchQuery]);

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
              <span className="text-xs text-muted-foreground">Technical Vault</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Documents & Contracts Vault
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
            onClick={() => setUploadModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 text-white text-xs font-semibold shadow-xs hover:from-blue-700 hover:to-indigo-700 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            <Upload className="h-4 w-4" />
            Upload Document
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Stored Files</span>
          <div className="mt-2 text-3xl font-black text-blue-600 dark:text-blue-400">{documents.length}</div>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">AMC & Contracts</span>
          <div className="mt-2 text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {documents.filter((d) => d.category.includes("AMC") || d.category.includes("Contracts")).length}
          </div>
        </div>
        <div className="rounded-2xl border border-purple-500/20 bg-purple-500/10 p-5">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Schematics & SOPs</span>
          <div className="mt-2 text-3xl font-black text-purple-600 dark:text-purple-400">
            {documents.filter((d) => d.category.includes("Schematics") || d.category.includes("Manuals")).length}
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-secondary/50 border border-border w-fit overflow-x-auto">
          {DOCUMENT_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer ${
                categoryFilter === cat
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat === "ALL" ? "All Documents" : cat}
            </button>
          ))}
        </div>

        <div className="relative min-w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search manuals, schematics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Documents Grid / Table */}
      <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs">Loading document vault...</span>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-16 text-center">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">No documents in this category</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Upload machine user manuals, electrical schematics, or AMC agreements to store them for customer access.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {filteredDocs.map((doc) => (
              <div key={doc.id} className="p-5 hover:bg-secondary/20 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-sm text-foreground">{doc.title}</h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary border border-border text-foreground">
                        {doc.category}
                      </span>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {doc.fileSize}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground">{doc.notes}</p>

                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground pt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {doc.customerName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Uploaded: {doc.uploadedDate}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    onClick={() => toast.info(`Downloading "${doc.title}"...`)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-background hover:bg-secondary text-xs font-medium text-foreground transition-colors cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download</span>
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id, doc.title)}
                    className="p-1.5 rounded-lg border border-destructive/30 bg-destructive/5 hover:bg-destructive/15 text-destructive transition-colors cursor-pointer"
                    title="Delete document"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Document Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-xs">
          <div className="relative bg-card rounded-2xl border border-border shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95 duration-200">
            <h3 className="font-semibold text-base text-foreground mb-1">Upload Document to Vault</h3>
            <p className="text-xs text-muted-foreground mb-4">Add technical documentation, contracts, or schematics.</p>

            <form onSubmit={handleUploadDocument} className="space-y-4 text-xs">
              <div>
                <label className="font-medium text-foreground mb-1 block">Document Title *</label>
                <input
                  required
                  placeholder="e.g. Laser Marking Station Wiring Diagram (Rev 2.1)"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs"
                />
              </div>

              <div>
                <label className="font-medium text-foreground mb-1 block">Category *</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs"
                >
                  {DOCUMENT_CATEGORIES.filter((c) => c !== "ALL").map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-medium text-foreground mb-1 block">Assign to Client (Optional)</label>
                <select
                  value={form.customerId}
                  onChange={(e) => setForm((p) => ({ ...p, customerId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs"
                >
                  <option value="">-- General / Applicable to All Clients --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName || c.fullName} {c.city ? `(${c.city})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-medium text-foreground mb-1 block">Notes & Description</label>
                <textarea
                  rows={3}
                  placeholder="Additional context, revision number, or equipment model..."
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border bg-background text-xs font-medium hover:bg-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save to Vault
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerDocuments;
