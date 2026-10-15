import { useState, useEffect } from "react";
import { Plus, FolderOpen } from "lucide-react";
import { fetchRoles, createRole, updateRole, deleteRole, updateRoleModules } from "../../../lib/api/rolesApi";
import RoleCard from "../../../components/roles/RoleCard";
import RoleModal from "../../../components/roles/RoleModal";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import EmptyState from "../../../components/common/EmptyState";
import { toast } from "sonner";

export default function RolesTab() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedRole, setSelectedRole] = useState(null);

  // Fetch roles on mount with 10-second background polling
  useEffect(() => {
    loadRoles(false);

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadRoles(true);
      }
    }, 10000);

    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        loadRoles(true);
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

  const loadRoles = async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
      setError('');
    }
    try {
      const data = await fetchRoles();
      setRoles(data.roles || []);
    } catch (err) {
      if (!isBackground) {
        setError(err.message || 'Failed to load roles');
        console.error('Load roles error:', err);
      }
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  };

  const handleCreateClick = () => {
    setModalMode('create');
    setSelectedRole(null);
    setModalOpen(true);
  };

  const handleEditClick = (role) => {
    setModalMode('edit');
    setSelectedRole(role);
    setModalOpen(true);
  };

  const handleCardClick = (role) => {
    // Same as edit
    handleEditClick(role);
  };

  const handleDeleteClick = async (role) => {
    if (role.isDefault) {
      toast.error('Default roles cannot be deleted.');
      return;
    }

    const usersCount = role.userCount || role._count?.users || 0;
    const confirmMsg = usersCount > 0
      ? `Are you sure you want to delete the role "${role.name}"?\n\n⚠️ ${usersCount} user${usersCount === 1 ? " is" : "s are"} assigned this role. They will be unassigned automatically.\n\nThis action cannot be undone.`
      : `Are you sure you want to delete the role "${role.name}"?\n\nThis action cannot be undone.`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    try {
      await deleteRole(role.id);
      setRoles(roles.filter(r => r.id !== role.id));
      toast.success('Role deleted successfully!');
    } catch (err) {
      const errorMsg = err.message || 'Failed to delete role';
      toast.error(errorMsg);
      console.error('Delete role error:', err);
    }
  };

  const handleSave = async (data) => {
    if (modalMode === 'create') {
      // Create new role
      const newRole = await createRole(data.name);
      if (data.moduleKeys && data.moduleKeys.length > 0) {
        await updateRoleModules(newRole.id, data.moduleKeys);
      }
      toast.success(`Role "${data.name}" created successfully!`);
      await loadRoles();
    } else {
      // Update existing role sequentially to avoid database race conditions
      if (data.name !== selectedRole.name && !selectedRole.isDefault) {
        await updateRole(data.id, data.name);
      }
      
      // Update modules
      await updateRoleModules(data.id, data.moduleKeys);
      
      // Reload roles to get updated data
      await loadRoles();
      toast.success('Role updated successfully!');
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
          <button
            onClick={loadRoles}
            className="mt-2 text-sm text-red-600 underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const customRoles = roles.filter(r => !r.isDefault);
  const defaultRoles = roles.filter(r => r.isDefault);

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card border border-border rounded-2xl p-4 card-shadow">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-foreground">Defined System Roles</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Default system roles and custom granular roles with module permissions
          </p>
        </div>
        <button
          onClick={handleCreateClick}
          className="cta-gradient text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-xs cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Create New Role</span>
        </button>
      </div>

      {/* Default Roles Section */}
      {defaultRoles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Default Roles</h3>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
              {defaultRoles.length}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {defaultRoles.map(role => (
              <RoleCard
                key={role.id}
                role={role}
                onEdit={handleEditClick}
                onDelete={handleDeleteClick}
                onClick={() => handleCardClick(role)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Custom Roles Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Custom Roles</h3>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
            {customRoles.length}
          </span>
        </div>
        {customRoles.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No custom roles created yet"
            message="Create custom roles to grant specific module access to employees or managers."
            action={
              <button
                onClick={handleCreateClick}
                className="cta-gradient text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity"
              >
                Create First Custom Role
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customRoles.map(role => (
              <RoleCard
                key={role.id}
                role={role}
                onEdit={handleEditClick}
                onDelete={handleDeleteClick}
                onClick={() => handleCardClick(role)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      <RoleModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        mode={modalMode}
        role={selectedRole}
        onSave={handleSave}
      />
    </div>
  );
}
