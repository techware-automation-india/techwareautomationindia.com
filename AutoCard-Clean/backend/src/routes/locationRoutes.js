import { Router } from "express";
import { z } from "zod";
import prisma from "../prismaClient.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// Public GET for authenticated users (employees need location list for their profile)
// Write routes (POST/PATCH/DELETE) are admin-only — enforced per-route below.

// GET /api/locations?page=1&limit=20&search=
router.get("/", requireAuth, async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 20);
    const search = (req.query.search || "").trim();
    const skip   = (page - 1) * limit;

    const where = search ? { name: { contains: search } } : {};

    const [rows, total] = await Promise.all([
      prisma.location.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
      prisma.location.count({ where }),
    ]);

    res.json({ success: true, data: rows, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});


const locationSchema = z.object({
  name:        z.string().trim().min(2, "Location name is required."),
  addressLine: z.string().trim().max(300).optional().or(z.literal("")),
  city:        z.string().trim().max(80).optional().or(z.literal("")),
  state:       z.string().trim().max(80).optional().or(z.literal("")),
  country:     z.string().trim().max(80).optional().or(z.literal("")),
  isActive:    z.boolean().default(true),
});

const updateLocationSchema = locationSchema.partial();

const toNull = (v) => (v === "" || v === undefined ? null : v);

// GET /api/locations/:id
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const loc = await prisma.location.findUnique({ where: { id: req.params.id } });
    if (!loc) return res.status(404).json({ success: false, message: "Location not found." });
    res.json({ success: true, data: loc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// POST /api/locations — admin only
router.post("/", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const data = locationSchema.parse(req.body);
    const exists = await prisma.location.findFirst({ where: { name: data.name } });
    if (exists) return res.status(400).json({ success: false, message: "A location with this name already exists." });

    const loc = await prisma.location.create({
      data: {
        name:        data.name,
        addressLine: toNull(data.addressLine),
        city:        toNull(data.city),
        state:       toNull(data.state),
        country:     toNull(data.country),
        isActive:    data.isActive ?? true,
      },
    });
    res.status(201).json({ success: true, message: "Location created.", data: loc });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ success: false, message: err.errors[0].message });
    console.error(err);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// PATCH /api/locations/:id — admin only
router.patch("/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const data = updateLocationSchema.parse(req.body);
    const loc = await prisma.location.findUnique({ where: { id: req.params.id } });
    if (!loc) return res.status(404).json({ success: false, message: "Location not found." });

    if (data.name) {
      const exists = await prisma.location.findFirst({ where: { name: data.name, NOT: { id: req.params.id } } });
      if (exists) return res.status(400).json({ success: false, message: "A location with this name already exists." });
    }

    const updated = await prisma.location.update({
      where: { id: req.params.id },
      data: {
        ...(data.name        !== undefined && { name: data.name }),
        ...(data.addressLine !== undefined && { addressLine: toNull(data.addressLine) }),
        ...(data.city        !== undefined && { city: toNull(data.city) }),
        ...(data.state       !== undefined && { state: toNull(data.state) }),
        ...(data.country     !== undefined && { country: toNull(data.country) }),
        ...(data.isActive    !== undefined && { isActive: data.isActive }),
      },
    });
    res.json({ success: true, message: "Location updated.", data: updated });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ success: false, message: err.errors[0].message });
    console.error(err);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

// DELETE /api/locations/:id — admin only
router.delete("/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const loc = await prisma.location.findUnique({ where: { id: req.params.id } });
    if (!loc) return res.status(404).json({ success: false, message: "Location not found." });
    await prisma.location.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Location deleted." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

export default router;
