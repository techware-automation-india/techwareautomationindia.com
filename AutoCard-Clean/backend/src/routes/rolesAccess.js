import { Router } from "express";
import { z } from "zod";
import prisma from "../prismaClient.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

const EMPLOYEE_ROLE = "EMPLOYEE";

const employeeModules = [
  { key: "overview", label: "Dashboard" },
  { key: "mark-attendance", label: "Mark Attendance" },
  { key: "attendance", label: "My Attendance" },
  { key: "attendance-management", label: "Team Attendance (All Employees)" },
  { key: "employee", label: "Add Account" },
  { key: "requests", label: "Requests" },
  { key: "requests-apply-leave", label: "Apply for Leave" },
  { key: "requests-forgot-punch", label: "Forgot Punch" },
  { key: "requests-tools-inventory", label: "Request Tools / Inventory" },
  { key: "requests-track", label: "Track My Requests" },
  { key: "approvals", label: "All Approvals (Full Admin)" },
  { key: "approvals-leave", label: "Leave Approvals" },
  { key: "approvals-attendance", label: "Unassign Location Approvals" },
  { key: "approvals-forgot-punch", label: "Forgot Punch Approvals" },
  { key: "approvals-tools-inventory", label: "Tools & Inventory Approvals" },
  { key: "approvals-tools", label: "Tools Approvals" },
  { key: "leave-policy", label: "Leave Policy & Holiday" },
  { key: "leave-policy-types", label: "Leave Policy" },
  { key: "leave-policy-holidays", label: "Holiday Calendar" },
  { key: "academic-calendar", label: "Academic Calendar" },
  { key: "academic-holidays", label: "Academic Holidays" },
  { key: "holidays", label: "Holidays" },
  { key: "projects", label: "Projects" },
  { key: "assigned-projects", label: "Assigned Projects" },
  { key: "my-projects", label: "My Projects" },
  { key: "services", label: "Services" },
  { key: "inventory", label: "Inventory" },
  { key: "inventory-in", label: "Material Inward" },
  { key: "inventory-out", label: "Material Outward" },
  { key: "view-inventory", label: "View Stock" },
  { key: "inventory-alert", label: "Stock Alerts" },
  { key: "general-consumables", label: "Tools & Consumables" },
  { key: "roles-access", label: "Roles & Access" },
  { key: "shift-location", label: "Shift & Location" },
  { key: "roster", label: "Roster" },
];


const permissionSchema = z.object({
  canView: z.boolean().optional(),
  canCreate: z.boolean().optional(),
  canEdit: z.boolean().optional(),
  canDelete: z.boolean().optional(),
});

const permissionsPayloadSchema = z.object({
  permissions: z.record(z.string(), permissionSchema),
});

const employeeParamSchema = z.object({
  userId: z.string().min(1, "Employee is required."),
});

function serializeEmployee(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    isActive: user.isActive,
    employeeCode: user.employeeProfile?.employeeCode ?? null,
    onboardingStatus: user.employeeProfile?.onboardingStatus ?? null,
  };
}
function buildPermissionMap(rows) {
  const map = {};

  for (const row of rows) {
    map[row.moduleKey] = {
      canView: row.canView,
      canCreate: row.canCreate,
      canEdit: row.canEdit,
      canDelete: row.canDelete,
    };
  }

  return map;
}

