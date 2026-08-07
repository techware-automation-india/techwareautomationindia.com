import prisma from "./src/prismaClient.js";

async function main() {
  const employeeId = process.argv[2];
  const where = employeeId ? { id: employeeId, role: "EMPLOYEE" } : { role: "EMPLOYEE" };

  const employees = await prisma.user.findMany({
    where,
    include: {
      employeeProfile: true,
      modulePermissions: true,
    },
    orderBy: { fullName: "asc" },
  });

  if (employees.length === 0) {
    console.log(employeeId ? `No employee found with id=${employeeId}` : "No employees found.");
    return;
  }

  for (const emp of employees) {
    console.log("----------------------------------------");
    console.log(`Employee: ${emp.fullName} (${emp.email})`);
    console.log(`ID: ${emp.id}`);
    console.log(`Onboarding: ${emp.employeeProfile?.onboardingStatus ?? "N/A"}`);
    console.log("Permissions:");

    if (emp.modulePermissions.length === 0) {
      console.log("  No configured module permissions.");
    } else {
      for (const perm of emp.modulePermissions) {
        console.log(`  - ${perm.moduleKey}: view=${perm.canView} create=${perm.canCreate} edit=${perm.canEdit} delete=${perm.canDelete}`);
      }
    }
  }

  console.log("----------------------------------------");
}

main()
  .catch((err) => {
    console.error("Error fetching permissions:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
