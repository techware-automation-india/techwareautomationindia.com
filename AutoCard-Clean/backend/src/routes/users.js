import { Router } from "express";
import prisma from "../prismaClient.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateAssignRole } from "../middleware/validate-access.js";

const router = Router();

// All routes require authentication
router.use(requireAuth);

// ============================================================================
// GET /api/users/with-roles
// Retrieve all users with their assigned roles
// Requires: Admin authentication
// Returns: Array of users with role information
// ============================================================================

router.get("/with-roles", requireRole("ADMIN"), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        roleId: true,
        customRole: {
          select: {
            id: true,
            name: true,
            isDefault: true,
            modules: {
              select: {
                moduleKey: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Transform the data to include module keys as an array
    const usersWithRoles = users.map((user) => ({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      roleId: user.roleId,
      customRole: user.customRole
        ? {
            id: user.customRole.id,
            name: user.customRole.name,
            isDefault: user.customRole.isDefault,
            modules: user.customRole.modules.map((m) => m.moduleKey),
          }
        : null,
    }));

    res.json({ users: usersWithRoles });
  } catch (err) {
    console.error("[GET /api/users/with-roles] Error:", err);
    res.status(500).json({ message: "Failed to fetch users with roles." });
  }
});

// ============================================================================
// GET /api/users/by-role/:roleId
// Filter users by role
// Requires: Admin authentication
// Validates: roleId parameter is a valid UUID
// Returns: Array of users with the specified role
// Requirements: 8.4, 14.3, 14.4
// ============================================================================

router.get("/by-role/:roleId", requireRole("ADMIN"), async (req, res) => {
  try {
    const { roleId } = req.params;

    // Validate roleId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(roleId)) {
      return res.status(400).json({
        message: "Invalid role ID format. Must be a valid UUID.",
      });
    }

    // Check if role exists
    const role = await prisma.roleTable.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      return res.status(404).json({
        message: "Role not found.",
      });
    }

    // Fetch all users with the specified roleId
    const users = await prisma.user.findMany({
      where: {
        roleId: roleId,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        roleId: true,
        customRole: {
          select: {
            id: true,
            name: true,
            isDefault: true,
            modules: {
              select: {
                moduleKey: true,
              },
            },
          },
        },
      },
      orderBy: {
        fullName: "asc",
      },
    });

    // Transform the data to include module keys as an array
    const usersWithRole = users.map((user) => ({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      roleId: user.roleId,
      customRole: user.customRole
        ? {
            id: user.customRole.id,
            name: user.customRole.name,
            isDefault: user.customRole.isDefault,
            modules: user.customRole.modules.map((m) => m.moduleKey),
          }
        : null,
    }));

    console.log(
      `[GET /api/users/by-role/${roleId}] Found ${usersWithRole.length} users with role ${role.name}`
    );

    res.json({ users: usersWithRole, role: { id: role.id, name: role.name } });
  } catch (err) {
    console.error("[GET /api/users/by-role/:roleId] Error:", err);
    res.status(500).json({ message: "Failed to fetch users by role." });
  }
});

// ============================================================================
// PUT /api/users/:id/role
// Assign a role to a user
// Requires: Admin authentication
// Validates: roleId is a valid UUID and references an existing role
// Returns: Updated user with role details
// Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 14.2, 14.4, 15.1, 15.2
// ============================================================================

router.put(
  "/:id/role",
  requireRole("ADMIN"),
  validateAssignRole,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { roleId } = req.body;

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        return res.status(404).json({
          message: "User not found.",
        });
      }

      // Check if role exists
      const role = await prisma.roleTable.findUnique({
        where: { id: roleId },
      });

      if (!role) {
        return res.status(400).json({
          message: "Invalid role ID. Role does not exist.",
        });
      }

      // Update user's roleId
      const updatedUser = await prisma.user.update({
        where: { id },
        data: { roleId },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          roleId: true,
          customRole: {
            select: {
              id: true,
              name: true,
              isDefault: true,
              modules: {
                select: {
                  moduleKey: true,
                },
              },
            },
          },
        },
      });

      // Transform the response to include module keys as an array
      const userResponse = {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        role: updatedUser.role,
        roleId: updatedUser.roleId,
        customRole: updatedUser.customRole
          ? {
              id: updatedUser.customRole.id,
              name: updatedUser.customRole.name,
              isDefault: updatedUser.customRole.isDefault,
              modules: updatedUser.customRole.modules.map((m) => m.moduleKey),
            }
          : null,
      };

      console.log(
        `[PUT /api/users/${id}/role] Role assigned: User ${updatedUser.fullName} assigned role ${role.name}`
      );

      res.json(userResponse);
    } catch (err) {
      console.error(`[PUT /api/users/:id/role] Error:`, err);
      res.status(500).json({ message: "Failed to assign role to user." });
    }
  }
);

export default router;
