import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, apiDelete } from "../../lib/api.js";

// Project Modal Component
const ProjectModal = ({ project, onClose, onSave }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: project?.name || "",
    code: project?.code || "",
    description: project?.description || "",
    status: project?.status || "PLANNING",
    priority: project?.priority || "MEDIUM",
    startDate: project?.startDate?.split('T')[0] || "",
    endDate: project?.endDate?.split('T')[0] || "",
    customerId: project?.customerId || "",
    managerId: project?.managerId || "",
    teamMembers: project?.assignments?.map(a => a.employeeId) || [],
  });

  const [customers, setCustomers] = useState([]);
  const [employees, setEmployees] = useState([]);

  // Load customers and employees on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [customersData, employeesData] = await Promise.all([
          apiGet("/customers"),
          apiGet("/employees")
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
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleTeamMember = (memberId) => {
    setFormData(prev => ({
      ...prev,
      teamMembers: prev.teamMembers.includes(memberId)
        ? prev.teamMembers.filter(id => id !== memberId)
        : [...prev.teamMembers, memberId]
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
                    <option key={customer.id} value={customer.id}>
                      {customer.user?.fullName || customer.companyName || customer.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Project Manager */}
              <div>
                <label className="block text-sm font-medium mb-2">Project Manager</label>
                <select
                  value={formData.managerId}
                  onChange={(e) => handleChange("managerId", e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Select manager...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Team Members */}
            <div>
              <label className="block text-sm font-medium mb-2">Team Members</label>
              <div className="max-h-48 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                {employees.map((emp) => (
                  <label
                    key={emp.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={formData.teamMembers.includes(emp.id)}
                      onChange={() => toggleTeamMember(emp.id)}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/30"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{emp.fullName}</div>
                      <div className="text-xs text-muted-foreground">{emp.email}</div>
                    </div>
                  </label>
                ))}
              </div>
              {formData.teamMembers.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  {formData.teamMembers.length} member{formData.teamMembers.length !== 1 ? "s" : ""} selected
                </p>
              )}
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
  const [view, setView] = useState("all"); // all, archived
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
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
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterStatus === "ALL" || p.status === filterStatus;
      return matchesSearch && matchesFilter;
    });

  const stats = {
    total: projects.filter((p) => !p.isArchived).length,
    inProgress: projects.filter((p) => p.status === "IN_PROGRESS" && !p.isArchived).length,
    completed: projects.filter((p) => p.status === "COMPLETED" && !p.isArchived).length,
    archived: projects.filter((p) => p.isArchived).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-16 h-16 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <FolderKanban className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Projects</h1>
            <p className="text-sm text-muted-foreground">Manage your projects and team assignments</p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg cta-gradient text-white font-medium hover:opacity-90 transition-opacity text-sm"
        >
          <Plus className="h-4 w-4" />
          Create Project
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Projects", value: stats.total, color: "text-blue-600", bg: "bg-blue-100", icon: FolderKanban },
          { label: "In Progress", value: stats.inProgress, color: "text-purple-600", bg: "bg-purple-100", icon: Clock },
          { label: "Completed", value: stats.completed, color: "text-green-600", bg: "bg-green-100", icon: CheckCircle2 },
          { label: "Archived", value: stats.archived, color: "text-gray-600", bg: "bg-gray-100", icon: Archive },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl bg-background border border-border card-shadow p-5">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div className="flex-1">
                <div className="text-xs text-muted-foreground mb-1">{stat.label}</div>
                <div className={`font-display text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters & Tabs */}
      <div className="rounded-2xl bg-background border border-border card-shadow p-4 space-y-4">
        {/* View Tabs */}
        <div className="flex items-center gap-2 border-b border-border pb-4">
          <button
            onClick={() => setView("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === "all"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            All Projects
          </button>
          <button
            onClick={() => setView("archived")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === "archived"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Archive className="h-4 w-4 inline mr-2" />
            Archived ({stats.archived})
          </button>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search projects or customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="ALL">All Status</option>
            <option value="PLANNING">Planning</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredProjects.map((project) => (
          <Link
            key={project.id}
            to={`/admin/project/${project.id}`}
            className="rounded-2xl bg-background border border-border card-shadow overflow-hidden hover:shadow-lg transition-shadow block"
          >
            <div className="p-6 space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-lg">{project.name}</h3>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(
                        project.status
                      )}`}
                    >
                      {project.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
                </div>

                <div className="relative group">
                  <button className="p-2 hover:bg-secondary rounded-lg transition-colors">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-border bg-background shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                    <Link
                      to={`/admin/project/${project.id}`}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-secondary transition-colors"
                    >
                      <Eye className="h-4 w-4" />
                      View Details
                    </Link>
                    <button 
                      onClick={() => {
                        setEditingProject(project);
                        setShowCreateModal(true);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-secondary transition-colors text-left"
                    >
                      <Edit2 className="h-4 w-4" />
                      Edit Project
                    </button>
                    <button 
                      onClick={() => handleArchiveProject(project.id, project.isArchived)}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-secondary transition-colors text-left"
                    >
                      <Archive className="h-4 w-4" />
                      {project.isArchived ? "Unarchive" : "Archive"}
                    </button>
                    <button 
                      onClick={() => handleDeleteProject(project.id)}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-destructive/10 text-destructive transition-colors text-left"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Project
                    </button>
                  </div>
                </div>
              </div>

              {/* Customer */}
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-medium">{project.customer?.name || "No customer"}</span>
              </div>

              {/* Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-semibold text-primary">{project.progress}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>

              {/* Tasks */}
              <div className="flex items-center justify-between text-sm pt-3 border-t border-border">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-muted-foreground">
                    Tasks: <span className="font-medium text-foreground">
                      {project.tasks?.filter(t => t.status === "COMPLETED").length || 0}/{project.tasks?.length || 0}
                    </span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Due: <span className="font-medium text-foreground">
                      {project.endDate ? new Date(project.endDate).toLocaleDateString() : "Not set"}
                    </span>
                  </span>
                </div>
              </div>

              {/* Team */}
              <div className="flex items-center gap-2 pt-3 border-t border-border">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Team:</span>
                <div className="flex -space-x-2">
                  {project.assignments?.slice(0, 3).map((assignment) => (
                    <div
                      key={assignment.id}
                      className="w-7 h-7 rounded-full bg-primary/10 border-2 border-background flex items-center justify-center text-xs font-semibold text-primary"
                      title={assignment.employee?.fullName}
                    >
                      {assignment.employee?.fullName?.split(" ").map(n => n[0]).join("").toUpperCase() || "?"}
                    </div>
                  ))}
                  {(project.assignments?.length || 0) > 3 && (
                    <div className="w-7 h-7 rounded-full bg-secondary border-2 border-background flex items-center justify-center text-xs font-medium">
                      +{project.assignments.length - 3}
                    </div>
                  )}
                  {(!project.assignments || project.assignments.length === 0) && (
                    <span className="text-xs text-muted-foreground">No team members</span>
                  )}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

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
