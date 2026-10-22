import { ShieldCheck, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AccessTab from "./AccessTab";

export default function RolesAccess() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2.5 rounded-xl border border-border bg-background hover:bg-secondary text-muted-foreground hover:text-foreground transition-all shrink-0"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-xs shrink-0">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Module Access &amp; Permissions
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Assign module and submodule permissions (View, Create, Edit, Delete) to employees
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div>
        <AccessTab />
      </div>
    </div>
  );
}
