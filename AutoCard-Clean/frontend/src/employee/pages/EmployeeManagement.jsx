import { useEffect, useState } from "react";
import { Loader2, AlertCircle, UserCog } from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "../../lib/api.js";
import Employee from "../../admin/pages/Employee.jsx"; // Import admin component

const EmployeeManagement = () => {
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState(null);

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      const data = await apiGet("/roles-access/me/permissions");
      const empPerm = data.permissions?.employee;
      
      if (!empPerm || !empPerm.canView) {
        toast.error("You don't have permission to view Employee Management.");
      }

      setPermissions(empPerm);
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
          You don't have permission to access Employee Management. Contact your administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Permission Info Banner */}
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
        <div className="flex items-center gap-3">
          <UserCog className="h-5 w-5 text-blue-600 shrink-0" />
          <div className="text-sm text-blue-800 flex-1">
            <p className="font-semibold mb-1">Your Permissions for Employee Management</p>
            <div className="flex gap-2 flex-wrap">
              {permissions.canView && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  ✓ View
                </span>
              )}
              {permissions.canCreate && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  ✓ Create
                </span>
              )}
              {permissions.canEdit && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                  ✓ Edit
                </span>
              )}
              {permissions.canDelete && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                  ✓ Delete
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Render the actual admin Employee component with permissions */}
      <Employee employeePermissions={permissions} isEmployeeView={true} />
    </div>
  );
};

export default EmployeeManagement;
