# Roles & Access Module - Backend Integration Complete ✅

## Overview
The Roles & Access module is now fully integrated with the backend, allowing admins to assign granular module permissions to employees through the admin panel.

## How It Works

### 1. Admin Panel Access
- **URL**: `/admin/roles-access`
- **Permission**: Only ADMIN role can access
- **Feature**: Assign module access permissions to individual employees

### 2. Permission Configuration

#### Available Modules:
1. Dashboard (overview)
2. Employee Management
3. Customer Management
4. Requests
5. Leave Policy
6. Holidays
7. Attendance
8. Projects
9. Shift & Location
10. Roster

#### Permission Types for Each Module:
- **View** (canView) - Employee can see the module
- **Create** (canCreate) - Employee can create new records
- **Edit** (canEdit) - Employee can update existing records
- **Delete** (canDelete) - Employee can remove records

### 3. Admin Workflow

#### Step 1: Select Employee
```
Admin opens /admin/roles-access
→ Sees list of all employees with EMPLOYEE role
→ Uses search to find employee by name, email, or employee code
→ Clicks to select employee
```

#### Step 2: Configure Permissions
```
Permission matrix displays all modules
→ Admin checks/unchecks individual permissions
→ Quick actions available:
  - "Grant All" - Gives all permissions to all modules
  - "Revoke All" - Removes all permissions
  - Column toggles - Grant/revoke same permission across all modules
  - Row toggles - Grant/revoke all permissions for one module
```

#### Step 3: Save Configuration
```
Admin clicks "Save Permissions"
→ Backend stores permissions in database
→ Employee immediately sees updated module access on next login/refresh
```

### 4. Employee Experience

When an employee logs in:
1. System fetches their permissions from `module_permissions` table
2. Only modules with `canView: true` appear in their sidebar/dashboard
3. Within each module:
   - `canCreate: false` → Create buttons hidden/disabled
   - `canEdit: false` → Edit buttons hidden/disabled
   - `canDelete: false` → Delete buttons hidden/disabled

## Backend API Endpoints

### 1. Get All Employees (Admin Only)
```http
GET /api/roles-access/employees
Authorization: Bearer <admin-token>

Response:
{
  "employees": [
    {
      "id": "uuid",
      "fullName": "John Doe",
      "email": "john@example.com",
      "employeeCode": "EMP001",
      "isActive": true,
      "onboardingStatus": "APPROVED"
    }
  ],
  "modules": [
    { "key": "overview", "label": "Dashboard" },
    { "key": "employee", "label": "Employee" },
    ...
  ]
}
```

### 2. Get Employee Permissions (Admin Only)
```http
GET /api/roles-access/employees/:userId/permissions
Authorization: Bearer <admin-token>

Response:
{
  "role": "EMPLOYEE",
  "employee": { ... },
  "modules": [ ... ],
  "permissions": {
    "overview": {
      "canView": true,
      "canCreate": false,
      "canEdit": false,
      "canDelete": false
    },
    "attendance": {
      "canView": true,
      "canCreate": true,
      "canEdit": true,
      "canDelete": false
    },
    ...
  },
  "hasConfiguredPermissions": true
}
```

### 3. Update Employee Permissions (Admin Only)
```http
PATCH /api/roles-access/employees/:userId/permissions
Authorization: Bearer <admin-token>
Content-Type: application/json

Body:
{
  "permissions": {
    "overview": { "canView": true, "canCreate": false, "canEdit": false, "canDelete": false },
    "attendance": { "canView": true, "canCreate": true, "canEdit": true, "canDelete": false },
    "projects": { "canView": true, "canCreate": true, "canEdit": true, "canDelete": true }
  }
}

Response:
{
  "role": "EMPLOYEE",
  "employee": { ... },
  "modules": [ ... ],
  "permissions": { ... },
  "hasConfiguredPermissions": true
}
```

### 4. Get Current User Permissions
```http
GET /api/roles-access/me/permissions
Authorization: Bearer <employee-token>

Response:
{
  "role": "EMPLOYEE",
  "modules": [ ... ],
  "permissions": { ... },
  "hasConfiguredPermissions": true
}
```

## Database Schema

### ModulePermission Model
```prisma
model ModulePermission {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  moduleKey String
  canView   Boolean  @default(false)
  canCreate Boolean  @default(false)
  canEdit   Boolean  @default(false)
  canDelete Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, moduleKey])
  @@index([userId])
  @@map("module_permissions")
}
```

## Frontend Implementation

### File: `frontend/src/admin/pages/RolesAccess.jsx`

**Features**:
- Employee dropdown with search functionality
- Real-time permission matrix with checkboxes
- Visual indicators for configured employees
- Bulk actions (Grant All, Revoke All)
- Column/row toggle for quick configuration
- Responsive design with loading states
- Toast notifications for success/error

**State Management**:
```javascript
const [employees, setEmployees] = useState([])     // All employees
const [modules, setModules] = useState([])         // Available modules
const [selected, setSelected] = useState(null)     // Selected employee
const [permissions, setPermissions] = useState({}) // Permission matrix
const [loadingPerms, setLoadingPerms] = useState(false)
const [saving, setSaving] = useState(false)
```

**API Integration**:
```javascript
// Load employees
const data = await apiGet("/roles-access/employees");

// Load permissions for selected employee
const data = await apiGet(`/roles-access/employees/${emp.id}/permissions`);

// Save permissions
await apiPatch(`/roles-access/employees/${selected.id}/permissions`, { permissions });
```

