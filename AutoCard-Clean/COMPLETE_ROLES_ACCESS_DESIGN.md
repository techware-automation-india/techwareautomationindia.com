# 🎯 Complete Roles & Access System Design

## 📊 All Admin Modules Analysis

Based on your HRMS system, here are all 12 modules:

### 1. **Dashboard (overview)** 
- **Purpose:** Overview of all admin activity and key metrics
- **Features:** Stats, charts, summaries
- **Permissions Needed:**
  - ✅ **View** - See dashboard metrics
  - ❌ Create/Edit/Delete - Not applicable

### 2. **Employee (employee)**
- **Purpose:** Create and manage employee records
- **Features:** 
  - Create new employees
  - View employee list
  - Delete employees
  - View onboarding status
- **Permissions Needed:**
  - ✅ **View** - See employee list
  - ✅ **Create** - Add new employees
  - ✅ **Edit** - Modify employee details
  - ✅ **Delete** - Remove employees

### 3. **Customer (customer)**
- **Purpose:** Create and manage customer records
- **Features:**
  - Create customers
  - View customer list
  - Delete customers
- **Permissions Needed:**
  - ✅ **View** - See customer list
  - ✅ **Create** - Add new customers
  - ✅ **Edit** - Modify customer details
  - ✅ **Delete** - Remove customers

### 4. **Requests (requests)**
- **Purpose:** Review and act on incoming employee requests
- **Features:**
  - View all requests
  - Approve/reject requests
  - Delete requests
- **Permissions Needed:**
  - ✅ **View** - See all requests
  - ✅ **Create** - Submit requests (if employee)
  - ✅ **Edit** - Approve/reject/update status
  - ✅ **Delete** - Remove requests

### 5. **Leave Requests (leave-requests)**
- **Purpose:** Review and approve employee leave applications
- **Features:**
  - View leave requests
  - Approve/reject leaves
  - See leave history
- **Permissions Needed:**
  - ✅ **View** - See leave requests
  - ✅ **Create** - N/A (employees create from their panel)
  - ✅ **Edit** - Approve/reject leaves
  - ✅ **Delete** - Cancel leave requests

### 6. **Leave Policy (leave-policy)**
- **Purpose:** Define leave types, balances, and rules
- **Features:**
  - Create leave types (Sick, Casual, etc.)
  - Set days per year
  - Manage leave balances
- **Permissions Needed:**
  - ✅ **View** - See leave policies
  - ✅ **Create** - Add new leave types
  - ✅ **Edit** - Modify leave rules
  - ✅ **Delete** - Remove leave types

### 7. **Holidays (holidays)**
- **Purpose:** Manage the company holiday calendar
- **Features:**
  - Add holidays
  - View holiday list
  - Delete holidays
- **Permissions Needed:**
  - ✅ **View** - See holiday calendar
  - ✅ **Create** - Add new holidays
  - ✅ **Edit** - Modify holiday details
  - ✅ **Delete** - Remove holidays

### 8. **Attendance (attendance)**
- **Purpose:** Track and review employee attendance
- **Features:**
  - View attendance records
  - Manual attendance entry
  - Edit attendance
  - Delete records
- **Permissions Needed:**
  - ✅ **View** - See attendance records
  - ✅ **Create** - Manual attendance entry
  - ✅ **Edit** - Modify attendance
  - ✅ **Delete** - Remove attendance records

### 9. **Projects (projects)**
- **Purpose:** Create projects and assign team members
- **Features:**
  - Create projects
  - Assign employees
  - View project list
  - Delete projects
- **Permissions Needed:**
  - ✅ **View** - See all projects
  - ✅ **Create** - Add new projects
  - ✅ **Edit** - Modify projects/assignments
  - ✅ **Delete** - Remove projects

### 10. **Roles & Access (roles-access)**
- **Purpose:** Configure roles and permission levels
- **Features:**
  - Assign module permissions
  - View all employees
  - Grant/revoke access
- **Permissions Needed:**
  - ✅ **View** - See permission matrix
  - ✅ **Edit** - Modify permissions
  - ❌ Create/Delete - Not applicable
  - **⚠️ SPECIAL:** Should only be accessible to ADMIN role

### 11. **Shift & Location (shift-location)**
- **Purpose:** Manage work shifts and office locations
- **Features:**
  - Create shifts
  - Add locations
  - View all shifts/locations
  - Delete shifts/locations
- **Permissions Needed:**
  - ✅ **View** - See shifts and locations
  - ✅ **Create** - Add new shifts/locations
  - ✅ **Edit** - Modify shift times/location details
  - ✅ **Delete** - Remove shifts/locations

