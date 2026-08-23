import express from "express";
import prisma from "../prismaClient.js";

const router = express.Router();

// GET /api/support - Get support information (public, no auth required)
router.get("/", async (req, res) => {
  try {
    // Get the active support info
    const supportInfo = await prisma.supportInfo.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" }
    });

    if (!supportInfo) {
      // Return default support info if none exists
      return res.json({
        companyName: "Techware Automation India",
        supportEmail: "support@techwareautomation.com",
        supportPhone: "+91 9876543210",
        liveChatEnabled: false,
        liveChatUrl: null,
        supportHours: {
          monday: { open: "09:00 AM", close: "06:00 PM", isOpen: true },
          tuesday: { open: "09:00 AM", close: "06:00 PM", isOpen: true },
          wednesday: { open: "09:00 AM", close: "06:00 PM", isOpen: true },
          thursday: { open: "09:00 AM", close: "06:00 PM", isOpen: true },
          friday: { open: "09:00 AM", close: "06:00 PM", isOpen: true },
          saturday: { open: "10:00 AM", close: "04:00 PM", isOpen: true },
          sunday: { open: "", close: "", isOpen: false }
        },
        faqs: [
          {
            question: "How do I track my project progress?",
            answer: "Go to the Projects page to view real-time progress updates and milestones."
          },
          {
            question: "How do I submit a service request?",
            answer: "Navigate to the Requests page and click 'New Request' to submit your inquiry."
          },
          {
            question: "Where can I find my project documents?",
            answer: "All your project documents are available in the Documents section."
          }
        ]
      });
    }

    // Parse JSON fields and return
    res.json({
      id: supportInfo.id,
      companyName: supportInfo.companyName,
      supportEmail: supportInfo.supportEmail,
      supportPhone: supportInfo.supportPhone,
      liveChatEnabled: supportInfo.liveChatEnabled,
      liveChatUrl: supportInfo.liveChatUrl,
      supportHours: JSON.parse(supportInfo.supportHours),
      faqs: JSON.parse(supportInfo.faqs)
    });
  } catch (err) {
    console.error("Get support info error:", err);
    res.status(500).json({ message: "Failed to load support information." });
  }
});

// POST /api/support (Admin only) - Create or update support info
router.post("/", async (req, res) => {
  try {
    const {
      companyName,
      supportEmail,
      supportPhone,
      liveChatEnabled,
      liveChatUrl,
      supportHours,
      faqs
    } = req.body;

    // Deactivate all existing support info
    await prisma.supportInfo.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    });

    // Create new support info
    const supportInfo = await prisma.supportInfo.create({
      data: {
        companyName,
        supportEmail,
        supportPhone,
        liveChatEnabled: liveChatEnabled || false,
        liveChatUrl: liveChatUrl || null,
        supportHours: JSON.stringify(supportHours),
        faqs: JSON.stringify(faqs),
        isActive: true
      }
    });

    res.json({
      message: "Support information updated successfully.",
      supportInfo: {
        id: supportInfo.id,
        companyName: supportInfo.companyName,
        supportEmail: supportInfo.supportEmail,
        supportPhone: supportInfo.supportPhone,
        liveChatEnabled: supportInfo.liveChatEnabled,
        liveChatUrl: supportInfo.liveChatUrl,
        supportHours: JSON.parse(supportInfo.supportHours),
        faqs: JSON.parse(supportInfo.faqs)
      }
    });
  } catch (err) {
    console.error("Update support info error:", err);
    res.status(500).json({ message: "Failed to update support information." });
  }
});

export default router;
