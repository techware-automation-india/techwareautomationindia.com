import { Router } from "express";
import { z } from "zod";
import prisma from "../prismaClient.js";
import { requireAuth } from "../middleware/auth.js";
import { checkRolePermission } from "../middleware/checkRolePermission.js";
import { sendRosterAssignmentEmail } from "../utils/emailService.js";

const router = Router();

// All routes require authentication
router.use(requireAuth);

router.get("/me", requireAuth, async (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const month = parseInt(req.query.month) || new Date().getMonth() + 1;

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return res.status(400).json({ message: "Valid year and month (1-12) are required." });
  }

  try {
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: req.user.id },
      include: {
        shift: true,
        location: true,
      },
    });
    if (!profile) {
      return res.status(404).json({ message: "Employee profile not found." });
    }

    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));

    const [defaultShift, defaultLocation] = await Promise.all([
      prisma.shift.findFirst({ where: { isDefault: true, isActive: true } }) || prisma.shift.findFirst({ where: { isActive: true } }),
      prisma.location.findFirst({ where: { isDefault: true, isActive: true } }) || prisma.location.findFirst({ where: { isActive: true } }),
    ]);

    const entries = await prisma.rosterEntry.findMany({
      where: { employeeId: profile.id, date: { gte: start, lt: end } },
      include: includeRelations,
      orderBy: [{ date: "asc" }],
    });

    const populatedEntries = entries.map((entry) => ({
      ...entry,
      shift: entry.shift || profile.shift || defaultShift || null,
      location: entry.location || profile.location || defaultLocation || null,
    }));

    res.json({
      entries: populatedEntries,
      year,
      month,
      assignedShift: profile.shift || defaultShift || null,
      assignedLocation: profile.location || defaultLocation || null,
    });
  } catch (err) {
    console.error("Roster /me error:", err);
    res.status(500).json({ message: "Failed to load your roster." });
  }
});

// GET /api/roster/my-notifications - latest roster assignments for the employee.
router.get("/my-notifications", requireAuth, async (req, res) => {
  try {
    const profile = await prisma.employeeProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile) {
      return res.status(404).json({ message: "Employee profile not found." });
    }

    const entries = await prisma.rosterEntry.findMany({
      where: { employeeId: profile.id },
      include: { shift: true, location: true },
      orderBy: { updatedAt: "desc" },
      take: 10,
    });

    res.json({ entries });
  } catch (err) {
    console.error("Roster notifications error:", err);
    res.status(500).json({ message: "Failed to load roster notifications." });
  }
});

const rosterEntrySchema = z
  .object({
    employeeId: z.string().min(1, "Employee is required."),
    date:       z.string().min(1, "Date is required."),
    shiftId:    z.string().optional().or(z.literal("")),
    locationId: z.string().optional().or(z.literal("")),
    note:       z.string().trim().max(300).optional().or(z.literal("")),
  });

const bulkSchema = z.object({
  entries: z.array(rosterEntrySchema).min(1, "At least one entry required."),
});

const toNull = (v) => (!v || v === "" ? null : v);

const parseRosterDate = (dateString) => {
  const [year, month, day] = String(dateString).split("-").map(Number);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    throw new Error("Invalid roster date.");
  }

  return new Date(Date.UTC(year, month - 1, day));
};

const includeRelations = {
  employee: { include: { user: { select: { fullName: true, email: true } } } },
  shift:    true,
  location: true,
};

