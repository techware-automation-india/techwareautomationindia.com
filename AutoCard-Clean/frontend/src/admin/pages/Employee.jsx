import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus, Loader2, Users, Clock, Send, CheckCircle2, XCircle, Trash2, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiDelete } from "../../lib/api.js";

const emptyForm = {
  fullName: "",
  email: "",
  password: "",
  employeeCode: "",
  jobTitle: "",
};

const statusStyles = {
  PENDING: "bg-amber-100 text-amber-700",
  SUBMITTED: "bg-blue-100 text-blue-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
};

const StatusBadge = ({ status }) => (
  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusStyles[status] || "bg-secondary text-muted-foreground"}`}>
    {status || "—"}
  </span>
);

const StatCard = ({ icon: Icon, label, value, tone }) => {
  const tones = {
    primary: "bg-primary/10 text-primary",
    amber: "bg-amber-100 text-amber-700",
    blue: "bg-blue-100 text-blue-700",
    emerald: "bg-emerald-100 text-emerald-700",
    rose: "bg-rose-100 text-rose-700",
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

const Employee = ({ employeePermissions = null, isEmployeeView = false }) => {
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Permission helpers - Admin has all permissions, Employee has assigned permissions
  const permissions = employeePermissions || {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
  };
  
  const canCreate = permissions.canCreate;
  const canDelete = permissions.canDelete;

  const loadEmployees = async () => {
    try {
      const data = await apiGet("/employees");
      setEmployees(data.employees);
      
      // Auto-generate next employee code
      if (data.employees.length > 0) {
        // Find the highest employee code number
        const empCodes = data.employees
          .map(e => e.employeeCode)
          .filter(code => code && code.startsWith('EMP-'))
          .map(code => {
            const num = parseInt(code.replace('EMP-', ''), 10);
            return isNaN(num) ? 0 : num;
          });
        
        const maxCode = empCodes.length > 0 ? Math.max(...empCodes) : 0;
        const nextCode = `EMP-${String(maxCode + 1).padStart(3, '0')}`;
        setForm(prev => ({ ...prev, employeeCode: nextCode }));
      } else {
        // First employee
        setForm(prev => ({ ...prev, employeeCode: 'EMP-001' }));
      }
    } catch (err) {
      toast.error(err.message || "Failed to load employees.");
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    setLoading(true);
    loadEmployees();
  };

  useEffect(() => {
    (async () => {
      await loadEmployees();
    })();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await apiPost("/employees", {
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        employeeCode: form.employeeCode,
        jobTitle: form.jobTitle || undefined,
      });
      toast.success(`Employee "${form.fullName}" created with code ${form.employeeCode}.`);
      setForm({ ...emptyForm }); // Clear form but keep other fields empty
      refresh(); // This will auto-generate the next code
    } catch (err) {
      toast.error(err.message || "Failed to create employee.");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiDelete(`/employees/${deleteTarget.id}`);
      toast.success(`Employee "${deleteTarget.fullName}" deleted.`);
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      toast.error(err.message || "Failed to delete employee.");
    } finally {
      setDeleting(false);
    }
  };

  const inputClass =
    "w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow";

  // Derive summary counts from the loaded employee list.
  const stats = {
    total: employees.length,
    pending: employees.filter((e) => e.onboardingStatus === "PENDING").length,
    submitted: employees.filter((e) => e.onboardingStatus === "SUBMITTED").length,
    approved: employees.filter((e) => e.onboardingStatus === "APPROVED").length,
    rejected: employees.filter((e) => e.onboardingStatus === "REJECTED").length,
  };

  const handleStatCardClick = (status) => {
    if (status === "all") {
      navigate("/admin/employee-list");
    } else {
      navigate(`/admin/employee-list?status=${status.toUpperCase()}`);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <UserPlus className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Employee</h1>
          <p className="text-sm text-muted-foreground">Create employee accounts and manage records.</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div onClick={() => handleStatCardClick("all")} className="cursor-pointer hover:scale-105 transition-transform">
          <StatCard icon={Users} label="Total Employees" value={stats.total} tone="primary" />
        </div>
        <div onClick={() => handleStatCardClick("pending")} className="cursor-pointer hover:scale-105 transition-transform">
          <StatCard icon={Clock} label="Pending" value={stats.pending} tone="amber" />
        </div>
        <div onClick={() => handleStatCardClick("submitted")} className="cursor-pointer hover:scale-105 transition-transform">
          <StatCard icon={Send} label="Submitted" value={stats.submitted} tone="blue" />
        </div>
        <div onClick={() => handleStatCardClick("approved")} className="cursor-pointer hover:scale-105 transition-transform">
          <StatCard icon={CheckCircle2} label="Approved" value={stats.approved} tone="emerald" />
        </div>
        <div onClick={() => handleStatCardClick("rejected")} className="cursor-pointer hover:scale-105 transition-transform">
          <StatCard icon={XCircle} label="Rejected" value={stats.rejected} tone="rose" />
        </div>
      </div>

      {/* Create form - Only show if canCreate permission */}
      {canCreate && (
        <div className="rounded-2xl bg-background border border-border card-shadow p-6">
          <h2 className="font-display text-lg font-semibold mb-4">Create New Employee</h2>
        <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Full Name</label>
            <input
              className={inputClass}
              placeholder="Jane Doe"
              value={form.fullName}
              onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Employee Code</label>
            <input
              className={inputClass}
              placeholder="EMP-001"
              value={form.employeeCode}
              onChange={(e) => setForm((p) => ({ ...p, employeeCode: e.target.value }))}
              required
              title="Auto-generated employee code (you can edit if needed)"
            />
            <p className="text-xs text-muted-foreground mt-1">✨ Auto-generated (editable)</p>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Login ID</label>
            <input
              type="email"
              className={inputClass}
              placeholder="jane@autocard.com"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Default Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className={`${inputClass} pr-10`}
                placeholder="At least 6 characters"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium mb-1.5 block">Job Title <span className="text-muted-foreground font-normal">(optional)</span></label>
            <input
              className={inputClass}
              placeholder="Automation Engineer"
              value={form.jobTitle}
              onChange={(e) => setForm((p) => ({ ...p, jobTitle: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="cta-gradient text-white font-semibold px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {submitting ? "Creating..." : "Create Employee"}
            </button>
          </div>
        </form>
      </div>
      )}

      {/* No Create Permission Message */}
      {!canCreate && isEmployeeView && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
          <p className="text-sm text-amber-800">
            <strong>Note:</strong> You don't have permission to create new employees. Contact your administrator if you need this access.
          </p>
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
                <h3 className="font-display text-lg font-bold">Delete Employee</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Are you sure you want to delete <span className="font-semibold text-foreground">{deleteTarget.fullName}</span> ({deleteTarget.employeeCode})? This permanently removes their account and all related records (onboarding, attendance, leave, requests). This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
              >
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

export default Employee;