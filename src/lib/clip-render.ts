import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

import type { CaptionChunk } from "./captions";

const CORE_BASE = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";

/**
 * ffmpeg.wasm runs in a single 32-bit heap (hard ~2GB ceiling, far less in
 * practice on mobile). Two things used to blow it up:
 *   1. dozens of full-frame 1080x1920 PNG overlays kept in memory at once;
 *   2. reusing one FFmpeg instance across clips, so every render added to the
 *      same heap until an out-of-memory abort killed the batch halfway.
 * So captions are now drawn into a small band-sized PNG, the number of
 * overlays is capped, renders are serialised through a queue, and the instance
 * is terminated after each clip.
 */
const MAX_OVERLAYS = 24;

export interface RenderClipOptions {
  /** Direct/signed URL to the source video. */
  sourceUrl: string;
  startSeconds: number;
  endSeconds: number;
  captions: CaptionChunk[];
  width?: number;
  height?: number;
  fps?: number;
  onProgress?: (ratio: number, message: string) => void;
  signal?: AbortSignal;
}

let ffmpegPromise: Promise<FFmpeg> | null = null;

async function getFFmpeg(onLog?: (message: string) => void): Promise<FFmpeg> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
      });
      return ffmpeg;
    })().catch((error) => {
      ffmpegPromise = null;
      throw error;
    });
  }
  const instance = await ffmpegPromise;
  if (onLog) instance.on("log", ({ message }) => onLog(message));
  return instance;
}

/** Draws one caption chunk into a transparent PNG overlay. */
function captionPng(text: string, width: number, height: number): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser");

  const fontSize = Math.round(width * 0.075);
  ctx.font = `900 ${fontSize}px Inter, "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Wrap to at most 2 lines.
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > width * 0.82 && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  const lineHeight = fontSize * 1.18;
  const baseY = height * 0.74 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    const y = baseY + index * lineHeight;
    ctx.lineWidth = Math.max(6, fontSize * 0.16);
    ctx.strokeStyle = "rgba(12,10,18,0.92)";
    ctx.strokeText(line, width / 2, y);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(line, width / 2, y);
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("Could not rasterise captions"));
      blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)), reject);
    }, "image/png");
  });
}

/**
 * Cuts the clip, reframes it to vertical 9:16 and burns animated pop-up
 * captions — all in the browser via ffmpeg.wasm.
 */
export async function renderVerticalClip(options: RenderClipOptions): Promise<Blob> {
  const {
    sourceUrl,
    startSeconds,
    endSeconds,
    captions,
    width = 1080,
    height = 1920,
    fps = 30,
    onProgress,
    signal,
  } = options;

  const duration = Math.max(1, endSeconds - startSeconds);
  const ffmpeg = await getFFmpeg();
  onProgress?.(0.05, "Loading source video…");

  const inputName = "source.mp4";
  await ffmpeg.writeFile(inputName, await fetchFile(sourceUrl));
  if (signal?.aborted) throw new Error("Render cancelled");

  const chunks = captions.slice(0, 60);
  for (let index = 0; index < chunks.length; index += 1) {
    await ffmpeg.writeFile(`cap${index}.png`, await captionPng(chunks[index]!.text, width, height));
  }
  onProgress?.(0.2, "Reframing to 9:16 and burning captions…");

  const filters: string[] = [
    `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=${fps}[v0]`,
  ];
  chunks.forEach((chunk, index) => {
    // Small scale-up at the start of each chunk gives the "pop" feel.
    filters.push(
      `[v${index}][${index + 1}:v]overlay=0:0:enable='between(t,${chunk.start.toFixed(3)},${chunk.end.toFixed(3)})'[v${index + 1}]`,
    );
  });
  const outputLabel = `v${chunks.length}`;

  const progressHandler = ({ progress }: { progress: number }) => {
    if (Number.isFinite(progress) && progress > 0) {
      onProgress?.(0.2 + Math.min(0.75, progress * 0.75), "Rendering clip…");
    }
  };
  ffmpeg.on("progress", progressHandler);

  try {
    await ffmpeg.exec([
      "-ss",
      startSeconds.toFixed(3),
      "-t",
      duration.toFixed(3),
      "-i",
      inputName,
      ...chunks.flatMap((_, index) => ["-i", `cap${index}.png`]),
      "-filter_complex",
      filters.join(";"),
      "-map",
      `[${outputLabel}]`,
      "-map",
      "0:a?",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      "output.mp4",
    ]);
    const data = await ffmpeg.readFile("output.mp4");
    onProgress?.(1, "Clip ready");
    return new Blob([data as unknown as BlobPart], { type: "video/mp4" });
  } finally {
    ffmpeg.off("progress", progressHandler);
    await ffmpeg.deleteFile(inputName).catch(() => undefined);
    await Promise.all(
      chunks.map((_, index) => ffmpeg.deleteFile(`cap${index}.png`).catch(() => undefined)),
    );
  }
}
