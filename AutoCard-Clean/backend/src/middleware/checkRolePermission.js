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
        if (typeof k === "string" && (k.startsWith("approvals-") || k === "inventory-approval")) {
          keySet.add("approvals");
          if (k === "approvals-tools-inventory" || k === "inventory-approval") {
            keySet.add("approvals-tools");
            keySet.add("approvals-tools-inventory");
            keySet.add("inventory-approval");
          }
        }
        if (typeof k === "string" && (k.startsWith("requests-") || k === "inventory-request")) {
          keySet.add("requests");
          if (k === "requests-tools-inventory" || k === "inventory-request") {
            keySet.add("requests-tools-inventory");
            keySet.add("inventory-request");
          }
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

/**
 * Middleware to check if user has permission to perform a specific action on a module
 * E.g., checkRoleActionPermission('inventory-in', 'create')
 *       checkRoleActionPermission('inventory-in', 'delete')
 */
export function checkRoleActionPermission(moduleKey, action = "view") {
  return async (req, res, next) => {
    try {
      if (req.user && req.user.role === "ADMIN") {
        return next();
      }

      if (!req.user || !req.user.id) {
        return res.status(401).json({ message: "Authentication required." });
      }

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

      if (dbUser.role === "ADMIN" || dbUser.customRole?.name?.toUpperCase() === "ADMIN") {
        return next();
      }

      const roleId = dbUser.roleId || req.user.roleId;

      // Check for specific action key, e.g. "inventory-in:delete" or "inventory-in:create"
      const actionKey = `${moduleKey}:${action}`;
      const searchKeys = [actionKey];

      // If action is view, also allow base moduleKey or "inventory"
      if (action === "view") {
        searchKeys.push(moduleKey, "inventory");
      }

      if (roleId) {
        const hasAction = await prisma.roleModule.findFirst({
          where: {
            roleId,
            moduleKey: { in: searchKeys },
          },
        });

        if (hasAction) {
          return next();
        }

        // If action is NOT delete (e.g. create or edit), check if role has the bare moduleKey or "inventory"
        // without ANY granular action keys defined (legacy full submodule access)
        if (action !== "delete") {
          const anySubActions = await prisma.roleModule.findFirst({
            where: {
              roleId,
              moduleKey: { startsWith: `${moduleKey}:` },
            },
          });
          if (!anySubActions) {
            const hasBaseAccess = await prisma.roleModule.findFirst({
              where: {
                roleId,
                moduleKey: { in: [moduleKey, "inventory"] },
              },
            });
            if (hasBaseAccess) {
              return next();
            }
          }
        }
      }

      // Check fallback in modulePermission table
      const userModPerm = await prisma.modulePermission.findFirst({
        where: {
          userId: req.user.id,
          moduleKey,
        },
      });

      if (userModPerm) {
        if (action === "create" && userModPerm.canCreate) return next();
        if (action === "edit" && userModPerm.canEdit) return next();
        if (action === "delete" && userModPerm.canDelete) return next();
        if (action === "view" && (userModPerm.canView || userModPerm.canCreate || userModPerm.canEdit || userModPerm.canDelete)) return next();
      }

      return res.status(403).json({
        message: `Access denied: You do not have permission to ${action} in ${moduleKey}. Contact Admin.`,
      });
    } catch (err) {
      console.error(`[checkRoleActionPermission] Error:`, err);
      return res.status(500).json({ message: "Failed to verify action permissions." });
    }
  };
}


