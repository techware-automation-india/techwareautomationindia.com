# 🔐 Roles & Access - Complete Flow Diagram

## 🎯 System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         ADMIN WORKFLOW                          │
└─────────────────────────────────────────────────────────────────┘

1. Admin Login
   ↓
2. Admin Dashboard → "Roles & Access" (Sidebar)
   ↓
3. Frontend calls: GET /api/roles-access/employees
   ← Backend returns all employees + available modules
   ↓
4. Admin selects employee from dropdown
   ↓
5. Frontend calls: GET /api/roles-access/employees/:userId/permissions
   ← Backend returns employee's current permissions
   ↓
6. Admin configures permissions:
   • Check "View" for Customer
   • Check "Create" for Customer  
   • Check "View" for Attendance
   • Check "Edit" for Attendance
   ↓
7. Admin clicks "Save Permissions"
   ↓
8. Frontend calls: PATCH /api/roles-access/employees/:userId/permissions
   Body: { permissions: { customer: { canView: true, canCreate: true }, ... } }
   ↓
9. Backend:
   • Validates request
   • Upserts permissions to database (ModulePermission table)
   • Logs the action
   ← Returns updated permissions
   ↓
10. Frontend shows success toast ✓
    "Permissions saved for John Doe"


┌─────────────────────────────────────────────────────────────────┐
│                       EMPLOYEE WORKFLOW                         │
└─────────────────────────────────────────────────────────────────┘

1. Employee Login
   ↓
2. Frontend calls: GET /api/roles-access/me/permissions
   ← Backend returns:
     {
       role: "EMPLOYEE",
       modules: [...],
       permissions: {
         customer: { canView: true, canCreate: true, ... },
         attendance: { canView: true, canEdit: true, ... }
       }
     }
   ↓
3. Frontend filters sidebar modules:
   • Shows "Customer" (has permission) ✓
   • Shows "Attendance" (has permission) ✓
   • Hides "Holidays" (no permission) ✗
   • Hides "Projects" (no permission) ✗
   ↓
4. Employee clicks "Customer"
   ↓
5. Frontend calls: GET /api/customers
   ↓
6. Backend middleware: requireAdminOrModulePermission("customer", "canView")
   • Checks if user is ADMIN → Allow ✓
   • OR checks if user has "customer" + "canView" permission
   • Query: SELECT * FROM module_permissions 
            WHERE userId = 'xxx' AND moduleKey = 'customer'
   • If canView = true → Allow ✓
   • If not found or false → Deny ✗ (403 Forbidden)
   ↓
7. If allowed:
   ← Backend returns customer list
   ↓
8. Employee sees customer list ✓

9. Employee tries to create customer (clicks "Create")
   ↓
10. Frontend calls: POST /api/customers
    ↓
11. Backend middleware: requireAdminOrModulePermission("customer", "canCreate")
    • Checks if user has "customer" + "canCreate" permission
    • If canCreate = true → Allow ✓
    • If false → Deny ✗ (403 Forbidden)
    ↓
12. Employee can create customer ✓


┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE STRUCTURE                           │
└─────────────────────────────────────────────────────────────────┘

module_permissions table:
┌──────────┬─────────┬────────────┬─────────┬───────────┬─────────┬───────────┐
│ id       │ userId  │ moduleKey  │ canView │ canCreate │ canEdit │ canDelete │
├──────────┼─────────┼────────────┼─────────┼───────────┼─────────┼───────────┤
│ uuid-1   │ emp-123 │ customer   │ true    │ true      │ false   │ false     │
│ uuid-2   │ emp-123 │ attendance │ true    │ false     │ true    │ false     │
│ uuid-3   │ emp-123 │ requests   │ true    │ true      │ true    │ true      │
│ uuid-4   │ emp-456 │ customer   │ true    │ false     │ false   │ false     │
│ uuid-5   │ emp-456 │ holidays   │ true    │ true      │ true    │ false     │
└──────────┴─────────┴────────────┴─────────┴───────────┴─────────┴───────────┘

Constraints:
• UNIQUE(userId, moduleKey) - One permission per user+module
• Foreign Key: userId → users(id) ON DELETE CASCADE
• Index on userId for fast lookups


┌─────────────────────────────────────────────────────────────────┐
│                  PERMISSION MIDDLEWARE FLOW                     │
└─────────────────────────────────────────────────────────────────┘

Function: requireAdminOrModulePermission(moduleKey, permission)

