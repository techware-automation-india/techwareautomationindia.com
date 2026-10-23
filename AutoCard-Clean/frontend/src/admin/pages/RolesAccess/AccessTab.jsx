import { useState, useEffect } from "react";
import {
  Search,
  Users,
  Check,
  CheckSquare,
  Square,
  RefreshCw,
  AlertCircle,
  Save,
  ShieldCheck,
  Layers,
  Sparkles,
  ArrowRight,
  Settings,
} from "lucide-react";
import { apiGet, apiPut } from "../../../lib/api.js";
import { MODULES } from "../../../data/modules.js";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import { toast } from "sonner";

/**
 * AccessTab: Single Comprehensive Employee Access & Permissions Management
 * Features:
 * 1. Module Selector Pills: Choose any top module (Overview, Requests, Approvals, Inventory, Leave Policy, etc.)
 * 2. Default Module Button: Admin decides which modules are enabled by default for all employees
 * 3. Employee Access Table: Columns: Employee Name, View, Create, Edit, Delete checkboxes + Quick Actions (Grant All / Revoke)
 * 4. Submodule Switcher: If the selected module has submodules, provides submodule tabs with the same View, Create, Edit, Delete table!
 */
export default function AccessTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [moduleSubmodules, setModuleSubmodules] = useState({});

  // Active module & submodule selection
  const [selectedModuleKey, setSelectedModuleKey] = useState("overview");
  const [selectedSubmoduleKey, setSelectedSubmoduleKey] = useState(null);

  // Search filter
  const [search, setSearch] = useState("");

  // Permissions state: { [userId]: { [moduleOrSubKey]: { canView, canCreate, canEdit, canDelete } } }
  const [permissionState, setPermissionState] = useState({});
  const [hasChanges, setHasChanges] = useState(false);

  // System Default Modules state: array of module keys admin configured as defaults
  const [defaultModuleKeys, setDefaultModuleKeys] = useState(() => {
    const saved = localStorage.getItem("system_default_modules");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          if (!parsed.includes("academic-calendar")) {
            parsed.push("academic-calendar");
          }
          return parsed;
        }
      } catch {
        // fallback
      }
    }
    return ["overview", "mark-attendance", "attendance", "academic-calendar", "requests"];
  });

  const [isDefaultModuleModalOpen, setIsDefaultModuleModalOpen] = useState(false);

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const data = await apiGet("/roles-access/module-permissions");
      setEmployees(data.employees || []);
      setModuleSubmodules(data.moduleSubmodules || {});

      // Build permissions state map
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

  // Non-default configurable modules (modules configured as default are excluded from the selector list)
  const configurableModules = MODULES.filter((m) => !defaultModuleKeys.includes(m.key));

  // Find the selected module object from configurableModules (or fallback to first configurable module)
  const currentModuleObj =
    configurableModules.find((m) => m.key === selectedModuleKey) ||
    configurableModules[0] ||
    MODULES[0];
  const hasSubmodules = Array.isArray(currentModuleObj?.subModules) && currentModuleObj.subModules.length > 0;

  // Active key being configured in the table right now (either the submodule key or top-level module key)
  const activeTargetKey = hasSubmodules && selectedSubmoduleKey ? selectedSubmoduleKey : currentModuleObj?.key;

  // Find active submodule object if present to inspect customized action labels
  const activeSubmoduleObj = hasSubmodules ? currentModuleObj?.subModules?.find((s) => s.key === activeTargetKey) : null;
  const customActions = activeSubmoduleObj?.actions || null;

  // Check if current targeted module is view-only (e.g. Team Attendance has no create/edit/delete records)
  const isViewOnlyModule = activeTargetKey === "attendance-management";

  // Custom action column labels:
  // For 'employee' (Add Account): View | Account Add | Account Edit | Account Delete
  // For 'approvals': View List | Request Approve | Edit / Notes | Request Reject
  const actionLabels = {
    view: customActions?.find((a) => a.key === 'view')?.label || (currentModuleObj?.key === 'employee' ? 'View' : currentModuleObj?.key === 'approvals' ? 'View List' : 'View'),
    create: customActions?.find((a) => a.key === 'create')?.label || (currentModuleObj?.key === 'employee' ? 'Account Add' : currentModuleObj?.key === 'approvals' ? 'Request Approve' : 'Create'),
    edit: customActions?.find((a) => a.key === 'edit')?.label || (currentModuleObj?.key === 'employee' ? 'Account Edit' : currentModuleObj?.key === 'approvals' ? 'Edit / Notes' : 'Edit'),
    delete: customActions?.find((a) => a.key === 'delete')?.label || (currentModuleObj?.key === 'employee' ? 'Account Delete' : currentModuleObj?.key === 'approvals' ? 'Request Reject' : 'Delete'),
  };

  // When switching parent module, automatically select first submodule if available
  const handleSelectModule = (modKey) => {
    setSelectedModuleKey(modKey);
    const mod = MODULES.find((m) => m.key === modKey);
    if (mod?.subModules?.length > 0) {
      setSelectedSubmoduleKey(mod.subModules[0].key);
    } else {
      setSelectedSubmoduleKey(null);
    }
  };

  // Toggle specific action (canView, canCreate, canEdit, canDelete)
  const handleToggleAction = (userId, targetKey, actionKey) => {
    setPermissionState((prev) => {
      const userPerms = prev[userId] || {};
      const currentPerms = userPerms[targetKey] || {
        canView: false,
        canCreate: false,
        canEdit: false,
        canDelete: false,
      };

      const nextVal = !currentPerms[actionKey];
      const updatedPerms = { ...currentPerms, [actionKey]: nextVal };

      // If granting create, edit, or delete, ensure view is also enabled
      if (nextVal && (actionKey === "canCreate" || actionKey === "canEdit" || actionKey === "canDelete")) {
        updatedPerms.canView = true;
      }
      // If revoking view, revoke create, edit, delete as well
      if (!nextVal && actionKey === "canView") {
        updatedPerms.canCreate = false;
        updatedPerms.canEdit = false;
        updatedPerms.canDelete = false;
      }

      const nextUserPerms = {
        ...userPerms,
        [targetKey]: updatedPerms,
      };

      // If targetKey is a submodule and view was granted, make sure parent module also has canView
      if (hasSubmodules && selectedModuleKey) {
        const subKeys = currentModuleObj.subModules.map((s) => s.key);
        const hasAnySubView = subKeys.some((sk) => {
          const sp = nextUserPerms[sk];
          return sp && (sp.canView || sp.canCreate || sp.canEdit || sp.canDelete);
        });

        const parentCurrent = nextUserPerms[selectedModuleKey] || { canView: false, canCreate: false, canEdit: false, canDelete: false };
        nextUserPerms[selectedModuleKey] = {
          ...parentCurrent,
          canView: hasAnySubView,
        };
      }

      return {
        ...prev,
        [userId]: nextUserPerms,
      };
    });
    setHasChanges(true);
  };

  // Grant all or revoke all 4 actions for a user on this target key
  const handleToggleAllForUser = (userId, targetKey, enableAll) => {
    setPermissionState((prev) => {
      const userPerms = prev[userId] || {};
      const nextUserPerms = {
        ...userPerms,
        [targetKey]: {
          canView: enableAll,
          canCreate: enableAll,
          canEdit: enableAll,
          canDelete: enableAll,
        },
      };

      // If targetKey is a submodule, synchronize parent view state based on whether ANY submodule has view
      if (hasSubmodules && selectedModuleKey) {
        const subKeys = currentModuleObj.subModules.map((s) => s.key);
        const hasAnySubView = subKeys.some((sk) => {
          const sp = nextUserPerms[sk];
          return sp && (sp.canView || sp.canCreate || sp.canEdit || sp.canDelete);
        });

        const parentCurrent = nextUserPerms[selectedModuleKey] || { canView: false, canCreate: false, canEdit: false, canDelete: false };
        nextUserPerms[selectedModuleKey] = {
          ...parentCurrent,
          canView: hasAnySubView,
          ...(enableAll === false && !hasAnySubView ? { canCreate: false, canEdit: false, canDelete: false } : {}),
        };
      }

      return {
        ...prev,
        [userId]: nextUserPerms,
      };
    });
    setHasChanges(true);
  };

  // Revoke ALL submodules and the parent module entirely for a user
  const handleRevokeEntireModuleForUser = (userId) => {
    setPermissionState((prev) => {
      const userPerms = prev[userId] || {};
      const nextUserPerms = { ...userPerms };

      if (hasSubmodules && currentModuleObj?.subModules) {
        currentModuleObj.subModules.forEach((sub) => {
          nextUserPerms[sub.key] = {
            canView: false,
            canCreate: false,
            canEdit: false,
            canDelete: false,
          };
        });
      }

      if (selectedModuleKey) {
        nextUserPerms[selectedModuleKey] = {
          canView: false,
          canCreate: false,
          canEdit: false,
          canDelete: false,
        };
      }

      return {
        ...prev,
        [userId]: nextUserPerms,
      };
    });
    setHasChanges(true);
  };

  // Save changes to backend
  const handleSave = async (userId = null) => {
    setSaving(true);
    try {
      if (userId) {
        // Save single employee
        const perms = permissionState[userId] || {};
        await apiPut(`/roles-access/module-permissions/${userId}`, { permissions: perms });
        toast.success("Employee permissions updated successfully.");
      } else {
        // Save all non-admin employees in a single fast batch call
        const nonAdminEmps = employees.filter((e) => !e.isAdmin);
        const updates = nonAdminEmps.map((emp) => ({
          userId: emp.id,
          permissions: permissionState[emp.id] || {},
        }));
        await apiPut("/roles-access/module-permissions-batch", { updates });
        toast.success("All access permissions saved successfully!");
      }
      setHasChanges(false);
      await loadPermissions();
    } catch (err) {
      console.error("Save error:", err);
      toast.error(err.message || "Failed to save permissions.");
    } finally {
      setSaving(false);
    }
  };

  // Apply default modules to an employee or all employees
  const handleApplyDefaults = (targetUserId = null) => {
    setPermissionState((prev) => {
      const nextState = { ...prev };
      const targetEmps = targetUserId
        ? employees.filter((e) => e.id === targetUserId && !e.isAdmin)
        : employees.filter((e) => !e.isAdmin);

      targetEmps.forEach((emp) => {
        const empPerms = { ...(nextState[emp.id] || {}) };
        defaultModuleKeys.forEach((modKey) => {
          empPerms[modKey] = {
            canView: true,
            canCreate: true,
            canEdit: true,
            canDelete: false, // safe default
          };

          // If it's a module with submodules, grant submodules view & create as well
          const modDef = MODULES.find((m) => m.key === modKey);
          if (modDef?.subModules) {
            modDef.subModules.forEach((sub) => {
              empPerms[sub.key] = {
                canView: true,
                canCreate: true,
                canEdit: true,
                canDelete: false,
              };
            });
          }
        });
        nextState[emp.id] = empPerms;
      });

      return nextState;
    });

    setHasChanges(true);
    toast.success(
      targetUserId
        ? "Default modules applied to selected employee."
        : "Default modules applied to all non-admin employees. Remember to click 'Save Changes'!"
    );
  };

  // Toggle module in system default modules list
  const handleToggleDefaultModule = (key) => {
    setDefaultModuleKeys((prev) => {
      const updated = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      localStorage.setItem("system_default_modules", JSON.stringify(updated));
      return updated;
    });
  };

  // Filtered employees list
  const filteredEmployees = employees.filter((emp) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (emp.fullName || "").toLowerCase().includes(q) ||
      (emp.email || "").toLowerCase().includes(q) ||
      (emp.roleName || "").toLowerCase().includes(q)
    );
  });

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-5">
      {/* ── Top Header Banner: Module Controls & Default Modules Button ── */}
      <div className="bg-card border border-border rounded-2xl p-5 card-shadow space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-foreground font-display">
                Employee Access Control &amp; Permissions
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                Admin Control
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Select any module or submodule below to configure granular (View, Create, Edit, Delete) access per employee.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Admin decides Default Modules Button */}
            <button
              type="button"
              onClick={() => setIsDefaultModuleModalOpen(true)}
              className="px-3.5 py-2 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 shadow-2xs cursor-pointer group"
              title="Configure which modules are granted to employees by default"
            >
              <Sparkles className="h-4 w-4 group-hover:rotate-12 transition-transform" />
              <span>Decide Default Modules ({defaultModuleKeys.length})</span>
            </button>

            <button
              type="button"
              onClick={() => handleApplyDefaults()}
              className="px-3 py-2 rounded-xl border border-border bg-background hover:bg-secondary text-xs sm:text-sm font-medium text-foreground transition-all flex items-center gap-1.5 cursor-pointer"
              title="Apply current default modules to all non-admin employees"
            >
              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Apply Defaults</span>
            </button>

            <button
              type="button"
              onClick={loadPermissions}
              disabled={loading}
              className="p-2 rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-secondary text-xs transition-colors cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving || !hasChanges}
              className={`text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer ${
                hasChanges
                  ? "cta-gradient text-white hover:opacity-90 ring-2 ring-primary/40 animate-pulse"
                  : "bg-secondary text-muted-foreground border border-border opacity-70 cursor-not-allowed"
              }`}
              title={hasChanges ? "Save all pending changes" : "No pending changes"}
            >
              <Save className="h-3.5 w-3.5" />
              <span>{saving ? "Saving..." : hasChanges ? "Save All Changes *" : "Saved"}</span>
            </button>
          </div>
        </div>

        {/* ── 1. Top-Level Module Navigation Pills ── */}
        <div className="pt-2 border-t border-border">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Module:</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {configurableModules.length === 0 ? (
              <span className="text-xs text-muted-foreground italic py-2">
                All modules are currently configured as defaults.
              </span>
            ) : (
              configurableModules.map((module) => {
                const isSelected = (currentModuleObj?.key || selectedModuleKey) === module.key;
                const Icon = module.icon;
                const hasSubs = Array.isArray(module.subModules) && module.subModules.length > 0;

                return (
                  <button
                    key={module.key}
                    type="button"
                    onClick={() => handleSelectModule(module.key)}
                    className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 cursor-pointer flex items-center gap-2 border ${
                      isSelected
                        ? "bg-primary text-white border-primary shadow-xs font-bold"
                        : "bg-background border-border text-foreground hover:bg-secondary hover:border-border/80"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isSelected ? "text-white" : "text-muted-foreground"}`} />
                    <span>{module.label}</span>
                    {hasSubs && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          isSelected ? "bg-white/20 text-white" : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {module.subModules.length} Sub
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── 2. Submodule Switcher Bar (If current module has submodules) ── */}
        {hasSubmodules && (
          <div className="pt-3 border-t border-dashed border-border bg-secondary/20 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 p-4 rounded-b-2xl">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
              <span className="text-xs font-bold uppercase tracking-wider text-primary shrink-0 flex items-center gap-1.5 mr-1">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                <span>{currentModuleObj.label} Submodules:</span>
              </span>
              {currentModuleObj.subModules.map((sub) => {
                const isSelected = selectedSubmoduleKey === sub.key;
                const SubIcon = sub.icon || currentModuleObj.icon;

                return (
                  <button
                    key={sub.key}
                    type="button"
                    onClick={() => setSelectedSubmoduleKey(sub.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 border ${
                      isSelected
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs font-bold"
                        : "bg-background border-border text-foreground hover:bg-secondary"
                    }`}
                  >
                    {SubIcon && <SubIcon className="h-3.5 w-3.5" />}
                    <span>{sub.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Search & Filter Bar for Employees ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-border rounded-2xl p-4 card-shadow">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search employee by name, email, or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-input bg-background text-foreground rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Targeting:</span>
          <span className="font-bold text-foreground px-2.5 py-1 rounded-lg bg-secondary border border-border">
            {hasSubmodules && selectedSubmoduleKey
              ? currentModuleObj.subModules.find((s) => s.key === selectedSubmoduleKey)?.label || selectedSubmoduleKey
              : currentModuleObj.label}
          </span>
        </div>
      </div>

      {/* ── 3. Single Unified Table: Employee Name, View, Create, Edit, Delete ── */}
      <div className="bg-card border border-border rounded-2xl card-shadow overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-auto max-h-[600px] relative">
          <table className="w-full text-left border-collapse">
            <thead className="bg-secondary/95 backdrop-blur-sm border-b border-border sticky top-0 z-10 shadow-xs">
              <tr className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="py-3.5 px-4 sm:px-6 bg-secondary/95">Employee Name</th>
                <th className="py-3.5 px-4 text-center w-28 bg-secondary/95" title={actionLabels.view}>{actionLabels.view}</th>
                {!isViewOnlyModule && (
                  <>
                    <th className="py-3.5 px-4 text-center w-36 bg-secondary/95" title={actionLabels.create}>{actionLabels.create}</th>
                    <th className="py-3.5 px-4 text-center w-32 bg-secondary/95" title={actionLabels.edit}>{actionLabels.edit}</th>
                    <th className="py-3.5 px-4 text-center w-32 bg-secondary/95" title={actionLabels.delete}>{actionLabels.delete}</th>
                  </>
                )}
                <th className="py-3.5 px-4 text-right pr-6 w-36 bg-secondary/95">Quick Actions</th>
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
                  const userPerms = permissionState[emp.id]?.[activeTargetKey] || {
                    canView: false,
                    canCreate: false,
                    canEdit: false,
                    canDelete: false,
                  };
                  const isAdmin = emp.isAdmin;

                  return (
                    <tr
                      key={emp.id}
                      className={`hover:bg-secondary/10 transition-colors ${isAdmin ? "bg-muted/10 opacity-75" : ""}`}
                    >
                      {/* Employee Info */}
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
                              {emp.email} • {emp.roleName ? emp.roleName.replace(/\s*\(Custom.*?\)/gi, '') : ''}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* If Admin: show full admin badge across action columns */}
                      {isAdmin ? (
                        <>
                          <td colSpan={isViewOnlyModule ? 1 : 4} className="py-3.5 px-4 text-center">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                              <span>{isViewOnlyModule ? "Full Admin Access" : "Full Admin Access (All Permissions Granted by Default)"}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right pr-6">
                            <span className="text-xs text-muted-foreground font-mono bg-secondary/60 px-2 py-0.5 rounded">
                              System Default
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          {/* 1. View Checkbox */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleAction(emp.id, activeTargetKey, "canView")}
                              className={`inline-flex items-center justify-center p-1.5 rounded-lg border transition-all cursor-pointer ${
                                userPerms.canView
                                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                  : "border-border text-muted-foreground hover:bg-secondary"
                              }`}
                              title="Toggle View Permission"
                            >
                              {userPerms.canView ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                            </button>
                          </td>

                          {/* 2, 3, 4 Checkboxes (Hidden for View-Only modules like Team Attendance) */}
                          {!isViewOnlyModule && (
                            <>
                              {/* 2. Create Checkbox */}
                              <td className="py-3.5 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleAction(emp.id, activeTargetKey, "canCreate")}
                                  className={`inline-flex items-center justify-center p-1.5 rounded-lg border transition-all cursor-pointer ${
                                    userPerms.canCreate
                                      ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                                      : "border-border text-muted-foreground hover:bg-secondary"
                                  }`}
                                  title="Toggle Create Permission"
                                >
                                  {userPerms.canCreate ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                                </button>
                              </td>

                              {/* 3. Edit Checkbox */}
                              <td className="py-3.5 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleAction(emp.id, activeTargetKey, "canEdit")}
                                  className={`inline-flex items-center justify-center p-1.5 rounded-lg border transition-all cursor-pointer ${
                                    userPerms.canEdit
                                      ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                                      : "border-border text-muted-foreground hover:bg-secondary"
                                  }`}
                                  title="Toggle Edit Permission"
                                >
                                  {userPerms.canEdit ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                                </button>
                              </td>

                              {/* 4. Delete Checkbox */}
                              <td className="py-3.5 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleAction(emp.id, activeTargetKey, "canDelete")}
                                  className={`inline-flex items-center justify-center p-1.5 rounded-lg border transition-all cursor-pointer ${
                                    userPerms.canDelete
                                      ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                                      : "border-border text-muted-foreground hover:bg-secondary"
                                  }`}
                                  title="Toggle Delete Permission"
                                >
                                  {userPerms.canDelete ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                                </button>
                              </td>
                            </>
                          )}

                          {/* Quick Actions (Grant All / Revoke / Save) */}
                          <td className="py-3.5 px-4 text-right pr-6">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleToggleAllForUser(emp.id, activeTargetKey, true)}
                                className="px-2 py-1 rounded-lg border border-border bg-background hover:bg-secondary text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                title="Grant all 4 permissions for this target"
                              >
                                Grant All
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleAllForUser(emp.id, activeTargetKey, false)}
                                className="px-2 py-1 rounded-lg border border-border bg-background hover:bg-secondary text-[11px] font-semibold text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                                title="Revoke permissions for this submodule"
                              >
                                Revoke
                              </button>
                              {hasSubmodules && (
                                <button
                                  type="button"
                                  onClick={() => handleRevokeEntireModuleForUser(emp.id)}
                                  className="px-2 py-1 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-[11px] font-semibold text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                                  title={`Revoke all submodules and disable ${currentModuleObj.label} entirely for this employee`}
                                >
                                  Revoke All
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleSave(emp.id)}
                                disabled={saving}
                                className="px-2 py-1 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-[11px] font-semibold text-primary transition-colors cursor-pointer disabled:opacity-50"
                                title="Save permissions specifically for this employee"
                              >
                                Save
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Bar */}
        <div className="p-4 sm:px-6 border-t border-border bg-secondary/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span>
              Admins retain full access by default. Non-admin employee permissions take effect immediately upon saving.
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <span className="text-xs text-muted-foreground">
              Showing {filteredEmployees.length} of {employees.length} employees
            </span>
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving || !hasChanges}
              className={`text-xs font-semibold px-4 py-2 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer ${
                hasChanges
                  ? "cta-gradient text-white hover:opacity-90 ring-2 ring-primary/40 animate-pulse"
                  : "bg-secondary text-muted-foreground border border-border opacity-70 cursor-not-allowed"
              }`}
            >
              <Save className="h-3.5 w-3.5" />
              <span>{saving ? "Saving..." : hasChanges ? "Save All Changes *" : "Saved"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Modal: Admin Decides Default Modules ── */}
      {isDefaultModuleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in-0">
          <div className="relative w-full max-w-2xl flex flex-col rounded-3xl border border-border bg-background shadow-2xl overflow-hidden max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-border bg-secondary/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-foreground">
                    Admin Default Module Configuration
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Select which modules will be enabled by default for employees when applying defaults.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDefaultModuleModalOpen(false)}
                className="p-2 rounded-xl border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Content: Module Checkboxes */}
            <div className="p-5 sm:p-6 space-y-3 overflow-y-auto">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Click any module to toggle default status:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {MODULES.map((module) => {
                  const isDefault = defaultModuleKeys.includes(module.key);
                  const Icon = module.icon;
                  const hasSubs = Array.isArray(module.subModules) && module.subModules.length > 0;

                  return (
                    <button
                      key={module.key}
                      type="button"
                      onClick={() => handleToggleDefaultModule(module.key)}
                      className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 transition-all text-left cursor-pointer ${
                        isDefault
                          ? "border-primary bg-primary/5 text-primary shadow-xs"
                          : "border-border bg-card text-muted-foreground hover:border-border/80 hover:bg-secondary/30"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isDefault}
                        onChange={() => {}}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-primary cursor-pointer"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="font-semibold text-foreground text-xs sm:text-sm truncate">
                            {module.label}
                          </span>
                        </div>
                        {hasSubs && (
                          <span className="text-[11px] text-muted-foreground block mt-0.5">
                            Includes all {module.subModules.length} submodules
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 sm:p-6 border-t border-border bg-secondary/20 flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                {defaultModuleKeys.length} modules configured as default
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleApplyDefaults();
                    setIsDefaultModuleModalOpen(false);
                  }}
                  className="px-4 py-2 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-all cursor-pointer"
                >
                  Apply to All Employees Now
                </button>
                <button
                  type="button"
                  onClick={() => setIsDefaultModuleModalOpen(false)}
                  className="cta-gradient text-white text-xs font-semibold px-4 py-2 rounded-xl transition-opacity hover:opacity-90 cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
