import {
  LayoutDashboard,
  Users,
  UserPlus,
  Inbox,
  BadgeCheck,
  ClipboardList,
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
export const adminModules = [
  {
    key: "overview",
    label: "Dashboard",
    path: "/admin",
    icon: LayoutDashboard,
    description: "Overview of all admin activity and key metrics.",
  },
  {
    key: "mark-attendance",
    label: "Mark Attendance",
    path: "/admin/mark-attendance",
    icon: Fingerprint,
    description: "Mark your own daily attendance check-in and check-out as admin.",
  },
  {
    key: "attendance",
    label: "Attendance",
    path: "/admin/my-attendance",
    icon: Calendar,
    description: "View your personal attendance history and monthly summary.",
  },
  {
    key: "requests",
    label: "Requests",
    path: "/admin/requests",
    icon: Inbox,
    description: "Submit leave, forgot punch, tool requisitions, and track requests.",
  },
  {
    key: "hrms",
    label: "Team Management",
    path: "/admin/hrms",
    icon: Users,
    description: "Account onboarding, team attendance, shifts, roster, leaves & approvals.",
  },
  {
    key: "customer",
    label: "Customer",
    path: "/admin/customer-hub",
    icon: Building2,
    description: "Client directory, onboarding, machine deployments, and customer services.",
  },
  {
    key: "projects",
    label: "Projects",
    path: "/admin/projects",
    icon: FolderKanban,
    description: "Manufacturing and site project allocations.",
  },
  {
    key: "inventory",
    label: "Inventory",
    path: "/admin/inventory",
    icon: Package,
    description: "Store management, stock in/out, and materials tracking.",
  },
  {
    key: "roles-access",
    label: "Roles & Access",
    path: "/admin/roles-access",
    icon: ShieldCheck,
    description: "Configure custom employee roles and granular module & action permissions.",
  },
];

export const getAdminModulesByPermissions = (permissions) => {
  if (!permissions || Object.keys(permissions).length === 0) {
    return adminModules;
  }
  return adminModules.filter((module) => {
    if (
      module.key === "overview" ||
      module.key === "mark-attendance" ||
      module.key === "attendance" ||
      module.key === "requests" ||
      module.key === "hrms" ||
      module.key === "customer" ||
      module.key === "projects" ||
      module.key === "inventory" ||
      module.key === "roles-access"
    )
      return true;
    if (permissions[module.key]?.canView || permissions[module.key] === true) return true;
    return false;
  });
};


