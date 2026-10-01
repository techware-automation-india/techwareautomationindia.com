import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ClipboardList,
  Loader2,
  RefreshCw,
  Calendar,
  Clock3,
  FileText,
  MapPin,
  MessageSquareText,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiGet } from "../../lib/api.js";
import { clearAuth } from "../../lib/auth.js";

const statusStyles = {
  PENDING: "bg-amber-100 text-amber-700",
  PENDING_APPROVAL: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  PRESENT: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
  ABSENT: "bg-rose-100 text-rose-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

const typeStyles = {
  REQUEST: "bg-blue-100 text-blue-700",
  CORRECTION: "bg-blue-100 text-blue-700",
  LEAVE: "bg-violet-100 text-violet-700",
  ATTENDANCE: "bg-rose-100 text-rose-700",
};

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
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

const formatDistance = (value) => {
  if (value == null || value === "") return "";
  let str = String(value).replace(/\s*away\s*$/i, "").trim();
  if (str.endsWith("m") || str.endsWith("km")) return str;
  const num = parseFloat(str.replace(/[^0-9.]/g, ""));
  if (Number.isNaN(num)) return str;

  if (num < 1) {
    const meters = Math.round(num * 1000);
    return `${meters} m`;
  }
  const formattedKm = Number.isInteger(num) ? num : parseFloat(num.toFixed(2));
  return `${formattedKm} km`;
};

const openMap = (latitude, longitude, type = "location") => {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    toast.error(`${type} coordinates are not available.`);
    return;
  }
  window.open(
    `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    "_blank",
    "noopener,noreferrer",
  );
};

const normalizeStatus = (status, note = "", reviewNote = "") => {
  const s = String(status || "").toUpperCase();
  const n = (String(note || "") + " " + String(reviewNote || "")).toLowerCase();

  if (s === "PENDING_APPROVAL" || s === "PENDING") return "PENDING";
  if (s === "APPROVED" || s === "PRESENT" || n.includes("approved")) return "APPROVED";
  if (s === "REJECTED" || s === "ABSENT" || n.includes("rejected")) return "REJECTED";
  if (s === "CANCELLED") return "CANCELLED";

  return "PENDING";
};

const getRequestReason = (request) => {
  if (!request?.description) return "No reason provided.";
  let text = String(request.description || "");

  const markerIndex = text.indexOf("[ATTENDANCE_CORRECTION]");
  if (markerIndex !== -1) {
    text = text.substring(0, markerIndex).trim();
  }

  text = text
    .replace(/^Forgot Punch request for (?:both|check-in|check-out|Check In|Check Out) on \d{4}-\d{2}-\d{2}\.?\s*/i, "")
    .replace(/^Forgot Punch request for .*? on \d{4}-\d{2}-\d{2} at .*?(?:\.\s*|$)/i, "")
    .replace(/Check-In Location:.*$/i, "")
    .replace(/Check-Out Location:.*$/i, "")
    .replace(/\|?\s*Pending admin approval\.?/gi, "")
    .replace(/\|?\s*Approved by admin\.?/gi, "")
    .replace(/\|?\s*Rejected by admin\.?/gi, "")
    .replace(/\|/g, "")
    .trim();

  return text || "No reason provided.";
};
const getForgotPunchData = (request) => {
  if (request?.type !== "CORRECTION" || !request?.description) {
    return null;
  }

  const marker = "[ATTENDANCE_CORRECTION]";
  const markerIndex = request.description.lastIndexOf(marker);

  if (markerIndex === -1) {
    return null;
  }

  const jsonText = request.description
    .slice(markerIndex + marker.length)
    .trim();

  if (!jsonText) {
    return null;
  }

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    console.warn(
      "Skipping malformed Forgot Punch data:",
      request.id || "unknown request",
    );

    return null;
  }
};

const getAttendanceReason = (note = "", reason = "") => {
  const text = String(note || "").trim();
  const directReason = String(reason || "").trim();

  if (!text && directReason) {
    return {
      reason: directReason,
      checkInReason: directReason,
      checkOutReason: "",
      checkInDistance: null,
      checkOutDistance: null,
    };
  }

  const markerIndex = text.indexOf("[ATTENDANCE_CORRECTION]");
  const cleanText = markerIndex !== -1 ? text.substring(0, markerIndex).trim() : text;

  // Extract distances
  const checkInDistance =
    cleanText.match(/Checkin[^|]*?\(([0-9.]+(?:\s*(?:km|m))?)\s*(?:away)?\)/i)?.[1] ||
    cleanText.match(/\(([0-9.]+\s*(?:km|m)?)\s*(?:away)?\)/i)?.[1] ||
    null;

  const checkOutDistance =
    cleanText.match(/[Cc]heckout[^|]*?\(([0-9.]+(?:\s*(?:km|m))?)\s*(?:away)?\)/i)?.[1] ||
    null;

  // Split by pipe to get checkin and checkout parts
  const parts = cleanText.split("|").map(s => s.trim()).filter(Boolean);

  const sanitize = (rawStr) => {
    if (!rawStr) return "";
    return rawStr
      .replace(/^Checkin\s+(from|to|location)?[^.]*?\.\s*/i, "")
      .replace(/^Checkout\s+(recorded|from|to|location)?[^.]*?\.\s*/i, "")
      .replace(/^Checkin:/i, "")
      .replace(/^Checkout:/i, "")
      .replace(/^Check-?[io]ut?:\s*/i, "")
      .replace(/Reason:\s*/i, "")
      .replace(/\s*\([0-9.]+\s*km(?:\s*away)?\)\.?/gi, "")
      .replace(/\s*Pending admin approval\.?/gi, "")
      .replace(/\s*Approved by admin\.?/gi, "")
      .replace(/\s*Rejected by admin\.?/gi, "")
      .replace(/\s*Admin approved\.?/gi, "")
      .replace(/\s*Admin rejected\.?/gi, "")
      .trim();
  };

  // Extract reasons from Reason: pattern
  const reasonMatches = [
    ...cleanText.matchAll(/Reason:\s*(.*?)(?=\.?\s*(?:Pending admin approval|Admin approved|Admin rejected|Approved by admin|Rejected by admin)\b|\s*\||$)/gi),
  ]
    .map((match) => match[1].trim())
    .filter(Boolean);

  let checkInReason = "";
  let checkOutReason = "";

  // Check if note has both checkin and checkout parts (pipe separated)
  const checkoutPart = parts.find(p =>
    /checkout/i.test(p) || /check.?out/i.test(p)
  );
  const checkinPart = parts.find(p =>
    /checkin/i.test(p) || /check.?in/i.test(p)
  );

  if (reasonMatches.length >= 2) {
    checkInReason = sanitize(reasonMatches[0]);
    checkOutReason = sanitize(reasonMatches[1]);
  } else if (reasonMatches.length === 1) {
    // Determine if it's checkin or checkout reason
    if (checkoutPart && /Reason:/i.test(checkoutPart)) {
      checkOutReason = sanitize(reasonMatches[0]);
      checkInReason = directReason || sanitize(checkinPart || "");
    } else {
      checkInReason = sanitize(reasonMatches[0]);
    }
  } else {
    checkInReason = directReason || sanitize(checkinPart || cleanText);
    checkOutReason = sanitize(checkoutPart || "");
  }

  const fullClean = sanitize(cleanText);

  return {
    reason: fullClean || directReason || "No reason provided.",
    checkInReason: checkInReason || directReason || fullClean || "No check-in reason provided.",
    checkOutReason: checkOutReason || "",
    checkInDistance,
    checkOutDistance,
  };
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
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [yearFilter, setYearFilter] = useState(String(currentYear));
  const [monthFilter, setMonthFilter] = useState(String(currentMonth));

  const loadRequests = async () => {
    setLoading(true);
    setLoadError("");

    try {
      if (isAdmin) {
        const result = await apiGet("/requests");

        console.log("ADMIN TRACK REQUESTS:", result);

        const adminRequests = result.requests || [];

        setRequests(
          adminRequests.sort(
            (first, second) =>
              new Date(second.createdAt || 0) - new Date(first.createdAt || 0),
          ),
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
          ? (requestResult.value.requests || []).map((request) => ({
              ...request,
              status: normalizeStatus(request.status, request.description || request.note, request.reviewNote),
              forgotPunch: getForgotPunchData(request),
              reviewedAt: request.reviewedAt || null,
            }))
          : [];

      // ------------------------------------------------------------
      // LEAVE REQUESTS
      // ------------------------------------------------------------

      const leaveRequests =
        leaveResult.status === "fulfilled"
          ? (leaveResult.value.requests || []).map((request) => ({
              id: `leave-${request.id}`,
              type: "LEAVE",
              subject: `${request.leaveType?.name || "Leave"} request`,
              status: normalizeStatus(request.status, request.reason, request.reviewNote),
              createdAt: request.createdAt,
              reviewedAt: request.reviewedAt || null,
              description:
                `${new Date(request.startDate).toLocaleDateString()} – ` +
                `${new Date(request.endDate).toLocaleDateString()} · ` +
                `${request.totalDays} day(s)` +
                (request.reason ? `\nReason: ${request.reason}` : ""),
              reviewNote: request.reviewNote,
            }))
          : [];

      // ------------------------------------------------------------
      // ATTENDANCE REQUESTS
      // ------------------------------------------------------------

      const attendanceRequests =
        attendanceResult.status === "fulfilled"
          ? (attendanceResult.value.records || []).map((request) => ({
              id: `attendance-${request.id}`,

              type: "ATTENDANCE",

              subject: "Attendance Location Approval",

              status: normalizeStatus(request.status, request.note, request.reviewNote),

              createdAt: request.createdAt || request.date,

              reviewedAt: request.status !== "PENDING_APPROVAL" ? (request.updatedAt || null) : null,

              checkInTime: request.checkIn || request.createdAt || request.date,
              checkOutTime: request.checkOut || null,

              // IMPORTANT
              description: request.note || "",

              // IMPORTANT
              note: request.note || "",

              // IMPORTANT
              reason: request.reason || "",

              checkInLatitude: request.checkInLatitude ?? null,
              checkInLongitude: request.checkInLongitude ?? null,

              checkOutLatitude: request.checkOutLatitude ?? null,
              checkOutLongitude: request.checkOutLongitude ?? null,

              // Exact road distances from backend enrichAttendanceRecordsWithDistance
              checkInDistance: request.checkInDistance ?? null,
              checkOutDistance: request.checkOutDistance ?? null,

              reviewNote: request.reviewNote,
              reviewedAt: request.updatedAt || null,
            }))
          : [];

      // ------------------------------------------------------------
      // COMBINE EMPLOYEE REQUESTS
      // ------------------------------------------------------------

      setRequests(
        [...employeeRequests, ...leaveRequests, ...attendanceRequests].sort(
          (first, second) =>
            new Date(second.createdAt || 0) - new Date(first.createdAt || 0),
        ),
      );

      // ------------------------------------------------------------
      // AUTH ERROR
      // ------------------------------------------------------------

      const failedServices = results
        .map((result, index) => ({
          result,
          label: ["general requests", "leave requests", "attendance requests"][
            index
          ],
        }))
        .filter(({ result }) => result.status === "rejected");

      const unauthorizedResult = failedServices.find(
        ({ result }) => result.reason?.status === 401,
      );

      if (unauthorizedResult) {
        clearAuth();

        navigate("/login", {
          replace: true,
        });

        return;
      }

      if (failedServices.length > 0) {
        const failedLabels = failedServices
          .map(({ label }) => label)
          .join(", ");

        const message = `Unable to load ${failedLabels}.`;

        setLoadError(message);

        toast.error(message);
      }
    } catch (err) {
      console.error("Track Requests error:", err);

      if (err.status === 401) {
        clearAuth();

        navigate("/login", {
          replace: true,
        });

        return;
      }

      setLoadError(err.message || "Failed to load requests.");

      toast.error(err.message || "Failed to load requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [navigate]);

  // Get unique years and months from requests
  const years = Array.from(
    new Set(
      requests
        .map((r) => {
          const date = r.createdAt ? new Date(r.createdAt) : null;
          return date && !Number.isNaN(date.getTime())
            ? date.getFullYear()
            : null;
        })
        .filter(Boolean),
    ),
  ).sort((a, b) => b - a);

  const filteredRequests = requests.filter((request) => {
    // =====================================================
    // STATUS FILTER
    // =====================================================

    const matchesStatus =
      statusFilter === "ALL" || request.status === statusFilter;

    if (!matchesStatus) {
      return false;
    }

    // =====================================================
    // REQUEST TYPE FILTER
    // =====================================================

    const matchesType = typeFilter === "ALL" || request.type === typeFilter;

    if (!matchesType) {
      return false;
    }

    // =====================================================
    // YEAR / MONTH FILTER
    // =====================================================

    const createdDate = request.createdAt ? new Date(request.createdAt) : null;

    if (!createdDate || Number.isNaN(createdDate.getTime())) {
      return false;
    }

    const requestYear = createdDate.getFullYear();
    const requestMonth = createdDate.getMonth() + 1;

    if (yearFilter !== "ALL" && requestYear !== Number(yearFilter)) {
      return false;
    }

    if (monthFilter !== "ALL" && requestMonth !== Number(monthFilter)) {
      return false;
    }

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
            <h1 className="font-display text-2xl font-bold">
              Track My Request
            </h1>
            <p className="text-sm text-muted-foreground">
              {isAdmin
                ? "View requests created by your admin account and their current status."
                : "View your submitted requests and their current status."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            loadRequests();
          }}
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

        <div className="w-full sm:w-auto sm:ml-auto flex flex-wrap sm:flex-nowrap gap-2">
          {/* Year Filter */}
          {/* Request Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="ALL">All Types</option>

            <option value="CORRECTION">Forgot Punch</option>

            <option value="ATTENDANCE">Attendance</option>
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
            No{" "}
            {typeFilter !== "ALL"
              ? typeFilter === "CORRECTION"
                ? "Forgot Punch"
                : typeFilter === "ATTENDANCE"
                  ? "Attendance"
                  : typeFilter === "LEAVE"
                    ? "Leave"
                    : "General"
              : ""}{" "}
            {statusFilter !== "ALL" ? statusFilter.toLowerCase() : ""} requests
            found
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
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${typeStyles[request.type] || "bg-gray-100 text-gray-700"}`}
                  >
                    {request.type === "CORRECTION"
                      ? "FORGOT PUNCH"
                      : request.type}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${statusStyles[request.status] || "bg-secondary text-muted-foreground"}`}
                  >
                    {request.status}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setReasonModal(request)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    View Reason
                  </button>
                </div>
              </div>

              {/* Card Content */}
              <h3 className="mb-3 font-semibold text-foreground">
                {request.subject}
              </h3>

              <div className="grid gap-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(request.createdAt)}</span>
                  <Clock3 className="ml-2 h-4 w-4" />
                  <span>{formatTime(request.createdAt)}</span>
                </div>

                
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Reason Modal */}
      {reasonModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setReasonModal(null)}
        >
          <div
            className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-background card-shadow"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="font-display text-lg font-bold">Message</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {reasonModal.subject}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReasonModal(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="space-y-4 p-5">
              {/* Status Badges */}
              <div className="flex flex-wrap gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${typeStyles[reasonModal.type] || "bg-gray-100 text-gray-700"}`}
                >
                  {reasonModal.type === "CORRECTION"
                    ? "FORGOT PUNCH"
                    : reasonModal.type}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${statusStyles[reasonModal.status] || "bg-secondary text-muted-foreground"}`}
                >
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
                <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <MessageSquareText className="h-4 w-4" />
                  <span>Message</span>
                </div>
                {reasonModal.type === "CORRECTION" ? (
                  (() => {
                    const forgotPunch = getForgotPunchData(reasonModal);

                    return (
                      <div className="space-y-3">
                        {/* Date */}
                        <div>
                          <p className="text-xs text-muted-foreground">Date</p>
                          <p className="text-sm font-medium text-foreground">
                            {forgotPunch?.date || "—"}
                          </p>
                        </div>

                        {/* Punch Type */}
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Punch Type
                          </p>
                          <p className="text-sm font-medium text-foreground">
                            {forgotPunch?.punchType === "both"
                              ? "Check In + Check Out"
                              : forgotPunch?.punchType === "check-in"
                                ? "Check In"
                                : forgotPunch?.punchType === "check-out"
                                  ? "Check Out"
                                  : "—"}
                          </p>
                        </div>

                        {/* Check In Time */}
                        {forgotPunch?.checkInTime && (
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Check In Time
                            </p>
                            <p className="text-sm font-medium text-foreground">
                              {forgotPunch.checkInTime}
                            </p>
                          </div>
                        )}

                        {/* Check In Location */}
                        {forgotPunch?.checkInLocation && (
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Check In Location
                            </p>
                            <p className="text-sm font-medium text-foreground">
                              {forgotPunch.checkInLocation}
                            </p>
                          </div>
                        )}

                        {/* Check Out Time */}
                        {forgotPunch?.checkOutTime && (
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Check Out Time
                            </p>
                            <p className="text-sm font-medium text-foreground">
                              {forgotPunch.checkOutTime}
                            </p>
                          </div>
                        )}

                        {/* Check Out Location */}
                        {forgotPunch?.checkOutLocation && (
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Check Out Location
                            </p>
                            <p className="text-sm font-medium text-foreground">
                              {forgotPunch.checkOutLocation}
                            </p>
                          </div>
                        )}

                        {/* Reason */}
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Reason
                          </p>
                          <p className="whitespace-pre-wrap text-sm font-medium text-foreground">
                            {getRequestReason(reasonModal) ||
                              "No reason provided."}
                          </p>
                        </div>
                      </div>
                    );
                  })()
                ) : reasonModal.type === "ATTENDANCE" ? (
                  (() => {
                    const attendanceReason = getAttendanceReason(
                      reasonModal.note || reasonModal.description || "",
                      reasonModal.reason || "",
                    );

                    return (
                      <div className="space-y-4">
                        {/* 1. CHECK-IN DIV */}
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20 space-y-3">
                          <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2.5 dark:border-emerald-900/40">
                            <div className="flex items-center gap-2">
                              <Clock3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                                Check-In Details
                              </span>
                            </div>
                            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                              Check-In Time: {formatTime(reasonModal.checkInTime || reasonModal.createdAt)}
                            </span>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground">
                              Check-In Reason
                            </p>
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium leading-6 text-foreground">
                              {attendanceReason.checkInReason || "No check-in reason provided."}
                            </p>
                            {(reasonModal.checkInDistance || attendanceReason.checkInDistance) && (
                              <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                Distance from office: {formatDistance(reasonModal.checkInDistance || attendanceReason.checkInDistance)} away
                              </p>
                            )}
                          </div>
                        </div>

                        {/* 2. CHECK-OUT DIV */}
                        {(reasonModal.checkOutTime || reasonModal.checkOutLatitude || reasonModal.checkOutDistance) && (
                          <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-900/40 dark:bg-rose-950/20 space-y-3">
                            <div className="flex items-center justify-between border-b border-rose-200/60 pb-2.5 dark:border-rose-900/40">
                              <div className="flex items-center gap-2">
                                <Clock3 className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                                <span className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                                  Check-Out Details
                                </span>
                              </div>
                              {reasonModal.checkOutTime && (
                                <span className="text-xs font-bold text-rose-800 dark:text-rose-300">
                                  Check-Out Time: {formatTime(reasonModal.checkOutTime)}
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground">
                                Check-Out Reason
                              </p>
                              <p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium leading-6 text-foreground">
                                {attendanceReason.checkOutReason || "No check-out reason provided."}
                              </p>
                              {(reasonModal.checkOutDistance || attendanceReason.checkOutDistance) && (
                                <p className="mt-2 text-xs font-semibold text-rose-700 dark:text-rose-400">
                                  Distance from office: {formatDistance(reasonModal.checkOutDistance || attendanceReason.checkOutDistance)} away
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {getRequestReason(reasonModal) ||
                      reasonModal.description ||
                      "No reason provided."}
                  </p>
                )}
              </div>

              {/* GPS Map Buttons */}
              {(reasonModal.checkInLatitude ||
                reasonModal.checkOutLatitude) && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="h-4 w-4" />
                    <span>Location</span>
                  </div>
                  <div className="flex gap-2">
                    {reasonModal.checkInLatitude &&
                      reasonModal.checkInLongitude && (
                        <button
                          type="button"
                          onClick={() =>
                            openMap(
                              reasonModal.checkInLatitude,
                              reasonModal.checkInLongitude,
                              "Check-in",
                            )
                          }
                          className="flex-1 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
                        >
                          📍 View Check In Map
                        </button>
                      )}
                    {reasonModal.checkOutLatitude &&
                      reasonModal.checkOutLongitude && (
                        <button
                          type="button"
                          onClick={() =>
                            openMap(
                              reasonModal.checkOutLatitude,
                              reasonModal.checkOutLongitude,
                              "Check-out",
                            )
                          }
                          className="flex-1 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-medium text-violet-700 hover:bg-violet-100"
                        >
                          📍 View Check Out Map
                        </button>
                      )}
                  </div>
                </div>
              )}

              {/* Admin Response / Rejection Reason */}
              {reasonModal.reviewNote && (
                <div
                  className={`rounded-xl border p-4 ${
                    reasonModal.status === "REJECTED"
                      ? "border-rose-200 bg-rose-50/80 dark:border-rose-900/40 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200"
                      : "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/40 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200"
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                    <FileText className={`h-4 w-4 ${reasonModal.status === "REJECTED" ? "text-rose-600" : "text-emerald-600"}`} />
                    <span>
                      {reasonModal.status === "REJECTED"
                        ? "Admin Rejection Reason"
                        : "Admin Response"}
                    </span>
                  </div>
                  <p className="text-sm font-medium whitespace-pre-wrap break-words">
                    {reasonModal.reviewNote}
                  </p>
                </div>
              )}

              {/* Submitted & Reviewed At */}
              <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span className="font-semibold">Submitted</span>
                  </div>
                  <span className="text-xs font-bold text-foreground">
                    {formatDate(reasonModal.createdAt)} {formatTime(reasonModal.createdAt)}
                  </span>
                </div>
                {reasonModal.reviewedAt && reasonModal.status !== "PENDING" && (
                  <div className="flex items-center justify-between border-t border-border pt-2">
                    <div className="flex items-center gap-2 text-xs">
                      <Clock3 className={`h-3.5 w-3.5 ${reasonModal.status === "APPROVED" ? "text-emerald-600" : "text-rose-600"}`} />
                      <span className={`font-semibold ${reasonModal.status === "APPROVED" ? "text-emerald-700" : "text-rose-700"}`}>
                        {reasonModal.status === "APPROVED" ? "Approved At" : "Rejected At"}
                      </span>
                    </div>
                    <span className={`text-xs font-bold ${reasonModal.status === "APPROVED" ? "text-emerald-700" : "text-rose-700"}`}>
                      {formatDate(reasonModal.reviewedAt)} {formatTime(reasonModal.reviewedAt)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-border px-5 py-4">
              <button
                type="button"
                onClick={() => setReasonModal(null)}
                className="w-full rounded-lg bg-secondary px-4 py-2 font-medium text-sm hover:bg-secondary/80"
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
