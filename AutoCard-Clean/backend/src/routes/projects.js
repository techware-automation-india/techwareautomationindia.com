import { Router } from "express";
import { z } from "zod";
import prisma from "../prismaClient.js";
import { requireAuth } from "../middleware/auth.js";
import { checkRolePermission } from "../middleware/checkRolePermission.js";

const router = Router();

// All routes require authentication
router.use(requireAuth);

// ============================================================================
// HELPER FUNCTIONS FOR ID RESOLUTION
// ============================================================================

/**
 * Resolves a customer ID which could be either a CustomerProfile.id or a User.id.
 * If a User exists with role CUSTOMER without a profile, creates the profile automatically.
 */
async function resolveCustomerId(id) {
  if (!id) return null;
  // 1. Check if directly matches CustomerProfile.id
  let profile = await prisma.customerProfile.findUnique({ where: { id } });
  if (profile) return profile.id;

  // 2. Check if matches User.id
  profile = await prisma.customerProfile.findUnique({ where: { userId: id } });
  if (profile) return profile.id;

  // 3. Check if user exists and create profile if missing
  const user = await prisma.user.findUnique({ where: { id } });
  if (user) {
    profile = await prisma.customerProfile.create({
      data: { userId: user.id },
    });
    return profile.id;
  }
  return null;
}

/**
 * Resolves an employee ID which could be either an EmployeeProfile.id or a User.id.
 * If a User exists without an EmployeeProfile, creates one automatically.
 */
async function resolveEmployeeProfileId(id) {
  if (!id) return null;
  // 1. Check if directly matches EmployeeProfile.id
  let profile = await prisma.employeeProfile.findUnique({ where: { id } });
  if (profile) return profile.id;

  // 2. Check if matches User.id
  profile = await prisma.employeeProfile.findUnique({ where: { userId: id } });
  if (profile) return profile.id;

  // 3. Check if user exists and create profile if missing
  const user = await prisma.user.findUnique({ where: { id } });
  if (user) {
    const count = await prisma.employeeProfile.count();
    profile = await prisma.employeeProfile.create({
      data: {
        userId: user.id,
        employeeCode: `EMP-${String(count + 1).padStart(3, "0")}`,
        jobTitle: user.role === "ADMIN" ? "Administrator" : "Team Member",
      },
    });
    return profile.id;
  }
  return null;
}

/**
 * Format project object for consistent frontend responses
 */
