import { Router } from "express";
import { z } from "zod";
import prisma from "../prismaClient.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

const EMPLOYEE_ROLE = "EMPLOYEE";

const employeeModules = [
  { key: "overview", label: "Dashboard" },
  { key: "employee", label: "Employee" },
  { key: "customer", label: "Customer" },
  { key: "requests", label: "Requests" },
  { key: "leave-policy", label: "Leave Policy" },
  { key: "holidays", label: "Holidays" },
  { key: "attendance", label: "Attendance" },
  { key: "projects", label: "Projects" },
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
  if (req.user?.role !== EMPLOYEE_ROLE) {
    return res.json({
      role: req.user?.role,
      modules: [],
      permissions: {},
      hasConfiguredPermissions: false,
    });
  }

  try {
    const permissions = await prisma.modulePermission.findMany({ where: { userId: req.user.id } });
    res.json({
      role: EMPLOYEE_ROLE,
      modules: employeeModules,
      permissions: buildPermissionMap(permissions),
      hasConfiguredPermissions: permissions.length > 0,
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
