import { Router } from "express";
import prisma from "../prismaClient.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { requireAdminOrModulePermission } from "../middleware/checkModulePermission.js";

const router = Router();

// All routes require authentication
router.use(requireAuth);

const REGULAR_WORKING_HOURS = 8;
const fitAttendanceNote = (note) => (note ? String(note).slice(0, 190) : note);

const INDIA_TIME_ZONE = "Asia/Kolkata";

const getIndiaDateKey = (date = new Date()) => {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
};

const getIndiaDayRange = (date = new Date()) => {
  const dateKey = getIndiaDateKey(date);

  const start = new Date(`${dateKey}T00:00:00+05:30`);
  const end = new Date(`${dateKey}T23:59:59.999+05:30`);

  return { start, end };
};

const calculateWorkedHours = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return null;

  const workedMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();

  if (workedMs < 0) return 0;

  return parseFloat((workedMs / (1000 * 60 * 60)).toFixed(2));
};

// Anything above 8 hours is overtime
const calculateOvertimeHours = (workedHours) => {
  if (workedHours == null) return 0;

  const hours = Number(workedHours);

  if (!Number.isFinite(hours) || hours <= REGULAR_WORKING_HOURS) {
    return 0;
  }

  return parseFloat((hours - REGULAR_WORKING_HOURS).toFixed(2));
};

const parseLocationString = (location) => {
  if (!location || typeof location !== "string") return null;
  const match = location.match(/(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
};

const getLocationLabel = (targetLocation) => {
  if (!targetLocation) return "Assigned location";
  return (
    targetLocation.name ||
    (targetLocation.isDefault ? "Office" : "Assigned location")
  );
};

const formatDistanceKm = (meters) => {
  if (meters == null || !Number.isFinite(Number(meters))) {
    return "—";
  }

  return `${(Number(meters) / 1000).toFixed(2)} km`;
};

const getDistanceInMeters = (lat1, lon1, lat2, lon2) => {
  const earthRadiusMeters = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
};

const getRosterLocation = async (profileId) => {
  const today = new Date();
  const start = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  const tomorrow = new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate() + 1,
    ),
  );

  const rosterEntry = await prisma.rosterEntry.findFirst({
    where: {
      employeeId: profileId,
      date: { gte: start, lt: tomorrow },
      locationId: { not: null },
    },
    include: { location: true },
  });

  return rosterEntry?.location ?? null;
};

const getTargetLocation = async (profile) => {
  const rosterLocation = await getRosterLocation(profile.id);
  if (rosterLocation) {
    return rosterLocation;
  }

  if (profile.location) {
    return profile.location;
  }

  return prisma.location.findFirst({
    where: { isDefault: true, isActive: true },
  });
};

const getCheckInStatus = (date) => {
  return "PRESENT";
};

const getAttendanceStatusAfterCheckout = (
  checkIn,
  checkOut,
  previousStatus,
) => {
  return previousStatus;
};

const parseManualPunchDateTime = (dateValue, timeValue) => {
  if (!dateValue || !timeValue) return null;

  const trimmedDate = String(dateValue).trim();
  const trimmedTime = String(timeValue).trim();

  if (!trimmedDate || !trimmedTime) return null;

  const safeDate = new Date(`${trimmedDate}T${trimmedTime}:00`);
  if (Number.isNaN(safeDate.getTime())) return null;

  return safeDate;
};

const parsePendingCorrection = (description) => {
  if (typeof description !== "string") return null;

  const match = description.match(
    /\[ATTENDANCE_CORRECTION\]\s*(\{[\s\S]*\})\s*$/,
  );
  if (!match) return null;

  try {
    const correction = JSON.parse(match[1]);
    if (
      !correction.date ||
      !["check-in", "both"].includes(correction.punchType) ||
      !correction.checkInTime
    ) {
      return null;
    }

    return correction;
  } catch {
    return null;
  }
};

const getPendingCorrectionKey = (employeeId, correction) =>
  correction ? `${employeeId}:${correction.date}` : null;

const findNearestLocation = async (coordinates) => {
  const allLocations = await prisma.location.findMany({
    where: { isActive: true },
  });

  let nearest = null;
  let minDistance = Infinity;

  for (const loc of allLocations) {
    if (loc.latitude == null || loc.longitude == null) continue;
    const distance = getDistanceInMeters(
      loc.latitude,
      loc.longitude,
      coordinates.latitude,
      coordinates.longitude,
    );
    if (distance < minDistance) {
      minDistance = distance;
      nearest = { location: loc, distance };
    }
  }

  return nearest;
};

const normalizeUTCDate = (date) =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
const formatDateKey = (date) =>
  normalizeUTCDate(date).toISOString().slice(0, 10);
const isWorkingDay = (date) => date.getUTCDay() !== 0; // skip Sundays as non-working

// ============================================================================
// EMPLOYEE SELF-SERVICE ROUTES  (requireAuth only, no role guard)
// ============================================================================

