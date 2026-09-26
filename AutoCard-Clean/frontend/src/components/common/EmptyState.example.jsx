/**
 * EmptyState Component Usage Examples
 * 
 * This file demonstrates various ways to use the EmptyState component
 * in the Roles & Access module and other parts of the application.
 */

import EmptyState from './EmptyState';
import { ShieldCheck, Users, Search, ClipboardList } from 'lucide-react';

// Example 1: Empty state for no custom roles
export const NoCustomRolesExample = () => (
  <EmptyState
    icon={ShieldCheck}
    title="No Custom Roles"
    message="Create your first custom role to get started"
    action={
      <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition">
        Create Role
      </button>
    }
  />
);

// Example 2: Empty state for no search results
export const NoSearchResultsExample = () => (
  <EmptyState
    icon={Search}
    title="No employees match your search"
    message="Try adjusting your search criteria or filters"
  />
);

// Example 3: Empty state for no employees found
export const NoEmployeesExample = () => (
  <EmptyState
    icon={Users}
    title="No Employees Found"
    message="Start by adding employees to your organization"
    action={
      <button className="border border-slate-300 hover:bg-slate-50 text-slate-700 px-6 py-2 rounded-lg font-medium transition">
        Add Employee
      </button>
    }
  />
);

// Example 4: Empty state with no action button
export const NoDataExample = () => (
  <EmptyState
    icon={ClipboardList}
    title="No Data Available"
    message="There are no records to display at this time"
  />
);

// Example 5: Minimal empty state (only text)
export const MinimalExample = () => (
  <EmptyState
    title="Nothing here yet"
    message="Content will appear here once available"
  />
);

// Example 6: Empty state with custom action element
export const CustomActionExample = () => (
  <EmptyState
    icon={ShieldCheck}
    title="No Roles Assigned"
    message="This employee doesn't have any roles assigned"
    action={
      <div className="flex gap-3">
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          Assign Role
        </button>
        <button className="border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition">
          Cancel
        </button>
      </div>
    }
  />
);

/**
 * USAGE IN COMPONENTS:
 * 
 * // In RolesTab.jsx
 * {loading ? (
 *   <LoadingSpinner />
 * ) : roles.length === 0 ? (
 *   <EmptyState
 *     icon={ShieldCheck}
 *     title="No custom roles created yet"
 *     message="Create your first custom role to manage permissions"
 *     action={<Button onClick={openCreateModal}>Create Role</Button>}
 *   />
 * ) : (
 *   <RoleGrid roles={roles} />
 * )}
 * 
 * // In AccessTab.jsx with search
 * {filteredEmployees.length === 0 && (
 *   <EmptyState
 *     icon={Search}
 *     title="No employees match your search"
 *     message="Try adjusting your search criteria or filters"
 *   />
 * )}
 */