router.get("/me/permissions", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        customRole: {
          include: {
            modules: true,
          },
        },
      },
    });

    let roleModules = user?.customRole?.modules || [];
    if (roleModules.length === 0 && user?.roleId) {
      roleModules = await prisma.roleModule.findMany({
        where: { roleId: user.roleId },
      });
    }

    const legacyPermissions = await prisma.modulePermission.findMany({ where: { userId: req.user.id } });
    const permissionMap = buildPermissionMap(legacyPermissions);

    if (roleModules.length > 0) {
      // First pass: collect all action permissions
      const hasActionKeyForSub = {};
      for (const m of roleModules) {
        if (m.moduleKey.includes(":")) {
          const [subKey] = m.moduleKey.split(":");
          hasActionKeyForSub[subKey] = true;
        }
      }

      for (const m of roleModules) {
        if (m.moduleKey.includes(":")) {
          const [subKey, act] = m.moduleKey.split(":");
          if (!permissionMap[subKey]) {
            permissionMap[subKey] = {
              canView: false,
              canCreate: false,
              canEdit: false,
              canDelete: false,
            };
          }
          if (act === "view") permissionMap[subKey].canView = true;
          if (act === "create") permissionMap[subKey].canCreate = true;
          if (act === "edit") permissionMap[subKey].canEdit = true;
          if (act === "delete") permissionMap[subKey].canDelete = true;
          permissionMap[m.moduleKey] = true;
        } else {
          // If this key already has granular action keys (e.g. employee:view), bare 'employee' should NOT grant canCreate/canEdit/canDelete!
          if (!hasActionKeyForSub[m.moduleKey]) {
            // Legacy / simple assignment without granular actions: default to full permissions
            if (!permissionMap[m.moduleKey]) {
              permissionMap[m.moduleKey] = {
                canView: true,
                canCreate: true,
                canEdit: true,
                canDelete: true,
              };
            }
          } else {
            // Granular actions exist; bare moduleKey just ensures canView is at least true
            if (!permissionMap[m.moduleKey]) {
              permissionMap[m.moduleKey] = {
                canView: true,
                canCreate: false,
                canEdit: false,
                canDelete: false,
              };
            } else {
              permissionMap[m.moduleKey].canView = true;
            }
          }
        }
      }

      // If user has any submodule view permission, ensure parent module is granted
      const subKeyToParent = [
        {
          parent: "inventory",
          subKeys: ["inventory-in", "inventory-out", "view-inventory", "inventory-alert", "general-consumables"],
        },
        {
          parent: "requests",
          subKeys: ["requests-apply-leave", "requests-forgot-punch", "requests-tools-inventory", "requests-track"],
        },
        {
          parent: "approvals",
          subKeys: ["approvals-leave", "approvals-attendance", "approvals-forgot-punch", "approvals-tools-inventory", "approvals-tools"],
        },
        {
          parent: "leave-policy",
          subKeys: ["leave-policy-types", "leave-policy-holidays"],
        },
      ];

      for (const group of subKeyToParent) {
        const hasAnySub = group.subKeys.some((k) => permissionMap[k]?.canView || permissionMap[`${k}:view`]);
        if (hasAnySub) {
          if (!permissionMap[group.parent]) {
            permissionMap[group.parent] = {
              canView: true,
              canCreate: false,
              canEdit: false,
              canDelete: false,
            };
          } else {
            permissionMap[group.parent].canView = true;
          }
        } else if (group.parent !== "requests") {
          // If no submodule has view access, non-default parent module must not be visible
          if (permissionMap[group.parent]) {
            permissionMap[group.parent].canView = false;
          }
        }
      }

      // Base employee modules: ensure default permissions are always granted for employees
      const baseEmployeeModules = [
        "mark-attendance",
        "attendance",
        "requests",
        "requests-apply-leave",
        "requests-forgot-punch",
        "requests-tools-inventory",
        "requests-track",
        "overview",
        "academic-calendar",
        "academic-holidays",
      ];

      for (const baseKey of baseEmployeeModules) {
        if (!permissionMap[baseKey] || !permissionMap[baseKey].canView) {
          permissionMap[baseKey] = {
            canView: true,
            canCreate: true,
            canEdit: true,
            canDelete: true,
          };
        }
      }

      if (req.user?.role === "ADMIN") {
        permissionMap["overview"] = {
          canView: true,
          canCreate: true,
          canEdit: true,
          canDelete: true,
        };
      }
    } else if (req.user?.role === "ADMIN") {
      for (const m of employeeModules) {
        permissionMap[m.key] = {
          canView: true,
          canCreate: true,
          canEdit: true,
          canDelete: true,
        };
      }
    }

    const hasConfiguredPermissions = legacyPermissions.length > 0 || roleModules.length > 0;

    let roleName = user?.customRole?.name || null;
    if (!roleName && user?.roleId) {
      const r = await prisma.roleTable.findUnique({ where: { id: user.roleId } });
      if (r) roleName = r.name;
    }

    res.json({
      role: user?.role || req.user?.role,
      roleName: roleName || (user?.role === "ADMIN" ? "Admin" : user?.role === "CUSTOMER" ? "Customer" : "Employee"),
      roleId: user?.roleId || null,
      modules: employeeModules,
      permissions: permissionMap,
      hasConfiguredPermissions,
    });
  } catch (err) {
    console.error("RolesAccess get current permissions error:", err);
    res.status(500).json({ message: "Failed to load permissions." });
  }
});

