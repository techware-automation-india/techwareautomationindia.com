import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Clock,
  ArrowRight,
  CalendarDays,
  Inbox,
  MapPin,
  Eye,
  X,
  ExternalLink,
} from "lucide-react";

import { employeeModules } from "../modules.js";
import { getAuthUser } from "../../lib/auth.js";
import { apiGet } from "../../lib/api.js";
import { formatTimeRange } from "../../lib/timeFormat.js";

/* =========================================================
   ROSTER HELPERS
========================================================= */

const rosterDateKey = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getUTCDate()).padStart(2, "0")}`;
};

const addRosterDays = (dateKey, days) => {
  if (!dateKey) {
    return "";
  }

  const date = new Date(`${dateKey}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setUTCDate(date.getUTCDate() + days);

  return rosterDateKey(date);
};

const formatRosterDate = (dateValue) => {
  if (!dateValue) return "—";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();

  return `${day}/${month}/${year}`;
};

const getLocationMapsUrl = (location) => {
  if (!location) {
    return null;
  }

  const hasCoordinates =
    Number.isFinite(Number(location.latitude)) &&
    Number.isFinite(Number(location.longitude));

  const query = hasCoordinates
    ? `${location.latitude},${location.longitude}`
    : [location.name, location.city].filter(Boolean).join(", ");

  if (!query) {
    return null;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    query,
  )}`;
};

/* =========================================================
   GROUP CONSECUTIVE ROSTER ENTRIES
========================================================= */

const groupRosterEntries = (entries) => {
  const groups = [];

  entries.forEach((entry) => {
    const dateKey = rosterDateKey(entry.date);

    // Ignore invalid roster dates
    if (!dateKey) {
      return;
    }

    const previous = groups[groups.length - 1];

    const canJoin =
      previous &&
      previous.shiftId === entry.shiftId &&
      previous.locationId === entry.locationId &&
      (previous.note || "") === (entry.note || "") &&
      addRosterDays(previous.endDate, 1) === dateKey;

    if (canJoin) {
      previous.endDate = dateKey;
      previous.days += 1;
      previous.dates.push(dateKey);
    } else {
      groups.push({
        ...entry,
        startDate: dateKey,
        endDate: dateKey,
        days: 1,
        dates: [dateKey],
      });
    }
  });

  return groups;
};

/* =========================================================
   OVERVIEW
========================================================= */

const Overview = () => {
  const user = getAuthUser();
  const onboardingStatus = user?.onboardingStatus;

  /* -------------------------
     ROSTER STATE
  ------------------------- */

  const [assignedEntries, setAssignedEntries] = useState([]);
  const [loadingRoster, setLoadingRoster] = useState(true);

  /* -------------------------
     NOTIFICATION STATE
  ------------------------- */

  const [requestNotifications, setRequestNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  /* -------------------------
     ROSTER MODAL
  ------------------------- */

  const [selectedAssignment, setSelectedAssignment] = useState(null);

  /* -------------------------
     CURRENT MONTH
  ------------------------- */

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  /* =========================================================
     LOAD EMPLOYEE ROSTER
     
     Checks every 10 seconds so that when Admin assigns
     a roster, employee dashboard updates automatically.
  ========================================================= */

  useEffect(() => {
    let mounted = true;

    const loadRoster = async () => {
      try {
        const data = await apiGet(`/roster/me?year=${year}&month=${month}`);

        if (!mounted) {
          return;
        }

        setAssignedEntries(Array.isArray(data?.entries) ? data.entries : []);
      } catch (err) {
        console.warn("Failed to load roster:", err?.message || err);

        if (mounted) {
          setAssignedEntries([]);
        }
      } finally {
        if (mounted) {
          setLoadingRoster(false);
        }
      }
    };

    // Load immediately
    loadRoster();

    // Refresh every 10 seconds
    const intervalId = window.setInterval(loadRoster, 10000);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, [month, year]);

  /* =========================================================
     LOAD REQUEST / LEAVE / ATTENDANCE / ROSTER NOTIFICATIONS
  ========================================================= */

  useEffect(() => {
    let mounted = true;

    const loadRequestNotifications = async () => {
      try {
        const [requestData, leaveData, attendanceData] =
          await Promise.allSettled([
            apiGet("/requests/my"),
            apiGet("/leave/my"),
            apiGet("/attendance/my-requests"),
          ]);

        const rosterData = await apiGet("/roster/my-notifications").catch(
          () => ({
            entries: [],
          }),
        );

        const requests = [
          /* -------------------------
             NORMAL REQUESTS
          ------------------------- */

          ...(requestData.status === "fulfilled"
            ? requestData.value?.requests || []
            : []),

          /* -------------------------
             LEAVE REQUESTS
          ------------------------- */

          ...(leaveData.status === "fulfilled"
            ? (leaveData.value?.requests || []).map((request) => ({
                ...request,
                subject: `${request.leaveType?.name || "Leave"} request`,
                type: "LEAVE",
              }))
            : []),

          /* -------------------------
             ATTENDANCE REQUESTS
          ------------------------- */

          ...(attendanceData.status === "fulfilled"
            ? (attendanceData.value?.records || []).map((request) => ({
                ...request,
                subject: "Attendance request",
                type: "ATTENDANCE",
                status: request.note?.includes("Approved by admin")
                  ? "APPROVED"
                  : request.note?.includes("Rejected by admin")
                    ? "REJECTED"
                    : "PENDING",
                createdAt: request.updatedAt || request.date,
              }))
            : []),

          /* -------------------------
             ROSTER NOTIFICATIONS
          ------------------------- */

          ...(Array.isArray(rosterData?.entries)
            ? rosterData.entries.map((entry) => ({
                id: entry.id,
                subject: "Roster assignment",
                type: "ROSTER",
                status: "ASSIGNED",
                createdAt: entry.updatedAt || entry.date,
                description: `${entry.shift?.name || "Shift assigned"}${
                  entry.location?.name ? ` · ${entry.location.name}` : ""
                }`,
              }))
            : []),
        ];

        const filteredRequests = requests
          .filter(
            (request) =>
              request.type === "ROSTER" ||
              ["APPROVED", "REJECTED"].includes(request.status),
          )
          .filter((request) => request.createdAt)
          .sort(
            (first, second) =>
              new Date(second.createdAt) - new Date(first.createdAt),
          )
          .slice(0, 5);

        if (mounted) {
          setRequestNotifications(filteredRequests);
        }
      } catch (err) {
        console.warn("Failed to load notifications:", err?.message || err);

        if (mounted) {
          setRequestNotifications([]);
        }
      }
    };

    loadRequestNotifications();

    // Refresh notifications every 10 seconds
    const intervalId = window.setInterval(loadRequestNotifications, 10000);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  /* =========================================================
     MODULES
  ========================================================= */

  // Exclude Overview from module grid.
  const modules = employeeModules.filter((module) => module.key !== "overview");

  /* =========================================================
     ROSTER DATA
  ========================================================= */

  const upcomingAssignments = groupRosterEntries(assignedEntries).slice(0, 3);

  /*
   * IMPORTANT:
   *
   * If assignedEntries has data:
   *     show roster card
   *
   * If assignedEntries is empty:
   *     hide roster card
   */
  const hasAssignments = assignedEntries.length > 0;

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="space-y-8">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">
            Employee Dashboard
          </h1>

          <p className="text-sm text-muted-foreground mt-1">
            Welcome back, {user?.fullName || "Employee"}.{" "}
            {onboardingStatus === "PENDING"
              ? "Let's get you onboarded!"
              : "Select a module to get started."}
          </p>
        </div>

        {/* ===================================================
            NOTIFICATION BUTTON
        =================================================== */}

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowNotifications((visible) => !visible)}
            className="relative rounded-lg border border-border p-3 text-primary transition-colors hover:bg-secondary"
            aria-label={`Notifications${
              requestNotifications.length
                ? `, ${requestNotifications.length} recent`
                : ""
            }`}
            title="Notifications"
          >
            <Bell className="h-6 w-6" />

            {requestNotifications.length > 0 && (
              <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
                {requestNotifications.length}
              </span>
            )}
          </button>

          {/* =================================================
              NOTIFICATION DROPDOWN
          ================================================= */}

          {showNotifications && (
            <div className="absolute right-0 top-full z-20 mt-3 w-72 rounded-xl border border-border bg-background p-4 shadow-lg">
              <div className="flex items-center gap-2 font-semibold">
                <Inbox className="h-4 w-4 text-primary" />
                Notifications
              </div>

              {requestNotifications.length === 0 ? (
                <div className="mt-3 border-t border-border pt-4 text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                    <Inbox className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    No new notifications
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    You're all caught up.
                  </p>
                </div>
              ) : (
                <div className="mt-3 max-h-72 space-y-2 overflow-y-auto border-t border-border pt-3">
                  {requestNotifications.map((request) => {
                    const isRoster = request.type === "ROSTER";
                    const isApproved = request.status === "APPROVED";
                    const isRejected = request.status === "REJECTED";

                    const NotificationIcon = isRoster
                      ? CalendarDays
                      : isApproved
                        ? CheckCircle2
                        : isRejected
                          ? AlertCircle
                          : Inbox;

                    const iconClass = isRoster
                      ? "bg-primary/10 text-primary"
                      : isApproved
                        ? "bg-emerald-100 text-emerald-600"
                        : isRejected
                          ? "bg-red-100 text-red-600"
                          : "bg-secondary text-muted-foreground";

                    const formattedDate = request.createdAt
                      ? new Date(request.createdAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })
                      : "—";

                    return (
                      <div
                        key={`${request.type}-${request.id}`}
                        className="flex items-start gap-3 rounded-xl border border-border bg-background p-3 transition-colors hover:bg-secondary/50"
                      >
                        <div
                          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconClass}`}
                        >
                          <NotificationIcon className="h-4.5 w-4.5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-foreground">
                              {request.subject || "Notification"}
                            </p>
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              {formattedDate}
                            </span>
                          </div>

                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {request.description || request.status || "Request update"}
                          </p>

                          <span
                            className={`mt-2 inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                              isApproved
                                ? "bg-emerald-100 text-emerald-700"
                                : isRejected
                                  ? "bg-red-100 text-red-700"
                                  : isRoster
                                    ? "bg-primary/10 text-primary"
                                    : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            {request.status || "UPDATE"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <Link
                to="/employee/requests/track"
                onClick={() => setShowNotifications(false)}
                className="mt-3 inline-flex text-sm font-semibold text-primary hover:underline"
              >
                Open Request Tracker
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* =====================================================
          ONBOARDING - PENDING
      ===================================================== */}

      {onboardingStatus === "PENDING" && (
        <div className="rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/50 p-8 card-shadow">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
              <AlertCircle className="h-6 w-6 text-white" />
            </div>

            <div className="flex-1">
              <h2 className="font-display text-xl font-bold text-amber-900 mb-2">
                Complete Your Onboarding
              </h2>

              <p className="text-sm text-amber-800 leading-relaxed mb-4">
                To access all employee features like attendance tracking and
                leave management, you need to complete your onboarding form
                first. This is a one-time process and takes about 10 minutes.
              </p>

              <Link
                to="/employee/onboarding"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm transition-colors"
              >
                Complete Onboarding Now
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          ONBOARDING - SUBMITTED
      ===================================================== */}

      {onboardingStatus === "SUBMITTED" && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5 text-white" />
          </div>

          <div>
            <h3 className="font-semibold text-blue-900 mb-1">
              Onboarding Under Review
            </h3>

            <p className="text-sm text-blue-800">
              Your onboarding form has been submitted and is awaiting admin
              approval. You'll be notified once it's processed.
            </p>
          </div>
        </div>
      )}

      {/* =====================================================
          ONBOARDING - APPROVED
      ===================================================== */}

      {onboardingStatus === "APPROVED" && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5 text-white" />
          </div>

          <div>
            <h3 className="font-semibold text-emerald-900 mb-1">
              Onboarding Complete
            </h3>

            <p className="text-sm text-emerald-800">
              Welcome aboard! Your onboarding has been approved. You now have
              full access to all employee modules.
            </p>
          </div>
        </div>
      )}

      {/* =====================================================
          ASSIGNED SHIFTS & LOCATIONS
          
          IMPORTANT:
          Only render this entire card when an assignment
          exists.
      ===================================================== */}

      {hasAssignments && (
        <div className="rounded-2xl border border-border bg-background p-6 card-shadow">
          {/* =================================================
              ROSTER HEADER
          ================================================= */}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-xl font-semibold">
                Assigned Shifts &amp; Locations
              </h2>

              <p className="text-sm text-muted-foreground">
                See the shifts and locations assigned to you by the admin for{" "}
                {new Date(year, month - 1).toLocaleString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
                .
              </p>
            </div>

            <div className="text-sm text-muted-foreground">
              {assignedEntries.length} day
              {assignedEntries.length === 1 ? "" : "s"} assigned
            </div>
          </div>

          {/* =================================================
              ROSTER CONTENT
          ================================================= */}

          {loadingRoster ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading assignments…
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingAssignments.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-2xl border border-border bg-background p-4 sm:p-5 shadow-sm hover:border-primary/30 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    {/* =====================================
                          ASSIGNMENT INFORMATION
                      ===================================== */}

                    <div className="min-w-0">
                      {/* DATE */}

                      <div className="flex items-center gap-2 mb-2">
                        <CalendarDays className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm font-semibold text-foreground">
                          {formatRosterDate(entry.date)}
                          {" • "}
                          {entry.shift
                            ? formatTimeRange(
                                entry.shift.startTime,
                                entry.shift.endTime,
                              )
                            : "No time assigned"}
                        </span>
                      </div>

                      {/* SHIFT + LOCATION */}

                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                        {/* SHIFT */}

                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Shift
                          </p>

                          <p className="text-sm font-semibold text-foreground">
                            {entry.shift?.name || "No shift assigned"}
                          </p>

                          {entry.shift && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatTimeRange(
                                entry.shift.startTime,
                                entry.shift.endTime,
                              )}
                            </p>
                          )}
                        </div>

                        {/* LOCATION */}

                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Location
                          </p>

                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-primary" />

                            <p className="text-sm font-semibold text-foreground truncate max-w-[220px]">
                              {entry.location?.name || "No specific location"}
                            </p>
                          </div>

                          {entry.location?.city && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {entry.location.city}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* =====================================
                          VIEW DETAILS
                      ===================================== */}

                    <button
                      type="button"
                      onClick={() => setSelectedAssignment(entry)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors shrink-0"
                    >
                      <Eye className="h-4 w-4" />
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================
          ROSTER DETAILS MODAL
      ===================================================== */}

      {selectedAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4">
          {/* BACKDROP */}

          <button
            type="button"
            aria-label="Close roster details"
            className="absolute inset-0 cursor-default"
            onClick={() => setSelectedAssignment(null)}
          />

          {/* MODAL */}

          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-background p-6 shadow-xl">
            {/* MODAL HEADER */}

            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-semibold">
                  Roster Details
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  {formatRosterDate(selectedAssignment.startDate)}

                  {selectedAssignment.startDate !==
                    selectedAssignment.endDate &&
                    ` – ${formatRosterDate(selectedAssignment.endDate)}`}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAssignment(null)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                aria-label="Close roster details"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* MODAL CONTENT */}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {/* SHIFT */}

              <div className="rounded-xl border border-border bg-secondary/5 p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Shift
                </div>

                <div className="mt-1 text-sm font-semibold">
                  {selectedAssignment.shift?.name || "No shift assigned"}
                </div>

                <div className="mt-1 text-xs text-muted-foreground">
                  {selectedAssignment.shift
                    ? formatTimeRange(
                        selectedAssignment.shift.startTime,
                        selectedAssignment.shift.endTime,
                      )
                    : "—"}
                </div>
              </div>

              {/* LOCATION */}

              <div className="rounded-xl border border-border bg-secondary/5 p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Location
                </div>

                <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
                  <MapPin className="h-4 w-4 text-primary" />

                  {selectedAssignment.location?.name || "No specific location"}
                </div>

                {selectedAssignment.location?.city && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {selectedAssignment.location.city}
                  </div>
                )}

                {/* GOOGLE MAPS */}

                {getLocationMapsUrl(selectedAssignment.location) && (
                  <a
                    href={getLocationMapsUrl(selectedAssignment.location)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open in Google Maps
                  </a>
                )}
              </div>

              {/* ASSIGNED DAYS */}

              <div className="rounded-xl border border-border bg-secondary/5 p-3 sm:col-span-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Assigned Days ({selectedAssignment.days})
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedAssignment.dates.map((date) => (
                    <span
                      key={date}
                      className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                    >
                      {formatRosterDate(date)}
                    </span>
                  ))}
                </div>
              </div>

              {/* NOTE */}

              <div className="rounded-xl border border-border bg-secondary/5 p-3 sm:col-span-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Note
                </div>

                <div className="mt-1 text-sm">
                  {selectedAssignment.note || "No note added"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          EMPLOYEE MODULES
      ===================================================== */}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {modules.map(({ key, label, path, icon: Icon, description }) => {
          // Disable non-onboarding modules if status
          // is PENDING, except Mark Attendance.

          const isPending = onboardingStatus === "PENDING";

          const isOnboardingModule = key === "onboarding";

          const isMarkAttendance = key === "mark-attendance";

          const isDisabled =
            isPending && !isOnboardingModule && !isMarkAttendance;

          /* =============================================
               DISABLED MODULE
            ============================================= */

          if (isDisabled) {
            return (
              <div
                key={key}
                className="rounded-2xl bg-secondary/40 border border-border p-6 opacity-50 cursor-not-allowed"
              >
                <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center mb-4">
                  <Icon className="h-5.5 w-5.5 text-muted-foreground" />
                </div>

                <h3 className="font-display font-semibold mb-1 text-muted-foreground">
                  {label}
                </h3>

                <p className="text-sm text-muted-foreground leading-relaxed">
                  {description}
                </p>

                <p className="text-xs text-amber-600 mt-2 font-medium">
                  🔒 Complete onboarding first
                </p>
              </div>
            );
          }

          /* =============================================
               ACTIVE MODULE
            ============================================= */

          return (
            <Link
              key={key}
              to={path}
              className="group rounded-2xl bg-background border border-border p-6 card-shadow hover:card-shadow-hover hover:border-primary/30 transition-all duration-300"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Icon className="h-5.5 w-5.5 text-primary" />
              </div>

              <h3 className="font-display font-semibold mb-1">{label}</h3>

              <p className="text-sm text-muted-foreground leading-relaxed">
                {description}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default Overview;
