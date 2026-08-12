import { z } from "zod";

export const importSchema = z.object({
  url: z.string().trim().url().max(2048),
  projectId: z.string().uuid().nullable().optional(),
  targetDuration: z.number().min(0).max(180).default(0),
});

export const registerUploadSchema = z.object({
  storagePath: z.string().trim().min(1).max(1024),
  title: z.string().trim().min(1).max(200),
  sizeBytes: z.number().int().nonnegative(),
  projectId: z.string().uuid().nullable().optional(),
  targetDuration: z.number().min(0).max(180).default(0),
});

export const retrySchema = z.object({
  videoId: z.string().uuid(),
  jobId: z.string().uuid().nullable().optional(),
});

export const runSchema = z.object({ videoId: z.string().uuid() });

export const audioFallbackSchema = z.object({ videoId: z.string().uuid() });

export const youtubeSchema = z.object({
  url: z.string().trim().url().max(2048),
  projectId: z.string().uuid().nullable().optional(),
  targetDuration: z.number().min(0).max(180).default(0),
  consent: z.literal(true),
  consentText: z.string().trim().min(20).max(2000),
  userAgent: z.string().trim().max(500).optional(),
  audioOnly: z.boolean().default(false),
});
