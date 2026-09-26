import { z } from "zod";

/**
 * Valid module keys for the Techware Automation application
 * These represent all available modules that can be assigned to roles
 */
export const VALID_MODULES = [
  'overview',
  'employee',
  'requests',
  'approvals',
  'mark-attendance',
  'attendance',
  'roles-access',
  'shift-location',
  'roster'
];

/**
 * Zod schema for validating role names
 * - Must be between 1 and 100 characters
 * - Can only contain alphanumeric characters, spaces, hyphens, and underscores
 */
export const roleNameSchema = z.string()
  .min(1, "Role name must be at least 1 character")
  .max(100, "Role name cannot exceed 100 characters")
  .regex(
    /^[a-zA-Z0-9\s\-_]+$/,
    "Role name can only contain alphanumeric characters, spaces, hyphens, and underscores"
  );

/**
 * Zod schema for validating module keys array
 * - Must be an array of strings
 * - Each string must be a valid module key from VALID_MODULES
 */
export const moduleKeysSchema = z.array(z.string())
  .refine(
    (keys) => keys.every(key => VALID_MODULES.includes(key)),
    {
      message: `Module keys must be from the valid modules list: ${VALID_MODULES.join(', ')}`
    }
  );

/**
 * Zod schema for creating a new role
 * Validates: Requirements 2.2, 2.3
 */
export const createRoleSchema = z.object({
  name: roleNameSchema
});

/**
 * Zod schema for updating role module access
 * Validates: Requirements 3.3, 15.1
 */
export const updateModulesSchema = z.object({
  moduleKeys: moduleKeysSchema
});

/**
 * Zod schema for updating role name
 * Validates: Requirements 2.2, 2.3
 */
export const updateRoleNameSchema = z.object({
  name: roleNameSchema
});

/**
 * Zod schema for assigning a role to a user
 * Validates: Requirement 7.2
 */
export const assignRoleSchema = z.object({
  roleId: z.string().uuid("Role ID must be a valid UUID")
});

/**
 * Middleware function to validate role creation
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next middleware function
 */
export const validateCreateRole = (req, res, next) => {
  const result = createRoleSchema.safeParse(req.body);

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

/**
 * Middleware function to validate module keys update
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next middleware function
 */
export const validateUpdateModules = (req, res, next) => {
  const result = updateModulesSchema.safeParse(req.body);

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

/**
 * Middleware function to validate role name update
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next middleware function
 */
export const validateUpdateRoleName = (req, res, next) => {
  const result = updateRoleNameSchema.safeParse(req.body);

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

/**
 * Middleware function to validate role assignment
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
