import { Wrench } from "lucide-react";
import AdminServices from "../../admin/pages/Services.jsx";
import AdminModulePage from "../components/AdminModulePage.jsx";

const Services = () => {
  return (
    <AdminModulePage
      moduleKey="services"
      moduleLabel="Services"
      moduleIcon={Wrench}
      moduleDescription="Create and manage customer-facing services"
    >
      {(permissions) => <AdminServices employeePermissions={permissions} />}
    </AdminModulePage>
  );
};

export default Services;
