import { useEffect, useState, useCallback } from "react";
import {
  Clock,
  Clock3,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  LogIn,
  LogOut,
  CheckCircle2,
  XCircle,
  CalendarDays,
  TrendingUp,
  MessageSquare,
  X,
  MapPin,
  ArrowLeft,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiGet } from "../../lib/api.js";

// ── helpers ───────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
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

// Regular working hours per day
const REGULAR_HOURS = 8;

const fmtTime = (v) =>
  v
    ? new Date(v).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : "—";

const fmtWorkedHours = (value) => {
  if (value == null) return "—";

  const hours = Number(value);
  if (Number.isNaN(hours)) return "—";

  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  return `${h}h ${m}m`;
};

const getRegularHours = (workedHours) => {
  if (workedHours == null) return 0;

  const hours = Number(workedHours);

  if (Number.isNaN(hours) || hours <= 0) return 0;

  // Maximum regular work = 1 hour
  return Math.min(hours, REGULAR_HOURS);
};

// Calculate overtime from worked hours with 15-minute interval rounding:
// 0-14 min -> 0 min, 15-29 min -> 15 min, 30-44 min -> 30 min, 45-59 min -> 45 min
const getOvertimeHours = (workedHours) => {
  if (workedHours == null) return 0;

  const hours = Number(workedHours);

  if (Number.isNaN(hours) || hours <= REGULAR_HOURS) {
    return 0;
  }

  const rawOvertimeHours = hours - REGULAR_HOURS;
  const rawOvertimeMinutes = Math.round(rawOvertimeHours * 60);
  const roundedOtMinutes = Math.floor(rawOvertimeMinutes / 15) * 15;

  if (roundedOtMinutes <= 0) {
    return 0;
  }

  return roundedOtMinutes / 60;
};


const isComplexNote = (note) => {
  if (!note) return false;
  const lower = note.toLowerCase();
  return (
    lower.includes("unassigned") ||
    lower.includes("outside") ||
    lower.includes("forgot punch") ||
    lower.includes("pending") ||
    lower.includes("reject") ||
    lower.includes("approve") ||
    lower.includes("reason")
  );
};

const parseNoteSegment = (segment, record) => {
  const text = segment.trim();
  const lower = text.toLowerCase();

  const isCheckIn = lower.includes("checkin") || lower.includes("check in");
  const isCheckOut = lower.includes("checkout") || lower.includes("check out");
  const isForgotPunch = lower.includes("forgot punch");

  let type = "Attendance Note";
  if (isForgotPunch) {
    type = "Forgot Punch";
  } else if (isCheckIn) {
    type = "Check In Request";
  } else if (isCheckOut) {
    type = "Check Out Request";
  }

  // Extract Reason using TrackRequests style regex matching
  let userReason = null;
  const reasonMatch = text.match(/Reason:\s*(.*?)(?=\s*(?:Pending admin approval|Admin approved|Admin rejected|Approved by admin|Rejected by admin|Approved|Rejected)\b|\s*\||\.|$)/i);
  if (reasonMatch && reasonMatch[1].trim()) {
    userReason = reasonMatch[1].trim();
  }

  // Extract distance if present
  const distMatch = text.match(/\(([0-9.]+(?:\s*(?:km|m))?)\s*(?:away)?\)/i);
  const distance = distMatch ? distMatch[1].trim() : null;

  let status = "INFO";
  let statusLabel = null;
  if (lower.includes("pending")) {
    status = "PENDING";
    statusLabel = "Pending Approval";
  } else if (lower.includes("approved")) {
    status = "APPROVED";
    statusLabel = "Approved";
  } else if (lower.includes("rejected")) {
    status = "REJECTED";
    statusLabel = "Rejected";
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

const getIndiaDayNumber = (val) => {
  if (!val) return null;
  const date = new Date(val);
  if (Number.isNaN(date.getTime())) return null;
  const dayStr = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
  }).format(date);
  return Number(dayStr);
};

