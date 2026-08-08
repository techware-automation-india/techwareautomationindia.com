import { Router } from "express";
import { z } from "zod";
import nodemailer from "nodemailer";
import multer from "multer";

const router = Router();

// Multer Config
const storage = multer.memoryStorage();


const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png"];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Only JPG and PNG files are allowed."));
    }

    cb(null, true);
  },
});

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const getEmailConfig = () => {
  const user = process.env.EMAIL_USER?.trim();
  const pass = process.env.EMAIL_PASS?.replace(/\s+/g, "");
  const to = process.env.EMAIL_TO?.trim() || user;

  if (!user || !pass) {
    throw new Error("Email credentials are not configured.");
  }

  return { user, pass, to };
};

const uploadPhoto = (req, res, next) => {
  upload.single("photo")(req, res, (err) => {
    if (!err) return next();

    const message =
      err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
        ? "Photo must be 5 MB or smaller."
        : err.message || "Invalid photo upload.";

    return res.status(400).json({
      success: false,
      message,
    });
  });
};

// Validation
const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, {
      message: "Name must be at least 3 characters.",
    })
    .max(50, {
      message: "Name must not exceed 50 characters.",
    })
    .regex(/^[A-Za-z]+(?:\s[A-Za-z]+)*$/, {
      message: "Please enter a valid name using letters only.",
    }),

  email: z
    .string()
    .trim()
    .email("Please enter a valid email address.")
    .refine((email) => {
      const domain = email.split("@")[1]?.toLowerCase();

      if (!domain) return false;

      const allowedExtensions = [
        ".com",
        ".in",
        ".co.in",
        ".co.uk",
        ".io",
        ".ai",
        ".tech",
        ".dev",
        ".app",
        ".store",
      ];

      return allowedExtensions.some((ext) => domain.endsWith(ext));
    }, {
      message:
        "Please use a valid email ",
    }),

  phone: z
    .string()
    .trim()
    .regex(/^(?:\+91[\s-]?)?[6-9]\d{9}$/, {
      message:
        "Please enter a valid  mobile number.",
    }),

  company: z
    .string()
    .trim()
    .min(3, {
      message: "Please enter a valid company name.",
    })
    .max(100, {
      message: "Please enter a valid company name.",
    })
    .regex(/^[A-Za-z0-9][A-Za-z0-9&.,'()\-\/\s]*$/, {
      message: "Please enter a valid company name.",
    }),

  message: z
    .string()
    .trim()
    .min(10)
    .max(1000),
});

router.post(
  "/",
  uploadPhoto,
  async (req, res) => {
    try {
      const parsed = contactSchema.safeParse(req.body);


      if (!parsed.success) {
        const errors = parsed.error.flatten().fieldErrors;

        return res.status(400).json({
          success: false,
          message: Object.values(errors).flat()[0],
          errors,
        });
      }

      const {
        name,
        email,
        phone,
        company,
        message,
      } = parsed.data;

      const emailConfig = getEmailConfig();

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: emailConfig.user,
          pass: emailConfig.pass,
        },
      });

      const attachments = [];

      if (req.file) {
        attachments.push({
          filename: req.file.originalname,
          content: req.file.buffer,
          contentType: req.file.mimetype,
        });
      }

      const info = await transporter.sendMail({
        from: `"Techware Website" <${emailConfig.user}>`,
        to: emailConfig.to,
        replyTo: email,
        subject: `New Website Inquiry - ${name}`,
        text: [
          "New Contact Form Submission",
          `Name: ${name}`,
          `Email: ${email}`,
          `Mobile: ${phone}`,
          `Company: ${company}`,
          `Message: ${message}`,
        ].join("\n"),
        html: `
      <h2>New Contact Form Submission</h2>

      <p><b>Name:</b> ${escapeHtml(name)}</p>
      <p><b>Email:</b> ${escapeHtml(email)}</p>
      <p><b>Mobile:</b> ${escapeHtml(phone)}</p>
      <p><b>Company:</b> ${escapeHtml(company)}</p>
      <p><b>Message:</b> ${escapeHtml(message).replace(/\n/g, "<br>")}</p>
    `,
        attachments,
      });

      console.log("Mail Sent:", info.messageId);

      return res.status(200).json({
        success: true,
        message: "Message sent successfully",
      });
    } catch (err) {
      console.error("Contact Form Error:", err.message);
      console.error("Error code:", err.code);
      console.error("Error stack:", err.stack);

      const isConfigError = err.message === "Email credentials are not configured.";

      return res.status(isConfigError ? 503 : 500).json({
        success: false,
        message: isConfigError
          ? "Email service is not configured"
          : "Failed to send message",
        ...(process.env.NODE_ENV !== "production" && { error: err.message }),
      });
    }


  }
);

export default router;