function formatProject(p) {
  return {
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
    customerId: p.customerId,
    managerId: p.managerId,
    customer: p.customer ? {
      id: p.customer.id,
      customerProfileId: p.customer.id,
      userId: p.customer.userId,
      name: p.customer.user?.fullName || p.customer.companyName || "Unknown",
      email: p.customer.user?.email || "",
      companyName: p.customer.companyName,
      phone: p.customer.phone,
    } : null,
    assignments: (p.assignments || []).map((a) => ({
      id: a.id,
      employeeId: a.employeeId,
      roleOnProject: a.roleOnProject,
      assignedAt: a.assignedAt,
      employee: {
        id: a.employee?.id,
        userId: a.employee?.userId,
        fullName: a.employee?.user?.fullName || "Employee",
        email: a.employee?.user?.email || "",
        employeeCode: a.employee?.employeeCode || "",
      },
    })),
    tasks: p.tasks || [],
    tasksTotal: p._count?.tasks ?? p.tasks?.length ?? 0,
    tasksCompleted: (p.tasks || []).filter((t) => t.status === "COMPLETED").length,
    commentsCount: p._count?.comments ?? p.comments?.length ?? 0,
    documentsCount: p._count?.documents ?? p.documents?.length ?? 0,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createProjectSchema = z.object({
  name: z.string().min(3, "Project name must be at least 3 characters.").max(200),
  code: z.string().min(2, "Project code must be at least 2 characters.").max(50),
  description: z.string().optional().nullable(),
  status: z.enum(["PLANNING", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"]).default("PLANNING"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  progress: z.number().int().min(0).max(100).optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  customerId: z.string().optional().nullable().transform(val => (val === "" ? null : val)),
  managerId: z.string().optional().nullable().transform(val => (val === "" ? null : val)),
  teamMembers: z.union([
    z.array(z.string()),
    z.array(z.object({
      employeeId: z.string(),
      roleOnProject: z.string().optional(),
    }))
  ]).optional(),
});

const updateProjectSchema = createProjectSchema.partial();

const createTaskSchema = z.object({
  title: z.string().min(1, "Task title is required.").max(500),
  description: z.string().optional().nullable(),
  status: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED", "BLOCKED"]).default("TODO"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  assignedToId: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
});

const updateTaskSchema = createTaskSchema.partial();

const createCommentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty."),
});

// ============================================================================
// PROJECT ROUTES
// ============================================================================

// GET /api/projects - List all projects
router.get("/", checkRolePermission(["projects", "overview"]), async (req, res) => {
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

    res.json({ projects: projects.map(formatProject) });
  } catch (err) {
    console.error("Get projects error:", err);
    res.status(500).json({ message: "Failed to load projects." });
  }
});

// GET /api/projects/:id - Get single project with full details
router.get("/:id", checkRolePermission(["projects", "overview"]), async (req, res) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        customer: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true },
            },
          },
        },
        assignments: {
          include: {
            employee: {
              include: {
                user: {
                  select: { id: true, fullName: true, email: true },
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

    // Resolve task assignees
    const taskAssigneeIds = [...new Set(project.tasks.map(t => t.assignedToId).filter(Boolean))];
    let assigneeMap = {};
    if (taskAssigneeIds.length > 0) {
      const empProfiles = await prisma.employeeProfile.findMany({
        where: { id: { in: taskAssigneeIds } },
        include: { user: { select: { fullName: true, email: true } } },
      });
      const users = await prisma.user.findMany({
        where: { id: { in: taskAssigneeIds } },
        select: { id: true, fullName: true, email: true },
      });

      empProfiles.forEach(ep => {
        assigneeMap[ep.id] = {
          id: ep.id,
          fullName: ep.user?.fullName || "Employee",
          email: ep.user?.email || "",
        };
      });
      users.forEach(u => {
        if (!assigneeMap[u.id]) {
          assigneeMap[u.id] = { id: u.id, fullName: u.fullName, email: u.email };
        }
      });
    }

    // Resolve comment authors
    const authorIds = [...new Set(project.comments.map(c => c.authorId).filter(Boolean))];
    let authorMap = {};
    if (authorIds.length > 0) {
      const authors = await prisma.user.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, fullName: true, email: true },
      });
      authors.forEach(a => {
        authorMap[a.id] = a;
      });
    }

    // Resolve activity users
    const activityUserIds = [...new Set(project.activities.map(a => a.userId).filter(Boolean))];
    let activityUserMap = {};
    if (activityUserIds.length > 0) {
      const activityUsers = await prisma.user.findMany({
        where: { id: { in: activityUserIds } },
        select: { id: true, fullName: true },
      });
      activityUsers.forEach(u => {
        activityUserMap[u.id] = u.fullName;
      });
    }

    // Format tasks with assignee
    const formattedTasks = project.tasks.map(t => ({
      ...t,
      assignee: t.assignedToId ? (assigneeMap[t.assignedToId] || { fullName: "Assigned" }) : null,
    }));

    // Format comments
    const formattedComments = project.comments.map(c => ({
      id: c.id,
      user: authorMap[c.authorId]?.fullName || "User",
      email: authorMap[c.authorId]?.email || "",
      message: c.content,
      content: c.content,
      timestamp: new Date(c.createdAt).toLocaleString(),
      createdAt: c.createdAt,
    }));

    // Format activities
    const formattedActivities = project.activities.map(a => ({
      id: a.id,
      type: a.activityType,
      user: activityUserMap[a.userId] || "System",
      message: a.description,
      timestamp: new Date(a.createdAt).toLocaleString(),
      createdAt: a.createdAt,
    }));

    const result = {
      ...project,
      tasks: formattedTasks,
      comments: formattedComments,
      activities: formattedActivities,
    };

    res.json({ project: result });
  } catch (err) {
    console.error("Get project error:", err);
    res.status(500).json({ message: "Failed to load project." });
  }
});

