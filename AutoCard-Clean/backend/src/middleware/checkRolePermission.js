import prisma from "../prismaClient.js";

export function checkRolePermission(moduleKey) {
  return async (req, res, next) => {
    try {
      if (req.user && req.user.role === "ADMIN") {
        return next();
      }

      if (!req.user || !req.user.roleId) {
        return res.status(403).json({
          message: "No role assigned. Access denied.",
        });
      }

      const hasAccess = await prisma.roleModule.findUnique({
        where: {
          roleId_moduleKey: {
            roleId: req.user.roleId,
            moduleKey: moduleKey,
          },
        },
      });

      if (hasAccess) {
        return next();
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
