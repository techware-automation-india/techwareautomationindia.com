# AccessTab Component

## Overview

The `AccessTab` component provides a comprehensive interface for managing employee role assignments in the Techware Automation application. It allows administrators to view all employees, search and filter them, and assign roles to control their access to various modules.

## Features

### 1. Employee List Display
- Shows all employees with their name, email, and current role
- Displays user avatar with first letter of name
- Color-coded role badges (Admin: red, Employee: blue, Customer: green, Custom: purple)

### 2. Search Functionality
- Real-time search by employee name or email
- Case-insensitive search
- Shows count of filtered results
- Quick clear search button

### 3. Role Filter
- Dropdown to filter employees by role
- Shows "All Roles" option plus all available roles
- Indicates default vs custom roles
- Works in combination with search filter

### 4. Role Assignment
- Each employee row has an "Assign Role" button
- Clicking opens a dropdown showing all available roles
- Currently assigned role is highlighted with a checkmark
- Clicking a role immediately assigns it to the employee
- Success toast notification after assignment

### 5. Responsive Design
- **Desktop (≥768px)**: Full table layout with all columns
- **Mobile (<768px)**: Card-based layout with stacked information
- Touch-friendly buttons (min 44x44px)
- Scrollable table on smaller screens

### 6. Loading & Empty States
- Loading spinner during data fetch
- "No employees match your search" message when filters return no results
- Graceful error handling with toast notifications

## Component Structure

```
AccessTab
├── State Management
│   ├── employees (array)
│   ├── roles (array)
│   ├── loading (boolean)
│   ├── searchQuery (string)
│   ├── selectedRoleFilter (string)
│   └── assigningRoleFor (string|null)
├── Data Loading
│   └── loadData() - Fetches employees and roles
├── Filtering
│   └── filteredEmployees - Memoized filtered list
├── Role Assignment
│   └── handleAssignRole() - Assigns role to employee
└── Render
    ├── Header
    ├── Search & Filter Bar
    ├── Desktop Table (hidden on mobile)
    └── Mobile Cards (hidden on desktop)
```

## API Integration

### Endpoints Used
- `GET /api/users/with-roles` - Fetches all employees with their roles
- `GET /api/roles` - Fetches all available roles
- `PUT /api/users/:id/role` - Assigns a role to an employee

### API Functions
```javascript
import { fetchUsersWithRoles, assignUserRole } from '../../../lib/api/usersApi';
import { fetchRoles } from '../../../lib/api/rolesApi';
```

## Data Flow

1. **Component Mount**
   - Calls `loadData()`
   - Fetches employees and roles in parallel
   - Sets state with fetched data

2. **User Search**
   - User types in search input
   - `searchQuery` state updates
   - `filteredEmployees` memo recalculates
   - UI updates to show filtered results

3. **Role Filter**
   - User selects role from dropdown
   - `selectedRoleFilter` state updates
   - `filteredEmployees` memo recalculates
   - UI updates to show filtered results

4. **Role Assignment**
   - User clicks "Assign Role" button
   - Dropdown opens showing all roles
   - User clicks a role
   - `handleAssignRole()` calls API
   - Employee state updates with new role
   - Success toast shows
   - Dropdown closes

## State Management

### State Variables

```javascript
const [employees, setEmployees] = useState([]);
// Array of employee objects with structure:
// { id, fullName, email, roleId, customRole: { name, isDefault } }

const [roles, setRoles] = useState([]);
// Array of role objects with structure:
// { id, name, isDefault, moduleCount }

const [loading, setLoading] = useState(true);
// Boolean indicating if initial data is loading

const [searchQuery, setSearchQuery] = useState('');
// String containing the search query

const [selectedRoleFilter, setSelectedRoleFilter] = useState('all');
// String: 'all' or roleId of selected filter

const [assigningRoleFor, setAssigningRoleFor] = useState(null);
// String: userId when dropdown is open, null when closed
```

### Derived State

```javascript
const filteredEmployees = useMemo(() => {
  // Filters employees by search query AND role filter
  // Returns filtered array
}, [employees, searchQuery, selectedRoleFilter]);
```