// POST /api/projects - Create new project
router.post("/", checkRolePermission(["projects", "overview"]), async (req, res) => {
  try {
    const parsed = createProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const { teamMembers, ...projectData } = parsed.data;

    // Check unique code
    const existing = await prisma.project.findUnique({
      where: { code: projectData.code },
    });
    if (existing) {
      return res.status(409).json({ message: "Project code already exists." });
    }

    // Resolve customerId
    let resolvedCustomerId = null;
    if (projectData.customerId) {
      resolvedCustomerId = await resolveCustomerId(projectData.customerId);
      if (!resolvedCustomerId) {
        return res.status(400).json({ message: "Selected customer does not exist." });
      }
    }

    // Resolve managerId
    let resolvedManagerId = null;
    if (projectData.managerId) {
      resolvedManagerId = await resolveEmployeeProfileId(projectData.managerId);
    }

    // Resolve team members to EmployeeProfile IDs
    const normalizedTeamMembers = [];
    if (teamMembers && teamMembers.length > 0) {
      for (const member of teamMembers) {
        const rawId = typeof member === "string" ? member : member.employeeId;
        const roleOnProject = typeof member === "object" && member.roleOnProject ? member.roleOnProject : "Team Member";
        const empId = await resolveEmployeeProfileId(rawId);
        if (empId) {
          normalizedTeamMembers.push({
            employeeId: empId,
            roleOnProject,
          });
        }
      }
    }

    // Create project
    const project = await prisma.project.create({
      data: {
        name: projectData.name,
        code: projectData.code,
        description: projectData.description || null,
        status: projectData.status,
        priority: projectData.priority,
        progress: projectData.progress ?? 0,
        startDate: projectData.startDate ? new Date(projectData.startDate) : null,
        endDate: projectData.endDate ? new Date(projectData.endDate) : null,
        customerId: resolvedCustomerId,
        managerId: resolvedManagerId,
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
              select: { id: true, fullName: true, email: true },
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
                  select: { id: true, fullName: true, email: true },
                },
              },
            },
          },
        },
      },
    });

    res.status(201).json({ project: formatProject(project) });
  } catch (err) {
    console.error("Create project error:", err);
    res.status(500).json({ message: "Failed to create project." });
  }
});

