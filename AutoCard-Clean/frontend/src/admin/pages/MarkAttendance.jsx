import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Fingerprint, Loader2, LogIn, LogOut, Clock,
  CheckCircle2, RefreshCw, Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../lib/api.js";
import { getAuthUser } from "../../lib/auth.js";

// ── helpers ───────────────────────────────────────────────────────────────────

const fmtTime = (v) =>
  v ? new Date(v).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—";

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
  PRESENT:  { label: "Present",   bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500" },
  ABSENT:   { label: "Absent",    bg: "bg-rose-100",    text: "text-rose-700",    dot: "bg-rose-500"   },
  ON_LEAVE: { label: "On Leave",  bg: "bg-purple-100",  text: "text-purple-700",  dot: "bg-purple-500" },
  HOLIDAY:  { label: "Holiday",   bg: "bg-indigo-100",  text: "text-indigo-700",  dot: "bg-indigo-500" },
  PENDING_APPROVAL: { label: "Pending", bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
};

const toRadians = (value) => (value * Math.PI) / 180;

const getDistanceInMeters = (lat1, lon1, lat2, lon2) => {
  const earthRadiusMeters = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
};

const parseLocationCoordinates = (location) => {
  if (!location || typeof location !== "string") return null;

  const match = location.match(/(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/);
  if (!match) return null;

  const latitude = Number(match[1]);
  const longitude = Number(match[2]);

  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude, longitude }
    : null;
};

// Returns "lat, lon (±Xm)" or throws an error string
const getGPSLocation = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser."));
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 25000,
      maximumAge: 10000,
    };

    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve(`${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)} (±${Math.round(coords.accuracy)}m)`),
      async (err) => {
        let message = "Could not get your location. Please try again.";

        if (err.code === 1) {
          message = "Location permission is blocked. Please enable location access for this browser and try again.";
        } else if (err.code === 2) {
          message = "Location services are unavailable right now. Please turn on GPS/Location Services and try again.";
        } else if (err.code === 3) {
          message = "Location request timed out. Please try again with a stronger signal or move to an open area.";
        }

        if (typeof navigator !== "undefined" && navigator.permissions?.query) {
          try {
            const permissionStatus = await navigator.permissions.query({ name: "geolocation" });
            if (permissionStatus.state === "denied") {
              message = "Location permission is blocked. Please enable location access for this browser and try again.";
            }
          } catch {
            // ignore and use fallback message
          }
        }

        reject(new Error(message));
      },
      options,
    );
  });

// ── Main component ────────────────────────────────────────────────────────────

