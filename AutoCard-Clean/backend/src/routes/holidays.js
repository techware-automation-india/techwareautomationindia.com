import { Router } from "express";
import { z } from "zod";
import prisma from "../prismaClient.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// Helper: Get fiscal year range (April 1 - March 31)
const getFiscalYearRange = (year) => {
  const startDate = new Date(`${year}-04-01T00:00:00.000Z`);
  const endDate = new Date(`${year + 1}-03-31T23:59:59.999Z`);
  return { startDate, endDate };
};

// Helper: Get current fiscal year
const getCurrentFiscalYear = () => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  return currentMonth <= 3 ? currentYear - 1 : currentYear;
};

// Validation schemas
const createHolidaySchema = z.object({
  name: z.string().min(2, "Holiday name must be at least 2 characters.").max(100),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid date format"),
  holidayType: z.enum(["NATIONAL", "FESTIVAL", "OPTIONAL"]).default("FESTIVAL"),
  isOptional: z.boolean().default(false),
  isRecurring: z.boolean().default(false),
  description: z.string().max(500).optional(),
});

const updateHolidaySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid date format").optional(),
  holidayType: z.enum(["NATIONAL", "FESTIVAL", "OPTIONAL"]).optional(),
  isOptional: z.boolean().optional(),
  isRecurring: z.boolean().optional(),
  description: z.string().max(500).optional(),
});

// GET /api/holidays - List all holidays (authenticated users)
router.get("/", requireAuth, async (req, res) => {
  console.log("📥 [GET /api/holidays] Request received");
  
  try {
    const { fiscalYear } = req.query;
    
    let holidays;
    if (fiscalYear) {
      // Get holidays for specific fiscal year
      const year = parseInt(fiscalYear);
      const { startDate, endDate } = getFiscalYearRange(year);
      
      holidays = await prisma.holiday.findMany({
        where: {
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: {
          date: "asc",
        },
      });
      console.log(`✅ [GET /api/holidays] Found ${holidays.length} holidays for fiscal year ${year}`);
    } else {
      // Get all holidays
      holidays = await prisma.holiday.findMany({
        orderBy: {
          date: "asc",
        },
      });
      console.log(`✅ [GET /api/holidays] Found ${holidays.length} total holidays`);
    }

    res.json({ holidays });
  } catch (err) {
    console.error("❌ [GET /api/holidays] Error:", err);
    res.status(500).json({ message: "Failed to load holidays." });
  }
});

// POST /api/holidays - Create a new holiday (Admin only)
router.post("/", requireAuth, requireRole("ADMIN"), async (req, res) => {
  console.log("📥 [POST /api/holidays] Request received:", JSON.stringify(req.body, null, 2));
  
  const parsed = createHolidaySchema.safeParse(req.body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    console.log("❌ [POST /api/holidays] Validation failed:", firstError.message);
    return res.status(400).json({ message: firstError.message });
  }

  try {
    const { name, date, holidayType, isOptional, isRecurring, description } = parsed.data;
    const holidayDate = new Date(date);

    // Check for duplicate
    const existing = await prisma.holiday.findUnique({
      where: { date: holidayDate },
    });

    if (existing) {
      return res.status(409).json({ 
        message: `A holiday already exists on ${holidayDate.toISOString().split('T')[0]}` 
      });
    }

    const holiday = await prisma.holiday.create({
      data: {
        name,
        date: holidayDate,
        holidayType,
        isOptional,
        isRecurring,
        description,
      },
    });

    console.log(`✅ [POST /api/holidays] Holiday created: ${name} on ${date}`);
    res.status(201).json({ holiday });
  } catch (err) {
    console.error("❌ [POST /api/holidays] Error:", err);
    res.status(500).json({ message: "Failed to create holiday." });
  }
});

// PUT /api/holidays/:id - Update a holiday (Admin only)
router.put("/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const { id } = req.params;
  console.log(`📥 [PUT /api/holidays/${id}] Request received:`, JSON.stringify(req.body, null, 2));
  
  const parsed = updateHolidaySchema.safeParse(req.body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    console.log(`❌ [PUT /api/holidays/${id}] Validation failed:`, firstError.message);
    return res.status(400).json({ message: firstError.message });
  }

  try {
    const updateData = { ...parsed.data };
    if (updateData.date) {
      updateData.date = new Date(updateData.date);
    }

    const holiday = await prisma.holiday.update({
      where: { id },
      data: updateData,
    });
    
    console.log(`✅ [PUT /api/holidays/${id}] Holiday updated successfully`);
    res.json({ holiday });
  } catch (err) {
    console.error(`❌ [PUT /api/holidays/${id}] Error:`, err);
    if (err.code === "P2025") {
      return res.status(404).json({ message: "Holiday not found." });
    }
    res.status(500).json({ message: "Failed to update holiday." });
  }
});

// DELETE /api/holidays/:id - Delete a holiday (Admin only)
router.delete("/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const { id } = req.params;
  console.log(`📥 [DELETE /api/holidays/${id}] Request received`);
  
  try {
    await prisma.holiday.delete({
      where: { id },
    });
    
    console.log(`✅ [DELETE /api/holidays/${id}] Holiday deleted successfully`);
    res.json({ message: "Holiday deleted successfully." });
  } catch (err) {
    console.error(`❌ [DELETE /api/holidays/${id}] Error:`, err);
    if (err.code === "P2025") {
      return res.status(404).json({ message: "Holiday not found." });
    }
    res.status(500).json({ message: "Failed to delete holiday." });
  }
});

// GET /api/holidays/fiscal-year - Get current fiscal year info
router.get("/fiscal-year", requireAuth, async (_req, res) => {
  try {
    const currentFiscalYear = getCurrentFiscalYear();
    const { startDate, endDate } = getFiscalYearRange(currentFiscalYear);
    
    res.json({
      currentFiscalYear,
      fiscalYearLabel: `${currentFiscalYear}-${currentFiscalYear + 1}`,
      startDate,
      endDate,
    });
  } catch (err) {
    console.error("❌ [GET /api/holidays/fiscal-year] Error:", err);
    res.status(500).json({ message: "Failed to get fiscal year info." });
  }
});

export default router;
