import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Seed one user per role for local development/testing.
const seedUsers = [
  { email: "admin@techware.com", fullName: "System Admin", role: "ADMIN", password: "admin123" },
  { 
    email: "employee@techware.com", 
    fullName: "Staff Member", 
    role: "EMPLOYEE", 
    password: "employee123",
    employeeCode: "EMP-001",
    jobTitle: "Software Engineer"
  },
  { email: "customer@techware.com", fullName: "Sample Customer", role: "CUSTOMER", password: "customer123" },
];

async function main() {
  for (const u of seedUsers) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    
    if (u.role === "EMPLOYEE") {
      // Create employee with profile
      await prisma.user.upsert({
        where: { email: u.email },
        update: {},
        create: {
          email: u.email,
          fullName: u.fullName,
          role: u.role,
          passwordHash,
          employeeProfile: {
            create: {
              employeeCode: u.employeeCode,
              jobTitle: u.jobTitle,
              onboardingStatus: "PENDING",
            },
          },
        },
      });
    } else {
      // Create admin or customer without profile
      await prisma.user.upsert({
        where: { email: u.email },
        update: {},
        create: {
          email: u.email,
          fullName: u.fullName,
          role: u.role,
          passwordHash,
        },
      });
    }
    console.log(`Seeded ${u.role}: ${u.email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
