import { useEffect, useState } from "react";
import { usePoll } from "../../lib/pollContext.jsx";
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
  ArrowLeft,
  Shield,
  PauseCircle,
  AlertTriangle,
  Package,
  PackageCheck,
  RotateCcw,
  PackagePlus,
  Tag,
  FolderKanban,
  Wrench,
  CheckCircle2,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../lib/api.js";
import { getAuthUser } from "../../lib/auth.js";
const REASON_PLACEHOLDERS = ["No check-in reason provided.", "No check-out reason provided.", "No reason provided.", "No reason provided for check-out."];
import { formatTimeWithPeriod } from "../../lib/timeFormat.js";

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
      return formatTimeWithPeriod(d, "en-IN", {
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

  // Discard automated sentences immediately
  candidate = candidate
    .replace(/(?:^|\r?\n)\s*(?:Time Edit|Forgot Punch) request for [^\r\n.]*(?:\.\s*|\r?\n|$)/gi, "")
    .trim();

  const desc = (typeof rawDescription === "string" ? rawDescription : candidate)
    .split("[ATTENDANCE_CORRECTION]")[0]
    .replace(/(?:^|\r?\n)\s*(?:Time Edit|Forgot Punch) request for [^\r\n.]*(?:\.\s*|\r?\n|$)/gi, "")
    .trim();

  const targetText = candidate || desc;

  // Extract from "Reason: <actual_reason>" within the text
  const reasonMatches = [...targetText.matchAll(/Reason:\s*(.*?)(?=\s*(?:\.\s*Pending admin approval|\.\s*Admin approved|\.\s*Admin rejected|Pending admin approval|Admin approved|Admin rejected)\b|\s*\||$)/gi)];
  if (reasonMatches.length > 0) {
    const joined = reasonMatches.map(m => m[1].trim()).filter(Boolean).join(" | ");
    if (joined && !/^unassigned location (check-in|check-out)$/i.test(joined) && !/^(?:Time Edit|Forgot Punch) request for/i.test(joined)) {
      return joined.replace(/\.$/, "").trim();
    }
  }

  // 3. Fallback: clean out checkin/checkout/approval tags
  let cleaned = targetText
    .replace(/^(?:Forgot Punch|Time Edit) request for .*?(?:\.\s*|\r?\n|$)/gi, "")
    .replace(/^Forgot Punch (?:approved|pending approval|rejected)\.?\s*/gi, "")
    .replace(/^Checkin:?[^|]*\|?/i, "")
    .replace(/Checkout [^.]*\./i, "")
    .replace(/Check-?[io]ut from unassigned location[^.]*\./gi, "")
    .replace(/Check-?[io]ut outside assigned location[^.]*\./gi, "")
    .replace(/Check-?[io]ut to unassigned location[^.]*\./gi, "")
    .replace(/Check-?[io]ut:?[^|]*\|?/i, "")
    .replace(/Check-In Location:.*$/i, "")
    .replace(/Check-Out Location:.*$/i, "")
    .replace(/\|?\s*Pending admin approval\.?/gi, "")
    .replace(/\|?\s*Approved by admin\.?/gi, "")
    .replace(/\|?\s*Rejected by admin\.?/gi, "")
    .replace(/Reason:\s*/gi, "")
    .replace(/\|/g, "")
    .trim();

  cleaned = cleaned.replace(/\.$/, "").trim();
  if (/^(?:Time Edit|Forgot Punch) request for/i.test(cleaned)) {
    return "";
  }
  return cleaned;
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
  let details = null;
  if (typeof request.description === "string") {
    const match = request.description.match(
      /\[ATTENDANCE_CORRECTION\]\s*(\{[\s\S]*\})\s*$/,
    );
    if (match) {
      try {
        details = JSON.parse(match[1]);
      } catch {
        details = null;
      }
    }
  }
  const punchType =
    details?.punchType || request.notification?.punchType || null;

  if (punchType === "both") {
    if (details?.checkOutLocationSource === "default-location") {
      return "Check In";
    }
    if (details?.checkInLocationSource === "default-location") {
      return "Check Out";
    }
    return "Check In + Check Out";
  }

  if (punchType === "time-edit") {
    const teType = details?.timeEditPunchType || (details?.checkInTime && !details?.checkOutTime ? "check-in" : details?.checkOutTime && !details?.checkInTime ? "check-out" : null);
    if (teType === "check-in") return "Check In";
    if (teType === "check-out") return "Check Out";
    return "Check In + Check Out";
  }

  return punchType === "check-in"
    ? "Check In"
    : punchType === "check-out"
      ? "Check Out"
      : null;
};

const getApprovalDisplayTitle = (approval) => {
  if (!approval) return "Approval Details";

  // Leave or Equipment requests
  if (approval.source === "LEAVE" || approval.type === "LEAVE") {
    return approval.title || approval.subject || "Leave Request";
  }
  if (approval.source === "EQUIPMENT" || approval.type === "EQUIPMENT") {
    return approval.subject || approval.title || "Equipment Request";
  }

  let details = approval?.correctionDetails;
  const description = String(approval?.description || "");
  const lowerDesc = description.toLowerCase();
  if (!details && description.includes("[ATTENDANCE_CORRECTION]")) {
    try {
      details = JSON.parse(description.split("[ATTENDANCE_CORRECTION]")[1].trim());
    } catch {}
  }

  const rawSubject = String(approval?.subject || approval?.title || "").trim();
  const lowerSubj = rawSubject.toLowerCase();

  // Read the created request's punch type directly from metadata/correction:
  const metaPunchType = String(details?.punchType || "").toLowerCase().trim();
  const rawPunchType = String(approval?.punchType || "").toLowerCase().trim();
  const punchType = metaPunchType || (rawPunchType === "check in" ? "check-in" : rawPunchType === "check out" ? "check-out" : rawPunchType === "time edit" ? "time-edit" : rawPunchType);

  const date =
    details?.date ||
    details?.checkOutDate ||
    (approval?.createdAt ? String(approval.createdAt).slice(0, 10) : "");
  const dateStr = date ? ` (${date})` : "";

  // 1. Time Edit Request
  const isTimeEdit =
    details?.isTimeEdit ||
    punchType === "time-edit" ||
    lowerSubj.includes("time edit") ||
    lowerDesc.includes("time edit request");

  if (isTimeEdit) {
    const tePunchType =
      details?.timeEditPunchType ||
      (details?.checkInTime && !details?.checkOutTime
        ? "check-in"
        : details?.checkOutTime && !details?.checkInTime
          ? "check-out"
          : (lowerDesc.includes("at check-in") && !lowerDesc.includes("at check-out") && !lowerDesc.includes("and check-out")
              ? "check-in"
              : (lowerDesc.includes("at check-out") && !lowerDesc.includes("at check-in")
                  ? "check-out"
                  : "both")));

    const isCheckInOnly = tePunchType === "check-in";
    const isCheckOutOnly = tePunchType === "check-out";

    const isULIn =
      details?.isULCheckIn ||
      details?.checkInLocationSource === "unassigned-location" ||
      (details?.checkInLatitude != null && details?.checkInLocationSource !== "forgot-punch") ||
      lowerSubj.includes("ul check in");

    const isULOut =
      !isCheckInOnly &&
      (details?.isULCheckOut ||
       details?.checkOutLocationSource === "unassigned-location" ||
       (details?.checkOutLatitude != null && details?.checkOutLocationSource !== "forgot-punch"));

    if (isCheckInOnly) {
      return isULIn ? `UL Check In + Time Edit${dateStr}` : `Time Edit Request - Check In${dateStr}`;
    }
    if (isCheckOutOnly) {
      return isULOut ? `UL Check Out + Time Edit${dateStr}` : `Time Edit Request - Check Out${dateStr}`;
    }
    if (isULIn && !isULOut) {
      return `UL Check In + Time Edit${dateStr}`;
    }
    if (isULOut && !isULIn) {
      return `UL Check Out + Time Edit${dateStr}`;
    }
    if (isULIn && isULOut) {
      return `UL Check In + UL Check Out (Time Edit)${dateStr}`;
    }

    const cleanSubj = rawSubject
      .replace(/Time Edit Request\s*-?\s*/i, "")
      .replace(/\s*\(\d{4}-\d{2}-\d{2}\).*$/, "")
      .trim();
    return cleanSubj ? `Time Edit Request - ${cleanSubj}${dateStr}` : `Time Edit Request${dateStr}`;
  }

  // 2. Check location sources
  const checkInLocSrc = details?.checkInLocationSource;
  const checkOutLocSrc = details?.checkOutLocationSource;

  const isCheckOutDefaultLoc =
    checkOutLocSrc === "default-location" ||
    lowerDesc.includes("checked out via mark attendance (default location)") ||
    (lowerDesc.includes("default location") && !lowerDesc.includes("check-out location:"));

  const isCheckInDefaultLoc =
    checkInLocSrc === "default-location" ||
    lowerDesc.includes("checked in via mark attendance (default location)");

  const isCheckInFP = checkInLocSrc === "forgot-punch" || (lowerSubj.includes("forgot check in") && !lowerSubj.includes("ul check in"));
  const isCheckOutFP = checkOutLocSrc === "forgot-punch" || (lowerSubj.includes("forgot check out") && !lowerSubj.includes("ul check out"));

  // 3. PRIORITY: Check In only
  if (punchType === "check-in" || (punchType === "both" && isCheckOutDefaultLoc && !isCheckInDefaultLoc)) {
    return isCheckInFP ? `Forgot Check In${dateStr}` : `UL Check In${dateStr}`;
  }

  // 4. PRIORITY: Check Out only
  if (punchType === "check-out" || (punchType === "both" && isCheckInDefaultLoc && !isCheckOutDefaultLoc)) {
    return isCheckOutFP ? `Forgot Check Out${dateStr}` : `UL Check Out${dateStr}`;
  }

  // 5. PRIORITY: Both punches require approval
  if (punchType === "both") {
    const checkInIsUL = !isCheckInFP;
    const checkOutIsUL = !isCheckOutFP;
    if (checkInIsUL && checkOutIsUL) {
      return `UL Check In + UL Check Out${dateStr}`;
    }
    if (checkInIsUL && isCheckOutFP) {
      return `UL Check In + Forgot Check Out${dateStr}`;
    }
    if (isCheckInFP && checkOutIsUL) {
      return `Forgot Check In + UL Check Out${dateStr}`;
    }
    if (isCheckInFP && isCheckOutFP) {
      return `Check In + Check Out by Forgot Punch${dateStr}`;
    }
  }

  // 6. Fallback based on subject and description
  const hasSubjCheckIn = lowerSubj.includes("check in") || lowerSubj.includes("check-in");
  const hasSubjCheckOut = lowerSubj.includes("check out") || lowerSubj.includes("check-out");
  if (hasSubjCheckIn && !hasSubjCheckOut) {
    return isCheckInFP ? `Forgot Check In${dateStr}` : `UL Check In${dateStr}`;
  }
  if (hasSubjCheckOut && !hasSubjCheckIn) {
    return isCheckOutFP ? `Forgot Check Out${dateStr}` : `UL Check Out${dateStr}`;
  }

  return rawSubject || approval?.title || "Approval Details";
};

const getPunchLocationSource = (approval, details, punch) => {
  const isCheckIn = punch === "checkIn";
  const source = details?.[`${punch}LocationSource`];
  if (source) return source;

  const subject = String(approval?.subject || approval?.title || "").toLowerCase();
  const description = String(approval?.description || "").toLowerCase();
  const punchLabel = isCheckIn ? "check in" : "check out";

  // New subject patterns
  if (isCheckIn) {
    if (subject.includes("forgot check in")) return "forgot-punch";
    if (subject.includes("ul check in")) return "unassigned-location";
  } else {
    if (subject.includes("forgot check out")) return "forgot-punch";
    if (subject.includes("ul check out")) return "unassigned-location";
    if (subject.includes("default-location") || subject.includes("default check out")) return "default-location";
  }

  if (subject.includes(`${punchLabel} (ul)`)) return "unassigned-location";
  if (subject.includes(`${punchLabel} (forgot punch)`)) return "forgot-punch";

  // Only treat coordinates as UL if description explicitly says "unassigned location"
  if (
    (description.includes("unassigned location") || description.includes("outside assigned location")) &&
    (details?.[`${punch}Latitude`] != null || details?.[`${punch}Longitude`] != null)
  ) {
    return "unassigned-location";
  }

  if (details?.[`${punch}Location`]) return "forgot-punch";

  const punchType = String(details?.punchType || "").toLowerCase();
  const includesPunch =
    punchType === (isCheckIn ? "check-in" : "check-out") ||
    punchType === "both";
  if (includesPunch && subject.includes("forgot punch")) return "forgot-punch";
  if (punchType === (isCheckIn ? "check-in" : "check-out")) {
    return "forgot-punch";
  }
  return null;
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
    const readableParts = readableText.split("|").map((part) => part.trim());
    const extractPunchReason = (punchPattern) => {
      const punchPart = readableParts.find((part) => punchPattern.test(part));
      const match = punchPart?.match(
        /Reason:\s*(.*?)(?=\s*(?:Pending admin approval|Admin approved|Admin rejected|Approved by admin|Rejected by admin)\b|$)/i,
      );
      return match?.[1]?.trim().replace(/\.$/, "") || null;
    };
    const checkInReasonFromText = extractPunchReason(/\bcheck[\s-]?in\b/i);
    const checkOutReasonFromText = extractPunchReason(/\bcheck[\s-]?out\b/i);
    const checkInLocation =
      data.checkInLocation ||
      readableText.match(/(?:^|\n)\s*Check-In Location:\s*([^\r\n]+)/i)?.[1]?.trim() ||
      null;
    const checkOutLocation =
      data.checkOutLocation ||
      readableText.match(/(?:^|\n)\s*Check-Out Location:\s*([^\r\n]+)/i)?.[1]?.trim() ||
      null;

    const isTimeEdit = data.punchType === "time-edit" || readableText.toLowerCase().includes("time edit");

    // 1. If data has an explicit reason (not the default unassigned location string), prefer it
    let explicitReason = "";
    if (typeof data.reason === "string" && data.reason.trim()) {
      const trimmed = data.reason.trim();
      if (!/^unassigned location (check-in|check-out)$/i.test(trimmed)) {
        explicitReason = trimmed;
      }
    }

    // 2. Extract from "Reason: <actual_reason>" within the text
    const reasonMatches = [...readableText.matchAll(/Reason:\s*(.*?)(?=\s*(?:\.\s*Pending admin approval|\.\s*Admin approved|\.\s*Admin rejected|Pending admin approval|Admin approved|Admin rejected)\b|\s*\||$)/gi)];
    let extractedReason = "";
    if (reasonMatches.length > 0) {
      extractedReason = reasonMatches.map(m => m[1].trim()).filter(Boolean).join(" | ");
    }

    let reason = explicitReason || extractedReason;

    if (!reason) {
      reason = readableText
        .replace(
          /^(?:Forgot Punch|Time Edit) request for (?:both|check-in|check-out|Check In|Check Out|time-edit|Time Edit) on \d{4}-\d{2}-\d{2}\.?\s*/i,
          "",
        )
        .replace(
          /^(?:Forgot Punch|Time Edit) request for .*? on \d{4}-\d{2}-\d{2} at .*?(?:\.\s*|$)/i,
          "",
        )
        .replace(/^Checkin:?[^|]*\|?/i, "")
        .replace(/Checkout [^.]*\./i, "")
        .replace(/Check-In Location:.*$/i, "")
        .replace(/Check-Out Location:.*$/i, "")
        .replace(/\|?\s*Pending admin approval\.?/gi, "")
        .replace(/\|?\s*Approved by admin\.?/gi, "")
        .replace(/\|?\s*Rejected by admin\.?/gi, "")
        .replace(/Reason:\s*/gi, "")
        .replace(/\|/g, "")
        .trim();
    }

    reason = String(reason || "")
      .replace(/^(?:Forgot Punch|Time Edit) request for [^\r\n]*(?:\r?\n|$)/i, "")
      .replace(/(?:^|\r?\n)\s*Check-In Location:\s*[^\r\n]*/gi, "")
      .replace(/(?:^|\r?\n)\s*Check-Out Location:\s*[^\r\n]*/gi, "")
      .replace(/\|?\s*Pending admin approval\.?/gi, "")
      .replace(/\|?\s*Approved by admin\.?/gi, "")
      .replace(/\|?\s*Rejected by admin\.?/gi, "")
      .replace(/^\s*Reason:\s*/i, "")
      .replace(/\|/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (
      isTimeEdit &&
      reason.toLowerCase() === "i want to change my attendance time."
    ) {
      reason = "";
    }

    return {
      date: data.date,
      isTimeEdit,
      punchType:
        data.punchType === "check-in"
          ? "Check In"
          : data.punchType === "check-out"
            ? "Check Out"
            : data.punchType === "time-edit"
              ? "Time Edit"
              : data.punchType === "both"
                ? "Check In + Check Out"
                : null,
      checkInTime: data.checkInTime,
      checkOutTime: data.checkOutTime,
      originalCheckInTime: data.originalCheckInTime || null,
      originalCheckOutTime: data.originalCheckOutTime || null,
      checkInLocation,
      checkOutLocation,
      checkInLatitude: data.checkInLatitude ?? null,
      checkInLongitude: data.checkInLongitude ?? null,
      checkOutLatitude: data.checkOutLatitude ?? null,
      checkOutLongitude: data.checkOutLongitude ?? null,
      attendanceId: data.attendanceId || null,
      checkInLocationSource: data.checkInLocationSource || null,
      checkOutLocationSource: data.checkOutLocationSource || null,
      checkInReason: data.checkInReason || checkInReasonFromText || null,
      checkOutReason: data.checkOutReason || checkOutReasonFromText || null,
      reason: reason || (isTimeEdit ? "" : "No reason provided."),
    };
  } catch {
    return null;
  }
};

const normalizeRequests = (items) =>
  (items || []).map((item) => {
    const parsed = parseCorrectionFromDescription(item.description);
    const rawPunchType = String(
      parsed?.punchType || item.notification?.punchType || "",
    ).toLowerCase();
    const hasBothPunches =
      rawPunchType === "both" ||
      (rawPunchType.includes("check in") &&
        rawPunchType.includes("check out"));
    const isTimeEditRequest =
      parsed?.isTimeEdit ||
      rawPunchType === "time-edit" ||
      rawPunchType === "time edit" ||
      item.subject?.toLowerCase().includes("time edit");
    const isUnassignedCheckInWithForgotPunchCheckOut =
      hasBothPunches &&
      (item.subject?.toLowerCase().includes("check in (ul)") ||
        item.subject?.toLowerCase().includes("check out (ul)") ||
        item.subject?.toLowerCase().includes("ul check in") ||
        item.subject?.toLowerCase().includes("ul check out") ||
        item.subject?.toLowerCase().includes("forgot check in") ||
        item.subject?.toLowerCase().includes("forgot check out") ||
        item.subject?.toLowerCase().includes("location approval") ||
        item.description?.toLowerCase().includes("unassigned location") ||
        item.description?.toLowerCase().includes("outside assigned location") ||
        parsed?.checkInLocationSource === "unassigned-location" ||
        parsed?.checkOutLocationSource === "unassigned-location");
    const checkInLat = parsed?.checkInLocationSource === "forgot-punch"
      ? null
      : item.checkInLatitude ?? item.notification?.checkInLatitude ?? parsed?.checkInLatitude ?? null;
    const checkInLng = parsed?.checkInLocationSource === "forgot-punch"
      ? null
      : item.checkInLongitude ?? item.notification?.checkInLongitude ?? parsed?.checkInLongitude ?? null;
    const checkOutLat = parsed?.checkOutLocationSource === "forgot-punch"
      ? null
      : item.checkOutLatitude ?? item.notification?.checkOutLatitude ?? parsed?.checkOutLatitude ?? null;
    const checkOutLng = parsed?.checkOutLocationSource === "forgot-punch"
      ? null
      : item.checkOutLongitude ?? item.notification?.checkOutLongitude ?? parsed?.checkOutLongitude ?? null;

    return {
      id: item.id,
      source: "REQUEST",
      type: item.type,
      subject: item.subject,
      title: getApprovalDisplayTitle({
        id: item.id,
        source: "REQUEST",
        type: item.type,
        subject: item.subject,
        description: item.description,
        correctionDetails: parsed,
        punchType: getPunchTypeLabel(item),
        createdAt: item.createdAt,
      }),
      punchType: item.type === "CORRECTION"
        ? getPunchTypeLabel(item)
        : null,
      correctionDetails:
        item.type === "CORRECTION"
          ? (() => {
              if (item.notification && parsed) {
                return {
                  ...item.notification,
                  ...parsed,
                  checkInLatitude: checkInLat,
                  checkInLongitude: checkInLng,
                  checkOutLatitude: checkOutLat,
                  checkOutLongitude: checkOutLng,
                  checkInLocation:
                    parsed.checkInLocation ||
                    item.notification.checkInLocation ||
                    null,
                  checkOutLocation:
                    parsed.checkOutLocation ||
                    item.notification.checkOutLocation ||
                    null,
                  checkInLocationSource:
                    parsed.checkInLocationSource ||
                    item.notification.checkInLocationSource ||
                    null,
                  checkOutLocationSource:
                    parsed.checkOutLocationSource ||
                    item.notification.checkOutLocationSource ||
                    null,
                  reason: parsed.reason || item.notification.reason || "",
                  originalCheckInTime:
                    parsed.originalCheckInTime ||
                    item.notification.originalCheckInTime ||
                    null,
                  originalCheckOutTime:
                    parsed.originalCheckOutTime ||
                    item.notification.originalCheckOutTime ||
                    null,
                  checkInReason:
                    parsed.checkInReason ||
                    item.notification.checkInReason ||
                    null,
                  checkOutReason:
                    parsed.checkOutReason ||
                    item.notification.checkOutReason ||
                    null,
                };
              }
              if (parsed) {
                return {
                  ...parsed,
                  checkInLatitude: checkInLat,
                  checkInLongitude: checkInLng,
                  checkOutLatitude: checkOutLat,
                  checkOutLongitude: checkOutLng,
                };
              }
              if (item.notification) {
                return {
                  ...item.notification,
                  checkInLatitude: checkInLat,
                  checkInLongitude: checkInLng,
                  checkOutLatitude: checkOutLat,
                  checkOutLongitude: checkOutLng,
                };
              }
              return null;
            })()
          : null,
      description:
        item.description || item.notification?.reason || "No details provided.",
      employee:
        item.employee?.fullName || item.employee?.user?.fullName || "Employee",
      employeeCode: item.employee?.employeeCode || "",
      employeeId: item.employee?.id || item.employeeId || "",
      reviewNote: item.reviewNote || null,
      reviewedAt: item.reviewedAt || null,
      reviewedBy: item.reviewedBy?.fullName || item.reviewedBy || null,
      checkInLatitude: checkInLat,
      checkInLongitude: checkInLng,
      checkOutLatitude: checkOutLat,
      checkOutLongitude: checkOutLng,
      status: item.status === "PENDING" ? "PENDING" : item.status,
      createdAt: item.createdAt,
    };
  });

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
    reviewedBy: item.reviewedBy?.fullName || item.reviewedBy || null,
    status: item.status,
    createdAt: item.createdAt,
  }));

