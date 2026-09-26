import prisma from "../prismaClient.js";

/**
 * Middleware to check if a user has access to a given module.
 * Grants access if:
 * 1. User has ADMIN role
 * 2. User has a custom role (RoleModule) containing moduleKey
 * 3. User has a direct ModulePermission for moduleKey
 * 4. The default role (isDefault: true) contains moduleKey
 */
export function checkRolePermission(moduleKey) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required." });
      }

      // 1. ADMIN always has full access
      if (req.user.role === "ADMIN") {
        return next();
      }

      const userId = req.user.id;

      // 2. Fetch fresh roleId from DB if missing or stale in JWT
      let roleId = req.user.roleId;
      if (!roleId) {
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { roleId: true },
        });
        roleId = dbUser?.roleId || null;
        if (roleId) {
          req.user.roleId = roleId; // Update in-memory for downstream handlers
        }
      }

      // 3. Check custom role modules
      if (roleId) {
        const hasRoleAccess = await prisma.roleModule.findUnique({
          where: {
            roleId_moduleKey: {
              roleId,
              moduleKey,
            },
          },
        });

        if (hasRoleAccess) {
          return next();
        }
      }

      // 4. Check direct module permissions
      const directPermission = await prisma.modulePermission.findUnique({
        where: {
          userId_moduleKey: {
            userId,
            moduleKey,
          },
        },
      });

      if (
        directPermission &&
        (directPermission.canView ||
          directPermission.canEdit ||
          directPermission.canCreate)
      ) {
        return next();
      }

      // 5. Fallback to default role if no custom role assigned
      if (!roleId) {
        const defaultRole = await prisma.roleTable.findFirst({
          where: { isDefault: true },
          include: { modules: true },
        });

        if (defaultRole?.modules?.some((m) => m.moduleKey === moduleKey)) {
          return next();
        }
      }

      return res.status(403).json({
        message: `Access denied to ${moduleKey} module.`,
      });
    } catch (err) {
      console.error(`[checkRolePermission] Error:`, err);
      return res.status(500).json({
        message: "Failed to verify permissions.",
      });
    }
  };
}
