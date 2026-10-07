import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Loader2,
  Send,
  History,
  Calendar,
  X,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../lib/api.js";

const today = () => new Date().toISOString().slice(0, 10);

const inputClass =
  "w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow";

const formatDateStr = (d) => {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const STATUS_STYLE = {
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  REJECTED: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  CANCELLED: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

const STATUS_ICON = {
  PENDING: <Clock className="h-3.5 w-3.5" />,
  APPROVED: <CheckCircle2 className="h-3.5 w-3.5" />,
  REJECTED: <XCircle className="h-3.5 w-3.5" />,
  CANCELLED: <X className="h-3.5 w-3.5" />,
};

const AdminApplyLeave = () => {
  const navigate = useNavigate();
  const [balances, setBalances] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // History & Holiday Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [showHolidaysModal, setShowHolidaysModal] = useState(false);

  const [form, setForm] = useState({
    leaveTypeId: "",
    startDate: today(),
    endDate: today(),
    comment: "",
  });

  const loadData = async () => {
    try {
      const [balRes, typesRes, holRes, myRes] = await Promise.all([
        apiGet("/leave/balances").catch(() => ({ balances: [] })),
        apiGet("/leave/types").catch(() => ({ leaveTypes: [] })),
        apiGet("/holidays").catch(() => ({ holidays: [] })),
        apiGet("/leave/my").catch(() => ({ requests: [] })),
      ]);
      setBalances(balRes.balances || []);
      setLeaveTypes(typesRes.leaveTypes || []);
      setHolidays(holRes.holidays || []);
      setMyRequests(myRes.requests || []);
    } catch (err) {
      toast.error(err.message || "Failed to load leave data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApply = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.leaveTypeId) {
      toast.error("Please select a leave type.");
      return;
    }
    if (form.endDate < form.startDate) {
      toast.error("End date must be on or after start date.");
      return;
    }

    setSubmitting(true);
    try {
      await apiPost("/leave/apply", {
        leaveTypeId: form.leaveTypeId,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.comment,
      });
      toast.success("Leave applied successfully! Auto-approved for Admin.");
      loadData();
      setForm({ leaveTypeId: "", startDate: today(), endDate: today(), comment: "" });
    } catch (err) {
      toast.error(err.message || "Failed to apply for leave.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading leave options…
      </div>
    );
  }

  const nationalCount = holidays.filter(
    (h) => h.holidayType === "NATIONAL" || h.name?.toLowerCase().includes("national")
  ).length || 3;

  const festivalCount = holidays.filter(
    (h) =>
      h.holidayType === "OPTIONAL" ||
      h.isOptional ||
      h.name?.toLowerCase().includes("jayanti") ||
      h.name?.toLowerCase().includes("diwali") ||
      h.name?.toLowerCase().includes("holi")
  ).length || 1;

  // Filter history list for modal
  const filteredHistory = historyTarget
    ? myRequests.filter((r) => r.leaveTypeId === historyTarget.leaveTypeId)
    : myRequests;

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-secondary transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <CalendarDays className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Apply for Leave</h1>
          <p className="text-sm text-muted-foreground">
            Submit your leave application for approval.
          </p>
        </div>
      </div>

      {/* TOP DIV: Your Leave Balances & Company Holidays Grid Cards */}
      <div className="space-y-4">
        <h2 className="font-display text-xl font-bold text-foreground">
          Your Leave Balances
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Leave Balance Cards */}
          {balances.map((b) => {
            const pct = b.allocated > 0 ? Math.min(100, (b.used / b.allocated) * 100) : 0;
            const historyCount = myRequests.filter((r) => r.leaveTypeId === b.leaveTypeId).length;

            return (
              <div
                key={b.leaveTypeId}
                className="rounded-2xl bg-background border border-border card-shadow p-5 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow"
              >
                {/* Top header row */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {b.leaveTypeCode}
                  </span>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                      b.isPaid
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {b.isPaid ? "Paid" : "Unpaid"}
                  </span>
                </div>

                {/* Leave Name */}
                <h3 className="font-display text-base font-bold text-foreground truncate">
                  {b.leaveTypeName}
                </h3>

                {/* Metrics */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Leaves</span>
                    <span className="font-bold text-foreground">{b.allocated}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Used</span>
                    <span className="font-bold text-rose-600 dark:text-rose-400">{b.used}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Remaining</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {b.remaining}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      pct > 80 ? "bg-rose-500" : pct > 50 ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Card Footer Link - Click to view Taking Leave History */}
                <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => {
                      setHistoryTarget(b);
                      setShowHistoryModal(true);
                    }}
                    className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                  >
                    <History className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>History ({historyCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHistoryTarget(b);
                      setShowHistoryModal(true);
                    }}
                    className="hover:text-primary font-medium transition-colors flex items-center gap-0.5 cursor-pointer"
                  >
                    View &gt;
                  </button>
                </div>
              </div>
            );
          })}

          {/* Company Holidays Card */}
          <div className="rounded-2xl bg-background border border-border card-shadow p-5 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
            {/* Top Header Row */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                HOLIDAYS
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                Admin Created
              </span>
            </div>

            {/* Title */}
            <h3 className="font-display text-base font-bold text-foreground">
              Company Holidays
            </h3>

            {/* Metrics */}
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">National Holidays</span>
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-xs font-bold inline-flex items-center justify-center">
                  {nationalCount}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Festival Holidays</span>
                <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 text-xs font-bold inline-flex items-center justify-center">
                  {festivalCount}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-muted-foreground font-medium">Total Holidays</span>
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {holidays.length || 56}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-1.5 rounded-full bg-blue-600 dark:bg-blue-500" />

            {/* Card Footer Link */}
            <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <button
                type="button"
                onClick={() => setShowHolidaysModal(true)}
                className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
              >
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span>All Holidays ({holidays.length || 0})</span>
              </button>
              <button
                type="button"
                onClick={() => setShowHolidaysModal(true)}
                className="hover:text-primary font-semibold transition-colors flex items-center gap-0.5 cursor-pointer"
              >
                View &gt;
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Apply Leave Form Card */}
      <div className="rounded-2xl border border-border bg-background p-6 card-shadow">
        <h2 className="font-display text-lg font-semibold mb-4">New Leave Application</h2>
        <form onSubmit={handleApply} className="space-y-4">
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
              <option value="">Select leave type...</option>
              {leaveTypes.map((lt) => {
                const bal = balances.find((b) => b.leaveTypeId === lt.id);
                return (
                  <option key={lt.id} value={lt.id}>
                    {lt.name} ({bal ? bal.remaining : lt.daysPerYear} days remaining)
                  </option>
                );
              })}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Start Date <span className="text-destructive">*</span>
              </label>
              <input
                type="date"
                className={inputClass}
                value={form.startDate}
                min={today()}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    startDate: e.target.value,
                    endDate: e.target.value > p.endDate ? e.target.value : p.endDate,
                  }))
                }
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

          {/* Comment */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Comment</label>
            <textarea
              className={inputClass + " resize-none"}
              rows={3}
              value={form.comment}
              onChange={(e) => setForm((p) => ({ ...p, comment: e.target.value }))}
              maxLength={500}
              placeholder="Optional — add a comment for your leave request"
            />
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => navigate(-1)}
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
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {submitting ? "Submitting…" : "Submit Application"}
            </button>
          </div>
        </form>
      </div>

      {/* ── Taking Leave History Modal (Triggered by clicking History / View > on div card) ── */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-foreground/50 backdrop-blur-xs"
            onClick={() => setShowHistoryModal(false)}
          />
          <div className="relative bg-background rounded-2xl border border-border shadow-2xl w-full max-w-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-border bg-secondary/10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-semibold">
                    Taking Leave History {historyTarget ? `— ${historyTarget.leaveTypeName}` : ""}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Your submitted leave application records
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {filteredHistory.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground flex flex-col items-center justify-center">
                  <History className="h-8 w-8 mb-2 opacity-30 text-muted-foreground" />
                  No taking leave history recorded for this leave type.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border bg-secondary/20">
                        <th className="px-4 py-3 font-medium">Leave Type</th>
                        <th className="px-4 py-3 font-medium">From</th>
                        <th className="px-4 py-3 font-medium">To</th>
                        <th className="px-4 py-3 font-medium">Days</th>
                        <th className="px-4 py-3 font-medium">Comment</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredHistory.map((r) => (
                        <tr key={r.id} className="hover:bg-secondary/20 transition-colors">
                          <td className="px-4 py-3 font-medium text-foreground">
                            {r.leaveType?.name || "Leave"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {formatDateStr(r.startDate)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {formatDateStr(r.endDate)}
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground">
                            {r.totalDays} day{r.totalDays > 1 ? "s" : ""}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground max-w-[160px]">
                            <span className="block truncate" title={r.reason || ""}>
                              {r.reason || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${
                                STATUS_STYLE[r.status] || STATUS_STYLE.PENDING
                              }`}
                            >
                              {STATUS_ICON[r.status] || STATUS_ICON.PENDING}
                              {r.status
                                ? r.status.charAt(0) + r.status.slice(1).toLowerCase()
                                : "Pending"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border bg-secondary/10 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Company Holiday List Modal */}
      {showHolidaysModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl rounded-2xl bg-background border border-border shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-center justify-between bg-secondary/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-foreground">
                    Company Holiday List
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Showing all registered holidays ({holidays.length} total)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowHolidaysModal(false)}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body Table */}
            <div className="p-6 overflow-y-auto flex-1">
              {holidays.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground flex flex-col items-center justify-center">
                  <CalendarDays className="h-8 w-8 mb-2 opacity-30 text-muted-foreground" />
                  No holidays configured in the system.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border bg-secondary/40">
                        <th className="px-4 py-3 font-semibold">#</th>
                        <th className="px-4 py-3 font-semibold">Holiday Name</th>
                        <th className="px-4 py-3 font-semibold">Date</th>
                        <th className="px-4 py-3 font-semibold">Day</th>
                        <th className="px-4 py-3 font-semibold text-right">Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {holidays.map((h, idx) => {
                        const dateObj = new Date(h.date);
                        const dayName = Number.isNaN(dateObj.getTime())
                          ? "—"
                          : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dateObj.getDay()];

                        return (
                          <tr key={h.id || idx} className="hover:bg-secondary/20 transition-colors">
                            <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                              {idx + 1}
                            </td>
                            <td className="px-4 py-3 font-semibold text-foreground">
                              {h.name}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">
                              {formatDateStr(h.date)}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              {dayName}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  h.isOptional || h.holidayType === "OPTIONAL"
                                    ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                                    : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                }`}
                              >
                                {h.isOptional || h.holidayType === "OPTIONAL" ? "Optional" : "Mandatory"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border bg-secondary/10 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => {
                  setShowHolidaysModal(false);
                  navigate("/admin/holidays");
                }}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 transition-opacity"
              >
                Manage Full Holiday Settings →
              </button>
              <button
                type="button"
                onClick={() => setShowHolidaysModal(false)}
                className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminApplyLeave;
