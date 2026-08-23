import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedServices() {
  console.log("🌱 Seeding services...");

  const services = [
    {
      name: "Web Development",
      description: "Custom website development with modern technologies and responsive design",
      features: JSON.stringify([
        "Responsive Design",
        "SEO Optimized",
        "Fast Performance",
        "Security Best Practices",
        "Content Management System",
        "Analytics Integration"
      ]),
      price: "Starting at ₹2,49,999",
      category: "Development",
      isActive: true,
      orderIndex: 1,
    },
    {
      name: "Mobile App Development",
      description: "Native and cross-platform mobile applications for iOS and Android",
      features: JSON.stringify([
        "iOS & Android Apps",
        "Cloud Integration",
        "Push Notifications",
        "Analytics & Tracking",
        "Offline Support",
        "App Store Deployment"
      ]),
      price: "Starting at ₹4,99,999",
      category: "Development",
      isActive: true,
      orderIndex: 2,
    },
    {
      name: "Cloud Solutions",
      description: "Scalable cloud infrastructure and deployment services",
      features: JSON.stringify([
        "AWS/Azure Setup",
        "Auto Scaling",
        "24/7 Monitoring",
        "Backup & Recovery",
        "Load Balancing",
        "Security Configuration"
      ]),
      price: "Starting at ₹1,99,999",
      category: "Infrastructure",
      isActive: true,
      orderIndex: 3,
    },
    {
      name: "UI/UX Design",
      description: "Beautiful and intuitive user interface and experience design",
      features: JSON.stringify([
        "User Research",
        "Wireframing",
        "Interactive Prototypes",
        "Design System",
        "Usability Testing",
        "Responsive Design"
      ]),
      price: "Starting at ₹1,49,999",
      category: "Design",
      isActive: true,
      orderIndex: 4,
    },
    {
      name: "API Development",
      description: "RESTful and GraphQL API development and integration services",
      features: JSON.stringify([
        "RESTful API Design",
        "GraphQL APIs",
        "API Documentation",
        "Authentication & Security",
        "Third-party Integration",
        "Performance Optimization"
      ]),
      price: "Starting at ₹99,999",
      category: "Development",
      isActive: true,
      orderIndex: 5,
    },
    {
      name: "DevOps Services",
      description: "Continuous integration, deployment, and infrastructure automation",
      features: JSON.stringify([
        "CI/CD Pipelines",
        "Docker & Kubernetes",
        "Infrastructure as Code",
        "Monitoring & Logging",
        "Automated Testing",
        "Security Scanning"
      ]),
      price: "Starting at ₹1,99,999",
      category: "Infrastructure",
      isActive: true,
      orderIndex: 6,
    },
  ];

  for (const service of services) {
    const existing = await prisma.service.findFirst({
      where: { name: service.name },
    });

    if (!existing) {
      await prisma.service.create({ data: service });
      console.log(`✅ Created service: ${service.name}`);
    } else {
      console.log(`⏭️  Service already exists: ${service.name}`);
    }
  }

  console.log("✨ Services seeding completed!");
}

seedServices()
  .catch((err) => {
    console.error("❌ Error seeding services:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
