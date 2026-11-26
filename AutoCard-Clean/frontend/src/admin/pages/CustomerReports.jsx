import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  Users,
  Building2,
  FolderKanban,
  Wrench,
  CalendarClock,
  Receipt,
} from "lucide-react";
import { apiGet } from "../../lib/api.js";

const CustomerReports = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    customers: 0,
    plants: 0,
    projects: 0,
  });

  useEffect(() => {
    Promise.allSettled([apiGet("/customers"), apiGet("/projects")]).then(
      ([custRes, projRes]) => {
        const list =
          custRes.status === "fulfilled" ? custRes.value?.customers || [] : [];
        const projects =
          projRes.status === "fulfilled" ? projRes.value?.projects || [] : [];
        setStats({
          customers: list.length,
          plants: list.filter((c) => c.companyName).length,
          projects: projects.length,
        });
      }
    );
  }, []);

  const cards = [
    {
      label: "Total Customers",
      value: stats.customers,
      icon: Users,
      color: "text-blue-600 bg-blue-500/10",
    },
    {
      label: "Registered Plants",
      value: stats.plants,
      icon: Building2,
      color: "text-emerald-600 bg-emerald-500/10",
    },
    {
      label: "Active Projects",
      value: stats.projects,
      icon: FolderKanban,
      color: "text-violet-600 bg-violet-500/10",
    },
    {
      label: "Service SLA Target",
      value: "98.2%",
      icon: Wrench,
      color: "text-rose-600 bg-rose-500/10",
    },
    {
      label: "AMC Renewal Rate",
      value: "92%",
      icon: CalendarClock,
      color: "text-amber-600 bg-amber-500/10",
    },
    {
      label: "Billing Collection",
      value: "88%",
      icon: Receipt,
      color: "text-green-600 bg-green-500/10",
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          onClick={() => navigate("/admin/customer-hub")}
          className="p-2.5 rounded-xl border border-border bg-background hover:bg-secondary text-muted-foreground hover:text-foreground transition-all shrink-0 cursor-pointer shadow-xs"
          aria-label="Back to Customer Hub"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Customer Reports & Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Overview of customer growth, plant deployments, service SLA, and AMC performance.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className="p-5 rounded-xl border border-border bg-card flex items-center gap-4"
            >
              <div className={`p-3 rounded-xl ${c.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="text-2xl font-bold">{c.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-6 rounded-2xl border border-border bg-card space-y-2">
        <div className="flex items-center gap-2 font-semibold">
          <BarChart3 className="h-5 w-5 text-primary" />
          <span>Operations Summary</span>
        </div>
        <p className="text-sm text-muted-foreground">
          All customer onboarding, machine asset, service ticket, AMC schedule, spare-part, quotation, and invoice modules are connected under Customer Hub.
        </p>
      </div>
    </div>
  );
};

export default CustomerReports;
