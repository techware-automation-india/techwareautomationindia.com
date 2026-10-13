import { Router } from "express";
import { z } from "zod";

import prisma from "../prismaClient.js";
import { requireAuth } from "../middleware/auth.js";
import { checkRolePermission } from "../middleware/checkRolePermission.js";

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
  reason: z.string().optional(),
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
        /^(?:Forgot Punch|Time Edit) request for .*? on \d{4}-\d{2}-\d{2} at .*?(?:\.\s*|$)/i,
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
      !["check-in", "check-out", "both", "time-edit"].includes(
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

function buildCorrectionDescription(correction) {
  const reason = correction.reason?.trim() || "Forgot Punch request.";

  const readableText =
    `Forgot Punch request for ${correction.punchType} on ${correction.date}.` +
    `\n\n${reason}`;

  const metadata = JSON.stringify({
    date: correction.date,
    punchType: correction.punchType,
    checkInTime: correction.checkInTime || null,
    checkOutTime: correction.checkOutTime || null,
    checkInLocation: correction.checkInLocation || null,
    checkOutLocation: correction.checkOutLocation || null,
  });

  return `${readableText}\n\n${CORRECTION_MARKER}${metadata}`;
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
| TIME â†’ DATE
|--------------------------------------------------------------------------
*/

function timeToDate(dateText, timeText) {
  if (!dateText || !timeText) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    return null;
  }

  let cleanTime = String(timeText).trim();
  if (cleanTime.includes("T")) {
    cleanTime = cleanTime.split("T")[1];
  }
  const match = cleanTime.match(/^(\d{1,2}):(\d{1,2})/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

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

  const hStr = String(hours).padStart(2, "0");
  const mStr = String(minutes).padStart(2, "0");

  const result = new Date(`${dateText}T${hStr}:${mStr}:00+05:30`);

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

function punchIncludes(corrOrType, punch) {
  if (!corrOrType) return false;
  if (typeof corrOrType === "string") {
    return corrOrType === "both" || corrOrType === "time-edit" || corrOrType === punch;
  }
  if (corrOrType.punchType === "both") return true;
  if (corrOrType.punchType === punch) return true;
  if (corrOrType.punchType === "time-edit") {
    if (punch === "check-in") return Boolean(corrOrType.checkInTime);
    if (punch === "check-out") return Boolean(corrOrType.checkOutTime);
  }
  return false;
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

  return prisma.employeeProfile.findFirst({
    where: {
      OR: [
        { userId },
        { id: userId },
      ],
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
    subject: correction.punchType === "time-edit" ? "Time Edit Request" : "Forgot Punch Request",

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

router.post(["/my", "/"], async (req, res) => {
  console.log("======================================");
  console.log("📥 POST /api/requests");
  console.log("👤 USER:", req.user);
  console.log("📦 BODY:", req.body);
  console.log("======================================");

  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    const employee = await getEmployeeProfile(req.user.id);
    if (!employee) {
      return res.status(404).json({
        message: "Employee profile not found for this account.",
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

    if (req.user.role !== "ADMIN") {
      const dbUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { roleId: true, customRole: { select: { name: true } } },
      });
      if (dbUser?.roleId && dbUser?.customRole?.name?.toUpperCase() !== "ADMIN") {
        const roleModules = await prisma.roleModule.findMany({
          where: { roleId: dbUser.roleId },
          select: { moduleKey: true },
        });
        const userKeys = new Set(roleModules.map((m) => m.moduleKey));
        if (parsed.data.type === "CORRECTION") {
          if (!userKeys.has("requests-forgot-punch") && !userKeys.has("requests")) {
            return res.status(403).json({
              message: "Access denied. Forgot Punch service is not enabled for your role.",
            });
          }
        } else if (parsed.data.type === "EQUIPMENT") {
          if (!userKeys.has("requests-tools-inventory") && !userKeys.has("requests")) {
            return res.status(403).json({
              message: "Access denied. Tools & Inventory Request service is not enabled for your role.",
            });
          }
        }
      }
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

      const reqDate = new Date(`${correction.date}T00:00:00+05:30`);
      const reqDateNext = new Date(reqDate.getTime() + 24 * 60 * 60 * 1000);
      const approvedLeaveForReq = await prisma.leaveRequest.findFirst({
        where: {
          employeeId: employee.id,
          status: "APPROVED",
          startDate: { lt: reqDateNext },
          endDate: { gte: reqDate },
        },
        include: { leaveType: { select: { name: true } } },
      });

      if (approvedLeaveForReq) {
        return res.status(400).json({
          message: `Forgot Punch request cannot be submitted for ${correction.date} because you were on approved leave (${approvedLeaveForReq.leaveType?.name || "Leave"}).`,
        });
      }

      if (
        ![
          "check-in",
          "check-out",
          "both",
          "time-edit",
        ].includes(correction.punchType)
      ) {
        return res.status(400).json({
          message: "Invalid punch type.",
        });
      }

      /*
      |--------------------------------------------------------------------------
      | VALIDATE REQUIRED TIMES
      |--------------------------------------------------------------------------
      */

      if (correction.punchType === "time-edit") {
        if (!correction.checkInTime && !correction.checkOutTime) {
          return res.status(400).json({
            message: "Please provide at least check-in time or check-out time for time edit.",
          });
        }
      } else {
        if (correction.punchType === "check-in" && !correction.checkInTime) {
          return res.status(400).json({
            message: "Check In time is required.",
          });
        }
        if (correction.punchType === "check-out" && !correction.checkOutTime) {
          return res.status(400).json({
            message: "Check Out time is required.",
          });
        }
        if (correction.punchType === "both" && (!correction.checkInTime || !correction.checkOutTime)) {
          return res.status(400).json({
            message: "Both Check In and Check Out times are required.",
          });
        }
      }

      /*
      |--------------------------------------------------------------------------
      | CHECK IN TIME FORMAT
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
      | CHECK OUT TIME FORMAT
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
          correction,
          "check-in",
        );

      const requestsCheckOut =
        punchIncludes(
          correction,
          "check-out",
        );

      // Only block already completed punch for forgot-punch (not time-edit)
      if (correction.punchType !== "time-edit") {
        if (
          requestsCheckIn &&
          attendance?.checkIn
        ) {
          return res.status(409).json({
            message:
              "Check In is already completed for this date.",
          });
        }

        // If requesting check-in for today, verify that previous attendance is completed
        const requestedDateKey = getDateKey(correction.date);
        const todayDateKey = getDateKey(new Date());

        if (requestsCheckIn && requestedDateKey === todayDateKey) {
          const unclosedPrevious = await prisma.attendance.findFirst({
            where: {
              employeeId: employee.id,
              date: { lt: new Date(todayDateKey + "T00:00:00+05:30") },
              checkIn: { not: null },
              checkOut: null,
            },
            orderBy: { date: "desc" },
          });

          if (unclosedPrevious) {
            const unclosedDateKey = getDateKey(unclosedPrevious.date);
            return res.status(400).json({
              message: `Check-in for today is disabled. You have an uncompleted check-in from ${unclosedDateKey}. Please complete yesterday's check-out first.`,
            });
          }
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
                    existingCorrection,
                    "check-in",
                  ) &&
                  punchIncludes(
                    correction,
                    "check-in",
                  )
                ) ||
                (
                  punchIncludes(
                    existingCorrection,
                    "check-out",
                  ) &&
                  punchIncludes(
                    correction,
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

    const finalDescription =
      correction && parsed.data.type === "CORRECTION"
        ? buildCorrectionDescription(correction)
        : parsed.data.description || "";

    const createdRequest =
      await prisma.employeeRequest.create({
        data: {
          employeeId: employee.id,

          type: parsed.data.type,

          subject: parsed.data.subject,

          description: finalDescription,

          status: "PENDING",
        },
      });

    // If this is a project-related equipment request, auto-add to the chosen project immediately
    if (parsed.data.type === "EQUIPMENT") {
      const descText = createdRequest.description || "";
      const catMatch = descText.match(/Category:\s*([^\n\r|]+)/i);
      const catVal = catMatch ? catMatch[1].trim().toLowerCase() : "";
      if (catVal === "project" || catVal === "product") {
        try {
          await addOrEnsureProductInProject(createdRequest, employee.userId || employee.id);
        } catch (projErr) {
          console.warn("⚠️ addOrEnsureProductInProject on request creation error:", projErr);
        }
      }
    }

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
  checkRolePermission([
    "approvals-forgot-punch", "requests", "approvals", "attendance", "attendance-management",
    "inventory", "view-inventory", "inventory-in", "inventory-out", "general-consumables", "requests-tools-inventory"
  ]),

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
            reviewedBy: {
              select: {
                fullName: true,
                email: true,
              },
            },
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

            description: request.description,

            notification,

            status: request.status,

            reviewNote:
              request.reviewNote,

            reviewedAt:
              request.reviewedAt,

            reviewedBy:
              request.reviewedBy?.fullName || null,

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
  checkRolePermission(["approvals-forgot-punch", "requests", "approvals"]),

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

async function normalizeProductCategory(rawCategory) {
  if (!rawCategory) return "General / Consumables";
  const cat = rawCategory.trim();
  const lower = cat.toLowerCase();

  try {
    const rootCategories = await prisma.inventoryCategory.findMany({
      where: { OR: [{ parentId: null }, { level: 1 }] },
      select: { name: true },
    });
    if (rootCategories && rootCategories.length > 0) {
      const matched = rootCategories.find(
        (rc) => rc.name.toLowerCase() === lower || rc.name.toLowerCase().includes(lower) || lower.includes(rc.name.toLowerCase())
      );
      if (matched) return matched.name;
    }
  } catch (err) {
    console.warn("Could not query root inventory categories:", err);
  }

  return cat;
}

async function findTargetProject(projName) {
  if (!projName) return null;
  const cleanName = projName.trim();
  if (!cleanName || cleanName === "Other / Custom Project" || cleanName.includes("No assigned projects")) {
    return null;
  }

  try {
    let targetProject = await prisma.project.findFirst({
      where: {
        OR: [
          { name: { equals: cleanName } },
          { code: { equals: cleanName } },
        ],
      },
    });
    if (targetProject) return targetProject;

    targetProject = await prisma.project.findFirst({
      where: {
        OR: [
          { name: { contains: cleanName } },
          { code: { contains: cleanName } },
        ],
      },
    });
    if (targetProject) return targetProject;

    const allProjects = await prisma.project.findMany({
      select: { id: true, name: true, code: true },
    });
    const lowerClean = cleanName.toLowerCase();
    for (const p of allProjects) {
      const pName = (p.name || "").trim().toLowerCase();
      const pCode = (p.code || "").trim().toLowerCase();
      if (
        pName === lowerClean ||
        pCode === lowerClean ||
        (pName && lowerClean.includes(pName)) ||
        (pCode && lowerClean.includes(pCode)) ||
        (pName && pName.includes(lowerClean))
      ) {
        return p;
      }
    }

    // Auto-create project record if custom project name was provided and doesn't exist
    if (!targetProject && cleanName.length >= 2) {
      try {
        const count = await prisma.project.count();
        const genCode = `PROJ-${String(count + 1).padStart(3, "0")}`;
        targetProject = await prisma.project.create({
          data: {
            name: cleanName,
            code: genCode,
            status: "IN_PROGRESS",
            description: `Auto-created project for requested item: ${cleanName}`,
          },
        });
        return targetProject;
      } catch (createErr) {
        console.warn("⚠️ Could not auto-create custom project:", createErr);
      }
    }
  } catch (err) {
    console.warn("⚠️ findTargetProject error:", err);
  }

  return null;
}

async function addOrEnsureProductInProject(request, actionUserId = null) {
  if (!request || !request.description) return null;

  try {
    const text = request.description;

    // Check request category: If request Category is Tools, DO NOT add to Admin Projects
    const categoryMatch = text.match(/Category:\s*([^\n\r|]+)/i);
    const categoryVal = categoryMatch ? categoryMatch[1].trim().toLowerCase() : "";
    if (!["project", "product"].includes(categoryVal)) {
      return null; // Tools and general requests belong in Inventory, not project documents.
    }

    const productIdMatch = text.match(/Product ID:\s*([^\n\r|]+)/i);
    const quantityMatch = text.match(/Quantity:\s*(\d+)/i);
    const projectNameMatch = text.match(/Project Name:\s*([^\n\r|]+)/i);
    const projectCodeMatch = text.match(/Project Code:\s*([^\n\r|]+)/i);
    const productTypeMatch = text.match(/Product Type:\s*([^\n\r|]+)/i) || text.match(/Category:\s*([^\n\r|]+)/i);
    const itemNameMatch = text.match(/Item Name:\s*([^\n\r|]+)/i);

    const code = productIdMatch ? productIdMatch[1].trim() : null;
    const qty = quantityMatch ? parseInt(quantityMatch[1], 10) : 1;
    const rawCategory = productTypeMatch ? productTypeMatch[1].trim() : "General / Consumables";
    const prodCategory = await normalizeProductCategory(rawCategory);
    const itemName = itemNameMatch ? itemNameMatch[1].trim() : (code || "Product");

    let projName = projectNameMatch ? projectNameMatch[1].trim() : null;
    let projCode = projectCodeMatch ? projectCodeMatch[1].trim() : null;

    if (!projName && !projCode && request.subject) {
      const projSubjectMatch = request.subject.match(/\[Inventory (?:Taking|Return):\s*([^\]]+)\]/i);
      if (projSubjectMatch && projSubjectMatch[1]) {
        const extracted = projSubjectMatch[1].trim();
        if (!extracted.startsWith("ID:") && !extracted.match(/^[A-Z0-9_-]{3,12}$/i)) {
          projName = extracted;
        }
      }
    }

    if (!projName && !projCode) {
      const allProjects = await prisma.project.findMany({ select: { id: true, name: true, code: true } });
      const fullText = `${request.subject || ""} ${request.description || ""}`.toLowerCase();
      const matched = allProjects.find(p => p.name && p.name.length >= 3 && fullText.includes(p.name.toLowerCase()));
      if (matched) {
        projName = matched.name;
      }
    }

    let targetProject = null;
    if (projCode) {
      targetProject = await findTargetProject(projCode);
    }
    if (!targetProject && projName) {
      targetProject = await findTargetProject(projName);
    }
    if (!targetProject) return null;

    // 1. Ensure Category Folder exists (match existing project folder or create)
    const existingFolders = await prisma.projectDocument.findMany({
      where: {
        projectId: targetProject.id,
        OR: [{ fileType: "folder" }, { fileUrl: "#folder" }],
      },
    });

    const lowerCat = prodCategory.toLowerCase();
    let matchedFolder = existingFolders.find(
      (f) =>
        f.fileName.toLowerCase() === lowerCat ||
        f.fileName.toLowerCase().includes(lowerCat) ||
        lowerCat.includes(f.fileName.toLowerCase())
    );

    if (!matchedFolder && lowerCat.startsWith("mech")) {
      matchedFolder = existingFolders.find((f) => f.fileName.toLowerCase().startsWith("mech"));
    }
    if (!matchedFolder && (lowerCat.includes("pneu") || lowerCat.includes("numat"))) {
      matchedFolder = existingFolders.find(
        (f) => f.fileName.toLowerCase().includes("pneu") || f.fileName.toLowerCase().includes("numat")
      );
    }

    const effectiveFolder = matchedFolder ? matchedFolder.fileName : prodCategory;

    const isExcludedFolder =
      effectiveFolder.toLowerCase().includes("consumable") ||
      effectiveFolder.toLowerCase().includes("consuamble") ||
      effectiveFolder.toLowerCase().includes("general") ||
      effectiveFolder.toLowerCase().includes("genral") ||
      effectiveFolder.toLowerCase() === "tools" ||
      effectiveFolder.toLowerCase() === "tool";

    if (!matchedFolder && !isExcludedFolder) {
      await prisma.projectDocument.create({
        data: {
          projectId: targetProject.id,
          fileName: effectiveFolder,
          fileUrl: "#folder",
          fileType: "folder",
          fileSize: 0,
          uploadedById: actionUserId || request.employeeId || request.reviewedById || "system",
        },
      });
    }

    // 2. Ensure Product Document exists or is updated
    const productDocName = `[${effectiveFolder}] ${code || ""} - ${itemName} (Qty: ${qty})`;
    const existingDoc = await prisma.projectDocument.findFirst({
      where: {
        projectId: targetProject.id,
        fileName: productDocName,
      },
    });

    let foundPrice = 0;
    if (code || itemName) {
      const inv = await prisma.inventoryItem.findFirst({
        where: {
          OR: [
            ...(code ? [{ code: { equals: code } }] : []),
            ...(itemName ? [{ name: { equals: itemName } }] : []),
          ],
        },
        select: { costPrice: true },
      });
      if (inv?.costPrice) foundPrice = inv.costPrice;
    }

    let empName = "";
    if (request.employeeId) {
      const empUser = await prisma.employeeProfile.findUnique({
        where: { id: request.employeeId },
        include: { user: { select: { fullName: true } } },
      });
      if (empUser?.user?.fullName) empName = empUser.user.fullName;
    }

    let approvedByName = "Pending Approval";
    let approvedIso = "";
    if (request.status === "APPROVED" || request.status === "COMPLETED") {
      approvedIso = request.reviewedAt ? new Date(request.reviewedAt).toISOString() : new Date().toISOString();
      if (request.reviewedById) {
        const reviewer = await prisma.user.findUnique({
          where: { id: request.reviewedById },
          select: { fullName: true },
        });
        if (reviewer?.fullName) approvedByName = reviewer.fullName;
      } else {
        approvedByName = "Admin";
      }
    }

    const noteText = String(request.reviewNote || request.adminNote || "");
    const isFoundItem = noteText.includes("[PRODUCT_FOUND]") || request.status === "COMPLETED";
    const foundIso = isFoundItem && request.updatedAt ? new Date(request.updatedAt).toISOString() : "";

    const createdIso = request.createdAt ? new Date(request.createdAt).toISOString() : new Date().toISOString();

    let fileUrlWithPrice = foundPrice > 0 ? `#product?price=${foundPrice}` : "#product";
    fileUrlWithPrice += (fileUrlWithPrice.includes("?") ? "&" : "?") + `emp=${encodeURIComponent(empName || "Employee")}&approvedBy=${encodeURIComponent(approvedByName)}&created=${encodeURIComponent(createdIso)}&approved=${encodeURIComponent(approvedIso)}&found=${encodeURIComponent(foundIso)}&prodId=${encodeURIComponent(code || "")}&status=${encodeURIComponent(request.status || "PENDING")}`;

    if (!existingDoc) {
      await prisma.projectDocument.create({
        data: {
          projectId: targetProject.id,
          fileName: productDocName,
          fileUrl: fileUrlWithPrice,
          fileType: "used_product",
          fileSize: qty,
          uploadedById: actionUserId || request.employeeId || request.reviewedById || "system",
        },
      });

      await prisma.projectActivity.create({
        data: {
          projectId: targetProject.id,
          userId: actionUserId || request.reviewedById || request.employeeId || "system",
          activityType: "product_added",
          description: `Product ${code || itemName} (Qty: ${qty}) was added to project under category "${effectiveFolder}"`,
        },
      });

      return `Added product to Project "${targetProject.name}" under ${effectiveFolder}`;
    } else {
      await prisma.projectDocument.update({
        where: { id: existingDoc.id },
        data: {
          fileUrl: fileUrlWithPrice,
          fileSize: qty,
        },
      });
      return `Updated product in Project "${targetProject.name}" under ${effectiveFolder}`;
    }
  } catch (err) {
    console.warn("⚠️ addOrEnsureProductInProject error:", err);
    return null;
  }
}

async function updateEmployeeAssignedTools(request) {
  if (!request || !request.description || !request.employeeId) return null;

  try {
    const text = request.description;
    const categoryMatch = text.match(/Category:\s*([^\n\r|]+)/i);
    const categoryVal = categoryMatch ? categoryMatch[1].trim().toLowerCase() : "";

    const isToolRequest =
      categoryVal.includes("tool") ||
      (request.subject && request.subject.toLowerCase().includes("tool"));

    if (!isToolRequest) {
      return null;
    }

    const actionMatch = text.match(/Action Type:\s*([^\n\r|]+)/i);
    const action = actionMatch ? actionMatch[1].trim().toUpperCase() : "TAKING";

    const itemNameMatch = text.match(/Item Name:\s*([^\n\r|]+)/i);
    const productIdMatch = text.match(/Product ID:\s*([^\n\r|]+)/i);

    const itemName = itemNameMatch ? itemNameMatch[1].trim() : null;
    const productId = productIdMatch ? productIdMatch[1].trim() : null;

    const toolName = itemName || productId;
    if (!toolName) return null;

    const employee = await prisma.employeeProfile.findUnique({
      where: { id: request.employeeId },
      select: { id: true, employeeCode: true, assignedTools: true },
    });

    if (!employee) return null;

    let existingTools = (employee.assignedTools || "")
      .split(/,\s*|\n+/)
      .map((t) => t.trim())
      .filter(Boolean);

    let updatedTools = [...existingTools];

    if (action.includes("TAKING") || action.includes("TAKE") || action.includes("ISSUE")) {
      const alreadyExists = existingTools.some(
        (t) => t.toLowerCase() === toolName.toLowerCase()
      );
      if (!alreadyExists) {
        updatedTools.push(toolName);
      }
    } else if (action.includes("RETURN")) {
      updatedTools = existingTools.filter(
        (t) => {
          const lower = t.toLowerCase();
          const matchesItem = itemName && (lower === itemName.toLowerCase() || lower.includes(itemName.toLowerCase()) || itemName.toLowerCase().includes(lower));
          const matchesProduct = productId && (lower === productId.toLowerCase() || lower.includes(productId.toLowerCase()) || productId.toLowerCase().includes(lower));
          const matchesTool = toolName && (lower === toolName.toLowerCase() || lower.includes(toolName.toLowerCase()) || toolName.toLowerCase().includes(lower));
          return !matchesItem && !matchesProduct && !matchesTool;
        }
      );
    }

    const newToolsStr = updatedTools.join(", ");

    if (newToolsStr !== (employee.assignedTools || "")) {
      await prisma.employeeProfile.update({
        where: { id: employee.id },
        data: { assignedTools: newToolsStr },
      });
      return `[TOOLS_UPDATED] Assigned tools updated for ${employee.employeeCode}: ${newToolsStr || "(No tools assigned)"}`;
    }
  } catch (err) {
    console.warn("⚠️ updateEmployeeAssignedTools error:", err);
  }

  return null;
}

async function handleInventoryStockUpdate(request, note, isProductFoundAction = false) {
  if (!request || request.type !== "EQUIPMENT" || !request.description) {
    return note || "Request approved.";
  }

  try {
    const text = request.description;
    const productIdMatch = text.match(/Product ID:\s*([^\n\r|]+)/i);
    const itemNameMatch = text.match(/Item Name:\s*([^\n\r|]+)/i) || text.match(/Tool \/ Item Name:\s*([^\n\r|]+)/i);
    const quantityMatch = text.match(/Quantity:\s*(\d+)/i);
    const actionMatch = text.match(/Action Type:\s*([^\n\r|]+)/i);
    const categoryMatch = text.match(/Category:\s*([^\n\r|]+)/i);
    const productTypeMatch = text.match(/Product Type:\s*([^\n\r|]+)/i);
    const unitMatch = text.match(/Unit:\s*([^\n\r|]+)/i);
    const conditionMatch = text.match(/Item Condition:\s*([^\n\r|]+)/i);

    const code = productIdMatch ? productIdMatch[1].trim() : null;
    const itemName = itemNameMatch ? itemNameMatch[1].trim() : null;
    const qty = quantityMatch ? Math.max(1, parseInt(quantityMatch[1], 10)) : 1;
    const requestCategory = categoryMatch ? categoryMatch[1].trim() : null;
    const productType = productTypeMatch ? productTypeMatch[1].trim() : null;
    const unit = unitMatch ? unitMatch[1].trim() : "Nos";
    const condition = conditionMatch ? conditionMatch[1].trim() : null;

    const rawAction = actionMatch ? actionMatch[1].trim().toUpperCase() : "";
    const descLower = text.toLowerCase();
    const subjLower = (request.subject || "").toLowerCase();

    const isExplicitTaking =
      subjLower.includes("inventory taking") ||
      descLower.includes("action type: taking") ||
      descLower.includes("action type: issue");

    const isReturnAction =
      !isExplicitTaking &&
      (rawAction.includes("RETURN") ||
        descLower.includes("action type: return") ||
        descLower.includes("[inventory return") ||
        subjLower.includes("inventory return") ||
        subjLower.includes("return"));

    const noteStr = String(note || "");
    const combinedNotes = `${request.reviewNote || ""} ${noteStr}`;
    const alreadyRestocked =
      combinedNotes.includes("[STOCK_RESTOCKED]") ||
      combinedNotes.includes("[RETURN_RESTOCKED]");
    const alreadyDecremented = combinedNotes.includes("[STOCK_UPDATED]");

    let stockNote = "";

    // ─── 1. RETURN WORKFLOW: Add / Restock into Inventory & Update Qty ───
    if (isReturnAction) {
      const isDeferredReturn = noteStr.includes("Awaiting employee Item Return");
      const shouldRestock =
        !alreadyRestocked &&
        (isProductFoundAction ||
          noteStr.includes("[PRODUCT_FOUND]") ||
          noteStr.includes("[ITEM_RETURNED]") ||
          !isDeferredReturn);

      if (shouldRestock && (code || itemName)) {
        // A. Look up existing inventory item by code, sku, or name
        let item = await prisma.inventoryItem.findFirst({
          where: {
            OR: [
              ...(code ? [{ code: { equals: code } }, { sku: { equals: code } }] : []),
              ...(itemName ? [{ name: { equals: itemName } }, { code: { equals: itemName } }] : []),
            ],
          },
        });

        if (item) {
          // Increment quantity of existing inventory item
          const newQty = (item.quantity || 0) + qty;
          await prisma.inventoryItem.update({
            where: { id: item.id },
            data: { quantity: newQty },
          });
          stockNote = `[STOCK_RESTOCKED] Restocked ${qty} ${item.unit || unit} into inventory for "${item.name}" (Code: ${item.code || item.sku || "N/A"}). New stock: ${newQty} ${item.unit || unit}`;
        } else {
          // Item does NOT exist in inventory module yet! Add it as a new inventory item
          let targetCategoryId = null;
          let resolvedCategoryName = productType || requestCategory || "Tools";

          if (productType) {
            const cat = await prisma.inventoryCategory.findFirst({
              where: {
                OR: [
                  { name: { equals: productType } },
                  { code: { equals: productType } },
                ],
              },
            });
            if (cat) {
              targetCategoryId = cat.id;
              resolvedCategoryName = cat.name;
            }
          }

          if (!targetCategoryId && requestCategory) {
            const cat = await prisma.inventoryCategory.findFirst({
              where: {
                OR: [
                  { name: { equals: requestCategory } },
                  { code: { equals: requestCategory } },
                ],
              },
            });
            if (cat) {
              targetCategoryId = cat.id;
              resolvedCategoryName = cat.name;
            }
          }

          let finalCode = code ? code.trim() : null;
          if (finalCode) {
            const existingCode = await prisma.inventoryItem.findFirst({
              where: { OR: [{ code: finalCode }, { sku: finalCode }] },
            });
            if (existingCode) {
              finalCode = `${finalCode}RET${Date.now().toString().slice(-4)}`;
            }
          } else {
            finalCode = `RET${Date.now().toString().slice(-6)}`;
          }

          let empName = "";
          if (request.employeeId) {
            const emp = await prisma.employeeProfile.findUnique({
              where: { id: request.employeeId },
              include: { user: { select: { fullName: true } } },
            });
            empName = emp?.user?.fullName || emp?.employeeCode || "";
          }

          const newItem = await prisma.inventoryItem.create({
            data: {
              name: itemName || finalCode,
              code: finalCode,
              sku: finalCode,
              categoryId: targetCategoryId,
              category: resolvedCategoryName,
              quantity: qty,
              unit: unit || "Nos",
              minStock: 1,
              maxStock: 100,
              location: "Main Store / Warehouse",
              warehouse: "Main Warehouse",
              description: `Auto-added to inventory on Employee Item Return (Request #${request.id.slice(-6)}${empName ? ` returned by ${empName}` : ""}${condition ? `, Condition: ${condition}` : ""})`,
              date: new Date(),
              createdByName: empName ? `Return: ${empName}` : "Employee Return",
            },
          });

          stockNote = `[STOCK_RESTOCKED] Added returned item to inventory module as "${newItem.name}" (Code: ${newItem.code}) with initial stock ${newItem.quantity} ${newItem.unit}`;
        }

        // B. Update any open InventoryIssue matching this item/request
        try {
          const whereIssue = {
            status: "ISSUED",
            OR: [
              ...(item ? [{ inventoryItemId: item.id }] : []),
              ...(itemName ? [{ itemName: { equals: itemName } }] : []),
              ...(code ? [{ itemName: { contains: code } }] : []),
            ],
          };
          const openIssues = await prisma.inventoryIssue.findMany({ where: whereIssue });
          for (const issue of openIssues) {
            await prisma.inventoryIssue.update({
              where: { id: issue.id },
              data: {
                status: "RETURNED",
                returnDate: new Date(),
                notes: issue.notes
                  ? `${issue.notes} | Returned via Request #${request.id.slice(-6)}`
                  : `Returned via Request #${request.id.slice(-6)}`,
              },
            });
          }
        } catch (issueErr) {
          console.warn("⚠️ Error updating related inventory issues on return:", issueErr);
        }
      }
    }
    // ─── 2. TAKING / ISSUE WORKFLOW: Decrement Qty on Product Found ───
    else {
      const shouldUpdateStock = (isProductFoundAction || noteStr.includes("[PRODUCT_FOUND]")) && !alreadyDecremented;

      if ((code || itemName) && shouldUpdateStock) {
        const item = await prisma.inventoryItem.findFirst({
          where: {
            OR: [
              ...(code ? [{ code: { equals: code } }, { sku: { equals: code } }, { name: { equals: code } }] : []),
              ...(itemName ? [{ name: { equals: itemName } }, { code: { equals: itemName } }] : []),
            ],
          },
        });

        if (item) {
          const newQty = Math.max(0, (item.quantity || 0) - qty);
          if (newQty !== item.quantity) {
            await prisma.inventoryItem.update({
              where: { id: item.id },
              data: { quantity: newQty },
            });
            stockNote = `[STOCK_UPDATED] Stock updated for ${item.code || item.name} (${item.quantity} -> ${newQty} ${item.unit || "Nos"})`;
          }
        }
      }
    }

    // Auto-add product to Project under Category Folder on Approval (only for project/product categories)
    const projectNote = await addOrEnsureProductInProject(request, request.reviewedById);
    if (projectNote) {
      stockNote = stockNote ? `${stockNote} | ${projectNote}` : projectNote;
    }

    // Update Employee assignedTools on Tool Request Approval
    const toolsNote = await updateEmployeeAssignedTools(request);
    if (toolsNote) {
      stockNote = stockNote ? `${stockNote} | ${toolsNote}` : toolsNote;
    }

    return note ? `${note} | ${stockNote}` : `Request approved. | ${stockNote}`;
  } catch (err) {
    console.warn("⚠️ Inventory stock & project update error on approval:", err);
  }

  return note || "Request approved.";
}

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
      parsed.data.reason?.trim() ||
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

    if (req.user.role !== "ADMIN") {
      const dbUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          role: true,
          roleId: true,
          customRole: { select: { name: true } },
        },
      });

      const isUserAdmin = dbUser?.role === "ADMIN" || dbUser?.customRole?.name?.toUpperCase() === "ADMIN";

      if (!isUserAdmin) {
        const roleModules = dbUser?.roleId
          ? await prisma.roleModule.findMany({
              where: { roleId: dbUser.roleId },
              select: { moduleKey: true },
            })
          : [];
        const userKeys = new Set(roleModules.map((m) => m.moduleKey));

        if (request.type === "CORRECTION") {
          const canApproveCorrection = userKeys.has("approvals-forgot-punch") || userKeys.has("approvals");
          if (!canApproveCorrection) {
            return res.status(403).json({
              message: "Access denied. You do not have permission to review Forgot Punch requests.",
            });
          }
        } else if (request.type === "EQUIPMENT") {
          const canApproveEquipment =
            userKeys.has("approvals-tools-inventory") ||
            userKeys.has("approvals-tools") ||
            userKeys.has("approvals");
          if (!canApproveEquipment) {
            return res.status(403).json({
              message: "Access denied. You do not have permission to review Tools & Inventory requests.",
            });
          }
        }
      }
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

async function validateInventoryStockAvailability(request) {
  if (!request || request.type !== "EQUIPMENT" || !request.description) {
    return { ok: true };
  }

  const text = request.description;
  const productIdMatch = text.match(/Product ID:\s*([^\n\r|]+)/i);
  const quantityMatch = text.match(/Quantity:\s*(\d+)/i);
  const actionMatch = text.match(/Action Type:\s*([^\n\r|]+)/i);

  const code = productIdMatch ? productIdMatch[1].trim() : null;
  const qty = quantityMatch ? parseInt(quantityMatch[1], 10) : 1;
  const action = actionMatch ? actionMatch[1].trim().toUpperCase() : "TAKING";

  if (!action.includes("TAKING") && !action.includes("TAKE")) {
    return { ok: true };
  }

  if (!code) return { ok: true };

  const item = await prisma.inventoryItem.findFirst({
    where: {
      OR: [
        { code: { equals: code } },
        { sku: { equals: code } },
        { name: { equals: code } },
      ],
    },
  });

  if (!item) {
    return {
      ok: false,
      message: `Cannot approve request: Product ID '${code}' was not found in catalog.`,
    };
  }

  if (item.quantity <= 0 || item.quantity < qty) {
    return {
      ok: false,
      message: `Cannot approve request: Product '${item.code || item.name}' is OUT OF STOCK (Available: ${item.quantity} ${item.unit || "Nos"}, Requested: ${qty} ${item.unit || "Nos"}). Please place request on HOLD or restock inventory first.`,
    };
  }

  return { ok: true };
}

    /*
    |--------------------------------------------------------------------------
    | NORMAL REQUEST
    |--------------------------------------------------------------------------
    */

    if (!correction) {
      const stockCheck = await validateInventoryStockAvailability(request);
      if (!stockCheck.ok) {
        return res.status(400).json({
          message: stockCheck.message,
        });
      }

      const finalReviewNote = await handleInventoryStockUpdate(request, note);
      const safeReviewNote = typeof finalReviewNote === "string" ? finalReviewNote.slice(0, 4000) : finalReviewNote;

      const updatedRequest =
        await prisma.employeeRequest.update({
          where: {
            id: requestId,
          },

          data: {
            status: "APPROVED",

            reviewNote: safeReviewNote,

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
        "both" ||
      correction.punchType ===
        "time-edit"
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
        "both" ||
      correction.punchType ===
        "time-edit"
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
                      attendance.note || "",
                      `Forgot Punch approved. Reason: ${correction.reason || "Forgot Punch request."}`,
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
                      `Forgot Punch approved. Reason: ${correction.reason || "Forgot Punch request."}`,
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
| EMPLOYEE - MARK PRODUCT FOUND / RECEIVED
|--------------------------------------------------------------------------
|
| POST /api/requests/:id/found
|
| Allows employee who created an EQUIPMENT request to mark it as FOUND / COMPLETED
| after Admin approves it.
|
|--------------------------------------------------------------------------
*/
async function addProductToProjectOnFound(request) {
  return addOrEnsureProductInProject(request, request.employeeId);
}

/*
|--------------------------------------------------------------------------
| EMPLOYEE - ITEM RETURN
|--------------------------------------------------------------------------
|
| POST /api/requests/:id/item-return
|
| Allows employee who created an EQUIPMENT return request to mark the item
| as returned / handed over to admin/inventory store.
|
|--------------------------------------------------------------------------
*/
router.post("/:id/item-return", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required." });
    }

    const isAdmin = req.user.role === "ADMIN";
    const employee = await getEmployeeProfile(req.user.id);
    if (!employee && !isAdmin) {
      return res.status(404).json({ message: "Employee profile not found." });
    }

    const request = await prisma.employeeRequest.findUnique({
      where: { id: req.params.id },
    });

    if (!request) {
      return res.status(404).json({ message: "Request not found." });
    }

    if (!isAdmin && employee && request.employeeId !== employee.id) {
      return res.status(403).json({ message: "Not authorized to update this request." });
    }

    if (request.status !== "APPROVED") {
      return res.status(400).json({
        message: "Only approved requests can be marked as Item Return.",
      });
    }

    const handoverNote = req.body?.note || req.body?.remarks || "Employee physically returned item to inventory store.";
    const currentNote = request.reviewNote || "";

    const newNote = currentNote.includes("[ITEM_RETURNED]")
      ? currentNote
      : [currentNote, `[ITEM_RETURNED] ${handoverNote}`].filter(Boolean).join(" | ");

    // Remove tool from employee's assigned tools if it's a tool return
    await updateEmployeeAssignedTools(request);

    // Update inventory stock and restock / add returned item to inventory module
    let finalNote = newNote;
    try {
      finalNote = await handleInventoryStockUpdate(request, newNote, true);
    } catch (stockErr) {
      console.warn("⚠️ handleInventoryStockUpdate error on item-return:", stockErr);
    }

    const updated = await prisma.employeeRequest.update({
      where: { id: req.params.id },
      data: {
        reviewNote: typeof finalNote === "string" ? finalNote.slice(0, 4000) : finalNote,
      },
    });

    return res.json({
      message: "Item Return confirmed! Item returned and restocked in inventory module.",
      request: updated,
    });
  } catch (error) {
    console.error("❌ ITEM RETURN ERROR:", error);
    return res.status(500).json({ message: "Failed to submit item return." });
  }
});

const handleFoundRequest = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required." });
    }

    const userId = req.user.id || req.user.userId;
    const isAdmin = req.user.role === "ADMIN";
    const employee = await getEmployeeProfile(userId);
    if (!employee && !isAdmin) {
      return res.status(404).json({ message: "Employee profile not found." });
    }

    const request = await prisma.employeeRequest.findUnique({
      where: { id: req.params.id },
    });

    if (!request) {
      return res.status(404).json({ message: "Request not found." });
    }

    const descLower = typeof request.description === "string" ? request.description.toLowerCase() : "";
    const subjLower = typeof request.subject === "string" ? request.subject.toLowerCase() : "";
    const isExplicitTaking =
      subjLower.includes("inventory taking") ||
      descLower.includes("action type: taking") ||
      descLower.includes("action type: issue");

    const isReturnRequest =
      !isExplicitTaking &&
      (descLower.includes("action type: return") ||
        subjLower.includes("inventory return") ||
        descLower.includes("[inventory return") ||
        subjLower.includes("return"));

    if (!isAdmin) {
      const isOwner =
        (employee && request.employeeId === employee.id) ||
        (employee && request.employeeId === employee.userId) ||
        request.employeeId === userId;
      if (!isOwner) {
        return res.status(403).json({ message: "Not authorized to update this request." });
      }
    }

    // If already marked as found or completed, return success idempotently
    const noteText = String(request.reviewNote || "");
    if (request.status === "COMPLETED" || noteText.includes("[PRODUCT_FOUND]")) {
      return res.json({
        message: "Product already marked as found.",
        request,
      });
    }

    if (request.status !== "APPROVED") {
      return res.status(400).json({
        message: "Only approved requests can be marked as found/received.",
      });
    }

    const foundNoteText = isReturnRequest
      ? "[PRODUCT_FOUND] Admin confirmed item found in store and restocked to inventory."
      : "[PRODUCT_FOUND] Product found and collected by employee.";

    const cleanReviewNote = (request.reviewNote || "").replace(/\[ITEM_NOT_FOUND\][^|]*/g, "").trim();
    const noteWithFound = [cleanReviewNote, foundNoteText].filter(Boolean).join(" | ");
    let updatedReviewNote = noteWithFound;
    try {
      updatedReviewNote = await handleInventoryStockUpdate(request, noteWithFound, true);
    } catch (stockErr) {
      console.warn("⚠️ handleInventoryStockUpdate error:", stockErr);
    }

    const updated = await prisma.employeeRequest.update({
      where: { id: req.params.id },
      data: {
        status: "COMPLETED",
        reviewNote: typeof updatedReviewNote === "string" ? updatedReviewNote.slice(0, 4000) : updatedReviewNote,
      },
    });

    if (!isReturnRequest) {
      try {
        await addProductToProjectOnFound(updated);
      } catch (projErr) {
        console.warn("⚠️ addProductToProjectOnFound failed:", projErr);
      }
    } else {
      try {
        await updateEmployeeAssignedTools(request);
      } catch (toolErr) {
        console.warn("⚠️ updateEmployeeAssignedTools failed:", toolErr);
      }
    }

    const requestCategory = (request.description || "").match(/Category:\s*([^\n\r|]+)/i)?.[1]
      ?.trim()
      .toLowerCase();
    const isProjectCategory = ["project", "product"].includes(requestCategory);
    const inventoryFolder = requestCategory?.includes("tool")
      ? "Tools"
      : "General / Consumables";

    return res.json({
      message: isReturnRequest
        ? "Found Item! Return confirmed, stock updated and restocked to inventory."
        : isProjectCategory
          ? "Product marked as found/received successfully! Inventory stock updated and item added to project category folder."
          : `Product marked as found/received successfully! Inventory stock updated and saved under Inventory > ${inventoryFolder}.`,
      request: updated,
    });
  } catch (error) {
    console.error("❌ MARK PRODUCT FOUND ERROR:", error);
    return res.status(500).json({ message: "Failed to update product status." });
  }
};

router.post("/:id/found", handleFoundRequest);
router.put("/:id/found", handleFoundRequest);

const handleNotFoundRequest = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required." });
    }

    const userId = req.user.id || req.user.userId;
    const isAdmin = req.user.role === "ADMIN";
    const employee = await getEmployeeProfile(userId);
    if (!employee && !isAdmin) {
      return res.status(404).json({ message: "Employee profile not found." });
    }

    const request = await prisma.employeeRequest.findUnique({
      where: { id: req.params.id },
    });

    if (!request) {
      return res.status(404).json({ message: "Request not found." });
    }

    if (!isAdmin) {
      const isOwner =
        (employee && request.employeeId === employee.id) ||
        (employee && request.employeeId === employee.userId) ||
        request.employeeId === userId;
      if (!isOwner) {
        return res.status(403).json({ message: "Not authorized to update this request." });
      }
    }

    const reason = req.body?.reason || req.body?.note || "Item could not be found in store / workshop.";
    const notFoundNote = `[ITEM_NOT_FOUND] Employee reported item NOT FOUND: ${reason}`;
    const currentNote = request.reviewNote || "";
    const cleanCurrentNote = currentNote.replace(/\[ITEM_NOT_FOUND\][^|]*/g, "").trim();
    const updatedNote = [cleanCurrentNote, notFoundNote].filter(Boolean).join(" | ");

    const updated = await prisma.employeeRequest.update({
      where: { id: req.params.id },
      data: {
        reviewNote: updatedNote.slice(0, 4000),
      },
    });

    return res.json({
      message: "Reported as Not Found. Admin has been notified to investigate or restock.",
      request: updated,
    });
  } catch (error) {
    console.error("❌ NOT FOUND REQUEST ERROR:", error);
    return res.status(500).json({ message: "Failed to record item not found." });
  }
};

router.post("/:id/not-found", handleNotFoundRequest);
router.put("/:id/not-found", handleNotFoundRequest);

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
  checkRolePermission(["approvals-forgot-punch", "approvals-tools-inventory", "approvals-tools", "approvals"]),

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
  checkRolePermission(["approvals-forgot-punch", "approvals-tools-inventory", "approvals-tools", "approvals"]),

  (req, res) =>
    reviewRequest(
      req,
      res,
      "reject",
    ),
);

/*
|--------------------------------------------------------------------------
| ADMIN - HOLD (OUT OF STOCK / UNAVAILABLE)
|--------------------------------------------------------------------------
|
| POST /api/requests/:id/hold
|
|--------------------------------------------------------------------------
*/

router.post(
  "/:id/hold",
  checkRolePermission(["approvals-forgot-punch", "approvals-tools-inventory", "approvals-tools", "approvals"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { note, reason } = req.body;
      const holdNote = note || reason || "Product currently out of stock / unavailable.";

      const request = await prisma.employeeRequest.findUnique({
        where: { id },
      });

      if (!request) {
        return res.status(404).json({ message: "Request not found." });
      }

      const updated = await prisma.employeeRequest.update({
        where: { id },
        data: {
          status: "PENDING",
          reviewNote: `[ON_HOLD] ${holdNote}`,
          reviewedById: req.user.id,
          reviewedAt: new Date(),
        },
      });

      return res.json({
        message: "Request placed on hold successfully.",
        request: updated,
      });
    } catch (error) {
      console.error("❌ HOLD REQUEST ERROR:", error);
      return res.status(500).json({ message: "Failed to place request on hold." });
    }
  }
);

/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

export { addOrEnsureProductInProject };
export default router;