import { useState, useEffect, useMemo } from "react";
import { Search, Filter, Users, Package, User, ShieldCheck } from "lucide-react";
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
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [usersData, rolesData] = await Promise.all([
        fetchUsersWithRoles(),
        fetchRoles()
      ]);
      const usersList = Array.isArray(usersData) ? usersData : (usersData?.users || []);
      setUsers(usersList);
      setRoles(rolesData?.roles || []);
    } catch (err) {
      setError(err.message || 'Failed to load data');
      console.error('Load data error:', err);
    } finally {
      setLoading(false);
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

  const inventoryInPersonnel = useMemo(() => {
    return users.filter((u) => {
      if (u.role === "ADMIN" || u.customRole?.name?.toUpperCase() === "ADMIN") return true;
      const mods = Array.isArray(u.customRole?.modules) ? u.customRole.modules : [];
      return mods.includes("inventory") || mods.includes("inventory-in");
    });
  }, [users]);

  const inventoryOutPersonnel = useMemo(() => {
    return users.filter((u) => {
      if (u.role === "ADMIN" || u.customRole?.name?.toUpperCase() === "ADMIN") return true;
      const mods = Array.isArray(u.customRole?.modules) ? u.customRole.modules : [];
      return mods.includes("inventory") || mods.includes("inventory-out");
    });
  }, [users]);

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
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Account Access & Role Assignment</h2>
        <p className="text-muted-foreground mt-1">Reassign or change the active role for any user account to update their module access.</p>
      </div>

      {/* Assigned Inventory Module Personnel Banner */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Inventory In Card */}
        <div className="p-4 rounded-2xl border border-blue-200/80 bg-blue-50/40 dark:bg-blue-950/20 dark:border-blue-900/40 card-shadow space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Package className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-bold text-foreground">
                Inventory In (Material Inward) Access
              </h4>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300">
              {inventoryInPersonnel.length} Assigned
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Personnel with module access to create categories, add products & log inward stock:
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {inventoryInPersonnel.length > 0 ? (
              inventoryInPersonnel.map((u) => (
                <span
                  key={u.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-background border border-blue-300 dark:border-blue-800 text-foreground shadow-2xs"
                >
                  <User className="h-3 w-3 text-blue-600" />
                  <span className="font-semibold">{u.fullName || u.email}</span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    ({u.customRole?.name || u.role})
                  </span>
                </span>
              ))
            ) : (
              <span className="text-xs text-muted-foreground italic">No users assigned yet</span>
            )}
          </div>
        </div>

        {/* Inventory Out Card */}
        <div className="p-4 rounded-2xl border border-amber-200/80 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-900/40 card-shadow space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Package className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-bold text-foreground">
                Inventory Out (Material Outward) Access
              </h4>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300">
              {inventoryOutPersonnel.length} Assigned
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Personnel with module access to issue materials, dispatch stock & update returns:
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {inventoryOutPersonnel.length > 0 ? (
              inventoryOutPersonnel.map((u) => (
                <span
                  key={u.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-background border border-amber-300 dark:border-amber-800 text-foreground shadow-2xs"
                >
                  <User className="h-3 w-3 text-amber-600" />
                  <span className="font-semibold">{u.fullName || u.email}</span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    ({u.customRole?.name || u.role})
                  </span>
                </span>
              ))
            ) : (
              <span className="text-xs text-muted-foreground italic">No users assigned yet</span>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>
        </div>

        {/* Role Filter */}
        <div className="sm:w-64">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <select
              value={selectedRoleFilter}
              onChange={(e) => setSelectedRoleFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-primary appearance-none"
            >
              <option value="all">All Roles</option>
              {roles.map(role => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
          </div>
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
        <div className="bg-card border border-border rounded-lg shadow overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary/40 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Current Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Reassign / Change Role
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-secondary/40">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-card-foreground">{user.fullName || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-muted-foreground">{user.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
                          {user.customRole?.name || user.role || 'No Role'}
                        </span>
                        {(() => {
                          const isAdmin = user.role === 'ADMIN' || user.customRole?.name?.toUpperCase() === 'ADMIN';
                          const modules = Array.isArray(user.customRole?.modules) ? user.customRole.modules : [];
                          const hasIn = isAdmin || modules.includes('inventory') || modules.includes('inventory-in');
                          const hasOut = isAdmin || modules.includes('inventory') || modules.includes('inventory-out');

                          if (!hasIn && !hasOut) return null;

                          return (
                            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                              {hasIn && (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                                  ✓ Inward (In)
                                </span>
                              )}
                              {hasOut && (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                                  ✓ Outward (Out)
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={user.roleId || ''}
                        onChange={(e) => handleRoleAssignment(user.id, e.target.value)}
                        className="px-3 py-1.5 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
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
                  <div className="font-medium text-card-foreground">{user.fullName || 'N/A'}</div>
                  <div className="text-sm text-muted-foreground">{user.email}</div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Current:</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      {user.customRole?.name || user.role || 'No Role'}
                    </span>
                  </div>
                  {(() => {
                    const isAdmin = user.role === 'ADMIN' || user.customRole?.name?.toUpperCase() === 'ADMIN';
                    const modules = Array.isArray(user.customRole?.modules) ? user.customRole.modules : [];
                    const hasIn = isAdmin || modules.includes('inventory') || modules.includes('inventory-in');
                    const hasOut = isAdmin || modules.includes('inventory') || modules.includes('inventory-out');

                    if (!hasIn && !hasOut) return null;

                    return (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {hasIn && (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                            ✓ Inward (In)
                          </span>
                        )}
                        {hasOut && (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                            ✓ Outward (Out)
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Assign Role</label>
                  <select
                    value={user.roleId || ''}
                    onChange={(e) => handleRoleAssignment(user.id, e.target.value)}
                    className="w-full px-3 py-2 border border-input bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
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
