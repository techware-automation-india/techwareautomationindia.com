import { Router } from "express";
import prisma from "../prismaClient.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { requireAdminOrModulePermission } from "../middleware/checkModulePermission.js";
import { checkRolePermission } from "../middleware/checkRolePermission.js";

const router = Router();

// All routes require authentication
router.use(requireAuth);

const REGULAR_WORKING_HOURS = 8;
const fitAttendanceNote = (note) => {
  if (note == null) return note;
  return String(note);
};

const INDIA_TIME_ZONE = "Asia/Kolkata";

const formatTime12h = (time) => {
  if (!time) return "—";
  if (time instanceof Date) {
    return time.toLocaleTimeString("en-US", {
      timeZone: INDIA_TIME_ZONE,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }
  const parts = String(time).split(":");
  if (parts.length < 2) return String(time);
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return String(time);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
};

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

// Anything above 8 hours on normal days is overtime rounded to 15-minute intervals.
// On Sundays or Holidays (Festival / National / Optional), ALL working time counts as overtime.
const calculateOvertimeHours = (workedHours, isHolidayOrSunday = false) => {
  if (workedHours == null) return 0;

  const hours = Number(workedHours);

  if (!Number.isFinite(hours) || hours <= 0) {
    return 0;
  }

  if (isHolidayOrSunday) {
    const rawMinutes = Math.round(hours * 60);
    const roundedOtMinutes = Math.floor(rawMinutes / 15) * 15;
    return roundedOtMinutes > 0 ? parseFloat((roundedOtMinutes / 60).toFixed(2)) : 0;
  }

  if (hours <= REGULAR_WORKING_HOURS) {
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

const isShortDayHours = (workedHours, isHolidayOrSunday = false) => {
  if (isHolidayOrSunday || workedHours == null) return false;
  const hours = Number(workedHours);
  return Number.isFinite(hours) && hours > 0 && hours < REGULAR_WORKING_HOURS;
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

  return null;
};

const getRosterShift = async (profileId, date = new Date()) => {
  const dateKey = getIndiaDateKey(date);
  const { start, end } = getIndiaDayRange(date);

  const rosterEntry = await prisma.rosterEntry.findFirst({
    where: {
      employeeId: profileId,
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
    include: { shift: true },
    orderBy: { updatedAt: "desc" },
  });

  return rosterEntry?.shift ?? null;
};

const getShiftMatchingTime = async (date = new Date()) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;

  // Convert to Indian Standard Time (IST) HH:mm minutes
  const timeStr = d.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [h, m] = timeStr.split(":").map(Number);
  const currentMinutes = h * 60 + m;

  const allActiveShifts = await prisma.shift.findMany({
    where: { isActive: true },
  });

  if (!allActiveShifts || allActiveShifts.length === 0) return null;

  // Prepare shifts with startMins and endMins
  const processedShifts = allActiveShifts
    .filter((s) => Boolean(s.startTime))
    .map((s) => {
      const [sh, sm] = s.startTime.split(":").map(Number);
      const startMins = sh * 60 + sm;

      let endMins = startMins + 480;
      if (s.endTime) {
        const [eh, em] = s.endTime.split(":").map(Number);
        endMins = eh * 60 + em;
      }
      const isOvernight = endMins <= startMins;

      return {
        shift: s,
        startMins,
        endMins,
        isOvernight,
      };
    });

  if (processedShifts.length === 0) return null;

  // Find shifts that current time is currently inside [startMins, endMins)
  const insideShifts = processedShifts.filter(({ startMins, endMins, isOvernight }) => {
    if (isOvernight) {
      return currentMinutes >= startMins || currentMinutes < endMins;
    }
    return currentMinutes >= startMins && currentMinutes < endMins;
  });

  if (insideShifts.length > 0) {
    // If multiple shifts are active at this moment, pick the one that started MOST RECENTLY
    // (i.e. highest start time that is <= currentMinutes, accounting for midnight wrap)
    insideShifts.sort((a, b) => {
      const elapsedA = (currentMinutes - a.startMins + 1440) % 1440;
      const elapsedB = (currentMinutes - b.startMins + 1440) % 1440;
      return elapsedA - elapsedB; // smallest elapsed time since start is the freshest start
    });
    return insideShifts[0].shift;
  }

  // If outside all shift windows, find the shift with start time closest to current time
  let bestShift = null;
  let minDiff = Infinity;

  for (const item of processedShifts) {
    let diff = Math.abs(currentMinutes - item.startMins);
    if (diff > 720) diff = 1440 - diff;
    if (diff < minDiff) {
      minDiff = diff;
      bestShift = item.shift;
    }
  }

  return bestShift;
};

const getTargetShift = async (profile, date = new Date()) => {
  // 1. Roster shift priority
  const rosterShift = await getRosterShift(profile.id, date);
  if (rosterShift) {
    return rosterShift;
  }

  // 2. Employee profile assigned shift
  if (profile?.shift) {
    return profile.shift;
  }
  if (profile?.shiftId) {
    const assignedShift = await prisma.shift.findUnique({
      where: { id: profile.shiftId },
    });
    if (assignedShift) return assignedShift;
  }

  // 3. Match shift dynamically according to check-in / current time
  const timeMatchedShift = await getShiftMatchingTime(date);
  if (timeMatchedShift) return timeMatchedShift;

  // 4. System Default shift
  const defaultShift = await prisma.shift.findFirst({
    where: { isDefault: true, isActive: true },
  });
  if (defaultShift) return defaultShift;

  // 5. Any active shift fallback
  const fallbackShift = await prisma.shift.findFirst({
    where: { isActive: true },
  });
  return fallbackShift ?? null;
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
  let trimmedTime = String(timeValue).trim();

  if (!trimmedDate || !trimmedTime) return null;

  if (trimmedTime.includes("T")) {
    trimmedTime = trimmedTime.split("T")[1];
  }
  const timeMatch = trimmedTime.match(/^(\d{1,2}):(\d{1,2})/);
  if (!timeMatch) return null;

  const hours = String(timeMatch[1]).padStart(2, "0");
  const minutes = String(timeMatch[2]).padStart(2, "0");

  // IMPORTANT: Manual attendance time is always India Standard Time (IST)
  const safeDate = new Date(`${trimmedDate}T${hours}:${minutes}:00+05:30`);

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

const isHolidayOrSundayDate = async (date) => {
  if (!date) return false;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return false;

  const dateKey = getIndiaDateKey(d);
  if (!dateKey) return false;

  const istDate = new Date(`${dateKey}T12:00:00+05:30`);
  if (istDate.getDay() === 0) return true; // Sunday

  const isoStr = d.toISOString().slice(0, 10);
  const holiday = await prisma.holiday.findFirst({
    where: {
      OR: [
        { date: new Date(`${dateKey}T00:00:00+05:30`) },
        { date: new Date(`${isoStr}T00:00:00.000Z`) },
      ],
    },
  });

  return Boolean(holiday);
};

const getUnclosedPreviousAttendance = async (profileId) => {
  const now = new Date();
  const { start: todayStart } = getIndiaDayRange(now);

  // Find the immediate last attendance record strictly before today
  // (e.g. yesterday, or the most recent prior working day)
  const lastRecord = await prisma.attendance.findFirst({
    where: {
      employeeId: profileId,
      date: {
        lt: todayStart,
      },
    },
    orderBy: { date: "desc" },
  });

  // Only check if THAT immediate last attendance record has checkIn without checkOut
  if (!lastRecord || !lastRecord.checkIn || lastRecord.checkOut) {
    return null;
  }

  // If the previous check-in is within the last 24 hours (e.g. overnight night shift),
  // it is STILL ACTIVE for checkout in Mark Attendance, NOT a missing forgotten checkout!
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (new Date(lastRecord.checkIn).getTime() >= twentyFourHoursAgo.getTime()) {
    return null;
  }

  const previousRecord = lastRecord;

  const prevDateKey = getIndiaDateKey(previousRecord.date);
  const { start: prevStart, end: prevEnd } = getIndiaDayRange(previousRecord.date);

  // Also check if employee was on approved leave on that previous day
  const previousLeave = await prisma.leaveRequest.findFirst({
    where: {
      employeeId: profileId,
      status: "APPROVED",
      startDate: { lte: prevEnd },
      endDate: { gte: prevStart },
    },
  });

  // If approved leave on that day, no uncompleted attendance required
  if (previousLeave) {
    return null;
  }

  // Find any check-out correction request for that previous day
  const employeeRequests = await prisma.employeeRequest.findMany({
    where: {
      employeeId: profileId,
      type: "CORRECTION",
    },
    orderBy: { createdAt: "desc" },
  });

  let matchingRequest = null;
  for (const req of employeeRequests) {
    if (!req.description) continue;
    const isMatchingDate =
      req.description.includes(`"date":"${prevDateKey}"`) ||
      req.description.includes(prevDateKey);
    const isCheckoutType =
      req.description.includes(`"punchType":"check-out"`) ||
      req.description.includes(`"punchType":"both"`) ||
      req.description.includes("check-out") ||
      req.description.includes("Check Out");

    if (isMatchingDate && isCheckoutType) {
      matchingRequest = req;
      break;
    }
  }

  return {
    record: {
      id: previousRecord.id,
      date: previousRecord.date,
      dateKey: prevDateKey,
      checkIn: previousRecord.checkIn,
      isMissingEntireAttendance: false,
    },
    correctionRequest: matchingRequest
      ? {
          id: matchingRequest.id,
          status: matchingRequest.status,
          createdAt: matchingRequest.createdAt,
          reviewNote: matchingRequest.reviewNote,
        }
      : null,
  };
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

    const [records, holidays, leaveRequests, rosterEntries, defaultShift, profileWithShift] = await Promise.all([
      prisma.attendance.findMany({
        where: { employeeId: profile.id, date: { gte: start, lt: end } },
        include: { shift: true },
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
      prisma.rosterEntry.findMany({
        where: {
          employeeId: profile.id,
          date: { gte: start, lt: end },
        },
        include: { shift: true },
      }),
      prisma.shift.findFirst({
        where: { isDefault: true, isActive: true },
      }),
      prisma.employeeProfile.findUnique({
        where: { id: profile.id },
        include: { shift: true },
      }),
    ]);

    const isAdminUser = req.user.role === "ADMIN";

    const rosterShiftByDate = new Map(
      rosterEntries.map((re) => [formatDateKey(re.date), re.shift]),
    );

    const getAssignedShiftForDate = (dateKey, attendanceRecord = null) => {
      if (attendanceRecord?.shift) return attendanceRecord.shift;
      if (rosterShiftByDate.has(dateKey)) return rosterShiftByDate.get(dateKey);
      // Only show profile or default shift if employee has actually checked in on that day
      if (attendanceRecord?.checkIn) {
        if (profileWithShift?.shift) return profileWithShift.shift;
        return defaultShift ?? null;
      }
      // If employee did not check in and has no roster assignment, do not print a shift
      return null;
    };

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
        leaveByDate.set(curKey, leave);
        curDate.setDate(curDate.getDate() + 1);
      }
    }

    const summary = { PRESENT: 0, SHORT_DAY: 0, ABSENT: 0, ON_LEAVE: 0, HOLIDAY: 0 };
    const populatedRecords = [];
    const todayKey = getIndiaDateKey(new Date());
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, "0");
      const key = `${year}-${monthStr}-${dayStr}`;
      const attendance = attendanceByDate.get(key);

      if (attendance) {
        let status = attendance.status;
        let note = attendance.note;

        if (leaveByDate.has(key) && status !== "PRESENT") {
          status = "ON_LEAVE";
          note = `Approved leave: ${leaveByDate.get(key).leaveType?.name || leaveByDate.get(key).leaveType?.code || "Leave"}`;
        } else if (holidayByDate.has(key) && status !== "PRESENT") {
          status = "HOLIDAY";
          note = holidayByDate.get(key);
        }

        if (summary[status] !== undefined) {
          summary[status] += 1;
        }

        const workedHours =
          attendance.workedHours ??
          calculateWorkedHours(attendance.checkIn, attendance.checkOut);

        const isHolOrSun = !isWorkingDay(key) || holidayByDate.has(key);
        const overtimeHours = calculateOvertimeHours(workedHours, isHolOrSun);
        const isShortDay = isShortDayHours(workedHours, isHolOrSun);

        if (isShortDay) {
          summary.SHORT_DAY += 1;
        }

        const dayShift = getAssignedShiftForDate(key, attendance);

        populatedRecords.push({
          id: attendance.id,
          date: attendance.date,
          checkIn: attendance.checkIn,
          checkOut: attendance.checkOut,
          status,
          shift: dayShift
            ? {
                id: dayShift.id,
                name: dayShift.name,
                startTime: dayShift.startTime,
                endTime: dayShift.endTime,
                isDefault: dayShift.isDefault,
              }
            : null,
          workedHours,
          overtimeHours,
          isShortDay,
          note,
          createdAt: attendance.createdAt,
          updatedAt: attendance.updatedAt,
        });

        continue;
      }

      const dayShift = getAssignedShiftForDate(key, null);
      const shiftPayload = dayShift
        ? {
            id: dayShift.id,
            name: dayShift.name,
            startTime: dayShift.startTime,
            endTime: dayShift.endTime,
            isDefault: dayShift.isDefault,
          }
        : null;

      if (leaveByDate.has(key)) {
        const leave = leaveByDate.get(key);
        summary.ON_LEAVE += 1;
        populatedRecords.push({
          id: null,
          date: new Date(`${key}T00:00:00+05:30`),
          checkIn: null,
          checkOut: null,
          status: "ON_LEAVE",
          shift: shiftPayload,
          workedHours: null,
          note: `Approved leave: ${leave.leaveType?.name || leave.leaveType?.code || "Leave"}`,
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
          shift: shiftPayload,
          workedHours: null,
          note: holidayByDate.get(key),
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
          shift: shiftPayload,
          workedHours: null,
          note: "Weekly Off (Sunday)",
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
          shift: shiftPayload,
          workedHours: null,
          note: "No attendance record.",
        });
      }
    }

    const sundayHolidays = [];
    const dbHolidayDateKeys = new Set(holidays.map((h) => formatDateKey(h.date)));

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, "0");
      const key = `${year}-${monthStr}-${dayStr}`;
      const curDate = new Date(`${key}T12:00:00+05:30`);
      if (curDate.getDay() === 0 && !dbHolidayDateKeys.has(key)) {
        sundayHolidays.push({
          date: new Date(`${key}T00:00:00+05:30`),
          name: "Sunday (Weekly Off)",
          holidayType: "OPTIONAL",
          isOptional: true,
        });
      }
    }

    const allHolidays = [...holidays, ...sundayHolidays].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    res.json({
      year,
      month,
      records: populatedRecords,
      holidays: allHolidays.map((h) => ({
        date: h.date,
        name: h.name,
        holidayType: h.holidayType || "OPTIONAL",
        isOptional: h.isOptional ?? true,
      })),
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

    // If user doesn't have employee profile, create one
    if (!profile) {
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (user && (user.role === "ADMIN" || user.role === "EMPLOYEE")) {
        const code = user.email && !user.email.includes("@")
          ? user.email
          : `${user.role === "ADMIN" ? "ADMIN" : "EMP"}-${Date.now()}`;
        profile = await prisma.employeeProfile.create({
          data: {
            userId: req.user.id,
            employeeCode: code,
            onboardingStatus: "APPROVED",
            firstName: user.fullName.split(" ")[0] || (user.role === "ADMIN" ? "Admin" : "Employee"),
            lastName: user.fullName.split(" ").slice(1).join(" ") || "",
            jobTitle: user.role === "ADMIN" ? "Administrator" : "Employee",
          },
        }).catch(() => null);
        if (profile) {
          console.log(
            `✅ Auto-created employee profile for user: ${req.user.id} (${code})`,
          );
        }
      }
    }

    if (!profile)
      return res.status(404).json({ message: "Employee profile not found." });

    // Today midnight UTC
    const now = new Date();

    const { start: today, end: tomorrow } = getIndiaDayRange(now);

    const todayDateKey = getIndiaDateKey(now);
    const [todayRecord, approvedLeave, unclosedPrevious] = await Promise.all([
      prisma.attendance.findFirst({
        where: {
          employeeId: profile.id,
          OR: [
            {
              date: {
                gte: today,
                lte: tomorrow,
              },
            },
            ...(todayDateKey
              ? [
                  { date: new Date(`${todayDateKey}T00:00:00.000Z`) },
                  { date: new Date(`${todayDateKey}T00:00:00+05:30`) },
                ]
              : []),
          ],
        },
        include: { shift: true },
        orderBy: [
          { updatedAt: "desc" },
          { date: "desc" },
        ],
      }),
      prisma.leaveRequest.findFirst({
        where: {
          employeeId: profile.id,
          status: "APPROVED",
          startDate: { lte: tomorrow },
          endDate: { gte: today },
        },
        include: { leaveType: { select: { name: true, code: true } } },
      }),
      getUnclosedPreviousAttendance(profile.id),
    ]);

    // Check if there is an active check-in from within the last 24 hours without check-out
    let activeRecord = todayRecord;
    let effectiveUnclosedPrevious = unclosedPrevious;

    // If previous unclosed record has a PENDING or APPROVED check-out correction request,
    // do NOT adopt it as activeRecord for today; let the user start their new shift today!
    const isPreviousCheckoutHandled =
      effectiveUnclosedPrevious?.correctionRequest &&
      (effectiveUnclosedPrevious.correctionRequest.status === "PENDING" ||
        effectiveUnclosedPrevious.correctionRequest.status === "APPROVED");

    if ((!activeRecord || !activeRecord.checkIn) && !isPreviousCheckoutHandled) {
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const recentShift = await prisma.attendance.findFirst({
        where: {
          employeeId: profile.id,
          date: { lt: today },
          checkIn: { gte: twentyFourHoursAgo, not: null },
          checkOut: null, // Only adopt if overnight shift is still open (unclosed)
        },
        orderBy: { date: "desc" },
      });

      if (recentShift) {
        // Less than 24 hours have passed since check-in and checkout is still pending: adopt as activeRecord!
        activeRecord = recentShift;
        effectiveUnclosedPrevious = null;
      }
    }

    let finalRecord = activeRecord;

    // Check if there is a pending or approved Forgot Punch Check In request from within the last 24 hours
    let pendingCheckInRequest = null;
    if (!finalRecord || !finalRecord.checkIn) {
      const recentCorrectionRequests = await prisma.employeeRequest.findMany({
        where: {
          employeeId: profile.id,
          type: "CORRECTION",
          status: { in: ["PENDING", "APPROVED"] },
        },
        orderBy: { createdAt: "desc" },
      });

      for (const req of recentCorrectionRequests) {
        if (!req.description) continue;
        const match = req.description.match(
          /\[ATTENDANCE_CORRECTION\]\s*(\{[\s\S]*\})\s*$/,
        );
        if (!match) continue;

        try {
          const correction = JSON.parse(match[1]);
          const todayKey = getIndiaDateKey(now);
          const isTodayCorrection =
            correction.date === todayKey &&
            (correction.punchType === "check-in" ||
              correction.punchType === "both" ||
              correction.punchType === "time-edit") &&
            correction.checkInTime;

          let isWithin24HoursCorrection = false;
          if (
            !isTodayCorrection &&
            correction.date &&
            correction.checkInTime &&
            (correction.punchType === "check-in" ||
              correction.punchType === "both" ||
              correction.punchType === "time-edit")
          ) {
            const [h, m] = String(correction.checkInTime).split(":").map(Number);
            if (Number.isFinite(h) && Number.isFinite(m)) {
              const checkInDateTime = new Date(`${correction.date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+05:30`);
              const twentyFourHoursMs = 24 * 60 * 60 * 1000;
              if (now.getTime() - checkInDateTime.getTime() <= twentyFourHoursMs && now.getTime() >= checkInDateTime.getTime()) {
                isWithin24HoursCorrection = true;
              }
            }
          }

          if (isTodayCorrection || isWithin24HoursCorrection) {
            pendingCheckInRequest = { req, correction };
            break;
          }
        } catch (e) {}
      }

      if (pendingCheckInRequest) {
        const { req, correction } = pendingCheckInRequest;
        const recordDate = new Date(`${correction.date}T00:00:00+05:30`);
        const [h, m] = String(correction.checkInTime).split(":").map(Number);
        const checkInDate = new Date(`${correction.date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+05:30`);

        // Check if an actual attendance record already exists in the database for this date
        const existingForDate = await prisma.attendance.findFirst({
          where: {
            employeeId: profile.id,
            OR: [
              { date: recordDate },
              { date: new Date(`${correction.date}T00:00:00.000Z`) }
            ],
          },
          orderBy: { updatedAt: "desc" },
        });

        if (existingForDate) {
          finalRecord = {
            ...existingForDate,
            checkIn: existingForDate.checkIn || checkInDate,
            isPendingCheckIn: req.status === "PENDING",
          };
        } else {
          finalRecord = {
            id: null,
            employeeId: profile.id,
            date: recordDate,
            checkIn: checkInDate,
            checkOut: null,
            status: "PRESENT",
            note: req.status === "APPROVED" ? "Approved Forgot Punch Check In" : "Pending Forgot Punch Check In",
            isPendingCheckIn: req.status === "PENDING",
          };
        }
        effectiveUnclosedPrevious = null;
      }
    }

    if (!finalRecord && approvedLeave) {
      finalRecord = {
        id: null,
        employeeId: profile.id,
        date: today,
        status: "ON_LEAVE",
        note: `Approved leave: ${approvedLeave.leaveType?.name || approvedLeave.leaveType?.code || "Leave"}`,
      };
    } else if (finalRecord && approvedLeave && finalRecord.status !== "PRESENT") {
      finalRecord = {
        ...finalRecord,
        status: "ON_LEAVE",
        note: `Approved leave: ${approvedLeave.leaveType?.name || approvedLeave.leaveType?.code || "Leave"}`,
      };
    }

    const targetShift = await getTargetShift(profile, now);
    const assignedLoc = (await getRosterLocation(profile.id)) || profile?.location || (profile?.locationId ? await prisma.location.findUnique({ where: { id: profile.locationId } }) : null);
    const shiftPayload = finalRecord?.shift || (targetShift
      ? {
          id: targetShift.id,
          name: targetShift.name,
          startTime: targetShift.startTime,
          endTime: targetShift.endTime,
          isDefault: targetShift.isDefault,
        }
      : null);

    const locationPayload = assignedLoc
      ? {
          id: assignedLoc.id,
          name: assignedLoc.name,
          address: assignedLoc.address,
          city: assignedLoc.city,
          latitude: assignedLoc.latitude,
          longitude: assignedLoc.longitude,
          radiusMeters: assignedLoc.radiusMeters,
        }
      : null;

    if (finalRecord) {
      finalRecord = {
        ...finalRecord,
        shift: shiftPayload,
      };
    }

    res.json({
      record: finalRecord ?? null,
      shift: shiftPayload,
      location: locationPayload,
      approvedLeave: approvedLeave ?? null,
      unclosedPrevious: effectiveUnclosedPrevious ?? null,
    });
  } catch (err) {
    console.error("Employee get today attendance error:", err);
    res.status(500).json({ message: "Failed to load today's attendance." });
  }
});

// GET /api/attendance/by-date?date=YYYY-MM-DD[&employeeId=ID]
// Fetches the saved attendance record and leave status for the selected date.
router.get("/by-date", requireAuth, async (req, res) => {
  try {
    const { date, employeeId } = req.query;
    if (!date) {
      return res.status(400).json({ message: "Date is required (YYYY-MM-DD)." });
    }

    let targetProfile = null;

    if (req.user.role === "ADMIN" && employeeId) {
      targetProfile = await prisma.employeeProfile.findUnique({
        where: { id: employeeId },
        include: { user: { select: { fullName: true, email: true } } },
      });
      if (!targetProfile) {
        targetProfile = await prisma.employeeProfile.findUnique({
          where: { userId: employeeId },
          include: { user: { select: { fullName: true, email: true } } },
        });
      }
    }

    if (!targetProfile) {
      targetProfile = await prisma.employeeProfile.findUnique({
        where: { userId: req.user.id },
        include: { user: { select: { fullName: true, email: true } } },
      });
    }

    if (!targetProfile) {
      return res.status(404).json({ message: "Employee profile not found." });
    }

    const selectedDate = new Date(`${date}T00:00:00+05:30`);
    if (Number.isNaN(selectedDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format." });
    }
    const nextDate = new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000);

    const [record, approvedLeave] = await Promise.all([
      prisma.attendance.findFirst({
        where: {
          employeeId: targetProfile.id,
          date: {
            gte: selectedDate,
            lt: nextDate,
          },
        },
      }),
      prisma.leaveRequest.findFirst({
        where: {
          employeeId: targetProfile.id,
          status: "APPROVED",
          startDate: { lt: nextDate },
          endDate: { gte: selectedDate },
        },
        include: { leaveType: { select: { name: true, code: true } } },
      }),
    ]);

    let checkInTime = null;
    let checkOutTime = null;

    if (record?.checkIn) {
      checkInTime = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(record.checkIn));
    }

    if (record?.checkOut) {
      checkOutTime = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(record.checkOut));
    }

    return res.json({
      date,
      employee: {
        id: targetProfile.id,
        employeeCode: targetProfile.employeeCode,
        fullName: targetProfile.user?.fullName,
      },
      record: record
        ? {
            id: record.id,
            status: record.status,
            checkIn: record.checkIn,
            checkOut: record.checkOut,
            checkInTime,
            checkOutTime,
            workedHours: record.workedHours,
            overtimeHours: record.overtimeHours,
            note: record.note,
            checkInLatitude: record.checkInLatitude,
            checkInLongitude: record.checkInLongitude,
            checkOutLatitude: record.checkOutLatitude,
            checkOutLongitude: record.checkOutLongitude,
          }
        : null,
      approvedLeave: approvedLeave
        ? {
            id: approvedLeave.id,
            leaveTypeName: approvedLeave.leaveType?.name || approvedLeave.leaveType?.code,
          }
        : null,
    });
  } catch (err) {
    console.error("Get attendance by date error:", err);
    return res.status(500).json({ message: "Failed to load attendance for the selected date." });
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
    const { date, punchType, checkInTime, checkOutTime, reason, employeeId, isOvernight } =
      req.body || {};

    const isTimeEdit = punchType === "time-edit";
    const normalizedType =
      isTimeEdit
        ? "time-edit"
        : punchType === "check-out"
          ? "check-out"
          : punchType === "both"
            ? "both"
            : "check-in";

    let manualReason = typeof reason === "string" ? reason.trim() : "";
    if (!manualReason && isTimeEdit) {
      manualReason = "Time Edit";
    }

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

    let profile = null;

    if (req.user.role === "ADMIN" && employeeId) {
      profile = await prisma.employeeProfile.findUnique({
        where: { id: employeeId },
      });
      if (!profile) {
        profile = await prisma.employeeProfile.findUnique({
          where: { userId: employeeId },
        });
      }
    }

    if (!profile) {
      profile = await prisma.employeeProfile.findUnique({
        where: {
          userId: req.user.id,
        },
      });
    }

    // Create profile if required
    if (!profile) {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
      });

      if (user && (user.role === "ADMIN" || user.role === "EMPLOYEE")) {
        const code = user.email && !user.email.includes("@")
          ? user.email
          : `${user.role === "ADMIN" ? "ADMIN" : "EMP"}-${Date.now()}`;
        profile = await prisma.employeeProfile.create({
          data: {
            userId: req.user.id,
            employeeCode: code,
            onboardingStatus: "APPROVED",
            firstName: user.fullName.split(" ")[0] || (user.role === "ADMIN" ? "Admin" : "Employee"),
            lastName: user.fullName.split(" ").slice(1).join(" ") || "",
            jobTitle: user.role === "ADMIN" ? "Administrator" : "Employee",
          },
        }).catch(() => null);
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

    const approvedLeaveForDate = await prisma.leaveRequest.findFirst({
      where: {
        employeeId: profile.id,
        status: "APPROVED",
        startDate: { lt: nextDate },
        endDate: { gte: selectedDate },
      },
      include: { leaveType: { select: { name: true } } },
    });

    if (approvedLeaveForDate) {
      return res.status(400).json({
        message: `Forgot Punch request cannot be submitted for ${date} because employee was on approved leave (${approvedLeaveForDate.leaveType?.name || "Leave"}).`,
      });
    }

    // --------------------------------------------------
    // FIND EXISTING ATTENDANCE
    // IMPORTANT:
    // If attendance already exists,
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
    // --------------------------------------------------

    const { start: todayStart } = getIndiaDayRange(new Date());
    const isToday = selectedDate.getTime() === todayStart.getTime();

    // Prevent today's check-in if previous attendance check-out is missing (allowed if request is PENDING or APPROVED)
    if (
      isToday &&
      !isTimeEdit &&
      (normalizedType === "check-in" || normalizedType === "both")
    ) {
      const unclosedPrevious = await getUnclosedPreviousAttendance(profile.id);
      if (
        unclosedPrevious &&
        (!unclosedPrevious.correctionRequest ||
          (unclosedPrevious.correctionRequest.status !== "APPROVED" &&
            unclosedPrevious.correctionRequest.status !== "PENDING"))
      ) {
        return res.status(400).json({
          message: `Check-in for today is disabled. You checked in on ${unclosedPrevious.record.dateKey} but forgot to check out. Please complete that day's check-out first.`,
        });
      }
    }

    if (
      record &&
      isToday &&
      !isTimeEdit &&
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
    // (Skipped for time-edit)
    // --------------------------------------------------

    if (record && !isTimeEdit) {
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
      const targetShift = await getTargetShift(profile, selectedDate);
      record = await prisma.attendance.create({
        data: {
          employeeId: profile.id,
          date: selectedDate,
          status: "PRESENT",
          checkIn: null,
          checkOut: null,
          shiftId: targetShift?.id ?? null,
          note: `Manual attendance: ${manualReason}`,
        },
      });
    }

    // --------------------------------------------------
    // PARSE TIMES
    // --------------------------------------------------

    let checkInDateTime = null;
    let checkOutDateTime = null;

    let checkOutDateStr = req.body?.checkOutDate || date;
    if (!req.body?.checkOutDate && isOvernight) {
      const nextDay = new Date(`${date}T12:00:00+05:30`);
      nextDay.setDate(nextDay.getDate() + 1);
      checkOutDateStr = nextDay.toISOString().slice(0, 10);
    }

    if (isTimeEdit) {
      if (!checkInTime && !checkOutTime) {
        return res.status(400).json({
          message: "Please enter at least check-in time or check-out time for time edit.",
        });
      }

      if (checkInTime) {
        checkInDateTime = parseManualPunchDateTime(date, checkInTime);
        if (!checkInDateTime) {
          return res.status(400).json({
            message: "Invalid check-in time.",
          });
        }
      }

      if (checkOutTime) {
        checkOutDateTime = parseManualPunchDateTime(checkOutDateStr, checkOutTime);
        if (!checkOutDateTime) {
          return res.status(400).json({
            message: "Invalid check-out time.",
          });
        }
      }
    } else {
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

        checkOutDateTime = parseManualPunchDateTime(checkOutDateStr, checkOutTime);

        if (!checkOutDateTime) {
          return res.status(400).json({
            message: "Invalid check-out time.",
          });
        }
      }
    }

    // --------------------------------------------------
    // BOTH TIME VALIDATION
    // --------------------------------------------------

    if (checkInDateTime && checkOutDateTime && checkOutDateTime <= checkInDateTime) {
      return res.status(400).json({
        message: `Check-out time (${formatTime12h(checkOutDateTime)}) must be greater than check-in time (${formatTime12h(checkInDateTime)}).`,
      });
    }

    // --------------------------------------------------
    // PREPARE UPDATE
    // IMPORTANT:
    // We intentionally overwrite the selected punch.
    // --------------------------------------------------

    const updates = {};

    if (isTimeEdit) {
      if (checkInDateTime) {
        updates.checkIn = checkInDateTime;
      }
      if (checkOutDateTime) {
        updates.checkOut = checkOutDateTime;
      }
    } else {
      if (normalizedType === "check-in" || normalizedType === "both") {
        updates.checkIn = checkInDateTime;
      }
      if (normalizedType === "check-out" || normalizedType === "both") {
        updates.checkOut = checkOutDateTime;
      }
    }

    // --------------------------------------------------
    // FINAL TIMES
    // --------------------------------------------------

    const finalCheckIn =
      updates.checkIn !== undefined ? updates.checkIn : record?.checkIn;

    const finalCheckOut =
      updates.checkOut !== undefined ? updates.checkOut : record?.checkOut;

    // --------------------------------------------------
    // VALIDATE EXISTING CHECK-IN / CHECK-OUT
    // --------------------------------------------------

    if (
      finalCheckIn &&
      finalCheckOut &&
      new Date(finalCheckOut) <= new Date(finalCheckIn)
    ) {
      return res.status(400).json({
        message: `Check-out time (${formatTime12h(finalCheckOut)}) must be greater than check-in time (${formatTime12h(finalCheckIn)}).`,
      });
    }

    // --------------------------------------------------
    // WORKED HOURS & OVERTIME
    // --------------------------------------------------

    if (finalCheckIn && finalCheckOut) {
      const isHolOrSun = await isHolidayOrSundayDate(selectedDate);
      updates.workedHours = calculateWorkedHours(finalCheckIn, finalCheckOut);
      updates.overtimeHours = calculateOvertimeHours(updates.workedHours, isHolOrSun);
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

    const approvalSuffix = req.user.role === "ADMIN" ? ". Approved by admin." : "";
    updates.note = fitAttendanceNote(
      `Manual attendance correction: ${manualReason}${approvalSuffix}`,
    );

    // --------------------------------------------------
    // UPDATE ATTENDANCE IN DATABASE
    // --------------------------------------------------
    const updated = await prisma.attendance.update({
      where: { id: record.id },
      data: updates,
    });

    // --------------------------------------------------
    // RECORD EMPLOYEE REQUEST FOR TRACKING
    // --------------------------------------------------
    try {
      const CORRECTION_MARKER = "[ATTENDANCE_CORRECTION]";
      const metadata = JSON.stringify({
        date,
        checkOutDate: checkOutDateStr,
        punchType: normalizedType,
        checkInTime: updates.checkIn ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(updates.checkIn)) : null,
        checkOutTime: updates.checkOut ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(updates.checkOut)) : null,
        isOvernight: Boolean(isOvernight || checkOutDateStr > date),
      });
      const readableText = `Forgot Punch request for ${normalizedType} on ${date}.\n\n${manualReason}`;
      const finalDescription = `${readableText}\n\n${CORRECTION_MARKER}${metadata}`;

      await prisma.employeeRequest.create({
        data: {
          employeeId: profile.id,
          type: "CORRECTION",
          subject: isTimeEdit ? "Time Edit Request" : `Forgot Punch - ${normalizedType === "both" ? "Check In + Out" : normalizedType === "check-out" ? "Check Out" : "Check In"}`,
          description: finalDescription,
          status: "APPROVED",
          reviewNote: "Auto-approved (Admin correction / manual update).",
          reviewedById: req.user.id,
          reviewedAt: new Date(),
        },
      });
    } catch (reqErr) {
      console.warn("⚠️ Failed to create EmployeeRequest record for manual-correction:", reqErr);
    }

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

router.post("/checkin", requireAuth, checkRolePermission(["mark-attendance", "attendance"]), async (req, res) => {
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

    if (!profile) {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
      });

      if (user && (user.role === "ADMIN" || user.role === "EMPLOYEE")) {
        const code = user.email && !user.email.includes("@")
          ? user.email
          : `${user.role === "ADMIN" ? "ADMIN" : "EMP"}-${Date.now()}`;
        profile = await prisma.employeeProfile.create({
          data: {
            userId: req.user.id,
            employeeCode: code,
            onboardingStatus: "APPROVED",
            firstName: user.fullName.split(" ")[0] || (user.role === "ADMIN" ? "Admin" : "Employee"),
            lastName: user.fullName.split(" ").slice(1).join(" ") || "",
            jobTitle: user.role === "ADMIN" ? "Administrator" : "Employee",
          },
          include: {
            location: true,
          },
        }).catch(() => null);

        if (profile) {
          console.log(
            `✅ Auto-created employee profile for user: ${req.user.id} (${code})`,
          );
        }
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

    const approvedLeaveToday = await prisma.leaveRequest.findFirst({
      where: {
        employeeId: profile.id,
        status: "APPROVED",
        startDate: { lte: today },
        endDate: { gte: today },
      },
      include: { leaveType: { select: { name: true } } },
    });

    if (approvedLeaveToday) {
      return res.status(400).json({
        message: `Check-in is disabled because you are on approved leave today (${approvedLeaveToday.leaveType?.name || "Leave"}).`,
      });
    }

    // ----------------------------------------------------------
    // UNCLOSED PREVIOUS DAY PUNCH CHECK
    // ----------------------------------------------------------

    const unclosedPrevious = await getUnclosedPreviousAttendance(profile.id);

    if (unclosedPrevious) {
      const { record: unclosedRec, correctionRequest: unclosedReq } = unclosedPrevious;
      // If employee already submitted a check-out request and status is PENDING or APPROVED, open check-in!
      const isAllowed = unclosedReq && (unclosedReq.status === "APPROVED" || unclosedReq.status === "PENDING");
      
      // If check-in was within 24 hours (e.g. overnight shift), prompt to check out first
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const isWithin24h = unclosedRec.checkIn && new Date(unclosedRec.checkIn).getTime() >= twentyFourHoursAgo.getTime();

      if (!isAllowed) {
        const detail = isWithin24h
          ? `You have an active shift from ${unclosedRec.dateKey} (checked in within last 24 hours). Please Check Out first or complete your check-out.`
          : `You checked in on ${unclosedRec.dateKey} but forgot to check out. Please complete that day's check-out first.`;
        return res.status(400).json({
          message: `Check-in disabled. ${detail}`,
          unclosedPrevious,
        });
      }
    }

    const { location, reason, shiftId } = req.body || {};

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
    // ADMIN CHECK-IN (LOCATION BYPASS)
    //
    // IMPORTANT:
    // - No GPS requirement / location check bypassed for admin
    // - Admin can check in to any created shift (by shiftId or matched by current time)
    // - No target location
    // - No default location
    // - No distance calculation
    // - No approval
    // - Always PRESENT
    // ==========================================================

    if (req.user.role === "ADMIN") {
      let chosenShift = null;
      if (shiftId) {
        chosenShift = await prisma.shift.findUnique({ where: { id: shiftId } });
      }
      if (!chosenShift) {
        chosenShift = await getTargetShift(profile, now);
      }
      const record = await prisma.attendance.create({
        data: {
          employeeId: profile.id,

          date: today,

          checkIn: now,

          checkOut: null,

          status: "PRESENT",

          shiftId: chosenShift?.id ?? null,

          note: "Admin check-in.",

          checkInLatitude: null,

          checkInLongitude: null,

          checkOutLatitude: null,

          checkOutLongitude: null,
        },
        include: {
          shift: true,
        },
      });

      const shiftLabel = record.shift?.name
        ? `${record.shift.name} (${record.shift.name.charAt(0).toUpperCase()})`
        : "";

      return res.json({
        record,
        shift: record.shift,
        message: shiftLabel
          ? `Admin checked in successfully [Shift: ${shiftLabel}].`
          : "Admin checked in successfully.",
      });
    }

    // ==========================================================
    // EMPLOYEE GPS IS REQUIRED
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

    const targetShift = await getTargetShift(profile, now);

    const record = await prisma.attendance.create({
      data: {
        employeeId: profile.id,

        date: today,

        checkIn: now,

        status,

        shiftId: targetShift?.id ?? null,

        note: fitAttendanceNote(note),

        checkInLatitude: coordinates.latitude,

        checkInLongitude: coordinates.longitude,

        checkOutLatitude: null,

        checkOutLongitude: null,
      },
      include: {
        shift: true,
      },
    });

    if (requiresApproval) {
      try {
        const todayDateKey = getIndiaDateKey(now);
        const jsonMetadata = JSON.stringify({
          date: todayDateKey,
          punchType: "check-in",
          checkInTime: formatTime12h(now),
          attendanceId: record.id,
          reason: normalizedReason || "",
        });
        await prisma.employeeRequest.create({
          data: {
            employeeId: profile.id,
            type: "CORRECTION",
            subject: `Check-in Approval Request: ${profile.firstName || "Employee"} (${todayDateKey})`,
            description: `${note}\n\n[ATTENDANCE_CORRECTION]${jsonMetadata}`,
            status: "PENDING",
          },
        });
      } catch (reqErr) {
        console.warn("Could not create EmployeeRequest ticket for check-in approval:", reqErr.message);
      }
    }

    const shiftBadge = record.shift?.name
      ? ` [Shift: ${record.shift.name} (${record.shift.name.charAt(0).toUpperCase()})]`
      : "";

    const message = requiresApproval
      ? `Checked in to ${
          checkinLocation?.name || "unassigned location"
        }.${shiftBadge} Awaiting admin approval.`
      : `Checked in successfully.${shiftBadge}`;

    return res.json({
      record,
      shift: record.shift,
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

    if (!profile) {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
      });

      if (user && (user.role === "ADMIN" || user.role === "EMPLOYEE")) {
        const code = user.email && !user.email.includes("@")
          ? user.email
          : `${user.role === "ADMIN" ? "ADMIN" : "EMP"}-${Date.now()}`;
        profile = await prisma.employeeProfile.create({
          data: {
            userId: req.user.id,
            employeeCode: code,
            onboardingStatus: "APPROVED",
            firstName: user.fullName.split(" ")[0] || (user.role === "ADMIN" ? "Admin" : "Employee"),
            lastName: user.fullName.split(" ").slice(1).join(" ") || "",
            jobTitle: user.role === "ADMIN" ? "Administrator" : "Employee",
          },
          include: {
            location: true,
          },
        }).catch(() => null);
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

router.post("/checkout", requireAuth, checkRolePermission(["mark-attendance", "attendance"]), async (req, res) => {
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

    if (!profile) {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
      });

      if (user && (user.role === "ADMIN" || user.role === "EMPLOYEE")) {
        const code = user.email && !user.email.includes("@")
          ? user.email
          : `${user.role === "ADMIN" ? "ADMIN" : "EMP"}-${Date.now()}`;
        profile = await prisma.employeeProfile.create({
          data: {
            userId: req.user.id,
            employeeCode: code,
            onboardingStatus: "APPROVED",
            firstName: user.fullName.split(" ")[0] || (user.role === "ADMIN" ? "Admin" : "Employee"),
            lastName: user.fullName.split(" ").slice(1).join(" ") || "",
            jobTitle: user.role === "ADMIN" ? "Administrator" : "Employee",
          },
          include: {
            location: true,
          },
        }).catch(() => null);

        if (profile) {
          console.log(
            `✅ Auto-created employee profile for user: ${req.user.id} (${code})`,
          );
        }
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

    const approvedLeaveToday = await prisma.leaveRequest.findFirst({
      where: {
        employeeId: profile.id,
        status: "APPROVED",
        startDate: { lte: today },
        endDate: { gte: today },
      },
      include: { leaveType: { select: { name: true } } },
    });

    // --------------------------------------------------------
    // REQUEST BODY
    // --------------------------------------------------------

    const { location, reason, checkOutTime, checkOutDate } = req.body || {};

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

    if (!record || !record.checkIn) {
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const activeUnclosed = await prisma.attendance.findFirst({
        where: {
          employeeId: profile.id,
          date: { lt: today },
          checkIn: { gte: twentyFourHoursAgo, not: null },
          checkOut: null,
        },
        orderBy: { date: "desc" },
      });

      if (activeUnclosed) {
        // Only reject activeUnclosed if there is a pending or approved correction that already covers check-out
        const prevUnclosed = await getUnclosedPreviousAttendance(profile.id);
        const hasHandledCheckout =
          prevUnclosed?.correctionRequest &&
          (prevUnclosed.correctionRequest.status === "PENDING" ||
            prevUnclosed.correctionRequest.status === "APPROVED");
        if (!hasHandledCheckout) {
          record = activeUnclosed;
        }
      }
    }

    if (approvedLeaveToday && (!record || !record.checkIn)) {
      return res.status(400).json({
        message: `Check-out is disabled because you are on approved leave today (${approvedLeaveToday.leaveType?.name || "Leave"}).`,
      });
    }

    // --------------------------------------------------------
    // FIND PENDING OR APPROVED FORGOT PUNCH REQUEST (FOR BOTH ADMIN & EMPLOYEE)
    // --------------------------------------------------------

    let pendingForgotPunchCheckIn = null;

    const correctionRequests = await prisma.employeeRequest.findMany({
      where: {
        employeeId: profile.id,
        type: "CORRECTION",
        status: { in: ["PENDING", "APPROVED"] },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    for (const request of correctionRequests) {
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
        const isTodayCorrection =
          correction.date === todayKey &&
          (correction.punchType === "check-in" ||
            correction.punchType === "both" ||
            correction.punchType === "time-edit") &&
          correction.checkInTime;

        let isWithin24HoursCorrection = false;
        if (
          !isTodayCorrection &&
          correction.date &&
          correction.checkInTime &&
          (correction.punchType === "check-in" ||
            correction.punchType === "both" ||
            correction.punchType === "time-edit")
        ) {
          const [h, m] = String(correction.checkInTime).split(":").map(Number);
          if (Number.isFinite(h) && Number.isFinite(m)) {
            const checkInDateTime = new Date(`${correction.date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+05:30`);
            const twentyFourHoursMs = 24 * 60 * 60 * 1000;
            if (now.getTime() - checkInDateTime.getTime() <= twentyFourHoursMs && now.getTime() >= checkInDateTime.getTime()) {
              isWithin24HoursCorrection = true;
            }
          }
        }

        if (isTodayCorrection || isWithin24HoursCorrection) {
          // If this request already supplied checkOutTime and was approved, skip
          if (request.status === "APPROVED" && correction.checkOutTime) {
            continue;
          }
          pendingForgotPunchCheckIn = {
            request,
            correction,
          };
          break;
        }
      } catch (error) {
        console.error("Failed to parse Forgot Punch request:", error);
      }
    }

    const hasPendingForgotPunchCheckIn = !!pendingForgotPunchCheckIn;

    if (!record && hasPendingForgotPunchCheckIn) {
      const correctionDate = pendingForgotPunchCheckIn.correction?.date;
      const recordDate = correctionDate ? new Date(`${correctionDate}T00:00:00.000+05:30`) : today;

      // Look if record already exists for that correction date
      const existingRecordForDate = await prisma.attendance.findFirst({
        where: {
          employeeId: profile.id,
          date: recordDate,
        },
      });

      if (existingRecordForDate) {
        record = existingRecordForDate;
      } else {
        let effectiveCheckIn = null;
        if (pendingForgotPunchCheckIn.correction?.checkInTime && correctionDate) {
          effectiveCheckIn = parseManualPunchDateTime(
            correctionDate,
            pendingForgotPunchCheckIn.correction.checkInTime,
          );
        }

        record = await prisma.attendance.create({
          data: {
            employeeId: profile.id,
            date: recordDate,
            checkIn: effectiveCheckIn,
            checkOut: null,
            workedHours: null,
            status: "PRESENT",
            note: fitAttendanceNote(
              pendingForgotPunchCheckIn.request.status === "APPROVED"
                ? "Forgot Punch check-in approved."
                : "Checkout recorded while Forgot Punch Check In request is pending.",
            ),
          },
        });
      }
    }

    if (record && !record.checkIn && hasPendingForgotPunchCheckIn) {
      const correctionDate = pendingForgotPunchCheckIn.correction?.date;
      if (pendingForgotPunchCheckIn.correction?.checkInTime && correctionDate) {
        const effectiveCheckIn = parseManualPunchDateTime(
          correctionDate,
          pendingForgotPunchCheckIn.correction.checkInTime,
        );
        if (effectiveCheckIn) {
          record.checkIn = effectiveCheckIn;
        }
      }
    }

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
          message: "You have already checked out.",
        });
      }

      // ------------------------------------------------------
      // CALCULATE WORKED HOURS & OVERTIME (ADMIN)
      // ------------------------------------------------------
      let adminCheckOutDate = now;
      if (checkOutTime && typeof checkOutTime === "string") {
        const timeParts = checkOutTime.trim().match(/^(\d{1,2}):(\d{2})/);
        if (timeParts) {
          const h = String(timeParts[1]).padStart(2, "0");
          const m = String(timeParts[2]).padStart(2, "0");
          const targetDateKey = (checkOutDate && /^\d{4}-\d{2}-\d{2}$/.test(String(checkOutDate).trim()))
            ? String(checkOutDate).trim()
            : getIndiaDateKey(now);
          const customDate = new Date(`${targetDateKey}T${h}:${m}:00+05:30`);
          if (!Number.isNaN(customDate.getTime())) {
            adminCheckOutDate = customDate;
          }
        }
      }

      const diffMs = adminCheckOutDate.getTime() - new Date(record.checkIn).getTime();
      const diffHours = diffMs / 3600000;

      if (diffHours < 0) {
        return res.status(400).json({
          message: "Check-out time cannot be before check-in time.",
        });
      }

      if (diffHours > 24) {
        return res.status(400).json({
          message: `Total shift duration cannot exceed 24 hours (${diffHours.toFixed(1)} hours calculated).`,
        });
      }

      const workedHours = calculateWorkedHours(record.checkIn, adminCheckOutDate);
      const isHolOrSun = await isHolidayOrSundayDate(today);
      const overtimeHours = calculateOvertimeHours(workedHours, isHolOrSun);

      // ------------------------------------------------------
      // UPDATE ADMIN ATTENDANCE (NO GPS COORDINATES FOR ADMIN)
      // ------------------------------------------------------

      const updated = await prisma.attendance.update({
        where: {
          id: record.id,
        },

        data: {
          checkOut: adminCheckOutDate,

          checkOutLatitude: null,

          checkOutLongitude: null,

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
        message: "You have already checked out.",
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
    // --------------------------------------------------------
    // WORKED HOURS & OVERTIME
    // --------------------------------------------------------
    let employeeCheckOutDate = now;
    if (checkOutTime && typeof checkOutTime === "string") {
      const timeParts = checkOutTime.trim().match(/^(\d{1,2}):(\d{2})/);
      if (timeParts) {
        const h = String(timeParts[1]).padStart(2, "0");
        const m = String(timeParts[2]).padStart(2, "0");
        const targetDateKey = (checkOutDate && /^\d{4}-\d{2}-\d{2}$/.test(String(checkOutDate).trim()))
          ? String(checkOutDate).trim()
          : getIndiaDateKey(now);
        const customDate = new Date(`${targetDateKey}T${h}:${m}:00+05:30`);
        if (!Number.isNaN(customDate.getTime())) {
          employeeCheckOutDate = customDate;
        }
      }
    }

    const diffMs = employeeCheckOutDate.getTime() - new Date(record.checkIn).getTime();
    const diffHours = diffMs / 3600000;

    if (diffHours < 0) {
      return res.status(400).json({
        message: "Check-out time cannot be before check-in time.",
      });
    }

    if (diffHours > 24) {
      return res.status(400).json({
        message: `Total shift duration cannot exceed 24 hours (${diffHours.toFixed(1)} hours calculated).`,
      });
    }

    const workedHours = calculateWorkedHours(record.checkIn, employeeCheckOutDate);
    const isHolOrSun = await isHolidayOrSundayDate(today);
    const overtimeHours = calculateOvertimeHours(workedHours, isHolOrSun);

    const isOutside = !!comparisonLocation && distance > allowedRadius;

    // --------------------------------------------------------
    // OUTSIDE LOCATION
    // --------------------------------------------------------

    if (isOutside || (!comparisonLocation && normalizedReason)) {
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

      const locationLabel = comparisonLocation
        ? `Checkout outside assigned location${distStr}`
        : `Checkout from unassigned location${distStr}`;

      const reasonSegment = normalizedReason ? `Reason: ${normalizedReason}. ` : "";
      const checkoutNote = `${locationLabel}. ${reasonSegment}Pending admin approval.`;

      const updatedNote = record.note
        ? `${record.note} | ${checkoutNote}`
        : checkoutNote;

      const updated = await prisma.attendance.update({
        where: {
          id: record.id,
        },

        data: {
          checkOut: employeeCheckOutDate,

          checkOutLatitude: coordinates.latitude,

          checkOutLongitude: coordinates.longitude,

          workedHours,

          overtimeHours,

          status: "PENDING_APPROVAL",

          note: fitAttendanceNote(updatedNote),
        },
      });

      try {
        const todayDateKey = getIndiaDateKey(employeeCheckOutDate);
        const jsonMetadata = JSON.stringify({
          date: todayDateKey,
          punchType: "check-out",
          checkOutTime: formatTime12h(employeeCheckOutDate),
          attendanceId: updated.id,
          reason: normalizedReason || "",
        });
        await prisma.employeeRequest.create({
          data: {
            employeeId: profile.id,
            type: "CORRECTION",
            subject: `Check-out Approval Request: ${profile.firstName || "Employee"} (${todayDateKey})`,
            description: `${updatedNote}\n\n[ATTENDANCE_CORRECTION]${jsonMetadata}`,
            status: "PENDING",
          },
        });
      } catch (reqErr) {
        console.warn("Could not create EmployeeRequest ticket for check-out approval:", reqErr.message);
      }

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
      : getAttendanceStatusAfterCheckout(record.checkIn, employeeCheckOutDate, record.status);

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
        checkOut: employeeCheckOutDate,

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

const ensureAllEmployeesHaveProfiles = async () => {
  try {
    const unprofiled = await prisma.user.findMany({
      where: {
        role: { in: ["EMPLOYEE", "ADMIN"] },
        employeeProfile: null,
      },
    });
    for (const u of unprofiled) {
      const code = u.email && !u.email.includes("@")
        ? u.email
        : `${u.role === "ADMIN" ? "ADMIN" : "EMP"}-${u.id.slice(0, 6).toUpperCase()}`;
      await prisma.employeeProfile.create({
        data: {
          userId: u.id,
          employeeCode: code,
          onboardingStatus: "APPROVED",
          firstName: u.fullName?.split(" ")[0] || u.fullName || "Employee",
          lastName: u.fullName?.split(" ").slice(1).join(" ") || "",
          jobTitle: u.role === "ADMIN" ? "Administrator" : "Employee",
        },
      }).catch((e) => console.warn("Could not auto-create profile for", u.email, e.message));
    }
  } catch (syncErr) {
    console.warn("Auto-sync employee profiles error:", syncErr.message);
  }
};

// GET /api/attendance/employees - approved employees for the picker.
router.get("/employees", async (req, res) => {
  console.log("📋 [GET /employees] Request received");

  // Allow ADMIN with permission OR any EMPLOYEE to access
  if (req.user.role === "ADMIN") {
    // Check permission for admin
    const hasPermission = await requireAdminOrModulePermission(
      ["attendance", "attendance-management"],
      "canView",
    )(req, res, () => true);
    if (res.headersSent) return; // Permission denied
  } else if (req.user.role !== "EMPLOYEE") {
    return res.status(403).json({ message: "Access denied." });
  }

  try {
    await ensureAllEmployeesHaveProfiles();

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
      ["approvals-attendance", "attendance", "approvals", "attendance-management", "requests"],
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
router.get("/my-requests", requireAuth, async (req, res) => {
  try {
    let profile = await prisma.employeeProfile.findUnique({
      where: { userId: req.user.id },
      include: { location: true },
    });
    if (!profile) {
      if (req.user.role === "ADMIN") {
        profile = await prisma.employeeProfile.create({
          data: {
            userId: req.user.id,
            employeeCode: "ADMIN",
            jobTitle: "Administrator",
            onboardingStatus: "APPROVED",
          },
          include: { location: true },
        });
      } else {
        return res.status(404).json({ message: "Employee profile not found." });
      }
    }

    const records = await prisma.attendance.findMany({
      where: {
        employeeId: profile.id,
        OR: [
          { note: { contains: "Pending admin approval" } },
          { note: { contains: "Admin approved" } },
          { note: { contains: "Admin rejected" } },
          { note: { contains: "Approved by admin" } },
          { note: { contains: "Rejected by admin" } },
          { note: { contains: "Manual attendance correction" } },
          { note: { contains: "Manual attendance:" } },
          { status: "PENDING_APPROVAL" },
        ],
      },
      include: {
        employee: {
          include: {
            user: {
              select: { fullName: true, email: true },
            },
            location: true,
          },
        },
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
  requireAdminOrModulePermission(["approvals-attendance", "attendance", "approvals", "attendance-management"], "canView"),
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
            { note: { contains: "unassigned" } },
            { note: { contains: "Unassigned" } },
            { note: { contains: "outside" } },
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
  requireAdminOrModulePermission(["attendance", "attendance-management"], "canView"),
  async (_req, res) => {
    try {
      await ensureAllEmployeesHaveProfiles();
      const now = new Date();
      const { start: today, end: indiaDayEnd } = getIndiaDayRange(now);
      const tomorrow = new Date(indiaDayEnd.getTime() + 1);

      const [employees, attendanceRecords, leaveRequests, rosterEntries, defaultShift] = await Promise.all([
        prisma.employeeProfile.findMany({
          include: {
            user: { select: { fullName: true, email: true } },
            shift: true,
          },
          orderBy: { employeeCode: "asc" },
        }),
        prisma.attendance.findMany({
          where: { date: { gte: today, lt: tomorrow } },
          include: { shift: true },
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
        prisma.rosterEntry.findMany({
          where: { date: { gte: today, lt: tomorrow } },
          include: { shift: true },
        }),
        prisma.shift.findFirst({
          where: { isDefault: true, isActive: true },
        }),
      ]);

      const attendanceByEmployeeId = new Map(
        attendanceRecords.map((rec) => [rec.employeeId, rec]),
      );
      const leaveByEmployeeId = new Map(
        leaveRequests.map((req) => [req.employeeId, req]),
      );
      const rosterByEmployeeId = new Map(
        rosterEntries.map((re) => [re.employeeId, re.shift]),
      );

      const summary = {
        PRESENT: 0,
        SHORT_DAY: 0,
        ABSENT: 0,
        ON_LEAVE: 0,
        HOLIDAY: 0,
      };
      const records = employees.map((employee) => {
        const attendance = attendanceByEmployeeId.get(employee.id);
        const leave = leaveByEmployeeId.get(employee.id);
        const rosterShift = rosterByEmployeeId.get(employee.id);

        const assignedShift =
          attendance?.shift ||
          rosterShift ||
          employee.shift ||
          defaultShift ||
          null;

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

        const isShortDay = isShortDayHours(workedHours, false);
        if (summary[status] !== undefined) summary[status] += 1;
        if (isShortDay) summary.SHORT_DAY += 1;

        return {
          id: employee.id,
          employeeCode: employee.employeeCode,
          fullName: employee.user?.fullName || "Employee",
          email: employee.user?.email || "",
          status,
          shift: assignedShift
            ? {
                id: assignedShift.id,
                name: assignedShift.name,
                startTime: assignedShift.startTime,
                endTime: assignedShift.endTime,
                isDefault: assignedShift.isDefault,
              }
            : null,
          checkIn,
          checkOut,
          workedHours,
          isShortDay,
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
      ["attendance", "attendance-management"],
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
      const roleMod = await prisma.roleModule.findFirst({
        where: {
          roleId,
          moduleKey: { in: ["attendance", "attendance-management"] },
        },
      });
      if (roleMod) isFullManager = true;
    }

    if (!isFullManager) {
      const directPerm = await prisma.modulePermission.findFirst({
        where: {
          userId: req.user.id,
          moduleKey: { in: ["attendance", "attendance-management"] },
          canView: true,
        },
      });
      if (directPerm) isFullManager = true;
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
    await ensureAllEmployeesHaveProfiles();
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
      rosterEntries,
      defaultShift,
    ] = await Promise.all([
      prisma.employeeProfile.findMany({
        where: employeeFilter,
        include: {
          user: { select: { fullName: true, email: true } },
          shift: true,
        },
        orderBy: { employeeCode: "asc" },
      }),
      prisma.attendance.findMany({
        where: {
          date: { gte: attendanceQueryStart, lt: attendanceQueryEnd },
          ...(isFullManager ? {} : { employee: { userId: req.user.id } }),
        },
        include: { shift: true },
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
      prisma.rosterEntry.findMany({
        where: {
          date: { gte: attendanceQueryStart, lt: attendanceQueryEnd },
          ...(isFullManager ? {} : { employeeId: { in: (await prisma.employeeProfile.findMany({ where: employeeFilter, select: { id: true } })).map((e) => e.id) } }),
        },
        include: { shift: true },
      }),
      prisma.shift.findFirst({
        where: { isDefault: true, isActive: true },
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

    const rosterShiftByEmpAndDate = new Map(
      rosterEntries.map((re) => [
        `${re.employeeId}:${formatDateKey(re.date)}`,
        re.shift,
      ]),
    );

    const getAssignedShiftForEmployeeDate = (emp, dateKey, attendanceRecord = null) => {
      if (attendanceRecord?.shift) return attendanceRecord.shift;
      const rosterKey = `${emp.id}:${dateKey}`;
      if (rosterShiftByEmpAndDate.has(rosterKey)) {
        return rosterShiftByEmpAndDate.get(rosterKey);
      }
      if (emp.shift) return emp.shift;
      return defaultShift ?? null;
    };

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
        if (current >= start && current < end) {
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
      SHORT_DAY: 0,
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
          status = (leave && attendance.status !== "PRESENT") ? "ON_LEAVE" : attendance.status;
          checkIn = attendance.checkIn;
          checkOut = attendance.checkOut;
          workedHours =
            attendance.workedHours ??
            calculateWorkedHours(attendance.checkIn, attendance.checkOut);
          note = (leave && status === "ON_LEAVE")
            ? `Approved leave: ${leave.leaveType?.name || leave.leaveType?.code || "Leave"}`
            : (attendance.note || null);
        } else if (leave) {
          status = "ON_LEAVE";
          note = `Approved leave: ${leave.leaveType?.name || leave.leaveType?.code || "Leave"}`;
        } else if (holiday) {
          status = "HOLIDAY";
          note = holiday.name;
        } else if (!isWorkingDay(date)) {
          status = "HOLIDAY";
          note = "Weekly off.";
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

        const isHolOrSun = Boolean(holiday || !isWorkingDay(date));
        const overtimeHours = calculateOvertimeHours(workedHours, isHolOrSun);
        const isShortDay = isShortDayHours(workedHours, isHolOrSun);

        if (summary[status] !== undefined) summary[status] += 1;
        if (isShortDay) summary.SHORT_DAY += 1;

        const dayShift = getAssignedShiftForEmployeeDate(employee, dateKey, attendance);

        records.push({
          id: attendance?.id ?? `${employee.id}-${dateKey}`,
          employeeId: employee.id,
          employeeCode: employee.employeeCode,
          fullName: employee.user?.fullName || "Employee",
          email: employee.user?.email || "",
          date: new Date(date),
          status,
          shift: dayShift
            ? {
                id: dayShift.id,
                name: dayShift.name,
                startTime: dayShift.startTime,
                endTime: dayShift.endTime,
                isDefault: dayShift.isDefault,
              }
            : null,
          checkIn,
          checkOut,
          checkInLatitude: attendance?.checkInLatitude ?? null,
          checkInLongitude: attendance?.checkInLongitude ?? null,
          checkOutLatitude: attendance?.checkOutLatitude ?? null,
          checkOutLongitude: attendance?.checkOutLongitude ?? null,
          workedHours,
          overtimeHours,
          isShortDay,
          note,
          createdAt: attendance?.createdAt ?? null,
          updatedAt: attendance?.updatedAt ?? null,
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
      holidays: holidays.map((h) => ({
        date: h.date,
        name: h.name,
        holidayType: h.holidayType,
        isOptional: h.isOptional,
      })),
    });
  } catch (err) {
    console.error("Get weekly attendance register error:", err);
    res.status(500).json({ message: "Failed to load attendance register." });
  }
});

// GET /api/attendance/pending - list pending approval attendance records (ADMIN)
router.get(
  "/pending",
  checkRolePermission(["approvals-attendance", "approvals"]),
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
  checkRolePermission(["approvals-attendance", "approvals"]),
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
      const isHolOrSun = await isHolidayOrSundayDate(record.date);
      const overtimeHours = calculateOvertimeHours(workedHours, isHolOrSun);

      const reviewer = req.user?.id
        ? await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { fullName: true },
          })
        : null;
      const reviewerName = reviewer?.fullName || (req.user.role === "ADMIN" ? "Admin" : "Employee");

      const approvalText = `Approved by ${reviewerName}.`;
      const updatedNote = record.note
        ? `${record.note} | ${approvalText}`
        : approvalText;

      const updated = await prisma.attendance.update({
        where: { id },

        data: {
          status: "PRESENT",
          workedHours,
          overtimeHours,
          note: fitAttendanceNote(updatedNote),
        },
      });

      // Synchronize associated EmployeeRequest ticket if one was created
      try {
        await prisma.employeeRequest.updateMany({
          where: {
            employeeId: record.employeeId,
            status: "PENDING",
            description: { contains: `"attendanceId":"${id}"` },
          },
          data: {
            status: "APPROVED",
            reviewedById: req.user?.id || null,
            reviewNote: approvalText,
            reviewedAt: new Date(),
          },
        });
      } catch (errSync) {
        console.warn("Could not sync EmployeeRequest status on attendance approval:", errSync.message);
      }

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
  checkRolePermission(["approvals-attendance", "approvals"]),
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

      const reviewer = req.user?.id
        ? await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { fullName: true },
          })
        : null;
      const reviewerName = reviewer?.fullName || (req.user.role === "ADMIN" ? "Admin" : "Employee");

      const rejectionNote = reason
        ? `Rejected by ${reviewerName}: ${reason}`
        : `Rejected by ${reviewerName}.`;

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

      // Synchronize associated EmployeeRequest ticket if one was created
      try {
        await prisma.employeeRequest.updateMany({
          where: {
            employeeId: record.employeeId,
            status: "PENDING",
            description: { contains: `"attendanceId":"${id}"` },
          },
          data: {
            status: "REJECTED",
            reviewedById: req.user?.id || null,
            reviewNote: rejectionNote,
            reviewedAt: new Date(),
          },
        });
      } catch (errSync) {
        console.warn("Could not sync EmployeeRequest status on attendance rejection:", errSync.message);
      }

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
  requireAdminOrModulePermission(["attendance", "attendance-management"], "canView"),
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

      const [records, holidays, leaveRequests, pendingCorrectionRequests, rosterEntries, defaultShift] = await Promise.all([
        prisma.attendance.findMany({
          where: {
            employeeId,
            date: { gte: attendanceQueryStart, lt: attendanceQueryEnd },
          },
          include: { shift: true },
          orderBy: { date: "asc" },
        }),
        prisma.holiday.findMany({
          where: { date: { gte: start, lt: end } },
        }),
        prisma.leaveRequest.findMany({
          where: {
            employeeId,
            status: "APPROVED",
            startDate: { lt: end },
            endDate: { gte: start },
          },
          include: { leaveType: { select: { name: true, code: true } } },
        }),
        prisma.employeeRequest.findMany({
          where: {
            employeeId,
            type: "CORRECTION",
            status: "PENDING",
          },
          select: { description: true },
        }),
        prisma.rosterEntry.findMany({
          where: {
            employeeId,
            date: { gte: attendanceQueryStart, lt: attendanceQueryEnd },
          },
          include: { shift: true },
        }),
        prisma.shift.findFirst({
          where: { isDefault: true, isActive: true },
        }),
      ]);

      const rosterShiftByDate = new Map(
        rosterEntries.map((re) => [formatDateKey(re.date), re.shift]),
      );

      const getAssignedShiftForDate = (dateKey, attendanceRecord = null) => {
        if (attendanceRecord?.shift) return attendanceRecord.shift;
        if (rosterShiftByDate.has(dateKey)) return rosterShiftByDate.get(dateKey);
        // Only show shift if employee has actually checked in on that day
        if (attendanceRecord?.checkIn) {
          if (employee?.shift) return employee.shift;
          return defaultShift ?? null;
        }
        return null;
      };

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
          leaveByDate.set(formatDateKey(current), leave);
          current = new Date(
            Date.UTC(
              current.getUTCFullYear(),
              current.getUTCMonth(),
              current.getUTCDate() + 1,
            ),
          );
        }
      }

      const summary = { PRESENT: 0, SHORT_DAY: 0, ABSENT: 0, ON_LEAVE: 0, HOLIDAY: 0, PENDING_APPROVAL: 0 };
      const todayKey = getIndiaDateKey(new Date());
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
          let status = pendingCorrection
            ? "PENDING_APPROVAL"
            : existing.status;

          if (leaveByDate.has(key) && existing.status !== "PRESENT" && !pendingCorrection) {
            status = "ON_LEAVE";
          }

          const calculatedWorkedHours =
            existing.workedHours ??
            calculateWorkedHours(existing.checkIn, existing.checkOut);

          const isHolOrSun = Boolean(holidayObj || isSunday);
          const overtimeHours = calculateOvertimeHours(calculatedWorkedHours, isHolOrSun);
          const isShortDay = isShortDayHours(calculatedWorkedHours, isHolOrSun);

          if (summary[status] !== undefined) summary[status] += 1;
          if (isShortDay) summary.SHORT_DAY += 1;

          const dayShift = getAssignedShiftForDate(key, existing);

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
            shift: dayShift
              ? {
                  id: dayShift.id,
                  name: dayShift.name,
                  startTime: dayShift.startTime,
                  endTime: dayShift.endTime,
                  isDefault: dayShift.isDefault,
                }
              : null,
            workedHours: calculatedWorkedHours,
            overtimeHours,
            isShortDay,
            createdAt: existing.createdAt,
            updatedAt: existing.updatedAt,
            note: pendingCorrection
              ? `${existing.note || ""}${existing.note ? " | " : ""}Forgot Punch Check In pending approval.`
              : (leaveByDate.has(key) && status === "ON_LEAVE"
                  ? `Approved leave: ${leaveByDate.get(key).leaveType?.name || leaveByDate.get(key).leaveType?.code || "Leave"}`
                  : existing.note || holidayNote),
          });
          continue;
        }

        const dayShift = getAssignedShiftForDate(key, null);
        const shiftPayload = dayShift
          ? {
              id: dayShift.id,
              name: dayShift.name,
              startTime: dayShift.startTime,
              endTime: dayShift.endTime,
              isDefault: dayShift.isDefault,
            }
          : null;

        if (leaveByDate.has(key)) {
          const leave = leaveByDate.get(key);
          summary.ON_LEAVE += 1;
          populatedRecords.push({
            id: null,
            date: new Date(current),
            checkIn: null,
            checkOut: null,
            status: "ON_LEAVE",
            shift: shiftPayload,
            workedHours: null,
            note: `Approved leave: ${leave.leaveType?.name || leave.leaveType?.code || "Leave"}`,
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
            shift: shiftPayload,
            workedHours: null,
            note: holidayByDate.get(key)?.name || "Holiday",
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
            shift: shiftPayload,
            workedHours: null,
            note: "Weekly Off (Sunday)",
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
            shift: shiftPayload,
            workedHours: null,
            note: "Forgot Punch pending approval.",
          });
          continue;
        }

        const isPastDay = key < todayKey;
        if (isPastDay) {
          summary.ABSENT += 1;
          populatedRecords.push({
            id: null,
            date: new Date(current),
            checkIn: null,
            checkOut: null,
            status: "ABSENT",
            shift: shiftPayload,
            workedHours: null,
            note: "No attendance record.",
          });
        }
      }

      const sundayHolidays = [];
      const dbHolidayKeys = new Set(holidays.map((h) => formatDateKey(h.date)));
      for (
        let current = new Date(start);
        current < end;
        current = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate() + 1))
      ) {
        if (!isWorkingDay(current)) {
          const key = formatDateKey(current);
          if (!dbHolidayKeys.has(key)) {
            sundayHolidays.push({
              date: new Date(current),
              name: "Sunday (Weekly Off)",
              holidayType: "OPTIONAL",
              isOptional: true,
            });
          }
        }
      }
      const allHolidays = [...holidays, ...sundayHolidays].sort(
        (a, b) => new Date(a.date) - new Date(b.date)
      );

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
        holidays: allHolidays.map((h) => ({
          date: h.date,
          name: h.name,
          holidayType: h.holidayType || "OPTIONAL",
          isOptional: h.isOptional ?? true,
        })),
        summary,
      });
    } catch (err) {
      console.error("Get attendance error:", err);
      res.status(500).json({ message: "Failed to load attendance." });
    }
  },
);

export default router;
