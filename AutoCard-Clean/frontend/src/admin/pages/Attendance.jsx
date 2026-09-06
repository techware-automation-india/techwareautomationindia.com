import { useEffect, useRef, useState } from "react";
import { Clock, Loader2, ChevronLeft, ChevronRight, Users, X, CheckCircle2, AlertCircle, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../lib/api.js";

// Visual styling per attendance status.
const statusMeta = {
  PRESENT: { label: "Present", dot: "bg-emerald-500", cell: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  ABSENT: { label: "Absent", dot: "bg-rose-500", cell: "bg-rose-50 border-rose-200 text-rose-700" },
  ON_LEAVE: { label: "On Leave", dot: "bg-violet-500", cell: "bg-violet-50 border-violet-200 text-violet-700" },
  HOLIDAY: { label: "Holiday", dot: "bg-blue-500", cell: "bg-blue-50 border-blue-200 text-blue-700" },
  PENDING_APPROVAL: { label: "Awaiting Approval", dot: "bg-amber-500", cell: "bg-amber-50 border-amber-200 text-amber-700" },
};

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const fmtTime = (v) =>
  v ? new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;

const fmtWorkedHours = (value) => {
  if (value == null) return "—";
  const hours = Number(value);
  if (Number.isNaN(hours)) return "—";
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m}m`;
};

const formatAttendanceNote = (note) => {
  if (!note) return "";
  const hasUnassignedCheckIn = /Checkin(?:\s+from|\s+to)?\s+unassigned location/i.test(note);
  const hasUnassignedCheckOut = /Checkout(?:\s+from)?\s+unassigned location/i.test(note);
  const checkInMatch = note.match(/(?:^|\|)\s*Checkin:\s*([^|.]+?)(?:\s*\||$)/i);
  const checkOutMatch = note.match(/(?:^|\|)\s*Checkout:\s*([^|.]+?)(?:\s*\||$)/i);

  if (!hasUnassignedCheckIn && !hasUnassignedCheckOut && !checkInMatch && !checkOutMatch) return note;

  const checkInLocation = hasUnassignedCheckIn
    ? "Unassigned Location"
    : checkInMatch?.[1]?.trim();
  const checkOutLocation = hasUnassignedCheckOut
    ? "Unassigned Location"
    : checkOutMatch?.[1]?.trim();

  if (!checkInLocation && !checkOutLocation) return note;
  if (checkInLocation?.toLowerCase() === "head office" || checkOutLocation?.toLowerCase() === "head office") {
    return "Location: Head Office";
  }
  if (checkInLocation && checkOutLocation && checkInLocation.toLowerCase() === checkOutLocation.toLowerCase()) {
    return `Location: ${checkInLocation}`;
  }

  return [
    checkInLocation && `Check In: ${checkInLocation}`,
    checkOutLocation && `Check Out: ${checkOutLocation}`,
  ].filter(Boolean).join("\n");
};

const extractSubmittedReason = (note) => {
  if (!note) return "No reason provided.";
  const reasonMatch = note.match(/Reason:\s*(.*?)(?:\.\s*Pending admin approval|\.|$)/i);
  return reasonMatch?.[1]?.trim() || note;
};

const hasSubmittedReason = (note) => /reason:/i.test(note || "");

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

const Attendance = () => {
  const navigate = useNavigate();
  const today = new Date();
  const todayKey = formatDateKey(new Date());
  const [employees, setEmployees] = useState([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [selectedId, setSelectedId] = useState("all");
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-12
  const [data, setData] = useState(null);
  const [registerData, setRegisterData] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [registerStart, setRegisterStart] = useState(null); // ISO date key for weekly register start (YYYY-MM-DD)
  const [showDetailedRecords, setShowDetailedRecords] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [mapModal, setMapModal] = useState(null); // null or { latitude, longitude, employee, checkIn }
  const [rejectModal, setRejectModal] = useState(null); // null or { recordId, employeeName, reason }
  const [attendanceReasonModal, setAttendanceReasonModal] = useState(null);
  const knownPendingIds = useRef(null);
  const isAllEmployees = selectedId === "all";

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
        const newRequest = nextPending.find((record) => !knownPendingIds.current.has(record.id));
        if (newRequest) {
          const employeeName = newRequest.employee?.user?.fullName || "An employee";
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

    const coordMatch = record.note.match(/(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/);
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
    
    if (coords && Number.isFinite(coords.latitude) && Number.isFinite(coords.longitude)) {
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

  // Fetch attendance whenever the selected employee or month changes.
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
          const startParam = registerStart ? `&start=${registerStart}` : "";
          const res = await apiGet(`/attendance/register/weekly?days=7${startParam}`);
          if (active) {
            setRegisterData(res);
            setData(null);
            setShowDetailedRecords(false);
          }
        } else {
          const res = await apiGet(`/attendance/${selectedId}?year=${year}&month=${month}`);
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
  }, [selectedId, year, month]);
  // Include registerStart in effect so changing week reloads the register
  useEffect(() => {
    // trigger reload when viewing all employees and registerStart changes
    if (selectedId === "all") {
      // force re-fetch by toggling selectedId briefly
      (async () => {
        setLoadingData(true);
        try {
          const startParam = registerStart ? `&start=${registerStart}` : "";
          const res = await apiGet(`/attendance/register/weekly?days=7${startParam}`);
          setRegisterData(res);
          setData(null);
          setShowDetailedRecords(false);
        } catch (err) {
          toast.error(err.message || "Failed to load attendance.");
          setRegisterData(null);
        } finally {
          setLoadingData(false);
        }
      })();
    }
  }, [registerStart]);

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
    setMonth(m);
    setYear(y);
  };

  const computeLastWeekStartKey = () => {
    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startOfThisWeek = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), todayUtc.getUTCDate() - todayUtc.getUTCDay()));
    const lastWeekStart = new Date(Date.UTC(startOfThisWeek.getUTCFullYear(), startOfThisWeek.getUTCMonth(), startOfThisWeek.getUTCDate() - 7));
    return formatDateKey(lastWeekStart);
  };

  const computeMonthWeeks = (y, m) => {
    // Split the selected month into week buckets: 1-7, 8-14, 15-21, 22-28, 29-end
    const firstDay = new Date(Date.UTC(y, m - 1, 1));
    const lastDay = new Date(Date.UTC(y, m, 0));
    const weeks = [];
    for (let startDay = 1; startDay <= lastDay.getUTCDate(); startDay += 7) {
      const start = new Date(Date.UTC(y, m - 1, startDay));
      const endDay = Math.min(startDay + 6, lastDay.getUTCDate());
      const end = new Date(Date.UTC(y, m - 1, endDay));
      weeks.push({ start, end });
    }
    return weeks;
  };

  // Reset the selected register week when month/year changes so dropdown shows weeks for that month
  useEffect(() => {
    setRegisterStart(null);
  }, [month, year]);

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

  // Calendar grid cells: leading blanks + days of month.
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const summary = isAllEmployees
    ? registerData?.summary || {}
    : data?.summary || {};
  const records = isAllEmployees ? registerData?.records || [] : data?.records || [];
  const overtimeDays = records.filter((record) => Number(record.workedHours) > 8).length;
  const overtimeMeta = {
    label: "Overtime",
    dot: "bg-orange-500",
    cell: "bg-orange-50 border-orange-200 text-orange-700",
  };
  const filteredRecords = selectedStatus
    ? records.filter((rec) => {
        if (selectedStatus === "OVERTIME") {
          return Number(rec.workedHours) > 8;
        }
        // Do not show ABSENT records for today or future days (people may still arrive)
        if (selectedStatus === "ABSENT") {
          const recKey = formatDateKey(rec.date);
          if (recKey >= todayKey) return false;
        }
        return rec.status === selectedStatus;
      })
    : records;
  const selectedStatusMeta = selectedStatus === "OVERTIME" ? overtimeMeta : statusMeta[selectedStatus];

  const registerStartDate = registerData?.startDate ? new Date(registerData.startDate) : null;
  const registerDates = registerStartDate
    ? Array.from({ length: registerData.days ?? 7 }, (_, index) => {
        return new Date(Date.UTC(
          registerStartDate.getUTCFullYear(),
          registerStartDate.getUTCMonth(),
          registerStartDate.getUTCDate() + index,
        ));
      })
    : [];

  const registerEmployeeMap = new Map();
  if (registerData?.records?.length) {
    for (const rec of registerData.records) {
      if (!registerEmployeeMap.has(rec.employeeId)) {
        registerEmployeeMap.set(rec.employeeId, {
          id: rec.employeeId,
          fullName: rec.fullName,
          employeeCode: rec.employeeCode,
          email: rec.email,
        });
      }
    }
  }
  const registerEmployees = Array.from(registerEmployeeMap.values());

  const attendanceByDateEmployee = new Map(
    (registerData?.records || []).map((rec) => [`${formatDateKey(new Date(rec.date))}:${rec.employeeId}`, rec]),
  );

  const handleStatusClick = (key) => {
    setSelectedStatus((prev) => (prev === key ? null : key));
    setShowDetailedRecords(false);
  };

  const reloadRegister = async () => {
    try {
      setLoadingData(true);
      const startParam = registerStart ? `&start=${registerStart}` : "";
      const res = await apiGet(`/attendance/register/weekly?days=7${startParam}`);
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
        const res = await apiGet(`/attendance/${selectedId}?year=${year}&month=${month}`);
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
        const res = await apiGet(`/attendance/${selectedId}?year=${year}&month=${month}`);
        setData(res);
      }
    } catch (err) {
      toast.error(err.message || "Failed to reject.");
    }
  };

  const openRejectModal = (record) => {
    setRejectModal({
      recordId: record.id,
      employeeName: record.employee?.user?.fullName || record.employee?.fullName || "Employee",
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
      statusLabel: statusMeta[record.status]?.label || record.status || "Awaiting Approval",
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
                <div className="font-display text-lg font-semibold">{selectedStatusMeta?.label} Attendance</div>
                <div className="text-xs text-muted-foreground">
                  {filteredRecords.length} record{filteredRecords.length === 1 ? "" : "s"} found
                </div>
              </div>
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${selectedStatusMeta?.cell}`}>
                <span className={`w-2 h-2 rounded-full ${selectedStatusMeta?.dot}`} />
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
                              <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                                Awaiting Approval
                              </span>
                              <span className="text-xs text-muted-foreground">{rec.employee?.user?.fullName || rec.employee?.fullName || "Employee"}</span>
                            </div>
                            <div className="text-sm text-amber-900">
                              <span className="font-semibold">Date:</span> {fmtDateDMY(rec.date)}
                            </div>
                            <div className="text-sm text-amber-900">
                              <span className="font-semibold">Check-in:</span> {fmtTime(rec.checkIn) ?? "—"}
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
                              onClick={() => rejectRecord(rec.id, rec.note || "Unapproved location")}
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
                      <tr key={rec.id} className="hover:bg-secondary/50 transition-colors">
                        <td className="py-3 pr-4">{fmtDateDMY(rec.date)}</td>
                        <td className="py-3 pr-4">{statusMeta[rec.status]?.label || rec.status}</td>
                        <td className="py-3 pr-4">{fmtTime(rec.checkIn) ?? "—"}</td>
                        <td className="py-3 pr-4">{fmtTime(rec.checkOut) ?? "—"}</td>
                        <td className="py-3 pr-4">{fmtWorkedHours(rec.workedHours)}</td>
                        <td className="py-3 pr-4 max-w-xl truncate">{rec.note || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">
                No {selectedStatusMeta?.label.toLowerCase()} records for {monthNames[month - 1]} {year}.
              </p>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4">
          {Object.entries(statusMeta).map(([key, meta]) => (
            <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
          <p className="text-sm text-muted-foreground">View employee attendance logs in a calendar.</p>
        </div>
      </div>

      <div className={`flex w-full items-center justify-between gap-4 rounded-2xl border-2 px-5 py-4 shadow-sm ${pendingApprovals.length > 0 ? "border-rose-300 bg-rose-50" : "border-blue-200 bg-blue-50"}`}>
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${pendingApprovals.length > 0 ? "bg-rose-100 text-rose-700" : "bg-blue-100 text-blue-700"}`}>
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <div className={`font-display font-bold ${pendingApprovals.length > 0 ? "text-rose-900" : "text-blue-900"}`}>Awaiting Approval</div>
            <div className={`text-xs ${pendingApprovals.length > 0 ? "text-rose-700" : "text-blue-700"}`}>
              {pendingApprovals.length > 0
                ? `${pendingApprovals.length} unassigned-location request${pendingApprovals.length === 1 ? "" : "s"} need review`
                : "No unassigned-location requests"}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate("/admin/attendance-requests")}
          className={`rounded-lg px-3 py-2 text-xs font-bold text-white ${pendingApprovals.length > 0 ? "bg-rose-600 hover:bg-rose-700" : "bg-blue-600 hover:bg-blue-700"}`}
        >
          View requests
          <span className={`ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] ${pendingApprovals.length > 0 ? "text-rose-700" : "text-blue-700"}`}>
            {pendingApprovals.length}
          </span>
        </button>
      </div>

      {/* Controls */}
      <div className="rounded-2xl bg-background border border-border card-shadow p-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-1.5 block">Select Employee</label>
            <select
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={loadingEmployees}
            >
              <option value="all">View All Employees</option>
              <option value="">{loadingEmployees ? "Loading employees..." : "Choose an employee..."}</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} ({emp.employeeCode})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => changeMonth(-1)}
              className="w-10 h-10 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="min-w-[160px] text-center font-display font-semibold">
              {monthNames[month - 1]} {year}
            </div>
            <button
              onClick={() => changeMonth(1)}
              className="w-10 h-10 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {!selectedId ? (
        <div className="rounded-2xl border border-dashed border-border bg-background p-12 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mb-4">
            <Users className="h-7 w-7 text-muted-foreground" />
          </div>
          <h2 className="font-display text-lg font-semibold mb-1">Select an employee</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Choose an employee above to view their attendance calendar for the selected month.
          </p>
        </div>
      ) : loadingData ? (
        <div className="p-12 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading attendance...
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
                      <span className={`w-2.5 h-2.5 rounded-full ${meta.dot}`} />
                      <span className="text-xs text-muted-foreground">{meta.label}</span>
                    </div>
                    <div className="font-display text-xl font-bold">{summary[key] || 0}</div>
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
          <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">
            <div className="px-6 py-5 border-b border-border bg-gradient-to-r from-slate-50 to-white flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="font-display text-lg font-bold text-slate-900">Team Attendance</div>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">
                    All employees
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {fmtDateDMY(registerData?.startDate)} – {fmtDateDMY(registerData?.endDate)} · {registerEmployees.length} employee{registerEmployees.length === 1 ? "" : "s"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mr-1">Week</label>
                <select
                  value={registerStart || ""}
                  onChange={(e) => setRegisterStart(e.target.value || null)}
                  className="px-3 py-2 rounded-lg text-sm border border-border bg-background shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">This Week</option>
                  {computeMonthWeeks(year, month).map((w, i) => {
                    const key = formatDateKey(w.start);
                    return (
                      <option key={key} value={key}>
                        {`${i + 1}${["th","st","nd","rd"][((i+1)%10)] || "th"} week — ${String(w.start.getUTCDate()).padStart(2,'0')}/${String(w.start.getUTCMonth()+1).padStart(2,'0')} - ${String(Math.min(w.end.getUTCDate(), new Date(year, month, 0).getUTCDate()).toString()).padStart(2,'0')}/${String(w.end.getUTCMonth()+1).padStart(2,'0')}`}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-50/80 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="sticky left-0 z-20 bg-slate-50/95 border-r border-border px-5 py-4 font-display font-bold tracking-[0.08em]">Employee</th>
                    {registerDates.map((date) => {
                      const dateKey = formatDateKey(date);
                      const isRegisterToday = dateKey === todayKey;
                      const isRegisterWeekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
                      return (
                        <th key={dateKey} className={`px-5 py-4 min-w-[12rem] ${isRegisterToday ? "bg-primary/5" : isRegisterWeekend ? "bg-slate-100/60" : ""}`}>
                          <div className="flex items-center gap-2">
                            <div className={`font-display font-bold text-sm tracking-wide ${isRegisterWeekend ? "text-slate-400" : "text-slate-900"}`}>{weekdays[date.getUTCDay()]}</div>
                            {isRegisterToday && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">Today</span>}
                          </div>
                          <div className="mt-1 font-display text-[11px] font-medium tracking-wide text-muted-foreground">{String(date.getUTCDate()).padStart(2, "0")}/{String(date.getUTCMonth() + 1).padStart(2, "0")}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {registerEmployees.length > 0 ? (
                    registerEmployees.map((emp) => (
                      <tr key={emp.id} className="border-t border-border hover:bg-slate-50/60 transition-colors">
                        <td className="sticky left-0 z-10 bg-background border-r border-border px-5 py-4 font-medium text-slate-900">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                              {emp.fullName.split(" ").map((name) => name[0]).join("").slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-display text-[15px] font-bold tracking-tight">{emp.fullName}</div>
                              {emp.employeeCode || emp.email ? (
                                <div className="mt-0.5 text-[11px] font-medium tracking-wide text-muted-foreground">{emp.employeeCode || emp.email}</div>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        {registerDates.map((date) => {
                          const dateKey = formatDateKey(date);
                          const isRegisterToday = dateKey === todayKey;
                          const isRegisterWeekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
                          let rec = attendanceByDateEmployee.get(`${dateKey}:${emp.id}`);
                          // Treat today's and future ABSENT as no record (user may still arrive)
                          if (rec && rec.status === "ABSENT" && dateKey >= todayKey) {
                            rec = null;
                          }
                          const meta = rec ? statusMeta[rec.status] : null;
                          return (
                            <td key={dateKey} className={`px-4 py-4 align-top border-l border-border ${isRegisterToday ? "bg-primary/[0.03]" : isRegisterWeekend ? "bg-slate-50/60" : "bg-background"}`}>
                              {rec ? (
                                <div className={`min-h-[155px] rounded-xl border p-3 ${meta?.cell || "border-border bg-slate-50/70"}`}>
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-white/80 px-2 py-1 font-display text-[10px] font-bold tracking-wide text-slate-700 shadow-sm">
                                    <span className={`w-2 h-2 rounded-full ${meta?.dot}`} />
                                    {meta?.label || rec.status}
                                    </div>
                                    {rec.workedHours != null && Number(rec.workedHours) > 8 && (
                                      <span className="shrink-0 text-[10px] font-bold text-orange-700">OT</span>
                                    )}
                                  </div>
                                  <div className="mt-2 space-y-1 text-sm leading-6 text-muted-foreground">
                                    {rec.checkIn && <div className="flex justify-between gap-2"><span>Check in</span><span className="font-display font-bold text-emerald-700">{fmtTime(rec.checkIn)}</span></div>}
                                    {rec.checkOut && <div className="flex justify-between gap-2"><span>Check out</span><span className="font-display font-bold text-rose-700">{fmtTime(rec.checkOut)}</span></div>}
                                  </div>
                                  {rec.note ? (
                                    <div className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-500" title={rec.note}>{formatAttendanceNote(rec.note)}</div>
                                  ) : null}
                                  {hasSubmittedReason(rec.note) && (
                                    <div className="mt-2 space-y-2">
                                      <button
                                        type="button"
                                        onClick={() => openAttendanceReason(rec, emp.fullName)}
                                        className="text-[11px] font-semibold text-amber-700 hover:text-amber-900 hover:underline"
                                      >
                                        View reason
                                      </button>
                                      {rec.status === "PENDING_APPROVAL" && (
                                        <div className="flex items-center gap-1.5">
                                          <button onClick={() => approveRecord(rec.id)} className="px-2 py-1 text-[10px] font-semibold rounded-md bg-emerald-100 text-emerald-700 hover:bg-emerald-200">Approve</button>
                                          <button onClick={() => openRejectModal(rec)} className="px-2 py-1 text-[10px] font-semibold rounded-md bg-rose-100 text-rose-700 hover:bg-rose-200">Reject</button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="rounded-xl border border-dashed border-border bg-slate-50/50 px-2.5 py-3 text-[10px] text-muted-foreground">No record</div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={registerDates.length + 1} className="px-6 py-10 text-center text-sm text-muted-foreground">
                        No attendance records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          ) : (
          /* Calendar */
          <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">
            <div className="px-6 py-5 border-b border-border bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-xl font-bold tracking-tight text-slate-900">Attendance Calendar</h2>
                  <p className="font-display text-sm font-medium tracking-wide text-muted-foreground mt-1">{monthNames[month - 1]} {year}</p>
                </div>

                <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Present
                  <span className="w-2 h-2 rounded-full bg-rose-500 ml-3" />
                  Absent
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[980px]">
                <div className="grid grid-cols-7 border-b border-border bg-slate-50/80">
                  {weekdays.map((w, index) => (
                    <div
                      key={w}
                      className={`py-3 text-center font-display text-xs font-bold uppercase tracking-[0.12em] ${
                        index === 0 || index === 6 ? "text-slate-400" : "text-slate-600"
                      }`}
                    >
                      {w}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-px bg-border">
              {cells.map((day, idx) => {
                if (day === null) {
                  return <div key={`blank-${idx}`} className="min-h-[155px] bg-slate-50/50" />;
                }

                const cellDate = new Date(Date.UTC(year, month - 1, day));
                const dateKey = formatDateKey(cellDate);
                let rec = recordByDay[day];
                if (rec && rec.status === "ABSENT" && dateKey >= todayKey) rec = null;
                const holidayName = holidayByDay[day];
                const meta = rec ? statusMeta[rec.status] : holidayName ? statusMeta.HOLIDAY : null;
                const isToday = dateKey === todayKey;
                const dayOfWeek = cellDate.getUTCDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                return (
                  <div
                    key={day}
                    className={`min-h-[155px] bg-background p-4 transition-all hover:bg-slate-50 ${isWeekend ? "bg-slate-50/60" : ""} ${isToday ? "ring-2 ring-inset ring-primary z-10" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-lg font-display text-sm font-bold ${isToday ? "bg-primary text-primary-foreground shadow-sm" : isWeekend ? "text-slate-400" : "text-slate-800"}`}>
                        {day}
                      </div>
                      {isToday && (
                        <span className="text-[10px] font-bold uppercase tracking-wide bg-primary/10 text-primary px-2 py-1 rounded-full">
                          Today
                        </span>
                      )}
                    </div>

                    {rec ? (
                      <div className="mt-3 space-y-2">
                        <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-display text-[11px] font-bold tracking-wide ${meta?.cell}`}>
                          <span className={`w-2 h-2 rounded-full ${meta?.dot}`} />
                          {meta?.label || rec.status}
                        </div>

                        <div className="rounded-lg border border-border bg-white p-2.5 space-y-1.5">
                          {rec.checkIn && (
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="text-[18px] text-muted-foreground">Check In</span>
                              <span className="font-display text-[18px] font-bold text-emerald-700">{fmtTime(rec.checkIn)}</span>
                            </div>
                          )}
                          {rec.checkOut && (
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="text-[18px] text-muted-foreground">Check Out</span>
                              <span className="font-display text-[18px] font-bold text-rose-700">{fmtTime(rec.checkOut)}</span>
                            </div>
                          )}
                        </div>

                        {rec.workedHours != null && Number(rec.workedHours) > 8 && (
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 border border-orange-200 px-2.5 py-1 text-[11px] font-bold text-orange-700">
                            <Clock className="h-3 w-3" />
                            OT {fmtWorkedHours(Number(rec.workedHours) - 8)}
                          </div>
                        )}
                        {rec.note && formatAttendanceNote(rec.note) && (
                          <div className="whitespace-pre-line text-sm leading-5 text-slate-500" title={rec.note}>
                            {formatAttendanceNote(rec.note)}
                          </div>
                        )}
                        {hasSubmittedReason(rec.note) && (
                          <div className="mt-2 space-y-2">
                            <button
                              type="button"
                              onClick={() => openAttendanceReason(rec, data?.employee?.fullName || "Employee")}
                              className="text-sm font-semibold text-amber-700 hover:text-amber-900 hover:underline"
                            >
                              View reason
                            </button>
                            {rec.status === "PENDING_APPROVAL" && (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => approveRecord(rec.id)}
                                  className="rounded-md bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-200"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openRejectModal(rec)}
                                  className="rounded-md bg-rose-100 px-2 py-1 text-[10px] font-semibold text-rose-700 hover:bg-rose-200"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : holidayName ? (
                      <div className="mt-5">
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 border border-blue-200 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          Holiday
                        </div>
                        <div className="mt-3 text-sm font-semibold text-blue-700">{holidayName}</div>
                      </div>
                    ) : (
                      <div className="mt-8 text-center text-xs text-slate-400">No attendance</div>
                    )}
                  </div>
                );
              })}
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-4">
            {Object.entries(statusMeta).map(([key, meta]) => (
              <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={`w-3 h-3 rounded-full ${meta.dot}`} />
                {meta.label}
              </div>
            ))}
          </div>

        </>
      )}

      {/* Submitted Attendance Reason Modal */}
      {attendanceReasonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-amber-200 bg-amber-50 p-5">
              <div>
                <h3 className="font-display text-lg font-bold text-amber-900">
                  {attendanceReasonModal.recordId ? "Attendance Request" : "Attendance Requests"}
                </h3>
                <p className="mt-1 text-sm text-amber-700">{attendanceReasonModal.employeeName}</p>
              </div>
              <button
                type="button"
                onClick={() => setAttendanceReasonModal(null)}
                className="rounded-lg p-2 text-amber-700 transition-colors hover:bg-amber-100"
                aria-label="Close attendance reason"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">
              <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs text-muted-foreground">Date</div>
                  <div className="mt-1 font-medium">{fmtDateDMY(attendanceReasonModal.date)}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs text-muted-foreground">Status</div>
                  <div className="mt-1 font-semibold text-amber-700">{attendanceReasonModal.statusLabel || attendanceReasonModal.status || "Awaiting Approval"}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs text-muted-foreground">Check In</div>
                  <div className="mt-1 font-medium">{fmtTime(attendanceReasonModal.checkIn) || "—"}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xs text-muted-foreground">Check Out</div>
                  <div className="mt-1 font-medium">{fmtTime(attendanceReasonModal.checkOut) || "—"}</div>
                </div>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm leading-6 text-amber-950">
                {attendanceReasonModal.reason}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {Number.isFinite(Number(attendanceReasonModal.checkInLatitude)) && Number.isFinite(Number(attendanceReasonModal.checkInLongitude)) ? (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${attendanceReasonModal.checkInLatitude},${attendanceReasonModal.checkInLongitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                  >
                    <MapPin className="h-4 w-4" />
                    View Check-in Location
                  </a>
                ) : (
                  <div className="rounded-lg bg-slate-100 px-3 py-2 text-center text-xs text-muted-foreground">
                    Check-in location unavailable
                  </div>
                )}
                {Number.isFinite(Number(attendanceReasonModal.checkOutLatitude)) && Number.isFinite(Number(attendanceReasonModal.checkOutLongitude)) ? (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${attendanceReasonModal.checkOutLatitude},${attendanceReasonModal.checkOutLongitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700"
                  >
                    <MapPin className="h-4 w-4" />
                    View Check-out Location
                  </a>
                ) : (
                  <div className="rounded-lg bg-slate-100 px-3 py-2 text-center text-xs text-muted-foreground">
                    Check-out location unavailable
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border bg-slate-50/60 p-5">
              {attendanceReasonModal.recordId && attendanceReasonModal.status === "PENDING_APPROVAL" ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      approveRecord(attendanceReasonModal.recordId);
                      setAttendanceReasonModal(null);
                    }}
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const request = pendingApprovals.find((item) => item.id === attendanceReasonModal.recordId);
                      setAttendanceReasonModal(null);
                      if (request) openRejectModal(request);
                    }}
                    className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                  >
                    Reject
                  </button>
                </div>
              ) : <span />}
              <button
                type="button"
                onClick={() => setAttendanceReasonModal(null)}
                className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-300"
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
              <h3 className="text-lg font-semibold text-rose-900">Reject Attendance</h3>
              <p className="text-sm text-rose-700 mt-1">{rejectModal.employeeName}</p>
            </div>

            <div className="p-5 space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Admin comment
                <textarea
                  value={rejectModal.reason}
                  onChange={(e) => setRejectModal((prev) => ({ ...prev, reason: e.target.value }))}
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
                onClick={() => rejectRecord(rejectModal.recordId, rejectModal.reason.trim() || "Unapproved location")}
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
                <h3 className="text-xl font-semibold text-foreground">Check-in Location Verification</h3>
                <p className="text-sm text-muted-foreground mt-1">{mapModal.employee?.user?.fullName}</p>
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
                <h4 className="font-semibold text-foreground">Check-in Details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-muted-foreground">Date & Time</div>
                    <div className="font-medium mt-1">
                      {mapModal.checkIn ? new Date(mapModal.checkIn).toLocaleString() : "N/A"}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-muted-foreground">Location Name</div>
                    <div className="font-medium mt-1">{mapModal.locationName || "Unknown"}</div>
                  </div>
                  <div className="col-span-2 bg-amber-50 rounded-lg p-3 border border-amber-200">
                    <div className="text-muted-foreground text-xs">Approval Note</div>
                    <div className="text-sm mt-1 text-amber-900">{mapModal.note}</div>
                  </div>
                </div>
              </div>

              {/* Map Container */}
              <div className="space-y-3">
                <h4 className="font-semibold text-foreground">Location on Map</h4>
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg border border-blue-100 p-4">
                  {mapModal.latitude && mapModal.longitude ? (
                    <div className="space-y-3">
                      <div className="bg-white rounded-lg p-4 space-y-2 border border-blue-200">
                        <div className="text-sm">
                          <span className="text-muted-foreground">Latitude:</span>
                          <span className="font-mono ml-2 font-semibold">{mapModal.latitude.toFixed(6)}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Longitude:</span>
                          <span className="font-mono ml-2 font-semibold">{mapModal.longitude.toFixed(6)}</span>
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
                            navigator.clipboard.writeText(`${mapModal.latitude},${mapModal.longitude}`);
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
                  <li>✓ Click "View on Google Maps" to see the exact location where the employee checked in</li>
                  <li>✓ Compare this location with the assigned/default location</li>
                  <li>✓ Verify the distance and context (travel time, valid reason, etc.)</li>
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

    </div>
  );
};

export default Attendance;
