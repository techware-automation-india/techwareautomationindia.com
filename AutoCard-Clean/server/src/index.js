import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
//import prisma from "./prismaClient.js";
import authRouter from "./routes/auth.js";
import employeesRouter from "./routes/employees.js";
import onboardingRouter from "./routes/onboarding.js";
import requestsRouter from "./routes/requests.js";
import leaveTypesRouter from "./routes/leaveTypes.js";
import holidaysRouter from "./routes/holidays.js";
import attendanceRouter from "./routes/attendance.js";
import contactRoutes from "./routes/email.js";
const app = express();
const PORT = process.env.PORT || 4000;


// Allow the configured client origin plus common local Vite ports.
const allowedOrigins = [
  process.env.CLIENT_ORIGIN || "http://localhost:5173",
  "http://localhost:5173",
  "http://localhost:5174",
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
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
app.use("/api/onboarding", onboardingRouter);
app.use("/api/requests", requestsRouter);
app.use("/api/leave-types", leaveTypesRouter);
app.use("/api/holidays", holidaysRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/contact", contactRoutes);
// Health check - also verifies the database connection.
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    server: "running"
  });
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}/api/health`);
});

// Graceful shutdown.
const shutdown = () => {
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
