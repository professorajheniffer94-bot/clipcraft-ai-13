import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { clipsApi, jobsApi, videosApi } from "@/api/queries";
import { JOB_LABELS } from "@/constants/app";
import { formatDuration, relativeTime } from "@/utils/format";

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
  const video = useQuery({ queryKey: ["video", videoId], queryFn: () => videosApi.byId(videoId) });
  const jobs = useQuery({
    queryKey: ["jobs", videoId],
    queryFn: () => jobsApi.listByVideo(videoId),
    refetchInterval: 8000,
  });
  const clips = useQuery({ queryKey: ["clips", videoId], queryFn: () => clipsApi.listByVideo(videoId) });

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 gap-2 text-muted-foreground">
        <Link to="/library">
          <ArrowLeft className="size-4" /> Back to library
        </Link>
      </Button>

      <PageHeader
        title={video.data?.title ?? "Video"}
        description={
          video.data
            ? `${formatDuration(video.data.duration_seconds)} · imported ${relativeTime(video.data.created_at)}`
            : "Loading video…"
        }
        action={
          video.data ? (
            <Badge variant="secondary" className="capitalize">
              {video.data.status}
            </Badge>
          ) : null
        }
      />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="surface-panel p-5">
          <h2 className="font-display text-base font-semibold">Viral moments</h2>
          {clips.data && clips.data.length > 0 ? (
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
          <h2 className="font-display text-base font-semibold">Pipeline</h2>
          <ul className="mt-4 space-y-3">
            {(jobs.data ?? []).map((job) => (
              <li key={job.id}>
                <div className="flex items-center justify-between text-sm">
                  <span>{JOB_LABELS[job.type] ?? job.type}</span>
                  <span className="text-xs capitalize text-muted-foreground">{job.status}</span>
                </div>
                <Progress value={job.progress ?? 0} className="mt-2 h-1.5" />
              </li>
            ))}
            {jobs.data && jobs.data.length === 0 ? (
              <li className="text-sm text-muted-foreground">No jobs queued for this video.</li>
            ) : null}
          </ul>
        </div>
      </section>
    </>
  );
}
