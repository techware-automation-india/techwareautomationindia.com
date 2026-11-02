import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, Send, AlertCircle, ShieldAlert, Clock, Moon } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../lib/api.js";
import { hasModuleAccess } from "../../lib/permissions.js";

const getIndiaNow = () => {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type) => parts.find((part) => part.type === type)?.value;

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
};

const getIndiaMaxTime = () => {
  const now = getIndiaNow();

  const [hours, minutes] = now.time.split(":").map(Number);

  const totalMinutes = hours * 60 + minutes - 1;

  const maxMinutes = Math.max(0, totalMinutes);

  const maxHours = Math.floor(maxMinutes / 60);
  const maxMins = maxMinutes % 60;

  return `${String(maxHours).padStart(2, "0")}:${String(maxMins).padStart(2, "0")}`;
};

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

const getForgotPunchData = (request) => {
  if (request?.type !== "CORRECTION") return null;

  const notification = request.notification || null;
  const description = String(request.description || "");
  const marker = "[ATTENDANCE_CORRECTION]";
  const markerIndex = description.lastIndexOf(marker);
  if (markerIndex === -1) return notification;

  try {
    return {
      ...(notification || {}),
      ...JSON.parse(description.slice(markerIndex + marker.length).trim()),
    };
  } catch (error) {
    console.warn("Could not parse Forgot Punch request details:", error);
    return notification;
  }
};

// Convert 24-hour "HH:mm" to 12-hour object { hour12: "10", minute: "00", ampm: "AM" }
const parse24to12 = (time24) => {
  if (!time24) return { hour12: "10", minute: "00", ampm: "AM" };
  const [hStr, mStr] = String(time24).split(":");
  let h = Number(hStr) || 0;
  const m = String(Number(mStr) || 0).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = String(h % 12 || 12);
  return { hour12, minute: m, ampm };
};

// Convert 12-hour values back to 24-hour "HH:mm"
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

// 12-Hour Time Picker Component (Hour, Minute, AM/PM dropdowns + badge)
const TimePicker12h = ({ value, onChange, disabled = false, idPrefix = "tp" }) => {
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
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background p-1.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
        {/* Hour (1 - 12) */}
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

        {/* Minute (00 - 59) */}
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

        {/* AM / PM Toggle buttons */}
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

      {/* 12-Hour formatted badge */}
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-bold tracking-wide">
        <Clock className="h-3 w-3" />
        {formatTime12h(value)}
      </span>
    </div>
  );
};

