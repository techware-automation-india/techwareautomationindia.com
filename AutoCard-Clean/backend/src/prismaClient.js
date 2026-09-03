import { PrismaClient } from "@prisma/client";

// Single shared Prisma instance with optimized connection pooling for Hostinger
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['error'] : ['query', 'error', 'warn'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Optimized connection pool settings for Hostinger MySQL
  __internal: {
    engine: {
      connection_limit: 3, // Lower limit for shared hosting
      pool_timeout: 20, // Increased timeout
      connect_timeout: 30, // Increased connection timeout
    }
  }
});

// Handle connection errors gracefully
prisma.$on('error', (e) => {
  console.error('Prisma error:', e);
});

export default prisma;
