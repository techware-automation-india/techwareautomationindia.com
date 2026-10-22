import { useState, useEffect } from "react";
import {
  FolderKanban,
  Search,
  CheckCircle2,
  Clock,
  Calendar,
  Users,
  Target,
  FileText,
  Download,
  AlertCircle,
  TrendingUp,
  X,
  MessageSquare,
  Send,
  Loader2,
  Folder,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPatch, apiPost } from "../../lib/api.js";

const EmployeeAssignedProjects = () => {
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState({
    totalProjects: 0,
    pendingTasks: 0,
    inProgressTasks: 0,
    completedTasks: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [selectedProject, setSelectedProject] = useState(null);
  const [updatingTaskId, setUpdatingTaskId] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const handlePostComment 
  = async (projectId) => {
    if (!commentText.trim() || submittingComment) return;
    setSubmittingComment(true);
    try {
      const res = await apiPost(`/projects/${projectId}/comments`, { content: commentText.trim() });
      toast.success("Comment posted successfully!");
      setCommentText("");

      if (res.comment) {
        setSelectedProject((prev) =>
          prev ? { ...prev, comments: [res.comment, ...(prev.comments || [])] } : null
        );
        setProjects((prev) =>
          prev.map((p) =>
            p.id === projectId
              ? { ...p, comments: [res.comment, ...(p.comments || [])] }
              : p
          )
        );
      }
    } catch (err) {
      toast.error(err.message || "Failed to post comment.");
    } finally {
      setSubmittingComment(false);
    }
  };

  const loadAssignedProjects = async () => {
    setLoading(true);
    try {
      const data = await apiGet("/projects/my-assigned");
      setProjects(data.projects || []);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error("Failed to load assigned projects:", err);
      toast.error(err.message || "Failed to load assigned projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssignedProjects();
  }, []);

  const handleUpdateTaskStatus = async (projectId, taskId, newStatus) => {
    setUpdatingTaskId(taskId);
    try {
      const res = await apiPatch(`/projects/${projectId}/tasks/${taskId}/status`, {
        status: newStatus,
      });

      toast.success(`Task marked as ${newStatus.replace("_", " ")}`);

      // Update state locally
      setProjects((prevProjects) =>
        prevProjects.map((p) => {
          if (p.id !== projectId) return p;
          const updatedTasks = (p.myTasks || []).map((t) =>
            t.id === taskId ? { ...t, status: newStatus } : t
          );
          return {
            ...p,
            progress: res.projectProgress !== undefined ? res.projectProgress : p.progress,
            myTasks: updatedTasks,
          };
        })
      );

      if (selectedProject && selectedProject.id === projectId) {
        setSelectedProject((prev) => ({
          ...prev,
          progress: res.projectProgress !== undefined ? res.projectProgress : prev.progress,
          myTasks: (prev.myTasks || []).map((t) =>
            t.id === taskId ? { ...t, status: newStatus } : t
          ),
        }));
      }

      // Re-fetch stats
      apiGet("/projects/my-assigned").then((d) => {
        if (d.stats) setStats(d.stats);
      }).catch(() => {});
    } catch (err) {
      console.error("Failed to update task status:", err);
      toast.error(err.message || "Failed to update task status");
    } finally {
      setUpdatingTaskId(null);
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
      LOW: "text-green-600 bg-green-50 border-green-200",
      MEDIUM: "text-yellow-600 bg-yellow-50 border-yellow-200",
      HIGH: "text-orange-600 bg-orange-50 border-orange-200",
      URGENT: "text-red-600 bg-red-50 border-red-200",
    };
    return colors[priority] || "text-gray-600 bg-gray-50 border-gray-200";
  };

  const filteredProjects = projects.filter((project) => {
    if (!project) return false;
    const term = (searchTerm || "").trim().toLowerCase();
    const matchesSearch =
      !term ||
      (project.name || "").toLowerCase().includes(term) ||
      (project.code || "").toLowerCase().includes(term) ||
      (project.customer?.name || "").toLowerCase().includes(term) ||
      (project.description || "").toLowerCase().includes(term) ||
      (Array.isArray(project.myTasks) && project.myTasks.some((t) => (t?.title || "").toLowerCase().includes(term)));

    const matchesFilter = filterStatus === "ALL" || project.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <FolderKanban className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Assigned Projects</h1>
            <p className="text-sm text-muted-foreground">
              Track your assigned automation projects and update your task progress
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-background border border-border card-shadow p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
              <FolderKanban className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Assigned Projects</div>
              <div className="font-display text-2xl font-bold text-blue-600">{stats.totalProjects}</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-background border border-border card-shadow p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center shrink-0">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">My To-Do Tasks</div>
              <div className="font-display text-2xl font-bold text-yellow-600">{stats.pendingTasks}</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-background border border-border card-shadow p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Tasks In Progress</div>
              <div className="font-display text-2xl font-bold text-purple-600">{stats.inProgressTasks}</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-background border border-border card-shadow p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">My Completed Tasks</div>
              <div className="font-display text-2xl font-bold text-green-600">{stats.completedTasks}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl bg-background border border-border card-shadow p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search projects, code, or tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-9 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
                title="Clear Search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
          >
            <option value="ALL">All Status</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="PLANNING">Planning</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading your assigned projects...</p>
          </div>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-background border border-border">
          <FolderKanban className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
          <h3 className="font-semibold text-lg mb-2">No assigned projects found</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {searchTerm || filterStatus !== "ALL"
              ? "No projects match your current filters."
              : "You have not been assigned to any projects yet. Contact your administrator or project manager."}
          </p>
        </div>
      ) : (
        /* Projects List */
        <div className="grid grid-cols-1 gap-6">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="rounded-2xl bg-background border border-border card-shadow overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Card Header */}
              <div className="p-6 border-b border-border">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-xs px-2.5 py-1 rounded bg-primary/10 text-primary font-bold">
                        {project.code}
                      </span>
                      <h3 className="font-semibold text-xl">{project.name}</h3>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(
                          project.status
                        )}`}
                      >
                        {project.status.replace("_", " ")}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded border ${getPriorityColor(
                          project.priority
                        )}`}
                      >
                        <Target className="h-3 w-3" />
                        {project.priority}
                      </span>
                    </div>

                    <p className="text-sm text-muted-foreground pt-1">
                      {project.description || "No project description provided."}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedProject(project)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-secondary text-xs font-medium transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View Project Details
                    </button>
                  </div>
                </div>

                {/* Info Pills */}
                <div className="flex items-center gap-6 mt-4 text-xs text-muted-foreground flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <UserCheck className="h-4 w-4 text-primary" />
                    <span>Your Role:</span>
                    <span className="font-semibold text-foreground">{project.myRole || "Team Member"}</span>
                  </div>

                  {project.customer && (
                    <div className="flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-primary" />
                      <span>Client:</span>
                      <span className="font-semibold text-foreground">{project.customer.name}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span>Timeline:</span>
                    <span className="font-medium text-foreground">
                      {project.startDate ? new Date(project.startDate).toLocaleDateString() : "TBD"} -{" "}
                      {project.endDate ? new Date(project.endDate).toLocaleDateString() : "No deadline"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-primary" />
                    <span>Documents:</span>
                    <span className="font-medium text-foreground">{project.documents?.length || 0} files</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Overall Project Progress</span>
                    <span className="font-bold text-primary">{project.progress}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Tasks Assigned to Current Employee */}
              <div className="p-6 bg-secondary/10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <h4 className="font-semibold text-sm">
                      My Assigned Tasks ({project.myTasks?.length || 0})
                    </h4>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {(project.myTasks || []).filter((t) => t.status === "COMPLETED").length} of{" "}
                    {project.myTasks?.length || 0} completed
                  </span>
                </div>

                {project.myTasks && project.myTasks.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {project.myTasks.map((task) => (
                      <div
                        key={task.id}
                        className="p-4 rounded-xl border border-border bg-background shadow-xs hover:border-primary/40 transition-colors space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <h5 className="font-semibold text-sm leading-snug">{task.title}</h5>
                            {task.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {task.description}
                              </p>
                            )}
                          </div>
                          <span
                            className={`shrink-0 inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded border ${getPriorityColor(
                              task.priority
                            )}`}
                          >
                            {task.priority}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                          <div className="text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No deadline"}
                            </span>
                          </div>

                          {/* Task status update dropdown */}
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-muted-foreground">Status:</span>
                            <select
                              value={task.status}
                              disabled={updatingTaskId === task.id}
                              onChange={(e) =>
                                handleUpdateTaskStatus(project.id, task.id, e.target.value)
                              }
                              className={`text-xs font-semibold px-2 py-1 rounded-md border focus:outline-none cursor-pointer ${
                                task.status === "COMPLETED"
                                  ? "bg-green-50 border-green-300 text-green-700"
                                  : task.status === "IN_PROGRESS"
                                  ? "bg-blue-50 border-blue-300 text-blue-700"
                                  : "bg-secondary border-border text-foreground"
                              }`}
                            >
                              <option value="TODO">To Do</option>
                              <option value="IN_PROGRESS">In Progress</option>
                              <option value="COMPLETED">Completed</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl bg-background">
                    No specific tasks assigned to you for this project yet.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Project Details Modal */}
      {selectedProject && (
        <div
          className="fixed inset-0 bg-foreground/40 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedProject(null)}
        >
          <div
            className="bg-background rounded-2xl border border-border card-shadow max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-background z-10">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">
                    {selectedProject.code}
                  </span>
                  <h3 className="font-display text-lg font-bold">{selectedProject.name}</h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Project Details & Resources</p>
              </div>
              <button
                onClick={() => setSelectedProject(null)}
                className="p-2 hover:bg-secondary rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Description */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Overview
                </h4>
                <p className="text-sm leading-relaxed text-foreground">
                  {selectedProject.description || "No description provided."}
                </p>
              </div>

              {/* Progress & Status */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-secondary/30 border border-border">
                <div>
                  <div className="text-xs text-muted-foreground">Overall Progress</div>
                  <div className="text-lg font-bold text-primary mt-1">{selectedProject.progress}%</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Status</div>
                  <div className="mt-1">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(
                        selectedProject.status
                      )}`}
                    >
                      {selectedProject.status.replace("_", " ")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Team Members */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Project Team ({selectedProject.team?.length || 0})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedProject.team?.map((member) => (
                    <div
                      key={member.id}
                      className="p-3 rounded-lg border border-border bg-background flex items-center gap-3 text-xs"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0">
                        {member.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold truncate">{member.name}</div>
                        <div className="text-muted-foreground truncate">{member.role}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Documents & Category Folders */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Project Products & Category Folders ({selectedProject.documents?.length || 0})
                </h4>
                <div className="space-y-3">
                  {(() => {
                    const catMap = {};
                    const uncatDocs = [];

                    (selectedProject.documents || []).forEach((doc) => {
                      if (doc.type === "folder" || doc.url === "#folder" || doc.fileType === "folder" || doc.fileUrl === "#folder") {
                        const folderName = doc.name || doc.fileName;
                        if (
                          folderName === "Mechanical Product" ||
                          folderName === "Electrical Product" ||
                          folderName === "Automation Product" ||
                          folderName === "Electronics Product" ||
                          folderName === "General / Consumables"
                        ) {
                          return;
                        }
                        if (folderName && !catMap[folderName]) catMap[folderName] = [];
                        return;
                      }

                      const name = doc.name || doc.fileName || "";
                      let matched = null;
                      const bracketMatch = name.match(/^\[(.*?)\]/);
                      if (bracketMatch && bracketMatch[1]) {
                        let tag = bracketMatch[1].trim();
                        if (tag === "Mechanical Product") {
                          tag = "Mechnical";
                        }
                        const key = Object.keys(catMap).find(
                          (k) =>
                            k.toLowerCase() === tag.toLowerCase() ||
                            k.toLowerCase().includes(tag.toLowerCase()) ||
                            tag.toLowerCase().includes(k.toLowerCase())
                        );
                        if (key) matched = key;
                        else {
                          catMap[tag] = [];
                          matched = tag;
                        }
                      } else {
                        const key = Object.keys(catMap).find((k) =>
                          name.toLowerCase().includes(k.toLowerCase())
                        );
                        if (key) matched = key;
                      }

                      if (matched) catMap[matched].push(doc);
                      else uncatDocs.push(doc);
                    });

                    return (
                      <div className="space-y-3">
                        {Object.entries(catMap)
                          .filter(([_, items]) => items.length > 0)
                          .map(([category, items]) => (
                          <div
                            key={category}
                            className="rounded-xl border border-border bg-background overflow-hidden"
                          >
                            <div className="p-3 bg-secondary/30 flex items-center justify-between">
                              <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                                <Folder className="h-4 w-4 text-amber-500 fill-amber-500/20 shrink-0" />
                                <span>{category}</span>
                              </div>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                                {items.length} {items.length === 1 ? "Product" : "Products"}
                              </span>
                            </div>

                            <div className="p-2.5 space-y-1.5 border-t border-border">
                              {items.length > 0 ? (
                                items.map((item) => {
                                  let cleanName = (item.name || item.fileName || "").replace(/^\[.*?\]\s*/, "");
                                  let qty = item.size || item.fileSize || 1;
                                  const qtyMatch = cleanName.match(/\(Qty:\s*(\d+)/i);
                                  if (qtyMatch && qtyMatch[1]) {
                                    qty = parseInt(qtyMatch[1], 10) || qty;
                                  }

                                  let unitPrice = 0;
                                  let empName = "";
                                  let createdAt = item.uploadedAt || null;
                                  let approvedAt = null;
                                  let foundAt = null;

                                  const urlStr = item.url || item.fileUrl || "";
                                  if (urlStr.includes("?")) {
                                    const params = new URLSearchParams(urlStr.split("?")[1] || "");
                                    if (params.get("price")) unitPrice = parseFloat(params.get("price")) || 0;
                                    if (params.get("emp")) empName = decodeURIComponent(params.get("emp"));
                                    if (params.get("created")) createdAt = decodeURIComponent(params.get("created"));
                                    if (params.get("approved")) approvedAt = decodeURIComponent(params.get("approved"));
                                    if (params.get("found")) foundAt = decodeURIComponent(params.get("found"));
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

                                  const totalPrice = unitPrice * qty;

                                  return (
                                    <div
                                      key={item.id}
                                      className="p-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-xs flex items-center justify-between flex-wrap gap-2"
                                    >
                                      <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <Package className="h-4 w-4 text-emerald-600 shrink-0" />
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-foreground truncate block">{cleanName}</span>
                                            {empName && (
                                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/10 text-primary font-medium">
                                                Emp: {empName}
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5 flex-wrap">
                                            <span className="text-emerald-700 dark:text-emerald-300 font-medium">Qty: {qty}</span>
                                            <span>•</span>
                                            <span>Price: ₹{unitPrice.toLocaleString("en-IN")}</span>
                                          </div>
                                          <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground mt-1 flex-wrap">
                                            {createdAt && <span>Req: {new Date(createdAt).toLocaleDateString()}</span>}
                                            {approvedAt && <span className="text-blue-600 dark:text-blue-400">• Appr: {new Date(approvedAt).toLocaleDateString()}</span>}
                                            {foundAt && <span className="text-emerald-700 dark:text-emerald-300 font-medium">• Found: {new Date(foundAt).toLocaleDateString()}</span>}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <span className="text-[9px] text-muted-foreground block font-medium">Total Value</span>
                                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                          ₹{totalPrice.toLocaleString("en-IN")}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })
                              ) : (
                                <div className="py-2 text-center text-[11px] text-muted-foreground">
                                  No products added under {category} yet.
                                </div>
                              )}
                            </div>
                          </div>
                        ))}

                        {uncatDocs.length > 0 && (
                          <div className="p-3 rounded-xl border border-border bg-background space-y-2">
                            <div className="text-[11px] font-semibold text-muted-foreground uppercase">
                              Other Documents ({uncatDocs.length})
                            </div>
                            {uncatDocs.map((d) => (
                              <div
                                key={d.id}
                                className="p-2 rounded-lg border border-border flex items-center justify-between text-xs"
                              >
                                <span className="truncate">{d.name}</span>
                                {d.url && d.url !== "#" && (
                                  <a href={d.url} target="_blank" rel="noreferrer">
                                    <Download className="h-3.5 w-3.5 text-primary" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Project Comments & Discussion Section */}
              <div className="pt-4 border-t border-border space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    Project Discussion & Comments ({selectedProject.comments?.length || 0})
                  </h4>
                </div>

                {/* Add Comment Input */}
                <div className="rounded-xl border border-border bg-secondary/20 p-3.5 space-y-2">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Write a comment or project update..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none text-xs"
                  />
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => handlePostComment(selectedProject.id)}
                      disabled={submittingComment || !commentText.trim()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg cta-gradient text-white text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
                    >
                      {submittingComment ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Posting...
                        </>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" /> Post Comment
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Comments List */}
                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {selectedProject.comments && selectedProject.comments.length > 0 ? (
                    selectedProject.comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="p-3 rounded-lg border border-border bg-background shadow-2xs text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between font-semibold">
                          <span className="text-foreground text-xs font-bold">
                            {comment.user || "Team Member"}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {comment.timestamp || (comment.createdAt ? new Date(comment.createdAt).toLocaleString() : "")}
                          </span>
                        </div>
                        <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed text-xs">
                          {comment.message || comment.content}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="py-4 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
                      No comments yet. Start the project conversation!
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border flex justify-end">
              <button
                onClick={() => setSelectedProject(null)}
                className="px-4 py-2 rounded-lg border border-border bg-background hover:bg-secondary text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeAssignedProjects;
