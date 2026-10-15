import { useState } from "react";
import { MODULES } from "../../data/modules";
import { Check, ChevronDown, CheckSquare, Square, Settings } from "lucide-react";
import InventorySettingsModal from "../../admin/components/inventory/InventorySettingsModal.jsx";

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
  const [isInventorySettingsOpen, setIsInventorySettingsOpen] = useState(false);
  const handleToggleParent = (module) => {
    if (disabled) return;

    if (module.subModules && module.subModules.length > 0) {
      const subKeys = module.subModules.map((s) => s.key);
      const allActionKeys = [];
      module.subModules.forEach((s) => {
        if (s.actions) {
          s.actions.forEach((a) => allActionKeys.push(`${s.key}:${a.key}`));
        }
      });

      const isParentActive = selectedModules.includes(module.key) || subKeys.some((k) => selectedModules.includes(k));

      let updated;
      if (isParentActive) {
        // Deselect parent, all sub-modules, and all action keys
        const removeSet = new Set([module.key, ...subKeys, ...allActionKeys]);
        updated = selectedModules.filter((k) => !removeSet.has(k));
      } else {
        // Select parent and all sub-modules (with default non-delete actions)
        const toAdd = [module.key, ...subKeys];
        module.subModules.forEach((s) => {
          if (s.actions) {
            s.actions.forEach((a) => {
              if (a.key !== "delete") {
                toAdd.push(`${s.key}:${a.key}`);
              }
            });
          }
        });
        const newKeys = new Set([...selectedModules, ...toAdd]);
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

  const handleSubModuleToggle = (module, subModule) => {
    if (disabled) return;
    const subKey = subModule.key;
    const subActions = subModule.actions || [];
    const actionKeys = subActions.map((a) => `${subKey}:${a.key}`);

    const isSubActive = selectedModules.includes(subKey) || actionKeys.some((ak) => selectedModules.includes(ak));
    let updated;

    if (isSubActive) {
      // Remove sub-module and all its action keys
      const removeSet = new Set([subKey, ...actionKeys]);
      updated = selectedModules.filter((k) => !removeSet.has(k));

      // Check if any sibling sub-modules or action keys remain selected
      const allSiblings = module.subModules.map((s) => s.key);
      const remainingSubs = updated.filter((k) => allSiblings.includes(k) || allSiblings.some((sk) => k.startsWith(`${sk}:`)));
      if (remainingSubs.length === 0) {
        updated = updated.filter((k) => k !== module.key);
      }
    } else {
      // Add sub-module and default actions (view, create, edit; leave delete unchecked by default)
      const toAdd = [module.key, subKey];
      if (subActions.length > 0) {
        subActions.forEach((a) => {
          if (a.key !== "delete") {
            toAdd.push(`${subKey}:${a.key}`);
          }
        });
      }
      const newKeys = new Set([...selectedModules, ...toAdd]);
      updated = Array.from(newKeys);
    }

    onChange(updated);
  };

  const handleActionToggle = (module, subModule, actionKey, e) => {
    if (disabled) return;
    if (e) e.stopPropagation();

    const subKey = subModule.key;
    const fullActionKey = `${subKey}:${actionKey}`;
    const isActionActive = selectedModules.includes(fullActionKey);

    let updated;
    if (isActionActive) {
      // If toggling off 'view', remove the whole submodule and all actions
      if (actionKey === "view") {
        const subActions = (subModule.actions || []).map((a) => `${subKey}:${a.key}`);
        const removeSet = new Set([subKey, ...subActions]);
        updated = selectedModules.filter((k) => !removeSet.has(k));

        const allSiblings = module.subModules.map((s) => s.key);
        const remainingSubs = updated.filter((k) => allSiblings.includes(k) || allSiblings.some((sk) => k.startsWith(`${sk}:`)));
        if (remainingSubs.length === 0) {
          updated = updated.filter((k) => k !== module.key);
        }
      } else {
        // Just remove this action key
        updated = selectedModules.filter((k) => k !== fullActionKey);
      }
    } else {
      // Turning ON action: ensure module, submodule, and 'view' action are all included
      const toAdd = [module.key, subKey, `${subKey}:view`, fullActionKey];
      const newKeys = new Set([...selectedModules, ...toAdd]);
      updated = Array.from(newKeys);
    }

    onChange(updated);
  };

  const handleSelectAllSub = (module) => {
    if (disabled || !module.subModules) return;
    const toAdd = [module.key];
    module.subModules.forEach((s) => {
      toAdd.push(s.key);
      if (s.actions) {
        s.actions.forEach((a) => toAdd.push(`${s.key}:${a.key}`));
      }
    });
    const newKeys = new Set([...selectedModules, ...toAdd]);
    onChange(Array.from(newKeys));
  };

  const handleClearAllSub = (module) => {
    if (disabled || !module.subModules) return;
    const subKeys = module.subModules.map((s) => s.key);
    const actionKeys = [];
    module.subModules.forEach((s) => {
      if (s.actions) {
        s.actions.forEach((a) => actionKeys.push(`${s.key}:${a.key}`));
      }
    });
    const removeSet = new Set([module.key, ...subKeys, ...actionKeys]);
    const updated = selectedModules.filter((k) => !removeSet.has(k));
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
            const selectedSubCount = subKeys.filter((k) => 
              selectedModules.includes(k) || selectedModules.some((smk) => smk.startsWith(`${k}:`))
            ).length;
            const isFullySelected = selectedSubCount === subKeys.length && selectedSubCount > 0;
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
                        Select specific sub-modules & permissions to grant for this role
                      </p>
                    </div>
                  </button>

                  {/* Bulk Actions for Submodules */}
                  <div className="flex items-center gap-2 ml-auto">
                    {module.key === "inventory" && (
                      <button
                        type="button"
                        onClick={() => setIsInventorySettingsOpen(true)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-md bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs group"
                        title="Open Inventory Access Settings (Employee permissions table)"
                      >
                        <Settings className="h-3.5 w-3.5 group-hover:rotate-45 transition-transform" />
                        <span>Settings</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleSelectAllSub(module)}
                      disabled={disabled || isFullySelected}
                      className="px-2.5 py-1 text-xs font-medium rounded-md bg-background border border-border text-foreground hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => handleClearAllSub(module)}
                      disabled={disabled || selectedSubCount === 0}
                      className="px-2.5 py-1 text-xs font-medium rounded-md bg-background border border-border text-foreground hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Sub-Modules Checkboxes Grid */}
                <div className="p-4 bg-background/60">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {module.subModules.map((subModule) => {
                      const hasActions = Array.isArray(subModule.actions) && subModule.actions.length > 0;
                      const subKey = subModule.key;
                      const actionKeys = hasActions ? subModule.actions.map((a) => `${subKey}:${a.key}`) : [];
                      const isSubActive = selectedModules.includes(subKey) || actionKeys.some((ak) => selectedModules.includes(ak));
                      const SubIcon = subModule.icon || Icon;

                      return (
                        <div
                          key={subModule.key}
                          className={`
                            flex flex-col p-3 rounded-xl border-2 transition-all select-none
                            ${isSubActive
                              ? "border-emerald-500/80 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm"
                              : "border-border bg-card hover:border-border/80 hover:bg-secondary/30"
                            }
                            ${disabled ? "opacity-50 cursor-not-allowed" : ""}
                          `}
                        >
                          {/* Submodule Header Row */}
                          <div
                            onClick={() => handleSubModuleToggle(module, subModule)}
                            className="flex items-start gap-2.5 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={isSubActive}
                              onChange={() => {}} // Handled by onClick
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

      {/* Inventory Settings Modal */}
      <InventorySettingsModal
        isOpen={isInventorySettingsOpen}
        onClose={() => setIsInventorySettingsOpen(false)}
      />
    </div>
  );
}
