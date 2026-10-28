import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Fingerprint,
  Loader2,
  LogIn,
  LogOut,
  Clock,
  CheckCircle2,
  RefreshCw,
  Calendar,
  ScanLine,
  ShieldAlert,
  AlertTriangle,
  Moon,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../lib/api.js";
import { getAuthUser } from "../../lib/auth.js";
import { hasModuleAccess } from "../../lib/permissions.js";
import { formatTimeRange } from "../../lib/timeFormat.js";

// =========================================================
// HELPERS
// =========================================================

const formatTime12h = (time24) => {
  if (!time24) return "—";
  const parts = String(time24).split(":");
  if (parts.length < 2) return time24;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return time24;
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
};

const parse24to12 = (time24) => {
  if (!time24) return { hour12: "10", minute: "00", ampm: "AM" };
  const [hStr, mStr] = String(time24).split(":");
  let h = Number(hStr) || 0;
  const m = String(Number(mStr) || 0).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = String(h % 12 || 12);
  return { hour12, minute: m, ampm };
};

const to24hString = (hour12, minute, ampm) => {
  let h = Number(hour12) || 12;
  const m = String(Number(minute) || 0).padStart(2, "0");
  if (ampm === "AM") {
    if (h === 12) h = 0;
  } else {
    if (h !== 12) h += 12;
  }
  return `${String(h).padStart(2, "0")}:${m}`;
};

const TimePicker12h = ({ value, onChange, disabled = false }) => {
  const { hour12, minute, ampm } = parse24to12(value);

  const handleHourChange = (newH) => {
    onChange(to24hString(newH, minute, ampm));
  };

  const handleMinuteChange = (newM) => {
    onChange(to24hString(hour12, newM, ampm));
  };

  const handleAmPmChange = (newAmPm) => {
    onChange(to24hString(hour12, minute, newAmPm));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background p-1.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
        <select
          value={hour12}
          disabled={disabled}
          onChange={(e) => handleHourChange(e.target.value)}
          aria-label="Hour (1-12)"
          className="bg-transparent text-sm font-semibold text-foreground focus:outline-none cursor-pointer py-1 px-1.5 rounded"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
            <option key={h} value={String(h)}>
              {String(h).padStart(2, "0")}
            </option>
          ))}
        </select>

        <span className="text-muted-foreground font-bold">:</span>

        <select
          value={minute}
          disabled={disabled}
          onChange={(e) => handleMinuteChange(e.target.value)}
          aria-label="Minute"
          className="bg-transparent text-sm font-semibold text-foreground focus:outline-none cursor-pointer py-1 px-1.5 rounded"
        >
          {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        <div className="inline-flex rounded-md border border-border p-0.5 bg-muted/40 ml-1">
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleAmPmChange("AM")}
            className={`px-2 py-0.5 text-xs font-bold rounded transition-colors ${
              ampm === "AM"
                ? "bg-primary text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            AM
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleAmPmChange("PM")}
            className={`px-2 py-0.5 text-xs font-bold rounded transition-colors ${
              ampm === "PM"
                ? "bg-primary text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            PM
          </button>
        </div>
      </div>

      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-bold tracking-wide">
        <Clock className="h-3 w-3" />
        {formatTime12h(value)}
      </span>
    </div>
  );
};

const fmtTime = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const fmtDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const getIndiaDateKey = (date = new Date()) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
};

// =========================================================
// ATTENDANCE STATUS
// =========================================================

const STATUS_META = {
  PRESENT: {
    label: "Present",
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
  },

  ABSENT: {
    label: "Absent",
    bg: "bg-rose-100",
    text: "text-rose-700",
    dot: "bg-rose-500",
  },

  ON_LEAVE: {
    label: "On Leave",
    bg: "bg-purple-100",
    text: "text-purple-700",
    dot: "bg-purple-500",
  },

  HOLIDAY: {
    label: "Holiday",
    bg: "bg-indigo-100",
    text: "text-indigo-700",
    dot: "bg-indigo-500",
  },
};

// =========================================================
// REQUEST STATUS
// =========================================================

const REQUEST_STATUS_META = {
  PENDING: {
    label: "Pending Approval",
    bg: "bg-amber-100",
    text: "text-amber-700",
    dot: "bg-amber-500",
  },

  APPROVED: {
    label: "Approved",
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
  },

  REJECTED: {
    label: "Rejected",
    bg: "bg-rose-100",
    text: "text-rose-700",
    dot: "bg-rose-500",
  },
};

// =========================================================
// GPS
// =========================================================

const toRadians = (value) => (value * Math.PI) / 180;

const getStraightDistanceInMeters = (lat1, lon1, lat2, lon2) => {
  const earthRadiusMeters = 6371000;

  const dLat = toRadians(lat2 - lat1);

  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
};

const getRoadDistanceInMeters = async (lat1, lon1, lat2, lon2) => {
  const straightDistance = getStraightDistanceInMeters(lat1, lon1, lat2, lon2);
  if (straightDistance < 100) {
    return straightDistance;
  }

  // 1. Try Google Maps Distance Matrix API if key is set in Vite env
  const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (googleApiKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${lat1},${lon1}&destinations=${lat2},${lon2}&key=${googleApiKey}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const element = data?.rows?.[0]?.elements?.[0];
        if (element?.status === "OK" && element?.distance?.value != null) {
          return element.distance.value;
        }
      }
    } catch (err) {
      console.warn("Google Distance Matrix API error, using OSRM fallback:", err.message);
    }
  }

  // 2. Try OSRM (Open Source Routing Machine) Free Driving Route API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.code === "Ok" && data.routes && data.routes.length > 0) {
        return data.routes[0].distance;
      }
    }
  } catch (err) {
    console.warn("OSRM routing API error, using fallback factor:", err.message);
  }

  // 3. Fallback: Straight-line * 1.35 road factor multiplier
  return straightDistance * 1.35;
};

