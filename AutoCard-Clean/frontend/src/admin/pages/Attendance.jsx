import { useEffect, useRef, useState } from "react";
import {
  Clock,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Users,
  X,
  CheckCircle2,
  AlertCircle,
  MapPin,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../lib/api.js";

// Visual styling per attendance status.
const statusMeta = {
  PRESENT: {
    label: "Present",
    dot: "bg-emerald-500",
    cell: "bg-emerald-50 border-emerald-200 text-emerald-700",
  },
  ABSENT: {
    label: "Absent",
    dot: "bg-rose-500",
    cell: "bg-rose-50 border-rose-200 text-rose-700",
  },
  ON_LEAVE: {
    label: "On Leave",
    dot: "bg-violet-500",
    cell: "bg-violet-50 border-violet-200 text-violet-700",
  },
  HOLIDAY: {
    label: "Holiday",
    dot: "bg-blue-500",
    cell: "bg-blue-50 border-blue-200 text-blue-700",
  },
  PENDING_APPROVAL: {
    label: "Awaiting Approval",
    dot: "bg-amber-500",
    cell: "bg-amber-50 border-amber-200 text-amber-700",
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

const extractSubmittedReason = (note) => {
  if (!note) return "No reason provided.";

  const cleanedNote = cleanAttendanceNote(note);

  const reasonMatch = cleanedNote.match(
    /Reason:\s*(.*?)(?:\.\s*Pending admin approval|\.|$)/i,
  );

  return reasonMatch?.[1]?.trim() || cleanedNote;
};

const hasSubmittedReason = (note) => /reason:/i.test(note || "");

const getCalendarLocationCode = (note, type) => {
  if (!note) return null;

  const cleanedNote = cleanAttendanceNote(note);
  const isCheckIn = type === "check-in";

  // Unassigned / unapproved locations are always UL.
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
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatDateKey = (date) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

// Split the selected month into fixed date ranges:
// Week 1 = 01-07, Week 2 = 08-14, Week 3 = 15-21,
// Week 4 = 22-28, Week 5 = 29-end of month.
// This keeps Month and Week filters independent and prevents
// dates from the previous/next month appearing in the week list.
const computeMonthWeeks = (year, month) => {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const weeks = [];

  for (let startDay = 1; startDay <= daysInMonth; startDay += 7) {
    const endDay = Math.min(startDay + 6, daysInMonth);

    weeks.push({
      start: new Date(Date.UTC(year, month - 1, startDay)),
      end: new Date(Date.UTC(year, month - 1, endDay)),
    });
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

  return String(Math.floor((todayDay - 1) / 7) + 1);
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
  const [loadingData, setLoadingData] = useState(false);
  const [showDetailedRecords, setShowDetailedRecords] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [mapModal, setMapModal] = useState(null); // null or { latitude, longitude, employee, checkIn }
  const [rejectModal, setRejectModal] = useState(null); // null or { recordId, employeeName, reason }
  const [attendanceReasonModal, setAttendanceReasonModal] = useState(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [calendarZoom, setCalendarZoom] = useState(60);
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

    (async () => {
      if (!selectedId) {
        setData(null);
        setRegisterData(null);
        setShowDetailedRecords(false);
        return;
      }

      setLoadingData(true);

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
        if (active) {
          toast.error(err.message || "Failed to load attendance.");
          setData(null);
          setRegisterData(null);
          setShowDetailedRecords(false);
        }
      } finally {
        if (active) setLoadingData(false);
      }
    })();

    return () => {
      active = false;
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
  if (data) {
    for (const r of data.records) {
      const d = new Date(r.date);
      recordByDay[d.getUTCDate()] = r;
    }
  }
  const holidayByDay = {};
  if (data) {
    for (const h of data.holidays) {
      const d = new Date(h.date);
      holidayByDay[d.getUTCDate()] = h.name;
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
    const dateKey = formatDateKey(date);
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

    // On a holiday, every hour worked is overtime.
    if (isHolidayDate(record.date)) {
      return isWorkedRecord(record);
    }

    // On a normal working day, overtime starts after 8 hours.
    return Number(record.workedHours) > 8;
  };

  const overtimeDays = records.filter(isOvertimeRecord).length;
  const overtimeMeta = {
    label: "Overtime",
    dot: "bg-orange-500",
    cell: "bg-orange-50 border-orange-200 text-orange-700",
  };
  const filteredRecords = selectedStatus
    ? records.filter((rec) => {
        if (selectedStatus === "OVERTIME") {
          return isOvertimeRecord(rec);
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

  // Monthly summary for the All Employees view.
  const getEmployeeMonthSummary = (emp) => {
    let present = 0;
    let absent = 0;
    let leave = 0;
    let holiday = 0;

    const holidays = registerData?.holidays || [];

    visibleRegisterDates.forEach((date) => {
      const dateKey = formatDateKey(date);
      let rec = attendanceByDateEmployee.get(`${dateKey}:${emp.id}`);

      // Do not count today's/future ABSENT records.
      if (rec && rec.status === "ABSENT" && dateKey >= todayKey) {
        rec = null;
      }

      const isHoliday = holidays.some(
        (h) => formatDateKey(new Date(h.date)) === dateKey,
      );

      if (rec?.status === "ON_LEAVE") {
        leave += 1;
      } else if (rec?.status === "ABSENT") {
        absent += 1;
      } else if (isHoliday && !isWorkedRecord(rec)) {
        holiday += 1;
      } else if (
        rec &&
        (isWorkedRecord(rec) ||
          rec.status === "PRESENT" ||
          rec.status === "PENDING_APPROVAL")
      ) {
        present += 1;
      }
    });

    return {
      present,
      absent,
      leave,
      holiday,
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
      setLoadingData(true);
      const { start, days } = getRegisterWindow(year, month, selectedWeek);
      const res = await apiGet(
        `/attendance/register/weekly?days=${days}&start=${start}`,
      );
      setRegisterData(res);
    } catch (err) {
      toast.error(err.message || "Failed to reload register.");
    } finally {
      setLoadingData(false);
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
      reason: record.note || "Unapproved location",
    });
  };

  const openAttendanceReason = (record, employeeName) => {
    setAttendanceReasonModal({
      employeeName: employeeName || "Employee",
      reason: extractSubmittedReason(record.note),
      recordId: record.id,
      date: record.date,
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

          <div className="p-6 overflow-x-auto">
            {filteredRecords.length > 0 ? (
              <>
                {selectedStatus === "PENDING_APPROVAL" && (
                  <div className="mb-6 space-y-3">
                    {filteredRecords.map((rec) => (
                      <div
                        key={rec.id}
                        className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow-sm"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-amber-800">
                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {rec.employee?.user?.fullName ||
                                  rec.employee?.fullName ||
                                  "Employee"}
                              </span>
                            </div>
                            <div className="text-sm text-amber-900">
                              <span className="font-semibold">Date:</span>{" "}
                              {fmtDateDMY(rec.date)}
                            </div>
                            <div className="text-sm text-amber-900">
                              <span className="font-semibold">Check-in:</span>{" "}
                              {fmtTime(rec.checkIn) ?? "—"}
                            </div>
                            <div className="rounded-lg border border-amber-200 bg-white/70 p-3 text-sm text-amber-900">
                              <div className="font-semibold mb-1">Reason</div>
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
                                  rec.note || "Unapproved location",
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
                      <th className="py-2 pr-4">Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredRecords.map((rec) => (
                      <tr
                        key={rec.id}
                        className="hover:bg-secondary/50 transition-colors"
                      >
                        <td className="py-3 pr-4">{fmtDateDMY(rec.date)}</td>
                        <td className="py-3 pr-4">
                          {statusMeta[rec.status]?.label || rec.status}
                        </td>
                        <td className="py-3 pr-4">
                          {fmtTime(rec.checkIn) ?? "—"}
                        </td>
                        <td className="py-3 pr-4">
                          {fmtTime(rec.checkOut) ?? "—"}
                        </td>
                        <td className="py-3 pr-4">
                          {fmtWorkedHours(rec.workedHours)}
                        </td>
                        <td className="py-3 pr-4 max-w-xl truncate">
                          {rec.note || "—"}
                        </td>
                      </tr>
                    ))}
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
      <div className="flex items-center gap-4">
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

      {/* Controls */}
      {!isAllEmployees && (
        <div className="sticky top-[72px] z-[100] overflow-visible rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-[0_8px_30px_rgba(15,23,42,0.06)] p-4 sm:p-5">
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
                    placeholder={
                      loadingEmployees
                        ? "Loading employees..."
                        : "Search employee..."
                    }
                    disabled={loadingEmployees}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-3 pr-10 text-sm font-semibold text-slate-800 shadow-sm transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                  />

                  {/* Dropdown Arrow */}
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setShowEmployeeDropdown((prev) => !prev)}
                    disabled={loadingEmployees}
                    className="absolute right-0 top-0 flex h-full w-10 items-center justify-center text-slate-500 hover:text-slate-700"
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
                  <div className="absolute left-0 right-0 top-full z-[200] mt-2 max-h-60 w-full overflow-y-auto rounded-xl border border-border bg-white shadow-xl">
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
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
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
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
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
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
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
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
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
        <div className="-mt-3 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  Employee Attendance
                </div>
                <div className="truncate text-sm font-bold text-slate-800">
                  {employees.find((emp) => emp.id === selectedId)?.fullName ||
                    "Selected Employee"}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-600">
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
      ) : loadingData ? (
        <div className="p-12 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading
          attendance...
        </div>
      ) : (
        <>
          {!isAllEmployees && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {Object.entries(statusMeta).map(([key, meta]) => {
                const isActive = selectedStatus === key;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleStatusClick(key)}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      isActive
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-background card-shadow hover:bg-secondary/40"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${meta.dot}`}
                      />
                      <span className="text-xs text-muted-foreground">
                        {meta.label}
                      </span>
                    </div>
                    <div className="font-display text-xl font-bold">
                      {summary[key] || 0}
                    </div>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => handleStatusClick("OVERTIME")}
                className="rounded-xl border border-orange-200 bg-orange-50/70 p-4 text-left transition-colors hover:bg-orange-100/70 focus:outline-none focus:ring-2 focus:ring-orange-300"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                  <span className="text-xs text-orange-700">Overtime Days</span>
                </div>
                <div className="font-display text-xl font-bold text-orange-900">
                  {overtimeDays} {overtimeDays === 1 ? "day" : "days"}
                </div>
              </button>
            </div>
          )}

          {isAllEmployees ? (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.07)] overflow-visible">
              {/* Filters inside Team Attendance for All Employees */}
              <div className="sticky top-[72px] z-[100] overflow-visible rounded-2xl bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-[0_8px_30px_rgba(15,23,42,0.06)] p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                  <div className="flex flex-wrap items-start gap-3">
                    {/* 1. Select Employee */}
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
                          placeholder={
                            loadingEmployees
                              ? "Loading employees..."
                              : "Search employee..."
                          }
                          disabled={loadingEmployees}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-3 pr-10 text-sm font-semibold text-slate-800 shadow-sm transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                        />

                        {/* Dropdown Arrow */}
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() =>
                            setShowEmployeeDropdown((prev) => !prev)
                          }
                          disabled={loadingEmployees}
                          className="absolute right-0 top-0 flex h-full w-10 items-center justify-center text-slate-500 hover:text-slate-700"
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
                        <div className="absolute left-0 right-0 top-full z-[200] mt-2 max-h-60 w-full overflow-y-auto rounded-xl border border-border bg-white shadow-xl">
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
                                  selectedId === emp.id ? "bg-primary/5" : ""
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
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
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
                          // Month filter shows the complete selected month.
                          setSelectedWeek("");
                          setMonth(nextMonth);
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
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
                          // Year filter shows the complete selected month.
                          setSelectedWeek("");
                          setYear(selectedYear);

                          if (
                            selectedYear === today.getFullYear() &&
                            month > today.getMonth() + 1
                          ) {
                            setMonth(today.getMonth() + 1);
                          }
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
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
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                      >
                        <option value="">Select Week</option>

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
                            Week (
                            {String(week.start.getUTCDate()).padStart(2, "0")}/
                            {String(week.start.getUTCMonth() + 1).padStart(
                              2,
                              "0",
                            )}
                            -{String(week.end.getUTCDate()).padStart(2, "0")}/
                            {String(week.end.getUTCMonth() + 1).padStart(
                              2,
                              "0",
                            )}
                            )
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Selected employee / calendar context */}
              <div className="mx-4 sm:mx-5 mb-3 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-4 py-3 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Users className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        Calendar View
                      </div>
                      <div className="truncate text-sm font-bold text-slate-800">
                        {selectedId === "all"
                          ? "All Employees"
                          : employees.find((emp) => emp.id === selectedId)
                              ?.fullName || "Selected Employee"}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                    <span className="rounded-full bg-slate-100 px-3 py-1.5">
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

              {/* Location code explanation */}
              <div className="mx-4 sm:mx-5 mb-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-700">
                  Location Code Guide
                </div>

                <div className="grid gap-1.5 text-[10px] leading-tight text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-md border border-orange-200 bg-white px-2 py-1.5">
                    <div className="flex items-center gap-1">
                      <span className="rounded bg-orange-100 px-1 py-0.5 font-bold text-orange-700">
                        UL O
                      </span>
                      <span>Check In: Unassigned · Check Out: Office</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      <span className="rounded bg-orange-100 px-1 py-0.5 font-bold text-orange-700">
                        O UL
                      </span>
                      <span>Check In: Office · Check Out: Unassigned</span>
                    </div>
                  </div>

                  <div className="rounded-md border border-emerald-200 bg-white px-2 py-1.5">
                    <div className="flex items-center gap-1">
                      <span className="rounded bg-emerald-100 px-1 py-0.5 font-bold text-emerald-700">
                        O O
                      </span>
                      <span>Check In: Office · Check Out: Office</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      <span className="rounded bg-blue-100 px-1 py-0.5 font-bold text-blue-700">
                        A A
                      </span>
                      <span>Check In & Check Out: Assign Location</span>
                    </div>
                  </div>

                  <div className="rounded-md border border-blue-200 bg-white px-2 py-1.5">
                    <div className="flex items-center gap-1">
                      <span className="rounded bg-blue-100 px-1 py-0.5 font-bold text-blue-700">
                        A O
                      </span>
                      <span>Check In: Assign · Check Out: Office</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      <span className="rounded bg-blue-100 px-1 py-0.5 font-bold text-blue-700">
                        O A
                      </span>
                      <span>Check In: Office · Check Out: Assign</span>
                    </div>
                  </div>

                  <div className="rounded-md border border-orange-200 bg-white px-2 py-1.5">
                    <div className="flex items-center gap-1">
                      <span className="rounded bg-orange-100 px-1 py-0.5 font-bold text-orange-700">
                        A UL
                      </span>
                      <span>Check In: Assign · Check Out: Unassigned</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      <span className="rounded bg-orange-100 px-1 py-0.5 font-bold text-orange-700">
                        UL A
                      </span>
                      <span>Check In: Unassigned · Check Out: Assign</span>
                    </div>
                  </div>
                </div>
              </div>
              {/* Calendar Zoom */}
              <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-700">
                    Calendar Zoom
                  </span>
                  <span className="min-w-[48px] rounded-full bg-primary/10 px-2.5 py-1 text-center text-xs font-bold text-primary">
                    {calendarZoom}%
                  </span>
                </div>
                <div className="flex w-full max-w-md items-center gap-3">
                  <span className="text-xs font-semibold text-slate-500">
                    60%
                  </span>
                  <input
                    type="range"
                    min="60"
                    max="100"
                    step="5"
                    value={calendarZoom}
                    onChange={(e) => setCalendarZoom(Number(e.target.value))}
                    className="h-2 w-full cursor-pointer accent-primary"
                    aria-label="Calendar zoom"
                  />
                  <span className="text-xs font-semibold text-slate-500">
                    100%
                  </span>
                </div>
              </div>

              {/* Calendar / employee matrix */}
              <div className="relative max-h-[calc(81vh-230px)] min-h-[340px] overflow-auto overscroll-contain rounded-b-2xl">
                <table
                  className="min-w-[1485px] w-full border-separate border-spacing-0 text-sm"
                  style={{ zoom: `${calendarZoom}%` }}
                >
                  <thead>
                    <tr>
                      <th
                        className="sticky left-0 top-0 z-[70]
    w-[200px] min-w-[200px] max-w-[200px]
    h-[60px] min-h-[60px]
    border-r border-b border-border
    bg-white px-5 py-3.5
    text-left shadow-sm"
                      >
                        <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                          Employee
                        </div>

                        <div className="mt-1 text-xs font-semibold text-slate-700">
                          {selectedDate
                            ? "Selected date attendance"
                            : selectedWeek
                              ? "Weekly attendance"
                              : "Monthly attendance"}
                        </div>
                      </th>

                      {visibleRegisterDates.map((date) => {
                        const dateKey = formatDateKey(date);
                        const isRegisterToday = dateKey === todayKey;
                        const isRegisterWeekend =
                          date.getUTCDay() === 0 || date.getUTCDay() === 6;

                        return (
                          <th
                            key={dateKey}
                            className={`sticky top-0 z-[60] min-w-[165px] border-b border-border px-2.5 py-3 text-center shadow-sm will-change-transform ${
                              isRegisterToday
                                ? "bg-primary/10"
                                : isRegisterWeekend
                                  ? "bg-slate-100"
                                  : "bg-white"
                            }`}
                          >
                            <div
                              className={`text-[13.3px] font-bold uppercase tracking-wide ${
                                date.getUTCDay() === 6
                                  ? "text-black"
                                  : isRegisterWeekend
                                    ? "text-slate-400"
                                    : "text-slate-700"
                              }`}
                            >
                              {weekdays[date.getUTCDay()]}
                            </div>
                            <div
                              className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full font-display text-[17.1px] font-bold ${
                                date.getUTCDay() === 6
                                  ? "text-black"
                                  : isRegisterToday
                                    ? "bg-primary text-white shadow-sm"
                                    : "text-slate-900"
                              }`}
                            >
                              {String(date.getUTCDate()).padStart(2, "0")}
                            </div>
                            <div className="mt-1 text-[11.4px] font-medium text-muted-foreground">
                              {String(date.getUTCMonth() + 1).padStart(2, "0")}/
                              {date.getUTCFullYear()}
                            </div>
                            {isRegisterToday && (
                              <div className="mt-1.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                                Today
                              </div>
                            )}
                          </th>
                        );
                      })}

                      {isAllEmployees && !selectedDate && !selectedWeek && (
                        <>
                          <th className="sticky top-0 z-[60] min-w-[95px] border-l border-b border-border bg-emerald-50 px-3 py-3 text-center text-xs font-bold text-emerald-700 shadow-sm">
                            Present
                          </th>
                          <th className="sticky top-0 z-[60] min-w-[95px] border-b border-border bg-rose-50 px-3 py-3 text-center text-xs font-bold text-rose-700 shadow-sm">
                            Absent
                          </th>
                          <th className="sticky top-0 z-[60] min-w-[95px] border-b border-border bg-violet-50 px-3 py-3 text-center text-xs font-bold text-violet-700 shadow-sm">
                            Leave
                          </th>
                          <th className="sticky top-0 z-[60] min-w-[95px] border-b border-border bg-blue-50 px-3 py-3 text-center text-xs font-bold text-blue-700 shadow-sm">
                            Holiday
                          </th>
                          <th className="sticky top-0 z-[60] min-w-[95px] border-b border-border bg-slate-50 px-3 py-3 text-center text-xs font-bold text-slate-700 shadow-sm">
                            Total
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {registerEmployees.length > 0 ? (
                      registerEmployees.map((emp) => (
                        <tr key={emp.id} className="group">
                          <td className="sticky left-0 z-[40] border-r border-b border-border bg-white px-5 py-3.5 shadow-[2px_0_4px_rgba(0,0,0,0.04)] transition-colors group-hover:bg-slate-50">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary ring-4 ring-primary/5">
                                {emp.fullName
                                  .split(" ")
                                  .map((name) => name[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div
                                  className="line-clamp-2 break-words font-display text-[22px] leading-7 font-bold text-slate-900"
                                  title={emp.fullName}
                                >
                                  {emp.fullName}
                                </div>

                                {(emp.employeeCode || emp.email) && (
                                  <div
                                    className="mt-0.5 truncate text-[13px] font-medium text-muted-foreground"
                                    title={emp.employeeCode || emp.email}
                                  >
                                    {emp.employeeCode || emp.email}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {visibleRegisterDates.map((date) => {
                            const dateKey = formatDateKey(date);
                            const isRegisterToday = dateKey === todayKey;
                            const isRegisterWeekend =
                              date.getUTCDay() === 0 || date.getUTCDay() === 6;
                            let rec = attendanceByDateEmployee.get(
                              `${dateKey}:${emp.id}`,
                            );

                            if (
                              rec &&
                              rec.status === "ABSENT" &&
                              dateKey >= todayKey
                            )
                              rec = null;

                            const holidayName = registerData?.holidays?.find(
                              (h) =>
                                formatDateKey(new Date(h.date)) === dateKey,
                            )?.name;

                            const isHoliday =
                              Boolean(holidayName) || rec?.status === "HOLIDAY";
                            const isAbsent = rec?.status === "ABSENT";

                            const meta = rec ? statusMeta[rec.status] : null;
                            const cleanedNote = cleanAttendanceNote(
                              rec?.note || "",
                            );
                            const checkInLocationCode = getCalendarLocationCode(
                              rec?.note,
                              "check-in",
                            );
                            const checkOutLocationCode =
                              getCalendarLocationCode(rec?.note, "check-out");
                            const checkInUnassigned =
                              checkInLocationCode === "UL";
                            const checkOutUnassigned =
                              checkOutLocationCode === "UL";
                            const huException =
                              checkInLocationCode !== "UL" &&
                              checkOutLocationCode === "UL";
                            const uhException =
                              checkInLocationCode === "UL" &&
                              checkOutLocationCode !== "UL";
                            const ulException =
                              checkInLocationCode === "UL" &&
                              checkOutLocationCode === "UL";

                            return (
                              <td
                                key={dateKey}
                                className={`border-l border-b border-border px-2 py-2 align-top ${
                                  isRegisterToday
                                    ? "bg-primary/[0.025]"
                                    : isRegisterWeekend
                                      ? "bg-slate-50/70"
                                      : "bg-white"
                                }`}
                              >
                                {isHoliday && !isWorkedRecord(rec) ? (
                                  <div className="flex min-h-[125px] items-center justify-center rounded-xl border border-blue-200 bg-blue-50">
                                    <div className="text-lg font-bold text-blue-700">
                                      Holiday
                                    </div>
                                  </div>
                                ) : isAbsent ? (
                                  <div className="flex min-h-[125px] items-center justify-center rounded-xl border border-rose-200 bg-rose-50">
                                    <div className="text-center">
                                      <div className="text-lg font-bold text-rose-700">
                                        Absent
                                      </div>
                                    </div>
                                  </div>
                                ) : rec ? (
                                  <div
                                    className={`relative rounded-xl border p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-sm ${
                                      /Checkout.*unassigned location/i.test(
                                        rec.note || "",
                                      )
                                        ? "border-orange-300 bg-orange-50"
                                        : meta?.cell ||
                                          "border-border bg-slate-50"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-white/80 px-2 py-1 text-xs font-bold text-slate-700 shadow-sm">
                                        <span
                                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta?.dot || "bg-slate-400"}`}
                                        />
                                        <span className="truncate">
                                          {meta?.label || rec.status}
                                        </span>
                                      </span>

                                      {isHoliday && (
                                        <span className="rounded-md border border-blue-200 bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                                          Holiday
                                        </span>
                                      )}

                                      <div className="flex shrink-0 gap-1">
                                        {checkInLocationCode && (
                                          <span
                                            title={
                                              checkInLocationCode === "UL"
                                                ? "Check In: UL = Unassigned Location"
                                                : checkInLocationCode === "A"
                                                  ? "Check In: A = Assign Location"
                                                  : "Check In: O = Office"
                                            }
                                            className={`rounded-md border px-1.5 py-0.5 text-xs font-bold ${
                                              checkInLocationCode === "UL"
                                                ? "border-orange-300 bg-orange-100 text-orange-700"
                                                : checkInLocationCode === "A"
                                                  ? "border-blue-300 bg-blue-100 text-blue-700"
                                                  : "border-emerald-300 bg-emerald-100 text-emerald-700"
                                            }`}
                                          >
                                            {checkInLocationCode}
                                          </span>
                                        )}

                                        {checkOutLocationCode && (
                                          <span
                                            title={
                                              checkOutLocationCode === "UL"
                                                ? "Check Out: UL = Unassigned Location"
                                                : checkOutLocationCode === "A"
                                                  ? "Check Out: A = Assign Location"
                                                  : "Check Out: O = Office"
                                            }
                                            className={`rounded-md border px-1.5 py-0.5 text-xs font-bold ${
                                              checkOutLocationCode === "UL"
                                                ? "border-orange-300 bg-orange-100 text-orange-700"
                                                : checkOutLocationCode === "A"
                                                  ? "border-blue-300 bg-blue-100 text-blue-700"
                                                  : "border-emerald-300 bg-emerald-100 text-emerald-700"
                                            }`}
                                          >
                                            {checkOutLocationCode}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                                      <div className="rounded-lg bg-white/75 px-2 py-1.5">
                                        <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                                          Check In
                                        </div>
                                        <div className="mt-0.5 text-base font-bold text-emerald-700">
                                          {rec.checkIn
                                            ? fmtTime(rec.checkIn)
                                            : "—"}
                                        </div>
                                      </div>
                                      <div className="rounded-lg bg-white/75 px-2 py-1.5">
                                        <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                                          Check Out
                                        </div>
                                        <div className="mt-0.5 text-base font-bold text-rose-700">
                                          {rec.checkOut
                                            ? fmtTime(rec.checkOut)
                                            : "—"}
                                        </div>
                                      </div>
                                    </div>

                                    {rec.workedHours != null && (
                                      <div className="mt-2 flex items-center justify-between border-t border-black/5 pt-2">
                                        <span className="text-[11.4px] font-bold text-muted-foreground">
                                          Working Hours
                                        </span>
                                        <span className="font-display text-[15.2px] font-bold text-primary">
                                          {fmtWorkedHours(rec.workedHours)}
                                        </span>
                                      </div>
                                    )}

                                    {((isHoliday && isWorkedRecord(rec)) ||
                                      Number(rec.workedHours) > 8) && (
                                      <div className="pointer-events-none absolute bottom-2 right-2 z-10 flex items-center gap-1 rounded-md border border-orange-200 bg-orange-100/95 px-2 py-1 shadow-sm">
                                        <span className="text-[9px] font-bold uppercase tracking-wide text-orange-700">
                                          OT
                                        </span>

                                        <span className="text-[11px] font-bold text-orange-700">
                                          {fmtWorkedHours(
                                            isHoliday
                                              ? Number(rec.workedHours)
                                              : Number(rec.workedHours) - 8,
                                          )}
                                        </span>
                                      </div>
                                    )}

                                    {hasSubmittedReason(rec.note) && (
                                      <div className="mt-2 flex flex-wrap gap-1">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openAttendanceReason(
                                              rec,
                                              emp.fullName,
                                            )
                                          }
                                          className="rounded-md bg-amber-50 px-2 py-1 text-[8px] font-semibold text-amber-700 hover:bg-amber-100"
                                        >
                                          View Reason
                                        </button>
                                        {/* Approve / Reject actions are intentionally hidden from the calendar. */}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex min-h-[125px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60">
                                    <div className="text-center">
                                      <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-400">
                                        —
                                      </div>
                                      <div className="mt-1 text-[8px] font-medium text-muted-foreground">
                                        No record
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </td>
                            );
                          })}

                          {isAllEmployees &&
                            !selectedDate &&
                            !selectedWeek &&
                            (() => {
                              const monthSummary = getEmployeeMonthSummary(emp);

                              return (
                                <>
                                  <td className="border-l border-b border-border bg-emerald-50/60 px-3 py-2 text-center">
                                    <span className="inline-flex min-w-[38px] items-center justify-center rounded-lg bg-emerald-100 px-2.5 py-1.5 text-sm font-bold text-emerald-700">
                                      {monthSummary.present}
                                    </span>
                                  </td>
                                  <td className="border-b border-border bg-rose-50/60 px-3 py-2 text-center">
                                    <span className="inline-flex min-w-[38px] items-center justify-center rounded-lg bg-rose-100 px-2.5 py-1.5 text-sm font-bold text-rose-700">
                                      {monthSummary.absent}
                                    </span>
                                  </td>
                                  <td className="border-b border-border bg-violet-50/60 px-3 py-2 text-center">
                                    <span className="inline-flex min-w-[38px] items-center justify-center rounded-lg bg-violet-100 px-2.5 py-1.5 text-sm font-bold text-violet-700">
                                      {monthSummary.leave}
                                    </span>
                                  </td>
                                  <td className="border-b border-border bg-blue-50/60 px-3 py-2 text-center">
                                    <span className="inline-flex min-w-[38px] items-center justify-center rounded-lg bg-blue-100 px-2.5 py-1.5 text-sm font-bold text-blue-700">
                                      {monthSummary.holiday}
                                    </span>
                                  </td>
                                  <td className="border-b border-border bg-slate-50/70 px-3 py-2 text-center">
                                    <span className="inline-flex min-w-[38px] items-center justify-center rounded-lg bg-slate-100 px-2.5 py-1.5 text-sm font-bold text-slate-700">
                                      {monthSummary.total}
                                    </span>
                                  </td>
                                </>
                              );
                            })()}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={
                            registerDates.length +
                            1 +
                            (isAllEmployees && !selectedDate && !selectedWeek
                              ? 5
                              : 0)
                          }
                          className="px-6 py-14 text-center"
                        >
                          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                            <Users className="h-5 w-5 text-slate-400" />
                          </div>
                          <div className="mt-3 text-sm font-semibold text-slate-700">
                            No attendance records found
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            There are no employee attendance records for this
                            selected period.
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
            </div>
          ) : (
            /* Calendar */
            <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">
              <div className="px-6 py-5 border-b border-border bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-xl font-bold tracking-tight text-slate-900">
                      Attendance Calendar
                    </h2>
                    <p className="font-display text-sm font-medium tracking-wide text-muted-foreground mt-1">
                      {monthNames[month - 1]} {year}
                      {selectedWeek ? ` · Week ${selectedWeek}` : ""}
                    </p>
                  </div>

                  <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Present
                    <span className="w-2 h-2 rounded-full bg-rose-500 ml-3" />
                    Absent
                  </div>
                </div>
              </div>

              <div className="max-h-[650px] overflow-auto">
                {selectedDay ? (
                  <div className="p-4 sm:p-5 bg-slate-50/40">
                    {/* Selected day — styled like the All Employees attendance row */}
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="grid lg:grid-cols-[260px_1fr]">
                        {/* Employee column */}
                        <div className="border-b border-slate-200 bg-slate-50/80 p-5 lg:border-b-0 lg:border-r">
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
                              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                                Employee
                              </div>
                              <div className="truncate text-base font-bold text-slate-800">
                                {data?.employee?.fullName ||
                                  employees.find((emp) => emp.id === selectedId)
                                    ?.fullName ||
                                  "Employee"}
                              </div>
                              <div className="mt-0.5 text-xs text-slate-500">
                                {employees.find((emp) => emp.id === selectedId)
                                  ?.employeeCode || "Employee attendance"}
                              </div>
                            </div>
                          </div>

                          <div className="mt-5 border-t border-slate-200 pt-4">
                            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                              Selected Date
                            </div>
                            <div className="mt-1 text-lg font-bold text-slate-800">
                              {fmtDateDMY(selectedDate)}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {monthNames[month - 1]} {year}
                            </div>
                          </div>
                        </div>

                        {/* Attendance column */}
                        <div className="p-4 sm:p-5">
                          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                              Daily Attendance
                            </div>
                            {selectedRecord ? (
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                                  statusMeta[selectedRecord.status]?.cell ||
                                  "bg-slate-100 text-slate-700"
                                }`}
                              >
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    statusMeta[selectedRecord.status]?.dot ||
                                    "bg-slate-400"
                                  }`}
                                />
                                {statusMeta[selectedRecord.status]?.label ||
                                  selectedRecord.status}
                              </span>
                            ) : selectedHolidayName ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                                <span className="h-2 w-2 rounded-full bg-blue-500" />
                                Holiday
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700">
                                <span className="h-2 w-2 rounded-full bg-rose-500" />
                                No Attendance
                              </span>
                            )}
                          </div>

                          {selectedRecord ? (
                            selectedRecord.status === "ABSENT" ? (
                              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-center">
                                <div className="text-base font-bold text-rose-700">
                                  Absent
                                </div>
                                <div className="mt-1 text-xs text-rose-600">
                                  No attendance was recorded for this date.
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                      Check In
                                    </div>
                                    <div className="mt-1.5 flex items-center justify-between gap-2">
                                      <span className="text-base font-bold text-emerald-700">
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
                                              ? "border-blue-300 bg-blue-100 text-blue-700"
                                              : getCalendarLocationCode(
                                                    selectedRecord.note,
                                                    "check-in",
                                                  ) === "UL"
                                                ? "border-orange-300 bg-orange-100 text-orange-700"
                                                : "border-emerald-300 bg-emerald-100 text-emerald-700"
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

                                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                      Check Out
                                    </div>
                                    <div className="mt-1.5 flex items-center justify-between gap-2">
                                      <span className="text-base font-bold text-rose-700">
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
                                              ? "border-blue-300 bg-blue-100 text-blue-700"
                                              : getCalendarLocationCode(
                                                    selectedRecord.note,
                                                    "check-out",
                                                  ) === "UL"
                                                ? "border-orange-300 bg-orange-100 text-orange-700"
                                                : "border-emerald-300 bg-emerald-100 text-emerald-700"
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

                                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                      Working Hours
                                    </div>
                                    <div className="mt-1.5 text-base font-bold text-primary">
                                      {fmtWorkedHours(
                                        selectedRecord.workedHours,
                                      )}
                                    </div>
                                  </div>

                                  <div className="rounded-xl border border-orange-200 bg-orange-50/70 p-3">
                                    <div className="text-[10px] font-bold uppercase tracking-wide text-orange-600">
                                      Overtime
                                    </div>
                                    <div className="mt-1.5 text-base font-bold text-orange-700">
                                      {isHolidayDate(selectedRecord.date)
                                        ? isWorkedRecord(selectedRecord)
                                          ? fmtWorkedHours(
                                              selectedRecord.workedHours,
                                            )
                                          : "—"
                                        : Number(selectedRecord.workedHours) > 8
                                          ? fmtWorkedHours(
                                              Number(
                                                selectedRecord.workedHours,
                                              ) - 8,
                                            )
                                          : "—"}
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
                                      <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3">
                                        <div className="text-[10px] font-bold uppercase tracking-wide text-blue-600">
                                          Holiday
                                        </div>
                                        <div className="mt-1 text-sm font-semibold text-blue-900">
                                          {selectedHolidayName}
                                        </div>
                                      </div>
                                    )}
                                    {selectedRecord.note &&
                                      formatAttendanceNote(
                                        selectedRecord.note,
                                      ) && (
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                            Attendance Note
                                          </div>
                                          <div className="mt-1 whitespace-pre-line text-xs leading-5 text-slate-600">
                                            {formatAttendanceNote(
                                              selectedRecord.note,
                                            )}
                                          </div>
                                        </div>
                                      )}
                                  </div>
                                )}

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
                                      )
                                    }
                                    className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                                  >
                                    View attendance reason
                                  </button>
                                )}
                              </div>
                            )
                          ) : selectedHolidayName ? (
                            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-6 text-center">
                              <div className="text-base font-bold text-blue-700">
                                Holiday
                              </div>
                              <div className="mt-1 text-xs font-medium text-blue-600">
                                {selectedHolidayName}
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
                              <div className="text-base font-bold text-slate-600">
                                No attendance record
                              </div>
                              <div className="mt-1 text-xs text-slate-400">
                                No attendance was recorded for this date.
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="min-w-[980px]">
                    <div className="grid grid-cols-7 border-b border-border bg-slate-50/80">
                      {weekdays.map((w, index) => (
                        <div
                          key={w}
                          className={`py-3 text-center font-display text-xs font-bold uppercase tracking-[0.12em] ${
                            index === 0 || index === 6
                              ? "text-slate-400"
                              : "text-slate-600"
                          }`}
                        >
                          {w}
                        </div>
                      ))}
                    </div>

                    <div
                      className={`grid gap-px bg-border ${
                        selectedDay ? "grid-cols-1" : "grid-cols-7"
                      }`}
                    >
                      {(selectedDay ? [selectedDay] : calendarCells).map(
                        (day, idx) => {
                          if (day === null) {
                            return (
                              <div
                                key={`blank-${idx}`}
                                className="min-h-[155px] bg-slate-50/50"
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
                          )
                            rec = null;
                          const holidayName = holidayByDay[day];
                          const meta = rec
                            ? statusMeta[rec.status]
                            : holidayName
                              ? statusMeta.HOLIDAY
                              : null;
                          const isToday = dateKey === todayKey;
                          const dayOfWeek = cellDate.getUTCDay();
                          const dayLabel = weekdays[dayOfWeek].toUpperCase();
                          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                          return (
                            <div
                              key={day}
                              className={`min-h-[155px] bg-background p-4 transition-all hover:bg-slate-50 ${isWeekend ? "bg-slate-50/60" : ""} ${isToday ? "ring-2 ring-inset ring-primary z-10" : ""}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span
                                  className={`font-display text-2xl font-bold tracking-tight ${
                                    dayLabel === "SAT"
                                      ? "text-black"
                                      : isToday
                                        ? "text-primary"
                                        : "text-slate-700"
                                  }`}
                                >
                                  {String(day).padStart(2, "0")}
                                </span>
                                {isToday && (
                                  <span className="text-xs font-bold uppercase tracking-wide bg-primary/10 text-primary px-2 py-1 rounded-full">
                                    Today
                                  </span>
                                )}
                              </div>

                              {rec ? (
                                <div className="mt-3 space-y-2">
                                  <div
                                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-display text-[11px] font-bold tracking-wide ${meta?.cell}`}
                                  >
                                    <span
                                      className={`w-2 h-2 rounded-full ${meta?.dot}`}
                                    />
                                    {meta?.label || rec.status}
                                  </div>

                                  <div className="rounded-lg border border-border bg-white p-2.5 space-y-1.5">
                                    {rec.checkIn && (
                                      <div className="flex items-center justify-between gap-2 text-xs">
                                        <span className="text-[18px] text-muted-foreground">
                                          Check In
                                        </span>
                                        <div className="flex items-center gap-2">
                                          <span className="font-display text-[18px] font-bold text-emerald-700">
                                            {fmtTime(rec.checkIn)}
                                          </span>
                                          {getCalendarLocationCode(
                                            rec.note,
                                            "check-in",
                                          ) && (
                                            <span
                                              title={
                                                getCalendarLocationCode(
                                                  rec.note,
                                                  "check-in",
                                                ) === "A"
                                                  ? "Check In: A = Assign Location"
                                                  : getCalendarLocationCode(
                                                        rec.note,
                                                        "check-in",
                                                      ) === "UL"
                                                    ? "Check In: UL = Unassigned Location"
                                                    : "Check In: O = Office"
                                              }
                                              className={`rounded-md border px-1.5 py-0.5 text-xs font-bold ${
                                                getCalendarLocationCode(
                                                  rec.note,
                                                  "check-in",
                                                ) === "A"
                                                  ? "border-blue-300 bg-blue-100 text-blue-700"
                                                  : getCalendarLocationCode(
                                                        rec.note,
                                                        "check-in",
                                                      ) === "UL"
                                                    ? "border-orange-300 bg-orange-100 text-orange-700"
                                                    : "border-emerald-300 bg-emerald-100 text-emerald-700"
                                              }`}
                                            >
                                              {getCalendarLocationCode(
                                                rec.note,
                                                "check-in",
                                              )}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    {rec.checkOut && (
                                      <div className="flex items-center justify-between gap-2 text-xs">
                                        <span className="text-[18px] text-muted-foreground">
                                          Check Out
                                        </span>
                                        <div className="flex items-center gap-2">
                                          <span className="font-display text-[18px] font-bold text-rose-700">
                                            {fmtTime(rec.checkOut)}
                                          </span>
                                          {getCalendarLocationCode(
                                            rec.note,
                                            "check-out",
                                          ) && (
                                            <span
                                              title={
                                                getCalendarLocationCode(
                                                  rec.note,
                                                  "check-out",
                                                ) === "A"
                                                  ? "Check Out: A = Assign Location"
                                                  : getCalendarLocationCode(
                                                        rec.note,
                                                        "check-out",
                                                      ) === "UL"
                                                    ? "Check Out: UL = Unassigned Location"
                                                    : "Check Out: O = Office"
                                              }
                                              className={`rounded-md border px-1.5 py-0.5 text-xs font-bold ${
                                                getCalendarLocationCode(
                                                  rec.note,
                                                  "check-out",
                                                ) === "A"
                                                  ? "border-blue-300 bg-blue-100 text-blue-700"
                                                  : getCalendarLocationCode(
                                                        rec.note,
                                                        "check-out",
                                                      ) === "UL"
                                                    ? "border-orange-300 bg-orange-100 text-orange-700"
                                                    : "border-emerald-300 bg-emerald-100 text-emerald-700"
                                              }`}
                                            >
                                              {getCalendarLocationCode(
                                                rec.note,
                                                "check-out",
                                              )}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {rec.workedHours != null && (
                                    <div className="space-y-1">
                                      {/* Working Hours */}
                                      <div className="flex items-center justify-between gap-2 text-xs border-t border-border pt-1.5">
                                        <span className="text-[18px] text-muted-foreground">
                                          Working Hours
                                        </span>

                                        <span className="font-display text-[18px] font-bold text-primary">
                                          {fmtWorkedHours(rec.workedHours)}
                                        </span>
                                      </div>

                                      {/* Overtime - only if more than 8 hours */}
                                      {Number(rec.workedHours) > 8 && (
                                        <div className="flex items-center justify-between gap-2 text-xs">
                                          <span className="text-[18px] font-semibold text-orange-700">
                                            Overtime
                                          </span>

                                          <span className="font-display text-[18px] font-bold text-orange-700">
                                            {fmtWorkedHours(
                                              Number(rec.workedHours) - 8,
                                            )}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {rec.note &&
                                    formatAttendanceNote(rec.note) && (
                                      <div
                                        className="whitespace-pre-line text-sm leading-5 text-slate-500"
                                        title={rec.note}
                                      >
                                        {formatAttendanceNote(rec.note)}
                                      </div>
                                    )}
                                  {hasSubmittedReason(rec.note) && (
                                    <div className="mt-2 space-y-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openAttendanceReason(
                                            rec,
                                            data?.employee?.fullName ||
                                              "Employee",
                                          )
                                        }
                                        className="text-sm font-semibold text-amber-700 hover:text-amber-900 hover:underline"
                                      >
                                        View Reason
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : holidayName ? (
                                <div className="mt-5">
                                  <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 border border-blue-200 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                                    Holiday
                                  </div>
                                  <div className="mt-3 text-sm font-semibold text-blue-700">
                                    {holidayName}
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-8 text-center text-xs text-slate-400">
                                  No attendance
                                </div>
                              )}
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

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
        </>
      )}

      {/* Submitted Attendance Reason Modal */}
      {attendanceReasonModal && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAttendanceReasonModal(null);
          }}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            {/* Header */}
            <div className="relative border-b border-slate-200 bg-gradient-to-r from-amber-50 via-white to-slate-50 px-6 py-5">
              <div className="flex items-start gap-3 pr-10">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className="line-clamp-2 break-words font-display text-[22px] leading-7 font-bold text-slate-900"
                    title={attendanceReasonModal.employeeName}
                  >
                    {attendanceReasonModal.employeeName}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAttendanceReasonModal(null)}
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
                aria-label="Close attendance reason"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Details */}
            <div className="max-h-[75vh] overflow-y-auto px-6 py-5">
              <div className="mb-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Date
                  </div>
                  <div className="mt-1.5 text-[15px] font-bold text-slate-800">
                    {fmtDateDMY(attendanceReasonModal.date)}
                  </div>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
                    Status
                  </div>
                  <div className="mt-1.5 inline-flex items-center gap-1.5 text-[15px] font-bold text-amber-800">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    {attendanceReasonModal.statusLabel ||
                      attendanceReasonModal.status ||
                      ""}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Check In
                  </div>
                  <div className="mt-1.5 text-[15px] font-bold text-slate-800">
                    {fmtTime(attendanceReasonModal.checkIn) || "—"}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Check Out
                  </div>
                  <div className="mt-1.5 text-[15px] font-bold text-slate-800">
                    {fmtTime(attendanceReasonModal.checkOut) || "—"}
                  </div>
                </div>
              </div>

              {/* Submitted reason */}
              <div className="mb-5">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-base font-bold text-slate-900">
                    Submitted Reason
                  </h4>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-700">
                    Review
                  </span>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                  <p className="whitespace-pre-wrap text-[16px] leading-7 text-slate-700">
                    {attendanceReasonModal.reason || "No reason provided."}
                  </p>
                </div>
              </div>

              {/* Locations */}
              <div>
                <div className="mb-2 text-base font-bold text-slate-900">
                  Attendance Location
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {Number.isFinite(
                    Number(attendanceReasonModal.checkInLatitude),
                  ) &&
                  Number.isFinite(
                    Number(attendanceReasonModal.checkInLongitude),
                  ) ? (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${attendanceReasonModal.checkInLatitude},${attendanceReasonModal.checkInLongitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-[15px] font-bold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                    >
                      <MapPin className="h-4 w-4 transition group-hover:scale-110" />
                      View Check-in
                    </a>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-[13px] font-medium text-slate-500">
                      Check-in location unavailable
                    </div>
                  )}

                  {Number.isFinite(
                    Number(attendanceReasonModal.checkOutLatitude),
                  ) &&
                  Number.isFinite(
                    Number(attendanceReasonModal.checkOutLongitude),
                  ) ? (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${attendanceReasonModal.checkOutLatitude},${attendanceReasonModal.checkOutLongitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[15px] font-bold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                    >
                      <MapPin className="h-4 w-4 transition group-hover:scale-110" />
                      View Check-out
                    </a>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-[13px] font-medium text-slate-500">
                      Check-out location unavailable
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end border-t border-slate-200 bg-slate-50 px-6 py-3">
              <button
                type="button"
                onClick={() => setAttendanceReasonModal(null)}
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-[15px] font-bold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
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
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="border-b border-border bg-rose-50 p-5">
              <h3 className="text-lg font-semibold text-rose-900">
                Reject Attendance
              </h3>
              <p className="text-sm text-rose-700 mt-1">
                {rejectModal.employeeName}
              </p>
            </div>

            <div className="p-5 space-y-4">
              <label className="block text-sm font-medium text-slate-700">
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

            <div className="border-t border-border bg-slate-50/60 p-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRejectModal(null)}
                className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  rejectRecord(
                    rejectModal.recordId,
                    rejectModal.reason.trim() || "Unapproved location",
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
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-blue-100 p-6 flex items-center justify-between">
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
                className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
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
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-muted-foreground">Date & Time</div>
                    <div className="font-medium mt-1">
                      {mapModal.checkIn
                        ? new Date(mapModal.checkIn).toLocaleString()
                        : "N/A"}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-muted-foreground">Location Name</div>
                    <div className="font-medium mt-1">
                      {mapModal.locationName || "Unknown"}
                    </div>
                  </div>
                  <div className="col-span-2 bg-amber-50 rounded-lg p-3 border border-amber-200">
                    <div className="text-muted-foreground text-xs">
                      Approval Note
                    </div>
                    <div className="text-sm mt-1 text-amber-900">
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
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg border border-blue-100 p-4">
                  {mapModal.latitude && mapModal.longitude ? (
                    <div className="space-y-3">
                      <div className="bg-white rounded-lg p-4 space-y-2 border border-blue-200">
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
                          className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 text-sm font-medium transition-colors"
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
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
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
            <div className="border-t border-border bg-slate-50/50 p-6 flex gap-3 justify-end">
              <button
                onClick={() => setMapModal(null)}
                className="px-4 py-2 text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg font-medium transition-colors"
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