// Update Project Handler (shared by PUT and PATCH)
async function handleUpdateProject(req, res) {
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

    // Resolve customerId if provided
    let resolvedCustomerId = undefined;
    if (updateData.customerId !== undefined) {
      if (updateData.customerId === null || updateData.customerId === "") {
        resolvedCustomerId = null;
      } else {
        resolvedCustomerId = await resolveCustomerId(updateData.customerId);
      }
    }

    // Resolve managerId if provided
    let resolvedManagerId = undefined;
    if (updateData.managerId !== undefined) {
      if (updateData.managerId === null || updateData.managerId === "") {
        resolvedManagerId = null;
      } else {
        resolvedManagerId = await resolveEmployeeProfileId(updateData.managerId);
      }
    }

    // Check code collision if code updated
    if (updateData.code && updateData.code !== project.code) {
      const codeExists = await prisma.project.findUnique({ where: { code: updateData.code } });
      if (codeExists) {
        return res.status(409).json({ message: "Project code already exists." });
      }
    }

    // Track activity changes
    const changes = [];
    if (updateData.status && updateData.status !== project.status) {
      changes.push(`Status changed from ${project.status} to ${updateData.status}`);
    }
    if (updateData.priority && updateData.priority !== project.priority) {
      changes.push(`Priority changed from ${project.priority} to ${updateData.priority}`);
    }
    if (updateData.progress !== undefined && updateData.progress !== project.progress) {
      changes.push(`Progress updated to ${updateData.progress}%`);
    }

    // Synchronize team members if provided
    if (teamMembers !== undefined) {
      const resolvedMembers = [];
      for (const m of teamMembers) {
        const rawId = typeof m === "string" ? m : m.employeeId;
        const roleOnProject = typeof m === "object" && m.roleOnProject ? m.roleOnProject : "Team Member";
        const empId = await resolveEmployeeProfileId(rawId);
        if (empId) {
          resolvedMembers.push({ employeeId: empId, roleOnProject });
        }
      }

      // Remove existing assignments and replace
      await prisma.projectAssignment.deleteMany({
        where: { projectId: id },
      });

      if (resolvedMembers.length > 0) {
        for (const rm of resolvedMembers) {
          await prisma.projectAssignment.upsert({
            where: {
              projectId_employeeId: {
                projectId: id,
                employeeId: rm.employeeId,
              },
            },
            update: { roleOnProject: rm.roleOnProject },
            create: {
              projectId: id,
              employeeId: rm.employeeId,
              roleOnProject: rm.roleOnProject,
            },
          });
        }
      }
    }

    const updated = await prisma.project.update({
      where: { id },
      data: {
        ...(updateData.name !== undefined && { name: updateData.name }),
        ...(updateData.code !== undefined && { code: updateData.code }),
        ...(updateData.description !== undefined && { description: updateData.description }),
        ...(updateData.status !== undefined && { status: updateData.status }),
        ...(updateData.priority !== undefined && { priority: updateData.priority }),
        ...(updateData.progress !== undefined && { progress: updateData.progress }),
        ...(updateData.startDate !== undefined && {
          startDate: updateData.startDate ? new Date(updateData.startDate) : null,
        }),
        ...(updateData.endDate !== undefined && {
          endDate: updateData.endDate ? new Date(updateData.endDate) : null,
        }),
        ...(resolvedCustomerId !== undefined && { customerId: resolvedCustomerId }),
        ...(resolvedManagerId !== undefined && { managerId: resolvedManagerId }),
        activities: changes.length > 0 ? {
          create: {
            userId: req.user.id,
            activityType: "updated",
            description: changes.join(", "),
          },
        } : undefined,
      },
      include: {
        customer: {
          include: {
            user: { select: { id: true, fullName: true, email: true } },
          },
        },
        assignments: {
          include: {
            employee: {
              include: {
                user: { select: { id: true, fullName: true, email: true } },
              },
            },
          },
        },
      },
    });

    res.json({ project: formatProject(updated) });
  } catch (err) {
    console.error("Update project error:", err);
    res.status(500).json({ message: "Failed to update project." });
  }
}

// PUT /api/projects/:id - Update project
router.put("/:id", checkRolePermission(["projects", "overview"]), handleUpdateProject);

// PATCH /api/projects/:id - Partial update project
router.patch("/:id", checkRolePermission(["projects", "overview"]), handleUpdateProject);

