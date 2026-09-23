import { useEffect, useState } from "react";
import { ArrowLeft, ClipboardList, Loader2, RefreshCw, Calendar, Clock3, FileText, MapPin, MessageSquareText, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiGet } from "../../lib/api.js";
import { clearAuth } from "../../lib/auth.js";

const statusStyles = {
  PENDING: "bg-amber-100 text-amber-700",
  PENDING_APPROVAL: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

const typeStyles = {
  REQUEST: "bg-blue-100 text-blue-700",
  CORRECTION: "bg-blue-100 text-blue-700",
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

const formatTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const openMap = (latitude, longitude, type = "location") => {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    toast.error(`${type} coordinates are not available.`);
    return;
  }
  window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, "_blank", "noopener,noreferrer");
};

const getRequestReason = (request) => {
  if (request.type !== "CORRECTION" || !request.description) return request.description;
  const markerIndex = request.description.lastIndexOf("[ATTENDANCE_CORRECTION]");
  const readableDescription = request.description.slice(0, markerIndex);
  const separatedReason = readableDescription.split("\n\n").slice(1).join("\n\n").trim();
  return separatedReason || readableDescription.replace(
    /^Forgot Punch request for .*? on \d{4}-\d{2}-\d{2} at .*?(?:\.\s*|$)/i,
    "",
  ).trim();
};

