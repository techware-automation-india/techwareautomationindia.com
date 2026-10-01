import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Check,
  CheckCheck,
  Loader2,
  RefreshCw,
  X,
  Calendar,
  UserRound,
  Clock3,
  FileText,
  Briefcase,
  MapPin,
  MessageSquareText,
} from "lucide-react";
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

const formatPunchDate = (value) => {
  if (!value) return "—";
  const str = String(value).trim();

  // If ISO string like 2026-09-24T18:30:00.000Z or date object
  const dateObj = new Date(str);
  if (
    !Number.isNaN(dateObj.getTime()) &&
    (str.includes("T") || str.length > 10)
  ) {
    return dateObj.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    });
  }

  // If YYYY-MM-DD format
  const cleanStr = str.split("T")[0];
  const parts = cleanStr.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[0]}`;
  }

  return str;
};

const formatTimeIST = (timeValue) => {
  if (!timeValue) return "—";

  const str = String(timeValue).trim();

  // Full ISO date / timestamp string
  if (str.includes("T") || str.includes("-")) {
    const d = new Date(str);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }
  }

  // 24-hour time format (HH:MM or HH:MM:SS)
  const match = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const period = hours >= 12 ? "PM" : "AM";
    if (hours === 0) hours = 12;
    else if (hours > 12) hours = hours - 12;
    return `${hours}:${minutes} ${period}`;
  }

  return str;
};

const formatDistance = (value) => {
  if (value == null || value === "") return "";
  const str = String(value).trim();
  const num = parseFloat(str.replace(/[^0-9.]/g, ""));
  if (Number.isNaN(num)) return str;

  if (num < 1) {
    const meters = Math.round(num * 1000);
    return `${meters} m`;
  }
  const formattedKm = Number.isInteger(num) ? num : parseFloat(num.toFixed(2));
  return `${formattedKm} km`;
};

const getPunchTypeLabel = (request) => {
  const punchType =
    request.notification?.punchType ||
    (() => {
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

const parseCorrectionFromDescription = (description) => {
  if (typeof description !== "string") return null;
  const markerIndex = description.lastIndexOf("[ATTENDANCE_CORRECTION]");
  if (markerIndex === -1) return null;

  try {
    const jsonText = description
      .slice(markerIndex + "[ATTENDANCE_CORRECTION]".length)
      .trim();
    const data = JSON.parse(jsonText);
    const readableText = description.slice(0, markerIndex).trim();

    let reason = readableText
      .replace(
        /^Forgot Punch request for (?:both|check-in|check-out|Check In|Check Out) on \d{4}-\d{2}-\d{2}\.?\s*/i,
        "",
      )
      .replace(
        /^Forgot Punch request for .*? on \d{4}-\d{2}-\d{2} at .*?(?:\.\s*|$)/i,
        "",
      )
      .replace(/Check-In Location:.*$/i, "")
      .replace(/Check-Out Location:.*$/i, "")
      .replace(/\|?\s*Pending admin approval\.?/gi, "")
      .replace(/\|?\s*Approved by admin\.?/gi, "")
      .replace(/\|?\s*Rejected by admin\.?/gi, "")
      .replace(/\|/g, "")
      .trim();

    return {
      date: data.date,
      punchType:
        data.punchType === "check-in"
          ? "Check In"
          : data.punchType === "check-out"
            ? "Check Out"
            : "Check In + Check Out",
      checkInTime: data.checkInTime,
      checkOutTime: data.checkOutTime,
      checkInLocation: data.checkInLocation,
      checkOutLocation: data.checkOutLocation,
      reason: reason || "No reason provided.",
    };
  } catch {
    return null;
  }
};

const normalizeRequests = (items) =>
  (items || []).map((item) => ({
    id: item.id,
    source: "REQUEST",
    title:
      item.type === "CORRECTION"
        ? `Forgot Punch${getPunchTypeLabel(item) ? ` - ${getPunchTypeLabel(item)}` : ""}`
        : item.subject || "Employee request",
    punchType: item.type === "CORRECTION" ? getPunchTypeLabel(item) : null,
    correctionDetails:
      item.type === "CORRECTION"
        ? item.notification || parseCorrectionFromDescription(item.description)
        : null,
    description:
      item.description || item.notification?.reason || "No details provided.",
    employee:
      item.employee?.fullName || item.employee?.user?.fullName || "Employee",
    employeeCode: item.employee?.employeeCode || "",
    reviewNote: item.reviewNote || null,
    reviewedAt: item.reviewedAt || null,
    checkInLatitude: item.checkInLatitude,
    checkInLongitude: item.checkInLongitude,
    checkOutLatitude: item.checkOutLatitude,
    checkOutLongitude: item.checkOutLongitude,
    status: item.status === "PENDING" ? "PENDING" : item.status,
    createdAt: item.createdAt,
  }));

const normalizeLeave = (items) =>
  (items || []).map((item) => ({
    id: item.id,
    source: "LEAVE",
    title: `${item.leaveType?.name || "Leave"} request`,
    description:
      item.reason ||
      `${formatDate(item.startDate)} - ${formatDate(item.endDate)} (${item.totalDays} day(s))`,
    employee: item.employee?.user?.fullName || "Employee",
    employeeCode: item.employee?.employeeCode || "",
    reviewNote: item.reviewNote || null,
    reviewedAt: item.reviewedAt || null,
    status: item.status,
    createdAt: item.createdAt,
  }));

const normalizeAttendance = (items) =>
  (items || []).map((item) => {
    const isCheckoutApproval =
      !!item.checkOut ||
      (item.note?.includes("Checkout") && !item.note?.includes("Checkin"));

    return {
      id: item.id,
      source: "ATTENDANCE",
      title:
        item.note?.includes("outside") || item.note?.includes("unassigned") || item.note?.includes("requires approval")
          ? isCheckoutApproval
            ? "Checkout Location Approval"
            : "Checkin Location Approval"
          : item.note?.includes("Forgot Punch")
            ? "Forgot Punch Checkout Approval"
            : "Attendance Approval",
      description: item.note || "Employee attendance requires approval.",
      employee: item.fullName || item.employee?.user?.fullName || "Employee",
      employeeCode: item.employee?.employeeCode || "",
      reviewNote: item.note || null,
      reviewedAt: item.updatedAt || null,
      checkInLatitude: item.checkInLatitude,
      checkInLongitude: item.checkInLongitude,
      checkOutLatitude: item.checkOutLatitude,
      checkOutLongitude: item.checkOutLongitude,
      checkInDistance: item.checkInDistance || null,
      checkOutDistance: item.checkOutDistance || null,
      checkInTime: item.checkIn || item.checkInTime || item.createdAt || item.date,
      checkOutTime: item.checkOut || item.checkOutTime || null,
      date: item.date,
      status:
        item.status === "PENDING_APPROVAL"
          ? "PENDING"
          : item.note?.includes("Admin approved") ||
              item.note?.includes("Approved by admin")
            ? "APPROVED"
            : item.note?.includes("Admin rejected") ||
                item.note?.includes("Rejected by admin")
              ? "REJECTED"
              : item.status === "PRESENT"
                ? "APPROVED"
                : "REJECTED",
      createdAt: item.createdAt || item.date || item.updatedAt,
      updatedAt: item.updatedAt,
    };
  });

const getAttendanceDetails = (note = "") => {
  const text = String(note || "").trim();

  if (!text) {
    return {
      reason: "No reason provided.",
      checkInReason: "No check-in reason provided.",
      checkOutReason: "No check-out reason provided.",
      checkInDistance: null,
      checkOutDistance: null,
    };
  }

  // 1. Check for marker [ATTENDANCE_CORRECTION]
  const markerIndex = text.indexOf("[ATTENDANCE_CORRECTION]");
  let cleanText =
    markerIndex !== -1 ? text.substring(0, markerIndex).trim() : text;

  // 2. Extract distance
  const checkInDistance =
    cleanText.match(
      /Checkin .*?\(([0-9.]+(?:\s*(?:km|m))?)\s*(?:away)?\)/i,
    )?.[1] ||
    cleanText.match(/\(([0-9.]+\s*(?:km|m)?)\s*(?:away)?\)/i)?.[1] ||
    null;
  const checkOutDistance =
    cleanText.match(
      /Checkout .*?\(([0-9.]+(?:\s*(?:km|m))?)\s*(?:away)?\)/i,
    )?.[1] || null;

  // 3. Extract Reason: pattern
  const reasonMatches = [
    ...cleanText.matchAll(
      /Reason:\s*(.*?)(?=\.?\s*(?:Pending admin approval|Admin approved|Admin rejected)\b|\s*\||$)/gi,
    ),
  ]
    .map((match) => match[1].trim())
    .filter(Boolean);

  // Clean up any remaining preamble system text
  const sanitize = (rawStr) => {
    if (!rawStr) return "";
    return rawStr
      .replace(/^Checkin location requires approval\.?\s*/i, "")
      .replace(/^Checkout location requires approval\.?\s*/i, "")
      .replace(/^Reason:\s*/i, "")
      .replace(/\s*\([0-9.]+\s*km away\)\.?/i, "")
      .replace(/\s*\|?\s*Pending admin approval\.?/gi, "")
      .replace(/\s*\|?\s*Approved by admin\.?/gi, "")
      .replace(/\s*\|?\s*Rejected by admin\.?/gi, "")
      .trim();
  };

  const fullClean = sanitize(cleanText);

  let checkInReason = "";
  let checkOutReason = "";

  if (reasonMatches.length > 0) {
    checkInReason = sanitize(reasonMatches[0]);
    if (reasonMatches.length > 1) {
      checkOutReason = sanitize(reasonMatches[1]);
    }
  } else {
    checkInReason = fullClean;
  }

  return {
    reason: fullClean || "No reason provided.",
    checkInReason: checkInReason || fullClean || "No check-in reason provided.",
    checkOutReason: checkOutReason || "No check-out reason provided.",
    checkInDistance,
    checkOutDistance,
  };
};

const openCheckInMap = (approval) => {
  const latitude = Number(approval.checkInLatitude);
  const longitude = Number(approval.checkInLongitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    toast.error("Check-in location coordinates are not available.");
    return;
  }
  window.open(
    `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
    "_blank",
    "noopener,noreferrer",
  );
};

