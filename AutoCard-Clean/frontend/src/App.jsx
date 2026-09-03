import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import ScrollToTop from "./components/ScrollToTop.jsx";
import { applyTheme, getPreferredTheme, onThemeChange } from "./lib/theme.js";
import Index from "./pages/Index.jsx";

import Login from "./pages/Login.jsx";
import UniversalLogin from "./pages/UniversalLogin.jsx";
import Machines from "./pages/Machines.jsx";
import NotFound from "./pages/NotFound.jsx";

import AdminLayout from "./admin/AdminLayout.jsx";
import Overview from "./admin/pages/Overview.jsx";
import Employee from "./admin/pages/Employee.jsx";
import EmployeeList from "./admin/pages/EmployeeList.jsx";
// CUSTOMER ADMIN PAGES COMMENTED OUT
// import Customer from "./admin/pages/Customer.jsx";
// import CustomerList from "./admin/pages/CustomerList.jsx";
import Requests from "./admin/pages/Requests.jsx";
import LeaveRequests from "./admin/pages/LeaveRequests.jsx";
import LeavePolicy from "./admin/pages/LeavePolicy.jsx";
import Holidays from "./admin/pages/Holidays.jsx";
import AdminMarkAttendance from "./admin/pages/MarkAttendance.jsx";
import Attendance from "./admin/pages/Attendance.jsx";
import Projects from "./admin/pages/Projects.jsx";
import ProjectDetails from "./admin/pages/ProjectDetails.jsx";
import Services from "./admin/pages/Services.jsx";
import RolesAccess from "./admin/pages/RolesAccess.jsx";
import ShiftLocation from "./admin/pages/ShiftLocation.jsx";
import Roster from "./admin/pages/Roster.jsx";

import EmployeeLayout from "./employee/EmployeeLayout.jsx";
import EmployeeOverview from "./employee/pages/Overview.jsx";
import EmployeeOnboarding from "./employee/pages/Onboarding.jsx";
import EmployeeMarkAttendance from "./employee/pages/MarkAttendance.jsx";
import EmployeeAttendance from "./employee/pages/Attendance.jsx";
import EmployeeLeave from "./employee/pages/Leave.jsx";
import EmployeeHolidays from "./employee/pages/Holidays.jsx";
import EmployeeAccessModules from "./employee/pages/AccessModules.jsx";
import EmployeeManagement from "./employee/pages/EmployeeManagement.jsx";
// CUSTOMER MANAGEMENT COMMENTED OUT
// import CustomerManagement from "./employee/pages/CustomerManagement.jsx";
import EmployeeRequests from "./employee/pages/Requests.jsx";
import EmployeeLeavePolicy from "./employee/pages/LeavePolicy.jsx";
import EmployeeProjects from "./employee/pages/Projects.jsx";
import EmployeeServices from "./employee/pages/Services.jsx";
import EmployeeShiftLocation from "./employee/pages/ShiftLocation.jsx";
import EmployeeRoster from "./employee/pages/Roster.jsx";
import RequireOnboarding from "./employee/components/RequireOnboarding.jsx";

// CUSTOMER PANEL COMMENTED OUT
// import CustomerLayout from "./customer/CustomerLayout.jsx";
// import CustomerOverview from "./customer/pages/Overview.jsx";
// import CustomerProfile from "./customer/pages/Profile.jsx";
// import CustomerProjects from "./customer/pages/Projects.jsx";
// import CustomerRequests from "./customer/pages/Requests.jsx";
// import CustomerDocuments from "./customer/pages/Documents.jsx";
// import CustomerSupport from "./customer/pages/Support.jsx";
// import CustomerNotifications from "./customer/pages/Notifications.jsx";
// import CustomerSettings from "./customer/pages/Settings.jsx";

const dashboardPrefixes = ["/admin", "/employee" /*, "/customer" */];

