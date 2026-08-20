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
        const modulePermission = await prisma.modulePermission.findUnique({
          where: {
            userId_moduleKey: {
              userId: user.id,
              moduleKey: moduleKey,
            },
          },
        });

        // Check if permission exists and is granted
        if (modulePermission && modulePermission[permission]) {
          return next();
        }

        return res.status(403).json({ 
          message: `You don't have ${permission} permission for ${moduleKey} module.` 
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
