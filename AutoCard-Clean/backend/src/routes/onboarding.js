import { Router } from "express";
import prisma from "../prismaClient.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { onboardingSchema } from "../validation/onboarding.js";
import { upload, uploadDocument } from "../middleware/upload.js";

const router = Router();

// Normalizes optional empty strings to null and numbers from strings.
function toNull(v) {
  return v === "" || v === undefined ? null : v;
}
function toNumberOrNull(v) {
  if (v === "" || v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

// ============================================================================
// EMPLOYEE ROUTES (require EMPLOYEE role)
// ============================================================================

// GET /api/onboarding/me - return the current employee's profile + status.
router.get("/me", requireAuth, requireRole("EMPLOYEE"), async (req, res) => {
  try {
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!profile) {
      return res.status(404).json({ message: "Employee profile not found." });
    }
    res.json({ profile });
  } catch (err) {
    console.error("Get onboarding error:", err);
    res.status(500).json({ message: "Failed to load profile." });
  }
});

// POST /api/onboarding/submit - validate + save form, set status to APPROVED automatically (AUTO-APPROVE)
router.post("/submit", requireAuth, requireRole("EMPLOYEE"), async (req, res) => {
  const parsed = onboardingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0].message });
  }

  const d = parsed.data;

  try {
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!profile) {
      return res.status(404).json({ message: "Employee profile not found." });
    }

    if (profile.onboardingStatus === "APPROVED") {
      return res.status(400).json({ message: "Your onboarding is already approved." });
    }

    const profileData = {
      // Personal.
      firstName: d.firstName,
      lastName: d.lastName,
      phone: d.phone,
      alternatePhone: toNull(d.alternatePhone),
      personalEmail: toNull(d.personalEmail),
      dateOfBirth: new Date(d.dateOfBirth),
      gender: d.gender,
      maritalStatus: toNull(d.maritalStatus),
      nationality: d.nationality,
      bloodGroup: toNull(d.bloodGroup),
      // Address.
      addressLine1: d.addressLine1,
      addressLine2: toNull(d.addressLine2),
      city: d.city,
      state: d.state,
      postalCode: d.postalCode,
      country: d.country,
      // Emergency.
      emergencyContactName: d.emergencyContactName,
      emergencyContactRelation: d.emergencyContactRelation,
      emergencyContactPhone: d.emergencyContactPhone,
      // Banking.
      bankName: d.bankName,
      bankAccountName: d.bankAccountName,
      bankAccountNumber: d.bankAccountNumber,
      bankIfscCode: d.bankIfscCode,
      bankBranch: toNull(d.bankBranch),
      // Professional.
      jobTitle: d.jobTitle,
      highestQualification: d.highestQualification,
      university: toNull(d.university),
      graduationYear: toNumberOrNull(d.graduationYear),
      totalExperienceYears: toNumberOrNull(d.totalExperienceYears),
      previousemployer: toNull(d.previousEmployer),
      skills: toNull(d.skills),
      // Identification / proofs.
      nationalIdNumber: d.nationalIdNumber,
      taxIdNumber: toNull(d.taxIdNumber),
      passportNumber: toNull(d.passportNumber),
      idProofDocument: d.idProofDocument,
      addressProofDocument: toNull(d.addressProofDocument),
      educationProofDocument: toNull(d.educationProofDocument),
      resumeDocument: toNull(d.resumeDocument),
      // Profile image.
      profileImage: toNull(req.body.profileImage),
      // Status - AUTO-APPROVE
      onboardingStatus: "APPROVED",
    };

    // Update profile and auto-approve (no request creation needed)
    const updated = await prisma.employeeProfile.update({
      where: { id: profile.id },
      data: profileData,
    });

    res.json({ 
      profile: updated,
      message: "Onboarding submitted and automatically approved!"
    });
  } catch (err) {
    console.error("Submit onboarding error:", err);
    res.status(500).json({ message: "Failed to submit onboarding." });
  }
});

// ============================================================================
// ADMIN ROUTES (require ADMIN role)
// ============================================================================

