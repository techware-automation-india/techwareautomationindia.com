import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "../prismaClient.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdminOrModulePermission } from "../middleware/checkModulePermission.js";
import { sendCustomerWelcomeEmail, sendPasswordResetEmail } from "../utils/emailService.js";

const router = Router();

// All routes require authentication
router.use(requireAuth);

const createCustomerSchema = z.object({
  fullName: z
    .string()
    .min(3, "Full name must be at least 3 characters.")
    .max(120, "Full name must not exceed 120 characters.")
    .regex(/^[A-Za-z\s]+$/, "Full name can only contain letters and spaces."),
  email: z
    .string()
    .email("Please provide a valid email address.")
    .toLowerCase()
    .max(255, "Email must not exceed 255 characters."),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters.")
    .max(128, "Password must not exceed 128 characters.")
    .refine(
      (pwd) => {
        const hasUpper = /[A-Z]/.test(pwd);
        const hasLower = /[a-z]/.test(pwd);
        const hasNumber = /[0-9]/.test(pwd);
        const count = [hasUpper, hasLower, hasNumber].filter(Boolean).length;
        return count >= 2;
      },
      "Password must contain at least 2 of: uppercase letter, lowercase letter, number."
    ),
  companyName: z
    .string()
    .min(2, "Company name must be at least 2 characters if provided.")
    .max(200, "Company name must not exceed 200 characters.")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .regex(/^[+]?[\d\s()\-]{7,20}$/, "Phone number must be valid (7-20 digits).")
    .optional()
    .or(z.literal("")),
  address: z.string().max(300, "Address must not exceed 300 characters.").optional().or(z.literal("")),
  city: z.string().max(100, "City must not exceed 100 characters.").optional().or(z.literal("")),
  country: z.string().max(100, "Country must not exceed 100 characters.").optional().or(z.literal("")),
});

// GET /api/customers - list all customers with their profile.
router.get("/", requireAdminOrModulePermission("customer", "canView"), async (_req, res) => {
  console.log("📥 [GET /api/customers] Request received");
  try {
    const customers = await prisma.user.findMany({
      where: { role: "CUSTOMER" },
      include: { customerProfile: true },
      orderBy: { createdAt: "desc" },
    });

    console.log(`✅ [GET /api/customers] Found ${customers.length} customers`);

    const result = customers.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      isActive: u.isActive,
      companyName: u.customerProfile?.companyName ?? null,
      phone: u.customerProfile?.phone ?? null,
      address: u.customerProfile?.address ?? null,
      city: u.customerProfile?.city ?? null,
      country: u.customerProfile?.country ?? null,
      createdAt: u.createdAt,
    }));

    console.log("📤 [GET /api/customers] Sending response");
    res.json({ customers: result });
  } catch (err) {
    console.error("❌ [GET /api/customers] Error:", err);
    res.status(500).json({ message: "Failed to load customers." });
  }
});

