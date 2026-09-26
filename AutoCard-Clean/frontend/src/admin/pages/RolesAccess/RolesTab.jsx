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

  // Fetch roles on mount
  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchRoles();
      setRoles(data.roles || []);
    } catch (err) {
      setError(err.message || 'Failed to load roles');
      console.error('Load roles error:', err);
    } finally {
      setLoading(false);
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

    const confirmMsg = `Are you sure you want to delete the role "${role.name}"?\n\nThis action cannot be undone.`;
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
      setRoles([...roles, { ...newRole, modules: [], moduleCount: 0 }]);
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
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Role Management</h2>
          <p className="text-muted-foreground mt-1">Create and manage custom roles with module access</p>
        </div>
        <button
          onClick={handleCreateClick}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-5 w-5" />
          Create Role
        </button>
      </div>

      {/* Default Roles Section */}
      {defaultRoles.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-foreground mb-4">Default Roles</h3>
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
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4">Custom Roles</h3>
        {customRoles.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="No custom roles yet"
            message="Create your first custom role to get started with granular access control"
            action={
              <button
                onClick={handleCreateClick}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Create Your First Role
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
