import { useEffect, useState } from "react";
import { Clock, Loader2, ChevronLeft, ChevronRight, Users, X, CheckCircle2, AlertCircle, MapPin } from "lucide-react";
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
  const [loadingPendingApprovals, setLoadingPendingApprovals] = useState(false);
  const [mapModal, setMapModal] = useState(null); // null or { latitude, longitude, employee, checkIn }
  const [rejectModal, setRejectModal] = useState(null); // null or { recordId, employeeName, reason }
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
      setLoadingPendingApprovals(true);
      const res = await apiGet("/attendance/pending-approvals");
      setPendingApprovals(res.pendingRecords || []);
    } catch (err) {
      console.error("Failed to load pending approvals:", err);
    } finally {
      setLoadingPendingApprovals(false);
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
      const locationName =
        record?.note?.match(/: (.*?)(?:\s*\(|$)/)?.[1]?.trim() ||
        record?.note?.match(/to\s+(.+?)(?:\s*\(|\.|$)/)?.[1]?.trim() ||
        "Unknown Location";

      setMapModal({
        latitude: coords.latitude,
        longitude: coords.longitude,
        employee: record.employee,
        checkIn: record.checkIn || record.checkOut,
        note: record.note,
        locationName,
      });
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
  const filteredRecords = selectedStatus
    ? records.filter((rec) => {
        // Do not show ABSENT records for today or future days (people may still arrive)
        if (selectedStatus === "ABSENT") {
          const recKey = formatDateKey(rec.date);
          if (recKey >= todayKey) return false;
        }
        return rec.status === selectedStatus;
      })
    : records;

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
              {statusMeta[selectedStatus]?.label} Records
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
                <div className="font-display text-lg font-semibold">{statusMeta[selectedStatus]?.label} Attendance</div>
                <div className="text-xs text-muted-foreground">
                  {filteredRecords.length} record{filteredRecords.length === 1 ? "" : "s"} found
                </div>
              </div>
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${statusMeta[selectedStatus]?.cell}`}>
                <span className={`w-2 h-2 rounded-full ${statusMeta[selectedStatus]?.dot}`} />
                {statusMeta[selectedStatus]?.label}
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
                No {statusMeta[selectedStatus].label.toLowerCase()} records for {monthNames[month - 1]} {year}.
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

     

      {/* Pending Approvals */}
      {pendingApprovals.length > 0 && (
        <div className="rounded-2xl bg-background border border-amber-200 card-shadow overflow-hidden">
          {/* Header */}
          <div className="border-b border-amber-200 bg-amber-50/50 px-6 py-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-700" />
              <span className="font-semibold text-amber-900">Approval Requests ({pendingApprovals.length})</span>
            </div>
          </div>

          {/* Check-in Approvals */}
          <div>
            <div className="px-6 py-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="font-display text-lg font-semibold text-amber-900">Approval Requests</div>
                  <div className="text-xs text-amber-700">
                    {pendingApprovals.length} record{pendingApprovals.length === 1 ? "" : "s"} awaiting approval
                  </div>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-800">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Review location before approval
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm divide-y divide-border">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground bg-secondary/30">
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Check In</th>
                      <th className="px-4 py-3">Location Review</th>
                      <th className="px-4 py-3">Reason</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pendingApprovals.map((rec) => (
                      <tr key={rec.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{rec.employee.user.fullName}</div>
                          <div className="text-xs text-muted-foreground">{rec.employee.employeeCode}</div>
                        </td>
                        <td className="px-4 py-3">{fmtDateDMY(rec.date)}</td>
                        <td className="px-4 py-3">{fmtTime(rec.checkIn) ?? "—"}</td>
                        <td className="px-4 py-3 max-w-xs">
                          <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
                            {rec.note?.includes("unapproved location")
                              ? rec.note.split("Pending")[0].trim().replace(/^Checkin to /, "")
                              : "Map review required"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-sm">
                          <div className="line-clamp-2">{rec.note || "—"}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openLocationMap(rec)}
                              className="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 text-xs font-medium transition-colors flex items-center gap-1"
                            >
                              <MapPin className="h-3 w-3" />
                              Review Map
                            </button>
                            <button
                              onClick={() => approveRecord(rec.id)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 text-xs font-medium transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => rejectRecord(rec.id, "Unapproved location")}
                              className="px-3 py-1.5 rounded-lg bg-rose-100 text-rose-700 hover:bg-rose-200 text-xs font-medium transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

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
            </div>
          )}

          {isAllEmployees ? (
          <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-secondary/30 flex items-center justify-between">
              <div>
                <div className="font-display text-lg font-semibold">Attendance Register</div>
                <div className="text-xs text-muted-foreground">
                  Weekly calendar: {fmtDateDMY(registerData?.startDate)} – {fmtDateDMY(registerData?.endDate)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground mr-2">Week:</label>
                <select
                  value={registerStart || ""}
                  onChange={(e) => setRegisterStart(e.target.value || null)}
                  className="px-3 py-1 rounded-lg text-sm border border-border bg-background"
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
                  <tr className="bg-secondary/20 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="sticky left-0 z-20 bg-secondary/20 border-r border-border px-4 py-3">Employee</th>
                    {registerDates.map((date) => {
                      const dateKey = formatDateKey(date);
                      return (
                        <th key={dateKey} className="px-4 py-3 min-w-[10rem]">
                          <div className="font-medium text-sm text-slate-900">{weekdays[date.getUTCDay()]}</div>
                          <div className="text-[11px] text-muted-foreground">{String(date.getUTCDate()).padStart(2, "0")}/{String(date.getUTCMonth() + 1).padStart(2, "0")}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {registerEmployees.length > 0 ? (
                    registerEmployees.map((emp) => (
                      <tr key={emp.id} className="border-t border-border">
                        <td className="sticky left-0 z-10 bg-background border-r border-border px-4 py-3 font-medium text-slate-900">
                          <div>{emp.fullName}</div>
                          {emp.employeeCode || emp.email ? (
                            <div className="text-[11px] text-muted-foreground">{emp.employeeCode || emp.email}</div>
                          ) : null}
                        </td>
                        {registerDates.map((date) => {
                          const dateKey = formatDateKey(date);
                          let rec = attendanceByDateEmployee.get(`${dateKey}:${emp.id}`);
                          // Treat today's and future ABSENT as no record (user may still arrive)
                          if (rec && rec.status === "ABSENT" && dateKey >= todayKey) {
                            rec = null;
                          }
                          const meta = rec ? statusMeta[rec.status] : null;
                          return (
                            <td key={dateKey} className="px-4 py-3 align-top border-l border-border bg-background">
                              {rec ? (
                                <div className="space-y-1 rounded-2xl border border-border bg-slate-50/70 p-3">
                                  <div className="inline-flex items-center gap-2 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm">
                                    <span className={`w-2 h-2 rounded-full ${meta?.dot}`} />
                                    {meta?.label || rec.status}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground break-words">
                                    {rec.checkIn ? `In ${fmtTime(rec.checkIn)}` : ""}
                                    {rec.checkIn && rec.checkOut ? " · " : ""}
                                    {rec.checkOut ? `Out ${fmtTime(rec.checkOut)}` : ""}
                                  </div>
                                  {rec.note ? (
                                    <div className="text-[11px] text-slate-500 break-words">{rec.note}</div>
                                  ) : null}
                                  {rec.status === "PENDING_APPROVAL" ? (
                                    <div className="flex items-center gap-2 mt-2">
                                      <button onClick={() => approveRecord(rec.id)} className="px-2 py-1 text-xs rounded-md bg-emerald-100 text-emerald-700">Approve</button>
                                      <button onClick={() => openRejectModal(rec)} className="px-2 py-1 text-xs rounded-md bg-rose-100 text-rose-700">Reject</button>
                                    </div>
                                  ) : null}
                                </div>
                              ) : (
                                <div className="rounded-2xl border border-border bg-slate-50/70 p-3 text-[11px] text-muted-foreground">No record</div>
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
          <div className="rounded-2xl bg-background border border-border card-shadow p-6">
            <div className="grid grid-cols-7 gap-2 mb-2">
              {weekdays.map((w) => (
                <div key={w} className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground py-1">
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {cells.map((day, idx) => {
                if (day === null) return <div key={`blank-${idx}`} className="aspect-square" />;

                const cellDate = new Date(Date.UTC(year, month - 1, day));
                const dateKey = formatDateKey(cellDate);
                let rec = recordByDay[day];
                // Hide today's and future ABSENT as no record
                if (rec && rec.status === "ABSENT" && dateKey >= todayKey) rec = null;
                const holidayName = holidayByDay[day];
                const meta = rec ? statusMeta[rec.status] : holidayName ? statusMeta.HOLIDAY : null;
                const isToday = dateKey === todayKey;

                return (
                  <div
                    key={day}
                    className={`aspect-square rounded-lg border p-1.5 flex flex-col ${
                      meta ? meta.cell : "bg-background border-border"
                    } ${isToday ? "ring-2 ring-primary" : ""}`}
                    title={
                      rec
                        ? `${statusMeta[rec.status]?.label}${rec.checkIn ? ` · In ${fmtTime(rec.checkIn)}` : ""}${rec.checkOut ? ` · Out ${fmtTime(rec.checkOut)}` : ""}`
                        : holidayName || ""
                    }
                  >
                    <div className="text-xs font-semibold">{day}</div>
                    {rec ? (
                      <div className="mt-auto text-[10px] leading-tight">
                        {(fmtTime(rec.checkIn) || fmtTime(rec.checkOut)) && (
                          <div className="truncate">
                            {fmtTime(rec.checkIn) ? `In ${fmtTime(rec.checkIn)}` : ""}
                            {fmtTime(rec.checkIn) && fmtTime(rec.checkOut) ? " · " : ""}
                            {fmtTime(rec.checkOut) ? `Out ${fmtTime(rec.checkOut)}` : ""}
                          </div>
                        )}
                        {rec.workedHours != null && <div className="truncate opacity-75">{fmtWorkedHours(rec.workedHours)}</div>}
                      </div>
                    ) : holidayName ? (
                      <div className="mt-auto text-[10px] leading-tight truncate">{holidayName}</div>
                    ) : null}
                  </div>
                );
              })}
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
