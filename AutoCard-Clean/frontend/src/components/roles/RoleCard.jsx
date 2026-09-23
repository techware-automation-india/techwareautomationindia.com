import { Edit2, Trash2, Shield } from "lucide-react";

/**
 * RoleCard Component
 * 
 * Displays a role with its details and action buttons
 * 
 * @param {object} role - Role object with id, name, isDefault, modules
 * @param {function} onEdit - Callback when edit button clicked
 * @param {function} onDelete - Callback when delete button clicked
 * @param {function} onClick - Callback when card is clicked
 */
export default function RoleCard({ role, onEdit, onDelete, onClick }) {
  const moduleCount = role.modules?.length || role.moduleCount || 0;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${role.isDefault ? 'bg-blue-100' : 'bg-primary/10'}`}>
            <Shield className={`h-5 w-5 ${role.isDefault ? 'text-blue-600' : 'text-primary'}`} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{role.name}</h3>
            {role.isDefault && (
              <span className="inline-block text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded mt-1">
                Default Role
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(role);
            }}
            className="p-2 text-gray-600 hover:text-primary hover:bg-gray-100 rounded transition-colors"
            title="Edit role"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          
          {!role.isDefault && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(role);
              }}
              className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Delete role"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span className="font-medium">{moduleCount}</span>
        <span>{moduleCount === 1 ? 'module' : 'modules'} assigned</span>
      </div>
    </div>
  );
}
