import { useEffect, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "../../lib/api.js";

/**
 * Generic wrapper for admin modules accessible to employees
 * Checks permissions and displays content based on access level
 */
const AdminModulePage = ({ 
  moduleKey, 
  moduleLabel, 
  moduleIcon: Icon, 
  moduleDescription,
  children 
}) => {
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState(null);

  useEffect(() => {
    loadPermissions();
  }, [moduleKey]);

  const loadPermissions = async () => {
    try {
      const data = await apiGet("/roles-access/me/permissions");
      const modulePerm = data.permissions?.[moduleKey];
      
      if (!modulePerm || !modulePerm.canView) {
        toast.error(`You don't have permission to view ${moduleLabel}.`);
      }

      setPermissions(modulePerm);
    } catch (err) {
      toast.error(err.message || "Failed to load permissions.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!permissions || !permissions.canView) {
    return (
      <div className="rounded-2xl bg-background border border-border card-shadow flex flex-col items-center justify-center py-20 text-center px-8">
        <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mb-4">
          <AlertCircle className="h-8 w-8 text-red-600" />
        </div>
        <h3 className="font-display text-lg font-semibold mb-2">Access Denied</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          You don't have permission to view the {moduleLabel} module. Contact your administrator for access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">{moduleLabel}</h1>
          <p className="text-sm text-muted-foreground">{moduleDescription}</p>
        </div>
      </div>

      {/* Permission Badges */}
      <div className="flex gap-2 flex-wrap">
        {permissions.canView && (
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            ✓ View
          </span>
        )}
        {permissions.canCreate && (
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            ✓ Create
          </span>
        )}
        {permissions.canEdit && (
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
            ✓ Edit
          </span>
        )}
        {permissions.canDelete && (
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            ✓ Delete
          </span>
        )}
      </div>

      {/* Content - Pass permissions to children */}
      {typeof children === 'function' ? children(permissions) : children}

      {/* Info Box */}
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> Your permissions for this module are controlled by your administrator.
          You can perform actions based on the permissions granted above.
        </p>
      </div>
    </div>
  );
};

export default AdminModulePage;
