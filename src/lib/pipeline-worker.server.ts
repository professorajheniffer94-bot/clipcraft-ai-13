import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { getAnalysisProvider, getTranscriptionProvider } from "@/services/providers/registry.server";
import type { AnalyzedMoment } from "@/services/providers/types";

import { momentToClipInsert, pipelineBlockedReason } from "./pipeline.server";

type Client = SupabaseClient<Database>;
type Stage = Database["public"]["Enums"]["job_type"];

const MAX_CLIPS = 5;

/** Stages executed in the user's browser (ffmpeg.wasm), not on the server. */
const CLIENT_STAGES: Stage[] = ["subtitle_render", "video_render"];

async function setJob(
  supabase: Client,
  jobId: string,
  patch: Partial<Database["public"]["Tables"]["processing_jobs"]["Update"]>,
) {
  await supabase.from("processing_jobs").update(patch).eq("id", jobId);
}

async function resolveMediaUrl(supabase: Client, video: Database["public"]["Tables"]["videos"]["Row"]) {
  if (video.storage_path) {
    const { data, error } = await supabase.storage
      .from("videos")
      .createSignedUrl(video.storage_path, 60 * 60);
    if (error || !data?.signedUrl) throw new Error(error?.message ?? "Could not sign media URL");
    return data.signedUrl;
  }
  if (video.source_url) return video.source_url;
  throw new Error("Video has no media source");
}

/**
 * Runs every queued stage for a video, one video at a time.
 * Each stage writes its own progress so the UI can follow along.
 */
