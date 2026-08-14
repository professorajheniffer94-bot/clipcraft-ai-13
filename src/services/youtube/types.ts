/**
 * Contracts for YouTube download providers.
 * All providers receive a public YouTube video id and return a direct media URL
 * that can be downloaded by the serverless backend.
 */

export interface ResolvedMedia {
  url: string;
  filename: string;
  kind: "video" | "audio";
}

/** URL exactly as advertised by the service, used as a download fallback. */
export interface ResolvedMediaWithFallback extends ResolvedMedia {
  fallbackUrl?: string;
}

export interface YoutubeProviderRequest {
  videoId: string;
  mode: "video" | "audio";
  signal?: AbortSignal;
}

export interface YoutubeProviderResult {
  provider: string;
  media: ResolvedMediaWithFallback;
  metadata?: {
    /** Human-readable note about the chosen mode/provider. */
    note?: string;
  };
}

export interface YoutubeProvider {
  readonly id: string;
  isAvailable(): boolean | Promise<boolean>;
  resolve(request: YoutubeProviderRequest): Promise<YoutubeProviderResult>;
}

export interface YoutubeProviderChain {
  primary: YoutubeProvider;
  fallback: YoutubeProvider;
}
