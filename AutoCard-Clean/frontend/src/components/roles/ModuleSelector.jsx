import { MODULES } from "../../data/modules";
import { Check, ChevronDown, CheckSquare, Square } from "lucide-react";

/**
 * ModuleSelector Component
 * 
 * Grid of toggleable module cards with icons & expandable sub-module selections
 * 
 * @param {string[]} selectedModules - Array of selected module keys
 * @param {function} onChange - Callback with updated module keys array
 * @param {boolean} disabled - Whether the selector is disabled
 */
export default function ModuleSelector({ selectedModules = [], onChange, disabled = false }) {
  const handleToggleParent = (module) => {
    if (disabled) return;

    if (module.subModules && module.subModules.length > 0) {
      const subKeys = module.subModules.map((s) => s.key);
      const allSelected = subKeys.every((k) => selectedModules.includes(k));

      let updated;
      if (allSelected) {
        // Deselect parent and all its sub-modules
        updated = selectedModules.filter((k) => k !== module.key && !subKeys.includes(k));
      } else {
        // Select parent and all its sub-modules
        const newKeys = new Set([...selectedModules, module.key, ...subKeys]);
        updated = Array.from(newKeys);
      }
      onChange(updated);
      return;
    }

    const isSelected = selectedModules.includes(module.key);
    const updated = isSelected
      ? selectedModules.filter((key) => key !== module.key)
      : [...selectedModules, module.key];

    onChange(updated);
  };

  const handleSubModuleToggle = (module, subKey) => {
    if (disabled) return;

    const isSubSelected = selectedModules.includes(subKey);
    let updated;

    if (isSubSelected) {
      updated = selectedModules.filter((k) => k !== subKey);
      // Check if any sibling sub-modules remain selected
      const subKeys = module.subModules.map((s) => s.key);
      const remainingSubs = updated.filter((k) => subKeys.includes(k));
      if (remainingSubs.length === 0) {
        // If no sub-modules remain selected, remove parent key as well
        updated = updated.filter((k) => k !== module.key);
      }
    } else {
      // Add sub-module and ensure parent key is present
      const newKeys = new Set([...selectedModules, module.key, subKey]);
      updated = Array.from(newKeys);
    }

    onChange(updated);
  };

  const handleSelectAllSub = (module) => {
    if (disabled || !module.subModules) return;
    const subKeys = module.subModules.map((s) => s.key);
    const newKeys = new Set([...selectedModules, module.key, ...subKeys]);
    onChange(Array.from(newKeys));
  };

  const handleClearAllSub = (module) => {
    if (disabled || !module.subModules) return;
    const subKeys = module.subModules.map((s) => s.key);
    const updated = selectedModules.filter((k) => k !== module.key && !subKeys.includes(k));
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {MODULES.map((module) => {
          const hasSubs = Array.isArray(module.subModules) && module.subModules.length > 0;
          const Icon = module.icon;

          if (hasSubs) {
            const subKeys = module.subModules.map((s) => s.key);
            const selectedSubCount = subKeys.filter((k) => selectedModules.includes(k)).length;
            const isFullySelected = selectedSubCount === subKeys.length && selectedSubCount > 0;
            const isPartiallySelected = selectedSubCount > 0 && selectedSubCount < subKeys.length;
            const isParentActive = selectedModules.includes(module.key) || selectedSubCount > 0;

            return (
              <div
                key={module.key}
                className={`
                  col-span-2 md:col-span-3 flex flex-col rounded-xl border-2 transition-all overflow-hidden
                  ${isParentActive
                    ? "border-primary/60 bg-primary/[0.03]"
                    : "border-border bg-card hover:border-border/80"
                  }
                `}
              >
                {/* Parent Module Header */}
                <div
                  className={`
                    flex flex-wrap items-center justify-between gap-3 p-4 border-b transition-colors
                    ${isParentActive ? "border-primary/20 bg-primary/10" : "border-border bg-secondary/20"}
                  `}
                >
                  <button
                    type="button"
                    onClick={() => handleToggleParent(module)}
                    disabled={disabled}
                    className={`
                      flex items-center gap-3 text-left transition-all flex-1 min-w-[200px]
                      ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                    `}
                  >
                    <div
                      className={`
                        w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors
                        ${isParentActive ? "bg-primary text-white" : "bg-secondary text-muted-foreground"}
                      `}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {module.label}
                        </span>
                        {selectedSubCount > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/20 text-primary">
                            {selectedSubCount} of {subKeys.length} active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Select specific sub-modules to grant for this role
                      </p>
                    </div>
                  </button>

                  {/* Bulk Actions for Submodules */}
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() => handleSelectAllSub(module)}
                      disabled={disabled || isFullySelected}
                      className="px-2.5 py-1 text-xs font-medium rounded-md bg-background border border-border text-foreground hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => handleClearAllSub(module)}
                      disabled={disabled || selectedSubCount === 0}
                      className="px-2.5 py-1 text-xs font-medium rounded-md bg-background border border-border text-foreground hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Sub-Modules Checkboxes Grid */}
                <div className="p-4 bg-background/60">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {module.subModules.map((subModule) => {
                      const isSubSelected = selectedModules.includes(subModule.key);
                      const SubIcon = subModule.icon || Icon;

                      return (
                        <div
                          key={subModule.key}
                          onClick={() => handleSubModuleToggle(module, subModule.key)}
                          className={`
                            flex items-start gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer select-none
                            ${isSubSelected
                              ? "border-emerald-500 bg-emerald-50/70 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-200"
                              : "border-border bg-card hover:border-emerald-400/50 hover:bg-secondary/40"
                            }
                            ${disabled ? "opacity-50 cursor-not-allowed" : ""}
                          `}
                        >
                          <input
                            type="checkbox"
                            checked={isSubSelected}
                            onChange={() => {}} // Handled by wrapper div onClick
                            disabled={disabled}
                            className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              {SubIcon && <SubIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                              <span className="text-xs font-semibold text-foreground leading-snug truncate">
                                {subModule.label}
                              </span>
                            </div>
                            {subModule.description && (
                              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                                {subModule.description}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          }

          // Modules without sub-modules
          const isSelected = selectedModules.includes(module.key);

          return (
            <div
              key={module.key}
              className={`
                flex flex-col rounded-xl border-2 transition-all overflow-hidden
                ${isSelected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-secondary/40"
                }
              `}
            >
              <button
                type="button"
                onClick={() => handleToggleParent(module)}
                disabled={disabled}
                className={`
                  flex items-center gap-3 p-4 w-full text-left transition-all
                  ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                `}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold block truncate">
                    {module.label}
                  </span>
                </div>
                {isSelected && (
                  <div className="ml-auto h-5 w-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Check className="h-3.5 w-3.5 text-white stroke-[3]" />
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
