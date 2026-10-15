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
      className="group bg-card rounded-2xl border border-border p-5 card-shadow hover:shadow-md hover:border-primary/40 transition-all cursor-pointer flex flex-col justify-between"
    >
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
              role.isDefault 
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' 
                : 'bg-primary/10 text-primary border border-primary/20'
            }`}>
              <Shield className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-base font-bold text-foreground group-hover:text-primary transition-colors truncate">
                {role.name}
              </h3>
              <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mt-0.5 border ${
                role.isDefault
                  ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20'
                  : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
              }`}>
                {role.isDefault ? 'Default Role' : 'Custom Role'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(role);
              }}
              className="p-1.5 text-muted-foreground hover:text-primary hover:bg-secondary rounded-lg transition-colors"
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
                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                title="Delete role"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
      
      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {moduleCount} {moduleCount === 1 ? 'module' : 'modules'} enabled
        </span>
        <span className="text-primary font-semibold group-hover:underline inline-flex items-center gap-1">
          Configure permissions &rarr;
        </span>
      </div>
    </div>
  );
}