## Helper Functions

### `getRoleName(employee)`
Returns the display name for an employee's role:
- If no role: "No role assigned"
- If customRole exists: customRole.name
- Otherwise: looks up role in roles array
- Fallback: "Unknown role"

### `getRoleBadgeColor(employee)`
Returns Tailwind CSS classes for role badge styling:
- No role: Gray
- Admin: Red
- Employee: Blue
- Customer: Green
- Custom roles: Purple

## UI Components

### Search Bar
- Icon: Search (Lucide)
- Real-time filtering
- Placeholder: "Search by name or email..."
- Full-width on mobile, flex-1 on desktop

### Role Filter Dropdown
- Native `<select>` element
- Shows "All Roles" as default
- Lists all roles with "(Default)" or "(Custom)" indicator
- Fixed width on desktop (sm:w-64)

### Employee Table (Desktop)
- Columns: Name, Email, Current Role, Actions
- Name column: Avatar + full name
- Email column: Plain text
- Role column: Color-coded badge
- Actions column: "Assign Role" button with dropdown

### Employee Cards (Mobile)
- Stacked layout
- Avatar + name/email at top
- Role badge in middle
- Full-width "Assign Role" button at bottom

### Role Assignment Dropdown
- Appears below "Assign Role" button
- Lists all available roles
- Current role highlighted with checkmark and primary color
- Disabled state for current role
- Shows role type and module count
- Backdrop closes dropdown on click

## Styling

### Colors
- Primary: For active states, highlights, and buttons
- Slate: For text, borders, and backgrounds
- Red/Blue/Green/Purple: For role badges
- Dark mode support throughout

### Responsive Breakpoints
- `md:` prefix = 768px and above (desktop)
- Default = below 768px (mobile)

### Touch Targets
- All interactive elements have min 44x44px tap target
- Increased padding on mobile for better usability

## Requirements Satisfied

- ✅ **8.1** - Display all employees with assigned roles
- ✅ **8.2** - Show employee name, email, and current role
- ✅ **8.3** - Display "No role assigned" for employees without roles
- ✅ **8.4** - Filter employees by role
- ✅ **8.5** - Search employees by name or email
- ✅ **10.1** - Table layout with name, email, role, actions columns
- ✅ **10.2** - Dropdown with all available roles for assignment
- ✅ **10.4** - Real-time search input filtering
- ✅ **10.5** - Consistent Tailwind CSS styling
- ✅ **18.1** - Loading states during API calls
- ✅ **19.3** - Mobile responsive with scrollable/card layout
- ✅ **19.4** - Touch-friendly button sizes
- ✅ **19.5** - Readable text on all screen sizes

## Tasks Completed

- ✅ **15.1** - Create AccessTab component with state management
- ✅ **15.2** - Implement employee search functionality
- ✅ **15.3** - Implement role filter functionality
- ✅ **15.4** - Implement role assignment functionality
- ✅ **15.5** - Add responsive design for mobile
- ✅ **15.6** - Add loading and error states

## Usage Example

```javascript
import AccessTab from './admin/pages/RolesAccess/AccessTab';

function RolesAccess() {
  const [activeTab, setActiveTab] = useState('access');
  
  return (
    <div>
      {activeTab === 'access' && <AccessTab />}
    </div>
  );
}
```

## Error Handling

- API errors are caught and displayed via toast notifications
- Failed role assignments show error toast
- Loading state prevents interaction during data fetch
- Empty state shows when no employees match filters

## Performance Considerations

- Uses `useMemo` for filtering to avoid unnecessary recalculations
- Parallel data fetching for employees and roles
- Minimal re-renders with proper state management
- Dropdown backdrop prevents event propagation issues

## Accessibility

- Semantic HTML elements (table, button, select)
- Touch-friendly button sizes (min 44x44px)
- Color-coded badges with text labels
- Readable text on all backgrounds
- Keyboard navigation support via native elements

## Future Enhancements

- Bulk role assignment (select multiple employees)
- Role assignment history/audit log
- Export employee access list
- Advanced filtering (by department, status, etc.)
- Inline role editing without dropdown
