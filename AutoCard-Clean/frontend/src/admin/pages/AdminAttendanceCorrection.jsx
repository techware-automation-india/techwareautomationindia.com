import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiPost } from "../../lib/api.js";

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

const AdminAttendanceCorrection = () => {
  const navigate = useNavigate();

  const [indiaNow, setIndiaNow] = useState(getIndiaNow);

  const [punchType, setPunchType] = useState("check-in");

  const [date, setDate] = useState(indiaNow.date);

  const [checkInTime, setCheckInTime] = useState(indiaNow.time);

  const [checkOutTime, setCheckOutTime] = useState(indiaNow.time);

  const [reason, setReason] = useState("");

  const [submitting, setSubmitting] = useState(false);

  // ---------------------------------------------
  // Current India time refresh
  // ---------------------------------------------

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setIndiaNow(getIndiaNow());
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

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

    // Give current India time as default
    if (value === "check-in") {
      setCheckInTime(indiaNow.time);
    }

    if (value === "check-out") {
      setCheckOutTime(indiaNow.time);
    }

    if (value === "both") {
      setCheckInTime(indiaNow.time);
      setCheckOutTime(indiaNow.time);
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

    if (!date) {
      toast.error("Please select a date.");
      return;
    }

    if (!reason.trim()) {
      toast.error("Please enter a reason.");
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
    // Required time validation
    // -------------------------------------------

    if ((punchType === "check-in" || punchType === "both") && !checkInTime) {
      toast.error("Please select check-in time.");
      return;
    }

    if ((punchType === "check-out" || punchType === "both") && !checkOutTime) {
      toast.error("Please select check-out time.");
      return;
    }

    // -------------------------------------------
    // Future time validation for TODAY
    // -------------------------------------------

    if (date === indiaNow.date) {
      if (
        (punchType === "check-in" || punchType === "both") &&
        checkInTime > indiaNow.time
      ) {
        toast.error("Future check-in time is not allowed.");
        return;
      }

      if (
        (punchType === "check-out" || punchType === "both") &&
        checkOutTime > indiaNow.time
      ) {
        toast.error("Future check-out time is not allowed.");
        return;
      }
    }

    // -------------------------------------------
    // Both validation
    // -------------------------------------------

    if (punchType === "both" && checkOutTime <= checkInTime) {
      toast.error("Check-out time must be greater than check-in time.");
      return;
    }

    // -------------------------------------------
    // API payload
    // -------------------------------------------

    const correctionData = {
      date,
      punchType,

      checkInTime: punchType === "check-out" ? null : checkInTime,

      checkOutTime: punchType === "check-in" ? null : checkOutTime,

      reason: reason.trim(),
    };

    setSubmitting(true);

    try {
      const response = await apiPost(
        "/attendance/manual-correction",
        correctionData,
      );

      toast.success(response?.message || "Attendance updated successfully.");

      setReason("");

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
          <h1 className="font-display text-2xl font-bold">Attendance Fill</h1>

          <p className="text-sm text-muted-foreground">
            Fill or correct attendance directly without approval.
          </p>
        </div>
      </div>

      {/* ================= FORM ================= */}

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-border bg-background p-6 card-shadow"
      >
        {/* Punch Type */}

        <label className="block text-sm font-medium">
          Punch Type
          <select
            value={punchType}
            onChange={handlePunchTypeChange}
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
          >
            <option value="check-in">Check In</option>

            <option value="check-out">Check Out</option>

            <option value="both">Check In + Check Out</option>
          </select>
        </label>

        {/* Date */}

        <label className="block text-sm font-medium">
          Date
          <input
            type="date"
            required
            value={date}
            max={indiaNow.date}
            onChange={handleDateChange}
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
          />
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

        {/* Submit */}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send className="h-4 w-4" />

          {submitting ? "Saving..." : "Save Attendance"}
        </button>
      </form>
    </div>
  );
};

export default AdminAttendanceCorrection;
