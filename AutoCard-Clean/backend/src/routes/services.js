import { Router } from "express";
import { z } from "zod";
import prisma from "../prismaClient.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdminOrModulePermission } from "../middleware/checkModulePermission.js";

const router = Router();

// Public endpoint - no auth required for customers to view services
// GET /api/services - List all active services
router.get("/", async (req, res) => {
  try {
    const services = await prisma.service.findMany({
      where: { isActive: true },
      orderBy: { orderIndex: "asc" },
    });

    const formatted = services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      features: JSON.parse(s.features || "[]"),
      price: s.price,
      category: s.category,
    }));

    res.json({ services: formatted });
  } catch (err) {
    console.error("Get services error:", err);
    res.status(500).json({ message: "Failed to load services." });
  }
});

// Admin routes - require authentication
router.use(requireAuth);

// GET /api/services/all - List all services (including inactive) - Admin only
router.get("/all", requireAdminOrModulePermission("services", "canView"), async (req, res) => {
  try {
    const services = await prisma.service.findMany({
      orderBy: { orderIndex: "asc" },
    });

    const formatted = services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      features: JSON.parse(s.features || "[]"),
      price: s.price,
      category: s.category,
      isActive: s.isActive,
      orderIndex: s.orderIndex,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));

    res.json({ services: formatted });
  } catch (err) {
    console.error("Get all services error:", err);
    res.status(500).json({ message: "Failed to load services." });
  }
});

// POST /api/services - Create new service (Admin only)
router.post("/", requireAdminOrModulePermission("services", "canCreate"), async (req, res) => {
  try {
    const serviceSchema = z.object({
      name: z.string().min(3, "Service name must be at least 3 characters.").max(200),
      description: z.string().min(10, "Description must be at least 10 characters."),
      features: z.array(z.string()).min(1, "At least one feature is required."),
      price: z.string().min(1, "Price is required."),
      category: z.string().optional(),
      isActive: z.boolean().default(true),
      orderIndex: z.number().default(0),
    });

    const parsed = serviceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const { features, ...serviceData } = parsed.data;

    const service = await prisma.service.create({
      data: {
        ...serviceData,
        features: JSON.stringify(features),
      },
    });

    res.status(201).json({
      service: {
        ...service,
        features: JSON.parse(service.features),
      },
    });
  } catch (err) {
    console.error("Create service error:", err);
    res.status(500).json({ message: "Failed to create service." });
  }
});

// PUT /api/services/:id - Update service (Admin only)
router.put("/:id", requireAdminOrModulePermission("services", "canEdit"), async (req, res) => {
  try {
    const { id } = req.params;

    const serviceSchema = z.object({
      name: z.string().min(3).max(200).optional(),
      description: z.string().min(10).optional(),
      features: z.array(z.string()).optional(),
      price: z.string().optional(),
      category: z.string().optional(),
      isActive: z.boolean().optional(),
      orderIndex: z.number().optional(),
    });

    const parsed = serviceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const { features, ...serviceData } = parsed.data;

    const updateData = {
      ...serviceData,
      ...(features && { features: JSON.stringify(features) }),
    };

    const service = await prisma.service.update({
      where: { id },
      data: updateData,
    });

    res.json({
      service: {
        ...service,
        features: JSON.parse(service.features),
      },
    });
  } catch (err) {
    console.error("Update service error:", err);
    if (err.code === "P2025") {
      return res.status(404).json({ message: "Service not found." });
    }
    res.status(500).json({ message: "Failed to update service." });
  }
});

// DELETE /api/services/:id - Delete service (Admin only)
router.delete("/:id", requireAdminOrModulePermission("services", "canDelete"), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.service.delete({
      where: { id },
    });

    res.json({ message: "Service deleted successfully." });
  } catch (err) {
    console.error("Delete service error:", err);
    if (err.code === "P2025") {
      return res.status(404).json({ message: "Service not found." });
    }
    res.status(500).json({ message: "Failed to delete service." });
  }
});

export default router;
