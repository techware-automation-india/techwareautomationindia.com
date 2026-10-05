import {
  LayoutDashboard,
  Fingerprint,
  Clock,
  FileText,
  UserPlus,
  BadgeCheck,
  MapPin,
  CalendarRange,
  ShieldCheck,
  FolderKanban,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
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
    label: "Attendance",
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
  {
    key: "academic-calendar",
    label: "Academic Calendar",
    path: "/employee/academic-calendar",
    icon: CalendarDays,
    description: "View academic calendar and important dates.",
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
    label: "Add Account",
    path: "/employee/employee",
    icon: UserPlus,
    description: "Create user accounts and assign roles.",
    adminKey: "employee",
  },
  {
    key: "approvals",
    label: "Approvals",
    path: "/employee/approvals",
    icon: BadgeCheck,
    description: "Review and approve employee requests.",
    adminKey: "approvals",
  },
  {
    key: "attendance-management",
    label: "Attendance Report",
    path: "/employee/attendance-management",
    icon: CalendarCheck,
    description: "Company-wide attendance report.",
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
    label: "Leave Policy & Holiday",
    path: "/employee/leave-policy",
    icon: ClipboardList,
    description: "Manage leave types, balances, rules and company holidays.",
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

  // Combine default and admin modules
  const allModules = [...defaultModules, ...adminModules];
  const allowedModules = [];

  allModules.forEach((module) => {
    // Only overview (Dashboard) is strictly alwaysVisible when a role is assigned
    if (module.key === "overview") {
      if (!allowedModules.some((m) => m.path === module.path)) {
        allowedModules.push(module);
      }
      return;
    }

    // Check direct key, or adminKey, or sub-approval fallback
    const directPerm = permissions[module.key];
    const adminPerm = module.adminKey ? permissions[module.adminKey] : null;
    const hasAdminPower = permissions["employee"] || permissions["roles-access"] || permissions["approvals"];
    const attendanceMgmtFallback = module.key === "attendance-management" && permissions["attendance"] && hasAdminPower;
    
    // Approvals access check (main key or any sub-type key)
    const hasSubApprovalPerm = module.key === "approvals" && (
      permissions["approvals"] ||
      permissions["approvals-leave"] || 
      permissions["approvals-attendance"] || 
      permissions["approvals-forgot-punch"]
    );

    const perm = directPerm || adminPerm || hasSubApprovalPerm || (attendanceMgmtFallback ? permissions["attendance"] : null);

    const isAllowed = perm && (
      perm.canView === true || 
      perm === true || 
      (typeof perm === "object" && Object.values(perm).some(Boolean))
    );

    if (isAllowed) {
      if (!allowedModules.some((m) => m.path === module.path || m.key === module.key)) {
        allowedModules.push(module);
      }
    }
  });

  return allowedModules;
}
