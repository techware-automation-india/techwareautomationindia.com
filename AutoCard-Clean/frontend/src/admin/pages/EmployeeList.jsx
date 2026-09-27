import { useEffect, useState, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Loader2, RefreshCw, ArrowLeft, Eye, Trash2, AlertTriangle, Search, Filter, X } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiDelete } from "../../lib/api.js";
import { fetchRoles } from "../../lib/api/rolesApi.js";
import OnboardingPreview from "../components/OnboardingPreview.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

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

const EmployeeList = ({ employeePermissions = null, isEmployeeView = false }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filterStatus = searchParams.get("status"); // Get status from URL
  
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [viewingEmployee, setViewingEmployee] = useState(null);
  const [onboardingData, setOnboardingData] = useState(null);
  const [loadingOnboarding, setLoadingOnboarding] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [jobTitleFilter, setJobTitleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState(filterStatus ? filterStatus.toUpperCase() : "all");

  // Keep statusFilter in sync if URL query parameter changes
  useEffect(() => {
    if (filterStatus) {
      setStatusFilter(filterStatus.toUpperCase());
    }
  }, [filterStatus]);

  // Permission helpers
  const permissions = employeePermissions || {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
  };
  
  const canDelete = permissions.canDelete;

  const loadEmployees = async () => {
    console.log("🔄 [Frontend] Loading employees and roles...");
    try {
      const [roleData, data] = await Promise.all([
        fetchRoles().catch((err) => {
          console.warn("Could not fetch roles for filters:", err);
          return { roles: [] };
        }),
        apiGet("/employees"),
      ]);
      setRoles(roleData?.roles || []);
      setEmployees(data?.employees || []);
    } catch (err) {
      console.error("❌ [Frontend] Failed to load data:", err);
      toast.error(err.message || "Failed to load accounts.");
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
    
    console.log("🗑️ [Frontend] Deleting account:", deleteTarget);
    setDeleting(true);
    
    try {
      await apiDelete(`/employees/${deleteTarget.id}`);
      console.log("✅ [Frontend] Account deleted successfully");
      toast.success(`Account "${deleteTarget.fullName}" deleted.`);
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      console.error("❌ [Frontend] Failed to delete account:", err);
      toast.error(err.message || "Failed to delete account.");
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

  // Distinct roles extracted from roles API and loaded employees
  const availableRoles = useMemo(() => {
    const set = new Set();
    roles.forEach((r) => {
      if (r?.name) set.add(r.name);
    });
    employees.forEach((emp) => {
      const r = emp.roleName || emp.role;
      if (r) set.add(r);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [roles, employees]);

  // Distinct job titles extracted from loaded employees
  const availableJobTitles = useMemo(() => {
    const set = new Set();
    employees.forEach((emp) => {
      if (emp.jobTitle && emp.jobTitle.trim()) {
        set.add(emp.jobTitle.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [employees]);

  // Handle status filter change
  const handleStatusChange = (val) => {
    setStatusFilter(val);
    if (val === "all") {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("status");
        return next;
      });
    } else {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("status", val);
        return next;
      });
    }
  };

  // Reset all filters
  const resetFilters = () => {
    setSearchQuery("");
    setRoleFilter("all");
    setJobTitleFilter("all");
    setStatusFilter("all");
    setSearchParams({});
  };

  // Multi-criteria filtered list
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      // 1. Search Query (Name, Code, Email)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = emp.fullName?.toLowerCase().includes(q);
        const codeMatch = emp.employeeCode?.toLowerCase().includes(q);
        const emailMatch = emp.email?.toLowerCase().includes(q);
        if (!nameMatch && !codeMatch && !emailMatch) {
          return false;
        }
      }

      // 2. Role Filter
      if (roleFilter !== "all") {
        const currentRole = emp.roleName || emp.role;
        if (currentRole !== roleFilter) {
          return false;
        }
      }

      // 3. Job Title Filter
      if (jobTitleFilter !== "all") {
        if ((emp.jobTitle || "").trim() !== jobTitleFilter) {
          return false;
        }
      }

      // 4. Onboarding Status Filter
      if (statusFilter !== "all") {
        if (emp.onboardingStatus !== statusFilter) {
          return false;
        }
      }

      return true;
    });
  }, [employees, searchQuery, roleFilter, jobTitleFilter, statusFilter]);

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    roleFilter !== "all" ||
    jobTitleFilter !== "all" ||
    statusFilter !== "all"
  );

  // Dynamic page title based on status
  const getPageTitle = () => {
    if (statusFilter !== "all") {
      return `${statusFilter.charAt(0) + statusFilter.slice(1).toLowerCase()} Accounts`;
    }
    return "All Accounts";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link 
            to={isEmployeeView ? "/employee/employee" : "/admin/employee"} 
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-2 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Add Account Module
          </Link>
          <h1 className="font-display text-2xl font-bold">{getPageTitle()}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {hasActiveFilters ? (
              <>
                Showing <span className="font-semibold text-foreground">{filteredEmployees.length}</span> of {employees.length} {employees.length === 1 ? "account" : "accounts"}
              </>
            ) : (
              <>
                Total {employees.length} {employees.length === 1 ? "account" : "accounts"}
              </>
            )}
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

      {/* Search and Filters Bar */}
      <div className="rounded-2xl bg-background border border-border card-shadow p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search box: Name, Code, Email */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, code, email..."
              className="w-full pl-9 pr-8 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                title="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Role Filter */}
          <div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
            >
              <option value="all">All Roles</option>
              {availableRoles.map((r) => (
                <option key={r} value={r}>
                  Role: {r}
                </option>
              ))}
            </select>
          </div>

          {/* Job Title Filter */}
          <div>
            <select
              value={jobTitleFilter}
              onChange={(e) => setJobTitleFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
            >
              <option value="all">All Job Titles</option>
              {availableJobTitles.map((jt) => (
                <option key={jt} value={jt}>
                  {jt}
                </option>
              ))}
            </select>
          </div>

          {/* Onboarding Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
            >
              <option value="all">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>

        {/* Active Filters and Reset */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60 text-xs">
            <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
              <span className="font-medium flex items-center gap-1 text-foreground">
                <Filter className="h-3 w-3" /> Filters:
              </span>
              {searchQuery.trim() && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary text-foreground border border-border">
                  Search: "{searchQuery.trim()}"
                  <button onClick={() => setSearchQuery("")} className="hover:text-destructive transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {roleFilter !== "all" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary text-foreground border border-border">
                  Role: {roleFilter}
                  <button onClick={() => setRoleFilter("all")} className="hover:text-destructive transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {jobTitleFilter !== "all" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary text-foreground border border-border">
                  Job: {jobTitleFilter}
                  <button onClick={() => setJobTitleFilter("all")} className="hover:text-destructive transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {statusFilter !== "all" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary text-foreground border border-border">
                  Status: {statusFilter}
                  <button onClick={() => handleStatusChange("all")} className="hover:text-destructive transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium ml-auto"
            >
              <X className="h-3 w-3" />
              Reset filters
            </button>
          </div>
        )}
      </div>

      {/* Employee List Table */}
      <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">
        {loading ? (
          <div className="p-12 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground space-y-3">
            <div>
              {hasActiveFilters
                ? "No accounts match the selected filters or search query."
                : filterStatus 
                ? `No ${filterStatus.toLowerCase()} accounts found.` 
                : "No accounts found."}
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-secondary text-xs font-medium text-primary transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                Clear Filters
              </button>
            )}
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
                  <th className="px-6 py-4 font-medium">Role</th>
                  <th className="px-6 py-4 font-medium">Job Title / Company</th>
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
                            src={`${API_BASE}${emp.profileImage}`}
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
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {emp.roleName || emp.role || "No Role"}
                      </span>
                    </td>
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
                        {canDelete && (
                          <button
                            onClick={() => setDeleteTarget(emp)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                            title="Delete account"
                          >
                            <Trash2 className="h-4 w-4" /> Delete
                          </button>
                        )}
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
                <h3 className="font-display font-semibold text-lg">Delete Account</h3>
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
