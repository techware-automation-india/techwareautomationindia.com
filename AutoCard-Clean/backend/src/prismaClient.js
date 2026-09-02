import { PrismaClient } from "@prisma/client";

// Single shared Prisma instance with connection pooling
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['error'] : ['query', 'error', 'warn'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Handle connection errors gracefully
prisma.$on('error', (e) => {
  console.error('Prisma error:', e);
});

export default prisma;
