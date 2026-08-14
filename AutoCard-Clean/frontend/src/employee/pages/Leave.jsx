import { useEffect, useState } from "react";
import {
  Plane, Loader2, RefreshCw, Plus, X, CalendarDays,
  CheckCircle2, Clock, XCircle, Ban, Send, AlertTriangle, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../lib/api.js";

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (d) => {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const today = () => new Date().toISOString().slice(0, 10);

const STATUS_STYLE = {
  PENDING:   "bg-amber-100 text-amber-700",
  APPROVED:  "bg-emerald-100 text-emerald-700",
  REJECTED:  "bg-rose-100 text-rose-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};
const STATUS_ICON = {
  PENDING:   <Clock className="h-3.5 w-3.5" />,
  APPROVED:  <CheckCircle2 className="h-3.5 w-3.5" />,
  REJECTED:  <XCircle className="h-3.5 w-3.5" />,
  CANCELLED: <Ban className="h-3.5 w-3.5" />,
};

const inputClass =
  "w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow";

// ── component ─────────────────────────────────────────────────────────────────
const Leave = () => {
  const [balances, setBalances]       = useState([]);
  const [leaveTypes, setLeaveTypes]   = useState([]);
  const [requests, setRequests]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling]   = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [filterStatus, setFilterStatus] = useState("ALL");

  const [form, setForm] = useState({
    leaveTypeId: "",
    startDate: today(),
    endDate: today(),
    reason: "",
  });

  const load = async () => {
    try {
      const [balRes, myRes, typesRes] = await Promise.all([
        apiGet("/leave/balances"),
        apiGet("/leave/my"),
        apiGet("/leave/types"),
      ]);
      setBalances(balRes.balances);
      setRequests(myRes.requests);
      setLeaveTypes(typesRes.leaveTypes);
    } catch (err) {
      toast.error(err.message || "Failed to load leave data.");
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => { setLoading(true); load(); };

  useEffect(() => { load(); }, []);

  const handleApply = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.leaveTypeId) { toast.error("Please select a leave type."); return; }
    if (form.endDate < form.startDate) { toast.error("End date must be on or after start date."); return; }
    setSubmitting(true);
    try {
      const res = await apiPost("/leave/apply", form);
      if (res.autoApproved) {
        toast.success("Emergency leave applied and automatically approved!");
      } else {
        toast.success("Leave application submitted! Awaiting admin approval.");
      }
      setShowForm(false);
      setForm({ leaveTypeId: "", startDate: today(), endDate: today(), reason: "" });
      refresh();
    } catch (err) {
      toast.error(err.message || "Failed to apply for leave.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget || cancelling) return;
    setCancelling(true);
    try {
      await apiPost(`/leave/${cancelTarget.id}/cancel`, {});
      toast.success("Leave request cancelled.");
      setCancelTarget(null);
      refresh();
    } catch (err) {
      toast.error(err.message || "Failed to cancel leave.");
    } finally {
      setCancelling(false);
    }
  };

  const filtered = filterStatus === "ALL"
    ? requests
    : requests.filter((r) => r.status === filterStatus);

  // Remaining days for selected leave type in apply form
  const selectedBalance = balances.find((b) => b.leaveTypeId === form.leaveTypeId);
  const selectedLeaveType = leaveTypes.find((lt) => lt.id === form.leaveTypeId);

  if (loading) {
    return (
      <div className="p-12 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading leave data…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Plane className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Leave</h1>
            <p className="text-sm text-muted-foreground">Apply for leave and track your requests.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="p-2 rounded-lg border border-border hover:bg-secondary transition-colors text-muted-foreground"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="cta-gradient text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Apply for Leave
          </button>
        </div>
      </div>

      {/* Balance cards */}
      {balances.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {balances.map((b) => {
            const pct = b.allocated > 0 ? Math.min(100, (b.used / b.allocated) * 100) : 0;
            const lt = leaveTypes.find((l) => l.id === b.leaveTypeId);
            const isAutoApproved = lt && lt.requiresApproval === false;
            return (
              <div key={b.leaveTypeId} className="rounded-2xl bg-background border border-border card-shadow p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {b.leaveTypeCode}
                  </span>
                  <div className="flex items-center gap-1">
                    {isAutoApproved && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700 flex items-center gap-0.5">
                        <Zap className="h-3 w-3" /> Auto
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.isPaid ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                      {b.isPaid ? "Paid" : "Unpaid"}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium truncate">{b.leaveTypeName}</p>
                  <p className="text-2xl font-bold mt-1">
                    {b.remaining}
                    <span className="text-sm font-normal text-muted-foreground"> / {b.allocated} days</span>
                  </p>
                </div>
                {/* Progress bar */}
                <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${pct > 80 ? "bg-rose-500" : pct > 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{b.used} used · {b.year}</p>
              </div>
            );
          })}
        </div>
      )}

      {balances.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No leave types configured yet. Contact your admin.
        </div>
      )}

      {/* Leave history */}
      <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-display text-lg font-semibold">Leave History</h2>
          <div className="flex items-center gap-2 flex-wrap">
            {["ALL", "PENDING", "APPROVED", "REJECTED", "CANCELLED"].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  filterStatus === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
            No leave requests found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border bg-secondary/30">
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">From</th>
                  <th className="px-5 py-3 font-medium">To</th>
                  <th className="px-5 py-3 font-medium">Days</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Note</th>
                  <th className="px-5 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-3 font-medium">
                      {r.leaveType?.name ?? "—"}
                      <p className="text-xs text-muted-foreground font-normal">{r.reason || "—"}</p>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">{fmt(r.startDate)}</td>
                    <td className="px-5 py-3 whitespace-nowrap">{fmt(r.endDate)}</td>
                    <td className="px-5 py-3">{r.totalDays}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLE[r.status]}`}>
                        {STATUS_ICON[r.status]}
                        {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground max-w-[160px] truncate">
                      {r.reviewNote || "—"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {r.status === "PENDING" && (
                        <button
                          onClick={() => setCancelTarget(r)}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Apply modal ────────────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/50" onClick={() => !submitting && setShowForm(false)} />
          <div className="relative bg-background rounded-2xl border border-border shadow-xl w-full max-w-lg">
            {/* Modal header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Plane className="h-4.5 w-4.5 text-primary" />
                </div>
                <h2 className="font-display text-lg font-semibold">Apply for Leave</h2>
              </div>
              <button
                onClick={() => setShowForm(false)}
                disabled={submitting}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body */}
            <form onSubmit={handleApply} className="p-6 space-y-4">
              {/* Leave type */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Leave Type <span className="text-destructive">*</span>
                </label>
                <select
                  className={inputClass}
                  value={form.leaveTypeId}
                  onChange={(e) => setForm((p) => ({ ...p, leaveTypeId: e.target.value }))}
                  required
                >
                  <option value="">Select leave type…</option>
                  {leaveTypes.map((lt) => {
                    const bal = balances.find((b) => b.leaveTypeId === lt.id);
                    return (
                      <option key={lt.id} value={lt.id}>
                        {lt.name} ({bal ? bal.remaining : lt.daysPerYear} days remaining)
                      </option>
                    );
                  })}
                </select>
                {selectedBalance && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Available: <strong>{selectedBalance.remaining}</strong> of {selectedBalance.allocated} days
                  </p>
                )}
                {/* Auto-approve notice */}
                {selectedLeaveType && (selectedLeaveType.code === "EML" || selectedLeaveType.requiresApproval === false) && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
                    <Zap className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                    <span>
                      <strong>Auto Approved</strong> — {selectedLeaveType.code === "EML" ? "EML leave is emergency leave and does not require admin approval." : "This leave type does not require admin approval and will be approved instantly."}
                    </span>
                  </div>
                )}
                {/* Pending-approval notice */}
                {selectedLeaveType && selectedLeaveType.code !== "EML" && (selectedLeaveType.requiresApproval ?? true) === true && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                    <Clock className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                    <span>
                      <strong>Pending Approval</strong> — Your request will be sent to admin for review.
                    </span>
                  </div>
                )}
                {selectedLeaveType && selectedLeaveType.code !== "EML" && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700">
                    <span>
                      <strong>Notice:</strong> Non-EML leave must be applied at least 2 days before the leave start date.
                    </span>
                  </div>
                )}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    Start Date <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="date"
                    className={inputClass}
                    value={form.startDate}
                    min={today()}
                    onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value, endDate: e.target.value > p.endDate ? e.target.value : p.endDate }))}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    End Date <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="date"
                    className={inputClass}
                    value={form.endDate}
                    min={form.startDate}
                    onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                    required
                  />
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Reason</label>
                <textarea
                  className={inputClass + " resize-none"}
                  rows={3}
                  value={form.reason}
                  onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                  maxLength={500}
                  placeholder="Optional — briefly describe the reason for your leave"
                />
              </div>

              {/* Footer buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={submitting}
                  className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="cta-gradient text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center gap-2"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {submitting ? "Submitting…" : "Submit Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Cancel confirmation modal ──────────────────────────────────────── */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/50" onClick={() => !cancelling && setCancelTarget(null)} />
          <div className="relative bg-background rounded-2xl border border-border shadow-xl w-full max-w-md p-6">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-lg">Cancel Leave Request</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Cancel your <strong>{cancelTarget.leaveType?.name}</strong> leave from{" "}
                  <strong>{fmt(cancelTarget.startDate)}</strong> to <strong>{fmt(cancelTarget.endDate)}</strong>?
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setCancelTarget(null)}
                disabled={cancelling}
                className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50"
              >
                Keep
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 px-4 py-2.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                {cancelling ? "Cancelling…" : "Yes, Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leave;
