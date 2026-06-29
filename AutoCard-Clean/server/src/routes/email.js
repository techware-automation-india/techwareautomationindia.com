import { Router } from "express";
import { z } from "zod";
import nodemailer from "nodemailer";
import multer from "multer";

const router = Router();

// Multer Config
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
});

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

// POST /api/contact
router.post(
  "/",
  upload.single("photo"),
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

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      const attachments = [];

      if (req.file) {
        attachments.push({
          filename: req.file.originalname,
          path: req.file.path,
        });
      }

      const info = await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,
        replyTo: email,
        subject: `New Website Inquiry - ${name}`,
        html: `
      <h2>New Contact Form Submission</h2>

      <p><b>Name:</b> ${name}</p>
      <p><b>Email:</b> ${email}</p>
      <p><b>Mobile:</b> ${phone}</p>
      <p><b>Company:</b> ${company}</p>
      <p><b>Message:</b> ${message}</p>
    `,
        attachments,
      });

      console.log("Mail Sent:", info.messageId);

      return res.status(200).json({
        success: true,
        message: "Message sent successfully",
      });
    } catch (err) {
      console.error("Contact Form Error:", err);

      return res.status(500).json({
        success: false,
        message: "Failed to send message",
      });
    }


  }
);

export default router;
