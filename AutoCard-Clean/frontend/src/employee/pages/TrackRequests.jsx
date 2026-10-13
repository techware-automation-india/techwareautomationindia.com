import { useEffect, useState, useMemo } from "react";
import { usePoll } from "../../lib/pollContext.jsx";
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
  PackageCheck,
  CheckCircle2,
  CheckCheck,
  Layers,
  AlertTriangle,
  PauseCircle,
  RotateCcw,
  PackagePlus,
  Tag,
  UserRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../lib/api.js";
import { clearAuth, getAuthUser } from "../../lib/auth.js";

const statusStyles = {
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  PENDING_APPROVAL: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  APPROVED: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  COMPLETED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300",
  PRESENT: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
  ABSENT: "bg-rose-100 text-rose-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

const typeStyles = {
  REQUEST: "bg-blue-100 text-blue-700",
  EQUIPMENT: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
  CORRECTION: "bg-blue-100 text-blue-700",
  LEAVE: "bg-violet-100 text-violet-700",
  ATTENDANCE: "bg-rose-100 text-rose-700",
};

const parseInventorySubject = (titleStr = "") => {
  if (!titleStr || typeof titleStr !== "string") return null;
  const match = titleStr.match(/^\[(Inventory Return|Inventory Taking)(?:\s*:\s*([^\]]+))?\]\s*(.*?)(?:\s*\((.*?)\))?$/i);
  if (!match) return null;
  return {
    actionType: match[1].trim(),
    codeOrProject: match[2]?.trim() || "",
    itemName: match[3]?.trim() || titleStr,
    categoryType: match[4]?.trim() || "",
    isReturn: match[1].toLowerCase().includes("return"),
  };
};

const FormattedInventoryTitle = ({ title, className = "" }) => {
  const parsed = parseInventorySubject(title);
  if (!parsed) {
    return (
      <h3 className={`font-semibold text-foreground ${className}`}>
        {title}
      </h3>
    );
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold border ${
            parsed.isReturn
              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
              : "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30"
          }`}
        >
          {parsed.isReturn ? <RotateCcw className="h-3 w-3" /> : <PackagePlus className="h-3 w-3" />}
          {parsed.actionType}
        </span>

        {parsed.codeOrProject && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-secondary text-foreground border border-border">
            <Tag className="h-3 w-3 text-amber-600" />
            {parsed.codeOrProject}
          </span>
        )}

        {parsed.categoryType && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-secondary/80 text-muted-foreground border border-border/50">
            {parsed.categoryType}
          </span>
        )}
      </div>

      <h3 className="text-base sm:text-lg font-bold leading-snug text-foreground">
        {parsed.itemName}
      </h3>
    </div>
  );
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

  if (s === "COMPLETED" || s === "FOUND" || s === "RECEIVED" || n.includes("product found") || n.includes("collected by employee")) return "COMPLETED";
  if (s === "PENDING_APPROVAL" || s === "PENDING") return "PENDING";
  if (s === "APPROVED" || s === "PRESENT" || n.includes("approved")) return "APPROVED";
  if (s === "REJECTED" || s === "ABSENT" || n.includes("rejected")) return "REJECTED";
  if (s === "CANCELLED") return "CANCELLED";

  return "PENDING";
};

const isApprovedOrCompletedStatus = (status, note = "") => {
  const s = String(status || "").toUpperCase();
  const n = String(note || "").toUpperCase();
  if (s === "REJECTED" || s === "CANCELLED" || n.includes("[REJECTED]") || n.includes("[CANCELLED]")) {
    return false;
  }
  return (
    s === "APPROVED" ||
    s === "COMPLETED" ||
    s === "FOUND" ||
    s === "RECEIVED" ||
    s === "IN_PROGRESS" ||
    n.includes("[PRODUCT_FOUND]") ||
    n.includes("[QUALITY_INSPECTED]") ||
    n.includes("PHYSICALLY_RETURNED")
  );
};

const getRequestReason = (request) => {
  if (!request?.description) return "No reason provided.";
  let text = String(request.description || "");

  const markerIndex = text.indexOf("[ATTENDANCE_CORRECTION]");
  if (markerIndex !== -1) {
    text = text.substring(0, markerIndex).trim();
  }

  text = text
    .replace(/^(?:Forgot Punch|Time Edit) request for (?:both|check-in|check-out|Check In|Check Out|time-edit|Time Edit) on \d{4}-\d{2}-\d{2}\.?\s*/i, "")
    .replace(/^(?:Forgot Punch|Time Edit) request for .*? on \d{4}-\d{2}-\d{2} at .*?(?:\.\s*|$)/i, "")
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
    // Attempt to extract the first JSON object block if trailing notes/text exist
    try {
      const jsonMatch = jsonText.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {}

    // Fallback regex field recovery from truncated or legacy records
    const readString = (key) =>
      jsonText.match(new RegExp(`"${key}"\\s*:\\s*"([^"\\r\\n]*)"`))?.[1] || null;

    const recoveredDate = readString("date");
    const recoveredPunchType = readString("punchType");
    if (recoveredDate || recoveredPunchType) {
      return {
        date: recoveredDate,
        punchType: recoveredPunchType,
        checkInTime: readString("checkInTime"),
        checkOutTime: readString("checkOutTime"),
        checkInLocation: readString("checkInLocation"),
        checkOutLocation: readString("checkOutLocation"),
      };
    }

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
      .replace(/^Checkout\s+(recorded|from|to|location|outside)?[^.]*?\.\s*/i, "")
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

  // Extract Reason: from a single part (handles Reason: before or after approval markers)
  const extractReason = (partText) => {
    if (!partText) return "";
    const m = partText.match(/Reason:\s*(.*?)(?=\s*(?:Pending admin approval|Admin approved|Admin rejected|Approved by admin|Rejected by admin)\b|\s*\||$)/i);
    let extracted = m ? m[1].trim() : "";
    if (extracted.endsWith(".")) {
      extracted = extracted.slice(0, -1).trim();
    }
    return extracted;
  };

  // Check if note has both checkin and checkout parts (pipe separated)
  const checkoutPart = parts.find(p =>
    /checkout/i.test(p) || /check.?out/i.test(p)
  );
  const checkinPart = parts.find(p =>
    /checkin/i.test(p) || /check.?in/i.test(p)
  );

  let checkInReason = "";
  let checkOutReason = "";

  // Extract reasons from each part independently
  if (checkinPart) {
    checkInReason = extractReason(checkinPart) || sanitize(checkinPart);
  }
  if (checkoutPart) {
    checkOutReason = extractReason(checkoutPart);
  }

  // Fallback: if there's only one part (no pipe separator), use the whole text
  if (!checkinPart && !checkoutPart) {
    checkInReason = directReason || sanitize(cleanText);
  } else if (!checkinPart) {
    checkInReason = directReason || "";
  }

  const fullClean = sanitize(cleanText);

  const isCheckInUnassigned = checkinPart ? /unassigned|outside|requires approval/i.test(checkinPart) : /unassigned|outside|requires approval/i.test(cleanText);
  const isCheckOutUnassigned = checkoutPart ? /unassigned|outside|requires approval/i.test(checkoutPart) : false;

  return {
    reason: fullClean || directReason || "No reason provided.",
    checkInReason: checkInReason || directReason || fullClean || "No check-in reason provided.",
    checkOutReason: checkOutReason || "",
    checkInDistance,
    checkOutDistance,
    isCheckInUnassigned,
    isCheckOutUnassigned,
  };
};

