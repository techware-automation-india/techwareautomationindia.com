import { CalendarRange } from "lucide-react";
import AdminModulePage from "../components/AdminModulePage.jsx";

const Roster = () => {
  return (
    <AdminModulePage
      moduleKey="roster"
      moduleLabel="Roster"
      moduleIcon={CalendarRange}
      moduleDescription="View and manage employee scheduling"
    >
      {(permissions) => (
        <div className="rounded-2xl bg-background border border-border card-shadow p-8 text-center">
          <p className="text-muted-foreground">
            Roster management interface will be displayed here.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            You have {permissions.canView && 'View'}{permissions.canCreate && ', Create'}{permissions.canEdit && ', Edit'}{permissions.canDelete && ', Delete'} permissions.
          </p>
        </div>
      )}
    </AdminModulePage>
  );
};

export default Roster;
