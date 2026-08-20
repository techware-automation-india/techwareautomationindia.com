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
} from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "../../lib/api.js";

// Module metadata
const MODULE_INFO = {
  overview: { label: "Dashboard", description: "Your personal dashboard overview" },
  employee: { label: "Employee Management", description: "Manage employee records" },
  customer: { label: "Customer Management", description: "Manage customer accounts" },
  requests: { label: "Requests", description: "View and manage requests" },
  "leave-policy": { label: "Leave Policy", description: "Leave types and policies" },
  holidays: { label: "Holidays", description: "Company holiday calendar" },
  attendance: { label: "Attendance", description: "Attendance tracking system" },
  projects: { label: "Projects", description: "Project management" },
  "shift-location": { label: "Shift & Location", description: "Shift and location management" },
  roster: { label: "Roster", description: "Employee scheduling" },
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

  // Calculate stats
  const totalModules = modules.length;
  const grantedModules = accessibleModules.length;
  const totalPermissions = grantedModules * 4;
  const grantedPermissions = accessibleModules.reduce((sum, mod) => {
    const perms = permissions[mod.key] || {};
    return sum + Object.values(perms).filter((v) => v).length;
  }, 0);

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
            View the modules and permissions assigned to you by your administrator.
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

      {/* Accessible Modules */}
      {grantedModules > 0 && (
        <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">
          <div className="p-5 border-b border-border bg-secondary/10">
            <h2 className="font-semibold flex items-center gap-2">
              <Unlock className="h-4.5 w-4.5 text-primary" />
              Your Accessible Modules ({grantedModules})
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              You can perform the following actions on these modules based on your assigned permissions.
            </p>
          </div>

          <div className="divide-y divide-border">
            {accessibleModules.map((mod) => {
              const perms = permissions[mod.key] || {};
              const info = MODULE_INFO[mod.key] || { label: mod.label, description: "" };
              const grantedPerms = Object.entries(perms).filter(([_, v]) => v);

              return (
                <div key={mod.key} className="p-5 hover:bg-secondary/20 transition-colors">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-base">{info.label}</h3>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          <CheckCircle2 className="h-3 w-3" /> Active
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{info.description}</p>
                      <p className="text-xs font-mono text-primary/60 mt-0.5">{mod.key}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {Object.entries(PERMISSION_LABELS).map(([key, meta]) => {
                      const hasPermission = perms[key];
                      const Icon = meta.icon;

                      return (
                        <div
                          key={key}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                            hasPermission
                              ? `${meta.bg} ${meta.color} border-transparent`
                              : "bg-secondary/30 text-muted-foreground border-border opacity-40"
                          }`}
                        >
                          {hasPermission ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5" />
                          )}
                          <Icon className="h-3.5 w-3.5" />
                          <span>{meta.label}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        <span className="font-semibold text-foreground">{grantedPerms.length}</span> of 4 permissions granted
                      </span>
                      <div className="flex items-center gap-1">
                        <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${(grantedPerms.length / 4) * 100}%` }}
                          />
                        </div>
                        <span className="font-medium text-primary ml-1">{Math.round((grantedPerms.length / 4) * 100)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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
            <p className="font-semibold mb-1">About Module Access</p>
            <p>
              Your administrator controls which modules you can access. Each module may have different permission levels:
              <strong> View</strong> (read data), <strong>Create</strong> (add new records),{" "}
              <strong>Edit</strong> (modify existing data), and <strong>Delete</strong> (remove records).
            </p>
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
