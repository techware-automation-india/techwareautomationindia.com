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

const AttendanceCorrection = ({ correctionType }) => {
  const navigate = useNavigate();
  const [indiaNow, setIndiaNow] = useState(getIndiaNow);
  const [punchType, setPunchType] = useState(correctionType || "check-in");
  const label = "Forgot Punch";
  const punchLabel =
    punchType === "check-in"
      ? "Check In"
      : punchType === "check-out"
        ? "Check Out"
        : "Check In and Check Out";
  const [date, setDate] = useState(indiaNow.date);
  const [time, setTime] = useState(indiaNow.time);
  const [checkOutTime, setCheckOutTime] = useState(indiaNow.time);
  const [reason, setReason] = useState("");
  const [checkInLocation, setCheckInLocation] = useState("");
  const [checkOutLocation, setCheckOutLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const refreshIndiaNow = () => {
      const nextIndiaNow = getIndiaNow();
      setIndiaNow(nextIndiaNow);

      if (date === nextIndiaNow.date) {
        setTime(nextIndiaNow.time);
        setCheckOutTime(nextIndiaNow.time);
      }
    };

    const intervalId = window.setInterval(refreshIndiaNow, 60_000);

    return () => window.clearInterval(intervalId);
  }, [date]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!reason.trim()) {
      toast.error("Please enter a reason.");
      return;
    }

    setSubmitting(true);
    try {
      const correctionData = {
        date,
        punchType,
        checkInTime: punchType === "check-out" ? null : time,
        checkOutTime:
          punchType === "check-in"
            ? null
            : punchType === "both"
              ? checkOutTime
              : time,
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
      
      await apiPost("/requests/my", {
        type: "CORRECTION",
        subject: `${label} - ${punchLabel}`,
        description: `${label} request for ${punchLabel} on ${date} at ${punchType === "both" ? `check-in ${time} and check-out ${checkOutTime}` : `${punchLabel.toLowerCase()} ${time}`}.\n\n${reason.trim()}${locationText}\n[ATTENDANCE_CORRECTION]${JSON.stringify(correctionData)}`,
      });
      toast.success(`${label} request submitted.`);
      setReason("");
      setCheckInLocation("");
      setCheckOutLocation("");
    } catch (err) {
      toast.error(err.message || "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  };

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
          <h1 className="font-display text-2xl font-bold">{label}</h1>
          <p className="text-sm text-muted-foreground">
            Submit an attendance correction request for admin review.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-border bg-background p-6 card-shadow"
      >
        <label className="block text-sm font-medium">
          Punch Type
          <select
            value={punchType}
            onChange={(event) => setPunchType(event.target.value)}
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
          >
            <option value="check-in">Check In</option>
            <option value="check-out">Check Out</option>
            <option value="both">Check In + Check Out (One Request)</option>
          </select>
        </label>
        <label className="block text-sm font-medium">
          Date
          <input
            type="date"
            required
            value={date}
            max={indiaNow.date}
            onChange={(event) => {
              const nextDate = event.target.value;
              setDate(nextDate);

              if (nextDate === indiaNow.date) {
                if (time > indiaNow.time) setTime(indiaNow.time);
                if (checkOutTime > indiaNow.time) {
                  setCheckOutTime(indiaNow.time);
                }
              }
            }}
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
          />
        </label>
        <label className="block text-sm font-medium">
          {punchType === "check-out" ? "Check Out Time" : "Check In Time"}
          <input
            type="time"
            required
            value={time}
            max={date === indiaNow.date ? indiaNow.time : undefined}
            onChange={(event) => setTime(event.target.value)}
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
          />
        </label>
        {punchType === "both" && (
          <label className="block text-sm font-medium">
            Check Out Time
            <input
              type="time"
              required
              value={checkOutTime}
              max={date === indiaNow.date ? indiaNow.time : undefined}
              onChange={(event) => setCheckOutTime(event.target.value)}
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
              placeholder="Where were you during check-in? (e.g., 'Client Office, Mumbai')"
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
            />
            <p className="mt-1 text-xs text-muted-foreground">Optional: Your location at check-in time</p>
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
            <p className="mt-1 text-xs text-muted-foreground">Optional: Your location at check-out time</p>
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
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
          {submitting ? "Submitting..." : "Submit Request"}
        </button>
      </form>
    </div>
  );
};

export default AttendanceCorrection;
