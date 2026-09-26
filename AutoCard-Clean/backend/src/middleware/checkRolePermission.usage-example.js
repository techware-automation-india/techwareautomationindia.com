/**
 * USAGE EXAMPLES for checkRolePermission middleware
 * 
 * This file demonstrates how to use the checkRolePermission middleware
 * in your Express routes to enforce binary permission model.
 */

import { checkRolePermission } from './checkRolePermission.js';
import { requireAuth } from './auth.js';

/**
 * Example 1: Protect an employee management endpoint
 * 
 * Only users with 'employee' module access can access this route.
 * Admins automatically bypass this check.
 */
export function exampleEmployeeRoute(router) {
  router.get(
    '/api/employees',
    requireAuth,                        // First: verify JWT token
    checkRolePermission('employee'),   // Second: check module access
    async (req, res) => {
      // If we reach here, user has access to 'employee' module
      res.json({ message: 'Employee data' });
    }
  );
}

/**
 * Example 2: Protect attendance endpoints
 * 
 * Only users with 'attendance' module access can access these routes.
 */
export function exampleAttendanceRoutes(router) {
  // View attendance records
  router.get(
    '/api/attendance',
    requireAuth,
    checkRolePermission('attendance'),
    async (req, res) => {
      res.json({ message: 'Attendance records' });
    }
  );

  // Create attendance record
  router.post(
    '/api/attendance',
    requireAuth,
    checkRolePermission('attendance'),
    async (req, res) => {
      // Binary model: if user has module access, they can perform all operations
      res.json({ message: 'Attendance created' });
    }
  );
}

/**
 * Example 3: Protect roles & access management
 * 
 * Only users with 'roles-access' module (typically admins) can manage roles.
 */
export function exampleRolesRoutes(router) {
  router.post(
    '/api/roles',
    requireAuth,
    checkRolePermission('roles-access'),
    async (req, res) => {
      res.json({ message: 'Role created' });
    }
  );
}

/**
 * Example 4: Multiple module checks on different routes
 */
export function exampleMultipleModules(router) {
  // Dashboard - most users should have this
  router.get(
    '/api/dashboard',
    requireAuth,
    checkRolePermission('overview'),
    async (req, res) => {
      res.json({ message: 'Dashboard data' });
    }
  );

  // Requests module
  router.get(
    '/api/requests',
    requireAuth,
    checkRolePermission('requests'),
    async (req, res) => {
      res.json({ message: 'Requests data' });
    }
  );

  // Approvals module (typically managers/admins only)
  router.get(
    '/api/approvals',
    requireAuth,
    checkRolePermission('approvals'),
    async (req, res) => {
      res.json({ message: 'Approvals data' });
    }
  );
}

/**
 * VALID MODULE KEYS:
 * - overview
 * - employee
 * - requests
 * - approvals
 * - mark-attendance
 * - attendance
 * - roles-access
 * - shift-location
 * - roster
 * 
 * RESPONSE CODES:
 * - 200/201: Success (user has access)
 * - 403: Forbidden (no role assigned OR module not in user's role)
 * - 500: Server error (database query failed)
 * 
 * ADMIN BYPASS:
 * Users with req.user.role === 'ADMIN' bypass all module checks
 * 
 * BINARY PERMISSION MODEL:
 * If user has module access, they have FULL access (no CRUD granularity)
 * If user doesn't have module access, they have NO access at all
 */
