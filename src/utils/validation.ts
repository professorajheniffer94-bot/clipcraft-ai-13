import { z } from "zod";

export const emailSchema = z.string().trim().email("Enter a valid email").max(255);
export const passwordSchema = z.string().min(8, "Use at least 8 characters").max(72, "Password is too long");

export const signInSchema = z.object({ email: emailSchema, password: passwordSchema });
export const signUpSchema = signInSchema.extend({
  fullName: z.string().trim().min(2, "Tell us your name").max(80),
});
export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ password: passwordSchema });

export const YOUTUBE_URL =
  /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/|live\/)|youtu\.be\/)[\w-]{6,}/i;

export const importUrlSchema = z.object({
  url: z
    .string()
    .trim()
    .url("Paste a full link")
    .max(2048)
    .refine((value) => /^https:\/\//i.test(value), "Only https links are supported"),
  projectId: z.string().uuid().optional(),
});

export const projectSchema = z.object({
  name: z.string().trim().min(2, "Name your project").max(80),
  description: z.string().trim().max(500).optional(),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
export type ImportUrlInput = z.infer<typeof importUrlSchema>;