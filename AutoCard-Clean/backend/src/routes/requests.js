import { Router } from "express";
import { z } from "zod";

import prisma from "../prismaClient.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdminOrModulePermission } from "../middleware/checkModulePermission.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| AUTH
|--------------------------------------------------------------------------
*/

router.use(requireAuth);

/*
|--------------------------------------------------------------------------
| CONSTANTS
|--------------------------------------------------------------------------
*/

const CORRECTION_MARKER = "[ATTENDANCE_CORRECTION]";

/*
|--------------------------------------------------------------------------
| VALIDATION
|--------------------------------------------------------------------------
*/

const reviewSchema = z.object({
  note: z.string().optional(),
});

const employeeRequestSchema = z.object({
  type: z
    .enum(["GENERAL", "DOCUMENT", "EQUIPMENT", "CORRECTION", "OTHER"])
    .default("GENERAL"),

  subject: z.string().trim().min(1).max(160),

  description: z.string().trim().max(5000).optional().or(z.literal("")),
});

/*
|--------------------------------------------------------------------------
| PARSE FORGOT PUNCH REQUEST
|--------------------------------------------------------------------------
|
| Expected frontend description:
|
| Forgot Punch request for Check In on 2026-09-10 at check in 10:42.
|
| reason
|
| [ATTENDANCE_CORRECTION]
| {"date":"2026-09-10",
|  "punchType":"check-in",
|  "checkInTime":"10:42",
|  "checkOutTime":null}
|
|--------------------------------------------------------------------------
*/

function parseCorrectionRequest(description) {
  if (typeof description !== "string") {
    return null;
  }

  const markerIndex = description.lastIndexOf(CORRECTION_MARKER);

  if (markerIndex < 0) {
    return null;
  }

  const readableDescription = description
    .slice(0, markerIndex)
    .trim();

  /*
   * Extract reason.
   */
  const separatedReason = readableDescription
    .split("\n\n")
    .slice(1)
    .join("\n\n")
    .trim();

  const reason =
    separatedReason ||
    readableDescription
      .replace(
        /^Forgot Punch request for .*? on \d{4}-\d{2}-\d{2} at .*?(?:\.\s*|$)/i,
        "",
      )
      .trim();

  /*
   * Parse correction JSON safely.
   */
  try {
    const jsonText = description
      .slice(markerIndex + CORRECTION_MARKER.length)
      .trim();

    if (!jsonText) {
      return null;
    }

    let data;

    try {
      data = JSON.parse(jsonText);
    } catch (jsonError) {
      // Recover the fields needed for display and approval from old truncated records.
      const readString = (key) =>
        jsonText.match(new RegExp(`"${key}"\\s*:\\s*"([^"\\r\\n]*)"`))?.[1] || null;

      data = {
        date: readString("date"),
        punchType: readString("punchType"),
        checkInTime: readString("checkInTime"),
        checkOutTime: readString("checkOutTime"),
        checkInLocation: readString("checkInLocation"),
        checkOutLocation: readString("checkOutLocation"),
      };
    }

    if (!data || typeof data !== "object") {
      return null;
    }

    if (!data.date) {
      return null;
    }

    if (
      !["check-in", "check-out", "both"].includes(
        data.punchType,
      )
    ) {
      return null;
    }

    return {
      date: data.date,

      punchType: data.punchType,

      checkInTime:
        data.checkInTime || null,

      checkOutTime:
        data.checkOutTime || null,

      checkInLocation:
        data.checkInLocation || null,

      checkOutLocation:
        data.checkOutLocation || null,

      reason,
    };
  } catch (error) {
    console.warn(
      "⚠️ Failed to parse attendance correction. Request skipped.",
    );

    return null;
  }
}

/*
|--------------------------------------------------------------------------
| DATE HELPERS
|--------------------------------------------------------------------------
*/