// GET /api/attendance/me?year=YYYY&month=M
// Returns the calling employee's own monthly attendance + summary.
router.get("/me", requireAuth, async (req, res) => {
  const year = Number(req.query.year);
  const month = Number(req.query.month); // 1-12

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return res
      .status(400)
      .json({ message: "Valid year and month (1-12) are required." });
  }

  try {
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!profile) {
      return res.status(404).json({ message: "Employee profile not found." });
    }

    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));

    const [records, holidays, leaveRequests] = await Promise.all([
      prisma.attendance.findMany({
        where: { employeeId: profile.id, date: { gte: start, lt: end } },
        orderBy: { date: "asc" },
      }),
      prisma.holiday.findMany({
        where: { date: { gte: start, lt: end } },
      }),
      prisma.leaveRequest.findMany({
        where: {
          employeeId: profile.id,
          status: "APPROVED",
          startDate: { lt: end },
          endDate: { gte: start },
        },
        include: { leaveType: { select: { name: true, code: true } } },
      }),
    ]);

    const attendanceByDate = new Map(
      records.map((r) => [formatDateKey(r.date), r]),
    );
    const holidayByDate = new Map(
      holidays.map((h) => [formatDateKey(h.date), h.name]),
    );
    const leaveByDate = new Map();

    for (const leave of leaveRequests) {
      let current = normalizeUTCDate(leave.startDate);
      const last = normalizeUTCDate(leave.endDate);
      while (current <= last) {
        if (isWorkingDay(current)) {
          leaveByDate.set(formatDateKey(current), leave);
        }
        current = new Date(
          Date.UTC(
            current.getUTCFullYear(),
            current.getUTCMonth(),
            current.getUTCDate() + 1,
          ),
        );
      }
    }

    const summary = { PRESENT: 0, ABSENT: 0, ON_LEAVE: 0, HOLIDAY: 0 };
    const populatedRecords = [];
    const now = new Date();
    const todayUtc = normalizeUTCDate(now);

    for (
      let current = new Date(start);
      current < end;
      current = new Date(
        Date.UTC(
          current.getUTCFullYear(),
          current.getUTCMonth(),
          current.getUTCDate() + 1,
        ),
      )
    ) {
      const key = formatDateKey(current);
      const attendance = attendanceByDate.get(key);

      if (attendance) {
        const status = attendance.status;

        if (summary[status] !== undefined) {
          summary[status] += 1;
        }

        const workedHours =
          attendance.workedHours ??
          calculateWorkedHours(attendance.checkIn, attendance.checkOut);

        const overtimeHours = calculateOvertimeHours(workedHours);

        populatedRecords.push({
          id: attendance.id,
          date: attendance.date,
          checkIn: attendance.checkIn,
          checkOut: attendance.checkOut,
          status,
          workedHours,
          overtimeHours,
          note: attendance.note,
        });

        continue;
      }

      if (!isWorkingDay(current)) {
        continue;
      }

      if (holidayByDate.has(key)) {
        summary.HOLIDAY += 1;
        populatedRecords.push({
          id: null,
          date: new Date(current),
          checkIn: null,
          checkOut: null,
          status: "HOLIDAY",
          workedHours: null,
          note: holidayByDate.get(key),
        });
        continue;
      }

      if (leaveByDate.has(key)) {
        const leave = leaveByDate.get(key);
        summary.ON_LEAVE += 1;
        populatedRecords.push({
          id: null,
          date: new Date(current),
          checkIn: null,
          checkOut: null,
          status: "ON_LEAVE",
          workedHours: null,
          note: `Approved leave: ${leave.leaveType?.name || leave.leaveType?.code || "Leave"}`,
        });
        continue;
      }

      const isPastDay = current < todayUtc;
      if (isPastDay) {
        summary.ABSENT += 1;
        populatedRecords.push({
          id: null,
          date: new Date(current),
          checkIn: null,
          checkOut: null,
          status: "ABSENT",
          workedHours: null,
          note: "No attendance record.",
        });
      }
    }

    res.json({
      year,
      month,
      records: populatedRecords,
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
    let profile = await prisma.employeeProfile.findUnique({
      where: { userId: req.user.id },
    });

    // If admin doesn't have employee profile, create one
    if (!profile && req.user.role === "ADMIN") {
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (user) {
        profile = await prisma.employeeProfile.create({
          data: {
            userId: req.user.id,
            employeeCode: `ADMIN-${Date.now()}`,
            onboardingStatus: "APPROVED",
            firstName: user.fullName.split(" ")[0] || "Admin",
            lastName: user.fullName.split(" ").slice(1).join(" ") || "",
            jobTitle: "Administrator",
          },
        });
        console.log(
          `✅ Auto-created employee profile for admin: ${req.user.id}`,
        );
      }
    }

    if (!profile)
      return res.status(404).json({ message: "Employee profile not found." });

    // Today midnight UTC
    const now = new Date();

    const { start: today, end: tomorrow } = getIndiaDayRange(now);

    const record = await prisma.attendance.findFirst({
      where: {
        employeeId: profile.id,
        date: {
          gte: today,
          lte: tomorrow,
        },
      },
    });

    res.json({ record: record ?? null });
  } catch (err) {
    console.error("Employee get today attendance error:", err);
    res.status(500).json({ message: "Failed to load today's attendance." });
  }
});

// POST /api/attendance/manual-correction
router.post("/manual-correction", requireAuth, async (req, res) => {
  if (req.user.role !== "EMPLOYEE") {
    return res.status(403).json({ message: "Employee access required." });
  }

  try {
    const { date, punchType, checkInTime, checkOutTime, reason } =
      req.body || {};
    const normalizedType =
      punchType === "check-out"
        ? "check-out"
        : punchType === "both"
          ? "both"
          : "check-in";
    const manualReason = typeof reason === "string" ? reason.trim() : "";

    if (!date) {
      return res
        .status(400)
        .json({ message: "Please select the attendance date." });
    }

    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!profile) {
      return res.status(404).json({ message: "Employee profile not found." });
    }

    const todayUtc = new Date(
      Date.UTC(
        new Date(date).getUTCFullYear(),
        new Date(date).getUTCMonth(),
        new Date(date).getUTCDate(),
      ),
    );
    const tomorrowUtc = new Date(
      Date.UTC(
        todayUtc.getUTCFullYear(),
        todayUtc.getUTCMonth(),
        todayUtc.getUTCDate() + 1,
      ),
    );

    let record = await prisma.attendance.findFirst({
      where: {
        employeeId: profile.id,
        date: { gte: todayUtc, lt: tomorrowUtc },
      },
    });

    if (!record) {
      record = await prisma.attendance.create({
        data: {
          employeeId: profile.id,
          date: todayUtc,
          status: "PRESENT",
          note: manualReason
            ? `Manual correction: ${manualReason}`
            : "Manual correction applied.",
        },
      });
    }

    const checkInDateTime = parseManualPunchDateTime(
      date,
      checkInTime ||
        (normalizedType === "check-in" || normalizedType === "both"
          ? "09:00"
          : undefined),
    );
    const checkOutDateTime = parseManualPunchDateTime(
      date,
      checkOutTime ||
        (normalizedType === "check-out" || normalizedType === "both"
          ? "18:00"
          : undefined),
    );

    const updates = {};
    const noteParts = [];

    if (normalizedType === "check-in" || normalizedType === "both") {
      if (!record.checkIn) {
        updates.checkIn = checkInDateTime ?? new Date(`${date}T09:00:00`);
        noteParts.push(`Manual check-in: ${updates.checkIn.toISOString()}`);
      }
    }

    if (normalizedType === "check-out" || normalizedType === "both") {
      if (!record.checkOut) {
        updates.checkOut = checkOutDateTime ?? new Date(`${date}T18:00:00`);
        updates.workedHours = calculateWorkedHours(
          record.checkIn ?? updates.checkIn ?? null,
          updates.checkOut,
        );
        noteParts.push(`Manual check-out: ${updates.checkOut.toISOString()}`);
      }
    }

    if (record.status === "PENDING_APPROVAL") {
      updates.status = "PRESENT";
    }

    if (manualReason) {
      const previousNote = record.note || "";
      updates.note = fitAttendanceNote(
        `${previousNote ? `${previousNote} | ` : ""}Manual correction: ${manualReason}`.slice(
          0,
          190,
        ),
      );
    }

    if (Object.keys(updates).length === 0) {
      return res
        .status(400)
        .json({ message: "No attendance change was required." });
    }

    const updated = await prisma.attendance.update({
      where: { id: record.id },
      data: updates,
    });

    res.json({
      record: updated,
      message: "Attendance correction applied successfully.",
    });
  } catch (err) {
    console.error("Manual attendance correction error:", err);
    res.status(500).json({ message: "Failed to apply attendance correction." });
  }
});