// POST /api/onboarding/upload-image - upload profile image (employee or admin)
router.post("/upload-image", requireAuth, upload.single("profileImage"), async (req, res) => {
  console.log("📥 [POST /api/onboarding/upload-image] Request received");

  try {
    if (!req.file) {
      console.log("❌ [POST /api/onboarding/upload-image] No file uploaded");
      return res.status(400).json({ message: "No image file provided." });
    }

    const targetUserId = req.query.userId || req.user.id;
    const imagePath = `/uploads/profiles/${req.file.filename}`;

    const profile = await prisma.employeeProfile.findUnique({ where: { userId: targetUserId } });
    if (profile) {
      await prisma.employeeProfile.update({
        where: { id: profile.id },
        data: { profileImage: imagePath },
      });
    }

    console.log(`✅ [POST /api/onboarding/upload-image] Image uploaded: ${imagePath} for user ${targetUserId}`);

    res.json({
      imagePath,
      message: "Image uploaded successfully."
    });
  } catch (err) {
    console.error("❌ [POST /api/onboarding/upload-image] Error:", err);
    res.status(500).json({ message: "Failed to upload image." });
  }
});

// POST /api/onboarding/upload-resume - upload resume (PDF / DOC / DOCX, employee only)
router.post(
  "/upload-resume",
  requireAuth,
  (req, res, next) => {
    uploadDocument.single("resume")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    console.log("📥 [POST /api/onboarding/upload-resume] Request received");

    if (!req.file) {
      return res.status(400).json({ message: "No resume file provided." });
    }

    const targetUserId = req.query.userId || req.user.id;
    const resumePath = `/uploads/documents/${req.file.filename}`;
    const originalName = req.file.originalname;
    const fileSize = req.file.size;

    console.log(`✅ [POST /api/onboarding/upload-resume] Resume uploaded: ${resumePath} for user ${targetUserId}`);

    try {
      const profile = await prisma.employeeProfile.findUnique({
        where: { userId: targetUserId },
      });
      if (profile) {
        await prisma.employeeProfile.update({
          where: { id: profile.id },
          data: { resumeDocument: resumePath },
        });
      }
    } catch (dbErr) {
      console.warn("⚠️  [POST /api/onboarding/upload-resume] DB update failed:", dbErr.message);
    }

    res.json({
      resumePath,
      originalName,
      fileSize,
      message: "Resume uploaded successfully.",
    });
  }
);

// POST /api/onboarding/upload-document - upload any proof document (PDF/DOC/DOCX, employee only)
// fieldName query param identifies which profile field to update:
//   "idProofDocument" | "addressProofDocument" | "educationProofDocument"
const ALLOWED_DOC_FIELDS = ["idProofDocument", "addressProofDocument", "educationProofDocument"];

router.post(
  "/upload-document",
  requireAuth,
  (req, res, next) => {
    uploadDocument.single("document")(req, res, (err) => {
      if (err) return res.status(400).json({ message: err.message });
      next();
    });
  },
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No document file provided." });
    }

    const fieldName = req.query.field;
    if (!ALLOWED_DOC_FIELDS.includes(fieldName)) {
      return res.status(400).json({
        message: `Invalid field. Must be one of: ${ALLOWED_DOC_FIELDS.join(", ")}`,
      });
    }

    const targetUserId = req.query.userId || req.user.id;
    const docPath = `/uploads/documents/${req.file.filename}`;
    const originalName = req.file.originalname;
    const fileSize = req.file.size;

    try {
      const profile = await prisma.employeeProfile.findUnique({
        where: { userId: targetUserId },
      });
      if (profile) {
        await prisma.employeeProfile.update({
          where: { id: profile.id },
          data: { [fieldName]: docPath },
        });
      }
    } catch (dbErr) {
      console.warn("⚠️  [upload-document] DB update failed:", dbErr.message);
    }

    res.json({ docPath, originalName, fileSize, fieldName, message: "Document uploaded successfully." });
  }
);

