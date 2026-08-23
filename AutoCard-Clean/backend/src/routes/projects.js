import { Router } from "express";
import { z } from "zod";
import prisma from "../prismaClient.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdminOrModulePermission } from "../middleware/checkModulePermission.js";

const router = Router();

// All routes require authentication
router.use(requireAuth);

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createProjectSchema = z.object({
  name: z.string().min(3, "Project name must be at least 3 characters.").max(200),
  code: z.string().min(2, "Project code must be at least 2 characters.").max(50),
  description: z.string().optional(),
  status: z.enum(["PLANNING", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"]).default("PLANNING"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  customerId: z.string().optional().nullable().transform(val => val === "" ? null : val),
  managerId: z.string().optional().nullable().transform(val => val === "" ? null : val),
  teamMembers: z.union([
    z.array(z.string()), // Array of employee IDs
    z.array(z.object({
      employeeId: z.string(),
      roleOnProject: z.string().optional(),
    }))
  ]).optional(),
});

const updateProjectSchema = createProjectSchema.partial();

const createTaskSchema = z.object({
  title: z.string().min(1, "Task title is required.").max(500),
  description: z.string().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED", "BLOCKED"]).default("TODO"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  assignedToId: z.string().optional(),
  dueDate: z.string().optional(),
});

const updateTaskSchema = createTaskSchema.partial();

const createCommentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty."),
});

// ============================================================================
// PROJECT ROUTES
// ============================================================================

// GET /api/projects - List all projects
router.get("/", requireAdminOrModulePermission("projects", "canView"), async (req, res) => {
  try {
    const { status, isArchived, customerId } = req.query;

    const where = {};
    if (status) where.status = status;
    if (isArchived !== undefined) where.isArchived = isArchived === "true";
    if (customerId) where.customerId = customerId;

    const projects = await prisma.project.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            userId: true,
            companyName: true,
            phone: true,
            user: {
              select: { 
                id: true,
                fullName: true, 
                email: true 
              },
            },
          },
        },
        assignments: {
          select: {
            id: true,
            employeeId: true,
            roleOnProject: true,
            assignedAt: true,
            employee: {
              select: {
                id: true,
                userId: true,
                employeeCode: true,
                user: {
                  select: { 
                    id: true,
                    fullName: true, 
                    email: true 
                  },
                },
              },
            },
          },
        },
        tasks: {
          select: {
            id: true,
            status: true,
          },
        },
        _count: {
          select: {
            tasks: true,
            comments: true,
            documents: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = projects.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      description: p.description,
      status: p.status,
      priority: p.priority,
      progress: p.progress,
      startDate: p.startDate,
      endDate: p.endDate,
      isArchived: p.isArchived,
      customer: p.customer ? {
        id: p.customer.userId,
        name: p.customer.user?.fullName || p.customer.companyName || "Unknown",
        email: p.customer.user?.email || "",
        companyName: p.customer.companyName,
        phone: p.customer.phone,
      } : null,
      assignments: p.assignments.map((a) => ({
        id: a.id,
        employeeId: a.employeeId,
        employee: {
          id: a.employee?.id,
          fullName: a.employee?.user?.fullName || a.employee?.fullName || "Unknown",
          email: a.employee?.user?.email || a.employee?.email || "",
        },
        roleOnProject: a.roleOnProject,
        assignedAt: a.assignedAt,
      })),
      tasks: p.tasks || [],
      tasksTotal: p._count.tasks,
      tasksCompleted: p.tasks.filter((t) => t.status === "COMPLETED").length,
      commentsCount: p._count.comments,
      documentsCount: p._count.documents,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    res.json({ projects: formatted });
  } catch (err) {
    console.error("Get projects error:", err);
    res.status(500).json({ message: "Failed to load projects." });
  }
});

// GET /api/projects/:id - Get single project with details
router.get("/:id", requireAdminOrModulePermission("projects", "canView"), async (req, res) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        customer: {
          include: {
            user: {
              select: { fullName: true, email: true },
            },
          },
        },
        assignments: {
          include: {
            employee: {
              include: {
                user: {
                  select: { fullName: true, email: true, employeeProfile: true },
                },
              },
            },
          },
        },
        tasks: {
          orderBy: { orderIndex: "asc" },
        },
        documents: {
          orderBy: { uploadedAt: "desc" },
        },
        comments: {
          orderBy: { createdAt: "desc" },
        },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found." });
    }

    res.json({ project });
  } catch (err) {
    console.error("Get project error:", err);
    res.status(500).json({ message: "Failed to load project." });
  }
});

