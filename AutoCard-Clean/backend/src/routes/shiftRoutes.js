import { Router } from "express";
import { z } from "zod";
import prisma from "../prismaClient.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdminOrModulePermission } from "../middleware/checkModulePermission.js";

const router = Router();

// GET routes — all authenticated users (employees need shift info)
// Write routes are admin-only — enforced per-route below.

// GET /api/shifts?page=1&limit=20&search=
router.get("/", requireAuth, async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 20);
    const search = (req.query.search || "").trim();
    const skip   = (page - 1) * limit;

    const where = search ? { name: { contains: search } } : {};

    const [rows, total] = await Promise.all([
      prisma.shift.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
      prisma.shift.count({ where }),
    ]);

    res.json({ success: true, data: rows, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});


const shiftSchema = z.object({
  name:        z.string().trim().min(2, "Shift name is required."),
  startTime:   z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid start time (HH:mm)."),
  endTime:     z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid end time (HH:mm)."),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  isActive:    z.boolean().default(true),
});

const updateShiftSchema = shiftSchema.partial();

// GET /api/shifts/:id
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const shift = await prisma.shift.findUnique({ where: { id: req.params.id } });
    if (!shift) return res.status(404).json({ success: false, message: "Shift not found." });
    res.json({ success: true, data: shift });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// POST /api/shifts — admin or with permission
router.post("/", requireAdminOrModulePermission("shift-location", "canCreate"), async (req, res) => {
  try {
    const data = shiftSchema.parse(req.body);
    const exists = await prisma.shift.findFirst({ where: { name: data.name } });
    if (exists) return res.status(400).json({ success: false, message: "A shift with this name already exists." });

    const shift = await prisma.shift.create({ data: { ...data, description: data.description || null } });
    res.status(201).json({ success: true, message: "Shift created.", data: shift });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ success: false, message: err.errors[0].message });
    console.error(err);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// PATCH /api/shifts/:id — admin or with permission
router.patch("/:id", requireAdminOrModulePermission("shift-location", "canEdit"), async (req, res) => {
  try {
    const data = updateShiftSchema.parse(req.body);
    const shift = await prisma.shift.findUnique({ where: { id: req.params.id } });
    if (!shift) return res.status(404).json({ success: false, message: "Shift not found." });

    if (data.name) {
      const exists = await prisma.shift.findFirst({ where: { name: data.name, NOT: { id: req.params.id } } });
      if (exists) return res.status(400).json({ success: false, message: "A shift with this name already exists." });
    }

    const updated = await prisma.shift.update({
      where: { id: req.params.id },
      data: { ...data, description: data.description === "" ? null : data.description },
    });
    res.json({ success: true, message: "Shift updated.", data: updated });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ success: false, message: err.errors[0].message });
    console.error(err);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// DELETE /api/shifts/:id — admin or with permission
router.delete("/:id", requireAdminOrModulePermission("shift-location", "canDelete"), async (req, res) => {
  try {
    const shift = await prisma.shift.findUnique({ where: { id: req.params.id } });
    if (!shift) return res.status(404).json({ success: false, message: "Shift not found." });
    await prisma.shift.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Shift deleted." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

export default router;
