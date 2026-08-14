import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Check, X, Inbox } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../lib/api.js";

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
  CANCELLED: "bg-gray-100 text-gray-500",
};

const LeaveRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState(null);
  const [reviewNote, setReviewNote] = useState("");

  const loadRequests = async () => {
    try {
      const data = await apiGet("/leave/admin/all");
      setRequests(data.requests);
    } catch (err) {
      toast.error(err.message || "Failed to load leave requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const review = async (id, decision) => {
    setActingId(id);
    try {
      await apiPost(`/leave/admin/${id}/${decision}`, { note: reviewNote });
      toast.success(`Leave request ${decision === "approve" ? "approved" : "rejected"}.`);
      setReviewNote("");
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
          <h1 className="font-display text-2xl font-bold">Leave Requests</h1>
          <p className="text-sm text-muted-foreground">Review leave applications and approve or reject them.</p>
        </div>
      </div>

      <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="font-display text-lg font-semibold">Pending & Past Leave Requests</h2>
          <button
            onClick={() => {
              setLoading(true);
              loadRequests();
            }}
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
          <div className="p-12 text-center text-sm text-muted-foreground">No leave requests yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {requests.map((r) => (
              <div key={r.id} className="p-6 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                      {r.leaveType?.name || "Leave"}
                    </span>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusStyles[r.status]}`}>
                      {r.status}
                    </span>
                  </div>
                  <div className="font-semibold">{r.employee.user.fullName}</div>
                  <div className="text-sm text-muted-foreground">
                    {r.employee.employeeCode} · {r.employee.user.email}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {fmt(r.startDate)} – {fmt(r.endDate)} · {r.totalDays} day(s)
                  </div>
                  {r.reason && <p className="text-sm text-muted-foreground mt-2">Reason: {r.reason}</p>}
                  {r.reviewNote && <p className="text-sm text-muted-foreground mt-1">Note: {r.reviewNote}</p>}
                </div>

                {r.status === "PENDING" ? (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                    <button
                      onClick={() => review(r.id, "approve")}
                      disabled={actingId === r.id}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-60"
                    >
                      {actingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Approve
                    </button>
                    <button
                      onClick={() => review(r.id, "reject")}
                      disabled={actingId === r.id}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-rose-50 text-rose-700 transition-colors disabled:opacity-60"
                    >
                      <X className="h-4 w-4" /> Reject
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground shrink-0">
                    Reviewed {r.reviewedAt ? fmt(r.reviewedAt) : "—"}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaveRequests;
