import { useState, useEffect } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Menu, X, LogOut, ChevronLeft, ChevronDown } from "lucide-react";
import { adminModules } from "./modules.js";
import { getAuthUser, clearAuth } from "../lib/auth.js";
import ThemeToggle from "../components/ThemeToggle.jsx";

const AdminLayout = () => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const user = getAuthUser();

  // Redirect to login if not authenticated as admin — must be inside useEffect
  useEffect(() => {
    if (!user || user.role !== "ADMIN") {
      clearAuth();
      navigate("/login", { replace: true });
    }
  }, [navigate, user]);

  const handleLogout = () => {
    clearAuth();
    navigate("/");
  };

  // While redirecting, render nothing
  if (!user || user.role !== "ADMIN") return null;

  const sidebarContent = (
    <>
      <div className="h-16 flex items-center px-6 border-b border-border">
        <Link to="/admin" className="flex items-center gap-3">
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
        {adminModules.map(({ key, label, path, icon: Icon }) => (
          <NavLink
            key={key}
            to={path}
            end={path === "/admin"}
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
        ))}
      </nav>

      <div className="p-3 border-t border-border">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          aria-label="Logout"
        >
          <LogOut className="h-4.5 w-4.5" />
          Logout
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
        <header className="fixed top-0 left-0 right-0 lg:left-64 h-16 bg-background border-b border-border flex items-center justify-between px-4 lg:px-8 z-30">
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

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((prev) => !prev)}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-secondary transition-colors"
                aria-label="Open profile menu"
              >
                {/* Name & Email */}
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-semibold text-foreground">
                    {user?.fullName || "System Admin"}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {user?.email || ""}
                  </div>
                </div>

                {/* Avatar */}
                <div className="w-9 h-9 rounded-full cta-gradient flex items-center justify-center text-white font-semibold text-sm">
                  {user?.fullName
                    ? user.fullName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)
                    : "AD"}
                </div>

                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                    profileOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Dropdown */}
              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-background shadow-lg z-50 overflow-hidden">
                  {/* User Info */}
                  <div className="px-4 py-3 border-b border-border">
                    <div className="text-sm font-semibold text-foreground">
                      {user?.fullName || "System Admin"}
                    </div>

                    <div className="text-xs text-muted-foreground mt-0.5">
                      {user?.email || ""}
                    </div>
                  </div>

                  {/* My Profile route hidden/commented for admin panel. */}

                  {/* Logout */}
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-destructive hover:bg-destructive/10 transition-colors border-t border-border"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 min-w-0 overflow-x-hidden px-4 pb-4 pt-20 lg:px-8 lg:pb-8 lg:pt-24">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
