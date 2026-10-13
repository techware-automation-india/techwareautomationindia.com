import { MapPin } from "lucide-react";
import AdminShiftLocation from "../../admin/pages/ShiftLocation.jsx";
import AdminModulePage from "../components/AdminModulePage.jsx";

const ShiftLocation = () => {
  return (
    <AdminModulePage
      moduleKey="shift-location"
      moduleLabel="Shift & Location"
      moduleIcon={MapPin}
      moduleDescription="Manage shifts and locations"
    >
      {(permissions) => <AdminShiftLocation employeePermissions={permissions} />}
    </AdminModulePage>
  );
};

export default ShiftLocation;
