import { useState, useEffect } from "react";
import { Search, Filter, Users } from "lucide-react";
import { fetchUsersWithRoles, assignUserRole } from "../../../lib/api/usersApi";
import { fetchRoles } from "../../../lib/api/rolesApi";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import EmptyState from "../../../components/common/EmptyState";
import { toast } from "sonner";

export default function AccessTab() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('all');

  useEffect(() => {
    loadData(false);

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadData(true);
      }
    }, 10000);

    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        loadData(true);
      }
    };
    window.addEventListener("visibilitychange", handleFocus);
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("visibilitychange", handleFocus);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const loadData = async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
      setError('');
    }
    try {
      const [usersData, rolesData] = await Promise.all([
        fetchUsersWithRoles(),
        fetchRoles()
      ]);
      const usersList = Array.isArray(usersData) ? usersData : (usersData?.users || []);
      setUsers(usersList);
      setRoles(rolesData?.roles || []);
    } catch (err) {
      if (!isBackground) {
        setError(err.message || 'Failed to load data');
        console.error('Load data error:', err);
      }
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  };

  const handleRoleAssignment = async (userId, roleId) => {
    const isRemoving = !roleId || roleId === "";
    try {
      await assignUserRole(userId, roleId || null);

      // Update local state immediately
      setUsers(prevUsers => prevUsers.map(user => {
        if (user.id !== userId) return user;
        if (isRemoving) {
          return { ...user, roleId: null, customRole: null };
        }
        const assignedRole = roles.find(r => r.id === roleId);
        return {
          ...user,
          roleId,
          customRole: assignedRole,
          role: assignedRole?.name?.toUpperCase() === 'ADMIN'
            ? 'ADMIN'
            : (assignedRole?.name?.toUpperCase() === 'CUSTOMER' ? 'CUSTOMER' : 'EMPLOYEE'),
        };
      }));

      if (isRemoving) {
        toast.success('Role removed successfully!');
      } else {
        const assignedRole = roles.find(r => r.id === roleId);
        toast.success(`Role "${assignedRole?.name || 'role'}" assigned successfully!`);
      }
    } catch (err) {
      toast.error(`Error: ${err.message || 'Failed to update role'}`);
      console.error('Assign role error:', err);
    }
  };

  // Filter users based on search and role filter
  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchQuery || 
      user.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRoleFilter = selectedRoleFilter === 'all' || 
      user.roleId === selectedRoleFilter;
    
    return matchesSearch && matchesRoleFilter;
  });

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
          <button
            onClick={loadData}
            className="mt-2 text-sm text-red-600 underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Action & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-border rounded-2xl p-4 card-shadow">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search employee by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-input bg-background text-foreground rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>

        {/* Role Filter */}
        <div className="sm:w-60 relative">
          <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <select
            value={selectedRoleFilter}
            onChange={(e) => setSelectedRoleFilter(e.target.value)}
            className="w-full pl-10 pr-8 py-2 border border-input bg-background text-foreground rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer"
          >
            <option value="all">Filter by: All Roles</option>
            {roles.map(role => (
              <option key={role.id} value={role.id}>{role.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Users Table */}
      {filteredUsers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={searchQuery || selectedRoleFilter !== 'all' ? "No users match your filters" : "No users found"}
          message={searchQuery || selectedRoleFilter !== 'all' ? "Try adjusting your search or filters" : "No users are available in the system"}
        />
      ) : (
        <div className="bg-card border border-border rounded-2xl card-shadow overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary/40 border-b border-border">
                <tr>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Employee Name
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Current Assigned Role
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Change Role
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold text-foreground text-sm">{user.fullName || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs sm:text-sm text-muted-foreground">{user.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                          {user.customRole?.name || user.role || 'No Role'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={user.roleId || ''}
                        onChange={(e) => handleRoleAssignment(user.id, e.target.value)}
                        className="px-3 py-1.5 border border-input bg-background text-foreground rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-primary focus:border-primary cursor-pointer"
                      >
                        <option value="">— Remove Role —</option>
                        {roles.map(role => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout */}
          <div className="md:hidden divide-y divide-border">
            {filteredUsers.map(user => (
              <div key={user.id} className="p-4 space-y-3">
                <div>
                  <div className="font-semibold text-foreground text-sm">{user.fullName || 'N/A'}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Current:</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                    {user.customRole?.name || user.role || 'No Role'}
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Assign Role</label>
                  <select
                    value={user.roleId || ''}
                    onChange={(e) => handleRoleAssignment(user.id, e.target.value)}
                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-primary focus:border-primary cursor-pointer"
                  >
                    <option value="">— Remove Role —</option>
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results Count */}
      {filteredUsers.length > 0 && (
        <div className="mt-4 text-sm text-muted-foreground text-center">
          Showing {filteredUsers.length} of {users.length} users
        </div>
      )}
    </div>
  );
}
