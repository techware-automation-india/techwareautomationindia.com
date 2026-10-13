import { CalendarRange } from "lucide-react";
import AdminRoster from "../../admin/pages/Roster.jsx";
import AdminModulePage from "../components/AdminModulePage.jsx";

const Roster = () => {
  return (
    <AdminModulePage
      moduleKey="roster"
      moduleLabel="Roster"
      moduleIcon={CalendarRange}
      moduleDescription="View and manage employee scheduling"
    >
      {(permissions) => <AdminRoster employeePermissions={permissions} />}
    </AdminModulePage>
  );
};

export default Roster;