// POST /api/attendance/checkin
router.post("/checkin", requireAuth, async (req, res) => {
  // Allow both ADMIN and EMPLOYEE to check in
  if (req.user.role !== "ADMIN" && req.user.role !== "EMPLOYEE") {
    return res
      .status(403)
      .json({ message: "Access denied. Admin or Employee role required." });
  }

  try {
    let profile = await prisma.employeeProfile.findUnique({
      where: { userId: req.user.id },
      include: { location: true },
    });

    // If admin doesn't have employee profile, create one
    if (!profile && req.user.role === "ADMIN") {
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (user) {
        profile = await prisma.employeeProfile.create({
          data: {
            userId: req.user.id,
            employeeCode: `ADMIN-${Date.now()}`,
            onboardingStatus: "APPROVED",
            firstName: user.fullName.split(" ")[0] || "Admin",
            lastName: user.fullName.split(" ").slice(1).join(" ") || "",
            jobTitle: "Administrator",
          },
          include: { location: true },
        });
        console.log(
          `✅ Auto-created employee profile for admin: ${req.user.id}`,
        );
      }
    }

    if (!profile)
      return res.status(404).json({ message: "Employee profile not found." });

    // Admin doesn't need onboarding approval check
    if (
      req.user.role === "EMPLOYEE" &&
      profile.onboardingStatus !== "APPROVED"
    ) {
      return res.status(403).json({
        message: "Your onboarding must be approved before marking attendance.",
      });
    }

    const targetLocation = await getTargetLocation(profile);
    const now = new Date();
    const { start: today, end: tomorrow } = getIndiaDayRange(now);

    const { location, reason } = req.body;
    const normalizedReason = typeof reason === "string" ? reason.trim() : "";

    if (!targetLocation && !normalizedReason) {
      return res.status(400).json({
        message:
          "No assigned/default location is configured. Please add a reason for this check-in.",
      });
    }

    if (
      (targetLocation && targetLocation.latitude == null) ||
      (targetLocation && targetLocation.longitude == null)
    ) {
      return res.status(400).json({
        message: "The target check-in location has no coordinates configured.",
      });
    }
    const existing = await prisma.attendance.findFirst({
      where: { employeeId: profile.id, date: { gte: today, lt: tomorrow } },
    });

    if (existing) {
      return res
        .status(400)
        .json({ message: "You have already checked in today." });
    }

    if (!location) {
      return res
        .status(400)
        .json({ message: "Please provide your GPS location to check in." });
    }

    const coordinates = parseLocationString(location);
    if (!coordinates) {
      return res
        .status(400)
        .json({ message: "Invalid GPS location format. Please try again." });
    }

    // Find which location employee is checking into
    const nearestLocationInfo = await findNearestLocation(coordinates);
    const checkinLocation = nearestLocationInfo?.location;
    const checkinDistance = nearestLocationInfo?.distance ?? Infinity;

    // Get the default location
    const defaultLocation = await prisma.location.findFirst({
      where: { isDefault: true, isActive: true },
    });

    let status = getCheckInStatus(now);
    let note = `Checkin: ${getLocationLabel(targetLocation)}`;
    let requiresApproval = false;

    // Check if the location where employee is checking in is their assigned or default location
    if (checkinLocation && checkinDistance <= (checkinLocation.radius ?? 50)) {
      // Employee is within a location's radius
      const isAssignedLocation = profile.locationId === checkinLocation.id;
      const isDefaultLocation =
        defaultLocation && checkinLocation.id === defaultLocation.id;

      if (!isAssignedLocation && !isDefaultLocation) {
        // Checking in to a location that is neither assigned nor default
        requiresApproval = true;
        status = "PENDING_APPROVAL";
        note = `Checkin to unapproved location: ${checkinLocation.name} (${formatDistanceKm(checkinDistance)}). Pending admin approval.`;
      } else {
        note = `Checkin: ${checkinLocation.name}`;
      }
    } else {
      // Not within any location radius
      const allowedRadius = targetLocation?.radius ?? 50;
      const distanceToAssigned = targetLocation
        ? getDistanceInMeters(
            targetLocation.latitude,
            targetLocation.longitude,
            coordinates.latitude,
            coordinates.longitude,
          )
        : Infinity;

      if (targetLocation && distanceToAssigned > allowedRadius) {
        if (!normalizedReason) {
          return res.status(403).json({
            message: `You are ${formatDistanceKm(distanceToAssigned)} away from the assigned location. Please check in within ${formatDistanceKm(allowedRadius)} of ${targetLocation.name}.`,
          });
        }

        requiresApproval = true;
        status = "PENDING_APPROVAL";
        note = `Checkin from unassigned location (${formatDistanceKm(distanceToAssigned)} away). Reason: ${normalizedReason}. Pending admin approval.`;
      } else if (!targetLocation && normalizedReason) {
        requiresApproval = true;
        status = "PENDING_APPROVAL";
        note = `Checkin from unassigned location. Reason: ${normalizedReason}. Pending admin approval.`;
      }
    }

    const record = await prisma.attendance.create({
      data: {
        employeeId: profile.id,
        date: today,
        checkIn: now,
        status,
        note: fitAttendanceNote(note),
        checkInLatitude: coordinates.latitude,
        checkInLongitude: coordinates.longitude,
      },
    });

    const message = requiresApproval
      ? `Checked in to ${checkinLocation?.name || "unapproved location"}. Awaiting admin approval.`
      : "Checked in successfully.";

    res.json({ record, message });
  } catch (err) {
    console.error("Check-in error:", err);
    res.status(500).json({ message: "Failed to check in." });
  }
});