const openCheckOutMap = (approval) => {
  const latitude = Number(approval.checkOutLatitude);
  const longitude = Number(approval.checkOutLongitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    toast.error("Check-out location coordinates are not available.");
    return;
  }
  window.open(
    `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
    "_blank",
    "noopener,noreferrer",
  );
};

const getReadableReason = (approval) => {
  let text = approval?.description || "";

  // 1. Strip [ATTENDANCE_CORRECTION] and JSON metadata
  const markerIndex = text.indexOf("[ATTENDANCE_CORRECTION]");
  if (markerIndex !== -1) {
    text = text.substring(0, markerIndex).trim();
  }

  // 2. Strip system preamble "Forgot Punch request for ... on YYYY-MM-DD."
  text = text
    .replace(
      /^Forgot Punch request for (?:both|check-in|check-out|Check In|Check Out) on \d{4}-\d{2}-\d{2}\.?\s*/i,
      "",
    )
    .replace(
      /^Forgot Punch request for .*? on \d{4}-\d{2}-\d{2} at .*?(?:\.\s*|$)/i,
      "",
    )
    .trim();

  // 3. Strip trailing Check-In / Check-Out location strings
  text = text
    .replace(/Check-In Location:.*$/i, "")
    .replace(/Check-Out Location:.*$/i, "")
    .trim();

  // 4. Remove system status messages from the employee reason
  text = text
    .replace(/\|?\s*Pending admin approval\.?/gi, "")
    .replace(/\|?\s*Approved by admin\.?/gi, "")
    .replace(/\|?\s*Rejected by admin\.?/gi, "")
    .replace(/\|?\s*Approved\.?/gi, "")
    .replace(/\|?\s*Rejected\.?/gi, "")
    .replace(/\|/g, "")
    .trim();

  const reasonMatch = text.match(/Reason:\s*(.*?)(?:\s*\||$)/i);
  let reason = reasonMatch?.[1]?.trim() || text;

  return {
    reason: reason || "No reason provided.",
  };
};

const getAdminRejectionReason = (reviewNote = "") => {
  const text = String(reviewNote || "").trim();

  if (!text) return "No rejection reason provided.";

  // Pattern 1: "... | Admin rejected: <reason>" or "Admin rejected: <reason>"
  const match = text.match(/Admin rejected:\s*(.*?)(?=\s*\||$)/i);
  if (match && match[1] && match[1].trim()) {
    return match[1].trim();
  }

  // Pattern 2: "Rejected by admin: <reason>" or "[REJECTED] <reason>"
  const match2 = text.match(/(?:Rejected by admin|\[REJECTED\]):\s*(.*?)(?=\s*\||$)/i);
  if (match2 && match2[1] && match2[1].trim()) {
    return match2[1].trim();
  }

  // Pattern 3: If text ends with "Admin rejected." or "| Admin rejected." without custom text
  if (/Admin rejected\.?\s*$/i.test(text)) {
    return "Rejected by Admin.";
  }

  // Pattern 4: If text contains "|" separator, check if last part is the rejection note
  if (text.includes("|")) {
    const parts = text.split("|").map((p) => p.trim());
    const lastPart = parts[parts.length - 1];
    if (lastPart && /admin rejected/i.test(lastPart)) {
      const cleaned = lastPart.replace(/^Admin rejected:?\s*/i, "").trim();
      return cleaned || "Rejected by Admin.";
    }
  }

  return text;
};


const Approvals = () => {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState(null);
  const [reasonModal, setReasonModal] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  // Set default filters to current month/year
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [yearFilter, setYearFilter] = useState(String(currentYear));
  const [monthFilter, setMonthFilter] = useState("ALL");
  const [employeeFilter, setEmployeeFilter] = useState("ALL");

  const loadApprovals = async () => {
    setLoading(true);
    try {
      const [requestResult, leaveResult, attendanceResult] = await Promise.all([
        apiGet("/requests"),
        apiGet("/leave/admin/all"),
        apiGet("/attendance/admin/requests"),
      ]);

      setApprovals(
        [
          ...normalizeRequests(requestResult.requests),
          ...normalizeLeave(leaveResult.requests),
          ...normalizeAttendance(attendanceResult.records),
        ].sort(
          (first, second) =>
            new Date(second.createdAt || 0) - new Date(first.createdAt || 0),
        ),
      );
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

  const years = [
    ...new Set(
      approvals
        .map((approval) => new Date(approval.createdAt || 0).getFullYear())
        .filter((year) => year > 1970),
    ),
  ].sort((first, second) => second - first);

  // Get unique employee names for filter
  const employees = [
    ...new Set(approvals.map((approval) => approval.employee).filter(Boolean)),
  ].sort();

  const filteredApprovals = approvals.filter((approval) => {
    const createdAt = new Date(approval.createdAt || 0);
    const matchesStatus =
      statusFilter === "ALL" || approval.status === statusFilter;
    const matchesYear =
      yearFilter === "ALL" || String(createdAt.getFullYear()) === yearFilter;
    const matchesMonth =
      monthFilter === "ALL" || String(createdAt.getMonth() + 1) === monthFilter;
    const matchesEmployee =
      employeeFilter === "ALL" || approval.employee === employeeFilter;
    return matchesStatus && matchesYear && matchesMonth && matchesEmployee;
  });

  const review = async (approval, decision, reason = "") => {
    setActingId(`${approval.source}:${approval.id}`);
    try {
      const endpoint =
        approval.source === "LEAVE"
          ? `/leave/admin/${approval.id}/${decision}`
          : approval.source === "ATTENDANCE"
            ? `/attendance/${decision}/${approval.id}`
            : `/requests/${approval.id}/${decision}`;

      const payload = {
        reason: reason || "",
        note: reason || "",
      };

      await apiPost(endpoint, payload);
      toast.success(
        `Request ${decision === "approve" ? "approved" : "rejected"}.`,
      );
      setRejectModal(null);
      setRejectReason("");
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
            <p className="text-sm text-muted-foreground">
              Approve or reject pending employee requests in one place.
            </p>
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
              <option key={emp} value={emp}>
                {emp}
              </option>
            ))}
          </select>
          <select
            value={yearFilter}
            onChange={(event) => setYearFilter(event.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            aria-label="Filter approvals by year"
          >
            <option value="ALL">All years</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <select
            value={monthFilter}
            onChange={(event) => setMonthFilter(event.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            aria-label="Filter approvals by month"
          >
            <option value="ALL">All months</option>
            {months.map((month, index) => (
              <option key={month} value={index + 1}>
                {month}
              </option>
            ))}
          </select>
          <span className="ml-auto text-sm text-muted-foreground">
            Showing {filteredApprovals.length} of {approvals.length}
          </span>
        </div>
        {loading ? (
          <div className="flex min-h-[260px] items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading
            approvals...
          </div>
        ) : filteredApprovals.length === 0 ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
            <CheckCheck className="h-10 w-10 text-emerald-500/60" />
            <h2 className="mt-3 font-semibold">No matching requests</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Try another status, year, or month filter.
            </p>
          </div>
        ) : (
          <div className="p-4 sm:p-5 lg:p-6">
            <div className="grid gap-4 lg:gap-5">
              {filteredApprovals.map((approval) => {
                const actionId = `${approval.source}:${approval.id}`;
                const acting = actingId === actionId;

                // Determine icon and color based on source
                const getSourceIcon = () => {
                  switch (approval.source) {
                    case "ATTENDANCE":
                      return <Clock3 className="h-6 w-6" />;
                    case "LEAVE":
                      return <Briefcase className="h-6 w-6" />;
                    default:
                      return <FileText className="h-6 w-6" />;
                  }
                };

                const getSourceGradient = () => {
                  switch (approval.source) {
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
                    <div
                      className={`absolute left-0 top-0 h-full w-1.5 ${
                        approval.status === "PENDING"
                          ? "bg-amber-500"
                          : approval.status === "APPROVED"
                            ? "bg-emerald-500"
                            : "bg-rose-500"
                      }`}
                    />

                    <div className="p-5 pl-7">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex gap-4">
                          {/* Icon */}
                          <div
                            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-sm text-white ${getSourceGradient()}`}
                          >
                            {getSourceIcon()}
                          </div>

                          {/* Content */}
                          <div className="min-w-0 flex-1">
                            {/* Badges Row */}
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-xl px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
                                  approval.source === "ATTENDANCE"
                                    ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                                    : approval.source === "LEAVE"
                                      ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                                      : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                }`}
                              >
                                {approval.source === "ATTENDANCE"
                                  ? "Attendance"
                                  : approval.source === "LEAVE"
                                    ? "Leave"
                                    : "Request"}
                              </span>
                              <span
                                className={`rounded-xl px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
                                  approval.status === "PENDING"
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                    : approval.status === "APPROVED"
                                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                      : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                                }`}
                              >
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
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setReasonModal(approval);
                              }}
                              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-secondary/80 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-primary/10 hover:text-primary w-fit"
                            >
                              <MessageSquareText className="h-4 w-4" />
                              <span>View Reason</span>
                            </button>
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
                                  onClick={() => setRejectModal({ approval })}
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
                                <div className="font-semibold text-muted-foreground">
                                  Reviewed
                                </div>
                                <div className="mt-0.5 font-bold text-foreground">
                                  {formatDate(approval.reviewedAt || approval.createdAt)}
                                </div>
                                <div className="mt-0.5 text-muted-foreground">
                                  {formatTimeIST(approval.reviewedAt || approval.createdAt)}
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
            if (e.target === e.currentTarget) {
              setReasonModal(null);
            }
          }}
        >
          <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-2xl">
            {/* ================= HEADER ================= */}
            <div className="flex items-center justify-between border-b border-border bg-background px-6 py-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <MessageSquareText className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Approval Details
                  </p>

                  <h3 className="mt-1 truncate text-lg font-bold text-foreground">
                    {reasonModal.title}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setReasonModal(null)}
                className="ml-4 rounded-xl p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* ================= CONTENT ================= */}
            <div className="max-h-[72vh] space-y-5 overflow-y-auto p-6">
              {/* ================= EMPLOYEE ================= */}
              <section>
                <div className="mb-2 flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-primary" />

                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Employee
                  </p>
                </div>

                <div className="flex items-center gap-4 rounded-2xl border border-border bg-secondary/20 p-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <UserRound className="h-6 w-6" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-base font-bold text-foreground">
                      {reasonModal.employee}
                    </p>

                    {reasonModal.employeeCode && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Employee ID: {reasonModal.employeeCode}
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {/* ================= REASON ================= */}
              <section>
                {/* Reason Header */}
                <div className="mb-2 flex w-full items-center">
                  <div className="flex items-center gap-2">
                    <MessageSquareText className="h-4 w-4 text-primary" />

                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Reason
                    </p>
                  </div>

                  {/* Status */}
                  <span
                    className={`ml-auto inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
                      reasonModal.status === "PENDING"
                        ? "bg-amber-100 text-amber-700"
                        : reasonModal.status === "APPROVED"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {reasonModal.status === "PENDING"
                      ? "Pending"
                      : reasonModal.status === "APPROVED"
                        ? "Approved"
                        : "Rejected"}
                  </span>
                </div>

                {reasonModal.source === "REQUEST" &&
                reasonModal.correctionDetails ? (
                  <div className="grid gap-3 rounded-2xl border border-border bg-secondary/20 px-4 py-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">
                        Date
                      </p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {formatPunchDate(reasonModal.correctionDetails.date)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">
                        Punch Type
                      </p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {reasonModal.punchType || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">
                        Check-in Time
                      </p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {formatTimeIST(
                          reasonModal.correctionDetails.checkInTime,
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">
                        Check-out Time
                      </p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {formatTimeIST(
                          reasonModal.correctionDetails.checkOutTime,
                        )}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs font-semibold text-muted-foreground">
                        Employee Reason
                      </p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium leading-6 text-foreground">
                        {reasonModal.correctionDetails.reason ||
                          "No reason provided."}
                      </p>
                    </div>
                  </div>
                ) : reasonModal.source === "ATTENDANCE" ? (
                  (() => {
                    const attendanceDetails = getAttendanceDetails(
                      reasonModal.description,
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
                              Check-In Time:{" "}
                              {formatTimeIST(
                                reasonModal.checkInTime ||
                                  reasonModal.createdAt,
                              )}
                            </span>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground">
                              Check-In Reason
                            </p>
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium leading-6 text-foreground">
                              {attendanceDetails.checkInReason}
                            </p>
                            {reasonModal.checkInDistance ||
                            attendanceDetails.checkInDistance ? (
                              <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                Distance from office:{" "}
                                {formatDistance(
                                  reasonModal.checkInDistance ||
                                    attendanceDetails.checkInDistance,
                                )}
                              </p>
                            ) : reasonModal.checkInLatitude != null &&
                              reasonModal.checkInLongitude != null ? (
                              <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                Distance from office: GPS Recorded (
                                {reasonModal.checkInLatitude.toFixed(4)},{" "}
                                {reasonModal.checkInLongitude.toFixed(4)})
                              </p>
                            ) : null}
                          </div>
                        </div>

                        {/* 2. CHECK-OUT DIV */}
                        {(reasonModal.checkOutTime ||
                          reasonModal.checkOutLatitude != null ||
                          reasonModal.checkOutDistance) && (
                          <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-900/40 dark:bg-rose-950/20 space-y-3">
                            <div className="flex items-center justify-between border-b border-rose-200/60 pb-2.5 dark:border-rose-900/40">
                              <div className="flex items-center gap-2">
                                <Clock3 className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                                <span className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                                  Check-Out Details
                                </span>
                              </div>
                              <span className="text-xs font-bold text-rose-800 dark:text-rose-300">
                                Check-Out Time:{" "}
                                {formatTimeIST(reasonModal.checkOutTime)}
                              </span>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground">
                                Check-Out Reason
                              </p>
                              <p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium leading-6 text-foreground">
                                {attendanceDetails.checkOutReason ||
                                  "No check-out reason provided."}
                              </p>
                              {reasonModal.checkOutDistance ||
                              attendanceDetails.checkOutDistance ? (
                                <p className="mt-2 text-xs font-semibold text-rose-700 dark:text-rose-400">
                                  Distance from office:{" "}
                                  {formatDistance(
                                    reasonModal.checkOutDistance ||
                                      attendanceDetails.checkOutDistance,
                                  )}
                                </p>
                              ) : reasonModal.checkOutLatitude != null &&
                                reasonModal.checkOutLongitude != null ? (
                                <p className="mt-2 text-xs font-semibold text-rose-700 dark:text-rose-400">
                                  Distance from office: GPS Recorded (
                                  {reasonModal.checkOutLatitude.toFixed(4)},{" "}
                                  {reasonModal.checkOutLongitude.toFixed(4)})
                                </p>
                              ) : null}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-4">
                    <p className="mb-1 text-xs font-semibold text-muted-foreground">
                      Employee Reason
                    </p>
                    <p className="break-words text-sm font-medium leading-6 text-foreground">
                      {getReadableReason(reasonModal).reason}
                    </p>
                  </div>
                )}
              </section>

              {/* ================= ATTENDANCE LOCATION ================= */}
              {(reasonModal.checkInLatitude != null ||
                reasonModal.checkOutLatitude != null) && (
                <section>
                  <div className="mb-2 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />

                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Attendance Location
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* CHECK-IN */}
                    {reasonModal.checkInLatitude != null &&
                      reasonModal.checkInLongitude != null && (
                        <button
                          type="button"
                          onClick={() => openCheckInMap(reasonModal)}
                          className="group rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50 hover:shadow-md dark:border-emerald-900/50 dark:bg-emerald-950/20"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
                              <MapPin className="h-5 w-5" />
                            </div>

                            <div className="min-w-0">
                              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                                Check-in Location
                              </p>

                              <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                                View on Google Maps
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 rounded-xl bg-white/80 px-3 py-2.5 dark:bg-black/10">
                            <p className="text-xs text-muted-foreground">
                              <span className="font-semibold">
                                Coordinates:
                              </span>{" "}
                              {reasonModal.checkInLatitude},{" "}
                              {reasonModal.checkInLongitude}
                            </p>
                          </div>
                        </button>
                      )}

                    {/* CHECK-OUT */}
                    {reasonModal.checkOutLatitude != null &&
                      reasonModal.checkOutLongitude != null && (
                        <button
                          type="button"
                          onClick={() => openCheckOutMap(reasonModal)}
                          className="group rounded-2xl border border-rose-200 bg-rose-50/70 p-4 text-left transition hover:border-rose-300 hover:bg-rose-50 hover:shadow-md dark:border-rose-900/50 dark:bg-rose-950/20"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400">
                              <MapPin className="h-5 w-5" />
                            </div>

                            <div className="min-w-0">
                              <p className="text-sm font-bold text-rose-700 dark:text-rose-400">
                                Check-out Location
                              </p>

                              <p className="mt-0.5 text-xs text-rose-600 dark:text-rose-400">
                                View on Google Maps
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 rounded-xl bg-white/80 px-3 py-2.5 dark:bg-black/10">
                            <p className="text-xs text-muted-foreground">
                              <span className="font-semibold">
                                Coordinates:
                              </span>{" "}
                              {reasonModal.checkOutLatitude},{" "}
                              {reasonModal.checkOutLongitude}
                            </p>
                          </div>
                        </button>
                      )}
                  </div>
                </section>
              )}

              {/* ================= ADMIN RESPONSE / REJECTION REASON ================= */}
              {reasonModal.status === "REJECTED" && reasonModal.reviewNote && (
                <section>
                  <div className="mb-2 flex items-center gap-2">
                    <MessageSquareText className="h-4 w-4 text-rose-600" />

                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Admin Rejection Reason
                    </p>
                  </div>

                  <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
                    <p className="whitespace-pre-wrap break-words text-sm font-medium leading-6">
                      {getAdminRejectionReason(reasonModal.reviewNote)}
                    </p>
                  </div>
                </section>
              )}

              {/* ================= SUBMITTED / REVIEWED ================= */}
              <div className="flex flex-col gap-2 rounded-2xl border border-border bg-secondary/20 px-4 py-3">
                {reasonModal.createdAt && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold text-muted-foreground">
                        Submitted
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-foreground">
                        {formatDate(reasonModal.createdAt)}
                      </span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {formatTimeIST(reasonModal.createdAt)}
                      </span>
                    </div>
                  </div>
                )}
                {reasonModal.reviewedAt && reasonModal.status !== "PENDING" && (
                  <div className="flex items-center justify-between border-t border-border pt-2">
                    <div className="flex items-center gap-2">
                      <Clock3 className={`h-4 w-4 ${reasonModal.status === "APPROVED" ? "text-emerald-600" : "text-rose-600"}`} />
                      <span className={`text-sm font-semibold ${reasonModal.status === "APPROVED" ? "text-emerald-700" : "text-rose-700"}`}>
                        {reasonModal.status === "APPROVED" ? "Approved At" : "Rejected At"}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-bold ${reasonModal.status === "APPROVED" ? "text-emerald-700" : "text-rose-700"}`}>
                        {formatDate(reasonModal.reviewedAt)}
                      </span>
                      <span className={`ml-2 text-xs ${reasonModal.status === "APPROVED" ? "text-emerald-600" : "text-rose-600"}`}>
                        {formatTimeIST(reasonModal.reviewedAt)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ================= FOOTER ================= */}
            <div className="flex justify-end border-t border-border bg-secondary/20 px-6 py-4">
              <button
                type="button"
                onClick={() => setReasonModal(null)}
                className="rounded-xl bg-primary px-7 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition hover:opacity-90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setRejectModal(null);
              setRejectReason("");
            }
          }}
        >
          <div className="flex w-full max-w-md flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border bg-background px-6 py-5">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  Reject Request
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {rejectModal.approval?.title} (
                  {rejectModal.approval?.employee})
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRejectModal(null);
                  setRejectReason("");
                }}
                className="rounded-xl p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Rejection Reason (Optional)
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Enter reason for rejection (optional)..."
                  rows={4}
                  className="w-full rounded-2xl border border-border bg-secondary/20 p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border bg-secondary/20 px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setRejectModal(null);
                  setRejectReason("");
                }}
                className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold hover:bg-secondary transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  review(rejectModal.approval, "reject", rejectReason)
                }
                disabled={
                  actingId ===
                  `${rejectModal.approval?.source}:${rejectModal.approval?.id}`
                }
                className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-rose-700 transition disabled:opacity-60"
              >
                {actingId ===
                  `${rejectModal.approval?.source}:${rejectModal.approval?.id}` && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Approvals;
