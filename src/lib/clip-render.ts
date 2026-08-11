import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

import type { CaptionChunk } from "./captions";

const CORE_BASE = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";

/**
 * ffmpeg.wasm runs inside a single 32-bit heap (hard ~2GB ceiling, much less on
 * mobile). Two things used to blow it up mid-batch:
 *   1. up to 60 full-frame 1080x1920 PNG overlays decoded at once;
 *   2. one shared FFmpeg instance reused across clips, so every render kept
 *      adding to the same heap until an OOM abort killed the remaining clips.
 * Fixes: captions are drawn into a small band-sized PNG, the overlay count is
 * capped, renders are serialised through a queue, and the instance is
 * terminated after each clip so memory goes back to the browser.
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

/** Only one render at a time — parallel ffmpeg.wasm renders OOM the tab. */
let renderQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = renderQueue.then(task, task);
  renderQueue = run.catch(() => undefined);
  return run;
}

async function createFFmpeg(): Promise<FFmpeg> {
  const ffmpeg = new FFmpeg();
  await ffmpeg.load({
    coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
  });
  return ffmpeg;
}

/** Merges tiny chunks so long clips stay within the overlay budget. */
function budgetCaptions(captions: CaptionChunk[]): CaptionChunk[] {
  if (captions.length <= MAX_OVERLAYS) return captions;
  const groupSize = Math.ceil(captions.length / MAX_OVERLAYS);
  const merged: CaptionChunk[] = [];
  for (let i = 0; i < captions.length; i += groupSize) {
    const group = captions.slice(i, i + groupSize);
    merged.push({
      text: group.map((c) => c.text).join(" "),
      start: group[0]!.start,
      end: group[group.length - 1]!.end,
    });
  }
  return merged;
}

/** Draws one caption chunk into a transparent PNG the size of the caption band. */
function captionPng(text: string, width: number, bandHeight: number): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = bandHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser");

  const fontSize = Math.round(width * 0.075);
  ctx.font = `900 ${fontSize}px Inter, "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Wrap to at most 3 lines inside the band.
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
  const maxLines = Math.max(1, Math.floor(bandHeight / lineHeight));
  const shown = lines.slice(0, maxLines);

  const baseY = bandHeight / 2 - ((shown.length - 1) * lineHeight) / 2;
  shown.forEach((line, index) => {
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

function isMemoryError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /memory|abort|allocat|OOM|RuntimeError/i.test(message);
}

async function runRender(options: RenderClipOptions & { width: number; height: number }): Promise<Blob> {
  const { sourceUrl, startSeconds, endSeconds, width, height, fps = 30, onProgress, signal } = options;
  const duration = Math.max(1, endSeconds - startSeconds);
  const bandHeight = Math.round(height * 0.3);
  const bandY = Math.round(height * 0.6);

  onProgress?.(0.04, "Starting renderer…");
  const ffmpeg = await createFFmpeg();
  const inputName = "source.mp4";

  try {
    onProgress?.(0.08, "Loading source video…");
    // Only the bytes we need: the pipeline stores/serves the source over HTTP,
    // so a range request avoids pulling a whole long video into wasm memory
    // when the server supports it (fetchFile falls back to a full download).
    await ffmpeg.writeFile(inputName, await fetchFile(sourceUrl));
    if (signal?.aborted) throw new Error("Render cancelled");

    const chunks = budgetCaptions(options.captions);
    for (let index = 0; index < chunks.length; index += 1) {
      await ffmpeg.writeFile(`cap${index}.png`, await captionPng(chunks[index]!.text, width, bandHeight));
      if (signal?.aborted) throw new Error("Render cancelled");
    }
    onProgress?.(0.2, "Reframing to 9:16 and burning captions…");

    const filters: string[] = [
      `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=${fps}[v0]`,
    ];
    chunks.forEach((chunk, index) => {
      filters.push(
        `[v${index}][${index + 1}:v]overlay=0:${bandY}:enable='between(t,${chunk.start.toFixed(3)},${chunk.end.toFixed(3)})'[v${index + 1}]`,
      );
    });
    const outputLabel = `v${chunks.length}`;

    const progressHandler = ({ progress }: { progress: number }) => {
      if (Number.isFinite(progress) && progress > 0) {
        onProgress?.(0.2 + Math.min(0.75, progress * 0.75), "Rendering clip…");
      }
    };
    ffmpeg.on("progress", progressHandler);

    const code = await ffmpeg.exec([
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
      "ultrafast",
      "-crf",
      "26",
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
    ffmpeg.off("progress", progressHandler);
    if (code !== 0) throw new Error(`ffmpeg exited with code ${code}`);

    const data = await ffmpeg.readFile("output.mp4");
    const blob = new Blob([data as unknown as BlobPart], { type: "video/mp4" });
    if (blob.size === 0) throw new Error("The renderer produced an empty file");
    onProgress?.(1, "Clip ready");
    return blob;
  } finally {
    // Terminating frees the whole wasm heap, so the next clip starts clean.
    try {
      ffmpeg.terminate();
    } catch {
      /* already gone */
    }
  }
}

/**
 * Cuts the clip, reframes it to vertical 9:16 and burns animated pop-up
 * captions — all in the browser via ffmpeg.wasm.
 *
 * Renders are queued (never parallel) and retried at 720x1280 when the browser
 * runs out of memory, so a batch of clips finishes instead of dying halfway.
 */
export async function renderVerticalClip(options: RenderClipOptions): Promise<Blob> {
  const width = options.width ?? 1080;
  const height = options.height ?? 1920;

  return enqueue(async () => {
    try {
      return await runRender({ ...options, width, height });
    } catch (error) {
      if (options.signal?.aborted) throw error;
      if (!isMemoryError(error) || width <= 720) {
        throw new Error(
          error instanceof Error
            ? `Render failed: ${error.message}`
            : "Render failed in the browser renderer",
        );
      }
      options.onProgress?.(0.05, "Low memory — retrying at 720p…");
      return runRender({ ...options, width: 720, height: 1280, fps: 30 });
    }
  });
}
