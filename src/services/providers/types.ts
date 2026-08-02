/**
 * Provider contracts for every external capability the pipeline needs.
 * Adapters are selected at runtime from environment variables, so any
 * provider can be swapped without touching application logic.
 */

export type ProviderCapability = "transcription" | "analysis" | "render" | "voice";

export interface ProviderDescriptor {
  capability: ProviderCapability;
  /** Provider id resolved from env, e.g. "deepgram". */
  id: string;
  /** Env var that selects the provider. */
  selectorEnv: string;
  /** Env vars the adapter needs to actually run. */
  requiredEnv: string[];
  configured: boolean;
}

export interface TranscriptWord {
  text: string;
  start: number;
  end: number;
  speaker?: string;
  confidence?: number;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export interface TranscriptionResult {
  provider: string;
  language: string | null;
  text: string;
  words: TranscriptWord[];
  segments: TranscriptSegment[];
  speakers: string[];
  confidence: number | null;
}

export interface TranscriptionRequest {
  audioUrl: string;
  language?: string;
  diarize?: boolean;
}

export interface TranscriptionProvider {
  id: string;
  transcribe(request: TranscriptionRequest): Promise<TranscriptionResult>;
}

export type ClipCategory =
  | "hook"
  | "curiosity_loop"
  | "open_loop"
  | "storytelling"
  | "emotional"
  | "strong_opinion"
  | "funny"
  | "educational"
  | "question"
  | "call_to_action"
  | "pattern_interrupt";

export interface AnalyzedMoment {
  title: string;
  hookText: string;
  transcriptExcerpt: string;
  startSeconds: number;
  endSeconds: number;
  category: ClipCategory;
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  scores: {
    virality: number;
    engagement: number;
    retention: number;
    emotion: number;
    curiosity: number;
  };
  predictedWatchTime: number;
  shareProbability: number;
  social: {
    tiktokCaption: string;
    instagramCaption: string;
    youtubeDescription: string;
    hashtags: string[];
    seoTitle: string;
    thumbnailTitle: string;
    hookSuggestion: string;
    pinnedComment: string;
    callToAction: string;
  };
}

export interface AnalysisRequest {
  transcript: string;
  segments?: TranscriptSegment[];
  language?: string | null;
  /** Target clip length in seconds, 0 = auto. */
  targetDuration: number;
  maxClips: number;
}

export interface AnalysisProvider {
  id: string;
  analyze(request: AnalysisRequest): Promise<AnalyzedMoment[]>;
}

export interface RenderRequest {
  sourceUrl: string;
  startSeconds: number;
  endSeconds: number;
  width: number;
  height: number;
  fps: number;
  quality: string;
  subtitles?: unknown;
  overlays?: unknown;
}

export interface RenderResult {
  provider: string;
  fileUrl: string;
  sizeBytes: number | null;
}

export interface RenderProvider {
  id: string;
  render(request: RenderRequest): Promise<RenderResult>;
}

export class ProviderNotConfiguredError extends Error {
  constructor(
    public capability: ProviderCapability,
    public providerId: string,
    public missingEnv: string[],
  ) {
    super(
      `${capability} provider "${providerId}" is not configured. Missing environment variables: ${missingEnv.join(", ")}.`,
    );
    this.name = "ProviderNotConfiguredError";
  }
}