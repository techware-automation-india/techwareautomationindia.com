/**
 * Integration Example: Using checkRolePermission in Real Routes
 * 
 * This file demonstrates practical integration of checkRolePermission
 * middleware in Express routes with real-world scenarios.
 */

import express from 'express';
import { checkRolePermission } from './checkRolePermission.js';
import { requireAuth } from './auth.js';

const router = express.Router();

// ============================================================================
// SCENARIO 1: Employee Management Routes
// ============================================================================

/**
 * GET /api/employees
 * View all employees - requires 'employee' module access
 */
router.get(
  '/employees',
  requireAuth,                      // Step 1: Verify JWT token
  checkRolePermission('employee'),  // Step 2: Check module access
  async (req, res) => {
    // Only users with 'employee' module OR admins reach here
    // Admins bypass the permission check automatically
    
    try {
      // Fetch employees logic here
      res.json({
        success: true,
        message: 'Employees retrieved successfully',
        data: []
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch employees' });
    }
  }
);

/**
 * POST /api/employees
 * Create new employee - requires 'employee' module access
 * 
 * Note: Binary permission model means if user has 'employee' module,
 * they can perform ALL operations (view, create, edit, delete)
 */
router.post(
  '/employees',
  requireAuth,
  checkRolePermission('employee'),
  async (req, res) => {
    try {
      // Create employee logic here
      res.status(201).json({
        success: true,
        message: 'Employee created successfully'
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to create employee' });
    }
  }
);

// ============================================================================
// SCENARIO 2: Attendance Routes
// ============================================================================

/**
 * GET /api/attendance
 * View attendance records - requires 'attendance' module access
 */
router.get(
  '/attendance',
  requireAuth,
  checkRolePermission('attendance'),
  async (req, res) => {
    // User has 'attendance' module access
    res.json({ message: 'Attendance records' });
  }
);

/**
 * POST /api/attendance/mark
 * Mark attendance - requires 'mark-attendance' module access
 * 
 * Note: Different module key for marking vs viewing attendance
 */
router.post(
  '/attendance/mark',
  requireAuth,
  checkRolePermission('mark-attendance'),
  async (req, res) => {
    // User has 'mark-attendance' module access
    res.json({ message: 'Attendance marked' });
  }
);

// ============================================================================
// SCENARIO 3: Roles & Access Management Routes
// ============================================================================

/**
 * POST /api/roles
 * Create custom role - requires 'roles-access' module access
 * 
 * Typically only admins have 'roles-access' module
 */
router.post(
  '/roles',
  requireAuth,
  checkRolePermission('roles-access'),
  async (req, res) => {
    // Only users with 'roles-access' module reach here
    res.status(201).json({ message: 'Role created' });
  }
);

/**
 * PUT /api/users/:id/role
 * Assign role to user - requires 'roles-access' module access
 */
router.put(
  '/users/:id/role',
  requireAuth,
  checkRolePermission('roles-access'),
  async (req, res) => {
    // Only users with 'roles-access' module reach here
    res.json({ message: 'Role assigned' });
  }
);

// ============================================================================
// SCENARIO 4: Multiple Module Checks
// ============================================================================

/**
 * GET /api/dashboard
 * View dashboard - requires 'overview' module access
 * 
 * Most roles should have 'overview' module
 */
router.get(
  '/dashboard',
  requireAuth,
  checkRolePermission('overview'),
  async (req, res) => {
    res.json({ message: 'Dashboard data' });
  }
);

/**
 * GET /api/approvals
 * View approvals - requires 'approvals' module access
 * 
 * Typically only managers/admins have 'approvals' module
 */
router.get(
  '/approvals',
  requireAuth,
  checkRolePermission('approvals'),
  async (req, res) => {
    res.json({ message: 'Approvals data' });
  }
);

// ============================================================================
// SCENARIO 5: Error Responses
// ============================================================================

/**
 * Example error responses users might receive:
 * 
 * 1. No authentication (requireAuth fails):
 *    Status: 401
 *    Body: { message: "Unauthorized" }
 * 
 * 2. No role assigned (user.roleId is null):
 *    Status: 403
 *    Body: { message: "No role assigned. Access denied." }
 * 
 * 3. Module not in user's role:
 *    Status: 403
 *    Body: { message: "Access denied to employee module." }
 * 
 * 4. Database error during permission check:
 *    Status: 500
 *    Body: { message: "Failed to verify permissions." }
 * 
 * 5. Admin bypass (automatic success):
 *    - Admin users bypass ALL permission checks
 *    - No database query is performed
 *    - Request proceeds to route handler
 */

// ============================================================================
// SCENARIO 6: Permission Flow Examples
// ============================================================================

/**
 * Flow 1: Admin user accessing any route
 * ----------------------------------------
 * Request: GET /api/employees
 * User: { role: 'ADMIN', roleId: 'role-1' }
 * 
 * Flow:
 * 1. requireAuth: ✅ Token valid
 * 2. checkRolePermission('employee'):
 *    - Checks: req.user.role === 'ADMIN' → TRUE
 *    - Action: Immediately calls next()
 *    - Database query: SKIPPED (performance optimization)
 * 3. Route handler: ✅ Executes successfully
 * 
 * Result: Admin accesses route regardless of roleId or modules
 */

/**
 * Flow 2: Employee with 'employee' module access
 * -----------------------------------------------
 * Request: GET /api/employees
 * User: { role: 'EMPLOYEE', roleId: 'role-project-manager' }
 * 
 * Flow:
 * 1. requireAuth: ✅ Token valid
 * 2. checkRolePermission('employee'):
 *    - Checks: req.user.role === 'ADMIN' → FALSE
 *    - Checks: req.user.roleId exists → TRUE
 *    - Queries database:
 *      SELECT * FROM role_modules 
 *      WHERE roleId = 'role-project-manager' 
 *      AND moduleKey = 'employee'
 *    - Result: Record found
 *    - Action: Calls next()
 * 3. Route handler: ✅ Executes successfully
 * 
 * Result: Employee accesses route because 'employee' is in their role
 */

/**
 * Flow 3: Employee without 'employee' module access
 * --------------------------------------------------
 * Request: GET /api/employees
 * User: { role: 'EMPLOYEE', roleId: 'role-limited-access' }
 * 
 * Flow:
 * 1. requireAuth: ✅ Token valid
 * 2. checkRolePermission('employee'):
 *    - Checks: req.user.role === 'ADMIN' → FALSE
 *    - Checks: req.user.roleId exists → TRUE
 *    - Queries database:
 *      SELECT * FROM role_modules 
 *      WHERE roleId = 'role-limited-access' 
 *      AND moduleKey = 'employee'
 *    - Result: No record found (null)
 *    - Action: Returns 403 with message
 * 3. Route handler: ❌ Never reached
 * 
 * Response: 403 { message: "Access denied to employee module." }
 */

/**
 * Flow 4: User with no role assigned
 * -----------------------------------
 * Request: GET /api/employees
 * User: { role: 'EMPLOYEE', roleId: null }
 * 
 * Flow:
 * 1. requireAuth: ✅ Token valid
 * 2. checkRolePermission('employee'):
 *    - Checks: req.user.role === 'ADMIN' → FALSE
 *    - Checks: req.user.roleId exists → FALSE
 *    - Action: Returns 403 with message
 *    - Database query: SKIPPED (no roleId to query)
 * 3. Route handler: ❌ Never reached
 * 
 * Response: 403 { message: "No role assigned. Access denied." }
 */

// ============================================================================
// SCENARIO 7: All Valid Module Keys
// ============================================================================

/**
 * Complete list of valid module keys for checkRolePermission:
 * 
 * 1. overview         - Dashboard/home page access
 * 2. employee         - Employee management
 * 3. requests         - View/submit requests
 * 4. approvals        - Approve requests (managers)
 * 5. mark-attendance  - Mark own attendance
 * 6. attendance       - View attendance records
 * 7. roles-access     - Manage roles and permissions
 * 8. shift-location   - Manage shifts and locations
 * 9. roster           - View/manage roster assignments
 * 
 * Usage:
 * checkRolePermission('overview')
 * checkRolePermission('employee')
 * checkRolePermission('roles-access')
 * etc.
 */

export default router;
