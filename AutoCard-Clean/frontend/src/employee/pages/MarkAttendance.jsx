import { useEffect, useState, useCallback } from "react";
import {
  Fingerprint, Loader2, LogIn, LogOut, MapPin, Clock,
  CheckCircle2, RefreshCw, Calendar, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../lib/api.js";

// ── helpers ───────────────────────────────────────────────────────────────────

const fmtTime = (v) =>
  v ? new Date(v).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—";

const fmtDate = (v) =>
  v ? new Date(v).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "—";

const STATUS_META = {
  PRESENT:  { label: "Present",   bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500" },
  LATE:     { label: "Late",      bg: "bg-amber-100",   text: "text-amber-700",   dot: "bg-amber-500"  },
  ABSENT:   { label: "Absent",    bg: "bg-rose-100",    text: "text-rose-700",    dot: "bg-rose-500"   },
  HALF_DAY: { label: "Half Day",  bg: "bg-blue-100",    text: "text-blue-700",    dot: "bg-blue-500"   },
  ON_LEAVE: { label: "On Leave",  bg: "bg-purple-100",  text: "text-purple-700",  dot: "bg-purple-500" },
  HOLIDAY:  { label: "Holiday",   bg: "bg-indigo-100",  text: "text-indigo-700",  dot: "bg-indigo-500" },
};

// Returns "lat, lon (±Xm)" or throws an error string
const getGPSLocation = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve(`${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)} (±${Math.round(coords.accuracy)}m)`),
      (err) =>
        reject(new Error(
          err.code === 1
            ? "Location permission denied. Please allow location access and try again."
            : "Could not get your location. Please try again.",
        )),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });

// ── Location input block ──────────────────────────────────────────────────────

