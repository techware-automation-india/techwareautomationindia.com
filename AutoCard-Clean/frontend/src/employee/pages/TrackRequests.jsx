import { useEffect, useState } from "react";
import { ArrowLeft, ClipboardList, Loader2, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiGet } from "../../lib/api.js";
import { clearAuth } from "../../lib/auth.js";

const statusStyles = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
  CANCELLED: "bg-gray-100 text-gray-500",
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
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [monthFilter, setMonthFilter] = useState("ALL");
  const [loadError, setLoadError] = useState("");

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

  const monthOptions = Array.from(
    new Set(
      requests
        .map((request) => {
          const value = request.createdAt ? new Date(request.createdAt) : null;
          if (!value || Number.isNaN(value.getTime())) return null;
          return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
        })
        .filter(Boolean),
    ),
  ).sort((first, second) => second.localeCompare(first));

  const filteredRequests = requests.filter((request) => {
    const matchesStatus = statusFilter === "ALL" || request.status === statusFilter;
    if (!matchesStatus) return false;

    if (monthFilter === "ALL") return true;

    const createdDate = request.createdAt ? new Date(request.createdAt) : null;
    if (!createdDate || Number.isNaN(createdDate.getTime())) return false;

    const monthKey = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, "0")}`;
    return monthKey === monthFilter;
  });

  return (
    <div className="space-y-8">
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

      <div className="overflow-hidden rounded-2xl border border-border bg-background card-shadow">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-6">
          <h2 className="mr-auto font-display text-lg font-semibold">My Requests</h2>

          <select
            value={monthFilter}
            onChange={(event) => setMonthFilter(event.target.value)}
            className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground outline-none focus:border-primary"
            aria-label="Filter requests by month"
          >
            <option value="ALL">All Months</option>
            {monthOptions.map((monthKey) => (
              <option key={monthKey} value={monthKey}>
                {new Date(`${monthKey}-01T00:00:00`).toLocaleString("en-US", { month: "long", year: "numeric" })}
              </option>
            ))}
          </select>

          {[
            ["ALL", "All"],
            ["PENDING", "Pending"],
            ["APPROVED", "Approved"],
            ["REJECTED", "Rejected"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="flex items-center justify-center p-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading requests...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            {loadError && <p className="mb-2 text-rose-600">{loadError}</p>}
            {monthFilter === "ALL"
              ? `No ${statusFilter === "ALL" ? "requests" : statusFilter.toLowerCase()} requests.`
              : `No requests found for ${new Date(`${monthFilter}-01T00:00:00`).toLocaleString("en-US", { month: "long", year: "numeric" })}.`}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredRequests.map((request) => (
              <div key={request.id} className="space-y-2 p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{request.type}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[request.status] || "bg-secondary text-muted-foreground"}`}>{request.status}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{new Date(request.createdAt).toLocaleDateString()}</span>
                </div>
                <h2 className="font-semibold">{request.subject}</h2>
                {getRequestReason(request) && (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {request.type === "CORRECTION" && <span className="font-semibold text-foreground">Reason: </span>}
                    {getRequestReason(request)}
                  </p>
                )}
                {request.reviewNote && <p className="rounded-lg bg-secondary/60 p-3 text-sm"><span className="font-semibold">Admin note:</span> {request.reviewNote}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrackRequests;
