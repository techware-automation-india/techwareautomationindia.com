import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "../prismaClient.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdminOrModulePermission } from "../middleware/checkModulePermission.js";
import { sendWelcomeEmail } from "../utils/emailService.js";

const router = Router();

// All routes require authentication
router.use(requireAuth);

const createEmployeeSchema = z.object({
  fullName: z.string().min(1, "Full name is required."),
  email: z.string().min(1, "Username is required."),
  password: z.string().min(1, "Password is required."),
  employeeCode: z.string().min(1, "Employee code is required."),
  jobTitle: z.string().optional(),
});

// ============================================================================
// GET /api/employees
// ============================================================================

router.get(
  "/",
  requireAdminOrModulePermission("employee", "canView"),
  async (_req, res) => {
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

      res.status(500).json({
        message: "Failed to load employees.",
      });
    }
  }
);

// ============================================================================
// POST /api/employees
// Create employee
// ============================================================================

router.post(
  "/",
  requireAdminOrModulePermission("employee", "canCreate"),
  async (req, res) => {
    const parsed = createEmployeeSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: parsed.error.issues[0].message,
      });
    }

    const {
      fullName,
      email,
      password,
      employeeCode,
      jobTitle,
    } = parsed.data;

    try {
      // ------------------------------------------------------------
      // Check duplicate email
      // ------------------------------------------------------------

      const existingEmail = await prisma.user.findUnique({
        where: { email },
      });

      if (existingEmail) {
        return res.status(409).json({
          message: "An account with this username already exists.",
        });
      }

      // ------------------------------------------------------------
      // Check duplicate employee code
      // ------------------------------------------------------------

      const existingCode =
        await prisma.employeeProfile.findUnique({
          where: { employeeCode },
        });

      if (existingCode) {
        return res.status(409).json({
          message: "This employee code is already in use.",
        });
      }

      // ------------------------------------------------------------
      // Hash password
      // ------------------------------------------------------------

      const passwordHash = await bcrypt.hash(
        password,
        10
      );

      // ------------------------------------------------------------
      // Create employee + profile
      // ------------------------------------------------------------

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

              // Admin-created employees are automatically approved.
              onboardingStatus: "APPROVED",
            },
          },
        },

        include: {
          employeeProfile: true,
        },
      });

      // ============================================================
      // IMPORTANT
      // ============================================================
      // DO NOT await the email.
      //
      // Employee has already been created in MySQL.
      // Send the email in the background.
      // ============================================================

      sendWelcomeEmail({
        employeeEmail: email,
        employeeName: fullName,
        employeeCode,
        password,

        loginUrl: process.env.FRONTEND_URL
          ? `${process.env.FRONTEND_URL}/login/employee`
          : "http://localhost:5173/login/employee",
      })
        .then(() => {
          console.log(
            `✅ Welcome email sent to ${email}`
          );
        })
        .catch((emailError) => {
          console.error(
            `⚠️ Employee created but welcome email failed for ${email}:`,
            emailError.message
          );
        });

      // ============================================================
      // RETURN SUCCESS IMMEDIATELY
      // ============================================================

      return res.status(201).json({
        employee: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          employeeCode:
            user.employeeProfile.employeeCode,
          jobTitle:
            user.employeeProfile.jobTitle,
          onboardingStatus:
            user.employeeProfile.onboardingStatus,
        },

        message:
          "Employee created successfully.",
      });
    } catch (err) {
      console.error(
        "Create employee error:",
        err
      );

      return res.status(500).json({
        message: "Failed to create employee.",
      });
    }
  }
);

// ============================================================================
// DELETE /api/employees/:id
// ============================================================================

router.delete(
  "/:id",
  requireAdminOrModulePermission("employee", "canDelete"),
  async (req, res) => {
    const { id } = req.params;

    try {
      const user = await prisma.user.findUnique({
        where: { id },
      });

      if (!user || user.role !== "EMPLOYEE") {
        return res.status(404).json({
          message: "Employee not found.",
        });
      }

      await prisma.user.delete({
        where: { id },
      });

      return res.json({
        message: "Employee deleted.",
      });
    } catch (err) {
      console.error(
        "Delete employee error:",
        err
      );

      return res.status(500).json({
        message: "Failed to delete employee.",
      });
    }
  }
);

export default router;