// DELETE /api/projects/:id - Delete project
router.delete("/:id", checkRolePermission(["projects", "overview"]), async (req, res) => {
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
router.patch("/:id/archive", checkRolePermission(["projects", "overview"]), async (req, res) => {
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
router.get("/:id/tasks", checkRolePermission(["projects", "overview"]), async (req, res) => {
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
router.post("/:id/tasks", checkRolePermission(["projects", "overview"]), async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = createTaskSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const assignedTo = parsed.data.assignedToId || parsed.data.assigneeId || null;
    let resolvedAssigneeId = null;
    if (assignedTo) {
      resolvedAssigneeId = await resolveEmployeeProfileId(assignedTo) || assignedTo;
    }

    const task = await prisma.projectTask.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description || null,
        status: parsed.data.status,
        priority: parsed.data.priority,
        projectId: id,
        assignedToId: resolvedAssigneeId,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      },
    });

    // Activity log
    await prisma.projectActivity.create({
      data: {
        projectId: id,
        userId: req.user.id,
        activityType: "task_created",
        description: `Task "${task.title}" was created`,
      },
    });

    // Resolve assignee info
    let assignee = null;
    if (resolvedAssigneeId) {
      const emp = await prisma.employeeProfile.findUnique({
        where: { id: resolvedAssigneeId },
        include: { user: { select: { fullName: true, email: true } } },
      });
      if (emp) {
        assignee = { id: emp.id, fullName: emp.user?.fullName || "Employee", email: emp.user?.email || "" };
      }
    }

    res.status(201).json({ task: { ...task, assignee } });
  } catch (err) {
    console.error("Create task error:", err);
    res.status(500).json({ message: "Failed to create task." });
  }
});

// PUT /api/projects/:projectId/tasks/:taskId - Update task
router.put("/:projectId/tasks/:taskId", checkRolePermission(["projects", "overview"]), async (req, res) => {
  try {
    const { taskId } = req.params;
    const parsed = updateTaskSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const assignedTo = parsed.data.assignedToId || parsed.data.assigneeId;
    let resolvedAssigneeId = undefined;
    if (assignedTo !== undefined) {
      resolvedAssigneeId = assignedTo ? (await resolveEmployeeProfileId(assignedTo) || assignedTo) : null;
    }

    const task = await prisma.projectTask.update({
      where: { id: taskId },
      data: {
        ...(parsed.data.title && { title: parsed.data.title }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description }),
        ...(parsed.data.status && {
          status: parsed.data.status,
          completedAt: parsed.data.status === "COMPLETED" ? new Date() : null,
        }),
        ...(parsed.data.priority && { priority: parsed.data.priority }),
        ...(resolvedAssigneeId !== undefined && { assignedToId: resolvedAssigneeId }),
        ...(parsed.data.dueDate !== undefined && {
          dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        }),
      },
    });

    res.json({ task });
  } catch (err) {
    console.error("Update task error:", err);
    res.status(500).json({ message: "Failed to update task." });
  }
});

// DELETE /api/projects/:projectId/tasks/:taskId - Delete task
router.delete("/:projectId/tasks/:taskId", checkRolePermission(["projects", "overview"]), async (req, res) => {
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
router.post("/:id/team", checkRolePermission(["projects", "overview"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { employeeId, roleOnProject } = req.body;

    if (!employeeId) {
      return res.status(400).json({ message: "Employee ID is required." });
    }

    const resolvedEmployeeId = await resolveEmployeeProfileId(employeeId);
    if (!resolvedEmployeeId) {
      return res.status(400).json({ message: "Selected employee does not exist." });
    }

    const assignment = await prisma.projectAssignment.create({
      data: {
        projectId: id,
        employeeId: resolvedEmployeeId,
        roleOnProject: roleOnProject || "Team Member",
      },
      include: {
        employee: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true },
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

    res.status(201).json({
      assignment: {
        id: assignment.id,
        employeeId: assignment.employeeId,
        roleOnProject: assignment.roleOnProject,
        employee: {
          id: assignment.employee?.id,
          userId: assignment.employee?.userId,
          fullName: assignment.employee?.user?.fullName || "Employee",
          email: assignment.employee?.user?.email || "",
        },
      },
    });
  } catch (err) {
    console.error("Add team member error:", err);
    if (err.code === "P2002") {
      return res.status(409).json({ message: "Employee is already assigned to this project." });
    }
    res.status(500).json({ message: "Failed to add team member." });
  }
});

// DELETE /api/projects/:id/team/:assignmentId - Remove team member
router.delete("/:id/team/:assignmentId", checkRolePermission(["projects", "overview"]), async (req, res) => {
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
router.post("/:id/comments", checkRolePermission(["projects", "overview"]), async (req, res) => {
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

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { fullName: true, email: true },
    });

    res.status(201).json({
      comment: {
        id: comment.id,
        user: user?.fullName || "You",
        email: user?.email || "",
        message: comment.content,
        content: comment.content,
        timestamp: new Date(comment.createdAt).toLocaleString(),
        createdAt: comment.createdAt,
      },
    });
  } catch (err) {
    console.error("Add comment error:", err);
    res.status(500).json({ message: "Failed to add comment." });
  }
});

// DELETE /api/projects/:id/comments/:commentId - Delete comment
router.delete("/:id/comments/:commentId", checkRolePermission(["projects", "overview"]), async (req, res) => {
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
