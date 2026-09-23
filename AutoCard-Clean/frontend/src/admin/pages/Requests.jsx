import { useEffect, useState } from "react";
import { Inbox, Loader2, Check, X, RefreshCw, Eye, MapPin, CalendarDays, Search, SlidersHorizontal, MessageSquareText, UserRound, Clock3, FilterX } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "../../lib/api.js";
import OnboardingPreview from "../components/OnboardingPreview.jsx";

const fmt = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const statusStyles = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
};

const typeLabels = {
  ONBOARDING: "Onboarding",
  GENERAL: "General",
  DOCUMENT: "Document",
  EQUIPMENT: "Equipment",
  CORRECTION: "Correction",
  OTHER: "Other",
  LEAVE: "Leave",
  ATTENDANCE: "Attendance",
};

const parseCorrectionRequest = (description) => {
  if (typeof description !== "string") {
    return null;
  }

  const marker = "[ATTENDANCE_CORRECTION]";

  const markerIndex = description.lastIndexOf(marker);

  if (markerIndex < 0) {
    return null;
  }

  const readableDescription = description
    .slice(0, markerIndex)
    .trim();

  const separatedReason = readableDescription
    .split("\n\n")
    .slice(1)
    .join("\n\n")
    .trim();

  const reason =
    separatedReason ||
    readableDescription
      .replace(
        /^Forgot Punch request for .*? on \d{4}-\d{2}-\d{2} at .*?(?:\.\s*|$)/i,
        ""
      )
      .trim();

  try {
    const correction = JSON.parse(
      description.slice(markerIndex + marker.length)
    );

    return {
      ...correction,
      reason,
    };
  } catch {
    return {
      reason,
    };
  }
};

const formatPunchDate = (value) => {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
};

const openAttendanceMap = (request) => {
  const latitude = Number(request.checkInLatitude ?? request.checkOutLatitude);
  const longitude = Number(request.checkInLongitude ?? request.checkOutLongitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    toast.error("Location coordinates are not available for this request.");
    return;
  }
  window.open(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`, "_blank", "noopener,noreferrer");
};

const openCheckInMap = (request) => {
  const latitude = Number(request.checkInLatitude);
  const longitude = Number(request.checkInLongitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    toast.error("Check-in location coordinates are not available.");
    return;
  }
  window.open(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`, "_blank", "noopener,noreferrer");
};

