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

/**
 * Seed default roles with their module access.
 * Requirements fulfilled: 1.4, 1.5, 1.6, 1.7, 16.4
 */
async function seedDefaultRoles() {
  console.log("\n=== Seeding Default Roles ===");
  
  const defaultRoles = [
    {
      name: "Admin",
      isDefault: true,
      modules: [
        "overview",
        "employee",
        "requests",
        "approvals",
        "mark-attendance",
        "attendance",
        "roles-access",
        "shift-location",
        "roster"
      ]
    },
    {
      name: "Employee",
      isDefault: true,
      modules: [
        "overview",
        "mark-attendance",
        "attendance",
        "requests"
      ]
    },
    {
      name: "Customer",
      isDefault: true,
      modules: [
        "overview"
      ]
    }
  ];

  for (const roleData of defaultRoles) {
    // Upsert the role (create if doesn't exist, update if exists)
    const role = await prisma.roleTable.upsert({
      where: { name: roleData.name },
      update: { isDefault: roleData.isDefault },
      create: {
        name: roleData.name,
        isDefault: roleData.isDefault,
      },
    });

    console.log(`Seeded role: ${role.name} (id: ${role.id})`);

    // Remove existing module associations for this role to ensure clean state
    await prisma.roleModule.deleteMany({
      where: { roleId: role.id },
    });

    // Create new module associations
    for (const moduleKey of roleData.modules) {
      await prisma.roleModule.create({
        data: {
          roleId: role.id,
          moduleKey: moduleKey,
        },
      });
    }

    console.log(`  ✓ Configured ${roleData.modules.length} modules for ${role.name}`);
  }

  console.log("Default roles seeding completed!\n");
}

async function main() {
  // 0. Seed default roles FIRST (before any user-related seeds)
  await seedDefaultRoles();

  // 1. Seed default shifts
  const defaultShifts = [
    {
      name: "Morning Shift",
      startTime: "09:00",
      endTime: "17:00",
      description: "Standard morning shift - 9 AM to 5 PM",
      isActive: true
    },
    {
      name: "Evening Shift", 
      startTime: "14:00",
      endTime: "22:00",
      description: "Evening shift - 2 PM to 10 PM",
      isActive: true
    },
    {
      name: "Night Shift",
      startTime: "22:00",
      endTime: "06:00",
      description: "Night shift - 10 PM to 6 AM",
      isActive: true
    }
  ];

  for (const shift of defaultShifts) {
    await prisma.shift.upsert({
      where: { name: shift.name },
      update: {},
      create: shift,
    });
    console.log(`Seeded shift: ${shift.name}`);
  }

  // 2. Seed default location
  const defaultLocation = {
    name: "Head Office",
    addressLine: "123 Main Street",
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    isActive: true
  };

  await prisma.location.upsert({
    where: { name: defaultLocation.name },
    update: {},
    create: defaultLocation,
  });
  console.log(`Seeded location: ${defaultLocation.name}`);

  // 3. Seed users
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
