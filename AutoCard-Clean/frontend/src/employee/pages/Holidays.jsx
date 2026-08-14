import { useEffect, useState } from "react";
import { CalendarDays, Loader2, RefreshCw } from "lucide-react";
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

const StatCard = ({ icon: Icon, label, value, tone }) => {
  const tones = {
    primary: "bg-primary/10 text-primary",
    blue: "bg-blue-100 text-blue-700",
    amber: "bg-amber-100 text-amber-700",
  };
  return (
    <div className="rounded-2xl bg-background border border-border card-shadow p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${tones[tone]}`}>
        <Icon className="h-5.5 w-5.5" />
      </div>
      <div>
        <div className="font-display text-2xl font-bold leading-none">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </div>
    </div>
  );
};

const Holidays = () => {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fiscalYearInfo, setFiscalYearInfo] = useState(null);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState(null);

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

  const load = async (fiscalYear = null) => {
    try {
      const url = fiscalYear ? `/holidays?fiscalYear=${fiscalYear}` : "/holidays";
      const data = await apiGet(url);
      setHolidays(data.holidays);
    } catch (err) {
      toast.error(err.message || "Failed to load holidays.");
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    setLoading(true);
    load(selectedFiscalYear);
  };

  useEffect(() => {
    (async () => {
      const currentYear = await loadFiscalYearInfo();
      if (currentYear) {
        await load(currentYear);
      }
    })();
  }, []);

  useEffect(() => {
    if (selectedFiscalYear !== null) {
      setLoading(true);
      load(selectedFiscalYear);
    }
  }, [selectedFiscalYear]);

  const now = new Date();
  const upcoming = holidays.filter((h) => new Date(h.date) >= new Date(now.toDateString())).length;

  // Generate fiscal year options
  const fiscalYearOptions = selectedFiscalYear
    ? [selectedFiscalYear - 1, selectedFiscalYear, selectedFiscalYear + 1]
    : fiscalYearInfo
    ? [
        fiscalYearInfo.currentFiscalYear - 1,
        fiscalYearInfo.currentFiscalYear,
        fiscalYearInfo.currentFiscalYear + 1,
      ]
    : [];

  // Format day name
  const getDayName = (dateStr) => {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return "—";
    return ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][date.getDay()];
  };

  return (
    <div className="space-y-8 max-w-7xl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <CalendarDays className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Company Holidays</h1>
            <p className="text-sm text-muted-foreground">View the company holiday calendar.</p>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={CalendarDays} label="Total Holidays" value={holidays.length} tone="primary" />
        <StatCard icon={CalendarDays} label="Upcoming" value={upcoming} tone="blue" />
        <StatCard icon={RefreshCw} label="Recurring" value={holidays.filter((h) => h.isRecurring).length} tone="amber" />
      </div>

      {/* Fiscal Year Info & Controls */}
      {fiscalYearInfo && (
        <div className="rounded-2xl bg-gradient-to-r from-primary/5 via-blue-50/50 to-primary/5 border border-primary/20 p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-medium text-primary/70 uppercase tracking-wide mb-1">Current Fiscal Year</div>
              <div className="font-display text-xl font-bold text-primary">{fiscalYearInfo.fiscalYearLabel}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {fmt(fiscalYearInfo.startDate)}
                {" → "}
                {fmt(fiscalYearInfo.endDate)}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Filter by Year</label>
              <select
                className="px-4 py-2 rounded-lg border border-border bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={selectedFiscalYear || ""}
                onChange={(e) => setSelectedFiscalYear(parseInt(e.target.value))}
              >
                {fiscalYearOptions.map((year) => (
                  <option key={year} value={year}>
                    FY {year}-{year + 1}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Holiday list */}
      <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">Holiday List</h2>
            <p className="text-xs text-muted-foreground mt-1">
              All holidays for fiscal year {selectedFiscalYear}-{selectedFiscalYear + 1}
            </p>
          </div>
          <button 
            onClick={refresh} 
            disabled={loading} 
            className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground disabled:opacity-60"
            title="Refresh"
          >
            <RefreshCw className={`h-4.5 w-4.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : holidays.length === 0 ? (
          <div className="p-12 text-center">
            <CalendarDays className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No holidays found for this fiscal year.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-left">Holiday Name</th>
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-left">Day</th>
                  <th className="px-5 py-3 text-left">Type</th>
                  <th className="px-5 py-3 text-left">Recurring</th>
                  <th className="px-5 py-3 text-left">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {holidays.map((h) => {
                  const isPast = new Date(h.date) < new Date(now.toDateString());
                  return (
                    <tr key={h.id} className={`hover:bg-secondary/20 transition-colors ${isPast ? "opacity-60" : ""}`}>
                      <td className="px-5 py-4">
                        <div className="font-medium text-sm">{h.name}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm">{fmt(h.date)}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm text-muted-foreground">{getDayName(h.date)}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                          h.holidayType === "NATIONAL" 
                            ? "bg-green-100 text-green-700" 
                            : h.holidayType === "FESTIVAL"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-blue-100 text-blue-700"
                        }`}>
                          {h.holidayType || "Optional"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                          h.isRecurring ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
                        }`}>
                          {h.isRecurring ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm text-muted-foreground max-w-xs truncate">
                          {h.description || "—"}
                        </div>
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

export default Holidays;