router.use(requireAuth, requireRole("ADMIN"));

router.get("/employees", async (_req, res) => {
  try {
    const employees = await prisma.user.findMany({
      where: { role: EMPLOYEE_ROLE },
      include: { employeeProfile: true },
      orderBy: { fullName: "asc" },
    });

    res.json({
      employees: employees.map(serializeEmployee),
      modules: employeeModules,
    });
  } catch (err) {
    console.error("RolesAccess list employees error:", err);
    res.status(500).json({ message: "Failed to load employees." });
  }
});

router.get("/employees/:userId/permissions", async (req, res) => {
  const parsedParams = employeeParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: parsedParams.error.issues[0].message });
  }

  const { userId } = parsedParams.data;

  try {
    const employee = await prisma.user.findFirst({
      where: { id: userId, role: EMPLOYEE_ROLE },
      include: { employeeProfile: true },
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found." });
    }

    const permissions = await prisma.modulePermission.findMany({ where: { userId } });
    res.json({
      role: EMPLOYEE_ROLE,
      employee: serializeEmployee(employee),
      modules: employeeModules,
      permissions: buildPermissionMap(permissions),
      hasConfiguredPermissions: permissions.length > 0,
    });
  } catch (err) {
    console.error("RolesAccess get employee permissions error:", err);
    res.status(500).json({ message: "Failed to load permissions." });
  }
});

router.patch("/employees/:userId/permissions", async (req, res) => {
  const parsedParams = employeeParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ message: parsedParams.error.issues[0].message });
  }

  const parsedBody = permissionsPayloadSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ message: parsedBody.error.issues[0].message });
  }

  const { userId } = parsedParams.data;
  const allowedModuleKeys = new Set(employeeModules.map((module) => module.key));
  const permissions = Object.entries(parsedBody.data.permissions).filter(([moduleKey]) =>
    allowedModuleKeys.has(moduleKey),
  );

  try {
    const employee = await prisma.user.findFirst({
      where: { id: userId, role: EMPLOYEE_ROLE },
      include: { employeeProfile: true },
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found." });
    }

    await prisma.$transaction(
      permissions.map(([moduleKey, permission]) =>
        prisma.modulePermission.upsert({
          where: { userId_moduleKey: { userId, moduleKey } },
          create: {
            userId,
            moduleKey,
            canView: permission.canView ?? false,
            canCreate: permission.canCreate ?? false,
            canEdit: permission.canEdit ?? false,
            canDelete: permission.canDelete ?? false,
          },
          update: {
            canView: permission.canView ?? false,
            canCreate: permission.canCreate ?? false,
            canEdit: permission.canEdit ?? false,
            canDelete: permission.canDelete ?? false,
          },
        }),
      ),
    );

    console.log("[RolesAccess] Admin updated module permissions:", {
      adminId: req.user?.id,
      adminEmail: req.user?.email,
      employeeId: employee.id,
      employeeEmail: employee.email,
      employeeName: employee.fullName,
      updatedPermissions: permissions.reduce((memo, [moduleKey, permission]) => {
        memo[moduleKey] = {
          canView: permission.canView ?? false,
          canCreate: permission.canCreate ?? false,
          canEdit: permission.canEdit ?? false,
          canDelete: permission.canDelete ?? false,
        };
        return memo;
      }, {}),
    });

    const updated = await prisma.modulePermission.findMany({ where: { userId } });
    res.json({
      role: EMPLOYEE_ROLE,
      employee: serializeEmployee(employee),
      modules: employeeModules,
      permissions: buildPermissionMap(updated),
      hasConfiguredPermissions: updated.length > 0,
    });
  } catch (err) {
    console.error("RolesAccess update permissions error:", err);
    res.status(500).json({ message: "Failed to save permissions." });
  }
});

