import { useEffect, useState } from "react";
import { Inbox, Loader2, Check, X, RefreshCw, Eye } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../lib/api.js";
import OnboardingPreview from "../components/OnboardingPreview.jsx";

const fmt = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const statusStyles = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
};

const typeLabels = {
  ONBOARDING: "Onboarding",
  GENERAL: "General",
  DOCUMENT: "Document",
  EQUIPMENT: "Equipment",
  CORRECTION: "Correction",
  OTHER: "Other",
};

const Requests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState(null);
  const [previewId, setPreviewId] = useState(null);

  const loadRequests = async () => {
    try {
      const data = await apiGet("/requests");
      setRequests(data.requests);
    } catch (err) {
      toast.error(err.message || "Failed to load requests.");
    } finally {
      setLoading(false);
    }
  };

  // User-triggered refresh shows the loading state then refetches.
  const refresh = () => {
    setLoading(true);
    loadRequests();
  };

  useEffect(() => {
    (async () => {
      await loadRequests();
    })();
  }, []);

  const review = async (id, decision) => {
    setActingId(id);
    try {
      await apiPost(`/requests/${id}/${decision}`, {});
      toast.success(`Request ${decision === "approve" ? "approved" : "rejected"}.`);
      setPreviewId(null);
      loadRequests();
    } catch (err) {
      toast.error(err.message || "Action failed.");
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Inbox className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Requests</h1>
          <p className="text-sm text-muted-foreground">Review and act on incoming employee requests.</p>
        </div>
      </div>

      <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="font-display text-lg font-semibold">Pending & Past Requests</h2>
          <button
            onClick={refresh}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-12 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
          </div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No requests yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {requests.map((r) => (
              <div key={r.id} className="p-6 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                      {typeLabels[r.type] || r.type}
                    </span>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusStyles[r.status]}`}>
                      {r.status}
                    </span>
                  </div>
                  <div className="font-semibold">{r.subject}</div>
                  <div className="text-sm text-muted-foreground">
                    {r.employee.fullName} · {r.employee.employeeCode} · {r.employee.email}
                  </div>
                  {r.description && <p className="text-sm text-muted-foreground mt-1">{r.description}</p>}
                </div>

                {r.status === "PENDING" ? (
                  <div className="flex items-center gap-2 shrink-0">
                    {r.type === "ONBOARDING" && (
                      <button
                        onClick={() => setPreviewId(r.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors"
                      >
                        <Eye className="h-4 w-4" /> Preview
                      </button>
                    )}
                    <button
                      onClick={() => review(r.id, "approve")}
                      disabled={actingId === r.id}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-60"
                    >
                      {actingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Approve
                    </button>
                    <button
                      onClick={() => review(r.id, "reject")}
                      disabled={actingId === r.id}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-60"
                    >
                      <X className="h-4 w-4" /> Reject
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground shrink-0">
                    Reviewed {r.reviewedAt ? fmt(r.reviewedAt) : ""}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {previewId && (
        <OnboardingPreview
          requestId={previewId}
          acting={actingId === previewId}
          onClose={() => setPreviewId(null)}
          onApprove={() => review(previewId, "approve")}
          onReject={() => review(previewId, "reject")}
        />
      )}
    </div>
  );
};

export default Requests;
