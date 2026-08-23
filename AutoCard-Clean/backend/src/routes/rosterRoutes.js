import { Router } from "express";
import { z } from "zod";
import prisma from "../prismaClient.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdminOrModulePermission } from "../middleware/checkModulePermission.js";
import { sendRosterAssignmentEmail } from "../utils/emailService.js";

const router = Router();

router.get("/me", requireAuth, async (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const month = parseInt(req.query.month) || new Date().getMonth() + 1;

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return res.status(400).json({ message: "Valid year and month (1-12) are required." });
  }

  try {
    const profile = await prisma.employeeProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile) {
      return res.status(404).json({ message: "Employee profile not found." });
    }

    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));

    const entries = await prisma.rosterEntry.findMany({
      where: { employeeId: profile.id, date: { gte: start, lt: end } },
      include: includeRelations,
      orderBy: [{ date: "asc" }],
    });

    res.json({ entries, year, month });
  } catch (err) {
    console.error("Roster /me error:", err);
    res.status(500).json({ message: "Failed to load your roster." });
  }
});

const rosterEntrySchema = z.object({
  employeeId: z.string().min(1, "Employee is required."),
  date:       z.string().min(1, "Date is required."),
  shiftId:    z.string().min(1, "Shift is required."),
  locationId: z.string().optional().or(z.literal("")),
  note:       z.string().trim().max(300).optional().or(z.literal("")),
});

const bulkSchema = z.object({
  entries: z.array(rosterEntrySchema).min(1, "At least one entry required."),
});

const toNull = (v) => (!v || v === "" ? null : v);

const includeRelations = {
  employee: { include: { user: { select: { fullName: true, email: true } } } },
  shift:    true,
  location: true,
};

// GET /api/roster?year=YYYY&month=M&employeeId=
router.get("/", requireAdminOrModulePermission("roster", "canView"), async (req, res) => {
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

    const entries = await prisma.rosterEntry.findMany({
      where,
      include: includeRelations,
      orderBy: [{ date: "asc" }, { employee: { user: { fullName: "asc" } } }],
    });

    res.json({ entries, year, month });
  } catch (err) {
    console.error("Roster GET error:", err);
    res.status(500).json({ message: "Failed to load roster." });
  }
});

// GET /api/roster/meta — returns all employees, shifts, locations for dropdowns
router.get("/meta", requireAdminOrModulePermission("roster", "canView"), async (_req, res) => {
  try {
    const [employees, shifts, locations] = await Promise.all([
      prisma.user.findMany({
        where: { role: "EMPLOYEE" },
        select: { id: true, fullName: true, email: true, employeeProfile: { select: { id: true, employeeCode: true } } },
        orderBy: { fullName: "asc" },
      }),
      prisma.shift.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      prisma.location.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    ]);
    res.json({ employees, shifts, locations });
  } catch (err) {
    console.error("Roster meta error:", err);
    res.status(500).json({ message: "Failed to load meta data." });
  }
});

// POST /api/roster — create single entry
router.post("/", requireAdminOrModulePermission("roster", "canCreate"), async (req, res) => {
  const parsed = rosterEntrySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });

  const { employeeId, date, shiftId, locationId, note } = parsed.data;

  try {
    const dateUTC = new Date(Date.UTC(
      new Date(date).getUTCFullYear(),
      new Date(date).getUTCMonth(),
      new Date(date).getUTCDate(),
    ));

    const entry = await prisma.rosterEntry.upsert({
      where: { employeeId_date: { employeeId, date: dateUTC } },
      create: { employeeId, date: dateUTC, shiftId, locationId: toNull(locationId), note: toNull(note) },
      update: { shiftId, locationId: toNull(locationId), note: toNull(note) },
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
          shiftName:     entry.shift?.name      ?? shiftId,
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
router.post("/bulk", requireAdminOrModulePermission("roster", "canCreate"), async (req, res) => {
  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });

  try {
    const ops = parsed.data.entries.map(({ employeeId, date, shiftId, locationId, note }) => {
      const dateUTC = new Date(Date.UTC(
        new Date(date).getUTCFullYear(),
        new Date(date).getUTCMonth(),
        new Date(date).getUTCDate(),
      ));
      return prisma.rosterEntry.upsert({
        where: { employeeId_date: { employeeId, date: dateUTC } },
        create: { employeeId, date: dateUTC, shiftId, locationId: toNull(locationId), note: toNull(note) },
        update: { shiftId, locationId: toNull(locationId), note: toNull(note) },
      });
    });

    const results = await prisma.$transaction(ops);
    res.json({ count: results.length, message: `${results.length} entries saved.` });
  } catch (err) {
    console.error("Roster bulk error:", err);
    res.status(500).json({ message: "Failed to save roster entries." });
  }
});

// DELETE /api/roster/:id
router.delete("/:id", requireAdminOrModulePermission("roster", "canDelete"), async (req, res) => {
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
