import {
  LayoutDashboard,
  UserPlus,
  Inbox,
  BadgeCheck,
  Fingerprint,
  Calendar,
  Clock,
  BookOpen,
  FolderKanban,
  Package,
  ShieldCheck,
  Building2,
  CalendarRange,
} from "lucide-react";

// Single source of truth for admin modules.
// Exactly aligns with the 13 modules manageable in Roles & Access.
export const adminModules = [
  {
    key: "overview",
    label: "Dashboard",
    path: "/admin",
    icon: LayoutDashboard,
    description: "Overview of all admin activity and key metrics.",
  },
  {
    key: "employee",
    label: "Add Account",
    path: "/admin/employee",
    icon: UserPlus,
    description: "Create user accounts and assign roles.",
  },
  {
    key: "requests",
    label: "Requests",
    path: "/admin/requests",
    icon: Inbox,
    description: "Review and act on incoming employee requests.",
  },
  {
    key: "approvals",
    label: "Approvals",
    path: "/admin/approvals",
    icon: BadgeCheck,
    description: "Approve or reject pending employee requests.",
  },
  {
    key: "mark-attendance",
    label: "Mark Attendance",
    path: "/admin/mark-attendance",
    icon: Fingerprint,
    description: "Mark your own attendance as admin.",
  },
  {
    key: "attendance",
    label: "My Attendance",
    path: "/admin/my-attendance",
    icon: Calendar,
    description: "View your personal attendance history.",
  },
  {
    key: "attendance-management",
    label: "Team Attendance",
    path: "/admin/attendance",
    icon: Clock,
    description: "Track and review company-wide employee attendance.",
  },
  {
    key: "leave-policy",
    label: "Leave Policy",
    path: "/admin/leave-policy",
    icon: BookOpen,
    description: "Define leave types, balances, and rules.",
  },
  {
    key: "projects",
    label: "Projects",
    path: "/admin/projects",
    icon: FolderKanban,
    description: "Create projects and assign team members.",
  },
  {
    key: "inventory",
    label: "Inventory",
    path: "/admin/inventory",
    icon: Package,
    description: "Manage company inventory items and stock levels.",
  },
  {
    key: "roles-access",
    label: "Roles & Access",
    path: "/admin/roles-access",
    icon: ShieldCheck,
    description: "Configure roles and permission levels.",
  },
  {
    key: "shift-location",
    label: "Shift & Location",
    path: "/admin/shift-location",
    icon: Building2,
    description: "Manage work shifts and office locations.",
  },
  {
    key: "roster",
    label: "Roster",
    path: "/admin/roster",
    icon: CalendarRange,
    description: "Plan and assign employee work rosters.",
  },
];

export const getAdminModulesByPermissions = (permissions) => {
  if (!permissions || Object.keys(permissions).length === 0) {
    return adminModules;
  }
  return adminModules.filter((module) => {
    if (module.key === "overview") return true;
    if (permissions[module.key]?.canView || permissions[module.key] === true) return true;
    return false;
  });
};

