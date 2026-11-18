import { useEffect, useState } from "react";
import { Loader2, AlertCircle, UserCog } from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "../../lib/api.js";
import Employee from "../../admin/pages/Employee.jsx"; // Reuse admin component

/**
 * Employee Management module for employees with assigned permissions
 * This wraps the admin Employee component with permission checks
 */
const EmployeeManagementFull = () => {
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState(null);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      const data = await apiGet("/roles-access/me/permissions");
      const empPerm = data.permissions?.employee;
      
      if (!empPerm || !empPerm.canView) {
        toast.error("You don't have permission to access Employee Management.");
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

  // Show permission banner at top
  return (
    <div className="space-y-4">
      {/* Render the actual admin Employee component */}
      <Employee employeePermissions={permissions} isEmployeeView={true} />
    </div>
  );
};

export default EmployeeManagementFull;
