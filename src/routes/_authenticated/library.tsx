import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Film, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/AppShell";
import { ImportVideoDialog } from "@/components/video/ImportVideoDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { videosApi } from "@/api/queries";
import { formatBytes, formatDuration, relativeTime } from "@/utils/format";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({
    meta: [
      { title: "Library — ClipMind AI" },
      { name: "description", content: "Every video you have imported, with pipeline status." },
      { property: "og:title", content: "Library — ClipMind AI" },
      { property: "og:description", content: "Every video you have imported, with pipeline status." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const queryClient = useQueryClient();
  const videos = useQuery({ queryKey: ["videos"], queryFn: videosApi.list });

  const remove = useMutation({
    mutationFn: (id: string) => videosApi.remove(id),
    onSuccess: () => {
      toast.success("Video removed");
      void queryClient.invalidateQueries({ queryKey: ["videos"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <PageHeader
        title="Library"
        description="Every video you have imported, with pipeline status."
        action={<ImportVideoDialog />}
      />

      {videos.isLoading ? (
        <div className="surface-panel p-6 text-sm text-muted-foreground">Loading your library…</div>
      ) : videos.data && videos.data.length > 0 ? (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {videos.data.map((video) => (
            <li key={video.id} className="surface-panel flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <Link
                  to="/videos/$videoId"
                  params={{ videoId: video.id }}
                  className="font-display text-base font-semibold tracking-tight hover:text-primary"
                >
                  {video.title ?? "Untitled video"}
                </Link>
                <Badge variant="secondary" className="shrink-0 capitalize">
                  {video.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDuration(video.duration_seconds)} · {formatBytes(video.size_bytes)} ·{" "}
                {relativeTime(video.created_at)}
              </p>
              <div className="mt-auto flex items-center gap-2">
                <Button asChild size="sm" variant="secondary" className="gap-2">
                  <Link to="/videos/$videoId" params={{ videoId: video.id }}>
                    <Film className="size-4" /> Open
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-2 text-muted-foreground"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(video.id)}
                >
                  <Trash2 className="size-4" /> Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="surface-panel p-8 text-center">
          <h2 className="font-display text-lg font-semibold">No videos yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Import a long-form video from a link or upload a file, and ClipMind will queue the full
            pipeline.
          </p>
          <div className="mt-4 flex justify-center">
            <ImportVideoDialog />
          </div>
        </div>
      )}
    </>
  );
}
