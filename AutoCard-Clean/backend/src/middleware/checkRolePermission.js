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

      const keySet = new Set();
      for (const k of inputKeys) {
        keySet.add(k);
        if (k === "shift-location" || k === "shift" || k === "location") {
          keySet.add("shift-location");
          keySet.add("shift");
          keySet.add("location");
          keySet.add("shift-and-location");
          keySet.add("shift_location");
        }
        if (typeof k === "string" && k.startsWith("approvals-")) {
          keySet.add("approvals");
          if (k === "approvals-tools-inventory") {
            keySet.add("approvals-tools");
          }
        }
        if (typeof k === "string" && k.startsWith("requests-")) {
          keySet.add("requests");
          if (k === "requests-apply-leave") {
            keySet.add("leave");
          }
        }
        if (typeof k === "string" && k.startsWith("leave-policy-")) {
          keySet.add("leave-policy");
          if (k === "leave-policy-holidays") {
            keySet.add("holidays");
            keySet.add("academic-holidays");
          }
        }
        if (typeof k === "string" && k.startsWith("inventory-")) {
          keySet.add("inventory");
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

