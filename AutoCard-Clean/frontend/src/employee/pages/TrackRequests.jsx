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
  Package,
  Briefcase,
  Tag,
  UserRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../lib/api.js";
import { clearAuth, getAuthUser } from "../../lib/auth.js";
import { formatTimeWithPeriod } from "../../lib/timeFormat.js";

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
  const str = String(value).trim();
  if (str.includes("T") || str.includes("-")) {
    const date = new Date(str);
    if (!Number.isNaN(date.getTime())) {
      return formatTimeWithPeriod(date, "en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }
  }
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

const openMap = (latitude, longitude, type = "location", location = "") => {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const hasCoordinates =
    latitude != null &&
    longitude != null &&
    String(latitude).trim() !== "" &&
    String(longitude).trim() !== "" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng);
  const searchQuery = String(location || "").trim();
  if (!hasCoordinates && !searchQuery) {
    toast.error(`${type} coordinates are not available.`);
    return;
  }
  const query = hasCoordinates
    ? `${lat},${lng}`
    : encodeURIComponent(searchQuery);
  window.open(
    `https://www.google.com/maps/search/?api=1&query=${query}`,
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

const isLocationApprovalRequest = (request) => {
  if (request?.type === "ATTENDANCE") return true;
  if (request?.type !== "CORRECTION") return false;

  const subject = String(request.subject || "").toLowerCase();
  const description = String(request.description || "").toLowerCase();
  return (
    subject.includes("check-in approval") ||
    subject.includes("check-out approval") ||
    subject.includes("location approval") ||
    (subject.includes("check in (ul)") &&
      subject.includes("check out (forgot punch)")) ||
    (subject.includes("check in (forgot punch)") &&
      subject.includes("check out (ul)")) ||
    request?.forgotPunch?.checkInLocationSource === "unassigned-location" ||
    request?.forgotPunch?.checkOutLocationSource === "unassigned-location" ||
    description.includes("unassigned location") ||
    description.includes("outside assigned location")
  );
};

const getCombinedLocationRequestTitle = (forgotPunch, date = "") => {
  const checkInSource =
    forgotPunch?.checkInLocationSource ||
    (forgotPunch?.checkInLatitude != null
      ? "unassigned-location"
      : "forgot-punch");
  const checkOutSource =
    forgotPunch?.checkOutLocationSource ||
    (forgotPunch?.checkOutLatitude != null
      ? "unassigned-location"
      : "forgot-punch");
  return checkInSource === "forgot-punch" &&
    checkOutSource === "unassigned-location"
    ? `Check In (Forgot Punch) and Check Out (UL) (${date})`
    : `Check In (UL) and Check Out (Forgot Punch) (${date})`;
};

const getPunchLocationSource = (request, forgotPunch, punch) => {
  const isCheckIn = punch === "checkIn";
  const source = forgotPunch?.[`${punch}LocationSource`];
  if (source) return source;

  const subject = String(request?.subject || "").toLowerCase();
  const description = String(request?.description || "").toLowerCase();
  const punchLabel = isCheckIn ? "check in" : "check out";

  // New subject patterns
  if (isCheckIn) {
    if (subject.includes("forgot check in")) return "forgot-punch";
    if (subject.includes("ul check in")) return "unassigned-location";
  } else {
    if (subject.includes("forgot check out")) return "forgot-punch";
    if (subject.includes("ul check out")) return "unassigned-location";
  }

  if (subject.includes(`${punchLabel} (ul)`)) return "unassigned-location";
  if (subject.includes(`${punchLabel} (forgot punch)`)) return "forgot-punch";

  // Only treat coordinates as UL if description explicitly says "unassigned location"
  if (
    (description.includes("unassigned location") || description.includes("outside assigned location")) &&
    (forgotPunch?.[`${punch}Latitude`] != null || forgotPunch?.[`${punch}Longitude`] != null)
  ) {
    return "unassigned-location";
  }

  if (forgotPunch?.[`${punch}Location`]) return "forgot-punch";

  const punchType = String(forgotPunch?.punchType || "").toLowerCase();
  const includesPunch =
    punchType === (isCheckIn ? "check-in" : "check-out") ||
    punchType === "both";
  if (includesPunch && subject.includes("forgot punch")) return "forgot-punch";
  if (punchType === (isCheckIn ? "check-in" : "check-out")) {
    return "forgot-punch";
  }
  return null;
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

const cleanPureReason = (rawReason, rawDescription) => {
  let candidate = (typeof rawReason === "string" ? rawReason : "").trim();
  if (/^unassigned location (check-in|check-out)$/i.test(candidate)) {
    candidate = "";
  }

  const desc = (typeof rawDescription === "string" ? rawDescription : candidate).split("[ATTENDANCE_CORRECTION]")[0].trim();
  const targetText = candidate || desc;

  const reasonMatches = [...targetText.matchAll(/Reason:\s*(.*?)(?=\s*(?:\.\s*Pending admin approval|\.\s*Admin approved|\.\s*Admin rejected|Pending admin approval|Admin approved|Admin rejected)\b|\s*\||$)/gi)];
  if (reasonMatches.length > 0) {
    const joined = reasonMatches.map(m => m[1].trim()).filter(Boolean).join(" | ");
    if (joined && !/^unassigned location (check-in|check-out)$/i.test(joined)) {
      return joined.replace(/\.$/, "").trim();
    }
  }

  let cleaned = targetText
    .replace(/^(?:Forgot Punch|Time Edit) request for .*? on \d{4}-\d{2}-\d{2}.*?(?:\.\s*|$)/i, "")
    .replace(/^Forgot Punch (?:approved|pending approval|rejected)\.?\s*/gi, "")
    .replace(/^Checkin:?[^|]*\|?/i, "")
    .replace(/Checkout [^.]*\./i, "")
    .replace(/Check-?[io]ut from unassigned location[^.]*\./gi, "")
    .replace(/Check-?[io]ut outside assigned location[^.]*\./gi, "")
    .replace(/Check-?[io]ut to unassigned location[^.]*\./gi, "")
    .replace(/Check-In Location:.*$/i, "")
    .replace(/Check-Out Location:.*$/i, "")
    .replace(/\|?\s*Pending admin approval\.?/gi, "")
    .replace(/\|?\s*Approved by admin\.?/gi, "")
    .replace(/\|?\s*Rejected by admin\.?/gi, "")
    .replace(/Reason:\s*/gi, "")
    .replace(/\|/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned;
};

const getRequestTypeInfo = (request, attendanceRecord) => {
  if (!request) {
    const note = String(attendanceRecord?.note || "").toLowerCase();
    const isUnassigned = note.includes("unassigned") || note.includes("outside assigned") || note.includes("requires approval");
    if (isUnassigned) {
      return {
        category: "Location Approval Details",
        typeLabel: "Location Approval",
        displayTitle: "Location Approval (Unassigned Punch)",
        iconType: "location",
      };
    }
    return {
      category: "Attendance Details",
      typeLabel: "Attendance Record",
      displayTitle: "Attendance Record Details",
      iconType: "attendance",
    };
  }

  const subject = String(request.subject || "").trim();
  const lowerSubj = subject.toLowerCase();
  const description = String(request.description || "").toLowerCase();
  const lowerDesc = description;
  const reqType = String(request.type || "").toUpperCase();
  const notification = request.notification || {};
  let correction = request.correctionDetails || request.forgotPunch || {};
  if (!correction.checkInLocationSource && description.includes("[attendance_correction]")) {
    try {
      correction = JSON.parse(description.split("[attendance_correction]")[1].trim());
    } catch {}
  }
  const punchType = String(correction.punchType || notification.punchType || "").toLowerCase();

  // 1. Time Edit Request
  const isTimeEdit =
    correction.isTimeEdit ||
    punchType === "time-edit" ||
    punchType === "time edit" ||
    lowerSubj.includes("time edit") ||
    description.includes("time edit request");

  if (isTimeEdit) {
    const tePunchType =
      correction.timeEditPunchType ||
      (correction.checkInTime && !correction.checkOutTime
        ? "check-in"
        : correction.checkOutTime && !correction.checkInTime
          ? "check-out"
          : (lowerDesc.includes("at check-in") && !lowerDesc.includes("at check-out") && !lowerDesc.includes("and check-out")
              ? "check-in"
              : (lowerDesc.includes("at check-out") && !lowerDesc.includes("at check-in")
                  ? "check-out"
                  : "both")));

    const isCheckInOnly = tePunchType === "check-in";
    const isCheckOutOnly = tePunchType === "check-out";

    const isULIn =
      correction.isULCheckIn ||
      correction.checkInLocationSource === "unassigned-location" ||
      (correction.checkInLatitude != null && correction.checkInLocationSource !== "forgot-punch") ||
      lowerSubj.includes("ul check in");

    const isULOut =
      !isCheckInOnly &&
      (correction.isULCheckOut ||
       correction.checkOutLocationSource === "unassigned-location" ||
       (correction.checkOutLatitude != null && correction.checkOutLocationSource !== "forgot-punch"));

    if (isCheckInOnly) {
      return {
        category: "Location Approval + Time Edit Details",
        typeLabel: isULIn ? "UL Check In + Time Edit" : "Time Edit (Check In)",
        displayTitle: isULIn ? `UL Check In + Time Edit (${correction.date || ""})` : `Time Edit Request - Check In (${correction.date || ""})`,
        iconType: isULIn ? "location" : "time-edit",
      };
    }
    if (isCheckOutOnly) {
      return {
        category: "Location Approval + Time Edit Details",
        typeLabel: isULOut ? "UL Check Out + Time Edit" : "Time Edit (Check Out)",
        displayTitle: isULOut ? `UL Check Out + Time Edit (${correction.date || ""})` : `Time Edit Request - Check Out (${correction.date || ""})`,
        iconType: isULOut ? "location" : "time-edit",
      };
    }
    if (isULIn && !isULOut) {
      return {
        category: "Location Approval + Time Edit Details",
        typeLabel: "UL Check In + Time Edit",
        displayTitle: `UL Check In + Time Edit (${correction.date || ""})`,
        iconType: "location",
      };
    }
    if (isULOut && !isULIn) {
      return {
        category: "Location Approval + Time Edit Details",
        typeLabel: "UL Check Out + Time Edit",
        displayTitle: `UL Check Out + Time Edit (${correction.date || ""})`,
        iconType: "location",
      };
    }

    return {
      category: "Time Edit Request Details",
      typeLabel: "Time Edit Request",
      displayTitle: subject || `Time Edit Request (${correction.date || ""})`,
      iconType: "time-edit",
    };
  }

  // 2. Leave
  if (reqType === "LEAVE") {
    return {
      category: "Leave Request Details",
      typeLabel: "Leave Request",
      displayTitle: subject || "Leave Request",
      iconType: "leave",
    };
  }

  // 3. Equipment
  if (reqType === "EQUIPMENT") {
    return {
      category: "Equipment Request Details",
      typeLabel: "Equipment Request",
      displayTitle: subject || "Equipment Request",
      iconType: "equipment",
    };
  }

  // Distinguish whether checkout or checkin were marked at default location (normal punch)
  const isCheckOutDefaultLoc =
    correction.checkOutLocationSource === "default-location" ||
    description.includes("checked out via mark attendance (default location)") ||
    (description.includes("default location") && !description.includes("check-out location:"));

  const isCheckInDefaultLoc =
    correction.checkInLocationSource === "default-location" ||
    description.includes("checked in via mark attendance (default location)");

  // 4. Hybrid / Combo Requests
  const hasForgotCheckOut =
    !isCheckOutDefaultLoc &&
    (lowerSubj.includes("forgot check out") ||
     lowerSubj.includes("check out (forgot punch)") ||
     correction.checkOutLocationSource === "forgot-punch");

  const hasULCheckIn =
    lowerSubj.includes("ul check in") ||
    lowerSubj.includes("check in (ul)") ||
    correction.checkInLocationSource === "unassigned-location";

  const hasForgotCheckIn =
    !isCheckInDefaultLoc &&
    (lowerSubj.includes("forgot check in") ||
     lowerSubj.includes("check in (forgot punch)") ||
     correction.checkInLocationSource === "forgot-punch");

  const hasULCheckOut =
    !isCheckOutDefaultLoc &&
    (lowerSubj.includes("ul check out") ||
     lowerSubj.includes("check out (ul)") ||
     correction.checkOutLocationSource === "unassigned-location");

  const subjectWithoutDate = subject
    .replace(/\s*\(\d{4}-\d{2}-\d{2}\).*$/, "")
    .replace(/\s*-\s*\d{4}-\d{2}-\d{2}.*$/, "")
    .trim();

  // If check-in is strictly the request:
  if (correction.punchType === "check-in" || (hasULCheckIn && !hasULCheckOut && !hasForgotCheckOut)) {
    const isFP = correction.checkInLocationSource === "forgot-punch" || (!hasULCheckIn && hasForgotCheckIn);
    const typeLabel = isFP ? "Forgot Check In" : "UL Check In";
    return {
      category: isFP ? "Forgot Punch Details" : "Location Approval Details",
      typeLabel,
      displayTitle: `${typeLabel} (${correction.date || ""})`,
      iconType: isFP ? "clock" : "location",
    };
  }

  // If check-out is strictly the request:
  if (correction.punchType === "check-out" || (hasULCheckOut && !hasULCheckIn && !hasForgotCheckIn)) {
    const isFP = correction.checkOutLocationSource === "forgot-punch" || (!hasULCheckOut && hasForgotCheckOut);
    const typeLabel = isFP ? "Forgot Check Out" : "UL Check Out";
    return {
      category: isFP ? "Forgot Punch Details" : "Location Approval Details",
      typeLabel,
      displayTitle: `${typeLabel} (${correction.date || ""})`,
      iconType: isFP ? "clock" : "location",
    };
  }

  // Combo A: Real Forgot Check Out + UL Check In (where checkout is actually forgot-punch)
  if (
    (hasForgotCheckOut && hasULCheckIn) ||
    (lowerSubj.includes("check in (ul)") && lowerSubj.includes("check out (forgot punch)")) ||
    (lowerSubj.includes("check out (forgot punch)") && lowerSubj.includes("check in (ul)"))
  ) {
    const typeLabel = lowerSubj.startsWith("forgot check out")
      ? "Forgot Check Out + UL Check In"
      : lowerSubj.startsWith("check in (ul)")
        ? "Check In (UL) + Check Out (Forgot Punch)"
        : subjectWithoutDate || "Forgot Check Out + UL Check In";
    return {
      category: "Forgot Punch + Location Approval Details",
      typeLabel,
      displayTitle: subject || `${typeLabel} (${correction.date || ""})`,
      iconType: "location",
    };
  }

  // Combo B: Real Forgot Check In + UL Check Out
  if (
    (hasForgotCheckIn && hasULCheckOut) ||
    (lowerSubj.includes("check in (forgot punch)") && lowerSubj.includes("check out (ul)")) ||
    (lowerSubj.includes("check out (ul)") && lowerSubj.includes("check in (forgot punch)"))
  ) {
    const typeLabel = lowerSubj.startsWith("ul check out")
      ? "UL Check Out + Forgot Check In"
      : lowerSubj.startsWith("check in (forgot punch)")
        ? "Check In (Forgot Punch) + Check Out (UL)"
        : subjectWithoutDate || "Forgot Check In + UL Check Out";
    return {
      category: "Forgot Punch + Location Approval Details",
      typeLabel,
      displayTitle: subject || `${typeLabel} (${correction.date || ""})`,
      iconType: "location",
    };
  }

  // Combo C: UL Check In + UL Check Out
  if (
    (hasULCheckIn && hasULCheckOut) ||
    lowerSubj.includes("ul check in + ul check out") ||
    (lowerSubj.includes("check in (ul)") && lowerSubj.includes("check out (ul)"))
  ) {
    const typeLabel = subjectWithoutDate || "UL Check In + UL Check Out";
    return {
      category: "Location Approval Details",
      typeLabel,
      displayTitle: subject || `UL Check In + UL Check Out (${correction.date || ""})`,
      iconType: "location",
    };
  }

  // 5. Pure Location Approval
  const isUL =
    reqType === "ATTENDANCE" ||
    lowerSubj.includes("location approval") ||
    lowerSubj.includes("check in (ul)") ||
    lowerSubj.includes("check out (ul)") ||
    lowerSubj.includes("ul check in") ||
    lowerSubj.includes("ul check out") ||
    description.includes("unassigned location") ||
    description.includes("outside assigned location");

  if (isUL) {
    let punchDesc = "Location Approval";
    let typeLabel = "Location Approval";
    if (lowerSubj.includes("check in") && lowerSubj.includes("check out")) {
      punchDesc = "Location Approval - Check In + Check Out";
      typeLabel = "Location Approval (In + Out)";
    } else if (lowerSubj.includes("check out") || lowerSubj.includes("ul check out") || punchType === "check-out") {
      punchDesc = "Location Approval - Check Out";
      typeLabel = "Location Approval (Check Out)";
    } else if (lowerSubj.includes("check in") || lowerSubj.includes("ul check in") || punchType === "check-in") {
      punchDesc = "Location Approval - Check In";
      typeLabel = "Location Approval (Check In)";
    }
    return {
      category: "Location Approval Details",
      typeLabel: subjectWithoutDate || typeLabel,
      displayTitle: subject || punchDesc,
      iconType: "location",
    };
  }

  // 6. Pure Forgot Punch
  const isForgotPunch =
    reqType === "CORRECTION" ||
    lowerSubj.includes("forgot punch") ||
    lowerSubj.includes("forgot check") ||
    description.includes("[attendance_correction]");

  if (isForgotPunch) {
    let punchDesc = "Forgot Punch Request";
    let typeLabel = "Forgot Punch";
    if (
      punchType === "both" ||
      (punchType.includes("check in") && punchType.includes("check out")) ||
      (lowerSubj.includes("check in") && lowerSubj.includes("check out"))
    ) {
      punchDesc = "Forgot Punch - Check In + Check Out";
      typeLabel = "Forgot Punch (In + Out)";
    } else if (punchType === "check-out" || lowerSubj.includes("check out") || lowerSubj.includes("checkout")) {
      punchDesc = "Forgot Punch - Check Out";
      typeLabel = "Forgot Punch (Check Out)";
    } else if (punchType === "check-in" || lowerSubj.includes("check in") || lowerSubj.includes("checkin")) {
      punchDesc = "Forgot Punch - Check In";
      typeLabel = "Forgot Punch (Check In)";
    }
    return {
      category: "Forgot Punch Request Details",
      typeLabel: subjectWithoutDate || typeLabel,
      displayTitle: subject || punchDesc,
      iconType: "forgot-punch",
    };
  }

  return {
    category: "Approval Details",
    typeLabel: subjectWithoutDate || request.type || "Attendance Request",
    displayTitle: subject || "Approval Details",
    iconType: "general",
  };
};

const cleanForgotPunchReason = (value) =>
  String(value || "")
    .replace(/^(?:Forgot Punch|Time Edit) request for [^\r\n]*(?:\r?\n|$)/i, "")
    .replace(/(?:^|\r?\n)\s*Check[\s-]*In Location:?\s*[^\r\n]*/gi, "")
    .replace(/(?:^|\r?\n)\s*Check[\s-]*Out Location:?\s*[^\r\n]*/gi, "")
    .replace(/\|?\s*Pending admin approval\.?/gi, "")
    .replace(/\|?\s*Approved by admin\.?/gi, "")
    .replace(/\|?\s*Rejected by admin\.?/gi, "")
    .replace(/^\s*Reason:\s*/i, "")
    .replace(/\|/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const getRequestReason = (request) => {
  if (!request?.description) return "No reason provided.";
  let text = String(request.description || "");

  const markerIndex = text.indexOf("[ATTENDANCE_CORRECTION]");
  if (markerIndex !== -1) {
    text = text.substring(0, markerIndex);
  }

  return cleanForgotPunchReason(text) || "No reason provided.";
};
const getForgotPunchData = (request) => {
  if (request?.type !== "CORRECTION") {
    return null;
  }

  const notificationData = request.notification || null;
  const mergedData = request.forgotPunch || null;
  if (!request?.description) {
    return mergedData || notificationData;
  }

  const marker = "[ATTENDANCE_CORRECTION]";
  const markerIndex = request.description.lastIndexOf(marker);
  const readableText =
    markerIndex === -1
      ? request.description
      : request.description.slice(0, markerIndex);
  const readLocation = (label) =>
    readableText.match(
      new RegExp(`(?:^|\\n)\\s*${label} Location:\\s*([^\\r\\n]+)`, "i"),
    )?.[1]?.trim() || null;
  const checkInLocation = readLocation("Check-In");
  const checkOutLocation = readLocation("Check-Out");

  if (markerIndex === -1) {
    return mergedData || notificationData
      ? {
          ...notificationData,
          ...mergedData,
          checkInLocation:
            mergedData?.checkInLocation ||
            notificationData?.checkInLocation ||
            checkInLocation,
          checkOutLocation:
            mergedData?.checkOutLocation ||
            notificationData?.checkOutLocation ||
            checkOutLocation,
        }
      : null;
  }

  const jsonText = request.description
    .slice(markerIndex + marker.length)
    .trim();

  if (!jsonText) {
    return mergedData || notificationData;
  }

  try {
    const parsed = JSON.parse(jsonText);
    return {
      ...parsed,
      checkInTime: parsed.checkInTime || notificationData?.checkInTime || null,
      checkOutTime: parsed.checkOutTime || notificationData?.checkOutTime || null,
      checkInLatitude:
        parsed.checkInLatitude ?? notificationData?.checkInLatitude ?? null,
      checkInLongitude:
        parsed.checkInLongitude ?? notificationData?.checkInLongitude ?? null,
      checkOutLatitude:
        parsed.checkOutLatitude ?? notificationData?.checkOutLatitude ?? null,
      checkOutLongitude:
        parsed.checkOutLongitude ?? notificationData?.checkOutLongitude ?? null,
      checkInReason:
        parsed.checkInReason || notificationData?.checkInReason || null,
      checkOutReason:
        parsed.checkOutReason || notificationData?.checkOutReason || null,
      checkInDistance:
        parsed.checkInDistance || notificationData?.checkInDistance || null,
      checkOutDistance:
        parsed.checkOutDistance || notificationData?.checkOutDistance || null,
      originalCheckInTime:
        parsed.originalCheckInTime ||
        notificationData?.originalCheckInTime ||
        null,
      originalCheckOutTime:
        parsed.originalCheckOutTime ||
        notificationData?.originalCheckOutTime ||
        null,
      ...mergedData,
      checkInReason:
        mergedData?.checkInReason ||
        parsed.checkInReason ||
        notificationData?.checkInReason ||
        null,
      checkOutReason:
        mergedData?.checkOutReason ||
        parsed.checkOutReason ||
        notificationData?.checkOutReason ||
        null,
      checkInLocation:
        parsed.checkInLocation ||
        checkInLocation ||
        mergedData?.checkInLocation ||
        notificationData?.checkInLocation ||
        null,
      checkOutLocation:
        parsed.checkOutLocation ||
        checkOutLocation ||
        mergedData?.checkOutLocation ||
        notificationData?.checkOutLocation ||
        null,
      checkInLocationSource:
        parsed.checkInLocationSource ||
        mergedData?.checkInLocationSource ||
        notificationData?.checkInLocationSource ||
        null,
      checkOutLocationSource:
        parsed.checkOutLocationSource ||
        mergedData?.checkOutLocationSource ||
        notificationData?.checkOutLocationSource ||
        null,
    };
  } catch (error) {
    // Attempt to extract the first JSON object block if trailing notes/text exist
    try {
      const jsonMatch = jsonText.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          ...parsed,
          checkInTime: parsed.checkInTime || notificationData?.checkInTime || null,
          checkOutTime: parsed.checkOutTime || notificationData?.checkOutTime || null,
          originalCheckInTime:
            parsed.originalCheckInTime ||
            notificationData?.originalCheckInTime ||
            null,
          originalCheckOutTime:
            parsed.originalCheckOutTime ||
            notificationData?.originalCheckOutTime ||
            null,
          ...mergedData,
          checkInLocation:
            parsed.checkInLocation ||
            checkInLocation ||
            mergedData?.checkInLocation ||
            notificationData?.checkInLocation ||
            null,
          checkOutLocation:
            parsed.checkOutLocation ||
            checkOutLocation ||
            mergedData?.checkOutLocation ||
            notificationData?.checkOutLocation ||
            null,
        };
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
        originalCheckInTime: readString("originalCheckInTime"),
        originalCheckOutTime: readString("originalCheckOutTime"),
        checkInLocation: readString("checkInLocation") || checkInLocation,
        checkOutLocation: readString("checkOutLocation") || checkOutLocation,
        ...mergedData,
        checkInLocation:
          readString("checkInLocation") ||
          checkInLocation ||
          mergedData?.checkInLocation ||
          notificationData?.checkInLocation ||
          null,
        checkOutLocation:
          readString("checkOutLocation") ||
          checkOutLocation ||
          mergedData?.checkOutLocation ||
          notificationData?.checkOutLocation ||
          null,
      };
    }

    return mergedData || notificationData;
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
  let metadataCheckOutReason = "";
  if (markerIndex !== -1) {
    try {
      const metadata = JSON.parse(
        text.slice(markerIndex + "[ATTENDANCE_CORRECTION]".length).trim(),
      );
      metadataCheckOutReason =
        typeof metadata.checkOutReason === "string"
          ? metadata.checkOutReason.trim()
          : "";
    } catch {
      metadataCheckOutReason =
        text
          .slice(markerIndex)
          .match(/"checkOutReason"\s*:\s*"([^"]*)"/)?.[1]
          ?.trim() || "";
    }
  }
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
  if (!checkOutReason) {
    const checkoutReasonMatch = cleanText.match(
      /checkout\b[\s\S]*?\bReason:\s*(.*?)(?=\s*(?:Pending admin approval|Admin approved|Admin rejected|Approved by admin|Rejected by admin)\b|\s*\||$)/i,
    );
    checkOutReason = checkoutReasonMatch?.[1]?.trim().replace(/\.$/, "") || "";
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
    checkOutReason:
      metadataCheckOutReason ||
      checkOutReason ||
      (isCheckOutUnassigned ? directReason || fullClean : ""),
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
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [yearFilter, setYearFilter] = useState(String(currentYear));
  const [monthFilter, setMonthFilter] = useState(String(currentMonth));

  const loadRequests = async () => {
    setLoadError("");

    try {

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
          ? (requestResult.value.requests || []).map((request) => {
              const forgotPunch = getForgotPunchData(request);
              const checkInLat = forgotPunch?.checkInLocationSource === "forgot-punch"
                ? null
                : request.checkInLatitude ?? request.notification?.checkInLatitude ?? forgotPunch?.checkInLatitude ?? null;
              const checkInLng = forgotPunch?.checkInLocationSource === "forgot-punch"
                ? null
                : request.checkInLongitude ?? request.notification?.checkInLongitude ?? forgotPunch?.checkInLongitude ?? null;
              const checkOutLat = forgotPunch?.checkOutLocationSource === "forgot-punch"
                ? null
                : request.checkOutLatitude ?? request.notification?.checkOutLatitude ?? forgotPunch?.checkOutLatitude ?? null;
              const checkOutLng = forgotPunch?.checkOutLocationSource === "forgot-punch"
                ? null
                : request.checkOutLongitude ?? request.notification?.checkOutLongitude ?? forgotPunch?.checkOutLongitude ?? null;

              return {
                ...request,
                subject:
                  isLocationApprovalRequest(request) &&
                  String(forgotPunch?.punchType || "").toLowerCase() ===
                    "both"
                    ? getCombinedLocationRequestTitle(
                        forgotPunch,
                        forgotPunch.date || "",
                      )
                    : request.subject,
                status: normalizeStatus(request.status, request.description || request.note, request.reviewNote),
                forgotPunch,
                checkInLatitude: checkInLat,
                checkInLongitude: checkInLng,
                checkOutLatitude: checkOutLat,
                checkOutLongitude: checkOutLng,
                reviewedAt: request.reviewedAt || null,
                employee: request.employee || currentEmployeeInfo,
              };
            })
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
      // DEDUPLICATE REQUESTS
      // ------------------------------------------------------------
      // Avoid showing the same request multiple times when both EmployeeRequest
      // and Attendance record exist for the same punch/correction.
      const knownAttendanceIds = new Set();
      const knownDateKeys = new Set();

      employeeRequests.forEach((req) => {
        if (req.forgotPunch?.attendanceId) {
          knownAttendanceIds.add(String(req.forgotPunch.attendanceId));
        }
        if (req.type === "CORRECTION" && req.forgotPunch?.date) {
          knownDateKeys.add(`${req.forgotPunch.date}-${req.forgotPunch.punchType || ""}`);
        }
      });

      const filteredAttendanceRequests = attendanceRequests.filter((attReq) => {
        const rawAttId = attReq.id.replace(/^attendance-/, "");
        if (knownAttendanceIds.has(rawAttId)) {
          return false;
        }
        // If an employeeRequest of type CORRECTION exists for this date, prefer the EmployeeRequest ticket
        const attDateKey = attReq.createdAt ? new Date(attReq.createdAt).toISOString().slice(0, 10) : "";
        if (attDateKey && (knownDateKeys.has(`${attDateKey}-check-in`) || knownDateKeys.has(`${attDateKey}-check-out`) || knownDateKeys.has(`${attDateKey}-both`) || knownDateKeys.has(`${attDateKey}-time-edit`))) {
          return false;
        }
        return true;
      });

      // Also consolidate multiple EmployeeRequests for the same employee + date/attendance into 1 request
      const seenEmployeeDateRequests = new Map();
      const consolidatedEmployeeRequests = [];

      employeeRequests.forEach((req) => {
        if (req.type === "CORRECTION") {
          const dateStr = req.forgotPunch?.date || (req.createdAt ? new Date(req.createdAt).toISOString().slice(0, 10) : "");
          const isTimeEditRequest =
            req.forgotPunch?.punchType === "time-edit" ||
            req.subject?.toLowerCase().includes("time edit");
          const key = isTimeEditRequest
            ? `time_edit_${req.id}`
            : `correction_${dateStr}`;

          if (seenEmployeeDateRequests.has(key)) {
            const existing = seenEmployeeDateRequests.get(key);
            const existingPunchType = String(
              existing.forgotPunch?.punchType || "",
            ).toLowerCase();
            const addedPunchType = String(
              req.forgotPunch?.punchType || "",
            ).toLowerCase();
            const hasCheckIn =
              existingPunchType === "check-in" ||
              existingPunchType === "both" ||
              addedPunchType === "check-in" ||
              addedPunchType === "both";
            const hasCheckOut =
              existingPunchType === "check-out" ||
              existingPunchType === "both" ||
              addedPunchType === "check-out" ||
              addedPunchType === "both";
            if (existing.forgotPunch) {
              existing.forgotPunch.punchType =
                hasCheckIn && hasCheckOut
                  ? "both"
                  : hasCheckOut
                    ? "check-out"
                    : "check-in";
              existing.forgotPunch.checkInTime = existing.forgotPunch.checkInTime || req.forgotPunch?.checkInTime;
              existing.forgotPunch.checkOutTime = req.forgotPunch?.checkOutTime || existing.forgotPunch.checkOutTime;
              existing.forgotPunch.checkInReason =
                (addedPunchType === "check-in"
                  ? req.forgotPunch?.checkInReason || req.forgotPunch?.reason
                  : req.forgotPunch?.checkInReason || null) ||
                existing.forgotPunch.checkInReason ||
                (existingPunchType === "check-in"
                  ? existing.forgotPunch.reason
                  : null);
              existing.forgotPunch.checkOutReason =
                (addedPunchType === "check-out"
                  ? req.forgotPunch?.checkOutReason || req.forgotPunch?.reason
                  : req.forgotPunch?.checkOutReason || null) ||
                existing.forgotPunch.checkOutReason ||
                (existingPunchType === "check-out"
                  ? existing.forgotPunch.reason
                  : null);
              existing.forgotPunch.reason =
                addedPunchType === "check-out"
                  ? req.forgotPunch?.reason || existing.forgotPunch.reason
                  : existing.forgotPunch.reason || req.forgotPunch?.reason;
              if (addedPunchType === "check-in") {
                existing.forgotPunch.checkInLocation =
                  req.forgotPunch?.checkInLocation ||
                  existing.forgotPunch.checkInLocation ||
                  null;
                existing.forgotPunch.checkInLocationSource =
                  req.forgotPunch?.checkInLocationSource ||
                  existing.forgotPunch.checkInLocationSource ||
                  null;
                existing.forgotPunch.checkInLatitude =
                  req.forgotPunch?.checkInLocationSource === "forgot-punch"
                    ? null
                    : req.checkInLatitude ?? existing.checkInLatitude;
                existing.forgotPunch.checkInLongitude =
                  req.forgotPunch?.checkInLocationSource === "forgot-punch"
                    ? null
                    : req.checkInLongitude ?? existing.checkInLongitude;
              }
              if (addedPunchType === "check-out") {
                existing.forgotPunch.checkOutLocation =
                  req.forgotPunch?.checkOutLocation ||
                  existing.forgotPunch.checkOutLocation ||
                  null;
                existing.forgotPunch.checkOutLocationSource =
                  req.forgotPunch?.checkOutLocationSource ||
                  existing.forgotPunch.checkOutLocationSource ||
                  null;
                existing.forgotPunch.checkOutLatitude =
                  req.forgotPunch?.checkOutLocationSource === "forgot-punch"
                    ? null
                    : req.checkOutLatitude ?? existing.checkOutLatitude;
                existing.forgotPunch.checkOutLongitude =
                  req.forgotPunch?.checkOutLocationSource === "forgot-punch"
                    ? null
                    : req.checkOutLongitude ?? existing.checkOutLongitude;
              }
              existing.forgotPunch.checkInLocation =
                existing.forgotPunch.checkInLocation ||
                req.forgotPunch?.checkInLocation ||
                null;
              existing.forgotPunch.checkOutLocation =
                existing.forgotPunch.checkOutLocation ||
                req.forgotPunch?.checkOutLocation ||
                null;
              existing.forgotPunch.checkInLocationSource =
                existing.forgotPunch.checkInLocationSource ||
                req.forgotPunch?.checkInLocationSource ||
                null;
              existing.forgotPunch.checkOutLocationSource =
                existing.forgotPunch.checkOutLocationSource ||
                req.forgotPunch?.checkOutLocationSource ||
                null;
            }
            if (
              req.forgotPunch?.checkInLocationSource === "forgot-punch" &&
              addedPunchType === "check-in"
            ) {
              existing.checkInLatitude = null;
              existing.checkInLongitude = null;
            } else {
              existing.checkInLatitude =
                existing.checkInLatitude ?? req.checkInLatitude;
              existing.checkInLongitude =
                existing.checkInLongitude ?? req.checkInLongitude;
            }
            if (
              req.forgotPunch?.checkOutLocationSource === "forgot-punch" &&
              addedPunchType === "check-out"
            ) {
              existing.checkOutLatitude = null;
              existing.checkOutLongitude = null;
            } else {
              existing.checkOutLatitude =
                req.checkOutLatitude ?? existing.checkOutLatitude;
              existing.checkOutLongitude =
                req.checkOutLongitude ?? existing.checkOutLongitude;
            }
            const existingIsLocationRequest =
              isLocationApprovalRequest(existing);
            const addedIsLocationRequest = isLocationApprovalRequest(req);
            if (existingIsLocationRequest || addedIsLocationRequest) {
              const isUnassignedCheckInAndForgotPunchCheckOut =
                hasCheckIn &&
                hasCheckOut &&
                ((existingIsLocationRequest &&
                  addedPunchType === "check-out") ||
                  (addedIsLocationRequest &&
                    existingPunchType === "check-out") ||
                  String(existing.subject || "")
                    .toLowerCase()
                    .includes("check in (ul) and check out (forgot punch)"));
              if (isUnassignedCheckInAndForgotPunchCheckOut) {
                existing.subject =
                  `Check In (UL) and Check Out (Forgot Punch) (${dateStr})`;
              }
            }
            if (existing.status === "PENDING" || req.status === "PENDING") {
              existing.status = "PENDING";
            } else if (
              existing.status === "REJECTED" ||
              req.status === "REJECTED"
            ) {
              existing.status = "REJECTED";
            }
            existing.reviewNote =
              existing.reviewNote || req.reviewNote || null;
            existing.reviewedAt =
              existing.reviewedAt || req.reviewedAt || null;
            existing.reviewedBy =
              existing.reviewedBy || req.reviewedBy || null;
            if (req.description && !existing.description.includes(req.description)) {
              existing.description = `${existing.description} | ${req.description}`;
            }
            return;
          } else {
            seenEmployeeDateRequests.set(key, req);
            consolidatedEmployeeRequests.push(req);
            return;
          }
        }
        consolidatedEmployeeRequests.push(req);
      });

      // ------------------------------------------------------------
      // COMBINE EMPLOYEE REQUESTS
      // ------------------------------------------------------------

      setRequests(
        [...consolidatedEmployeeRequests, ...leaveRequests, ...filteredAttendanceRequests].sort(
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
          if (isAdmin && result.reason?.status === 404) return false;
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
  }, [navigate]);

  // Silent background refresh every pollTick (every 5s)
  useEffect(() => {
    if (pollTick === 0) return;
    if (!markingId && !returningId) {
      loadRequests();
    }
  }, [pollTick]);

  // Fetch saved attendance punch times and coordinates for request details.
  useEffect(() => {
    if (!reasonModal || reasonModal.type !== "CORRECTION") return;
    const forgotPunch = getForgotPunchData(reasonModal);
    if (!forgotPunch?.date) return;
    const isTimeEdit = forgotPunch.punchType === "time-edit";
    const punchType = String(forgotPunch.punchType || "").toLowerCase();
    const isCombinedPunch =
      punchType === "both" ||
      (punchType.includes("check") &&
        punchType.includes("in") &&
        punchType.includes("out")) ||
      String(reasonModal.subject || "")
        .toLowerCase()
        .includes("check in + check out");
    if (
      !isTimeEdit ||
      (reasonModal.status === "PENDING" &&
        (!forgotPunch.originalCheckInTime || !forgotPunch.originalCheckOutTime))
    ) {
      apiGet(`/attendance/by-date?date=${forgotPunch.date}`)
        .then((res) => {
          if (res?.record) {
            setReasonModal((prev) => {
              if (!prev || prev.id !== reasonModal.id) return prev;
              const prevForgotPunch = getForgotPunchData(prev) || {};
              const attendanceReason = getAttendanceReason(
                res.record.note || "",
                "",
              );
              const updatedForgotPunch = {
                ...prevForgotPunch,
                actualCheckInTime: res.record.checkInTime || null,
                actualCheckOutTime: res.record.checkOutTime || null,
                actualCheckInLatitude:
                  res.record.checkInLatitude ?? null,
                actualCheckInLongitude:
                  res.record.checkInLongitude ?? null,
                actualCheckOutLatitude:
                  res.record.checkOutLatitude ?? null,
                actualCheckOutLongitude:
                  res.record.checkOutLongitude ?? null,
                actualAttendanceNote: res.record.note || null,
                checkInReason: prevForgotPunch.checkInReason || (() => {
                  const n = String(res.record.note || "");
                  const m = n.match(/(?:Check-In Reason|Checkin Reason|Reason)\s*:\s*([^\r\n|]+)/i)?.[1]?.trim();
                  return m && !/^(?:unassigned location|outside assigned location|pending admin)/i.test(m) ? m : null;
                })() || null,
                originalCheckInTime:
                  prevForgotPunch.originalCheckInTime ||
                  (prev.status === "PENDING"
                    ? res.record.checkInTime
                    : null) ||
                  null,
                originalCheckOutTime:
                  prevForgotPunch.originalCheckOutTime ||
                  (prev.status === "PENDING"
                    ? res.record.checkOutTime
                    : null) ||
                  null,
                checkInLatitude:
                  prevForgotPunch.checkInLatitude ??
                  null,
                checkInLongitude:
                  prevForgotPunch.checkInLongitude ??
                  null,
                checkOutLatitude:
                  prevForgotPunch.checkOutLatitude ??
                  null,
                checkOutLongitude:
                  prevForgotPunch.checkOutLongitude ??
                  null,
                checkOutReason:
                  attendanceReason.checkOutReason ||
                  prevForgotPunch.checkOutReason ||
                  null,
              };
              return {
                ...prev,
                note: prev.note || res.record.note || "",
                notification: {
                  ...(prev.notification || {}),
                  actualCheckInTime: updatedForgotPunch.actualCheckInTime,
                  actualCheckOutTime: updatedForgotPunch.actualCheckOutTime,
                  checkOutReason: updatedForgotPunch.checkOutReason,
                  originalCheckInTime:
                    updatedForgotPunch.originalCheckInTime,
                  originalCheckOutTime:
                    updatedForgotPunch.originalCheckOutTime,
                  checkInLatitude: updatedForgotPunch.checkInLatitude,
                  checkInLongitude: updatedForgotPunch.checkInLongitude,
                  checkOutLatitude: updatedForgotPunch.checkOutLatitude,
                  checkOutLongitude: updatedForgotPunch.checkOutLongitude,
                },
                forgotPunch: updatedForgotPunch,
                actualCheckInTime: updatedForgotPunch.actualCheckInTime,
                actualCheckOutTime: updatedForgotPunch.actualCheckOutTime,
                actualCheckInLatitude:
                  updatedForgotPunch.actualCheckInLatitude,
                actualCheckInLongitude:
                  updatedForgotPunch.actualCheckInLongitude,
                actualCheckOutLatitude:
                  updatedForgotPunch.actualCheckOutLatitude,
                actualCheckOutLongitude:
                  updatedForgotPunch.actualCheckOutLongitude,
              };
            });
          }
        })
        .catch(() => {});
    }
  }, [reasonModal?.id, pollTick]);

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
              View your submitted requests and their current status.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
            <option value="EQUIPMENT">Tools & Inventory</option>
            <option value="GENERAL">General Requests</option>
            <option value="OTHER">Other</option>
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
                  {(() => {
                    const isLocationReq = isLocationApprovalRequest(request);
                    const isEquipmentReq = request.type === "EQUIPMENT";
                    const isLeaveReq = request.type === "LEAVE";
                    const isForgotReq = !isLocationReq && !isEquipmentReq && !isLeaveReq;

                    let badgeColor = "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
                    let badgeIcon = <Clock3 className="h-3.5 w-3.5" />;
                    let badgeLabel = "FORGOT PUNCH";

                    if (isEquipmentReq) {
                      badgeColor = "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
                      badgeIcon = <Package className="h-3.5 w-3.5" />;
                      badgeLabel = "INVENTORY / TOOL";
                    } else if (isLocationReq) {
                      badgeColor = "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400";
                      badgeIcon = <MapPin className="h-3.5 w-3.5" />;
                      badgeLabel = "LOCATION APPROVAL (UL)";
                    } else if (isLeaveReq) {
                      badgeColor = "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400";
                      badgeIcon = <Briefcase className="h-3.5 w-3.5" />;
                      badgeLabel = "LEAVE";
                    } else if (request.subject?.toLowerCase().includes("time edit") || request.description?.includes('"punchType":"time-edit"')) {
                      badgeColor = "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
                      badgeIcon = <Clock3 className="h-3.5 w-3.5" />;
                      badgeLabel = "TIME EDIT";
                    } else if (request.type === "CORRECTION") {
                      // Determine scenario-specific label from punchType
                      const fp3 = getForgotPunchData(request);
                      const pt3 = String(fp3?.punchType || "").toLowerCase();
                      const subj3 = String(request.subject || "").toLowerCase();
                      if (subj3.includes("check in (forgot punch)") && subj3.includes("check out (ul)")) {
                        badgeLabel = "FORGOT CHECK IN + UL CHECKOUT";
                      } else if (subj3.includes("check in (ul)") && subj3.includes("check out (forgot punch)")) {
                        badgeLabel = "UL CHECK IN + FORGOT CHECKOUT";
                      } else if (pt3 === "both") {
                        badgeLabel = "FORGOT PUNCH (IN + OUT)";
                      } else if (pt3 === "check-out") {
                        badgeLabel = "FORGOT CHECK OUT";
                      } else if (pt3 === "check-in") {
                        badgeLabel = "FORGOT CHECK IN";
                      }
                    }

                    return (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase ${badgeColor}`}
                      >
                        {badgeIcon}
                        <span>{badgeLabel}</span>
                      </span>
                    );
                  })()}
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

                {/* Show punch check-in / checkout times on card for CORRECTION requests */}
                {request.type === "CORRECTION" && (() => {
                  const fp = getForgotPunchData(request);
                  if (!fp) return null;
                  const punchType = String(fp.punchType || "").toLowerCase();
                  const isTimeEdit = punchType === "time-edit" || punchType === "time edit";
                  const checkInSrc = fp.checkInLocationSource || (fp.checkInLatitude != null ? "unassigned-location" : "forgot-punch");
                  const checkOutSrc = fp.checkOutLocationSource || (fp.checkOutLatitude != null ? "unassigned-location" : "forgot-punch");

                  // Determine which times to show
                  const showCheckIn = punchType === "check-in" || punchType === "both" || isTimeEdit;
                  const showCheckOut = punchType === "check-out" || punchType === "both" || isTimeEdit;

                  // For combo: check-in by forgot punch + checkout by mark attendance, show the actual checkout time too
                  const hasActualOut = Boolean(fp.actualCheckOutTime || fp.checkOutTime);
                  const hasActualIn = Boolean(fp.actualCheckInTime || fp.checkInTime);

                  const checkInTime = checkInSrc === "forgot-punch"
                    ? fp.checkInTime
                    : fp.actualCheckInTime || fp.checkInTime;
                  const checkOutTime = checkOutSrc === "forgot-punch"
                    ? fp.checkOutTime
                    : fp.actualCheckOutTime || fp.checkOutTime;

                  if (!checkInTime && !checkOutTime) return null;

                  return (
                    <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
                      {fp.date && (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>Punch Date: {fp.date.split("-").reverse().join("/")}</span>
                        </span>
                      )}
                      {(showCheckIn || hasActualIn) && checkInTime && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                          <Clock3 className="h-3 w-3" />
                          <span>In: {formatTime(checkInTime)}</span>
                        </span>
                      )}
                      {(showCheckOut || hasActualOut) && checkOutTime && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
                          <Clock3 className="h-3 w-3" />
                          <span>Out: {formatTime(checkOutTime)}</span>
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* Approved / Reviewed Time */}
                {(request.reviewedAt || (request.updatedAt && request.status !== "PENDING")) && (
                  <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                    {isApprovedOrCompletedStatus(request.status, request.reviewNote) ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Approved: {formatDate(request.reviewedAt || request.updatedAt)} {formatTime(request.reviewedAt || request.updatedAt)}</span>
                      </span>
                    ) : request.status === "REJECTED" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
                        <X className="h-3.5 w-3.5 text-rose-600" />
                        <span>Rejected: {formatDate(request.reviewedAt || request.updatedAt)} {formatTime(request.reviewedAt || request.updatedAt)}</span>
                      </span>
                    ) : null}
                  </div>
                )}
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
      {reasonModal && (() => {
        const reqInfo = getRequestTypeInfo(reasonModal);
        const isLoc = reqInfo.iconType === "location";
        const isEq = reqInfo.iconType === "equipment";
        const isLv = reqInfo.iconType === "leave";
        const isFP = reqInfo.iconType === "forgot-punch";
        const isTE = reqInfo.iconType === "time-edit";

        const iconBoxClass = isEq
          ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
          : isLoc
            ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
            : isTE || isFP
              ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
              : isLv
                ? "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400"
                : "bg-primary/10 text-primary";

        const IconComp = isEq
          ? Package
          : isLoc
            ? MapPin
            : isTE || isFP
              ? Clock3
              : isLv
                ? Briefcase
                : MessageSquareText;

        const headerCategory = reqInfo.category;
        const headerSubject = reqInfo.displayTitle;

        const employeeName =
          reasonModal.employee?.user?.fullName ||
          reasonModal.employee?.fullName ||
          currentUser?.fullName ||
          "Employee";
        const employeeCode =
          reasonModal.employee?.employeeCode ||
          currentUser?.employeeProfile?.employeeCode ||
          "";

        const isApproved = isApprovedOrCompletedStatus(
          reasonModal.status,
          reasonModal.reviewNote,
        );
        const reviewerName =
          reasonModal.reviewedBy?.fullName ||
          reasonModal.reviewerName ||
          [reasonModal.reviewNote, reasonModal.note, reasonModal.description]
            .map((text) =>
              String(text || "")
                .match(/approved by\s+([^.:]+)/i)?.[1]
                ?.trim(),
            )
            .find((name) => name && name.toLowerCase() !== "admin");

        const reviewedAt =
          reasonModal.reviewedAt ||
          (reasonModal.status !== "PENDING" ? (reasonModal.updatedAt || null) : null);

        const requestStatus = String(reasonModal.status || "PENDING").toUpperCase();
        const statusClass =
          requestStatus === "PENDING"
            ? "bg-amber-100 text-amber-700"
            : requestStatus === "APPROVED" || requestStatus === "COMPLETED" || requestStatus === "PRESENT"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-rose-100 text-rose-700";

        const isAttendanceCorrection =
          reasonModal.type === "CORRECTION" ||
          reasonModal.type === "ATTENDANCE" ||
          isLocationApprovalRequest(reasonModal);

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={() => setReasonModal(null)}
          >
            <div
              className="flex w-full max-w-2xl max-h-[88vh] flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-border bg-background px-4 py-4 sm:px-6 sm:py-5">
                <div className="flex min-w-0 items-center gap-4">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm ${iconBoxClass}`}>
                    <IconComp className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {headerCategory}
                    </p>
                    {isEq ? (
                      <FormattedInventoryTitle
                        title={headerSubject}
                        className="mt-1"
                      />
                    ) : (
                      <h2 className="mt-1 truncate font-display text-lg font-bold text-foreground">
                        {headerSubject}
                      </h2>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReasonModal(null)}
                  className="ml-4 rounded-xl p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground shrink-0"
                  aria-label="Close message details"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
                {/* Employee Section */}
                <section>
                  <div className="mb-2 flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-primary" />
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Employee
                    </p>
                  </div>
                  <div className="flex items-center gap-4 rounded-2xl border border-border bg-gradient-to-r from-primary/[0.04] to-transparent p-4 shadow-sm">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <UserRound className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-bold text-foreground">{employeeName}</p>
                      {employeeCode && (
                        <p className="mt-1 text-sm text-muted-foreground">Employee ID: {employeeCode}</p>
                      )}
                    </div>
                  </div>
                </section>

                {/* Main Body depending on request type */}
                {isAttendanceCorrection ? (() => {
                  const forgotPunch = getForgotPunchData(reasonModal) || reasonModal.correctionDetails || {};
                  const punchType = String(forgotPunch.punchType || reasonModal.punchType || "").toLowerCase();
                  const isCombinedPunch =
                    punchType === "both" ||
                    (punchType.includes("check in") && punchType.includes("check out")) ||
                    (punchType.includes("check") && punchType.includes("in") && punchType.includes("out")) ||
                    String(reasonModal.subject || "").toLowerCase().includes("check in + check out");

                  const dateMatch = String(forgotPunch.date || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
                  const dateLabel = dateMatch
                    ? `${dateMatch[3]}/${dateMatch[2]}/${dateMatch[1]}`
                    : (forgotPunch.date || formatDate(reasonModal.createdAt));

                  const isTimeEditRequest =
                    forgotPunch.isTimeEdit ||
                    punchType === "time-edit" ||
                    punchType === "time edit" ||
                    String(reasonModal.subject || "").toLowerCase().includes("time edit");

                  const _isCheckOutOnly = punchType === "check-out" || (punchType.includes("check out") && !punchType.includes("check in"));
                  const _isCheckInOnly = punchType === "check-in" || (punchType.includes("check in") && !punchType.includes("check out"));

                  const actualCheckInTime =
                    reasonModal.actualCheckInTime ||
                    forgotPunch.actualCheckInTime ||
                    (reasonModal.type === "ATTENDANCE" ? reasonModal.checkInTime : null) ||
                    null;
                  const actualCheckOutTime =
                    reasonModal.actualCheckOutTime ||
                    forgotPunch.actualCheckOutTime ||
                    (reasonModal.type === "ATTENDANCE" ? reasonModal.checkOutTime : null) ||
                    null;

                  const checkInLocSrc = _isCheckOutOnly && (actualCheckInTime || forgotPunch.checkInTime)
                    ? "default-location"
                    : getPunchLocationSource(reasonModal, forgotPunch, "checkIn");
                  const checkOutLocSrc = getPunchLocationSource(reasonModal, forgotPunch, "checkOut");

                  const descText = String(reasonModal.description || "");
                  const parsedCheckInFromDesc = descText.match(/at check-in\s+([0-9]{1,2}:[0-9]{2}(?:\s*[AaPp][Mm])?)/i)?.[1]?.trim() || null;
                  const parsedCheckOutFromDesc = descText.match(/(?:and|at)\s+check-out\s+([0-9]{1,2}:[0-9]{2}(?:\s*[AaPp][Mm])?)/i)?.[1]?.trim() || null;

                  const checkInTime = isTimeEditRequest
                    ? (forgotPunch.checkInTime || parsedCheckInFromDesc || actualCheckInTime)
                    : (checkInLocSrc === "forgot-punch" ? (forgotPunch.checkInTime || actualCheckInTime) : (actualCheckInTime || forgotPunch.checkInTime));
                  const checkOutTime = isTimeEditRequest
                    ? (forgotPunch.checkOutTime || parsedCheckOutFromDesc || actualCheckOutTime)
                    : (checkOutLocSrc === "forgot-punch" ? (forgotPunch.checkOutTime || actualCheckOutTime) : (actualCheckOutTime || forgotPunch.checkOutTime));

                  const origCheckInTime = forgotPunch.originalCheckInTime || (isTimeEditRequest && actualCheckInTime && formatTime(actualCheckInTime) !== formatTime(checkInTime) ? actualCheckInTime : null);
                  const origCheckOutTime = forgotPunch.originalCheckOutTime || (isTimeEditRequest && actualCheckOutTime && formatTime(actualCheckOutTime) !== formatTime(checkOutTime) ? actualCheckOutTime : null);

                  const teType = forgotPunch.timeEditPunchType || forgotPunch.timeEditType ||
                    (forgotPunch.checkInTime && !forgotPunch.checkOutTime ? "check-in" :
                     forgotPunch.checkOutTime && !forgotPunch.checkInTime ? "check-out" :
                     (descText.includes("at check-in") && !descText.includes("at check-out") && !descText.includes("and check-out") ? "check-in" :
                      descText.includes("at check-out") && !descText.includes("at check-in") ? "check-out" : null));

                  const hasCheckInEdit = isTimeEditRequest
                    ? (teType === "check-in" || teType === "both" || (teType !== "check-out" && Boolean(checkInTime)))
                    : Boolean(checkInTime);
                  const hasCheckOutEdit = isTimeEditRequest
                    ? (teType === "check-out" || teType === "both" || (teType !== "check-in" && Boolean(origCheckOutTime)))
                    : Boolean(checkOutTime);

                  const showCheckInTime = isTimeEditRequest ? hasCheckInEdit : Boolean(checkInTime);
                  const showCheckOutTime = isTimeEditRequest ? hasCheckOutEdit : Boolean(checkOutTime);

                  const readLoc = (label) => {
                    const desc = String(reasonModal.description || "");
                    const readable = desc.split("[ATTENDANCE_CORRECTION]")[0];
                    const fromText = readable.match(new RegExp("(?:^|\\n)\\s*Check-" + label + " Location:\\s*([^\\r\\n]+)", "i"))?.[1]?.trim();
                    if (fromText) return fromText;
                    const meta = desc.split("[ATTENDANCE_CORRECTION]").at(-1)?.trim();
                    if (meta) { try { return String(JSON.parse(meta)[label === "In" ? "checkInLocation" : "checkOutLocation"] || "").trim(); } catch { return ""; } }
                    return "";
                  };

                  const checkInLocation = String(readLoc("In") || forgotPunch.checkInLocation || "").trim();
                  const checkOutLocation = String(readLoc("Out") || forgotPunch.checkOutLocation || "").trim();

                  const checkInLat = checkInLocSrc === "forgot-punch"
                    ? null
                    : (reasonModal.actualCheckInLatitude ?? forgotPunch.checkInLatitude ?? reasonModal.checkInLatitude);
                  const checkInLng = checkInLocSrc === "forgot-punch"
                    ? null
                    : (reasonModal.actualCheckInLongitude ?? forgotPunch.checkInLongitude ?? reasonModal.checkInLongitude);
                  const checkOutLat = checkOutLocSrc === "forgot-punch"
                    ? null
                    : (reasonModal.actualCheckOutLatitude ?? forgotPunch.checkOutLatitude ?? reasonModal.checkOutLatitude);
                  const checkOutLng = checkOutLocSrc === "forgot-punch"
                    ? null
                    : (reasonModal.actualCheckOutLongitude ?? forgotPunch.checkOutLongitude ?? reasonModal.checkOutLongitude);

                  const checkInUsesMap = checkInLat != null && Number.isFinite(Number(checkInLat)) && (checkInLocSrc === "unassigned-location" || reasonModal.type === "ATTENDANCE");
                  const checkOutUsesMap = checkOutLat != null && Number.isFinite(Number(checkOutLat)) && (checkOutLocSrc === "unassigned-location" || reasonModal.type === "ATTENDANCE");

                  const isForgotPunchCheckOut = _isCheckOutOnly && checkOutLocSrc === "forgot-punch";
                  const effCheckInSrc = checkInLocSrc || (!isForgotPunchCheckOut && _isCheckOutOnly && actualCheckInTime && !checkInUsesMap ? "default-location" : null);

                  const isForgotPunchCheckIn = _isCheckInOnly && checkInLocSrc === "forgot-punch";
                  const effCheckOutSrc = checkOutLocSrc || (!isForgotPunchCheckIn && _isCheckInOnly && actualCheckOutTime && !checkOutUsesMap ? "default-location" : null);

                  const isCheckOutDefaultLoc = effCheckOutSrc === "default-location" || forgotPunch.checkOutLocationSource === "default-location" || String(reasonModal.description || "").includes("default location");
                  const punchTypeLabel =
                    isTimeEditRequest
                      ? (teType === "check-in" ? "Check In" : teType === "check-out" ? "Check Out" : "Check In + Check Out")
                      : (isCheckOutDefaultLoc && reqInfo.typeLabel === "UL Check In")
                        ? "Check In (UL)"
                        : punchType === "both"
                          ? "Check In + Check Out"
                        : (punchType === "check-in" || punchType.includes("check in"))
                          ? "Check In"
                          : (punchType === "check-out" || punchType.includes("check out"))
                            ? "Check Out"
                            : "Check In";

                  const showCheckInLoc = checkInUsesMap || Boolean(checkInLocation) || effCheckInSrc === "default-location";
                  const showCheckOutLoc = checkOutUsesMap || Boolean(checkOutLocation) || effCheckOutSrc === "default-location";

                  const PLACEHOLDERS = [
                    "No check-in reason provided.",
                    "No check-out reason provided.",
                    "No reason provided.",
                    "No reason provided for check-out.",
                  ];
                  const cleanR = (v) => {
                    const s = String(v || "").trim();
                    if (!s || PLACEHOLDERS.includes(s) || /^(?:Time Edit|Forgot Punch) request for/i.test(s)) {
                      return "";
                    }
                    return s;
                  };

                  const descMatchReason = String(reasonModal.description || "").match(/(?:Check-In Reason|Checkin Reason)\s*:\s*([^.\r\n|]+)/i)?.[1]?.trim() || "";
                  const noteMatchReason = String(reasonModal.actualAttendanceNote || reasonModal.note || forgotPunch.actualAttendanceNote || forgotPunch.note || "").match(/(?:Check-In Reason|Reason)\s*:\s*([^.\r\n|]+)/i)?.[1]?.trim() || "";
                  const safeNoteReason = noteMatchReason && !/^(?:unassigned location|outside assigned location|pending admin|time edit request)/i.test(noteMatchReason) ? noteMatchReason : "";

                  const candidateForgotReason = String(forgotPunch.reason || "").trim();
                  const isAutomatedForgotReason = /^(?:unassigned location|outside assigned location|time edit request|no reason)/i.test(candidateForgotReason);
                  const safeForgotReason = !isAutomatedForgotReason ? candidateForgotReason : "";

                  const isPureCombinedForgotPunch = !isTimeEditRequest && (punchType === "both" || (!forgotPunch.checkInReason && !forgotPunch.checkOutReason));
                  const sameSharedForgotReason = isPureCombinedForgotPunch && safeForgotReason ? safeForgotReason : null;

                  const rawCheckInReason =
                    sameSharedForgotReason ||
                    forgotPunch.checkInReason ||
                    descMatchReason ||
                    safeNoteReason ||
                    safeForgotReason ||
                    "";
                  const checkInReason = cleanR(cleanPureReason(rawCheckInReason, ""));
                  const rawCheckOutReason =
                    sameSharedForgotReason ||
                    forgotPunch.checkOutReason ||
                    String(reasonModal.description || "").match(/(?:Check-Out Reason|Checkout Reason)\s*:\s*([^\r\n|]+)/i)?.[1]?.trim() ||
                    (!isTimeEditRequest && _isCheckOutOnly ? forgotPunch.reason : "");
                  const checkOutReason = cleanR(cleanPureReason(rawCheckOutReason, ""));

                  const timeEditReason = cleanR(forgotPunch.timeEditReason || String(reasonModal.description || "").match(/Time Edit Reason\s*:\s*([^\r\n|]+)/i)?.[1]?.trim() || "");
                  const genericReason = isTimeEditRequest ? timeEditReason : cleanR(cleanPureReason(forgotPunch.reason, reasonModal.description));

                  const renderLocCard = (label, location, lat, lng, source, usesMap, tone) => {
                    if (!usesMap && !Boolean(location) && source !== "default-location") return null;
                    const em = tone === "emerald";
                    return (
                      <div className={em ? "rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white p-4 dark:border-emerald-900/40 dark:from-emerald-950/30 dark:to-background" : "rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50/80 to-white p-4 dark:border-rose-900/40 dark:from-rose-950/30 dark:to-background"}>
                        <div className="flex items-center justify-between gap-1">
                          <p className={em ? "text-xs font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-400" : "text-xs font-bold uppercase tracking-wide text-rose-800 dark:text-rose-400"}>{label}</p>
                          {usesMap ? (
                            <span className={`rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${em ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-rose-500/15 text-rose-700 dark:text-rose-300"}`}>GPS</span>
                          ) : source === "default-location" ? (
                            <span className="rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">Default Location</span>
                          ) : (
                            <span className="rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-700 dark:text-rose-300">Manual</span>
                          )}
                        </div>
                        {usesMap ? (
                          <button
                            type="button"
                            onClick={() => window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank", "noopener,noreferrer")}
                            className={em ? "mt-3 inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-800 shadow-sm transition hover:bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "mt-3 inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-800 shadow-sm transition hover:bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"}
                          >
                            <MapPin className="h-3.5 w-3.5" /> View on Google Maps
                          </button>
                        ) : source === "default-location" ? (
                          <p className="mt-3 break-words rounded-lg bg-white/80 px-3 py-2 text-sm font-semibold text-foreground dark:bg-background/70">
                            Office <span className="text-xs font-normal text-muted-foreground">(Default)</span>
                          </p>
                        ) : (
                          <p className="mt-3 break-words rounded-lg bg-white/80 px-3 py-2 text-sm font-semibold text-foreground dark:bg-background/70">{location}</p>
                        )}
                      </div>
                    );
                  };

                  return (
                    <section className="space-y-4">
                      {/* Reason Header with Request Type info */}
                      <div className="mb-2 flex w-full items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MessageSquareText className="h-4 w-4 text-primary" />
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            {reqInfo.typeLabel} Reason
                          </p>
                        </div>
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${statusClass}`}>
                          {requestStatus === "PENDING" ? "Pending" : requestStatus === "APPROVED" || requestStatus === "COMPLETED" || requestStatus === "PRESENT" ? "Approved" : "Rejected"}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {/* 1. Date + Request Type + Punch Type + Times Card */}
                        <div className="grid gap-x-5 gap-y-4 rounded-2xl border border-border bg-background p-4 shadow-sm sm:grid-cols-2">
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground">Date</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">{dateLabel}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground">Request Type</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">{reqInfo.typeLabel}</p>
                          </div>
                          <div className={showCheckInTime && checkInTime && showCheckOutTime && checkOutTime ? "sm:col-span-2" : ""}>
                            <p className="text-xs font-semibold text-muted-foreground">Punch Type</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">{punchTypeLabel}</p>
                          </div>
                          {showCheckInTime && checkInTime && (
                            <div>
                              <p className={isTimeEditRequest ? "text-xs font-bold text-emerald-700 dark:text-emerald-300" : "text-xs font-semibold text-muted-foreground"}>
                                {isTimeEditRequest ? "Requested Check-in Time" : checkInLocSrc === "forgot-punch" ? "Check-in Time (Forgot Punch)" : checkInLocSrc === "unassigned-location" || reasonModal.type === "ATTENDANCE" ? "Check-in Time (UL)" : "Check-in Time"}
                              </p>
                              <p className="mt-1 inline-flex rounded-md bg-emerald-500/10 px-2 py-1 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                                {formatTime(checkInTime)}
                              </p>
                              {isTimeEditRequest && (origCheckInTime || actualCheckInTime) && (
                                <>
                                  <p className="mt-2 text-xs font-semibold text-muted-foreground">Previous Check-in Time</p>
                                  <p className="mt-1 inline-flex rounded-md bg-secondary px-2 py-1 text-sm font-semibold text-foreground">
                                    {formatTime(origCheckInTime || actualCheckInTime)}
                                  </p>
                                </>
                              )}
                            </div>
                          )}
                          {showCheckOutTime && checkOutTime && (
                            <div>
                              <p className={isTimeEditRequest ? "text-xs font-bold text-rose-700 dark:text-rose-300" : "text-xs font-semibold text-muted-foreground"}>
                                {isTimeEditRequest ? "Requested Check-out Time" : checkOutLocSrc === "forgot-punch" ? "Check-out Time (Forgot Punch)" : checkOutLocSrc === "unassigned-location" || reasonModal.type === "ATTENDANCE" ? "Check-out Time (UL)" : effCheckOutSrc === "default-location" ? "Check-out Time (Marked Attendance)" : "Check-out Time"}
                              </p>
                              <p className="mt-1 inline-flex rounded-md bg-rose-500/10 px-2 py-1 text-sm font-bold text-rose-700 dark:text-rose-300">
                                {formatTime(checkOutTime)}
                              </p>
                              {isTimeEditRequest && origCheckOutTime && (
                                <>
                                  <p className="mt-2 text-xs font-semibold text-muted-foreground">Previous Check-out Time</p>
                                  <p className="mt-1 inline-flex rounded-md bg-secondary px-2 py-1 text-sm font-semibold text-foreground">{formatTime(origCheckOutTime)}</p>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {/* 2. Location Cards */}
                        {(showCheckInLoc || showCheckOutLoc) && (
                          <div className={`grid gap-3 ${showCheckInLoc && showCheckOutLoc ? "sm:grid-cols-2" : "grid-cols-1"}`}>
                            {showCheckInLoc && renderLocCard("Check-In Location", checkInLocation, checkInLat, checkInLng, effCheckInSrc, checkInUsesMap, "emerald")}
                            {showCheckOutLoc && renderLocCard("Check-Out Location", checkOutLocation, checkOutLat, checkOutLng, effCheckOutSrc, checkOutUsesMap, "rose")}
                          </div>
                        )}

                        {/* 3. Reason Cards */}
                        {(checkInReason || checkOutReason) && (
                          checkInReason && checkOutReason && checkInReason === checkOutReason ? (
                            <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 dark:border-blue-900/40 dark:bg-blue-950/20">
                              <p className="text-xs font-bold text-blue-800 dark:text-blue-400">Reason</p>
                              <p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium leading-5 text-foreground">{checkInReason}</p>
                            </div>
                          ) : (
                            <div className="grid gap-3 sm:grid-cols-2">
                              {checkInReason && (
                                <div className={`rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20${!checkOutReason ? " sm:col-span-2" : ""}`}>
                                  <p className="text-xs font-bold text-emerald-800 dark:text-emerald-400">Check-In Reason</p>
                                  <p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium leading-5 text-foreground">{checkInReason}</p>
                                </div>
                              )}
                              {checkOutReason && (
                                <div className={`rounded-xl border border-rose-200 bg-rose-50/40 p-3 dark:border-rose-900/40 dark:bg-rose-950/20${!checkInReason ? " sm:col-span-2" : ""}`}>
                                  <p className="text-xs font-bold text-rose-800 dark:text-rose-400">Check-Out Reason</p>
                                  <p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium leading-5 text-foreground">{checkOutReason}</p>
                                </div>
                              )}
                            </div>
                          )
                        )}

                        {timeEditReason && (
                          <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3 dark:border-sky-900/50 dark:bg-sky-950/20">
                            <p className="text-xs font-bold text-sky-800 dark:text-sky-300">Time Edit Reason</p>
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium leading-5 text-foreground">{timeEditReason}</p>
                          </div>
                        )}

                        {!isTimeEditRequest && !checkInReason && !checkOutReason && genericReason && (
                          <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3 dark:border-sky-900/50 dark:bg-sky-950/20">
                            <p className="text-xs font-bold text-sky-800 dark:text-sky-300">Reason</p>
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium leading-5 text-foreground">{genericReason}</p>
                          </div>
                        )}
                      </div>
                    </section>
                  );
                })() : isLv ? (
                  <section className="space-y-4">
                    <div className="mb-2 flex w-full items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-primary" />
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Leave Details
                        </p>
                      </div>
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${statusClass}`}>
                        {requestStatus === "PENDING" ? "Pending" : requestStatus === "APPROVED" || requestStatus === "COMPLETED" || requestStatus === "PRESENT" ? "Approved" : "Rejected"}
                      </span>
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-border bg-background p-4 shadow-sm">
                        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground">Leave Type</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">{reasonModal.subject || "Leave"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground">Status</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">{reasonModal.status}</p>
                          </div>
                        </div>
                        {reasonModal.description && (
                          <div className="mt-4 border-t border-border pt-3">
                            <p className="text-xs font-semibold text-muted-foreground">Details</p>
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium leading-6 text-foreground">
                              {reasonModal.description}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                ) : isEq ? (
                  <section className="space-y-4">
                    <div className="mb-2 flex w-full items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-primary" />
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Equipment Request Details
                        </p>
                      </div>
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${statusClass}`}>
                        {requestStatus === "PENDING" ? "Pending" : requestStatus === "APPROVED" || requestStatus === "COMPLETED" || requestStatus === "PRESENT" ? "Approved" : "Rejected"}
                      </span>
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-border bg-background p-4 shadow-sm space-y-3">
                        <FormattedInventoryTitle title={reasonModal.subject} />
                        {reasonModal.description && (
                          <div className="border-t border-border pt-3">
                            <RenderFormattedDetails text={reasonModal.description} />
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                ) : (
                  <section className="space-y-4">
                    <div className="mb-2 flex w-full items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageSquareText className="h-4 w-4 text-primary" />
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Message Details
                        </p>
                      </div>
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${statusClass}`}>
                        {requestStatus === "PENDING" ? "Pending" : requestStatus === "APPROVED" || requestStatus === "COMPLETED" || requestStatus === "PRESENT" ? "Approved" : "Rejected"}
                      </span>
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-border bg-background p-4 shadow-sm">
                        <p className="whitespace-pre-wrap break-words text-sm font-medium leading-6 text-foreground">
                          {getRequestReason(reasonModal) || reasonModal.description || "No details provided."}
                        </p>
                      </div>
                    </div>
                  </section>
                )}

                {/* Admin Rejection Reason / Admin Note */}
                {reasonModal.status === "REJECTED" && reasonModal.reviewNote && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-4 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
                    <p className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                      <FileText className="h-4 w-4" />
                      Admin Rejection Reason
                    </p>
                    <p className="whitespace-pre-wrap break-words text-sm font-medium">
                      {reasonModal.reviewNote}
                    </p>
                  </div>
                )}
                {reasonModal.status === "APPROVED" && reasonModal.reviewNote && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
                    <p className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                      <FileText className="h-4 w-4" />
                      Admin Response
                    </p>
                    <p className="whitespace-pre-wrap break-words text-sm font-medium">
                      {reasonModal.reviewNote}
                    </p>
                  </div>
                )}

                {/* Submission & Approval Metadata */}
                <div className="space-y-2 rounded-2xl border border-border bg-secondary/20 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span className="font-semibold">Submitted</span>
                    </div>
                    <span className="text-sm font-bold text-foreground">
                      {formatDate(reasonModal.createdAt)} {formatTime(reasonModal.createdAt)}
                    </span>
                  </div>
                  {reviewerName && (
                    <div className="flex items-center justify-between border-t border-border pt-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <UserRound className="h-4 w-4 text-primary" />
                        <span className="font-semibold">Approved By</span>
                      </div>
                      <span className="text-sm font-bold text-foreground">
                        {reviewerName}
                      </span>
                    </div>
                  )}
                  {reviewedAt && (
                    <div className="flex items-center justify-between border-t border-border pt-2">
                      <div className="flex items-center gap-2 text-sm text-emerald-700">
                        <Clock3 className="h-4 w-4" />
                        <span className="font-semibold">
                          {isApproved ? "Approved At" : "Rejected At"}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-emerald-700">
                        {formatDate(reviewedAt)} {formatTime(reviewedAt)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border bg-background px-4 py-3.5 shadow-[0_-8px_24px_rgba(15,23,42,0.04)] sm:px-6">
                {reasonModal.type === "EQUIPMENT" &&
                  reasonModal.status === "APPROVED" &&
                  !reasonModal.reviewNote?.includes("[PRODUCT_FOUND]") &&
                  !reasonModal.reviewNote?.includes("[ON_HOLD]") && (() => {
                    const isModalReturn =
                      (typeof reasonModal.description === "string" && reasonModal.description.toLowerCase().includes("action type: return")) ||
                      (typeof reasonModal.subject === "string" && reasonModal.subject.toLowerCase().includes("inventory return")) ||
                      (typeof reasonModal.title === "string" && reasonModal.title.toLowerCase().includes("return"));

                    if (isModalReturn) {
                      return null;
                    }

                    return (
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
                    );
                  })()}
                <button
                  type="button"
                  onClick={() => setReasonModal(null)}
                  className="min-w-[110px] rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
