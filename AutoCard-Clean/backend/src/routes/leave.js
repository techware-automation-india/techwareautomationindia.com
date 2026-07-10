import { Router } from "express";
import { z } from "zod";
import prisma from "../prismaClient.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// ─── helpers ────────────────────────────────────────────────────────────────

/** Count working days between two inclusive dates (Mon–Sat, skip Sundays). */
function countWorkingDays(start, end) {
  let count = 0;
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setHours(0, 0, 0, 0);
  while (cur <= last) {
    if (cur.getDay() !== 0) count++; // skip Sunday
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/** Ensure a LeaveBalance row exists for employee+leaveType+year, return it. */
async function ensureBalance(employeeId, leaveTypeId, year, leaveType) {
  let balance = await prisma.leaveBalance.findUnique({
    where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
  });
  if (!balance) {
    balance = await prisma.leaveBalance.create({
      data: {
        employeeId,
        leaveTypeId,
        year,
        allocated: leaveType.daysPerYear,
        used: 0,
      },
    });
  }
  return balance;
}

// ─── EMPLOYEE ROUTES ────────────────────────────────────────────────────────

// GET /api/leave/types  – active leave types (readable by employee)
router.get("/types", requireAuth, requireRole("EMPLOYEE"), async (_req, res) => {
  try {
    const leaveTypes = await prisma.leaveType.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    res.json({ leaveTypes });
  } catch (err) {
    console.error("Employee list leave types error:", err);
    res.status(500).json({ message: "Failed to load leave types." });
  }
});

// GET /api/leave/balances  – current year balances for logged-in employee
router.get("/balances", requireAuth, requireRole("EMPLOYEE"), async (req, res) => {
  try {
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!profile) return res.status(404).json({ message: "Employee profile not found." });

    const year = new Date().getFullYear();
    const leaveTypes = await prisma.leaveType.findMany({ where: { isActive: true } });

    // Upsert balances for every active leave type so they always appear
    const balances = await Promise.all(
      leaveTypes.map(async (lt) => {
        const bal = await ensureBalance(profile.id, lt.id, year, lt);
        return {
          leaveTypeId: lt.id,
          leaveTypeName: lt.name,
          leaveTypeCode: lt.code,
          isPaid: lt.isPaid,
          allocated: bal.allocated,
          used: bal.used,
          remaining: Math.max(0, bal.allocated - bal.used),
          year,
        };
      })
    );

    res.json({ balances });
  } catch (err) {
    console.error("Get balances error:", err);
    res.status(500).json({ message: "Failed to load balances." });
  }
});

// GET /api/leave/my  – leave history for logged-in employee
router.get("/my", requireAuth, requireRole("EMPLOYEE"), async (req, res) => {
  try {
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!profile) return res.status(404).json({ message: "Employee profile not found." });

    const requests = await prisma.leaveRequest.findMany({
      where: { employeeId: profile.id },
      include: { leaveType: true },
      orderBy: { createdAt: "desc" },
    });

    res.json({ requests });
  } catch (err) {
    console.error("Get my leave error:", err);
    res.status(500).json({ message: "Failed to load leave history." });
  }
});

// POST /api/leave/apply  – employee applies for leave
const applySchema = z.object({
  leaveTypeId: z.string().min(1, "Leave type is required."),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid start date."),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid end date."),
  reason: z.string().trim().max(500).optional(),
});