function getDateKey(value) {
  if (!value) {
    return null;
  }

  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return value;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

/*
|--------------------------------------------------------------------------
| PRISMA SAFE ATTENDANCE DATE RANGE
|--------------------------------------------------------------------------
|
| Attendance dates are based on IST.
|
| 00:00 IST = previous day 18:30 UTC
|
|--------------------------------------------------------------------------
*/

function getAttendanceDayRange(value) {
  const dateText = getDateKey(value);

  if (
    !dateText ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dateText)
  ) {
    return null;
  }

  const start = new Date(
    `${dateText}T00:00:00.000+05:30`,
  );

  const end = new Date(
    `${dateText}T23:59:59.999+05:30`,
  );

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    return null;
  }

  return {
    start,
    end,
  };
}

/*
|--------------------------------------------------------------------------
| TIME → DATE
|--------------------------------------------------------------------------
*/

function timeToDate(dateText, timeText) {
  if (!dateText || !timeText) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    return null;
  }

  if (!/^\d{2}:\d{2}$/.test(timeText)) {
    return null;
  }

  const [hours, minutes] = timeText
    .split(":")
    .map(Number);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  const result = new Date(
    `${dateText}T${timeText}:00+05:30`,
  );

  if (Number.isNaN(result.getTime())) {
    return null;
  }

  return result;
}

/*
|--------------------------------------------------------------------------
| WORKED HOURS
|--------------------------------------------------------------------------
*/

function calculateWorkedHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) {
    return null;
  }

  const start =
    checkIn instanceof Date
      ? checkIn
      : new Date(checkIn);

  const end =
    checkOut instanceof Date
      ? checkOut
      : new Date(checkOut);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    return null;
  }

  const difference =
    end.getTime() - start.getTime();

  if (difference <= 0) {
    return null;
  }

  return Number(
    (difference / 3600000).toFixed(2),
  );
}

/*
|--------------------------------------------------------------------------
| PUNCH HELPER
|--------------------------------------------------------------------------
*/

function punchIncludes(punchType, punch) {
  return (
    punchType === "both" ||
    punchType === punch
  );
}

/*
|--------------------------------------------------------------------------
| EMPLOYEE PROFILE
|--------------------------------------------------------------------------
*/

async function getEmployeeProfile(userId) {
  if (!userId) {
    return null;
  }

  return prisma.employeeProfile.findUnique({
    where: {
      userId,
    },
  });
}

/*
|--------------------------------------------------------------------------
| FORMAT ADMIN NOTIFICATION
|--------------------------------------------------------------------------
*/

function formatCorrectionNotification(description) {
  const correction =
    parseCorrectionRequest(description);

  if (!correction) {
    return null;
  }

  return {
    subject: "Forgot Punch Request",

    type: "ATTENDANCE_CORRECTION",

    punchType: correction.punchType,

    date: correction.date,

    checkInTime: correction.checkInTime,

    checkOutTime: correction.checkOutTime,

    reason: correction.reason || "",
  };
}

/*
|--------------------------------------------------------------------------
| EMPLOYEE - GET MY REQUESTS
|--------------------------------------------------------------------------
|
| GET /api/requests/my
|
| ONLY EMPLOYEE
|
|--------------------------------------------------------------------------
*/

