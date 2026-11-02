import { lazy, Suspense, useEffect, useState } from "react";
import { PollProvider } from "./lib/pollContext.jsx";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import ScrollToTop from "./components/ScrollToTop.jsx";
import { applyTheme, getPreferredTheme, onThemeChange } from "./lib/theme.js";
import NotFound from "./pages/NotFound.jsx";
import RequireOnboarding from "./employee/components/RequireOnboarding.jsx";
import RequireModuleAccess from "./employee/components/RequireModuleAccess.jsx";

const Index = lazy(() => import("./pages/Index.jsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const UniversalLogin = lazy(() => import("./pages/UniversalLogin.jsx"));
const Machines = lazy(() => import("./pages/Machines.jsx"));

// import AdminProfile from "./admin/AdminProfile.jsx";
const ChangePassword = lazy(() => import("./admin/pages/ChangePassword.jsx"));
const AdminLayout = lazy(() => import("./admin/AdminLayout.jsx"));
const Overview = lazy(() => import("./admin/pages/Overview.jsx"));
const Employee = lazy(() => import("./admin/pages/Employee.jsx"));
const EmployeeList = lazy(() => import("./admin/pages/EmployeeList.jsx"));
// CUSTOMER ADMIN PAGES COMMENTED OUT
// import Customer from "./admin/pages/Customer.jsx";
// import CustomerList from "./admin/pages/CustomerList.jsx";
const RequestsHome = lazy(() => import("./admin/pages/RequestsHome.jsx"));
const AdminTrackRequests = lazy(() => import("./admin/pages/AdminTrackRequests.jsx"));
const AdminAttendanceCorrection = lazy(() => import("./admin/pages/AdminAttendanceCorrection.jsx"));
const AdminApplyLeave = lazy(() => import("./admin/pages/AdminApplyLeave.jsx"));
const Approvals = lazy(() => import("./admin/pages/Approvals.jsx"));
const LeavePolicy = lazy(() => import("./admin/pages/LeavePolicy.jsx"));
const Holidays = lazy(() => import("./admin/pages/Holidays.jsx"));
const LeavePolicyHome = lazy(() => import("./admin/pages/LeavePolicyHome.jsx"));
const AdminMarkAttendance = lazy(() => import("./admin/pages/MarkAttendance.jsx"));

const Attendance = lazy(() => import("./admin/pages/Attendance.jsx"));
const AttendanceRequests = lazy(() => import("./admin/pages/AttendanceRequests.jsx"));
const Projects = lazy(() => import("./admin/pages/Projects.jsx"));
const ProjectDetails = lazy(() => import("./admin/pages/ProjectDetails.jsx"));
const Services = lazy(() => import("./admin/pages/Services.jsx"));
const RolesAccess = lazy(() => import("./admin/pages/RolesAccess"));
const ShiftLocation = lazy(() => import("./admin/pages/ShiftLocation.jsx"));
const Roster = lazy(() => import("./admin/pages/Roster.jsx"));
const Inventory = lazy(() => import("./admin/pages/Inventory.jsx"));
const ToolsSettings = lazy(() => import("./admin/pages/ToolsSettings.jsx"));

const EmployeeLayout = lazy(() => import("./employee/EmployeeLayout.jsx"));
const EmployeeOverview = lazy(() => import("./employee/pages/Overview.jsx"));
// import EmployeeProfile from "./employee/EmployeeProfile.jsx";
const EmployeeChangePassword = lazy(() => import("./employee/pages/ChangePassword.jsx"));
const EmployeeMarkAttendance = lazy(() => import("./employee/pages/MarkAttendance.jsx"));
const EmployeeAttendance = lazy(() => import("./employee/pages/Attendance.jsx"));
const MyTools = lazy(() => import("./employee/pages/MyTools.jsx"));
const EmployeeLeave = lazy(() => import("./employee/pages/Leave.jsx"));
const EmployeeHolidays = lazy(() => import("./employee/pages/Holidays.jsx"));
const EmployeeAccessModules = lazy(() => import("./employee/pages/AccessModules.jsx"));
const AcademicCalendar = lazy(() => import("./employee/pages/AcademicCalendar.jsx"));
// CUSTOMER MANAGEMENT COMMENTED OUT
// import CustomerManagement from "./employee/pages/CustomerManagement.jsx";
const EmployeeRequests = lazy(() => import("./employee/pages/Requests.jsx"));
const AttendanceCorrection = lazy(() => import("./employee/pages/AttendanceCorrection.jsx"));
const TrackRequests = lazy(() => import("./employee/pages/TrackRequests.jsx"));
const EmployeeApplyLeave = lazy(() => import("./employee/pages/EmployeeApplyLeave.jsx"));
const RequestToolsInventory = lazy(() => import("./employee/pages/RequestToolsInventory.jsx"));
const EmployeeProjects = lazy(() => import("./employee/pages/Projects.jsx"));
const EmployeeServices = lazy(() => import("./employee/pages/Services.jsx"));
const EmployeeShiftLocation = lazy(() => import("./employee/pages/ShiftLocation.jsx"));
const EmployeeRoster = lazy(() => import("./employee/pages/Roster.jsx"));
const EmployeeManagement = lazy(() => import("./employee/pages/EmployeeManagement.jsx"));

const CustomerLayout = lazy(() => import("./customer/CustomerLayout.jsx"));
const CustomerOverview = lazy(() => import("./customer/pages/Overview.jsx"));
const CustomerProfile = lazy(() => import("./customer/pages/Profile.jsx"));
const CustomerProjects = lazy(() => import("./customer/pages/Projects.jsx"));
const CustomerRequests = lazy(() => import("./customer/pages/Requests.jsx"));
const CustomerDocuments = lazy(() => import("./customer/pages/Documents.jsx"));
const CustomerSupport = lazy(() => import("./customer/pages/Support.jsx"));
const CustomerNotifications = lazy(() => import("./customer/pages/Notifications.jsx"));
const CustomerSettings = lazy(() => import("./customer/pages/Settings.jsx"));

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
      <Suspense
        fallback={
          <div
            className="flex min-h-screen items-center justify-center text-sm text-muted-foreground"
            role="status"
          >
            Loading page...
          </div>
        }
      >
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

          <Route path="my-tools" element={<MyTools />} />
          <Route path="mark-attendance" element={<EmployeeMarkAttendance />} />
          <Route path="attendance" element={<EmployeeAttendance />} />
          <Route
            path="academic-calendar"
            element={
              <RequireModuleAccess moduleKey="academic-calendar">
                <AcademicCalendar />
              </RequireModuleAccess>
            }
          />
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
            path="employee"
            element={
              <RequireOnboarding>
                <RequireModuleAccess moduleKey="employee">
                  <EmployeeManagement />
                </RequireModuleAccess>
              </RequireOnboarding>
            }
          />
          <Route
            path="add-account"
            element={
              <RequireOnboarding>
                <RequireModuleAccess moduleKey="employee">
                  <EmployeeManagement />
                </RequireModuleAccess>
              </RequireOnboarding>
            }
          />
          <Route
            path="employee-management"
            element={
              <RequireOnboarding>
                <RequireModuleAccess moduleKey="employee">
                  <EmployeeManagement />
                </RequireModuleAccess>
              </RequireOnboarding>
            }
          />
          <Route
            path="employee-list"
            element={
              <RequireOnboarding>
                <RequireModuleAccess moduleKey="employee">
                  <EmployeeList isEmployeeView={true} />
                </RequireModuleAccess>
              </RequireOnboarding>
            }
          />
          <Route
            path="approvals"
            element={
              <RequireOnboarding>
                <RequireModuleAccess moduleKey="approvals">
                  <Approvals />
                </RequireModuleAccess>
              </RequireOnboarding>
            }
          />
          <Route
            path="attendance-management"
            element={
              <RequireOnboarding>
                <RequireModuleAccess moduleKey="attendance-management">
                  <Attendance />
                </RequireModuleAccess>
              </RequireOnboarding>
            }
          />
          <Route
            path="projects"
            element={
              <RequireOnboarding>
                <RequireModuleAccess moduleKey="assigned-projects">
                  <EmployeeProjects />
                </RequireModuleAccess>
              </RequireOnboarding>
            }
          />
          <Route
            path="roles-access"
            element={
              <RequireOnboarding>
                <RequireModuleAccess moduleKey="roles-access">
                  <RolesAccess />
                </RequireModuleAccess>
              </RequireOnboarding>
            }
          />
          <Route
            path="shift-location"
            element={
              <RequireOnboarding>
                <RequireModuleAccess moduleKey="shift-location">
                  <EmployeeShiftLocation />
                </RequireModuleAccess>
              </RequireOnboarding>
            }
          />
          <Route
            path="roster"
            element={
              <RequireOnboarding>
                <RequireModuleAccess moduleKey="roster">
                  <EmployeeRoster />
                </RequireModuleAccess>
              </RequireOnboarding>
            }
          />
          <Route
            path="leave-policy"
            element={
              <RequireOnboarding>
                <RequireModuleAccess moduleKey="leave-policy">
                  <LeavePolicyHome />
                </RequireModuleAccess>
              </RequireOnboarding>
            }
          />
          <Route
            path="leave-policy/types"
            element={
              <RequireOnboarding>
                <RequireModuleAccess moduleKey="leave-policy">
                  <LeavePolicy />
                </RequireModuleAccess>
              </RequireOnboarding>
            }
          />
          <Route
            path="leave-policy/holidays"
            element={
              <RequireOnboarding>
                <RequireModuleAccess moduleKey="leave-policy">
                  <Holidays />
                </RequireModuleAccess>
              </RequireOnboarding>
            }
          />
          <Route
            path="inventory"
            element={
              <RequireOnboarding>
                <RequireModuleAccess moduleKey={["inventory", "inventory-in", "inventory-out", "view-inventory", "inventory-approval", "inventory-alert", "general-consumables"]}>
                  <Inventory />
                </RequireModuleAccess>
              </RequireOnboarding>
            }
          />
          <Route
            path="inventory/:submodule"
            element={
              <RequireOnboarding>
                <RequireModuleAccess moduleKey={["inventory", "inventory-in", "inventory-out", "view-inventory", "inventory-approval", "inventory-alert", "general-consumables"]}>
                  <Inventory />
                </RequireModuleAccess>
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
      </Suspense>
    </>
  );
};

const App = () => {
  return (
    <PollProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </PollProvider>
  );
};

export default App;
