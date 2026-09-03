import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "../prismaClient.js";
import { signToken, requireAuth } from "../middleware/auth.js";

const router = Router();

// Maps the frontend role slug to the DB enum value.
const roleMap = {
  admin: "ADMIN",
  employee: "EMPLOYEE",
  customer: "CUSTOMER",
};

const loginSchema = z.object({
  email: z.string().min(1), // Can be email or employee code
  password: z.string().min(1),
  role: z.enum(["admin", "employee", "customer"]).optional(),
});

// Builds the public user object returned to the client, including the
// employee onboarding status when applicable.
function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    onboardingStatus: user.employeeProfile?.onboardingStatus ?? null,
    employeeProfileId: user.employeeProfile?.id ?? null,
  };
}

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request data." });
  }

  const { email, password, role } = parsed.data;
  const expectedRole = role ? roleMap[role] : null; // null means universal login

  try {
    let user;
    
    // For employee login, check if the input is an employee code
    if (role === "employee") {
      // Try to find by employee code first
      const employeeProfile = await prisma.employeeProfile.findUnique({
        where: { employeeCode: email },
        include: { user: { include: { employeeProfile: true, customerProfile: true } } },
      });
      
      if (employeeProfile) {
        user = employeeProfile.user;
      } else {
        // Fall back to email lookup
        user = await prisma.user.findUnique({
          where: { email },
          include: { employeeProfile: true, customerProfile: true },
        });
      }
    } else {
      // For admin and customer, use email only
      user = await prisma.user.findUnique({
        where: { email },
        include: { employeeProfile: true, customerProfile: true },
      });
    }

    // Generic message so we don't leak which emails/IDs exist.
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "This account is inactive." });
    }

    // If role is provided (old login pages), enforce role match
    // If no role (universal login), allow any role
    if (expectedRole && user.role !== expectedRole) {
      return res.status(403).json({
        message: `These credentials are not valid for ${role} login.`,
      });
    }

    const token = signToken({ id: user.id, role: user.role });

    return res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// GET /api/auth/me - return the current user (used to refresh status).
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { employeeProfile: true },
    });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    return res.json({ user: publicUser(user) });
  } catch (err) {
    console.error("Fetch me error:", err);
    return res.status(500).json({ message: "Something went wrong." });
  }
});

export default router;