import { useState, useEffect } from "react";
import { Link, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { Menu, X, LogOut, ChevronLeft } from "lucide-react";
import { customerModules } from "./modules.js";
import { getAuthUser, clearAuth } from "../lib/auth.js";
import ThemeToggle from "../components/ThemeToggle.jsx";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

const CustomerLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const authUser = getAuthUser();

    if (!authUser || authUser.role !== "CUSTOMER") {
      clearAuth();
      navigate("/login", { replace: true });
      return;
    }

    setUser(authUser);
  }, [navigate, location.pathname]);

  const handleLogout = () => {
    console.log("🚪 [Customer Layout] Logging out");
    clearAuth();
    navigate("/");
  };

  const sidebarContent = (
    <>
      <div className="h-16 flex items-center px-6 border-b border-border">
        <Link to="/customer" className="font-display flex items-center gap-0">
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
              <span style={{ color: "#339DE0" }}>(INDIA)</span>
            </p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {customerModules.map(({ key, label, path, icon: Icon }) => (
          <NavLink
            key={key}
            to={path}
            end={path === "/customer"}
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
              <div className="text-sm font-semibold text-foreground">{user?.fullName || "Customer"}</div>
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
                user?.fullName ? user.fullName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "CU"
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default CustomerLayout;
