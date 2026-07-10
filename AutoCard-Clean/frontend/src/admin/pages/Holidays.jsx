import { useEffect, useState } from "react";
import { CalendarDays, Loader2, RefreshCw, Plus, Pencil, Trash2, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPut, apiDelete } from "../../lib/api.js";

const emptyForm = {
  name: "",
  date: "",
  description: "",
  isRecurring: false,
  holidayType: "OPTIONAL",
  isOptional: true,
};

const inputClass =
  "w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow";

// Formats a date string as a readable, locale-aware date.
const fmt = (v) =>
  v ? new Date(v).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

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
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [fiscalYearInfo, setFiscalYearInfo] = useState(null);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalFilter, setModalFilter] = useState("all"); // "all", "upcoming", "recurring"

  const loadFiscalYearInfo = async () => {
    try {
      const data = await apiGet("/holidays/fiscal-year");
      setFiscalYearInfo(data);
      // Default to current fiscal year
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

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const startEdit = (h) => {
    setEditingId(h.id);
    setForm({
      name: h.name,
      date: h.date ? h.date.slice(0, 10) : "",
      description: h.description || "",
      isRecurring: h.isRecurring,
      holidayType: h.holidayType || "OPTIONAL",
      isOptional: h.isOptional || false,
    });
    window.scrollTo({ top: document.getElementById('holiday-form')?.offsetTop - 100 || 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const payload = {
      name: form.name,
      date: form.date,
      description: form.description || undefined,
      isRecurring: form.isRecurring,
      holidayType: form.holidayType,
      isOptional: form.isOptional,
    };
    try {
      if (editingId) {
        await apiPut(`/holidays/${editingId}`, payload);
        toast.success("Holiday updated.");
      } else {
        await apiPost("/holidays", payload);
        toast.success("Holiday added.");
      }
      resetForm();
      refresh();
    } catch (err) {
      toast.error(err.message || "Failed to save holiday.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (holiday) => {
    setDeleteTarget(holiday);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiDelete(`/holidays/${deleteTarget.id}`);
      toast.success(`"${deleteTarget.name}" deleted.`);
      if (editingId === deleteTarget.id) resetForm();
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      toast.error(err.message || "Failed to delete holiday.");
    } finally {
      setDeleting(false);
    }
  };

  const now = new Date();
  const upcoming = holidays.filter((h) => new Date(h.date) >= new Date(now.toDateString())).length;

  // Generate fiscal year options (previous, current, next year based on selected year)
  const fiscalYearOptions = selectedFiscalYear
    ? [
        selectedFiscalYear - 1,
        selectedFiscalYear,
        selectedFiscalYear + 1,
      ]
    : fiscalYearInfo
    ? [
        fiscalYearInfo.currentFiscalYear - 1,
        fiscalYearInfo.currentFiscalYear,
        fiscalYearInfo.currentFiscalYear + 1,
      ]
    : [];

  // Format day name
  const getDayName = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("en-IN", { weekday: "long" });
  };

  // Get filtered holidays based on modal filter
  const getFilteredHolidays = () => {
    if (modalFilter === "upcoming") {
      return holidays.filter((h) => new Date(h.date) >= new Date(now.toDateString()));
    } else if (modalFilter === "recurring") {
      return holidays.filter((h) => h.isRecurring);
    }
    return holidays;
  };

  const handleStatCardClick = (filter) => {
    setModalFilter(filter);
    setShowModal(true);
  };

  return (
    <div className="space-y-8 max-w-7xl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <CalendarDays className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Holidays</h1>
            <p className="text-sm text-muted-foreground">Manage the company holiday calendar.</p>
          </div>
        </div>
        
        {/* Add Holiday Button */}
        <button
          onClick={() => {
            setEditingId(null);
            setForm(emptyForm);
            window.scrollTo({ top: document.getElementById('holiday-form')?.offsetTop - 100 || 0, behavior: 'smooth' });
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Add Holiday
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div onClick={() => handleStatCardClick("all")} className="cursor-pointer">
          <StatCard icon={CalendarDays} label="Total Holidays" value={holidays.length} tone="primary" />
        </div>
        <div onClick={() => handleStatCardClick("upcoming")} className="cursor-pointer">
          <StatCard icon={CalendarDays} label="Upcoming" value={upcoming} tone="blue" />
        </div>
        <div onClick={() => handleStatCardClick("recurring")} className="cursor-pointer">
          <StatCard icon={RefreshCw} label="Recurring" value={holidays.filter((h) => h.isRecurring).length} tone="amber" />
        </div>
      </div>

      {/* Fiscal Year Info & Controls */}
      {fiscalYearInfo && (
        <div className="rounded-2xl bg-gradient-to-r from-primary/5 via-blue-50/50 to-primary/5 border border-primary/20 p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-medium text-primary/70 uppercase tracking-wide mb-1">Current Fiscal Year</div>
              <div className="font-display text-xl font-bold text-primary">{fiscalYearInfo.fiscalYearLabel}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {new Date(fiscalYearInfo.startDate).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })} 
                {" → "} 
                {new Date(fiscalYearInfo.endDate).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
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

      {/* Info Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border border-blue-200 p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
            <CalendarDays className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">Manage Company Holidays</h3>
            <p className="text-sm text-blue-700">
              Add company holidays for the fiscal year (April 1 - March 31) using the form below.
            </p>
          </div>
        </div>
      </div>

      {/* Create / edit form */}
      <div id="holiday-form" className="rounded-2xl bg-background border border-border card-shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-lg font-semibold">
              {editingId ? "Edit Holiday" : "Add Holiday"}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Add national holidays, festivals, or custom company holidays
            </p>
          </div>
          {editingId && (
            <button onClick={resetForm} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
              <X className="h-4 w-4" /> Cancel edit
            </button>
          )}
        </div>
        <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Holiday Name <span className="text-destructive">*</span></label>
            <input className={inputClass} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} maxLength={120} placeholder="e.g. Diwali, Republic Day" required />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Date <span className="text-destructive">*</span></label>
            <input type="date" className={inputClass} value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} required />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Holiday Type <span className="text-destructive">*</span></label>
            <select className={inputClass} value={form.holidayType} onChange={(e) => setForm((p) => ({ ...p, holidayType: e.target.value }))} required>
              <option value="NATIONAL">National Holiday</option>
              <option value="FESTIVAL">Festival</option>
              <option value="OPTIONAL">Optional Holiday</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer h-[42px]">
              <input type="checkbox" className="rounded border-border" checked={form.isRecurring} onChange={(e) => setForm((p) => ({ ...p, isRecurring: e.target.checked }))} />
              Recurring every year
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium mb-1.5 block">Description</label>
            <input className={inputClass} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} maxLength={300} placeholder="Optional notes about this holiday" />
          </div>
          <div className="sm:col-span-2 flex items-center justify-end">
            <button type="submit" disabled={saving} className="cta-gradient text-white font-semibold px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {saving ? "Saving..." : editingId ? "Update Holiday" : "Add Holiday"}
            </button>
          </div>
        </form>
      </div>

      {/* Holiday Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-background rounded-2xl border border-border shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <CalendarDays className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold">
                    {modalFilter === "all" ? "All Holidays" : modalFilter === "upcoming" ? "Upcoming Holidays" : "Recurring Holidays"}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {getFilteredHolidays().length} {getFilteredHolidays().length === 1 ? "holiday" : "holidays"} for fiscal year {selectedFiscalYear}-{selectedFiscalYear + 1}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : getFilteredHolidays().length === 0 ? (
                <div className="text-center py-12">
                  <CalendarDays className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No holidays found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-secondary/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left">Holiday Name</th>
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-left">Day</th>
                        <th className="px-4 py-3 text-left">Type</th>
                        <th className="px-4 py-3 text-left">Recurring</th>
                        <th className="px-4 py-3 text-left">Description</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {getFilteredHolidays().map((h) => {
                        const isPast = new Date(h.date) < new Date(now.toDateString());
                        return (
                          <tr key={h.id} className={`hover:bg-secondary/20 transition-colors ${isPast ? "opacity-60" : ""}`}>
                            <td className="px-4 py-3">
                              <div className="font-medium text-sm">{h.name}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm">{fmt(h.date)}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm text-muted-foreground">{getDayName(h.date)}</div>
                            </td>
                            <td className="px-4 py-3">
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
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                                h.isRecurring ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
                              }`}>
                                {h.isRecurring ? "Yes" : "No"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm text-muted-foreground max-w-xs truncate">
                                {h.description || "—"}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <button 
                                  onClick={() => {
                                    startEdit(h);
                                    setShowModal(false);
                                  }} 
                                  className="p-2 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                                  title="Edit"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button 
                                  onClick={() => {
                                    handleDeleteClick(h);
                                    setShowModal(false);
                                  }} 
                                  className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
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

            {/* Modal Footer */}
            <div className="p-4 border-t border-border flex items-center justify-between bg-secondary/20">
              <p className="text-sm text-muted-foreground">
                {modalFilter === "all" ? "All holidays" : modalFilter === "upcoming" ? "Upcoming holidays" : "Recurring holidays"} for FY {selectedFiscalYear}-{selectedFiscalYear + 1}
              </p>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg border border-border bg-background text-sm font-medium hover:bg-secondary transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/50" onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="relative bg-background rounded-2xl border border-border shadow-xl w-full max-w-md p-6">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5.5 w-5.5 text-destructive" />
              </div>
              <div className="flex-1">
                <h3 className="font-display text-lg font-bold">Delete Holiday</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Are you sure you want to delete <span className="font-semibold text-foreground">{deleteTarget.name}</span> ({fmt(deleteTarget.date)})? This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-60">
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={deleting} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60">
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Holidays;
