import { z } from "zod";

export const createEmployeeSchema = z.object({
  employeeCode: z
    .string({
      required_error: "Employee ID is required.",
    })
    .trim()
    .min(3, "Employee ID must be at least 3 characters.")
    .max(20, "Employee ID must not exceed 20 characters.")
    .regex(
      /^[A-Za-z0-9-]+$/,
      "Employee ID can contain only letters, numbers and hyphens."
    )
    .transform((code) => code.toUpperCase()),

  password: z
    .string({
      required_error: "Password is required.",
    })
    .min(8, "Password must be at least 8 characters.")
    .max(128, "Password cannot exceed 128 characters.")
    .regex(/[A-Z]/, "Password must contain one uppercase letter.")
    .regex(/[a-z]/, "Password must contain one lowercase letter.")
    .regex(/[0-9]/, "Password must contain one number.")
    .regex(
      /[!@#$%^&*(),.?":{}|<>]/,
      "Password must contain one special character."
    ),
});
