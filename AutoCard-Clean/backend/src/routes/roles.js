import { Router } from "express";
import prisma from "../prismaClient.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  validateCreateRole,
  validateUpdateModules,
  validateUpdateRoleName,
  VALID_MODULES,
} from "../middleware/validate-roles.js";

const router = Router();

// All routes require admin authentication
router.use(requireAuth, requireRole("ADMIN"));

/**
 * POST /api/roles
 * Create a new custom role with isDefault: false
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.6, 13.1, 13.7, 15.1, 15.2, 15.3
 */
router.post("/", validateCreateRole, async (req, res) => {
  try {
    const { name } = req.body;

    // Check for duplicate role name
    const existingRole = await prisma.roleTable.findUnique({
      where: { name },
    });

    if (existingRole) {
      return res.status(409).json({
        message: "A role with this name already exists.",
      });
    }

    // Create role with isDefault: false
    const newRole = await prisma.roleTable.create({
      data: {
        name,
        isDefault: false,
      },
    });

    // Return created role with empty modules array
    res.status(201).json({
      id: newRole.id,
      name: newRole.name,
      isDefault: newRole.isDefault,
      modules: [],
      moduleCount: 0,
      createdAt: newRole.createdAt,
      updatedAt: newRole.updatedAt,
    });
  } catch (err) {
    console.error("POST /api/roles error:", err);
    res.status(500).json({ message: "Failed to create role." });
  }
});

/**
 * GET /api/roles
 * Fetch all roles with their associated modules
 * Returns roles array and validModules list
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 13.2, 13.7
 */
router.get("/", async (req, res) => {
  try {
    // Fetch all roles with their associated modules
    const roles = await prisma.roleTable.findMany({
      include: {
        modules: true,
      },
    });

    // Transform roles to include module keys array and module count
    const transformedRoles = roles.map((role) => ({
      id: role.id,
      name: role.name,
      isDefault: role.isDefault,
      modules: role.modules.map((m) => m.moduleKey),
      moduleCount: role.modules.length,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    }));

    // Sort: default roles first, then custom roles alphabetically by name
    const sortedRoles = transformedRoles.sort((a, b) => {
      // Default roles come first
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      
      // Among same type (both default or both custom), sort by name
      return a.name.localeCompare(b.name);
    });

    res.json({
      roles: sortedRoles,
      validModules: VALID_MODULES,
    });
  } catch (err) {
    console.error("GET /api/roles error:", err);
    res.status(500).json({ message: "Failed to load roles." });
  }
});

/**
 * GET /api/roles/:id/modules
 * Fetch modules for a specific role
 * Returns array of module keys for the role
 * Requirements: 3.6, 13.5, 13.7, 15.2
 */
router.get("/:id/modules", async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch role with modules
    const role = await prisma.roleTable.findUnique({
      where: { id },
      include: {
        modules: true,
      },
    });

    // Return 404 if role not found
    if (!role) {
      return res.status(404).json({ 
        message: "Role not found." 
      });
    }

    // Return array of module keys
    const moduleKeys = role.modules.map((m) => m.moduleKey);
    
    res.json({
      roleId: role.id,
      roleName: role.name,
      modules: moduleKeys,
    });
  } catch (err) {
    console.error("GET /api/roles/:id/modules error:", err);
    res.status(500).json({ message: "Failed to load role modules." });
  }
});

/**
 * GET /api/roles/:id
 * Fetch single role by ID with modules
 * Requirements: 6.3, 13.7, 15.2
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch role with modules
    const role = await prisma.roleTable.findUnique({
      where: { id },
      include: {
        modules: true,
      },
    });

    // Return 404 if role not found
    if (!role) {
      return res.status(404).json({ 
        message: "Role not found." 
      });
    }

    // Transform role to include module keys array
    const transformedRole = {
      id: role.id,
      name: role.name,
      isDefault: role.isDefault,
      modules: role.modules.map((m) => m.moduleKey),
      moduleCount: role.modules.length,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };

    res.json(transformedRole);
  } catch (err) {
    console.error("GET /api/roles/:id error:", err);
    res.status(500).json({ message: "Failed to load role." });
  }
});

/**
 * DELETE /api/roles/:id
 * Delete a custom role
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 13.4, 13.7, 15.2, 15.3, 15.4
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if role exists
    const role = await prisma.roleTable.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    // Return 404 if role not found
    if (!role) {
      return res.status(404).json({
        message: "Role not found.",
      });
    }

    // Check if role is default - prevent deletion
    if (role.isDefault) {
      return res.status(403).json({
        message: "Cannot delete default role.",
      });
    }

    // Check if role is assigned to any users
    const usersCount = role._count.users;
    if (usersCount > 0) {
      return res.status(409).json({
        message: `Cannot delete role: ${usersCount} user${usersCount === 1 ? " is" : "s are"} assigned this role.`,
        usersCount,
      });
    }

    // Delete role (cascade will automatically delete RoleModule entries)
    await prisma.roleTable.delete({
      where: { id },
    });

    // Return success confirmation
    res.json({
      message: "Role deleted successfully.",
    });
  } catch (err) {
    console.error("DELETE /api/roles/:id error:", err);
    res.status(500).json({ message: "Failed to delete role." });
  }
});

/**
 * PUT /api/roles/:id
 * Update role name (custom roles only)
 * Requirements: 4.1, 4.2, 4.5, 13.3, 13.7, 15.1, 15.2, 15.3, 15.4
 */