### 12. **Roster (roster)**
- **Purpose:** Plan and assign employee work rosters
- **Features:**
  - Create roster entries
  - Assign shifts to employees
  - View roster calendar
  - Delete roster entries
- **Permissions Needed:**
  - ✅ **View** - See roster calendar
  - ✅ **Create** - Add roster entries
  - ✅ **Edit** - Modify roster assignments
  - ✅ **Delete** - Remove roster entries

---

## 🎨 Updated Roles & Access UI Design

### Current RolesAccess.jsx Structure:

```jsx
<RolesAccess>
  ├── Employee Selector (dropdown)
  ├── Permission Matrix Table
  │   ├── Column: MODULE
  │   ├── Column: VIEW
  │   ├── Column: CREATE  
  │   ├── Column: EDIT
  │   ├── Column: DELETE
  │   └── Column: ALL ACCESS
  ├── Module Rows (10 modules currently)
  └── Action Buttons (Grant All, Revoke All, Save)
</RolesAccess>
```

### ✅ Recommended Module List for Roles & Access:

| # | Module Key | Display Name | View | Create | Edit | Delete | Notes |
|---|------------|--------------|------|--------|------|--------|-------|
| 1 | `overview` | Dashboard | ✅ | ❌ | ❌ | ❌ | Read-only |
| 2 | `employee` | Employee Management | ✅ | ✅ | ✅ | ✅ | Full CRUD |
| 3 | `customer` | Customer Management | ✅ | ✅ | ✅ | ✅ | Full CRUD |
| 4 | `requests` | Employee Requests | ✅ | ✅ | ✅ | ✅ | Full CRUD |
| 5 | `leave-requests` | Leave Requests | ✅ | ❌ | ✅ | ✅ | Approve/Reject |
| 6 | `leave-policy` | Leave Policy | ✅ | ✅ | ✅ | ✅ | Full CRUD |
| 7 | `holidays` | Holidays | ✅ | ✅ | ✅ | ✅ | Full CRUD |
| 8 | `attendance` | Attendance | ✅ | ✅ | ✅ | ✅ | Full CRUD |
| 9 | `projects` | Projects | ✅ | ✅ | ✅ | ✅ | Full CRUD |
| 10 | `shift-location` | Shift & Location | ✅ | ✅ | ✅ | ✅ | Full CRUD |
| 11 | `roster` | Roster | ✅ | ✅ | ✅ | ✅ | Full CRUD |

**⚠️ EXCLUDED:** `roles-access` - Should remain ADMIN-only, not assignable

---

## 🔧 Implementation Plan

### Phase 1: Update Backend Routes ✅ (Done for Employee)

**Pattern for each module:**
```javascript
// backend/src/routes/[module].js
import { requireAdminOrModulePermission } from "../middleware/checkModulePermission.js";

router.get("/", requireAdminOrModulePermission("[moduleKey]", "canView"), async (req, res) => {
  // List items
});

router.post("/", requireAdminOrModulePermission("[moduleKey]", "canCreate"), async (req, res) => {
  // Create item
});

router.put("/:id", requireAdminOrModulePermission("[moduleKey]", "canEdit"), async (req, res) => {
  // Update item
});

router.delete("/:id", requireAdminOrModulePermission("[moduleKey]", "canDelete"), async (req, res) => {
  // Delete item
});
```

### Phase 2: Update Frontend Components ✅ (Done for Employee)

**Pattern for each module:**
```jsx
const ModuleName = ({ employeePermissions = null, isEmployeeView = false }) => {
  const permissions = employeePermissions || {
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
  };

  return (
    <div>
      {/* Always show list if canView */}
      <DataList />
      
      {/* Conditionally show create form */}
      {permissions.canCreate && <CreateForm />}
      
      {/* Conditionally show edit button */}
      {permissions.canEdit && <EditButton />}
      
      {/* Conditionally show delete button */}
      {permissions.canDelete && <DeleteButton />}
    </div>
  );
};
```

### Phase 3: Create Employee Wrappers ✅ (Done for Employee)

**Pattern:**
```jsx
// frontend/src/employee/pages/[ModuleName].jsx
import AdminModule from "../../admin/pages/[ModuleName].jsx";

const EmployeeModuleName = () => {
  const [permissions, setPermissions] = useState(null);
  
  useEffect(() => {
    // Load permissions from API
    const data = await apiGet("/roles-access/me/permissions");
    setPermissions(data.permissions?.[moduleKey]);
  }, []);

  if (!permissions?.canView) {
    return <AccessDenied />;
  }

  return (
    <div>
      <PermissionBanner permissions={permissions} />
      <AdminModule employeePermissions={permissions} isEmployeeView={true} />
    </div>
  );
};
```

### Phase 4: Update Sidebar Dynamic Loading ✅ (Working)

