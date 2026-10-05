import { MODULES, APPROVAL_SUBTYPES } from "../../data/modules";
import { Check } from "lucide-react";

/**
 * ModuleSelector Component
 * 
 * Grid of toggleable module cards with icons & sub-checkboxes for Approval request types
 * 
 * @param {string[]} selectedModules - Array of selected module keys
 * @param {function} onChange - Callback with updated module keys array
 * @param {boolean} disabled - Whether the selector is disabled
 */
export default function ModuleSelector({ selectedModules = [], onChange, disabled = false }) {
  const isApprovalsSelected = selectedModules.includes("approvals");

  const handleToggle = (moduleKey) => {
    if (disabled) return;
    
    if (moduleKey === "approvals") {
      // Toggle all approval keys together
      const subKeys = APPROVAL_SUBTYPES.map((s) => s.key);
      const allSelected = isApprovalsSelected && subKeys.every((k) => selectedModules.includes(k));
      
      let updated;
      if (allSelected) {
        // Deselect main approvals and all sub-keys
        updated = selectedModules.filter((k) => k !== "approvals" && !subKeys.includes(k));
      } else {
        // Select main approvals and all sub-keys
        const newKeys = new Set([...selectedModules, "approvals", ...subKeys]);
        updated = Array.from(newKeys);
      }
      onChange(updated);
      return;
    }

    const isSelected = selectedModules.includes(moduleKey);
    const updated = isSelected
      ? selectedModules.filter((key) => key !== moduleKey)
      : [...selectedModules, moduleKey];
    
    onChange(updated);
  };

  const handleSubTypeToggle = (subKey) => {
    if (disabled) return;

    const isSubSelected = selectedModules.includes(subKey);
    let updated;

    if (isSubSelected) {
      updated = selectedModules.filter((k) => k !== subKey);
      // If no approval sub-types remain selected, remove main approvals key too
      const subKeys = APPROVAL_SUBTYPES.map((s) => s.key);
      const remainingSub = updated.filter((k) => subKeys.includes(k));
      if (remainingSub.length === 0) {
        updated = updated.filter((k) => k !== "approvals");
      }
    } else {
      // Add sub-key and automatically ensure main 'approvals' key is present
      const newKeys = new Set([...selectedModules, "approvals", subKey]);
      updated = Array.from(newKeys);
    }

    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {MODULES.map((module) => {
          const isSelected = selectedModules.includes(module.key);
          const Icon = module.icon;
          const isApprovalsModule = module.key === "approvals";
          
          return (
            <div
              key={module.key}
              className={`
                flex flex-col rounded-xl border-2 transition-all overflow-hidden
                ${isApprovalsModule ? "col-span-2 md:col-span-3 border-primary/50 bg-primary/5" : ""}
                ${!isApprovalsModule && isSelected 
                  ? "border-primary bg-primary/10 text-primary" 
                  : !isApprovalsModule ? "border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-secondary/40" : ""
                }
              `}
            >
              {/* Main Module Button */}
              <button
                type="button"
                onClick={() => handleToggle(module.key)}
                disabled={disabled}
                className={`
                  flex items-center gap-3 p-4 w-full text-left transition-all
                  ${isApprovalsModule ? "bg-primary/10 border-b border-primary/20" : ""}
                  ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                `}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <div className="flex-1">
                  <span className="text-sm font-semibold">
                    {module.label}
                  </span>
                  {isApprovalsModule && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Assign access to the Approval module & select allowed Request Types below
                    </p>
                  )}
                </div>
                {isSelected && (
                  <div className="ml-auto h-5 w-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Check className="h-3.5 w-3.5 text-white stroke-[3]" />
                  </div>
                )}
              </button>

              {/* Approval Sub-Types Request Checkboxes Div */}
              {isApprovalsModule && (
                <div className="p-4 bg-background/80 space-y-3">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Allowed Request Types in Approval Module:
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {APPROVAL_SUBTYPES.map((subType) => {
                      const isSubSelected = selectedModules.includes(subType.key);

                      return (
                        <div
                          key={subType.key}
                          onClick={() => handleSubTypeToggle(subType.key)}
                          className={`
                            flex items-center gap-2.5 px-3 py-2.5 rounded-lg border-2 transition-all cursor-pointer select-none
                            ${isSubSelected
                              ? "border-emerald-500 bg-emerald-50/50 text-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-200"
                              : "border-border bg-card hover:border-emerald-400/50 hover:bg-secondary/40"
                            }
                            ${disabled ? "opacity-50 cursor-not-allowed" : ""}
                          `}
                        >
                          <input
                            type="checkbox"
                            checked={isSubSelected}
                            onChange={() => {}} // Handled by div onClick
                            disabled={disabled}
                            className="h-4 w-4 shrink-0 rounded border-border text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <span className="text-xs font-semibold text-foreground leading-snug">
                            {subType.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
