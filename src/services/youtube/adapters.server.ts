import type {
  ResolvedMediaWithFallback,
  YoutubeProvider,
  YoutubeProviderRequest,
  YoutubeProviderResult,
} from "./types";

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

function resolveWithTimeout<T>(promise: Promise<T>, timeoutMs: number, signal?: AbortSignal): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      const timer = setTimeout(() => reject(new Error("Request timed out")), timeoutMs);
      const onAbort = () => {
        clearTimeout(timer);
        reject(new Error("Request aborted"));
      };
      if (signal) {
        signal.addEventListener("abort", onAbort, { once: true });
        if (signal.aborted) onAbort();
      }
    }),
  ]);
}

/** Cobalt self-hosted / community instance. */
export const cobaltProvider: YoutubeProvider = {
  id: "cobalt",
  isAvailable() {
    return Boolean(env("COBALT_API_URL"));
  },
  async resolve({ videoId, mode, signal }): Promise<YoutubeProviderResult> {
    const base = env("COBALT_API_URL");
    const apiKey = env("COBALT_API_KEY");
    if (!base) throw new Error("COBALT_API_URL is not configured");

    const endpoint = base.replace(/\/$/, "") + "/";
    const body = JSON.stringify({
      url: `https://www.youtube.com/watch?v=${videoId}`,
      downloadMode: mode === "audio" ? "audio" : "auto",
      audioFormat: "mp3",
      videoQuality: "720",
      youtubeVideoCodec: "h264",
      filenameStyle: "basic",
    });

    const response = await resolveWithTimeout(
      fetch(endpoint, {
        method: "POST",
        signal: signal ?? null,
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          ...(apiKey ? { authorization: `Api-Key ${apiKey}` } : {}),
        },
        body,
      }),
      90_000,
      signal,
    );

    const payload = (await response.json().catch(() => null)) as
      | { status?: string; url?: string; filename?: string; error?: { code?: string } }
      | null;

    if (!payload) throw new Error("Cobalt returned an unexpected response");
    if (payload.status === "error" || !payload.url) {
      const code = payload.error?.code ?? "";
      const message = classifyCobaltError(code, response.status);
      throw new YoutubeProviderError(message, isFatalCobaltError(code), "cobalt");
    }

    return {
      provider: "cobalt",
      media: {
        url: rewriteToBase(payload.url, endpoint),
        fallbackUrl: payload.url,
        filename: payload.filename ?? `${videoId}.${mode === "audio" ? "mp3" : "mp4"}`,
        kind: mode,
      },
    };
  },
};

/** RapidAPI YTStream fallback — free tier, no self-hosting required. */
export const rapidApiProvider: YoutubeProvider = {
  id: "rapidapi",
  isAvailable() {
    return Boolean(env("RAPIDAPI_KEY"));
  },
  async resolve({ videoId, mode, signal }): Promise<YoutubeProviderResult> {
    const key = env("RAPIDAPI_KEY");
    if (!key) throw new Error("RAPIDAPI_KEY is not configured");

    const host = "ytstream-download-youtube-videos.p.rapidapi.com";
    const endpoint = `https://${host}/dl?id=${encodeURIComponent(videoId)}`;

    const response = await resolveWithTimeout(
      fetch(endpoint, {
        method: "GET",
        signal,
        headers: {
          "X-RapidAPI-Key": key,
          "X-RapidAPI-Host": host,
          accept: "application/json",
        },
      }),
      60_000,
      signal,
    );

    const payload = (await response.json().catch(() => null)) as
      | {
          status?: string;
          title?: string;
          formats?: Array<{ url: string; quality: string; ext: string; itag?: number; type?: string }>;
          error?: string;
        }
      | null;

    if (!payload) throw new Error("RapidAPI returned an unexpected response");
    if (payload.status === "error" || !payload.formats || payload.formats.length === 0) {
      throw new YoutubeProviderError(
        payload.error ?? "RapidAPI could not extract this video",
        /private|removed|unavailable|not found|login|age|copyright/i.test(payload.error ?? ""),
        "rapidapi",
      );
    }

    // Prefer video format, fallback to audio-only when requested or only audio available.
    const videoFormat = payload.formats.find((f) => f.type?.startsWith("video") || /mp4|webm/i.test(f.ext));
    const audioFormat = payload.formats.find((f) => f.type?.startsWith("audio") || /m4a|mp3|webm/i.test(f.ext));
    const chosen = mode === "audio" ? audioFormat : videoFormat ?? audioFormat;
    if (!chosen) throw new YoutubeProviderError("RapidAPI found no downloadable format", true, "rapidapi");

    return {
      provider: "rapidapi",
      media: {
        url: chosen.url,
        filename: `${videoId}.${chosen.ext ?? (chosen.type?.startsWith("audio") ? "mp3" : "mp4")}`,
        kind: chosen.type?.startsWith("audio") ? "audio" : "video",
      },
      metadata: {
        note: chosen.type?.startsWith("audio") ? "RapidAPI returned audio-only" : undefined,
      },
    };
  },
};

