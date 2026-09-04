import { useEffect, useState, useCallback } from "react";
import {
  CalendarRange, Loader2, RefreshCw, Plus, Trash2,
  AlertTriangle, ChevronLeft, ChevronRight, Search,
  Users, Clock, MapPin, X,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiDelete } from "../../lib/api.js";
import { formatTimeRange } from "../../lib/timeFormat.js";

// ── constants ─────────────────────────────────────────────────────────────────
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ── helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (iso) => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const toDateStr = (d) => {
  const dt = new Date(d);
  const y  = dt.getUTCFullYear();
  const m  = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

// ── empty form ────────────────────────────────────────────────────────────────
const emptyForm = { employeeId: "", fromDate: "", toDate: "", shiftId: "", locationId: "", note: "" };

// ── StatCard ──────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, tone }) => {
  const tones = {
    primary: "bg-primary/10 text-primary",
    blue:    "bg-blue-100 text-blue-700",
    green:   "bg-green-100 text-green-700",
    amber:   "bg-amber-100 text-amber-700",
  };
  return (
    <div className="rounded-2xl bg-background border border-border card-shadow p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="font-display text-2xl font-bold leading-none">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </div>
    </div>
  );
};

// ── input class ───────────────────────────────────────────────────────────────
const inputClass =
  "w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow";