// POST /api/customers - create a customer account + profile.
router.post("/", requireAdminOrModulePermission("customer", "canCreate"), async (req, res) => {
  console.log("📥 [POST /api/customers] Request received:", JSON.stringify(req.body, null, 2));
  
  const parsed = createCustomerSchema.safeParse(req.body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    console.log("❌ [POST /api/customers] Validation failed:", firstError.message);
    return res.status(400).json({ 
      message: firstError.message,
      field: firstError.path[0],
      errors: parsed.error.issues.map(issue => ({
        field: issue.path[0],
        message: issue.message
      }))
    });
  }

  const { fullName, email, password, companyName, phone, address, city, country } = parsed.data;
  console.log(`✅ [POST /api/customers] Validation passed. Creating customer: ${fullName} (${companyName || 'No Company'})`);

  try {
    // Guard against duplicate email.
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      console.log(`❌ [POST /api/customers] Email already exists: ${email}`);
      return res.status(409).json({ 
        message: "An account with this email already exists.",
        field: "email"
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Create user + customer profile together.
    const user = await prisma.user.create({
      data: {
        email,
        fullName,
        passwordHash,
        role: "CUSTOMER",
        customerProfile: {
          create: {
            companyName: companyName || null,
            phone: phone || null,
            address: address || null,
            city: city || null,
            country: country || null,
          },
        },
      },
      include: { customerProfile: true },
    });

    console.log(`✅ [POST /api/customers] Customer created successfully:`, {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      companyName: user.customerProfile.companyName,
    });

    // Send welcome email with login credentials
    try {
      console.log(`📧 [POST /api/customers] Sending welcome email to: ${email}`);
      await sendCustomerWelcomeEmail({
        customerEmail: email,
        customerName: fullName,
        companyName: companyName || null,
        password: password, // Send plain text password in email
      });
      console.log(`✅ [POST /api/customers] Welcome email sent successfully to: ${email}`);
    } catch (emailError) {
      console.error(`⚠️ [POST /api/customers] Failed to send welcome email to ${email}:`, emailError);
      // Don't fail the customer creation if email fails
      // Customer is created, but email wasn't sent
    }

    res.status(201).json({
      customer: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        companyName: user.customerProfile.companyName,
        phone: user.customerProfile.phone,
        address: user.customerProfile.address,
        city: user.customerProfile.city,
        country: user.customerProfile.country,
      },
    });
  } catch (err) {
    console.error("❌ [POST /api/customers] Error:", err);
    res.status(500).json({ message: "Failed to create customer. Please try again." });
  }
});

// PUT /api/customers/:id - update customer profile.
router.put("/:id", requireAdminOrModulePermission("customer", "canEdit"), async (req, res) => {
  const { id } = req.params;
  console.log(`📥 [PUT /api/customers/${id}] Request received:`, JSON.stringify(req.body, null, 2));

  const updateSchema = z.object({
    fullName: z.string().min(3).max(120).optional(),
    companyName: z.string().max(200).optional(),
    phone: z.string().regex(/^[+]?[\d\s()\-]{7,20}$/).optional(),
    address: z.string().max(300).optional(),
    city: z.string().max(100).optional(),
    country: z.string().max(100).optional(),
    isActive: z.boolean().optional(),
  });

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    console.log(`❌ [PUT /api/customers/${id}] Validation failed:`, parsed.error.issues[0].message);
    return res.status(400).json({ message: parsed.error.issues[0].message });
  }

  try {
    const user = await prisma.user.findUnique({ 
      where: { id },
      include: { customerProfile: true }
    });

    if (!user || user.role !== "CUSTOMER") {
      console.log(`❌ [PUT /api/customers/${id}] Customer not found`);
      return res.status(404).json({ message: "Customer not found." });
    }

    const { fullName, isActive, ...profileData } = parsed.data;

    // Update user and profile
    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(fullName && { fullName }),
        ...(isActive !== undefined && { isActive }),
        customerProfile: {
          update: profileData,
        },
      },
      include: { customerProfile: true },
    });

    console.log(`✅ [PUT /api/customers/${id}] Customer updated successfully`);
    res.json({
      customer: {
        id: updated.id,
        fullName: updated.fullName,
        email: updated.email,
        isActive: updated.isActive,
        companyName: updated.customerProfile.companyName,
        phone: updated.customerProfile.phone,
        address: updated.customerProfile.address,
        city: updated.customerProfile.city,
        country: updated.customerProfile.country,
      },
    });
  } catch (err) {
    console.error(`❌ [PUT /api/customers/${id}] Error:`, err);
    res.status(500).json({ message: "Failed to update customer." });
  }
});

// DELETE /api/customers/:id - remove a customer account.
router.delete("/:id", requireAdminOrModulePermission("customer", "canDelete"), async (req, res) => {
  const { id } = req.params;
  console.log(`📥 [DELETE /api/customers/${id}] Request received`);
  
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.role !== "CUSTOMER") {
      console.log(`❌ [DELETE /api/customers/${id}] Customer not found`);
      return res.status(404).json({ message: "Customer not found." });
    }

    console.log(`🗑️ [DELETE /api/customers/${id}] Deleting customer: ${user.fullName}`);
    await prisma.user.delete({ where: { id } });
    
    console.log(`✅ [DELETE /api/customers/${id}] Customer deleted successfully`);
    res.json({ message: "Customer deleted." });
  } catch (err) {
    console.error(`❌ [DELETE /api/customers/${id}] Error:`, err);
    res.status(500).json({ message: "Failed to delete customer." });
  }
});