router.post("/apply", requireAuth, requireRole("EMPLOYEE"), async (req, res) => {
  const parsed = applySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0].message });
  }
  const { leaveTypeId, startDate, endDate, reason } = parsed.data;

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end < start) {
    return res.status(400).json({ message: "End date must be on or after start date." });
  }

  try {
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!profile) return res.status(404).json({ message: "Employee profile not found." });

    if (profile.onboardingStatus !== "APPROVED") {
      return res.status(403).json({ message: "Complete onboarding before applying for leave." });
    }

    const leaveType = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } });
    if (!leaveType || !leaveType.isActive) {
      return res.status(404).json({ message: "Leave type not found or inactive." });
    }

    const totalDays = countWorkingDays(start, end);
    if (totalDays === 0) {
      return res.status(400).json({ message: "No working days in the selected date range." });
    }

    const year = start.getFullYear();
    const balance = await ensureBalance(profile.id, leaveTypeId, year, leaveType);
    const remaining = balance.allocated - balance.used;

    if (totalDays > remaining) {
      return res.status(400).json({
        message: `Insufficient balance. You have ${remaining} day(s) remaining for ${leaveType.name}.`,
      });
    }

    // Check for overlapping pending/approved leave
    const overlap = await prisma.leaveRequest.findFirst({
      where: {
        employeeId: profile.id,
        status: { in: ["PENDING", "APPROVED"] },
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });
    if (overlap) {
      return res.status(409).json({ message: "You already have a leave request overlapping these dates." });
    }

    // Emergency / no-approval leave → auto-approve and deduct balance immediately
    const isAutoApproved = leaveType.requiresApproval === false;

    const request = await prisma.leaveRequest.create({
      data: {
        employeeId: profile.id,
        leaveTypeId,
        startDate: start,
        endDate: end,
        totalDays,
        reason: reason || null,
        status: isAutoApproved ? "APPROVED" : "PENDING",
        ...(isAutoApproved && {
          reviewNote: "Auto-approved (no approval required for this leave type)",
          reviewedAt: new Date(),
        }),
      },
      include: { leaveType: true },
    });

    // Deduct balance right away for auto-approved leave
    if (isAutoApproved) {
      await prisma.leaveBalance.update({
        where: { id: balance.id },
        data: { used: { increment: totalDays } },
      });
    }

    res.status(201).json({ request, autoApproved: isAutoApproved });
  } catch (err) {
    console.error("Apply leave error:", err);
    res.status(500).json({ message: "Failed to apply for leave." });
  }
});

// POST /api/leave/:id/cancel  – employee cancels their own pending request
router.post("/:id/cancel", requireAuth, requireRole("EMPLOYEE"), async (req, res) => {
  const { id } = req.params;
  try {
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!profile) return res.status(404).json({ message: "Employee profile not found." });

    const request = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!request || request.employeeId !== profile.id) {
      return res.status(404).json({ message: "Leave request not found." });
    }
    if (request.status !== "PENDING") {
      return res.status(400).json({ message: "Only pending requests can be cancelled." });
    }

    await prisma.leaveRequest.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    res.json({ message: "Leave request cancelled." });
  } catch (err) {
    console.error("Cancel leave error:", err);
    res.status(500).json({ message: "Failed to cancel leave request." });
  }
});

// ─── ADMIN ROUTES ────────────────────────────────────────────────────────────

// GET /api/leave/admin/all  – all leave requests with employee info
router.get("/admin/all", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status && ["PENDING", "APPROVED", "REJECTED", "CANCELLED"].includes(status)) {
      where.status = status;
    }

    const requests = await prisma.leaveRequest.findMany({
      where,
      include: {
        leaveType: true,
        employee: {
          include: { user: { select: { fullName: true, email: true } } },
        },
        reviewedBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ requests });
  } catch (err) {
    console.error("Admin list leave error:", err);
    res.status(500).json({ message: "Failed to load leave requests." });
  }
});

// POST /api/leave/admin/:id/approve
router.post("/admin/:id/approve", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const { id } = req.params;
  const { note } = req.body;

  try {
    const request = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ message: "Leave request not found." });
    if (request.status !== "PENDING") {
      return res.status(400).json({ message: "Only pending requests can be approved." });
    }

    const year = new Date(request.startDate).getFullYear();
    const balance = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: request.employeeId,
          leaveTypeId: request.leaveTypeId,
          year,
        },
      },
    });

    await prisma.$transaction([
      prisma.leaveRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewNote: note || null,
          reviewedById: req.user.id,
          reviewedAt: new Date(),
        },
      }),
      // Deduct from balance
      ...(balance
        ? [
            prisma.leaveBalance.update({
              where: { id: balance.id },
              data: { used: { increment: request.totalDays } },
            }),
          ]
        : []),
    ]);

    res.json({ message: "Leave request approved." });
  } catch (err) {
    console.error("Approve leave error:", err);
    res.status(500).json({ message: "Failed to approve leave request." });
  }
});

// POST /api/leave/admin/:id/reject
router.post("/admin/:id/reject", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const { id } = req.params;
  const { note } = req.body;

  try {
    const request = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ message: "Leave request not found." });
    if (request.status !== "PENDING") {
      return res.status(400).json({ message: "Only pending requests can be rejected." });
    }

    await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewNote: note || null,
        reviewedById: req.user.id,
        reviewedAt: new Date(),
      },
    });

    res.json({ message: "Leave request rejected." });
  } catch (err) {
    console.error("Reject leave error:", err);
    res.status(500).json({ message: "Failed to reject leave request." });
  }
});

export default router;
