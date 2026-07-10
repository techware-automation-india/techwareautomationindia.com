import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "../prismaClient.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { sendCustomerWelcomeEmail, sendPasswordResetEmail } from "../utils/emailService.js";

const router = Router();

// All routes here require an authenticated ADMIN.
router.use(requireAuth, requireRole("ADMIN"));

const createCustomerSchema = z.object({
  fullName: z
    .string()
    .min(3, "Full name must be at least 3 characters.")
    .max(120, "Full name must not exceed 120 characters.")
    .regex(/^[A-Za-z\s]+$/, "Full name can only contain letters and spaces."),
  email: z
    .string()
    .email("Please provide a valid email address.")
    .toLowerCase()
    .max(255, "Email must not exceed 255 characters."),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters.")
    .max(128, "Password must not exceed 128 characters.")
    .refine(
      (pwd) => {
        const hasUpper = /[A-Z]/.test(pwd);
        const hasLower = /[a-z]/.test(pwd);
        const hasNumber = /[0-9]/.test(pwd);
        const count = [hasUpper, hasLower, hasNumber].filter(Boolean).length;
        return count >= 2;
      },
      "Password must contain at least 2 of: uppercase letter, lowercase letter, number."
    ),
  companyName: z
    .string()
    .min(2, "Company name must be at least 2 characters if provided.")
    .max(200, "Company name must not exceed 200 characters.")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .regex(/^[+]?[\d\s()\-]{7,20}$/, "Phone number must be valid (7-20 digits).")
    .optional()
    .or(z.literal("")),
  address: z.string().max(300, "Address must not exceed 300 characters.").optional().or(z.literal("")),
  city: z.string().max(100, "City must not exceed 100 characters.").optional().or(z.literal("")),
  country: z.string().max(100, "Country must not exceed 100 characters.").optional().or(z.literal("")),
});

// GET /api/customers - list all customers with their profile.
router.get("/", async (_req, res) => {
  console.log("📥 [GET /api/customers] Request received");
  try {
    const customers = await prisma.user.findMany({
      where: { role: "CUSTOMER" },
      include: { customerProfile: true },
      orderBy: { createdAt: "desc" },
    });

    console.log(`✅ [GET /api/customers] Found ${customers.length} customers`);

    const result = customers.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      isActive: u.isActive,
      companyName: u.customerProfile?.companyName ?? null,
      phone: u.customerProfile?.phone ?? null,
      address: u.customerProfile?.address ?? null,
      city: u.customerProfile?.city ?? null,
      country: u.customerProfile?.country ?? null,
      createdAt: u.createdAt,
    }));

    console.log("📤 [GET /api/customers] Sending response");
    res.json({ customers: result });
  } catch (err) {
    console.error("❌ [GET /api/customers] Error:", err);
    res.status(500).json({ message: "Failed to load customers." });
  }
});

// POST /api/customers - create a customer account + profile.
router.post("/", async (req, res) => {
  console.log("📥 [POST /api/customers] Request received:", JSON.stringify(req.body, null, 2));
  
  const parsed = createCustomerSchema.safeParse(req.body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    console.log("❌ [POST /api/customers] Validation failed:", firstError.message);
    return res.status(400).json({ 
      message: firstError.message,
      field: firstError.path[0],
      errors: parsed.error.issues.map(issue => ({
        field: issue.path[0],
        message: issue.message
      }))
    });
  }

  const { fullName, email, password, companyName, phone, address, city, country } = parsed.data;
  console.log(`✅ [POST /api/customers] Validation passed. Creating customer: ${fullName} (${companyName || 'No Company'})`);

  try {
    // Guard against duplicate email.
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      console.log(`❌ [POST /api/customers] Email already exists: ${email}`);
      return res.status(409).json({ 
        message: "An account with this email already exists.",
        field: "email"
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Create user + customer profile together.
    const user = await prisma.user.create({
      data: {
        email,
        fullName,
        passwordHash,
        role: "CUSTOMER",
        customerProfile: {
          create: {
            companyName: companyName || null,
            phone: phone || null,
            address: address || null,
            city: city || null,
            country: country || null,
          },
        },
      },
      include: { customerProfile: true },
    });

    console.log(`✅ [POST /api/customers] Customer created successfully:`, {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      companyName: user.customerProfile.companyName,
    });

    // Send welcome email with login credentials
    try {
      console.log(`📧 [POST /api/customers] Sending welcome email to: ${email}`);
      await sendCustomerWelcomeEmail({
        customerEmail: email,
        customerName: fullName,
        companyName: companyName || null,
        password: password, // Send plain text password in email
      });
      console.log(`✅ [POST /api/customers] Welcome email sent successfully to: ${email}`);
    } catch (emailError) {
      console.error(`⚠️ [POST /api/customers] Failed to send welcome email to ${email}:`, emailError);
      // Don't fail the customer creation if email fails
      // Customer is created, but email wasn't sent
    }

    res.status(201).json({
      customer: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        companyName: user.customerProfile.companyName,
        phone: user.customerProfile.phone,
        address: user.customerProfile.address,
        city: user.customerProfile.city,
        country: user.customerProfile.country,
      },
    });
  } catch (err) {
    console.error("❌ [POST /api/customers] Error:", err);
    res.status(500).json({ message: "Failed to create customer. Please try again." });
  }
});

// PUT /api/customers/:id - update customer profile.
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  console.log(`📥 [PUT /api/customers/${id}] Request received:`, JSON.stringify(req.body, null, 2));

  const updateSchema = z.object({
    fullName: z.string().min(3).max(120).optional(),
    companyName: z.string().max(200).optional(),
    phone: z.string().regex(/^[+]?[\d\s()\-]{7,20}$/).optional(),
    address: z.string().max(300).optional(),
    city: z.string().max(100).optional(),
    country: z.string().max(100).optional(),
    isActive: z.boolean().optional(),
  });

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    console.log(`❌ [PUT /api/customers/${id}] Validation failed:`, parsed.error.issues[0].message);
    return res.status(400).json({ message: parsed.error.issues[0].message });
  }

  try {
    const user = await prisma.user.findUnique({ 
      where: { id },
      include: { customerProfile: true }
    });

    if (!user || user.role !== "CUSTOMER") {
      console.log(`❌ [PUT /api/customers/${id}] Customer not found`);
      return res.status(404).json({ message: "Customer not found." });
    }

    const { fullName, isActive, ...profileData } = parsed.data;

    // Update user and profile
    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(fullName && { fullName }),
        ...(isActive !== undefined && { isActive }),
        customerProfile: {
          update: profileData,
        },
      },
      include: { customerProfile: true },
    });

    console.log(`✅ [PUT /api/customers/${id}] Customer updated successfully`);
    res.json({
      customer: {
        id: updated.id,
        fullName: updated.fullName,
        email: updated.email,
        isActive: updated.isActive,
        companyName: updated.customerProfile.companyName,
        phone: updated.customerProfile.phone,
        address: updated.customerProfile.address,
        city: updated.customerProfile.city,
        country: updated.customerProfile.country,
      },
    });
  } catch (err) {
    console.error(`❌ [PUT /api/customers/${id}] Error:`, err);
    res.status(500).json({ message: "Failed to update customer." });
  }
});

