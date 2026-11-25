import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Users,
  UserPlus,
  Clock,
  Building2,
  CalendarRange,
  ClipboardList,
  BadgeCheck,
  ChevronRight,
  Shield,
  Layers,
  ArrowLeft,
} from "lucide-react";
import { apiGet } from "../../lib/api";
import { getAuthUser } from "../../lib/auth";

export const hrmsSubModules = [
  {
    id: "add-account",
    title: "Add Account",
    adminPath: "/admin/employee",
    employeePath: "/employee/employee",
    moduleKey: "employee",
    description: "User onboarding, profile creation, and credentials setup.",
    icon: UserPlus,
    color: "from-blue-500 to-indigo-600",
    bgLight: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
    borderLight: "hover:border-blue-500/40",
  },
  {
    id: "team-attendance",
    title: "Team Attendance",
    adminPath: "/admin/attendance",
    employeePath: "/employee/attendance-management",
    moduleKey: "attendance-management",
    description: "Daily/monthly attendance register, punches, worked hours, and overtime tracking.",
    icon: Clock,
    color: "from-emerald-500 to-teal-600",
    bgLight: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    borderLight: "hover:border-emerald-500/40",
  },
  {
    id: "shift-location",
    title: "Shift & Location",
    adminPath: "/admin/shift-location",
    employeePath: "/employee/shift-location",
    moduleKey: "shift-location",
    description: "General shifts, rotational shifts, and geofenced office/client locations.",
    icon: Building2,
    color: "from-violet-500 to-purple-600",
    bgLight: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
    borderLight: "hover:border-violet-500/40",
  },
  {
    id: "roster",
    title: "Roster",
    adminPath: "/admin/roster",
    employeePath: "/employee/roster",
    moduleKey: "roster",
    description: "Monthly shift scheduling and team roster planning.",
    icon: CalendarRange,
    color: "from-amber-500 to-orange-600",
    bgLight: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
    borderLight: "hover:border-amber-500/40",
  },
  {
    id: "leave-policy",
    title: "Leave Policy & Holiday",
    adminPath: "/admin/leave-policy",
    employeePath: "/employee/leave-policy",
    moduleKey: "leave-policy",
    description: "Paid leave balances, quota rules, and annual holiday calendar.",
    icon: ClipboardList,
    color: "from-rose-500 to-pink-600",
    bgLight: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
    borderLight: "hover:border-rose-500/40",
  },
  {
    id: "approvals",
    title: "Approvals",
    adminPath: "/admin/approvals",
    employeePath: "/employee/approvals",
    moduleKey: "approvals",
    description: "Approval hub for punch corrections, leaves, and inventory/tools requisitions.",
    icon: BadgeCheck,
    color: "from-cyan-500 to-sky-600",
    bgLight: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-400",
    borderLight: "hover:border-cyan-500/40",
  },
];

export default function HrmsHub() {
  const navigate = useNavigate();
  const location = useLocation();
  const authUser = getAuthUser();
  const isEmployeeView = location.pathname.startsWith("/employee") || authUser?.role === "EMPLOYEE";
  const [permissions, setPermissions] = useState({});

  useEffect(() => {
    if (isEmployeeView) {
      try {
        const cached = localStorage.getItem("employee_permissions");
        if (cached) {
          setPermissions(JSON.parse(cached));
        }
      } catch {}

      apiGet("/roles-access/me/permissions")
        .then((res) => {
          if (res?.permissions) {
            setPermissions(res.permissions);
          }
        })
        .catch(() => {});
    }
  }, [isEmployeeView]);

  const visibleCards = hrmsSubModules.filter((sub) => {
    // In admin panel, show all
    if (!isEmployeeView) {
      return true;
    }

    // In employee panel: strictly check permission for this specific submodule
    if (sub.moduleKey === "approvals") {
      return !!(
        permissions["approvals"] ||
        permissions["approvals-leave"] ||
        permissions["approvals-attendance"] ||
        permissions["approvals-forgot-punch"] ||
        permissions["approvals-tools-inventory"]
      );
    }

    const p = permissions[sub.moduleKey];
    return p?.canView === true || p === true || (typeof p === "object" && Object.values(p).some(Boolean));
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          onClick={() => navigate(isEmployeeView ? "/employee" : "/admin")}
          className="p-2.5 rounded-xl border border-border bg-background hover:bg-secondary text-muted-foreground hover:text-foreground transition-all shrink-0 cursor-pointer shadow-xs"
          aria-label="Back to Dashboard"
          title="Back to Dashboard"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
            Team Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Select a module to manage accounts, attendance, shifts, roster, leaves, and approvals.
          </p>
        </div>
      </div>

      {/* Grid of Core HRMS Submodules */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {visibleCards.map((sub) => {
          const Icon = sub.icon;
          const targetPath = isEmployeeView ? sub.employeePath : sub.adminPath;

          return (
            <Link
              key={sub.id}
              to={targetPath}
              className={`group relative rounded-2xl bg-card border border-border p-6 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between min-h-[190px] ${sub.borderLight}`}
            >
              <div>
                <div className="mb-4">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${sub.bgLight}`}
                  >
                    <Icon className="h-5.5 w-5.5" />
                  </div>
                </div>

                <h2 className="font-display text-lg font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
                  {sub.title}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                  {sub.description}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-border flex items-center justify-between text-xs font-semibold text-primary">
                <span>Open Module</span>
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
