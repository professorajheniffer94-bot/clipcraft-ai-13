import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, Loader2, Link2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { projectsApi } from "@/api/queries";
import { importVideoFromUrl, registerUploadedVideo } from "@/lib/pipeline.functions";
import { CLIP_DURATIONS, STORAGE_BUCKET } from "@/constants/app";
import { importUrlSchema } from "@/utils/validation";
import { withRetry } from "@/lib/retry";

const NO_PROJECT = "none";

export function ImportVideoDialog({ projectId }: { projectId?: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState("0");
  const [project, setProject] = useState(projectId ?? NO_PROJECT);
  const [status, setStatus] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const importUrl = useServerFn(importVideoFromUrl);
  const registerUpload = useServerFn(registerUploadedVideo);
  const projects = useQuery({ queryKey: ["projects"], queryFn: projectsApi.list });

  function done(message: string) {
    toast.success(message);
    setStatus(null);
    setOpen(false);
    setUrl("");
    setFile(null);
    void queryClient.invalidateQueries({ queryKey: ["videos"] });
    void queryClient.invalidateQueries({ queryKey: ["jobs", "active"] });
  }

  function retryNotice(attempt: number) {
    setStatus(`Connection hiccup — retrying (attempt ${attempt + 1} of 3)…`);
  }

  const urlMutation = useMutation({
    mutationFn: async () => {
      const parsed = importUrlSchema.pick({ url: true }).parse({ url });
      setStatus("Queueing import…");
      return withRetry(
        () =>
          importUrl({
            data: {
              url: parsed.url,
              projectId: project === NO_PROJECT ? null : project,
              targetDuration: Number(duration),
            },
          }),
        { onRetry: retryNotice },
      );
    },
    onSuccess: () => done("Video queued for processing"),
    onError: (error: Error) => {
      setStatus(null);
      toast.error(error.message);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a video file first");
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const safeName = file.name.replace(/[^\w.-]+/g, "-");
      const path = `${auth.user.id}/${Date.now()}-${safeName}`;
      setStatus("Uploading file…");
      await withRetry(
        async () => {
          const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
            contentType: file.type || "video/mp4",
            upsert: true,
          });
          if (error) throw new Error(error.message);
        },
        { onRetry: retryNotice },
      );
      setStatus("Registering video and queueing the pipeline…");
      return withRetry(
        () =>
          registerUpload({
            data: {
              storagePath: path,
              title: file.name,
              sizeBytes: file.size,
              projectId: project === NO_PROJECT ? null : project,
              targetDuration: Number(duration),
            },
          }),
        { onRetry: retryNotice },
      );
    },
    onSuccess: () => done("Upload registered and queued"),
    onError: (error: Error) => {
      setStatus(null);
      toast.error(error.message);
    },
  });

  const busy = urlMutation.isPending || uploadMutation.isPending;
  const failure = (urlMutation.error ?? uploadMutation.error) as Error | null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        if (!next) setStatus(null);
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Upload className="size-4" /> Import video
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import a video</DialogTitle>
          <DialogDescription>
            Paste a link or upload a file. We queue transcription, AI analysis and rendering.
          </DialogDescription>
        </DialogHeader>

        {failure && !busy ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Import failed</AlertTitle>
            <AlertDescription>
              {failure.message} — check the link or file and try again.
            </AlertDescription>
          </Alert>
        ) : null}

        {busy && status ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> {status}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Clip length</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLIP_DURATIONS.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Project</Label>
            <Select value={project} onValueChange={setProject}>
              <SelectTrigger>
                <SelectValue placeholder="No project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PROJECT}>No project</SelectItem>
                {(projects.data ?? []).map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="url" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="url" className="flex-1 gap-2">
              <Link2 className="size-4" /> From link
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex-1 gap-2">
              <Upload className="size-4" /> Upload
            </TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="space-y-3 pt-4">
            <div className="space-y-2">
              <Label htmlFor="import-url">Video URL</Label>
              <Input
                id="import-url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={url}
                onChange={(event) => setUrl(event.target.value)}
              />
            </div>
            <Button
              className="w-full"
              disabled={busy || url.trim().length === 0}
              onClick={() => urlMutation.mutate()}
            >
              {urlMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : "Queue import"}
            </Button>
          </TabsContent>

          <TabsContent value="upload" className="space-y-3 pt-4">
            <div className="space-y-2">
              <Label htmlFor="import-file">Video file</Label>
              <Input
                id="import-file"
                type="file"
                accept="video/*"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>
            <Button className="w-full" disabled={busy || !file} onClick={() => uploadMutation.mutate()}>
              {uploadMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Upload and queue"
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}