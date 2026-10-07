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

// import AdminProfile from "./admin/AdminProfile.jsx";
import ChangePassword from "./admin/pages/ChangePassword.jsx";
import AdminLayout from "./admin/AdminLayout.jsx";
import Overview from "./admin/pages/Overview.jsx";
import Employee from "./admin/pages/Employee.jsx";
import EmployeeList from "./admin/pages/EmployeeList.jsx";
// CUSTOMER ADMIN PAGES COMMENTED OUT
// import Customer from "./admin/pages/Customer.jsx";
// import CustomerList from "./admin/pages/CustomerList.jsx";
import RequestsHome from "./admin/pages/RequestsHome.jsx";
import AdminTrackRequests from "./admin/pages/AdminTrackRequests.jsx";
import AdminAttendanceCorrection from "./admin/pages/AdminAttendanceCorrection.jsx";
import AdminApplyLeave from "./admin/pages/AdminApplyLeave.jsx";
import Approvals from "./admin/pages/Approvals.jsx";
import LeavePolicy from "./admin/pages/LeavePolicy.jsx";
import Holidays from "./admin/pages/Holidays.jsx";
import LeavePolicyHome from "./admin/pages/LeavePolicyHome.jsx";
import AdminMarkAttendance from "./admin/pages/MarkAttendance.jsx";

import Attendance from "./admin/pages/Attendance.jsx";
import AttendanceRequests from "./admin/pages/AttendanceRequests.jsx";
import Projects from "./admin/pages/Projects.jsx";
import ProjectDetails from "./admin/pages/ProjectDetails.jsx";
import Services from "./admin/pages/Services.jsx";
import RolesAccess from "./admin/pages/RolesAccess";
import ShiftLocation from "./admin/pages/ShiftLocation.jsx";
import Roster from "./admin/pages/Roster.jsx";
import Inventory from "./admin/pages/Inventory.jsx";
import ToolsSettings from "./admin/pages/ToolsSettings.jsx";

import EmployeeLayout from "./employee/EmployeeLayout.jsx";
import EmployeeOverview from "./employee/pages/Overview.jsx";
// import EmployeeProfile from "./employee/EmployeeProfile.jsx";
import EmployeeChangePassword from "./employee/pages/ChangePassword.jsx";
import EmployeeOnboarding from "./employee/pages/Onboarding.jsx";
import EmployeeMarkAttendance from "./employee/pages/MarkAttendance.jsx";
import EmployeeAttendance from "./employee/pages/Attendance.jsx";
import MyTools from "./employee/pages/MyTools.jsx";
import EmployeeLeave from "./employee/pages/Leave.jsx";
import EmployeeHolidays from "./employee/pages/Holidays.jsx";
import EmployeeAccessModules from "./employee/pages/AccessModules.jsx";
import AcademicCalendar from "./employee/pages/AcademicCalendar.jsx";
// CUSTOMER MANAGEMENT COMMENTED OUT
// import CustomerManagement from "./employee/pages/CustomerManagement.jsx";
import EmployeeRequests from "./employee/pages/Requests.jsx";
import AttendanceCorrection from "./employee/pages/AttendanceCorrection.jsx";
import TrackRequests from "./employee/pages/TrackRequests.jsx";
import EmployeeApplyLeave from "./employee/pages/EmployeeApplyLeave.jsx";
import RequestToolsInventory from "./employee/pages/RequestToolsInventory.jsx";
import EmployeeProjects from "./employee/pages/Projects.jsx";
import EmployeeServices from "./employee/pages/Services.jsx";
import EmployeeShiftLocation from "./employee/pages/ShiftLocation.jsx";
import EmployeeRoster from "./employee/pages/Roster.jsx";
import EmployeeManagement from "./employee/pages/EmployeeManagement.jsx";
import RequireOnboarding from "./employee/components/RequireOnboarding.jsx";

import CustomerLayout from "./customer/CustomerLayout.jsx";
import CustomerOverview from "./customer/pages/Overview.jsx";
import CustomerProfile from "./customer/pages/Profile.jsx";
import CustomerProjects from "./customer/pages/Projects.jsx";
import CustomerRequests from "./customer/pages/Requests.jsx";
import CustomerDocuments from "./customer/pages/Documents.jsx";
import CustomerSupport from "./customer/pages/Support.jsx";
import CustomerNotifications from "./customer/pages/Notifications.jsx";
import CustomerSettings from "./customer/pages/Settings.jsx";

const dashboardPrefixes = ["/admin", "/employee", "/customer"];