router.put("/:id", validateUpdateRoleName, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    // Check if role exists
    const role = await prisma.roleTable.findUnique({
      where: { id },
    });

    if (!role) {
      return res.status(404).json({ 
        message: "Role not found." 
      });
    }

    // Check if role is default
    if (role.isDefault) {
      return res.status(403).json({
        message: "Cannot rename default role.",
      });
    }

    // Check for duplicate name (excluding current role)
    const existingRole = await prisma.roleTable.findFirst({
      where: { 
        name,
        id: { not: id }
      },
    });

    if (existingRole) {
      return res.status(409).json({
        message: "A role with this name already exists.",
      });
    }

    // Update role name and updatedAt timestamp
    const updatedRole = await prisma.roleTable.update({
      where: { id },
      data: { 
        name,
        updatedAt: new Date()
      },
      include: {
        modules: true,
      },
    });

    // Return updated role with modules
    res.json({
      id: updatedRole.id,
      name: updatedRole.name,
      isDefault: updatedRole.isDefault,
      modules: updatedRole.modules.map((m) => m.moduleKey),
      moduleCount: updatedRole.modules.length,
      createdAt: updatedRole.createdAt,
      updatedAt: updatedRole.updatedAt,
    });
  } catch (err) {
    console.error("PUT /api/roles/:id error:", err);
    res.status(500).json({ message: "Failed to update role." });
  }
});

/**
 * PUT /api/roles/:id/modules
 * Update role module access configuration
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.3, 4.4, 13.6, 13.7, 15.1, 15.2, 20.3
 */
router.put("/:id/modules", validateUpdateModules, async (req, res) => {
  try {
    const { id } = req.params;
    const { moduleKeys } = req.body;

    // Check if role exists
    const role = await prisma.roleTable.findUnique({
      where: { id },
    });

    if (!role) {
      return res.status(404).json({ 
        message: "Role not found." 
      });
    }

    // Validate each module key against VALID_MODULES
    const invalidModules = moduleKeys.filter(key => !VALID_MODULES.includes(key));
    if (invalidModules.length > 0) {
      return res.status(400).json({
        message: `Invalid module keys: ${invalidModules.join(', ')}. Valid modules are: ${VALID_MODULES.join(', ')}`,
      });
    }

    // Delete all existing RoleModule entries for the role
    await prisma.roleModule.deleteMany({
      where: { roleId: id },
    });

    // Create new RoleModule entries for provided module keys
    if (moduleKeys.length > 0) {
      await prisma.roleModule.createMany({
        data: moduleKeys.map((moduleKey) => ({
          roleId: id,
          moduleKey,
        })),
      });
    }

    // Update role's updatedAt timestamp
    const updatedRole = await prisma.roleTable.update({
      where: { id },
      data: { 
        updatedAt: new Date() 
      },
      include: {
        modules: true,
      },
    });

    // Return updated role with modules
    res.json({
      id: updatedRole.id,
      name: updatedRole.name,
      isDefault: updatedRole.isDefault,
      modules: updatedRole.modules.map((m) => m.moduleKey),
      moduleCount: updatedRole.modules.length,
      createdAt: updatedRole.createdAt,
      updatedAt: updatedRole.updatedAt,
    });
  } catch (err) {
    console.error("PUT /api/roles/:id/modules error:", err);
    res.status(500).json({ message: "Failed to update role modules." });
  }
});

export default router;
