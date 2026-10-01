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
      className="bg-card rounded-lg shadow-sm border border-border p-6 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${role.isDefault ? 'bg-blue-500/10 dark:bg-blue-500/20' : 'bg-primary/10'}`}>
            <Shield className={`h-5 w-5 ${role.isDefault ? 'text-blue-600 dark:text-blue-400' : 'text-primary'}`} />
          </div>
          <div>
            <h3 className="font-semibold text-card-foreground">{role.name}</h3>
            {role.isDefault && (
              <span className="inline-block text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded mt-1">
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
            className="p-2 text-muted-foreground hover:text-primary hover:bg-secondary rounded transition-colors"
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
              className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
              title="Delete role"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="font-medium text-card-foreground">{moduleCount}</span>
        <span>{moduleCount === 1 ? 'module' : 'modules'} assigned</span>
      </div>
    </div>
  );
}