const parseRequestDetails = (rawText) => {
  if (!rawText || typeof rawText !== "string") return null;

  const text = rawText.trim();
  const knownKeys = [
    "Action Type",
    "Category",
    "Product Type",
    "Product ID",
    "Project Name",
    "Item Name",
    "Quantity",
    "Urgency Level",
    "Item Condition",
    "Date",
    "Purpose / Work Details / Remarks",
    "Purpose / Remarks",
    "Remarks",
    "Reason",
  ];

  const hasKeys = knownKeys.some((k) => text.toLowerCase().includes(`${k.toLowerCase()}:`));
  if (!hasKeys) return null;

  const pairs = [];
  let remarks = "";

  const pattern = new RegExp(
    `(?:^|\\n|\\s)(Action Type|Category|Product Type|Product ID|Project Name|Item Name|Quantity|Urgency Level|Item Condition|Date|Purpose \\/ Work Details \\/ Remarks|Purpose \\/ Remarks|Remarks|Reason):\\s*`,
    "gi"
  );

  const matches = [...text.matchAll(pattern)];
  if (matches.length === 0) return null;

  for (let i = 0; i < matches.length; i++) {
    const key = matches[i][1].trim();
    const startIndex = matches[i].index + matches[i][0].length;
    const endIndex = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const val = text.substring(startIndex, endIndex).trim();

    if (key.match(/Purpose|Remarks|Reason/i) && (key.includes("Purpose") || key.includes("Remarks") || key === "Reason")) {
      remarks = val;
    } else {
      pairs.push({ label: key, value: val });
    }
  }

  return { pairs, remarks };
};

