import { useState, useEffect, useRef } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useNavigate,
  useLocation,
} from "react-router-dom";
import {
  Menu,
  X,
  LogOut,
  ChevronLeft,
  ClipboardList,
  Clock,
  ChevronDown,
} from "lucide-react";
import { employeeModules, getModulesByPermissions } from "./modules.js";
import { getAuthUser, clearAuth, updateAuthUser } from "../lib/auth.js";
import { apiGet } from "../lib/api.js";
import ThemeToggle from "../components/ThemeToggle.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

const EmployeeLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileDropdownRef = useRef(null);
  const [user, setUser] = useState(null);
  const [assignedRoleName, setAssignedRoleName] = useState(() => {
    const authUser = getAuthUser();
    return authUser?.roleName || authUser?.customRole?.name || "";
  });
  const [permissions, setPermissions] = useState({});
  const [visibleModules, setVisibleModules] = useState([]);
  const [loadingPermissions, setLoadingPermissions] = useState(true);

  // Close profile dropdown when clicking anywhere outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target)
      ) {
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const authUser = getAuthUser();

    if (!authUser || authUser.role !== "EMPLOYEE") {
      clearAuth();
      navigate("/login", { replace: true });
      return;
    }

    setUser(authUser);
    if (authUser.roleName || authUser.customRole?.name) {
      setAssignedRoleName(authUser.roleName || authUser.customRole?.name);
    }
  }, [navigate, location.pathname]);

  // Load permissions and determine visible modules
  useEffect(() => {
    if (!user) return;

    const loadPermissions = async () => {
      try {
        setLoadingPermissions(true);

        const data = await apiGet("/roles-access/me/permissions");
        const perms = data?.permissions || {};
        
        localStorage.setItem('employee_permissions', JSON.stringify(perms));
        localStorage.setItem('employee_permissions_timestamp', String(Date.now()));
        
        setPermissions(perms);
        const modules = getModulesByPermissions(perms);
        setVisibleModules(modules);
        if (data?.roleName) {
          setAssignedRoleName((prev) => (prev !== data.roleName ? data.roleName : prev));
          updateAuthUser({ roleName: data.roleName });
        }
      } catch (err) {
        if (err.message === "Authentication required." || err.status === 401) {
          clearAuth();
          navigate("/login", { replace: true });
          return;
        }
        console.warn("Failed to load permissions, falling back to cached or default modules:", err.message);
        const cachedPerms = localStorage.getItem('employee_permissions');
        if (cachedPerms) {
          const perms = JSON.parse(cachedPerms);
          setPermissions(perms);
          setVisibleModules(getModulesByPermissions(perms));
        } else {
          setVisibleModules(employeeModules);
        }
      } finally {
        setLoadingPermissions(false);
      }
    };

    loadPermissions();
  }, [user?.id]);

  const handleLogout = () => {
    console.log("🚪 [Employee Layout] Logging out");
    // Clear permissions cache on logout
    localStorage.removeItem('employee_permissions');
    localStorage.removeItem('employee_permissions_timestamp');
    clearAuth();
    navigate("/");
  };

  const sidebarContent = (
    <>
     <div className="h-16 flex items-center px-6 border-b border-border">
        <Link to="/employee" className="flex items-center gap-3">
          {/* Logo */}
          <img
            src="/techwareLogo.svg"
            alt="Techware"
            className="h-10 w-10 object-contain"
          />

          {/* App Name */}
          <div className="flex flex-col">
            <span className="text-[16px] font-bold leading-tight text-[#2A3791]">
              Techware
            </span>

            <span className="text-[10px] font-semibold leading-tight text-[#2A3791]">
              Management{" "}
              <span className="text-[10px] font-semibold leading-tight text-[#339DE0]">
                System
              </span>
            </span>
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
              const isOnboardingModule =
                key === "onboarding" || key === "overview";
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
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setMobileOpen(false)}
          />
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
      <div className="flex-1 min-w-0 max-w-full overflow-x-hidden lg:ml-64 lg:max-w-[calc(100vw-16rem)] flex flex-col min-h-screen">
        <header className="fixed top-0 left-0 right-0 lg:left-64 h-16 bg-background/95 backdrop-blur-md border-b border-border flex items-center justify-between px-4 lg:px-8 z-30">
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

            <div className="relative" ref={profileDropdownRef}>
              {/* Profile Button */}
              <button
                type="button"
                onClick={() => setProfileOpen((prev) => !prev)}
                className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-secondary transition-colors"
              >
                {/* Name + Role */}
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-semibold text-foreground leading-tight">
                    {user?.fullName || "Employee"}
                  </div>

                  {(assignedRoleName || user?.roleName || user?.customRole?.name || user?.role) && (
                    <div className="flex items-center justify-end mt-0.5">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-bold uppercase">
                        {assignedRoleName || user?.roleName || user?.customRole?.name || user?.role}
                      </span>
                    </div>
                  )}
                </div>

                {/* Avatar */}
                <div className="w-9 h-9 rounded-full cta-gradient flex items-center justify-center text-white font-semibold text-sm overflow-hidden">
                  {user?.profileImage ? (
                    <img
                      src={`${API_BASE}${user.profileImage}`}
                      alt={user.fullName || "Employee"}
                      className="w-full h-full object-cover"
                    />
                  ) : user?.fullName ? (
                    user.fullName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)
                  ) : (
                    "EM"
                  )}
                </div>

                <ChevronDown
                  className={`hidden sm:block w-4 h-4 text-muted-foreground transition-transform ${
                    profileOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Dropdown */}
              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-border bg-background shadow-xl z-50 overflow-hidden">
                  {/* User Info */}
                  <div className="px-4 py-4 border-b border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full cta-gradient flex items-center justify-center text-white text-sm font-semibold overflow-hidden">
                        {user?.profileImage ? (
                          <img
                            src={`${API_BASE}${user.profileImage}`}
                            alt={user.fullName || "Employee"}
                            className="w-full h-full object-cover"
                          />
                        ) : user?.fullName ? (
                          user.fullName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)
                        ) : (
                          "EM"
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {user?.fullName || "Employee"}
                        </p>

                        <p className="text-xs text-muted-foreground truncate">
                          {user?.email || ""}
                        </p>
                      </div>
                    </div>

                    <span className="inline-flex mt-3 px-2.5 py-1 rounded-md bg-primary/10 text-primary text-[10px] font-bold tracking-wide uppercase">
                      {assignedRoleName || user?.roleName || user?.customRole?.name || user?.role || "EMPLOYEE"}
                    </span>
                  </div>

                  {/* My Profile route hidden/commented for employee panel. */}

                  {/* Logout */}
                  <div className="p-2 border-t border-border">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                        <LogOut className="w-4 h-4" />
                      </div>
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 min-w-0 max-w-full overflow-x-hidden px-4 pb-4 pt-20 lg:px-8 lg:pb-8 lg:pt-20">
          {/* Onboarding Status Banner */}
          {user?.onboardingStatus === "PENDING" && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 shrink-0" />
              <span>
                <strong>Action Required:</strong> Please complete your
                onboarding form to access all features.{" "}
                <Link
                  to="/employee/onboarding"
                  className="underline font-semibold hover:text-amber-800"
                >
                  Complete Now
                </Link>
              </span>
            </div>
          )}
          {user?.onboardingStatus === "SUBMITTED" && (
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0" />
              <span>
                <strong>Pending Approval:</strong> Your onboarding form is under
                review by the admin.
              </span>
            </div>
          )}

          <Outlet context={{ visibleModules, permissions }} />
        </main>
      </div>
    </div>
  );
};

export default EmployeeLayout;