// POST /api/projects - Create new project
router.post("/", requireAdminOrModulePermission("projects", "canCreate"), async (req, res) => {
  try {
    const parsed = createProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const { teamMembers, ...projectData } = parsed.data;

    // Check if code already exists
    const existing = await prisma.project.findUnique({
      where: { code: projectData.code },
    });

    if (existing) {
      return res.status(409).json({ message: "Project code already exists." });
    }

    // Validate customerId if provided
    if (projectData.customerId) {
      const customer = await prisma.customerProfile.findUnique({
        where: { id: projectData.customerId },
      });

      if (!customer) {
        return res.status(400).json({ message: "Selected customer does not exist." });
      }
    }

    // Validate managerId if provided
    if (projectData.managerId) {
      const manager = await prisma.employeeProfile.findUnique({
        where: { id: projectData.managerId },
      });

      if (!manager) {
        return res.status(400).json({ message: "Selected manager does not exist." });
      }
    }

    // Normalize team members to object format
    const normalizedTeamMembers = teamMembers ? teamMembers.map(member => {
      if (typeof member === 'string') {
        return { employeeId: member, roleOnProject: 'Team Member' };
      }
      return { employeeId: member.employeeId, roleOnProject: member.roleOnProject || 'Team Member' };
    }) : [];

    // Create project with team assignments
    const project = await prisma.project.create({
      data: {
        ...projectData,
        startDate: projectData.startDate ? new Date(projectData.startDate) : null,
        endDate: projectData.endDate ? new Date(projectData.endDate) : null,
        customerId: projectData.customerId || null,
        managerId: projectData.managerId || null,
        assignments: normalizedTeamMembers.length > 0 ? {
          create: normalizedTeamMembers,
        } : undefined,
        activities: {
          create: {
            userId: req.user.id,
            activityType: "created",
            description: `Project "${projectData.name}" was created`,
          },
        },
      },
      include: {
        customer: {
          include: {
            user: {
              select: { fullName: true, email: true },
            },
          },
        },
        assignments: {
          include: {
            employee: {
              select: {
                id: true,
                userId: true,
                user: {
                  select: { fullName: true, email: true },
                },
              },
            },
          },
        },
      },
    });

    res.status(201).json({ project });
  } catch (err) {
    console.error("Create project error:", err);
    res.status(500).json({ message: "Failed to create project." });
  }
});

// PUT /api/projects/:id - Update project
router.put("/:id", requireAdminOrModulePermission("projects", "canEdit"), async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = updateProjectSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const { teamMembers, ...updateData } = parsed.data;

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return res.status(404).json({ message: "Project not found." });
    }

    // Track changes for activity log
    const changes = [];
    if (updateData.status && updateData.status !== project.status) {
      changes.push(`Status changed from ${project.status} to ${updateData.status}`);
    }
    if (updateData.priority && updateData.priority !== project.priority) {
      changes.push(`Priority changed from ${project.priority} to ${updateData.priority}`);
    }

    const updated = await prisma.project.update({
      where: { id },
      data: {
        ...updateData,
        startDate: updateData.startDate ? new Date(updateData.startDate) : undefined,
        endDate: updateData.endDate ? new Date(updateData.endDate) : undefined,
        activities: changes.length > 0 ? {
          create: {
            userId: req.user.id,
            activityType: "updated",
            description: changes.join(", "),
          },
        } : undefined,
      },
      include: {
        customer: true,
        assignments: {
          include: {
            employee: {
              include: {
                user: {
                  select: { fullName: true, email: true },
                },
              },
            },
          },
        },
      },
    });

    res.json({ project: updated });
  } catch (err) {
    console.error("Update project error:", err);
    res.status(500).json({ message: "Failed to update project." });
  }
});

// DELETE /api/projects/:id - Delete project
router.delete("/:id", requireAdminOrModulePermission("projects", "canDelete"), async (req, res) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return res.status(404).json({ message: "Project not found." });
    }

    await prisma.project.delete({ where: { id } });

    res.json({ message: "Project deleted successfully." });
  } catch (err) {
    console.error("Delete project error:", err);
    res.status(500).json({ message: "Failed to delete project." });
  }
});

// PATCH /api/projects/:id/archive - Archive/Unarchive project
router.patch("/:id/archive", requireAdminOrModulePermission("projects", "canEdit"), async (req, res) => {
  try {
    const { id } = req.params;
    const { isArchived } = req.body;

    const project = await prisma.project.update({
      where: { id },
      data: {
        isArchived,
        activities: {
          create: {
            userId: req.user.id,
            activityType: isArchived ? "archived" : "unarchived",
            description: `Project ${isArchived ? "archived" : "unarchived"}`,
          },
        },
      },
    });

    res.json({ project });
  } catch (err) {
    console.error("Archive project error:", err);
    res.status(500).json({ message: "Failed to archive project." });
  }
});

// ============================================================================
// TASK ROUTES
// ============================================================================