const LocationBlock = ({ action, value, onChange, fetchingLoc, onFetch }) => {
  const isFetching = fetchingLoc === action;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          Location <span className="text-destructive">*</span>
        </label>
        {!value && (
          <span className="text-xs text-rose-600 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> Required
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          className={`flex-1 px-3 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background ${
            value ? "border-emerald-300 text-foreground" : "border-rose-300 text-muted-foreground"
          }`}
          placeholder="Click 'Get Location' to capture GPS…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => onFetch(action)}
          disabled={isFetching || fetchingLoc !== false}
          className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-primary bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors disabled:opacity-60 whitespace-nowrap"
        >
          {isFetching
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Fetching…</>
            : <><MapPin className="h-3.5 w-3.5" /> Get Location</>}
        </button>
      </div>
      {value && (
        <p className="text-xs text-emerald-600 flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" /> Location captured
        </p>
      )}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const MarkAttendance = () => {
  const [record,      setRecord]      = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [checkingIn,  setCheckingIn]  = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [now,         setNow]         = useState(new Date());
  const [checkInLoc,  setCheckInLoc]  = useState("");
  const [checkOutLoc, setCheckOutLoc] = useState("");
  const [fetchingLoc, setFetchingLoc] = useState(false); // "checkin" | "checkout" | false

  // Live clock — tick every second
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Load today's attendance record
  const loadToday = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet("/attendance/me/today");
      setRecord(data.record);
    } catch (err) {
      toast.error(err.message || "Failed to load today's attendance.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadToday(); }, [loadToday]);

  // Fetch GPS for a given action ("checkin" | "checkout")
  const fetchLocFor = async (action) => {
    setFetchingLoc(action);
    try {
      const loc = await getGPSLocation();
      if (action === "checkin")  setCheckInLoc(loc);
      if (action === "checkout") setCheckOutLoc(loc);
      toast.success("Location captured.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setFetchingLoc(false);
    }
  };

  const handleCheckIn = async () => {
    if (checkingIn) return;
    if (!checkInLoc.trim()) {
      toast.error("Location is required. Click 'Get Location' to capture it.");
      return;
    }
    setCheckingIn(true);
    try {
      const data = await apiPost("/attendance/checkin", { location: checkInLoc });
      setRecord(data.record);
      toast.success(data.message || "Checked in successfully!");
    } catch (err) {
      toast.error(err.message || "Check-in failed.");
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    if (checkingOut) return;
    if (!checkOutLoc.trim()) {
      toast.error("Location is required. Click 'Get Location' to capture it.");
      return;
    }
    setCheckingOut(true);
    try {
      const data = await apiPost("/attendance/checkout", { location: checkOutLoc });
      setRecord(data.record);
      toast.success(data.message || "Checked out successfully!");
    } catch (err) {
      toast.error(err.message || "Check-out failed.");
    } finally {
      setCheckingOut(false);
    }
  };

  // Derived
  const hasCheckedIn  = !!record?.checkIn;
  const hasCheckedOut = !!record?.checkOut;
  const statusMeta    = record ? (STATUS_META[record.status] ?? STATUS_META.PRESENT) : null;

  const workedMs = record?.checkIn
    ? (record.checkOut
        ? new Date(record.checkOut).getTime() - new Date(record.checkIn).getTime()
        : now.getTime() - new Date(record.checkIn).getTime())
    : 0;
  const workedH = Math.floor(workedMs / (1000 * 60 * 60));
  const workedM = Math.floor((workedMs % (1000 * 60 * 60)) / (1000 * 60));
  const workedS = Math.floor((workedMs % (1000 * 60)) / 1000);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Fingerprint className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Mark Attendance</h1>
            <p className="text-sm text-muted-foreground">Check in and out for today.</p>
          </div>
        </div>
        <button
          onClick={loadToday}
          disabled={loading}
          className="p-2 rounded-lg border border-border hover:bg-secondary transition-colors text-muted-foreground disabled:opacity-60"
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Live clock */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20 p-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{fmtDate(now)}</span>
        </div>
        <div className="font-display text-5xl font-bold tracking-tight text-primary">
          {now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
        </div>
      </div>

      {/* Today's attendance card */}
      {loading ? (
        <div className="rounded-2xl bg-background border border-border p-10 flex items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : (
        <div className="rounded-2xl bg-background border border-border card-shadow p-6 space-y-5">

          {/* Status badge */}
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">Today's Attendance</h2>
            {statusMeta && (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${statusMeta.bg} ${statusMeta.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
                {statusMeta.label}
              </span>
            )}
          </div>

          {/* Check-in / Check-out time tiles */}
          <div className="grid grid-cols-2 gap-4">
            <div className={`rounded-xl p-4 border ${hasCheckedIn ? "border-emerald-200 bg-emerald-50" : "border-dashed border-border bg-secondary/20"}`}>
              <div className="flex items-center gap-2 mb-1">
                <LogIn className={`h-4 w-4 ${hasCheckedIn ? "text-emerald-600" : "text-muted-foreground"}`} />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Check In</span>
              </div>
              <div className={`font-display text-2xl font-bold ${hasCheckedIn ? "text-emerald-700" : "text-muted-foreground/40"}`}>
                {hasCheckedIn ? fmtTime(record.checkIn) : "—"}
              </div>
            </div>
            <div className={`rounded-xl p-4 border ${hasCheckedOut ? "border-rose-200 bg-rose-50" : "border-dashed border-border bg-secondary/20"}`}>
              <div className="flex items-center gap-2 mb-1">
                <LogOut className={`h-4 w-4 ${hasCheckedOut ? "text-rose-600" : "text-muted-foreground"}`} />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Check Out</span>
              </div>
              <div className={`font-display text-2xl font-bold ${hasCheckedOut ? "text-rose-700" : "text-muted-foreground/40"}`}>
                {hasCheckedOut ? fmtTime(record.checkOut) : "—"}
              </div>
            </div>
          </div>

          {/* Live worked-hours counter */}
          {hasCheckedIn && (
            <div className="rounded-xl bg-secondary/40 border border-border px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {hasCheckedOut ? "Total worked" : "Time elapsed"}
              </div>
              <div className="font-display text-lg font-bold tabular-nums">
                {String(workedH).padStart(2, "0")}h {String(workedM).padStart(2, "0")}m{" "}
                {!hasCheckedOut && (
                  <span className="text-muted-foreground text-sm">{String(workedS).padStart(2, "0")}s</span>
                )}
              </div>
            </div>
          )}

          {/* Check-In: location + button */}
          {!hasCheckedIn && (
            <>
              <LocationBlock
                action="checkin"
                value={checkInLoc}
                onChange={setCheckInLoc}
                fetchingLoc={fetchingLoc}
                onFetch={fetchLocFor}
              />
              <button
                onClick={handleCheckIn}
                disabled={checkingIn || !checkInLoc.trim()}
                className="w-full cta-gradient text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {checkingIn ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
                {checkingIn ? "Checking In…" : "Check In"}
              </button>
            </>
          )}

          {/* Check-Out: location + button */}
          {hasCheckedIn && !hasCheckedOut && (
            <>
              <LocationBlock
                action="checkout"
                value={checkOutLoc}
                onChange={setCheckOutLoc}
                fetchingLoc={fetchingLoc}
                onFetch={fetchLocFor}
              />
              <button
                onClick={handleCheckOut}
                disabled={checkingOut || !checkOutLoc.trim()}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {checkingOut ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
                {checkingOut ? "Checking Out…" : "Check Out"}
              </button>
            </>
          )}

          {/* Fully done */}
          {hasCheckedIn && hasCheckedOut && (
            <div className="w-full rounded-xl bg-emerald-50 border border-emerald-200 py-3 flex items-center justify-center gap-2 text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
              Attendance marked for today
            </div>
          )}

          {/* Stored location note */}
          {record?.note && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-secondary/40 rounded-lg px-3 py-2">
              <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {record.note}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MarkAttendance;
