import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding support info...');

  // Delete existing support info
  await prisma.supportInfo.deleteMany();

  // Create support info
  const supportInfo = await prisma.supportInfo.create({
    data: {
      companyName: 'Techware Automation India',
      supportEmail: 'support@techwareautomation.com',
      supportPhone: '+91 9876543210',
      liveChatEnabled: true,
      liveChatUrl: 'https://techwareautomation.com/chat',
      supportHours: JSON.stringify({
        monday: { open: '09:00 AM', close: '06:00 PM', isOpen: true },
        tuesday: { open: '09:00 AM', close: '06:00 PM', isOpen: true },
        wednesday: { open: '09:00 AM', close: '06:00 PM', isOpen: true },
        thursday: { open: '09:00 AM', close: '06:00 PM', isOpen: true },
        friday: { open: '09:00 AM', close: '06:00 PM', isOpen: true },
        saturday: { open: '10:00 AM', close: '04:00 PM', isOpen: true },
        sunday: { open: '', close: '', isOpen: false }
      }),
      faqs: JSON.stringify([
        {
          question: 'How do I track my project progress?',
          answer: 'Go to the Projects page to view real-time progress updates, milestones, and task completion status. You can also see project timelines and team members assigned.'
        },
        {
          question: 'How do I submit a service request?',
          answer: 'Navigate to the Requests page and click the "New Request" button. Fill out the request form with your requirements, and our team will respond within 24 hours.'
        },
        {
          question: 'Where can I find my project documents?',
          answer: 'All your project documents are available in the Documents section. You can view, filter by type, and access all files shared by your project team.'
        },
        {
          question: 'How do I update my profile information?',
          answer: 'Click on your profile icon in the top right, select "Profile" from the menu, and you can edit your personal information, company details, and contact information.'
        },
        {
          question: 'What are your support hours?',
          answer: 'Our support team is available Monday to Friday from 9:00 AM to 6:00 PM, and Saturday from 10:00 AM to 4:00 PM. We are closed on Sundays and public holidays.'
        },
        {
          question: 'How quickly will I receive a response to my inquiry?',
          answer: 'We typically respond to email inquiries within 24 hours during business days. For urgent matters, please call our support phone line or use live chat for immediate assistance.'
        }
      ]),
      isActive: true
    }
  });

  console.log('✅ Support info seeded successfully:', supportInfo);
  console.log('   Company:', supportInfo.companyName);
  console.log('   Email:', supportInfo.supportEmail);
  console.log('   Phone:', supportInfo.supportPhone);
  console.log('   FAQs:', JSON.parse(supportInfo.faqs).length, 'questions');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding support info:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
