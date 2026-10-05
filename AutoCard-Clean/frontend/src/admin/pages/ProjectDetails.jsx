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
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, apiDelete, apiPut } from "../../lib/api.js";
import { ProjectModal } from "./Projects.jsx";

const ProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
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
    { id: "documents", label: "Documents", icon: FileText, count: project?.documents?.length || 0 },
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
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(
                    project.status
                  )}`}
                >
                  {project.status.replace("_", " ")}
                </span>
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
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {project.assignments?.length || 0} members
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

      {/* Tabs */}
      <div className="rounded-2xl bg-background border border-border card-shadow overflow-hidden">
        <div className="border-b border-border overflow-x-auto">
          <div className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 font-medium text-sm border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                {tab.count !== undefined && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      activeTab === tab.id ? "bg-primary text-white" : "bg-secondary"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {activeTab === "overview" && <OverviewTab project={project} />}
          {activeTab === "tasks" && <TasksTab project={project} setProject={setProject} />}
          {activeTab === "team" && <TeamTab project={project} setProject={setProject} />}
          {activeTab === "documents" && <DocumentsTab project={project} setProject={setProject} />}
          {activeTab === "activity" && <ActivityTab project={project} />}
          {activeTab === "comments" && <CommentsTab project={project} setProject={setProject} />}
        </div>
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

// Documents Tab Component
const DocumentsTab = ({ project, setProject }) => {
  const getFileIcon = (type) => {
    return <FileText className="h-5 w-5 text-primary" />;
  };

  const docs = project.documents || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Documents ({docs.length})</h3>
        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg cta-gradient text-white font-medium hover:opacity-90 transition-opacity text-sm">
          <Upload className="h-4 w-4" />
          Upload Document
        </button>
      </div>

      <div className="space-y-2">
        {docs.map((doc) => (
          <div key={doc.id} className="rounded-lg border border-border p-4 bg-background hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                {getFileIcon(doc.fileType)}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm truncate">{doc.fileName || doc.name}</h4>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  <span>{doc.fileSize ? `${Math.round(doc.fileSize / 1024)} KB` : "N/A"}</span>
                  <span>•</span>
                  <span>{doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : ""}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {doc.fileUrl && (
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 hover:bg-secondary rounded-lg transition-colors"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
        {docs.length === 0 && (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl">
            No documents uploaded yet
          </div>
        )}
      </div>
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