class YoutubeProviderError extends Error {
  readonly fatal: boolean;
  readonly provider: string;
  constructor(message: string, fatal: boolean, provider: string) {
    super(message);
    this.name = "YoutubeProviderError";
    this.fatal = fatal;
    this.provider = provider;
  }
}

export { YoutubeProviderError };

export function isYoutubeProviderError(error: unknown): error is YoutubeProviderError {
  return error instanceof YoutubeProviderError;
}

function classifyCobaltError(code: string, httpStatus: number): string {
  if (/unavailable|not.?found|removed/i.test(code)) return "This video is unavailable or was removed.";
  if (/live/i.test(code)) return "Live streams cannot be imported. Wait until the replay is published.";
  if (/length|duration/i.test(code)) return "This video is longer than the download service allows.";
  if (/rate|limit/i.test(code)) return "The download service is rate limited right now. Try again shortly.";
  if (/private|login|auth|consent|age|bot|captcha/i.test(code)) {
    return "YouTube asked this download service to sign in (common for cloud servers). Trying a fallback provider, or upload the file instead.";
  }
  return `The download service could not fetch this YouTube video (${code || httpStatus}). YouTube often blocks video streams from cloud servers.`;
}

function isFatalCobaltError(code: string): boolean {
  return /unavailable|not.?found|removed|live|length|duration|private|copyright|age|login|auth/i.test(code);
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

/** Runs the fallback chain once for each requested mode. */
export async function resolveYoutubeWithFallback(
  videoId: string,
  mode: "video" | "audio",
  providers: YoutubeProvider[] = [cobaltProvider, rapidApiProvider],
  signal?: AbortSignal,
): Promise<YoutubeProviderResult> {
  const available = providers.filter((p) => p.isAvailable());
  if (available.length === 0) {
    throw new Error("YouTube import is not configured — add COBALT_API_URL or RAPIDAPI_KEY.");
  }

  if (mode === "audio") {
    // For audio-only, try the first available provider directly.
    const result = await tryProvider(available[0], videoId, "audio", signal);
    if (result.media.kind === "audio") return result;
    // If a video file was returned, that's fine too; we can still extract audio later.
    return result;
  }

  // Try each provider for video; if video fails, fall back to audio.
  let lastError: unknown;
  for (const provider of available) {
    try {
      const result = await tryProvider(provider, videoId, "video", signal);
      if (result.media.kind === "audio") {
        // Provider returned audio; keep trying other providers for video, or return audio if last.
        if (provider === available[available.length - 1]) return result;
        lastError = new YoutubeProviderError(
          `${provider.id} returned audio only for a video request`,
          false,
          provider.id,
        );
        continue;
      }
      return result;
    } catch (error) {
      if (isYoutubeProviderError(error) && error.fatal) throw error;
      lastError = error;
    }
  }

  // Last resort: audio-only from the first provider.
  for (const provider of available) {
    try {
      const result = await tryProvider(provider, videoId, "audio", signal);
      return result;
    } catch (error) {
      if (isYoutubeProviderError(error) && error.fatal) throw error;
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("YouTube blocked every configured download provider. Try uploading the file instead.");
}

async function tryProvider(
  provider: YoutubeProvider,
  videoId: string,
  mode: "video" | "audio",
  signal?: AbortSignal,
): Promise<YoutubeProviderResult> {
  try {
    return await provider.resolve({ videoId, mode, signal });
  } catch (error) {
    if (isYoutubeProviderError(error)) throw error;
    throw new YoutubeProviderError(
      error instanceof Error ? error.message : `${provider.id} failed`,
      false,
      provider.id,
    );
  }
}
