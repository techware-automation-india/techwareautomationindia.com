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
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../lib/api.js";
import { getAuthUser } from "../../lib/auth.js";

// =========================================================
// HELPERS
// =========================================================

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

const getDistanceInMeters = (lat1, lon1, lat2, lon2) => {
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
      // FIND TODAY'S CORRECTION
      // -----------------------------------------------

      const todayCorrection =
        requests
          .filter((request) => request?.type === "CORRECTION")
          .filter((request) => {
            const description = String(request.description || "");

            const match = description.match(
              /"date"\s*:\s*"?(\d{4}-\d{2}-\d{2})/,
            );

            return match?.[1] === todayKey;
          })
          .sort(
            (a, b) =>
              new Date(b.createdAt || 0).getTime() -
              new Date(a.createdAt || 0).getTime(),
          )[0] || null;

      setCorrectionRequest(todayCorrection);
    } catch (err) {
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
        const data = await apiPost("/attendance/checkout", payload);

        setRecord(data.record);

        await loadToday(false);

        toast.success(data.message || "Checked out successfully!");
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

      const distanceMeters = getDistanceInMeters(
        targetLocation.latitude,
        targetLocation.longitude,
        coordinates.latitude,
        coordinates.longitude,
      );

      if (distanceMeters > (targetLocation.radius ?? 50)) {
        openReasonModal(
          "checkin",
          location,
          coordinates,
          Math.round(distanceMeters),
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

      const distanceMeters = getDistanceInMeters(
        targetLocation.latitude,
        targetLocation.longitude,
        coordinates.latitude,
        coordinates.longitude,
      );

      // =====================================================
      // OUTSIDE ASSIGNED RADIUS
      // =====================================================

      if (distanceMeters > (targetLocation.radius ?? 50)) {
        openReasonModal(
          "checkout",
          location,
          coordinates,
          Math.round(distanceMeters),
        );

        return;
      }

      // =====================================================
      // CHECK OUT
      // IMPORTANT:
      // Send normal location even when Forgot Punch
      // request is PENDING.
      // =====================================================

      const data = await apiPost("/attendance/checkout", {
        location,
      });

      setRecord(data.record ?? null);

      await loadToday(false);

      toast.success(data.message || "Checked out successfully!");
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

  const formatManualPunchTime = (time) => {
    if (!time) return null;

    const [hours, minutes] = String(time).split(":").map(Number);

    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      return null;
    }

    const date = new Date();

    date.setHours(hours, minutes, 0, 0);

    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };
  const getManualPunchDate = (time) => {
    if (!time) return null;

    const [hours, minutes] = String(time).split(":").map(Number);

    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      return null;
    }

    const date = new Date();
    date.setHours(hours, minutes, 0, 0);

    return date;
  };

  const forgotPunchData = getForgotPunchData(correctionRequest);

  const forgotPunchCheckIn = formatManualPunchTime(
    forgotPunchData?.checkInTime,
  );

  const forgotPunchCheckOut = formatManualPunchTime(
    forgotPunchData?.checkOutTime,
  );

  const isCorrectionPending = correctionStatus === "PENDING";

  const isCorrectionApproved = correctionStatus === "APPROVED";

  const isCorrectionRejected = correctionStatus === "REJECTED";

  // =======================================================
  // ATTENDANCE STATE
  // =======================================================

  // Normal attendance check-in OR Forgot Punch check-in
  const hasCheckedIn =
    !!record?.checkIn || (isCorrectionPending && !!forgotPunchCheckIn);

  // Normal attendance checkout OR Forgot Punch checkout
  const hasCheckedOut = !!record?.checkOut || !!forgotPunchCheckOut;

  // =======================================================
  // BUTTON RULES
  // =======================================================

  /*
   * CHECK IN
   *
   * Existing attendance:
   * CLOSED
   *
   * Pending request:
   * CLOSED
   *
   * Approved request:
   * CLOSED
   *
   * Rejected request without attendance:
   * OPEN
   */

  const canCheckIn =
    !hasCheckedIn && !isCorrectionPending && !isCorrectionApproved;

  /*
   * CHECK OUT
   *
   * Normal checked-in:
   * OPEN
   *
   * Pending:
   * OPEN
   *
   * Approved:
   * OPEN
   *
   * Rejected:
   * CLOSED
   */

  const canCheckOut =
    (hasCheckedIn || (isCorrectionPending && !!forgotPunchCheckIn)) &&
    !hasCheckedOut &&
    !isCorrectionRejected;

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
    ? getManualPunchDate(forgotPunchData?.checkInTime)
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

      {/* =================================================
          POLICY
      ================================================= */}

      <div className="rounded-2xl bg-secondary/50 border border-border p-4 text-sm text-muted-foreground">
        <p className="font-semibold text-slate-900">Attendance policy</p>

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

          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">
              Today's Attendance
            </h2>

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
              PENDING
          ================================================= */}

          {isCorrectionPending && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <div className="flex items-center gap-2 font-semibold">
                <Clock className="h-4 w-4" />
                Forgot Punch request is pending
              </div>

              <div className="mt-1">
                Your requested Check In time is waiting for admin approval.
                <br />
                Check Out is available while the request is pending.
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
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <div className="flex items-center gap-2 font-semibold">
                <LogOut className="h-4 w-4" />
                Forgot Punch request rejected
              </div>

              <div className="mt-1">
                The corrected Check In was not approved.
                <br />
                Your original attendance remains unchanged.
              </div>
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
                  hasCheckedIn
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
                  hasCheckedOut
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
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-border">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-xl font-bold text-slate-900">
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
    </div>
  );
};

export default MarkAttendance;