const fmtDate = (v) => {
  if (!v) return "—";

  const date = new Date(v);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const STATUS_META = {
  PRESENT: {
    label: "Present",
    bg: "bg-emerald-500/15 dark:bg-emerald-500/25",
    text: "text-emerald-700 dark:text-emerald-400",
    cell: "bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300",
  },

  ABSENT: {
    label: "Absent",
    bg: "bg-rose-500/15 dark:bg-rose-500/25",
    text: "text-rose-700 dark:text-rose-400",
    cell: "bg-rose-500/10 dark:bg-rose-500/20 border-rose-200 dark:border-rose-800/40 text-rose-800 dark:text-rose-300",
  },

  ON_LEAVE: {
    label: "On Leave",
    bg: "bg-purple-500/15 dark:bg-purple-500/25",
    text: "text-purple-700 dark:text-purple-400",
    cell: "bg-purple-500/10 dark:bg-purple-500/20 border-purple-200 dark:border-purple-800/40 text-purple-800 dark:text-purple-300",
  },

  HOLIDAY: {
    label: "Holiday",
    bg: "bg-indigo-500/15 dark:bg-indigo-500/25",
    text: "text-indigo-700 dark:text-indigo-400",
    cell: "bg-indigo-500/10 dark:bg-indigo-500/20 border-indigo-200 dark:border-indigo-800/40 text-indigo-800 dark:text-indigo-300",
  },

  PENDING_APPROVAL: {
    label: "Awaiting Admin Approval",
    bg: "bg-amber-500/15 dark:bg-amber-500/25",
    text: "text-amber-700 dark:text-amber-400",
    cell: "bg-amber-500/10 dark:bg-amber-500/20 border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-300",
  },
};

const StatCard = ({ icon: Icon, label, value, bg, text }) => (
  <div className="rounded-2xl bg-background border border-border card-shadow p-5 flex items-center gap-4">
    <div
      className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${bg}`}
    >
      <Icon className={`h-5 w-5 ${text}`} />
    </div>

    <div>
      <div className="font-display text-2xl font-bold leading-none">
        {value}
      </div>

      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  </div>
);

// ── component ─────────────────────────────────────────────────────────────────

const Attendance = () => {
  const navigate = useNavigate();
  const today = new Date();

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const [records, setRecords] = useState([]); 
  const [selectedRecordForNote, setSelectedRecordForNote] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState("table");
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [showOvertime, setShowOvertime] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const data = await apiGet(`/attendance/me?year=${year}&month=${month}`);

      setRecords(data.records);
      setHolidays(data.holidays);
      setSummary(data.summary);
    } catch (err) {
      toast.error(err.message || "Failed to load attendance.");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    load();
  }, [load]);

  const prevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  // Build calendar grid
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

  const recordByDay = {};

  for (const r of records) {
    const d = getIndiaDayNumber(r.date);
    if (d) recordByDay[d] = r;
  }

  const holidayByDay = {};
  const holidayTypeByDay = {};

  for (const h of holidays) {
    const d = getIndiaDayNumber(h.date);
    if (d) {
      holidayByDay[d] = h.name;
      holidayTypeByDay[d] = h.holidayType || "FESTIVAL";
    }
  }

  // ── worked & overtime calculations ──

  const totalWorked = records.reduce(
    (acc, r) => acc + getRegularHours(r.workedHours),
    0,
  );

  const totalOvertime = records.reduce(
    (acc, r) => acc + getOvertimeHours(r.workedHours),
    0,
  );

  const totalOvertimeDays = records.filter(
    (r) => getOvertimeHours(r.workedHours) > 0,
  ).length;

  const filteredRecords = selectedStatus
    ? records.filter((r) => r.status === selectedStatus)
    : records;

  const handleStatusClick = (key) => {
    setSelectedStatus((prev) => (prev === key ? null : key));
  };

  // ── filtered status page ──

  if (selectedStatus) {
    return (
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedStatus(null)}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          <div className="text-right">
            <h1 className="font-display text-2xl font-bold">
              {STATUS_META[selectedStatus]?.label} Records
            </h1>

            <p className="text-sm text-muted-foreground">
              {MONTH_NAMES[month - 1]} {year}
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-secondary/30 flex items-center justify-between gap-3">
            <div>
              <div className="font-display text-base font-semibold">
                {STATUS_META[selectedStatus]?.label} Attendance
              </div>

              <div className="text-xs text-muted-foreground">
                {filteredRecords.length} record
                {filteredRecords.length === 1 ? "" : "s"} found
              </div>
            </div>

            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${STATUS_META[selectedStatus]?.bg} ${STATUS_META[selectedStatus]?.text}`}
            >
              <span
                className={`w-2 h-2 rounded-full ${STATUS_META[
                  selectedStatus
                ]?.bg.replace("100", "500")}`}
              />

              {STATUS_META[selectedStatus]?.label}
            </span>
          </div>

          <div className="overflow-x-auto">
            {filteredRecords.length === 0 ? (
              <div className="p-14 text-center">
                <p className="text-sm text-muted-foreground">
                  No {STATUS_META[selectedStatus].label.toLowerCase()} records
                  for {MONTH_NAMES[month - 1]} {year}.
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary/30 text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Check In</th>
                    <th className="px-5 py-3 font-medium">Check Out</th>
                    <th className="px-5 py-3 font-medium">Worked</th>
                    <th className="px-5 py-3 font-medium">Overtime</th>
                    <th className="px-5 py-3 font-medium min-w-[300px]">
                      Note
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRecords.map((r) => {
                    const meta = STATUS_META[r.status] ?? STATUS_META.PRESENT;

                    const overtime = getOvertimeHours(r.workedHours);

                    return (
                      <tr
                        key={r.id ?? `${r.date}-${r.status}-status`}
                        className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors"
                      >
                        <td className="px-5 py-3 font-medium whitespace-nowrap">
                          {fmtDate(r.date)}
                        </td>

                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${meta.bg} ${meta.text}`}
                          >
                            {r.status === "HOLIDAY" ? (r.note || meta.label) : meta.label}
                          </span>
                        </td>

                        <td className="px-5 py-3 whitespace-nowrap">
                          <span className="flex items-center gap-1.5">
                            <LogIn className="h-3.5 w-3.5 text-emerald-600" />
                            {fmtTime(r.checkIn)}
                          </span>
                        </td>

                        <td className="px-5 py-3 whitespace-nowrap">
                          <span className="flex items-center gap-1.5">
                            <LogOut className="h-3.5 w-3.5 text-rose-600" />
                            {fmtTime(r.checkOut)}
                          </span>
                        </td>

                        <td className="px-5 py-3 font-medium">
                          {fmtWorkedHours(getRegularHours(r.workedHours))}
                        </td>

                        <td className="px-5 py-3 font-medium text-orange-600">
                          {overtime > 0 ? fmtWorkedHours(overtime) : "—"}
                        </td>

                        <td className="px-5 py-3 min-w-[280px] max-w-[360px]">
                          {r.status === "ABSENT" ? (
                            <span className="text-sm font-medium text-rose-600 dark:text-rose-400">
                              Absent
                            </span>
                          ) : r.note ? (
                            isComplexNote(r.note) ? (
                              <button
                                type="button"
                                onClick={() => setSelectedRecordForNote(r)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                                View Reason
                              </button>
                            ) : (
                              <div className="space-y-1 text-sm font-medium text-foreground whitespace-nowrap">
                                {r.note.split("|").map((n, i) => (
                                  <div key={i}>
                                    {n.replace(/(Checkin:|Checkout:)/g, "").trim()}
                                  </div>
                                ))}
                              </div>
                            )
                          ) : (
                            <span className="text-base text-muted-foreground">�</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  }
  // ── overtime page ──
  if (showOvertime) {
    const overtimeRecords = records
      .map((r) => ({
        ...r,
        overtimeHours: getOvertimeHours(r.workedHours),
      }))
      .filter((r) => r.overtimeHours > 0);

    return (
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowOvertime(false)}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-secondary transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>

            <div>
              <h1 className="font-display text-2xl font-bold">Overtime</h1>

              <p className="text-sm text-muted-foreground">
                Your overtime records
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg border border-border hover:bg-secondary transition-colors text-muted-foreground disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Month */}
        <div className="flex items-center justify-between rounded-2xl bg-background border border-border card-shadow px-5 py-3">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="text-center">
            <div className="font-display text-lg font-bold">
              {MONTH_NAMES[month - 1]} {year}
            </div>

            <div className="text-xs text-muted-foreground">
              Overtime summary
            </div>
          </div>

          <button
            onClick={nextMonth}
            disabled={
              year === today.getFullYear() && month === today.getMonth() + 1
            }
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* OT Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            icon={Clock3}
            label="Total Overtime"
            value={fmtWorkedHours(totalOvertime)}
            bg="bg-orange-100"
            text="text-orange-700"
          />

          <StatCard
            icon={CalendarDays}
            label="OT Days"
            value={overtimeRecords.length}
            bg="bg-blue-100"
            text="text-blue-700"
          />

          <StatCard
            icon={TrendingUp}
            label="Regular Hours"
            value={`${REGULAR_HOURS} hrs/day`}
            bg="bg-emerald-100"
            text="text-emerald-700"
          />
        </div>

        {/* OT Records */}
        <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="font-display text-base font-semibold">
              Overtime Records
            </h2>

            <p className="text-xs text-muted-foreground mt-1">
              Hours worked beyond {REGULAR_HOURS} hours are counted as overtime.
            </p>
          </div>

          {overtimeRecords.length === 0 ? (
            <div className="p-14 text-center">
              <Clock3 className="h-12 w-12 text-orange-200 mx-auto mb-3" />

              <p className="text-sm font-medium">No overtime records</p>

              <p className="text-xs text-muted-foreground mt-1">
                No overtime was recorded for this month.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary/30 text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                    <th className="px-5 py-3 font-medium">Date</th>

                    <th className="px-5 py-3 font-medium">Check In</th>

                    <th className="px-5 py-3 font-medium">Check Out</th>

                    <th className="px-5 py-3 font-medium">Worked</th>

                    <th className="px-5 py-3 font-medium">Overtime</th>
                  </tr>
                </thead>

                <tbody>
                  {overtimeRecords.map((r) => (
                    <tr
                      key={r.id ?? `${r.date}-${r.status}-overtime`}
                      className="border-b border-border last:border-0 hover:bg-orange-50/50 transition-colors"
                    >
                      <td className="px-5 py-4 font-medium whitespace-nowrap">
                        {fmtDate(r.date)}
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          <LogIn className="h-3.5 w-3.5 text-emerald-600" />
                          {fmtTime(r.checkIn)}
                        </span>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          <LogOut className="h-3.5 w-3.5 text-rose-600" />
                          {fmtTime(r.checkOut)}
                        </span>
                      </td>

                      <td className="px-5 py-4 font-medium">
                        {fmtWorkedHours(getRegularHours(r.workedHours))}
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 text-orange-700 px-3 py-1.5 text-sm font-semibold">
                          <Clock3 className="h-4 w-4" />

                          {fmtWorkedHours(r.overtimeHours)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── main page ──

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}

      <div className="flex items-center justify-between gap-4 flex-wrap">
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
              Your monthly attendance history.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {["table", "calendar"].map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors capitalize ${
                  view === v
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg border border-border hover:bg-secondary transition-colors text-muted-foreground disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Attendance policy */}

      {/* Month navigator */}

      <div className="flex items-center justify-between rounded-2xl bg-background border border-border card-shadow px-5 py-3">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="text-center">
          <div className="font-display text-lg font-bold">
            {MONTH_NAMES[month - 1]} {year}
          </div>

          <div className="text-xs text-muted-foreground">
            {records.length} record
            {records.length !== 1 ? "s" : ""} this month
          </div>
        </div>

        <button
          onClick={nextMonth}
          disabled={
            year === today.getFullYear() && month === today.getMonth() + 1
          }
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Summary stat cards */}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          {
            key: "PRESENT",
            label: "Present",
            Icon: CheckCircle2,
            bg: "bg-emerald-100",
            text: "text-emerald-700",
          },

          {
            key: "ABSENT",
            label: "Absent",
            Icon: XCircle,
            bg: "bg-rose-100",
            text: "text-rose-700",
          },

          {
            key: "ON_LEAVE",
            label: "On Leave",
            Icon: CalendarDays,
            bg: "bg-purple-100",
            text: "text-purple-700",
          },

          {
            key: "HOLIDAY",
            label: "Holiday",
            Icon: CalendarDays,
            bg: "bg-indigo-100",
            text: "text-indigo-700",
          },
        ].map(({ key, label, Icon, bg, text }) => {
          const isActive = selectedStatus === key;

          return (
            <button
              key={key}
              type="button"
              onClick={() => handleStatusClick(key)}
              className={`w-full text-left rounded-2xl border transition-colors ${
                isActive
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-background card-shadow hover:bg-secondary/40"
              }`}
            >
              <StatCard
                icon={Icon}
                label={label}
                value={summary[key] ?? 0}
                bg={bg}
                text={text}
              />
            </button>
          );
        })}

        {/* Overtime Card */}
        <button
          type="button"
          onClick={() => setShowOvertime(true)}
          className="w-full text-left rounded-2xl bg-background border border-border card-shadow p-5 flex items-center gap-4 hover:bg-orange-50 hover:border-orange-300 transition-all cursor-pointer"
        >
          <div className="w-11 h-11 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
            <Clock3 className="h-5 w-5 text-orange-700" />
          </div>

          <div>
            <div className="font-display text-2xl font-bold leading-none">
              {totalOvertimeDays}
            </div>

            <div className="text-xs text-muted-foreground mt-1">
              Overtime Days
            </div>
          </div>
        </button>
      </div>

      {/* Worked hours card */}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-2xl bg-background border border-border card-shadow px-5 py-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>

          <div>
            <div className="font-display text-xl font-bold">
              {totalWorked.toFixed(1)} hrs
            </div>

            <div className="text-xs text-muted-foreground">
              Total worked hours this month
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-background border border-border card-shadow px-5 py-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
            <Clock3 className="h-5 w-5 text-orange-700" />
          </div>

          <div>
            <div className="font-display text-xl font-bold">
              {fmtWorkedHours(totalOvertime)}
            </div>

            <div className="text-xs text-muted-foreground">
              Total overtime this month
            </div>
          </div>
        </div>
      </div>

      {/* Loading state */}

      {loading ? (
        <div className="rounded-2xl bg-background border border-border p-16 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : view === "calendar" ? (
        /* Redesigned calendar view */
        <div className="space-y-4">
          {/* Calendar toolbar */}
          <div className="rounded-2xl bg-background border border-border card-shadow p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  <h2 className="font-display text-base font-semibold">
                    Attendance Calendar
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Daily attendance, working hours and overtime at a glance.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="h-9 w-9 rounded-lg border border-border bg-background flex items-center justify-center hover:bg-secondary transition-colors"
                  title="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <div className="min-w-[150px] rounded-lg border border-border bg-secondary/20 px-4 py-2 text-center">
                  <div className="text-sm font-semibold">
                    {MONTH_NAMES[month - 1]} {year}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={nextMonth}
                  disabled={
                    year === today.getFullYear() &&
                    month === today.getMonth() + 1
                  }
                  className="h-9 w-9 rounded-lg border border-border bg-background flex items-center justify-center hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Legend */}
            <div className="mt-4 pt-3 border-t border-border flex flex-wrap items-center gap-2">
              {Object.entries(STATUS_META).map(([key, m]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleStatusClick(key)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all ${
                    selectedStatus === key
                      ? `${m.bg} ${m.text} ring-2 ring-offset-1 ring-primary/30`
                      : `${m.bg} ${m.text} hover:opacity-80`
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${m.bg.replace(
                      "100",
                      "500",
                    )}`}
                  />
                  {m.label}
                </button>
              ))}

              <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 text-orange-700 px-2.5 py-1 text-[11px] font-semibold">
                <Clock3 className="h-3 w-3" />
                Overtime
              </span>
            </div>
          </div>

          {/* Calendar */}
          <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-[700px]">
                {/* Weekdays */}
            <div className="grid grid-cols-7 border-b border-border bg-secondary/30">
              {[
                ["Sun", "Sunday"],
                ["Mon", "Monday"],
                ["Tue", "Tuesday"],
                ["Wed", "Wednesday"],
                ["Thu", "Thursday"],
                ["Fri", "Friday"],
                ["Sat", "Saturday"],
              ].map(([shortDay, fullDay]) => (
                <div
                  key={shortDay}
                  className="px-2 py-3 text-center border-r last:border-r-0 border-border/70"
                >
                  <span className="hidden sm:inline text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {fullDay}
                  </span>
                  <span className="sm:hidden text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {shortDay}
                  </span>
                </div>
              ))}
            </div>

            {/* Days */}
            <div className="grid grid-cols-7">
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="min-h-[128px] border-r border-b border-border/50 bg-secondary/10"
                />
              ))}

              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(
                (day) => {
                  const r = recordByDay[day];
                  const hol = holidayByDay[day];
                  const dayOfWeek = new Date(year, month - 1, day).getDay();
                  const isSunday = dayOfWeek === 0;

                  const isToday =
                    year === today.getFullYear() &&
                    month === today.getMonth() + 1 &&
                    day === today.getDate();

                  const meta = r
                    ? STATUS_META[r.status] ?? STATUS_META.PRESENT
                    : hol || isSunday
                      ? STATUS_META.HOLIDAY
                      : null;

                  const overtime = r
                    ? getOvertimeHours(r.workedHours)
                    : 0;

                  const isHolidayCell = !r || r.status === "HOLIDAY";

                  return (
                    <div
                      key={day}
                      className={`min-h-[128px] border-r border-b border-border/50 p-2.5 transition-all ${
                        isToday
                          ? "bg-primary/[0.04] ring-2 ring-inset ring-primary/60"
                          : "hover:bg-secondary/20"
                      }`}
                    >
                      {/* Date */}
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full text-xs font-bold ${
                            isToday
                              ? "bg-primary text-primary-foreground"
                              : "text-foreground"
                          }`}
                        >
                          {day}
                        </span>

                        {isToday && (
                          <span className="text-[9px] font-bold uppercase tracking-wide text-primary">
                            Today
                          </span>
                        )}
                      </div>

                      {meta ? (
                        <div className="mt-2 space-y-2">
                          {/* Status */}
                          <div
                            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 ${meta.cell}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${meta.bg.replace(
                                "100",
                                "500",
                              )}`}
                            />
                            <span className="text-[10px] font-bold truncate">
                              {(r?.status === "HOLIDAY" || isHolidayCell) ? (hol || r?.note || "Holiday") : meta.label}
                            </span>
                          </div>

                          {r && !isHolidayCell && r.status !== "ON_LEAVE" && (
                            <>
                              {/* In / Out */}
                              <div className="grid grid-cols-2 gap-1.5">
                                <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-2 py-1.5">
                                  <div className="flex items-center gap-1 text-[9px] font-semibold text-emerald-700">
                                    <LogIn className="h-3 w-3" />
                                    IN
                                  </div>
                                  <div className="text-[10px] font-bold text-emerald-900 mt-0.5 truncate">
                                    {fmtTime(r.checkIn)}
                                  </div>
                                </div>

                                <div className="rounded-lg bg-rose-50 border border-rose-100 px-2 py-1.5">
                                  <div className="flex items-center gap-1 text-[9px] font-semibold text-rose-700">
                                    <LogOut className="h-3 w-3" />
                                    OUT
                                  </div>
                                  <div className="text-[10px] font-bold text-rose-900 mt-0.5 truncate">
                                    {fmtTime(r.checkOut)}
                                  </div>
                                </div>
                              </div>

                              {/* Hours */}
                              <div className="flex items-center justify-between gap-2 rounded-lg bg-secondary/50 px-2 py-1.5">
                                <div>
                                  <div className="text-[8px] uppercase tracking-wide text-muted-foreground">
                                    Worked
                                  </div>
                                  <div className="text-[10px] font-bold">
                                    {fmtWorkedHours(
                                      getRegularHours(r.workedHours),
                                    )}
                                  </div>
                                </div>

                                {overtime > 0 && (
                                  <div className="text-right">
                                    <div className="text-[8px] uppercase tracking-wide text-orange-600">
                                      OT
                                    </div>
                                    <div className="text-[10px] font-bold text-orange-700">
                                      {fmtWorkedHours(overtime)}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </>
                          )}

                          {r && r.status === "ON_LEAVE" && (
                            <div
                              className="rounded-lg bg-purple-50 border border-purple-100 px-2 py-1.5 text-[10px] font-semibold text-purple-700 truncate"
                              title={r?.note || "On Leave"}
                            >
                              {r?.note || "Approved Leave"}
                            </div>
                          )}

                          {isHolidayCell && (
                            <div
                              className={`rounded-lg border px-2 py-1.5 text-[10px] font-semibold truncate ${
                                holidayTypeByDay[day] === "FESTIVAL" || (hol && !hol.includes("Sunday") && !hol.includes("Weekly"))
                                  ? "bg-purple-50 dark:bg-purple-950/30 border-purple-200 text-purple-700 dark:text-purple-300"
                                  : holidayTypeByDay[day] === "NATIONAL"
                                  ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 text-emerald-700 dark:text-emerald-300"
                                  : "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-100 text-indigo-700 dark:text-indigo-300"
                              }`}
                              title={hol || r?.note || (isSunday ? "Weekly Off (Sunday)" : "Holiday")}
                            >
                              {hol || r?.note || (isSunday ? "Weekly Off (Sunday)" : "Holiday")}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="mt-7 text-center">
                          <span className="text-[10px] text-muted-foreground/60">
                            No record
                          </span>
                        </div>
                      )}
                    </div>
                  );
                },
              )}
            </div>
          </div>
        </div>

            {/* Calendar footer */}
            <div className="px-4 py-3 bg-secondary/20 border-t border-border">
              <div className="flex items-center justify-between gap-3 flex-wrap text-xs text-muted-foreground">
                <span>
                  {records.length} record{records.length !== 1 ? "s" : ""} in{" "}
                  {MONTH_NAMES[month - 1]}
                </span>
                <span>
                  {totalWorked.toFixed(1)} hrs worked
                  {totalOvertime > 0
                    ? ` • ${fmtWorkedHours(totalOvertime)} overtime`
                    : ""}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Table view */

        <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="font-display text-base font-semibold">
              Daily Records
            </h2>
          </div>

          {records.length === 0 ? (
            <div className="p-14 text-center">
              <CalendarDays className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />

              <p className="text-sm text-muted-foreground">
                No attendance records for this month.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary/30 text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                    <th className="px-5 py-3 font-medium">Date</th>

                    <th className="px-5 py-3 font-medium">Status</th>

                    <th className="px-5 py-3 font-medium">Check In</th>

                    <th className="px-5 py-3 font-medium">Check Out</th>

                    <th className="px-5 py-3 font-medium">Worked</th>

                    <th className="px-5 py-3 font-medium">Overtime</th>

                    <th className="px-5 py-3 font-medium">Note</th>
                  </tr>
                </thead>

                <tbody>
                  {records.map((r) => {
                    const meta = STATUS_META[r.status] ?? STATUS_META.PRESENT;

                    const overtime = getOvertimeHours(r.workedHours);

                    const isToday =
                      year === today.getFullYear() &&
                      month === today.getMonth() + 1 &&
                      getIndiaDayNumber(r.date) === today.getDate();

                    return (
                      <tr
                        key={r.id ?? `${r.date}-${r.status}-calendar`}
                        className={`border-b border-border last:border-0 transition-colors hover:bg-secondary/20 ${
                          isToday ? "bg-primary/5" : ""
                        }`}
                      >
                        <td className="px-5 py-3 font-medium whitespace-nowrap">
                          {fmtDate(r.date)}

                          {isToday && (
                            <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold">
                              Today
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${meta.bg} ${meta.text}`}
                          >
                            {r.status === "HOLIDAY" ? (r.note || meta.label) : meta.label}
                          </span>
                        </td>

                        {r.status === "ON_LEAVE" ? (
                          <td colSpan={5} className="px-5 py-3">
                            <div className="w-full rounded-xl bg-purple-500/15 dark:bg-purple-500/25 border border-purple-200 dark:border-purple-800/40 px-4 py-2.5 text-xs font-semibold text-purple-700 dark:text-purple-300 flex items-center justify-between">
                              <span className="flex items-center gap-2 font-bold text-sm">
                                <CalendarDays className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                On Leave
                              </span>
                              <span className="text-purple-700 dark:text-purple-300 font-medium">
                                {r.note || "Approved Leave"}
                              </span>
                            </div>
                          </td>
                        ) : (
                          <>
                            <td className="px-5 py-3 whitespace-nowrap">
                              <span className="flex items-center gap-1.5">
                                <LogIn className="h-3.5 w-3.5 text-emerald-600" />

                                {fmtTime(r.checkIn)}
                              </span>
                            </td>

                            <td className="px-5 py-3 whitespace-nowrap">
                              <span className="flex items-center gap-1.5">
                                <LogOut className="h-3.5 w-3.5 text-rose-600" />

                                {fmtTime(r.checkOut)}
                              </span>
                            </td>

                            <td className="px-5 py-3 font-medium">
                              {fmtWorkedHours(getRegularHours(r.workedHours))}
                            </td>

                            <td className="px-5 py-3">
                              {overtime > 0 ? (
                                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold bg-orange-100 text-orange-700">
                                  <Clock3 className="h-3.5 w-3.5" />
                                  {fmtWorkedHours(overtime)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>

                            <td className="px-5 py-3 min-w-[300px] max-w-[400px]">
                              {r.status === "ABSENT" ? (
                                <span className="text-sm font-medium text-rose-600 dark:text-rose-400">
                                  Absent
                                </span>
                              ) : r.note ? (
                                isComplexNote(r.note) ? (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedRecordForNote(r)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
                                  >
                                    <MessageSquare className="h-3.5 w-3.5" />
                                    View Reason
                                  </button>
                                ) : (
                                  <div className="space-y-1 text-sm font-medium text-foreground whitespace-nowrap">
                                    {r.note.split("|").map((n, i) => (
                                      <div key={i}>
                                        {n.replace(/(Checkin:|Checkout:)/g, "").trim()}
                                      </div>
                                    ))}
                                  </div>
                                )
                              ) : (
                                <span className="text-base text-muted-foreground">—</span>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {/* Note Details Modal */}
      {selectedRecordForNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl card-shadow">
            <button
              onClick={() => setSelectedRecordForNote(null)}
              className="absolute right-4 top-4 rounded-lg p-1.5 hover:bg-secondary transition-colors text-muted-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold">Attendance Request Details</h3>
                <p className="text-xs text-muted-foreground">
                  {fmtDate(selectedRecordForNote.date)}
                </p>
              </div>
            </div>

            <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
              {selectedRecordForNote.note?.split("|").map((segment, idx) => {
                const parsed = parseNoteSegment(segment, selectedRecordForNote);

                return (
                  <div
                    key={idx}
                    className="rounded-xl border border-border bg-secondary/20 p-4 space-y-3"
                  >
                    {/* Header Row: Type & Status */}
                    <div className="flex items-center justify-between gap-2 flex-wrap pb-2.5 border-b border-border/60">
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
                          {selectedRecordForNote.createdAt
                            ? `${fmtDate(selectedRecordForNote.createdAt)} ${fmtTime(selectedRecordForNote.createdAt)}`
                            : parsed.timeStr
                            ? `${fmtDate(selectedRecordForNote.date)} ${parsed.timeStr}`
                            : `${fmtDate(selectedRecordForNote.date)} —`}
                        </div>
                      </div>

                      {/* Request Approved / Reviewed Time */}
                      <div className="rounded-lg bg-background p-2.5 border border-border/50">
                        <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                          {parsed.status === "APPROVED"
                            ? "Approved Time"
                            : parsed.status === "REJECTED"
                            ? "Rejected Time"
                            : "Approved / Status Date"}
                        </div>
                        <div className="font-bold text-foreground mt-0.5">
                          {parsed.status === "APPROVED" || parsed.status === "REJECTED"
                            ? selectedRecordForNote.updatedAt
                              ? `${fmtDate(selectedRecordForNote.updatedAt)} ${fmtTime(selectedRecordForNote.updatedAt)}`
                              : "—"
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

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setSelectedRecordForNote(null)}
                className="rounded-lg bg-primary text-primary-foreground px-5 py-2 text-xs font-bold hover:opacity-90 transition-opacity"
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

