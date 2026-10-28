import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
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
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1">
          <Link
            to="/admin/projects"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Projects
          </Link>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <FolderKanban className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="font-display text-2xl font-bold">{project.name}</h1>
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
                  className={`px-3 py-1 rounded-full text-xs font-semibold border cursor-pointer focus:outline-none transition-colors ${getStatusColor(
                    project.status
                  )}`}
                >
                  <option value="PLANNING">Planning</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="ON_HOLD">On Hold</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
                <span className={`inline-flex items-center gap-1 text-sm font-semibold ${getPriorityColor(project.priority)}`}>
                  <Target className="h-3.5 w-3.5" />
                  {project.priority}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                <span className="font-mono font-semibold text-primary">{project.code}</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {project.startDate ? new Date(project.startDate).toLocaleDateString() : "No start date"} -{" "}
                  {project.endDate ? new Date(project.endDate).toLocaleDateString() : "No end date"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEditModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background hover:bg-secondary transition-colors text-sm font-medium"
          >
            <Edit2 className="h-4 w-4" />
            Edit
          </button>

          <div className="relative group">
            <button className="p-2 rounded-lg border border-border bg-background hover:bg-secondary transition-colors">
              <MoreVertical className="h-4 w-4" />
            </button>
            <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-border bg-background shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button
                onClick={handleArchiveProject}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-secondary transition-colors text-left"
              >
                <Archive className="h-4 w-4" />
                {project.isArchived ? "Unarchive Project" : "Archive Project"}
              </button>
              <button
                onClick={handleDeleteProject}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-destructive/10 text-destructive transition-colors text-left"
              >
                <Trash2 className="h-4 w-4" />
                Delete Project
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="rounded-2xl bg-background border border-border card-shadow p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span className="font-semibold">Project Progress</span>
          </div>
          <span className="text-2xl font-bold text-primary">{project.progress}%</span>
        </div>
        <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-500"
            style={{ width: `${project.progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <span>
            {project.tasks?.filter((t) => t.status === "COMPLETED").length || 0} of {project.tasks?.length || 0} tasks completed
          </span>
          <span>
            {project.endDate
              ? `${Math.ceil((new Date(project.endDate) - new Date()) / (1000 * 60 * 60 * 24))} days remaining`
              : "No deadline"}
          </span>
        </div>
      </div>

      {/* Category Folders & Products Section */}
      <div className="rounded-2xl bg-background border border-border card-shadow p-6">
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
    fetchInventoryCategories();
    return () => { isMounted = false; };
  }, []);

  const canonicalizeCategory = (rawCat) => {
    if (!rawCat) return null;
    const cat = String(rawCat).trim();
    const lower = cat.toLowerCase();

    // Do not create or show consumable, general, or tool folders in project
    if (
      lower.includes("consumable") ||
      lower.includes("consuamble") ||
      lower.includes("general") ||
      lower.includes("genral") ||
      lower.includes("tool")
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
      const canonicalTag = canonicalizeCategory(rawTag) || rawTag;

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
                  <th className="p-3.5">Request Create Time & Date</th>
                  <th className="p-3.5">Request Approve Time & Date</th>
                  <th className="p-3.5">Approve By</th>
                  <th className="p-3.5">Found Time</th>
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
                        <td colSpan={8} className="p-4">
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

                      {/* Request Create Time & Date */}
                      <td className="p-3.5 text-muted-foreground whitespace-nowrap">
                        {info.createdAt ? `${new Date(info.createdAt).toLocaleDateString()} ${new Date(info.createdAt).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', hour12: true })}` : "—"}
                      </td>

                      {/* Request Approve Time & Date */}
                      <td className="p-3.5 font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        {info.approvedAt ? `${new Date(info.approvedAt).toLocaleDateString()} ${new Date(info.approvedAt).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', hour12: true })}` : "—"}
                      </td>

                      {/* Approve By */}
                      <td className="p-3.5 font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                        {info.approvedByName}
                      </td>

                      {/* Found Time */}
                      <td className="p-3.5 font-semibold whitespace-nowrap">
                        {info.foundAt && !isNaN(new Date(info.foundAt).getTime()) ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-xs font-semibold">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            {new Date(info.foundAt).toLocaleDateString()} {new Date(info.foundAt).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-muted-foreground/60 bg-secondary/40 text-[11px] font-medium">
                            Pending
                          </span>
                        )}
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
        <div className="flex items-center gap-3">
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
          .filter(([category, items]) => items.length > 0 || adminInventoryCategories.includes(category))
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
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                    {items.length} {items.length === 1 ? "Product" : "Products"}
                  </span>
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
