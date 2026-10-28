import { useEffect, useRef, useState } from "react";
import {
  Clock,
  Clock3,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Users,
  X,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MapPin,
  Printer,
  ArrowLeft,
  Plus,
  Minus,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Calendar,
  Search,
  Download,
  LogIn,
  LogOut,
  MessageSquare,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../lib/api.js";
import {
  printSingleEmployeeAttendancePdf,
  printTeamAttendancePdf,
} from "../../utils/attendancePdfExport.js";

// Visual styling per attendance status.
const statusMeta = {
  PRESENT: {
    label: "Present",
    dot: "bg-emerald-500",
    cell: "bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300",
  },
  SHORT_DAY: {
    label: "Short Day",
    description: "Worked hours less than standard 8 hours",
    dot: "bg-amber-500",
    cell: "bg-amber-500/10 dark:bg-amber-500/20 border-amber-300 dark:border-amber-700/50 text-amber-700 dark:text-amber-300",
  },
  ABSENT: {
    label: "Absent",
    dot: "bg-rose-500",
    cell: "bg-rose-500/10 dark:bg-rose-500/20 border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-300",
  },
  ON_LEAVE: {
    label: "On Leave",
    dot: "bg-violet-500",
    cell: "bg-violet-500/10 dark:bg-violet-500/20 border-violet-200 dark:border-violet-800/40 text-violet-700 dark:text-violet-300",
  },
  HOLIDAY: {
    label: "Holiday",
    dot: "bg-blue-500",
    cell: "bg-blue-500/10 dark:bg-blue-500/20 border-blue-200 dark:border-blue-800/40 text-blue-700 dark:text-blue-300",
  },
  PENDING_APPROVAL: {
    label: "Awaiting Approval",
    dot: "bg-amber-500",
    cell: "bg-amber-500/10 dark:bg-amber-500/20 border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-300",
  },
};

const monthNames = [
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
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const fmtTime = (v) =>
  v
    ? new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

const fmtWorkedHours = (value) => {
  if (value == null) return "—";
  const hours = Number(value);
  if (Number.isNaN(hours)) return "—";
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
};

const fmtOvertimeHours = (record, isHolidayOrSunday = false) => {
  if (!record) return null;
  const netOtMinutes = getNumericOvertimeMinutes(record, isHolidayOrSunday);
  if (netOtMinutes <= 0) return null;
  return fmtWorkedHours(netOtMinutes / 60);
};

const getNumericWorkedMinutes = (record) => {
  if (!record) return 0;
  let hours = Number(record.workedHours);
  if (Number.isNaN(hours) || hours <= 0) {
    if (record.checkIn && record.checkOut) {
      const diffMs = new Date(record.checkOut) - new Date(record.checkIn);
      if (diffMs > 0) hours = diffMs / 3600000;
    }
  }
  if (Number.isNaN(hours) || hours <= 0) return 0;
  return Math.round(hours * 60);
};

const getNumericOvertimeMinutes = (record, isHolidayOrSunday = false) => {
  if (!record) return 0;
  const workedMinutes = getNumericWorkedMinutes(record);
  if (workedMinutes <= 0) return 0;
  const workedHours = workedMinutes / 60;

  // On holidays or Sundays, all worked hours count as overtime (rounded to 15m intervals)
  if (isHolidayOrSunday) {
    const roundedOtMinutes = Math.floor(workedMinutes / 15) * 15;
    return roundedOtMinutes > 0 ? roundedOtMinutes : 0;
  }

  if (workedHours <= 8) return 0;
  const overtimeHours = workedHours - 8;
  const otMinutes = Math.round(overtimeHours * 60);
  const roundedOtMinutes = Math.floor(otMinutes / 15) * 15;
  return roundedOtMinutes > 0 ? roundedOtMinutes : 0;
};

const fmtMinutesToHM = (totalMinutes) => {
  if (!totalMinutes || totalMinutes <= 0) return "0h 0m";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
};

const cleanAttendanceNote = (note) => {
  if (!note) return "";

  return (
    String(note)
      // Remove UUID / Request ID inside parentheses
      .replace(
        /\s*\([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\)/gi,
        "",
      )
      .replace(/\s{2,}/g, " ")
      .trim()
  );
};

const formatAttendanceNote = (note) => {
  if (!note) return "";

  // First remove Request IDs
  const cleanedNote = cleanAttendanceNote(note);

  const hasUnassignedCheckIn =
    /Checkin(?:\s+from|\s+to)?\s+unassigned location/i.test(cleanedNote);

  const hasUnassignedCheckOut =
    /Checkout(?:\s+from)?\s+unassigned location/i.test(cleanedNote);

  const checkInMatch = cleanedNote.match(
    /(?:^|\|)\s*Checkin:\s*([^|.]+?)(?:\s*\||$)/i,
  );

  const checkOutMatch = cleanedNote.match(
    /(?:^|\|)\s*Checkout:\s*([^|.]+?)(?:\s*\||$)/i,
  );

  if (
    !hasUnassignedCheckIn &&
    !hasUnassignedCheckOut &&
    !checkInMatch &&
    !checkOutMatch
  ) {
    return cleanedNote;
  }

  const checkInLocation = hasUnassignedCheckIn
    ? "Unassigned Location"
    : checkInMatch?.[1]?.trim();

  const checkOutLocation = hasUnassignedCheckOut
    ? "Unassigned Location"
    : checkOutMatch?.[1]?.trim();

  if (!checkInLocation && !checkOutLocation) {
    return cleanedNote;
  }

  if (
    checkInLocation?.toLowerCase() === "head office" ||
    checkOutLocation?.toLowerCase() === "head office"
  ) {
    return "Location: Head Office";
  }

  if (
    checkInLocation &&
    checkOutLocation &&
    checkInLocation.toLowerCase() === checkOutLocation.toLowerCase()
  ) {
    return `Location: ${checkInLocation}`;
  }

  return [
    checkInLocation && `Check In: ${checkInLocation}`,
    checkOutLocation && `Check Out: ${checkOutLocation}`,
  ]
    .filter(Boolean)
    .join("\n");
};

const parseAttendanceNoteSegment = (segment, record) => {
  const text = segment.trim();
  const lower = text.toLowerCase();

  const isCheckIn = lower.includes("checkin") || lower.includes("check in");
  const isCheckOut = lower.includes("checkout") || lower.includes("check out");
  const isForgotPunch = lower.includes("forgot punch");
  const isManualCorrection = lower.includes("manual attendance");

  let type = "Attendance Note";
  if (isForgotPunch) {
    type = "Forgot Punch";
  } else if (isManualCorrection) {
    type = "Attendance Correction";
  } else if (isCheckIn) {
    type = "Check In Request";
  } else if (isCheckOut) {
    type = "Check Out Request";
  }

  // Extract Reason using regex matching or manual correction reason
  let userReason = null;
  const reasonMatch = text.match(/Reason:\s*(.*?)(?=\s*(?:Pending admin approval|Admin approved|Admin rejected|Approved by admin|Rejected by admin|Approved|Rejected)\b|\s*\||\.|$)/i);
  if (reasonMatch && reasonMatch[1].trim()) {
    userReason = reasonMatch[1].trim();
  } else if (isManualCorrection) {
    const manualM = text.match(/manual attendance(?:\s+correction)?:\s*(.*?)(?=\s*Check-In Location:|\s*Check-Out Location:|\s*CheckIn Location:|\s*CheckOut Location:|\.|$)/i);
    if (manualM && manualM[1].trim()) {
      userReason = manualM[1].trim();
    }
  }

  // Extract distance if present
  const distMatch = text.match(/\(([0-9.]+(?:\s*(?:km|m))?)\s*(?:away)?\)/i);
  const distance = distMatch ? distMatch[1].trim() : null;

  let status = "INFO";
  let statusLabel = null;
  const isAdminRecord =
    record?.employee?.user?.role === "ADMIN" ||
    record?.employee?.employeeCode?.startsWith("ADMIN") ||
    record?.user?.role === "ADMIN";

  if (lower.includes("pending")) {
    if (isAdminRecord) {
      status = "APPROVED";
      statusLabel = "Approved (Auto-Approved)";
    } else {
      status = "PENDING";
      statusLabel = "Pending Approval";
    }
  } else if (lower.includes("approved")) {
    status = "APPROVED";
    statusLabel = "Approved";
  } else if (lower.includes("rejected")) {
    status = "REJECTED";
    statusLabel = "Rejected";
  } else if (isManualCorrection || isForgotPunch || isAdminRecord) {
    status = "APPROVED";
    statusLabel = "Approved";
  } else if (!userReason && (lower.startsWith("checkin:") || lower.startsWith("checkout:"))) {
    status = "APPROVED";
    statusLabel = "Verified";
  }

  let locationInfo = null;
  if (lower.includes("unassigned location")) {
    const locM = text.match(/unassigned location:\s*([^.]+?)(?=\.|\s*Reason:|\s*Pending|$)/i);
    const locName = locM ? locM[1].trim() : "Unassigned Location";
    locationInfo = distance ? `${locName} (${distance} away)` : locName;
  } else if (lower.includes("outside assigned location")) {
    locationInfo = distance ? `Outside (${distance} away)` : "Outside Location";
  }

  let timeStr = null;
  if (isCheckIn && record?.checkIn) {
    timeStr = fmtTime(record.checkIn);
  } else if (isCheckOut && record?.checkOut) {
    timeStr = fmtTime(record.checkOut);
  }

  let cleanSummary = text
    .replace(/^Checkin\s+(from|to|location)?[^.]*?\.\s*/i, "")
    .replace(/^Checkout\s+(recorded|from|to|location|outside)?[^.]*?\.\s*/i, "")
    .replace(/Forgot Punch\s*(approved|rejected|pending approval)?\.?/gi, "")
    .replace(/\s*Pending admin approval\.?/gi, "")
    .replace(/\s*Approved by admin\.?/gi, "")
    .replace(/\s*Rejected by admin\.?/gi, "")
    .replace(/\s*Admin approved\.?/gi, "")
    .replace(/\s*Admin rejected\.?/gi, "")
    .replace(/\s*Approved\.?/gi, "")
    .replace(/\s*Rejected\.?/gi, "")
    .trim();

  return {
    type,
    isCheckIn,
    isCheckOut,
    isForgotPunch,
    timeStr,
    userReason,
    status,
    statusLabel,
    locationInfo,
    distance,
    rawText: text,
    cleanSummary,
  };
};

const extractSubmittedReason = (note) => {
  if (!note) return "No reason provided.";

  const cleanedNote = cleanAttendanceNote(note);

  const reasonMatch = cleanedNote.match(
    /Reason:\s*(.*?)(?:\.\s*Pending admin approval|\.|$)/i,
  );

  return reasonMatch?.[1]?.trim() || cleanedNote;
};

const hasSubmittedReason = (note) => {
  if (!note || typeof note !== "string") return false;
  const trimmed = note.trim();
  if (!trimmed || trimmed === "—" || trimmed === "-") return false;
  const lower = trimmed.toLowerCase();
  // Standard check-in / check-out to assigned office or location without reason/outside/pending is not a reason request
  return (
    lower.includes("reason:") ||
    lower.includes("unassigned") ||
    lower.includes("outside") ||
    lower.includes("pending") ||
    lower.includes("forgot punch") ||
    lower.includes("manual attendance") ||
    lower.includes("reject")
  );
};

const getCalendarLocationCode = (note, type) => {
  if (!note) return null;

  const cleanedNote = cleanAttendanceNote(note);
  const isCheckIn = type === "check-in";

  // Unassigned / unassigned locations are always UL.
  const unassignedPattern = isCheckIn
    ? /Checkin(?:\s+from|\s+to)?:?\s*unassigned location/i
    : /Checkout(?:\s+from)?:?\s*unassigned location/i;

  const unapprovedPattern = isCheckIn
    ? /Checkin\s+to\s+unapproved\s+location/i
    : /Checkout\s+(?:from|to)\s+unapproved\s+location/i;

  if (
    unassignedPattern.test(cleanedNote) ||
    unapprovedPattern.test(cleanedNote)
  ) {
    return "UL";
  }

  const locationMatch = isCheckIn
    ? cleanedNote.match(/(?:^|\|)\s*Checkin:\s*([^|.]+?)(?:\s*\||$)/i)
    : cleanedNote.match(/(?:^|\|)\s*Checkout:\s*([^|.]+?)(?:\s*\||$)/i);

  if (!locationMatch?.[1]) return null;

  const locationName = locationMatch[1].trim();

  // Head Office / Office = O.
  if (/^(head office|office)$/i.test(locationName)) {
    return "O";
  }

  // Any named non-office location recorded as the employee's location = Assign.
  return "A";
};

const fmtDateDMY = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const day = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit" }).format(date);
  const month = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", month: "2-digit" }).format(date);
  const year = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", year: "numeric" }).format(date);
  return `${day}/${month}/${year}`;
};

const formatDateKey = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
};

// Split the selected month into calendar weeks running from Sunday to Saturday.
// Week 1 starts on the 1st of the month and extends to the first Saturday (or earlier if month ends).
// Subsequent weeks start on Sunday and end on Saturday (or end of month).
const computeMonthWeeks = (year, month) => {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const weeks = [];

  let currentStart = 1;
  while (currentStart <= daysInMonth) {
    const startDate = new Date(Date.UTC(year, month - 1, currentStart));
    const dayOfWeek = startDate.getUTCDay(); // 0 is Sunday, 6 is Saturday
    // Days until Saturday (day 6)
    const daysToSaturday = 6 - dayOfWeek;
    const currentEnd = Math.min(currentStart + daysToSaturday, daysInMonth);

    weeks.push({
      start: new Date(Date.UTC(year, month - 1, currentStart)),
      end: new Date(Date.UTC(year, month - 1, currentEnd)),
    });

    currentStart = currentEnd + 1;
  }

  return weeks;
};

const getCurrentWeekIndex = (year, month) => {
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();

  // Only auto-select a week when the requested month is the current month.
  if (year !== todayYear || month !== todayMonth) return "";

  const weeks = computeMonthWeeks(year, month);
  const foundIndex = weeks.findIndex((w) => {
    const s = w.start.getUTCDate();
    const e = w.end.getUTCDate();
    return todayDay >= s && todayDay <= e;
  });

  return foundIndex >= 0 ? String(foundIndex + 1) : "1";
};

const getRegisterWindow = (y, m, weekValue) => {
  const monthStart = new Date(Date.UTC(y, m - 1, 1));
  const monthEnd = new Date(Date.UTC(y, m, 0));
  const daysInMonth = monthEnd.getUTCDate();

  if (weekValue) {
    const week = computeMonthWeeks(y, m)[Number(weekValue) - 1];
    if (week) {
      // Fetch only the selected month's week range.
      // The last week can contain fewer than 7 days.
      const days =
        Math.round((week.end.getTime() - week.start.getTime()) / 86400000) + 1;

      return {
        start: formatDateKey(week.start),
        days,
      };
    }
  }

  // No week selected = complete selected month.
  return {
    start: formatDateKey(monthStart),
    days: daysInMonth,
  };
};

const Attendance = () => {
  const navigate = useNavigate();
  const today = new Date();
  const todayKey = formatDateKey(new Date());
  const [employees, setEmployees] = useState([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [selectedId, setSelectedId] = useState("all");
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-12
  const [data, setData] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(() =>
    getCurrentWeekIndex(new Date().getFullYear(), new Date().getMonth() + 1),
  );
  const [selectedDate, setSelectedDate] = useState("");
  const [registerData, setRegisterData] = useState(null);
  const [showDetailedRecords, setShowDetailedRecords] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [mapModal, setMapModal] = useState(null); // null or { latitude, longitude, employee, checkIn }
  const [rejectModal, setRejectModal] = useState(null); // null or { recordId, employeeName, reason }
  const [attendanceReasonModal, setAttendanceReasonModal] = useState(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [calendarZoom, setCalendarZoom] = useState(80);
  const knownPendingIds = useRef(null);
  const isAllEmployees = selectedId === "all";

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 420);

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".employee-dropdown-container")) {
        setShowEmployeeDropdown(false);
        setEmployeeSearch("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const loadEmployees = async () => {
    try {
      const res = await apiGet("/attendance/employees");
      setEmployees(res.employees);
      if (!selectedId && res.employees?.length > 0) {
        setSelectedId(res.employees[0].id);
      }
    } catch (err) {
      toast.error(err.message || "Failed to load employees.");
    } finally {
      setLoadingEmployees(false);
    }
  };

  const loadPendingApprovals = async () => {
    try {
      const res = await apiGet("/attendance/pending-approvals");
      const nextPending = res.pendingRecords || [];
      const nextPendingIds = new Set(nextPending.map((record) => record.id));

      if (knownPendingIds.current) {
        const newRequest = nextPending.find(
          (record) => !knownPendingIds.current.has(record.id),
        );
        if (newRequest) {
          const employeeName =
            newRequest.employee?.user?.fullName || "An employee";
          toast.warning("New attendance approval request", {
            description: `${employeeName} checked in or out from an unassigned location.`,
            duration: 6000,
          });
        }
      }

      knownPendingIds.current = nextPendingIds;
      setPendingApprovals(nextPending);
    } catch (err) {
      console.error("Failed to load pending approvals:", err);
    }
  };

  const extractCoordinatesFromNote = (record) => {
    const lat = Number(record?.checkInLatitude ?? record?.checkOutLatitude);
    const lon = Number(record?.checkInLongitude ?? record?.checkOutLongitude);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return { latitude: lat, longitude: lon };
    }

    if (!record?.note) return null;

    const coordMatch = record.note.match(
      /(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/,
    );
    if (coordMatch) {
      const latitude = Number(coordMatch[1]);
      const longitude = Number(coordMatch[2]);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        return { latitude, longitude };
      }
    }

    return null;
  };

  const openLocationMap = (record) => {
    console.log("Opening map for record:", record);
    console.log("checkInLatitude:", record?.checkInLatitude);
    console.log("checkInLongitude:", record?.checkInLongitude);

    const coords = extractCoordinatesFromNote(record);
    console.log("Extracted coordinates:", coords);

    if (
      coords &&
      Number.isFinite(coords.latitude) &&
      Number.isFinite(coords.longitude)
    ) {
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${coords.latitude},${coords.longitude}`;
      window.open(mapsUrl, "_blank", "noopener,noreferrer");
      return;
    }

    toast.error("Location coordinates not available for this check-in.");
  };

  useEffect(() => {
    (async () => {
      await loadEmployees();
      await loadPendingApprovals();
    })();
  }, []);

  useEffect(() => {
    const refreshPendingApprovals = () => {
      loadPendingApprovals();
    };

    const intervalId = window.setInterval(refreshPendingApprovals, 10000);
    return () => window.clearInterval(intervalId);
  }, []);

  // Fetch attendance whenever the employee, month, year, or Week filter changes.
  // All Employees uses the selected month by default and only the selected
  // 1-7 / 8-14 / ... week when a Week filter is active.
  useEffect(() => {
    let active = true;

    const fetchAttendance = async (isBackground = false) => {
      if (!selectedId) {
        setData(null);
        setRegisterData(null);
        setShowDetailedRecords(false);
        return;
      }

      try {
        if (selectedId === "all") {
          const { start, days } = getRegisterWindow(year, month, selectedWeek);
          const res = await apiGet(
            `/attendance/register/weekly?days=${days}&start=${start}`,
          );

          if (active) {
            setRegisterData(res);
            setData(null);
            setShowDetailedRecords(false);
          }
        } else {
          const res = await apiGet(
            `/attendance/${selectedId}?year=${year}&month=${month}`,
          );

          if (active) {
            setData(res);
            setRegisterData(null);
            setShowDetailedRecords(false);
          }
        }
      } catch (err) {
        if (active && !isBackground) {
          toast.error(err.message || "Failed to load attendance.");
          setData(null);
          setRegisterData(null);
          setShowDetailedRecords(false);
        }
      }
    };

    fetchAttendance(false);

    // Auto-fetch every 10 seconds in background
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchAttendance(true);
      }
    }, 10000);

    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        fetchAttendance(true);
      }
    };
    window.addEventListener("visibilitychange", handleFocus);
    window.addEventListener("focus", handleFocus);

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("visibilitychange", handleFocus);
      window.removeEventListener("focus", handleFocus);
    };
  }, [selectedId, year, month, selectedWeek]);

  const changeMonth = (delta) => {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setSelectedDate("");
    setSelectedWeek("");
    setMonth(m);
    setYear(y);
  };

  const computeLastWeekStartKey = () => {
    const now = new Date();
    const todayUtc = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const startOfThisWeek = new Date(
      Date.UTC(
        todayUtc.getUTCFullYear(),
        todayUtc.getUTCMonth(),
        todayUtc.getUTCDate() - todayUtc.getUTCDay(),
      ),
    );
    const lastWeekStart = new Date(
      Date.UTC(
        startOfThisWeek.getUTCFullYear(),
        startOfThisWeek.getUTCMonth(),
        startOfThisWeek.getUTCDate() - 7,
      ),
    );
    return formatDateKey(lastWeekStart);
  };

  // Calendar grid cells: leading blanks + days of month.
  // Define this BEFORE the optional week calendar so it is initialized
  // before calendarCells can reference it.
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // Calendar days shown when an employee + Week filter is selected.
  // Week 1 = days 1-7, Week 2 = 8-14, etc.
  const selectedWeekCalendarDays = selectedWeek
    ? (() => {
        const weeks = computeMonthWeeks(year, month);
        const week = weeks[Number(selectedWeek) - 1];
        if (!week) return [];

        const days = [];
        for (
          let day = week.start.getUTCDate();
          day <= week.end.getUTCDate();
          day += 1
        ) {
          days.push(day);
        }

        return days;
      })()
    : [];

  const calendarCells = selectedWeek
    ? [
        ...Array(
          selectedWeekCalendarDays.length
            ? new Date(
                Date.UTC(year, month - 1, selectedWeekCalendarDays[0]),
              ).getUTCDay()
            : 0,
        ).fill(null),
        ...selectedWeekCalendarDays,
      ]
    : cells;

  // Build a map of day-of-month -> record for quick lookup.
  const recordByDay = {};
  const getISTDay = (val) => {
    const dt = new Date(val);
    if (Number.isNaN(dt.getTime())) return null;
    return Number(new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric" }).format(dt));
  };
  if (data) {
    for (const r of data.records) {
      const day = getISTDay(r.date);
      if (day != null) recordByDay[day] = r;
    }
  }
  const holidayByDay = {};
  if (data) {
    for (const h of data.holidays) {
      const day = getISTDay(h.date);
      if (day != null) holidayByDay[day] = h.name;
    }
  }

  const selectedDay =
    selectedDate && selectedId !== "all"
      ? Number(selectedDate.slice(8, 10))
      : null;

  const selectedRecord = selectedDay ? recordByDay[selectedDay] : null;
  const selectedHolidayName = selectedDay ? holidayByDay[selectedDay] : null;

  const summary = isAllEmployees
    ? registerData?.summary || {}
    : data?.summary || {};
  const records = isAllEmployees
    ? registerData?.records || []
    : data?.records || [];
  const isHolidayDate = (date) => {
    if (!date) return false;
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return false;
    const istDow = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "short" }).format(d);
    if (istDow === "Sun") return true;

    const dateKey = formatDateKey(d);
    const holidays = isAllEmployees
      ? registerData?.holidays || []
      : data?.holidays || [];

    return holidays.some((h) => formatDateKey(new Date(h.date)) === dateKey);
  };

  const isWorkedRecord = (record) =>
    Boolean(record?.checkIn || record?.checkOut) ||
    Number(record?.workedHours) > 0;

  const isOvertimeRecord = (record) => {
    if (!record) return false;

    // On a holiday, every hour worked is overtime (if > 15 minutes).
    if (isHolidayDate(record.date)) {
      const worked = Number(record.workedHours);
      return Math.round(worked * 60) > 15;
    }

    // On a normal working day, overtime starts after 8 hours (if > 15 minutes).
    const workedHours = Number(record.workedHours);
    if (Number.isNaN(workedHours) || workedHours <= 8) return false;
    const otMinutes = Math.round((workedHours - 8) * 60);
    return otMinutes > 15;
  };

  const isShortDayRecord = (record) => {
    if (!record) return false;
    if (record.isShortDay != null) return Boolean(record.isShortDay);
    if (isHolidayDate(record.date)) return false;
    const d = new Date(record.date);
    if (d.getDay() === 0) return false;
    if (record.status === "ON_LEAVE" || record.status === "ABSENT" || record.status === "HOLIDAY") return false;
    const worked = Number(record.workedHours);
    return !Number.isNaN(worked) && worked > 0 && worked < 8;
  };

  const overtimeDays = records.filter(isOvertimeRecord).length;
  const shortDays = records.filter(isShortDayRecord).length;
  const overtimeMeta = {
    label: "Overtime",
    dot: "bg-orange-500",
    cell: "bg-orange-500/10 dark:bg-orange-500/20 border-orange-200 dark:border-orange-800/40 text-orange-700 dark:text-orange-300",
  };
  const filteredRecords = selectedStatus
    ? records.filter((rec) => {
        if (selectedStatus === "OVERTIME") {
          return isOvertimeRecord(rec);
        }
        if (selectedStatus === "SHORT_DAY") {
          return isShortDayRecord(rec);
        }
        if (selectedStatus === "HOLIDAY") {
          return isHolidayDate(rec.date) || rec.status === "HOLIDAY";
        }
        // Do not show ABSENT records for today or future days (people may still arrive)
        if (selectedStatus === "ABSENT") {
          const recKey = formatDateKey(rec.date);
          if (recKey >= todayKey) return false;
        }
        return rec.status === selectedStatus;
      })
    : records;
  const selectedStatusMeta =
    selectedStatus === "OVERTIME" ? overtimeMeta : statusMeta[selectedStatus];

  const registerStartDate = registerData?.startDate
    ? new Date(registerData.startDate)
    : null;
  const registerDates = registerStartDate
    ? Array.from({ length: registerData.days ?? 7 }, (_, index) => {
        return new Date(
          Date.UTC(
            registerStartDate.getUTCFullYear(),
            registerStartDate.getUTCMonth(),
            registerStartDate.getUTCDate() + index,
          ),
        );
      })
    : [];

  // All Employees + Date = show only the selected date.
  // Without a date, Team Attendance shows the full selected month.
  const visibleRegisterDates =
    isAllEmployees && selectedDate
      ? registerDates.filter((date) => formatDateKey(date) === selectedDate)
      : registerDates;

  // Keep every employee visible even when there is no attendance record
  // for the selected month/week.
  const registerEmployees = employees;

  const attendanceByDateEmployee = new Map(
    (registerData?.records || []).map((rec) => [
      `${formatDateKey(new Date(rec.date))}:${rec.employeeId}`,
      rec,
    ]),
  );

  const individualTotals = records.reduce(
    (acc, rec) => {
      const isHol = isHolidayDate(rec.date);
      acc.workedMinutes += getNumericWorkedMinutes(rec);
      acc.otMinutes += getNumericOvertimeMinutes(rec, isHol);
      return acc;
    },
    { workedMinutes: 0, otMinutes: 0 },
  );

  const presentTotals = records
    .filter((rec) => rec.status === "PRESENT")
    .reduce(
      (acc, rec) => {
        const isHol = isHolidayDate(rec.date);
        acc.workedMinutes += getNumericWorkedMinutes(rec);
        acc.otMinutes += getNumericOvertimeMinutes(rec, isHol);
        return acc;
      },
      { workedMinutes: 0, otMinutes: 0 },
    );

  const shortDayTotals = records
    .filter(isShortDayRecord)
    .reduce(
      (acc, rec) => {
        const isHol = isHolidayDate(rec.date);
        acc.workedMinutes += getNumericWorkedMinutes(rec);
        acc.otMinutes += getNumericOvertimeMinutes(rec, isHol);
        return acc;
      },
      { workedMinutes: 0, otMinutes: 0 },
    );

  const filteredTotals = filteredRecords.reduce(
    (acc, rec) => {
      const isHol = isHolidayDate(rec.date);
      acc.workedMinutes += getNumericWorkedMinutes(rec);
      acc.otMinutes += getNumericOvertimeMinutes(rec, isHol);
      return acc;
    },
    { workedMinutes: 0, otMinutes: 0 },
  );

  const allEmployeesTotals = (registerData?.records || []).reduce(
    (acc, rec) => {
      const isHol = isHolidayDate(rec.date);
      acc.workedMinutes += getNumericWorkedMinutes(rec);
      acc.otMinutes += getNumericOvertimeMinutes(rec, isHol);
      return acc;
    },
    { workedMinutes: 0, otMinutes: 0 },
  );

  // Monthly summary for the All Employees view.
  const getEmployeeMonthSummary = (emp) => {
    let present = 0;
    let shortDay = 0;
    let absent = 0;
    let leave = 0;
    let holiday = 0;
    let totalWorkedMinutes = 0;
    let totalOtMinutes = 0;

    visibleRegisterDates.forEach((date) => {
      const dateKey = formatDateKey(date);
      let rec = attendanceByDateEmployee.get(`${dateKey}:${emp.id}`);

      // Do not count today's/future ABSENT records.
      if (rec && rec.status === "ABSENT" && dateKey >= todayKey) {
        rec = null;
      }

      const isHoliday = isHolidayDate(date) || rec?.status === "HOLIDAY";

      if (rec) {
        totalWorkedMinutes += getNumericWorkedMinutes(rec);
        totalOtMinutes += getNumericOvertimeMinutes(rec, isHoliday);
      }

      if (rec?.status === "ON_LEAVE") {
        leave += 1;
      } else if (rec?.status === "ABSENT") {
        absent += 1;
      } else if (
        rec &&
        (isWorkedRecord(rec) ||
          rec.status === "PRESENT" ||
          rec.status === "PENDING_APPROVAL")
      ) {
        present += 1;
        if (isShortDayRecord(rec)) {
          shortDay += 1;
        }
      } else if (isHoliday) {
        holiday += 1;
      }
    });

    return {
      present,
      shortDay,
      absent,
      leave,
      holiday,
      totalWorkedMinutes,
      totalOtMinutes,
      totalWorkedText: fmtMinutesToHM(totalWorkedMinutes),
      totalOtText: fmtMinutesToHM(totalOtMinutes),
      total: present + absent + leave + holiday,
    };
  };

  const handleEmployeeChange = (id) => {
    setSelectedId(id);
    setSelectedDate("");
    setSelectedWeek("");
    setEmployeeSearch("");
    setShowEmployeeDropdown(false);
  };

  const handleStatusClick = (key) => {
    setSelectedStatus((prev) => (prev === key ? null : key));
    setShowDetailedRecords(false);
  };

  const reloadRegister = async () => {
    try {
      const { start, days } = getRegisterWindow(year, month, selectedWeek);
      const res = await apiGet(
        `/attendance/register/weekly?days=${days}&start=${start}`,
      );
      setRegisterData(res);
    } catch (err) {
      toast.error(err.message || "Failed to reload register.");
    }
  };

  const approveRecord = async (recId) => {
    try {
      await apiPost(`/attendance/approve/${recId}`);
      toast.success("Attendance approved.");
      await loadPendingApprovals();
      if (selectedId === "all") {
        await reloadRegister();
      } else if (selectedId) {
        const res = await apiGet(
          `/attendance/${selectedId}?year=${year}&month=${month}`,
        );
        setData(res);
      }
    } catch (err) {
      toast.error(err.message || "Failed to approve.");
    }
  };

  const rejectRecord = async (recId, reason) => {
    try {
      await apiPost(`/attendance/reject/${recId}`, { reason });
      toast.success("Attendance rejected.");
      setRejectModal(null);
      await loadPendingApprovals();
      if (selectedId === "all") {
        await reloadRegister();
      } else if (selectedId) {
        const res = await apiGet(
          `/attendance/${selectedId}?year=${year}&month=${month}`,
        );
        setData(res);
      }
    } catch (err) {
      toast.error(err.message || "Failed to reject.");
    }
  };

  const openRejectModal = (record) => {
    setRejectModal({
      recordId: record.id,
      employeeName:
        record.employee?.user?.fullName ||
        record.employee?.fullName ||
        "Employee",
      reason: record.note || "unassigned location",
    });
  };

  const openAttendanceReason = (record, employeeName, employeeId) => {
    setAttendanceReasonModal({
      employeeName: employeeName || "Employee",
      employeeId: employeeId || record.employeeId || record.employee?.id || (selectedId !== "all" ? selectedId : null),
      reason: extractSubmittedReason(record.note),
      note: record.note,
      record: record,
      recordId: record.id,
      date: record.date,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      checkIn: record.checkIn,
      checkOut: record.checkOut,
      checkInLatitude: record.checkInLatitude,
      checkInLongitude: record.checkInLongitude,
      checkOutLatitude: record.checkOutLatitude,
      checkOutLongitude: record.checkOutLongitude,
      status: record.status,
      statusLabel:
        statusMeta[record.status]?.label ||
        record.status ||
        "Awaiting Approval",
    });
  };

  const printLocationCodeGuide = () => {
    const printWindow = window.open("", "_blank", "width=760,height=720");

    if (!printWindow) {
      toast.error("Please allow pop-ups to print the location guide.");
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Location Code Guide</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 32px;
              color: #0f172a;
              font-family: Arial, sans-serif;
              line-height: 1.45;
            }
            h1 {
              margin: 0 0 4px;
              font-size: 22px;
            }
            .subtitle {
              margin: 0 0 24px;
              color: #475569;
              font-size: 13px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 13px;
            }
            th, td {
              border: 1px solid #cbd5e1;
              padding: 10px 12px;
              text-align: left;
              vertical-align: top;
            }
            th {
              background: #f1f5f9;
              font-size: 11px;
              letter-spacing: 0.08em;
              text-transform: uppercase;
            }
            .code {
              display: inline-block;
              min-width: 44px;
              border-radius: 4px;
              padding: 3px 7px;
              text-align: center;
              font-weight: 700;
            }
            .office { background: #dcfce7; color: #047857; }
            .assign { background: #dbeafe; color: #1d4ed8; }
            .unassigned { background: #ffedd5; color: #c2410c; }
            .combo { font-weight: 700; }
            @media print {
              body { padding: 18mm; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>Location Code Guide</h1>
          <p class="subtitle">Use these codes to read employee check-in and check-out locations in the attendance calendar.</p>

          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Meaning</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span class="code office">O</span></td>
                <td>Office or Head Office location.</td>
              </tr>
              <tr>
                <td><span class="code assign">A</span></td>
                <td>Assigned employee location.</td>
              </tr>
              <tr>
                <td><span class="code unassigned">UL</span></td>
                <td>Unassigned or unassigned location.</td>
              </tr>
            </tbody>
          </table>

          <h1 style="margin-top: 28px; font-size: 18px;">Common Combinations</h1>
          <table>
            <thead>
              <tr>
                <th>Combination</th>
                <th>Check In</th>
                <th>Check Out</th>
              </tr>
            </thead>
            <tbody>
              <tr><td class="combo">UL O</td><td>Unassigned</td><td>Office</td></tr>
              <tr><td class="combo">O UL</td><td>Office</td><td>Unassigned</td></tr>
              <tr><td class="combo">O O</td><td>Office</td><td>Office</td></tr>
              <tr><td class="combo">A A</td><td>Assigned Location</td><td>Assigned Location</td></tr>
              <tr><td class="combo">A O</td><td>Assigned Location</td><td>Office</td></tr>
              <tr><td class="combo">O A</td><td>Office</td><td>Assigned Location</td></tr>
              <tr><td class="combo">A UL</td><td>Assigned Location</td><td>Unassigned</td></tr>
              <tr><td class="combo">UL A</td><td>Unassigned</td><td>Assigned Location</td></tr>
            </tbody>
          </table>

          <script>
            window.onload = () => {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadAttendancePdf = () => {
    const periodLabel = selectedDate
      ? `Date: ${selectedDate}`
      : selectedWeek
        ? `Week ${selectedWeek} (${monthNames[month - 1]} ${year})`
        : `Full Month (${monthNames[month - 1]} ${year})`;

    if (isAllEmployees) {
      // Export team attendance for all employees
      printTeamAttendancePdf({
        employees: registerEmployees,
        monthName: monthNames[month - 1],
        year,
        periodLabel,
        visibleDates: visibleRegisterDates,
        getEmployeeMonthSummary,
        fmtDateFn: (d) => fmtDateDMY(d),
      });
    } else {
      // Export single employee attendance
      const currentEmp =
        data?.employee ||
        employees.find((emp) => emp.id === selectedId) || {
          fullName: "Employee",
        };

      const printRecords = records.map((rec) => {
        const isHol = isHolidayDate(rec.date);
        const workedMinutes = getNumericWorkedMinutes(rec);
        const otMinutes = getNumericOvertimeMinutes(rec, isHol);
        const workedHours = workedMinutes > 0 ? (workedMinutes / 60) : 0;
        const otHours = otMinutes > 0 ? (otMinutes / 60) : 0;

        return {
          ...rec,
          workedHoursTotal: workedHours,
          overtimeHours: otHours,
        };
      });

      printSingleEmployeeAttendancePdf({
        employee: currentEmp,
        monthName: monthNames[month - 1],
        year,
        periodLabel,
        records: printRecords,
        summary: {
          SHORT_DAY: summary?.SHORT_DAY ?? shortDays,
          ABSENT: summary?.ABSENT ?? records.filter((r) => r.status === "ABSENT").length,
          ON_LEAVE: summary?.ON_LEAVE ?? records.filter((r) => r.status === "ON_LEAVE").length,
          PRESENT: summary?.PRESENT ?? records.filter((r) => r.status === "PRESENT").length,
          OT_DAYS: overtimeDays,
          OT_HOURS_TEXT: fmtMinutesToHM(individualTotals.otMinutes),
          TOTAL_WORKED_TEXT: fmtMinutesToHM(individualTotals.workedMinutes),
        },
        isShortDayFn: isShortDayRecord,
        isHolidayDateFn: isHolidayDate,
        fmtDateFn: (d) => fmtDateDMY(d),
        fmtTimeFn: (t) => fmtTime(t),
        fmtWorkedHoursFn: (h) => (h != null && !Number.isNaN(Number(h)) ? `${Math.floor(Number(h))}h ${Math.round((Number(h) % 1) * 60)}m` : "—"),
      });
    }
  };

  if (selectedStatus) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setSelectedStatus(null)}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          <div>
            <h1 className="font-display text-2xl font-bold text-right">
              {selectedStatusMeta?.label} Records
            </h1>
            <p className="text-sm text-muted-foreground text-right">
              {monthNames[month - 1]} {year}
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-secondary/30">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-display text-lg font-semibold">
                  {selectedStatusMeta?.label} Attendance
                </div>
                <div className="text-xs text-muted-foreground">
                  {filteredRecords.length} record
                  {filteredRecords.length === 1 ? "" : "s"} found
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 dark:bg-blue-500/20 px-3 py-1 text-xs font-bold text-blue-700 dark:text-blue-300">
                  Worked: {fmtMinutesToHM(filteredTotals.workedMinutes)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 dark:bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
                  OT: {fmtMinutesToHM(filteredTotals.otMinutes)}
                </span>
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${selectedStatusMeta?.cell}`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${selectedStatusMeta?.dot}`}
                  />
                  {selectedStatusMeta?.label}
                </span>
              </div>
            </div>
          </div>

          <div className="p-6 overflow-x-auto">
            {/* Per-month working hour & OT count summary cards for Present / OT submodule */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="rounded-xl border border-blue-200 dark:border-blue-800/40 bg-blue-50/70 dark:bg-blue-950/20 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                    Monthly Working Hours ({selectedStatusMeta?.label})
                  </span>
                </div>
                <div className="font-display text-2xl font-bold text-blue-900 dark:text-blue-200">
                  {fmtMinutesToHM(filteredTotals.workedMinutes)}
                </div>
              </div>
              <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/70 dark:bg-amber-950/20 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                    Monthly Overtime (OT) Hours ({selectedStatusMeta?.label})
                  </span>
                </div>
                <div className="font-display text-2xl font-bold text-amber-900 dark:text-amber-200">
                  {fmtMinutesToHM(filteredTotals.otMinutes)}
                </div>
              </div>
            </div>

            {filteredRecords.length > 0 ? (
              <>
                {selectedStatus === "PENDING_APPROVAL" && (
                  <div className="mb-6 space-y-3">
                    {filteredRecords.map((rec) => (
                      <div
                        key={rec.id}
                        className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-gradient-to-br from-amber-500/10 to-orange-500/10 dark:from-amber-950/30 dark:to-orange-950/20 p-4 shadow-sm"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 dark:bg-amber-900/40 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {rec.employee?.user?.fullName ||
                                  rec.employee?.fullName ||
                                  "Employee"}
                              </span>
                            </div>
                            <div className="text-sm text-foreground">
                              <span className="font-semibold text-muted-foreground">Date:</span>{" "}
                              {fmtDateDMY(rec.date)}
                            </div>
                            <div className="text-sm text-foreground">
                              <span className="font-semibold text-muted-foreground">Check-in:</span>{" "}
                              {fmtTime(rec.checkIn) ?? "—"}
                            </div>
                            <div className="rounded-lg border border-amber-200 dark:border-amber-800/40 bg-card/70 p-3 text-sm text-foreground">
                              <div className="font-semibold mb-1 text-amber-800 dark:text-amber-300">Reason</div>
                              <div>{rec.note || "No reason provided."}</div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
                            <button
                              type="button"
                              onClick={() => openLocationMap(rec)}
                              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                            >
                              <MapPin className="h-4 w-4" />
                              View Map
                            </button>
                            <button
                              type="button"
                              onClick={() => approveRecord(rec.id)}
                              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                rejectRecord(
                                  rec.id,
                                  rec.note || "unassigned location",
                                )
                              }
                              className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <table className="min-w-full text-sm divide-y divide-border">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Check In</th>
                      <th className="py-2 pr-4">Check Out</th>
                      <th className="py-2 pr-4">Worked Hours</th>
                      <th className="py-2 pr-4">OT Hours</th>
                      <th className="py-2 pr-4">Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredRecords.map((rec) => {
                      const isHoliday = isHolidayDate(rec.date);
                      const otHours = fmtOvertimeHours(rec);
                      
                      return (
                        <tr
                          key={rec.id}
                          className={rec.status === "ON_LEAVE" ? "bg-violet-500/5 dark:bg-violet-500/10 transition-colors" : "hover:bg-secondary/50 transition-colors"}
                        >
                          <td className="py-3 pr-4 font-medium">{fmtDateDMY(rec.date)}</td>
                          <td className="py-3 pr-4">
                            <span
                              title={isShortDayRecord(rec) ? statusMeta.SHORT_DAY.description : undefined}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                              isShortDayRecord(rec)
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                : rec.status === "ON_LEAVE"
                                  ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                                  : rec.status === "ABSENT"
                                    ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                                    : rec.status === "HOLIDAY"
                                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            }`}>
                              {isShortDayRecord(rec) ? "Short Day" : (statusMeta[rec.status]?.label || rec.status)}
                            </span>
                          </td>
                          {rec.status === "ON_LEAVE" ? (
                            <td colSpan={5} className="py-3 pr-4">
                              <div className="w-full rounded-xl bg-violet-500/10 dark:bg-violet-500/20 border border-violet-200 dark:border-violet-800/40 px-3.5 py-2 text-xs font-semibold text-violet-700 dark:text-violet-300 flex items-center justify-between">
                                <span className="font-bold">On Leave</span>
                                <span className="text-violet-600 dark:text-violet-400 font-medium">{rec.note || "Approved Leave"}</span>
                              </div>
                            </td>
                          ) : (
                            <>
                              <td className="py-3 pr-4">
                                {fmtTime(rec.checkIn) ?? "—"}
                              </td>
                              <td className="py-3 pr-4">
                                {fmtTime(rec.checkOut) ?? "—"}
                              </td>
                              <td className="py-3 pr-4">
                                {fmtWorkedHours(Number(rec.workedHours))}
                              </td>
                              <td className="py-3 pr-4">
                                {otHours ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
                                    {otHours}
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="py-3 pr-4 max-w-xl truncate">
                                {rec.note || "—"}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">
                No {selectedStatusMeta?.label.toLowerCase()} records for{" "}
                {monthNames[month - 1]} {year}.
              </p>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4">
          {Object.entries(statusMeta).map(([key, meta]) => (
            <div
              key={key}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span className={`w-3 h-3 rounded-full ${meta.dot}`} />
              {meta.label}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => navigate(-1)} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-secondary" aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Clock className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Attendance</h1>
            <p className="text-sm text-muted-foreground">
              View employee attendance logs in a calendar.
            </p>
          </div>
        </div>

        {/* Unified Download PDF button in one place */}
        <button
          type="button"
          onClick={handleDownloadAttendancePdf}
          title="Download Attendance PDF"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2.5 text-sm font-bold shadow-2xs transition-colors self-start sm:self-center"
        >
          <Download className="h-4 w-4" />
          <span>Download PDF</span>
        </button>
      </div>

      {/* Controls */}
      {!isAllEmployees && (
        <div className="sticky top-[72px] z-[100] overflow-visible rounded-2xl bg-card/95 backdrop-blur-md border border-border shadow-[0_8px_30px_rgba(0,0,0,0.06)] p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex flex-wrap items-start gap-3">
              {/* 1. Select Employee */}
              <div className="relative employee-dropdown-container w-full sm:w-[300px] sm:min-w-[300px] max-w-full shrink-0">
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                  Select Employee
                </label>

                <div className="relative">
                  <input
                    type="text"
                    value={
                      showEmployeeDropdown
                        ? employeeSearch
                        : selectedId === "all"
                          ? "All Employees"
                          : employees.find((emp) => emp.id === selectedId)
                              ?.fullName || ""
                    }
                    onChange={(e) => {
                      setEmployeeSearch(e.target.value);
                      setShowEmployeeDropdown(true);
                    }}
                    onFocus={() => setShowEmployeeDropdown(true)}
                    placeholder="Search employee..."
                    disabled={loadingEmployees}
                    className="w-full rounded-xl border border-input bg-background px-3.5 py-3 pr-10 text-sm font-semibold text-foreground shadow-sm transition focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                  />

                  {/* Dropdown Arrow */}
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShowEmployeeDropdown((prev) => !prev)}
                    disabled={loadingEmployees}
                    className="absolute right-0 top-0 flex h-full w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                    aria-label="Toggle employee dropdown"
                  >
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        showEmployeeDropdown ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </div>

                {showEmployeeDropdown && !loadingEmployees && (
                  <div className="absolute left-0 right-0 top-full z-[200] mt-2 max-h-60 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-xl">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        handleEmployeeChange("all");
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm hover:bg-secondary ${
                        selectedId === "all" ? "bg-primary/5" : ""
                      }`}
                    >
                      All Employees
                    </button>

                    {employees
                      .filter((emp) => {
                        const search = employeeSearch.trim().toLowerCase();

                        if (!search) return true;

                        return (
                          emp.fullName?.toLowerCase().includes(search) ||
                          emp.employeeCode?.toLowerCase().includes(search)
                        );
                      })
                      .map((emp) => (
                        <button
                          key={emp.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            handleEmployeeChange(emp.id);
                          }}
                          className={`w-full border-t border-border px-4 py-2.5 text-left text-sm hover:bg-secondary ${
                            selectedId === emp.id ? "bg-primary/5" : ""
                          }`}
                        >
                          <div className="font-semibold">{emp.fullName}</div>

                          <div className="text-xs text-muted-foreground">
                            {emp.employeeCode || "No employee code"}
                          </div>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {/* 4. Select Date */}
              <div className="min-w-[160px]">
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                  Date
                </label>

                <input
                  type="date"
                  value={selectedDate}
                  max={todayKey}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSelectedDate(value);
                    setSelectedWeek("");

                    if (value) {
                      const selectedDateObj = new Date(`${value}T00:00:00`);

                      const selectedYear = selectedDateObj.getFullYear();
                      const selectedMonth = selectedDateObj.getMonth() + 1;

                      setYear(selectedYear);
                      setMonth(selectedMonth);
                    }
                  }}
                  className="w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm font-semibold text-foreground shadow-sm transition focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                />
              </div>

              {/* 2. Select Month */}
              <div className="min-w-[150px]">
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                  Month
                </label>
                <select
                  value={month}
                  onChange={(e) => {
                    const nextMonth = Number(e.target.value);
                    setSelectedDate("");
                    // Selecting a month shows the complete month in All Employees view.
                    setSelectedWeek("");
                    setMonth(nextMonth);
                  }}
                  className="w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm font-semibold text-foreground shadow-sm transition focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                >
                  {monthNames.map((name, index) => {
                    const optionMonth = index + 1;
                    const disabled =
                      year === today.getFullYear() &&
                      optionMonth > today.getMonth() + 1;

                    return (
                      <option
                        key={optionMonth}
                        value={optionMonth}
                        disabled={disabled}
                      >
                        {name}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* 3. Select Year */}
              <div className="min-w-[110px]">
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                  Year
                </label>
                <select
                  value={year}
                  onChange={(e) => {
                    const selectedYear = Number(e.target.value);
                    setSelectedDate("");
                    // Keep the complete month view when the year changes.
                    setSelectedWeek("");
                    setYear(selectedYear);

                    if (
                      selectedYear === today.getFullYear() &&
                      month > today.getMonth() + 1
                    ) {
                      setMonth(today.getMonth() + 1);
                    }
                  }}
                  className="w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm font-semibold text-foreground shadow-sm transition focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                >
                  {Array.from(
                    { length: today.getFullYear() - 2020 + 1 },
                    (_, index) => today.getFullYear() - index,
                  ).map((optionYear) => (
                    <option key={optionYear} value={optionYear}>
                      {optionYear}
                    </option>
                  ))}
                </select>
              </div>

              {/* 5. Select Week */}
              <div className="min-w-[150px]">
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                  Week
                </label>

                <select
                  value={selectedWeek}
                  onChange={(e) => {
                    setSelectedWeek(e.target.value);
                    setSelectedDate("");
                  }}
                  className="w-full rounded-xl border border-input bg-background px-3.5 py-3 text-sm font-semibold text-foreground shadow-sm transition focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                >
                  <option value="">Select Week</option>

                  {computeMonthWeeks(year, month).map((week, index) => {
                    const weekNumber = index + 1;

                    return (
                      <option key={weekNumber} value={weekNumber}>
                        {weekNumber}
                        {weekNumber === 1
                          ? "st"
                          : weekNumber === 2
                            ? "nd"
                            : weekNumber === 3
                              ? "rd"
                              : "th"}{" "}
                        Week ({String(week.start.getUTCDate()).padStart(2, "0")}
                        /{String(week.start.getUTCMonth() + 1).padStart(2, "0")}
                        -{String(week.end.getUTCDate()).padStart(2, "0")}/
                        {String(week.end.getUTCMonth() + 1).padStart(2, "0")})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Selected employee / calendar context */}
      {!isAllEmployees && selectedId && (
        <div className="-mt-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Employee Attendance
                </div>
                <div className="truncate text-sm font-bold text-foreground">
                  {employees.find((emp) => emp.id === selectedId)?.fullName ||
                    "Selected Employee"}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-secondary px-3 py-1.5 text-secondary-foreground">
                {monthNames[month - 1]} {year}
              </span>
              <span className="rounded-full bg-primary/10 px-3 py-1.5 text-primary">
                {selectedDate
                  ? "Selected Date"
                  : selectedWeek
                    ? `Week ${selectedWeek}`
                    : "Full Month"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!selectedId ? (
        <div className="rounded-2xl border border-dashed border-border bg-background p-12 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mb-4">
            <Users className="h-7 w-7 text-muted-foreground" />
          </div>
          <h2 className="font-display text-lg font-semibold mb-1">
            Select an employee
          </h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Choose an employee above to view their attendance calendar for the
            selected month.
          </p>
        </div>
      ) : (
        <>
          {!isAllEmployees && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 items-stretch">
              {Object.entries(statusMeta).map(([key, meta]) => {
                const isActive = selectedStatus === key;
                const count =
                  key === "HOLIDAY"
                    ? records.filter(
                        (rec) =>
                          isHolidayDate(rec.date) || rec.status === "HOLIDAY",
                      ).length
                    : key === "SHORT_DAY"
                      ? (summary?.SHORT_DAY ?? shortDays)
                      : summary[key] || 0;

                return (
                  <button
                    key={key}
                    type="button"
                    title={meta.description || meta.label}
                    onClick={() => handleStatusClick(key)}
                    className={`h-full flex flex-col justify-between rounded-xl border p-4 text-left transition-colors ${
                      isActive
                        ? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/20"
                        : "border-border bg-background card-shadow hover:bg-secondary/40"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${meta.dot}`}
                        />
                        <span className="text-xs text-muted-foreground truncate">
                          {meta.label}
                        </span>
                      </div>
                      <div className="font-display text-xl font-bold">
                        {count}
                      </div>
                    </div>
                    <div className="mt-1 text-[11px] font-semibold min-h-[16px] leading-tight">
                      {key === "PRESENT" ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {fmtMinutesToHM(presentTotals.workedMinutes)} worked
                        </span>
                      ) : key === "SHORT_DAY" ? (
                        <span className="text-amber-600 dark:text-amber-400">
                          {fmtMinutesToHM(shortDayTotals.workedMinutes)} worked
                        </span>
                      ) : (
                        <span>&nbsp;</span>
                      )}
                    </div>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => handleStatusClick("OVERTIME")}
                className="h-full flex flex-col justify-between rounded-xl border border-orange-200 dark:border-orange-800/40 bg-orange-50/70 dark:bg-orange-950/20 p-4 text-left transition-colors hover:bg-orange-100/70 dark:hover:bg-orange-900/30 focus:outline-none focus:ring-2 focus:ring-orange-300"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                    <span className="text-xs text-orange-700 dark:text-orange-300 truncate">Overtime Days</span>
                  </div>
                  <div className="font-display text-xl font-bold text-orange-900 dark:text-orange-200">
                    {overtimeDays} {overtimeDays === 1 ? "day" : "days"}
                  </div>
                </div>
                <div className="mt-1 text-[11px] font-semibold text-orange-700 dark:text-orange-300 min-h-[16px] leading-tight">
                  {fmtMinutesToHM(individualTotals.otMinutes)} OT
                </div>
              </button>
            </div>
          )}

          {isAllEmployees ? (
            <div className="rounded-2xl border border-border bg-card shadow-[0_10px_35px_rgba(0,0,0,0.07)] overflow-visible">
              {/* Redesigned Filter Toolbar for Team Attendance */}
              <div className="rounded-t-2xl bg-card border-b border-border/80 p-4 sm:p-5 shadow-2xs">
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
                    {/* 1. Select Employee */}
                    <div className="relative employee-dropdown-container lg:col-span-4 w-full">
                      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-foreground">
                        <Users className="h-3.5 w-3.5 text-primary" />
                        <span>Select Employee</span>
                      </label>

                      <div className="relative">
                        <input
                          type="text"
                          value={
                            showEmployeeDropdown
                              ? employeeSearch
                              : selectedId === "all"
                                ? "All Employees"
                                : employees.find((emp) => emp.id === selectedId)
                                    ?.fullName || ""
                          }
                          onChange={(e) => {
                            setEmployeeSearch(e.target.value);
                            setShowEmployeeDropdown(true);
                          }}
                          onFocus={() => setShowEmployeeDropdown(true)}
                          placeholder="Search employee..."
                          disabled={loadingEmployees}
                          className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 pr-10 text-sm font-semibold text-foreground shadow-2xs transition focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />

                        {/* Dropdown Arrow */}
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() =>
                            setShowEmployeeDropdown((prev) => !prev)
                          }
                          disabled={loadingEmployees}
                          className="absolute right-0 top-0 flex h-full w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                          aria-label="Toggle employee dropdown"
                        >
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${
                              showEmployeeDropdown ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                      </div>

                      {showEmployeeDropdown && !loadingEmployees && (
                        <div className="absolute left-0 right-0 top-full z-[200] mt-2 max-h-60 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-xl">
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              handleEmployeeChange("all");
                            }}
                            className={`w-full px-4 py-2.5 text-left text-sm font-semibold hover:bg-secondary ${
                              selectedId === "all" ? "bg-primary/5 text-primary" : ""
                            }`}
                          >
                            All Employees
                          </button>

                          {employees
                            .filter((emp) => {
                              const search = employeeSearch
                                .trim()
                                .toLowerCase();

                              if (!search) return true;

                              return (
                                emp.fullName?.toLowerCase().includes(search) ||
                                emp.employeeCode?.toLowerCase().includes(search)
                              );
                            })
                            .map((emp) => (
                              <button
                                key={emp.id}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  handleEmployeeChange(emp.id);
                                }}
                                className={`w-full border-t border-border px-4 py-2.5 text-left text-sm hover:bg-secondary ${
                                  selectedId === emp.id ? "bg-primary/5 text-primary font-bold" : ""
                                }`}
                              >
                                <div className="font-semibold">
                                  {emp.fullName}
                                </div>

                                <div className="text-xs text-muted-foreground">
                                  {emp.employeeCode || "No employee code"}
                                </div>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>

                    {/* 2. Select Date */}
                    <div className="lg:col-span-2 w-full">
                      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-foreground">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Date</span>
                      </label>

                      <input
                        type="date"
                        value={selectedDate}
                        max={todayKey}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSelectedDate(value);
                          setSelectedWeek("");

                          if (value) {
                            const selectedDateObj = new Date(
                              `${value}T00:00:00`,
                            );

                            const selectedYear = selectedDateObj.getFullYear();
                            const selectedMonth =
                              selectedDateObj.getMonth() + 1;

                            setYear(selectedYear);
                            setMonth(selectedMonth);
                          }
                        }}
                        className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-semibold text-foreground shadow-2xs transition focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>

                    {/* 3. Select Month */}
                    <div className="lg:col-span-2 w-full">
                      <label className="mb-1.5 block text-xs font-bold text-foreground">
                        Month
                      </label>
                      <select
                        value={month}
                        onChange={(e) => {
                          const nextMonth = Number(e.target.value);
                          setSelectedDate("");
                          setSelectedWeek("");
                          setMonth(nextMonth);
                        }}
                        className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-semibold text-foreground shadow-2xs transition focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      >
                        {monthNames.map((name, index) => {
                          const optionMonth = index + 1;
                          const disabled =
                            year === today.getFullYear() &&
                            optionMonth > today.getMonth() + 1;

                          return (
                            <option
                              key={optionMonth}
                              value={optionMonth}
                              disabled={disabled}
                            >
                              {name}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* 4. Select Year */}
                    <div className="lg:col-span-1 w-full">
                      <label className="mb-1.5 block text-xs font-bold text-foreground">
                        Year
                      </label>
                      <select
                        value={year}
                        onChange={(e) => {
                          const selectedYear = Number(e.target.value);
                          setSelectedDate("");
                          setSelectedWeek("");
                          setYear(selectedYear);

                          if (
                            selectedYear === today.getFullYear() &&
                            month > today.getMonth() + 1
                          ) {
                            setMonth(today.getMonth() + 1);
                          }
                        }}
                        className="w-full rounded-xl border border-input bg-background px-2.5 py-2.5 text-sm font-semibold text-foreground shadow-2xs transition focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      >
                        {Array.from(
                          { length: today.getFullYear() - 2020 + 1 },
                          (_, index) => today.getFullYear() - index,
                        ).map((optionYear) => (
                          <option key={optionYear} value={optionYear}>
                            {optionYear}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 5. Select Week (Sunday to Saturday) */}
                    <div className="lg:col-span-3 w-full">
                      <label className="mb-1.5 flex items-center justify-between text-xs font-bold text-foreground">
                        <span>Week (Sun - Sat)</span>
                        {selectedWeek && (
                          <button
                            type="button"
                            onClick={() => setSelectedWeek("")}
                            className="text-[10px] text-primary hover:underline font-semibold"
                          >
                            Reset
                          </button>
                        )}
                      </label>

                      <select
                        value={selectedWeek}
                        onChange={(e) => {
                          setSelectedWeek(e.target.value);
                          setSelectedDate("");
                        }}
                        className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-semibold text-foreground shadow-2xs transition focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      >
                        <option value="">Full Month (All Weeks)</option>

                        {computeMonthWeeks(year, month).map((week, index) => (
                          <option key={index} value={index + 1}>
                            {index + 1}
                            {index === 0
                              ? "st"
                              : index === 1
                                ? "nd"
                                : index === 2
                                  ? "rd"
                                  : "th"}{" "}
                            Week ({String(week.start.getUTCDate()).padStart(2, "0")}/
                            {String(week.start.getUTCMonth() + 1).padStart(2, "0")}
                            -{String(week.end.getUTCDate()).padStart(2, "0")}/
                            {String(week.end.getUTCMonth() + 1).padStart(2, "0")})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Legend Bar (Clean, without top zoom) */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-secondary/30 px-5 py-2.5 text-xs font-semibold text-muted-foreground">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>Present</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    <span>Short Day (&lt;8h)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    <span>Absent</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-violet-500" />
                    <span>Leave</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    <span>Holiday / Sun</span>
                  </div>
                </div>

                <div className="text-[11px] font-bold text-muted-foreground">
                  Showing {registerEmployees.length} employees &bull; {visibleRegisterDates.length} days
                </div>
              </div>

              {/* Selected Single Date View vs. Monthly Matrix View */}
              {selectedDate && isAllEmployees ? (
                (() => {
                  const targetDate = visibleRegisterDates[0] || new Date(`${selectedDate}T00:00:00Z`);
                  const dateKey = formatDateKey(targetDate);
                  const isRegisterToday = dateKey === todayKey;
                  const isSunday = targetDate.getUTCDay() === 0;
                  const isSaturday = targetDate.getUTCDay() === 6;

                  const holidayName = registerData?.holidays?.find(
                    (h) => formatDateKey(new Date(h.date)) === dateKey,
                  )?.name;
                  const isHolidayDate = Boolean(holidayName) || isSunday;

                  // Compute summary stats for this specific day across all registerEmployees
                  let presentCount = 0;
                  let shortDayCount = 0;
                  let absentCount = 0;
                  let leaveCount = 0;
                  let holidayCount = 0;
                  let totalWorkedMinutes = 0;
                  let totalOtMinutes = 0;

                  registerEmployees.forEach((emp) => {
                    let rec = attendanceByDateEmployee.get(`${dateKey}:${emp.id}`);
                    if (rec && rec.status === "ABSENT" && dateKey >= todayKey) {
                      rec = null;
                    }
                    const isHol = isHolidayDate || rec?.status === "HOLIDAY";
                    if (isHol && !isWorkedRecord(rec)) {
                      holidayCount++;
                    } else if (rec?.status === "ABSENT") {
                      absentCount++;
                    } else if (rec?.status === "ON_LEAVE") {
                      leaveCount++;
                    } else if (rec && isWorkedRecord(rec)) {
                      if (isShortDayRecord(rec)) {
                        shortDayCount++;
                      } else {
                        presentCount++;
                      }
                      if (rec.workedHours != null) {
                        const actualWorkedHrs = isHol ? 0 : Number(rec.workedHours);
                        totalWorkedMinutes += Math.round(actualWorkedHrs * 60);
                        const otHrs = isHol ? Number(rec.workedHours) : Math.max(0, Number(rec.workedHours) - 8);
                        totalOtMinutes += Math.round(otHrs * 60);
                      }
                    }
                  });

                  const totalWorkedFormatted = `${Math.floor(totalWorkedMinutes / 60)}h ${totalWorkedMinutes % 60}m`;
                  const totalOtFormatted = totalOtMinutes > 0 ? `${Math.floor(totalOtMinutes / 60)}h ${totalOtMinutes % 60}m` : null;

                  return (
                    <div className="flex flex-col bg-card border-t border-border">
                      {/* Daily Highlights & Overview Header */}
                      <div className="border-b border-border/80 bg-linear-to-r from-primary/5 via-background to-secondary/30 px-6 py-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl font-display text-lg font-black shadow-xs ${
                              isRegisterToday
                                ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                                : isSunday
                                  ? "bg-rose-500/20 text-rose-600 dark:text-rose-400"
                                  : "bg-secondary text-foreground border border-border"
                            }`}>
                              {String(targetDate.getUTCDate()).padStart(2, "0")}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-base font-extrabold text-foreground">
                                  {weekdays[targetDate.getUTCDay()]}, {targetDate.getUTCDate()} {monthNames[targetDate.getUTCMonth()]} {targetDate.getUTCFullYear()}
                                </h3>
                                {isRegisterToday && (
                                  <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-black uppercase text-primary-foreground shadow-2xs">
                                    Today
                                  </span>
                                )}
                                {holidayName && (
                                  <span className="rounded-full bg-blue-500/15 border border-blue-500/30 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:text-blue-300">
                                    {holidayName}
                                  </span>
                                )}
                                {isSunday && (
                                  <span className="rounded-full bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 text-xs font-bold text-rose-700 dark:text-rose-300">
                                    Sunday Off
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Showing attendance status for {registerEmployees.length} registered employees
                              </p>
                            </div>
                          </div>

                          {/* Quick Stats Pill Strip */}
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
                            <div className="flex items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 font-bold text-emerald-700 dark:text-emerald-300">
                              <span className="h-2 w-2 rounded-full bg-emerald-500" />
                              <span>Present: {presentCount}</span>
                            </div>
                            {shortDayCount > 0 && (
                              <div className="flex items-center gap-1.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 font-bold text-amber-700 dark:text-amber-300">
                                <span className="h-2 w-2 rounded-full bg-amber-500" />
                                <span>Short: {shortDayCount}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-1.5 font-bold text-rose-700 dark:text-rose-300">
                              <span className="h-2 w-2 rounded-full bg-rose-500" />
                              <span>Absent: {absentCount}</span>
                            </div>
                            {leaveCount > 0 && (
                              <div className="flex items-center gap-1.5 rounded-xl border border-violet-500/25 bg-violet-500/10 px-3 py-1.5 font-bold text-violet-700 dark:text-violet-300">
                                <span className="h-2 w-2 rounded-full bg-violet-500" />
                                <span>Leave: {leaveCount}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 rounded-xl border border-primary/25 bg-primary/10 px-3 py-1.5 font-bold text-primary">
                              <span>Total Worked: {totalWorkedFormatted}</span>
                              {totalOtFormatted && (
                                <span className="ml-1 text-[11px] text-orange-600 dark:text-orange-400 font-extrabold">
                                  (+{totalOtFormatted} OT)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Clean Dedicated Daily Attendance Data Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                          <thead>
                            <tr className="border-b border-border bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                              <th className="px-5 py-3.5 w-[280px]">Employee</th>
                              <th className="px-4 py-3.5 w-[160px] text-center">Status</th>
                              <th className="px-4 py-3.5 w-[160px]">Punch In</th>
                              <th className="px-4 py-3.5 w-[160px]">Punch Out</th>
                              <th className="px-4 py-3.5 w-[150px] text-center">Worked Hours</th>
                              <th className="px-4 py-3.5 w-[130px] text-center">Overtime</th>
                              <th className="px-5 py-3.5 min-w-[200px]">Notes & Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {registerEmployees.length > 0 ? (
                              registerEmployees.map((emp) => {
                                let rec = attendanceByDateEmployee.get(`${dateKey}:${emp.id}`);
                                if (rec && rec.status === "ABSENT" && dateKey >= todayKey) {
                                  rec = null;
                                }

                                const isHoliday = isHolidayDate || rec?.status === "HOLIDAY";
                                const isAbsent = rec?.status === "ABSENT";
                                const isShortDay = isShortDayRecord(rec);
                                const isWorked = isWorkedRecord(rec);
                                const meta = rec ? (isShortDay ? statusMeta.SHORT_DAY : statusMeta[rec.status]) : null;
                                const checkInLocationCode = getCalendarLocationCode(rec?.note, "check-in");
                                const checkOutLocationCode = getCalendarLocationCode(rec?.note, "check-out");
                                const overtimeText = fmtOvertimeHours(rec, isHoliday);
                                const hasReason = hasSubmittedReason(rec?.note);

                                return (
                                  <tr
                                    key={emp.id}
                                    className="group hover:bg-muted/40 transition-colors"
                                  >
                                    {/* Employee Info */}
                                    <td className="px-5 py-3.5 align-middle">
                                      <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-extrabold text-primary shadow-2xs">
                                          {emp.fullName
                                            .split(" ")
                                            .map((name) => name[0])
                                            .join("")
                                            .slice(0, 2)
                                            .toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                          <div
                                            className="font-bold text-foreground text-sm hover:text-primary transition-colors cursor-pointer leading-tight"
                                            title={emp.fullName}
                                            onClick={() => handleEmployeeChange(emp.id)}
                                          >
                                            {emp.fullName.split(" ").map((part, pIdx) => (
                                              <div key={pIdx} className="break-words">{part}</div>
                                            ))}
                                          </div>
                                          <div className="flex items-center gap-2 mt-0.5">
                                            {emp.employeeCode ? (
                                              <span className="rounded-md bg-secondary border border-border/70 px-1.5 py-0.2 text-[11px] font-bold text-muted-foreground">
                                                {emp.employeeCode}
                                              </span>
                                            ) : (
                                              <span className="text-[11px] text-muted-foreground truncate" title={emp.email}>
                                                {emp.email}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </td>

                                    {/* Status Badge */}
                                    <td className="px-4 py-3.5 align-middle text-center">
                                      {isHoliday && !isWorked ? (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/15 border border-blue-500/25 px-3 py-1 text-xs font-bold text-blue-700 dark:text-blue-300">
                                          <span className="h-2 w-2 rounded-full bg-blue-500" />
                                          {holidayName || (isSunday ? "Sunday" : "Holiday")}
                                        </span>
                                      ) : isAbsent ? (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 border border-rose-500/25 px-3 py-1 text-xs font-bold text-rose-700 dark:text-rose-300">
                                          <span className="h-2 w-2 rounded-full bg-rose-500" />
                                          Absent
                                        </span>
                                      ) : rec?.status === "ON_LEAVE" ? (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/15 border border-violet-500/25 px-3 py-1 text-xs font-bold text-violet-700 dark:text-violet-300">
                                          <span className="h-2 w-2 rounded-full bg-violet-500" />
                                          On Leave
                                        </span>
                                      ) : isWorked ? (
                                        <span
                                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold shadow-2xs ${
                                            meta?.cell || "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25"
                                          }`}
                                        >
                                          <span className={`h-2 w-2 rounded-full ${meta?.dot || "bg-emerald-500"}`} />
                                          {meta?.label || rec.status}
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                                          — No Punch
                                        </span>
                                      )}
                                    </td>

                                    {/* Punch In */}
                                    <td className="px-4 py-3.5 align-middle">
                                      {rec?.checkIn ? (
                                        <div className="flex items-center gap-2">
                                          <div className="flex flex-col">
                                            <span className="font-extrabold text-foreground text-sm">
                                              {fmtTime(rec.checkIn)}
                                            </span>
                                            <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">
                                              Check In
                                            </span>
                                          </div>
                                          {checkInLocationCode && (
                                            <span
                                              title={`Check In Location: ${checkInLocationCode === "UL" ? "Unassigned Location" : checkInLocationCode === "A" ? "Assigned Location" : "Office"}`}
                                              className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${
                                                checkInLocationCode === "UL"
                                                  ? "bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/25"
                                                  : "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25"
                                              }`}
                                            >
                                              {checkInLocationCode}
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-xs text-muted-foreground font-semibold">—</span>
                                      )}
                                    </td>

                                    {/* Punch Out */}
                                    <td className="px-4 py-3.5 align-middle">
                                      {rec?.checkOut ? (
                                        <div className="flex items-center gap-2">
                                          <div className="flex flex-col">
                                            <span className="font-extrabold text-foreground text-sm">
                                              {fmtTime(rec.checkOut)}
                                            </span>
                                            <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400">
                                              Check Out
                                            </span>
                                          </div>
                                          {checkOutLocationCode && (
                                            <span
                                              title={`Check Out Location: ${checkOutLocationCode === "UL" ? "Unassigned Location" : checkOutLocationCode === "A" ? "Assigned Location" : "Office"}`}
                                              className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${
                                                checkOutLocationCode === "UL"
                                                  ? "bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/25"
                                                  : "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25"
                                              }`}
                                            >
                                              {checkOutLocationCode}
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-xs text-muted-foreground font-semibold">—</span>
                                      )}
                                    </td>

                                    {/* Worked Hours */}
                                    <td className="px-4 py-3.5 align-middle text-center">
                                      {rec?.workedHours != null ? (
                                        <span className="inline-flex items-center justify-center rounded-lg bg-secondary border border-border/80 px-2.5 py-1 text-xs font-bold text-foreground">
                                          {fmtWorkedHours(isHoliday ? 0 : Number(rec.workedHours))}
                                        </span>
                                      ) : (
                                        <span className="text-xs text-muted-foreground font-semibold">—</span>
                                      )}
                                    </td>

                                    {/* Overtime */}
                                    <td className="px-4 py-3.5 align-middle text-center">
                                      {overtimeText ? (
                                        <span className="inline-flex items-center justify-center rounded-lg bg-orange-500/15 border border-orange-500/25 px-2.5 py-1 text-xs font-extrabold text-orange-600 dark:text-orange-400">
                                          +{overtimeText}
                                        </span>
                                      ) : (
                                        <span className="text-xs text-muted-foreground font-medium">—</span>
                                      )}
                                    </td>

                                    {/* Notes & Actions */}
                                    <td className="px-5 py-3.5 align-middle">
                                      <div className="flex items-center gap-2">
                                        {hasReason ? (
                                          <button
                                            type="button"
                                            onClick={() => openAttendanceReason(rec, emp.fullName, emp.id)}
                                            className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 border border-amber-500/25 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 transition-colors cursor-pointer"
                                          >
                                            View Reason
                                          </button>
                                        ) : rec?.note ? (
                                          <span className="text-xs text-muted-foreground truncate max-w-[240px]" title={rec.note}>
                                            {rec.note}
                                          </span>
                                        ) : (
                                          <span className="text-xs text-muted-foreground/60">—</span>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                                  No employees registered.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()
              ) : (
                /* Full Month / Multi-Week Matrix Calendar Table */
                <div className="relative max-h-[calc(80vh-160px)] min-h-[400px] overflow-auto overscroll-contain bg-card border-t border-border">
                  <table
                    className="w-full border-separate border-spacing-0 text-sm min-w-[1485px]"
                    style={{ zoom: `${calendarZoom}%` }}
                  >
                    <thead>
                      <tr>
                        <th
                          className="sticky left-0 top-0 z-[40]
                            border-r-2 border-b-2 border-border border-b-blue-600
                            bg-white dark:bg-slate-900 px-3 py-2.5
                            text-left shadow-[4px_0_8px_rgba(0,0,0,0.06)] w-[175px] min-w-[160px] max-w-[185px]"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-extrabold uppercase tracking-widest text-blue-700 dark:text-blue-300">
                              Team Members
                            </span>
                            <span className="rounded-full bg-blue-500/15 border border-blue-500/25 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:text-blue-300">
                              {registerEmployees.length}
                            </span>
                          </div>

                          <div className="mt-1 text-sm font-bold text-foreground truncate">
                            {selectedWeek
                              ? `Week ${selectedWeek} Attendance`
                              : `${monthNames[month - 1]} ${year}`}
                          </div>
                        </th>

                        {visibleRegisterDates.map((date) => {
                          const dateKey = formatDateKey(date);
                          const isRegisterToday = dateKey === todayKey;
                          const isSunday = date.getUTCDay() === 0;
                          const isSaturday = date.getUTCDay() === 6;

                          return (
                            <th
                              key={dateKey}
                              className={`sticky top-0 z-[30] border-b-2 px-4 py-3 text-center shadow-[0_4px_6px_-1px_rgba(0,0,0,0.06)] min-w-[200px] max-w-[220px] ${
                                isRegisterToday
                                  ? "bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border-b-blue-600"
                                  : isSunday
                                    ? "bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-b-rose-500"
                                    : isSaturday
                                      ? "bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border-b-blue-500"
                                      : "bg-card text-foreground border-b-blue-600/30"
                              }`}
                            >
                              <div className="flex items-center justify-center gap-1.5">
                                <span
                                  className={`text-xs font-extrabold uppercase tracking-wider ${
                                    isSunday
                                      ? "text-rose-600 dark:text-rose-400"
                                      : isRegisterToday
                                        ? "text-blue-700 dark:text-blue-300"
                                        : "text-blue-900/80 dark:text-blue-300/90"
                                  }`}
                                >
                                  {weekdays[date.getUTCDay()]}
                                </span>
                                {isRegisterToday && (
                                  <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-black uppercase text-white shadow-xs">
                                    Today
                                  </span>
                                )}
                              </div>

                              <div
                                className={`mx-auto mt-1 flex h-9 w-9 items-center justify-center rounded-xl font-display text-base font-bold ${
                                  isRegisterToday
                                    ? "bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/30"
                                    : isSunday
                                      ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                                      : "bg-blue-500/10 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200 border border-blue-500/20"
                                }`}
                              >
                                {String(date.getUTCDate()).padStart(2, "0")}
                              </div>

                              <div className="mt-0.5 text-xs font-semibold text-muted-foreground/90">
                                {String(date.getUTCMonth() + 1).padStart(2, "0")}/{date.getUTCFullYear()}
                              </div>
                            </th>
                          );
                        })}

                        {isAllEmployees && !selectedDate && !selectedWeek && (
                          <>
                            <th className="sticky top-0 z-[30] min-w-[75px] border-l border-b-2 border-border/80 border-b-emerald-500 bg-card px-2 py-3 text-center text-xs font-bold text-emerald-600 dark:text-emerald-400 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.06)]">
                              Present
                            </th>
                            <th
                              className="sticky top-0 z-[30] min-w-[75px] border-b-2 border-border/80 border-b-amber-500 bg-card px-2 py-3 text-center text-xs font-bold text-amber-600 dark:text-amber-400 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.06)]"
                              title="Short Day: Worked hours less than standard 8 hours"
                            >
                              Short
                            </th>
                            <th className="sticky top-0 z-[30] min-w-[75px] border-b-2 border-border/80 border-b-rose-500 bg-card px-2 py-3 text-center text-xs font-bold text-rose-600 dark:text-rose-400 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.06)]">
                              Absent
                            </th>
                            <th className="sticky top-0 z-[30] min-w-[75px] border-b-2 border-border/80 border-b-violet-500 bg-card px-2 py-3 text-center text-xs font-bold text-violet-600 dark:text-violet-400 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.06)]">
                              Leave
                            </th>
                            <th className="sticky top-0 z-[30] min-w-[75px] border-b-2 border-border/80 border-b-blue-500 bg-card px-2 py-3 text-center text-xs font-bold text-blue-600 dark:text-blue-400 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.06)]">
                              Holiday
                            </th>
                            <th className="sticky top-0 z-[30] min-w-[105px] border-b-2 border-border/80 border-b-blue-600 bg-card px-2.5 py-3 text-center text-xs font-bold text-blue-700 dark:text-blue-300 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.06)]">
                              Worked
                            </th>
                            <th className="sticky top-0 z-[30] min-w-[95px] border-b-2 border-border/80 border-b-amber-500 bg-card px-2.5 py-3 text-center text-xs font-bold text-amber-700 dark:text-amber-300 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.06)]">
                              Overtime
                            </th>
                          </>
                        )}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-border/60">
                      {registerEmployees.length > 0 ? (
                        registerEmployees.map((emp) => (
                          <tr key={emp.id} className="group hover:bg-muted/30 transition-colors">
                            {/* Sticky Employee Details Column (compact width matching header) */}
                            <td className="sticky left-0 z-[25] border-r-2 border-b border-border/90 bg-white dark:bg-slate-900 px-3 py-2.5 shadow-[4px_0_8px_rgba(0,0,0,0.06)] transition-colors group-hover:bg-slate-50 dark:group-hover:bg-slate-800/80 w-[175px] min-w-[160px] max-w-[185px]">
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-black text-primary shadow-2xs">
                                  {emp.fullName
                                    .split(" ")
                                    .map((name) => name[0])
                                    .join("")
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div
                                    className="text-sm font-bold text-foreground hover:text-primary transition-colors cursor-pointer leading-tight"
                                    title={emp.fullName}
                                    onClick={() => handleEmployeeChange(emp.id)}
                                  >
                                    {emp.fullName.split(" ").map((part, pIdx) => (
                                      <div key={pIdx} className="break-words">{part}</div>
                                    ))}
                                  </div>

                                  <div className="flex items-center gap-1.5 mt-1">
                                    {emp.employeeCode && emp.employeeCode !== emp.fullName ? (
                                      <span className="rounded bg-secondary border border-border/70 px-1.5 py-0.5 text-xs font-bold text-foreground/80">
                                        {emp.employeeCode}
                                      </span>
                                    ) : null}
                                    {emp.email && !emp.employeeCode && (
                                      <span className="break-all text-xs text-muted-foreground" title={emp.email}>
                                        {emp.email}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {visibleRegisterDates.map((date) => {
                              const dateKey = formatDateKey(date);
                              const isRegisterToday = dateKey === todayKey;
                              const isSunday = date.getUTCDay() === 0;
                              const isSaturday = date.getUTCDay() === 6;

                              let rec = attendanceByDateEmployee.get(
                                `${dateKey}:${emp.id}`,
                              );

                              if (
                                rec &&
                                rec.status === "ABSENT" &&
                                dateKey >= todayKey
                              ) {
                                rec = null;
                              }

                              const holidayName = registerData?.holidays?.find(
                                (h) =>
                                  formatDateKey(new Date(h.date)) === dateKey,
                              )?.name;

                              const isHoliday =
                                Boolean(holidayName) ||
                                rec?.status === "HOLIDAY" ||
                                isSunday;
                              const isAbsent = rec?.status === "ABSENT";
                              const isShortDay = isShortDayRecord(rec);
                              const meta = rec ? (isShortDay ? statusMeta.SHORT_DAY : statusMeta[rec.status]) : null;
                              const checkInLocationCode = getCalendarLocationCode(
                                rec?.note,
                                "check-in",
                              );
                              const checkOutLocationCode =
                                getCalendarLocationCode(rec?.note, "check-out");
                              const overtimeText = fmtOvertimeHours(rec, isHoliday);

                              return (
                                <td
                                  key={dateKey}
                                  className={`border-b border-border/60 px-2 py-2 align-middle text-center bg-card ${
                                    isRegisterToday
                                      ? "bg-primary/[0.04]"
                                      : isSunday
                                        ? "bg-rose-500/[0.02]"
                                        : isSaturday
                                          ? "bg-secondary/25"
                                          : ""
                                  }`}
                                >
                                  {isHoliday && !isWorkedRecord(rec) ? (
                                    <div className="flex min-h-[110px] flex-col items-center justify-center rounded-xl border border-blue-200/60 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 text-center shadow-2xs p-2">
                                      <div className="h-2.5 w-2.5 rounded-full bg-blue-500 mb-1.5" />
                                      <div className="text-sm font-bold text-blue-700 dark:text-blue-300 line-clamp-1 px-1">
                                        {holidayName || rec?.note || (isSunday ? "Sunday" : "Holiday")}
                                      </div>
                                      <div className="text-xs font-semibold text-blue-600/80 dark:text-blue-400/80 mt-0.5">
                                        {isSunday ? "Weekly Off" : "Public Holiday"}
                                      </div>
                                    </div>
                                  ) : isAbsent ? (
                                    <div className="flex min-h-[110px] flex-col items-center justify-center rounded-xl border border-rose-200/60 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 text-center shadow-2xs p-2">
                                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/15 text-sm font-bold text-rose-600 dark:text-rose-400 mb-1.5">
                                        ✕
                                      </div>
                                      <div className="text-sm font-extrabold text-rose-700 dark:text-rose-300">
                                        Absent
                                      </div>
                                      <div className="text-xs text-rose-600/80 dark:text-rose-400/80 font-medium mt-0.5">
                                        No Punch Recorded
                                      </div>
                                    </div>
                                  ) : rec?.status === "ON_LEAVE" ? (
                                    <div className="flex min-h-[110px] flex-col items-center justify-center rounded-xl border border-violet-200/60 dark:border-violet-900/40 bg-violet-50/40 dark:bg-violet-950/20 text-center shadow-2xs p-2">
                                      <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/15 px-3 py-1 text-xs font-bold text-violet-700 dark:text-violet-300">
                                        <span className="h-2 w-2 rounded-full bg-violet-500" />
                                        On Leave
                                      </span>
                                      {rec.note && (
                                        <div className="mt-2 text-xs font-medium text-violet-600 dark:text-violet-400 line-clamp-2 px-1" title={rec.note}>
                                          {rec.note}
                                        </div>
                                      )}
                                    </div>
                                  ) : rec ? (
                                    /* Active Attendance Card */
                                    <div className="flex flex-col justify-between rounded-xl border border-border/90 bg-card text-left shadow-2xs hover:border-primary/40 hover:shadow-sm transition-all duration-150 p-2 min-h-[110px]">
                                      {/* Card Header: Status Pill & Location tags */}
                                      <div className="flex items-center justify-between gap-1 mb-2">
                                        <span
                                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-bold leading-none text-[11px] ${meta?.cell || "bg-secondary text-foreground"}`}
                                          title={meta?.description || meta?.label}
                                        >
                                          <span className={`h-2 w-2 rounded-full ${meta?.dot || "bg-current"}`} />
                                          <span className="truncate max-w-[120px]">{meta?.label || rec.status}</span>
                                        </span>

                                        <div className="flex items-center gap-1 shrink-0">
                                          {checkInLocationCode && (
                                            <span
                                              title={`Check In Location: ${checkInLocationCode === "UL" ? "Unassigned" : checkInLocationCode === "A" ? "Assigned" : "Office"}`}
                                              className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${
                                                checkInLocationCode === "UL"
                                                  ? "bg-orange-500/15 text-orange-700 dark:text-orange-300"
                                                  : "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                                              }`}
                                            >
                                              {checkInLocationCode}
                                            </span>
                                          )}
                                          {checkOutLocationCode && (
                                            <span
                                              title={`Check Out Location: ${checkOutLocationCode === "UL" ? "Unassigned" : checkOutLocationCode === "A" ? "Assigned" : "Office"}`}
                                              className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${
                                                checkOutLocationCode === "UL"
                                                  ? "bg-orange-500/15 text-orange-700 dark:text-orange-300"
                                                  : "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                                              }`}
                                            >
                                              {checkOutLocationCode}
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Punch In / Out chips */}
                                      <div className="grid gap-2 mb-2 grid-cols-2">
                                        <div className="rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 px-2.5 py-1.5 flex flex-col justify-center">
                                          <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                            In
                                          </div>
                                          <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap tabular-nums">
                                            {rec.checkIn ? fmtTime(rec.checkIn) : "—"}
                                          </div>
                                        </div>
                                        <div className="rounded-xl bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/20 px-2.5 py-1.5 flex flex-col justify-center">
                                          <div className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
                                            Out
                                          </div>
                                          <div className="text-xs font-bold text-rose-700 dark:text-rose-400 whitespace-nowrap tabular-nums">
                                            {rec.checkOut ? fmtTime(rec.checkOut) : "—"}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Worked Hours & OT footer */}
                                      {rec.workedHours != null && (
                                        <div className="flex items-center justify-between rounded-lg bg-secondary/70 px-2.5 py-1.5 text-xs font-bold">
                                          <span className="text-foreground">
                                            {fmtWorkedHours(isHoliday ? 0 : Number(rec.workedHours))}
                                          </span>
                                          {overtimeText && (
                                            <span className="rounded-md bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-extrabold text-orange-600 dark:text-orange-400">
                                              +{overtimeText}
                                            </span>
                                          )}
                                        </div>
                                      )}

                                      {/* View Reason button */}
                                      {hasSubmittedReason(rec.note) && (
                                        <div className="mt-1.5">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openAttendanceReason(rec, emp.fullName, emp.id);
                                            }}
                                            className="w-full rounded-lg bg-amber-500/15 px-2 py-1 text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 text-center transition-colors cursor-pointer"
                                          >
                                            View Reason
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    /* Empty Day Cell */
                                    <div className="flex min-h-[110px] flex-col items-center justify-center rounded-xl border border-dashed border-border/50 bg-secondary/15 text-center p-2">
                                      <span className="text-sm text-muted-foreground/50 font-bold">—</span>
                                      <span className="text-xs text-muted-foreground/60 font-medium mt-0.5">No punch</span>
                                    </div>
                                  )}
                                </td>
                              );
                            })}

                            {/* Summary Totals Columns */}
                            {isAllEmployees && !selectedDate && !selectedWeek && (
                              (() => {
                                const monthSummary = getEmployeeMonthSummary(emp);

                                return (
                                  <>
                                    <td className="border-l border-b border-border/80 bg-emerald-500/[0.03] px-2 py-2 text-center align-middle">
                                      <span className="inline-flex min-w-[32px] items-center justify-center rounded-lg bg-emerald-500/15 px-2 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                        {monthSummary.present}
                                      </span>
                                    </td>
                                    <td
                                      className="border-b border-border/80 bg-amber-500/[0.03] px-2 py-2 text-center align-middle"
                                      title={`Short Days: ${monthSummary.shortDay} (Worked < 8 hrs)`}
                                    >
                                      <span className="inline-flex min-w-[32px] items-center justify-center rounded-lg bg-amber-500/15 px-2 py-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                                        {monthSummary.shortDay}
                                      </span>
                                    </td>
                                    <td className="border-b border-border/80 bg-rose-500/[0.03] px-2 py-2 text-center align-middle">
                                      <span className="inline-flex min-w-[32px] items-center justify-center rounded-lg bg-rose-500/15 px-2 py-1 text-xs font-bold text-rose-600 dark:text-rose-400">
                                        {monthSummary.absent}
                                      </span>
                                    </td>
                                    <td className="border-b border-border/80 bg-violet-500/[0.03] px-2 py-2 text-center align-middle">
                                      <span className="inline-flex min-w-[32px] items-center justify-center rounded-lg bg-violet-500/15 px-2 py-1 text-xs font-bold text-violet-600 dark:text-violet-400">
                                        {monthSummary.leave}
                                      </span>
                                    </td>
                                    <td className="border-b border-border/80 bg-blue-500/[0.03] px-2 py-2 text-center align-middle">
                                      <span className="inline-flex min-w-[32px] items-center justify-center rounded-lg bg-blue-500/15 px-2 py-1 text-xs font-bold text-blue-600 dark:text-blue-400">
                                        {monthSummary.holiday}
                                      </span>
                                    </td>
                                    <td className="border-b border-border/80 bg-blue-600/[0.03] px-2 py-2 text-center align-middle">
                                      <span className="inline-flex min-w-[50px] items-center justify-center rounded-lg bg-blue-600/15 px-2 py-1 text-xs font-bold text-blue-700 dark:text-blue-300">
                                        {monthSummary.totalWorkedText}
                                      </span>
                                    </td>
                                    <td className="border-b border-border/80 bg-amber-500/[0.03] px-2 py-2 text-center align-middle">
                                      <span className="inline-flex min-w-[50px] items-center justify-center rounded-lg bg-amber-500/15 px-2 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
                                        {monthSummary.totalOtText}
                                      </span>
                                    </td>
                                  </>
                                );
                              })()
                            )}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={
                              registerDates.length +
                              1 +
                              (isAllEmployees && !selectedDate && !selectedWeek
                                ? 7
                                : 0)
                            }
                            className="px-6 py-14 text-center"
                          >
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                              <Users className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div className="mt-3 text-sm font-semibold text-foreground">
                              No attendance records found
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              There are no employee attendance records for this selected period.
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Bottom Docked Zoom & Controls Toolbar - Only needed for multi-day/monthly view, hidden on selected date view */}
              {!(selectedDate && isAllEmployees) && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border bg-card px-5 py-3 rounded-b-2xl shadow-2xs">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <ZoomIn className="h-4 w-4 text-primary" />
                    <span>Display Scale</span>
                  </div>

                {/* Zoom +/- Controls with min 60% and max 100% */}
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setCalendarZoom((prev) => Math.max(60, prev - 5))}
                    disabled={calendarZoom <= 60}
                    title="Zoom Out (-5%)"
                    aria-label="Zoom out"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-foreground hover:bg-secondary active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <Minus className="h-4 w-4" />
                  </button>

                  <div className="flex w-36 sm:w-48 items-center gap-2">
                    <input
                      type="range"
                      min="60"
                      max="100"
                      step="5"
                      value={calendarZoom}
                      onChange={(e) => setCalendarZoom(Number(e.target.value))}
                      className="h-1.5 w-full cursor-pointer accent-primary bg-muted rounded-lg"
                      aria-label="Calendar zoom slider"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setCalendarZoom((prev) => Math.min(100, prev + 5))}
                    disabled={calendarZoom >= 100}
                    title="Zoom In (+5%)"
                    aria-label="Zoom in"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-foreground hover:bg-secondary active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <Plus className="h-4 w-4" />
                  </button>

                  <span className="min-w-[46px] rounded-lg bg-primary/10 border border-primary/20 px-2.5 py-1 text-center text-xs font-bold text-primary">
                    {calendarZoom}%
                  </span>

                  {calendarZoom !== 100 && (
                    <button
                      type="button"
                      onClick={() => setCalendarZoom(100)}
                      title="Reset to 100%"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-secondary transition"
                      aria-label="Reset zoom"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              )}
            </div>
          ) : (
            /* Calendar */
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border bg-card px-4 py-3 sm:px-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2
                      className="truncate text-lg font-bold text-foreground"
                      title={
                        data?.employee?.fullName ||
                        employees.find((emp) => emp.id === selectedId)
                          ?.fullName ||
                        "Employee"
                      }
                    >
                      {data?.employee?.fullName ||
                        employees.find((emp) => emp.id === selectedId)
                          ?.fullName ||
                        "Employee"}
                    </h2>
                    <p className="mt-0.5 text-sm font-semibold text-muted-foreground">
                      Employee Attendance
                    </p>
                  </div>

                  <div className="shrink-0 flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-bold text-foreground">
                        {monthNames[month - 1]} {year}
                      </div>
                      {selectedWeek && (
                        <div className="mt-0.5 text-xs font-semibold text-primary">
                          Week {selectedWeek}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="max-h-[650px] overflow-auto">
                {selectedDay ? (
                  <div className="p-4 sm:p-5 bg-secondary/20">
                    {/* Selected day — styled like the All Employees attendance row */}
                    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                      <div className="grid lg:grid-cols-[260px_1fr]">
                        {/* Employee column */}
                        <div className="border-b border-border bg-secondary/40 p-5 lg:border-b-0 lg:border-r">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                              {(
                                data?.employee?.fullName ||
                                employees.find((emp) => emp.id === selectedId)
                                  ?.fullName ||
                                "E"
                              )
                                .slice(0, 2)
                                .toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                                Employee
                              </div>
                              <div className="truncate text-base font-bold text-foreground">
                                {data?.employee?.fullName ||
                                  employees.find((emp) => emp.id === selectedId)
                                    ?.fullName ||
                                  "Employee"}
                              </div>
                              <div className="mt-0.5 text-xs text-muted-foreground">
                                {employees.find((emp) => emp.id === selectedId)
                                  ?.employeeCode || "Employee attendance"}
                              </div>
                            </div>
                          </div>

                          <div className="mt-5 border-t border-border pt-4">
                            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                              Selected Date
                            </div>
                            <div className="mt-1 text-lg font-bold text-foreground">
                              {fmtDateDMY(selectedDate)}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {monthNames[month - 1]} {year}
                            </div>
                          </div>
                        </div>

                        {/* Attendance column */}
                        <div className="p-4 sm:p-5">
                          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                              Daily Attendance
                            </div>
                            {selectedRecord ? (
                              (() => {
                                const isShortDay = isShortDayRecord(selectedRecord);
                                const currentMeta = isShortDay ? statusMeta.SHORT_DAY : statusMeta[selectedRecord.status];
                                return (
                                  <span
                                    title={currentMeta?.description || currentMeta?.label}
                                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                                      currentMeta?.cell ||
                                      "bg-secondary text-secondary-foreground"
                                    }`}
                                  >
                                    <span
                                      className={`h-2 w-2 rounded-full ${
                                        currentMeta?.dot ||
                                        "bg-muted-foreground"
                                      }`}
                                    />
                                    {selectedRecord.status === "HOLIDAY"
                                      ? selectedRecord.note || "Holiday"
                                      : currentMeta?.label ||
                                        selectedRecord.status}
                                  </span>
                                );
                              })()
                            ) : selectedHolidayName ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 dark:border-blue-800/40 bg-blue-500/10 dark:bg-blue-500/20 px-3 py-1.5 text-xs font-bold text-blue-700 dark:text-blue-300">
                                <span className="h-2 w-2 rounded-full bg-blue-500" />
                                {selectedHolidayName}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 dark:border-rose-800/40 bg-rose-500/10 dark:bg-rose-500/20 px-3 py-1.5 text-xs font-bold text-rose-700 dark:text-rose-300">
                                <span className="h-2 w-2 rounded-full bg-rose-500" />
                                No Attendance
                              </span>
                            )}
                          </div>

                          {selectedRecord ? (
                            selectedRecord.status === "ABSENT" ? (
                              <div className="rounded-xl border border-rose-200 dark:border-rose-800/40 bg-rose-500/10 dark:bg-rose-500/20 px-4 py-6 text-center">
                                <div className="text-base font-bold text-rose-700 dark:text-rose-300">
                                  Absent
                                </div>
                                <div className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                                  No attendance was recorded for this date.
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                  <div className="rounded-xl border border-border bg-card p-3">
                                    <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                                      Check In
                                    </div>
                                    <div className="mt-1.5 flex items-center justify-between gap-2">
                                      <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                                        {fmtTime(selectedRecord.checkIn) || "—"}
                                      </span>
                                      {getCalendarLocationCode(
                                        selectedRecord.note,
                                        "check-in",
                                      ) && (
                                        <span
                                          className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${
                                            getCalendarLocationCode(
                                              selectedRecord.note,
                                              "check-in",
                                            ) === "A"
                                              ? "border-blue-300 dark:border-blue-800/40 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                                              : getCalendarLocationCode(
                                                    selectedRecord.note,
                                                    "check-in",
                                                  ) === "UL"
                                                ? "border-orange-300 dark:border-orange-800/40 bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300"
                                                : "border-emerald-300 dark:border-emerald-800/40 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                                          }`}
                                        >
                                          {getCalendarLocationCode(
                                            selectedRecord.note,
                                            "check-in",
                                          )}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="rounded-xl border border-border bg-card p-3">
                                    <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                                      Check Out
                                    </div>
                                    <div className="mt-1.5 flex items-center justify-between gap-2">
                                      <span className="text-base font-bold text-rose-600 dark:text-rose-400">
                                        {fmtTime(selectedRecord.checkOut) ||
                                          "—"}
                                      </span>
                                      {getCalendarLocationCode(
                                        selectedRecord.note,
                                        "check-out",
                                      ) && (
                                        <span
                                          className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${
                                            getCalendarLocationCode(
                                              selectedRecord.note,
                                              "check-out",
                                              ) === "A"
                                              ? "border-blue-300 dark:border-blue-800/40 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                                              : getCalendarLocationCode(
                                                    selectedRecord.note,
                                                    "check-out",
                                                  ) === "UL"
                                                ? "border-orange-300 dark:border-orange-800/40 bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300"
                                                : "border-emerald-300 dark:border-emerald-800/40 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                                          }`}
                                        >
                                          {getCalendarLocationCode(
                                            selectedRecord.note,
                                            "check-out",
                                          )}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="rounded-xl border border-border bg-card p-3">
                                    <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                                      Working Hours
                                    </div>
                                    <div className="mt-1.5 text-base font-bold text-primary">
                                      {fmtWorkedHours(
                                        isHolidayDate(selectedRecord.date)
                                          ? 0
                                          : Number(selectedRecord.workedHours)
                                      )}
                                    </div>
                                  </div>

                                  <div className="rounded-xl border border-orange-200 dark:border-orange-800/40 bg-orange-500/10 dark:bg-orange-950/20 p-3">
                                    <div className="text-[10px] font-bold uppercase tracking-wide text-orange-600 dark:text-orange-400">
                                      Overtime
                                    </div>
                                    <div className="mt-1.5 text-base font-bold text-orange-700 dark:text-orange-300">
                                      {fmtOvertimeHours(selectedRecord) || "�"}
                                    </div>
                                  </div>
                                </div>

                                {(selectedHolidayName ||
                                  (selectedRecord.note &&
                                    formatAttendanceNote(
                                      selectedRecord.note,
                                    ))) && (
                                  <div className="grid gap-3 md:grid-cols-2">
                                    {selectedHolidayName && (
                                      <div className="rounded-xl border border-blue-200 dark:border-blue-800/40 bg-blue-500/10 dark:bg-blue-950/20 p-3">
                                        <div className="text-[10px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                                          Weekly Off
                                        </div>
                                        <div className="mt-1 text-sm font-semibold text-blue-800 dark:text-blue-300">
                                          {selectedHolidayName}
                                        </div>
                                      </div>
                                    )}
                                    {selectedRecord.note &&
                                      formatAttendanceNote(
                                        selectedRecord.note,
                                      ) && (
                                        <div className="rounded-xl border border-border bg-secondary/30 p-3">
                                          <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                                            Attendance Note
                                          </div>
                                          <div className="mt-1 whitespace-pre-line text-xs leading-5 text-muted-foreground">
                                            {formatAttendanceNote(
                                              selectedRecord.note,
                                            )}
                                          </div>
                                        </div>
                                      )}
                                  </div>
                                 )}

                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                  {hasSubmittedReason(selectedRecord.note) && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openAttendanceReason(
                                          selectedRecord,
                                          data?.employee?.fullName ||
                                            employees.find(
                                              (emp) => emp.id === selectedId,
                                            )?.fullName ||
                                            "Employee",
                                          data?.employee?.id || selectedId,
                                        )
                                      }
                                      className="rounded-lg bg-amber-500/10 dark:bg-amber-500/20 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
                                    >
                                      View attendance reason
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const targetEmpId = data?.employee?.id || selectedId;
                                      const dateStr = selectedRecord?.date ? formatDateKey(new Date(selectedRecord.date)) : selectedDate;
                                      const empParam = targetEmpId && targetEmpId !== "all" ? `&employeeId=${encodeURIComponent(targetEmpId)}` : "";
                                      navigate(`/admin/requests/forgot-punch?mode=time-edit&date=${dateStr}${empParam}`);
                                    }}
                                    className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20 inline-flex items-center gap-1.5"
                                  >
                                    <Clock className="h-3.5 w-3.5" />
                                    Edit Attendance Time
                                  </button>
                                </div>
                              </div>
                            )
                          ) : selectedHolidayName ? (
                            <div className="rounded-xl border border-blue-200 dark:border-blue-800/40 bg-blue-500/10 dark:bg-blue-500/20 px-4 py-6 text-center">
                              <div className="text-base font-bold text-blue-700 dark:text-blue-300">
                                Holiday
                              </div>
                              <div className="mt-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                                {selectedHolidayName}
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-xl border border-dashed border-border bg-secondary/20 px-4 py-6 text-center">
                              <div className="text-base font-bold text-muted-foreground">
                                No attendance record
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                No attendance was recorded for this date.
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="min-w-[950px] p-4 bg-secondary/15">
                    {/* Modern Calendar Weekday Headers */}
                    <div className="grid grid-cols-7 gap-2.5 mb-2.5">
                      {weekdays.map((w, wIdx) => {
                        const isSunday = wIdx === 0;
                        const isSaturday = wIdx === 6;
                        return (
                          <div
                            key={w}
                            className={`px-3 py-2.5 rounded-xl text-center text-xs font-bold tracking-wider uppercase transition-colors ${
                              isSunday
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/30"
                                : isSaturday
                                  ? "bg-blue-500/10 text-blue-800 dark:text-blue-300 border border-blue-500/20"
                                  : "bg-blue-500/[0.04] dark:bg-blue-950/20 text-blue-950 dark:text-blue-200 border border-blue-600/20 shadow-2xs"
                            }`}
                          >
                            {w}
                          </div>
                        );
                      })}
                    </div>

                    {/* Modern Calendar Month Grid */}
                    <div className="grid grid-cols-7 gap-2.5">
                      {calendarCells.map((day, idx) => {
                        if (day === null) {
                          return (
                            <div
                              key={`blank-${idx}`}
                              className="min-h-[148px] rounded-2xl bg-secondary/20 border border-dashed border-border/40"
                            />
                          );
                        }

                        const cellDate = new Date(
                          Date.UTC(year, month - 1, day),
                        );
                        const dateKey = formatDateKey(cellDate);
                        let rec = recordByDay[day];
                        if (
                          rec &&
                          rec.status === "ABSENT" &&
                          dateKey >= todayKey
                        ) {
                          rec = null;
                        }
                        const holidayName = holidayByDay[day];
                        const isSunday = cellDate.getUTCDay() === 0;
                        const isToday = dateKey === todayKey;
                        const isHolidayCell =
                          Boolean(holidayName) || rec?.status === "HOLIDAY" || isSunday;
                        const isShortDay = isShortDayRecord(rec);
                        const meta = rec
                          ? (isShortDay ? statusMeta.SHORT_DAY : statusMeta[rec.status])
                          : holidayName
                            ? statusMeta.HOLIDAY
                            : isSunday
                              ? statusMeta.HOLIDAY
                              : null;
                        const overtimeText = fmtOvertimeHours(rec, isHolidayCell);
                        const checkInLocationCode = getCalendarLocationCode(
                          rec?.note,
                          "check-in",
                        );
                        const checkOutLocationCode = getCalendarLocationCode(
                          rec?.note,
                          "check-out",
                        );
                        const attendanceNote = rec
                          ? formatAttendanceNote(rec.note)
                          : "";

                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => setSelectedDate(dateKey)}
                            className={`min-h-[148px] rounded-2xl flex flex-col justify-between p-3 text-left transition-all duration-200 border cursor-pointer hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary ${
                              isToday
                                ? "border-primary bg-primary/[0.04] shadow-sm ring-2 ring-primary/40"
                                : isHolidayCell && !isWorkedRecord(rec)
                                ? "border-blue-200/60 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20"
                                : rec?.status === "ABSENT"
                                ? "border-rose-200/60 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20"
                                : rec?.status === "PRESENT" || isShortDay
                                ? "border-border/90 bg-card hover:border-primary/40 shadow-2xs"
                                : "border-border bg-card shadow-2xs hover:bg-secondary/40"
                            }`}
                          >
                            {/* Top Row: Date Pill & Status Chip */}
                            <div className="flex w-full items-center justify-between gap-1.5 mb-2 shrink-0">
                              <span
                                className={`flex items-center justify-center h-7 w-7 rounded-lg text-xs font-bold leading-none ${
                                  isToday
                                    ? "bg-primary text-white shadow-xs"
                                    : isSunday
                                    ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                                    : "bg-secondary text-foreground"
                                }`}
                              >
                                {day}
                              </span>

                              {isToday ? (
                                <span className="rounded-full bg-primary/15 border border-primary/30 px-2 py-0.5 text-[9px] font-extrabold uppercase text-primary leading-none">
                                  Today
                                </span>
                              ) : meta ? (
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold leading-none ${meta.cell || "bg-secondary text-muted-foreground"}`}
                                  title={meta.description || meta.label}
                                >
                                  <span className={`h-1.5 w-1.5 rounded-full ${meta.dot || "bg-current"}`} />
                                  <span className="truncate max-w-[70px]">{meta.label}</span>
                                </span>
                              ) : null}
                            </div>

                            {/* Middle / Body Area */}
                            <div className="flex-1 w-full flex flex-col justify-center">
                              {rec ? (
                                rec.status === "ON_LEAVE" ? (
                                  <div className="flex flex-col items-center justify-center py-2 px-1 rounded-xl border border-violet-200 dark:border-violet-800/40 bg-violet-500/10 text-center">
                                    <span className="text-xs font-bold text-violet-700 dark:text-violet-300">
                                      On Leave
                                    </span>
                                    {rec.note && (
                                      <span className="mt-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-400 line-clamp-1" title={rec.note}>
                                        {rec.note}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="space-y-1.5">
                                    {/* In & Out Grid */}
                                    <div className="grid grid-cols-2 gap-1 text-[11px] font-semibold">
                                      <div className="rounded-lg bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-800/30 px-1.5 py-1 text-center">
                                        <div className="text-[9px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-bold">In</div>
                                        <div className="text-emerald-800 dark:text-emerald-200 font-bold truncate">
                                          {fmtTime(rec.checkIn) || "—"}
                                          {checkInLocationCode && (
                                            <span className="ml-1 text-[8px] font-extrabold px-1 py-0.2 rounded bg-emerald-200/60 dark:bg-emerald-800/60 text-emerald-900 dark:text-emerald-100">
                                              {checkInLocationCode}
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      <div className="rounded-lg bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/50 dark:border-rose-800/30 px-1.5 py-1 text-center">
                                        <div className="text-[9px] uppercase tracking-wider text-rose-700 dark:text-rose-400 font-bold">Out</div>
                                        <div className="text-rose-800 dark:text-rose-200 font-bold truncate">
                                          {fmtTime(rec.checkOut) || "—"}
                                          {checkOutLocationCode && (
                                            <span className="ml-1 text-[8px] font-extrabold px-1 py-0.2 rounded bg-rose-200/60 dark:bg-rose-800/60 text-rose-900 dark:text-rose-100">
                                              {checkOutLocationCode}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Hours & OT strip */}
                                    <div className="flex items-center justify-between gap-1 px-2 py-1 rounded-lg bg-secondary/50 border border-border/60 text-[11px]">
                                      <span className="text-[10px] text-muted-foreground font-semibold">Worked</span>
                                      <span className="font-bold text-foreground">
                                        {fmtWorkedHours(isHolidayCell ? 0 : Number(rec.workedHours || 0))}
                                      </span>
                                      {overtimeText && (
                                        <span className="text-[10px] font-extrabold text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-950/50 px-1.5 py-0.2 rounded-md">
                                          +{overtimeText}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )
                              ) : holidayName ? (
                                <div className="text-center py-2 px-1 rounded-xl bg-blue-500/10 border border-blue-200/60 dark:border-blue-800/40 space-y-0.5">
                                  <div className="text-xs font-bold text-blue-700 dark:text-blue-300">Holiday</div>
                                  <div className="text-[10px] font-medium text-blue-600 dark:text-blue-400 line-clamp-2" title={holidayName}>
                                    {holidayName}
                                  </div>
                                </div>
                              ) : isSunday ? (
                                <div className="text-center py-2 px-1 rounded-xl bg-rose-500/10 border border-rose-200/50 dark:border-rose-900/30 space-y-0.5">
                                  <div className="text-xs font-bold text-rose-600 dark:text-rose-400">Weekly Off</div>
                                  <div className="text-[10px] font-medium text-rose-500/80">Sunday</div>
                                </div>
                              ) : (
                                <div className="text-center py-3 text-muted-foreground/40 font-medium text-xs">
                                  No record
                                </div>
                              )}
                            </div>

                            {/* Bottom Note / View Reason Button */}
                            {rec && hasSubmittedReason(rec.note) && (
                              <div className="mt-2 pt-1 border-t border-border/50 flex justify-center shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openAttendanceReason(
                                      rec,
                                      data?.employee?.fullName,
                                      data?.employee?.id,
                                    );
                                  }}
                                  className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 transition-colors cursor-pointer"
                                >
                                  <span>View Reason</span>
                                </button>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Legend for individual employee monthly calendar view */}
          {!isAllEmployees && (
            <div className="flex flex-wrap gap-4 pt-2">
              {Object.entries(statusMeta).map(([key, meta]) => (
                <div
                  key={key}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                  title={meta.description || meta.label}
                >
                  <span className={`w-3 h-3 rounded-full ${meta.dot}`} />
                  <span>{meta.label}</span>
                  {meta.description && (
                    <span className="text-[11px] text-muted-foreground/75">
                      ({meta.description})
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Submitted Attendance Reason Modal */}
      {attendanceReasonModal && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAttendanceReasonModal(null);
          }}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            {/* Header */}
            <div className="relative border-b border-border bg-card px-6 py-5">
              <div className="flex items-start gap-3 pr-10">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${attendanceReasonModal.status === "PRESENT" ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"}`}>
                  {attendanceReasonModal.status === "PRESENT" ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className="line-clamp-2 break-words font-display text-[22px] leading-7 font-bold text-foreground"
                    title={attendanceReasonModal.employeeName}
                  >
                    {attendanceReasonModal.employeeName}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAttendanceReasonModal(null)}
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-sm transition hover:bg-secondary hover:text-foreground"
                aria-label="Close attendance reason"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Details */}
            <div className="max-h-[75vh] overflow-y-auto px-6 py-5 space-y-4">
              {/* Basic Overview Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="rounded-xl border border-border bg-secondary/30 p-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Date
                  </div>
                  <div className="mt-1 text-sm font-bold text-foreground">
                    {fmtDateDMY(attendanceReasonModal.date)}
                  </div>
                </div>

                <div className={`rounded-xl border p-2.5 ${attendanceReasonModal.status === "PRESENT" ? "border-emerald-200 bg-emerald-500/10 text-emerald-800 dark:border-emerald-800/40 dark:text-emerald-300" : "border-amber-200 bg-amber-500/10 text-amber-800 dark:border-amber-800/40 dark:text-amber-300"}`}>
                  <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                    Status
                  </div>
                  <div className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold">
                    <span className={`h-2 w-2 rounded-full ${attendanceReasonModal.status === "PRESENT" ? "bg-emerald-500" : "bg-amber-500"}`} />
                    {attendanceReasonModal.statusLabel || attendanceReasonModal.status || "—"}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Check In
                  </div>
                  <div className="mt-1 text-sm font-bold text-foreground">
                    {fmtTime(attendanceReasonModal.checkIn) || "—"}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Check Out
                  </div>
                  <div className="mt-1 text-sm font-bold text-foreground">
                    {fmtTime(attendanceReasonModal.checkOut) || "—"}
                  </div>
                </div>
              </div>

              {/* Note / Request Segments (matches Employee Panel) */}
              {attendanceReasonModal.note ? (
                <div className="space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Attendance Request Details
                  </div>
                  {attendanceReasonModal.note.split("|").map((segment, idx) => {
                    const parsed = parseAttendanceNoteSegment(segment, attendanceReasonModal);

                    return (
                      <div
                        key={idx}
                        className="rounded-xl border border-border bg-secondary/20 p-3.5 space-y-3"
                      >
                        {/* Header Row: Type & Status */}
                        <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-border/60">
                          <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                            {parsed.isCheckIn ? (
                              <LogIn className="h-4 w-4 text-emerald-600" />
                            ) : parsed.isCheckOut ? (
                              <LogOut className="h-4 w-4 text-rose-600" />
                            ) : (
                              <Clock3 className="h-4 w-4 text-amber-600" />
                            )}
                            {parsed.type}
                          </span>

                          {parsed.statusLabel && (
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                                parsed.status === "PENDING"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
                                  : parsed.status === "APPROVED"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
                                  : parsed.status === "REJECTED"
                                  ? "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300"
                                  : "bg-secondary text-muted-foreground"
                              }`}
                            >
                              {parsed.status === "PENDING" && <Clock className="h-3 w-3" />}
                              {parsed.status === "APPROVED" && <CheckCircle2 className="h-3 w-3" />}
                              {parsed.status === "REJECTED" && <XCircle className="h-3 w-3" />}
                              {parsed.statusLabel}
                            </span>
                          )}
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {/* Punch Time */}
                          {parsed.timeStr && (
                            <div className="rounded-lg bg-background p-2.5 border border-border/50">
                              <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                                Punch Time
                              </div>
                              <div className="font-bold text-foreground mt-0.5">
                                {parsed.timeStr}
                              </div>
                            </div>
                          )}

                          {/* Location Info */}
                          {parsed.locationInfo && (
                            <div className="rounded-lg bg-background p-2.5 border border-border/50">
                              <div className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-primary" /> Location / Dist
                              </div>
                              <div className="font-bold text-foreground mt-0.5 truncate">
                                {parsed.locationInfo}
                              </div>
                            </div>
                          )}

                          {/* Request Submitted Time */}
                          <div className="rounded-lg bg-background p-2.5 border border-border/50">
                            <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                              Request Submitted Time
                            </div>
                            <div className="font-bold text-foreground mt-0.5">
                              {attendanceReasonModal.createdAt
                                ? `${fmtDateDMY(attendanceReasonModal.createdAt)} ${fmtTime(attendanceReasonModal.createdAt)}`
                                : parsed.timeStr
                                ? `${fmtDateDMY(attendanceReasonModal.date)} ${parsed.timeStr}`
                                : `${fmtDateDMY(attendanceReasonModal.date)} —`}
                            </div>
                          </div>

                          {/* Request Approved / Reviewed Time */}
                          <div className="rounded-lg bg-background p-2.5 border border-border/50">
                            <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                              {parsed.status === "APPROVED"
                                ? (parsed.statusLabel === "Verified" ? "Verification Status" : "Approved Time")
                                : parsed.status === "REJECTED"
                                ? "Rejected Time"
                                : "Approved / Status Date"}
                            </div>
                            <div className="font-bold text-foreground mt-0.5">
                              {parsed.status === "APPROVED" || parsed.status === "REJECTED"
                                ? (parsed.statusLabel === "Verified"
                                    ? "Standard Punch (Within Location)"
                                    : attendanceReasonModal.updatedAt
                                    ? `${fmtDateDMY(attendanceReasonModal.updatedAt)} ${fmtTime(attendanceReasonModal.updatedAt)}`
                                    : "—")
                                : "Awaiting Approval"}
                            </div>
                          </div>
                        </div>

                        {/* Reason / Note Details */}
                        <div className="rounded-lg bg-background p-3 border border-border/50 space-y-1.5">
                          <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                            {parsed.isForgotPunch ? "Forgot Punch Reason" : parsed.userReason ? "Employee Reason" : "Reason / Note Details"}
                          </div>
                          <div className="text-xs font-medium text-foreground bg-secondary/40 p-2.5 rounded-lg border border-border/30 whitespace-pre-wrap break-words leading-relaxed">
                            {parsed.userReason || parsed.cleanSummary || parsed.rawText || "No reason provided."}
                          </div>
                          {parsed.distance && (
                            <div className="text-[11px] font-semibold text-primary pt-0.5">
                              Distance from office: {parsed.distance} away
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Fallback submitted reason */
                <div className="rounded-xl border border-amber-200 bg-amber-500/10 p-4 dark:border-amber-800/40 dark:bg-amber-500/20">
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1">
                    Submitted Reason
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {attendanceReasonModal.reason || "No reason provided."}
                  </p>
                </div>
              )}

              {/* Map Coordinates / Attendance Location if available */}
              {(Number.isFinite(Number(attendanceReasonModal.checkInLatitude)) ||
                Number.isFinite(Number(attendanceReasonModal.checkOutLatitude))) && (
                <div className="pt-1">
                  <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Map Location
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {Number.isFinite(Number(attendanceReasonModal.checkInLatitude)) &&
                    Number.isFinite(Number(attendanceReasonModal.checkInLongitude)) ? (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${attendanceReasonModal.checkInLatitude},${attendanceReasonModal.checkInLongitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-500/20 dark:border-blue-800/40 dark:text-blue-400"
                      >
                        <MapPin className="h-3.5 w-3.5 transition group-hover:scale-110" />
                        Check-in Map Pin
                      </a>
                    ) : null}

                    {Number.isFinite(Number(attendanceReasonModal.checkOutLatitude)) &&
                    Number.isFinite(Number(attendanceReasonModal.checkOutLongitude)) ? (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${attendanceReasonModal.checkOutLatitude},${attendanceReasonModal.checkOutLongitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-500/20 dark:border-rose-800/40 dark:text-rose-400"
                      >
                        <MapPin className="h-3.5 w-3.5 transition group-hover:scale-110" />
                        Check-out Map Pin
                      </a>
                    ) : null}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end border-t border-border bg-card px-6 py-3">
              <button
                type="button"
                onClick={() => setAttendanceReasonModal(null)}
                className="rounded-xl bg-secondary px-6 py-2 text-[15px] font-bold text-secondary-foreground transition hover:bg-secondary/80 focus:outline-none focus:ring-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="border-b border-border bg-rose-500/10 dark:bg-rose-500/20 p-5">
              <h3 className="text-lg font-semibold text-rose-700 dark:text-rose-300">
                Reject Attendance
              </h3>
              <p className="text-sm text-rose-600 dark:text-rose-400 mt-1">
                {rejectModal.employeeName}
              </p>
            </div>

            <div className="p-5 space-y-4">
              <label className="block text-sm font-medium text-foreground">
                Admin comment
                <textarea
                  value={rejectModal.reason}
                  onChange={(e) =>
                    setRejectModal((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                  rows={4}
                  placeholder="Add a reason for rejection..."
                  className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-rose-400 focus:outline-none"
                />
              </label>
            </div>

            <div className="border-t border-border bg-secondary/30 p-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRejectModal(null)}
                className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  rejectRecord(
                    rejectModal.recordId,
                    rejectModal.reason.trim() || "unassigned location",
                  )
                }
                className="px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700 text-sm font-medium"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Location Map Modal */}
      {mapModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-card border-b border-border p-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-foreground">
                  Check-in Location Verification
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {mapModal.employee?.user?.fullName}
                </p>
              </div>
              <button
                onClick={() => setMapModal(null)}
                className="p-2 hover:bg-secondary text-muted-foreground hover:text-foreground rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Check-in Details */}
              <div className="space-y-3">
                <h4 className="font-semibold text-foreground">
                  Check-in Details
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-secondary/30 border border-border/50 rounded-lg p-3">
                    <div className="text-muted-foreground">Date & Time</div>
                    <div className="font-medium mt-1">
                      {mapModal.checkIn
                        ? new Date(mapModal.checkIn).toLocaleString()
                        : "N/A"}
                    </div>
                  </div>
                  <div className="bg-secondary/30 border border-border/50 rounded-lg p-3">
                    <div className="text-muted-foreground">Location Name</div>
                    <div className="font-medium mt-1">
                      {mapModal.locationName || "Unknown"}
                    </div>
                  </div>
                  <div className="col-span-2 bg-amber-500/10 dark:bg-amber-500/20 rounded-lg p-3 border border-amber-200 dark:border-amber-800/40">
                    <div className="text-muted-foreground text-xs">
                      Approval Note
                    </div>
                    <div className="text-sm mt-1 text-amber-800 dark:text-amber-300">
                      {mapModal.note}
                    </div>
                  </div>
                </div>
              </div>

              {/* Map Container */}
              <div className="space-y-3">
                <h4 className="font-semibold text-foreground">
                  Location on Map
                </h4>
                <div className="bg-secondary/20 rounded-lg border border-border p-4">
                  {mapModal.latitude && mapModal.longitude ? (
                    <div className="space-y-3">
                      <div className="bg-card rounded-lg p-4 space-y-2 border border-border">
                        <div className="text-sm">
                          <span className="text-muted-foreground">
                            Latitude:
                          </span>
                          <span className="font-mono ml-2 font-semibold">
                            {mapModal.latitude.toFixed(6)}
                          </span>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">
                            Longitude:
                          </span>
                          <span className="font-mono ml-2 font-semibold">
                            {mapModal.longitude.toFixed(6)}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={`https://www.google.com/maps/@${mapModal.latitude},${mapModal.longitude},17z`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-center text-sm font-medium transition-colors"
                        >
                          View on Google Maps
                        </a>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(
                              `${mapModal.latitude},${mapModal.longitude}`,
                            );
                            toast.success("Coordinates copied to clipboard!");
                          }}
                          className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 text-sm font-medium transition-colors"
                        >
                          Copy Coordinates
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Location coordinates not available
                    </div>
                  )}
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-blue-500/10 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-800/40 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-300">
                <div className="font-semibold mb-2">How to Verify</div>
                <ul className="space-y-1 text-xs">
                  <li>
                    ✓ Click "View on Google Maps" to see the exact location
                    where the employee checked in
                  </li>
                  <li>
                    ✓ Compare this location with the assigned/default location
                  </li>
                  <li>
                    ✓ Verify the distance and context (travel time, valid
                    reason, etc.)
                  </li>
                  <li>✓ Click Approve or Reject based on your review</li>
                </ul>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="border-t border-border bg-secondary/30 p-6 flex gap-3 justify-end">
              <button
                onClick={() => setMapModal(null)}
                className="px-4 py-2 text-secondary-foreground bg-secondary hover:bg-secondary/80 rounded-lg font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showScrollTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40"
          aria-label="Scroll to top"
          title="Scroll to top"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
      )}
    </div>
  );
};

export default Attendance;