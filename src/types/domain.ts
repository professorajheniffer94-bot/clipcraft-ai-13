import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;
export type Project = Tables<"projects">;
export type Video = Tables<"videos">;
export type Transcription = Tables<"transcriptions">;
export type Clip = Tables<"clips">;
export type Export = Tables<"exports">;
export type ProcessingJob = Tables<"processing_jobs">;
export type Subscription = Tables<"subscriptions">;
export type UsageEvent = Tables<"usage">;
export type ApiKey = Tables<"api_keys">;
export type BrandKit = Tables<"brand_kits">;

export type VideoSource = Video["source"];
export type JobType = ProcessingJob["type"];
export type JobStatus = ProcessingJob["status"];
export type PlanTier = Profile["plan"];

/** Copy generated for each social destination. */
export interface SocialCopy {
  tiktokCaption?: string;
  instagramCaption?: string;
  youtubeDescription?: string;
  hashtags?: string[];
  seoTitle?: string;
  thumbnailTitle?: string;
  hookSuggestion?: string;
  pinnedComment?: string;
  callToAction?: string;
}

export interface SubtitleStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  highlightColor: string;
  strokeColor: string;
  strokeWidth: number;
  background: string;
  shadow: boolean;
  emojis: boolean;
  animation: "pop" | "karaoke" | "typewriter" | "fade" | "bounce";
  position: "top" | "center" | "bottom";
}

export interface DashboardSnapshot {
  projects: number;
  videosProcessed: number;
  creditsRemaining: number;
  storageUsedBytes: number;
  storageLimitBytes: number;
  clipsGenerated: number;
  queue: ProcessingJob[];
  latestClips: Clip[];
  activity: UsageEvent[];
  weeklyClips: { day: string; clips: number }[];
}