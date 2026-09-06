import { Router } from "express";
import { z } from "zod";
import prisma from "../prismaClient.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdminOrModulePermission } from "../middleware/checkModulePermission.js";

const router = Router();

// All routes require authentication
router.use(requireAuth);

const reviewSchema = z.object({
  note: z.string().optional(),
});

const employeeRequestSchema = z.object({
  type: z.enum(["GENERAL", "DOCUMENT", "EQUIPMENT", "CORRECTION", "OTHER"]).default("GENERAL"),
  subject: z.string().trim().min(1).max(160),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
});

async function getEmployeeProfile(userId) {
  return prisma.employeeProfile.findUnique({ where: { userId } });
}

// Employee self-service request routes.
router.get("/my", async (req, res) => {
  if (req.user.role !== "EMPLOYEE") {
    return res.status(403).json({ message: "Employee access required." });
  }

  try {
    const employee = await getEmployeeProfile(req.user.id);
    if (!employee) return res.status(404).json({ message: "Employee profile not found." });

    const requests = await prisma.employeeRequest.findMany({
      where: {
        employeeId: employee.id,
        type: { not: "ONBOARDING" },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ requests });
  } catch (err) {
    console.error("List employee requests error:", err);
    res.status(500).json({ message: "Failed to load your requests." });
  }
});

router.post("/my", async (req, res) => {
  if (req.user.role !== "EMPLOYEE") {
    return res.status(403).json({ message: "Employee access required." });
  }

  const parsed = employeeRequestSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ message: "Subject and valid request details are required." });
  }

  try {
    const employee = await getEmployeeProfile(req.user.id);
    if (!employee) return res.status(404).json({ message: "Employee profile not found." });

    const request = await prisma.employeeRequest.create({
      data: { ...parsed.data, employeeId: employee.id },
    });
    res.status(201).json({ request, message: "Request submitted successfully." });
  } catch (err) {
    console.error("Create employee request error:", err);
    res.status(500).json({ message: "Failed to submit request." });
  }
});

// GET /api/requests - list employee requests (newest first).
router.get("/", requireAdminOrModulePermission("requests", "canView"), async (req, res) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status && ["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      where.status = status;
    }

    const requests = await prisma.employeeRequest.findMany({
      where,
      include: {
        employee: {
          include: { user: { select: { fullName: true, email: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = requests.map((r) => ({
      id: r.id,
      type: r.type,
      subject: r.subject,
      description: r.description,
      status: r.status,
      reviewNote: r.reviewNote,
      reviewedAt: r.reviewedAt,
      createdAt: r.createdAt,
      employee: {
        id: r.employee.id,
        employeeCode: r.employee.employeeCode,
        fullName: r.employee.user.fullName,
        email: r.employee.user.email,
        onboardingStatus: r.employee.onboardingStatus,
      },
    }));

    res.json({ requests: result });
  } catch (err) {
    console.error("List requests error:", err);
    res.status(500).json({ message: "Failed to load requests." });
  }
});

// GET /api/requests/:id/profile - full employee profile for previewing an
// onboarding request before approving it.
router.get("/:id/profile", requireAdminOrModulePermission("requests", "canView"), async (req, res) => {
  const { id } = req.params;
  try {
    const request = await prisma.employeeRequest.findUnique({
      where: { id },
      include: {
        employee: {
          include: { user: { select: { fullName: true, email: true } } },
        },
      },
    });
    if (!request) {
      return res.status(404).json({ message: "Request not found." });
    }
    res.json({ profile: request.employee, request: { id: request.id, type: request.type, status: request.status } });
  } catch (err) {
    console.error("Get request profile error:", err);
    res.status(500).json({ message: "Failed to load profile." });
  }
});

// Shared handler for approve/reject.
async function reviewRequest(req, res, decision) {
  const parsed = reviewSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request data." });
  }
  const { note } = parsed.data;
  const { id } = req.params;

  try {
    const request = await prisma.employeeRequest.findUnique({ where: { id } });
    if (!request) {
      return res.status(404).json({ message: "Request not found." });
    }
    if (request.status !== "PENDING") {
      return res.status(400).json({ message: "This request has already been reviewed." });
    }

    const newStatus = decision === "approve" ? "APPROVED" : "REJECTED";

    // Build the transaction: always update the request. If it's an onboarding
    // request, also update the employee's onboarding status to match.
    const ops = [
      prisma.employeeRequest.update({
        where: { id },
        data: {
          status: newStatus,
          reviewNote: note || null,
          reviewedById: req.user.id,
          reviewedAt: new Date(),
        },
      }),
    ];

    if (request.type === "ONBOARDING") {
      ops.push(
        prisma.employeeProfile.update({
          where: { id: request.employeeId },
          data: { onboardingStatus: decision === "approve" ? "APPROVED" : "REJECTED" },
        })
      );
    }

    await prisma.$transaction(ops);

    res.json({ message: `Request ${newStatus.toLowerCase()}.` });
  } catch (err) {
    console.error("Review request error:", err);
    res.status(500).json({ message: "Failed to review request." });
  }
}

// POST /api/requests/:id/approve
router.post("/:id/approve", requireAdminOrModulePermission("requests", "canEdit"), (req, res) => reviewRequest(req, res, "approve"));

// POST /api/requests/:id/reject
router.post("/:id/reject", requireAdminOrModulePermission("requests", "canEdit"), (req, res) => reviewRequest(req, res, "reject"));

export default router;
