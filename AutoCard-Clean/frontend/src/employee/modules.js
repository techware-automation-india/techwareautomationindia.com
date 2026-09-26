import {
  LayoutDashboard,
  ClipboardList,
  Fingerprint,
  Clock,
  Plane,
  CalendarDays,
  ShieldCheck,
  UserCog,
  Contact,
  FileText,
  BookOpen,
  FolderKanban,
  Wrench,
  MapPin,
  CalendarRange,
  BadgeCheck,
} from "lucide-react";

// Default modules always visible to employees
const defaultModules = [
  {
    key: "overview",
    label: "Dashboard",
    path: "/employee",
    icon: LayoutDashboard,
    description: "Your personal dashboard overview.",
    alwaysVisible: true,
  },
  // {
  //   key: "onboarding",
  //   label: "Onboarding Form",
  //   path: "/employee/onboarding",
  //   icon: ClipboardList,
  //   description: "Complete your onboarding details.",
  //   alwaysVisible: true,
  // },
  {
    key: "mark-attendance",
    label: "Mark Attendance",
    path: "/employee/mark-attendance",
    icon: Fingerprint,
    description: "Check in and check out for the day.",
    alwaysVisible: true,
  },
  {
    key: "attendance",
    label: "My Attendance",
    path: "/employee/attendance",
    icon: Clock,
    description: "View your personal attendance history.",
    alwaysVisible: true,
  },
  {
    key: "requests",
    label: "Requests",
    path: "/employee/requests",
    icon: FileText,
    description: "Submit and track requests.",
    alwaysVisible: true,
  },
  // {
  //   key: "leave",
  //   label: "Leave",
  //   path: "/employee/leave",
  //   icon: Plane,
  //   description: "Apply for and track your leave.",
  //   alwaysVisible: true,
  // },
  // {
  //   key: "holidays",
  //   label: "Holidays",
  //   path: "/employee/holidays",
  //   icon: CalendarDays,
  //   description: "View company holiday calendar.",
  //   alwaysVisible: true,
  // },
];

// Admin modules that can be delegated to employees via custom roles or permissions
const adminModules = [
  {
    key: "employee",
    label: "Account Management",
    path: "/employee/employee-management",
    icon: UserCog,
    description: "Manage user accounts.",
    adminKey: "employee",
  },
  {
    key: "approvals",
    label: "Approvals",
    path: "/employee/approvals",
    icon: BadgeCheck,
    description: "Review and act on employee requests.",
    adminKey: "approvals",
  },
  {
    key: "attendance-management",
    label: "Attendance Register",
    path: "/employee/attendance-management",
    icon: Clock,
    description: "Company-wide attendance register.",
    adminKey: "attendance-management",
  },
  {
    key: "shift-location",
    label: "Shift & Location",
    path: "/employee/shift-location",
    icon: MapPin,
    description: "Shift and location management.",
    adminKey: "shift-location",
  },
  {
    key: "roster",
    label: "Roster",
    path: "/employee/roster",
    icon: CalendarRange,
    description: "Employee scheduling.",
    adminKey: "roster",
  },
  {
    key: "roles-access",
    label: "Roles & Access",
    path: "/employee/roles-access",
    icon: ShieldCheck,
    description: "Configure roles and permissions.",
    adminKey: "roles-access",
  },
  {
    key: "leave-policy",
    label: "Leave Policy",
    path: "/employee/leave-policy",
    icon: BookOpen,
    description: "Leave types and policies.",
    adminKey: "leave-policy",
  },
  {
    key: "projects",
    label: "Projects",
    path: "/employee/projects",
    icon: FolderKanban,
    description: "Project management.",
    adminKey: "projects",
  },
];

// All modules combined
export const employeeModules = [...defaultModules, ...adminModules];

/**
 * Get modules to display based on account role permissions
 * @param {Object} permissions - Permission object from API
 * @returns {Array} - Array of module objects to display
 */
export function getModulesByPermissions(permissions = {}) {
  const permKeys = Object.keys(permissions);

  // If no configured permissions returned (e.g. unassigned legacy account), use default base modules
  if (permKeys.length === 0) {
    return [...defaultModules];
  }

  // When an account has an assigned role, its access is strictly governed by the role's assigned modules
  const allModules = [...defaultModules, ...adminModules];
  const allowedModules = [];

  allModules.forEach((module) => {
    // Check direct key, or adminKey, or admin attendance fallback
    const directPerm = permissions[module.key];
    const adminPerm = module.adminKey ? permissions[module.adminKey] : null;
    const hasAdminPower = permissions["employee"] || permissions["roles-access"] || permissions["approvals"];
    const attendanceMgmtFallback = module.key === "attendance-management" && permissions["attendance"] && hasAdminPower;

    const perm = directPerm || adminPerm || (attendanceMgmtFallback ? permissions["attendance"] : null);

    if (perm && (perm.canView || perm === true)) {
      if (!allowedModules.some((m) => m.key === module.key)) {
        allowedModules.push(module);
      }
    }
  });

  // Ensure dashboard / overview is always present as home if user has any active permissions
  if (!allowedModules.some((m) => m.key === "overview")) {
    const overviewMod = defaultModules.find((m) => m.key === "overview");
    if (overviewMod && (permissions["overview"] || allowedModules.length > 0)) {
      allowedModules.unshift(overviewMod);
    }
  }

  return allowedModules;
}
