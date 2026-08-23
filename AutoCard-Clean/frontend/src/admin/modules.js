import {
  LayoutDashboard,
  UserPlus,
  Users,
  Inbox,
  ClipboardList,
  CalendarDays,
  Clock,
  FolderKanban,
  Wrench,
  ShieldCheck,
  Building2,
  CalendarRange,
} from "lucide-react";

// Single source of truth for admin modules.
// Sidebar navigation and routes are both generated from this list.
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
    label: "Employee",
    path: "/admin/employee",
    icon: UserPlus,
    description: "Create and manage employee records.",
  },
  {
    key: "customer",
    label: "Customer",
    path: "/admin/customer",
    icon: Users,
    description: "Create and manage customer records.",
  },
  {
    key: "requests",
    label: "Requests",
    path: "/admin/requests",
    icon: Inbox,
    description: "Review and act on incoming employee requests.",
  },
  {
    key: "leave-requests",
    label: "Leave Requests",
    path: "/admin/leave-requests",
    icon: CalendarDays,
    description: "Review and approve employee leave applications.",
  },
  {
    key: "leave-policy",
    label: "Leave Policy",
    path: "/admin/leave-policy",
    icon: ClipboardList,
    description: "Define leave types, balances, and rules.",
  },
  {
    key: "holidays",
    label: "Holidays",
    path: "/admin/holidays",
    icon: CalendarDays,
    description: "Manage the company holiday calendar.",
  },
  {
    key: "attendance",
    label: "Attendance",
    path: "/admin/attendance",
    icon: Clock,
    description: "Track and review employee attendance.",
  },
  {
    key: "projects",
    label: "Projects",
    path: "/admin/projects",
    icon: FolderKanban,
    description: "Create projects and assign team members.",
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
