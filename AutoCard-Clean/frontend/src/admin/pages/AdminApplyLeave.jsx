import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  Loader2,
  Send,
  Zap,
  CheckCircle2,
  Clock,
  Briefcase,
  RefreshCw,
  Search,
  Users,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../lib/api.js";

const inputClass =
  "w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow";

const today = () => new Date().toISOString().slice(0, 10);

const formatDate = (d) => {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const AdminApplyLeave = () => {
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [balances, setBalances] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actingId, setActingId] = useState(null);

  // Filters for All Employees Leaves table
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [form, setForm] = useState({
    leaveTypeId: "",
    startDate: today(),
    endDate: today(),
    reason: "",
  });

  const loadData = async () => {
    try {
      const [typesRes, balRes, allRes] = await Promise.all([
        apiGet("/leave/types"),
        apiGet("/leave/balances").catch(() => ({ balances: [] })),
        apiGet("/leave/admin/all").catch(() => ({ requests: [] })),
      ]);
      setLeaveTypes(typesRes.leaveTypes || []);
      setBalances(balRes.balances || []);
      setAllRequests(allRes.requests || []);
    } catch (err) {
      toast.error(err.message || "Failed to load leave configuration.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e) => {
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
      await apiPost("/leave/apply", form);
      toast.success("Leave applied successfully! Auto-approved for Admin.");
      setForm({ leaveTypeId: "", startDate: today(), endDate: today(), reason: "" });
      await loadData();
    } catch (err) {
      toast.error(err.message || "Failed to apply for leave.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (id, decision) => {
    setActingId(id);
    try {
      await apiPost(`/leave/admin/${id}/${decision}`, { note: "" });
      toast.success(`Leave request ${decision === "approve" ? "approved" : "rejected"}.`);
      await loadData();
    } catch (err) {
      toast.error(err.message || "Action failed.");
    } finally {
      setActingId(null);
    }
  };

  const selectedBalance = balances.find((b) => b.leaveTypeId === form.leaveTypeId);

  // Filter all employee requests based on status and search query
  const filteredAllRequests = allRequests.filter((req) => {
    const matchesStatus = statusFilter === "ALL" || req.status === statusFilter;
    const empName = req.employee?.user?.fullName || "";
    const empCode = req.employee?.employeeCode || "";
    const matchesSearch =
      !searchQuery ||
      empName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      empCode.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-8">
      {/* Top Bar Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Link
            to="/admin/requests"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Requests
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <CalendarDays className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">Apply & Manage Leaves</h1>
              <p className="text-sm text-muted-foreground">
                Apply for leave, manage your balances, and review all employees' taken and pending leaves.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setLoading(true);
            loadData();
          }}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60 self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Auto-Approval Notice */}
      <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
        <Zap className="h-5 w-5 shrink-0" />
        <div className="text-xs font-medium">
          <span className="font-bold">Instant Admin Approval:</span> Leave requests submitted by Administrators are automatically approved and deducted from balance without requiring review.
        </div>
      </div>

      {/* Main Grid: Left Side (Apply Form) | Right Side (Remaining Balances & All Employee Leaves) */}
      <div className="grid gap-8 lg:grid-cols-12">
        {/* LEFT SIDE: Apply Leave Form */}
        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-border bg-background p-6 card-shadow sticky top-6">
            <h2 className="font-display text-lg font-semibold mb-1">Apply for Leave</h2>
            <p className="text-xs text-muted-foreground mb-6">
              Fill in dates and select leave type to apply.
            </p>

            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading form...
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Leave Type Selection */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Leave Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={form.leaveTypeId}
                    onChange={(e) => setForm({ ...form, leaveTypeId: e.target.value })}
                    required
                    className={inputClass}
                  >
                    <option value="">Select Leave Type</option>
                    {leaveTypes.map((lt) => (
                      <option key={lt.id} value={lt.id}>
                        {lt.name} ({lt.code}) — {lt.daysPerYear} days/yr
                      </option>
                    ))}
                  </select>
                  {selectedBalance && (
                    <div className="mt-2 text-xs font-semibold text-primary flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Remaining: {selectedBalance.remaining} day(s) left
                    </div>
                  )}
                </div>

                {/* Start Date */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Start Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    required
                    className={inputClass}
                  />
                </div>

                {/* End Date */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    End Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    required
                    className={inputClass}
                  />
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Reason / Remarks
                  </label>
                  <textarea
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    rows={3}
                    placeholder="Notes or reason for leave..."
                    className={inputClass}
                  />
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Processing...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" /> Apply Leave (Auto-Approve)
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* RIGHT SIDE: Remaining Balances & All Employees Taken & Pending Leaves */}
        <div className="lg:col-span-7 space-y-8">
          {/* Section 1: Remaining Leave Balances */}
          <div className="space-y-4">
            <h2 className="font-display text-lg font-semibold flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" /> Remaining Admin Leave Balances
            </h2>

            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground bg-background rounded-2xl border border-border">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Loading balances...
              </div>
            ) : balances.length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed border-border text-center text-sm text-muted-foreground bg-background">
                No leave balances configured yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {balances.map((b) => {
                  const pct = b.allocated > 0 ? Math.min(100, (b.used / b.allocated) * 100) : 0;
                  return (
                    <div
                      key={b.leaveTypeId}
                      className="rounded-2xl bg-background border border-border card-shadow p-5 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          {b.leaveTypeCode}
                        </span>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                            b.isPaid ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {b.isPaid ? "Paid" : "Unpaid"}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold truncate">{b.leaveTypeName}</p>
                        <p className="text-2xl font-bold mt-1 text-foreground">
                          {b.remaining}
                          <span className="text-xs font-normal text-muted-foreground ml-1">
                            / {b.allocated} days left
                          </span>
                        </p>
                      </div>
                      {/* Progress bar */}
                      <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct > 80 ? "bg-rose-500" : pct > 50 ? "bg-amber-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {b.used} day(s) used in {b.year}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: All Employees Taken & Pending Leaves */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> All Employees Taken & Pending Leaves
              </h2>

              {/* Status Filters */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1">
                {["ALL", "PENDING", "APPROVED", "REJECTED"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                      statusFilter === s
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search employee by name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">
              {loading ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Loading employee leaves...
                </div>
              ) : filteredAllRequests.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  No employee leave requests found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border bg-secondary/30">
                        <th className="px-4 py-3 font-semibold">Employee</th>
                        <th className="px-4 py-3 font-semibold">Type</th>
                        <th className="px-4 py-3 font-semibold">Dates</th>
                        <th className="px-4 py-3 font-semibold">Days</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredAllRequests.map((req) => {
                        const empName = req.employee?.user?.fullName || "Employee";
                        const empCode = req.employee?.employeeCode || "";
                        const isPending = req.status === "PENDING";
                        const isActing = actingId === req.id;

                        return (
                          <tr key={req.id} className="hover:bg-secondary/20 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-semibold text-foreground">{empName}</div>
                              {empCode && (
                                <div className="text-xs text-muted-foreground">{empCode}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                              {req.leaveType?.name || "Leave"}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                              {formatDate(req.startDate)} - {formatDate(req.endDate)}
                            </td>
                            <td className="px-4 py-3 font-bold text-xs">{req.totalDays} d</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                                  req.status === "APPROVED"
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                    : req.status === "PENDING"
                                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                      : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                                }`}
                              >
                                {req.status === "PENDING" && <Clock className="h-3 w-3" />}
                                {req.status === "APPROVED" && <CheckCircle2 className="h-3 w-3" />}
                                {req.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              {isPending ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleReview(req.id, "approve")}
                                    disabled={isActing}
                                    className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-50 transition-colors"
                                    title="Approve Leave"
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleReview(req.id, "reject")}
                                    disabled={isActing}
                                    className="p-1.5 rounded-lg bg-rose-100 text-rose-700 hover:bg-rose-200 disabled:opacity-50 transition-colors"
                                    title="Reject Leave"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminApplyLeave;
