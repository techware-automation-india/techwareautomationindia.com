import { z } from "zod";

// Shared regex constraints.
const mobileRegex = /^\d{10}$/;
const postalRegex = /^[A-Za-z0-9\s-]{3,12}$/;
const ifscRegex = /^[A-Za-z0-9-]{4,20}$/;
const accountRegex = /^\d{6,20}$/;
const currentYear = new Date().getFullYear();

const optionalString = z.string().trim().max(200).optional().or(z.literal(""));
const optionalMobile = z
  .union([
    z.literal(""),
    z.string().trim().regex(mobileRegex, "Enter a valid 10-digit mobile number."),
  ])
  .optional();

// Full onboarding payload validation. Mandatory fields use .min(1); the rest
// are optional. Format constraints are enforced where it matters.
export const onboardingSchema = z.object({
  // --- Personal (mandatory core identity) ---
  firstName: z.string().trim().min(1, "First name is required.").max(60),
  lastName: z.string().trim().min(1, "Last name is required.").max(60),
  phone: z.string().trim().regex(mobileRegex, "Enter a valid 10-digit mobile number."),
  alternatePhone: optionalMobile,
  personalEmail: z.string().trim().email("Enter a valid email.").optional().or(z.literal("")),
  dateOfBirth: z
    .string()
    .min(1, "Date of birth is required.")
    .refine((v) => {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return false;
      const age = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
      return age >= 18 && age <= 100;
    }, "Employee must be between 18 and 100 years old."),
  gender: z.enum(["Male", "Female", "Other"], { message: "Select a gender." }),
  maritalStatus: optionalString,
  nationality: z.string().trim().min(1, "Nationality is required.").max(60),
  bloodGroup: optionalString,

  // Address (mandatory core).
  addressLine1: z.string().trim().min(1, "Address line 1 is required.").max(200),
  addressLine2: optionalString,
  city: z.string().trim().min(1, "City is required.").max(80),
  state: z.string().trim().min(1, "State is required.").max(80),
  postalCode: z.string().trim().regex(postalRegex, "Enter a valid postal code."),
  country: z.string().trim().min(1, "Country is required.").max(80),

  // --- Emergency contact (mandatory) ---
  emergencyContactName: z.string().trim().min(1, "Emergency contact name is required.").max(120),
  emergencyContactRelation: z.string().trim().min(1, "Relationship is required.").max(60),
  emergencyContactPhone: z.string().trim().regex(mobileRegex, "Enter a valid 10-digit emergency contact mobile number."),

  // --- Banking (mandatory) ---
  bankName: z.string().trim().min(1, "Bank name is required.").max(120),
  bankAccountName: z.string().trim().min(1, "Account holder name is required.").max(120),
  bankAccountNumber: z.string().trim().regex(accountRegex, "Account number must be 6-20 digits."),
  bankIfscCode: z.string().trim().regex(ifscRegex, "Enter a valid IFSC/routing code."),
  bankBranch: optionalString,

  // --- Professional ---
  jobTitle: z.string().trim().min(1, "Job title is required.").max(120),
  highestQualification: z.string().trim().min(1, "Highest qualification is required.").max(120),
  university: optionalString,
  graduationYear: z
    .union([z.string(), z.number()])
    .optional()
    .refine(
      (v) => v === undefined || v === "" || (Number(v) >= 1950 && Number(v) <= currentYear),
      `Graduation year must be between 1950 and ${currentYear}.`
    ),
  totalExperienceYears: z
    .union([z.string(), z.number()])
    .optional()
    .refine(
      (v) => v === undefined || v === "" || (Number(v) >= 0 && Number(v) <= 60),
      "Experience must be between 0 and 60 years."
    ),
  previousEmployer: optionalString,
  skills: z.string().trim().max(500).optional().or(z.literal("")),

  // --- Identification / proofs ---
  nationalIdNumber: z.string().trim().min(4, "National ID number is required.").max(40),
  taxIdNumber: optionalString,
  passportNumber: optionalString,
  idProofDocument: z.string().trim().min(1, "ID proof reference is required.").max(300),
  addressProofDocument: optionalString,
  educationProofDocument: optionalString,
  resumeDocument: optionalString,
});