/**
 * Submodule mapping for all modules in system
 */
const MODULE_SUBMODULE_MAP = {
  inventory: [
    { key: "inventory-in", label: "Inventory In" },
    { key: "inventory-out", label: "Inventory Out" },
    { key: "view-inventory", label: "View Stock" },
    { key: "inventory-alert", label: "Stock Alerts" },
    { key: "general-consumables", label: "Tools & Consumables" },
  ],
  requests: [
    { key: "requests-apply-leave", label: "Apply for Leave" },
    { key: "requests-forgot-punch", label: "Forgot Punch / Time Edit" },
    { key: "requests-tools-inventory", label: "Request Tools / Inventory" },
    { key: "requests-track", label: "Track All Requests" },
  ],
  approvals: [
    { key: "approvals-leave", label: "Leave Approval" },
    { key: "approvals-attendance", label: "Unassign Location Approval" },
    { key: "approvals-forgot-punch", label: "Forgot Punch Approval" },
    { key: "approvals-tools-inventory", label: "Tools & Inventory Approval" },
  ],
  "leave-policy": [
    { key: "leave-policy-types", label: "Leave Policy" },
    { key: "leave-policy-holidays", label: "Holiday Calendar" },
  ],
};

/**
 * GET /roles-access/module-permissions?module=<moduleKey>
 * Returns all active users and their granular permissions (canView, canCreate, canEdit, canDelete)
 * for the requested parent module or submodule.
 */
router.get("/module-permissions", async (req, res) => {
  try {
    const parentKey = req.query.module || "all";

    const users = await prisma.user.findMany({
      where: { isActive: true },
      include: {
        customRole: {
          include: {
            modules: true,
          },
        },
        modulePermissions: true,
      },
      orderBy: { fullName: "asc" },
    });

    const employees = users.map((u) => {
      const isAdmin = u.role === "ADMIN";
      const roleModules = (u.customRole?.modules || []).map((m) => m.moduleKey);

      // Build permissions per module and submodule
      const permissions = {};

      const checkSubPerms = (key, parentKeyFallback = null) => {
        if (isAdmin) {
          return { canView: true, canCreate: true, canEdit: true, canDelete: true };
        }
        const hasDirect = roleModules.includes(key);
        const canView = hasDirect || roleModules.includes(`${key}:view`);
        const canCreate = roleModules.includes(`${key}:create`);
        const canEdit = roleModules.includes(`${key}:edit`);
        const canDelete = roleModules.includes(`${key}:delete`);

        const legacy = u.modulePermissions?.find((mp) => mp.moduleKey === key);

        return {
          canView: canView || Boolean(legacy?.canView),
          canCreate: canCreate || Boolean(legacy?.canCreate),
          canEdit: canEdit || Boolean(legacy?.canEdit),
          canDelete: canDelete || Boolean(legacy?.canDelete),
        };
      };

      // Check standard top-level modules
      const allTopKeys = [
        "overview",
        "employee",
        "requests",
        "approvals",
        "mark-attendance",
        "attendance",
        "attendance-management",
        "roles-access",
        "shift-location",
        "roster",
        "leave-policy",
        "projects",
        "inventory",
      ];

      allTopKeys.forEach((k) => {
        permissions[k] = checkSubPerms(k);
      });

      // Check all submodules
      Object.entries(MODULE_SUBMODULE_MAP).forEach(([parent, subs]) => {
        subs.forEach((sub) => {
          permissions[sub.key] = checkSubPerms(sub.key, parent);
        });
      });

      return {
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        roleId: u.roleId,
        roleName: u.customRole?.name || (isAdmin ? "Admin" : "Employee"),
        isAdmin,
        permissions,
      };
    });

    res.json({
      employees,
      moduleSubmodules: MODULE_SUBMODULE_MAP,
    });
  } catch (err) {
    console.error("Failed to load module permissions:", err);
    res.status(500).json({ message: "Failed to load module permissions." });
  }
});

