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

      // Check live database user role and customRole
      const dbUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { 
          role: true, 
          roleId: true,
          customRole: { select: { name: true } }
        },
      });

      if (!dbUser) {
        return res.status(401).json({ message: "User not found." });
      }

      // If user is Admin (either default role or customRole named Admin), grant full access
      if (dbUser.role === "ADMIN" || dbUser.customRole?.name?.toUpperCase() === "ADMIN") {
        return next();
      }

      const inputKeys = Array.isArray(moduleKey) ? moduleKey : [moduleKey];

      const keySet = new Set(inputKeys);
      for (const k of inputKeys) {
        if (k === "shift-location" || k === "shift" || k === "location") {
          keySet.add("shift-location");
          keySet.add("shift");
          keySet.add("location");
          keySet.add("shift-and-location");
          keySet.add("shift_location");
        }
        if (k === "approvals" || (typeof k === "string" && k.startsWith("approvals-"))) {
          keySet.add("approvals");
          keySet.add("approvals-attendance");
          keySet.add("approvals-forgot-punch");
          keySet.add("approvals-leave");
        }
      }
      const keys = Array.from(keySet);

      // 1. Resolve roleId (from live DB lookup)
      const roleId = dbUser.roleId || req.user.roleId;

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
          OR: [
            { canView: true },
            { canCreate: true },
            { canEdit: true },
            { canDelete: true },
          ],
        },
      });

      if (legacyPerm) {
        return next();
      }

      return res.status(403).json({
        message: `Access denied to ${inputKeys.join(", ")} module.`,
      });
    } catch (err) {
      console.error(`[checkRolePermission] Error:`, err);
      return res.status(500).json({
        message: "Failed to verify permissions.",
      });
    }
  };
}