Employee sidebar already loads modules dynamically based on permissions.

---

## 📋 Module Implementation Checklist

| Module | Backend Routes | Frontend Component | Employee Wrapper | Tested |
|--------|---------------|-------------------|------------------|--------|
| Employee | ✅ | ✅ | ✅ | ⏳ |
| Customer | ⏳ | ⏳ | ⏳ | ❌ |
| Requests | ⏳ | ⏳ | ⏳ | ❌ |
| Leave Requests | ⏳ | ⏳ | ⏳ | ❌ |
| Leave Policy | ⏳ | ⏳ | ⏳ | ❌ |
| Holidays | ⏳ | ⏳ | ⏳ | ❌ |
| Attendance | ⏳ | ⏳ | ⏳ | ❌ |
| Projects | ⏳ | ⏳ | ⏳ | ❌ |
| Shift & Location | ⏳ | ⏳ | ⏳ | ❌ |
| Roster | ⏳ | ⏳ | ⏳ | ❌ |

---

## 🎯 Special Considerations

### 1. **Dashboard (overview)**
- Should be **View-only** 
- No Create/Edit/Delete needed
- Shows aggregated stats from other modules
- **Recommendation:** Make it always visible to employees (default module)

### 2. **Roles & Access (roles-access)**
- Should be **ADMIN-ONLY**
- Never show in Roles & Access assignment page
- This prevents employees from giving themselves permissions
- **Implementation:** Exclude from assignable modules list

### 3. **Leave Requests (leave-requests)**
- **Create permission N/A** - Employees create from their own panel
- **Edit permission** = Approve/Reject capability
- **View permission** = See all employee leave requests
- **Delete permission** = Cancel leave requests

### 4. **Attendance (attendance)**
- Employees already have their own attendance module
- Admin panel attendance = view/edit ALL employee attendance
- **Edit permission** needed for corrections

---

## 🚀 Quick Implementation Priority

### High Priority (Most Used):
1. ✅ Employee - Done
2. Customer
3. Attendance  
4. Leave Requests
5. Holidays

### Medium Priority:
6. Projects
7. Requests
8. Shift & Location
9. Roster

### Low Priority:
10. Leave Policy (usually set once, rarely changed)

---

## 💡 Recommended Default Permissions

### For New Employees:
```javascript
{
  overview: { canView: true },  // Always allow dashboard
  // All other modules: no access by default
}
```

### For Department Heads:
```javascript
{
  overview: { canView: true },
  employee: { canView: true, canEdit: true },  // Manage their team
  attendance: { canView: true, canEdit: true }, // Attendance corrections
  "leave-requests": { canView: true, canEdit: true }, // Approve leaves
  projects: { canView: true, canEdit: true }, // Manage projects
}
```

### For HR Managers:
```javascript
{
  overview: { canView: true },
  employee: { canView: true, canCreate: true, canEdit: true, canDelete: true },
  customer: { canView: true },
  requests: { canView: true, canEdit: true },
  "leave-requests": { canView: true, canEdit: true, canDelete: true },
  "leave-policy": { canView: true, canCreate: true, canEdit: true },
  holidays: { canView: true, canCreate: true, canEdit: true, canDelete: true },
  attendance: { canView: true, canEdit: true },
  "shift-location": { canView: true, canCreate: true, canEdit: true },
  roster: { canView: true, canCreate: true, canEdit: true },
}
```

---

## 📊 Database Schema (Already Exists)

```prisma
model ModulePermission {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  moduleKey String   // "employee", "customer", etc.
  canView   Boolean  @default(false)
  canCreate Boolean  @default(false)
  canEdit   Boolean  @default(false)
  canDelete Boolean  @default(false)
  
  @@unique([userId, moduleKey])
  @@map("module_permissions")
}
```

---

## 🎊 Summary

### Current Status:
- ✅ **1 Module Fully Working:** Employee Management
- ✅ **Architecture Complete:** Backend middleware, frontend components, wrappers
- ✅ **Dynamic Sidebar:** Working
- ⏳ **10 Modules Pending:** Need backend routes + component updates

### Next Steps:
1. Test Employee module thoroughly
2. Apply same pattern to Customer module
3. Then Attendance, Holidays, Leave Requests
4. Finally remaining modules

### Architecture Benefits:
- 🔒 **Secure:** Backend validates every API call
- 🎨 **Consistent:** Same UI for admin and employee
- 🚀 **Scalable:** Easy to add new modules
- 💪 **Flexible:** Granular permissions per module
- 🎯 **User-Friendly:** Employees work exactly like admin

---

**Ab batao - kaunsa module next implement karein? Customer, Attendance, ya koi aur? 🚀**
