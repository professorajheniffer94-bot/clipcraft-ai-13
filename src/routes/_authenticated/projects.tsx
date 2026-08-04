import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { projectsApi, videosApi } from "@/api/queries";
import { projectSchema } from "@/utils/validation";
import { relativeTime } from "@/utils/format";

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({
    meta: [
      { title: "Projects — ClipMind AI" },
      { name: "description", content: "Group videos and clips per client or channel." },
      { property: "og:title", content: "Projects — ClipMind AI" },
      { property: "og:description", content: "Group videos and clips per client or channel." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const projects = useQuery({ queryKey: ["projects"], queryFn: projectsApi.list });
  const videos = useQuery({ queryKey: ["videos"], queryFn: videosApi.list });

  const create = useMutation({
    mutationFn: async () => {
      const parsed = projectSchema.parse({ name, description: description || undefined });
      return projectsApi.create(parsed);
    },
    onSuccess: () => {
      toast.success("Project created");
      setOpen(false);
      setName("");
      setDescription("");
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => projectsApi.remove(id),
    onSuccess: () => {
      toast.success("Project deleted");
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function countVideos(projectId: string) {
    return (videos.data ?? []).filter((video) => video.project_id === projectId).length;
  }

  return (
    <>
      <PageHeader
        title="Projects"
        description="Group videos and clips per client or channel."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <FolderPlus className="size-4" /> New project
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>New project</DialogTitle>
                <DialogDescription>Keep a client or channel organised in one place.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="project-name">Name</Label>
                  <Input
                    id="project-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Podcast season 3"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project-description">Description</Label>
                  <Textarea
                    id="project-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="What is this project about?"
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={create.isPending || name.trim().length < 2}
                  onClick={() => create.mutate()}
                >
                  Create project
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {projects.data && projects.data.length > 0 ? (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.data.map((project) => (
            <li key={project.id} className="surface-panel flex flex-col gap-2 p-5">
              <h2 className="font-display text-base font-semibold tracking-tight">{project.name}</h2>
              <p className="text-sm text-muted-foreground">
                {project.description ?? "No description yet."}
              </p>
              <p className="text-xs text-muted-foreground">
                {countVideos(project.id)} videos · created {relativeTime(project.created_at)}
              </p>
              <Button
                size="sm"
                variant="ghost"
                className="mt-auto w-fit gap-2 text-muted-foreground"
                disabled={remove.isPending}
                onClick={() => remove.mutate(project.id)}
              >
                <Trash2 className="size-4" /> Delete
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="surface-panel p-8 text-center text-sm text-muted-foreground">
          No projects yet — create one to group your videos and clips.
        </div>
      )}
    </>
  );
}
