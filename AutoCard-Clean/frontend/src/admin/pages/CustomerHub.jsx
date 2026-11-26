import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Users,
  UserPlus,
  Building2,
  Cpu,
  Wrench,
  FileText,
  ChevronRight,
  ArrowLeft,
  CalendarClock,
  Cog,
  Receipt,
  PhoneCall,
  Search,
  FolderKanban,
  LayoutGrid,
  BarChart3,
} from "lucide-react";
import { apiGet } from "../../lib/api.js";

export const customerSubModules = [
  {
    id: "overview",
    title: "Overview",
    category: "Onboarding & CRM",
    adminPath: "/admin/customer",
    description: "Onboard new clients, create portal credentials, and view customer account overview.",
    icon: UserPlus,
    accent: "text-blue-600 bg-blue-500/10 border-blue-500/20",
    badge: "Add & Overview",
  },
  {
    id: "all-customers",
    title: "All Customers",
    category: "Onboarding & CRM",
    adminPath: "/admin/customer-list",
    description: "Browse registered client plants, contact persons, manage portal access and accounts.",
    icon: Building2,
    accent: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20",
    badge: "Directory",
  },
  {
    id: "customer-machines",
    title: "Customer Machines",
    category: "Machinery & Service",
    adminPath: "/admin/customer-machines",
    description: "Track physical automation machines, serial tags, PLC hardware, and warranty status.",
    icon: Cpu,
    accent: "text-cyan-600 bg-cyan-500/10 border-cyan-500/20",
    badge: "Assets",
  },
  {
    id: "service-management",
    title: "Service Management",
    category: "Machinery & Service",
    adminPath: "/admin/customer-tickets",
    description: "Emergency machine-down tickets, error diagnosis, engineer dispatch, and repair logs.",
    icon: Wrench,
    accent: "text-rose-600 bg-rose-500/10 border-rose-500/20",
    badge: "Support Desk",
  },
  {
    id: "maintenance-schedule",
    title: "Maintenance Schedule",
    category: "Machinery & Service",
    adminPath: "/admin/customer-amc",
    description: "Manage Annual Maintenance Contracts, renewal alerts, and scheduled preventive visits.",
    icon: CalendarClock,
    accent: "text-violet-600 bg-violet-500/10 border-violet-500/20",
    badge: "Preventive",
  },
  {
    id: "spare-parts-requests",
    title: "Spare Parts Requests",
    category: "Machinery & Service",
    adminPath: "/admin/customer-spares",
    description: "Track machine-linked spare part orders, sensors, drives, and dispatch status.",
    icon: Cog,
    accent: "text-slate-600 bg-slate-500/10 border-slate-500/20",
    badge: "Spares",
  },
  {
    id: "documents",
    title: "Documents",
    category: "Contracts & Billing",
    adminPath: "/admin/customer-documents",
    description: "Annual maintenance contracts, electrical schematics, PLC backups, and user manuals.",
    icon: FileText,
    accent: "text-amber-600 bg-amber-500/10 border-amber-500/20",
    badge: "Vault",
  },
  {
    id: "communication",
    title: "Communication",
    category: "Onboarding & CRM",
    adminPath: "/admin/customer-logs",
    description: "Log customer calls, plant visits, MOM notes, and follow-up action items.",
    icon: PhoneCall,
    accent: "text-sky-600 bg-sky-500/10 border-sky-500/20",
    badge: "CRM Logs",
  },
  {
    id: "reports",
    title: "Reports",
    category: "Contracts & Billing",
    adminPath: "/admin/customer-reports",
    description: "View customer growth, plant deployments, service SLA, and AMC renewal analytics.",
    icon: BarChart3,
    accent: "text-teal-600 bg-teal-500/10 border-teal-500/20",
    badge: "Analytics",
  },
];

const CATEGORIES = ["All", "Onboarding & CRM", "Machinery & Service", "Contracts & Billing"];

const CustomerHub = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalCustomers: 0,
    companyCount: 0,
    totalProjects: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  useEffect(() => {
    let mounted = true;
    const fetchStats = async () => {
      try {
        const [custRes, projRes] = await Promise.allSettled([
          apiGet("/customers"),
          apiGet("/projects"),
        ]);

        let totalCust = 0;
        let compCount = 0;
        let totalProj = 0;

        if (custRes.status === "fulfilled" && custRes.value?.customers) {
          const list = custRes.value.customers;
          totalCust = list.length;
          compCount = list.filter((c) => c.companyName).length;
        }

        if (projRes.status === "fulfilled" && projRes.value?.projects) {
          totalProj = projRes.value.projects.length;
        }

        if (mounted) {
          setStats({
            totalCustomers: totalCust,
            companyCount: compCount,
            totalProjects: totalProj,
          });
        }
      } catch (err) {
        console.error("Failed to load customer stats:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchStats();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredModules = useMemo(() => {
    return customerSubModules.filter((mod) => {
      const matchesCat = activeCategory === "All" || mod.category === activeCategory;
      const matchesSearch =
        !search ||
        mod.title.toLowerCase().includes(search.toLowerCase()) ||
        mod.description.toLowerCase().includes(search.toLowerCase()) ||
        mod.badge.toLowerCase().includes(search.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [search, activeCategory]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={() => navigate("/admin")}
            className="p-2.5 rounded-xl border border-border bg-background hover:bg-secondary text-muted-foreground hover:text-foreground transition-all shrink-0 cursor-pointer shadow-xs"
            aria-label="Back to Dashboard"
            title="Back to Dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
              Customer Management
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Central workspace for client onboarding, machinery assets, field service, and billing.
            </p>
          </div>
        </div>

        <Link
          to="/admin/customer"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-all cursor-pointer shadow-xs shrink-0"
        >
          <UserPlus className="h-4 w-4" />
          <span>Add New Customer</span>
        </Link>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Customers</p>
            <p className="text-xl font-bold">{loading ? "—" : stats.totalCustomers}</p>
          </div>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Registered Plants</p>
            <p className="text-xl font-bold">{loading ? "—" : stats.companyCount}</p>
          </div>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-600">
            <FolderKanban className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Active Projects</p>
            <p className="text-xl font-bold">{loading ? "—" : stats.totalProjects}</p>
          </div>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600">
            <LayoutGrid className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Hub Modules</p>
            <p className="text-xl font-bold">{customerSubModules.length}</p>
          </div>
        </div>
      </div>

      {/* Search & Category Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeCategory === cat
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search modules..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Module Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredModules.map((sub) => {
          const Icon = sub.icon;
          return (
            <Link
              key={sub.id}
              to={sub.adminPath}
              className="group flex flex-col justify-between p-5 rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200"
            >
              <div className="space-y-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className={`p-3 rounded-xl border ${sub.accent}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted text-muted-foreground">
                    {sub.badge}
                  </span>
                </div>

                <div>
                  <h3 className="font-semibold text-base text-foreground group-hover:text-primary transition-colors">
                    {sub.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {sub.description}
                  </p>
                </div>
              </div>

              <div className="mt-5 pt-3.5 border-t border-border/60 flex items-center justify-between text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors">
                <span>{sub.category}</span>
                <span className="inline-flex items-center gap-1">
                  Open <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default CustomerHub;