Request → requireAuth() → requireAdminOrModulePermission()
                               ↓
                         Check user role
                               ↓
          ┌────────────────────┴────────────────────┐
          ↓                                          ↓
    Is ADMIN?                                  Is EMPLOYEE?
       YES → Allow ✓                              YES
                                                    ↓
                                        Query database:
                                        SELECT * FROM module_permissions
                                        WHERE userId = req.user.id
                                          AND moduleKey = moduleKey
                                                    ↓
                                        ┌───────────┴───────────┐
                                        ↓                       ↓
                                  Found & permission = true    Not found or false
                                        ↓                       ↓
                                    Allow ✓                 Deny ✗
                                                            403 Forbidden


┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND UI STRUCTURE                       │
└─────────────────────────────────────────────────────────────────┘

Roles & Access Page (Admin Only)
┌─────────────────────────────────────────────────────────────────┐
│ 🛡️  Roles & Access                            [🔄 Refresh]      │
├─────────────────────────────────────────────────────────────────┤
│ ┌────────────┬────────────┬────────────┬──────────────────┐   │
│ │📊 Total:50 │✅ Active:45│📦 Modules:9│🎯 Granted:24/36  │   │
│ └────────────┴────────────┴────────────┴──────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│ Select Employee *                                                │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ 👤 John Doe - john@example.com #EMP001  [✓ Configured]  ▼  ││
│ └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│ 👤 John Doe - john@example.com                                  │
│                      [✓ Grant All] [✗ Revoke All] [💾 Save]    │
├─────────────────────────────────────────────────────────────────┤
│ ┌──────────────┬──────┬────────┬──────┬────────┬─────────────┐│
│ │ Module       │ View │ Create │ Edit │ Delete │ All Access  ││
│ ├──────────────┼──────┼────────┼──────┼────────┼─────────────┤│
│ │📇 Customer   │  ✓   │   ✓    │      │        │   Partial   ││
│ │🕐 Attendance │  ✓   │        │  ✓   │        │   Partial   ││
│ │📅 Holidays   │  ✓   │   ✓    │  ✓   │   ✓    │   All ✓     ││
│ │📋 Requests   │      │        │      │        │   None      ││
│ │📚 Leave      │  ✓   │        │      │        │   Partial   ││
│ │📊 Projects   │      │        │      │        │   None      ││
│ │📍 Shift-Loc  │      │        │      │        │   None      ││
│ │📆 Roster     │      │        │      │        │   None      ││
│ └──────────────┴──────┴────────┴──────┴────────┴─────────────┘│
│ 24 of 36 permissions granted to John Doe      [💾 Save]        │
└─────────────────────────────────────────────────────────────────┘


Employee Sidebar (Dynamic)
┌──────────────────────┐
│ 📊 Dashboard         │ ← Always visible
│ 📇 Customer          │ ← Has permission ✓
│ 🕐 Attendance        │ ← Has permission ✓
│ 📅 Holidays          │ ← Has permission ✓
│ 📚 Leave Policy      │ ← Has permission ✓
│                      │
│ [Hidden modules:]    │
│ • Requests           │ ← No permission ✗
│ • Projects           │ ← No permission ✗
│ • Shift-Location     │ ← No permission ✗
│ • Roster             │ ← No permission ✗
└──────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                    API ENDPOINTS SUMMARY                        │
└─────────────────────────────────────────────────────────────────┘

1. GET /api/roles-access/me/permissions
   • Auth: Employee/Admin
   • Returns: Current user's permissions
   • Used by: Employee sidebar

2. GET /api/roles-access/employees
   • Auth: Admin only
   • Returns: All employees + available modules
   • Used by: Admin employee selector

3. GET /api/roles-access/employees/:userId/permissions
   • Auth: Admin only
   • Returns: Specific employee's permissions
   • Used by: Admin loads employee to edit

4. PATCH /api/roles-access/employees/:userId/permissions
   • Auth: Admin only
   • Body: { permissions: { moduleKey: { canView, canCreate, ... } } }
   • Returns: Updated permissions
   • Used by: Admin saves changes


┌─────────────────────────────────────────────────────────────────┐
│                     PROTECTED ROUTES                            │
└─────────────────────────────────────────────────────────────────┘

Module: Customer (backend/src/routes/customers.js)
├── GET    /api/customers     → requireAdminOrModulePermission("customer", "canView")
├── POST   /api/customers     → requireAdminOrModulePermission("customer", "canCreate")
├── PUT    /api/customers/:id → requireAdminOrModulePermission("customer", "canEdit")
└── DELETE /api/customers/:id → requireAdminOrModulePermission("customer", "canDelete")

Module: Attendance (backend/src/routes/attendance.js)
├── GET    /api/attendance        → requireAdminOrModulePermission("attendance", "canView")
├── POST   /api/attendance        → requireAdminOrModulePermission("attendance", "canCreate")
├── PUT    /api/attendance/:id    → requireAdminOrModulePermission("attendance", "canEdit")
├── DELETE /api/attendance/:id    → requireAdminOrModulePermission("attendance", "canDelete")
├── POST   /api/attendance/checkin  → requireRole("EMPLOYEE") ← Employee self-service
└── POST   /api/attendance/checkout → requireRole("EMPLOYEE") ← Employee self-service

