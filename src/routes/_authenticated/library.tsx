import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Film } from "lucide-react";
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
  component: LibraryPage;
});
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/library')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_authenticated/library"!</div>
}
