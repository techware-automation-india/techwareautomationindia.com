import pkg from "@prisma/client";

const { PrismaClient } = pkg;

// Single shared Prisma instance
const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === "production"
      ? ["error"]
      : ["query", "error", "warn"],

  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },

  // Optimized connection pool settings for Hostinger MySQL
  __internal: {
    engine: {
      connection_limit: 3,
      pool_timeout: 20,
      connect_timeout: 30,
    },
  },
});

// Handle Prisma errors
prisma.$on("error", (e) => {
  console.error("Prisma error:", e);
});

export default prisma;
