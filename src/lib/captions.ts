import type { TranscriptWord } from "@/services/providers/types";

export interface CaptionChunk {
  text: string;
  /** Seconds relative to the clip start. */
  start: number;
  end: number;
}

/**
 * Groups word-level timestamps into short caption chunks (pop-up / karaoke
 * style), clipped to the requested window and rebased to zero.
 */
export function buildCaptionChunks(
  words: TranscriptWord[],
  clipStart: number,
  clipEnd: number,
  wordsPerChunk = 3,
): CaptionChunk[] {
  const inside = words
    .filter((w) => typeof w.start === "number" && w.end > clipStart && w.start < clipEnd)
    .sort((a, b) => a.start - b.start);

  const chunks: CaptionChunk[] = [];
  for (let i = 0; i < inside.length; i += wordsPerChunk) {
    const group = inside.slice(i, i + wordsPerChunk);
    if (group.length === 0) continue;
    const start = Math.max(0, group[0]!.start - clipStart);
    const end = Math.min(clipEnd - clipStart, group[group.length - 1]!.end - clipStart);
    if (end <= start) continue;
    chunks.push({
      text: group
        .map((w) => (w.text ?? "").trim())
        .filter(Boolean)
        .join(" ")
        .toUpperCase(),
      start,
      end,
    });
  }
  return chunks;
}