router.get("/my", async (req, res) => {
  console.log("📥 GET /api/requests/my");
  console.log("👤 Auth user:", req.user);

  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    /*
     * IMPORTANT:
     * Only employees can access /my.
     */
    if (req.user.role !== "EMPLOYEE") {
      return res.status(403).json({
        message: "Only employees can view their requests.",
        role: req.user.role,
      });
    }

    const employee =
      await getEmployeeProfile(req.user.id);

    if (!employee) {
      return res.status(404).json({
        message: "Employee profile not found.",
      });
    }

    const requests =
      await prisma.employeeRequest.findMany({
        where: {
          employeeId: employee.id,
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    return res.json({
      requests,
    });
  } catch (error) {
    console.error(
      "❌ GET /requests/my:",
      error,
    );

    return res.status(500).json({
      message:
        error?.message ||
        "Failed to load your requests.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| EMPLOYEE - CREATE REQUEST
|--------------------------------------------------------------------------
|
| POST /api/requests/my
|
| ONLY EMPLOYEE
|
|--------------------------------------------------------------------------
*/

router.post("/my", async (req, res) => {
  console.log("======================================");
  console.log("📥 POST /api/requests/my");
  console.log("👤 USER:", req.user);
  console.log("📦 BODY:", req.body);
  console.log("======================================");

  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    /*
     * IMPORTANT:
     * ADMIN CANNOT CREATE REQUESTS HERE.
     */
    if (req.user.role !== "EMPLOYEE") {
      return res.status(403).json({
        message: "Only employees can create requests.",
        role: req.user.role,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | VALIDATE REQUEST
    |--------------------------------------------------------------------------
    */

    const parsed =
      employeeRequestSchema.safeParse(
        req.body || {},
      );

    if (!parsed.success) {
      console.log(
        "❌ Validation error:",
        parsed.error.flatten(),
      );

      return res.status(400).json({
        message:
          "Subject and valid request details are required.",

        errors: parsed.error.flatten(),
      });
    }

    /*
    |--------------------------------------------------------------------------
    | EMPLOYEE PROFILE
    |--------------------------------------------------------------------------
    */

    const employee =
      await getEmployeeProfile(req.user.id);

    if (!employee) {
      return res.status(404).json({
        message: "Employee profile not found.",
      });
    }

    console.log(
      "✅ Employee:",
      employee.id,
    );

    /*
    |--------------------------------------------------------------------------
    | PARSE CORRECTION
    |--------------------------------------------------------------------------
    */

    let correction = null;

    if (parsed.data.type === "CORRECTION") {
      correction =
        parseCorrectionRequest(
          parsed.data.description,
        );

      if (!correction) {
        return res.status(400).json({
          message: "Invalid Forgot Punch data.",
        });
      }

      if (!correction.date) {
        return res.status(400).json({
          message:
            "Attendance date is required.",
        });
      }

      if (
        ![
          "check-in",
          "check-out",
          "both",
        ].includes(correction.punchType)
      ) {
        return res.status(400).json({
          message: "Invalid punch type.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | CHECK IN TIME
      |--------------------------------------------------------------------------
      */

      if (correction.checkInTime) {
        const checkIn = timeToDate(
          correction.date,
          correction.checkInTime,
        );

        if (!checkIn) {
          return res.status(400).json({
            message:
              "Invalid Check In time.",
          });
        }
      }

      /*
      |--------------------------------------------------------------------------
      | CHECK OUT TIME
      |--------------------------------------------------------------------------
      */

      if (correction.checkOutTime) {
        const checkOut = timeToDate(
          correction.date,
          correction.checkOutTime,
        );

        if (!checkOut) {
          return res.status(400).json({
            message:
              "Invalid Check Out time.",
          });
        }
      }

      /*
      |--------------------------------------------------------------------------
      | CHECK TIME ORDER
      |--------------------------------------------------------------------------
      */

      if (
        correction.checkInTime &&
        correction.checkOutTime
      ) {
        const checkIn = timeToDate(
          correction.date,
          correction.checkInTime,
        );

        const checkOut = timeToDate(
          correction.date,
          correction.checkOutTime,
        );

        if (
          checkIn &&
          checkOut &&
          checkOut.getTime() <=
            checkIn.getTime()
        ) {
          return res.status(400).json({
            message:
              "Check Out time must be later than Check In time.",
          });
        }
      }
    }

    /*
    |--------------------------------------------------------------------------
    | CHECK EXISTING ATTENDANCE
    |--------------------------------------------------------------------------
    |
    | Pending request does NOT change attendance.
    |
    */

    if (correction) {
      const requestedDate =
        getDateKey(correction.date);

      const attendanceRange =
        getAttendanceDayRange(
          requestedDate,
        );

      const attendance =
        attendanceRange
          ? await prisma.attendance.findFirst({
              where: {
                employeeId: employee.id,

                date: {
                  gte: attendanceRange.start,

                  lt: new Date(
                    attendanceRange.end.getTime() +
                      1,
                  ),
                },
              },

              select: {
                checkIn: true,
                checkOut: true,
              },
            })
          : null;

      const requestsCheckIn =
        punchIncludes(
          correction.punchType,
          "check-in",
        );

      const requestsCheckOut =
        punchIncludes(
          correction.punchType,
          "check-out",
        );

      if (
        requestsCheckIn &&
        attendance?.checkIn
      ) {
        return res.status(409).json({
          message:
            "Check In is already completed for this date.",
        });
      }

      if (
        requestsCheckOut &&
        attendance?.checkOut
      ) {
        return res.status(409).json({
          message:
            "Check Out is already completed for this date.",
        });
      }
    }

    /*
    |--------------------------------------------------------------------------
    | DUPLICATE CHECK
    |--------------------------------------------------------------------------
    */

    if (correction) {
      const existingRequests =
        await prisma.employeeRequest.findMany({
          where: {
            employeeId: employee.id,

            type: "CORRECTION",

            status: {
              in: [
                "PENDING",
                "APPROVED",
              ],
            },
          },

          select: {
            id: true,
            description: true,
            status: true,
          },
        });

      const requestedDate =
        getDateKey(correction.date);

      const duplicate =
        existingRequests.find(
          (existing) => {
            const existingCorrection =
              parseCorrectionRequest(
                existing.description,
              );

            if (!existingCorrection) {
              return false;
            }

            return (
              getDateKey(
                existingCorrection.date,
              ) === requestedDate &&
              (
                (
                  punchIncludes(
                    existingCorrection.punchType,
                    "check-in",
                  ) &&
                  punchIncludes(
                    correction.punchType,
                    "check-in",
                  )
                ) ||
                (
                  punchIncludes(
                    existingCorrection.punchType,
                    "check-out",
                  ) &&
                  punchIncludes(
                    correction.punchType,
                    "check-out",
                  )
                )
              )
            );
          },
        );

      if (duplicate) {
        return res.status(409).json({
          message:
            "A Forgot Punch request already exists for this date and punch type.",

          requestId: duplicate.id,

          status: duplicate.status,
        });
      }
    }

    /*
    |--------------------------------------------------------------------------
    | CREATE REQUEST
    |--------------------------------------------------------------------------
    |
    | IMPORTANT:
    |
    | DO NOT CHANGE ATTENDANCE HERE.
    |
    | Attendance is changed only after ADMIN approval.
    |
    */

    const createdRequest =
      await prisma.employeeRequest.create({
        data: {
          employeeId: employee.id,

          type: parsed.data.type,

          subject: parsed.data.subject,

          description:
            parsed.data.description || "",

          status: "PENDING",
        },
      });

    console.log(
      "✅ REQUEST CREATED:",
      createdRequest.id,
    );

    return res.status(201).json({
      message:
        "Request submitted successfully.",

      request: createdRequest,
    });
  } catch (error) {
    console.error(
      "❌ CREATE REQUEST ERROR:",
      error,
    );

    return res.status(500).json({
      message:
        error?.message ||
        "Failed to submit request.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| ADMIN - GET ALL REQUESTS
|--------------------------------------------------------------------------
|
| GET /api/requests
|
| ADMIN ONLY / MODULE PERMISSION
|
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  requireAdminOrModulePermission(
    "requests",
    "canView",
  ),

  async (req, res) => {
    try {
      const { status } = req.query;

      const where = {};

      if (
        status &&
        [
          "PENDING",
          "APPROVED",
          "REJECTED",
        ].includes(status)
      ) {
        where.status = status;
      }

      const requests =
        await prisma.employeeRequest.findMany({
          where,

          include: {
            employee: {
              include: {
                user: {
                  select: {
                    fullName: true,
                    email: true,
                  },
                },
              },
            },
          },

          orderBy: {
            createdAt: "desc",
          },
        });

      const result = requests.map(
        (request) => {
          const notification =
            request.type === "CORRECTION"
              ? formatCorrectionNotification(
                  request.description,
                )
              : null;

          return {
            id: request.id,

            type: request.type,

            subject:
              notification?.subject ||
              request.subject,

            description: notification
              ? null
              : request.description,

            notification,

            status: request.status,

            reviewNote:
              request.reviewNote,

            reviewedAt:
              request.reviewedAt,

            createdAt:
              request.createdAt,

            employee: {
              id: request.employee.id,

              employeeCode:
                request.employee
                  .employeeCode,

              fullName:
                request.employee.user
                  ?.fullName ||
                "Unknown Employee",

              email:
                request.employee.user
                  ?.email || "",

              onboardingStatus:
                request.employee
                  .onboardingStatus,
            },
          };
        },
      );

      return res.json({
        requests: result,
      });
    } catch (error) {
      console.error(
        "❌ GET /requests:",
        error,
      );

      return res.status(500).json({
        message:
          "Failed to load requests.",
      });
    }
  },
);

/*
|--------------------------------------------------------------------------
| ADMIN - EMPLOYEE PROFILE
|--------------------------------------------------------------------------
|
| GET /api/requests/:id/profile
|
|--------------------------------------------------------------------------
*/

router.get(
  "/:id/profile",
  requireAdminOrModulePermission(
    "requests",
    "canView",
  ),

  async (req, res) => {
    try {
      const request =
        await prisma.employeeRequest.findUnique({
          where: {
            id: req.params.id,
          },

          include: {
            employee: {
              include: {
                user: {
                  select: {
                    fullName: true,
                    email: true,
                  },
                },
              },
            },
          },
        });

      if (!request) {
        return res.status(404).json({
          message: "Request not found.",
        });
      }

      return res.json({
        profile:
          request.employee,

        request: {
          id: request.id,

          type: request.type,

          status: request.status,
        },
      });
    } catch (error) {
      console.error(
        "❌ GET REQUEST PROFILE:",
        error,
      );

      return res.status(500).json({
        message:
          "Failed to load profile.",
      });
    }
  },
);

/*
|--------------------------------------------------------------------------
| ADMIN - REVIEW REQUEST
|--------------------------------------------------------------------------
*/

async function reviewRequest(
  req,
  res,
  decision,
) {
  try {
    const parsed =
      reviewSchema.safeParse(
        req.body || {},
      );

    if (!parsed.success) {
      return res.status(400).json({
        message:
          "Invalid review data.",
      });
    }

    const note =
      parsed.data.note?.trim() ||
      null;

    const requestId =
      req.params.id;

    /*
    |--------------------------------------------------------------------------
    | FIND REQUEST
    |--------------------------------------------------------------------------
    */

    const request =
      await prisma.employeeRequest.findUnique({
        where: {
          id: requestId,
        },
      });

    if (!request) {
      return res.status(404).json({
        message: "Request not found.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | ONLY PENDING REQUESTS
    |--------------------------------------------------------------------------
    */

    if (request.status !== "PENDING") {
      return res.status(400).json({
        message:
          "This request has already been reviewed.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | REJECT
    |--------------------------------------------------------------------------
    |
    | IMPORTANT:
    |
    | Never modify existing attendance.
    |
    */

    if (decision === "reject") {
      const updatedRequest =
        await prisma.employeeRequest.update({
          where: {
            id: requestId,
          },

          data: {
            status: "REJECTED",

            reviewNote:
              note ||
              "Forgot Punch request rejected.",

            reviewedById:
              req.user.id,

            reviewedAt:
              new Date(),
          },
        });

      return res.json({
        message:
          "Request rejected. Existing attendance was preserved.",

        request:
          updatedRequest,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | APPROVE
    |--------------------------------------------------------------------------
    */

    const correction =
      request.type === "CORRECTION"
        ? parseCorrectionRequest(
            request.description,
          )
        : null;

    /*
    |--------------------------------------------------------------------------
    | NORMAL REQUEST
    |--------------------------------------------------------------------------
    */

    if (!correction) {
      const updatedRequest =
        await prisma.employeeRequest.update({
          where: {
            id: requestId,
          },

          data: {
            status: "APPROVED",

            reviewNote:
              note ||
              "Request approved.",

            reviewedById:
              req.user.id,

            reviewedAt:
              new Date(),
          },
        });

      return res.json({
        message:
          "Request approved.",

        request:
          updatedRequest,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | CORRECTION DATE
    |--------------------------------------------------------------------------
    */

    const dateKey =
      getDateKey(
        correction.date,
      );

    if (!dateKey) {
      return res.status(400).json({
        message:
          "Invalid attendance date.",
      });
    }

    const attendanceRange =
      getAttendanceDayRange(
        dateKey,
      );

    if (!attendanceRange) {
      return res.status(400).json({
        message:
          "Invalid attendance date range.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | REQUESTED TIMES
    |--------------------------------------------------------------------------
    */

    const requestedCheckIn =
      correction.checkInTime
        ? timeToDate(
            dateKey,
            correction.checkInTime,
          )
        : null;

    const requestedCheckOut =
      correction.checkOutTime
        ? timeToDate(
            dateKey,
            correction.checkOutTime,
          )
        : null;

    if (
      correction.checkInTime &&
      !requestedCheckIn
    ) {
      return res.status(400).json({
        message:
          "Invalid Check In time.",
      });
    }

    if (
      correction.checkOutTime &&
      !requestedCheckOut
    ) {
      return res.status(400).json({
        message:
          "Invalid Check Out time.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | FIND EXISTING ATTENDANCE
    |--------------------------------------------------------------------------
    */

    const attendance =
      await prisma.attendance.findFirst({
        where: {
          employeeId:
            request.employeeId,

          date: {
            gte:
              attendanceRange.start,

            lt:
              attendanceRange.end,
          },
        },

        orderBy: {
          date: "asc",
        },
      });

    /*
    |--------------------------------------------------------------------------
    | PRESERVE EXISTING PUNCHES
    |--------------------------------------------------------------------------
    */

    let finalCheckIn =
      attendance?.checkIn ||
      null;

    let finalCheckOut =
      attendance?.checkOut ||
      null;

    /*
    |--------------------------------------------------------------------------
    | APPLY CHECK IN
    |--------------------------------------------------------------------------
    */

    if (
      correction.punchType ===
        "check-in" ||
      correction.punchType ===
        "both"
    ) {
      if (requestedCheckIn) {
        finalCheckIn =
          requestedCheckIn;
      }
    }

    /*
    |--------------------------------------------------------------------------
    | APPLY CHECK OUT
    |--------------------------------------------------------------------------
    */

    if (
      correction.punchType ===
        "check-out" ||
      correction.punchType ===
        "both"
    ) {
      if (requestedCheckOut) {
        finalCheckOut =
          requestedCheckOut;
      }
    }

    /*
    |--------------------------------------------------------------------------
    | VALIDATE ORDER
    |--------------------------------------------------------------------------
    */

    if (
      finalCheckIn &&
      finalCheckOut
    ) {
      if (
        finalCheckOut.getTime() <=
        finalCheckIn.getTime()
      ) {
        return res.status(400).json({
          message:
            "Check Out must be later than Check In.",
        });
      }
    }

    /*
    |--------------------------------------------------------------------------
    | CALCULATE WORKED HOURS
    |--------------------------------------------------------------------------
    */

    const workedHours =
      calculateWorkedHours(
        finalCheckIn,
        finalCheckOut,
      );

    /*
    |--------------------------------------------------------------------------
    | TRANSACTION
    |--------------------------------------------------------------------------
    */

    const result =
      await prisma.$transaction(
        async (transaction) => {
          let updatedAttendance;

          /*
          |--------------------------------------------------------------------------
          | EXISTING ATTENDANCE
          |--------------------------------------------------------------------------
          */

          if (attendance) {
            updatedAttendance =
              await transaction.attendance.update(
                {
                  where: {
                    id: attendance.id,
                  },

                  data: {
                    checkIn:
                      finalCheckIn,

                    checkOut:
                      finalCheckOut,

                    workedHours,

                    status:
                      "PRESENT",

                    note: [
                      attendance.note ||
                        "",

                      "Forgot Punch approved.",

                      note || "",
                    ]
                      .filter(Boolean)
                      .join(" "),
                  },
                },
              );
          } else {
            /*
            |--------------------------------------------------------------------------
            | NO ATTENDANCE
            |--------------------------------------------------------------------------
            */

            updatedAttendance =
              await transaction.attendance.create(
                {
                  data: {
                    employeeId:
                      request.employeeId,

                    date:
                      attendanceRange.start,

                    checkIn:
                      finalCheckIn,

                    checkOut:
                      finalCheckOut,

                    workedHours,

                    status:
                      "PRESENT",

                    note: [
                      "Forgot Punch approved.",

                      note || "",
                    ]
                      .filter(Boolean)
                      .join(" "),
                  },
                },
              );
          }

          /*
          |--------------------------------------------------------------------------
          | UPDATE REQUEST
          |--------------------------------------------------------------------------
          */

          const updatedRequest =
            await transaction.employeeRequest.update(
              {
                where: {
                  id: requestId,
                },

                data: {
                  status:
                    "APPROVED",

                  reviewNote:
                    note ||
                    "Forgot Punch request approved.",

                  reviewedById:
                    req.user.id,

                  reviewedAt:
                    new Date(),
                },
              },
            );

          return {
            updatedRequest,

            updatedAttendance,
          };
        },
      );

    /*
    |--------------------------------------------------------------------------
    | RESPONSE
    |--------------------------------------------------------------------------
    */

    return res.json({
      message:
        "Forgot Punch approved and attendance updated successfully.",

      request:
        result.updatedRequest,

      attendance: {
        id:
          result.updatedAttendance.id,

        date:
          result.updatedAttendance.date,

        checkIn:
          result.updatedAttendance.checkIn,

        checkOut:
          result.updatedAttendance.checkOut,

        workedHours:
          result.updatedAttendance
            .workedHours,

        status:
          result.updatedAttendance
            .status,
      },
    });
  } catch (error) {
    console.error(
      "❌ REVIEW REQUEST ERROR:",
      error,
    );

    return res.status(500).json({
      message:
        error?.message ||
        "Failed to review request.",
    });
  }
}

/*
|--------------------------------------------------------------------------
| ADMIN - APPROVE
|--------------------------------------------------------------------------
|
| POST /api/requests/:id/approve
|
|--------------------------------------------------------------------------
*/

router.post(
  "/:id/approve",

  requireAdminOrModulePermission(
    "requests",
    "canEdit",
  ),

  (req, res) =>
    reviewRequest(
      req,
      res,
      "approve",
    ),
);

/*
|--------------------------------------------------------------------------
| ADMIN - REJECT
|--------------------------------------------------------------------------
|
| POST /api/requests/:id/reject
|
|--------------------------------------------------------------------------
*/

router.post(
  "/:id/reject",

  requireAdminOrModulePermission(
    "requests",
    "canEdit",
  ),

  (req, res) =>
    reviewRequest(
      req,
      res,
      "reject",
    ),
);

/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

export default router;