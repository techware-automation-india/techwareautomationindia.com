import { useEffect, useState } from "react";
import { CalendarDays, Loader2, Calendar, RefreshCw, Plus, X, History, ChevronRight, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { apiGet } from "../../lib/api.js";

const formatDate = (dateString) => {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "—";
  
  const day = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const year = date.getFullYear();
  
  return `${day} ${month} ${year}`;
};

const isWeekendHoliday = (h) => {
  if (!h) return false;
  const name = (h.name || "").toLowerCase();
  const type = (h.holidayType || "").toUpperCase();
  if (type === "NATIONAL" || type === "FESTIVAL") {
    return false;
  }
  const date = new Date(h.date);
  const isWeekend = !Number.isNaN(date.getTime()) && (date.getDay() === 0 || date.getDay() === 6);
  return isWeekend || name.includes("sunday") || name.includes("weekend") || name.includes("weekly");
};

const getHolidayTypeLabel = (h) => {
  const type = (h?.holidayType || "").toUpperCase();
  if (type === "NATIONAL") return "National";
  if (type === "FESTIVAL") return "Festival";
  if (type === "OPTIONAL") return "Optional";
  if (isWeekendHoliday(h)) return "Weekend";
  return "Company";
};

const getHolidayBadgeClass = (h) => {
  const label = getHolidayTypeLabel(h);
  if (label === "National") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400";
  if (label === "Festival") return "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400";
  if (label === "Weekend") return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400";
  return "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400";
};

const AcademicCalendar = () => {
  const navigate = useNavigate();
  const [balances, setBalances] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [allHolidaysList, setAllHolidaysList] = useState([]);
  const [myLeaveRequests, setMyLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLeaveType, setSelectedLeaveType] = useState(null);
  const [showHolidaysModal, setShowHolidaysModal] = useState(false);
  const [holidayTypeFilter, setHolidayTypeFilter] = useState("ALL");

  const loadData = async () => {
    setLoading(true);
    try {
      const [balancesRes, holidaysRes, myLeaveRes] = await Promise.all([
        apiGet("/leave/balances"),
        apiGet("/holidays").catch(() => ({ holidays: [] })),
        apiGet("/leave/my").catch(() => ({ requests: [] })),
      ]);
      
      const rawHolidays = holidaysRes.holidays || [];
      setBalances(balancesRes.balances || []);
      setMyLeaveRequests(myLeaveRes.requests || []);
      setAllHolidaysList(rawHolidays);
      
      // Filter upcoming holidays and limit to 5
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const upcomingHolidays = rawHolidays
        .filter((holiday) => {
          const holidayDate = new Date(holiday.date);
          return holidayDate >= today;
        })
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 5);
      
      setHolidays(upcomingHolidays);
    } catch (err) {
      toast.error(err.message || "Failed to load calendar data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="p-12 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading calendar...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <CalendarDays className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Academic Calendar</h1>
            <p className="text-sm text-muted-foreground">
              View your leave balances and upcoming holidays.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-60 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => navigate("/employee/requests/apply-leave")}
            className="cta-gradient text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Apply for Leave
          </button>
        </div>
      </div>

      {/* Leave Types / Balances Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Your Leave Balances</h2>
          <span className="text-xs text-muted-foreground">Click any leave card to view taking leave history</span>
        </div>
        
        {balances.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground bg-background">
            No leave types configured yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {balances.map((balance) => {
              const pct = balance.allocated > 0 ? Math.min(100, (balance.used / balance.allocated) * 100) : 0;
              const historyCount = myLeaveRequests.filter((r) => r.leaveTypeId === balance.leaveTypeId).length;

              return (
                <div
                  key={balance.leaveTypeId}
                  onClick={() => setSelectedLeaveType(balance)}
                  className="group relative rounded-2xl bg-background border border-border card-shadow p-5 space-y-3 hover:border-primary/60 hover:shadow-md cursor-pointer transition-all"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider group-hover:text-primary transition-colors">
                      {balance.leaveTypeCode}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      balance.isPaid 
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" 
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    }`}>
                      {balance.isPaid ? "Paid" : "Unpaid"}
                    </span>
                  </div>

                  {/* Leave Type Name */}
                  <div>
                    <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors" title={balance.leaveTypeName}>
                      {balance.leaveTypeName}
                    </p>
                  </div>

                  {/* Leave Stats */}
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-muted-foreground">Total Leaves</span>
                      <span className="text-lg font-bold text-foreground">{balance.allocated}</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-muted-foreground">Used</span>
                      <span className="text-lg font-bold text-rose-600 dark:text-rose-400">{balance.used}</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-muted-foreground">Remaining</span>
                      <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{balance.remaining}</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct > 80 ? "bg-rose-500" : pct > 50 ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* Footer Action Hint */}
                  <div className="pt-1 flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 group-hover:border-primary/20">
                    <span className="flex items-center gap-1 font-medium group-hover:text-primary transition-colors">
                      <History className="h-3.5 w-3.5" /> History ({historyCount})
                    </span>
                    <span className="flex items-center font-medium group-hover:text-primary transition-colors">
                      View <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Admin Created Total Holidays Card Div */}
            <div
              onClick={() => setShowHolidaysModal(true)}
              className="group relative rounded-2xl bg-background border border-border card-shadow p-5 space-y-3 hover:border-primary/60 hover:shadow-md cursor-pointer transition-all"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider group-hover:text-primary transition-colors">
                  HOLIDAYS
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                  Admin Created
                </span>
              </div>

              {/* Name */}
              <div>
                <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                  Company Holidays
                </p>
              </div>

              {/* Holiday Stats */}
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">National Holidays</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                    {allHolidaysList.filter((h) => (h.holidayType || "").toUpperCase() === "NATIONAL" && !isWeekendHoliday(h)).length}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">Festival Holidays</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400">
                    {allHolidaysList.filter((h) => (h.holidayType || "").toUpperCase() === "FESTIVAL" && !isWeekendHoliday(h)).length}
                  </span>
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-xs text-muted-foreground font-semibold">Total Holidays</span>
                  <span className="text-2xl font-bold text-primary">{allHolidaysList.length}</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all w-full" />
              </div>

              {/* Footer */}
              <div className="pt-1 flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 group-hover:border-primary/20">
                <span className="flex items-center gap-1 font-medium group-hover:text-primary transition-colors">
                  <Calendar className="h-3.5 w-3.5" /> All Holidays ({allHolidaysList.length})
                </span>
                <span className="flex items-center font-medium group-hover:text-primary transition-colors">
                  View <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Upcoming Holidays Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" /> Upcoming Holidays
            <span className="text-sm font-normal text-muted-foreground">(Next 5 Holidays)</span>
          </h2>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Admin Created Holidays</span>
          </div>
        </div>

        {/* Admin Created Holiday Info Banner Div */}
        <div className="p-3 rounded-xl bg-secondary/60 border border-border text-xs text-muted-foreground flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary shrink-0" />
            <span>Official company holiday calendar created and published by Admin.</span>
          </div>
          <span className="text-[11px] font-medium text-primary shrink-0">Showing top 5 upcoming holidays</span>
        </div>
        
        {holidays.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground bg-background">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
            No upcoming holidays found.
          </div>
        ) : (
          <div className="rounded-2xl bg-background border border-border card-shadow divide-y divide-border overflow-hidden">
            {holidays.map((holiday) => {
              const hDate = new Date(holiday.date);
              const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][hDate.getDay()];
              return (
                <div
                  key={holiday.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-secondary/40 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex flex-col items-center justify-center font-bold shrink-0">
                      <span className="text-[10px] uppercase leading-none">
                        {hDate.toLocaleDateString("en-US", { month: "short" })}
                      </span>
                      <span className="text-base leading-none mt-1">
                        {String(hDate.getDate()).padStart(2, "0")}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground text-sm">
                          {holiday.name}
                        </h3>
                      </div>
                      {holiday.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {holiday.description}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground sm:self-center pl-16 sm:pl-0">
                    <span className="px-2.5 py-1 rounded-full bg-secondary font-medium text-foreground">
                      {dayName}
                    </span>
                    {getHolidayTypeLabel(holiday) !== "Weekend" && (
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getHolidayBadgeClass(holiday)}`}>
                        {getHolidayTypeLabel(holiday)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Leave History Modal */}
      {selectedLeaveType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedLeaveType(null)}
          />
          <div className="relative bg-background rounded-2xl border border-border shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-border bg-secondary/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {selectedLeaveType.leaveTypeCode}
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
                    {selectedLeaveType.leaveTypeName}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      selectedLeaveType.isPaid 
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" 
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    }`}>
                      {selectedLeaveType.isPaid ? "Paid" : "Unpaid"}
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Taking Leave History • Year {selectedLeaveType.year}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLeaveType(null)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Leave Balance Stats Bar */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-secondary/10 border-b border-border text-center">
              <div>
                <div className="text-xs text-muted-foreground font-medium">Total Allocated</div>
                <div className="text-base font-bold text-foreground mt-0.5">{selectedLeaveType.allocated} days</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-medium">Leaves Taken (Used)</div>
                <div className="text-base font-bold text-rose-600 dark:text-rose-400 mt-0.5">{selectedLeaveType.used} days</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-medium">Remaining</div>
                <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{selectedLeaveType.remaining} days</div>
              </div>
            </div>

            {/* Leave Requests List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Applied Leave History
                </h4>
                <span className="text-xs font-semibold text-primary">
                  {myLeaveRequests.filter((r) => r.leaveTypeId === selectedLeaveType.leaveTypeId).length} Total Record(s)
                </span>
              </div>

              {myLeaveRequests.filter((r) => r.leaveTypeId === selectedLeaveType.leaveTypeId).length === 0 ? (
                <div className="p-8 text-center border border-dashed border-border rounded-xl">
                  <History className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No leave history found for {selectedLeaveType.leaveTypeName}.</p>
                </div>
              ) : (
                myLeaveRequests
                  .filter((r) => r.leaveTypeId === selectedLeaveType.leaveTypeId)
                  .map((req) => (
                    <div
                      key={req.id}
                      className="p-4 rounded-xl border border-border bg-background space-y-2 hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {formatDate(req.startDate)} → {formatDate(req.endDate)}
                          </span>
                          <span className="text-xs font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">
                            {req.totalDays} day{req.totalDays > 1 ? "s" : ""}
                          </span>
                        </div>
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                            req.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                              : req.status === "REJECTED"
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                              : req.status === "CANCELLED"
                              ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                          }`}
                        >
                          {req.status}
                        </span>
                      </div>

                      {req.reason && (
                        <p className="text-xs text-muted-foreground bg-secondary/30 p-2.5 rounded-lg border border-border/50">
                          <span className="font-semibold text-foreground">Reason: </span>
                          {req.reason}
                        </p>
                      )}

                      {req.reviewNote && (
                        <p className="text-xs text-muted-foreground bg-primary/5 p-2.5 rounded-lg border border-primary/10">
                          <span className="font-semibold text-primary">Admin Note: </span>
                          {req.reviewNote}
                        </p>
                      )}
                    </div>
                  ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border flex justify-end bg-secondary/10">
              <button
                onClick={() => setSelectedLeaveType(null)}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* All Holidays Modal */}
      {showHolidaysModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm transition-opacity"
            onClick={() => setShowHolidaysModal(false)}
          />
          <div className="relative bg-background rounded-2xl border border-border shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-border bg-secondary/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-foreground">
                    Admin Created Holidays
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Complete list of official company holidays created by Admin
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHolidaysModal(false)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Total Count Bar with Type Filters */}
            <div className="px-6 py-3 bg-secondary/10 border-b border-border flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setHolidayTypeFilter("ALL")}
                  className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
                    holidayTypeFilter === "ALL"
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All ({allHolidaysList.length})
                </button>
                <button
                  onClick={() => setHolidayTypeFilter("NATIONAL")}
                  className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
                    holidayTypeFilter === "NATIONAL"
                      ? "bg-emerald-600 text-white font-semibold"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 hover:bg-emerald-200"
                  }`}
                >
                  National ({allHolidaysList.filter((h) => (h.holidayType || "").toUpperCase() === "NATIONAL" && !isWeekendHoliday(h)).length})
                </button>
                <button
                  onClick={() => setHolidayTypeFilter("FESTIVAL")}
                  className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${
                    holidayTypeFilter === "FESTIVAL"
                      ? "bg-purple-600 text-white font-semibold"
                      : "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 hover:bg-purple-200"
                  }`}
                >
                  Festival ({allHolidaysList.filter((h) => (h.holidayType || "").toUpperCase() === "FESTIVAL" && !isWeekendHoliday(h)).length})
                </button>
              </div>
              <span className="text-xs text-muted-foreground">Official Calendar</span>
            </div>

            {/* Holidays List */}
            <div className="p-6 overflow-y-auto space-y-3">
              {(() => {
                const filteredList = holidayTypeFilter === "ALL"
                  ? allHolidaysList
                  : holidayTypeFilter === "NATIONAL"
                  ? allHolidaysList.filter((h) => (h.holidayType || "").toUpperCase() === "NATIONAL" && !isWeekendHoliday(h))
                  : allHolidaysList.filter((h) => (h.holidayType || "").toUpperCase() === holidayTypeFilter && !isWeekendHoliday(h));

                if (filteredList.length === 0) {
                  return (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      No {holidayTypeFilter !== "ALL" ? holidayTypeFilter.toLowerCase() : ""} holidays created by Admin yet.
                    </div>
                  );
                }

                return filteredList.map((h) => {
                  const hDate = new Date(h.date);
                  const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][hDate.getDay()];
                  return (
                    <div
                      key={h.id}
                      className="p-3.5 rounded-xl border border-border bg-background flex items-center justify-between gap-3 hover:bg-secondary/20 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-lg bg-primary/10 text-primary flex flex-col items-center justify-center font-bold shrink-0">
                          <span className="text-[9px] uppercase leading-none">
                            {hDate.toLocaleDateString("en-US", { month: "short" })}
                          </span>
                          <span className="text-sm leading-none mt-0.5">
                            {String(hDate.getDate()).padStart(2, "0")}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-foreground">{h.name}</h4>
                          {h.description && (
                            <p className="text-xs text-muted-foreground">{h.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full bg-secondary text-xs font-medium text-foreground">
                          {dayName}
                        </span>
                        {getHolidayTypeLabel(h) !== "Weekend" && (
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getHolidayBadgeClass(h)}`}>
                            {getHolidayTypeLabel(h)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border flex justify-end bg-secondary/10">
              <button
                onClick={() => setShowHolidaysModal(false)}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AcademicCalendar;
