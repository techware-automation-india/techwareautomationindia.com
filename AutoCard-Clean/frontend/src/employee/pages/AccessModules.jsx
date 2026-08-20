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
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "../../lib/api.js";
import { useNavigate } from "react-router-dom";

// Module metadata with route paths
const MODULE_INFO = {
  overview: { 
    label: "Dashboard", 
    description: "Your personal dashboard overview",
    route: "/employee"
  },
  employee: { 
    label: "Employee Management", 
    description: "Manage employee records",
    route: "/employee/employee-management"
  },
  customer: { 
    label: "Customer Management", 
    description: "Manage customer accounts",
    route: "/employee/customer-management"
  },
  requests: { 
    label: "Requests", 
    description: "View and manage requests",
    route: "/employee/requests"
  },
  "leave-policy": { 
    label: "Leave Policy", 
    description: "Leave types and policies",
    route: "/employee/leave-policy"
  },
  holidays: { 
    label: "Holidays", 
    description: "Company holiday calendar",
    route: "/employee/holidays"
  },
  attendance: { 
    label: "Attendance", 
    description: "Attendance tracking system",
    route: "/employee/attendance"
  },
  projects: { 
    label: "Projects", 
    description: "Project management",
    route: "/employee/projects"
  },
  "shift-location": { 
    label: "Shift & Location", 
    description: "Shift and location management",
    route: "/employee/shift-location"
  },
  roster: { 
    label: "Roster", 
    description: "Employee scheduling",
    route: "/employee/roster"
  },
};

const PERMISSION_LABELS = {
  canView: { label: "View", icon: Eye, color: "text-blue-600", bg: "bg-blue-100" },
  canCreate: { label: "Create", icon: Plus, color: "text-green-600", bg: "bg-green-100" },
  canEdit: { label: "Edit", icon: Edit3, color: "text-amber-600", bg: "bg-amber-100" },
  canDelete: { label: "Delete", icon: Trash2, color: "text-red-600", bg: "bg-red-100" },
};

const AccessModules = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState({});
  const [modules, setModules] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

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

  const handleModuleClick = (moduleKey) => {
    const info = MODULE_INFO[moduleKey];
    if (info && info.route) {
      navigate(info.route);
    } else {
      toast.error("Module page not available");
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
    <div className="space-y-6 max-w-5xl">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Access Modules</h1>
          <p className="text-sm text-muted-foreground">
            Click on any assigned module below to start working on it.
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
              <div className="text-xs text-muted-foreground">Restricted Modules</div>
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
              <div className="text-xs text-muted-foreground">Granted Permissions</div>
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
            You don't have access to any additional modules yet. Please contact your administrator to request access.
          </p>
        </div>
      )}

      {/* Accessible Modules - Clickable Cards */}
      {grantedModules > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Unlock className="h-5 w-5 text-primary" />
              Your Accessible Modules ({filteredModules.length})
            </h2>
            
            {/* Search Box */}
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search modules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 pl-10 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <Eye className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {filteredModules.length === 0 ? (
            <div className="rounded-2xl bg-background border border-border card-shadow p-8 text-center">
              <p className="text-muted-foreground">No modules found matching "{searchQuery}"</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredModules.map((mod) => {
              const perms = permissions[mod.key] || {};
              const info = MODULE_INFO[mod.key] || { label: mod.label, description: "", route: null };
              const grantedPerms = Object.entries(perms).filter(([_, v]) => v);
              const hasRoute = !!info.route;

              return (
                <button
                  key={mod.key}
                  onClick={() => hasRoute && handleModuleClick(mod.key)}
                  disabled={!hasRoute}
                  className={`rounded-2xl bg-background border-2 border-border card-shadow p-5 text-left transition-all ${
                    hasRoute 
                      ? "hover:border-primary hover:shadow-lg hover:scale-[1.02] cursor-pointer" 
                      : "opacity-60 cursor-not-allowed"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg">{info.label}</h3>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          <CheckCircle2 className="h-3 w-3" /> Active
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{info.description}</p>
                    </div>
                    {hasRoute && (
                      <ChevronRight className="h-5 w-5 text-primary shrink-0" />
                    )}
                  </div>

                  {/* Permission Badges */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {Object.entries(PERMISSION_LABELS).map(([key, meta]) => {
                      const hasPermission = perms[key];
                      const Icon = meta.icon;

                      return (
                        <div
                          key={key}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium ${
                            hasPermission
                              ? `${meta.bg} ${meta.color} border-transparent`
                              : "bg-secondary/30 text-muted-foreground border-border opacity-40"
                          }`}
                        >
                          {hasPermission ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <XCircle className="h-3 w-3" />
                          )}
                          <Icon className="h-3 w-3" />
                          <span>{meta.label}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Progress Bar */}
                  <div className="flex items-center justify-between text-xs pt-3 border-t border-border">
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-foreground">{grantedPerms.length}</span> of 4 permissions
                    </span>
                    <div className="flex items-center gap-1">
                      <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${(grantedPerms.length / 4) * 100}%` }}
                        />
                      </div>
                      <span className="font-medium text-primary ml-1">{Math.round((grantedPerms.length / 4) * 100)}%</span>
                    </div>
                  </div>

                  {/* Click to open indicator */}
                  {hasRoute && (
                    <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-xs text-primary font-medium">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Click to open module
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          )}
        </div>
      )}

      {/* Restricted Modules */}
      {totalModules - grantedModules > 0 && (
        <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">
          <div className="p-5 border-b border-border bg-secondary/10">
            <h2 className="font-semibold flex items-center gap-2">
              <Lock className="h-4.5 w-4.5 text-red-600" />
              Restricted Modules ({totalModules - grantedModules})
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              You don't have access to these modules. Contact your administrator to request access.
            </p>
          </div>

          <div className="divide-y divide-border">
            {modules
              .filter((mod) => {
                const perms = permissions[mod.key];
                return !perms || !Object.values(perms).some((v) => v);
              })
              .map((mod) => {
                const info = MODULE_INFO[mod.key] || { label: mod.label, description: "" };

                return (
                  <div key={mod.key} className="p-5 opacity-60">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-base">{info.label}</h3>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
                            <Lock className="h-3 w-3" /> No Access
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{info.description}</p>
                        <p className="text-xs font-mono text-muted-foreground/60 mt-0.5">{mod.key}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
        <div className="flex gap-3">
          <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">How to Use Access Modules</p>
            <p className="mb-2">
              Click on any accessible module card above to open and work on it. Your permissions control what actions you can perform:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>View:</strong> You can see the data</li>
              <li><strong>Create:</strong> You can add new records</li>
              <li><strong>Edit:</strong> You can modify existing data</li>
              <li><strong>Delete:</strong> You can remove records</li>
            </ul>
            <p className="mt-2">
              If you need access to additional modules or permissions, please contact your administrator.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccessModules;
