import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import prisma from "./prismaClient.js";
import authRouter from "./routes/auth.js";
import employeesRouter from "./routes/employees.js";
// CUSTOMER ROUTES COMMENTED OUT
// import customersRouter from "./routes/customers.js";
import onboardingRouter from "./routes/onboarding.js";
import requestsRouter from "./routes/requests.js";
import leaveTypesRouter from "./routes/leaveTypes.js";
import leaveRouter from "./routes/leave.js";
import holidaysRouter from "./routes/holidays.js";
import attendanceRouter from "./routes/attendance.js";
import contactRoutes from "./routes/email.js";
import rolesAccessRouter from "./routes/rolesAccess.js";
import shiftRouter from "./routes/shiftRoutes.js";
import locationRouter from "./routes/locationRoutes.js";
import rosterRouter from "./routes/rosterRoutes.js";
import projectsRouter from "./routes/projects.js";
import servicesRouter from "./routes/services.js";
import supportRouter from "./routes/support.js";

const app = express();
const PORT = process.env.PORT || 4000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function logDatabaseConnection() {
  try {
    await prisma.$connect();
    console.log("✅ Database connected successfully.");
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    // Don't exit - let the server continue running
    // Database may reconnect automatically
  }
}

// Keep database connection alive with periodic health checks
function startDatabaseHealthCheck() {
  // Check database connection every 5 minutes
  const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
  
  setInterval(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log("🔄 Database connection is healthy");
    } catch (error) {
      console.error("⚠️ Database health check failed:", error.message);
      // Try to reconnect
      try {
        await prisma.$connect();
        console.log("✅ Database reconnected");
      } catch (reconnectError) {
        console.error("❌ Database reconnection failed:", reconnectError.message);
      }
    }
  }, HEALTH_CHECK_INTERVAL);
}

// ==================== CORS CONFIGURATION ====================
// Parse allowed origins from environment variable (comma-separated)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173,https://techwareautomation.in,https://www.techwareautomation.in,https://api.techwareautomation.in")
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);

console.log("🌐 Environment:", process.env.NODE_ENV || 'development');
console.log("🌐 Allowed CORS origins:", allowedOrigins);

// Optional: Pattern matching for dynamic deployments
// Handle both string "true" and boolean true, trim whitespace
const allowVercelPreviewsValue = (process.env.ALLOW_VERCEL_PREVIEWS || "").toString().trim().toLowerCase();
const allowHostingerValue = (process.env.ALLOW_HOSTINGER_SITES || "").toString().trim().toLowerCase();

const allowVercelPattern = allowVercelPreviewsValue === "true";
const allowHostingerPattern = allowHostingerValue === "true";

// Updated regex to match all Vercel deployment URLs including previews
// This pattern matches: https://anything.vercel.app (including hyphens, numbers, letters)
const vercelPattern = /^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/i;
const hostingerPattern = /^https:\/\/.*\.hostinger\.site$/i;
const hostingerWebPattern = /^https:\/\/.*\.hostingersite\.com$/i;

console.log("🔍 ALLOW_VERCEL_PREVIEWS env value:", JSON.stringify(process.env.ALLOW_VERCEL_PREVIEWS), "→ trimmed:", JSON.stringify(allowVercelPreviewsValue));
console.log("🔍 allowVercelPattern boolean:", allowVercelPattern);

if (allowVercelPattern) {
  console.log("🌐 Vercel preview deployments: ENABLED ✅");
}
if (allowHostingerPattern) {
  console.log("🌐 Hostinger site deployments: ENABLED ✅");
}

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests without Origin (like Postman, curl, etc.)
    if (!origin) {
      console.log("✅ CORS allowed: No origin header (direct request)");
      return callback(null, true);
    }

    // Exact origins match
    if (allowedOrigins.includes(origin)) {
      console.log("✅ CORS allowed (exact match):", origin);
      return callback(null, true);
    }

    // Vercel deployments pattern matching
    if (allowVercelPattern && vercelPattern.test(origin)) {
      console.log("✅ CORS allowed (Vercel pattern):", origin);
      return callback(null, true);
    }

    // Hostinger deployments pattern matching
    if (
      allowHostingerPattern &&
      (hostingerPattern.test(origin) || hostingerWebPattern.test(origin))
    ) {
      console.log("✅ CORS allowed (Hostinger pattern):", origin);
      return callback(null, true);
    }

    // Blocked - log detailed information
    console.log("❌ CORS BLOCKED:", origin);
    console.log("   - allowedOrigins:", allowedOrigins);
    console.log("   - allowVercelPattern:", allowVercelPattern);
    console.log("   - vercelPattern.test(origin):", vercelPattern.test(origin));
    console.log("   - allowHostingerPattern:", allowHostingerPattern);
    console.log("   - hostingerPattern.test(origin):", hostingerPattern.test(origin));
    console.log("   - Is in allowedOrigins:", allowedOrigins.includes(origin));
    return callback(null, false);
  },

  credentials: true,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
  ],

  exposedHeaders: [
    "Content-Length",
    "X-Request-Id",
  ],

  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// ✅ Express 5 compatible
app.options(/.*/, cors(corsOptions));

// ==================== MIDDLEWARE ====================
const contactLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again after a minute.",
  },
});

app.use("/api/contact", contactLimiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==================== ROUTES ====================
app.get("/", (_req, res) => {
  res.json({
    status: "OK",
    server: "Techware backend running",
    health: "/api/health"
  });
});

app.get("/favicon.ico", (_req, res) => {
  res.status(204).end();
});

// Serve uploaded files (skip on Vercel as files are in /tmp and not persistent)
if (process.env.VERCEL !== "1") {
  app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
}

// API Routes
app.use("/api/auth", authRouter);
app.use("/api/employees", employeesRouter);
// app.use("/api/customers", customersRouter); // CUSTOMER ROUTES COMMENTED OUT
app.use("/api/onboarding", onboardingRouter);
app.use("/api/requests", requestsRouter);
app.use("/api/leave-types", leaveTypesRouter);
app.use("/api/leave", leaveRouter);
app.use("/api/holidays", holidaysRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/contact", contactRoutes);
app.use("/api/roles-access", rolesAccessRouter);
app.use("/api/shifts", shiftRouter);
app.use("/api/locations", locationRouter);
app.use("/api/roster", rosterRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/services", servicesRouter);
app.use("/api/support", supportRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "OK",
    server: "running"
  });
});

// ==================== SERVER STARTUP ====================
// Only start the server if not in serverless environment (Vercel)
if (process.env.VERCEL !== "1") {
  const server = app.listen(PORT, "0.0.0.0", async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    await logDatabaseConnection();
    
    // Start database health check to prevent timeouts
    //if (process.env.NODE_ENV === 'production') {
    //  startDatabaseHealthCheck();
    //  console.log("🔄 Database health check started");
  ///  }
  });

  // Handle server errors
  server.on('error', (error) => {
    console.error('❌ Server error:', error);
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use`);
    }
  });

  let isShuttingDown = false;

  const shutdown = async () => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    console.log("Stopping server...");

    await new Promise((resolve) => {
      server.close(() => resolve());
    });

    await prisma.$disconnect();

    console.log("Server Stopped.");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// Log database connection on startup (for serverless too)


// Export for Vercel serverless
export default app;