const RenderFormattedDetails = ({ text }) => {
  const parsed = parseRequestDetails(text);

  if (!parsed || (!parsed.pairs.length && !parsed.remarks)) {
    return (
      <p className="whitespace-pre-wrap break-words text-sm font-medium leading-6 text-foreground">
        {text || "No details provided."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {parsed.pairs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {parsed.pairs.map((pair, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-border bg-background p-3 shadow-2xs"
            >
              <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                {pair.label}
              </span>
              <span className="text-sm font-bold text-foreground break-words">
                {pair.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {parsed.remarks && (
        <div className="rounded-xl border border-border bg-background p-3.5 shadow-2xs">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
            Purpose / Work Details / Remarks
          </span>
          <p className="text-sm font-medium leading-relaxed text-foreground whitespace-pre-wrap break-words">
            {parsed.remarks}
          </p>
        </div>
      )}
    </div>
  );
};

const TrackRequests = ({ isAdmin = false }) => {
  const navigate = useNavigate();
  const { pollTick } = usePoll();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reasonModal, setReasonModal] = useState(null);
  const [markingId, setMarkingId] = useState(null);
  const [returningId, setReturningId] = useState(null);
  const [notFoundModal, setNotFoundModal] = useState(null);
  const [notFoundReason, setNotFoundReason] = useState("");
  const [notFoundLoading, setNotFoundLoading] = useState(false);

  const handleMarkProductFound = async (requestId) => {
    if (!requestId || markingId) return;
    const cleanId = String(requestId).replace(/^request-/, "");
    setMarkingId(requestId);
    try {
      await apiPost(`/requests/${cleanId}/found`, {});
      toast.success("Product marked as found / item received successfully!");
      await loadRequests();
    } catch (err) {
      toast.error(err.message || "Failed to update product status.");
    } finally {
      setMarkingId(null);
    }
  };

  const handleMarkProductNotFound = async (requestId, reason) => {
    if (!requestId || notFoundLoading) return;
    const cleanId = String(requestId).replace(/^request-/, "");
    setNotFoundLoading(true);
    try {
      await apiPost(`/requests/${cleanId}/not-found`, {
        reason: reason || notFoundReason || "Item could not be found in store / workshop.",
      });
      toast.warning("Reported as Item Not Found. Admin has been notified.");
      setNotFoundModal(null);
      setNotFoundReason("");
      await loadRequests();
    } catch (err) {
      toast.error(err.message || "Failed to submit not-found report.");
    } finally {
      setNotFoundLoading(false);
    }
  };

  const handleItemReturn = async (requestId) => {
    if (!requestId || returningId) return;
    const cleanId = String(requestId).replace(/^request-/, "");
    setReturningId(requestId);
    try {
      await apiPost(`/requests/${cleanId}/item-return`, {});
      toast.success("Item Return confirmed! Item handed over to store/admin.");
      await loadRequests();
    } catch (err) {
      toast.error(err.message || "Failed to confirm item return.");
    } finally {
      setReturningId(null);
    }
  };

  // Set default filters to current month/year
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const currentUser = getAuthUser();
  const [adminScope, setAdminScope] = useState("ALL");
  const [employeeFilter, setEmployeeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [yearFilter, setYearFilter] = useState(String(currentYear));
  const [monthFilter, setMonthFilter] = useState(String(currentMonth));

  const isMyRequest = (req) => {
    if (!currentUser) return false;
    if (adminScope === "ME" || !isAdmin) return true;
    const emp = req?.employee;
    if (!emp) return false;
    if (emp.id && currentUser.employeeProfile?.id && emp.id === currentUser.employeeProfile.id) return true;
    if (emp.employeeCode && currentUser.employeeProfile?.employeeCode && emp.employeeCode === currentUser.employeeProfile.employeeCode) return true;
    if (emp.email && currentUser.email && emp.email.toLowerCase() === currentUser.email.toLowerCase()) return true;
    if (emp.user?.email && currentUser.email && emp.user.email.toLowerCase() === currentUser.email.toLowerCase()) return true;
    if (emp.user?.id && currentUser.id && emp.user.id === currentUser.id) return true;
    if (emp.fullName && currentUser.fullName && emp.fullName.toLowerCase() === currentUser.fullName.toLowerCase()) return true;
    return false;
  };

  const employeesList = useMemo(() => {
    if (!isAdmin) return [];
    const map = new Map();
    requests.forEach((r) => {
      if (r.employee) {
        const key = r.employee.id || r.employee.employeeCode || r.employee.fullName;
        if (key && !map.has(key)) {
          map.set(key, {
            key,
            id: r.employee.id,
            employeeCode: r.employee.employeeCode,
            fullName: r.employee.fullName || "Unknown",
          });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [isAdmin, requests]);

  const loadRequests = async () => {
    setLoadError("");

    try {
      if (isAdmin && adminScope === "ALL") {
        const results = await Promise.allSettled([
          apiGet("/requests"),
          apiGet("/leave/admin/all"),
          apiGet("/attendance/pending-approvals"),
        ]);

        const requestResult = results[0];
        const leaveResult = results[1];
        const attendanceResult = results[2];

        // 1. ALL COMPANY GENERAL / FORGOT PUNCH / EQUIPMENT REQUESTS
        const allGeneralRequests =
          requestResult.status === "fulfilled"
            ? (requestResult.value.requests || []).map((request) => ({
                ...request,
                status: normalizeStatus(request.status, request.description || request.note, request.reviewNote),
                forgotPunch: getForgotPunchData(request),
                reviewedAt: request.reviewedAt || null,
                employee: request.employee
                  ? {
                      id: request.employee.id,
                      employeeCode: request.employee.employeeCode,
                      fullName: request.employee.fullName || request.employee.user?.fullName || "Employee",
                      email: request.employee.email || request.employee.user?.email || "",
                    }
                  : null,
              }))
            : [];

        // 2. ALL COMPANY LEAVE REQUESTS
        const allLeaveRequests =
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
                employee: request.employee
                  ? {
                      id: request.employee.id,
                      employeeCode: request.employee.employeeCode,
                      fullName: request.employee.user?.fullName || request.employee.fullName || "Employee",
                      email: request.employee.user?.email || request.employee.email || "",
                    }
                  : null,
              }))
            : [];

        // 3. ALL COMPANY ATTENDANCE APPROVAL REQUESTS
        const allAttendanceRequests =
          attendanceResult.status === "fulfilled"
            ? (attendanceResult.value.pendingRecords || []).map((request) => ({
                id: `attendance-${request.id}`,
                type: "ATTENDANCE",
                subject: "Attendance Location Approval",
                status: normalizeStatus(request.status, request.note, request.reviewNote),
                createdAt: request.createdAt || request.date,
                reviewedAt: request.status !== "PENDING_APPROVAL" ? (request.updatedAt || null) : null,
                checkInTime: request.checkIn || request.createdAt || request.date,
                checkOutTime: request.checkOut || null,
                description: request.note || "",
                note: request.note || "",
                reason: request.reason || "",
                checkInLatitude: request.checkInLatitude ?? null,
                checkInLongitude: request.checkInLongitude ?? null,
                checkOutLatitude: request.checkOutLatitude ?? null,
                checkOutLongitude: request.checkOutLongitude ?? null,
                checkInDistance: request.checkInDistance ?? null,
                checkOutDistance: request.checkOutDistance ?? null,
                reviewNote: request.reviewNote,
                employee: request.employee
                  ? {
                      id: request.employee.id,
                      employeeCode: request.employee.employeeCode,
                      fullName: request.employee.user?.fullName || request.employee.fullName || "Employee",
                      email: request.employee.user?.email || request.employee.email || "",
                    }
                  : null,
              }))
            : [];

        setRequests(
          [...allGeneralRequests, ...allLeaveRequests, ...allAttendanceRequests].sort(
            (first, second) =>
              new Date(second.createdAt || 0) - new Date(first.createdAt || 0),
          ),
        );
        return;
      }

      // ============================================================
      // EMPLOYEE OR ADMIN PERSONAL ("ME")
      // ============================================================

      const results = await Promise.allSettled([
        apiGet("/requests/my"),
        apiGet("/leave/my"),
        apiGet("/attendance/my-requests"),
      ]);

      const requestResult = results[0];
      const leaveResult = results[1];
      const attendanceResult = results[2];

      const currentEmployeeInfo = currentUser
        ? {
            id: currentUser.employeeProfile?.id || currentUser.id,
            employeeCode: currentUser.employeeProfile?.employeeCode || "",
            fullName: currentUser.fullName,
            email: currentUser.email,
          }
        : null;

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
              employee: request.employee || currentEmployeeInfo,
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
              employee: request.employee || currentEmployeeInfo,
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
              description: request.note || "",
              note: request.note || "",
              reason: request.reason || "",
              checkInLatitude: request.checkInLatitude ?? null,
              checkInLongitude: request.checkInLongitude ?? null,
              checkOutLatitude: request.checkOutLatitude ?? null,
              checkOutLongitude: request.checkOutLongitude ?? null,
              checkInDistance: request.checkInDistance ?? null,
              checkOutDistance: request.checkOutDistance ?? null,
              reviewNote: request.reviewNote,
              employee: request.employee || currentEmployeeInfo,
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
        .filter(({ result }) => {
          if (result.status !== "rejected") return false;
          // If admin checking personal requests and no employee profile exists, 404 is expected
          if (isAdmin && adminScope === "ME" && result.reason?.status === 404) return false;
          return true;
        });

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
  }, [navigate, adminScope]);

  // Silent background refresh every pollTick (every 5s)
  useEffect(() => {
    if (pollTick === 0) return;
    if (!markingId && !returningId) {
      loadRequests();
    }
  }, [pollTick]);

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

    const isProductFound =
      request.status === "COMPLETED" ||
      (typeof request.reviewNote === "string" &&
        (request.reviewNote.includes("[PRODUCT_FOUND]") ||
          request.reviewNote.includes("Product found")));

    const isHold =
      typeof request.reviewNote === "string" &&
      (request.reviewNote.includes("[ON_HOLD]") ||
        request.reviewNote.toLowerCase().includes("out of stock") ||
        request.reviewNote.toLowerCase().includes("on hold"));

    let matchesStatus = statusFilter === "ALL";
    if (!matchesStatus) {
      if (statusFilter === "ON_HOLD") {
        matchesStatus = isHold;
      } else if (statusFilter === "COMPLETED") {
        matchesStatus = isProductFound;
      } else {
        matchesStatus = request.status === statusFilter && !isHold && !isProductFound;
      }
    }

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

    // =====================================================
    // EMPLOYEE FILTER (Admin All Scope)
    // =====================================================
    if (isAdmin && adminScope === "ALL" && employeeFilter !== "ALL") {
      const emp = request.employee;
      if (!emp) return false;
      const key = emp.id || emp.employeeCode || emp.fullName;
      if (key !== employeeFilter && emp.id !== employeeFilter && emp.employeeCode !== employeeFilter) {
        return false;
      }
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
              {isAdmin ? "Track All Requests" : "Track My Request"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isAdmin
                ? "View and track all company-wide employee requests and their current status."
                : "View your submitted requests and their current status."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadRequests}
            className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-secondary"
            aria-label="Refresh requests"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status Filter */}
        {[
          ["ALL", "All Status"],
          ["PENDING", "Pending"],
          ["APPROVED", "Approved"],
          ["ON_HOLD", "On Hold ⏸"],
          ["COMPLETED", "Completed ✓"],
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
          {/* Employee Filter (Admin in ALL scope) */}
          {isAdmin && adminScope === "ALL" && employeesList.length > 0 && (
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="ALL">All Employees ({employeesList.length})</option>
              {employeesList.map((emp) => (
                <option key={emp.key} value={emp.key}>
                  {emp.employeeCode ? `[${emp.employeeCode}] ` : ""}{emp.fullName}
                </option>
              ))}
            </select>
          )}

          {/* Request Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="ALL">All Types</option>
            <option value="LEAVE">Leave</option>
            <option value="CORRECTION">Forgot Punch / Time Edit</option>
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
        null
      ) : filteredRequests.length === 0 ? (
        <div className="rounded-2xl border border-border bg-background p-12 text-center card-shadow">
          {loadError && <p className="mb-3 text-rose-600">{loadError}</p>}
          <p className="text-sm text-muted-foreground">
            No{" "}
            {typeFilter !== "ALL"
              ? typeFilter === "CORRECTION"
                ? "Forgot Punch / Time Edit"
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
                      ? "FORGOT PUNCH / TIME EDIT"
                      : request.type}
                  </span>
                  {(() => {
                    const isEquipment = request.type === "EQUIPMENT";
                    const isProductFound =
                      isEquipment &&
                      (request.status === "COMPLETED" ||
                        (typeof request.reviewNote === "string" &&
                          (request.reviewNote.includes("[PRODUCT_FOUND]") ||
                            request.reviewNote.includes("Product found"))));

                    const isItemNotFound =
                      isEquipment &&
                      typeof request.reviewNote === "string" &&
                      request.reviewNote.includes("[ITEM_NOT_FOUND]");

                    const isHold =
                      isEquipment &&
                      typeof request.reviewNote === "string" &&
                      (request.reviewNote.includes("[ON_HOLD]") ||
                        request.reviewNote.toLowerCase().includes("out of stock") ||
                        request.reviewNote.toLowerCase().includes("on hold"));

                    const isQualityInspected =
                      isEquipment &&
                      typeof request.reviewNote === "string" && request.reviewNote.includes("[QUALITY_INSPECTED]");

                    const isItemReturned =
                      isEquipment &&
                      typeof request.reviewNote === "string" &&
                      (request.reviewNote.includes("[ITEM_RETURNED]") ||
                        request.reviewNote.includes("[PHYSICALLY_RETURNED]"));

                    const isReturnRequest =
                      isEquipment &&
                      ((typeof request.description === "string" && request.description.toLowerCase().includes("action type: return")) ||
                        (typeof request.subject === "string" && request.subject.toLowerCase().includes("inventory return")) ||
                        (typeof request.title === "string" && request.title.toLowerCase().includes("return")));

                    const displayStatus = isProductFound
                      ? isReturnRequest ? "FOUND & RESTOCKED" : "COMPLETED"
                      : isItemNotFound
                      ? "ITEM NOT FOUND"
                      : isHold
                      ? "ON HOLD"
                      : (isReturnRequest && isItemReturned)
                      ? "ITEM RETURNED"
                      : (isReturnRequest && isQualityInspected)
                      ? "QUALITY TESTED"
                      : request.status;

                    const displayStyle = isProductFound
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 font-bold"
                      : isItemNotFound
                      ? "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300 font-bold border border-rose-500/30"
                      : isHold
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 font-bold border border-amber-500/30"
                      : (isReturnRequest && isItemReturned)
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300 font-bold border border-blue-500/30"
                      : (isReturnRequest && isQualityInspected)
                      ? "bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300 font-bold border border-purple-500/30"
                      : statusStyles[request.status] || "bg-secondary text-muted-foreground";

                    return (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold uppercase ${displayStyle}`}
                      >
                        {displayStatus}
                      </span>
                    );
                  })()}

                  {/* Employee Badge */}
                  {request.employee ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/80 px-2.5 py-1 text-xs font-medium text-foreground border border-border">
                      <UserRound className="h-3 w-3 text-muted-foreground" />
                      <span>
                        {request.employee.employeeCode ? `[${request.employee.employeeCode}] ` : ""}
                        {request.employee.fullName || "Employee"}
                      </span>
                      {isMyRequest(request) && (
                        <span className="rounded bg-primary/20 px-1.5 py-0.2 text-[10px] font-bold text-primary">
                          Me
                        </span>
                      )}
                    </span>
                  ) : isMyRequest(request) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary border border-primary/20">
                      <UserRound className="h-3 w-3" />
                      Me
                    </span>
                  )}
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
              <FormattedInventoryTitle title={request.subject} className="mb-3" />

              <div className="grid gap-2 text-sm">
                <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(request.createdAt)}</span>
                  <Clock3 className="ml-2 h-4 w-4" />
                  <span>{formatTime(request.createdAt)}</span>
                  {request.employee && (
                    <>
                      <span className="mx-1 text-muted-foreground/40">•</span>
                      <span className="flex items-center gap-1 text-foreground/80 font-medium">
                        <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
                        {request.employee.fullName}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* ─── Phase Line Timeline Bar for EQUIPMENT / Inventory Requests ─── */}
              {request.type === "EQUIPMENT" && (
                <div className="mt-5 pt-4 border-t border-border">
                  {/* Request Phase Pipeline (Only for Tools & Spares / Equipment / Project requests) */}
                  {(() => {
                    const isProductFound =
                      request.status === "COMPLETED" ||
                      (typeof request.reviewNote === "string" &&
                        (request.reviewNote.includes("[PRODUCT_FOUND]") ||
                          request.reviewNote.includes("Product found")));

                    const isItemNotFound =
                      typeof request.reviewNote === "string" &&
                      request.reviewNote.includes("[ITEM_NOT_FOUND]");

                    const isHold =
                      typeof request.reviewNote === "string" &&
                      (request.reviewNote.includes("[ON_HOLD]") ||
                        request.reviewNote.toLowerCase().includes("out of stock") ||
                        request.reviewNote.toLowerCase().includes("on hold"));

                    const isReturnRequest =
                      (typeof request.description === "string" && request.description.toLowerCase().includes("action type: return")) ||
                      (typeof request.subject === "string" && request.subject.toLowerCase().includes("inventory return")) ||
                      (typeof request.title === "string" && request.title.toLowerCase().includes("return"));

                    const isQualityInspected =
                      typeof request.reviewNote === "string" && request.reviewNote.includes("[QUALITY_INSPECTED]");

                    const isItemReturned =
                      typeof request.reviewNote === "string" &&
                      (request.reviewNote.includes("[ITEM_RETURNED]") ||
                        request.reviewNote.includes("[PHYSICALLY_RETURNED]"));

                    return (
                      <>
                        <div className="flex items-center justify-between text-xs font-semibold mb-2">
                          <span className="text-foreground flex items-center gap-1.5">
                            <Layers className="h-3.5 w-3.5 text-primary" /> Request Progress Lifecycle
                          </span>
                          <span className="text-muted-foreground">
                            {isItemNotFound && !isProductFound && "Phase 2: Reported NOT FOUND in Store/Workshop"}
                            {!isItemNotFound && isHold && "Phase 2: ON HOLD (Product Out of Stock)"}
                            {!isHold && isReturnRequest && (
                              isProductFound
                                ? "Phase 4: Found Item & Restocked to Warehouse"
                                : isItemReturned
                                ? "Phase 3: Item Returned by Employee (Awaiting Admin Found Item)"
                                : isQualityInspected || request.status === "APPROVED"
                                ? "Phase 2: Quality Tested & Approved (Please click Item Return)"
                                : "Phase 1: Return Request Submitted (Pending Approval)"
                            )}
                            {!isHold && !isReturnRequest && request.status === "PENDING" && "Phase 1: In Review (Submitted to Admin)"}
                            {!isHold && !isReturnRequest && request.status === "APPROVED" && !isProductFound && "Phase 2: Admin Approved (Ready for Pickup)"}
                            {!isHold && !isReturnRequest && isProductFound && "Phase 3: Product Found & Collected"}
                            {request.status === "REJECTED" && "Request Rejected"}
                          </span>
                        </div>

                        {/* Step Indicators & Line */}
                        {isReturnRequest ? (
                          <div className="relative flex items-center justify-between my-4 px-2">
                            {/* Background Connecting Line */}
                            <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-secondary rounded-full -z-0" />

                            {/* Filled Progress Line */}
                            <div
                              className="absolute left-6 top-1/2 -translate-y-1/2 h-1 rounded-full transition-all duration-500 -z-0 bg-gradient-to-r from-amber-500 via-purple-500 to-emerald-500"
                              style={{
                                width: isProductFound
                                  ? "92%"
                                  : isItemReturned
                                  ? "68%"
                                  : isQualityInspected || request.status === "APPROVED"
                                  ? "40%"
                                  : "12%",
                              }}
                            />

                            {/* Step 1 Node: Return Submitted */}
                            <div className="flex flex-col items-center gap-1 z-10 bg-background px-1">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-amber-600 text-white shadow-xs">
                                1
                              </div>
                              <span className="text-[11px] font-medium text-muted-foreground">Return Submitted</span>
                            </div>

                            {/* Step 2 Node: Quality Tested */}
                            <div className="flex flex-col items-center gap-1 z-10 bg-background px-1">
                              <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                  isQualityInspected || request.status === "APPROVED" || isItemReturned || isProductFound
                                    ? "bg-purple-600 text-white shadow-xs ring-2 ring-purple-500/20"
                                    : "bg-secondary text-muted-foreground"
                                }`}
                              >
                                2
                              </div>
                              <span className="text-[11px] font-medium text-muted-foreground">Quality Tested</span>
                            </div>

                            {/* Step 3 Node: Item Return */}
                            <div className="flex flex-col items-center gap-1 z-10 bg-background px-1">
                              <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                  isItemReturned || isProductFound
                                    ? "bg-blue-600 text-white shadow-xs ring-2 ring-blue-500/20"
                                    : "bg-secondary text-muted-foreground"
                                }`}
                              >
                                3
                              </div>
                              <span className="text-[11px] font-medium text-muted-foreground">Item Return</span>
                            </div>

                            {/* Step 4 Node: Found Item */}
                            <div className="flex flex-col items-center gap-1 z-10 bg-background px-1">
                              <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                  isProductFound
                                    ? "bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-500/20"
                                    : "bg-secondary text-muted-foreground"
                                }`}
                              >
                                4
                              </div>
                              <span className="text-[11px] font-medium text-muted-foreground">Found Item</span>
                            </div>
                          </div>
                        ) : (
                          <div className="relative flex items-center justify-between my-4 px-2">
                            {/* Background Connecting Line */}
                            <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-secondary rounded-full -z-0" />

                            {/* Filled Progress Line */}
                            <div
                              className={`absolute left-6 top-1/2 -translate-y-1/2 h-1 rounded-full transition-all duration-500 -z-0 ${
                                isHold
                                  ? "bg-gradient-to-r from-blue-500 to-amber-500"
                                  : "bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500"
                              }`}
                              style={{
                                width:
                                  isHold
                                    ? "50%"
                                    : request.status === "PENDING"
                                    ? "35%"
                                    : isProductFound
                                    ? "90%"
                                    : request.status === "APPROVED"
                                    ? "68%"
                                    : "0%",
                              }}
                            />

                            {/* Step 1 Node */}
                            <div className="flex flex-col items-center gap-1 z-10 bg-background px-1">
                              <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                  request.status !== "REJECTED"
                                    ? "bg-blue-600 text-white shadow-xs"
                                    : "bg-secondary text-muted-foreground"
                                }`}
                              >
                                1
                              </div>
                              <span className="text-[11px] font-medium text-muted-foreground">Submitted</span>
                            </div>

                            {/* Step 2 Node */}
                            <div className="flex flex-col items-center gap-1 z-10 bg-background px-1">
                              <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                  isHold
                                    ? "bg-amber-500 text-white shadow-xs ring-2 ring-amber-500/20"
                                    : request.status === "APPROVED" || isProductFound
                                    ? "bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-500/20"
                                    : "bg-secondary text-muted-foreground"
                                }`}
                              >
                                {isHold ? <PauseCircle className="h-4 w-4" /> : "2"}
                              </div>
                              <span className="text-[11px] font-medium text-muted-foreground">
                                {isHold ? "On Hold" : "Admin Approved"}
                              </span>
                            </div>

                            {/* Step 3 Node */}
                            <div className="flex flex-col items-center gap-1 z-10 bg-background px-1">
                              <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                  isProductFound
                                    ? "bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-500/20"
                                    : "bg-secondary text-muted-foreground"
                                }`}
                              >
                                3
                              </div>
                              <span className="text-[11px] font-medium text-muted-foreground">Product Found</span>
                            </div>
                          </div>
                        )}

                        {/* On Hold Warning Banner */}
                        {isHold && (
                          <div className="mt-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <div className="text-xs font-bold text-amber-800 dark:text-amber-300">
                                Request Placed On Hold (Product Out of Stock)
                              </div>
                              <div className="text-xs text-amber-700 dark:text-amber-400 mt-1 font-medium">
                                {request.reviewNote?.replace(/\[ON_HOLD\]\s*/g, "") || "Admin noted product is currently out of stock. It will be fulfilled once restocked."}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Action Button: "Item Return" (Appears for Return Request when Approved & Quality Tested & not yet returned) */}
                        {isReturnRequest && (request.status === "APPROVED" || isQualityInspected) && !isItemReturned && !isProductFound && !isHold && (
                          <div className="mt-3 p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between flex-wrap gap-3">
                            <div className="text-xs text-purple-700 dark:text-purple-300 font-medium flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-purple-600" />
                              <span>Admin approved & quality tested! Hand over item to store/admin and click below.</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleItemReturn(request.id)}
                              disabled={returningId === request.id}
                              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                              {returningId === request.id ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Submitting...
                                </>
                              ) : (
                                <>
                                  <RotateCcw className="h-4 w-4" /> Item Return
                                </>
                              )}
                            </button>
                          </div>
                        )}

                        {/* Action Banner & Button: "Product Found" (Appears for Return Request when Employee clicked Item Return & waiting for Admin Found) */}
                        {isReturnRequest && isItemReturned && !isProductFound && !isHold && (
                          <div className="mt-3 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between flex-wrap gap-3">
                            <div className="text-xs text-blue-700 dark:text-blue-300 font-medium flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-600" />
                              <span>Item Return submitted by employee ✓ Waiting for Admin verification and "Product Found" restock confirmation.</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleMarkProductFound(request.id)}
                              disabled={markingId === request.id}
                              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                              {markingId === request.id ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Restocking...
                                </>
                              ) : (
                                <>
                                  <PackageCheck className="h-4 w-4" /> Product Found
                                </>
                              )}
                            </button>
                          </div>
                        )}

                        {/* Action Decision: "Item Found" vs "Item Not Found" for Taking Request (Employee decides) */}
                        {request.status === "APPROVED" && !isProductFound && !isReturnRequest && (
                          <div className="mt-3.5 p-4 rounded-2xl bg-secondary/40 border-2 border-primary/20 space-y-3">
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div>
                                <div className="text-xs font-bold text-foreground flex items-center gap-2">
                                  <PackageCheck className="h-4 w-4 text-primary" />
                                  <span>Admin Approved • Physical Collection Verification</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Check workshop/store to confirm if the item is physically available:
                                </p>
                              </div>

                              {isItemNotFound && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                                  <X className="h-3 w-3" /> Reported: Not Found
                                </span>
                              )}
                            </div>

                            {isItemNotFound && (
                              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                                <div>
                                  <span className="font-semibold">Item Not Found on shelf.</span> Store & Admin have been notified.
                                  If located later, click <strong>"Item Found"</strong> below to complete pickup.
                                </div>
                              </div>
                            )}

                            <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap pt-1">
                              {/* 1. PRODUCT FOUND BUTTON */}
                              <button
                                type="button"
                                onClick={() => handleMarkProductFound(request.id)}
                                disabled={markingId === request.id || notFoundLoading}
                                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-500/25 hover:from-emerald-700 hover:to-teal-700 transition cursor-pointer disabled:opacity-50 ring-2 ring-emerald-500/40"
                              >
                                {markingId === request.id ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" /> Verifying...
                                  </>
                                ) : (
                                  <>
                                    <PackageCheck className="h-4 w-4" /> Product Found
                                  </>
                                )}
                              </button>

                              {/* 2. ITEM NOT FOUND BUTTON */}
                              <button
                                type="button"
                                onClick={() => {
                                  setNotFoundModal(request);
                                  setNotFoundReason("");
                                }}
                                disabled={markingId === request.id || notFoundLoading}
                                className="flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-rose-300 bg-white dark:bg-background px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition cursor-pointer disabled:opacity-50"
                              >
                                <X className="h-4 w-4" /> Item Not Found
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Completed Status Banner */}
                        {isProductFound && (
                          <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                            <CheckCheck className="h-4 w-4 text-emerald-600" />
                            <span>
                              {isReturnRequest
                                ? "Product returned, quality tested & confirmed Found Item by Admin! Restocked to warehouse."
                                : "Product found & item lifecycle completed."}
                            </span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
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
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${typeStyles[reasonModal.type] || "bg-gray-100 text-gray-700"}`}
                >
                  {reasonModal.type === "CORRECTION"
                    ? "FORGOT PUNCH / TIME EDIT"
                    : reasonModal.type}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${statusStyles[reasonModal.status] || "bg-secondary text-muted-foreground"}`}
                >
                  {reasonModal.status}
                </span>
                {reasonModal.employee && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/80 px-2.5 py-1 text-xs font-medium text-foreground border border-border">
                    <UserRound className="h-3 w-3 text-muted-foreground" />
                    <span>
                      {reasonModal.employee.employeeCode ? `[${reasonModal.employee.employeeCode}] ` : ""}
                      {reasonModal.employee.fullName || "Employee"}
                    </span>
                    {isMyRequest(reasonModal) && (
                      <span className="rounded bg-primary/20 px-1.5 py-0.2 text-[10px] font-bold text-primary">
                        Me
                      </span>
                    )}
                  </span>
                )}
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
                                  : forgotPunch?.punchType === "time-edit"
                                    ? "Time Edit"
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
                        {attendanceReason.isCheckInUnassigned && (
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
                        )}

                        {/* 2. CHECK-OUT DIV */}
                        {attendanceReason.isCheckOutUnassigned && (reasonModal.checkOutTime || reasonModal.checkOutLatitude || reasonModal.checkOutDistance) && (
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
                  <RenderFormattedDetails
                    text={
                      getRequestReason(reasonModal) ||
                      reasonModal.description ||
                      "No reason provided."
                    }
                  />
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
                      <Clock3 className={`h-3.5 w-3.5 ${isApprovedOrCompletedStatus(reasonModal.status, reasonModal.reviewNote) ? "text-emerald-600" : "text-rose-600"}`} />
                      <span className={`font-semibold ${isApprovedOrCompletedStatus(reasonModal.status, reasonModal.reviewNote) ? "text-emerald-700" : "text-rose-700"}`}>
                        {isApprovedOrCompletedStatus(reasonModal.status, reasonModal.reviewNote) ? "Approved At" : "Rejected At"}
                      </span>
                    </div>
                    <span className={`text-xs font-bold ${isApprovedOrCompletedStatus(reasonModal.status, reasonModal.reviewNote) ? "text-emerald-700" : "text-rose-700"}`}>
                      {formatDate(reasonModal.reviewedAt)} {formatTime(reasonModal.reviewedAt)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex flex-wrap gap-2 border-t border-border px-5 py-4">
              {reasonModal.status === "APPROVED" &&
                !reasonModal.reviewNote?.includes("[PRODUCT_FOUND]") &&
                !reasonModal.reviewNote?.includes("[ON_HOLD]") && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const id = reasonModal.id;
                        setReasonModal(null);
                        handleMarkProductFound(id);
                      }}
                      disabled={markingId === reasonModal.id || notFoundLoading}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-2 font-bold text-xs text-white hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 min-w-[110px] shadow-sm cursor-pointer ring-2 ring-emerald-500/30"
                    >
                      <PackageCheck className="h-3.5 w-3.5" />
                      Product Found
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const target = reasonModal;
                        setReasonModal(null);
                        setNotFoundModal(target);
                        setNotFoundReason("");
                      }}
                      disabled={markingId === reasonModal.id || notFoundLoading}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border-2 border-rose-300 bg-white dark:bg-background px-3 py-2 font-bold text-xs text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 disabled:opacity-50 min-w-[110px] cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                      Item Not Found
                    </button>
                  </>
                )}
              <button
                type="button"
                onClick={() => setReasonModal(null)}
                className="flex-1 rounded-lg bg-secondary px-4 py-2 font-medium text-xs hover:bg-secondary/80 min-w-[80px]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Not Found Confirmation Modal */}
      {notFoundModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!notFoundLoading) setNotFoundModal(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-foreground">
                  Report Item Not Found
                </h3>
                <p className="text-xs text-muted-foreground truncate max-w-[280px]">
                  {notFoundModal.subject}
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mb-3">
              Cannot locate this item in the store or workshop? Submitting this will record that the item was not found and alert the Admin / Store manager to check inventory or restock.
            </p>

            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Reason / Remarks (Optional)
            </label>
            <textarea
              rows={3}
              value={notFoundReason}
              onChange={(e) => setNotFoundReason(e.target.value)}
              placeholder="e.g. Shelf is empty, missing from rack, not in workshop..."
              className="w-full rounded-xl border border-border bg-secondary/30 p-3 text-xs outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 mb-4 resize-none"
            />

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setNotFoundModal(null)}
                disabled={notFoundLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleMarkProductNotFound(notFoundModal.id, notFoundReason)}
                disabled={notFoundLoading}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {notFoundLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    <X className="h-3.5 w-3.5" /> Confirm Not Found
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrackRequests;
