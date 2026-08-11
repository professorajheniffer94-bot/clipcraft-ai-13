class YoutubeMediaError extends Error {
  /** When true, retrying with another download mode cannot help. */
  readonly fatal: boolean;
  constructor(message: string, fatal: boolean) {
    super(message);
    this.name = "YoutubeMediaError";
    this.fatal = fatal;
  }
}

/**
 * YouTube link import.
 *
 * YouTube cannot be downloaded from inside the app's serverless runtime:
 * yt-dlp needs a real OS process, which the runtime does not provide.
 * So we delegate the extraction to a cobalt instance (https://github.com/imputnet/cobalt),
 * which is free and self-hostable, and then stream the returned file into storage.
 *
 * Required secret: COBALT_API_URL (e.g. https://my-cobalt.example.com)
 * Optional secret: COBALT_API_KEY (only if the instance requires api-key auth)
 */

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

export { youtubeVideoId } from "./youtube-url";

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
  const base = process.env["COBALT_API_URL"];
  if (!base || base.length === 0) {
    return "YouTube import is not configured yet — a download service (COBALT_API_URL) is required. Use the Upload tab meanwhile.";
  }
  return null;
}

/** Asks the cobalt instance for a direct media URL for this YouTube video. */
async function requestYoutubeMedia(
  videoId: string,
  mode: "video" | "audio",
): Promise<ResolvedMedia> {
  const base = process.env["COBALT_API_URL"];
  if (!base) throw new Error(youtubeImportBlockedReason() ?? "YouTube import is not configured.");
  const apiKey = process.env["COBALT_API_KEY"];

  const endpoint = base.replace(/\/$/, "") + "/";
  const body = JSON.stringify({
    url: `https://www.youtube.com/watch?v=${videoId}`,
    downloadMode: mode === "audio" ? "audio" : "auto",
    audioFormat: "mp3",
    videoQuality: "720",
    youtubeVideoCodec: "h264",
    filenameStyle: "basic",
  });

  // Free hosting (e.g. Render) sleeps idle instances: the first call can take
  // 30-60s extra to wake up, so we allow a long timeout and one retry.
  const attempt = async (timeoutMs: number) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          ...(apiKey ? { authorization: `Api-Key ${apiKey}` } : {}),
        },
        body,
      });
    } finally {
      clearTimeout(timer);
    }
  };

  let response: Response;
  try {
    response = await attempt(90_000);
  } catch {
    try {
      response = await attempt(60_000);
    } catch {
      throw new Error(
        "The download service did not respond (it may still be waking up from sleep on free hosting). Wait a minute and try again.",
      );
    }
  }

  const payload = (await response.json().catch(() => null)) as
    | { status?: string; url?: string; filename?: string; error?: { code?: string } }
    | null;

  if (!payload) throw new Error("The download service returned an unexpected response.");

  if (payload.status === "error" || !payload.url) {
    const code = payload.error?.code ?? "";
    if (/unavailable|not.?found|removed/i.test(code)) {
      throw new YoutubeMediaError("This video is unavailable or was removed.", true);
    }
    if (/live/i.test(code))
      throw new YoutubeMediaError("Live streams cannot be imported. Wait until the replay is published.", true);
    if (/length|duration/i.test(code))
      throw new YoutubeMediaError("This video is longer than the download service allows.", true);
    if (/rate|limit/i.test(code))
      throw new YoutubeMediaError("The download service is rate limited right now. Try again shortly.", false);
    if (/private|login|auth|consent|age|bot|captcha/i.test(code)) {
      // YouTube frequently demands sign-in only for the video stream when the
      // request comes from a datacenter IP — audio-only often still works,
      // so this is NOT fatal.
      throw new YoutubeMediaError(
        "YouTube asked this download service to sign in (common for cloud servers). Trying audio-only, or upload the file instead.",
        false,
      );
    }
    throw new YoutubeMediaError(
      `The download service could not fetch this YouTube video (${code || response.status}). YouTube often blocks video streams from cloud servers; audio still works.`,
      false,
    );
  }

  return {
    // The instance may advertise a stale API_URL, so tunnel links can point at a
    // host that no longer answers. Rewrite the origin to the configured base.
    url: rewriteToBase(payload.url, endpoint),
    filename: payload.filename ?? `${videoId}.${mode === "audio" ? "mp3" : "mp4"}`,
    kind: mode,
  };
}

/**
 * Resolves the media, falling back to audio-only when YouTube blocks the video
 * stream for the download service (common on cloud/datacenter IPs). Audio is
 * enough for transcription + AI analysis, so the pipeline still runs.
 */
export async function resolveYoutubeMedia(
  videoId: string,
  mode: "video" | "audio",
): Promise<ResolvedMedia> {
  if (mode === "audio") return requestYoutubeMedia(videoId, "audio");
  try {
    return await requestYoutubeMedia(videoId, "video");
  } catch (error) {
    // Only truly hard failures (removed, live, too long) skip the audio retry.
    if (error instanceof YoutubeMediaError && error.fatal) throw error;
    return requestYoutubeMedia(videoId, "audio");
  }
}

function rewriteToBase(mediaUrl: string, endpoint: string): string {
  try {
    const target = new URL(mediaUrl);
    const base = new URL(endpoint);
    if (target.origin !== base.origin) {
      target.protocol = base.protocol;
      target.host = base.host;
    }
    return target.toString();
  } catch {
    return mediaUrl;
  }
}

/** Downloads the resolved file, enforcing the plan's size ceiling. */
export async function downloadResolvedMedia(
  media: ResolvedMedia,
  maxBytes: number,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const response = await fetch(media.url);
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
