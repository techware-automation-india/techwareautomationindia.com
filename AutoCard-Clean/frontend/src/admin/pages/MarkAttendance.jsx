import { useEffect, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Fingerprint,
  Loader2,
  LogIn,
  LogOut,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../lib/api.js";
import { getAuthUser } from "../../lib/auth.js";

const fmtTime = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const fmtDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
};

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
  PENDING_APPROVAL: {
    label: "Pending",
    bg: "bg-amber-100",
    text: "text-amber-700",
    dot: "bg-amber-500",
  },
};

const AdminMarkAttendance = () => {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [now, setNow] = useState(new Date());

  const loadToday = async () => {
    setLoading(true);

    try {
      const data = await apiGet("/attendance/me/today");
      setRecord(data.record ?? null);
    } catch (err) {
      toast.error(err.message || "Failed to load today's attendance.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadToday();
  }, []);

  const handleCheckIn = async () => {
    if (checkingIn) return;

    setCheckingIn(true);

    try {
      const data = await apiPost("/attendance/checkin", {});
      const authUser = getAuthUser();

      if (data.record?.id && authUser?.id) {
        localStorage.setItem(`employee-has-checked-in:${authUser.id}`, "true");
      }

      setRecord(data.record ?? null);
      toast.success(data.message || "Admin checked in successfully.");
    } catch (err) {
      toast.error(err.message || "Check-in failed.");
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    if (checkingOut) return;

    setCheckingOut(true);

    try {
      const data = await apiPost("/attendance/checkout", {});
      setRecord(data.record ?? null);
      toast.success(data.message || "Admin checked out successfully.");
    } catch (err) {
      toast.error(err.message || "Check-out failed.");
    } finally {
      setCheckingOut(false);
    }
  };

  const hasCheckedIn = !!record?.checkIn;
  const hasCheckedOut = !!record?.checkOut;
  const statusMeta = record
    ? STATUS_META[record.status] ?? STATUS_META.PRESENT
    : null;

  const workedMs = record?.checkIn
    ? (record.checkOut
        ? new Date(record.checkOut).getTime()
        : now.getTime()) - new Date(record.checkIn).getTime()
    : 0;

  const workedH = Math.floor(workedMs / (1000 * 60 * 60));
  const workedM = Math.floor((workedMs % (1000 * 60 * 60)) / (1000 * 60));
  const workedS = Math.floor((workedMs % (1000 * 60)) / 1000);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Fingerprint className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Mark Attendance</h1>
            <p className="text-sm text-muted-foreground">
              Check in and out for today (Admin).
            </p>
          </div>
        </div>

        <button
          type="button"
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
          Admin attendance does not require GPS location, assigned location, or approval.
        </p>
      </div>

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

      {loading ? (
        <div className="rounded-2xl bg-background border border-border p-10 flex items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : (
        <div className="rounded-2xl bg-background border border-border card-shadow p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold">
              Today's Attendance
            </h2>
            {statusMeta && (
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${statusMeta.bg} ${statusMeta.text}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
                {statusMeta.label}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
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
                {hasCheckedIn ? fmtTime(record.checkIn) : "-"}
              </div>
            </div>

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
                {hasCheckedOut ? fmtTime(record.checkOut) : "-"}
              </div>
            </div>
          </div>

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

          {!hasCheckedIn && (
            <button
              type="button"
              onClick={handleCheckIn}
              disabled={checkingIn}
              className="w-full cta-gradient text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {checkingIn ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <LogIn className="h-5 w-5" />
              )}
              {checkingIn ? "Checking In..." : "Check In"}
            </button>
          )}

          {hasCheckedIn && !hasCheckedOut && (
            <button
              type="button"
              onClick={handleCheckOut}
              disabled={checkingOut}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {checkingOut ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <LogOut className="h-5 w-5" />
              )}
              {checkingOut ? "Checking Out..." : "Check Out"}
            </button>
          )}

          {hasCheckedIn && hasCheckedOut && (
            <div className="w-full rounded-xl bg-emerald-50 border border-emerald-200 py-3 flex items-center justify-center gap-2 text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
              Attendance marked for today
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminMarkAttendance;
