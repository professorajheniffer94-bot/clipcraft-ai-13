/**
 * Confirms a link really serves a media file before the pipeline is queued.
 * Uses HEAD first, then a 1-byte ranged GET for servers that reject HEAD.
 */
export interface MediaProbe {
  ok: boolean;
  reason?: string;
  contentType?: string | null;
  sizeBytes?: number | null;
}

const MEDIA_TYPE = /^(video|audio)\//i;
const PAGE_TYPE = /^(text\/|application\/(x?html|xhtml\+xml|json|rss))/i;

function inspect(response: Response): MediaProbe {
  const contentType = (response.headers.get("content-type") ?? "").split(";")[0]?.trim() ?? "";
  const length = Number(
    response.headers.get("content-range")?.split("/")[1] ?? response.headers.get("content-length") ?? "",
  );
  const sizeBytes = Number.isFinite(length) && length > 0 ? length : null;

  if (PAGE_TYPE.test(contentType)) {
    return {
      ok: false,
      reason:
        "That link returns a web page, not a video file. Open the page, download the video, and use the Upload tab.",
      contentType,
      sizeBytes,
    };
  }
  if (contentType && !MEDIA_TYPE.test(contentType) && contentType !== "application/octet-stream") {
    return {
      ok: false,
      reason: `The link responded with "${contentType}" instead of a video or audio file.`,
      contentType,
      sizeBytes,
    };
  }
  return { ok: true, contentType: contentType || null, sizeBytes };
}

export async function probeMediaUrl(url: string, maxBytes?: number): Promise<MediaProbe> {
  const attempt = async (init: RequestInit) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      return await fetch(url, { ...init, redirect: "follow", signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };

  let response: Response;
  try {
    response = await attempt({ method: "HEAD" });
    if (!response.ok || !response.headers.get("content-type")) {
      response = await attempt({ method: "GET", headers: { Range: "bytes=0-0" } });
    }
  } catch {
    return { ok: false, reason: "The link could not be reached. Check it and try again." };
  }

  if (!response.ok && response.status !== 206) {
    return {
      ok: false,
      reason:
        response.status === 429
          ? "The source refused the download (rate limited). Download the file and use the Upload tab."
          : response.status === 401 || response.status === 403
            ? "The link is private or requires sign-in, so it can't be downloaded."
            : `The link responded with an error (${response.status}).`,
    };
  }

  const probe = inspect(response);
  if (probe.ok && maxBytes && probe.sizeBytes && probe.sizeBytes > maxBytes) {
    return { ...probe, ok: false, reason: `This file is larger than the allowed import size.` };
  }
  return probe;
}