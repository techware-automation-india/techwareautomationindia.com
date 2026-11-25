import {
  LayoutDashboard,
  Fingerprint,
  Clock,
  FileText,
  Users,
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
  Package,
} from "lucide-react";

// Default modules always visible to employees
const defaultModules = [
  {
    key: "overview",
    label: "Dashboard",
    path: "/employee",
    icon: LayoutDashboard,
    description: "Your personal dashboard overview.",
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
    description: "View your personal attendance history.",
  },
  {
    key: "requests",
    label: "Requests",
    path: "/employee/requests",
    icon: FileText,
    description: "Submit and track requests.",
  },
];

// Admin modules that can be delegated to employees via custom roles or permissions
const adminModules = [
  {
    key: "hrms",
    label: "Team Management",
    path: "/employee/hrms",
    icon: Users,
    description: "Account onboarding, team attendance, shifts, roster, leaves & approvals hub.",
    adminKey: "hrms",
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
  {
    key: "inventory",
    label: "Inventory",
    path: "/employee/inventory",
    icon: Package,
    description: "Manage inventory, inward stock, and outward dispatches.",
    adminKey: "inventory",
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
    // Only the 4 core employee modules are always visible by default:
    // 1. Dashboard (overview)
    // 2. Mark Attendance (mark-attendance)
    // 3. Attendance history (attendance)
    // 4. Requests (requests)
    if (
      module.key === "overview" ||
      module.key === "mark-attendance" ||
      module.key === "attendance" ||
      module.key === "requests"
    ) {
      if (!allowedModules.some((m) => m.path === module.path || m.key === module.key)) {
        allowedModules.push(module);
      }
      return;
    }

    const checkHasView = (val) => {
      if (!val) return false;
      if (val === true) return true;
      if (typeof val === "object") return val.canView === true;
      return false;
    };

    // Check direct key, adminKey, or aliases
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

    // Requests parent key: check direct requests or any requests-* submodule
    if (module.key === "requests") {
      const hasRequestsSub =
        checkHasView(permissions["requests"]) ||
        checkHasView(permissions["requests-apply-leave"]) ||
        checkHasView(permissions["requests-forgot-punch"]) ||
        checkHasView(permissions["requests-tools-inventory"]) ||
        checkHasView(permissions["requests-track"]);
      if (hasRequestsSub) perm = true;
    }

    // Approvals parent key: check direct approvals or approvals-* submodule
    if (module.key === "approvals") {
      const hasApprovalsSub =
        checkHasView(permissions["approvals"]) ||
        checkHasView(permissions["approvals-leave"]) ||
        checkHasView(permissions["approvals-attendance"]) ||
        checkHasView(permissions["approvals-forgot-punch"]) ||
        checkHasView(permissions["approvals-tools-inventory"]) ||
        checkHasView(permissions["approvals-tools"]);
      perm = hasApprovalsSub ? true : null;
    }

    // Leave policy parent key: check direct or submodules
    if (module.key === "leave-policy") {
      const hasLeavePolicySub =
        checkHasView(permissions["leave-policy"]) ||
        checkHasView(permissions["leave-policy-types"]) ||
        checkHasView(permissions["leave-policy-holidays"]);
      if (hasLeavePolicySub) perm = true;
    }

    // Inventory parent key: check direct inventory or submodules
    if (module.key === "inventory") {
      const hasInventorySub =
        checkHasView(permissions["inventory"]) ||
        checkHasView(permissions["inventory-in"]) ||
        checkHasView(permissions["inventory-out"]) ||
        checkHasView(permissions["inventory-approval"]) ||
        checkHasView(permissions["view-inventory"]) ||
        checkHasView(permissions["inventory-alert"]) ||
        checkHasView(permissions["general-consumables"]) ||
        checkHasView(permissions["approvals-tools-inventory"]);
      if (hasInventorySub) perm = true;
    }

    // Roles & Access: Never show in employee sidebar under any circumstances
    if (module.key === "roles-access") {
      perm = null;
    }

    // Team Management (hrms): Show if user has 'hrms' OR any of its submodules (employee, attendance-management, shift-location, roster, leave-policy, approvals)
    if (module.key === "hrms") {
      const hasHrmsAccess =
        checkHasView(permissions["hrms"]) ||
        checkHasView(permissions["employee"]) ||
        checkHasView(permissions["attendance-management"]) ||
        checkHasView(permissions["shift-location"]) ||
        checkHasView(permissions["roster"]) ||
        checkHasView(permissions["leave-policy"]) ||
        checkHasView(permissions["approvals"]) ||
        checkHasView(permissions["approvals-leave"]) ||
        checkHasView(permissions["approvals-attendance"]) ||
        checkHasView(permissions["approvals-forgot-punch"]) ||
        checkHasView(permissions["approvals-tools-inventory"]);
      perm = hasHrmsAccess ? true : null;
    }

    // Assigned Projects: require permission on 'assigned-projects' or 'projects'
    if (module.key === "assigned-projects" || module.key === "projects") {
      perm = permissions["assigned-projects"] || permissions["projects"];
    }

    if (module.key === "my-projects") {
      perm = permissions["my-projects"] || permissions["customer-projects"];
    }

    const isAllowed = checkHasView(perm);

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
