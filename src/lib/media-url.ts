/**
 * The pipeline reads media by fetching the URL directly, so only direct
 * file links work. Social platforms serve HTML pages (and rate-limit
 * server requests with 429s), which is why those imports failed.
 */
const PLATFORM_HOSTS: Array<{ match: RegExp; label: string }> = [
  { match: /(^|\.)youtube\.com$|(^|\.)youtu\.be$/i, label: "YouTube" },
  { match: /(^|\.)tiktok\.com$/i, label: "TikTok" },
  { match: /(^|\.)instagram\.com$/i, label: "Instagram" },
  { match: /(^|\.)facebook\.com$|(^|\.)fb\.watch$/i, label: "Facebook" },
  { match: /(^|\.)twitter\.com$|(^|\.)x\.com$/i, label: "X" },
  { match: /(^|\.)vimeo\.com$/i, label: "Vimeo" },
  { match: /(^|\.)twitch\.tv$/i, label: "Twitch" },
  { match: /drive\.google\.com$|docs\.google\.com$/i, label: "Google Drive" },
  { match: /(^|\.)dropbox\.com$/i, label: "Dropbox" },
  { match: /(^|\.)onedrive\.live\.com$|(^|\.)1drv\.ms$/i, label: "OneDrive" },
];

const MEDIA_EXTENSION = /\.(mp4|mov|m4v|webm|mkv|mp3|m4a|wav|aac|ogg|flac)(\?|#|$)/i;

/** Returns the platform label when the link is a page, not a media file. */
export function detectPlatform(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    return PLATFORM_HOSTS.find((entry) => entry.match.test(host))?.label ?? null;
  } catch {
    return null;
  }
}

export function isDirectMediaUrl(url: string): boolean {
  try {
    return MEDIA_EXTENSION.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

/** Human-readable reason a link cannot be imported, or null when it can. */
export function mediaUrlProblem(url: string): string | null {
  const platform = detectPlatform(url);
  if (platform) {
    return `${platform} links can't be downloaded automatically — ${platform} blocks server downloads. Download the video and use the Upload tab instead.`;
  }
  if (!isDirectMediaUrl(url)) {
    return "This link doesn't point to a video or audio file. Use a direct file link (…/video.mp4) or the Upload tab.";
  }
  return null;
}