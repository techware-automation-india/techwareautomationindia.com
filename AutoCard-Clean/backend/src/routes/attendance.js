import { Router } from "express";
import prisma from "../prismaClient.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { requireAdminOrModulePermission } from "../middleware/checkModulePermission.js";

const router = Router();

// All routes require authentication
router.use(requireAuth);

const REGULAR_WORKING_HOURS = 8;
const fitAttendanceNote = (note) => {
  if (note == null) return note;
  return String(note);
};

const INDIA_TIME_ZONE = "Asia/Kolkata";

const getIndiaDateKey = (date = new Date()) => {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
};

const getIndiaDayRange = (date = new Date()) => {
  const dateKey = getIndiaDateKey(date) || getIndiaDateKey(new Date());

  const start = new Date(`${dateKey}T00:00:00+05:30`);
  const end = new Date(`${dateKey}T23:59:59.999+05:30`);

  return { start, end };
};

const normalizeUTCDate = (d) => {
  if (!d) {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) {
    const fallback = new Date();
    return new Date(Date.UTC(fallback.getUTCFullYear(), fallback.getUTCMonth(), fallback.getUTCDate()));
  }
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const calculateWorkedHours = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return null;

  const workedMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();

  if (workedMs < 0) return 0;

  return parseFloat((workedMs / (1000 * 60 * 60)).toFixed(2));
};

// Anything above 8 hours is overtime rounded to 15-minute intervals:
// 0-14 min -> 0 min, 15-29 min -> 15 min, 30-44 min -> 30 min, 45-59 min -> 45 min
const calculateOvertimeHours = (workedHours) => {
  if (workedHours == null) return 0;

  const hours = Number(workedHours);

  if (!Number.isFinite(hours) || hours <= REGULAR_WORKING_HOURS) {
    return 0;
  }

  const rawOvertimeHours = hours - REGULAR_WORKING_HOURS;
  const rawOvertimeMinutes = Math.round(rawOvertimeHours * 60);
  const roundedOtMinutes = Math.floor(rawOvertimeMinutes / 15) * 15;

  if (roundedOtMinutes <= 0) {
    return 0;
  }

  return parseFloat((roundedOtMinutes / 60).toFixed(2));
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

const getRoadDistanceInMeters = async (lat1, lon1, lat2, lon2) => {
  const straightDistance = getDistanceInMeters(lat1, lon1, lat2, lon2);
  if (straightDistance < 100) {
    return straightDistance;
  }

  // 1. Try Google Maps Distance Matrix API if key is set
  const googleApiKey =
    process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
  if (googleApiKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${lat1},${lon1}&destinations=${lat2},${lon2}&key=${googleApiKey}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const element = data?.rows?.[0]?.elements?.[0];
        if (element?.status === "OK" && element?.distance?.value != null) {
          return element.distance.value;
        }
      }
    } catch (err) {
      console.warn("Google Distance Matrix API error, using OSRM fallback:", err.message);
    }
  }

  // 2. Try OSRM (Open Source Routing Machine) Free Driving Route API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.code === "Ok" && data.routes && data.routes.length > 0) {
        return data.routes[0].distance;
      }
    }
  } catch (err) {
    console.warn("OSRM routing API error, using fallback factor:", err.message);
  }

  // 3. Fallback: Straight-line * 1.35 road factor multiplier
  return straightDistance * 1.35;
};

const getRosterLocation = async (profileId) => {
  const now = new Date();
  const dateKey = getIndiaDateKey(now);
  const { start, end } = getIndiaDayRange(now);

  const rosterEntry = await prisma.rosterEntry.findFirst({
    where: {
      employeeId: profileId,
      locationId: { not: null },
      OR: [
        { date: { gte: start, lte: end } },
        ...(dateKey
          ? [
              { date: new Date(`${dateKey}T00:00:00.000Z`) },
              { date: new Date(`${dateKey}T00:00:00+05:30`) },
            ]
          : []),
      ],
    },
    include: { location: true },
    orderBy: { updatedAt: "desc" },
  });

  return rosterEntry?.location ?? null;
};