const openCheckOutMap = (request) => {
  const latitude = Number(request.checkOutLatitude);
  const longitude = Number(request.checkOutLongitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    toast.error("Check-out location coordinates are not available.");
    return;
  }
  window.open(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`, "_blank", "noopener,noreferrer");
};

const Requests = ({
  employeePermissions,
  isEmployeeView = false,
  requestType = "ALL",
  pageTitle = "Track Requests",
  pageDescription = "Review employee requests, attendance corrections and onboarding submissions.",
}) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState(null);
  const [previewId, setPreviewId] = useState(null);
  
  // Set default filters to current month/year
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentYear = now.getFullYear();
  
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [monthFilter, setMonthFilter] = useState(String(currentMonth));
  const [yearFilter, setYearFilter] = useState(String(currentYear));
  const [search, setSearch] = useState("");
  const [reasonRequest, setReasonRequest] = useState(null);
  const canReview = !isEmployeeView || employeePermissions?.canEdit === true;
const loadRequests = async () => {
  setLoading(true);

  try {
    console.log("🔄 Fetching /requests...");

    const data = await apiGet("/requests");

    console.log("✅ API /requests:", data);

    const employeeRequests = (data?.requests || []).map((request) => {
      let correction = null;

      if (request.type === "CORRECTION") {
        if (request.notification) {
          correction = {
            date: request.notification.date,
            punchType: request.notification.punchType,
            checkInTime: request.notification.checkInTime,
            checkOutTime: request.notification.checkOutTime,
            reason: request.notification.reason || "",
          };
        } else if (typeof request.description === "string") {
          correction = parseCorrectionRequest(
            request.description
          );
        }
      }

      return {
        ...request,
        source: "employee",
        correction,
        description:
          request.type === "CORRECTION"
            ? correction?.reason || "No reason provided."
            : request.description,
      };
    });

    console.log("✅ Final requests:", employeeRequests);

    setRequests(employeeRequests);
  } catch (err) {
    console.error("❌ /requests ERROR:", err);

    toast.error(
      err?.message || "Failed to load requests."
    );

    setRequests([]);
  } finally {
    setLoading(false);
  }
};

  // User-triggered refresh shows the loading state then refetches.
  const refresh = () => {
    setLoading(true);
    loadRequests();
  };

  useEffect(() => {
    (async () => {
      await loadRequests();
    })();
  }, []);

  const years = [...new Set(
    requests
      .map((request) => request.createdAt ? new Date(request.createdAt).getFullYear() : null)
      .filter(Boolean)
  )].sort((a, b) => b - a);

  const filteredRequests = requests.filter((request) => {
    const matchesType = requestType === "ALL" || request.type === requestType;
    if (!matchesType) return false;

    const created = request.createdAt ? new Date(request.createdAt) : null;
    const year = created && !Number.isNaN(created.getTime()) ? created.getFullYear() : null;
    const month = created && !Number.isNaN(created.getTime()) ? created.getMonth() + 1 : null;

    const matchesStatus = statusFilter === "ALL" || request.status === statusFilter;
    const matchesYear = yearFilter === "ALL" || String(year) === String(yearFilter);
    const matchesMonth = monthFilter === "ALL" || String(month) === String(monthFilter);

    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [
      request.subject,
      request.description,
      request.employee?.fullName,
      request.employee?.employeeCode,
      request.employee?.email,
      typeLabels[request.type],
    ].some((value) => String(value || "").toLowerCase().includes(query));

    return matchesStatus && matchesYear && matchesMonth && matchesSearch;
  });

  const activeFilterCount = [
    statusFilter !== "ALL",
    monthFilter !== "ALL",
    yearFilter !== "ALL",
    Boolean(search.trim()),
  ].filter(Boolean).length;

  const clearFilters = () => {
    setStatusFilter("ALL");
    setMonthFilter("ALL");
    setYearFilter("ALL");
    setSearch("");
  };

  const review = async (id, decision) => {
    if (!canReview) return;
    const request = requests.find((item) => item.id === id);
    if (!request) return;

    setActingId(id);
    try {
      const endpoint = request.source === "leave"
        ? `/leave/admin/${request.sourceId}/${decision}`
        : request.source === "attendance"
          ? `/attendance/${request.sourceId}/${decision}`
          : `/requests/${id}/${decision}`;
      const payload =
        request.source === "leave"
          ? { note: "" }
          : {};

      await apiPost(endpoint, payload);

      toast.success(
        `Request ${decision === "approve" ? "approved" : "rejected"}.`
      );

      setPreviewId(null);
      setReasonRequest(null);
      await loadRequests();
    } catch (err) {
      toast.error(err.message || "Action failed.");
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Inbox className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight">{pageTitle}</h1>
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                  {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {pageDescription}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold shadow-sm transition hover:bg-secondary disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Analytics strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Total", requests.length, "bg-slate-500/10 text-slate-700 dark:text-slate-300"],
          ["Pending", requests.filter((r) => r.status === "PENDING").length, "bg-amber-500/10 text-amber-700 dark:text-amber-400"],
          ["Approved", requests.filter((r) => r.status === "APPROVED").length, "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"],
          ["Rejected", requests.filter((r) => r.status === "REJECTED").length, "bg-rose-500/10 text-rose-700 dark:text-rose-400"],
        ].map(([label, count, tone]) => (
          <div key={label} className="rounded-2xl border border-border bg-background p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
              <span className={`rounded-lg px-2 py-1 text-xs font-bold ${tone}`}>{count}</span>
            </div>
            <div className="mt-2 text-2xl font-bold">{count}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border p-4 lg:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employee, subject, type or reason..."
                className="h-11 w-full rounded-xl border border-border bg-secondary/40 pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/30 px-3">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="h-11 bg-transparent text-sm font-medium outline-none"
                  aria-label="Filter by year"
                >
                  <option value="ALL">All years</option>
                  {years.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/30 px-3">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <select
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                  className="h-11 bg-transparent text-sm font-medium outline-none"
                  aria-label="Filter by month"
                >
                  <option value="ALL">All months</option>
                  {[
                    "January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"
                  ].map((month, index) => (
                    <option key={month} value={index + 1}>{month}</option>
                  ))}
                </select>
              </div>

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                >
                  <FilterX className="h-4 w-4" />
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  ["ALL", "All"],
                  ["PENDING", "Pending"],
                  ["APPROVED", "Approved"],
                  ["REJECTED", "Rejected"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStatusFilter(value)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      statusFilter === value
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-xs font-medium text-muted-foreground">
              Showing <span className="font-bold text-foreground">{filteredRequests.length}</span> of {requests.length} requests
            </div>
          </div>
        </div>

        {/* Request list - Modern Card Design */}
        {loading ? (
          <div className="flex min-h-[280px] items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading requests...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
              <Inbox className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 font-semibold">No requests found</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Try another month, year, status or search term.
            </p>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="p-4 sm:p-5 lg:p-6">
            <div className="grid gap-4 lg:gap-5">
              {filteredRequests.map((r) => (
                <div 
                  key={r.id} 
                  className="group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-background to-secondary/10 shadow-sm transition hover:shadow-md hover:border-primary/20"
                >
                  {/* Status Indicator Bar */}
                  <div className={`absolute left-0 top-0 h-full w-1.5 ${
                    r.status === "PENDING" ? "bg-amber-500" : 
                    r.status === "APPROVED" ? "bg-emerald-500" : "bg-rose-500"
                  }`} />
                  
                  <div className="p-5 pl-7">
                    {/* Header Section */}
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex gap-4">
                        {/* Icon */}
                        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-sm ${
                          r.type === "ATTENDANCE" || r.type === "CORRECTION"
                            ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white"
                            : r.type === "ONBOARDING"
                            ? "bg-gradient-to-br from-purple-500 to-purple-600 text-white"
                            : "bg-gradient-to-br from-slate-500 to-slate-600 text-white"
                        }`}>
                          {r.type === "ATTENDANCE" || r.type === "CORRECTION"
                            ? <Clock3 className="h-6 w-6" />
                            : r.type === "ONBOARDING"
                              ? <UserRound className="h-6 w-6" />
                              : <MessageSquareText className="h-6 w-6" />}
                        </div>

                        {/* Content */}
                        <div className="min-w-0 flex-1">
                          {/* Badges Row */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-primary">
                              {typeLabels[r.type] || r.type}
                            </span>
                            <span className={`rounded-xl px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
                              r.status === "PENDING" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                              r.status === "APPROVED" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                              "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                            }`}>
                              {r.status}
                            </span>
                            {r.createdAt && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <CalendarDays className="h-3.5 w-3.5" />
                                {fmt(r.createdAt)}
                              </span>
                            )}
                          </div>

                          {/* Subject Title */}
                          <h3 className="mt-3 text-lg font-bold leading-tight text-foreground">
                            {r.subject}
                          </h3>

                          {/* Employee Info */}
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-2 rounded-lg bg-secondary/60 px-3 py-1.5">
                              <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-sm font-semibold text-foreground">
                                {r.employee?.fullName}
                              </span>
                            </div>
                            <span className="text-xs font-medium text-muted-foreground">
                              {r.employee?.employeeCode}
                            </span>
                            <span className="hidden text-xs text-muted-foreground sm:inline">•</span>
                            <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                              {r.employee?.email}
                            </span>
                          </div>

                          {/* Correction Details */}
                          {r.correction && (
                            <div className="mt-4 flex flex-wrap gap-2">
                              <div className="flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-2 dark:bg-blue-950/30">
                                <CalendarDays className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
                                  {formatPunchDate(r.correction.date)}
                                </span>
                              </div>
                              {r.correction.checkInTime && (
                                <div className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 dark:bg-emerald-950/30">
                                  <Clock3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                                    In: {r.correction.checkInTime}
                                  </span>
                                </div>
                              )}
                              {r.correction.checkOutTime && (
                                <div className="flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2 dark:bg-rose-950/30">
                                  <Clock3 className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                                  <span className="text-sm font-bold text-rose-700 dark:text-rose-300">
                                    Out: {r.correction.checkOutTime}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* View Reason Button */}
                          {r.description && (
                            <button
                              type="button"
                              onClick={() => setReasonRequest(r)}
                              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-secondary/80 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-primary/10 hover:text-primary"
                            >
                              <MessageSquareText className="h-4 w-4" />
                              <span>
                                {r.type === "CORRECTION" ? "View Reason" : "View Details"}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons - Right Side */}
                      <div className="flex shrink-0 flex-wrap items-center gap-2.5 lg:flex-col lg:items-stretch">
                        {r.status === "PENDING" ? (
                          <>
                            {/* Map Buttons for Attendance */}
                            {r.type === "ATTENDANCE" && (
                              <div className="flex w-full flex-wrap gap-2">
                                {r.checkInLatitude != null && r.checkInLongitude != null && (
                                  <button
                                    onClick={() => openCheckInMap(r)}
                                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 to-emerald-100 px-4 py-2.5 text-sm font-bold text-emerald-700 shadow-sm transition hover:from-emerald-100 hover:to-emerald-200 hover:shadow dark:from-emerald-950/50 dark:to-emerald-900/50 dark:text-emerald-300"
                                    title="View check-in location on map"
                                  >
                                    <MapPin className="h-4 w-4" />
                                    <span>Check-in Map</span>
                                  </button>
                                )}
                                {r.checkOutLatitude != null && r.checkOutLongitude != null && (
                                  <button
                                    onClick={() => openCheckOutMap(r)}
                                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-rose-300 bg-gradient-to-r from-rose-50 to-rose-100 px-4 py-2.5 text-sm font-bold text-rose-700 shadow-sm transition hover:from-rose-100 hover:to-rose-200 hover:shadow dark:from-rose-950/50 dark:to-rose-900/50 dark:text-rose-300"
                                    title="View check-out location on map"
                                  >
                                    <MapPin className="h-4 w-4" />
                                    <span>Check-out Map</span>
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Preview Button for Onboarding */}
                            {r.type === "ONBOARDING" && (
                              <button
                                onClick={() => setPreviewId(r.id)}
                                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-border bg-secondary px-4 py-2.5 text-sm font-bold transition hover:border-primary hover:bg-primary/10 hover:text-primary"
                              >
                                <Eye className="h-4 w-4" />
                                Preview
                              </button>
                            )}

                            {/* Approve/Reject Buttons */}
                            {canReview && (
                              <div className="flex w-full gap-2">
                                <button
                                  type="button"
                                  onClick={() => review(r.id, "approve")}
                                  disabled={actingId === r.id}
                                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:from-emerald-700 hover:to-emerald-800 hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                  {actingId === r.id ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                  ) : (
                                    <Check className="h-5 w-5" />
                                  )}
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => review(r.id, "reject")}
                                  disabled={actingId === r.id}
                                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-rose-300 bg-white px-5 py-3 text-sm font-bold text-rose-700 transition hover:bg-rose-50 hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed dark:bg-background dark:hover:bg-rose-950/20"
                                >
                                  <X className="h-5 w-5" />
                                  Reject
                                </button>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex w-full items-center justify-center rounded-xl bg-secondary/50 px-4 py-3 text-center">
                            <div className="text-xs">
                              <div className="font-semibold text-muted-foreground">Reviewed</div>
                              <div className="mt-0.5 font-bold text-foreground">
                                {r.reviewedAt ? fmt(r.reviewedAt) : "—"}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reason / details modal */}
      {reasonRequest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setReasonRequest(null);
          }}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-background shadow-2xl">
            <div className="flex items-start justify-between border-b border-border p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <MessageSquareText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {reasonRequest.type === "CORRECTION" ? "Request Reason" : "Request Details"}
                  </p>
                  <h3 className="mt-1 font-display text-lg font-bold">{reasonRequest.subject}</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReasonRequest(null)}
                className="rounded-xl p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                aria-label="Close reason"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5 sm:p-6">
              <div className="rounded-2xl border border-border bg-secondary/30 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <UserRound className="h-4 w-4" />
                  {reasonRequest.employee?.fullName} · {reasonRequest.employee?.employeeCode}
                </div>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                  {reasonRequest.description || "No reason provided."}
                </p>
              </div>

              {reasonRequest.createdAt && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Submitted</span>
                  <span className="font-semibold text-foreground">{fmt(reasonRequest.createdAt)}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-border bg-secondary/20 p-4">
              <button
                type="button"
                onClick={() => setReasonRequest(null)}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {previewId && (
        <OnboardingPreview
          requestId={previewId}
          acting={actingId === previewId}
          onClose={() => setPreviewId(null)}
          onApprove={() => review(previewId, "approve")}
          onReject={() => review(previewId, "reject")}
        />
      )}
    </div>
  )
};

export default Requests;
