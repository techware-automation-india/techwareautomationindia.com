import prisma from "../prismaClient.js";

/**
 * Middleware to check if user has permission to access a module
 * @param {string} moduleKey - The module key (e.g., 'employee', 'customer')
 * @param {string} permission - The permission to check ('canView', 'canCreate', 'canEdit', 'canDelete')
 */
export function checkModulePermission(moduleKey, permission = 'canView') {
  return async (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({ message: "Authentication required." });
      }

      // ADMIN always has full access
      if (user.role === "ADMIN") {
        return next();
      }

      // For EMPLOYEE role, check module permissions
      if (user.role === "EMPLOYEE") {
        const keys = Array.isArray(moduleKey) ? moduleKey : [moduleKey];

        // 1. Check custom role modules
        let roleId = user.roleId;
        if (!roleId && user.id) {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { roleId: true },
          });
          roleId = dbUser?.roleId || null;
        }

        if (roleId) {
          const hasRoleModule = await prisma.roleModule.findFirst({
            where: {
              roleId,
              moduleKey: { in: keys },
            },
          });
          if (hasRoleModule) {
            return next();
          }
        }

        // 2. Check legacy modulePermission table
        const modulePermission = await prisma.modulePermission.findFirst({
          where: {
            userId: user.id,
            moduleKey: { in: keys },
          },
        });

        // Check if permission exists and is granted
        if (modulePermission && modulePermission[permission]) {
          return next();
        }

        return res.status(403).json({ 
          message: `You don't have ${permission} permission for ${keys.join(", ")} module.` 
        });
      }

      // CUSTOMER or other roles don't have access
      return res.status(403).json({ 
        message: "Access denied." 
      });
    } catch (err) {
      console.error("Check module permission error:", err);
      return res.status(500).json({ message: "Permission check failed." });
    }
  };
}

/**
 * Flexible middleware that allows either ADMIN or EMPLOYEE with specific module permission
 */
export function requireAdminOrModulePermission(moduleKey, permission = 'canView') {
  return checkModulePermission(moduleKey, permission);
}