Module: Holidays (backend/src/routes/holidays.js)
├── GET    /api/holidays     → requireAuth ← Everyone can view
├── POST   /api/holidays     → requireAdminOrModulePermission("holidays", "canCreate")
├── PUT    /api/holidays/:id → requireAdminOrModulePermission("holidays", "canEdit")
└── DELETE /api/holidays/:id → requireAdminOrModulePermission("holidays", "canDelete")

... and 6 more modules (Requests, Leave, Projects, Shift, Location, Roster)


┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY FEATURES                            │
└─────────────────────────────────────────────────────────────────┘

✅ Admin Bypass
   • Admins always have full access to all modules
   • No need to assign permissions to admins

✅ Granular Control
   • 4 permission types: View, Create, Edit, Delete
   • Example: Employee can view customers but not create/edit/delete

✅ Database Constraints
   • UNIQUE(userId, moduleKey) - Prevents duplicate permissions
   • Cascade Delete - Permissions removed when user deleted
   • Index on userId - Fast permission lookups

✅ Middleware Protection
   • All 9 module routes protected
   • Backend enforces permissions, not just frontend
   • 403 Forbidden if no permission

✅ Audit Trail
   • All permission changes logged to console
   • Includes: Admin ID, Employee ID, Changed permissions
   • Example log:
     [RolesAccess] Admin updated module permissions:
       adminId: "admin-uuid"
       adminEmail: "admin@techware.com"
       employeeId: "emp-uuid"
       employeeEmail: "john@example.com"
       updatedPermissions: { customer: { canView: true, ... } }

✅ Frontend Validation
   • Module keys validated against allowed list
   • Only 9 modules accepted
   • Invalid modules ignored

✅ Session-based
   • Permissions fetched on login
   • Cached in memory during session
   • Refresh on logout/login


┌─────────────────────────────────────────────────────────────────┐
│                  REAL-WORLD EXAMPLE                             │
└─────────────────────────────────────────────────────────────────┘

Company: Techware Automation India

Employees:
• Admin (admin@techware.com) - Full access to everything
• HR Manager (hr@techware.com) - Needs employee, attendance, leave
• Project Manager (pm@techware.com) - Needs projects, customer, roster
• Junior Dev (dev@techware.com) - Needs projects (view only)

Admin assigns permissions:

HR Manager:
  employee:   View ✓, Create ✓, Edit ✓, Delete ✓
  attendance: View ✓, Create ✓, Edit ✓, Delete ✓
  leave:      View ✓, Create ✓, Edit ✓, Delete ✓
  holidays:   View ✓, Create ✓, Edit ✓, Delete ✓

Project Manager:
  projects:   View ✓, Create ✓, Edit ✓, Delete ✓
  customer:   View ✓, Create ✓, Edit ✓, Delete ✗
  roster:     View ✓, Create ✗, Edit ✗, Delete ✗

Junior Dev:
  projects:   View ✓, Create ✗, Edit ✗, Delete ✗
  customer:   View ✓, Create ✗, Edit ✗, Delete ✗

Result:
• HR Manager sees: Employee, Attendance, Leave, Holidays modules
• Project Manager sees: Projects, Customer, Roster modules
• Junior Dev sees: Projects, Customer modules (read-only)

Each employee's sidebar shows ONLY their assigned modules! 🎯


┌─────────────────────────────────────────────────────────────────┐
│                    QUICK START                                  │
└─────────────────────────────────────────────────────────────────┘

1. Backend already running on port 4000 ✓
2. Frontend already running on port 5173 ✓
3. Database has ModulePermission table ✓
4. Routes registered ✓

To use:
1. Login as Admin: http://localhost:5173/login/admin
2. Go to "Roles & Access" in sidebar
3. Select an employee
4. Check some permissions
5. Click "Save Permissions"
6. Logout
7. Login as that employee
8. See only assigned modules in sidebar! 🎉


┌─────────────────────────────────────────────────────────────────┐
│                    STATUS: ✅ COMPLETE                          │
└─────────────────────────────────────────────────────────────────┘

✅ Backend API - 4 endpoints
✅ Database model - ModulePermission
✅ Permission middleware - requireAdminOrModulePermission
✅ All 9 modules protected
✅ Frontend UI - Beautiful admin interface
✅ Dynamic sidebar - Shows only assigned modules
✅ Security - Admin-only, granular permissions
✅ Audit logging - All changes tracked

🎊 SYSTEM IS 100% READY TO USE! 🎊
```
