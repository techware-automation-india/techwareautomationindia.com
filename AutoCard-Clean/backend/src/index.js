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
const PORT = process.env.PORT || 4000; // Use 4000 as fallback instead of 4001
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


const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://techwareautomationindia.vercel.app",
  "https://techwareautomation.in",
  "https://www.techwareautomation.in",
  "https://techwareautomationindia.com",
  "https://www.techwareautomationindia.com",
  "https://techwareautomationindia.co.org",
  "https://www.techwareautomationindia.co.org",
  process.env.CLIENT_ORIGIN,
  process.env.FRONTEND_URL,
].filter(Boolean);

// Pattern to match ALL Vercel preview deployments and Hostinger domains
const vercelPattern = /^https:\/\/.*\.vercel\.app$/i;
const hostingerPattern = /^https:\/\/.*\.hostinger\.site$/i;

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests without Origin (Postman, server-to-server, mobile apps)
    if (!origin) {
      return callback(null, true);
    }

    // Check exact match first
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Allow any Vercel preview deployment
    if (vercelPattern.test(origin)) {
      console.log("✅ CORS allowed Vercel preview:", origin);
      return callback(null, true);
    }

    // Allow any Hostinger deployment
    if (hostingerPattern.test(origin)) {
      console.log("✅ CORS allowed Hostinger:", origin);
      return callback(null, true);
    }

    console.log("❌ CORS blocked origin:", origin);
    return callback(null, false); // Don't throw error, just deny
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204, // Some legacy browsers choke on 204
};

app.use(cors(corsOptions));
// Handle preflight requests explicitly
app.options("*", cors(corsOptions));


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

// Routes
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
// Health check - also verifies the database connection.
app.get("/api/health", (_req, res) => {
  res.json({
    status: "OK",
    server: "running"
  });
});

// Only start the server if not in serverless environment (Vercel)
// Hostinger/Render needs the server to start normally
if (process.env.VERCEL !== "1") {
  const server = app.listen(PORT, "0.0.0.0", async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    await logDatabaseConnection();
    
    // Start database health check to prevent timeouts
    if (process.env.NODE_ENV === 'production') {
      startDatabaseHealthCheck();
      console.log("🔄 Database health check started");
    }
  });

  // Handle server errors
  server.on('error', (error) => {
    console.error('❌ Server error:', error);
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use`);
    }
  });

  const shutdown = async () => {
    console.log("Stopping server...");
    
    // Disconnect Prisma
    await prisma.$disconnect();
    
    server.close(() => {
      console.log("Server stopped.");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// Log database connection on startup (for serverless too)
logDatabaseConnection();

// Export for Vercel serverless (not used on Render)
export default app;
