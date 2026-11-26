import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FolderKanban,
  FileText,
  CheckCircle2,
  Clock,
  IndianRupee,
  ArrowRight,
  Plus,
  Wrench,
  UserCircle,
  LifeBuoy,
  Loader2,
} from "lucide-react";
import { apiGet } from "../../lib/api.js";
import { toast } from "sonner";

const Overview = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeProjects: 0,
    pendingRequests: 0,
    completedProjects: 0,
    outstandingInvoices: 0,
  });
  const [recentProjects, setRecentProjects] = useState([]);
  const [recentRequests, setRecentRequests] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const data = await apiGet("/customers/me/dashboard");
      setStats({
        activeProjects: data.stats?.activeProjects || 0,
        pendingRequests: data.stats?.pendingRequests || 0,
        completedProjects: data.stats?.completedProjects || 0,
        outstandingInvoices: data.stats?.outstandingInvoices || 0,
      });
      setRecentProjects(data.recentProjects || []);
      setRecentRequests(data.recentRequests || []);
    } catch (err) {
      console.error("Failed to load dashboard:", err);
      toast.error(err.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusStyle = (status) => {
    const map = {
      IN_PROGRESS: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      COMPLETED: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      PLANNING: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      ON_HOLD: "bg-slate-500/10 text-slate-600 border-slate-500/20",
      PENDING: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      RESOLVED: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    };
    return map[status] || "bg-muted text-muted-foreground border-border";
  };

  const statCards = [
    {
      label: "Active Projects",
      value: stats.activeProjects,
      icon: FolderKanban,
      accent: "text-blue-600 bg-blue-500/10",
      link: "/customer/projects",
    },
    {
      label: "Pending Requests",
      value: stats.pendingRequests,
      icon: Clock,
      accent: "text-amber-600 bg-amber-500/10",
      link: "/customer/requests",
    },
    {
      label: "Completed Projects",
      value: stats.completedProjects,
      icon: CheckCircle2,
      accent: "text-emerald-600 bg-emerald-500/10",
      link: "/customer/projects",
    },
    {
      label: "Outstanding Invoices",
      value: `₹${Number(stats.outstandingInvoices || 0).toLocaleString("en-IN")}`,
      icon: IndianRupee,
      accent: "text-rose-600 bg-rose-500/10",
      link: "/customer/documents",
    },
  ];

  const quickLinks = [
    {
      title: "Technical Documents",
      desc: "Manuals, CAD & AMC files",
      icon: FileText,
      to: "/customer/documents",
      accent: "text-amber-600 bg-amber-500/10",
    },
    {
      title: "Support Desk",
      desc: "Raise or track tickets",
      icon: LifeBuoy,
      to: "/customer/support",
      accent: "text-rose-600 bg-rose-500/10",
    },
    {
      title: "My Profile",
      desc: "Plant & contact details",
      icon: UserCircle,
      to: "/customer/profile",
      accent: "text-blue-600 bg-blue-500/10",
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
            Customer Portal
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track your automation projects, service requests, and technical documents.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            to="/customer/documents"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold transition-colors"
          >
            <FileText className="h-4 w-4" />
            <span>Documents</span>
          </Link>
          <Link
            to="/customer/requests"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>New Request</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              to={card.link}
              className="group p-5 rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-sm transition-all flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
                <p className="text-2xl font-bold mt-1 text-foreground">
                  {loading ? "—" : card.value}
                </p>
              </div>
              <div className={`p-3 rounded-xl ${card.accent}`}>
                <Icon className="h-5 w-5" />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Projects */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-primary" />
              Recent Projects
            </h2>
            <Link
              to="/customer/projects"
              className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="py-10 flex justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : recentProjects.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
              No projects assigned yet.
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentProjects.slice(0, 5).map((proj) => (
                <div
                  key={proj.id}
                  className="p-3.5 rounded-xl border border-border/70 bg-background/50 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{proj.name || proj.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {proj.description || "Automation deployment"}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border shrink-0 ${getStatusStyle(
                      proj.status
                    )}`}
                  >
                    {proj.status?.replace("_", " ") || "ACTIVE"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Service Requests */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" />
              Recent Service Requests
            </h2>
            <Link
              to="/customer/requests"
              className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="py-10 flex justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : recentRequests.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl space-y-2">
              <p>No service requests raised yet.</p>
              <Link
                to="/customer/requests"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> Raise a Request
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentRequests.slice(0, 5).map((req) => (
                <div
                  key={req.id}
                  className="p-3.5 rounded-xl border border-border/70 bg-background/50 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{req.title || req.subject}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : "Recent"}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border shrink-0 ${getStatusStyle(
                      req.status
                    )}`}
                  >
                    {req.status || "PENDING"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Access */}
      <div className="grid sm:grid-cols-3 gap-4">
        {quickLinks.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.title}
              to={item.to}
              className="group p-4 rounded-2xl border border-border bg-card hover:border-primary/40 transition-all flex items-center gap-3.5"
            >
              <div className={`p-2.5 rounded-xl ${item.accent}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm group-hover:text-primary transition-colors">
                  {item.title}
                </p>
                <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default Overview;
