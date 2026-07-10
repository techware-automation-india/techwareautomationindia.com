import { useEffect, useState } from "react";
import { ClipboardList, Loader2, RefreshCw, Plus, Pencil, Trash2, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPut, apiDelete } from "../../lib/api.js";

const emptyForm = {
  name: "",
  code: "",
  daysPerYear: "",
  description: "",
  isPaid: true,
  isActive: true,
  requiresApproval: true,
};

const inputClass =
  "w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow";

const LeavePolicy = () => {
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      const data = await apiGet("/leave-types");
      setLeaveTypes(data.leaveTypes);
    } catch (err) {
      toast.error(err.message || "Failed to load leave types.");
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    setLoading(true);
    load();
  };

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const startEdit = (lt) => {
    setEditingId(lt.id);
    setForm({
      name: lt.name,
      code: lt.code,
      daysPerYear: String(lt.daysPerYear),
      description: lt.description || "",
      isPaid: lt.isPaid,
      isActive: lt.isActive,
      requiresApproval: lt.requiresApproval ?? true,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const payload = {
      name: form.name,
      code: form.code,
      daysPerYear: form.daysPerYear,
      description: form.description || undefined,
      isPaid: form.isPaid,
      isActive: form.isActive,
      requiresApproval: form.requiresApproval,
    };
    try {
      if (editingId) {
        await apiPut(`/leave-types/${editingId}`, payload);
        toast.success("Leave type updated.");
      } else {
        await apiPost("/leave-types", payload);
        toast.success("Leave type created.");
      }
      resetForm();
      refresh();
    } catch (err) {
      toast.error(err.message || "Failed to save leave type.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiDelete(`/leave-types/${deleteTarget.id}`);
      toast.success(`"${deleteTarget.name}" deleted.`);
      if (editingId === deleteTarget.id) resetForm();
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      toast.error(err.message || "Failed to delete leave type.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <ClipboardList className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Leave Policy</h1>
          <p className="text-sm text-muted-foreground">Define leave types, annual allowances, and rules.</p>
        </div>
      </div>

      {/* Create / edit form */}
      <div className="rounded-2xl bg-background border border-border card-shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold">
            {editingId ? "Edit Leave Type" : "Add Leave Type"}
          </h2>
          {editingId && (
            <button onClick={resetForm} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
              <X className="h-4 w-4" /> Cancel edit
            </button>
          )}
        </div>
        <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Name <span className="text-destructive">*</span></label>
            <input className={inputClass} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} maxLength={80} placeholder="e.g. Annual Leave" required />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Code <span className="text-destructive">*</span></label>
            <input className={inputClass} value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} pattern="[A-Za-z0-9_\-]+" title="Letters, numbers, _ or - only" maxLength={20} placeholder="e.g. AL" required />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Days Per Year <span className="text-destructive">*</span></label>
            <input type="number" className={inputClass} value={form.daysPerYear} onChange={(e) => setForm((p) => ({ ...p, daysPerYear: e.target.value }))} min={0} max={365} placeholder="e.g. 20" required />
          </div>
          <div className="flex items-end gap-6 pb-1">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input type="checkbox" className="rounded border-border" checked={form.isPaid} onChange={(e) => setForm((p) => ({ ...p, isPaid: e.target.checked }))} />
              Paid leave
            </label>
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input type="checkbox" className="rounded border-border" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input type="checkbox" className="rounded border-border" checked={form.requiresApproval} onChange={(e) => setForm((p) => ({ ...p, requiresApproval: e.target.checked }))} />
              Requires Approval
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium mb-1.5 block">Description</label>
            <textarea className={inputClass + " resize-none"} rows={2} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} maxLength={300} placeholder="Optional notes about this leave type" />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={saving} className="cta-gradient text-white font-semibold px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {saving ? "Saving..." : editingId ? "Update Leave Type" : "Add Leave Type"}
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="font-display text-lg font-semibold">Leave Types</h2>
          <button onClick={refresh} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-12 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
          </div>
        ) : leaveTypes.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No leave types yet. Add one above.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Code</th>
                  <th className="px-6 py-3 font-medium">Days/Year</th>
                  <th className="px-6 py-3 font-medium">Paid</th>
                  <th className="px-6 py-3 font-medium">Approval</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leaveTypes.map((lt) => (
                  <tr key={lt.id} className="border-b border-border last:border-0 hover:bg-secondary/40 transition-colors">
                    <td className="px-6 py-3 font-medium">{lt.name}</td>
                    <td className="px-6 py-3 text-muted-foreground">{lt.code}</td>
                    <td className="px-6 py-3 text-muted-foreground">{lt.daysPerYear}</td>
                    <td className="px-6 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${lt.isPaid ? "bg-emerald-100 text-emerald-700" : "bg-secondary text-muted-foreground"}`}>
                        {lt.isPaid ? "Paid" : "Unpaid"}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      {(lt.requiresApproval ?? true) ? (
                        <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-amber-100 text-amber-700">
                          Requires Approval
                        </span>
                      ) : (
                        <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-blue-100 text-blue-700">
                          Auto Approved
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${lt.isActive ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {lt.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right whitespace-nowrap">
                      <button onClick={() => startEdit(lt)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors" title="Edit">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => setDeleteTarget(lt)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
                <h3 className="font-display text-lg font-bold">Delete Leave Type</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Are you sure you want to delete <span className="font-semibold text-foreground">{deleteTarget.name}</span>? This cannot be undone.
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

export default LeavePolicy;
