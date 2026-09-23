/**
 * User Role Migration Script
 * 
 * Migrates existing users from role enum to roleId foreign key.
 * Maps User.role enum values (ADMIN, EMPLOYEE, CUSTOMER) to corresponding
 * roleId in the RoleTable (Admin, Employee, Customer).
 * 
 * Requirements: 16.3
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migrateUserRoles() {
  console.log("\n=== User Role Migration Script ===\n");

  try {
    // Step 1: Fetch all three default role IDs
    console.log("Step 1: Fetching default role IDs...");
    
    const adminRole = await prisma.roleTable.findUnique({ 
      where: { name: 'Admin' } 
    });
    const employeeRole = await prisma.roleTable.findUnique({ 
      where: { name: 'Employee' } 
    });
    const customerRole = await prisma.roleTable.findUnique({ 
      where: { name: 'Customer' } 
    });

    // Validate all default roles exist
    if (!adminRole || !employeeRole || !customerRole) {
      throw new Error(
        "Missing default roles. Please ensure default roles are seeded first.\n" +
        `Found: Admin=${!!adminRole}, Employee=${!!employeeRole}, Customer=${!!customerRole}`
      );
    }

    console.log("✓ Default roles found:");
    console.log(`  - Admin: ${adminRole.id}`);
    console.log(`  - Employee: ${employeeRole.id}`);
    console.log(`  - Customer: ${customerRole.id}\n`);

    // Step 2: Map User.role enum values to corresponding roleId
    const roleMap = {
      ADMIN: adminRole.id,
      EMPLOYEE: employeeRole.id,
      CUSTOMER: customerRole.id
    };

    // Step 3: Fetch all users
    console.log("Step 2: Fetching all users...");
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        roleId: true
      }
    });

    console.log(`✓ Found ${users.length} users\n`);

    // Step 4: Update all existing users to set roleId based on their role enum
    console.log("Step 3: Migrating user roles...\n");

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        // Skip if roleId is already set
        if (user.roleId) {
          console.log(`  ⊘ Skipped ${user.email} (roleId already set: ${user.roleId})`);
          skippedCount++;
          continue;
        }

        // Get the target roleId based on enum value
        const targetRoleId = roleMap[user.role];

        if (!targetRoleId) {
          console.log(`  ✗ Error for ${user.email}: Unknown role enum '${user.role}'`);
          errorCount++;
          continue;
        }

        // Update the user
        await prisma.user.update({
          where: { id: user.id },
          data: { roleId: targetRoleId }
        });

        console.log(`  ✓ Migrated ${user.email}: ${user.role} → ${targetRoleId}`);
        migratedCount++;
      } catch (error) {
        console.error(`  ✗ Error migrating ${user.email}:`, error.message);
        errorCount++;
      }
    }

    // Step 5: Log migration progress and summary
    console.log("\n=== Migration Summary ===");
    console.log(`Total users: ${users.length}`);
    console.log(`Migrated: ${migratedCount}`);
    console.log(`Skipped (already migrated): ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);

    if (errorCount > 0) {
      console.log("\n⚠ Migration completed with errors. Please review the logs above.");
      process.exit(1);
    } else {
      console.log("\n✓ Migration completed successfully!");
    }

  } catch (error) {
    console.error("\n✗ Migration failed:", error.message);
    process.exit(1);
  }
}

// Main execution
migrateUserRoles()
  .catch((error) => {
    console.error("\n✗ Unexpected error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