const getTargetLocation = async (profile) => {
  const rosterLocation = await getRosterLocation(profile.id);
  if (rosterLocation && rosterLocation.latitude != null && rosterLocation.longitude != null) {
    return rosterLocation;
  }

  if (profile?.location && profile.location.latitude != null && profile.location.longitude != null) {
    return profile.location;
  }

  const defaultLoc = await prisma.location.findFirst({
    where: { isDefault: true, isActive: true },
  });
  if (defaultLoc) return defaultLoc;

  return prisma.location.findFirst({
    where: { isActive: true },
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

  // IMPORTANT:
  // Manual attendance time is always India Standard Time (IST)
  const safeDate = new Date(
    `${trimmedDate}T${trimmedTime}:00+05:30`
  );

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

const formatDateKey = (date) => (date ? getIndiaDateKey(date) : "");
const isWorkingDay = (date) => {
  if (!date) return false;
  const dateKey = typeof date === "string" ? date : getIndiaDateKey(date);
  if (!dateKey) return false;
  const d = new Date(`${dateKey}T12:00:00+05:30`);
  if (Number.isNaN(d.getTime())) return false;
  return d.getDay() !== 0; // skip Sundays as non-working
};

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

    const monthStr = String(month).padStart(2, "0");
    const endMonth = month === 12 ? 1 : month + 1;
    const endYear = month === 12 ? year + 1 : year;
    const endMonthStr = String(endMonth).padStart(2, "0");

    const start = new Date(`${year}-${monthStr}-01T00:00:00+05:30`);
    const end = new Date(`${endYear}-${endMonthStr}-01T00:00:00+05:30`);

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
      const startKey = formatDateKey(leave.startDate);
      const endKey = formatDateKey(leave.endDate);
      const curDate = new Date(`${startKey}T12:00:00+05:30`);
      const endDateObj = new Date(`${endKey}T12:00:00+05:30`);

      while (curDate <= endDateObj) {
        const curKey = getIndiaDateKey(curDate);
        if (isWorkingDay(curKey)) {
          leaveByDate.set(curKey, leave);
        }
        curDate.setDate(curDate.getDate() + 1);
      }
    }

    const summary = { PRESENT: 0, ABSENT: 0, ON_LEAVE: 0, HOLIDAY: 0 };
    const populatedRecords = [];
    const todayKey = getIndiaDateKey(new Date());
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, "0");
      const key = `${year}-${monthStr}-${dayStr}`;
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
          createdAt: attendance.createdAt,
          updatedAt: attendance.updatedAt,
        });

        continue;
      }

      if (!isWorkingDay(key)) {
        summary.HOLIDAY += 1;
        populatedRecords.push({
          id: null,
          date: new Date(`${key}T00:00:00+05:30`),
          checkIn: null,
          checkOut: null,
          status: "HOLIDAY",
          workedHours: null,
          note: holidayByDate.get(key) || "Weekly Off (Sunday)",
        });
        continue;
      }

      if (holidayByDate.has(key)) {
        summary.HOLIDAY += 1;
        populatedRecords.push({
          id: null,
          date: new Date(`${key}T00:00:00+05:30`),
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
          date: new Date(`${key}T00:00:00+05:30`),
          checkIn: null,
          checkOut: null,
          status: "ON_LEAVE",
          workedHours: null,
          note: `Approved leave: ${leave.leaveType?.name || leave.leaveType?.code || "Leave"}`,
        });
        continue;
      }

      const isPastDay = key < todayKey;
      if (isPastDay) {
        summary.ABSENT += 1;
        populatedRecords.push({
          id: null,
          date: new Date(`${key}T00:00:00+05:30`),
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
  // Admin and Employee can use this endpoint.
  if (req.user.role !== "ADMIN" && req.user.role !== "EMPLOYEE") {
    return res.status(403).json({
      message: "Admin or Employee access required.",
    });
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

    // --------------------------------------------------
    // VALIDATION
    // --------------------------------------------------

    if (!date) {
      return res.status(400).json({
        message: "Please select the attendance date.",
      });
    }

    if (!manualReason) {
      return res.status(400).json({
        message: "Please enter a reason.",
      });
    }

    // --------------------------------------------------
    // FIND PROFILE
    // --------------------------------------------------

    let profile = await prisma.employeeProfile.findUnique({
      where: {
        userId: req.user.id,
      },
    });

    // Create Admin profile if required
    if (!profile && req.user.role === "ADMIN") {
      const user = await prisma.user.findUnique({
        where: {
          id: req.user.id,
        },
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
        });
      }
    }

    if (!profile) {
      return res.status(404).json({
        message: "Employee profile not found.",
      });
    }

    // --------------------------------------------------
    // INDIA DATE RANGE
    // --------------------------------------------------

    const selectedDate = new Date(`${date}T00:00:00+05:30`);

    if (Number.isNaN(selectedDate.getTime())) {
      return res.status(400).json({
        message: "Invalid attendance date.",
      });
    }

    const nextDate = new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000);

    // --------------------------------------------------
    // FIND EXISTING ATTENDANCE
    // IMPORTANT:
    // If today's attendance already exists,
    // UPDATE that same record.
    // --------------------------------------------------

    let record = await prisma.attendance.findFirst({
      where: {
        employeeId: profile.id,
        date: {
          gte: selectedDate,
          lt: nextDate,
        },
      },
    });

    // --------------------------------------------------
    // CHECK IF TODAY'S ATTENDANCE IS ALREADY MARKED VIA GPS
    // IMPORTANT: Only prevent forgot punch check-in for TODAY if marked via Mark Attendance (GPS)
    // Allow forgot punch for previous dates always
    // Allow check-out anytime (even if checked in via GPS)
    // --------------------------------------------------

    const { start: todayStart } = getIndiaDayRange(new Date());
    const isToday = selectedDate.getTime() === todayStart.getTime();

    if (
      record &&
      isToday &&
      (normalizedType === "check-in" || normalizedType === "both")
    ) {
      // Check if attendance was marked via GPS (Mark Attendance module)
      const isMarkedViaGPS =
        record.checkIn &&
        record.checkInLatitude != null &&
        !record.note?.includes("Manual attendance correction") &&
        !record.note?.includes("Manual attendance:");

      if (isMarkedViaGPS) {
        return res.status(400).json({
          message:
            "You have already checked in today via Mark Attendance. You cannot use Forgot Punch for check-in. You can use it for check-out if needed.",
        });
      }
    }

    // --------------------------------------------------
    // PREVENT DUPLICATE PUNCH FOR SAME TYPE
    // If trying to update check-in but check-in already exists, block it
    // If trying to update check-out but check-out already exists, block it
    // --------------------------------------------------

    if (record) {
      if (
        (normalizedType === "check-in" || normalizedType === "both") &&
        record.checkIn
      ) {
        return res.status(400).json({
          message:
            "Check-in already exists for this date. Please use a different punch type or contact admin to modify existing attendance.",
        });
      }

      if (
        (normalizedType === "check-out" || normalizedType === "both") &&
        record.checkOut
      ) {
        return res.status(400).json({
          message:
            "Check-out already exists for this date. Please use a different punch type or contact admin to modify existing attendance.",
        });
      }
    }

    // --------------------------------------------------
    // CREATE ONLY IF ATTENDANCE DOES NOT EXIST
    // --------------------------------------------------

    if (!record) {
      record = await prisma.attendance.create({
        data: {
          employeeId: profile.id,
          date: selectedDate,
          status: "PRESENT",
          checkIn: null,
          checkOut: null,
          note: `Manual attendance: ${manualReason}`,
        },
      });
    }

    // --------------------------------------------------
    // PARSE TIMES
    // --------------------------------------------------

    let checkInDateTime = null;
    let checkOutDateTime = null;

    if (normalizedType === "check-in" || normalizedType === "both") {
      if (!checkInTime) {
        return res.status(400).json({
          message: "Please enter check-in time.",
        });
      }

      checkInDateTime = parseManualPunchDateTime(date, checkInTime);

      if (!checkInDateTime) {
        return res.status(400).json({
          message: "Invalid check-in time.",
        });
      }
    }

    if (normalizedType === "check-out" || normalizedType === "both") {
      if (!checkOutTime) {
        return res.status(400).json({
          message: "Please enter check-out time.",
        });
      }

      checkOutDateTime = parseManualPunchDateTime(date, checkOutTime);

      if (!checkOutDateTime) {
        return res.status(400).json({
          message: "Invalid check-out time.",
        });
      }
    }

    // --------------------------------------------------
    // BOTH TIME VALIDATION
    // --------------------------------------------------

    if (normalizedType === "both" && checkOutDateTime <= checkInDateTime) {
      return res.status(400).json({
        message: "Check-out time must be greater than check-in time.",
      });
    }

    // --------------------------------------------------
    // PREPARE UPDATE
    // IMPORTANT:
    // We intentionally overwrite the selected punch.
    // --------------------------------------------------

    const updates = {};

    if (normalizedType === "check-in" || normalizedType === "both") {
      updates.checkIn = checkInDateTime;
    }

    if (normalizedType === "check-out" || normalizedType === "both") {
      updates.checkOut = checkOutDateTime;
    }

    // --------------------------------------------------
    // FINAL TIMES
    // --------------------------------------------------

    const finalCheckIn =
      updates.checkIn !== undefined ? updates.checkIn : record.checkIn;

    const finalCheckOut =
      updates.checkOut !== undefined ? updates.checkOut : record.checkOut;

    // --------------------------------------------------
    // VALIDATE EXISTING CHECK-IN / CHECK-OUT
    // --------------------------------------------------

    if (
      finalCheckIn &&
      finalCheckOut &&
      new Date(finalCheckOut) <= new Date(finalCheckIn)
    ) {
      return res.status(400).json({
        message: "Check-out time must be greater than check-in time.",
      });
    }

    // --------------------------------------------------
    // WORKED HOURS & OVERTIME
    // --------------------------------------------------

    if (finalCheckIn && finalCheckOut) {
      updates.workedHours = calculateWorkedHours(finalCheckIn, finalCheckOut);
      updates.overtimeHours = calculateOvertimeHours(updates.workedHours);
    } else {
      updates.workedHours = null;
      updates.overtimeHours = null;
    }

    // --------------------------------------------------
    // ADMIN DIRECTLY MAKES IT PRESENT
    // --------------------------------------------------

    updates.status = "PRESENT";

    // --------------------------------------------------
    // NOTE
    // --------------------------------------------------

    updates.note = fitAttendanceNote(
      `Manual attendance correction: ${manualReason}`,
    );

    // --------------------------------------------------
    // UPDATE SAME RECORD
    // --------------------------------------------------

    const updated = await prisma.attendance.update({
      where: {
        id: record.id,
      },
      data: updates,
    });

    return res.json({
      record: updated,
      message: "Attendance updated successfully.",
    });
  } catch (err) {
    console.error("Manual attendance correction error:", err);

    console.error(err.stack);

    return res.status(500).json({
      message: "Failed to update attendance.",
    });
  }
});

