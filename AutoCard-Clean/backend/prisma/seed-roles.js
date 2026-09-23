import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seed script for default roles with their module access.
 * This script is idempotent - it can be run multiple times safely.
 * 
 * Usage:
 *   npm run db:seed:roles
 *   OR
 *   node prisma/seed-roles.js
 * 
 * Default Roles:
 * - Admin: Full access to all 9 modules
 * - Employee: Access to 4 basic modules
 * - Customer: Access to 1 module (overview)
 * 
 * Requirements fulfilled: 1.4, 1.5, 1.6, 1.7, 16.4
 */

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

async function main() {
  console.log("Starting default roles seeding...");

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

  console.log("\nDefault roles seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Error seeding default roles:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
