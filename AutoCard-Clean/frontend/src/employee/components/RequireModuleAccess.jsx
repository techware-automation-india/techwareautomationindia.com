import { useEffect, useState } from "react";
import { useOutletContext, useNavigate, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "../../lib/api.js";

/**
 * Helper function to check if a specific module key is allowed based on user permissions
 */
export function isModuleAllowed(moduleKey, permissions = {}) {
  // Support array of module keys
  if (Array.isArray(moduleKey)) {
    return moduleKey.some((k) => isModuleAllowed(k, permissions));
  }

  // Always allowed base employee modules
  const defaultBaseKeys = [
    "overview",
    "mark-attendance",
    "attendance",
    "requests",
    "requests-apply-leave",
    "requests-forgot-punch",
    "requests-tools-inventory",
    "requests-track",
    "leave",
    "my-tools",
    "my-projects"
  ];

  if (defaultBaseKeys.includes(moduleKey)) {
    return true;
  }

  // Direct check
  const perm = permissions[moduleKey];
  if (perm && (perm.canView === true || perm === true)) {
    return true;
  }
  if (perm && typeof perm === "object" && Object.values(perm).some(Boolean)) {
    return true;
  }

  // Fallbacks for sub-permissions or aliases
  if (moduleKey === "employee") {
    return !!(
      permissions["employee"]?.canView ||
      permissions["employee"] === true ||
      permissions["add-account"]?.canView ||
      permissions["add-account"] === true
    );
  }

  if (moduleKey === "approvals") {
    return !!(
      permissions["approvals"] ||
      permissions["approvals-leave"] ||
      permissions["approvals-attendance"] ||
      permissions["approvals-forgot-punch"] ||
      permissions["approvals-tools-inventory"] ||
      permissions["approvals-tools"]
    );
  }

  if (moduleKey === "leave-policy") {
    return !!(
      permissions["leave-policy"] ||
      permissions["leave-policy-types"] ||
      permissions["leave-policy-holidays"]
    );
  }

  if (moduleKey === "attendance-management") {
    const hasAdminPower = permissions["employee"] || permissions["roles-access"] || permissions["approvals"];
    return !!(permissions["attendance-management"] || (permissions["attendance"] && hasAdminPower));
  }

  if (moduleKey === "projects" || moduleKey === "assigned-projects") {
    return !!(permissions["projects"] || permissions["assigned-projects"]);
  }

  if (moduleKey === "academic-calendar") {
    return !!(permissions["academic-calendar"] || permissions["academic-holidays"]);
  }

  if (moduleKey === "shift-location") {
    return !!(
      permissions["shift-location"]?.canView ||
      permissions["shift-location"] === true ||
      (permissions["shift-location"] && typeof permissions["shift-location"] === "object" && Object.values(permissions["shift-location"]).some(Boolean))
    );
  }

  if (moduleKey === "roster") {
    return !!(
      permissions["roster"]?.canView ||
      permissions["roster"] === true ||
      (permissions["roster"] && typeof permissions["roster"] === "object" && Object.values(permissions["roster"]).some(Boolean))
    );
  }

  if (moduleKey === "roles-access") {
    return !!(
      permissions["roles-access"]?.canView ||
      permissions["roles-access"] === true ||
      (permissions["roles-access"] && typeof permissions["roles-access"] === "object" && Object.values(permissions["roles-access"]).some(Boolean))
    );
  }

  // Inventory parent key & sub-module access checks
  if (moduleKey === "inventory") {
    return !!(
      permissions["inventory"] ||
      permissions["inventory-in"] ||
      permissions["inventory-out"] ||
      permissions["view-inventory"] ||
      permissions["inventory-alert"] ||
      permissions["general-consumables"] ||
      Object.keys(permissions).some((k) =>
        (k.startsWith("inventory-") || k.startsWith("view-inventory") || k.startsWith("general-consumables")) &&
        (permissions[k]?.canView || permissions[k] === true || (typeof permissions[k] === "object" && Object.values(permissions[k]).some(Boolean)))
      )
    );
  }

  if (moduleKey === "inventory-in") {
    return !!(
      permissions["inventory-in"]?.canView ||
      permissions["inventory-in"] === true ||
      permissions["inventory-in:view"] ||
      permissions["inventory-in:create"] ||
      permissions["inventory-in:edit"]
    );
  }

  if (moduleKey === "inventory-out") {
    return !!(
      permissions["inventory-out"]?.canView ||
      permissions["inventory-out"] === true ||
      permissions["inventory-out:view"] ||
      permissions["inventory-out:create"] ||
      permissions["inventory-out:edit"]
    );
  }

  if (moduleKey === "view-inventory") {
    return !!(
      permissions["view-inventory"]?.canView ||
      permissions["view-inventory"] === true ||
      permissions["view-inventory:view"]
    );
  }

  if (moduleKey === "inventory-alert") {
    return !!(
      permissions["inventory-alert"]?.canView ||
      permissions["inventory-alert"] === true ||
      permissions["inventory-alert:view"] ||
      permissions["inventory-alert:edit"]
    );
  }

  if (moduleKey === "general-consumables") {
    return !!(
      permissions["general-consumables"]?.canView ||
      permissions["general-consumables"] === true ||
      permissions["general-consumables:view"] ||
      permissions["general-consumables:create"] ||
      permissions["general-consumables:edit"]
    );
  }

  return false;
}

const RequireModuleAccess = ({ moduleKey, children }) => {
  const navigate = useNavigate();
  const outletContext = useOutletContext() || {};
  const [permissions, setPermissions] = useState(outletContext.permissions || null);
  const [loading, setLoading] = useState(!outletContext.permissions);

  useEffect(() => {
    if (outletContext.permissions && Object.keys(outletContext.permissions).length > 0) {
      setPermissions(outletContext.permissions);
      setLoading(false);
      return;
    }

    let active = true;
    (async () => {
      try {
        const cached = localStorage.getItem("employee_permissions");
        if (cached) {
          const perms = JSON.parse(cached);
          if (active) {
            setPermissions(perms);
            setLoading(false);
          }
        }
        const data = await apiGet("/roles-access/me/permissions");
        const perms = data?.permissions || {};
        localStorage.setItem("employee_permissions", JSON.stringify(perms));
        if (active) {
          setPermissions(perms);
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setPermissions({});
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [outletContext.permissions, moduleKey]);

  const allowed = isModuleAllowed(moduleKey, permissions || {});

  useEffect(() => {
    if (!loading && !allowed) {
      toast.error(`Access Denied: You do not have permission to access the "${moduleKey}" module.`);
    }
  }, [loading, allowed, moduleKey]);

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2 text-primary" />
        Checking access permissions...
      </div>
    );
  }

  if (!allowed) {
    return <Navigate to="/employee" replace />;
  }

  return children;
};

export default RequireModuleAccess;
