import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/layout/AppShell";
import { ImportVideoDialog } from "@/components/video/ImportVideoDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { clipsApi, jobsApi, profilesApi, videosApi } from "@/api/queries";
import { formatBytes, formatDuration, relativeTime } from "@/utils/format";
import { JOB_LABELS } from "@/constants/app";
import { isTransientError } from "@/lib/retry";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — ClipMind AI" },
      { name: "description", content: "Your video library, processing queue and top-scoring clips." },
      { property: "og:title", content: "Dashboard — ClipMind AI" },
      { property: "og:description", content: "Your video library, processing queue and top-scoring clips." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const retry = (count: number, error: Error) => count < 3 && isTransientError(error);
  const profile = useQuery({ queryKey: ["profile"], queryFn: profilesApi.me, retry });
  const videos = useQuery({ queryKey: ["videos"], queryFn: videosApi.list, retry });
  const clips = useQuery({ queryKey: ["clips", "recent"], queryFn: () => clipsApi.listRecent(6), retry });
  const jobs = useQuery({
    queryKey: ["jobs", "active"],
    queryFn: jobsApi.listActive,
    refetchInterval: 10000,
    retry,
  });

  const stats = [
    { label: "Credits left", value: profile.data?.credits_remaining ?? 0 },
    { label: "Videos", value: videos.data?.length ?? 0 },
    { label: "Clips", value: clips.data?.length ?? 0 },
    {
      label: "Storage used",
      value: formatBytes(profile.data?.storage_used_bytes ?? 0),
    },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Everything moving through the pipeline right now."
        action={<ImportVideoDialog />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="surface-panel p-5">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{stat.label}</p>
            <p className="mt-2 font-display text-2xl font-semibold tracking-tight">{stat.value}</p>
          </div>
        ))}
      </div>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="surface-panel p-5">
          <h2 className="font-display text-base font-semibold">Processing queue</h2>
          {jobs.isPending ? (
            <div className="mt-4 space-y-3">
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : jobs.error ? (
            <p className="mt-3 text-sm text-destructive">
              Couldn't load the queue: {(jobs.error as Error).message}
            </p>
          ) : jobs.data && jobs.data.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {jobs.data.map((job) => (
                <li key={job.id} className="rounded-xl border border-border bg-surface-2 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span>{JOB_LABELS[job.type] ?? job.type}</span>
                    <span className="text-xs text-muted-foreground">{job.status}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                    <div className="h-full bg-primary" style={{ width: `${job.progress}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Nothing in the queue right now.</p>
          )}
        </div>

        <div className="surface-panel p-5">
          <h2 className="font-display text-base font-semibold">Recent videos</h2>
          {videos.isPending ? (
            <div className="mt-4 space-y-3">
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-5 w-full" />
              ))}
            </div>
          ) : videos.error ? (
            <p className="mt-3 text-sm text-destructive">
              Couldn't load your videos: {(videos.error as Error).message}
            </p>
          ) : videos.data && videos.data.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {videos.data.slice(0, 6).map((video) => (
                <li key={video.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{video.title ?? "Untitled video"}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDuration(video.duration_seconds)} · {relativeTime(video.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Import a video to start building your clip library.
            </p>
          )}
        </div>
      </section>
    </>
  );
}