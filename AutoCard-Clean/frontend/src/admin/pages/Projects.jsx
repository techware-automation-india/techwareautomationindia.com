import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FolderKanban,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Users,
  Calendar,
  CheckCircle2,
  Clock,
  Archive,
  Eye,
  Edit2,
  Trash2,
  Loader2,
  Tag,
  LayoutGrid,
  List,
  Sparkles,
  ArrowUpRight,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, apiDelete } from "../../lib/api.js";

// Project Modal Component
export const ProjectModal = ({ project, onClose, onSave }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: project?.name || "",
    code: project?.code || "",
    description: project?.description || "",
    status: project?.status || "PLANNING",
    priority: project?.priority || "MEDIUM",
    startDate: project?.startDate ? project.startDate.split("T")[0] : "",
    endDate: project?.endDate ? project.endDate.split("T")[0] : "",
    customerId: project?.customerId || project?.customer?.id || "",
    managerId: project?.managerId || "",
    teamMembers: project?.assignments?.map((a) => a.employeeId || a.employee?.id) || [],
  });

  const [customers, setCustomers] = useState([]);
  const [employees, setEmployees] = useState([]);

  // Sync formData when project prop changes
  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name || "",
        code: project.code || "",
        description: project.description || "",
        status: project.status || "PLANNING",
        priority: project.priority || "MEDIUM",
        startDate: project.startDate ? project.startDate.split("T")[0] : "",
        endDate: project.endDate ? project.endDate.split("T")[0] : "",
        customerId: project.customerId || project.customer?.id || "",
        managerId: project.managerId || "",
        teamMembers: project.assignments?.map((a) => a.employeeId || a.employee?.id) || [],
      });
    } else {
      setFormData({
        name: "",
        code: "",
        description: "",
        status: "PLANNING",
        priority: "MEDIUM",
        startDate: "",
        endDate: "",
        customerId: "",
        managerId: "",
        teamMembers: [],
      });
    }
  }, [project]);

  // Load customers and employees on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [customersData, employeesData] = await Promise.all([
          apiGet("/customers").catch((err) => {
            console.error("Customers fetch error:", err);
            return { customers: [] };
          }),
          apiGet("/employees").catch((err) => {
            console.error("Employees fetch error:", err);
            return { employees: [] };
          }),
        ]);
        setCustomers(customersData.customers || []);
        setEmployees(employeesData.employees || []);
      } catch (error) {
        console.error("Failed to load data:", error);
        toast.error("Failed to load form data");
      }
    };
    loadData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validation
      if (!formData.name.trim()) {
        toast.error("Project name is required");
        return;
      }
      if (!formData.code.trim()) {
        toast.error("Project code is required");
        return;
      }

      const payload = {
        ...formData,
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
        customerId: formData.customerId || null,
        managerId: formData.managerId || null,
      };

      if (project) {
        // Update existing project
        await apiPatch(`/projects/${project.id}`, payload);
        toast.success("Project updated successfully!");
      } else {
        // Create new project
        await apiPost("/projects", payload);
        toast.success("Project created successfully!");
      }

      if (onSave) onSave();
      onClose();
    } catch (error) {
      console.error("Save error:", error);
      toast.error(error.message || "Failed to save project");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isMemberSelected = (emp) => {
    const empId = emp.id;
    const profileId = emp.employeeProfileId;
    return (
      formData.teamMembers.includes(empId) ||
      (profileId && formData.teamMembers.includes(profileId))
    );
  };

  const toggleTeamMember = (emp) => {
    const targetId = emp.employeeProfileId || emp.id;
    const isSelected = isMemberSelected(emp);
    setFormData((prev) => ({
      ...prev,
      teamMembers: isSelected
        ? prev.teamMembers.filter(
            (id) =>
              id !== emp.id &&
              id !== emp.employeeProfileId &&
              id !== emp.userId
          )
        : [...prev.teamMembers, targetId],
    }));
  };

  return (
    <div className="fixed inset-0 bg-foreground/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-background rounded-2xl border border-border card-shadow max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-background z-10">
          <h2 className="font-display text-xl font-bold">
            {project ? "Edit Project" : "Create New Project"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Basic Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Project Name */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">
                  Project Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="e.g., Website Redesign"
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  required
                />
              </div>

              {/* Project Code */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Project Code <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => handleChange("code", e.target.value.toUpperCase())}
                  placeholder="e.g., PROJ-001"
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
                  required
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium mb-2">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => handleChange("priority", e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Describe the project goals and objectives..."
                rows={4}
                className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>
          </div>

          {/* Status & Dates */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Schedule</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Status */}
              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => handleChange("status", e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="PLANNING">Planning</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="ON_HOLD">On Hold</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium mb-2">Start Date</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleChange("startDate", e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-sm font-medium mb-2">End Date</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => handleChange("endDate", e.target.value)}
                  min={formData.startDate}
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
          </div>

          {/* Assignment */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Assignment</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Customer */}
              <div>
                <label className="block text-sm font-medium mb-2">Customer</label>
                <select
                  value={formData.customerId}
                  onChange={(e) => handleChange("customerId", e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Select customer...</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.customerProfileId || customer.id}>
                      {customer.fullName || customer.user?.fullName || customer.companyName || customer.email}
                    </option>
                  ))}
                </select>
              </div>

            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 rounded-lg border border-border bg-background hover:bg-secondary transition-colors font-medium text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 rounded-lg cta-gradient text-white font-medium hover:opacity-90 transition-opacity text-sm disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  {project ? "Update Project" : "Create Project"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Projects = () => {
  const navigate = useNavigate();
  const [view, setView] = useState("all"); // all, archived
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [viewMode, setViewMode] = useState("grid"); // grid, table
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingProject, setEditingProject] = useState(null);

  // Load projects from backend
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await apiGet("/projects");
      setProjects(data.projects || []);
    } catch (error) {
      console.error("Failed to load projects:", error);
      toast.error(error.message || "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (!confirm("Are you sure you want to delete this project?")) return;

    try {
      await apiDelete(`/projects/${projectId}`);
      toast.success("Project deleted successfully!");
      loadProjects();
    } catch (error) {
      toast.error(error.message || "Failed to delete project");
    }
  };

  const handleArchiveProject = async (projectId, isArchived) => {
    try {
      await apiPatch(`/projects/${projectId}/archive`, { isArchived: !isArchived });
      toast.success(isArchived ? "Project unarchived!" : "Project archived!");
      loadProjects();
    } catch (error) {
      toast.error(error.message || "Failed to update project");
    }
  };

  const handleStatusChange = async (projectId, newStatus) => {
    try {
      await apiPatch(`/projects/${projectId}`, { status: newStatus });
      toast.success(`Project status updated to ${newStatus.replace("_", " ")}`);
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, status: newStatus } : p))
      );
    } catch (err) {
      toast.error(err.message || "Failed to update project status");
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      PLANNING: "bg-yellow-100 text-yellow-700 border-yellow-200",
      IN_PROGRESS: "bg-blue-100 text-blue-700 border-blue-200",
      ON_HOLD: "bg-gray-100 text-gray-700 border-gray-200",
      COMPLETED: "bg-green-100 text-green-700 border-green-200",
      CANCELLED: "bg-red-100 text-red-700 border-red-200",
    };
    return colors[status] || "bg-gray-100 text-gray-700 border-gray-200";
  };

  const filteredProjects = projects
    .filter((p) => (view === "archived" ? p.isArchived : !p.isArchived))
    .filter((p) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        p.name?.toLowerCase().includes(q) ||
        p.code?.toLowerCase().includes(q) ||
        p.customer?.name?.toLowerCase().includes(q) ||
        p.customer?.fullName?.toLowerCase().includes(q) ||
        p.customer?.companyName?.toLowerCase().includes(q);
      const matchesFilter = filterStatus === "ALL" || p.status === filterStatus;
      return matchesSearch && matchesFilter;
    });

  const stats = {
    total: projects.filter((p) => !p.isArchived).length,
    inProgress: projects.filter((p) => p.status === "IN_PROGRESS" && !p.isArchived).length,
    planning: projects.filter((p) => p.status === "PLANNING" && !p.isArchived).length,
    completed: projects.filter((p) => p.status === "COMPLETED" && !p.isArchived).length,
    archived: projects.filter((p) => p.isArchived).length,
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] rounded-3xl border border-border/80 bg-card p-12 text-center shadow-xs">
        <div className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <FolderKanban className="absolute h-4 w-4 text-primary" />
        </div>
        <p className="text-base font-bold text-foreground">Loading workspace projects...</p>
        <p className="mt-1 text-xs text-muted-foreground">Syncing allocated items and team assignments</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Modern Hero Header ─── */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card to-primary/[0.04] p-6 sm:p-8 shadow-xs">
        <div className="absolute right-0 top-0 -mt-6 -mr-6 h-48 w-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2.5 rounded-xl border border-border bg-background hover:bg-secondary text-muted-foreground hover:text-foreground transition-all shrink-0 cursor-pointer shadow-xs self-start"
              aria-label="Back"
              title="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/20">
              <FolderKanban className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                  Projects Management
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                  <Sparkles className="h-3 w-3" /> {stats.total} Active
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-xl leading-relaxed">
                Track allocated inventory materials, milestones, customer deliverables, and team execution across all project folders.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setEditingProject(null);
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl cta-gradient text-white text-xs sm:text-sm font-bold shadow-md shadow-primary/25 hover:opacity-95 hover:shadow-lg transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>New Project</span>
            </button>
          </div>
        </div>

        {/* ─── Metric KPI Cards ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-border/60">
          {[
            { label: "Total Projects", value: stats.total, sub: "In system", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", icon: FolderKanban },
            { label: "In Progress", value: stats.inProgress, sub: "Active execution", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10 border-purple-500/20", icon: Clock },
            { label: "Completed", value: stats.completed, sub: "Delivered", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle2 },
            { label: "Archived", value: stats.archived, sub: "Historical", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", icon: Archive },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`rounded-2xl border ${stat.bg} p-4 transition-all hover:scale-[1.02]`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{stat.label}</span>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className={`font-display text-2xl font-black ${stat.color}`}>{stat.value}</span>
                <span className="text-[11px] text-muted-foreground">{stat.sub}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Filters & Control Bar ─── */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Segmented Filter Buttons */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-secondary/40 border border-border/60 overflow-x-auto">
            {[
              { id: "all", label: "All Projects", count: stats.total },
              { id: "in_progress", label: "In Progress", count: stats.inProgress },
              { id: "completed", label: "Completed", count: stats.completed },
              { id: "archived", label: "Archived", count: stats.archived },
            ].map((tab) => {
              const active = (tab.id === "archived" && view === "archived") ||
                             (tab.id === "in_progress" && view === "all" && filterStatus === "IN_PROGRESS") ||
                             (tab.id === "completed" && view === "all" && filterStatus === "COMPLETED") ||
                             (tab.id === "all" && view === "all" && filterStatus === "ALL");
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    if (tab.id === "archived") {
                      setView("archived");
                      setFilterStatus("ALL");
                    } else if (tab.id === "in_progress") {
                      setView("all");
                      setFilterStatus("IN_PROGRESS");
                    } else if (tab.id === "completed") {
                      setView("all");
                      setFilterStatus("COMPLETED");
                    } else {
                      setView("all");
                      setFilterStatus("ALL");
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                    active
                      ? "bg-background text-foreground shadow-xs border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${active ? "bg-primary/10 text-primary font-black" : "bg-muted text-muted-foreground"}`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Bar & View Mode Toggle */}
          <div className="flex items-center gap-2.5 flex-1 lg:max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name, project code, customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 rounded-xl border border-border/80 bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs sm:text-sm font-medium"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center rounded-xl border border-border/80 bg-secondary/30 p-1 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                title="Grid View"
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === "grid"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                title="Table View"
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === "table"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Projects Content: Grid or Table ─── */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredProjects.map((project) => {
            return (
              <div
                key={project.id}
                onClick={() => navigate(`/admin/project/${project.id}`)}
                className="group relative rounded-3xl bg-card border border-border/80 p-5 shadow-xs hover:shadow-lg hover:border-primary/50 transition-all duration-300 cursor-pointer flex flex-col justify-between overflow-hidden"
              >
                <div className="space-y-4">
                  {/* Header: Code, Status & More Menu */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        {project.code && (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-black px-2.5 py-0.5 rounded-lg bg-primary/10 border border-primary/20 text-primary">
                            <Tag className="h-3 w-3" />
                            {project.code}
                          </span>
                        )}
                        <select
                          value={project.status}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onChange={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleStatusChange(project.id, e.target.value);
                          }}
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border cursor-pointer focus:outline-none transition-colors ${getStatusColor(
                            project.status
                          )}`}
                        >
                          <option value="PLANNING">Planning</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="ON_HOLD">On Hold</option>
                          <option value="COMPLETED">Completed</option>
                          <option value="CANCELLED">Cancelled</option>
                        </select>
                      </div>

                      <h3 className="font-display font-bold text-base sm:text-lg text-foreground group-hover:text-primary transition-colors line-clamp-1">
                        {project.name}
                      </h3>
                    </div>

                    <div
                      className="relative shrink-0"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    >
                      <div className="group/menu relative">
                        <button
                          type="button"
                          className="p-1.5 hover:bg-secondary rounded-xl text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        <div
                          className="absolute right-0 top-full mt-1 w-44 rounded-2xl border border-border bg-card shadow-xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-20 overflow-hidden py-1"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                        >
                          <Link
                            to={`/admin/project/${project.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View Details
                          </Link>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setEditingProject(project);
                              setShowCreateModal(true);
                            }}
                            className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-secondary transition-colors text-left"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            Edit Project
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleArchiveProject(project.id, project.isArchived);
                            }}
                            className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-secondary transition-colors text-left"
                          >
                            <Archive className="h-3.5 w-3.5" />
                            {project.isArchived ? "Unarchive" : "Archive"}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeleteProject(project.id);
                            }}
                            className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors text-left"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete Project
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {project.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {project.description}
                    </p>
                  )}

                  {/* Customer Information Card */}
                  <div className="flex items-center gap-2.5 text-xs p-2.5 rounded-xl bg-secondary/40 border border-border/70">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                      <Users className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider leading-none">Customer</p>
                      <p className="font-bold text-foreground truncate mt-0.5">
                        {project.customer?.fullName || project.customer?.name || project.customer?.companyName || "No customer assigned"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer: Due Date & Action Link */}
                <div className="flex items-center justify-between text-xs pt-3 mt-4 border-t border-border/70 text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
                    <span>
                      Due:{" "}
                      <strong className="text-foreground font-semibold">
                        {project.endDate ? new Date(project.endDate).toLocaleDateString() : "Not set"}
                      </strong>
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1 font-bold text-primary text-xs group-hover:translate-x-1 transition-transform">
                    View Details →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="overflow-hidden rounded-3xl border border-border/80 bg-card shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="py-3.5 px-4">Project & Code</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4">Target Due Date</th>
                  <th className="py-3.5 px-4 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {filteredProjects.map((project) => {
                  return (
                    <tr
                      key={project.id}
                      onClick={() => navigate(`/admin/project/${project.id}`)}
                      className="hover:bg-secondary/25 transition-colors cursor-pointer"
                    >
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {project.code && (
                              <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-secondary border border-border text-foreground">
                                {project.code}
                              </span>
                            )}
                            <span className="font-bold text-foreground hover:text-primary transition-colors text-sm">
                              {project.name}
                            </span>
                          </div>
                          {project.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 max-w-[280px]">
                              {project.description}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-4 font-semibold text-foreground">
                        {project.customer?.fullName || project.customer?.name || project.customer?.companyName || "—"}
                      </td>

                      <td className="py-4 px-4 text-center">
                        <select
                          value={project.status}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onChange={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleStatusChange(project.id, e.target.value);
                          }}
                          className={`px-3 py-1 rounded-full text-xs font-bold border cursor-pointer focus:outline-none ${getStatusColor(
                            project.status
                          )}`}
                        >
                          <option value="PLANNING">Planning</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="ON_HOLD">On Hold</option>
                          <option value="COMPLETED">Completed</option>
                          <option value="CANCELLED">Cancelled</option>
                        </select>
                      </td>

                      <td className="py-4 px-4 text-muted-foreground font-medium">
                        {project.endDate ? new Date(project.endDate).toLocaleDateString() : "—"}
                      </td>

                      <td className="py-4 px-4 text-right">
                        <div
                          className="inline-flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link
                            to={`/admin/project/${project.id}`}
                            className="p-2 rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProject(project);
                              setShowCreateModal(true);
                            }}
                            className="p-2 rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filteredProjects.length === 0 && (
        <div className="text-center py-12 rounded-2xl bg-background border border-border">
          <FolderKanban className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
          <h3 className="font-semibold text-lg mb-2">No projects found</h3>
          <p className="text-sm text-muted-foreground mb-6">
            {view === "archived" 
              ? "No archived projects yet."
              : "Create your first project to get started."}
          </p>
          {view !== "archived" && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-6 py-2 rounded-lg cta-gradient text-white font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" />
              Create Project
            </button>
          )}
        </div>
      )}

      {/* Create/Edit Project Modal */}
      {showCreateModal && (
        <ProjectModal 
          project={editingProject}
          onClose={() => {
            setShowCreateModal(false);
            setEditingProject(null);
          }}
          onSave={loadProjects}
        />
      )}
    </div>
  );
};

export default Projects;
