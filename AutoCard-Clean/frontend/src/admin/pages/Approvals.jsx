import { useEffect, useState } from "react";
import { BadgeCheck, Check, CheckCheck, Loader2, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../lib/api.js";

const statusStyles = {
  PENDING: "bg-amber-100 text-amber-700",
  PENDING_APPROVAL: "bg-amber-100 text-amber-700",
};

const typeStyles = {
  REQUEST: "bg-blue-100 text-blue-700",
  LEAVE: "bg-violet-100 text-violet-700",
  ATTENDANCE: "bg-rose-100 text-rose-700",
};

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getPunchTypeLabel = (request) => {
  const punchType = request.notification?.punchType || (() => {
    if (typeof request.description !== "string") return null;
    const match = request.description.match(
      /\[ATTENDANCE_CORRECTION\]\s*(\{[\s\S]*\})\s*$/,
    );
    if (!match) return null;

    try {
      return JSON.parse(match[1]).punchType;
    } catch {
      return null;
    }
  })();

  return punchType === "check-in"
    ? "Check In"
    : punchType === "check-out"
      ? "Check Out"
      : punchType === "both"
        ? "Check In + Check Out"
        : null;
};

const normalizeRequests = (items) =>
  (items || []).map((item) => ({
    id: item.id,
    source: "REQUEST",
    title: item.type === "CORRECTION"
      ? `Forgot Punch${getPunchTypeLabel(item) ? ` - ${getPunchTypeLabel(item)}` : ""}`
      : item.subject || "Employee request",
    punchType: item.type === "CORRECTION" ? getPunchTypeLabel(item) : null,
    description: item.description || item.notification?.reason || "No details provided.",
    employee: item.employee?.fullName || "Employee",
    employeeCode: item.employee?.employeeCode || "",
    status: item.status === "PENDING" ? "PENDING" : item.status,
    createdAt: item.createdAt,
  }));

const normalizeLeave = (items) =>
  (items || [])
    .map((item) => ({
      id: item.id,
      source: "LEAVE",
      title: `${item.leaveType?.name || "Leave"} request`,
      description: item.reason || `${formatDate(item.startDate)} - ${formatDate(item.endDate)} (${item.totalDays} day(s))`,
      employee: item.employee?.user?.fullName || "Employee",
      employeeCode: item.employee?.employeeCode || "",
      status: item.status,
      createdAt: item.createdAt,
    }));

const normalizeAttendance = (items) =>
  (items || []).map((item) => ({
    id: item.id,
    source: "ATTENDANCE",
    title: "Attendance location approval",
    description: item.note || "Employee attendance requires approval.",
    employee: item.fullName || item.employee?.user?.fullName || "Employee",
    employeeCode: item.employee?.employeeCode || "",
    status: item.status === "PENDING_APPROVAL"
      ? "PENDING"
      : item.note?.includes("Approved by admin")
        ? "APPROVED"
        : "REJECTED",
    createdAt: item.updatedAt || item.createdAt || item.date,
  }));

const Approvals = () => {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [yearFilter, setYearFilter] = useState("ALL");
  const [monthFilter, setMonthFilter] = useState("ALL");

  const loadApprovals = async () => {
    setLoading(true);
    try {
      const [requestResult, leaveResult, attendanceResult] = await Promise.all([
        apiGet("/requests"),
        apiGet("/leave/admin/all"),
        apiGet("/attendance/admin/requests"),
      ]);

      setApprovals([
        ...normalizeRequests(requestResult.requests),
        ...normalizeLeave(leaveResult.requests),
        ...normalizeAttendance(attendanceResult.records),
      ].sort((first, second) => new Date(second.createdAt || 0) - new Date(first.createdAt || 0)));
    } catch (err) {
      toast.error(err.message || "Failed to load approvals.");
      setApprovals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApprovals();
  }, []);

  const years = [...new Set(
    approvals
      .map((approval) => new Date(approval.createdAt || 0).getFullYear())
      .filter((year) => year > 1970),
  )].sort((first, second) => second - first);

  const filteredApprovals = approvals.filter((approval) => {
    const createdAt = new Date(approval.createdAt || 0);
    const matchesStatus = statusFilter === "ALL" || approval.status === statusFilter;
    const matchesYear = yearFilter === "ALL" || String(createdAt.getFullYear()) === yearFilter;
    const matchesMonth = monthFilter === "ALL" || String(createdAt.getMonth() + 1) === monthFilter;
    return matchesStatus && matchesYear && matchesMonth;
  });

  const review = async (approval, decision) => {
    setActingId(`${approval.source}:${approval.id}`);
    try {
      const endpoint = approval.source === "LEAVE"
        ? `/leave/admin/${approval.id}/${decision}`
        : approval.source === "ATTENDANCE"
          ? `/attendance/${decision}/${approval.id}`
          : `/requests/${approval.id}/${decision}`;

      await apiPost(endpoint, approval.source === "LEAVE" ? { note: "" } : {});
      toast.success(`Request ${decision === "approve" ? "approved" : "rejected"}.`);
      await loadApprovals();
    } catch (err) {
      toast.error(err.message || "Approval action failed.");
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <BadgeCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Approvals</h1>
            <p className="text-sm text-muted-foreground">Approve or reject pending employee requests in one place.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadApprovals}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-background card-shadow overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            aria-label="Filter approvals by status"
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <select
            value={yearFilter}
            onChange={(event) => setYearFilter(event.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            aria-label="Filter approvals by year"
          >
            <option value="ALL">All years</option>
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
          <select
            value={monthFilter}
            onChange={(event) => setMonthFilter(event.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            aria-label="Filter approvals by month"
          >
            <option value="ALL">All months</option>
            {months.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
          </select>
          <span className="ml-auto text-sm text-muted-foreground">
            Showing {filteredApprovals.length} of {approvals.length}
          </span>
        </div>
        {loading ? (
          <div className="flex min-h-[260px] items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading approvals...
          </div>
        ) : filteredApprovals.length === 0 ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
            <CheckCheck className="h-10 w-10 text-emerald-500/60" />
            <h2 className="mt-3 font-semibold">No matching requests</h2>
            <p className="mt-1 text-sm text-muted-foreground">Try another status, year, or month filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredApprovals.map((approval) => {
              const actionId = `${approval.source}:${approval.id}`;
              const acting = actingId === actionId;
              return (
                <div key={actionId} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${typeStyles[approval.source]}`}>
                        {approval.source === "ATTENDANCE" ? "Attendance" : approval.source === "LEAVE" ? "Leave" : "Request"}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusStyles[approval.status] || "bg-secondary text-muted-foreground"}`}>
                        {approval.status}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDate(approval.createdAt)}</span>
                    </div>
                    <h2 className="mt-2 font-semibold">{approval.title}</h2>
                    {approval.punchType && (
                      <span className="mt-2 inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        Punch Type: {approval.punchType}
                      </span>
                    )}
                    <p className="mt-1 text-sm font-medium">{approval.employee} {approval.employeeCode && `· ${approval.employeeCode}`}</p>
                    <p className="mt-1 max-w-3xl whitespace-pre-wrap text-sm text-muted-foreground">{approval.description}</p>
                  </div>
                  {approval.status === "PENDING" && <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => review(approval, "approve")}
                      disabled={acting}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => review(approval, "reject")}
                      disabled={acting}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                    >
                      <X className="h-4 w-4" /> Reject
                    </button>
                  </div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Approvals;