// GET /api/projects/:id/tasks - Get all tasks for a project
router.get("/:id/tasks", requireAdminOrModulePermission("projects", "canView"), async (req, res) => {
  try {
    const { id } = req.params;

    const tasks = await prisma.projectTask.findMany({
      where: { projectId: id },
      orderBy: { orderIndex: "asc" },
    });

    res.json({ tasks });
  } catch (err) {
    console.error("Get tasks error:", err);
    res.status(500).json({ message: "Failed to load tasks." });
  }
});

// POST /api/projects/:id/tasks - Create new task
router.post("/:id/tasks", requireAdminOrModulePermission("projects", "canCreate"), async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = createTaskSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const task = await prisma.projectTask.create({
      data: {
        ...parsed.data,
        projectId: id,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      },
    });

    // Log activity
    await prisma.projectActivity.create({
      data: {
        projectId: id,
        userId: req.user.id,
        activityType: "task_created",
        description: `Task "${task.title}" was created`,
      },
    });

    res.status(201).json({ task });
  } catch (err) {
    console.error("Create task error:", err);
    res.status(500).json({ message: "Failed to create task." });
  }
});

// PUT /api/projects/:projectId/tasks/:taskId - Update task
router.put("/:projectId/tasks/:taskId", requireAdminOrModulePermission("projects", "canEdit"), async (req, res) => {
  try {
    const { taskId } = req.params;
    const parsed = updateTaskSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const task = await prisma.projectTask.update({
      where: { id: taskId },
      data: {
        ...parsed.data,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
        completedAt: parsed.data.status === "COMPLETED" ? new Date() : undefined,
      },
    });

    res.json({ task });
  } catch (err) {
    console.error("Update task error:", err);
    res.status(500).json({ message: "Failed to update task." });
  }
});

// DELETE /api/projects/:projectId/tasks/:taskId - Delete task
router.delete("/:projectId/tasks/:taskId", requireAdminOrModulePermission("projects", "canDelete"), async (req, res) => {
  try {
    const { taskId } = req.params;

    await prisma.projectTask.delete({ where: { id: taskId } });

    res.json({ message: "Task deleted successfully." });
  } catch (err) {
    console.error("Delete task error:", err);
    res.status(500).json({ message: "Failed to delete task." });
  }
});

// ============================================================================
// TEAM ROUTES
// ============================================================================

// POST /api/projects/:id/team - Add team member
router.post("/:id/team", requireAdminOrModulePermission("projects", "canEdit"), async (req, res) => {
  try {
    const { id } = req.params;
    const { employeeId, roleOnProject } = req.body;

    if (!employeeId) {
      return res.status(400).json({ message: "Employee ID is required." });
    }

    const assignment = await prisma.projectAssignment.create({
      data: {
        projectId: id,
        employeeId,
        roleOnProject,
      },
      include: {
        employee: {
          include: {
            user: {
              select: { fullName: true, email: true },
            },
          },
        },
      },
    });

    // Log activity
    await prisma.projectActivity.create({
      data: {
        projectId: id,
        userId: req.user.id,
        activityType: "member_added",
        description: `${assignment.employee.user.fullName} was added to the team`,
      },
    });

    res.status(201).json({ assignment });
  } catch (err) {
    console.error("Add team member error:", err);
    if (err.code === "P2002") {
      return res.status(409).json({ message: "Employee is already assigned to this project." });
    }
    res.status(500).json({ message: "Failed to add team member." });
  }
});

// DELETE /api/projects/:id/team/:assignmentId - Remove team member
router.delete("/:id/team/:assignmentId", requireAdminOrModulePermission("projects", "canEdit"), async (req, res) => {
  try {
    const { assignmentId } = req.params;

    await prisma.projectAssignment.delete({
      where: { id: assignmentId },
    });

    res.json({ message: "Team member removed successfully." });
  } catch (err) {
    console.error("Remove team member error:", err);
    res.status(500).json({ message: "Failed to remove team member." });
  }
});

// ============================================================================
// COMMENT ROUTES
// ============================================================================

// POST /api/projects/:id/comments - Add comment
router.post("/:id/comments", requireAdminOrModulePermission("projects", "canView"), async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = createCommentSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const comment = await prisma.projectComment.create({
      data: {
        projectId: id,
        authorId: req.user.id,
        content: parsed.data.content,
      },
    });

    res.status(201).json({ comment });
  } catch (err) {
    console.error("Add comment error:", err);
    res.status(500).json({ message: "Failed to add comment." });
  }
});

// DELETE /api/projects/:id/comments/:commentId - Delete comment
router.delete("/:id/comments/:commentId", requireAdminOrModulePermission("projects", "canDelete"), async (req, res) => {
  try {
    const { commentId } = req.params;

    await prisma.projectComment.delete({
      where: { id: commentId },
    });

    res.json({ message: "Comment deleted successfully." });
  } catch (err) {
    console.error("Delete comment error:", err);
    res.status(500).json({ message: "Failed to delete comment." });
  }
});

export default router;
