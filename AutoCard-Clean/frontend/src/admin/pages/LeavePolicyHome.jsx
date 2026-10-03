import { useNavigate } from "react-router-dom";
import { ClipboardList, CalendarDays } from "lucide-react";

const modules = [
  {
    key: "leave-policy",
    label: "Leave Policy",
    description: "Define leave types, annual allowances, and rules.",
    icon: ClipboardList,
    path: "/admin/leave-policy/types",
    color: "bg-emerald-100 text-emerald-700",
  },
  {
    key: "holidays",
    label: "Holiday",
    description: "Manage the company holiday calendar.",
    icon: CalendarDays,
    path: "/admin/leave-policy/holidays",
    color: "bg-violet-100 text-violet-700",
  },
];

const LeavePolicyHome = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <ClipboardList className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Leave Policy & Holiday</h1>
          <p className="text-sm text-muted-foreground">
            Manage leave types, balances, rules and company holiday calendar.
          </p>
        </div>
      </div>

      {/* Sub-module cards */}
      <div className="grid sm:grid-cols-2 gap-4">
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
