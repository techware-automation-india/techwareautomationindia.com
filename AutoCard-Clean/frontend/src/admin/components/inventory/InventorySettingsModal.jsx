import { useState, useEffect } from "react";
import {
  X,
  Settings,
  ShieldCheck,
  Search,
  Check,
  CheckSquare,
  Square,
  User,
  Users,
  RefreshCw,
  AlertCircle,
  Save,
} from "lucide-react";
import { apiGet, apiPut } from "../../../lib/api.js";
import { toast } from "sonner";

/**
 * InventorySettingsModal / ModuleAccessSettingsModal
 * Allows Admin to configure per-employee granular permissions across all submodules of a module:
 * (Inventory, Requests, Approvals, Leave Policy, etc.)
 * Columns: Employee Name, View, Create, Edit, Delete
 */
export default function InventorySettingsModal({
  isOpen,
  onClose,
  parentModuleKey = "inventory",
  moduleTitle = null,
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [submodules, setSubmodules] = useState([]);
  const [selectedSubmoduleKey, setSelectedSubmoduleKey] = useState("");
  const [search, setSearch] = useState("");
  // Local state for permissions: { [userId]: { [submoduleKey]: { canView, canCreate, canEdit, canDelete } } }
  const [permissionState, setPermissionState] = useState({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedSubmoduleKey("");
      loadPermissions();
    }
  }, [isOpen, parentModuleKey]);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      // Use the unified /roles-access/module-permissions?module=<parentModuleKey> endpoint
      const data = await apiGet(`/roles-access/module-permissions?module=${parentModuleKey}`);
      setEmployees(data.employees || []);
      setSubmodules(data.submodules || []);
      if (data.submodules?.length > 0) {
        setSelectedSubmoduleKey(data.submodules[0].key);
      }

      // Initialize state map
      const stateMap = {};
      (data.employees || []).forEach((emp) => {
        stateMap[emp.id] = emp.permissions || {};
      });
      setPermissionState(stateMap);
      setHasChanges(false);
    } catch (err) {
      toast.error(err.message || "Failed to load employee permissions.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (userId, submoduleKey, actionKey) => {
    setPermissionState((prev) => {
      const userPerms = prev[userId] || {};
      const currentSubPerms = userPerms[submoduleKey] || {
        canView: false,
        canCreate: false,
        canEdit: false,
        canDelete: false,
      };

      const nextVal = !currentSubPerms[actionKey];
      const updatedSubPerms = { ...currentSubPerms, [actionKey]: nextVal };

      // If granting create, edit, or delete, ensure view is also enabled
      if (nextVal && (actionKey === "canCreate" || actionKey === "canEdit" || actionKey === "canDelete")) {
        updatedSubPerms.canView = true;
      }
      // If revoking view, revoke create, edit, delete as well
      if (!nextVal && actionKey === "canView") {
        updatedSubPerms.canCreate = false;
        updatedSubPerms.canEdit = false;
        updatedSubPerms.canDelete = false;
      }

      return {
        ...prev,
        [userId]: {
          ...userPerms,
          [submoduleKey]: updatedSubPerms,
        },
      };
    });
    setHasChanges(true);
  };

  const handleToggleAllForUser = (userId, submoduleKey, enableAll) => {
    setPermissionState((prev) => {
      const userPerms = prev[userId] || {};
      return {
        ...prev,
        [userId]: {
          ...userPerms,
          [submoduleKey]: {
            canView: enableAll,
            canCreate: enableAll,
            canEdit: enableAll,
            canDelete: enableAll,
          },
        },
      };
    });
    setHasChanges(true);
  };

  const handleSave = async (userId = null) => {
    setSaving(true);
    try {
      if (userId) {
        // Save single employee
        const perms = permissionState[userId] || {};
        await apiPut(`/roles-access/module-permissions/${userId}?module=${parentModuleKey}`, { permissions: perms });
        toast.success("Employee permissions updated.");
      } else {
        // Save all non-admin employees who have changes
        const nonAdminEmps = employees.filter((e) => !e.isAdmin);
        for (const emp of nonAdminEmps) {
          const perms = permissionState[emp.id] || {};
          await apiPut(`/roles-access/module-permissions/${emp.id}?module=${parentModuleKey}`, { permissions: perms });
        }
        toast.success(`All ${displayModuleName} permissions saved successfully.`);
      }
      setHasChanges(false);
      loadPermissions();
    } catch (err) {
      toast.error(err.message || "Failed to save permissions.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const currentSubmodule = submodules.find((s) => s.key === selectedSubmoduleKey) || submodules[0];

  const displayModuleName = moduleTitle || (
    parentModuleKey === "inventory" ? "Inventory" :
    parentModuleKey === "requests" ? "Requests" :
    parentModuleKey === "approvals" ? "Approvals" :
    parentModuleKey === "leave-policy" ? "Leave Policy & Holiday" :
    parentModuleKey.charAt(0).toUpperCase() + parentModuleKey.slice(1)
  );

  const filteredEmployees = employees.filter((emp) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (emp.fullName || "").toLowerCase().includes(q) ||
      (emp.email || "").toLowerCase().includes(q) ||
      (emp.roleName || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-sm animate-in fade-in-0">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-border bg-background shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border bg-secondary/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
              <Settings className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg sm:text-xl font-bold text-foreground">
                  {displayModuleName} Access &amp; Permissions
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                  Admin Control
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Assign granular permissions (View, Create, Edit, Delete) to employees for each {displayModuleName} submodule.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Submodule Tabs Bar */}
        <div className="border-b border-border bg-secondary/10 px-4 sm:px-6 py-2.5 flex items-center gap-2 overflow-x-auto scrollbar-none">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span>Submodule:</span>
          </span>
          {submodules.map((sub) => {
            const isSelected = selectedSubmoduleKey === sub.key;
            return (
              <button
                key={sub.key}
                type="button"
                onClick={() => setSelectedSubmoduleKey(sub.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? "bg-primary text-white shadow-xs font-bold"
                    : "bg-background border border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {sub.label}
              </button>
            );
          })}
        </div>

        {/* Search & Actions Bar */}
        <div className="p-4 sm:px-6 border-b border-border bg-background flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search employee by name, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={loadPermissions}
              disabled={loading}
              className="p-2 rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-secondary text-xs transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            {hasChanges && (
              <button
                type="button"
                onClick={() => handleSave()}
                disabled={saving}
                className="cta-gradient text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{saving ? "Saving..." : "Save All Changes"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Permissions Table: emp name, view, create, edit, delete */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center text-muted-foreground gap-3">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              <span className="text-sm">Loading employees and access rules...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-secondary/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="py-3.5 px-4 sm:px-6">Employee Name</th>
                    <th className="py-3.5 px-4 text-center w-24">View</th>
                    <th className="py-3.5 px-4 text-center w-28">Create</th>
                    <th className="py-3.5 px-4 text-center w-24">Edit</th>
                    <th className="py-3.5 px-4 text-center w-24">Delete</th>
                    <th className="py-3.5 px-4 text-right pr-6 w-32">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-muted-foreground text-xs">
                        No employees found matching &quot;{search}&quot;.
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((emp) => {
                      const userPerms = permissionState[emp.id]?.[currentSubmodule?.key] || {
                        canView: false,
                        canCreate: false,
                        canEdit: false,
                        canDelete: false,
                      };
                      const isAdmin = emp.isAdmin;

                      return (
                        <tr
                          key={emp.id}
                          className={`hover:bg-secondary/10 transition-colors ${
                            isAdmin ? "bg-muted/10 opacity-75" : ""
                          }`}
                        >
                          {/* Employee Name & Details */}
                          <td className="py-3.5 px-4 sm:px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                                {emp.fullName?.charAt(0) || "U"}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-foreground text-xs sm:text-sm truncate">
                                    {emp.fullName}
                                  </span>
                                  {isAdmin && (
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-primary/10 text-primary uppercase">
                                      Admin
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-muted-foreground truncate block">
                                  {emp.email} • {emp.roleName ? emp.roleName.replace(/\s*\(Custom.*?\)/gi, "") : ""}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 1. View Checkbox */}
                          <td className="py-3.5 px-4 text-center">
                            {isAdmin ? (
                              <span className="inline-flex items-center justify-center text-emerald-600 font-bold text-xs">
                                <Check className="h-4 w-4" />
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggle(emp.id, currentSubmodule.key, "canView")}
                                className={`inline-flex items-center justify-center p-1.5 rounded-lg border transition-all cursor-pointer ${
                                  userPerms.canView
                                    ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                    : "border-border text-muted-foreground hover:bg-secondary"
                                }`}
                                title="Toggle View Permission"
                              >
                                {userPerms.canView ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                              </button>
                            )}
                          </td>

                          {/* 2. Create Checkbox */}
                          <td className="py-3.5 px-4 text-center">
                            {isAdmin ? (
                              <span className="inline-flex items-center justify-center text-emerald-600 font-bold text-xs">
                                <Check className="h-4 w-4" />
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggle(emp.id, currentSubmodule.key, "canCreate")}
                                className={`inline-flex items-center justify-center p-1.5 rounded-lg border transition-all cursor-pointer ${
                                  userPerms.canCreate
                                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                                    : "border-border text-muted-foreground hover:bg-secondary"
                                }`}
                                title="Toggle Create / Add Permission"
                              >
                                {userPerms.canCreate ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                              </button>
                            )}
                          </td>

                          {/* 3. Edit Checkbox */}
                          <td className="py-3.5 px-4 text-center">
                            {isAdmin ? (
                              <span className="inline-flex items-center justify-center text-emerald-600 font-bold text-xs">
                                <Check className="h-4 w-4" />
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggle(emp.id, currentSubmodule.key, "canEdit")}
                                className={`inline-flex items-center justify-center p-1.5 rounded-lg border transition-all cursor-pointer ${
                                  userPerms.canEdit
                                    ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                                    : "border-border text-muted-foreground hover:bg-secondary"
                                }`}
                                title="Toggle Edit Permission"
                              >
                                {userPerms.canEdit ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                              </button>
                            )}
                          </td>

                          {/* 4. Delete Checkbox */}
                          <td className="py-3.5 px-4 text-center">
                            {isAdmin ? (
                              <span className="inline-flex items-center justify-center text-emerald-600 font-bold text-xs">
                                <Check className="h-4 w-4" />
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggle(emp.id, currentSubmodule.key, "canDelete")}
                                className={`inline-flex items-center justify-center p-1.5 rounded-lg border transition-all cursor-pointer ${
                                  userPerms.canDelete
                                    ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                                    : "border-border text-muted-foreground hover:bg-secondary"
                                }`}
                                title="Toggle Delete Permission (Admin decides)"
                              >
                                {userPerms.canDelete ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                              </button>
                            )}
                          </td>

                          {/* Quick Actions (Grant All / Revoke) */}
                          <td className="py-3.5 px-4 text-right pr-6">
                            {isAdmin ? (
                              <span className="text-xs text-muted-foreground italic">Full Access</span>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleToggleAllForUser(emp.id, currentSubmodule.key, true)}
                                  className="px-2 py-1 rounded-lg border border-border bg-background hover:bg-secondary text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                  title="Grant all 4 permissions"
                                >
                                  Grant All
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleAllForUser(emp.id, currentSubmodule.key, false)}
                                  className="px-2 py-1 rounded-lg border border-border bg-background hover:bg-secondary text-[11px] font-semibold text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                                  title="Revoke all permissions"
                                >
                                  Revoke
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:px-6 border-t border-border bg-secondary/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span>Admins retain full access by default. Employee actions take effect immediately upon saving.</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border bg-background hover:bg-secondary text-xs font-semibold text-foreground transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving || !hasChanges}
              className="cta-gradient text-white text-xs font-semibold px-5 py-2 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{saving ? "Saving..." : "Save Changes"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
