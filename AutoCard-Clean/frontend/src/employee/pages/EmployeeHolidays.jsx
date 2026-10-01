import { useEffect, useState } from "react";
import { CalendarDays, Loader2, RefreshCw, Search, Sparkles, Flag, CalendarCheck, Clock } from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "../../lib/api.js";

const fmt = (v) => {
  if (!v) return "—";
  const date = new Date(v);
  if (Number.isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const getDayName = (dateStr) => {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "—";
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getDay()];
};

const StatCard = ({ icon: Icon, label, value, tone }) => {
  const tones = {
    primary: "bg-primary/10 text-primary",
    blue: "bg-blue-500/10 text-blue-600",
    emerald: "bg-emerald-500/10 text-emerald-600",
    amber: "bg-amber-500/10 text-amber-600",
  };
  return (
    <div className="rounded-2xl bg-background border border-border card-shadow p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${tones[tone]}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <div className="font-display text-2xl font-bold leading-none">{value}</div>
        <div className="text-xs text-muted-foreground mt-1.5">{label}</div>
      </div>
    </div>
  );
};

const EmployeeHolidays = () => {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState(null);
  const [fiscalYearInfo, setFiscalYearInfo] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("ALL"); // ALL, UPCOMING, NATIONAL, SUNDAY

  const loadFiscalYearInfo = async () => {
    try {
      const data = await apiGet("/holidays/fiscal-year");
      setFiscalYearInfo(data);
      setSelectedFiscalYear(data.currentFiscalYear);
      return data.currentFiscalYear;
    } catch (err) {
      console.error("Failed to load fiscal year info:", err);
      return null;
    }
  };

  const loadHolidays = async (fiscalYear = null) => {
    setLoading(true);
    try {
      const url = fiscalYear ? `/holidays?fiscalYear=${fiscalYear}` : "/holidays";
      const data = await apiGet(url);
      setHolidays(data.holidays || []);
    } catch (err) {
      toast.error(err.message || "Failed to load holiday calendar.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      const currentYear = await loadFiscalYearInfo();
      if (currentYear) {
        await loadHolidays(currentYear);
      }
    })();
  }, []);

  useEffect(() => {
    if (selectedFiscalYear !== null) {
      loadHolidays(selectedFiscalYear);
    }
  }, [selectedFiscalYear]);

  const now = new Date();
  const upcomingCount = holidays.filter((h) => new Date(h.date) >= new Date(now.toDateString())).length;
  const nationalCount = holidays.filter((h) => h.holidayType === "NATIONAL" && !h.name.includes("Sunday")).length;

  const fiscalYearOptions = selectedFiscalYear
    ? [selectedFiscalYear - 1, selectedFiscalYear, selectedFiscalYear + 1]
    : [];

  const filteredHolidays = holidays.filter((h) => {
    const matchesSearch =
      !searchQuery ||
      h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (h.description && h.description.toLowerCase().includes(searchQuery.toLowerCase()));

    let matchesFilter = true;
    if (filterType === "UPCOMING") {
      matchesFilter = new Date(h.date) >= new Date(now.toDateString());
    } else if (filterType === "NATIONAL") {
      matchesFilter = h.holidayType === "NATIONAL" && !h.name.includes("Sunday");
    } else if (filterType === "SUNDAY") {
      matchesFilter = h.name.toLowerCase().includes("sunday");
    }

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <CalendarDays className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Holiday Calendar</h1>
            <p className="text-sm text-muted-foreground">Official company holidays, festival dates & weekly off schedule.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Fiscal Year Selector */}
          {fiscalYearOptions.length > 0 && (
            <div className="flex items-center gap-2 bg-secondary/80 px-3 py-1.5 rounded-xl border border-border">
              <span className="text-xs font-semibold text-muted-foreground">Fiscal Year:</span>
              <select
                value={selectedFiscalYear || ""}
                onChange={(e) => setSelectedFiscalYear(Number(e.target.value))}
                className="bg-transparent text-xs font-bold text-foreground focus:outline-none cursor-pointer"
              >
                {fiscalYearOptions.map((fy) => (
                  <option key={fy} value={fy} className="bg-background text-foreground">
                    FY {fy} - {fy + 1}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={() => loadHolidays(selectedFiscalYear)}
            disabled={loading}
            className="p-2 rounded-xl border border-border bg-background hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh Holidays"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={CalendarCheck} label="Total Holidays" value={holidays.length} tone="primary" />
        <StatCard icon={Clock} label="Upcoming Holidays" value={upcomingCount} tone="emerald" />
        <StatCard icon={Flag} label="National & Festival" value={nationalCount} tone="blue" />
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl bg-background border border-border card-shadow p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search holiday name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { id: "ALL", label: "All" },
            { id: "UPCOMING", label: "Upcoming" },
            { id: "NATIONAL", label: "National & Festival" },
            { id: "SUNDAY", label: "Sundays" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterType === tab.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Holiday Table / List */}
      <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span>Loading holiday schedule...</span>
          </div>
        ) : filteredHolidays.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30 text-muted-foreground" />
            No holidays found matching your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border bg-secondary/40">
                  <th className="px-5 py-3.5 font-semibold">Date</th>
                  <th className="px-5 py-3.5 font-semibold">Day</th>
                  <th className="px-5 py-3.5 font-semibold">Holiday Name</th>
                  <th className="px-5 py-3.5 font-semibold">Type</th>
                  <th className="px-5 py-3.5 font-semibold">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredHolidays.map((h) => {
                  const isUpcoming = new Date(h.date) >= new Date(now.toDateString());
                  const dayName = getDayName(h.date);
                  const isSunday = dayName === "Sunday";

                  return (
                    <tr
                      key={h.id}
                      className={`hover:bg-secondary/20 transition-colors ${
                        isUpcoming ? "bg-emerald-500/[0.02]" : ""
                      }`}
                    >
                      <td className="px-5 py-4 whitespace-nowrap font-medium text-foreground">
                        {fmt(h.date)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-muted-foreground">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                          isSunday ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "bg-secondary text-foreground"
                        }`}>
                          {dayName}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          {h.name}
                          {isUpcoming && (
                            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-bold border border-emerald-500/20">
                              Upcoming
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold ${
                            h.holidayType === "NATIONAL"
                              ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20"
                              : "bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20"
                          }`}
                        >
                          {h.holidayType === "NATIONAL" ? "Official / National" : "Optional / Restricted"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-muted-foreground max-w-xs truncate">
                        {h.description || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeHolidays;
