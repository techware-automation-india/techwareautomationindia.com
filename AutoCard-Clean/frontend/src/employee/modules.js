import {
  LayoutDashboard,
  ClipboardList,
  Fingerprint,
  Clock,
  Plane,
  CalendarDays,
  ShieldCheck,
} from "lucide-react";

// Single source of truth for employee modules.
// Sidebar navigation and routes are both generated from this list.
export const employeeModules = [
  {
    key: "overview",
    label: "Dashboard",
    path: "/employee",
    icon: LayoutDashboard,
    description: "Your personal dashboard overview.",
  },
  {
    key: "onboarding",
    label: "Onboarding Form",
    path: "/employee/onboarding",
    icon: ClipboardList,
    description: "Complete your onboarding details.",
  },
  {
    key: "mark-attendance",
    label: "Mark Attendance",
    path: "/employee/mark-attendance",
    icon: Fingerprint,
    description: "Check in and check out for the day.",
  },
  {
    key: "attendance",
    label: "Attendance",
    path: "/employee/attendance",
    icon: Clock,
    description: "View your attendance history.",
  },
  {
    key: "leave",
    label: "Leave",
    path: "/employee/leave",
    icon: Plane,
    description: "Apply for and track your leave.",
  },
  {
    key: "holidays",
    label: "Holidays",
    path: "/employee/holidays",
    icon: CalendarDays,
    description: "View company holiday calendar.",
  },
  {
    key: "access-modules",
    label: "Access Modules",
    path: "/employee/access-modules",
    icon: ShieldCheck,
    description: "View your assigned module permissions.",
  },
];