/**
 * PUT /roles-access/module-permissions/:userId
 * Updates an employee's permissions across modules/submodules.
 * Creates an isolated custom role if the user was on a shared/default role.
 */
router.put("/module-permissions/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { permissions, defaultModules } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        customRole: {
          include: {
            modules: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.role === "ADMIN") {
      return res.status(400).json({ message: "Admin users have full access by default." });
    }

    if (!permissions || typeof permissions !== "object") {
      return res.status(400).json({ message: "Invalid permissions object." });
    }

    let targetRoleId = user.roleId;

    if (targetRoleId) {
      const isDefault = user.customRole?.isDefault;
      const otherUsersCount = await prisma.user.count({
        where: {
          roleId: targetRoleId,
          id: { not: userId },
        },
      });

      if (isDefault || otherUsersCount > 0) {
        const empName = user.fullName || "Employee";
        let roleName = `${empName}`;
        // Check if roleName already exists, if so append user ID slice
        const existingRole = await prisma.roleTable.findUnique({ where: { name: roleName } });
        if (existingRole) {
          roleName = `${empName}-${userId.slice(0, 4)}`;
        }
        const newRole = await prisma.roleTable.upsert({
          where: { name: roleName },
          update: {},
          create: {
            name: roleName,
            isDefault: false,
          },
        });
        targetRoleId = newRole.id;
        await prisma.user.update({
          where: { id: userId },
          data: { roleId: targetRoleId },
        });
      }
    } else {
      const empName = user.fullName || "Employee";
      let roleName = `${empName}`;
      const existingRole = await prisma.roleTable.findUnique({ where: { name: roleName } });
      if (existingRole) {
        roleName = `${empName}-${userId.slice(0, 4)}`;
      }
      const newRole = await prisma.roleTable.upsert({
        where: { name: roleName },
        update: {},
        create: {
          name: roleName,
          isDefault: false,
        },
      });
      targetRoleId = newRole.id;
      await prisma.user.update({
        where: { id: userId },
        data: { roleId: targetRoleId },
      });
    }

    if (targetRoleId) {
      const existingModules = (user.customRole?.modules || []).map((m) => m.moduleKey);
      const incomingKeys = Object.keys(permissions);

      // Remove existing permissions that are being overwritten
      let newModules = existingModules.filter((k) => {
        const baseKey = k.includes(":") ? k.split(":")[0] : k;
        return !incomingKeys.includes(baseKey) && !incomingKeys.includes(k);
      });

      // Add new permissions
      incomingKeys.forEach((key) => {
        const p = permissions[key];
        if (!p) return;
        if (p.canView) {
          newModules.push(key);
          newModules.push(`${key}:view`);
        }
        if (p.canCreate) {
          newModules.push(`${key}:create`);
        }
        if (p.canEdit) {
          newModules.push(`${key}:edit`);
        }
        if (p.canDelete) {
          newModules.push(`${key}:delete`);
        }
      });

      // Synchronize parent modules:
      // 1. If any submodule has view permission, grant the parent module
      // 2. If NO submodule has view permission for a parent module, ensure the parent module is REMOVED from newModules
      Object.entries(MODULE_SUBMODULE_MAP).forEach(([parent, subs]) => {
        const subKeys = subs.map((s) => s.key);
        const hasSubView = subKeys.some((sk) => newModules.includes(sk) || newModules.includes(`${sk}:view`));
        if (hasSubView) {
          if (!newModules.includes(parent)) {
            newModules.push(parent);
          }
        } else {
          // If no submodule has view, strip parent and parent actions from newModules
          newModules = newModules.filter((k) => k !== parent && !k.startsWith(`${parent}:`));
        }
      });

      // Sync roleModule records
      await prisma.roleModule.deleteMany({
        where: { roleId: targetRoleId },
      });

      const uniqueModules = [...new Set(newModules)];
      await prisma.roleModule.createMany({
        data: uniqueModules.map((moduleKey) => ({
          roleId: targetRoleId,
          moduleKey,
        })),
      });

      // Sync legacy modulePermissions table for immediate fallback
      for (const [key, perms] of Object.entries(permissions)) {
        await prisma.modulePermission.upsert({
          where: { userId_moduleKey: { userId, moduleKey: key } },
          create: {
            userId,
            moduleKey: key,
            canView: Boolean(perms.canView),
            canCreate: Boolean(perms.canCreate),
            canEdit: Boolean(perms.canEdit),
            canDelete: Boolean(perms.canDelete),
          },
          update: {
            canView: Boolean(perms.canView),
            canCreate: Boolean(perms.canCreate),
            canEdit: Boolean(perms.canEdit),
            canDelete: Boolean(perms.canDelete),
          },
        });
      }

      // Also ensure parent records in modulePermission table are updated if all submodules revoked
      for (const [parent, subs] of Object.entries(MODULE_SUBMODULE_MAP)) {
        const subKeys = subs.map((s) => s.key);
        const hasSubView = subKeys.some((sk) => {
          const sp = permissions[sk];
          return sp ? Boolean(sp.canView) : false;
        });
        if (!hasSubView) {
          await prisma.modulePermission.upsert({
            where: { userId_moduleKey: { userId, moduleKey: parent } },
            create: {
              userId,
              moduleKey: parent,
              canView: false,
              canCreate: false,
              canEdit: false,
              canDelete: false,
            },
            update: {
              canView: false,
              canCreate: false,
              canEdit: false,
              canDelete: false,
            },
          });
        }
      }
    }

    res.json({ message: "Permissions updated successfully." });
  } catch (err) {
    console.error("Failed to update module permissions:", err);
    res.status(500).json({ message: "Failed to update module permissions." });
  }
});