// GET /api/onboarding/employee/:userId - fetch employee onboarding data (admin only)
router.get("/employee/:userId", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const { userId } = req.params;
  console.log(`📥 [GET /api/onboarding/employee/${userId}] Request received`);
  
  try {
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId },
      include: { user: true, location: true },
    });
    
    if (!profile) {
      console.log(`❌ [GET /api/onboarding/employee/${userId}] Profile not found`);
      return res.status(404).json({ message: "Employee profile not found." });
    }
    
    console.log(`✅ [GET /api/onboarding/employee/${userId}] Profile loaded`);
    res.json({ profile });
  } catch (err) {
    console.error(`❌ [GET /api/onboarding/employee/${userId}] Error:`, err);
    res.status(500).json({ message: "Failed to load employee profile." });
  }
});

// PUT /api/onboarding/employee/:userId - update employee onboarding data (admin only)
router.put("/employee/:userId", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const { userId } = req.params;
  console.log(`📥 [PUT /api/onboarding/employee/${userId}] Request received`);
  console.log(`📝 [PUT /api/onboarding/employee/${userId}] Data:`, req.body);
  
  try {
    const profile = await prisma.employeeProfile.findUnique({
      where: { userId },
    });
    
    if (!profile) {
      console.log(`❌ [PUT /api/onboarding/employee/${userId}] Profile not found`);
      return res.status(404).json({ message: "Employee profile not found." });
    }

    // Update with the provided data
    const updateData = {
      firstName: req.body.firstName || profile.firstName,
      lastName: req.body.lastName || profile.lastName,
      phone: req.body.phone || profile.phone,
      alternatePhone: toNull(req.body.alternatePhone),
      personalEmail: toNull(req.body.personalEmail),
      dateOfBirth: req.body.dateOfBirth ? new Date(req.body.dateOfBirth) : profile.dateOfBirth,
      gender: req.body.gender || profile.gender,
      maritalStatus: toNull(req.body.maritalStatus),
      nationality: req.body.nationality || profile.nationality,
      bloodGroup: toNull(req.body.bloodGroup),
      addressLine1: req.body.addressLine1 || profile.addressLine1,
      addressLine2: toNull(req.body.addressLine2),
      city: req.body.city || profile.city,
      state: req.body.state || profile.state,
      postalCode: req.body.postalCode || profile.postalCode,
      country: req.body.country || profile.country,
      emergencyContactName: req.body.emergencyContactName || profile.emergencyContactName,
      emergencyContactRelation: req.body.emergencyContactRelation || profile.emergencyContactRelation,
      emergencyContactPhone: req.body.emergencyContactPhone || profile.emergencyContactPhone,
      bankName: req.body.bankName || profile.bankName,
      bankAccountName: req.body.bankAccountName || profile.bankAccountName,
      bankAccountNumber: req.body.bankAccountNumber || profile.bankAccountNumber,
      bankIfscCode: req.body.bankIfscCode || profile.bankIfscCode,
      bankBranch: toNull(req.body.bankBranch),
      jobTitle: req.body.jobTitle || profile.jobTitle,
      highestQualification: req.body.highestQualification || profile.highestQualification,
      university: toNull(req.body.university),
      graduationYear: toNumberOrNull(req.body.graduationYear),
      totalExperienceYears: toNumberOrNull(req.body.totalExperienceYears),
      previousemployer: toNull(req.body.previousemployer),
      skills: toNull(req.body.skills),
      nationalIdNumber: req.body.nationalIdNumber || profile.nationalIdNumber,
      taxIdNumber: toNull(req.body.taxIdNumber),
      passportNumber: toNull(req.body.passportNumber),
      idProofDocument: req.body.idProofDocument || profile.idProofDocument,
      addressProofDocument: toNull(req.body.addressProofDocument),
      educationProofDocument: toNull(req.body.educationProofDocument),
      resumeDocument: toNull(req.body.resumeDocument),
      locationId: req.body.locationId ?? profile.locationId,
    };

    const updated = await prisma.employeeProfile.update({
      where: { id: profile.id },
      data: updateData,
      include: { user: true, location: true },
    });

    console.log(`✅ [PUT /api/onboarding/employee/${userId}] Profile updated successfully`);
    res.json({ profile: updated, message: "Employee profile updated successfully." });
  } catch (err) {
    console.error(`❌ [PUT /api/onboarding/employee/${userId}] Error:`, err);
    res.status(500).json({ message: "Failed to update employee profile." });
  }
});

export default router;