router.get("/checkin-location", requireAuth, async (req, res) => {
  // Allow both ADMIN and EMPLOYEE to access this endpoint
  if (req.user.role !== "ADMIN" && req.user.role !== "EMPLOYEE") {
    return res
      .status(403)
      .json({ message: "Access denied. Admin or Employee role required." });
  }

  try {
    let profile = await prisma.employeeProfile.findUnique({
      where: { userId: req.user.id },
      include: { location: true },
    });

    // If admin doesn't have employee profile, create one
    if (!profile && req.user.role === "ADMIN") {
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (user) {
        profile = await prisma.employeeProfile.create({
          data: {
            userId: req.user.id,
            employeeCode: `ADMIN-${Date.now()}`,
            onboardingStatus: "APPROVED",
            firstName: user.fullName.split(" ")[0] || "Admin",
            lastName: user.fullName.split(" ").slice(1).join(" ") || "",
            jobTitle: "Administrator",
          },
          include: { location: true },
        });
        console.log(
          `✅ Auto-created employee profile for admin: ${req.user.id}`,
        );
      }
    }

    if (!profile)
      return res.status(404).json({ message: "Employee profile not found." });

    const targetLocation = await getTargetLocation(profile);
    if (!targetLocation) {
      return res.status(404).json({
        message:
          "No assigned or default location is configured. Please ask admin to create one.",
      });
    }

    res.json({
      location: {
        id: targetLocation.id,
        name: targetLocation.name,
        latitude: targetLocation.latitude,
        longitude: targetLocation.longitude,
        radius: targetLocation.radius,
        isDefault: targetLocation.isDefault,
      },
    });
  } catch (err) {
    console.error("Get checkin location error:", err);
    res.status(500).json({ message: "Failed to load check-in location." });
  }
});