// POST /api/customers/:id/reset-password - reset customer password.
router.post("/:id/reset-password", requireAdminOrModulePermission("customer", "canEdit"), async (req, res) => {
  const { id } = req.params;
  console.log(`📥 [POST /api/customers/${id}/reset-password] Request received`);

  const passwordSchema = z.object({
    password: z
      .string()
      .min(6, "Password must be at least 6 characters.")
      .max(128, "Password must not exceed 128 characters.")
      .refine(
        (pwd) => {
          const hasUpper = /[A-Z]/.test(pwd);
          const hasLower = /[a-z]/.test(pwd);
          const hasNumber = /[0-9]/.test(pwd);
          const count = [hasUpper, hasLower, hasNumber].filter(Boolean).length;
          return count >= 2;
        },
        "Password must contain at least 2 of: uppercase letter, lowercase letter, number."
      ),
  });

  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    console.log(`❌ [POST /api/customers/${id}/reset-password] Validation failed:`, firstError.message);
    return res.status(400).json({ 
      message: firstError.message,
      field: "password"
    });
  }

  const { password } = parsed.data;

  try {
    const user = await prisma.user.findUnique({ 
      where: { id },
      include: { customerProfile: true }
    });
    
    if (!user || user.role !== "CUSTOMER") {
      console.log(`❌ [POST /api/customers/${id}/reset-password] Customer not found`);
      return res.status(404).json({ message: "Customer not found." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    console.log(`✅ [POST /api/customers/${id}/reset-password] Password reset successfully for: ${user.email}`);

    // Send password reset email
    try {
      console.log(`📧 [POST /api/customers/${id}/reset-password] Sending password reset email to: ${user.email}`);
      await sendPasswordResetEmail({
        customerEmail: user.email,
        customerName: user.fullName,
        companyName: user.customerProfile?.companyName || null,
        password: password, // Send plain text password in email
      });
      console.log(`✅ [POST /api/customers/${id}/reset-password] Password reset email sent successfully to: ${user.email}`);
    } catch (emailError) {
      console.error(`⚠️ [POST /api/customers/${id}/reset-password] Failed to send password reset email to ${user.email}:`, emailError);
      // Don't fail the password reset if email fails
      // Password is reset, but email wasn't sent
    }

    res.json({ message: "Password reset successfully." });
  } catch (err) {
    console.error(`❌ [POST /api/customers/${id}/reset-password] Error:`, err);
    res.status(500).json({ message: "Failed to reset password." });
  }
});

export default router;

// ============================================================================
// CUSTOMER PORTAL ENDPOINTS
// ============================================================================

// GET /api/customers/me/dashboard - Get customer dashboard data
router.get("/me/dashboard", async (req, res) => {
  try {
    const userId = req.user.id;

    if (req.user.role !== "CUSTOMER") {
      return res.status(403).json({ message: "Access denied. Customer role required." });
    }

    // Get customer profile
    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ message: "Customer profile not found." });
    }

    // Get projects count
    const projectsStats = await prisma.project.groupBy({
      by: ['status'],
      where: {
        customerId: customerProfile.id,
        isArchived: false,
      },
      _count: true,
    });

    const [pendingRequests, recentRequests] = await Promise.all([
      prisma.customerServiceRequest.count({
        where: {
          customerId: customerProfile.id,
          status: { in: ["PENDING", "IN_PROGRESS"] },
        },
      }),
      prisma.customerServiceRequest.findMany({
        where: { customerId: customerProfile.id },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              category: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    const stats = {
      activeProjects: projectsStats
        .filter(p => p.status === 'IN_PROGRESS')
        .reduce((sum, p) => sum + p._count, 0),
      completedProjects: projectsStats
        .filter(p => p.status === 'COMPLETED')
        .reduce((sum, p) => sum + p._count, 0),
      totalProjects: projectsStats
        .reduce((sum, p) => sum + p._count, 0),
      pendingRequests,
      outstandingInvoices: 0, // TODO: Add invoices count when invoicing system is implemented
    };

    // Get recent projects (last 5)
    const recentProjects = await prisma.project.findMany({
      where: {
        customerId: customerProfile.id,
        isArchived: false,
      },
      include: {
        assignments: {
          include: {
            employee: {
              select: {
                user: {
                  select: {
                    fullName: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            tasks: true,
            documents: true,
            comments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const formattedProjects = recentProjects.map(p => ({
      id: p.id,
      name: p.name,
      code: p.code,
      status: p.status,
      progress: p.progress,
      startDate: p.startDate,
      endDate: p.endDate,
      priority: p.priority,
      teamSize: p.assignments.length,
      tasksCount: p._count.tasks,
      documentsCount: p._count.documents,
      commentsCount: p._count.comments,
    }));

    res.json({
      stats,
      recentProjects: formattedProjects,
      recentRequests,
    });
  } catch (err) {
    console.error("Get customer dashboard error:", err);
    res.status(500).json({ message: "Failed to load dashboard data." });
  }
});

// GET /api/customers/me/projects - Get customer's projects
router.get("/me/projects", async (req, res) => {
  try {
    const userId = req.user.id;

    if (req.user.role !== "CUSTOMER") {
      return res.status(403).json({ message: "Access denied. Customer role required." });
    }

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ message: "Customer profile not found." });
    }

    const { status, search } = req.query;

    const where = {
      customerId: customerProfile.id,
      isArchived: false,
    };

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        assignments: {
          select: {
            id: true,
            roleOnProject: true,
            employee: {
              select: {
                user: {
                  select: {
                    fullName: true,
                    email: true,
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
            documents: true,
            comments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedProjects = projects.map(p => ({
      id: p.id,
      name: p.name,
      code: p.code,
      description: p.description,
      status: p.status,
      priority: p.priority,
      progress: p.progress,
      startDate: p.startDate,
      endDate: p.endDate,
      team: p.assignments.map(a => ({
        name: a.employee.user.fullName,
        email: a.employee.user.email,
        role: a.roleOnProject,
      })),
      tasks: {
        total: p._count.tasks,
        completed: p.tasks.filter(t => t.status === 'COMPLETED').length,
        inProgress: p.tasks.filter(t => t.status === 'IN_PROGRESS').length,
      },
      documentsCount: p._count.documents,
      commentsCount: p._count.comments,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    res.json({ projects: formattedProjects });
  } catch (err) {
    console.error("Get customer projects error:", err);
    res.status(500).json({ message: "Failed to load projects." });
  }
});

// GET /api/customers/me/projects/:id - Get single project details
router.get("/me/projects/:id", async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    if (req.user.role !== "CUSTOMER") {
      return res.status(403).json({ message: "Access denied. Customer role required." });
    }

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ message: "Customer profile not found." });
    }

    const project = await prisma.project.findFirst({
      where: {
        id,
        customerId: customerProfile.id,
      },
      include: {
        assignments: {
          include: {
            employee: {
              select: {
                user: {
                  select: {
                    fullName: true,
                    email: true,
                  },
                },
                employeeCode: true,
              },
            },
          },
        },
        tasks: {
          orderBy: { orderIndex: 'asc' },
        },
        documents: {
          orderBy: { uploadedAt: 'desc' },
        },
        comments: {
          orderBy: { createdAt: 'desc' },
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found or access denied." });
    }

    res.json({ project });
  } catch (err) {
    console.error("Get customer project details error:", err);
    res.status(500).json({ message: "Failed to load project details." });
  }
});

// GET /api/customers/me/profile - Get customer's own profile
router.get("/me/profile", async (req, res) => {
  try {
    const userId = req.user.id;

    if (req.user.role !== "CUSTOMER") {
      return res.status(403).json({ message: "Access denied. Customer role required." });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        customerProfile: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.json({
      profile: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        isActive: user.isActive,
        companyName: user.customerProfile?.companyName || null,
        phone: user.customerProfile?.phone || null,
        address: user.customerProfile?.address || null,
        city: user.customerProfile?.city || null,
        country: user.customerProfile?.country || null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    console.error("Get customer profile error:", err);
    res.status(500).json({ message: "Failed to load profile." });
  }
});

// PATCH /api/customers/me/profile - Update customer's own profile
router.patch("/me/profile", async (req, res) => {
  try {
    const userId = req.user.id;

    if (req.user.role !== "CUSTOMER") {
      return res.status(403).json({ message: "Access denied. Customer role required." });
    }

    const updateSchema = z.object({
      fullName: z.string().min(3).max(120).optional(),
      companyName: z.string().max(200).optional(),
      phone: z.string().regex(/^[+]?[\d\s()\-]{7,20}$/).optional(),
      address: z.string().max(300).optional(),
      city: z.string().max(100).optional(),
      country: z.string().max(100).optional(),
    });

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const { fullName, ...profileData } = parsed.data;

    // Update user and profile
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(fullName && { fullName }),
        customerProfile: {
          update: profileData,
        },
      },
      include: { customerProfile: true },
    });

    res.json({
      profile: {
        id: updated.id,
        fullName: updated.fullName,
        email: updated.email,
        companyName: updated.customerProfile.companyName,
        phone: updated.customerProfile.phone,
        address: updated.customerProfile.address,
        city: updated.customerProfile.city,
        country: updated.customerProfile.country,
      },
    });
  } catch (err) {
    console.error("Update customer profile error:", err);
    res.status(500).json({ message: "Failed to update profile." });
  }
});

// GET /api/customers/me/requests - Get customer's service requests
router.get("/me/requests", async (req, res) => {
  try {
    const userId = req.user.id;

    if (req.user.role !== "CUSTOMER") {
      return res.status(403).json({ message: "Access denied. Customer role required." });
    }

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ message: "Customer profile not found." });
    }

    const requests = await prisma.customerServiceRequest.findMany({
      where: { customerId: customerProfile.id },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            category: true,
            price: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ requests });
  } catch (err) {
    console.error("Get customer requests error:", err);
    res.status(500).json({ message: "Failed to load requests." });
  }
});

// POST /api/customers/me/requests - Create new service request
router.post("/me/requests", async (req, res) => {
  try {
    const userId = req.user.id;

    if (req.user.role !== "CUSTOMER") {
      return res.status(403).json({ message: "Access denied. Customer role required." });
    }

    const requestSchema = z.object({
      subject: z.string().min(5, "Subject must be at least 5 characters.").max(200),
      description: z.string().min(10, "Description must be at least 10 characters.").max(2000),
      priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
      serviceId: z.string().uuid("Invalid service selected.").optional().nullable(),
    });

    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ message: "Customer profile not found." });
    }

    let service = null;
    if (parsed.data.serviceId) {
      service = await prisma.service.findFirst({
        where: {
          id: parsed.data.serviceId,
          isActive: true,
        },
      });

      if (!service) {
        return res.status(400).json({ message: "Selected service is not available." });
      }
    }

    const request = await prisma.customerServiceRequest.create({
      data: {
        customerId: customerProfile.id,
        serviceId: service?.id || null,
        subject: parsed.data.subject,
        description: parsed.data.description,
        priority: parsed.data.priority,
      },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            category: true,
            price: true,
          },
        },
      },
    });

    res.status(201).json({
      message: "Request submitted successfully. Our team will review it shortly.",
      request,
    });
  } catch (err) {
    console.error("Create customer request error:", err);
    res.status(500).json({ message: "Failed to submit request." });
  }
});

// GET /api/customers/me/documents - Get customer's project documents
router.get("/me/documents", async (req, res) => {
  try {
    const userId = req.user.id;

    if (req.user.role !== "CUSTOMER") {
      return res.status(403).json({ message: "Access denied. Customer role required." });
    }

    const customerProfile = await prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!customerProfile) {
      return res.status(404).json({ message: "Customer profile not found." });
    }

    // Get all projects for this customer
    const projects = await prisma.project.findMany({
      where: {
        customerId: customerProfile.id,
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

    const projectIds = projects.map(p => p.id);

    // Get all documents from customer's projects
    const documents = await prisma.projectDocument.findMany({
      where: {
        projectId: { in: projectIds },
      },
      include: {
        project: {
          select: {
            name: true,
            code: true,
          },
        },
      },
      orderBy: { uploadedAt: "desc" },
    });

    const formatted = documents.map(doc => ({
      id: doc.id,
      fileName: doc.fileName,
      fileUrl: doc.fileUrl,
      fileSize: doc.fileSize,
      fileType: doc.fileType,
      uploadedAt: doc.uploadedAt,
      uploadedById: doc.uploadedById,
      project: {
        id: doc.projectId,
        name: doc.project.name,
        code: doc.project.code,
      },
    }));

    res.json({ documents: formatted });
  } catch (err) {
    console.error("Get customer documents error:", err);
    res.status(500).json({ message: "Failed to load documents." });
  }
});
