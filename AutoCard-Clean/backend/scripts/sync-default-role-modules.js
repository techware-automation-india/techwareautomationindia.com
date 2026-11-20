import prisma from "../src/prismaClient.js";

const DEFAULT_CORE_MODULES = [
  "overview",
  "mark-attendance",
  "attendance",
  "requests",
  "requests-apply-leave",
  "requests-forgot-punch",
  "requests-tools-inventory",
  "requests-track",
  "academic-calendar",
  "academic-holidays",
];

async function syncDefaultModules() {
  console.log("Starting sync of default modules into role_modules table...");

  const allRoles = await prisma.roleTable.findMany({
    include: { modules: true },
  });

  for (const role of allRoles) {
    if (role.name.toUpperCase() === "CUSTOMER") continue;

    const existingKeys = new Set(role.modules.map((m) => m.moduleKey));
    const missingKeys = DEFAULT_CORE_MODULES.filter((k) => !existingKeys.has(k));

    if (missingKeys.length > 0) {
      console.log(`Adding ${missingKeys.length} default modules to role: ${role.name}`);
      await prisma.roleModule.createMany({
        data: missingKeys.map((moduleKey) => ({
          roleId: role.id,
          moduleKey,
        })),
        skipDuplicates: true,
      });
    } else {
      console.log(`Role "${role.name}" already has all default modules.`);
    }
  }

  const updatedRoles = await prisma.roleTable.findMany({
    include: { modules: true },
  });

  console.log("\n--- Verification of Roles in Database ---");
  for (const r of updatedRoles) {
    console.log(`- ${r.name} (${r.isDefault ? "Default" : "Custom"}): ${r.modules.length} modules`);
    console.log(`  Modules: ${r.modules.map((m) => m.moduleKey).join(", ")}`);
  }

  console.log("\nDefault modules sync completed successfully!");
}

syncDefaultModules()
  .catch((e) => {
    console.error("Error syncing default modules:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
