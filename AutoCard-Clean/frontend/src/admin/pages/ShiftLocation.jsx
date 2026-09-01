import { useEffect, useState, useCallback } from "react";
import {
  Building2, Clock, MapPin, Plus, Pencil, Trash2,
  Loader2, RefreshCw, X, AlertTriangle, CheckCircle2,
  Search, ToggleLeft, ToggleRight,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, apiDelete } from "../../lib/api.js";
import { formatTime12Hour } from "../../lib/timeFormat.js";

// ── shared styles ─────────────────────────────────────────────────────────────
const inputClass =
  "w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow";

// ── StatCard ──────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, tone }) => {
  const tones = {
    primary: "bg-primary/10 text-primary",
    blue:    "bg-blue-100 text-blue-700",
    green:   "bg-green-100 text-green-700",
    amber:   "bg-amber-100 text-amber-700",
  };
  return (
    <div className="rounded-2xl bg-background border border-border card-shadow p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="font-display text-2xl font-bold leading-none">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </div>
    </div>
  );
};

// ── Delete confirm modal ──────────────────────────────────────────────────────
const DeleteModal = ({ name, onConfirm, onCancel, deleting }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-foreground/50" onClick={() => !deleting && onCancel()} />
    <div className="relative bg-background rounded-2xl border border-border shadow-xl w-full max-w-md p-6">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </div>
        <div className="flex-1">
          <h3 className="font-display text-lg font-bold">Delete "{name}"?</h3>
          <p className="text-sm text-muted-foreground mt-1">
            This cannot be undone. Employees assigned to this record will lose the assignment.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 mt-6">
        <button onClick={onCancel} disabled={deleting}
          className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-60">
          Cancel
        </button>
        <button onClick={onConfirm} disabled={deleting}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60">
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  </div>
);

// ── Shifts section ────────────────────────────────────────────────────────────
const emptyShift = { name: "", startTime: "", endTime: "", description: "", isActive: true };

const ShiftsPanel = () => {
  const [shifts,     setShifts]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [form,       setForm]       = useState(emptyShift);
  const [editingId,  setEditingId]  = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,   setDeleting]   = useState(false);
  const [showForm,   setShowForm]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiGet(`/shifts?limit=100&search=${encodeURIComponent(search)}`);
      setShifts(d.data ?? []);
    } catch (err) { toast.error(err.message || "Failed to load shifts."); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => { setForm(emptyShift); setEditingId(null); setShowForm(false); };

  const startEdit = (s) => {
    setForm({ name: s.name, startTime: s.startTime, endTime: s.endTime, description: s.description ?? "", isActive: s.isActive });
    setEditingId(s.id);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      if (editingId) {
        await apiPatch(`/shifts/${editingId}`, form);
        toast.success("Shift updated.");
      } else {
        await apiPost("/shifts", form);
        toast.success("Shift created.");
      }
      resetForm();
      load();
    } catch (err) { toast.error(err.message || "Failed to save shift."); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await apiDelete(`/shifts/${deleteTarget.id}`);
      toast.success(`"${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
      load();
    } catch (err) { toast.error(err.message || "Failed to delete shift."); }
    finally { setDeleting(false); }
  };

  const active   = shifts.filter(s => s.isActive).length;
  const inactive = shifts.length - active;

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Clock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold">Shifts</h2>
            <p className="text-xs text-muted-foreground">Manage work shift timings.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className="p-2 rounded-lg border border-border hover:bg-secondary transition-colors text-muted-foreground disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => { resetForm(); setShowForm(true); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg cta-gradient text-white text-sm font-semibold hover:opacity-90 transition-opacity">
            <Plus className="h-4 w-4" /> Add Shift
          </button>
        </div>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={Clock}        label="Total Shifts"    value={shifts.length} tone="primary" />
        <StatCard icon={CheckCircle2} label="Active"          value={active}        tone="green"   />
        <StatCard icon={ToggleLeft}   label="Inactive"        value={inactive}      tone="amber"   />
      </div>

      {/* search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="Search shifts…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* add/edit form */}
      {showForm && (
        <div className="rounded-2xl bg-background border border-border card-shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-base font-semibold">{editingId ? "Edit Shift" : "Add Shift"}</h3>
            <button onClick={resetForm} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-sm font-medium mb-1.5 block">Shift Name <span className="text-destructive">*</span></label>
              <input className={inputClass} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Morning Shift" required maxLength={80} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Start Time <span className="text-destructive">*</span></label>
              <input type="time" className={inputClass} value={form.startTime} onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))} required />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">End Time <span className="text-destructive">*</span></label>
              <input type="time" className={inputClass} value={form.endTime} onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))} required />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium mb-1.5 block">Description</label>
              <input className={inputClass} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional notes" maxLength={300} />
            </div>
            <div className="sm:col-span-2 flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-medium">
                <div onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))}
                  className={`relative w-10 h-5 rounded-full transition-colors ${form.isActive ? "bg-primary" : "bg-border"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.isActive ? "translate-x-5" : "translate-x-0.5"}`} />
                </div>
                {form.isActive ? "Active" : "Inactive"}
              </label>
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={resetForm} className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors">Cancel</button>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 rounded-lg cta-gradient text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {saving ? "Saving…" : editingId ? "Update" : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* shifts table */}
      <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-14"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
        ) : shifts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <Clock className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No shifts found. Add one above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/30 border-b border-border text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-left">Shift Name</th>
                  <th className="px-5 py-3 text-left">Start Time</th>
                  <th className="px-5 py-3 text-left">End Time</th>
                  <th className="px-5 py-3 text-left">Description</th>
                  <th className="px-5 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shifts.map(s => (
                  <tr key={s.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-5 py-3 font-semibold">{s.name}</td>
                    <td className="px-5 py-3 font-mono">{formatTime12Hour(s.startTime)}</td>
                    <td className="px-5 py-3 font-mono">{formatTime12Hour(s.endTime)}</td>
                    <td className="px-5 py-3 text-muted-foreground max-w-[200px] truncate">{s.description || "—"}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${s.isActive ? "bg-green-100 text-green-700" : "bg-rose-100 text-rose-600"}`}>
                        {s.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => startEdit(s)} className="p-2 rounded-lg hover:bg-primary/10 text-primary transition-colors" title="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(s)} className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deleteTarget && <DeleteModal name={deleteTarget.name} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} deleting={deleting} />}
    </div>
  );
};
// ── Locations section ─────────────────────────────────────────────────────────
const emptyLocation = {
  name: "",
  addressLine: "",
  city: "",
  state: "",
  country: "",
  latitude: "",
  longitude: "",
  radius: "",
  isDefault: false,
  isActive: true,
};

