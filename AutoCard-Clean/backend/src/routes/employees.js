import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "../prismaClient.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { requireAdminOrModulePermission } from "../middleware/checkModulePermission.js";
import { sendWelcomeEmail } from "../utils/emailService.js";

const router = Router();

// All routes require authentication
router.use(requireAuth);

const createEmployeeSchema = z.object({
  fullName: z.string().min(1, "Full name is required."),
  email: z.string().email("A valid email is required."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  employeeCode: z.string().min(1, "Employee code is required."),
  jobTitle: z.string().optional(),
});

// GET /api/employees - list all employees with their profile + status.
// Accessible by ADMIN or EMPLOYEE with 'canView' permission on 'employee' module
router.get("/", requireAdminOrModulePermission("employee", "canView"), async (_req, res) => {
  try {
    const employees = await prisma.user.findMany({
      where: { role: "EMPLOYEE" },
      include: { employeeProfile: true },
      orderBy: { createdAt: "desc" },
    });

    const result = employees.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      isActive: u.isActive,
      employeeCode: u.employeeProfile?.employeeCode ?? null,
      jobTitle: u.employeeProfile?.jobTitle ?? null,
      onboardingStatus: u.employeeProfile?.onboardingStatus ?? null,
      profileImage: u.employeeProfile?.profileImage ?? null,
      createdAt: u.createdAt,
    }));

    res.json({ employees: result });
  } catch (err) {
    console.error("List employees error:", err);
    res.status(500).json({ message: "Failed to load employees." });
  }
});

// POST /api/employees - create an employee account + profile.
// Accessible by ADMIN or EMPLOYEE with 'canCreate' permission
router.post("/", requireAdminOrModulePermission("employee", "canCreate"), async (req, res) => {
  const parsed = createEmployeeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0].message });
  }

  const { fullName, email, password, employeeCode, jobTitle } = parsed.data;

  try {
    // Guard against duplicate email or employee code.
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }
    const existingCode = await prisma.employeeProfile.findUnique({ where: { employeeCode } });
    if (existingCode) {
      return res.status(409).json({ message: "This employee code is already in use." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Create user + employee profile together. Profile starts as PENDING,
    // so the employee must complete onboarding before accessing modules.
    const user = await prisma.user.create({
      data: {
        email,
        fullName,
        passwordHash,
        role: "EMPLOYEE",
        employeeProfile: {
          create: {
            employeeCode,
            jobTitle: jobTitle || null,
            onboardingStatus: "PENDING",
          },
        },
      },
      include: { employeeProfile: true },
    });

    // Send welcome email with login credentials
    try {
      await sendWelcomeEmail({
        employeeEmail: email,
        employeeName: fullName,
        employeeCode,
        password, // Plain text password before hashing
        loginUrl: process.env.FRONTEND_URL 
          ? `${process.env.FRONTEND_URL}/login/employee` 
          : "http://localhost:5173/login/employee",
      });
      console.log(`✅ [Employee Created] Welcome email sent to ${email}`);
    } catch (emailError) {
      console.error(`⚠️  [Employee Created] User created but email failed for ${email}:`, emailError.message);
      // Don't fail the request if email fails - user is still created
    }

    res.status(201).json({
      employee: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        employeeCode: user.employeeProfile.employeeCode,
        jobTitle: user.employeeProfile.jobTitle,
        onboardingStatus: user.employeeProfile.onboardingStatus,
      },
    });
  } catch (err) {
    console.error("Create employee error:", err);
    res.status(500).json({ message: "Failed to create employee." });
  }
});

// DELETE /api/employees/:id - remove an employee account and all related
// records (profile, attendance, leave, requests cascade via the schema).
// Accessible by ADMIN or EMPLOYEE with 'canDelete' permission
router.delete("/:id", requireAdminOrModulePermission("employee", "canDelete"), async (req, res) => {
  const { id } = req.params;
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.role !== "EMPLOYEE") {
      return res.status(404).json({ message: "Employee not found." });
    }

    await prisma.user.delete({ where: { id } });
    res.json({ message: "Employee deleted." });
  } catch (err) {
    console.error("Delete employee error:", err);
    res.status(500).json({ message: "Failed to delete employee." });
  }
});

export default router;