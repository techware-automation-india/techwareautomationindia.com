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
  { key: "academic-holidays", label: "Academic Holidays" },
  { key: "holidays", label: "Holidays" },
  { key: "projects", label: "Projects" },
  { key: "assigned-projects", label: "Assigned Projects" },
  { key: "my-projects", label: "My Projects" },
  { key: "services", label: "Services" },
  { key: "inventory", label: "Inventory" },
  { key: "inventory-in", label: "Material Inward" },
  { key: "inventory-out", label: "Material Outward" },
  { key: "inventory-approval", label: "Inventory Approvals" },
  { key: "view-inventory", label: "View Stock" },
  { key: "inventory-request", label: "Material Request" },
  { key: "inventory-alert", label: "Stock Alerts" },
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
      for (const m of roleModules) {
        permissionMap[m.moduleKey] = {
          canView: true,
          canCreate: true,
          canEdit: true,
          canDelete: true,
        };
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

export default router;
