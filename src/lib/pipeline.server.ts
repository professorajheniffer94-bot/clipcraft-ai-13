import type { AnalyzedMoment, ProviderDescriptor } from "@/services/providers/types";
import { describeAllProviders } from "@/services/providers/registry.server";

export const PIPELINE_STAGES = [
  "download",
  "transcription",
  "ai_analysis",
  "clip_generation",
  "subtitle_render",
  "video_render",
] as const;

export function providerStatus(): ProviderDescriptor[] {
  return describeAllProviders();
}

export function isPipelineReady(): boolean {
  const providers = describeAllProviders();
  return ["transcription", "analysis", "render"].every(
    (capability) => providers.find((p) => p.capability === capability)?.configured,
  );
}

/** Maps an AI moment onto the clips table insert shape. */
export function momentToClipInsert(moment: AnalyzedMoment, videoId: string, userId: string) {
  return {
    video_id: videoId,
    user_id: userId,
    title: moment.title,
    hook_text: moment.hookText,
    transcript_excerpt: moment.transcriptExcerpt,
    start_seconds: moment.startSeconds,
    end_seconds: moment.endSeconds,
    duration_seconds: Math.max(0, moment.endSeconds - moment.startSeconds),
    category: moment.category,
    sentiment: moment.sentiment,
    virality_score: moment.scores.virality,
    engagement_score: moment.scores.engagement,
    retention_score: moment.scores.retention,
    emotion_score: moment.scores.emotion,
    curiosity_score: moment.scores.curiosity,
    predicted_watch_time: moment.predictedWatchTime,
    share_probability: moment.shareProbability,
    social_copy: moment.social as unknown as Record<string, unknown>,
  };
}