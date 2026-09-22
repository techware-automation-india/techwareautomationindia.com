import { useEffect, useState } from "react";
import { BadgeCheck, Check, CheckCheck, Loader2, RefreshCw, X, Calendar, UserRound, Clock3, FileText, Briefcase, MapPin, MessageSquareText } from "lucide-react";
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
    checkInLatitude: item.checkInLatitude,
    checkInLongitude: item.checkInLongitude,
    checkOutLatitude: item.checkOutLatitude,
    checkOutLongitude: item.checkOutLongitude,
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
    checkInLatitude: item.checkInLatitude,
    checkInLongitude: item.checkInLongitude,
    checkOutLatitude: item.checkOutLatitude,
    checkOutLongitude: item.checkOutLongitude,
    status: item.status === "PENDING_APPROVAL"
      ? "PENDING"
      : item.note?.includes("Approved by admin")
        ? "APPROVED"
        : "REJECTED",
    createdAt: item.updatedAt || item.createdAt || item.date,
  }));

const openCheckInMap = (approval) => {
  const latitude = Number(approval.checkInLatitude);
  const longitude = Number(approval.checkInLongitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    toast.error("Check-in location coordinates are not available.");
    return;
  }
  window.open(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`, "_blank", "noopener,noreferrer");
};

const openCheckOutMap = (approval) => {
  const latitude = Number(approval.checkOutLatitude);
  const longitude = Number(approval.checkOutLongitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    toast.error("Check-out location coordinates are not available.");
    return;
  }
  window.open(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`, "_blank", "noopener,noreferrer");
};