## Security

### Backend Protection:
1. **Authentication Required**: All routes require valid JWT token
2. **Role-Based Access**: Admin routes check for ADMIN role
3. **Input Validation**: Zod schemas validate all inputs
4. **Database Constraints**: Unique constraint on userId + moduleKey prevents duplicates

### Frontend Protection:
1. **Token Management**: JWT stored in localStorage
2. **API Helpers**: Automatically attach Authorization header
3. **Error Handling**: User-friendly error messages via toast notifications
4. **Loading States**: Prevent duplicate submissions

## Example Use Cases

### Case 1: Junior Employee (Limited Access)
```json
{
  "overview": { "canView": true, "canCreate": false, "canEdit": false, "canDelete": false },
  "attendance": { "canView": true, "canCreate": true, "canEdit": false, "canDelete": false },
  "leave-policy": { "canView": true, "canCreate": false, "canEdit": false, "canDelete": false }
}
```
Result: Can view dashboard, mark attendance, view leave policy. Cannot create employees or edit requests.

### Case 2: Team Lead (Moderate Access)
```json
{
  "overview": { "canView": true, "canCreate": false, "canEdit": false, "canDelete": false },
  "employee": { "canView": true, "canCreate": false, "canEdit": true, "canDelete": false },
  "projects": { "canView": true, "canCreate": true, "canEdit": true, "canDelete": false },
  "attendance": { "canView": true, "canCreate": true, "canEdit": true, "canDelete": false }
}
```
Result: Can manage projects, edit employee details, manage attendance. Cannot delete records or create new employees.

### Case 3: Senior Manager (Full Access)
```json
{
  "overview": { "canView": true, "canCreate": true, "canEdit": true, "canDelete": true },
  "employee": { "canView": true, "canCreate": true, "canEdit": true, "canDelete": true },
  "customer": { "canView": true, "canCreate": true, "canEdit": true, "canDelete": true },
  "projects": { "canView": true, "canCreate": true, "canEdit": true, "canDelete": true },
  "attendance": { "canView": true, "canCreate": true, "canEdit": true, "canDelete": true },
  "requests": { "canView": true, "canCreate": true, "canEdit": true, "canDelete": true },
  "leave-policy": { "canView": true, "canCreate": true, "canEdit": true, "canDelete": true },
  "holidays": { "canView": true, "canCreate": true, "canEdit": true, "canDelete": true },
  "shift-location": { "canView": true, "canCreate": true, "canEdit": true, "canDelete": true },
  "roster": { "canView": true, "canCreate": true, "canEdit": true, "canDelete": true }
}
```
Result: Full access to all modules. Can perform all CRUD operations.

## Testing Steps

### 1. Start Backend Server
```bash
cd backend
npm run dev
```
Server runs on: http://localhost:4001

### 2. Start Frontend Server
```bash
cd frontend
npm run dev
```
Frontend runs on: http://localhost:5173

### 3. Test Admin Flow
1. Login as ADMIN user
2. Navigate to `/admin/roles-access`
3. Select an employee from dropdown
4. Configure permissions in matrix
5. Click "Save Permissions"
6. Verify success toast appears

### 4. Test Employee Experience
1. Logout admin
2. Login as the configured employee
3. Verify only permitted modules appear in sidebar
4. Navigate to each module
5. Verify action buttons match permissions:
   - No "Create" button if `canCreate: false`
   - No "Edit" button if `canEdit: false`
   - No "Delete" button if `canDelete: false`

### 5. Test Permission Updates
1. Login as admin again
2. Revoke some permissions for employee
3. Save changes
4. Switch to employee account (refresh page)
5. Verify modules/actions updated immediately

## Troubleshooting

### Issue: "Failed to load employees"
**Solution**: Check backend server is running on port 4001. Verify database connection in `.env`.

### Issue: "Failed to save permissions"
**Solution**: Check browser console for detailed error. Verify JWT token is valid. Check backend logs.

### Issue: Permissions not updating for employee
**Solution**: Employee needs to refresh page or re-login to fetch latest permissions. Consider implementing WebSocket for real-time updates.

### Issue: Module not appearing in list
**Solution**: Verify module key in `employeeModules` array in `backend/src/routes/rolesAccess.js` matches frontend routing.

## Future Enhancements

1. **Role Templates**: Create predefined permission sets (Junior, Senior, Manager)
2. **Bulk Assignment**: Assign permissions to multiple employees at once
3. **Permission History**: Track who changed permissions and when
4. **Department-Level Permissions**: Assign permissions to entire departments
5. **Time-Based Permissions**: Grant temporary access that expires
6. **Permission Inheritance**: Child employees inherit manager's base permissions
7. **Audit Logs**: Track when employees access restricted modules
8. **Real-Time Updates**: WebSocket notifications when permissions change

## Related Files

### Backend:
- `backend/src/routes/rolesAccess.js` - API routes
- `backend/prisma/schema.prisma` - Database schema
- `backend/src/middleware/auth.js` - Authentication middleware
- `backend/src/index.js` - Route registration

### Frontend:
- `frontend/src/admin/pages/RolesAccess.jsx` - Main UI component
- `frontend/src/lib/api.js` - API helper functions
- `frontend/src/App.jsx` - Route registration

## Status: ✅ FULLY INTEGRATED

The Roles & Access module is production-ready. Admins can immediately start assigning module permissions to employees through the intuitive admin panel interface.