const getDistanceInMeters = getStraightDistanceInMeters;

const parseLocationCoordinates = (location) => {
  if (!location || typeof location !== "string") {
    return null;
  }

  const match = location.match(/(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/);

  if (!match) return null;

  const latitude = Number(match[1]);
  const longitude = Number(match[2]);

  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? {
        latitude,
        longitude,
      }
    : null;
};

// =========================================================
// GET GPS LOCATION
// =========================================================

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
        resolve(
          `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(
            6,
          )} (±${Math.round(coords.accuracy)}m)`,
        ),

      async (err) => {
        let message = "Could not get your location. Please try again.";

        if (err.code === 1) {
          message =
            "Location permission is blocked. Please enable location access for this browser and try again.";
        } else if (err.code === 2) {
          message =
            "Location services are unavailable right now. Please turn on GPS/Location Services and try again.";
        } else if (err.code === 3) {
          message =
            "Location request timed out. Please try again with a stronger signal or move to an open area.";
        }

        if (typeof navigator !== "undefined" && navigator.permissions?.query) {
          try {
            const permissionStatus = await navigator.permissions.query({
              name: "geolocation",
            });

            if (permissionStatus.state === "denied") {
              message =
                "Location permission is blocked. Please enable location access for this browser and try again.";
            }
          } catch {
            // Ignore
          }
        }

        reject(new Error(message));
      },

      options,
    );
  });

// =========================================================
// MAIN COMPONENT
// =========================================================

