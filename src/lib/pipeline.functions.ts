import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Provider readiness for the pipeline dashboard. Safe for signed-in users. */
export const getProviderStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { providerStatus, isPipelineReady } = await import("./pipeline.server");
    return { providers: providerStatus(), ready: isPipelineReady() };
  });

const importSchema = z.object({
  url: z.string().trim().url().max(2048),
  projectId: z.string().uuid().nullable().optional(),
  targetDuration: z.number().min(0).max(180).default(0),
});

/**
 * Registers an external video and queues the full processing pipeline.
 * Jobs stay queued until provider credentials are configured.
 */
export const importVideoFromUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => importSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { PIPELINE_STAGES, isPipelineReady } = await import("./pipeline.server");
    const { supabase, userId } = context;

    const { data: video, error } = await supabase
      .from("videos")
      .insert({
        user_id: userId,
        project_id: data.projectId ?? null,
        source: "url",
        source_url: data.url,
        status: "pending",
        title: new URL(data.url).hostname.replace(/^www\./, "") + " import",
        metadata: { target_duration: data.targetDuration },
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    const jobs = PIPELINE_STAGES.map((stage) => ({
      user_id: userId,
      video_id: video.id,
      type: stage,
      status: "queued" as const,
      payload: { target_duration: data.targetDuration },
    }));
    const { error: jobError } = await supabase.from("processing_jobs").insert(jobs);
    if (jobError) throw new Error(jobError.message);

    return { video, queuedStages: PIPELINE_STAGES.length, ready: isPipelineReady() };
  });

const registerUploadSchema = z.object({
  storagePath: z.string().trim().min(1).max(1024),
  title: z.string().trim().min(1).max(200),
  sizeBytes: z.number().int().nonnegative(),
  projectId: z.string().uuid().nullable().optional(),
  targetDuration: z.number().min(0).max(180).default(0),
});

/** Registers an uploaded file (already in storage) and queues the pipeline. */
export const registerUploadedVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => registerUploadSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { PIPELINE_STAGES, isPipelineReady } = await import("./pipeline.server");
    const { supabase, userId } = context;

    if (!data.storagePath.startsWith(`${userId}/`)) {
      throw new Error("Storage path must live in your own folder");
    }

    const { data: video, error } = await supabase
      .from("videos")
      .insert({
        user_id: userId,
        project_id: data.projectId ?? null,
        source: "upload",
        storage_path: data.storagePath,
        size_bytes: data.sizeBytes,
        status: "pending",
        title: data.title,
        metadata: { target_duration: data.targetDuration },
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    const { error: jobError } = await supabase.from("processing_jobs").insert(
      PIPELINE_STAGES.filter((stage) => stage !== "download").map((stage) => ({
        user_id: userId,
        video_id: video.id,
        type: stage,
        status: "queued" as const,
        payload: { target_duration: data.targetDuration },
      })),
    );
    if (jobError) throw new Error(jobError.message);

    return { video, ready: isPipelineReady() };
  });