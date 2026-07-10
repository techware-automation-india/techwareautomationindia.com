import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Loader2, RefreshCw, ArrowLeft, Eye, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiDelete } from "../../lib/api.js";
import OnboardingPreview from "../components/OnboardingPreview.jsx";

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

const EmployeeList = () => {
  const [searchParams] = useSearchParams();
  const filterStatus = searchParams.get("status"); // Get status from URL
  
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [viewingEmployee, setViewingEmployee] = useState(null);
  const [onboardingData, setOnboardingData] = useState(null);
  const [loadingOnboarding, setLoadingOnboarding] = useState(false);

  const loadEmployees = async () => {
    console.log("🔄 [Frontend] Loading employees...");
    try {
      const data = await apiGet("/employees");
      console.log("✅ [Frontend] Employees loaded:", data.employees);
      setEmployees(data.employees);
    } catch (err) {
      console.error("❌ [Frontend] Failed to load employees:", err);
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
    loadEmployees();
  }, []);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    
    console.log("🗑️ [Frontend] Deleting employee:", deleteTarget);
    setDeleting(true);
    
    try {
      await apiDelete(`/employees/${deleteTarget.id}`);
      console.log("✅ [Frontend] Employee deleted successfully");
      toast.success(`Employee "${deleteTarget.fullName}" deleted.`);
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      console.error("❌ [Frontend] Failed to delete employee:", err);
      toast.error(err.message || "Failed to delete employee.");
    } finally {
      setDeleting(false);
    }
  };

  const viewOnboarding = async (employee) => {
    console.log("👁️ [Frontend] Viewing onboarding for:", employee);
    setViewingEmployee(employee);
    setLoadingOnboarding(true);
    
    try {
      const data = await apiGet(`/onboarding/employee/${employee.id}`);
      console.log("✅ [Frontend] Onboarding data loaded:", data);
      setOnboardingData(data.profile);
    } catch (err) {
      console.error("❌ [Frontend] Failed to load onboarding:", err);
      toast.error(err.message || "Failed to load onboarding data.");
      setViewingEmployee(null);
    } finally {
      setLoadingOnboarding(false);
    }
  };

  const closeOnboardingView = () => {
    setViewingEmployee(null);
    setOnboardingData(null);
  };

  // Filter employees based on URL parameter
  const filteredEmployees = filterStatus 
    ? employees.filter((e) => e.onboardingStatus === filterStatus)
    : employees;

  // Get title based on filter
  const getPageTitle = () => {
    if (!filterStatus) return "All Employees";
    return `${filterStatus.charAt(0) + filterStatus.slice(1).toLowerCase()} Employees`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link 
            to="/admin/employee" 
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-2 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Employee Module
          </Link>
          <h1 className="font-display text-2xl font-bold">{getPageTitle()}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Showing {filteredEmployees.length} {filteredEmployees.length === 1 ? 'employee' : 'employees'}
          </p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background hover:bg-secondary transition-colors text-sm font-medium"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Employee List Table */}
      <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">
        {loading ? (
          <div className="p-12 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            {filterStatus 
              ? `No ${filterStatus.toLowerCase()} employees found.` 
              : "No employees found."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border bg-secondary/30">
                  <th className="px-6 py-4 font-medium">Photo</th>
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Code</th>
                  <th className="px-6 py-4 font-medium">Email</th>
                  <th className="px-6 py-4 font-medium">Job Title</th>
                  <th className="px-6 py-4 font-medium">Onboarding</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="border-b border-border last:border-0 hover:bg-secondary/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-secondary flex items-center justify-center border border-border">
                        {emp.profileImage ? (
                          <img
                            src={`http://localhost:4000${emp.profileImage}`}
                            alt={emp.fullName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-xs font-semibold text-muted-foreground">
                            {emp.fullName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium">{emp.fullName}</td>
                    <td className="px-6 py-4 text-muted-foreground">{emp.employeeCode}</td>
                    <td className="px-6 py-4 text-muted-foreground">{emp.email}</td>
                    <td className="px-6 py-4 text-muted-foreground">{emp.jobTitle || "—"}</td>
                    <td className="px-6 py-4"><StatusBadge status={emp.onboardingStatus} /></td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {(emp.onboardingStatus === "SUBMITTED" || emp.onboardingStatus === "APPROVED") && (
                          <button
                            onClick={() => viewOnboarding(emp)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                            title="View onboarding details"
                          >
                            <Eye className="h-4 w-4" /> View
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteTarget(emp)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                          title="Delete employee"
                        >
                          <Trash2 className="h-4 w-4" /> Delete
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

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/50" onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="relative bg-background rounded-2xl border border-border shadow-xl w-full max-w-md p-6">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5.5 w-5.5 text-destructive" />
              </div>
              <div className="flex-1">
                <h3 className="font-display font-semibold text-lg">Delete Employee</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Are you sure you want to delete <strong>{deleteTarget.fullName}</strong>? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-background hover:bg-secondary text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-lg bg-destructive text-destructive-foreground hover:opacity-90 text-sm font-medium transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding Preview Modal */}
      {viewingEmployee && (
        <OnboardingPreview
          employee={viewingEmployee}
          onboardingData={onboardingData}
          loading={loadingOnboarding}
          onClose={closeOnboardingView}
          onRefresh={refresh}
        />
      )}
    </div>
  );
};

export default EmployeeList;
