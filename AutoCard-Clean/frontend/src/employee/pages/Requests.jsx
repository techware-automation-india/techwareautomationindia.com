import { useEffect, useState } from "react";
import { FileText, Loader2, Plus, RefreshCw, Send, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../lib/api.js";
import { clearAuth } from "../../lib/auth.js";

const statusStyles = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
};

const typeLabels = {
  GENERAL: "General",
  DOCUMENT: "Document",
  EQUIPMENT: "Equipment",
  CORRECTION: "Correction",
  OTHER: "Other",
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
};

const emptyForm = { type: "GENERAL", subject: "", description: "" };

const Requests = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const loadRequests = async () => {
    try {
      const data = await apiGet("/requests/my");
      setRequests(data.requests || []);
    } catch (err) {
      if (err.status === 401) {
        clearAuth();
        navigate("/login", { replace: true });
        return;
      }
      toast.error(err.message || "Failed to load requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [navigate]);

  const submitRequest = async (event) => {
    event.preventDefault();
    if (!form.subject.trim()) {
      toast.error("Please enter a subject.");
      return;
    }

    setSubmitting(true);
    try {
      await apiPost("/requests/my", form);
      toast.success("Request submitted successfully.");
      setForm(emptyForm);
      setShowForm(false);
      await loadRequests();
    } catch (err) {
      if (err.status === 401) {
        clearAuth();
        navigate("/login", { replace: true });
        return;
      }
      toast.error(err.message || "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Requests</h1>
            <p className="text-sm text-muted-foreground">Submit a request and track its status.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { setLoading(true); loadRequests(); }} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-secondary" aria-label="Refresh requests">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setShowForm((value) => !value)} className="inline-flex items-center gap-2 rounded-lg cta-gradient px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? "Cancel" : "New Request"}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={submitRequest} className="space-y-4 rounded-2xl border border-border bg-background p-6 card-shadow">
          <h2 className="font-display text-lg font-semibold">Submit New Request</h2>
          <label className="block text-sm font-medium">
            Subject
            <input required value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} maxLength={160} placeholder="Short description" className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          </label>
          <label className="block text-sm font-medium">
            Details
            <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength={5000} rows={4} placeholder="Add any details the admin should know" className="mt-2 w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm" />
          </label>
          <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit Request
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-background card-shadow">
        <div className="flex items-center justify-between border-b border-border p-6">
          <h2 className="font-display text-lg font-semibold">My Requests</h2>
          <span className="text-sm text-muted-foreground">{requests.length} total</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center p-12 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading requests...</div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">You have not submitted any requests.</div>
        ) : (
          <div className="divide-y divide-border">
            {requests.map((request) => (
              <div key={request.id} className="space-y-2 p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{typeLabels[request.type] || request.type}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[request.status] || "bg-secondary text-muted-foreground"}`}>{request.status}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{formatDate(request.createdAt)}</span>
                </div>
                <h3 className="font-semibold">{request.subject}</h3>
                {request.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{request.description}</p>}
                {request.reviewNote && <p className="rounded-lg bg-secondary/60 p-3 text-sm"><span className="font-semibold">Admin note:</span> {request.reviewNote}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Requests;
