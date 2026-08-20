import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import prisma from "./prismaClient.js";
import authRouter from "./routes/auth.js";
import employeesRouter from "./routes/employees.js";
import customersRouter from "./routes/customers.js";
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

const app = express();
const PORT = process.env.PORT || 4001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function logDatabaseConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("Database connected successfully.");
  } catch (error) {
    console.error("Database connection failed:", error.message);
  }
}


const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://techwareautomationindia.vercel.app",
  "https://techwareautomationindia.com",
  "https://www.techwareautomationindia.com",
  process.env.CLIENT_ORIGIN,
  process.env.FRONTEND_URL,
].filter(Boolean);

// Pattern to match ALL Vercel preview deployments
const vercelPattern = /^https:\/\/.*\.vercel\.app$/i;

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
app.use("/api/customers", customersRouter);
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
// Health check - also verifies the database connection.
app.get("/api/health", (_req, res) => {
  res.json({
    status: "OK",
    server: "running"
  });
});

// Only start the server if not in serverless environment (Vercel)
// Render.com needs the server to start normally
if (process.env.VERCEL !== "1") {
  const server = app.listen(PORT, "0.0.0.0", async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await logDatabaseConnection();
});

  const shutdown = () => {
    console.log("Stopping server...");

    server.close(() => {
      console.log("Server stopped.");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

logDatabaseConnection();

// Export for Vercel serverless (not used on Render)
export default app;
