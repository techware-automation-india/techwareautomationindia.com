import { BookOpen } from "lucide-react";
import AdminModulePage from "../components/AdminModulePage.jsx";

const LeavePolicy = () => {
  return (
    <AdminModulePage
      moduleKey="leave-policy"
      moduleLabel="Leave Policy"
      moduleIcon={BookOpen}
      moduleDescription="View and manage leave types and policies"
    >
      {(permissions) => (
        <div className="rounded-2xl bg-background border border-border card-shadow p-8 text-center">
          <p className="text-muted-foreground">
            Leave policy management interface will be displayed here.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            You have {permissions.canView && 'View'}{permissions.canCreate && ', Create'}{permissions.canEdit && ', Edit'}{permissions.canDelete && ', Delete'} permissions.
          </p>
        </div>
      )}
    </AdminModulePage>
  );
};

export default LeavePolicy;