const AttendanceCorrection = ({ correctionType }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialDate = searchParams.get("date") || location.state?.date;
  const initialPunchType = searchParams.get("punchType") || location.state?.punchType;
  const initialMode =
    searchParams.get("mode") === "time-edit" || location.state?.mode === "time-edit"
      ? "time-edit"
      : "forgot-punch";

  const [requestMode, setRequestMode] = useState(initialMode);
  const [indiaNow, setIndiaNow] = useState(getIndiaNow);
  const [punchType, setPunchType] = useState(initialPunchType || correctionType || "check-in");
  const label = requestMode === "time-edit" ? "Time Edit Request" : "Forgot Punch";
  const punchLabel =
    punchType === "check-in"
      ? "Check In"
      : punchType === "check-out"
        ? "Check Out"
        : "Check In and Check Out";
  const [date, setDate] = useState(initialDate || indiaNow.date);
  const [checkOutDate, setCheckOutDate] = useState(initialDate || indiaNow.date);
  const [time, setTime] = useState(indiaNow.time);
  const [checkOutTime, setCheckOutTime] = useState(indiaNow.time);
  const [reason, setReason] = useState("");
  const [checkInLocation, setCheckInLocation] = useState("");
  const [checkOutLocation, setCheckOutLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [existingAttendance, setExistingAttendance] = useState(null);
  const [forgotPunchCheckIn, setForgotPunchCheckIn] = useState(null);
  const [loadingForgotPunchCheckIn, setLoadingForgotPunchCheckIn] = useState(true);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [approvedLeaves, setApprovedLeaves] = useState([]);
  const [unclosedPrevious, setUnclosedPrevious] = useState(null);
  const [loadingUnclosedPrevious, setLoadingUnclosedPrevious] = useState(true);
  const [overnightModal, setOvernightModal] = useState({
    isOpen: false,
    checkInTime: "",
    checkOutTime: "",
    checkInDate: "",
    checkOutDate: "",
  });

  const getNextDayDateStr = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(`${dateStr}T12:00:00+05:30`);
    d.setDate(d.getDate() + 1);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${yr}-${mo}-${da}`;
  };

  // Fetch existing attendance record and times for selected date
  useEffect(() => {
    let isMounted = true;
    const fetchExisting = async () => {
      if (!date) return;
      try {
        setLoadingExisting(true);
        setLoadingForgotPunchCheckIn(true);
        const [attendanceResult, requestsResult, todayAttendanceResult] = await Promise.allSettled([
          apiGet(`/attendance/by-date?date=${encodeURIComponent(date)}`),
          apiGet("/requests/my"),
          date === indiaNow.date
            ? apiGet("/attendance/me/today")
            : Promise.resolve(null),
        ]);
        if (!isMounted) return;
        let attendanceRecord =
          attendanceResult.status === "fulfilled"
            ? attendanceResult.value
            : null;
        if (
          !attendanceRecord?.record?.checkInTime &&
          todayAttendanceResult.status === "fulfilled" &&
          todayAttendanceResult.value?.record?.checkIn
        ) {
          const todayRecord = todayAttendanceResult.value.record;
          const formatTimeInIndia = (value) =>
            value
              ? new Intl.DateTimeFormat("en-GB", {
                  timeZone: "Asia/Kolkata",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                }).format(new Date(value))
              : null;
          const todayRecordCheckInDate = todayRecord.checkIn
            ? new Intl.DateTimeFormat("en-CA", {
                timeZone: "Asia/Kolkata",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              }).format(new Date(todayRecord.checkIn))
            : null;
          if (todayRecordCheckInDate && todayRecordCheckInDate !== date) {
            setDate(todayRecordCheckInDate);
            setCheckOutDate(indiaNow.date);
            setPunchType("check-out");
          }
          attendanceRecord = {
            ...(attendanceRecord || {}),
            record: {
              ...todayRecord,
              checkInTime:
                todayRecord.checkInTime ||
                formatTimeInIndia(todayRecord.checkIn),
              checkOutTime:
                todayRecord.checkOutTime ||
                formatTimeInIndia(todayRecord.checkOut),
            },
          };
        }
        if (attendanceRecord) {
          setExistingAttendance(attendanceRecord);
        } else {
          setExistingAttendance(null);
          if (attendanceResult.status === "rejected") {
            console.warn(
              "Failed to fetch saved attendance:",
              attendanceResult.reason?.message || attendanceResult.reason,
            );
          }
        }

        if (requestsResult.status === "fulfilled") {
          const correctionRequests = (requestsResult.value?.requests || [])
            .filter((request) =>
              ["PENDING", "APPROVED"].includes(
                String(request.status || "").toUpperCase(),
              ),
            )
            .map((request) => ({
              request,
              correction: getForgotPunchData(request),
            }))
            .filter(({ request, correction }) => {
              const requestDetails = correction || request.notification || {};
              const punchType = String(requestDetails.punchType || "").toLowerCase();
              const subject = String(request.subject || "").toLowerCase();
              const description = String(request.description || "").toLowerCase();
              const isLocationApproval =
                subject.includes("approval") ||
                description.includes("unassigned location") ||
                description.includes("outside assigned location");
              const isCheckInApproval =
                ["check-in", "both"].includes(punchType) &&
                (subject.includes("check-in approval") ||
                  subject.includes("location approval") ||
                  description.includes("unassigned location") ||
                  description.includes("outside assigned location"));

              return (
                request.type === "CORRECTION" &&
                (!isLocationApproval || isCheckInApproval) &&
                !punchType.includes("time-edit") &&
                (requestDetails.date || correction?.date) === date &&
                ["check-in", "both"].includes(punchType) &&
                Boolean(
                  requestDetails.checkInTime ||
                    requestDetails.checkIn ||
                    subject.includes("forgot punch"),
                )
              );
            });
          const matchingCheckIn = correctionRequests.find(
            ({ correction }) => correction.date === date,
          );
          setForgotPunchCheckIn(matchingCheckIn || null);

          if (
            !initialDate &&
            requestMode === "forgot-punch" &&
            date === indiaNow.date &&
            !attendanceRecord?.record?.checkInTime
          ) {
            const todayAtUtc = Date.parse(`${indiaNow.date}T00:00:00Z`);
            const previousCheckIn = correctionRequests.find(({ request, correction }) => {
              const requestDetails = correction || request.notification || {};
              const correctionDate = requestDetails.date || correction?.date;
              if (!correctionDate || correctionDate >= indiaNow.date) return false;
              const daysAgo =
                (todayAtUtc - Date.parse(`${correctionDate}T00:00:00Z`)) /
                (24 * 60 * 60 * 1000);
              const punchType = String(requestDetails.punchType || "").toLowerCase();
              return (
                daysAgo <= 2 &&
                !requestDetails.checkOutTime &&
                ["check-in", "both"].includes(punchType) &&
                Boolean(
                  requestDetails.checkInTime ||
                    requestDetails.checkIn ||
                    request.subject?.toLowerCase().includes("forgot punch"),
                )
              );
            });

            if (previousCheckIn) {
              const requestDetails =
                previousCheckIn.correction || previousCheckIn.request.notification || {};
              const previousDate =
                requestDetails.date || previousCheckIn.correction?.date;
              const previousAttendance = await apiGet(
                `/attendance/by-date?date=${encodeURIComponent(previousDate)}`,
              );
              if (!isMounted) return;
              if (!previousAttendance?.record?.checkOutTime) {
                setForgotPunchCheckIn(previousCheckIn);
                setDate(previousDate);
                setCheckOutDate(previousDate);
                setPunchType("check-out");
              }
            }
          }
        } else {
          console.warn(
            "Failed to fetch Forgot Punch requests:",
            requestsResult.reason?.message || requestsResult.reason,
          );
          setForgotPunchCheckIn(null);
        }

        // In time-edit mode, take the attendance time saved or pending before the edit
        if (requestMode === "time-edit") {
          const record = attendanceRecord?.record;
          const pendingCheckIn = matchingCheckIn?.correction;
          const initialIn = record?.checkInTime || pendingCheckIn?.checkInTime || "";
          const initialOut = record?.checkOutTime || pendingCheckIn?.checkOutTime || "";
          if (initialIn || initialOut) {
            setTime(initialIn);
            setCheckOutTime(initialOut);
          } else {
            setTime("");
            setCheckOutTime("");
          }
        }
      } catch (err) {
        console.warn("Failed to fetch existing attendance:", err.message);
        if (isMounted) {
          setExistingAttendance(null);
          setForgotPunchCheckIn(null);
        }
      } finally {
        if (isMounted) {
          setLoadingExisting(false);
          setLoadingForgotPunchCheckIn(false);
        }
      }
    };

    setLoadingForgotPunchCheckIn(true);
    fetchExisting();
    return () => {
      isMounted = false;
    };
  }, [date, indiaNow.date, requestMode]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [leaveRes, todayRes] = await Promise.allSettled([
          apiGet("/leave/my"),
          apiGet("/attendance/me/today"),
        ]);
        if (leaveRes.status === "fulfilled") {
          const list = Array.isArray(leaveRes.value?.requests) ? leaveRes.value.requests : [];
          setApprovedLeaves(list.filter((r) => r.status === "APPROVED"));
        }
        if (todayRes.status === "fulfilled" && todayRes.value?.unclosedPrevious) {
          setUnclosedPrevious(todayRes.value.unclosedPrevious);
        }
      } catch (err) {
        console.warn("Failed to fetch initial data:", err.message);
      } finally {
        setLoadingUnclosedPrevious(false);
      }
    };
    fetchData();
  }, []);

  const hasUnclosedPreviousMissingCheckout =
    !!unclosedPrevious?.record &&
    (!unclosedPrevious.correctionRequest ||
      (unclosedPrevious.correctionRequest.status !== "APPROVED" &&
        unclosedPrevious.correctionRequest.status !== "PENDING"));

  const isTodayUnclosedBlocked =
    date === indiaNow.date && hasUnclosedPreviousMissingCheckout;

  const hasSavedAttendanceCheckIn =
    Boolean(
      existingAttendance?.record?.checkInTime ||
        existingAttendance?.record?.checkIn,
    );
  const hasSavedAttendanceCheckOut =
    Boolean(
      existingAttendance?.record?.checkOutTime ||
        existingAttendance?.record?.checkOut,
    );
  const hasExistingCheckIn =
    hasSavedAttendanceCheckIn ||
    Boolean(
      forgotPunchCheckIn?.correction?.checkInTime ||
        forgotPunchCheckIn?.request?.notification?.checkInTime ||
        forgotPunchCheckIn?.correction?.checkIn ||
        forgotPunchCheckIn?.request?.notification?.checkIn,
    ) ||
    Boolean(
      unclosedPrevious?.record?.checkIn &&
        unclosedPrevious.record.dateKey === date,
    );
  const hasPendingForgotPunchCheckIn =
    forgotPunchCheckIn?.request?.status === "PENDING" &&
    Boolean(
      forgotPunchCheckIn?.correction?.checkInTime ||
        forgotPunchCheckIn?.request?.notification?.checkInTime ||
        forgotPunchCheckIn?.correction?.checkIn ||
        forgotPunchCheckIn?.request?.notification?.checkIn,
    );

  useEffect(() => {
    const unclosedDate = unclosedPrevious?.record?.dateKey;
    if (
        requestMode === "forgot-punch" &&
        isTodayUnclosedBlocked &&
        unclosedDate
    ) {
        setDate(unclosedDate);
        setCheckOutDate(unclosedDate);
        setPunchType("check-out");
    }
  }, [
    isTodayUnclosedBlocked,
    requestMode,
    unclosedPrevious?.record?.dateKey,
  ]);

  useEffect(() => {
    if (
      (isTodayUnclosedBlocked ||
        hasPendingForgotPunchCheckIn ||
        (requestMode === "forgot-punch" &&
          hasSavedAttendanceCheckIn &&
          !hasSavedAttendanceCheckOut)) &&
      (punchType === "check-in" || punchType === "both")
    ) {
      setPunchType("check-out");
    }
  }, [
    isTodayUnclosedBlocked,
    requestMode,
    hasPendingForgotPunchCheckIn,
    hasSavedAttendanceCheckIn,
    hasSavedAttendanceCheckOut,
    punchType,
  ]);

  const getApprovedLeaveForDate = (selectedDateStr) => {
    if (!selectedDateStr || approvedLeaves.length === 0) return null;

    return approvedLeaves.find((leave) => {
      const startKey = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(leave.startDate));

      const endKey = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(leave.endDate));

      return selectedDateStr >= startKey && selectedDateStr <= endKey;
    });
  };

  const onLeaveForDate =
    existingAttendance?.approvedLeave || getApprovedLeaveForDate(date);

  const handleModeChange = (mode) => {
    setRequestMode(mode);
    if (mode === "time-edit") {
      const record = existingAttendance?.record;
      const pendingCheckIn = forgotPunchCheckIn?.correction;
      const initialIn = record?.checkInTime || pendingCheckIn?.checkInTime || "";
      const initialOut = record?.checkOutTime || pendingCheckIn?.checkOutTime || "";
      if (initialIn || initialOut) {
        setTime(initialIn);
        setCheckOutTime(initialOut);
      } else {
        setTime("");
        setCheckOutTime("");
      }
    } else {
      setTime(existingAttendance?.record?.checkInTime || indiaNow.time);
      setCheckOutTime(existingAttendance?.record?.checkOutTime || indiaNow.time);
    }
  };

  useEffect(() => {
    const refreshIndiaNow = () => {
      const nextIndiaNow = getIndiaNow();

      setIndiaNow(nextIndiaNow);

      // If selected date is today,
      // don't allow time beyond current India time.
      if (date === nextIndiaNow.date) {
        const maxTime = getIndiaMaxTime();

        setTime((prev) => (prev > maxTime ? maxTime : prev));

        setCheckOutTime((prev) => (prev > maxTime ? maxTime : prev));
      }
    };

    refreshIndiaNow();

    const intervalId = window.setInterval(refreshIndiaNow, 1000);

    return () => window.clearInterval(intervalId);
  }, [date]);

  const executeSubmit = async (isOvernight = false) => {
    const actualCheckOutDate = (checkOutDate && checkOutDate > date) ? checkOutDate : date;
    const effectiveCheckOutDate = isOvernight ? (actualCheckOutDate > date ? actualCheckOutDate : getNextDayDateStr(date)) : actualCheckOutDate;
    const isCrossDay = effectiveCheckOutDate > date;

    // Strict future check: Check-in cannot be in future date/time
    if (date > indiaNow.date) {
      toast.error("Future check-in requests cannot be submitted. Please select today or a past date.");
      return;
    }
    if (date === indiaNow.date && time && time > indiaNow.time) {
      toast.error(`Check-in time cannot be in the future (current time: ${formatTime12h(indiaNow.time)}).`);
      return;
    }

    // Strict future check: Check-out cannot be in future date/time
    if (effectiveCheckOutDate > indiaNow.date) {
      toast.error("Future check-out requests cannot be submitted. Check-out date cannot be in the future.");
      return;
    }
    if (effectiveCheckOutDate === indiaNow.date) {
      const outTimeToCheck = punchType === "both" || requestMode === "time-edit" ? checkOutTime : time;
      if (outTimeToCheck && outTimeToCheck > indiaNow.time) {
        toast.error(`Check-out time cannot be in the future (current time: ${formatTime12h(indiaNow.time)}).`);
        return;
      }
    }

    setSubmitting(true);
    try {

      if (requestMode === "time-edit") {
        const timeEditReason = reason.trim();
        const originalCheckInTime =
          existingAttendance?.record?.checkInTime ||
          forgotPunchCheckIn?.correction?.checkInTime ||
          null;
        const originalCheckOutTime =
          existingAttendance?.record?.checkOutTime ||
          forgotPunchCheckIn?.correction?.checkOutTime ||
          null;

        const isCheckInOnly = punchType === "check-in";
        const isCheckOutOnly = punchType === "check-out";
        const isBoth = punchType === "both";

        const requestedCheckInTime = (isCheckInOnly || isBoth) && time ? time : null;
        const requestedCheckOutTime = (isCheckOutOnly || isBoth) && checkOutTime ? checkOutTime : null;

        if (isCheckInOnly && !requestedCheckInTime) {
          toast.error("Enter a valid check-in time to edit.");
          return;
        }
        if (isCheckOutOnly && !requestedCheckOutTime) {
          toast.error("Enter a valid check-out time to edit.");
          return;
        }
        if (isBoth && !requestedCheckInTime && !requestedCheckOutTime) {
          toast.error("Enter check-in time, check-out time, or both before submitting.");
          return;
        }

        const existingRecord = existingAttendance?.record;
        const existingCheckInReason = (() => {
          if (existingRecord?.checkInReason) return existingRecord.checkInReason;
          const m = String(existingRecord?.note || "").match(/(?:Check-In Reason|Checkin Reason|Reason)\s*:\s*([^.\r\n|]+)/i)?.[1]?.trim();
          return m && !/^(?:unassigned location|outside assigned location|pending admin)/i.test(m) ? m : null;
        })();
        const isULCheckIn = Boolean(existingRecord?.checkInLatitude && existingRecord?.checkInLongitude && String(existingRecord?.note || "").toLowerCase().includes("unassigned"));

        const correctionData = {
          date,
          attendanceId: existingRecord?.id || null,
          checkOutDate: effectiveCheckOutDate,
          punchType: "time-edit",
          timeEditPunchType: isCheckInOnly ? "check-in" : isCheckOutOnly ? "check-out" : "both",
          checkInTime: (isCheckInOnly || isBoth) ? requestedCheckInTime : null,
          checkOutTime: (isCheckOutOnly || isBoth) ? requestedCheckOutTime : null,
          originalCheckInTime: (isCheckInOnly || isBoth) ? originalCheckInTime : null,
          originalCheckOutTime: (isCheckOutOnly || isBoth) ? originalCheckOutTime : null,
          isOvernight: isOvernight || isCrossDay,
          reason: timeEditReason || existingCheckInReason || "",
          checkInReason: existingCheckInReason || null,
          checkInLatitude: existingRecord?.checkInLatitude ?? null,
          checkInLongitude: existingRecord?.checkInLongitude ?? null,
          checkOutLatitude: existingRecord?.checkOutLatitude ?? null,
          checkOutLongitude: existingRecord?.checkOutLongitude ?? null,
        };

        const typeLabel = isCheckInOnly ? " (Check In)" : isCheckOutOnly ? " (Check Out)" : "";
        const descParts = [];
        if (timeEditReason) descParts.push(timeEditReason);
        if (existingCheckInReason) descParts.push(`Reason: ${existingCheckInReason}`);
        if (isCrossDay) descParts.push(`Note: Overnight shift check-out on ${effectiveCheckOutDate}.`);
        const descText = descParts.length > 0 ? `${descParts.join("\n\n")}\n\n` : "";

        const isUL = isULCheckIn || Boolean(existingCheckInReason);
        const reqSubject = isUL
          ? `UL Check In + Time Edit (${date})`
          : `Time Edit Request - ${date}${typeLabel}${isCrossDay ? " (Overnight)" : ""}`;

        await apiPost("/requests/my", {
          type: "CORRECTION",
          subject: reqSubject,
          description: `${descText}[ATTENDANCE_CORRECTION]${JSON.stringify(correctionData)}`,
        });
        toast.success("Time Edit request submitted.");
      } else {
        const correctionData = {
          date,
          checkOutDate: effectiveCheckOutDate,
          punchType,
          checkInTime: punchType === "check-out" ? null : time,
          checkOutTime:
            punchType === "check-in"
              ? null
              : punchType === "both"
                ? checkOutTime
                : time,
          reason: reason.trim(),
          checkInReason:
            punchType === "check-in" || punchType === "both"
              ? reason.trim()
              : null,
          checkOutReason:
            punchType === "check-out" || punchType === "both"
              ? reason.trim()
              : null,
          checkInLocation:
            punchType === "check-in" || punchType === "both"
              ? checkInLocation.trim() || null
              : null,
          checkOutLocation:
            punchType === "check-out" || punchType === "both"
              ? checkOutLocation.trim() || null
              : null,
          checkInLocationSource:
            (punchType === "check-in" || punchType === "both") &&
            checkInLocation.trim()
              ? "forgot-punch"
              : null,
          checkOutLocationSource:
            (punchType === "check-out" || punchType === "both") &&
            checkOutLocation.trim()
              ? "forgot-punch"
              : null,
          isOvernight: isOvernight || isCrossDay,
        };

        // Build location text based on punch type
        let locationText = "";
        if (punchType === "check-in" && checkInLocation.trim()) {
          locationText = `\n\nCheck-In Location: ${checkInLocation.trim()}`;
        } else if (punchType === "check-out" && checkOutLocation.trim()) {
          locationText = `\n\nCheck-Out Location: ${checkOutLocation.trim()}`;
        } else if (punchType === "both") {
          if (checkInLocation.trim() || checkOutLocation.trim()) {
            locationText = "\n\n";
            if (checkInLocation.trim()) {
              locationText += `Check-In Location: ${checkInLocation.trim()}`;
            }
            if (checkOutLocation.trim()) {
              if (checkInLocation.trim()) locationText += "\n";
              locationText += `Check-Out Location: ${checkOutLocation.trim()}`;
            }
          }
        }

        const timeDescription =
          punchType === "both"
            ? `check-in ${formatTime12h(time)} (${date}) and check-out ${formatTime12h(checkOutTime)} (${effectiveCheckOutDate})`
            : `${punchLabel.toLowerCase()} ${formatTime12h(time)} (${punchType === "check-out" ? effectiveCheckOutDate : date})`;

        await apiPost("/requests/my", {
          type: "CORRECTION",
          subject: `${label} - ${punchLabel}${isCrossDay ? " (Overnight)" : ""}`,
          description: `${label} request for ${punchLabel} on ${date} at ${timeDescription}.${isCrossDay ? `\nNote: Check-out date is ${effectiveCheckOutDate}.` : ""}\n\n${reason.trim()}${locationText}\n[ATTENDANCE_CORRECTION]${JSON.stringify(correctionData)}`,
        });
        toast.success(`${label} request submitted.`);
      }
      setReason("");
      setCheckInLocation("");
      setCheckOutLocation("");
      setOvernightModal({
        isOpen: false,
        checkInTime: "",
        checkOutTime: "",
        checkInDate: "",
        checkOutDate: "",
      });
    } catch (err) {
      toast.error(err.message || "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (onLeaveForDate) {
      toast.error(
        `Cannot submit ${label} for ${date} because you were on approved leave.`,
      );
      return;
    }

    if (requestMode !== "time-edit" && !reason.trim()) {
      toast.error("Please enter a reason.");
      return;
    }

    if (
      isTodayUnclosedBlocked &&
      (punchType === "check-in" || punchType === "both" || requestMode === "time-edit")
    ) {
      toast.error(
        `Check-in for today is closed. Please complete yesterday's check-out (${unclosedPrevious?.record?.dateKey || "previous day"}) first.`,
      );
      return;
    }

    // Block future dates for check-in
    if (date > indiaNow.date) {
      toast.error("Future check-in requests cannot be submitted. Please select today or a past date.");
      return;
    }

    // If check-in is today, block future check-in time
    if (date === indiaNow.date && time && time > indiaNow.time) {
      toast.error(`Check-in time cannot be in the future (current time: ${formatTime12h(indiaNow.time)}).`);
      return;
    }

    // Check if checkOutDate is set and is earlier than check-in date
    if (checkOutDate && checkOutDate < date) {
      toast.error("Check-out date cannot be earlier than check-in date.");
      return;
    }

    // Determine effective checkout date:
    // If not an overnight / multi-day request, checkout date is the same as check-in date
    const effectiveOutDate = checkOutDate && checkOutDate > date ? checkOutDate : date;

    // Block future date or future time for check-out
    if (effectiveOutDate > indiaNow.date) {
      toast.error("Future check-out requests cannot be submitted. Check-out date cannot be in the future.");
      return;
    }
    if (effectiveOutDate === indiaNow.date) {
      const outTimeToCheck = punchType === "both" || requestMode === "time-edit" ? checkOutTime : time;
      if (outTimeToCheck && outTimeToCheck > indiaNow.time) {
        toast.error(`Check-out time cannot be in the future (current time: ${formatTime12h(indiaNow.time)}).`);
        return;
      }
    }

    const isDifferentDay = Boolean(checkOutDate && checkOutDate > date);

    if (requestMode === "forgot-punch") {
      if (punchType === "both") {
        if (!time || !checkOutTime) {
          toast.error("Please provide both Check In and Check Out times.");
          return;
        }
        if (!isDifferentDay && checkOutTime <= time) {
          setOvernightModal({
            isOpen: true,
            checkInTime: time,
            checkOutTime: checkOutTime,
            checkInDate: date,
            checkOutDate: getNextDayDateStr(date),
          });
          return;
        }
      }

      if (punchType === "check-out" && hasExistingCheckIn) {
        const existingIn =
          existingAttendance?.record?.checkInTime ||
          forgotPunchCheckIn?.correction?.checkInTime;
        if (!isDifferentDay && existingIn && time <= existingIn) {
          setOvernightModal({
            isOpen: true,
            checkInTime: existingIn,
            checkOutTime: time,
            checkInDate: date,
            checkOutDate: getNextDayDateStr(date),
          });
          return;
        }
      }
    }

    if (requestMode === "time-edit") {
      if (!time && !checkOutTime) {
        toast.error("Please provide at least check-in time or check-out time.");
        return;
      }
      if (!time && checkOutTime && !hasExistingCheckIn) {
        toast.error("Cannot set Check Out time without a Check In record. Please provide both Check In and Check Out times.");
        return;
      }
      const effectiveIn = time || existingAttendance?.record?.checkInTime;
      const effectiveOut = checkOutTime || existingAttendance?.record?.checkOutTime;
      if (!isDifferentDay && effectiveIn && effectiveOut && effectiveOut <= effectiveIn) {
        setOvernightModal({
          isOpen: true,
          checkInTime: effectiveIn,
          checkOutTime: effectiveOut,
          checkInDate: date,
          checkOutDate: getNextDayDateStr(date),
        });
        return;
      }
    }

    await executeSubmit(isDifferentDay);
  };

  if (!hasModuleAccess("requests-forgot-punch")) {
    return (
      <div className="p-8 text-center max-w-md mx-auto my-12 bg-card rounded-2xl border border-border shadow-sm">
        <ShieldAlert className="h-12 w-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Access Restricted</h2>
        <p className="text-sm text-muted-foreground mb-6">
          You do not have permission to submit Forgot Punch / Time Edit requests. Please contact your system administrator to assign this role capability.
        </p>
        <button
          type="button"
          onClick={() => navigate("/employee/requests")}
          className="px-4 py-2 bg-primary text-white font-medium rounded-xl text-sm hover:bg-primary/90 transition-colors"
        >
          Go to Requests
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-secondary"
          aria-label="Back to requests"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <CalendarDays className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">
            {requestMode === "time-edit" ? "Time Edit Request" : "Forgot Punch / Time Edit"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Review employee check in, check out and time edit requests.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-border bg-background p-6 card-shadow"
      >
        {/* Toggle between Forgot Punch and Time Edit Request */}
        <div className="flex flex-wrap items-center gap-6 p-4 rounded-xl border border-border bg-muted/40">
          <label className="inline-flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-foreground">
            <input
              type="radio"
              name="correctionMode"
              value="forgot-punch"
              checked={requestMode === "forgot-punch"}
              onChange={() => handleModeChange("forgot-punch")}
              className="h-4 w-4 text-primary focus:ring-primary border-border"
            />
            <span>Forgot Punch</span>
          </label>
          <label className="inline-flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-foreground">
            <input
              type="radio"
              name="correctionMode"
              value="time-edit"
              checked={requestMode === "time-edit"}
              onChange={() => handleModeChange("time-edit")}
              className="h-4 w-4 text-primary focus:ring-primary border-border"
            />
            <span>Time Edit Request</span>
          </label>
        </div>

        {/* Date Selection */}
        <label className="block text-sm font-medium text-foreground">
          Attendance Date
          <input
            type="date"
            required
            value={date}
            max={indiaNow.date}
            onChange={(event) => {
              const nextDate = event.target.value;
              setDate(nextDate);
              setCheckOutDate(nextDate);

              if (nextDate === indiaNow.date) {
                if (time > indiaNow.time) setTime(indiaNow.time);
                if (checkOutTime > indiaNow.time) {
                  setCheckOutTime(indiaNow.time);
                }
              }
            }}
            className={`mt-2 w-full rounded-lg border px-3 py-2.5 text-sm ${
              onLeaveForDate
                ? "border-purple-300 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/20"
                : "border-border bg-background"
            }`}
          />
        </label>
          {onLeaveForDate && (
            <div className="mt-2 rounded-xl border border-purple-200 bg-purple-50 dark:border-purple-900/40 dark:bg-purple-950/30 p-3.5 text-xs text-purple-900 dark:text-purple-200">
              <div className="font-bold flex items-center gap-1.5 text-purple-800 dark:text-purple-300">
                <AlertCircle className="h-4 w-4 text-purple-600 shrink-0" />
                Date Frozen — On Approved Leave ({onLeaveForDate.leaveType?.name || "Leave"})
              </div>
              <div className="mt-1 leading-relaxed">
                You were on approved leave on {date}. Forgot Punch / Time Edit request cannot be submitted for approved leave dates.
              </div>
            </div>
          )}

        {/* Saved Attendance on Selected Date (Before Edit) Card */}
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Saved Attendance on Selected Date (Before Edit)
              </span>
            </div>
            {loadingExisting ? (
              <span className="text-xs text-muted-foreground animate-pulse">Loading saved record...</span>
            ) : existingAttendance?.record ? (
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {existingAttendance.record.status || "Recorded"}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">No punches found</span>
            )}
          </div>

          {loadingExisting ? (
            <div className="py-2 text-center text-xs text-muted-foreground">
              Checking saved attendance for {date}...
            </div>
          ) : existingAttendance?.record ? (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-border bg-background p-2.5">
                  <div className="text-[11px] font-semibold text-muted-foreground">Saved Check In</div>
                  <div className="mt-0.5 text-sm font-bold text-foreground">
                    {formatTime12h(existingAttendance.record.checkInTime)}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-background p-2.5">
                  <div className="text-[11px] font-semibold text-muted-foreground">Saved Check Out</div>
                  <div className="mt-0.5 text-sm font-bold text-foreground">
                    {formatTime12h(existingAttendance.record.checkOutTime)}
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1 rounded-lg border border-border bg-background p-2.5">
                  <div className="text-[11px] font-semibold text-muted-foreground">Total Worked Hours</div>
                  <div className="mt-0.5 text-sm font-bold text-foreground">
                    {existingAttendance.record.workedHours != null
                      ? `${existingAttendance.record.workedHours} hrs`
                      : "—"}
                  </div>
                </div>
              </div>
              {existingAttendance.record.note && (
                <div className="text-xs text-muted-foreground bg-background/80 rounded-lg p-2 border border-border/60">
                  <span className="font-semibold text-foreground">Saved Note:</span> {existingAttendance.record.note}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-background/60 p-3 text-center text-xs text-muted-foreground">
              No prior attendance punches found for <span className="font-semibold text-foreground">{date}</span>. New punches entered below will create attendance for this date.
            </div>
          )}
        </div>

        {/* Unclosed yesterday check-out warning */}
        {isTodayUnclosedBlocked && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-900/50 p-4 space-y-2 text-xs text-amber-900 dark:text-amber-200">
            <div className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300 text-sm">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              Check-In for Today is Blocked — Previous Check-Out Missing
            </div>
            <p>
              You checked in on <strong>{unclosedPrevious.record.dateKey}</strong> but did not check out. You must submit that day's check-out first before today's check-in can be submitted.
            </p>
            {(!unclosedPrevious.correctionRequest || unclosedPrevious.correctionRequest.status === "REJECTED") && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setDate(unclosedPrevious.record.dateKey);
                    setCheckOutDate(unclosedPrevious.record.dateKey);
                    setPunchType("check-out");
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-xs transition-colors shadow-sm"
                >
                  Complete Check-Out ({unclosedPrevious.record.dateKey})
                </button>
              </div>
            )}
          </div>
        )}

        {requestMode === "forgot-punch" ? (
          <>
            <label className="block text-sm font-medium">
              Punch Type
              <select
                value={punchType}
                onChange={(event) => setPunchType(event.target.value)}
                className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
              >
                {!hasExistingCheckIn && (
                  <option
                    value="check-in"
                    disabled={isTodayUnclosedBlocked || hasPendingForgotPunchCheckIn}
                  >
                    {hasPendingForgotPunchCheckIn
                      ? "Check In (Already Requested — Pending Approval)"
                      : isTodayUnclosedBlocked
                        ? "Check In (Closed — Complete Yesterday Check-Out First)"
                        : "Check In"}
                  </option>
                )}
                <option
                  value="check-out"
                  disabled={hasSavedAttendanceCheckOut}
                >
                  {hasSavedAttendanceCheckOut
                    ? "Check Out (Already Marked)"
                    : !hasExistingCheckIn
                    ? "Check Out (Check In required before submitting)"
                    : "Check Out"}
                </option>
                {!hasExistingCheckIn && (
                  <option
                    value="both"
                    disabled={isTodayUnclosedBlocked || hasPendingForgotPunchCheckIn}
                  >
                    {hasPendingForgotPunchCheckIn
                      ? "Check In + Check Out (Check In Already Requested)"
                      : isTodayUnclosedBlocked
                        ? "Check In + Check Out (Closed — Complete Yesterday Check-Out First)"
                        : "Check In + Check Out (One Request)"}
                  </option>
                )}
              </select>
            </label>

            <label className="block text-sm font-medium">
              {punchType === "check-out" ? "Check Out Time" : "Check In Time"}
              <TimePicker12h
                value={time}
                onChange={(newTime) => setTime(newTime)}
                idPrefix="fp-in"
              />
            </label>
            {punchType === "both" && (
              <label className="block text-sm font-medium">
                Check Out Time
                <TimePicker12h
                  value={checkOutTime}
                  onChange={(newTime) => setCheckOutTime(newTime)}
                  idPrefix="fp-out"
                />
              </label>
            )}

            {/* Location Fields - Show based on punch type */}
            {(punchType === "check-in" || punchType === "both") && (
              <label className="block text-sm font-medium">
                Check-In Location
                <input
                  type="text"
                  value={checkInLocation}
                  onChange={(event) => setCheckInLocation(event.target.value)}
                  maxLength={200}
                  placeholder="Where were you during check-in? (e.g., 'Client Office, Mumbai')"
                  className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Optional: Your location at check-in time
                </p>
              </label>
            )}

            {(punchType === "check-out" || punchType === "both") && (
              <label className="block text-sm font-medium">
                Check-Out Location
                <input
                  type="text"
                  value={checkOutLocation}
                  onChange={(event) => setCheckOutLocation(event.target.value)}
                  maxLength={200}
                  placeholder="Where were you during check-out? (e.g., 'Home' or 'Office')"
                  className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Optional: Your location at check-out time
                </p>
              </label>
            )}

            <label className="block text-sm font-medium">
              Reason
              <textarea
                required
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={5000}
                rows={5}
                placeholder={`Explain why you missed your ${punchLabel.toLowerCase()}.`}
                className="mt-2 w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
              />
            </label>
          </>
        ) : (
          /* ONLY date and time edit when in Time Edit Request mode */
          <>
            {/* Punch to Edit Selection */}
            <label className="block text-sm font-medium">
              Punch to Edit
              <select
                value={punchType}
                onChange={(event) => setPunchType(event.target.value)}
                className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
              >
                <option value="check-in">Check In Time Only</option>
                <option value="check-out">Check Out Time Only</option>
                <option value="both">Both (Check In & Check Out Time)</option>
              </select>
            </label>

            {/* Live Update Preview */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs space-y-1.5">
              <div className="font-semibold text-primary flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Time Update Preview for {date}:
              </div>
              <div className="flex flex-wrap items-center gap-6 text-foreground pt-0.5">
                {(punchType === "check-in" || punchType === "both") && (
                  <div>
                    <span className="text-muted-foreground">Updated Check-In:</span>{" "}
                    <span className="font-bold">{formatTime12h(time)}</span>
                  </div>
                )}
                {(punchType === "check-out" || punchType === "both") && (
                  <div>
                    <span className="text-muted-foreground">Updated Check-Out:</span>{" "}
                    <span className="font-bold">{formatTime12h(checkOutTime)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className={punchType === "both" ? "grid grid-cols-1 sm:grid-cols-2 gap-4" : "grid grid-cols-1 gap-4"}>
              {(punchType === "check-in" || punchType === "both") && (
                <label className="block text-sm font-medium">
                  Check In Time <span className="text-xs font-normal text-muted-foreground">(Pre-filled from saved {date})</span>
                  <TimePicker12h
                    value={time}
                    onChange={(newTime) => setTime(newTime)}
                    idPrefix="te-in"
                  />
                </label>
              )}

              {(punchType === "check-out" || punchType === "both") && (
                <label className="block text-sm font-medium">
                  Check Out Time <span className="text-xs font-normal text-muted-foreground">(Pre-filled from saved {date})</span>
                  <TimePicker12h
                    value={checkOutTime}
                    onChange={(newTime) => setCheckOutTime(newTime)}
                    idPrefix="te-out"
                  />
                </label>
              )}
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={
            submitting ||
            loadingExisting ||
            loadingUnclosedPrevious ||
            loadingForgotPunchCheckIn ||
            Boolean(onLeaveForDate) ||
            Boolean(
              isTodayUnclosedBlocked &&
                (punchType === "check-in" || punchType === "both" || requestMode === "time-edit"),
            )
          }
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="h-4 w-4" />
          {submitting
            ? "Submitting..."
            : onLeaveForDate
              ? "Date Frozen (On Leave)"
              : isTodayUnclosedBlocked &&
                  (punchType === "check-in" || punchType === "both" || requestMode === "time-edit")
                ? "Check In Closed (Complete Yesterday Check-Out First)"
                : requestMode === "time-edit"
                  ? "Submit Time Edit Request"
                  : "Submit Request"}
        </button>
      </form>

      {/* Overnight Shift Confirmation Popup Modal */}
      {overnightModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500 shrink-0">
                <Moon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  Overnight Shift Punch?
                </h3>
                <p className="text-xs text-muted-foreground">
                  Check-out time is earlier than Check-in time.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-indigo-200/50 bg-indigo-50/60 dark:border-indigo-900/50 dark:bg-indigo-950/30 p-3.5 space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2 text-foreground">
                <div className="p-2 rounded-lg bg-background/80 border border-border/60">
                  <span className="text-[11px] text-muted-foreground block">Check-In ({overnightModal.checkInDate})</span>
                  <span className="font-bold text-sm text-foreground">{formatTime12h(overnightModal.checkInTime)}</span>
                </div>
                <div className="p-2 rounded-lg bg-background/80 border border-border/60">
                  <span className="text-[11px] text-muted-foreground block">Check-Out (Next Day {overnightModal.checkOutDate})</span>
                  <span className="font-bold text-sm text-indigo-600 dark:text-indigo-400">{formatTime12h(overnightModal.checkOutTime)}</span>
                </div>
              </div>
              <p className="text-indigo-900 dark:text-indigo-200 leading-relaxed">
                Did your shift cross midnight and end on the next calendar day (<strong>{overnightModal.checkOutDate}</strong>)?
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() =>
                  setOvernightModal({
                    isOpen: false,
                    checkInTime: "",
                    checkOutTime: "",
                    checkInDate: "",
                    checkOutDate: "",
                  })
                }
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-secondary transition-colors"
              >
                No, Edit Time
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => executeSubmit(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-sm disabled:opacity-50"
              >
                <Moon className="h-3.5 w-3.5" />
                {submitting ? "Submitting..." : "Yes, Next Day Punch"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceCorrection;
