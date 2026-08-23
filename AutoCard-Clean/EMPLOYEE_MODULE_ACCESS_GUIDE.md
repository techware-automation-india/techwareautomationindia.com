# 🎯 Employee Module Access - Complete Guide

## Status Summary

### ✅ Already Working:
1. **Backend Permission Middleware** - `checkModulePermission.js` created
2. **Employee Management Module** - Accepts permissions, hides Create/Delete based on access
3. **Access Modules Page** - Shows expandable cards with admin interfaces
4. **API Routes** - Employee routes check permissions

### 🔧 What You Need to Test:

#### 1. **Backend Restart Required**
```bash
cd backend
npm run dev
```

#### 2. **Frontend Restart Required**  
```bash
cd frontend
npm run dev
```

#### 3. **Admin Setup**
- Login as admin@techware.com / Admin@123
- Go to **Roles & Access**
- Select employee
- Assign **"Employee Management"** module with:
  - ✅ View
  - ✅ Create
  - ✅ Edit
  - ✅ Delete

#### 4. **Employee Test**
- Login as employee (e.g., employee@techware.com / Employee@123)
- Go to **Access Modules**
- Click **"Employee Management"** card
- Card will expand
- You should see:
  - 📋 Employee list (View permission)
  - ➕ Create new employee form (Create permission)
  - 🗑️ Delete button on each employee (Delete permission)

---

## 🎮 How It Works Now

### Access Modules Page Flow:

```
Employee Panel → Access Modules
                      ↓
┌────────────────────────────────────────────────┐
│  Access Modules                                │
│  [Search box]                                  │
├────────────────────────────────────────────────┤
│  📊 Stats: 1 Accessible, 9 Restricted         │
├────────────────────────────────────────────────┤
│  Your Accessible Modules (1)                   │
├────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────┐ │
│  │ 👥 Employee Management          [▼]     │ │
│  │ Manage employee records                 │ │
│  │ ✓ View ✓ Create ✓ Edit ✓ Delete       │ │
│  │ 💡 Click to expand                      │ │
│  └──────────────────────────────────────────┘ │
│                                                 │
│  [Click the card]                              │
│                      ↓                          │
│  ┌──────────────────────────────────────────┐ │
│  │ 👥 Employee Management          [▲]     │ │
│  │ 📂 Expanded                              │ │
│  ├──────────────────────────────────────────┤ │
│  │ 🔐 Your Permissions:            [X]     │ │
│  │ ✓ View Data ✓ Create ✓ Edit ✓ Delete  │ │
│  ├──────────────────────────────────────────┤ │
│  │                                          │ │
│  │  ┌────────────────────────────────────┐ │ │
│  │  │  ADMIN EMPLOYEE INTERFACE          │ │ │
│  │  │  ────────────────────────────────  │ │ │
│  │  │  📊 Stats: Total, Pending, etc.   │ │ │
│  │  │                                    │ │ │
│  │  │  ➕ Create New Employee Form       │ │ │
│  │  │  [Full Name] [Code] [Email]...    │ │ │
│  │  │  [Create Employee Button]          │ │ │
│  │  │                                    │ │ │
│  │  │  📋 Employee List                  │ │ │
│  │  │  - Aakash Kumar  EMP-001  [🗑️]    │ │ │
│  │  │  - John Doe      EMP-002  [🗑️]    │ │ │
│  │  └────────────────────────────────────┘ │ │
│  │                                          │ │
│  └──────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## 🔐 Permission Control Logic

### Backend (API Routes):

**File:** `backend/src/middleware/checkModulePermission.js`

```javascript
// Admin → Always full access
if (user.role === "ADMIN") return next();

// Employee → Check module_permissions table
const permission = await prisma.modulePermission.findUnique({
  where: { userId_moduleKey: { userId, moduleKey } }
});

