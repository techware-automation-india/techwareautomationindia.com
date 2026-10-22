import { getAuthUser } from "./auth.js";

/**
 * Check if the currently logged-in user has access to a module or sub-module key
 * @param {string} key - Module key (e.g. 'mark-attendance', 'requests-forgot-punch', 'approvals-leave')
 * @returns {boolean}
 */
export function hasModuleAccess(key) {
  const user = getAuthUser();
  if (!user) return false;
  if (user.role === "ADMIN") return true;

  // Base employee modules that are allowed by default for all authenticated employees
  const defaultBaseKeys = [
    "overview",
    "mark-attendance",
    "attendance",
    "requests",
    "requests-apply-leave",
    "requests-forgot-punch",
    "requests-tools-inventory",
    "requests-track",
    "leave",
    "my-tools",
    "my-projects",
    "academic-calendar",
    "academic-holidays",
  ];

  try {
    const cached = localStorage.getItem("employee_permissions");
    if (!cached) {
      // If no permissions cached yet, default to allowing base employee keys
      if (user.role === "EMPLOYEE") return defaultBaseKeys.includes(key);
      return true;
    }

    const perms = JSON.parse(cached);
    if (!perms || Object.keys(perms).length === 0) return true; // Legacy/unconfigured account

    // Check direct key
    if (perms[key]) {
      const p = perms[key];
      if (p === true || p.canView === true || (typeof p === "object" && Object.values(p).some(Boolean))) {
        return true;
      }
    }

    // Check sub-key mapping
    if (key === "requests-apply-leave" && (perms["requests-apply-leave"] || perms["requests"] || perms["leave"])) return true;
    if (key === "requests-forgot-punch" && (perms["requests-forgot-punch"] || perms["requests"])) return true;
    if (key === "requests-tools-inventory" && (
      perms["requests-tools-inventory"] ||
      perms["requests"] ||
      perms["inventory"] ||
      perms["inventory-request"] ||
      perms["general-consumables"] ||
      perms["my-tools"] ||
      user.role === "EMPLOYEE"
    )) return true;
    if (key === "requests-track" && (perms["requests-track"] || perms["requests"])) return true;

    if (key === "approvals-leave" && (perms["approvals-leave"] || perms["approvals"])) return true;
    if (key === "approvals-attendance" && (perms["approvals-attendance"] || perms["approvals"])) return true;
    if (key === "approvals-forgot-punch" && (perms["approvals-forgot-punch"] || perms["approvals"])) return true;
    if (key === "approvals-tools-inventory" && (perms["approvals-tools-inventory"] || perms["approvals-tools"] || perms["approvals"])) return true;

    if (key === "leave-policy-types" && (perms["leave-policy-types"] || perms["leave-policy"])) return true;
    if (key === "leave-policy-holidays" && (perms["leave-policy-holidays"] || perms["leave-policy"])) return true;

    const checkValCanView = (val) => {
      if (!val) return false;
      if (val === true) return true;
      if (typeof val === "object") return val.canView === true;
      return false;
    };

    if (key === "inventory") {
      if (perms["inventory"] && checkValCanView(perms["inventory"])) {
        return true;
      }
      return Object.keys(perms).some((k) => 
        (k.startsWith("inventory-") || k.startsWith("view-inventory") || k.startsWith("general-consumables")) &&
        (checkValCanView(perms[k]) || checkValCanView(perms[`${k}:view`]))
      );
    }

    if (key.startsWith("inventory-") || key === "view-inventory" || key === "general-consumables") {
      if (perms[key] && checkValCanView(perms[key])) return true;
      if (perms[`${key}:view`] && checkValCanView(perms[`${key}:view`])) return true;
      return false;
    }

    // Check parent fallback if checking a generic sub-module
    if (key.startsWith("requests-") && perms["requests"]) return true;
    if (key.startsWith("approvals-") && perms["approvals"]) return true;
    if (key.startsWith("leave-policy-") && perms["leave-policy"]) return true;

    // For base employee keys: allow by default if user is an employee unless explicitly disabled
    if (user.role === "EMPLOYEE" && defaultBaseKeys.includes(key)) {
      const p = perms[key];
      if (p && typeof p === "object" && p.canView === false && !perms["requests"] && !perms["inventory"]) {
        return false;
      }
      return true;
    }

    return false;
  } catch (err) {
    return true;
  }
}

/**
 * Check if the currently logged-in user can perform a specific action on a module/submodule
 * @param {string} moduleKey - e.g. 'inventory-in', 'inventory-out', 'view-inventory', 'inventory-approval', 'inventory-alert', 'general-consumables'
 * @param {string} action - 'view' | 'create' | 'edit' | 'delete' | 'action'
 * @returns {boolean}
 */
export function canPerformAction(moduleKey, action = "view") {
  const user = getAuthUser();
  if (!user) return false;
  if (user.role === "ADMIN" || user.customRole?.name?.toUpperCase() === "ADMIN") return true;

  try {
    const rawModules = user.customRole?.modules || [];
    const roleKeys = Array.isArray(rawModules)
      ? rawModules.map((m) => (typeof m === "string" ? m : m.moduleKey))
      : [];

    const fullActionKey = `${moduleKey}:${action}`;

    // 1. Direct role action check
    if (roleKeys.includes(fullActionKey)) {
      return true;
    }

    // 2. Check cached employee_permissions
    const cached = localStorage.getItem("employee_permissions");
    if (cached) {
      const perms = JSON.parse(cached);
      if (perms[fullActionKey] === true) return true;
      if (perms[moduleKey] && typeof perms[moduleKey] === "object") {
        if (action === "create" && perms[moduleKey].canCreate === true) return true;
        if (action === "edit" && perms[moduleKey].canEdit === true) return true;
        if (action === "delete" && perms[moduleKey].canDelete === true) return true;
        if ((action === "view" || action === "action") && (perms[moduleKey].canView === true || perms[moduleKey].canEdit === true)) return true;
      }
    }

    // 3. For 'view' action: fallback to hasModuleAccess
    if (action === "view") {
      return hasModuleAccess(moduleKey);
    }

    // For create, edit, delete: strictly false unless explicitly granted
    return false;
  } catch (err) {
    return false;
  }
}

