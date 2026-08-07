import type { PlanTier } from "@/types/domain";

export const APP_NAME = "ClipMind AI";
export const APP_TAGLINE = "Turn long videos into short-form that actually gets watched.";

export const CLIP_DURATIONS = [
  { value: 15, label: "15s" },
  { value: 30, label: "30s" },
  { value: 45, label: "45s" },
  { value: 60, label: "60s" },
  { value: 90, label: "90s" },
  { value: 0, label: "Auto" },
] as const;

export const EXPORT_PRESETS = [
  { label: "1080 x 1920 - 30fps", width: 1080, height: 1920, fps: 30, quality: "high" },
  { label: "1080 x 1920 - 60fps", width: 1080, height: 1920, fps: 60, quality: "high" },
  { label: "720 x 1280 - 30fps", width: 720, height: 1280, fps: 30, quality: "standard" },
] as const;

export const SUBTITLE_ANIMATIONS = ["pop", "karaoke", "typewriter", "fade", "bounce"] as const;

export const JOB_PIPELINE = [
  "download",
  "transcription",
  "ai_analysis",
  "clip_generation",
  "subtitle_render",
  "video_render",
  "export",
] as const;

export const JOB_LABELS: Record<string, string> = {
  download: "Download",
  transcription: "Transcription",
  ai_analysis: "AI analysis",
  clip_generation: "Clip generation",
  subtitle_render: "Subtitle rendering",
  video_render: "Video rendering",
  export: "Export",
};

export interface PlanDefinition {
  tier: PlanTier;
  name: string;
  price: string;
  cadence: string;
  description: string;
  features: string[];
  highlighted?: boolean;
}

export const PLANS: PlanDefinition[] = [
  {
    tier: "free",
    name: "Free",
    price: "$0",
    cadence: "forever",
    description: "Test the pipeline on a couple of videos.",
    features: ["60 credits / month", "2 GB storage", "720p exports", "Watermark"],
  },
  {
    tier: "pro",
    name: "Pro",
    price: "$29",
    cadence: "per month",
    description: "For creators publishing every day.",
    features: [
      "1,500 credits / month",
      "100 GB storage",
      "1080p 60fps exports",
      "Animated subtitles + brand kit",
      "No watermark",
    ],
    highlighted: true,
  },
  {
    tier: "business",
    name: "Business",
    price: "$99",
    cadence: "per month",
    description: "For teams and agencies running client accounts.",
    features: ["6,000 credits / month", "1 TB storage", "Priority render queue", "API access", "5 seats"],
  },
  {
    tier: "enterprise",
    name: "Enterprise",
    price: "Custom",
    cadence: "annual",
    description: "Dedicated infrastructure and white label.",
    features: ["Unlimited credits", "Dedicated workers", "White label", "SSO", "SLA + support"],
  },
];

export const STORAGE_BUCKET = "videos";

/** Free-plan upload ceiling (500MB). */
export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

/** Link imports are downloaded server-side, so they use a tighter ceiling (300MB). */
export const MAX_LINK_IMPORT_BYTES = 300 * 1024 * 1024;

/** Copyright declaration the user must accept before importing a YouTube link. */
export const COPYRIGHT_CONSENT_TEXT =
  "Declaro que possuo os direitos autorais sobre este vídeo ou tenho autorização do titular dos direitos para utilizá-lo e processá-lo nesta plataforma. Sou o único responsável por qualquer uso indevido de conteúdo de terceiros.";