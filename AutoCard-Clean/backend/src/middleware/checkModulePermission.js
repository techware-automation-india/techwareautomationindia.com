import prisma from "../prismaClient.js";

/**
 * Middleware to check if user has permission to access a module
 * @param {string} moduleKey - The module key (e.g., 'employee', 'customer')
 * @param {string} permission - The permission to check ('canView', 'canCreate', 'canEdit', 'canDelete')
 */
export function checkModulePermission(moduleKey, permission = 'canView') {
  return async (req, res, next) => {
    console.log(`🔒 [Permission Check] Module: ${moduleKey}, Permission: ${permission}, User:`, req.user?.id, "Role:", req.user?.role);
    try {
      const user = req.user;

      if (!user) {
        console.log("❌ [Permission Check] No user found in request");
        return res.status(401).json({ message: "Authentication required." });
      }

      // ADMIN always has full access
      if (user.role === "ADMIN") {
        console.log("✅ [Permission Check] ADMIN access granted");
        return next();
      }

      // For EMPLOYEE role, check permissions
      if (user.role === "EMPLOYEE") {
        // 1. Check direct ModulePermission
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

        // 2. Check RoleModule from assigned role (fresh lookup from DB if roleId not in JWT)
        let roleId = user.roleId;
        if (!roleId) {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { roleId: true },
          });
          roleId = dbUser?.roleId || null;
          if (roleId) {
            req.user.roleId = roleId;
          }
        }

        if (roleId) {
          const roleMod = await prisma.roleModule.findUnique({
            where: {
              roleId_moduleKey: {
                roleId,
                moduleKey,
              },
            },
          });

          if (roleMod) {
            return next();
          }
        }

        // 3. Fallback to default role
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
