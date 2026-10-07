import { Router } from "express";
import { z } from "zod";
import prisma from "../prismaClient.js";
import { requireAuth } from "../middleware/auth.js";
import { checkRolePermission } from "../middleware/checkRolePermission.js";

const router = Router();

// All holiday routes require authentication
router.use(requireAuth);

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

// Helper: Normalize date to UTC start of day
const normalizeDate = (val) => {
  if (!val) return null;
  const str = typeof val === "string" ? val.slice(0, 10) : new Date(val).toISOString().slice(0, 10);
  return new Date(`${str}T00:00:00.000Z`);
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

// Helper: Auto-generate Sunday holidays for a date range
const getSundaysInRange = (startDate, endDate) => {
  const sundays = [];
  const cur = new Date(startDate);
  cur.setUTCHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setUTCHours(23, 59, 59, 999);

  while (cur <= end) {
    if (cur.getUTCDay() === 0) { // 0 = Sunday
      const dateStr = cur.toISOString().slice(0, 10);
      sundays.push({
        id: `sunday-${dateStr}`,
        name: "Sunday (Weekly Off)",
        date: new Date(cur),
        holidayType: "OPTIONAL",
        isOptional: true,
        isRecurring: true,
        description: "Auto-generated weekly off holiday",
      });
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return sundays;
};

// GET /api/holidays - List all holidays (authenticated users)
router.get("/", async (req, res) => {
  console.log("📥 [GET /api/holidays] Request received");
  
  try {
    const { fiscalYear, includeSundays } = req.query;
    const autoSundays = includeSundays !== "false";
    
    let holidays;
    let rangeStart;
    let rangeEnd;

    if (fiscalYear) {
      const year = parseInt(fiscalYear);
      const { startDate, endDate } = getFiscalYearRange(year);
      rangeStart = startDate;
      rangeEnd = endDate;
      
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
      console.log(`✅ [GET /api/holidays] Found ${holidays.length} DB holidays for fiscal year ${year}`);
    } else {
      const currentYear = getCurrentFiscalYear();
      const { startDate, endDate } = getFiscalYearRange(currentYear);
      rangeStart = startDate;
      rangeEnd = endDate;

      holidays = await prisma.holiday.findMany({
        orderBy: {
          date: "asc",
        },
      });
      console.log(`✅ [GET /api/holidays] Found ${holidays.length} total DB holidays`);
    }

    if (autoSundays && rangeStart && rangeEnd) {
      const dbDateKeys = new Set(
        holidays.map((h) => new Date(h.date).toISOString().slice(0, 10))
      );

      const generatedSundays = getSundaysInRange(rangeStart, rangeEnd).filter(
        (s) => !dbDateKeys.has(s.date.toISOString().slice(0, 10))
      );

      holidays = [...holidays, ...generatedSundays].sort(
        (a, b) => new Date(a.date) - new Date(b.date)
      );
    }

    res.json({ holidays });
  } catch (err) {
    console.error("❌ [GET /api/holidays] Error:", err);
    res.status(500).json({ message: "Failed to load holidays." });
  }
});

// GET /api/holidays/fiscal-year - Get current fiscal year info
router.get("/fiscal-year", async (_req, res) => {
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

// POST /api/holidays - Create a new holiday (Admin or with permission)
router.post("/", checkRolePermission(["holidays", "leave-policy", "attendance"]), async (req, res) => {
  console.log("📥 [POST /api/holidays] Request received:", JSON.stringify(req.body, null, 2));
  
  const parsed = createHolidaySchema.safeParse(req.body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    console.log("❌ [POST /api/holidays] Validation failed:", firstError.message);
    return res.status(400).json({ message: firstError.message });
  }

  try {
    const { name, date, holidayType, isOptional, isRecurring, description } = parsed.data;
    const holidayDate = normalizeDate(date);

    const existing = await prisma.holiday.findUnique({
      where: { date: holidayDate },
    });

    if (existing) {
      return res.status(409).json({ 
        message: `A holiday already exists on ${date.slice(0, 10)}` 
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
    if (err.code === "P2002") {
      return res.status(409).json({ message: "A holiday already exists on this date." });
    }
    res.status(500).json({ message: "Failed to create holiday." });
  }
});

// PUT /api/holidays/:id - Update a holiday (Admin or with permission)
router.put("/:id", checkRolePermission(["holidays", "leave-policy", "attendance"]), async (req, res) => {
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
      updateData.date = normalizeDate(updateData.date);
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
    if (err.code === "P2002") {
      return res.status(409).json({ message: "A holiday already exists on this date." });
    }
    res.status(500).json({ message: "Failed to update holiday." });
  }
});

// DELETE /api/holidays/:id - Delete a holiday (Admin or with permission)
router.delete("/:id", checkRolePermission(["holidays", "leave-policy", "attendance"]), async (req, res) => {
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

export default router;
