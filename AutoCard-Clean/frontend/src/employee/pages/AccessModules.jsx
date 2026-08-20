import { useEffect, useState } from "react";
import {
  ShieldCheck,
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  Plus,
  Edit3,
  Trash2,
  Lock,
  Unlock,
  ChevronDown,
  ChevronUp,
  X,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "../../lib/api.js";

// Import admin module components to embed
import Employee from "../../admin/pages/Employee.jsx";
import Customer from "../../admin/pages/Customer.jsx";
import Requests from "../../admin/pages/Requests.jsx";
import LeavePolicy from "../../admin/pages/LeavePolicy.jsx";
import Holidays from "../../admin/pages/Holidays.jsx";
import Attendance from "../../admin/pages/Attendance.jsx";
import Projects from "../../admin/pages/Projects.jsx";
import ShiftLocation from "../../admin/pages/ShiftLocation.jsx";
import Roster from "../../admin/pages/Roster.jsx";

// Module metadata with component references
const MODULE_INFO = {
  overview: { 
    label: "Dashboard", 
    description: "Your personal dashboard overview",
    component: null // Dashboard is always accessible separately
  },
  employee: { 
    label: "Employee Management", 
    description: "Manage employee records - same interface as admin",
    component: Employee
  },
  customer: { 
    label: "Customer Management", 
    description: "Manage customer accounts - same interface as admin",
    component: Customer
  },
  requests: { 
    label: "Requests", 
    description: "View and manage employee requests",
    component: Requests
  },
  "leave-policy": { 
    label: "Leave Policy", 
    description: "Manage leave types and policies",
    component: LeavePolicy
  },
  holidays: { 
    label: "Holidays", 
    description: "Manage company holiday calendar",
    component: Holidays
  },
  attendance: { 
    label: "Attendance", 
    description: "View and manage attendance records",
    component: Attendance
  },
  projects: { 
    label: "Projects", 
    description: "Manage projects and assignments",
    component: Projects
  },
  "shift-location": { 
    label: "Shift & Location", 
    description: "Manage shifts and locations",
    component: ShiftLocation
  },
  roster: { 
    label: "Roster", 
    description: "Manage employee scheduling",
    component: Roster
  },
};

const PERMISSION_LABELS = {
  canView: { label: "View", icon: Eye, color: "text-blue-600", bg: "bg-blue-100" },
  canCreate: { label: "Create", icon: Plus, color: "text-green-600", bg: "bg-green-100" },
  canEdit: { label: "Edit", icon: Edit3, color: "text-amber-600", bg: "bg-amber-100" },
  canDelete: { label: "Delete", icon: Trash2, color: "text-red-600", bg: "bg-red-100" },
};

const AccessModules = () => {
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState({});
  const [modules, setModules] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedModule, setExpandedModule] = useState(null);

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const data = await apiGet("/roles-access/me/permissions");
      setModules(data.modules || []);
      setPermissions(data.permissions || {});
    } catch (err) {
      toast.error(err.message || "Failed to load permissions.");
    } finally {
      setLoading(false);
    }
  };

  // Get modules that have at least one permission granted
  const accessibleModules = modules.filter((mod) => {
    const perms = permissions[mod.key];
    return perms && Object.values(perms).some((v) => v === true);
  });

  // Filter modules based on search query
  const filteredModules = accessibleModules.filter((mod) => {
    const info = MODULE_INFO[mod.key] || { label: mod.label, description: "" };
    const searchLower = searchQuery.toLowerCase();
    return (
      info.label.toLowerCase().includes(searchLower) ||
      info.description.toLowerCase().includes(searchLower) ||
      mod.key.toLowerCase().includes(searchLower)
    );
  });

  // Calculate stats
  const totalModules = modules.length;
  const grantedModules = accessibleModules.length;
  const totalPermissions = grantedModules * 4;
  const grantedPermissions = accessibleModules.reduce((sum, mod) => {
    const perms = permissions[mod.key] || {};
    return sum + Object.values(perms).filter((v) => v).length;
  }, 0);

  const handleModuleToggle = (moduleKey) => {
    if (expandedModule === moduleKey) {
      setExpandedModule(null);
    } else {
      setExpandedModule(moduleKey);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Access Modules</h1>
          <p className="text-sm text-muted-foreground">
            Click any module below to expand and work on it - same interface as admin panel
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-background border border-border card-shadow p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Unlock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="font-display text-xl font-bold text-primary">{grantedModules}</div>
              <div className="text-xs text-muted-foreground">Accessible Modules</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-background border border-border card-shadow p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <Lock className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <div className="font-display text-xl font-bold text-red-600">{totalModules - grantedModules}</div>
              <div className="text-xs text-muted-foreground">Restricted</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-background border border-border card-shadow p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <div className="font-display text-xl font-bold text-green-600">{grantedPermissions}</div>
              <div className="text-xs text-muted-foreground">Permissions</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-background border border-border card-shadow p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <div className="font-display text-xl font-bold text-amber-600">
                {totalPermissions > 0 ? Math.round((grantedPermissions / totalPermissions) * 100) : 0}%
              </div>
              <div className="text-xs text-muted-foreground">Access Level</div>
            </div>
          </div>
        </div>
      </div>

      {/* No Access Message */}
      {grantedModules === 0 && (
        <div className="rounded-2xl bg-background border border-border card-shadow flex flex-col items-center justify-center py-20 text-center px-8">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mb-4">
            <Lock className="h-8 w-8 text-amber-600" />
          </div>
          <h3 className="font-display text-lg font-semibold mb-2">No Module Access Assigned</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            You don't have access to any additional modules yet. Please contact your administrator.
          </p>
        </div>
      )}

      {/* Accessible Modules */}
      {grantedModules > 0 && (
        <div className="space-y-4">
          {/* Search */}
          <div className="flex items-center gap-4">
            <h2 className="font-semibold text-lg">
              Your Modules ({filteredModules.length})
            </h2>
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search modules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Module Cards */}
          <div className="space-y-3">
            {filteredModules.length === 0 ? (
              <div className="rounded-xl bg-background border border-border p-8 text-center text-muted-foreground">
                No modules found matching "{searchQuery}"
              </div>
            ) : (
              filteredModules.map((mod) => {
                const perms = permissions[mod.key] || {};
                const info = MODULE_INFO[mod.key] || { label: mod.label, description: "", component: null };
                const grantedPerms = Object.entries(perms).filter(([_, v]) => v);
                const hasComponent = !!info.component;
                const isExpanded = expandedModule === mod.key;
                const ModuleComponent = info.component;

                return (
                  <div
                    key={mod.key}
                    className={`rounded-2xl bg-background border-2 transition-all overflow-hidden ${
                      isExpanded ? "border-primary shadow-lg" : "border-border"
                    }`}
                  >
                    {/* Module Header */}
                    <button
                      onClick={() => hasComponent && handleModuleToggle(mod.key)}
                      disabled={!hasComponent}
                      className={`w-full p-5 text-left transition-colors ${
                        hasComponent
                          ? "hover:bg-secondary/30 cursor-pointer"
                          : "opacity-60 cursor-not-allowed"
                      } ${isExpanded ? "bg-primary/5" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="font-semibold text-lg">{info.label}</h3>
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              ✓ Active
                            </span>
                            {isExpanded && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                📂 Expanded
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{info.description}</p>
                        </div>
                        {hasComponent && (
                          <div className="shrink-0">
                            {isExpanded ? (
                              <ChevronUp className="h-6 w-6 text-primary" />
                            ) : (
                              <ChevronDown className="h-6 w-6 text-primary" />
                            )}
                          </div>
                        )}
                      </div>

                      {/* Permissions */}
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(PERMISSION_LABELS).map(([key, meta]) => {
                          const hasPermission = perms[key];
                          const Icon = meta.icon;
                          return (
                            <div
                              key={key}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${
                                hasPermission
                                  ? `${meta.bg} ${meta.color}`
                                  : "bg-secondary/50 text-muted-foreground opacity-50"
                              }`}
                            >
                              {hasPermission ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                              <Icon className="h-3 w-3" />
                              {meta.label}
                            </div>
                          );
                        })}
                      </div>

                      {/* Hint */}
                      {hasComponent && !isExpanded && (
                        <div className="mt-3 pt-3 border-t border-border text-xs text-primary font-medium">
                          💡 Click to expand and work on this module
                        </div>
                      )}
                    </button>

                    {/* Expanded Module Content */}
                    {isExpanded && hasComponent && ModuleComponent && (
                      <div className="border-t-2 border-primary">
                        {/* Permission Banner */}
                        <div className="bg-gradient-to-r from-blue-50 to-primary/5 border-b border-blue-200 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-blue-900 mb-2">
                                🔐 Your Permissions for {info.label}
                              </p>
                              <div className="flex gap-2 flex-wrap">
                                {perms.canView && (
                                  <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                                    ✓ View Data
                                  </span>
                                )}
                                {perms.canCreate && (
                                  <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                                    ✓ Create New
                                  </span>
                                )}
                                {perms.canEdit && (
                                  <span className="px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-700">
                                    ✓ Edit Existing
                                  </span>
                                )}
                                {perms.canDelete && (
                                  <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
                                    ✓ Delete Records
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedModule(null);
                              }}
                              className="shrink-0 p-2 rounded-lg hover:bg-blue-200 transition-colors"
                              title="Close module"
                            >
                              <X className="h-5 w-5 text-blue-700" />
                            </button>
                          </div>
                        </div>

                        {/* Embedded Admin Module Component */}
                        <div className="p-6 bg-secondary/5 min-h-[400px]">
                          <ModuleComponent 
                            employeePermissions={perms} 
                            isEmployeeView={true}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Restricted Modules */}
      {totalModules - grantedModules > 0 && (
        <details className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">
          <summary className="p-5 cursor-pointer hover:bg-secondary/20 transition-colors flex items-center gap-2">
            <Lock className="h-5 w-5 text-red-600" />
            <span className="font-semibold">Restricted Modules ({totalModules - grantedModules})</span>
          </summary>
          <div className="divide-y divide-border border-t">
            {modules
              .filter((mod) => {
                const perms = permissions[mod.key];
                return !perms || !Object.values(perms).some((v) => v);
              })
              .map((mod) => {
                const info = MODULE_INFO[mod.key] || { label: mod.label, description: "" };
                return (
                  <div key={mod.key} className="p-4 opacity-60">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-red-600" />
                      <div>
                        <div className="font-semibold text-sm">{info.label}</div>
                        <div className="text-xs text-muted-foreground">{info.description}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </details>
      )}

      {/* Help */}
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
        <div className="flex gap-3">
          <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">💡 How It Works</p>
            <ul className="space-y-1 text-xs">
              <li>• Click any accessible module to expand it</li>
              <li>• Work directly in the expanded interface - same as admin panel</li>
              <li>• Your actions are limited by your assigned permissions</li>
              <li>• Click the X button or module header to collapse</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccessModules;