const LocationsPanel = () => {
  const [locations,    setLocations]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [form,         setForm]         = useState(emptyLocation);
  const [editingId,    setEditingId]    = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]     = useState(false);
  const [showForm,     setShowForm]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiGet(`/locations?limit=100&search=${encodeURIComponent(search)}`);
      setLocations(d.data ?? []);
    } catch (err) { toast.error(err.message || "Failed to load locations."); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => { setForm(emptyLocation); setEditingId(null); setShowForm(false); };

  const startEdit = (l) => {
    setForm({
      name: l.name,
      addressLine: l.addressLine ?? "",
      city: l.city ?? "",
      state: l.state ?? "",
      country: l.country ?? "",
      latitude: l.latitude != null ? String(l.latitude) : "",
      longitude: l.longitude != null ? String(l.longitude) : "",
      radius: l.radius != null ? String(l.radius) : "",
      isDefault: !!l.isDefault,
      isActive: l.isActive,
    });
    setEditingId(l.id);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      if (editingId) {
        await apiPatch(`/locations/${editingId}`, form);
        toast.success("Location updated.");
      } else {
        await apiPost("/locations", form);
        toast.success("Location created.");
      }
      resetForm();
      load();
    } catch (err) { toast.error(err.message || "Failed to save location."); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await apiDelete(`/locations/${deleteTarget.id}`);
      toast.success(`"${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
      load();
    } catch (err) { toast.error(err.message || "Failed to delete location."); }
    finally { setDeleting(false); }
  };

  const active   = locations.filter(l => l.isActive).length;
  const inactive = locations.length - active;

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <MapPin className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold">Locations</h2>
            <p className="text-xs text-muted-foreground">Manage office and work site locations.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className="p-2 rounded-lg border border-border hover:bg-secondary transition-colors text-muted-foreground disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => { resetForm(); setShowForm(true); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">
            <Plus className="h-4 w-4" /> Add Location
          </button>
        </div>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={MapPin}       label="Total Locations" value={locations.length} tone="blue"  />
        <StatCard icon={CheckCircle2} label="Active"          value={active}           tone="green" />
        <StatCard icon={ToggleLeft}   label="Inactive"        value={inactive}         tone="amber" />
      </div>

      {/* search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="Search locations…" value={search} onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* add / edit form */}
      {showForm && (
        <div className="rounded-2xl bg-background border border-border card-shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-base font-semibold">
              {editingId ? "Edit Location" : "Add Location"}
            </h3>
            <button onClick={resetForm} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-sm font-medium mb-1.5 block">
                Location Name <span className="text-destructive">*</span>
              </label>
              <input className={inputClass} value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Head Office" required maxLength={80} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium mb-1.5 block">Address</label>
              <input className={inputClass} value={form.addressLine}
                onChange={e => setForm(p => ({ ...p, addressLine: e.target.value }))}
                placeholder="Street address" maxLength={300} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">City</label>
              <input className={inputClass} value={form.city}
                onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
                placeholder="City" maxLength={80} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">State</label>
              <input className={inputClass} value={form.state}
                onChange={e => setForm(p => ({ ...p, state: e.target.value }))}
                placeholder="State" maxLength={80} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Country</label>
              <input className={inputClass} value={form.country}
                onChange={e => setForm(p => ({ ...p, country: e.target.value }))}
                placeholder="Country" maxLength={80} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Latitude</label>
              <input className={inputClass} value={form.latitude}
                onChange={e => setForm(p => ({ ...p, latitude: e.target.value }))}
                placeholder="e.g. 28.6139" maxLength={20} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Longitude</label>
              <input className={inputClass} value={form.longitude}
                onChange={e => setForm(p => ({ ...p, longitude: e.target.value }))}
                placeholder="e.g. 77.2090" maxLength={20} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Radius (m)</label>
              <input type="number" className={inputClass} value={form.radius}
                onChange={e => setForm(p => ({ ...p, radius: e.target.value }))}
                placeholder="100" min="0" />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-medium">
                <input type="checkbox" checked={form.isDefault} onChange={e => setForm(p => ({ ...p, isDefault: e.target.checked }))} />
                <span> Set as default</span>
              </label>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-medium">
                <div onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))}
                  className={`relative w-10 h-5 rounded-full transition-colors ${form.isActive ? "bg-primary" : "bg-border"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.isActive ? "translate-x-5" : "translate-x-0.5"}`} />
                </div>
                {form.isActive ? "Active" : "Inactive"}
              </label>
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={resetForm}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60 transition-colors">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {saving ? "Saving…" : editingId ? "Update" : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* locations table */}
      <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-14">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : locations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <MapPin className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No locations found. Add one above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/30 border-b border-border text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-left">Name</th>
                  <th className="px-5 py-3 text-left">Address</th>
                  <th className="px-5 py-3 text-left">City</th>
                  <th className="px-5 py-3 text-left">State</th>
                  <th className="px-5 py-3 text-left">Country</th>
                  <th className="px-5 py-3 text-left">Latitude</th>
                  <th className="px-5 py-3 text-left">Longitude</th>
                  <th className="px-5 py-3 text-left">Radius</th>
                  <th className="px-5 py-3 text-center">Default</th>
                  <th className="px-5 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {locations.map(l => (
                  <tr key={l.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-5 py-3 font-semibold">{l.name}</td>
                    <td className="px-5 py-3 text-muted-foreground max-w-[180px] truncate">{l.addressLine || "—"}</td>
                    <td className="px-5 py-3">{l.city || "—"}</td>
                    <td className="px-5 py-3">{l.state || "—"}</td>
                    <td className="px-5 py-3">{l.country || "—"}</td>
                    <td className="px-5 py-3">{l.latitude != null ? l.latitude : "—"}</td>
                    <td className="px-5 py-3">{l.longitude != null ? l.longitude : "—"}</td>
                    <td className="px-5 py-3">{l.radius != null ? l.radius : "—"}</td>
                    <td className="px-5 py-3 text-center">
                      {l.isDefault ? (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">Default</span>
                      ) : "—"}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${l.isActive ? "bg-green-100 text-green-700" : "bg-rose-100 text-rose-600"}`}>
                        {l.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => startEdit(l)}
                          className="p-2 rounded-lg hover:bg-primary/10 text-primary transition-colors" title="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(l)}
                          className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deleteTarget && (
        <DeleteModal
          name={deleteTarget.name}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
const TABS = [
  { key: "shifts",    label: "Shifts",    icon: Clock    },
  { key: "locations", label: "Locations", icon: MapPin   },
];

const ShiftLocation = () => {
  const [tab, setTab] = useState("shifts");

  return (
    <div className="space-y-6 max-w-7xl">

      {/* Page header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Shift &amp; Location</h1>
          <p className="text-sm text-muted-foreground">
            Manage work shifts and office locations for your employees.
          </p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-xl bg-secondary/40 border border-border w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === key
                ? "bg-background text-foreground shadow border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "shifts"    && <ShiftsPanel />}
      {tab === "locations" && <LocationsPanel />}
    </div>
  );
};

export default ShiftLocation;
