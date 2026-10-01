import { MODULES } from "../../data/modules";

/**
 * ModuleSelector Component
 * 
 * Grid of toggleable module cards with icons
 * 
 * @param {string[]} selectedModules - Array of selected module keys
 * @param {function} onChange - Callback with updated module keys array
 * @param {boolean} disabled - Whether the selector is disabled
 */
export default function ModuleSelector({ selectedModules = [], onChange, disabled = false }) {
  const handleToggle = (moduleKey) => {
    if (disabled) return;
    
    const isSelected = selectedModules.includes(moduleKey);
    const updated = isSelected
      ? selectedModules.filter(key => key !== moduleKey)
      : [...selectedModules, moduleKey];
    
    onChange(updated);
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {MODULES.map((module) => {
        const isSelected = selectedModules.includes(module.key);
        const Icon = module.icon;
        
        return (
          <button
            key={module.key}
            type="button"
            onClick={() => handleToggle(module.key)}
            disabled={disabled}
            className={`
              flex items-center gap-3 p-4 rounded-lg border-2 transition-all
              ${isSelected 
                ? 'border-primary bg-primary/10 text-primary' 
                : 'border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-secondary/40'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <Icon className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm font-medium text-left">
              {module.label}
            </span>
            {isSelected && (
              <div className="ml-auto h-5 w-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
