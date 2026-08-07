/**
 * Polls the processing pipeline for a video until every stage finishes or one fails.
 * Adapted to this project's schema (`processing_jobs`, one row per stage) instead of
 * a single `jobs` row, so progress is the average across all stages.
 */
import { jobsApi } from "@/api/queries";
import { JOB_LABELS } from "@/constants/app";
import type { ProcessingJob } from "@/types/domain";
import { sleep } from "@/lib/retry";

export interface PollOptions {
  /** Called on every tick with overall progress (0-100) and a human-readable status line. */
  onProgress?: (progress: number, message: string) => void;
  intervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface PollResult {
  jobs: ProcessingJob[];
  progress: number;
}

function summarize(jobs: ProcessingJob[]) {
  const progress = jobs.length
    ? Math.round(jobs.reduce((total, job) => total + (job.progress ?? 0), 0) / jobs.length)
    : 0;
  const current =
    jobs.find((job) => job.status === "running") ??
    jobs.find((job) => job.status === "queued") ??
    jobs[jobs.length - 1];
  const label = current ? (JOB_LABELS[current.type] ?? current.type) : "Waiting for pipeline";
  const message = current ? `${label} — ${current.status}` : label;
  return { progress, message };
}

export async function pollPipelineStatus(
  videoId: string,
  options: PollOptions = {},
): Promise<PollResult> {
  const intervalMs = options.intervalMs ?? 3000;
  const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (options.signal?.aborted) throw new Error("Polling cancelled");

    const jobs = await jobsApi.listByVideo(videoId);
    const { progress, message } = summarize(jobs);
    options.onProgress?.(progress, message);

    const failed = jobs.find((job) => job.status === "failed" || job.status === "cancelled");
    if (failed) {
      throw new Error(
        failed.error ??
          `${JOB_LABELS[failed.type] ?? failed.type} stage ${failed.status} without details.`,
      );
    }

    if (jobs.length > 0 && jobs.every((job) => job.status === "succeeded")) {
      options.onProgress?.(100, "Pipeline complete");
      return { jobs, progress: 100 };
    }

    await sleep(intervalMs);
  }

  throw new Error("Processing is taking longer than expected. Open the video to retry stuck stages.");
}