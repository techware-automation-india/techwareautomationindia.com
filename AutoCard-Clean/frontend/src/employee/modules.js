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
  Wrench,
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
    key: "assigned-projects",
    label: "Assigned Projects",
    path: "/employee/projects",
    icon: FolderKanban,
    description: "View your assigned projects and update task progress.",
    aliases: ["projects", "assigned-projects"],
  },
  {
    key: "my-projects",
    label: "My Projects",
    path: "/customer/projects",
    icon: FolderKanban,
    description: "View machinery projects and documentation.",
    aliases: ["my-projects", "customer-projects"],
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
    key: "academic-calendar",
    label: "Academic Calendar",
    path: "/employee/academic-calendar",
    icon: CalendarDays,
    description: "View academic calendar and important dates.",
    adminKey: "academic-calendar",
  },
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
    key: "assigned-projects",
    label: "Assigned Projects",
    path: "/employee/projects",
    icon: FolderKanban,
    description: "Project management and assigned tasks.",
    adminKey: "projects",
    aliases: ["projects", "assigned-projects"],
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
    // Overview (Dashboard) and My Tools are default base modules always visible to employees
    if (module.key === "overview" || module.key === "my-tools") {
      if (!allowedModules.some((m) => m.path === module.path || m.key === module.key)) {
        allowedModules.push(module);
      }
      return;
    }

    // Check direct key, or adminKey, or aliases, or sub-approval fallback
    let perm = permissions[module.key];

    if (!perm && module.adminKey) {
      perm = permissions[module.adminKey];
    }

    if (!perm && module.aliases) {
      for (const alias of module.aliases) {
        if (permissions[alias]) {
          perm = permissions[alias];
          break;
        }
      }
    }

    // Special mapping for assigned-projects and projects
    if (!perm && (module.key === "assigned-projects" || module.key === "projects")) {
      perm = permissions["assigned-projects"] || permissions["projects"];
    }

    if (!perm && module.key === "my-projects") {
      perm = permissions["my-projects"] || permissions["customer-projects"];
    }

    const hasAdminPower = permissions["employee"] || permissions["roles-access"] || permissions["approvals"];
    const attendanceMgmtFallback = module.key === "attendance-management" && permissions["attendance"] && hasAdminPower;
    
    // Approvals access check (main key or any sub-type key)
    const hasSubApprovalPerm = module.key === "approvals" && (
      permissions["approvals"] ||
      permissions["approvals-leave"] || 
      permissions["approvals-attendance"] || 
      permissions["approvals-forgot-punch"]
    );

    if (attendanceMgmtFallback && !perm) {
      perm = permissions["attendance"];
    }

    if (hasSubApprovalPerm && !perm) {
      perm = hasSubApprovalPerm;
    }

    const isAllowed = perm && (
      perm.canView === true || 
      perm === true || 
      (typeof perm === "object" && Object.values(perm).some(Boolean))
    );

    if (isAllowed) {
      const alreadyAdded = allowedModules.some(
        (m) => m.key === module.key || (m.path === module.path && m.path === "/employee/projects")
      );
      if (!alreadyAdded) {
        const modToAdd = module.path === "/employee/projects"
          ? { ...module, label: "Assigned Projects", key: "assigned-projects" }
          : module;
        allowedModules.push(modToAdd);
      }
    }
  });

  return allowedModules;
}
