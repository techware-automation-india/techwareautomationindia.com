import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, Send, AlertCircle, Clock } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../lib/api.js";

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

const AdminAttendanceCorrection = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialMode =
    searchParams.get("mode") === "time-edit" || location.state?.mode === "time-edit"
      ? "time-edit"
      : "forgot-punch";
  const initialDate = searchParams.get("date") || location.state?.date;
  const initialEmployeeId = searchParams.get("employeeId") || location.state?.employeeId || "";

  const [requestMode, setRequestMode] = useState(initialMode);
  const [indiaNow, setIndiaNow] = useState(getIndiaNow);

  const [punchType, setPunchType] = useState("check-in");

  const [date, setDate] = useState(initialDate || indiaNow.date);
  const [selectedEmployeeId] = useState(initialEmployeeId);

  const [existingAttendance, setExistingAttendance] = useState(null);
  const [loadingExisting, setLoadingExisting] = useState(false);

  const [checkInTime, setCheckInTime] = useState(indiaNow.time);
  const [checkOutTime, setCheckOutTime] = useState(indiaNow.time);
  const [reason, setReason] = useState("");
  const [checkInLocation, setCheckInLocation] = useState("");
  const [checkOutLocation, setCheckOutLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [approvedLeaves, setApprovedLeaves] = useState([]);
  const [unclosedPrevious, setUnclosedPrevious] = useState(null);

  // Fetch existing attendance record and times for selected date and employee
  useEffect(() => {
    let isMounted = true;
    const fetchExisting = async () => {
      if (!date) return;
      try {
        setLoadingExisting(true);
        const params = new URLSearchParams({ date });
        if (selectedEmployeeId) {
          params.set("employeeId", selectedEmployeeId);
        }
        const res = await apiGet(`/attendance/by-date?${params.toString()}`);
        if (!isMounted) return;
        setExistingAttendance(res);

        // In time-edit mode, take the attendance time saved before the edit
        if (requestMode === "time-edit") {
          if (res?.record) {
            setCheckInTime(res.record.checkInTime || "");
            setCheckOutTime(res.record.checkOutTime || "");
          } else {
            setCheckInTime("");
            setCheckOutTime("");
          }
        }
      } catch (err) {
        console.warn("Failed to fetch existing attendance:", err.message);
        if (isMounted) setExistingAttendance(null);
      } finally {
        if (isMounted) setLoadingExisting(false);
      }
    };

    fetchExisting();
    return () => {
      isMounted = false;
    };
  }, [date, selectedEmployeeId, requestMode]);

  // Fetch user's approved leave requests and today's attendance status
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
      }
    };
    fetchData();
  }, []);

  const hasUnclosedPreviousMissingCheckout =
    !!unclosedPrevious?.record &&
    (!unclosedPrevious.correctionRequest || unclosedPrevious.correctionRequest.status !== "APPROVED");

  const isTodayUnclosedBlocked =
    !selectedEmployeeId && date === indiaNow.date && hasUnclosedPreviousMissingCheckout;

  const hasExistingCheckIn = !!existingAttendance?.record?.checkInTime;

  useEffect(() => {
    if (isTodayUnclosedBlocked && (punchType === "check-in" || punchType === "both")) {
      setPunchType("check-out");
    } else if (!hasExistingCheckIn && punchType === "check-out" && !isTodayUnclosedBlocked) {
      setPunchType("check-in");
    }
  }, [isTodayUnclosedBlocked, hasExistingCheckIn, punchType]);

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
    existingAttendance?.approvedLeave ||
    (selectedEmployeeId ? null : getApprovedLeaveForDate(date));

  // ---------------------------------------------
  // Current India time refresh
  // ---------------------------------------------

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setIndiaNow(getIndiaNow());
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  const handleModeChange = (mode) => {
    setRequestMode(mode);
    if (mode === "time-edit") {
      if (existingAttendance?.record) {
        setCheckInTime(existingAttendance.record.checkInTime || "");
        setCheckOutTime(existingAttendance.record.checkOutTime || "");
      } else {
        setCheckInTime("");
        setCheckOutTime("");
      }
    } else {
      setCheckInTime(existingAttendance?.record?.checkInTime || indiaNow.time);
      setCheckOutTime(existingAttendance?.record?.checkOutTime || indiaNow.time);
    }
  };

  // ---------------------------------------------
  // Punch label
  // ---------------------------------------------

  const punchLabel =
    punchType === "check-in"
      ? "Check In"
      : punchType === "check-out"
        ? "Check Out"
        : "Check In and Check Out";

  // ---------------------------------------------
  // Punch type change
  // ---------------------------------------------

  const handlePunchTypeChange = (event) => {
    const value = event.target.value;

    setPunchType(value);

    // Default to existing punch times if available, otherwise current India time
    if (value === "check-in") {
      setCheckInTime(existingAttendance?.record?.checkInTime || indiaNow.time);
    }

    if (value === "check-out") {
      setCheckOutTime(existingAttendance?.record?.checkOutTime || indiaNow.time);
    }

    if (value === "both") {
      setCheckInTime(existingAttendance?.record?.checkInTime || indiaNow.time);
      setCheckOutTime(existingAttendance?.record?.checkOutTime || indiaNow.time);
    }
  };

  // ---------------------------------------------
  // Check-in time change (with validation)
  // ---------------------------------------------

  const handleCheckInTimeChange = (event) => {
    const value = event.target.value;
    
    setCheckInTime(value);

    // If today and time > current India time, auto-correct
    if (date === indiaNow.date && value > indiaNow.time) {
      setCheckInTime(indiaNow.time);
      toast.error("Future check-in time is not allowed.");
    }
  };

  // ---------------------------------------------
  // Check-out time change (with validation)
  // ---------------------------------------------

  const handleCheckOutTimeChange = (event) => {
    const value = event.target.value;
    
    setCheckOutTime(value);

    // If today and time > current India time, auto-correct
    if (date === indiaNow.date && value > indiaNow.time) {
      setCheckOutTime(indiaNow.time);
      toast.error("Future check-out time is not allowed.");
    }
  };

  // ---------------------------------------------
  // Date change
  // ---------------------------------------------

  const handleDateChange = (event) => {
    const selectedDate = event.target.value;

    setDate(selectedDate);

    if (selectedDate === indiaNow.date) {
      if (checkInTime > indiaNow.time) {
        setCheckInTime(indiaNow.time);
      }

      if (checkOutTime > indiaNow.time) {
        setCheckOutTime(indiaNow.time);
      }
    }
  };

  // ---------------------------------------------
  // Submit
  // ---------------------------------------------

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (onLeaveForDate) {
      toast.error(
        `Cannot save attendance for ${date} because you were on approved leave.`,
      );
      return;
    }

    if (!date) {
      toast.error("Please select a date.");
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

    // -------------------------------------------
    // Future date validation
    // -------------------------------------------

    if (date > indiaNow.date) {
      toast.error("Future attendance date is not allowed.");
      return;
    }

    // -------------------------------------------
    // Required time validation (Forgot Punch only)
    // -------------------------------------------

    if (requestMode === "forgot-punch") {
      if (punchType === "check-out" && !hasExistingCheckIn) {
        toast.error("Cannot request Check Out without an existing Check In. Please select 'Check In' or 'Check In + Check Out'.");
        return;
      }

      if ((punchType === "check-in" || punchType === "both") && !checkInTime) {
        toast.error("Please select check-in time.");
        return;
      }

      if ((punchType === "check-out" || punchType === "both") && !checkOutTime) {
        toast.error("Please select check-out time.");
        return;
      }
    }

    // -------------------------------------------
    // Future time validation for TODAY
    // -------------------------------------------

    if (date === indiaNow.date) {
      if (checkInTime && checkInTime > indiaNow.time) {
        toast.error("Future check-in time is not allowed.");
        return;
      }

      if (checkOutTime && checkOutTime > indiaNow.time) {
        toast.error("Future check-out time is not allowed.");
        return;
      }
    }

    // -------------------------------------------
    // Validation & API payload
    // -------------------------------------------

    if (requestMode === "time-edit") {
      if (!checkInTime && !checkOutTime) {
        toast.error("Please provide at least check-in time or check-out time.");
        return;
      }
      if (checkInTime && checkOutTime && checkOutTime <= checkInTime) {
        toast.error("Check-out time must be greater than check-in time.");
        return;
      }
    } else {
      if (punchType === "both" && checkOutTime <= checkInTime) {
        toast.error("Check-out time must be greater than check-in time.");
        return;
      }
    }

    let correctionData;
    if (requestMode === "time-edit") {
      correctionData = {
        date,
        punchType: "time-edit",
        checkInTime: checkInTime || null,
        checkOutTime: checkOutTime || null,
        reason: reason.trim() ? `Time Edit: ${reason.trim()}` : "Time Edit",
        employeeId: selectedEmployeeId || undefined,
      };
    } else {
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

      const fullReason = `${reason.trim()}${locationText}`;

      correctionData = {
        date,
        punchType,
        checkInTime: punchType === "check-out" ? null : checkInTime,
        checkOutTime: punchType === "check-in" ? null : checkOutTime,
        reason: fullReason,
        employeeId: selectedEmployeeId || undefined,
      };
    }

    setSubmitting(true);

    try {
      const response = await apiPost(
        "/attendance/manual-correction",
        correctionData,
      );

      toast.success(response?.message || "Attendance updated successfully.");

      setReason("");
      setCheckInLocation("");
      setCheckOutLocation("");

      setTimeout(() => {
        navigate(-1);
      }, 500);
    } catch (error) {
      console.error("Attendance correction error:", error);

      // Extract error message safely
      let errorMessage = "Failed to update attendance.";
      
      if (error && typeof error === 'object') {
        errorMessage = error.message || error.error || error.msg || errorMessage;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      // Check if it's a duplicate punch error
      if (errorMessage.includes("already exists")) {
        toast.error(errorMessage, { duration: 5000 });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* ================= HEADER ================= */}

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-secondary"
          aria-label="Back"
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

      {/* ================= FORM ================= */}

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-border bg-background p-6 card-shadow"
      >
        {/* Toggle between Forgot Punch and Time Edit Request */}
        <div className="flex flex-wrap items-center gap-6 p-4 rounded-xl border border-border bg-muted/40">
          <label className="inline-flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-foreground">
            <input
              type="radio"
              name="adminCorrectionMode"
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
              name="adminCorrectionMode"
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
            onChange={handleDateChange}
            className={`mt-2 w-full rounded-lg border px-3 py-2.5 text-sm ${
              onLeaveForDate
                ? "border-purple-300 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/20"
                : "border-border bg-background"
            }`}
          />
          {onLeaveForDate && (
            <div className="mt-2 rounded-xl border border-purple-200 bg-purple-50 dark:border-purple-900/40 dark:bg-purple-950/30 p-3.5 text-xs text-purple-900 dark:text-purple-200">
              <div className="font-bold flex items-center gap-1.5 text-purple-800 dark:text-purple-300">
                <AlertCircle className="h-4 w-4 text-purple-600 shrink-0" />
                Date Frozen — On Approved Leave ({onLeaveForDate.leaveType?.name || "Leave"})
              </div>
              <div className="mt-1 leading-relaxed">
                The employee was on approved leave on {date}. Attendance changes cannot be saved for approved leave dates.
              </div>
            </div>
          )}
        </label>

        {/* Saved Attendance on Selected Date (Before Edit) Card */}
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Saved Attendance on Selected Date (Before Edit)
              </span>
              {existingAttendance?.employee?.fullName && (
                <span className="text-xs font-semibold text-foreground">
                  • {existingAttendance.employee.fullName}
                </span>
              )}
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
              Check-In for Today is Closed — Previous Attendance Incomplete
            </div>
            <p>
              You checked in on <strong>{unclosedPrevious.record.dateKey}</strong> but did not check out.
              {unclosedPrevious.correctionRequest?.status === "PENDING"
                ? " Your check-out request for that day is pending approval. Once approved, today's check-in will open."
                : " You must complete that day's check-out first before today's check-in can be saved."}
            </p>
            {(!unclosedPrevious.correctionRequest || unclosedPrevious.correctionRequest.status === "REJECTED") && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setDate(unclosedPrevious.record.dateKey);
                    setPunchType("check-out");
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-xs transition-colors shadow-sm"
                >
                  Complete Check-Out for {unclosedPrevious.record.dateKey}
                </button>
              </div>
            )}
          </div>
        )}

        {requestMode === "forgot-punch" ? (
          <>
            {/* Punch Type */}
            <label className="block text-sm font-medium">
              Punch Type
              <select
                value={punchType}
                onChange={handlePunchTypeChange}
                className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
              >
                <option value="check-in" disabled={isTodayUnclosedBlocked}>
                  {isTodayUnclosedBlocked
                    ? "Check In (Closed — Complete Yesterday Check-Out First)"
                    : "Check In"}
                </option>

                <option value="check-out" disabled={!hasExistingCheckIn}>
                  {!hasExistingCheckIn
                    ? "Check Out (Disabled — Check In required first)"
                    : "Check Out"}
                </option>

                <option value="both" disabled={isTodayUnclosedBlocked}>
                  {isTodayUnclosedBlocked
                    ? "Check In + Check Out (Closed — Complete Yesterday Check-Out First)"
                    : "Check In + Check Out"}
                </option>
              </select>
            </label>

            {/* Check In */}
            {(punchType === "check-in" || punchType === "both") && (
              <label className="block text-sm font-medium">
                Check In Time
                <input
                  type="time"
                  required
                  value={checkInTime}
                  max={date === indiaNow.date ? indiaNow.time : undefined}
                  onChange={handleCheckInTimeChange}
                  className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                />
              </label>
            )}

            {/* Check Out */}
            {(punchType === "check-out" || punchType === "both") && (
              <label className="block text-sm font-medium">
                Check Out Time
                <input
                  type="time"
                  required
                  value={checkOutTime}
                  max={date === indiaNow.date ? indiaNow.time : undefined}
                  onChange={handleCheckOutTimeChange}
                  className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
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
                  placeholder="Location at check-in time (e.g., 'Client Site, Delhi' or 'Office')"
                  className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                />
                <p className="mt-1 text-xs text-muted-foreground">Optional: Where the employee was at check-in</p>
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
                  placeholder="Location at check-out time (e.g., 'Home' or 'Remote - Mumbai')"
                  className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                />
                <p className="mt-1 text-xs text-muted-foreground">Optional: Where the employee was at check-out</p>
              </label>
            )}

            {/* Reason */}
            <label className="block text-sm font-medium">
              Reason
              <textarea
                required
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={5000}
                rows={5}
                placeholder={`Enter reason for ${punchLabel.toLowerCase()}.`}
                className="mt-2 w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
              />
            </label>
          </>
        ) : (
          /* ONLY date and time edit when in Time Edit Request mode */
          <>
            {/* Live Update Preview */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs space-y-1.5">
              <div className="font-semibold text-primary flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Time Update Preview for {date}:
              </div>
              <div className="flex flex-wrap items-center gap-6 text-foreground pt-0.5">
                <div>
                  <span className="text-muted-foreground">Updated Check-In:</span>{" "}
                  <span className="font-bold">{formatTime12h(checkInTime)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Updated Check-Out:</span>{" "}
                  <span className="font-bold">{formatTime12h(checkOutTime)}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block text-sm font-medium">
                Check In Time <span className="text-xs font-normal text-muted-foreground">(Pre-filled from saved {date})</span>
                <input
                  type="time"
                  value={checkInTime}
                  max={date === indiaNow.date ? indiaNow.time : undefined}
                  onChange={handleCheckInTimeChange}
                  className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                />
              </label>

              <label className="block text-sm font-medium">
                Check Out Time <span className="text-xs font-normal text-muted-foreground">(Pre-filled from saved {date})</span>
                <input
                  type="time"
                  value={checkOutTime}
                  max={date === indiaNow.date ? indiaNow.time : undefined}
                  onChange={handleCheckOutTimeChange}
                  className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                />
              </label>
            </div>
          </>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={
            submitting ||
            Boolean(onLeaveForDate) ||
            Boolean(
              isTodayUnclosedBlocked &&
                (punchType === "check-in" || punchType === "both" || requestMode === "time-edit"),
            )
          }
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send className="h-4 w-4" />

          {submitting
            ? "Saving..."
            : onLeaveForDate
              ? "Date Frozen (On Leave)"
              : isTodayUnclosedBlocked &&
                  (punchType === "check-in" || punchType === "both" || requestMode === "time-edit")
                ? "Check In Closed (Yesterday Incomplete)"
                : requestMode === "time-edit"
                  ? "Save Time Edit"
                  : "Save Attendance"}
        </button>
      </form>
    </div>
  );
};

export default AdminAttendanceCorrection;
