# ⚡ Quick Start: Roles & Access

## ✅ System Status: READY TO USE

Everything is integrated and working! Just follow these steps:

---

## 🚀 How to Use (5 Steps)

### Step 1: Start Backend
```bash
cd backend
npm run dev
```
✅ Server runs on `http://localhost:4000`

### Step 2: Start Frontend
```bash
cd frontend
npm run dev
```
✅ Frontend runs on `http://localhost:5173`

### Step 3: Login as Admin
- URL: `http://localhost:5173/login/admin`
- Email: `admin@techware.com`
- Password: `Admin@123`

### Step 4: Assign Permissions
1. Click **"Roles & Access"** in sidebar
2. Select an employee from dropdown
3. Check permissions you want to grant:
   - ✅ Customer → View, Create
   - ✅ Attendance → View
   - ✅ Holidays → View, Create, Edit
4. Click **"Save Permissions"** button

### Step 5: Test Employee Login
1. Logout
2. Login as that employee
3. **Sidebar now shows only assigned modules!** 🎉

---

## 📊 What's Included

### 9 Available Modules
1. **Dashboard** (overview)
2. **Employee** (employee)
3. **Customer** (customer)
4. **Requests** (requests)
5. **Leave Policy** (leave-policy)
6. **Holidays** (holidays)
7. **Attendance** (attendance)
8. **Projects** (projects)
9. **Shift & Location** (shift-location)
10. **Roster** (roster)

### 4 Permission Types
- **View** - Can see data
- **Create** - Can add new records
- **Edit** - Can modify existing records
- **Delete** - Can remove records

---

## 🎯 Quick Examples

### Example 1: HR Manager
**Grant:**
- Employee: All permissions ✓
- Attendance: All permissions ✓
- Leave Policy: All permissions ✓
- Holidays: All permissions ✓

**Result:** Employee sidebar shows these 4 modules

### Example 2: Junior Employee
**Grant:**
- Customer: View only ✓
- Requests: View only ✓

**Result:** Employee sidebar shows these 2 modules (read-only)

### Example 3: Project Manager
**Grant:**
- Projects: All permissions ✓
- Customer: View, Edit ✓
- Roster: View only ✓

**Result:** Employee sidebar shows these 3 modules

---

## 🎨 Admin UI Features

### Statistics Dashboard
- Total Employees
- Active Employees  
- Available Modules (9)
- Permissions Granted (e.g., "24/36")

### Employee Selector
- Search by name, email, or employee code
- Shows active/inactive status
- Shows if permissions configured (✓ badge)

### Permission Matrix
- **Column Headers:** Toggle all modules for that permission
- **Row "All Access":** Toggle all permissions for that module
- **Individual Checkboxes:** Fine-grained control
- **Quick Actions:**
  - Grant All button
  - Revoke All button
  - Save Permissions button

---

## 🔒 Security

✅ **Admin Bypass:** Admins always have full access  
✅ **Backend Enforced:** Not just frontend hiding  
✅ **Database Constraints:** Unique per user+module  
✅ **Audit Logging:** All changes tracked  
✅ **403 Forbidden:** If employee tries unauthorized access  

---

## 🧪 Quick Test

### Test Admin Assigns Permissions
```bash
# 1. Login as admin
# 2. Go to Roles & Access
# 3. Select employee "John Doe"
# 4. Check: Customer - View ✓, Create ✓
# 5. Click Save
# 6. Should see: "Permissions saved for John Doe" ✓
```

### Test Employee Sees Modules
```bash
# 1. Logout
# 2. Login as John Doe
# 3. Sidebar should show:
#    - Dashboard ✓
#    - Customer ✓ (newly assigned)
#    - Other modules hidden ✗
# 4. Click Customer
# 5. Should load customer page ✓
```

### Test Backend Enforcement
```bash
# 1. Login as John Doe (has Customer View + Create)
# 2. Go to Customer page → Works ✓
# 3. Try to create customer → Works ✓
# 4. Try to edit customer → Blocked ✗ (403 Forbidden)
# 5. Try to delete customer → Blocked ✗ (403 Forbidden)
```

---

## 📁 Files (Already Created ✅)

