import { Router } from "express";
import prisma from "../prismaClient.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

const calculateWorkedHours = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return null;
  const workedMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  if (workedMs < 0) return 0;
  return parseFloat((workedMs / (1000 * 60 * 60)).toFixed(2));
};

// ============================================================================
// EMPLOYEE SELF-SERVICE ROUTES  (requireAuth only, no role guard)
// ============================================================================

// GET /api/attendance/me?year=YYYY&month=M
// Returns the calling employee's own monthly attendance + summary.
router.get("/me", requireAuth, async (req, res) => {
  const year  = Number(req.query.year);
  const month = Number(req.query.month); // 1-12

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return res.status(400).json({ message: "Valid year and month (1-12) are required." });
  }

  try {
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!profile) {
      return res.status(404).json({ message: "Employee profile not found." });
    }

    const start = new Date(Date.UTC(year, month - 1, 1));
    const end   = new Date(Date.UTC(year, month, 1));

    const [records, holidays] = await Promise.all([
      prisma.attendance.findMany({
        where: { employeeId: profile.id, date: { gte: start, lt: end } },
        orderBy: { date: "asc" },
      }),
      prisma.holiday.findMany({
        where: { date: { gte: start, lt: end } },
      }),
    ]);

    const summary = { PRESENT: 0, ABSENT: 0, LATE: 0, HALF_DAY: 0, ON_LEAVE: 0, HOLIDAY: 0 };
    for (const r of records) {
      if (summary[r.status] !== undefined) summary[r.status] += 1;
    }

    res.json({
      year, month,
      records: records.map((r) => ({
        id: r.id, date: r.date,
        checkIn: r.checkIn, checkOut: r.checkOut,
        status: r.status,
        workedHours: r.workedHours ?? calculateWorkedHours(r.checkIn, r.checkOut),
        note: r.note,
      })),
      holidays: holidays.map((h) => ({ date: h.date, name: h.name })),
      summary,
    });
  } catch (err) {
    console.error("Employee get own attendance error:", err);
    res.status(500).json({ message: "Failed to load attendance." });
  }
});

// GET /api/attendance/me/today  — today's record (or null)
router.get("/me/today", requireAuth, async (req, res) => {
  try {
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!profile) return res.status(404).json({ message: "Employee profile not found." });

    // Today midnight UTC
    const now   = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

    const record = await prisma.attendance.findFirst({
      where: { employeeId: profile.id, date: { gte: today, lt: tomorrow } },
    });

    res.json({ record: record ?? null });
  } catch (err) {
    console.error("Employee get today attendance error:", err);
    res.status(500).json({ message: "Failed to load today's attendance." });
  }
});

// POST /api/attendance/checkin
router.post("/checkin", requireAuth, requireRole("EMPLOYEE"), async (req, res) => {
  try {
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!profile) return res.status(404).json({ message: "Employee profile not found." });
    if (profile.onboardingStatus !== "APPROVED") {
      return res.status(403).json({ message: "Your onboarding must be approved before marking attendance." });
    }

    const now   = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

    const existing = await prisma.attendance.findFirst({
      where: { employeeId: profile.id, date: { gte: today, lt: tomorrow } },
    });

    if (existing) {
      return res.status(400).json({ message: "You have already checked in today." });
    }

    // Always mark as PRESENT — no time-based late detection
    const status = "PRESENT";

    const { location } = req.body; // optional string

    const record = await prisma.attendance.create({
      data: {
        employeeId: profile.id,
        date: today,
        checkIn: now,
        status,
        note: location ? `Checkin: ${location}` : undefined,
      },
    });

    res.json({ record, message: "Checked in successfully." });
  } catch (err) {
    console.error("Check-in error:", err);
    res.status(500).json({ message: "Failed to check in." });
  }
});

// POST /api/attendance/checkout
router.post("/checkout", requireAuth, requireRole("EMPLOYEE"), async (req, res) => {
  try {
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!profile) return res.status(404).json({ message: "Employee profile not found." });

    const now   = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

    const record = await prisma.attendance.findFirst({
      where: { employeeId: profile.id, date: { gte: today, lt: tomorrow } },
    });

    if (!record) {
      return res.status(400).json({ message: "No check-in found for today. Please check in first." });
    }
    if (record.checkOut) {
      return res.status(400).json({ message: "You have already checked out today." });
    }

    // Worked hours
    const workedHours = calculateWorkedHours(record.checkIn, now);

    const { location } = req.body; // optional checkout location

    // Build updated note: keep check-in note, append checkout location
    let updatedNote = record.note ?? "";
    if (location) {
      updatedNote = updatedNote
        ? `${updatedNote} | Checkout: ${location}`
        : `Checkout: ${location}`;
    }

    const updated = await prisma.attendance.update({
      where: { id: record.id },
      data: {
        checkOut: now,
        workedHours,
        note: updatedNote || undefined,
      },
    });

    res.json({ record: updated, message: "Checked out successfully." });
  } catch (err) {
    console.error("Check-out error:", err);
    res.status(500).json({ message: "Failed to check out." });
  }
});

// ============================================================================
// ADMIN ROUTES  (requireAuth + requireRole("ADMIN"))
// ============================================================================