// GET /api/roster?year=YYYY&month=M&employeeId=
router.get("/", checkRolePermission("roster"), async (req, res) => {
  console.log("ðŸ“‹ [GET /roster] Request received, user:", req.user?.id, "role:", req.user?.role);
  const year  = parseInt(req.query.year)  || new Date().getFullYear();
  const month = parseInt(req.query.month) || new Date().getMonth() + 1;
  const employeeId = req.query.employeeId || undefined;

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end   = new Date(Date.UTC(year, month, 1));

  try {
    const where = {
      date: { gte: start, lt: end },
      ...(employeeId ? { employeeId } : {}),
    };

    const [defaultShift, defaultLocation] = await Promise.all([
      prisma.shift.findFirst({ where: { isDefault: true, isActive: true } }) || prisma.shift.findFirst({ where: { isActive: true } }),
      prisma.location.findFirst({ where: { isDefault: true, isActive: true } }) || prisma.location.findFirst({ where: { isActive: true } }),
    ]);

    const entries = await prisma.rosterEntry.findMany({
      where,
      include: includeRelations,
      orderBy: [{ date: "asc" }, { employee: { user: { fullName: "asc" } } }],
    });

    const populatedEntries = entries.map((entry) => ({
      ...entry,
      shift: entry.shift || entry.employee?.shift || defaultShift || null,
      location: entry.location || entry.employee?.location || defaultLocation || null,
    }));

    res.json({ entries: populatedEntries, year, month });
  } catch (err) {
    console.error("Roster GET error:", err);
    res.status(500).json({ message: "Failed to load roster." });
  }
});

// GET /api/roster/meta — returns employees with shift+location, all shifts, locations
router.get("/meta", checkRolePermission("roster"), async (_req, res) => {
  console.log("📋 [GET /roster/meta] Request received, user:", _req.user?.id, "role:", _req.user?.role);
  try {
    const [allProfiles, shifts, locations] = await Promise.all([
      prisma.employeeProfile.findMany({
        include: {
          user: {
            select: { 
              id: true, 
              fullName: true, 
              email: true, 
              role: true,
            },
          },
        },
        orderBy: [
          { employeeCode: "asc" },
          { firstName: "asc" },
        ],
      }),
      prisma.shift.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      prisma.location.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    ]);

    const employees = allProfiles.map((prof) => ({
      id: prof.user?.id || prof.userId,
      fullName: prof.user?.fullName || `${prof.firstName || ""} ${prof.lastName || ""}`.trim() || "Employee",
      email: prof.user?.email || "",
      employeeProfile: {
        id: prof.id,
        employeeCode: prof.employeeCode,
        shiftId: prof.shiftId,
        locationId: prof.locationId,
      },
    }));

    res.json({ employees, shifts, locations });
  } catch (err) {
    console.error("Roster meta error:", err);
    res.status(500).json({ message: "Failed to load meta data." });
  }
});

// POST /api/roster â€” create single entry
router.post("/", requireAuth, checkRolePermission("roster"), async (req, res) => {
  const parsed = rosterEntrySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });

  const { employeeId, date, shiftId, locationId, note } = parsed.data;

  try {
    const defaultShift = (await prisma.shift.findFirst({ where: { isDefault: true, isActive: true } })) || (await prisma.shift.findFirst({ where: { isActive: true } }));
    const defaultLocation = (await prisma.location.findFirst({ where: { isDefault: true, isActive: true } })) || (await prisma.location.findFirst({ where: { isActive: true } }));
    const empProfile = await prisma.employeeProfile.findUnique({ where: { id: employeeId } });
    const resolvedShiftId = shiftId?.trim() || empProfile?.shiftId || defaultShift?.id;
    const resolvedLocationId = locationId?.trim() || empProfile?.locationId || defaultLocation?.id || null;

    if (!resolvedShiftId) {
      return res.status(400).json({ message: "No active shift found to assign." });
    }

    const dateUTC = parseRosterDate(date);

    const entry = await prisma.rosterEntry.upsert({
      where: { employeeId_date: { employeeId, date: dateUTC } },
      create: { employeeId, date: dateUTC, shiftId: resolvedShiftId, locationId: toNull(resolvedLocationId), note: toNull(note) },
      update: { shiftId: resolvedShiftId, locationId: toNull(resolvedLocationId), note: toNull(note) },
      include: includeRelations,
    });

    // Send email notification to employee — non-fatal if it fails
    try {
      const empEmail = entry.employee?.user?.email;
      const empName  = entry.employee?.user?.fullName;
      if (empEmail && empName) {
        await sendRosterAssignmentEmail({
          employeeEmail: empEmail,
          employeeName:  empName,
          date:          entry.date,
          shiftName:     entry.shift?.name      ?? resolvedShiftId,
          startTime:     entry.shift?.startTime ?? "—",
          endTime:       entry.shift?.endTime   ?? "—",
          locationName:  entry.location?.name   ?? null,
          locationCity:  entry.location?.city   ?? null,
          note:          entry.note ?? null,
        });
      }
    } catch (emailErr) {
      console.warn("⚠️  Roster email notification failed:", emailErr.message);
    }

    res.status(201).json({ entry, message: "Roster entry saved." });
  } catch (err) {
    console.error("Roster POST error:", err);
    res.status(500).json({ message: "Failed to save roster entry." });
  }
});