const TrackRequests = ({ isAdmin = false }) => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reasonModal, setReasonModal] = useState(null);

  // Set default filters to current month/year
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [yearFilter, setYearFilter] = useState(String(currentYear));
  const [monthFilter, setMonthFilter] = useState(String(currentMonth));

  const loadRequests = async () => {
  setLoading(true);
  setLoadError("");

  try {
    // ============================================================
    // ADMIN
    // ============================================================
    // Admin must NOT call:
    // /requests/my
    // /leave/my
    // /attendance/my-requests
    //
    // Admin uses only:
    // GET /api/requests
    // ============================================================

    if (isAdmin) {
      const result = await apiGet("/requests");

      console.log("ADMIN TRACK REQUESTS:", result);

      const adminRequests = result.requests || [];

      setRequests(
        adminRequests.sort(
          (first, second) =>
            new Date(second.createdAt || 0) -
            new Date(first.createdAt || 0)
        )
      );

      return;
    }

    // ============================================================
    // EMPLOYEE
    // ============================================================

    const results = await Promise.allSettled([
      apiGet("/requests/my"),
      apiGet("/leave/my"),
      apiGet("/attendance/my-requests"),
    ]);

    const requestResult = results[0];
    const leaveResult = results[1];
    const attendanceResult = results[2];

    // ------------------------------------------------------------
    // GENERAL / FORGOT PUNCH REQUESTS
    // ------------------------------------------------------------

    const employeeRequests =
      requestResult.status === "fulfilled"
        ? requestResult.value.requests || []
        : [];

    // ------------------------------------------------------------
    // LEAVE REQUESTS
    // ------------------------------------------------------------

    const leaveRequests =
      leaveResult.status === "fulfilled"
        ? (leaveResult.value.requests || []).map(
            (request) => ({
              id: `leave-${request.id}`,

              type: "LEAVE",

              subject: `${
                request.leaveType?.name || "Leave"
              } request`,

              status: request.status,

              createdAt: request.createdAt,

              description:
                `${new Date(
                  request.startDate
                ).toLocaleDateString()} – ` +
                `${new Date(
                  request.endDate
                ).toLocaleDateString()} · ` +
                `${request.totalDays} day(s)` +
                (request.reason
                  ? `\nReason: ${request.reason}`
                  : ""),

              reviewNote: request.reviewNote,
            })
          )
        : [];

    // ------------------------------------------------------------
    // ATTENDANCE REQUESTS
    // ------------------------------------------------------------

    const attendanceRequests =
      attendanceResult.status === "fulfilled"
        ? (attendanceResult.value.records || []).map(
            (request) => ({
              id: `attendance-${request.id}`,

              type: "ATTENDANCE",

              subject:
                "Attendance location approval",

              status:
                request.status ===
                "PENDING_APPROVAL"
                  ? "PENDING"
                  : request.note?.includes(
                      "Approved by admin"
                    )
                    ? "APPROVED"
                    : "REJECTED",

              createdAt:
                request.createdAt ||
                request.date,

              description:
                request.note ||
                "Check-in or check-out from an unassigned location.",
            })
          )
        : [];

    // ------------------------------------------------------------
    // COMBINE EMPLOYEE REQUESTS
    // ------------------------------------------------------------

    setRequests(
      [
        ...employeeRequests,
        ...leaveRequests,
        ...attendanceRequests,
      ].sort(
        (first, second) =>
          new Date(second.createdAt || 0) -
          new Date(first.createdAt || 0)
      )
    );

    // ------------------------------------------------------------
    // AUTH ERROR
    // ------------------------------------------------------------

    const failedServices = results
      .map((result, index) => ({
        result,
        label: [
          "general requests",
          "leave requests",
          "attendance requests",
        ][index],
      }))
      .filter(
        ({ result }) =>
          result.status === "rejected"
      );

    const unauthorizedResult =
      failedServices.find(
        ({ result }) =>
          result.reason?.status === 401
      );

    if (unauthorizedResult) {
      clearAuth();

      navigate("/login", {
        replace: true,
      });

      return;
    }

    if (failedServices.length > 0) {
      const failedLabels =
        failedServices
          .map(({ label }) => label)
          .join(", ");

      const message =
        `Unable to load ${failedLabels}.`;

      setLoadError(message);

      toast.error(message);
    }
  } catch (err) {
    console.error(
      "Track Requests error:",
      err
    );

    if (err.status === 401) {
      clearAuth();

      navigate("/login", {
        replace: true,
      });

      return;
    }

    setLoadError(
      err.message ||
        "Failed to load requests."
    );

    toast.error(
      err.message ||
        "Failed to load requests."
    );
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    loadRequests();
    const intervalId = window.setInterval(loadRequests, 5000);
    return () => window.clearInterval(intervalId);
  }, [navigate]);

  // Get unique years and months from requests
  const years = Array.from(
    new Set(
      requests
        .map((r) => {
          const date = r.createdAt ? new Date(r.createdAt) : null;
          return date && !Number.isNaN(date.getTime()) ? date.getFullYear() : null;
        })
        .filter(Boolean)
    )
  ).sort((a, b) => b - a);

  const filteredRequests = requests.filter((request) => {
    // Status filter
    const matchesStatus = statusFilter === "ALL" || request.status === statusFilter;
    if (!matchesStatus) return false;

    // Year/Month filter
    const createdDate = request.createdAt ? new Date(request.createdAt) : null;
    if (!createdDate || Number.isNaN(createdDate.getTime())) return false;

    const requestYear = createdDate.getFullYear();
    const requestMonth = createdDate.getMonth() + 1;

    if (yearFilter !== "ALL" && requestYear !== Number(yearFilter)) return false;
    if (monthFilter !== "ALL" && requestMonth !== Number(monthFilter)) return false;

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-secondary"
            aria-label="Back to requests"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <ClipboardList className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Track My Request</h1>
            <p className="text-sm text-muted-foreground">
              {isAdmin
                ? "View requests created by your admin account and their current status."
                : "View your submitted requests and their current status."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setLoading(true); loadRequests(); }}
          className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-secondary"
          aria-label="Refresh requests"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status Filter */}
        {[
          ["ALL", "All Status"],
          ["PENDING", "Pending"],
          ["APPROVED", "Approved"],
          ["REJECTED", "Rejected"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatusFilter(value)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}

        <div className="ml-auto flex gap-2">
          {/* Year Filter */}
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="ALL">All Years</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>

          {/* Month Filter */}
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="ALL">All Months</option>
            {months.map((month, idx) => (
              <option key={idx + 1} value={idx + 1}>
                {month}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-border bg-background p-12 card-shadow">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Loading requests...</span>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="rounded-2xl border border-border bg-background p-12 text-center card-shadow">
          {loadError && <p className="mb-3 text-rose-600">{loadError}</p>}
          <p className="text-sm text-muted-foreground">
            No {statusFilter !== "ALL" && `${statusFilter.toLowerCase()} `}requests found
            {yearFilter !== "ALL" && ` for ${yearFilter}`}
            {monthFilter !== "ALL" && ` ${months[Number(monthFilter) - 1]}`}.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredRequests.map((request) => (
            <div
              key={request.id}
              className="rounded-2xl border border-border bg-background p-6 card-shadow hover:border-primary/40 transition-colors"
            >
              {/* Card Header */}
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${typeStyles[request.type] || "bg-gray-100 text-gray-700"}`}>
                    {request.type === "CORRECTION" ? "FORGOT PUNCH" : request.type}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${statusStyles[request.status] || "bg-secondary text-muted-foreground"}`}>
                    {request.status}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setReasonModal(request)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  View Reason
                </button>
              </div>

              {/* Card Content */}
              <h3 className="mb-3 font-semibold text-foreground">{request.subject}</h3>

              <div className="grid gap-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(request.createdAt)}</span>
                  <Clock3 className="ml-2 h-4 w-4" />
                  <span>{formatTime(request.createdAt)}</span>
                </div>

                {request.reviewNote && (
                  <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                    <p className="text-xs font-medium text-emerald-900">Admin Response:</p>
                    <p className="mt-1 text-sm text-emerald-700">{request.reviewNote}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Reason Modal */}
      {reasonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setReasonModal(null)}>
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-background card-shadow" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border p-6">
              <div>
                <h2 className="font-display text-xl font-bold">Request Details</h2>
                <p className="mt-1 text-sm text-muted-foreground">{reasonModal.subject}</p>
              </div>
              <button
                type="button"
                onClick={() => setReasonModal(null)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="space-y-4 p-6">
              {/* Status Badges */}
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${typeStyles[reasonModal.type] || "bg-gray-100 text-gray-700"}`}>
                  {reasonModal.type === "CORRECTION" ? "FORGOT PUNCH" : reasonModal.type}
                </span>
                <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${statusStyles[reasonModal.status] || "bg-secondary text-muted-foreground"}`}>
                  {reasonModal.status}
                </span>
              </div>

              {/* Date/Time Info */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(reasonModal.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4" />
                  <span>{formatTime(reasonModal.createdAt)}</span>
                </div>
              </div>

              {/* Reason/Description */}
              <div className="rounded-lg bg-secondary/50 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <MessageSquareText className="h-4 w-4" />
                  <span>Reason</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {getRequestReason(reasonModal) || reasonModal.description || "No reason provided."}
                </p>
              </div>

              {/* GPS Map Buttons */}
              {(reasonModal.checkInLatitude || reasonModal.checkOutLatitude) && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="h-4 w-4" />
                    <span>Location</span>
                  </div>
                  <div className="flex gap-2">
                    {reasonModal.checkInLatitude && reasonModal.checkInLongitude && (
                      <button
                        type="button"
                        onClick={() => openMap(reasonModal.checkInLatitude, reasonModal.checkInLongitude, "Check-in")}
                        className="flex-1 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
                      >
                        📍 View Check In Map
                      </button>
                    )}
                    {reasonModal.checkOutLatitude && reasonModal.checkOutLongitude && (
                      <button
                        type="button"
                        onClick={() => openMap(reasonModal.checkOutLatitude, reasonModal.checkOutLongitude, "Check-out")}
                        className="flex-1 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-medium text-violet-700 hover:bg-violet-100"
                      >
                        📍 View Check Out Map
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Admin Response */}
              {reasonModal.reviewNote && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-900">
                    <FileText className="h-4 w-4" />
                    <span>Admin Response</span>
                  </div>
                  <p className="text-sm text-emerald-700">{reasonModal.reviewNote}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-border p-6">
              <button
                type="button"
                onClick={() => setReasonModal(null)}
                className="w-full rounded-lg bg-secondary px-4 py-2.5 font-medium hover:bg-secondary/80"
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

export default TrackRequests;
