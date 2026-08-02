import { useEffect, useState, useCallback } from "react";
import {
  ShieldCheck,
  Loader2,
  RefreshCw,
  Search,
  Save,
  Users,
  CheckCircle2,
  ChevronDown,
  LayoutDashboard,
  UserCog,
  Contact,
  ClipboardList,
  BookOpen,
  CalendarDays,
  Clock,
  FolderKanban,
  MapPin,
  CalendarRange,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPatch } from "../../lib/api.js";

// ─── constants ───────────────────────────────────────────────────────────────

const PERM_COLS = [
  { key: "canView",   label: "View" },
  { key: "canCreate", label: "Create" },
  { key: "canEdit",   label: "Edit" },
  { key: "canDelete", label: "Delete" },
];

const MODULE_ICONS = {
  overview:       LayoutDashboard,
  employee:       UserCog,
  customer:       Contact,
  requests:       ClipboardList,
  "leave-policy": BookOpen,
  holidays:       CalendarDays,
  attendance:     Clock,
  projects:       FolderKanban,
  "shift-location": MapPin,
  roster:         CalendarRange,
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function initPerms(modules, serverPermissions) {
  const state = {};
  for (const mod of modules) {
    const p = serverPermissions?.[mod.key] ?? {};
    state[mod.key] = {
      canView:   p.canView   ?? false,
      canCreate: p.canCreate ?? false,
      canEdit:   p.canEdit   ?? false,
      canDelete: p.canDelete ?? false,
    };
  }
  return state;
}

function grantedCount(permissions) {
  let n = 0;
  for (const p of Object.values(permissions))
    for (const v of Object.values(p)) if (v) n++;
  return n;
}

// ─── Checkbox component ───────────────────────────────────────────────────────

const Checkbox = ({ checked, onChange, label }) => (
  <label className="flex flex-col items-center gap-1.5 cursor-pointer group select-none">
    <div
      onClick={onChange}
      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
        checked
          ? "bg-primary border-primary"
          : "border-border bg-background group-hover:border-primary/50"
      }`}
    >
      {checked && (
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
    <span className={`text-xs font-medium transition-colors ${checked ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`}>
      {label}
    </span>
  </label>
);

// ─── main component ──────────────────────────────────────────────────────────

const RolesAccess = () => {
  const [employees, setEmployees]     = useState([]);
  const [modules, setModules]         = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch]           = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [selected, setSelected]           = useState(null);
  const [permissions, setPermissions]     = useState({});
  const [loadingPerms, setLoadingPerms]   = useState(false);
  const [saving, setSaving]               = useState(false);
  const [hasConfigured, setHasConfigured] = useState(false);

  // ── load employees list ───────────────────────────────────────────────────
  const loadEmployees = useCallback(async () => {
    setLoadingList(true);
    try {
      const data = await apiGet("/roles-access/employees");
      setEmployees(data.employees ?? []);
      setModules(data.modules ?? []);
    } catch (err) {
      toast.error(err.message || "Failed to load employees.");
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  // ── load permissions for selected employee ────────────────────────────────
  const loadPermissions = useCallback(async (emp) => {
    setLoadingPerms(true);
    try {
      const data = await apiGet(`/roles-access/employees/${emp.id}/permissions`);
      const mods = data.modules ?? modules;
      setModules(mods);
      setPermissions(initPerms(mods, data.permissions));
      setHasConfigured(data.hasConfiguredPermissions ?? false);
    } catch (err) {
      toast.error(err.message || "Failed to load permissions.");
    } finally {
      setLoadingPerms(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectEmployee = (emp) => {
    setSelected(emp);
    setDropdownOpen(false);
    setSearch("");
    loadPermissions(emp);
  };

  // ── toggle helpers ────────────────────────────────────────────────────────
  const togglePerm = (moduleKey, permKey) =>
    setPermissions((prev) => ({
      ...prev,
      [moduleKey]: { ...prev[moduleKey], [permKey]: !prev[moduleKey][permKey] },
    }));

  const toggleRow = (moduleKey) => {
    const perms = permissions[moduleKey] ?? {};
    const allOn = PERM_COLS.every((p) => perms[p.key]);
    const next = {};
    for (const p of PERM_COLS) next[p.key] = !allOn;
    setPermissions((prev) => ({ ...prev, [moduleKey]: next }));
  };

  const toggleCol = (permKey) => {
    const allOn = modules.every((m) => permissions[m.key]?.[permKey]);
    setPermissions((prev) => {
      const next = { ...prev };
      for (const m of modules) next[m.key] = { ...next[m.key], [permKey]: !allOn };
      return next;
    });
  };

  const grantAll  = () => setPermissions(() => {
    const next = {};
    for (const m of modules) next[m.key] = { canView: true, canCreate: true, canEdit: true, canDelete: true };
    return next;
  });

  const revokeAll = () => setPermissions(() => {
    const next = {};
    for (const m of modules) next[m.key] = { canView: false, canCreate: false, canEdit: false, canDelete: false };
    return next;
  });

  // ── save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selected || saving) return;
    setSaving(true);
    try {
      await apiPatch(`/roles-access/employees/${selected.id}/permissions`, { permissions });
      toast.success(`Permissions saved for ${selected.fullName}.`);
      setHasConfigured(true);
      loadEmployees();
    } catch (err) {
      toast.error(err.message || "Failed to save permissions.");
    } finally {
      setSaving(false);
    }
  };

  // ── derived ───────────────────────────────────────────────────────────────
  const filteredEmps = employees.filter(
    (e) =>
      e.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      e.email?.toLowerCase().includes(search.toLowerCase()) ||
      e.employeeCode?.toLowerCase().includes(search.toLowerCase()),
  );

  const totalPerms  = modules.length * PERM_COLS.length;
  const granted     = selected ? grantedCount(permissions) : 0;

  return (
    <div className="space-y-6 max-w-6xl">

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Roles &amp; Access</h1>
            <p className="text-sm text-muted-foreground">
              Select an employee and configure which modules they can access.
            </p>
          </div>
        </div>
        <button
          onClick={loadEmployees}
          disabled={loadingList}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loadingList ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Employees", value: employees.length, color: "text-primary", bg: "bg-primary/10" },
          { label: "Active",          value: employees.filter(e => e.isActive).length, color: "text-green-600", bg: "bg-green-100" },
          { label: "Modules",         value: modules.length,   color: "text-indigo-600", bg: "bg-indigo-100" },
          { label: "Permissions Granted", value: selected ? `${granted}/${totalPerms}` : "—", color: "text-amber-600", bg: "bg-amber-100" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-background border border-border card-shadow p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.bg}`}>
              <Users className={`h-5 w-5 ${s.color}`} />
            </div>
            <div>
              <div className={`font-display text-xl font-bold leading-none ${s.color}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Employee Selector ── */}
      <div className="rounded-2xl bg-background border border-border card-shadow p-5">
        <label className="text-sm font-semibold mb-2 block">
          Select Employee <span className="text-destructive">*</span>
        </label>
        <div className="relative">
          {/* trigger */}
          <button
            type="button"
            onClick={() => setDropdownOpen((p) => !p)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-border bg-secondary/20 hover:bg-secondary/40 transition-colors text-left"
          >
            {selected ? (
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                  {selected.fullName?.[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{selected.fullName}</div>
                  <div className="text-xs text-muted-foreground truncate">{selected.email}
                    {selected.employeeCode && <span className="ml-2 text-primary/70 font-mono">#{selected.employeeCode}</span>}
                  </div>
                </div>
                {hasConfigured && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 shrink-0">
                    <CheckCircle2 className="h-3 w-3" /> Configured
                  </span>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                {loadingList ? "Loading employees…" : "Click to select an employee"}
              </span>
            )}
            <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
          </button>

          {/* dropdown */}
          {dropdownOpen && (
            <div className="absolute z-30 top-full mt-2 left-0 right-0 rounded-xl border border-border bg-background shadow-xl overflow-hidden">
              <div className="p-2 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    autoFocus
                    className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-secondary/30 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="Search name, email or code…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="overflow-y-auto max-h-64 divide-y divide-border">
                {loadingList ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : filteredEmps.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">No employees found.</div>
                ) : (
                  filteredEmps.map((emp) => (
                    <button
                      key={emp.id}
                      onClick={() => selectEmployee(emp)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/40 transition-colors ${selected?.id === emp.id ? "bg-primary/5" : ""}`}
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-xs shrink-0">
                        {emp.fullName?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{emp.fullName}</div>
                        <div className="text-xs text-muted-foreground truncate">{emp.email}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {emp.employeeCode && <span className="text-xs font-mono text-primary/70">#{emp.employeeCode}</span>}
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${emp.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                          {emp.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Permission Matrix ── */}
      {!selected ? (
        <div className="rounded-2xl bg-background border border-border card-shadow flex flex-col items-center justify-center py-20 text-center px-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <ShieldCheck className="h-8 w-8 text-primary/40" />
          </div>
          <h3 className="font-display text-lg font-semibold mb-2">No Employee Selected</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Use the selector above to pick an employee, then configure their module access below.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">

          {/* panel header */}
          <div className="p-5 border-b border-border bg-secondary/10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                {selected.fullName?.[0]?.toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-sm">{selected.fullName}</div>
                <div className="text-xs text-muted-foreground">{selected.email}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={grantAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-300 bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100 transition-colors"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Grant All
              </button>
              <button
                onClick={revokeAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 text-xs font-semibold hover:bg-red-100 transition-colors"
              >
                <ShieldCheck className="h-3.5 w-3.5" /> Revoke All
              </button>
              <button
                onClick={handleSave}
                disabled={saving || loadingPerms}
                className="cta-gradient text-white font-semibold px-5 py-2 rounded-lg hover:opacity-90 transition-opacity inline-flex items-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "Saving…" : "Save Permissions"}
              </button>
            </div>
          </div>

          {/* matrix */}
          {loadingPerms ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                {/* thead */}
                <thead>
                  <tr className="bg-secondary/30 border-b border-border">
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-56">
                      Module
                    </th>
                    {PERM_COLS.map((col) => (
                      <th key={col.key} className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <button
                          onClick={() => toggleCol(col.key)}
                          className="flex flex-col items-center gap-1 mx-auto group"
                          title={`Toggle "${col.label}" for all modules`}
                        >
                          {/* column header checkbox */}
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                            modules.every((m) => permissions[m.key]?.[col.key])
                              ? "bg-primary border-primary"
                              : modules.some((m) => permissions[m.key]?.[col.key])
                              ? "bg-primary/30 border-primary/50"
                              : "border-border group-hover:border-primary/50"
                          }`}>
                            {modules.every((m) => permissions[m.key]?.[col.key]) && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                            {!modules.every((m) => permissions[m.key]?.[col.key]) && modules.some((m) => permissions[m.key]?.[col.key]) && (
                              <div className="w-2 h-0.5 bg-primary rounded" />
                            )}
                          </div>
                          <span className="group-hover:text-primary transition-colors">{col.label}</span>
                        </button>
                      </th>
                    ))}
                    <th className="px-4 py-4 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      All Access
                    </th>
                  </tr>
                </thead>

                {/* tbody */}
                <tbody className="divide-y divide-border">
                  {modules.map((mod) => {
                    const perms  = permissions[mod.key] ?? {};
                    const allOn  = PERM_COLS.every((p) => perms[p.key]);
                    const anyOn  = PERM_COLS.some((p) => perms[p.key]);
                    const ModIcon = MODULE_ICONS[mod.key] ?? ShieldCheck;

                    return (
                      <tr
                        key={mod.key}
                        className={`transition-colors hover:bg-secondary/20 ${anyOn ? "" : "opacity-70"}`}
                      >
                        {/* module name */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${anyOn ? "bg-primary/10" : "bg-secondary/50"}`}>
                              <ModIcon className={`h-4.5 w-4.5 ${anyOn ? "text-primary" : "text-muted-foreground"}`} />
                            </div>
                            <div>
                              <div className="text-sm font-semibold">{mod.label}</div>
                              <div className="text-xs text-muted-foreground font-mono">{mod.key}</div>
                            </div>
                          </div>
                        </td>

                        {/* individual permission checkboxes */}
                        {PERM_COLS.map((col) => (
                          <td key={col.key} className="px-4 py-4 text-center">
                            <Checkbox
                              checked={!!perms[col.key]}
                              onChange={() => togglePerm(mod.key, col.key)}
                              label={col.label}
                            />
                          </td>
                        ))}

                        {/* row "All Access" toggle */}
                        <td className="px-4 py-4 text-center">
                          <label className="flex flex-col items-center gap-1.5 cursor-pointer group select-none">
                            <div
                              onClick={() => toggleRow(mod.key)}
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                allOn
                                  ? "bg-primary border-primary"
                                  : anyOn
                                  ? "bg-primary/30 border-primary/50"
                                  : "border-border group-hover:border-primary/50"
                              }`}
                            >
                              {allOn && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                              {!allOn && anyOn && <div className="w-2 h-0.5 bg-primary rounded" />}
                            </div>
                            <span className={`text-xs font-medium transition-colors ${allOn ? "text-primary" : anyOn ? "text-primary/60" : "text-muted-foreground group-hover:text-foreground"}`}>
                              {allOn ? "All" : anyOn ? "Partial" : "None"}
                            </span>
                          </label>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* footer */}
          {!loadingPerms && (
            <div className="px-5 py-4 border-t border-border bg-secondary/10 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{granted}</span>
                <span> of </span>
                <span className="font-semibold text-foreground">{totalPerms}</span>
                <span> permissions granted to </span>
                <span className="font-semibold text-foreground">{selected.fullName}</span>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="cta-gradient text-white font-semibold px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity inline-flex items-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "Saving…" : "Save Permissions"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RolesAccess;
