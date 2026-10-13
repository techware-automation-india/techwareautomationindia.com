import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import prisma from "../prismaClient.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { checkRolePermission } from "../middleware/checkRolePermission.js";

const router = Router();

// ═══════════════════════════════════════════════════════════════════════
// 1. FILE UPLOAD CONFIGURATION (Multer for Item Photos)
// ═══════════════════════════════════════════════════════════════════════
const uploadDir = path.resolve("uploads/inventory");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `item-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed."));
    }
  },
});

// Upload item photo endpoint
router.post("/upload", requireAuth, upload.single("photo"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }
    const photoUrl = `/uploads/inventory/${req.file.filename}`;
    res.json({ photoUrl, message: "Photo uploaded successfully." });
  } catch (err) {
    console.error("Upload failed:", err);
    res.status(500).json({ message: "Failed to upload photo." });
  }
});

// GET /inventory/assigned-users — Get users who have access to inventory submodules
router.get("/assigned-users", requireAuth, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        customRole: {
          select: {
            name: true,
            modules: {
              select: { moduleKey: true },
            },
          },
        },
      },
    });

    const inventoryInUsers = users
      .filter((u) => {
        if (u.role === "ADMIN") return true;
        const modKeys = u.customRole?.modules?.map((m) => m.moduleKey) || [];
        return modKeys.includes("inventory") || modKeys.includes("inventory-in");
      })
      .map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        roleName: u.customRole?.name || u.role,
      }));

    const inventoryOutUsers = users
      .filter((u) => {
        if (u.role === "ADMIN") return true;
        const modKeys = u.customRole?.modules?.map((m) => m.moduleKey) || [];
        return modKeys.includes("inventory") || modKeys.includes("inventory-out");
      })
      .map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        roleName: u.customRole?.name || u.role,
      }));

    res.json({
      inventoryInUsers,
      inventoryOutUsers,
    });
  } catch (err) {
    console.error("Failed to fetch assigned inventory users:", err);
    res.status(500).json({ message: "Failed to fetch assigned inventory users." });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 2. UNITS MANAGEMENT (Dynamic Custom Units)
// ═══════════════════════════════════════════════════════════════════════
const DEFAULT_UNITS = ["Nos", "Pcs", "Kg", "Meter", "Liter", "Box", "Set", "Roll", "Packet"];

// GET /inventory/units — List all custom & standard units
router.get("/units", requireAuth, async (req, res) => {
  try {
    let units = await prisma.inventoryUnit.findMany({
      orderBy: { name: "asc" },
    });

    // Seed default units if empty
    if (units.length === 0) {
      await prisma.inventoryUnit.createMany({
        data: DEFAULT_UNITS.map((u) => ({ name: u })),
        skipDuplicates: true,
      });
      units = await prisma.inventoryUnit.findMany({
        orderBy: { name: "asc" },
      });
    }

    res.json({ units });
  } catch (err) {
    console.error("Failed to fetch units:", err);
    res.status(500).json({ message: "Failed to load units." });
  }
});

// POST /inventory/units — Add a new custom unit
router.post("/units", requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Unit name is required." });
    }
    const trimmed = name.trim();
    const existing = await prisma.inventoryUnit.findUnique({
      where: { name: trimmed },
    });
    if (existing) {
      return res.json({ unit: existing, message: "Unit already exists." });
    }
    const unit = await prisma.inventoryUnit.create({
      data: { name: trimmed },
    });
    res.status(201).json({ unit, message: "Unit created successfully." });
  } catch (err) {
    console.error("Failed to create unit:", err);
    res.status(500).json({ message: "Failed to create unit." });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 3. CATEGORIES HIERARCHY (Up to 4 Levels)
// ═══════════════════════════════════════════════════════════════════════

// GET /inventory/categories — List categories with children count and items count
router.get("/categories", requireAuth, async (req, res) => {
  try {
    const { parentId, rootOnly } = req.query;

    let where = {};
    if (rootOnly === "true") {
      where = { parentId: null, level: 1 };
    } else if (parentId) {
      where = { parentId };
    }

    const categories = await prisma.inventoryCategory.findMany({
      where,
      include: {
        parent: {
          select: { id: true, name: true, code: true },
        },
        _count: {
          select: {
            children: true,
            items: true,
          },
        },
      },
      orderBy: [{ level: "asc" }, { name: "asc" }],
    });

    res.json({ categories });
  } catch (err) {
    console.error("Failed to fetch categories:", err);
    res.status(500).json({ message: "Failed to load categories." });
  }
});

// GET /inventory/categories/:id — Get category details with children & items
router.get("/categories/:id", requireAuth, async (req, res) => {
  try {
    const category = await prisma.inventoryCategory.findUnique({
      where: { id: req.params.id },
      include: {
        children: {
          include: {
            _count: { select: { children: true, items: true } },
          },
          orderBy: { name: "asc" },
        },
        items: {
          orderBy: { createdAt: "desc" },
        },
        parent: true,
      },
    });

    if (!category) {
      return res.status(404).json({ message: "Category not found." });
    }

    res.json({ category });
  } catch (err) {
    console.error("Failed to fetch category:", err);
    res.status(500).json({ message: "Failed to load category details." });
  }
});

// POST /inventory/categories — Create category (enforces max 4 levels)
router.post("/categories", requireAuth, checkRolePermission(["inventory", "inventory-in"]), async (req, res) => {
  try {
    const { name, code, description, parentId } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Category name is required." });
    }

    let level = 1;
    if (parentId) {
      const parent = await prisma.inventoryCategory.findUnique({
        where: { id: parentId },
      });
      if (!parent) {
        return res.status(404).json({ message: "Parent category not found." });
      }
      if (parent.level >= 4) {
        return res.status(400).json({
          message: "Maximum category depth of 4 levels reached. You cannot create a subcategory here.",
        });
      }
      level = parent.level + 1;
    }

    // Check code uniqueness if provided
    if (code && code.trim()) {
      const existingCode = await prisma.inventoryCategory.findUnique({
        where: { code: code.trim() },
      });
      if (existingCode) {
        return res.status(409).json({ message: `Category code "${code.trim()}" already exists.` });
      }
    }

    const category = await prisma.inventoryCategory.create({
      data: {
        name: name.trim(),
        code: code && code.trim() ? code.trim() : null,
        description: description ? description.trim() : null,
        level,
        parentId: parentId || null,
      },
    });

    res.status(201).json({ category, message: "Category created successfully." });
  } catch (err) {
    console.error("Failed to create category:", err);
    res.status(500).json({ message: "Failed to create category." });
  }
});

// PUT /inventory/categories/:id — Update category
router.put("/categories/:id", requireAuth, checkRolePermission(["inventory", "inventory-in"]), async (req, res) => {
  try {
    const { name, code, description } = req.body;
    const existing = await prisma.inventoryCategory.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      return res.status(404).json({ message: "Category not found." });
    }

    if (code && code.trim() && code.trim() !== existing.code) {
      const dup = await prisma.inventoryCategory.findUnique({
        where: { code: code.trim() },
      });
      if (dup) {
        return res.status(409).json({ message: `Category code "${code.trim()}" already exists.` });
      }
    }

    const category = await prisma.inventoryCategory.update({
      where: { id: req.params.id },
      data: {
        name: name !== undefined ? name.trim() : existing.name,
        code: code !== undefined ? (code && code.trim() ? code.trim() : null) : existing.code,
        description: description !== undefined ? (description ? description.trim() : null) : existing.description,
      },
    });

    res.json({ category, message: "Category updated successfully." });
  } catch (err) {
    console.error("Failed to update category:", err);
    res.status(500).json({ message: "Failed to update category." });
  }
});

// DELETE /inventory/categories/:id — Delete category (cascades subcategories)
router.delete("/categories/:id", requireAuth, checkRolePermission(["inventory", "inventory-in"]), async (req, res) => {
  try {
    const existing = await prisma.inventoryCategory.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      return res.status(404).json({ message: "Category not found." });
    }

    await prisma.inventoryCategory.delete({
      where: { id: req.params.id },
    });

    res.json({ message: "Category deleted successfully." });
  } catch (err) {
    console.error("Failed to delete category:", err);
    res.status(500).json({ message: "Failed to delete category." });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 4. ITEMS MANAGEMENT (Directly at Any Level, Photo, Code, 5 Specs)
// ═══════════════════════════════════════════════════════════════════════

// GET /inventory/items — Query items by category or root level
router.get("/items", requireAuth, async (req, res) => {
  try {
    const { categoryId, rootOnly, search } = req.query;

    let where = {};
    if (rootOnly === "true") {
      where.categoryId = null;
    } else if (categoryId) {
      where.categoryId = categoryId;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { code: { contains: q } },
        { sku: { contains: q } },
        { warehouse: { contains: q } },
        { location: { contains: q } },
        { description: { contains: q } },
      ];
    }

    const items = await prisma.inventoryItem.findMany({
      where,
      include: {
        categoryRef: {
          include: {
            parent: {
              include: {
                parent: {
                  include: {
                    parent: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ items });
  } catch (err) {
    console.error("Failed to list items:", err);
    res.status(500).json({ message: "Failed to load inventory items." });
  }
});

// POST /inventory/items — Create item with specs and photo
router.post("/items", requireAuth, checkRolePermission(["inventory", "inventory-in"]), async (req, res) => {
  try {
    const {
      name,
      code,
      sku,
      categoryId,
      photoUrl,
      specifications,
      quantity,
      unit,
      minStock,
      maxStock,
      location,
      warehouse,
      description,
      costPrice,
      companyName,
      date,
      createdByName,
    } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Item name is required." });
    }

    const itemCode = (code || sku || "").trim();
    if (!itemCode) {
      return res.status(400).json({ message: "Item code is required." });
    }

    if (/[_\-]/.test(itemCode)) {
      return res.status(400).json({
        message: "Item Code / SKU cannot contain hyphen (-) or underscore (_) characters.",
      });
    }

    if (quantity !== undefined && (!Number.isFinite(Number(quantity)) || Number(quantity) < 0)) {
      return res.status(400).json({ message: "Quantity must be a valid number greater than or equal to zero." });
    }

    const dup = await prisma.inventoryItem.findFirst({
      where: {
        OR: [{ code: itemCode }, { sku: itemCode }],
      },
    });
    if (dup) {
      return res.status(409).json({ message: `Item Code / SKU "${itemCode}" already exists.` });
    }

    // Resolve author name and ID
    let authorName = (createdByName || "").trim();
    const authorId = req.user?.id || null;
    if (!authorName && authorId) {
      const u = await prisma.user.findUnique({
        where: { id: authorId },
        select: { fullName: true, email: true },
      });
      authorName = u?.fullName || u?.email || "Admin";
    }
    if (!authorName) {
      authorName = "Admin";
    }

    // Ensure specifications is valid JSON/array (No limitation on specifications count)
    let parsedSpecs = [];
    if (Array.isArray(specifications)) {
      parsedSpecs = specifications.filter((s) => s && s.key && s.key.trim());
    }

    const item = await prisma.inventoryItem.create({
      data: {
        name: name.trim(),
        code: itemCode || null,
        sku: itemCode || null,
        categoryId: categoryId || null,
        photoUrl: photoUrl || null,
        specifications: parsedSpecs,
        quantity: quantity !== undefined ? Number(quantity) : 0,
        unit: unit && unit.trim() ? unit.trim() : "Nos",
        minStock: minStock !== undefined && minStock !== "" ? Number(minStock) : 5,
        maxStock: maxStock !== undefined && maxStock !== "" ? Number(maxStock) : 100,
        location: location ? location.trim() : null,
        warehouse: warehouse ? warehouse.trim() : null,
        description: description ? description.trim() : null,
        costPrice: costPrice !== undefined && costPrice !== "" ? Number(costPrice) : null,
        companyName: companyName ? companyName.trim() : null,
        date: date ? new Date(date) : null,
        createdByName: authorName,
        createdById: authorId,
      },
      include: { categoryRef: true },
    });

    res.status(201).json({ item, message: "Inventory item created successfully." });
  } catch (err) {
    console.error("Failed to create item:", err);
    res.status(500).json({ message: "Failed to create item." });
  }
});

// PUT /inventory/items/:id — Update item
router.put("/items/:id", requireAuth, checkRolePermission(["inventory", "inventory-in"]), async (req, res) => {
  try {
    const existing = await prisma.inventoryItem.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      return res.status(404).json({ message: "Item not found." });
    }

    const {
      name,
      code,
      sku,
      categoryId,
      photoUrl,
      specifications,
      quantity,
      unit,
      minStock,
      maxStock,
      location,
      warehouse,
      description,
      costPrice,
      companyName,
      date,
      createdByName,
    } = req.body;

    if (quantity !== undefined && (!Number.isFinite(Number(quantity)) || Number(quantity) < 0)) {
      return res.status(400).json({ message: "Quantity must be a valid number greater than or equal to zero." });
    }

    if (name !== undefined && (!name || typeof name !== "string" || !name.trim())) {
      return res.status(400).json({ message: "Item name cannot be empty." });
    }

    const itemCode = (code !== undefined ? code : sku !== undefined ? sku : existing.code || existing.sku || "").trim();
    if ((code !== undefined || sku !== undefined) && !itemCode) {
      return res.status(400).json({ message: "Item code cannot be empty." });
    }

    if (itemCode && /[_\-]/.test(itemCode)) {
      return res.status(400).json({
        message: "Item Code / SKU cannot contain hyphen (-) or underscore (_) characters.",
      });
    }

    if (itemCode && itemCode !== existing.code && itemCode !== existing.sku) {
      const dup = await prisma.inventoryItem.findFirst({
        where: {
          id: { not: req.params.id },
          OR: [{ code: itemCode }, { sku: itemCode }],
        },
      });
      if (dup) {
        return res.status(409).json({ message: `Item Code / SKU "${itemCode}" already exists.` });
      }
    }

    let parsedSpecs = existing.specifications;
    if (Array.isArray(specifications)) {
      parsedSpecs = specifications.filter((s) => s && s.key && s.key.trim());
    }

    const item = await prisma.inventoryItem.update({
      where: { id: req.params.id },
      data: {
        name: name !== undefined ? name.trim() : existing.name,
        code: itemCode || null,
        sku: itemCode || null,
        categoryId: categoryId !== undefined ? categoryId : existing.categoryId,
        photoUrl: photoUrl !== undefined ? photoUrl : existing.photoUrl,
        specifications: parsedSpecs,
        quantity: quantity !== undefined ? Number(quantity) : existing.quantity,
        unit: unit !== undefined ? unit.trim() : existing.unit,
        minStock: minStock !== undefined && minStock !== "" ? Number(minStock) : existing.minStock,
        maxStock: maxStock !== undefined && maxStock !== "" ? Number(maxStock) : (existing.maxStock ?? 100),
        location: location !== undefined ? (location ? location.trim() : null) : existing.location,
        warehouse: warehouse !== undefined ? (warehouse ? warehouse.trim() : null) : existing.warehouse,
        description: description !== undefined ? (description ? description.trim() : null) : existing.description,
        costPrice: costPrice !== undefined ? (costPrice !== "" ? Number(costPrice) : null) : existing.costPrice,
        companyName: companyName !== undefined ? (companyName ? companyName.trim() : null) : existing.companyName,
        date: date !== undefined ? (date ? new Date(date) : null) : existing.date,
        createdByName: createdByName !== undefined ? (createdByName ? createdByName.trim() : null) : existing.createdByName,
      },
      include: { categoryRef: true },
    });

    res.json({ item, message: "Inventory item updated successfully." });
  } catch (err) {
    console.error("Failed to update item:", err);
    res.status(500).json({ message: "Failed to update item." });
  }
});

// DELETE /inventory/items/:id — Delete item
router.delete("/items/:id", requireAuth, checkRolePermission(["inventory", "inventory-in"]), async (req, res) => {
  try {
    const existing = await prisma.inventoryItem.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      return res.status(404).json({ message: "Item not found." });
    }

    await prisma.inventoryItem.delete({
      where: { id: req.params.id },
    });

    res.json({ message: "Item deleted successfully." });
  } catch (err) {
    console.error("Failed to delete item:", err);
    res.status(500).json({ message: "Failed to delete item." });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 5. LEGACY GET /inventory — List all items (for backward compatibility)
// ═══════════════════════════════════════════════════════════════════════
router.get("/", requireAuth, async (req, res) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      include: {
        categoryRef: {
          include: {
            parent: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });
    res.json({ items });
  } catch (err) {
    console.error("Failed to list inventory:", err);
    res.status(500).json({ message: "Failed to load inventory." });
  }
});

// GET /inventory/:id — Get single item
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: req.params.id },
      include: { categoryRef: true },
    });
    if (!item) return res.status(404).json({ message: "Item not found." });
    res.json({ item });
  } catch (err) {
    console.error("Failed to get inventory item:", err);
    res.status(500).json({ message: "Failed to load item." });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 6. PRODUCT ISSUANCE / ALLOCATIONS
// ═══════════════════════════════════════════════════════════════════════
const issueSchema = z.object({
  inventoryItemId: z.string().optional().nullable(),
  itemName: z.string().min(1, "Item name is required"),
  itemSku: z.string().optional().nullable(),
  issuedToPerson: z.string().min(1, "Recipient person name is required"),
  issuedToCompany: z.string().min(1, "Company / Project name is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  issueDate: z.string().or(z.date()).optional().nullable().transform((val) => (val ? new Date(val) : new Date())),
  status: z.enum(["ISSUED", "RETURNED", "CONSUMED", "DAMAGED"]).default("ISSUED"),
  notes: z.string().optional().nullable(),
});

router.get("/issues/all", requireAuth, async (req, res) => {
  try {
    const issues = await prisma.inventoryIssue.findMany({
      include: { inventoryItem: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ issues });
  } catch (err) {
    console.error("Failed to list issues:", err);
    res.status(500).json({ message: "Failed to load issued products." });
  }
});

router.post("/issues", requireAuth, checkRolePermission(["inventory", "inventory-out"]), async (req, res) => {
  try {
    const parsed = issueSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return res.status(400).json({ message: msg });
    }
    const data = parsed.data;

    if (data.inventoryItemId) {
      const item = await prisma.inventoryItem.findUnique({ where: { id: data.inventoryItemId } });
      if (!item) return res.status(404).json({ message: "Selected inventory item not found." });
      if (item.quantity < data.quantity) {
        return res.status(400).json({
          message: `Insufficient stock. Only ${item.quantity} units available, but ${data.quantity} requested.`,
        });
      }
      await prisma.inventoryItem.update({
        where: { id: data.inventoryItemId },
        data: { quantity: item.quantity - data.quantity },
      });
    }

    const issue = await prisma.inventoryIssue.create({
      data: {
        inventoryItemId: data.inventoryItemId || null,
        itemName: data.itemName,
        assignedToPerson: data.issuedToPerson,
        companyName: data.issuedToCompany,
        quantity: data.quantity,
        issueDate: data.issueDate || new Date(),
        status: data.status || "ISSUED",
        notes: data.notes || null,
      },
      include: { inventoryItem: true },
    });

    res.status(201).json({ issue, message: "Product issued successfully." });
  } catch (err) {
    console.error("Failed to issue product:", err);
    res.status(500).json({ message: "Failed to issue product." });
  }
});

router.put("/issues/:id", requireAuth, checkRolePermission(["inventory", "inventory-out"]), async (req, res) => {
  try {
    const existing = await prisma.inventoryIssue.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: "Issue record not found." });

    const parsed = issueSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ");
      return res.status(400).json({ message: msg });
    }
    const data = parsed.data;

    if (data.status === "RETURNED" && existing.status !== "RETURNED") {
      if (existing.inventoryItemId) {
        await prisma.inventoryItem.update({
          where: { id: existing.inventoryItemId },
          data: { quantity: { increment: existing.quantity } },
        });
      } else {
        const matchedItem = await prisma.inventoryItem.findFirst({
          where: {
            OR: [
              { name: { equals: existing.itemName } },
              { code: { equals: existing.itemName } },
            ],
          },
        });
        if (matchedItem) {
          await prisma.inventoryItem.update({
            where: { id: matchedItem.id },
            data: { quantity: { increment: existing.quantity } },
          });
          data.inventoryItemId = matchedItem.id;
        } else {
          let uniqueCode = `RET${Date.now().toString().slice(-6)}`;
          const created = await prisma.inventoryItem.create({
            data: {
              name: existing.itemName,
              code: uniqueCode,
              sku: uniqueCode,
              quantity: existing.quantity,
              unit: "Nos",
              description: `Auto-restocked from Returned Material Outward / Issue (${existing.id})`,
              date: new Date(),
              createdByName: existing.assignedToPerson || "Admin",
            },
          });
          data.inventoryItemId = created.id;
        }
      }
      data.returnDate = new Date();
    }

    const issue = await prisma.inventoryIssue.update({
      where: { id: req.params.id },
      data: {
        ...(data.inventoryItemId !== undefined && { inventoryItemId: data.inventoryItemId || null }),
        ...(data.itemName !== undefined && { itemName: data.itemName }),
        ...(data.issuedToPerson !== undefined && { assignedToPerson: data.issuedToPerson }),
        ...(data.issuedToCompany !== undefined && { companyName: data.issuedToCompany }),
        ...(data.quantity !== undefined && { quantity: data.quantity }),
        ...(data.issueDate !== undefined && { issueDate: data.issueDate }),
        ...(data.returnDate !== undefined && { returnDate: data.returnDate }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
      include: { inventoryItem: true },
    });

    res.json({ issue, message: "Product issue record updated." });
  } catch (err) {
    console.error("Failed to update issue:", err);
    res.status(500).json({ message: "Failed to update issue record." });
  }
});

router.delete("/issues/:id", requireAuth, checkRolePermission(["inventory", "inventory-out"]), async (req, res) => {
  try {
    const existing = await prisma.inventoryIssue.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: "Issue record not found." });
    await prisma.inventoryIssue.delete({ where: { id: req.params.id } });
    res.json({ message: "Issue record deleted successfully." });
  } catch (err) {
    console.error("Failed to delete issue:", err);
    res.status(500).json({ message: "Failed to delete issue record." });
  }
});

export default router;
