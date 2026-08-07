import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef } from "react";
import { AlertCircle, ArrowLeft, Loader2, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/AppShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { clipsApi, jobsApi, transcriptionsApi, videosApi } from "@/api/queries";
import { ClipRenderButton } from "@/components/video/ClipRenderButton";
import { JOB_LABELS } from "@/constants/app";
import { formatDuration, relativeTime } from "@/utils/format";
import { processVideo, retryVideoPipeline } from "@/lib/pipeline.functions";
import type { TranscriptWord } from "@/services/providers/types";
import { isTransientError } from "@/lib/retry";

export const Route = createFileRoute("/_authenticated/videos/$videoId")({
  head: () => ({
    meta: [
      { title: "Video — ClipMind AI" },
      { name: "description", content: "Pipeline status and AI-detected viral moments for this video." },
      { property: "og:title", content: "Video — ClipMind AI" },
      {
        property: "og:description",
        content: "Pipeline status and AI-detected viral moments for this video.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VideoDetailPage,
});

function VideoDetailPage() {
  const { videoId } = Route.useParams();
  const queryClient = useQueryClient();
  const retryQuery = (count: number, error: Error) => count < 3 && isTransientError(error);

  const video = useQuery({
    queryKey: ["video", videoId],
    queryFn: () => videosApi.byId(videoId),
    retry: retryQuery,
  });
  const jobs = useQuery({
    queryKey: ["jobs", videoId],
    queryFn: () => jobsApi.listByVideo(videoId),
    refetchInterval: 8000,
    retry: retryQuery,
  });
  const clips = useQuery({
    queryKey: ["clips", videoId],
    queryFn: () => clipsApi.listByVideo(videoId),
    retry: retryQuery,
  });

  const transcription = useQuery({
    queryKey: ["transcription", videoId],
    queryFn: () => transcriptionsApi.byVideo(videoId),
    retry: retryQuery,
  });

  const runProcess = useServerFn(processVideo);
  const processMutation = useMutation({
    mutationFn: () => runProcess({ data: { videoId } }),
    onSuccess: (result) => {
      if (result.ok) toast.success(result.message ?? "Pipeline finished");
      else toast.error(result.message ?? "Pipeline failed");
      void queryClient.invalidateQueries({ queryKey: ["jobs", videoId] });
      void queryClient.invalidateQueries({ queryKey: ["video", videoId] });
      void queryClient.invalidateQueries({ queryKey: ["clips", videoId] });
      void queryClient.invalidateQueries({ queryKey: ["transcription", videoId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Kick the pipeline off automatically the first time we see queued work.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current || processMutation.isPending) return;
    const status = video.data?.status;
    const hasQueued = (jobs.data ?? []).some((job) => job.status === "queued");
    if (!hasQueued || (status !== "pending" && status !== "processing")) return;
    autoStarted.current = true;
    processMutation.mutate();
  }, [video.data?.status, jobs.data, processMutation]);

  const runRetry = useServerFn(retryVideoPipeline);
  const retryMutation = useMutation({
    mutationFn: (jobId?: string) => runRetry({ data: { videoId, jobId: jobId ?? null } }),
    onSuccess: (result) => {
      toast.success(result.message);
      void queryClient.invalidateQueries({ queryKey: ["jobs", videoId] });
      void queryClient.invalidateQueries({ queryKey: ["video", videoId] });
      void queryClient.invalidateQueries({ queryKey: ["jobs", "active"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const jobList = jobs.data ?? [];
  const stuck = jobList.filter((job) => job.status === "failed" || job.status === "cancelled");
  const words = (transcription.data?.words ?? []) as unknown as TranscriptWord[];
  const loadError = (video.error ?? jobs.error ?? clips.error) as Error | null;

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 gap-2 text-muted-foreground">
        <Link to="/library">
          <ArrowLeft className="size-4" /> Back to library
        </Link>
      </Button>

      {loadError ? (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="size-4" />
          <AlertTitle>We couldn't load this video</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2">
            <span>{loadError.message}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void video.refetch();
                void jobs.refetch();
                void clips.refetch();
              }}
            >
              <RefreshCw className="size-4" /> Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <PageHeader
        title={video.data?.title ?? "Video"}
        description={
          video.data
            ? `${formatDuration(video.data.duration_seconds)} · imported ${relativeTime(video.data.created_at)}`
            : "Loading video…"
        }
        action={
          video.data ? (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="capitalize">
                {video.data.status}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                disabled={processMutation.isPending}
                onClick={() => processMutation.mutate()}
              >
                {processMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Play className="size-4" />
                )}
                {processMutation.isPending ? "Processing…" : "Process now"}
              </Button>
            </div>
          ) : null
        }
      />

      {stuck.length > 0 ? (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="size-4" />
          <AlertTitle>{stuck.length} stage(s) stopped</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2">
            <span>{stuck[0]?.error ?? "A processing stage failed before finishing."}</span>
            <Button
              size="sm"
              variant="outline"
              disabled={retryMutation.isPending}
              onClick={() => retryMutation.mutate(undefined)}
            >
              {retryMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Retry pipeline
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="surface-panel p-5">
          <h2 className="font-display text-base font-semibold">Viral moments</h2>
          {clips.isPending ? (
            <div className="mt-4 space-y-3">
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          ) : clips.data && clips.data.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {clips.data.map((clip) => (
                <li key={clip.id} className="rounded-xl border border-border bg-surface-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{clip.title ?? "Untitled clip"}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{clip.hook_text}</p>
                    </div>
                    <span className="shrink-0 rounded-lg bg-primary/15 px-2 py-1 text-xs text-primary">
                      {Math.round(clip.virality_score ?? 0)} viral
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {formatDuration(clip.start_seconds)} → {formatDuration(clip.end_seconds)} ·{" "}
                    {clip.category ?? "moment"}
                  </p>
                  {video.data ? (
                    <ClipRenderButton clip={clip} video={video.data} words={words} />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No clips yet. They appear as soon as transcription and AI analysis finish.
            </p>
          )}
        </div>

        <div className="surface-panel p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold">Pipeline</h2>
            <Button
              size="sm"
              variant="ghost"
              className="gap-2 text-muted-foreground"
              disabled={retryMutation.isPending || jobs.isFetching}
              onClick={() => retryMutation.mutate(undefined)}
            >
              {retryMutation.isPending || jobs.isFetching ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Retry stuck
            </Button>
          </div>
          {jobs.isPending ? (
            <div className="mt-4 space-y-3">
              {[0, 1, 2, 3].map((row) => (
                <Skeleton key={row} className="h-8 w-full" />
              ))}
            </div>
          ) : (
          <ul className="mt-4 space-y-3">
            {jobList.map((job) => (
              <li key={job.id}>
                <div className="flex items-center justify-between text-sm">
                  <span>{JOB_LABELS[job.type] ?? job.type}</span>
                  <span
                    className={
                      job.status === "failed" || job.status === "cancelled"
                        ? "text-xs capitalize text-destructive"
                        : "text-xs capitalize text-muted-foreground"
                    }
                  >
                    {job.status}
                  </span>
                </div>
                <Progress value={job.progress ?? 0} className="mt-2 h-1.5" />
                {job.error ? (
                  <p className="mt-1 flex items-start justify-between gap-2 text-xs text-destructive">
                    <span className="truncate">{job.error}</span>
                    <button
                      type="button"
                      className="shrink-0 underline"
                      disabled={retryMutation.isPending}
                      onClick={() => retryMutation.mutate(job.id)}
                    >
                      Retry
                    </button>
                  </p>
                ) : null}
              </li>
            ))}
            {jobList.length === 0 ? (
              <li className="text-sm text-muted-foreground">No jobs queued for this video.</li>
            ) : null}
          </ul>
          )}
        </div>
      </section>
    </>
  );
}
