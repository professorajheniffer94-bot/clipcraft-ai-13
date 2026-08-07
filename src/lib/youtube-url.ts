/** Client-safe YouTube link parsing (shared by the UI and the server import). */
const ID = /^[\w-]{11}$/;

export function youtubeVideoId(raw: string): string | null {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0] ?? "";
      return ID.test(id) ? id : null;
    }
    if (host !== "youtube.com" && host !== "m.youtube.com" && host !== "music.youtube.com") return null;
    const v = url.searchParams.get("v");
    if (v && ID.test(v)) return v;
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => p === "shorts" || p === "live" || p === "embed" || p === "v");
    const candidate = idx >= 0 ? parts[idx + 1] : undefined;
    return candidate && ID.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

