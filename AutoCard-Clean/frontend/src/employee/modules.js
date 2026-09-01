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
    description: "View your attendance history.",
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

// Admin modules that can be assigned to employees
const adminModules = [
  // {
  //   key: "employee",
  //   label: "Employee Management",
  //   path: "/employee/employee-management",
  //   icon: UserCog,
  //   description: "Manage employee records.",
  //   adminKey: "employee",
  // },
  // {
  //   key: "customer",
  //   label: "Customer Management",
  //   path: "/employee/customer-management",
  //   icon: Contact,
  //   description: "Manage customer accounts.",
  //   adminKey: "customer",
  // },
  // {
  //   key: "requests",
  //   label: "Requests",
  //   path: "/employee/requests",
  //   icon: FileText,
  //   description: "View and manage requests.",
  //   adminKey: "requests",
  // },
  // {
  //   key: "leave-policy",
  //   label: "Leave Policy",
  //   path: "/employee/leave-policy",
  //   icon: BookOpen,
  //   description: "Leave types and policies.",
  //   adminKey: "leave-policy",
  // },
  // {
  //   key: "projects",
  //   label: "Projects",
  //   path: "/employee/projects",
  //   icon: FolderKanban,
  //   description: "Project management.",
  //   adminKey: "projects",
  // },
 
  // {
  //   key: "shift-location",
  //   label: "Shift & Location",
  //   path: "/employee/shift-location",
  //   icon: MapPin,
  //   description: "Shift and location management.",
  //   adminKey: "shift-location",
  // },
  // {
  //   key: "roster",
  //   label: "Roster",
  //   path: "/employee/roster",
  //   icon: CalendarRange,
  //   description: "Employee scheduling.",
  //   adminKey: "roster",
  // },
];

// All modules combined
export const employeeModules = [...defaultModules, ...adminModules];

/**
 * Get modules to display based on employee permissions
 * @param {Object} permissions - Permission object from API
 * @returns {Array} - Array of module objects to display
 */
export function getModulesByPermissions(permissions) {
  // Always include default modules
  const modules = [...defaultModules];

  // Add admin modules if employee has at least 'canView' permission
  adminModules.forEach((module) => {
    const perm = permissions[module.adminKey];
    if (perm && perm.canView) {
      modules.push(module);
    }
  });

  return modules;
}
