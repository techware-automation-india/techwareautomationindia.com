import { useEffect, useState } from "react";
import { X, Wrench, ShieldCheck, Box, Loader2, CheckCircle2 } from "lucide-react";
import { apiGet } from "../lib/api.js";

export default function AssignedToolsModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiGet("/onboarding/me");
        if (isMounted) {
          setProfileData(data?.profile || null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Failed to load assigned tools.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProfile();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const rawTools = profileData?.assignedTools || "";
  const toolsList = rawTools
    .split(/,\s*|\n+/)
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />
      
      <div className="relative w-full max-w-lg rounded-2xl border-2 border-border bg-background shadow-2xl overflow-hidden z-10">
        {/* Header */}
        <div className="relative overflow-hidden border-b border-border/60 bg-gradient-to-r from-amber-500/10 via-primary/5 to-purple-500/10 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 border-2 border-amber-500/30 flex items-center justify-center shrink-0">
                <Wrench className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-foreground">
                  My Tools & Equipment
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Company equipment allocated to your profile for field and office work
                </p>
              </div>
            </div>
            
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-amber-600 mb-3" />
              <p className="text-sm">Loading your assigned tools...</p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-center text-sm text-rose-700">
              {error}
            </div>
          ) : toolsList.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                <span>Assigned Items</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  {toolsList.length} {toolsList.length === 1 ? "Item" : "Items"} Total
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {toolsList.map((tool, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3.5 rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-secondary/30 hover:border-amber-500/40 transition-all shadow-sm"
                  >
                    <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <span className="text-sm font-semibold text-foreground break-words">
                      {tool}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3.5 rounded-xl border border-border bg-secondary/20 flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Please handle all assigned tools with care. Return or report damaged equipment to your project supervisor.
                </p>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-secondary/80 flex items-center justify-center mb-3 text-muted-foreground">
                <Box className="h-7 w-7" />
              </div>
              <h4 className="text-base font-semibold text-foreground mb-1">
                No Tools Assigned Yet
              </h4>
              <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                There are currently no company tools or equipment assigned to your employee profile.
                Please contact your administrator if you require tools for site assignments.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border/60 bg-secondary/30 p-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
