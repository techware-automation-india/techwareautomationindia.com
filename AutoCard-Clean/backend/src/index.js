import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
//import prisma from "./prismaClient.js";
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


// Allow the configured client origin plus common local Vite ports and all Vercel domains
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://techwareautomationindia.vercel.app",
  "https://techwareautomationindia-ard3ck9jk-techware-automation-india.vercel.app",
  process.env.CLIENT_ORIGIN,
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // Check if origin matches any allowed pattern
      const isAllowed = allowedOrigins.some(allowed => {
        if (typeof allowed === 'string') return origin === allowed;
        if (allowed instanceof RegExp) return allowed.test(origin);
        return false;
      });
      
      if (isAllowed) {
        return callback(null, true);
      }
      
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);


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

// Serve uploaded files
app.use("/uploads", express.static("uploads"));

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
  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
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

// Export for Vercel serverless (not used on Render)
export default app;