// POST /api/roster/bulk — upsert many entries at once
router.post("/bulk", requireAuth, checkRolePermission("roster"), async (req, res) => {
  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });

  try {
    const defaultShift = (await prisma.shift.findFirst({ where: { isDefault: true, isActive: true } })) || (await prisma.shift.findFirst({ where: { isActive: true } }));
    const defaultLocation = (await prisma.location.findFirst({ where: { isDefault: true, isActive: true } })) || (await prisma.location.findFirst({ where: { isActive: true } }));
    const empIds = Array.from(new Set(parsed.data.entries.map((e) => e.employeeId)));
    const profiles = await prisma.employeeProfile.findMany({ where: { id: { in: empIds } } });
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    const ops = parsed.data.entries.map(({ employeeId, date, shiftId, locationId, note }) => {
      const dateUTC = parseRosterDate(date);
      const prof = profileMap.get(employeeId);
      const resolvedShiftId = shiftId?.trim() || prof?.shiftId || defaultShift?.id;
      const resolvedLocationId = locationId?.trim() || prof?.locationId || defaultLocation?.id || null;
      return prisma.rosterEntry.upsert({
        where: { employeeId_date: { employeeId, date: dateUTC } },
        create: { employeeId, date: dateUTC, shiftId: resolvedShiftId, locationId: toNull(resolvedLocationId), note: toNull(note) },
        update: { shiftId: resolvedShiftId, locationId: toNull(resolvedLocationId), note: toNull(note) },
      });
    });

    const results = await prisma.$transaction(ops);
    res.json({ count: results.length, message: `${results.length} entries saved.` });
  } catch (err) {
    console.error("Roster bulk error:", err);
    res.status(500).json({ message: "Failed to save roster entries." });
  }
});

// DELETE /api/roster/bulk-delete — delete ALL roster entries
// Using /bulk-delete instead of /all to avoid route conflict with /:id
router.delete(
  "/bulk-delete",
  requireAuth,
  checkRolePermission("roster"),
  async (req, res) => {
    try {
      const result = await prisma.rosterEntry.deleteMany({});

      res.json({
        count: result.count,
        message: `${result.count} roster ${
          result.count === 1 ? "entry" : "entries"
        } deleted successfully.`,
      });
    } catch (err) {
      console.error("Roster DELETE ALL error:", err);
      res.status(500).json({
        message: "Failed to delete all roster entries.",
      });
    }
  },
);

// DELETE /api/roster/:id
router.delete("/:id", requireAuth, checkRolePermission("roster"), async (req, res) => {
  try {
    await prisma.rosterEntry.delete({ where: { id: req.params.id } });
    res.json({ message: "Roster entry deleted." });
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ message: "Entry not found." });
    console.error("Roster DELETE error:", err);
    res.status(500).json({ message: "Failed to delete entry." });
  }
});

export default router;