// POST /api/attendance/checkin
// ============================================================
// POST /api/attendance/checkin
// ============================================================

router.post("/checkin", requireAuth, async (req, res) => {
  // Allow ADMIN and EMPLOYEE
  if (req.user.role !== "ADMIN" && req.user.role !== "EMPLOYEE") {
    return res.status(403).json({
      message: "Access denied. Admin or Employee role required.",
    });
  }

  try {
    // ----------------------------------------------------------
    // FIND EMPLOYEE PROFILE
    // ----------------------------------------------------------

    let profile = await prisma.employeeProfile.findUnique({
      where: {
        userId: req.user.id,
      },
      include: {
        location: true,
      },
    });

    // ----------------------------------------------------------
    // AUTO CREATE PROFILE FOR ADMIN
    // ----------------------------------------------------------

    if (!profile && req.user.role === "ADMIN") {
      const user = await prisma.user.findUnique({
        where: {
          id: req.user.id,
        },
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
          include: {
            location: true,
          },
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

    // ----------------------------------------------------------
    // EMPLOYEE ONBOARDING CHECK
    // ----------------------------------------------------------

    if (
      req.user.role === "EMPLOYEE" &&
      profile.onboardingStatus !== "APPROVED"
    ) {
      return res.status(403).json({
        message: "Your onboarding must be approved before marking attendance.",
      });
    }

    // ----------------------------------------------------------
    // DATE
    // ----------------------------------------------------------

    const now = new Date();

    const { start: today, end: tomorrow } = getIndiaDayRange(now);

    // ----------------------------------------------------------
    // REQUEST BODY
    // ----------------------------------------------------------

    const { location, reason } = req.body || {};

    const normalizedReason = typeof reason === "string" ? reason.trim() : "";

    // ----------------------------------------------------------
    // CHECK EXISTING ATTENDANCE
    // ----------------------------------------------------------

    const existing = await prisma.attendance.findFirst({
      where: {
        employeeId: profile.id,
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    if (existing) {
      return res.status(400).json({
        message: "You have already checked in today.",
      });
    }

    // ==========================================================
    // GPS IS REQUIRED FOR BOTH ADMIN AND EMPLOYEE
    // ==========================================================

    if (!location) {
      return res.status(400).json({
        message: "Please provide your GPS location to check in.",
      });
    }

    const coordinates = parseLocationString(location);

    if (!coordinates) {
      return res.status(400).json({
        message: "Invalid GPS location format. Please try again.",
      });
    }

    // ==========================================================
    // ADMIN CHECK-IN
    //
    // IMPORTANT:
    // - No target location
    // - No default location
    // - No distance calculation
    // - No approval
    // - Always PRESENT
    // - Save GPS
    // ==========================================================

    if (req.user.role === "ADMIN") {
      const record = await prisma.attendance.create({
        data: {
          employeeId: profile.id,

          date: today,

          checkIn: now,

          checkOut: null,

          status: "PRESENT",

          note: "Admin check-in.",

          checkInLatitude: coordinates.latitude,

          checkInLongitude: coordinates.longitude,

          checkOutLatitude: null,

          checkOutLongitude: null,
        },
      });

      return res.json({
        record,

        message: "Admin checked in successfully.",
      });
    }

    // ==========================================================
    // EMPLOYEE CHECK-IN
    // Existing location / approval logic
    // ==========================================================

    const targetLocation = await getTargetLocation(profile);

    if (!targetLocation && !normalizedReason) {
      return res.status(400).json({
        message:
          "No assigned/default location is configured. Please add a reason for this check-in.",
      });
    }

    if (
      targetLocation &&
      (targetLocation.latitude == null || targetLocation.longitude == null)
    ) {
      return res.status(400).json({
        message: "The target check-in location has no coordinates configured.",
      });
    }

    // ----------------------------------------------------------
    // FIND NEAREST LOCATION
    // ----------------------------------------------------------

    const nearestLocationInfo = await findNearestLocation(coordinates);

    const checkinLocation = nearestLocationInfo?.location;

    const checkinDistance = nearestLocationInfo?.distance ?? Infinity;

    // ----------------------------------------------------------
    // DEFAULT LOCATION
    // ----------------------------------------------------------

    const defaultLocation = await prisma.location.findFirst({
      where: {
        isDefault: true,
        isActive: true,
      },
    });

    // ----------------------------------------------------------
    // INITIAL STATUS
    // ----------------------------------------------------------

    let status = getCheckInStatus(now);

    let note = `Checkin: ${getLocationLabel(targetLocation)}`;

    let requiresApproval = false;

    // ----------------------------------------------------------
    // DEFAULT & ASSIGNED LOCATION DISTANCES
    // ----------------------------------------------------------

    const defaultLocRef = defaultLocation || targetLocation;
    const distanceToDefault =
      defaultLocRef?.latitude != null && defaultLocRef?.longitude != null
        ? await getRoadDistanceInMeters(
            defaultLocRef.latitude,
            defaultLocRef.longitude,
            coordinates.latitude,
            coordinates.longitude,
          )
        : Infinity;

    const distanceToAssigned =
      targetLocation?.latitude != null && targetLocation?.longitude != null
        ? await getRoadDistanceInMeters(
            targetLocation.latitude,
            targetLocation.longitude,
            coordinates.latitude,
            coordinates.longitude,
          )
        : distanceToDefault;

    const officeDistance = Number.isFinite(distanceToDefault)
      ? distanceToDefault
      : Number.isFinite(distanceToAssigned)
        ? distanceToAssigned
        : checkinDistance;

    // ----------------------------------------------------------
    // EMPLOYEE IS INSIDE A LOCATION
    // ----------------------------------------------------------

    if (checkinLocation && checkinDistance <= (checkinLocation.radius ?? 50)) {
      const isAssignedLocation =
        (profile.locationId && profile.locationId === checkinLocation.id) ||
        (targetLocation && targetLocation.id === checkinLocation.id);

      const isDefaultLocation =
        defaultLocation && checkinLocation.id === defaultLocation.id;

      if (!isAssignedLocation && !isDefaultLocation) {
        requiresApproval = true;

        status = "PENDING_APPROVAL";

        note = `Checkin to unassigned location: ${checkinLocation.name} (${formatDistanceKm(
          officeDistance,
        )} away). Reason: ${
          normalizedReason || "No reason provided"
        }. Pending admin approval.`;
      } else {
        note = `Checkin: ${checkinLocation.name}`;
      }
    } else {
      // --------------------------------------------------------
      // EMPLOYEE IS OUTSIDE LOCATION
      // --------------------------------------------------------

      const allowedRadius = targetLocation?.radius ?? 50;

      if (targetLocation && distanceToAssigned > allowedRadius) {
        if (!normalizedReason) {
          return res.status(403).json({
            message: `You are ${formatDistanceKm(
              distanceToAssigned,
            )} away from the assigned location. Please check in within ${formatDistanceKm(
              allowedRadius,
            )} of ${targetLocation.name}.`,
          });
        }

        requiresApproval = true;

        status = "PENDING_APPROVAL";

        note = `Checkin from unassigned location (${formatDistanceKm(
          officeDistance,
        )} away). Reason: ${normalizedReason}. Pending admin approval.`;
      } else if (!targetLocation && normalizedReason) {
        requiresApproval = true;

        status = "PENDING_APPROVAL";

        const distStr = Number.isFinite(officeDistance)
          ? ` (${formatDistanceKm(officeDistance)} away)`
          : "";

        note = `Checkin from unassigned location${distStr}. Reason: ${normalizedReason}. Pending admin approval.`;
      }
    }

    // ----------------------------------------------------------
    // CREATE EMPLOYEE ATTENDANCE
    // ----------------------------------------------------------

    const record = await prisma.attendance.create({
      data: {
        employeeId: profile.id,

        date: today,

        checkIn: now,

        status,

        note: fitAttendanceNote(note),

        checkInLatitude: coordinates.latitude,

        checkInLongitude: coordinates.longitude,

        checkOutLatitude: null,

        checkOutLongitude: null,
      },
    });

    const message = requiresApproval
      ? `Checked in to ${
          checkinLocation?.name || "unassigned location"
        }. Awaiting admin approval.`
      : "Checked in successfully.";

    return res.json({
      record,
      message,
    });
  } catch (err) {
    console.error("Check-in error:", err);

    console.error("Error stack:", err.stack);

    return res.status(500).json({
      message: "Failed to check in.",
    });
  }
});

// ============================================================
// GET /api/attendance/checkin-location
// ============================================================

router.get("/checkin-location", requireAuth, async (req, res) => {
  // Allow ADMIN and EMPLOYEE
  if (req.user.role !== "ADMIN" && req.user.role !== "EMPLOYEE") {
    return res.status(403).json({
      message: "Access denied. Admin or Employee role required.",
    });
  }

  try {
    let profile = await prisma.employeeProfile.findUnique({
      where: {
        userId: req.user.id,
      },
      include: {
        location: true,
      },
    });

    // --------------------------------------------------------
    // ADMIN PROFILE
    // --------------------------------------------------------

    if (!profile && req.user.role === "ADMIN") {
      const user = await prisma.user.findUnique({
        where: {
          id: req.user.id,
        },
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

          include: {
            location: true,
          },
        });
      }
    }

    if (!profile) {
      return res.status(404).json({
        message: "Employee profile not found.",
      });
    }

    // --------------------------------------------------------
    // ADMIN DOES NOT REQUIRE A LOCATION
    // --------------------------------------------------------

    if (req.user.role === "ADMIN") {
      return res.json({
        location: null,
        admin: true,
        message:
          "Admin attendance uses current GPS location and does not require an assigned location.",
      });
    }

    // --------------------------------------------------------
    // EMPLOYEE LOCATION
    // --------------------------------------------------------

    const targetLocation = await getTargetLocation(profile);

    if (!targetLocation) {
      return res.status(404).json({
        message:
          "No assigned or default location is configured. Please ask admin to create one.",
      });
    }

    return res.json({
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

    return res.status(500).json({
      message: "Failed to load check-in location.",
    });
  }
});

// ============================================================
// POST /api/attendance/checkout
// ============================================================

router.post("/checkout", requireAuth, async (req, res) => {
  // Allow ADMIN and EMPLOYEE
  if (req.user.role !== "ADMIN" && req.user.role !== "EMPLOYEE") {
    return res.status(403).json({
      message: "Access denied. Admin or Employee role required.",
    });
  }

  try {
    // --------------------------------------------------------
    // FIND EMPLOYEE PROFILE
    // --------------------------------------------------------

    let profile = await prisma.employeeProfile.findUnique({
      where: {
        userId: req.user.id,
      },
      include: {
        location: true,
      },
    });

    // --------------------------------------------------------
    // AUTO CREATE ADMIN PROFILE
    // --------------------------------------------------------

    if (!profile && req.user.role === "ADMIN") {
      const user = await prisma.user.findUnique({
        where: {
          id: req.user.id,
        },
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

          include: {
            location: true,
          },
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

    // --------------------------------------------------------
    // DATE
    // --------------------------------------------------------

    const now = new Date();

    const { start: today, end: tomorrow } = getIndiaDayRange(now);

    // --------------------------------------------------------
    // REQUEST BODY
    // --------------------------------------------------------

    const { location, reason } = req.body || {};

    const normalizedReason = typeof reason === "string" ? reason.trim() : "";

    // --------------------------------------------------------
    // FIND TODAY'S ATTENDANCE
    // --------------------------------------------------------

    let record = await prisma.attendance.findFirst({
      where: {
        employeeId: profile.id,

        date: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    // ========================================================
    // ADMIN CHECKOUT
    //
    // IMPORTANT:
    // - Admin requires GPS
    // - GPS is saved
    // - No location comparison
    // - No approval
    // - No Forgot Punch request
    // - Always PRESENT
    // ========================================================

    if (req.user.role === "ADMIN") {
      if (!record) {
        return res.status(400).json({
          message: "No check-in found for today. Please check in first.",
        });
      }

      if (record.checkOut) {
        return res.status(400).json({
          message: "You have already checked out today.",
        });
      }

      // ------------------------------------------------------
      // ADMIN MUST SEND GPS
      // ------------------------------------------------------

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

      // ------------------------------------------------------
      // CALCULATE WORKED HOURS & OVERTIME
      // ------------------------------------------------------

      const workedHours = calculateWorkedHours(record.checkIn, now);
      const overtimeHours = calculateOvertimeHours(workedHours);

      // ------------------------------------------------------
      // UPDATE ADMIN ATTENDANCE
      // ------------------------------------------------------

      const updated = await prisma.attendance.update({
        where: {
          id: record.id,
        },

        data: {
          checkOut: now,

          checkOutLatitude: coordinates.latitude,

          checkOutLongitude: coordinates.longitude,

          workedHours,

          overtimeHours,

          status: "PRESENT",

          note: fitAttendanceNote(
            `${record.note || ""}${record.note ? " | " : ""}Admin check-out.`,
          ),
        },
      });

      return res.json({
        record: updated,

        message: "Admin checked out successfully.",
      });
    }

    // ========================================================
    // EMPLOYEE CHECKOUT
    // ========================================================

    // --------------------------------------------------------
    // FIND PENDING FORGOT PUNCH REQUEST
    // --------------------------------------------------------

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
        const todayKey = getIndiaDateKey(now);

        if (
          correction.date === todayKey &&
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

    // --------------------------------------------------------
    // NO ATTENDANCE + FORGOT PUNCH REQUEST
    // --------------------------------------------------------

    if (!record && hasPendingForgotPunchCheckIn) {
      record = await prisma.attendance.create({
        data: {
          employeeId: profile.id,

          date: today,

          checkIn: null,

          checkOut: null,

          workedHours: null,

          status: "PRESENT",

          note: fitAttendanceNote(
            "Checkout recorded while Forgot Punch Check In request is pending.",
          ),
        },
      });
    }

    // --------------------------------------------------------
    // NO ATTENDANCE
    // --------------------------------------------------------

    if (!record) {
      return res.status(400).json({
        message: "No check-in found for today. Please check in first.",
      });
    }

    // --------------------------------------------------------
    // PENDING LOCATION APPROVAL
    // --------------------------------------------------------

    const isPendingForgotPunchOnly =
      hasPendingForgotPunchCheckIn && !record.checkIn;

    // if (record.status === "PENDING_APPROVAL" && !isPendingForgotPunchOnly) {
    //   return res.status(400).json({
    //     message:
    //       "Your check-in is pending admin approval. Check out will be available after approval.",
    //   });
    // }

    // --------------------------------------------------------
    // ALREADY CHECKED OUT
    // --------------------------------------------------------

    if (record.checkOut) {
      return res.status(400).json({
        message: "You have already checked out today.",
      });
    }

    // --------------------------------------------------------
    // EMPLOYEE LOCATION
    // --------------------------------------------------------

    const targetLocation = await getTargetLocation(profile);

    const defaultLocation = await prisma.location.findFirst({
      where: {
        isDefault: true,
        isActive: true,
      },
    });

    const comparisonLocation = targetLocation || defaultLocation;

    // --------------------------------------------------------
    // LOCATION VALIDATION
    // --------------------------------------------------------

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

    // --------------------------------------------------------
    // DISTANCE
    // --------------------------------------------------------

    const allowedRadius = comparisonLocation?.radius ?? 50;

    const distance = comparisonLocation
      ? getDistanceInMeters(
          comparisonLocation.latitude,
          comparisonLocation.longitude,
          coordinates.latitude,
          coordinates.longitude,
        )
      : Infinity;

    // --------------------------------------------------------
    // WORKED HOURS & OVERTIME
    // --------------------------------------------------------

    const workedHours = calculateWorkedHours(record.checkIn, now);
    const overtimeHours = calculateOvertimeHours(workedHours);

    const isOutside = !!comparisonLocation && distance > allowedRadius;

    // --------------------------------------------------------
    // OUTSIDE LOCATION
    // --------------------------------------------------------

    if (isOutside || (!comparisonLocation && normalizedReason)) {
      const reasonText = normalizedReason
        ? ` Reason: ${normalizedReason}.`
        : "";

      const defaultLocRef = defaultLocation || comparisonLocation;
      const distanceToDefault = defaultLocRef?.latitude != null && defaultLocRef?.longitude != null
        ? await getRoadDistanceInMeters(
            defaultLocRef.latitude,
            defaultLocRef.longitude,
            coordinates.latitude,
            coordinates.longitude,
          )
        : distance;

      const distToUse = Number.isFinite(distanceToDefault) ? distanceToDefault : distance;

      const distStr = Number.isFinite(distToUse)
        ? ` (${formatDistanceKm(distToUse)} away)`
        : "";

      const checkoutNote = comparisonLocation
        ? `Checkout outside assigned location (${formatDistanceKm(
            distToUse,
          )} away). Pending admin approval.${reasonText}`
        : `Checkout from unassigned location${distStr}. Pending admin approval.${reasonText || " No reason provided."}`;

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

          overtimeHours,

          status: "PENDING_APPROVAL",

          note: fitAttendanceNote(updatedNote),
        },
      });

      return res.json({
        record: updated,

        message: "Checked out outside location — pending admin approval.",
      });
    }

    // --------------------------------------------------------
    // NORMAL EMPLOYEE CHECKOUT
    // --------------------------------------------------------

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

        overtimeHours,

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

    return res.status(500).json({
      message: "Failed to check out.",
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

const enrichAttendanceRecordsWithDistance = async (records) => {
  const defaultLocation =
    (await prisma.location.findFirst({
      where: { isDefault: true, isActive: true },
    })) ||
    (await prisma.location.findFirst({
      where: { isDefault: true },
    })) ||
    (await prisma.location.findFirst({
      where: { isActive: true },
    })) ||
    (await prisma.location.findFirst());

  return Promise.all(
    (records || []).map(async (record) => {
      let empLocation = record.employee?.location;
      if (!empLocation && record.employeeId) {
        const emp = await prisma.employeeProfile.findUnique({
          where: { id: record.employeeId },
          include: { location: true },
        });
        empLocation = emp?.location;
      }
      const targetLoc =
        (defaultLocation?.latitude != null && defaultLocation?.longitude != null)
          ? defaultLocation
          : ((empLocation?.latitude != null && empLocation?.longitude != null)
              ? empLocation
              : null);

      let checkInDistance = null;
      let checkOutDistance = null;

      if (
        record.checkInLatitude != null &&
        record.checkInLongitude != null &&
        targetLoc?.latitude != null &&
        targetLoc?.longitude != null
      ) {
        const distMeters = await getRoadDistanceInMeters(
          targetLoc.latitude,
          targetLoc.longitude,
          record.checkInLatitude,
          record.checkInLongitude,
        );
        checkInDistance = formatDistanceKm(distMeters);
      }

      if (
        record.checkOutLatitude != null &&
        record.checkOutLongitude != null &&
        targetLoc?.latitude != null &&
        targetLoc?.longitude != null
      ) {
        const distMeters = await getRoadDistanceInMeters(
          targetLoc.latitude,
          targetLoc.longitude,
          record.checkOutLatitude,
          record.checkOutLongitude,
        );
        checkOutDistance = formatDistanceKm(distMeters);
      }

      return {
        ...record,
        checkInDistance: checkInDistance || record.checkInDistance || null,
        checkOutDistance: checkOutDistance || record.checkOutDistance || null,
      };
    }),
  );
};

// GET /api/attendance/pending-approvals - Get all pending check-in approvals
router.get("/pending-approvals", async (req, res) => {
  // Allow ADMIN with permission OR any EMPLOYEE to see their own pending
  if (req.user.role === "ADMIN") {
    const hasPermission = await requireAdminOrModulePermission(
      ["attendance", "approvals", "attendance-management"],
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
            location: true,
            user: {
              select: { fullName: true, email: true },
            },
          },
        },
      },
      orderBy: { date: "desc" },
    });

    const enriched = await enrichAttendanceRecordsWithDistance(pendingRecords);

    console.log(
      `[GET /pending-approvals] Returning ${enriched.length} pending record(s) for ${req.user.role}.`,
    );

    res.json({ pendingRecords: enriched });
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
      include: { location: true },
    });
    if (!profile)
      return res.status(404).json({ message: "Employee profile not found." });

    const records = await prisma.attendance.findMany({
      where: {
        employeeId: profile.id,
        OR: [
          { note: { contains: "Pending admin approval" } },
          { note: { contains: "Admin approved" } },
          { note: { contains: "Admin rejected" } },
          { note: { contains: "Approved by admin" } },
          { note: { contains: "Rejected by admin" } },
          { status: "PENDING_APPROVAL" },
        ],
      },
      orderBy: { updatedAt: "desc" },
    });

    const enriched = await enrichAttendanceRecordsWithDistance(records);

    res.json({ records: enriched });
  } catch (err) {
    console.error("Get employee attendance requests error:", err);
    res.status(500).json({ message: "Failed to load attendance requests." });
  }
});

// GET /api/attendance/admin/requests - all attendance approval history
router.get(
  "/admin/requests",
  requireAdminOrModulePermission(["attendance", "approvals", "attendance-management"], "canView"),
  async (req, res) => {
    try {
      const rawRecords = await prisma.attendance.findMany({
        where: {
          OR: [
            { note: { contains: "Pending admin approval" } },
            { note: { contains: "Approved by admin" } },
            { note: { contains: "Rejected by admin" } },
            { note: { contains: "Admin approved" } },
            { note: { contains: "Admin rejected" } },
            { note: { contains: "unassigned location" } },
            { note: { contains: "requires approval" } },
            { status: "PENDING_APPROVAL" },
          ],
        },
        include: {
          employee: {
            include: {
              location: true,
              user: { select: { fullName: true, email: true } },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      const records = rawRecords.filter((rec) => {
        if (
          rec.note?.includes("Checkout recorded while Forgot Punch Check In request is pending.") &&
          !rec.note?.includes("outside") &&
          !rec.note?.includes("unassigned") &&
          !rec.note?.includes("requires approval")
        ) {
          return false;
        }
        return true;
      });

      const enriched = await enrichAttendanceRecordsWithDistance(records);

      res.json({ records: enriched });
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

// GET /api/attendance/register/weekly?days=7 - employee attendance register.
router.get("/register/weekly", async (req, res) => {
  // Determine if caller has administrative attendance access (ADMIN or EMPLOYEE with attendance module permission)
  let isFullManager = req.user.role === "ADMIN";

  if (req.user.role === "ADMIN") {
    const hasPermission = await requireAdminOrModulePermission(
      "attendance",
      "canView",
    )(req, res, () => true);
    if (res.headersSent) return; // Permission denied
  } else if (req.user.role === "EMPLOYEE") {
    // Check if employee has attendance module permission via custom role or direct permission
    let roleId = req.user.roleId;
    if (!roleId) {
      const dbUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { roleId: true },
      });
      roleId = dbUser?.roleId || null;
    }

    if (roleId) {
      const roleMod = await prisma.roleModule.findUnique({
        where: {
          roleId_moduleKey: {
            roleId,
            moduleKey: "attendance",
          },
        },
      });
      if (roleMod) isFullManager = true;
    }

    if (!isFullManager) {
      const directPerm = await prisma.modulePermission.findUnique({
        where: {
          userId_moduleKey: {
            userId: req.user.id,
            moduleKey: "attendance",
          },
        },
      });
      if (directPerm?.canView) isFullManager = true;
    }
  } else {
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

    const employeeFilter = isFullManager ? {} : { userId: req.user.id };

    const [
      employees,
      attendanceRecords,
      holidays,
      leaveRequests,
      pendingCorrectionRequests,
    ] = await Promise.all([
      prisma.employeeProfile.findMany({
        where: employeeFilter,
        include: { user: { select: { fullName: true, email: true } } },
        orderBy: { employeeCode: "asc" },
      }),
      prisma.attendance.findMany({
        where: {
          date: { gte: attendanceQueryStart, lt: attendanceQueryEnd },
          ...(isFullManager ? {} : { employee: { userId: req.user.id } }),
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
          ...(isFullManager ? {} : { employee: { userId: req.user.id } }),
        },
        include: { leaveType: { select: { name: true, code: true } } },
      }),
      prisma.employeeRequest.findMany({
        where: {
          type: "CORRECTION",
          status: "PENDING",
          ...(isFullManager ? {} : { employee: { userId: req.user.id } }),
        },
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
        const pendingCorrection =
          pendingCorrectionByEmployeeAndDate.get(mapKey);

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
          fullName: employee.user?.fullName || "Employee",
          email: employee.user?.email || "",
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

// POST /api/attendance/:id/reject - reject pending attendance (ADMIN)
// ============================================================================
// APPROVE ATTENDANCE
// POST /api/attendance/approve/:id or POST /api/attendance/:id/approve
// ============================================================================

router.post(
  ["/approve/:id", "/:id/approve"],
  requireAdminOrModulePermission(["attendance", "approvals", "attendance-management"], "canEdit"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const record = await prisma.attendance.findUnique({
        where: { id },
        include: { employee: true },
      });

      if (!record) {
        return res.status(404).json({
          message: "Attendance record not found.",
        });
      }

      if (record.status !== "PENDING_APPROVAL") {
        return res.status(400).json({
          message: "Record is not pending approval.",
        });
      }

      const workedHours = calculateWorkedHours(record.checkIn, record.checkOut);

      const updatedNote = record.note
        ? `${record.note} | Admin approved.`
        : "Admin approved.";

      const updated = await prisma.attendance.update({
        where: { id },

        data: {
          status: "PRESENT",
          workedHours,
          note: fitAttendanceNote(updatedNote),
        },
      });

      return res.json({
        record: updated,
        message: "Check-in approved successfully.",
      });
    } catch (err) {
      console.error("Approve check-in error:", err);

      return res.status(500).json({
        message: "Failed to approve check-in.",
      });
    }
  },
);

// ============================================================================
// REJECT ATTENDANCE
// POST /api/attendance/reject/:id or POST /api/attendance/:id/reject
// ============================================================================

router.post(
  ["/reject/:id", "/:id/reject"],
  requireAdminOrModulePermission(["attendance", "approvals", "attendance-management"], "canEdit"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const reason =
        typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

      const record = await prisma.attendance.findUnique({
        where: { id },
        include: { employee: true },
      });

      if (!record) {
        return res.status(404).json({
          message: "Attendance record not found.",
        });
      }

      if (record.status !== "PENDING_APPROVAL") {
        return res.status(400).json({
          message: "Record is not pending approval.",
        });
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
          note: fitAttendanceNote(updatedNote),
        },
      });

      return res.json({
        record: updated,
        message: "Check-in rejected successfully.",
      });
    } catch (err) {
      console.error("Reject check-in error:", err);

      return res.status(500).json({
        message: "Failed to reject check-in.",
      });
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

        const isSunday = !isWorkingDay(current);
        const holidayObj = holidayByDate.get(key);
        const holidayNote = holidayObj?.name || (isSunday ? "Weekly Off (Sunday)" : null);

        if (existing) {
          const status = pendingCorrection
            ? "PENDING_APPROVAL"
            : existing.status;
          if (summary[status] !== undefined) summary[status] += 1;
          populatedRecords.push({
            id: existing.id,
            date: existing.date,
            checkIn: pendingCorrection?.checkInTime
              ? new Date(`${key}T${pendingCorrection.checkInTime}:00+05:30`)
              : existing.checkIn,
            checkOut: pendingCorrection?.checkOutTime
              ? new Date(`${key}T${pendingCorrection.checkOutTime}:00+05:30`)
              : existing.checkOut,
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
              : existing.note || holidayNote,
          });
          continue;
        }

        if (!isWorkingDay(current)) {
          summary.HOLIDAY += 1;
          populatedRecords.push({
            id: null,
            date: new Date(current),
            checkIn: null,
            checkOut: null,
            status: "HOLIDAY",
            workedHours: null,
            note: holidayByDate.get(key)?.name || "Weekly Off (Sunday)",
          });
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
            note: holidayByDate.get(key)?.name || "Holiday",
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

        if (pendingCorrection?.checkInTime || pendingCorrection?.checkOutTime) {
          summary.PENDING_APPROVAL += 1;
          populatedRecords.push({
            id: null,
            date: new Date(current),
            checkIn: pendingCorrection?.checkInTime
              ? new Date(`${key}T${pendingCorrection.checkInTime}:00+05:30`)
              : null,
            checkOut: pendingCorrection?.checkOutTime
              ? new Date(`${key}T${pendingCorrection.checkOutTime}:00+05:30`)
              : null,
            status: "PENDING_APPROVAL",
            workedHours: null,
            note: "Forgot Punch pending approval.",
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

export default router;