const normalizeAttendance = (items) =>
  (items || []).map((item) => {
    const isCheckoutApproval =
      !!item.checkOut ||
      (item.note?.includes("Checkout") && !item.note?.includes("Checkin"));
    const isUnassignedCheckInWithCheckOut =
      isCheckoutApproval &&
      (item.note?.toLowerCase().includes("unassigned location") ||
        item.note?.toLowerCase().includes("outside assigned location"));
    const dateLabel = String(item.date || item.checkIn || item.createdAt || "")
      .slice(0, 10);

    return {
      id: item.id,
      source: "ATTENDANCE",
      title:
        isUnassignedCheckInWithCheckOut
          ? `UL Check In + Forgot Check Out (${dateLabel})`
          : item.note?.includes("outside") || item.note?.includes("unassigned") || item.note?.includes("requires approval")
          ? isCheckoutApproval
            ? "Checkout Location Approval"
            : "Checkin Location Approval"
          : item.note?.includes("Forgot Punch")
            ? "Forgot Punch Checkout Approval"
            : "Attendance Approval",
      description: item.note || "Employee attendance requires approval.",
      employee: item.fullName || item.employee?.user?.fullName || "Employee",
      employeeCode: item.employee?.employeeCode || "",
      employeeId: item.employeeId || item.employee?.id || "",
      reviewNote: item.note || null,
      reviewedAt: item.updatedAt || null,
      reviewedBy: item.reviewedBy?.fullName || item.reviewedBy || null,
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
      isCheckInUnassigned: false,
      isCheckOutUnassigned: false,
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
      .replace(/^Forgot Punch (?:approved|pending approval|rejected)\.?\s*/gi, "")
      .replace(/^Checkin\s+(from|to|location|location requires approval)?[^.]*?\.\s*/i, "")
      .replace(/^Checkout\s+(recorded|from|to|location|outside|location requires approval)?[^.]*?\.\s*/i, "")
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

  // Extract Reason: from a single part
  const extractReason = (partText) => {
    if (!partText) return "";
    const m = partText.match(/Reason:\s*(.*?)(?=\s*(?:Pending admin approval|Admin approved|Admin rejected|Approved by admin|Rejected by admin)\b|\s*\||$)/i);
    let extracted = m ? m[1].trim() : "";
    if (extracted.endsWith(".")) {
      extracted = extracted.slice(0, -1).trim();
    }
    return extracted;
  };

  const checkoutPart = parts.find(p => /checkout/i.test(p) || /check.?out/i.test(p));
  const checkinPart = parts.find(p => /checkin/i.test(p) || /check.?in/i.test(p));

  let checkInReason = "";
  let checkOutReason = "";

  if (checkinPart) {
    checkInReason = extractReason(checkinPart) || sanitize(checkinPart);
  }
  if (checkoutPart) {
    checkOutReason = extractReason(checkoutPart);
  }

  if (!checkinPart && !checkoutPart) {
    checkInReason = sanitize(cleanText);
  } else if (!checkinPart) {
    checkInReason = "";
  }

  const fullClean = sanitize(cleanText);
  const isCheckInUnassigned = checkinPart ? /unassigned|outside|requires approval/i.test(checkinPart) : /unassigned|outside|requires approval/i.test(cleanText);
  const isCheckOutUnassigned = checkoutPart ? /unassigned|outside|requires approval/i.test(checkoutPart) : false;

  return {
    reason: fullClean || "No reason provided.",
    checkInReason: checkInReason || fullClean || "No check-in reason provided.",
    checkOutReason: checkOutReason || "No reason provided for check-out.",
    checkInDistance,
    checkOutDistance,
    isCheckInUnassigned,
    isCheckOutUnassigned,
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

  // 2. Strip system preamble "Forgot Punch / Time Edit request for ... "
  text = text
    .replace(/(?:^|\r?\n)\s*(?:Time Edit|Forgot Punch) request for [^\r\n.]*(?:\.\s*|\r?\n|$)/gi, "")
    .replace(
      /^(?:Forgot Punch|Time Edit) request for (?:both|check-in|check-out|Check In|Check Out) on \d{4}-\d{2}-\d{2}\.?\s*/i,
      "",
    )
    .replace(
      /^(?:Forgot Punch|Time Edit) request for .*? on \d{4}-\d{2}-\d{2} at .*?(?:\.\s*|$)/i,
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
  let reason = reasonMatch?.[1]?.trim();

  if (!reason && (approval?.source === "ATTENDANCE" || approval?.type === "CORRECTION" || text.includes("Checkin:") || text.includes("Checkout:"))) {
    reason = cleanPureReason(approval?.correctionDetails?.reason || approval?.notification?.reason, text);
  } else if (!reason) {
    reason = text;
  }

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

const getReviewerInfo = (approval) => {
  if (!approval) return "Admin";

  if (approval.reviewedBy) {
    if (typeof approval.reviewedBy === "string" && approval.reviewedBy.trim()) {
      return approval.reviewedBy.trim();
    }
    if (typeof approval.reviewedBy === "object" && approval.reviewedBy?.fullName) {
      return approval.reviewedBy.fullName;
    }
  }

  const text = String(approval.reviewNote || approval.description || "").trim();

  const matchName = text.match(/(?:Approved|Rejected)\s+by\s+([^:|\.]+)/i);
  if (matchName && matchName[1]) {
    const name = matchName[1].trim();
    if (name) return name;
  }

  const matchAdmin = text.match(/Admin\s+(?:approved|rejected)/i);
  if (matchAdmin) return "Admin";

  return "Admin";
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

  const categoryPair = pairs.find((p) => p.label.toLowerCase().includes("category"));
  const categoryName = categoryPair ? categoryPair.value.toLowerCase() : "";
  const isToolsCategory = categoryName.includes("tool");

  const filteredPairs = pairs.filter((pair) => {
    if (pair.label.toLowerCase().includes("project")) {
      if (isToolsCategory || !pair.value || pair.value === "N/A") {
        return false; // Remove Project Name from view reason/details modal if request category is Tools
      }
    }
    return true;
  });

  return { pairs: filteredPairs, remarks };
};

const getDetailIcon = (label) => {
  const l = label.toLowerCase();
  if (l.includes("product id") || l.includes("item id")) return <Tag className="h-3.5 w-3.5 text-amber-600 shrink-0" />;
  if (l.includes("project")) return <FolderKanban className="h-3.5 w-3.5 text-indigo-600 shrink-0" />;
  if (l.includes("action")) return <RotateCcw className="h-3.5 w-3.5 text-purple-600 shrink-0" />;
  if (l.includes("item name")) return <Wrench className="h-3.5 w-3.5 text-blue-600 shrink-0" />;
  if (l.includes("date")) return <Calendar className="h-3.5 w-3.5 text-emerald-600 shrink-0" />;
  if (l.includes("urgency")) return <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />;
  if (l.includes("condition")) return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />;
  return <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
};

const RenderFormattedDetails = ({ text }) => {
  const parsed = parseRequestDetails(text);

  if (!parsed || (!parsed.pairs.length && !parsed.remarks)) {
    return (
      <div className="rounded-xl border border-border bg-background p-4 shadow-2xs">
        <p className="whitespace-pre-wrap break-words text-sm font-medium leading-relaxed text-foreground">
          {text || "No details provided."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {parsed.pairs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {parsed.pairs.map((pair, idx) => {
            const isProdId = pair.label.toLowerCase().includes("product id");
            const isProject = pair.label.toLowerCase().includes("project");
            const isAction = pair.label.toLowerCase().includes("action");
            const isCondition = pair.label.toLowerCase().includes("condition");

            return (
              <div
                key={idx}
                className="rounded-xl border border-border/80 bg-background p-3.5 shadow-2xs transition-all hover:border-primary/30"
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  {getDetailIcon(pair.label)}
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {pair.label}
                  </span>
                </div>

                {isProdId ? (
                  <span className="inline-flex items-center gap-1 font-mono text-sm font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20">
                    {pair.value}
                  </span>
                ) : isProject ? (
                  <span className="font-bold text-sm text-foreground bg-secondary px-2.5 py-1 rounded-md inline-block border border-border">
                    {pair.value}
                  </span>
                ) : isAction ? (
                  <span className={`font-bold text-xs px-2.5 py-1 rounded-full inline-block ${
                    pair.value.toUpperCase().includes("RETURN")
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                      : "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30"
                  }`}>
                    {pair.value}
                  </span>
                ) : isCondition ? (
                  <span className="font-bold text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 inline-block">
                    {pair.value}
                  </span>
                ) : (
                  <span className="text-sm font-bold text-foreground break-words block">
                    {pair.value}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {parsed.remarks && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-2xs">
          <div className="flex items-center gap-2 mb-1.5 text-amber-700 dark:text-amber-400">
            <MessageSquareText className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Purpose / Work Details / Remarks
            </span>
          </div>
          <p className="text-sm font-medium leading-relaxed text-foreground whitespace-pre-wrap break-words pl-3 border-l-2 border-amber-500/40">
            {parsed.remarks}
          </p>
        </div>
      )}
    </div>
  );
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
      <h3 className={`text-lg font-bold leading-tight text-foreground ${className}`}>
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

      <h3 className="text-lg font-bold leading-snug text-foreground">
        {parsed.itemName}
      </h3>
    </div>
  );
};

const isReturnRequest = (req) => {
  if (!req) return false;
  // Non-inventory requests (CORRECTION / forgot punch, ATTENDANCE, LEAVE) cannot be return requests
  if (req.source && req.source !== "REQUEST") return false;
  if (req.type && req.type !== "EQUIPMENT") return false;

  const title = String(req?.title || "").toLowerCase();
  const desc = String(req?.description || "").toLowerCase();
  const subject = String(req?.subject || "").toLowerCase();

  // If explicitly taking / issue, it is NOT a return request
  if (
    title.includes("inventory taking") ||
    desc.includes("action type: taking") ||
    desc.includes("action type: issue")
  ) {
    return false;
  }

  return (
    title.includes("inventory return") ||
    desc.includes("action type: return") ||
    desc.includes("[inventory return") ||
    title.includes("[inventory return") ||
    subject.includes("inventory return") ||
    title.includes("return") ||
    subject.includes("return")
  );
};

const getReturnStep = (req) => {
  if (req?.source !== "REQUEST" || req?.type !== "EQUIPMENT") return 0;
  if (!isReturnRequest(req)) return 0;

  const text = `${req?.status || ""} ${req?.reviewNote || ""} ${req?.adminNote || ""} ${req?.description || ""}`.toUpperCase();
  if (text.includes("[PRODUCT_FOUND]") || req?.status === "COMPLETED") return 4;
  if (text.includes("[ITEM_RETURNED]") || text.includes("[PHYSICALLY_RETURNED]")) return 3;
  if (text.includes("[QUALITY_INSPECTED]") || text.includes("QUALITY INSPECTED")) return 2;
  if (req?.status === "APPROVED") return 2;
  return 1;
};

const Approvals = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authUser = getAuthUser();
  const isAdmin = authUser?.role === "ADMIN";
  const { pollTick } = usePoll();
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState(null);
  const [reasonModal, setReasonModal] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [holdModal, setHoldModal] = useState(null);
  const [holdReason, setHoldReason] = useState("Product currently out of stock / unavailable.");
  const [permissions, setPermissions] = useState(null);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [openLocationIds, setOpenLocationIds] = useState(new Set());

  const getInventoryItemLocation = (approval) => {
    if (!approval || !Array.isArray(inventoryItems) || inventoryItems.length === 0) return null;
    if (approval.source !== "REQUEST" || approval.type !== "EQUIPMENT") return null;
    const fullText = `${approval.title || ""} ${approval.description || ""}`.toLowerCase();
    return (
      inventoryItems.find((item) => {
        const code = (item.code || item.sku || "").toLowerCase();
        const name = (item.name || "").toLowerCase();
        return (code && code.length >= 3 && fullText.includes(code)) || (name && name.length >= 3 && fullText.includes(name));
      }) || null
    );
  };

  const [qualityModal, setQualityModal] = useState(null);
  const [qualityCondition, setQualityCondition] = useState("Good Condition - Restock to Warehouse");
  const [qualityRemarks, setQualityRemarks] = useState("");

  const handleHoldSubmit = async () => {
    if (!holdModal) return;
    setActingId(`${holdModal.approval.source}:${holdModal.approval.id}`);
    try {
      await apiPost(`/requests/${holdModal.approval.id}/hold`, {
        note: holdReason.trim() || "Product currently out of stock / unavailable.",
      });
      toast.success("Request placed on HOLD (Product Out of Stock).");
      setHoldModal(null);
      setHoldReason("Product currently out of stock / unavailable.");
      await loadApprovals();
    } catch (err) {
      toast.error(err.message || "Failed to place request on hold.");
    } finally {
      setActingId(null);
    }
  };

  const handleQualitySubmit = async () => {
    if (!qualityModal) return;
    setActingId(`${qualityModal.source}:${qualityModal.id}`);
    try {
      const note = `[QUALITY_INSPECTED] Quality Inspected: ${qualityCondition}. Remarks: ${qualityRemarks.trim() || "Quality inspected by Admin."}`;
      await review(qualityModal, "approve", note);
      toast.success("Return Request Approved & Quality Test recorded! Awaiting employee Item Return.");
      setQualityModal(null);
      setQualityCondition("Good Condition - Restock to Warehouse Stock");
      setQualityRemarks("");
      await loadApprovals();
    } catch (err) {
      toast.error(err.message || "Failed to submit quality check.");
    } finally {
      setActingId(null);
    }
  };

  const handleAdminFoundItem = async (approval) => {
    if (!approval) return;
    setActingId(`${approval.source}:${approval.id}`);
    try {
      const cleanId = String(approval.id).replace(/^request-/, "");
      await apiPost(`/requests/${cleanId}/found`, {});
      toast.success("Found Item! Product return confirmed and restocked into inventory.");
      await loadApprovals();
    } catch (err) {
      toast.error(err.message || "Failed to mark item found.");
    } finally {
      setActingId(null);
    }
  };

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Default to current month and year
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [yearFilter, setYearFilter] = useState(String(currentYear));
  const [monthFilter, setMonthFilter] = useState(String(currentMonth));
  const [employeeFilter, setEmployeeFilter] = useState("ALL");
  
  // Get type filter from URL params (for granular approval modules)
  const urlTypeFilter = searchParams.get("type"); // 'attendance', 'forgot-punch', 'tools-inventory', or 'leave'
  const [categoryFilter, setCategoryFilter] = useState(urlTypeFilter || "ALL");

  useEffect(() => {
    if (urlTypeFilter) {
      setCategoryFilter(urlTypeFilter);
    }
  }, [urlTypeFilter]);

  const effectiveCategory = categoryFilter !== "ALL" ? categoryFilter : (urlTypeFilter || "ALL");

  const loadApprovals = async () => {
    setLoading(true);
    try {
      // Load all APIs with Promise.allSettled so individual failures don't block others
      const [requestResult, leaveResult, attendanceResult, inventoryResult] = await Promise.allSettled([
        apiGet("/requests"),
        apiGet("/leave/admin/all"),
        apiGet("/attendance/admin/requests"),
        apiGet("/inventory/items"),
      ]);

      const requests = requestResult.status === "fulfilled" ? (requestResult.value?.requests || []) : [];
      const leave = leaveResult.status === "fulfilled" ? (leaveResult.value?.requests || []) : [];
      const attendance = attendanceResult.status === "fulfilled" ? (attendanceResult.value?.records || []) : [];
      const invItems = inventoryResult.status === "fulfilled" ? (inventoryResult.value?.items || []) : [];
      setInventoryItems(invItems);

      const normalizedReqs = normalizeRequests(requests);
      const normalizedLvs = normalizeLeave(leave);
      const normalizedAtts = normalizeAttendance(attendance);

      // Pre-correlate attendance unassigned-location note & reason onto correction requests
      normalizedReqs.forEach((req) => {
        if (req.type === "CORRECTION" || req.title?.includes("UL Check In") || req.subject?.includes("UL Check In")) {
          const empId = req.employeeId || "";
          const date = req.correctionDetails?.date || req.subject?.match(/\d{4}-\d{2}-\d{2}/)?.[0];
          const matchingAtt = normalizedAtts.find((att) => {
            const attEmpId = att.employeeId || "";
            const empMatches = attEmpId === empId || (req.employeeCode && att.employeeCode === req.employeeCode);
            if (!empMatches) return false;
            if (!date) return true;
            const attDateStr = String(att.date || "");
            const attCheckInStr = String(att.checkInTime || "");
            const match1 = attDateStr.includes(date) || attCheckInStr.includes(date);
            const match2 = att.date ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(att.date)) === date : false;
            const match3 = att.checkInTime ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(att.checkInTime)) === date : false;
            return match1 || match2 || match3;
          });
          if (matchingAtt) {
            req.actualAttendanceNote = matchingAtt.description || matchingAtt.reviewNote;
            const attDetails = getAttendanceDetails(req.actualAttendanceNote);
            const attReason = (attDetails?.checkInReason && !REASON_PLACEHOLDERS.includes(attDetails.checkInReason) ? attDetails.checkInReason : "") ||
              matchingAtt.description?.match(/(?:Check-In Reason|Checkin Reason|Reason)\s*:\s*([^.\r\n|]+)/i)?.[1]?.trim();
            if (attReason && !/^(?:unassigned location|outside assigned location|pending admin)/i.test(attReason)) {
              req.checkInReason = attReason;
              if (req.correctionDetails) {
                req.correctionDetails.checkInReason = req.correctionDetails.checkInReason || attReason;
              }
            }
          }
        }
      });

      // Track known attendance IDs and date keys across EmployeeRequest tickets
      const knownAttendanceIds = new Set();
      const knownEmployeeDateKeys = new Set();

      normalizedReqs.forEach((req) => {
        const attId = req.correctionDetails?.attendanceId;
        if (attId) {
          knownAttendanceIds.add(String(attId));
        }
        if (req.type === "CORRECTION" && req.correctionDetails?.date) {
          const empId = req.employeeId || "";
          knownEmployeeDateKeys.add(`${empId}_${req.correctionDetails.date}`);
        }
      });

      // Filter out duplicate attendance records where a CORRECTION EmployeeRequest already exists
      const filteredAttendance = normalizedAtts.filter((att) => {
        const attIdStr = String(att.id);
        if (knownAttendanceIds.has(attIdStr)) {
          return false;
        }
        const empId = att.employeeId || "";
        const dateKey = att.date ? new Date(att.date).toISOString().slice(0, 10) : "";
        const checkInDateKey = att.checkInTime ? new Date(att.checkInTime).toISOString().slice(0, 10) : "";
        if (dateKey && knownEmployeeDateKeys.has(`${empId}_${dateKey}`)) {
          return false;
        }
        if (checkInDateKey && knownEmployeeDateKeys.has(`${empId}_${checkInDateKey}`)) {
          return false;
        }
        return true;
      });

      // Keep requests separate; the backend explicitly combines only related punches.
      const seenEmployeeDateRequests = new Map();
      const consolidatedRequests = [];

      normalizedReqs.forEach((req) => {
        if (req.type === "CORRECTION") {
          const key = req.id;

          if (seenEmployeeDateRequests.has(key)) {
            // Merge with the existing item to form 1 single request
            const existing = seenEmployeeDateRequests.get(key);
            const existingPunchType = String(
              existing.correctionDetails?.punchType || existing.punchType || "",
            ).toLowerCase();
            const addedPunchType = String(
              req.correctionDetails?.punchType || req.punchType || "",
            ).toLowerCase();
            const existingHasCheckIn =
              existingPunchType.includes("check in") ||
              existingPunchType === "both";
            const existingHasCheckOut =
              existingPunchType.includes("check out") ||
              existingPunchType === "both";
            const addedHasCheckIn =
              addedPunchType.includes("check in") || addedPunchType === "both";
            const addedHasCheckOut =
              addedPunchType.includes("check out") || addedPunchType === "both";
            const hasSamePunchType =
              (existingHasCheckIn && addedHasCheckIn) ||
              (existingHasCheckOut && addedHasCheckOut);
            if (hasSamePunchType) {
              consolidatedRequests.push(req);
              return;
            }
            const hasLocationApproval =
              existing.title?.toLowerCase().includes("location approval") ||
              existing.description?.toLowerCase().includes("unassigned location") ||
              existing.description?.toLowerCase().includes("outside assigned location") ||
              req.title?.toLowerCase().includes("location approval") ||
              req.description?.toLowerCase().includes("unassigned location") ||
              req.description?.toLowerCase().includes("outside assigned location");
            const isUnassignedCheckInWithForgotPunchCheckOut =
              hasLocationApproval &&
              existingHasCheckIn &&
              (addedHasCheckOut ||
                existingHasCheckOut ||
                Boolean(existing.correctionDetails?.checkOutReason) ||
                Boolean(req.correctionDetails?.checkOutReason));
            const checkInLocationSource =
              (addedPunchType.includes("check-in") &&
              req.correctionDetails?.checkInLocationSource
                ? req.correctionDetails.checkInLocationSource
                : existing.correctionDetails?.checkInLocationSource) ||
              (existing.correctionDetails?.checkInLatitude != null
                ? "unassigned-location"
                : "forgot-punch");
            const checkOutLocationSource =
              (addedPunchType.includes("check-out") &&
              req.correctionDetails?.checkOutLocationSource
                ? req.correctionDetails.checkOutLocationSource
                : existing.correctionDetails?.checkOutLocationSource) ||
              (existing.correctionDetails?.checkOutLatitude != null
                ? "unassigned-location"
                : "forgot-punch");

            existing.relatedRequestIds = Array.from(
              new Set([
                ...(existing.relatedRequestIds || [
                  ...(existing.status === "PENDING" ? [existing.id] : []),
                ]),
                ...(req.status === "PENDING" ? [req.id] : []),
              ]),
            );
            existing.punchType = "Check In + Check Out";
            existing.title = isUnassignedCheckInWithForgotPunchCheckOut
              ? `Check In (UL) and Check Out (Forgot Punch) (${dateStr})`
              : hasLocationApproval
                ? `Location Approval - Check In + Check Out (${dateStr})`
              : `Forgot Punch - Check In + Check Out`;
            existing.checkInLatitude = existing.checkInLatitude ?? req.checkInLatitude;
            existing.checkInLongitude = existing.checkInLongitude ?? req.checkInLongitude;
            existing.checkOutLatitude = req.checkOutLatitude ?? existing.checkOutLatitude;
            existing.checkOutLongitude = req.checkOutLongitude ?? existing.checkOutLongitude;
            if (
              addedPunchType.includes("check-in") &&
              req.correctionDetails?.checkInLocationSource === "forgot-punch"
            ) {
              existing.checkInLatitude = null;
              existing.checkInLongitude = null;
            }
            if (
              addedPunchType.includes("check-out") &&
              req.correctionDetails?.checkOutLocationSource === "forgot-punch"
            ) {
              existing.checkOutLatitude = null;
              existing.checkOutLongitude = null;
            }
            if (existing.correctionDetails) {
              existing.correctionDetails.punchType = "both";
              existing.correctionDetails.checkInTime = existing.correctionDetails.checkInTime || req.correctionDetails?.checkInTime;
              existing.correctionDetails.checkOutTime = req.correctionDetails?.checkOutTime || existing.correctionDetails.checkOutTime;
              existing.correctionDetails.checkInReason =
                (addedHasCheckIn
                  ? req.correctionDetails?.checkInReason ||
                    (addedPunchType === "check-in"
                      ? req.correctionDetails?.reason
                      : null)
                  : null) ||
                existing.correctionDetails.checkInReason ||
                (existingPunchType === "check-in"
                  ? existing.correctionDetails.reason
                  : null);
              existing.correctionDetails.checkOutReason =
                (addedHasCheckOut
                  ? req.correctionDetails?.checkOutReason ||
                    (addedPunchType === "check-out"
                      ? req.correctionDetails?.reason
                      : null)
                  : null) ||
                existing.correctionDetails.checkOutReason ||
                (existingPunchType === "check-out"
                  ? existing.correctionDetails.reason
                  : null);
              existing.correctionDetails.checkInLocation =
                (addedPunchType.includes("check-in")
                  ? req.correctionDetails?.checkInLocation
                  : null) ||
                existing.correctionDetails.checkInLocation ||
                req.correctionDetails?.checkInLocation ||
                null;
              existing.correctionDetails.checkOutLocation =
                (addedPunchType.includes("check-out")
                  ? req.correctionDetails?.checkOutLocation
                  : null) ||
                existing.correctionDetails.checkOutLocation ||
                req.correctionDetails?.checkOutLocation ||
                null;
              existing.correctionDetails.checkInLocationSource =
                checkInLocationSource;
              existing.correctionDetails.checkOutLocationSource =
                checkOutLocationSource;
              existing.correctionDetails.checkInLatitude = existing.checkInLatitude;
              existing.correctionDetails.checkInLongitude = existing.checkInLongitude;
              existing.correctionDetails.checkOutLatitude = existing.checkOutLatitude;
              existing.correctionDetails.checkOutLongitude = existing.checkOutLongitude;
            }
            if (existing.status === "PENDING" || req.status === "PENDING") {
              existing.status = "PENDING";
            } else if (
              existing.status === "REJECTED" ||
              req.status === "REJECTED"
            ) {
              existing.status = "REJECTED";
            }
            if (req.description && !existing.description.includes(req.description)) {
              existing.description = `${existing.description} | ${req.description}`;
            }
            return;
          } else {
            seenEmployeeDateRequests.set(key, req);
            if (req.status === "PENDING") {
              req.relatedRequestIds = [req.id];
            }
            consolidatedRequests.push(req);
            return;
          }
        }
        consolidatedRequests.push(req);
      });

      setApprovals(
        [
          ...consolidatedRequests,
          ...normalizedLvs,
          ...filteredAttendance,
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
  
  // Load permissions and approvals in parallel
  useEffect(() => {
    const loadData = async () => {
      try {
        // Try cached permissions first
        const cachedPerms = localStorage.getItem('employee_permissions');
        const cachedTimestamp = localStorage.getItem('employee_permissions_timestamp');
        const now = Date.now();
        
        // Use cache if less than 5 minutes old
        if (cachedPerms && cachedTimestamp && (now - parseInt(cachedTimestamp)) < 5 * 60 * 1000) {
          setPermissions(JSON.parse(cachedPerms));
          setLoadingPermissions(false);
          
          // Refresh in background
          apiGet("/roles-access/me/permissions").then(data => {
            const newPerms = data?.permissions || {};
            localStorage.setItem('employee_permissions', JSON.stringify(newPerms));
            localStorage.setItem('employee_permissions_timestamp', String(Date.now()));
            setPermissions(newPerms);
          }).catch(() => {});
        } else {
          // Load fresh permissions
          const permData = await apiGet("/roles-access/me/permissions").catch(() => ({ permissions: {} }));
          const perms = permData.permissions || {};
          localStorage.setItem('employee_permissions', JSON.stringify(perms));
          localStorage.setItem('employee_permissions_timestamp', String(Date.now()));
          setPermissions(perms);
          setLoadingPermissions(false);
        }
        
        // Load approvals (always fresh)
        await loadApprovals();
      } catch (err) {
        console.error("Failed to load data:", err);
        setPermissions({});
        setLoadingPermissions(false);
      }
    };
    loadData();
  }, []);

  // Silent background refresh every pollTick (every 5s from PollContext)
  useEffect(() => {
    if (pollTick === 0) return; // Skip the very first tick (initial load already handled above)
    // Only reload if no action is in progress (don't disrupt user mid-action)
    if (!actingId) {
      loadApprovals();
    }
  }, [pollTick]);

  // Keep saved attendance punches separate from the times requested for correction.
  useEffect(() => {
    if (!reasonModal || reasonModal.source !== "REQUEST") return;
    const date = reasonModal.correctionDetails?.date || reasonModal.date || reasonModal.subject?.match(/\d{4}-\d{2}-\d{2}/)?.[0] || reasonModal.description?.match(/\d{4}-\d{2}-\d{2}/)?.[0];
    const employeeId = reasonModal.employeeId || reasonModal.employee?.id;
    if (date && employeeId) {
      apiGet(`/attendance/by-date?date=${date}&employeeId=${employeeId}`)
        .then((res) => {
          if (res?.record) {
            setReasonModal((prev) => {
              if (!prev || prev.id !== reasonModal.id) return prev;
              const details = prev.correctionDetails || {};
              const checkInSource = getPunchLocationSource(
                prev,
                details,
                "checkIn",
              );
              const checkOutSource = getPunchLocationSource(
                prev,
                details,
                "checkOut",
              );
              const attDetails = getAttendanceDetails(res.record.note || "");
              const extractedReason = res.record.checkInReason || (attDetails?.checkInReason && !REASON_PLACEHOLDERS.includes(attDetails.checkInReason) ? attDetails.checkInReason : "") || (() => {
                const n = String(res.record.note || "");
                const m = n.match(/(?:Check-In Reason|Checkin Reason|Reason)\s*:\s*([^.\r\n|]+)/i)?.[1]?.trim();
                return m && !/^(?:unassigned location|outside assigned location|pending admin)/i.test(m) ? m : null;
              })() || null;

              return {
                ...prev,
                actualCheckInTime: res.record.checkInTime || null,
                actualCheckOutTime: res.record.checkOutTime || null,
                actualCheckInLatitude: res.record.checkInLatitude ?? null,
                actualCheckInLongitude: res.record.checkInLongitude ?? null,
                actualCheckOutLatitude: res.record.checkOutLatitude ?? null,
                actualCheckOutLongitude: res.record.checkOutLongitude ?? null,
                actualAttendanceNote: res.record.note || null,
                checkInReason: prev.checkInReason || extractedReason,
                correctionDetails: {
                  ...details,
                  checkInReason: details.checkInReason || extractedReason,
                  originalCheckInTime:
                    details.originalCheckInTime ||
                    (prev.status === "PENDING"
                      ? res.record.checkInTime
                      : null) ||
                    null,
                  originalCheckOutTime:
                    details.originalCheckOutTime ||
                    (prev.status === "PENDING"
                      ? res.record.checkOutTime
                      : null) ||
                    null,
                },
                ...(checkInSource !== "forgot-punch" && {
                  checkInLatitude: res.record.checkInLatitude ?? null,
                  checkInLongitude: res.record.checkInLongitude ?? null,
                }),
                ...(checkOutSource !== "forgot-punch" && {
                  checkOutLatitude: res.record.checkOutLatitude ?? null,
                  checkOutLongitude: res.record.checkOutLongitude ?? null,
                }),
              };
            });
          }
        })
        .catch(() => {});
    }
  }, [reasonModal?.id, pollTick]);

  const years = [
    ...new Set([
      currentYear,
      ...approvals
        .map((approval) => new Date(approval.createdAt || 0).getFullYear())
        .filter((year) => year > 1970),
    ]),
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
    
    // Apply type filter from category dropdown or URL params
    let matchesType = true;
    const effectiveCategory = categoryFilter !== "ALL" ? categoryFilter : (urlTypeFilter || "ALL");
    if (effectiveCategory === "attendance") {
      matchesType = approval.source === "ATTENDANCE";
    } else if (effectiveCategory === "forgot-punch") {
      matchesType = approval.source === "REQUEST" && approval.type === "CORRECTION";
    } else if (effectiveCategory === "tools-inventory" || effectiveCategory === "tools" || effectiveCategory === "equipment") {
      matchesType = approval.source === "REQUEST" && approval.type === "EQUIPMENT";
    } else if (effectiveCategory === "leave") {
      matchesType = approval.source === "LEAVE";
    }
    
    // Apply permission-based filtering
    let matchesPermission = true;
    if (!loadingPermissions && permissions) {
      const hasMainApprovals = permissions["approvals"]?.canView || permissions["approvals"] === true;
      const subAttendance = permissions["approvals-attendance"]?.canView || permissions["approvals-attendance"] === true;
      const subForgotPunch = permissions["approvals-forgot-punch"]?.canView || permissions["approvals-forgot-punch"] === true;
      const subLeave = permissions["approvals-leave"]?.canView || permissions["approvals-leave"] === true;
      const subTools = permissions["approvals-tools-inventory"]?.canView || permissions["approvals-tools-inventory"] === true || permissions["approvals-tools"]?.canView || permissions["approvals-tools"] === true;

      const hasAnySubPerm = subAttendance || subForgotPunch || subLeave || subTools;

      if (hasAnySubPerm) {
        if (approval.source === "ATTENDANCE" && !subAttendance) {
          matchesPermission = false;
        } else if (approval.source === "REQUEST") {
          if (approval.type === "EQUIPMENT" && !subTools) {
            matchesPermission = false;
          } else if (approval.type === "CORRECTION" && !subForgotPunch) {
            matchesPermission = false;
          } else if (!subForgotPunch && !subTools) {
            matchesPermission = false;
          }
        } else if (approval.source === "LEAVE" && !subLeave) {
          matchesPermission = false;
        }
      } else if (!hasMainApprovals) {
        // If neither specific sub-permissions nor main approvals exist, filter out
        matchesPermission = false;
      }
    }
    
    return matchesStatus && matchesYear && matchesMonth && matchesEmployee && matchesType && matchesPermission;
  });

  // Helper to determine whether the user can approve or reject a specific approval item
  const getApprovalPermissions = (approval) => {
    if (isAdmin) {
      return { canApprove: true, canReject: true };
    }

    let subKey = "approvals";
    if (approval.source === "LEAVE") {
      subKey = "approvals-leave";
    } else if (approval.source === "ATTENDANCE") {
      subKey = "approvals-attendance";
    } else if (approval.source === "REQUEST") {
      if (approval.type === "EQUIPMENT") {
        subKey = "approvals-tools-inventory";
      } else if (approval.type === "CORRECTION") {
        subKey = "approvals-forgot-punch";
      }
    }

    const subPerm = permissions?.[subKey] || permissions?.[subKey.replace("-inventory", "")];
    const mainPerm = permissions?.["approvals"];

    // canCreate represents "Approve", canDelete represents "Reject"
    const canApprove = Boolean(subPerm?.canCreate ?? mainPerm?.canCreate);
    const canReject = Boolean(subPerm?.canDelete ?? mainPerm?.canDelete);

    return { canApprove, canReject };
  };

  const review = async (approval, decision, reason = "") => {
    if (decision === "approve" && approval.source === "REQUEST" && approval.type === "EQUIPMENT") {
      const matchedInvItem = getInventoryItemLocation(approval);
      const isTaking = (approval.description || "").toLowerCase().includes("taking") || (approval.description || "").toLowerCase().includes("action type: taking");
      if (matchedInvItem && isTaking && matchedInvItem.quantity <= 0) {
        toast.error(
          `Cannot approve request: Product '${matchedInvItem.code || matchedInvItem.name}' is OUT OF STOCK (Available: 0 ${matchedInvItem.unit || "Nos"}). Please place the request on HOLD or restock inventory first.`
        );
        return;
      }
    }

    setActingId(`${approval.source}:${approval.id}`);
    try {
      const payload = {
        reason: reason || "",
        note: reason || "",
      };

      const requestIds =
        approval.source === "REQUEST" &&
        Array.isArray(approval.relatedRequestIds) &&
        approval.relatedRequestIds.length > 0
          ? approval.relatedRequestIds
          : [approval.id];
      let completedActions = 0;
      try {
        for (const requestId of requestIds) {
          const endpoint =
            approval.source === "LEAVE"
              ? `/leave/admin/${requestId}/${decision}`
              : approval.source === "ATTENDANCE"
                ? `/attendance/${decision}/${requestId}`
                : `/requests/${requestId}/${decision}`;
          await apiPost(endpoint, payload);
          completedActions += 1;
        }
      } catch (error) {
        if (completedActions > 0 && completedActions < requestIds.length) {
          throw new Error(
            `Combined approval was only partially processed (${completedActions} of ${requestIds.length} requests). ${error.message}`,
          );
        }
        throw error;
      }

      toast.success(
        requestIds.length > 1
          ? `Combined request ${decision === "approve" ? "approved" : "rejected"}.`
          : `Request ${decision === "approve" ? "approved" : "rejected"}.`,
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

  const attendanceDetails =
    (reasonModal?.source === "ATTENDANCE" || (reasonModal?.source === "REQUEST" && reasonModal?.correctionDetails))
      ? getAttendanceDetails(reasonModal.description)
      : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => navigate(-1)} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-secondary" aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <BadgeCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">
              {effectiveCategory === "attendance" 
                ? "Attendance Approvals" 
                : effectiveCategory === "forgot-punch" 
                ? "Forgot Punch / Time Edit Approvals" 
                : effectiveCategory === "tools-inventory" || effectiveCategory === "tools"
                ? "Tools & Inventory Approvals"
                : effectiveCategory === "leave" 
                ? "Leave Approvals" 
                : "Approvals"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {effectiveCategory === "attendance" 
                ? "Approve or reject attendance and location requests." 
                : effectiveCategory === "forgot-punch" 
                ? "Review employee check in, check out and time edit requests." 
                : effectiveCategory === "tools-inventory" || effectiveCategory === "tools"
                ? "Manage tools, equipment and inventory taking / return requests."
                : effectiveCategory === "leave" 
                ? "Approve or reject employee leave requests." 
                : "Approve or reject pending employee requests in one place."}
            </p>
            {/* Permission indicator */}
            {!loadingPermissions && permissions && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {(permissions["approvals-attendance"]?.canView || permissions["approvals-attendance"] === true) && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
                    <Shield className="h-3 w-3" />
                    Attendance
                  </span>
                )}
                {(permissions["approvals-forgot-punch"]?.canView || permissions["approvals-forgot-punch"] === true) && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    <Shield className="h-3 w-3" />
                    Forgot Punch / Time Edit
                  </span>
                )}
                {(permissions["approvals-leave"]?.canView || permissions["approvals-leave"] === true) && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                    <Shield className="h-3 w-3" />
                    Leave
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={loadApprovals}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-background card-shadow overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold"
            aria-label="Filter approvals by category"
          >
            <option value="ALL">All Categories</option>
            <option value="leave">Leave Approvals</option>
            <option value="forgot-punch">Forgot Punch / Time Edit</option>
            <option value="attendance">Unassigned Location</option>
            <option value="tools-inventory">Tools & Inventory</option>
          </select>
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
        {loadingPermissions ? (
          <div className="min-h-[260px]" />
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

                const isEquipment = approval.source === "REQUEST" && approval.type === "EQUIPMENT";
                const isLocationApproval =
                  approval.source === "ATTENDANCE" ||
                  approval.title?.toLowerCase().includes("location approval") ||
                  approval.title?.toLowerCase().includes("(ul)") || approval.title?.toLowerCase().includes("ul check") || approval.subject?.toLowerCase().includes("ul check") ||
                  approval.description?.toLowerCase().includes("unassigned location") ||
                  approval.description?.toLowerCase().includes("outside assigned location") ||
                  approval.correctionDetails?.checkInLocationSource === "unassigned-location" ||
                  approval.correctionDetails?.checkOutLocationSource === "unassigned-location";
                const isForgotPunch =
                  !isLocationApproval &&
                  (approval.type === "CORRECTION" ||
                   approval.title?.toLowerCase().includes("forgot punch") ||
                   approval.title?.toLowerCase().includes("time edit") ||
                   approval.description?.includes("[ATTENDANCE_CORRECTION]"));
                const isLeave = approval.source === "LEAVE" || approval.type === "LEAVE";

                // Determine icon and color based on category / request type
                const getSourceIcon = () => {
                  if (isEquipment) {
                    return <Package className="h-6 w-6" />;
                  }
                  if (isLocationApproval) {
                    return <MapPin className="h-6 w-6" />;
                  }
                  if (isForgotPunch) {
                    return <Clock3 className="h-6 w-6" />;
                  }
                  if (isLeave) {
                    return <Briefcase className="h-6 w-6" />;
                  }
                  return <FileText className="h-6 w-6" />;
                };

                const getSourceGradient = () => {
                  if (isEquipment) {
                    return "bg-gradient-to-br from-amber-500 to-amber-600";
                  }
                  if (isLocationApproval) {
                    return "bg-gradient-to-br from-rose-500 to-rose-600";
                  }
                  if (isForgotPunch) {
                    return "bg-gradient-to-br from-sky-500 to-blue-600";
                  }
                  if (isLeave) {
                    return "bg-gradient-to-br from-violet-500 to-violet-600";
                  }
                  return "bg-gradient-to-br from-blue-500 to-blue-600";
                };
                const isHold = isEquipment && approval.reviewNote?.includes("[ON_HOLD]");
                const returnStep = isEquipment ? getReturnStep(approval) : 0;
                const isProductFound = isEquipment && (returnStep === 4 || approval.reviewNote?.includes("[PRODUCT_FOUND]") || approval.status === "COMPLETED");
                const isItemNotFound = isEquipment && approval.reviewNote?.includes("[ITEM_NOT_FOUND]");

                let badgeLabel = approval.status;
                let badgeClass = approval.status === "PENDING"
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  : approval.status === "APPROVED"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400";
                let barClass = approval.status === "PENDING"
                  ? "bg-amber-500"
                  : approval.status === "APPROVED"
                    ? "bg-emerald-500"
                    : "bg-rose-500";

                if (isItemNotFound && !isProductFound) {
                  badgeLabel = "EMPLOYEE: ITEM NOT FOUND ✕";
                  badgeClass = "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 font-bold border border-rose-500/30";
                  barClass = "bg-rose-500";
                } else if (isHold) {
                  badgeLabel = "ON HOLD ⏸";
                  badgeClass = "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
                  barClass = "bg-amber-500";
                } else if (returnStep > 0) {
                  switch (returnStep) {
                    case 1:
                      badgeLabel = "Step 1: Return Pending Approval & Quality Test";
                      badgeClass = "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
                      barClass = "bg-amber-500";
                      break;
                    case 2:
                      badgeLabel = "Step 2: Quality Passed (Awaiting Employee Item Return)";
                      badgeClass = "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300";
                      barClass = "bg-purple-500";
                      break;
                    case 3:
                      badgeLabel = "Step 3: Employee Clicked Item Return (Ready for Found Item)";
                      badgeClass = "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
                      barClass = "bg-blue-600";
                      break;
                    case 4:
                      badgeLabel = "Step 4: Item Found & Restocked ✓";
                      badgeClass = "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
                      barClass = "bg-emerald-600";
                      break;
                  }
                } else if (isProductFound) {
                  badgeLabel = "COMPLETED ✓";
                  badgeClass = "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
                  barClass = "bg-emerald-600";
                }

                return (
                  <div
                    key={actionId}
                    className="group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-background to-secondary/10 shadow-sm transition hover:shadow-md hover:border-primary/20"
                  >
                    {/* Status Indicator Bar */}
                    <div
                      className={`absolute left-0 top-0 h-full w-1.5 ${barClass}`}
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
                                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
                                  isEquipment
                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                                    : isLocationApproval
                                      ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                                      : isForgotPunch
                                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                        : isLeave
                                          ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                                          : "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400"
                                }`}
                              >
                                {isEquipment ? (
                                  <Package className="h-3.5 w-3.5" />
                                ) : isLocationApproval ? (
                                  <MapPin className="h-3.5 w-3.5" />
                                ) : isForgotPunch ? (
                                  <Clock3 className="h-3.5 w-3.5" />
                                ) : isLeave ? (
                                  <Briefcase className="h-3.5 w-3.5" />
                                ) : (
                                  <FileText className="h-3.5 w-3.5" />
                                )}
                                <span>
                                  {isEquipment
                                    ? "Inventory / Tool"
                                    : isLocationApproval && (approval.subject?.toLowerCase().includes("time edit") || approval.title?.toLowerCase().includes("time edit"))
                                      ? "Location (UL) + Time Edit"
                                      : isLocationApproval
                                        ? "Location (UL)"
                                        : isForgotPunch
                                          ? "Forgot Punch"
                                          : isLeave
                                            ? "Leave"
                                            : "Request"}
                                </span>
                              </span>
                              <span
                                className={`rounded-xl px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${badgeClass}`}
                              >
                                {badgeLabel}
                              </span>
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Calendar className="h-3.5 w-3.5" />
                                {formatDate(approval.createdAt)}
                              </span>
                            </div>

                            {/* Title */}
                            <FormattedInventoryTitle
                              title={getApprovalDisplayTitle(approval)}
                              className="mt-3"
                            />

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

                            {/* Action Buttons Row: View Reason & View Location */}
                            {(() => {
                              const matchedInvItem = (approval.source === "REQUEST" && approval.type === "EQUIPMENT") ? getInventoryItemLocation(approval) : null;
                              const isLocationOpen = openLocationIds.has(approval.id);
                              const isCorrectionRequest =
                                approval.source === "REQUEST" &&
                                approval.type === "CORRECTION";
                              const isLocationCorrection =
                                isCorrectionRequest &&
                                (approval.title?.toLowerCase().includes("location approval") ||
                                  approval.title?.toLowerCase().includes("(ul)") ||
                                  approval.subject?.toLowerCase().includes("approval") ||
                                  approval.description?.toLowerCase().includes("unassigned location") ||
                                  approval.description?.toLowerCase().includes("outside assigned location") ||
                                  approval.correctionDetails?.checkInLocationSource === "unassigned-location" ||
                                  approval.correctionDetails?.checkOutLocationSource === "unassigned-location");
                              const canShowPunchLocation =
                                !isCorrectionRequest || isLocationCorrection;
                              const hasForgotPunchCheckInLocation = Boolean(
                                String(
                                  approval.correctionDetails?.checkInLocation ||
                                    "",
                                ).trim(),
                              );
                              const hasForgotPunchCheckOutLocation = Boolean(
                                String(
                                  approval.correctionDetails?.checkOutLocation ||
                                    "",
                                ).trim(),
                              );

                              // Only show check-in/out location for the punches this request actually covers
                              const cardPunchType = String(
                                approval.correctionDetails?.punchType ||
                                  approval.punchType ||
                                  "",
                              ).toLowerCase();
                              const cardIncludesCheckIn =
                                cardPunchType === "check-in" ||
                                cardPunchType.includes("check in") ||
                                cardPunchType === "both" ||
                                approval.correctionDetails?.checkInLocationSource === "unassigned-location" ||
                                approval.correctionDetails?.checkInLocationSource === "forgot-punch";
                              const cardIncludesCheckOut =
                                cardPunchType === "check-out" ||
                                cardPunchType.includes("check out") ||
                                cardPunchType === "both" ||
                                approval.correctionDetails?.checkOutLocationSource === "unassigned-location" ||
                                approval.correctionDetails?.checkOutLocationSource === "forgot-punch";

                              return (
                                <div className="mt-3 space-y-3">
                                  <div className="flex items-center gap-2.5 flex-wrap">
                                    {/* View Reason Button */}
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setReasonModal(approval);
                                      }}
                                      className="inline-flex items-center gap-2 rounded-xl bg-secondary/80 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-primary/10 hover:text-primary w-fit cursor-pointer"
                                    >
                                      <MessageSquareText className="h-4 w-4" />
                                      <span>View Reason</span>
                                    </button>

                                    {/* Attendance Check-in GPS Location Button (UL/location approval only) */}
                                    {cardIncludesCheckIn && canShowPunchLocation && !isCorrectionRequest && approval.correctionDetails?.checkInLocationSource !== "forgot-punch" && approval.checkInLatitude != null && approval.checkInLongitude != null && (
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          openCheckInMap(approval);
                                        }}
                                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 px-3.5 py-2 text-xs font-semibold transition hover:bg-emerald-500/20 w-fit cursor-pointer"
                                      >
                                        <MapPin className="h-3.5 w-3.5" />
                                        <span>Check-In Location</span>
                                      </button>
                                    )}

                                    {/* Manual location text is shown inside the View Reason modal only */}

                                    {/* Attendance Check-out GPS Location Button (UL/location approval only) */}
                                    {cardIncludesCheckOut && canShowPunchLocation && !isCorrectionRequest && approval.correctionDetails?.checkOutLocationSource !== "forgot-punch" && approval.checkOutLatitude != null && approval.checkOutLongitude != null && (
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          openCheckOutMap(approval);
                                        }}
                                        className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 px-3.5 py-2 text-xs font-semibold transition hover:bg-rose-500/20 w-fit cursor-pointer"
                                      >
                                        <MapPin className="h-3.5 w-3.5" />
                                        <span>Check-Out Location</span>
                                      </button>
                                    )}

                                    {/* Manual typed check-out location shown in modal only */}

                                    {/* View Location Button (Inventory item) */}
                                    {matchedInvItem && (
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setOpenLocationIds((prev) => {
                                            const next = new Set(prev);
                                            if (next.has(approval.id)) {
                                              next.delete(approval.id);
                                            } else {
                                              next.add(approval.id);
                                            }
                                            return next;
                                          });
                                        }}
                                        className="inline-flex items-center gap-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-4 py-2 text-sm font-semibold transition hover:bg-blue-500/20 w-fit cursor-pointer"
                                      >
                                        <MapPin className="h-4 w-4" />
                                        <span>{isLocationOpen ? "Hide Location" : "View Location"}</span>
                                      </button>
                                    )}
                                  </div>

                                  {/* Toggled Warehouse & Storage Location Details */}
                                  {matchedInvItem && isLocationOpen && (() => {
                                    const isOutOfStock = matchedInvItem.quantity <= 0;
                                    return (
                                      <div className={`p-3 rounded-xl border text-xs space-y-1 transition-all animate-in fade-in slide-in-from-top-1 ${isOutOfStock ? "bg-rose-500/10 border-rose-500/30" : "bg-blue-500/10 border-blue-500/20"}`}>
                                        <div className="flex items-center justify-between font-bold">
                                          <span className={`flex items-center gap-1.5 ${isOutOfStock ? "text-rose-900 dark:text-rose-300" : "text-blue-900 dark:text-blue-300"}`}>
                                            <Package className={`h-4 w-4 shrink-0 ${isOutOfStock ? "text-rose-600" : "text-blue-600"}`} />
                                            Warehouse Location & Stock Info:
                                          </span>
                                          <span className={`px-2 py-0.5 rounded text-white text-[11px] font-bold ${isOutOfStock ? "bg-rose-600 animate-pulse" : "bg-blue-600"}`}>
                                            {isOutOfStock ? `⚠️ OUT OF STOCK (${matchedInvItem.quantity} ${matchedInvItem.unit || "Nos"})` : `${matchedInvItem.quantity} ${matchedInvItem.unit || "Nos"} in Stock`}
                                          </span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-foreground pt-1 font-medium">
                                          <div>
                                            <span className="text-muted-foreground">Warehouse: </span>
                                            <span className="font-bold text-blue-700 dark:text-blue-400">{matchedInvItem.warehouse || "Main Warehouse"}</span>
                                          </div>
                                          <div>
                                            <span className="text-muted-foreground">Rack / Shelf: </span>
                                            <span className="font-bold text-foreground">{matchedInvItem.location || "Store Rack"}</span>
                                          </div>
                                        </div>
                                        {isOutOfStock && (
                                          <div className="mt-1 pt-1 border-t border-rose-500/20 text-rose-700 dark:text-rose-400 font-bold text-[11px] flex items-center gap-1">
                                            ⚠️ Approval disabled — Product is currently out of stock. Place request on HOLD or restock inventory first.
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Action Buttons - Right Side */}
                        <div className="flex shrink-0 flex-wrap items-center gap-2.5 lg:flex-col lg:items-stretch">
                          {returnStep === 1 ? (
                            <div className="flex w-full gap-2 flex-wrap sm:flex-nowrap">
                              <button
                                type="button"
                                onClick={() => {
                                  setQualityModal(approval);
                                  setQualityCondition("Good Condition - Restock to Warehouse Stock");
                                  setQualityRemarks("Quality inspected and verified by Admin.");
                                }}
                                disabled={acting}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-purple-500/20 transition hover:from-purple-700 hover:to-indigo-700 cursor-pointer disabled:opacity-60"
                              >
                                <span key={acting ? "step2-loading" : "step2-icon"} className="inline-flex items-center justify-center">
                                  {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
                                </span>
                                <span>Quality Test & Approve</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setRejectModal({ approval })}
                                disabled={acting}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-rose-300 bg-white px-4 py-2.5 text-sm font-bold text-rose-700 transition hover:bg-rose-50 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed dark:bg-background dark:hover:bg-rose-950/20 cursor-pointer"
                              >
                                <span key="reject-step1-icon" className="inline-flex items-center justify-center">
                                  <X className="h-4 w-4" />
                                </span>
                                <span>Reject</span>
                              </button>
                            </div>
                          ) : returnStep === 2 ? (
                            <div className="flex flex-col gap-2 w-full">
                              <div className="text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-3 py-2 rounded-xl border border-purple-200 dark:border-purple-800 flex items-center gap-1.5">
                                <CheckCheck className="h-4 w-4 text-purple-600 shrink-0" />
                                <span>Quality Tested ✓ Awaiting Employee to click <strong>Item Return</strong></span>
                              </div>
                            </div>
                          ) : returnStep === 3 ? (
                            <div className="flex flex-col gap-2 w-full">
                              <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5 animate-pulse">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                <span>Employee pushed "Item Return"! Ready to restock</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAdminFoundItem(approval)}
                                disabled={acting}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition hover:from-emerald-700 hover:to-teal-700 cursor-pointer disabled:opacity-60 ring-2 ring-emerald-500/40"
                              >
                                <span key={acting ? "found-loading" : "found-icon"} className="inline-flex items-center justify-center">
                                  {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
                                </span>
                                <span>Product Found</span>
                              </button>
                            </div>
                          ) : approval.status === "PENDING" ? (
                            <>
                              {/* Standard Approve/Hold/Reject Buttons for non-return requests */}
                              {(() => {
                                const { canApprove, canReject } = getApprovalPermissions(approval);
                                return (
                                  <div className="flex w-full gap-2 flex-wrap sm:flex-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => review(approval, "approve")}
                                      disabled={acting || !canApprove}
                                      className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-lg transition ${
                                        !canApprove
                                          ? "bg-emerald-600/50 opacity-60 cursor-not-allowed"
                                          : "bg-gradient-to-r from-emerald-600 to-emerald-700 shadow-emerald-500/20 hover:from-emerald-700 hover:to-emerald-800 hover:shadow-xl cursor-pointer"
                                      }`}
                                      title={!canApprove ? "View-only access: you cannot approve this request." : "Approve request"}
                                    >
                                      <span key={acting ? "approve-loading" : "approve-icon"} className="inline-flex items-center justify-center">
                                        {acting ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Check className="h-4 w-4" />
                                        )}
                                      </span>
                                      <span>Approve</span>
                                    </button>

                                    {approval.source === "REQUEST" && approval.type === "EQUIPMENT" && (
                                      <button
                                        type="button"
                                        onClick={() => setHoldModal({ approval })}
                                        disabled={acting || !canApprove}
                                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-amber-300 bg-amber-500/10 px-3 py-2.5 text-xs font-bold text-amber-700 transition dark:text-amber-400 ${
                                          !canApprove
                                            ? "opacity-60 cursor-not-allowed"
                                            : "hover:bg-amber-500/20 cursor-pointer"
                                        }`}
                                        title={!canApprove ? "View-only access: you cannot hold this request." : "Put request on hold due to product out of stock"}
                                      >
                                        <span key="hold-btn-icon" className="inline-flex items-center justify-center">
                                          <PauseCircle className="h-4 w-4" />
                                        </span>
                                        <span>Hold (Out of Stock)</span>
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => setRejectModal({ approval })}
                                      disabled={acting || !canReject}
                                      className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-rose-300 bg-white px-4 py-2.5 text-sm font-bold text-rose-700 transition dark:bg-background ${
                                        !canReject
                                          ? "opacity-60 cursor-not-allowed"
                                          : "hover:bg-rose-50 hover:shadow-md dark:hover:bg-rose-950/20 cursor-pointer"
                                      }`}
                                      title={!canReject ? "View-only access: you cannot reject this request." : "Reject request"}
                                    >
                                      <span key="reject-btn-icon" className="inline-flex items-center justify-center">
                                        <X className="h-4 w-4" />
                                      </span>
                                      <span>Reject</span>
                                    </button>
                                  </div>
                                );
                              })()}
                            </>
                          ) : (
                            <div className="flex w-full items-center justify-center rounded-xl px-4 py-3 text-center min-w-[140px] bg-secondary/50 border border-border">
                              <div className="text-xs">
                                <div className={`font-semibold ${
                                  isItemNotFound
                                    ? "text-rose-600 dark:text-rose-400 font-bold"
                                    : isProductFound
                                    ? "text-emerald-600 dark:text-emerald-400 font-bold"
                                    : approval.status === "APPROVED"
                                    ? "text-emerald-600 dark:text-emerald-400 font-bold"
                                    : "text-muted-foreground"
                                }`}>
                                  {isItemNotFound
                                    ? "EMPLOYEE: ITEM NOT FOUND ✕"
                                    : isProductFound
                                    ? "Completed / Product Found ✓"
                                    : approval.status === "APPROVED"
                                    ? returnStep > 0
                                      ? "Approved (Awaiting Return Handover)"
                                      : isEquipment
                                      ? "Approved (Awaiting Employee Confirmation)"
                                      : "Approved ✓"
                                    : "Rejected"}
                                </div>
                                {isAdmin && (
                                  <div className="mt-0.5 font-bold text-foreground truncate max-w-[150px]" title={`By: ${getReviewerInfo(approval)}`}>
                                    By: {getReviewerInfo(approval)}
                                  </div>
                                )}
                                <div className="mt-1 text-[11px] text-muted-foreground">
                                  {formatDate(approval.reviewedAt || approval.createdAt)} • {formatTimeIST(approval.reviewedAt || approval.createdAt)}
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
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-2xl">
            {/* ================= HEADER ================= */}
            <div className="flex shrink-0 items-center justify-between border-b border-border bg-background px-4 py-4 sm:px-6 sm:py-5">
              <div className="flex items-center gap-4 min-w-0">
                {(() => {
                  const isEq = reasonModal.source === "REQUEST" && reasonModal.type === "EQUIPMENT";
                  const isLoc =
                    reasonModal.source === "ATTENDANCE" ||
                    reasonModal.title?.toLowerCase().includes("location approval") || reasonModal.title?.toLowerCase().includes("ul check") || reasonModal.subject?.toLowerCase().includes("ul check") ||
                    reasonModal.description?.toLowerCase().includes("unassigned location") ||
                    reasonModal.description?.toLowerCase().includes("outside assigned location");
                  const isFP =
                    !isLoc &&
                    (reasonModal.type === "CORRECTION" ||
                     reasonModal.title?.toLowerCase().includes("forgot punch") ||
                     reasonModal.title?.toLowerCase().includes("time edit") ||
                     reasonModal.description?.includes("[ATTENDANCE_CORRECTION]"));
                  const isLv = reasonModal.source === "LEAVE" || reasonModal.type === "LEAVE";

                  const iconBoxClass = isEq
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                    : isLoc
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                      : isFP
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                        : isLv
                          ? "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400"
                          : "bg-primary/10 text-primary";

                  const IconComponent = isEq ? Package : isLoc ? MapPin : isFP ? Clock3 : isLv ? Briefcase : MessageSquareText;

                  return (
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm ${iconBoxClass}`}>
                      <IconComponent className="h-5 w-5" />
                    </div>
                  );
                })()}

                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Approval Details
                  </p>

                  <FormattedInventoryTitle
                    title={getApprovalDisplayTitle(reasonModal)}
                    className="mt-1"
                  />
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
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
              {/* ================= EMPLOYEE ================= */}
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
                  (() => {
                    const forgotPunch = reasonModal.correctionDetails || {};
                    const punchType = String(forgotPunch.punchType || reasonModal.punchType || "").toLowerCase();
                    const isCombinedPunch = punchType === "both" || (punchType.includes("check in") && punchType.includes("check out"));
                    const dateLabel = (() => {
                      const m = String(forgotPunch.date || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
                      return m ? m[3] + "/" + m[2] + "/" + m[1] : (forgotPunch.date || "—");
                    })();
                    const isTimeEditRequest = forgotPunch.isTimeEdit || punchType === "time-edit" || punchType === "time edit" || String(reasonModal.subject || "").toLowerCase().includes("time edit");
                    const descText = String(reasonModal.description || "");
                    const parsedCheckInFromDesc = descText.match(/at check-in\s+([0-9]{1,2}:[0-9]{2}(?:\s*[AaPp][Mm])?)/i)?.[1]?.trim() || null;
                    const parsedCheckOutFromDesc = descText.match(/(?:and|at)\s+check-out\s+([0-9]{1,2}:[0-9]{2}(?:\s*[AaPp][Mm])?)/i)?.[1]?.trim() || null;

                    const teType = forgotPunch.timeEditPunchType || forgotPunch.timeEditType ||
                      (forgotPunch.checkInTime && !forgotPunch.checkOutTime ? "check-in" :
                       forgotPunch.checkOutTime && !forgotPunch.checkInTime ? "check-out" :
                       (descText.includes("at check-in") && !descText.includes("at check-out") && !descText.includes("and check-out") ? "check-in" :
                        descText.includes("at check-out") && !descText.includes("at check-in") ? "check-out" : null));

                    const actualCheckInTime = reasonModal.actualCheckInTime || null;
                    const actualCheckOutTime = reasonModal.actualCheckOutTime || null;

                    const checkInTime = isTimeEditRequest
                      ? (forgotPunch.checkInTime || parsedCheckInFromDesc || actualCheckInTime)
                      : (actualCheckInTime || forgotPunch.checkInTime);
                    const checkOutTime = isTimeEditRequest
                      ? (forgotPunch.checkOutTime || parsedCheckOutFromDesc || actualCheckOutTime)
                      : (actualCheckOutTime || forgotPunch.checkOutTime);

                    const origCheckInTime = forgotPunch.originalCheckInTime || (isTimeEditRequest && actualCheckInTime && formatTimeIST(actualCheckInTime) !== formatTimeIST(checkInTime) ? actualCheckInTime : null);
                    const origCheckOutTime = forgotPunch.originalCheckOutTime || (isTimeEditRequest && actualCheckOutTime && formatTimeIST(actualCheckOutTime) !== formatTimeIST(checkOutTime) ? actualCheckOutTime : null);

                    const hasCheckInEdit = isTimeEditRequest && (teType === "check-in" || teType === "both" || Boolean(origCheckInTime));
                    const hasCheckOutEdit = isTimeEditRequest && (teType === "check-out" || teType === "both" || Boolean(origCheckOutTime));

                    const showCheckInTime = Boolean(checkInTime);
                    const showCheckOutTime = Boolean(checkOutTime);

                    const _isCheckOutOnly = isTimeEditRequest ? (teType === "check-out" && !showCheckInTime) : (punchType === "check-out" || (punchType.includes("check out") && !punchType.includes("check in")));
                    const _isCheckInOnly  = isTimeEditRequest ? (teType === "check-in" && !showCheckOutTime) : (punchType === "check-in"  || (punchType.includes("check in")  && !punchType.includes("check out")));

                    const checkInLocSrc = _isCheckOutOnly && (actualCheckInTime || forgotPunch.checkInTime)
                      ? "default-location"
                      : getPunchLocationSource(reasonModal, forgotPunch, "checkIn");
                    const checkOutLocSrc = getPunchLocationSource(reasonModal, forgotPunch, "checkOut");

                    const punchTypeLabel = (() => {
                      if (isTimeEditRequest) {
                        if (hasCheckInEdit && hasCheckOutEdit) return "Check In + Check Out (Time Edit)";
                        if (hasCheckInEdit) return showCheckOutTime ? "Check In (Time Edit) + Check Out" : "Check In (Time Edit)";
                        if (hasCheckOutEdit) return showCheckInTime ? "Check In + Check Out (Time Edit)" : "Check Out (Time Edit)";
                        return "Time Edit";
                      }
                      if (punchType === "both" || (showCheckInTime && showCheckOutTime)) return "Check In + Check Out";
                      if (showCheckOutTime && !showCheckInTime) return "Check Out";
                      return "Check In";
                    })();
                    const readLoc = (label) => {
                      const desc = String(reasonModal.description || "");
                      const readable = desc.split("[ATTENDANCE_CORRECTION]")[0];
                      const fromText = readable.match(new RegExp("(?:^|\\n)\\s*Check-" + label + " Location:\\s*([^\\r\\n]+)", "i"))?.[1]?.trim();
                      if (fromText) return fromText;
                      const meta = desc.split("[ATTENDANCE_CORRECTION]").at(-1)?.trim();
                      if (meta) { try { return String(JSON.parse(meta)[label === "In" ? "checkInLocation" : "checkOutLocation"] || "").trim(); } catch { return ""; } }
                      return "";
                    };
                    const checkInLocation  = String(readLoc("In")  || forgotPunch.checkInLocation  || "").trim();
                    const checkOutLocation = String(readLoc("Out") || forgotPunch.checkOutLocation || "").trim();
                    const checkInLat  = checkInLocSrc  === "forgot-punch" ? null : (reasonModal.actualCheckInLatitude  ?? forgotPunch.checkInLatitude  ?? reasonModal.checkInLatitude);
                    const checkInLng  = checkInLocSrc  === "forgot-punch" ? null : (reasonModal.actualCheckInLongitude ?? forgotPunch.checkInLongitude ?? reasonModal.checkInLongitude);
                    const checkOutLat = checkOutLocSrc === "forgot-punch" ? null : (reasonModal.actualCheckOutLatitude  ?? forgotPunch.checkOutLatitude  ?? reasonModal.checkOutLatitude);
                    const checkOutLng = checkOutLocSrc === "forgot-punch" ? null : (reasonModal.actualCheckOutLongitude ?? forgotPunch.checkOutLongitude ?? reasonModal.checkOutLongitude);
                    const checkInUsesMap  = checkInLat  != null && Number.isFinite(Number(checkInLat))  && checkInLocSrc  === "unassigned-location";
                    const checkOutUsesMap = checkOutLat != null && Number.isFinite(Number(checkOutLat)) && checkOutLocSrc === "unassigned-location";
                    // For checkout-only forgot-punch, don't fabricate a default check-in location card
                    const isForgotPunchCheckOut = _isCheckOutOnly && checkOutLocSrc === "forgot-punch";
                    const effCheckInSrc  = checkInLocSrc  || (!isForgotPunchCheckOut && _isCheckOutOnly && actualCheckInTime  && !checkInUsesMap  ? "default-location" : null);
                    // For check-in-only forgot-punch, don't fabricate a default check-out location card
                    const isForgotPunchCheckIn = _isCheckInOnly && checkInLocSrc === "forgot-punch";
                    const effCheckOutSrc = checkOutLocSrc || (!isForgotPunchCheckIn && _isCheckInOnly  && actualCheckOutTime && !checkOutUsesMap ? "default-location" : null);
                    const showCheckInLoc  = checkInUsesMap  || Boolean(checkInLocation)  || effCheckInSrc  === "default-location";
                    const showCheckOutLoc = checkOutUsesMap || Boolean(checkOutLocation) || effCheckOutSrc === "default-location";
                    const REASON_PLACEHOLDERS = ["No check-in reason provided.","No check-out reason provided.","No reason provided.","No reason provided for check-out."];
                    const cleanR = (v) => {
                      const s = String(v||"").trim();
                      if (!s || REASON_PLACEHOLDERS.includes(s) || /^(?:Time Edit|Forgot Punch) request for/i.test(s)) {
                        return "";
                      }
                      return s;
                    };

                    const descMatchReason = String(reasonModal.description || "").match(/(?:Check-In Reason|Checkin Reason|Reason)\s*:\s*([^.\r\n|]+)/i)?.[1]?.trim() || "";
                    const safeDescReason = descMatchReason && !/^(?:unassigned location|outside assigned location|pending admin|time edit request)/i.test(descMatchReason) ? descMatchReason : "";
                    const noteMatchReason = String(reasonModal.actualAttendanceNote || reasonModal.note || forgotPunch.note || "").match(/(?:Check-In Reason|Reason)\s*:\s*([^.\r\n|]+)/i)?.[1]?.trim() || "";
                    const safeNoteReason = noteMatchReason && !/^(?:unassigned location|outside assigned location|pending admin|time edit request)/i.test(noteMatchReason) ? noteMatchReason : "";

                    const candidateForgotReason = String(forgotPunch.reason || "").trim();
                    const isAutomatedForgotReason = /^(?:unassigned location|outside assigned location|time edit request|no reason)/i.test(candidateForgotReason);
                    const safeForgotReason = !isAutomatedForgotReason ? candidateForgotReason : "";

                    const attDetails = getAttendanceDetails(reasonModal.actualAttendanceNote || reasonModal.note || forgotPunch.note || "");
                    const safeAttReason = attDetails?.checkInReason && !REASON_PLACEHOLDERS.includes(attDetails.checkInReason) ? attDetails.checkInReason : "";

                    const isPureCombinedForgotPunch = !isTimeEditRequest && (punchType === "both" || (!forgotPunch.checkInReason && !forgotPunch.checkOutReason));
                    const sameSharedForgotReason = isPureCombinedForgotPunch && safeForgotReason ? safeForgotReason : null;

                    const rawCheckInReason =
                      sameSharedForgotReason ||
                      safeAttReason ||
                      forgotPunch.checkInReason ||
                      reasonModal.checkInReason ||
                      safeDescReason ||
                      safeNoteReason ||
                      safeForgotReason ||
                      "";
                    const checkInReason  = cleanR(cleanPureReason(rawCheckInReason, ""));
                    const rawCheckOutReason =
                      sameSharedForgotReason ||
                      forgotPunch.checkOutReason ||
                      String(reasonModal.description || "").match(/(?:Check-Out Reason|Checkout Reason)\s*:\s*([^\r\n|]+)/i)?.[1]?.trim() ||
                      (!isTimeEditRequest && _isCheckOutOnly ? forgotPunch.reason : "");
                    const checkOutReason = cleanR(cleanPureReason(rawCheckOutReason, ""));

                    const timeEditReason = cleanR(forgotPunch.timeEditReason || String(reasonModal.description || "").match(/Time Edit Reason\s*:\s*([^\r\n|]+)/i)?.[1]?.trim() || "");
                    const reqReason = isTimeEditRequest ? timeEditReason : cleanR(cleanPureReason(forgotPunch.reason, reasonModal.description));
                    const renderLocCard = (label, location, lat, lng, source, usesMap, tone) => {
                      if (!usesMap && !Boolean(location) && source !== "default-location") return null;
                      const em = tone === "emerald";
                      return (
                        <div className={em ? "rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white p-4 dark:border-emerald-900/40 dark:from-emerald-950/30 dark:to-background" : "rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50/80 to-white p-4 dark:border-rose-900/40 dark:from-rose-950/30 dark:to-background"}>
                          <p className={em ? "text-xs font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-400" : "text-xs font-bold uppercase tracking-wide text-rose-800 dark:text-rose-400"}>{label}</p>
                          {usesMap ? (
                            <button type="button" onClick={() => window.open("https://www.google.com/maps?q=" + lat + "," + lng, "_blank", "noopener,noreferrer")}
                              className={em ? "mt-3 inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-800 shadow-sm transition hover:bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "mt-3 inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-800 shadow-sm transition hover:bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"}>
                              <MapPin className="h-3.5 w-3.5" /> View on Google Maps
                            </button>
                          ) : source === "default-location" ? (
                            <p className="mt-3 break-words rounded-lg bg-white/80 px-3 py-2 text-sm font-semibold text-foreground dark:bg-background/70">Office <span className="text-xs font-normal text-muted-foreground">(Default)</span></p>
                          ) : (
                            <p className="mt-3 break-words rounded-lg bg-white/80 px-3 py-2 text-sm font-semibold text-foreground dark:bg-background/70">{location}</p>
                          )}
                        </div>
                      );
                    };
                    return (
                      <div className="space-y-3">
                        <div className="grid gap-x-5 gap-y-4 rounded-2xl border border-border bg-background p-4 shadow-sm sm:grid-cols-2">
                          <div><p className="text-xs font-semibold text-muted-foreground">Date</p><p className="mt-1 text-sm font-semibold text-foreground">{dateLabel}</p></div>
                          <div><p className="text-xs font-semibold text-muted-foreground">Punch Type</p><p className="mt-1 text-sm font-semibold text-foreground">{punchTypeLabel}</p></div>
                          {showCheckInTime && checkInTime && (
                            <div>
                              <p className={isTimeEditRequest ? "text-xs font-bold text-emerald-700 dark:text-emerald-300" : "text-xs font-semibold text-muted-foreground"}>
                                {isTimeEditRequest ? "Requested Check-in Time" : checkInLocSrc === "forgot-punch" ? "Check-in Time (Forgot Punch)" : checkInLocSrc === "unassigned-location" ? "Check-in Time (UL)" : "Check-in Time"}
                              </p>
                              <p className="mt-1 inline-flex rounded-md bg-emerald-500/10 px-2 py-1 text-sm font-bold text-emerald-700 dark:text-emerald-300">{formatTimeIST(checkInTime)}</p>
                              {isTimeEditRequest && (origCheckInTime || actualCheckInTime) && (
                                <>
                                  <p className="mt-2 text-xs font-semibold text-muted-foreground">Previous Check-in Time</p>
                                  <p className="mt-1 inline-flex rounded-md bg-secondary px-2 py-1 text-sm font-semibold text-foreground">
                                    {formatTimeIST(origCheckInTime || actualCheckInTime)}
                                  </p>
                                </>
                              )}
                            </div>
                          )}
                          {showCheckOutTime && checkOutTime && (
                            <div>
                              <p className={isTimeEditRequest ? "text-xs font-bold text-rose-700 dark:text-rose-300" : "text-xs font-semibold text-muted-foreground"}>
                                {isTimeEditRequest ? "Requested Check-out Time" : checkOutLocSrc === "forgot-punch" ? "Check-out Time (Forgot Punch)" : checkOutLocSrc === "unassigned-location" ? "Check-out Time (UL)" : effCheckOutSrc === "default-location" ? "Check-out Time (Marked Attendance)" : "Check-out Time"}
                              </p>
                              <p className="mt-1 inline-flex rounded-md bg-rose-500/10 px-2 py-1 text-sm font-bold text-rose-700 dark:text-rose-300">{formatTimeIST(checkOutTime)}</p>
                              {isTimeEditRequest && origCheckOutTime && <><p className="mt-2 text-xs font-semibold text-muted-foreground">Previous Check-out Time</p><p className="mt-1 inline-flex rounded-md bg-secondary px-2 py-1 text-sm font-semibold text-foreground">{formatTimeIST(origCheckOutTime)}</p></>}
                            </div>
                          )}
                        </div>
                        {(showCheckInLoc || showCheckOutLoc) && (
                          <div className={showCheckInLoc && showCheckOutLoc ? "grid gap-3 sm:grid-cols-2" : "grid gap-3 grid-cols-1"}>
                            {renderLocCard("Check-In Location",  checkInLocation,  checkInLat,  checkInLng,  effCheckInSrc,  checkInUsesMap,  "emerald")}
                            {renderLocCard("Check-Out Location", checkOutLocation, checkOutLat, checkOutLng, effCheckOutSrc, checkOutUsesMap, "rose")}
                          </div>
                        )}
                        {(checkInReason || checkOutReason) && (
                          checkInReason && checkOutReason && checkInReason === checkOutReason ? (
                            <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 dark:border-blue-900/40 dark:bg-blue-950/20">
                              <p className="text-xs font-bold text-blue-800 dark:text-blue-400">Reason</p>
                              <p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium leading-5 text-foreground">{checkInReason}</p>
                            </div>
                          ) : (
                            <div className="grid gap-3 sm:grid-cols-2">
                              {checkInReason  && <div className={"rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20" + (!checkOutReason ? " sm:col-span-2" : "")}><p className="text-xs font-bold text-emerald-800 dark:text-emerald-400">Check-In Reason</p><p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium leading-5 text-foreground">{checkInReason}</p></div>}
                              {checkOutReason && <div className={"rounded-xl border border-rose-200 bg-rose-50/40 p-3 dark:border-rose-900/40 dark:bg-rose-950/20"    + (!checkInReason  ? " sm:col-span-2" : "")}><p className="text-xs font-bold text-rose-800 dark:text-rose-400">Check-Out Reason</p><p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium leading-5 text-foreground">{checkOutReason}</p></div>}
                            </div>
                          )
                        )}
                        {timeEditReason && (
                          <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3 dark:border-sky-900/50 dark:bg-sky-950/20">
                            <p className="text-xs font-bold text-sky-800 dark:text-sky-300">Time Edit Reason</p>
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium leading-5 text-foreground">{timeEditReason}</p>
                          </div>
                        )}
                        {!isTimeEditRequest && !checkInReason && !checkOutReason && reqReason && (
                          <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3 dark:border-sky-900/50 dark:bg-sky-950/20">
                            <p className="text-xs font-bold text-sky-800 dark:text-sky-300">Reason</p>
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium leading-5 text-foreground">{reqReason}</p>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : reasonModal.source === "ATTENDANCE" ? (
                  <div className="space-y-4">
                        {/* 1. CHECK-IN DIV */}
                        {attendanceDetails?.isCheckInUnassigned && (
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
                        )}

                        {/* 2. CHECK-OUT DIV */}
                        {attendanceDetails?.isCheckOutUnassigned && (reasonModal.checkOutTime ||
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
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-border bg-secondary/20 px-4 py-4">
                      <p className="mb-2 text-xs font-semibold text-muted-foreground">
                        Employee Reason / Request Details
                      </p>
                      <RenderFormattedDetails text={getReadableReason(reasonModal).reason} />
                    </div>

                    {reasonModal.source === "REQUEST" && (() => {
                      const modalInvItem = getInventoryItemLocation(reasonModal);
                      if (!modalInvItem) return null;
                      return (
                        <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/25 text-xs space-y-2">
                          <div className="flex items-center justify-between font-bold text-blue-900 dark:text-blue-300">
                            <span className="flex items-center gap-2 text-sm">
                              <Package className="h-5 w-5 text-blue-600 shrink-0" />
                              Warehouse Location & Stock Status
                            </span>
                            <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-bold shadow-xs">
                              {modalInvItem.quantity} {modalInvItem.unit || "Nos"} Available
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-foreground pt-1 font-medium">
                            <div className="p-3 rounded-xl bg-background border border-border">
                              <span className="text-xs text-muted-foreground block mb-0.5 font-semibold uppercase tracking-wider">Warehouse</span>
                              <span className="font-bold text-blue-700 dark:text-blue-400 text-sm">{modalInvItem.warehouse || "Main Warehouse"}</span>
                            </div>
                            <div className="p-3 rounded-xl bg-background border border-border">
                              <span className="text-xs text-muted-foreground block mb-0.5 font-semibold uppercase tracking-wider">Rack / Shelf / Bin</span>
                              <span className="font-bold text-foreground text-sm">{modalInvItem.location || "Store Rack A"}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </section>

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
                {reasonModal.status !== "PENDING" && (
                  <>
                    {isAdmin && (
                      <div className="flex items-center justify-between border-t border-border pt-2">
                        <div className="flex items-center gap-2">
                          <UserRound className="h-4 w-4 text-primary" />
                          <span className="text-sm font-semibold text-muted-foreground">
                            {isApprovedOrCompletedStatus(reasonModal.status, reasonModal.reviewNote) ? "Approved By" : "Rejected By"}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-foreground">
                            {getReviewerInfo(reasonModal)}
                          </span>
                        </div>
                      </div>
                    )}
                    {reasonModal.reviewedAt && (
                      <div className="flex items-center justify-between border-t border-border pt-2">
                        <div className="flex items-center gap-2">
                          <Clock3 className={`h-4 w-4 ${isApprovedOrCompletedStatus(reasonModal.status, reasonModal.reviewNote) ? "text-emerald-600" : "text-rose-600"}`} />
                          <span className={`text-sm font-semibold ${isApprovedOrCompletedStatus(reasonModal.status, reasonModal.reviewNote) ? "text-emerald-700" : "text-rose-700"}`}>
                            {isApprovedOrCompletedStatus(reasonModal.status, reasonModal.reviewNote) ? "Approved At" : "Rejected At"}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className={`text-sm font-bold ${isApprovedOrCompletedStatus(reasonModal.status, reasonModal.reviewNote) ? "text-emerald-700" : "text-rose-700"}`}>
                            {formatDate(reasonModal.reviewedAt)}
                          </span>
                          <span className={`ml-2 text-xs ${isApprovedOrCompletedStatus(reasonModal.status, reasonModal.reviewNote) ? "text-emerald-600" : "text-rose-600"}`}>
                            {formatTimeIST(reasonModal.reviewedAt)}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ================= FOOTER ================= */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-background px-4 py-3.5 shadow-[0_-8px_24px_rgba(15,23,42,0.04)] sm:px-6">
              {(() => {
                const { canApprove, canReject } = getApprovalPermissions(reasonModal);
                const acting = Boolean(actingId);
                return (
                  <div className="flex items-center gap-2 flex-wrap">
                    {(() => {
                      const returnStep = reasonModal.source === "REQUEST" ? getReturnStep(reasonModal) : 0;
                      if (returnStep === 1) {
                        return (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                const target = reasonModal;
                                setReasonModal(null);
                                setQualityModal(target);
                                setQualityCondition("Good Condition - Restock to Warehouse Stock");
                                setQualityRemarks("Quality inspected and verified by Admin.");
                              }}
                              disabled={acting || !canApprove}
                              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold shadow-md ${
                                !canApprove
                                  ? "bg-purple-600/50 opacity-60 cursor-not-allowed"
                                  : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 cursor-pointer"
                              }`}
                              title={!canApprove ? "View-only access: you cannot approve return." : "Quality Test & Approve"}
                            >
                              <CheckCheck className="h-4 w-4" />
                              Quality Test & Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const target = reasonModal;
                                setReasonModal(null);
                                setRejectModal({ approval: target });
                              }}
                              disabled={acting || !canReject}
                              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-rose-300 text-rose-700 dark:text-rose-300 text-xs font-bold ${
                                !canReject
                                  ? "bg-rose-500/5 opacity-60 cursor-not-allowed"
                                  : "bg-rose-500/10 hover:bg-rose-500/20 cursor-pointer"
                              }`}
                              title={!canReject ? "View-only access: you cannot reject return." : "Reject Return"}
                            >
                              <X className="h-4 w-4" />
                              Reject Return
                            </button>
                          </>
                        );
                      }
                      if (returnStep === 2) {
                        return (
                          <div className="text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800 flex items-center gap-1.5">
                            <CheckCheck className="h-3.5 w-3.5 text-purple-600" />
                            <span>Quality Tested ✓ Awaiting Employee to click <strong>Item Return</strong></span>
                          </div>
                        );
                      }
                      if (returnStep === 3) {
                        return (
                          <button
                            type="button"
                            onClick={async () => {
                              const target = reasonModal;
                              setReasonModal(null);
                              await handleAdminFoundItem(target);
                            }}
                            disabled={acting || !canApprove}
                            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold shadow-md ${
                              !canApprove
                                ? "bg-emerald-600/50 opacity-60 cursor-not-allowed"
                                : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 cursor-pointer"
                            }`}
                            title={!canApprove ? "View-only access: you cannot confirm product found." : "Product Found"}
                          >
                            <PackageCheck className="h-4 w-4" />
                            Product Found
                          </button>
                        );
                      }
                      if (reasonModal.status === "APPROVED") {
                        const isFound = reasonModal.reviewNote?.includes("[PRODUCT_FOUND]") || reasonModal.status === "COMPLETED";
                        const isNotFound = reasonModal.reviewNote?.includes("[ITEM_NOT_FOUND]");
                        if (isFound) {
                          return (
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                              Completed / Product Found ✓
                            </span>
                          );
                        }
                        if (isNotFound) {
                          return (
                            <span className="text-xs font-bold text-rose-700 dark:text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20">
                              EMPLOYEE: ITEM NOT FOUND ✕
                            </span>
                          );
                        }
                        if (reasonModal.source === "REQUEST" && reasonModal.type === "EQUIPMENT") {
                          return (
                            <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20">
                              Approved (Awaiting Employee Confirmation)
                            </span>
                          );
                        }
                        return (
                          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                            Approved ✓
                          </span>
                        );
                      }
                      if (reasonModal.status === "PENDING") {
                        return (
                          <>
                            <button
                              type="button"
                              onClick={async () => {
                                const target = reasonModal;
                                setReasonModal(null);
                                await review(target, "approve");
                              }}
                              disabled={acting || !canApprove}
                              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold shadow-xs ${
                                !canApprove
                                  ? "bg-emerald-600/50 opacity-60 cursor-not-allowed"
                                  : "bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
                              }`}
                              title={!canApprove ? "View-only access: you cannot approve this request." : "Approve"}
                            >
                              <Check className="h-4 w-4" />
                              Approve
                            </button>

                            {reasonModal.source === "REQUEST" && reasonModal.type === "EQUIPMENT" && (
                              <button
                                type="button"
                                onClick={() => {
                                  const target = reasonModal;
                                  setReasonModal(null);
                                  setHoldModal({ approval: target });
                                }}
                                disabled={acting || !canApprove}
                                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-amber-300 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-bold ${
                                  !canApprove
                                    ? "opacity-60 cursor-not-allowed"
                                    : "hover:bg-amber-500/20 cursor-pointer"
                                }`}
                                title={!canApprove ? "View-only access: you cannot hold this request." : "Hold (Out of Stock)"}
                              >
                                <PauseCircle className="h-4 w-4" />
                                Hold (Out of Stock)
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                const target = reasonModal;
                                setReasonModal(null);
                                setRejectModal({ approval: target });
                              }}
                              disabled={acting || !canReject}
                              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-rose-300 text-rose-700 dark:text-rose-300 text-xs font-bold ${
                                !canReject
                                  ? "bg-rose-500/5 opacity-60 cursor-not-allowed"
                                  : "bg-rose-500/10 hover:bg-rose-500/20 cursor-pointer"
                              }`}
                              title={!canReject ? "View-only access: you cannot reject this request." : "Reject"}
                            >
                              <X className="h-4 w-4" />
                              Reject
                            </button>
                          </>
                        );
                      }
                      return null;
                    })()}
                  </div>
                );
              })()}
              <button
                type="button"
                onClick={() => setReasonModal(null)}
                className="ml-auto rounded-xl bg-secondary hover:bg-secondary/80 text-foreground border border-border px-6 py-2 text-xs font-bold transition-all shadow-xs cursor-pointer"
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

      {/* Hold Modal (Product Out of Stock / Unavailable) */}
      {holdModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setHoldModal(null);
            }
          }}
        >
          <div className="flex w-full max-w-md flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border bg-amber-500/10 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600">
                  <PauseCircle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Put Request On Hold
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Product Out of Stock / Unavailable
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHoldModal(null)}
                className="rounded-xl p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Hold Reason / Restock Note <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  placeholder="e.g. Product currently out of stock. Order placed with vendor, expected in 3 days."
                  rows={4}
                  className="w-full rounded-2xl border border-border bg-secondary/20 p-3.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/30 resize-none font-medium"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border bg-secondary/20 px-6 py-4">
              <button
                type="button"
                onClick={() => setHoldModal(null)}
                className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold hover:bg-secondary transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleHoldSubmit}
                disabled={actingId === `${holdModal.approval?.source}:${holdModal.approval?.id}`}
                className="flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-amber-700 transition disabled:opacity-60"
              >
                {actingId === `${holdModal.approval?.source}:${holdModal.approval?.id}` && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Confirm Hold
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quality Check & Mark Product Found Modal */}
      {qualityModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setQualityModal(null);
          }}
        >
          <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-5 bg-emerald-500/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center font-bold">
                  <CheckCheck className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-lg">
                    Quality Inspection & Approve Return
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Inspect product condition and approve return. Employee will then click "Item Return".
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQualityModal(null)}
                className="rounded-xl p-2 text-muted-foreground hover:bg-secondary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="rounded-2xl border border-border bg-secondary/20 p-4 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-semibold">Employee:</span>
                  <span className="font-bold text-foreground">{qualityModal.employee}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-semibold">Request Title:</span>
                  <span className="font-bold text-foreground truncate max-w-[220px]">{qualityModal.title}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Item Quality & Condition Status *
                </label>
                <select
                  value={qualityCondition}
                  onChange={(e) => setQualityCondition(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background p-3 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                >
                  <option value="Good Condition - Restock to Warehouse Stock">Good Condition (Restock to Warehouse Stock)</option>
                  <option value="Minor Wear - Acceptable for Re-issue">Minor Wear (Acceptable for Re-issue)</option>
                  <option value="Damaged / Defective - Needs Maintenance">Damaged / Defective (Scrap / Repair Required)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Quality Inspection Remarks *
                </label>
                <textarea
                  value={qualityRemarks}
                  onChange={(e) => setQualityRemarks(e.target.value)}
                  rows={3}
                  placeholder="Enter physical quality inspection notes / remarks..."
                  className="w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border p-4 bg-secondary/20">
              <button
                type="button"
                onClick={() => setQualityModal(null)}
                className="px-4 py-2 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-secondary cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleQualitySubmit}
                disabled={actingId === `${qualityModal.source}:${qualityModal.id}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-sm shadow-md hover:from-purple-700 hover:to-indigo-700 transition-all cursor-pointer disabled:opacity-60"
              >
                {actingId === `${qualityModal.source}:${qualityModal.id}` ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCheck className="h-4 w-4" />
                )}
                Approve & Quality Passed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Approvals;
