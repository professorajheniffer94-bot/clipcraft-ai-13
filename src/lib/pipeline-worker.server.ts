import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/integrations/supabase/types";
import { getAnalysisProvider, getTranscriptionProvider } from "@/services/providers/registry.server";
import type { AnalyzedMoment } from "@/services/providers/types";
import { MAX_LINK_IMPORT_BYTES, STORAGE_BUCKET } from "@/constants/app";
import { downloadResolvedMedia, resolveYoutubeMedia } from "./youtube.server";

import { momentToClipInsert, pipelineBlockedReason } from "./pipeline.server";

type Client = SupabaseClient<Database>;
type Stage = Database["public"]["Enums"]["job_type"];

const MAX_CLIPS = 5;

/** Stages executed in the user's browser (ffmpeg.wasm), not on the server. */
const CLIENT_STAGES: Stage[] = ["subtitle_render", "video_render", "export"];

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
  const pending = jobs.filter(
    (job) =>
      !CLIENT_STAGES.includes(job.type) && (job.status === "queued" || job.status === "running"),
  );
  if (pending.length === 0) return { ok: true, message: "Nothing to process" };

  const jobFor = (stage: Stage) => jobs.find((job) => job.type === stage);
  const targetDuration = Number((video.metadata as Record<string, unknown>)?.["target_duration"] ?? 0);

  await supabase.from("videos").update({ status: "processing", error: null }).eq("id", videoId);

  let activeStage: Stage | null = null;
  try {
    let downloadProvider: string | null = null;
    const download = jobFor("download");
    if (download && download.status !== "succeeded") {
      activeStage = "download";
      await setJob(supabase, download.id, {
        status: "running",
        progress: 10,
        started_at: download.started_at ?? new Date().toISOString(),
        attempts: download.attempts + 1,
        error: null,
      });

      if (video.source === "youtube" && !video.storage_path) {
        const metadata = video.metadata as Record<string, unknown>;
        const youtubeId = String(metadata["youtube_id"] ?? "");
        if (!youtubeId) throw new Error("YouTube import is missing its video identifier");
        const requested = metadata["requested_media_kind"] === "audio" ? "audio" : "video";
        const resolution = await resolveYoutubeMedia(youtubeId, requested);
        downloadProvider = resolution.provider;
        const { media } = resolution;
        await setJob(supabase, download.id, { progress: 30, provider: downloadProvider });
        await setJob(supabase, download.id, { progress: 55, provider: downloadProvider });
        const file = await downloadResolvedMedia(media, MAX_LINK_IMPORT_BYTES);
        const extension = media.kind === "audio" ? "mp3" : "mp4";
        const storagePath = `${userId}/youtube/${Date.now()}-${youtubeId}.${extension}`;
        await setJob(supabase, download.id, { progress: 80 });
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, file.bytes, { contentType: file.contentType, upsert: true });
        if (uploadError) throw new Error(uploadError.message);
        const { error: updateVideoError } = await supabase
          .from("videos")
          .update({
            storage_path: storagePath,
            size_bytes: file.bytes.byteLength,
            metadata: { ...metadata, media_kind: media.kind },
          })
          .eq("id", videoId)
          .eq("user_id", userId);
        if (updateVideoError) throw new Error(updateVideoError.message);
        video.storage_path = storagePath;
        video.size_bytes = file.bytes.byteLength;
        video.metadata = { ...metadata, media_kind: media.kind };
      }

      await setJob(supabase, download.id, {
        status: "succeeded",
        progress: 100,
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        provider: downloadProvider ?? (video.source === "youtube" ? "cobalt" : "direct"),
        result: {
          source: video.storage_path ? "storage" : "url",
          media_kind: String(
            (video.metadata as Record<string, unknown>)["media_kind"] ?? "video",
          ),
        },
      });
    }

    const mediaUrl = await resolveMediaUrl(supabase, video);

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
      activeStage = "transcription";
      await setJob(supabase, transcriptionJob.id, {
        status: "running",
        progress: 10,
        started_at: new Date().toISOString(),
        attempts: transcriptionJob.attempts + 1,
      });
      const provider = getTranscriptionProvider();
      const result = await provider.transcribe({
        audioUrl: mediaUrl,
        ...(video.language ? { language: video.language } : {}),
      });
      transcriptText = result.text;
      language = result.language;
      const { error } = await supabase.from("transcriptions").insert({
        user_id: userId,
        video_id: videoId,
        provider: result.provider,
        language: result.language,
        text: result.text,
        segments: result.segments as unknown as Json,
        words: result.words as unknown as Json,
        speakers: result.speakers as unknown as Json,
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
    if (analysisJob?.status === "succeeded") {
      const saved = analysisJob.result as { moments?: AnalyzedMoment[] } | null;
      moments = Array.isArray(saved?.moments) ? saved.moments : [];
    } else if (analysisJob) {
      activeStage = "ai_analysis";
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
        result: { moments } as unknown as Json,
        finished_at: new Date().toISOString(),
      });
    }

    // 3. Persist the clips (vertical 9:16 by default).
    const clipJob = jobFor("clip_generation");
    if (clipJob && clipJob.status !== "succeeded" && moments.length > 0) {
      activeStage = "clip_generation";
      await setJob(supabase, clipJob.id, {
        status: "running",
        progress: 40,
        started_at: new Date().toISOString(),
        attempts: clipJob.attempts + 1,
      });
      const { error } = await supabase
        .from("clips")
        .insert(moments.map((moment) => momentToClipInsert(moment, videoId, userId)) as never);
      if (error) throw new Error(error.message);
      await setJob(supabase, clipJob.id, {
        status: "succeeded",
        progress: 100,
        finished_at: new Date().toISOString(),
        result: { clips: moments.length },
      });
    }

    // 4. Browser stages remain queued until an actual export is stored.
    for (const stage of CLIENT_STAGES) {
      const job = jobFor(stage);
      if (job && job.status !== "succeeded" && job.status !== "queued") {
        await setJob(supabase, job.id, { status: "queued", progress: 0, error: null });
      }
    }

    await supabase.from("videos").update({ status: "ready", error: null }).eq("id", videoId);
    await supabase.from("usage").insert({
      user_id: userId,
      video_id: videoId,
      event_type: "pipeline_completed",
      credits_used: Math.max(1, moments.length),
      metadata: { clips: moments.length } as unknown as Json,
    });

    return { ok: true, clips: moments.length, message: `${moments.length} clip(s) ready` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pipeline failed";
    const { data: fresh } = await supabase
      .from("processing_jobs")
      .select("id, status")
      .eq("video_id", videoId)
      .eq("user_id", userId)
      .eq("status", "running");
    for (const job of fresh ?? []) {
      if (activeStage && job.id !== jobFor(activeStage)?.id) continue;
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