// POST /api/attendance/checkout
// POST /api/attendance/checkout
router.post("/checkout", requireAuth, async (req, res) => {
  // Allow both ADMIN and EMPLOYEE to check out
  if (req.user.role !== "ADMIN" && req.user.role !== "EMPLOYEE") {
    return res.status(403).json({
      message: "Access denied. Admin or Employee role required.",
    });
  }

  try {
    let profile = await prisma.employeeProfile.findUnique({
      where: { userId: req.user.id },
      include: { location: true },
    });

    // If admin doesn't have employee profile, create one
    if (!profile && req.user.role === "ADMIN") {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
      });

      if (user) {
        profile = await prisma.employeeProfile.create({
          data: {
            userId: req.user.id,
            employeeCode: `ADMIN-${Date.now()}`,
            onboardingStatus: "APPROVED",
            firstName: user.fullName.split(" ")[0] || "Admin",
            lastName: user.fullName.split(" ").slice(1).join(" ") || "",
            jobTitle: "Administrator",
          },
          include: { location: true },
        });

        console.log(
          `✅ Auto-created employee profile for admin: ${req.user.id}`,
        );
      }
    }

    if (!profile) {
      return res.status(404).json({
        message: "Employee profile not found.",
      });
    }

    const targetLocation = await getTargetLocation(profile);
    const defaultLocation = await prisma.location.findFirst({
      where: {
        isDefault: true,
        isActive: true,
      },
    });

    const comparisonLocation = targetLocation || defaultLocation;

    const now = new Date();
    const { start: today, end: tomorrow } = getIndiaDayRange(now);

    const { location, reason } = req.body || {};
    const normalizedReason = typeof reason === "string" ? reason.trim() : "";

    // ---------------------------------------------------------
    // FIND TODAY'S ATTENDANCE
    // ---------------------------------------------------------

    let record = await prisma.attendance.findFirst({
      where: {
        employeeId: profile.id,
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    // ---------------------------------------------------------
    // FIND PENDING FORGOT PUNCH CHECK-IN REQUEST
    // ---------------------------------------------------------

    let pendingForgotPunchCheckIn = null;

    const pendingRequests = await prisma.employeeRequest.findMany({
      where: {
        employeeId: profile.id,
        type: "CORRECTION",
        status: "PENDING",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    for (const request of pendingRequests) {
      if (typeof request.description !== "string") {
        continue;
      }

      const match = request.description.match(
        /\[ATTENDANCE_CORRECTION\]\s*(\{[\s\S]*\})\s*$/,
      );

      if (!match) {
        continue;
      }

      try {
        const correction = JSON.parse(match[1]);

        if (
          correction.date === today.toISOString().slice(0, 10) &&
          (correction.punchType === "check-in" ||
            correction.punchType === "both") &&
          correction.checkInTime
        ) {
          pendingForgotPunchCheckIn = {
            request,
            correction,
          };

          break;
        }
      } catch (error) {
        console.error("Failed to parse pending Forgot Punch request:", error);
      }
    }

    const hasPendingForgotPunchCheckIn = !!pendingForgotPunchCheckIn;

    // ---------------------------------------------------------
    // NO ATTENDANCE + PENDING FORGOT PUNCH
    //
    // Employee is allowed to CHECK OUT.
    // We create temporary attendance with:
    //
    // checkIn  = null
    // checkOut = now
    //
    // The requested Check In time will be applied only
    // when admin approves the Forgot Punch request.
    // ---------------------------------------------------------

    if (!record && hasPendingForgotPunchCheckIn) {
      record = await prisma.attendance.create({
        data: {
          employeeId: profile.id,
          date: today,
          checkIn: null,
          checkOut: now,
          workedHours: null,
          status: "PRESENT",
          note: fitAttendanceNote(
            `Checkout recorded while Forgot Punch Check In request is pending .`,
          ),
        },
      });

      return res.json({
        record,
        message:
          "Checked out successfully. Your Forgot Punch Check In request is still pending admin approval.",
        forgotPunchPending: true,
      });
    }

    // ---------------------------------------------------------
    // NO ATTENDANCE + NO FORGOT PUNCH REQUEST
    // ---------------------------------------------------------

    if (!record) {
      return res.status(400).json({
        message: "No check-in found for today. Please check in first.",
      });
    }

    // ---------------------------------------------------------
    // IMPORTANT:
    //
    // Do NOT block checkout because a Forgot Punch request
    // is pending.
    //
    // Only block attendance records that are actually pending
    // location/admin approval.
    // ---------------------------------------------------------

    const isPendingForgotPunchOnly =
      hasPendingForgotPunchCheckIn && !record.checkIn;

    if (record.status === "PENDING_APPROVAL" && !isPendingForgotPunchOnly) {
      return res.status(400).json({
        message:
          "Your check-in is pending admin approval. Check out will be available after approval.",
      });
    }

    // ---------------------------------------------------------
    // ALREADY CHECKED OUT
    // ---------------------------------------------------------

    if (record.checkOut) {
      return res.status(400).json({
        message: "You have already checked out today.",
      });
    }

    // ---------------------------------------------------------
    // GPS VALIDATION
    // ---------------------------------------------------------

    if (!comparisonLocation && !normalizedReason) {
      return res.status(400).json({
        message:
          "No assigned/default location is configured. Please add a reason for this check-out.",
      });
    }

    if (
      comparisonLocation &&
      (comparisonLocation.latitude == null ||
        comparisonLocation.longitude == null)
    ) {
      return res.status(400).json({
        message: "The target check-out location has no coordinates configured.",
      });
    }

    if (!location) {
      return res.status(400).json({
        message: "Please provide your GPS location to check out.",
      });
    }

    const coordinates = parseLocationString(location);

    if (!coordinates) {
      return res.status(400).json({
        message: "Invalid GPS location format. Please try again.",
      });
    }

    const allowedRadius = comparisonLocation?.radius ?? 50;

    const distance = comparisonLocation
      ? getDistanceInMeters(
          comparisonLocation.latitude,
          comparisonLocation.longitude,
          coordinates.latitude,
          coordinates.longitude,
        )
      : Infinity;

    // ---------------------------------------------------------
    // WORKED HOURS
    //
    // If checkIn is null because Forgot Punch is pending,
    // workedHours remains null.
    //
    // Admin approval will later apply the requested check-in
    // and recalculate workedHours.
    // ---------------------------------------------------------

    const workedHours = calculateWorkedHours(record.checkIn, now);

    const isOutside = !!comparisonLocation && distance > allowedRadius;

    // ---------------------------------------------------------
    // OUTSIDE LOCATION
    // ---------------------------------------------------------

    if (isOutside || (!comparisonLocation && normalizedReason)) {
      const reasonText = normalizedReason
        ? ` Reason: ${normalizedReason}.`
        : "";

      const checkoutNote = comparisonLocation
        ? `Checkout outside assigned location (${formatDistanceKm(
            distance,
          )} away). Pending admin approval.${reasonText}`
        : `Checkout from unassigned location. Pending admin approval.${reasonText}`;

      const updatedNote = record.note
        ? `${record.note} | ${checkoutNote}`
        : checkoutNote;

      const updated = await prisma.attendance.update({
        where: {
          id: record.id,
        },
        data: {
          checkOut: now,
          checkOutLatitude: coordinates.latitude,
          checkOutLongitude: coordinates.longitude,
          workedHours,
          status: "PENDING_APPROVAL",
          note: fitAttendanceNote(updatedNote),
        },
      });

      return res.json({
        record: updated,
        message: "Checked out outside location — pending admin approval.",
      });
    }

    // ---------------------------------------------------------
    // NORMAL CHECKOUT
    // ---------------------------------------------------------

    const status = isPendingForgotPunchOnly
      ? "PRESENT"
      : getAttendanceStatusAfterCheckout(record.checkIn, now, record.status);

    const checkoutNote = isPendingForgotPunchOnly
      ? "Checkout recorded while Forgot Punch Check In request is pending."
      : `Checkout: ${getLocationLabel(comparisonLocation)}`;

    const updatedNote = record.note
      ? `${record.note} | ${checkoutNote}`
      : checkoutNote;

    const updated = await prisma.attendance.update({
      where: {
        id: record.id,
      },
      data: {
        checkOut: now,
        checkOutLatitude: coordinates.latitude,
        checkOutLongitude: coordinates.longitude,
        workedHours,
        status,
        note: fitAttendanceNote(updatedNote),
      },
    });

    return res.json({
      record: updated,
      message: hasPendingForgotPunchCheckIn
        ? "Checked out successfully. Your Forgot Punch Check In request is still pending admin approval."
        : "Checked out successfully.",
      forgotPunchPending: hasPendingForgotPunchCheckIn,
    });
  } catch (err) {
    console.error("Check-out error:", err);
    console.error("Error stack:", err.stack);
    console.error("Error message:", err.message);

    return res.status(500).json({
      message: "Failed to check out.",
      error: err.message,
    });
  }
});

// ============================================================================
// ADMIN ROUTES  (requireAuth + permission check)
// ============================================================================

// GET /api/attendance/employees - approved employees for the picker.
router.get("/employees", async (req, res) => {
  console.log("📋 [GET /employees] Request received");

  // Allow ADMIN with permission OR any EMPLOYEE to access
  if (req.user.role === "ADMIN") {
    // Check permission for admin
    const hasPermission = await requireAdminOrModulePermission(
      "attendance",
      "canView",
    )(req, res, () => true);
    if (res.headersSent) return; // Permission denied
  } else if (req.user.role !== "EMPLOYEE") {
    return res.status(403).json({ message: "Access denied." });
  }

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

// GET /api/attendance/pending-approvals - Get all pending check-in approvals
router.get("/pending-approvals", async (req, res) => {
  // Allow ADMIN with permission OR any EMPLOYEE to see their own pending
  if (req.user.role === "ADMIN") {
    const hasPermission = await requireAdminOrModulePermission(
      "attendance",
      "canView",
    )(req, res, () => true);
    if (res.headersSent) return;
  } else if (req.user.role !== "EMPLOYEE") {
    return res.status(403).json({ message: "Access denied." });
  }

  try {
    const where = { status: "PENDING_APPROVAL" };
    if (req.user.role === "EMPLOYEE") {
      where.employee = { userId: req.user.id };
    }

    const pendingRecords = await prisma.attendance.findMany({
      where,
      include: {
        employee: {
          include: {
            user: {
              select: { fullName: true, email: true },
            },
          },
        },
      },
      orderBy: { date: "desc" },
    });

    console.log(
      `[GET /pending-approvals] Returning ${pendingRecords.length} pending record(s) for ${req.user.role}.`,
    );

    res.json({ pendingRecords });
  } catch (err) {
    console.error("Get pending approvals error:", err);
    res.status(500).json({ message: "Failed to load pending approvals." });
  }
});

// GET /api/attendance/my-requests - attendance approval history for employee
router.get("/my-requests", requireRole("EMPLOYEE"), async (req, res) => {
  try {
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!profile)
      return res.status(404).json({ message: "Employee profile not found." });

    const records = await prisma.attendance.findMany({
      where: {
        employeeId: profile.id,
        OR: [
          { note: { contains: "Pending admin approval" } },
          { note: { contains: "Approved by admin" } },
          { note: { contains: "Rejected by admin" } },
        ],
      },
      orderBy: { updatedAt: "desc" },
    });

    res.json({ records });
  } catch (err) {
    console.error("Get employee attendance requests error:", err);
    res.status(500).json({ message: "Failed to load attendance requests." });
  }
});

// GET /api/attendance/admin/requests - all attendance approval history
router.get(
  "/admin/requests",
  requireAdminOrModulePermission("attendance", "canView"),
  async (req, res) => {
    try {
      const records = await prisma.attendance.findMany({
        where: {
          OR: [
            { note: { contains: "Pending admin approval" } },
            { note: { contains: "Approved by admin" } },
            { note: { contains: "Rejected by admin" } },
          ],
        },
        include: {
          employee: {
            include: { user: { select: { fullName: true, email: true } } },
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      res.json({ records });
    } catch (err) {
      console.error("Get attendance request history error:", err);
      res
        .status(500)
        .json({ message: "Failed to load attendance request history." });
    }
  },
);

// GET /api/attendance/today - today's summary for all employees.
router.get(
  "/today",
  requireAdminOrModulePermission("attendance", "canView"),
  async (_req, res) => {
    try {
      const now = new Date();
      const { start: today, end: indiaDayEnd } = getIndiaDayRange(now);
      const tomorrow = new Date(indiaDayEnd.getTime() + 1);

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

      const attendanceByEmployeeId = new Map(
        attendanceRecords.map((rec) => [rec.employeeId, rec]),
      );
      const leaveByEmployeeId = new Map(
        leaveRequests.map((req) => [req.employeeId, req]),
      );

      const summary = {
        PRESENT: 0,
        ABSENT: 0,
        ON_LEAVE: 0,
        HOLIDAY: 0,
      };
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
          workedHours =
            attendance.workedHours ??
            calculateWorkedHours(attendance.checkIn, attendance.checkOut);
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

      res.json({
        date: today,
        totalEmployees: employees.length,
        summary,
        records,
      });
    } catch (err) {
      console.error("Get today attendance error:", err);
      res.status(500).json({ message: "Failed to load today attendance." });
    }
  },
);

// GET /api/attendance/register/weekly?days=7 - all employee attendance register.
router.get("/register/weekly", async (req, res) => {
  // Allow ADMIN with permission OR any EMPLOYEE to access their own data
  if (req.user.role === "ADMIN") {
    const hasPermission = await requireAdminOrModulePermission(
      "attendance",
      "canView",
    )(req, res, () => true);
    if (res.headersSent) return; // Permission denied
  } else if (req.user.role !== "EMPLOYEE") {
    return res.status(403).json({ message: "Access denied." });
  }

  const daysParam = Number(req.query.days ?? 7);
  const days =
    Number.isInteger(daysParam) && daysParam > 0 && daysParam <= 31
      ? daysParam
      : 7;

  // Optional ISO start date (YYYY-MM-DD) to request a specific week range (admin use)
  const startParam = req.query.start;

  try {
    const now = new Date();
    const today = normalizeUTCDate(now);

    let start;
    if (startParam) {
      // Try parse provided start param as UTC date key (YYYY-MM-DD)
      const parsed = new Date(startParam);
      if (!Number.isNaN(parsed.getTime())) {
        start = normalizeUTCDate(parsed);
      }
    }

    if (!start) {
      start =
        days === 7
          ? new Date(
              Date.UTC(
                today.getUTCFullYear(),
                today.getUTCMonth(),
                today.getUTCDate() - today.getUTCDay(),
              ),
            )
          : new Date(
              Date.UTC(
                today.getUTCFullYear(),
                today.getUTCMonth(),
                today.getUTCDate() - (days - 1),
              ),
            );
    }
    const end = new Date(
      Date.UTC(
        start.getUTCFullYear(),
        start.getUTCMonth(),
        start.getUTCDate() + days,
      ),
    );
    const attendanceQueryStart = new Date(start);
    attendanceQueryStart.setUTCDate(attendanceQueryStart.getUTCDate() - 1);
    const attendanceQueryEnd = new Date(end);
    attendanceQueryEnd.setUTCDate(attendanceQueryEnd.getUTCDate() + 1);

    const [
      employees,
      attendanceRecords,
      holidays,
      leaveRequests,
      pendingCorrectionRequests,
    ] =
      await Promise.all([
        prisma.employeeProfile.findMany({
          include: { user: { select: { fullName: true, email: true } } },
          orderBy: { employeeCode: "asc" },
        }),
        prisma.attendance.findMany({
          where: {
            date: { gte: attendanceQueryStart, lt: attendanceQueryEnd },
          },
          orderBy: [{ date: "desc" }],
        }),
        prisma.holiday.findMany({
          where: { date: { gte: start, lt: end } },
        }),
        prisma.leaveRequest.findMany({
          where: {
            status: "APPROVED",
            startDate: { lt: end },
            endDate: { gte: start },
          },
          include: { leaveType: { select: { name: true, code: true } } },
        }),
        prisma.employeeRequest.findMany({
          where: { type: "CORRECTION", status: "PENDING" },
          select: { employeeId: true, description: true },
        }),
      ]);

    const dates = [];
    for (let i = 0; i < days; i++) {
      dates.push(
        new Date(
          Date.UTC(
            start.getUTCFullYear(),
            start.getUTCMonth(),
            start.getUTCDate() + i,
          ),
        ),
      );
    }

    const attendanceByEmployeeAndDate = new Map(
      attendanceRecords.map((record) => [
        `${record.employeeId}:${getIndiaDateKey(record.date)}`,
        record,
      ]),
    );
    const holidayByDate = new Map(
      holidays.map((holiday) => [formatDateKey(holiday.date), holiday]),
    );
    const leaveByEmployeeAndDate = new Map();
    const pendingCorrectionByEmployeeAndDate = new Map(
      pendingCorrectionRequests
        .map((request) => {
          const correction = parsePendingCorrection(request.description);
          const key = getPendingCorrectionKey(request.employeeId, correction);
          return key ? [key, correction] : null;
        })
        .filter(Boolean),
    );

    for (const leave of leaveRequests) {
      let current = normalizeUTCDate(leave.startDate);
      const last = normalizeUTCDate(leave.endDate);
      while (current <= last) {
        if (current >= start && current < end && isWorkingDay(current)) {
          leaveByEmployeeAndDate.set(
            `${leave.employeeId}:${formatDateKey(current)}`,
            leave,
          );
        }
        current = new Date(
          Date.UTC(
            current.getUTCFullYear(),
            current.getUTCMonth(),
            current.getUTCDate() + 1,
          ),
        );
      }
    }

    const summary = {
      PRESENT: 0,
      ABSENT: 0,
      ON_LEAVE: 0,
      HOLIDAY: 0,
      PENDING_APPROVAL: 0,
    };
    const records = [];

    for (const date of dates) {
      const dateKey = formatDateKey(date);
      const holiday = holidayByDate.get(dateKey);

      for (const employee of employees) {
        const mapKey = `${employee.id}:${dateKey}`;
        const attendance = attendanceByEmployeeAndDate.get(mapKey);
        const leave = leaveByEmployeeAndDate.get(mapKey);
        const pendingCorrection = pendingCorrectionByEmployeeAndDate.get(mapKey);

        let status = "ABSENT";
        let checkIn = null;
        let checkOut = null;
        let workedHours = null;
        let note = "No attendance record.";

        if (attendance) {
          status = attendance.status;
          checkIn = attendance.checkIn;
          checkOut = attendance.checkOut;
          workedHours =
            attendance.workedHours ??
            calculateWorkedHours(attendance.checkIn, attendance.checkOut);
          note = attendance.note || null;
        } else if (!isWorkingDay(date)) {
          status = "HOLIDAY";
          note = "Weekly off.";
        } else if (holiday) {
          status = "HOLIDAY";
          note = holiday.name;
        } else if (leave) {
          status = "ON_LEAVE";
          note = `Approved leave: ${leave.leaveType?.name || leave.leaveType?.code || "Leave"}`;
        }

        if (pendingCorrection?.checkInTime) {
          checkIn = new Date(
            `${dateKey}T${pendingCorrection.checkInTime}:00+05:30`,
          );
          status = "PENDING_APPROVAL";
          note = note
            ? `${note} | Forgot Punch Check In pending approval.`
            : "Forgot Punch Check In pending approval.";
        }

        if (summary[status] !== undefined) summary[status] += 1;

        records.push({
          id: attendance?.id ?? `${employee.id}-${dateKey}`,
          employeeId: employee.id,
          employeeCode: employee.employeeCode,
          fullName: employee.user.fullName,
          email: employee.user.email,
          date: new Date(date),
          status,
          checkIn,
          checkOut,
          checkInLatitude: attendance?.checkInLatitude ?? null,
          checkInLongitude: attendance?.checkInLongitude ?? null,
          checkOutLatitude: attendance?.checkOutLatitude ?? null,
          checkOutLongitude: attendance?.checkOutLongitude ?? null,
          workedHours,
          note,
        });
      }
    }

    res.json({
      startDate: start,
      endDate: today,
      days,
      totalEmployees: employees.length,
      summary,
      records,
    });
  } catch (err) {
    console.error("Get weekly attendance register error:", err);
    res.status(500).json({ message: "Failed to load attendance register." });
  }
});

// GET /api/attendance/pending - list pending approval attendance records (ADMIN)
router.get(
  "/pending",
  requireAdminOrModulePermission("attendance", "canView"),
  async (req, res) => {
    try {
      const pending = await prisma.attendance.findMany({
        where: { status: "PENDING_APPROVAL" },
        include: {
          employee: {
            include: { user: { select: { fullName: true, email: true } } },
          },
        },
        orderBy: { date: "desc" },
      });

      const result = pending.map((p) => ({
        id: p.id,
        employeeId: p.employeeId,
        fullName: p.employee?.user?.fullName,
        email: p.employee?.user?.email,
        date: p.date,
        checkIn: p.checkIn,
        checkOut: p.checkOut,
        workedHours: p.workedHours,
        note: p.note,
      }));

      res.json({ records: result });
    } catch (err) {
      console.error("Get pending attendance error:", err);
      res.status(500).json({ message: "Failed to load pending attendance." });
    }
  },
);

// POST /api/attendance/:id/approve - approve pending attendance (ADMIN)
router.post(
  "/:id/approve",
  requireAdminOrModulePermission("attendance", "canEdit"),
  async (req, res) => {
    const { id } = req.params;
    try {
      const record = await prisma.attendance.findUnique({ where: { id } });
      if (!record)
        return res
          .status(404)
          .json({ message: "Attendance record not found." });
      if (record.status !== "PENDING_APPROVAL")
        return res
          .status(400)
          .json({ message: "Record is not pending approval." });

      const workedHours = calculateWorkedHours(
        record.checkIn,
        record.checkOut ?? new Date(),
      );
      // Recompute status based on original checkIn time and worked hours
      const checkInDate = record.checkIn ? new Date(record.checkIn) : null;
      const baseStatus = checkInDate
        ? getCheckInStatus(checkInDate)
        : "PRESENT";
      const finalStatus = record.checkOut
        ? getAttendanceStatusAfterCheckout(
            record.checkIn,
            record.checkOut,
            baseStatus,
          )
        : baseStatus;

      const updated = await prisma.attendance.update({
        where: { id },
        data: {
          workedHours,
          status: finalStatus,
          note: fitAttendanceNote(
            record.note
              ? `${record.note} | Approved by admin`
              : "Approved by admin",
          ),
        },
      });

      res.json({ record: updated, message: "Attendance approved." });
    } catch (err) {
      console.error("Approve attendance error:", err);
      res.status(500).json({ message: "Failed to approve attendance." });
    }
  },
);

// POST /api/attendance/:id/reject - reject pending attendance (ADMIN)
router.post(
  "/:id/reject",
  requireAdminOrModulePermission("attendance", "canEdit"),
  async (req, res) => {
    const { id } = req.params;
    try {
      const record = await prisma.attendance.findUnique({ where: { id } });
      if (!record)
        return res
          .status(404)
          .json({ message: "Attendance record not found." });
      if (record.status !== "PENDING_APPROVAL")
        return res
          .status(400)
          .json({ message: "Record is not pending approval." });

      const updated = await prisma.attendance.update({
        where: { id },
        data: {
          status: "ABSENT",
          note: fitAttendanceNote(
            record.note
              ? `${record.note} | Rejected by admin`
              : "Rejected by admin",
          ),
        },
      });

      res.json({
        record: updated,
        message: "Attendance rejected and marked absent.",
      });
    } catch (err) {
      console.error("Reject attendance error:", err);
      res.status(500).json({ message: "Failed to reject attendance." });
    }
  },
);

// GET /api/attendance/:employeeId?year=YYYY&month=M (month is 1-12)
// Returns the employee's attendance records for the given month plus a summary.
router.get(
  "/:employeeId",
  requireAdminOrModulePermission("attendance", "canView"),
  async (req, res) => {
    const { employeeId } = req.params;
    const year = Number(req.query.year);
    const month = Number(req.query.month); // 1-12

    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      return res
        .status(400)
        .json({ message: "Valid year and month (1-12) are required." });
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
      const attendanceQueryStart = new Date(start);
      attendanceQueryStart.setUTCDate(attendanceQueryStart.getUTCDate() - 1);
      const attendanceQueryEnd = new Date(end);
      attendanceQueryEnd.setUTCDate(attendanceQueryEnd.getUTCDate() + 1);

      const records = await prisma.attendance.findMany({
        where: {
          employeeId,
          date: { gte: attendanceQueryStart, lt: attendanceQueryEnd },
        },
        orderBy: { date: "asc" },
      });

      // Holidays in the same window (so the calendar can mark them).
      const holidays = await prisma.holiday.findMany({
        where: { date: { gte: start, lt: end } },
      });

      const leaveRequests = await prisma.leaveRequest.findMany({
        where: {
          employeeId,
          status: "APPROVED",
          startDate: { lt: end },
          endDate: { gte: start },
        },
        include: { leaveType: { select: { name: true, code: true } } },
      });

      const pendingCorrectionRequests = await prisma.employeeRequest.findMany({
        where: {
          employeeId,
          type: "CORRECTION",
          status: "PENDING",
        },
        select: { description: true },
      });

      const attendanceByDate = new Map(
        records.map((r) => [getIndiaDateKey(r.date), r]),
      );
      const holidayByDate = new Map(
        holidays.map((h) => [formatDateKey(h.date), h]),
      );
      const leaveByDate = new Map();
      const pendingCorrectionByDate = new Map(
        pendingCorrectionRequests
          .map((request) => parsePendingCorrection(request.description))
          .filter(Boolean)
          .map((correction) => [correction.date, correction]),
      );

      for (const leave of leaveRequests) {
        let current = normalizeUTCDate(leave.startDate);
        const last = normalizeUTCDate(leave.endDate);
        while (current <= last) {
          if (isWorkingDay(current)) {
            leaveByDate.set(formatDateKey(current), leave);
          }
          current = new Date(
            Date.UTC(
              current.getUTCFullYear(),
              current.getUTCMonth(),
              current.getUTCDate() + 1,
            ),
          );
        }
      }

      const summary = { PRESENT: 0, ABSENT: 0, ON_LEAVE: 0, HOLIDAY: 0 };
      const todayUtc = normalizeUTCDate(new Date());
      const populatedRecords = [];

      for (
        let current = new Date(start);
        current < end;
        current = new Date(
          Date.UTC(
            current.getUTCFullYear(),
            current.getUTCMonth(),
            current.getUTCDate() + 1,
          ),
        )
      ) {
        const key = formatDateKey(current);
        const existing = attendanceByDate.get(key);
        const pendingCorrection = pendingCorrectionByDate.get(key);

        if (existing) {
          const status = pendingCorrection ? "PENDING_APPROVAL" : existing.status;
          if (summary[status] !== undefined) summary[status] += 1;
          populatedRecords.push({
            id: existing.id,
            date: existing.date,
            checkIn: pendingCorrection?.checkInTime
              ? new Date(`${key}T${pendingCorrection.checkInTime}:00+05:30`)
              : existing.checkIn,
            checkOut: existing.checkOut,
            checkInLatitude: existing.checkInLatitude,
            checkInLongitude: existing.checkInLongitude,
            checkOutLatitude: existing.checkOutLatitude,
            checkOutLongitude: existing.checkOutLongitude,
            status,
            workedHours:
              existing.workedHours ??
              calculateWorkedHours(existing.checkIn, existing.checkOut),
            note: pendingCorrection
              ? `${existing.note || ""}${existing.note ? " | " : ""}Forgot Punch Check In pending approval.`
              : existing.note,
          });
          continue;
        }

        if (!isWorkingDay(current)) {
          continue;
        }

        if (holidayByDate.has(key)) {
          summary.HOLIDAY += 1;
          populatedRecords.push({
            id: null,
            date: new Date(current),
            checkIn: null,
            checkOut: null,
            status: "HOLIDAY",
            workedHours: null,
            note: holidayByDate.get(key).name,
          });
          continue;
        }

        if (leaveByDate.has(key)) {
          const leave = leaveByDate.get(key);
          summary.ON_LEAVE += 1;
          populatedRecords.push({
            id: null,
            date: new Date(current),
            checkIn: null,
            checkOut: null,
            status: "ON_LEAVE",
            workedHours: null,
            note: `Approved leave: ${leave.leaveType?.name || leave.leaveType?.code || "Leave"}`,
          });
          continue;
        }

        if (pendingCorrection?.checkInTime) {
          summary.PENDING_APPROVAL += 1;
          populatedRecords.push({
            id: null,
            date: new Date(current),
            checkIn: new Date(
              `${key}T${pendingCorrection.checkInTime}:00+05:30`,
            ),
            checkOut: null,
            status: "PENDING_APPROVAL",
            workedHours: null,
            note: "Forgot Punch Check In pending approval.",
          });
          continue;
        }

        if (current <= todayUtc) {
          summary.ABSENT += 1;
          populatedRecords.push({
            id: null,
            date: new Date(current),
            checkIn: null,
            checkOut: null,
            status: "ABSENT",
            workedHours: null,
            note: "No attendance record.",
          });
        }
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
        records: populatedRecords,
        holidays: holidays.map((h) => ({ date: h.date, name: h.name })),
        summary,
      });
    } catch (err) {
      console.error("Get attendance error:", err);
      res.status(500).json({ message: "Failed to load attendance." });
    }
  },
);

// POST /api/attendance/approve/:id - Approve a pending check-in
router.post(
  "/approve/:id",
  requireAdminOrModulePermission("attendance", "canEdit"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const record = await prisma.attendance.findUnique({
        where: { id },
        include: { employee: true },
      });

      if (!record) {
        return res
          .status(404)
          .json({ message: "Attendance record not found." });
      }

      if (record.status !== "PENDING_APPROVAL") {
        return res
          .status(400)
          .json({ message: "Record is not pending approval." });
      }

      const updatedNote = record.note
        ? `${record.note} | Admin approved.`
        : "Admin approved.";

      const updated = await prisma.attendance.update({
        where: { id },
        data: {
          status: "PRESENT",
          note: updatedNote,
        },
      });

      res.json({ record: updated, message: "Check-in approved successfully." });
    } catch (err) {
      console.error("Approve check-in error:", err);
      res.status(500).json({ message: "Failed to approve check-in." });
    }
  },
);

// POST /api/attendance/reject/:id - Reject a pending check-in
router.post(
  "/reject/:id",
  requireAdminOrModulePermission("attendance", "canEdit"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const record = await prisma.attendance.findUnique({
        where: { id },
        include: { employee: true },
      });

      if (!record) {
        return res
          .status(404)
          .json({ message: "Attendance record not found." });
      }

      if (record.status !== "PENDING_APPROVAL") {
        return res
          .status(400)
          .json({ message: "Record is not pending approval." });
      }

      const rejectionNote = reason
        ? `Admin rejected: ${reason}`
        : "Admin rejected.";
      const updatedNote = record.note
        ? `${record.note} | ${rejectionNote}`
        : rejectionNote;

      const updated = await prisma.attendance.update({
        where: { id },
        data: {
          status: "ABSENT",
          note: updatedNote,
        },
      });

      res.json({ record: updated, message: "Check-in rejected successfully." });
    } catch (err) {
      console.error("Reject check-in error:", err);
      res.status(500).json({ message: "Failed to reject check-in." });
    }
  },
);

export default router;