if (permission && permission.canView) return next();
else return 403 Forbidden;
```

### Frontend (Component Props):

**File:** `frontend/src/admin/pages/Employee.jsx`

```javascript
const Employee = ({ employeePermissions = null }) => {
  // If admin, all permissions = true
  // If employee, use assigned permissions
  const permissions = employeePermissions || {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
  };

  // Conditionally show UI
  {permissions.canCreate && <CreateForm />}
  {permissions.canDelete && <DeleteButton />}
}
```

---

## 📋 Complete Module Status

| Module | Backend API | Frontend Component | Permissions Working |
|--------|-------------|-------------------|---------------------|
| Employee Management | ✅ | ✅ | ✅ |
| Customer Management | ⚠️ Need to add | ⚠️ Need to update | ❌ |
| Requests | ⚠️ Need to add | ⚠️ Need to update | ❌ |
| Leave Policy | ⚠️ Need to add | ⚠️ Need to update | ❌ |
| Holidays | ⚠️ Need to add | ⚠️ Need to update | ❌ |
| Attendance | ⚠️ Need to add | ⚠️ Need to update | ❌ |
| Projects | ⚠️ Need to add | ⚠️ Need to update | ❌ |
| Shift & Location | ⚠️ Need to add | ⚠️ Need to update | ❌ |
| Roster | ⚠️ Need to add | ⚠️ Need to update | ❌ |

---

## 🚀 Testing Steps

### 1. Backend Setup (Terminal 1):
```bash
cd backend
npm run dev
```

### 2. Frontend Setup (Terminal 2):
```bash
cd frontend  
npm run dev
```

### 3. Admin Login:
- URL: http://localhost:5173/login/admin
- Email: admin@techware.com
- Password: Admin@123

### 4. Assign Module:
- Go to: Admin Panel → Roles & Access
- Select employee from dropdown
- Find "Employee Management" row
- Check all 4 boxes: ✅ View ✅ Create ✅ Edit ✅ Delete
- Click **"Save Permissions"**
- You'll see: "Permissions saved for [Employee Name]"

### 5. Employee Login:
- Logout
- URL: http://localhost:5173/login/employee
- Email: employee@techware.com (or the one you created)
- Password: Employee@123

### 6. Test Access Modules:
- Click **"Access Modules"** in sidebar
- You should see 1 accessible module card
- Click the **"Employee Management"** card
- Card expands showing admin interface
- Try creating an employee
- Try deleting an employee
- Both should work!

### 7. Test Permission Restrictions:
- Go back to admin
- Remove "Create" permission for employee
- Save
- Login as employee again
- Expand Employee Management
- **Create form should NOT be visible**
- But employee list should still be visible (View permission)

---

## 🐛 Common Issues & Fixes

### Issue 1: "403 Forbidden" when accessing module
**Cause:** Employee doesn't have permission in database  
**Fix:** Admin needs to assign permission via Roles & Access page

### Issue 2: Module doesn't expand
**Cause:** Component not imported in AccessModules.jsx  
**Fix:** Check imports at top of `frontend/src/employee/pages/AccessModules.jsx`

### Issue 3: Create/Delete buttons not showing despite permission
**Cause:** Component doesn't accept `employeePermissions` prop  
**Fix:** Component needs to be updated like Employee.jsx was updated

### Issue 4: Backend returns 401 Unauthorized
**Cause:** Token expired or not sent  
**Fix:** Logout and login again

---

## 📝 Next Steps to Make ALL Modules Work

### For Each Module (Customer, Requests, Leave, etc.):

#### 1. Update Backend Route:
```javascript
import { requireAdminOrModulePermission } from "../middleware/checkModulePermission.js";

router.get("/", requireAdminOrModulePermission("customer", "canView"), async (req, res) => {
  // ... list customers
});

router.post("/", requireAdminOrModulePermission("customer", "canCreate"), async (req, res) => {
  // ... create customer
});

router.delete("/:id", requireAdminOrModulePermission("customer", "canDelete"), async (req, res) => {
  // ... delete customer
});
```

#### 2. Update Frontend Component:
```javascript
const Customer = ({ employeePermissions = null, isEmployeeView = false }) => {
  const permissions = employeePermissions || {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
  };

  return (
    <div>
      {/* Always show list if canView */}
      <CustomerList />
      
      {/* Only show form if canCreate */}
      {permissions.canCreate && <CreateCustomerForm />}
      
      {/* Only show delete if canDelete */}
      {permissions.canDelete && <DeleteButton />}
    </div>
  );
};
```

---

## ✅ Current Implementation Summary

### Files Modified:
1. ✅ `backend/src/middleware/checkModulePermission.js` - Created
2. ✅ `backend/src/routes/employees.js` - Updated to use permission middleware
3. ✅ `frontend/src/admin/pages/Employee.jsx` - Accepts employeePermissions prop
4. ✅ `frontend/src/admin/pages/EmployeeList.jsx` - Accepts employeePermissions prop
5. ✅ `frontend/src/employee/pages/AccessModules.jsx` - Expandable interface with embedded components

### How to Use Right Now:
1. Restart backend and frontend
2. Admin assigns "Employee Management" to employee with all permissions
3. Employee opens Access Modules
4. Employee clicks Employee Management card
5. Card expands with full admin interface
6. Employee can create, view, delete employees!

---

**🎊 Employee can now work on assigned modules like admin! Test it and let me know if you need any other modules updated! 🎊**
