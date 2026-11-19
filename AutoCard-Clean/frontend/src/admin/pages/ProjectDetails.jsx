import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { exportStyledExcelWithLogo } from "../../lib/excelExportHelper.js";
import {
  ArrowLeft,
  FolderKanban,
  Eye,
  Edit2,
  Archive,
  Trash2,
  MoreVertical,
  Calendar,
  Users,
  User,
  CheckCircle2,
  Clock,
  FileText,
  MessageSquare,
  Activity,
  ListTodo,
  Plus,
  Download,
  Upload,
  Send,
  AlertCircle,
  Target,
  TrendingUp,
  Loader2,
  Folder,
  Package,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Tag,
  X,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, apiDelete, apiPut } from "../../lib/api.js";
import { formatTimeWithPeriod } from "../../lib/timeFormat.js";
import { ProjectModal } from "./Projects.jsx";

const ProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") || "overview";
  });
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Load project data
  const loadProject = async () => {
    try {
      const data = await apiGet(`/projects/${id}`);
      setProject(data.project);
    } catch (error) {
      console.error("Failed to load project:", error);
      toast.error(error.message || "Failed to load project details");
      navigate("/admin/projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProject();
  }, [id]);

  const handleArchiveProject = async () => {
    if (!project) return;
    try {
      await apiPatch(`/projects/${id}/archive`, { isArchived: !project.isArchived });
      toast.success(project.isArchived ? "Project unarchived!" : "Project archived!");
      setProject((prev) => ({ ...prev, isArchived: !prev.isArchived }));
    } catch (err) {
      toast.error(err.message || "Failed to archive project");
    }
  };

  const handleDeleteProject = async () => {
    if (!confirm("Are you sure you want to delete this project?")) return;
    try {
      await apiDelete(`/projects/${id}`);
      toast.success("Project deleted successfully!");
      navigate("/admin/projects");
    } catch (err) {
      toast.error(err.message || "Failed to delete project");
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

  const getPriorityColor = (priority) => {
    const colors = {
      LOW: "text-green-600",
      MEDIUM: "text-yellow-600",
      HIGH: "text-orange-600",
      URGENT: "text-red-600",
    };
    return colors[priority] || "text-gray-600";
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: Eye },
    { id: "tasks", label: "Tasks", icon: ListTodo, count: project?.tasks?.length || 0 },
    { id: "team", label: "Team", icon: Users, count: project?.assignments?.length || 0 },
    { id: "documents", label: "Category Folders & Products", icon: Folder, count: project?.documents?.length || 0 },
    { id: "activity", label: "Activity", icon: Activity },
    { id: "comments", label: "Comments", icon: MessageSquare, count: project?.comments?.length || 0 },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-16 w-16 mx-auto mb-4 text-destructive" />
        <h3 className="font-semibold text-lg mb-2">Project not found</h3>
        <p className="text-sm text-muted-foreground mb-6">The project you're looking for doesn't exist.</p>
        <Link
          to="/admin/projects"
          className="inline-flex items-center gap-2 px-6 py-2 rounded-lg cta-gradient text-white font-medium hover:opacity-90 transition-opacity"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Breadcrumb Back Navigation ─── */}
      <div className="flex items-center justify-between">
        <Link
          to="/admin/projects"
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-muted-foreground hover:text-primary transition-colors py-1 px-2.5 rounded-lg hover:bg-secondary/60"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Projects</span>
        </Link>
      </div>

      {/* ─── Modern Hero Header ─── */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card to-primary/[0.04] p-6 sm:p-8 shadow-xs">
        <div className="absolute right-0 top-0 -mt-6 -mr-6 h-48 w-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/20">
              <FolderKanban className="h-7 w-7" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                {project.code && (
                  <span className="inline-flex items-center gap-1 font-mono text-xs font-black px-2.5 py-0.5 rounded-lg bg-primary/10 border border-primary/20 text-primary">
                    <Tag className="h-3 w-3" />
                    {project.code}
                  </span>
                )}
                <select
                  value={project.status}
                  onChange={async (e) => {
                    const newStatus = e.target.value;
                    try {
                      await apiPatch(`/projects/${project.id}`, { status: newStatus });
                      toast.success(`Project status updated to ${newStatus.replace("_", " ")}`);
                      setProject((prev) => ({ ...prev, status: newStatus }));
                    } catch (err) {
                      toast.error(err.message || "Failed to update project status");
                    }
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-bold border cursor-pointer focus:outline-none transition-colors ${getStatusColor(
                    project.status
                  )}`}
                >
                  <option value="PLANNING">Planning</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="ON_HOLD">On Hold</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
                <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-lg border ${getPriorityColor(project.priority)}`}>
                  <Target className="h-3.5 w-3.5" />
                  Priority: {project.priority}
                </span>
              </div>

              <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                {project.name}
              </h1>

              {project.description && (
                <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
                  {project.description}
                </p>
              )}

              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap pt-1">
                <span className="flex items-center gap-1.5 font-medium">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  Timeline: {project.startDate ? new Date(project.startDate).toLocaleDateString() : "No start date"} → {project.endDate ? new Date(project.endDate).toLocaleDateString() : "No deadline"}
                </span>
                {project.customer && (
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <Users className="h-3.5 w-3.5 text-primary" />
                    Customer: {project.customer?.fullName || project.customer?.name || project.customer?.companyName || "N/A"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => setShowEditModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border/80 bg-background hover:bg-secondary text-foreground text-xs sm:text-sm font-bold shadow-2xs transition-all cursor-pointer"
            >
              <Edit2 className="h-4 w-4" />
              <span>Edit Info</span>
            </button>

            <button
              type="button"
              onClick={handleArchiveProject}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-border/80 bg-background hover:bg-secondary text-muted-foreground hover:text-foreground text-xs font-semibold shadow-2xs transition-all cursor-pointer"
              title={project.isArchived ? "Unarchive Project" : "Archive Project"}
            >
              <Archive className="h-4 w-4" />
              <span>{project.isArchived ? "Unarchive" : "Archive"}</span>
            </button>

            <button
              type="button"
              onClick={handleDeleteProject}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-destructive/20 bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-semibold transition-all cursor-pointer"
              title="Delete Project"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Category Folders & Allocated Products Section ─── */}
      <div className="rounded-3xl bg-card border border-border/80 p-6 sm:p-8 shadow-xs">
        <DocumentsTab project={project} setProject={setProject} />
      </div>

      {/* Edit Project Modal */}
      {showEditModal && (
        <ProjectModal
          project={project}
          onClose={() => setShowEditModal(false)}
          onSave={loadProject}
        />
      )}
    </div>
  );
};

// Overview Tab Component
const OverviewTab = ({ project }) => {
  const getStatusColor = (status) => {
    const colors = {
      PLANNING: "bg-yellow-100 text-yellow-700",
      IN_PROGRESS: "bg-blue-100 text-blue-700",
      ON_HOLD: "bg-gray-100 text-gray-700",
      COMPLETED: "bg-green-100 text-green-700",
      CANCELLED: "bg-red-100 text-red-700",
    };
    return colors[status] || "bg-gray-100 text-gray-700";
  };

  const tasksByStatus = {
    TODO: project.tasks?.filter((t) => t.status === "TODO").length || 0,
    IN_PROGRESS: project.tasks?.filter((t) => t.status === "IN_PROGRESS").length || 0,
    COMPLETED: project.tasks?.filter((t) => t.status === "COMPLETED").length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <ListTodo className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">{tasksByStatus.TODO}</div>
              <div className="text-xs text-blue-700">To Do</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">{tasksByStatus.IN_PROGRESS}</div>
              <div className="text-xs text-yellow-700">In Progress</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-green-50 border border-green-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{tasksByStatus.COMPLETED}</div>
              <div className="text-xs text-green-700">Completed</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-purple-50 border border-purple-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">{project.assignments?.length || 0}</div>
              <div className="text-xs text-purple-700">Team Members</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Project Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="rounded-xl border border-border p-5">
            <h3 className="font-semibold mb-3">Project Description</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {project.description || "No description provided."}
            </p>
          </div>

          {/* Timeline */}
          <div className="rounded-xl border border-border p-5">
            <h3 className="font-semibold mb-4">Timeline</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Start Date</span>
                <span className="text-sm font-medium">
                  {project.startDate ? new Date(project.startDate).toLocaleDateString() : "Not set"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">End Date</span>
                <span className="text-sm font-medium">
                  {project.endDate ? new Date(project.endDate).toLocaleDateString() : "Not set"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Duration</span>
                <span className="text-sm font-medium">
                  {project.startDate && project.endDate
                    ? `${Math.max(
                        0,
                        Math.ceil((new Date(project.endDate) - new Date(project.startDate)) / (1000 * 60 * 60 * 24))
                      )} days`
                    : "N/A"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          {/* Customer */}
          <div className="rounded-xl border border-border p-5">
            <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">Customer</h3>
            <div className="space-y-2">
              <div className="font-semibold">
                {project.customer?.name ||
                  project.customer?.user?.fullName ||
                  project.customer?.companyName ||
                  "No customer"}
              </div>
              <div className="text-sm text-muted-foreground">
                {project.customer?.email || project.customer?.user?.email || ""}
              </div>
              {project.customer?.phone && (
                <div className="text-sm text-muted-foreground">{project.customer.phone}</div>
              )}
            </div>
          </div>

          {/* Project Manager */}
          {project.managerId && (
            <div className="rounded-xl border border-border p-5">
              <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">
                Project Manager
              </h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                  PM
                </div>
                <div>
                  <div className="font-semibold text-sm">Manager</div>
                  <div className="text-xs text-muted-foreground">ID: {project.managerId}</div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Stats */}
          <div className="rounded-xl border border-border p-5">
            <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wide">Quick Stats</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-semibold text-primary">{project.progress}%</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Priority</span>
                <span className="font-semibold">{project.priority}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                    project.status
                  )}`}
                >
                  {project.status.replace("_", " ")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Tasks Tab Component
const TasksTab = ({ project, setProject }) => {
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", priority: "MEDIUM", assigneeId: "", dueDate: "" });

  const getPriorityColor = (priority) => {
    const colors = {
      LOW: "text-green-600",
      MEDIUM: "text-yellow-600",
      HIGH: "text-orange-600",
      URGENT: "text-red-600",
    };
    return colors[priority] || "text-gray-600";
  };

  const handleAddTask = async () => {
    if (!newTask.title.trim()) {
      toast.error("Task title is required");
      return;
    }

    try {
      const res = await apiPost(`/projects/${project.id}/tasks`, newTask);
      toast.success("Task added successfully!");
      setShowAddTask(false);
      setNewTask({ title: "", priority: "MEDIUM", assigneeId: "", dueDate: "" });
      if (res.task && setProject) {
        setProject((prev) => ({
          ...prev,
          tasks: [...(prev.tasks || []), res.task],
        }));
      }
    } catch (error) {
      toast.error(error.message || "Failed to add task");
    }
  };

  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    try {
      await apiPut(`/projects/${project.id}/tasks/${taskId}`, { status: newStatus });
      toast.success("Task status updated");
      if (setProject) {
        setProject((prev) => ({
          ...prev,
          tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
        }));
      }
    } catch (err) {
      toast.error(err.message || "Failed to update task");
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await apiDelete(`/projects/${project.id}/tasks/${taskId}`);
      toast.success("Task deleted");
      if (setProject) {
        setProject((prev) => ({
          ...prev,
          tasks: prev.tasks.filter((t) => t.id !== taskId),
        }));
      }
    } catch (err) {
      toast.error(err.message || "Failed to delete task");
    }
  };

  const tasks = project.tasks || [];
  const tasksByStatus = {
    TODO: tasks.filter((t) => t.status === "TODO"),
    IN_PROGRESS: tasks.filter((t) => t.status === "IN_PROGRESS"),
    COMPLETED: tasks.filter((t) => t.status === "COMPLETED"),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Tasks ({tasks.length})</h3>
        <button
          onClick={() => setShowAddTask(!showAddTask)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg cta-gradient text-white font-medium hover:opacity-90 transition-opacity text-sm"
        >
          <Plus className="h-4 w-4" />
          Add Task
        </button>
      </div>

      {/* Add Task Form */}
      {showAddTask && (
        <div className="rounded-xl border border-border p-5 bg-secondary/20">
          <h4 className="font-semibold mb-4">New Task</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Task Title *</label>
              <input
                type="text"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="Enter task title..."
                className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Priority</label>
              <select
                value={newTask.priority}
                onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Due Date</label>
              <input
                type="date"
                value={newTask.dueDate}
                onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Assignee</label>
              <select
                value={newTask.assigneeId}
                onChange={(e) => setNewTask({ ...newTask, assigneeId: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Select team member...</option>
                {project.assignments?.map((assignment) => (
                  <option key={assignment.id} value={assignment.employeeId || assignment.employee?.id}>
                    {assignment.employee?.fullName || assignment.employee?.user?.fullName || "Employee"}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={handleAddTask}
              className="px-4 py-2 rounded-lg cta-gradient text-white font-medium hover:opacity-90 transition-opacity text-sm"
            >
              Add Task
            </button>
            <button
              onClick={() => setShowAddTask(false)}
              className="px-4 py-2 rounded-lg border border-border bg-background hover:bg-secondary transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tasks by Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {Object.entries(tasksByStatus).map(([status, groupTasks]) => (
          <div key={status} className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">{status.replace("_", " ")}</h4>
              <span className="text-xs text-muted-foreground">{groupTasks.length} tasks</span>
            </div>
            <div className="space-y-2">
              {groupTasks.map((task) => (
                <div key={task.id} className="rounded-lg border border-border p-4 bg-background hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h5 className="font-medium text-sm">{task.title}</h5>
                    <span className={`text-xs font-semibold ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                    <span>{task.assignee?.fullName || "Unassigned"}</span>
                    <span>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No date"}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <select
                      value={task.status}
                      onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value)}
                      className="text-xs rounded border border-border bg-background px-2 py-1 text-muted-foreground hover:text-foreground"
                    >
                      <option value="TODO">To Do</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="p-1 hover:bg-destructive/10 text-destructive rounded transition-colors"
                      title="Delete task"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {groupTasks.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground border-2 border-dashed border-border rounded-lg">
                  No tasks
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Team Tab Component
const TeamTab = ({ project, setProject }) => {
  const [showAddMember, setShowAddMember] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [roleOnProject, setRoleOnProject] = useState("Team Member");
  const [savingMember, setSavingMember] = useState(false);

  useEffect(() => {
    if (showAddMember && employees.length === 0) {
      apiGet("/employees")
        .then((res) => setEmployees(res.employees || []))
        .catch(() => {});
    }
  }, [showAddMember]);

  const handleAddMember = async () => {
    if (!selectedEmpId) {
      toast.error("Please select an employee");
      return;
    }

    setSavingMember(true);
    try {
      const res = await apiPost(`/projects/${project.id}/team`, {
        employeeId: selectedEmpId,
        roleOnProject,
      });
      toast.success("Team member added!");
      setShowAddMember(false);
      setSelectedEmpId("");
      if (setProject && res.assignment) {
        setProject((prev) => ({
          ...prev,
          assignments: [...(prev.assignments || []), res.assignment],
        }));
      }
    } catch (err) {
      toast.error(err.message || "Failed to add team member");
    } finally {
      setSavingMember(false);
    }
  };

  const handleRemoveMember = async (assignmentId) => {
    if (!confirm("Are you sure you want to remove this team member?")) return;
    try {
      await apiDelete(`/projects/${project.id}/team/${assignmentId}`);
      toast.success("Team member removed!");
      if (setProject) {
        setProject((prev) => ({
          ...prev,
          assignments: (prev.assignments || []).filter((a) => a.id !== assignmentId),
        }));
      }
    } catch (err) {
      toast.error(err.message || "Failed to remove member");
    }
  };

  const team = project.assignments || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Team Members ({team.length})</h3>
        <button
          onClick={() => setShowAddMember(!showAddMember)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg cta-gradient text-white font-medium hover:opacity-90 transition-opacity text-sm"
        >
          <Plus className="h-4 w-4" />
          Add Member
        </button>
      </div>

      {/* Add Member Box */}
      {showAddMember && (
        <div className="rounded-xl border border-border p-5 bg-secondary/20 space-y-4">
          <h4 className="font-semibold text-sm">Assign New Team Member</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Select Employee *</label>
              <select
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              >
                <option value="">Choose employee...</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.employeeProfileId || emp.id}>
                    {emp.fullName} ({emp.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Role on Project</label>
              <input
                type="text"
                value={roleOnProject}
                onChange={(e) => setRoleOnProject(e.target.value)}
                placeholder="e.g. Frontend Developer, Designer"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddMember}
              disabled={savingMember}
              className="px-4 py-2 rounded-lg cta-gradient text-white font-medium hover:opacity-90 transition-opacity text-sm disabled:opacity-60"
            >
              {savingMember ? "Adding..." : "Add Member"}
            </button>
            <button
              onClick={() => setShowAddMember(false)}
              className="px-4 py-2 rounded-lg border border-border bg-background hover:bg-secondary transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {team.map((assignment) => {
          const emp = assignment.employee;
          const name = emp?.fullName || emp?.user?.fullName || "Employee";
          const email = emp?.email || emp?.user?.email || "";
          const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase() || "?";

          return (
            <div key={assignment.id} className="rounded-xl border border-border p-5 bg-background hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-lg shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold truncate">{name}</h4>
                  <p className="text-sm text-muted-foreground mb-1 truncate">{email}</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                    {assignment.roleOnProject || "Team Member"}
                  </span>
                </div>
                <button
                  onClick={() => handleRemoveMember(assignment.id)}
                  className="p-2 hover:bg-destructive/10 text-destructive rounded-lg transition-colors"
                  title="Remove from project"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
        {team.length === 0 && (
          <div className="col-span-2 text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl">
            No team members assigned yet
          </div>
        )}
      </div>
    </div>
  );
};

// Documents & Category Folders Tab Component
const DocumentsTab = ({ project, setProject }) => {
  const docs = project?.documents || [];
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [adminInventoryCategories, setAdminInventoryCategories] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);

  useEffect(() => {
    let isMounted = true;
    const fetchInventoryCategories = async () => {
      try {
        const res = await apiGet("/inventory/categories?rootOnly=true").catch(() => ({ categories: [] }));
        if (isMounted && res?.categories && Array.isArray(res.categories)) {
          const rootCatNames = res.categories
            .filter((c) => c.level === 1 || !c.parentId)
            .filter((c) => {
              const lower = (c.name || "").trim().toLowerCase();
              return (
                !lower.includes("consumable") &&
                !lower.includes("consuamble") &&
                !lower.includes("general") &&
                !lower.includes("genral") &&
                !lower.includes("tool")
              );
            })
            .map((c) => c.name)
            .filter(Boolean);
          setAdminInventoryCategories(rootCatNames);
        }
      } catch (err) {
        console.warn("Could not fetch root level-1 inventory categories for project folders:", err);
      }
    };

    const fetchInventoryItems = async () => {
      try {
        const res = await apiGet("/inventory/items").catch(() => ({ items: [] }));
        if (isMounted && res?.items && Array.isArray(res.items)) {
          setInventoryItems(res.items);
        }
      } catch (err) {
        console.warn("Could not fetch inventory items for hierarchy lookup:", err);
      }
    };

    fetchInventoryCategories();
    fetchInventoryItems();
    return () => { isMounted = false; };
  }, []);

  // Helper to extract category hierarchy: Root 1, Root 2, Root 3, Root 4 for an allocated item
  const getItemRoots = (prodId, cleanName) => {
    let matched = null;
    if (Array.isArray(inventoryItems) && inventoryItems.length > 0) {
      matched = inventoryItems.find((inv) => {
        const invCode = (inv.code || inv.sku || "").toLowerCase().trim();
        const invName = (inv.name || "").toLowerCase().trim();
        const pCode = (prodId || "").toLowerCase().trim();
        const pName = (cleanName || "").toLowerCase().trim();
        return (pCode && invCode && invCode === pCode) || (pName && invName && invName === pName);
      });
    }

    const chain = [];
    let curr = matched?.categoryRef;
    while (curr) {
      if (curr.name) chain.unshift(curr.name);
      curr = curr.parent;
    }
    if (chain.length === 0 && matched?.category) {
      chain.push(matched.category);
    }

    const formatLocation = (inv) => {
      if (!inv) return "—";
      const w = (inv.warehouse || "").trim();
      const l = (inv.location || "").trim();
      if (w && l) return `${w} (${l})`;
      if (l) return l;
      if (w) return w;
      return "—";
    };

    return {
      root1: chain[0] || (matched?.category || "Mechanical"),
      root2: chain[1] || "—",
      root3: chain[2] || "—",
      root4: chain[3] || "—",
      unit: matched?.unit || "Nos",
      location: formatLocation(matched),
    };
  };

  // Compile all allocated project items with roots 1, 2, 3, 4
  const getAllProjectAllocatedItems = () => {
    const list = [];
    Object.entries(categoryMap).forEach(([catKey, items]) => {
      items.forEach((item) => {
        const info = parseProductDocInfo(item);
        const roots = getItemRoots(info.prodId, info.cleanName);
        list.push({
          ...info,
          root1: roots.root1 !== "—" ? roots.root1 : catKey,
          root2: roots.root2,
          root3: roots.root3,
          root4: roots.root4,
          unit: roots.unit,
          location: roots.location,
        });
      });
    });
    return list;
  };

  // ─── Export to Excel (.xlsx BOM with Root-based tabs) ───
  const handleExportExcel = async (catArg = null) => {
    // If called directly by React onClick without args, catArg is a SyntheticEvent object!
    const targetCategory = typeof catArg === "string" ? catArg : null;
    let items = getAllProjectAllocatedItems();
    if (targetCategory) {
      items = items.filter(
        (it) => (it.root1 || "").toLowerCase() === targetCategory.toLowerCase()
      );
    }

    if (items.length === 0) {
      toast.error(
        targetCategory
          ? `No allocated items found under "${targetCategory}" folder.`
          : "No allocated items to export for this project."
      );
      return;
    }

    const headers = [
      "S.No",
      "Root 1",
      "Root 2",
      "Root 3",
      "Root 4",
      "Item Name",
      "SKU / Code",
      "Allocated Qty",
      "Approved By",
    ];

    // Group items by Root 1
    const groupedByRoot1 = new Map();
    items.forEach((it) => {
      const r1 = it.root1 && it.root1 !== "—" ? it.root1 : "General";
      if (!groupedByRoot1.has(r1)) {
        groupedByRoot1.set(r1, []);
      }
      groupedByRoot1.get(r1).push(it);
    });

    const colWidths = [8, 18, 18, 18, 18, 30, 16, 14, 20];
    const rightAlignCols = [7];
    const centerAlignCols = [0];

    const folderTitle = targetCategory ? `Category: ${targetCategory}` : "All Project Categories";
    const totalQty = items.reduce((acc, it) => acc + Number(it.quantity || 1), 0);

    const sheets = [];

    // Master Consolidated BOM Tab
    const masterRows = items.map((it, idx) => [
      idx + 1,
      it.root1 || "—",
      it.root2 || "—",
      it.root3 || "—",
      it.root4 || "—",
      it.cleanName || "N/A",
      it.prodId || "—",
      Number(it.quantity || 1),
      it.approvedByName || "Admin",
    ]);

    const masterSubtotal = [
      "",
      "",
      "",
      "",
      "",
      "GRAND TOTAL ALLOCATED UNITS:",
      "",
      totalQty,
      "",
    ];

    sheets.push({
      name: "Master BOM",
      title: "Project Bill of Materials (BOM)",
      subtitle: `Project: ${project?.name || "Project"} (${project?.code || "—"})  |  Customer: ${project?.customer?.fullName || project?.customer?.name || "N/A"}  |  Scope: ${folderTitle}  |  Allocated Units: ${totalQty}`,
      headers,
      rows: masterRows,
      subtotalRow: masterSubtotal,
      colWidths,
      rightAlignCols,
      centerAlignCols,
    });

    // Individual Root Level 1 Tabs
    groupedByRoot1.forEach((groupItems, r1Name) => {
      let subtotalQty = 0;
      const catRows = groupItems.map((it, idx) => {
        const q = Number(it.quantity || 1);
        subtotalQty += q;
        return [
          idx + 1,
          it.root1 || "—",
          it.root2 || "—",
          it.root3 || "—",
          it.root4 || "—",
          it.cleanName || "N/A",
          it.prodId || "—",
          q,
          it.approvedByName || "Admin",
        ];
      });

      const catSubtotal = [
        "",
        "",
        "",
        "",
        "",
        `SUBTOTAL (${r1Name}):`,
        "",
        subtotalQty,
        "",
      ];

      sheets.push({
        name: r1Name,
        title: `Category BOM: ${r1Name}`,
        subtitle: `Project: ${project?.name || "Project"}  |  Category: ${r1Name}  |  Active SKUs: ${groupItems.length}  |  Units: ${subtotalQty}`,
        headers,
        rows: catRows,
        subtotalRow: catSubtotal,
        colWidths,
        rightAlignCols,
        centerAlignCols,
      });
    });

    const catSuffix = targetCategory ? `_${targetCategory.replace(/\s+/g, "_")}` : "";
    await exportStyledExcelWithLogo({
      filename: `${project?.code || "PROJECT"}${catSuffix}_BOM_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheets,
    });
    toast.success(`Excel workbook with company logo & root tabs downloaded for ${targetCategory || "all categories"}!`);
    toast.success(`Excel workbook with root-based tabs downloaded for ${targetCategory || "all categories"}!`);
  };

  // ─── Export to PDF (Printable Formatted View) ───
  const handleExportPDF = (catArg = null) => {
    const targetCategory = typeof catArg === "string" ? catArg : null;
    let items = getAllProjectAllocatedItems();
    if (targetCategory) {
      items = items.filter(
        (it) => (it.root1 || "").toLowerCase() === targetCategory.toLowerCase()
      );
    }

    if (items.length === 0) {
      toast.error(
        targetCategory
          ? `No allocated items found under "${targetCategory}" folder.`
          : "No allocated items to print/download for this project."
      );
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow popups to download/print the PDF report.");
      return;
    }

    const folderTitle = targetCategory ? `Folder: ${targetCategory}` : "All Category Folders (BOM)";
    const totalQty = items.reduce((acc, it) => acc + (it.quantity || 1), 0);

    // Group items by Root 1
    const groupedByRoot1 = new Map();
    items.forEach((it) => {
      const r1 = it.root1 || "Unassigned";
      if (!groupedByRoot1.has(r1)) {
        groupedByRoot1.set(r1, []);
      }
      groupedByRoot1.get(r1).push(it);
    });

    let globalItemIndex = 0;
    const rootSectionsHtml = Array.from(groupedByRoot1.entries())
      .map(([r1Name, groupItems], groupIdx) => {
        const groupUnits = groupItems.reduce((acc, it) => acc + (it.quantity || 1), 0);

        const groupRowsHtml = groupItems
          .map((it) => {
            globalItemIndex += 1;
            return `
              <tr>
                <td style="text-align: center; color: #64748b;">${globalItemIndex}</td>
                <td style="color: #1e3a8a; font-weight: 700;">${it.root1}</td>
                <td style="color: #4338ca;">${it.root2}</td>
                <td style="color: #b45309;">${it.root3}</td>
                <td style="color: #be123c;">${it.root4}</td>
                <td>
                  <strong>${it.cleanName}</strong>
                  ${it.prodId ? `<div style="font-size: 10px; color: #64748b; font-family: monospace;">(${it.prodId})</div>` : ""}
                </td>
                <td class="qty">${it.quantity}</td>
                <td style="font-weight: 600; color: #047857;">${it.approvedByName || "Admin"}</td>
              </tr>
            `;
          })
          .join("");

        return `
          <div class="root-section ${groupIdx > 0 ? 'page-break' : ''}">
            <div class="root-banner">
              <div class="banner-left">
                <span class="root-badge">ROOT LEVEL 1</span>
                <span class="root-name">${r1Name}</span>
              </div>
              <div class="banner-right">
                <span>SKUs: <strong>${groupItems.length}</strong></span>
                <span>Units: <strong>${groupUnits}</strong></span>
                <button class="no-print btn-print-cat" onclick="printCategorySection('${r1Name.replace(/'/g, "\\'")}')" title="Print/Download PDF for ${r1Name}">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Download ${r1Name} PDF
                </button>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 35px; text-align: center;">S.No</th>
                  <th>Root 1</th>
                  <th>Root 2</th>
                  <th>Root 3</th>
                  <th>Root 4</th>
                  <th>Item</th>
                  <th style="width: 60px; text-align: center;">Qty</th>
                  <th>Approved By</th>
                </tr>
              </thead>
              <tbody>
                ${groupRowsHtml}
                <tr class="subtotal-row">
                  <td colspan="6" style="text-align: right; padding: 8px; font-weight: bold; color: #475569;">SUBTOTAL FOR ROOT 1 (${r1Name}):</td>
                  <td style="text-align: center; color: #047857; font-weight: 800;">${groupUnits}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        `;
      })
      .join("");

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${project?.name || "Project"} - ${folderTitle}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; color: #1e293b; background: #fff; }
            .header {
              border-bottom: 2px solid #0284c7;
              padding-bottom: 14px;
              margin-bottom: 16px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .company-brand-area {
              display: flex;
              align-items: center;
              gap: 16px;
            }
            .company-logo-img {
              height: 52px;
              width: auto;
              max-width: 160px;
              object-fit: contain;
            }
            .title { font-size: 20px; font-weight: 800; color: #0f172a; margin: 0; }
            .subtitle { font-size: 11px; color: #64748b; margin: 2px 0 0 0; }
            .meta { font-size: 11px; color: #64748b; text-align: right; }
            .root-section { margin-bottom: 24px; }
            .root-banner {
              background: #f0f9ff;
              border-left: 4px solid #0284c7;
              padding: 8px 12px;
              margin-bottom: 8px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-radius: 0 6px 6px 0;
            }
            .banner-left { display: flex; align-items: center; gap: 8px; }
            .root-badge {
              font-size: 9px;
              font-weight: 800;
              background: #0284c7;
              color: #fff;
              padding: 2px 6px;
              border-radius: 4px;
              letter-spacing: 0.05em;
            }
            .root-name { font-size: 14px; font-weight: 800; color: #0369a1; }
            .banner-right {
              font-size: 11px;
              color: #475569;
              display: flex;
              align-items: center;
              gap: 16px;
            }
            .btn-print-cat {
              background: #0284c7;
              color: #ffffff;
              border: none;
              border-radius: 4px;
              padding: 4px 10px;
              font-size: 10px;
              font-weight: 700;
              cursor: pointer;
              display: inline-flex;
              align-items: center;
              box-shadow: 0 1px 2px rgba(0,0,0,0.08);
              transition: background 0.15s;
            }
            .btn-print-cat:hover {
              background: #0369a1;
            }
            table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 12px; }
            th { background-color: #f1f5f9; color: #475569; font-weight: 700; text-transform: uppercase; padding: 8px 6px; border: 1px solid #cbd5e1; text-align: left; font-size: 10px; }
            td { padding: 7px 6px; border: 1px solid #e2e8f0; vertical-align: middle; }
            .qty { font-weight: 800; color: #047857; text-align: center; }
            .subtotal-row { background: #f8fafc; font-weight: bold; }
            @media print {
              body { padding: 0; }
              @page { size: A4 landscape; margin: 10mm; }
              .page-break {
                page-break-before: always;
                break-before: page;
                margin-top: 20px;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-brand-area">
              <img src="/techwareLogo.png" alt="Techware Automation" class="company-logo-img" onerror="this.src='/techwareLogo.svg'" />
              <div>
                <h1 class="title">${project?.name || "Project"} — ${folderTitle}</h1>
                <p class="subtitle">Techware Automation (India) — Bill of Materials (BOM)</p>
              </div>
            </div>
            <div class="meta">
              <div><strong>Project Code:</strong> ${project?.code || "—"}</div>
              <div><strong>Customer:</strong> ${project?.customer?.fullName || project?.customer?.name || "N/A"}</div>
              <div><strong>Root 1 Groups:</strong> ${groupedByRoot1.size} &nbsp;|&nbsp; <strong>SKUs:</strong> ${items.length}</div>
              <div><strong>Generated:</strong> ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</div>
            </div>
          </div>

          ${rootSectionsHtml}

          <script>
            function printCategorySection(categoryName) {
              var sections = document.querySelectorAll('.root-section');
              sections.forEach(function(s) {
                var nameEl = s.querySelector('.root-name');
                if (nameEl && nameEl.innerText.trim() === categoryName.trim()) {
                  s.style.display = 'block';
                  s.classList.remove('page-break');
                } else {
                  s.style.display = 'none';
                }
              });
              window.print();
              setTimeout(function() {
                sections.forEach(function(s, idx) {
                  s.style.display = 'block';
                  if (idx > 0) s.classList.add('page-break');
                });
              }, 1000);
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  const canonicalizeCategory = (rawCat) => {
    if (!rawCat) return null;
    const cat = String(rawCat).trim();
    const lower = cat.toLowerCase();

    // Do not create or show consumable, general, tool, or generic 'project' folders
    if (
      lower.includes("consumable") ||
      lower.includes("consuamble") ||
      lower.includes("general") ||
      lower.includes("genral") ||
      lower.includes("tool") ||
      lower === "project" ||
      lower === "projects" ||
      lower === "product" ||
      lower === "products"
    ) {
      return null;
    }

    // Filter out legacy default names
    if (
      cat === "Mechanical Product" ||
      cat === "Electrical Product" ||
      cat === "Automation Product" ||
      cat === "Electronics Product" ||
      cat === "General / Consumables"
    ) {
      if (lower.includes("mechanical")) {
        const found = adminInventoryCategories.find((c) => c.toLowerCase().startsWith("mech"));
        return found || "Mechnical";
      }
      return null;
    }

    if (Array.isArray(adminInventoryCategories) && adminInventoryCategories.length > 0) {
      const exact = adminInventoryCategories.find((ac) => ac.toLowerCase() === lower);
      if (exact) return exact;

      if (lower.startsWith("mech")) {
        const mech = adminInventoryCategories.find((ac) => ac.toLowerCase().startsWith("mech"));
        if (mech) return mech;
      }

      const inc = adminInventoryCategories.find((ac) => ac.toLowerCase().includes(lower) || lower.includes(ac.toLowerCase()));
      if (inc) return inc;
    }

    if (lower.startsWith("mech")) return "Mechnical";

    return cat;
  };

  // Dynamic Folder Categories: Admin Level 1 Inventory categories (excluding Consumables and Tools)
  const allFolderCategories = Array.from(
    new Set(
      [...adminInventoryCategories.map((c) => canonicalizeCategory(c)).filter(Boolean)]
        .filter((catName) => {
          const lower = catName.toLowerCase();
          return (
            !lower.includes("consumable") &&
            !lower.includes("consuamble") &&
            !lower.includes("general") &&
            !lower.includes("genral") &&
            !lower.includes("tool")
          );
        })
    )
  );

  const categoryMap = {};
  allFolderCategories.forEach((cat) => {
    categoryMap[cat] = [];
  });

  const parseProductDocInfo = (item) => {
    const rawName = item.fileName || item.name || "";
    let cleanName = rawName.replace(/^\[.*?\]\s*/, "");

    let quantity = item.fileSize || item.size || 1;
    const qtyMatch = cleanName.match(/\(Qty:\s*(\d+)/i);
    if (qtyMatch && qtyMatch[1]) {
      quantity = parseInt(qtyMatch[1], 10) || quantity;
    }

    let unitPrice = 0;
    let empName = "";
    let approvedByName = "Admin";
    let createdAt = item.uploadedAt || null;
    let approvedAt = null;
    let foundAt = null;
    let prodId = "";

    // Extract Product ID if prefixed
    const prodIdMatch = cleanName.match(/^([A-Z0-9_-]{2,20})\s*-\s*(.+)/i);
    if (prodIdMatch) {
      prodId = prodIdMatch[1].trim();
      cleanName = prodIdMatch[2].trim();
    }

    const urlStr = item.fileUrl || item.url || "";
    if (urlStr.includes("?")) {
      const queryString = urlStr.split("?")[1] || "";
      const params = new URLSearchParams(queryString);
      if (params.get("price")) unitPrice = parseFloat(params.get("price")) || 0;
      if (params.get("emp")) empName = decodeURIComponent(params.get("emp"));
      if (params.get("approvedBy")) approvedByName = decodeURIComponent(params.get("approvedBy"));
      if (params.get("created")) createdAt = decodeURIComponent(params.get("created"));
      if (params.get("approved")) approvedAt = decodeURIComponent(params.get("approved"));
      if (params.get("found")) foundAt = decodeURIComponent(params.get("found"));
      if (params.get("prodId")) prodId = decodeURIComponent(params.get("prodId")) || prodId;
    }

    if (!unitPrice) {
      const priceMatch = cleanName.match(/(?:price:?\s*|₹\s*|Rs\.?\s*|\$\s*)([0-9,.]+)/i);
      if (priceMatch && priceMatch[1]) {
        unitPrice = parseFloat(priceMatch[1].replace(/,/g, "")) || 0;
      }
    }

    cleanName = cleanName
      .replace(/\(Qty:\s*\d+.*?\)/gi, "")
      .replace(/(?:Price:?\s*|₹\s*|Rs\.?\s*|\$\s*)[0-9,.]+/gi, "")
      .replace(/\|\s*$/g, "")
      .trim();

    const totalPrice = unitPrice * quantity;

    return {
      prodId: prodId || "N/A",
      cleanName: cleanName || "Product Item",
      quantity,
      unitPrice,
      totalPrice,
      empName: empName || "Employee",
      approvedByName: approvedByName || "—",
      createdAt,
      approvedAt,
      foundAt,
    };
  };

  const otherDocs = [];
  docs.forEach((doc) => {
    if (doc.fileType === "folder" || doc.fileUrl === "#folder") {
      const name = doc.fileName || doc.name;
      const canonicalName = canonicalizeCategory(name);
      if (canonicalName && !categoryMap[canonicalName]) {
        categoryMap[canonicalName] = [];
      }
      return;
    }

    let name = doc.fileName || doc.name || "";
    let matchedCat = null;

    const bracketMatch = name.match(/^\[(.*?)\]/);
    if (bracketMatch && bracketMatch[1]) {
      const rawTag = bracketMatch[1].trim();
      const canonicalTag = canonicalizeCategory(rawTag);

      if (canonicalTag) {
        const foundKey = Object.keys(categoryMap).find(
          (k) =>
            k.toLowerCase() === canonicalTag.toLowerCase() ||
            k.toLowerCase().includes(canonicalTag.toLowerCase()) ||
            canonicalTag.toLowerCase().includes(k.toLowerCase())
        );
        if (foundKey) matchedCat = foundKey;
        else {
          categoryMap[canonicalTag] = [];
          matchedCat = canonicalTag;
        }
      }
    } else {
      const foundKey = Object.keys(categoryMap).find((k) =>
        name.toLowerCase().includes(k.toLowerCase())
      );
      if (foundKey) matchedCat = foundKey;
    }

    if (matchedCat) {
      categoryMap[matchedCat].push(doc);
    } else {
      otherDocs.push(doc);
    }
  });

  // Calculate overall total project product cost
  let grandTotalValue = 0;
  let grandTotalProductsCount = 0;

  Object.values(categoryMap).forEach((items) => {
    items.forEach((item) => {
      const info = parseProductDocInfo(item);
      grandTotalValue += info.totalPrice;
      grandTotalProductsCount += 1;
    });
  });

  const [editingDocId, setEditingDocId] = useState(null);
  const [priceInput, setPriceInput] = useState("");
  const [qtyInput, setQtyInput] = useState("1");
  const [nameInput, setNameInput] = useState("");
  const [updatingProduct, setUpdatingProduct] = useState(false);

  const handleSaveProductDetails = async (docId) => {
    const p = parseFloat(priceInput);
    if (isNaN(p) || p < 0) {
      toast.error("Please enter a valid price");
      return;
    }
    const q = parseInt(qtyInput, 10);
    if (isNaN(q) || q < 1) {
      toast.error("Please enter a valid quantity");
      return;
    }

    setUpdatingProduct(true);
    try {
      const res = await apiPatch(`/projects/${project.id}/documents/${docId}`, {
        unitPrice: p,
        quantity: q,
        productName: nameInput,
      });
      toast.success("Product details updated successfully!");
      setEditingDocId(null);
      if (setProject) {
        setProject((prev) => ({
          ...prev,
          documents: (prev.documents || []).map((d) =>
            d.id === docId
              ? {
                  ...d,
                  fileUrl: res.document?.fileUrl || d.fileUrl,
                  fileName: res.document?.fileName || d.fileName,
                  fileSize: res.document?.fileSize || d.fileSize,
                }
              : d
          ),
        }));
      }
    } catch (err) {
      toast.error(err.message || "Failed to update product details");
    } finally {
      setUpdatingProduct(false);
    }
  };

  const startEditingProduct = (item, info) => {
    setEditingDocId(item.id);
    setPriceInput(info.unitPrice ? String(info.unitPrice) : "0");
    setQtyInput(info.quantity ? String(info.quantity) : "1");
    setNameInput(info.cleanName || "");
  };

  // IF A CATEGORY FOLDER IS OPENED:
  if (selectedFolder) {
    const activeCategoryItems = categoryMap[selectedFolder] || [];
    let folderTotalValue = 0;
    activeCategoryItems.forEach((item) => {
      const info = parseProductDocInfo(item);
      folderTotalValue += info.totalPrice;
    });

    return (
      <div className="space-y-6">
        {/* Navigation Breadcrumb Header */}
        <div className="flex items-center justify-between flex-wrap gap-4 p-5 rounded-2xl border border-border bg-card shadow-2xs">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setSelectedFolder(null)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs border border-border transition-all shadow-2xs group cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
              <span>Back to Category Folders</span>
            </button>
            <div className="h-6 w-[1px] bg-border hidden sm:block" />
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
                <FolderOpen className="h-5 w-5 fill-amber-500/20" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                  {selectedFolder}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Category Folder Products & Audit Details ({activeCategoryItems.length} {activeCategoryItems.length === 1 ? "Product" : "Products"})
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleExportExcel(selectedFolder)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs hover:shadow-sm transition-all cursor-pointer"
              title={`Download Excel (BOM) for ${selectedFolder}`}
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download Excel</span>
            </button>
            <button
              type="button"
              onClick={() => handleExportPDF(selectedFolder)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-2xs hover:shadow-sm transition-all cursor-pointer"
              title={`Download PDF for ${selectedFolder}`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Download PDF</span>
            </button>
          </div>
        </div>

        {/* Products Data Table */}
        {activeCategoryItems.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-secondary/60 border-b border-border text-muted-foreground uppercase font-bold tracking-wider text-[11px]">
                  <th className="p-3.5 pl-5">Product Name</th>
                  <th className="p-3.5">Product ID</th>
                  <th className="p-3.5">Emp Name (Product Taking)</th>
                  <th className="p-3.5">Approve By</th>
                  <th className="p-3.5 text-center">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-medium">
                {activeCategoryItems.map((item) => {
                  const info = parseProductDocInfo(item);
                  const isEditing = editingDocId === item.id;

                  if (isEditing) {
                    return (
                      <tr key={item.id} className="bg-primary/5">
                        <td colSpan={5} className="p-4">
                          <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-3">
                            <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                              <Edit2 className="h-3.5 w-3.5 text-primary" /> Edit Product Details
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleSaveProductDetails(item.id)}
                                disabled={updatingProduct}
                                className="px-3.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs cursor-pointer"
                              >
                                {updatingProduct ? "Saving..." : "Save Changes"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingDocId(null)}
                                className="px-3 py-1 rounded-lg border border-border bg-background hover:bg-secondary text-xs font-semibold cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div>
                              <label className="block text-muted-foreground font-medium mb-1">Product Name</label>
                              <input
                                type="text"
                                value={nameInput}
                                onChange={(e) => setNameInput(e.target.value)}
                                className="w-full px-3 py-1.5 rounded-lg border border-border bg-background font-semibold"
                                placeholder="Product name"
                              />
                            </div>
                            <div>
                              <label className="block text-muted-foreground font-medium mb-1">Quantity (Qty)</label>
                              <input
                                type="number"
                                min="1"
                                value={qtyInput}
                                onChange={(e) => setQtyInput(e.target.value)}
                                className="w-full px-3 py-1.5 rounded-lg border border-border bg-background font-semibold"
                                placeholder="1"
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={item.id} className="hover:bg-secondary/30 transition-colors">
                      {/* Product Name */}
                      <td className="p-3.5 pl-5 font-bold text-foreground max-w-[200px] truncate" title={info.cleanName}>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-amber-600 shrink-0" />
                          <span className="truncate">{info.cleanName}</span>
                        </div>
                      </td>

                      {/* Product ID */}
                      <td className="p-3.5 font-mono text-xs font-bold text-amber-700 dark:text-amber-300">
                        {info.prodId && info.prodId !== "N/A" ? (
                          <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                            {info.prodId}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </td>

                      {/* Emp Name (Product Taking) */}
                      <td className="p-3.5 font-semibold text-foreground whitespace-nowrap">
                        {info.empName}
                      </td>

                      {/* Approve By */}
                      <td className="p-3.5 font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                        {info.approvedByName}
                      </td>

                      {/* Qty */}
                      <td className="p-3.5 text-center font-bold text-foreground">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                          {info.quantity}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center text-muted-foreground border-2 border-dashed border-border rounded-2xl p-6 bg-card">
            <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="font-bold text-foreground text-base">No Products Added Yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Products requested for this project under "{selectedFolder}" will automatically appear here after request approval.
            </p>
          </div>
        )}

        {/* Bottom Back Button */}
        <div className="pt-4 flex justify-start">
          <button
            type="button"
            onClick={() => setSelectedFolder(null)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-sm border border-border transition-all shadow-2xs cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to All Category Folders</span>
          </button>
        </div>
      </div>
    );
  }

  // DEFAULT VIEW: ALL CATEGORY FOLDER CARDS GRID
  return (
    <div className="space-y-6">
      {/* Top Banner & Total Summary */}
      <div className="flex items-center justify-between flex-wrap gap-4 p-5 rounded-2xl border border-border bg-gradient-to-r from-amber-500/5 via-primary/5 to-purple-500/5 shadow-2xs">
        <div>
          <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            Project Products & Category Folders
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Click on any folder card to view allocated products, employee details, and audit timestamps.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => handleExportExcel(null)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs hover:shadow-sm transition-all cursor-pointer"
            title="Download BOM in Excel/CSV format with Root 1, 2, 3, 4 category hierarchy and quantities"
          >
            <Download className="h-4 w-4" />
            <span>Download Excel (BOM)</span>
          </button>
          <button
            type="button"
            onClick={() => handleExportPDF(null)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-2xs hover:shadow-sm transition-all cursor-pointer"
            title="Download BOM in printable PDF format with Root 1, 2, 3, 4 category hierarchy and quantities"
          >
            <FileText className="h-4 w-4" />
            <span>Download PDF</span>
          </button>
          <div className="px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-semibold flex items-center gap-2 shadow-2xs">
            <Package className="h-4 w-4 text-primary" />
            <span>Total Products Allocated:</span>
            <span className="text-sm font-black">{grandTotalProductsCount}</span>
          </div>
        </div>
      </div>

      {/* Category Folder Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Object.entries(categoryMap)
          .filter(([category, items]) => {
            const lower = category.toLowerCase().trim();
            if (
              lower === "project" ||
              lower === "projects" ||
              lower === "product" ||
              lower === "products" ||
              lower.includes("consumable") ||
              lower.includes("general") ||
              lower.includes("tool")
            ) {
              return false;
            }
            return items.length > 0 || adminInventoryCategories.includes(category);
          })
          .map(([category, items]) => {
          const totalUnits = items.reduce((acc, it) => acc + (it.fileSize || 1), 0);

          return (
            <div
              key={category}
              onClick={() => setSelectedFolder(category)}
              className="group relative overflow-hidden rounded-2xl border border-border bg-background p-5 shadow-2xs hover:shadow-md hover:border-amber-500/40 transition-all cursor-pointer flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20 group-hover:scale-105 transition-transform">
                    <Folder className="h-6 w-6 fill-amber-500/30" />
                  </div>
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleExportExcel(category)}
                      className="p-1.5 rounded-lg border border-border bg-background hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-600 transition-colors cursor-pointer"
                      title={`Download Excel (BOM) for ${category}`}
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportPDF(category)}
                      className="p-1.5 rounded-lg border border-border bg-background hover:bg-blue-500/10 text-muted-foreground hover:text-blue-600 transition-colors cursor-pointer"
                      title={`Download PDF for ${category}`}
                    >
                      <FileText className="h-4 w-4" />
                    </button>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                      {items.length} {items.length === 1 ? "Product" : "Products"}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-base text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                    {category}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {items.length > 0 ? "Contains used products & components" : "No products added yet"}
                  </p>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-border/60 flex items-center justify-between text-xs">
                <span className="font-bold text-muted-foreground bg-secondary/80 px-2.5 py-1 rounded-lg border border-border">
                  {totalUnits} {totalUnits === 1 ? "Unit" : "Units"} Allocated
                </span>
                <span className="inline-flex items-center gap-1 font-bold text-primary text-xs group-hover:translate-x-1 transition-transform">
                  Open Folder <ChevronRight className="h-4 w-4" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Other Uploaded Documents */}
      {otherDocs.length > 0 && (
        <div className="rounded-xl border border-border bg-background p-4 space-y-3">
          <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
            Other Project Documents ({otherDocs.length})
          </h4>
          <div className="space-y-2">
            {otherDocs.map((doc) => (
              <div
                key={doc.id}
                className="p-3 rounded-lg border border-border bg-background flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-medium truncate">{doc.fileName || doc.name}</span>
                </div>
                {doc.fileUrl && doc.fileUrl !== "#" && (
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 hover:bg-secondary rounded transition-colors text-muted-foreground shrink-0"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Activity Tab Component
const ActivityTab = ({ project }) => {
  const getActivityIcon = (type) => {
    const icons = {
      task_completed: CheckCircle2,
      member_added: Users,
      status_changed: Activity,
      updated: Activity,
      created: FolderKanban,
      document_uploaded: FileText,
    };
    const Icon = icons[type] || Activity;
    return <Icon className="h-4 w-4" />;
  };

  const activities = project.activities || [];

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Activity Timeline</h3>

      <div className="space-y-4">
        {activities.map((activity) => (
          <div key={activity.id} className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary">
              {getActivityIcon(activity.type)}
            </div>
            <div className="flex-1">
              <p className="text-sm">
                <span className="font-semibold">{activity.user}</span>{" "}
                <span className="text-muted-foreground">{activity.message}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">{activity.timestamp}</p>
            </div>
          </div>
        ))}
        {activities.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed border-border rounded-xl">
            No activities recorded yet
          </div>
        )}
      </div>
    </div>
  );
};

// Comments Tab Component
const CommentsTab = ({ project, setProject }) => {
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      toast.error("Comment cannot be empty");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiPost(`/projects/${project.id}/comments`, { content: newComment });
      toast.success("Comment added!");
      setNewComment("");
      if (setProject && res.comment) {
        setProject((prev) => ({
          ...prev,
          comments: [res.comment, ...(prev.comments || [])],
        }));
      }
    } catch (err) {
      toast.error(err.message || "Failed to add comment");
    } finally {
      setSubmitting(false);
    }
  };

  const comments = project.comments || [];

  return (
    <div className="space-y-6">
      {/* Add Comment */}
      <div className="rounded-xl border border-border p-5 bg-secondary/20">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write a comment..."
          rows={3}
          className="w-full px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none text-sm"
        />
        <div className="flex items-center justify-end gap-2 mt-3">
          <button
            onClick={handleAddComment}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg cta-gradient text-white font-medium hover:opacity-90 transition-opacity text-sm disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {submitting ? "Posting..." : "Post Comment"}
          </button>
        </div>
      </div>

      {/* Comments List */}
      <div className="space-y-4">
        <h3 className="font-semibold">Comments ({comments.length})</h3>

        {comments.map((comment) => (
          <div key={comment.id} className="rounded-lg border border-border p-4 bg-background">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                {(comment.user || "U").split(" ").map((n) => n[0]).join("").toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-sm">{comment.user}</span>
                  <span className="text-xs text-muted-foreground">{comment.timestamp}</span>
                </div>
                <p className="text-sm text-muted-foreground">{comment.message || comment.content}</p>
              </div>
            </div>
          </div>
        ))}
        {comments.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed border-border rounded-xl">
            No comments yet. Start the conversation!
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectDetails;
