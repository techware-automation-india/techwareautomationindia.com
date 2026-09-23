import { z } from "zod";

/**
 * Zod schema for assigning a role to a user
 * Validates: Requirement 7.2
 */
export const assignRoleSchema = z.object({
  roleId: z.string().uuid("Role ID must be a valid UUID")
});

/**
 * Middleware function to validate role assignment
 * Validates: Requirements 7.2, 15.1
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next middleware function
 */
export const validateAssignRole = (req, res, next) => {
  const result = assignRoleSchema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));

    return res.status(400).json({
      success: false,
      message: errors[0]?.message || "Validation failed.",
      field: errors[0]?.field,
      errors,
    });
  }

  req.body = result.data;
  next();
};
