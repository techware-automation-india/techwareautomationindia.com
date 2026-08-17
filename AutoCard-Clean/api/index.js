import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import authRouter from "../backend/src/routes/auth.js";
import employeesRouter from "../backend/src/routes/employees.js";
import customersRouter from "../backend/src/routes/customers.js";
import onboardingRouter from "../backend/src/routes/onboarding.js";
import requestsRouter from "../backend/src/routes/requests.js";
import leaveTypesRouter from "../backend/src/routes/leaveTypes.js";
import leaveRouter from "../backend/src/routes/leave.js";
import holidaysRouter from "../backend/src/routes/holidays.js";
import attendanceRouter from "../backend/src/routes/attendance.js";
import contactRoutes from "../backend/src/routes/email.js";
import rolesAccessRouter from "../backend/src/routes/rolesAccess.js";
import shiftRouter from "../backend/src/routes/shiftRoutes.js";
import locationRouter from "../backend/src/routes/locationRoutes.js";

const app = express();

// CORS configuration
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://techwareautomationindia.vercel.app",
  process.env.CLIENT_ORIGIN,
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      // Check if origin matches allowed patterns
      if (
        allowedOrigins.includes(origin) ||
        /^https:\/\/.*\.vercel\.app$/.test(origin)
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: "Too many requests from this IP, please try again later.",
});

app.use(limiter);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "OK",
    server: "running",
    environment: "vercel-serverless",
  });
});

// API routes
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

// Error handling
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    message: err.message || "Internal server error",
  });
});

// Export for Vercel serverless
export default app;
