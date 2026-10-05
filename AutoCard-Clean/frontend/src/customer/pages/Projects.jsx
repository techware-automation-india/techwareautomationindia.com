import { useState, useEffect } from "react";
import {
  FolderKanban,
  Search,
  Calendar,
  Users,
  TrendingUp,
  FileText,
  Download,
  Loader2,
  CheckCircle2,
  X,
  Eye,
  FileCheck,
} from "lucide-react";
import { apiGet } from "../../lib/api.js";
import { toast } from "sonner";

const CustomerProjects = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [activeModalTab, setActiveModalTab] = useState("overview");

  const loadProjects = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "ALL") params.append("status", filterStatus);
      if (searchTerm) params.append("search", searchTerm);

      const data = await apiGet(`/customers/me/projects?${params.toString()}`);
      setProjects(data.projects || []);
    } catch (err) {
      console.error("Failed to load projects:", err);
      toast.error(err.message || "Failed to load projects.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [filterStatus]);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm !== undefined) {
        loadProjects();
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const getStatusColor = (status) => {
    const colors = {
      IN_PROGRESS: "bg-blue-100 text-blue-700 border-blue-200",
      COMPLETED: "bg-green-100 text-green-700 border-green-200",
      PLANNING: "bg-yellow-100 text-yellow-700 border-yellow-200",
      ON_HOLD: "bg-gray-100 text-gray-700 border-gray-200",
    };
    return colors[status] || "bg-gray-100 text-gray-700 border-gray-200";
  };

  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.code?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === "ALL" || project.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: projects.length,
    inProgress: projects.filter((p) => p.status === "IN_PROGRESS").length,
    completed: projects.filter((p) => p.status === "COMPLETED").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <FolderKanban className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">My Projects</h1>
            <p className="text-sm text-muted-foreground">
              Track your ongoing machinery and automation projects, milestones, and documentation
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-background border border-border card-shadow p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
              <FolderKanban className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Total Projects</div>
              <div className="font-display text-2xl font-bold text-blue-600">{stats.total}</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-background border border-border card-shadow p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">In Progress</div>
              <div className="font-display text-2xl font-bold text-purple-600">{stats.inProgress}</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-background border border-border card-shadow p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Delivered / Completed</div>
              <div className="font-display text-2xl font-bold text-green-600">{stats.completed}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl bg-background border border-border card-shadow p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search projects or project codes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
          >
            <option value="ALL">All Status</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="PLANNING">Planning</option>
            <option value="COMPLETED">Completed</option>
            <option value="ON_HOLD">On Hold</option>
          </select>
        </div>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading your projects...</p>
          </div>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-background border border-border">
          <FolderKanban className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
          <h3 className="font-semibold text-lg mb-2">No projects found</h3>
          <p className="text-sm text-muted-foreground">
            {searchTerm || filterStatus !== "ALL"
              ? "Try adjusting your search or filter criteria."
              : "No projects have been assigned to your customer account yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="rounded-2xl bg-background border border-border card-shadow overflow-hidden hover:shadow-lg transition-shadow flex flex-col justify-between"
            >
              <div className="p-6 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">
                        {project.code}
                      </span>
                      <h3 className="font-semibold text-lg">{project.name}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {project.description || "Automation project in progress."}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border shrink-0 ${getStatusColor(
                      project.status
                    )}`}
                  >
                    {project.status.replace("_", " ")}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Completion Progress</span>
                    <span className="font-bold text-primary">{project.progress}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                </div>

                {/* Meta Information */}
                <div className="grid grid-cols-3 gap-2 pt-4 border-t border-border text-xs">
                  <div>
                    <div className="text-muted-foreground">Target Delivery</div>
                    <div className="font-medium mt-0.5">
                      {project.endDate ? new Date(project.endDate).toLocaleDateString() : "TBD"}
                    </div>
                  </div>

                  <div>
                    <div className="text-muted-foreground">Documents</div>
                    <div className="font-medium mt-0.5 flex items-center gap-1">
                      <FileText className="h-3 w-3 text-primary" />
                      <span>{project.documentsCount || project.documents?.length || 0} files</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-muted-foreground">Milestones</div>
                    <div className="font-medium mt-0.5 text-foreground">
                      {project.tasks?.completed || 0}/{project.tasks?.total || 0} done
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="px-6 py-3 bg-secondary/20 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {project.team?.length || 0} Assigned Engineers
                </span>
                <button
                  onClick={() => {
                    setSelectedProject(project);
                    setActiveModalTab("overview");
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg cta-gradient text-white text-xs font-medium hover:opacity-90 transition-opacity"
                >
                  <Eye className="h-3.5 w-3.5" />
                  View Details & Docs
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Project Details & Documentation Modal */}
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
                <p className="text-xs text-muted-foreground mt-0.5">Project Details & Handover Documentation</p>
              </div>
              <button
                onClick={() => setSelectedProject(null)}
                className="p-2 hover:bg-secondary rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-border px-6">
              <button
                onClick={() => setActiveModalTab("overview")}
                className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
                  activeModalTab === "overview"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveModalTab("documents")}
                className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeModalTab === "documents"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                Documentation ({selectedProject.documents?.length || selectedProject.documentsCount || 0})
              </button>
              <button
                onClick={() => setActiveModalTab("team")}
                className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeModalTab === "team"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                Engineering Team ({selectedProject.team?.length || 0})
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {activeModalTab === "overview" && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Description
                    </h4>
                    <p className="text-sm leading-relaxed text-foreground">
                      {selectedProject.description || "No description provided."}
                    </p>
                  </div>

                  {/* Progress & Milestone Summary */}
                  <div className="p-4 rounded-xl bg-secondary/30 border border-border space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-muted-foreground">Overall Completion</span>
                      <span className="font-bold text-primary">{selectedProject.progress}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${selectedProject.progress}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                      <span>Status: {selectedProject.status.replace("_", " ")}</span>
                      <span>
                        Target Delivery:{" "}
                        {selectedProject.endDate
                          ? new Date(selectedProject.endDate).toLocaleDateString()
                          : "TBD"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {activeModalTab === "documents" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Attached Documentation, Manuals & CAD Files
                    </h4>
                  </div>

                  <div className="space-y-2">
                    {selectedProject.documents && selectedProject.documents.length > 0 ? (
                      selectedProject.documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="p-3.5 rounded-xl border border-border bg-background flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <FileText className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold truncate">{doc.fileName || doc.name}</div>
                              <div className="text-muted-foreground text-[11px] mt-0.5">
                                {doc.fileSize ? `${Math.round(doc.fileSize / 1024)} KB` : "Document"} •{" "}
                                {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : ""}
                              </div>
                            </div>
                          </div>

                          {doc.fileUrl || doc.url ? (
                            <a
                              href={doc.fileUrl || doc.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-secondary transition-colors font-medium shrink-0"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">Available on handover</span>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-10 border border-dashed border-border rounded-xl">
                        <FileCheck className="h-10 w-10 mx-auto mb-2 text-muted-foreground opacity-30" />
                        <p className="text-xs text-muted-foreground">
                          No documentation files uploaded for this project yet.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeModalTab === "team" && (
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Techware Automation Project Team
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedProject.team && selectedProject.team.length > 0 ? (
                      selectedProject.team.map((member, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl border border-border bg-background flex items-center gap-3 text-xs"
                        >
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0">
                            {member.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold truncate">{member.name}</div>
                            <div className="text-muted-foreground text-[11px]">{member.role}</div>
                            <div className="text-muted-foreground text-[11px] truncate">{member.email}</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-2 text-center py-8 text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                        No team members listed.
                      </div>
                    )}
                  </div>
                </div>
              )}
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

export default CustomerProjects;
