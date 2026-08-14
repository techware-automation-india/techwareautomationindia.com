import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import ScrollToTop from "./components/ScrollToTop.jsx";
import { applyTheme, getPreferredTheme, onThemeChange } from "./lib/theme.js";
import Index from "./pages/Index.jsx";
import Login from "./pages/Login.jsx";
import Machines from "./pages/Machines.jsx";
import NotFound from "./pages/NotFound.jsx";

import AdminLayout from "./admin/AdminLayout.jsx";
import Overview from "./admin/pages/Overview.jsx";
import Employee from "./admin/pages/Employee.jsx";
import EmployeeList from "./admin/pages/EmployeeList.jsx";
import Customer from "./admin/pages/Customer.jsx";
import CustomerList from "./admin/pages/CustomerList.jsx";
import Requests from "./admin/pages/Requests.jsx";
import LeaveRequests from "./admin/pages/LeaveRequests.jsx";
import LeavePolicy from "./admin/pages/LeavePolicy.jsx";
import Holidays from "./admin/pages/Holidays.jsx";
import Attendance from "./admin/pages/Attendance.jsx";
import Projects from "./admin/pages/Projects.jsx";
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
import RequireOnboarding from "./employee/components/RequireOnboarding.jsx";

import CustomerLayout from "./customer/CustomerLayout.jsx";
import CustomerOverview from "./customer/pages/Overview.jsx";
import CustomerProjects from "./customer/pages/Projects.jsx";

const dashboardPrefixes = ["/admin", "/employee", "/customer"];

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
        <Route path="/login/:role" element={<Login />} />

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Overview />} />
          <Route path="employee" element={<Employee />} />
          <Route path="employee-list" element={<EmployeeList />} />
          <Route path="customer" element={<Customer />} />
          <Route path="customer-list" element={<CustomerList />} />
          <Route path="requests" element={<Requests />} />
          <Route path="leave-requests" element={<LeaveRequests />} />
          <Route path="leave-policy" element={<LeavePolicy />} />
          <Route path="holidays" element={<Holidays />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="projects" element={<Projects />} />
          <Route path="roles-access" element={<RolesAccess />} />
          <Route path="shift-location" element={<ShiftLocation />} />
          <Route path="roster" element={<Roster />} />
        </Route>

        <Route path="/employee" element={<EmployeeLayout />}>
          <Route index element={<EmployeeOverview />} />
          <Route path="onboarding" element={<EmployeeOnboarding />} />
          <Route path="mark-attendance" element={<EmployeeMarkAttendance />} />
          <Route path="attendance" element={<RequireOnboarding><EmployeeAttendance /></RequireOnboarding>} />
          <Route path="leave" element={<RequireOnboarding><EmployeeLeave /></RequireOnboarding>} />
          <Route path="holidays" element={<RequireOnboarding><EmployeeHolidays /></RequireOnboarding>} />
        </Route>

        <Route path="/customer" element={<CustomerLayout />}>
          <Route index element={<CustomerOverview />} />
          <Route path="projects" element={<CustomerProjects />} />
        </Route>

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