export async function runVideoPipeline(supabase: Client, userId: string, videoId: string) {
  const blocked = pipelineBlockedReason();
  if (blocked) return { ok: false, message: blocked };

  const { data: video, error: videoError } = await supabase
    .from("videos")
    .select("*")
    .eq("id", videoId)
    .eq("user_id", userId)
    .single();
  if (videoError || !video) throw new Error(videoError?.message ?? "Video not found");

  const { data: jobRows, error: jobsError } = await supabase
    .from("processing_jobs")
    .select("*")
    .eq("video_id", videoId)
    .eq("user_id", userId);
  if (jobsError) throw new Error(jobsError.message);

  const jobs = jobRows ?? [];
  const pending = jobs.filter((job) => job.status === "queued" || job.status === "running");
  if (pending.length === 0) return { ok: true, message: "Nothing to process" };

  const jobFor = (stage: Stage) => jobs.find((job) => job.type === stage);
  const targetDuration = Number((video.metadata as Record<string, unknown>)?.["target_duration"] ?? 0);

  await supabase.from("videos").update({ status: "processing", error: null }).eq("id", videoId);

  try {
    const mediaUrl = await resolveMediaUrl(supabase, video);

    const download = jobFor("download");
    if (download && download.status !== "succeeded") {
      await setJob(supabase, download.id, {
        status: "succeeded",
        progress: 100,
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        result: { source: video.storage_path ? "storage" : "url" },
      });
    }

    // 1. Transcription with word-level timestamps.
    let transcriptText = "";
    let language = video.language;
    const transcriptionJob = jobFor("transcription");
    const { data: existingTranscription } = await supabase
      .from("transcriptions")
      .select("*")
      .eq("video_id", videoId)
      .maybeSingle();

    if (existingTranscription?.text) {
      transcriptText = existingTranscription.text;
      language = existingTranscription.language;
      if (transcriptionJob && transcriptionJob.status !== "succeeded") {
        await setJob(supabase, transcriptionJob.id, { status: "succeeded", progress: 100 });
      }
    } else if (transcriptionJob) {
      await setJob(supabase, transcriptionJob.id, {
        status: "running",
        progress: 10,
        started_at: new Date().toISOString(),
        attempts: transcriptionJob.attempts + 1,
      });
      const provider = getTranscriptionProvider();
      const result = await provider.transcribe({
        audioUrl: mediaUrl,
        language: video.language ?? undefined,
      });
      transcriptText = result.text;
      language = result.language;
      const { error } = await supabase.from("transcriptions").insert({
        user_id: userId,
        video_id: videoId,
        provider: result.provider,
        language: result.language,
        text: result.text,
        segments: result.segments as unknown as Database["public"]["Tables"]["transcriptions"]["Insert"]["segments"],
        words: result.words as unknown as Database["public"]["Tables"]["transcriptions"]["Insert"]["words"],
        speakers: result.speakers,
        confidence: result.confidence,
      });
      if (error) throw new Error(error.message);
      await setJob(supabase, transcriptionJob.id, {
        status: "succeeded",
        progress: 100,
        provider: result.provider,
        finished_at: new Date().toISOString(),
      });
    }

    if (!transcriptText.trim()) throw new Error("Transcription came back empty");

    // 2. AI picks the strongest moments.
    let moments: AnalyzedMoment[] = [];
    const analysisJob = jobFor("ai_analysis");
    if (analysisJob) {
      await setJob(supabase, analysisJob.id, {
        status: "running",
        progress: 20,
        started_at: new Date().toISOString(),
        attempts: analysisJob.attempts + 1,
      });
      const provider = getAnalysisProvider();
      moments = await provider.analyze({
        transcript: transcriptText,
        language,
        targetDuration,
        maxClips: MAX_CLIPS,
      });
      moments = moments.filter((m) => m && m.endSeconds > m.startSeconds).slice(0, MAX_CLIPS);
      if (moments.length === 0) throw new Error("AI found no usable moments in this transcript");
      await setJob(supabase, analysisJob.id, {
        status: "succeeded",
        progress: 100,
        provider: provider.id,
        result: { moments: moments as unknown as Record<string, unknown>[] },
        finished_at: new Date().toISOString(),
      });
    }

    // 3. Persist the clips (vertical 9:16 by default).
    const clipJob = jobFor("clip_generation");
    if (clipJob && moments.length > 0) {
      await setJob(supabase, clipJob.id, {
        status: "running",
        progress: 40,
        started_at: new Date().toISOString(),
        attempts: clipJob.attempts + 1,
      });
      const { error } = await supabase
        .from("clips")
        .insert(moments.map((moment) => momentToClipInsert(moment, videoId, userId)));
      if (error) throw new Error(error.message);
      await setJob(supabase, clipJob.id, {
        status: "succeeded",
        progress: 100,
        finished_at: new Date().toISOString(),
        result: { clips: moments.length },
      });
    }

    // 4. Cutting + animated subtitles run in the browser on demand.
    for (const stage of CLIENT_STAGES) {
      const job = jobFor(stage);
      if (job && job.status !== "succeeded") {
        await setJob(supabase, job.id, {
          status: "succeeded",
          progress: 100,
          provider: "browser",
          finished_at: new Date().toISOString(),
          result: { mode: "client", note: "Rendered in the editor with ffmpeg.wasm" },
        });
      }
    }

    await supabase.from("videos").update({ status: "ready", error: null }).eq("id", videoId);
    await supabase.from("usage").insert({
      user_id: userId,
      video_id: videoId,
      event_type: "pipeline_completed",
      credits_used: Math.max(1, moments.length),
      metadata: { clips: moments.length },
    });

    return { ok: true, clips: moments.length, message: `${moments.length} clip(s) ready` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pipeline failed";
    const { data: fresh } = await supabase
      .from("processing_jobs")
      .select("id, status")
      .eq("video_id", videoId)
      .eq("user_id", userId)
      .in("status", ["queued", "running"]);
    for (const job of fresh ?? []) {
      await setJob(supabase, job.id, {
        status: "failed",
        error: message,
        finished_at: new Date().toISOString(),
      });
    }
    await supabase.from("videos").update({ status: "failed", error: message }).eq("id", videoId);
    return { ok: false, message };
  }
}
