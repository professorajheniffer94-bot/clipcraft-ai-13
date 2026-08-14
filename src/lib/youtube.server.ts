import {
  cobaltProvider,
  rapidApiProvider,
  resolveYoutubeWithFallback,
  isYoutubeProviderError,
} from "@/services/youtube/adapters.server";

export interface YoutubeMeta {
  videoId: string;
  title: string;
  author: string | null;
  thumbnailUrl: string | null;
}

export interface ResolvedMedia {
  url: string;
  filename: string;
  kind: "video" | "audio";
}

/** URL exactly as advertised by the service, used as a download fallback. */
export interface ResolvedMediaWithFallback extends ResolvedMedia {
  fallbackUrl?: string;
}

export { youtubeVideoId } from "./youtube-url";

const providers = [cobaltProvider, rapidApiProvider];

/** Confirms the video exists and is publicly reachable (free, no API key). */
export async function fetchYoutubeMeta(videoId: string): Promise<YoutubeMeta> {
  const endpoint = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(
    `https://www.youtube.com/watch?v=${videoId}`,
  )}`;
  let response: Response;
  try {
    response = await fetch(endpoint);
  } catch {
    throw new Error("Could not reach YouTube to check this video. Try again in a moment.");
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error("This video is private or restricted, so it cannot be imported.");
  }
  if (response.status === 404) {
    throw new Error("This video was removed or the link is wrong.");
  }
  if (!response.ok) {
    throw new Error(`YouTube rejected the request (${response.status}). Try again later.`);
  }
  const data = (await response.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
  return {
    videoId,
    title: data.title?.trim() || `YouTube ${videoId}`,
    author: data.author_name?.trim() || null,
    thumbnailUrl: data.thumbnail_url ?? null,
  };
}

export function youtubeImportBlockedReason(): string | null {
  const available = providers.filter((p) => p.isAvailable());
  if (available.length === 0) {
    return "YouTube import is not configured yet — add COBALT_API_URL or RAPIDAPI_KEY. Use the Upload tab meanwhile.";
  }
  return null;
}

/**
 * Resolves the media, falling back to audio-only when YouTube blocks the video
 * stream for the download service (common on cloud/datacenter IPs). Audio is
 * enough for transcription + AI analysis, so the pipeline still runs.
 *
 * The fallback chain is: Cobalt video -> Cobalt audio -> RapidAPI video -> RapidAPI audio.
 */
export async function resolveYoutubeMedia(
  videoId: string,
  mode: "video" | "audio",
): Promise<ResolvedMediaWithFallback> {
  const result = await resolveYoutubeWithFallback(videoId, mode, providers);
  return result.media;
}

/** Downloads the resolved file, enforcing the plan's size ceiling. */
export async function downloadResolvedMedia(
  media: ResolvedMediaWithFallback,
  maxBytes: number,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  let response = await fetch(media.url).catch(() => null);
  // Some instances advertise a stale host; if the rewritten tunnel is rejected,
  // fall back to the URL the service returned verbatim.
  if ((!response || !response.ok) && media.fallbackUrl && media.fallbackUrl !== media.url) {
    response = (await fetch(media.fallbackUrl).catch(() => null)) ?? response;
  }
  if (!response) throw new Error("The download service did not answer the download request.");
  if (!response.ok) {
    throw new Error(
      response.status === 429
        ? "The download service is rate limited right now. Try again shortly."
        : `The download failed (${response.status}).`,
    );
  }
  const declared = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error(
      `This video is too large for your plan's link import limit (${Math.round(maxBytes / (1024 * 1024))} MB). Trim it and upload the file instead.`,
    );
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > maxBytes) {
    throw new Error(
      `This video is too large for your plan's link import limit (${Math.round(maxBytes / (1024 * 1024))} MB). Trim it and upload the file instead.`,
    );
  }
  if (buffer.byteLength === 0) throw new Error("The download came back empty. Try again.");
  return {
    bytes: new Uint8Array(buffer),
    contentType:
      response.headers.get("content-type")?.split(";")[0]?.trim() ||
      (media.kind === "audio" ? "audio/mpeg" : "video/mp4"),
  };
}
