
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
} from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "../../lib/api.js";

// ── helpers ───────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
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

// Calculate overtime from worked hours.
// Anything above 8 hours is overtime.
const getOvertimeHours = (workedHours) => {
  if (workedHours == null) return 0;

  const hours = Number(workedHours);

  if (Number.isNaN(hours) || hours <= REGULAR_HOURS) {
    return 0;
  }

  return hours - REGULAR_HOURS;
};



const fmtDate = (v) => {
  if (!v) return "—";

  const date = new Date(v);

  if (Number.isNaN(date.getTime())) return "—";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
};

const STATUS_META = {
  PRESENT: {
    label: "Present",
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    cell: "bg-emerald-100 border-emerald-300 text-emerald-800",
  },

  ABSENT: {
    label: "Absent",
    bg: "bg-rose-100",
    text: "text-rose-700",
    cell: "bg-rose-100 border-rose-300 text-rose-800",
  },

  ON_LEAVE: {
    label: "On Leave",
    bg: "bg-purple-100",
    text: "text-purple-700",
    cell: "bg-purple-100 border-purple-300 text-purple-800",
  },

  HOLIDAY: {
    label: "Holiday",
    bg: "bg-indigo-100",
    text: "text-indigo-700",
    cell: "bg-indigo-100 border-indigo-300 text-indigo-800",
  },

  PENDING_APPROVAL: {
    label: "Awaiting Admin Approval",
    bg: "bg-amber-100",
    text: "text-amber-700",
    cell: "bg-amber-100 border-amber-300 text-amber-800",
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

      <div className="text-xs text-muted-foreground mt-1">
        {label}
      </div>
    </div>
  </div>
);

// ── component ─────────────────────────────────────────────────────────────────

const Attendance = () => {
  const today = new Date();

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const [records, setRecords] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState("table");
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [showOvertime, setShowOvertime] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const data = await apiGet(
        `/attendance/me?year=${year}&month=${month}`
      );

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
    const d = new Date(r.date).getUTCDate();
    recordByDay[d] = r;
  }

  const holidayByDay = {};

  for (const h of holidays) {
    const d = new Date(h.date).getUTCDate();
    holidayByDay[d] = h.name;
  }

  // ── worked & overtime calculations ──

 const totalWorked = records.reduce(
  (acc, r) => acc + getRegularHours(r.workedHours),
  0
);

 const totalOvertime = records.reduce(
  (acc, r) => acc + getOvertimeHours(r.workedHours),
  0
);

const totalOvertimeDays = records.filter(
  (r) => getOvertimeHours(r.workedHours) > 0
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
                  No{" "}
                  {STATUS_META[selectedStatus].label.toLowerCase()} records
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
                    const meta =
                      STATUS_META[r.status] ?? STATUS_META.PRESENT;

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
                            {meta.label}
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
                          {overtime > 0
                            ? fmtWorkedHours(overtime)
                            : "—"}
                        </td>

                        <td className="px-5 py-3 min-w-[280px] max-w-[360px]">
  {r.note ? (
    <div className="space-y-1">
      {r.note.split("|").map((note, index) => (
        <div
          key={index}
          className="text-base font-medium text-slate-700 whitespace-normal break-words"
        >
          {note.trim()}
        </div>
      ))}
    </div>
  ) : (
    <span className="text-base text-muted-foreground">
      —
    </span>
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
            <h1 className="font-display text-2xl font-bold">
              Overtime
            </h1>

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
          <RefreshCw
            className={`h-4 w-4 ${
              loading ? "animate-spin" : ""
            }`}
          />
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
            year === today.getFullYear() &&
            month === today.getMonth() + 1
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

            <p className="text-sm font-medium">
              No overtime records
            </p>

            <p className="text-xs text-muted-foreground mt-1">
              No overtime was recorded for this month.
            </p>
          </div>

        ) : (

          <div className="overflow-x-auto">

            <table className="w-full text-sm">

              <thead>
                <tr className="bg-secondary/30 text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">

                  <th className="px-5 py-3 font-medium">
                    Date
                  </th>

                  <th className="px-5 py-3 font-medium">
                    Check In
                  </th>

                  <th className="px-5 py-3 font-medium">
                    Check Out
                  </th>

                  <th className="px-5 py-3 font-medium">
                    Worked
                  </th>

                  <th className="px-5 py-3 font-medium">
                    Overtime
                  </th>

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

          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Clock className="h-6 w-6 text-primary" />
          </div>

          <div>
            <h1 className="font-display text-2xl font-bold">
              Attendance
            </h1>

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
            <RefreshCw
              className={`h-4 w-4 ${
                loading ? "animate-spin" : ""
              }`}
            />
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
            year === today.getFullYear() &&
            month === today.getMonth() + 1
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

        /* Calendar view */

        <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">

          <div className="grid grid-cols-7 border-b border-border">

            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
              (d) => (
                <div
                  key={d}
                  className="py-2 text-center text-xs font-semibold text-muted-foreground bg-secondary/30"
                >
                  {d}
                </div>
              )
            )}

          </div>

          <div className="grid grid-cols-7">

            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div
                key={`e${i}`}
                className="h-16 border-r border-b border-border/40 bg-secondary/10"
              />
            ))}

            {Array.from(
              { length: daysInMonth },
              (_, i) => i + 1
            ).map((day) => {

              const r = recordByDay[day];
              const hol = holidayByDay[day];

              const isToday =
                year === today.getFullYear() &&
                month === today.getMonth() + 1 &&
                day === today.getDate();

              const meta = r
                ? STATUS_META[r.status]
                : hol
                ? STATUS_META.HOLIDAY
                : null;

              const overtime = r
                ? getOvertimeHours(r.workedHours)
                : 0;

              return (
                <div
                  key={day}
                  className={`h-16 border-r border-b border-border/40 p-1.5 flex flex-col relative transition-colors
                    ${
                      meta
                        ? `${meta.cell} border`
                        : "hover:bg-secondary/20"
                    }
                    ${
                      isToday
                        ? "ring-2 ring-inset ring-primary"
                        : ""
                    }`}
                >

                  <span
                    className={`text-xs font-bold leading-none ${
                      isToday ? "text-primary" : ""
                    }`}
                  >
                    {day}
                  </span>

                  {meta && (
                    <span className="text-xs font-medium mt-auto leading-none">
                      {meta.label}
                    </span>
                  )}

                  {overtime > 0 && (
                    <span className="text-[10px] font-semibold text-orange-700 mt-1">
                      OT: {fmtWorkedHours(overtime)}
                    </span>
                  )}

                  {hol && !r && (
                    <span
                      className="text-xs text-indigo-600 truncate leading-none"
                      title={hol}
                    >
                      {hol}
                    </span>
                  )}

                </div>
              );
            })}

          </div>

          {/* Legend */}

          <div className="p-4 border-t border-border flex flex-wrap gap-3">

            {Object.entries(STATUS_META).map(([key, m]) => (
              <span
                key={key}
                className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${m.bg} ${m.text}`}
              >
                {m.label}
              </span>
            ))}

            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-orange-100 text-orange-700">
              Overtime
            </span>

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

                    <th className="px-5 py-3 font-medium">
                      Date
                    </th>

                    <th className="px-5 py-3 font-medium">
                      Status
                    </th>

                    <th className="px-5 py-3 font-medium">
                      Check In
                    </th>

                    <th className="px-5 py-3 font-medium">
                      Check Out
                    </th>

                    <th className="px-5 py-3 font-medium">
                      Worked
                    </th>

                    <th className="px-5 py-3 font-medium">
                      Overtime
                    </th>

                    <th className="px-5 py-3 font-medium">
                      Note
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {records.map((r) => {

                    const meta =
                      STATUS_META[r.status] ??
                      STATUS_META.PRESENT;

                    const overtime =
                      getOvertimeHours(r.workedHours);

                    const isToday =
                      year === today.getFullYear() &&
                      month === today.getMonth() + 1 &&
                      new Date(r.date).getUTCDate() ===
                        today.getDate();

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
                            {meta.label}
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

                        <td className="px-5 py-3">

                          {overtime > 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold bg-orange-100 text-orange-700">
                              <Clock3 className="h-3.5 w-3.5" />
                              {fmtWorkedHours(overtime)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              —
                            </span>
                          )}

                        </td>

                       <td className="px-5 py-3 min-w-[300px] max-w-[400px]">
  {r.note ? (
    <div className="space-y-1">
      {r.note.split("|").map((note, index) => (
        <div
          key={index}
          className="text-base font-medium text-slate-700 whitespace-nowrap"
        >
          {note.trim()}
        </div>
      ))}
    </div>
  ) : (
    <span className="text-base text-muted-foreground">
      —
    </span>
  )}
</td>

                      </tr>
                    );
                  })}

                </tbody>

              </table>

            </div>

          )}

        </div>

      )}

    </div>
  );
};

export default Attendance;

