import { useState, useEffect } from "react";
import { Link, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { Menu, X, LogOut, ChevronLeft, ClipboardList, Clock } from "lucide-react";
import { employeeModules, getModulesByPermissions } from "./modules.js";
import { getAuthUser, clearAuth } from "../lib/auth.js";
import { apiGet } from "../lib/api.js";
import ThemeToggle from "../components/ThemeToggle.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

const EmployeeLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [visibleModules, setVisibleModules] = useState([]);
  const [loadingPermissions, setLoadingPermissions] = useState(true);

  useEffect(() => {
    const authUser = getAuthUser();

    if (!authUser || authUser.role !== "EMPLOYEE") {
      clearAuth();
      navigate("/login", { replace: true });
      return;
    }

    setUser(authUser);
  }, [navigate, location.pathname]);

  // Load permissions and determine visible modules
  useEffect(() => {
    if (!user) return;

    const loadPermissions = async () => {
      try {
        const data = await apiGet("/roles-access/me/permissions");
        const modules = getModulesByPermissions(data.permissions || {});
        setVisibleModules(modules);
      } catch (err) {
        console.error("Failed to load permissions:", err);
        // Fallback to default modules if permission loading fails
        setVisibleModules(employeeModules);
      } finally {
        setLoadingPermissions(false);
      }
    };

    loadPermissions();
  }, [user]);

  const handleLogout = () => {
    console.log("🚪 [Employee Layout] Logging out");
    clearAuth();
    navigate("/");
  };

  const sidebarContent = (
    <>
      <div className="h-16 flex items-center px-6 border-b border-border">
        <Link to="/employee" className="font-display flex items-center gap-0">
          <div className="flex flex-col justify-center">
            <h1 className="text-[20px] md:text-[24px] lg:text-[28px] font-extrabold leading-none tracking-tight">
  <span style={{ color: "#2A3791" }}>Tech</span>
  <span style={{ color: "#2A3791" }}>ware</span>
</h1>

<p
  className="text-[9px] md:text-[10px] lg:text-[11px] font-semibold mt-0.5"
  style={{
    letterSpacing: "0.28em",
    lineHeight: 1.2,
  }}
>
  <span style={{ color: "#2A3791" }}>Automation </span>
  <span style={{ color: "#339DE0" }}>INDIA</span>
</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {loadingPermissions ? (
          <div className="flex items-center justify-center py-8">
            <Clock className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          visibleModules
            .filter(({ key }) => {
              // Hide non-onboarding modules if status is PENDING, but allow mark attendance.
              const isPending = user?.onboardingStatus === "PENDING";
              const isOnboardingModule = key === "onboarding" || key === "overview";
              const isMarkAttendance = key === "mark-attendance";
              return !isPending || isOnboardingModule || isMarkAttendance;
            })
            .map(({ key, label, path, icon: Icon }) => (
              <NavLink
                key={key}
                to={path}
                end={path === "/employee"}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`
                }
              >
                <Icon className="h-4.5 w-4.5 shrink-0" />
                {label}
              </NavLink>
            ))
        )}
      </nav>

      <div className="p-3 border-t border-border">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="h-4.5 w-4.5" /> Logout
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-secondary/30 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-background border-r border-border fixed inset-y-0 left-0 z-40">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex flex-col w-64 bg-background border-r border-border">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        <header className="h-16 bg-background border-b border-border flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden text-foreground"
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <Link
              to="/"
              className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" /> Back to Site
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold text-foreground">{user?.fullName || "Employee"}</div>
              <div className="text-xs text-muted-foreground">{user?.email || ""}</div>
            </div>
            <div className="w-9 h-9 rounded-full cta-gradient flex items-center justify-center text-white font-semibold text-sm overflow-hidden">
              {user?.profileImage ? (
                <img
                  src={`${API_BASE}${user.profileImage}`}
                  alt={user.fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                user?.fullName ? user.fullName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "EM"
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          {/* Onboarding Status Banner */}
          {user?.onboardingStatus === "PENDING" && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 shrink-0" />
              <span>
                <strong>Action Required:</strong> Please complete your onboarding form to access all features.{" "}
                <Link to="/employee/onboarding" className="underline font-semibold hover:text-amber-800">
                  Complete Now
                </Link>
              </span>
            </div>
          )}
          {user?.onboardingStatus === "SUBMITTED" && (
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0" />
              <span>
                <strong>Pending Approval:</strong> Your onboarding form is under review by the admin.
              </span>
            </div>
          )}
          
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default EmployeeLayout;