// ── Main component ────────────────────────────────────────────────────────────
const Roster = () => {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  // data
  const [entries,   setEntries]   = useState([]);
  const [employees, setEmployees] = useState([]);
  const [shifts,    setShifts]    = useState([]);
  const [locations, setLocations] = useState([]);

  // ui states
  const [loading,    setLoading]    = useState(true);
  const [metaLoaded, setMetaLoaded] = useState(false);
  const [view,       setView]       = useState("calendar"); // "calendar" | "table"
  const [filterEmp,  setFilterEmp]  = useState("");
  const [search,     setSearch]     = useState("");

  // form
  const [showForm,   setShowForm]   = useState(false);
  const [form,       setForm]       = useState(emptyForm);
  const [saving,     setSaving]     = useState(false);

  // delete
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]     = useState(false);

  // ── load roster entries ──────────────────────────────────────────────────
  const loadRoster = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ year, month });
      if (filterEmp) params.set("employeeId", filterEmp);
      const d = await apiGet(`/roster?${params}`);
      setEntries(d.entries ?? []);
    } catch (err) {
      toast.error(err.message || "Failed to load roster.");
    } finally {
      setLoading(false);
    }
  }, [year, month, filterEmp]);

  // ── load meta (employees, shifts, locations) once ────────────────────────
  const loadMeta = useCallback(async () => {
    try {
      const d = await apiGet("/roster/meta");
      setEmployees(d.employees ?? []);
      setShifts(d.shifts ?? []);
      setLocations(d.locations ?? []);
      setMetaLoaded(true);
    } catch (err) {
      toast.error(err.message || "Failed to load dropdown data.");
    }
  }, []);

  useEffect(() => { loadMeta(); }, [loadMeta]);
  useEffect(() => { loadRoster(); }, [loadRoster]);

  // ── navigation ───────────────────────────────────────────────────────────
  const prevMonth = () => { if (month === 1) { setYear(y => y-1); setMonth(12); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 12) { setYear(y => y+1); setMonth(1); } else setMonth(m => m+1); };

  // ── save entry ───────────────────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!form.employeeId || !form.fromDate || !form.toDate || !form.shiftId) {
      toast.error("Employee, from date, to date and shift are required.");
      return;
    }
    
    // Validate date range
    const from = new Date(form.fromDate);
    const to = new Date(form.toDate);
    if (to < from) {
      toast.error("To date must be after or equal to From date.");
      return;
    }
    
    setSaving(true);
    try {
      // Create roster entries for each day in the range
      const promises = [];
      const currentDate = new Date(from);
      
      while (currentDate <= to) {
        const dateStr = toDateStr(currentDate);
        const entryData = {
          employeeId: form.employeeId,
          date: dateStr,
          shiftId: form.shiftId,
          locationId: form.locationId || "",
          note: form.note || "",
        };
        promises.push(apiPost("/roster", entryData));
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      await Promise.all(promises);
      
      const daysCount = Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1;
      toast.success(`${daysCount} roster ${daysCount === 1 ? 'entry' : 'entries'} created successfully.`);
      setForm(emptyForm);
      setShowForm(false);
      loadRoster();
    } catch (err) {
      toast.error(err.message || "Failed to save entries.");
    } finally {
      setSaving(false);
    }
  };

  // ── delete ───────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await apiDelete(`/roster/${deleteTarget.id}`);
      toast.success("Entry deleted.");
      setDeleteTarget(null);
      loadRoster();
    } catch (err) {
      toast.error(err.message || "Failed to delete entry.");
    } finally {
      setDeleting(false);
    }
  };

  // ── derived ──────────────────────────────────────────────────────────────
  const filteredEntries = entries.filter(e => {
    const name = e.employee?.user?.fullName?.toLowerCase() ?? "";
    return name.includes(search.toLowerCase());
  });

  // calendar grid helpers
  const daysInMonth  = new Date(year, month, 0).getDate();
  const firstDayOfWk = new Date(year, month - 1, 1).getDay();

  // group entries by "YYYY-MM-DD"
  const byDay = {};
  for (const e of filteredEntries) {
    const key = toDateStr(e.date);
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(e);
  }

  const uniqueEmployees = [...new Map(entries.map(e => [e.employeeId, e.employee?.user?.fullName ?? e.employeeId])).entries()];

  return (
    <div className="space-y-6 max-w-7xl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <CalendarRange className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Roster</h1>
            <p className="text-sm text-muted-foreground">Plan and assign employee work schedules.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {["calendar","table"].map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors capitalize ${view === v ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}>
                {v}
              </button>
            ))}
          </div>
          <button onClick={loadRoster} disabled={loading}
            className="p-2 rounded-lg border border-border hover:bg-secondary transition-colors text-muted-foreground disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg cta-gradient text-white text-sm font-semibold hover:opacity-90 transition-opacity">
            <Plus className="h-4 w-4" /> Add Entry
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={CalendarRange} label="Total Entries"    value={entries.length}                     tone="primary" />
        <StatCard icon={Users}         label="Employees Rostered" value={new Set(entries.map(e=>e.employeeId)).size} tone="blue"    />
        <StatCard icon={Clock}         label="Shifts Used"      value={new Set(entries.map(e=>e.shiftId)).size}    tone="green"   />
        <StatCard icon={MapPin}        label="Locations Used"   value={new Set(entries.filter(e=>e.locationId).map(e=>e.locationId)).size} tone="amber" />
      </div>

      {/* ── Month navigator ── */}
      <div className="flex items-center justify-between rounded-2xl bg-background border border-border card-shadow px-5 py-3">
        <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <div className="font-display text-lg font-bold">{MONTH_NAMES[month-1]} {year}</div>
          <div className="text-xs text-muted-foreground">{entries.length} roster {entries.length === 1 ? "entry" : "entries"}</div>
        </div>
        <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Search employee…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className={inputClass + " flex-1 min-w-[180px] max-w-xs"}
          value={filterEmp} onChange={e => setFilterEmp(e.target.value)}>
          <option value="">All Employees</option>
          {uniqueEmployees.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
      </div>

      {/* ── Add Entry Form (Modal) ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay - click to close */}
          <div className="absolute inset-0 bg-foreground/50" onClick={() => { setShowForm(false); setForm(emptyForm); }} />
          
          {/* Form Card */}
          <div className="relative bg-background rounded-2xl border border-border shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-base font-semibold">Add Roster Entry</h2>
              <button onClick={() => { setShowForm(false); setForm(emptyForm); }}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Employee <span className="text-destructive">*</span></label>
              <select className={inputClass} value={form.employeeId} onChange={e => setForm(p=>({...p, employeeId: e.target.value}))} required>
                <option value="">Select employee…</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.employeeProfile?.id ?? emp.id}>
                    {emp.fullName} {emp.employeeProfile?.employeeCode ? `(${emp.employeeProfile.employeeCode})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">From Date <span className="text-destructive">*</span></label>
              <input type="date" className={inputClass} value={form.fromDate} onChange={e => setForm(p=>({...p, fromDate: e.target.value}))} required />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">To Date <span className="text-destructive">*</span></label>
              <input type="date" className={inputClass} value={form.toDate} onChange={e => setForm(p=>({...p, toDate: e.target.value}))} required />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Shift <span className="text-destructive">*</span></label>
              <select className={inputClass} value={form.shiftId} onChange={e => setForm(p=>({...p, shiftId: e.target.value}))} required>
                <option value="">Select shift…</option>
                {shifts.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({formatTimeRange(s.startTime, s.endTime, '–')})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Location</label>
              <select className={inputClass} value={form.locationId} onChange={e => setForm(p=>({...p, locationId: e.target.value}))}>
                <option value="">No specific location</option>
                {locations
                  .filter(l => l.name.toLowerCase() !== 'head office duty')
                  .map(l => (
                    <option key={l.id} value={l.id}>{l.name}{l.city ? ` — ${l.city}` : ""}</option>
                  ))
                }
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="text-sm font-medium mb-1.5 block">Note</label>
              <input className={inputClass} value={form.note} onChange={e => setForm(p=>({...p, note: e.target.value}))} placeholder="Optional note" maxLength={300} />
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-2">
              <button type="button" onClick={() => { setShowForm(false); setForm(emptyForm); }}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg cta-gradient text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {saving ? "Saving…" : "Save Entry"}
              </button>
            </div>
          </form>
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {loading ? (
        <div className="rounded-2xl bg-background border border-border p-16 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>

      ) : view === "calendar" ? (
        /* ── Calendar View ── */
        <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {DAYS.map(d => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground bg-secondary/30">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {/* Leading empty cells */}
            {Array.from({ length: firstDayOfWk }).map((_, i) => (
              <div key={`e${i}`} className="min-h-[100px] border-r border-b border-border/40 bg-secondary/10" />
            ))}
            {/* Day cells */}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dateStr = `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
              const dayEntries = byDay[dateStr] ?? [];
              const isToday = year === today.getFullYear() && month === today.getMonth()+1 && day === today.getDate();

              return (
                <div key={day}
                  className={`min-h-[100px] border-r border-b border-border/40 p-1.5 flex flex-col gap-1 ${isToday ? "bg-primary/5 ring-2 ring-inset ring-primary" : "hover:bg-secondary/10"}`}>
                  <span className={`text-xs font-bold ${isToday ? "text-primary" : "text-muted-foreground"}`}>{day}</span>
                  {dayEntries.map(e => (
                    <div key={e.id}
                      className="group relative rounded-md bg-primary/10 border border-primary/20 px-1.5 py-1 text-xs leading-tight">
                      <div className="font-semibold text-primary truncate">{e.employee?.user?.fullName ?? "—"}</div>
                      <div className="text-muted-foreground truncate">{e.shift?.name}</div>
                      {e.location && <div className="text-muted-foreground truncate">{e.location.name}</div>}
                      {/* delete btn on hover */}
                      <button onClick={() => setDeleteTarget(e)}
                        className="absolute top-0.5 right-0.5 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/20 text-destructive transition-all">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {/* quick-add: click empty day */}
                  <button onClick={() => { setForm(p=>({...p, fromDate: dateStr, toDate: dateStr})); setShowForm(true); }}
                    className="mt-auto text-muted-foreground/40 hover:text-primary transition-colors self-center">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

      ) : (
        /* ── Table View ── */
        <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">
          {filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CalendarRange className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No roster entries for this month.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/30 border-b border-border text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 text-left">Employee</th>
                    <th className="px-5 py-3 text-left">Date</th>
                    <th className="px-5 py-3 text-left">Shift</th>
                    <th className="px-5 py-3 text-left">Timing</th>
                    <th className="px-5 py-3 text-left">Location</th>
                    <th className="px-5 py-3 text-left">Note</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredEntries.map(e => (
                    <tr key={e.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-5 py-3 font-semibold">
                        {e.employee?.user?.fullName ?? "—"}
                        {e.employee?.employeeCode && (
                          <span className="ml-1.5 text-xs text-primary/70 font-mono">#{e.employee.employeeCode}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">{fmtDate(e.date)}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          {e.shift?.name ?? "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs whitespace-nowrap">
                        {e.shift ? formatTimeRange(e.shift.startTime, e.shift.endTime) : "—"}
                      </td>
                      <td className="px-5 py-3">{e.location?.name ?? "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground max-w-[160px] truncate">{e.note || "—"}</td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => setDeleteTarget(e)}
                          className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Delete confirm ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/50" onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="relative bg-background rounded-2xl border border-border shadow-xl w-full max-w-md p-6">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex-1">
                <h3 className="font-display text-lg font-bold">Delete Roster Entry?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Remove <strong>{deleteTarget.employee?.user?.fullName}</strong>'s entry for{" "}
                  <strong>{fmtDate(deleteTarget.date)}</strong>? This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-60">
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={deleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-60">
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Roster;