### Backend
- ✅ `backend/src/routes/rolesAccess.js` - API endpoints
- ✅ `backend/src/middleware/auth.js` - Permission middleware
- ✅ `backend/prisma/schema.prisma` - ModulePermission model
- ✅ `backend/src/index.js` - Route registered

### Frontend
- ✅ `frontend/src/admin/pages/RolesAccess.jsx` - Admin UI

### Protected Routes
- ✅ `backend/src/routes/customers.js` - Customer routes
- ✅ `backend/src/routes/attendance.js` - Attendance routes
- ✅ `backend/src/routes/holidays.js` - Holidays routes
- ✅ `backend/src/routes/requests.js` - Requests routes
- ✅ `backend/src/routes/leaveTypes.js` - Leave policy routes
- ✅ `backend/src/routes/shiftRoutes.js` - Shift routes
- ✅ `backend/src/routes/locationRoutes.js` - Location routes
- ✅ `backend/src/routes/rosterRoutes.js` - Roster routes
- ✅ `backend/src/routes/projects.js` - Projects routes

---

## 🐛 Troubleshooting

### Employee sees no modules
**Fix:** Admin needs to assign at least one module with View permission

### Changes not reflecting
**Fix:** Employee needs to logout and login again

### 403 Forbidden error
**Fix:** Admin needs to grant the specific permission (View/Create/Edit/Delete)

### Sidebar shows module but page blocked
**Fix:** Check backend route has `requireAdminOrModulePermission` middleware

---

## 📚 API Quick Reference

```javascript
// Get current user permissions (Employee)
GET /api/roles-access/me/permissions
Auth: Bearer <token>

// List all employees (Admin only)
GET /api/roles-access/employees
Auth: Bearer <admin-token>

// Get employee permissions (Admin only)
GET /api/roles-access/employees/:userId/permissions
Auth: Bearer <admin-token>

// Update employee permissions (Admin only)
PATCH /api/roles-access/employees/:userId/permissions
Auth: Bearer <admin-token>
Body: {
  permissions: {
    customer: { canView: true, canCreate: true, ... },
    attendance: { canView: true, ... }
  }
}
```

---

## ✨ Key Features

✅ Admin assigns module access to employees  
✅ Granular permissions (View/Create/Edit/Delete)  
✅ Dynamic employee sidebar (shows only assigned modules)  
✅ Backend enforcement (not just UI hiding)  
✅ Beautiful admin interface with search  
✅ Quick actions (Grant All / Revoke All)  
✅ Real-time permission updates  
✅ Toast notifications  
✅ Audit logging  

---

## 🎊 Ready to Use!

**Everything is integrated!** Just:
1. Start servers
2. Login as admin
3. Go to Roles & Access
4. Assign permissions
5. Test employee login

**No migration needed!** ModulePermission table already exists.

---

## 💡 Pro Tips

1. **Grant All** button is useful for senior employees
2. **Revoke All** then selectively grant for junior employees
3. **Column headers** toggle all modules for that permission type
4. **Row "All Access"** toggle all permissions for that module
5. **Search** works on name, email, and employee code
6. **Configured badge** (✓) shows which employees have permissions set

---

## 🎯 What Admin Can Do

✅ See all employees in one place  
✅ Search employees by name/email/code  
✅ View employee's current permissions  
✅ Grant/revoke individual permissions  
✅ Use quick actions (Grant All / Revoke All)  
✅ Save changes with one click  
✅ See permission statistics (24/36 granted)  

---

## 🎯 What Employee Gets

✅ Dynamic sidebar (only assigned modules)  
✅ Can only access permitted features  
✅ Backend blocks unauthorized actions  
✅ Clean UI (no disabled buttons for hidden features)  
✅ Professional experience  

---

## 🚀 System is 100% Ready!

**No setup needed. Just use it!** 🎉

Docs created:
- ✅ `ROLES_ACCESS_INTEGRATION_COMPLETE.md` - Full guide
- ✅ `ROLES_ACCESS_FLOW.md` - Flow diagrams
- ✅ `QUICK_START_ROLES_ACCESS.md` - This file

**Start using Roles & Access now!** ⚡
