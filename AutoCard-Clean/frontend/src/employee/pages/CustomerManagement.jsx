import { Contact } from "lucide-react";
import AdminModulePage from "../components/AdminModulePage.jsx";

const CustomerManagement = () => {
  return (
    <AdminModulePage
      moduleKey="customer"
      moduleLabel="Customer Management"
      moduleIcon={Contact}
      moduleDescription="Manage customer accounts and information"
    >
      {(permissions) => (
        <div className="rounded-2xl bg-background border border-border card-shadow p-8 text-center">
          <p className="text-muted-foreground">
            Customer management interface will be displayed here.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            You have {permissions.canView && 'View'}{permissions.canCreate && ', Create'}{permissions.canEdit && ', Edit'}{permissions.canDelete && ', Delete'} permissions.
          </p>
        </div>
      )}
    </AdminModulePage>
  );
};

export default CustomerManagement;
