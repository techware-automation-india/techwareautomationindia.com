import prisma from "../prismaClient.js";

export function checkRolePermission(moduleKey) {
  return async (req, res, next) => {
    try {
      if (req.user && req.user.role === "ADMIN") {
        return next();
      }

      if (!req.user || !req.user.id) {
        return res.status(401).json({
          message: "Authentication required.",
        });
      }

      const keys = Array.isArray(moduleKey) ? moduleKey : [moduleKey];

      // 1. Resolve roleId (from token or live DB lookup)
      let roleId = req.user.roleId;
      if (!roleId) {
        const dbUser = await prisma.user.findUnique({
          where: { id: req.user.id },
          select: { roleId: true },
        });
        roleId = dbUser?.roleId || null;
      }

      if (roleId) {
        const hasAccess = await prisma.roleModule.findFirst({
          where: {
            roleId,
            moduleKey: { in: keys },
          },
        });

        if (hasAccess) {
          return next();
        }
      }

      // 2. Fallback to legacy modulePermission table
      const legacyPerm = await prisma.modulePermission.findFirst({
        where: {
          userId: req.user.id,
          moduleKey: { in: keys },
          canView: true,
        },
      });

      if (legacyPerm) {
        return next();
      }

      return res.status(403).json({
        message: `Access denied to ${keys.join(", ")} module.`,
      });
    } catch (err) {
      console.error(`[checkRolePermission] Error:`, err);
      return res.status(500).json({
        message: "Failed to verify permissions.",
      });
    }
  };
}

