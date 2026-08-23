import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FolderKanban,
  FileText,
  CheckCircle2,
  Clock,
  DollarSign,
  TrendingUp,
  AlertCircle,
  ArrowRight,
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
        activeProjects: data.stats.activeProjects || 0,
        pendingRequests: data.stats.pendingRequests || 0,
        completedProjects: data.stats.completedProjects || 0,
        outstandingInvoices: data.stats.outstandingInvoices || 0,
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

  const getStatusColor = (status) => {
    const colors = {
      IN_PROGRESS: "bg-blue-100 text-blue-700 border-blue-200",
      COMPLETED: "bg-green-100 text-green-700 border-green-200",
      PLANNING: "bg-yellow-100 text-yellow-700 border-yellow-200",
      ON_HOLD: "bg-gray-100 text-gray-700 border-gray-200",
      PENDING: "bg-amber-100 text-amber-700 border-amber-200",
    };
    return colors[status] || "bg-gray-100 text-gray-700 border-gray-200";
  };

  const statCards = [
    {
      label: "Active Projects",
      value: stats.activeProjects,
      icon: FolderKanban,
      color: "text-blue-600",
      bg: "bg-blue-100",
      link: "/customer/projects",
    },
    {
      label: "Pending Requests",
      value: stats.pendingRequests,
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-100",
      link: "/customer/requests",
    },
    {
      label: "Completed Projects",
      value: stats.completedProjects,
      icon: CheckCircle2,
      color: "text-green-600",
      bg: "bg-green-100",
      link: "/customer/projects",
    },
    {
      label: "Outstanding Invoices",
      value: stats.outstandingInvoices,
      icon: DollarSign,
      color: "text-red-600",
      bg: "bg-red-100",
      link: "/customer/invoices",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold">Customer Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Welcome back! Here's an overview of your projects and activities.
          </p>
        </div>
        <Link
          to="/customer/requests"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg cta-gradient text-white font-medium hover:opacity-90 transition-opacity text-sm"
        >
          <FileText className="h-4 w-4" />
          New Request
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Link
            key={stat.label}
            to={stat.link}
            className="rounded-2xl bg-background border border-border card-shadow p-5 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div className="flex-1">
                <div className="text-xs text-muted-foreground mb-1">{stat.label}</div>
                <div className={`font-display text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Projects */}
      <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <FolderKanban className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Recent Projects</h2>
              <p className="text-xs text-muted-foreground">Your active and recent projects</p>
            </div>
          </div>
          <Link
            to="/customer/projects"
            className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
          >
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="divide-y divide-border">
          {recentProjects.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <FolderKanban className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No projects found.</p>
            </div>
          ) : (
            recentProjects.map((project) => (
              <div key={project.id} className="p-5 hover:bg-secondary/50 transition-colors">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">{project.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Deadline: {project.endDate ? new Date(project.endDate).toLocaleDateString() : "No deadline"}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                      project.status
                    )}`}
                  >
                    {project.status.replace("_", " ")}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium text-primary">{project.progress}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Requests */}
      <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <FileText className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Recent Requests</h2>
              <p className="text-xs text-muted-foreground">Your submitted service requests</p>
            </div>
          </div>
          <Link
            to="/customer/requests"
            className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
          >
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="divide-y divide-border">
          {recentRequests.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No requests found.</p>
            </div>
          ) : (
            recentRequests.map((request) => (
              <div key={request.id} className="p-5 hover:bg-secondary/50 transition-colors">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">{request.subject}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Submitted: {new Date(request.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                      request.status
                    )}`}
                  >
                    {request.status.replace("_", " ")}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/customer/projects"
          className="rounded-xl bg-background border border-border card-shadow p-5 hover:shadow-lg transition-all group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FolderKanban className="h-5 w-5 text-blue-600" />
            </div>
            <h3 className="font-semibold">View Projects</h3>
          </div>
          <p className="text-sm text-muted-foreground">Track your project progress and milestones</p>
        </Link>

        <Link
          to="/customer/support"
          className="rounded-xl bg-background border border-border card-shadow p-5 hover:shadow-lg transition-all group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center group-hover:scale-110 transition-transform">
              <AlertCircle className="h-5 w-5 text-green-600" />
            </div>
            <h3 className="font-semibold">Get Support</h3>
          </div>
          <p className="text-sm text-muted-foreground">Contact our support team for assistance</p>
        </Link>

        <Link
          to="/customer/invoices"
          className="rounded-xl bg-background border border-border card-shadow p-5 hover:shadow-lg transition-all group"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center group-hover:scale-110 transition-transform">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <h3 className="font-semibold">View Invoices</h3>
          </div>
          <p className="text-sm text-muted-foreground">Check your billing and payment history</p>
        </Link>
      </div>
    </div>
  );
};

export default Overview;