const AppRoutes = () => {
  const location = useLocation();
  const [theme, setTheme] = useState(() => getPreferredTheme());
  const isDashboardRoute = dashboardPrefixes.some((path) => location.pathname.startsWith(path));

  useEffect(() => {
    if (isDashboardRoute) {
      applyTheme(theme);
    } else {
      applyTheme("light", { persist: false });
    }

    return onThemeChange(setTheme);
  }, [isDashboardRoute, theme]);

  useEffect(() => {
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => {
      const stored = localStorage.getItem("techware-theme");
      if (!stored && isDashboardRoute) {
        const nextTheme = getPreferredTheme();
        setTheme(nextTheme);
        applyTheme(nextTheme);
      }
    };

    systemTheme.addEventListener("change", handleSystemThemeChange);
    return () => systemTheme.removeEventListener("change", handleSystemThemeChange);
  }, [isDashboardRoute]);

  return (
    <>
      <ScrollToTop />
      <Toaster position="top-right" theme={isDashboardRoute ? theme : "light"} richColors />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/machines" element={<Machines />} />
        <Route path="/login" element={<UniversalLogin />} />
        <Route path="/login/:role" element={<Login />} />
        

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Overview />} />
          <Route path="employee" element={<Employee />} />
          <Route path="employee-list" element={<EmployeeList />} />
          {/* CUSTOMER ADMIN ROUTES COMMENTED OUT */}
          {/* <Route path="customer" element={<Customer />} /> */}
          {/* <Route path="customer-list" element={<CustomerList />} /> */}
          <Route path="requests" element={<Requests />} />
          {/* <Route path="leave-requests" element={<LeaveRequests />} /> */}
          {/* <Route path="leave-policy" element={<LeavePolicy />} /> */}
          {/* <Route path="holidays" element={<Holidays />} /> */}
          <Route path="mark-attendance" element={<AdminMarkAttendance />} />
          <Route path="attendance" element={<Attendance />} />
          {/* <Route path="projects" element={<Projects />} /> */}
          {/* <Route path="project/:id" element={<ProjectDetails />} /> */}
          
          {/* <Route path="roles-access" element={<RolesAccess />} /> */}
          <Route path="shift-location" element={<ShiftLocation />} />
          <Route path="roster" element={<Roster />} />
        </Route>

        <Route path="/employee" element={<EmployeeLayout />}>
          <Route index element={<EmployeeOverview />} />
          {/* <Route path="onboarding" element={<EmployeeOnboarding />} /> */}
          <Route path="mark-attendance" element={<EmployeeMarkAttendance />} />
          <Route path="attendance" element={<EmployeeAttendance />} />
          {/* <Route path="leave" element={<RequireOnboarding><EmployeeLeave /></RequireOnboarding>} /> */}
          {/* <Route path="holidays" element={<RequireOnboarding><EmployeeHolidays /></RequireOnboarding>} /> */}
          {/* <Route path="access-modules" element={<RequireOnboarding><EmployeeAccessModules /></RequireOnboarding>} /> */}
          {/* <Route path="employee-management" element={<RequireOnboarding><EmployeeManagement /></RequireOnboarding>} /> */}
          {/* CUSTOMER MANAGEMENT ROUTE COMMENTED OUT */}
          {/* <Route path="customer-management" element={<RequireOnboarding><CustomerManagement /></RequireOnboarding>} /> */}
          {/* <Route path="requests" element={<RequireOnboarding><EmployeeRequests /></RequireOnboarding>} /> */}
          {/* <Route path="leave-policy" element={<RequireOnboarding><EmployeeLeavePolicy /></RequireOnboarding>} /> */}
          {/* <Route path="projects" element={<RequireOnboarding><EmployeeProjects /></RequireOnboarding>} /> */}
         
          {/* <Route path="shift-location" element={<RequireOnboarding><EmployeeShiftLocation /></RequireOnboarding>} /> */}
          {/* <Route path="roster" element={<RequireOnboarding><EmployeeRoster /></RequireOnboarding>} /> */}
        </Route>

        {/* CUSTOMER ROUTES COMMENTED OUT */}
        {/* <Route path="/customer" element={<CustomerLayout />}>
          <Route index element={<CustomerOverview />} />
          <Route path="profile" element={<CustomerProfile />} />
          <Route path="projects" element={<CustomerProjects />} />
          <Route path="requests" element={<CustomerRequests />} />
          
          <Route path="documents" element={<CustomerDocuments />} />
         
          <Route path="support" element={<CustomerSupport />} />
          <Route path="notifications" element={<CustomerNotifications />} />
          <Route path="settings" element={<CustomerSettings />} />
        </Route> */}

        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
};

export default App;
