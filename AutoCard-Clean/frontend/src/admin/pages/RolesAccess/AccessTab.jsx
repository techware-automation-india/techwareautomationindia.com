import { useState, useEffect } from "react";
import { Search, Filter, Users, Shield, ShieldCheck, UserCheck } from "lucide-react";
import { fetchUsersWithRoles, assignUserRole } from "../../../lib/api/usersApi";
import { fetchRoles } from "../../../lib/api/rolesApi";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import EmptyState from "../../../components/common/EmptyState";
import { toast } from "sonner";

/**
 * AccessTab: Employee Role & Access Assignment Management
 * 
 * Allows administrators to assign created Roles to each employee from a dropdown,
 * immediately granting them all module and submodule permissions configured under that role.
 */
export default function AccessTab() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState("all");

  useEffect(() => {
    loadData(false);

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadData(true);
      }
    }, 10000);

    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        loadData(true);
      }
    };
    window.addEventListener("visibilitychange", handleFocus);
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("visibilitychange", handleFocus);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const loadData = async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
      setError("");
    }
    try {
      const [usersData, rolesData] = await Promise.all([
        fetchUsersWithRoles(),
        fetchRoles()
      ]);
      const usersList = Array.isArray(usersData) ? usersData : (usersData?.users || []);
      setUsers(usersList);
      setRoles(rolesData?.roles || []);
    } catch (err) {
      if (!isBackground) {
        setError(err.message || "Failed to load employee access data");
        console.error("Load access data error:", err);
      }
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  };

  const handleRoleAssignment = async (userId, roleId) => {
    const isRemoving = !roleId || roleId === "";
    try {
      await assignUserRole(userId, roleId || null);

      // Update local state immediately
      setUsers((prevUsers) =>
        prevUsers.map((user) => {
          if (user.id !== userId) return user;
          if (isRemoving) {
            return { ...user, roleId: null, customRole: null };
          }
          const assignedRole = roles.find((r) => r.id === roleId);
          return {
            ...user,
            roleId,
            customRole: assignedRole,
            role: assignedRole?.name?.toUpperCase() === "ADMIN"
              ? "ADMIN"
              : (assignedRole?.name?.toUpperCase() === "CUSTOMER" ? "CUSTOMER" : "EMPLOYEE"),
          };
        })
      );

      if (isRemoving) {
        toast.success("Role unassigned successfully.");
      } else {
        const assignedRole = roles.find((r) => r.id === roleId);
        toast.success(`Role "${assignedRole?.name || "role"}" assigned successfully! Modules and permissions updated.`);
      }
    } catch (err) {
      toast.error(`Failed to update role: ${err.message || "Unknown error"}`);
      console.error("Assign role error:", err);
    }
  };

  // Filter users based on search and role filter
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      !searchQuery ||
      (user.fullName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.email || "").toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRoleFilter =
      selectedRoleFilter === "all" || user.roleId === selectedRoleFilter;
    
    return matchesSearch && matchesRoleFilter;
  });

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4">
          <p className="text-red-600 dark:text-red-400 text-sm font-medium">{error}</p>
          <button
            onClick={() => loadData(false)}
            className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400 underline cursor-pointer"
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner Info */}
      <div className="bg-card border border-border rounded-2xl p-5 card-shadow">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-foreground font-display">
                Employee Role &amp; Module Access Assignment
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                Live Sync
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Assign defined roles to employees. Each assigned role automatically determines all accessible modules, dashboards, and features for that employee.
            </p>
          </div>
        </div>
      </div>

      {/* Top Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-border rounded-2xl p-4 card-shadow">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search employee by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-input bg-background text-foreground rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>

        {/* Role Filter */}
        <div className="sm:w-64 relative">
          <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <select
            value={selectedRoleFilter}
            onChange={(e) => setSelectedRoleFilter(e.target.value)}
            className="w-full pl-10 pr-8 py-2 border border-input bg-background text-foreground rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
          >
            <option value="all">Filter by: All Roles</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name} {role.isDefault ? "(Default)" : "(Custom)"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Users Table */}
      {filteredUsers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={searchQuery || selectedRoleFilter !== "all" ? "No employees match your search" : "No employees found"}
          message={searchQuery || selectedRoleFilter !== "all" ? "Try adjusting your search query or role filter." : "No registered employee accounts found in the system."}
        />
      ) : (
        <div className="bg-card border border-border rounded-2xl card-shadow overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-secondary/40 border-b border-border">
                <tr className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="px-6 py-3.5">Employee Name</th>
                  <th className="px-6 py-3.5">Email</th>
                  <th className="px-6 py-3.5">Current Assigned Role</th>
                  <th className="px-6 py-3.5">Accessible Modules</th>
                  <th className="px-6 py-3.5 text-right">Assign Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {filteredUsers.map((user) => {
                  const defaultEmpRole = roles.find((r) => r.isDefault && r.name.toLowerCase() === "employee") || roles.find((r) => r.name.toLowerCase() === "employee");
                  const roleObj = user.customRole || roles.find((r) => r.id === user.roleId) || (user.role === "EMPLOYEE" ? defaultEmpRole : null);
                  const roleModules = Array.isArray(roleObj?.modules)
                    ? roleObj.modules
                    : [];
                  const moduleCount = roleModules.length || roleObj?.moduleCount || 0;

                  return (
                    <tr key={user.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-semibold text-foreground text-sm">{user.fullName || "—"}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-xs sm:text-sm text-muted-foreground font-mono">{user.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                              roleObj?.isDefault
                                ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"
                                : roleObj
                                ? "bg-primary/10 text-primary border border-primary/20"
                                : "bg-secondary text-muted-foreground border-border"
                            }`}
                          >
                            <Shield className="h-3 w-3" />
                            {roleObj?.name ? roleObj.name.replace(/\s*\(Custom.*?\)/gi, "") : (user.role === "EMPLOYEE" ? "Employee" : user.role || "Employee")}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-xs text-muted-foreground">
                          {user.role === "ADMIN" ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Full Admin Access (All)</span>
                          ) : moduleCount > 0 ? (
                            <span className="font-medium text-foreground">{moduleCount} Modules Granted</span>
                          ) : (
                            <span className="italic text-muted-foreground/80">No custom modules</span>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <select
                          value={user.roleId || (roles.find((r) => r.isDefault && r.name.toLowerCase() === "employee")?.id || "")}
                          onChange={(e) => handleRoleAssignment(user.id, e.target.value)}
                          className="px-3 py-1.5 border border-input bg-background text-foreground rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-primary focus:border-primary cursor-pointer shadow-2xs"
                        >
                          {roles.map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.name} {role.isDefault ? "(Default)" : "(Custom)"}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout */}
          <div className="md:hidden divide-y divide-border">
            {filteredUsers.map((user) => {
              const defaultEmpRole = roles.find((r) => r.isDefault && r.name.toLowerCase() === "employee") || roles.find((r) => r.name.toLowerCase() === "employee");
              const roleObj = user.customRole || roles.find((r) => r.id === user.roleId) || (user.role === "EMPLOYEE" ? defaultEmpRole : null);
              return (
                <div key={user.id} className="p-4 space-y-3">
                  <div>
                    <div className="font-semibold text-foreground text-sm">{user.fullName || "—"}</div>
                    <div className="text-xs text-muted-foreground font-mono">{user.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Current:</span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                      <Shield className="h-3 w-3" />
                      {roleObj?.name ? roleObj.name.replace(/\s*\(Custom.*?\)/gi, "") : (user.role === "EMPLOYEE" ? "Employee" : user.role || "Employee")}
                    </span>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">Assign Role</label>
                    <select
                      value={user.roleId || (roles.find((r) => r.isDefault && r.name.toLowerCase() === "employee")?.id || "")}
                      onChange={(e) => handleRoleAssignment(user.id, e.target.value)}
                      className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-primary focus:border-primary cursor-pointer"
                    >
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name} {role.isDefault ? "(Default)" : "(Custom)"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Results Count */}
      {filteredUsers.length > 0 && (
        <div className="mt-4 text-xs sm:text-sm text-muted-foreground text-center">
          Showing {filteredUsers.length} of {users.length} employees
        </div>
      )}
    </div>
  );
}
