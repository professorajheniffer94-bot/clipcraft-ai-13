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
    const { PIPELINE_STAGES, isPipelineReady, pipelineBlockedReason } = await import(
      "./pipeline.server"
    );
    const { mediaUrlProblem } = await import("./media-url");
    const problem = mediaUrlProblem(data.url);
    if (problem) throw new Error(problem);

    // Probe the URL before queueing anything, so bad links fail fast.
    const { probeMediaUrl } = await import("./media-probe.server");
    const { MAX_UPLOAD_BYTES } = await import("@/constants/app");
    const probe = await probeMediaUrl(data.url, MAX_UPLOAD_BYTES);
    if (!probe.ok) throw new Error(probe.reason ?? "This link is not a usable media file.");

    const { supabase, userId } = context;
    const blocked = pipelineBlockedReason();

    const { data: video, error } = await supabase
      .from("videos")
      .insert({
        user_id: userId,
        project_id: data.projectId ?? null,
        source: "url",
        source_url: data.url,
        status: blocked ? "failed" : "pending",
        error: blocked,
        size_bytes: probe.sizeBytes ?? null,
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
      status: blocked ? ("failed" as const) : ("queued" as const),
      error: blocked,
      finished_at: blocked ? new Date().toISOString() : null,
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
    const { PIPELINE_STAGES, isPipelineReady, pipelineBlockedReason } = await import(
      "./pipeline.server"
    );
    const { supabase, userId } = context;
    const blocked = pipelineBlockedReason();

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
        status: blocked ? "failed" : "pending",
        error: blocked,
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
        status: blocked ? ("failed" as const) : ("queued" as const),
        error: blocked,
        finished_at: blocked ? new Date().toISOString() : null,
        payload: { target_duration: data.targetDuration },
      })),
    );
    if (jobError) throw new Error(jobError.message);

    return { video, ready: isPipelineReady() };
  });

const retrySchema = z.object({
  videoId: z.string().uuid(),
  jobId: z.string().uuid().nullable().optional(),
});

/**
 * Re-queues failed, cancelled or stalled jobs for a video so the pipeline
 * never stays stuck. Passing a jobId retries only that stage.
 */
export const retryVideoPipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => retrySchema.parse(data))
  .handler(async ({ data, context }) => {
    const { STALLED_JOB_MS, pipelineBlockedReason } = await import("./pipeline.server");
    const { supabase, userId } = context;
    const blocked = pipelineBlockedReason();
    if (blocked) return { retried: 0, message: blocked };

    const { data: jobs, error: readError } = await supabase
      .from("processing_jobs")
      .select("id, status, started_at, attempts")
      .eq("video_id", data.videoId)
      .eq("user_id", userId);
    if (readError) throw new Error(readError.message);

    const stalledBefore = Date.now() - STALLED_JOB_MS;
    const retryable = (jobs ?? []).filter((job) => {
      if (data.jobId && job.id !== data.jobId) return false;
      if (job.status === "failed" || job.status === "cancelled") return true;
      if (job.status === "running") {
        const started = job.started_at ? new Date(job.started_at).getTime() : 0;
        return started < stalledBefore;
      }
      return false;
    });

    if (retryable.length === 0) {
      return { retried: 0, message: "No stuck stages to retry." };
    }

    const { error: updateError } = await supabase
      .from("processing_jobs")
      .update({
        status: "queued",
        error: null,
        progress: 0,
        started_at: null,
        finished_at: null,
      })
      .in(
        "id",
        retryable.map((job) => job.id),
      );
    if (updateError) throw new Error(updateError.message);

    const { error: videoError } = await supabase
      .from("videos")
      .update({ status: "pending" })
      .eq("id", data.videoId)
      .eq("user_id", userId);
    if (videoError) throw new Error(videoError.message);

    return { retried: retryable.length, message: `${retryable.length} stage(s) re-queued.` };
  });

const runSchema = z.object({ videoId: z.string().uuid() });

/**
 * Executes the queued stages for a video (transcription -> AI analysis ->
 * clips). Called by the UI right after import and by the "retry" action.
 */
export const processVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => runSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { runVideoPipeline } = await import("./pipeline-worker.server");
    return runVideoPipeline(context.supabase, context.userId, data.videoId);
  });