/**
 * PUT /roles-access/module-permissions-batch
 * Batch saves updated permissions for multiple employees efficiently
 */
router.put("/module-permissions-batch", async (req, res) => {
  try {
    const { updates } = req.body; // array of { userId, permissions }
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.json({ message: "No updates to process." });
    }

    for (const item of updates) {
      const { userId, permissions } = item;
      if (!userId || !permissions) continue;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { customRole: { include: { modules: true } } },
      });
      if (!user || user.role === "ADMIN") continue;

      let targetRoleId = user.roleId;
      if (targetRoleId) {
        const isDefault = user.customRole?.isDefault;
        const otherUsersCount = await prisma.user.count({
          where: { roleId: targetRoleId, id: { not: userId } },
        });

        if (isDefault || otherUsersCount > 0) {
          const empName = user.fullName || "Employee";
          let roleName = `${empName}`;
          const existingRole = await prisma.roleTable.findUnique({ where: { name: roleName } });
          if (existingRole) roleName = `${empName}-${userId.slice(0, 4)}`;

          const newRole = await prisma.roleTable.upsert({
            where: { name: roleName },
            update: {},
            create: { name: roleName, isDefault: false },
          });
          targetRoleId = newRole.id;
          await prisma.user.update({
            where: { id: userId },
            data: { roleId: targetRoleId },
          });
        }
      } else {
        const empName = user.fullName || "Employee";
        let roleName = `${empName}`;
        const existingRole = await prisma.roleTable.findUnique({ where: { name: roleName } });
        if (existingRole) roleName = `${empName}-${userId.slice(0, 4)}`;

        const newRole = await prisma.roleTable.upsert({
          where: { name: roleName },
          update: {},
          create: { name: roleName, isDefault: false },
        });
        targetRoleId = newRole.id;
        await prisma.user.update({
          where: { id: userId },
          data: { roleId: targetRoleId },
        });
      }

      if (targetRoleId) {
        const existingModules = (user.customRole?.modules || []).map((m) => m.moduleKey);
        const incomingKeys = Object.keys(permissions);

        let newModules = existingModules.filter((k) => {
          const baseKey = k.includes(":") ? k.split(":")[0] : k;
          return !incomingKeys.includes(baseKey) && !incomingKeys.includes(k);
        });

        incomingKeys.forEach((key) => {
          const p = permissions[key];
          if (!p) return;
          if (p.canView) {
            newModules.push(key);
            newModules.push(`${key}:view`);
          }
          if (p.canCreate) newModules.push(`${key}:create`);
          if (p.canEdit) newModules.push(`${key}:edit`);
          if (p.canDelete) newModules.push(`${key}:delete`);
        });

        // Synchronize parent modules:
        // 1. If any submodule has view permission, grant the parent module
        // 2. If NO submodule has view permission for a parent module, ensure the parent module is REMOVED from newModules
        Object.entries(MODULE_SUBMODULE_MAP).forEach(([parent, subs]) => {
          const subKeys = subs.map((s) => s.key);
          const hasSubView = subKeys.some((sk) => newModules.includes(sk) || newModules.includes(`${sk}:view`));
          if (hasSubView) {
            if (!newModules.includes(parent)) {
              newModules.push(parent);
            }
          } else {
            newModules = newModules.filter((k) => k !== parent && !k.startsWith(`${parent}:`));
          }
        });

        await prisma.roleModule.deleteMany({
          where: { roleId: targetRoleId },
        });

        const uniqueModules = [...new Set(newModules)];
        await prisma.roleModule.createMany({
          data: uniqueModules.map((moduleKey) => ({
            roleId: targetRoleId,
            moduleKey,
          })),
        });

        for (const [key, perms] of Object.entries(permissions)) {
          await prisma.modulePermission.upsert({
            where: { userId_moduleKey: { userId, moduleKey: key } },
            create: {
              userId,
              moduleKey: key,
              canView: Boolean(perms.canView),
              canCreate: Boolean(perms.canCreate),
              canEdit: Boolean(perms.canEdit),
              canDelete: Boolean(perms.canDelete),
            },
            update: {
              canView: Boolean(perms.canView),
              canCreate: Boolean(perms.canCreate),
              canEdit: Boolean(perms.canEdit),
              canDelete: Boolean(perms.canDelete),
            },
          });
        }

        // Also ensure parent records in modulePermission table are updated if all submodules revoked
        for (const [parent, subs] of Object.entries(MODULE_SUBMODULE_MAP)) {
          const subKeys = subs.map((s) => s.key);
          const hasSubView = subKeys.some((sk) => {
            const sp = permissions[sk];
            return sp ? Boolean(sp.canView) : false;
          });
          if (!hasSubView) {
            await prisma.modulePermission.upsert({
              where: { userId_moduleKey: { userId, moduleKey: parent } },
              create: {
                userId,
                moduleKey: parent,
                canView: false,
                canCreate: false,
                canEdit: false,
                canDelete: false,
              },
              update: {
                canView: false,
                canCreate: false,
                canEdit: false,
                canDelete: false,
              },
            });
          }
        }
      }
    }

    res.json({ message: "All permissions updated successfully." });
  } catch (err) {
    console.error("Failed to batch update module permissions:", err);
    res.status(500).json({ message: "Failed to batch update module permissions." });
  }
});

export default router;
