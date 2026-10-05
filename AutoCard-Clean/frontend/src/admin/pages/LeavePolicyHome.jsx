import { useNavigate, useLocation } from "react-router-dom";
import { ClipboardList, CalendarDays, Plus } from "lucide-react";
import { getAuthUser } from "../../lib/auth.js";

const LeavePolicyHome = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isEmployeePath = location.pathname.startsWith("/employee");
  const basePath = isEmployeePath ? "/employee/leave-policy" : "/admin/leave-policy";
  
  // Get the current logged-in user
  const user = getAuthUser();
  const isActualAdmin = user?.role === "ADMIN";

  const modules = [
    {
      key: "leave-policy",
      label: "Leave Policy",
      description: "Define leave types, annual allowances, and rules.",
      icon: ClipboardList,
      path: `${basePath}/types`,
      color: "bg-emerald-100 text-emerald-700",
    },
    {
      key: "holidays",
      label: "Holiday",
      description: "Manage the company holiday calendar.",
      icon: CalendarDays,
      path: `${basePath}/holidays`,
      color: "bg-violet-100 text-violet-700",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Apply for Leave Button */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <ClipboardList className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold">Leave Policy & Holiday</h1>
            <p className="text-sm text-muted-foreground">
              Manage leave types, balances, rules and company holiday calendar.
            </p>
          </div>
        </div>

        {/* Apply for Leave Button - Only for Actual Admin */}
        {isActualAdmin && (
          <button
            type="button"
            onClick={() => navigate("/admin/requests/apply-leave")}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-orange-600 hover:to-orange-700 transition-all shrink-0 ml-auto"
          >
            <Plus className="h-4 w-4" />
            Apply for Leave
          </button>
        )}
      </div>

      {/* Sub-module cards */}
      <div className="grid sm:grid-cols-2 gap-4 max-w-3xl">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <button
              key={mod.key}
              type="button"
              onClick={() => navigate(mod.path)}
              className="text-left rounded-2xl border border-border bg-background card-shadow p-6 hover:border-primary/40 hover:shadow-md transition-all group"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${mod.color}`}>
                <Icon className="h-6 w-6" />
              </div>
              <h2 className="font-display text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                {mod.label}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">{mod.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default LeavePolicyHome;