const AdminMarkAttendance = () => {
  const navigate = useNavigate();
  const [record,      setRecord]      = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [checkingIn,  setCheckingIn]  = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [now,         setNow]         = useState(new Date());
  const [capturingLocation, setCapturingLocation] = useState(false);
  const [targetLocation, setTargetLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState(null);
  const [reasonModal, setReasonModal] = useState(null);
  const [reasonText, setReasonText] = useState("");

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

  const loadTargetLocation = useCallback(async () => {
    setLocationLoading(true);
    setLocationError(null);
    try {
      const data = await apiGet("/attendance/checkin-location");
      setTargetLocation(data.location);
    } catch (err) {
      setTargetLocation(null);
      setLocationError(err.message || "Failed to load assigned location.");
    } finally {
      setLocationLoading(false);
    }
  }, []);

  useEffect(() => {
    loadToday();
    loadTargetLocation();
  }, [loadToday, loadTargetLocation]);

  const openReasonModal = (type, location, coordinates, distanceMeters) => {
    setReasonModal({
      type,
      location,
      coordinates,
      distanceMeters,
      locationName: targetLocation?.name || "Unassigned location",
    });
    setReasonText("");
  };

  const submitReasonedAttendance = async () => {
    if (!reasonModal) return;
    const trimmedReason = reasonText.trim();
    if (!trimmedReason) {
      toast.error("Please enter a reason before submitting.");
      return;
    }

    const payload = {
      location: reasonModal.location,
      reason: trimmedReason,
    };

    try {
      if (reasonModal.type === "checkin") {
        const data = await apiPost("/attendance/checkin", payload);
        const authUser = getAuthUser();
        if (data.record?.id && authUser?.id) {
          localStorage.setItem(`employee-has-checked-in:${authUser.id}`, "true");
        }
        setRecord(data.record);
        toast.success(data.message || "Checked in successfully!");
      } else {
        const data = await apiPost("/attendance/checkout", payload);
        setRecord(data.record);
        toast.success(data.message || "Checked out successfully!");
      }
    } catch (err) {
      toast.error(err.message || "Request failed.");
    } finally {
      setReasonModal(null);
      setReasonText("");
    }
  };

  const handleCheckIn = async () => {
    if (checkingIn || capturingLocation) return;
    setCheckingIn(true);
    setCapturingLocation(true);
    try {
      const now = new Date();

      const location = await getGPSLocation();
      const coordinates = parseLocationCoordinates(location);

      if (!coordinates) {
        throw new Error("Unable to read your location coordinates. Please try again.");
      }

      if (!targetLocation) {
        openReasonModal("checkin", location, coordinates, null);
        return;
      }
      if (targetLocation.latitude == null || targetLocation.longitude == null) {
        throw new Error("The assigned location has no GPS coordinates configured.");
      }

      const distanceMeters = getDistanceInMeters(
        targetLocation.latitude,
        targetLocation.longitude,
        coordinates.latitude,
        coordinates.longitude,
      );

      if (distanceMeters > (targetLocation.radius ?? 50)) {
        openReasonModal("checkin", location, coordinates, Math.round(distanceMeters));
        return;
      }

      const data = await apiPost("/attendance/checkin", { location });
      const authUser = getAuthUser();
      if (data.record?.id && authUser?.id) {
        localStorage.setItem(`employee-has-checked-in:${authUser.id}`, "true");
      }
      setRecord(data.record);
      toast.success(data.message || "Checked in successfully!");
    } catch (err) {
      toast.error(err.message || "Check-in failed.");
    } finally {
      setCheckingIn(false);
      setCapturingLocation(false);
    }
  };

  const handleCheckOut = async () => {
    if (checkingOut || capturingLocation) return;
    setCheckingOut(true);
    setCapturingLocation(true);
    try {
      const location = await getGPSLocation();
      const coordinates = parseLocationCoordinates(location);

      if (!coordinates) {
        throw new Error("Unable to read your location coordinates. Please try again.");
      }

      if (!targetLocation) {
        openReasonModal("checkout", location, coordinates, null);
        return;
      }
      if (targetLocation.latitude == null || targetLocation.longitude == null) {
        throw new Error("The assigned location has no GPS coordinates configured.");
      }

      const distanceMeters = getDistanceInMeters(
        targetLocation.latitude,
        targetLocation.longitude,
        coordinates.latitude,
        coordinates.longitude,
      );

      if (distanceMeters > (targetLocation.radius ?? 50)) {
        openReasonModal("checkout", location, coordinates, Math.round(distanceMeters));
        return;
      }

      const data = await apiPost("/attendance/checkout", { location });
      setRecord(data.record);
      toast.success(data.message || "Checked out successfully!");
    } catch (err) {
      toast.error(err.message || "Check-out failed.");
    } finally {
      setCheckingOut(false);
      setCapturingLocation(false);
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
            <p className="text-sm text-muted-foreground">Check in and out for today (Admin).</p>
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

      <div className="rounded-2xl bg-secondary/50 border border-border p-4 text-sm text-muted-foreground">
        <p className="font-semibold text-slate-900">Admin Attendance</p>
        <p className="mt-1">
          As an admin, you can mark your own attendance here. Note: Admin is also an employee of the company.
        </p>
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

          {/* Check-In button */}
          {!hasCheckedIn && (
            <button
              onClick={handleCheckIn}
              disabled={checkingIn || capturingLocation}
              className="w-full cta-gradient text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {checkingIn || capturingLocation ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
              {checkingIn || capturingLocation ? "Capturing Location…" : "Check In"}
            </button>
          )}

          {/* Check-Out button */}
          {hasCheckedIn && !hasCheckedOut && (
            <button
              onClick={handleCheckOut}
              disabled={checkingOut || capturingLocation}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {checkingOut || capturingLocation ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
              {checkingOut || capturingLocation ? "Capturing Location…" : "Check Out"}
            </button>
          )}

          {/* Fully done */}
          {hasCheckedIn && hasCheckedOut && (
            <div className="w-full rounded-xl bg-emerald-50 border border-emerald-200 py-3 flex items-center justify-center gap-2 text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
              Attendance marked for today
            </div>
          )}

        </div>
      )}

      {reasonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-border">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-xl font-bold text-slate-900">
                  {reasonModal.type === "checkin" ? "Check-in reason" : "Check-out reason"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  You are checking {reasonModal.type === "checkin" ? "in" : "out"} away from your assigned or default location.
                </p>
              </div>
              <button
                onClick={() => {
                  setReasonModal(null);
                  setReasonText("");
                }}
                className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-secondary"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
              <div className="font-medium">Location info</div>
              <div className="mt-1">
                {reasonModal.locationName}
                {reasonModal.distanceMeters != null && (
                  <span className="ml-2">({reasonModal.distanceMeters}m away)</span>
                )}
              </div>
            </div>

            <label className="mt-5 block text-sm font-medium text-slate-700">
              Reason
            </label>
            <textarea
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              rows={5}
              placeholder="Please enter the reason for checking in/out from this location..."
              className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => {
                  setReasonModal(null);
                  setReasonText("");
                }}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                onClick={submitReasonedAttendance}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMarkAttendance;