const AppRoutes = () => {
  const location = useLocation();
  const [theme, setTheme] = useState(() => getPreferredTheme());
  const isDashboardRoute = dashboardPrefixes.some((path) =>
    location.pathname.startsWith(path),
  );

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
    return () =>
      systemTheme.removeEventListener("change", handleSystemThemeChange);
  }, [isDashboardRoute]);

  return (
    <>
      <ScrollToTop />
      <Toaster
        position="top-right"
        theme={isDashboardRoute ? theme : "light"}
        richColors
      />
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
          <Route path="requests" element={<RequestsHome />} />
          <Route path="requests/track" element={<AdminTrackRequests />} />
          <Route
            path="requests/forgot-punch"
            element={<AdminAttendanceCorrection />}
          />
          <Route path="requests/apply-leave" element={<AdminApplyLeave />} />
          <Route path="approvals" element={<Approvals />} />
          <Route path="holidays" element={<Holidays />} />
          <Route path="leave-policy" element={<LeavePolicyHome />} />
          <Route path="leave-policy/types" element={<LeavePolicy />} />
          <Route path="leave-policy/holidays" element={<Holidays />} />
          <Route path="mark-attendance" element={<AdminMarkAttendance />} />
          <Route path="my-attendance" element={<EmployeeAttendance />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="attendance-management" element={<Attendance />} />
          <Route path="attendance-requests" element={<AttendanceRequests />} />
          <Route path="projects" element={<Projects />} />
          <Route path="project/:id" element={<ProjectDetails />} />
          <Route path="assigned-projects" element={<EmployeeProjects />} />
          <Route path="my-projects" element={<CustomerProjects />} />
          <Route path="roles-access" element={<RolesAccess />} />
          <Route path="shift-location" element={<ShiftLocation />} />
          <Route path="roster" element={<Roster />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="inventory/:submodule" element={<Inventory />} />
          <Route path="tools-settings" element={<ToolsSettings />} />
        </Route>

        <Route path="/employee" element={<EmployeeLayout />}>
          <Route index element={<EmployeeOverview />} />
          {/* <Route path="onboarding" element={<EmployeeOnboarding />} /> */}

          <Route path="my-tools" element={<MyTools />} />
          <Route path="mark-attendance" element={<EmployeeMarkAttendance />} />
          <Route path="attendance" element={<EmployeeAttendance />} />
          <Route path="academic-calendar" element={<AcademicCalendar />} />
          <Route path="requests" element={<EmployeeRequests />} />
          <Route path="requests/track" element={<TrackRequests />} />
          <Route
            path="requests/forgot-punch"
            element={<AttendanceCorrection />}
          />
          <Route path="requests/apply-leave" element={<EmployeeApplyLeave />} />
          <Route path="requests/tools-inventory" element={<RequestToolsInventory />} />
          <Route
            path="leave"
            element={
              <RequireOnboarding>
                <EmployeeLeave />
              </RequireOnboarding>
            }
          />
          <Route
            path="leave"
            element={
              <RequireOnboarding>
                <EmployeeLeave />
              </RequireOnboarding>
            }
          />
          <Route
            path="employee"
            element={
              <RequireOnboarding>
                <EmployeeManagement />
              </RequireOnboarding>
            }
          />
          <Route
            path="add-account"
            element={
              <RequireOnboarding>
                <EmployeeManagement />
              </RequireOnboarding>
            }
          />
          <Route
            path="employee-management"
            element={
              <RequireOnboarding>
                <EmployeeManagement />
              </RequireOnboarding>
            }
          />
          <Route
            path="employee-list"
            element={
              <RequireOnboarding>
                <EmployeeList isEmployeeView={true} />
              </RequireOnboarding>
            }
          />
          <Route
            path="approvals"
            element={
              <RequireOnboarding>
                <Approvals />
              </RequireOnboarding>
            }
          />
          <Route
            path="attendance-management"
            element={
              <RequireOnboarding>
                <Attendance />
              </RequireOnboarding>
            }
          />
          <Route
            path="projects"
            element={
              <RequireOnboarding>
                <EmployeeProjects />
              </RequireOnboarding>
            }
          />
          <Route
            path="roles-access"
            element={
              <RequireOnboarding>
                <RolesAccess />
              </RequireOnboarding>
            }
          />
          <Route
            path="shift-location"
            element={
              <RequireOnboarding>
                <ShiftLocation />
              </RequireOnboarding>
            }
          />
          <Route
            path="roster"
            element={
              <RequireOnboarding>
                <Roster />
              </RequireOnboarding>
            }
          />
          <Route
            path="leave-policy"
            element={
              <RequireOnboarding>
                <LeavePolicyHome />
              </RequireOnboarding>
            }
          />
          <Route
            path="leave-policy/types"
            element={
              <RequireOnboarding>
                <LeavePolicy />
              </RequireOnboarding>
            }
          />
          <Route
            path="leave-policy/holidays"
            element={
              <RequireOnboarding>
                <Holidays />
              </RequireOnboarding>
            }
          />
          {/* <Route path="roster" element={<RequireOnboarding><EmployeeRoster /></RequireOnboarding>} /> */}
        </Route>

        <Route path="/customer" element={<CustomerLayout />}>
          <Route index element={<CustomerOverview />} />
          <Route path="profile" element={<CustomerProfile />} />
          <Route path="projects" element={<CustomerProjects />} />
          <Route path="requests" element={<CustomerRequests />} />
          <Route path="documents" element={<CustomerDocuments />} />
          <Route path="support" element={<CustomerSupport />} />
          <Route path="notifications" element={<CustomerNotifications />} />
          <Route path="settings" element={<CustomerSettings />} />
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