// All routes below require an authenticated ADMIN.
router.use(requireAuth, requireRole("ADMIN"));

// GET /api/attendance/employees - approved employees for the picker.
router.get("/employees", async (_req, res) => {
  try {
    const employees = await prisma.employeeProfile.findMany({
      include: { user: { select: { fullName: true, email: true } } },
      orderBy: { employeeCode: "asc" },
    });

    const result = employees.map((e) => ({
      id: e.id,
      employeeCode: e.employeeCode,
      fullName: e.user.fullName,
      email: e.user.email,
      jobTitle: e.jobTitle,
      onboardingStatus: e.onboardingStatus,
    }));

    res.json({ employees: result });
  } catch (err) {
    console.error("List attendance employees error:", err);
    res.status(500).json({ message: "Failed to load employees." });
  }
});

// GET /api/attendance/today - today's summary for all employees.
router.get("/today", async (_req, res) => {
  try {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

    const [employees, attendanceRecords, leaveRequests] = await Promise.all([
      prisma.employeeProfile.findMany({
        include: { user: { select: { fullName: true, email: true } } },
        orderBy: { employeeCode: "asc" },
      }),
      prisma.attendance.findMany({
        where: { date: { gte: today, lt: tomorrow } },
      }),
      prisma.leaveRequest.findMany({
        where: {
          status: "APPROVED",
          startDate: { lte: today },
          endDate: { gte: today },
        },
        include: {
          employee: { select: { id: true } },
          leaveType: { select: { name: true, code: true } },
        },
      }),
    ]);

    const attendanceByEmployeeId = new Map(attendanceRecords.map((rec) => [rec.employeeId, rec]));
    const leaveByEmployeeId = new Map(leaveRequests.map((req) => [req.employeeId, req]));

    const summary = { PRESENT: 0, ABSENT: 0, LATE: 0, HALF_DAY: 0, ON_LEAVE: 0, HOLIDAY: 0 };
    const records = employees.map((employee) => {
      const attendance = attendanceByEmployeeId.get(employee.id);
      const leave = leaveByEmployeeId.get(employee.id);

      let status = "ABSENT";
      let checkIn = null;
      let checkOut = null;
      let workedHours = null;
      let note = "No check-in record.";

      if (attendance) {
        status = attendance.status;
        checkIn = attendance.checkIn;
        checkOut = attendance.checkOut;
        workedHours = attendance.workedHours ?? calculateWorkedHours(attendance.checkIn, attendance.checkOut);
        note = attendance.note || null;
      } else if (leave) {
        status = "ON_LEAVE";
        note = `Approved leave: ${leave.leaveType?.name || leave.leaveType?.code || "Leave"}`;
      }

      if (summary[status] !== undefined) summary[status] += 1;

      return {
        id: employee.id,
        employeeCode: employee.employeeCode,
        fullName: employee.user.fullName,
        email: employee.user.email,
        status,
        checkIn,
        checkOut,
        workedHours,
        note,
      };
    });

    res.json({ date: today, totalEmployees: employees.length, summary, records });
  } catch (err) {
    console.error("Get today attendance error:", err);
    res.status(500).json({ message: "Failed to load today attendance." });
  }
});

// GET /api/attendance/:employeeId?year=YYYY&month=M (month is 1-12)
// Returns the employee's attendance records for the given month plus a summary.
router.get("/:employeeId", async (req, res) => {
  const { employeeId } = req.params;
  const year = Number(req.query.year);
  const month = Number(req.query.month); // 1-12

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return res.status(400).json({ message: "Valid year and month (1-12) are required." });
  }

  try {
    const employee = await prisma.employeeProfile.findUnique({
      where: { id: employeeId },
      include: { user: { select: { fullName: true, email: true } } },
    });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found." });
    }

    // Month range [start, nextMonthStart) in UTC.
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));

    const records = await prisma.attendance.findMany({
      where: { employeeId, date: { gte: start, lt: end } },
      orderBy: { date: "asc" },
    });

    // Holidays in the same window (so the calendar can mark them).
    const holidays = await prisma.holiday.findMany({
      where: { date: { gte: start, lt: end } },
    });

    // Summary counts by status.
    const summary = { PRESENT: 0, ABSENT: 0, LATE: 0, HALF_DAY: 0, ON_LEAVE: 0, HOLIDAY: 0 };
    for (const r of records) {
      if (summary[r.status] !== undefined) summary[r.status] += 1;
    }

    res.json({
      employee: {
        id: employee.id,
        employeeCode: employee.employeeCode,
        fullName: employee.user.fullName,
        email: employee.user.email,
      },
      year,
      month,
      records: records.map((r) => ({
        id: r.id,
        date: r.date,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        status: r.status,
        workedHours: r.workedHours ?? calculateWorkedHours(r.checkIn, r.checkOut),
        note: r.note,
      })),
      holidays: holidays.map((h) => ({ date: h.date, name: h.name })),
      summary,
    });
  } catch (err) {
    console.error("Get attendance error:", err);
    res.status(500).json({ message: "Failed to load attendance." });
  }
});

export default router;