const Approvals = () => {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState(null);
  const [reasonModal, setReasonModal] = useState(null);
  
  // Set default filters to current month/year
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [yearFilter, setYearFilter] = useState(String(currentYear));
  const [monthFilter, setMonthFilter] = useState(String(currentMonth));
  const [employeeFilter, setEmployeeFilter] = useState("ALL");

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

  // Get unique employee names for filter
  const employees = [...new Set(
    approvals
      .map((approval) => approval.employee)
      .filter(Boolean)
  )].sort();

  const filteredApprovals = approvals.filter((approval) => {
    const createdAt = new Date(approval.createdAt || 0);
    const matchesStatus = statusFilter === "ALL" || approval.status === statusFilter;
    const matchesYear = yearFilter === "ALL" || String(createdAt.getFullYear()) === yearFilter;
    const matchesMonth = monthFilter === "ALL" || String(createdAt.getMonth() + 1) === monthFilter;
    const matchesEmployee = employeeFilter === "ALL" || approval.employee === employeeFilter;
    return matchesStatus && matchesYear && matchesMonth && matchesEmployee;
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
            value={employeeFilter}
            onChange={(event) => setEmployeeFilter(event.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            aria-label="Filter approvals by employee"
          >
            <option value="ALL">All employees</option>
            {employees.map((emp) => (
              <option key={emp} value={emp}>{emp}</option>
            ))}
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
          <div className="p-4 sm:p-5 lg:p-6">
            <div className="grid gap-4 lg:gap-5">
              {filteredApprovals.map((approval) => {
                const actionId = `${approval.source}:${approval.id}`;
                const acting = actingId === actionId;
                
                // Determine icon and color based on source
                const getSourceIcon = () => {
                  switch(approval.source) {
                    case "ATTENDANCE":
                      return <Clock3 className="h-6 w-6" />;
                    case "LEAVE":
                      return <Briefcase className="h-6 w-6" />;
                    default:
                      return <FileText className="h-6 w-6" />;
                  }
                };
                
                const getSourceGradient = () => {
                  switch(approval.source) {
                    case "ATTENDANCE":
                      return "bg-gradient-to-br from-rose-500 to-rose-600";
                    case "LEAVE":
                      return "bg-gradient-to-br from-violet-500 to-violet-600";
                    default:
                      return "bg-gradient-to-br from-blue-500 to-blue-600";
                  }
                };
                
                return (
                  <div
                    key={actionId}
                    className="group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-background to-secondary/10 shadow-sm transition hover:shadow-md hover:border-primary/20"
                  >
                    {/* Status Indicator Bar */}
                    <div className={`absolute left-0 top-0 h-full w-1.5 ${
                      approval.status === "PENDING" ? "bg-amber-500" :
                      approval.status === "APPROVED" ? "bg-emerald-500" : "bg-rose-500"
                    }`} />
                    
                    <div className="p-5 pl-7">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex gap-4">
                          {/* Icon */}
                          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-sm text-white ${getSourceGradient()}`}>
                            {getSourceIcon()}
                          </div>
                          
                          {/* Content */}
                          <div className="min-w-0 flex-1">
                            {/* Badges Row */}
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-xl px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
                                approval.source === "ATTENDANCE" ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" :
                                approval.source === "LEAVE" ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" :
                                "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                              }`}>
                                {approval.source === "ATTENDANCE" ? "Attendance" : approval.source === "LEAVE" ? "Leave" : "Request"}
                              </span>
                              <span className={`rounded-xl px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
                                approval.status === "PENDING" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                                approval.status === "APPROVED" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                                "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                              }`}>
                                {approval.status}
                              </span>
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Calendar className="h-3.5 w-3.5" />
                                {formatDate(approval.createdAt)}
                              </span>
                            </div>
                            
                            {/* Title */}
                            <h3 className="mt-3 text-lg font-bold leading-tight text-foreground">
                              {approval.title}
                            </h3>
                            
                            {/* Punch Type Badge */}
                            {approval.punchType && (
                              <div className="mt-2 flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 dark:bg-slate-900/30 w-fit">
                                <Clock3 className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                  {approval.punchType}
                                </span>
                              </div>
                            )}
                            
                            {/* Employee Info */}
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <div className="flex items-center gap-2 rounded-lg bg-secondary/60 px-3 py-1.5">
                                <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-sm font-semibold text-foreground">
                                  {approval.employee}
                                </span>
                              </div>
                              {approval.employeeCode && (
                                <span className="text-xs font-medium text-muted-foreground">
                                  {approval.employeeCode}
                                </span>
                              )}
                            </div>
                            
                            {/* View Reason Button */}
                            {approval.description && (
                              <button
                                type="button"
                                onClick={() => setReasonModal(approval)}
                                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-secondary/80 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-primary/10 hover:text-primary"
                              >
                                <MessageSquareText className="h-4 w-4" />
                                <span>View Reason</span>
                              </button>
                            )}
                          </div>
                        </div>
                        
                        {/* Action Buttons - Right Side */}
                        <div className="flex shrink-0 flex-wrap items-center gap-2.5 lg:flex-col lg:items-stretch">
                          
                          {approval.status === "PENDING" ? (
                            <>
                              {/* Approve/Reject Buttons */}
                              <div className="flex w-full gap-2">
                                <button
                                  type="button"
                                  onClick={() => review(approval, "approve")}
                                  disabled={acting}
                                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:from-emerald-700 hover:to-emerald-800 hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                  {acting ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                  ) : (
                                    <Check className="h-5 w-5" />
                                  )}
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => review(approval, "reject")}
                                  disabled={acting}
                                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-rose-300 bg-white px-5 py-3 text-sm font-bold text-rose-700 transition hover:bg-rose-50 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed dark:bg-background dark:hover:bg-rose-950/20"
                                >
                                  <X className="h-5 w-5" />
                                  Reject
                                </button>
                              </div>
                            </>
                          ) : (
                            <div className="flex w-full items-center justify-center rounded-xl bg-secondary/50 px-4 py-3 text-center">
                              <div className="text-xs">
                                <div className="font-semibold text-muted-foreground">Reviewed</div>
                                <div className="mt-0.5 font-bold text-foreground">
                                  {formatDate(approval.createdAt)}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      
      {/* Reason Modal */}
      {reasonModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setReasonModal(null);
          }}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-background shadow-2xl">
            <div className="flex items-start justify-between border-b border-border p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <MessageSquareText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Request Details
                  </p>
                  <h3 className="mt-1 font-display text-lg font-bold">{reasonModal.title}</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReasonModal(null)}
                className="rounded-xl p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5 sm:p-6">
              {/* Employee Info & Reason */}
              <div className="rounded-2xl border border-border bg-secondary/30 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <UserRound className="h-4 w-4" />
                  {reasonModal.employee} · {reasonModal.employeeCode}
                </div>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                  {reasonModal.description || "No details provided."}
                </p>
              </div>

              {/* Map Buttons - Inside Reason Modal */}
              {(reasonModal.checkInLatitude != null || reasonModal.checkOutLatitude != null) && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    GPS Location
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {reasonModal.checkInLatitude != null && reasonModal.checkInLongitude != null && (
                      <button
                        onClick={() => openCheckInMap(reasonModal)}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 to-emerald-100 px-4 py-2.5 text-sm font-bold text-emerald-700 shadow-sm transition hover:from-emerald-100 hover:to-emerald-200 hover:shadow dark:from-emerald-950/50 dark:to-emerald-900/50 dark:text-emerald-300"
                        title="View check-in location on map"
                      >
                        <MapPin className="h-4 w-4" />
                        <span>Check-in Map</span>
                      </button>
                    )}
                    {reasonModal.checkOutLatitude != null && reasonModal.checkOutLongitude != null && (
                      <button
                        onClick={() => openCheckOutMap(reasonModal)}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-rose-300 bg-gradient-to-r from-rose-50 to-rose-100 px-4 py-2.5 text-sm font-bold text-rose-700 shadow-sm transition hover:from-rose-100 hover:to-rose-200 hover:shadow dark:from-rose-950/50 dark:to-rose-900/50 dark:text-rose-300"
                        title="View check-out location on map"
                      >
                        <MapPin className="h-4 w-4" />
                        <span>Check-out Map</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Submitted Date */}
              {reasonModal.createdAt && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Submitted</span>
                  <span className="font-semibold text-foreground">{formatDate(reasonModal.createdAt)}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-border bg-secondary/20 p-4">
              <button
                type="button"
                onClick={() => setReasonModal(null)}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
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

export default Approvals;