// DELETE /api/customers/:id - remove a customer account.
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  console.log(`📥 [DELETE /api/customers/${id}] Request received`);
  
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.role !== "CUSTOMER") {
      console.log(`❌ [DELETE /api/customers/${id}] Customer not found`);
      return res.status(404).json({ message: "Customer not found." });
    }

    console.log(`🗑️ [DELETE /api/customers/${id}] Deleting customer: ${user.fullName}`);
    await prisma.user.delete({ where: { id } });
    
    console.log(`✅ [DELETE /api/customers/${id}] Customer deleted successfully`);
    res.json({ message: "Customer deleted." });
  } catch (err) {
    console.error(`❌ [DELETE /api/customers/${id}] Error:`, err);
    res.status(500).json({ message: "Failed to delete customer." });
  }
});

// POST /api/customers/:id/reset-password - reset customer password.
router.post("/:id/reset-password", async (req, res) => {
  const { id } = req.params;
  console.log(`📥 [POST /api/customers/${id}/reset-password] Request received`);

  const passwordSchema = z.object({
    password: z
      .string()
      .min(6, "Password must be at least 6 characters.")
      .max(128, "Password must not exceed 128 characters.")
      .refine(
        (pwd) => {
          const hasUpper = /[A-Z]/.test(pwd);
          const hasLower = /[a-z]/.test(pwd);
          const hasNumber = /[0-9]/.test(pwd);
          const count = [hasUpper, hasLower, hasNumber].filter(Boolean).length;
          return count >= 2;
        },
        "Password must contain at least 2 of: uppercase letter, lowercase letter, number."
      ),
  });

  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    console.log(`❌ [POST /api/customers/${id}/reset-password] Validation failed:`, firstError.message);
    return res.status(400).json({ 
      message: firstError.message,
      field: "password"
    });
  }

  const { password } = parsed.data;

  try {
    const user = await prisma.user.findUnique({ 
      where: { id },
      include: { customerProfile: true }
    });
    
    if (!user || user.role !== "CUSTOMER") {
      console.log(`❌ [POST /api/customers/${id}/reset-password] Customer not found`);
      return res.status(404).json({ message: "Customer not found." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    console.log(`✅ [POST /api/customers/${id}/reset-password] Password reset successfully for: ${user.email}`);

    // Send password reset email
    try {
      console.log(`📧 [POST /api/customers/${id}/reset-password] Sending password reset email to: ${user.email}`);
      await sendPasswordResetEmail({
        customerEmail: user.email,
        customerName: user.fullName,
        companyName: user.customerProfile?.companyName || null,
        password: password, // Send plain text password in email
      });
      console.log(`✅ [POST /api/customers/${id}/reset-password] Password reset email sent successfully to: ${user.email}`);
    } catch (emailError) {
      console.error(`⚠️ [POST /api/customers/${id}/reset-password] Failed to send password reset email to ${user.email}:`, emailError);
      // Don't fail the password reset if email fails
      // Password is reset, but email wasn't sent
    }

    res.json({ message: "Password reset successfully." });
  } catch (err) {
    console.error(`❌ [POST /api/customers/${id}/reset-password] Error:`, err);
    res.status(500).json({ message: "Failed to reset password." });
  }
});

export default router;
