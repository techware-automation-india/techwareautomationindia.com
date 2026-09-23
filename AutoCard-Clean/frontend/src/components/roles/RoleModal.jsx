import { useState, useEffect } from "react";
import { X } from "lucide-react";
import ModuleSelector from "./ModuleSelector";

/**
 * RoleModal Component
 * 
 * Modal for creating or editing roles
 * 
 * @param {boolean} isOpen - Whether modal is visible
 * @param {function} onClose - Callback to close modal
 * @param {string} mode - 'create' or 'edit'
 * @param {object} role - Role object (for edit mode)
 * @param {function} onSave - Callback with role data
 */
export default function RoleModal({ isOpen, onClose, mode = 'create', role = null, onSave }) {
  const [name, setName] = useState('');
  const [selectedModules, setSelectedModules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && mode === 'edit' && role) {
      setName(role.name);
      setSelectedModules(role.modules?.map(m => m.moduleKey || m) || []);
    } else if (isOpen && mode === 'create') {
      setName('');
      setSelectedModules([]);
    }
    setError('');
  }, [isOpen, mode, role]);

  const validateName = (value) => {
    if (!value || value.trim().length === 0) {
      return 'Role name is required';
    }
    if (value.length > 100) {
      return 'Role name cannot exceed 100 characters';
    }
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(value)) {
      return 'Role name can only contain letters, numbers, spaces, hyphens, and underscores';
    }
    return '';
  };

  const handleSave = async () => {
    setError('');
    
    const nameError = validateName(name);
    if (nameError) {
      setError(nameError);
      return;
    }

    setLoading(true);
    try {
      await onSave({
        id: role?.id,
        name: name.trim(),
        moduleKeys: selectedModules
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save role');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {mode === 'create' ? 'Create New Role' : 'Edit Role'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Name Input */}
          <div>
            <label htmlFor="roleName" className="block text-sm font-medium text-gray-700 mb-2">
              Role Name *
            </label>
            <input
              id="roleName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading || (mode === 'edit' && role?.isDefault)}
              placeholder="Enter role name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            {mode === 'edit' && role?.isDefault && (
              <p className="text-xs text-gray-500 mt-1">
                Default role names cannot be changed
              </p>
            )}
          </div>

          {/* Module Selector (only in edit mode) */}
          {mode === 'edit' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Module Access
              </label>
              <ModuleSelector
                selectedModules={selectedModules}
                onChange={setSelectedModules}
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-2">
                Select which modules this role can access
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Saving...
              </>
            ) : mode === 'create' ? 'Create Role' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
