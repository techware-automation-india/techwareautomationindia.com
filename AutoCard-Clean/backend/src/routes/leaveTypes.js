import { Router } from "express";
import { z } from "zod";
import prisma from "../prismaClient.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// All routes here require an authenticated ADMIN.
router.use(requireAuth, requireRole("ADMIN"));

const leaveTypeSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(80),
  code: z
    .string()
    .trim()
    .min(1, "Code is required.")
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/, "Code may only contain letters, numbers, _ or -."),
  daysPerYear: z
    .union([z.string(), z.number()])
    .transform((v) => Number(v))
    .refine((v) => Number.isFinite(v) && v >= 0 && v <= 365, "Days per year must be 0-365."),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  isPaid: z.boolean().optional(),
  isActive: z.boolean().optional(),
  requiresApproval: z.boolean().optional(),
});

// GET /api/leave-types - list all leave types.
router.get("/", async (_req, res) => {
  try {
    const leaveTypes = await prisma.leaveType.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ leaveTypes });
  } catch (err) {
    console.error("List leave types error:", err);
    res.status(500).json({ message: "Failed to load leave types." });
  }
});

// POST /api/leave-types - create a leave type.
router.post("/", async (req, res) => {
  const parsed = leaveTypeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0].message });
  }
  const d = parsed.data;
  const code = d.code.toUpperCase();

  try {
    const existing = await prisma.leaveType.findFirst({
      where: { OR: [{ name: d.name }, { code }] },
    });
    if (existing) {
      return res.status(409).json({ message: "A leave type with this name or code already exists." });
    }

    const leaveType = await prisma.leaveType.create({
      data: {
        name: d.name,
        code,
        daysPerYear: d.daysPerYear,
        description: d.description || null,
        isPaid: d.isPaid ?? true,
        isActive: d.isActive ?? true,
        requiresApproval: d.requiresApproval ?? true,
      },
    });
    res.status(201).json({ leaveType });
  } catch (err) {
    console.error("Create leave type error:", err);
    res.status(500).json({ message: "Failed to create leave type." });
  }
});

// PUT /api/leave-types/:id - update a leave type.
router.put("/:id", async (req, res) => {
  const parsed = leaveTypeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0].message });
  }
  const d = parsed.data;
  const code = d.code.toUpperCase();
  const { id } = req.params;

  try {
    const current = await prisma.leaveType.findUnique({ where: { id } });
    if (!current) {
      return res.status(404).json({ message: "Leave type not found." });
    }

    // Ensure name/code uniqueness against other records.
    const clash = await prisma.leaveType.findFirst({
      where: { id: { not: id }, OR: [{ name: d.name }, { code }] },
    });
    if (clash) {
      return res.status(409).json({ message: "Another leave type with this name or code already exists." });
    }

    const leaveType = await prisma.leaveType.update({
      where: { id },
      data: {
        name: d.name,
        code,
        daysPerYear: d.daysPerYear,
        description: d.description || null,
        isPaid: d.isPaid ?? current.isPaid,
        isActive: d.isActive ?? current.isActive,
        requiresApproval: d.requiresApproval ?? current.requiresApproval,
      },
    });
    res.json({ leaveType });
  } catch (err) {
    console.error("Update leave type error:", err);
    res.status(500).json({ message: "Failed to update leave type." });
  }
});

// DELETE /api/leave-types/:id - remove a leave type.
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const current = await prisma.leaveType.findUnique({ where: { id } });
    if (!current) {
      return res.status(404).json({ message: "Leave type not found." });
    }
    await prisma.leaveType.delete({ where: { id } });
    res.json({ message: "Leave type deleted." });
  } catch (err) {
    console.error("Delete leave type error:", err);
    res.status(500).json({ message: "Failed to delete leave type." });
  }
});

export default router;
