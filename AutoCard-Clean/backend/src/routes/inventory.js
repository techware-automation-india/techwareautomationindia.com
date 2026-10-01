import { Router } from "express";
import { z } from "zod";
import prisma from "../prismaClient.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// ── Validation schemas ──────────────────────────────────────────────────────
const itemSchema = z.object({
  name: z.string().min(1, "Item name is required").max(200),
  sku: z.string().max(50).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  companyName: z.string().max(200).optional().nullable(),
  date: z.string().or(z.date()).optional().nullable().transform((val) => (val ? new Date(val) : null)),
  quantity: z.number().int().min(0).default(0),
  minStock: z.number().int().min(0).default(5),
  unit: z.string().max(20).default("pcs"),
  location: z.string().max(200).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  costPrice: z.number().min(0).optional().nullable(),
});

// ── GET /inventory — list all items ─────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      orderBy: { name: "asc" },
    });
    res.json({ items });
  } catch (err) {
    console.error("Failed to list inventory:", err);
    res.status(500).json({ message: "Failed to load inventory." });
  }
});

// ── GET /inventory/:id — get single item ────────────────────────────────────
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: req.params.id },
    });
    if (!item) return res.status(404).json({ message: "Item not found." });
    res.json({ item });
  } catch (err) {
    console.error("Failed to get inventory item:", err);
    res.status(500).json({ message: "Failed to load item." });
  }
});

// ── POST /inventory — create item (Admin only) ─────────────────────────────
router.post("/", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const parsed = itemSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return res.status(400).json({ message: msg });
    }

    const data = parsed.data;

    // Check for duplicate SKU
    if (data.sku) {
      const existing = await prisma.inventoryItem.findUnique({ where: { sku: data.sku } });
      if (existing) {
        return res.status(409).json({ message: `SKU "${data.sku}" already exists.` });
      }
    }

    const item = await prisma.inventoryItem.create({ data });
    res.status(201).json({ item, message: "Item created successfully." });
  } catch (err) {
    console.error("Failed to create inventory item:", err);
    res.status(500).json({ message: "Failed to create item." });
  }
});

// ── PUT /inventory/:id — update item (Admin only) ───────────────────────────
router.put("/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const existing = await prisma.inventoryItem.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: "Item not found." });

    const parsed = itemSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return res.status(400).json({ message: msg });
    }

    const data = parsed.data;

    // Check for duplicate SKU (exclude current item)
    if (data.sku) {
      const dup = await prisma.inventoryItem.findFirst({
        where: { sku: data.sku, NOT: { id: req.params.id } },
      });
      if (dup) {
        return res.status(409).json({ message: `SKU "${data.sku}" already exists.` });
      }
    }

    const item = await prisma.inventoryItem.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ item, message: "Item updated successfully." });
  } catch (err) {
    console.error("Failed to update inventory item:", err);
    res.status(500).json({ message: "Failed to update item." });
  }
});

// ── DELETE /inventory/:id — delete item (Admin only) ────────────────────────
router.delete("/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const existing = await prisma.inventoryItem.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: "Item not found." });

    await prisma.inventoryItem.delete({ where: { id: req.params.id } });
    res.json({ message: "Item deleted successfully." });
  } catch (err) {
    console.error("Failed to delete inventory item:", err);
    res.status(500).json({ message: "Failed to delete item." });
  }
});

// ── Validation Schema for Product Issue ─────────────────────────────────────
const issueSchema = z.object({
  inventoryItemId: z.string().optional().nullable(),
  itemName: z.string().min(1, "Item name is required"),
  assignedToPerson: z.string().min(1, "Person name is required"),
  companyName: z.string().optional().nullable(),
  projectName: z.string().optional().nullable(),
  quantity: z.number().int().min(1).default(1),
  issueDate: z.string().or(z.date()).optional().nullable().transform((val) => (val ? new Date(val) : new Date())),
  status: z.enum(["ISSUED", "RETURNED", "DISPATCHED"]).default("ISSUED"),
  notes: z.string().optional().nullable(),
});

// ── GET /inventory/issues — List all product allocations ───────────────────
router.get("/issues/all", requireAuth, async (req, res) => {
  try {
    const issues = await prisma.inventoryIssue.findMany({
      include: {
        inventoryItem: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ issues });
  } catch (err) {
    console.error("Failed to list inventory issues:", err);
    res.status(500).json({ message: "Failed to load product issues." });
  }
});

// ── POST /inventory/issues — Issue/Give product to person & company ────────
router.post("/issues", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const parsed = issueSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return res.status(400).json({ message: msg });
    }

    const data = parsed.data;

    // Check stock if inventoryItemId is linked
    if (data.inventoryItemId) {
      const item = await prisma.inventoryItem.findUnique({
        where: { id: data.inventoryItemId },
      });
      if (!item) {
        return res.status(404).json({ message: "Selected inventory item not found." });
      }
      if (item.quantity < data.quantity) {
        return res.status(400).json({
          message: `Insufficient stock. Only ${item.quantity} units available, but ${data.quantity} requested.`,
        });
      }

      // Deduct quantity from inventory item stock
      await prisma.inventoryItem.update({
        where: { id: data.inventoryItemId },
        data: {
          quantity: item.quantity - data.quantity,
        },
      });
    }

    const issue = await prisma.inventoryIssue.create({
      data: {
        inventoryItemId: data.inventoryItemId || null,
        itemName: data.itemName,
        assignedToPerson: data.assignedToPerson,
        companyName: data.companyName || null,
        projectName: data.projectName || null,
        quantity: data.quantity,
        issueDate: data.issueDate || new Date(),
        status: data.status || "ISSUED",
        notes: data.notes || null,
      },
      include: {
        inventoryItem: true,
      },
    });

    res.status(201).json({ issue, message: "Product issued successfully." });
  } catch (err) {
    console.error("Failed to create product issue:", err);
    res.status(500).json({ message: "Failed to issue product." });
  }
});

// ── PUT /inventory/issues/:id — Update issue status (e.g. Return item) ──────
router.put("/issues/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const existing = await prisma.inventoryIssue.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) return res.status(404).json({ message: "Issue record not found." });

    const parsed = issueSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return res.status(400).json({ message: msg });
    }

    const data = parsed.data;

    // If status changes to RETURNED and was ISSUED, restore stock quantity
    if (data.status === "RETURNED" && existing.status !== "RETURNED" && existing.inventoryItemId) {
      await prisma.inventoryItem.update({
        where: { id: existing.inventoryItemId },
        data: {
          quantity: { increment: existing.quantity },
        },
      });
      data.returnDate = new Date();
    }

    const issue = await prisma.inventoryIssue.update({
      where: { id: req.params.id },
      data,
      include: {
        inventoryItem: true,
      },
    });

    res.json({ issue, message: "Product issue record updated." });
  } catch (err) {
    console.error("Failed to update product issue:", err);
    res.status(500).json({ message: "Failed to update record." });
  }
});

// ── DELETE /inventory/issues/:id — Delete issue record ──────────────────────
router.delete("/issues/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const existing = await prisma.inventoryIssue.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) return res.status(404).json({ message: "Issue record not found." });

    await prisma.inventoryIssue.delete({ where: { id: req.params.id } });
    res.json({ message: "Issue record deleted successfully." });
  } catch (err) {
    console.error("Failed to delete issue record:", err);
    res.status(500).json({ message: "Failed to delete record." });
  }
});

export default router;
