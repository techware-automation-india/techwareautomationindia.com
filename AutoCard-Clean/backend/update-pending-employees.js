import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updatePendingEmployees() {
  try {
    console.log('🔄 Updating all non-APPROVED employees to APPROVED...');
    
    const result = await prisma.employeeProfile.updateMany({
      where: {
        onboardingStatus: {
          in: ['PENDING', 'SUBMITTED', 'REJECTED']
        }
      },
      data: {
        onboardingStatus: 'APPROVED'
      }
    });
    
    console.log(`✅ Updated ${result.count} employees to APPROVED`);
    
    // Show the updated employees
    const employees = await prisma.employeeProfile.findMany({
      include: {
        user: {
          select: {
            fullName: true,
            email: true
          }
        }
      },
      orderBy: {
        employeeCode: 'asc'
      }
    });
    
    console.log('\n📋 All Employees:');
    employees.forEach(emp => {
      console.log(`  - ${emp.employeeCode}: ${emp.user.fullName} - Status: ${emp.onboardingStatus}`);
    });
    
  } catch (error) {
    console.error('❌ Error updating employees:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updatePendingEmployees();
