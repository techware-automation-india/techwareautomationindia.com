import { useEffect, useState } from "react";
import { Clock, Loader2, ChevronLeft, ChevronRight, Users, X, MapPin } from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "../../lib/api.js";

// Visual styling per attendance status.
const statusMeta = {
  PRESENT: { label: "Present", dot: "bg-emerald-500", cell: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  ABSENT: { label: "Absent", dot: "bg-rose-500", cell: "bg-rose-50 border-rose-200 text-rose-700" },
  LATE: { label: "Late", dot: "bg-amber-500", cell: "bg-amber-50 border-amber-200 text-amber-700" },
  HALF_DAY: { label: "Half Day", dot: "bg-orange-500", cell: "bg-orange-50 border-orange-200 text-orange-700" },
  ON_LEAVE: { label: "On Leave", dot: "bg-violet-500", cell: "bg-violet-50 border-violet-200 text-violet-700" },
  HOLIDAY: { label: "Holiday", dot: "bg-blue-500", cell: "bg-blue-50 border-blue-200 text-blue-700" },
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

const Attendance = () => {
  const today = new Date();
  const [employees, setEmployees] = useState([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-12
  const [data, setData] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [showDetailedRecords, setShowDetailedRecords] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [mapModalRecord, setMapModalRecord] = useState(null);

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

  useEffect(() => {
    (async () => {
      await loadEmployees();
    })();
  }, []);

  // Fetch attendance whenever the selected employee or month changes.
  useEffect(() => {
    let active = true;
    (async () => {
      if (!selectedId) {
        setData(null);
        setShowDetailedRecords(false);
        return;
      }

      setLoadingData(true);
      try {
        const res = await apiGet(`/attendance/${selectedId}?year=${year}&month=${month}`);
        if (active) {
          setData(res);
          setShowDetailedRecords(false);
        }
      } catch (err) {
        if (active) {
          toast.error(err.message || "Failed to load attendance.");
          setData(null);
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

  const summary = data?.summary || {};
  const filteredRecords = selectedStatus
    ? (data?.records || []).filter((rec) => rec.status === selectedStatus)
    : data?.records || [];

  const handleStatusClick = (key) => {
    setSelectedStatus((prev) => (prev === key ? null : key));
    setShowDetailedRecords(false);
  };

  const parseCoordinatesFromNote = (note) => {
    const match = (note || "").match(/\b(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
    return match ? { latitude: match[1], longitude: match[2] } : null;
  };

  const hasMapCoordinates = (note) => Boolean(parseCoordinatesFromNote(note));

  const showMapForRecord = (record) => {
    const coords = parseCoordinatesFromNote(record.note);
    if (!coords) {
      toast.error("No valid GPS coordinates found in the attendance note.");
      return;
    }

    setMapModalRecord({
      ...record,
      ...coords,
    });
  };

  const mapModal = mapModalRecord ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 px-4 py-6 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950 shadow-[0_35px_80px_-30px_rgba(15,23,42,0.8)]">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-cyan-500/20 to-transparent" />
        <div className="relative px-6 py-5 flex items-center justify-between border-b border-slate-800 bg-slate-950/95">
          <div>
            <div className="text-lg font-semibold text-white">Attendance Location</div>
            <div className="text-xs text-slate-400">{new Date(mapModalRecord.date).toLocaleDateString()}</div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${mapModalRecord.latitude},${mapModalRecord.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition-colors hover:bg-cyan-400"
            >
              <MapPin className="h-4 w-4" /> Open in Google Maps
            </a>
            <button
              type="button"
              onClick={() => setMapModalRecord(null)}
              className="rounded-full border border-slate-700 bg-slate-900/90 p-2 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr] px-6 py-5 bg-slate-950/95">
          <div className="rounded-[1.5rem] overflow-hidden border border-slate-800 shadow-[0_20px_50px_-20px_rgba(15,23,42,0.7)]">
            <iframe
              title="Attendance location map"
              src={`https://www.google.com/maps?q=${mapModalRecord.latitude},${mapModalRecord.longitude}&z=17&output=embed`}
              className="h-96 w-full min-h-[22rem]"
              loading="lazy"
              allowFullScreen
            />
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/95 p-5 shadow-[0_15px_35px_-20px_rgba(15,23,42,0.7)]">
              <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">Coordinates</div>
              <div className="grid gap-3">
                <div className="rounded-2xl bg-slate-950/90 border border-slate-800 p-4">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Latitude</div>
                  <div className="mt-1 text-sm font-medium text-white">{mapModalRecord.latitude}</div>
                </div>
                <div className="rounded-2xl bg-slate-950/90 border border-slate-800 p-4">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Longitude</div>
                  <div className="mt-1 text-sm font-medium text-white">{mapModalRecord.longitude}</div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/95 p-5 text-sm text-slate-300 shadow-[0_15px_35px_-20px_rgba(15,23,42,0.7)]">
              <div className="mb-3 text-xs uppercase tracking-wide text-slate-400">Location note</div>
              <div className="whitespace-pre-line text-sm leading-6">{mapModalRecord.note || "No note available."}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : null;

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
              <table className="min-w-full text-sm divide-y divide-border">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Check In</th>
                    <th className="py-2 pr-4">Check Out</th>
                    <th className="py-2 pr-4">Worked Hours</th>
                    <th className="py-2 pr-4">Location / Notes</th>
                    <th className="py-2 pr-4 text-right">Map</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-secondary/50 transition-colors">
                      <td className="py-3 pr-4">{new Date(rec.date).toLocaleDateString()}</td>
                      <td className="py-3 pr-4">{statusMeta[rec.status]?.label || rec.status}</td>
                      <td className="py-3 pr-4">{fmtTime(rec.checkIn) ?? "—"}</td>
                      <td className="py-3 pr-4">{fmtTime(rec.checkOut) ?? "—"}</td>
                      <td className="py-3 pr-4">{fmtWorkedHours(rec.workedHours)}</td>
                      <td className="py-3 pr-4 max-w-xl truncate">{rec.note || "—"}</td>
                      <td className="py-3 pr-4 text-right">
                        {hasMapCoordinates(rec.note) ? (
                          <button
                            type="button"
                            onClick={() => showMapForRecord(rec)}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/95 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-slate-950/20 transition-transform duration-200 hover:-translate-y-0.5 hover:bg-slate-800"
                          >
                            <MapPin className="h-4 w-4 text-cyan-300" /> View Map
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">No coords</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
        {mapModal}
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
          {/* Summary */}
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

          {/* Calendar */}
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

                const rec = recordByDay[day];
                const holidayName = holidayByDay[day];
                const meta = rec ? statusMeta[rec.status] : holidayName ? statusMeta.HOLIDAY : null;
                const isToday =
                  day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();

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

      {/* Map modal */}
      {mapModalRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="relative w-full max-w-3xl rounded-3xl bg-background border border-border shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-secondary/10">
              <div>
                <div className="font-semibold">Attendance Location</div>
                <div className="text-xs text-muted-foreground">{new Date(mapModalRecord.date).toLocaleDateString()}</div>
              </div>
              <button
                type="button"
                onClick={() => setMapModalRecord(null)}
                className="rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-background border border-border p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Latitude</div>
                  <div className="font-medium">{mapModalRecord.latitude}</div>
                </div>
                <div className="rounded-2xl bg-background border border-border p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Longitude</div>
                  <div className="font-medium">{mapModalRecord.longitude}</div>
                </div>
              </div>

              <div className="rounded-3xl overflow-hidden border border-border">
                <iframe
                  title="Attendance location map"
                  src={`https://www.google.com/maps?q=${mapModalRecord.latitude},${mapModalRecord.longitude}&output=embed`}
                  className="w-full h-80"
                  loading="lazy"
                  allowFullScreen
                />
              </div>

              <div className="rounded-2xl bg-background border border-border p-4 text-sm text-muted-foreground">
                <div className="font-semibold mb-2">Location note</div>
                <div className="whitespace-pre-line">{mapModalRecord.note || "No note available."}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;