const MarkAttendance = () => {
  const navigate = useNavigate();

  const [record, setRecord] = useState(null);
  const [todayShift, setTodayShift] = useState(null);
  const [approvedLeave, setApprovedLeave] = useState(null);
  const [unclosedPrevious, setUnclosedPrevious] = useState(null);

  const [correctionRequest, setCorrectionRequest] = useState(null);

  const [loading, setLoading] = useState(true);

  const [checkingIn, setCheckingIn] = useState(false);

  const [checkingOut, setCheckingOut] = useState(false);

  const [now, setNow] = useState(new Date());

  const [capturingLocation, setCapturingLocation] = useState(false);

  const [targetLocation, setTargetLocation] = useState(null);

  const [locationLoading, setLocationLoading] = useState(true);

  const [locationError, setLocationError] = useState(null);

  const [reasonModal, setReasonModal] = useState(null);

  const [reasonText, setReasonText] = useState("");

  const [overnightModal, setOvernightModal] = useState({
    isOpen: false,
    checkInTime: "",
    checkOutTime: "",
    checkInDate: "",
    checkOutDate: "",
    location: null,
    reason: "",
    submitting: false,
  });

  // =======================================================
  // LIVE CLOCK
  // =======================================================

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);

    return () => clearInterval(timer);
  }, []);

  // =======================================================
  // LOAD TODAY'S ATTENDANCE + REQUEST
  // =======================================================

  const loadToday = useCallback(async (showLoader = true) => {
    if (showLoader) {
      setLoading(true);
    }

    try {
      const [attendanceResult, requestResult] = await Promise.all([
        apiGet("/attendance/me/today"),

        apiGet("/requests/my"),
      ]);

      setRecord(attendanceResult.record ?? null);
      setTodayShift(attendanceResult.shift || attendanceResult.record?.shift || null);
      setApprovedLeave(attendanceResult.approvedLeave ?? null);
      setUnclosedPrevious(attendanceResult.unclosedPrevious ?? null);

      const requests = Array.isArray(requestResult?.requests)
        ? requestResult.requests
        : [];

      // -----------------------------------------------
      // TODAY
      // -----------------------------------------------
      const todayKey = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      // -----------------------------------------------
      // FIND TODAY'S OR ACTIVE 24H CORRECTION
      // -----------------------------------------------

      const nowTime = new Date().getTime();
      const twentyFourHoursMs = 24 * 60 * 60 * 1000;

      const activeCorrection =
        requests
          .filter((request) => request?.type === "CORRECTION")
          .filter((request) => {
            const description = String(request.description || "");
            const match = description.match(
              /\[ATTENDANCE_CORRECTION\]\s*(\{[\s\S]*\})\s*$/,
            );
            if (!match?.[1]) return false;

            try {
              const parsed = JSON.parse(match[1]);
              if (parsed?.date === todayKey) return true;

              // Check if it is a check-in request from within the last 24 hours (pending or approved without checkout)
              if (
                (request.status === "PENDING" || request.status === "APPROVED") &&
                parsed?.date &&
                parsed?.checkInTime &&
                (parsed.punchType === "check-in" || parsed.punchType === "both" || parsed.punchType === "time-edit")
              ) {
                const [h, m] = String(parsed.checkInTime).split(":").map(Number);
                if (Number.isFinite(h) && Number.isFinite(m)) {
                  const checkInDateTime = new Date(`${parsed.date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+05:30`);
                  if (nowTime - checkInDateTime.getTime() <= twentyFourHoursMs && nowTime >= checkInDateTime.getTime()) {
                    return true;
                  }
                }
              }
            } catch (e) {
              return false;
            }

            return false;
          })
          .sort(
            (a, b) =>
              new Date(b.createdAt || 0).getTime() -
              new Date(a.createdAt || 0).getTime(),
          )[0] || null;

      setCorrectionRequest(activeCorrection);
    } catch (err) {
      if (err?.status === 401 || err?.message?.includes("Authentication required")) {
        return;
      }
      console.error("Failed loading attendance/request:", err);

      // Attendance should continue
      // working even if request API fails.

      try {
        const data = await apiGet("/attendance/me/today");

        setRecord(data.record ?? null);
      } catch (attendanceErr) {
        toast.error(
          attendanceErr.message ||
            err.message ||
            "Failed to load today's attendance.",
        );
      }
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, []);

  // =======================================================
  // LOAD ASSIGNED LOCATION
  // =======================================================

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

  // =======================================================
  // INITIAL LOAD + AUTO REFRESH
  // =======================================================

  useEffect(() => {
    loadToday(true);
    loadTargetLocation();

    // Refresh every 10 seconds.
    // This detects admin approval/rejection.
    const refreshTimer = setInterval(() => {
      loadToday(false);
    }, 10000);

    const handleFocus = () => {
      loadToday(false);
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(refreshTimer);

      window.removeEventListener("focus", handleFocus);
    };
  }, [loadToday, loadTargetLocation]);

  // =======================================================
  // REASON MODAL
  // =======================================================

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

  // =======================================================
  // EXECUTE CHECK OUT HELPER
  // =======================================================
  const executeCheckOut = async (location, reason = "", customCheckOutTime = null, customCheckOutDate = null) => {
    const payload = {
      location,
      ...(reason ? { reason } : {}),
      ...(customCheckOutTime ? { checkOutTime: customCheckOutTime } : {}),
      ...(customCheckOutDate ? { checkOutDate: customCheckOutDate } : {}),
    };

    const data = await apiPost("/attendance/checkout", payload);
    setRecord(data.record ?? null);
    await loadToday(false);
    toast.success(data.message || "Checked out successfully!");
  };

  // =======================================================
  // SUBMIT LOCATION REASON
  // =======================================================

  const submitReasonedAttendance = async () => {
    if (!reasonModal) {
      return;
    }

    const trimmedReason = reasonText.trim();

    if (!trimmedReason) {
      toast.error("Please enter a reason before submitting.");
      return;
    }

    if (reasonModal.type === "checkout") {
      // Check for overnight shift condition
      const checkInDateObj = record?.checkIn ? new Date(record.checkIn) : null;
      const todayDateKey = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

      const checkInDateKey = checkInDateObj
        ? new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(checkInDateObj)
        : todayDateKey;

      const checkInTimeStr = checkInDateObj
        ? checkInDateObj.toLocaleTimeString("en-GB", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
        : "10:00";

      const currentTimeStr = new Date().toLocaleTimeString("en-GB", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      const isCrossDay = checkInDateKey < todayDateKey;
      const isEarlierTime = currentTimeStr < checkInTimeStr;

      if (isCrossDay || isEarlierTime) {
        setOvernightModal({
          isOpen: true,
          checkInTime: checkInTimeStr,
          checkOutTime: currentTimeStr,
          checkInDate: checkInDateKey,
          checkOutDate: todayDateKey,
          location: reasonModal.location,
          reason: trimmedReason,
          submitting: false,
        });
        setReasonModal(null);
        setReasonText("");
        return;
      }
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
          localStorage.setItem(
            `employee-has-checked-in:${authUser.id}`,
            "true",
          );
        }

        setRecord(data.record);

        await loadToday();

        toast.success(data.message || "Checked in successfully!");

        navigate("/employee", {
          replace: true,
        });
      } else {
        await executeCheckOut(reasonModal.location, trimmedReason);
      }
    } catch (err) {
      toast.error(err.message || "Request failed.");
    } finally {
      setReasonModal(null);
      setReasonText("");
    }
  };

  // =======================================================
  // CHECK IN
  // =======================================================

  const handleCheckIn = async () => {
    if (checkingIn || capturingLocation) {
      return;
    }

    setCheckingIn(true);
    setCapturingLocation(true);

    try {
      const location = await getGPSLocation();

      const coordinates = parseLocationCoordinates(location);

      if (!coordinates) {
        throw new Error(
          "Unable to read your location coordinates. Please try again.",
        );
      }

      if (!targetLocation) {
        openReasonModal("checkin", location, coordinates, null);

        return;
      }

      if (targetLocation.latitude == null || targetLocation.longitude == null) {
        throw new Error(
          "The assigned location has no GPS coordinates configured.",
        );
      }

      const distanceMeters = getStraightDistanceInMeters(
        targetLocation.latitude,
        targetLocation.longitude,
        coordinates.latitude,
        coordinates.longitude,
      );

      if (distanceMeters > (targetLocation.radius ?? 50)) {
        const roadDistance = await getRoadDistanceInMeters(
          targetLocation.latitude,
          targetLocation.longitude,
          coordinates.latitude,
          coordinates.longitude,
        );

        openReasonModal(
          "checkin",
          location,
          coordinates,
          Math.round(roadDistance),
        );

        return;
      }

      const data = await apiPost("/attendance/checkin", {
        location,
      });

      const authUser = getAuthUser();

      if (data.record?.id && authUser?.id) {
        localStorage.setItem(`employee-has-checked-in:${authUser.id}`, "true");
      }

      setRecord(data.record);

      await loadToday();

      toast.success(data.message || "Checked in successfully!");

      navigate("/employee", {
        replace: true,
      });
    } catch (err) {
      toast.error(err.message || "Check-in failed.");
    } finally {
      setCheckingIn(false);
      setCapturingLocation(false);
    }
  };

  // =======================================================
  // CHECK OUT
  // =======================================================
  const handleCheckOut = async () => {
    if (checkingOut || capturingLocation) {
      return;
    }

    setCheckingOut(true);
    setCapturingLocation(true);

    try {
      // =====================================================
      // GPS IS REQUIRED FOR EVERY CHECK OUT
      // INCLUDING FORGOT PUNCH PENDING
      // =====================================================

      const location = await getGPSLocation();

      const coordinates = parseLocationCoordinates(location);

      if (!coordinates) {
        throw new Error(
          "Unable to read your location coordinates. Please try again.",
        );
      }

      // =====================================================
      // CHECK ASSIGNED LOCATION
      // =====================================================

      if (!targetLocation) {
        openReasonModal("checkout", location, coordinates, null);

        return;
      }

      if (targetLocation.latitude == null || targetLocation.longitude == null) {
        throw new Error(
          "The assigned location has no GPS coordinates configured.",
        );
      }

      // =====================================================
      // CALCULATE DISTANCE
      // =====================================================

      const distanceMeters = getStraightDistanceInMeters(
        targetLocation.latitude,
        targetLocation.longitude,
        coordinates.latitude,
        coordinates.longitude,
      );

      // =====================================================
      // OUTSIDE ASSIGNED RADIUS
      // =====================================================

      if (distanceMeters > (targetLocation.radius ?? 50)) {
        const roadDistance = await getRoadDistanceInMeters(
          targetLocation.latitude,
          targetLocation.longitude,
          coordinates.latitude,
          coordinates.longitude,
        );

        openReasonModal(
          "checkout",
          location,
          coordinates,
          Math.round(roadDistance),
        );

        return;
      }

      // =====================================================
      // CHECK OUT (OVERNIGHT CHECK)
      // =====================================================
      const checkInDateObj = record?.checkIn ? new Date(record.checkIn) : null;
      const todayDateKey = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

      const checkInDateKey = checkInDateObj
        ? new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(checkInDateObj)
        : todayDateKey;

      const checkInTimeStr = checkInDateObj
        ? checkInDateObj.toLocaleTimeString("en-GB", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
        : "10:00";

      const currentTimeStr = new Date().toLocaleTimeString("en-GB", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      const isCrossDay = checkInDateKey < todayDateKey;
      const isEarlierTime = currentTimeStr < checkInTimeStr;

      if (isCrossDay || isEarlierTime) {
        setOvernightModal({
          isOpen: true,
          checkInTime: checkInTimeStr,
          checkOutTime: currentTimeStr,
          checkInDate: checkInDateKey,
          checkOutDate: todayDateKey,
          location,
          reason: "",
          submitting: false,
        });
        return;
      }

      await executeCheckOut(location, "");
    } catch (err) {
      toast.error(err.message || "Check-out failed.");
    } finally {
      setCheckingOut(false);
      setCapturingLocation(false);
    }
  };
  // =======================================================
  // FORGOT PUNCH STATUS
  // =======================================================

  const correctionStatus = correctionRequest?.status || null;

  // =======================================================
  // FORGOT PUNCH TIME
  // =======================================================

  const getForgotPunchData = (request) => {
    if (!request?.description) return null;

    try {
      const description = String(request.description);

      const match = description.match(
        /\[ATTENDANCE_CORRECTION\]\s*(\{[\s\S]*\})\s*$/,
      );

      if (!match?.[1]) return null;

      return JSON.parse(match[1]);
    } catch (error) {
      console.error("Failed to parse Forgot Punch request:", error);

      return null;
    }
  };

  const formatManualPunchTime = (time, dateStr = null) => {
    if (!time) return null;

    const [hours, minutes] = String(time).split(":").map(Number);

    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      return null;
    }

    let date;
    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      date = new Date(`${dateStr}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`);
    } else {
      date = new Date();
      date.setHours(hours, minutes, 0, 0);
    }

    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };
  const getManualPunchDate = (time, dateStr = null) => {
    if (!time) return null;

    const [hours, minutes] = String(time).split(":").map(Number);

    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      return null;
    }

    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return new Date(`${dateStr}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00+05:30`);
    }

    const date = new Date();
    date.setHours(hours, minutes, 0, 0);

    return date;
  };

  const todayDateKey = getIndiaDateKey(now);

  const forgotPunchData = getForgotPunchData(correctionRequest);

  const forgotPunchCheckIn = formatManualPunchTime(
    forgotPunchData?.checkInTime,
    forgotPunchData?.date,
  );

  const forgotPunchCheckOut = formatManualPunchTime(
    forgotPunchData?.checkOutTime,
    forgotPunchData?.date,
  );

  const isCorrectionPending = correctionStatus === "PENDING";
  const isCorrectionApproved = correctionStatus === "APPROVED";
  const isCorrectionRejected = correctionStatus === "REJECTED";

  const isTimeEditMode = forgotPunchData?.punchType === "time-edit";

  const isOnLeaveToday = record?.status === "ON_LEAVE" || !!approvedLeave;

  // =======================================================
  // ATTENDANCE STATE
  // =======================================================

  // Normal attendance check-in OR Pending Check-In (Forgot Punch or Time-Edit with checkInTime)
  const hasCheckedIn =
    !!record?.checkIn ||
    (isCorrectionPending && !!forgotPunchCheckIn);

  // Normal attendance checkout OR Pending Check-Out (Forgot Punch or Time-Edit with checkOutTime)
  const hasCheckedOut = !!record?.checkOut || !!forgotPunchCheckOut;

  // =======================================================
  // BUTTON RULES
  // =======================================================

  /*
   * CHECK IN
   */

  const isUnclosedPreviousCorrectionPending =
    !!unclosedPrevious?.record && unclosedPrevious.correctionRequest?.status === "PENDING";

  const hasUnclosedPreviousMissingCheckout =
    !!unclosedPrevious?.record &&
    (!unclosedPrevious.correctionRequest ||
      (unclosedPrevious.correctionRequest.status !== "APPROVED" &&
        unclosedPrevious.correctionRequest.status !== "PENDING"));

  const canCheckIn =
    !hasCheckedIn &&
    !isCorrectionPending &&
    !isCorrectionApproved &&
    !isOnLeaveToday &&
    !hasUnclosedPreviousMissingCheckout;

  /*
   * CHECK OUT
   * Allowed when:
   * 1. Already checked in (normal GPS or unassigned location check-in even if pending admin approval)
   * 2. Or Forgot Punch / Time Edit check-in request is PENDING
   * And not already checked out.
   */

  const canCheckOut =
    (hasCheckedIn || (isCorrectionPending && !!forgotPunchCheckIn)) &&
    !hasCheckedOut &&
    !isCorrectionRejected &&
    !isOnLeaveToday;

  // =======================================================
  // STATUS BADGE
  // =======================================================

  const requestStatusMeta = correctionStatus
    ? REQUEST_STATUS_META[correctionStatus]
    : null;

  const statusMeta = requestStatusMeta
    ? requestStatusMeta
    : record
      ? (STATUS_META[record.status] ?? STATUS_META.PRESENT)
      : null;

  // =======================================================
  // WORKED TIME
  // =======================================================

  const normalCheckInDate = record?.checkIn ? new Date(record.checkIn) : null;

  const forgotPunchCheckInDate = isCorrectionPending
    ? getManualPunchDate(forgotPunchData?.checkInTime, forgotPunchData?.date)
    : null;

  const effectiveCheckInDate = normalCheckInDate || forgotPunchCheckInDate;

  const workedMs = effectiveCheckInDate
    ? record?.checkOut
      ? new Date(record.checkOut).getTime() - effectiveCheckInDate.getTime()
      : now.getTime() - effectiveCheckInDate.getTime()
    : 0;
  const workedH = Math.floor(workedMs / (1000 * 60 * 60));

  const workedM = Math.floor((workedMs % (1000 * 60 * 60)) / (1000 * 60));

  const workedS = Math.floor((workedMs % (1000 * 60)) / 1000);

  if (!hasModuleAccess("mark-attendance")) {
    return (
      <div className="p-8 text-center max-w-md mx-auto my-12 bg-card rounded-2xl border border-border shadow-sm">
        <ShieldAlert className="h-12 w-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Access Restricted</h2>
        <p className="text-sm text-muted-foreground mb-6">
          You do not have permission to access the Mark Attendance module. Please contact your system administrator to assign this role capability.
        </p>
        <button
          type="button"
          onClick={() => navigate("/employee")}
          className="px-4 py-2 bg-primary text-white font-medium rounded-xl text-sm hover:bg-primary/90 transition-colors"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  // =======================================================
  // UI
  // =======================================================

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* =================================================
          HEADER
      ================================================= */}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Fingerprint className="h-6 w-6 text-primary" />
          </div>

          <div>
            <h1 className="font-display text-2xl font-bold">Mark Attendance</h1>

            <p className="text-sm text-muted-foreground">
              Check in and out for today.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/employee/requests/forgot-punch")}
            className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold px-4 py-2 flex items-center gap-2 transition-all hover:shadow-md active:scale-[0.99] text-sm"
          >
            <Clock className="h-4 w-4" />
            <span>Forgot Punch / Time Edit</span>
          </button>

          <button
            type="button"
            onClick={() => loadToday()}
            disabled={loading}
            className="p-2 rounded-lg border border-border hover:bg-secondary transition-colors text-muted-foreground disabled:opacity-60"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* =================================================
          POLICY
      ================================================= */}

      <div className="rounded-2xl bg-secondary/50 border border-border p-4 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">Attendance policy</p>

        <p className="mt-1">Attendance tracking is enabled.</p>
      </div>

      {/* =================================================
          LIVE CLOCK
      ================================================= */}

      <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20 p-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Calendar className="h-4 w-4 text-muted-foreground" />

          <span className="text-sm text-muted-foreground">{fmtDate(now)}</span>
        </div>

        <div className="font-display text-5xl font-bold tracking-tight text-primary">
          {now.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          })}
        </div>
      </div>

      {/* =================================================
          ATTENDANCE CARD
      ================================================= */}

      {loading ? (
        <div className="rounded-2xl bg-background border border-border p-10 flex items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : (
        <div className="rounded-2xl bg-background border border-border card-shadow p-6 space-y-5">
          {/* STATUS */}

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-base font-semibold">
                {forgotPunchData?.date && forgotPunchData.date !== todayDateKey
                  ? `Attendance (${forgotPunchData.date})`
                  : "Today's Attendance"}
              </h2>
            </div>

            {statusMeta && (
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${statusMeta.bg} ${statusMeta.text}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`}
                />

                {statusMeta.label}
              </span>
            )}
          </div>

          {/* =================================================
              ON LEAVE TODAY
          ================================================= */}

          {isOnLeaveToday && (
            <div className="rounded-xl border border-purple-200 bg-purple-50 dark:border-purple-900/40 dark:bg-purple-950/30 px-4 py-3.5 text-sm text-purple-900 dark:text-purple-200">
              <div className="flex items-center gap-2 font-bold text-base text-purple-800 dark:text-purple-300">
                <Calendar className="h-5 w-5 text-purple-600" />
                On Leave Today ({approvedLeave?.leaveType?.name || record?.note?.replace("Approved leave: ", "") || "Approved Leave"})
              </div>
              <div className="mt-1 text-xs text-purple-700 dark:text-purple-300">
                Your leave application is approved. Attendance check-in and check-out are frozen for today.
              </div>
            </div>
          )}

          {/* =================================================
              UNCLOSED PREVIOUS DAY PUNCH ALERT (YESTERDAY)
          ================================================= */}

          {hasUnclosedPreviousMissingCheckout && !isUnclosedPreviousCorrectionPending && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-900/50 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold shrink-0 mt-0.5">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-sm text-amber-900 dark:text-amber-200">
                    Missing Check-Out ({fmtDate(unclosedPrevious.record.date)})
                  </h3>
                  <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
                    You checked in on <strong>{fmtDate(unclosedPrevious.record.date)}</strong> at <strong>{fmtTime(unclosedPrevious.record.checkIn)}</strong> but forgot to check out. Please complete that day's check-out request first.
                  </p>
                  {unclosedPrevious.correctionRequest?.status === "REJECTED" && (
                    <p className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                      Previous request was rejected: {unclosedPrevious.correctionRequest.reviewNote || "Rejected by Admin"}. Please submit a corrected check-out request.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/employee/requests/forgot-punch?date=${unclosedPrevious.record.dateKey}&punchType=check-out`,
                      {
                        state: {
                          date: unclosedPrevious.record.dateKey,
                          punchType: "check-out",
                        },
                      }
                    )
                  }
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-sm transition-all"
                >
                  <ScanLine className="h-3.5 w-3.5" />
                  <span>
                    Complete Check-Out ({unclosedPrevious.record.dateKey})
                  </span>
                </button>
              </div>
            </div>
          )}

          {isUnclosedPreviousCorrectionPending && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-900/50 px-4 py-3 flex items-center gap-3 text-xs text-blue-900 dark:text-blue-200">
              <Clock className="h-4 w-4 text-blue-600 shrink-0" />
              <div>
                <span className="font-bold">Previous Check-Out Under Review (Pending):</span> Your check-out request for {fmtDate(unclosedPrevious.record.date)} is waiting for admin approval. You can proceed to check in for today below.
              </div>
            </div>
          )}

          {/* =================================================
              PENDING
          ================================================= */}

          {isCorrectionPending && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <div className="flex items-center gap-2 font-semibold">
                <Clock className="h-4 w-4" />
                {isTimeEditMode ? "Time Edit request is pending" : "Forgot Punch request is pending"}
              </div>

              <div className="mt-1">
                Your requested Check In time ({forgotPunchCheckIn || "Pending"}{forgotPunchData?.date && forgotPunchData.date !== todayDateKey ? ` on ${forgotPunchData.date}` : ""}) is waiting for admin approval.
                <br />
                <strong>You can Check Out below while the request is pending.</strong>
              </div>
            </div>
          )}

          {/* =================================================
              APPROVED
          ================================================= */}

          {isCorrectionApproved && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-4 w-4" />
                Forgot Punch request approved
              </div>

              <div className="mt-1">
                Your corrected attendance time is now active.
                <br />
                You can check out normally.
              </div>
            </div>
          )}

          {/* =================================================
              REJECTED
          ================================================= */}

          {isCorrectionRejected && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
              <div className="flex items-center gap-2 font-bold">
                <LogOut className="h-4 w-4 text-rose-600" />
                Forgot Punch request rejected
              </div>

              <div className="mt-1">
                The corrected Check In was not approved by Admin.
                <br />
                Your original attendance remains unchanged.
              </div>

              {correctionRequest?.reviewNote && (
                <div className="mt-2.5 border-t border-rose-200/80 pt-2 font-medium dark:border-rose-800/40">
                  <span className="font-bold">❌ Admin Rejection Reason:</span>{" "}
                  {correctionRequest.reviewNote}
                </div>
              )}
            </div>
          )}

          {/* =================================================
              TIME TILES
          ================================================= */}

          <div className="grid grid-cols-2 gap-4">
            {/* CHECK IN */}

            <div
              className={`rounded-xl p-4 border ${
                hasCheckedIn
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-dashed border-border bg-secondary/20"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <LogIn
                  className={`h-4 w-4 ${
                    hasCheckedIn ? "text-emerald-600" : "text-muted-foreground"
                  }`}
                />

                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Check In
                </span>
              </div>

              <div
                className={`font-display text-2xl font-bold ${
                  hasCheckedIn ? "text-emerald-700" : "text-muted-foreground/40"
                }`}
              >
                {hasCheckedIn
                  ? record?.checkIn
                    ? fmtTime(record.checkIn)
                    : forgotPunchCheckIn || "—"
                  : "—"}
              </div>
              {hasCheckedIn && (() => {
                const checkInDateObj = record?.checkIn ? new Date(record.checkIn) : null;
                const checkInDateKey = checkInDateObj ? getIndiaDateKey(checkInDateObj) : forgotPunchData?.date;
                const checkOutDateObj = record?.checkOut ? new Date(record.checkOut) : null;
                const checkOutDateKey = checkOutDateObj ? getIndiaDateKey(checkOutDateObj) : forgotPunchData?.checkOutDate;
                const isOvernight =
                  (checkInDateKey && checkInDateKey !== todayDateKey) ||
                  (checkInDateKey && checkOutDateKey && checkInDateKey !== checkOutDateKey);

                if (isOvernight && checkInDateKey) {
                  return (
                    <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-emerald-700">
                      <Calendar className="h-3 w-3" />
                      <span>{fmtDate(checkInDateKey)}</span>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            {/* CHECK OUT */}

            <div
              className={`rounded-xl p-4 border ${
                hasCheckedOut
                  ? "border-rose-200 bg-rose-50"
                  : "border-dashed border-border bg-secondary/20"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <LogOut
                  className={`h-4 w-4 ${
                    hasCheckedOut ? "text-rose-600" : "text-muted-foreground"
                  }`}
                />

                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Check Out
                </span>
              </div>

              <div
                className={`font-display text-2xl font-bold ${
                  hasCheckedOut ? "text-rose-700" : "text-muted-foreground/40"
                }`}
              >
                {hasCheckedOut
                  ? record?.checkOut
                    ? fmtTime(record.checkOut)
                    : forgotPunchCheckOut
                      ? forgotPunchCheckOut
                      : "—"
                  : "—"}
              </div>
              {hasCheckedOut && (() => {
                const checkOutDateObj = record?.checkOut ? new Date(record.checkOut) : null;
                const checkOutDateKey = checkOutDateObj ? getIndiaDateKey(checkOutDateObj) : forgotPunchData?.checkOutDate;
                const checkInDateObj = record?.checkIn ? new Date(record.checkIn) : null;
                const checkInDateKey = checkInDateObj ? getIndiaDateKey(checkInDateObj) : forgotPunchData?.date;
                const isOvernight = checkInDateKey && checkOutDateKey && checkInDateKey !== checkOutDateKey;

                if (isOvernight && checkOutDateKey) {
                  return (
                    <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-rose-700">
                      <Calendar className="h-3 w-3" />
                      <span>{fmtDate(checkOutDateKey)}</span>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>

          {/* =================================================
              WORKED HOURS
          ================================================= */}

          {hasCheckedIn && (
            <div className="rounded-xl bg-secondary/40 border border-border px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />

                {hasCheckedOut ? "Total worked" : "Time elapsed"}
              </div>

              <div className="font-display text-lg font-bold tabular-nums">
                {String(workedH).padStart(2, "0")}h{" "}
                {String(workedM).padStart(2, "0")}m{" "}
                {!hasCheckedOut && (
                  <span className="text-muted-foreground text-sm">
                    {String(workedS).padStart(2, "0")}s
                  </span>
                )}
              </div>
            </div>
          )}

          {/* =================================================
              ACTION BUTTONS
          ================================================= */}

          <div className="grid grid-cols-2 gap-3">
            {/* =================================================
                CHECK IN BUTTON
            ================================================= */}

            <button
              type="button"
              onClick={canCheckIn ? handleCheckIn : undefined}
              disabled={!canCheckIn || checkingIn || capturingLocation}
              className={`
                w-full h-12
                rounded-xl
                flex items-center
                justify-center
                gap-2
                text-sm
                font-semibold
                transition-all
                duration-200
                focus:outline-none

                ${
                  isOnLeaveToday
                    ? "bg-purple-100 text-purple-700 border border-purple-200 cursor-not-allowed"
                    : hasUnclosedPreviousMissingCheckout
                      ? "bg-amber-100 text-amber-800 border border-amber-300 cursor-not-allowed"
                      : hasCheckedIn
                        ? "bg-emerald-500 text-white cursor-not-allowed"
                        : isCorrectionPending
                          ? "bg-amber-100 text-amber-700 border border-amber-200 cursor-not-allowed"
                          : isCorrectionApproved
                            ? "bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-not-allowed"
                            : "bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 hover:shadow-md active:scale-[0.99]"
                }

                disabled:opacity-70
                disabled:cursor-not-allowed
              `}
            >
              {checkingIn || capturingLocation ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />

                  <span>Getting Location...</span>
                </>
              ) : isOnLeaveToday ? (
                <>
                  <Calendar className="h-5 w-5 text-purple-600" />

                  <span>On Leave Today</span>
                </>
              ) : hasUnclosedPreviousMissingCheckout ? (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-600" />

                  <span>Previous Attendance Incomplete</span>
                </>
              ) : hasCheckedIn ? (
                <>
                  <CheckCircle2 className="h-5 w-5" />

                  <span>
                    Check In •{" "}
                    {record?.checkIn
                      ? fmtTime(record.checkIn)
                      : forgotPunchCheckIn || "Pending"}
                  </span>
                </>
              ) : isCorrectionPending ? (
                <>
                  <Clock className="h-5 w-5" />

                  <span>Check In • Pending</span>
                </>
              ) : isCorrectionApproved ? (
                <>
                  <CheckCircle2 className="h-5 w-5" />

                  <span>Check In Approved</span>
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5" />

                  <span>Check In</span>
                </>
              )}
            </button>

            {/* =================================================
                CHECK OUT BUTTON
            ================================================= */}

            <button
              type="button"
              onClick={canCheckOut ? handleCheckOut : undefined}
              disabled={!canCheckOut || checkingOut || capturingLocation}
              className={`
                w-full h-12
                rounded-xl
                flex items-center
                justify-center
                gap-2
                text-sm
                font-semibold
                transition-all
                duration-200
                focus:outline-none

                ${
                  isOnLeaveToday
                    ? "bg-purple-50 border border-purple-200 text-purple-400 cursor-not-allowed"
                    : hasCheckedOut
                      ? "bg-rose-100 border border-rose-200 text-rose-700 cursor-not-allowed"
                      : isCorrectionRejected
                        ? "bg-secondary/40 border border-border text-muted-foreground cursor-not-allowed"
                        : isCorrectionPending
                          ? "bg-rose-600 text-white hover:bg-rose-700 hover:shadow-md active:scale-[0.99]"
                          : isCorrectionApproved
                            ? "bg-rose-600 text-white hover:bg-rose-700 hover:shadow-md active:scale-[0.99]"
                            : canCheckOut
                              ? "bg-rose-600 text-white hover:bg-rose-700 hover:shadow-md active:scale-[0.99]"
                              : "bg-secondary/40 border border-border text-muted-foreground"
                }

                disabled:opacity-70
                disabled:cursor-not-allowed
              `}
            >
              {checkingOut || capturingLocation ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />

                  <span>Getting Location...</span>
                </>
              ) : isOnLeaveToday ? (
                <>
                  <Calendar className="h-5 w-5 text-purple-400" />

                  <span>On Leave</span>
                </>
              ) : hasCheckedOut ? (
                <>
                  <CheckCircle2 className="h-5 w-5" />

                  <span>
                    Check Out •{" "}
                    {record?.checkOut
                      ? fmtTime(record.checkOut)
                      : forgotPunchCheckOut || "—"}
                  </span>
                </>
              ) : isCorrectionRejected ? (
                <>
                  <LogOut className="h-5 w-5" />

                  <span>Check Out Closed</span>
                </>
              ) : (
                <>
                  <LogOut className="h-5 w-5" />

                  <span>Check Out</span>
                </>
              )}
            </button>
          </div>

          {/* =================================================
              COMPLETE
          ================================================= */}

          {hasCheckedIn && hasCheckedOut && (
            <div className="w-full rounded-xl bg-emerald-50 border border-emerald-200 py-3 flex items-center justify-center gap-2 text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
              Attendance marked for today
            </div>
          )}
        </div>
      )}

      {/* =====================================================
          LOCATION REASON MODAL
      ===================================================== */}

      {reasonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-card text-card-foreground p-6 shadow-2xl border border-border">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-xl font-bold text-foreground">
                  {reasonModal.type === "checkin"
                    ? "Check-in reason"
                    : "Check-out reason"}
                </h3>

                <p className="mt-1 text-sm text-muted-foreground">
                  You are checking{" "}
                  {reasonModal.type === "checkin" ? "in" : "out"} away from your
                  assigned or default location.
                </p>
              </div>

              <button
                type="button"
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
                  <span className="ml-2">
                    (
                    {reasonModal.distanceMeters >= 1000
                      ? `${(reasonModal.distanceMeters / 1000).toFixed(2)} km away`
                      : `${Math.round(reasonModal.distanceMeters)} m away`}
                    )
                  </span>
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
                type="button"
                onClick={() => {
                  setReasonModal(null);

                  setReasonText("");
                }}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-secondary"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={submitReasonedAttendance}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          OVERNIGHT SHIFT CONFIRMATION & TIME CHANGE MODAL
      ===================================================== */}
      {overnightModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500 shrink-0">
                <Moon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  Overnight Shift Punch
                </h3>
                <p className="text-xs text-muted-foreground">
                  Check-out is on the next day / crossing midnight.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-indigo-200/50 bg-indigo-50/60 dark:border-indigo-900/50 dark:bg-indigo-950/30 p-3.5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 text-foreground">
                <div className="p-2.5 rounded-lg bg-background/80 border border-border/60">
                  <span className="text-[11px] text-muted-foreground block font-medium">Check-In ({overnightModal.checkInDate})</span>
                  <span className="font-bold text-sm text-foreground mt-0.5 block">{formatTime12h(overnightModal.checkInTime)}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-background/80 border border-border/60">
                  <label htmlFor="overnight-checkout-date" className="text-[11px] text-muted-foreground block font-medium cursor-pointer">
                    Check-Out Date
                  </label>
                  <input
                    id="overnight-checkout-date"
                    type="date"
                    value={overnightModal.checkOutDate}
                    min={overnightModal.checkInDate || undefined}
                    disabled={overnightModal.submitting}
                    onChange={(e) =>
                      setOvernightModal((prev) => ({
                        ...prev,
                        checkOutDate: e.target.value,
                      }))
                    }
                    className="w-full mt-0.5 font-bold text-sm text-indigo-600 dark:text-indigo-400 bg-transparent border-0 p-0 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Time Change Selector in Modal */}
              <div className="p-3 rounded-lg bg-background border border-border/70 space-y-2">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-indigo-500" />
                  <span>Adjust Check-out Time</span>
                </label>
                <TimePicker12h
                  value={overnightModal.checkOutTime}
                  disabled={overnightModal.submitting}
                  onChange={(newTime) =>
                    setOvernightModal((prev) => ({
                      ...prev,
                      checkOutTime: newTime,
                    }))
                  }
                />
              </div>

              <p className="text-indigo-900 dark:text-indigo-200 leading-relaxed">
                Confirm your check-out time for this overnight shift ending on <strong>{overnightModal.checkOutDate}</strong>.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={overnightModal.submitting}
                onClick={() =>
                  setOvernightModal({
                    isOpen: false,
                    checkInTime: "",
                    checkOutTime: "",
                    checkInDate: "",
                    checkOutDate: "",
                    location: null,
                    reason: "",
                    submitting: false,
                  })
                }
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={overnightModal.submitting}
                onClick={async () => {
                  if (overnightModal.checkInDate && overnightModal.checkInTime && overnightModal.checkOutDate && overnightModal.checkOutTime) {
                    const startMs = new Date(`${overnightModal.checkInDate}T${overnightModal.checkInTime}:00+05:30`).getTime();
                    const endMs = new Date(`${overnightModal.checkOutDate}T${overnightModal.checkOutTime}:00+05:30`).getTime();
                    const diffHours = (endMs - startMs) / 3600000;

                    if (diffHours <= 0) {
                      toast.error("Check-out time must be after check-in time.");
                      return;
                    }

                    if (diffHours > 24) {
                      toast.error(`Check-out cannot exceed 24 hours from check-in (${diffHours.toFixed(1)}h selected).`);
                      return;
                    }
                  }

                  setOvernightModal((prev) => ({ ...prev, submitting: true }));
                  try {
                    await executeCheckOut(
                      overnightModal.location,
                      overnightModal.reason,
                      overnightModal.checkOutTime,
                      overnightModal.checkOutDate,
                    );
                    setOvernightModal({
                      isOpen: false,
                      checkInTime: "",
                      checkOutTime: "",
                      checkInDate: "",
                      checkOutDate: "",
                      location: null,
                      reason: "",
                      submitting: false,
                    });
                  } catch (err) {
                    toast.error(err.message || "Failed to submit check-out.");
                    setOvernightModal((prev) => ({ ...prev, submitting: false }));
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-sm disabled:opacity-50"
              >
                <Moon className="h-3.5 w-3.5" />
                {overnightModal.submitting ? "Submitting..." : "Confirm & Check Out"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarkAttendance;
